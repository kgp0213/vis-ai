import { createHash } from "node:crypto";

import { redactToolProgressValue } from "./tool-progress.mjs";

const MAX_FACTS = 64;
const TERMINAL_ROLES = new Set(["tool", "tool_cancelled"]);
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled", "unknown"]);

function bounded(value, limit = 240) {
  return String(value ?? "").slice(0, limit);
}

function parseArgs(value) {
  if (!value || typeof value !== "string") return value ?? null;
  try { return JSON.parse(value); } catch { return value; }
}

function argsSummary(value) {
  const parsed = parseArgs(value);
  return redactToolProgressValue(parsed, { maxDepth: 4, maxText: 800 });
}

function argsFingerprint(value) {
  try {
    const safe = argsSummary(value);
    return `sha256:${createHash("sha256").update(JSON.stringify(safe), "utf8").digest("hex")}`;
  } catch {
    return null;
  }
}

function workspaceDescriptor(operation, workspaceOverride = null) {
  const context = operation?.context ?? operation ?? {};
  const raw = workspaceOverride ?? context.workspaceSnapshot ?? context.workspace ?? null;
  if (!raw) return null;
  if (typeof raw === "object") {
    return {
      id: bounded(raw.id ?? raw.snapshotId ?? raw.fingerprint, 160) || null,
      path: null,
    };
  }
  const text = bounded(raw, 500);
  return {
    id: `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`,
    path: null,
  };
}

function operationIdOf(operation) {
  return bounded(operation?.id ?? operation?.context?.operationId, 180) || null;
}

function sessionIdOf(operation, sessionId) {
  return bounded(sessionId ?? operation?.context?.conversationId ?? operation?.sessionId, 180) || null;
}

function frameIdentity(event, operation) {
  const operationId = operationIdOf(operation) ?? "operation:unknown";
  const toolCallId = bounded(event?.callId ?? event?.toolCallId ?? event?.id, 180) || "tool:unknown";
  const attempt = Math.max(1, Number(event?.attempt) || 1);
  return `${operationId}:${toolCallId}:${attempt}`;
}

function isTerminalEvent(event) {
  return TERMINAL_ROLES.has(event?.role) || TERMINAL_STATUSES.has(String(event?.toolStatus ?? "").toLowerCase());
}

function phasePayload(event, operation, options = {}, phase = null) {
  const toolCallId = bounded(event?.callId ?? event?.toolCallId ?? event?.id, 180) || null;
  const operationId = operationIdOf(operation);
  const payload = {
    operationId,
    sessionId: sessionIdOf(operation, options.sessionId),
    workspace: workspaceDescriptor(operation, options.workspace),
    turnId: bounded(event?.turnId ?? event?.turn ?? options.turnId, 180) || null,
    stepId: bounded(event?.stepId ?? event?.toolStepId ?? options.stepId ?? toolCallId, 180) || null,
    toolCallId,
    toolName: bounded(event?.toolName, 160) || null,
    attempt: Math.max(1, Number(event?.attempt) || 1),
    args: argsSummary(event?.toolArgs),
    argsFingerprint: argsFingerprint(event?.toolArgs),
    ...(phase ? { phase } : {}),
  };
  if (phase === "finalizeToolResult") {
    payload.status = bounded(event?.toolStatus, 40) || null;
    payload.content = redactToolProgressValue(event?.content, { maxDepth: 3, maxText: 1200 });
  }
  return payload;
}

export function createRuntimeLifecycleBoundary({ lifecycle = null, onObservation = () => {} } = {}) {
  const frames = new Map();

  function report(fact) {
    try { onObservation(fact); } catch { /* diagnostics must never affect the loop */ }
  }

  async function execute(eventName, payload, signal) {
    if (typeof lifecycle?.runBoundary !== "function") return null;
    let result;
    try {
      result = await lifecycle.runBoundary(eventName, payload, { signal });
    } catch (error) {
      result = { event: eventName, results: [{ hook: "boundary", status: "failed", value: null }], error: bounded(error?.message || error, 320) };
    }
    const fact = {
      event: eventName,
      operationId: payload.operationId,
      sessionId: payload.sessionId,
      toolCallId: payload.toolCallId,
      turnId: payload.turnId,
      stepId: payload.stepId,
      attempt: payload.attempt,
      payload,
      result,
      // Hook values are observations. Returning args/block/decision cannot
      // mutate or stop the ordinary model tool loop.
      ignoredDecision: true,
      recordedAt: new Date().toISOString(),
    };
    report(fact);
    return fact;
  }

  async function observeToolEvent(event, { operation = null, sessionId = null, workspace = null, turnId = null, stepId = null, signal = null } = {}) {
    if (!event || (!event.toolName && !event.callId && !event.toolCallId)) return { accepted: false, reason: "tool_identity_missing" };
    const key = frameIdentity(event, operation);
    const frame = frames.get(key) ?? { phases: new Set(), queue: Promise.resolve() };
    frames.set(key, frame);
    const enqueue = async () => {
      const common = { operation, sessionId, workspace, turnId, stepId, signal };
      const phases = [];
      if (!frame.phases.has("beforeStep")) phases.push("beforeStep");
      if (event.role === "tool_start" || isTerminalEvent(event)) {
        if (!frame.phases.has("prepareTool")) phases.push("prepareTool");
        if (!frame.phases.has("authorizeTool")) phases.push("authorizeTool");
      }
      if (isTerminalEvent(event)) {
        if (!frame.phases.has("finalizeToolResult")) phases.push("finalizeToolResult");
        if (!frame.phases.has("afterStep")) phases.push("afterStep");
      }
      const facts = [];
      for (const eventName of phases) {
        frame.phases.add(eventName);
        const fact = await execute(eventName, phasePayload(event, operation, common, eventName), signal);
        if (fact) facts.push(fact);
      }
      return { accepted: true, facts, duplicate: phases.length === 0 };
    };
    const work = frame.queue.then(enqueue);
    frame.queue = work.catch(() => {});
    return work;
  }

  function clear(operationId = null) {
    const prefix = operationId ? `${operationId}:` : null;
    for (const key of frames.keys()) {
      if (!prefix || key.startsWith(prefix)) frames.delete(key);
    }
  }

  async function flush(operationId = null) {
    const prefix = operationId ? `${operationId}:` : null;
    const pending = [...frames.entries()]
      .filter(([key]) => !prefix || key.startsWith(prefix))
      .map(([, frame]) => frame.queue);
    await Promise.all(pending);
    return { operationId: operationId ?? null, frames: pending.length };
  }

  return { observeToolEvent, flush, clear };
}
