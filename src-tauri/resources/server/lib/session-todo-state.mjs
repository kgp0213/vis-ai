const TODO_STATUSES = new Set(["pending", "in_progress", "completed", "cancelled"]);

function text(value, limit = 2000) {
  return String(value ?? "").trim().slice(0, limit);
}

export function normalizeTodoSnapshot(value, index = 0, fallbackId = null) {
  if (!value || typeof value !== "object") return null;
  const content = text(value.content ?? value.title);
  if (!content) return null;
  const status = TODO_STATUSES.has(text(value.status, 40)) ? text(value.status, 40) : "pending";
  return {
    id: text(value.id, 160) || text(fallbackId, 160) || `todo-${index + 1}`,
    content,
    activeForm: text(value.activeForm),
    status,
  };
}

export function normalizeTodoList(value, maxItems = 100, previous = []) {
  const previousByContent = new Map();
  for (const item of Array.isArray(previous) ? previous : []) {
    const content = text(item?.content ?? item?.title);
    const id = text(item?.id, 160);
    if (content && id && !previousByContent.has(content)) previousByContent.set(content, id);
  }
  const usedIds = new Set();
  return (Array.isArray(value) ? value : [])
    .map((item, index) => {
      const explicitId = text(item?.id, 160);
      const content = text(item?.content ?? item?.title);
      const fallbackId = explicitId || (content && previousByContent.has(content) ? previousByContent.get(content) : null);
      const normalized = normalizeTodoSnapshot(item, index, fallbackId);
      if (!normalized) return null;
      let candidate = normalized.id;
      let suffix = 2;
      while (usedIds.has(candidate)) {
        const suffixText = `-${suffix++}`;
        candidate = `${normalized.id.slice(0, Math.max(1, 160 - suffixText.length))}${suffixText}`;
      }
      normalized.id = candidate;
      usedIds.add(candidate);
      return normalized;
    })
    .filter(Boolean)
    .slice(0, Math.max(1, Math.min(200, Number(maxItems) || 100)));
}

export function isTodoScopeCurrent({ operationId, sessionId, activeOperationId, activeSessionId } = {}) {
  const operation = text(operationId, 160);
  const activeOperation = text(activeOperationId, 160);
  const session = text(sessionId, 240);
  const activeSession = text(activeSessionId, 240);
  return Boolean(operation && activeOperation && operation === activeOperation && session && activeSession && session === activeSession);
}
