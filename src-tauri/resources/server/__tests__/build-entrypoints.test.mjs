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

test("release verifier covers every top-level governance resource bundled by Tauri", () => {
  const tauri = JSON.parse(readFileSync(new URL("../../../../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  const verifier = readFileSync(new URL("../../../../scripts/verify-release-resources.js", import.meta.url), "utf8");
  const names = [
    "runtime-manifest.json",
    "third-party-resources.json",
    "bootstrap-skills-provenance.json",
    "THIRD_PARTY_NOTICES.md",
  ];

  for (const name of names) {
    assert.equal(tauri.bundle.resources[`resources/${name}`], `resources/${name}`);
    assert.match(verifier, new RegExp(name.replaceAll(".", "\\.")));
  }
});
