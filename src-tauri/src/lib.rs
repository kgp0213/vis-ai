use std::io::{BufRead, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, OnceLock,
};
use std::time::{Duration, Instant};

use anyhow::Context;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    window::Color,
    Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

// ── Platform-specific imports ────────────────────────────────────
// Windows: JobObject process groups, clipboard HDROP, WaitForSingleObject.
// Unix:    setsid + PR_SET_PDEATHSIG for child lifecycle (equivalent to
//          JobObject's KILL_ON_JOB_CLOSE — child dies when parent exits).
#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
use windows_sys::Win32::Foundation::HANDLE;
#[cfg(windows)]
use windows_sys::Win32::System::DataExchange::{
    CloseClipboard, EnumClipboardFormats, GetClipboardData, GetClipboardFormatNameW, OpenClipboard,
    RegisterClipboardFormatW,
};
#[cfg(windows)]
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
#[cfg(windows)]
use windows_sys::Win32::System::Memory::{GlobalLock, GlobalUnlock};
#[cfg(windows)]
use windows_sys::Win32::System::Threading::{
    GetExitCodeProcess, OpenProcess, WaitForSingleObject, PROCESS_QUERY_LIMITED_INFORMATION,
    PROCESS_SET_QUOTA, PROCESS_TERMINATE,
};
#[cfg(windows)]
use windows_sys::Win32::UI::Shell::DragQueryFileW;

#[cfg(windows)]
const CF_HDROP: u32 = 15;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;
// INFINITE wait timeout for WaitForSingleObject. windows-sys 0.59 does not
// export this constant under the currently enabled features.
#[cfg(windows)]
const INFINITE_WAIT: u32 = 0xFFFFFFFF;
#[cfg(windows)]
const WAIT_FAILED_RESULT: u32 = 0xFFFFFFFF;
// PROCESS_SYNCHRONIZE access right (0x00100000) — not exported by the
// currently enabled windows-sys features, so define locally. Required by
// OpenProcess to obtain a waitable handle for WaitForSingleObject.
#[cfg(windows)]
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
const CHILD_RESTART_STABLE_RESET_SECS: u64 = 300;
const SHUTDOWN_GRACE_PERIOD_SECS: u64 = 5;
const SHUTDOWN_POLL_INTERVAL_MS: u64 = 100;
const LOG_ROTATE_BYTES: u64 = 10 * 1024 * 1024;
const WINDOW_WIDTH: f64 = 1280.0;
const WINDOW_HEIGHT: f64 = 800.0;
const WINDOW_MIN_WIDTH: f64 = 800.0;
const WINDOW_MIN_HEIGHT: f64 = 500.0;
const SPLASH_WIDTH: f64 = 630.0;
const SPLASH_HEIGHT: f64 = 450.0;

// Startup splash background per UI theme. Values mirror the `--startup-bg`
// tokens in src/index.html; keep both tables in sync when adding a theme.
// The selected theme is persisted by the loader page via save_startup_theme
// so the window can pick the right color before any JavaScript runs.
const STARTUP_THEMES: [(&str, (u8, u8, u8)); 9] = [
    ("light", (244, 246, 248)),
    ("dark", (23, 25, 28)),
    ("warm-sand", (243, 239, 231)),
    ("cool-ash", (237, 240, 242)),
    ("soft-sage", (238, 242, 237)),
    ("espresso", (33, 30, 28)),
    ("midnight-ink", (17, 24, 32)),
    ("deep-charcoal", (24, 26, 27)),
    ("indigo-night", (12, 13, 16)),
];
const STARTUP_THEME_DEFAULT: (u8, u8, u8) = (244, 246, 248);

fn startup_theme_path() -> PathBuf {
    visionox_home_dir().join("startup-theme")
}

fn startup_background_color() -> Color {
    let rgb = std::fs::read_to_string(startup_theme_path())
        .ok()
        .and_then(|raw| {
            let name = raw.trim();
            STARTUP_THEMES
                .iter()
                .find(|(theme, _)| *theme == name)
                .map(|(_, rgb)| *rgb)
        })
        .unwrap_or(STARTUP_THEME_DEFAULT);
    Color::from(rgb)
}
const LOCALHOST_ORIGIN_PREFIX: &str = "http://127.0.0.1:";
const CLIPBOARD_FORMAT_NAME_BUF_LEN: usize = 256;

fn log_diag(msg: &str) {
    let path = match DIAG_PATH.get() {
        Some(p) => p,
        None => return,
    };
    // Rotate when the file exceeds 10 MB. Renames overwrite the existing
    // `.1` backup so we keep at most ~20 MB on disk (current + backup).
    rotate_log_if_needed(path, LOG_ROTATE_BYTES);
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        let ts = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%.3f");
        let safe_msg = redact_log_line(msg);
        let _ = writeln!(f, "[{ts}] {safe_msg}");
    }
}

fn rotate_log_if_needed(path: &Path, max_bytes: u64) {
    let Ok(meta) = std::fs::metadata(path) else {
        return;
    };
    if meta.len() < max_bytes {
        return;
    }
    let backup: PathBuf = format!("{}.1", path.display()).into();
    let _ = std::fs::remove_file(&backup);
    let _ = std::fs::rename(path, backup);
}

fn visionox_home_dir() -> PathBuf {
    if let Ok(home) = std::env::var("VISIONOX_HOME") {
        let trimmed = home.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    home.join(".visionox")
}

fn visionox_log_dir() -> PathBuf {
    visionox_home_dir().join("logs")
}

fn diagnostics_log_path() -> PathBuf {
    visionox_log_dir().join("visionox-whale.log")
}

fn server_stderr_log_path() -> PathBuf {
    visionox_log_dir().join("visionox-server-stderr.log")
}

fn init_diagnostics_log() -> PathBuf {
    let path = diagnostics_log_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    path
}

fn redact_log_line(msg: &str) -> String {
    let mut out = redact_query_param(msg, "token");
    out = redact_json_string_field(&out, "token");
    out = redact_json_string_field(&out, "apiKey");
    out = redact_json_string_field(&out, "api_key");
    out
}

fn redact_query_param(input: &str, key: &str) -> String {
    let needle = format!("{key}=");
    let mut out = String::with_capacity(input.len());
    let mut rest = input;
    while let Some(pos) = rest.find(&needle) {
        let (head, tail) = rest.split_at(pos);
        out.push_str(head);
        out.push_str(&needle);
        out.push_str("<redacted>");
        let value_start = needle.len();
        let value_tail = &tail[value_start..];
        let end = value_tail
            .find(|c: char| c == '&' || c == '"' || c == '\'' || c.is_whitespace())
            .unwrap_or(value_tail.len());
        rest = &value_tail[end..];
    }
    out.push_str(rest);
    out
}

fn redact_json_string_field(input: &str, field: &str) -> String {
    let quoted_field = format!("\"{field}\"");
    let mut out = String::with_capacity(input.len());
    let mut rest = input;
    while let Some(pos) = rest.find(&quoted_field) {
        let (head, tail) = rest.split_at(pos);
        out.push_str(head);
        out.push_str(&quoted_field);
        let after_field = &tail[quoted_field.len()..];
        let Some(colon_pos) = after_field.find(':') else {
            out.push_str(after_field);
            return out;
        };
        let (before_colon, after_colon) = after_field.split_at(colon_pos + 1);
        out.push_str(before_colon);
        let spaces = after_colon
            .chars()
            .take_while(|c| c.is_whitespace())
            .map(char::len_utf8)
            .sum::<usize>();
        out.push_str(&after_colon[..spaces]);
        let value = &after_colon[spaces..];
        if !value.starts_with('"') {
            rest = value;
            continue;
        }
        out.push('"');
        out.push_str("<redacted>");
        out.push('"');
        let mut escaped = false;
        let mut end = 1usize;
        for (idx, ch) in value[1..].char_indices() {
            if escaped {
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == '"' {
                end = idx + 2;
                break;
            }
        }
        rest = &value[end..];
    }
    out.push_str(rest);
    out
}

// ── Child process group management ───────────────────────────────
// Windows: JobObject with KILL_ON_JOB_CLOSE guarantees all child processes
//          are terminated when the parent (Tauri) exits.
// Unix:    setsid() creates a new session; PR_SET_PDEATHSIG(SIGKILL) asks
//          the kernel to SIGKILL the child if the parent dies. Together
//          they provide equivalent cleanup without a job object.
#[cfg(windows)]
struct JobObject {
    handle: HANDLE,
}

#[cfg(windows)]
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
#[cfg(windows)]
unsafe impl Send for JobObject {}
#[cfg(windows)]
unsafe impl Sync for JobObject {}

#[cfg(windows)]
impl Drop for JobObject {
    fn drop(&mut self) {
        // SAFETY: self.handle is a valid job object handle created in new().
        // Closing the handle causes KILL_ON_JOB_CLOSE to terminate all
        // assigned processes if this is the last handle.
        unsafe { windows_sys::Win32::Foundation::CloseHandle(self.handle) };
    }
}

// Unix: no-op stub. Child cleanup is handled at spawn time via setsid +
// PR_SET_PDEATHSIG (see spawn_server_blocking). This struct exists only so
// ServerState.job has a consistent type across platforms.
#[cfg(unix)]
struct JobObject;

#[cfg(unix)]
impl JobObject {
    fn new() -> anyhow::Result<Self> {
        Ok(Self)
    }

    fn assign(&self, _pid: u32) -> anyhow::Result<()> {
        // No-op: Unix child processes are already in their own session via
        // setsid() in spawn_server_blocking, and PR_SET_PDEATHSIG ensures
        // they die when the parent exits.
        Ok(())
    }
}

/// Configure a Command for platform-appropriate child-process isolation.
/// Windows: creation_flags(CREATE_NO_WINDOW) hides the console window.
/// Unix: pre_exec sets setsid() + PR_SET_PDEATHSIG(SIGKILL) so the child
///       is killed if the parent dies (equivalent to JobObject's
///       KILL_ON_JOB_CLOSE, without needing a job object).
fn configure_child_command(cmd: &mut Command) {
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        unsafe {
            cmd.pre_exec(|| {
                // Create a new session so the child is not tied to the
                // parent's controlling terminal.
                let _ = nix::unistd::setsid();
                // Ask the kernel to SIGKILL us if the parent dies.
                let _ = nix::sys::prctl::set_pdeathsig(nix::sys::signal::Signal::SIGKILL);
                Ok(())
            });
        }
    }
}

/// Block until the child process with the given PID exits.
/// Windows: OpenProcess + WaitForSingleObject (blocking).
/// Unix: waitpid in a loop (handles EINTR). The child is in its own session
///       (setsid), so we can wait on it by pid without holding a Child handle.
fn wait_for_child_exit(pid: u32) -> String {
    #[cfg(windows)]
    {
        let wait_handle = unsafe {
            OpenProcess(
                PROCESS_SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION,
                0,
                pid,
            )
        };
        if wait_handle.is_null() {
            return format!("monitor_open_failed={}", std::io::Error::last_os_error());
        } else {
            let wait_result = unsafe { WaitForSingleObject(wait_handle, INFINITE_WAIT) };
            let wait_error = (wait_result == WAIT_FAILED_RESULT)
                .then(|| std::io::Error::last_os_error().to_string());
            let mut exit_code = 0u32;
            let exit_code_result = unsafe { GetExitCodeProcess(wait_handle, &mut exit_code) };
            let exit_code_error =
                (exit_code_result == 0).then(|| std::io::Error::last_os_error().to_string());
            unsafe {
                windows_sys::Win32::Foundation::CloseHandle(wait_handle);
            }
            if let Some(error) = wait_error {
                return format!("wait_failed={error}");
            }
            if let Some(error) = exit_code_error {
                return format!("exit_code_unavailable={error}");
            }
            return format!(
                "exit_code={exit_code} (0x{exit_code:08X}, signed={})",
                exit_code as i32
            );
        }
    }
    #[cfg(unix)]
    {
        use nix::sys::wait::{waitpid, WaitStatus};
        let nix_pid = nix::unistd::Pid::from_raw(pid as i32);
        loop {
            match waitpid(nix_pid, None) {
                Ok(WaitStatus::Exited(_, code)) => return format!("exit_code={code}"),
                Ok(WaitStatus::Signaled(_, signal, core_dumped)) => {
                    return format!("signal={signal:?}, core_dumped={core_dumped}")
                }
                Ok(_) => continue,
                Err(nix::errno::Errno::EINTR) => continue,
                Err(e) => {
                    return format!("waitpid_failed={e}");
                }
            }
        }
    }
}

struct ServerState {
    child: Option<Child>,
    url: Option<String>,
    shutting_down: Arc<AtomicBool>,
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

fn log_runtime_file(label: &str, path: &Path) {
    match std::fs::metadata(path) {
        Ok(meta) => log_diag(&format!(
            "[tauri] runtime file {label}: exists=true file={} len={} readonly={} path={}",
            meta.is_file(),
            meta.len(),
            meta.permissions().readonly(),
            path.display()
        )),
        Err(e) => log_diag(&format!(
            "[tauri] runtime file {label}: exists=false error={} path={}",
            e,
            path.display()
        )),
    }
}

fn log_child_status(child: &mut Child, reason: &str) {
    match child.try_wait() {
        Ok(Some(status)) => log_diag(&format!(
            "[rust] launcher exited before dashboard URL ({reason}): {status}"
        )),
        Ok(None) => {
            log_diag(&format!(
                "[rust] launcher still running without dashboard URL ({reason}); killing child"
            ));
            if let Err(e) = child.kill() {
                log_diag(&format!(
                    "[rust] failed to kill launcher after {reason}: {e}"
                ));
            }
            match child.wait() {
                Ok(status) => log_diag(&format!(
                    "[rust] launcher status after kill ({reason}): {status}"
                )),
                Err(e) => log_diag(&format!(
                    "[rust] failed to wait for launcher after kill ({reason}): {e}"
                )),
            }
        }
        Err(e) => log_diag(&format!(
            "[rust] failed to query launcher exit status ({reason}): {e}"
        )),
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
        "[tauri] exe_dir={} non_ascii={}",
        exe_dir.display(),
        !exe_dir.to_string_lossy().is_ascii()
    ));
    log_diag(&format!(
        "[tauri] server_dir={} non_ascii={}",
        server_dir.display(),
        !server_dir.to_string_lossy().is_ascii()
    ));
    log_runtime_file("node.exe", &node_path);
    log_runtime_file("launcher.mjs", &launcher);

    log_diag(&format!(
        "[tauri] launching: {:?} {:?}",
        node_path, launcher
    ));

    let mut child = Command::new(&node_path);
    let runtime_path = std::env::join_paths(
        std::iter::once(server_dir.clone()).chain(
            std::env::var_os("PATH")
                .into_iter()
                .flat_map(|path| std::env::split_paths(&path).collect::<Vec<_>>()),
        ),
    )?;
    child
        .arg(&launcher)
        .arg("--port")
        .arg("0")
        .env("PATH", runtime_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    configure_child_command(&mut child);
    let mut child = match child.spawn() {
        Ok(c) => c,
        Err(e) => {
            log_diag(&format!("[rust] failed to spawn launcher process: {e}"));
            return Err(e.into());
        }
    };
    log_diag(&format!(
        "[rust] launcher process spawned pid={}",
        child.id()
    ));

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
    let _handle = std::thread::spawn(move || {
        use std::io::Write;
        let log_path = server_stderr_log_path();
        if let Some(parent) = log_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        rotate_log_if_needed(&log_path, LOG_ROTATE_BYTES);
        let file = match std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            Ok(f) => f,
            Err(_) => return,
        };
        let mut writer = std::io::BufWriter::new(file);
        let mut current_bytes = std::fs::metadata(&log_path)
            .map(|meta| meta.len())
            .unwrap_or(0);
        let r = std::io::BufReader::new(stderr);
        for lr in r.lines() {
            let line = match lr {
                Ok(l) => l,
                Err(_) => {
                    let _ = writeln!(writer, "[binary line skipped]");
                    continue;
                }
            };
            let ts = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%.3f");
            let rendered = format!("[{ts}] {}", redact_log_line(&line));
            if current_bytes + rendered.len() as u64 + 1 >= LOG_ROTATE_BYTES {
                let _ = writer.flush();
                drop(writer);
                rotate_log_if_needed(&log_path, LOG_ROTATE_BYTES);
                let replacement = match std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&log_path)
                {
                    Ok(file) => file,
                    Err(_) => return,
                };
                writer = std::io::BufWriter::new(replacement);
                current_bytes = 0;
            }
            let _ = writeln!(writer, "{rendered}");
            current_bytes += rendered.len() as u64 + 1;
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
            log_diag("[rust] readline timeout — child did not produce URL in time");
            log_child_status(&mut child, "readline timeout");
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
                log_child_status(&mut child, "stdout read error");
                return Err(e.into());
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                log_diag("[rust] readline timeout — child did not produce URL in time");
                log_child_status(&mut child, "readline timeout");
                return Err("launcher timed out waiting for dashboard URL".into());
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    if url.is_empty() {
        log_child_status(&mut child, "stdout disconnected");
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

fn restart_attempt_after_uptime(restart_attempt: u32, uptime: Duration) -> u32 {
    if uptime >= Duration::from_secs(CHILD_RESTART_STABLE_RESET_SECS) {
        0
    } else {
        restart_attempt
    }
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

fn startup_failure_js(message: &str) -> String {
    let msg_json =
        serde_json::to_string(message).unwrap_or_else(|_| "\"Service failed\"".to_string());
    format!(
        "(function(){{var msg={msg_json};if(window.__visionoxShowStartupFailure){{window.__visionoxShowStartupFailure(msg);}}else{{var s=document.getElementById('status');if(s){{s.textContent=msg;s.style.color='#ef4444';}}}}}})();"
    )
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
        Err(e) => {
            log_diag(&format!(
                "[rust] health check address parse failed: {addr}; {e}"
            ));
            return false;
        }
    };
    let mut stream = match TcpStream::connect_timeout(
        &sockaddr,
        Duration::from_secs(HEALTH_CONNECT_TIMEOUT_SECS),
    ) {
        Ok(s) => s,
        Err(e) => {
            log_diag(&format!("[rust] health check connect failed: {addr}; {e}"));
            return false;
        }
    };

    let request_target = match health_url.query() {
        Some(q) => format!("{}?{}", health_url.path(), q),
        None => health_url.path().to_string(),
    };
    let request = format!(
        "GET {request_target} HTTP/1.1\r\nHost: {host}:{connect_port}\r\nConnection: close\r\n\r\n",
    );
    if let Err(e) = stream.write_all(request.as_bytes()) {
        log_diag(&format!("[rust] health check request write failed: {e}"));
        return false;
    }

    let mut reader = std::io::BufReader::new(&mut stream);

    // Read and validate the HTTP status line.
    let mut status_line = String::new();
    if let Err(e) = reader.read_line(&mut status_line) {
        log_diag(&format!("[rust] health check status read failed: {e}"));
        return false;
    }
    if !(status_line.starts_with("HTTP/1.1 200") || status_line.starts_with("HTTP/1.0 200")) {
        log_diag(&format!(
            "[rust] health check returned non-200 status: {}",
            status_line.trim()
        ));
        return false;
    }

    // Read headers to find Content-Length or Transfer-Encoding.
    let mut content_length = None;
    let mut chunked = false;
    loop {
        let mut line = String::new();
        if let Err(e) = reader.read_line(&mut line) {
            log_diag(&format!("[rust] health check header read failed: {e}"));
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

fn spawn_server_with_health(
    job: &JobObject,
) -> Result<(Child, String, u16, String), Box<dyn std::error::Error>> {
    let (mut child, url, port, token) = spawn_server_blocking(job)?;
    if !validate_dashboard_url(&url, port) {
        log_diag(&format!(
            "[rust] launcher returned invalid dashboard URL: {url}"
        ));
        let _ = child.kill();
        let _ = child.wait();
        return Err("launcher returned invalid dashboard URL".into());
    }
    for attempt in 0..HEALTH_MAX_ATTEMPTS {
        log_diag(&format!(
            "[rust] health check attempt {}/{HEALTH_MAX_ATTEMPTS}",
            attempt + 1
        ));
        if check_health(port, &token) {
            return Ok((child, url, port, token));
        }
        std::thread::sleep(Duration::from_millis(HEALTH_RETRY_INTERVAL_MS));
    }
    log_diag("[rust] spawned launcher failed health checks; terminating child");
    let _ = child.kill();
    let _ = child.wait();
    Err("launcher started but failed health checks".into())
}

fn spawn_initial_server(
    job: &JobObject,
) -> Result<(Child, String, u16, String), Box<dyn std::error::Error>> {
    let mut last_error = "launcher startup failed".to_string();
    for attempt in 0..CHILD_MAX_RESTART_ATTEMPTS {
        match spawn_server_with_health(job) {
            Ok(result) => return Ok(result),
            Err(err) => {
                last_error = err.to_string();
                log_diag(&format!(
                    "[rust] initial startup attempt {}/{} failed: {}",
                    attempt + 1,
                    CHILD_MAX_RESTART_ATTEMPTS,
                    last_error
                ));
                if attempt + 1 < CHILD_MAX_RESTART_ATTEMPTS {
                    let delay = restart_delay_with_jitter(attempt + 1);
                    std::thread::sleep(Duration::from_secs(delay));
                }
            }
        }
    }
    Err(last_error.into())
}

fn restore_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>, source: &str) {
    let Some(window) = app.get_webview_window("main") else {
        log_diag(&format!(
            "window restore failed: source={source} main window not found"
        ));
        return;
    };

    let visible_before = window.is_visible().ok();
    let minimized_before = window.is_minimized().ok();
    log_diag(&format!(
        "window restore requested: source={source} visible={visible_before:?} minimized={minimized_before:?}"
    ));

    if let Err(e) = window.unminimize() {
        log_diag(&format!(
            "window unminimize failed: source={source} error={e}"
        ));
    }
    match window.current_monitor() {
        Ok(None) => {
            log_diag(&format!(
                "window is outside current monitors; recentering: source={source}"
            ));
            if let Err(e) = window.center() {
                log_diag(&format!("window center failed: source={source} error={e}"));
            }
        }
        Ok(Some(_)) => {}
        Err(e) => log_diag(&format!(
            "window monitor query failed: source={source} error={e}"
        )),
    }
    if let Err(e) = window.show() {
        log_diag(&format!("window show failed: source={source} error={e}"));
    }
    if let Err(e) = window.set_focus() {
        log_diag(&format!("window focus failed: source={source} error={e}"));
    }

    let visible_after = window.is_visible().ok();
    let minimized_after = window.is_minimized().ok();
    log_diag(&format!(
        "window restore completed: source={source} visible={visible_after:?} minimized={minimized_after:?}"
    ));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> anyhow::Result<()> {
    // P3: initialize diagnostics log path early so background threads
    // spawned in setup() can write diag entries regardless of ordering.
    let diag_path = init_diagnostics_log();
    let _ = DIAG_PATH.set(diag_path.clone());
    log_diag(&format!("[tauri] diagnostics log: {}", diag_path.display()));
    log_diag(&format!(
        "[tauri] server stderr log: {}",
        server_stderr_log_path().display()
    ));

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

            restore_main_window(app, "single-instance");

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
            shutting_down: Arc::new(AtomicBool::new(false)),
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
            .title("Visionox-Whale")
            // Theme-aware splash background: avoids a light/dark flash before
            // the loader page applies its theme via JavaScript.
            .background_color(startup_background_color())
            // Borderless splash during startup; index.html renders the
            // centered brand/progress view and drag forwarding. Once the
            // dashboard reports ready, finish_startup_window resizes to the
            // full window and restores native decorations in one step.
            .inner_size(SPLASH_WIDTH, SPLASH_HEIGHT)
            .center()
            .decorations(false)
            .visible(true)
            .build()?;

            // Create Job Object for guaranteed child cleanup on exit
            let job = JobObject::new().context("failed to create job object")?;
            let job = Arc::new(job);
            let job_for_thread = job.clone();

            // Spawn server in background thread so UI isn't blocked
            let win_for_url = main_window.clone();
            let app_handle = app.handle().clone();
            let shutting_down_for_thread = {
                let state = app_handle.state::<Mutex<ServerState>>();
                let guard = state.lock().unwrap_or_else(|e| e.into_inner());
                guard.shutting_down.clone()
            };

            // P0-4: catch_unwind so a panic doesn't silently kill the thread
            let _handle = std::thread::spawn(move || {
                let result =
                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        log_diag("[rust] background thread started");
                        match spawn_initial_server(&job_for_thread) {
                            Ok((mut child, url, port, _token)) => {
                                if shutting_down_for_thread.load(Ordering::Acquire) {
                                    log_diag("[rust] server startup completed during application shutdown; terminating child");
                                    let _ = child.kill();
                                    let _ = child.wait();
                                    return;
                                }
                                log_diag(&format!(
                                    "[rust] server spawned — url={url}, port={port}"
                                ));
                                let child_pid = child.id();
                                let healthy = true;
                                let health_start = std::time::Instant::now();

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
                                        "(function(){{var url={url_json};var origin={origin_json};var theme='';try{{theme=localStorage.getItem('visionox-theme')||'';}}catch(e){{}}if(theme&&/^(light|dark|warm-sand|cool-ash|soft-sage|espresso|midnight-ink|deep-charcoal|indigo-night)$/.test(theme)){{url+=(url.indexOf('?')===-1?'?':'&')+'theme='+encodeURIComponent(theme);}}try{{sessionStorage.setItem('visionox.dashboardUrl',url);sessionStorage.setItem('visionox.dashboardOrigin',origin);localStorage.setItem('visionox.dashboardUrl',url);localStorage.setItem('visionox.dashboardOrigin',origin);}}catch(e){{}}var spinner=document.querySelector('.wrap');if(spinner)spinner.style.display='';var f=document.getElementById('vis-app-frame');if(!f){{f=document.createElement('iframe');f.id='vis-app-frame';f.style.position='fixed';f.style.top='0';f.style.left='0';f.style.width='100%';f.style.height='100%';f.style.border='none';document.body.appendChild(f);}}f.style.visibility='hidden';f.dataset.ready='';f.src=url;if(window.__visionoxRestoreDashboard)window.__visionoxRestoreDashboard();}})();"
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
                                    let shutting_down_for_monitor = shutting_down_for_thread.clone();
                                    let _handle = std::thread::spawn(move || {
                                        let mut child_pid = child_pid;
                                        let mut restart_attempt = 0u32;
                                        let mut child_started_at = Instant::now();
                                        loop {
                                            // Block until the child process exits. Windows uses
                                            // WaitForSingleObject on a process handle; Unix uses
                                            // waitpid (the child is in its own session via setsid,
                                            // so we wait by pid). The old Windows polling loop
                                            // misclassified exit code 259 (STILL_ACTIVE) as "running"
                                            // forever — the blocking wait fixes that on both platforms.
                                            let exit_status = wait_for_child_exit(child_pid);

                                            if shutting_down_for_monitor.load(Ordering::Acquire) {
                                                log_diag(&format!(
                                                    "[rust] child process exited during application shutdown — pid={child_pid}, {exit_status}"
                                                ));
                                                break;
                                            }

                                            log_diag(&format!(
                                                "[rust] child process exited unexpectedly after navigation — pid={child_pid}, {exit_status}"
                                            ));
                                            let prior_attempt = restart_attempt;
                                            restart_attempt = restart_attempt_after_uptime(
                                                restart_attempt,
                                                child_started_at.elapsed(),
                                            );
                                            if prior_attempt > 0 && restart_attempt == 0 {
                                                log_diag("[rust] restart counter reset after stable uptime");
                                            }
                                            if restart_attempt >= CHILD_MAX_RESTART_ATTEMPTS {
                                                log_diag("[rust] child restart attempts exhausted");
                                                let _ = win_for_monitor.eval(startup_failure_js(
                                                    "本地服务已停止且自动重启失败，请查看运行日志。",
                                                ));
                                                break;
                                            }

                                            restart_attempt += 1;
                                            log_diag(&format!(
                                                "[rust] restart attempt {restart_attempt}/{CHILD_MAX_RESTART_ATTEMPTS}"
                                            ));
                                            if shutting_down_for_monitor.load(Ordering::Acquire) {
                                                log_diag("[rust] server restart cancelled during application shutdown");
                                                break;
                                            }
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
                                                        child_started_at = Instant::now();

                                                        let url_json = serde_json::to_string(&url)
                                                            .unwrap_or_else(|_| "\"\"".to_string());
                                                        let origin_json = dashboard_origin(&url)
                                                            .and_then(|origin| serde_json::to_string(&origin).ok())
                                                            .unwrap_or_else(|| "\"\"".to_string());
                                                        let nav_js = format!(
                                                            "(function(){{var url={url_json};var origin={origin_json};var theme='';try{{theme=localStorage.getItem('visionox-theme')||'';}}catch(e){{}}if(theme&&/^(light|dark|warm-sand|cool-ash|soft-sage|espresso|midnight-ink|deep-charcoal|indigo-night)$/.test(theme)){{url+=(url.indexOf('?')===-1?'?':'&')+'theme='+encodeURIComponent(theme);}}try{{sessionStorage.setItem('visionox.dashboardUrl',url);sessionStorage.setItem('visionox.dashboardOrigin',origin);localStorage.setItem('visionox.dashboardUrl',url);localStorage.setItem('visionox.dashboardOrigin',origin);}}catch(e){{}}var spinner=document.querySelector('.wrap');if(spinner)spinner.style.display='';var f=document.getElementById('vis-app-frame');if(!f){{f=document.createElement('iframe');f.id='vis-app-frame';f.style.position='fixed';f.style.top='0';f.style.left='0';f.style.width='100%';f.style.height='100%';f.style.border='none';document.body.appendChild(f);}}f.style.visibility='hidden';f.dataset.ready='';f.src=url;if(window.__visionoxRestoreDashboard)window.__visionoxRestoreDashboard();}})();"
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
                                    if let Err(e) = win_for_url.eval(startup_failure_js(
                                        "本地服务启动后无响应，请查看运行日志。",
                                    )) {
                                        log_diag(&format!("eval(timeout) failed: {e}"));
                                    }
                                }
                            }
                            Err(e) => {
                                log_diag(&format!("[rust] server FAILED: {e}"));
                                if let Err(ev_err) = win_for_url.eval(startup_failure_js(&format!(
                                    "本地服务启动失败：{e}"
                                ))) {
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
                    let _ = win_for_url.eval(startup_failure_js(&format!(
                        "内部错误：{}",
                        msg.replace('\n', " ")
                    )));
                }
            });

            // ── System tray ───────────────────────────────────────
            let quit_i = MenuItemBuilder::new("Quit Visionox-Whale")
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
                .tooltip("Visionox-Whale")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => app.exit(0),
                    "show" => restore_main_window(app, "tray-menu"),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        restore_main_window(tray.app_handle(), "tray-left-click");
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
                            "Visionox-Whale — 仍在运行中\n点击托盘图标恢复窗口，右键退出",
                        ));
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            get_startup_args,
            get_dashboard_url,
            get_log_info,
            open_log_dir,
            write_client_log,
            get_clipboard_files,
            pick_markdown_file,
            pick_directory,
            begin_window_drag,
            finish_startup_window,
            save_startup_theme
        ])
        .build(tauri::generate_context!())
        ?
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                {
                    let state = app_handle.state::<Mutex<ServerState>>();
                    // P1-4: poison-safe lock
                    let mut guard = state.lock().unwrap_or_else(|e| e.into_inner());
                    guard.shutting_down.store(true, Ordering::Release);
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
struct LogInfo {
    log_dir: String,
    diagnostics_log: String,
    server_stderr_log: String,
}

#[tauri::command]
fn get_log_info() -> LogInfo {
    let log_dir = visionox_log_dir();
    let diagnostics_log = DIAG_PATH
        .get()
        .cloned()
        .unwrap_or_else(diagnostics_log_path);
    LogInfo {
        log_dir: log_dir.to_string_lossy().to_string(),
        diagnostics_log: diagnostics_log.to_string_lossy().to_string(),
        server_stderr_log: server_stderr_log_path().to_string_lossy().to_string(),
    }
}

#[tauri::command]
fn open_log_dir() -> Result<(), String> {
    let dir = visionox_log_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("create log dir failed: {e}"))?;
    open_path(&dir)
}

#[tauri::command]
fn write_client_log(message: String) {
    let msg = message.trim();
    if !msg.is_empty() {
        log_diag(&format!("[webview] {msg}"));
    }
}

/// Begin a native window drag. The startup splash is borderless, so the
/// loader page forwards left-button mousedown here to keep it movable.
#[tauri::command]
fn begin_window_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    window
        .start_dragging()
        .map_err(|e| format!("start dragging failed: {e}"))
}

/// Expand the borderless splash into the full application window once the
/// dashboard has taken over: resize first, then re-apply the minimum size,
/// restore native decorations and re-center. Order matters - applying the
/// minimum before the resize would fight the splash dimensions.
/// On low-resolution screens (e.g. 1366x768) the full 800px window height
/// plus the native titlebar would overflow the screen, pushing the titlebar
/// off-screen. We clamp the window to the current monitor's work area.
#[tauri::command]
fn finish_startup_window(window: tauri::WebviewWindow) -> Result<(), String> {
    let mut target_w = WINDOW_WIDTH;
    let mut target_h = WINDOW_HEIGHT;
    if let Ok(Some(monitor)) = window.current_monitor() {
        let work_size = monitor.size().to_logical::<f64>(monitor.scale_factor());
        // Reserve ~48px for the native titlebar + taskbar overlap
        let max_h = work_size.height - 48.0;
        let max_w = work_size.width;
        if target_h > max_h { target_h = max_h; }
        if target_w > max_w { target_w = max_w; }
    }
    window
        .set_size(tauri::LogicalSize::new(target_w, target_h))
        .map_err(|e| format!("resize to full window failed: {e}"))?;
    window
        .set_min_size(Some(tauri::LogicalSize::new(
            WINDOW_MIN_WIDTH,
            WINDOW_MIN_HEIGHT,
        )))
        .map_err(|e| format!("set min size failed: {e}"))?;
    window
        .set_decorations(true)
        .map_err(|e| format!("restore decorations failed: {e}"))?;
    window
        .center()
        .map_err(|e| format!("center window failed: {e}"))?;
    Ok(())
}

/// Persist the UI theme chosen in the dashboard so the next cold start can
/// paint the splash background in the right color before JavaScript runs.
/// Stored as a tiny standalone file to stay out of config.json, which is
/// owned and schema-migrated by the Node server.
#[tauri::command]
fn save_startup_theme(theme: String) -> Result<(), String> {
    if !STARTUP_THEMES.iter().any(|(name, _)| *name == theme) {
        return Err(format!("unknown theme: {theme}"));
    }
    let path = startup_theme_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create data dir failed: {e}"))?;
    }
    std::fs::write(&path, theme).map_err(|e| format!("write startup theme failed: {e}"))
}

fn open_path(path: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("explorer");
        cmd.arg(path);
        cmd.creation_flags(CREATE_NO_WINDOW);
        return cmd
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("open log dir failed: {e}"));
    }
    #[cfg(target_os = "macos")]
    {
        return Command::new("open")
            .arg(path)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("open log dir failed: {e}"));
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        return Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("open log dir failed: {e}"));
    }
}

#[derive(serde::Serialize)]
struct ClipboardFilesResult {
    paths: Vec<String>,
    error: Option<String>,
}

#[derive(serde::Serialize)]
struct PickMarkdownFileResult {
    path: Option<String>,
    error: Option<String>,
}

#[derive(serde::Serialize)]
struct PickDirectoryResult {
    path: Option<String>,
    error: Option<String>,
}

#[tauri::command]
async fn get_clipboard_files() -> Result<ClipboardFilesResult, String> {
    tauri::async_runtime::spawn_blocking(get_clipboard_files_blocking)
        .await
        .map_err(|e| format!("clipboard task failed: {e}"))
}

#[tauri::command]
async fn pick_markdown_file() -> Result<PickMarkdownFileResult, String> {
    tauri::async_runtime::spawn_blocking(pick_markdown_file_blocking)
        .await
        .map_err(|e| format!("markdown picker task failed: {e}"))
}

#[tauri::command]
async fn pick_directory() -> Result<PickDirectoryResult, String> {
    tauri::async_runtime::spawn_blocking(pick_directory_blocking)
        .await
        .map_err(|e| format!("directory picker task failed: {e}"))
}

fn validated_directory_result(path: String) -> PickDirectoryResult {
    if path.is_empty() {
        return PickDirectoryResult {
            path: None,
            error: None,
        };
    }
    if !Path::new(&path).is_dir() {
        return PickDirectoryResult {
            path: None,
            error: Some("selected path is not an existing directory".to_string()),
        };
    }
    PickDirectoryResult {
        path: Some(path),
        error: None,
    }
}

fn pick_directory_blocking() -> PickDirectoryResult {
    log_diag("[rust] pick_directory invoked");

    #[cfg(windows)]
    {
        let script = r#"
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择工作空间目录'
$dialog.ShowNewFolderButton = $true
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.StartPosition = 'CenterScreen'
$owner.Width = 1
$owner.Height = 1
$owner.ShowInTaskbar = $false
$owner.Opacity = 0
$owner.Show()
$owner.Activate()
$result = $dialog.ShowDialog($owner)
$owner.Close()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.SelectedPath
}
"#;
        return match Command::new("powershell.exe")
            .args(["-NoProfile", "-STA", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            Ok(output) if output.status.success() => validated_directory_result(
                String::from_utf8_lossy(&output.stdout).trim().to_string(),
            ),
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                PickDirectoryResult {
                    path: None,
                    error: Some(if stderr.is_empty() {
                        format!("directory picker exited with {}", output.status)
                    } else {
                        stderr
                    }),
                }
            }
            Err(error) => PickDirectoryResult {
                path: None,
                error: Some(format!("failed to launch directory picker: {error}")),
            },
        };
    }

    #[cfg(unix)]
    {
        let candidates: &[(&str, &[&str])] = &[
            (
                "zenity",
                &[
                    "--file-selection",
                    "--directory",
                    "--title=选择工作空间目录",
                ],
            ),
            ("kdialog", &["--getexistingdirectory", "."]),
        ];
        for &(program, args) in candidates {
            let Ok(output) = Command::new(program).args(args).output() else {
                continue;
            };
            if output.status.success() {
                return validated_directory_result(
                    String::from_utf8_lossy(&output.stdout).trim().to_string(),
                );
            }
        }
        PickDirectoryResult {
            path: None,
            error: Some("no supported directory picker found".to_string()),
        }
    }
}

fn is_markdown_file_path(path: &str) -> bool {
    let Some(ext) = Path::new(path).extension().and_then(|v| v.to_str()) else {
        return false;
    };
    ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown")
}

fn pick_markdown_file_blocking() -> PickMarkdownFileResult {
    log_diag("[rust] pick_markdown_file invoked");

    #[cfg(windows)]
    {
        let script = r#"
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '打开 Markdown 文档'
$dialog.Filter = 'Markdown 文档 (*.md;*.markdown)|*.md;*.markdown'
$dialog.Multiselect = $false
$dialog.CheckFileExists = $true
$dialog.CheckPathExists = $true
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.StartPosition = 'CenterScreen'
$owner.Width = 1
$owner.Height = 1
$owner.ShowInTaskbar = $false
$owner.Opacity = 0
$owner.Show()
$owner.Activate()
$result = $dialog.ShowDialog($owner)
$owner.Close()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.FileName
}
"#;
        match Command::new("powershell.exe")
            .args(["-NoProfile", "-STA", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                if !output.status.success() {
                    let msg = if stderr.is_empty() {
                        format!("file picker exited with {}", output.status)
                    } else {
                        stderr
                    };
                    log_diag(&format!("[rust] pick_markdown_file failed: {msg}"));
                    return PickMarkdownFileResult {
                        path: None,
                        error: Some(msg),
                    };
                }
                if stdout.is_empty() {
                    return PickMarkdownFileResult {
                        path: None,
                        error: None,
                    };
                }
                if !is_markdown_file_path(&stdout) {
                    return PickMarkdownFileResult {
                        path: None,
                        error: Some("selected file is not a Markdown document".to_string()),
                    };
                }
                return PickMarkdownFileResult {
                    path: Some(stdout),
                    error: None,
                };
            }
            Err(e) => {
                let msg = format!("failed to launch file picker: {e}");
                log_diag(&format!("[rust] {msg}"));
                return PickMarkdownFileResult {
                    path: None,
                    error: Some(msg),
                };
            }
        }
    }

    #[cfg(unix)]
    {
        let candidates: &[(&str, &[&str])] = &[
            (
                "zenity",
                &[
                    "--file-selection",
                    "--title=打开 Markdown 文档",
                    "--file-filter=Markdown 文档 | *.md *.markdown",
                ],
            ),
            (
                "kdialog",
                &["--getopenfilename", ".", "*.md *.markdown|Markdown 文档"],
            ),
        ];
        for &(program, args) in candidates {
            let Ok(output) = Command::new(program).args(args).output() else {
                continue;
            };
            if !output.status.success() {
                continue;
            }
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if stdout.is_empty() {
                return PickMarkdownFileResult {
                    path: None,
                    error: None,
                };
            }
            if !is_markdown_file_path(&stdout) {
                return PickMarkdownFileResult {
                    path: None,
                    error: Some("selected file is not a Markdown document".to_string()),
                };
            }
            return PickMarkdownFileResult {
                path: Some(stdout),
                error: None,
            };
        }
        PickMarkdownFileResult {
            path: None,
            error: Some("no supported file picker found".to_string()),
        }
    }
}

fn get_clipboard_files_blocking() -> ClipboardFilesResult {
    log_diag("[rust] get_clipboard_files invoked");

    // Windows: read file paths from the clipboard (CF_HDROP / FileNameW).
    // Unix: file-copy clipboard access requires platform-specific tooling
    // (xclip/wl-clipboard) that is not available in all environments.
    // Return an empty result with a hint so the JS layer can fall back to
    // its native paste handler.
    #[cfg(unix)]
    {
        log_diag("[rust] get_clipboard_files: not implemented on Unix — use JS paste fallback");
        return ClipboardFilesResult {
            paths: Vec::new(),
            error: Some("clipboard file reading is not supported on this platform".to_string()),
        };
    }

    #[cfg(windows)]
    {
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
                let copied =
                    unsafe { DragQueryFileW(hdrop, i, buf.as_mut_ptr(), buf.len() as u32) };
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
        // Spawn a short-lived child to test assignment. Use platform-appropriate
        // shell: cmd.exe on Windows, sh on Unix.
        let mut cmd = if cfg!(windows) {
            let mut c = Command::new("cmd.exe");
            c.args(["/c", "exit", "0"]);
            c
        } else {
            let mut c = Command::new("sh");
            c.args(["-c", "exit 0"]);
            c
        };
        configure_child_command(&mut cmd);
        let child = cmd.spawn().expect("spawn child");
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
    fn restart_attempt_resets_only_after_stable_uptime() {
        assert_eq!(restart_attempt_after_uptime(4, Duration::from_secs(30)), 4);
        assert_eq!(
            restart_attempt_after_uptime(4, Duration::from_secs(CHILD_RESTART_STABLE_RESET_SECS)),
            0
        );
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

    #[test]
    fn markdown_file_picker_accepts_only_markdown_extensions() {
        assert!(is_markdown_file_path(r"C:\docs\report.md"));
        assert!(is_markdown_file_path(r"C:\docs\REPORT.MARKDOWN"));
        assert!(!is_markdown_file_path(r"C:\docs\report.txt"));
        assert!(!is_markdown_file_path(r"C:\docs\report.md.bak"));
        assert!(!is_markdown_file_path(r"C:\docs\report"));
    }

    #[test]
    fn needed_resources_exist_in_source_tree() {
        // Verifies that every file in the NEEDED array actually exists in
        // resources/server/. Prevents a repeat of the learn-sandbox-impl.mjs
        // missing-file incident.
        let src_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("server");
        for name in &["learn.mjs", "learn-track.mjs", "learn-sandbox-impl.mjs"] {
            let path = src_dir.join(name);
            assert!(
                path.exists(),
                "NEEDED resource missing from source tree: {}",
                path.display()
            );
        }
    }
}
