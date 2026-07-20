import test from "node:test";
import assert from "node:assert/strict";

import { createComplexTaskOrchestrator } from "./complex-task-orchestrator.mjs";

function emptyStore() {
  return {
    async list() { return []; },
    async read() { throw Object.assign(new Error("task missing"), { code: "ENOENT" }); },
    async acquireLease() { return { ok: false, reason: "not-queued" }; },
    async transition() { return { applied: false, reason: "not-running" }; },
    async complete() { return { applied: false, reason: "not-running" }; },
  };
}

test("every orchestrator poll reconciles leases instead of supervising only at startup", async () => {
  const reconciliations = [];
  const orchestrator = createComplexTaskOrchestrator({
    store: emptyStore(),
    worker: { async runOne() { throw new Error("no task should be claimed"); } },
    supervisor: {
      async reconcile(input) {
        reconciliations.push(input.now);
        return { scanned: 0, requeued: [], issues: [] };
      },
    },
    assembler: async () => { throw new Error("no task should be assembled"); },
  });

  await orchestrator.runOnce({ now: 100 });
  const second = await orchestrator.runOnce({ now: 200 });

  assert.deepEqual(reconciliations, [100, 200]);
  assert.deepEqual(second.reconcile, { scanned: 0, requeued: [], issues: [] });
});

test("reconciliation state changes are reread and emitted through onChange once per task", async () => {
  const taskA = "task:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const taskB = "task:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const reads = [];
  const changes = [];
  const states = new Map([
    [taskA, { id: taskA, lifecycle: "queued", revision: 4 }],
    [taskB, { id: taskB, lifecycle: "waiting_user", revision: 7 }],
  ]);
  const orchestrator = createComplexTaskOrchestrator({
    store: {
      async list() { return []; },
      async read(id) {
        reads.push(id);
        return structuredClone(states.get(id));
      },
      async acquireLease() { return { ok: false, reason: "not-queued" }; },
      async transition() { return { applied: false, reason: "not-running" }; },
      async complete() { return { applied: false, reason: "not-running" }; },
    },
    worker: { async runOne() { throw new Error("no task should be claimed"); } },
    supervisor: {
      async reconcile() {
        return {
          scanned: 2,
          stalled: [taskA],
          requeued: [taskA],
          sourceChanged: [taskB],
          issues: [],
        };
      },
    },
    assembler: async () => { throw new Error("no task should be assembled"); },
    onChange: async (task, detail) => changes.push({ task, detail }),
  });

  await orchestrator.runOnce({ now: 300 });

  assert.deepEqual(reads, [taskA, taskB]);
  assert.deepEqual(changes.map(({ task }) => task.id), [taskA, taskB]);
  assert.equal(changes[0].detail.taskId, taskA);
  assert.equal(changes[0].detail.kind, "reconciliation");
  assert.equal(changes[1].detail.taskId, taskB);
  assert.equal(changes[1].detail.kind, "reconciliation");
});
