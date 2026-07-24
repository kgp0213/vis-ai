#!/usr/bin/env node
/**
 * Release guard for local desktop builds.
 *
 * This intentionally runs the checks developers otherwise have to remember by
 * hand before giving an exe or installer to users.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const npmCmd = "npm";
const releaseCargoEnv = {
  ...process.env,
  CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS || "1",
};

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function run(label, command, args, cwd = root, env = process.env) {
  console.log(`\n[release-check] ${label}`);
  const display = [command, ...args].map(shellQuote).join(" ");
  console.log(`> ${display}`);
  const result = process.platform === "win32"
    ? spawnSync(display, { cwd, stdio: "inherit", shell: true, env })
    : spawnSync(command, args, { cwd, stdio: "inherit", env });
  if (result.error) {
    console.error(`[release-check] ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function removeTempPath(path, label) {
  if (!path) return;
  try {
    rmSync(path, { recursive: true, force: true });
  } catch (error) {
    console.error(`[release-check] failed to clean ${label}: ${error.message}`);
  }
}

function runRustTestsIsolated() {
  let targetDir = null;
  let stagingRoot = null;
  let status = 0;
  try {
    targetDir = mkdtempSync(join(tmpdir(), "visionox-rust-tests-"));
    stagingRoot = mkdtempSync(join(tmpdir(), "visionox-rust-runtime-"));
    const runtimePackage = join(stagingRoot, "visionox-pkg");
    const resourceOverride = {
      bundle: {
        resources: {
          "runtime/visionox-pkg/": null,
          [`${runtimePackage}${sep}`]: "resources/server/visionox-pkg/",
        },
      },
    };
    const env = {
      ...releaseCargoEnv,
      CARGO_TARGET_DIR: targetDir,
      CARGO_NET_OFFLINE: "true",
      npm_config_offline: "true",
      VISIONOX_RUNTIME_PACKAGE: runtimePackage,
      TAURI_CONFIG: JSON.stringify(resourceOverride),
    };
    console.log(`\n[release-check] prepare isolated Rust test runtime`);
    const prepare = spawnSync(process.execPath, ["scripts/prepare-runtime-package.js"], {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
      env,
    });
    if (prepare.error) console.error(`[release-check] ${prepare.error.message}`);
    status = prepare.error || prepare.status === null || prepare.signal ? 1 : prepare.status;
    if (status === 0) {
      console.log(`\n[release-check] rust tests (isolated target: ${targetDir})`);
      const result = spawnSync("cargo", ["test"], {
        cwd: join(root, "src-tauri"),
        stdio: "inherit",
        windowsHide: true,
        env,
      });
      if (result.error) console.error(`[release-check] ${result.error.message}`);
      status = result.error || result.status === null || result.signal ? 1 : result.status;
    }
  } finally {
    removeTempPath(targetDir, "isolated Rust target");
    removeTempPath(stagingRoot, "isolated Rust runtime");
  }
  if (status !== 0) process.exit(status);
}

function checkBuildStampSource() {
  const sourcePath = join(root, "src-tauri", "resources", "server", "visionox-pkg", "dist", "cli", "server-XGDBRWMB.js");
  const source = readFileSync(sourcePath, "utf8");
  if (!source.includes('buildDate: "__VISIONOX_BUILD_STAMP__"')) {
    console.error("[release-check] runtime source is missing the build stamp placeholder");
    process.exit(1);
  }
}

function checkReleaseBuildStamp() {
  const builtPath = join(root, "src-tauri", "target", "release", "resources", "server", "visionox-pkg", "dist", "cli", "server-XGDBRWMB.js");
  const built = readFileSync(builtPath, "utf8");
  if (built.includes("__VISIONOX_BUILD_STAMP__")) {
    console.error("[release-check] release still contains the unresolved build stamp placeholder");
    process.exit(1);
  }
  const match = /buildDate:\s*"(\d{6} \d{2})"/.exec(built);
  if (!match) {
    console.error("[release-check] release is missing a valid YYMMDD HH build stamp");
    process.exit(1);
  }
  console.log(`[release-check] valid YYMMDD HH build stamp: ${match[1]}`);
}

function printArtifacts() {
  const exe = join(root, "src-tauri", "target", "release", "visionox-whale.exe");
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  const tauriConfig = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
  const nsis = join(root, "src-tauri", "target", "release", "bundle", "nsis", `${tauriConfig.productName}_${version}_x64-setup.exe`);
  console.log("\n[release-check] artifacts");
  console.log(`exe: ${existsSync(exe) ? exe : "(not found)"}`);
  console.log(`nsis: ${existsSync(nsis) ? nsis : "(not built in this check)"}`);
}

run("dashboard syntax", "node", ["--check", "src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js"]);
run("server bundle syntax", "node", ["--check", "src-tauri/resources/server/visionox-pkg/dist/cli/server-XGDBRWMB.js"]);
run("bundled runtime Unicode path", npmCmd, ["run", "check:runtime-paths"]);
run("bundle patch guard", npmCmd, ["run", "check:bundle-patches"]);
run("node tests", npmCmd, ["test"]);
checkBuildStampSource();
runRustTestsIsolated();
run("tauri no-bundle build", npmCmd, ["run", "tauri:build", "--", "--no-bundle"], root, releaseCargoEnv);
checkReleaseBuildStamp();
printArtifacts();

console.log("\n[release-check] ok");
