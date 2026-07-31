import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { createKnowledgeDocumentCatalog } from "./knowledge-document-catalog.mjs";
import { createKnowledgeIndexCoordinator, verifyKnowledgeDocumentIndex } from "./knowledge-index-coordinator.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture({ updateSemanticIndex } = {}) {
  const workspace = mkdtempSync(join(tmpdir(), "visionox-knowledge-index-job-"));
  roots.push(workspace);
  let id = 0;
  const runtime = {
    paths(root) {
      return { projectRoot: resolve(root), root: resolve(root, "knowledge") };
    },
  };
  const catalog = createKnowledgeDocumentCatalog({
    knowledgeRuntime: runtime,
    createId: () => `document-${++id}`,
  });
  const markdown = join(workspace, "knowledge", "uploads", "doc.md");
  mkdirSync(dirname(markdown), { recursive: true });
  writeFileSync(markdown, "document", "utf8");
  catalog.read(workspace);
  let buildCount = 0;
  const coordinator = createKnowledgeIndexCoordinator({
    catalog,
    debounceMs: 5,
    updateSemanticIndex: updateSemanticIndex ?? (async () => {
      buildCount += 1;
      return { requested: true, status: "completed", result: { committed: true, chunksSkipped: 0, skipBuckets: {} } };
    }),
    verifyIndex: async () => ({ ok: true, indexedPaths: ["knowledge/uploads/doc.md"] }),
    createJobId: () => `job-${buildCount + 1}`,
  });
  return { workspace, catalog, coordinator, getBuildCount: () => buildCount };
}

describe("knowledge index coordinator", () => {
  test("coalesces queued requests for the same revision", async () => {
    const { workspace, coordinator, getBuildCount } = fixture();
    const first = coordinator.schedule(workspace);
    const second = coordinator.schedule(workspace);
    assert.equal(first.jobId, second.jobId);
    await coordinator.whenIdle();
    assert.equal(getBuildCount(), 1);
    assert.equal(coordinator.getState(workspace).lastJob.status, "completed");
  });

  test("runs one follow-up build for the latest mutation during an active build", async () => {
    let releaseFirst;
    let calls = 0;
    const firstGate = new Promise((resolvePromise) => { releaseFirst = resolvePromise; });
    const { workspace, catalog, coordinator } = fixture({
      updateSemanticIndex: async () => {
        calls += 1;
        if (calls === 1) await firstGate;
        return { requested: true, status: "completed", result: { committed: true, chunksSkipped: 0, skipBuckets: {} } };
      },
    });
    coordinator.start(workspace);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    const state = catalog.read(workspace, { reconcile: false });
    catalog.write(workspace, { ...state, contentRevision: state.contentRevision + 1 });
    coordinator.schedule(workspace);
    releaseFirst();
    await coordinator.whenIdle();
    assert.equal(calls, 2);
    assert.equal(coordinator.getState(workspace).indexedRevision, coordinator.getState(workspace).contentRevision);
  });

  test("forces a rebuild when a previously indexed document becomes stale", async () => {
    let observedTask = null;
    const { workspace, catalog, coordinator } = fixture({
      updateSemanticIndex: async (task) => {
        observedTask = task;
        return { requested: true, status: "completed", result: { committed: true, chunksSkipped: 0, skipBuckets: {} } };
      },
    });
    const state = catalog.read(workspace, { reconcile: false });
    state.contentRevision = 2;
    state.indexedRevision = 1;
    state.documents = state.documents.map((document) => ({
      ...document,
      status: "stale",
      indexedRevision: 1,
    }));
    catalog.write(workspace, state);
    coordinator.start(workspace);
    await coordinator.whenIdle();
    assert.equal(observedTask.knowledgeForceRebuild, true);
  });

  test("forces a rebuild for a stale replacement that has not inherited indexedRevision", async () => {
    let observedTask = null;
    const { workspace, catalog, coordinator } = fixture({
      updateSemanticIndex: async (task) => {
        observedTask = task;
        return { requested: true, status: "completed", result: { committed: true, chunksSkipped: 0, skipBuckets: {} } };
      },
    });
    const state = catalog.read(workspace, { reconcile: false });
    state.contentRevision = 2;
    state.indexedRevision = 1;
    state.documents = state.documents.map((document) => ({
      ...document,
      status: "stale",
      indexedRevision: 0,
    }));
    catalog.write(workspace, state);
    coordinator.start(workspace);
    await coordinator.whenIdle();
    assert.equal(observedTask.knowledgeForceRebuild, true);
  });

  test("does not automatically retry a failed revision", async () => {
    let calls = 0;
    const { workspace, coordinator } = fixture({
      updateSemanticIndex: async () => {
        calls += 1;
        throw new Error("embedding unavailable");
      },
    });
    coordinator.schedule(workspace);
    await coordinator.whenIdle();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 15));
    assert.equal(calls, 1);
    const state = coordinator.getState(workspace);
    assert.equal(state.lastJob.status, "failed");
    assert.notEqual(state.contentRevision, state.indexedRevision);
  });

  test("preserves provider 401, 429 and timeout diagnostics without retrying", async () => {
    for (const fact of [
      { code: "provider_unauthorized", message: "401 unauthorized" },
      { code: "provider_rate_limited", message: "429 rate limited" },
      { code: "provider_timeout", message: "embedding timed out" },
    ]) {
      let calls = 0;
      const { workspace, coordinator } = fixture({
        updateSemanticIndex: async () => {
          calls += 1;
          throw Object.assign(new Error(fact.message), { code: fact.code });
        },
      });
      coordinator.schedule(workspace);
      await coordinator.whenIdle();
      const state = coordinator.getState(workspace);
      assert.equal(calls, 1);
      assert.equal(state.lastJob.status, "failed");
      assert.equal(state.lastJob.error.code, fact.code);
      assert.notEqual(state.contentRevision, state.indexedRevision);
    }
  });

  test("keeps blocked configuration and partial chunk builds dirty", async () => {
    const blocked = fixture({
      updateSemanticIndex: async () => ({ requested: true, status: "skipped: embedding API key is not configured" }),
    });
    blocked.coordinator.schedule(blocked.workspace);
    await blocked.coordinator.whenIdle();
    assert.equal(blocked.coordinator.getState(blocked.workspace).lastJob.status, "blocked");

    const partial = fixture({
      updateSemanticIndex: async () => ({
        requested: true,
        status: "completed",
        result: { committed: true, chunksSkipped: 1, skipBuckets: { readError: 1 } },
      }),
    });
    partial.coordinator.schedule(partial.workspace);
    await partial.coordinator.whenIdle();
    const partialState = partial.coordinator.getState(partial.workspace);
    assert.equal(partialState.lastJob.status, "partial");
    assert.notEqual(partialState.contentRevision, partialState.indexedRevision);
  });

  test("cancels an active job idempotently", async () => {
    const { workspace, coordinator } = fixture({
      updateSemanticIndex: async (_task, signal) => new Promise((resolvePromise, rejectPromise) => {
        signal.addEventListener("abort", () => rejectPromise(signal.reason), { once: true });
      }),
    });
    const job = coordinator.start(workspace);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    assert.equal(coordinator.cancel(workspace, job.jobId), true);
    assert.equal(coordinator.cancel(workspace, job.jobId), true);
    await coordinator.whenIdle();
    assert.equal(coordinator.getState(workspace).lastJob.status, "cancelled");
  });

  test("shuts down queued and running jobs without leaving active state", async () => {
    const queued = fixture();
    queued.coordinator.schedule(queued.workspace);
    await queued.coordinator.shutdown();
    assert.equal(queued.getBuildCount(), 0);
    assert.equal(queued.coordinator.getState(queued.workspace).activeJob, null);
    assert.equal(queued.coordinator.getState(queued.workspace).lastJob.status, "cancelled");

    const running = fixture({
      updateSemanticIndex: async (_task, signal) => new Promise((resolvePromise, rejectPromise) => {
        signal.addEventListener("abort", () => rejectPromise(signal.reason), { once: true });
      }),
    });
    running.coordinator.start(running.workspace);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    await running.coordinator.shutdown();
    assert.equal(running.coordinator.getState(running.workspace).activeJob, null);
    assert.equal(running.coordinator.getState(running.workspace).lastJob.status, "cancelled");
  });
});

describe("knowledge index verification", () => {
  test("requires every document mtime and every tombstone removal", async () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-knowledge-index-verify-"));
    roots.push(root);
    const markdown = join(root, "knowledge", "uploads", "doc.md");
    const indexDir = join(root, "index");
    mkdirSync(dirname(markdown), { recursive: true });
    mkdirSync(indexDir, { recursive: true });
    writeFileSync(markdown, "doc", "utf8");
    const mtimeMs = statSync(markdown).mtimeMs;
    writeFileSync(join(indexDir, "index.meta.json"), JSON.stringify({ version: 1 }), "utf8");
    writeFileSync(join(indexDir, "index.jsonl"), `${JSON.stringify({ p: "knowledge/uploads/doc.md", m: mtimeMs })}\n`, "utf8");
    const catalog = {
      documents: [{ markdownPath: "knowledge/uploads/doc.md", mtimeMs }],
      tombstones: [{ markdownPath: "knowledge/uploads/deleted.md" }],
    };
    assert.equal((await verifyKnowledgeDocumentIndex({ indexDir, catalog })).ok, true);
    writeFileSync(join(indexDir, "index.jsonl"), `${JSON.stringify({ p: "knowledge/uploads/doc.md", m: mtimeMs, t: "doc" })}\n${JSON.stringify({ p: "knowledge/uploads/deleted.md", m: 1 })}\n`, "utf8");
    const stale = await verifyKnowledgeDocumentIndex({ indexDir, catalog });
    assert.equal(stale.ok, false);
    assert.deepEqual(stale.staleTombstones, ["knowledge/uploads/deleted.md"]);
  });
});
