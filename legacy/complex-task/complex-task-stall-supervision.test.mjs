import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createComplexTaskStore } from "./complex-task-store.mjs";
import { createComplexTaskSupervisor } from "./complex-task-supervisor.mjs";
import { createDurableAgentWorker } from "./complex-task-worker.mjs";

function id() {
  return `task:${randomUUID()}`;
}

function contract(taskId, stallTimeoutMs = 500) {
  return {
    schemaVersion: 1,
    taskId,
    taskType: "document.markdown",
    goal: "Produce a complete document",
    workspace: "D:/workspace",
    sources: [{ sourceId: "source-1", uri: "source.pdf", kind: "pdf", fingerprint: "sha256:source", required: true }],
    output: { format: "markdown", requestedPath: "result.md", conflictPolicy: "ask" },
    completion: { requiredCoverage: ["page:1"], requiredArtifacts: ["final-markdown"] },
    quality: { requestedFidelity: "complete", semanticReviewMode: "llm", maxRepairPasses: 1 },
    permissions: { readSources: true, writeOutput: true },
    interactionPolicy: { mode: "ask_when_blocked", deliveryChannels: ["task-center"] },
    executionLimits: { wallClockMs: 10_000, stallTimeoutMs, attemptLimit: 2 },
    pinned: { adapterVersion: "document-v1", skillHash: "sha256:skill", toolSchemaVersion: "1", initialModelConfigFingerprints: [] },
  };
}

function plan() {
  return [{
    unitId: "unit-1",
    primaryCoverage: ["page:1"],
    dependencies: [],
    contextRefs: [],
    requiredCapabilities: ["text"],
    outputRole: "section",
    fallbackPolicy: "preserve-source",
    planRevision: 1,
  }];
}

function result(unitPlan, attemptId) {
  return {
    unitId: unitPlan.unitId,
    attemptId,
    proposedStatus: "completed",
    artifactRefs: ["artifact:unit-1"],
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
  const root = await mkdtemp(join(tmpdir(), "visionox-stall-supervision-"));
  try {
    return await fn(createComplexTaskStore(root, options));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function runningTask(store, now = 100, stallTimeoutMs = 500) {
  const task = await store.create({ contract: contract(id(), stallTimeoutMs), unitPlans: plan(), now });
  const lease = await store.acquireLease(task.id, { expectedRevision: task.revision, owner: "worker-test", ttlMs: 10_000, now });
  assert.equal(lease.ok, true);
  const started = await store.transition(task.id, {
    expectedRevision: lease.task.revision,
    lifecycle: "running",
    leaseId: lease.leaseId,
    epoch: lease.epoch,
    owner: "worker-test",
    now,
  });
  assert.equal(started.applied, true);
  return started.task;
}

test("recordProgress persists verifiable evidence and fences stale leases", async () => {
  await withStore(async (store) => {
    const task = await runningTask(store);
    const saved = await store.recordProgress(task.id, {
      expectedRevision: task.revision,
      leaseId: task.lease.leaseId,
      epoch: task.lease.epoch,
      owner: task.lease.owner,
      now: 200,
      evidence: { kind: "model-output", unitId: "unit-1", attemptId: "attempt-1", coverage: ["page:1"] },
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.task.progress.sequence, 2);
    assert.equal(saved.task.progress.lastProgressAt, "1970-01-01T00:00:00.200Z");
    assert.equal(saved.task.progress.evidence.kind, "model-output");
    assert.ok((await store.readEvents(task.id)).some((event) => event.type === "progress-recorded"));

    const stale = await store.recordProgress(task.id, {
      expectedRevision: saved.task.revision,
      leaseId: "stale-lease",
      epoch: task.lease.epoch,
      owner: task.lease.owner,
      now: 201,
      evidence: { kind: "model-output", unitId: "unit-1" },
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.reason, "stale-lease");
  });
});

test("supervisor recovers a live lease that has stopped making progress", async () => {
  await withStore(async (store) => {
    const task = await runningTask(store, 100, 500);
    const report = await createComplexTaskSupervisor({ store }).reconcile({ now: 700 });
    assert.deepEqual(report.stalled, [task.id]);
    assert.deepEqual(report.requeued, [task.id]);
    const restored = await store.read(task.id);
    assert.equal(restored.lifecycle, "queued");
    assert.equal(restored.lease, null);
    assert.equal(restored.recovery.kind, "stalled");
  });
});

test("fresh progress prevents supervisor from reclaiming a long model call", async () => {
  await withStore(async (store) => {
    const task = await runningTask(store, 100, 500);
    const progress = await store.recordProgress(task.id, {
      expectedRevision: task.revision,
      leaseId: task.lease.leaseId,
      epoch: task.lease.epoch,
      owner: task.lease.owner,
      now: 650,
      evidence: { kind: "model-stream", unitId: "unit-1", attemptId: "attempt-1", message: "仍在生成" },
    });
    assert.equal(progress.ok, true);
    const report = await createComplexTaskSupervisor({ store }).reconcile({ now: 900 });
    assert.deepEqual(report.stalled, []);
    assert.deepEqual(report.active, [task.id]);
    assert.equal((await store.read(task.id)).lifecycle, "running");
  });
});

test("worker exposes reportProgress and treats progress persistence errors as non-fatal", async () => {
  await withStore(async (store) => {
    const task = await store.create({ contract: contract(id()), unitPlans: plan() });
    const original = store.recordProgress;
    store.recordProgress = async (...args) => {
      if (args[1]?.evidence?.kind === "model-stream") throw new Error("progress storage unavailable");
      return original(...args);
    };
    let callbackResult;
    const worker = createDurableAgentWorker({
      store,
      owner: "worker-progress-test",
      maxAttempts: 1,
      executeUnit: async ({ unitPlan, attemptId, reportProgress }) => {
        callbackResult = await reportProgress({ kind: "model-stream", unitId: unitPlan.unitId, attemptId, message: "partial output" });
        return result(unitPlan, attemptId);
      },
    });
    const finished = await worker.runOne(task.id);
    assert.equal(finished.status, "unit_completed");
    assert.equal(callbackResult.ok, false);
    assert.equal(callbackResult.reason, "progress-record-failed");
  });
});
