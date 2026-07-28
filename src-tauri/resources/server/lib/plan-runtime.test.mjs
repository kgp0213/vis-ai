import assert from "node:assert/strict";
import test from "node:test";

import { createPlanRuntime } from "./plan-runtime.mjs";

function createHarness(options = {}) {
  let session = "session-a";
  const active = new Map();
  const archives = [];
  const events = [];
  const goals = [];
  const store = {
    loadPlanState: (name) => active.get(name) ?? null,
    savePlanState: options.savePlanState ?? ((name, steps, completedStepIds, extras) => {
      const state = {
        version: 2,
        steps: steps.map((step) => ({ ...step })),
        completedStepIds: [...completedStepIds],
        updatedAt: "2026-07-28T00:00:00.000Z",
        ...extras,
      };
      active.set(name, state);
      return state;
    }),
    archivePlanState: options.archivePlanState ?? ((name) => {
      const state = active.get(name);
      if (!state) return null;
      active.delete(name);
      archives.push({ name, state });
      return `${name}.done.json`;
    }),
    clearPlanState: (name) => active.delete(name),
  };
  const runtime = createPlanRuntime({
    store,
    getSessionName: () => session,
    getConversationId: () => `conversation:${session}`,
    onEvent: (event) => events.push(event),
    onGoalsChanged: (next) => goals.splice(0, goals.length, ...next),
    now: () => "2026-07-28T00:00:00.000Z",
  });
  return { runtime, active, archives, events, goals, setSession: (value) => { session = value; } };
}

const steps = [
  { id: "one", title: "First", action: "do first", status: "pending" },
  { id: "two", title: "Second", action: "do second", status: "pending" },
];

test("plan runtime rejects a store without the required persistence contract", () => {
  assert.throws(() => createPlanRuntime(), /plan runtime store is required/);
  assert.throws(() => createPlanRuntime({ store: {} }), /plan runtime store is required/);
});

test("plan runtime isolates active plans by session and restores the owning plan", () => {
  const harness = createHarness();
  harness.runtime.setPending({ steps, summary: "Plan A", body: "body", planId: "plan-a", requestId: "request-a" });
  assert.equal(harness.runtime.activatePending(), true);
  assert.equal(harness.runtime.snapshot().session, "session-a");

  harness.setSession("session-b");
  harness.runtime.reset();
  assert.equal(harness.runtime.snapshot(), null);

  harness.setSession("session-a");
  harness.runtime.reset();
  assert.equal(harness.runtime.snapshot().planId, "plan-a");
  assert.equal(harness.runtime.snapshot().completedSteps, 0);
});

test("model step completion requires evidence and archives only after every required step", () => {
  const harness = createHarness();
  harness.runtime.setPending({ steps, summary: "Plan", planId: "plan", requestId: "request" });
  assert.equal(harness.runtime.activatePending(), true);
  assert.equal(harness.runtime.markStepDone("one", [], { source: "model" }), false);
  assert.equal(harness.runtime.markStepDone("one", [{ evidenceId: "tool-1", verified: true }], { source: "model" }), true);
  assert.equal(harness.runtime.snapshot().steps[0].evidenceRefs[0].evidenceId, "tool-1");
  assert.equal(harness.archives.length, 0);
  assert.equal(harness.runtime.markStepDone("two", [{ evidenceId: "tool-2", verified: true }], { source: "model" }), true);
  assert.equal(harness.runtime.snapshot(), null);
  assert.equal(harness.archives.length, 1);
  assert.equal(harness.goals[0].status, "completed");
});

test("plan runtime applies an accepted revision without losing completed steps", () => {
  const harness = createHarness();
  harness.runtime.setPending({ steps, summary: "Original", planId: "plan", requestId: "request" });
  harness.runtime.activatePending();
  harness.runtime.markStepDone("one", [{ evidenceId: "tool-1", verified: true }], { source: "model" });
  harness.runtime.setRevision({
    reason: "change",
    summary: "Revised",
    remainingSteps: [{ id: "three", title: "Third", action: "do third", status: "pending" }],
  });
  assert.equal(harness.runtime.acceptRevision(), true);
  const snapshot = harness.runtime.snapshot();
  assert.deepEqual(snapshot.steps.map((step) => step.id), ["one", "three"]);
  assert.deepEqual(snapshot.completedStepIds, ["one"]);
  assert.equal(snapshot.summary, "Revised");
});

test("plan runtime cancels active state and keeps persistence failures from becoming success", () => {
  const harness = createHarness();
  harness.runtime.setPending({ steps, summary: "Cancel me", planId: "cancel-plan" });
  assert.equal(harness.runtime.activatePending(), true);
  assert.equal(harness.runtime.cancel(), true);
  assert.equal(harness.runtime.snapshot(), null);
  assert.equal(harness.goals[0].status, "cancelled");

  const failing = createHarness({ savePlanState: () => { throw new Error("disk unavailable"); } });
  failing.runtime.setPending({ steps, planId: "failed-plan" });
  assert.equal(failing.runtime.activatePending(), false);
  assert.equal(failing.runtime.snapshot().status, "pending");
});

test("plan runtime rejects invalid operations without mutating the active plan", () => {
  const harness = createHarness();
  assert.equal(harness.runtime.persist(), false);
  assert.equal(harness.runtime.markStepDone("missing", [], { source: "model" }), false);
  assert.equal(harness.runtime.acceptRevision(), false);
  harness.runtime.setPending({ steps: [], planId: "empty" });
  assert.equal(harness.runtime.activatePending(), false);
  assert.equal(harness.runtime.snapshot().status, "pending");
});

test("plan runtime keeps the active plan when archiving a completed plan fails", () => {
  const harness = createHarness({ archivePlanState: () => { throw new Error("archive unavailable"); } });
  harness.runtime.setPending({ steps: [{ id: "only", title: "Only" }], planId: "archive-failure" });
  assert.equal(harness.runtime.activatePending(), true);
  assert.equal(harness.runtime.markStepDone("only", [{ evidenceId: "tool", verified: true }], { source: "model" }), false);
  assert.equal(harness.runtime.snapshot().completedSteps, 1);
});
