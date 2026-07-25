const FINISH_REASONS = new Map([
  ["stop", "completed"],
  ["end_turn", "completed"],
  ["completed", "completed"],
  ["tool_calls", "tool_call"],
  ["function_call", "tool_call"],
  ["length", "truncated"],
  ["max_tokens", "truncated"],
  ["content_filter", "filtered"],
  ["cancelled", "cancelled"],
  ["canceled", "cancelled"],
]);

function text(value, fallback = "") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function intOrNull(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function clone(value) {
  try { return structuredClone(value); } catch { return value; }
}

export function normalizeFinishReason(value) {
  const raw = text(value).toLowerCase();
  return FINISH_REASONS.get(raw) ?? (raw ? "unknown" : null);
}

export function normalizeProviderResult(input = {}) {
  const rawFinishReason = text(input.rawFinishReason ?? input.finishReason ?? input.finish_reason ?? input.choices?.[0]?.finish_reason) || null;
  const finishReason = normalizeFinishReason(rawFinishReason);
  const statusCode = intOrNull(input.statusCode ?? input.status);
  const cancelled = input.cancelled === true || finishReason === "cancelled";
  const retryable = input.retryable === true
    || (!cancelled && [408, 409, 425, 429].includes(statusCode))
    || (statusCode !== null && statusCode >= 500);
  return {
    requestId: text(input.requestId ?? input.id) || null,
    attempt: Math.max(1, intOrNull(input.attempt) ?? 1),
    statusCode,
    finishReason,
    rawFinishReason,
    usage: input.usage && typeof input.usage === "object" ? clone(input.usage) : null,
    traceId: text(input.traceId ?? input.headers?.["x-request-id"] ?? input.headers?.["x-trace-id"]) || null,
    cancelled,
    retryable,
  };
}

export function classifyProviderResult(result = {}) {
  const normalized = normalizeProviderResult(result);
  if (normalized.cancelled) return { ...normalized, outcome: "cancelled", code: "operation_cancelled" };
  if (normalized.statusCode === 401 || normalized.statusCode === 403) return { ...normalized, outcome: "failed", code: "provider_auth_failed" };
  if (normalized.statusCode === 429) return { ...normalized, outcome: "failed", code: "provider_rate_limited" };
  if (normalized.statusCode !== null && normalized.statusCode >= 500) return { ...normalized, outcome: "failed", code: "provider_server_error" };
  if (normalized.finishReason === "truncated") return { ...normalized, outcome: "incomplete", code: "provider_output_truncated" };
  if (normalized.finishReason === "filtered") return { ...normalized, outcome: "incomplete", code: "provider_content_filtered" };
  if (normalized.finishReason === "tool_call") return { ...normalized, outcome: "tool_call", code: null };
  if (normalized.finishReason === "completed") return { ...normalized, outcome: "completed", code: null };
  return { ...normalized, outcome: "unknown", code: "provider_result_unknown" };
}
