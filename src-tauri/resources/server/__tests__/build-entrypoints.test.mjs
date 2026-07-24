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

test("release Rust tests use the prepared runtime from a temporary directory", () => {
  const releaseCheck = readFileSync(new URL("../../../../scripts/release-check.js", import.meta.url), "utf8");
  assert.match(releaseCheck, /visionox-rust-runtime-/);
  assert.match(releaseCheck, /scripts\/prepare-runtime-package\.js/);
  assert.match(releaseCheck, /CARGO_BUILD_JOBS:\s*process\.env\.CARGO_BUILD_JOBS\s*\|\|\s*"1"/);
  assert.match(releaseCheck, /VISIONOX_RUNTIME_PACKAGE: runtimePackage/);
  assert.match(releaseCheck, /TAURI_CONFIG: JSON\.stringify\(resourceOverride\)/);
  assert.match(releaseCheck, /removeTempPath\(stagingRoot, "isolated Rust runtime"\)/);
});

test("release guard keeps the canonical release build within the same bounded Cargo concurrency", () => {
  const releaseCheck = readFileSync(new URL("../../../../scripts/release-check.js", import.meta.url), "utf8");
  assert.match(releaseCheck, /const releaseCargoEnv = \{[\s\S]*CARGO_BUILD_JOBS:\s*process\.env\.CARGO_BUILD_JOBS\s*\|\|\s*"1"/);
  assert.match(releaseCheck, /run\("tauri no-bundle build"[\s\S]*releaseCargoEnv\);/);
});

test("release guard validates the injected build stamp without rewriting the vendored package version", () => {
  const releaseCheck = readFileSync(new URL("../../../../scripts/release-check.js", import.meta.url), "utf8");
  assert.match(releaseCheck, /checkReleaseBuildStamp/);
  assert.match(releaseCheck, /valid YYMMDD HH build stamp/);
  assert.doesNotMatch(releaseCheck, /expected UI Ver/);
  assert.doesNotMatch(releaseCheck, /pkg\.version !== expected/);
});

test("third-party inventory tracks the actual vendored Reasonix package version", () => {
  const inventory = JSON.parse(readFileSync(new URL("../../../../src-tauri/resources/third-party-resources.json", import.meta.url), "utf8"));
  const reasonixPackage = JSON.parse(readFileSync(new URL("../visionox-pkg/package.json", import.meta.url), "utf8"));
  const notices = readFileSync(new URL("../../../../src-tauri/resources/THIRD_PARTY_NOTICES.md", import.meta.url), "utf8");
  assert.equal(inventory.resources.find((resource) => resource.id === "reasonix")?.version, reasonixPackage.version);
  assert.match(notices, new RegExp(`Version: ${reasonixPackage.version}`));
});

test("OfficeCLI receives a longer MCP request timeout without changing other servers", () => {
  const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
  assert.match(launcher, /OFFICECLI_MCP_REQUEST_TIMEOUT_MS:\s*180_000/);
  assert.match(launcher, /requestTimeoutMs:\s*mcpRequestTimeoutMs\(spec\.name\)/);
  assert.match(launcher, /serverName === "officecli"\s*\?\s*CONSTANTS\.OFFICECLI_MCP_REQUEST_TIMEOUT_MS\s*:\s*undefined/);
});
