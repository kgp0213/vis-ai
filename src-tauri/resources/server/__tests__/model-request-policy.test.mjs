import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import {
  resolveProviderModelRequest,
  validateRequestDefaults,
} from "../lib/model-request-policy.mjs";

const { DeepSeekClient } = await import(new URL("../visionox-pkg/dist/cli/chunk-2KDUS647.js", import.meta.url));
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
  test("validates JSON defaults without allowing protocol fields to be replaced", () => {
    assert.equal(validateRequestDefaults({ temperature: 0.6, extra_body: { chat_template_kwargs: { enable_thinking: true } } }), null);
    assert.match(validateRequestDefaults({ model: "other" }), /reserved field.*model/i);
    assert.match(validateRequestDefaults({ messages: [] }), /reserved field.*messages/i);
    assert.match(validateRequestDefaults({ extra_body: { __proto__: null } }), /plain JSON object|forbidden field/i);
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
    assert.match(launcher, /requestConfigForModel: \(modelId\) => resolveProviderModelRequest\(getActiveProvider\(config\), modelId\)/);
    assert.doesNotMatch(launcher, /new DeepSeekClient\(\{ apiKey, baseUrl \}\)/);
    assert.match(server, /requestConfigForModel: \(modelId\) => resolveProviderModelRequest\(provider, modelId, \{ purpose: "verification" \}\)/);
    assert.match(server, /requestConfig: resolveProviderModelRequest\(provider, model\.id, \{ purpose: "verification" \}\)/);
    assert.match(providerConfiguration, /validateRequestDefaults\(model\.requestDefaults\)/);
    assert.match(providerConfiguration, /importMode === "replace"/);
    assert.match(providerConfiguration, /config\.activeProviderId = payload\.activeProviderId/);
    assert.match(server, /await ctx\.syncProvider\?\.\(nextConfig\.activeProviderId\)/);
    assert.match(dashboard, /provider\.requestPolicy === "json" \? "JSON \\u56FA\\u5B9A\\u53C2\\u6570"/);
    assert.match(dashboard, /由导入 JSON 固定/);
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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

});
