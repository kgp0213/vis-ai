#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const RETIRED_RELEASE_RESOURCES = [
  "bootstrap-skills/document-organizer/task-recipes.json",
  "bootstrap-skills/pdf/references/pdf-to-markdown.md",
  "server/lib/complex-task-launcher-wiring.test.mjs",
  "server/lib/foreground-task-supervisor.mjs",
  "server/lib/foreground-task-supervisor.test.mjs",
];
const STALE_RELEASE_LIB_FILES = new Set([
  "document-delivery.mjs",
  "document-markdown-workflow.mjs",
  "document-extractors.mjs",
  "document-intelligence.mjs",
  "document-output-reservation.mjs",
  "long-task-handoff.mjs",
  "pdf-markdown-workflow.mjs",
  "pdf-text.mjs",
]);

function includesRuntimeLibFile(name) {
  return !name.endsWith(".test.mjs")
    && !/^complex-task-.*\.mjs$/i.test(name);
}

export function prepareRuntimeLibResources(root, stagingRoot) {
  const source = resolve(root, "src-tauri", "resources", "server", "lib");
  const target = resolve(stagingRoot, "server-lib");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (!entry.isFile() || !includesRuntimeLibFile(entry.name)) continue;
    copyFileSync(resolve(source, entry.name), resolve(target, entry.name));
  }
  return target;
}

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

export function pruneRetiredReleaseResources(root) {
  const resourcesRoot = resolve(root, "src-tauri", "target", "release", "resources");
  for (const resourcePath of RETIRED_RELEASE_RESOURCES) {
    const target = resolve(resourcesRoot, resourcePath);
    const targetRelative = relative(resourcesRoot, target);
    if (!targetRelative || targetRelative.startsWith("..") || targetRelative.includes(`..${sep}`)) {
      throw new Error(`retired release resource escapes canonical tree: ${resourcePath}`);
    }
    rmSync(target, { force: true });
  }
  const legacyLib = resolve(resourcesRoot, "server", "lib");
  if (existsSync(legacyLib)) {
    for (const entry of readdirSync(legacyLib, { withFileTypes: true })) {
      if (!entry.isFile() || !(entry.name.endsWith(".test.mjs") || /^complex-task-.*\.mjs$/i.test(entry.name) || STALE_RELEASE_LIB_FILES.has(entry.name))) continue;
      const target = resolve(legacyLib, entry.name);
      const targetRelative = relative(resourcesRoot, target);
      if (!targetRelative || targetRelative.startsWith("..") || targetRelative.includes(`..${sep}`)) {
        throw new Error(`retired release resource escapes canonical tree: ${entry.name}`);
      }
      rmSync(target, { force: true });
    }
  }
}

export function runTauriBuild(options = {}) {
  const root = resolve(options.root ?? defaultRoot);
  const args = options.args ?? [];
  validateBuildArgs(args);
  rmSync(join(root, "src-tauri", "target", "release", "release-manifest.json"), { force: true });
  pruneRetiredReleaseResources(root);
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
    const runtimeLib = prepareRuntimeLibResources(root, stagingRoot);
    if (!options.skipTauriExistenceCheck && !existsSync(tauriCli)) throw new Error(`Tauri CLI not found: ${tauriCli}`);
    const resourceOverride = {
      bundle: {
        resources: {
          "runtime/visionox-pkg/": null,
          "resources/server/lib/": null,
          [`${runtimePackage}${sep}`]: "resources/server/visionox-pkg/",
          [`${runtimeLib}${sep}`]: "resources/server/lib/",
        },
      },
    };
    runner("build release", tauriCli, ["build", ...args, "--config", JSON.stringify(resourceOverride)], env);
    // Tauri copies directory resources after the initial guard runs. Prune
    // again from the actual release tree so tests and retired workflows cannot
    // re-enter the package during the copy step.
    pruneRetiredReleaseResources(root);
    runner("verify release resources", join(root, "scripts", "verify-release-resources.js"), [], env);
    runner("write release manifest", join(root, "scripts", "release-manifest.js"), ["--release-verified"], env);
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
