#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const forbiddenExtensions = new Set([".map", ".zip", ".bak", ".old"]);
const skippedDirectories = new Set([".git", "node_modules", "target"]);
const localWorkingDirectories = new Set(["bug_report"]);
const allowed = new Set([
  "skills/依赖包/poppler-windows.zip",
]);
const failures = [];

function normalize(path) {
  return path.replaceAll("\\", "/");
}

function scan(path, { skipGenerated = true } = {}) {
  if (!existsSync(path)) return;
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    const stat = statSync(child);
    if (stat.isDirectory()) {
      if (skipGenerated && (skippedDirectories.has(name) || (path === root && localWorkingDirectories.has(name)))) continue;
      scan(child, { skipGenerated });
      continue;
    }
    if (!forbiddenExtensions.has(extname(name).toLowerCase())) continue;
    const projectPath = normalize(relative(root, child));
    if (!allowed.has(projectPath)) failures.push(projectPath);
  }
}

scan(root);
scan(join(root, "src-tauri", "target", "release", "resources"), { skipGenerated: false });

if (failures.length > 0) {
  console.error("[repository-hygiene] unexpected temporary/archive files:");
  for (const path of failures.sort()) console.error(`- ${path}`);
  process.exit(1);
}

console.log("[repository-hygiene] ok");
