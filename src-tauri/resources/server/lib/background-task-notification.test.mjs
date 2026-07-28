import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createBackgroundTaskNotificationRuntime,
  deriveBackgroundTaskStatus,
  formatBackgroundTaskNotification,
  isProcessRestartedRecovery,
  notificationEnqueueScope,
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

test("does not let a later operation claim an earlier operation notification", () => {
  const runtime = createBackgroundTaskNotificationRuntime();
  runtime.enqueue(
    { taskId: "bg-cross-operation", running: false, exitCode: 0 },
    { operationId: "op-a", sessionId: "s", workspace: "C:/work" },
  );

  assert.equal(runtime.claim({ operationId: "op-b", sessionId: "s", workspace: "C:/work" }).length, 0);
  const [claimed] = runtime.claim({ operationId: "op-a", sessionId: "s", workspace: "C:/work" });
  assert.equal(claimed?.sourceOperationId, "op-a");
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

test("restart-recovered lost notifications are rebound to the live operation", () => {
  const recovered = {
    taskId: "bg-lost-restart",
    status: "lost",
    running: false,
    stopReason: "process_restarted",
    operationId: "op-dead",
    sessionId: "s",
    workspace: "C:/w",
  };
  assert.equal(isProcessRestartedRecovery(recovered), true);
  assert.equal(isProcessRestartedRecovery({ ...recovered, stopReason: "user_cancelled" }), false);
  assert.equal(isProcessRestartedRecovery({ ...recovered, status: "failed" }), false);

  // Crash-recovered facts take the live operation binding; ordinary terminal
  // facts keep their original operation so the cross-operation guard holds.
  assert.deepEqual(notificationEnqueueScope(recovered, { operationId: "op-live", sessionId: "s", workspace: "C:/w" }), {
    operationId: "op-live",
    sessionId: "s",
    workspace: "C:/w",
  });
  assert.deepEqual(notificationEnqueueScope({ taskId: "bg-done", status: "completed", operationId: "op-a" }, { operationId: "op-b", sessionId: "s", workspace: "C:/w" }), {
    operationId: "op-a",
    sessionId: "s",
    workspace: "C:/w",
  });

  // End to end: a rebound lost notification is claimable by the live
  // operation and survives redelivery until acknowledged.
  const runtime = createBackgroundTaskNotificationRuntime();
  const enqueued = runtime.enqueue(recovered, notificationEnqueueScope(recovered, { operationId: "op-live", sessionId: "s", workspace: "C:/w" }));
  assert.equal(enqueued.accepted, true);
  assert.equal(runtime.claim({ operationId: "op-other", sessionId: "s", workspace: "C:/w" }).length, 0);
  const [claimed] = runtime.claim({ operationId: "op-live", sessionId: "s", workspace: "C:/w" });
  assert.equal(claimed?.status, "lost");
  assert.equal(claimed?.sourceOperationId, "op-live");
  assert.equal(runtime.acknowledge(claimed.notificationId), true);
  assert.equal(runtime.claim({ operationId: "op-live", sessionId: "s", workspace: "C:/w" }).length, 0);
});

test("notification overflow remains recoverable instead of being silently discarded", () => {
  const runtime = createBackgroundTaskNotificationRuntime({ maxPending: 1 });
  runtime.enqueue({ taskId: "bg-overflow-1", running: false, exitCode: 1 }, { sessionId: "s", workspace: "C:/w" });
  const second = runtime.enqueue({ taskId: "bg-overflow-2", running: false, exitCode: 1 }, { sessionId: "s", workspace: "C:/w" });
  assert.deepEqual(second.overflow, {
    count: 1,
    notificationIds: ["task:bg-overflow-1:failed"],
  });
  assert.equal(runtime.enqueue({ taskId: "bg-overflow-1", running: false, exitCode: 1 }, { sessionId: "s", workspace: "C:/w" }).duplicate, true);
  const claimed = runtime.claim({ sessionId: "s", workspace: "C:/w", limit: 2 });
  assert.deepEqual(claimed.map((item) => item.taskId), ["bg-overflow-2", "bg-overflow-1"]);
  const third = runtime.enqueue({ taskId: "bg-overflow-3", running: false, exitCode: 1 }, { sessionId: "s", workspace: "C:/w" });
  assert.equal(third.accepted, true);
  const fourth = runtime.enqueue({ taskId: "bg-overflow-4", running: false, exitCode: 1 }, { sessionId: "s", workspace: "C:/w" });
  assert.equal(fourth.accepted, true);
  const fifth = runtime.enqueue({ taskId: "bg-overflow-5", running: false, exitCode: 1 }, { sessionId: "s", workspace: "C:/w" });
  assert.equal(fifth.accepted, false);
  assert.equal(fifth.overflow.durableRecoveryRequired, true);
  assert.equal(runtime.snapshot().overflowedCount <= 1, true);
});

test("bounds claimed notifications until the model acknowledges them", () => {
  const runtime = createBackgroundTaskNotificationRuntime({ maxPending: 1 });
  runtime.enqueue({ taskId: "bg-in-flight-1", running: false, exitCode: 1 }, { sessionId: "s", workspace: "C:/w" });
  const [claimed] = runtime.claim({ sessionId: "s", workspace: "C:/w" });
  assert.equal(claimed.taskId, "bg-in-flight-1");

  runtime.enqueue({ taskId: "bg-in-flight-2", running: false, exitCode: 1 }, { sessionId: "s", workspace: "C:/w" });
  assert.deepEqual(runtime.claim({ sessionId: "s", workspace: "C:/w" }), []);
  assert.equal(runtime.snapshot().inFlight.length, 1);
  assert.equal(runtime.snapshot().pending.length + runtime.snapshot().overflowedCount <= 2, true);
});
