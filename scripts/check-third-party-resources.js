#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const resourcesDir = join(root, "src-tauri", "resources");
const manifest = JSON.parse(readFileSync(join(resourcesDir, "runtime-manifest.json"), "utf8"));
const inventory = JSON.parse(readFileSync(join(resourcesDir, "third-party-resources.json"), "utf8"));
const failures = [];
const binaryByPath = new Map(manifest.artifacts.map((item) => [item.path, item]));
for (const resource of inventory.resources ?? []) {
  if (!resource.id || !resource.path || !resource.version || !resource.source || !resource.license) failures.push(`incomplete inventory entry: ${resource.id || "unknown"}`);
  if (resource.sha256) {
    const binary = binaryByPath.get(resource.path);
    if (!binary) failures.push(`${resource.id}: binary is missing from runtime-manifest.json`);
    else if (binary.version !== resource.version || binary.sha256 !== resource.sha256) failures.push(`${resource.id}: version or SHA-256 differs from runtime manifest`);
  }
  if (resource.licenseFile && !existsSync(join(resourcesDir, resource.licenseFile))) failures.push(`${resource.id}: missing license file ${resource.licenseFile}`);
}
for (const binary of manifest.artifacts) {
  if (!(inventory.resources ?? []).some((resource) => resource.path === binary.path && resource.sha256 === binary.sha256)) failures.push(`${binary.path}: missing third-party inventory entry`);
}
if (!existsSync(join(resourcesDir, "THIRD_PARTY_NOTICES.md"))) failures.push("THIRD_PARTY_NOTICES.md is missing");
if (failures.length) {
  console.error("[third-party] failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`[third-party] ok: ${inventory.resources.length} resources`);
