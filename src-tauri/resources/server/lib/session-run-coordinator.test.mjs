import assert from "node:assert/strict";
import test from "node:test";

import { createSessionRunCoordinator, sessionLocationFingerprint } from "./session-run-coordinator.mjs";

function harness() {
  let current = { sessionId: "session-a", workspace: "C:\\work-a" };
  let id = 0;
  let tick = 0;
  const events = [];
  const coordinator = createSessionRunCoordinator({
    getLocation: () => current,
    idFactory: () => `id-${++id}`,
    now: () => `2026-07-26T00:00:0${tick++}.000Z`,
    onEvent: (event) => events.push(event),
  });
  return {
    coordinator,
    events,
    setLocation: (location) => { current = location; },
  };
}

test("serializes a session and coalesces duplicate follow-up wakes", () => {
  const h = harness();
  const first = h.coordinator.begin({ operationId: "op-1", requestId: "req-1" });
  assert.equal(first.accepted, true);
  assert.equal(first.run.queuedWakeCount, 0);

  const duplicate = h.coordinator.begin({ operationId: "op-1", requestId: "req-1" });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.coalesced, false);

  const wake = h.coordinator.begin({ operationId: "op-2", requestId: "req-2", reason: "resume" });
  assert.equal(wake.accepted, true);
  assert.equal(wake.coalesced, true);
  assert.equal(wake.wake.requestId, "req-2");

  const sameWake = h.coordinator.begin({ operationId: "op-2", requestId: "req-2" });
  assert.equal(sameWake.duplicate, true);
  assert.equal(h.coordinator.getActive("session-a").queuedWakeCount, 1);
});

test("allows different sessions to have independent lanes", () => {
  const h = harness();
  const first = h.coordinator.begin({ sessionId: "session-a", workspace: "C:\\work-a", operationId: "op-a" });
  const second = h.coordinator.begin({ sessionId: "session-b", workspace: "C:\\work-b", operationId: "op-b" });
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.equal(h.coordinator.listActive().length, 2);
});

test("fences a run when its session location changes", () => {
  const h = harness();
  const first = h.coordinator.begin({ operationId: "op-1" });
  assert.equal(h.coordinator.assertCurrent(first.run.runId).ok, true);
  h.setLocation({ sessionId: "session-a", workspace: "C:\\work-b" });
  const fenced = h.coordinator.assertCurrent(first.run.runId);
  assert.equal(fenced.ok, false);
  assert.equal(fenced.code, "SESSION_LOCATION_CHANGED");
  assert.equal(fenced.expected.workspace, "C:\\work-a");
  assert.equal(fenced.actual.workspace, "C:\\work-b");
});

test("finishing a run returns the next coalesced wake and is idempotent", () => {
  const h = harness();
  const first = h.coordinator.begin({ operationId: "op-1", requestId: "req-1" });
  h.coordinator.queueWake(first.run.runId, { requestId: "req-2", reason: "steer" });
  const finished = h.coordinator.finish(first.run.runId, "completed");
  assert.equal(finished.accepted, true);
  assert.equal(finished.nextWake.requestId, "req-2");
  assert.equal(h.coordinator.getActive("session-a"), null);
  assert.equal(h.coordinator.finish(first.run.runId, "failed").code, "SESSION_RUN_NOT_FOUND");
});

test("uses a stable location fingerprint", () => {
  assert.equal(
    sessionLocationFingerprint({ sessionId: "s", workspace: "C:\\work" }),
    sessionLocationFingerprint({ sessionId: "s", workspace: "C:\\work" }),
  );
  assert.notEqual(
    sessionLocationFingerprint({ sessionId: "s", workspace: "C:\\work" }),
    sessionLocationFingerprint({ sessionId: "s", workspace: "C:\\other" }),
  );
});
