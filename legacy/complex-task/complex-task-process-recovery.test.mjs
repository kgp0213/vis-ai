import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createComplexTaskStore } from "./complex-task-store.mjs";
import { createComplexTaskSupervisor } from "./complex-task-supervisor.mjs";
import { createDurableAgentWorker } from "./complex-task-worker.mjs";

function contract(taskId) {
  return {
    schemaVersion: 1,
    taskId,
    taskType: "document.markdown",
    goal: "recover after a process restart",
    workspace: "D:/workspace",
    sources: [{ sourceId: "source-1", uri: "source.md", kind: "markdown", fingerprint: "sha256:source", required: true }],
    output: { format: "markdown", requestedPath: "result.md", conflictPolicy: "ask" },
    completion: { requiredCoverage: ["unit-1", "unit-2"], requiredArtifacts: ["final"] },
    quality: { requestedFidelity: "complete", semanticReviewMode: "none", maxRepairPasses: 0 },
    permissions: { readSources: true, writeOutput: true },
    interactionPolicy: { mode: "ask_when_blocked", deliveryChannels: ["task-center"] },
    executionLimits: { wallClockMs: 60_000, stallTimeoutMs: 30_000, attemptLimit: 1 },
    pinned: { adapterVersion: "v1", skillHash: "sha256:skill", toolSchemaVersion: "1", initialModelConfigFingerprints: [] },
  };
}

function unitPlans() {
  return [
    {
      unitId: "unit-1",
      primaryCoverage: ["unit-1"],
      dependencies: [],
      contextRefs: [],
      requiredCapabilities: ["text"],
      outputRole: "section",
      fallbackPolicy: "preserve-source",
      planRevision: 1,
    },
    {
      unitId: "unit-2",
      primaryCoverage: ["unit-2"],
      dependencies: ["unit-1"],
      contextRefs: [],
      requiredCapabilities: ["text"],
      outputRole: "section",
      fallbackPolicy: "preserve-source",
      planRevision: 1,
    },
  ];
}

function unitResult(unitId) {
  return {
    unitId,
    attemptId: `attempt-${unitId}`,
    proposedStatus: "completed",
    artifactRefs: [`artifact:${unitId}`],
    proposedPrimaryCoverage: [unitId],
    contextRefsUsed: [],
    missingSourceRanges: [],
    evidenceRefs: ["source-1"],
    warnings: [],
    confidence: 0.8,
    nextActionProposal: "continue",
  };
}

test("a fresh process recovers an expired lease and resumes only unresolved units", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-complex-process-recovery-"));
  try {
    const storeModule = new URL("./complex-task-store.mjs", import.meta.url).href;
    const child = `
      const { createComplexTaskStore } = await import(${JSON.stringify(storeModule)});
      const root = ${JSON.stringify(root)};
      const id = "task:11111111-1111-4111-8111-111111111111";
      const contract = ${JSON.stringify(contract("task:11111111-1111-4111-8111-111111111111"))};
      const plans = ${JSON.stringify(unitPlans())};
      const store = createComplexTaskStore(root, { leaseMs: 10 });
      const task = await store.create({ id, contract, unitPlans: plans, now: 100 });
      const lease = await store.acquireLease(id, { expectedRevision: task.revision, owner: "crashed-worker", ttlMs: 10, now: 100 });
      const running = await store.transition(id, { expectedRevision: lease.task.revision, lifecycle: "running", leaseId: lease.leaseId, epoch: lease.epoch, owner: "crashed-worker", now: 101 });
      const checkpoint = await store.checkpointUnit(id, ${JSON.stringify(unitResult("unit-1"))}, { expectedRevision: running.task.revision, leaseId: lease.leaseId, epoch: lease.epoch, owner: "crashed-worker", now: 102 });
      if (!checkpoint.applied) throw new Error("checkpoint was not persisted");
      process.stdout.write(id);
    `;
    const childResult = spawnSync(process.execPath, ["--input-type=module", "--eval", child], { encoding: "utf8", windowsHide: true });
    assert.equal(childResult.status, 0, childResult.stderr || childResult.stdout);
    assert.equal(childResult.stdout, "task:11111111-1111-4111-8111-111111111111");

    const restarted = createComplexTaskStore(root, { leaseMs: 10 });
    const before = await restarted.read(childResult.stdout);
    assert.equal(before.lifecycle, "running");
    assert.ok(before.unitResults["unit-1"]);
    const supervisor = createComplexTaskSupervisor({ store: restarted });
    const recovery = await supervisor.reconcile({ now: 1_000 });
    assert.deepEqual(recovery.requeued, [childResult.stdout]);
    const recovered = await restarted.read(childResult.stdout);
    assert.equal(recovered.lifecycle, "queued");
    assert.ok(recovered.unitResults["unit-1"], "completed checkpoint must survive restart");

    const executed = [];
    const worker = createDurableAgentWorker({
      store: restarted,
      owner: "restarted-worker",
      leaseTtlMs: 1_000,
      heartbeatIntervalMs: 10_000,
      maxAttempts: 1,
      attemptTimeoutMs: 1_000,
      now: () => 2_000,
      executeUnit: async ({ unitPlan }) => {
        executed.push(unitPlan.unitId);
        return unitResult(unitPlan.unitId);
      },
    });
    const resumed = await worker.runOne(childResult.stdout);
    assert.equal(resumed.status, "unit_completed");
    assert.deepEqual(executed, ["unit-2"]);
    const after = await restarted.read(childResult.stdout);
    assert.ok(after.unitResults["unit-1"]);
    assert.ok(after.unitResults["unit-2"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
