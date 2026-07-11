#!/usr/bin/env node

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stagingRoot = mkdtempSync(join(tmpdir(), "visionox-release-"));
const runtimePackage = join(stagingRoot, "visionox-pkg");
const tauriCli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const offlineEnv = {
  ...process.env,
  CARGO_NET_OFFLINE: "true",
  CARGO_TARGET_DIR: join(root, "src-tauri", "target"),
  npm_config_offline: "true",
  npm_config_audit: "false",
  npm_config_fund: "false",
  VISIONOX_RUNTIME_PACKAGE: runtimePackage,
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

function cleanupStaging() {
  if (!existsSync(stagingRoot)) return;
  rmSync(stagingRoot, { recursive: true, force: true });
  console.log(`[tauri-build] removed temporary staging: ${stagingRoot}`);
}

process.on("exit", cleanupStaging);

let exitCode = 0;
try {
  run("prepare runtime package", join(root, "scripts", "prepare-runtime-package.js"));
  run("check bundle patches", join(root, "scripts", "check-bundle-patches.js"));
  if (!existsSync(tauriCli)) throw new Error(`Tauri CLI not found: ${tauriCli}`);
  const resourceOverride = {
    bundle: {
      resources: {
        "runtime/visionox-pkg/": null,
        [`${runtimePackage}${sep}`]: "resources/server/visionox-pkg/",
      },
    },
  };
  run("build release", tauriCli, ["build", ...process.argv.slice(2), "--config", JSON.stringify(resourceOverride)]);
  run("verify release resources", join(root, "scripts", "verify-release-resources.js"));
} catch (error) {
  exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  console.error(`[tauri-build] ${error?.message || error}`);
} finally {
  cleanupStaging();
}

process.exitCode = exitCode;
