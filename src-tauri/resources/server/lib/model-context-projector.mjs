import { estimateContextTokens } from "./context-budget.mjs";
import { normalizeResourceReference } from "./resource-reference.mjs";

const DEFAULT_CONTEXT_TOKENS = 131072;
const MAX_RESOURCE_REFS = 64;
const INTERNAL_ROLES = new Set(["warning", "error", "info", "status"]);
const CREDENTIAL_KEYS = /(?:api[_-]?key|token|secret|password|authorization|credential)/iu;

function text(value) { return String(value ?? ""); }

function clone(value) {
  try { return structuredClone(value); } catch { return value; }
}

function safeId(value) {
  const result = text(value).trim();
  return result && result.length <= 240 ? result : null;
}

function scalarSafe(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(scalarSafe);
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (CREDENTIAL_KEYS.test(key)) continue;
    result[key] = scalarSafe(item);
  }
  return result;
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => typeof part === "string" ? part : part?.text ?? part?.content ?? "").join("\n");
}

function addResource(resourceRefs, value, defaults = {}) {
  const source = typeof value === "string" ? { resourceId: value } : value && typeof value === "object" ? value : {};
  const resourceId = safeId(source.resourceId ?? source.id ?? source.attachmentId ?? source.path ?? source.readablePath);
  if (!resourceId) return;
  const descriptor = normalizeResourceReference({
    resourceId,
    kind: source.kind ?? defaults.kind ?? "tool-output",
    preview: source.preview ?? source.name ?? "",
    totalBytes: source.totalBytes ?? source.bytes ?? source.size ?? 0,
    offsetBytes: source.offsetBytes ?? 0,
    nextOffsetBytes: source.nextOffsetBytes ?? source.offsetBytes ?? 0,
    complete: source.complete === true,
    expiresAt: source.expiresAt ?? null,
    readAction: source.readAction ?? defaults.readAction ?? null,
  });
  if (descriptor) resourceRefs.set(resourceId, descriptor);
}

function projectContent(content, resourceRefs) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : scalarSafe(content);
  return content.map((part) => {
    if (typeof part === "string") return part;
    const safe = scalarSafe(part ?? {});
    addResource(resourceRefs, safe.resource ?? safe, { kind: "tool-output" });
    return safe;
  });
}

function capacityFrom({ providerCapabilities = {}, contextBudget = {} } = {}) {
  const declared = providerCapabilities?.maxContextTokens
    ?? providerCapabilities?.maxContextLength
    ?? providerCapabilities?.capabilities?.maxContextTokens
    ?? contextBudget?.modelMaxContextTokens
    ?? contextBudget?.modelMaxContextLength
    ?? contextBudget?.effectiveCap
    ?? DEFAULT_CONTEXT_TOKENS;
  const cap = Math.floor(Number(declared));
  const reserved = Math.max(0, Math.floor(Number(contextBudget?.reservedOutputTokens ?? contextBudget?.reserveTokens) || 0));
  return { maxTokens: Number.isSafeInteger(cap) && cap > 0 ? cap : DEFAULT_CONTEXT_TOKENS, reservedTokens: reserved };
}

function collectResources(history, operation, resourceRefs) {
  for (const entry of Array.isArray(history) ? history : []) {
    for (const ref of Array.isArray(entry?.resourceRefs) ? entry.resourceRefs : []) addResource(resourceRefs, ref);
    for (const attachment of Array.isArray(entry?.attachments) ? entry.attachments : []) addResource(resourceRefs, {
      ...(attachment?.resource ?? {}),
      resourceId: attachment?.resourceId ?? attachment?.attachmentId ?? attachment?.id,
      kind: attachment?.resource?.kind ?? attachment?.kind ?? "attachment",
      preview: attachment?.resource?.preview ?? attachment?.name ?? "",
      totalBytes: attachment?.resource?.totalBytes ?? attachment?.size ?? 0,
      readAction: attachment?.resource?.readAction ?? "attachment_content",
    });
  }
  for (const ref of Array.isArray(operation?.resourceRefs) ? operation.resourceRefs : []) addResource(resourceRefs, ref);
  for (const ref of Array.isArray(operation?.preparedDocuments) ? operation.preparedDocuments : []) addResource(resourceRefs, {
    ...ref,
    resourceId: ref?.resourceId ?? ref?.path ?? ref?.readablePath,
    kind: ref?.kind ?? "file",
    readAction: ref?.readAction ?? "read_file",
  });
  for (const ref of Array.isArray(operation?.artifactPaths) ? operation.artifactPaths : []) addResource(resourceRefs, {
    resourceId: ref,
    kind: "artifact",
    readAction: "read_file",
  });
}

function projectEntry(entry, resourceRefs, view) {
  if (!entry || typeof entry !== "object") return null;
  const role = text(entry.role).trim().toLowerCase();
  if (!role || INTERNAL_ROLES.has(role)) return null;
  if (entry.internal === true || entry.uiOnly === true || entry.internalDelivery === true) return null;
  if (!["system", "user", "assistant", "tool"].includes(role)) return null;
  const message = {
    role,
    content: projectContent(entry.content ?? entry.text ?? "", resourceRefs),
  };
  if (entry.name && role === "tool") message.name = text(entry.name).slice(0, 120);
  if (entry.toolCallId || entry.tool_call_id) message.tool_call_id = text(entry.toolCallId ?? entry.tool_call_id).slice(0, 240);
  if (Array.isArray(entry.tool_calls)) {
    message.tool_calls = entry.tool_calls.map((call) => scalarSafe(call)).filter(Boolean);
  }
  if (view === "full") {
    for (const key of ["messageId", "id", "createdAt", "timestamp", "taskState"]) {
      if (entry[key] !== undefined && !CREDENTIAL_KEYS.test(key)) message[key] = scalarSafe(entry[key]);
    }
  }
  return message;
}

function isProtected(message, index, messages) {
  // Always retain system rules and the latest conversational boundary. Tool
  // results are intentionally evictable even when they sit near the tail;
  // their complete contents can be recovered from a resource reference.
  if (index === messages.length - 1 && message.role !== "tool") return true;
  if (message.role === "system") return true;
  return false;
}

function estimateMessages(messages) {
  return estimateContextTokens(messages.reduce((sum, message) => sum + contentText(message.content).length + JSON.stringify(message.tool_calls ?? "").length, 0));
}

function estimateMessagesWithMeasuredPrefix(messages, contextBudget = {}, droppedItems = []) {
  const measuredTokens = Number(contextBudget?.measuredPromptTokens);
  const measuredCount = Number(contextBudget?.measuredMessageCount);
  if (!Number.isFinite(measuredTokens) || measuredTokens < 0
    || !Number.isSafeInteger(measuredCount) || measuredCount < 0
    || droppedItems.length > 0 || measuredCount > messages.length) {
    return { tokens: estimateMessages(messages), applied: false };
  }
  return {
    tokens: Math.max(0, Math.floor(measuredTokens)) + estimateMessages(messages.slice(measuredCount)),
    applied: true,
  };
}

/**
 * Projects durable history into the model-facing request view. This is a pure
 * read operation: it never mutates history, schedules work, or calls a model.
 */
export function projectModelContext({ history = [], operation = {}, providerCapabilities = {}, contextBudget = {}, resourceRefs = [] } = {}) {
  const refs = new Map();
  for (const ref of Array.isArray(resourceRefs) ? resourceRefs : []) addResource(refs, ref);
  collectResources(history, operation, refs);
  const messages = (Array.isArray(history) ? history : []).map((entry) => projectEntry(entry, refs, "model")).filter(Boolean);
  const fullMessages = (Array.isArray(history) ? history : []).map((entry) => projectEntry(entry, refs, "full")).filter(Boolean);
  const { maxTokens, reservedTokens } = capacityFrom({ providerCapabilities, contextBudget });
  const budget = Math.max(1, maxTokens - reservedTokens);
  const retained = [...messages];
  const droppedItems = [];
  while (retained.length > 1 && estimateMessagesWithMeasuredPrefix(retained, contextBudget, droppedItems).tokens > budget) {
    let index = retained.findIndex((message, position) => !isProtected(message, position, retained) && message.role === "tool");
    if (index < 0) index = retained.findIndex((message, position) => !isProtected(message, position, retained));
    if (index < 0) break;
    const [removed] = retained.splice(index, 1);
    droppedItems.push({ index, role: removed.role, chars: contentText(removed.content).length, reason: "context_budget" });
  }
  const measuredEstimate = estimateMessagesWithMeasuredPrefix(retained, contextBudget, droppedItems);
  const estimatedTokens = measuredEstimate.tokens;
  const overflow = estimatedTokens > budget;
  const warnings = [];
  if (droppedItems.length > 0) warnings.push({ code: "context_compacted", message: `已从模型上下文移除 ${droppedItems.length} 条低优先级记录。` });
  if (overflow) warnings.push({ code: "context_overflow", message: "保留的必要消息仍超过模型上下文容量，请减少范围或使用资源分页读取。", retryable: false, action: "缩小范围或继续读取资源" });
  return {
    messages: retained,
    estimatedTokens,
    resources: [...refs.values()].slice(0, MAX_RESOURCE_REFS),
    droppedItems,
    compaction: { applied: droppedItems.length > 0, budgetTokens: budget, protectedTail: Math.min(4, retained.length) },
    measurement: measuredEstimate.applied
      ? {
        source: "measured",
        promptTokens: Math.max(0, Math.floor(Number(contextBudget.measuredPromptTokens))),
        messageCount: Math.max(0, Math.floor(Number(contextBudget.measuredMessageCount))),
        requestId: safeId(contextBudget.measuredRequestId),
        measuredAt: contextBudget.measuredAt ?? null,
      }
      : null,
    warnings,
    error: overflow ? { code: "context_overflow", title: "上下文容量不足", retryable: false, action: "缩小范围或继续读取资源" } : null,
    views: { model: retained, full: fullMessages },
  };
}

export { DEFAULT_CONTEXT_TOKENS };
