use std::io::{BufRead, Write};
use std::net::TcpStream;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    window::Color,
    Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use windows_sys::Win32::Foundation::HANDLE;
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
use windows_sys::Win32::System::Threading::{
    GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_QUOTA,
    PROCESS_TERMINATE,
};

const CREATE_NO_WINDOW: u32 = 0x08000000;
const STILL_ACTIVE: u32 = 259;

static DIAG_PATH: OnceLock<PathBuf> = OnceLock::new();

fn log_diag(msg: &str) {
    use std::io::Write;
    let path = match DIAG_PATH.get() {
        Some(p) => p,
        None => return,
    };
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        let ts = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%.3f");
        let _ = writeln!(f, "[{ts}] {msg}");
    }
}

struct JobObject {
    handle: HANDLE,
}

impl JobObject {
    fn new() -> Result<Self, Box<dyn std::error::Error>> {
        // SAFETY: null name creates an unnamed job object; null attributes
        // uses the default security descriptor. Both are valid arguments.
        let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() {
            return Err("CreateJobObjectW failed".into());
        }

        // SAFETY: JOBOBJECT_EXTENDED_LIMIT_INFORMATION is a C struct
        // composed of integer fields; all bit patterns are valid and
        // zero-initialization is safe.
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        // SAFETY: handle is a valid job object handle verified non-null above;
        // &limits points to a correctly initialized JOBOBJECT_EXTENDED_LIMIT_INFORMATION;
        // the size argument matches the struct size exactly.
        let ret = unsafe {
            SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        };
        if ret == 0 {
            // SAFETY: handle is a valid handle that was successfully created
            // above and is about to be abandoned on this error path.
            unsafe { windows_sys::Win32::Foundation::CloseHandle(handle) };
            return Err("SetInformationJobObject failed".into());
        }

        Ok(Self { handle })
    }

    fn assign(&self, pid: u32) -> Result<(), Box<dyn std::error::Error>> {
        // SAFETY: pid comes from Child::id() which is a valid OS process ID;
        // 0 = no handle inheritance; PROCESS_SET_QUOTA | PROCESS_TERMINATE
        // are the minimum rights needed for job assignment.
        let proc_handle = unsafe { OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid) };
        if proc_handle.is_null() {
            return Err("OpenProcess failed".into());
        }

        // SAFETY: self.handle is a valid job object handle; proc_handle is a
        // valid process handle verified non-null above.
        let ret = unsafe { AssignProcessToJobObject(self.handle, proc_handle) };
        // SAFETY: proc_handle is no longer needed after job assignment.
        unsafe { windows_sys::Win32::Foundation::CloseHandle(proc_handle) };
        if ret == 0 {
            return Err("AssignProcessToJobObject failed".into());
        }

        Ok(())
    }
}

// SAFETY: Windows HANDLE values are process-wide and thread-safe by design.
unsafe impl Send for JobObject {}
unsafe impl Sync for JobObject {}

impl Drop for JobObject {
    fn drop(&mut self) {
        // SAFETY: self.handle is a valid job object handle created in new().
        // Closing the handle causes KILL_ON_JOB_CLOSE to terminate all
        // assigned processes if this is the last handle.
        unsafe { windows_sys::Win32::Foundation::CloseHandle(self.handle) };
    }
}

struct ServerState {
    child: Option<Child>,
    url: Option<String>,
    // SAFETY: This field is a RAII guard. The Arc keeps the JobObject
    // alive; when the last Arc is dropped, KILL_ON_JOB_CLOSE terminates
    // all child processes. Do NOT remove this field — it is "read" by
    // Arc::drop, not by any explicit code path.
    job: Option<Arc<JobObject>>,
}

/// Spawn the Node.js launcher and block until we parse the dashboard URL.
/// The child is assigned to `job` immediately after spawn so that
/// KILL_ON_JOB_CLOSE guarantees cleanup even if the parent exits early.
fn spawn_server_blocking(
    job: &JobObject,
) -> Result<(Child, String, u16, String), Box<dyn std::error::Error>> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();

    let launcher = exe_dir
        .join("resources")
        .join("server")
        .join("launcher.mjs");
    let node_exe = exe_dir.join("resources").join("server").join("node.exe");

    let node_path = if node_exe.exists() {
        node_exe
    } else {
        std::path::PathBuf::from("node")
    };

    log_diag(&format!(
        "[tauri] launching: {:?} {:?}",
        node_path, launcher
    ));

    let mut child = Command::new(&node_path)
        .arg(&launcher)
        .arg("--port")
        .arg("0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()?;

    // P1-2: assign to job object immediately to prevent orphan processes
    if let Err(e) = job.assign(child.id()) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(format!("JobObject assign failed: {e}").into());
    }

    let stdout = child.stdout.take().expect("failed to capture stdout");
    let reader = std::io::BufReader::new(stdout);

    // Read stderr into a log file for debugging
    let stderr = child.stderr.take().expect("failed to capture stderr");
    let exe_dir_clone = exe_dir.clone();
    let _handle = std::thread::spawn(move || {
        use std::io::Write;
        let log_path = exe_dir_clone.join("launcher-stderr.log");
        let r = std::io::BufReader::new(stderr);
        for lr in r.lines() {
            let line = match lr {
                Ok(l) => l,
                Err(_) => {
                    if let Ok(mut f) = std::fs::OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(&log_path)
                    {
                        let _ = writeln!(f, "[binary line skipped]");
                    }
                    continue;
                }
            };
            if let Ok(mut f) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
            {
                let _ = writeln!(f, "{}", line);
            }
        }
    });

    // P0-2: watchdog thread — if Node never writes a URL line within 30s, abort
    let timed_out = Arc::new(AtomicBool::new(false));
    let timed_out_flag = timed_out.clone();
    let _handle = std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(30));
        timed_out_flag.store(true, Ordering::Release);
        log_diag("[rust] readline timeout — child did not produce URL in 30s");
    });

    let mut url = String::new();
    let mut port: u16 = 0;
    let mut token = String::new();
    for line in reader.lines() {
        // Check timeout flag each iteration
        if timed_out.load(Ordering::Acquire) {
            let _ = child.kill();
            return Err("launcher timed out waiting for dashboard URL".into());
        }
        let line = line?;
        log_diag(&format!("[launcher] {line}"));
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&line) {
            if let Some(err) = parsed["error"].as_str() {
                let _ = child.kill();
                return Err(format!("launcher error: {err}").into());
            }
            if let Some(u) = parsed["url"].as_str() {
                url = u.to_string();
            }
            if let Some(p) = parsed["port"].as_u64() {
                port = p as u16;
            }
            if let Some(t) = parsed["token"].as_str() {
                token = t.to_string();
            }
            if !url.is_empty() {
                break;
            }
        }
    }

    if url.is_empty() {
        let _ = child.kill();
        return Err("failed to discover dashboard URL".into());
    }

    Ok((child, url, port, token))
}

fn check_health(port: u16, token: &str) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    let request = format!(
        "GET /api/health?token={} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
        token, port
    );
    let sockaddr: std::net::SocketAddr = match addr.parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&sockaddr, Duration::from_secs(1)) {
        Ok(s) => s,
        Err(_) => return false,
    };
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    // P2: use BufRead::read_line to read the full HTTP status line
    // — TcpStream::read() may return a partial line
    let mut reader = std::io::BufReader::new(&mut stream);
    let mut head = String::new();
    if reader.read_line(&mut head).is_err() {
        return false;
    }
    let head = head.trim_end();
    head.starts_with("HTTP/1.1 200") || head.starts_with("HTTP/1.0 200")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // P3: initialize diagnostics log path early so background threads
    // spawned in setup() can write diag entries regardless of ordering.
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();
    let _ = DIAG_PATH.set(exe_dir.join("launcher-diag.log"));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .manage(Mutex::new(ServerState {
            child: None,
            url: None,
            job: None,
        }))
        .setup(|app| {
            // ── Create main window ────────────────────────────────
            let main_window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("index.html".into()),
            )
            .title("Visionox")
            .background_color(Color::from((243u8, 244u8, 246u8)))
            .inner_size(1280.0, 800.0)
            .min_inner_size(800.0, 500.0)
            .center()
            .visible(true)
            .build()?;

            // Create Job Object for guaranteed child cleanup on exit
            let job = JobObject::new().expect("failed to create job object");
            let job = Arc::new(job);
            let job_for_thread = job.clone();

            // Spawn server in background thread so UI isn't blocked
            let win_for_url = main_window.clone();
            let app_handle = app.handle().clone();

            // P0-4: catch_unwind so a panic doesn't silently kill the thread
            let _handle = std::thread::spawn(move || {
                let result =
                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        log_diag("[rust] background thread started");
                        match spawn_server_blocking(&job_for_thread) {
                            Ok((child, url, port, token)) => {
                                log_diag(&format!(
                                    "[rust] server spawned — url={url}, port={port}"
                                ));
                                let child_pid = child.id();
                                let state = app_handle.state::<Mutex<ServerState>>();
                                {
                                    // P1-4: poison-safe lock
                                    let mut s = state
                                        .lock()
                                        .unwrap_or_else(|e| e.into_inner());
                                    s.child = Some(child);
                                    s.url = Some(url.clone());
                                    s.job = Some(job_for_thread);
                                }
                                let mut healthy = false;
                                let health_start = std::time::Instant::now();
                                for attempt in 0..15 {
                                    log_diag(&format!(
                                        "[rust] health check attempt {}/15",
                                        attempt + 1
                                    ));
                                    if check_health(port, &token) {
                                        healthy = true;
                                        break;
                                    }
                                    std::thread::sleep(Duration::from_millis(200));
                                }
                                if healthy {
                                    log_diag(
                                        "[rust] health check passed — navigating to dashboard",
                                    );
                                    let nav_js = format!(
                                        "window.location.replace('{url}');",
                                        url = url.replace('\'', "\\'"),
                                    );
                                    log_diag(&format!("[rust] eval js: {nav_js}"));
                                    // P1-5: log eval failure instead of silently discarding
                                    if let Err(e) = win_for_url.eval(&nav_js) {
                                        log_diag(&format!(
                                            "eval(navigate) failed: {e}"
                                        ));
                                    }

                                    // P0-3: monitor child process for unexpected exit
                                    let win_for_monitor = win_for_url.clone();
                                    let _handle = std::thread::spawn(move || loop {
                                        std::thread::sleep(Duration::from_secs(2));
                                        let exited = unsafe {
                                            let handle = OpenProcess(
                                                PROCESS_QUERY_LIMITED_INFORMATION,
                                                0,
                                                child_pid,
                                            );
                                            if handle.is_null() {
                                                true
                                            } else {
                                                let mut code: u32 = 0;
                                                let ok = GetExitCodeProcess(
                                                    handle, &mut code,
                                                );
                                                windows_sys::Win32::Foundation::CloseHandle(handle);
                                                ok != 0 && code != STILL_ACTIVE
                                            }
                                        };
                                        if exited {
                                            log_diag("[rust] child process exited unexpectedly after navigation");
                                            let _ = win_for_monitor.eval(
                                                "document.body.innerHTML='<div style=\"display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#ef4444;font-size:18px\">Server process has stopped unexpectedly.<br>Please restart the application.</div>';"
                                            );
                                            break;
                                        }
                                    });
                                } else {
                                    log_diag(&format!(
                                        "[rust] health check TIMED OUT after {:?}",
                                        health_start.elapsed()
                                    ));
                                    // P1-5: log failures
                                    if let Err(e) = win_for_url.eval(
                                        "document.getElementById('status').textContent='Server did not respond \\u2014 please restart';document.getElementById('status').style.color='#ef4444';",
                                    ) {
                                        log_diag(&format!("eval(timeout) failed: {e}"));
                                    }
                                }
                            }
                            Err(e) => {
                                log_diag(&format!("[rust] server FAILED: {e}"));
                                if let Err(ev_err) = win_for_url.eval(format!(
                                    "document.getElementById('status').textContent='Server failed: {}';document.getElementById('status').style.color='#ef4444';",
                                    e.to_string().replace('\'', "\\'")
                                )) {
                                    log_diag(&format!("eval(server-fail) failed: {ev_err}"));
                                }
                            }
                        }
                    }));
                if let Err(panic_payload) = result {
                    let msg = if let Some(s) = panic_payload.downcast_ref::<&str>() {
                        format!("background thread panicked: {s}")
                    } else if let Some(s) = panic_payload.downcast_ref::<String>() {
                        format!("background thread panicked: {s}")
                    } else {
                        "background thread panicked (unknown payload)".to_string()
                    };
                    log_diag(&msg);
                    let _ = win_for_url.eval(format!(
                        "document.getElementById('status').textContent='Internal error: {}';document.getElementById('status').style.color='#ef4444';",
                        msg.replace('\'', "\\'").replace('\n', " ")
                    ));
                }
            });

            // ── System tray ───────────────────────────────────────
            let quit_i = MenuItemBuilder::new("Quit Visionox")
                .id("quit")
                .build(app)?;
            let show_i = MenuItemBuilder::new("Show Window")
                .id("show")
                .build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .item(&show_i)
                .separator()
                .item(&quit_i)
                .build()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .tooltip("Visionox")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            // P1-5: log failures
                            if let Err(e) = w.show() {
                                log_diag(&format!("show failed: {e}"));
                            }
                            if let Err(e) = w.set_focus() {
                                log_diag(&format!("set_focus failed: {e}"));
                            }
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let win = tray.app_handle().get_webview_window("main");
                        if let Some(w) = win {
                            if let Err(e) = w.show() {
                                log_diag(&format!("show failed: {e}"));
                            }
                            if let Err(e) = w.set_focus() {
                                log_diag(&format!("set_focus failed: {e}"));
                            }
                        }
                    }
                })
                .build(app)?;

            // ── Close → minimize to tray ─────────────────────────
            let app_handle_for_close = app.handle().clone();
            let app_handle_for_tray = app.handle().clone();
            main_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if let Some(w) = app_handle_for_close.get_webview_window("main") {
                        if let Err(e) = w.hide() {
                            log_diag(&format!("hide failed: {e}"));
                        }
                    }
                    if let Some(tray) = app_handle_for_tray.tray_by_id("main") {
                        let _ = tray.set_tooltip(Some(
                            "Visionox — 仍在运行中\n点击托盘图标恢复窗口，右键退出",
                        ));
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building tauri app")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                {
                    let state = app_handle.state::<Mutex<ServerState>>();
                    // P1-4: poison-safe lock
                    let mut guard = state.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(ref mut child) = guard.child {
                        log_diag("[tauri] shutting down server...");
                        let _ = child.kill();
                        // P1-1: wait with timeout, then force-kill
                        let deadline = Instant::now();
                        loop {
                            match child.try_wait() {
                                Ok(Some(status)) => {
                                    log_diag(&format!(
                                        "[tauri] server exited with {status:?}"
                                    ));
                                    break;
                                }
                                Ok(None) => {
                                    if deadline.elapsed() > Duration::from_secs(5) {
                                        log_diag("[tauri] server did not exit within 5s, forcing kill");
                                        let _ = child.kill();
                                        let _ = child.wait();
                                        break;
                                    }
                                    std::thread::sleep(Duration::from_millis(100));
                                }
                                Err(e) => {
                                    log_diag(&format!("[tauri] try_wait error: {e}"));
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::net::TcpListener;
    use std::thread;

    #[test]
    fn job_object_create() {
        let job = JobObject::new();
        assert!(job.is_ok(), "JobObject::new() should succeed");
    }

    #[test]
    fn job_object_assign_child_process() {
        let job = JobObject::new().expect("create job object");
        // Spawn a short-lived child to test assignment
        let child = Command::new("cmd.exe")
            .args(["/c", "exit", "0"])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .expect("spawn child");
        let pid = child.id();
        let result = job.assign(pid);
        assert!(result.is_ok(), "assign child pid should succeed");
        // Child will exit on its own; job handle close will clean up
    }

    #[test]
    fn check_health_rejects_non_200_status() {
        // Spin up a listener that returns a 404
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().unwrap().port();

        thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let _ = stream.write_all(
                    b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                );
            }
        });

        assert!(!check_health(port, "test-token"));
    }

    #[test]
    fn check_health_accepts_200() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().unwrap().port();
        let token = "test-token-12345";

        thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                // Real server response: token is NOT in the body
                let body = "{\"version\":\"260530\",\"status\":\"ok\"}";
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes());
            }
        });

        assert!(check_health(port, token));
    }

    #[test]
    fn check_health_connection_refused() {
        // Use a dynamic port to avoid collisions with real listeners
        let port = TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();
        assert!(!check_health(port, "test-token"));
    }
}
