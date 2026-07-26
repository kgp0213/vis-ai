import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
const loop = readFileSync(new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url), "utf8");

test("多次上下文压缩采用静默、状态、单次提醒三级反馈", () => {
  assert.match(loop, /role: "context_compacted"/);
  assert.match(loop, /notice: foldCount === 1 \? "silent" : foldCount === 4 \? "warning" : "status"/);
  assert.match(launcher, /case "context_compacted"/);
  assert.match(launcher, /ev\.notice === "silent"/);
  assert.match(launcher, /ev\.notice === "warning" \? "warning" : "status"/);
  assert.match(launcher, /eventizer\.emitSessionCompacted/);
  assert.match(launcher, /case "output_recovery"/);
  assert.match(launcher, /case "output_recovery_required"/);
});

test("Launcher 把模型输出上限传给上下文安全预算", () => {
  const buildLoop = launcher.slice(launcher.indexOf("function buildLoop"), launcher.indexOf("let client = null"));
  assert.match(buildLoop, /maxOutputTokens: capabilities\.maxOutputTokens/);
  assert.match(launcher, /maxOutputTokens: resolveProviderModelCapabilities\(provider, modelConfig\.model\)\.maxOutputTokens/);
});

test("通用上下文输入事务在失败或未处理完成时进入交互卡片", () => {
  assert.match(launcher, /createContextInputTransactionStore/);
  assert.match(launcher, /name: "read_context_input"/);
  const recoveryTool = launcher.slice(launcher.indexOf('name: "read_context_input"'), launcher.indexOf('name: "mark_context_input_invalid"'));
  assert.doesNotMatch(recoveryTool, /parallelSafe:\s*true/);
  assert.match(launcher, /decideContextInputIntervention/);
  assert.match(launcher, /pauseGate\.ask\(intervention\)/);
  assert.match(loop, /contextInputGuard/);
  assert.match(loop, /context_input_flush_required/);
  assert.match(launcher, /claimIntervention\(\)/);
  assert.match(launcher, /继续后没有检测到新的来源覆盖或文件写入/);
});

test("大工具输出通过通用资源句柄分段读取", () => {
  assert.match(launcher, /name: "read_tool_output"/);
  assert.match(launcher, /contextResourceReader: true/);
  assert.match(launcher, /toolOutputResourceRoot/);
  assert.match(launcher, /outputResourceDir: toolOutputResourceRoot/);
  assert.match(loop, /TOOL_OUTPUT_RESOURCE_READY/);
  assert.match(loop, /read_tool_output/);
  assert.match(launcher, /Number\(args\.maxBytes\) \|\| 24_000/);
  assert.match(launcher, /Math\.min\(64_000, Number\(args\.maxBytes\)/);
  assert.match(launcher, /maximum: 64000/);
  assert.match(launcher, /Defaults to 24000/);
});

test("产物证据和暂停状态会进入通用交付链路", () => {
  assert.match(launcher, /noteArtifactEvidence\(\{/);
  assert.match(launcher, /taskState:\s*taskState\s*\|\|/);
  assert.match(launcher, /deriveTaskState\(\{/);
  assert.match(launcher, /interventionPaused,/);
  assert.match(launcher, /artifactFiles/);
  assert.match(launcher, /recoveryHandle: contextRecoveryHandle/);
  assert.match(launcher, /activeContextRecoveryHandle/);
  assert.match(launcher, /transactionId: contextTransactionId/);
  assert.match(launcher, /contextRecoveryHandle: activeContextRecoveryHandle/);
  assert.match(loop, /CONTEXT_INPUT_CACHED/);
});
