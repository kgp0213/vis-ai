const TERMINAL_STATES = new Set([
  "completed", "completed_with_warnings", "succeeded", "failed", "cancelled", "canceled",
  "unknown", "incomplete", "lost", "timed_out", "killed", "verified", "unverified",
  "interrupted", "resolved", "dismissed", "not_applied", "expired",
]);

const STATE_RANK = Object.freeze({
  unknown: 1,
  unverified: 1,
  incomplete: 2,
  failed: 3,
  cancelled: 3,
  canceled: 3,
  lost: 3,
  timed_out: 3,
  killed: 3,
  interrupted: 3,
  completed_with_warnings: 4,
  completed: 5,
  succeeded: 5,
  verified: 5,
  resolved: 5,
  dismissed: 5,
  not_applied: 5,
  expired: 5,
});

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isTerminalState(value) {
  return TERMINAL_STATES.has(normalize(value));
}

export function terminalStateRank(value) {
  return STATE_RANK[normalize(value)] ?? 0;
}

/**
 * Terminal facts are monotonic by confidence. Unknown/incomplete cold
 * recovery facts may be repaired by a later explicit fact; a confirmed
 * completion cannot be silently downgraded. Corrections must carry a
 * revision/correction marker so warning metadata can be appended safely.
 */
export function terminalStateTransition(current, next, { correction = false, toolRecovery = false } = {}) {
  const before = normalize(current) || "running";
  const after = normalize(next) || before;
  if (!isTerminalState(before)) return { state: after, changed: before !== after, accepted: true };
  if (before === after) return { state: before, changed: false, accepted: true };
  if (toolRecovery && before === "failed" && ["queued", "running", "recovered"].includes(after)) {
    return { state: after, changed: true, accepted: true };
  }
  const beforeRank = terminalStateRank(before);
  const afterRank = terminalStateRank(after);
  if (beforeRank <= 2 && afterRank > beforeRank) return { state: after, changed: true, accepted: true, repaired: true };
  if (before === "completed" && after === "completed_with_warnings" && correction) {
    return { state: after, changed: true, accepted: true, corrected: true };
  }
  if (before === "succeeded" && after === "completed_with_warnings" && correction) {
    return { state: after, changed: true, accepted: true, corrected: true };
  }
  return { state: before, changed: false, accepted: false };
}

export { TERMINAL_STATES as EXECUTION_TERMINAL_STATES, STATE_RANK as EXECUTION_STATE_RANK };
