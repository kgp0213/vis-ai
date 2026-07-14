import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { createScheduleRunRegistry, createScheduleTriggerQueue, decideRejectedScheduleSubmission, decideScheduleAdmission, markScheduleCancellationRequested, orderMissedSchedules, repairInterruptedSchedule, resolveScheduleRunWorkspace, resolveStoredScheduleWorkspace } from "../lib/schedule-execution.mjs";
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
