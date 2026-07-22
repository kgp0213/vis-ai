function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function comparablePath(value) {
  return text(value).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function pendingForConversation(entry) {
  if (Array.isArray(entry?.pendingConsumers)) return entry.pendingConsumers.includes("conversation");
  const consumers = Array.isArray(entry?.consumers) ? entry.consumers : [];
  return consumers.includes("conversation") && entry?.acknowledgements?.conversation !== true;
}

function originOf(task) {
  const origin = task?.metadata?.origin;
  return origin && typeof origin === "object" && !Array.isArray(origin) ? origin : {};
}

function deliveryKey(taskId, deliveryId) {
  return `${taskId}:${deliveryId}`;
}

function boundedInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

const DEFAULT_DISPATCH_TIMEOUT_MS = 5 * 60 * 1_000;
const DELIVERY_STATE_STATUSES = new Set(["ready", "retrying", "blocked_user_retry", "exhausted", "delivered", "dismissed"]);

function deliveryStateOf(entry, consumer = "conversation") {
  const raw = entry?.deliveryStates?.[consumer];
  if (!raw || typeof raw !== "object") {
    return { status: "ready", attemptId: null, attempts: 0, nextAttemptAt: 0, lastError: null };
  }
  const status = DELIVERY_STATE_STATUSES.has(String(raw.status)) ? String(raw.status) : "ready";
  return {
    status,
    attemptId: text(raw.attemptId) || null,
    attempts: Math.max(0, Number(raw.attempts) || 0),
    nextAttemptAt: Number.isFinite(Number(raw.nextAttemptAt)) ? Number(raw.nextAttemptAt) : 0,
    dispatchCompleted: raw.dispatchCompleted === true,
    lastError: text(raw.lastError || raw.reason) || null,
    ...(text(raw.code) ? { code: text(raw.code) } : {}),
  };
}

function queueItemFromState(taskId, deliveryId, state) {
  const blocked = ["blocked_user_retry", "exhausted", "dismissed", "delivered"].includes(state.status);
  return {
    taskId,
    deliveryId,
    attemptId: state.attemptId,
    dispatchCompleted: state.dispatchCompleted === true,
    attempts: state.attempts,
    nextAttemptAt: blocked ? null : state.nextAttemptAt,
    deferredByBusy: false,
    exhausted: blocked,
    lastError: state.lastError,
  };
}

export function buildComplexTaskDeliveryPrompt(task, delivery) {
  const payload = delivery?.payload && typeof delivery.payload === "object" ? delivery.payload : {};
  const envelope = {
    taskId: task?.id ?? payload.taskId ?? null,
    lifecycle: task?.lifecycle ?? null,
    goal: task?.contract?.goal ?? null,
    output: task?.contract?.output ?? null,
    deliveryKind: delivery?.kind ?? null,
    outcome: payload,
  };
  return [
    `[系统复杂任务交付 ${envelope.taskId || "unknown"}]`,
    "这是宿主持久任务产生的权威结果，不是新的用户请求。后台执行结束不等于用户已经得到清楚结论。",
    "",
    "<complex-task-outcome>",
    JSON.stringify(envelope, null, 2),
    "</complex-task-outcome>",
    "",
    "请用简洁、明确的语言向用户交付结果：说明完成状态、产物、警告和下一步。",
    "若任务正在等待用户或被外部条件阻塞，必须准确说明唯一需要用户处理的事项。",
    "不得重启相同任务、不得伪造成功、不得只报告进度，也不能静默结束。",
  ].join("\n");
}

export function createComplexTaskConversationDelivery(options = {}) {
  const store = options.store;
  if (!store || typeof store.list !== "function" || typeof store.read !== "function"
    || typeof store.ackOutbox !== "function") {
    throw new TypeError("complex task conversation delivery requires list, read, and ackOutbox store APIs");
  }
  if (typeof options.dispatch !== "function") throw new TypeError("complex task conversation delivery requires dispatch");

  const queue = new Map();
  const inFlight = new Set();
  const maxDeliveryAttempts = boundedInteger(options.maxDeliveryAttempts, 3, { max: 20 });
  const retryBaseMs = boundedInteger(options.retryBaseMs, 1_000, { max: 60_000 });
  const retryMaxMs = boundedInteger(options.retryMaxMs, 30_000, { min: retryBaseMs, max: 300_000 });
  const busyRetryMs = boundedInteger(options.busyRetryMs, retryBaseMs, { max: 60_000 });
  const rescanIntervalMs = boundedInteger(options.rescanIntervalMs, 30_000, { max: 300_000 });
  const dispatchTimeoutMs = boundedInteger(options.dispatchTimeoutMs, DEFAULT_DISPATCH_TIMEOUT_MS, { max: 30 * 60 * 1_000 });
  const now = typeof options.now === "function" ? options.now : Date.now;
  let draining = false;
  let stopped = false;
  let contextOverride = null;
  let retryTimer = null;
  let retryTimerAt = null;
  let rescanTimer = null;
  let rehydratePromise = null;

  function context() {
    return contextOverride ?? {
      conversationId: text(options.getConversationId?.()),
      workspace: text(options.getWorkspace?.()),
    };
  }

  function contextMatches(task) {
    const origin = originOf(task);
    const current = context();
    if (!text(origin.conversationId) || text(origin.conversationId) !== text(current.conversationId)) return false;
    const expectedWorkspace = comparablePath(origin.workspace);
    const currentWorkspace = comparablePath(current.workspace);
    return !expectedWorkspace || !currentWorkspace || expectedWorkspace === currentWorkspace;
  }

  function notify(value) {
    try { options.notify?.(value); } catch { /* Delivery state remains authoritative when UI notification fails. */ }
  }

  function clearRetryTimer() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    retryTimerAt = null;
  }

  function scheduleRetryTimer() {
    if (stopped) {
      clearRetryTimer();
      return;
    }
    let dueAt = null;
    for (const queued of queue.values()) {
      if (queued.exhausted || !Number.isFinite(queued.nextAttemptAt) || queued.nextAttemptAt <= 0) continue;
      if (dueAt === null || queued.nextAttemptAt < dueAt) dueAt = queued.nextAttemptAt;
    }
    if (dueAt === null) {
      clearRetryTimer();
      return;
    }
    if (retryTimer && retryTimerAt !== null && retryTimerAt <= dueAt) return;
    clearRetryTimer();
    retryTimerAt = dueAt;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      retryTimerAt = null;
      void drain().catch((error) => {
        notify({ kind: "delivery-error", taskId: null, deliveryId: null, error: text(error?.message) || String(error) });
      });
    }, Math.max(0, dueAt - Number(now())));
    retryTimer.unref?.();
  }

  function clearRescanTimer() {
    if (rescanTimer) clearTimeout(rescanTimer);
    rescanTimer = null;
  }

  function scheduleRescanTimer() {
    if (stopped || rescanTimer) return;
    rescanTimer = setTimeout(() => {
      rescanTimer = null;
      if (stopped) return;
      void rehydrate().catch((error) => {
        notify({
          kind: "delivery-rescan-error",
          taskId: null,
          deliveryId: null,
          error: text(error?.message) || String(error),
        });
      });
    }, rescanIntervalMs);
    rescanTimer.unref?.();
  }

  function deferWhileBusy() {
    const dueAt = Number(now()) + busyRetryMs;
    for (const queued of queue.values()) {
      if (queued.exhausted) continue;
      if (!Number.isFinite(queued.nextAttemptAt) || queued.nextAttemptAt <= Number(now())) {
        queued.nextAttemptAt = dueAt;
        queued.deferredByBusy = true;
      }
    }
    scheduleRetryTimer();
  }

  function retainForRetry(queued, error) {
    queued.attempts = Number(queued.attempts || 0) + 1;
    queued.lastError = text(error?.message || error) || "conversation delivery failed";
    queued.deferredByBusy = false;
    if (queued.attempts >= maxDeliveryAttempts) {
      queued.exhausted = true;
      queued.nextAttemptAt = null;
      return false;
    }
    const delay = Math.min(retryMaxMs, retryBaseMs * (2 ** Math.max(0, queued.attempts - 1)));
    queued.nextAttemptAt = Number(now()) + delay;
    scheduleRetryTimer();
    return true;
  }

  async function acknowledge(taskId, deliveryId) {
    let current = await store.read(taskId);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const entry = (current.outbox ?? []).find((item) => item.deliveryId === deliveryId);
      if (!entry || !pendingForConversation(entry)) return { applied: false, reason: "already-acknowledged", task: current };
      const result = await store.ackOutbox(taskId, deliveryId, {
        expectedRevision: current.revision,
        consumer: "conversation",
      });
      if (result?.applied || result?.reason === "already-acknowledged") return result;
      if (result?.reason !== "revision-mismatch") return result;
      current = result.task ?? await store.read(taskId);
    }
    return { applied: false, reason: "revision-retry-exhausted", task: current };
  }

  async function persistDeliveryState(queued, state) {
    if (typeof store.updateOutboxDeliveryState !== "function") {
      return { applied: false, reason: "delivery-state-persistence-unavailable" };
    }
    let current;
    try { current = await store.read(queued.taskId); } catch (error) {
      return { applied: false, reason: text(error?.message) || String(error) };
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let result;
      try {
        result = await store.updateOutboxDeliveryState(queued.taskId, queued.deliveryId, {
          expectedRevision: current.revision,
          consumer: "conversation",
          state,
        });
      } catch (error) {
        return { applied: false, reason: text(error?.message) || String(error) };
      }
      if (result?.applied || result?.reason === "already-acknowledged") return result;
      if (result?.reason !== "revision-mismatch") return result;
      try { current = result.task ?? await store.read(queued.taskId); } catch (error) {
        return { applied: false, reason: text(error?.message) || String(error) };
      }
    }
    return { applied: false, reason: "delivery-state-revision-retry-exhausted" };
  }

  async function persistQueuedState(queued, status, extra = {}) {
    const state = {
      status,
      attemptId: queued.attemptId || null,
      attempts: Math.max(0, Number(queued.attempts) || 0),
      nextAttemptAt: Number.isFinite(Number(queued.nextAttemptAt)) ? Number(queued.nextAttemptAt) : null,
      dispatchCompleted: queued.dispatchCompleted === true,
      lastError: queued.lastError || null,
      ...extra,
    };
    const result = await persistDeliveryState(queued, state);
    if (result?.applied === false && result?.reason !== "delivery-state-persistence-unavailable") {
      notify({
        kind: "delivery-error",
        taskId: queued.taskId,
        deliveryId: queued.deliveryId,
        error: `交付状态保存失败：${result.reason}`,
      });
    }
    return result;
  }

  async function dispatchWithTimeout(request) {
    let timeoutHandle;
    const controller = new AbortController();
    const dispatchPromise = Promise.resolve().then(() => options.dispatch({
      ...request,
      signal: controller.signal,
    }));
    const timeout = new Promise((resolve) => {
      timeoutHandle = setTimeout(() => {
        const error = new Error(`conversation delivery dispatch timed out after ${dispatchTimeoutMs}ms`);
        error.code = "CONVERSATION_DELIVERY_TIMEOUT";
        controller.abort(error);
        resolve({
          accepted: false,
          completed: true,
          ok: false,
          code: error.code,
          error: error.message,
        });
      }, dispatchTimeoutMs);
    });
    try {
      // Promise.race attaches a rejection handler to the late dispatch promise;
      // once the timeout wins, its eventual value is intentionally ignored.
      return await Promise.race([dispatchPromise, timeout]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async function observe(task, { retryExhausted = false } = {}) {
    let accepted = 0;
    for (const entry of Array.isArray(task?.outbox) ? task.outbox : []) {
      if (!pendingForConversation(entry)) continue;
      const key = deliveryKey(task.id, entry.deliveryId);
      const persistedState = deliveryStateOf(entry, "conversation");
      const queued = queue.get(key);
      if (queued) {
        if (persistedState.attemptId !== queued.attemptId
          || (queued.exhausted && persistedState.status === "ready")) {
          queue.set(key, queueItemFromState(task.id, entry.deliveryId, persistedState));
        }
        continue;
      }
      if (inFlight.has(key)) continue;
      queue.set(key, queueItemFromState(task.id, entry.deliveryId, persistedState));
      accepted += 1;
    }
    return { accepted };
  }

  async function drain() {
    const report = { delivered: 0, failed: 0, waitingConversation: 0, deferred: 0, exhausted: 0, pending: queue.size };
    if (draining) return report;
    if (options.isBusy?.()) {
      deferWhileBusy();
      return report;
    }
    draining = true;
    try {
      const batch = [...queue.entries()];
      for (const [key, queued] of batch) {
        if (options.isBusy?.()) {
          deferWhileBusy();
          break;
        }
        if (queued.exhausted) {
          report.exhausted += 1;
          continue;
        }
        if (queued.deferredByBusy) {
          queued.deferredByBusy = false;
          queued.nextAttemptAt = 0;
        }
        if (Number.isFinite(queued.nextAttemptAt) && queued.nextAttemptAt > Number(now())) {
          report.deferred += 1;
          continue;
        }
        queued.nextAttemptAt = 0;
        let task;
        try { task = await store.read(queued.taskId); } catch (error) {
          report.failed += 1;
          const retrying = retainForRetry(queued, error);
          if (!retrying) report.exhausted += 1;
          notify({ kind: "delivery-error", taskId: queued.taskId, deliveryId: queued.deliveryId, error: text(error?.message), retrying, retryExhausted: !retrying });
          continue;
        }
        const entry = (task.outbox ?? []).find((item) => item.deliveryId === queued.deliveryId);
        if (!entry || !pendingForConversation(entry)) {
          queue.delete(key);
          continue;
        }
        if (!contextMatches(task)) {
          report.waitingConversation += 1;
          notify({ kind: "waiting-conversation", taskId: task.id, deliveryId: entry.deliveryId, conversationId: originOf(task).conversationId ?? null });
          continue;
        }

        inFlight.add(key);
        try {
          if (!queued.dispatchCompleted) {
            const result = await dispatchWithTimeout({
              task: clone(task),
              delivery: clone(entry),
              deliveryId: entry.deliveryId,
              attemptId: queued.attemptId,
              prompt: buildComplexTaskDeliveryPrompt(task, entry),
            });
            const delivered = result?.accepted !== false
              && result?.completed !== false
              && result?.ok !== false
              && Boolean(text(result?.assistantText));
            if (!delivered) {
              report.failed += 1;
              const error = text(result?.error || result?.reason) || "conversation delivery returned no conclusion";
              const requiresUserRetry = result?.requiresUserRetry === true;
              const retrying = requiresUserRetry ? false : retainForRetry(queued, error);
              if (requiresUserRetry) {
                queued.attempts = maxDeliveryAttempts;
                queued.lastError = error;
                queued.exhausted = true;
                queued.nextAttemptAt = null;
              }
              await persistQueuedState(
                queued,
                requiresUserRetry ? "blocked_user_retry" : retrying ? "retrying" : "exhausted",
                { code: text(result?.code) || null, reason: error },
              );
              if (!retrying) report.exhausted += 1;
              notify({
                kind: "delivery-failed",
                taskId: task.id,
                deliveryId: entry.deliveryId,
                error,
                retrying,
                retryExhausted: !retrying,
                requiresUserRetry,
                code: text(result?.code) || null,
              });
              continue;
            }
            // Once an assistant conclusion exists, all retries are ack-only.
            // Re-dispatching the same Outcome could create a duplicate visible
            // response when persistence is the only component that failed.
            queued.dispatchCompleted = true;
            queued.attempts = 0;
            queued.lastError = null;
          }
          const acknowledged = await acknowledge(task.id, entry.deliveryId);
          if (!acknowledged?.applied && acknowledged?.reason !== "already-acknowledged") {
            report.failed += 1;
            const error = `Outbox acknowledgement failed: ${acknowledged?.reason || "unknown"}`;
            const retrying = retainForRetry(queued, error);
            await persistQueuedState(queued, retrying ? "retrying" : "exhausted");
            if (!retrying) report.exhausted += 1;
            notify({ kind: "delivery-error", taskId: task.id, deliveryId: entry.deliveryId, error, retrying, retryExhausted: !retrying });
            continue;
          }
          queue.delete(key);
          report.delivered += 1;
          notify({
            kind: "delivered",
            taskId: task.id,
            deliveryId: entry.deliveryId,
            attemptId: queued.attemptId || null,
          });
        } catch (error) {
          report.failed += 1;
          const retrying = retainForRetry(queued, error);
          await persistQueuedState(queued, retrying ? "retrying" : "exhausted");
          if (!retrying) report.exhausted += 1;
          notify({ kind: "delivery-failed", taskId: task.id, deliveryId: entry.deliveryId, error: text(error?.message) || String(error), retrying, retryExhausted: !retrying });
        } finally {
          inFlight.delete(key);
        }
      }
    } finally {
      draining = false;
      report.pending = queue.size;
      scheduleRetryTimer();
    }
    return report;
  }

  function rehydrate() {
    if (rehydratePromise) return rehydratePromise;
    stopped = false;
    clearRescanTimer();
    rehydratePromise = (async () => {
      try {
        for (const task of await store.list()) await observe(task);
        return await drain();
      } finally {
        scheduleRescanTimer();
      }
    })().finally(() => {
      rehydratePromise = null;
    });
    return rehydratePromise;
  }

  function setContext(value = null) {
    contextOverride = value && typeof value === "object" ? {
      conversationId: text(value.conversationId),
      workspace: text(value.workspace),
    } : null;
  }

  function stop() {
    stopped = true;
    clearRetryTimer();
    clearRescanTimer();
  }

  return {
    drain,
    observe,
    rehydrate,
    setContext,
    stop,
    pendingCount: () => queue.size,
  };
}
