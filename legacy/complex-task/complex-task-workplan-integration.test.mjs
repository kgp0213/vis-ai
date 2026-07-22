import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createComplexTaskStore } from "./complex-task-store.mjs";
import { createDurableAgentWorker } from "./complex-task-worker.mjs";

function contract(id) {
  return {
    schemaVersion: 1,
    taskId: id,
    taskType: "generic.analysis",
    goal: "分析两部分来源并形成结果",
    workspace: "D:/workspace",
    sources: [{ sourceId: "source-1", uri: "D:/workspace/source.md", kind: "markdown", fingerprint: "sha256:source", required: true }],
    output: { format: "markdown", requestedPath: "D:/workspace/result.md", conflictPolicy: "ask" },
    completion: { requiredCoverage: ["part:1", "part:2"], requiredArtifacts: ["final-markdown"] },
    quality: { requestedFidelity: "complete", semanticReviewMode: "optional", maxRepairPasses: 1 },
    permissions: { readSources: true, writeOutput: true },
    interactionPolicy: { mode: "ask_when_blocked", deliveryChannels: ["task-center"] },
    executionLimits: { wallClockMs: 30_000, stallTimeoutMs: 5_000, attemptLimit: 2 },
    pinned: {
      adapterVersion: "generic-v1",
      skillHash: "sha256:skill",
      toolSchemaVersion: "1",
      initialModelConfigFingerprints: ["model:one"],
    },
  };
}

function workNode(nodeId, coverage, dependencies = []) {
  return {
    nodeId,
    goal: `完成 ${coverage}`,
    acceptanceCriteria: [`${coverage} 已形成可验证产物`],
    permissions: { readSources: true, writeOutput: true },
    requiredCapabilities: ["text"],
    dependencies,
    termination: { maxAttempts: 2, wallClockMs: 30_000, stallTimeoutMs: 5_000 },
    primaryCoverage: [coverage],
    contextRefs: [],
    outputRole: "markdown-section",
    fallbackPolicy: "preserve-source",
    status: "pending",
  };
}

function workPlan(id) {
  return {
    schemaVersion: 1,
    planId: `plan:${id.slice(5)}`,
    planRevision: 1,
    goal: "分析两部分来源并形成结果",
    requiredCoverage: ["part:1", "part:2"],
    permissions: { readSources: true, writeOutput: true },
    termination: { maxReplans: 2 },
    nodes: [
      workNode("analyze-part-1", "part:1"),
      workNode("analyze-part-2", "part:2", ["analyze-part-1"]),
    ],
  };
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

async function withStore(run) {
  const root = await mkdtemp(join(tmpdir(), "visionox-workplan-integration-"));
  try {
    return await run(createComplexTaskStore(root), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("Store persists an authoritative WorkPlan and derives executable UnitPlans", async () => {
  await withStore(async (store, root) => {
    const id = `task:${randomUUID()}`;
    const created = await store.create({ contract: contract(id), workPlan: workPlan(id) });

    assert.equal(created.workPlan.planRevision, 1);
    assert.deepEqual(created.workPlan.topologicalOrder, ["analyze-part-1", "analyze-part-2"]);
    assert.deepEqual(created.unitPlans.map((unit) => unit.unitId), ["analyze-part-1", "analyze-part-2"]);
    assert.deepEqual(created.unitPlans[1].dependencies, ["analyze-part-1"]);

    const restarted = createComplexTaskStore(root);
    assert.equal((await restarted.read(id)).workPlan.revisionId, created.workPlan.revisionId);
  });
});

test("Worker executes the persisted WorkPlan graph and checkpoints node progress", async () => {
  await withStore(async (store) => {
    const id = `task:${randomUUID()}`;
    const created = await store.create({ contract: contract(id), workPlan: workPlan(id) });
    const executed = [];
    const worker = createDurableAgentWorker({
      store,
      executeUnit: async ({ unitPlan, attemptId }) => {
        executed.push(unitPlan.unitId);
        return unitResult(unitPlan, attemptId);
      },
    });

    const first = await worker.runOne(created.id);
    assert.equal(first.status, "unit_completed");
    assert.deepEqual(executed, ["analyze-part-1"]);
    const afterFirst = await store.read(created.id);
    assert.equal(afterFirst.workPlan.nodeResults["analyze-part-1"].proposedStatus, "completed");
    assert.equal(afterFirst.workPlan.nodes.find((node) => node.nodeId === "analyze-part-1").status, "completed");
    assert.equal(afterFirst.workPlan.revisionId, created.workPlan.revisionId);

    const second = await worker.runOne(created.id);
    assert.equal(second.status, "unit_completed");
    assert.deepEqual(executed, ["analyze-part-1", "analyze-part-2"]);
  });
});

test("bounded Store replan preserves completed nodes and replaces only unfinished work", async () => {
  await withStore(async (store) => {
    const id = `task:${randomUUID()}`;
    const created = await store.create({ contract: contract(id), workPlan: workPlan(id) });
    const executed = [];
    const worker = createDurableAgentWorker({
      store,
      executeUnit: async ({ unitPlan, attemptId }) => {
        executed.push(unitPlan.unitId);
        return unitResult(unitPlan, attemptId);
      },
    });

    await worker.runOne(created.id);
    const checkpointed = await store.read(created.id);
    const replanned = await store.replan(created.id, {
      replaceNodeIds: ["analyze-part-2"],
      reason: "原节点需要改用新的处理策略",
      nodes: [workNode("analyze-part-2-v2", "part:2", ["analyze-part-1"])],
    }, { expectedRevision: checkpointed.revision, expectedEpoch: checkpointed.epoch });

    assert.equal(replanned.applied, true);
    assert.equal(replanned.task.workPlan.planRevision, 2);
    assert.equal(replanned.task.workPlan.parentRevision, checkpointed.workPlan.revisionId);
    assert.notEqual(replanned.task.workPlan.revisionId, checkpointed.workPlan.revisionId);
    assert.deepEqual(replanned.task.unitPlans.map((unit) => unit.unitId), ["analyze-part-1", "analyze-part-2-v2"]);
    assert.equal(replanned.task.unitResults["analyze-part-1"].proposedStatus, "completed");
    assert.equal(replanned.task.unitResults["analyze-part-2"], undefined);

    await worker.runOne(created.id);
    assert.deepEqual(executed, ["analyze-part-1", "analyze-part-2-v2"]);
  });
});

test("replan gives a replacement with the same unit id a fresh attempt-budget generation", async () => {
  await withStore(async (store) => {
    const id = `task:${randomUUID()}`;
    const created = await store.create({ contract: contract(id), workPlan: workPlan(id) });
    let calls = 0;
    const worker = createDurableAgentWorker({
      store,
      maxAttempts: 3,
      executeUnit: async ({ unitPlan, attemptId }) => {
        calls += 1;
        return calls <= 2 ? "malformed model output" : unitResult(unitPlan, attemptId);
      },
    });

    const exhausted = await worker.runOne(created.id);
    assert.equal(exhausted.status, "blocked");
    assert.equal(calls, 2);
    const blocked = await store.read(created.id);
    assert.equal(blocked.attemptBudget.units["analyze-part-1"].modelAttempts, 2);

    const replanned = await store.replan(created.id, {
      replaceNodeIds: ["analyze-part-1"],
      reason: "retry the unfinished node with a revised plan",
      nodes: [workNode("analyze-part-1", "part:1")],
    }, { expectedRevision: blocked.revision, expectedEpoch: blocked.epoch });

    assert.equal(replanned.applied, true);
    assert.equal(replanned.task.attemptBudget.activeGeneration, replanned.task.workPlan.revisionId);
    assert.deepEqual(replanned.task.attemptBudget.units, {});
    assert.equal(replanned.task.attemptBudget.archivedGenerations.at(-1).generationId, blocked.workPlan.revisionId);
    assert.equal(replanned.task.attemptBudget.archivedGenerations.at(-1).units["analyze-part-1"].modelAttempts, 2);

    const resumed = await worker.runOne(created.id);
    assert.equal(resumed.status, "unit_completed");
    assert.equal(calls, 3);
    assert.equal((await store.read(created.id)).attemptBudget.units["analyze-part-1"].modelAttempts, 1);
  });
});

test("Store rejects a WorkPlan that exceeds the TaskContract permission boundary", async () => {
  await withStore(async (store) => {
    const id = `task:${randomUUID()}`;
    const unsafe = workPlan(id);
    unsafe.nodes[0].permissions = { readSources: true, writeOutput: true, sendExternalMessage: true };
    await assert.rejects(
      store.create({ contract: contract(id), workPlan: unsafe }),
      (error) => error?.code === "INVALID_WORK_PLAN" && /permission boundary|outside/i.test(error.message),
    );
  });
});
