import assert from "node:assert/strict";
import { test } from "node:test";

import { createOperationPolicy, operationAuthorizationKey } from "./operation-policy.mjs";

test("approval cache is bound to operation, session, workspace and effect inputs", () => {
  const policy = createOperationPolicy({ now: () => "2026-07-25T00:00:00.000Z" });
  const request = { operationId: "op-1", sessionId: "s-1", workspace: "C:\\work", toolName: "dws_send", args: { to: "self" }, recipient: "self", attachments: [{ sha256: "a" }] , requiresApproval: true };
  assert.equal(policy.evaluate(request).decision, "ask");
  policy.record(request, "allow");
  assert.equal(policy.evaluate(request).cached, true);
  assert.equal(policy.evaluate({ ...request, sessionId: "s-2" }).decision, "ask");
  assert.match(operationAuthorizationKey(request), /^approval:/);
});
test("revoking an operation removes all cached approvals", () => {
  const policy = createOperationPolicy();
  const base = { operationId: "op-2", sessionId: "s", workspace: "w", toolName: "send", requiresApproval: true };
  policy.record(base, "allow");
  policy.record({ ...base, recipient: "other" }, "allow");
  assert.equal(policy.revoke({ operationId: "op-2" }), 2);
  assert.equal(policy.size(), 0);
});
