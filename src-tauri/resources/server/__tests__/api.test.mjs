import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);

const TOKEN = "test-token-12345";

describe("HTTP API 集成测试", () => {
  let tmpDir;
  let configPath;
  let configCounter = 0;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "api-test-"));
    configPath = join(tmpDir, "config.json");
    writeConfig({
      editMode: "auto",
      preset: "auto",
      reasoningEffort: "max",
      providers: [{
        id: "test-provider",
        name: "Test",
        baseUrl: "http://localhost:11434/v1",
        apiKey: "sk-test-key",
        models: [
          { id: "test-flash", name: "Flash", presets: ["auto", "flash"], efforts: ["high", "max"], thinkingMode: "enabled", maxContextLength: 131072 },
        ],
        defaultPreset: "auto",
        defaultEffort: "max",
        autoEscalate: false,
      }],
      activeProviderId: "test-provider",
    });
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Mock helpers ──────────────────────────────────────────

  function writeConfig(cfg) {
    writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    return configPath;
  }

  function mockReq(method, path, body) {
    const headers = { "x-reasonix-token": TOKEN };
    if (body) {
      const json = typeof body === "string" ? body : JSON.stringify(body);
      return Readable.from([Buffer.from(json)]);
    }
    return { url: path, method, headers };
  }

  function mockRes() {
    let status = null;
    let body = null;
    let headers = null;
    return {
      writeHead(s, h) { status = s; headers = h; },
      end(data) { body = data; },
      get status() { return status; },
      get body() { return body; },
      get json() {
        try { return body ? JSON.parse(body) : null; } catch { return null; }
      },
    };
  }

  function mockCtx(overrides = {}) {
    return {
      configPath,
      mode: "desktop",
      getModes: () => ({ current: "general", list: [], active: null }),
      getEccRules: () => null,
      getSessionName: () => null,
      getCurrentCwd: () => tmpDir,
      loop: { model: "test-flash" },
      syncProvider: async () => {},
      refreshContextCap: () => {},
      usageLogPath: join(tmpDir, "usage.log"),
      ...overrides,
    };
  }

  async function apiGet(path, ctxOverrides = {}) {
    const req = { url: path, method: "GET", headers: { "x-reasonix-token": TOKEN } };
    const res = mockRes();
    await dispatch(req, res, mockCtx(ctxOverrides), TOKEN);
    return res;
  }

  async function apiPost(path, body, ctxOverrides = {}) {
    const json = typeof body === "string" ? body : JSON.stringify(body);
    const req = Readable.from([Buffer.from(json)]);
    req.url = path;
    req.method = "POST";
    req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
    const res = mockRes();
    await dispatch(req, res, mockCtx(ctxOverrides), TOKEN);
    return res;
  }

  // ── Auth tests ────────────────────────────────────────────

  test("GET /api/overview 无 token → 401/403", async () => {
    const req = { url: "/api/overview", method: "GET", headers: {} };
    const res = mockRes();
    await dispatch(req, res, mockCtx(), TOKEN);
    assert.ok(res.status === 401 || res.status === 403);
  });

  test("GET /api/overview 有 token → 200 + JSON", async () => {
    const res = await apiGet("/api/overview");
    assert.equal(res.status, 200);
    assert.ok(res.json);
    assert.ok(res.json.model !== undefined);
  });

  // ── Settings tests ────────────────────────────────────────

  test("GET /api/settings → 200 + editMode/preset/appliesAt", async () => {
    const res = await apiGet("/api/settings");
    assert.equal(res.status, 200);
    assert.ok(res.json.editMode !== undefined);
    assert.ok(res.json.preset !== undefined);
    assert.ok(res.json.appliesAt !== undefined);
  });

  test("POST /api/settings { editMode: 'yolo' } → 200", async () => {
    const res = await apiPost("/api/settings", { editMode: "yolo" });
    assert.equal(res.status, 200);
  });

  // ── Provider tests ────────────────────────────────────────

  test("GET /api/providers → 200 + apiKey 已脱敏", async () => {
    const res = await apiGet("/api/providers");
    assert.equal(res.status, 200);
    assert.ok(res.json.providers);
    assert.ok(res.json.providers[0].apiKey !== "sk-test-key"); // not the raw key
    assert.equal(res.json.providers[0].apiKeySet, true);
  });

  test("POST /api/providers/active { id } → 200", async () => {
    const res = await apiPost("/api/providers/active", { id: "test-provider" });
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
  });

  test("POST /api/providers/import → 200 + count", async () => {
    const res = await apiPost("/api/providers/import", {
      providers: [{
        id: "new-provider",
        name: "New",
        baseUrl: "http://localhost:9999/v1",
        apiKey: "new-key",
        models: [{ id: "new-model", presets: ["flash"], efforts: ["high"] }],
        defaultPreset: "flash",
        defaultEffort: "high",
      }],
    });
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
    assert.equal(res.json.count, 2); // existing + new
  });

  // ── Validation tests ──────────────────────────────────────

  test("POST /api/settings { contextCapTokens: 999999999 } → 400（超过 maxContextLength）", async () => {
    const res = await apiPost("/api/settings", { contextCapTokens: 999999999 });
    assert.equal(res.status, 400);
    assert.ok(res.json.error);
  });

  // ── Health + 404 ──────────────────────────────────────────

  test("GET /api/health → 200", async () => {
    const res = await apiGet("/api/health");
    assert.equal(res.status, 200);
  });

  test("未知 API 路径 → 404", async () => {
    const res = await apiGet("/api/nonexistent-endpoint");
    assert.equal(res.status, 404);
  });
});
