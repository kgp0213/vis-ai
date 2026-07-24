import assert from "node:assert/strict";
import { test } from "node:test";
import { closeOperationContext, createOperationContext, isOperationContextActive, requestOperationStop } from "./operation-context.mjs";

test("operation context carries stable execution identity and starts active", () => {
  const controller = new AbortController();
  const context = createOperationContext({
    operationId: "operation-1",
    kind: "chat",
    conversationId: "conversation-1",
    workspace: "C:/workspace",
    signal: controller.signal,
    startedAt: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(context.version, 1);
  assert.equal(context.source, "chat");
  assert.equal(isOperationContextActive(context, { operationId: "operation-1", conversationId: "conversation-1" }), true);
  assert.equal(isOperationContextActive(context, { operationId: "operation-2" }), false);
});

test("operation context closes and invalidates authorization and signal", () => {
  const controller = new AbortController();
  const context = createOperationContext({ operationId: "operation-2", kind: "chat", signal: controller.signal });
  context.sendAuthorization = { version: 1 };
  closeOperationContext(context, "cancelled", "2026-07-24T00:01:00.000Z");
  assert.equal(context.state, "cancelled");
  assert.equal(context.closedAt, "2026-07-24T00:01:00.000Z");
  assert.equal(context.sendAuthorization, null);
  assert.equal(context.signal, null);
  assert.equal(isOperationContextActive(context, { operationId: "operation-2" }), false);
});

test("requesting stop immediately invalidates send authorization while tools unwind", () => {
  const controller = new AbortController();
  const context = createOperationContext({ operationId: "operation-3", kind: "chat", signal: controller.signal });
  context.sendAuthorization = { operationId: "operation-3" };
  assert.equal(requestOperationStop(context, "session_switched", "2026-07-24T00:02:00.000Z"), true);
  assert.equal(context.state, "stopping");
  assert.equal(context.stopReason, "session_switched");
  assert.equal(context.stopRequestedAt, "2026-07-24T00:02:00.000Z");
  assert.equal(context.sendAuthorization, null);
  assert.equal(isOperationContextActive(context, { operationId: "operation-3" }), false);
  assert.equal(requestOperationStop(context, "duplicate"), false);
});

test("terminal operation state is idempotent and cannot be overwritten by late cleanup", () => {
  const context = createOperationContext({ operationId: "operation-4", kind: "chat" });
  closeOperationContext(context, "unknown", "2026-07-24T00:03:00.000Z");
  closeOperationContext(context, "completed", "2026-07-24T00:04:00.000Z");
  assert.equal(context.state, "unknown");
  assert.equal(context.closedAt, "2026-07-24T00:03:00.000Z");
});
