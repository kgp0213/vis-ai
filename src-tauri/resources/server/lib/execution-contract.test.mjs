import assert from "node:assert/strict";
import { test } from "node:test";

import { createExecutionEvent, normalizeExecutionEvent, terminalStateTransition } from "./execution-contract.mjs";

test("normalizes legacy event fields without changing the event payload", () => {
  const event = normalizeExecutionEvent({ kind: "tool.running", id: "call-1", operationId: "op-1", payload: { value: 1 } }, { eventEpoch: "epoch", eventSeq: 2 });
  assert.equal(event.eventId, "epoch:2");
  assert.equal(event.entityId, "call-1");
  assert.equal(event.payload.value, 1);
  assert.equal(event.schemaVersion, 1);
});
test("creates scoped execution events and protects terminal states", () => {
  const event = createExecutionEvent({ kind: "turn.started", epoch: "e", seq: 1, operationId: "op", sessionId: "s", entityId: "t1" });
  assert.equal(event.eventId, "e:1");
  assert.deepEqual(terminalStateTransition("completed", "running"), { state: "completed", changed: false, accepted: false });
  assert.equal(terminalStateTransition("running", "completed").state, "completed");
});

test("rejects malformed normalized execution events instead of creating an ambiguous fact", () => {
  assert.throws(
    () => normalizeExecutionEvent({ kind: "tool.running", eventSeq: 2, payload: {} }),
    /execution schema/u,
  );
});
