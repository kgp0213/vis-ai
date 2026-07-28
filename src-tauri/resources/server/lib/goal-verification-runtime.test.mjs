import assert from "node:assert/strict";
import test from "node:test";

import { verifyGoalContract } from "./goal-verification-runtime.mjs";

const contract = {
  intent: "生成文件",
  executionRequired: true,
  expectedOutputs: [{ id: "out", kind: "artifact", path: "C:/work/out.txt" }],
};

test("assistant text is not evidence and missing artifact is incomplete", () => {
  const result = verifyGoalContract({ contract, executionState: "completed" });
  assert.equal(result.goalState, "incomplete");
  assert.deepEqual(result.missingCriteria, ["out"]);
});

test("verified artifact completes the goal", () => {
  const result = verifyGoalContract({
    contract,
    executionState: "completed",
    artifactEvidence: [{ id: "e1", status: "verified", verified: true, files: [{ path: "C:/work/out.txt", size: 4, isFile: true, readable: true }] }],
  });
  assert.equal(result.goalState, "verified");
  assert.equal(result.executionState, "completed");
});

test("recovered tool failures produce completed_with_warnings", () => {
  const result = verifyGoalContract({
    contract,
    executionState: "completed",
    toolFacts: [{ toolCallId: "call-1", state: "failed", exitCode: 1 }, { toolCallId: "call-2", state: "succeeded", exitCode: 0 }],
    artifactEvidence: [{ status: "verified", verified: true, files: [{ path: "C:/work/out.txt", size: 4, isFile: true }] }],
  });
  assert.equal(result.goalState, "verified");
  assert.equal(result.executionState, "completed_with_warnings");
});

test("unknown execution remains unknown", () => {
  const result = verifyGoalContract({ contract, executionState: "unknown" });
  assert.equal(result.executionState, "unknown");
  assert.equal(result.goalState, "unknown");
});

test("execution tasks without an explicit artifact still require host evidence", () => {
  const executionContract = { intent: "编译项目", executionRequired: true };
  const missing = verifyGoalContract({ contract: executionContract, executionState: "completed" });
  assert.equal(missing.goalState, "incomplete");
  assert.deepEqual(missing.missingCriteria, ["execution-evidence"]);

  const verified = verifyGoalContract({
    contract: executionContract,
    executionState: "completed",
    toolFacts: [{ toolCallId: "compile-1", status: "succeeded", exitCode: 0, command: "npm run build" }],
  });
  assert.equal(verified.goalState, "verified");
});
