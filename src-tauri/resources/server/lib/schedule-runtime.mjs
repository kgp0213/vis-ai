import {
  createScheduleRunRegistry,
  createScheduleTriggerQueue,
  DEFAULT_SCHEDULE_RUN_TIMEOUT_MS,
  normalizeScheduleRunTimeoutMs,
} from "./schedule-execution.mjs";

/**
 * Owns scheduler admission state, queueing and run watchdogs. Actual work is
 * injected by the Launcher through the existing submitPrompt callback.
 */
export function createScheduleRuntime({
  getTimeoutMs = () => DEFAULT_SCHEDULE_RUN_TIMEOUT_MS,
  onTimeout = () => {},
  maxConcurrent = 1,
  createRegistry = createScheduleRunRegistry,
  createQueue = createScheduleTriggerQueue,
} = {}) {
  const registry = createRegistry({
    defaultTimeoutMs: normalizeScheduleRunTimeoutMs(getTimeoutMs(), { fallbackMs: DEFAULT_SCHEDULE_RUN_TIMEOUT_MS }),
    onTimeout,
  });
  const queue = createQueue();

  return {
    maxConcurrent,
    queue,
    registry,
    cancel: (taskId) => registry.requestCancel(taskId),
    hasQueued: (taskId) => queue.has(taskId),
    isRunning: (taskId) => registry.isRunning(taskId),
    runningCount: () => registry.size(),
    queuedCount: () => queue.size(),
  };
}
