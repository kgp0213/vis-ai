import { createHash } from "node:crypto";

const VOLATILE_KEYS = new Set([
  "createdAt",
  "timestamp",
  "recordedAt",
  "messageId",
  "taskState",
  "receipt",
  "usage",
]);

function text(value) {
  return String(value ?? "");
}

function finiteNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function normalizeForFingerprint(value, key = "") {
  if (VOLATILE_KEYS.has(key)) return undefined;
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeForFingerprint(item));
  const result = {};
  for (const name of Object.keys(value).sort()) {
    const normalized = normalizeForFingerprint(value[name], name);
    if (normalized !== undefined) result[name] = normalized;
  }
  return result;
}

function digest(value) {
  let serialized;
  try {
    serialized = JSON.stringify(normalizeForFingerprint(value));
  } catch {
    // A malformed/cyclic diagnostic object must not brick the model loop;
    // callers will simply fail the prefix comparison on this fallback hash.
    serialized = text(value);
  }
  return createHash("sha256")
    .update(serialized)
    .digest("hex");
}

function normalizeHistory(history) {
  return Array.isArray(history) ? history.filter((entry) => entry && typeof entry === "object") : [];
}

function messageFingerprints(history) {
  return normalizeHistory(history).map((entry) => digest(entry));
}

function scopeKey({ scopeKey, operationId, sessionId, model } = {}) {
  const explicit = text(scopeKey).trim();
  if (explicit) return explicit.slice(0, 512);
  return [operationId, sessionId, model].map((value) => text(value).trim() || "-").join("|");
}

/**
 * Returns the provider-reported input/prompt token count without accepting an
 * output-only or aggregate value that cannot describe the request context.
 */
export function extractMeasuredPromptTokens(usage) {
  if (!usage || typeof usage !== "object") return null;
  for (const key of ["prompt_tokens", "input_tokens", "promptTokens", "inputTokens"]) {
    const value = finiteNonNegativeInteger(usage[key]);
    if (value !== null) return value;
  }
  const total = finiteNonNegativeInteger(usage.total_tokens ?? usage.totalTokens);
  const output = finiteNonNegativeInteger(usage.completion_tokens ?? usage.output_tokens ?? usage.outputTokens);
  if (total !== null && output !== null && total >= output) return total - output;
  return null;
}

export function historyFingerprint(history) {
  return digest(messageFingerprints(history));
}

/**
 * Tool schemas are sent as a provider request field rather than as messages.
 * Keep them in the measurement identity so dynamic tool registration cannot
 * reuse a prompt count from a different request shape.
 */
export function contextRequestShapeFingerprint({ toolSpecs = [] } = {}) {
  return digest(Array.isArray(toolSpecs) ? toolSpecs : []);
}

/**
 * Keeps provider measurements scoped to one operation/session/model and only
 * applies a measured prefix when the current history still contains it.
 */
export function createContextSizeCalibration({ now = () => new Date().toISOString() } = {}) {
  const scopes = new Map();

  function stateFor(input = {}) {
    const key = scopeKey(input);
    let state = scopes.get(key);
    if (!state) {
      state = { key, pending: null, measured: null, invalidatedAt: null };
      scopes.set(key, state);
    }
    return state;
  }

  function begin(input = {}) {
    const state = stateFor(input);
    const fingerprints = messageFingerprints(input.history);
    const requestId = text(input.requestId).trim().slice(0, 240) || null;
    state.pending = {
      requestId,
      model: text(input.model).trim().slice(0, 160) || null,
      historyFingerprint: digest(fingerprints),
      messageFingerprints: fingerprints,
      messageCount: fingerprints.length,
      requestShapeFingerprint: text(input.requestShapeFingerprint).trim() || null,
      startedAt: now(),
    };
    return {
      scopeKey: state.key,
      requestId,
      historyFingerprint: state.pending.historyFingerprint,
      messageCount: fingerprints.length,
      requestShapeFingerprint: state.pending.requestShapeFingerprint,
      measured: get(input),
    };
  }

  function record(input = {}) {
    const state = stateFor(input);
    const pending = state.pending;
    const actualRequestId = text(input.requestId).trim() || null;
    const actualShapeFingerprint = text(input.requestShapeFingerprint).trim() || null;
    const fingerprints = messageFingerprints(input.history);
    const actualFingerprint = text(input.historyFingerprint).trim() || digest(fingerprints);
    if (!pending) return { accepted: false, reason: "no_pending_request" };
    // A request id is the identity anchor for provider usage.  Accepting a
    // callback without it would allow a stale assistant_final event to be
    // attached to the current request merely because the history happened to
    // look the same.
    if (pending.requestId && actualRequestId !== pending.requestId) {
      return { accepted: false, reason: "request_mismatch" };
    }
    if (pending.requestShapeFingerprint && actualShapeFingerprint !== pending.requestShapeFingerprint) {
      return { accepted: false, reason: "request_shape_mismatch" };
    }
    if (pending.historyFingerprint !== actualFingerprint) {
      return { accepted: false, reason: "history_mismatch" };
    }
    const tokens = extractMeasuredPromptTokens(input.usage);
    if (tokens === null) return { accepted: false, reason: "usage_missing" };
    state.measured = {
      requestId: pending.requestId || actualRequestId,
      model: pending.model,
      historyFingerprint: pending.historyFingerprint,
      messageFingerprints: pending.messageFingerprints,
      messageCount: pending.messageCount,
      requestShapeFingerprint: pending.requestShapeFingerprint,
      promptTokens: tokens,
      measuredAt: now(),
    };
    state.pending = null;
    return {
      accepted: true,
      source: "measured",
      requestId: state.measured.requestId,
      promptTokens: tokens,
      messageCount: state.measured.messageCount,
      measuredAt: state.measured.measuredAt,
    };
  }

  function get(input = {}) {
    const state = stateFor(input);
    const measured = state.measured;
    if (!measured) return null;
    const current = messageFingerprints(input.history);
    if (current.length < measured.messageCount) return null;
    if (measured.requestShapeFingerprint
      && text(input.requestShapeFingerprint).trim() !== measured.requestShapeFingerprint) return null;
    for (let index = 0; index < measured.messageCount; index += 1) {
      if (current[index] !== measured.messageFingerprints[index]) return null;
    }
    return {
      source: "measured",
      requestId: measured.requestId,
      measuredPromptTokens: measured.promptTokens,
      measuredMessageCount: measured.messageCount,
      measuredAt: measured.measuredAt,
      historyFingerprint: measured.historyFingerprint,
      requestShapeFingerprint: measured.requestShapeFingerprint,
      appendedMessageCount: Math.max(0, current.length - measured.messageCount),
    };
  }

  function invalidate(input = {}, reason = "context_changed") {
    const state = stateFor(input);
    const hadValue = Boolean(state.pending || state.measured);
    state.pending = null;
    state.measured = null;
    state.invalidatedAt = { at: now(), reason: text(reason).slice(0, 160) || "context_changed" };
    return hadValue;
  }

  function snapshot(input = {}) {
    const state = stateFor(input);
    return {
      scopeKey: state.key,
      pending: state.pending ? {
        requestId: state.pending.requestId,
        historyFingerprint: state.pending.historyFingerprint,
        messageCount: state.pending.messageCount,
        requestShapeFingerprint: state.pending.requestShapeFingerprint,
        startedAt: state.pending.startedAt,
      } : null,
      measured: state.measured ? {
        requestId: state.measured.requestId,
        promptTokens: state.measured.promptTokens,
        messageCount: state.measured.messageCount,
        requestShapeFingerprint: state.measured.requestShapeFingerprint,
        measuredAt: state.measured.measuredAt,
      } : null,
      invalidatedAt: state.invalidatedAt,
    };
  }

  function clear(input = {}) {
    return scopes.delete(scopeKey(input));
  }

  return { begin, record, get, invalidate, snapshot, clear };
}
