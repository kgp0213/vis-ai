import test from "node:test";
import assert from "node:assert/strict";

import {
  createModelBoundaryFence,
  projectBoundaryDeliveries,
} from "./model-boundary-fence.mjs";

test("queues boundary facts FIFO and releases them only at the next request", () => {
  const fence = createModelBoundaryFence({ now: () => "2026-07-27T00:00:00.000Z" });
  fence.begin("op-1", "compaction");
  fence.enqueue("op-1", { type: "steering", entityId: "s-1" });
  fence.enqueue("op-1", { type: "background", entityId: "task:t-1:completed" });
  const opened = fence.open("op-1");
  assert.equal(opened.compacting, true);
  assert.deepEqual(opened.queued.map((item) => item.entityId), ["s-1", "task:t-1:completed"]);
  assert.equal(fence.open("op-1").queued.length, 0);
});

test("closing a boundary does not replay queued work after cancellation", () => {
  const fence = createModelBoundaryFence();
  fence.begin("op-2");
  fence.enqueue("op-2", { type: "steering", entityId: "s-2" });
  assert.equal(fence.close("op-2", { reason: "operation_cancelled" })[0].status, "not_applied");
  assert.equal(fence.snapshot("op-2"), null);
});

test("projects steering, session inputs and background notifications in fence sequence order", () => {
  const projected = projectBoundaryDeliveries({
    entries: [
      { sequence: 3, type: "background", entityId: "task:t-1:completed" },
      { sequence: 1, type: "steering", entityId: "steer-1" },
      { sequence: 2, type: "steer", entityId: "input-1" },
    ],
    steering: [{ id: "steer-1", instruction: "先检查" }],
    sessionInputs: [{ id: "input-1", text: "再验证" }],
    notifications: [{ notificationId: "task:t-1:completed", status: "completed" }],
  });

  assert.deepEqual(projected.items.map((item) => item.entityId), [
    "steer-1",
    "input-1",
    "task:t-1:completed",
  ]);
  assert.deepEqual(projected.items.map((item) => item.type), ["steering", "steer", "background"]);
  assert.deepEqual(projected.anomalies, []);
  assert.equal(projected.resultUnknown, false);
});

test("does not deliver queue inputs in the current operation and reports missing facts", () => {
  const projected = projectBoundaryDeliveries({
    entries: [
      { sequence: 1, type: "queue", entityId: "queued-next-turn" },
      { sequence: 2, type: "background", entityId: "missing-notification" },
    ],
    notifications: [],
  });

  assert.deepEqual(projected.items, []);
  assert.deepEqual(projected.anomalies, [
    { code: "boundary_delivery_deferred", type: "queue", entityId: "queued-next-turn", sequence: 1 },
    { code: "boundary_delivery_missing", type: "background", entityId: "missing-notification", sequence: 2 },
  ]);
  assert.equal(projected.resultUnknown, true);
});

test("turns boundary queue overflow into an unknown delivery fact", () => {
  const fence = createModelBoundaryFence({ maxQueued: 1 });
  fence.begin("op-overflow");
  fence.enqueue("op-overflow", { type: "steering", entityId: "steer-old" });
  fence.enqueue("op-overflow", { type: "steering", entityId: "steer-middle" });
  fence.enqueue("op-overflow", { type: "steering", entityId: "steer-new" });
  const opened = fence.open("op-overflow");
  const projected = projectBoundaryDeliveries({
    entries: opened.queued,
    overflowed: opened.overflowed,
    overflowCount: opened.overflowCount,
    steering: [
      { id: "steer-old", instruction: "旧指令" },
      { id: "steer-middle", instruction: "中间指令" },
      { id: "steer-new", instruction: "新指令" },
    ],
  });

  assert.equal(opened.overflowed.length, 1);
  assert.equal(opened.overflowCount, 2);
  assert.equal(projected.resultUnknown, true);
  assert.equal(projected.anomalies[0].code, "boundary_queue_overflow");
});

test("blocks delivery when overflow makes FIFO order unverifiable", () => {
  const projected = projectBoundaryDeliveries({
    entries: [{ sequence: 3, type: "steering", entityId: "steer-new" }],
    overflowed: [{ sequence: 2, type: "steering", entityId: "steer-middle" }],
    overflowCount: 2,
    steering: [
      { id: "steer-old", instruction: "旧指令" },
      { id: "steer-middle", instruction: "中间指令" },
      { id: "steer-new", instruction: "新指令" },
    ],
  });

  assert.equal(projected.blocked, true);
  assert.deepEqual(projected.items, []);
  assert.equal(projected.resultUnknown, true);
});

test("marks recovered unsequenced facts as unknown", () => {
  const projected = projectBoundaryDeliveries({
    notifications: [{ notificationId: "task:recovered:completed", status: "completed" }],
  });

  assert.equal(projected.items.length, 1);
  assert.equal(projected.items[0].sequence, null);
  assert.equal(projected.resultUnknown, true);
  assert.deepEqual(projected.anomalies, [{
    code: "boundary_delivery_unsequenced",
    type: "background",
    entityId: "task:recovered:completed",
  }]);
});
