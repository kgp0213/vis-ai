import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";

import { createComplexTaskStore } from "./complex-task-store.mjs";
import { createDurableAgentWorker } from "./complex-task-worker.mjs";

function taskId() {
  return `task:${randomUUID()}`;
}

function contract(id, overrides = {}) {
  const base = {
    schemaVersion: 1,
    taskId: id,
    taskType: "document.markdown",
    goal: "Produce a complete Markdown document",
    workspace: "D:/workspace",
    sources: [{ sourceId: "source-1", uri: "manual.pdf", kind: "pdf", fingerprint: "sha256:source", required: true }],
    output: { format: "markdown", requestedPath: "result.md", conflictPolicy: "ask" },
    completion: { requiredCoverage: ["page:1", "page:2"], requiredArtifacts: ["final-markdown"] },
    quality: { requestedFidelity: "complete", semanticReviewMode: "llm", maxRepairPasses: 2 },
    permissions: { readSources: true, writeOutput: true },
    interactionPolicy: { mode: "ask_when_blocked", deliveryChannels: ["task-center"] },
    executionLimits: { wallClockMs: 5_000, stallTimeoutMs: 1_000, attemptLimit: 3 },
    pinned: {
      adapterVersion: "document-v1",
      skillHash: "sha256:skill",
      toolSchemaVersion: "1",
      initialModelConfigFingerprints: ["model-config-1"],
    },
  };
  return {
    ...base,
    ...overrides,
    completion: { ...base.completion, ...(overrides.completion ?? {}) },
    interactionPolicy: { ...base.interactionPolicy, ...(overrides.interactionPolicy ?? {}) },
    executionLimits: { ...base.executionLimits, ...(overrides.executionLimits ?? {}) },
  };
}

function plans(count = 2) {
  return Array.from({ length: count }, (_, index) => ({
    unitId: `unit-${index + 1}`,
    primaryCoverage: [`page:${index + 1}`],
    dependencies: index === 0 ? [] : [`unit-${index}`],
    contextRefs: index === 0 ? [] : [{ sourceId: "source-1", range: `page:${index}`, role: "context-only" }],
    requiredCapabilities: ["text"],
    outputRole: "section",
    fallbackPolicy: "preserve-source",
    planRevision: 1,
  }));
}

function unitResult(unitPlan, attemptId) {
  return {
    unitId: unitPlan.unitId,
    attemptId,
    proposedStatus: "completed",
    artifactRefs: [`artifact:${unitPlan.unitId}`],
    proposedPrimaryCoverage: [...unitPlan.primaryCoverage],
    contextRefsUsed: [],
    missingSourceRanges: [],
    evidenceRefs: ["source-1"],
    warnings: [],
    confidence: 0.8,
    nextActionProposal: "continue",
  };
}

async function withStore(fn, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "visionox-complex-worker-"));
  try {
    return await fn(createComplexTaskStore(root, options), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function createTask(store, { unitCount = 2, contractOverrides = {} } = {}) {
  const id = taskId();
  return store.create({
    contract: contract(id, {
      ...contractOverrides,
      completion: {
        requiredCoverage: Array.from({ length: unitCount }, (_, index) => `page:${index + 1}`),
        requiredArtifacts: ["final-markdown"],
        ...(contractOverrides.completion ?? {}),
      },
    }),
    unitPlans: plans(unitCount),
  });
}

test("durable worker processes one eligible unit, uses broker, heartbeats, and ignores a parent abort", async () => {
  await withStore(async (store) => {
    const task = await createTask(store);
    const calls = [];
    const broker = {
      invoke: async (name, args, context) => {
        calls.push({ name, args, context });
        return { text: "source text" };
      },
    };
    const executed = [];
    const worker = createDurableAgentWorker({
      store,
      owner: "worker-test",
      toolBroker: broker,
      leaseTtlMs: 200,
      heartbeatIntervalMs: 5,
      attemptTimeoutMs: 500,
      executeUnit: async ({ unitPlan, attemptId, signal, invokeTool }) => {
        executed.push(unitPlan.unitId);
        assert.equal(signal.aborted, false);
        await invokeTool("read_source", { sourceId: "source-1" }, { effectKey: "read" });
        await delay(25);
        return unitResult(unitPlan, attemptId);
      },
    });
    const parent = new AbortController();
    parent.abort(new Error("parent chat stopped"));
    const result = await worker.runOne(task.id, { signal: parent.signal });

    assert.equal(result.status, "unit_completed");
    assert.deepEqual(executed, ["unit-1"]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].context.taskId, task.id);
    assert.equal(calls[0].context.unitId, "unit-1");
    assert.match(calls[0].context.leaseId, /^[0-9a-f-]{36}$/i);
    assert.equal(calls[0].context.epochId, 1);
    const saved = await store.read(task.id);
    assert.equal(saved.lifecycle, "queued");
    assert.equal(saved.unitResults["unit-1"].proposedStatus, "completed");
    assert.equal(saved.unitResults["unit-2"], undefined);
    assert.ok((await store.readEvents(task.id)).some((event) => event.type === "lease-heartbeat"));

    const second = await worker.runOne(task.id);
    assert.equal(second.status, "unit_completed");
    assert.deepEqual(executed, ["unit-1", "unit-2"]);
  }, { leaseMs: 200 });
});

test("explicit controlSignal stops a worker without converting a host stop into a task failure", async () => {
  await withStore(async (store) => {
    const task = await createTask(store, { unitCount: 1 });
    const parent = new AbortController();
    const control = new AbortController();
    const worker = createDurableAgentWorker({
      store,
      owner: "worker-control-test",
      leaseTtlMs: 500,
      heartbeatIntervalMs: 25,
      attemptTimeoutMs: 2_000,
      executeUnit: async ({ signal }) => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    });
    const running = worker.runOne(task.id, { signal: parent.signal, controlSignal: control.signal });
    await delay(15);
    parent.abort(new Error("chat closed"));
    await delay(15);
    assert.equal((await store.read(task.id)).lifecycle, "running");
    control.abort(new Error("host shutdown"));
    const result = await running;
    assert.equal(result.status, "stopped");
    assert.equal(result.reason, "control-signal");
    const saved = await store.read(task.id);
    assert.equal(saved.lifecycle, "queued");
    assert.equal(saved.outbox.length, 0);
  });
});

test("a needs_review unit is a resolved dependency and allows the next unit to run", async () => {
  await withStore(async (store) => {
    const task = await createTask(store, { unitCount: 2 });
    let calls = 0;
    const worker = createDurableAgentWorker({
      store,
      owner: "worker-review-test",
      maxAttempts: 1,
      executeUnit: async ({ unitPlan, attemptId }) => {
        calls += 1;
        const result = unitResult(unitPlan, attemptId);
        if (calls === 1) return {
          ...result,
          proposedStatus: "needs_review",
          warnings: [{ code: "QUALITY_REVIEW", message: "需要复核" }],
          userInputRequest: { requestId: "review-1", question: "确认后继续" },
        };
        return result;
      },
    });
    const first = await worker.runOne(task.id);
    assert.equal(first.status, "waiting_user");
    const waiting = await store.read(task.id);
    const resumed = await store.applyUserControl(task.id, {
      action: "resolve_user_input",
      expectedRevision: waiting.revision,
      expectedEpoch: waiting.epoch,
      payload: { requestId: "review-1", answer: "continue" },
    });
    assert.equal(resumed.applied, true);
    const second = await worker.runOne(task.id);
    assert.equal(second.status, "unit_completed");
    assert.equal(second.unitResult.unitId, "unit-2");
  });
});

test("bounded model failure uses a generic adapter recoverUnit before yielding for attention", async () => {
  await withStore(async (store) => {
    const task = await createTask(store, { unitCount: 1 });
    let recoveryInput = null;
    const worker = createDurableAgentWorker({
      store,
      owner: "worker-fallback-test",
      maxAttempts: 1,
      executeUnit: async () => "malformed model output",
    });
    const result = await worker.runOne(task.id, {
      adapter: {
        async recoverUnit(input) {
          recoveryInput = input;
          return {
            ...unitResult(input.unitPlan, input.attemptId),
            proposedStatus: "needs_review",
            warnings: [{ code: "HOST_FALLBACK", message: "已用宿主保底结果交付" }],
            confidence: 0.5,
            userInputRequest: { requestId: "review-fallback", question: "请复核保底结果" },
          };
        },
      },
    });
    assert.equal(result.status, "waiting_user");
    assert.equal(result.unitResult.warnings[0].code, "HOST_FALLBACK");
    assert.equal(recoveryInput.task.id, task.id);
    assert.equal(recoveryInput.unitPlan.unitId, "unit-1");
    assert.equal(recoveryInput.diagnostics.attempts.length, 1);
    assert.equal((await store.read(task.id)).unitResults["unit-1"].proposedStatus, "needs_review");
  });
});

test("malformed, empty, and tool-style model output becomes a durable degraded candidate", async () => {
  await withStore(async (store) => {
    const task = await createTask(store, { unitCount: 1 });
    const responses = ["", '{"name":"write_file","arguments":{"path":"result.md"}}', "not-json-output"];
    const worker = createDurableAgentWorker({
      store,
      toolBroker: { invoke: async () => ({}) },
      heartbeatIntervalMs: 100,
      attemptTimeoutMs: 200,
      maxAttempts: 3,
      executeUnit: async () => responses.shift(),
    });

    const result = await worker.runOne(task.id);
    assert.equal(result.status, "waiting_user");
    assert.equal(result.reason, "model-output-invalid");
    const saved = await store.read(task.id);
    assert.equal(saved.lifecycle, "waiting_user");
    const checkpoint = saved.unitResults["unit-1"];
    assert.equal(checkpoint.proposedStatus, "needs_review");
    assert.equal(checkpoint.diagnostics.attempts.length, 3);
    assert.deepEqual(checkpoint.diagnostics.attempts.map((item) => item.category), ["empty-output", "tool-style-output", "malformed-output"]);
    assert.equal(checkpoint.degradedCandidate.rawResponse, "not-json-output");
    assert.match(checkpoint.warnings[0].message, /模型输出/);
  });
});

test("a broker user-input request is persisted on the task before the worker yields", async () => {
  await withStore(async (store) => {
    const task = await createTask(store, { unitCount: 1 });
    const request = { kind: "user_input_request", requestId: "request:output-conflict", question: "请选择输出方式", choices: [{ id: "rename", label: "使用新文件名" }] };
    const worker = createDurableAgentWorker({
      store,
      toolBroker: { invoke: async () => request },
      heartbeatIntervalMs: 100,
      executeUnit: async ({ invokeTool }) => {
        await invokeTool("choose_output", {});
        return null;
      },
    });
    const result = await worker.runOne(task.id);
    assert.equal(result.status, "waiting_user");
    const saved = await store.read(task.id);
    assert.equal(saved.userInputRequest.requestId, request.requestId);
    assert.equal(saved.unitResults["unit-1"].userInputRequest.question, request.question);
  });
});

test("an unknown host effect stops at user confirmation instead of retrying another attempt", async () => {
  await withStore(async (store) => {
    const task = await createTask(store, { unitCount: 1 });
    const effectStore = new Map();
    const intents = {
      async get(id) { return effectStore.get(id) ?? null; },
      async put(value) { effectStore.set(value.effectId, structuredClone(value)); return structuredClone(value); },
    };
    let sends = 0;
    const { createHostToolBroker } = await import("./host-tool-broker.mjs");
    const broker = createHostToolBroker({
      effectStore: intents,
      operations: {
        send_message: {
          effect: true,
          execute: async () => {
            sends += 1;
            const error = new Error("connection closed after send");
            error.effectUnknown = true;
            throw error;
          },
        },
      },
    });
    const worker = createDurableAgentWorker({
      store,
      toolBroker: broker,
      maxAttempts: 3,
      executeUnit: async ({ invokeTool }) => {
        await invokeTool("send_message", { text: "hello" });
        return unitResult({ unitId: "unit-1", primaryCoverage: ["page:1"], dependencies: [] }, "attempt");
      },
    });
    const result = await worker.runOne(task.id);
    assert.equal(result.status, "waiting_user");
    assert.equal(sends, 1);
    const saved = await store.read(task.id);
    assert.equal(saved.userInputRequest.reason, "unknown-effect");
    assert.match(saved.userInputRequest.effectId, /^effect:/);
  });
});

test("bounded attempt timeout checkpoints the failure and leaves an explainable blocked task", async () => {
  await withStore(async (store) => {
    const task = await createTask(store, { unitCount: 1 });
    let calls = 0;
    const worker = createDurableAgentWorker({
      store,
      toolBroker: { invoke: async () => ({}) },
      heartbeatIntervalMs: 100,
      attemptTimeoutMs: 10,
      maxAttempts: 2,
      executeUnit: async ({ signal }) => {
        calls += 1;
        await new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    });

    const result = await worker.runOne(task.id);
    assert.equal(calls, 2);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "attempt-timeout");
    const saved = await store.read(task.id);
    assert.equal(saved.lifecycle, "blocked");
    assert.equal(saved.unitResults["unit-1"].proposedStatus, "blocked");
    assert.equal(saved.unitResults["unit-1"].diagnostics.attempts.length, 2);
    assert.ok(saved.unitResults["unit-1"].diagnostics.attempts.every((item) => item.category === "attempt-timeout"));
  });
});

test("a structured failed or blocked UnitResult does not get requeued", async () => {
  await withStore(async (store) => {
    const task = await createTask(store, { unitCount: 1 });
    const worker = createDurableAgentWorker({
      store,
      toolBroker: { invoke: async () => ({}) },
      maxAttempts: 1,
      executeUnit: async ({ unitPlan, attemptId }) => ({
        ...unitResult(unitPlan, attemptId),
        proposedStatus: "failed",
        warnings: [{ code: "MODEL_REPORTED_FAILURE", message: "source is unreadable" }],
      }),
    });
    const result = await worker.runOne(task.id);
    assert.equal(result.status, "blocked");
    assert.equal((await store.read(task.id)).lifecycle, "blocked");
    assert.equal((await store.read(task.id)).unitResults["unit-1"].proposedStatus, "failed");
  });
});

test("late model output cannot checkpoint after the lease epoch was recovered", async () => {
  await withStore(async (store) => {
    const task = await createTask(store, { unitCount: 1 });
    let recoveredEpoch = null;
    const worker = createDurableAgentWorker({
      store,
      toolBroker: { invoke: async () => ({}) },
      leaseTtlMs: 50,
      heartbeatIntervalMs: 1_000,
      attemptTimeoutMs: 500,
      executeUnit: async ({ unitPlan, attemptId }) => {
        const running = await store.read(task.id);
        recoveredEpoch = running.epoch;
        const recovered = await store.recoverExpiredLease(task.id, {
          expectedRevision: running.revision,
          expectedEpoch: running.epoch,
          now: Date.now() + 10_000,
          reason: "test takeover",
        });
        assert.equal(recovered.applied, true);
        return unitResult(unitPlan, attemptId);
      },
    });

    const result = await worker.runOne(task.id);
    assert.equal(result.status, "superseded");
    assert.ok(["revision-mismatch", "stale-lease"].includes(result.reason));
    const saved = await store.read(task.id);
    assert.equal(saved.lifecycle, "queued");
    assert.equal(saved.epoch, recoveredEpoch);
    assert.deepEqual(saved.unitResults, {});
  }, { leaseMs: 50 });
});

test("non-interactive tasks end with a durable failed OutcomeEnvelope after bounded failure", async () => {
  await withStore(async (store) => {
    const task = await createTask(store, {
      unitCount: 1,
      contractOverrides: { interactionPolicy: { mode: "never", deliveryChannels: ["task-center"] } },
    });
    const worker = createDurableAgentWorker({
      store,
      toolBroker: { invoke: async () => ({}) },
      maxAttempts: 1,
      attemptTimeoutMs: 100,
      heartbeatIntervalMs: 100,
      executeUnit: async () => {
        const error = new Error("model endpoint unavailable");
        error.code = "MODEL_UNAVAILABLE";
        throw error;
      },
    });

    const result = await worker.runOne(task.id);
    assert.equal(result.status, "terminal");
    assert.equal(result.outcome.outcome, "failed");
    assert.match(result.outcome.summary, /model endpoint unavailable/i);
    const saved = await store.read(task.id);
    assert.equal(saved.lifecycle, "terminal");
    assert.equal(saved.quality, "failed");
    assert.equal(saved.outcome.outcome, "failed");
    assert.equal((await store.listPendingOutbox({ consumer: "task-center" })).length, 1);
  });
});
