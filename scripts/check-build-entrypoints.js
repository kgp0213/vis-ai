#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function validateBuildEntrypoints(pkg) {
  const scripts = pkg?.scripts ?? {};
  const failures = [];
  if (scripts["tauri:build"] !== "node scripts/run-tauri-build.js") failures.push("tauri:build must use the canonical wrapper");
  if (!String(scripts.tauri ?? "").includes("generic Tauri commands are disabled")) failures.push("generic tauri entrypoint must be disabled");
  if (!String(scripts["tauri:dev"] ?? "").includes("tauri dev is disabled")) failures.push("tauri:dev must be disabled");
  for (const [name, command] of Object.entries(scripts)) {
    if (name === "tauri:build" || name === "bundle:nsis" || name === "release:check") continue;
    if (String(command).includes("process.exit(1)") && String(command).includes("disabled")) continue;
    if (/\btauri\s+(?:dev|build)\b|\bcargo\s+(?:build|run)\b/.test(String(command))) failures.push(`${name} bypasses the canonical release wrapper`);
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
