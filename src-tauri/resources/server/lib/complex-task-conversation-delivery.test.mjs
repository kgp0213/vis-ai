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
  const delivery = createComplexTaskConversationDelivery({
    store,
    getConversationId: () => "conversation-1",
    getWorkspace: () => "D:/workspace",
    dispatch: async (request) => {
      dispatched.push(request);
      return { accepted: true, completed: true, ok: true, assistantText: "任务已交付，第二部分需要复核。" };
    },
  });

  const first = await delivery.rehydrate();
  assert.equal(first.delivered, 1);
  assert.equal(dispatched.length, 1);
  assert.equal(store.calls.length, 2);
  assert.equal(store.calls[1][3].expectedRevision, 5);

  const second = await delivery.rehydrate();
  assert.equal(second.delivered, 0);
  assert.equal(dispatched.length, 1);
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
  assert.equal(store.calls.length, 0);
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
