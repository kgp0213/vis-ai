import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

const loopUrl = new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url);
const { normalizeHistoryForModel } = await import(loopUrl.href);

describe("模型切换历史兼容", () => {
  let priorThinkingModeMap;

  before(() => {
    priorThinkingModeMap = globalThis.__visionoxThinkingModeMap;
    globalThis.__visionoxThinkingModeMap = {
      "thinking-model": "enabled",
      "plain-model": "disabled",
    };
  });

  after(() => {
    globalThis.__visionoxThinkingModeMap = priorThinkingModeMap;
  });

  test("切到思考模型时补齐助手历史所需的 reasoning_content", () => {
    const history = [
      { role: "user", content: "remember this" },
      { role: "assistant", content: "I will remember it" },
    ];

    const normalized = normalizeHistoryForModel(history, "thinking-model");

    assert.equal(normalized.messages.length, 2);
    assert.equal(normalized.messages[1].reasoning_content, "");
    assert.equal(normalized.reasoningAdded, 1);
    assert.equal(Object.hasOwn(history[1], "reasoning_content"), false);
  });

  test("切到普通模型时移除不兼容的 reasoning_content", () => {
    const history = [
      { role: "user", content: "continue" },
      { role: "assistant", content: "done", reasoning_content: "private reasoning" },
    ];

    const normalized = normalizeHistoryForModel(history, "plain-model");

    assert.equal(Object.hasOwn(normalized.messages[1], "reasoning_content"), false);
    assert.equal(normalized.reasoningRemoved, 1);
  });

  test("切换模型后保留完整工具调用配对并清除孤立结果", () => {
    const history = [
      { role: "user", content: "inspect file" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "call-1", type: "function", function: { name: "read_file", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "call-1", content: "file content" },
      { role: "assistant", content: "summary" },
      { role: "tool", tool_call_id: "missing-call", content: "stray result" },
    ];

    const normalized = normalizeHistoryForModel(history, "thinking-model");

    assert.deepEqual(normalized.messages.map((message) => message.role), ["user", "assistant", "tool", "assistant"]);
    assert.equal(normalized.messages[1].tool_calls[0].id, "call-1");
    assert.equal(normalized.messages[2].tool_call_id, "call-1");
  });
});
