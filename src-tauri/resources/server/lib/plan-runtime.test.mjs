import assert from "node:assert/strict";
import test from "node:test";

import { createPlanRuntime, projectPlanStepEvidence } from "./plan-runtime.mjs";

function createHarness(options = {}) {
  let session = "session-a";
  const active = new Map();
  const archives = [];
  const events = [];
  const goals = [];
  const savePlanState = (name, steps, completedStepIds, extras) => {
    const state = {
      version: 2,
      steps: steps.map((step) => ({ ...step })),
      completedStepIds: [...completedStepIds],
      updatedAt: "2026-07-28T00:00:00.000Z",
      ...extras,
    };
    active.set(name, state);
    return state;
  };
  const store = {
    loadPlanState: (name) => active.get(name) ?? null,
    savePlanState: options.savePlanState
      ? (...args) => options.savePlanState(...args, savePlanState)
      : savePlanState,
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

const hostEvidence = (evidenceId) => ({
  evidenceId,
  source: "host_tool",
  issuedByHost: true,
  verified: true,
});

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
  assert.equal(harness.runtime.markStepDone("one", [hostEvidence("tool-1")], { source: "model" }), true);
  assert.equal(harness.runtime.snapshot().steps[0].evidenceRefs[0].evidenceId, "tool-1");
  assert.equal(harness.archives.length, 0);
  assert.equal(harness.runtime.markStepDone("two", [hostEvidence("tool-2")], { source: "model" }), true);
  assert.equal(harness.runtime.snapshot(), null);
  assert.equal(harness.archives.length, 1);
  assert.equal(harness.goals[0].status, "completed");
});

test("model evidence proposals cannot complete a step without a host signature", () => {
  const harness = createHarness();
  harness.runtime.setPending({ steps: [{ id: "only", title: "Only" }], planId: "plan" });
  assert.equal(harness.runtime.activatePending(), true);
  assert.equal(harness.runtime.markStepDone("only", [{ evidenceId: "model-claim", type: "host_tool", verified: true }], { source: "model" }), false);
  assert.equal(harness.runtime.snapshot().completedSteps, 0);
  assert.equal(harness.runtime.markStepDone("only", [hostEvidence("host-fact")], { source: "model" }), true);
});

test("host tool evidence is step-scoped and cannot be consumed twice", () => {
  const plan = {
    steps: [
      { id: "one", status: "completed", evidenceRefs: [hostEvidence("call-a")] },
      { id: "two", status: "pending" },
    ],
    completedStepIds: ["one"],
  };
  const common = { plan, operationId: "operation-1", requestId: "request-1", sessionId: "session-1" };
  assert.deepEqual(projectPlanStepEvidence({ ...common, stepId: "one", facts: [{ toolCallId: "call-a", status: "succeeded", evidenceSeq: 1 }] }), []);
  assert.deepEqual(projectPlanStepEvidence({ ...common, stepId: "two", facts: [{ toolCallId: "call-a", status: "succeeded", evidenceSeq: 1 }] }), []);

  const fresh = projectPlanStepEvidence({
    ...common,
    stepId: "two",
    facts: [
      { toolCallId: "call-a", toolName: "read_file", status: "succeeded", evidenceSeq: 1 },
      { toolCallId: "call-b", toolName: "run_command", status: "succeeded", evidenceSeq: 2 },
    ],
  });
  assert.deepEqual(fresh.map((entry) => entry.evidenceId), ["call-b"]);
  assert.equal(fresh[0].stepId, "two");
  assert.equal(fresh[0].operationId, "operation-1");
});

test("plan evidence cursor excludes pre-plan facts and prevents truncated evidence reuse", () => {
  const facts = Array.from({ length: 40 }, (_, index) => ({
    toolCallId: `call-${index + 1}`,
    toolName: "read_file",
    status: "succeeded",
    evidenceSeq: index + 1,
  }));
  const plan = { steps: [{ id: "one", status: "pending" }], completedStepIds: [] };
  const projected = projectPlanStepEvidence({ plan, stepId: "one", facts, afterEvidenceSeq: 8 });
  assert.equal(projected.length, 32);
  assert.equal(projected[0].evidenceId, "call-9");
  assert.equal(projected.at(-1).evidenceSeq, 40);
  assert.deepEqual(projectPlanStepEvidence({ plan, stepId: "one", facts, afterEvidenceSeq: 40 }), []);
});

test("plan runtime owns active identity and step membership checks", () => {
  const harness = createHarness();
  harness.runtime.setPending({
    planId: "plan-1",
    requestId: "request-1",
    steps: [{ id: "step-1", title: "Read", action: "read" }],
  });
  assert.equal(harness.runtime.activatePending(), true);
  assert.equal(harness.runtime.belongsToRequest("request-1"), true);
  assert.equal(harness.runtime.hasActiveStep("step-1"), true);
  assert.equal(harness.runtime.bindActivePlanIdentity({ requestId: "request-2", planId: "plan-2" }), true);
  assert.equal(harness.runtime.belongsToRequest("request-1"), false);
  assert.equal(harness.runtime.belongsToRequest("request-2"), true);
  assert.equal(harness.runtime.snapshot().planId, "plan-2");
});

test("plan runtime applies an accepted revision without losing completed steps", () => {
  const harness = createHarness();
  harness.runtime.setPending({ steps, summary: "Original", planId: "plan", requestId: "request" });
  harness.runtime.activatePending();
  harness.runtime.markStepDone("one", [hostEvidence("tool-1")], { source: "model" });
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

test("plan runtime explicitly discards rejected pending plans and revisions", () => {
  const harness = createHarness();
  harness.runtime.setPending({ steps, summary: "Reject me", planId: "pending-plan" });
  assert.equal(harness.runtime.snapshot().status, "pending");
  assert.equal(harness.runtime.discardPending("user_rejected"), true);
  assert.equal(harness.runtime.snapshot(), null);

  harness.runtime.setPending({ steps, summary: "Active", planId: "active-plan" });
  assert.equal(harness.runtime.activatePending(), true);
  harness.runtime.setRevision({
    reason: "replace",
    remainingSteps: [{ id: "three", title: "Third", action: "third" }],
  });
  assert.equal(harness.runtime.discardRevision("user_rejected"), true);
  assert.equal(harness.runtime.acceptRevision(), false);
  assert.deepEqual(harness.runtime.snapshot().steps.map((step) => step.id), ["one", "two"]);
  assert.equal(harness.events.some((event) => event.kind === "plan-pending-discarded"), true);
  assert.equal(harness.events.some((event) => event.kind === "plan-revision-discarded"), true);
});

test("plan runtime events carry the authoritative Plan snapshot", () => {
  const harness = createHarness();
  harness.runtime.setPending({ steps, summary: "Event plan", planId: "event-plan" });
  assert.equal(harness.runtime.activatePending(), true);
  const activated = harness.events.find((event) => event.kind === "plan-activated");
  assert.equal(activated.plan.status, "active");
  assert.equal(activated.plan.planId, "event-plan");

  assert.equal(harness.runtime.markStepDone("one", [hostEvidence("tool-1")], { source: "model" }), true);
  const progressed = harness.events.find((event) => event.kind === "plan-step-complete");
  assert.deepEqual(progressed.plan.completedStepIds, ["one"]);

  assert.equal(harness.runtime.cancel(), true);
  const cancelled = harness.events.find((event) => event.kind === "plan-cancelled");
  assert.equal(cancelled.plan, null);
});

test("plan runtime can bind a session explicitly without launcher mirrors", () => {
  const harness = createHarness();
  harness.runtime.setPending({ steps, summary: "A", planId: "plan-a" });
  harness.runtime.activatePending();
  assert.equal(harness.runtime.bindSession("session-b"), null);
  assert.equal(harness.runtime.snapshot(), null);
  assert.equal(harness.runtime.bindSession("session-a").planId, "plan-a");
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
  assert.equal(harness.runtime.markStepDone("only", [hostEvidence("tool")], { source: "model" }), false);
  assert.equal(harness.runtime.snapshot().completedSteps, 1);
});

test("plan runtime rolls back in-memory mutations when persistence fails", () => {
  let rejectSave = false;
  const harness = createHarness({
    savePlanState: (...args) => {
      const fallback = args.pop();
      if (rejectSave) throw new Error("disk unavailable");
      return fallback(...args);
    },
  });
  harness.runtime.setPending({ steps, summary: "Original", planId: "plan", requestId: "request" });
  assert.equal(harness.runtime.activatePending(), true);
  const original = harness.runtime.snapshot();

  rejectSave = true;
  assert.equal(harness.runtime.markStepDone("one", [hostEvidence("tool")], { source: "model" }), false);
  assert.deepEqual(harness.runtime.snapshot(), original);

  harness.runtime.setRevision({
    reason: "replace",
    summary: "Changed",
    remainingSteps: [{ id: "three", title: "Third", action: "third" }],
  });
  assert.equal(harness.runtime.acceptRevision(), false);
  assert.deepEqual(harness.runtime.snapshot(), original);

  assert.equal(harness.runtime.bindActivePlanIdentity({ planId: "changed", requestId: "changed" }), false);
  assert.deepEqual(harness.runtime.snapshot(), original);
});
