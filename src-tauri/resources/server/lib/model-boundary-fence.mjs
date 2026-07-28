/**
 * Keeps non-model inputs behind a compaction boundary. This is deliberately a
 * small lifecycle fact store: it never dispatches prompts or changes model
 * history by itself.
 */
export function createModelBoundaryFence({ now = () => new Date().toISOString(), maxQueued = 64 } = {}) {
  const states = new Map();
  let sequence = 0;

  function state(operationId) {
    const id = String(operationId ?? "").trim();
    if (!id) return null;
    if (!states.has(id)) states.set(id, {
      operationId: id,
      compacting: false,
      queue: [],
      overflowed: [],
      overflowCount: 0,
    });
    return states.get(id);
  }

  function begin(operationId, reason = "compaction") {
    const current = state(operationId);
    if (!current) return null;
    current.compacting = true;
    current.reason = String(reason || "compaction").slice(0, 120);
    current.startedAt = now();
    return snapshot(operationId);
  }

  function enqueue(operationId, { type = "input", entityId = null } = {}) {
    const current = state(operationId);
    if (!current) return null;
    const entry = {
      sequence: ++sequence,
      type: String(type || "input").slice(0, 80),
      entityId: entityId ? String(entityId).slice(0, 200) : null,
      queuedAt: now(),
    };
    const limit = Math.max(1, Number(maxQueued) || 64);
    current.queue.push(entry);
    if (current.queue.length > limit) {
      const dropped = current.queue.shift();
      if (dropped) {
        current.overflowCount += 1;
        current.overflowed.push({ ...dropped, overflowedAt: now() });
        if (current.overflowed.length > limit) current.overflowed.shift();
      }
    }
    return { ...entry };
  }

  function open(operationId) {
    const current = state(operationId);
    if (!current) return { compacting: false, queued: [], overflowed: [], overflowCount: 0 };
    // A request boundary closes the fence before any input is admitted. The
    // caller then performs the normal FIFO promotion/claim operations.
    const queued = current.queue.slice().sort((a, b) => a.sequence - b.sequence);
    const overflowed = current.overflowed.slice().sort((a, b) => a.sequence - b.sequence);
    const overflowCount = current.overflowCount;
    current.queue = [];
    current.overflowed = [];
    current.overflowCount = 0;
    const wasCompacting = current.compacting;
    current.compacting = false;
    return {
      compacting: wasCompacting,
      queued: queued.map((entry) => ({ ...entry })),
      overflowed: overflowed.map((entry) => ({ ...entry })),
      overflowCount,
    };
  }

  function close(operationId, { reason = "operation_finished", status = "not_applied" } = {}) {
    const current = state(operationId);
    if (!current) return [];
    const closed = [...current.overflowed, ...current.queue].map((entry) => ({
      ...entry,
      status: String(status || "not_applied"),
      resolution: { resolvedAt: now(), reason: String(reason || "operation_finished").slice(0, 160) },
    }));
    states.delete(String(operationId));
    return closed;
  }

  function snapshot(operationId) {
    const id = String(operationId ?? "").trim();
    const current = states.get(id);
    if (!current) return null;
    return {
      operationId: current.operationId,
      compacting: current.compacting,
      reason: current.reason ?? null,
      startedAt: current.startedAt ?? null,
      queued: current.queue.map((entry) => ({ ...entry })),
      overflowed: current.overflowed.map((entry) => ({ ...entry })),
      overflowCount: current.overflowCount,
    };
  }

  return { begin, close, enqueue, open, snapshot };
}

/**
 * Resolve boundary sequence facts to the concrete entities that can be
 * delivered at the next ordinary model request. Queue-delivery prompts are
 * intentionally deferred to the next operation; they must not be injected
 * into the operation that happened to admit them while busy.
 */
export function projectBoundaryDeliveries({
  entries = [],
  overflowed = [],
  overflowCount = null,
  steering = [],
  sessionInputs = [],
  notifications = [],
} = {}) {
  const byType = new Map([
    ["steering", new Map((Array.isArray(steering) ? steering : []).map((item) => [String(item?.id ?? ""), item]))],
    ["steer", new Map((Array.isArray(sessionInputs) ? sessionInputs : []).map((item) => [String(item?.id ?? ""), item]))],
    ["background", new Map((Array.isArray(notifications) ? notifications : []).map((item) => [String(item?.notificationId ?? ""), item]))],
  ]);
  const items = [];
  const anomalies = [];
  let resultUnknown = false;
  const consumed = new Set();
  const orderedEntries = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && Number.isSafeInteger(Number(entry.sequence)))
    .map((entry) => ({ ...entry, sequence: Number(entry.sequence) }))
    .sort((left, right) => left.sequence - right.sequence);
  const overflowEntries = Array.isArray(overflowed) ? overflowed : [];
  const hasOverflowCount = overflowCount !== null
    && overflowCount !== undefined
    && Number.isSafeInteger(Number(overflowCount));
  const droppedCount = Math.max(0, hasOverflowCount
    ? Number(overflowCount)
    : overflowEntries.length);
  if (droppedCount > 0) {
    const first = overflowEntries[0];
    anomalies.push({
      code: "boundary_queue_overflow",
      type: String(first?.type ?? "").trim(),
      entityId: String(first?.entityId ?? "").trim(),
      sequence: Number.isSafeInteger(Number(first?.sequence)) ? Number(first.sequence) : null,
      count: droppedCount,
    });
    resultUnknown = true;
    // The journal no longer proves the order of the surviving entries. Fail
    // closed instead of injecting a newer input before an older one.
    return { items: [], anomalies, resultUnknown, blocked: true };
  }

  for (const entry of orderedEntries) {
    const type = String(entry.type ?? "").trim();
    const entityId = String(entry.entityId ?? "").trim();
    if (type === "queue") {
      anomalies.push({ code: "boundary_delivery_deferred", type, entityId, sequence: entry.sequence });
      continue;
    }
    const source = byType.get(type);
    if (!source) {
      anomalies.push({ code: "boundary_delivery_unsupported", type, entityId, sequence: entry.sequence });
      resultUnknown = true;
      continue;
    }
    const key = `${type}:${entityId}`;
    if (consumed.has(key)) {
      anomalies.push({ code: "boundary_delivery_duplicate", type, entityId, sequence: entry.sequence });
      continue;
    }
    const payload = source.get(entityId);
    if (!payload) {
      anomalies.push({ code: "boundary_delivery_missing", type, entityId, sequence: entry.sequence });
      resultUnknown = true;
      continue;
    }
    consumed.add(key);
    items.push({ type, entityId, sequence: entry.sequence, payload });
  }

  // Recovery can restore a durable input or notification after the fence was
  // opened. Preserve it rather than silently dropping it, but expose that its
  // relative order is no longer provable from the boundary journal.
  for (const [type, source] of byType) {
    for (const [entityId, payload] of source) {
      const key = `${type}:${entityId}`;
      if (consumed.has(key)) continue;
      items.push({ type, entityId, sequence: null, payload });
      anomalies.push({ code: "boundary_delivery_unsequenced", type, entityId });
      resultUnknown = true;
    }
  }
  return { items, anomalies, resultUnknown, blocked: false };
}
