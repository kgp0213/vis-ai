import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";

import { previewProviderImport } from "../lib/provider-configuration.mjs";

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const TOKEN = "provider-config-test-token";
const tmpDir = mkdtempSync(join(tmpdir(), "provider-config-test-"));
const configPath = join(tmpDir, "config.json");

function baseConfig() {
  return {
    preset: "flash",
    activeProviderId: "company",
    providers: [{
      id: "company",
      name: "Company",
      baseUrl: "https://old.example/v1",
      apiKey: "company-old-api-key",
      models: [
        { key: "company-primary", id: "model-old", name: "Old", presets: ["flash"], maxContextLength: 32768, verification: { ok: true } },
        { id: "legacy-model", name: "Legacy", presets: ["pro"], maxContextLength: 32768, verification: { ok: true } },
      ],
    }],
  };
}

function ctx(overrides = {}) {
  return {
    configPath,
    mode: "desktop",
    loop: { model: "model-old" },
    getModes: () => ({ current: "general", list: [], active: null }),
    getEccRules: () => null,
    getCurrentCwd: () => tmpDir,
    syncProvider: async () => {},
    refreshContextCap: () => {},
    ...overrides,
  };
}

async function post(path, body, overrides = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.url = path;
  req.method = "POST";
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  let status;
  let raw;
  const res = { writeHead(value) { status = value; }, end(value) { raw = value; } };
  await dispatch(req, res, ctx(overrides), TOKEN);
  return { status, json: raw ? JSON.parse(raw) : null };
}

async function get(path, overrides = {}) {
  const req = { url: path, method: "GET", headers: { "x-reasonix-token": TOKEN } };
  let status;
  let raw;
  const res = { writeHead(value) { status = value; }, end(value) { raw = value; } };
  await dispatch(req, res, ctx(overrides), TOKEN);
  return { status, json: raw ? JSON.parse(raw) : null };
}

beforeEach(() => writeFileSync(configPath, JSON.stringify(baseConfig(), null, 2)));
after(() => rmSync(tmpDir, { recursive: true, force: true }));

describe("Provider schema v3 maintenance", () => {
  test("accepts only explicit supported provider adapter types", () => {
    const configured = previewProviderImport(baseConfig(), {
      schemaVersion: 3,
      operations: [{
        op: "updateProvider",
        providerId: "company",
        changes: { providerType: "kimi" },
      }],
    });
    assert.equal(configured.config.providers[0].providerType, "kimi");

    assert.throws(() => previewProviderImport(baseConfig(), {
      schemaVersion: 3,
      operations: [{
        op: "updateProvider",
        providerId: "company",
        changes: { providerType: "model-name-guess" },
      }],
    }), /providerType/);
  });

  test("accepts model effort parameter maps and rejects options that are not declared", () => {
    const source = baseConfig();
    source.providers[0].requestPolicy = "json";
    for (const model of source.providers[0].models) model.requestDefaults = {};
    const valid = previewProviderImport(source, {
      schemaVersion: 3,
      operations: [{
        op: "updateModel",
        providerId: "company",
        modelKey: "company-primary",
        changes: {
          efforts: ["high", "max"],
          effortParams: {
            high: { reasoning_effort: "high" },
            max: { reasoning_effort: "max" },
          },
        },
      }],
    });
    assert.deepEqual(valid.config.providers[0].models[0].effortParams.max, { reasoning_effort: "max" });

    assert.throws(() => previewProviderImport(source, {
      schemaVersion: 3,
      operations: [{
        op: "updateModel",
        providerId: "company",
        modelKey: "company-primary",
        changes: {
          efforts: ["high"],
          effortParams: { max: { reasoning_effort: "max" } },
        },
      }],
    }), /effortParams.*max.*efforts/i);
  });
  test("accepts validated provider UI grouping metadata", () => {
    const result = previewProviderImport(baseConfig(), {
      schemaVersion: 3,
      operations: [{
        op: "updateProvider",
        providerId: "company",
        changes: {
          ui: {
            groupId: "volcengine-ark",
            groupName: "火山方舟 Ark",
            family: "cloud-models",
            modelLabel: "Company Models",
            order: 20,
            recommendedFor: ["chat", "code"],
          },
        },
      }],
    });
    assert.equal(result.config.providers[0].ui.groupId, "volcengine-ark");
    assert.deepEqual(result.config.providers[0].ui.recommendedFor, ["chat", "code"]);
  });

  test("rejects malformed provider UI grouping metadata", () => {
    assert.throws(() => previewProviderImport(baseConfig(), {
      schemaVersion: 3,
      operations: [{
        op: "updateProvider",
        providerId: "company",
        changes: { ui: { groupId: "volcengine-ark", order: "first" } },
      }],
    }), /provider.*ui.*order/i);
  });

  test("imports explicit model capabilities without requiring duplicate legacy capacity fields", () => {
    const capabilities = {
      protocol: "openai-chat-completions",
      inputModalities: ["text", "image"],
      streaming: true,
      toolCalling: true,
      structuredOutput: true,
      maxContextTokens: 262_144,
      maxOutputTokens: 16_384,
      maxImagesPerRequest: 8,
      roles: ["chat", "document-draft", "document-review", "vision-review", "summary"],
    };
    const result = previewProviderImport(baseConfig(), {
      schemaVersion: 3,
      operations: [{
        op: "upsertModel",
        providerId: "company",
        model: {
          key: "company-next",
          id: "model-next",
          name: "Next",
          presets: ["pro"],
          capabilities,
        },
      }],
    });

    const imported = result.config.providers[0].models.find((model) => model.key === "company-next");
    assert.deepEqual(imported.capabilities, capabilities);
    assert.equal(imported.maxContextLength, undefined);
  });

  test("rejects malformed capability structure before it can be persisted", () => {
    assert.throws(() => previewProviderImport(baseConfig(), {
      schemaVersion: 3,
      operations: [{
        op: "updateModel",
        providerId: "company",
        modelKey: "company-primary",
        changes: {
          capabilities: {
            protocol: "openai-chat-completions",
            inputModalities: ["text"],
            streaming: "sometimes",
            roles: ["chat"],
          },
        },
      }],
    }), /capabilities.*streaming.*boolean/i);
  });

  test("stable key supports API id/name changes, additions, and sync disabling", () => {
    const source = baseConfig();
    const payload = {
      schemaVersion: 3,
      operations: [
        { op: "updateProvider", providerId: "company", changes: { name: "Company Next", baseUrl: "https://new.example/v1" } },
        { op: "updateModel", providerId: "company", modelKey: "company-primary", changes: {
          id: "model-next",
          name: "Next",
          agentPolicy: {
            documentWorkflow: "guided",
            maxToolIterations: 24,
            maxToolContinuationWindows: 1,
            sameFailureClassLimit: 2,
            toolResultBudget: { defaultTokens: 16000, documentTokens: 24000, absoluteMaxTokens: 32000 },
          },
          visionPolicy: { maxImages: 5, detail: "high", estimatedTokensPerImage: 4096, contextReserveTokens: 16000 },
        } },
        { op: "upsertModel", providerId: "company", model: { key: "company-vision", id: "vision-next", name: "Vision", presets: ["pro"], maxContextLength: 65536 } },
        { op: "syncModels", providerId: "company", models: [
          {
            key: "company-primary",
            id: "model-next",
            name: "Next",
            presets: ["flash"],
            maxContextLength: 32768,
            agentPolicy: {
              documentWorkflow: "guided",
              maxToolIterations: 24,
              maxToolContinuationWindows: 1,
              sameFailureClassLimit: 2,
              toolResultBudget: { defaultTokens: 16000, documentTokens: 24000, absoluteMaxTokens: 32000 },
            },
            visionPolicy: { maxImages: 5, detail: "high", estimatedTokensPerImage: 4096, contextReserveTokens: 16000 },
          },
          { key: "company-vision", id: "vision-next", name: "Vision", presets: ["pro"], maxContextLength: 65536 },
        ] },
      ],
    };

    const result = previewProviderImport(source, payload);
    const provider = result.config.providers[0];
    assert.equal(provider.name, "Company Next");
    assert.equal(provider.baseUrl, "https://new.example/v1");
    assert.deepEqual(provider.models.map((model) => [model.key, model.id, model.disabled === true]), [
      ["company-primary", "model-next", false],
      ["legacy-model", "legacy-model", true],
      ["company-vision", "vision-next", false],
    ]);
    assert.equal(result.preview.destructive, false);
    assert.equal(provider.models[0].agentPolicy.maxToolIterations, 24);
    assert.equal(provider.models[0].agentPolicy.toolResultBudget.documentTokens, 24000);
    assert.equal(provider.models[0].visionPolicy.contextReserveTokens, 16000);
    assert.ok(result.preview.actions.some((action) => action.kind === "disable-model"));
    assert.deepEqual(source, baseConfig(), "preview must not mutate the persisted source");
  });

  test("permanent removal requires explicit confirmation", () => {
    const payload = { schemaVersion: 3, operations: [{ op: "removeModel", providerId: "company", modelKey: "legacy-model" }] };
    const preview = previewProviderImport(baseConfig(), payload);
    assert.equal(preview.preview.destructive, true);
    assert.throws(() => previewProviderImport(baseConfig(), payload, { confirmDestructive: false }), /confirmDestructive/);
    const applied = previewProviderImport(baseConfig(), payload, { confirmDestructive: true });
    assert.equal(applied.config.providers[0].models.some((model) => model.id === "legacy-model"), false);
  });

  test("provider removal is explicit and cannot remove the active provider", () => {
    const source = baseConfig();
    source.providers.push({
      id: "retired-provider",
      name: "Retired",
      baseUrl: "https://retired.example/v1",
      apiKey: "retired-provider-key",
      models: [{ key: "retired-model", id: "retired-model", presets: ["flash"], maxContextLength: 32768 }],
    });
    const payload = { schemaVersion: 3, operations: [{ op: "removeProvider", providerId: "retired-provider" }] };
    const preview = previewProviderImport(source, payload);
    assert.equal(preview.preview.requiresConfirmation, true);
    assert.throws(() => previewProviderImport(source, payload, { confirmDestructive: false }), /confirmDestructive/);
    const applied = previewProviderImport(source, payload, { confirmDestructive: true });
    assert.deepEqual(applied.config.providers.map((provider) => provider.id), ["company"]);

    const activePayload = { schemaVersion: 3, operations: [{ op: "removeProvider", providerId: "company" }] };
    assert.throws(() => previewProviderImport(source, activePayload), /active provider/);
  });
});

describe("Provider schema v2 combined import and cleanup", () => {
  test("adds providers and removes an existing retired provider atomically", () => {
    const source = baseConfig();
    source.providers.push({
      id: "local-deepseek",
      name: "Retired DeepSeek",
      baseUrl: "https://retired.example/v1",
      apiKey: "retired-provider-key",
      models: [{ key: "local-deepseek-primary", id: "retired-model", presets: ["flash"], maxContextLength: 32768 }],
    });
    const payload = {
      schemaVersion: 2,
      importMode: "replace",
      activeProviderId: "company",
      removeProviderIds: ["local-deepseek", "already-absent"],
      providers: [{
        id: "new-qwen",
        name: "New Qwen",
        baseUrl: "https://qwen.example/v1",
        apiKey: "new-qwen-provider-key",
        requestPolicy: "json",
        models: [{ key: "qwen-primary", id: "qwen-model", presets: ["flash"], maxContextLength: 65536, requestDefaults: { temperature: 0.6 } }],
      }],
    };

    const preview = previewProviderImport(source, payload);
    assert.equal(preview.preview.requiresConfirmation, true);
    assert.deepEqual(preview.preview.actions.map((action) => action.kind), ["add-provider", "remove-provider"]);
    assert.throws(() => previewProviderImport(source, payload, { confirmDestructive: false }), /confirmDestructive/);
    const applied = previewProviderImport(source, payload, { confirmDestructive: true });
    assert.deepEqual(applied.config.providers.map((provider) => provider.id), ["company", "new-qwen"]);
    assert.equal(applied.config.activeProviderId, "company");
    assert.deepEqual(source.providers.map((provider) => provider.id), ["company", "local-deepseek"]);
  });

  test("rejects conflicting or active provider cleanup", () => {
    const source = baseConfig();
    const provider = source.providers[0];
    assert.throws(() => previewProviderImport(source, {
      schemaVersion: 2,
      providers: [provider],
      removeProviderIds: [provider.id],
    }), /both imported and removed/);
    assert.throws(() => previewProviderImport(source, {
      schemaVersion: 2,
      providers: [{ id: "new-provider", baseUrl: "https://new.example/v1", apiKey: "new-provider-key", models: [{ id: "new-model", maxContextLength: 32768 }] }],
      removeProviderIds: [provider.id],
    }), /active provider/);
  });
});

describe("Provider credential rotation API", () => {
  test("exposes redacted diagnostics and records managed imports", async () => {
    const diagnostics = { activeProviderId: "company", providers: [{ id: "company", apiKeyPresent: true }] };
    const listed = await get("/api/providers/diagnostics", {
      getProviderDiagnostics: () => diagnostics,
    });
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.json, diagnostics);

    let provenance = null;
    const imported = await post("/api/providers/import", {
      schemaVersion: 3,
      operations: [{
        op: "updateProvider",
        providerId: "company",
        changes: { name: "Company Imported" },
      }],
    }, {
      recordProviderProvenance: (providerIds, source) => { provenance = { providerIds, source }; },
    });
    assert.equal(imported.status, 200);
    assert.deepEqual(provenance, { providerIds: ["company"], source: "json-import" });
  });

  test("cleans only current failed models, removes empty providers, and selects a passed fallback", async () => {
    writeFileSync(configPath, JSON.stringify({
      preset: "flash",
      model: "bad-active",
      activeProviderId: "company",
      providers: [
        {
          id: "company",
          name: "Company",
          baseUrl: "https://company.example/v1",
          apiKey: "company-key",
          models: [
            { id: "bad-active", name: "Bad Active", presets: ["flash"], maxContextLength: 32768 },
            { id: "good-fallback", name: "Good Fallback", presets: ["pro"], maxContextLength: 65536 },
          ],
        },
        {
          id: "failed-only",
          name: "Failed Only",
          baseUrl: "https://failed.example/v1",
          apiKey: "failed-key",
          models: [{ id: "dead-model", name: "Dead", presets: ["flash"], maxContextLength: 32768 }],
        },
      ],
    }, null, 2));
    const tested = await post("/api/providers/test", {}, {
      testProviderModel: async (_provider, model) => {
        if (model.id !== "good-fallback") throw new Error("probe failed");
      },
    });
    assert.equal(tested.status, 200);
    assert.equal(tested.json.passed, 1);
    const testedAt = JSON.parse(readFileSync(configPath, "utf8")).modelVerification.testedAt;
    let synced = null;
    const cleaned = await post("/api/providers/cleanup-failed", { testedAt }, {
      syncProvider: async (id) => { synced = id; return { model: "good-fallback" }; },
    });
    assert.equal(cleaned.status, 200);
    assert.equal(cleaned.json.removedModels, 2);
    assert.equal(cleaned.json.removedProviders, 1);
    assert.equal(cleaned.json.activeModelId, "good-fallback");
    assert.equal(synced, "company");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.deepEqual(config.providers.map((provider) => provider.id), ["company"]);
    assert.deepEqual(config.providers[0].models.map((model) => model.id), ["good-fallback"]);
    assert.equal(config.model, "good-fallback");
    assert.equal(config.preset, "pro");
  });

  test("rejects failed-model cleanup for stale or dirty detection results", async () => {
    const tested = await post("/api/providers/test", {}, {
      testProviderModel: async () => { throw new Error("probe failed"); },
    });
    assert.equal(tested.status, 200);
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    const stale = await post("/api/providers/cleanup-failed", { testedAt: "stale-result" });
    assert.equal(stale.status, 409);
    config.modelVerification.dirty = true;
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    const dirty = await post("/api/providers/cleanup-failed", { testedAt: config.modelVerification.testedAt });
    assert.equal(dirty.status, 409);
  });

  test("clears the active selection when every configured model failed", async () => {
    const tested = await post("/api/providers/test", {}, {
      testProviderModel: async () => { throw new Error("probe failed"); },
    });
    assert.equal(tested.status, 200);
    const testedAt = JSON.parse(readFileSync(configPath, "utf8")).modelVerification.testedAt;
    const cleaned = await post("/api/providers/cleanup-failed", { testedAt });
    assert.equal(cleaned.status, 200);
    assert.equal(cleaned.json.removedModels, 2);
    assert.equal(cleaned.json.removedProviders, 1);
    assert.equal(cleaned.json.activeProviderId, null);
    assert.equal(cleaned.json.activeModelId, null);
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.deepEqual(config.providers, []);
    assert.equal(config.activeProviderId, null);
    assert.equal(config.model, null);
  });

  test("switches provider and concrete model atomically", async () => {
    let synced = null;
    const selected = await post("/api/providers/active", {
      id: "company",
      modelId: "legacy-model",
    }, {
      syncProvider: async (id) => {
        synced = id;
        return { model: "legacy-model", messageCount: 4 };
      },
    });
    assert.equal(selected.status, 200);
    assert.equal(synced, "company");
    assert.equal(selected.json.activeModelId, "legacy-model");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(config.activeProviderId, "company");
    assert.equal(config.model, "legacy-model");
    assert.equal(config.preset, "pro");
  });

  test("settings API uses capabilities.maxContextTokens as the model capacity", async () => {
    writeFileSync(configPath, JSON.stringify({
      preset: "auto",
      model: "future-model",
      providers: [{
        id: "future-provider",
        models: [{
          id: "future-model",
          presets: ["auto"],
          efforts: ["high"],
          capabilities: { maxContextTokens: 262144 },
        }],
      }],
      activeProviderId: "future-provider",
    }, null, 2));

    const settings = await get("/api/settings");
    assert.equal(settings.status, 200);
    assert.equal(settings.json.providerContextCap, 262144);

    const rejected = await post("/api/settings", { contextCapTokens: 300000 });
    assert.equal(rejected.status, 400);
    assert.match(rejected.json.error, /262144/);
  });

  test("settings accepts only the active model's reasoning efforts", async () => {
    writeFileSync(configPath, JSON.stringify({
      preset: "flash",
      model: "fast-model",
      reasoningEffort: "high",
      providers: [{
        id: "mixed-provider",
        requestPolicy: "json",
        defaultEffort: "high",
        models: [
          {
            id: "fast-model",
            presets: ["flash"],
            efforts: ["low", "high"],
            maxContextLength: 32768,
            requestDefaults: {},
            effortParams: { low: { reasoning_effort: "low" }, high: { reasoning_effort: "high" } },
          },
          {
            id: "strong-model",
            presets: ["pro"],
            efforts: ["max"],
            maxContextLength: 32768,
            requestDefaults: {},
            effortParams: { max: { reasoning_effort: "max" } },
          },
        ],
      }],
      activeProviderId: "mixed-provider",
    }, null, 2));

    const accepted = await post("/api/settings", { reasoningEffort: "low" });
    assert.equal(accepted.status, 200);
    const rejected = await post("/api/settings", { reasoningEffort: "max" });
    assert.equal(rejected.status, 400);
    assert.match(rejected.json.error, /fast-model/);
  });

  test("requires a matching successful test before credentials can be saved", async () => {
    let testedCandidate;
    const tested = await post("/api/providers/credentials/test", {
      providerId: "company",
      apiKey: "company-new-api-key",
      baseUrl: "https://new.example/v1",
    }, {
      testProviderModel: async (provider, model) => { testedCandidate = { provider, model }; },
    });
    assert.equal(tested.status, 200);
    assert.ok(tested.json.verificationToken);
    assert.equal(testedCandidate.provider.apiKey, "company-new-api-key");
    assert.equal(JSON.parse(readFileSync(configPath, "utf8")).providers[0].apiKey, "company-old-api-key");

    const changedAfterTest = await post("/api/providers/credentials/save", {
      providerId: "company",
      apiKey: "different-after-test",
      baseUrl: "https://new.example/v1",
      verificationToken: tested.json.verificationToken,
    });
    assert.equal(changedAfterTest.status, 409);

    const retested = await post("/api/providers/credentials/test", {
      providerId: "company",
      apiKey: "company-new-api-key",
      baseUrl: "https://new.example/v1",
    }, { testProviderModel: async () => {} });
    assert.equal(retested.status, 200);

    let synced = null;
    const saved = await post("/api/providers/credentials/save", {
      providerId: "company",
      apiKey: "company-new-api-key",
      baseUrl: "https://new.example/v1",
      verificationToken: retested.json.verificationToken,
    }, { syncProvider: async (id) => { synced = id; } });
    assert.equal(saved.status, 200);
    assert.equal(synced, "company");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(config.providers[0].apiKey, "company-new-api-key");
    assert.equal(config.providers[0].baseUrl, "https://new.example/v1");
    assert.equal(config.providers[0].models.every((model) => model.verification === undefined), true);

    const reused = await post("/api/providers/credentials/save", {
      providerId: "company",
      apiKey: "company-new-api-key",
      baseUrl: "https://new.example/v1",
      verificationToken: retested.json.verificationToken,
    });
    assert.equal(reused.status, 409);
  });

  test("direct settings credential writes are rejected", async () => {
    const result = await post("/api/settings", { apiKey: "bypass-attempt-api-key" });
    assert.equal(result.status, 400);
    assert.match(result.json.error, /detect|检测/i);
  });
});
