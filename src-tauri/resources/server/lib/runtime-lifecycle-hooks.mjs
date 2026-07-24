const SUPPORTED_EVENTS = new Set([
  "operation.started",
  "operation.stopping",
  "operation.finished",
  "model.request.before",
  "model.request.after",
  "tool.queued",
  "tool.running",
  "tool.succeeded",
  "tool.failed",
  "tool.cancelled",
]);

function immutablePayload(payload) {
  let value;
  try { value = structuredClone(payload); } catch { value = { ...(payload ?? {}) }; }
  const freeze = (item) => {
    if (!item || typeof item !== "object" || Object.isFrozen(item)) return item;
    for (const child of Object.values(item)) freeze(child);
    return Object.freeze(item);
  };
  return freeze(value);
}

function runWithTimeout(handler, payload, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish({ status: "timeout" }), timeoutMs);
    timer.unref?.();
    Promise.resolve()
      .then(() => handler(payload))
      .then(() => finish({ status: "completed" }), (error) => finish({ status: "failed", error }));
  });
}

export function createRuntimeLifecycleHooks({
  timeoutMs = 250,
  onIssue = () => {},
} = {}) {
  const hooks = new Map();

  function assertEvent(event) {
    if (!SUPPORTED_EVENTS.has(event)) throw new Error(`unsupported lifecycle event: ${event}`);
  }

  function register(event, name, handler, options = {}) {
    assertEvent(event);
    if (typeof handler !== "function") throw new Error("lifecycle hook handler is required");
    const entry = {
      name: String(name ?? "anonymous").slice(0, 120),
      handler,
      timeoutMs: Math.max(1, Number(options.timeoutMs) || timeoutMs),
    };
    const list = hooks.get(event) ?? [];
    list.push(entry);
    hooks.set(event, list);
    return () => {
      const current = hooks.get(event) ?? [];
      hooks.set(event, current.filter((item) => item !== entry));
    };
  }

  async function emit(event, payload = {}) {
    assertEvent(event);
    const list = [...(hooks.get(event) ?? [])];
    const safePayload = immutablePayload(payload);
    const results = await Promise.all(list.map(async (entry) => {
      const result = await runWithTimeout(entry.handler, safePayload, entry.timeoutMs);
      if (result.status !== "completed") {
        const issue = {
          event,
          hook: entry.name,
          status: result.status,
          message: result.error?.message || (result.status === "timeout" ? `hook timed out after ${entry.timeoutMs}ms` : "hook failed"),
        };
        try { onIssue(issue); } catch { /* Logging cannot block execution. */ }
      }
      return result;
    }));
    return {
      event,
      completed: results.filter((result) => result.status === "completed").length,
      failed: results.filter((result) => result.status === "failed").length,
      timedOut: results.filter((result) => result.status === "timeout").length,
    };
  }

  return { emit, register, supportedEvents: () => [...SUPPORTED_EVENTS] };
}
