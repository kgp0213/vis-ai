import assert from "node:assert/strict";
import test from "node:test";

import { classifyToolEvidence, verifyGoalContract } from "./goal-verification-runtime.mjs";
import { createTaskContract } from "./task-contract.mjs";

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
    artifactEvidence: [{ id: "e1", status: "verified", verified: true, files: [{ path: "C:/work/out.txt", size: 4, mtimeMs: 10, isFile: true, readable: true }] }],
  });
  assert.equal(result.goalState, "verified");
  assert.equal(result.executionState, "completed");
});

test("recovered tool failures produce completed_with_warnings", () => {
  const result = verifyGoalContract({
    contract,
    executionState: "completed",
    toolFacts: [{ toolCallId: "call-1", state: "failed", exitCode: 1 }, { toolCallId: "call-2", state: "succeeded", exitCode: 0 }],
    artifactEvidence: [{ status: "verified", verified: true, files: [{ path: "C:/work/out.txt", size: 4, mtimeMs: 10, isFile: true, readable: true }] }],
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
  assert.deepEqual(missing.missingCriteria, ["evidence:test"]);

  const verified = verifyGoalContract({
    contract: executionContract,
    executionState: "completed",
    toolFacts: [{ toolCallId: "compile-1", status: "succeeded", exitCode: 0, command: "npm run build" }],
  });
  assert.equal(verified.goalState, "verified");
});

test("an unrelated verified artifact cannot satisfy a kind-only output", () => {
  const result = verifyGoalContract({
    contract: { intent: "生成文件", executionRequired: true, expectedOutputs: [{ id: "out", kind: "artifact" }] },
    executionState: "completed",
    artifactEvidence: [{ id: "other", status: "verified", verified: true, files: [{ path: "C:/work/other.txt", size: 4, mtimeMs: 10, isFile: true, readable: true }] }],
  });
  assert.equal(result.goalState, "incomplete");
  assert.deepEqual(result.missingCriteria, ["out"]);
});

test("artifact evidence can satisfy a stable output id or resource id", () => {
  const byOutputId = verifyGoalContract({
    contract: { intent: "生成文件", executionRequired: true, expectedOutputs: [{ id: "out", kind: "artifact" }] },
    executionState: "completed",
    artifactEvidence: [{ id: "e1", status: "verified", verified: true, files: [{ outputId: "out", path: "C:/work/generated.txt", size: 4, mtimeMs: 10, isFile: true, readable: true }] }],
  });
  assert.equal(byOutputId.goalState, "verified");

  const byResourceId = verifyGoalContract({
    contract: { intent: "读取资源", executionRequired: true, expectedOutputs: [{ id: "out", kind: "artifact", resourceId: "resource-1" }] },
    executionState: "completed",
    artifactEvidence: [{ id: "e2", status: "verified", verified: true, files: [{ resourceId: "resource-1", path: "C:/work/resource.txt", size: 4, mtimeMs: 10, isFile: true, readable: true }] }],
  });
  assert.equal(byResourceId.goalState, "verified");

  const byStableOutputId = verifyGoalContract({
    contract: { intent: "生成文件", executionRequired: true, expectedOutputs: [{ id: "out", outputId: "stable-output", kind: "artifact" }] },
    executionState: "completed",
    artifactEvidence: [{ id: "e3", status: "verified", verified: true, files: [{ outputId: "stable-output", path: "C:/work/stable.txt", size: 4, mtimeMs: 10, isFile: true, readable: true }] }],
  });
  assert.equal(byStableOutputId.goalState, "verified");
});

test("a current-turn write is not a content verification", () => {
  const result = verifyGoalContract({
    contract,
    executionState: "completed",
    artifactEvidence: [{
      id: "write-only",
      status: "verified",
      files: [{ path: "C:/work/out.txt", size: 4, mtimeMs: 10, isFile: true, readable: true, verification: "current-turn-write" }],
    }],
  });
  assert.equal(result.goalState, "incomplete");
  assert.deepEqual(result.missingCriteria, ["out"]);
});

test("artifact verification fails closed when host file facts are incomplete", () => {
  const result = verifyGoalContract({
    contract,
    executionState: "completed",
    artifactEvidence: [{ status: "verified", verified: true, files: [{ path: "C:/work/out.txt", isFile: true, readable: true }] }],
  });
  assert.equal(result.goalState, "incomplete");
  assert.deepEqual(result.missingCriteria, ["out"]);
});

test("artifact path matching resolves equivalent Windows paths", () => {
  const result = verifyGoalContract({
    contract,
    executionState: "completed",
    artifactEvidence: [{
      id: "readback",
      status: "verified",
      verified: true,
      files: [{ path: "C:\\work\\sub\\..\\out.txt", size: 4, mtimeMs: 10, isFile: true, readable: true, status: "verified" }],
    }],
  });
  assert.equal(result.goalState, "verified");
});

test("relative expected output paths resolve against the task workspace", () => {
  const result = verifyGoalContract({
    workspaceDir: "C:/workspace",
    contract: {
      intent: "生成文件",
      executionRequired: true,
      expectedOutputs: [{ id: "out", kind: "artifact", path: "report.md" }],
    },
    executionState: "completed",
    artifactEvidence: [{
      id: "readback",
      status: "verified",
      verified: true,
      files: [{ path: "C:/workspace/report.md", size: 4, mtimeMs: 10, isFile: true, readable: true, status: "verified" }],
    }],
  });
  assert.equal(result.goalState, "verified");
  assert.deepEqual(result.missingCriteria, []);
});

test("a successful read-only tool cannot prove that a repair was completed", () => {
  const result = verifyGoalContract({
    contract: createTaskContract({ intent: "修复代码中的 bug" }),
    executionState: "completed",
    toolFacts: [{ toolCallId: "read-1", name: "read_file", status: "succeeded" }],
  });
  assert.equal(result.goalState, "incomplete");
  assert.deepEqual(result.missingCriteria, ["evidence:mutation"]);
  assert.equal(result.evidenceRefs[0].type, "tool_read");
});

test("repair and test tasks require both mutation and verification evidence", () => {
  const contract = createTaskContract({ intent: "修改并测试代码" });
  const mutationOnly = verifyGoalContract({
    contract,
    executionState: "completed",
    toolFacts: [{ toolCallId: "write-1", name: "write_file", status: "succeeded", evidenceType: "mutation" }],
  });
  assert.equal(mutationOnly.goalState, "incomplete");
  assert.deepEqual(mutationOnly.missingCriteria, ["evidence:test"]);

  const verified = verifyGoalContract({
    contract,
    executionState: "completed",
    toolFacts: [
      { toolCallId: "write-1", name: "write_file", status: "succeeded", evidenceType: "mutation" },
      { toolCallId: "test-1", name: "run_command", status: "succeeded", exitCode: 0, evidenceType: "test" },
    ],
  });
  assert.equal(verified.goalState, "verified");
});

test("tool evidence classification distinguishes reads, mutations, tests and external effects", () => {
  assert.equal(classifyToolEvidence({ name: "read_file" }), "tool_read");
  assert.equal(classifyToolEvidence({ name: "edit_file" }), "mutation");
  assert.equal(classifyToolEvidence({ name: "run_command", args: { command: "npm test" } }), "test");
  assert.equal(classifyToolEvidence({ name: "run_command", args: { command: "node script.mjs" } }), "execution");
  assert.equal(classifyToolEvidence({ name: "send_dws_message" }), "external_side_effect");
});
