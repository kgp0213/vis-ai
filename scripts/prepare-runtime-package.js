#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "src-tauri", "resources", "server", "visionox-pkg");
const target = resolve(process.env.VISIONOX_RUNTIME_PACKAGE || "");
const tempRelative = relative(resolve(tmpdir()), target);
if (!process.env.VISIONOX_RUNTIME_PACKAGE || !tempRelative || tempRelative.startsWith("..") || isAbsolute(tempRelative)) {
  throw new Error("VISIONOX_RUNTIME_PACKAGE must point to a child of the system temporary directory");
}

function copyFile(relative) {
  const from = join(source, relative);
  const to = join(target, relative);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}

function copyDirectory(relative) {
  const from = join(source, relative);
  if (!existsSync(from)) throw new Error(`missing runtime source: ${from}`);
  cpSync(from, join(target, relative), { recursive: true });
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const file of ["package.json", "package-lock.json", "dashboard/index.html", "dashboard/app.css", "dashboard/katex-support.js", "dashboard/backup-support.js", "dashboard/index-mode-support.js", "dashboard/overview-alerts-support.js"]) copyFile(file);
for (const file of ["app.js", "vendor-uplot.css", "vendor-hljs.css", "128x128.png", "ai-avatar.png", "v1.png", "v3.png"]) {
  copyFile(join("dashboard", "dist", file));
}
copyDirectory(join("dashboard", "vendor", "katex"));
for (const dir of ["dist", "data", "node_modules"]) copyDirectory(dir);

const pruneCommand = process.platform === "win32"
  ? [process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm prune --offline --omit=dev --ignore-scripts --no-audit --no-fund"]]
  : ["npm", ["prune", "--offline", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"]];
const pruned = spawnSync(pruneCommand[0], pruneCommand[1], {
  cwd: target,
  stdio: "inherit",
});
if (pruned.status !== 0) {
  rmSync(target, { recursive: true, force: true });
  throw new Error(`npm prune failed: ${pruned.error?.message || `status ${pruned.status}`}`);
}

const forbiddenRuntimeFile = /(?:\.map|\.bak|\.old|\.partial|\.tmp)$/i;
function pruneRuntimeFiles(path) {
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    const stat = statSync(child);
    if (stat.isDirectory()) {
      pruneRuntimeFiles(child);
    } else if (name.startsWith(".-") || forbiddenRuntimeFile.test(name)) {
      rmSync(child, { force: true });
    }
  }
}
pruneRuntimeFiles(target);

let bytes = 0;
let files = 0;
function measure(path) {
  const stat = statSync(path);
  if (stat.isFile()) {
    bytes += stat.size;
    files++;
    return;
  }
  for (const name of readdirSync(path)) measure(join(path, name));
}
measure(target);
console.log(`[runtime-package] prepared ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
