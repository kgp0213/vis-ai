#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const nodeExe = process.platform === "win32"
  ? join(root, "src-tauri", "resources", "server", "node.exe")
  : process.execPath;

if (!existsSync(nodeExe)) {
  console.error(`[runtime-path] node runtime not found: ${nodeExe}`);
  process.exit(1);
}

const base = mkdtempSync(join(tmpdir(), "visionox-runtime-path-"));
const probeDir = join(base, "中文 路径", "动态导入");
mkdirSync(probeDir, { recursive: true });
const dep = join(probeDir, "依赖.mjs");
const entry = join(probeDir, "启动 probe.mjs");

try {
  writeFileSync(dep, "export const value = 'unicode-path-ok';\n", "utf8");
  writeFileSync(entry, [
    "process.stderr.write('[runtime-path] entered\\n');",
    "const { value } = await import('./依赖.mjs');",
    "process.stdout.write(value + '\\n');",
    "",
  ].join("\n"), "utf8");
  const result = spawnSync(nodeExe, [entry], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0 || result.stdout.trim() !== "unicode-path-ok" || !result.stderr.includes("entered")) {
    console.error(`[runtime-path] failed with status=${result.status}`);
    if (result.stdout) console.error(`[runtime-path] stdout: ${result.stdout.trim()}`);
    if (result.stderr) console.error(`[runtime-path] stderr: ${result.stderr.trim()}`);
    process.exit(1);
  }
  console.log("[runtime-path] ok: bundled Node executed dynamic imports from a Chinese path with spaces");
} finally {
  rmSync(base, { recursive: true, force: true });
}
