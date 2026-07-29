function requiredText(value, field) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new TypeError(`agent input ${field} is required`);
  return text;
}

function normalizeInput(value) {
  if (!value || typeof value !== "object") throw new TypeError("agent input is required");
  const delivery = value.delivery === "steer" ? "steer" : "queue";
  return {
    ...value,
    schemaVersion: 1,
    inputId: requiredText(value.inputId, "inputId"),
    requestId: requiredText(value.requestId, "requestId"),
    sessionId: requiredText(value.sessionId, "sessionId"),
    workspace: requiredText(value.workspace, "workspace"),
    text: typeof value.text === "string" ? value.text : "",
    attachments: Array.isArray(value.attachments) ? [...value.attachments] : [],
    delivery,
    origin: value.origin && typeof value.origin === "object" ? { ...value.origin } : { kind: "user" },
  };
}

function bindingScope(value) {
  if (!value || typeof value !== "object") return null;
  const sessionId = typeof value.sessionId === "string" ? value.sessionId.trim() : "";
  const workspace = typeof value.workspace === "string" ? value.workspace.trim() : "";
  return sessionId && workspace ? { sessionId, workspace } : null;
}

/**
 * Coordinates inputs around the application's one ordinary model/tool loop.
 * Execution remains owned by executeTurn; this runtime only admits, orders,
 * isolates and deduplicates work at Session boundaries.
 */
export function createAgentSessionRuntime({
  getActiveBinding = () => null,
  executeTurn,
  steerTurn = null,
  maxQueuedPerSession = 64,
  maxRecentInputIds = 4096,
  onError = (error) => console.error(`[agent-session-runtime] ${error?.message || error}`),
} = {}) {
  if (typeof executeTurn !== "function") throw new TypeError("agent session executeTurn is required");
  if (steerTurn !== null && typeof steerTurn !== "function") {
    throw new TypeError("agent session steerTurn must be a function");
  }

  const inboxes = new Map();
  const pendingInputIds = new Set();
  const recentInputIds = new Set();
  const idleWaiters = new Map();
  const queueLimit = Math.max(1, Math.min(1024, Math.floor(Number(maxQueuedPerSession) || 64)));
  const recentLimit = Math.max(1, Math.min(100_000, Math.floor(Number(maxRecentInputIds) || 4096)));
  let activeTurn = null;
  let drainScheduled = false;

  function inbox(sessionId) {
    let value = inboxes.get(sessionId);
    if (!value) {
      value = [];
      inboxes.set(sessionId, value);
    }
    return value;
  }

  function dedupeKey(entry) {
    return `${entry.sessionId}\u0000${entry.inputId}`;
  }

  function rememberCompleted(entry) {
    const key = dedupeKey(entry);
    pendingInputIds.delete(key);
    recentInputIds.delete(key);
    recentInputIds.add(key);
    while (recentInputIds.size > recentLimit) recentInputIds.delete(recentInputIds.values().next().value);
  }

  function forget(entry) {
    const key = dedupeKey(entry);
    pendingInputIds.delete(key);
    recentInputIds.delete(key);
  }

  function activeFor(sessionId) {
    return activeTurn?.entry.sessionId === sessionId ? activeTurn : null;
  }

  function isIdle(sessionId, allowQueued) {
    if (activeFor(sessionId)) return false;
    return allowQueued || (inboxes.get(sessionId)?.length ?? 0) === 0;
  }

  function resolveIdleWaiters(sessionId) {
    const waiters = idleWaiters.get(sessionId);
    if (!waiters?.length) return;
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      const waiter = waiters[index];
      if (!isIdle(sessionId, waiter.allowQueued)) continue;
      waiters.splice(index, 1);
      waiter.resolve();
    }
    if (waiters.length === 0) idleWaiters.delete(sessionId);
  }

  function scopeResult(entry, binding = bindingScope(getActiveBinding())) {
    if (!binding || binding.sessionId !== entry.sessionId) return { active: false, matches: false };
    return { active: true, matches: binding.workspace === entry.workspace };
  }

  function scheduleDrain() {
    if (drainScheduled) return;
    drainScheduled = true;
    queueMicrotask(() => {
      drainScheduled = false;
      void activate().catch(onError);
    });
  }

  function completeTurn(token, result = {}) {
    if (activeTurn?.token !== token) return false;
    const completedEntry = activeTurn.entry;
    const sessionId = completedEntry.sessionId;
    activeTurn = null;
    rememberCompleted(completedEntry);
    resolveIdleWaiters(sessionId);
    scheduleDrain();
    return { ...result };
  }

  async function start(entry) {
    const token = Symbol(entry.inputId);
    activeTurn = { entry, token };
    const controls = {
      complete: (result = {}) => completeTurn(token, result),
    };
    try {
      const result = await executeTurn(entry, controls);
      if (result?.accepted === false) {
        completeTurn(token, { ok: false, taskState: "failed" });
        // Rejection happened before this runtime owned an accepted Turn. Do
        // not poison the stable id: durable handoffs must be able to retry.
        forget(entry);
      }
      return { ...(result && typeof result === "object" ? result : {}), accepted: result?.accepted !== false };
    } catch (error) {
      completeTurn(token, { ok: false, taskState: "failed" });
      forget(entry);
      throw error;
    }
  }

  async function activate() {
    const binding = bindingScope(getActiveBinding());
    if (!binding) return { pendingActivation: true };
    if (activeTurn) {
      return activeTurn.entry.sessionId === binding.sessionId
        ? { busy: true, queued: inbox(binding.sessionId).length > 0 }
        : { pendingActivation: true, busy: true };
    }

    const pending = inboxes.get(binding.sessionId) ?? [];
    if (pending.length === 0) return { idle: true };
    const entry = pending[0];
    if (entry.workspace !== binding.workspace) return { scopeMismatch: true };
    pending.shift();
    if (pending.length === 0) inboxes.delete(binding.sessionId);
    const result = await start(entry);
    return { ...result, accepted: result.accepted !== false };
  }

  async function submit(value) {
    const entry = normalizeInput(value);
    const key = dedupeKey(entry);
    if (pendingInputIds.has(key) || recentInputIds.has(key)) return { accepted: true, duplicate: true };

    const scope = scopeResult(entry);
    const current = activeFor(entry.sessionId);
    if (current && scope.matches && steerTurn) {
      pendingInputIds.add(key);
      try {
        const result = await steerTurn(entry, { activeInput: current.entry });
        const durablyQueued = result?.accepted !== false
          && result?.queued === true
          && result?.status === "admitted";
        if (result?.accepted === false || durablyQueued) forget(entry);
        else rememberCompleted(entry);
        return {
          ...(result && typeof result === "object" ? result : {}),
          accepted: result?.accepted !== false,
          steered: entry.delivery === "steer" && result?.accepted !== false,
          ...(durablyQueued ? { durablyQueued: true } : {}),
        };
      } catch (error) {
        forget(entry);
        throw error;
      }
    }

    const pending = inbox(entry.sessionId);
    if (pending.length >= queueLimit) {
      return { accepted: false, queueFull: true, queued: pending.length };
    }
    pendingInputIds.add(key);
    pending.push(entry);
    if (!scope.active) return { accepted: true, pendingActivation: true };
    if (!scope.matches) return { accepted: true, scopeMismatch: true };
    if (activeTurn) return { accepted: true, queued: true };

    try {
      return await activate();
    } catch (error) {
      forget(entry);
      throw error;
    }
  }

  function snapshot(sessionId) {
    const id = requiredText(sessionId, "sessionId");
    const pending = inboxes.get(id) ?? [];
    const active = activeFor(id);
    return {
      sessionId: id,
      workspace: active?.entry.workspace ?? pending[0]?.workspace ?? null,
      busy: Boolean(active),
      activeInputId: active?.entry.inputId ?? null,
      queued: pending.length,
      pendingActivation: pending.length > 0 && bindingScope(getActiveBinding())?.sessionId !== id,
    };
  }

  function waitForIdle(sessionId, { allowQueued = false } = {}) {
    const id = requiredText(sessionId, "sessionId");
    if (isIdle(id, allowQueued)) return Promise.resolve();
    return new Promise((resolve) => {
      const waiters = idleWaiters.get(id) ?? [];
      waiters.push({ allowQueued: Boolean(allowQueued), resolve });
      idleWaiters.set(id, waiters);
    });
  }

  return {
    activate,
    snapshot,
    submit,
    waitForIdle,
  };
}
