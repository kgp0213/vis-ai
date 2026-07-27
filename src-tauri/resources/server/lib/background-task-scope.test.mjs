import test from "node:test";
import assert from "node:assert/strict";

import { createBackgroundTaskScopeRegistry } from "./background-task-scope.mjs";

test("requires an immutable session and workspace scope", () => {
  const registry = createBackgroundTaskScopeRegistry();
  registry.remember(7, { operationId: "op-1", workspace: "C:/work-a", sessionId: "session-a" });

  assert.equal(registry.matches(7, { workspace: "C:/work-a", sessionId: "session-a" }), true);
  assert.equal(registry.matches(7, { workspace: "C:/work-b", sessionId: "session-a" }), false);
  assert.equal(registry.matches(7, { workspace: "C:/work-a", sessionId: "session-b" }), false);
  assert.equal(registry.matches(7, null), false);
});

test("unknown scope fails closed and remembered scope cannot be rewritten", () => {
  const registry = createBackgroundTaskScopeRegistry();
  registry.remember(8, null);
  assert.equal(registry.matches(8, { workspace: "C:/work", sessionId: "session" }), false);
  registry.remember(8, { workspace: "C:/work", sessionId: "session" });
  assert.equal(registry.matches(8, { workspace: "C:/work", sessionId: "session" }), true);

  registry.remember(9, { workspace: "C:/work-a", sessionId: "session-a" });
  registry.remember(9, { workspace: "C:/work-b", sessionId: "session-b" });
  assert.equal(registry.matches(9, { workspace: "C:/work-a", sessionId: "session-a" }), true);
  assert.equal(registry.matches(9, { workspace: "C:/work-b", sessionId: "session-b" }), false);
});
