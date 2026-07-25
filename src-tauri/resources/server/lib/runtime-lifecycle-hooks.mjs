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
  "beforeStep",
  "prepareTool",
  "authorizeTool",
  "finalizeToolResult",
  "afterStep",
  "shouldContinueAfterStop",
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

function runWithTimeout(handler, payload, timeoutMs, signal = null) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    let onAbort = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (onAbort) signal?.removeEventListener?.("abort", onAbort);
      resolve(value);
    };
    timer = setTimeout(() => finish({ status: "timeout" }), timeoutMs);
    timer.unref?.();
    if (signal?.aborted) {
      finish({ status: "cancelled" });
      return;
    }
    onAbort = () => finish({ status: "cancelled" });
    signal?.addEventListener?.("abort", onAbort, { once: true });
    Promise.resolve()
      .then(() => handler(payload, { signal }))
      .then((value) => finish({ status: "completed", value }), (error) => finish({ status: "failed", error }));
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

  async function emit(event, payload = {}, options = {}) {
    assertEvent(event);
    const list = [...(hooks.get(event) ?? [])];
    const safePayload = immutablePayload(payload);
    const results = await Promise.all(list.map(async (entry) => {
      const result = await runWithTimeout(entry.handler, safePayload, entry.timeoutMs, options.signal ?? null);
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
      cancelled: results.filter((result) => result.status === "cancelled").length,
    };
  }

  /** Sequential boundary hook used by policy adapters; returned values are
   * observations only and never mutate tool arguments or block the loop. */
  async function runBoundary(event, payload = {}, options = {}) {
    assertEvent(event);
    const list = [...(hooks.get(event) ?? [])];
    const safePayload = immutablePayload(payload);
    const results = [];
    for (const entry of list) {
      const result = await runWithTimeout(entry.handler, safePayload, entry.timeoutMs, options.signal ?? null);
      if (result.status !== "completed") {
        const issue = {
          event,
          hook: entry.name,
          status: result.status,
          message: result.error?.message || (result.status === "timeout" ? `hook timed out after ${entry.timeoutMs}ms` : "hook failed"),
        };
        try { onIssue(issue); } catch { /* Diagnostics cannot block the operation. */ }
      }
      results.push({ hook: entry.name, status: result.status, value: result.value });
    }
    return { event, results };
  }

  return { emit, register, runBoundary, supportedEvents: () => [...SUPPORTED_EVENTS] };
}
