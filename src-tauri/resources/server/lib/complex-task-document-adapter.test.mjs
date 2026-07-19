import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildDocumentTaskDraft,
  createComplexDocumentAdapter,
  DOCUMENT_ADAPTER_VERSION,
} from "./complex-task-document-adapter.mjs";
import { createComplexTaskArtifactStore } from "./complex-task-artifact-store.mjs";
import { validateTaskContract } from "./complex-task-contracts.mjs";

const TASK_ID = "task:12345678-abcd-abcd-abcd-123456789012";

function prepared() {
  return {
    sourcePath: "D:/docs/manual.pdf",
    readablePath: "D:/docs/manual.pdf",
    documentKind: "pdf",
    sourceFingerprint: "sha256:source",
    sources: [{ sourcePath: "D:/docs/manual.pdf", readablePath: "D:/docs/manual.pdf", documentKind: "pdf", fingerprint: "sha256:source" }],
  };
}

function batches() {
  return [
    {
      id: "batch-1",
      label: "PDF pages 1-2",
      units: [{ id: "page-1", location: "PDF page 1", text: "Introduction" }],
      contextUnits: [],
    },
    {
      id: "batch-2",
      label: "PDF pages 3-4",
      units: [{ id: "page-2", location: "PDF page 3", text: "Details", visualPending: true }],
      contextUnits: [{ id: "page-1", location: "PDF page 1", text: "Introduction" }],
    },
  ];
}

test("builds a host-owned document contract and complete extraction inventory", () => {
  const draft = buildDocumentTaskDraft({
    taskId: TASK_ID,
    prepared: prepared(),
    batches: batches(),
    outputPath: "D:/docs/manual.md",
    workspace: "D:/docs",
    goal: "完整整理手册",
    instructions: "保留全部技术细节",
    modelConfigFingerprints: ["provider/model#1"],
    enginePin: { executionEngine: "v2", rolloutMode: "v2-canary", schemaVersion: 1, selectedAt: "2026-07-19T00:00:00.000Z" },
  });
  const checked = validateTaskContract(draft.contract);
  assert.equal(checked.ok, true, checked.errors?.join("; "));
  assert.equal(draft.unitPlans.length, 2);
  assert.deepEqual(draft.contract.completion.requiredCoverage, ["page-1", "page-2"]);
  assert.deepEqual(draft.unitPlans[1].dependencies, ["batch-1"]);
  assert.equal(draft.unitPlans[1].requiredCapabilities.includes("vision"), true);
  assert.equal(draft.metadata.extractionInventory.complete, true);
  assert.deepEqual(draft.metadata.extractionInventory.expectedUnitIds, ["page-1", "page-2"]);
  assert.equal(draft.metadata.documentUnits["page-2"].text, "Details");
  assert.equal(draft.contract.pinned.adapterVersion, DOCUMENT_ADAPTER_VERSION);
});

test("adapter writes immutable unit artifacts and assembles in source order", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-adapter-"));
  try {
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    const adapter = createComplexDocumentAdapter({
      artifactStore,
      generateUnit: async ({ unitPlan }) => ({ markdown: `Rendered ${unitPlan.unitId}`, confidence: 0.9 }),
    });
    const draft = buildDocumentTaskDraft({ taskId: TASK_ID, prepared: prepared(), batches: batches(), outputPath: "D:/docs/manual.md", workspace: "D:/docs" });
    const first = await adapter.executeUnit({ task: draft, unitPlan: draft.unitPlans[1], attempt: 1, attemptId: "attempt-1" });
    assert.equal(first.proposedStatus, "completed");
    assert.deepEqual(first.proposedPrimaryCoverage, ["page-2"]);
    assert.equal(first.artifactRefs.length, 1);
    const second = await adapter.executeUnit({ task: draft, unitPlan: draft.unitPlans[0], attempt: 1, attemptId: "attempt-2" });
    const artifacts = [await artifactStore.read(first.artifactRefs[0]), await artifactStore.read(second.artifactRefs[0])];
    const assembled = await adapter.assemble({ task: draft, selectedArtifacts: artifacts, report: { complete: true } });
    assert.match(assembled, /Rendered page-1[\s\S]*Rendered page-2/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
