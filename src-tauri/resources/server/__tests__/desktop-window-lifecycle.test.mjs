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
