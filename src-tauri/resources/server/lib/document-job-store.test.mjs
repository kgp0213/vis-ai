import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import * as documentJobStoreModule from "./document-job-store.mjs";
import { atomicWriteFile } from "./atomic-file.mjs";

const { createDocumentJobStore, runDocumentJobStartupMaintenance } = documentJobStoreModule;

test("document job listing exposes a corrupt manifest without hiding healthy jobs", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-corrupt-list-"));
  try {
    const store = createDocumentJobStore(root);
    const healthy = await store.create({ sourcePath: "healthy.pdf", outputPath: "healthy.md" });
    const corruptId = "11111111-2222-4333-8444-555555555555";
    await mkdir(join(root, corruptId), { recursive: true });
    await writeFile(join(root, corruptId, "manifest.json"), "{not valid json", "utf8");

    const jobs = await store.list();

    assert.equal(jobs.length, 2);
    assert.equal(jobs.find((job) => job.id === healthy.id)?.status, "queued");
    const corrupt = jobs.find((job) => job.id === corruptId);
    assert.equal(corrupt?.status, "corrupt");
    assert.equal(corrupt?.corrupt, true);
    assert.equal(corrupt?.needsAttention, true);
    assert.ok(corrupt?.issues?.some((issue) => issue.type === "document-manifest-corrupt"));
    assert.match(corrupt?.error ?? "", /manifest/i);
    await assert.rejects(() => store.read(corruptId), /invalid document job manifest/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("document job startup maintenance isolates repair and prune failures", async () => {
  const repairFailureCalls = [];
  const repairFailure = await runDocumentJobStartupMaintenance({
    repairInterrupted: async () => {
      repairFailureCalls.push("repair");
      throw new Error("repair failed");
    },
    pruneExpired: async () => {
      repairFailureCalls.push("prune");
      return { deleted: ["expired-job"], kept: 2 };
    },
  });
  assert.deepEqual(repairFailureCalls, ["repair", "prune"]);
  assert.deepEqual(repairFailure.repaired, []);
  assert.deepEqual(repairFailure.pruned, { deleted: ["expired-job"], kept: 2 });
  assert.equal(repairFailure.issues[0]?.operation, "repair");
  assert.match(repairFailure.issues[0]?.message ?? "", /repair failed/);

  const pruneFailureCalls = [];
  const pruneFailure = await runDocumentJobStartupMaintenance({
    repairInterrupted: async () => {
      pruneFailureCalls.push("repair");
      return ["repaired-job"];
    },
    pruneExpired: async () => {
      pruneFailureCalls.push("prune");
      throw new Error("prune failed");
    },
  });
  assert.deepEqual(pruneFailureCalls, ["repair", "prune"]);
  assert.deepEqual(pruneFailure.repaired, ["repaired-job"]);
  assert.deepEqual(pruneFailure.pruned, { deleted: [], kept: 0 });
  assert.equal(pruneFailure.issues[0]?.operation, "prune");
  assert.match(pruneFailure.issues[0]?.message ?? "", /prune failed/);
});

test("document jobs persist their originating conversation and handoff lifecycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-origin-"));
  try {
    const store = createDocumentJobStore(root);
    const origin = {
      conversationId: "conversation-123",
      userPrompt: "完整整理这份文档",
      mode: "general",
      workspace: "D:/workspace",
      operationId: "operation-123",
    };
    const job = await store.create({ sourcePath: "manual.pdf", outputPath: "manual.md", origin });
    assert.deepEqual(job.origin, origin);
    assert.equal(job.handoff.state, "waiting_worker");
    assert.equal(job.handoff.attempts, 0);

    await store.update(job.id, { handoff: { ...job.handoff, state: "queued", terminalKey: `${job.id}:epoch:completed` } });
    const restored = await store.read(job.id);
    assert.equal(restored.origin.conversationId, "conversation-123");
    assert.equal(restored.handoff.state, "queued");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("document handoff CAS rejects a stale completion after user control changes the lease", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-handoff-cas-"));
  try {
    const store = createDocumentJobStore(root);
    const job = await store.create({ sourcePath: "manual.pdf", outputPath: "manual.md" });
    const running = {
      ...job.handoff,
      state: "running",
      terminalKey: `${job.id}:epoch-1:completed`,
      leaseId: "handoff-instance",
      dispatchId: "dispatch-1",
      userControlled: false,
    };
    await store.update(job.id, { handoff: running });
    await store.update(job.id, {
      handoff: {
        ...running,
        state: "user_paused",
        leaseId: null,
        terminalKey: null,
        userControlled: true,
      },
    });

    const result = await store.compareAndUpdateHandoff(job.id, {
      state: "running",
      terminalKey: running.terminalKey,
      leaseId: running.leaseId,
      dispatchId: running.dispatchId,
      userControlled: false,
    }, {
      state: "delivered",
      leaseId: null,
      deliveredAt: new Date().toISOString(),
    });

    assert.equal(result.applied, false);
    assert.equal(result.reason, "handoff-compare-failed");
    const restored = await store.read(job.id);
    assert.equal(restored.handoff.state, "user_paused");
    assert.equal(restored.handoff.userControlled, true);
    assert.equal(restored.handoff.terminalKey, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("document jobs persist and verify a final draft before external delivery", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-final-draft-"));
  try {
    const store = createDocumentJobStore(root);
    const job = await store.create({ sourcePath: "manual.pdf", outputPath: "manual.md" });
    const saved = await store.writeFinalDraft(job.id, "# Final\n\nComplete body.", {
      terminalStatus: "completed_with_warnings",
      qualityPassed: false,
      warnings: [{ type: "review", message: "check one table" }],
    });
    assert.equal(saved.chars, 23);
    assert.match(saved.sha256, /^[a-f0-9]{64}$/);
    const restored = await store.readFinalDraft(job.id);
    assert.equal(restored.content, "# Final\n\nComplete body.");
    assert.equal(restored.terminalStatus, "completed_with_warnings");
    assert.equal((await store.read(job.id)).finalDraft.sha256, saved.sha256);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restart recovery repairs every persisted live document status", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-live-recovery-"));
  try {
    const store = createDocumentJobStore(root);
    const liveStatuses = [
      "queued",
      "accepted",
      "preparing",
      "planning",
      "running",
      "waiting_foreground",
      "waiting_provider",
      "pausing",
    ];
    const jobs = [];
    for (const status of liveStatuses) {
      const job = await store.create({ sourcePath: `${status}.pdf`, outputPath: `${status}.md` });
      await store.update(job.id, { status, running: true, paused: false });
      jobs.push({ id: job.id, status });
    }
    const completed = await store.create({ sourcePath: "completed.pdf", outputPath: "completed.md" });
    await store.update(completed.id, { status: "completed", running: false, paused: false });

    const repaired = await store.repairInterrupted();

    assert.deepEqual(new Set(repaired), new Set(jobs.map((job) => job.id)));
    for (const job of jobs) {
      const restored = await store.read(job.id);
      assert.equal(restored.status, "interrupted", `${job.status} must not remain live without a worker after restart`);
      assert.equal(restored.running, false);
      assert.equal(restored.paused, true);
      const recovery = (await store.readEvents(job.id)).find((event) => event.type === "restart-recovery");
      assert.equal(recovery?.previousStatus, job.status);
    }
    assert.equal((await store.read(completed.id)).status, "completed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

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
