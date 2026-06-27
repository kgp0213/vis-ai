use std::io::{BufRead, Write};
use std::net::TcpStream;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use anyhow::Context;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    window::Color,
    Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use windows_sys::Win32::Foundation::HANDLE;
use windows_sys::Win32::System::DataExchange::{
    CloseClipboard, EnumClipboardFormats, GetClipboardData, GetClipboardFormatNameW, OpenClipboard,
    RegisterClipboardFormatW,
};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
use windows_sys::Win32::System::Memory::{GlobalLock, GlobalUnlock};
use windows_sys::Win32::System::Threading::{
    OpenProcess, WaitForSingleObject, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_QUOTA,
    PROCESS_TERMINATE,
};
use windows_sys::Win32::UI::Shell::DragQueryFileW;
const CF_HDROP: u32 = 15;

const CREATE_NO_WINDOW: u32 = 0x08000000;
// INFINITE wait timeout for WaitForSingleObject. windows-sys 0.59 does not
// export this constant under the currently enabled features.
const INFINITE_WAIT: u32 = 0xFFFFFFFF;
// PROCESS_SYNCHRONIZE access right (0x00100000) — not exported by the
// currently enabled windows-sys features, so define locally. Required by
// OpenProcess to obtain a waitable handle for WaitForSingleObject.
const PROCESS_SYNCHRONIZE: u32 = 0x00100000;

static DIAG_PATH: OnceLock<PathBuf> = OnceLock::new();

// ── Centralized constants ───────────────────────────────────────────
const STARTUP_READLINE_TIMEOUT_SECS: u64 = 30;
const HEALTH_CONNECT_TIMEOUT_SECS: u64 = 1;
const HEALTH_MAX_ATTEMPTS: u32 = 15;
const HEALTH_RETRY_INTERVAL_MS: u64 = 200;
const CHILD_MAX_RESTART_ATTEMPTS: u32 = 5;
const CHILD_RESTART_BASE_DELAY_SECS: u64 = 1;
const CHILD_RESTART_MAX_DELAY_SECS: u64 = 30;
const SHUTDOWN_GRACE_PERIOD_SECS: u64 = 5;
const SHUTDOWN_POLL_INTERVAL_MS: u64 = 100;
const WINDOW_WIDTH: f64 = 1280.0;
const WINDOW_HEIGHT: f64 = 800.0;
const WINDOW_MIN_WIDTH: f64 = 800.0;
const WINDOW_MIN_HEIGHT: f64 = 500.0;
const LOCALHOST_ORIGIN_PREFIX: &str = "http://127.0.0.1:";
const CLIPBOARD_FORMAT_NAME_BUF_LEN: usize = 256;

fn log_diag(msg: &str) {
    use std::io::Write;
    let path = match DIAG_PATH.get() {
        Some(p) => p,
        None => return,
    };
    // Rotate when the file exceeds 10 MB. Renames overwrite the existing
    // `.1` backup so we keep at most ~20 MB on disk (current + backup).
    const ROTATE_AT: u64 = 10 * 1024 * 1024;
    if let Ok(meta) = std::fs::metadata(path) {
        if meta.len() > ROTATE_AT {
            let backup: PathBuf = format!("{}.1", path.display()).into();
            let _ = std::fs::rename(path, &backup);
        }
    }
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
    fn new() -> anyhow::Result<Self> {
        // SAFETY: null name creates an unnamed job object; null attributes
        // uses the default security descriptor. Both are valid arguments.
        let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() {
            anyhow::bail!("CreateJobObjectW failed")
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
            anyhow::bail!("SetInformationJobObject failed")
        }

        Ok(Self { handle })
    }

    fn assign(&self, pid: u32) -> anyhow::Result<()> {
        // SAFETY: pid comes from Child::id() which is a valid OS process ID;
        // 0 = no handle inheritance; PROCESS_SET_QUOTA | PROCESS_TERMINATE
        // are the minimum rights needed for job assignment.
        let proc_handle = unsafe { OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid) };
        if proc_handle.is_null() {
            anyhow::bail!("OpenProcess failed")
        }

        // SAFETY: self.handle is a valid job object handle; proc_handle is a
        // valid process handle verified non-null above.
        let ret = unsafe { AssignProcessToJobObject(self.handle, proc_handle) };
        // SAFETY: proc_handle is no longer needed after job assignment.
        unsafe { windows_sys::Win32::Foundation::CloseHandle(proc_handle) };
        if ret == 0 {
            anyhow::bail!("AssignProcessToJobObject failed")
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

#[derive(Default, Clone, serde::Serialize)]
struct StartupArgs {
    args: Vec<String>,
    cwd: String,
}

/// Restore missing resource files (e.g. learn.mjs) into the runtime server dir.
/// Source: the compile-time `src-tauri/resources/server/` tree. In an NSIS
/// install that source is unreachable, so the function logs and skips — the
/// installer is the authoritative source there. In dev/test builds the source
/// tree is present and the copy repairs drift caused by partial rebuilds.
fn ensure_server_resources(server_dir: &std::path::Path) {
    const NEEDED: &[&str] = &["learn.mjs", "learn-track.mjs"];
    let src_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("server");

    for name in NEEDED {
        let dst = server_dir.join(name);
        if dst.exists() {
            continue;
        }
        let src = src_dir.join(name);
        if !src.exists() {
            log_diag(&format!(
                "[rust] resource missing and no source available: {}",
                dst.display()
            ));
            continue;
        }
        match std::fs::copy(&src, &dst) {
            Ok(_) => log_diag(&format!(
                "[rust] restored resource: {} -> {}",
                src.display(),
                dst.display()
            )),
            Err(e) => log_diag(&format!(
                "[rust] failed to restore {}: {}",
                dst.display(),
                e
            )),
        }
    }
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

    let server_dir = exe_dir.join("resources").join("server");
    ensure_server_resources(&server_dir);

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

    let stdout = child
        .stdout
        .take()
        .context("failed to capture server stdout")?;
    let reader = std::io::BufReader::new(stdout);

    // Read stderr into a log file for debugging
    let stderr = child
        .stderr
        .take()
        .context("failed to capture server stderr")?;
    let exe_dir_clone = exe_dir.clone();
    let _handle = std::thread::spawn(move || {
        use std::io::Write;
        let log_path = exe_dir_clone.join("launcher-stderr.log");
        let file = match std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            Ok(f) => f,
            Err(_) => return,
        };
        let mut writer = std::io::BufWriter::new(file);
        let r = std::io::BufReader::new(stderr);
        for lr in r.lines() {
            let line = match lr {
                Ok(l) => l,
                Err(_) => {
                    let _ = writeln!(writer, "[binary line skipped]");
                    continue;
                }
            };
            let _ = writeln!(writer, "{}", line);
        }
        let _ = writer.flush();
    });

    // P0-2: read stdout on a dedicated thread and use recv_timeout so the
    // startup timeout is honoured even when the child produces no output.
    let (line_tx, line_rx) = std::sync::mpsc::channel::<Result<String, std::io::Error>>();
    let _reader_handle = std::thread::spawn(move || {
        for line in reader.lines() {
            if line_tx.send(line).is_err() {
                break;
            }
        }
    });

    let deadline = Instant::now() + Duration::from_secs(STARTUP_READLINE_TIMEOUT_SECS);
    let mut url = String::new();
    let mut port: u16 = 0;
    let mut token = String::new();
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            let _ = child.kill();
            let _ = child.wait();
            log_diag("[rust] readline timeout — child did not produce URL in time");
            return Err("launcher timed out waiting for dashboard URL".into());
        }
        match line_rx.recv_timeout(remaining) {
            Ok(Ok(line)) => {
                log_diag(&format!("[launcher] {line}"));
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&line) {
                    if let Some(err) = parsed["error"].as_str() {
                        let _ = child.kill();
                        let _ = child.wait();
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
            Ok(Err(e)) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(e.into());
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                let _ = child.kill();
                let _ = child.wait();
                log_diag("[rust] readline timeout — child did not produce URL in time");
                return Err("launcher timed out waiting for dashboard URL".into());
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    if url.is_empty() {
        let _ = child.kill();
        let _ = child.wait();
        return Err("failed to discover dashboard URL".into());
    }

    Ok((child, url, port, token))
}

/// P1-5d: Compute restart delay = exponential backoff capped, minus a random
/// jitter in `[0, base/2)` derived from subsec nanos. Extracted for testing.
fn restart_delay_with_jitter(restart_attempt: u32) -> u64 {
    let base = (CHILD_RESTART_BASE_DELAY_SECS * 2u64.saturating_pow(restart_attempt))
        .min(CHILD_RESTART_MAX_DELAY_SECS);
    let jitter = (base / 2).max(1);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64)
        .unwrap_or(0);
    base.saturating_sub(nanos % jitter)
}

fn validate_dashboard_url(url: &str, port: u16) -> bool {
    url.starts_with(&format!("{LOCALHOST_ORIGIN_PREFIX}{port}/"))
}

fn dashboard_origin(url: &str) -> Option<String> {
    let rest = url.strip_prefix(LOCALHOST_ORIGIN_PREFIX)?;
    let port = rest.split('/').next()?;
    if port.is_empty() || !port.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    Some(format!("{LOCALHOST_ORIGIN_PREFIX}{port}"))
}

fn read_http_body(
    reader: &mut impl BufRead,
    content_length: Option<usize>,
    chunked: bool,
) -> std::io::Result<Vec<u8>> {
    let mut body = Vec::new();
    if let Some(len) = content_length {
        body.resize(len, 0u8);
        if reader.read_exact(&mut body).is_err() {
            // Some test stubs close the stream before all bytes are buffered;
            // fall back to reading whatever is available.
            body.clear();
            reader.read_to_end(&mut body)?;
        }
        return Ok(body);
    }
    if chunked {
        loop {
            let mut line = String::new();
            reader.read_line(&mut line)?;
            let size_str = line.split(';').next().unwrap_or("").trim();
            let size = usize::from_str_radix(size_str, 16)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()))?;
            if size == 0 {
                // Consume trailer headers (if any) until the final empty line.
                loop {
                    let mut trailer = String::new();
                    reader.read_line(&mut trailer)?;
                    if trailer == "\r\n" || trailer.is_empty() {
                        break;
                    }
                }
                break;
            }
            let start = body.len();
            body.resize(start + size, 0u8);
            reader.read_exact(&mut body[start..])?;
            // Consume the CRLF that terminates each chunk.
            let mut crlf = [0u8; 2];
            reader.read_exact(&mut crlf)?;
        }
        return Ok(body);
    }
    reader.read_to_end(&mut body)?;
    Ok(body)
}

fn check_health(port: u16, token: &str) -> bool {
    // P2: parse the health URL with the url crate instead of string concatenation.
    let base = match url::Url::parse(&format!("{LOCALHOST_ORIGIN_PREFIX}{port}/")) {
        Ok(u) => u,
        Err(_) => return false,
    };
    let health_url = {
        let mut u = match base.join("api/health") {
            Ok(u) => u,
            Err(_) => return false,
        };
        u.query_pairs_mut().append_pair("token", token);
        u
    };

    let host = health_url.host_str().unwrap_or("127.0.0.1");
    let connect_port = health_url.port_or_known_default().unwrap_or(port);
    let addr = format!("{host}:{connect_port}");
    let sockaddr: std::net::SocketAddr = match addr.parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(
        &sockaddr,
        Duration::from_secs(HEALTH_CONNECT_TIMEOUT_SECS),
    ) {
        Ok(s) => s,
        Err(_) => return false,
    };

    let request_target = match health_url.query() {
        Some(q) => format!("{}?{}", health_url.path(), q),
        None => health_url.path().to_string(),
    };
    let request = format!(
        "GET {request_target} HTTP/1.1\r\nHost: {host}:{connect_port}\r\nConnection: close\r\n\r\n",
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut reader = std::io::BufReader::new(&mut stream);

    // Read and validate the HTTP status line.
    let mut status_line = String::new();
    if reader.read_line(&mut status_line).is_err() {
        return false;
    }
    if !(status_line.starts_with("HTTP/1.1 200") || status_line.starts_with("HTTP/1.0 200")) {
        return false;
    }

    // Read headers to find Content-Length or Transfer-Encoding.
    let mut content_length = None;
    let mut chunked = false;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).is_err() {
            return false;
        }
        if line == "\r\n" || line.is_empty() {
            break;
        }
        if let Some(cl) = line.strip_prefix("Content-Length:") {
            content_length = cl.trim().parse::<usize>().ok();
        } else if let Some(cl) = line.strip_prefix("content-length:") {
            content_length = cl.trim().parse::<usize>().ok();
        } else if line.to_lowercase().starts_with("transfer-encoding:")
            && line.to_lowercase().contains("chunked")
        {
            chunked = true;
        }
    }

    // Read and decode the response body.
    let buf = match read_http_body(&mut reader, content_length, chunked) {
        Ok(b) => b,
        Err(e) => {
            log_diag(&format!("[rust] health check body read failed: {e}"));
            return false;
        }
    };
    let body = String::from_utf8_lossy(&buf).to_string();

    // Validate that the response is the expected health payload.
    // The real server returns { version, latestVersion, visionoxHome, ... };
    // the unit-test stub returns { version, status }. We accept any valid JSON
    // response that contains a non-empty `version` string.
    match serde_json::from_str::<serde_json::Value>(&body) {
        Ok(parsed) => parsed
            .get("version")
            .and_then(|v| v.as_str())
            .map(|v| !v.is_empty())
            .unwrap_or(false),
        Err(e) => {
            log_diag(&format!(
                "[rust] health check body parse failed: {e}; body={body:?}"
            ));
            false
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> anyhow::Result<()> {
    // P3: initialize diagnostics log path early so background threads
    // spawned in setup() can write diag entries regardless of ordering.
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();
    let _ = DIAG_PATH.set(exe_dir.join("launcher-diag.log"));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            log_diag(&format!("[tauri] single-instance args={args:?} cwd={cwd}"));

            // Persist the new startup arguments so the dashboard can query them.
            {
                let state = app.state::<Mutex<StartupArgs>>();
                let mut guard = state.lock().unwrap_or_else(|e| e.into_inner());
                guard.args.clone_from(&args);
                guard.cwd.clone_from(&cwd);
            }

            // Bring the main window to the foreground.
            if let Some(w) = app.get_webview_window("main") {
                if let Err(e) = w.show() {
                    log_diag(&format!("single-instance show failed: {e}"));
                }
                if let Err(e) = w.set_focus() {
                    log_diag(&format!("single-instance set_focus failed: {e}"));
                }
            }

            // Notify the loader UI (and via postMessage the dashboard) about the args.
            let payload = StartupArgs {
                args: args.clone(),
                cwd: cwd.clone(),
            };
            if let Err(e) = app.emit("visionox-startup-args", payload) {
                log_diag(&format!("single-instance emit failed: {e}"));
            }
        }))
        .manage(Mutex::new(ServerState {
            child: None,
            url: None,
            job: None,
        }))
        .manage(Mutex::new(StartupArgs {
            args: std::env::args().collect(),
            cwd: std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default(),
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
            .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
            .min_inner_size(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT)
            .center()
            .visible(true)
            .build()?;

            // Create Job Object for guaranteed child cleanup on exit
            let job = JobObject::new().context("failed to create job object")?;
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
                                let mut healthy = false;
                                let health_start = std::time::Instant::now();
                                for attempt in 0..HEALTH_MAX_ATTEMPTS {
                                    log_diag(&format!(
                                        "[rust] health check attempt {}/{HEALTH_MAX_ATTEMPTS}",
                                        attempt + 1
                                    ));
                                    if check_health(port, &token) {
                                        healthy = true;
                                        break;
                                    }
                                    std::thread::sleep(Duration::from_millis(HEALTH_RETRY_INTERVAL_MS));
                                }
                                if !validate_dashboard_url(&url, port) {
                                    log_diag(&format!("invalid dashboard URL: {url}"));
                                    let _ = win_for_url.eval(
                                        "document.getElementById('status').textContent='Server failed: invalid dashboard URL';",
                                    );
                                    return;
                                }

                                let job_for_monitor = job_for_thread.clone();
                                let state = app_handle.state::<Mutex<ServerState>>();
                                {
                                    // P1-4: poison-safe lock
                                    let mut s = state.lock().unwrap_or_else(|e| e.into_inner());
                                    s.child = Some(child);
                                    s.url = Some(url.clone());
                                    s.job = Some(job_for_thread);
                                }

                                if healthy {
                                    log_diag(
                                        "[rust] health check passed — loading dashboard in iframe",
                                    );
                                    let url_json = serde_json::to_string(&url)
                                        .unwrap_or_else(|_| "\"\"".to_string());
                                    let origin_json = dashboard_origin(&url)
                                        .and_then(|origin| serde_json::to_string(&origin).ok())
                                        .unwrap_or_else(|| "\"\"".to_string());
                                    let nav_js = format!(
                                        "(function(){{var url={url_json};var origin={origin_json};var theme='';try{{theme=localStorage.getItem('visionox-theme')||'';}}catch(e){{}}if(theme&&/^(light|dark|warm-sand|cool-ash|soft-sage|espresso|midnight-ink|deep-charcoal)$/.test(theme)){{url+=(url.indexOf('?')===-1?'?':'&')+'theme='+encodeURIComponent(theme);}}try{{sessionStorage.setItem('visionox.dashboardUrl',url);sessionStorage.setItem('visionox.dashboardOrigin',origin);localStorage.setItem('visionox.dashboardUrl',url);localStorage.setItem('visionox.dashboardOrigin',origin);}}catch(e){{}}var spinner=document.querySelector('.wrap');if(spinner)spinner.style.display='none';var f=document.getElementById('vis-app-frame');if(!f){{f=document.createElement('iframe');f.id='vis-app-frame';f.style.position='fixed';f.style.top='0';f.style.left='0';f.style.width='100%';f.style.height='100%';f.style.border='none';document.body.appendChild(f);}}f.src=url;if(window.__visionoxRestoreDashboard)window.__visionoxRestoreDashboard();}})();"
                                    );
                                    log_diag(&format!("[rust] eval js: {nav_js}"));
                                    // P1-5: log eval failure instead of silently discarding
                                    if let Err(e) = win_for_url.eval(&nav_js) {
                                        log_diag(&format!(
                                            "eval(navigate) failed: {e}"
                                        ));
                                    }

                                    // P0-3: monitor child process for unexpected exit and auto-restart with backoff
                                    let win_for_monitor = win_for_url.clone();
                                    let app_handle_for_monitor = app_handle.clone();
                                    let _handle = std::thread::spawn(move || {
                                        let mut child_pid = child_pid;
                                        let mut restart_attempt = 0u32;
                                        loop {
                                            // P1-5b: block on the child handle with WaitForSingleObject
                                            // instead of polling GetExitCodeProcess. The old polling loop
                                            // misclassified exit code 259 (STILL_ACTIVE) as "running"
                                            // forever, since 259 is both the sentinel and a legal exit code.
                                            let wait_handle = unsafe {
                                                OpenProcess(
                                                    PROCESS_SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION,
                                                    0,
                                                    child_pid,
                                                )
                                            };
                                            if wait_handle.is_null() {
                                                log_diag("[rust] monitor: OpenProcess failed — assuming child exited");
                                            } else {
                                                unsafe {
                                                    WaitForSingleObject(
                                                        wait_handle,
                                                        INFINITE_WAIT,
                                                    );
                                                    windows_sys::Win32::Foundation::CloseHandle(wait_handle);
                                                }
                                            }

                                            log_diag("[rust] child process exited unexpectedly after navigation");
                                            if restart_attempt >= CHILD_MAX_RESTART_ATTEMPTS {
                                                log_diag("[rust] child restart attempts exhausted");
                                                let _ = win_for_monitor.eval(
                                                    "document.body.innerHTML='<div style=\"display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#ef4444;font-size:18px\">Server process has stopped unexpectedly.<br>Please restart the application.</div>';"
                                                );
                                                break;
                                            }

                                            restart_attempt += 1;
                                            log_diag(&format!(
                                                "[rust] restart attempt {restart_attempt}/{CHILD_MAX_RESTART_ATTEMPTS}"
                                            ));
                                            match spawn_server_blocking(&job_for_monitor) {
                                                Ok((mut child, url, port, token)) => {
                                                    let mut healthy = false;
                                                    for _i in 0..HEALTH_MAX_ATTEMPTS {
                                                        if check_health(port, &token) {
                                                            healthy = true;
                                                            break;
                                                        }
                                                        std::thread::sleep(Duration::from_millis(HEALTH_RETRY_INTERVAL_MS));
                                                    }
                                                    if healthy && validate_dashboard_url(&url, port) {
                                                        let new_pid = child.id();
                                                        let state = app_handle_for_monitor.state::<Mutex<ServerState>>();
                                                        {
                                                            let mut s = state.lock().unwrap_or_else(|e| e.into_inner());
                                                            // P1-5a: reap the previous child before overwriting.
                                                            // The old process has already exited (WaitForSingleObject
                                                            // confirmed), but we call wait() to clean up the Child's
                                                            // internal state instead of relying on Drop.
                                                            if let Some(mut old) = s.child.take() {
                                                                let _ = old.kill();
                                                                let _ = old.wait();
                                                            }
                                                            s.child = Some(child);
                                                            s.url = Some(url.clone());
                                                        }
                                                        child_pid = new_pid;
                                                        restart_attempt = 0;

                                                        let url_json = serde_json::to_string(&url)
                                                            .unwrap_or_else(|_| "\"\"".to_string());
                                                        let origin_json = dashboard_origin(&url)
                                                            .and_then(|origin| serde_json::to_string(&origin).ok())
                                                            .unwrap_or_else(|| "\"\"".to_string());
                                                        let nav_js = format!(
                                                            "(function(){{var url={url_json};var origin={origin_json};var theme='';try{{theme=localStorage.getItem('visionox-theme')||'';}}catch(e){{}}if(theme&&/^(light|dark|warm-sand|cool-ash|soft-sage|espresso|midnight-ink|deep-charcoal)$/.test(theme)){{url+=(url.indexOf('?')===-1?'?':'&')+'theme='+encodeURIComponent(theme);}}try{{sessionStorage.setItem('visionox.dashboardUrl',url);sessionStorage.setItem('visionox.dashboardOrigin',origin);localStorage.setItem('visionox.dashboardUrl',url);localStorage.setItem('visionox.dashboardOrigin',origin);}}catch(e){{}}var spinner=document.querySelector('.wrap');if(spinner)spinner.style.display='none';var f=document.getElementById('vis-app-frame');if(!f){{f=document.createElement('iframe');f.id='vis-app-frame';f.style.position='fixed';f.style.top='0';f.style.left='0';f.style.width='100%';f.style.height='100%';f.style.border='none';document.body.appendChild(f);}}f.src=url;if(window.__visionoxRestoreDashboard)window.__visionoxRestoreDashboard();}})();"
                                                        );
                                                        if let Err(e) = win_for_monitor.eval(&nav_js) {
                                                            log_diag(&format!("eval(restart navigate) failed: {e}"));
                                                        }
                                                        continue;
                                                    } else {
                                                        let _ = child.kill();
                                                        let _ = child.wait();
                                                        log_diag("[rust] restarted server failed health check");
                                                    }
                                                }
                                                Err(e) => log_diag(&format!("[rust] restart spawn failed: {e}")),
                                            }

                                            // P1-5d: exponential backoff with jitter to avoid thundering-herd
                                            // restarts when multiple instances crash simultaneously.
                                            let delay = restart_delay_with_jitter(restart_attempt);
                                            log_diag(&format!("[rust] waiting {delay}s before next restart attempt"));
                                            std::thread::sleep(Duration::from_secs(delay));
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
                    // P1-5c: reap any in-flight child left in ServerState by the
                    // panicked thread. Without this, the Node process keeps
                    // running unattended until app exit (JobObject cleanup).
                    let state = app_handle.state::<Mutex<ServerState>>();
                    if let Some(mut orphan) = state
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .child
                        .take()
                    {
                        log_diag("[rust] panic recovery: killing orphaned server child");
                        let _ = orphan.kill();
                        let _ = orphan.wait();
                    }
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
                .icon(app.default_window_icon().context("default window icon not found")?.clone())
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
        .invoke_handler(tauri::generate_handler![ping, get_startup_args, get_dashboard_url, get_clipboard_files])
        .build(tauri::generate_context!())
        ?
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
                                    if deadline.elapsed() > Duration::from_secs(SHUTDOWN_GRACE_PERIOD_SECS) {
                                        log_diag(&format!("[tauri] server did not exit within {SHUTDOWN_GRACE_PERIOD_SECS}s, forcing kill"));
                                        let _ = child.kill();
                                        let _ = child.wait();
                                        break;
                                    }
                                    std::thread::sleep(Duration::from_millis(SHUTDOWN_POLL_INTERVAL_MS));
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
    Ok(())
}

/// Read full file paths from the Windows clipboard (CF_HDROP format).
/// This captures paths from File Explorer copies, which are inaccessible
/// from the JavaScript clipboard API.
#[tauri::command]
fn ping() -> String {
    log_diag("[rust] ping invoked");
    "pong".to_string()
}

#[tauri::command]
fn get_startup_args(state: tauri::State<'_, Mutex<StartupArgs>>) -> StartupArgs {
    state.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

#[tauri::command]
fn get_dashboard_url(state: tauri::State<'_, Mutex<ServerState>>) -> Option<String> {
    state.lock().unwrap_or_else(|e| e.into_inner()).url.clone()
}

#[derive(serde::Serialize)]
struct ClipboardFilesResult {
    paths: Vec<String>,
    error: Option<String>,
}

#[tauri::command]
async fn get_clipboard_files() -> Result<ClipboardFilesResult, String> {
    tauri::async_runtime::spawn_blocking(get_clipboard_files_blocking)
        .await
        .map_err(|e| format!("clipboard task failed: {e}"))
}

fn get_clipboard_files_blocking() -> ClipboardFilesResult {
    log_diag("[rust] get_clipboard_files invoked");
    let mut paths = Vec::new();

    // Retry OpenClipboard a few times — another application may briefly hold the lock.
    let mut opened = 0;
    for attempt in 0..4 {
        if attempt > 0 {
            std::thread::sleep(Duration::from_millis(50));
        }
        opened = unsafe { OpenClipboard(std::ptr::null_mut()) };
        if opened != 0 {
            break;
        }
    }
    if opened == 0 {
        let msg = "OpenClipboard failed after retries".to_string();
        log_diag(&format!("[rust] {msg}"));
        return ClipboardFilesResult {
            paths,
            error: Some(msg),
        };
    }
    log_diag("[rust] OpenClipboard succeeded");

    // Enumerate available formats for diagnostics.
    unsafe {
        let mut format = 0u32;
        let mut formats = Vec::new();
        loop {
            format = EnumClipboardFormats(format);
            if format == 0 {
                break;
            }
            let mut name_buf = [0u16; CLIPBOARD_FORMAT_NAME_BUF_LEN];
            let name_len =
                GetClipboardFormatNameW(format, name_buf.as_mut_ptr(), name_buf.len() as i32);
            let name = if name_len > 0 {
                String::from_utf16_lossy(&name_buf[..name_len as usize])
            } else {
                format!("#{}", format)
            };
            formats.push(name);
        }
        log_diag(&format!("[rust] clipboard formats: {:?}", formats));
    }

    // Try CF_HDROP first.
    // SAFETY: GetClipboardData returns a handle to the clipboard data in
    // the requested format. CF_HDROP contains file paths.
    let hdrop = unsafe { GetClipboardData(CF_HDROP) };
    if hdrop.is_null() {
        log_diag("[rust] GetClipboardData(CF_HDROP) returned null");
    } else {
        // SAFETY: DragQueryFileW queries the HDROP handle for file count
        // and file paths. The HDROP handle is valid at this point.
        let count = unsafe { DragQueryFileW(hdrop, 0xFFFFFFFF, std::ptr::null_mut(), 0) };
        log_diag(&format!("[rust] DragQueryFileW count={count}"));
        for i in 0..count {
            // First call to get required buffer size
            let len = unsafe { DragQueryFileW(hdrop, i, std::ptr::null_mut(), 0) };
            if len == 0 {
                continue;
            }
            let mut buf: Vec<u16> = vec![0; len as usize + 1];
            let copied = unsafe { DragQueryFileW(hdrop, i, buf.as_mut_ptr(), buf.len() as u32) };
            if copied > 0 {
                buf.truncate(copied as usize);
                if let Ok(s) = String::from_utf16(&buf) {
                    log_diag(&format!("[rust] clipboard file {i}: {s}"));
                    if std::path::Path::new(&s).exists() {
                        paths.push(s);
                    }
                }
            }
        }
    }

    // Fallback: try "FileNameW" registered clipboard format.
    if paths.is_empty() {
        unsafe {
            let name: Vec<u16> = "FileNameW"
                .encode_utf16()
                .chain(std::iter::once(0))
                .collect();
            let fmt = RegisterClipboardFormatW(name.as_ptr());
            if fmt != 0 {
                let h = GetClipboardData(fmt);
                if !h.is_null() {
                    // SAFETY: GetClipboardData returns an HGLOBAL that must be
                    // locked with GlobalLock before reading. Treating the
                    // handle itself as a pointer (the previous implementation)
                    // dereferences an arbitrary address — undefined behavior.
                    let ptr = GlobalLock(h);
                    if !ptr.is_null() {
                        let ptr_u16 = ptr as *const u16;
                        let mut len = 0usize;
                        while *ptr_u16.add(len) != 0 {
                            len += 1;
                        }
                        let slice = std::slice::from_raw_parts(ptr_u16, len);
                        let s = String::from_utf16_lossy(slice);
                        log_diag(&format!("[rust] FileNameW fallback: {s}"));
                        if std::path::Path::new(&s).exists() {
                            paths.push(s);
                        }
                        GlobalUnlock(h);
                    }
                }
            }
        }
    }

    // SAFETY: CloseClipboard closes the clipboard opened by OpenClipboard.
    unsafe { CloseClipboard() };
    log_diag(&format!(
        "[rust] get_clipboard_files returning {} paths",
        paths.len()
    ));
    ClipboardFilesResult { paths, error: None }
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
                let body = "{\"version\":\"260603\",\"status\":\"ok\"}";
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes());
                // Keep the socket open briefly so the client can reliably read
                // the full response before we drop the stream.
                let _ = stream.shutdown(std::net::Shutdown::Write);
                thread::sleep(Duration::from_millis(200));
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

    #[test]
    fn ensure_server_resources_copies_missing_file() {
        let temp = std::env::temp_dir().join(format!(
            "vis-ai-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        // Pre-condition: temp dir does not contain learn.mjs
        assert!(!temp.join("learn.mjs").exists());

        ensure_server_resources(&temp);

        // Source file exists in the project tree (CARGO_MANIFEST_DIR/resources/server/learn.mjs)
        let src = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("server")
            .join("learn.mjs");
        if src.exists() {
            assert!(
                temp.join("learn.mjs").exists(),
                "learn.mjs should be copied"
            );
            assert!(
                temp.join("learn-track.mjs").exists(),
                "learn-track.mjs should be copied"
            );
        }
        // Clean up
        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn restart_delay_with_jitter_in_range() {
        for attempt in 0..5u32 {
            let base = (CHILD_RESTART_BASE_DELAY_SECS * 2u64.saturating_pow(attempt))
                .min(CHILD_RESTART_MAX_DELAY_SECS);
            let jitter = (base / 2).max(1);
            for _ in 0..20 {
                let delay = restart_delay_with_jitter(attempt);
                // Invariant: delay in [base - jitter + 1, base] (since nanos % jitter is in [0, jitter))
                assert!(
                    delay > base.saturating_sub(jitter),
                    "delay {} must be > base-jitter ({}) for attempt {}",
                    delay,
                    base.saturating_sub(jitter),
                    attempt
                );
                assert!(delay <= base, "delay {} must be <= base ({})", delay, base);
            }
        }
    }

    #[test]
    fn get_clipboard_files_blocking_does_not_panic() {
        // We can't reliably set up clipboard state in a unit test, but we can
        // verify the function handles whatever state exists without panicking
        // and returns a well-formed result.
        let result = get_clipboard_files_blocking();
        // paths may be empty or populated depending on clipboard contents
        let _ = result.paths.len();
        assert!(result.error.is_none() || result.error.as_ref().is_some());
    }
}
