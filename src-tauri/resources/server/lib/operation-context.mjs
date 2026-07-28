import { createHash } from "node:crypto";

const CONTEXT_VERSION = 1;
const MAX_TOOL_FAILURES = 32;
const MAX_RECOVERIES = 32;
const MAX_FAILURE_FINGERPRINTS = 64;
const MAX_AUTHORIZATION_FACTS = 32;
const MAX_TOOL_SUCCESSES = 64;

function boundedText(value, limit = 320) {
  return String(value ?? "").trim().slice(0, limit);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value ?? ""), "utf8").digest("hex")}`;
}

function argsFingerprint(value) {
  if (value === null || value === undefined) return null;
  let normalized = value;
  if (typeof value === "string") {
    try { normalized = JSON.parse(value); } catch { normalized = value; }
  }
  try { return sha256(JSON.stringify(stableValue(normalized))); } catch { return sha256(String(value)); }
}

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
    runtimeBindings: {},
    runtimeEnvironments: [],
    toolFailures: [],
    toolSuccesses: [],
    recoveries: [],
    toolRepeats: [],
    authorizationFacts: [],
    failureFingerprints: {},
    artifactBaseline: [],
    receipt: null,
  };
}

export function recordOperationToolSuccessFact(context, {
  toolCallId = null,
  toolName = null,
  args = null,
  recordedAt = new Date().toISOString(),
} = {}) {
  if (!context || typeof context !== "object") return null;
  const fact = {
    toolCallId: boundedText(toolCallId, 180) || null,
    toolName: boundedText(toolName, 120) || "tool",
    argsFingerprint: argsFingerprint(args),
    status: "succeeded",
    recordedAt,
  };
  const duplicate = [...(Array.isArray(context.toolSuccesses) ? context.toolSuccesses : [])]
    .reverse()
    .find((item) => item.toolCallId && fact.toolCallId && item.toolCallId === fact.toolCallId);
  if (duplicate) return duplicate;
  context.toolSuccesses = [...(Array.isArray(context.toolSuccesses) ? context.toolSuccesses : []), fact].slice(-MAX_TOOL_SUCCESSES);
  return fact;
}

export function recordOperationAuthorizationFact(context, fact = {}) {
  if (!context || typeof context !== "object" || !fact || typeof fact !== "object") return null;
  const normalized = {
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
  if (!normalized.factId || !normalized.rule?.kind) return null;
  const existing = (Array.isArray(context.authorizationFacts) ? context.authorizationFacts : [])
    .find((item) => item.factId === normalized.factId);
  if (existing) return existing;
  context.authorizationFacts = [
    ...(Array.isArray(context.authorizationFacts) ? context.authorizationFacts : []),
    normalized,
  ].slice(-MAX_AUTHORIZATION_FACTS);
  return normalized;
}

export function recordOperationToolFailure(context, {
  toolCallId = null,
  toolName = null,
  args = null,
  outcome = null,
  attempt = 1,
  maxAttempts = 2,
  recordedAt = new Date().toISOString(),
} = {}) {
  if (!context || typeof context !== "object") return null;
  const normalizedOutcome = outcome && typeof outcome === "object" ? outcome : {};
  const name = boundedText(toolName, 120) || "tool";
  const code = boundedText(normalizedOutcome.code, 100) || "tool_failed";
  const exitCode = Number.isInteger(normalizedOutcome.exitCode) ? normalizedOutcome.exitCode : null;
  const argsHash = argsFingerprint(args);
  const fingerprint = sha256(JSON.stringify({ name, code, exitCode, argsHash }));
  const limit = Math.max(1, Math.min(10, Number(maxAttempts) || 2));
  const priorRecord = toolCallId
    ? [...(Array.isArray(context.toolFailures) ? context.toolFailures : [])].reverse().find((item) => item.toolCallId === String(toolCallId) && item.fingerprint === fingerprint)
    : null;
  // Event streams may replay the same terminal tool fact. Do not turn a
  // duplicate event into a new retry attempt or trip the repeat guard early.
  if (priorRecord) return { ...priorRecord, repeatFailureBlocked: priorRecord.count >= limit };
  const previousCount = Number(context.failureFingerprints?.[fingerprint]) || 0;
  const count = previousCount + 1;
  const failureFingerprints = { ...(context.failureFingerprints || {}), [fingerprint]: count };
  const fingerprintKeys = Object.keys(failureFingerprints);
  if (fingerprintKeys.length > MAX_FAILURE_FINGERPRINTS) {
    for (const key of fingerprintKeys.slice(0, fingerprintKeys.length - MAX_FAILURE_FINGERPRINTS)) delete failureFingerprints[key];
  }
  context.failureFingerprints = failureFingerprints;
  const record = {
    toolCallId: boundedText(toolCallId, 180) || null,
    toolName: name,
    category: boundedText(normalizedOutcome.category, 80) || "tool_result",
    code,
    retryable: normalizedOutcome.retryable === true,
    exitCode,
    attempt: Math.max(1, Number(attempt) || 1),
    maxAttempts: limit,
    count,
    fingerprint,
    argsFingerprint: argsHash,
    message: boundedText(normalizedOutcome.message, 500) || null,
    recordedAt,
  };
  context.toolFailures = [...(Array.isArray(context.toolFailures) ? context.toolFailures : []), record].slice(-MAX_TOOL_FAILURES);
  return { ...record, repeatFailureBlocked: count >= limit };
}

export function recordOperationToolSuccess(context, {
  toolName = null,
  args = null,
} = {}) {
  if (!context || typeof context !== "object") return null;
  const name = boundedText(toolName, 120) || "tool";
  const argsHash = argsFingerprint(args);
  if (!argsHash) return null;
  const matches = [...(Array.isArray(context.toolFailures) ? context.toolFailures : [])]
    .filter((item) => item.toolName === name && item.argsFingerprint === argsHash
      && Object.prototype.hasOwnProperty.call(context.failureFingerprints || {}, item.fingerprint)
      && (Number(context.failureFingerprints[item.fingerprint]) || 0) > 0);
  const matching = matches.at(-1);
  if (!matching) return null;
  const reset = { ...context.failureFingerprints };
  for (const item of matches) reset[item.fingerprint] = 0;
  context.failureFingerprints = reset;
  return matching;
}

export function shouldBlockRepeatedToolFailure(context, {
  toolName = null,
  args = null,
  maxAttempts = 2,
} = {}) {
  if (!context || context.state !== "running") return { blocked: false, failure: null };
  const name = boundedText(toolName, 120) || "tool";
  const argsHash = argsFingerprint(args);
  if (!argsHash) return { blocked: false, failure: null };
  const limit = Math.max(1, Math.min(10, Number(maxAttempts) || 2));
  const failure = [...(Array.isArray(context.toolFailures) ? context.toolFailures : [])]
    .reverse()
    .find((item) => {
      if (item.toolName !== name || item.argsFingerprint !== argsHash) return false;
      // A successful recovery resets the active consecutive-failure counter
      // while retaining the historical failure in the receipt.
      const hasActiveCount = Object.prototype.hasOwnProperty.call(context.failureFingerprints || {}, item.fingerprint);
      const activeCount = hasActiveCount ? Number(context.failureFingerprints[item.fingerprint]) || 0 : Number(item.count) || 0;
      return activeCount >= Math.max(limit, Number(item.maxAttempts) || limit);
    });
  return failure ? { blocked: true, failure } : { blocked: false, failure: null };
}

export function recordOperationRecovery(context, {
  toolCallId = null,
  toolName = null,
  recovery = null,
  fromFingerprint = null,
  recordedAt = new Date().toISOString(),
} = {}) {
  if (!context || typeof context !== "object") return null;
  const record = {
    toolCallId: boundedText(toolCallId, 180) || null,
    toolName: boundedText(toolName, 120) || "tool",
    recovery: boundedText(recovery, 160) || "tool_retry",
    fromFingerprint: boundedText(fromFingerprint, 100) || null,
    recordedAt,
  };
  const duplicate = [...(Array.isArray(context.recoveries) ? context.recoveries : [])].reverse().find((item) => item.toolCallId === record.toolCallId && item.toolName === record.toolName && item.recovery === record.recovery && item.fromFingerprint === record.fromFingerprint);
  if (duplicate) return duplicate;
  context.recoveries = [...(Array.isArray(context.recoveries) ? context.recoveries : []), record].slice(-MAX_RECOVERIES);
  if (record.fromFingerprint && context.failureFingerprints && Object.prototype.hasOwnProperty.call(context.failureFingerprints, record.fromFingerprint)) {
    context.failureFingerprints = { ...context.failureFingerprints, [record.fromFingerprint]: 0 };
  }
  return record;
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
