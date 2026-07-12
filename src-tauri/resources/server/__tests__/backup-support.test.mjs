import { after, before, test } from "node:test";
import assert from "node:assert/strict";

before(async () => import("../visionox-pkg/dashboard/backup-support.js"));
after(() => delete globalThis.VisionoxBackupPolicy);

test("backup UI policy normalizes retention without accepting destructive extremes", () => {
  assert.equal(globalThis.VisionoxBackupPolicy.normalizeRetentionCount("5"), 5);
  assert.equal(globalThis.VisionoxBackupPolicy.normalizeRetentionCount(0), 1);
  assert.equal(globalThis.VisionoxBackupPolicy.normalizeRetentionCount(1000), 100);
  assert.equal(globalThis.VisionoxBackupPolicy.normalizeRetentionCount("bad"), 10);
});

test("backup UI policy only enables integrity-safe restore actions", () => {
  assert.deepEqual(globalThis.VisionoxBackupPolicy.restoreActions({ missing: 1, conflict: 2, corrupt: 0, invalid: 0 }), {
    canRestoreMissing: true,
    canOverwriteConflicts: true,
  });
  assert.equal(globalThis.VisionoxBackupPolicy.restoreActions({ conflict: 1, corrupt: 1 }).canOverwriteConflicts, false);
});
