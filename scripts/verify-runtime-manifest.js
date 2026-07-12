#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const resourcesRoot = resolve(root, "src-tauri", "resources");
const manifestPath = join(resourcesRoot, "runtime-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const failures = [];

if (manifest.schemaVersion !== 1) failures.push(`unsupported schemaVersion: ${manifest.schemaVersion}`);
if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) failures.push("artifacts must be a non-empty array");

for (const artifact of manifest.artifacts ?? []) {
  const path = resolve(resourcesRoot, String(artifact.path || ""));
  const insideResources = path === resourcesRoot || path.startsWith(`${resourcesRoot}${sep}`);
  if (!insideResources || normalize(relative(resourcesRoot, path)).startsWith("..")) {
    failures.push(`invalid artifact path: ${artifact.path}`);
    continue;
  }
  if (!existsSync(path) || !statSync(path).isFile()) {
    failures.push(`missing artifact: ${artifact.path}`);
    continue;
  }
  const stat = statSync(path);
  const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (!Number.isInteger(artifact.bytes) || artifact.bytes !== stat.size) {
    failures.push(`size mismatch: ${artifact.path}; expected ${artifact.bytes}, got ${stat.size}`);
  }
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256 || "") || artifact.sha256 !== hash) {
    failures.push(`SHA-256 mismatch: ${artifact.path}`);
  }
  if (typeof artifact.version !== "string" || !artifact.version.trim()) {
    failures.push(`missing version: ${artifact.path}`);
  }
}

if (failures.length > 0) {
  console.error("[runtime-manifest] verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[runtime-manifest] verified ${manifest.artifacts.length} artifacts`);
