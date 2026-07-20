import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildContextInputFlushPrompt,
  createContextInputTransactionStore,
  decideContextInputIntervention,
  requiresCompleteContextCoverage,
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
    assert.deepEqual(status.pendingInputs.map((entry) => store.readInput(entry.contextId).content), ["a".repeat(60), "b".repeat(60)]);
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

test("complete artifacts remain pending until enough source content is materialized", async () => {
  await withStore(async (store) => {
    store.beginTurn({ turnId: "turn-3", requiresArtifact: true, requiresCompleteCoverage: true });
    store.captureInput({ source: "tool:document_reader", content: "a".repeat(1000) });

    store.noteToolResult({
      name: "write_file",
      args: { path: "result.md", content: "summary" },
      result: "wrote result.md",
      contextMaterializer: true,
      succeeded: true,
    });
    assert.equal(store.status().pendingCount, 1);

    store.noteAssistantFinal("all content completed");
    const unsafe = store.status();
    assert.equal(unsafe.requiresIntervention, true);
    assert.equal(unsafe.completionClaimWithPending, true);

    store.noteToolResult({
      name: "append_file",
      args: { path: "result.md", content: "b".repeat(320) },
      result: "appended result.md",
      contextMaterializer: true,
      succeeded: true,
    });
    assert.equal(store.status().pendingCount, 0);
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
    assert.match(intervention.question, /任务|内容/);
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
    assert.match(decideContextInputIntervention(store.status()).question, /缓存|保存/);
  }, { atomicWrite: () => { throw new Error("disk unavailable"); } });
});
