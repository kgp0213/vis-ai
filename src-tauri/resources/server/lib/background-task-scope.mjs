function text(value) {
  const result = String(value ?? "").trim();
  return result || null;
}

function taskKey(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? String(number) : null;
}

function normalizeScope(value) {
  if (!value || typeof value !== "object") return null;
  const workspace = text(value.workspace);
  const sessionId = text(value.sessionId);
  if (!workspace || !sessionId) return null;
  return {
    operationId: text(value.operationId),
    workspace,
    sessionId,
  };
}

/**
 * Keeps the immutable location snapshot for process-local background jobs.
 * A missing snapshot is deliberately stored as null and never treated as the
 * current workspace; callers therefore fail closed after a session switch.
 */
export function createBackgroundTaskScopeRegistry({ maxEntries = 256 } = {}) {
  const scopes = new Map();
  const limit = Math.max(16, Number(maxEntries) || 256);

  const remember = (jobId, scope) => {
    const key = taskKey(jobId);
    if (!key) return null;
    const next = normalizeScope(scope);
    if (!scopes.has(key)) {
      scopes.set(key, next);
    } else {
      const current = scopes.get(key) ?? null;
      // A delayed first snapshot may not have enough context yet, so allow a
      // later valid scope to fill that hole. Once a valid scope is recorded,
      // never let contradictory metadata rebind the running process.
      if (!current && next) scopes.set(key, next);
    }
    while (scopes.size > limit) scopes.delete(scopes.keys().next().value);
    return scopes.get(key);
  };

  const get = (jobId) => {
    const key = taskKey(jobId);
    return key ? scopes.get(key) ?? null : null;
  };

  const matches = (jobId, expectedScope) => {
    const actual = get(jobId);
    const expected = normalizeScope(expectedScope);
    return Boolean(actual && expected
      && actual.workspace === expected.workspace
      && actual.sessionId === expected.sessionId);
  };

  const forget = (jobId) => {
    const key = taskKey(jobId);
    return key ? scopes.delete(key) : false;
  };

  return { remember, get, matches, forget, size: () => scopes.size };
}

export { normalizeScope };
