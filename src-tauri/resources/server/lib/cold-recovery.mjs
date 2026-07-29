const ACTIVE_STATES = new Set(["queued", "starting", "running", "stopping", "active", "admitted", "promoted", "dispatching"]);
const TERMINAL_STATES = new Set([
  "completed", "completed_with_warnings", "succeeded", "failed", "cancelled", "canceled", "unknown", "incomplete", "lost", "timed_out", "killed", "applied", "not_applied", "expired", "interrupted", "resolved", "answered", "dismissed",
]);

function text(value) { return String(value ?? "").trim(); }

function clone(value) {
  try { return structuredClone(value); } catch { return value; }
}

function active(value) {
  return ACTIVE_STATES.has(text(value).toLowerCase());
}

function alreadyTerminal(value) {
  return TERMINAL_STATES.has(text(value).toLowerCase());
}

function markUnknown(entity, reason) {
  const next = { ...entity, state: "unknown", status: "unknown", recoveryReason: reason };
  return next;
}

function markMessageUnknown(entity, reason) {
  return {
    ...entity,
    executionState: "unknown",
    taskState: "unknown",
    finalized: entity.finalized === true ? true : false,
    recoveryReason: reason,
  };
}

function recoverCollection(snapshot, key, predicate, transform, changes, warnings) {
  if (!Array.isArray(snapshot[key])) return;
  snapshot[key] = snapshot[key].map((entity) => {
    if (!entity || !predicate(entity)) return entity;
    const id = text(entity.id ?? entity.toolCallId ?? entity.interactionId ?? entity.notificationId) || "unknown";
    const recoveryFactId = `recovery:${key}:${id}`;
    const next = { ...transform(entity), recoveryFactId, recoveryRevision: 1 };
    changes.push({ collection: key, entityId: id, recoveryFactId, from: entity.state ?? entity.status, to: next.state ?? next.status });
    warnings.push(`${key} ${id} was converged after process recovery`);
    return next;
  });
}

/**
 * Converts volatile in-flight facts to explicit cold-recovery states. It
 * never returns a dispatch instruction and never recreates a side effect.
 */
export function recoverColdSnapshotEntities(input = {}, { reason = "process_restarted" } = {}) {
  const snapshot = clone(input && typeof input === "object" ? input : {});
  const changes = [];
  const warnings = [];

  for (const key of ["operation", "admission"]) {
    const entity = snapshot[key];
    if (!entity || typeof entity !== "object") continue;
    if (key === "admission") {
      if (entity.active !== true && entity.busy !== true && !active(entity.state ?? entity.status)) continue;
      const id = text(entity.id) || "unknown";
      const recoveryFactId = `recovery:${key}:${id}`;
      snapshot[key] = { ...entity, active: false, busy: false, state: "unknown", status: "unknown", recoveryReason: reason, recoveryFactId, recoveryRevision: 1 };
      changes.push({ collection: key, entityId: id, recoveryFactId, from: "active", to: "unknown" });
      warnings.push(`admission ${text(entity.id) || "unknown"} was converged after process recovery`);
      continue;
    }
    if (!active(entity.state ?? entity.status)) continue;
    const id = text(entity.id) || "unknown";
    const recoveryFactId = `recovery:${key}:${id}`;
    snapshot[key] = { ...markUnknown(entity, reason), recoveryFactId, recoveryRevision: 1 };
    changes.push({ collection: key, entityId: id, recoveryFactId, from: entity.state ?? entity.status, to: "unknown" });
    warnings.push(`operation ${text(entity.id) || "unknown"} was marked unknown after process recovery`);
  }

  for (const key of ["turns", "steps", "tools"]) {
    recoverCollection(snapshot, key, (entity) => active(entity?.state ?? entity?.status), (entity) => markUnknown(entity, reason), changes, warnings);
  }

  recoverCollection(snapshot, "messages", (entity) => {
    if (text(entity?.role).toLowerCase() !== "assistant") return false;
    const state = entity?.state ?? entity?.executionState ?? entity?.taskState ?? entity?.status;
    return active(state) || (text(entity?.operationId) && entity?.finalized !== true);
  }, (entity) => markMessageUnknown(entity, reason), changes, warnings);

  recoverCollection(snapshot, "interactions", (entity) => {
    const state = text(entity?.state ?? entity?.status).toLowerCase();
    return state === "pending" || state === "active" || state === "awaiting_approval";
  }, (entity) => ({ ...entity, state: "interrupted", status: "interrupted", recoveryReason: reason }), changes, warnings);

  recoverCollection(snapshot, "prompts", (entity) => {
    const status = text(entity?.status ?? entity?.state).toLowerCase();
    return ["queued", "admitted", "promoted", "dispatching"].includes(status);
  }, (entity) => ({
    ...entity,
    status: "not_applied",
    resolution: { ...(entity.resolution ?? {}), reason: "process_restarted_before_model_boundary", recoveryReason: reason },
  }), changes, warnings);

  recoverCollection(snapshot, "taskNotifications", (entity) => {
    const state = text(entity?.state ?? entity?.status).toLowerCase();
    return active(state) && !alreadyTerminal(state);
  }, (entity) => ({ ...entity, state: "lost", status: "lost", recoveryReason: reason }), changes, warnings);

  return { snapshot, changes, warnings };
}
