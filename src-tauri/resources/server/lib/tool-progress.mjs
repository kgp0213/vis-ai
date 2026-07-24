const SENSITIVE_KEY = /^(?:authorization|cookie|set-cookie|password|passwd|secret|token|access[_-]?token|refresh[_-]?token|(?:x[_-]?)?api[_-]?key|apikey|client[_-]?secret|private[_-]?key|(?:aws[_-]?)?secret[_-]?access[_-]?key|(?:aws[_-]?)?access[_-]?key[_-]?id|credentials?)$/i;
const TOOL_STATUSES = new Set(["queued", "running", "succeeded", "failed", "cancelled"]);

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

function inferredStatus(event) {
  if (TOOL_STATUSES.has(event?.toolStatus)) return event.toolStatus;
  if (event?.role === "tool_queued") return "queued";
  if (event?.role === "tool_start") return "running";
  if (event?.role !== "tool") return null;
  const content = String(event?.content ?? "");
  return /(?:\berror\b|\bfailed\b|\[hook block\])/i.test(content) ? "failed" : "succeeded";
}

export function projectToolProgressEvent(event, { assistantId = "assistant" } = {}) {
  const status = inferredStatus(event);
  if (!status || !event?.toolName) return null;
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
  };
}
