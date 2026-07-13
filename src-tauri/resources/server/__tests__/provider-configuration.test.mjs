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
        { op: "updateModel", providerId: "company", modelKey: "company-primary", changes: { id: "model-next", name: "Next" } },
        { op: "upsertModel", providerId: "company", model: { key: "company-vision", id: "vision-next", name: "Vision", presets: ["pro"], maxContextLength: 65536 } },
        { op: "syncModels", providerId: "company", models: [
          { key: "company-primary", id: "model-next", name: "Next", presets: ["flash"], maxContextLength: 32768 },
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
