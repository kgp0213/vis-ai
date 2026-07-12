#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, command, args) {
  console.log(`\n[quality] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    shell: false,
  });
  if (result.error) console.error(`[quality] ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status || 1);
}

run("launcher syntax", "node", ["--check", "src-tauri/resources/server/launcher.mjs"]);
run("dashboard syntax", "node", ["--check", "src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js"]);
run("server bundle syntax", "node", ["--check", "src-tauri/resources/server/visionox-pkg/dist/cli/server-XGDBRWMB.js"]);
run("product version consistency", "node", ["scripts/check-version-consistency.js"]);
run("bundle patch guard", "node", ["scripts/check-bundle-patches.js"]);
run("repository hygiene", "node", ["scripts/check-repository-hygiene.js"]);
run("node tests", "node", ["--test", "src-tauri/resources/server/**/*.test.mjs"]);
run("browser UI smoke", "node", ["scripts/ui-smoke.js"]);
run("Rust formatting", "cargo", ["fmt", "--manifest-path", "src-tauri/Cargo.toml", "--", "--check"]);
run("diff whitespace", "git", ["diff", "--check"]);

console.log("\n[quality] ok");
