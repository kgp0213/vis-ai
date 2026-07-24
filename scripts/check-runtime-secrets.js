#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const entries = [
  join(root, "src-tauri", "resources", "server", "launcher.mjs"),
  join(root, "src-tauri", "resources", "server", "lib"),
  join(root, "src-tauri", "resources", "server", "visionox-pkg"),
];
const approvedSemanticEndpoint = "http://10.71.4.202:10307/v1/embeddings";
const approvedEndpointFiles = new Set([
  join(root, "src-tauri", "resources", "server", "lib", "semantic-config-defaults.mjs"),
  join(root, "src-tauri", "resources", "server", "lib", "semantic-config-defaults.test.mjs"),
]);
const forbidden = [/10\.71\.4\.202(?::\d+)?/i, /qwen3-embedding-j29c7suqz/i];

function walk(path) {
  if (statSync(path).isDirectory()) return readdirSync(path).flatMap((name) => walk(join(path, name)));
  return [path];
}

const violations = [];
for (const entry of entries) {
  for (const path of walk(entry)) {
    if (!/\.(?:mjs|js|json|md)$/i.test(path)) continue;
    const rawSource = readFileSync(path, "utf8");
    const source = approvedEndpointFiles.has(path)
      ? rawSource.replaceAll(approvedSemanticEndpoint, "[approved-semantic-endpoint]")
      : rawSource;
    for (const pattern of forbidden) {
      if (pattern.test(source)) violations.push(`${path}: ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error("[runtime-secrets] forbidden embedded deployment credential or internal endpoint:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("[runtime-secrets] ok");
