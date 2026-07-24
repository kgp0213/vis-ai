import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatToolRepairNotice } from "../lib/tool-repair-notice.mjs";
import { createContextInputTransactionStore } from "../lib/context-input-transaction.mjs";

const {
  CacheFirstLoop,
  ImmutablePrefix,
  ToolRegistry,
  bridgeMcpTools,
  registerFilesystemTools,
} = await import(new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url));
const { registerShellTools } = await import(new URL("../visionox-pkg/dist/cli/chunk-O52OLQL3.js", import.meta.url));
const {
  countTokens,
  estimateConversationTokens,
} = await import(new URL("../visionox-pkg/dist/cli/chunk-PV55UMTO.js", import.meta.url));
const { Usage } = await import(new URL("../visionox-pkg/dist/cli/chunk-2KDUS647.js", import.meta.url));

function toolCall(id, name = "probe", args = {}) {
  return {
    id,
    type: "function",
    function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) },
  };
}

function registerProbe(tools, { name = "probe", result = "ok", readOnly = true } = {}) {
  tools.register({
    name,
    parameters: { type: "object", properties: {} },
    readOnly,
    stormExempt: true,
    fn: async () => result,
  });
}

function makeLoop(client, tools, options = {}) {
  return new CacheFirstLoop({
    client,
    prefix: new ImmutablePrefix({ system: "test", toolSpecs: tools.specs() }),
    tools,
    model: "internal-model",
    stream: false,
    autoEscalate: false,
    ...options,
  });
}

describe("agent runtime policy", () => {
  test("MCP bridge lets the host project media results before text flattening", async () => {
    const client = {
      listTools: async () => ({ tools: [{ name: "capture", description: "capture", inputSchema: { type: "object", properties: {} } }] }),
      callTool: async () => ({ content: [{ type: "image", mimeType: "image/png", data: "AAAA" }] }),
    };
    const tools = new ToolRegistry();
    let rawResult = null;
    let projectedCallId = null;
    await bridgeMcpTools(client, {
      registry: tools,
      onResult: async ({ toolResult, toolName, toolCallId }) => {
        rawResult = toolResult;
        projectedCallId = toolCallId;
        return `projected:${toolName}`;
      },
    });
    assert.equal(await tools.dispatch("capture", {}, { toolCallId: "call-media-1" }), "projected:capture");
    assert.equal(rawResult.content[0].type, "image");
    assert.equal(projectedCallId, "call-media-1");
  });

  test("tool repair reports become a concise redacted user notice", () => {
    const notice = formatToolRepairNotice({
      truncationsFixed: 2,
      scavenged: 1,
      notes: ["apiKey=do-not-display", "C:\\private\\secret.txt"],
    });
    assert.match(notice, /自动修复了 2 次工具参数格式/);
    assert.match(notice, /恢复了 1 个未按协议返回的工具调用/);
    assert.doesNotMatch(notice, /do-not-display|secret\.txt|notes/);
    assert.equal(formatToolRepairNotice({ truncationsFixed: 0, scavenged: 0 }), null);
  });

  test("a repaired unterminated string cannot execute a mutating tool", async () => {
    let modelCalls = 0;
    let writes = 0;
    const client = {
      chat: async () => {
        modelCalls++;
        if (modelCalls === 1) {
          return {
            content: "",
            toolCalls: [toolCall("write-truncated", "write_file", '{"path":"report.md","content":"partial')],
            usage: {},
          };
        }
        return { content: "write was safely skipped", toolCalls: [], usage: {} };
      },
    };
    const tools = new ToolRegistry();
    tools.register({
      name: "write_file",
      parameters: { type: "object", properties: {} },
      readOnly: false,
      fn: async () => { writes++; return "wrote"; },
    });
    const events = [];
    for await (const event of makeLoop(client, tools).step("write a report")) events.push(event);

    assert.equal(writes, 0);
    assert.equal(modelCalls, 2);
    assert.match(events.find((event) => event.role === "tool")?.content ?? "", /TRUNCATED_TOOL_ARGUMENTS|truncated.*blocked/i);
  });

  test("a structurally repaired partial batch cannot execute a mutating tool", async () => {
    let modelCalls = 0;
    let writes = 0;
    const client = {
      chat: async () => {
        modelCalls++;
        if (modelCalls === 1) {
          return {
            content: "",
            toolCalls: [toolCall("batch-truncated", "multi_edit", '{"operations":[{"path":"a.md","content":"first"}')],
            usage: {},
          };
        }
        return { content: "partial batch was safely skipped", toolCalls: [], usage: {} };
      },
    };
    const tools = new ToolRegistry();
    tools.register({
      name: "multi_edit",
      parameters: { type: "object", properties: {} },
      readOnly: false,
      fn: async () => { writes++; return "wrote"; },
    });
    const events = [];
    for await (const event of makeLoop(client, tools).step("apply all edits")) events.push(event);

    assert.equal(writes, 0);
    assert.equal(modelCalls, 2);
    assert.match(events.find((event) => event.role === "tool")?.content ?? "", /TRUNCATED_TOOL_ARGUMENTS|truncated.*blocked/i);
  });

  test("a repaired unterminated string may still execute a read-only tool", async () => {
    let modelCalls = 0;
    let receivedQuery = null;
    const client = {
      chat: async () => {
        modelCalls++;
        if (modelCalls === 1) {
          return {
            content: "",
            toolCalls: [toolCall("read-truncated", "search", '{"query":"known prefix')],
            usage: {},
          };
        }
        return { content: "search completed", toolCalls: [], usage: {} };
      },
    };
    const tools = new ToolRegistry();
    tools.register({
      name: "search",
      parameters: { type: "object", properties: {} },
      readOnly: true,
      fn: async (args) => { receivedQuery = args.query; return "match"; },
    });
    for await (const _event of makeLoop(client, tools).step("search")) {
      // Drain the turn.
    }

    assert.equal(receivedQuery, "known prefix");
    assert.equal(modelCalls, 2);
  });

  test("configured escalation model replaces the bundled DeepSeek target", async () => {
    const models = [];
    const client = {
      chat: async (options) => {
        models.push(options.model);
        return { content: "done", toolCalls: [], usage: {} };
      },
    };
    const loop = makeLoop(client, new ToolRegistry(), {
      autoEscalate: true,
      escalationModel: "qwen-strong",
    });
    loop.armProForNextTurn();
    for await (const _event of loop.step("complex task")) {
      // Drain the turn.
    }
    assert.deepEqual(models, ["qwen-strong"]);
    assert.equal(loop.escalationModel, "qwen-strong");
  });

  test("tool functions receive the effective result budget", async () => {
    const tools = new ToolRegistry();
    let receivedBudget = null;
    tools.register({
      name: "probe",
      parameters: { type: "object", properties: {} },
      readOnly: true,
      fn: async (_args, context) => {
        receivedBudget = context.maxResultTokens;
        return "ok";
      },
    });
    assert.equal(await tools.dispatch("probe", {}, { maxResultTokens: 1234 }), "ok");
    assert.equal(receivedBudget, 1234);
  });

  test("append_file builds a large artifact in sections", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "visionox-append-file-"));
    try {
      const tools = new ToolRegistry();
      registerFilesystemTools(tools, { rootDir, allowWriting: true });
      await tools.dispatch("write_file", { path: "report.md", content: "# Report\n" });
      await tools.dispatch("append_file", { path: "report.md", content: "\nSection 1\n" });
      await tools.dispatch("append_file", { path: "report.md", content: "\nSection 2\n" });
      assert.equal(await readFile(join(rootDir, "report.md"), "utf8"), "# Report\n\nSection 1\n\nSection 2\n");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("glob matches files relative to an approved external search directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "visionox-glob-external-"));
    const rootDir = join(root, "workspace");
    const archiveDir = join(root, "archive");
    try {
      await mkdir(rootDir, { recursive: true });
      await mkdir(join(archiveDir, "PDF文档"), { recursive: true });
      await writeFile(join(archiveDir, "PDF文档", "DBI效果.pdf"), "%PDF-1.7", "utf8");
      const tools = new ToolRegistry();
      registerFilesystemTools(tools, { rootDir, allowWriting: true, allowAllPaths: () => true });

      const result = await tools.dispatch("glob", { path: archiveDir, pattern: "**/*.pdf", sort_by: "name" });
      assert.equal(result, "PDF文档/DBI效果.pdf");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("large shell output is retained as a bounded-read resource", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "visionox-shell-resource-"));
    try {
      const tools = new ToolRegistry();
      registerShellTools(tools, {
        rootDir,
        outputResourceDir: join(rootDir, "tool-results"),
        allowAll: true,
        timeoutSec: 30,
      });
      const result = await tools.dispatch("run_command", {
        command: 'node -e "process.stdout.write(\'x\'.repeat(70000))"',
      });
      assert.match(result, /^\[TOOL_OUTPUT_RESOURCE\]/);
      const descriptor = JSON.parse(result.split("\n", 1)[0].slice("[TOOL_OUTPUT_RESOURCE]".length).trim());
      assert.equal(descriptor.bytes, 70000);
      assert.equal((await readFile(descriptor.path, "utf8")).length, 70000);
      assert.match(result, /output truncated/);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("shell tools pass the task document environment to foreground processes", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "visionox-document-env-"));
    try {
      const tools = new ToolRegistry();
      let bindingRequest = null;
      registerShellTools(tools, {
        rootDir,
        allowAll: true,
        getEnvironment: (request) => {
          bindingRequest = request;
          return {
            VISIONOX_DOCUMENT_REF: "visionox-document:doc_test",
            VISIONOX_DOCUMENT_READABLE_PATH: "C:\\Temp\\prepared\\manual.pdf",
            VISIONOX_DOCUMENT_ROOT: "C:\\Temp\\prepared",
          };
        },
      });
      const specs = tools.specs();
      assert.equal(specs.find((spec) => spec.function?.name === "run_command")?.function?.parameters?.properties?.documentRef?.type, "string");
      assert.equal(specs.find((spec) => spec.function?.name === "run_background")?.function?.parameters?.properties?.documentRef?.type, "string");
      const command = 'node -e "process.stdout.write(process.env.VISIONOX_DOCUMENT_READABLE_PATH)"';
      const result = await tools.dispatch("run_command", {
        command,
        documentRef: "visionox-document:doc_test",
      });
      assert.match(result, /C:\\Temp\\prepared\\manual\.pdf/);
      assert.equal(bindingRequest?.args?.documentRef, "visionox-document:doc_test");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("the runtime caches a large read before truncation without crediting an unrelated file write", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "visionox-context-runtime-"));
    try {
      let modelCalls = 0;
      const client = {
        chat: async () => {
          modelCalls++;
          if (modelCalls === 1) return { content: "", toolCalls: [toolCall("read-1", "large_reader")], usage: {} };
          if (modelCalls === 2) {
            return {
              content: "",
              toolCalls: [toolCall("write-1", "write_file", { path: "result.md", content: "b".repeat(320) })],
              usage: {},
            };
          }
          return { content: "completed", toolCalls: [], usage: {} };
        },
      };
      const tools = new ToolRegistry();
      registerProbe(tools, { name: "large_reader", result: "a".repeat(800), readOnly: true });
      registerFilesystemTools(tools, { rootDir, allowWriting: true });
      const contextInputGuard = createContextInputTransactionStore(join(rootDir, "context-inputs"), {
        inputThresholdChars: 100,
        pendingLimitChars: 500,
        completeOutputRatio: 0.3,
      });
      contextInputGuard.beginTurn({ turnId: "runtime-turn", requiresArtifact: true, requiresCompleteCoverage: true });

      const events = [];
      for await (const event of makeLoop(client, tools, { contextInputGuard }).step("create result.md")) events.push(event);

      assert.equal(modelCalls, 3);
      assert.match(events.find((event) => event.role === "tool" && event.toolName === "large_reader")?.content ?? "", /CONTEXT_INPUT_CACHED/);
      assert.equal(contextInputGuard.status().pendingCount, 1);
      assert.equal(contextInputGuard.status().materializedChars, 0);
      assert.equal((await readFile(join(rootDir, "result.md"), "utf8")).length, 320);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("resource reads participate in the same context coverage lease", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "visionox-resource-lease-"));
    try {
      const contextRoot = join(rootDir, "context-inputs");
      const resourceDir = join(contextRoot, "tool-results");
      await mkdir(resourceDir, { recursive: true });
      const resourcePath = join(resourceDir, "resource.txt");
      await writeFile(resourcePath, "x".repeat(100), "utf8");
      let modelCalls = 0;
      const client = {
        chat: async () => {
          modelCalls++;
          if (modelCalls === 1) return { content: "", toolCalls: [toolCall("resource-read", "read_tool_output", { resourceId: "tool-output-resource-1.txt", offsetBytes: 0 })], usage: {} };
          if (modelCalls === 2) return { content: "", toolCalls: [toolCall("resource-write", "append_file", { path: "result.md", content: "x" })], usage: {} };
          return { content: "已完成", toolCalls: [], usage: {} };
        },
      };
      const tools = new ToolRegistry();
      tools.register({
        name: "read_tool_output",
        readOnly: true,
        contextControl: true,
        contextResourceReader: true,
        parameters: { type: "object", properties: { resourceId: { type: "string" }, offsetBytes: { type: "integer" } } },
        fn: async () => JSON.stringify({ ok: true, resourceId: "tool-output-resource-1.txt", offsetBytes: 0, nextOffsetBytes: 100, totalBytes: 100, complete: true, content: "x".repeat(100) }),
      });
      registerFilesystemTools(tools, { rootDir, allowWriting: true });
      const contextInputGuard = createContextInputTransactionStore(contextRoot, { inputThresholdChars: 10, pendingLimitChars: 50 });
      contextInputGuard.beginTurn({ turnId: "resource-runtime-turn", requiresArtifact: true, requiresCompleteCoverage: true });
      const descriptor = JSON.stringify({ resourceId: "tool-output-resource-1.txt", path: resourcePath, bytes: 100 });
      contextInputGuard.captureInput({ source: "tool:run_command", content: `[TOOL_OUTPUT_RESOURCE] ${descriptor}\npreview`, metadata: { tool: "run_command" } });

      const events = [];
      for await (const event of makeLoop(client, tools, { contextInputGuard }).step("create result.md")) events.push(event);

      assert.equal(modelCalls, 3);
      assert.equal(contextInputGuard.status().pendingCount, 0);
      assert.equal((await readFile(join(rootDir, "result.md"), "utf8")).length, 1);
      assert.equal(events.some((event) => event.role === "error"), false);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("a background artifact acceptance ends the turn before weak-model fallback writes", async () => {
    let modelCalls = 0;
    let fallbackWrites = 0;
    const client = {
      chat: async () => {
        modelCalls++;
        return {
          content: "",
          toolCalls: [
            toolCall("document-1", "organize_document_to_markdown"),
            toolCall("write-1", "write_file"),
          ],
          usage: {},
        };
      },
    };
    const tools = new ToolRegistry();
    tools.register({
      name: "organize_document_to_markdown",
      parameters: { type: "object", properties: {} },
      fn: async () => JSON.stringify({ ok: true, accepted: true, artifactStatus: "pending" }),
      finishTurnOnResult: (value) => JSON.parse(value).artifactStatus === "pending"
        ? "文档整理任务已进入后台队列。"
        : null,
    });
    tools.register({
      name: "write_file",
      parameters: { type: "object", properties: {} },
      fn: async () => { fallbackWrites++; return "wrote"; },
    });
    const loop = makeLoop(client, tools, { maxToolIters: 1 });
    const events = [];
    for await (const event of loop.step("整理文档")) events.push(event);

    assert.equal(modelCalls, 1);
    assert.equal(fallbackWrites, 0);
    assert.equal(events.filter((event) => event.role === "tool").length, 1);
    assert.equal(events.findLast((event) => event.role === "assistant_final")?.content, "文档整理任务已进入后台队列。");
  });

  test("provider text truncation automatically continues once and persists the complete answer", async () => {
    let calls = 0;
    const requests = [];
    const client = {
      chat: async (request) => {
        requests.push(request);
        calls++;
        if (calls === 1) return {
          content: "partial answer",
          toolCalls: [],
          usage: {},
          finishReason: "length",
        };
        return { content: " completed", toolCalls: [], usage: {}, finishReason: "stop" };
      },
    };
    const loop = makeLoop(client, new ToolRegistry());
    const events = [];
    for await (const event of loop.step("produce a long answer")) events.push(event);

    assert.equal(calls, 2);
    assert.match(requests[1].messages.findLast((message) => message.role === "user")?.content ?? "", /continue|续写|截断/i);
    assert.equal(events.some((event) => event.role === "error"), false);
    assert.equal(events.findLast((event) => event.role === "assistant_final")?.content, "partial answer completed");
    assert.equal(loop.log.toMessages().some((message) => message.content === "partial answer completed"), true);
  });

  test("streamed provider text truncation automatically continues without losing the partial text", async () => {
    let calls = 0;
    const client = {
      async *stream() {
        calls++;
        if (calls === 1) {
          yield { contentDelta: "partial answer" };
          yield { finishReason: "length", streamComplete: true };
          return;
        }
        yield { contentDelta: " completed" };
        yield { finishReason: "stop", streamComplete: true };
      },
    };
    const loop = makeLoop(client, new ToolRegistry(), { stream: true });
    const events = [];
    for await (const event of loop.step("produce a long answer")) events.push(event);

    assert.equal(calls, 2);
    assert.equal(events.some((event) => event.role === "error"), false);
    assert.equal(events.findLast((event) => event.role === "assistant_final")?.content, "partial answer completed");
    assert.equal(loop.log.toMessages().some((message) => message.content === "partial answer completed"), true);
  });

  test("truncated mutating tool arguments are discarded and retried as smaller calls", async () => {
    let calls = 0;
    let writes = 0;
    const requests = [];
    const client = {
      chat: async (request) => {
        requests.push(request);
        calls++;
        if (calls === 1) return {
          content: "",
          toolCalls: [toolCall("write-cut", "write_file", '{"path":"report.md","content":"partial')],
          usage: {},
          finishReason: "length",
        };
        if (calls === 2) return {
          content: "",
          toolCalls: [toolCall("write-safe", "write_file", { path: "report.md", content: "short section" })],
          usage: {},
          finishReason: "tool_calls",
        };
        return { content: "done", toolCalls: [], usage: {}, finishReason: "stop" };
      },
    };
    const tools = new ToolRegistry();
    tools.register({
      name: "write_file",
      parameters: { type: "object", properties: {} },
      readOnly: false,
      fn: async () => { writes++; return "wrote"; },
    });
    const events = [];
    for await (const event of makeLoop(client, tools).step("write a report")) events.push(event);

    assert.equal(calls, 3);
    assert.equal(writes, 1);
    assert.match(requests[1].messages.findLast((message) => message.role === "user")?.content ?? "", /split|smaller|分段/i);
    assert.equal(events.some((event) => event.role === "error"), false);
  });

  test("two truncated mutating tool responses stop safely without executing either fragment", async () => {
    let calls = 0;
    let writes = 0;
    const client = {
      chat: async () => {
        calls++;
        return {
          content: "",
          toolCalls: [toolCall(`write-cut-${calls}`, "write_file", '{"path":"report.md","content":"partial')],
          usage: {},
          finishReason: "length",
        };
      },
    };
    const tools = new ToolRegistry();
    tools.register({
      name: "write_file",
      parameters: { type: "object", properties: {} },
      readOnly: false,
      fn: async () => { writes++; return "wrote"; },
    });
    const events = [];
    for await (const event of makeLoop(client, tools).step("write a report")) events.push(event);

    assert.equal(calls, 2);
    assert.equal(writes, 0);
    assert.equal(events.filter((event) => event.role === "output_recovery_required").length, 1);
    assert.equal(events.filter((event) => event.role === "tool_start").length, 0);
  });

  test("file writer validation explains the required content shape", async () => {
    const tools = new ToolRegistry();
    tools.register({
      name: "write_file",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
      fn: async () => "wrote",
    });
    const result = await tools.dispatch("write_file", { path: "report.md" });
    assert.match(result, /Required shape/);
    assert.match(result, /path-only call cannot create document content/);
  });

  test("multimodal token estimates count text, images, and the configured reserve", () => {
    const textOnly = estimateConversationTokens([{ role: "user", content: "inspect this diagram" }]);
    const multimodal = estimateConversationTokens([{
      role: "user",
      content: [
        { type: "text", text: "inspect this diagram" },
        { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
        { type: "image_url", image_url: { url: "data:image/png;base64,BBBB" } },
      ],
    }], { imageTokensPerImage: 2048, imageContextReserveTokens: 4096 });

    assert.equal(multimodal, textOnly + 2 * 2048 + 4096);
  });

  test("runtime context policy reserves the active model output budget", () => {
    const loop = makeLoop({ chat: async () => ({ content: "done", toolCalls: [], usage: {} }) }, new ToolRegistry(), {
      maxOutputTokens: 32768,
    });
    assert.equal(loop.context.thresholds("internal-model").outputReserveTokens, 32768);

    loop.configure({ maxOutputTokens: 16384 });
    assert.equal(loop.context.thresholds("internal-model").outputReserveTokens, 16384);
  });

  test("images remain visible to tool-continuation requests without persisting base64 in the log", async () => {
    const captured = [];
    let response = 0;
    const client = {
      chat: async (options) => {
        captured.push(structuredClone(options.messages));
        if (response++ === 0) return { content: "", toolCalls: [toolCall("call-1")], usage: {} };
        return { content: "updated", toolCalls: [], usage: {} };
      },
    };
    const tools = new ToolRegistry();
    registerProbe(tools);
    const loop = makeLoop(client, tools, {
      vision: true,
      visionDetail: "high",
      visionPolicy: { maxImages: 5, estimatedTokensPerImage: 2048, contextReserveTokens: 4096 },
    });
    loop.setPendingImages(["data:image/png;base64,AAAA"]);

    for await (const _event of loop.step("update the HTML from this screenshot")) {
      // Drain the turn.
    }

    assert.equal(captured.length, 2);
    for (const messages of captured) {
      const user = messages.findLast((message) => message.role === "user");
      assert.ok(Array.isArray(user?.content));
      assert.ok(user.content.some((part) => part.type === "image_url"));
    }
    const storedUser = loop.log.toMessages().find((message) => message.role === "user");
    assert.equal(typeof storedUser?.content, "string");
    assert.doesNotMatch(storedUser.content, /base64/);
  });

  test("read_media can queue an image for the next request in the same ordinary tool loop", async () => {
    const captured = [];
    let response = 0;
    const client = {
      chat: async (options) => {
        captured.push(structuredClone(options.messages));
        if (response++ === 0) return { content: "", toolCalls: [toolCall("media-1", "read_media", { path: "screen.png" })], usage: {} };
        return { content: "image inspected", toolCalls: [], usage: {} };
      },
    };
    const tools = new ToolRegistry();
    let loop;
    tools.register({
      name: "read_media",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      readOnly: true,
      fn: async () => {
        loop.setPendingImages(["data:image/png;base64,AAAA"]);
        return JSON.stringify({ ok: true, attachmentId: "att-test" });
      },
    });
    loop = makeLoop(client, tools, {
      vision: true,
      visionPolicy: { maxImages: 5, estimatedTokensPerImage: 2048, contextReserveTokens: 4096 },
    });

    for await (const _event of loop.step("inspect the local screenshot")) {
      // Drain the turn.
    }

    assert.equal(captured.length, 2);
    assert.equal(typeof captured[0].findLast((message) => message.role === "user")?.content, "string");
    const continuedUser = captured[1].findLast((message) => message.role === "user");
    assert.ok(Array.isArray(continuedUser?.content));
    assert.ok(continuedUser.content.some((part) => part.type === "image_url"));
    assert.doesNotMatch(JSON.stringify(loop.log.toMessages()), /base64/);
  });

  test("a provider 413 drops older media locally and retries without rewriting history", async () => {
    const captured = [];
    const client = {
      chat: async (options) => {
        captured.push(structuredClone(options.messages));
        if (captured.length === 1) throw new Error("API 413: payload too large");
        return { content: "latest image inspected", toolCalls: [], usage: {} };
      },
    };
    const loop = makeLoop(client, new ToolRegistry(), {
      vision: true,
      visionPolicy: { maxImages: 5, estimatedTokensPerImage: 2048, contextReserveTokens: 4096 },
    });
    loop.setPendingImages(["data:image/png;base64,OLD", "data:image/png;base64,NEW"]);
    const events = [];
    for await (const event of loop.step("inspect the latest image")) events.push(event);

    assert.equal(captured.length, 2);
    const retryParts = captured[1].findLast((message) => message.role === "user").content;
    assert.equal(retryParts.filter((part) => part.type === "image_url").length, 1);
    assert.match(retryParts.find((part) => part.type === "image_url").image_url.url, /NEW$/);
    assert.equal(events.find((event) => event.role === "media_recovery")?.mediaRecovery, "media_too_large");
    assert.doesNotMatch(JSON.stringify(loop.log.toMessages()), /OLD|NEW/);
  });

  test("a provider format rejection removes the latest media without mutating history", async () => {
    const captured = [];
    const client = {
      chat: async (options) => {
        captured.push(structuredClone(options.messages));
        if (captured.length === 1) throw new Error("API 400: unsupported image format");
        return { content: "older image remains available", toolCalls: [], usage: {} };
      },
    };
    const loop = makeLoop(client, new ToolRegistry(), {
      vision: true,
      visionPolicy: { maxImages: 5, estimatedTokensPerImage: 2048, contextReserveTokens: 4096 },
    });
    loop.setPendingImages(["data:image/png;base64,OLD", "data:image/webp;base64,NEW"]);
    const events = [];
    for await (const event of loop.step("inspect the images")) events.push(event);

    const retryParts = captured[1].findLast((message) => message.role === "user").content;
    assert.match(retryParts.find((part) => part.type === "image_url").image_url.url, /OLD$/);
    assert.equal(events.find((event) => event.role === "media_recovery")?.mediaRecovery, "media_format_unsupported");
    assert.doesNotMatch(JSON.stringify(loop.log.toMessages()), /OLD|NEW/);
  });

  test("document tools can use a configured result budget above the legacy 8000-token ceiling", async () => {
    const longResult = "测试结果段落。".repeat(12000);
    let response = 0;
    const client = {
      chat: async () => response++ === 0
        ? { content: "", toolCalls: [toolCall("read-1", "read_file")], usage: {} }
        : { content: "done", toolCalls: [], usage: {} },
    };
    const tools = new ToolRegistry();
    registerProbe(tools, { name: "read_file", result: longResult });
    const loop = makeLoop(client, tools, {
      toolResultBudget: {
        defaultTokens: 10000,
        documentTokens: 16000,
        absoluteMaxTokens: 20000,
      },
    });
    let result = "";
    for await (const event of loop.step("read the report")) {
      if (event.role === "tool") result = event.content;
    }

    assert.ok(countTokens(result) > 8000, "configured document budget should retain more than 8000 tokens");
    assert.ok(countTokens(result) <= 16100, "result should remain close to the configured 16000-token ceiling");
  });

  test("provider-reported prompt usage reduces the next tool result budget for image-heavy requests", async () => {
    const longResult = "视觉识别结果。".repeat(5000);
    let response = 0;
    const client = {
      chat: async () => response++ === 0
        ? { content: "", toolCalls: [toolCall("read-usage", "read_file")], usage: new Usage(100000, 10, 100010) }
        : { content: "done", toolCalls: [], usage: new Usage() },
    };
    const tools = new ToolRegistry();
    registerProbe(tools, { name: "read_file", result: longResult });
    const loop = makeLoop(client, tools, {
      toolResultBudget: {
        defaultTokens: 10000,
        documentTokens: 16000,
        absoluteMaxTokens: 20000,
      },
    });
    let result = "";
    for await (const event of loop.step("inspect the image results")) {
      if (event.role === "tool") result = event.content;
    }

    assert.ok(countTokens(result) <= 1100, "reported prompt usage should preserve completion headroom");
  });

  test("a continuation window completes work instead of forcing a next-turn promise", async () => {
    let response = 0;
    let dispatches = 0;
    const client = {
      chat: async () => {
        if (response < 5) return { content: "", toolCalls: [toolCall(`call-${++response}`)], usage: {} };
        response++;
        return { content: "file updated and verified", toolCalls: [], usage: {} };
      },
    };
    const tools = new ToolRegistry();
    tools.register({
      name: "probe",
      parameters: { type: "object", properties: {} },
      readOnly: false,
      stormExempt: true,
      fn: async () => { dispatches++; return JSON.stringify({ ok: true }); },
    });
    const loop = makeLoop(client, tools, {
      maxToolIters: 4,
      maxToolContinuationWindows: 1,
    });
    const events = [];
    for await (const event of loop.step("finish editing the file")) events.push(event);

    assert.equal(dispatches, 5);
    assert.equal(events.some((event) => event.forcedSummaryReason === "budget"), false);
    assert.equal(events.findLast((event) => event.role === "assistant_final")?.content, "file updated and verified");
    assert.ok(events.some((event) => event.role === "tool" && /continuation window/i.test(event.content)));
  });

  test("the final tool result gets a no-tools completion pass at the hard round limit", async () => {
    let response = 0;
    const client = {
      chat: async (options) => {
        response++;
        if (response <= 4) return { content: "", toolCalls: [toolCall(`call-${response}`)], usage: {} };
        assert.equal(options.tools, undefined);
        return { content: "the fourth write succeeded; the file is complete", toolCalls: [], usage: {} };
      },
    };
    const tools = new ToolRegistry();
    registerProbe(tools, { readOnly: false });
    const loop = makeLoop(client, tools, { maxToolIters: 4 });
    const events = [];
    for await (const event of loop.step("write and verify the file")) events.push(event);

    assert.equal(response, 5);
    assert.equal(events.some((event) => event.forcedSummaryReason === "budget"), false);
    assert.equal(events.findLast((event) => event.role === "assistant_final")?.content, "the fourth write succeeded; the file is complete");
  });
});
