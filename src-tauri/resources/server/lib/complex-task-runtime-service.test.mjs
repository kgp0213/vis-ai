import test from "node:test";
import assert from "node:assert/strict";

import { createComplexTaskRuntimeService } from "./complex-task-runtime-service.mjs";

const TASK_ID = "task:12345678-abcd-abcd-abcd-123456789012";

function genericTask(overrides = {}) {
  return {
    id: TASK_ID,
    kind: "task",
    lifecycle: "running",
    status: "running",
    revision: 7,
    epoch: 3,
    lease: { leaseId: "lease-3", epoch: 3, owner: "worker", expiresAt: Date.now() + 10_000 },
    contract: {
      taskType: "document.markdown",
      goal: "整理文档",
      workspace: "D:/workspace",
      output: { requestedPath: "D:/workspace/result.md" },
    },
    outbox: [],
    ...overrides,
  };
}

test("runtime service aggregates canonical generic jobs and exposes attention deliveries", async () => {
  const task = genericTask({ lifecycle: "terminal", status: "terminal", outcome: {
    outcome: "delivered_with_warnings",
    summary: "已交付但需要复核",
    artifactRefs: ["artifact:1"],
    warnings: [{ message: "需要复核" }],
    resumable: true,
  }, outbox: [{
    deliveryId: "delivery-1",
    consumers: ["task-center", "conversation"],
    acknowledgements: { conversation: true },
    payload: { summary: "已交付但需要复核" },
  }] });
  const store = {
    list: async () => [task],
    listPendingOutbox: async () => [{ taskId: TASK_ID, deliveryId: "delivery-1", payload: task.outbox[0].payload, pendingConsumers: ["task-center"] }],
    read: async () => structuredClone(task),
  };
  const supervisor = { reconcile: async () => ({ scanned: 1, requeued: [], issues: [] }) };
  const service = createComplexTaskRuntimeService({
    store,
    supervisor,
    listProcessJobs: async () => [{ id: 1, running: true }],
    listLegacyDocumentJobs: async () => [],
  });

  const startup = await service.initialize({ now: 100 });
  assert.equal(startup.reconcile.scanned, 1);
  const snapshot = await service.listBackgroundJobs();
  assert.equal(snapshot.jobs.length, 2);
  assert.equal(snapshot.jobs.find((job) => job.id === TASK_ID).outcome, "delivered_with_warnings");
  assert.equal(snapshot.pendingDeliveries[0].target, "task-center");
});

test("runtime service converts UI shorthand into fenced controller requests", async () => {
  const task = genericTask({ lifecycle: "waiting_user", status: "waiting_user", userInputRequest: { requestId: "request-1", question: "选择" } });
  const calls = [];
  const service = createComplexTaskRuntimeService({
    store: { read: async () => structuredClone(task), list: async () => [task], listPendingOutbox: async () => [] },
    controller: { control: async (id, request) => { calls.push([id, request]); return { ok: true, applied: true, task: { ...task, lifecycle: "queued", revision: 8 } }; } },
  });

  const result = await service.controlBackgroundJob(TASK_ID, "resolve_user_input", {
    expectedRevision: 7,
    requestId: "ui-request-1",
    payload: { value: "continue" },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls[0], [TASK_ID, {
    action: "resolve_user_input",
    expectedRevision: 7,
    expectedEpoch: 3,
    requestId: "ui-request-1",
    payload: { value: "continue", requestId: "request-1" },
  }]);
});

test("runtime service reports generic not-found without touching legacy controls", async () => {
  const service = createComplexTaskRuntimeService({
    store: { read: async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); }, list: async () => [], listPendingOutbox: async () => [] },
  });
  assert.equal(await service.getBackgroundJob(TASK_ID), null);
  const result = await service.controlBackgroundJob(TASK_ID, "pause", { expectedRevision: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not-found");
});
