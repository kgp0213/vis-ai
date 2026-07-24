#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function validateBuildEntrypoints(pkg) {
  const scripts = pkg?.scripts ?? {};
  const failures = [];
  if (scripts["tauri:build"] !== "node scripts/run-tauri-build.js") failures.push("tauri:build must use the canonical wrapper");
  if (scripts.tauri !== "tauri") failures.push("generic tauri entrypoint must use the project CLI");
  if (scripts["pretauri:dev"] !== "npm run dashboard:check && node scripts/prepare-runtime-package.js") {
    failures.push("tauri:dev must verify the Dashboard build and prepare the runtime package first");
  }
  if (scripts["tauri:dev"] !== "tauri dev") failures.push("tauri:dev must use the project CLI");
  for (const [name, command] of Object.entries(scripts)) {
    if (["tauri", "pretauri:dev", "tauri:dev", "tauri:build", "bundle:nsis", "release:check"].includes(name)) continue;
    if (String(command).includes("process.exit(1)") && String(command).includes("disabled")) continue;
    if (/\btauri\s+(?:dev|build)\b|\bcargo\s+(?:build|run)\b/.test(String(command))) failures.push(`${name} bypasses the governed build entrypoints`);
  }
  return failures;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const failures = validateBuildEntrypoints(pkg);
  if (failures.length) {
    console.error("[build-entrypoints] invalid build scripts:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("[build-entrypoints] ok");
}
