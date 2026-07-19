import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { createComplexTaskOrchestrator } from "./complex-task-orchestrator.mjs";

const TASK_A = "task:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_B = "task:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TASK_C = "task:cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function enginePin(engine = "v2") {
  return {
    schemaVersion: 1,
    rolloutMode: engine === "v2" ? "v2-default" : "legacy",
    executionEngine: engine,
    shadow: false,
    reason: "pinned-at-creation",
    selectedAt: "2026-07-19T00:00:00.000Z",
  };
}

function task(id, overrides = {}) {
  return {
    id,
    kind: "task",
    lifecycle: "queued",
    status: "queued",
    revision: 0,
    epoch: 0,
    lease: null,
    metadata: { complexTaskEngine: enginePin("v2") },
    contract: {
      taskType: "document.test",
      completion: { requiredCoverage: ["unit-1"], requiredArtifacts: ["final"] },
      output: { format: "markdown", requestedPath: "result.md", conflictPolicy: "ask" },
      pinned: { adapterVersion: "adapter-v1", skillHash: "skill-v1", toolSchemaVersion: "1" },
    },
    unitPlans: [{ unitId: "unit-1", primaryCoverage: ["unit-1"] }],
    unitResults: {},
    coverageLedger: { "unit-1": { state: "pending" } },
    outbox: [],
    ...overrides,
  };
}

function createFakeRuntime(initialTasks, options = {}) {
  const states = new Map(initialTasks.map((item) => [item.id, structuredClone(item)]));
  const calls = [];
  let leaseCounter = 0;
  const store = {
    calls,
    async list() {
      calls.push(["list"]);
      return [...states.values()].map((item) => structuredClone(item));
    },
    async read(id) {
      calls.push(["read", id]);
      const value = states.get(id);
      if (!value) throw Object.assign(new Error("task missing"), { code: "ENOENT" });
      return structuredClone(value);
    },
    async acquireLease(id, input) {
      calls.push(["acquireLease", id, structuredClone(input)]);
      const current = states.get(id);
      if (!current || current.lifecycle !== "queued" || current.revision !== input.expectedRevision) {
        return { ok: false, reason: "not-claimable", task: structuredClone(current) };
      }
      const epoch = current.epoch + 1;
      const lease = { leaseId: `lease-${++leaseCounter}`, epoch, owner: input.owner, expiresAt: Date.now() + 10_000 };
      const next = { ...current, lifecycle: "leased", status: "leased", epoch, lease, revision: current.revision + 1 };
      states.set(id, next);
      return { ok: true, leaseId: lease.leaseId, epoch, lease, task: structuredClone(next) };
    },
    async transition(id, input) {
      calls.push(["transition", id, structuredClone(input)]);
      const current = states.get(id);
      if (!current || current.revision !== input.expectedRevision) return { applied: false, reason: "revision-mismatch", task: structuredClone(current) };
      const next = { ...current, lifecycle: input.lifecycle, status: input.lifecycle, revision: current.revision + 1 };
      states.set(id, next);
      return { applied: true, task: structuredClone(next) };
    },
    async complete(id, outcome, guard) {
      calls.push(["complete", id, structuredClone(outcome), structuredClone(guard)]);
      const current = states.get(id);
      if (!current || current.revision !== guard.expectedRevision || current.epoch !== guard.epoch) return { applied: false, reason: "stale-lease", task: structuredClone(current) };
      const next = { ...current, lifecycle: "terminal", status: "terminal", outcome: structuredClone(outcome), lease: null, revision: current.revision + 1 };
      states.set(id, next);
      return { applied: true, task: structuredClone(next), deliveryId: "delivery-1" };
    },
    async releaseLease(id, input) {
      calls.push(["releaseLease", id, structuredClone(input)]);
      const current = states.get(id);
      if (!current || current.revision !== input.expectedRevision) return { ok: false, reason: "revision-mismatch", task: structuredClone(current) };
      const next = { ...current, lifecycle: "queued", status: "queued", lease: null, revision: current.revision + 1 };
      states.set(id, next);
      return { ok: true, task: structuredClone(next) };
    },
  };
  const worker = options.worker ?? {
    calls,
    async runOne(id, input) {
      calls.push(["runOne", id, input]);
      return { status: "unit_completed", task: await store.read(id) };
    },
  };
  const supervisor = options.supervisor ?? {
    async reconcile(input) {
      calls.push(["reconcile", structuredClone(input)]);
      return { scanned: initialTasks.length, requeued: [], issues: [] };
    },
  };
  return { states, calls, store, worker, supervisor };
}

function successfulAssembly(taskSnapshot) {
  return {
    ok: true,
    outcome: {
      schemaVersion: 1,
      taskId: taskSnapshot.id,
      outcome: "delivered",
      summary: "assembled",
      artifactRefs: ["artifact:final"],
      coverage: { required: 1, completed: 1, unresolved: [] },
      warnings: [],
      resumable: false,
    },
  };
}

test("requires all durable dependencies and exposes bounded controls", () => {
  assert.throws(() => createComplexTaskOrchestrator({}), /requires store/);
  const runtime = createFakeRuntime([task(TASK_A)]);
  const orchestrator = createComplexTaskOrchestrator({
    ...runtime,
    adapters: new Map([["document.test", { name: "document-adapter" }]]),
    assembler: async () => successfulAssembly(task(TASK_A)),
    maxConcurrency: 2,
  });
  assert.equal(orchestrator.maxConcurrency, 2);
  assert.equal(orchestrator.initialized, false);
  assert.equal(orchestrator.running, false);
});

test("initializes by reconciling first, claims only queued tasks, and respects concurrency", async () => {
  const runtime = createFakeRuntime([
    task(TASK_A),
    task(TASK_B),
    task(TASK_C, { lifecycle: "paused", status: "paused" }),
  ]);
  const active = new Set();
  let maxActive = 0;
  const worker = {
    async runOne(id, input) {
      runtime.calls.push(["runOne", id, { enginePin: input.enginePin }]);
      active.add(id);
      maxActive = Math.max(maxActive, active.size);
      await delay(10);
      active.delete(id);
      return { status: "unit_completed", task: await runtime.store.read(id) };
    },
  };
  const orchestrator = createComplexTaskOrchestrator({
    store: runtime.store,
    worker,
    supervisor: runtime.supervisor,
    adapters: { "document.test": {} },
    assembler: async () => successfulAssembly(task(TASK_A)),
    maxConcurrency: 2,
    pollIntervalMs: 60_000,
  });
  const report = await orchestrator.runOnce({ now: 100 });
  assert.equal(report.started.length, 2);
  assert.equal(maxActive, 2);
  assert.deepEqual(report.started.sort(), [TASK_A, TASK_B].sort());
  assert.equal(runtime.calls.findIndex(([name]) => name === "reconcile") < runtime.calls.findIndex(([name]) => name === "list"), true);
  assert.equal(runtime.calls.some(([name, id]) => name === "runOne" && id === TASK_C), false);
});

test("runs one unit then requests another wake without recursively claiming the same task", async () => {
  const runtime = createFakeRuntime([task(TASK_A)]);
  let runs = 0;
  const worker = {
    async runOne(id) {
      runs += 1;
      runtime.calls.push(["runOne", id]);
      return { status: "unit_completed", task: await runtime.store.read(id) };
    },
  };
  const orchestrator = createComplexTaskOrchestrator({
    store: runtime.store,
    worker,
    supervisor: runtime.supervisor,
    adapters: { "document.test": {} },
    assembler: async () => successfulAssembly(task(TASK_A)),
    pollIntervalMs: 1,
  });
  const first = await orchestrator.runOnce();
  assert.equal(first.started.length, 1);
  assert.equal(first.rescheduleRequested, true);
  await orchestrator.stop();
  assert.equal(runs, 1);
});

test("ready_for_assembly acquires a fresh lease, fences assembly, and commits a terminal outcome", async () => {
  const runtime = createFakeRuntime([task(TASK_A)]);
  const adapter = { name: "doc-adapter" };
  const seen = [];
  const worker = {
    async runOne(id, input) {
      seen.push(["worker", id, input.enginePin]);
      return { status: "ready_for_assembly", task: await runtime.store.read(id) };
    },
  };
  const assembler = async (input) => {
    seen.push(["assembler", input.task.id, input.adapter, input.lease.epoch]);
    return successfulAssembly(input.task);
  };
  const orchestrator = createComplexTaskOrchestrator({
    store: runtime.store,
    worker,
    supervisor: runtime.supervisor,
    adapters: new Map([["document.test", adapter]]),
    assembler,
    maxConcurrency: 1,
  });
  const report = await orchestrator.runOnce();
  assert.equal(report.results[0].status, "assembled");
  assert.deepEqual(seen[0], ["worker", TASK_A, enginePin("v2")]);
  assert.deepEqual(seen[1], ["assembler", TASK_A, adapter, 1]);
  const complete = runtime.calls.find(([name]) => name === "complete");
  assert.equal(complete[3].epoch, 1);
  assert.equal(complete[3].expectedRevision, 2);
  assert.equal((await runtime.store.read(TASK_A)).lifecycle, "terminal");
});

test("worker and assembly exceptions converge visibly instead of disappearing", async () => {
  const workerRuntime = createFakeRuntime([task(TASK_A)]);
  const workerError = createComplexTaskOrchestrator({
    store: workerRuntime.store,
    worker: { runOne: async () => { throw new Error("worker exploded"); } },
    supervisor: workerRuntime.supervisor,
    adapters: { "document.test": {} },
    assembler: async () => successfulAssembly(task(TASK_A)),
  });
  const workerReport = await workerError.runOnce();
  assert.equal(workerReport.results[0].status, "blocked");
  assert.equal((await workerRuntime.store.read(TASK_A)).lifecycle, "blocked");
  assert.ok(workerReport.issues[0].message.includes("worker exploded"));

  const assemblyRuntime = createFakeRuntime([task(TASK_B)]);
  const assemblyError = createComplexTaskOrchestrator({
    store: assemblyRuntime.store,
    worker: { runOne: async (id) => ({ status: "ready_for_assembly", task: await assemblyRuntime.store.read(id) }) },
    supervisor: assemblyRuntime.supervisor,
    adapters: { "document.test": {} },
    assembler: async () => { throw new Error("assembler exploded"); },
  });
  const assemblyReport = await assemblyError.runOnce();
  assert.equal(assemblyReport.results[0].status, "assembled_failure");
  assert.equal((await assemblyRuntime.store.read(TASK_B)).lifecycle, "terminal");
  assert.equal((await assemblyRuntime.store.read(TASK_B)).outcome.outcome, "failed");
});

test("a pinned engine is passed through unchanged even when live configuration changes", async () => {
  const runtime = createFakeRuntime([task(TASK_A, { metadata: { complexTaskEngine: enginePin("legacy") } })]);
  const pins = [];
  const orchestrator = createComplexTaskOrchestrator({
    store: runtime.store,
    worker: { runOne: async (id, input) => { pins.push(input.enginePin); return { status: "unit_completed", task: await runtime.store.read(id) }; } },
    supervisor: runtime.supervisor,
    adapters: { "document.test": {} },
    assembler: async () => successfulAssembly(task(TASK_A)),
    currentEngine: "v2-default",
  });
  await orchestrator.runOnce();
  assert.deepEqual(pins, [enginePin("legacy")]);
});

test("stop aborts in-flight work and prevents new claims", async () => {
  const runtime = createFakeRuntime([task(TASK_A), task(TASK_B)]);
  let aborted = false;
  const orchestrator = createComplexTaskOrchestrator({
    store: runtime.store,
    worker: {
      async runOne(id, { signal }) {
        await new Promise((resolve) => {
          signal.addEventListener("abort", () => { aborted = true; resolve(); }, { once: true });
        });
        return { status: "superseded", reason: "stopped", task: await runtime.store.read(id) };
      },
    },
    supervisor: runtime.supervisor,
    adapters: { "document.test": {} },
    assembler: async () => successfulAssembly(task(TASK_A)),
    maxConcurrency: 1,
  });
  const running = orchestrator.runOnce();
  await delay(5);
  await orchestrator.stop();
  await running;
  assert.equal(aborted, true);
  assert.equal(runtime.calls.filter(([name]) => name === "runOne").length, 1);
});
