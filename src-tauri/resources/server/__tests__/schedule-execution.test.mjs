import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createScheduleRunRegistry, decideRejectedScheduleSubmission, decideScheduleAdmission, markScheduleCancellationRequested, repairInterruptedSchedule } from "../lib/schedule-execution.mjs";
import { readScheduleStore, writeScheduleStore } from "../lib/schedule-store.mjs";

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

describe("schedule admission policy", () => {
  const task = { kind: "prompt", runMode: "auto" };

  test("prioritizes active and concurrency checks", () => {
    assert.equal(decideScheduleAdmission({ task, isRunning: true }).kind, "already_running");
    const deferred = decideScheduleAdmission({ task, runningCount: 2, maxConcurrent: 2 });
    assert.deepEqual({ kind: deferred.kind, retry: deferred.retry, persist: deferred.persist }, { kind: "deferred", retry: true, persist: true });
    assert.equal(decideScheduleAdmission({ task, manual: true, runningCount: 2, maxConcurrent: 2 }).persist, false);
  });

  test("preserves workspace, window and confirmation behavior", () => {
    assert.equal(decideScheduleAdmission({ task, workspaceMatches: false }).kind, "skipped");
    assert.equal(decideScheduleAdmission({ task: { kind: "session_cleanup" }, workspaceMatches: false }).kind, "start");
    assert.equal(decideScheduleAdmission({ task, windowCheck: { ok: false, reason: "outside" } }).reason, "outside");
    assert.equal(decideScheduleAdmission({ task, catchUp: true, windowCheck: { ok: false } }).kind, "start");
    assert.equal(decideScheduleAdmission({ task: { ...task, runMode: "confirm" } }).kind, "pending_confirmation");
    assert.equal(decideScheduleAdmission({ task: { ...task, runMode: "confirm" }, manual: true }).kind, "start");
  });

  test("classifies rejected prompt submissions without changing API statuses", () => {
    assert.deepEqual(decideRejectedScheduleSubmission({ reason: "loop is busy" }), { status: "deferred", reason: "loop is busy", retry: true });
    assert.equal(decideRejectedScheduleSubmission({ manual: true, reason: "loop is busy" }).status, "rejected");
    assert.equal(decideRejectedScheduleSubmission({ reason: "permission denied" }).status, "skipped");
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
