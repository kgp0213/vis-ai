import { randomUUID } from "node:crypto";

const TERMINAL_STATES = new Set(["resolved", "cancelled", "interrupted", "expired"]);
const VALID_STATES = new Set(["pending", ...TERMINAL_STATES]);
const SAFE_RESOLUTION_FIELDS = ["action", "choice", "type", "reason"];

function textOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeResolution(value, fallbackReason = null) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  for (const field of SAFE_RESOLUTION_FIELDS) {
    const normalized = textOrNull(source[field]);
    if (normalized) result[field] = normalized.slice(0, 120);
  }
  if (Object.keys(result).length === 0 && fallbackReason) result.reason = fallbackReason;
  return Object.keys(result).length > 0 ? result : null;
}

function safeRecord(value) {
  if (!value || typeof value !== "object") return null;
  const interactionId = textOrNull(value.interactionId);
  const kind = textOrNull(value.kind);
  const status = VALID_STATES.has(value.status) ? value.status : null;
  const createdAt = textOrNull(value.createdAt);
  if (!interactionId || !kind || !status || !createdAt) return null;
  const gateId = Number.isInteger(value.gateId) && value.gateId >= 0 ? value.gateId : null;
  return {
    interactionId,
    operationId: textOrNull(value.operationId),
    sessionId: textOrNull(value.sessionId),
    workspace: textOrNull(value.workspace),
    kind,
    gateId,
    status,
    createdAt,
    updatedAt: textOrNull(value.updatedAt) || createdAt,
    resolution: safeResolution(value.resolution),
  };
}

function projection(record) {
  const safe = safeRecord(record);
  return safe ? structuredClone(safe) : null;
}

/**
 * Tracks user interactions without owning or replaying the command that caused
 * them. The caller remains responsible for resolving the ordinary pause gate.
 */
export function createInteractionRuntime({
  initial = [],
  getOperationId = () => null,
  getSessionId = () => null,
  getWorkspace = () => null,
  idFactory = randomUUID,
  now = () => new Date().toISOString(),
  persist = async () => {},
  onEvent = () => {},
  onError = (error) => console.error(`[interaction-runtime] ${error?.message || error}`),
  maxRecords = 64,
} = {}) {
  const records = [];
  let writeChain = Promise.resolve();

  function emit(record) {
    const interaction = projection(record);
    if (interaction) onEvent({ kind: "interaction-change", interaction });
  }

  function snapshots() {
    return records.map(projection).filter(Boolean);
  }

  function schedulePersist() {
    const value = snapshots();
    writeChain = writeChain.then(() => persist(value)).catch(onError);
  }

  function trim() {
    if (records.length <= maxRecords) return;
    const pending = records.filter((record) => record.status === "pending");
    const terminal = records.filter((record) => record.status !== "pending");
    const keepTerminal = Math.max(0, maxRecords - pending.length);
    records.splice(0, records.length, ...terminal.slice(-keepTerminal), ...pending);
  }

  for (const value of Array.isArray(initial) ? initial : []) {
    const restored = safeRecord(value);
    if (!restored) continue;
    if (restored.status === "pending") {
      restored.status = "interrupted";
      restored.updatedAt = now();
      restored.resolution = { reason: "process_restarted" };
    }
    records.push(restored);
    if (value.status === "pending") emit(restored);
  }
  trim();
  if (records.some((record) => record.resolution?.reason === "process_restarted")) schedulePersist();

  function uniqueId() {
    let candidate = textOrNull(idFactory()) || randomUUID();
    let suffix = 1;
    while (records.some((record) => record.interactionId === candidate)) {
      candidate = `${candidate}-${suffix++}`;
    }
    return candidate;
  }

  function create(modal, scope = {}) {
    if (!modal || typeof modal !== "object") throw new TypeError("interaction modal is required");
    const kind = textOrNull(modal.kind);
    if (!kind) throw new TypeError("interaction kind is required");
    const createdAt = now();
    const record = {
      interactionId: uniqueId(),
      operationId: textOrNull(scope.operationId) || textOrNull(getOperationId()),
      sessionId: textOrNull(scope.sessionId) || textOrNull(getSessionId()),
      workspace: textOrNull(scope.workspace) || textOrNull(getWorkspace()),
      kind,
      gateId: Number.isInteger(modal._gateId) && modal._gateId >= 0 ? modal._gateId : null,
      status: "pending",
      createdAt,
      updatedAt: createdAt,
      resolution: null,
      modal: structuredClone(modal),
    };
    records.push(record);
    trim();
    schedulePersist();
    emit(record);
    return { ...projection(record), modal: structuredClone(record.modal) };
  }

  function find(id) {
    return records.find((record) => record.interactionId === id) ?? null;
  }

  function transition(record, status, resolution = null) {
    if (!record || record.status !== "pending") return false;
    record.status = status;
    record.updatedAt = now();
    record.resolution = safeResolution(resolution, status);
    delete record.modal;
    schedulePersist();
    emit(record);
    return true;
  }

  function resolve(interactionId, resolution = {}) {
    const record = find(interactionId);
    if (!record) return { ok: false, reason: "interaction_not_found" };
    if (record.status !== "pending") {
      return { ok: true, idempotent: true, interaction: projection(record) };
    }
    transition(record, "resolved", resolution);
    return { ok: true, idempotent: false, interaction: projection(record) };
  }

  function resolveByGate(gateId, resolution = {}) {
    const matches = records.filter((record) => record.gateId === gateId);
    const record = matches.at(-1);
    return record ? resolve(record.interactionId, resolution) : { ok: false, reason: "interaction_not_found" };
  }

  function matchesScope(record, scope) {
    if (scope.operationId && record.operationId !== scope.operationId) return false;
    if (scope.sessionId && record.sessionId !== scope.sessionId) return false;
    if (scope.workspace && record.workspace !== scope.workspace) return false;
    return true;
  }

  function cancelScope(scope = {}, reason = "scope_cancelled") {
    let count = 0;
    for (const record of records) {
      if (record.status !== "pending" || !matchesScope(record, scope)) continue;
      if (transition(record, "cancelled", { reason })) count += 1;
    }
    return count;
  }

  function close(interactionId, reason = "user_closed") {
    const record = find(interactionId);
    if (!record) return { ok: false, reason: "interaction_not_found" };
    if (record.status !== "pending") return { ok: true, idempotent: true, interaction: projection(record) };
    transition(record, "cancelled", { reason });
    return { ok: true, idempotent: false, interaction: projection(record) };
  }

  function expirePending({ maxAgeMs, currentTime = Date.parse(now()) } = {}) {
    if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) throw new TypeError("interaction maxAgeMs must be non-negative");
    let count = 0;
    for (const record of records) {
      if (record.status !== "pending") continue;
      const createdTime = Date.parse(record.createdAt);
      if (!Number.isFinite(createdTime) || currentTime - createdTime <= maxAgeMs) continue;
      if (transition(record, "expired", { reason: "interaction_expired" })) count += 1;
    }
    return count;
  }

  function list(scope = {}) {
    return records.filter((record) => matchesScope(record, scope)).map(projection);
  }

  function getActive(scope = {}) {
    const record = records.findLast((candidate) => candidate.status === "pending" && matchesScope(candidate, scope));
    return record ? { ...projection(record), modal: structuredClone(record.modal) } : null;
  }

  function restore(values, { replaceSessionId = null } = {}) {
    if (replaceSessionId) {
      for (let index = records.length - 1; index >= 0; index -= 1) {
        if (records[index].sessionId === replaceSessionId) records.splice(index, 1);
      }
    }
    let restoredCount = 0;
    for (const value of Array.isArray(values) ? values : []) {
      const restored = safeRecord(value);
      if (!restored) continue;
      if (restored.status === "pending") {
        restored.status = "interrupted";
        restored.updatedAt = now();
        restored.resolution = { reason: "process_restarted" };
        emit(restored);
      }
      const existingIndex = records.findIndex((record) => record.interactionId === restored.interactionId);
      if (existingIndex >= 0) records.splice(existingIndex, 1, restored);
      else records.push(restored);
      restoredCount += 1;
    }
    trim();
    if (restoredCount > 0) schedulePersist();
    return restoredCount;
  }

  return {
    cancelScope,
    close,
    create,
    expirePending,
    flush: () => writeChain,
    get: (interactionId) => projection(find(interactionId)),
    getActive,
    list,
    resolve,
    resolveByGate,
    restore,
  };
}
