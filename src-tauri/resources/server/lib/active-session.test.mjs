import assert from "node:assert/strict";
import { test } from "node:test";

import { activeEntriesForDashboard, activeEntriesForModel } from "./active-session.mjs";

const NOW = 1700000000000;

test("restores tool results as auditable dashboard tool messages paired with their invocation", () => {
  const entries = [
    { role: "user", content: "把 PDF 转成 md" },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "prepare_local_document", arguments: "{\"input\":\"/tmp/a.pdf\"}" } },
      ],
    },
    { role: "tool", tool_call_id: "call_1", name: "prepare_local_document", content: "{\"ok\":true,\"documentId\":\"doc_1\"}" },
    { role: "assistant", content: "转好了：/tmp/a.md" },
  ];
  const visible = activeEntriesForDashboard(entries, NOW);
  assert.deepEqual(visible.map((v) => v.role), ["user", "tool", "assistant"]);
  const tool = visible.find((v) => v.role === "tool");
  assert.equal(tool.toolName, "prepare_local_document");
  assert.equal(tool.toolArgs, "{\"input\":\"/tmp/a.pdf\"}");
  assert.equal(tool.toolStatus, "done");
  assert.equal(tool.text, "{\"ok\":true,\"documentId\":\"doc_1\"}");
});

test("marks failed tool results so the process card keeps them visible", () => {
  const entries = [
    {
      role: "assistant",
      content: "",
      tool_calls: [{ id: "call_bad", type: "function", function: { name: "run_command", arguments: "{\"command\":\"ls /nope\"}" } }],
    },
    { role: "tool", tool_call_id: "call_bad", name: "run_command", content: "{\"ok\":false,\"error\":{\"message\":\"no such dir\"}}" },
  ];
  const visible = activeEntriesForDashboard(entries, NOW);
  const tool = visible.find((v) => v.role === "tool");
  assert.equal(tool.toolStatus, "failed");
  assert.equal(tool.toolName, "run_command");
});

test("falls back to the result entry name when the invocation cannot be paired", () => {
  const entries = [
    { role: "tool", tool_call_id: "orphan", name: "legacy_tool", content: "plain output" },
  ];
  const visible = activeEntriesForDashboard(entries, NOW);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].toolName, "legacy_tool");
  assert.equal(visible[0].toolArgs, undefined);
  assert.equal(visible[0].toolStatus, "done");
});

test("keeps consecutive tool messages in order for grouping into a single process card", () => {
  const entries = [
    {
      role: "assistant",
      content: "",
      tool_calls: [
        { id: "c1", type: "function", function: { name: "read_file", arguments: "{\"path\":\"a\"}" } },
      ],
    },
    { role: "tool", tool_call_id: "c1", name: "read_file", content: "{\"ok\":true}" },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        { id: "c2", type: "function", function: { name: "write_file", arguments: "{\"path\":\"b\"}" } },
      ],
    },
    { role: "tool", tool_call_id: "c2", name: "write_file", content: "{\"ok\":true}" },
    { role: "assistant", content: "done" },
  ];
  const visible = activeEntriesForDashboard(entries, NOW);
  assert.deepEqual(visible.map((v) => v.role), ["tool", "tool", "assistant"]);
  assert.deepEqual(visible.filter((v) => v.role === "tool").map((v) => v.toolName), ["read_file", "write_file"]);
});

test("still hides internal user prompts while exposing the surrounding tool work", () => {
  const entries = [
    { role: "user", content: "真实问题" },
    {
      role: "assistant",
      content: "",
      tool_calls: [{ id: "c1", type: "function", function: { name: "t", arguments: "{}" } }],
    },
    { role: "tool", tool_call_id: "c1", name: "t", content: "{\"ok\":true}" },
    { role: "user", content: "[系统自动续跑 1/2] 继续", internal: true },
    { role: "assistant", content: "最终答复" },
  ];
  const visible = activeEntriesForDashboard(entries, NOW);
  assert.deepEqual(visible.map((v) => v.role), ["user", "tool", "assistant"]);
  assert.equal(visible.find((v) => v.role === "user").text, "真实问题");
});

test("keeps background task notifications in model history while hiding them from Dashboard", () => {
  const notification = {
    role: "user",
    content: "[VISIONOX_BACKGROUND_TASK_NOTIFICATION] status: completed",
    internal: true,
    modelVisible: true,
    dashboardHidden: true,
    notificationId: "task:bg-1:completed",
    backgroundTaskNotification: { notificationId: "task:bg-1:completed", taskId: "bg-1", status: "completed" },
  };
  const model = activeEntriesForModel([notification]);
  assert.equal(model.length, 1);
  assert.equal(model[0].backgroundTaskNotification.taskId, "bg-1");
  assert.deepEqual(activeEntriesForDashboard([notification], NOW), []);
});
