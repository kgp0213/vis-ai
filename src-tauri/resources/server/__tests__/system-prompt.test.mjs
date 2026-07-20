import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSystemPrompt, presentToolSpecsForMode, PROJECT_MEMORY_CANDIDATES } from "../lib/system-prompt.mjs";

const launcherSource = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");

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

  test("Office 文件批处理规则不依赖办公模式", () => {
    const prompt = buildSystemPrompt([], "/root", false);
    assert.match(prompt, /in any work mode/);
    assert.match(prompt, /one batch per slide/);
    assert.match(prompt, /"command":"add"/);
  });

  test("保存型文档使用通用增量流程并在高影响歧义时一次一问", () => {
    const prompt = buildSystemPrompt([], "/root", false);
    assert.doesNotMatch(prompt, /organize_document_to_markdown/);
    assert.doesNotMatch(launcherSource, /name:\s*"organize_document_to_markdown"/);
    assert.match(prompt, /keep its stable `documentRef`/);
    assert.match(prompt, /PDF.*`extract_pdf_text`/);
    assert.match(prompt, /returns `complete=false`/);
    assert.match(prompt, /`nextPageRange`/);
    assert.match(prompt, /append_file/);
    assert.match(prompt, /persist|materialize/i);
    assert.match(prompt, /one.*question|one question/i);
    assert.match(prompt, /recommended option/i);
    assert.match(prompt, /read-only investigation/i);
    assert.match(prompt, /create one report from multiple existing documents/);
    assert.match(prompt, /organize_documents_to_report/);
    assert.match(prompt, /verifies that none of the sources changed/);
    assert.match(prompt, /save_last_assistant_response/);
    assert.match(prompt, /retain its tables, parameters, commands, and code/);
    assert.match(prompt, /Never use OfficeCLI for PDF/);
    assert.match(prompt, /host will recreate a missing readable copy automatically/);
  });

  test("办公模式使用通用增量文档流程", () => {
    assert.match(launcherSource, /OFFICE_MODE_VERSION:\s*9/);
    const officeMode = launcherSource.slice(
      launcherSource.indexOf("office: {"),
      launcherSource.indexOf("design: {"),
    );
    assert.doesNotMatch(officeMode, /organize_document_to_markdown/);
    assert.match(officeMode, /prepare_local_document/);
    assert.match(officeMode, /append_file/);
    assert.match(officeMode, /organize_documents_to_report/);
    assert.doesNotMatch(officeMode, /直接调用 organize_pdf_to_markdown/);
  });

  test("结构化选择必须使用交互卡片而不是正文菜单", () => {
    const prompt = buildSystemPrompt([], "/root", false);
    assert.match(prompt, /call `ask_choice`/);
    assert.match(prompt, /Do not enumerate A\/B\/C/);
    assert.match(prompt, /short stable ids such as A, B, and C/);
    assert.match(prompt, /open-ended free-form answer/);
  });

  test("rootDir 注入到安全边界", () => {
    const prompt = buildSystemPrompt([], "/my/workspace", false);
    assert.ok(prompt.includes("/my/workspace"));
  });

  test("hasSemantic=true 包含搜索路由", () => {
    const prompt = buildSystemPrompt([], "/root", true);
    assert.ok(prompt.includes("semantic_search"));
    assert.ok(prompt.includes("search_content"));
    assert.ok(prompt.includes("past decisions"));
    assert.ok(prompt.includes("path:startLine-endLine"));
    assert.ok(prompt.includes("untrusted evidence"));
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
    assert.ok(prompt.includes("Current edit mode: review"));
    // 错误处理段
    assert.ok(prompt.includes("## Error handling"));
    assert.ok(prompt.includes("Check whether the path, command, or argument is correct"));
    // 文件读取内部机制不应主动暴露给用户
    assert.ok(prompt.includes("## File Access Presentation"));
    assert.ok(prompt.includes("Treat internal file access compatibility"));
    assert.ok(prompt.includes("do not mention these internal mechanisms"));
    // 搜索路由段（hasSemantic=true）
    assert.ok(prompt.includes("# Search routing"));
    // 身份声明
    assert.ok(prompt.startsWith("You are Visionox, a helpful AI assistant."));
    assert.doesNotMatch(prompt, /DeepSeek-powered/);
    // 语言跟随
    assert.ok(prompt.includes("Respond in the same language as the user's message."));
  });

  test("admin 模式提示本地绝对路径可用，不再宣称所有文件操作被 sandbox 限制", () => {
    const prompt = buildSystemPrompt(mockSpecs, "C:\\Users\\Lenovo\\visionox-workspace", false, { editMode: "admin" });
    assert.ok(prompt.includes("Current edit mode: admin"));
    assert.ok(prompt.includes("absolute system paths"));
    assert.ok(prompt.includes("D:\\path\\file"));
    assert.ok(prompt.includes("checking D: drive space usage"));
    assert.ok(!prompt.includes("All file operations are sandboxed"));
    assert.ok(!prompt.includes("do NOT attempt to escape the sandbox"));
  });

  test("admin 模式清洗工具描述，避免 sandbox root 误导模型", () => {
    const specs = [
      { type: "function", function: { name: "read_file", description: "Read a file under sandbox root.", parameters: { type: "object", properties: { path: { type: "string", description: "Root of the tree (default: sandbox root)." } } } } },
      { type: "function", function: { name: "run_command", description: "Run a shell command in the project root.", parameters: { type: "object", properties: {} } } },
    ];
    const presented = presentToolSpecsForMode(specs, { editMode: "admin" });
    const text = JSON.stringify(presented);
    assert.ok(text.includes("current workspace"));
    assert.ok(text.includes("absolute system paths"));
    assert.ok(text.includes("Windows drive paths"));
    assert.ok(!/sandbox root/i.test(text));
  });
});

describe("PROJECT_MEMORY_CANDIDATES", () => {
  test("候选文件优先级正确，默认不读取 .claude 配置", () => {
    assert.deepEqual(PROJECT_MEMORY_CANDIDATES, [
      "AGENTS.md",
      "AGENT.md",
      "agent.md",
      "CLAUDE.md",
      "claude.md",
      "visionox.md",
    ]);
  });
});
