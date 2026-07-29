import assert from "node:assert/strict";
import { test } from "node:test";

import { createOperationRuntime } from "./operation-runtime.mjs";

function createHarness() {
  const events = [];
  const stoppedJobs = [];
  const revoked = [];
  let drained = 0;
  let conversationId = "conversation-1";
  let workspace = "C:/workspace-a";
  let id = 0;
  let tick = 0;
  const runtime = createOperationRuntime({
    broadcast: (event) => events.push(event),
    stopOwned: async (operationId, options) => stoppedJobs.push([operationId, options]),
    drain: () => { drained += 1; },
    revokeAuthorization: (operation) => revoked.push(operation.id),
    getConversationId: () => conversationId,
    getWorkspace: () => workspace,
    idFactory: () => `operation-${++id}`,
    now: () => `2026-07-24T00:00:0${tick++}.000Z`,
  });
  return {
    runtime,
    events,
    stoppedJobs,
    revoked,
    drained: () => drained,
    setScope(nextConversationId, nextWorkspace) {
      conversationId = nextConversationId;
      workspace = nextWorkspace;
    },
  };
}

test("operation runtime owns one active operation and publishes stable state", () => {
  const harness = createHarness();
  const operation = harness.runtime.begin("chat");

  assert.equal(operation.id, "operation-1");
  assert.equal(operation.context.conversationId, "conversation-1");
  assert.equal(harness.runtime.getActive(), operation);
  assert.deepEqual(harness.runtime.public(), {
    id: "operation-1",
    kind: "chat",
    state: "running",
    startedAt: "2026-07-24T00:00:00.000Z",
    stopRequestedAt: null,
    progress: null,
  });
  assert.throws(() => harness.runtime.begin("report"), /already active/);
  assert.equal(harness.events.length, 1);
});

test("operation stop is idempotent and revokes authorization before jobs unwind", async () => {
  const harness = createHarness();
  const operation = harness.runtime.begin("chat");
  operation.context.sendAuthorization = { operationId: operation.id };

  assert.equal(harness.runtime.stop(operation, "user_cancelled"), true);
  assert.equal(operation.state, "stopping");
  assert.equal(operation.context.sendAuthorization, null);
  assert.equal(operation.controller.signal.aborted, true);
  assert.deepEqual(harness.revoked, [operation.id]);
  await Promise.resolve();
  assert.deepEqual(harness.stoppedJobs, [[operation.id, { graceMs: 100 }]]);

  assert.equal(harness.runtime.stop(operation, "duplicate"), false);
  await Promise.resolve();
  assert.deepEqual(harness.revoked, [operation.id]);
  assert.equal(harness.stoppedJobs.length, 1);
});

test("operation finish ignores stale operations and preserves the first terminal state", () => {
  const harness = createHarness();
  const operation = harness.runtime.begin("chat");
  operation.finalState = "unknown";

  assert.equal(harness.runtime.finish({ ...operation, id: "stale" }), false);
  assert.equal(harness.runtime.finish(operation), true);
  assert.equal(operation.context.state, "unknown");
  assert.equal(harness.runtime.getActive(), null);
  assert.equal(harness.drained(), 1);
  assert.equal(harness.runtime.finish(operation), false);
  assert.equal(harness.drained(), 1);
  assert.equal(harness.events.at(-1).operation.state, "unknown");
});

test("operation scope is immutable and a session/workspace change stops the old operation", async () => {
  const harness = createHarness();
  const operation = harness.runtime.begin("chat");
  harness.setScope("conversation-2", "C:/workspace-b");

  assert.equal(harness.runtime.scopeMatches(operation), false);
  assert.equal(harness.runtime.refreshScope(operation), false);
  assert.equal(operation.context.conversationId, "conversation-1");
  assert.equal(operation.context.workspace, "C:/workspace-a");
  assert.equal(operation.context.scopeMismatch.expected.conversationId, "conversation-1");
  assert.equal(operation.context.scopeMismatch.observed.conversationId, "conversation-2");
  assert.equal(operation.state, "stopping");
  assert.equal(operation.finalState, "unknown");
  assert.equal(operation.controller.signal.aborted, true);
  await Promise.resolve();
  assert.deepEqual(harness.stoppedJobs, [[operation.id, { graceMs: 100 }]]);
});

test("refreshing an unchanged operation scope is a no-op", () => {
  const harness = createHarness();
  const operation = harness.runtime.begin("chat");
  assert.equal(harness.runtime.scopeMatches(operation), true);
  assert.equal(harness.runtime.refreshScope(operation), true);
  assert.equal(operation.state, "running");
});

test("operation lifecycle observers receive non-blocking start, stop and finish facts", async () => {
  const events = [];
  const runtime = createOperationRuntime({
    lifecycle: { emit: async (event, payload) => { events.push({ event, payload }); } },
    idFactory: () => "operation-hooks",
  });
  const operation = runtime.begin("chat");
  runtime.stop(operation, "user_cancelled");
  runtime.finish(operation, "cancelled");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events.map((entry) => entry.event), ["operation.started", "operation.stopping", "operation.finished"]);
  assert.equal(events[2].payload.finalState, "cancelled");
});

test("operation stop observes shouldContinueAfterStop before aborting", async () => {
  const observed = [];
  const runtime = createOperationRuntime({
    lifecycle: {
      emit: async () => {},
      runBoundary: async (event, payload) => {
        observed.push({ event, payload });
        return { event, results: [{ hook: "observer", status: "completed", value: { continue: true } }] };
      },
    },
    getWorkspace: () => "C:/workspace-hooks",
    idFactory: () => "operation-stop-hook",
  });
  const operation = runtime.begin("chat");
  assert.equal(runtime.stop(operation, "user_cancelled"), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(observed.length, 1);
  assert.equal(observed[0].event, "shouldContinueAfterStop");
  assert.equal(observed[0].payload.operationId, operation.id);
  assert.equal(observed[0].payload.reason, "user_cancelled");
  assert.equal(observed[0].payload.workspace.path, null);
  assert.match(observed[0].payload.workspace.id, /^sha256:/u);
  assert.equal(operation.controller.signal.aborted, true);
});
