import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, PROJECT_MEMORY_CANDIDATES } from "../lib/system-prompt.mjs";

describe("buildSystemPrompt", () => {
  const mockSpecs = [
    { function: { name: "read_file", description: "Read a file from disk. Returns content." } },
    { function: { name: "write_file", description: "Write content to a file." } },
    { function: { name: "empty_tool", description: "" } },
  ];

  test("包含工具列表（取描述第一句）", () => {
    const prompt = buildSystemPrompt(mockSpecs, "/test/root", false);
    assert.ok(prompt.includes("- **read_file**: Read a file from disk"));
    assert.ok(prompt.includes("- **write_file**: Write content to a file"));
  });

  test("rootDir 注入到安全边界", () => {
    const prompt = buildSystemPrompt([], "/my/workspace", false);
    assert.ok(prompt.includes("/my/workspace"));
  });

  test("hasSemantic=true 包含搜索路由", () => {
    const prompt = buildSystemPrompt([], "/root", true);
    assert.ok(prompt.includes("semantic_search"));
    assert.ok(prompt.includes("search_content"));
  });

  test("hasSemantic=false 不包含搜索路由段落", () => {
    const prompt = buildSystemPrompt([], "/root", false);
    assert.ok(!prompt.includes("# Search routing"));
  });

  test("空工具列表 → 工具区域为空行", () => {
    const prompt = buildSystemPrompt([], "/root", false);
    assert.ok(prompt.includes("## Tools"));
  });

  test("快照：关键结构不变（工具列表/选择策略/安全边界/错误处理）", () => {
    const prompt = buildSystemPrompt(mockSpecs, "/workspace", true);
    // 工具列表段
    assert.ok(prompt.includes("- **read_file**: Read a file from disk"));
    // 工具选择策略段
    assert.ok(prompt.includes("## Tool selection strategy"));
    assert.ok(prompt.includes("semantic_search"));
    assert.ok(prompt.includes("todo_write"));
    assert.ok(prompt.includes("submit_plan"));
    // 安全边界段
    assert.ok(prompt.includes("## Safety boundaries"));
    assert.ok(prompt.includes("/workspace"));
    assert.ok(prompt.includes("sandboxed to the workspace"));
    // 错误处理段
    assert.ok(prompt.includes("## Error handling"));
    assert.ok(prompt.includes("Check whether the path, command, or argument is correct"));
    // 搜索路由段（hasSemantic=true）
    assert.ok(prompt.includes("# Search routing"));
    // 身份声明
    assert.ok(prompt.startsWith("You are Visionox, a helpful DeepSeek-powered AI assistant."));
    // 语言跟随
    assert.ok(prompt.includes("Respond in the same language as the user's message."));
  });
});

describe("PROJECT_MEMORY_CANDIDATES", () => {
  test("包含 6 个候选文件，优先级正确", () => {
    assert.deepEqual(PROJECT_MEMORY_CANDIDATES, [
      "REASONIX.md",
      "visionox.md",
      ".claude/CLAUDE.md",
      "CLAUDE.md",
      "AGENTS.md",
      "AGENT.md",
    ]);
  });
});
