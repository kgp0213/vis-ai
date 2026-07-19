import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { assembleComplexTask } from "./complex-task-assembler.mjs";
import { createComplexTaskArtifactCommitter } from "./complex-task-artifact-committer.mjs";
import { createComplexTaskArtifactStore } from "./complex-task-artifact-store.mjs";
import { buildDocumentTaskDraft, createComplexDocumentAdapter } from "./complex-task-document-adapter.mjs";
import { createComplexTaskOrchestrator } from "./complex-task-orchestrator.mjs";
import { createComplexTaskStore } from "./complex-task-store.mjs";
import { createComplexTaskSupervisor } from "./complex-task-supervisor.mjs";
import { createDurableAgentWorker } from "./complex-task-worker.mjs";

function documentDraft(outputPath, suffix = "") {
  return buildDocumentTaskDraft({
    prepared: {
      sourcePath: join(tmpdir(), `source${suffix}.md`),
      readablePath: join(tmpdir(), `source${suffix}.md`),
      documentKind: "markdown",
      sourceFingerprint: `sha256:source${suffix}`,
    },
    batches: [
      { id: `section-a${suffix}`, label: "Section A", units: [{ id: `coverage-a${suffix}`, location: "Section A", text: "Alpha source" }] },
      { id: `section-b${suffix}`, label: "Section B", units: [{ id: `coverage-b${suffix}`, location: "Section B", text: "Beta source" }] },
    ],
    outputPath,
    workspace: join(outputPath, ".."),
    enginePin: { schemaVersion: 1, rolloutMode: "v2-default", executionEngine: "v2", selectedAt: "2026-07-19T00:00:00.000Z" },
  });
}

async function createKernel(root, { generateUnit, reserveOutput } = {}) {
  const store = createComplexTaskStore(join(root, "tasks"), { leaseMs: 2_000 });
  const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
  const adapter = createComplexDocumentAdapter({ artifactStore, generateUnit });
  const worker = createDurableAgentWorker({
    store,
    maxAttempts: 1,
    leaseTtlMs: 2_000,
    heartbeatIntervalMs: 500,
    executeUnit: (input) => adapter.executeUnit(input),
  });
  const committer = createComplexTaskArtifactCommitter({
    artifactStore,
    reserveOutput: reserveOutput ?? (async ({ requestedPath }) => ({ ok: true, outputPath: requestedPath, reservationId: "reservation-1" })),
    writeOutput: async ({ outputPath, content }) => writeFile(outputPath, content),
  });
  const supervisor = createComplexTaskSupervisor({ store });
  const orchestrator = createComplexTaskOrchestrator({
    store,
    worker,
    supervisor,
    adapters: { "document.markdown": adapter },
    pollIntervalMs: 60_000,
    assembler: async ({ task }) => {
      const assembled = await assembleComplexTask({ task, artifactStore, adapter });
      if (!assembled.ok) return assembled;
      const committed = await committer.commit({ task, assembled });
      return { ...assembled, ...committed, report: assembled.report, selectedArtifacts: assembled.selectedArtifacts };
    },
  });
  return { store, artifactStore, adapter, worker, supervisor, orchestrator };
}

async function runToSettlement(kernel, taskId, limit = 10) {
  for (let index = 0; index < limit; index += 1) {
    await kernel.orchestrator.runOnce();
    const task = await kernel.store.read(taskId);
    if (["terminal", "waiting_user", "blocked"].includes(task.lifecycle)) return task;
  }
  throw new Error(`task did not settle within ${limit} orchestrator passes`);
}

test("real Store vertical slice commits output, terminal Outcome, and two-consumer Outbox", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-task-vertical-"));
  try {
    const outputPath = join(root, "result.md");
    const kernel = await createKernel(root, { generateUnit: async ({ unitPlan }) => ({ markdown: `Rendered ${unitPlan.unitId}`, modelConfigFingerprint: "model:tested" }) });
    const created = await kernel.store.create(documentDraft(outputPath));
    const settled = await runToSettlement(kernel, created.id);
    assert.equal(settled.lifecycle, "terminal");
    assert.equal(settled.outcome.outcome, "delivered");
    assert.match(await readFile(outputPath, "utf8"), /Rendered section-a[\s\S]*Rendered section-b/);
    assert.ok(settled.outcome.artifactRefs.some((ref) => ref.includes("final-markdown")));
    const pending = await kernel.store.listPendingOutbox();
    assert.deepEqual(pending[0].pendingConsumers.sort(), ["conversation", "task-center"]);
    let revision = settled.revision;
    for (const consumer of ["task-center", "conversation"]) {
      const ack = await kernel.store.ackOutbox(created.id, pending[0].deliveryId, { expectedRevision: revision, consumer });
      assert.equal(ack.applied, true);
      revision = ack.task.revision;
    }
    assert.equal((await kernel.store.listPendingOutbox()).length, 0);
    await kernel.orchestrator.stop();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("model failure converges through extracted-source fallback and remains a visible delivery", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-task-fallback-"));
  try {
    const outputPath = join(root, "fallback.md");
    const kernel = await createKernel(root, { generateUnit: async () => { throw new Error("provider unavailable"); } });
    const draft = documentDraft(outputPath, "-fallback");
    const created = await kernel.store.create(draft);
    const settled = await runToSettlement(kernel, created.id);
    assert.equal(settled.lifecycle, "terminal");
    assert.equal(settled.outcome.outcome, "delivered_with_warnings");
    assert.ok(settled.outcome.warnings.some((warning) => warning.code === "SOURCE_FALLBACK"));
    assert.match(await readFile(outputPath, "utf8"), /Alpha source[\s\S]*Beta source/);
    await kernel.orchestrator.stop();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("late output conflict preserves the final artifact and waits for user without rerunning units", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-task-conflict-"));
  try {
    const outputPath = join(root, "occupied.md");
    await writeFile(outputPath, "existing");
    const kernel = await createKernel(root, {
      generateUnit: async ({ unitPlan }) => ({ markdown: `Rendered ${unitPlan.unitId}`, modelConfigFingerprint: "model:tested" }),
      reserveOutput: async () => ({ ok: false, error: "output path conflict", decision: { id: "output-path-conflict", question: "Use a new path?", choices: [{ id: "new", label: "New path" }] } }),
    });
    const created = await kernel.store.create(documentDraft(outputPath, "-conflict"));
    const settled = await runToSettlement(kernel, created.id);
    assert.equal(settled.lifecycle, "waiting_user");
    assert.equal(settled.outcome, null);
    assert.match(settled.userInputRequest.question, /new path/i);
    assert.ok(settled.pendingAssembly.artifactRefs.some((ref) => ref.includes("final-markdown")));
    assert.equal(await readFile(outputPath, "utf8"), "existing");
    const unitCheckpoints = (await kernel.store.readEvents(created.id)).filter((event) => event.type === "unit-checkpoint");
    assert.equal(unitCheckpoints.length, 2);
    await kernel.orchestrator.stop();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
