import { createHash, randomUUID } from "node:crypto";

import { closeOperationContext, createOperationContext, requestOperationStop } from "./operation-context.mjs";

const TERMINAL_STATES = new Set(["completed", "cancelled", "failed", "unknown"]);

function safeWorkspace(value) {
  if (!value) return null;
  if (typeof value === "object") {
    return {
      id: String(value.id ?? value.snapshotId ?? value.fingerprint ?? "").slice(0, 160) || null,
      path: null,
    };
  }
  return {
    id: `sha256:${createHash("sha256").update(String(value), "utf8").digest("hex")}`,
    path: null,
  };
}

function scopeIdentity(conversationId, workspace) {
  const safe = safeWorkspace(workspace);
  return {
    conversationId: String(conversationId ?? "").trim() || null,
    workspaceId: safe?.id ?? null,
  };
}

function sameScope(left, right) {
  return left?.conversationId === right?.conversationId
    && left?.workspaceId === right?.workspaceId;
}

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
    const conversationId = getConversationId();
    const workspace = getWorkspace();
    const operation = {
      id: idFactory(),
      kind,
      state: "running",
      startedAt,
      stopRequestedAt: null,
      progress: null,
      controller,
      context: null,
      // Scope is an immutable ownership snapshot. A session/workspace switch
      // must stop this operation rather than relabeling late callbacks.
      scope: scopeIdentity(conversationId, workspace),
    };
    operation.context = createOperationContext({
      operationId: operation.id,
      kind,
      conversationId,
      workspace,
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
    // Lifecycle policy hooks are observation-only. Run the stop boundary
    // before aborting so they can record whether an in-flight step should be
    // allowed to unwind, but never consume their return value to continue or
    // block the ordinary model/tool loop.
    if (typeof lifecycle?.runBoundary === "function") {
      void Promise.resolve(lifecycle.runBoundary("shouldContinueAfterStop", {
        operationId: operation.id,
        sessionId: operation.context?.conversationId ?? null,
        workspace: safeWorkspace(operation.context?.workspace),
        state: operation.state,
        reason: String(reason || "user_cancelled").slice(0, 160),
        requestedAt,
      }, { signal: operation.controller.signal })).catch(onError);
    }
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
    const current = scopeIdentity(getConversationId(), getWorkspace());
    if (sameScope(operation.scope, current)) return true;
    operation.context.scopeMismatch = {
      expected: { ...operation.scope },
      observed: current,
      detectedAt: now(),
    };
    operation.finalState = "unknown";
    // Never mutate the original scope. Stopping is the only safe response to
    // a session/workspace change while model or tool callbacks are in flight.
    stop(operation, "scope_changed");
    return false;
  }

  function scopeMatches(operation = activeOperation, { conversationId = getConversationId(), workspace = getWorkspace() } = {}) {
    if (!operation) return false;
    return sameScope(operation.scope, scopeIdentity(conversationId, workspace));
  }

  return {
    begin,
    finish,
    getActive: () => activeOperation,
    public: publicOperation,
    refreshScope,
    scopeMatches,
    stop,
  };
}
