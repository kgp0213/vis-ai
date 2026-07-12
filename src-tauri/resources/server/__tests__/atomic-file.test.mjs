import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { atomicWriteFile, atomicWriteFileSync } from "../lib/atomic-file.mjs";

describe("atomic file persistence", () => {
  it("replaces a file synchronously without leaving a sibling temp file", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-atomic-sync-"));
    try {
      const target = join(root, "data.json");
      atomicWriteFileSync(target, "old");
      atomicWriteFileSync(target, "new");
      assert.equal(readFileSync(target, "utf8"), "new");
      assert.deepEqual(readdirSync(root), ["data.json"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("replaces a file asynchronously without leaving a sibling temp file", async () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-atomic-async-"));
    try {
      const target = join(root, "nested", "data.json");
      await atomicWriteFile(target, "old");
      await atomicWriteFile(target, "new");
      assert.equal(readFileSync(target, "utf8"), "new");
      assert.deepEqual(readdirSync(join(root, "nested")), ["data.json"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("removes the sibling temp file when replacement fails", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-atomic-failure-"));
    try {
      const target = join(root, "occupied");
      mkdirSync(target);
      assert.throws(() => atomicWriteFileSync(target, "content"));
      assert.deepEqual(readdirSync(root), ["occupied"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
