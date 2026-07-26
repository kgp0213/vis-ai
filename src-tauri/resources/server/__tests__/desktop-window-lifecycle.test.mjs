import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const desktop = readFileSync(new URL("../../../src/lib.rs", import.meta.url), "utf8");
const loader = readFileSync(new URL("../../../../src/index.html", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url), "utf8");

test("single-instance and tray actions fully restore the main window", () => {
  assert.match(desktop, /fn restore_main_window<[^>]+>\(/);
  assert.match(desktop, /window\.unminimize\(\)/);
  assert.match(desktop, /window\.current_monitor\(\)/);
  assert.match(desktop, /window\.center\(\)/);
  assert.match(desktop, /window restore requested/);
  assert.match(desktop, /window restore completed/);

  const calls = desktop.match(/restore_main_window\(/g) ?? [];
  assert.equal(calls.length, 3, "all three restore entry points must use the shared helper");
});

test("intentional application shutdown cannot restart the managed server", () => {
  assert.match(desktop, /shutting_down:\s*Arc<AtomicBool>/);
  assert.match(desktop, /shutting_down\.store\(true, Ordering::Release\)/);
  assert.match(desktop, /shutting_down_for_monitor\.load\(Ordering::Acquire\)/);
  assert.match(desktop, /child process exited during application shutdown/);
});

test("server stderr capture creates a durable diagnostic file before launch", () => {
  assert.match(desktop, /let stderr_log_path = server_stderr_log_path\(\)/);
  assert.match(desktop, /OpenOptions::new\(\)[\s\S]*?\.create\(true\)[\s\S]*?\.append\(true\)/);
  assert.match(desktop, /fn append_server_stderr_log\(message: &str\)/);
  assert.match(desktop, /fn stable_exit_status\(status: &ExitStatus\)/);
  assert.match(desktop, /launcher stderr capture starting/);
  assert.match(desktop, /launcher process spawned pid=/);
  assert.match(desktop, /launcher stderr stream closed/);
  assert.match(desktop, /classification=\{status_class\}/);
  assert.match(desktop, /exit_status\}/);
  assert.match(desktop, /server exited during application shutdown/);
});

test("startup loader waits for a rendered dashboard readiness handshake", () => {
  assert.match(loader, /function getTauriInvoke/);
  assert.match(loader, /api\.core && typeof api\.core\.invoke === "function"/);
  assert.doesNotMatch(loader, /window\.__TAURI__\.invoke\(/);
  assert.match(dashboard, /type:\s*["']vis_dashboard_ready["']/);
  assert.match(dashboard, /setTimeout\(\(\) => window\.parent\.postMessage/);
  assert.doesNotMatch(dashboard, /requestAnimationFrame\(\(\) => window\.parent\.postMessage\(\{ type: "vis_dashboard_ready"/);
  assert.match(loader, /function armDashboardReadyGuard/);
  assert.match(loader, /"vis_dashboard_ready"/);
  assert.match(loader, /界面加载超时/);
  assert.match(loader, /frame\.style\.visibility = "hidden"/);
  assert.doesNotMatch(desktop, /spinner\.style\.display='none'/);
});

test("cold startup waits for the current server instead of navigating to a stale saved port", () => {
  const restoreStart = loader.indexOf("function restoreDashboard()");
  const restoreEnd = loader.indexOf("function fallbackToRust()", restoreStart);
  const restoreBody = loader.slice(restoreStart, restoreEnd);
  assert.match(restoreBody, /sessionStorage\.getItem\("visionox\.dashboardUrl"\) \|\| ""/);
  assert.doesNotMatch(restoreBody, /localStorage\.getItem\("visionox\.dashboardUrl"\)/);
  assert.match(loader, /get_dashboard_url is not ready; waiting for current server/);
  assert.match(loader, /restoreFromRustAndShow\(attempt \+ 1\)/);
  assert.match(loader, /本地服务启动超时/);
});

test("startup loader is theme-aware and avoids the legacy spinner", () => {
  assert.doesNotMatch(loader, /class="spin"/);
  assert.match(loader, /class="startup-progress"/);
  assert.match(loader, /data-theme="midnight-ink"/);
  assert.match(loader, /prefers-reduced-motion: reduce/);
  assert.match(loader, /正在启动…/);
  assert.doesNotMatch(loader, /id="diag-actions"|id="log-path"/);
});

test("startup loader keeps the approved layout and native window without a diagnostics expansion", () => {
  assert.match(desktop, /const SPLASH_WIDTH: f64 = 630\.0;/);
  assert.match(desktop, /const SPLASH_HEIGHT: f64 = 450\.0;/);
  assert.doesNotMatch(desktop, /SPLASH_ERROR_HEIGHT|fn resize_startup_window/);
  assert.match(loader, /\.wrap\s*\{[\s\S]*?width:\s*min\(360px, calc\(100vw - 96px\)\)/);
  assert.match(loader, /h1\s*\{[\s\S]*?font-size:\s*24px/);
  assert.match(loader, /#status\s*\{[\s\S]*?font-size:\s*13px/);
  assert.doesNotMatch(loader, /resize_startup_window|get_log_info/);
});
