import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  applyForegroundIntervention,
  assessTaskComplexity,
  beginForegroundDispatch,
  buildForegroundIntervention,
  buildForegroundTaskPrompt,
  evaluateForegroundTask,
  finishForegroundTask,
  normalizeForegroundModelFailure,
  pauseForegroundTask,
  recordForegroundPlan,
  recordForegroundArtifacts,
  recordForegroundStepCompletion,
  recordForegroundToolEvent,
  restoreForegroundTask,
  resumeForegroundTask,
  startForegroundTask,
} from "./foreground-task-supervisor.mjs";

const launcherSource = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");

describe("foreground task admission", () => {
  test("keeps low-risk one-step requests on the ordinary tool loop", () => {
    for (const prompt of [
      "解释 src/app.js 这段代码",
      "打开 notes.txt 看一下",
      "我们讨论一下大型 PDF 的处理思路",
      "把刚才的回答保存为 notes.md",
    ]) {
      const assessment = assessTaskComplexity({
        prompt,
        artifactRequired: /保存/.test(prompt),
      });
      assert.equal(assessment.classification, "simple", prompt);
    }
  });

  test("promotes durable, multi-step, complete-coverage and resumed work", () => {
    const cases = [
      {
        input: { prompt: "提取 manual.pdf 完整内容并保存为 manual.md", artifactRequired: true, completeCoverage: true },
        reason: "complete-coverage",
      },
      {
        input: { prompt: "先制定计划，然后修改三个模块、运行测试并按计划落地" },
        reason: "explicit-plan",
      },
      {
        input: { prompt: "批量处理目录下所有文件，生成汇总报告并保留断点恢复" },
        reason: "multi-target",
      },
      {
        input: { prompt: "继续", activePlan: { totalSteps: 4, completedSteps: 1, steps: [{ id: "s1", title: "调查", action: "inspect" }] } },
        reason: "active-plan",
      },
      {
        input: { prompt: "删除生产环境中的全部历史数据" },
        reason: "high-impact-side-effect",
      },
      {
        input: { prompt: "修改多个模块并验证兼容性" },
        reason: "multi-target",
      },
    ];
    for (const { input, reason } of cases) {
      const assessment = assessTaskComplexity(input);
      assert.equal(assessment.classification, "complex", input.prompt);
      assert.ok(assessment.reasons.includes(reason), `${input.prompt}: ${assessment.reasons.join(",")}`);
    }
  });
});

describe("foreground task upgrade and inheritance", () => {
  test("upgrades in place and retains prior messages plus tool evidence", () => {
    const history = [
      { role: "user", content: "检查项目" },
      { role: "assistant", content: "我先读取配置", tool_calls: [{ id: "c1" }] },
      { role: "tool", content: "existing result", name: "read_file" },
    ];
    let state = startForegroundTask({
      turnId: "turn-1",
      prompt: "检查项目",
      assessment: assessTaskComplexity({ prompt: "检查项目" }),
      history,
    });
    state = recordForegroundToolEvent(state, {
      toolName: "read_file",
      toolArgs: "{\"path\":\"large.log\"}",
      content: "x".repeat(70_000),
      readOnly: true,
      succeeded: true,
    });
    const evaluated = evaluateForegroundTask(state, {
      contextStatus: { pendingCount: 1, pendingChars: 70_000 },
      sawToolActivity: true,
    });
    assert.equal(evaluated.state.classification, "complex");
    assert.equal(evaluated.state.inherited.messageCount, 3);
    assert.equal(evaluated.state.inherited.toolResultCount, 1);
    assert.equal(evaluated.state.evidence.totalToolCalls, 1);
    assert.ok(evaluated.state.upgrade.reasons.includes("large-context-input"));
    assert.equal(evaluated.decision.type, "plan");

    const restored = restoreForegroundTask(JSON.parse(JSON.stringify(evaluated.state)));
    assert.deepEqual(restored.inherited, evaluated.state.inherited);
    assert.deepEqual(restored.evidence.calls, evaluated.state.evidence.calls);
  });
});

describe("foreground task step supervision", () => {
  function complexState() {
    return startForegroundTask({
      turnId: "turn-2",
      prompt: "修改两个模块并验证",
      assessment: assessTaskComplexity({ prompt: "先制定计划，然后修改两个模块并验证" }),
      history: [],
      artifactRequired: false,
    });
  }

  test("dispatches one current step at a time without a global continuation cap", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [
        { id: "s1", title: "调查", action: "inspect" },
        { id: "s2", title: "修改", action: "edit" },
        { id: "s3", title: "测试", action: "test" },
        { id: "s4", title: "复核", action: "review" },
      ],
      completedStepIds: [],
    });

    for (const stepId of ["s1", "s2", "s3", "s4"]) {
      const evaluated = evaluateForegroundTask(state, {});
      assert.equal(evaluated.decision.type, "step");
      assert.equal(evaluated.decision.step.id, stepId);
      state = beginForegroundDispatch(evaluated.state, evaluated.decision);
      state = recordForegroundToolEvent(state, {
        toolName: stepId === "s3" ? "run_command" : "read_file",
        toolArgs: `{\"step\":\"${stepId}\"}`,
        content: `evidence for ${stepId}`,
        readOnly: stepId !== "s3",
        succeeded: true,
      });
      state = recordForegroundStepCompletion(state, { stepId, result: `${stepId} done` });
    }

    const verification = evaluateForegroundTask(state, {});
    assert.equal(verification.decision.type, "verify");
    state = beginForegroundDispatch(verification.state, verification.decision);
    state = recordForegroundToolEvent(state, {
      toolName: "run_command",
      toolArgs: "{\"command\":\"npm test\"}",
      content: "tests passed",
      readOnly: true,
      succeeded: true,
    });
    const completed = evaluateForegroundTask(state, {});
    assert.equal(completed.decision.type, "complete");
    assert.equal(completed.state.workPlan.completedStepIds.length, 4);
    assert.equal(Object.keys(completed.state.checkpoints.steps).length, 4);
  });

  test("keeps a long step running while every dispatch window adds novel evidence", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [{ id: "s1", title: "调查", action: "inspect every source" }],
      completedStepIds: [],
    });
    for (let window = 1; window <= 5; window += 1) {
      const evaluated = evaluateForegroundTask(state, {});
      assert.equal(evaluated.decision.type, "step");
      state = beginForegroundDispatch(evaluated.state, evaluated.decision);
      state = recordForegroundToolEvent(state, {
        toolName: "read_file",
        toolArgs: JSON.stringify({ path: `source-${window}.txt` }),
        content: `new evidence ${window}`,
        readOnly: true,
        succeeded: true,
      });
      const continued = evaluateForegroundTask(state, {});
      assert.equal(continued.decision.type, "step");
      assert.equal(continued.state.dispatch.stepNoProgressStreak.s1, 0);
      state = continued.state;
    }
  });

  test("pauses only after consecutive dispatch windows add no evidence", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [{ id: "s1", title: "修改", action: "edit" }],
      completedStepIds: [],
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const evaluated = evaluateForegroundTask(state, {});
      state = beginForegroundDispatch(evaluated.state, evaluated.decision);
      state = evaluateForegroundTask(state, {}).state;
    }
    const stalled = evaluateForegroundTask(state, {});
    assert.equal(stalled.decision.type, "intervene");
    assert.equal(stalled.decision.reason, "step-no-progress");
    assert.equal(stalled.state.dispatch.stepNoProgressStreak.s1, 3);
    const card = buildForegroundIntervention(stalled.state, stalled.decision);
    assert.equal(card.kind, "choice");
    assert.equal(card.options[0].id, "continue");
    assert.ok(card.options.some((option) => option.id === "accept-partial"));
  });

  test("rejects model-declared step completion without new host evidence", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [{ id: "s1", title: "修改", action: "edit" }],
      completedStepIds: [],
    });
    const decision = evaluateForegroundTask(state, {}).decision;
    state = beginForegroundDispatch(state, decision);

    assert.throws(
      () => recordForegroundStepCompletion(state, { stepId: "s1", result: "done" }),
      /new host evidence/i,
    );
    assert.deepEqual(state.workPlan.completedStepIds, []);

    state = recordForegroundToolEvent(state, {
      toolName: "write_file",
      toolArgs: '{"path":"result.txt"}',
      content: "written",
      readOnly: false,
      succeeded: true,
    });
    state = recordForegroundStepCompletion(state, { stepId: "s1", result: "wrote result.txt" });
    assert.deepEqual(state.workPlan.completedStepIds, ["s1"]);
    assert.equal(state.checkpoints.steps.s1.result, "wrote result.txt");
    assert.deepEqual(state.checkpoints.steps.s1.toolCallIndexes, [1]);
  });

  test("retains window progress after bounded evidence details roll over", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [{ id: "s1", title: "调查", action: "inspect a large source set" }],
      completedStepIds: [],
    });
    state = beginForegroundDispatch(state, evaluateForegroundTask(state, {}).decision);
    state = recordForegroundToolEvent(state, {
      toolName: "read_file",
      toolArgs: '{"path":"source-1.txt"}',
      content: "confirmed source evidence",
      readOnly: true,
      succeeded: true,
    });
    for (let index = 0; index < 70; index += 1) {
      state = recordForegroundToolEvent(state, {
        toolName: "run_command",
        toolArgs: JSON.stringify({ command: `missing-command-${index}` }),
        content: `[exit 1]`,
        readOnly: false,
        succeeded: false,
      });
    }

    state = recordForegroundStepCompletion(state, { stepId: "s1", result: "inspected available sources" });
    assert.equal(state.checkpoints.steps.s1.novelProgressCount, 1);
    assert.deepEqual(state.workPlan.completedStepIds, ["s1"]);
  });

  test("non-recoverable provider failures pause immediately without consuming another step attempt", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [
        { id: "s1", title: "调查", action: "inspect" },
        { id: "s2", title: "生成", action: "generate" },
      ],
      completedStepIds: ["s1"],
    });
    const dispatched = evaluateForegroundTask(state, {});
    state = beginForegroundDispatch(dispatched.state, dispatched.decision);
    assert.equal(state.dispatch.stepNoProgressStreak.s2, 0);

    const failure = normalizeForegroundModelFailure({
      error: 'OpenAI 429: {"error":{"code":"AccountQuotaExceeded","message":"quota resets at 2026-07-21T01:00:28+08:00"}}',
    });
    const evaluated = evaluateForegroundTask(state, { modelFailure: failure });

    assert.equal(evaluated.decision.type, "intervene");
    assert.equal(evaluated.decision.reason, "provider-blocked");
    assert.equal(evaluated.state.lifecycle, "waiting_user");
    assert.equal(evaluated.state.dispatch.stepNoProgressStreak.s2, 0);
    assert.deepEqual(evaluated.state.workPlan.completedStepIds, ["s1"]);
    assert.equal(evaluated.state.workPlan.steps.length, 2);
    assert.equal(evaluated.state.blockingFailure.code, "AccountQuotaExceeded");
    assert.match(evaluated.state.blockingFailure.retryAt, /2026-07-21T01:00:28/);

    const card = buildForegroundIntervention(evaluated.state, evaluated.decision);
    assert.match(card.question, /服务|模型|配额/);
    assert.ok(card.options.some((option) => option.id === "wait"));
    assert.ok(card.options.some((option) => option.id === "switch-model"));
    assert.ok(card.options.some((option) => option.id === "stop"));
  });

  test("structural tool failures pause without spending no-progress windows", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [{ id: "s1", title: "探测能力", action: "probe" }],
      completedStepIds: [],
    });
    state = beginForegroundDispatch(state, evaluateForegroundTask(state, {}).decision);
    state = recordForegroundToolEvent(state, {
      toolName: "run_command",
      toolArgs: '{"command":"missing-tool --version"}',
      content: "$ missing-tool --version\n[exit 9009]\n'missing-tool' is not recognized",
      readOnly: false,
      succeeded: false,
    });

    const evaluated = evaluateForegroundTask(state, {});
    assert.equal(evaluated.decision.type, "intervene");
    assert.equal(evaluated.decision.reason, "tool-structural-failure");
    assert.equal(evaluated.state.lifecycle, "waiting_user");
    assert.equal(evaluated.state.dispatch.stepNoProgressStreak.s1, 0);
  });

  test("requires successful read-only evidence during final verification", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [{ id: "s1", title: "修改", action: "edit" }],
      completedStepIds: [],
    });
    state = beginForegroundDispatch(state, evaluateForegroundTask(state, {}).decision);
    state = recordForegroundToolEvent(state, {
      toolName: "write_file",
      toolArgs: "{\"path\":\"result.md\"}",
      content: "ok",
      readOnly: false,
      succeeded: true,
    });
    state = recordForegroundStepCompletion(state, { stepId: "s1", result: "written" });

    const verification = evaluateForegroundTask(state, {});
    state = beginForegroundDispatch(verification.state, verification.decision);
    state = recordForegroundToolEvent(state, {
      toolName: "write_file",
      toolArgs: "{\"path\":\"result.md\"}",
      content: "rewritten",
      readOnly: false,
      succeeded: true,
    });
    state = recordForegroundToolEvent(state, {
      toolName: "ask_choice",
      toolArgs: "{}",
      content: "continue",
      readOnly: true,
      verificationEvidence: false,
      succeeded: true,
    });
    const missingEvidence = evaluateForegroundTask(state, {});
    assert.equal(missingEvidence.decision.type, "intervene");
    assert.equal(missingEvidence.decision.reason, "verification-evidence-missing");

    state = applyForegroundIntervention(missingEvidence.state, "continue", missingEvidence.decision);
    const retryVerification = evaluateForegroundTask(state, {});
    assert.equal(retryVerification.decision.type, "verify");
    state = beginForegroundDispatch(retryVerification.state, retryVerification.decision);
    state = recordForegroundToolEvent(state, {
      toolName: "read_file",
      toolArgs: "{\"path\":\"result.md\"}",
      content: "verified",
      readOnly: true,
      succeeded: true,
    });
    assert.equal(evaluateForegroundTask(state, {}).decision.type, "complete");
  });

  test("bounds repeated verification-evidence interventions", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [{ id: "s1", title: "修改", action: "edit" }],
      completedStepIds: [],
    });
    state = beginForegroundDispatch(state, evaluateForegroundTask(state, {}).decision);
    state = recordForegroundToolEvent(state, {
      toolName: "write_file",
      toolArgs: '{"path":"result.md"}',
      content: "written",
      readOnly: false,
      succeeded: true,
    });
    state = recordForegroundStepCompletion(state, { stepId: "s1", result: "written" });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const verify = evaluateForegroundTask(state, {});
      state = beginForegroundDispatch(verify.state, verify.decision);
      state = recordForegroundToolEvent(state, {
        toolName: "ask_choice",
        toolArgs: "{}",
        content: "still no verification",
        readOnly: true,
        verificationEvidence: false,
        succeeded: true,
      });
      const missing = evaluateForegroundTask(state, {});
      assert.equal(missing.decision.reason, "verification-evidence-missing");
      state = applyForegroundIntervention(missing.state, "continue", missing.decision);
    }

    const verify = evaluateForegroundTask(state, {});
    state = beginForegroundDispatch(verify.state, verify.decision);
    state = recordForegroundToolEvent(state, {
      toolName: "ask_choice",
      toolArgs: "{}",
      content: "still no verification",
      readOnly: true,
      verificationEvidence: false,
      succeeded: true,
    });
    const exhausted = evaluateForegroundTask(state, {});
    assert.notEqual(exhausted.decision.reason, "verification-evidence-missing");
    assert.ok(["partial", "intervene"].includes(exhausted.decision.type));
  });

  test("verifies user-accepted partial results before settling the outcome", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [{ id: "s1", title: "处理", action: "process" }],
      completedStepIds: [],
    });
    state = beginForegroundDispatch(state, evaluateForegroundTask(state, {}).decision);
    state = recordForegroundToolEvent(state, {
      toolName: "write_file",
      toolArgs: '{"path":"partial.md"}',
      content: "partial result",
      readOnly: false,
      succeeded: true,
    });
    state = recordForegroundStepCompletion(state, { stepId: "s1", result: "partial result" });
    state.acceptance.completeCoverage = true;
    state = applyForegroundIntervention(state, "accept-partial", { reason: "source-coverage-pending" });

    const verification = evaluateForegroundTask(state, { contextStatus: { pendingCount: 1 } });
    assert.equal(verification.decision.type, "verify");
    state = beginForegroundDispatch(verification.state, verification.decision);
    state = recordForegroundToolEvent(state, {
      toolName: "read_file",
      toolArgs: "{\"path\":\"partial.md\"}",
      content: "verified partial output",
      readOnly: true,
      succeeded: true,
    });
    const settled = evaluateForegroundTask(state, { contextStatus: { pendingCount: 1 } });
    assert.equal(settled.decision.type, "partial");
    assert.equal(settled.state.lifecycle, "partial");
  });

  test("uses concise phase prompts that preserve current-loop context", () => {
    const state = recordForegroundPlan(complexState(), {
      steps: [{ id: "s1", title: "调查", action: "inspect" }],
      completedStepIds: [],
    });
    const decision = evaluateForegroundTask(state, {}).decision;
    const prompt = buildForegroundTaskPrompt(state, decision, { userUpdate: "继续" });
    assert.match(prompt, /同一个普通模型工具循环/);
    assert.match(prompt, /不要重复已经取得的工具结果/);
    assert.match(prompt, /s1/);
  });

  test("does not restart terminal task outcomes", () => {
    const stopped = finishForegroundTask(complexState(), "stopped");
    const partial = finishForegroundTask(complexState(), "partial");
    const completed = finishForegroundTask(complexState(), "completed");
    assert.equal(evaluateForegroundTask(stopped, {}).decision.type, "stopped");
    assert.equal(evaluateForegroundTask(partial, {}).decision.type, "partial");
    assert.equal(evaluateForegroundTask(completed, {}).decision.type, "complete");
  });

  test("persists an outcome envelope for every foreground terminal state", () => {
    const state = recordForegroundArtifacts(complexState(), ["result.md"]);
    for (const lifecycle of ["completed", "partial", "stopped", "waiting_user"]) {
      const finished = finishForegroundTask(state, lifecycle);
      assert.equal(finished.outcome.taskId, finished.id);
      assert.equal(finished.outcome.outcome, lifecycle);
      assert.deepEqual(finished.outcome.artifactRefs, ["result.md"]);
      assert.equal(typeof finished.outcome.resumable, "boolean");
    }
  });

  test("keeps a waiting-user task paused until an explicit intervention choice", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [{ id: "s1", title: "修改", action: "edit" }],
      completedStepIds: [],
    });
    state = pauseForegroundTask(state, "plan-revision-requested");

    const paused = evaluateForegroundTask(state, {});
    assert.equal(paused.decision.type, "intervene");
    assert.equal(paused.decision.reason, "plan-revision-requested");
    assert.equal(paused.state.dispatch.stepNoProgressStreak.s1, undefined);

    state = applyForegroundIntervention(paused.state, "continue", paused.decision);
    assert.equal(evaluateForegroundTask(state, {}).decision.type, "step");
  });

  test("restore does not silently resume a waiting-user task without explicit approval", () => {
    const paused = pauseForegroundTask(recordForegroundPlan(complexState(), {
      steps: [{ id: "s1", title: "修改", action: "edit" }],
      completedStepIds: [],
    }), "provider-blocked");

    const implicit = resumeForegroundTask(paused, { turnId: "turn-implicit", history: [] });
    assert.equal(implicit.lifecycle, "waiting_user");

    const explicit = resumeForegroundTask(paused, {
      turnId: "turn-explicit",
      history: [],
      resumeWaitingUser: true,
    });
    assert.equal(explicit.lifecycle, "running");
  });

  test("replanning retains completed checkpoints and their confirmed facts", () => {
    let state = recordForegroundPlan(complexState(), {
      steps: [
        { id: "s1", title: "调查", action: "inspect" },
        { id: "s2", title: "修改", action: "edit" },
      ],
      completedStepIds: [],
    });
    state = beginForegroundDispatch(state, evaluateForegroundTask(state, {}).decision);
    state = recordForegroundToolEvent(state, {
      toolName: "read_file",
      toolArgs: '{"path":"config.json"}',
      content: "confirmed setting",
      readOnly: true,
      succeeded: true,
    });
    state = recordForegroundStepCompletion(state, { stepId: "s1", result: "confirmed current setting" });
    state = applyForegroundIntervention(state, "revise", { reason: "plan-revision-requested" });

    assert.equal(state.workPlan, null);
    assert.equal(state.checkpoints.steps.s1.result, "confirmed current setting");
    assert.deepEqual(state.revision.previousPlan.completedStepIds, ["s1"]);
    assert.match(buildForegroundTaskPrompt(state, evaluateForegroundTask(state, {}).decision), /confirmed current setting/);

    state = recordForegroundPlan(state, {
      steps: [
        { id: "s1", title: "调查", action: "inspect" },
        { id: "s3", title: "调整", action: "adjust" },
      ],
      completedStepIds: [],
    });
    assert.deepEqual(state.workPlan.completedStepIds, ["s1"]);
    assert.equal(state.checkpoints.steps.s1.result, "confirmed current setting");
  });

  test("only treats consecutive identical calls as repeated no-progress evidence", () => {
    let state = startForegroundTask({
      turnId: "turn-repeat",
      prompt: "检查日志",
      assessment: assessTaskComplexity({ prompt: "检查日志" }),
      history: [],
    });
    const record = (current, path, content) => recordForegroundToolEvent(current, {
      toolName: "read_file",
      toolArgs: JSON.stringify({ path }),
      content,
      readOnly: true,
      succeeded: true,
    });
    state = record(state, "a.log", "same");
    state = record(state, "b.log", "different");
    state = record(state, "a.log", "same");
    assert.equal(evaluateForegroundTask(state, {}).state.classification, "simple");

    state = record(state, "a.log", "same");
    state = record(state, "a.log", "same");
    const upgraded = evaluateForegroundTask(state, {});
    assert.equal(upgraded.state.classification, "complex");
    assert.ok(upgraded.state.upgrade.reasons.includes("repeated-no-progress"));
  });
});

test("launcher reaches complex work only through the ordinary CacheFirstLoop", () => {
  assert.match(launcherSource, /new CacheFirstLoop\(/);
  assert.match(launcherSource, /evaluateForegroundTask\([\s\S]*?loop\.step\(loopInput\)/);
  assert.doesNotMatch(launcherSource, /async function generateComplexDocumentUnit/);
  assert.doesNotMatch(launcherSource, /createDurableAgentWorker\(/);
  assert.doesNotMatch(launcherSource, /name:\s*"organize_documents_to_report"/);
  assert.doesNotMatch(launcherSource, /pendingPdfState/);
  assert.doesNotMatch(launcherSource, /documentMarkdownManager\.resume\(/);
  assert.doesNotMatch(launcherSource, /name:\s*"read_prepared_document"/);
  assert.equal(existsSync(new URL("./prepared-document-reader.mjs", import.meta.url)), false);
  assert.match(launcherSource, /LEGACY_DOCUMENT_EXECUTION_RETIRED/);
  assert.match(launcherSource, /approvedActivePlanSnapshot/);
  assert.match(launcherSource, /plan cancelled|user stopped at checkpoint/);
  assert.match(launcherSource, /const approvedPlan = pendingPlan;[\s\S]*?if \(!activatePendingPlan\(\)\)[\s\S]*?recordForegroundPlan\(activeForegroundTask, approvedPlan\)/);
  assert.match(launcherSource, /const foregroundTool = tools\.get\(ev\.toolName\)[\s\S]*?recordForegroundToolEvent\([\s\S]*?verificationEvidence/);
  assert.match(launcherSource, /const checkpointedTask = recordForegroundStepCompletion\([\s\S]*?if \(!markStepDone\(update\.stepId\)\)[\s\S]*?activeForegroundTask = checkpointedTask/);
  assert.match(launcherSource, /revision requested[\s\S]{0,300}pauseForegroundTask\(activeForegroundTask, "plan-revision-requested"\)/i);
});

test("the generic supervisor has no document-format tool or cursor protocol", () => {
  const source = readFileSync(new URL("./foreground-task-supervisor.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /prepare_local_document|read_prepared_document|documentSources|nextCursor|PDF page|Office unit/i);
});
