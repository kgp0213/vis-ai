use std::io::BufRead;
use std::os::windows::process::CommandExt;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const DETACHED_PROCESS: u32 = 0x00000008;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

struct ServerState {
    child: Option<Child>,
    url: Option<String>,
}

/// Spawn the Node.js launcher and block until we parse the dashboard URL.
fn spawn_server_blocking() -> Result<(Child, String), Box<dyn std::error::Error>> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();

    let launcher = exe_dir.join("resources").join("server").join("launcher.mjs");
    let node_exe = exe_dir.join("resources").join("server").join("node.exe");

    let node_path = if node_exe.exists() {
        node_exe
    } else {
        std::path::PathBuf::from("node")
    };

    println!("[tauri] launching: {:?} {:?}", node_path, launcher);

    let mut child = Command::new(&node_path)
        .arg(&launcher)
        .arg("--port")
        .arg("0")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
        .spawn()?;

    let stdout = child.stdout.take().expect("failed to capture stdout");
    let reader = std::io::BufReader::new(stdout);

    let mut url = String::new();
    for line in reader.lines() {
        let line = line?;
        println!("[launcher] {}", line);
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&line) {
            if let Some(err) = parsed["error"].as_str() {
                let _ = child.kill();
                return Err(format!("launcher error: {}", err).into());
            }
            if let Some(u) = parsed["url"].as_str() {
                url = u.to_string();
                break;
            }
        }
    }

    if url.is_empty() {
        let _ = child.kill();
        return Err("failed to discover dashboard URL".into());
    }

    Ok((child, url))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(ServerState {
            child: None,
            url: None,
        }))
        .setup(|app| {
            // ── Create main window FIRST (shows loading page) ─────
            let main_window = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("index.html".into()),
            )
            .title("")
            .inner_size(1280.0, 800.0)
            .min_inner_size(800.0, 500.0)
            .center()
            .visible(true)
            .build()?;

            // Spawn server in background thread so UI isn't blocked
            let win_for_url = main_window.clone();
            let app_handle = app.handle().clone();

            std::thread::spawn(move || {
                match spawn_server_blocking() {
                    Ok((child, url)) => {
                        println!("[tauri] dashboard ready at {}", url);

                        // Store child handle for cleanup
                        let state = app_handle.state::<Mutex<ServerState>>();
                        {
                            let mut s = state.lock().unwrap();
                            s.child = Some(child);
                            s.url = Some(url.clone());
                        }

                        // Navigate the loading page to the dashboard
                        let _ = win_for_url.eval(&format!(
                            "window.location.replace('{}')",
                            url.replace('\'', "\\'")
                        ));
                    }
                    Err(e) => {
                        eprintln!("[tauri] server failed: {}", e);
                        let _ = win_for_url.eval(&format!(
                            "document.getElementById('status').textContent = 'Server failed: {}'",
                            e.to_string().replace('\'', "\\'")
                        ));
                    }
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
                .menu(&tray_menu)
                .tooltip("Visionox")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
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
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── Close → minimize to tray ─────────────────────────
            let app_handle_for_close = app.handle().clone();
            main_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if let Some(w) = app_handle_for_close.get_webview_window("main") {
                        let _ = w.hide();
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
                    let mut guard = state.lock().unwrap();
                    if let Some(ref mut child) = guard.child {
                        println!("[tauri] shutting down server...");
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        });
}
