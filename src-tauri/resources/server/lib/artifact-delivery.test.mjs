import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  artifactDeliveryRetryPrompt,
  artifactMissingNotice,
  artifactPathsFromToolOutput,
  detectArtifactRequest,
  isPlanOnlyRequest,
  latestAssistantResponse,
  registerSaveLastAssistantResponseTool,
  requestedArtifactPaths,
  requestedOutputArtifactPaths,
  shouldEnforceArtifactDelivery,
  toolResultSucceeded,
} from "./artifact-delivery.mjs";

test("latestAssistantResponse returns the previous stable assistant text", () => {
  assert.deepEqual(latestAssistantResponse([
    { id: "1", role: "assistant", text: "first" },
    { id: "2", role: "user", text: "save it" },
  ]), { id: "1", text: "first" });
  assert.equal(latestAssistantResponse([{ role: "assistant", text: "  " }]), null);
});

test("artifact intent distinguishes commands from design discussions", () => {
  assert.deepEqual(detectArtifactRequest("把刚才的总结内容生成总结文档"), {
    required: true,
    savePreviousResponse: true,
  });
  assert.equal(detectArtifactRequest("请保存为 reports/manual.md").required, true);
  assert.equal(detectArtifactRequest("我们讨论一下如何生成大型 PDF 报告").required, false);
  assert.equal(detectArtifactRequest("总结一下这段内容").required, false);
});

test("plan-first requests are recognized without changing artifact intent", () => {
  assert.equal(isPlanOnlyRequest("这个任务请先给我一个计划，我确认后再执行"), true);
  assert.equal(isPlanOnlyRequest("请先给我方案，我确认后再生成 report.md"), true);
  assert.equal(isPlanOnlyRequest("制定执行方案，等我确认后再保存结果"), true);
  assert.equal(isPlanOnlyRequest("请给我一个计划，我确认后再执行"), true);
  assert.equal(isPlanOnlyRequest("请给计划，确认后执行"), true);
  assert.equal(isPlanOnlyRequest("给我方案，确认后生成 report.md"), true);
  assert.equal(isPlanOnlyRequest("请直接保存为 reports/manual.md"), false);
  assert.equal(shouldEnforceArtifactDelivery({ required: true, planningOnly: true }), false);
  assert.equal(shouldEnforceArtifactDelivery({ required: true, planningOnly: true, executionStarted: true }), true);
  assert.equal(shouldEnforceArtifactDelivery({ required: true, planningOnly: true, planApproved: true }), true);
});

test("requested artifact paths include Windows and workspace-relative outputs", () => {
  assert.deepEqual(
    requestedArtifactPaths("读取 C:\\docs\\source.pdf 并保存为 C:\\docs\\result.md；另存 reports/backup.md"),
    ["C:\\docs\\source.pdf", "C:\\docs\\result.md", "reports/backup.md"],
  );
});

test("requested output paths do not treat the source document as the deliverable", () => {
  assert.deepEqual(
    requestedOutputArtifactPaths("读取 C:\\docs\\source.pdf 并保存为 C:\\docs\\result.md"),
    ["C:\\docs\\result.md"],
  );
  assert.deepEqual(requestedArtifactPaths("/tmp/source.pdf 并保存为 /tmp/result.md"), ["/tmp/source.pdf", "/tmp/result.md"]);
  assert.deepEqual(requestedOutputArtifactPaths("/tmp/source.pdf 并保存为 /tmp/result.md"), ["/tmp/result.md"]);
  assert.deepEqual(requestedOutputArtifactPaths("保存为 https://example.com/result.md"), []);
  assert.deepEqual(requestedOutputArtifactPaths("请保存为 report.md"), ["report.md"]);
});

test("artifact delivery recovers paths reported by a command result", () => {
  assert.deepEqual(
    artifactPathsFromToolOutput("Wrote Markdown to: C:\\Users\\Lenovo\\visionox-workspace\\report.md\r\nOutput size: 12 bytes"),
    ["C:\\Users\\Lenovo\\visionox-workspace\\report.md"],
  );
  assert.deepEqual(artifactPathsFromToolOutput("Output: /tmp/report.md"), ["/tmp/report.md"]);
  assert.deepEqual(artifactPathsFromToolOutput("Output: https://example.com/report.md"), []);
  assert.deepEqual(artifactPathsFromToolOutput("pdftotext completed successfully"), []);
});

test("artifact retry guidance selects the deterministic previous-response tool", () => {
  const prompt = artifactDeliveryRetryPrompt({ savePreviousResponse: true }, "把刚才内容保存成文档");
  assert.match(prompt, /save_last_assistant_response/);
  assert.match(prompt, /不要重新发送上一条回答作为 content/);
  const filePrompt = artifactDeliveryRetryPrompt({ savePreviousResponse: false }, "提取 PDF 并保存为 result.md");
  assert.match(filePrompt, /若已存在，先验证并保留它/);
  assert.match(artifactMissingNotice(), /不能确认交付完成/);
});

test("save-last tool forwards the stable response through the existing write boundary", async () => {
  const definitions = new Map();
  const calls = [];
  const tools = {
    register(definition) { definitions.set(definition.name, definition); },
    async dispatch(name, args, context) {
      calls.push({ name, args, context });
      return "wrote file";
    },
  };
  registerSaveLastAssistantResponseTool(tools, {
    getLastAssistantResponse: () => ({ id: "assistant-7", text: "# Complete report" }),
  });

  const context = { signal: new AbortController().signal };
  const result = JSON.parse(await definitions.get("save_last_assistant_response").fn({ path: "report.md" }, context));
  assert.equal(result.ok, true);
  assert.equal(result.sourceMessageId, "assistant-7");
  assert.deepEqual(calls, [{
    name: "write_file",
    args: { path: "report.md", content: "# Complete report" },
    context,
  }]);
});

test("save-last tool propagates a failed nested write", async () => {
  let definition;
  const tools = {
    register(value) { definition = value; },
    async dispatch() { return '{"error":"permission denied"}'; },
  };
  registerSaveLastAssistantResponseTool(tools, {
    getLastAssistantResponse: () => ({ id: "assistant-8", text: "report" }),
  });
  const result = JSON.parse(await definition.fn({ path: "report.md" }, {}));
  assert.equal(result.ok, false);
  assert.match(result.error, /did not create/);
});

test("launcher retries explicit file delivery and fails completion when no artifact exists", () => {
  const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
  assert.match(launcher, /registerSaveLastAssistantResponseTool/);
  assert.doesNotMatch(launcher, /pendingDocumentArtifactFromToolEvent/);
  assert.doesNotMatch(launcher, /get_document_job_status/);
  assert.doesNotMatch(launcher, /documentMarkdownManager|documentHandoffCoordinator/);
  assert.match(launcher, /finishTurnOnResult/);
  assert.match(launcher, /artifactContinuationAttempts < MAX_ARTIFACT_AUTO_CONTINUATIONS/);
  assert.match(launcher, /if \(!info \|\| info\.size <= 0 \|\| \(!isRequestedExistingOutput && info\.mtimeMs < turnStartedAt/);
  assert.match(launcher, /toolResultSucceeded\(ev\.content\)/);
  assert.match(launcher, /rememberToolGeneratedArtifacts\(ev\.toolName, ev\.toolArgs, ev\.content\)/);
  assert.match(launcher, /edit_file\|multi_edit/);
  assert.match(launcher, /Array\.isArray\(args\.edits\)/);
  assert.match(launcher, /requestedOutputArtifactPaths\(text\)/);
  assert.match(launcher, /isRequestedExistingOutput/);
  assert.match(launcher, /artifactIncomplete \? "requested artifact was not created"/);
  assert.match(launcher, /const planningOnlyRequest = isPlanOnlyRequest\(text\)/);
  assert.match(launcher, /shouldEnforceArtifactDelivery\(/);
  assert.match(launcher, /planApproved: !planningOnlyRequest && activePlanBelongsToRequest\(activeTurnRequestId\)/);
  assert.match(launcher, /taskWarnings = detectTaskWarnings\(assistantText\)/);
  assert.match(launcher, /artifactFiles/);
});

test("artifact completion rejects failed tool results", () => {
  assert.equal(toolResultSucceeded('{"ok":false,"error":"write failed"}'), false);
  assert.equal(toolResultSucceeded('{"error":"missing content"}'), false);
  assert.equal(toolResultSucceeded("Error: denied"), false);
  assert.equal(toolResultSucceeded("wrote 10 chars to report.md"), true);
  assert.equal(toolResultSucceeded('{"ok":true,"outputPath":"report.md"}'), true);
  assert.equal(toolResultSucceeded("command output\n[exit 1]"), false);
  assert.equal(toolResultSucceeded("'python' is not recognized\n[exit 9009]"), false);
  assert.equal(toolResultSucceeded("tests passed\n[exit 0]"), true);
  assert.equal(toolResultSucceeded("$ python --version\n[exit 9009]\nPython was not found"), false);
  assert.equal(toolResultSucceeded("$ command\n[exit 1]\ncommand failed"), false);
  assert.equal(toolResultSucceeded("$ command\n[exit 0]\ncommand output"), true);
  assert.equal(toolResultSucceeded('{"ok":true,"exitCode":1,"stdout":"failed"}'), false);
  assert.equal(toolResultSucceeded('{"ok":false,"exitCode":0,"error":"dispatch failed"}'), false);
  assert.equal(toolResultSucceeded('{"ok":true,"exitCode":null}'), true);
});
