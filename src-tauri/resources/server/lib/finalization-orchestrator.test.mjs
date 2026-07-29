import assert from "node:assert/strict";
import test from "node:test";

import { createFinalizationOrchestrator, evaluateTurnFinalization } from "./finalization-orchestrator.mjs";

const contract = {
  intent: "create output",
  executionRequired: true,
  expectedOutputs: [{ id: "output", kind: "artifact", path: "C:/work/out.txt", required: true }],
};
const artifactEvidence = [{
  id: "artifact-1",
  status: "verified",
  verified: true,
  files: [{ path: "C:/work/out.txt", size: 4, mtimeMs: 10, isFile: true, readable: true, status: "verified" }],
}];

test("finalization orchestrator requires a persistence boundary", () => {
  assert.throws(() => createFinalizationOrchestrator(), /persistTurnFinalization is required/);
});

test("turn finalization evaluation separates execution and verified goal state", () => {
  const result = evaluateTurnFinalization({
    taskContract: contract,
    executionFactState: "completed",
    artifactEvidence,
    artifactRequired: true,
    artifactVerified: true,
    executionStarted: true,
  });
  assert.equal(result.executionState, "completed");
  assert.equal(result.goalState, "verified");
  assert.equal(result.taskState, "completed");
  assert.equal(result.completionOk, true);
});

test("finalization persists before publishing the authoritative event", async () => {
  const order = [];
  const orchestrator = createFinalizationOrchestrator({
    persistTurnFinalization: async () => { order.push("persist"); return true; },
    publishTurnFinalized: () => order.push("publish"),
  });
  const receipt = {
    recordGoalVerification() {},
    recordAuthorizationFacts() {},
    recordToolRepeat() {},
    complete() {},
    snapshot: () => ({ artifactEvidence }),
    recordError() {},
    markUnknown() {},
  };
  const result = await orchestrator.finalize({
    evaluation: evaluateTurnFinalization({
      taskContract: contract,
      executionFactState: "completed",
      artifactEvidence,
      artifactRequired: true,
      artifactVerified: true,
      executionStarted: true,
    }),
    receipt,
    persistence: { operationId: "op", assistant: { messageId: "message", turnId: "turn", text: "done" } },
    event: { id: "message", turnId: "turn", operationId: "op", text: "done" },
  });
  assert.deepEqual(order, ["persist", "publish"]);
  assert.equal(result.persisted, true);
  assert.equal(result.executionState, "completed");
});

test("persistence failure publishes unknown instead of optimistic success", async () => {
  let published = null;
  const errors = [];
  const orchestrator = createFinalizationOrchestrator({
    persistTurnFinalization: async () => false,
    publishTurnFinalized: (event) => { published = event; },
    onPersistenceFailure: (error) => errors.push(error),
  });
  const receipt = {
    recordGoalVerification() {},
    recordAuthorizationFacts() {},
    recordToolRepeat() {},
    complete() {},
    snapshot: () => ({ artifactEvidence }),
    recordError: (error) => errors.push(error),
    markUnknown: (error) => errors.push(error),
  };
  const result = await orchestrator.finalize({
    evaluation: evaluateTurnFinalization({
      taskContract: contract,
      executionFactState: "completed",
      artifactEvidence,
      artifactRequired: true,
      artifactVerified: true,
      executionStarted: true,
    }),
    receipt,
    persistence: { operationId: "op", assistant: { messageId: "message", turnId: "turn", text: "done" } },
    event: { id: "message", turnId: "turn", operationId: "op", text: "done" },
  });
  assert.equal(result.persisted, false);
  assert.equal(result.executionState, "unknown");
  assert.equal(result.goalState, "unknown");
  assert.equal(published.executionState, "unknown");
  assert.equal(published.persisted, false);
  assert.ok(errors.length >= 1);
});

test("evaluation keeps an unverified required artifact incomplete and upgrades warnings", () => {
  const missing = evaluateTurnFinalization({
    taskContract: contract,
    executionFactState: "completed",
    artifactRequired: true,
    artifactVerified: false,
    executionStarted: true,
  });
  assert.equal(missing.goalState, "incomplete");
  assert.equal(missing.taskState, "incomplete");
  const warned = evaluateTurnFinalization({
    taskContract: { intent: "answer", executionRequired: false },
    executionFactState: "completed",
    executionStarted: true,
    warnings: ["host warning"],
  });
  assert.equal(warned.executionState, "completed_with_warnings");
  assert.equal(warned.completionOk, true);
});

test("finalization converts a thrown persistence error into an unknown result", async () => {
  const errors = [];
  let published = null;
  const orchestrator = createFinalizationOrchestrator({
    persistTurnFinalization: async () => { throw new Error("disk unavailable"); },
    publishTurnFinalized: (event) => { published = event; },
    onPersistenceFailure: (error) => errors.push(error?.message || String(error)),
  });
  const result = await orchestrator.finalize({
    evaluation: { taskState: "completed", executionState: "completed", goalState: "verified", completionOk: true, evidenceRefs: [], warnings: [] },
    persistence: { operationId: "op", assistant: { messageId: "message", turnId: "turn", text: "done" } },
    event: { id: "message" },
  });
  assert.equal(result.executionState, "unknown");
  assert.equal(published.persisted, false);
  assert.ok(errors.length >= 1);
});

test("default finalization callbacks remain safe without a receipt", async () => {
  const orchestrator = createFinalizationOrchestrator({
    persistTurnFinalization: async () => true,
  });
  const result = await orchestrator.finalize({
    evaluation: {
      taskState: "completed",
      executionState: "completed",
      goalState: "verified",
      completionOk: true,
      evidenceRefs: [],
      warnings: [],
    },
  });
  assert.equal(result.persisted, true);
  assert.equal(result.taskState, "completed");
});

test("default persistence failure callback is safe without a receipt", async () => {
  const orchestrator = createFinalizationOrchestrator({
    persistTurnFinalization: async () => false,
  });
  const result = await orchestrator.finalize({
    evaluation: {
      taskState: "completed",
      executionState: "completed",
      goalState: "verified",
      completionOk: true,
      evidenceRefs: [],
      warnings: [],
    },
  });
  assert.equal(result.persisted, false);
  assert.equal(result.executionState, "unknown");
});
