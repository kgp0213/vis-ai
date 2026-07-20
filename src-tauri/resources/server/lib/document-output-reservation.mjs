import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * States whose task or durable draft can still write the reserved output.
 * Resumable jobs keep ownership until completion, explicit abandonment,
 * cancellation, or record deletion so another task cannot steal the path.
 */
export const LIVE_DOCUMENT_JOB_STATUSES = new Set([
  "accepted",
  "preparing",
  "planning",
  "queued",
  "running",
  "waiting_foreground",
  "waiting_provider",
  "pausing",
  "paused",
  "interrupted",
  "stopped",
  "failed",
  "source_changed",
  "awaiting_output",
  "needs_review",
]);

export const TERMINAL_DOCUMENT_JOB_STATUSES = new Set([
  "completed",
  "completed_with_warnings",
  "abandoned",
  "cancelled",
]);

const DEFAULT_EXTENSION = ".md";
const DEFAULT_MAX_CANDIDATES = 999;
const REUSABLE_DOCUMENT_JOB_STATUSES = new Set([
  "accepted",
  "preparing",
  "planning",
  "queued",
  "running",
  "waiting_foreground",
  "waiting_provider",
  "pausing",
  "paused",
  "interrupted",
  "stopped",
  "failed",
  "awaiting_output",
  "completed",
  "completed_with_warnings",
]);

function text(value) {
  return String(value ?? "").trim();
}

function normalizedStatus(jobOrStatus) {
  return text(typeof jobOrStatus === "object" ? jobOrStatus?.status : jobOrStatus).toLowerCase();
}

function normalizedWorkspace(workspaceRoot) {
  const value = text(workspaceRoot);
  return resolve(value || process.cwd());
}

/**
 * Resolve an output path without requiring the file to exist. Relative paths
 * are always rooted at workspaceRoot; absolute paths are normalized lexically.
 */
export function canonicalDocumentOutputPath(outputPath, workspaceRoot = process.cwd()) {
  const value = text(outputPath);
  if (!value) throw new TypeError("document output path is required");
  return resolve(normalizedWorkspace(workspaceRoot), value);
}

function pathKey(path) {
  const canonical = String(path);
  return process.platform === "win32" ? canonical.toLowerCase() : canonical;
}

function jobWorkspace(job, fallbackWorkspace) {
  return text(job?.workspaceRoot) || fallbackWorkspace;
}

export function isLiveDocumentJob(job) {
  if (!job || typeof job !== "object") return false;
  const status = normalizedStatus(job);
  if (LIVE_DOCUMENT_JOB_STATUSES.has(status)) return true;
  // Some older manifests did not persist a distinct waiting status. Preserve
  // their live ownership while explicitly excluding known terminal states.
  return job.running === true && !TERMINAL_DOCUMENT_JOB_STATUSES.has(status);
}

/**
 * Return canonical paths owned by currently live document jobs. The Set is
 * intentionally path-only so callers can use it for cheap collision checks.
 */
export function collectLiveDocumentOutputPaths(jobs, { workspaceRoot = process.cwd() } = {}) {
  const paths = new Set();
  for (const job of Array.isArray(jobs) ? jobs : []) {
    if (!isLiveDocumentJob(job) || !text(job.outputPath)) continue;
    paths.add(canonicalDocumentOutputPath(job.outputPath, jobWorkspace(job, workspaceRoot)));
  }
  return paths;
}

/** Alias with a name useful to callers that want to emphasize the query. */
export const listLiveDocumentOutputPaths = collectLiveDocumentOutputPaths;

function collectLiveDocumentOutputDetails(jobs, workspaceRoot) {
  const details = new Map();
  for (const job of Array.isArray(jobs) ? jobs : []) {
    if (!isLiveDocumentJob(job) || !text(job.outputPath)) continue;
    const path = canonicalDocumentOutputPath(job.outputPath, jobWorkspace(job, workspaceRoot));
    const key = pathKey(path);
    if (!details.has(key)) details.set(key, { path, jobId: text(job.id || job.documentJobId) || null, status: normalizedStatus(job) });
  }
  return details;
}

function safeTitle(sourceTitle) {
  const raw = text(sourceTitle) || "document";
  // basename() follows the host platform; normalize both separators first so
  // a Windows path remains safe when a manifest is inspected on another OS.
  const leaf = raw.replace(/[\\/]+/g, "/").split("/").at(-1) || "document";
  return leaf
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120) || "document";
}

function extension(value) {
  const candidate = text(value);
  if (!candidate) return DEFAULT_EXTENSION;
  return candidate.startsWith(".") ? candidate : `.${candidate}`;
}

function conflictDecision(conflicts) {
  const hasLive = conflicts.some((entry) => entry.kind === "live-job");
  const hasReservation = conflicts.some((entry) => entry.kind === "reservation");
  const choices = [
    {
      id: "new-file",
      label: "使用新文件名",
      description: "保留现有任务或文件，并为本次任务选择新的输出名称。",
    },
  ];
  if (!hasLive && !hasReservation) {
    choices.push({
      id: "overwrite",
      label: "确认覆盖",
      description: "确认后允许替换现有输出文件。",
    });
  }
  return {
    id: "output-path-conflict",
    question: "输出路径已被占用，如何继续？",
    recommendedChoiceId: "new-file",
    choices,
  };
}

function resultForReservation(entry, generated = false) {
  return {
    ok: true,
    reservationId: entry.id,
    outputPath: entry.outputPath,
    generated,
    jobId: entry.jobId ?? null,
  };
}

/**
 * Reserve document output paths before a model is called.
 *
 * The manager serializes reserve operations. This closes the gap between
 * checking the filesystem and persisting a job, where two queued requests
 * could otherwise receive the same default name.
 */
export function createDocumentOutputReservation(options = {}) {
  const workspaceRoot = normalizedWorkspace(options.workspaceRoot);
  const pathExists = options.pathExists ?? options.exists ?? existsSync;
  const listJobs = options.listJobs ?? options.queryJobs ?? (() => []);
  const maxCandidates = Math.max(1, Math.min(10_000, Number(options.maxCandidates) || DEFAULT_MAX_CANDIDATES));
  const defaultExtension = extension(options.defaultExtension);
  const reservations = new Map();
  const aliases = new Map();
  let mutationChain = Promise.resolve();

  function serialize(action) {
    const previous = mutationChain;
    const next = previous.catch(() => {}).then(action);
    mutationChain = next;
    return next.finally(() => {
      if (mutationChain === next) mutationChain = Promise.resolve();
    });
  }

  async function existing(path) {
    return Boolean(await pathExists(path));
  }

  async function queryJobs() {
    const listed = await listJobs();
    return Array.isArray(listed) ? listed : Array.isArray(listed?.jobs) ? listed.jobs : [];
  }

  function matchingSemanticJob(jobs, fingerprint, outputPath) {
    const expected = text(fingerprint);
    if (!expected) return null;
    const expectedPath = pathKey(outputPath);
    return jobs.find((job) => {
      if (job?.corrupt === true || text(job?.taskFingerprint) !== expected) return false;
      if (!REUSABLE_DOCUMENT_JOB_STATUSES.has(normalizedStatus(job)) || !text(job?.outputPath)) return false;
      const candidatePath = canonicalDocumentOutputPath(job.outputPath, jobWorkspace(job, workspaceRoot));
      return pathKey(candidatePath) === expectedPath;
    }) ?? null;
  }

  function localConflict(path, ownerId) {
    const entry = reservations.get(pathKey(path));
    const owner = text(ownerId);
    const aliasedOwner = aliases.get(owner);
    if (
      !entry
      || entry.id === owner
      || entry.jobId === owner
      || (aliasedOwner && entry.id === aliasedOwner)
    ) return null;
    return { kind: "reservation", path, reservationId: entry.id, jobId: entry.jobId ?? null };
  }

  function findByOwner(id) {
    const token = text(id);
    if (!token) return null;
    const aliased = aliases.get(token);
    if (aliased) {
      for (const entry of reservations.values()) {
        if (entry.id === aliased) return entry;
      }
    }
    for (const entry of reservations.values()) {
      if (entry.id === token || entry.jobId === token) return entry;
    }
    return null;
  }

  function findSemanticReservation(fingerprint, reservationWorkspace, outputPath = null) {
    const expected = text(fingerprint);
    if (!expected) return null;
    const expectedWorkspace = pathKey(reservationWorkspace);
    const expectedPath = outputPath ? pathKey(outputPath) : null;
    for (const entry of reservations.values()) {
      if (entry.taskFingerprint !== expected || pathKey(entry.workspaceRoot) !== expectedWorkspace) continue;
      if (expectedPath && pathKey(entry.outputPath) !== expectedPath) continue;
      return entry;
    }
    return null;
  }

  function acquireSharedReservation(entry) {
    entry.references = Math.max(1, Number(entry.references) || 1) + 1;
    return { ...resultForReservation(entry, entry.generated), coalesced: true };
  }

  async function reserve(input = {}) {
    return serialize(async () => {
      const requested = text(input.outputPath);
      const ownerId = text(input.reservationId ?? input.ownerId) || randomUUID();
      const existingOwner = findByOwner(ownerId);
      if (existingOwner && !requested) return resultForReservation(existingOwner, existingOwner.generated);
      const reservationWorkspace = normalizedWorkspace(input.workspaceRoot || workspaceRoot);

      const jobs = await queryJobs();
      const live = collectLiveDocumentOutputDetails(jobs, workspaceRoot);
      if (requested) {
        const outputPath = canonicalDocumentOutputPath(requested, input.workspaceRoot || workspaceRoot);
        const shared = input.coalesceSemanticTask === true && !existingOwner
          ? findSemanticReservation(input.taskFingerprint, reservationWorkspace, outputPath)
          : null;
        if (shared) return acquireSharedReservation(shared);
        const semanticJob = input.allowExistingOutputForDuplicate === true
          ? matchingSemanticJob(jobs, input.taskFingerprint, outputPath)
          : null;
        const conflicts = [];
        if (await existing(outputPath) && input.allowOverwrite !== true && !semanticJob) conflicts.push({ kind: "disk", path: outputPath });
        const liveEntry = live.get(pathKey(outputPath));
        if (liveEntry && liveEntry.jobId !== ownerId && liveEntry.jobId !== semanticJob?.id) {
          conflicts.push({ kind: "live-job", path: outputPath, jobId: liveEntry.jobId, status: liveEntry.status });
        }
        const held = localConflict(outputPath, ownerId);
        if (held) conflicts.push(held);
        if (conflicts.length > 0) {
          return {
            ok: false,
            requiresUserChoice: true,
            code: "output-path-conflict",
            error: "输出路径已被占用，请先处理同名文件或选择新的输出文件名。",
            outputPath,
            conflicts,
            decision: conflictDecision(conflicts),
          };
        }
        if (existingOwner && pathKey(existingOwner.outputPath) !== pathKey(outputPath)) {
          return {
            ok: false,
            requiresUserChoice: true,
            code: "output-path-conflict",
            error: "同一任务已经保留了其他输出路径，请继续使用原路径或新建任务。",
            outputPath,
            conflicts: [{ kind: "reservation", path: existingOwner.outputPath, reservationId: existingOwner.id }],
            decision: conflictDecision([{ kind: "reservation", path: existingOwner.outputPath, reservationId: existingOwner.id }]),
          };
        }
        if (existingOwner) return resultForReservation(existingOwner, existingOwner.generated);
        const entry = {
          id: ownerId,
          outputPath,
          generated: false,
          jobId: null,
          taskFingerprint: text(input.taskFingerprint) || null,
          workspaceRoot: reservationWorkspace,
          references: 1,
        };
        reservations.set(pathKey(outputPath), entry);
        return resultForReservation(entry, false);
      }

      const shared = input.coalesceSemanticTask === true
        ? findSemanticReservation(input.taskFingerprint, reservationWorkspace)
        : null;
      if (shared) return acquireSharedReservation(shared);
      const stem = `${safeTitle(input.sourceTitle)}-整理`;
      for (let index = 1; index <= maxCandidates; index++) {
        const suffix = index === 1 ? "" : ` (${index})`;
        const outputPath = canonicalDocumentOutputPath(`${stem}${suffix}${defaultExtension}`, input.workspaceRoot || workspaceRoot);
        if (await existing(outputPath)) continue;
        if (live.has(pathKey(outputPath))) continue;
        if (localConflict(outputPath, ownerId)) continue;
        const entry = {
          id: ownerId,
          outputPath,
          generated: true,
          jobId: null,
          taskFingerprint: text(input.taskFingerprint) || null,
          workspaceRoot: reservationWorkspace,
          references: 1,
        };
        reservations.set(pathKey(outputPath), entry);
        return resultForReservation(entry, true);
      }
      throw new Error(`unable to reserve a document output path after ${maxCandidates} candidates`);
    });
  }

  function bind(reservationId, jobId) {
    const entry = findByOwner(reservationId);
    if (!entry) return { ok: false, error: "document output reservation not found" };
    const id = text(jobId);
    if (id) {
      entry.jobId = id;
      aliases.set(id, entry.id);
    }
    return resultForReservation(entry, entry.generated);
  }

  function release(id, { force = false } = {}) {
    const entry = findByOwner(id);
    if (!entry) return { ok: true, released: false, reservationId: null, outputPath: null };
    if (!force && Number(entry.references) > 1) {
      entry.references--;
      return { ok: true, released: false, retained: true, reservationId: entry.id, outputPath: entry.outputPath };
    }
    reservations.delete(pathKey(entry.outputPath));
    aliases.delete(entry.id);
    if (entry.jobId) aliases.delete(entry.jobId);
    return { ok: true, released: true, reservationId: entry.id, outputPath: entry.outputPath };
  }

  function releaseTerminal(jobOrId, maybeStatus) {
    const job = jobOrId && typeof jobOrId === "object" ? jobOrId : null;
    const status = normalizedStatus(job ?? maybeStatus);
    if (!TERMINAL_DOCUMENT_JOB_STATUSES.has(status)) {
      return { ok: true, released: false, reason: "not-terminal", status };
    }
    if (!job) return release(text(jobOrId), { force: true });
    const primary = text(job.id ?? job.documentJobId);
    const released = release(primary, { force: true });
    if (released.released || !text(job.reservationId)) return released;
    return release(job.reservationId, { force: true });
  }

  function reservedPaths() {
    return new Set([...reservations.values()].map((entry) => entry.outputPath));
  }

  async function liveOutputPaths() {
    return new Set(collectLiveDocumentOutputDetails(await queryJobs(), workspaceRoot).values().map((entry) => entry.path));
  }

  return {
    workspaceRoot,
    reserve,
    bind,
    release,
    releaseTerminal,
    reservedPaths,
    liveOutputPaths,
    isReserved: (path) => reservations.has(pathKey(canonicalDocumentOutputPath(path, workspaceRoot))),
    getReservation: (id) => {
      const entry = findByOwner(id);
      return entry ? { ...entry } : null;
    },
  };
}
