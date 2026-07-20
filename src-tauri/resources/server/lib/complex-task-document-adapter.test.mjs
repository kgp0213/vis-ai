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
import { validateTaskContract, validateUnitResult } from "./complex-task-contracts.mjs";

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

function extractionResult(overrides = {}) {
  return {
    totalUnits: 2,
    selectedPages: 2,
    processedPages: 2,
    ...overrides,
  };
}

test("builds a host-owned document contract and complete extraction inventory", () => {
  const draft = buildDocumentTaskDraft({
    taskId: TASK_ID,
    prepared: prepared(),
    batches: batches(),
    extractionResult: extractionResult(),
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
  assert.deepEqual(draft.metadata.extractionInventory.extractedUnitIds, ["page-1", "page-2"]);
  assert.equal(draft.metadata.extractionInventory.totalUnits, 2);
  assert.equal("expectedUnitIds" in draft.metadata.extractionInventory, false);
  assert.equal(draft.metadata.documentUnits["page-2"].text, "Details");
  assert.equal(draft.contract.pinned.adapterVersion, DOCUMENT_ADAPTER_VERSION);
  assert.equal(draft.metadata.pinnedSkill.hash, draft.contract.pinned.skillHash);
  assert.match(draft.metadata.pinnedSkill.content, /preserve every authorized source unit/i);
});

test("adapter writes immutable unit artifacts and assembles in source order", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-adapter-"));
  try {
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    const adapter = createComplexDocumentAdapter({
      artifactStore,
      generateUnit: async ({ unitPlan }) => ({ markdown: `Rendered ${unitPlan.unitId}`, confidence: 0.9, modelConfigFingerprint: "model-config-1" }),
    });
    const draft = buildDocumentTaskDraft({ taskId: TASK_ID, prepared: prepared(), batches: batches(), extractionResult: extractionResult(), outputPath: "D:/docs/manual.md", workspace: "D:/docs" });
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

test("source recovery uses a new artifact revision when an invalid model result already wrote revision 1", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-adapter-recovery-revision-"));
  try {
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    const adapter = createComplexDocumentAdapter({
      artifactStore,
      // The adapter persists the model artifact before the worker validates
      // this proposedStatus, reproducing the real malformed-result path.
      generateUnit: async () => ({ markdown: "model draft", proposedStatus: "not-a-valid-unit-status" }),
    });
    const draft = buildDocumentTaskDraft({
      taskId: TASK_ID,
      prepared: prepared(),
      batches: batches(),
      extractionResult: extractionResult(),
      outputPath: "D:/docs/manual.md",
      workspace: "D:/docs",
    });

    const modelResult = await adapter.executeUnit({
      task: draft,
      unitPlan: draft.unitPlans[0],
      attempt: 1,
      attemptId: "malformed-model-attempt",
    });
    assert.equal(validateUnitResult(modelResult, { unitPlan: draft.unitPlans[0] }).ok, false);

    const recovered = await adapter.recoverUnit({
      task: draft,
      unitPlan: draft.unitPlans[0],
      attemptId: "source-fallback-after-malformed-model",
      diagnostics: { category: "invalid-structured-output", attempts: [{ attempt: 1 }] },
    });
    const manifests = await artifactStore.list("artifact:task:12345678-abcd-abcd-abcd-123456789012:batch-1");
    assert.deepEqual(manifests.map((manifest) => manifest.revision).sort((a, b) => a - b), [1, 2]);
    assert.match(recovered.artifactRefs[0], /@r2#/);
    assert.equal((await artifactStore.read(recovered.artifactRefs[0])).content.toString("utf8"), "Introduction");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("adapter forwards worker progress and records an artifact commit only after persistence", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-adapter-progress-"));
  try {
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    const evidence = [];
    const reportProgress = async (entry) => {
      evidence.push(entry);
      return { ok: true };
    };
    const adapter = createComplexDocumentAdapter({
      artifactStore,
      generateUnit: async ({ unitPlan, reportProgress: forwarded, pinnedSkill }) => {
        assert.equal(forwarded, reportProgress);
        assert.equal(pinnedSkill.hash, draft.contract.pinned.skillHash);
        await forwarded({ kind: "model-stream", unitId: unitPlan.unitId, message: "16 chars" });
        return { markdown: "Rendered batch-1", confidence: 0.9, modelConfigFingerprint: "model-config-1" };
      },
    });
    const draft = buildDocumentTaskDraft({ taskId: TASK_ID, prepared: prepared(), batches: batches(), extractionResult: extractionResult(), outputPath: "D:/docs/manual.md", workspace: "D:/docs" });
    const output = await adapter.executeUnit({
      task: draft,
      unitPlan: draft.unitPlans[0],
      attempt: 1,
      attemptId: "attempt-progress",
      reportProgress,
    });
    assert.equal(evidence[0].kind, "model-stream");
    assert.deepEqual(evidence.at(-1), {
      kind: "artifact-committed",
      unitId: "batch-1",
      attemptId: "attempt-progress",
      coverage: ["page-1"],
      message: output.artifactRefs[0],
    });
    assert.equal((await artifactStore.read(output.artifactRefs[0])).content.toString("utf8"), "Rendered batch-1");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("adapter rejects a tampered pinned skill snapshot before model execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-adapter-skill-pin-"));
  try {
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    let generated = false;
    const adapter = createComplexDocumentAdapter({ artifactStore, generateUnit: async () => { generated = true; return { markdown: "bad" }; } });
    const draft = buildDocumentTaskDraft({ taskId: TASK_ID, prepared: prepared(), batches: batches(), extractionResult: extractionResult(), outputPath: "D:/docs/manual.md", workspace: "D:/docs" });
    draft.metadata.pinnedSkill.content = "tampered";
    await assert.rejects(
      () => adapter.executeUnit({ task: draft, unitPlan: draft.unitPlans[0], attemptId: "attempt-skill" }),
      (error) => error.code === "SKILL_PIN_MISMATCH",
    );
    assert.equal(generated, false);
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
    const draft = buildDocumentTaskDraft({ taskId: TASK_ID, prepared: prepared(), batches: batches(), extractionResult: extractionResult(), outputPath: "D:/docs/manual.md", workspace: "D:/docs" });
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

test("adapter never marks an empty source fallback as covered", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-adapter-empty-fallback-"));
  try {
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    const adapter = createComplexDocumentAdapter({ artifactStore });
    const emptyBatch = [{
      id: "batch-visual",
      label: "PDF page 1",
      units: [{ id: "page-visual", location: "PDF page 1", text: "", visualPending: true }],
      contextUnits: [],
    }];
    const draft = buildDocumentTaskDraft({
      taskId: TASK_ID,
      prepared: prepared(),
      batches: emptyBatch,
      extractionResult: extractionResult({ totalUnits: 1, selectedPages: 1, processedPages: 1 }),
      outputPath: "D:/docs/manual.md",
      workspace: "D:/docs",
    });

    const result = await adapter.recoverUnit({
      task: draft,
      unitPlan: draft.unitPlans[0],
      attemptId: "source-fallback-empty",
      diagnostics: { category: "model-error" },
    });

    assert.equal(result.proposedStatus, "needs_review");
    assert.deepEqual(result.artifactRefs, []);
    assert.deepEqual(result.proposedPrimaryCoverage, []);
    assert.deepEqual(result.missingSourceRanges, ["page-visual"]);
    assert.equal(result.fallbackKind, "unavailable");
    assert.match(result.warnings[0].message, /没有可读原文/);
    assert.deepEqual(await artifactStore.list(), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("adapter never commits an empty generated artifact as covered", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-adapter-empty-generated-"));
  try {
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    const adapter = createComplexDocumentAdapter({
      artifactStore,
      generateUnit: async () => ({ markdown: "" }),
    });
    const draft = buildDocumentTaskDraft({
      taskId: TASK_ID,
      prepared: prepared(),
      batches: [{
        id: "batch-visual",
        label: "PDF page 1",
        units: [{ id: "page-visual", location: "PDF page 1", text: "", visualPending: true }],
        contextUnits: [],
      }],
      extractionResult: extractionResult({ totalUnits: 1, selectedPages: 1, processedPages: 1 }),
      outputPath: "D:/docs/manual.md",
      workspace: "D:/docs",
    });

    const result = await adapter.executeUnit({
      task: draft,
      unitPlan: draft.unitPlans[0],
      attemptId: "empty-model-result",
    });

    assert.equal(result.proposedStatus, "needs_review");
    assert.deepEqual(result.artifactRefs, []);
    assert.deepEqual(result.proposedPrimaryCoverage, []);
    assert.deepEqual(result.missingSourceRanges, ["page-visual"]);
    assert.equal(result.fallbackKind, "unavailable");
    assert.match(result.warnings[0].message, /没有可读内容/);
    assert.deepEqual(await artifactStore.list(), []);
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
    extractionResult: {
      totalUnits: 3,
      sourceSummaries: [
        { sourcePath: "D:/docs/a.md", totalUnits: 2 },
        { sourcePath: "D:/docs/b.md", totalUnits: 1 },
      ],
    },
  });
  assert.deepEqual(draft.contract.sources[0].extractionInventory.extractedUnitIds, ["a-unit", "a-unit-2"]);
  assert.deepEqual(draft.contract.sources[1].extractionInventory.extractedUnitIds, ["b-unit"]);
  assert.equal(draft.contract.sources[0].extractionInventory.totalUnits, 2);
  assert.equal(draft.contract.sources[1].extractionInventory.totalUnits, 1);
});

test("rejects a source inventory when the extractor declared more units than were emitted", () => {
  assert.throws(
    () => buildDocumentTaskDraft({
      taskId: TASK_ID,
      prepared: prepared(),
      batches: [batches()[0]],
      extractionResult: extractionResult({ totalUnits: 2 }),
      outputPath: "D:/docs/manual.md",
      workspace: "D:/docs",
    }),
    /source inventory.*incomplete|extraction.*incomplete/i,
  );
});

test("adapter rejects an unavailable pinned runtime before generating or labelling an artifact", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-adapter-runtime-pin-"));
  try {
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    let generated = false;
    const adapter = createComplexDocumentAdapter({ artifactStore, generateUnit: async () => { generated = true; return { markdown: "bad" }; } });
    const draft = buildDocumentTaskDraft({ taskId: TASK_ID, prepared: prepared(), batches: batches(), extractionResult: extractionResult(), outputPath: "D:/docs/manual.md", workspace: "D:/docs" });
    draft.contract.pinned.adapterVersion = "document-future";
    await assert.rejects(
      () => adapter.executeUnit({ task: draft, unitPlan: draft.unitPlans[0], attemptId: "attempt-runtime" }),
      (error) => error.code === "RUNTIME_PIN_MISMATCH",
    );
    assert.equal(generated, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
