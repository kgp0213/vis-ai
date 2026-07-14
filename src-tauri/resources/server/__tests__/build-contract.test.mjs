import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { runTauriBuild, validateBuildArgs } from "../../../../scripts/run-tauri-build.js";
import { writeReleaseManifest } from "../../../../scripts/release-manifest.js";

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
    assert.deepEqual(calls.find((call) => call.label === "write release manifest").args, ["--release-verified"]);
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

  it("invalidates a stale release manifest before running build gates", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-stale-manifest-"));
    const staging = mkdtempSync(join(tmpdir(), "visionox-build-failure-"));
    const manifest = join(root, "src-tauri", "target", "release", "release-manifest.json");
    try {
      mkdirSync(join(root, "src-tauri", "target", "release"), { recursive: true });
      writeFileSync(manifest, "stale");
      assert.throws(() => runTauriBuild({
        root,
        makeStaging: () => staging,
        skipTauriExistenceCheck: true,
        quiet: true,
        runner: () => { throw new Error("injected gate failure"); },
      }), /injected gate failure/);
      assert.equal(existsSync(manifest), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(staging, { recursive: true, force: true });
    }
  });

  it("rejects debug builds and custom target directories", () => {
    assert.throws(() => validateBuildArgs(["--debug"]), /debug builds are forbidden/);
    assert.throws(() => validateBuildArgs(["--target-dir", "elsewhere"]), /target directories are forbidden/);
  });

  it("records verified release and NSIS artifacts from the actual output tree", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-release-manifest-"));
    const release = join(root, "src-tauri", "target", "release");
    const resources = join(release, "resources");
    const runtimePath = join(resources, "server", "node.exe");
    const bundlePath = join(resources, "server", "visionox-pkg", "dist", "cli", "server-test.js");
    const installerPath = join(release, "bundle", "nsis", "Visionox-Whale_1.28.0_x64-setup.exe");
    const sha256 = (value) => createHash("sha256").update(value).digest("hex");
    try {
      mkdirSync(join(root, "src-tauri"), { recursive: true });
      mkdirSync(join(resources, "server", "visionox-pkg", "dist", "cli"), { recursive: true });
      mkdirSync(join(release, "bundle", "nsis"), { recursive: true });
      writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.28.0" }));
      writeFileSync(join(root, "src-tauri", "tauri.conf.json"), JSON.stringify({ productName: "Visionox-Whale", version: "1.28.0" }));
      writeFileSync(join(release, "visionox-whale.exe"), "release-exe");
      writeFileSync(installerPath, "installer");
      writeFileSync(runtimePath, "node-runtime");
      writeFileSync(bundlePath, 'const meta = { buildDate: "260714 22" };');
      writeFileSync(join(resources, "runtime-manifest.json"), JSON.stringify({
        schemaVersion: 1,
        artifacts: [{
          path: "server/node.exe",
          version: "v-test",
          bytes: Buffer.byteLength("node-runtime"),
          sha256: sha256("node-runtime"),
        }],
      }));

      const manifest = writeReleaseManifest({
        root,
        releaseVerified: true,
        includeNsis: true,
        nsisVerified: true,
        now: new Date("2026-07-14T14:00:00.000Z"),
      });
      const written = JSON.parse(readFileSync(join(release, "release-manifest.json"), "utf8"));
      assert.equal(manifest.build.stamp, "260714 22");
      assert.equal(manifest.build.git.available, false);
      assert.equal(manifest.verification.releaseResources, true);
      assert.equal(manifest.verification.nsisBundle, true);
      assert.equal(manifest.artifacts.runtimes[0].version, "v-test");
      assert.equal(manifest.artifacts.installer.bytes, Buffer.byteLength("installer"));
      assert.deepEqual(written, manifest);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
