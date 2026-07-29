import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { applyExecutionEvent, createExecutionState, reduceExecutionEvents } from "./execution-reducer.mjs";
import { mergeTextAtOffset } from "./text-offset-merge.mjs";

const contractVectors = JSON.parse(readFileSync(new URL("../__fixtures__/execution-schema-vectors.json", import.meta.url), "utf8"));

test("upserts execution entities and ignores duplicate events", () => {
  const event = { eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "tool.running", entityId: "call-1", payload: { name: "read_file" } };
  const first = applyExecutionEvent(createExecutionState(), event);
  const second = applyExecutionEvent(first.state, event);
  assert.equal(first.state.tools["call-1"].state, "running");
  assert.equal(second.duplicate, true);
  assert.equal(second.changed, false);
});

test("scopes reused tool call ids by Turn and Step", () => {
  const first = applyExecutionEvent(createExecutionState(), {
    eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "tool.succeeded",
    entityId: "call-reused", turnId: "turn-1", stepId: "step-1",
    payload: { toolCallId: "call-reused", state: "succeeded" },
  });
  const second = applyExecutionEvent(first.state, {
    eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "tool.running",
    entityId: "call-reused", turnId: "turn-2", stepId: "step-1",
    payload: { toolCallId: "call-reused", state: "running" },
  });
  assert.equal(first.state.tools["tool:turn-1:step-1:call-reused"].state, "succeeded");
  assert.equal(second.state.tools["tool:turn-2:step-1:call-reused"].state, "running");
  assert.equal(Object.keys(second.state.tools).length, 2);
});

test("text deltas are offset idempotent and expose gaps", () => {
  let state = createExecutionState();
  state = applyExecutionEvent(state, { eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "text.delta", payload: { messageId: "m", offset: 0, delta: "ab" } }).state;
  const duplicate = applyExecutionEvent(state, { eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "text.delta", payload: { messageId: "m", offset: 0, delta: "ab" } });
  const gap = applyExecutionEvent(duplicate.state, { eventEpoch: "e", eventSeq: 3, eventId: "e:3", kind: "text.delta", payload: { messageId: "m", offset: 4, delta: "x" } });
  assert.equal(duplicate.state.messages.m.content, "ab");
  assert.equal(gap.resyncRequired, true);
});

test("text deltas append only the novel suffix of a matching overlap", () => {
  let state = createExecutionState();
  state = applyExecutionEvent(state, {
    eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "text.delta",
    payload: { messageId: "m", offset: 0, delta: "abcd" },
  }).state;
  const overlap = applyExecutionEvent(state, {
    eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "text.delta",
    payload: { messageId: "m", offset: 2, delta: "cdef" },
  });
  assert.equal(overlap.changed, true);
  assert.equal(overlap.resyncRequired, undefined);
  assert.equal(overlap.state.messages.m.content, "abcdef");

  const duplicate = applyExecutionEvent(overlap.state, {
    eventEpoch: "e", eventSeq: 3, eventId: "e:3", kind: "text.delta",
    payload: { messageId: "m", offset: 0, delta: "abcdef" },
  });
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.resyncRequired, undefined);
  assert.equal(duplicate.state.messages.m.content, "abcdef");
});

test("text deltas request resync when an overlapping replay diverges", () => {
  let state = createExecutionState();
  state = applyExecutionEvent(state, {
    eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "text.delta",
    payload: { messageId: "m", offset: 0, delta: "abcd" },
  }).state;
  const divergent = applyExecutionEvent(state, {
    eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "text.delta",
    payload: { messageId: "m", offset: 2, delta: "ZZef" },
  });
  assert.equal(divergent.changed, false);
  assert.equal(divergent.resyncRequired, true);
  assert.equal(divergent.anomaly, "delta-gap");
  assert.equal(divergent.state.messages.m.content, "abcd");
});

test("event sequence gaps require canonical resync even when the observed fact is usable", () => {
  const result = applyExecutionEvent(createExecutionState(), {
    eventEpoch: "e",
    eventSeq: 3,
    eventId: "e:3",
    kind: "tool.succeeded",
    entityId: "call-gap",
    payload: { state: "succeeded" },
  });
  assert.equal(result.state.tools["call-gap"].state, "succeeded");
  assert.equal(result.resyncRequired, true);
  assert.equal(result.anomaly, "event-gap");
});

test("late sequence events request resync without overwriting newer facts", () => {
  let state = createExecutionState();
  state = applyExecutionEvent(state, {
    eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "tool.running",
    entityId: "call-order", payload: { state: "running" },
  }).state;
  const late = applyExecutionEvent(state, {
    eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "tool.failed",
    entityId: "call-order", payload: { state: "failed" },
  });
  assert.equal(late.changed, false);
  assert.equal(late.resyncRequired, true);
  assert.equal(late.anomaly, "event-out-of-order");
  assert.equal(late.state.tools["call-order"].state, "running");
});

test("same sequence with a different event id requests resync", () => {
  const first = applyExecutionEvent(createExecutionState(), {
    eventEpoch: "epoch-seq",
    eventSeq: 1,
    eventId: "epoch-seq:1",
    kind: "tool.succeeded",
    entityId: "call-1",
    payload: { state: "succeeded" },
  });
  const conflict = applyExecutionEvent(first.state, {
    eventEpoch: "epoch-seq",
    eventSeq: 1,
    eventId: "epoch-seq:1-conflict",
    kind: "tool.failed",
    entityId: "call-1",
    payload: { state: "failed" },
  });
  assert.equal(conflict.resyncRequired, true);
  assert.equal(conflict.anomaly, "event-sequence-conflict");
  assert.equal(conflict.state.tools["call-1"].state, "succeeded");
});

test("retry attempts reset the message stream without creating a second message", () => {
  let state = createExecutionState();
  state = applyExecutionEvent(state, {
    eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "text.delta",
    payload: { messageId: "m", attempt: 1, stepId: "s1", offset: 0, delta: "bad" },
  }).state;
  const retry = applyExecutionEvent(state, {
    eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "text.delta",
    payload: { messageId: "m", attempt: 2, stepId: "s2", streamReset: true, offset: 0, delta: "good" },
  });
  assert.equal(retry.state.messages.m.content, "good");
  assert.equal(retry.state.messages.m.attempt, 2);
  const stale = applyExecutionEvent(retry.state, {
    eventEpoch: "e", eventSeq: 3, eventId: "e:3", kind: "text.delta",
    payload: { messageId: "m", attempt: 1, stepId: "s1", offset: 0, delta: "stale" },
  });
  assert.equal(stale.state.messages.m.content, "good");
  assert.equal(stale.changed, false);
});

test("late events cannot reopen terminal entities", () => {
  const result = reduceExecutionEvents([
    { eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "tool.succeeded", entityId: "call", payload: {} },
    { eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "tool.running", entityId: "call", payload: {} },
  ]);
  assert.equal(result.state.tools.call.state, "succeeded");
  assert.equal(result.state.anomalies.at(-1).type, "late-terminal-update");
});

test("tool failure can reopen only through an explicit scoped recovery chain", () => {
  const result = reduceExecutionEvents([
    { eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "tool.failed", entityId: "call-recover", payload: { state: "failed" } },
    { eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "tool.running", entityId: "call-recover", payload: { state: "running" } },
    { eventEpoch: "e", eventSeq: 3, eventId: "e:3", kind: "tool.succeeded", entityId: "call-recover", payload: { state: "succeeded" } },
    { eventEpoch: "e", eventSeq: 4, eventId: "e:4", kind: "tool.failed", entityId: "call-recover", payload: { state: "failed" } },
  ]);
  assert.equal(result.state.tools["call-recover"].state, "succeeded");
  assert.equal(result.state.anomalies.at(-1).type, "late-terminal-update");
});

test("late entity upserts cannot downgrade a terminal entity", () => {
  const result = reduceExecutionEvents([
    { eventEpoch: "e", eventSeq: 1, eventId: "e:1", kind: "tool.succeeded", entityId: "call-upsert", payload: { state: "succeeded" } },
    { eventEpoch: "e", eventSeq: 2, eventId: "e:2", kind: "entity.upsert", entityId: "call-upsert", payload: { entityType: "tool", state: "running", output: "stale" } },
  ]);
  assert.equal(result.state.tools["call-upsert"].state, "succeeded");
  assert.equal(result.state.tools["call-upsert"].output, undefined);
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

test("server reducer matches the shared cross-layer convergence vectors", () => {
  const result = reduceExecutionEvents(contractVectors.convergence.toolEvents);
  const tool = Object.values(result.state.tools)[0];
  assert.equal(tool.state, contractVectors.convergence.expectedToolState);
  assert.equal(result.state.anomalies.at(-1).type, contractVectors.convergence.expectedToolAnomaly);
  for (const vector of contractVectors.convergence.textOffsets) {
    assert.deepEqual(mergeTextAtOffset(vector.local, vector.offset, vector.chunk), vector.expected, vector.name);
  }
});
