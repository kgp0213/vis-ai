#!/usr/bin/env node

import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const limits = new Map([
  ["src-tauri/resources/server/__tests__/api.test.mjs", 48_000],
  ["src-tauri/resources/server/__tests__/dashboard-regression.test.mjs", 53_000],
]);
const requiredDomainTests = [
  "active-session-meta.test.mjs",
  "active-session.test.mjs",
  "api-contracts.test.mjs",
  "index-mode-support.test.mjs",
  "overview-alerts-support.test.mjs",
  "launcher-storage-policy.test.mjs",
  "prompt-queue-store.test.mjs",
  "runtime-issues.test.mjs",
  "schedule-execution.test.mjs",
  "user-data-backup.test.mjs",
  "session-trash.test.mjs",
  "session-knowledge.test.mjs",
  "skill-availability.test.mjs",
  "memory-trash.test.mjs",
];
const failures = [];
for (const [relative, maxBytes] of limits) {
  const bytes = statSync(join(root, relative)).size;
  if (bytes > maxBytes) failures.push(`${relative} grew to ${bytes} bytes (limit ${maxBytes}); move new coverage to a domain test file`);
}
for (const name of requiredDomainTests) {
  const path = join(root, "src-tauri", "resources", "server", "__tests__", name);
  if (!existsSync(path)) failures.push(`missing domain test: ${name}`);
}
if (failures.length) {
  console.error("[test-structure] failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("[test-structure] ok");
