import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateBuildEntrypoints } from "../../../../scripts/check-build-entrypoints.js";

test("repository exposes only the canonical release build entrypoint", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"));
  assert.deepEqual(validateBuildEntrypoints(pkg), []);
});

test("guard rejects debug and wrapper-bypassing scripts", () => {
  const failures = validateBuildEntrypoints({ scripts: {
    tauri: "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    debug: "cargo build",
  } });
  assert.ok(failures.some((failure) => failure.includes("canonical wrapper")));
  assert.ok(failures.some((failure) => failure.includes("tauri:dev")));
  assert.ok(failures.some((failure) => failure.includes("debug bypasses")));
});
