// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(e) = visionox_whale::run() {
        eprintln!("FATAL: {e:#}");
        std::process::exit(1);
    }
}
