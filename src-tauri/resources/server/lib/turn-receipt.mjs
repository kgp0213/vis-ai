const MAX_TOOL_EVENTS = 24;
const MAX_ARTIFACT_EVENTS = 16;
const MAX_ERROR_EVENTS = 8;
const MAX_MODEL_RETRIES = 12;
const MAX_PROVIDER_RESULTS = 16;

function boundedText(value, limit = 320) {
  return String(value ?? "").slice(0, limit);
}

function fingerprint(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

/**
 * Collects facts for one model turn. This is deliberately not a task engine:
 * it never schedules work or decides what the model should do.
 */
export function createTurnReceipt({ turnId = null, requestId = null, startedAt = Date.now() } = {}) {
  const state = {
    version: 1,
    turnId: turnId ? String(turnId) : null,
    requestId: requestId ? String(requestId) : null,
    startedAt,
    tools: { dispatches: 0, results: 0, successes: 0, failures: 0, lastName: null },
    toolCalls: [],
    toolEvents: [],
    errors: [],
    modelRetries: [],
    providerResults: [],
    artifactEvidence: [],
    documentBindings: [],
    runtime: [],
    context: null,
    mediaReduced: false,
    mediaOmitted: 0,
    mediaRecovery: null,
    mediaWarnings: [],
    intervention: { active: false, shown: 0, resolved: 0, fingerprint: null, choice: null },
    completion: null,
  };

  function observeTool({ name = null, succeeded = null, result = null } = {}) {
    const toolName = boundedText(name, 120) || null;
    state.tools.results++;
    state.tools.lastName = toolName;
    if (succeeded === true) state.tools.successes++;
    if (succeeded === false) state.tools.failures++;
    state.toolEvents.push({
      name: toolName,
      succeeded: succeeded === true ? true : succeeded === false ? false : null,
      result: boundedText(result),
    });
    if (state.toolEvents.length > MAX_TOOL_EVENTS) state.toolEvents.shift();
  }

  function observeToolProgress({ toolCallId = null, name = null, status = null, result = null } = {}) {
    const id = boundedText(toolCallId, 180) || `legacy-${state.toolCalls.length + 1}`;
    const toolName = boundedText(name, 120) || null;
    let call = state.toolCalls.find((entry) => entry.toolCallId === id);
    const isNew = !call;
    if (!call) {
      call = { toolCallId: id, name: toolName, status: null, result: null };
      state.toolCalls.push(call);
      if (state.toolCalls.length > MAX_TOOL_EVENTS) state.toolCalls.shift();
    }
    if (toolName) call.name = toolName;
    state.tools.lastName = call.name;
    if (isNew && ["queued", "running"].includes(status)) state.tools.dispatches++;
    const wasTerminal = ["succeeded", "failed", "cancelled"].includes(call.status);
    const isTerminal = ["succeeded", "failed", "cancelled"].includes(status);
    call.status = boundedText(status, 40) || call.status;
    if (result !== null && result !== undefined) call.result = boundedText(result);
    if (!wasTerminal && isTerminal) {
      state.tools.results++;
      if (status === "succeeded") state.tools.successes++;
      else state.tools.failures++;
      state.toolEvents.push({ name: call.name, succeeded: status === "succeeded", result: call.result });
      if (state.toolEvents.length > MAX_TOOL_EVENTS) state.toolEvents.shift();
    }
  }

  function observeToolStart(name = null) {
    state.tools.dispatches++;
    state.tools.lastName = boundedText(name, 120) || null;
  }

  function recordError(error, { source = "model-loop" } = {}) {
    const message = boundedText(error, 500).trim();
    if (!message) return;
    state.errors.push({
      source: boundedText(source, 80) || "model-loop",
      message,
      recordedAt: new Date().toISOString(),
    });
    if (state.errors.length > MAX_ERROR_EVENTS) state.errors.shift();
  }

  function recordModelRetry(event = {}) {
    const retry = {
      requestId: boundedText(event.requestId, 160) || state.requestId,
      attempt: Math.max(1, Number(event.attempt) || 1),
      maxAttempts: Math.max(1, Number(event.maxAttempts) || 1),
      delayMs: Math.max(0, Number(event.delayMs ?? event.waitMs) || 0),
      reason: boundedText(event.reason, 320) || "retry",
      statusCode: Number.isInteger(Number(event.statusCode)) ? Number(event.statusCode) : null,
      recordedAt: new Date().toISOString(),
    };
    const duplicate = state.modelRetries.some((item) => item.requestId === retry.requestId && item.attempt === retry.attempt);
    if (duplicate) return false;
    state.modelRetries.push(retry);
    if (state.modelRetries.length > MAX_MODEL_RETRIES) state.modelRetries.shift();
    return true;
  }

  function recordProviderResult(result = {}) {
    const normalized = {
      requestId: boundedText(result.requestId, 160) || state.requestId,
      attempt: Math.max(1, Number(result.attempt) || 1),
      statusCode: Number.isInteger(Number(result.statusCode)) ? Number(result.statusCode) : null,
      finishReason: boundedText(result.finishReason, 80) || null,
      rawFinishReason: boundedText(result.rawFinishReason, 120) || null,
      usage: result.usage && typeof result.usage === "object" ? { ...result.usage } : null,
      traceId: boundedText(result.traceId, 160) || null,
      cancelled: result.cancelled === true,
      retryable: result.retryable === true,
      recordedAt: new Date().toISOString(),
    };
    const duplicate = state.providerResults.some((item) => item.requestId === normalized.requestId && item.attempt === normalized.attempt && item.finishReason === normalized.finishReason);
    if (duplicate) return false;
    state.providerResults.push(normalized);
    if (state.providerResults.length > MAX_PROVIDER_RESULTS) state.providerResults.shift();
    return true;
  }

  function recordArtifact({ paths = [], files = [], producer = "unknown", verified = false, status = null, reason = "" } = {}) {
    const normalized = [...new Set((Array.isArray(paths) ? paths : []).map((path) => String(path ?? "").trim()).filter(Boolean))];
    if (normalized.length === 0) return;
    state.artifactEvidence.push({
      paths: normalized.slice(0, 8),
      files: (Array.isArray(files) ? files : []).slice(0, 8).map((file) => ({
        path: boundedText(file?.path, 500),
        size: Math.max(0, Number(file?.size) || 0),
        mtimeMs: Math.max(0, Number(file?.mtimeMs) || 0),
        ext: boundedText(file?.ext, 24) || null,
        changedThisTurn: file?.changedThisTurn !== false,
        verification: boundedText(file?.verification, 80) || null,
        status: boundedText(file?.status, 40) || (verified ? "verified" : "present_unverified"),
      })),
      producer: boundedText(producer, 120),
      verified: verified === true,
      status: boundedText(status, 40) || (verified ? "verified" : "present_unverified"),
      reason: boundedText(reason, 240),
      recordedAt: new Date().toISOString(),
    });
    if (state.artifactEvidence.length > MAX_ARTIFACT_EVENTS) state.artifactEvidence.shift();
  }

  function recordDocumentBinding(binding = {}) {
    const documentRef = boundedText(binding.documentRef, 180);
    if (!documentRef) return;
    const existing = state.documentBindings.find((entry) => entry.documentRef === documentRef);
    const next = {
      documentRef,
      readablePath: boundedText(binding.readablePath, 500) || null,
      sourcePath: boundedText(binding.sourcePath, 500) || null,
      verified: binding.verified === true,
    };
    if (existing) Object.assign(existing, next);
    else state.documentBindings.push(next);
  }

  function recordRuntime(runtime = {}) {
    if (!runtime || typeof runtime !== "object") return;
    const environmentId = boundedText(runtime.environmentId, 180) || null;
    const toolId = boundedText(runtime.toolId, 180) || null;
    if (!environmentId && !toolId) return;
    const next = {
      environmentId,
      toolId,
      kind: boundedText(runtime.kind, 40) || null,
      status: boundedText(runtime.status, 40) || "degraded",
      reused: runtime.reused === true,
      repaired: runtime.repaired === true,
      installed: runtime.installed === true,
      packageSource: boundedText(runtime.packageSource, 300) || null,
      requirementsHash: boundedText(runtime.requirementsHash, 240) || null,
    };
    const index = state.runtime.findIndex((item) => (environmentId && item.environmentId === environmentId) || (!environmentId && toolId && item.toolId === toolId));
    if (index >= 0) state.runtime[index] = next;
    else state.runtime.push(next);
    state.runtime = state.runtime.slice(-32);
  }

  function recordContext(status) {
    if (!status || typeof status !== "object") return;
    state.context = {
      transactionId: boundedText(status.transactionId, 160) || null,
      inputChars: Math.max(0, Number(status.inputChars ?? status.totalInputChars) || 0),
      estimatedTokens: Math.max(0, Number(status.estimatedTokens) || 0),
      toolResultBytes: Math.max(0, Number(status.toolResultBytes) || 0),
      compressed: status.compressed === true,
      resourceRefs: [...new Set((Array.isArray(status.resourceRefs) ? status.resourceRefs : []).map((value) => boundedText(value, 240)).filter((value) => /^[A-Za-z0-9._:-]{1,240}$/u.test(value)))].slice(0, 32),
      pendingCount: Math.max(0, Number(status.pendingCount) || 0),
      pendingChars: Math.max(0, Number(status.pendingChars) || 0),
      materializedChars: Math.max(0, Number(status.materializedChars) || 0),
      cacheFailureCount: Math.max(0, Number(status.cacheFailureCount) || 0),
      requiresIntervention: status.requiresIntervention === true,
      finalWithPending: status.finalWithPending === true,
      contextOverflow: status.contextOverflow === true || status.error?.code === "context_overflow",
      droppedItems: Array.isArray(status.droppedItems) ? status.droppedItems.slice(0, 16) : [],
      warnings: Array.isArray(status.warnings) ? status.warnings.slice(0, 8) : [],
    };
  }

  function recordMedia(event = {}) {
    state.mediaReduced ||= event.mediaReduced === true;
    state.mediaOmitted += Math.max(0, Number(event.mediaOmitted) || 0);
    if (event.mediaRecovery) state.mediaRecovery = boundedText(event.mediaRecovery, 120);
    for (const warning of Array.isArray(event.mediaWarnings) ? event.mediaWarnings : []) {
      const normalized = boundedText(warning, 500).trim();
      if (normalized && !state.mediaWarnings.includes(normalized)) state.mediaWarnings.push(normalized);
    }
    state.mediaWarnings = state.mediaWarnings.slice(-8);
  }

  function claimIntervention(status) {
    if (state.intervention.active) return false;
    const nextFingerprint = fingerprint({
      pendingCount: status?.pendingCount,
      pendingChars: status?.pendingChars,
      cacheFailureCount: status?.cacheFailureCount,
      finalWithPending: status?.finalWithPending,
      progressAnomaly: status?.progressAnomaly,
    });
    state.intervention = {
      ...state.intervention,
      active: true,
      shown: state.intervention.shown + 1,
      fingerprint: nextFingerprint,
      choice: null,
    };
    return true;
  }

  function resolveIntervention(choice) {
    if (!state.intervention.active) return;
    state.intervention = {
      ...state.intervention,
      active: false,
      resolved: state.intervention.resolved + 1,
      choice: boundedText(choice, 80) || null,
    };
  }

  function complete(value = {}) {
    state.completion = {
      ok: value.ok === true,
      taskState: boundedText(value.taskState, 80) || null,
      artifactIncomplete: value.artifactIncomplete === true,
      interventionPaused: value.interventionPaused === true,
      continuationNeeded: value.continuationNeeded === true,
      completedAt: new Date().toISOString(),
    };
  }

  function snapshot() {
    return JSON.parse(JSON.stringify({
      ...state,
      elapsedMs: Math.max(0, Date.now() - Number(state.startedAt || Date.now())),
    }));
  }

  return {
    observeTool,
    observeToolProgress,
    observeToolStart,
    recordError,
    recordModelRetry,
    recordProviderResult,
    recordArtifact,
    recordDocumentBinding,
    recordRuntime,
    recordContext,
    recordMedia,
    claimIntervention,
    resolveIntervention,
    complete,
    snapshot,
  };
}
