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
  let draining = false;
  let contextOverride = null;

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

  async function observe(task) {
    let accepted = 0;
    for (const entry of Array.isArray(task?.outbox) ? task.outbox : []) {
      if (!pendingForConversation(entry)) continue;
      const key = deliveryKey(task.id, entry.deliveryId);
      if (queue.has(key) || inFlight.has(key)) continue;
      queue.set(key, { taskId: task.id, deliveryId: entry.deliveryId });
      accepted += 1;
    }
    return { accepted };
  }

  async function drain() {
    const report = { delivered: 0, failed: 0, waitingConversation: 0, pending: queue.size };
    if (draining || options.isBusy?.()) return report;
    draining = true;
    try {
      const batch = [...queue.entries()];
      for (const [key, queued] of batch) {
        if (options.isBusy?.()) break;
        let task;
        try { task = await store.read(queued.taskId); } catch (error) {
          queue.delete(key);
          report.failed += 1;
          notify({ kind: "delivery-error", taskId: queued.taskId, deliveryId: queued.deliveryId, error: text(error?.message) });
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

        queue.delete(key);
        inFlight.add(key);
        try {
          const result = await options.dispatch({
            task: clone(task),
            delivery: clone(entry),
            deliveryId: entry.deliveryId,
            prompt: buildComplexTaskDeliveryPrompt(task, entry),
          });
          const delivered = result?.accepted !== false
            && result?.completed !== false
            && result?.ok !== false
            && Boolean(text(result?.assistantText));
          if (!delivered) {
            report.failed += 1;
            notify({ kind: "delivery-failed", taskId: task.id, deliveryId: entry.deliveryId, error: text(result?.error || result?.reason) || "conversation delivery returned no conclusion" });
            continue;
          }
          const acknowledged = await acknowledge(task.id, entry.deliveryId);
          if (!acknowledged?.applied && acknowledged?.reason !== "already-acknowledged") {
            report.failed += 1;
            notify({ kind: "delivery-error", taskId: task.id, deliveryId: entry.deliveryId, error: `Outbox acknowledgement failed: ${acknowledged?.reason || "unknown"}` });
            continue;
          }
          report.delivered += 1;
          notify({ kind: "delivered", taskId: task.id, deliveryId: entry.deliveryId });
        } catch (error) {
          report.failed += 1;
          notify({ kind: "delivery-failed", taskId: task.id, deliveryId: entry.deliveryId, error: text(error?.message) || String(error) });
        } finally {
          inFlight.delete(key);
        }
      }
    } finally {
      draining = false;
      report.pending = queue.size;
    }
    return report;
  }

  async function rehydrate() {
    for (const task of await store.list()) await observe(task);
    return drain();
  }

  function setContext(value = null) {
    contextOverride = value && typeof value === "object" ? {
      conversationId: text(value.conversationId),
      workspace: text(value.workspace),
    } : null;
  }

  return {
    drain,
    observe,
    rehydrate,
    setContext,
    pendingCount: () => queue.size,
  };
}
