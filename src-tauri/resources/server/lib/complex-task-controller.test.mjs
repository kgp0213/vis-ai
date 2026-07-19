import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  TASK_CONTROL_ACTIONS,
  allowedTaskActions,
  createComplexTaskController,
} from "./complex-task-controller.mjs";
import { createComplexTaskStore } from "./complex-task-store.mjs";

const TASK_ID = "task:11111111-1111-4111-8111-111111111111";

function task(overrides = {}) {
  return {
    id: TASK_ID,
    lifecycle: "queued",
    status: "queued",
    revision: 3,
    epoch: 0,
    lease: null,
    outcome: null,
    outbox: [],
    ...overrides,
  };
}

function fakeStore(current, overrides = {}) {
  const calls = [];
  return {
    calls,
    read: async (id) => {
      calls.push(["read", id]);
      return structuredClone(current);
    },
    applyUserControl: async (id, input) => {
      calls.push(["applyUserControl", id, structuredClone(input)]);
      return overrides.applyUserControlResult ?? {
        applied: true,
        task: task({ ...current, revision: current.revision + 1 }),
      };
    },
    ackOutbox: async (id, deliveryId, input) => {
      calls.push(["ackOutbox", id, deliveryId, structuredClone(input)]);
      return overrides.ackOutboxResult ?? {
        applied: true,
        task: task({ ...current, revision: current.revision + 1 }),
      };
    },
    removeIfUnreferenced: async (id, input) => {
      calls.push(["removeIfUnreferenced", id, structuredClone(input)]);
      return overrides.removeResult ?? { applied: true, deleted: true };
    },
  };
}

test("derives conservative allowed actions from lifecycle, user request, and outbox state", () => {
  assert.deepEqual(TASK_CONTROL_ACTIONS, [
    "pause", "resume", "retry", "cancel", "resolve_user_input", "retarget_output", "ack_outcome", "delete_record",
  ]);
  assert.deepEqual(allowedTaskActions(task()), ["pause", "cancel"]);
  assert.deepEqual(allowedTaskActions(task({ lifecycle: "running" })), ["pause", "cancel"]);
  assert.deepEqual(allowedTaskActions(task({ lifecycle: "blocked" })), ["retry", "cancel"]);
  assert.deepEqual(allowedTaskActions(task({ lifecycle: "paused" })), ["resume", "retry", "cancel"]);
  assert.deepEqual(allowedTaskActions(task({
    lifecycle: "waiting_user",
    userInputRequest: { requestId: "request-1", reason: "output-conflict" },
  })), ["resolve_user_input", "retarget_output", "cancel"]);

  const pending = task({
    lifecycle: "terminal",
    outcome: { resumable: true },
    outbox: [{
      deliveryId: "delivery-1",
      consumers: ["task-center"],
      acknowledgements: {},
      pendingConsumers: ["task-center"],
    }],
  });
  assert.deepEqual(allowedTaskActions(pending), ["retry", "ack_outcome"]);
  assert.deepEqual(allowedTaskActions({
    ...pending,
    outbox: [{ ...pending.outbox[0], acknowledgements: { "task-center": true }, pendingConsumers: [] }],
  }), ["retry", "delete_record"]);
  assert.deepEqual(allowedTaskActions(task({ corrupt: true })), []);
});

test("intersects a persisted allowedActions projection instead of trusting broader actions", () => {
  assert.deepEqual(allowedTaskActions(task({
    lifecycle: "paused",
    allowedActions: ["resume", "delete_record", "unknown"],
  })), ["resume"]);
  assert.deepEqual(allowedTaskActions(task({ lifecycle: "created" })), []);
  assert.deepEqual(allowedTaskActions(task({ lifecycle: "unknown" })), []);
  assert.deepEqual(allowedTaskActions(task({ lifecycle: "waiting_user", userInputRequest: { type: "output-conflict" } })), ["resolve_user_input", "retarget_output", "cancel"]);
  assert.deepEqual(allowedTaskActions(task({ lifecycle: "waiting_user", userInputRequest: { allowRetarget: true } })), ["resolve_user_input", "retarget_output", "cancel"]);
  assert.deepEqual(allowedTaskActions(task({
    lifecycle: "terminal",
    outbox: [{ deliveryId: "d", consumers: ["task-center"], acknowledgements: { "task-center": true } }],
  })), ["delete_record"]);
});

test("requires the complete Store control surface", () => {
  assert.throws(() => createComplexTaskController({ store: {} }), /requires read/);
});

test("rejects missing revision, disallowed actions, and malformed action payloads before mutation", async () => {
  const queuedStore = fakeStore(task());
  const controller = createComplexTaskController({ store: queuedStore });

  const missingRevision = await controller.control(TASK_ID, { action: "pause" });
  assert.equal(missingRevision.reason, "expected-revision-required");
  assert.equal(queuedStore.calls.length, 0);

  const disallowed = await controller.control(TASK_ID, { action: "resume", expectedRevision: 3 });
  assert.equal(disallowed.reason, "action-not-allowed");
  assert.deepEqual(disallowed.allowedActions, ["pause", "cancel"]);
  assert.equal(queuedStore.calls.filter(([name]) => name !== "read").length, 0);

  const waitingStore = fakeStore(task({
    lifecycle: "waiting_user",
    userInputRequest: { requestId: "request-1", reason: "output-conflict" },
  }));
  const waitingController = createComplexTaskController({ store: waitingStore });
  assert.equal((await waitingController.control(TASK_ID, {
    action: "resolve_user_input",
    expectedRevision: 3,
    payload: { requestId: "request-1" },
  })).reason, "resolution-required");
  assert.equal((await waitingController.control(TASK_ID, {
    action: "retarget_output",
    expectedRevision: 3,
    payload: { requestedPath: "  " },
  })).reason, "requested-path-required");
  assert.equal((await waitingController.control(TASK_ID, {
    action: "retarget_output",
    expectedRevision: 3,
    payload: { requestedPath: "C:\\work\\new.md" },
  })).reason, "request-id-required");
});

test("active user controls require the current epoch and pass the observed lease identity", async () => {
  const running = task({
    lifecycle: "running",
    revision: 8,
    epoch: 4,
    lease: { leaseId: "lease-4", epoch: 4, owner: "worker-1", expiresAt: Date.now() + 10_000 },
  });
  const store = fakeStore(running);
  const controller = createComplexTaskController({ store });

  assert.equal((await controller.control(TASK_ID, {
    action: "pause",
    expectedRevision: 8,
  })).reason, "expected-epoch-required");
  assert.equal((await controller.control(TASK_ID, {
    action: "pause",
    expectedRevision: 8,
    expectedEpoch: 3,
  })).reason, "epoch-mismatch");

  const result = await controller.control(TASK_ID, {
    action: "pause",
    expectedRevision: 8,
    expectedEpoch: 4,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(store.calls.at(-1), ["applyUserControl", TASK_ID, {
    action: "pause",
    expectedRevision: 8,
    expectedEpoch: 4,
    leaseId: "lease-4",
    payload: {},
  }]);
});

test("rejects a malformed epoch and stale lease epoch before dispatch", async () => {
  const current = task({
    lifecycle: "running",
    epoch: 4,
    lease: { leaseId: "lease-4", epoch: 3, expiresAt: Date.now() + 10_000 },
  });
  const store = fakeStore(current);
  const controller = createComplexTaskController({ store });
  assert.equal((await controller.control(TASK_ID, { action: "pause", expectedRevision: 3, expectedEpoch: "4" })).reason, "epoch-mismatch");
  assert.equal((await controller.control(TASK_ID, { action: "pause", expectedRevision: 3, expectedEpoch: 4 })).reason, "lease-epoch-mismatch");
});

test("delegates lifecycle and user-input actions through the atomic Store control API", async (t) => {
  const cases = [
    { action: "pause", current: task(), payload: {} },
    { action: "resume", current: task({ lifecycle: "paused" }), payload: {} },
    { action: "retry", current: task({ lifecycle: "blocked" }), payload: { reason: "provider recovered" } },
    { action: "cancel", current: task(), payload: { reason: "user cancelled" } },
    {
      action: "resolve_user_input",
      current: task({ lifecycle: "waiting_user", userInputRequest: { requestId: "request-1", reason: "choice" } }),
      payload: { requestId: "request-1", resolution: { choiceId: "continue" } },
    },
    {
      action: "retarget_output",
      current: task({ lifecycle: "waiting_user", userInputRequest: { requestId: "request-2", reason: "output-conflict" } }),
      payload: { requestId: "request-2", requestedPath: "C:\\work\\result-2.md" },
    },
  ];

  for (const entry of cases) {
    await t.test(entry.action, async () => {
      const store = fakeStore(entry.current);
      const controller = createComplexTaskController({ store });
      const result = await controller.control(TASK_ID, {
        action: entry.action,
        expectedRevision: entry.current.revision,
        payload: entry.payload,
      });
      assert.equal(result.ok, true);
      assert.deepEqual(store.calls.at(-1), ["applyUserControl", TASK_ID, {
        action: entry.action,
        expectedRevision: entry.current.revision,
        payload: entry.action === "resolve_user_input"
          ? { requestId: entry.payload.requestId, answer: entry.payload.resolution }
          : entry.payload,
      }]);
    });
  }
});

test("normalizes alternate user-input answer shapes for the Store protocol", async () => {
  for (const [input, expected] of [
    [{ requestId: "request", answer: "yes" }, { requestId: "request", answer: "yes" }],
    [{ requestId: "request", choiceId: "yes" }, { requestId: "request", answer: "yes" }],
    [{ requestId: "request", value: { ok: true } }, { requestId: "request", answer: { ok: true } }],
  ]) {
    const current = task({ lifecycle: "waiting_user", userInputRequest: { requestId: "request", reason: "choice" } });
    const store = fakeStore(current);
    const controller = createComplexTaskController({ store });
    const result = await controller.control(TASK_ID, { action: "resolve_user_input", expectedRevision: 3, payload: input });
    assert.equal(result.ok, true);
    assert.deepEqual(store.calls.at(-1)[2].payload, expected);
  }
});

test("acknowledges one delivery consumer and deletes only through CAS-safe Store methods", async () => {
  const pending = task({
    lifecycle: "terminal",
    outbox: [{ deliveryId: "delivery-1", consumers: ["task-center"], acknowledgements: {}, pendingConsumers: ["task-center"] }],
  });
  const ackStore = fakeStore(pending);
  const ackController = createComplexTaskController({ store: ackStore });
  const acked = await ackController.control(TASK_ID, {
    action: "ack_outcome",
    expectedRevision: 3,
    payload: { deliveryId: "delivery-1", consumer: "task-center" },
  });
  assert.equal(acked.ok, true);
  assert.deepEqual(ackStore.calls.at(-1), ["ackOutbox", TASK_ID, "delivery-1", {
    expectedRevision: 3,
    consumer: "task-center",
  }]);

  const delivered = task({ lifecycle: "terminal", outbox: [] });
  const deleteStore = fakeStore(delivered);
  const deleteController = createComplexTaskController({ store: deleteStore });
  const deleted = await deleteController.control(TASK_ID, {
    action: "delete_record",
    expectedRevision: 3,
  });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.task, undefined);
  assert.deepEqual(deleteStore.calls.at(-1), ["removeIfUnreferenced", TASK_ID, { expectedRevision: 3 }]);
});

test("rejects an acknowledgement for a missing or already acknowledged delivery", async () => {
  const current = task({
    lifecycle: "terminal",
    outbox: [{ deliveryId: "delivery-1", consumers: ["task-center"], acknowledgements: { "task-center": true } }],
  });
  const store = fakeStore(current);
  const controller = createComplexTaskController({ store });
  const result = await controller.control(TASK_ID, {
    action: "ack_outcome",
    expectedRevision: 3,
    payload: { deliveryId: "delivery-1", consumer: "task-center" },
  });
  assert.equal(result.reason, "action-not-allowed");
});

test("surfaces Store CAS failures with the latest allowed actions", async () => {
  const current = task({ lifecycle: "paused" });
  const store = fakeStore(current, {
    applyUserControlResult: { applied: false, reason: "revision-mismatch", task: task({ ...current, revision: 4 }) },
  });
  const controller = createComplexTaskController({ store });
  const result = await controller.control(TASK_ID, {
    action: "resume",
    expectedRevision: 3,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "revision-mismatch");
  assert.deepEqual(result.allowedActions, ["resume", "retry", "cancel"]);
});

test("runs the full control lifecycle against the durable task Store", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-task-controller-"));
  try {
    const store = createComplexTaskStore(root);
    const created = await store.create({
      now: 100,
      contract: {
        schemaVersion: 1,
        taskId: TASK_ID,
        taskType: "controller.test",
        goal: "exercise task controls",
        workspace: root,
        sources: [{ sourceId: "source-1", uri: "C:\\work\\source.txt", kind: "local-file", fingerprint: "fingerprint-1" }],
        output: { format: "markdown", requestedPath: "C:\\work\\result.md", conflictPolicy: "ask" },
        completion: { requiredCoverage: ["coverage-1"], requiredArtifacts: ["artifact-1"] },
        quality: { requestedFidelity: "normal", semanticReviewMode: "none", maxRepairPasses: 0 },
        permissions: {},
        interactionPolicy: { mode: "automatic", deliveryChannels: ["task-center"] },
        executionLimits: { wallClockMs: 10_000, stallTimeoutMs: 1_000, attemptLimit: 2 },
        pinned: { adapterVersion: "test", skillHash: "skill-hash", toolSchemaVersion: "1", initialModelConfigFingerprints: [] },
      },
      unitPlans: [{
        unitId: "unit-1",
        primaryCoverage: ["coverage-1"],
        dependencies: [],
        contextRefs: [],
        requiredCapabilities: [],
        outputRole: "draft",
        fallbackPolicy: "source-fallback",
        planRevision: 1,
      }],
    });
    const controller = createComplexTaskController({ store });

    const paused = await controller.control(TASK_ID, { action: "pause", expectedRevision: created.revision });
    assert.equal(paused.ok, true);
    assert.equal(paused.task.lifecycle, "paused");

    const resumed = await controller.control(TASK_ID, { action: "resume", expectedRevision: paused.task.revision });
    assert.equal(resumed.ok, true);
    assert.equal(resumed.task.lifecycle, "queued");

    const waitingForAnswer = await store.transition(TASK_ID, {
      expectedRevision: resumed.task.revision,
      lifecycle: "waiting_user",
      userInputRequest: { requestId: "request-answer", reason: "choice", question: "Continue?", choices: [] },
    });
    const resolved = await controller.control(TASK_ID, {
      action: "resolve_user_input",
      expectedRevision: waitingForAnswer.task.revision,
      payload: { requestId: "request-answer", resolution: { choiceId: "continue" } },
    });
    assert.equal(resolved.ok, true);
    assert.deepEqual(resolved.task.userInputResolution.answer, { choiceId: "continue" });

    const waitingForPath = await store.transition(TASK_ID, {
      expectedRevision: resolved.task.revision,
      lifecycle: "waiting_user",
      userInputRequest: { requestId: "request-output", reason: "output-conflict", question: "Choose another path", choices: [] },
    });
    const retargeted = await controller.control(TASK_ID, {
      action: "retarget_output",
      expectedRevision: waitingForPath.task.revision,
      payload: { requestId: "request-output", requestedPath: "C:\\work\\result-2.md" },
    });
    assert.equal(retargeted.ok, true);
    assert.equal(retargeted.task.contract.output.requestedPath, "C:\\work\\result-2.md");

    const cancelled = await controller.control(TASK_ID, {
      action: "cancel",
      expectedRevision: retargeted.task.revision,
      payload: { summary: "cancelled during integration test" },
    });
    assert.equal(cancelled.ok, true);
    assert.equal(cancelled.task.lifecycle, "terminal");
    const delivery = cancelled.task.outbox.find((entry) => entry.kind === "task-outcome") || cancelled.task.outbox.at(-1);
    assert.ok(delivery);
    let acknowledged = await controller.control(TASK_ID, {
      action: "ack_outcome",
      expectedRevision: cancelled.task.revision,
      payload: { deliveryId: delivery.deliveryId, consumer: "task-center" },
    });
    assert.equal(acknowledged.ok, true);
    for (const pending of acknowledged.task.outbox.filter((entry) => (entry.pendingConsumers || []).includes("task-center"))) {
      acknowledged = await controller.control(TASK_ID, {
        action: "ack_outcome",
        expectedRevision: acknowledged.task.revision,
        payload: { deliveryId: pending.deliveryId, consumer: "task-center" },
      });
      assert.equal(acknowledged.ok, true);
    }
    assert.deepEqual(acknowledged.allowedActions, ["delete_record"]);

    const deleted = await controller.control(TASK_ID, {
      action: "delete_record",
      expectedRevision: acknowledged.task.revision,
    });
    assert.equal(deleted.ok, true);
    assert.equal(deleted.deleted, true);
    await assert.rejects(() => store.read(TASK_ID), (error) => error.code === "ENOENT");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
