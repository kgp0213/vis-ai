import { open, readdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { atomicWriteFile } from "./atomic-file.mjs";
import { utf8SafePrefixLength } from "./utf8-range.mjs";

const TASK_ID_RE = /^bg-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const TASK_STATUSES = new Set(["running", "completed", "failed", "timed_out", "killed", "lost", "unknown"]);
const DEFAULT_MAX_READ_BYTES = 64_000;
const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;

function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function finiteInteger(value, fallback = null) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}

function safeTaskId(value) {
  const taskId = text(value);
  if (!TASK_ID_RE.test(taskId)) throw new TypeError(`invalid task id: ${taskId || "<empty>"}`);
  return taskId;
}

function statusFor(input) {
  const explicit = text(input.status).toLowerCase();
  if (TASK_STATUSES.has(explicit)) return explicit;
  if (input.running === true) return "running";
  const reason = text(input.stopReason).toLowerCase();
  if (reason.includes("timeout") || reason.includes("timed_out")) return "timed_out";
  if (reason) return "killed";
  if (input.spawnError || (input.exitCode !== null && input.exitCode !== undefined && Number(input.exitCode) !== 0)) return "failed";
  if (Number(input.exitCode) === 0) return "completed";
  return "unknown";
}

function normalizeRecord(input, now, previous = null) {
  const taskId = safeTaskId(input.taskId ?? previous?.taskId);
  const hasStatusSignal = input.status !== undefined
    || input.running !== undefined
    || input.exitCode !== undefined
    || input.stopReason !== undefined
    || input.spawnError !== undefined;
  const status = hasStatusSignal ? statusFor(input) : (previous?.status ?? statusFor(input));
  const running = status === "running";
  const output = typeof input.output === "string" ? input.output : null;
  const observedOutputBytes = output === null ? previous?.outputBytes ?? 0 : Buffer.byteLength(output, "utf8");
  const outputBytes = output === null
    ? previous?.outputBytes ?? 0
    : finiteInteger(input.storedOutputBytes, observedOutputBytes) ?? observedOutputBytes;
  const reportedBytes = Math.max(observedOutputBytes, finiteInteger(input.totalBytesWritten, previous?.reportedBytes ?? observedOutputBytes) ?? observedOutputBytes);
  const outputTruncated = input.outputTruncated === true
    || previous?.outputTruncated === true
    || (output?.includes("older output dropped") ?? false)
    || reportedBytes > outputBytes;
  const startedAt = input.startedAt ?? previous?.startedAt ?? now;
  const endedAt = running ? null : (input.endedAt ?? previous?.endedAt ?? now);
  const lifecycle = text(input.lifecycle, previous?.lifecycle || "task");
  return {
    schemaVersion: 1,
    taskId,
    jobId: input.jobId ?? previous?.jobId ?? null,
    operationId: previous?.operationId ?? input.operationId ?? null,
    sessionId: previous?.sessionId ?? input.sessionId ?? null,
    // Workspace is retained only in the local record. publicRecord omits it
    // so an absolute path cannot enter a Dashboard or model response.
    // A task's workspace is an immutable execution boundary. Once the first
    // snapshot records it, later polling must never replace it with the
    // launcher's current workspace after a session switch.
    workspace: previous?.workspace ?? input.workspace ?? null,
    lifecycle,
    status,
    running,
    command: input.command ?? previous?.command ?? null,
    pid: finiteInteger(input.pid, previous?.pid ?? null),
    exitCode: input.exitCode ?? previous?.exitCode ?? null,
    spawnError: input.spawnError ?? previous?.spawnError ?? null,
    stopReason: input.stopReason ?? previous?.stopReason ?? null,
    startedAt,
    endedAt,
    reportedBytes,
    outputBytes,
    outputTruncated,
    outputResourceId: `task-output:${taskId}`,
    updatedAt: input.updatedAt ?? now,
  };
}

function recordMatchesScope(record, { workspace = undefined, sessionId = undefined } = {}) {
  if (workspace !== undefined && String(record?.workspace ?? "") !== String(workspace ?? "")) return false;
  if (sessionId !== undefined && String(record?.sessionId ?? "") !== String(sessionId ?? "")) return false;
  return true;
}

function publicRecord(record, { id = undefined } = {}) {
  if (!record) return null;
  const { workspace: _workspace, ...safe } = record;
  return {
    ...safe,
    id: id ?? safe.jobId ?? safe.taskId,
    active: safe.running === true,
    needsAttention: ["failed", "timed_out", "killed", "lost", "unknown"].includes(safe.status),
  };
}

function recordPath(tasksRoot, taskId) {
  return resolve(tasksRoot, `${safeTaskId(taskId)}.json`);
}

function outputPath(tasksRoot, taskId) {
  return resolve(tasksRoot, `${safeTaskId(taskId)}.log`);
}

async function readRecord(tasksRoot, taskId) {
  const path = recordPath(tasksRoot, taskId);
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    if (!value || typeof value !== "object" || value.taskId !== taskId) return null;
    return value;
  } catch {
    return null;
  }
}

async function listRecords(tasksRoot) {
  let entries;
  try {
    entries = await readdir(tasksRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const records = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const taskId = entry.name.slice(0, -5);
    if (!TASK_ID_RE.test(taskId)) continue;
    const record = await readRecord(tasksRoot, taskId);
    if (record) records.push(record);
  }
  return records.sort((left, right) => String(right.updatedAt ?? right.startedAt ?? "").localeCompare(String(left.updatedAt ?? left.startedAt ?? "")));
}

async function readWindow(tasksRoot, taskId, offsetBytes, maxBytes) {
  const path = outputPath(tasksRoot, taskId);
  const start = Math.max(0, finiteInteger(offsetBytes, 0) ?? 0);
  const limit = Math.max(1, Math.min(DEFAULT_MAX_READ_BYTES, finiteInteger(maxBytes, 24_000) ?? 24_000));
  let handle;
  try {
    handle = await open(path, "r");
  } catch {
    return { offsetBytes: start, nextOffsetBytes: start, totalBytes: 0, content: "", complete: true, eof: true };
  }
  try {
    const size = (await handle.stat()).size;
    if (start >= size) return { offsetBytes: start, nextOffsetBytes: start, totalBytes: size, content: "", complete: true, eof: true };
    const buffer = Buffer.allocUnsafe(Math.min(size - start, limit + 3));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    const safeBytes = bytesRead > 0 ? Math.min(bytesRead, utf8SafePrefixLength(buffer.subarray(0, bytesRead), limit)) : 0;
    const nextOffsetBytes = start + safeBytes;
    return {
      offsetBytes: start,
      nextOffsetBytes,
      totalBytes: size,
      content: buffer.subarray(0, safeBytes).toString("utf8"),
      complete: nextOffsetBytes >= size,
      eof: nextOffsetBytes >= size,
    };
  } finally {
    await handle.close();
  }
}

/**
 * Durable, bounded background-task facts and output windows.
 *
 * This is deliberately a persistence adapter only. It never starts, waits
 * for, or stops a process; the existing JobRegistry remains the sole process
 * and model-loop owner.
 */
export function createTaskOutputStore({ rootDir, now = () => new Date().toISOString(), maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES } = {}) {
  if (!rootDir) throw new TypeError("task output root is required");
  const tasksRoot = resolve(rootDir, "tasks");
  const outputLimit = Math.max(1, Math.min(4 * 1024 * 1024, Number(maxOutputBytes) || DEFAULT_MAX_OUTPUT_BYTES));
  let writeQueue = Promise.resolve();

  const enqueue = (work) => {
    const next = writeQueue.then(work);
    writeQueue = next.catch(() => {});
    return next;
  };

  const save = (input = {}) => enqueue(async () => {
    const taskId = safeTaskId(input.taskId);
    const previous = await readRecord(tasksRoot, taskId);
    let outputBuffer = null;
    let nextInput = input;
    if (typeof input.output === "string") {
      const bytes = Buffer.from(input.output, "utf8");
      const start = bytes.length > outputLimit ? bytes.length - outputLimit : 0;
      let safeStart = start;
      while (safeStart < bytes.length && (bytes[safeStart] & 0xc0) === 0x80) safeStart += 1;
      outputBuffer = bytes.subarray(safeStart);
      nextInput = {
        ...input,
        storedOutputBytes: outputBuffer.length,
        outputTruncated: input.outputTruncated === true || safeStart > 0,
      };
    }
    const record = normalizeRecord(nextInput, now(), previous);
    // Commit output before metadata. If metadata replacement is interrupted,
    // the next periodic save repairs it; metadata never advertises output
    // that failed to reach disk.
    if (outputBuffer) await atomicWriteFile(outputPath(tasksRoot, taskId), outputBuffer);
    await atomicWriteFile(recordPath(tasksRoot, taskId), `${JSON.stringify(record, null, 2)}\n`, "utf8");
    return publicRecord(record);
  });

  const list = async (scope = {}) => {
    await writeQueue;
    return (await listRecords(tasksRoot))
      .filter((record) => recordMatchesScope(record, scope))
      .map(publicRecord);
  };

  const get = async (taskId, { id = undefined, workspace = undefined, sessionId = undefined } = {}) => {
    const safeId = safeTaskId(taskId);
    await writeQueue;
    const record = await readRecord(tasksRoot, safeId);
    if (!record || !recordMatchesScope(record, { workspace, sessionId })) return null;
    let outputTail = "";
    try { outputTail = await readFile(outputPath(tasksRoot, safeId), "utf8"); } catch {}
    return { ...publicRecord(record, { id: id ?? safeId }), outputTail };
  };

  const getByJobId = async (jobId, scope = {}) => {
    await writeQueue;
    const records = (await listRecords(tasksRoot)).filter((record) => recordMatchesScope(record, scope));
    const match = records.find((record) => String(record.jobId ?? "") === String(jobId ?? ""));
    return match ? get(match.taskId, { id: match.jobId ?? match.taskId, ...scope }) : null;
  };

  const read = async (taskId, options = {}) => {
    const safeId = safeTaskId(taskId);
    await writeQueue;
    const record = await readRecord(tasksRoot, safeId);
    if (!record) return { ok: false, taskId: safeId, error: "task output not found" };
    return { ok: true, taskId: safeId, ...record, ...await readWindow(tasksRoot, safeId, options.offsetBytes, options.maxBytes) };
  };

  const recoverRunning = (reason = "process_restarted") => enqueue(async () => {
    const records = await listRecords(tasksRoot);
    const tasks = [];
    for (const record of records) {
      if (record.status !== "running" && record.running !== true) {
        tasks.push(publicRecord(record));
        continue;
      }
      const next = normalizeRecord({
        ...record,
        status: "lost",
        running: false,
        stopReason: text(reason, "process_restarted"),
        endedAt: now(),
        updatedAt: now(),
      }, now(), record);
      await atomicWriteFile(recordPath(tasksRoot, record.taskId), `${JSON.stringify(next, null, 2)}\n`, "utf8");
      tasks.push(publicRecord(next));
    }
    return { updated: tasks.filter((task) => task.status === "lost" && task.stopReason === text(reason, "process_restarted")).length, tasks };
  });

  const remove = (taskId, scope = {}) => enqueue(async () => {
    const safeId = safeTaskId(taskId);
    const record = await readRecord(tasksRoot, safeId);
    if (!record || !recordMatchesScope(record, scope)) {
      return { ok: false, taskId: safeId, error: "task output not found" };
    }
    await rm(recordPath(tasksRoot, safeId), { force: true });
    await rm(outputPath(tasksRoot, safeId), { force: true });
    return { ok: true, taskId: safeId };
  });

  return {
    rootDir: tasksRoot,
    save,
    list,
    get,
    getByJobId,
    read,
    recoverRunning,
    remove,
    flush: () => writeQueue,
  };
}

export { DEFAULT_MAX_OUTPUT_BYTES, DEFAULT_MAX_READ_BYTES, TASK_ID_RE, safeTaskId };
