import { createHash, randomUUID } from "node:crypto";

const ACTIVE_STATUS = "admitted";
const TERMINAL_STATUS = new Set(["promoted", "dispatching", "dispatched", "cancelled", "interrupted", "expired", "failed", "unknown"]);
const DELIVERY = new Set(["steer", "queue"]);
const MAX_TEXT = 12_000;
const MAX_ATTACHMENTS = 5;

function text(value, max = 800) {
  return String(value ?? "").trim().slice(0, max);
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function normalizeId(value) {
  const result = text(value, 160);
  return result || null;
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => typeof item === "string" ? item : item?.id)
    .map((item) => text(item, 200))
    .filter((item) => /^att_[0-9a-f-]{20,}$/i.test(item)))].slice(0, MAX_ATTACHMENTS);
}

function workspaceKey(value) {
  const normalized = text(value, 1_000).replace(/\\/g, "/").replace(/\/+$/u, "").toLowerCase();
  return normalized
    ? `sha256:${createHash("sha256").update(normalized).digest("hex")}`
    : null;
}

function canonicalInput({ sessionId, text: body, attachments, delivery, workspace }) {
  return JSON.stringify({
    sessionId,
    text: body,
    attachments,
    delivery,
    workspace,
  });
}

function fingerprint(input) {
  return `sha256:${createHash("sha256").update(canonicalInput(input)).digest("hex")}`;
}

function safeEvent(entry) {
  return {
    id: entry.id,
    sessionId: entry.sessionId,
    operationId: entry.operationId,
    workspace: entry.workspace,
    requestId: entry.requestId,
    delivery: entry.delivery,
    status: entry.status,
    admittedSeq: entry.admittedSeq,
    promotedSeq: entry.promotedSeq,
    createdAt: entry.createdAt,
    resolution: entry.resolution,
    attachmentCount: entry.attachments.length,
    textLength: entry.text.length,
  };
}

function normalizeEntry(raw, { now, fallbackSeq = 0, idFactory = randomUUID } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const sessionId = text(raw.sessionId, 200);
  const body = text(raw.text ?? raw.prompt, MAX_TEXT);
  const attachments = normalizeAttachments(raw.attachments ?? raw.attachmentIds);
  const delivery = DELIVERY.has(raw.delivery) ? raw.delivery : "queue";
  if (!sessionId || (!body && attachments.length === 0)) return null;
  const id = normalizeId(raw.id ?? raw.inputId ?? raw.promptId) || `input_${idFactory()}`;
  const workspace = workspaceKey(raw.workspaceKey ?? raw.workspace);
  const normalized = {
    id,
    sessionId,
    operationId: normalizeId(raw.operationId),
    workspace,
    requestId: normalizeId(raw.requestId),
    text: body,
    attachments,
    delivery,
    status: TERMINAL_STATUS.has(raw.status) || raw.status === ACTIVE_STATUS ? raw.status : ACTIVE_STATUS,
    admittedSeq: Number.isSafeInteger(raw.admittedSeq) && raw.admittedSeq > 0 ? raw.admittedSeq : fallbackSeq,
    promotedSeq: Number.isSafeInteger(raw.promotedSeq) && raw.promotedSeq > 0 ? raw.promotedSeq : null,
    createdAt: text(raw.createdAt, 80) || now(),
    resolution: raw.resolution && typeof raw.resolution === "object"
      ? {
          ...(text(raw.resolution.at, 80) ? { at: text(raw.resolution.at, 80) } : {}),
          ...(text(raw.resolution.boundary, 80) ? { boundary: text(raw.resolution.boundary, 80) } : {}),
          ...(text(raw.resolution.reason, 240) ? { reason: text(raw.resolution.reason, 240) } : {}),
          ...(normalizeId(raw.resolution.operationId) ? { operationId: normalizeId(raw.resolution.operationId) } : {}),
        }
      : null,
    dispatchToken: normalizeId(raw.dispatchToken),
  };
  normalized.fingerprint = typeof raw.fingerprint === "string" && raw.fingerprint.startsWith("sha256:")
    ? raw.fingerprint
    : fingerprint(normalized);
  return normalized;
}

export function createSessionInputAdmission({
  initial = [],
  maxPending = 8,
  maxHistory = 64,
  idFactory = randomUUID,
  now = () => new Date().toISOString(),
  onChange = () => {},
  onError = () => {},
  onEvent = () => {},
} = {}) {
  const entries = new Map();
  let sequence = 0;
  let lastPersistenceError = null;
  const pendingLimit = Math.max(1, Math.min(64, Math.floor(Number(maxPending) || 8)));
  const historyLimit = Math.max(pendingLimit, Math.min(512, Math.floor(Number(maxHistory) || 64)));

  function publish(kind, entry, extra = {}) {
    try { onEvent({ kind, input: { ...safeEvent(entry), ...extra } }); } catch { /* telemetry cannot block admission */ }
  }

  function persist() {
    try {
      const result = onChange(snapshot());
      if (result === false) throw new Error("session input persistence was rejected");
      lastPersistenceError = null;
      try { onError(null); } catch { /* diagnostics cannot block admission */ }
      return { ok: true };
    } catch (error) {
      lastPersistenceError = error instanceof Error ? error : new Error(String(error));
      try { onError(lastPersistenceError); } catch { /* diagnostics cannot block admission */ }
      return { ok: false, error: lastPersistenceError };
    }
  }

  function nextId() {
    return `input_${idFactory()}`;
  }

  function list(sessionId, { includeTerminal = true } = {}) {
    const scope = text(sessionId, 200);
    return [...entries.values()]
      .filter((entry) => entry.sessionId === scope && (includeTerminal || entry.status === ACTIVE_STATUS))
      .sort((a, b) => a.admittedSeq - b.admittedSeq)
      .map(clone);
  }

  function snapshot() {
    return [...entries.values()].sort((a, b) => a.admittedSeq - b.admittedSeq).map(clone);
  }

  function restoreSnapshot(rawEntries = []) {
    entries.clear();
    sequence = 0;
    for (const raw of Array.isArray(rawEntries) ? rawEntries : []) {
      const entry = normalizeEntry(raw, { now, fallbackSeq: sequence + 1, idFactory });
      if (!entry) continue;
      sequence = Math.max(sequence, entry.admittedSeq, entry.promotedSeq || 0);
      entries.set(entry.id, entry);
    }
    while (entries.size > historyLimit) {
      const oldest = [...entries.values()].sort((a, b) => a.admittedSeq - b.admittedSeq)[0];
      if (!oldest || oldest.status === ACTIVE_STATUS) break;
      entries.delete(oldest.id);
    }
    return snapshot();
  }

  function recoverInterruptedEntries() {
    const recovered = [];
    for (const entry of entries.values()) {
      if (!["promoted", "dispatching"].includes(entry.status)) continue;
      const previousStatus = entry.status;
      entry.status = ACTIVE_STATUS;
      entry.delivery = "queue";
      entry.operationId = null;
      entry.dispatchToken = null;
      entry.resolution = {
        at: now(),
        reason: "process_restarted_before_delivery_confirmed",
      };
      recovered.push({ entry, previousStatus });
    }
    if (recovered.length === 0) return [];
    const saved = persist();
    recovered.forEach(({ entry, previousStatus }) => publish("session-input-requeued", entry, {
      previousStatus,
      recovery: "process_restarted",
      persisted: saved.ok,
    }));
    return recovered.map(({ entry }) => clone(entry));
  }

  function rollback(before, previousSequence) {
    restoreSnapshot(before);
    sequence = previousSequence;
  }

  function persistenceFailure(error) {
    return {
      ok: false,
      code: "SESSION_INPUT_PERSIST_FAILED",
      error: `session input could not be saved: ${error?.message || String(error)}`,
    };
  }

  function admit(raw = {}) {
    const sessionId = text(raw.sessionId, 200);
    const rawBody = String(raw.text ?? raw.prompt ?? "").trim();
    if (rawBody.length > MAX_TEXT) return { ok: false, code: "SESSION_INPUT_TOO_LARGE", error: `input is limited to ${MAX_TEXT} characters` };
    const body = text(rawBody, MAX_TEXT);
    const attachments = normalizeAttachments(raw.attachments ?? raw.attachmentIds);
    const delivery = DELIVERY.has(raw.delivery) ? raw.delivery : "queue";
    if (!sessionId) return { ok: false, code: "SESSION_INPUT_SESSION_REQUIRED", error: "sessionId is required" };
    if (!body && attachments.length === 0) return { ok: false, code: "SESSION_INPUT_EMPTY", error: "text or attachment is required" };
    const id = normalizeId(raw.id ?? raw.inputId ?? raw.promptId) || nextId();
    const candidate = normalizeEntry({ ...raw, id, sessionId, text: body, attachments, delivery }, { now, fallbackSeq: sequence + 1, idFactory });
    const existing = entries.get(id);
    if (existing) {
      if (existing.fingerprint !== candidate.fingerprint) {
        return { ok: false, code: "SESSION_INPUT_CONFLICT", error: "input id already belongs to different content", existing: clone(existing) };
      }
      return { ok: true, duplicate: true, input: clone(existing) };
    }
    const pending = [...entries.values()].filter((entry) => entry.sessionId === sessionId && entry.status === ACTIVE_STATUS);
    if (pending.length >= pendingLimit) {
      return { ok: false, code: "SESSION_INPUT_QUEUE_FULL", error: `session input queue is limited to ${pendingLimit}` };
    }
    const before = snapshot();
    const previousSequence = sequence;
    candidate.admittedSeq = ++sequence;
    candidate.fingerprint = fingerprint(candidate);
    entries.set(candidate.id, candidate);
    while (entries.size > historyLimit) {
      const oldest = [...entries.values()].sort((a, b) => a.admittedSeq - b.admittedSeq)[0];
      if (!oldest || oldest.status === ACTIVE_STATUS) break;
      entries.delete(oldest.id);
    }
    const saved = persist();
    if (!saved.ok) {
      rollback(before, previousSequence);
      return persistenceFailure(saved.error);
    }
    publish("session-input-admitted", candidate);
    return { ok: true, duplicate: false, input: clone(candidate) };
  }

  function matchesScope(entry, { sessionId, operationId = null, workspace = null, allowOperationChange = false } = {}) {
    if (entry.sessionId !== text(sessionId, 200)) return false;
    if (workspace && entry.workspace && entry.workspace !== workspaceKey(workspace)) return false;
    if (!allowOperationChange && operationId && entry.operationId && entry.operationId !== text(operationId, 160)) return false;
    return true;
  }

  function promote(entry, { operationId = null, boundary = "next_model_request" } = {}) {
    entry.status = "promoted";
    entry.promotedSeq = ++sequence;
    entry.resolution = {
      at: now(),
      boundary,
      ...(operationId ? { operationId: text(operationId, 160) } : {}),
    };
    return entry;
  }

  function promoteSteers(sessionId, options = {}) {
    const selected = [...entries.values()]
      .filter((entry) => entry.status === ACTIVE_STATUS && entry.delivery === "steer")
      .filter((entry) => matchesScope(entry, { ...options, sessionId }))
      .sort((a, b) => a.admittedSeq - b.admittedSeq);
    const before = snapshot();
    const previousSequence = sequence;
    selected.forEach((entry) => promote(entry, options));
    if (selected.length) {
      const saved = persist();
      if (!saved.ok) {
        rollback(before, previousSequence);
        return [];
      }
      selected.forEach((entry) => publish("session-input-promoted", entry));
    }
    return selected.map(clone);
  }

  function promoteNextQueue(sessionId, options = {}) {
    const selected = [...entries.values()]
      .filter((entry) => entry.status === ACTIVE_STATUS && entry.delivery === "queue")
      .filter((entry) => matchesScope(entry, { ...options, sessionId, allowOperationChange: true }))
      .sort((a, b) => a.admittedSeq - b.admittedSeq)[0];
    if (!selected) return null;
    const before = snapshot();
    const previousSequence = sequence;
    promote(selected, { ...options, boundary: options.boundary || "next_turn" });
    const saved = persist();
    if (!saved.ok) {
      rollback(before, previousSequence);
      return null;
    }
    publish("session-input-promoted", selected);
    return clone(selected);
  }

  function resolve(id, status, reason, options = {}) {
    const entry = entries.get(normalizeId(id));
    if (!entry) return { ok: false, code: "SESSION_INPUT_NOT_FOUND", error: "session input was not found" };
    if (TERMINAL_STATUS.has(entry.status) && !["promoted", "dispatching"].includes(entry.status)) return { ok: true, duplicate: true, input: clone(entry) };
    if (!TERMINAL_STATUS.has(status)) return { ok: false, code: "SESSION_INPUT_STATUS_INVALID", error: "invalid terminal input status" };
    const before = snapshot();
    const previousSequence = sequence;
    entry.status = status;
    if (status !== "dispatching") entry.dispatchToken = null;
    entry.resolution = {
      at: now(),
      ...(text(reason, 240) ? { reason: text(reason, 240) } : {}),
      ...(normalizeId(options.operationId) ? { operationId: normalizeId(options.operationId) } : {}),
    };
    const saved = persist();
    if (!saved.ok) {
      rollback(before, previousSequence);
      // A dispatch reservation may already have entered submitPrompt, while a
      // promoted steer may already be present in durable model history. Once
      // either boundary is crossed, failed terminal persistence is uncertain:
      // replaying automatically could duplicate user input or side effects.
      const previousStatus = before.find((candidate) => candidate.id === entry.id)?.status;
      if (["promoted", "dispatching"].includes(previousStatus)) {
        const uncertain = entries.get(entry.id);
        if (uncertain) {
          uncertain.status = "unknown";
          uncertain.dispatchToken = null;
          uncertain.resolution = {
            at: now(),
            reason: "terminal_resolution_persist_failed",
            ...(normalizeId(options.operationId) ? { operationId: normalizeId(options.operationId) } : {}),
          };
          publish("session-input-resolution-uncertain", uncertain, {
            persisted: false,
            requestedStatus: status,
            persistenceError: saved.error?.message || String(saved.error),
          });
          return { ...persistenceFailure(saved.error), uncertain: true, input: clone(uncertain) };
        }
      }
      return persistenceFailure(saved.error);
    }
    publish("session-input-resolved", entry);
    return { ok: true, input: clone(entry) };
  }

  function beginDispatch(id, { operationId = null } = {}) {
    const entry = entries.get(normalizeId(id));
    if (!entry) return { ok: false, code: "SESSION_INPUT_NOT_FOUND", error: "session input was not found" };
    if (entry.status === "dispatching") return { ok: true, duplicate: true, input: clone(entry) };
    if (entry.status !== "promoted" || entry.delivery !== "queue") {
      return { ok: false, code: "SESSION_INPUT_NOT_DISPATCHABLE", error: "session input is not ready for dispatch" };
    }
    const before = snapshot();
    const previousSequence = sequence;
    entry.status = "dispatching";
    entry.operationId = normalizeId(operationId) || entry.operationId;
    entry.dispatchToken = `dispatch_${idFactory()}`;
    entry.resolution = {
      at: now(),
      boundary: "queue_dispatch",
      ...(entry.operationId ? { operationId: entry.operationId } : {}),
    };
    const saved = persist();
    if (!saved.ok) {
      rollback(before, previousSequence);
      return persistenceFailure(saved.error);
    }
    publish("session-input-dispatching", entry);
    return { ok: true, input: clone(entry) };
  }

  // A promotion is durable before the model/history boundary is crossed. If
  // that boundary fails, put the input back into the admission queue so a
  // later operation can retry it instead of losing it or injecting it only
  // into one in-memory request.
  function requeuePromoted(id, { reason = "delivery_failed", operationId = null, clearOperation = false } = {}) {
    const entry = entries.get(normalizeId(id));
    if (!entry) return { ok: false, code: "SESSION_INPUT_NOT_FOUND", error: "session input was not found" };
    if (entry.status !== "promoted") return { ok: true, duplicate: true, input: clone(entry) };
    const before = snapshot();
    const previousSequence = sequence;
    entry.status = ACTIVE_STATUS;
    entry.dispatchToken = null;
    if (clearOperation) entry.operationId = null;
    entry.resolution = {
      at: now(),
      reason: text(reason, 240) || "delivery_failed",
      ...(normalizeId(operationId) ? { operationId: normalizeId(operationId) } : {}),
    };
    const saved = persist();
    if (!saved.ok) {
      rollback(before, previousSequence);
      return persistenceFailure(saved.error);
    }
    publish("session-input-requeued", entry);
    return { ok: true, input: clone(entry) };
  }

  function closeOperation(operationId, { reason = "operation_finished", requeueUndelivered = false } = {}) {
    const id = normalizeId(operationId);
    if (!id) return [];
    const before = snapshot();
    const previousSequence = sequence;
    const changed = [];
    for (const entry of entries.values()) {
      if (entry.status !== ACTIVE_STATUS || entry.operationId !== id || entry.delivery !== "steer") continue;
      if (requeueUndelivered) {
        entry.delivery = "queue";
        entry.operationId = null;
      } else {
        entry.status = "interrupted";
      }
      entry.resolution = { at: now(), reason: text(reason, 240) || "operation_finished", operationId: id };
      changed.push(clone(entry));
    }
    if (changed.length) {
      const saved = persist();
      if (!saved.ok) {
        rollback(before, previousSequence);
        return [];
      }
    }
    changed.forEach((entry) => publish(
      entry.status === ACTIVE_STATUS ? "session-input-requeued" : "session-input-resolved",
      entry,
    ));
    return changed;
  }

  function restore(rawEntries = []) {
    restoreSnapshot(rawEntries);
    lastPersistenceError = null;
    recoverInterruptedEntries();
    return snapshot();
  }

  restore(initial);
  return {
    admit,
    closeOperation,
    beginDispatch,
    list,
    promoteNextQueue,
    promoteSteers,
    resolve,
    requeuePromoted,
    restore,
    snapshot,
    lastError: () => lastPersistenceError ? {
      code: "SESSION_INPUT_PERSIST_FAILED",
      error: lastPersistenceError.message,
    } : null,
    workspaceKey,
    statuses: Object.freeze({ active: ACTIVE_STATUS, terminal: [...TERMINAL_STATUS] }),
  };
}

export const sessionInputAdmissionConstants = Object.freeze({ MAX_ATTACHMENTS, MAX_TEXT });
