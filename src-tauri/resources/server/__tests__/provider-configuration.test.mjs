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

beforeEach(() => writeFileSync(configPath, JSON.stringify(baseConfig(), null, 2)));
after(() => rmSync(tmpDir, { recursive: true, force: true }));

describe("Provider schema v3 maintenance", () => {
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
