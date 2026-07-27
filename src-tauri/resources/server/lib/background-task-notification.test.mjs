import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createBackgroundTaskNotificationRuntime,
  deriveBackgroundTaskStatus,
  formatBackgroundTaskNotification,
} from "./background-task-notification.mjs";

test("derives terminal task status from exit, timeout and spawn facts", () => {
  assert.equal(deriveBackgroundTaskStatus({ running: true }), "running");
  assert.equal(deriveBackgroundTaskStatus({ running: false, exitCode: 0 }), "completed");
  assert.equal(deriveBackgroundTaskStatus({ running: false, exitCode: 9009 }), "failed");
  assert.equal(deriveBackgroundTaskStatus({ running: false, stopReason: "timed_out" }), "timed_out");
  assert.equal(deriveBackgroundTaskStatus({ running: false, spawnError: "not found" }), "failed");
  assert.equal(deriveBackgroundTaskStatus({ running: false }), "unknown");
});

test("queues terminal facts by session and workspace and deduplicates them", () => {
  const runtime = createBackgroundTaskNotificationRuntime({ now: () => "2026-07-27T00:00:00.000Z" });
  assert.equal(runtime.enqueue({ taskId: "bg-1", running: true }, { sessionId: "s", workspace: "C:/Work" }).ignored, true);
  const first = runtime.enqueue({ taskId: "bg-1", jobId: 1, running: false, exitCode: 0 }, { sessionId: "s", workspace: "C:/Work" });
  assert.equal(first.accepted, true);
  assert.equal(runtime.enqueue({ taskId: "bg-1", jobId: 1, running: false, exitCode: 0 }, { sessionId: "s", workspace: "c:\\work" }).duplicate, true);
  assert.equal(runtime.claim({ sessionId: "other", workspace: "C:/Work" }).length, 0);
  const claimed = runtime.claim({ sessionId: "s", workspace: "c:/work" });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].status, "completed");
  assert.equal(runtime.acknowledge(claimed[0].notificationId), true);
  assert.equal(runtime.claim({ sessionId: "s", workspace: "C:/Work" }).length, 0);
});

test("failed notification can be released after persistence failure and redacts output", () => {
  const runtime = createBackgroundTaskNotificationRuntime();
  const queued = runtime.enqueue({
    taskId: "bg-fail",
    running: false,
    exitCode: 1,
    command: "node --api-key=secret build.js",
    output: "apiKey=secret\nfailed: compiler",
  }, { sessionId: "s", workspace: "C:/work" });
  const [claimed] = runtime.claim({ sessionId: "s", workspace: "C:/work" });
  assert.equal(claimed.notificationId, queued.notification.notificationId);
  assert.equal(runtime.release(claimed.notificationId), true);
  const [retry] = runtime.claim({ sessionId: "s", workspace: "C:/work" });
  assert.equal(retry.status, "failed");
  assert.equal(String(retry.outputTail).includes("[REDACTED]"), true);
  const text = formatBackgroundTaskNotification(retry);
  assert.match(text, /status: failed/);
  assert.doesNotMatch(text, /secret/);
});

test("service tasks and restored notifications do not re-enter the queue", () => {
  const runtime = createBackgroundTaskNotificationRuntime();
  assert.equal(runtime.enqueue({ taskId: "service-1", lifecycle: "service", running: false, exitCode: 0 }).ignored, true);
  const item = runtime.enqueue({ taskId: "bg-restore", running: false, exitCode: 0 }, { sessionId: "s", workspace: "C:/w" }).notification;
  runtime.restoreDelivered([{ backgroundTaskNotification: { notificationId: item.notificationId } }]);
  assert.equal(runtime.claim({ sessionId: "s", workspace: "C:/w" }).length, 0);
});
