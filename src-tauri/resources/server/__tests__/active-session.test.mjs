import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  activeEntriesForDashboard,
  activeEntriesForModel,
  parseActiveSessionJsonl,
  recoverInterruptedToolCalls,
  serializeActiveSession,
  withPendingUserEntry,
} from "../lib/active-session.mjs";

describe("active session recovery", () => {
  test("keeps valid messages when the final JSONL record is truncated", () => {
    const raw = [
      JSON.stringify({ role: "user", content: "first" }),
      JSON.stringify({ role: "assistant", content: "second" }),
      '{"role":"assistant","content":"partial',
    ].join("\n");

    const parsed = parseActiveSessionJsonl(raw);
    assert.equal(parsed.entries.length, 2);
    assert.equal(parsed.errors.length, 1);
    assert.equal(parsed.errors[0].line, 3);
  });

  test("restores model metadata while removing dashboard-only fields", () => {
    const entries = [{
      id: "assistant-ui-1",
      role: "assistant",
      text: "calling tool",
      content: "calling tool",
      reasoning_content: "reasoning",
      tool_calls: [{ id: "call-1", type: "function", function: { name: "read_file", arguments: "{}" } }],
    }];

    const restored = activeEntriesForModel(entries);
    assert.equal(restored.length, 1);
    assert.equal(restored[0].id, undefined);
    assert.equal(restored[0].text, undefined);
    assert.equal(restored[0].tool_calls[0].id, "call-1");
    assert.equal(restored[0].reasoning_content, "reasoning");
  });

  test("records an unknown result for an interrupted tool call without replaying it", () => {
    const source = [
      { role: "user", content: "inspect the file" },
      {
        role: "assistant",
        content: "I will inspect it",
        turnId: "turn-1",
        operationId: "operation-1",
        tool_calls: [{ id: "call-crashed", type: "function", function: { name: "read_file", arguments: "{}" } }],
      },
    ];
    const recovered = recoverInterruptedToolCalls(source, { now: () => "2026-07-26T00:00:00.000Z" });
    assert.equal(recovered.changed, true);
    assert.equal(recovered.entries.length, 3);
    const tool = recovered.entries[2];
    assert.equal(tool.role, "tool");
    assert.equal(tool.tool_call_id, "call-crashed");
    assert.equal(tool.toolStatus, "unknown");
    assert.equal(tool.turnId, "turn-1");
    assert.equal(JSON.parse(tool.content).error.code, "tool_interrupted");
    assert.match(recovered.warnings[0], /call-crashed/);

    const second = recoverInterruptedToolCalls(recovered.entries);
    assert.equal(second.changed, false);
    assert.equal(second.entries.length, recovered.entries.length);
  });

  test("scopes recovery by turn when a provider reuses a tool call id", () => {
    const source = [
      { role: "user", content: "first" },
      {
        role: "assistant",
        turnId: "turn-1",
        operationId: "operation-1",
        tool_calls: [{ id: "call-reused", type: "function", function: { name: "read_file", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "call-reused", turnId: "turn-1", operationId: "operation-1", content: "first result" },
      { role: "user", content: "second" },
      {
        role: "assistant",
        turnId: "turn-2",
        operationId: "operation-2",
        tool_calls: [{ id: "call-reused", type: "function", function: { name: "read_file", arguments: "{}" } }],
      },
    ];

    const recovered = recoverInterruptedToolCalls(source, { now: () => "2026-07-26T00:00:00.000Z" });
    assert.equal(recovered.changed, true);
    const unknown = recovered.entries.filter((entry) => entry.role === "tool" && entry.toolStatus === "unknown");
    assert.equal(unknown.length, 1);
    assert.equal(unknown[0].tool_call_id, "call-reused");
    assert.equal(unknown[0].turnId, "turn-2");
    assert.equal(unknown[0].operationId, "operation-2");
  });

  test("converts multimodal user content into readable dashboard text", () => {
    const entries = [{
      role: "user",
      content: [
        { type: "text", text: "describe this" },
        { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
      ],
    }];

    const dashboard = activeEntriesForDashboard(entries, 123);
    assert.equal(dashboard.length, 1);
    assert.equal(dashboard[0].text, "describe this");
    assert.match(dashboard[0].id, /^restored-user-123-/);
  });

  test("restores execution receipt facts for completed assistant messages", () => {
    const receipt = {
      version: 1,
      tools: { results: 2, successes: 1, failures: 1, lastName: "write_file" },
      completion: { ok: false, taskState: "incomplete" },
    };
    const entries = [{
      role: "assistant",
      content: "The requested output is incomplete.",
      turnId: "turn-1",
      operationId: "operation-1",
      receipt,
      taskState: "incomplete",
      artifactIncomplete: true,
      interventionChoice: "retry",
      warnings: ["output verification failed"],
    }];

    const dashboard = activeEntriesForDashboard(parseActiveSessionJsonl(serializeActiveSession(entries)).entries, 321);
    assert.equal(dashboard.length, 1);
    assert.deepEqual(dashboard[0].receipt, receipt);
    assert.equal(dashboard[0].turnId, "turn-1");
    assert.equal(dashboard[0].operationId, "operation-1");
    assert.equal(dashboard[0].taskState, "incomplete");
    assert.equal(dashboard[0].artifactIncomplete, true);
    assert.equal(dashboard[0].interventionChoice, "retry");
    assert.deepEqual(dashboard[0].warnings, ["output verification failed"]);
  });

  test("refresh keeps the user turn, tool fact and final answer while hiding reasoning", () => {
    const entries = [
      { role: "user", content: "create a deck" },
      {
        role: "assistant",
        content: "I will inspect the source first",
        reasoning_content: "private reasoning",
        tool_calls: [{ id: "call-1", type: "function", function: { name: "read_file", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "call-1", name: "read_file", content: "source text" },
      {
        role: "assistant",
        content: "Deck created: report.pptx",
        reasoning_content: "final private reasoning",
      },
    ];

    const dashboard = activeEntriesForDashboard(entries, 123);
    assert.deepEqual(dashboard.map((entry) => [entry.role, entry.text]), [
      ["user", "create a deck"],
      ["tool", "source text"],
      ["assistant", "Deck created: report.pptx"],
    ]);
    assert.equal(Object.hasOwn(dashboard[1], "reasoning"), false);
  });

  test("refresh collapses forced summaries while preserving tool facts", () => {
    const entries = [
      { role: "user", content: "finish the approved plan" },
      { role: "assistant", content: "[tool budget exhausted] partial progress" },
      { role: "user", content: "[系统自动续跑 1/2]\n继续执行当前计划" },
      {
        role: "assistant",
        content: "Continuing from slide 5",
        tool_calls: [{ id: "call-2", type: "function", function: { name: "officecli", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "call-2", name: "officecli", content: "ok" },
      { role: "assistant", content: "All plan steps completed" },
    ];

    const dashboard = activeEntriesForDashboard(entries, 456);
    assert.deepEqual(dashboard.map((entry) => entry.text), [
      "finish the approved plan",
      "ok",
      "All plan steps completed",
    ]);
  });

  test("refresh hides internal background-task handoff prompts but keeps the agent's delivery", () => {
    const entries = [
      { role: "user", content: "把报告整理成 Markdown" },
      { role: "assistant", content: "任务已进入后台队列。" },
      { role: "user", content: "[系统后台任务接管 document:job-123]\n后台任务已完成，请继续交付" },
      { role: "assistant", content: "后台结果已核实，文件已交付。" },
    ];
    const dashboard = activeEntriesForDashboard(entries, 456);
    assert.deepEqual(dashboard.map((entry) => entry.text), [
      "把报告整理成 Markdown",
      "后台结果已核实，文件已交付。",
    ]);
  });

  test("model recovery omits internal continuation prompts from new and legacy JSONL", () => {
    const entries = [
      { role: "user", content: "把报告整理成 Markdown" },
      { role: "assistant", content: "任务已进入后台队列。" },
      { role: "user", content: "宿主内部接管", internal: true },
      { role: "assistant", content: "正在核实后台结果。" },
      { role: "user", content: "[系统自动续跑 1/2]\n继续执行当前计划" },
      { role: "assistant", content: "计划已继续。" },
      { role: "user", content: "[系统后台任务接管 document:job-123]\n后台任务已完成，请继续交付" },
      { role: "assistant", content: "后台结果已核实，文件已交付。" },
      { role: "user", content: "[系统通用复杂任务调度]\n只执行当前步骤" },
      { role: "assistant", content: "当前步骤已执行。" },
      { role: "user", content: "[系统步骤检查点] step-1 已记录" },
      { role: "assistant", content: "正在进入最终验收。" },
    ];

    const restored = activeEntriesForModel(entries);
    assert.deepEqual(restored.map((entry) => [entry.role, entry.content]), [
      ["user", "把报告整理成 Markdown"],
      ["assistant", "任务已进入后台队列。"],
      ["assistant", "正在核实后台结果。"],
      ["assistant", "计划已继续。"],
      ["assistant", "后台结果已核实，文件已交付。"],
      ["assistant", "当前步骤已执行。"],
      ["assistant", "正在进入最终验收。"],
    ]);
  });

  test("refresh hides interrupted reasoning but keeps the tool fact", () => {
    const entries = [
      { role: "user", content: "inspect the file" },
      {
        role: "assistant",
        content: "Checking now",
        reasoning_content: "I should use a tool",
        tool_calls: [{ id: "call-3", type: "function", function: { name: "read_file", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "call-3", name: "read_file", content: "partial output" },
    ];

    const dashboard = activeEntriesForDashboard(entries, 789);
    assert.deepEqual(dashboard.map((entry) => [entry.role, entry.text]), [
      ["user", "inspect the file"],
      ["tool", "partial output"],
    ]);
  });

  test("serializes normalized entries as newline-terminated JSONL", () => {
    const raw = serializeActiveSession([
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" },
    ]);
    assert.ok(raw.endsWith("\n"));
    assert.equal(parseActiveSessionJsonl(raw).entries.length, 2);
  });

  test("pending user fallback avoids duplicates and restores image metadata", () => {
    const entries = [{
      role: "user",
      content: [
        { type: "text", text: "inspect this image" },
        { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
      ],
    }];
    const images = [{ name: "screen.png", dataUrl: "data:image/png;base64,AAAA" }];
    const merged = withPendingUserEntry(entries, { text: "inspect this image", images });

    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0].images, images);
    assert.equal(entries[0].images, undefined);
  });

  test("pending user fallback appends a missing turn without mutating loop history", () => {
    const entries = [{ role: "assistant", content: "ready" }];
    const merged = withPendingUserEntry(entries, { text: "continue" });
    assert.deepEqual(merged, [
      { role: "assistant", content: "ready" },
      { role: "user", content: "continue" },
    ]);
    assert.equal(entries.length, 1);
  });

  test("attachment-only user messages persist metadata and restore a model reference", () => {
    const attachment = {
      id: "att_1234567890abcdef1234",
      kind: "image",
      mimeType: "image/png",
      name: "screen.png",
      size: 123,
      sha256: "a".repeat(64),
      source: { kind: "blob", ref: `blobref:image/png;${"a".repeat(64)}` },
    };
    const merged = withPendingUserEntry([], { attachments: [attachment] });
    assert.equal(merged.length, 1);
    assert.equal(merged[0].content, "");
    assert.deepEqual(merged[0].attachments, [attachment]);

    const model = activeEntriesForModel(parseActiveSessionJsonl(serializeActiveSession(merged)).entries);
    assert.equal(model[0].content, `[attachment:${attachment.id}]`);
    const dashboard = activeEntriesForDashboard(merged, 777);
    assert.equal(dashboard.length, 1);
    assert.deepEqual(dashboard[0].attachments, [attachment]);
  });
});
