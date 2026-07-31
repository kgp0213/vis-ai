import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const ACTIVE_STATUSES = new Set(["queued", "running"]);

function errorFact(error, fallbackCode = "knowledge_index_failed") {
  return {
    code: String(error?.code || fallbackCode),
    message: String(error?.message || error || "knowledge index failed").slice(0, 500),
  };
}

function isAbort(error, signal) {
  return signal?.aborted === true || error?.name === "AbortError" || /aborted|cancelled/i.test(String(error?.message || ""));
}

export async function verifyKnowledgeDocumentIndex({ indexDir, catalog } = {}) {
  const metaPath = join(indexDir || "", "index.meta.json");
  const dataPath = join(indexDir || "", "index.jsonl");
  if (!existsSync(metaPath) || !existsSync(dataPath)) {
    return { ok: false, code: "knowledge_index_missing", missingDocuments: [], mismatchedMtimes: [], staleTombstones: [] };
  }
  let meta;
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf8"));
  } catch (error) {
    return { ok: false, code: "knowledge_index_meta_invalid", error: errorFact(error) };
  }
  if (meta?.version !== 1) return { ok: false, code: "knowledge_index_version_unknown", version: meta?.version ?? null };
  const mtimes = new Map();
  try {
    const lines = createInterface({ input: createReadStream(dataPath, { encoding: "utf8" }), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line);
      const path = String(entry.p || "").replaceAll("\\", "/");
      if (!path.startsWith("knowledge/uploads/")) continue;
      const mtime = Number(entry.m);
      if (!mtimes.has(path)) mtimes.set(path, mtime);
    }
  } catch (error) {
    return { ok: false, code: "knowledge_index_data_invalid", error: errorFact(error) };
  }
  const missingDocuments = [];
  const mismatchedMtimes = [];
  for (const document of Array.isArray(catalog?.documents) ? catalog.documents : []) {
    const path = String(document.markdownPath || "").replaceAll("\\", "/");
    if (!mtimes.has(path)) {
      missingDocuments.push(path);
      continue;
    }
    if (Number(mtimes.get(path)) !== Number(document.mtimeMs)) mismatchedMtimes.push(path);
  }
  const staleTombstones = (Array.isArray(catalog?.tombstones) ? catalog.tombstones : [])
    .map((item) => String(item.markdownPath || "").replaceAll("\\", "/"))
    .filter((path) => mtimes.has(path));
  return {
    ok: missingDocuments.length === 0 && mismatchedMtimes.length === 0 && staleTombstones.length === 0,
    indexedPaths: [...mtimes.keys()],
    missingDocuments,
    mismatchedMtimes,
    staleTombstones,
  };
}

export function createKnowledgeIndexCoordinator({
  catalog,
  updateSemanticIndex,
  getIndexDir = null,
  verifyIndex = null,
  setIndexDirty = () => {},
  debounceMs = 1500,
  now = () => new Date(),
  createJobId = () => randomUUID(),
} = {}) {
  if (typeof catalog?.read !== "function" || typeof catalog?.write !== "function") {
    throw new TypeError("knowledge index coordinator requires a document catalog");
  }
  if (typeof updateSemanticIndex !== "function") throw new TypeError("knowledge index coordinator requires updateSemanticIndex");
  const verify = verifyIndex ?? (async ({ workspace, catalog: state }) => {
    if (typeof getIndexDir !== "function") return { ok: false, code: "knowledge_index_location_unavailable" };
    return verifyKnowledgeDocumentIndex({ indexDir: getIndexDir(workspace), catalog: state });
  });
  const runtimes = new Map();
  const idleWaiters = new Set();

  function keyFor(workspace) {
    return resolve(workspace).toLowerCase();
  }

  function runtimeFor(workspace) {
    const key = keyFor(workspace);
    let runtime = runtimes.get(key);
    if (!runtime) {
      runtime = {
        workspace: resolve(workspace),
        timer: null,
        promise: null,
        controller: null,
        activeJob: null,
        followUp: false,
        cancelledJobIds: new Set(),
      };
      runtimes.set(key, runtime);
    }
    return runtime;
  }

  function allIdle() {
    return [...runtimes.values()].every((runtime) => !runtime.timer && !runtime.promise);
  }

  function notifyIdle() {
    if (!allIdle()) return;
    for (const resolvePromise of idleWaiters) resolvePromise();
    idleWaiters.clear();
  }

  function persistQueued(workspace, job) {
    const state = catalog.read(workspace, { reconcile: false });
    return catalog.write(workspace, { ...state, activeJob: job });
  }

  function createQueuedJob(workspace, revision) {
    const state = catalog.read(workspace);
    return {
      jobId: createJobId(),
      workspaceFingerprint: state.workspaceFingerprint,
      requestedRevision: revision ?? state.contentRevision,
      status: "queued",
      startedAt: null,
      finishedAt: null,
      error: null,
    };
  }

  function finishCatalog(workspace, job, { status, error = null, verification = null } = {}) {
    const state = catalog.read(workspace, { reconcile: false });
    const finishedAt = now().toISOString();
    const completed = status === "completed" && verification?.ok === true && state.contentRevision === job.requestedRevision;
    const finalStatus = completed ? "completed" : status === "completed" ? "partial" : status;
    if (completed) {
      state.indexedRevision = state.contentRevision;
      state.documents = state.documents.map((document) => ({
        ...document,
        status: "indexed",
        indexedRevision: state.contentRevision,
        lastError: null,
      }));
      state.tombstones = [];
    } else {
      state.documents = state.documents.map((document) => ({
        ...document,
        status: document.indexedRevision > 0 ? "stale" : "ready",
      }));
    }
    state.lastJob = {
      ...job,
      status: finalStatus,
      finishedAt,
      error: error ?? (finalStatus === "partial" ? {
        code: verification?.code || "knowledge_index_revision_changed",
        message: state.contentRevision !== job.requestedRevision
          ? "knowledge documents changed while indexing"
          : "committed index did not match the document catalog",
        details: verification,
      } : null),
    };
    state.activeJob = null;
    const written = catalog.write(workspace, state);
    try {
      setIndexDirty(workspace, !completed);
    } catch (dirtyError) {
      written.warnings = [...(written.warnings || []), `index dirty marker update failed: ${dirtyError.message}`].slice(-100);
      return catalog.write(workspace, written);
    }
    return written;
  }

  async function run(runtime, job) {
    runtime.controller = new AbortController();
    runtime.activeJob = { ...job, status: "running", startedAt: now().toISOString() };
    const before = catalog.read(runtime.workspace, { reconcile: false });
    const forceRebuild = before.documents.some((document) => document.status === "stale");
    before.activeJob = runtime.activeJob;
    before.documents = before.documents.map((document) => document.indexedRevision < runtime.activeJob.requestedRevision
      ? { ...document, status: "indexing" }
      : document);
    catalog.write(runtime.workspace, before);
    try {
      const result = await updateSemanticIndex({
        knowledgeAutoIndex: true,
        knowledgeForceRebuild: forceRebuild,
        workspaceDir: runtime.workspace,
        deferDirtyFinalization: true,
      }, runtime.controller.signal);
      if (runtime.controller.signal.aborted) {
        throw runtime.controller.signal.reason ?? new DOMException("knowledge indexing cancelled", "AbortError");
      }
      const buildResult = result?.result ?? {};
      const complete = result?.status === "completed"
        && buildResult.committed !== false
        && Number(buildResult.chunksSkipped || 0) === 0
        && Number(buildResult.skipBuckets?.readError || 0) === 0;
      if (!complete) {
        const blocked = /^skipped:/i.test(String(result?.status || ""));
        finishCatalog(runtime.workspace, runtime.activeJob, {
          status: blocked ? "blocked" : result?.error ? "failed" : "partial",
          error: result?.error ?? {
            code: blocked ? "knowledge_index_blocked" : "knowledge_index_partial",
            message: String(result?.status || "knowledge indexing did not complete"),
          },
        });
        runtime.followUp = false;
        return;
      }
      const current = catalog.read(runtime.workspace, { reconcile: false });
      const verification = await verify({ workspace: runtime.workspace, catalog: current, result });
      finishCatalog(runtime.workspace, runtime.activeJob, { status: "completed", verification });
    } catch (error) {
      const cancelled = isAbort(error, runtime.controller.signal);
      finishCatalog(runtime.workspace, runtime.activeJob, {
        status: cancelled ? "cancelled" : "failed",
        error: errorFact(error, cancelled ? "knowledge_index_cancelled" : "knowledge_index_failed"),
      });
      runtime.followUp = false;
    } finally {
      const shouldFollowUp = runtime.followUp && !runtime.controller.signal.aborted;
      runtime.followUp = false;
      runtime.controller = null;
      runtime.activeJob = null;
      runtime.promise = null;
      if (shouldFollowUp) {
        const state = catalog.read(runtime.workspace);
        if (state.contentRevision !== state.indexedRevision) {
          const followUp = createQueuedJob(runtime.workspace, state.contentRevision);
          runtime.activeJob = followUp;
          persistQueued(runtime.workspace, followUp);
          runtime.promise = run(runtime, followUp);
        }
      }
      notifyIdle();
    }
  }

  function schedule(workspace) {
    const runtime = runtimeFor(workspace);
    const state = catalog.read(workspace);
    if (runtime.promise) {
      if (state.contentRevision > Number(runtime.activeJob?.requestedRevision || 0)) runtime.followUp = true;
      return { ...runtime.activeJob, followUpQueued: runtime.followUp };
    }
    if (runtime.timer && runtime.activeJob) {
      clearTimeout(runtime.timer);
      runtime.activeJob.requestedRevision = state.contentRevision;
      persistQueued(workspace, runtime.activeJob);
    } else {
      runtime.activeJob = createQueuedJob(workspace, state.contentRevision);
      persistQueued(workspace, runtime.activeJob);
    }
    runtime.timer = setTimeout(() => {
      runtime.timer = null;
      const job = runtime.activeJob;
      runtime.promise = run(runtime, job);
    }, Math.max(0, Number(debounceMs) || 0));
    return { ...runtime.activeJob };
  }

  function start(workspace) {
    const runtime = runtimeFor(workspace);
    const state = catalog.read(workspace);
    if (runtime.promise) {
      if (state.contentRevision > Number(runtime.activeJob?.requestedRevision || 0)) runtime.followUp = true;
      return { ...runtime.activeJob, followUpQueued: runtime.followUp };
    }
    if (runtime.timer) clearTimeout(runtime.timer);
    runtime.timer = null;
    const job = runtime.activeJob && ACTIVE_STATUSES.has(runtime.activeJob.status)
      ? { ...runtime.activeJob, requestedRevision: state.contentRevision }
      : createQueuedJob(workspace, state.contentRevision);
    runtime.activeJob = job;
    persistQueued(workspace, job);
    runtime.promise = run(runtime, job);
    return { ...job };
  }

  function cancel(workspace, jobId) {
    const runtime = runtimeFor(workspace);
    if (runtime.cancelledJobIds.has(jobId)) return true;
    if (!runtime.activeJob || runtime.activeJob.jobId !== jobId) {
      const state = catalog.read(workspace, { reconcile: false });
      return state.lastJob?.jobId === jobId && state.lastJob?.status === "cancelled";
    }
    runtime.cancelledJobIds.add(jobId);
    if (runtime.timer) {
      clearTimeout(runtime.timer);
      runtime.timer = null;
      finishCatalog(workspace, runtime.activeJob, {
        status: "cancelled",
        error: { code: "knowledge_index_cancelled", message: "knowledge indexing was cancelled" },
      });
      runtime.activeJob = null;
      notifyIdle();
      return true;
    }
    runtime.followUp = false;
    runtime.controller?.abort(new DOMException("knowledge indexing cancelled", "AbortError"));
    return true;
  }

  async function reconcileCommittedIndex(workspace, { complete = false, result = null } = {}) {
    const state = catalog.read(workspace);
    const job = {
      jobId: `external-${now().getTime()}`,
      workspaceFingerprint: state.workspaceFingerprint,
      requestedRevision: state.contentRevision,
      status: "running",
      startedAt: null,
      finishedAt: null,
      error: null,
    };
    const verification = complete
      ? await verify({ workspace: resolve(workspace), catalog: state, result })
      : { ok: false, code: "knowledge_index_build_incomplete" };
    const next = finishCatalog(workspace, job, { status: complete ? "completed" : "partial", verification });
    return { clean: next.contentRevision === next.indexedRevision, verification, state: next };
  }

  async function shutdown() {
    const pending = [];
    for (const runtime of runtimes.values()) {
      const jobId = runtime.activeJob?.jobId;
      if (jobId) cancel(runtime.workspace, jobId);
      if (runtime.promise) pending.push(runtime.promise);
    }
    await Promise.allSettled(pending);
    notifyIdle();
  }

  return {
    cancel,
    getState: (workspace) => catalog.read(workspace, { reconcile: false }),
    reconcileCommittedIndex,
    schedule,
    shutdown,
    start,
    whenIdle: () => allIdle() ? Promise.resolve() : new Promise((resolvePromise) => idleWaiters.add(resolvePromise)),
  };
}
