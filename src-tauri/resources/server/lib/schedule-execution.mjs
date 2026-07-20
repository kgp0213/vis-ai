export const DEFAULT_SCHEDULE_RUN_TIMEOUT_MS = 2 * 60 * 60 * 1000;
export const MIN_SCHEDULE_RUN_TIMEOUT_MS = 60 * 1000;
export const MAX_SCHEDULE_RUN_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export function normalizeScheduleRunTimeoutMs(value, {
  fallbackMs = DEFAULT_SCHEDULE_RUN_TIMEOUT_MS,
  minMs = MIN_SCHEDULE_RUN_TIMEOUT_MS,
  maxMs = MAX_SCHEDULE_RUN_TIMEOUT_MS,
} = {}) {
  const normalizedMin = Number.isFinite(Number(minMs)) ? Math.max(1, Math.floor(Number(minMs))) : MIN_SCHEDULE_RUN_TIMEOUT_MS;
  const normalizedMax = Number.isFinite(Number(maxMs)) ? Math.max(normalizedMin, Math.floor(Number(maxMs))) : MAX_SCHEDULE_RUN_TIMEOUT_MS;
  const fallback = Number.isFinite(Number(fallbackMs)) && Number(fallbackMs) > 0
    ? Math.max(normalizedMin, Math.min(normalizedMax, Math.floor(Number(fallbackMs))))
    : Math.max(normalizedMin, Math.min(normalizedMax, DEFAULT_SCHEDULE_RUN_TIMEOUT_MS));
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(normalizedMin, Math.min(normalizedMax, Math.floor(numeric)));
}

export function createScheduleRunRegistry({
  createController = () => new AbortController(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  onTimeout = () => {},
  defaultTimeoutMs = DEFAULT_SCHEDULE_RUN_TIMEOUT_MS,
  minTimeoutMs = MIN_SCHEDULE_RUN_TIMEOUT_MS,
  maxTimeoutMs = MAX_SCHEDULE_RUN_TIMEOUT_MS,
} = {}) {
  const active = new Map();
  const normalizedDefaultTimeoutMs = normalizeScheduleRunTimeoutMs(defaultTimeoutMs, {
    minMs: minTimeoutMs,
    maxMs: maxTimeoutMs,
  });

  function clearWatchdog(entry) {
    if (!entry || entry.timer === null || entry.timer === undefined) return;
    clearTimeoutFn(entry.timer);
    entry.timer = null;
  }

  function start(taskId, runId, options = {}) {
    if (!taskId || !runId) throw new TypeError("taskId and runId are required");
    if (active.has(taskId)) return null;
    const timeoutMs = normalizeScheduleRunTimeoutMs(options.timeoutMs, {
      fallbackMs: normalizedDefaultTimeoutMs,
      minMs: minTimeoutMs,
      maxMs: maxTimeoutMs,
    });
    const entry = { runId, controller: createController(), timeoutMs, timer: null, timedOut: false };
    active.set(taskId, entry);
    entry.timer = setTimeoutFn(() => {
      if (active.get(taskId) !== entry || String(entry.runId) !== String(runId)) return;
      entry.timer = null;
      entry.timedOut = true;
      active.delete(taskId);
      const error = Object.assign(new Error(`scheduled task exceeded run timeout (${timeoutMs}ms)`), {
        name: "ScheduleRunTimeoutError",
        code: "SCHEDULE_RUN_TIMEOUT",
        timeoutMs,
      });
      try {
        onTimeout({ taskId, runId, timeoutMs, entry, error });
      } finally {
        entry.controller.abort(error);
      }
    }, timeoutMs);
    entry.timer?.unref?.();
    return entry;
  }

  function requestCancel(taskId) {
    const entry = active.get(taskId);
    if (!entry) return null;
    entry.controller.abort();
    return entry;
  }

  return {
    finish: (taskId, runId = null) => {
      const entry = active.get(taskId);
      if (!entry) return false;
      if (runId !== null && String(entry.runId) !== String(runId)) return false;
      clearWatchdog(entry);
      return active.delete(taskId);
    },
    get: (taskId) => active.get(taskId) ?? null,
    isRunning: (taskId) => active.has(taskId),
    requestCancel,
    size: () => active.size,
    start,
  };
}

export function createScheduleTriggerQueue() {
  const pending = [];
  const byTaskId = new Map();

  function enqueue(taskId, options = {}) {
    if (!taskId) throw new TypeError("taskId is required");
    const existing = byTaskId.get(taskId);
    if (existing) {
      existing.manual ||= options.manual === true;
      existing.catchUp ||= options.catchUp === true;
      return { enqueued: false, duplicate: true, position: pending.indexOf(existing) + 1 };
    }
    const entry = {
      taskId,
      manual: options.manual === true,
      catchUp: options.catchUp === true,
      requestedAt: typeof options.requestedAt === "string" ? options.requestedAt : new Date().toISOString(),
    };
    pending.push(entry);
    byTaskId.set(taskId, entry);
    return { enqueued: true, duplicate: false, position: pending.length };
  }

  function remove(taskId) {
    const entry = byTaskId.get(taskId);
    if (!entry) return false;
    byTaskId.delete(taskId);
    const index = pending.indexOf(entry);
    if (index >= 0) pending.splice(index, 1);
    return true;
  }

  function shift() {
    const entry = pending.shift() ?? null;
    if (entry) byTaskId.delete(entry.taskId);
    return entry;
  }

  return {
    enqueue,
    has: (taskId) => byTaskId.has(taskId),
    position: (taskId) => {
      const entry = byTaskId.get(taskId);
      return entry ? pending.indexOf(entry) + 1 : 0;
    },
    remove,
    shift,
    size: () => pending.length,
  };
}

export function orderMissedSchedules(tasks = []) {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .map((task, index) => {
      const timestamp = Date.parse(task?.missedRunAt);
      return { task, index, timestamp: Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER };
    })
    .sort((left, right) => left.timestamp - right.timestamp || left.index - right.index)
    .map(({ task }) => task);
}

export function decideScheduleAdmission({
  task,
  manual = false,
  catchUp = false,
  isRunning = false,
  runningCount = 0,
  maxConcurrent = 2,
  workspaceMatches = true,
  windowCheck = { ok: true, reason: null },
} = {}) {
  if (isRunning) {
    return { kind: "already_running", accepted: false, reason: "task is already running", persist: !manual, retry: false };
  }
  if (runningCount >= maxConcurrent) {
    return {
      kind: "deferred",
      accepted: false,
      reason: `scheduled task concurrency limit reached (${maxConcurrent})`,
      persist: true,
      retry: true,
    };
  }
  const requiresBoundWorkspace = task?.kind === "prompt" && task?.workspaceScope !== "current";
  if (!workspaceMatches && requiresBoundWorkspace) {
    return { kind: "skipped", accepted: false, reason: "workspace mismatch", persist: true, retry: false };
  }
  if (!manual && !catchUp && windowCheck?.ok === false) {
    return { kind: "skipped", accepted: false, reason: windowCheck.reason || "outside run window", persist: true, retry: false };
  }
  if (task?.runMode === "confirm" && !manual) {
    return { kind: "pending_confirmation", accepted: false, reason: "waiting for manual confirmation", persist: true, retry: false };
  }
  return { kind: "start", accepted: true, reason: null, persist: true, retry: false };
}

export function decideRejectedScheduleSubmission({ manual = false, reason = "loop is busy" } = {}) {
  const retry = /busy/i.test(reason);
  return {
    status: retry ? "deferred" : manual ? "rejected" : "skipped",
    reason,
    retry,
  };
}

export function guardSessionCleanupDeletion({ names = [], semanticMode = "off", semanticError = null } = {}) {
  const uniqueNames = [];
  const seen = new Set();
  for (const value of Array.isArray(names) ? names : []) {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    uniqueNames.push(name);
  }

  const mode = typeof semanticMode === "string" ? semanticMode.trim().toLowerCase() : "off";
  const error = typeof semanticError === "string"
    ? semanticError.trim()
    : semanticError ? String(semanticError) : "";
  if (mode && mode !== "off" && error) {
    return {
      names: [],
      blocked: true,
      warning: `语义复核失败，已跳过会话删除：${error.slice(0, 500)}`,
    };
  }
  return { names: uniqueNames, blocked: false, warning: null };
}

export function classifyScheduleRunError(error, signal, fallback = "scheduled task failed") {
  const message = String(error?.message || error || fallback);
  const modelTimedOut = error?.code === "MODEL_REQUEST_TIMEOUT" || error?.name === "ModelRequestTimeoutError";
  const scheduleTimedOut = error?.code === "SCHEDULE_RUN_TIMEOUT" || signal?.reason?.code === "SCHEDULE_RUN_TIMEOUT";
  const cancelled = signal?.aborted === true && !modelTimedOut && !scheduleTimedOut;
  const reason = scheduleTimedOut
    ? `定时任务超过最长运行时间：${message}`
    : cancelled
    ? "cancelled by user"
    : modelTimedOut ? `模型请求超时：${message}` : message;
  return {
    cancelled,
    status: cancelled ? "cancelled" : "failed",
    reason,
    summary: reason,
  };
}

export function classifyScheduledSkillCompletion({ done, scheduledSkill = false, reportPath = null, reportError = null } = {}) {
  if (done?.cancelled) return { status: "cancelled", completed: false, retryable: false, reason: "cancelled by user" };
  if (done?.ok !== true) return { status: "failed", completed: false, retryable: true, reason: done?.error || "scheduled task failed" };
  if (reportError) return { status: "failed", completed: false, retryable: true, reason: reportError };
  if (scheduledSkill && !String(reportPath || "").trim()) {
    return { status: "failed", completed: false, retryable: true, reason: "scheduled Skill returned no content; no report was saved" };
  }
  return { status: "completed", completed: true, retryable: false, reason: null };
}

export function resolvePreviousSuccessfulSkillRunAt(history, skillName, skillAction) {
  const match = (Array.isArray(history) ? history : []).find((entry) => (
    entry?.status === "completed"
    && entry?.skillName === skillName
    && entry?.skillAction === skillAction
    && typeof entry?.startedAt === "string"
    && Number.isFinite(Date.parse(entry.startedAt))
    && typeof entry?.reportPath === "string"
    && entry.reportPath.trim()
  ));
  return match?.startedAt ?? null;
}

export function resolveScheduleRunWorkspace(task, currentWorkspace) {
  if (task?.kind === "report" || task?.skillName) return null;
  if (task?.kind === "prompt" && task?.workspaceScope === "current") return currentWorkspace ?? null;
  return task?.workspaceDir || currentWorkspace || null;
}

export function resolveStoredScheduleWorkspace({
  kind,
  previousWorkspace = null,
  currentWorkspace = null,
  rebind = false,
} = {}) {
  if (kind === "report") return null;
  if (rebind || !previousWorkspace) return currentWorkspace || null;
  return previousWorkspace;
}

export function shouldAcceptScheduleCompletion(task, runId) {
  const id = String(runId || "").trim();
  if (!id || !task || !Array.isArray(task.history)) return false;
  const entry = task.history.find((item) => String(item?.runId || "") === id);
  return entry?.status === "running" && !entry?.completedAt;
}

/**
 * A task history can briefly contain two `running` entries after a timeout,
 * cancellation, or a persisted retry.  The in-memory registry is the source
 * of truth for which run may still mutate task state; an older callback must
 * not set missedRunAt or overwrite the newer run's result.
 */
export function canAcceptScheduleCompletion(task, runId, { activeRunId = null, allowReleased = false } = {}) {
  const id = String(runId || "").trim();
  if (!id || !shouldAcceptScheduleCompletion(task, id)) return false;
  if (allowReleased) return activeRunId === null || activeRunId === undefined;
  return activeRunId !== null && activeRunId !== undefined && String(activeRunId).trim() === id;
}

export function repairInterruptedSchedule(task, { nowIso = new Date().toISOString(), nextRunAt = task?.nextRunAt ?? null } = {}) {
  if (!task) return false;
  const runningEntry = Array.isArray(task.history) ? task.history.find((entry) => entry?.status === "running") : null;
  if (task.lastStatus !== "running" && !(task.lastStatus === "stopping" && runningEntry)) return false;
  const reason = "interrupted by launcher restart";
  if (runningEntry) {
    const startedMs = Date.parse(runningEntry.startedAt);
    runningEntry.completedAt = nowIso;
    runningEntry.durationMs = Number.isFinite(startedMs) ? Math.max(0, Date.parse(nowIso) - startedMs) : null;
    runningEntry.status = "failed";
    runningEntry.accepted = false;
    runningEntry.reason ||= reason;
    runningEntry.summary ||= reason;
  }
  task.updatedAt = nowIso;
  task.lastStatus = "failed";
  task.lastError = reason;
  task.nextRunAt = nextRunAt;
  return true;
}

export function markScheduleCancellationRequested(task, nowIso = new Date().toISOString()) {
  if (!task) throw new TypeError("schedule task is required");
  task.lastStatus = "stopping";
  task.lastError = "cancellation requested";
  task.updatedAt = nowIso;
  return task;
}
