/**
 * Temporarily detach a scheduled prompt from the user's active conversation.
 *
 * The launcher serializes prompt execution, so a history snapshot is enough
 * to keep the scheduled turn from contaminating the active loop while we
 * avoid creating a second model client/loop.  The helper deliberately fails
 * closed when the loop cannot be snapshotted: a scheduled task must never
 * clear user context that it cannot restore.
 */
export function createPromptIsolation(loop, { enabled = false, rebuild } = {}) {
  if (!enabled) return { enabled: false, restore: () => false };
  if (!loop?.log?.toMessages || typeof loop.clearLog !== "function") {
    return {
      enabled: false,
      reason: "active loop history is unavailable",
      restore: () => false,
    };
  }

  let snapshot;
  try {
    snapshot = loop.log.toMessages();
    if (!Array.isArray(snapshot)) throw new TypeError("active loop history is not an array");
    loop.clearLog();
  } catch {
    return {
      enabled: false,
      reason: "active loop history is unavailable",
      restore: () => false,
    };
  }

  let restored = false;
  return {
    enabled: true,
    snapshot,
    snapshotCount: snapshot.length,
    restore() {
      if (restored) return false;
      restored = true;
      try {
        if (typeof loop.adoptHistory === "function") {
          try {
            loop.adoptHistory(snapshot, loop.model);
          } catch {
            if (!loop.log || typeof loop.log.compactInPlace !== "function") throw new Error("history restoration failed");
            loop.log.compactInPlace(snapshot);
          }
        } else if (loop.log && typeof loop.log.compactInPlace === "function") {
          loop.log.compactInPlace(snapshot);
        } else {
          restored = false;
          return false;
        }
        return true;
      } catch {
        try {
          if (typeof rebuild === "function") {
            const rebuilt = rebuild(snapshot);
            if (rebuilt === true) return true;
          }
        } catch {
          // The caller reports the failed restore and keeps the persisted
          // active session as the recovery source.
        }
        restored = false;
        return false;
      }
    },
  };
}
