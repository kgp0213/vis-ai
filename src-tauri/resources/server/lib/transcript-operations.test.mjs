import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTranscriptOperation,
  createTranscriptState,
  materializeTranscriptSnapshot,
  operationsFromTranscriptSnapshot,
} from "./transcript-operations.mjs";

test("upsert operations converge under duplicates and out-of-order frames", () => {
  let state = createTranscriptState();
  const frame = { frameId: "frame-1", kind: "text", text: "done" };
  state = applyTranscriptOperation(state, { op: "frame.upsert", turnId: "turn-1", stepId: "step-1", frame }).state;
  state = applyTranscriptOperation(state, { op: "step.upsert", turnId: "turn-1", step: { stepId: "step-1", ordinal: 1, state: "running" } }).state;
  state = applyTranscriptOperation(state, { op: "turn.upsert", turn: { turnId: "turn-1", ordinal: 1, state: "running", steps: [] } }).state;
  const repeated = applyTranscriptOperation(state, { op: "frame.upsert", turnId: "turn-1", stepId: "step-1", frame });
  assert.equal(repeated.changed, false);
  assert.equal(repeated.state.items[0].steps[0].frames[0].frameId, "frame-1");
});

test("append requires a contiguous offset and reports a gap without mutation", () => {
  let state = createTranscriptState();
  state = applyTranscriptOperation(state, {
    op: "frame.upsert", turnId: "turn-1", stepId: "step-1",
    frame: { frameId: "frame-1", kind: "text", text: "" },
  }).state;
  const gap = applyTranscriptOperation(state, {
    op: "append", target: { type: "frame", turnId: "turn-1", stepId: "step-1", frameId: "frame-1" }, offset: 3, text: "bad",
  });
  assert.deepEqual(gap.gap, { expected: 0, got: 3 });
  assert.equal(gap.state.items[0].steps[0].frames[0].text, "");
  const landed = applyTranscriptOperation(gap.state, {
    op: "append", target: { type: "frame", turnId: "turn-1", stepId: "step-1", frameId: "frame-1" }, offset: 0, text: "ok",
  });
  assert.equal(landed.state.items[0].steps[0].frames[0].text, "ok");
});

test("append converges for duplicate and partially overlapping replay", () => {
  let state = createTranscriptState();
  state = applyTranscriptOperation(state, {
    op: "frame.upsert", turnId: "turn-1", stepId: "step-1",
    frame: { frameId: "frame-1", kind: "text", text: "abcd" },
  }).state;

  const duplicate = applyTranscriptOperation(state, {
    op: "append",
    target: { type: "frame", turnId: "turn-1", stepId: "step-1", frameId: "frame-1" },
    offset: 0,
    text: "abcd",
  });
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.gap, undefined);

  const overlap = applyTranscriptOperation(duplicate.state, {
    op: "append",
    target: { type: "frame", turnId: "turn-1", stepId: "step-1", frameId: "frame-1" },
    offset: 2,
    text: "cdef",
  });
  assert.equal(overlap.changed, true);
  assert.equal(overlap.gap, undefined);
  assert.equal(overlap.state.items[0].steps[0].frames[0].text, "abcdef");
});

test("append treats a mismatched overlap as divergence without rewriting local text", () => {
  let state = createTranscriptState();
  state = applyTranscriptOperation(state, {
    op: "frame.upsert", turnId: "turn-1", stepId: "step-1",
    frame: { frameId: "frame-1", kind: "text", text: "abcd" },
  }).state;

  const divergent = applyTranscriptOperation(state, {
    op: "append",
    target: { type: "frame", turnId: "turn-1", stepId: "step-1", frameId: "frame-1" },
    offset: 2,
    text: "ZZef",
  });
  assert.deepEqual(divergent.gap, { expected: 4, got: 2 });
  assert.equal(divergent.state.items[0].steps[0].frames[0].text, "abcd");
});

test("late terminal state cannot regress a completed frame", () => {
  let state = createTranscriptState();
  state = applyTranscriptOperation(state, {
    op: "frame.upsert", turnId: "turn-1", stepId: "step-1",
    frame: { frameId: "frame-1", kind: "tool", state: "succeeded" },
  }).state;
  const late = applyTranscriptOperation(state, {
    op: "frame.upsert", turnId: "turn-1", stepId: "step-1",
    frame: { frameId: "frame-1", kind: "tool", state: "running" },
  });
  assert.equal(late.changed, false);
  assert.equal(late.anomaly, "late-terminal-update");
});

test("materializing a projected transcript keeps global entities independent of the turn page", () => {
  const snapshot = {
    schemaVersion: 1,
    sessionId: "session-1",
    items: [{ kind: "turn", turnId: "turn-1", ordinal: 1, state: "completed", steps: [] }],
    attachments: [{ id: "attachment-1", sessionId: "session-1" }],
    interactions: [{ id: "interaction-1", state: "pending", sessionId: "session-1" }],
    artifacts: [{ id: "artifact-1", verified: true, sessionId: "session-1" }],
    receipts: [{ id: "receipt-1", operationId: "op-1" }],
    goals: [{ id: "goal-1", status: "active", sessionId: "session-1" }],
    todos: [{ id: "todo-1", status: "active", sessionId: "session-1" }],
    prompts: [{ id: "prompt-1", status: "queued", sessionId: "session-1" }],
    taskNotifications: [{ id: "task-1", status: "completed", sessionId: "session-1" }],
    meta: { title: "Session title", revision: 2 },
    hasMoreOlder: true,
  };
  const materialized = materializeTranscriptSnapshot(snapshot);
  assert.equal(materialized.hasMoreOlder, true);
  assert.equal(materialized.interactions[0].id, "interaction-1");
  assert.equal(materialized.attachments[0].id, "attachment-1");
  assert.equal(materialized.artifacts[0].id, "artifact-1");
  assert.equal(materialized.prompts[0].id, "prompt-1");
  assert.deepEqual(materialized.meta, { title: "Session title", revision: 2 });
  assert.equal(operationsFromTranscriptSnapshot(snapshot).length > 0, true);
});

test("specific global entity operations converge through the same reducer", () => {
  const operations = [
    { op: "task.upsert", task: { taskId: "task-1", state: "running", outputTail: "" } },
    { op: "interaction.upsert", interaction: { interactionId: "interaction-1", state: "pending" } },
    { op: "attachment.upsert", attachment: { attachmentId: "attachment-1", mediaType: "text/plain" } },
    { op: "todo.upsert", todo: { todoId: "todo-1", status: "in_progress" } },
    { op: "prompt.upsert", prompt: { promptId: "prompt-1", status: "queued" } },
  ];
  let state = createTranscriptState();
  for (const operation of operations) {
    const result = applyTranscriptOperation(state, operation);
    assert.equal(result.changed, true, operation.op);
    assert.equal(result.anomaly, undefined, operation.op);
    state = result.state;
  }
  assert.equal(state.tasks[0].id, "task-1");
  assert.equal(state.interactions[0].id, "interaction-1");
  assert.equal(state.attachments[0].id, "attachment-1");
  assert.equal(state.todos[0].id, "todo-1");
  assert.equal(state.prompts[0].id, "prompt-1");

  for (const operation of operations) {
    const repeated = applyTranscriptOperation(state, operation);
    assert.equal(repeated.changed, false, `${operation.op} duplicate`);
    state = repeated.state;
  }
});

test("standalone marker and task references upsert by stable id without moving their anchor", () => {
  let state = createTranscriptState({
    items: [
      { kind: "turn", turnId: "turn-1", ordinal: 1, state: "completed", steps: [] },
      { kind: "turn", turnId: "turn-2", ordinal: 2, state: "completed", steps: [] },
    ],
  });
  const marker = {
    op: "marker.upsert",
    beforeTurn: 2,
    item: { kind: "marker", markerId: "marker-1", label: "first" },
  };
  const inserted = applyTranscriptOperation(state, marker);
  assert.equal(inserted.changed, true);
  assert.deepEqual(inserted.state.items.map((item) => item.turnId ?? item.markerId), ["turn-1", "marker-1", "turn-2"]);

  const duplicate = applyTranscriptOperation(inserted.state, marker);
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.state.items.filter((item) => item.markerId === "marker-1").length, 1);

  const updated = applyTranscriptOperation(duplicate.state, {
    ...marker,
    beforeTurn: 1,
    item: { ...marker.item, label: "updated" },
  });
  assert.equal(updated.changed, true);
  assert.equal(updated.state.items[1].label, "updated");
  assert.deepEqual(updated.state.items.map((item) => item.turnId ?? item.markerId), ["turn-1", "marker-1", "turn-2"]);

  const taskRef = {
    op: "taskref.upsert",
    item: { kind: "taskref", refId: "task-ref-1", taskId: "task-1" },
  };
  const withTaskRef = applyTranscriptOperation(updated.state, taskRef);
  const repeatedTaskRef = applyTranscriptOperation(withTaskRef.state, taskRef);
  assert.equal(repeatedTaskRef.changed, false);
  assert.equal(repeatedTaskRef.state.items.filter((item) => item.refId === "task-ref-1").length, 1);
});

test("metadata merge is idempotent for duplicate state operations", () => {
  const first = applyTranscriptOperation(createTranscriptState(), {
    op: "meta.merge",
    meta: { title: "Session", revision: 1 },
  });
  assert.equal(first.changed, true);
  const duplicate = applyTranscriptOperation(first.state, {
    op: "meta.merge",
    meta: { title: "Session", revision: 1 },
  });
  assert.equal(duplicate.changed, false);
});

test("task output append uses the same offset and overlap contract as text frames", () => {
  let state = applyTranscriptOperation(createTranscriptState(), {
    op: "task.upsert",
    task: { taskId: "task-1", state: "running", outputTail: "abcd" },
  }).state;
  const overlap = applyTranscriptOperation(state, {
    op: "append",
    target: { type: "task", taskId: "task-1" },
    offset: 2,
    text: "cdef",
  });
  assert.equal(overlap.changed, true);
  assert.equal(overlap.state.tasks[0].outputTail, "abcdef");
  const repeated = applyTranscriptOperation(overlap.state, {
    op: "append",
    target: { type: "task", taskId: "task-1" },
    offset: 2,
    text: "cdef",
  });
  assert.equal(repeated.changed, false);
  assert.equal(repeated.duplicate, true);
});
