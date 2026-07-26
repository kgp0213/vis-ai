import assert from "node:assert/strict";
import { test } from "node:test";

import { createExecutionPhaseTracker, phaseForEvent } from "./execution-phase.mjs";

test("maps model and tool events to explicit execution phases", () => {
  assert.equal(phaseForEvent({ role: "assistant_delta" }), "streaming");
  assert.equal(phaseForEvent({ role: "tool_start", toolCallId: "call-1" }), "tool_call");
  assert.equal(phaseForEvent({ role: "model-retry" }), "retrying");
  assert.equal(phaseForEvent({ role: "awaiting_approval" }), "awaiting_approval");
});

test("tracks scope and protects terminal phases from late events", () => {
  const tracker = createExecutionPhaseTracker({ operationId: "op-1", sessionId: "s-1", turnId: "t-1", now: () => "2026-07-26T00:00:00.000Z" });
  tracker.observe({ role: "tool_start", stepId: "step-1", callId: "call-1" });
  const ended = tracker.finish("completed");
  assert.equal(ended.state.phase, "ended");
  assert.equal(ended.state.terminalState, "completed");
  const late = tracker.observe({ role: "assistant_delta" });
  assert.equal(late.accepted, false);
  assert.equal(late.reason, "late_phase");
  assert.deepEqual(tracker.snapshot(), {
    phase: "ended",
    terminalState: "completed",
    operationId: "op-1",
    sessionId: "s-1",
    turnId: "t-1",
    stepId: "step-1",
    toolCallId: "call-1",
    reason: null,
    updatedAt: "2026-07-26T00:00:00.000Z",
  });
});

test("allows the loop's provisional assistant envelope to lead into tool execution", () => {
  const tracker = createExecutionPhaseTracker();
  assert.equal(tracker.observe({ role: "assistant_final" }).state.phase, "ended");
  const tool = tracker.observe({ role: "tool_start", callId: "call-1" });
  assert.equal(tool.accepted, true);
  assert.equal(tool.state.phase, "tool_call");
});

test("unknown operations end with an explicit unknown terminal state", () => {
  const tracker = createExecutionPhaseTracker();
  assert.equal(tracker.finish("unknown").state.phase, "ended");
  assert.equal(tracker.snapshot().terminalState, "unknown");
});

test("terminal finish is write-once and rejects a late replacement", () => {
  const tracker = createExecutionPhaseTracker();
  assert.equal(tracker.finish("completed").accepted, true);
  const late = tracker.finish("failed");
  assert.equal(late.accepted, false);
  assert.equal(late.reason, "terminal_state_committed");
  assert.equal(tracker.snapshot().terminalState, "completed");
});
