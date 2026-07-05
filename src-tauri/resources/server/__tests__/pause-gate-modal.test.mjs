import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { requestToModal } from "../lib/pause-gate-modal.mjs";

describe("requestToModal — pauseGate 请求到弹窗映射", () => {
  const id = "gate-123";

  test("run_command → shell 弹窗（前台）", () => {
    const modal = requestToModal({ id, kind: "run_command", payload: { command: "npm test" } });
    assert.equal(modal.kind, "shell");
    assert.equal(modal._gateId, id);
    assert.equal(modal.command, "npm test");
    assert.equal(modal.allowPrefix, "npm");
    assert.equal(modal.shellKind, "foreground");
  });

  test("run_background → shell 弹窗（后台）", () => {
    const modal = requestToModal({ id, kind: "run_background", payload: { command: "node server.js" } });
    assert.equal(modal.kind, "shell");
    assert.equal(modal.shellKind, "background");
    assert.equal(modal.allowPrefix, "node");
  });

  test("choice → choice 弹窗", () => {
    const modal = requestToModal({ id, kind: "choice", payload: { question: "Which?", options: ["A", "B"], allowCustom: true } });
    assert.equal(modal.kind, "choice");
    assert.equal(modal.question, "Which?");
    assert.deepEqual(modal.options, ["A", "B"]);
    assert.equal(modal.allowCustom, true);
  });

  test("plan_proposed → plan 弹窗", () => {
    const modal = requestToModal({ id, kind: "plan_proposed", payload: { plan: "do X", steps: ["1", "2"], summary: "summary" } });
    assert.equal(modal.kind, "plan");
    assert.equal(modal.plan, "do X");
    assert.deepEqual(modal.steps, ["1", "2"]);
    assert.equal(modal.summary, "summary");
  });

  test("plan_checkpoint → checkpoint 弹窗", () => {
    const modal = requestToModal({ id, kind: "plan_checkpoint", payload: { stepId: "s1", title: "Step 1", result: "ok", notes: "done", completed: 1, total: 3 } });
    assert.equal(modal.kind, "checkpoint");
    assert.equal(modal.stepId, "s1");
    assert.equal(modal.title, "Step 1");
    assert.equal(modal.result, "ok");
    assert.equal(modal.completed, 1);
    assert.equal(modal.total, 3);
  });

  test("plan_revision → revision 弹窗", () => {
    const modal = requestToModal({ id, kind: "plan_revision", payload: { reason: "too complex", remainingSteps: 2, summary: "redo" } });
    assert.equal(modal.kind, "revision");
    assert.equal(modal.reason, "too complex");
    assert.equal(modal.remainingSteps, 2);
  });

  test("未知 kind → null（调用方处理警告+取消）", () => {
    assert.equal(requestToModal({ id, kind: "unknown_kind", payload: {} }), null);
    assert.equal(requestToModal({ id, kind: "path_access", payload: {} }), null);
  });
});
