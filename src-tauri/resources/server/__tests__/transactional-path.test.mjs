import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { replacePathTransactional, restoreLatestPathHistory } from "../lib/transactional-path.mjs";

function writeVersion(path, value) {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "version.txt"), value, "utf8");
}

describe("transactional path replacement", () => {
  it("replaces a directory and keeps only the configured history", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-path-transaction-"));
    try {
      const target = join(root, "skill");
      writeVersion(target, "one");
      for (const value of ["two", "three", "four"]) {
        const staging = join(root, `stage-${value}`);
        writeVersion(staging, value);
        replacePathTransactional(target, staging, { retain: 2 });
      }
      assert.equal(readFileSync(join(target, "version.txt"), "utf8"), "four");
      assert.equal(readdirSync(root).filter((name) => name.startsWith("skill.history-")).length, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("restores the previous directory when staging activation fails", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-path-rollback-"));
    try {
      const target = join(root, "skill");
      const staging = join(root, "stage");
      writeVersion(target, "stable");
      writeVersion(staging, "broken");
      let calls = 0;
      assert.throws(() => replacePathTransactional(target, staging, {
        rename: (from, to) => {
          calls++;
          if (calls === 2) throw new Error("activation failed");
          renameSync(from, to);
        },
      }), /activation failed/);
      assert.equal(readFileSync(join(target, "version.txt"), "utf8"), "stable");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("restores the latest retained version while keeping the replaced version recoverable", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-path-history-restore-"));
    try {
      const target = join(root, "skill");
      writeVersion(target, "one");
      const staging = join(root, "stage-two");
      writeVersion(staging, "two");
      replacePathTransactional(target, staging, { retain: 3 });
      const restored = restoreLatestPathHistory(target, { retain: 3 });
      assert.equal(readFileSync(join(target, "version.txt"), "utf8"), "one");
      assert.match(restored.restoredFrom, /skill\.history-/);
      assert.equal(readdirSync(root).filter((name) => name.startsWith("skill.history-")).length, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
