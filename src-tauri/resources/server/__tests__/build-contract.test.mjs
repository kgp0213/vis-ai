import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { runTauriBuild, validateBuildArgs } from "../../../../scripts/run-tauri-build.js";

describe("release build contract", () => {
  it("forces offline release paths and cleans staging after success", () => {
    const staging = mkdtempSync(join(tmpdir(), "visionox-build-contract-"));
    const calls = [];
    const result = runTauriBuild({
      args: ["--no-bundle"],
      makeStaging: () => staging,
      skipTauriExistenceCheck: true,
      quiet: true,
      runner: (label, script, args, env) => calls.push({ label, script, args, env }),
    });
    assert.equal(result.env.CARGO_NET_OFFLINE, "true");
    assert.equal(result.env.npm_config_offline, "true");
    assert.match(result.env.CARGO_TARGET_DIR, /src-tauri[\\/]target$/);
    assert.equal(result.env.CARGO_TARGET_DIR.endsWith(join("target", "debug")), false);
    assert.equal(calls.find((call) => call.label === "build release").args.includes("--no-bundle"), true);
    assert.equal(existsSync(staging), false);
  });

  it("cleans staging when a pre-build gate fails", () => {
    const staging = mkdtempSync(join(tmpdir(), "visionox-build-failure-"));
    assert.throws(() => runTauriBuild({
      makeStaging: () => staging,
      skipTauriExistenceCheck: true,
      quiet: true,
      runner: (label) => {
        if (label === "prepare runtime package") throw new Error("injected gate failure");
      },
    }), /injected gate failure/);
    assert.equal(existsSync(staging), false);
  });

  it("rejects debug builds and custom target directories", () => {
    assert.throws(() => validateBuildArgs(["--debug"]), /debug builds are forbidden/);
    assert.throws(() => validateBuildArgs(["--target-dir", "elsewhere"]), /target directories are forbidden/);
  });
});
