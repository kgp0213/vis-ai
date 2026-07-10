#!/usr/bin/env node

import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = join(root, "src-tauri", "runtime");
const tauriCli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const offlineEnv = {
  ...process.env,
  CARGO_NET_OFFLINE: "true",
  npm_config_offline: "true",
  npm_config_audit: "false",
  npm_config_fund: "false",
};

function run(label, script, args = []) {
  console.log(`[tauri-build] ${label}`);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env: offlineEnv,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${label} failed with status ${result.status ?? "unknown"}`);
    error.exitCode = result.status || 1;
    throw error;
  }
}

function cleanupRuntime() {
  if (!existsSync(runtimeDir)) return;
  rmSync(runtimeDir, { recursive: true, force: true });
  console.log(`[tauri-build] removed temporary staging: ${runtimeDir}`);
}

process.on("exit", cleanupRuntime);

let exitCode = 0;
try {
  run("prepare runtime package", join(root, "scripts", "prepare-runtime-package.js"));
  run("check bundle patches", join(root, "scripts", "check-bundle-patches.js"));
  if (!existsSync(tauriCli)) throw new Error(`Tauri CLI not found: ${tauriCli}`);
  run("build release", tauriCli, ["build", ...process.argv.slice(2)]);
  run("verify release resources", join(root, "scripts", "verify-release-resources.js"));
} catch (error) {
  exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  console.error(`[tauri-build] ${error?.message || error}`);
} finally {
  cleanupRuntime();
}

process.exitCode = exitCode;
