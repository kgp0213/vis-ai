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

export function isOperationContextActive(context, { operationId, conversationId = null } = {}) {
  if (!context || context.state !== "running") return false;
  if (String(context.operationId ?? "") !== String(operationId ?? "")) return false;
  if (conversationId !== null && String(context.conversationId ?? "") !== String(conversationId)) return false;
  return !context.signal?.aborted;
}

export function closeOperationContext(context, state = "completed", closedAt = new Date().toISOString()) {
  if (!context || typeof context !== "object") return null;
  context.state = state;
  context.closedAt = closedAt;
  context.sendAuthorization = null;
  context.signal = null;
  return context;
}
