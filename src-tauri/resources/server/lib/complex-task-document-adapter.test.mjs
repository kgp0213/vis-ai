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
      generateUnit: async ({ unitPlan }) => ({ markdown: `Rendered ${unitPlan.unitId}`, confidence: 0.9, modelConfigFingerprint: "model-config-1" }),
    });
    const draft = buildDocumentTaskDraft({ taskId: TASK_ID, prepared: prepared(), batches: batches(), outputPath: "D:/docs/manual.md", workspace: "D:/docs" });
    const first = await adapter.executeUnit({ task: draft, unitPlan: draft.unitPlans[1], attempt: 1, attemptId: "attempt-1" });
    assert.equal(first.proposedStatus, "completed");
    assert.deepEqual(first.proposedPrimaryCoverage, ["page-2"]);
    assert.equal(first.artifactRefs.length, 1);
    const second = await adapter.executeUnit({ task: draft, unitPlan: draft.unitPlans[0], attempt: 1, attemptId: "attempt-2" });
    const artifacts = [await artifactStore.read(first.artifactRefs[0]), await artifactStore.read(second.artifactRefs[0])];
    assert.equal(artifacts[0].manifest.producer.modelConfigFingerprint, "model-config-1");
    const assembled = await adapter.assemble({ task: draft, selectedArtifacts: artifacts, report: { complete: true } });
    assert.match(assembled, /Rendered batch-1[\s\S]*Rendered batch-2/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("adapter recovers a failed model unit with an immutable extracted-source artifact", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-adapter-fallback-"));
  try {
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    const adapter = createComplexDocumentAdapter({
      artifactStore,
      generateUnit: async () => { throw new Error("model unavailable"); },
    });
    const draft = buildDocumentTaskDraft({ taskId: TASK_ID, prepared: prepared(), batches: batches(), outputPath: "D:/docs/manual.md", workspace: "D:/docs" });
    const result = await adapter.recoverUnit({
      task: draft,
      unitPlan: draft.unitPlans[0],
      attemptId: "source-fallback-1",
      diagnostics: { category: "model-error" },
    });
    assert.equal(result.proposedStatus, "skipped");
    assert.deepEqual(result.proposedPrimaryCoverage, ["page-1"]);
    assert.deepEqual(result.missingSourceRanges, []);
    assert.equal(result.fallbackKind, "source");
    assert.match(result.warnings[0].message, /提取出的原文/);
    const artifact = await artifactStore.read(result.artifactRefs[0]);
    assert.equal(artifact.content.toString("utf8"), "Introduction");
    assert.equal(artifact.manifest.producer.fallbackKind, "source");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("multi-source inventory associates units by sourceId rather than global batch position", () => {
  const multiPrepared = {
    sources: [
      { sourcePath: "D:/docs/a.md", documentKind: "markdown", fingerprint: "sha256:a" },
      { sourcePath: "D:/docs/b.md", documentKind: "markdown", fingerprint: "sha256:b" },
    ],
  };
  const draft = buildDocumentTaskDraft({
    taskId: TASK_ID,
    prepared: multiPrepared,
    outputPath: "D:/docs/report.md",
    workspace: "D:/docs",
    batches: [
      { id: "a-1", units: [{ id: "a-unit", sourceId: "source-001", text: "A" }] },
      { id: "a-2", units: [{ id: "a-unit-2", sourceId: "source-001", text: "A2" }] },
      { id: "b-1", units: [{ id: "b-unit", sourceId: "source-002", text: "B" }] },
    ],
  });
  assert.deepEqual(draft.contract.sources[0].extractionInventory.expectedUnitIds, ["a-unit", "a-unit-2"]);
  assert.deepEqual(draft.contract.sources[1].extractionInventory.expectedUnitIds, ["b-unit"]);
});
