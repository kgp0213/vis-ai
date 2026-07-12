#!/usr/bin/env node

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function runProcess(root, env, label, script, args = []) {
  console.log(`[tauri-build] ${label}`);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${label} failed with status ${result.status ?? "unknown"}`);
    error.exitCode = result.status || 1;
    throw error;
  }
}

export function validateBuildArgs(args) {
  if (args.includes("--debug")) throw new Error("debug builds are forbidden; use the canonical release target");
  if (args.some((arg) => arg === "--target-dir" || arg.startsWith("--target-dir="))) {
    throw new Error("custom target directories are forbidden");
  }
}

export function createOfflineBuildEnv(root, runtimePackage, base = process.env) {
  return {
    ...base,
    CARGO_NET_OFFLINE: "true",
    CARGO_TARGET_DIR: join(root, "src-tauri", "target"),
    npm_config_offline: "true",
    npm_config_audit: "false",
    npm_config_fund: "false",
    VISIONOX_RUNTIME_PACKAGE: runtimePackage,
  };
}

export function runTauriBuild(options = {}) {
  const root = resolve(options.root ?? defaultRoot);
  const args = options.args ?? [];
  validateBuildArgs(args);
  const stagingRoot = (options.makeStaging ?? (() => mkdtempSync(join(tmpdir(), "visionox-release-"))))();
  const runtimePackage = join(stagingRoot, "visionox-pkg");
  const tauriCli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
  const env = createOfflineBuildEnv(root, runtimePackage, options.baseEnv);
  const runner = options.runner ?? ((label, script, runArgs) => runProcess(root, env, label, script, runArgs));
  const cleanup = () => {
    if (!existsSync(stagingRoot)) return;
    rmSync(stagingRoot, { recursive: true, force: true });
    if (!options.quiet) console.log(`[tauri-build] removed temporary staging: ${stagingRoot}`);
  };

  try {
    runner("verify runtime manifest", join(root, "scripts", "verify-runtime-manifest.js"), [], env);
    runner("prepare runtime package", join(root, "scripts", "prepare-runtime-package.js"), [], env);
    runner("check bundle patches", join(root, "scripts", "check-bundle-patches.js"), [], env);
    if (!options.skipTauriExistenceCheck && !existsSync(tauriCli)) throw new Error(`Tauri CLI not found: ${tauriCli}`);
    const resourceOverride = {
      bundle: {
        resources: {
          "runtime/visionox-pkg/": null,
          [`${runtimePackage}${sep}`]: "resources/server/visionox-pkg/",
        },
      },
    };
    runner("build release", tauriCli, ["build", ...args, "--config", JSON.stringify(resourceOverride)], env);
    runner("verify release resources", join(root, "scripts", "verify-release-resources.js"), [], env);
    return { stagingRoot, runtimePackage, env };
  } finally {
    cleanup();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runTauriBuild({ args: process.argv.slice(2) });
  } catch (error) {
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
    console.error(`[tauri-build] ${error?.message || error}`);
  }
}
