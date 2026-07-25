import { randomUUID } from "node:crypto";

const DEFAULT_MAX_QUEUED = 8;
const DEFAULT_MAX_CHARS = 4000;
const HISTORY_LIMIT = 64;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createOperationSteeringRuntime({
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

  return {
    cancel,
    close,
    consume,
    enqueue,
    list: (operationId) => clone(entries(operationId)),
  };
}
