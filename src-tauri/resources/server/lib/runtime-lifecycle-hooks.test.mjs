import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { createRuntimeLifecycleHooks } from "./runtime-lifecycle-hooks.mjs";

describe("runtime lifecycle hooks", () => {
  test("records failures and timeouts without blocking or rewriting payloads", async () => {
    const issues = [];
    const hooks = createRuntimeLifecycleHooks({ timeoutMs: 10, onIssue: (issue) => issues.push(issue) });
    hooks.register("tool.running", "throws", async () => { throw new Error("hook failed"); });
    hooks.register("tool.running", "times-out", async () => new Promise(() => {}));
    hooks.register("tool.running", "tries-to-rewrite", async () => ({ args: { path: "changed" }, block: true }));
    const payload = Object.freeze({ toolCallId: "call-1", args: Object.freeze({ path: "original" }) });

    const outcome = await hooks.emit("tool.running", payload);
    assert.equal(outcome.event, "tool.running");
    assert.equal(outcome.completed, 1);
    assert.equal(outcome.failed, 1);
    assert.equal(outcome.timedOut, 1);
    assert.deepEqual(payload.args, { path: "original" });
    assert.equal(issues.length, 2);
  });

  test("rejects unknown lifecycle event names", () => {
    const hooks = createRuntimeLifecycleHooks();
    assert.throws(() => hooks.register("PreToolUse", "legacy", async () => {}), /unsupported lifecycle event/);
  });

  test("supports unregistering an internal observer", async () => {
    const hooks = createRuntimeLifecycleHooks();
    let calls = 0;
    const unregister = hooks.register("operation.started", "temporary", async () => { calls++; });
    unregister();
    const outcome = await hooks.emit("operation.started", { operationId: "op-1" });
    assert.equal(calls, 0);
    assert.equal(outcome.completed, 0);
    assert.equal(hooks.supportedEvents().includes("tool.cancelled"), true);
  });

  test("supports cancellable policy boundary hooks without exposing decisions to the loop", async () => {
    const hooks = createRuntimeLifecycleHooks();
    let receivedSignal = null;
    hooks.register("prepareTool", "prepare", async (_payload, context) => { receivedSignal = context.signal; return { args: { changed: true } }; });
    const controller = new AbortController();
    const result = await hooks.runBoundary("prepareTool", { toolCallId: "call-1" }, { signal: controller.signal });
    assert.equal(result.results[0].status, "completed");
    assert.equal(receivedSignal, controller.signal);
    assert.deepEqual(result.results[0].value, { args: { changed: true } });
  });
});
