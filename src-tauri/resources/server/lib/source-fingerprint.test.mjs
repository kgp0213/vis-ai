import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fingerprintFile, fingerprintPaths, sameSourceFingerprint } from "./source-fingerprint.mjs";

test("source fingerprints include content identity and metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-source-fingerprint-"));
  try {
    const path = join(root, "source.md");
    await writeFile(path, "version one", "utf8");
    const first = await fingerprintFile(path);
    assert.equal(first.path, path);
    assert.equal(first.size, 11);
    assert.match(first.sha256, /^[a-f0-9]{64}$/);
    assert.equal(sameSourceFingerprint(first, { ...first }), true);

    await writeFile(path, "version two", "utf8");
    const second = await fingerprintFile(path);
    assert.notEqual(second.sha256, first.sha256);
    assert.equal(sameSourceFingerprint(first, second), false);
    assert.equal((await fingerprintPaths([path])).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
