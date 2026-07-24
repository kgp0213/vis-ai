import assert from "node:assert/strict";
import { test } from "node:test";

import { createScheduleRuntime } from "./schedule-runtime.mjs";

test("schedule runtime keeps queue, registry and cancellation under one owner", () => {
  const runtime = createScheduleRuntime({ maxConcurrent: 1, getTimeoutMs: () => 60_000 });
  const first = runtime.registry.start("task-1", "run-1");
  assert.equal(runtime.isRunning("task-1"), true);
  assert.equal(runtime.runningCount(), 1);
  assert.equal(runtime.registry.start("task-1", "run-2"), null);

  const queued = runtime.queue.enqueue("task-2", { manual: true, requestedAt: "2026-07-24T00:00:00.000Z" });
  assert.equal(queued.enqueued, true);
  assert.equal(runtime.hasQueued("task-2"), true);
  assert.equal(runtime.queuedCount(), 1);
  assert.equal(runtime.cancel("task-1"), first);
  assert.equal(first.controller.signal.aborted, true);
  runtime.registry.finish("task-1", "run-1");
  assert.equal(runtime.queue.shift().taskId, "task-2");
  assert.equal(runtime.queuedCount(), 0);
});
