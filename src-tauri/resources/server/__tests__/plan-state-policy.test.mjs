import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  isKnownPlanStep,
  isPlanComplete,
  normalizeCompletedStepIds,
} from "../lib/plan-state-policy.mjs";

const steps = ["x1", "x2", "x3", "x4"].map((id) => ({ id }));

describe("plan state policy", () => {
  test("旧计划和未知步骤 id 不计入新计划进度", () => {
    assert.deepEqual(normalizeCompletedStepIds(steps, ["pp1", "pp2", "x1", "x1"]), ["x1"]);
    assert.equal(isKnownPlanStep(steps, "pp1"), false);
    assert.equal(isKnownPlanStep(steps, "x2"), true);
  });

  test("只有当前计划的全部步骤完成后才归档", () => {
    assert.equal(isPlanComplete(steps, ["pp1", "pp2", "x1", "x2"]), false);
    assert.equal(isPlanComplete(steps, ["x1", "x2", "x3", "x4"]), true);
  });
});
