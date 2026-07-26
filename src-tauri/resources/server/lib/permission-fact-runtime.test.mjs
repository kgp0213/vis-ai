import assert from "node:assert/strict";
import { test } from "node:test";

import { createPermissionFactRuntime, permissionFactInternals } from "./permission-fact-runtime.mjs";

test("permission facts match scoped exact arguments without persisting raw input", () => {
  const saved = [];
  const runtime = createPermissionFactRuntime({
    now: () => "2026-07-26T00:00:00.000Z",
    persist: (facts) => saved.push(facts),
  });
  const request = {
    operationId: "op-1",
    sessionId: "session-1",
    workspace: "C:\\work",
    toolName: "write_file",
    args: { path: "C:\\work\\result.txt", content: "secret content" },
    requiresApproval: true,
  };
  const fact = runtime.record({
    ...request,
    scope: "operation",
    decision: "allow",
    reason: "user-approved",
    source: "dashboard",
  });
  assert.equal(runtime.evaluate(request).decision, "allow");
  assert.equal(runtime.evaluate({ ...request, args: { ...request.args, content: "different" } }).decision, "ask");
  assert.ok(saved.length > 0);
  assert.equal(JSON.stringify(saved.at(-1)).includes("secret content"), false);
  assert.equal(fact.workspaceFingerprint.includes("C:"), false);
});

test("project prefix rules are boundary-aware and survive operation revocation", () => {
  const runtime = createPermissionFactRuntime({ now: () => "2026-07-26T00:00:00.000Z" });
  runtime.record({
    scope: "project",
    decision: "allow",
    toolName: "run_command",
    workspace: "C:\\work",
    rulePattern: "npm",
    source: "shell-confirm",
  });
  assert.equal(runtime.evaluate({
    requiresApproval: true,
    toolName: "run_command",
    command: "npm run build",
    workspace: "C:\\work",
  }).decision, "allow");
  assert.equal(runtime.evaluate({
    requiresApproval: true,
    toolName: "run_command",
    command: "npmx run build",
    workspace: "C:\\work",
  }).decision, "ask");

  runtime.record({
    scope: "operation",
    operationId: "op-2",
    sessionId: "s-2",
    workspace: "C:\\work",
    decision: "allow",
    toolName: "run_command",
    args: { command: "python test.py" },
  });
  assert.equal(runtime.revoke({ operationId: "op-2" }), 1);
  assert.equal(runtime.size(), 1);
});

test("a matching deny fact wins at the same scope and expired facts are ignored", () => {
  let now = "2026-07-26T00:00:00.000Z";
  const runtime = createPermissionFactRuntime({ now: () => now });
  const base = {
    scope: "session",
    sessionId: "s-1",
    workspace: "C:\\work",
    toolName: "run_command",
    rule: { kind: "tool" },
  };
  runtime.record({ ...base, decision: "allow" });
  runtime.record({ ...base, decision: "deny", reason: "blocked" });
  assert.equal(runtime.evaluate({ ...base, requiresApproval: true }).decision, "deny");
  runtime.record({
    scope: "project",
    decision: "allow",
    workspace: "C:\\expired",
    toolName: "run_command",
    rule: { kind: "tool" },
    expiresAt: "2026-07-26T00:00:01.000Z",
  });
  now = "2026-07-26T00:00:02.000Z";
  assert.equal(runtime.evaluate({ requiresApproval: true, toolName: "run_command", workspace: "C:\\expired" }).decision, "ask");
  assert.equal(permissionFactInternals.ruleMatches({ toolName: "run_command", rule: { kind: "prefix", value: "node" } }, { toolName: "run_command", command: "node script.js" }), true);
});

test("one-time approval remains a fact but is never replayed", () => {
  const runtime = createPermissionFactRuntime({ now: () => "2026-07-26T00:00:00.000Z" });
  const request = {
    scope: "operation",
    operationId: "op-once",
    sessionId: "s-once",
    workspace: "C:\\work",
    toolName: "run_command",
    args: { command: "npm test" },
    decision: "allow",
    reusable: false,
  };
  runtime.record(request);
  assert.equal(runtime.snapshot().length, 1);
  assert.equal(runtime.evaluate({ ...request, requiresApproval: true }).decision, "ask");
});
