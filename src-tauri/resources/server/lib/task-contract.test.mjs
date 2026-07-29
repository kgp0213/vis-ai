import assert from "node:assert/strict";
import test from "node:test";

import { createTaskContract, isExecutionTask, mapLegacyTaskState, normalizeTaskContract } from "./task-contract.mjs";

test("task contract uses evidence policy for execution tasks and light policy for chat", () => {
  const chat = createTaskContract({ operationId: "op-1", sessionId: "s-1", intent: "解释这段文字" });
  assert.equal(chat.executionRequired, false);
  assert.equal(chat.completionPolicy, "execution_only");

  const file = createTaskContract({
    operationId: "op-2",
    sessionId: "s-1",
    intent: "生成报告文件",
    expectedOutputs: [{ id: "report", kind: "artifact", path: "out/report.md", acceptanceCriteria: ["has content"] }],
    acceptanceCriteria: [{ id: "criterion", title: "报告可读取" }],
  });
  assert.equal(file.executionRequired, true);
  assert.equal(file.completionPolicy, "evidence_required");
  assert.equal(file.expectedOutputs[0].required, true);
  assert.deepEqual(file.expectedOutputs[0].acceptanceCriteria, ["has content"]);
  assert.equal(file.acceptanceCriteria[0].description, "报告可读取");
});

test("task contract normalizes legacy fields without exposing credentials", () => {
  const contract = normalizeTaskContract({ intent: "编译项目", expectedOutputs: [{ description: "binary" }], requiresApproval: true }, { operationId: "op" });
  assert.equal(contract.operationId, "op");
  assert.equal(contract.requiresApproval, true);
  assert.match(contract.expectedOutputs[0].id, /^output-/);
  assert.equal(isExecutionTask({ kind: "code" }), true);
});

test("legacy task states map conservatively", () => {
  assert.equal(mapLegacyTaskState("succeeded"), "completed");
  assert.equal(mapLegacyTaskState("completed_with_warnings"), "completed_with_warnings");
  assert.equal(mapLegacyTaskState("anything else"), "unknown");
  assert.equal(mapLegacyTaskState(null), null);
});

test("ordinary file questions do not become execution tasks from a noun alone", () => {
  assert.equal(isExecutionTask({ intent: "看看这个文件" }), false);
  assert.equal(isExecutionTask({ intent: "分析这段代码并解释原因" }), false);
  assert.equal(isExecutionTask({ intent: "读取并验证这个文件" }), true);
  assert.equal(isExecutionTask({ intent: "把结果保存为 report.md" }), true);
});

test("task contracts derive host evidence requirements from the requested outcome", () => {
  const repair = createTaskContract({ intent: "修复代码中的 bug" });
  assert.deepEqual(repair.requiredEvidence, ["mutation"]);

  const repairAndTest = createTaskContract({ intent: "修改并测试代码" });
  assert.deepEqual(repairAndTest.requiredEvidence, ["mutation", "test"]);

  const external = createTaskContract({ intent: "发送结果", sideEffects: ["external"] });
  assert.deepEqual(external.requiredEvidence, ["external_side_effect"]);

  const artifact = createTaskContract({
    intent: "生成报告文件",
    expectedOutputs: [{ id: "report", path: "report.md" }],
  });
  assert.deepEqual(artifact.requiredEvidence, []);
});
