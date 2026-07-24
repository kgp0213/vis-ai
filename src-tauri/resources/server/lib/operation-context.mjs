const CONTEXT_VERSION = 1;

export function createOperationContext({ operationId, kind, conversationId = null, workspace = null, signal = null, startedAt = new Date().toISOString() } = {}) {
  const id = String(operationId ?? "").trim();
  const source = String(kind ?? "").trim();
  if (!id) throw new Error("operationId is required");
  if (!source) throw new Error("operation kind is required");
  return {
    version: CONTEXT_VERSION,
    operationId: id,
    source,
    conversationId: conversationId ? String(conversationId) : null,
    workspace: workspace ? String(workspace) : null,
    startedAt,
    closedAt: null,
    stopRequestedAt: null,
    stopReason: null,
    error: null,
    state: "running",
    signal,
    userPrompt: "",
    scheduledAuthorization: false,
    sendAuthorization: null,
    preparedDocuments: [],
    artifactBaseline: [],
    receipt: null,
  };
}

export function requestOperationStop(context, reason = "user_cancelled", requestedAt = new Date().toISOString()) {
  if (!context || typeof context !== "object") return false;
  if (context.state !== "running") return false;
  context.state = "stopping";
  context.stopRequestedAt = requestedAt;
  context.stopReason = String(reason || "user_cancelled").slice(0, 160);
  // A stopped operation must not retain a send capability while in-flight
  // tools are unwinding. The final close still clears the signal itself.
  context.sendAuthorization = null;
  return true;
}

export function isOperationContextActive(context, { operationId, conversationId = null } = {}) {
  if (!context || context.state !== "running") return false;
  if (String(context.operationId ?? "") !== String(operationId ?? "")) return false;
  if (conversationId !== null && String(context.conversationId ?? "") !== String(conversationId)) return false;
  return !context.signal?.aborted;
}

export function closeOperationContext(context, state = "completed", closedAt = new Date().toISOString()) {
  if (!context || typeof context !== "object") return null;
  if (["completed", "cancelled", "failed", "unknown"].includes(context.state)) return context;
  context.state = state;
  context.closedAt = closedAt;
  context.sendAuthorization = null;
  context.signal = null;
  return context;
}
