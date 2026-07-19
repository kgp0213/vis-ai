import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createComplexTaskArtifactStore } from "./complex-task-artifact-store.mjs";
import { assembleComplexTask } from "./complex-task-assembler.mjs";

function artifactId(name) {
  return `artifact:${name}:${randomUUID()}`;
}

function artifactDraft(id, overrides = {}) {
  return {
    schemaVersion: 1,
    artifactId: id,
    revision: 1,
    mediaType: "text/markdown",
    primaryCoverage: [],
    contextRefs: [],
    producer: {
      adapterVersion: "document-v1",
      skillHash: "sha256:skill",
      modelConfigFingerprint: "model-config-1",
      toolSchemaVersion: "1",
    },
    ...overrides,
  };
}

function taskFixture(overrides = {}) {
  const taskId = `task:${randomUUID()}`;
  const unitPlans = [
    { unitId: "unit-1", primaryCoverage: ["page:1"], dependencies: [], contextRefs: [], outputRole: "section", fallbackPolicy: "preserve-source", requiredCapabilities: ["text"], planRevision: 1 },
    { unitId: "unit-2", primaryCoverage: ["page:2"], dependencies: ["unit-1"], contextRefs: [], outputRole: "section", fallbackPolicy: "preserve-source", requiredCapabilities: ["text"], planRevision: 1 },
  ];
  return {
    id: taskId,
    lifecycle: "running",
    contract: {
      completion: { requiredCoverage: ["page:1", "page:2"], requiredArtifacts: ["final-markdown"] },
      output: { format: "markdown", requestedPath: "result.md", conflictPolicy: "ask" },
    },
    unitPlans,
    unitResults: {},
    ...overrides,
  };
}

async function withStore(fn) {
  const root = await mkdtemp(join(tmpdir(), "visionox-artifact-store-"));
  try {
    return await fn(createComplexTaskArtifactStore(root), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("Artifact Store writes SHA-256 manifests atomically, is idempotent, and preserves immutable revisions", async () => {
  await withStore(async (store) => {
    const id = artifactId("unit-1");
    const first = await store.put({ manifest: artifactDraft(id, { primaryCoverage: ["page:1"] }), content: "# First" });
    assert.equal(first.ok, true);
    assert.equal(first.created, true);
    assert.match(first.manifest.sha256, /^[a-f0-9]{64}$/);
    assert.ok(first.manifest.path);

    const same = await store.put({ manifest: artifactDraft(id, { primaryCoverage: ["page:1"] }), content: "# First" });
    assert.equal(same.ok, true);
    assert.equal(same.created, false);
    assert.equal(same.manifest.sha256, first.manifest.sha256);

    const conflict = await store.put({ manifest: artifactDraft(id, { primaryCoverage: ["page:1"] }), content: "changed" });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.reason, "immutable-conflict");

    const revision = await store.put({ manifest: artifactDraft(id, { revision: 2, primaryCoverage: ["page:1"] }), content: "# Revised" });
    assert.equal(revision.ok, true);
    assert.equal(revision.created, true);
    assert.deepEqual((await store.list(id)).map((entry) => entry.revision), [2, 1]);
    assert.equal((await store.read(id)).content.toString(), "# Revised");
    assert.equal((await store.read(id, 1)).content.toString(), "# First");
  });
});

test("Artifact Store verifies content hashes, rejects malformed manifests, and leaves no temp files", async () => {
  await withStore(async (store) => {
    const id = artifactId("tamper");
    const saved = await store.put({ manifest: artifactDraft(id), content: "stable" });
    const paths = store.paths(id, saved.manifest.revision);
    await writeFile(paths.contentPath, "tampered", "utf8");
    await assert.rejects(() => store.read(id), (error) => error.code === "ARTIFACT_HASH_MISMATCH");

    await assert.rejects(() => store.put({ manifest: { artifactId: artifactId("bad"), revision: 1 }, content: "x" }), /invalid artifact manifest/i);
    const files = await readdir(paths.revisionDir);
    assert.deepEqual(files.filter((name) => name.endsWith(".tmp")), []);
    assert.equal(createHash("sha256").update("stable").digest("hex"), saved.manifest.sha256);
    await readFile(paths.manifestPath, "utf8");
  });
});

test("Assembler counts primary coverage only, permits overlapping context refs, and orders output deterministically", async () => {
  await withStore(async (store) => {
    const firstId = artifactId("page-1");
    const secondId = artifactId("page-2");
    const contextId = artifactId("context");
    await store.put({ manifest: artifactDraft(firstId, { primaryCoverage: ["page:1"], contextRefs: [{ sourceId: "source-1", range: "page:2", role: "context-only" }] }), content: "PAGE 1" });
    await store.put({ manifest: artifactDraft(secondId, { primaryCoverage: ["page:2"] }), content: "PAGE 2" });
    await store.put({ manifest: artifactDraft(contextId, { primaryCoverage: [], contextRefs: [{ sourceId: "source-1", range: "page:1", role: "context-only" }] }), content: "CONTEXT" });
    const task = taskFixture({ unitResults: {
      "unit-1": { unitId: "unit-1", artifactRefs: [firstId, contextId] },
      "unit-2": { unitId: "unit-2", artifactRefs: [secondId] },
    } });
    const result = await assembleComplexTask({ task, artifactStore: store });
    assert.equal(result.ok, true);
    assert.equal(result.report.complete, true);
    assert.deepEqual(result.report.missing, []);
    assert.deepEqual(result.selectedArtifacts.map((item) => item.manifest.artifactId), [firstId, secondId]);
    assert.equal(result.content, "PAGE 1\n\nPAGE 2");
    assert.ok(result.report.contextOnlyArtifacts.includes(contextId));
  });
});

test("Assembler lets the Adapter choose among candidates and rejects unauthorized primary coverage", async () => {
  await withStore(async (store) => {
    const firstId = artifactId("candidate-a");
    const secondId = artifactId("candidate-b");
    await store.put({ manifest: artifactDraft(firstId, { primaryCoverage: ["page:1"] }), content: "A" });
    await store.put({ manifest: artifactDraft(secondId, { primaryCoverage: ["page:1"] }), content: "B" });
    const task = taskFixture({ unitResults: { "unit-1": { unitId: "unit-1", artifactRefs: [firstId, secondId] }, "unit-2": { unitId: "unit-2", artifactRefs: [] } } });
    const selected = await assembleComplexTask({
      task,
      artifactStore: store,
      adapter: { selectPrimaryCandidate: ({ candidates }) => candidates.find((candidate) => candidate.manifest.artifactId === secondId).manifest.artifactId },
    });
    assert.equal(selected.report.selectedByCoverage["page:1"], secondId);
    assert.deepEqual(selected.report.missing, ["page:2"]);

    const unauthorizedId = artifactId("unauthorized");
    await store.put({ manifest: artifactDraft(unauthorizedId, { primaryCoverage: ["page:99"] }), content: "X" });
    const unauthorized = await assembleComplexTask({ task: taskFixture({ unitResults: { "unit-1": { unitId: "unit-1", artifactRefs: [unauthorizedId] } } }), artifactStore: store });
    assert.equal(unauthorized.ok, false);
    assert.ok(unauthorized.report.invalid.some((item) => item.code === "unauthorized-primary-coverage"));
  });
});

test("Assembler returns an explainable partial result for missing coverage and hash failures", async () => {
  await withStore(async (store) => {
    const firstId = artifactId("partial");
    await store.put({ manifest: artifactDraft(firstId, { primaryCoverage: ["page:1"] }), content: "PAGE 1" });
    const task = taskFixture({ unitResults: { "unit-1": { unitId: "unit-1", artifactRefs: [firstId] }, "unit-2": { unitId: "unit-2", artifactRefs: ["artifact:missing"] } } });
    const partial = await assembleComplexTask({ task, artifactStore: store });
    assert.equal(partial.ok, false);
    assert.equal(partial.report.complete, false);
    assert.deepEqual(partial.report.missing, ["page:2"]);
    assert.equal(partial.content, "PAGE 1");

    const paths = store.paths(firstId, 1);
    await writeFile(paths.contentPath, "BROKEN", "utf8");
    const corrupted = await assembleComplexTask({ task: taskFixture({ unitResults: { "unit-1": { unitId: "unit-1", artifactRefs: [firstId] } } }), artifactStore: store });
    assert.equal(corrupted.ok, false);
    assert.ok(corrupted.report.invalid.some((item) => item.code === "hash-mismatch"));
  });
});

test("Assembler uses a deterministic Adapter assembly hook", async () => {
  await withStore(async (store) => {
    const id = artifactId("hook");
    await store.put({ manifest: artifactDraft(id, { primaryCoverage: ["page:1"] }), content: "BODY" });
    const base = taskFixture();
    const task = taskFixture({ contract: { completion: { requiredCoverage: ["page:1"], requiredArtifacts: ["final-markdown"] } }, unitPlans: [base.unitPlans[0]], unitResults: { "unit-1": { unitId: "unit-1", artifactRefs: [id] } } });
    const result = await assembleComplexTask({ task, artifactStore: store, adapter: { assemble: ({ selectedArtifacts }) => `TITLE\n${selectedArtifacts[0].content.toString()}` } });
    assert.equal(result.ok, true);
    assert.equal(result.content, "TITLE\nBODY");
  });
});

test("Assembler turns invalid coverage contracts and Adapter failures into explainable results", async () => {
  await withStore(async (store) => {
    const id = artifactId("selector-error");
    await store.put({ manifest: artifactDraft(id, { primaryCoverage: ["page:1"] }), content: "BODY" });
    const task = taskFixture({ unitResults: { "unit-1": { unitId: "unit-1", artifactRefs: [id] } } });
    const selectorFailure = await assembleComplexTask({ task, artifactStore: store, adapter: { selectPrimaryCandidate: () => { throw new Error("adapter rejected candidate"); } } });
    assert.equal(selectorFailure.ok, false);
    assert.ok(selectorFailure.report.invalid.some((item) => item.code === "selector-error"));

    const invalidContract = await assembleComplexTask({ task: taskFixture({ contract: { completion: { requiredCoverage: [], requiredArtifacts: [] } } }), artifactStore: store });
    assert.equal(invalidContract.ok, false);
    assert.ok(invalidContract.report.invalid.some((item) => item.code === "invalid-contract"));
  });
});
