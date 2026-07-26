import assert from "node:assert/strict";
import { test } from "node:test";

import { createPermissionRuleRuntime, parsePermissionRulePattern, readPermissionRules } from "./permission-rule-runtime.mjs";

test("Kimi-style permission patterns are parsed without accepting malformed rules", () => {
  assert.deepEqual(parsePermissionRulePattern("run_command(npm *)"), {
    toolPattern: "run_command",
    argPattern: "npm *",
  });
  assert.deepEqual(parsePermissionRulePattern("mcp__*"), {
    toolPattern: "mcp__*",
    argPattern: null,
  });
  assert.equal(parsePermissionRulePattern("run_command(npm *"), null);
  assert.equal(parsePermissionRulePattern("(npm *)"), null);
});

test("configured deny wins over allow and auto modes", () => {
  const runtime = createPermissionRuleRuntime({
    initialRules: [
      { decision: "allow", scope: "user", pattern: "run_command(*)" },
      { decision: "deny", scope: "user", pattern: "run_command(rm *)", reason: "删除命令必须人工确认" },
    ],
  });
  const result = runtime.evaluate({
    requiresApproval: true,
    toolName: "run_command",
    command: "rm -rf output",
  });
  assert.equal(result.decision, "deny");
  assert.equal(result.reason, "删除命令必须人工确认");
});

test("specific command rule beats broad tool rule and supports safe boundaries", () => {
  const runtime = createPermissionRuleRuntime({
    initialRules: [
      { decision: "allow", scope: "user", pattern: "run_command" },
      { decision: "deny", scope: "user", pattern: "run_command(npm install *)" },
    ],
  });
  assert.equal(runtime.evaluate({ requiresApproval: true, toolName: "run_command", command: "npm install pkg" }).decision, "deny");
  assert.equal(runtime.evaluate({ requiresApproval: true, toolName: "run_command", command: "npmx install pkg" }).decision, "allow");
});

test("project and session rules require their isolation binding", () => {
  const rules = readPermissionRules({ permission: { rules: [
    { decision: "allow", scope: "project", workspace: "C:\\repo", pattern: "run_command(git *)" },
    { decision: "deny", scope: "project", pattern: "run_command(rm *)" },
    { decision: "ask", scope: "user", pattern: "run_command(python *)" },
  ] } });
  assert.equal(rules.length, 2);
  const runtime = createPermissionRuleRuntime({ initialRules: rules });
  assert.equal(runtime.evaluate({ requiresApproval: true, toolName: "run_command", command: "git status", workspace: "C:\\repo" }).decision, "allow");
  assert.equal(runtime.evaluate({ requiresApproval: true, toolName: "run_command", command: "git status", workspace: "C:\\other" }).decision, "none");
  assert.equal(runtime.evaluate({ requiresApproval: true, toolName: "run_command", command: "python build.py", workspace: "C:\\other" }).decision, "ask");
});

test("static ask blocks automatic approval while negated patterns remain explicit", () => {
  const runtime = createPermissionRuleRuntime({
    initialRules: [
      { decision: "ask", scope: "user", pattern: "run_command(!git status)" },
    ],
  });
  assert.equal(runtime.evaluate({ requiresApproval: true, toolName: "run_command", command: "git status" }).decision, "none");
  assert.equal(runtime.evaluate({ requiresApproval: true, toolName: "run_command", command: "git reset --hard" }).decision, "ask");
});

test("malformed, expired, and unsupported rules are ignored safely", () => {
  const runtime = createPermissionRuleRuntime({
    now: () => "2026-07-26T00:00:00.000Z",
    initialRules: [
      { decision: "allow", scope: "user", pattern: "run_command", expiresAt: "2026-07-25T00:00:00.000Z" },
      { decision: "allow", scope: "user", pattern: "(" },
      { decision: "ignore", scope: "user", pattern: "run_command" },
    ],
  });
  assert.equal(runtime.size(), 0);
  assert.equal(runtime.evaluate({ requiresApproval: true, toolName: "run_command", command: "git status" }).decision, "none");
});

test("legacy allow/deny/ask config arrays remain readable", () => {
  const rules = readPermissionRules({ permission: {
    deny: [{ pattern: "run_command(rm *)", reason: "blocked" }],
    allow: ["run_command(git *)"],
    ask: ["run_command(npm install *)"],
  } });
  assert.deepEqual(rules.map((rule) => rule.decision), ["deny", "allow", "ask"]);
  assert.equal(rules[0].reason, "blocked");
});
