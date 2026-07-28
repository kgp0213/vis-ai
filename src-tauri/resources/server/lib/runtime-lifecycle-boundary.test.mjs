import { test } from "node:test";
import assert from "node:assert/strict";

import { createRuntimeLifecycleHooks } from "./runtime-lifecycle-hooks.mjs";
import { createRuntimeLifecycleBoundary } from "./runtime-lifecycle-boundary.mjs";

test("tool lifecycle boundaries run once in order and ignore hook decisions", async () => {
  const hooks = createRuntimeLifecycleHooks();
  const calls = [];
  for (const event of ["beforeStep", "prepareTool", "authorizeTool", "finalizeToolResult", "afterStep"]) {
    hooks.register(event, event, async (payload) => {
      calls.push(`${event}:${payload.toolCallId}`);
      return { block: true, args: { command: "mutated" }, decision: "deny" };
    });
  }
  const observations = [];
  const boundary = createRuntimeLifecycleBoundary({
    lifecycle: hooks,
    onObservation: (fact) => observations.push(fact),
  });
  const operation = {
    id: "op-1",
    context: {
      conversationId: "session-1",
      workspace: "C:\\workspace",
    },
  };
  const base = {
    role: "tool_queued",
    callId: "call-1",
    toolName: "run_command",
    toolArgs: JSON.stringify({ command: "echo ok", token: "secret" }),
    turnId: "turn-1",
    stepId: "step-1",
    attempt: 1,
  };

  await boundary.observeToolEvent(base, { operation });
  await boundary.observeToolEvent({ ...base, role: "tool_start" }, { operation });
  await boundary.observeToolEvent({ ...base, role: "tool", content: "[exit 0]", toolStatus: "succeeded" }, { operation });
  await boundary.observeToolEvent({ ...base, role: "tool", content: "[exit 0]", toolStatus: "succeeded" }, { operation });

  assert.deepEqual(calls, [
    "beforeStep:call-1",
    "prepareTool:call-1",
    "authorizeTool:call-1",
    "finalizeToolResult:call-1",
    "afterStep:call-1",
  ]);
  assert.equal(observations.length, 5);
  assert.equal(observations.every((fact) => fact.operationId === "op-1" && fact.sessionId === "session-1"), true);
  assert.equal(observations.some((fact) => JSON.stringify(fact.payload).includes("secret")), false);
  assert.equal(observations.some((fact) => fact.ignoredDecision === true), true);
});

test("a terminal event without queued/start still observes all pre-tool boundaries", async () => {
  const hooks = createRuntimeLifecycleHooks();
  const calls = [];
  for (const event of ["beforeStep", "prepareTool", "authorizeTool", "finalizeToolResult", "afterStep"]) {
    hooks.register(event, event, async () => { calls.push(event); });
  }
  const boundary = createRuntimeLifecycleBoundary({ lifecycle: hooks });
  await boundary.observeToolEvent({
    role: "tool",
    callId: "call-2",
    toolName: "read_file",
    toolArgs: { path: "C:\\workspace\\a.txt" },
    content: "ok",
    toolStatus: "succeeded",
  }, { operation: { id: "op-2", context: { conversationId: "s-2", workspace: "C:\\workspace" } } });
  assert.deepEqual(calls, ["beforeStep", "prepareTool", "authorizeTool", "finalizeToolResult", "afterStep"]);
});

test("flush waits for fire-and-forget tool observations before finalization", async () => {
  const hooks = createRuntimeLifecycleHooks();
  let finished = false;
  hooks.register("afterStep", "slow-observer", async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    finished = true;
  });
  const boundary = createRuntimeLifecycleBoundary({ lifecycle: hooks });
  const operation = { id: "op-flush", context: { conversationId: "session-flush", workspace: "C:\\flush" } };
  void boundary.observeToolEvent({ role: "tool", callId: "call-flush", toolName: "read_file", toolArgs: {}, content: "ok", toolStatus: "succeeded" }, { operation });
  assert.equal(finished, false);
  await boundary.flush(operation.id);
  assert.equal(finished, true);
});
