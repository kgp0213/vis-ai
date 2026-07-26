const SENSITIVE_KEY = /^(?:authorization|cookie|set-cookie|password|passwd|secret|token|access[_-]?token|refresh[_-]?token|(?:x[_-]?)?api[_-]?key|apikey|client[_-]?secret|private[_-]?key|(?:aws[_-]?)?secret[_-]?access[_-]?key|(?:aws[_-]?)?access[_-]?key[_-]?id|credentials?)$/i;
const EXIT_CODE_RE = /\[exit\s+(-?\d+)\]/ig;
const TIMEOUT_RE = /\[(?:killed after timeout|timeout)\]|\b(?:timed\s*out|execution timed out|command timed out)\b/i;
// Do not classify ordinary prose such as "the request was not cancelled"
// as a cancellation. Only recognize the runner's explicit cancellation forms.
const CANCELLED_RE = /(?:^\s*\[(?:aborted|cancelled|canceled)\]\s*$|\b(?:aborterror|abort_err)\b|\b(?:tool|command|operation|request)\s+(?:was\s+)?(?:aborted|cancelled|canceled)\b|\b(?:aborted|cancelled|canceled)\s+by\s+(?:user|request|signal)\b)/i;
// A tool's ordinary prose may mention "error:" while still reporting a
// successful result. Only a line-start failure marker is considered textual
// evidence; structured errors, exit codes and runtime diagnostics remain
// authoritative.
const FAILURE_RE = /^\s*(?:error|failed|failure|denied|exception)\s*:/imu;
const RUNTIME_DIAGNOSTICS = [
  { pattern: /Python was not found|No suitable Python runtime found|(?:^|\n)\s*(?:python(?:\.exe)?|python3(?:\.exe)?|py(?:\.exe)?)\s*:\s*(?:command not found|not found)|['"](?:python|python3|py|node|npm)(?:\.exe|\.cmd)?['"]?\s+is not recognized as an internal or external command/iu, category: "environment", code: "runtime_not_found", retryable: true, action: "reuse_registered_runtime" },
  { pattern: /(?:Cannot find module|MODULE_NOT_FOUND)/iu, category: "environment", code: "module_not_found", retryable: true, action: "resolve_registered_runtime" },
  { pattern: /DOMMatrix is not defined|Please use the `legacy` build/iu, category: "environment", code: "runtime_incompatible", retryable: true, action: "use_compatible_runtime_entry" },
  { pattern: /Setting up fake worker failed|Received protocol ['"]c:/iu, category: "environment", code: "runtime_incompatible", retryable: true, action: "normalize_windows_worker_url" },
];

function redactString(value, limit = 4000) {
  return String(value ?? "")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+/gi, "$1 [REDACTED]")
    .replace(/\b((?:aws[_ -]?)?secret[_ -]?access[_ -]?key|(?:aws[_ -]?)?access[_ -]?key[_ -]?id|api[_ -]?key|client[_ -]?secret|private[_ -]?key|credentials?|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, limit);
}

export function redactToolProgressValue(value, { maxDepth = 6, maxText = 4000 } = {}, depth = 0, seen = new WeakSet()) {
  if (typeof value === "string") return redactString(value, maxText);
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (depth >= maxDepth || seen.has(value)) return "[TRUNCATED]";
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 64).map((item) => redactToolProgressValue(item, { maxDepth, maxText }, depth + 1, seen));
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 64)) {
    result[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactToolProgressValue(item, { maxDepth, maxText }, depth + 1, seen);
  }
  return result;
}

function safeArgs(value) {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return redactString(value, 2000); }
  }
  try { return JSON.stringify(redactToolProgressValue(parsed, { maxText: 2000 })); } catch { return "{}"; }
}

function safeContent(value) {
  const text = String(value ?? "");
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(redactToolProgressValue(parsed, { maxText: 4000 })).slice(0, 4000);
  } catch {
    return redactString(text, 4000);
  }
}

function parseStructuredResult(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function runtimeDiagnostic(raw) {
  return RUNTIME_DIAGNOSTICS.find((item) => item.pattern.test(raw)) ?? null;
}

/**
 * Normalize the facts exposed by a tool result. The command runner currently
 * returns a human-readable string, so exit markers must be treated as facts,
 * not as an informal hint for the UI.
 */
export function normalizeToolOutcome(value, { role = "tool", status = null } = {}) {
  const raw = String(value ?? "").trim();
  const parsed = parseStructuredResult(value);
  let exitMatch = null;
  for (const match of raw.matchAll(EXIT_CODE_RE)) exitMatch = match;
  const structuredExitCode = parsed?.exitCode;
  const hasStructuredExitCode = (typeof structuredExitCode === "number" && Number.isFinite(structuredExitCode))
    || (typeof structuredExitCode === "string" && structuredExitCode.trim() !== "" && Number.isFinite(Number(structuredExitCode)));
  const exitCode = exitMatch
    ? Number(exitMatch[1])
    : hasStructuredExitCode ? Number(structuredExitCode) : null;
  const timedOut = parsed?.timedOut === true || TIMEOUT_RE.test(raw);
  const statusCancelled = status === "cancelled";
  const cancelled = statusCancelled || parsed?.cancelled === true || parsed?.aborted === true || CANCELLED_RE.test(raw);
  const hasStructuredError = Boolean(parsed && Object.prototype.hasOwnProperty.call(parsed, "error") && parsed.error !== null && parsed.error !== undefined);
  const textualFailure = FAILURE_RE.test(raw);
  const explicitFailure = parsed?.ok === false || hasStructuredError;
  const structuredCode = explicitFailure && typeof parsed?.code === "string" && parsed.code.trim() ? parsed.code.trim().slice(0, 100) : null;
  const structuredCategory = explicitFailure && typeof parsed?.category === "string" && parsed.category.trim() ? parsed.category.trim().slice(0, 80) : null;
  const structuredAction = explicitFailure && typeof parsed?.recommendedAction === "string" && parsed.recommendedAction.trim() ? parsed.recommendedAction.trim().slice(0, 160) : null;
  const structuredRetryable = explicitFailure && parsed?.retryable === true;
  const rawDiagnostic = runtimeDiagnostic(raw);
  // Structured error facts are authoritative. Only infer a runtime category
  // from text when the structured result did not provide an equivalent fact.
  const diagnostic = explicitFailure && (structuredCode || structuredCategory || structuredAction || structuredRetryable)
    ? null
    : rawDiagnostic;
  const structuredWarnings = Array.isArray(parsed?.warnings)
    ? parsed.warnings.map((warning) => redactString(warning, 500)).filter(Boolean).slice(0, 8)
    : typeof parsed?.warning === "string" && parsed.warning.trim() ? [redactString(parsed.warning, 500)] : [];
  const statusFailure = status === "failed";
  const statusSucceeded = status === "succeeded";
  const hasExplicitOk = typeof parsed?.ok === "boolean";
  let ok;
  if (timedOut || cancelled || explicitFailure || statusFailure || statusCancelled || diagnostic) ok = false;
  else if (exitCode !== null) ok = exitCode === 0;
  else if (hasExplicitOk) ok = parsed.ok === true;
  else if (textualFailure) ok = false;
  else if (statusSucceeded) ok = true;
  else ok = role !== "tool" || raw.length > 0;

  const normalizedStatus = status && ["queued", "running"].includes(status)
    ? status
    : statusCancelled || cancelled ? "cancelled" : ok ? "succeeded" : "failed";
  const code = diagnostic?.code ?? structuredCode ?? (
    timedOut
      ? "tool_timeout"
      : cancelled
        ? "tool_cancelled"
        : exitCode !== null && exitCode !== 0
          ? "tool_exit_nonzero"
          : statusFailure
            ? "tool_failed"
              : explicitFailure || (textualFailure && exitCode === null)
                ? "tool_failed"
              : null
  );
  const message = hasStructuredError
    ? (typeof parsed.error === "string" && parsed.error ? parsed.error : "工具返回结构化错误")
    : diagnostic
      ? raw.split(/\r?\n/u).find((line) => diagnostic.pattern.test(line)) || diagnostic.code
    : timedOut
      ? "工具执行超时"
      : cancelled
        ? "工具执行已取消"
        : exitCode !== null && exitCode !== 0
          ? `工具以退出码 ${exitCode} 结束`
          : ok ? null : raw.slice(0, 500);
  return {
    ok: normalizedStatus === "succeeded",
    status: normalizedStatus,
    exitCode: Number.isInteger(exitCode) ? exitCode : null,
    timedOut,
    cancelled,
    retryable: diagnostic?.retryable === true || structuredRetryable || timedOut === true,
    code,
    category: diagnostic?.category ?? structuredCategory ?? (timedOut ? "transient" : cancelled ? "cancelled" : !ok ? "tool_result" : null),
    recommendedAction: diagnostic?.action ?? structuredAction ?? (timedOut ? "retry_once" : cancelled ? "stop_operation" : !ok ? "inspect_tool_result" : null),
    message: message ? redactString(message, 500) : null,
    warnings: structuredWarnings,
    details: {
      hasOutput: raw.length > 0,
      structured: Boolean(parsed),
    },
  };
}

function inferredStatus(event) {
  if (event?.role === "tool_queued") return "queued";
  if (event?.role === "tool_start") return "running";
  if (event?.role !== "tool") return null;
  const outcome = normalizeToolOutcome(event.content, {
    role: event.role,
    status: event.toolStatus,
  });
  return outcome.status;
}

function outcomeForEvent(event) {
  if (event?.role !== "tool") return null;
  return normalizeToolOutcome(event.content, { role: event.role, status: event.toolStatus });
}

export function projectToolProgressEvent(event, { assistantId = "assistant" } = {}) {
  const status = inferredStatus(event);
  if (!status || !event?.toolName) return null;
  const outcome = outcomeForEvent(event);
  const toolCallId = String(event.callId ?? event.toolCallId ?? event.id ?? "unknown");
  const id = `${assistantId}-tool-${toolCallId}`;
  return {
    kind: status === "succeeded" || status === "failed" || status === "cancelled" ? "tool" : "tool_start",
    id,
    toolCallId,
    status,
    toolName: String(event.toolName).slice(0, 160),
    args: safeArgs(event.toolArgs),
    content: event.role === "tool" ? safeContent(event.content) : "",
    ...(outcome ? {
      ok: outcome.ok,
      exitCode: outcome.exitCode,
      timedOut: outcome.timedOut,
      cancelled: outcome.cancelled,
      retryable: outcome.retryable,
      code: outcome.code,
      category: outcome.category,
      recommendedAction: outcome.recommendedAction,
      message: outcome.message,
      warnings: outcome.warnings,
    } : {}),
  };
}
