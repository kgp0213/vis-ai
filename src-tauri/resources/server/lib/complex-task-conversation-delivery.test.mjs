import test from "node:test";
import assert from "node:assert/strict";

import {
  buildComplexTaskDeliveryPrompt,
  createComplexTaskConversationDelivery,
} from "./complex-task-conversation-delivery.mjs";

const TASK_ID = "task:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function task(overrides = {}) {
  return {
    id: TASK_ID,
    revision: 4,
    lifecycle: "terminal",
    contract: { goal: "整理复杂任务并交付", workspace: "D:/workspace" },
    metadata: { origin: { conversationId: "conversation-1", workspace: "D:/workspace" } },
    outbox: [{
      deliveryId: "delivery-1",
      kind: "task-outcome",
      consumers: ["task-center", "conversation"],
      acknowledgements: { "task-center": true },
      pendingConsumers: ["conversation"],
      payload: {
        schemaVersion: 1,
        taskId: TASK_ID,
        outcome: "delivered_with_warnings",
        summary: "任务已完成，但一处内容需要复核。",
        artifactRefs: ["artifact:final"],
        coverage: { required: 2, completed: 2, unresolved: [] },
        warnings: [{ code: "QUALITY_REVIEW", message: "第二部分需要复核" }],
        resumable: false,
      },
    }],
    ...overrides,
  };
}

function storeFor(initialTask, options = {}) {
  let current = structuredClone(initialTask);
  const calls = [];
  return {
    calls,
    async list() { return [structuredClone(current)]; },
    async read() { return structuredClone(current); },
    async listPendingOutbox({ consumer } = {}) {
      return current.outbox.flatMap((entry) => entry.acknowledgements?.[consumer] === true ? [] : [{
        taskId: current.id,
        deliveryId: entry.deliveryId,
        payload: structuredClone(entry.payload),
        pendingConsumers: [consumer],
      }]);
    },
    async ackOutbox(id, deliveryId, input) {
      calls.push(["ack", id, deliveryId, structuredClone(input)]);
      if (options.revisionRace && calls.length === 1) {
        current.revision += 1;
        return { applied: false, reason: "revision-mismatch", task: structuredClone(current) };
      }
      const entry = current.outbox.find((item) => item.deliveryId === deliveryId);
      if (entry.acknowledgements?.[input.consumer] === true) {
        return { applied: false, reason: "already-acknowledged", task: structuredClone(current) };
      }
      entry.acknowledgements = { ...(entry.acknowledgements ?? {}), [input.consumer]: true };
      entry.pendingConsumers = entry.consumers.filter((consumer) => entry.acknowledgements[consumer] !== true);
      current.revision += 1;
      return { applied: true, task: structuredClone(current) };
    },
    async updateOutboxDeliveryState(id, deliveryId, input) {
      calls.push(["delivery-state", id, deliveryId, structuredClone(input)]);
      const entry = current.outbox.find((item) => item.deliveryId === deliveryId);
      if (!entry) return { applied: false, reason: "outbox-not-found", task: structuredClone(current) };
      if (Number.isInteger(input.expectedRevision) && current.revision !== input.expectedRevision) {
        return { applied: false, reason: "revision-mismatch", task: structuredClone(current) };
      }
      entry.deliveryStates = {
        ...(entry.deliveryStates ?? {}),
        [input.consumer]: structuredClone(input.state),
      };
      current.revision += 1;
      return { applied: true, task: structuredClone(current) };
    },
  };
}

test("builds a model handoff prompt from the authoritative Outcome envelope", () => {
  const prompt = buildComplexTaskDeliveryPrompt(task(), task().outbox[0]);
  assert.match(prompt, /task:aaaaaaaa/);
  assert.match(prompt, /delivered_with_warnings/);
  assert.match(prompt, /第二部分需要复核/);
  assert.match(prompt, /不能静默结束/);
});

test("delivers once to the originating conversation and acknowledges with CAS retry", async () => {
  const store = storeFor(task(), { revisionRace: true });
  const dispatched = [];
  const notices = [];
  const delivery = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    dispatch: async (request) => {
      dispatched.push(request);
      return { accepted: true, completed: true, ok: true, assistantText: "任务已交付，第二部分需要复核。" };
    },
    notify: (notice) => notices.push(notice),
  });

  const first = await delivery.rehydrate();
  assert.equal(first.delivered, 1);
  assert.equal(dispatched.length, 1);
  assert.equal(store.calls.length, 2);
  assert.equal(store.calls[1][3].expectedRevision, 5);
  assert.equal(notices.find((notice) => notice.kind === "delivered")?.attemptId, null);

  const second = await delivery.rehydrate();
  assert.equal(second.delivered, 0);
  assert.equal(dispatched.length, 1);
});

test("delivered notification carries the approved attempt id", async () => {
  const store = storeFor(task({
    outbox: [{
      ...task().outbox[0],
      deliveryStates: {
        conversation: { status: "ready", attemptId: "attempt:user-approved-1", attempts: 0, nextAttemptAt: 0 },
      },
    }],
  }));
  const notices = [];
  const delivery = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    dispatch: async ({ attemptId }) => {
      assert.equal(attemptId, "attempt:user-approved-1");
      return { accepted: true, completed: true, ok: true, assistantText: "重新交付成功。" };
    },
    notify: (notice) => notices.push(notice),
  });

  await delivery.rehydrate();
  assert.equal(notices.find((notice) => notice.kind === "delivered")?.attemptId, "attempt:user-approved-1");
});

test("keeps delivery pending when the originating conversation is not active or dispatch fails", async () => {
  const store = storeFor(task());
  let calls = 0;
  const delivery = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-other",
    getWorkspace: () => "D:/workspace",
    dispatch: async () => { calls += 1; return { accepted: false, completed: true, error: "model unavailable" }; },
  });
  const waiting = await delivery.rehydrate();
  assert.equal(waiting.waitingConversation, 1);
  assert.equal(calls, 0);
  assert.equal(store.calls.length, 0);

  delivery.setContext({ conversationId: "conversation-1", workspace: "D:/workspace" });
  const failed = await delivery.drain();
  assert.equal(failed.failed, 1);
  assert.equal(calls, 1);
  assert.equal(store.calls.filter(([kind]) => kind === "ack").length, 0);
  assert.equal(delivery.pendingCount(), 1);
});

test("retries a transient dispatch failure and acknowledges the same delivery id", async () => {
  const store = storeFor(task());
  const dispatched = [];
  const delivery = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    retryBaseMs: 1,
    maxDeliveryAttempts: 3,
    dispatch: async (request) => {
      dispatched.push(request.deliveryId);
      if (dispatched.length === 1) return { accepted: false, completed: true, error: "model temporarily unavailable" };
      return { accepted: true, completed: true, ok: true, assistantText: "任务已交付。" };
    },
  });

  const first = await delivery.rehydrate();
  assert.equal(first.failed, 1);
  assert.equal(delivery.pendingCount(), 1);

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(dispatched, ["delivery-1", "delivery-1"]);
  assert.equal(store.calls.filter(([kind]) => kind === "ack").length, 1);
  assert.equal(delivery.pendingCount(), 0);
});

test("retries acknowledgement without dispatching a second assistant response", async () => {
  const store = storeFor(task());
  const acknowledge = store.ackOutbox.bind(store);
  let acknowledgementAttempts = 0;
  store.ackOutbox = async (...args) => {
    acknowledgementAttempts += 1;
    if (acknowledgementAttempts === 1) {
      return { applied: false, reason: "storage-temporarily-unavailable", task: await store.read() };
    }
    return acknowledge(...args);
  };
  let dispatches = 0;
  const delivery = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    retryBaseMs: 1,
    maxDeliveryAttempts: 3,
    dispatch: async () => {
      dispatches += 1;
      return { accepted: true, completed: true, ok: true, assistantText: "任务已交付。" };
    },
  });

  const first = await delivery.rehydrate();
  assert.equal(first.failed, 1);
  assert.equal(delivery.pendingCount(), 1);

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(acknowledgementAttempts, 2);
  assert.equal(dispatches, 1);
  assert.equal(delivery.pendingCount(), 0);
});

test("restart retries only acknowledgement after the assistant response was already dispatched", async () => {
  const store = storeFor(task());
  const acknowledge = store.ackOutbox.bind(store);
  let acknowledgementAttempts = 0;
  store.ackOutbox = async (...args) => {
    acknowledgementAttempts += 1;
    if (acknowledgementAttempts === 1) {
      return { applied: false, reason: "storage-temporarily-unavailable", task: await store.read() };
    }
    return acknowledge(...args);
  };
  let now = 100;
  let dispatches = 0;
  const options = {
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    now: () => now,
    retryBaseMs: 60_000,
    maxDeliveryAttempts: 3,
    dispatch: async () => {
      dispatches += 1;
      return { accepted: true, completed: true, ok: true, assistantText: "任务已交付。" };
    },
  };

  const first = await createComplexTaskConversationDelivery(options).rehydrate();
  assert.equal(first.failed, 1);
  assert.equal(dispatches, 1);
  const savedState = (await store.read()).outbox[0].deliveryStates.conversation;
  assert.equal(savedState.status, "retrying");
  assert.equal(savedState.dispatchCompleted, true);

  now = 60_101;
  const restarted = await createComplexTaskConversationDelivery(options).rehydrate();
  assert.equal(restarted.delivered, 1);
  assert.equal(acknowledgementAttempts, 2);
  assert.equal(dispatches, 1);
});

test("bounds automatic dispatch retries while retaining the durable delivery", async () => {
  const store = storeFor(task());
  let dispatches = 0;
  const delivery = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    retryBaseMs: 1,
    maxDeliveryAttempts: 2,
    dispatch: async () => {
      dispatches += 1;
      return { accepted: false, completed: true, error: "provider unavailable" };
    },
  });

  await delivery.rehydrate();
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(dispatches, 2);
  assert.equal(delivery.pendingCount(), 1);
  assert.equal(store.calls.filter(([kind]) => kind === "ack").length, 0);
});

test("a hung dispatch times out, releases draining, and ignores its late result", async () => {
  const store = storeFor(task());
  const notices = [];
  let now = 100;
  let dispatches = 0;
  let resolveHungDispatch;
  let hungSignal;
  const delivery = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    now: () => now,
    dispatchTimeoutMs: 10,
    retryBaseMs: 1_000,
    maxDeliveryAttempts: 2,
    notify: (notice) => notices.push(notice),
    dispatch: async ({ signal }) => {
      dispatches += 1;
      if (dispatches === 1) {
        hungSignal = signal;
        return new Promise((resolve) => { resolveHungDispatch = resolve; });
      }
      return { accepted: false, completed: true, error: "provider still unavailable" };
    },
  });

  const first = await Promise.race([
    delivery.rehydrate(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("delivery drain remained blocked")), 100)),
  ]);
  assert.equal(first.failed, 1);
  assert.equal(first.exhausted, 0);
  assert.equal(dispatches, 1);
  assert.equal(hungSignal?.aborted, true);
  assert.equal(hungSignal?.reason?.code, "CONVERSATION_DELIVERY_TIMEOUT");
  assert.equal((await store.read()).outbox[0].deliveryStates.conversation.status, "retrying");

  now = 1_101;
  const second = await delivery.drain();
  assert.equal(second.failed, 1);
  assert.equal(second.exhausted, 1);
  assert.equal(dispatches, 2);

  resolveHungDispatch({ accepted: true, completed: true, ok: true, assistantText: "迟到的交付结果" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const afterLateResult = await delivery.drain();

  assert.equal(afterLateResult.exhausted, 1);
  assert.equal(dispatches, 2);
  assert.equal(store.calls.filter(([kind]) => kind === "ack").length, 0);
  assert.equal(notices.filter((notice) => notice.kind === "delivered").length, 0);
  assert.equal((await store.read()).outbox[0].deliveryStates.conversation.status, "exhausted");
  delivery.stop();
});

test("persists exhausted delivery attempts and does not retry them after restart", async () => {
  const store = storeFor(task());
  let dispatches = 0;
  const options = {
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    retryBaseMs: 1,
    maxDeliveryAttempts: 1,
    dispatch: async () => {
      dispatches += 1;
      return { accepted: false, completed: true, error: "provider unavailable" };
    },
  };
  await createComplexTaskConversationDelivery(options).rehydrate();
  assert.equal(dispatches, 1);
  assert.equal(store.calls.some(([kind]) => kind === "delivery-state"), true);

  const restarted = createComplexTaskConversationDelivery({
    ...options,
    dispatch: async () => {
      dispatches += 1;
      return { accepted: true, completed: true, ok: true, assistantText: "must not auto-dispatch" };
    },
  });
  const restored = await restarted.rehydrate();
  assert.equal(restored.exhausted, 1);
  assert.equal(dispatches, 1);
});

test("does not retry an uncertain prompt receipt and surfaces explicit user action", async () => {
  const store = storeFor(task());
  let dispatches = 0;
  const notices = [];
  const delivery = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    retryBaseMs: 1,
    maxDeliveryAttempts: 3,
    notify: (notice) => notices.push(notice),
    dispatch: async () => {
      dispatches += 1;
      return {
        accepted: false,
        completed: false,
        requiresUserRetry: true,
        code: "PROMPT_RECEIPT_UNCERTAIN",
        reason: "上一次进程已接受请求，但结果未确认。",
      };
    },
  });

  const first = await delivery.rehydrate();
  assert.equal(first.failed, 1);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(dispatches, 1);
  assert.equal(delivery.pendingCount(), 1);
  assert.equal(notices.at(-1)?.requiresUserRetry, true);
  assert.equal(notices.at(-1)?.retrying, false);
  assert.equal(store.calls.some(([kind, , , input]) => kind === "delivery-state" && input.state.status === "blocked_user_retry"), true);

  const restarted = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    dispatch: async () => {
      dispatches += 1;
      return { accepted: true, completed: true, ok: true, assistantText: "must wait for user" };
    },
  });
  const restored = await restarted.rehydrate();
  assert.equal(restored.exhausted, 1);
  assert.equal(dispatches, 1);
});

test("a user-approved delivery attempt replaces the exhausted queue identity", async () => {
  const store = storeFor(task());
  let dispatches = [];
  const first = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    maxDeliveryAttempts: 1,
    dispatch: async (request) => {
      dispatches.push(request);
      return { accepted: false, completed: false, requiresUserRetry: true, code: "PROMPT_RECEIPT_UNCERTAIN", reason: "uncertain" };
    },
  });
  await first.rehydrate();
  const blocked = store.calls.findLast(([kind]) => kind === "delivery-state");
  assert.equal(blocked?.[3]?.state?.status, "blocked_user_retry");

  await store.updateOutboxDeliveryState(TASK_ID, "delivery-1", {
    consumer: "conversation",
    state: { status: "ready", attemptId: "attempt:user-approved-1", attempts: 0, nextAttemptAt: 0 },
  });
  const restarted = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    dispatch: async (request) => {
      dispatches.push(request);
      return { accepted: true, completed: true, ok: true, assistantText: "交付成功" };
    },
  });
  const result = await restarted.rehydrate();
  assert.equal(result.delivered, 1);
  assert.equal(dispatches.length, 2);
  assert.equal(dispatches[1].attemptId, "attempt:user-approved-1");
});

test("a delivery-state persistence exception is reported without rejecting the delivery loop", async () => {
  const store = storeFor(task());
  store.updateOutboxDeliveryState = async () => {
    throw new Error("manifest temporarily unavailable");
  };
  const notices = [];
  const delivery = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    maxDeliveryAttempts: 1,
    notify: (notice) => notices.push(notice),
    dispatch: async () => ({ accepted: false, completed: true, error: "provider unavailable" }),
  });

  const result = await delivery.rehydrate();
  assert.equal(result.failed, 1);
  assert.equal(result.exhausted, 1);
  assert.equal(delivery.pendingCount(), 1);
  assert.ok(notices.some((notice) => /交付状态保存失败.*manifest temporarily unavailable/.test(notice.error)));
});

test("does not dispatch while the foreground is busy", async () => {
  const store = storeFor(task());
  let calls = 0;
  const delivery = createComplexTaskConversationDelivery({
    store,
    isBusy: () => true,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    dispatch: async () => { calls += 1; return { ok: true, completed: true, assistantText: "done" }; },
  });
  const result = await delivery.rehydrate();
  assert.equal(result.pending, 1);
  assert.equal(calls, 0);
  assert.equal(store.calls.length, 0);
});

test("a delivery rehydrated while busy remains queued and drains after the foreground is released", async () => {
  const store = storeFor(task());
  let busy = true;
  let calls = 0;
  const delivery = createComplexTaskConversationDelivery({
    store,
    isBusy: () => busy,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    dispatch: async () => {
      calls += 1;
      return { accepted: true, completed: true, ok: true, assistantText: "后台任务结果已交付。" };
    },
  });

  const queued = await delivery.rehydrate();
  assert.equal(queued.pending, 1);
  assert.equal(calls, 0);

  busy = false;
  const drained = await delivery.drain();
  assert.equal(drained.delivered, 1);
  assert.equal(calls, 1);
  assert.equal(store.calls.length, 1);
});

test("periodically rescans durable outbox entries after the startup store scan fails", async () => {
  const store = storeFor(task());
  const list = store.list.bind(store);
  let listAttempts = 0;
  store.list = async () => {
    listAttempts += 1;
    if (listAttempts === 1) throw new Error("manifest directory temporarily unavailable");
    return list();
  };
  let dispatches = 0;
  const delivery = createComplexTaskConversationDelivery({
    store,
    rescanIntervalMs: 5,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    dispatch: async () => {
      dispatches += 1;
      return { accepted: true, completed: true, ok: true, assistantText: "后台任务结果已恢复交付。" };
    },
  });

  await assert.rejects(() => delivery.rehydrate(), /manifest directory temporarily unavailable/);
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(listAttempts >= 2, "a later durable rescan must retry store discovery");
  assert.equal(dispatches, 1);
  assert.equal(delivery.pendingCount(), 0);
  delivery.stop();
});
