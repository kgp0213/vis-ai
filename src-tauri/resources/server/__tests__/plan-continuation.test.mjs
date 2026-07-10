import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { decidePlanContinuation } from "../lib/plan-continuation.mjs";

const activePlan = { totalSteps: 4, completedSteps: 2 };

describe("plan continuation policy", () => {
  test("工具配额耗尽且计划未完成时自动续跑", () => {
    assert.equal(decidePlanContinuation({
      forcedSummaryReason: "budget",
      plan: activePlan,
      attempts: 0,
      maxAttempts: 2,
    }).action, "continue");
  });

  test("达到自动续跑上限后暂停并等待用户确认", () => {
    assert.equal(decidePlanContinuation({
      forcedSummaryReason: "budget",
      plan: activePlan,
      attempts: 2,
      maxAttempts: 2,
    }).action, "pause");
  });

  test("模型仅汇报进度但计划未完成时继续执行", () => {
    assert.equal(decidePlanContinuation({
      forcedSummaryReason: null,
      incompleteFinal: true,
      plan: activePlan,
      attempts: 0,
      maxAttempts: 2,
    }).action, "continue");
  });

  test("用户中止、非配额总结和已完成计划都不会自动续跑", () => {
    assert.equal(decidePlanContinuation({
      forcedSummaryReason: "budget",
      plan: activePlan,
      aborted: true,
    }).action, "none");
    assert.equal(decidePlanContinuation({
      forcedSummaryReason: "context-guard",
      plan: activePlan,
    }).action, "none");
    assert.equal(decidePlanContinuation({
      forcedSummaryReason: "budget",
      plan: { totalSteps: 4, completedSteps: 4 },
    }).action, "none");
  });
});
