import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { atomicWriteFile } from "./atomic-file.mjs";

const DAY_MS = 86_400_000;
const JOB_ID_RE = /^[a-f0-9-]{16,64}$/i;
const SECTION_ID_RE = /^[a-z0-9._-]{1,120}$/i;
const PERSISTED_LIVE_STATUSES = new Set([
  "queued",
  "accepted",
  "preparing",
  "planning",
  "running",
  "waiting_foreground",
  "waiting_provider",
  "pausing",
]);

function safeJobId(value) {
  const id = String(value ?? "").trim();
  if (!JOB_ID_RE.test(id)) throw new TypeError("invalid document job id");
  return id;
}

function safeSectionId(value) {
  const id = String(value ?? "").trim();
  if (!SECTION_ID_RE.test(id)) throw new TypeError("invalid document section id");
  return id;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export async function runDocumentJobStartupMaintenance(store, options = {}) {
  const result = {
    repaired: [],
    pruned: { deleted: [], kept: 0 },
    issues: [],
  };
  const reportIssue = (operation, issue = {}, error = null) => {
    const normalized = {
      operation,
      ...(issue?.jobId ? { jobId: issue.jobId } : {}),
      code: String(issue?.code || error?.code || "UNKNOWN"),
      message: String(issue?.message || error?.message || error || "document job maintenance failed"),
    };
    result.issues.push(normalized);
    try { options.onIssue?.(normalized, error); } catch { /* Startup diagnostics must not stop maintenance. */ }
  };
  const operations = [
    ["repair", "repaired", () => store.repairInterrupted({
      onIssue: (issue, error) => reportIssue("repair", issue, error),
    })],
    ["prune", "pruned", () => store.pruneExpired(Date.now(), {
      onIssue: (issue, error) => reportIssue("prune", issue, error),
    })],
  ];
  for (const [operation, field, run] of operations) {
    try {
      result[field] = await run();
    } catch (error) {
      reportIssue(operation, {}, error);
    }
  }
  return result;
}

export function createDocumentJobStore(rootDir, options = {}) {
  const root = resolve(String(rootDir));
  const retentionDays = Math.max(1, Math.min(365, Number(options.retentionDays) || 30));
  const atomicWrite = options.atomicWrite ?? atomicWriteFile;
  const mutationChains = new Map();
  const eventChains = new Map();

  const jobDir = (id) => join(root, safeJobId(id));
  const manifestPath = (id) => join(jobDir(id), "manifest.json");
  const manifestSnapshotsDir = (id) => join(jobDir(id), "manifest-snapshots");
  const sectionPath = (id, sectionId) => join(jobDir(id), "sections", `${safeSectionId(sectionId)}.md`);
  const checkpointPath = (id, sectionId) => join(jobDir(id), "checkpoints", `${safeSectionId(sectionId)}.json`);
  const finalDraftPath = (id) => join(jobDir(id), "final-draft.md");
  const eventsPath = (id) => join(jobDir(id), "events.jsonl");

  function serializeMutation(id, action) {
    const key = safeJobId(id);
    const previous = mutationChains.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(action);
    mutationChains.set(key, next);
    return next.finally(() => {
      if (mutationChains.get(key) === next) mutationChains.delete(key);
    });
  }

  function serializeEvent(id, action) {
    const key = safeJobId(id);
    const previous = eventChains.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(action);
    eventChains.set(key, next);
    return next.finally(() => {
      if (eventChains.get(key) === next) eventChains.delete(key);
    });
  }

  async function ensureRoot() {
    await mkdir(root, { recursive: true });
  }

  async function appendEvent(id, event = {}) {
    const key = safeJobId(id);
    const entry = {
      version: 1,
      at: new Date().toISOString(),
      ...clone(event),
    };
    return serializeEvent(key, async () => {
      await mkdir(jobDir(key), { recursive: true });
      await appendFile(eventsPath(key), `${JSON.stringify(entry)}\n`, "utf8");
      return clone(entry);
    });
  }

  async function readEvents(id, limit = 100) {
    try {
      const lines = (await readFile(eventsPath(id), "utf8")).split(/\r?\n/).filter(Boolean);
      return lines.slice(-Math.max(1, Math.min(1_000, Number(limit) || 100))).flatMap((line) => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  function retryableManifestReplace(error) {
    return ["EACCES", "EBUSY", "EPERM"].includes(String(error?.code || "").toUpperCase());
  }

  async function pruneManifestSnapshots(id, keep = 8) {
    try {
      const entries = (await readdir(manifestSnapshotsDir(id), { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => entry.name)
        .sort()
        .reverse();
      await Promise.all(entries.slice(keep).map((name) => rm(join(manifestSnapshotsDir(id), name), { force: true })));
    } catch { /* Snapshot pruning is best effort. */ }
  }

  async function readManifestCandidate(path, id) {
    try {
      const parsed = JSON.parse(await readFile(path, "utf8"));
      return parsed?.id === id ? parsed : null;
    } catch {
      return null;
    }
  }

  async function writeManifest(value) {
    const manifest = {
      version: 1,
      ...clone(value),
      updatedAt: new Date().toISOString(),
    };
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
    try {
      await atomicWrite(manifestPath(manifest.id), serialized, "utf8");
      await rm(manifestSnapshotsDir(manifest.id), { recursive: true, force: true }).catch(() => {});
    } catch (error) {
      if (retryableManifestReplace(error)) {
        const snapshotName = `${String(Number(manifest.revision) || 0).padStart(12, "0")}-${randomUUID()}.json`;
        const snapshotPath = join(manifestSnapshotsDir(manifest.id), snapshotName);
        await mkdir(manifestSnapshotsDir(manifest.id), { recursive: true });
        await atomicWrite(snapshotPath, serialized, "utf8");
        await pruneManifestSnapshots(manifest.id);
        await appendEvent(manifest.id, {
          type: "manifest-snapshot-fallback",
          code: String(error?.code || "UNKNOWN"),
          snapshot: snapshotName,
        }).catch(() => {});
        try { options.onManifestFallback?.(error, manifest.id, snapshotPath); } catch { /* Diagnostics are best effort. */ }
        return clone(manifest);
      }
      await appendEvent(manifest.id, {
        type: "manifest-write-failed",
        code: String(error?.code || "UNKNOWN"),
        message: String(error?.message || error).slice(0, 1_000),
      }).catch(() => {});
      throw error;
    }
    return clone(manifest);
  }

  async function create(input = {}) {
    await ensureRoot();
    const now = new Date().toISOString();
    const id = randomUUID();
    const created = await writeManifest({
      id,
      revision: 0,
      kind: "document",
      lifecycle: "task",
      status: "queued",
      running: false,
      paused: false,
      sourcePath: String(input.sourcePath ?? ""),
      sourcePaths: Array.isArray(input.sourcePaths) ? input.sourcePaths.map((path) => String(path)).filter(Boolean) : [],
      outputPath: String(input.outputPath ?? ""),
      outputIdentity: input.outputIdentity == null ? null : String(input.outputIdentity),
      taskType: String(input.taskType || "document"),
      taskFingerprint: input.taskFingerprint ?? null,
      sourceFingerprint: input.sourceFingerprint ?? null,
      pages: String(input.pages ?? ""),
      workspaceRoot: String(input.workspaceRoot ?? ""),
      allowOutsideWorkspace: input.allowOutsideWorkspace === true,
      allowOutputOverwrite: input.allowOutputOverwrite === true,
      sourceName: String(input.sourceName || basename(String(input.sourcePath ?? "document"))),
      origin: clone(input.origin ?? null),
      handoff: clone(input.handoff ?? {
        state: "waiting_worker",
        attempts: 0,
        terminalKey: null,
        terminalStatus: null,
      }),
      contract: clone(input.contract ?? null),
      policy: clone(input.policy ?? null),
      policyTrace: clone(input.policyTrace ?? null),
      sourcePlan: clone(input.sourcePlan ?? null),
      executionEpoch: clone(input.executionEpoch ?? null),
      progress: { completedUnits: 0, totalUnits: null, completedBatches: 0, totalBatches: null },
      batches: [],
      modelHistory: [],
      modelDiagnostics: [],
      modelCallCount: 0,
      lastModelCall: null,
      warnings: [],
      qualityPassed: null,
      outputCommittedAt: null,
      error: null,
      createdAt: now,
    });
    await appendEvent(id, { type: "created", status: "queued" }).catch(() => {});
    return created;
  }

  async function read(id) {
    const candidates = [];
    const canonical = await readManifestCandidate(manifestPath(id), id);
    if (canonical) candidates.push(canonical);
    try {
      const snapshots = (await readdir(manifestSnapshotsDir(id), { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => entry.name)
        .sort()
        .reverse()
        .slice(0, 8);
      for (const name of snapshots) {
        const snapshot = await readManifestCandidate(join(manifestSnapshotsDir(id), name), id);
        if (snapshot) candidates.push(snapshot);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const parsed = candidates.sort((left, right) => {
      const revisionOrder = (Number(right.revision) || 0) - (Number(left.revision) || 0);
      return revisionOrder || Date.parse(right.updatedAt || right.createdAt) - Date.parse(left.updatedAt || left.createdAt);
    })[0];
    if (!parsed) throw new Error(`invalid document job manifest: ${id}`);
    return clone(parsed);
  }

  async function update(id, changes = {}) {
    return serializeMutation(id, async () => {
      const current = await read(id);
      const next = {
        ...current,
        ...clone(changes),
        id: current.id,
        revision: (Number(current.revision) || 0) + 1,
        createdAt: current.createdAt,
      };
      if (changes.progress) next.progress = { ...(current.progress ?? {}), ...clone(changes.progress) };
      const written = await writeManifest(next);
      if (changes.status && changes.status !== current.status) {
        await appendEvent(id, {
          type: "status-changed",
          from: current.status,
          to: changes.status,
          error: changes.error ?? null,
        }).catch(() => {});
      }
      return written;
    });
  }

  async function compareAndUpdateHandoff(id, expected = {}, changes = {}) {
    return serializeMutation(id, async () => {
      const current = await read(id);
      const handoff = current.handoff && typeof current.handoff === "object" ? current.handoff : {};
      const matches = Object.entries(expected && typeof expected === "object" ? expected : {}).every(([key, value]) => {
        if (key === "userControlled") return (handoff.userControlled === true) === (value === true);
        return handoff[key] === value;
      });
      if (!matches) {
        return {
          applied: false,
          reason: "handoff-compare-failed",
          job: clone(current),
        };
      }
      const next = {
        ...current,
        handoff: {
          ...handoff,
          ...clone(changes && typeof changes === "object" ? changes : {}),
        },
        id: current.id,
        revision: (Number(current.revision) || 0) + 1,
        createdAt: current.createdAt,
      };
      const written = await writeManifest(next);
      return { applied: true, job: written };
    });
  }

  async function list() {
    if (!existsSync(root)) return [];
    const entries = await readdir(root, { withFileTypes: true });
    const jobs = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !JOB_ID_RE.test(entry.name)) continue;
      try {
        jobs.push(await read(entry.name));
      } catch (error) {
        let persistedAt = null;
        try { persistedAt = new Date((await stat(jobDir(entry.name))).mtimeMs).toISOString(); } catch { /* Timestamp is optional. */ }
        const message = `document job manifest is corrupt and could not be recovered: ${entry.name}`;
        jobs.push({
          version: 1,
          id: entry.name,
          revision: null,
          kind: "document",
          lifecycle: "task",
          status: "corrupt",
          running: false,
          paused: true,
          corrupt: true,
          needsAttention: true,
          sourcePath: "",
          sourcePaths: [],
          sourceName: "Damaged document job",
          outputPath: "",
          taskType: "document",
          progress: { completedUnits: 0, totalUnits: null, completedBatches: 0, totalBatches: null, stage: "corrupt" },
          batches: [],
          warnings: [{ type: "document-manifest-corrupt", message }],
          issues: [{ type: "document-manifest-corrupt", message, detail: String(error?.message || error) }],
          handoff: { state: "needs_user", attempts: 0, lastError: message },
          error: message,
          createdAt: persistedAt,
          updatedAt: persistedAt,
        });
      }
    }
    return jobs.sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt));
  }

  async function writeSection(id, sectionId, content) {
    await mkdir(join(jobDir(id), "sections"), { recursive: true });
    await atomicWrite(sectionPath(id, sectionId), String(content ?? ""), "utf8");
    await appendEvent(id, {
      type: "section-written",
      sectionId: safeSectionId(sectionId),
      chars: String(content ?? "").length,
    }).catch(() => {});
    return sectionPath(id, sectionId);
  }

  async function readSection(id, sectionId) {
    return readFile(sectionPath(id, sectionId), "utf8");
  }

  async function listSectionIds(id) {
    try {
      const entries = await readdir(join(jobDir(id), "sections"), { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
        .map((entry) => entry.name.slice(0, -3))
        .filter((entry) => SECTION_ID_RE.test(entry))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async function writeBatchCheckpoint(id, record, content) {
    const sectionId = safeSectionId(record?.sectionId || record?.id);
    const body = String(content ?? "");
    const checkpoint = {
      version: 1,
      jobId: safeJobId(id),
      sectionId,
      contentHash: createHash("sha256").update(body).digest("hex"),
      record: clone(record),
      content: body,
      writtenAt: new Date().toISOString(),
    };
    await mkdir(join(jobDir(id), "checkpoints"), { recursive: true });
    await atomicWrite(checkpointPath(id, sectionId), `${JSON.stringify(checkpoint)}\n`, "utf8");
    await appendEvent(id, { type: "checkpoint-written", sectionId, contentHash: checkpoint.contentHash }).catch(() => {});
    return clone(checkpoint);
  }

  async function writeFinalDraft(id, content, metadata = {}) {
    const key = safeJobId(id);
    const body = String(content ?? "");
    const sha256 = createHash("sha256").update(body).digest("hex");
    const record = {
      ...clone(metadata),
      file: "final-draft.md",
      chars: body.length,
      sha256,
      writtenAt: new Date().toISOString(),
    };
    await mkdir(jobDir(key), { recursive: true });
    await atomicWrite(finalDraftPath(key), body, "utf8");
    await update(key, { finalDraft: record });
    await appendEvent(key, { type: "final-draft-written", chars: body.length, sha256 }).catch(() => {});
    return clone(record);
  }

  async function readFinalDraft(id) {
    const key = safeJobId(id);
    const job = await read(key);
    if (!job.finalDraft?.sha256) throw new Error(`document final draft is unavailable: ${key}`);
    const content = await readFile(finalDraftPath(key), "utf8");
    const sha256 = createHash("sha256").update(content).digest("hex");
    if (sha256 !== job.finalDraft.sha256) {
      const error = new Error(`document final draft hash mismatch: ${key}`);
      error.code = "DOCUMENT_FINAL_DRAFT_CORRUPT";
      throw error;
    }
    return { ...clone(job.finalDraft), content };
  }

  async function readBatchCheckpoint(id, sectionId) {
    try {
      const checkpoint = JSON.parse(await readFile(checkpointPath(id, sectionId), "utf8"));
      if (checkpoint?.jobId !== id || checkpoint?.sectionId !== sectionId || typeof checkpoint?.content !== "string") return null;
      const hash = createHash("sha256").update(checkpoint.content).digest("hex");
      return hash === checkpoint.contentHash ? clone(checkpoint) : null;
    } catch (error) {
      if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
      throw error;
    }
  }

  async function failedBatches(id) {
    const job = await read(id);
    return (job.batches ?? []).filter((batch) => ["failed", "needs_review", "interrupted"].includes(batch.status));
  }

  async function remove(id) {
    await serializeMutation(id, () => rm(jobDir(id), { recursive: true, force: true }));
  }

  async function pruneExpired(now = Date.now(), options = {}) {
    if (!existsSync(root)) return { deleted: [], kept: 0 };
    const cutoff = Number(now) - retentionDays * DAY_MS;
    const deleted = [];
    let kept = 0;
    for (const job of await list()) {
      try {
        const mtimes = [];
        try { mtimes.push((await stat(manifestPath(job.id))).mtimeMs); } catch { /* A snapshot-only job has no canonical manifest. */ }
        try { mtimes.push((await stat(manifestSnapshotsDir(job.id))).mtimeMs); } catch { /* Most jobs do not need snapshots. */ }
        const persistedAt = Date.parse(job.updatedAt || job.createdAt);
        const mtimeMs = mtimes.length > 0 ? Math.max(...mtimes) : persistedAt;
        if (mtimeMs < cutoff) {
          await remove(job.id);
          deleted.push(job.id);
        } else {
          kept++;
        }
      } catch (error) {
        kept++;
        try {
          options.onIssue?.({ jobId: job.id, code: String(error?.code || "UNKNOWN"), message: String(error?.message || error) }, error);
        } catch { /* Maintenance diagnostics must not stop pruning. */ }
      }
    }
    return { deleted, kept };
  }

  async function repairInterrupted(options = {}) {
    const repaired = [];
    for (const job of await list()) {
      if (PERSISTED_LIVE_STATUSES.has(job.status)) {
        try {
          await update(job.id, { status: "interrupted", running: false, paused: true, error: "application stopped before the document task completed" });
          await appendEvent(job.id, { type: "restart-recovery", previousStatus: job.status }).catch(() => {});
          repaired.push(job.id);
        } catch (error) {
          try {
            options.onIssue?.({ jobId: job.id, code: String(error?.code || "UNKNOWN"), message: String(error?.message || error) }, error);
          } catch { /* Maintenance diagnostics must not stop recovery. */ }
        }
      }
    }
    return repaired;
  }

  return {
    root,
    retentionDays,
    appendEvent,
    compareAndUpdateHandoff,
    create,
    failedBatches,
    list,
    pruneExpired,
    read,
    readBatchCheckpoint,
    readFinalDraft,
    readEvents,
    readSection,
    remove,
    repairInterrupted,
    update,
    listSectionIds,
    writeBatchCheckpoint,
    writeFinalDraft,
    writeSection,
  };
}
