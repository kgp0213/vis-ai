import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import {
  resolveProviderModelAgentPolicy,
  resolveProviderModelCapabilities,
  resolveDocumentOutputBudget,
  resolveProviderModelRequest,
  resolveProviderModelVisionPolicy,
  validateAgentPolicy,
  validateModelCapabilities,
  validateRequestDefaults,
  validateVisionPolicy,
} from "../lib/model-request-policy.mjs";

const { DeepSeekClient } = await import(new URL("../visionox-pkg/dist/cli/chunk-2KDUS647.js", import.meta.url));
const { DeepSeekClient: PackageDeepSeekClient } = await import(new URL("../visionox-pkg/dist/index.js", import.meta.url));
const { CacheFirstLoop, ImmutablePrefix, ToolRegistry } = await import(new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url));
const { dispatch } = await import(new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url));
const TOKEN = "model-request-policy-test";

async function apiRequest(path, body, ctx) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST";
  req.url = path;
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  let status = null;
  let raw = "";
  const res = { writeHead(value) { status = value; }, end(value) { raw = value ?? ""; } };
  await dispatch(req, res, ctx, TOKEN);
  return { status, body: raw ? JSON.parse(raw) : null };
}

function response(body = { choices: [{ message: { content: "OK" } }], usage: {} }) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

describe("model request policy", () => {
  test("document output budget follows purpose defaults and declared model capacity", () => {
    const provider = {
      requestPolicy: "json",
      models: [{
        id: "doc-model",
        capabilities: { maxOutputTokens: 16_384 },
        agentPolicy: {
          requestProfiles: { documentReview: { max_tokens: 3072 } },
          documentPolicy: { batchOutputTokens: 12000 },
        },
        requestDefaults: { max_tokens: 20_000 },
        verificationRequestDefaults: { max_tokens: 2048 },
      }],
    };
    assert.equal(resolveDocumentOutputBudget(provider, "doc-model", { purpose: "toolContinuation" }), 12_000);
    assert.equal(resolveDocumentOutputBudget(provider, "doc-model", { purpose: "verification" }), 2048);
    assert.equal(resolveDocumentOutputBudget(provider, "doc-model", { purpose: "documentReview" }), 3072);
    assert.equal(resolveDocumentOutputBudget({ models: [{ id: "fallback" }] }, "fallback"), 8192);
  });

  test("document and risk purposes inherit safe probe thinking controls from old JSON", () => {
    const provider = {
      requestPolicy: "json",
      models: [{
        id: "legacy-qwen",
        requestDefaults: {
          temperature: 0.6,
          max_tokens: 8192,
          extra_body: { chat_template_kwargs: { enable_thinking: true, thinking_budget: 8192 } },
        },
        verificationRequestDefaults: {
          temperature: 0,
          max_tokens: 8,
          extra_body: { chat_template_kwargs: { enable_thinking: false } },
        },
        agentPolicy: { documentPolicy: { batchOutputTokens: 12000 } },
      }],
    };
    for (const purpose of ["documentReview", "messageRisk"]) {
      const resolved = resolveProviderModelRequest(provider, "legacy-qwen", { purpose });
      assert.equal(resolved.requestDefaults.extra_body.chat_template_kwargs.enable_thinking, false);
      assert.equal(resolved.requestDefaults.max_tokens, 8192, `${purpose} must not inherit the 8-token probe cap`);
      assert.equal(resolveDocumentOutputBudget(provider, "legacy-qwen", { purpose }), 8192);
    }
  });

  test("validates JSON defaults without allowing protocol fields to be replaced", () => {
    assert.equal(validateRequestDefaults({ temperature: 0.6, extra_body: { chat_template_kwargs: { enable_thinking: true } } }), null);
    assert.match(validateRequestDefaults({ model: "other" }), /reserved field.*model/i);
    assert.match(validateRequestDefaults({ messages: [] }), /reserved field.*messages/i);
    assert.match(validateRequestDefaults({ extra_body: { __proto__: null } }), /plain JSON object|forbidden field/i);
  });

  test("validates an explicit opt-in agent policy without inferring model brands", () => {
    const policy = {
      documentWorkflow: "guided",
      maxToolIterations: 24,
      maxToolContinuationWindows: 1,
      sameFailureClassLimit: 2,
      toolResultBudget: {
        defaultTokens: 16000,
        documentTokens: 24000,
        absoluteMaxTokens: 32000,
      },
      requestProfiles: {
        toolContinuation: {
          temperature: 0.1,
          extra_body: { chat_template_kwargs: { enable_thinking: true, thinking_budget: 2048 } },
        },
        finalAnswer: {
          temperature: 0.3,
          extra_body: { chat_template_kwargs: { enable_thinking: true, thinking_budget: 8192 } },
        },
      },
    };
    assert.equal(validateAgentPolicy(policy, { requestPolicy: "json" }), null);
    assert.match(validateAgentPolicy({ maxToolIterations: 0 }), /maxToolIterations/);
    assert.match(validateAgentPolicy({ maxToolContinuationWindows: 3 }), /maxToolContinuationWindows/);
    assert.match(validateAgentPolicy({ toolResultBudget: { defaultTokens: 16000, documentTokens: 40000, absoluteMaxTokens: 32000 } }), /documentTokens/);
    assert.match(validateAgentPolicy({ sameFailureClassLimit: 0 }), /sameFailureClassLimit/);
    assert.match(validateAgentPolicy({ documentWorkflow: "guess" }), /documentWorkflow/);
    assert.match(validateAgentPolicy({ requestProfiles: policy.requestProfiles }, { requestPolicy: "legacy" }), /requestPolicy "json"/);
    assert.match(validateAgentPolicy({ unknown: true }), /unknown field/);

    const provider = { requestPolicy: "json", models: [{ id: "internal-model", agentPolicy: policy }] };
    assert.deepEqual(resolveProviderModelAgentPolicy(provider, "internal-model"), policy);
    assert.deepEqual(resolveProviderModelAgentPolicy({ models: [{ id: "qwen-by-name-only" }] }, "qwen-by-name-only"), {});

    const visionPolicy = {
      maxImages: 5,
      detail: "high",
      estimatedTokensPerImage: 4096,
      contextReserveTokens: 16000,
    };
    assert.equal(validateVisionPolicy(visionPolicy), null);
    assert.match(validateVisionPolicy({ maxImages: 0 }), /maxImages/);
    assert.match(validateVisionPolicy({ detail: "full" }), /detail/);
    assert.deepEqual(resolveProviderModelVisionPolicy({ models: [{ id: "internal-model", visionPolicy }] }, "internal-model"), visionPolicy);
  });

  test("resolves fixed JSON policy per provider and model", () => {
    const provider = {
      requestPolicy: "json",
      models: [{ id: "qwen", requestDefaults: { top_p: 0.95 } }],
    };
    assert.deepEqual(resolveProviderModelRequest(provider, "qwen"), {
      policy: "json",
      requestDefaults: { top_p: 0.95 },
    });
    assert.deepEqual(resolveProviderModelRequest({ models: [{ id: "deepseek" }] }, "deepseek"), {
      policy: "legacy",
      requestDefaults: {},
    });
  });

  test("validates a model capability declaration independently from document execution hints", () => {
    const capabilities = {
      protocol: "openai-chat-completions",
      inputModalities: ["text", "image"],
      streaming: true,
      toolCalling: true,
      structuredOutput: false,
      maxContextTokens: 1_000_000,
      maxOutputTokens: 32_768,
      maxImagesPerRequest: 12,
      roles: ["chat", "document-draft", "document-review", "vision-review", "summary"],
    };

    assert.equal(validateModelCapabilities(capabilities), null);
    assert.match(validateModelCapabilities({ ...capabilities, streaming: "yes" }), /streaming.*boolean/i);
    assert.match(validateModelCapabilities({ ...capabilities, inputModalities: ["image"] }), /inputModalities.*text/i);
    assert.match(validateModelCapabilities({ ...capabilities, roles: ["document-draft", "unknown-role"] }), /roles.*unknown-role/i);
    assert.match(validateModelCapabilities({ ...capabilities, maxOutputTokens: 0 }), /maxOutputTokens.*positive integer/i);
    assert.match(validateModelCapabilities({ ...capabilities, extra: true }), /unknown field.*extra/i);

    const provider = {
      models: [{
        id: "future-model",
        multimodal: false,
        maxContextLength: 32_768,
        visionPolicy: { maxImages: 2 },
        capabilities,
        agentPolicy: { documentPolicy: { batchOutputTokens: 8_192 } },
      }],
    };
    assert.deepEqual(resolveProviderModelCapabilities(provider, "future-model"), capabilities);
    assert.equal(resolveProviderModelAgentPolicy(provider, "future-model").documentPolicy.batchOutputTokens, 8_192);
  });

  test("resolves legacy model fields and safely ignores malformed persisted capability fields", () => {
    const legacyProvider = {
      models: [{
        id: "legacy-vision",
        multimodal: true,
        maxContextLength: 131_072,
        visionPolicy: { maxImages: 3 },
      }],
    };
    assert.deepEqual(resolveProviderModelCapabilities(legacyProvider, "legacy-vision"), {
      protocol: "openai-chat-completions",
      inputModalities: ["text", "image"],
      streaming: true,
      toolCalling: true,
      structuredOutput: false,
      maxContextTokens: 131_072,
      maxOutputTokens: null,
      maxImagesPerRequest: 3,
      roles: ["chat", "document-draft", "document-review", "vision-review", "summary"],
    });

    const malformedProvider = {
      models: [{
        id: "malformed-history",
        multimodal: false,
        maxContextLength: 65_536,
        capabilities: {
          protocol: "openai-chat-completions",
          inputModalities: "image",
          streaming: "yes",
          maxContextTokens: "many",
          maxOutputTokens: 4_096,
          roles: ["not-a-real-role"],
        },
      }],
    };
    assert.doesNotThrow(() => resolveProviderModelCapabilities(malformedProvider, "malformed-history"));
    assert.deepEqual(resolveProviderModelCapabilities(malformedProvider, "malformed-history"), {
      protocol: "openai-chat-completions",
      inputModalities: ["text"],
      streaming: true,
      toolCalling: true,
      structuredOutput: false,
      maxContextTokens: 65_536,
      maxOutputTokens: 4_096,
      maxImagesPerRequest: 0,
      roles: ["chat", "document-draft", "document-review", "summary"],
    });
  });

  test("validates JSON-configurable weak-model document policy without model-name branches", () => {
    const documentPolicy = {
      defaultFidelity: "complete-with-summary",
      batchInputTokens: 3000,
      batchOutputTokens: 8192,
      maxUnitsPerBatch: 8,
      maxRetries: 2,
      autoFallback: true,
      semanticBatching: true,
      contextOverlapTokens: 1024,
      fallbackProviderIds: ["deepseek-official"],
      foregroundPollMs: 250,
      maxSplitDepth: 2,
      maxModelCallsPerBatch: 24,
      maxModelCallsPerJob: 1000,
      maxVisualUnitsPerBatch: 5,
      requestTimeoutMs: 300000,
      jobTimeoutMs: 21_600_000,
    };
    assert.equal(validateAgentPolicy({ documentWorkflow: "guided", documentPolicy }, { requestPolicy: "json" }), null);
    assert.match(validateAgentPolicy({ documentPolicy: { batchInputTokens: 100 } }, { requestPolicy: "json" }), /batchInputTokens/);
    assert.match(validateAgentPolicy({ documentPolicy: { contextOverlapTokens: 32 } }, { requestPolicy: "json" }), /contextOverlapTokens/);
    assert.match(validateAgentPolicy({ documentPolicy: { semanticBatching: "yes" } }, { requestPolicy: "json" }), /semanticBatching/);
    assert.match(validateAgentPolicy({ documentPolicy: { requestTimeoutMs: 1000 } }, { requestPolicy: "json" }), /requestTimeoutMs/);
    assert.match(validateAgentPolicy({ documentPolicy: { maxModelCallsPerJob: 3 } }, { requestPolicy: "json" }), /maxModelCallsPerJob/);
    assert.match(validateAgentPolicy({ documentPolicy: { jobTimeoutMs: 999 } }, { requestPolicy: "json" }), /jobTimeoutMs/);
    assert.match(validateAgentPolicy({ documentPolicy: { unknown: true } }, { requestPolicy: "json" }), /unknown field/);
  });

  test("verification defaults recursively override only the model detection request", () => {
    const provider = {
      requestPolicy: "json",
      models: [{
        id: "qwen",
        requestDefaults: {
          temperature: 0.6,
          extra_body: { chat_template_kwargs: { enable_thinking: true, thinking_budget: 8192 }, keep: true },
        },
        verificationRequestDefaults: {
          temperature: 0,
          extra_body: { chat_template_kwargs: { enable_thinking: false } },
        },
      }],
    };

    assert.deepEqual(resolveProviderModelRequest(provider, "qwen").requestDefaults, provider.models[0].requestDefaults);
    assert.deepEqual(resolveProviderModelRequest(provider, "qwen", { purpose: "verification" }).requestDefaults, {
      temperature: 0,
      extra_body: { chat_template_kwargs: { enable_thinking: false, thinking_budget: 8192 }, keep: true },
    });
  });

  test("agent request profiles recursively override only their declared request phase", () => {
    const provider = {
      requestPolicy: "json",
      models: [{
        id: "internal-model",
        requestDefaults: {
          temperature: 0.6,
          max_tokens: 4096,
          extra_body: { chat_template_kwargs: { enable_thinking: true, thinking_budget: 8192 }, keep: true },
        },
        agentPolicy: {
          requestProfiles: {
            toolContinuation: {
              temperature: 0.1,
              extra_body: { chat_template_kwargs: { thinking_budget: 2048 } },
            },
          },
        },
      }],
    };

    assert.deepEqual(resolveProviderModelRequest(provider, "internal-model").requestDefaults, provider.models[0].requestDefaults);
    assert.deepEqual(resolveProviderModelRequest(provider, "internal-model", { purpose: "toolContinuation" }).requestDefaults, {
      temperature: 0.1,
      max_tokens: 4096,
      extra_body: { chat_template_kwargs: { enable_thinking: true, thinking_budget: 2048 }, keep: true },
    });
    assert.deepEqual(resolveProviderModelRequest(provider, "internal-model", { purpose: "unconfigured" }).requestDefaults, provider.models[0].requestDefaults);
  });

  test("selected model effort parameters override normal profiles but never the verification probe", () => {
    const provider = {
      requestPolicy: "json",
      defaultEffort: "high",
      models: [{
        id: "reasoning-model",
        efforts: ["low", "high"],
        requestDefaults: {
          max_tokens: 8192,
          extra_body: { chat_template_kwargs: { enable_thinking: true, thinking_budget: 8192 } },
        },
        effortParams: {
          low: { extra_body: { chat_template_kwargs: { thinking_budget: 2048 } } },
          high: { extra_body: { chat_template_kwargs: { thinking_budget: 8192 } } },
        },
        verificationRequestDefaults: {
          max_tokens: 8,
          extra_body: { chat_template_kwargs: { enable_thinking: false } },
        },
        agentPolicy: {
          requestProfiles: {
            toolContinuation: { extra_body: { chat_template_kwargs: { thinking_budget: 4096 } } },
          },
        },
      }],
    };

    assert.deepEqual(
      resolveProviderModelRequest(provider, "reasoning-model", { purpose: "toolContinuation", reasoningEffort: "low" }).requestDefaults,
      {
        max_tokens: 8192,
        extra_body: { chat_template_kwargs: { enable_thinking: true, thinking_budget: 2048 } },
      },
    );
    assert.deepEqual(
      resolveProviderModelRequest(provider, "reasoning-model", { purpose: "chat", reasoningEffort: "unsupported" }).requestDefaults,
      provider.models[0].requestDefaults,
    );
    assert.deepEqual(
      resolveProviderModelRequest(provider, "reasoning-model", { purpose: "verification", reasoningEffort: "low" }).requestDefaults,
      {
        max_tokens: 8,
        extra_body: { chat_template_kwargs: { enable_thinking: false, thinking_budget: 8192 } },
      },
    );
  });

  test("JSON providers accept and merge task-specific request profiles", () => {
    const requestDefaults = {
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: 8_192,
      extra_body: {
        chat_template_kwargs: { enable_thinking: true, thinking_budget: 8_192 },
        keep: true,
      },
    };
    const requestProfiles = {
      summary: {
        temperature: 0.2,
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
      },
      report: {
        max_tokens: 4_096,
        extra_body: { chat_template_kwargs: { thinking_budget: 2_048 } },
      },
      knowledge: {
        top_p: 0.8,
        extra_body: { knowledge_mode: "extract" },
      },
      learn: {
        temperature: 0.15,
        extra_body: { learning_mode: "project" },
      },
      sessionReview: {
        temperature: 0,
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
      },
      messageRisk: {
        temperature: 0,
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
      },
    };
    const provider = {
      requestPolicy: "json",
      models: [{
        id: "task-profile-model",
        requestDefaults,
        agentPolicy: { requestProfiles },
      }],
    };

    assert.equal(validateAgentPolicy(provider.models[0].agentPolicy, { requestPolicy: "json" }), null);
    assert.deepEqual(resolveProviderModelRequest(provider, "task-profile-model", { purpose: "summary" }).requestDefaults, {
      temperature: 0.2,
      top_p: 0.95,
      max_tokens: 8_192,
      extra_body: {
        chat_template_kwargs: { enable_thinking: false, thinking_budget: 8_192 },
        keep: true,
      },
    });
    assert.deepEqual(resolveProviderModelRequest(provider, "task-profile-model", { purpose: "report" }).requestDefaults, {
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: 4_096,
      extra_body: {
        chat_template_kwargs: { enable_thinking: true, thinking_budget: 2_048 },
        keep: true,
      },
    });
    assert.deepEqual(resolveProviderModelRequest(provider, "task-profile-model", { purpose: "knowledge" }).requestDefaults, {
      ...requestDefaults,
      top_p: 0.8,
      extra_body: { ...requestDefaults.extra_body, knowledge_mode: "extract" },
    });
    assert.deepEqual(resolveProviderModelRequest(provider, "task-profile-model", { purpose: "learn" }).requestDefaults, {
      ...requestDefaults,
      temperature: 0.15,
      extra_body: { ...requestDefaults.extra_body, learning_mode: "project" },
    });
    assert.deepEqual(resolveProviderModelRequest(provider, "task-profile-model", { purpose: "sessionReview" }).requestDefaults, {
      temperature: 0,
      top_p: 0.95,
      max_tokens: 8_192,
      extra_body: {
        chat_template_kwargs: { enable_thinking: false, thinking_budget: 8_192 },
        keep: true,
      },
    });
    assert.deepEqual(resolveProviderModelRequest(provider, "task-profile-model", { purpose: "messageRisk" }).requestDefaults, {
      temperature: 0,
      top_p: 0.95,
      max_tokens: 8_192,
      extra_body: {
        chat_template_kwargs: { enable_thinking: false, thinking_budget: 8_192 },
        keep: true,
      },
    });
  });

  test("JSON policy sends API-native defaults and suppresses software reasoning parameters", async () => {
    let payload;
    const requestDefaults = {
      temperature: 0.6,
      max_tokens: 4096,
      top_p: 0.95,
      top_k: 20,
      extra_body: { chat_template_kwargs: { enable_thinking: true } },
    };
    const client = new DeepSeekClient({
      apiKey: "test",
      baseUrl: "https://model.test/v1",
      requestConfigForModel: () => ({ policy: "json", requestDefaults }),
      fetch: async (_url, init) => { payload = JSON.parse(init.body); return response(); },
    });
    await client.chat({
      model: "qwen",
      messages: [{ role: "user", content: "test" }],
      thinking: "enabled",
      reasoningEffort: "max",
      maxTokens: 8,
    });
    assert.deepEqual(payload.extra_body, requestDefaults.extra_body);
    assert.equal(payload.top_p, 0.95);
    assert.equal(payload.top_k, 20);
    assert.equal(payload.temperature, 0.6);
    assert.equal(payload.max_tokens, 8);
    assert.equal(Object.hasOwn(payload, "reasoning_effort"), false);
    assert.equal(Object.hasOwn(payload.extra_body, "thinking"), false);
  });

  test("the public package client applies the same JSON request policy as the CLI client", async () => {
    let payload;
    let purpose;
    const client = new PackageDeepSeekClient({
      apiKey: "test",
      baseUrl: "https://model.test/v1",
      requestConfigForModel: (_model, options) => {
        purpose = options?.purpose;
        return { policy: "json", requestDefaults: { temperature: 0.4, top_p: 0.9, extra_body: { thinking_budget: 4096 } } };
      },
      fetch: async (_url, init) => { payload = JSON.parse(init.body); return response(); },
    });
    await client.chat({
      model: "qwen",
      messages: [{ role: "user", content: "test" }],
      requestPurpose: "summary",
      thinking: "enabled",
      reasoningEffort: "max",
    });
    assert.equal(purpose, "summary");
    assert.equal(payload.temperature, 0.4);
    assert.equal(payload.top_p, 0.9);
    assert.deepEqual(payload.extra_body, { thinking_budget: 4096 });
    assert.equal(Object.hasOwn(payload, "reasoning_effort"), false);
  });

  test("model client forwards the request phase while legacy DeepSeek payload stays unchanged", async () => {
    let purpose;
    let payload;
    const client = new DeepSeekClient({
      apiKey: "test",
      baseUrl: "https://model.test/v1",
      requestConfigForModel: (_model, options) => {
        purpose = options?.purpose;
        return { policy: "legacy", requestDefaults: {} };
      },
      fetch: async (_url, init) => { payload = JSON.parse(init.body); return response(); },
    });
    await client.chat({
      model: "deepseek",
      messages: [{ role: "user", content: "test" }],
      requestPurpose: "toolContinuation",
      thinking: "enabled",
      reasoningEffort: "max",
    });
    assert.equal(purpose, "toolContinuation");
    assert.deepEqual(payload.extra_body, { thinking: { type: "enabled" } });
    assert.equal(payload.reasoning_effort, "max");
  });

  test("agent loop applies continuation phases and same-failure guidance only when opted in", async () => {
    const captured = [];
    let responseIndex = 0;
    const client = {
      chat: async (options) => {
        captured.push(structuredClone(options));
        const path = responseIndex === 0 ? "D:/archive/report one.pptx" : "D:/archive/report(1).pptx";
        if (responseIndex++ < 2) {
          return {
            content: "",
            toolCalls: [{ id: `call-${responseIndex}`, type: "function", function: { name: "officecli", arguments: JSON.stringify({ command: `view ${path} text` }) } }],
            usage: {},
          };
        }
        return { content: "done", toolCalls: [], usage: {} };
      },
    };
    const tools = new ToolRegistry();
    tools.register({
      name: "officecli",
      parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
      readOnly: true,
      fn: async () => JSON.stringify({ error: "local file not found" }),
    });
    const loop = new CacheFirstLoop({
      client,
      prefix: new ImmutablePrefix({ system: "test", toolSpecs: tools.specs() }),
      tools,
      model: "internal-model",
      stream: false,
      autoEscalate: false,
      maxToolIters: 12,
      sameFailureClassLimit: 2,
    });
    const events = [];
    for await (const event of loop.step("summarize the deck")) events.push(event);

    assert.deepEqual(captured.map((call) => call.requestPurpose), ["initial", "toolContinuation", "toolContinuation"]);
    const thirdMessages = captured[2].messages;
    assert.ok(thirdMessages.some((message) => message.role === "tool" && /same failure class.*2 times/i.test(message.content)));
    assert.equal(events.at(-1)?.role, "done");

    const defaultTools = new ToolRegistry();
    const defaultLoop = new CacheFirstLoop({
      client,
      prefix: new ImmutablePrefix({ system: "default", toolSpecs: defaultTools.specs() }),
      tools: defaultTools,
      model: "qwen-by-name-only",
      stream: false,
    });
    assert.equal(defaultLoop.maxToolIters, 64);
    assert.equal(defaultLoop._sameFailureClassTracker.limit, null);
  });

  test("same-failure fuse blocks a third unrecovered tool call", async () => {
    let responseIndex = 0;
    let toolRuns = 0;
    const equivalentArgs = [
      '{"command":"view D:/archive/missing.pptx text","metadata":{"a":1,"b":2}}',
      '{"metadata":{"b":2,"a":1},"command":"view D:/archive/missing.pptx text"}',
      '{"metadata":{"a":1,"b":2},"command":"view D:/archive/missing.pptx text"}',
    ];
    const client = {
      chat: async () => {
        if (responseIndex++ < 3) {
          return {
            content: "",
            toolCalls: [{
              id: `call-${responseIndex}`,
              type: "function",
              function: {
                name: "officecli",
                arguments: equivalentArgs[responseIndex - 1],
              },
            }],
            usage: {},
          };
        }
        return { content: "stopped retrying", toolCalls: [], usage: {} };
      },
    };
    const tools = new ToolRegistry();
    tools.register({
      name: "officecli",
      parameters: {
        type: "object",
        properties: { command: { type: "string" }, metadata: { type: "object" } },
        required: ["command"],
      },
      readOnly: true,
      fn: async () => {
        toolRuns++;
        return JSON.stringify({ error: "local file not found" });
      },
    });
    const loop = new CacheFirstLoop({
      client,
      prefix: new ImmutablePrefix({ system: "test", toolSpecs: tools.specs() }),
      tools,
      model: "internal-model",
      stream: false,
      autoEscalate: false,
      maxToolIters: 12,
      sameFailureClassLimit: 2,
    });
    const events = [];
    for await (const event of loop.step("read the presentation")) events.push(event);

    assert.equal(toolRuns, 2);
    assert.ok(events.some((event) => event.role === "tool" && /REPEATED_TOOL_FAILURE_BLOCKED/.test(event.content)));
  });

  test("same-failure fuse allows a materially changed recovery call", async () => {
    let responseIndex = 0;
    let toolRuns = 0;
    const client = {
      chat: async () => {
        responseIndex++;
        if (responseIndex <= 2) {
          return {
            content: "",
            toolCalls: [{
              id: `call-${responseIndex}`,
              type: "function",
              function: {
                name: "officecli",
                arguments: JSON.stringify({ command: "view D:/archive/missing.pptx text" }),
              },
            }],
            usage: {},
          };
        }
        if (responseIndex === 3) {
          return {
            content: "",
            toolCalls: [{
              id: `call-${responseIndex}`,
              type: "function",
              function: {
                name: "officecli",
                arguments: JSON.stringify({ command: "view D:/archive/corrected.pptx text" }),
              },
            }],
            usage: {},
          };
        }
        return { content: "recovered", toolCalls: [], usage: {} };
      },
    };
    const tools = new ToolRegistry();
    tools.register({
      name: "officecli",
      parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
      readOnly: true,
      fn: async (args) => {
        toolRuns++;
        return args.command.includes("corrected") ? "ok" : JSON.stringify({ error: "local file not found" });
      },
    });
    const loop = new CacheFirstLoop({
      client,
      prefix: new ImmutablePrefix({ system: "test", toolSpecs: tools.specs() }),
      tools,
      model: "internal-model",
      stream: false,
      autoEscalate: false,
      maxToolIters: 12,
      sameFailureClassLimit: 2,
    });
    const events = [];
    for await (const event of loop.step("recover the presentation")) events.push(event);

    assert.equal(toolRuns, 3);
    assert.equal(events.some((event) => /REPEATED_TOOL_FAILURE_BLOCKED/.test(event.content ?? "")), false);
    assert.equal(events.at(-1)?.role, "done");
  });

  test("legacy policy preserves existing DeepSeek thinking and effort fields", async () => {
    let payload;
    const client = new DeepSeekClient({
      apiKey: "test",
      baseUrl: "https://model.test/v1",
      requestConfigForModel: () => ({ policy: "legacy", requestDefaults: {} }),
      fetch: async (_url, init) => { payload = JSON.parse(init.body); return response(); },
    });
    await client.chat({
      model: "deepseek",
      messages: [{ role: "user", content: "test" }],
      thinking: "enabled",
      reasoningEffort: "max",
    });
    assert.deepEqual(payload.extra_body, { thinking: { type: "enabled" } });
    assert.equal(payload.reasoning_effort, "max");
  });

  test("launcher, model detection and dashboard share the JSON request policy", () => {
    const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
    const server = readFileSync(new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url), "utf8");
    const providerConfiguration = readFileSync(new URL("../lib/provider-configuration.mjs", import.meta.url), "utf8");
    const dashboard = readFileSync(new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url), "utf8");
    assert.match(launcher, /function createConfiguredModelClient/);
    assert.match(launcher, /requestConfigForModel: \(modelId, options\) => resolveProviderModelRequest\(getActiveProvider\(config\), modelId, \{[\s\S]*?reasoningEffort: config\.reasoningEffort/);
    assert.match(launcher, /resolveProviderModelAgentPolicy/);
    assert.match(launcher, /resolveProviderModelCapabilities/);
    assert.match(launcher, /resolveProviderModelVisionPolicy/);
    assert.match(launcher, /maxOutputTokens: capabilities\.maxOutputTokens/);
    assert.match(launcher, /return resolveDocumentOutputBudget\(provider, model, \{ purpose: "report", fallback \}\)/);
    assert.match(launcher, /contextInputGuard: contextInputTransactions/);
    assert.doesNotMatch(launcher, /name:\s*"organize_document_to_markdown"/);
    assert.doesNotMatch(launcher, /\/pro\|reason\|vision\/i/);
    assert.match(launcher, /maxToolContinuationWindows/);
    assert.match(launcher, /toolResultBudget/);
    assert.match(launcher, /tools\.setResultAugmenter\(null\)/);
    assert.match(launcher, /sameFailureClassLimit/);
    assert.match(launcher, /escalationModel/);
    assert.doesNotMatch(launcher, /new DeepSeekClient\(\{ apiKey, baseUrl \}\)/);
    assert.match(server, /requestConfigForModel: \(modelId\) => resolveProviderModelRequest\(provider, modelId, \{ purpose: "verification" \}\)/);
    assert.match(server, /requestConfig: resolveProviderModelRequest\(provider, model\.id, \{ purpose: "verification" \}\)/);
    assert.match(providerConfiguration, /validateRequestDefaults\(model\.requestDefaults\)/);
    assert.match(providerConfiguration, /importMode === "replace"/);
    assert.match(providerConfiguration, /config\.activeProviderId = payload\.activeProviderId/);
    assert.match(server, /await ctx\.syncProvider\?\.\(nextConfig\.activeProviderId\)/);
    assert.match(dashboard, /o3\.requestPolicy === "json" \? "JSON \\u53C2\\u6570"/);
    assert.match(dashboard, /activeModelEfforts/);
    assert.doesNotMatch(dashboard, /由导入 JSON 固定/);
  });

  test("provider import replaces JSON policy configuration and synchronizes the selected provider", async () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-model-policy-"));
    const configPath = join(root, "config.json");
    const existing = {
      activeProviderId: "qwen",
      providers: [{
        id: "qwen",
        name: "old",
        stale: true,
        baseUrl: "https://old.test/v1",
        apiKey: "old",
        models: [{ id: "old-model", maxContextLength: 1024 }],
      }],
    };
    writeFileSync(configPath, JSON.stringify(existing), "utf8");
    const synced = [];
    try {
      const imported = await apiRequest("/api/providers/import", {
        schemaVersion: 2,
        importMode: "replace",
        activeProviderId: "qwen",
        providers: [{
          id: "qwen",
          name: "Qwen",
          baseUrl: "https://qwen.test/v1",
          apiKey: "test",
          requestPolicy: "json",
          models: [{
            id: "qwen-new",
            presets: ["flash"],
            maxContextLength: 262144,
            requestDefaults: { top_p: 0.95, extra_body: { chat_template_kwargs: { enable_thinking: true } } },
            verificationRequestDefaults: { extra_body: { chat_template_kwargs: { enable_thinking: false } } },
            agentPolicy: {
              documentWorkflow: "guided",
              maxToolIterations: 12,
              maxToolContinuationWindows: 1,
              sameFailureClassLimit: 2,
              toolResultBudget: { defaultTokens: 16000, documentTokens: 24000, absoluteMaxTokens: 32000 },
              requestProfiles: { toolContinuation: { temperature: 0.1 } },
              documentPolicy: { batchInputTokens: 3000, batchOutputTokens: 8192, maxUnitsPerBatch: 8, maxRetries: 2, autoFallback: true },
            },
            visionPolicy: { maxImages: 5, detail: "high", estimatedTokensPerImage: 4096, contextReserveTokens: 16000 },
          }],
        }],
      }, {
        configPath,
        syncProvider: async (id) => { synced.push(id); return { providerId: id }; },
        refreshContextCap: () => ({ contextPolicy: { effectiveCap: 262144 } }),
      });
      assert.equal(imported.status, 200);
      assert.deepEqual(synced, ["qwen"]);
      const stored = JSON.parse(readFileSync(configPath, "utf8"));
      assert.equal(stored.activeProviderId, "qwen");
      assert.equal(stored.providers[0].stale, undefined);
      assert.equal(stored.providers[0].models[0].requestDefaults.extra_body.chat_template_kwargs.enable_thinking, true);
      assert.equal(stored.providers[0].models[0].verificationRequestDefaults.extra_body.chat_template_kwargs.enable_thinking, false);
      assert.equal(stored.providers[0].models[0].agentPolicy.maxToolIterations, 12);
      assert.equal(stored.providers[0].models[0].agentPolicy.toolResultBudget.documentTokens, 24000);
      assert.equal(stored.providers[0].models[0].agentPolicy.documentPolicy.batchInputTokens, 3000);
      assert.equal(stored.providers[0].models[0].visionPolicy.contextReserveTokens, 16000);

      const rejected = await apiRequest("/api/providers/import", {
        schemaVersion: 2,
        providers: [{
          id: "qwen",
          requestPolicy: "json",
          models: [{ id: "qwen-new", maxContextLength: 262144, requestDefaults: { model: "override" } }],
        }],
      }, { configPath });
      assert.equal(rejected.status, 400);
      assert.match(rejected.body.error, /reserved field.*model/i);

      const invalidVerification = await apiRequest("/api/providers/import", {
        schemaVersion: 2,
        providers: [{
          id: "qwen",
          requestPolicy: "json",
          models: [{
            id: "qwen-new",
            maxContextLength: 262144,
            requestDefaults: {},
            verificationRequestDefaults: { messages: [] },
          }],
        }],
      }, { configPath });
      assert.equal(invalidVerification.status, 400);
      assert.match(invalidVerification.body.error, /verification.*reserved field.*messages/i);

      const invalidAgentPolicy = await apiRequest("/api/providers/import", {
        schemaVersion: 2,
        providers: [{
          id: "qwen",
          requestPolicy: "json",
          models: [{ id: "qwen-new", maxContextLength: 262144, requestDefaults: {}, agentPolicy: { maxToolIterations: 0 } }],
        }],
      }, { configPath });
      assert.equal(invalidAgentPolicy.status, 400);
      assert.match(invalidAgentPolicy.body.error, /agentPolicy.*maxToolIterations/i);

      const invalidVisionPolicy = await apiRequest("/api/providers/import", {
        schemaVersion: 2,
        providers: [{
          id: "qwen",
          requestPolicy: "json",
          models: [{ id: "qwen-new", maxContextLength: 262144, requestDefaults: {}, visionPolicy: { maxImages: 8 } }],
        }],
      }, { configPath });
      assert.equal(invalidVisionPolicy.status, 400);
      assert.match(invalidVisionPolicy.body.error, /visionPolicy.*maxImages/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

});
