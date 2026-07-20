import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createComplexTaskStore } from "./complex-task-store.mjs";
import { createComplexTaskSupervisor } from "./complex-task-supervisor.mjs";

function taskId() {
  return `task:${randomUUID()}`;
}

function contract(id) {
  return {
    schemaVersion: 1,
    taskId: id,
    taskType: "document.markdown",
    goal: "read a source",
    workspace: "D:/workspace",
    sources: [{ sourceId: "source-1", uri: "D:/workspace/source.md", kind: "markdown", fingerprint: "sha256:original", required: true }],
    output: { format: "markdown", requestedPath: "result.md", conflictPolicy: "ask" },
    completion: { requiredCoverage: ["unit-1"], requiredArtifacts: ["final"] },
    quality: { requestedFidelity: "complete", semanticReviewMode: "none", maxRepairPasses: 0 },
    permissions: { readSources: true, writeOutput: true },
    interactionPolicy: { mode: "ask_when_blocked", deliveryChannels: ["task-center"] },
    executionLimits: { wallClockMs: 10_000, stallTimeoutMs: 5_000, attemptLimit: 1 },
    pinned: { adapterVersion: "v1", skillHash: "sha256:skill", toolSchemaVersion: "1", initialModelConfigFingerprints: [] },
  };
}

function plans() {
  return [{ unitId: "unit-1", primaryCoverage: ["unit-1"], dependencies: [], contextRefs: [], requiredCapabilities: ["text"], outputRole: "section", fallbackPolicy: "preserve-source", planRevision: 1 }];
}

test("supervisor blocks a queued task when its source fingerprint changed before recovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-source-guard-"));
  try {
    const store = createComplexTaskStore(root);
    const task = await store.create({ contract: contract(taskId()), unitPlans: plans(), now: 100 });
    const supervisor = createComplexTaskSupervisor({
      store,
      verifySources: async () => ({ ok: false, changed: [{ sourceId: "source-1", expected: "sha256:original", actual: "sha256:changed" }] }),
    });
    const report = await supervisor.reconcile({ now: 200 });
    assert.deepEqual(report.sourceChanged, [task.id]);
    const saved = await store.read(task.id);
    assert.equal(saved.lifecycle, "waiting_user");
    assert.equal(saved.blockingReason.code, "SOURCE_CHANGED");
    assert.ok(saved.outbox.some((entry) => entry.kind === "task-attention"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("source verification is skipped only when no verifier is configured", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-source-guard-skip-"));
  try {
    const store = createComplexTaskStore(root);
    const task = await store.create({ contract: contract(taskId()), unitPlans: plans(), now: 100 });
    const report = await createComplexTaskSupervisor({ store }).reconcile({ now: 200 });
    assert.deepEqual(report.sourceChanged, []);
    assert.ok(report.active === undefined || !report.active.includes(task.id));
    assert.equal((await store.read(task.id)).lifecycle, "queued");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("source-changed attention cannot resolve back into the same stale task", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-source-guard-resolution-"));
  try {
    const store = createComplexTaskStore(root);
    const task = await store.create({ contract: contract(taskId()), unitPlans: plans(), now: 100 });
    const supervisor = createComplexTaskSupervisor({
      store,
      verifySources: async () => ({ ok: false, changed: [{ sourceId: "source-1" }] }),
    });
    const report = await supervisor.reconcile({ now: 200 });
    assert.deepEqual(report.sourceChanged, [task.id]);
    const waiting = await store.read(task.id);
    const resolved = await store.applyUserControl(task.id, {
      action: "resolve_user_input",
      expectedRevision: waiting.revision,
      payload: { requestId: waiting.userInputRequest.requestId, choiceId: "restart-new-task" },
      now: 210,
    });
    assert.equal(resolved.applied, true);
    assert.equal(resolved.task.lifecycle, "terminal");
    assert.equal(resolved.task.outcome.outcome, "cancelled");
    assert.match(resolved.task.outcome.summary, /重新创建|来源/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
