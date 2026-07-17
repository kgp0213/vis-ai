import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, utimes } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createDocumentJobStore } from "./document-job-store.mjs";
import { atomicWriteFile } from "./atomic-file.mjs";

test("document jobs persist resumable state and clean only stale recovery data", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-jobs-"));
  try {
    const store = createDocumentJobStore(root, { retentionDays: 30 });
    const job = await store.create({
      sourcePath: "manual.pdf",
      outputPath: "manual.md",
      workspaceRoot: "D:/original-workspace",
      allowOutsideWorkspace: false,
      contract: { fidelity: "complete-with-summary" },
    });
    await store.update(job.id, { status: "running", progress: { completedUnits: 2, totalUnits: 10 } });
    await store.writeSection(job.id, "batch-1", "section body");
    const restored = await store.read(job.id);
    assert.equal(restored.status, "running");
    assert.equal(restored.progress.completedUnits, 2);
    assert.equal(restored.workspaceRoot, "D:/original-workspace");
    assert.equal(restored.allowOutsideWorkspace, false);
    assert.equal(await store.readSection(job.id, "batch-1"), "section body");

    const manifest = join(root, job.id, "manifest.json");
    const stale = new Date(Date.now() - 31 * 864e5);
    await utimes(manifest, stale, stale);
    const result = await store.pruneExpired(Date.now());
    assert.deepEqual(result.deleted, [job.id]);
    assert.equal((await store.list()).length, 0);
    await assert.rejects(() => readFile(manifest, "utf8"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("completed jobs expose failed batches for targeted retry", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-retry-"));
  try {
    const store = createDocumentJobStore(root);
    const job = await store.create({ sourcePath: "book.docx", outputPath: "book.md" });
    await store.update(job.id, {
      status: "completed_with_warnings",
      batches: [
        { id: "b1", status: "completed", unitIds: ["u1"] },
        { id: "b2", status: "needs_review", unitIds: ["u2"] },
      ],
    });
    assert.deepEqual((await store.failedBatches(job.id)).map((batch) => batch.id), ["b2"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("concurrent progress heartbeats serialize manifest replacement on Windows", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-concurrent-"));
  try {
    const store = createDocumentJobStore(root);
    const job = await store.create({ sourcePath: "manual.pdf", outputPath: "manual.md" });
    await Promise.all(Array.from({ length: 50 }, (_value, index) => store.update(job.id, {
      progress: { completedUnits: index, stage: `stage-${index}` },
    })));
    const restored = await store.read(job.id);
    assert.equal(restored.progress.completedUnits, 49);
    assert.equal(restored.progress.stage, "stage-49");
    assert.deepEqual((await readdir(join(root, job.id))).filter((name) => name.endsWith(".tmp")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("batch checkpoints and append-only events survive an interrupted manifest commit", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-checkpoint-"));
  try {
    const store = createDocumentJobStore(root);
    const job = await store.create({ sourcePath: "manual.pdf", outputPath: "manual.md" });
    await store.update(job.id, { status: "running", running: true });
    const record = {
      id: "pages-1-2",
      sectionId: "pages-1-2",
      status: "completed",
      unitIds: ["page-1", "page-2"],
      unitManifest: [
        { id: "page-1", location: "PDF page 1", chars: 8, sourceHash: "hash-1" },
        { id: "page-2", location: "PDF page 2", chars: 8, sourceHash: "hash-2" },
      ],
    };
    await store.writeBatchCheckpoint(job.id, record, "saved batch body");
    await store.writeSection(job.id, record.sectionId, "saved batch body");
    await store.writeSection(job.id, "pages-11-15", "later batch");
    await store.writeSection(job.id, "pages-6-10", "middle batch");

    const checkpoint = await store.readBatchCheckpoint(job.id, record.sectionId);
    assert.equal(checkpoint.content, "saved batch body");
    assert.equal(checkpoint.record.status, "completed");
    assert.deepEqual(await store.listSectionIds(job.id), ["pages-1-2", "pages-6-10", "pages-11-15"]);

    await store.repairInterrupted();
    const events = await store.readEvents(job.id);
    assert.ok(events.some((event) => event.type === "created"));
    assert.ok(events.some((event) => event.type === "checkpoint-written"));
    assert.ok(events.some((event) => event.type === "section-written"));
    assert.ok(events.some((event) => event.type === "restart-recovery"));
    assert.equal((await store.read(job.id)).status, "interrupted");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a permanent Windows replacement denial falls back to bounded versioned manifests", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-snapshot-fallback-"));
  try {
    const guardedAtomicWrite = async (target, content, options) => {
      if (target.endsWith("manifest.json") && existsSync(target)) {
        throw Object.assign(new Error("replacement denied by endpoint security"), { code: "EPERM" });
      }
      return atomicWriteFile(target, content, options);
    };
    const fallbacks = [];
    const store = createDocumentJobStore(root, {
      atomicWrite: guardedAtomicWrite,
      onManifestFallback: (_error, id) => fallbacks.push(id),
    });
    const job = await store.create({ sourcePath: "manual.pdf", outputPath: "manual.md" });
    await store.update(job.id, { status: "running", running: true });
    for (let index = 0; index < 12; index++) {
      await store.update(job.id, { progress: { completedUnits: index, stage: `stage-${index}` } });
    }

    const restored = await store.read(job.id);
    assert.equal(restored.status, "running");
    assert.equal(restored.progress.completedUnits, 11);
    assert.equal(restored.revision, 13);
    assert.equal(fallbacks.length, 13);
    const snapshots = await readdir(join(root, job.id, "manifest-snapshots"));
    assert.ok(snapshots.length <= 8);
    assert.ok((await store.readEvents(job.id)).some((event) => event.type === "manifest-snapshot-fallback"));

    const restartedStore = createDocumentJobStore(root, { atomicWrite: guardedAtomicWrite });
    assert.deepEqual(await restartedStore.repairInterrupted(), [job.id]);
    assert.equal((await restartedStore.read(job.id)).status, "interrupted");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
