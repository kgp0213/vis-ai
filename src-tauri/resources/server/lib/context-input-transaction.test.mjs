import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildContextInputFlushPrompt,
  createContextInputTransactionStore,
  decideContextInputIntervention,
  requiresCompleteContextCoverage,
  startsFreshContextTransaction,
} from "./context-input-transaction.mjs";

async function withStore(fn, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "visionox-context-input-"));
  try {
    const store = createContextInputTransactionStore(root, {
      inputThresholdChars: 100,
      pendingLimitChars: 500,
      completeOutputRatio: 0.3,
      ...options,
    });
    await fn(store, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("complete coverage is limited to explicit fidelity requests and document-to-Markdown delivery", () => {
  assert.equal(requiresCompleteContextCoverage("提取 manual.pdf 完整内容并保存为 md", { required: true }), true);
  assert.equal(requiresCompleteContextCoverage("把 report.docx 整理成 Markdown", { required: true }), true);
  assert.equal(requiresCompleteContextCoverage("只要 PDF 摘要并保存为 md", { required: true }), false);
  assert.equal(requiresCompleteContextCoverage("修改 src/app.js 并保存文件", { required: true }), false);
  assert.equal(requiresCompleteContextCoverage("完整解释这段代码", { required: false }), false);
});

test("explicit retries start a fresh context transaction while continuation keeps recovery", () => {
  assert.equal(startsFreshContextTransaction("重试本次任务"), true);
  assert.equal(startsFreshContextTransaction("重新执行这个任务"), true);
  assert.equal(startsFreshContextTransaction("从头开始"), true);
  assert.equal(startsFreshContextTransaction("继续处理剩余内容"), false);
  assert.equal(startsFreshContextTransaction("从断点继续"), false);
});

test("flush prompt routes resource-backed inputs to the resource reader", () => {
  const prompt = buildContextInputFlushPrompt({
    pendingInputs: [{
      contextId: "context:abc",
      resourceId: "tool-output-1.txt",
      chars: 60_000,
      coveredChars: 12_000,
      source: "tool:run_command",
    }],
  });
  assert.match(prompt, /read_tool_output/);
  assert.match(prompt, /tool-output-1\.txt/);
  assert.match(prompt, /offsetBytes=12000/);
  assert.doesNotMatch(prompt, /使用 read_context_input 按段恢复/);
});

test("large context inputs are cached losslessly and survive a store restart", async () => {
  await withStore(async (store, root) => {
    store.beginTurn({ turnId: "turn-1", requiresArtifact: true, requiresCompleteCoverage: true });
    const content = "source evidence\n".repeat(80);
    const captured = store.captureInput({ source: "tool:read_file", content, metadata: { path: "report.txt" } });

    assert.equal(captured.ok, true);
    assert.equal(captured.cached, true);
    assert.equal(store.status().pendingCount, 1);
    assert.equal(store.readInput(captured.contextId).content, content);

    const resumed = createContextInputTransactionStore(root, {
      inputThresholdChars: 100,
      pendingLimitChars: 500,
      completeOutputRatio: 0.3,
    });
    resumed.beginTurn({ turnId: "turn-1", requiresArtifact: true, requiresCompleteCoverage: true });
    assert.equal(resumed.status().pendingCount, 1);
    assert.equal(resumed.readInput(captured.contextId).content, content);
  });
});

test("wrong recovery tool for a resource input reports the canonical recovery path", async () => {
  await withStore(async (store, root) => {
    const resourceDir = join(root, "tool-results");
    const resourceId = "tool-output-result-2.txt";
    const resourcePath = join(resourceDir, resourceId);
    await mkdir(resourceDir, { recursive: true });
    await writeFile(resourcePath, "resource content", "utf8");
    store.beginTurn({ turnId: "turn-resource-wrong-reader", requiresArtifact: true, requiresCompleteCoverage: true });
    const captured = store.captureInput({
      source: "tool:run_command",
      content: `[TOOL_OUTPUT_RESOURCE] ${JSON.stringify({ resourceId, path: resourcePath, bytes: 16 })}\npreview`,
    });
    const result = store.readInput(captured.contextId);
    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.equal(result.recoveryTool, "read_tool_output");
    assert.equal(result.resourceId, resourceId);
    assert.equal(store.status().blockedReadCount, 1);
  });
});

test("cached input survives a new user turn when the transaction identity is stable", async () => {
  await withStore(async (store, root) => {
    store.beginTurn({ transactionId: "task:stable", turnId: "turn-1", requiresArtifact: true });
    const content = "source evidence\n".repeat(80);
    const captured = store.captureInput({ source: "tool:reader", content });
    assert.equal(captured.cached, true);

    const resumed = createContextInputTransactionStore(root, {
      inputThresholdChars: 100,
      pendingLimitChars: 500,
    });
    resumed.beginTurn({ transactionId: "task:stable", turnId: "turn-2", requiresArtifact: true });
    assert.equal(resumed.readInput(captured.contextId).content, content);
  });
});

test("unknown context input becomes an explicit cache failure", async () => {
  await withStore(async (store) => {
    store.beginTurn({ transactionId: "task:missing", turnId: "turn-1", requiresArtifact: true });
    const result = store.readInput("context:missing");
    assert.equal(result.ok, false);
    assert.match(result.error, /unknown context input/);
    assert.equal(store.status().cacheFailureCount, 1);
    assert.equal(store.status().requiresIntervention, true);
  });
});

test("successive bounded reads are cached together once their cumulative input crosses the threshold", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-batches", requiresArtifact: true, requiresCompleteCoverage: true });
    const first = store.captureInput({ source: "tool:first_reader", content: "a".repeat(60) });
    const second = store.captureInput({ source: "tool:second_reader", content: "b".repeat(60) });

    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    const status = store.status();
    assert.equal(status.pendingCount, 2);
    assert.equal(status.pendingChars, 120);
    assert.equal(store.readInput(first.contextId).content, "a".repeat(60));
    store.noteToolResult({
      name: "append_file",
      args: { path: "result.md", content: "a".repeat(60) },
      contextMaterializer: true,
      succeeded: true,
    });
    assert.equal(store.readInput(second.contextId).content, "b".repeat(60));
  });
});

test("a context segment must be materialized before the next segment can be read", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-lease", requiresArtifact: true, requiresCompleteCoverage: true });
    const captured = store.captureInput({ source: "tool:reader", content: "0123456789".repeat(100) });
    const first = store.readInput(captured.contextId, { offset: 0, maxChars: 50 });
    assert.equal(first.ok, true);
    const blocked = store.readInput(captured.contextId, { offset: first.nextOffset, maxChars: 50 });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.blocked, true);
    assert.match(blocked.error, /materialized/);
    store.noteToolResult({
      name: "append_file",
      args: { path: "result.md", content: "0".repeat(50) },
      contextMaterializer: true,
      succeeded: true,
    });
    const next = store.readInput(captured.contextId, { offset: first.nextOffset, maxChars: 50 });
    assert.equal(next.ok, true);
    assert.equal(next.offset, 50);
  });
});

test("text context segments do not split UTF-16 surrogate pairs", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-surrogate-boundary", requiresArtifact: true, requiresCompleteCoverage: true });
    const captured = store.captureInput({ source: "tool:reader", content: "a😀b" });
    const first = store.readInput(captured.contextId, { offset: 0, maxChars: 2 });
    assert.equal(first.content, "a");
    assert.equal(first.nextOffset, 1);
    store.noteToolResult({ name: "append_file", args: { path: "result.md", content: first.content }, contextMaterializer: true, succeeded: true });
    const second = store.readInput(captured.contextId, { offset: first.nextOffset, maxChars: 2 });
    assert.equal(second.content, "😀");
    assert.equal(second.nextOffset, 3);
  }, { inputThresholdChars: 1 });
});

test("emergency compaction leaves one recoverable read after a segment lease", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-emergency", requiresArtifact: true, requiresCompleteCoverage: true });
    const captured = store.captureInput({ source: "tool:reader", content: "0123456789".repeat(100) });
    const first = store.readInput(captured.contextId, { offset: 0, maxChars: 50 });
    assert.equal(first.ok, true);
    assert.equal(store.beforeCompaction({ emergency: true }).blocked, false);
    assert.equal(store.beforeToolCall({ name: "read_context_input", readOnly: true, contextControl: true }).blocked, false);
    const recovered = store.readInput(captured.contextId, { offset: 0, maxChars: 50 });
    assert.equal(recovered.ok, true);
    assert.equal(recovered.offset, 0);
  });
});

test("materialization credits the leased source before other pending inputs", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-correlation", requiresArtifact: true, requiresCompleteCoverage: true });
    const first = store.captureInput({ source: "tool:first", content: "a".repeat(200) });
    const second = store.captureInput({ source: "tool:second", content: "b".repeat(200) });
    const firstRead = store.readInput(first.contextId, { offset: 0, maxChars: 200 });
    store.noteToolResult({ name: "append_file", args: { path: "result.md", content: "a".repeat(60) }, contextMaterializer: true, succeeded: true });
    const secondRead = store.readInput(second.contextId, { offset: 0, maxChars: 200 });
    assert.equal(firstRead.ok, true);
    assert.equal(secondRead.ok, true);
    store.noteToolResult({ name: "append_file", args: { path: "result.md", content: "x" }, contextMaterializer: true, succeeded: true });
    assert.equal(store.status().readLease, null);
    assert.equal(store.status().pendingCount, 0);
  });
});

test("non-artifact analysis keeps read-ahead available for capable models", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-analysis", requiresArtifact: false, requiresCompleteCoverage: false });
    const captured = store.captureInput({ source: "tool:reader", content: "0123456789".repeat(100) });
    const first = store.readInput(captured.contextId, { offset: 0, maxChars: 50 });
    const next = store.readInput(captured.contextId, { offset: first.nextOffset, maxChars: 50 });
    assert.equal(first.ok, true);
    assert.equal(next.ok, true);
    assert.equal(next.offset, 50);
  });
});

test("metadata and redirected command output do not block a verified artifact", async () => {
  await withStore(async (store) => {
    store.beginTurn({
      turnId: "turn-artifact-evidence",
      requiresArtifact: true,
      requiresCompleteCoverage: true,
      referenceRoots: ["C:\\visionox\\skills"],
    });
    const skill = store.captureInput({ source: "tool:run_skill", content: "skill instructions".repeat(20) });
    const reference = store.captureInput({
      source: "tool:read_file",
      content: "reference instructions".repeat(20),
      metadata: { tool: "read_file", path: "C:\\visionox\\skills\\pdf\\process.md" },
    });
    const command = store.captureInput({
      source: "tool:run_command",
      content: ('$ py extract input.pdf > "C:\\workspace\\result.md"\n[exit 0]\nwarning ').repeat(4),
      metadata: { tool: "run_command" },
    });

    assert.equal(skill.cached, true);
    assert.equal(reference.cached, true);
    assert.equal(command.cached, true);
    assert.equal(store.status().pendingCount, 1);

    store.noteArtifactEvidence({
      paths: ["C:\\workspace\\result.md"],
      producer: "run_command",
      verified: true,
      reason: "non-empty artifact observed",
    });
    assert.equal(store.status().pendingCount, 0);
    assert.equal(store.status().artifactEvidence.length, 1);
    store.noteAssistantFinal("任务已完成");
    assert.equal(store.status().requiresIntervention, false);
  });
});

test("artifact evidence only settles the redirected command that produced that artifact", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-artifact-path-correlation", requiresArtifact: true, requiresCompleteCoverage: true });
    const resultCommand = store.captureInput({
      source: "tool:run_command",
      content: '$ convert input.pdf > result.md\n[exit 0]\n' + "x".repeat(120),
      metadata: { tool: "run_command" },
    });
    const logCommand = store.captureInput({
      source: "tool:run_command",
      content: '$ write-diagnostics input.pdf > logs.txt\n[exit 0]\n' + "y".repeat(120),
      metadata: { tool: "run_command" },
    });
    assert.equal(resultCommand.cached, true);
    assert.equal(logCommand.cached, true);

    store.noteArtifactEvidence({ paths: ["C:\\workspace\\result.md"], producer: "run_command", verified: true });
    const status = store.status();
    assert.equal(status.pendingCount, 1);
    assert.equal(status.pendingInputs[0].contextId, logCommand.contextId);
    assert.equal(status.pendingInputs[0].coverage, "artifact-output");
  });
});

test("a verified artifact does not hide a real source input that remains uncovered", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-source-gap", requiresArtifact: true, requiresCompleteCoverage: true });
    store.captureInput({
      source: "tool:read_file",
      content: "source content".repeat(100),
      metadata: { tool: "read_file", path: "C:\\workspace\\source.txt" },
    });
    store.captureInput({
      source: "tool:run_command",
      content: '$ convert source.txt > "C:\\workspace\\result.md"\n[exit 0]',
      metadata: { tool: "run_command" },
    });
    store.noteArtifactEvidence({ paths: ["C:\\workspace\\result.md"], verified: true, producer: "run_command" });
    store.noteAssistantFinal("已完成");
    const status = store.status();
    assert.equal(status.pendingCoverageCount, 1);
    assert.equal(status.requiresIntervention, true);
    assert.match(decideContextInputIntervention(status).contextInput.recommendation, /继续补齐当前文件/);
    assert.deepEqual(decideContextInputIntervention(status).options.map((option) => option.id), ["continue", "revise", "accept-partial", "stop"]);
  });
});

test("severe input/output imbalance is exposed as an intervention signal", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-progress", requiresArtifact: true, requiresCompleteCoverage: true });
    const captured = store.captureInput({ source: "tool:reader", content: "x".repeat(2_000) });
    store.noteToolResult({
      name: "write_file",
      args: { path: "result.md", content: "tiny" },
      contextMaterializer: true,
      succeeded: true,
    });
    const status = store.status();
    assert.equal(status.progressAnomaly, true);
    assert.equal(status.requiresIntervention, true);
    assert.match(decideContextInputIntervention(status).contextInput.statusSummary, /2,000|待处理/);
  });
});

test("discarded inputs do not distort active progress accounting", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-discarded", requiresArtifact: true, requiresCompleteCoverage: true });
    const discarded = store.captureInput({ source: "tool:old-reader", content: "a".repeat(10_000) });
    const active = store.captureInput({ source: "tool:reader", content: "b".repeat(1_000) });
    store.invalidateInput(discarded.contextId, "source-invalid");
    store.readInput(active.contextId, { offset: 0, maxChars: 100 });
    store.noteToolResult({
      name: "append_file",
      args: { path: "result.md", content: "b".repeat(40) },
      contextMaterializer: true,
      succeeded: true,
    });
    const status = store.status();
    assert.equal(status.totalInputChars, 1_000);
    assert.equal(status.progressAnomaly, false);
  });
});

test("pending context applies backpressure to new reads but allows controls and materializers", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-2", requiresArtifact: true, requiresCompleteCoverage: true });
    store.captureInput({ source: "tool:extract", content: "x".repeat(800) });

    const blocked = store.beforeToolCall({ name: "another_reader", readOnly: true });
    assert.equal(blocked.blocked, true);
    assert.match(blocked.result, /CONTEXT_INPUT_PENDING/);
    assert.equal(store.beforeToolCall({ name: "ask_choice", readOnly: true, contextControl: true }).blocked, false);
    assert.equal(store.beforeToolCall({ name: "append_file", contextMaterializer: true }).blocked, false);
    assert.equal(store.beforeCompaction().blocked, true);
    assert.match(store.memo(), /read_context_input/);
  });
});

test("a successful artifact write settles the source segment that was explicitly read", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-3", requiresArtifact: true, requiresCompleteCoverage: true });
    const captured = store.captureInput({ source: "tool:document_reader", content: "a".repeat(1000) });
    store.readInput(captured.contextId, { offset: 0, maxChars: 1000 });

    store.noteToolResult({
      name: "write_file",
      args: { path: "result.md", content: "summary" },
      result: "wrote result.md",
      contextMaterializer: true,
      succeeded: true,
    });
    assert.equal(store.status().pendingCount, 0);
    store.noteAssistantFinal("all content completed");
    assert.equal(store.status().requiresIntervention, false);
  });
});

test("writing one bounded segment does not hide the remaining source tail", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-partial-segment", requiresArtifact: true, requiresCompleteCoverage: true });
    const captured = store.captureInput({ source: "tool:reader", content: "x".repeat(1_000) });
    const first = store.readInput(captured.contextId, { offset: 0, maxChars: 100 });
    store.noteToolResult({
      name: "append_file",
      args: { path: "result.md", content: "x" },
      contextMaterializer: true,
      succeeded: true,
    });
    assert.equal(store.status().pendingCount, 1);
    assert.equal(store.status().pendingInputs[0].coveredChars, 100);
    const second = store.readInput(captured.contextId, { offset: first.nextOffset, maxChars: 100 });
    assert.equal(second.ok, true);
    assert.equal(second.offset, 100);
  });
});

test("complete coverage rejects a first read that skips the source prefix", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-first-offset", requiresArtifact: true, requiresCompleteCoverage: true });
    const captured = store.captureInput({ source: "tool:reader", content: "x".repeat(1_000) });
    const skipped = store.readInput(captured.contextId, { offset: 500, maxChars: 100 });
    assert.equal(skipped.ok, false);
    assert.equal(skipped.blocked, true);
    assert.equal(skipped.expectedOffset, 0);
    assert.equal(store.status().pendingInputs[0].coveredChars, 0);
  });
});

test("the same intervention can be claimed only once until the transaction makes progress", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-intervention-dedupe", requiresArtifact: true, requiresCompleteCoverage: true });
    const captured = store.captureInput({ source: "tool:reader", content: "x".repeat(1_000) });
    store.readInput(captured.contextId, { offset: 0, maxChars: 100 });
    store.noteAssistantFinal("已完成");

    assert.equal(store.claimIntervention(), true);
    assert.equal(store.claimIntervention(), false);
    store.resolveIntervention("continue");
    assert.equal(store.claimIntervention(), false);

    store.noteToolResult({
      name: "append_file",
      args: { path: "result.md", content: "x" },
      contextMaterializer: true,
      succeeded: true,
    });
    assert.equal(store.status().pendingCount, 1);
    assert.equal(store.status().pendingInputs[0].coveredChars, 100);
    assert.equal(store.claimIntervention(), false);
  });
});

test("continue opens one bounded recovery read instead of repeating the same block", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-recovery-window", requiresArtifact: true });
    store.captureInput({ source: "tool:reader", content: "x".repeat(800) });
    assert.equal(store.beforeToolCall({ name: "another_reader", readOnly: true }).blocked, true);

    store.resolveIntervention("continue");
    assert.equal(store.beforeToolCall({ name: "another_reader", readOnly: true }).blocked, false);
    assert.equal(store.beforeToolCall({ name: "another_reader", readOnly: true }).blocked, true);
  });
});

test("resource-backed tool output is not treated as an unmaterialized context transaction", async () => {
  await withStore(async (store, root) => {
    const resourceDir = join(root, "tool-results");
    const resourceId = "tool-output-result-1.txt";
    const resourcePath = join(resourceDir, resourceId);
    await mkdir(resourceDir, { recursive: true });
    await writeFile(resourcePath, "full command output\n".repeat(100), "utf8");
    store.beginTurn({ turnId: "turn-resource-result", requiresArtifact: true, requiresCompleteCoverage: true });
    const descriptor = JSON.stringify({ resourceId, path: resourcePath, chars: ("full command output\n".repeat(100)).length });
    const captured = store.captureInput({
      source: "tool:run_command",
      content: `[TOOL_OUTPUT_RESOURCE] ${descriptor}\npreview`,
      metadata: { tool: "run_command" },
    });
    assert.equal(captured.resourceBacked, true);
    assert.equal(store.status().pendingCount, 1);
    store.noteResourceRead({ resourceId, offsetBytes: 0, nextOffsetBytes: 100, totalBytes: 2_000, complete: false });
    store.noteToolResult({ name: "append_file", args: { path: "result.md", content: "x" }, contextMaterializer: true, succeeded: true });
    assert.equal(store.status().pendingCount, 1);
    store.noteResourceRead({ resourceId, offsetBytes: 100, nextOffsetBytes: 2_000, totalBytes: 2_000, complete: true });
    store.noteToolResult({ name: "append_file", args: { path: "result.md", content: "x" }, contextMaterializer: true, succeeded: true });
    assert.equal(store.status().pendingCount, 0);
  });
});

test("verified command artifact settles the resource it explicitly consumed", async () => {
  await withStore(async (store, root) => {
    const resourceDir = join(root, "tool-results");
    const resourceId = "tool-output-result-3.txt";
    const resourcePath = join(resourceDir, resourceId);
    await mkdir(resourceDir, { recursive: true });
    await writeFile(resourcePath, "source", "utf8");
    store.beginTurn({ turnId: "turn-resource-script", requiresArtifact: true, requiresCompleteCoverage: true });
    store.captureInput({
      source: "tool:run_command",
      content: `[TOOL_OUTPUT_RESOURCE] ${JSON.stringify({ resourceId, path: resourcePath, bytes: 6 })}\npreview`,
    });
    store.noteArtifactEvidence({
      paths: [join(root, "result.md")],
      producer: "run_command",
      verified: true,
      sourceReferences: [`convert ${resourceId} to result.md`],
    });
    assert.equal(store.status().pendingCount, 0);
  });
});

test("complete coverage rejects a resource read that skips the first bytes", async () => {
  await withStore(async (store, root) => {
    const resourceDir = join(root, "tool-results");
    const resourceId = "tool-output-result-2.txt";
    const resourcePath = join(resourceDir, resourceId);
    await mkdir(resourceDir, { recursive: true });
    await writeFile(resourcePath, "x".repeat(1_000), "utf8");
    store.beginTurn({ turnId: "turn-resource-first-offset", requiresArtifact: true, requiresCompleteCoverage: true });
    const captured = store.captureInput({
      source: "tool:run_command",
      content: `[TOOL_OUTPUT_RESOURCE] ${JSON.stringify({ resourceId, path: resourcePath, bytes: 1_000 })}\npreview`,
      metadata: { tool: "run_command" },
    });
    const skipped = store.noteResourceRead({ resourceId, offsetBytes: 500, nextOffsetBytes: 600, totalBytes: 1_000, complete: false });
    assert.equal(skipped.ok, false);
    assert.equal(skipped.blocked, true);
    assert.equal(skipped.expectedOffsetBytes, 0);
    assert.equal(store.status().pendingInputs[0].coveredChars, 0);
    assert.equal(captured.resourceBacked, true);
  });
});

test("unrelated writes do not receive source coverage credit without a read lease", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-no-lease-credit", requiresArtifact: true, requiresCompleteCoverage: true });
    store.captureInput({ source: "tool:document_reader", content: "a".repeat(1000) });
    store.noteToolResult({
      name: "write_file",
      args: { path: "result.md", content: "a".repeat(1000) },
      contextMaterializer: true,
      succeeded: true,
    });
    assert.equal(store.status().materializedChars, 0);
    assert.equal(store.status().pendingCount, 1);
  });
});

test("cache failures and repeated blocked reads produce a one-question intervention card", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-4", requiresArtifact: true });
    store.captureInput({ source: "tool:read_file", content: "z".repeat(800) });
    store.beforeToolCall({ name: "read_again", readOnly: true });
    store.beforeToolCall({ name: "read_again", readOnly: true });

    const intervention = decideContextInputIntervention(store.status());
    assert.equal(intervention.kind, "choice");
    assert.equal(intervention.title, "任务已暂停，需要你决定下一步");
    assert.match(intervention.contextInput.reason, /内容|读取|写入/);
    assert.match(intervention.contextInput.statusSummary, /已读取|待处理/);
    assert.match(intervention.contextInput.recommendation, /推荐/);
    assert.match(intervention.question, /完整结果/);
    assert.equal(intervention.options[0].id, "continue");
    assert.match(intervention.options[0].title, /推荐/);
    assert.deepEqual(intervention.options.map((option) => option.id), ["continue", "revise", "accept-partial", "stop"]);
    assert.match(buildContextInputFlushPrompt(store.status()), /一次只处理一个待处理输入/);
  });

  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-failed", requiresArtifact: true });
    const result = store.captureInput({ source: "tool:read_file", content: "q".repeat(800) });
    assert.equal(result.ok, false);
    assert.equal(store.status().requiresIntervention, true);
    assert.match(decideContextInputIntervention(store.status()).contextInput.reason, /缓存|保存|可靠/);
  }, { atomicWrite: () => { throw new Error("disk unavailable"); } });
});
