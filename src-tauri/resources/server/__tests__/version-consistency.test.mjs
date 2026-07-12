import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { checkProductVersions } from "../../../../scripts/check-version-consistency.js";

function fixture(versions) {
  const root = mkdtempSync(join(tmpdir(), "visionox-versions-"));
  mkdirSync(join(root, "src-tauri"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: versions.desktop }));
  writeFileSync(join(root, "src-tauri", "tauri.conf.json"), JSON.stringify({ version: versions.tauri }));
  writeFileSync(join(root, "src-tauri", "Cargo.toml"), `[package]\nversion = "${versions.cargo}"\n`);
  return root;
}

describe("product version consistency", () => {
  it("accepts one version shared by desktop, Tauri and Cargo", () => {
    const root = fixture({ desktop: "1.28.0", tauri: "1.28.0", cargo: "1.28.0" });
    try {
      assert.equal(checkProductVersions(root), "1.28.0");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a partial version bump", () => {
    const root = fixture({ desktop: "1.29.0", tauri: "1.28.0", cargo: "1.28.0" });
    try {
      assert.throws(() => checkProductVersions(root), /version mismatch/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
