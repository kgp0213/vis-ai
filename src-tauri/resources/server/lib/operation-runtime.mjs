import { randomUUID } from "node:crypto";

import { closeOperationContext, createOperationContext, requestOperationStop } from "./operation-context.mjs";

const TERMINAL_STATES = new Set(["completed", "cancelled", "failed", "unknown"]);

export function createOperationRuntime({
  broadcast = () => {},
  stopOwned = async () => {},
  drain = () => {},
  revokeAuthorization = () => {},
  getConversationId = () => null,
  getWorkspace = () => null,
  idFactory = randomUUID,
  now = () => new Date().toISOString(),
  createController = () => new AbortController(),
  lifecycle = null,
  onError = (error) => console.error(`[operation-runtime] ${error?.message || error}`),
} = {}) {
  let activeOperation = null;

  function emitLifecycle(event, operation, details = {}) {
    if (typeof lifecycle?.emit !== "function") return;
    void Promise.resolve(lifecycle.emit(event, {
      operationId: operation?.id ?? null,
      kind: operation?.kind ?? null,
      state: operation?.state ?? null,
      ...details,
    })).catch(onError);
  }

  function publicOperation(operation = activeOperation) {
    if (!operation) return null;
    return {
      id: operation.id,
      kind: operation.kind,
      state: operation.state,
      startedAt: operation.startedAt,
      stopRequestedAt: operation.stopRequestedAt ?? null,
      progress: operation.progress ?? null,
    };
  }

  function publish(operation, state = operation?.state) {
    if (!operation) return;
    broadcast({
      kind: "operation-change",
      operation: { ...publicOperation(operation), state },
    });
  }

  function begin(kind) {
    if (activeOperation) throw new Error(`operation ${activeOperation.id} is already active`);
    const startedAt = now();
    const controller = createController();
    const operation = {
      id: idFactory(),
      kind,
      state: "running",
      startedAt,
      stopRequestedAt: null,
      progress: null,
      controller,
      context: null,
    };
    operation.context = createOperationContext({
      operationId: operation.id,
      kind,
      conversationId: getConversationId(),
      workspace: getWorkspace(),
      signal: controller.signal,
      startedAt,
    });
    activeOperation = operation;
    publish(operation);
    emitLifecycle("operation.started", operation);
    return operation;
  }

  function stop(operation = activeOperation, reason = "user_cancelled") {
    if (!operation || activeOperation?.id !== operation.id || operation.state !== "running") return false;
    const requestedAt = now();
    operation.state = "stopping";
    operation.stopRequestedAt = requestedAt;
    requestOperationStop(operation.context, reason, requestedAt);
    try {
      revokeAuthorization(operation);
    } catch (error) {
      onError(error);
    }
    operation.controller.abort();
    publish(operation);
    emitLifecycle("operation.stopping", operation, { reason });
    try {
      void Promise.resolve(stopOwned(operation.id, { graceMs: 100 })).catch(onError);
    } catch (error) {
      onError(error);
    }
    return true;
  }

  function finish(operation, state = operation?.finalState) {
    if (!operation || activeOperation?.id !== operation.id) return false;
    const finalState = TERMINAL_STATES.has(state)
      ? state
      : operation.controller.signal.aborted ? "cancelled" : "completed";
    operation.state = finalState;
    try {
      revokeAuthorization(operation);
    } catch (error) {
      onError(error);
    }
    closeOperationContext(operation.context, finalState, now());
    publish(operation, finalState);
    emitLifecycle("operation.finished", operation, { finalState });
    activeOperation = null;
    drain();
    return true;
  }

  function refreshScope(operation = activeOperation) {
    if (!operation?.context || activeOperation?.id !== operation.id) return false;
    operation.context.conversationId = getConversationId() || null;
    operation.context.workspace = getWorkspace() || null;
    return true;
  }

  return {
    begin,
    finish,
    getActive: () => activeOperation,
    public: publicOperation,
    refreshScope,
    stop,
  };
}
