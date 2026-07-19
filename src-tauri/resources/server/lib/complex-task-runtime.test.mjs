import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import { atomicWriteFile } from "./atomic-file.mjs";
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
  const incompleteCompleted = validateUnitResult({
    ...validUnitResult("unit-1", []),
    artifactRefs: [],
    missingSourceRanges: ["page:1"],
  }, { unitPlan: validUnitPlans()[0] });
  assert.equal(incompleteCompleted.ok, false);
  assert.ok(incompleteCompleted.errors.some((error) => /complete primary coverage/i.test(error)));

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

test("a fresh lease may enter assembly without a fake running phase", async () => {
  await withStore({}, async (store) => {
    const task = await createTask(store);
    const lease = await store.acquireLease(task.id, {
      expectedRevision: task.revision,
      owner: "assembler-a",
      ttlMs: 1_000,
      now: 1_000,
    });
    assert.equal(lease.ok, true);
    const assembling = await store.transition(task.id, {
      expectedRevision: lease.task.revision,
      lifecycle: "assembling",
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      owner: "assembler-a",
      now: 1_001,
    });
    assert.equal(assembling.applied, true);
    assert.equal(assembling.task.lifecycle, "assembling");
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
    assert.deepEqual(saved.task.coverageLedger["page:1"], {
      state: "completed",
      primaryUnitId: "unit-1",
      artifactRefs: ["artifact:unit-1"],
    });
    assert.equal(saved.task.coverageLedger["page:2"].state, "pending");

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

    const unknown = await store.checkpointUnit(task.id, validUnitResult("unit-unknown", ["page:1"]), {
      expectedRevision: saved.task.revision,
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      now: 23,
    });
    assert.equal(unknown.applied, false);
    assert.equal(unknown.reason, "invalid-unit-result");

    const restarted = createComplexTaskStore(root);
    assert.equal((await restarted.read(task.id)).unitResults["unit-1"].attemptId, "attempt-1");
    assert.ok((await restarted.readEvents(task.id)).some((event) => event.type === "unit-checkpoint"));
  });
});

test("a damaged canonical manifest is recovered from the newest bounded snapshot", async () => {
  await withStore({}, async (store, root) => {
    const task = await createTask(store);
    const manifestPath = join(root, encodeURIComponent(task.id), "manifest.json");
    await writeFile(manifestPath, "{broken", "utf8");
    const restarted = createComplexTaskStore(root);
    const restored = await restarted.read(task.id);
    assert.equal(restored.id, task.id);
    assert.equal(restored.revision, task.revision);
    assert.equal(restored.lifecycle, "queued");
  });
});

test("manifest fallback is observable when canonical persistence degrades", async () => {
  let failManifest = false;
  const issues = [];
  await withStore({
    atomicWrite: async (path, content, encoding) => {
      if (failManifest && path.endsWith("manifest.json")) {
        failManifest = false;
        throw new Error("manifest replacement denied");
      }
      return atomicWriteFile(path, content, encoding);
    },
    onManifestFallback: (...args) => issues.push(args),
  }, async (store) => {
    const task = await createTask(store);
    failManifest = true;
    const paused = await store.transition(task.id, { expectedRevision: task.revision, lifecycle: "paused" });
    assert.equal(paused.applied, true);
    assert.equal(issues.length, 1);
    assert.equal(issues[0][1], task.id);
    assert.match(String(issues[0][0]?.message), /manifest replacement denied/);
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

test("supervisor keeps active leases, surfaces attention states, and isolates one recovery error", async () => {
  await withStore({}, async (store) => {
    const active = await startTask(store, { now: 100 });
    const waiting = await createTask(store, validContract({ goal: "Needs an answer" }));
    const waitingState = await store.transition(waiting.id, { expectedRevision: waiting.revision, lifecycle: "waiting_user", userInputRequest: { requestId: "r", question: "?" }, now: 101 });
    assert.equal(waitingState.applied, true);
    const blocked = await createTask(store, validContract({ goal: "Blocked by provider" }));
    const blockedState = await store.transition(blocked.id, { expectedRevision: blocked.revision, lifecycle: "blocked", now: 102 });
    assert.equal(blockedState.applied, true);
    const report = await createComplexTaskSupervisor({ store }).reconcile({ now: 200 });
    assert.deepEqual(report.active, [active.task.id]);
    assert.ok(report.needsAttention.includes(waiting.id));
    assert.ok(report.needsAttention.includes(blocked.id));
  });

  const issues = [];
  const failingSupervisor = createComplexTaskSupervisor({
    store: {
      async list() { return [{ id: "task:00000000-0000-4000-8000-000000000000", lifecycle: "running", revision: 1, epoch: 1, lease: null, outbox: [] }]; },
      async recoverExpiredLease() { throw new Error("simulated recovery failure"); },
    },
    onIssue(issue) { issues.push(issue); },
  });
  const isolated = await failingSupervisor.reconcile({ now: 200 });
  assert.equal(isolated.issues.length, 1);
  assert.match(isolated.issues[0].message, /simulated recovery failure/);
  assert.equal(issues.length, 1);
});

test("attention transitions persist one Outbox delivery and release the execution lease", async () => {
  await withStore({}, async (store) => {
    for (const lifecycle of ["waiting_user", "blocked"]) {
      const task = await createTask(store, validContract({ goal: `Attention ${lifecycle}` }));
      const lease = await store.acquireLease(task.id, { expectedRevision: task.revision, owner: "attention-test", now: 100 });
      assert.equal(lease.ok, true);
      const moved = await store.transition(task.id, {
        expectedRevision: lease.task.revision,
        lifecycle,
        leaseId: lease.leaseId,
        epoch: lease.epoch,
        owner: "attention-test",
        quality: lifecycle === "waiting_user" ? "needs_review" : "failed",
        blockingReason: { code: "TEST_BLOCK", message: "需要用户处理" },
        userInputRequest: lifecycle === "waiting_user" ? { requestId: "attention-1", question: "请选择" } : null,
        now: 101,
      });
      assert.equal(moved.applied, true);
      assert.equal(moved.task.lease, null);
      assert.equal(moved.task.outbox.length, 1);
      assert.equal(moved.task.outbox[0].kind, "task-attention");
      assert.equal(moved.task.outbox[0].payload.lifecycle, lifecycle);
      assert.deepEqual(moved.task.outbox[0].pendingConsumers, ["task-center", "conversation"]);
      const duplicate = await store.transition(task.id, {
        expectedRevision: lease.task.revision,
        lifecycle,
        leaseId: lease.leaseId,
        epoch: lease.epoch,
        owner: "attention-test",
        now: 102,
      });
      assert.equal(duplicate.applied, false);
      assert.equal((await store.read(task.id)).outbox.length, 1);
      const restarted = createComplexTaskStore(store.root);
      const pending = await restarted.listPendingOutbox({ consumer: "task-center" });
      assert.equal(pending.filter((entry) => entry.taskId === task.id).length, 1);
      const ack = await restarted.ackOutbox(task.id, pending.find((entry) => entry.taskId === task.id).deliveryId, {
        expectedRevision: moved.task.revision,
        consumer: "task-center",
      });
      assert.equal(ack.applied, true);
      assert.equal((await restarted.listPendingOutbox({ consumer: "task-center" })).some((entry) => entry.taskId === task.id), false);
    }
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
    assert.equal(completed.task.needsAttention, true);
    assert.equal(completed.task.outbox.at(-1).kind, "task-outcome");

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

test("user control actions are CAS/epoch fenced and preserve an input resolution", async () => {
  await withStore({}, async (store) => {
    const { task, lease } = await startTask(store, { now: 10 });
    const waiting = await store.transition(task.id, {
      expectedRevision: task.revision,
      lifecycle: "waiting_user",
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      userInputRequest: { requestId: "request-1", question: "Choose a source", choices: ["a", "b"] },
      now: 20,
    });
    assert.equal(waiting.applied, true);

    const stale = await store.applyUserControl(task.id, {
      action: "resolve_user_input",
      expectedRevision: waiting.task.revision,
      expectedEpoch: lease.epoch + 1,
      payload: { requestId: "request-1", resolution: { choiceId: "a" } },
      now: 21,
    });
    assert.equal(stale.applied, false);
    assert.equal(stale.reason, "epoch-mismatch");

    const resolved = await store.applyUserControl(task.id, {
      action: "resolve_user_input",
      expectedRevision: waiting.task.revision,
      expectedEpoch: lease.epoch,
      payload: { requestId: "request-1", resolution: { choiceId: "a" } },
      now: 22,
    });
    assert.equal(resolved.applied, true);
    assert.equal(resolved.task.lifecycle, "queued");
    assert.deepEqual(resolved.task.userInputResolution.answer, { choiceId: "a" });

    const retargeted = await store.applyUserControl(task.id, {
      action: "retarget_output",
      expectedRevision: resolved.task.revision,
      payload: { requestedPath: "result-v2.md", conflictPolicy: "replace" },
      now: 23,
    });
    assert.equal(retargeted.applied, true);
    assert.equal(retargeted.task.contract.output.requestedPath, "result-v2.md");
    assert.equal(retargeted.task.contractRevision, 2);

    const paused = await store.applyUserControl(task.id, {
      action: "pause",
      expectedRevision: retargeted.task.revision,
      expectedEpoch: lease.epoch,
      now: 24,
    });
    assert.equal(paused.applied, true);
    assert.equal(paused.task.lifecycle, "paused");
    const retried = await store.applyUserControl(task.id, {
      action: "retry",
      expectedRevision: paused.task.revision,
      now: 25,
    });
    assert.equal(retried.applied, true);
    assert.equal(retried.task.lifecycle, "queued");
  });
});

test("cancel creates a durable terminal outcome and deletion requires every Outbox consumer ack", async () => {
  await withStore({}, async (store) => {
    const { task, lease } = await startTask(store, { now: Date.now() });
    const cancelled = await store.applyUserControl(task.id, {
      action: "cancel",
      expectedRevision: task.revision,
      expectedEpoch: lease.epoch,
      payload: { summary: "Stopped by the user" },
    });
    assert.equal(cancelled.applied, true);
    assert.equal(cancelled.task.lifecycle, "terminal");
    assert.equal(cancelled.task.outcome.outcome, "cancelled");
    const delivery = (await store.listPendingOutbox())[0];
    const blockedDelete = await store.removeIfUnreferenced(task.id, { expectedRevision: cancelled.task.revision });
    assert.equal(blockedDelete.applied, false);
    assert.equal(blockedDelete.reason, "outbox-pending");
    let revision = cancelled.task.revision;
    for (const consumer of delivery.pendingConsumers) {
      const ack = await store.ackOutbox(task.id, delivery.deliveryId, { expectedRevision: revision, consumer });
      revision = ack.task.revision;
    }
    const deleted = await store.removeIfUnreferenced(task.id, { expectedRevision: revision });
    assert.equal(deleted.applied, true);
    assert.equal(deleted.deleted, true);
    assert.equal(await store.read(task.id).catch(() => null), null);
  });
});

test("a resumable terminal outcome can be retried without deleting its previous delivery record", async () => {
  await withStore({}, async (store) => {
    const { task, lease } = await startTask(store, { now: 10 });
    const assembling = await store.transition(task.id, { expectedRevision: task.revision, lifecycle: "assembling", leaseId: lease.leaseId, epoch: lease.epoch, now: 20 });
    const done = await store.complete(task.id, validOutcome(task.id, { resumable: true }), { expectedRevision: assembling.task.revision, leaseId: lease.leaseId, epoch: lease.epoch, now: 30 });
    const retried = await store.applyUserControl(task.id, { action: "retry", expectedRevision: done.task.revision, expectedEpoch: lease.epoch, now: 40 });
    assert.equal(retried.applied, true);
    assert.equal(retried.task.lifecycle, "queued");
    assert.equal(retried.task.epoch, lease.epoch + 1);
    assert.equal(retried.task.outcome, null);
    assert.equal((await store.listPendingOutbox()).length, 1);
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
