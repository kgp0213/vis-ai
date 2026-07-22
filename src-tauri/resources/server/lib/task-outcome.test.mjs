import test from "node:test";
import assert from "node:assert/strict";

import { deriveTaskState, detectTaskWarnings } from "./task-outcome.mjs";

test("capability limitations produce bounded warnings", () => {
  assert.deepEqual(detectTaskWarnings("已生成结果。当前环境不具备多模态理解能力，需要人工复核。"), ["当前环境不具备多模态理解能力，需要人工复核。"]);
  assert.deepEqual(detectTaskWarnings("任务已完成，没有限制。"), []);
});

test("task outcome keeps planning and degraded completion distinct", () => {
  assert.equal(deriveTaskState({ planningOnly: true }), "awaiting_approval");
  assert.equal(deriveTaskState({ planningOnly: true, executionStarted: true }), "completed");
  assert.equal(deriveTaskState({ continuationNeeded: true }), "incomplete");
  assert.equal(deriveTaskState({ continuationNeeded: true, interventionPaused: true }), "needs_intervention");
  assert.equal(deriveTaskState({ warnings: ["review required"] }), "completed_with_warnings");
  assert.equal(deriveTaskState({ artifactIncomplete: true, warnings: ["review required"] }), "incomplete");
  assert.equal(deriveTaskState({ interventionPaused: true }), "needs_intervention");
});
