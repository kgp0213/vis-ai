import { AsyncLocalStorage } from "node:async_hooks";

function statusCodeFromReason(reason) {
  const match = /(?:http|api)\s+(\d{3})/iu.exec(String(reason ?? ""));
  return match ? Number(match[1]) : null;
}

/** Associates shared model-client callbacks with the async turn that invoked them. */
export function createModelRequestObserver({ maxAttempts = 4 } = {}) {
  const storage = new AsyncLocalStorage();

  function run(context, task) {
    return storage.run(context, task);
  }

  async function* iterate(context, factory) {
    const iterator = storage.run(context, () => factory()[Symbol.asyncIterator]());
    while (true) {
      const next = await storage.run(context, () => iterator.next());
      if (next.done) return next.value;
      yield next.value;
    }
  }

  function onRetry(event = {}) {
    const context = storage.getStore();
    if (!context) return false;
    const retry = {
      requestId: context.requestId ?? context.operationId ?? null,
      attempt: Math.max(1, Number(event.attempt) || 1),
      maxAttempts,
      delayMs: Math.max(0, Number(event.delayMs ?? event.waitMs) || 0),
      reason: String(event.reason || "retry").slice(0, 320),
      statusCode: Number.isInteger(Number(event.statusCode)) ? Number(event.statusCode) : statusCodeFromReason(event.reason),
    };
    context.receipt?.recordModelRetry?.(retry);
    context.publish?.({
      kind: "model-retry",
      id: `model-retry-${context.operationId || retry.requestId || "unknown"}`,
      operationId: context.operationId ?? null,
      ...retry,
    });
    return true;
  }

  function onResult(event = {}) {
    const context = storage.getStore();
    if (!context) return false;
    const result = {
      requestId: context.requestId ?? context.operationId ?? null,
      ...event,
    };
    context.receipt?.recordProviderResult?.(result);
    context.publish?.({ kind: "model-result", operationId: context.operationId ?? null, ...result });
    return true;
  }

  return { run, iterate, onRetry, onResult, current: () => storage.getStore() ?? null };
}
