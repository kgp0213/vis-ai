export function createScheduleRunRegistry({ createController = () => new AbortController() } = {}) {
  const active = new Map();

  function start(taskId, runId) {
    if (!taskId || !runId) throw new TypeError("taskId and runId are required");
    if (active.has(taskId)) return null;
    const entry = { runId, controller: createController() };
    active.set(taskId, entry);
    return entry;
  }

  function requestCancel(taskId) {
    const entry = active.get(taskId);
    if (!entry) return null;
    entry.controller.abort();
    return entry;
  }

  return {
    finish: (taskId) => active.delete(taskId),
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

export function repairInterruptedSchedule(task, { nowIso = new Date().toISOString(), nextRunAt = null } = {}) {
  if (!task || task.lastStatus !== "running") return false;
  const reason = "interrupted by launcher restart";
  const runningEntry = Array.isArray(task.history) ? task.history.find((entry) => entry?.status === "running") : null;
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
