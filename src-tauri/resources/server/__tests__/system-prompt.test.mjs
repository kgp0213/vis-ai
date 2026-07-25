import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGuidedDocumentPrompt, buildSystemPrompt, presentToolSpecsForMode, PROJECT_MEMORY_CANDIDATES } from "../lib/system-prompt.mjs";

const launcherSource = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");

describe("buildSystemPrompt", () => {
  test("routes dependency discovery through host-managed runtime bindings", () => {
    const prompt = buildSystemPrompt([], "/root", false);
    assert.match(prompt, /VISIONOX_PYTHON/);
    assert.match(prompt, /list_runtime_capabilities/);
    assert.match(prompt, /Never run `npm install`/);
  });

  test("startup reconciles stale runtime paths through the capability resolver", () => {
    assert.match(launcherSource, /await runtimeCapabilities\.discoverRuntime\(\{ force: true \}\)/u);
    assert.doesNotMatch(launcherSource, /for \(const tool of await runtimeDiscovery\.discover\(\{ force: true \}\)\)/u);
  });

  test("runtime installation approval is decided once per operation", () => {
    assert.match(launcherSource, /runtimeInstallApprovals\.has\(key\)/u);
    assert.match(launcherSource, /runtimeInstallApprovals\.set\(key, allowed\)/u);
    assert.match(launcherSource, /runtimeInstallApprovals\.delete\(operation\.id\)/u);
  });
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

  test("保存型文档使用普通工具循环且不注入 PDF 专用生命周期", () => {
    const prompt = buildSystemPrompt([], "/root", false);
    assert.doesNotMatch(prompt, /organize_document_to_markdown/);
    assert.doesNotMatch(launcherSource, /name:\s*"organize_document_to_markdown"/);
    assert.doesNotMatch(launcherSource, /name:\s*"extract_pdf_text"/);
    assert.doesNotMatch(launcherSource, /MAX_DOCUMENT_AUTO_CONTINUATIONS|documentAutoContinuationPrompt|pdfContinuationStates/);
    assert.match(prompt, /keep its stable `documentRef`/);
    assert.doesNotMatch(prompt, /read_prepared_document|extract_pdf_text|nextPageRange/);
    assert.match(prompt, /append_file/);
    assert.match(prompt, /12000 characters is recovery guidance, not a normal host limit/);
    assert.match(prompt, /Always pass content as a string/);
    assert.match(prompt, /never substitute read_context_input/);
    assert.doesNotMatch(prompt, /task assessment|approved task plan|task lifecycle/i);
    assert.doesNotMatch(prompt, /organize_documents_to_report/);
    assert.match(prompt, /save_last_assistant_response/);
    assert.match(prompt, /retain its tables, parameters, commands, and code/);
    assert.match(prompt, /host will recreate a missing readable copy automatically/);
    assert.match(prompt, /pass its `documentRef` field and read `VISIONOX_DOCUMENT_READABLE_PATH`/);
    assert.match(prompt, /when more than one document is prepared, a `documentRef` is required/);
    assert.match(prompt, /host controls context size/);
    assert.match(prompt, /large source or an exact whole-document conversion/);
    assert.match(prompt, /concise deterministic converter/);
    assert.match(prompt, /Keep the bulk source and generated body out of the chat context/);
    assert.match(prompt, /resumable when practical/);
    assert.match(prompt, /Before claiming a requested artifact is complete/);
    assert.match(prompt, /verify the available source coverage/);
  });

  test("运行模式收敛为通用和编程，办公与设计能力归入通用", () => {
    const modesBlock = launcherSource.slice(
      launcherSource.indexOf("const DEFAULT_MODES = {"),
      launcherSource.indexOf("const LEGACY_MODE_ALIASES"),
    );
    const generalMode = modesBlock.slice(modesBlock.indexOf("general: {"), modesBlock.indexOf("coding: {"));
    assert.doesNotMatch(modesBlock, /\n\s{2}(office|design):\s*\{/);
    assert.match(launcherSource, /LEGACY_MODE_ALIASES = Object\.freeze\(\{ office: "general", design: "general" \}\)/);
    assert.match(launcherSource, /function migrateLegacyModeMemoriesToGeneral\(\)/);
    assert.match(launcherSource, /source: `legacy-mode:\$\{id\}`/);
    assert.match(launcherSource, /migrateLegacyModeMemoriesToGeneral\(\);/);
    assert.match(generalMode, /"officecli", "pdf", "md-to-pdf-cjk"/);
    assert.match(generalMode, /"frontend-patterns", "e2e-testing", "react-patterns"/);
    assert.match(generalMode, /prepare_local_document/);
    assert.match(generalMode, /普通工具循环/);
    assert.match(generalMode, /办公任务关注来源覆盖/);
    assert.match(generalMode, /设计任务先明确目标用户/);
    assert.doesNotMatch(generalMode, /organize_document_to_markdown|extract_pdf_text|read_prepared_document/);
  });

  test("guided 文档策略对大型转换优先使用普通前台工具循环", () => {
    const guidedPrompt = buildGuidedDocumentPrompt();
    assert.match(guidedPrompt, /For a large source or an exact whole-document conversion/);
    assert.match(guidedPrompt, /concise deterministic converter in a temporary directory/);
    assert.match(guidedPrompt, /ordinary run_command loop/);
    assert.match(guidedPrompt, /keep the bulk body out of chat context/);
    assert.match(launcherSource, /buildGuidedDocumentPrompt\(\)/);
    assert.doesNotMatch(launcherSource, /documentWorkflow === "guided"[\s\S]{0,1200}run_background/);
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
