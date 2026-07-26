import { randomUUID } from "node:crypto";

const DEFAULT_MAX_QUEUED = 8;
const DEFAULT_MAX_CHARS = 4000;
const HISTORY_LIMIT = 64;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createOperationSteeringRuntime({
  initial = [],
  maxQueued = DEFAULT_MAX_QUEUED,
  maxChars = DEFAULT_MAX_CHARS,
  idFactory = randomUUID,
  now = () => new Date().toISOString(),
  onEvent = () => {},
} = {}) {
  const entriesByOperation = new Map();

  function entries(operationId) {
    const id = String(operationId ?? "").trim();
    if (!id) throw new Error("operationId is required");
    if (!entriesByOperation.has(id)) entriesByOperation.set(id, []);
    return entriesByOperation.get(id);
  }

  function publish(kind, entry) {
    const { instruction, ...safeEntry } = entry;
    try {
      onEvent({
        kind,
        steering: { ...clone(safeEntry), instructionLength: String(instruction ?? "").length },
      });
    } catch { /* Observability cannot block the operation. */ }
  }

  function enqueue({ operationId, sessionId = null, workspace = null, instruction } = {}) {
    const list = entries(operationId);
    if (list.filter((entry) => entry.status === "queued").length >= maxQueued) {
      throw new Error(`operation steering queue is limited to ${maxQueued} entries`);
    }
    const text = String(instruction ?? "").trim();
    if (!text) throw new Error("steering instruction is required");
    if (text.length > maxChars) throw new Error(`steering instruction is limited to ${maxChars} characters`);
    const entry = {
      id: `steer_${idFactory()}`,
      operationId: String(operationId),
      sessionId: sessionId ? String(sessionId) : null,
      workspace: workspace ? String(workspace) : null,
      instruction: text,
      status: "queued",
      createdAt: now(),
      resolution: null,
    };
    list.push(entry);
    if (list.length > HISTORY_LIMIT) list.splice(0, list.length - HISTORY_LIMIT);
    publish("operation-steering", entry);
    return clone(entry);
  }

  function consume(operationId) {
    const list = entries(operationId);
    const appliedAt = now();
    const queued = list.filter((entry) => entry.status === "queued");
    for (const entry of queued) {
      entry.status = "applied";
      entry.resolution = { appliedAt, boundary: "next_model_request" };
      publish("operation-steering", entry);
    }
    return clone(queued);
  }

  function close(operationId, { reason = "operation_finished" } = {}) {
    const list = entries(operationId);
    const resolvedAt = now();
    const changed = [];
    for (const entry of list) {
      if (entry.status !== "queued") continue;
      entry.status = "not_applied";
      entry.resolution = { resolvedAt, reason: String(reason || "operation_finished").slice(0, 160) };
      changed.push(entry);
      publish("operation-steering", entry);
    }
    const result = clone(changed);
    entriesByOperation.delete(String(operationId));
    return result;
  }

  function cancel(operationId, { reason = "operation_cancelled" } = {}) {
    const list = entries(operationId);
    const resolvedAt = now();
    const changed = [];
    for (const entry of list) {
      if (entry.status !== "queued") continue;
      entry.status = "cancelled";
      entry.resolution = { resolvedAt, reason: String(reason || "operation_cancelled").slice(0, 160) };
      changed.push(entry);
      publish("operation-steering", entry);
    }
    return clone(changed);
  }

  /**
   * Restore only the lifecycle projection after a process restart. Pending
   * instructions intentionally become not_applied: the instruction body is
   * not persisted, and replaying an unknown steering side effect would violate
   * operation/session isolation. This mirrors PromptService's explicit abort
   * boundary without creating another model execution path.
   */
  function restore(rawEntries = [], { reason = "process_restarted" } = {}) {
    entriesByOperation.clear();
    const restored = Array.isArray(rawEntries) ? rawEntries : [];
    for (const raw of restored) {
      const operationId = String(raw?.operationId ?? "").trim();
      const id = String(raw?.id ?? "").trim();
      if (!operationId || !id) continue;
      const status = String(raw?.status ?? "").trim();
      const entry = {
        id,
        operationId,
        sessionId: raw?.sessionId ? String(raw.sessionId) : null,
        workspace: raw?.workspace ? String(raw.workspace) : null,
        instruction: "",
        status: status === "queued" ? "not_applied" : status || "not_applied",
        createdAt: String(raw?.createdAt ?? now()),
        resolution: status === "queued"
          ? { resolvedAt: now(), reason: String(reason || "process_restarted").slice(0, 160) }
          : (raw?.resolution && typeof raw.resolution === "object" ? { ...raw.resolution } : null),
      };
      const list = entries(operationId);
      list.push(entry);
      if (list.length > HISTORY_LIMIT) list.splice(0, list.length - HISTORY_LIMIT);
    }
    return [...entriesByOperation.values()].flat().map((entry) => {
      const { instruction, ...safeEntry } = entry;
      return { ...clone(safeEntry), instructionLength: Number(rawEntries.find((raw) => raw?.id === entry.id)?.instructionLength) || 0 };
    });
  }

  if (Array.isArray(initial) && initial.length > 0) restore(initial);

  return {
    cancel,
    close,
    consume,
    enqueue,
    list: (operationId) => clone(entries(operationId)),
    restore,
  };
}
