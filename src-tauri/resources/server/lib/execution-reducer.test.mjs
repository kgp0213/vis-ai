import assert from "node:assert/strict";
import { test } from "node:test";

import { applyExecutionEvent, createExecutionState, reduceExecutionEvents } from "./execution-reducer.mjs";

test("upserts execution entities and ignores duplicate events", () => {
  const event = { eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "tool.running", entityId: "call-1", payload: { name: "read_file" } };
  const first = applyExecutionEvent(createExecutionState(), event);
  const second = applyExecutionEvent(first.state, event);
  assert.equal(first.state.tools["call-1"].state, "running");
  assert.equal(second.duplicate, true);
  assert.equal(second.changed, false);
});

test("text deltas are offset idempotent and expose gaps", () => {
  let state = createExecutionState();
  state = applyExecutionEvent(state, { eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "text.delta", payload: { messageId: "m", offset: 0, delta: "ab" } }).state;
  const duplicate = applyExecutionEvent(state, { eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "text.delta", payload: { messageId: "m", offset: 0, delta: "ab" } });
  const gap = applyExecutionEvent(duplicate.state, { eventEpoch: "e", eventSeq: 3, eventId: "e:3", kind: "text.delta", payload: { messageId: "m", offset: 4, delta: "x" } });
  assert.equal(duplicate.state.messages.m.content, "ab");
  assert.equal(gap.resyncRequired, true);
});

test("late events cannot reopen terminal entities", () => {
  const result = reduceExecutionEvents([
    { eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "tool.succeeded", entityId: "call", payload: {} },
    { eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "tool.running", entityId: "call", payload: {} },
  ]);
  assert.equal(result.state.tools.call.state, "succeeded");
  assert.equal(result.state.anomalies.at(-1).type, "late-terminal-update");
});

test("goal, todo and prompt facts use the same idempotent entity reducer", () => {
  const result = reduceExecutionEvents([
    { eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "goal.upsert", entityId: "goal-1", payload: { title: "deliver" } },
    { eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "todo.upsert", entityId: "todo-1", payload: { status: "in_progress" } },
    { eventEpoch: "e", eventSeq: 3, eventId: "e:3", kind: "prompt.upsert", entityId: "prompt-1", payload: { status: "queued" } },
  ]);
  assert.equal(result.state.goals["goal-1"].title, "deliver");
  assert.equal(result.state.todos["todo-1"].status, "in_progress");
  assert.equal(result.state.prompts["prompt-1"].status, "queued");
});
