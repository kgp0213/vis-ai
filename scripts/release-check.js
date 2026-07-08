#!/usr/bin/env node
/**
 * Release guard for local desktop builds.
 *
 * This intentionally runs the checks developers otherwise have to remember by
 * hand before giving an exe or installer to users.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const npmCmd = "npm";

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function run(label, command, args, cwd = root) {
  console.log(`\n[release-check] ${label}`);
  const display = [command, ...args].map(shellQuote).join(" ");
  console.log(`> ${display}`);
  const result = process.platform === "win32"
    ? spawnSync(display, { cwd, stdio: "inherit", shell: true })
    : spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) {
    console.error(`[release-check] ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function yyMMdd(date = new Date()) {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function checkVersionDate() {
  console.log("\n[release-check] version date");
  const pkgPath = join(root, "src-tauri", "resources", "server", "visionox-pkg", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const expected = yyMMdd();
  if (pkg.version !== expected) {
    console.error(`[release-check] expected UI Ver${expected}, got Ver${pkg.version}`);
    console.error("[release-check] update src-tauri/resources/server/visionox-pkg/package.json and package-lock.json before release.");
    process.exit(1);
  }
  console.log(`[release-check] ok: Ver${pkg.version}`);
}

function printArtifacts() {
  const exe = join(root, "src-tauri", "target", "release", "visionox-desktop.exe");
  const nsis = join(root, "src-tauri", "target", "release", "bundle", "nsis", "Visionox_1.20.0_x64-setup.exe");
  console.log("\n[release-check] artifacts");
  console.log(`exe: ${existsSync(exe) ? exe : "(not found)"}`);
  console.log(`nsis: ${existsSync(nsis) ? nsis : "(not built in this check)"}`);
}

run("dashboard syntax", "node", ["--check", "src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js"]);
run("server bundle syntax", "node", ["--check", "src-tauri/resources/server/visionox-pkg/dist/cli/server-XGDBRWMB.js"]);
run("bundle patch guard", npmCmd, ["run", "check:bundle-patches"]);
run("node tests", npmCmd, ["test"]);
run("rust tests", "cargo", ["test"], join(root, "src-tauri"));
checkVersionDate();
run("tauri no-bundle build", npmCmd, ["run", "tauri:build", "--", "--no-bundle"]);
printArtifacts();

console.log("\n[release-check] ok");
