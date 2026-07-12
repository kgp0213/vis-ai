import { test } from "node:test";
import assert from "node:assert/strict";

import { createRuntimeIssueRegistry } from "../lib/runtime-issues.mjs";

test("runtime issues expose only actionable warning and error entries", () => {
  const logged = [];
  const registry = createRuntimeIssueRegistry({ log: (entry) => logged.push(entry) });
  registry.report("debug", { key: "cleanup", message: "temporary cleanup failed" });
  registry.report("warning", { message: "degraded without user action" });
  registry.report("warning", { key: "audit-log", path: "audit.jsonl", message: "audit unavailable" });
  registry.report("error", { key: "session-meta", path: "session.meta.json", message: "invalid JSON" });
  assert.deepEqual(registry.listUserActionable().map(({ key, level }) => ({ key, level })), [
    { key: "audit-log", level: "warning" },
    { key: "session-meta", level: "error" },
  ]);
  assert.equal(logged.some((entry) => entry.level === "debug"), false);
  registry.clear("audit-log");
  assert.deepEqual(registry.listUserActionable().map((entry) => entry.key), ["session-meta"]);
});

test("fatal issues stop the unsafe operation", () => {
  const registry = createRuntimeIssueRegistry();
  assert.throws(() => registry.report("fatal", { message: "original data cannot be protected" }), /cannot be protected/);
  assert.deepEqual(registry.listUserActionable(), []);
});
