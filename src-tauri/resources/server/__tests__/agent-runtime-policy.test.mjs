import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const {
  CacheFirstLoop,
  ImmutablePrefix,
  ToolRegistry,
  registerFilesystemTools,
} = await import(new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url));
const {
  countTokens,
  estimateConversationTokens,
} = await import(new URL("../visionox-pkg/dist/cli/chunk-PV55UMTO.js", import.meta.url));
const { Usage } = await import(new URL("../visionox-pkg/dist/cli/chunk-2KDUS647.js", import.meta.url));

function toolCall(id, name = "probe") {
  return {
    id,
    type: "function",
    function: { name, arguments: "{}" },
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
