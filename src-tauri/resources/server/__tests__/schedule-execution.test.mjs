import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { canAcceptScheduleCompletion, classifyScheduledSkillCompletion, classifyScheduleRunError, createScheduleRunRegistry, createScheduleTriggerQueue, decideRejectedScheduleSubmission, decideScheduleAdmission, DEFAULT_SCHEDULE_RUN_TIMEOUT_MS, guardSessionCleanupDeletion, MAX_SCHEDULE_RUN_TIMEOUT_MS, MIN_SCHEDULE_RUN_TIMEOUT_MS, markScheduleCancellationRequested, normalizeScheduleRunTimeoutMs, orderMissedSchedules, repairInterruptedSchedule, resolvePreviousSuccessfulSkillRunAt, resolveScheduleRunWorkspace, resolveStoredScheduleWorkspace, shouldAcceptScheduleCompletion } from "../lib/schedule-execution.mjs";
import { readScheduleStore, writeScheduleStore } from "../lib/schedule-store.mjs";

const { dispatch } = await import(new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url).href);
const API_TOKEN = "schedule-test-token";

let tempRoot = null;
afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = null;
});

describe("schedule run registry", () => {
  test("registers one run per task and cancels the matching controller", () => {
    const registry = createScheduleRunRegistry();
    const first = registry.start("task-1", "run-1");
    assert.equal(registry.isRunning("task-1"), true);
    assert.equal(registry.size(), 1);
    assert.equal(registry.start("task-1", "run-2"), null);
    assert.equal(registry.requestCancel("task-1").runId, "run-1");
    assert.equal(first.controller.signal.aborted, true);
    assert.equal(registry.finish("task-1"), true);
    assert.equal(registry.requestCancel("task-1"), null);
  });

  test("a stale completion cannot remove a newer run for the same task", () => {
    const registry = createScheduleRunRegistry();
    registry.start("task-1", "run-new");

    assert.equal(registry.finish("task-1", "run-old"), false);
    assert.equal(registry.get("task-1")?.runId, "run-new");
    assert.equal(registry.finish("task-1", "run-new"), true);
    assert.equal(registry.get("task-1"), null);
  });

  test("watchdog aborts an overdue run, releases its slot, and rejects late completion", () => {
    const timers = new Map();
    let nextTimerId = 0;
    let timeoutEvent = null;
    const registry = createScheduleRunRegistry({
      defaultTimeoutMs: 1000,
      minTimeoutMs: 1,
      maxTimeoutMs: 10_000,
      setTimeoutFn: (callback, delay) => {
        const id = ++nextTimerId;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeoutFn: (id) => timers.delete(id),
      onTimeout: (event) => { timeoutEvent = event; },
    });
    const entry = registry.start("task-1", "run-1");
    assert.equal(registry.size(), 1);
    assert.equal(timers.size, 1);
    assert.equal([...timers.values()][0].delay, 1000);

    [...timers.values()][0].callback();

    assert.equal(entry.controller.signal.aborted, true);
    assert.equal(registry.size(), 0);
    assert.deepEqual({ taskId: timeoutEvent.taskId, runId: timeoutEvent.runId, timeoutMs: timeoutEvent.timeoutMs }, {
      taskId: "task-1",
      runId: "run-1",
      timeoutMs: 1000,
    });
    assert.equal(registry.finish("task-1", "run-1"), false);
  });

  test("a stale watchdog callback cannot abort a newer run", () => {
    const callbacks = [];
    let timeoutCount = 0;
    const registry = createScheduleRunRegistry({
      defaultTimeoutMs: 1000,
      minTimeoutMs: 1,
      maxTimeoutMs: 10_000,
      setTimeoutFn: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      clearTimeoutFn: () => {},
      onTimeout: () => { timeoutCount += 1; },
    });
    registry.start("task-1", "run-old");
    assert.equal(registry.finish("task-1", "run-old"), true);
    const current = registry.start("task-1", "run-new");

    callbacks[0]();

    assert.equal(timeoutCount, 0);
    assert.equal(current.controller.signal.aborted, false);
    assert.equal(registry.get("task-1")?.runId, "run-new");
    assert.equal(registry.finish("task-1", "run-new"), true);
  });

  test("normalizes configured run timeout to bounded values", () => {
    assert.equal(normalizeScheduleRunTimeoutMs(undefined), DEFAULT_SCHEDULE_RUN_TIMEOUT_MS);
    assert.equal(normalizeScheduleRunTimeoutMs(1), MIN_SCHEDULE_RUN_TIMEOUT_MS);
    assert.equal(normalizeScheduleRunTimeoutMs(Number.POSITIVE_INFINITY), DEFAULT_SCHEDULE_RUN_TIMEOUT_MS);
    assert.equal(normalizeScheduleRunTimeoutMs(Number.MAX_SAFE_INTEGER), MAX_SCHEDULE_RUN_TIMEOUT_MS);
  });
});

describe("schedule trigger queue", () => {
  test("keeps FIFO order and coalesces repeated triggers for the same task", () => {
    const queue = createScheduleTriggerQueue();
    assert.deepEqual(queue.enqueue("task-1", { manual: false, requestedAt: "2026-07-14T01:00:00.000Z" }), {
      enqueued: true,
      duplicate: false,
      position: 1,
    });
    assert.deepEqual(queue.enqueue("task-2", { manual: true, requestedAt: "2026-07-14T01:00:01.000Z" }), {
      enqueued: true,
      duplicate: false,
      position: 2,
    });
    assert.deepEqual(queue.enqueue("task-1", { manual: true, catchUp: true }), {
      enqueued: false,
      duplicate: true,
      position: 1,
    });
    assert.equal(queue.size(), 2);
    assert.equal(queue.position("task-2"), 2);
    assert.deepEqual(queue.shift(), {
      taskId: "task-1",
      manual: true,
      catchUp: true,
      requestedAt: "2026-07-14T01:00:00.000Z",
    });
    assert.equal(queue.has("task-1"), false);
    assert.equal(queue.remove("task-2"), true);
    assert.equal(queue.size(), 0);
  });

  test("restores missed triggers in original trigger order", () => {
    const tasks = [
      { id: "task-late", missedRunAt: "2026-07-14T02:00:00.000Z" },
      { id: "task-first", missedRunAt: "2026-07-14T01:00:00.000Z" },
      { id: "task-same-a", missedRunAt: "2026-07-14T01:30:00.000Z" },
      { id: "task-same-b", missedRunAt: "2026-07-14T01:30:00.000Z" },
    ];
    assert.deepEqual(orderMissedSchedules(tasks).map((task) => task.id), [
      "task-first",
      "task-same-a",
      "task-same-b",
      "task-late",
    ]);
    assert.deepEqual(tasks.map((task) => task.id), ["task-late", "task-first", "task-same-a", "task-same-b"]);
  });

  test("manual run API accepts a queued task instead of returning a conflict", async () => {
    const request = Readable.from([Buffer.from("{}")]);
    request.url = "/api/schedules/task-2/run";
    request.method = "POST";
    request.headers = { "x-reasonix-token": API_TOKEN, "content-type": "application/json" };
    let status = null;
    let body = null;
    const response = {
      writeHead(nextStatus) { status = nextStatus; },
      end(value) { body = value; },
    };
    await dispatch(request, response, {
      runScheduleNow: async () => ({
        ok: true,
        accepted: false,
        queued: true,
        queuePosition: 2,
        reason: "waiting for another scheduled task to finish",
        runId: null,
        schedule: { id: "task-2", lastStatus: "deferred" },
      }),
    }, API_TOKEN);
    assert.equal(status, 202);
    assert.deepEqual(JSON.parse(body), {
      ok: true,
      accepted: false,
      queued: true,
      queuePosition: 2,
      reason: "waiting for another scheduled task to finish",
      runId: null,
      schedule: { id: "task-2", lastStatus: "deferred" },
    });
  });
});

describe("schedule admission policy", () => {
  const task = { kind: "prompt", runMode: "auto" };

  test("prioritizes active and concurrency checks", () => {
    assert.equal(decideScheduleAdmission({ task, isRunning: true }).kind, "already_running");
    const deferred = decideScheduleAdmission({ task, manual: true, runningCount: 1, maxConcurrent: 1 });
    assert.deepEqual({ kind: deferred.kind, retry: deferred.retry, persist: deferred.persist }, { kind: "deferred", retry: true, persist: true });
  });

  test("applies workspace checks only to workspace-bound prompt tasks", () => {
    assert.equal(decideScheduleAdmission({ task, workspaceMatches: false }).kind, "skipped");
    assert.equal(decideScheduleAdmission({ task: { kind: "session_cleanup" }, workspaceMatches: false }).kind, "start");
    assert.equal(decideScheduleAdmission({ task: { kind: "report" }, workspaceMatches: false }).kind, "start");
    assert.equal(decideScheduleAdmission({ task: { kind: "prompt", workspaceScope: "current" }, workspaceMatches: false }).kind, "start");
  });

  test("preserves window and confirmation behavior", () => {
    assert.equal(decideScheduleAdmission({ task, windowCheck: { ok: false, reason: "outside" } }).reason, "outside");
    assert.equal(decideScheduleAdmission({ task, catchUp: true, windowCheck: { ok: false } }).kind, "start");
    assert.equal(decideScheduleAdmission({ task: { ...task, runMode: "confirm" } }).kind, "pending_confirmation");
    assert.equal(decideScheduleAdmission({ task: { ...task, runMode: "confirm" }, manual: true }).kind, "start");
  });

  test("classifies rejected prompt submissions without changing API statuses", () => {
    assert.deepEqual(decideRejectedScheduleSubmission({ reason: "loop is busy" }), { status: "deferred", reason: "loop is busy", retry: true });
    assert.deepEqual(decideRejectedScheduleSubmission({ manual: true, reason: "loop is busy" }), { status: "deferred", reason: "loop is busy", retry: true });
    assert.equal(decideRejectedScheduleSubmission({ reason: "permission denied" }).status, "skipped");
    assert.equal(decideRejectedScheduleSubmission({ manual: true, reason: "permission denied" }).status, "rejected");
  });
});

describe("session cleanup safety policy", () => {
  test("blocks destructive deletion when enabled semantic review fails", () => {
    assert.deepEqual(guardSessionCleanupDeletion({
      names: ["session-a", "session-b", "session-a"],
      semanticMode: "deep",
      semanticError: "model unavailable",
    }), {
      names: [],
      blocked: true,
      warning: "语义复核失败，已跳过会话删除：model unavailable",
    });
  });

  test("keeps rule-based deletion behavior when semantic review is disabled", () => {
    assert.deepEqual(guardSessionCleanupDeletion({
      names: ["session-a", "session-a", "session-b"],
      semanticMode: "off",
      semanticError: "stale reviewer error",
    }), {
      names: ["session-a", "session-b"],
      blocked: false,
      warning: null,
    });
  });
});

describe("schedule workspace policy", () => {
  const first = "C:\\workspaces\\first";
  const second = "C:\\workspaces\\second";

  test("uses the active workspace only for follow-current prompt tasks", () => {
    assert.equal(resolveScheduleRunWorkspace({ kind: "prompt", workspaceScope: "bound", workspaceDir: first }, second), first);
    assert.equal(resolveScheduleRunWorkspace({ kind: "prompt", workspaceScope: "current", workspaceDir: first }, second), second);
    assert.equal(resolveScheduleRunWorkspace({ kind: "session_cleanup", workspaceDir: first }, second), first);
    assert.equal(resolveScheduleRunWorkspace({ kind: "report", workspaceDir: first }, second), null);
    assert.equal(resolveScheduleRunWorkspace({ kind: "prompt", skillName: "dws", workspaceDir: first }, second), null);
  });

  test("keeps the knowledge workspace when a session cleanup task is edited elsewhere", () => {
    assert.equal(resolveStoredScheduleWorkspace({ kind: "session_cleanup", previousWorkspace: first, currentWorkspace: second }), first);
    assert.equal(resolveStoredScheduleWorkspace({ kind: "session_cleanup", currentWorkspace: second }), second);
    assert.equal(resolveStoredScheduleWorkspace({ kind: "session_cleanup", previousWorkspace: first, currentWorkspace: second, rebind: true }), second);
    assert.equal(resolveStoredScheduleWorkspace({ kind: "report", previousWorkspace: first, currentWorkspace: second }), null);
  });
});

describe("schedule recovery transitions", () => {
  test("accepts only the first completion for the matching running run id", () => {
    const task = {
      history: [
        { runId: "new-run", status: "running" },
        { runId: "old-run", status: "completed", completedAt: "2026-07-18T01:00:00.000Z" },
      ],
    };
    assert.equal(shouldAcceptScheduleCompletion(task, "new-run"), true);
    assert.equal(shouldAcceptScheduleCompletion(task, "old-run"), false);
    assert.equal(shouldAcceptScheduleCompletion(task, "missing-run"), false);
  });

  test("rejects an old running history entry after the registry moved to a newer run", () => {
    const task = {
      history: [
        { runId: "new-run", status: "running" },
        { runId: "old-run", status: "running" },
      ],
    };
    assert.equal(canAcceptScheduleCompletion(task, "old-run", { activeRunId: "new-run" }), false);
    assert.equal(canAcceptScheduleCompletion(task, "new-run", { activeRunId: "new-run" }), true);
    assert.equal(canAcceptScheduleCompletion(task, "old-run", { activeRunId: null }), false);
    assert.equal(canAcceptScheduleCompletion(task, "old-run", { activeRunId: null, allowReleased: true }), true);
    assert.equal(canAcceptScheduleCompletion(task, "old-run", { activeRunId: "new-run", allowReleased: true }), false);
  });

  test("an empty scheduled Skill result cannot advance the successful-run anchor", () => {
    const empty = classifyScheduledSkillCompletion({ done: { ok: true, assistantText: "" }, scheduledSkill: true, reportPath: null });
    assert.deepEqual(empty, {
      status: "failed",
      completed: false,
      retryable: true,
      reason: "scheduled Skill returned no content; no report was saved",
    });
    assert.equal(classifyScheduledSkillCompletion({ done: { ok: true }, scheduledSkill: true, reportPath: "report.md" }).status, "completed");
    assert.equal(classifyScheduledSkillCompletion({ done: { ok: true }, scheduledSkill: false }).status, "completed");

    const history = [
      { status: "completed", skillName: "dws", skillAction: "digest", startedAt: "2026-07-18T03:00:00.000Z", reportPath: null },
      { status: "completed", skillName: "dws", skillAction: "digest", startedAt: "2026-07-18T02:00:00.000Z", reportPath: "report.md" },
    ];
    assert.equal(resolvePreviousSuccessfulSkillRunAt(history, "dws", "digest"), "2026-07-18T02:00:00.000Z");
  });

  test("distinguishes a model timeout from an explicit user cancellation", () => {
    const timeout = Object.assign(new Error("model request timed out after 1000ms"), {
      name: "ModelRequestTimeoutError",
      code: "MODEL_REQUEST_TIMEOUT",
    });
    const aborted = new AbortController();
    aborted.abort();
    assert.deepEqual(classifyScheduleRunError(timeout, aborted.signal), {
      cancelled: false,
      status: "failed",
      reason: "模型请求超时：model request timed out after 1000ms",
      summary: "模型请求超时：model request timed out after 1000ms",
    });
    assert.equal(classifyScheduleRunError(new DOMException("cancelled", "AbortError"), aborted.signal).status, "cancelled");
    assert.equal(classifyScheduleRunError(new DOMException("transport aborted", "AbortError"), new AbortController().signal).status, "failed");

    const watchdog = new AbortController();
    watchdog.abort(Object.assign(new Error("scheduled task exceeded run timeout (1000ms)"), {
      code: "SCHEDULE_RUN_TIMEOUT",
    }));
    assert.equal(classifyScheduleRunError(new DOMException("scheduled task cancelled", "AbortError"), watchdog.signal).status, "failed");
  });

  test("repairs only runs left active by a launcher restart", () => {
    const task = { lastStatus: "running", history: [{ runId: "run-1", status: "running", startedAt: "2026-07-12T01:00:00.000Z" }] };
    assert.equal(repairInterruptedSchedule(task, { nowIso: "2026-07-12T01:00:05.000Z", nextRunAt: "2026-07-12T02:00:00.000Z" }), true);
    assert.deepEqual({ status: task.lastStatus, error: task.lastError, next: task.nextRunAt }, {
      status: "failed",
      error: "interrupted by launcher restart",
      next: "2026-07-12T02:00:00.000Z",
    });
    assert.equal(task.history[0].durationMs, 5000);
    assert.equal(repairInterruptedSchedule({ lastStatus: "completed" }), false);
  });

  test("repairs a stopping run left active by a launcher restart and keeps its next run", () => {
    const task = {
      lastStatus: "stopping",
      lastError: "cancellation requested",
      nextRunAt: "2026-07-12T02:00:00.000Z",
      history: [{ runId: "run-stop", status: "running", startedAt: "2026-07-12T01:00:00.000Z" }],
    };
    assert.equal(repairInterruptedSchedule(task, {
      nowIso: "2026-07-12T01:00:05.000Z",
    }), true);
    assert.deepEqual({ status: task.lastStatus, error: task.lastError, next: task.nextRunAt }, {
      status: "failed",
      error: "interrupted by launcher restart",
      next: "2026-07-12T02:00:00.000Z",
    });
    assert.equal(task.history[0].status, "failed");
    assert.equal(task.history[0].durationMs, 5000);
  });

  test("marks cancellation as requested until the task confirms completion", () => {
    const task = {};
    markScheduleCancellationRequested(task, "2026-07-12T03:00:00.000Z");
    assert.deepEqual(task, { lastStatus: "stopping", lastError: "cancellation requested", updatedAt: "2026-07-12T03:00:00.000Z" });
  });

  test("persists launcher-restart recovery through the real schedule store", () => {
    tempRoot = mkdtempSync(join(tmpdir(), "visionox-schedule-recovery-"));
    const path = join(tempRoot, "schedules.json");
    const task = { id: "task-1", lastStatus: "running", history: [{ runId: "run-1", status: "running", startedAt: "2026-07-12T01:00:00.000Z" }] };
    writeScheduleStore(path, [task]);
    const loaded = readScheduleStore(path, (value) => value);
    repairInterruptedSchedule(loaded.schedules[0], { nowIso: "2026-07-12T01:00:05.000Z", nextRunAt: "2026-07-12T02:00:00.000Z" });
    writeScheduleStore(path, loaded.schedules);
    const restored = readScheduleStore(path, (value) => value).schedules[0];
    assert.equal(restored.lastStatus, "failed");
    assert.equal(restored.history[0].durationMs, 5000);
    assert.equal(restored.nextRunAt, "2026-07-12T02:00:00.000Z");
  });
});
