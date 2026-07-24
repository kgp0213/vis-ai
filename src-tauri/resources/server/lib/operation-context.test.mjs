import assert from "node:assert/strict";
import { test } from "node:test";
import { closeOperationContext, createOperationContext, isOperationContextActive } from "./operation-context.mjs";

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
