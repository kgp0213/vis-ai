import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  assertTaskContract,
  validateArtifactManifest,
  validateOutcomeEnvelope,
  validateTaskContract,
  validateUnitPlanSet,
  validateUnitResult,
} from "./complex-task-contracts.mjs";
import { createComplexTaskStore } from "./complex-task-store.mjs";
import { createComplexTaskSupervisor } from "./complex-task-supervisor.mjs";

function nextTaskId() {
  return `task:${randomUUID()}`;
}

function validContract(overrides = {}) {
  const base = {
    schemaVersion: 1,
    taskId: nextTaskId(),
    taskType: "document.markdown",
    goal: "Convert every selected source range into a complete Markdown document",
    workspace: "D:/workspace",
    sources: [
      { sourceId: "source-1", uri: "manual.pdf", kind: "pdf", fingerprint: "sha256:source", required: true },
    ],
    output: { format: "markdown", requestedPath: "result.md", conflictPolicy: "ask" },
    completion: { requiredCoverage: ["page:1", "page:2"], requiredArtifacts: ["final-markdown"] },
    quality: { requestedFidelity: "complete", semanticReviewMode: "llm", maxRepairPasses: 2 },
    permissions: { readSources: true, writeOutput: true },
    interactionPolicy: { mode: "ask_when_blocked", deliveryChannels: ["task-center", "conversation"] },
    executionLimits: { wallClockMs: 14_400_000, stallTimeoutMs: 600_000, attemptLimit: 8 },
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
    output: { ...base.output, ...(overrides.output ?? {}) },
    completion: { ...base.completion, ...(overrides.completion ?? {}) },
    quality: { ...base.quality, ...(overrides.quality ?? {}) },
    executionLimits: { ...base.executionLimits, ...(overrides.executionLimits ?? {}) },
    pinned: { ...base.pinned, ...(overrides.pinned ?? {}) },
  };
}

function validUnitPlans() {
  return [
    {
      unitId: "unit-1",
      primaryCoverage: ["page:1"],
      dependencies: [],
      contextRefs: [],
      requiredCapabilities: ["text"],
      outputRole: "section",
      fallbackPolicy: "preserve-source",
      planRevision: 1,
    },
    {
      unitId: "unit-2",
      primaryCoverage: ["page:2"],
      dependencies: ["unit-1"],
      contextRefs: [{ sourceId: "source-1", range: "page:1", role: "context-only" }],
      requiredCapabilities: ["text"],
      outputRole: "section",
      fallbackPolicy: "preserve-source",
      planRevision: 1,
    },
  ];
}

function validUnitResult(unitId = "unit-1", coverage = ["page:1"]) {
  return {
    unitId,
    attemptId: "attempt-1",
    proposedStatus: "completed",
    artifactRefs: [`artifact:${unitId}`],
    proposedPrimaryCoverage: coverage,
    contextRefsUsed: [],
    missingSourceRanges: [],
    evidenceRefs: ["source-1"],
    warnings: [],
    confidence: 0.8,
    nextActionProposal: "continue",
  };
}

function validOutcome(taskId, overrides = {}) {
  return {
    schemaVersion: 1,
    taskId,
    outcome: "delivered_with_warnings",
    summary: "The document is available and one table needs review.",
    artifactRefs: ["artifact:final"],
    coverage: { required: 2, completed: 2, unresolved: [] },
    warnings: [{ code: "QUALITY_REVIEW", message: "Review one table." }],
    blockingReason: null,
    userAction: { kind: "review", label: "Review result" },
    resumable: true,
    ...overrides,
  };
}

async function withStore(options, fn) {
  const root = await mkdtemp(join(tmpdir(), "visionox-complex-task-"));
  try {
    return await fn(createComplexTaskStore(root, options), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function createTask(store, contract = validContract()) {
  return store.create({ contract, unitPlans: validUnitPlans() });
}

async function startTask(store, { now = 1_000 } = {}) {
  const task = await createTask(store);
  const lease = await store.acquireLease(task.id, {
    expectedRevision: task.revision,
    owner: "worker-a",
    ttlMs: 1_000,
    now,
  });
  assert.equal(lease.ok, true);
  const started = await store.transition(task.id, {
    expectedRevision: lease.task.revision,
    lifecycle: "running",
    leaseId: lease.leaseId,
    epoch: lease.epoch,
    now,
  });
  assert.equal(started.applied, true);
  return { task: started.task, lease };
}

test("TaskContract v1 validates host-owned sources, completion, limits, and pins", () => {
  const contract = assertTaskContract(validContract());
  assert.equal(contract.schemaVersion, 1);
  assert.match(contract.taskId, /^task:/);
  assert.deepEqual(contract.completion.requiredCoverage, ["page:1", "page:2"]);

  const duplicateSources = validateTaskContract(validContract({
    sources: [
      { sourceId: "same", uri: "a.pdf", kind: "pdf", fingerprint: "a", required: true },
      { sourceId: "same", uri: "b.pdf", kind: "pdf", fingerprint: "b", required: true },
    ],
  }));
  assert.equal(duplicateSources.ok, false);
  assert.ok(duplicateSources.errors.some((error) => /unique/i.test(error)));
  assert.throws(() => assertTaskContract({}), (error) => {
    assert.equal(error.code, "INVALID_TASK_CONTRACT");
    return /goal/i.test(error.message);
  });
});

test("UnitPlan, UnitResult, ArtifactManifest, and OutcomeEnvelope reject authority leaks", () => {
  assert.equal(validateUnitPlanSet(validUnitPlans(), { requiredCoverage: ["page:1", "page:2"] }).ok, true);
  const cyclic = validUnitPlans();
  cyclic[0].dependencies = ["unit-2"];
  const invalidPlan = validateUnitPlanSet(cyclic, { requiredCoverage: ["page:1", "page:2"] });
  assert.equal(invalidPlan.ok, false);
  assert.ok(invalidPlan.errors.some((error) => /cycle/i.test(error)));

  assert.equal(validateUnitResult(validUnitResult(), { unitPlan: validUnitPlans()[0] }).ok, true);
  const escapedCoverage = validateUnitResult(validUnitResult("unit-1", ["page:99"]), { unitPlan: validUnitPlans()[0] });
  assert.equal(escapedCoverage.ok, false);
  assert.ok(escapedCoverage.errors.some((error) => /authorized primary coverage/i.test(error)));

  const artifact = validateArtifactManifest({
    schemaVersion: 1,
    artifactId: "artifact:unit-1",
    revision: 1,
    mediaType: "text/markdown",
    path: "artifacts/unit-1.md",
    sha256: "a".repeat(64),
    primaryCoverage: ["page:1"],
    contextRefs: [],
    producer: {
      adapterVersion: "document-v1",
      skillHash: "sha256:skill",
      modelConfigFingerprint: "model-config-1",
      toolSchemaVersion: "1",
    },
    createdAt: new Date().toISOString(),
  });
  assert.equal(artifact.ok, true);

  const taskId = nextTaskId();
  assert.equal(validateOutcomeEnvelope(validOutcome(taskId)).ok, true);
  const invalidOutcome = validateOutcomeEnvelope(validOutcome(taskId, { outcome: "running" }));
  assert.equal(invalidOutcome.ok, false);
  assert.ok(invalidOutcome.errors.some((error) => /terminal outcome/i.test(error)));
});

test("lifecycle changes use revision CAS and cannot bypass terminal outcome commit", async () => {
  await withStore({}, async (store) => {
    const task = await createTask(store);
    assert.match(task.id, /^task:[0-9a-f-]{36}$/i);
    assert.equal(task.lifecycle, "queued");
    assert.equal(task.outcome, null);
    assert.equal(task.quality, "unknown");

    const paused = await store.transition(task.id, {
      expectedRevision: 0,
      lifecycle: "paused",
    });
    assert.equal(paused.applied, true);
    assert.equal(paused.task.lifecycle, "paused");

    const stale = await store.transition(task.id, {
      expectedRevision: 0,
      lifecycle: "queued",
    });
    assert.equal(stale.applied, false);
    assert.equal(stale.reason, "revision-mismatch");

    const bypass = await store.transition(task.id, {
      expectedRevision: paused.task.revision,
      lifecycle: "terminal",
    });
    assert.equal(bypass.applied, false);
    assert.equal(bypass.reason, "outcome-required");
  });
});

test("lease epochs fence stale workers and heartbeat extends only the active lease", async () => {
  await withStore({}, async (store) => {
    const { task, lease } = await startTask(store, { now: 1_000 });
    assert.equal(task.lifecycle, "running");
    assert.equal(lease.epoch, 1);

    const heartbeat = await store.heartbeat(task.id, {
      expectedRevision: task.revision,
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      owner: "worker-a",
      ttlMs: 500,
      now: 1_100,
    });
    assert.equal(heartbeat.ok, true);
    assert.equal(heartbeat.lease.expiresAt, 1_600);

    const blocked = await store.acquireLease(task.id, {
      expectedRevision: heartbeat.task.revision,
      owner: "worker-b",
      now: 1_200,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, "lease-held");

    const supervisor = createComplexTaskSupervisor({ store });
    assert.deepEqual((await supervisor.reconcile({ now: 1_700 })).requeued, [task.id]);
    const queued = await store.read(task.id);
    const second = await store.acquireLease(task.id, {
      expectedRevision: queued.revision,
      owner: "worker-b",
      ttlMs: 500,
      now: 1_701,
    });
    assert.equal(second.ok, true);
    assert.equal(second.epoch, 2);

    const staleHeartbeat = await store.heartbeat(task.id, {
      expectedRevision: second.task.revision,
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      owner: "worker-a",
      now: 1_702,
    });
    assert.equal(staleHeartbeat.ok, false);
    assert.equal(staleHeartbeat.reason, "stale-lease");
  });
});

test("unit checkpoints require revision, current lease, and authorized coverage", async () => {
  await withStore({}, async (store, root) => {
    const { task, lease } = await startTask(store, { now: 10 });
    const saved = await store.checkpointUnit(task.id, validUnitResult(), {
      expectedRevision: task.revision,
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      now: 20,
    });
    assert.equal(saved.applied, true);
    assert.equal(saved.task.unitResults["unit-1"].proposedStatus, "completed");

    const stale = await store.checkpointUnit(task.id, validUnitResult("unit-2", ["page:2"]), {
      expectedRevision: saved.task.revision,
      leaseId: "wrong",
      epoch: lease.epoch,
      now: 21,
    });
    assert.equal(stale.applied, false);
    assert.equal(stale.reason, "stale-lease");

    const escaped = await store.checkpointUnit(task.id, validUnitResult("unit-2", ["page:99"]), {
      expectedRevision: saved.task.revision,
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      now: 22,
    });
    assert.equal(escaped.applied, false);
    assert.equal(escaped.reason, "invalid-unit-result");

    const restarted = createComplexTaskStore(root);
    assert.equal((await restarted.read(task.id)).unitResults["unit-1"].attemptId, "attempt-1");
    assert.ok((await restarted.readEvents(task.id)).some((event) => event.type === "unit-checkpoint"));
  });
});

test("supervisor requeues an expired worker lease and reports pending deliveries", async () => {
  await withStore({}, async (store) => {
    const { task, lease } = await startTask(store, { now: 100 });
    const report = await createComplexTaskSupervisor({ store }).reconcile({ now: 2_000 });
    assert.deepEqual(report.requeued, [task.id]);
    const restored = await store.read(task.id);
    assert.equal(restored.lifecycle, "queued");
    assert.equal(restored.lease, null);
    assert.equal(restored.epoch, lease.epoch);
    assert.ok((await store.readEvents(task.id)).some((event) => event.type === "lease-recovered"));
  });
});

test("terminal outcome and per-consumer Outbox acknowledgements survive restart", async () => {
  await withStore({}, async (store, root) => {
    const { task, lease } = await startTask(store, { now: 10 });
    const assembling = await store.transition(task.id, {
      expectedRevision: task.revision,
      lifecycle: "assembling",
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      now: 20,
    });
    const completed = await store.complete(task.id, validOutcome(task.id), {
      expectedRevision: assembling.task.revision,
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      quality: "needs_review",
      now: 30,
    });
    assert.equal(completed.applied, true);
    assert.equal(completed.task.lifecycle, "terminal");
    assert.equal(completed.task.outcome.outcome, "delivered_with_warnings");
    assert.equal(completed.task.quality, "needs_review");

    const duplicate = await store.complete(task.id, validOutcome(task.id), {
      expectedRevision: assembling.task.revision,
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      now: 31,
    });
    assert.equal(duplicate.applied, false);
    assert.equal(duplicate.reason, "already-terminal");

    const restarted = createComplexTaskStore(root);
    const pending = await restarted.listPendingOutbox();
    assert.equal(pending.length, 1);
    assert.deepEqual(pending[0].pendingConsumers, ["task-center", "conversation"]);
    const taskCenterAck = await restarted.ackOutbox(task.id, pending[0].deliveryId, {
      expectedRevision: completed.task.revision,
      consumer: "task-center",
    });
    assert.equal(taskCenterAck.applied, true);
    assert.equal((await restarted.listPendingOutbox({ consumer: "task-center" })).length, 0);
    assert.equal((await restarted.listPendingOutbox({ consumer: "conversation" })).length, 1);
    const conversationAck = await restarted.ackOutbox(task.id, pending[0].deliveryId, {
      expectedRevision: taskCenterAck.task.revision,
      consumer: "conversation",
    });
    assert.equal(conversationAck.applied, true);
    assert.equal((await restarted.listPendingOutbox()).length, 0);
  });
});

test("retention removes only fully acknowledged terminal tasks", async () => {
  await withStore({ retentionMs: 0 }, async (store) => {
    async function finish(contract, acknowledge) {
      const { task, lease } = await startTask(store, { now: Date.now() });
      const assembling = await store.transition(task.id, {
        expectedRevision: task.revision,
        lifecycle: "assembling",
        leaseId: lease.leaseId,
        epoch: lease.epoch,
      });
      const completed = await store.complete(task.id, validOutcome(task.id), {
        expectedRevision: assembling.task.revision,
        leaseId: lease.leaseId,
        epoch: lease.epoch,
      });
      if (!acknowledge) return completed.task;
      const delivery = (await store.listPendingOutbox()).find((entry) => entry.taskId === task.id);
      let revision = completed.task.revision;
      for (const consumer of delivery.pendingConsumers) {
        const ack = await store.ackOutbox(task.id, delivery.deliveryId, { expectedRevision: revision, consumer });
        revision = ack.task.revision;
      }
      return store.read(task.id);
    }

    const delivered = await finish(validContract(), true);
    const undelivered = await finish(validContract({ goal: "Keep pending delivery" }), false);
    const live = await createTask(store, validContract({ goal: "Keep live task" }));
    const result = await store.pruneExpired(Date.now() + 10_000);
    assert.deepEqual(result.deleted, [delivered.id]);
    assert.equal(await store.read(delivered.id).catch(() => null), null);
    assert.equal((await store.read(undelivered.id)).lifecycle, "terminal");
    assert.equal((await store.read(live.id)).lifecycle, "queued");
  });
});

test("event log keeps monotonic valid history when its tail is truncated", async () => {
  await withStore({}, async (store, root) => {
    const task = await createTask(store);
    const eventsPath = join(root, encodeURIComponent(task.id), "events.jsonl");
    await readFile(eventsPath, "utf8");
    await appendFile(eventsPath, "{broken\n", "utf8");
    const events = await store.readEvents(task.id);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "created");
    assert.ok(events.every((event, index) => event.sequence === index + 1));
  });
});
