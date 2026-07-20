import test from "node:test";
import assert from "node:assert/strict";

import {
  createBackgroundTaskRegistry,
  projectBackgroundTask,
  taskNeedsAttention,
  taskIsActive,
} from "./background-task-registry.mjs";

test("projects generic lifecycle into stable active and attention flags", () => {
  const running = projectBackgroundTask({
    id: "task:run-1",
    taskType: "document",
    lifecycle: "running",
    outcome: null,
    quality: "unknown",
    revision: 4,
    goal: "整理文档",
    progress: { completedUnits: 2, totalUnits: 5 },
    allowedActions: ["pause", "cancel"],
  });
  assert.equal(running.id, "task:run-1");
  assert.equal(running.active, true);
  assert.equal(running.needsAttention, false);
  assert.equal(running.running, true);
  assert.equal(running.status, "running");
  assert.deepEqual(running.progress, { completedUnits: 2, totalUnits: 5 });
  assert.deepEqual(running.allowedActions, ["pause", "cancel"]);

  const warning = projectBackgroundTask({
    id: "task:warn-1",
    taskType: "document",
    lifecycle: "terminal",
    outcome: "delivered_with_warnings",
    quality: "needs_review",
    revision: 8,
    goal: "整理文档",
    warnings: [{ message: "第 3 页需复核" }],
    artifacts: [{ artifactId: "artifact-1", path: "out.md" }],
    allowedActions: ["retry"],
  });
  assert.equal(warning.active, false);
  assert.equal(warning.needsAttention, true);
  assert.equal(warning.running, false);
  assert.equal(warning.status, "completed_with_warnings");
  assert.equal(warning.artifacts[0].artifactId, "artifact-1");
  assert.ok(taskNeedsAttention(warning));
  assert.equal(taskIsActive(warning), false);
});

test("legacy jobs retain compatibility fields without changing lifecycle semantics", () => {
  const projected = projectBackgroundTask({
    id: "document:legacy-1",
    kind: "document",
    status: "awaiting_output",
    running: false,
    qualityPassed: false,
    command: "文档整理 manual.pdf",
    outputPath: "manual.md",
    progress: { completedUnits: 5, totalUnits: 5 },
  }, { legacy: true });
  assert.equal(projected.id, "document:legacy-1");
  assert.equal(projected.taskType, "document");
  assert.equal(projected.lifecycle, "waiting_user");
  assert.equal(projected.outcome, null);
  assert.equal(projected.needsAttention, true);
  assert.equal(projected.command, "文档整理 manual.pdf");
  assert.equal(projected.outputPath, "manual.md");
  assert.equal(projected.artifactStatus, "pending");
});

test("registry aggregates process, legacy document, and generic stores while deduplicating ids", async () => {
  const registry = createBackgroundTaskRegistry({
    listProcessJobs: async () => [{ id: 3, command: "node worker.js", running: true }],
    listLegacyDocumentJobs: async () => [{ id: "legacy-1", kind: "document", status: "completed", outputPath: "a.md" }],
    listTaskJobs: async () => [{ id: "task:1", taskType: "report", lifecycle: "terminal", outcome: "delivered", quality: "verified" }],
    listPendingDeliveries: async () => [{ deliveryId: "delivery-1", taskId: "task:1", target: "task-center" }],
  });
  const snapshot = await registry.list();
  assert.deepEqual(snapshot.jobs.map((job) => job.id), [3, "legacy-1", "task:1"]);
  assert.deepEqual(snapshot.pendingDeliveries, [{ deliveryId: "delivery-1", taskId: "task:1", target: "task-center" }]);
  assert.equal(snapshot.jobs.find((job) => job.id === 3).active, true);
  assert.equal(snapshot.jobs.find((job) => job.id === "task:1").active, false);
});

test("registry preserves newest revision when a legacy projection is duplicated", async () => {
  const registry = createBackgroundTaskRegistry({
    listProcessJobs: async () => [],
    listLegacyDocumentJobs: async () => [
      { id: "document:same", status: "interrupted", revision: 2 },
      { id: "document:same", status: "completed", revision: 4 },
    ],
    listTaskJobs: async () => [],
  });
  const snapshot = await registry.list();
  assert.equal(snapshot.jobs.length, 1);
  assert.equal(snapshot.jobs[0].revision, 4);
  assert.equal(snapshot.jobs[0].lifecycle, "terminal");
});

test("projects a persisted complex-task manifest without losing outcome, coverage, or artifacts", () => {
  const projected = projectBackgroundTask({
    id: "task:12345678-abcd-abcd-abcd-123456789012",
    kind: "task",
    lifecycle: "terminal",
    revision: 12,
    quality: "needs_review",
    contract: {
      taskType: "document.markdown",
      goal: "完整整理产品手册",
      workspace: "D:/workspace",
      output: { requestedPath: "D:/workspace/manual.md" },
      completion: { requiredCoverage: ["page:1", "page:2"] },
    },
    coverageLedger: {
      "page:1": { state: "completed", artifactRefs: ["artifact:1"] },
      "page:2": { state: "degraded", artifactRefs: ["artifact:2"] },
    },
    metadata: {
      artifacts: [
        { artifactId: "artifact:final", path: "D:/workspace/manual.md", mediaType: "text/markdown" },
      ],
      currentModel: "provider/model",
    },
    outcome: {
      outcome: "delivered_with_warnings",
      summary: "文档已交付，第 2 页使用原文兜底。",
      artifactRefs: ["artifact:final"],
      warnings: [{ message: "第 2 页需要复核" }],
      resumable: true,
    },
    outbox: [{ deliveryId: "delivery-1", pendingConsumers: ["task-center"] }],
    epoch: 3,
    userInputRequest: { requestId: "request-1", question: "请选择输出位置" },
    updatedAt: "2026-07-19T08:00:00.000Z",
  });

  assert.equal(projected.taskType, "document.markdown");
  assert.equal(projected.goal, "完整整理产品手册");
  assert.equal(projected.workspace, "D:/workspace");
  assert.equal(projected.outcome, "delivered_with_warnings");
  assert.equal(projected.outcomeSummary, "文档已交付，第 2 页使用原文兜底。");
  assert.deepEqual(projected.progress, { completedUnits: 2, totalUnits: 2, degradedUnits: 1 });
  assert.equal(projected.outputPath, "D:/workspace/manual.md");
  assert.equal(projected.epoch, 3);
  assert.equal(projected.userAction.requestId, "request-1");
  assert.equal(projected.artifacts[0].artifactId, "artifact:final");
  assert.deepEqual(projected.allowedActions, ["retry", "ack_outcome"]);
});

const TASK_ID = "task:12345678-abcd-abcd-abcd-123456789012";

test("public task projection normalizes compatible quality aliases", () => {
  assert.equal(projectBackgroundTask({ id: TASK_ID, lifecycle: "terminal", outcome: "delivered", quality: "passed" }).quality, "verified");
  assert.equal(projectBackgroundTask({ id: TASK_ID, lifecycle: "terminal", outcome: "delivered", quality: "verified" }).quality, "verified");
  assert.equal(projectBackgroundTask({ id: TASK_ID, lifecycle: "terminal", outcome: "partial", quality: "degraded" }).quality, "needs_review");
  assert.equal(projectBackgroundTask({ id: TASK_ID, lifecycle: "terminal", outcome: "partial", quality: "needs_review" }).quality, "needs_review");
});

test("abandoned is a visible terminal outcome and requires attention", () => {
  const projected = projectBackgroundTask({
    id: TASK_ID,
    lifecycle: "terminal",
    outcome: { outcome: "abandoned", summary: "用户放弃" },
    quality: "degraded",
  });
  assert.equal(projected.outcome, "abandoned");
  assert.equal(projected.status, "abandoned");
  assert.equal(projected.needsAttention, true);
  assert.equal(taskNeedsAttention(projected), true);
});

test("a pending acknowledgement for either consumer keeps task attention visible", () => {
  const base = {
    id: TASK_ID,
    lifecycle: "terminal",
    outcome: "delivered",
    quality: "verified",
  };
  assert.equal(taskNeedsAttention({
    ...base,
    outbox: [{
      deliveryId: "delivery-1",
      consumers: ["task-center", "conversation"],
      acknowledgements: { conversation: true },
    }],
  }), true);
  assert.equal(taskNeedsAttention({
    ...base,
    outbox: [{
      deliveryId: "delivery-1",
      consumers: ["task-center", "conversation"],
      acknowledgements: { "task-center": true },
    }],
  }), true);
  assert.equal(taskNeedsAttention({
    ...base,
    outbox: [{
      deliveryId: "delivery-1",
      consumers: ["task-center", "conversation"],
      acknowledgements: { "task-center": true, conversation: true },
    }],
  }), false);
});

test("registry exposes separate pending deliveries without collapsing consumer acknowledgements", async () => {
  const task = {
    id: TASK_ID,
    lifecycle: "terminal",
    outcome: { outcome: "delivered", summary: "done" },
    quality: "passed",
    outbox: [{
      deliveryId: "delivery-1",
      consumers: ["task-center", "conversation"],
      acknowledgements: { conversation: true },
    }],
  };
  const snapshot = await createBackgroundTaskRegistry({
    listTaskJobs: async () => [task],
    listPendingDeliveries: async () => [{
      taskId: TASK_ID,
      deliveryId: "delivery-1",
      target: "task-center",
      pendingConsumers: ["task-center"],
    }],
  }).list();
  assert.equal(snapshot.jobs[0].needsAttention, true);
  assert.deepEqual(snapshot.pendingDeliveries.map(({ target }) => target), ["task-center"]);
});

test("projects checkpoint and pending-assembly artifact references without exposing a false output path", () => {
  const unitRef = `artifact:unit@r2#${"a".repeat(64)}`;
  const finalRef = `artifact:final@r3#${"b".repeat(64)}`;
  const waiting = projectBackgroundTask({
    id: TASK_ID,
    lifecycle: "waiting_user",
    revision: 9,
    contract: { taskType: "document.markdown", output: { requestedPath: "D:/workspace/result.md" } },
    unitResults: { "unit-1": { unitId: "unit-1", artifactRefs: [unitRef] } },
    pendingAssembly: { artifactRefs: [unitRef, finalRef] },
    outcome: null,
  });
  assert.equal(waiting.artifacts.length, 2);
  assert.equal(waiting.artifacts.every((item) => item.artifactRef), true);
  assert.equal(waiting.artifacts.every((item) => item.path === null), true);
  assert.equal(waiting.artifacts.every((item) => item.previewAvailable === true), true);
  assert.equal(waiting.outputPath, null);
  const unitArtifact = waiting.artifacts.find((item) => item.artifactRef === unitRef);
  assert.equal(unitArtifact.role, "unit");
  assert.equal(unitArtifact.unitId, "unit-1");
  assert.equal(unitArtifact.revision, 2);
  assert.equal(unitArtifact.sha256, "a".repeat(64));
  assert.equal(unitArtifact.artifactId, "artifact:unit");

  const terminal = projectBackgroundTask({
    ...waiting,
    lifecycle: "terminal",
    outcome: { outcome: "delivered", artifactRefs: [finalRef] },
    outputPath: "D:/workspace/result.md",
  });
  assert.equal(terminal.artifacts.find((item) => item.artifactRef === finalRef).path, "D:/workspace/result.md");
  assert.equal(terminal.artifacts.find((item) => item.artifactRef === finalRef).previewAvailable, true);
});

test("coverage ledger progress is merged with real progress evidence", () => {
  const projected = projectBackgroundTask({
    id: TASK_ID,
    lifecycle: "running",
    progress: { sequence: 4, lastProgressAt: "2026-07-19T00:00:00.000Z", evidence: { kind: "model-stream" } },
    coverageLedger: {
      one: { state: "completed" },
      two: { state: "degraded" },
      three: { state: "pending" },
    },
  });
  assert.equal(projected.progress.completedUnits, 2);
  assert.equal(projected.progress.totalUnits, 3);
  assert.equal(projected.progress.sequence, 4);
});

test("coverage-ledger artifact references retain their owning unit", () => {
  const artifactRef = `artifact:ledger@r5#${"C".repeat(64)}`;
  const projected = projectBackgroundTask({
    id: TASK_ID,
    lifecycle: "running",
    coverageLedger: {
      page: { state: "completed", primaryUnitId: "unit-ledger", artifactRefs: [artifactRef] },
    },
  });

  assert.deepEqual(projected.artifacts[0], {
    artifactId: "artifact:ledger",
    artifactRef,
    revision: 5,
    sha256: "c".repeat(64),
    path: null,
    role: "unit",
    unitId: "unit-ledger",
    previewAvailable: true,
  });
});
