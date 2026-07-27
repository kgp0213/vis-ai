import { redactToolProgressValue } from "./tool-progress.mjs";

const TASK_ID_RE = /^bg-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const TERMINAL_STATUSES = new Set(["completed", "failed", "timed_out", "killed", "lost", "unknown"]);
const DEFAULT_TAIL_LINES = 80;

function finiteInteger(value, fallback = null) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}

function optionalString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function safeVisibleText(value, maxText = 4000, preserveLength = false) {
  return typeof value === "string"
    ? redactToolProgressValue(value, { maxText, preserveLength })
    : value;
}

function taskStatus(task) {
  if (typeof task?.status === "string" && task.status.length > 0) return task.status;
  if (task?.running === true) return "running";
  if (Number(task?.exitCode) === 0) return "completed";
  if (task?.spawnError) return "failed";
  return "unknown";
}

function terminalReason(status, task) {
  switch (status) {
    case "timed_out": return "timed_out";
    case "killed": return task?.stopReason ? "stopped" : "killed";
    case "failed": return "failed";
    case "lost": return "lost";
    case "unknown": return "unknown";
    default: return null;
  }
}

function retrievalStatus(status, block) {
  if (TERMINAL_STATUSES.has(status)) return "success";
  return block === true ? "timeout" : "not_ready";
}

function tailByLines(value, lineLimit) {
  const text = String(value ?? "");
  const limit = finiteInteger(lineLimit, DEFAULT_TAIL_LINES);
  if (limit === null || limit <= 0) return text;
  const lines = text.split("\n");
  if (lines.length <= limit) return text;
  return lines.slice(-limit).join("\n");
}

/**
 * Accept both the legacy numeric JobRegistry id and the durable bg-* id.
 * The durable form is intentionally opaque and path-safe.
 */
export function normalizeBackgroundTaskReference(value) {
  if (Number.isSafeInteger(value) && value >= 0) return { kind: "job", jobId: value };
  const text = String(value ?? "").trim();
  if (/^\d+$/u.test(text)) {
    const jobId = Number(text);
    return Number.isSafeInteger(jobId) ? { kind: "job", jobId } : null;
  }
  if (TASK_ID_RE.test(text)) return { kind: "task", taskId: text };
  return null;
}

function baseTaskProjection(task, reference) {
  const status = taskStatus(task);
  const projected = {
    taskId: optionalString(task?.taskId) ?? (reference?.kind === "task" ? reference.taskId : null),
    jobId: finiteInteger(task?.jobId, reference?.kind === "job" ? reference.jobId : null),
    status,
    running: task?.running === true,
    retrievalStatus: retrievalStatus(status, false),
    terminalReason: terminalReason(status, task),
  };
  for (const key of ["lifecycle", "pid", "exitCode"]) {
    if (task?.[key] !== undefined && task?.[key] !== null) projected[key] = task[key];
  }
  for (const key of ["command", "spawnError", "stopReason"]) {
    if (task?.[key] !== undefined && task?.[key] !== null) projected[key] = safeVisibleText(String(task[key]), 1200);
  }
  return projected;
}

/**
 * Project one live or persisted task into the model-facing contract.
 * Workspace/session fields are deliberately excluded even when supplied by
 * the local persistence record.
 */
export function projectTaskOutput({ task = {}, window = {}, reference = null, since = undefined, tailLines = DEFAULT_TAIL_LINES, block = false, fullOutputAvailable = undefined } = {}) {
  const status = taskStatus(task);
  const sinceOffset = finiteInteger(since, null);
  const rawSource = String(window.content ?? "");
  const raw = safeVisibleText(rawSource, rawSource.length, true);
  const output = sinceOffset === null ? tailByLines(raw, tailLines) : raw;
  const totalBytes = Math.max(
    0,
    finiteInteger(window.totalBytes, finiteInteger(task.outputBytes, finiteInteger(task.byteLength, Buffer.byteLength(raw, "utf8")))) ?? 0,
  );
  const offsetBytes = Math.max(0, finiteInteger(window.offsetBytes, sinceOffset ?? 0) ?? 0);
  const nextOffsetBytes = Math.max(offsetBytes, finiteInteger(window.nextOffsetBytes, offsetBytes + Buffer.byteLength(raw, "utf8")) ?? offsetBytes);
  const lineTrimmed = sinceOffset === null && output !== raw;
  const outputTruncated = task.outputTruncated === true || lineTrimmed || (sinceOffset === null && offsetBytes > 0);
  const result = {
    ok: true,
    ...baseTaskProjection(task, reference),
    retrievalStatus: retrievalStatus(status, block),
    outputSizeBytes: totalBytes,
    outputPreviewBytes: Buffer.byteLength(output, "utf8"),
    outputTruncated,
    outputGapDetected: task.outputGapDetected === true,
    fullOutputAvailable: fullOutputAvailable ?? totalBytes > 0,
    offsetBytes,
    nextOffsetBytes,
    complete: window.complete === true || nextOffsetBytes >= totalBytes,
    output,
  };
  if (block === true && status === "running") {
    result.nextStep = "任务仍在运行；不要重复阻塞等待，继续其他工作或等待完成通知。";
  }
  return result;
}

export function formatTaskOutputText(result) {
  const { output, ...facts } = result ?? {};
  return [JSON.stringify(facts), "[output]", output || "[no output available]"].join("\n");
}

/** Project durable and live task metadata without leaking local workspace paths. */
export function projectBackgroundTaskList(tasks = []) {
  return tasks.map((task) => {
    const status = taskStatus(task);
    const row = {
      taskId: optionalString(task?.taskId),
      jobId: finiteInteger(task?.jobId, null),
      command: optionalString(safeVisibleText(task?.command, 1200)),
      status,
      running: task?.running === true,
      outputSizeBytes: Math.max(0, finiteInteger(task?.outputBytes, finiteInteger(task?.byteLength, 0)) ?? 0),
      outputTruncated: task?.outputTruncated === true,
      outputGapDetected: task?.outputGapDetected === true,
    };
    if (row.taskId === null) delete row.taskId;
    if (row.jobId === null) delete row.jobId;
    if (row.command === null) delete row.command;
    if (task?.lifecycle !== undefined && task?.lifecycle !== null) row.lifecycle = task.lifecycle;
    if (task?.pid !== undefined && task?.pid !== null) row.pid = task.pid;
    return row;
  });
}

export { DEFAULT_TAIL_LINES, TASK_ID_RE };
