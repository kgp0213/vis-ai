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
  let wakeCount = 0;
  const service = createComplexTaskRuntimeService({
    store: { read: async () => structuredClone(task), list: async () => [task], listPendingOutbox: async () => [] },
    controller: { control: async (id, request) => { calls.push([id, request]); return { ok: true, applied: true, task: { ...task, lifecycle: "queued", revision: 8 } }; } },
    wake: () => { wakeCount += 1; },
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
  assert.equal(wakeCount, 1);
});

test("runtime service preserves the conversation consumer for an explicit delivery retry", async () => {
  const task = genericTask({
    lifecycle: "terminal",
    status: "terminal",
    outbox: [{
      deliveryId: "delivery-1",
      consumers: ["task-center", "conversation"],
      acknowledgements: { "task-center": true },
      pendingConsumers: ["conversation"],
      deliveryStates: { conversation: { status: "blocked_user_retry", attempts: 2 } },
    }],
  });
  const calls = [];
  const service = createComplexTaskRuntimeService({
    store: { read: async () => structuredClone(task), list: async () => [task], listPendingOutbox: async () => [] },
    controller: {
      control: async (id, request) => {
        calls.push([id, request]);
        return { ok: true, applied: true, task: { ...task, revision: 8 } };
      },
    },
  });
  const result = await service.controlBackgroundJob(TASK_ID, "retry_delivery", {
    expectedRevision: 7,
    payload: { deliveryId: "delivery-1", consumer: "conversation" },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls[0], [TASK_ID, {
    action: "retry_delivery",
    expectedRevision: 7,
    expectedEpoch: 3,
    payload: { deliveryId: "delivery-1", consumer: "conversation" },
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

test("runtime task detail retains pending assembly checkpoints for user recovery", async () => {
  const pendingAssembly = { artifactRefs: ["artifact:final@r1#" + "a".repeat(64)], report: { complete: false } };
  const task = genericTask({ lifecycle: "waiting_user", pendingAssembly });
  const service = createComplexTaskRuntimeService({
    store: { list: async () => [task], listPendingOutbox: async () => [], read: async () => structuredClone(task) },
  });
  const detail = await service.getBackgroundJob(TASK_ID);
  assert.deepEqual(detail.pendingAssembly, pendingAssembly);
});

test("retired execution mode blocks legacy tasks instead of requeueing a second model loop", async () => {
  let task = genericTask({ lifecycle: "queued", status: "queued", lease: null });
  const transitions = [];
  const controls = [];
  const service = createComplexTaskRuntimeService({
    executionRetired: true,
    store: {
      list: async () => [structuredClone(task)],
      listPendingOutbox: async () => [],
      read: async () => structuredClone(task),
      transition: async (id, input) => {
        transitions.push([id, input]);
        task = { ...task, lifecycle: input.lifecycle, status: input.lifecycle, blockingReason: input.blockingReason, revision: task.revision + 1 };
        return { applied: true, task: structuredClone(task) };
      },
    },
    supervisor: { reconcile: async () => { throw new Error("retired supervisor must not run"); } },
    controller: {
      allowedTaskActions: () => ["retry", "cancel"],
      control: async (id, request) => { controls.push([id, request]); return { ok: true, applied: true, task }; },
    },
  });

  const startup = await service.initialize({ now: 321 });
  assert.deepEqual(startup.reconcile.requeued, []);
  assert.deepEqual(startup.reconcile.retired, [TASK_ID]);
  assert.equal(transitions[0][1].lifecycle, "blocked");
  assert.equal(transitions[0][1].userControlled, true);
  assert.match(transitions[0][1].blockingReason.message, /普通模型工具循环/);

  const detail = await service.getBackgroundJob(TASK_ID);
  assert.equal(detail.lifecycle, "blocked");
  assert.equal(detail.allowedActions.includes("retry"), false);
  const rejected = await service.controlBackgroundJob(TASK_ID, "retry", { expectedRevision: task.revision });
  assert.equal(rejected.reason, "execution-path-retired");
  assert.equal(controls.length, 0);
});

test("runtime initialization repairs outbox before supervision and pruning", async () => {
  const calls = [];
  const outboxRepair = { scanned: 2, repaired: [TASK_ID], auditEvents: 1 };
  const task = genericTask();
  const service = createComplexTaskRuntimeService({
    store: {
      list: async () => [task],
      listPendingOutbox: async () => [],
      read: async () => structuredClone(task),
      reconcileOutbox: async ({ now }) => {
        calls.push(["outbox", now]);
        return outboxRepair;
      },
      pruneExpired: async (now) => {
        calls.push(["prune", now]);
        return { deleted: [], kept: 1 };
      },
    },
    supervisor: {
      reconcile: async ({ now }) => {
        calls.push(["supervisor", now]);
        return { scanned: 1, requeued: [], issues: [] };
      },
    },
  });

  const startup = await service.initialize({ now: 123 });
  assert.deepEqual(calls, [["outbox", 123], ["supervisor", 123], ["prune", 123]]);
  assert.deepEqual(startup.outboxRepair, outboxRepair);
});

test("runtime initialization isolates maintenance failures and continues later recovery stages", async () => {
  const calls = [];
  const service = createComplexTaskRuntimeService({
    store: {
      list: async () => [],
      listPendingOutbox: async () => [],
      read: async () => null,
      reconcileOutbox: async () => {
        calls.push("outbox");
        throw new Error("outbox directory temporarily unavailable");
      },
      pruneExpired: async () => {
        calls.push("prune");
        return { deleted: [], kept: 2 };
      },
    },
    supervisor: {
      reconcile: async () => {
        calls.push("supervisor");
        return { scanned: 2, requeued: [TASK_ID], issues: [] };
      },
    },
  });

  const startup = await service.initialize({ now: 456 });

  assert.equal(startup.initialized, true);
  assert.deepEqual(calls, ["outbox", "supervisor", "prune"]);
  assert.deepEqual(startup.reconcile.requeued, [TASK_ID]);
  assert.equal(startup.pruned.kept, 2);
  assert.equal(startup.issues.length, 1);
  assert.equal(startup.issues[0].operation, "outbox-reconcile");
  assert.match(startup.issues[0].message, /temporarily unavailable/);
  assert.deepEqual(startup.outboxRepair.repaired, []);
});
