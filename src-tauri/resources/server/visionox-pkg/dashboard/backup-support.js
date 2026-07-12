(function attachVisionoxBackupPolicy(root) {
  function normalizeRetentionCount(value, fallback = 10) {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(1, Math.min(100, Math.floor(count))) : fallback;
  }

  function restoreActions(counts = {}) {
    return {
      canRestoreMissing: Number(counts.missing) > 0,
      canOverwriteConflicts: Number(counts.conflict) > 0 && Number(counts.corrupt) === 0 && Number(counts.invalid) === 0,
    };
  }

  root.VisionoxBackupPolicy = Object.freeze({ normalizeRetentionCount, restoreActions });
})(globalThis);
