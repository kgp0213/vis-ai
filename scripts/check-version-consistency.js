#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function readProductVersions(root) {
  const desktop = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  const tauri = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8")).version;
  const cargo = /^version\s*=\s*"([^"]+)"$/m.exec(readFileSync(join(root, "src-tauri", "Cargo.toml"), "utf8"))?.[1];
  return { desktop, tauri, cargo };
}

export function checkProductVersions(root) {
  const versions = readProductVersions(root);
  const unique = new Set(Object.values(versions));
  if ([...unique].some((value) => typeof value !== "string" || !value.trim()) || unique.size !== 1) {
    throw new Error(`product version mismatch: package.json=${versions.desktop}, tauri.conf.json=${versions.tauri}, Cargo.toml=${versions.cargo}`);
  }
  return versions.desktop;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const root = join(dirname(scriptPath), "..");
  try {
    console.log(`[version-consistency] ok: ${checkProductVersions(root)}`);
  } catch (error) {
    console.error(`[version-consistency] ${error.message}`);
    process.exitCode = 1;
  }
}
