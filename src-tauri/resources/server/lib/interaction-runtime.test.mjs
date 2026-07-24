import assert from "node:assert/strict";
import { test } from "node:test";

import { createInteractionRuntime } from "./interaction-runtime.mjs";

function createHarness(initial = []) {
  const persisted = [];
  const events = [];
  let tick = 0;
  const runtime = createInteractionRuntime({
    initial,
    getOperationId: () => "operation-1",
    getSessionId: () => "session-1",
    getWorkspace: () => "C:/workspace",
    idFactory: () => `interaction-${persisted.length + 1}`,
    now: () => `2026-07-25T00:00:0${tick++}.000Z`,
    persist: async (records) => persisted.push(structuredClone(records)),
    onEvent: (event) => events.push(event),
  });
  return { runtime, persisted, events };
}

test("interaction runtime persists a safe projection without command or credentials", async () => {
  const harness = createHarness();
  const created = harness.runtime.create({
    kind: "shell",
    _gateId: 7,
    command: "curl -H 'Authorization: Bearer secret' https://example.invalid",
    allowPrefix: "curl",
  });
  await harness.runtime.flush();

  assert.equal(created.interactionId, "interaction-1");
  assert.equal(created.operationId, "operation-1");
  assert.equal(created.sessionId, "session-1");
  assert.equal(created.status, "pending");
  assert.equal(created.modal.command.includes("secret"), true);

  const serialized = JSON.stringify(harness.persisted.at(-1));
  assert.doesNotMatch(serialized, /secret|Authorization|https:\/\/example/);
  assert.deepEqual(harness.persisted.at(-1)[0], {
    interactionId: "interaction-1",
    operationId: "operation-1",
    sessionId: "session-1",
    workspace: "C:/workspace",
    kind: "shell",
    gateId: 7,
    status: "pending",
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    resolution: null,
  });
});

test("restored pending interactions become interrupted and are never replayed", async () => {
  const harness = createHarness([{
    interactionId: "old-interaction",
    operationId: "old-operation",
    sessionId: "session-1",
    workspace: "C:/workspace",
    kind: "choice",
    gateId: 9,
    status: "pending",
    createdAt: "2026-07-24T23:59:00.000Z",
    updatedAt: "2026-07-24T23:59:00.000Z",
    resolution: null,
  }]);
  await harness.runtime.flush();

  const restored = harness.runtime.get("old-interaction");
  assert.equal(restored.status, "interrupted");
  assert.equal(restored.resolution.reason, "process_restarted");
  assert.equal(harness.runtime.getActive(), null);
  assert.equal(harness.events.some((event) => event.kind === "interaction-change" && event.interaction.status === "interrupted"), true);
});

test("interaction resolution is idempotent and does not expose sensitive resolution text", async () => {
  const harness = createHarness();
  const created = harness.runtime.create({ kind: "choice", _gateId: 11, question: "Continue?" });

  const first = harness.runtime.resolve(created.interactionId, {
    action: "custom",
    text: "api-key-secret",
  });
  const duplicate = harness.runtime.resolve(created.interactionId, {
    action: "custom",
    text: "different-secret",
  });
  await harness.runtime.flush();

  assert.equal(first.ok, true);
  assert.equal(first.idempotent, false);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.idempotent, true);
  assert.equal(duplicate.interaction.resolution.action, "custom");
  assert.equal("text" in duplicate.interaction.resolution, false);
  assert.doesNotMatch(JSON.stringify(harness.persisted), /api-key-secret|different-secret/);
});

test("operation and session boundaries cancel only matching pending interactions", async () => {
  const harness = createHarness();
  const first = harness.runtime.create({ kind: "choice", _gateId: 1 });
  const second = harness.runtime.create({ kind: "plan", _gateId: 2 }, {
    operationId: "operation-2",
    sessionId: "session-2",
    workspace: "C:/workspace-2",
  });

  assert.equal(harness.runtime.cancelScope({ operationId: "operation-1", reason: "operation_cancelled" }), 1);
  assert.equal(harness.runtime.get(first.interactionId).status, "cancelled");
  assert.equal(harness.runtime.get(second.interactionId).status, "pending");
  assert.equal(harness.runtime.getActive({ sessionId: "session-1" }), null);
  assert.equal(harness.runtime.getActive({ sessionId: "session-2" }).interactionId, second.interactionId);
  await harness.runtime.flush();
});

test("expired interactions retain an auditable terminal projection", async () => {
  let nowMs = Date.parse("2026-07-25T00:00:00.000Z");
  const runtime = createInteractionRuntime({
    getOperationId: () => "operation-1",
    getSessionId: () => "session-1",
    getWorkspace: () => "C:/workspace",
    idFactory: () => "interaction-expiring",
    now: () => new Date(nowMs).toISOString(),
    persist: async () => {},
  });
  runtime.create({ kind: "checkpoint", _gateId: 3 });
  nowMs += 61_000;

  assert.equal(runtime.expirePending({ maxAgeMs: 60_000 }), 1);
  assert.equal(runtime.get("interaction-expiring").status, "expired");
  await runtime.flush();
});
