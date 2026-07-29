import { redactToolProgressValue } from "./tool-progress.mjs";

const TERMINAL_STATUSES = new Set(["completed", "failed", "timed_out", "killed", "lost", "unknown"]);
const MAX_PENDING = 32;
const MAX_OUTPUT_PREVIEW = 2400;

function text(value, max = 400) {
  const result = String(value ?? "").trim();
  return result ? result.slice(0, max) : null;
}

function clone(value) {
  try { return structuredClone(value); } catch { return { ...value }; }
}

function normalizeWorkspace(value) {
  const result = text(value, 1_000);
  return result ? result.replace(/\\/g, "/").replace(/\/+$/u, "").toLowerCase() : null;
}

function sameWorkspace(left, right) {
  if (!left || !right) return true;
  return normalizeWorkspace(left) === normalizeWorkspace(right);
}

export function deriveBackgroundTaskStatus(job = {}) {
  const explicit = text(job.status, 80)?.toLowerCase();
  if (TERMINAL_STATUSES.has(explicit)) return explicit;
  if (job.running === true) return "running";
  const reason = text(job.stopReason, 240)?.toLowerCase() || "";
  if (reason.includes("timeout") || reason.includes("timed_out")) return "timed_out";
  if (job.spawnError) return "failed";
  if (job.exitCode !== null && job.exitCode !== undefined) return Number(job.exitCode) === 0 ? "completed" : "failed";
  return "unknown";
}

export const PROCESS_RESTARTED_STOP_REASON = "process_restarted";

// A task marked lost by crash recovery carries the dead operation's binding.
// The claim filter pins delivery to sourceOperationId, so such a notification
// could never be claimed by any post-restart operation.
export function isProcessRestartedRecovery(record = {}) {
  return text(record.stopReason, 240) === PROCESS_RESTARTED_STOP_REASON
    && text(record.status, 80)?.toLowerCase() === "lost";
}

// Decide the enqueue scope for a persisted terminal fact. Restart-recovered
// lost notifications are rebound to the live operation of the same session and
// workspace; every other fact keeps its original operation binding so the
// cross-operation leak guard stays intact.
export function notificationEnqueueScope(persisted = {}, scope = {}) {
  const operationId = isProcessRestartedRecovery(persisted)
    ? text(scope.operationId, 180)
    : (text(persisted.operationId, 180) ?? text(scope.operationId, 180));
  return {
    operationId,
    sessionId: scope.sessionId ?? null,
    workspace: scope.workspace ?? null,
  };
}

function notificationId(taskId, status) {
  return `task:${taskId}:${status}`;
}

function normalizeNotification(raw = {}, scope = {}, now) {
  const taskId = text(raw.taskId, 180) || (raw.jobId !== null && raw.jobId !== undefined ? `job-${String(raw.jobId).slice(0, 80)}` : null);
  if (!taskId) return null;
  const status = deriveBackgroundTaskStatus(raw);
  if (!TERMINAL_STATUSES.has(status)) return null;
  const id = notificationId(taskId, status);
  const output = redactToolProgressValue(String(raw.outputTail ?? raw.output ?? ""), { maxText: MAX_OUTPUT_PREVIEW });
  return {
    notificationId: id,
    taskId,
    jobId: Number.isSafeInteger(Number(raw.jobId ?? raw.id)) ? Number(raw.jobId ?? raw.id) : null,
    status,
    lifecycle: text(raw.lifecycle, 40) || "task",
    command: text(redactToolProgressValue(raw.command ?? "", { maxText: 600 }), 600),
    exitCode: raw.exitCode === null || raw.exitCode === undefined ? null : Number.isFinite(Number(raw.exitCode)) ? Number(raw.exitCode) : null,
    spawnError: text(redactToolProgressValue(raw.spawnError ?? "", { maxText: 500 }), 500),
    stopReason: text(redactToolProgressValue(raw.stopReason ?? "", { maxText: 500 }), 500),
    outputTail: text(output, MAX_OUTPUT_PREVIEW),
    outputBytes: Number.isFinite(Number(raw.outputBytes ?? raw.totalBytesWritten)) ? Math.max(0, Number(raw.outputBytes ?? raw.totalBytesWritten)) : 0,
    sessionId: text(scope.sessionId ?? raw.sessionId, 200),
    workspace: normalizeWorkspace(scope.workspace ?? raw.workspace),
    sourceOperationId: text(scope.operationId ?? raw.operationId, 180),
    createdAt: text(raw.endedAt ?? raw.updatedAt ?? raw.createdAt, 80) || now(),
  };
}

/**
 * Owns only terminal notification facts. It does not start a model request;
 * callers claim a fact at an existing model request boundary and acknowledge
 * it after the same ordinary loop has persisted the message.
 */
export function createBackgroundTaskNotificationRuntime({
  now = () => new Date().toISOString(),
  maxPending = MAX_PENDING,
} = {}) {
  const pending = new Map();
  const inFlight = new Map();
  const delivered = new Set();
  const overflowed = new Map();
  const pendingLimit = Math.max(1, Math.min(MAX_PENDING, Number(maxPending) || MAX_PENDING));
  const inFlightLimit = pendingLimit * 2;
  const deliveredLimit = pendingLimit * 4;

  function rememberDelivered(id) {
    delivered.delete(id);
    delivered.add(id);
    while (delivered.size > deliveredLimit) {
      delivered.delete(delivered.values().next().value);
    }
  }

  function enqueuePending(notification) {
    const id = notification.notificationId;
    if (pending.size >= pendingLimit && overflowed.size >= pendingLimit) return false;
    pending.set(id, notification);
    while (pending.size > pendingLimit) {
      const oldest = pending.keys().next().value;
      const droppedNotification = pending.get(oldest);
      pending.delete(oldest);
      if (droppedNotification) overflowed.set(oldest, droppedNotification);
    }
    return true;
  }

  function enqueue(raw = {}, scope = {}) {
    if (String(raw.lifecycle ?? "task").toLowerCase() === "service") {
      return { accepted: false, ignored: true, reason: "service" };
    }
    const notification = normalizeNotification(raw, scope, now);
    if (!notification) return { accepted: false, ignored: true, reason: "not_terminal" };
    const id = notification.notificationId;
    if (delivered.has(id) || pending.has(id) || inFlight.has(id) || overflowed.has(id)) {
      return { accepted: false, duplicate: true, notification: clone(notification) };
    }
    if (pending.size >= pendingLimit && overflowed.size >= pendingLimit) {
      return {
        accepted: false,
        overflow: {
          count: 1,
          notificationIds: [id],
          durableRecoveryRequired: true,
        },
      };
    }
    const dropped = [];
    const pendingBefore = new Set(pending.keys());
    enqueuePending(notification);
    for (const oldest of pendingBefore) {
      if (!pending.has(oldest)) {
        const droppedNotification = overflowed.get(oldest);
        if (droppedNotification) dropped.push(clone(droppedNotification));
      }
    }
    return {
      accepted: true,
      notification: clone(notification),
      ...(dropped.length > 0 ? {
        overflow: {
          count: dropped.length,
          notificationIds: dropped.map((item) => item.notificationId),
        },
      } : {}),
    };
  }

  function claim({ operationId = null, sessionId = null, workspace = null, limit = 4 } = {}) {
    const claimed = [];
    // A claimed notification remains in memory until the model persists and
    // acknowledges it. Bound that in-flight set as well as pending/overflowed
    // so a stalled model boundary cannot turn repeated claims into an
    // unbounded notification queue.
    const available = Math.max(0, inFlightLimit - inFlight.size);
    if (available === 0) return claimed;
    const max = Math.min(available, Math.max(1, Math.min(8, Number(limit) || 4)));
    const deliveryOperationId = text(operationId, 180);
    const expectedSessionId = text(sessionId, 200);
    const expectedWorkspace = normalizeWorkspace(workspace);
    const matchesScope = (notification) => {
      if (expectedSessionId && notification.sessionId !== expectedSessionId) return false;
      if (expectedWorkspace && notification.workspace !== expectedWorkspace) return false;
      return true;
    };
    for (const [id, notification] of pending) {
      if (claimed.length >= max) break;
      if (!matchesScope(notification)) continue;
      pending.delete(id);
      const delivery = { ...notification, deliveryOperationId };
      inFlight.set(id, delivery);
      claimed.push(clone(delivery));
    }
    for (const [id, notification] of overflowed) {
      if (claimed.length >= max) break;
      if (!matchesScope(notification)) continue;
      overflowed.delete(id);
      const delivery = { ...notification, deliveryOperationId };
      inFlight.set(id, delivery);
      claimed.push(clone(delivery));
    }
    return claimed;
  }

  function acknowledge(id) {
    const key = text(id, 240);
    if (!key) return false;
    const notification = inFlight.get(key);
    if (!notification) return delivered.has(key);
    inFlight.delete(key);
    rememberDelivered(key);
    return true;
  }

  function release(id) {
    const key = text(id, 240);
    const notification = key ? inFlight.get(key) : null;
    if (!notification) return false;
    if (!enqueuePending(notification)) return false;
    inFlight.delete(key);
    return true;
  }

  function restoreDelivered(entries = []) {
    for (const entry of Array.isArray(entries) ? entries : []) {
      const id = text(entry?.backgroundTaskNotification?.notificationId ?? entry?.notificationId, 240);
      if (!id) continue;
      rememberDelivered(id);
      pending.delete(id);
      inFlight.delete(id);
      overflowed.delete(id);
    }
  }

  function snapshot() {
    return {
      pending: [...pending.values()].map(clone),
      inFlight: [...inFlight.values()].map(clone),
      delivered: [...delivered],
      overflowed: [...overflowed.values()].map(clone),
      overflowedCount: overflowed.size,
    };
  }

  return { enqueue, claim, acknowledge, release, restoreDelivered, snapshot };
}

export function formatBackgroundTaskNotification(notification = {}) {
  const status = text(notification.status, 80) || "unknown";
  const lines = [
    "[VISIONOX_BACKGROUND_TASK_NOTIFICATION]",
    `notificationId: ${text(notification.notificationId, 240) || "unknown"}`,
    `taskId: ${text(notification.taskId, 180) || "unknown"}`,
    `status: ${status}`,
    `exitCode: ${notification.exitCode ?? "unknown"}`,
  ];
  if (notification.command) lines.push(`command: ${String(notification.command)}`);
  if (notification.spawnError) lines.push(`spawnError: ${String(notification.spawnError)}`);
  if (notification.stopReason) lines.push(`stopReason: ${String(notification.stopReason)}`);
  if (notification.outputTail) lines.push(`outputPreview (${notification.outputBytes} bytes):\n${String(notification.outputTail)}`);
  lines.push(`Use job_output with taskId ${text(notification.taskId, 180) || "unknown"} to read more output; do not assume an incomplete or failed task produced the requested artifact.`);
  lines.push("[/VISIONOX_BACKGROUND_TASK_NOTIFICATION]");
  return lines.join("\n");
}

export { MAX_OUTPUT_PREVIEW };
