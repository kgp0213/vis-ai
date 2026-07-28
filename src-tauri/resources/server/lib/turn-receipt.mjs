import { createExecutionPhaseTracker } from "./execution-phase.mjs";

const MAX_TOOL_EVENTS = 24;
const MAX_ARTIFACT_EVENTS = 16;
const MAX_ERROR_EVENTS = 8;
const MAX_MODEL_RETRIES = 12;
const MAX_PROVIDER_RESULTS = 16;
const MAX_PROVIDER_PROJECTIONS = 16;
const MAX_TOOL_FAILURES = 32;
const MAX_RECOVERIES = 32;
const MAX_TOOL_REPEATS = 16;
const MAX_AUTHORIZATION_FACTS = 32;
const MAX_LIFECYCLE_HOOKS = 32;

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
export function createTurnReceipt({ turnId = null, requestId = null, operationId = null, sessionId = null, startedAt = Date.now() } = {}) {
  const phaseTracker = createExecutionPhaseTracker({ operationId, sessionId, turnId });
  const state = {
    version: 1,
    turnId: turnId ? String(turnId) : null,
    requestId: requestId ? String(requestId) : null,
    operationId: operationId ? String(operationId) : null,
    sessionId: sessionId ? String(sessionId) : null,
    startedAt,
    phase: phaseTracker.snapshot(),
    tools: { dispatches: 0, results: 0, successes: 0, failures: 0, lastName: null },
    toolCalls: [],
    toolEvents: [],
    toolFailures: [],
    recoveries: [],
    toolRepeats: [],
    authorizationFacts: [],
    lifecycleHooks: [],
    errors: [],
    modelRetries: [],
    providerResults: [],
    providerProjections: [],
    artifactEvidence: [],
    warnings: [],
    documentBindings: [],
    runtime: [],
    context: null,
    mediaReduced: false,
    mediaOmitted: 0,
    mediaRecovery: null,
    mediaWarnings: [],
    intervention: { active: false, shown: 0, resolved: 0, fingerprint: null, choice: null },
    taskContract: null,
    executionState: "running",
    goalState: "unknown",
    evidenceRefs: [],
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
    const wasTerminal = ["succeeded", "failed", "cancelled", "unknown"].includes(call.status);
    const isTerminal = ["succeeded", "failed", "cancelled", "unknown"].includes(status);
    // Once a tool result is unknown (for example after cancellation or a
    // process exit), a late success/failure callback is not allowed to rewrite
    // the fact or increment the aggregate counters a second time.
    if (wasTerminal) return;
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

  function recordWarning(value) {
    const warning = boundedText(value, 500).trim();
    if (!warning || state.warnings.includes(warning)) return;
    state.warnings = [...state.warnings, warning].slice(-8);
  }

  function recordTaskContract(contract) {
    if (!contract || typeof contract !== "object") return;
    state.taskContract = JSON.parse(JSON.stringify(contract));
  }

  function recordGoalVerification(result = {}) {
    const executionState = boundedText(result.executionState, 80).toLowerCase();
    const goalState = boundedText(result.goalState, 80).toLowerCase();
    if (executionState) state.executionState = executionState;
    if (goalState) state.goalState = goalState;
    if (Array.isArray(result.evidenceRefs)) state.evidenceRefs = result.evidenceRefs.slice(-64).map((entry) => ({ ...entry }));
    if (Array.isArray(result.warnings)) {
      for (const warning of result.warnings) recordWarning(warning);
    }
  }

  function recordToolFailure(failure = {}) {
    if (!failure || typeof failure !== "object") return;
    const next = {
      toolCallId: boundedText(failure.toolCallId, 180) || null,
      toolName: boundedText(failure.toolName, 120) || "tool",
      category: boundedText(failure.category, 80) || "tool_result",
      code: boundedText(failure.code, 100) || "tool_failed",
      retryable: failure.retryable === true,
      exitCode: Number.isInteger(failure.exitCode) ? failure.exitCode : null,
      attempt: Math.max(1, Number(failure.attempt) || 1),
      maxAttempts: Math.max(1, Number(failure.maxAttempts) || 1),
      count: Math.max(1, Number(failure.count) || 1),
      fingerprint: boundedText(failure.fingerprint, 100) || null,
      argsFingerprint: boundedText(failure.argsFingerprint, 100) || null,
      message: boundedText(failure.message, 500) || null,
      repeatFailureBlocked: failure.repeatFailureBlocked === true,
      recordedAt: boundedText(failure.recordedAt, 40) || new Date().toISOString(),
    };
    const duplicate = state.toolFailures.some((item) => item.toolCallId === next.toolCallId && item.fingerprint === next.fingerprint && item.count === next.count);
    if (!duplicate) state.toolFailures = [...state.toolFailures, next].slice(-MAX_TOOL_FAILURES);
  }

  function recordRecovery(recovery = {}) {
    if (!recovery || typeof recovery !== "object") return;
    const next = {
      toolCallId: boundedText(recovery.toolCallId, 180) || null,
      toolName: boundedText(recovery.toolName, 120) || "tool",
      recovery: boundedText(recovery.recovery, 160) || "tool_retry",
      fromFingerprint: boundedText(recovery.fromFingerprint, 100) || null,
      recordedAt: boundedText(recovery.recordedAt, 40) || new Date().toISOString(),
    };
    const duplicate = state.recoveries.some((item) => item.toolCallId === next.toolCallId && item.recovery === next.recovery && item.fromFingerprint === next.fromFingerprint);
    if (!duplicate) state.recoveries = [...state.recoveries, next].slice(-MAX_RECOVERIES);
  }

  function recordToolRepeat(repeat = {}) {
    if (!repeat || typeof repeat !== "object") return;
    const next = {
      toolName: boundedText(repeat.toolName, 120) || "tool",
      argsHash: boundedText(repeat.argsHash, 100) || null,
      repeatCount: Math.max(1, Number(repeat.repeatCount) || 1),
      action: boundedText(repeat.action, 40) || "reminder",
      recordedAt: boundedText(repeat.recordedAt, 40) || new Date().toISOString(),
    };
    const duplicate = state.toolRepeats.some((item) => item.toolName === next.toolName && item.argsHash === next.argsHash && item.repeatCount === next.repeatCount);
    if (!duplicate) state.toolRepeats = [...state.toolRepeats, next].slice(-MAX_TOOL_REPEATS);
  }

  function recordAuthorizationFact(fact = {}) {
    if (!fact || typeof fact !== "object") return;
    const next = {
      factId: boundedText(fact.factId, 180) || null,
      decision: boundedText(fact.decision, 24) || "allow",
      scope: boundedText(fact.scope, 24) || "operation",
      toolName: boundedText(fact.toolName, 160) || "tool",
      rule: fact.rule && typeof fact.rule === "object"
        ? {
          kind: boundedText(fact.rule.kind, 24) || null,
          ...(fact.rule.value ? { value: boundedText(fact.rule.value, 160) } : {}),
          ...(fact.rule.argsFingerprint ? { argsFingerprint: boundedText(fact.rule.argsFingerprint, 100) } : {}),
        }
        : null,
      argsFingerprint: boundedText(fact.argsFingerprint, 100) || null,
      reusable: fact.reusable !== false,
      source: boundedText(fact.source, 80) || "permission-runtime",
      reason: boundedText(fact.reason, 240) || null,
      createdAt: boundedText(fact.createdAt, 40) || new Date().toISOString(),
    };
    if (!next.factId || !next.rule?.kind) return;
    if (state.authorizationFacts.some((item) => item.factId === next.factId)) return;
    state.authorizationFacts = [...state.authorizationFacts, next].slice(-MAX_AUTHORIZATION_FACTS);
  }

  function recordAuthorizationFacts(facts = []) {
    for (const fact of Array.isArray(facts) ? facts : []) recordAuthorizationFact(fact);
  }

  function recordLifecycleHook(fact = {}) {
    if (!fact || typeof fact !== "object") return;
    const statuses = Array.isArray(fact.result?.results)
      ? fact.result.results.map((item) => boundedText(item?.status, 24) || "unknown")
      : [];
    const next = {
      event: boundedText(fact.event, 80) || "unknown",
      operationId: boundedText(fact.operationId, 180) || state.operationId || null,
      toolCallId: boundedText(fact.toolCallId, 180) || null,
      turnId: boundedText(fact.turnId, 180) || state.turnId || null,
      stepId: boundedText(fact.stepId, 180) || null,
      attempt: Math.max(1, Number(fact.attempt) || 1),
      statuses,
      ignoredDecision: fact.ignoredDecision === true,
      recordedAt: boundedText(fact.recordedAt, 40) || new Date().toISOString(),
    };
    const duplicate = state.lifecycleHooks.some((item) => (
      item.event === next.event
      && item.toolCallId === next.toolCallId
      && item.attempt === next.attempt
      && JSON.stringify(item.statuses) === JSON.stringify(next.statuses)
    ));
    if (!duplicate) state.lifecycleHooks = [...state.lifecycleHooks, next].slice(-MAX_LIFECYCLE_HOOKS);
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

  function recordProviderProjection(projection = {}) {
    if (!projection || typeof projection !== "object") return;
    const anomalies = (Array.isArray(projection.anomalies) ? projection.anomalies : [])
      .filter((item) => item && typeof item === "object")
      .slice(0, 32)
      .map((item) => ({
        code: boundedText(item.code, 100) || "provider_request_anomaly",
        toolCallId: boundedText(item.toolCallId, 180) || null,
        changed: item.changed === true,
        detail: item.detail && typeof item.detail === "object" ? { ...item.detail } : null,
      }));
    if (anomalies.length === 0 && projection.changed !== true) return;
    const next = {
      requestId: boundedText(projection.requestId, 160) || state.requestId,
      operationId: boundedText(projection.operationId, 160) || null,
      mode: boundedText(projection.mode, 32) || "observe",
      changed: projection.changed === true,
      anomalies,
      recordedAt: new Date().toISOString(),
    };
    const duplicate = state.providerProjections.some((item) => (
      item.requestId === next.requestId
      && JSON.stringify(item.anomalies) === JSON.stringify(next.anomalies)
      && item.changed === next.changed
    ));
    if (!duplicate) state.providerProjections = [...state.providerProjections, next].slice(-MAX_PROVIDER_PROJECTIONS);
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

  function replaceArtifactEvidence(entries = []) {
    state.artifactEvidence = (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry && typeof entry === "object")
      .slice(-MAX_ARTIFACT_EVENTS)
      .map((entry) => ({
        paths: [...new Set((Array.isArray(entry.paths) ? entry.paths : []).map((path) => boundedText(path, 500)).filter(Boolean))].slice(0, 8),
        files: (Array.isArray(entry.files) ? entry.files : []).slice(0, 8).map((file) => ({
          path: boundedText(file?.path, 500),
          size: Math.max(0, Number(file?.size) || 0),
          mtimeMs: Math.max(0, Number(file?.mtimeMs) || 0),
          ext: boundedText(file?.ext, 24) || null,
          changedThisTurn: file?.changedThisTurn === true,
          verification: boundedText(file?.verification, 80) || null,
          status: boundedText(file?.status, 40) || "unknown",
          readable: file?.readable === true,
        })),
        producer: boundedText(entry.producer, 120) || "unknown",
        verified: entry.verified === true,
        status: boundedText(entry.status, 40) || "unknown",
        reason: boundedText(entry.reason, 240),
        recordedAt: boundedText(entry.recordedAt, 40) || new Date().toISOString(),
      }));
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
      selected: runtime.selected === true,
      bound: runtime.bound === true,
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
      estimatedTokensSource: boundedText(status.estimatedTokensSource, 40) || "estimated",
      measurement: status.measurement && typeof status.measurement === "object"
        ? {
          source: boundedText(status.measurement.source, 40) || "measured",
          promptTokens: Math.max(0, Number(status.measurement.promptTokens) || 0),
          messageCount: Math.max(0, Number(status.measurement.messageCount) || 0),
          requestId: boundedText(status.measurement.requestId, 240) || null,
          measuredAt: boundedText(status.measurement.measuredAt, 40) || null,
        }
        : null,
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

  function observePhase(event = {}) {
    const result = phaseTracker.observe(event);
    if (result.accepted && result.changed) state.phase = result.state;
    return result;
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
    const taskState = boundedText(value.taskState, 80).trim().toLowerCase();
    const indeterminate = new Set(["unknown", "incomplete", "needs_intervention", "awaiting_approval"]);
    const terminal = value.ok === true && !indeterminate.has(taskState) && taskState !== "cancelled" && taskState !== "failed"
      ? "completed"
      : taskState === "cancelled"
        ? "cancelled"
        : indeterminate.has(taskState)
          ? "unknown"
          : "failed";
    const phaseResult = phaseTracker.finish(terminal, value.error);
    if (!phaseResult.accepted) return false;
    state.phase = phaseResult.state;
    state.completion = {
      ok: value.ok === true,
      taskState: boundedText(value.taskState, 80) || null,
      executionState: boundedText(value.executionState ?? state.executionState, 80) || null,
      goalState: boundedText(value.goalState ?? state.goalState, 80) || null,
      artifactIncomplete: value.artifactIncomplete === true,
      interventionPaused: value.interventionPaused === true,
      continuationNeeded: value.continuationNeeded === true,
      completedAt: new Date().toISOString(),
    };
    return true;
  }

  // A receipt can be finalized as completed before the persistence boundary
  // returns. If that boundary fails, downgrade the local fact to unknown so
  // callers cannot expose a successful but unpersisted result.
  function markUnknown(reason = "execution result could not be persisted") {
    const message = boundedText(reason, 500) || "execution result could not be persisted";
    const now = new Date().toISOString();
    state.phase = {
      ...state.phase,
      phase: "ended",
      terminalState: "unknown",
      reason: message,
      updatedAt: now,
    };
    state.completion = {
      ...(state.completion ?? {}),
      ok: false,
      taskState: "unknown",
      completedAt: now,
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
    recordWarning,
    recordTaskContract,
    recordGoalVerification,
    recordToolFailure,
    recordRecovery,
    recordToolRepeat,
    recordAuthorizationFact,
    recordAuthorizationFacts,
    recordLifecycleHook,
    recordModelRetry,
    recordProviderResult,
    recordProviderProjection,
    recordArtifact,
    replaceArtifactEvidence,
    recordDocumentBinding,
    recordRuntime,
    recordContext,
    recordMedia,
    observePhase,
    claimIntervention,
    resolveIntervention,
    complete,
    markUnknown,
    snapshot,
  };
}
