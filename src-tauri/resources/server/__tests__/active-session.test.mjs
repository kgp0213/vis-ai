import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  activeEntriesForDashboard,
  activeEntriesForModel,
  parseActiveSessionJsonl,
  serializeActiveSession,
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

  test("refresh keeps the user turn and final answer but hides reasoning and tool activity", () => {
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
      ["assistant", "Deck created: report.pptx"],
    ]);
    assert.equal(Object.hasOwn(dashboard[1], "reasoning"), false);
  });

  test("refresh collapses forced summaries and internal auto-continuation prompts", () => {
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
      "All plan steps completed",
    ]);
  });

  test("refresh hides an interrupted turn's temporary reasoning and tool output", () => {
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
    assert.deepEqual(dashboard.map((entry) => [entry.role, entry.text]), [["user", "inspect the file"]]);
  });

  test("serializes normalized entries as newline-terminated JSONL", () => {
    const raw = serializeActiveSession([
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" },
    ]);
    assert.ok(raw.endsWith("\n"));
    assert.equal(parseActiveSessionJsonl(raw).entries.length, 2);
  });
});
