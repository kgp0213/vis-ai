import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateBuildEntrypoints } from "../../../../scripts/check-build-entrypoints.js";

test("repository keeps debug development separate from the canonical release build", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"));
  assert.deepEqual(validateBuildEntrypoints(pkg), []);
});

test("guard rejects unprepared debug and wrapper-bypassing scripts", () => {
  const failures = validateBuildEntrypoints({ scripts: {
    tauri: "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    debug: "cargo build",
  } });
  assert.ok(failures.some((failure) => failure.includes("canonical wrapper")));
  assert.ok(failures.some((failure) => failure.includes("prepare the runtime")));
  assert.ok(failures.some((failure) => failure.includes("debug bypasses")));
});
