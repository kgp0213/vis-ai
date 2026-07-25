const TERMINAL_PROMPT_STATES = new Set(["applied", "not_applied", "expired", "cancelled"]);

function text(value) { return String(value ?? "").trim(); }

function id(value, fallback) {
  const result = text(value);
  return result || fallback;
}

export function normalizeGoal(value = {}, fallbackId = "goal-1") {
  const status = ["active", "completed", "cancelled", "unknown"].includes(text(value.status))
    ? text(value.status)
    : "active";
  return {
    id: id(value.id ?? value.goalId, fallbackId),
    title: text(value.title ?? value.text ?? value.goal),
    status,
    sessionId: text(value.sessionId) || null,
    updatedAt: text(value.updatedAt) || null,
  };
}

export function normalizeTodo(value = {}, fallbackId = "todo-1") {
  const status = ["pending", "in_progress", "completed", "cancelled"].includes(text(value.status)) ? text(value.status) : "pending";
  return {
    id: id(value.id ?? value.todoId, fallbackId),
    title: text(value.title ?? value.text ?? value.content),
    activeForm: text(value.activeForm) || null,
    status,
    goalId: text(value.goalId) || null,
    sessionId: text(value.sessionId) || null,
    updatedAt: text(value.updatedAt) || null,
  };
}

export function normalizePromptSteering(value = {}, fallbackId = "prompt-1") {
  const status = TERMINAL_PROMPT_STATES.has(text(value.status)) || text(value.status) === "queued" ? text(value.status) : "queued";
  const resolution = value.resolution && typeof value.resolution === "object"
    ? {
      ...(text(value.resolution.appliedAt) ? { appliedAt: text(value.resolution.appliedAt) } : {}),
      ...(text(value.resolution.resolvedAt) ? { resolvedAt: text(value.resolution.resolvedAt) } : {}),
      ...(text(value.resolution.boundary) ? { boundary: text(value.resolution.boundary) } : {}),
      ...(text(value.resolution.reason) ? { reason: text(value.resolution.reason).slice(0, 160) } : {}),
    }
    : null;
  return {
    id: id(value.id ?? value.promptId, fallbackId),
    operationId: text(value.operationId) || null,
    sessionId: text(value.sessionId) || null,
    instructionLength: Math.max(0, Number(value.instructionLength) || text(value.instruction).length),
    status,
    createdAt: text(value.createdAt) || null,
    resolution,
  };
}

export function upsertEntity(map, value, normalizer, fallbackId) {
  const next = normalizer(value, fallbackId);
  const previous = map?.[next.id];
  if (previous?.status && TERMINAL_PROMPT_STATES.has(previous.status) && previous.status !== next.status) return { map: { ...(map ?? {}) }, changed: false, ignored: true };
  return { map: { ...(map ?? {}), [next.id]: { ...previous, ...next } }, changed: JSON.stringify(previous) !== JSON.stringify({ ...previous, ...next }), ignored: false };
}
