import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { assertApiContract } from "../../../../scripts/check-api-contracts.js";

const apiContracts = JSON.parse(readFileSync(new URL("../../../../contracts/api-responses.schema.json", import.meta.url), "utf8"));

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);

const TOKEN = "test-token-12345";

describe("HTTP API 集成测试", { concurrency: false }, () => {
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
      get headers() { return headers; },
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

  async function apiDelete(path, body, ctxOverrides = {}) {
    const json = typeof body === "string" ? body : JSON.stringify(body);
    const req = Readable.from([Buffer.from(json)]);
    req.url = path;
    req.method = "DELETE";
    req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
    const res = mockRes();
    await dispatch(req, res, mockCtx(ctxOverrides), TOKEN);
    return res;
  }

  async function apiPatch(path, body, ctxOverrides = {}) {
    const json = JSON.stringify(body);
    const req = Readable.from([Buffer.from(json)]);
    req.url = path;
    req.method = "PATCH";
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
    assert.ok(res.json.activeProviderName !== undefined);
    assert.ok(res.json.modelVerification !== undefined);
    assert.doesNotThrow(() => assertApiContract(apiContracts, "overview", res.json));
  });

  test("用户数据备份 API 支持创建、预览和冲突安全恢复", async () => {
    const calls = [];
    const userDataBackups = {
      list: () => [{ id: "backup-1", status: "ok" }],
      create: () => ({ id: "backup-2", files: [{ path: "secret-detail" }], fileCount: 1 }),
      prune: (count) => ({ maxCount: count, deletedIds: [] }),
      estimate: () => ({ estimatedBytes: 42, fileCount: 2, freeBytes: 1000, enoughSpace: true }),
      remove: (id) => ({ id, deleted: true }),
      inspect: (id) => ({ id, counts: { missing: 1, conflict: 1 } }),
      restore: (id, options) => { calls.push({ id, options }); return { id, restored: 1, skipped: 1, overwrite: options.overwrite }; },
      health: () => ({ totalBytes: 42, backups: { count: 1, corrupt: 0, latestAt: "2026-07-12T08:00:00.000Z" } }),
    };
    const overrides = {
      userDataBackups,
      configMigrationStatus: { status: "current" },
      getUserDataBackupRetentionCount: () => 10,
      setUserDataBackupRetentionCount: (value) => Number(value),
    };

    const list = await apiGet("/api/backups", overrides);
    assert.equal(list.status, 200);
    assert.doesNotThrow(() => assertApiContract(apiContracts, "backups", list.json));
    assert.equal(list.json.items[0].id, "backup-1");
    assert.equal(list.json.retentionCount, 10);

    const created = await apiPost("/api/backups", {}, overrides);
    assert.equal(created.status, 200);
    assert.equal(created.json.id, "backup-2");
    assert.equal(created.json.files, undefined);

    const estimate = await apiGet("/api/backups/estimate", overrides);
    assert.equal(estimate.json.enoughSpace, true);
    const retention = await apiPost("/api/backups/retention", { retentionCount: 5 }, overrides);
    assert.equal(retention.json.retentionCount, 5);
    const removed = await apiDelete("/api/backups/backup-1", {}, overrides);
    assert.equal(removed.json.deleted, true);

    const preview = await apiGet("/api/backups/backup-1/preview", overrides);
    assert.equal(preview.json.counts.conflict, 1);

    const safe = await apiPost("/api/backups/backup-1/restore", {}, overrides);
    assert.equal(safe.json.overwrite, false);
    const overwrite = await apiPost("/api/backups/backup-1/restore", { overwrite: true }, overrides);
    assert.equal(overwrite.json.overwrite, true);
    assert.deepEqual(calls, [
      { id: "backup-1", options: { overwrite: false } },
      { id: "backup-1", options: { overwrite: true } },
    ]);

    const health = await apiGet("/api/health", overrides);
    assert.doesNotThrow(() => assertApiContract(apiContracts, "health", health.json));
    assert.equal(health.json.storage.totalBytes, 42);
    assert.equal(health.json.storage.configStatus, "current");
    assert.deepEqual(health.json.storageIssues, []);

    const unhealthy = await apiGet("/api/health", { ...overrides, getPersistentStorageIssues: () => [{ key: "prompt-queue", level: "error", error: "invalid JSON" }] });
    assert.equal(unhealthy.json.storageIssues[0].key, "prompt-queue");
  });

  test("备份 API 对无服务、未知路径和无效 JSON 返回明确错误", async () => {
    const unavailable = await apiGet("/api/backups");
    assert.equal(unavailable.status, 503);
    const userDataBackups = { list: () => [], create: () => ({}), prune: () => ({ deletedIds: [] }), estimate: () => ({}), remove: () => ({ deleted: false }), inspect: () => ({}), restore: () => ({}) };
    const unknown = await apiGet("/api/backups/backup-1/unknown", { userDataBackups });
    assert.equal(unknown.status, 404);
    const invalid = await apiPost("/api/backups/backup-1/restore", "{", { userDataBackups });
    assert.equal(invalid.status, 400);
  });

  test("KaTeX 脚本和样式受保护，字体可由 CSS 直接加载", async () => {
    const deniedReq = { url: "/assets/vendor/katex/katex.min.js", method: "GET", headers: {} };
    const deniedRes = mockRes();
    await dispatch(deniedReq, deniedRes, mockCtx(), TOKEN);
    assert.equal(deniedRes.status, 401);

    const script = await apiGet("/assets/vendor/katex/katex.min.js");
    assert.equal(script.status, 200);
    assert.match(script.headers["content-type"], /javascript/);

    assert.match((await apiGet("/assets/backup-support.js")).body, /VisionoxBackupPolicy/);

    const css = await apiGet("/assets/vendor/katex/katex.min.css");
    assert.equal(css.status, 200);
    assert.equal(css.headers["content-type"], "text/css; charset=utf-8");

    const fontReq = { url: "/assets/vendor/katex/fonts/KaTeX_Main-Regular.woff2", method: "GET", headers: {} };
    const fontRes = mockRes();
    await dispatch(fontReq, fontRes, mockCtx(), TOKEN);
    assert.equal(fontRes.status, 200);
    assert.equal(fontRes.headers["content-type"], "font/woff2");
  });

  test("长期记忆 API 拒绝静默覆盖，并允许显式更新", async () => {
    const memoryHomeDir = join(tmpDir, "memory-home");
    const body = [
      "---",
      "name: report-style",
      "description: Preferred report style",
      "type: user",
      "scope: global",
      "created: 2026-07-11",
      "---",
      "",
      "Use short sections.",
      "",
    ].join("\n");
    const overrides = { memoryHomeDir };

    const created = await apiPost("/api/memory/global/report-style", { body }, overrides);
    assert.equal(created.status, 200);
    assert.equal(created.json.created, true);

    const duplicate = await apiPost("/api/memory/global/report-style", { body: body.replace("short", "brief") }, overrides);
    assert.equal(duplicate.status, 409);
    assert.match(duplicate.json.error, /already exists/i);

    const updated = await apiPost("/api/memory/global/report-style", {
      body: body.replace("short", "brief"),
      overwrite: true,
    }, overrides);
    assert.equal(updated.status, 200);
    assert.equal(updated.json.updated, true);

    const read = await apiGet("/api/memory/global/report-style", overrides);
    assert.equal(read.status, 200);
    assert.match(read.json.body, /Use brief sections/);
    assert.equal(read.json.entry.description, "Preferred report style");
    assert.ok(read.json.revision);

    const stale = await apiPost("/api/memory/global/report-style", {
      body: body.replace("short", "stale"),
      overwrite: true,
      expectedRevision: "stale-revision",
    }, overrides);
    assert.equal(stale.status, 409);

    const tree = await apiGet("/api/memory", {
      ...overrides,
      getSessionMemories: () => [{ name: "temporary-choice", description: "Use option B", body: "Use option B", ts: 1 }],
    });
    assert.equal(tree.status, 200);
    assert.equal(tree.json.global.files[0].description, "Preferred report style");
    assert.equal(tree.json.global.files[0].priority, "medium");
    assert.match(tree.json.global.files[0].searchText, /Use brief sections/);
    assert.equal(tree.json.session.items[0].name, "temporary-choice");

    const duplicateBody = body.replace("name: report-style", "name: report-copy").replace("short", "brief");
    const copy = await apiPost("/api/memory/global/report-copy", { body: duplicateBody }, overrides);
    assert.equal(copy.status, 200);
    const diagnosed = await apiGet("/api/memory", overrides);
    assert.deepEqual(diagnosed.json.diagnostics.duplicates, [["global:report-copy", "global:report-style"]]);
    assert.equal(diagnosed.json.project.id.length, 16);

    const removed = await apiDelete("/api/memory/global/report-copy", {}, overrides);
    assert.equal(removed.status, 200);
    assert.ok(removed.json.trashId);
    const trash = await apiGet("/api/memory/trash", overrides);
    assert.equal(trash.json.items.length, 1);
    const restored = await apiPost(`/api/memory/trash/${removed.json.trashId}/restore`, {}, overrides);
    assert.equal(restored.status, 200);
    assert.equal((await apiGet("/api/memory/global/report-copy", overrides)).status, 200);
  });

  test("Soul API 在用户数据目录中完整读取和保存", async () => {
    const memoryHomeDir = join(tmpDir, "soul-home");
    const soulBody = "# Identity\n\nAlways answer clearly.\n";
    const saved = await apiPost("/api/memory/soul", { body: soulBody, aiName: "Whale" }, { memoryHomeDir });
    assert.equal(saved.status, 200);
    const read = await apiGet("/api/memory/soul", { memoryHomeDir });
    assert.equal(read.status, 200);
    assert.equal(read.json.name, "Whale");
    assert.match(read.json.body, /Always answer clearly/);
    assert.equal(read.json.atomic, true);
    assert.doesNotMatch(read.json.body, /visionox:soul:name/);
    assert.ok(read.json.revision);

    const preview = await apiPost("/api/memory/soul/preview", { body: "# Identity\r\n\r\nBe direct.\r\n", aiName: "Whale" }, { memoryHomeDir });
    assert.equal(preview.status, 200);
    assert.equal(preview.json.valid, true);
    assert.equal((preview.json.finalBody.match(/visionox:soul:name:start/g) ?? []).length, 1);

    const updated = await apiPost("/api/memory/soul", { body: "# Identity\n\nBe precise.\n", aiName: "Blue", expectedRevision: read.json.revision }, { memoryHomeDir });
    assert.equal(updated.status, 200);
    const history = await apiGet("/api/memory/soul/history", { memoryHomeDir });
    assert.equal(history.status, 200);
    assert.equal(history.json.items.length, 1);

    const restored = await apiPost(`/api/memory/soul/history/${history.json.items[0].id}/restore`, {}, { memoryHomeDir });
    assert.equal(restored.status, 200);
    assert.match(readFileSync(join(memoryHomeDir, "soul.md"), "utf8"), /Always answer clearly/);
  });

  test("记忆应用接口区分忙碌状态，场景接口拒绝截断并保留 enabled", async () => {
    const busy = await apiPost("/api/memory/apply", {}, { isBusy: () => true, applyMemoryChanges: () => ({ applied: true }) });
    assert.equal(busy.status, 409);
    const applied = await apiPost("/api/memory/apply", {}, { isBusy: () => false, applyMemoryChanges: () => ({ applied: true, messageCount: 3 }) });
    assert.equal(applied.status, 200);
    assert.equal(applied.json.applied, true);

    let added;
    const ctx = {
      getModes: () => ({ current: "general", list: [{ id: "general" }, { id: "coding" }] }),
      addModeMemory: (input, mode) => { added = { input, mode }; return { item: { id: "one" }, memory: { items: [] } }; },
      moveModeMemory: (id, input) => ({ id, ...input }),
      batchModeMemory: (input) => ({ changed: input.items.length }),
    };
    const tooLong = await apiPost("/api/mode-memory", { mode: "general", text: "x".repeat(181) }, ctx);
    assert.equal(tooLong.status, 400);
    const add = await apiPost("/api/mode-memory", { mode: "general", text: "keep disabled", enabled: false }, ctx);
    assert.equal(add.status, 200);
    assert.equal(added.input.enabled, false);
    const moved = await apiPost("/api/mode-memory/one/move", { mode: "general", targetMode: "coding", copy: false }, ctx);
    assert.equal(moved.status, 200);
    const batch = await apiPost("/api/mode-memory/batch", { action: "disable", items: [{ mode: "general", id: "one" }] }, ctx);
    assert.equal(batch.status, 200);
  });

  test("GET /api/events 只推送请求的共享 SSE 频道", async () => {
    const req = new EventEmitter();
    req.url = "/api/events?channels=events";
    req.method = "GET";
    req.headers = { "x-reasonix-token": TOKEN };

    const res = new EventEmitter();
    const chunks = [];
    res.writableEnded = false;
    res.writeHead = (status, headers) => {
      res.status = status;
      res.headers = headers;
    };
    res.write = (chunk) => {
      chunks.push(String(chunk));
      return true;
    };
    res.end = () => {
      res.writableEnded = true;
    };

    let subscriber;
    let unsubscribed = false;
    await dispatch(req, res, mockCtx({
      isBusy: () => true,
      subscribeEvents(callback) {
        subscriber = callback;
        return () => { unsubscribed = true; };
      },
    }), TOKEN);
    subscriber({ kind: "sessions-changed" });
    req.emit("close");

    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "text/event-stream");
    assert.match(chunks.join(""), /"kind":"busy-change"/);
    assert.match(chunks.join(""), /"kind":"sessions-changed"/);
    assert.doesNotMatch(chunks.join(""), /"kind":"overview"|"kind":"health"|"kind":"logs"/);
    assert.equal(unsubscribed, true);
  });

  test("GET /api/messages 对千条活动会话默认只返回最近一页", async () => {
    const messages = Array.from({ length: 1094 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      text: `content-${index}`,
    }));
    const latest = await apiGet("/api/messages", { getMessages: () => messages });
    assert.equal(latest.status, 200);
    assert.equal(latest.json.messages.length, 200);
    assert.equal(latest.json.messages[0].id, "message-894");
    assert.equal(latest.json.messages.at(-1).id, "message-1093");
    assert.equal(latest.json.totalMessages, 1094);
    assert.equal(latest.json.hasMore, true);

    const earlier = await apiGet("/api/messages?limit=200&offset=200", { getMessages: () => messages });
    assert.equal(earlier.status, 200);
    assert.equal(earlier.json.messages[0].id, "message-694");
    assert.equal(earlier.json.messages.at(-1).id, "message-893");
    assert.equal(earlier.json.hasMore, true);
  });

  test("POST /api/modal/resolve 要求有效 gateId 并拒绝过期卡片", async () => {
    const missing = await apiPost("/api/modal/resolve", {
      kind: "shell",
      choice: "run_once",
    }, {
      resolveShellConfirm: () => true,
    });
    assert.equal(missing.status, 400);

    const stale = await apiPost("/api/modal/resolve", {
      kind: "shell",
      choice: "run_once",
      gateId: 7,
    }, {
      resolveShellConfirm: () => false,
    });
    assert.equal(stale.status, 409);
  });

  test("POST /api/modal/resolve 将 gateId 传给解析器", async () => {
    let received = null;
    const res = await apiPost("/api/modal/resolve", {
      kind: "choice",
      choice: { kind: "pick", optionId: "A" },
      gateId: 12,
    }, {
      resolveChoiceConfirm: (choice, gateId) => {
        received = { choice, gateId };
        return true;
      },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(received, {
      choice: { kind: "pick", optionId: "A" },
      gateId: 12,
    });
  });

  test("非 pauseGate 弹窗保持原协议，不要求 gateId", async () => {
    let choice = null;
    const res = await apiPost("/api/modal/resolve", {
      kind: "edit-review",
      choice: "apply",
    }, {
      resolveEditReview: (value) => { choice = value; },
    });
    assert.equal(res.status, 200);
    assert.equal(choice, "apply");
  });

  test("计划取消和检查点停止在 gate 解析成功后终止任务", async () => {
    const events = [];
    const plan = await apiPost("/api/modal/resolve", {
      kind: "plan",
      choice: "cancel",
      gateId: 20,
    }, {
      resolvePlanConfirm: (_choice, _text, gateId) => {
        events.push(`resolve-plan-${gateId}`);
        return true;
      },
      abortTurn: () => events.push("abort-plan"),
    });
    assert.equal(plan.status, 200);
    assert.deepEqual(events, ["resolve-plan-20", "abort-plan"]);

    events.length = 0;
    const checkpoint = await apiPost("/api/modal/resolve", {
      kind: "checkpoint",
      choice: "stop",
      gateId: 21,
    }, {
      resolveCheckpointConfirm: (_choice, _text, gateId) => {
        events.push(`resolve-checkpoint-${gateId}`);
        return true;
      },
      abortTurn: () => events.push("abort-checkpoint"),
    });
    assert.equal(checkpoint.status, 200);
    assert.deepEqual(events, ["resolve-checkpoint-21", "abort-checkpoint"]);
  });

  // ── Settings tests ────────────────────────────────────────

  test("GET /api/settings → 200 + editMode/preset/appliesAt", async () => {
    const res = await apiGet("/api/settings");
    assert.equal(res.status, 200);
    assert.ok(res.json.editMode !== undefined);
    assert.ok(res.json.preset !== undefined);
    assert.ok(res.json.appliesAt !== undefined);
  });

  test("设置页凭据读取以当前 Provider 为准且禁止绕过检测保存", async () => {
    const before = JSON.parse(readFileSync(configPath, "utf8"));
    writeConfig({
      ...before,
      apiKey: "legacy-key-should-not-be-used",
      baseUrl: "https://legacy.invalid/v1",
      providers: [
        ...before.providers,
        {
          id: "other-provider",
          name: "Other",
          baseUrl: "https://other.test/v1",
          apiKey: "other-provider-key",
          models: [{ id: "other-model", presets: ["flash"], efforts: ["high"], maxContextLength: 32768 }],
          defaultPreset: "flash",
          defaultEffort: "high",
        },
      ],
    });

    const verified = await apiPost("/api/providers/test", {}, {
      testProviderModel: async () => {},
      syncProvider: async () => {},
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.json.passed, 2);

    const rejected = await apiPost("/api/settings", { apiKey: "too-short" });
    assert.equal(rejected.status, 400);
    const preserved = await apiGet("/api/providers");
    assert.equal(preserved.json.modelVerification.dirty, false);
    assert.equal(preserved.json.providers.flatMap((provider) => provider.models).every((model) => model.testStatus === "passed"), true);

    const initial = await apiGet("/api/settings");
    assert.equal(initial.status, 200);
    assert.equal(initial.json.baseUrl, "http://localhost:11434/v1");
    assert.equal(initial.json.credentialTarget.id, "test-provider");

    const rejectedBypass = await apiPost("/api/settings", {
      apiKey: "sk-updated-provider-key",
      baseUrl: "http://localhost:12434/v1",
    });
    assert.equal(rejectedBypass.status, 400);
    const unchanged = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(unchanged.providers.find((provider) => provider.id === "test-provider").apiKey, "sk-test-key");

    writeConfig(before);
  });

  test("POST /api/settings { editMode: 'yolo' } → 200", async () => {
    const res = await apiPost("/api/settings", { editMode: "yolo" });
    assert.equal(res.status, 200);
  });

  test("POST /api/settings 返回模型切换的上下文保留状态", async () => {
    const expected = {
      previousModel: "test-flash",
      model: "test-pro",
      messageCount: 12,
      deferred: true,
    };
    const res = await apiPost("/api/settings", { preset: "auto" }, {
      applyPresetLive: () => expected,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.modelSwitch, expected);
  });

  // ── Provider tests ────────────────────────────────────────

  test("GET /api/providers → 200 + apiKey 已脱敏", async () => {
    const res = await apiGet("/api/providers");
    assert.equal(res.status, 200);
    assert.doesNotThrow(() => assertApiContract(apiContracts, "providers", res.json));
    assert.ok(res.json.providers);
    assert.ok(res.json.providers[0].apiKey !== "sk-test-key"); // not the raw key
    assert.equal(res.json.providers[0].apiKeySet, true);
  });

  test("POST /api/providers/active { id } → 200", async () => {
    const res = await apiPost("/api/providers/active", { id: "test-provider" });
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
  });

  test("回答进行中拒绝更换模型服务，避免中途替换客户端", async () => {
    writeConfig({
      preset: "auto",
      providers: [
        { id: "provider-a", name: "A", baseUrl: "http://localhost:11434/v1", apiKey: "a", models: [{ id: "model-a", presets: ["auto"], efforts: ["max"], maxContextLength: 32768 }] },
        { id: "provider-b", name: "B", baseUrl: "http://localhost:11435/v1", apiKey: "b", models: [{ id: "model-b", presets: ["auto"], efforts: ["max"], maxContextLength: 32768 }] },
      ],
      activeProviderId: "provider-a",
    });
    let switched = false;
    const res = await apiPost("/api/providers/active", { id: "provider-b" }, {
      isBusy: () => true,
      syncProvider: async () => { switched = true; },
    });
    assert.equal(res.status, 409);
    assert.equal(switched, false);
    assert.match(res.json.error, /当前回答结束/);
    writeConfig({
      editMode: "yolo",
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

  test("POST /api/providers/import → 200 + count", async () => {
    const res = await apiPost("/api/providers/import", {
      providers: [{
        id: "new-provider",
        name: "New",
        baseUrl: "http://localhost:9999/v1",
        apiKey: "new-key",
        models: [{ id: "new-model", presets: ["flash"], efforts: ["high"], maxContextLength: 131072 }],
        defaultPreset: "flash",
        defaultEffort: "high",
      }],
    });
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
    assert.equal(res.json.requiresModelTest, true);
    assert.ok(res.json.count >= 2); // defaults/existing providers + new
  });

  test("重复导入同名模型时用新 JSON 容量完整覆盖并刷新运行时", async () => {
    let refreshed = 0;
    const res = await apiPost("/api/providers/import", {
      providers: [{
        id: "new-provider",
        name: "New updated",
        models: [{ id: "new-model", presets: ["flash"], efforts: ["high"], maxContextLength: 81920 }],
      }],
    }, {
      refreshContextCap: () => {
        refreshed += 1;
        return { contextPolicy: { model: "new-model", effectiveCap: 81920, capacitySource: "json" } };
      },
    });
    assert.equal(res.status, 200);
    assert.equal(refreshed, 1);
    assert.equal(res.json.contextPolicy.effectiveCap, 81920);
    const providers = await apiGet("/api/providers");
    const updated = providers.json.providers.find((provider) => provider.id === "new-provider");
    assert.equal(updated.models[0].maxContextLength, 81920);
  });

  test("Provider JSON 缺少模型真实容量时拒绝导入", async () => {
    const res = await apiPost("/api/providers/import", {
      providers: [{ id: "invalid-provider", models: [{ id: "unknown-capacity" }] }],
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /maxContextLength/);
  });

  test("已存在 Provider 可只更新非模型字段并保留容量配置", async () => {
    const res = await apiPost("/api/providers/import", {
      providers: [{ id: "new-provider", name: "Renamed provider" }],
    });
    assert.equal(res.status, 200);
    const providers = await apiGet("/api/providers");
    const updated = providers.json.providers.find((provider) => provider.id === "new-provider");
    assert.equal(updated.name, "Renamed provider");
    assert.equal(updated.models[0].maxContextLength, 81920);
  });

  // ── Plans tests ───────────────────────────────────────────

  test("GET /api/plans 返回当前计划，POST /api/plans/active/step 可手动完成步骤", async () => {
    const activePlan = {
      session: "desktop",
      status: "active",
      path: null,
      completedAt: "2026-07-06T00:00:00.000Z",
      updatedAt: "2026-07-06T00:00:00.000Z",
      totalSteps: 2,
      completedSteps: 0,
      completionRatio: 0,
      steps: [
        { id: "s1", title: "Inspect", action: "Read the current implementation" },
        { id: "s2", title: "Patch", action: "Apply the improvement" },
      ],
      completedStepIds: [],
      body: "## Plan\n\nDo the work.",
      summary: "Improve plans panel",
    };
    let completedStepId = null;
    const ctx = {
      getActivePlan: () => activePlan,
      completeActivePlanStep: (stepId) => {
        completedStepId = stepId;
        return { ok: true, plan: { ...activePlan, completedSteps: 1, completedStepIds: [stepId] } };
      },
      cancelActivePlan: () => ({ ok: true }),
    };

    const list = await apiGet("/api/plans", ctx);
    assert.equal(list.status, 200);
    assert.equal(list.json.plans[0].status, "active");
    assert.equal(list.json.plans[0].body, activePlan.body);

    const complete = await apiPost("/api/plans/active/step", { stepId: "s1" }, ctx);
    assert.equal(complete.status, 200);
    assert.equal(completedStepId, "s1");

    const cancel = await apiDelete("/api/plans", { active: true }, ctx);
    assert.equal(cancel.status, 200);
    assert.equal(cancel.json.cancelled, true);
  });

  // ── Scheduled tasks tests ───────────────────────────────────

  test("POST /api/abort 返回活动操作状态", async () => {
    let called = 0;
    const operation = { id: "op-1", kind: "chat", state: "stopping" };
    const res = await apiPost("/api/abort", {}, {
      abortTurn: async () => {
        called += 1;
        return { accepted: true, operation };
      },
    });
    assert.equal(res.status, 202);
    assert.equal(res.json.aborted, true);
    assert.deepEqual(res.json.operation, operation);
    assert.equal(called, 1);
  });

  test("后台任务 API 支持列表和单独停止", async () => {
    const jobs = [{ id: 3, command: "node server.js", running: true, lifecycle: "service" }];
    let stoppedId = null;
    const ctx = {
      listBackgroundJobs: () => jobs,
      stopBackgroundJob: async (id) => {
        stoppedId = id;
        return { ...jobs[0], running: false, exitCode: 0 };
      },
    };
    const listed = await apiGet("/api/background-jobs", ctx);
    assert.equal(listed.status, 200);
    assert.equal(listed.json.jobs[0].lifecycle, "service");

    const stopped = await apiDelete("/api/background-jobs/3", {}, ctx);
    assert.equal(stopped.status, 200);
    assert.equal(stopped.json.stopped, true);
    assert.equal(stoppedId, 3);
  });

  test("定时任务 API 支持取消正在运行的任务", async () => {
    let cancelledId = null;
    const res = await apiPost("/api/schedules/task-running/cancel", {}, {
      cancelScheduleRun: (id) => {
        cancelledId = id;
        return { ok: true, cancelled: true, schedule: { id, lastStatus: "cancelled" } };
      },
    });
    assert.equal(res.status, 202);
    assert.equal(res.json.cancelled, true);
    assert.equal(cancelledId, "task-running");
  });

  test("POST/GET/DELETE /api/schedules 管理定时任务", async () => {
    const schedules = [];
    let runId = null;
    const ctx = {
      listSchedules: () => schedules,
      createSchedule: (input) => {
        const schedule = {
          id: `task-${schedules.length + 1}`,
          kind: input.kind || "prompt",
          name: input.name,
          prompt: input.prompt,
          reportRangeMode: input.reportRangeMode,
          reportPeriod: input.reportPeriod,
          reportDate: input.reportDate,
          reportStartDate: input.reportStartDate,
          reportEndDate: input.reportEndDate,
          reportExport: input.reportExport,
          enabled: true,
          type: input.type || "interval",
          intervalMs: input.intervalMs,
          timeOfDay: input.timeOfDay,
          dayOfWeek: input.dayOfWeek,
          runMode: input.runMode,
          weekdaysOnly: input.weekdaysOnly,
          windowEnabled: input.windowEnabled,
          windowStart: input.windowStart,
          windowEnd: input.windowEnd,
          history: [],
        };
        schedules.push(schedule);
        return { ok: true, schedule };
      },
      updateSchedule: (id, patch) => {
        const idx = schedules.findIndex((s) => s.id === id);
        if (idx < 0) return { ok: false, error: "schedule not found" };
        schedules[idx] = { ...schedules[idx], ...patch };
        return { ok: true, schedule: schedules[idx] };
      },
      setScheduleEnabled: (id, enabled) => {
        const schedule = schedules.find((s) => s.id === id);
        if (!schedule) return { ok: false, error: "schedule not found" };
        schedule.enabled = enabled;
        return { ok: true, schedule };
      },
      runScheduleNow: async (id) => {
        runId = id;
        if (id === "task-1" && schedules[0]?.forceReject) {
          schedules[0].history.unshift({
            runId: "run-rejected",
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: 12,
            status: "skipped",
            manual: true,
            accepted: false,
            reason: "workspace mismatch",
            summary: "workspace mismatch",
          });
          return { ok: true, accepted: false, reason: "workspace mismatch", runId: "run-rejected", schedule: schedules[0] };
        }
        const schedule = schedules.find((s) => s.id === id);
        schedule.history.unshift({
          runId: "run-ok",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 34,
          status: "completed",
          manual: true,
          accepted: true,
          summary: "All checks passed",
          lastPromptTokens: 1234,
          lastTurnCostUsd: 0.000456,
        });
        return { ok: true, accepted: true, runId: "run-ok", schedule };
      },
      deleteSchedule: (id) => {
        const idx = schedules.findIndex((s) => s.id === id);
        if (idx < 0) return { ok: false, error: "schedule not found" };
        if (schedules[idx].lastStatus === "running") return { ok: false, error: "task is currently running" };
        schedules.splice(idx, 1);
        return { ok: true };
      },
    };

    const created = await apiPost("/api/schedules", {
      name: "Daily check",
      prompt: "Summarize status",
      intervalMs: 60000,
      runMode: "readonly",
      weekdaysOnly: true,
      windowEnabled: true,
      windowStart: "09:00",
      windowEnd: "18:00",
    }, ctx);
    assert.equal(created.status, 201);
    assert.equal(created.json.schedule.id, "task-1");
    assert.equal(created.json.schedule.runMode, "readonly");
    assert.equal(created.json.schedule.weekdaysOnly, true);
    assert.equal(created.json.schedule.windowEnabled, true);

    const list = await apiGet("/api/schedules", ctx);
    assert.equal(list.status, 200);
    assert.doesNotThrow(() => assertApiContract(apiContracts, "schedules", list.json));
    assert.equal(list.json.schedules.length, 1);

    const weekly = await apiPost("/api/schedules", {
      name: "Weekly report",
      prompt: "Summarize weekly status",
      type: "weekly",
      timeOfDay: "10:30",
      dayOfWeek: 5,
      runMode: "auto",
    }, ctx);
    assert.equal(weekly.status, 201);
    assert.equal(weekly.json.schedule.id, "task-2");
    assert.equal(weekly.json.schedule.type, "weekly");
    assert.equal(weekly.json.schedule.timeOfDay, "10:30");
    assert.equal(weekly.json.schedule.dayOfWeek, 5);

    const reportTask = await apiPost("/api/schedules", {
      kind: "report",
      name: "Weekly conversation report",
      type: "daily",
      timeOfDay: "08:30",
      reportRangeMode: "last_week",
      reportExport: true,
    }, ctx);
    assert.equal(reportTask.status, 201);
    assert.equal(reportTask.json.schedule.id, "task-3");
    assert.equal(reportTask.json.schedule.kind, "report");
    assert.equal(reportTask.json.schedule.reportRangeMode, "last_week");
    assert.equal(reportTask.json.schedule.reportExport, true);

    const toggled = await apiPost("/api/schedules/task-1/toggle", { enabled: false }, ctx);
    assert.equal(toggled.status, 200);
    assert.equal(toggled.json.schedule.enabled, false);

    const run = await apiPost("/api/schedules/task-1/run", {}, ctx);
    assert.equal(run.status, 202);
    assert.equal(runId, "task-1");
    assert.equal(run.json.runId, "run-ok");
    assert.equal(run.json.schedule.history[0].status, "completed");
    assert.equal(run.json.schedule.history[0].summary, "All checks passed");
    assert.equal(run.json.schedule.history[0].lastPromptTokens, 1234);

    schedules[0].forceReject = true;
    const rejected = await apiPost("/api/schedules/task-1/run", {}, ctx);
    assert.equal(rejected.status, 409);
    assert.equal(rejected.json.error, "workspace mismatch");
    assert.equal(rejected.json.runId, "run-rejected");
    assert.equal(rejected.json.schedule.history[0].status, "skipped");

    schedules[2].lastStatus = "running";
    const deleteRunning = await apiDelete("/api/schedules/task-3", {}, ctx);
    assert.equal(deleteRunning.status, 400);
    assert.equal(deleteRunning.json.error, "task is currently running");
    schedules[2].lastStatus = "completed";

    const deleted = await apiDelete("/api/schedules/task-1", {}, ctx);
    assert.equal(deleted.status, 200);
    assert.equal(schedules.length, 2);

    const deletedWeekly = await apiDelete("/api/schedules/task-2", {}, ctx);
    assert.equal(deletedWeekly.status, 200);
    assert.equal(schedules.length, 1);

    const deletedReport = await apiDelete("/api/schedules/task-3", {}, ctx);
    assert.equal(deletedReport.status, 200);
    assert.equal(schedules.length, 0);
  });

  // ── Validation tests ──────────────────────────────────────

  test("POST /api/settings { contextCapTokens: 999999999 } → 400（超过 maxContextLength）", async () => {
    writeConfig({
      preset: "auto",
      model: "test-flash",
      providers: [{
        id: "test-provider",
        models: [{ id: "test-flash", presets: ["auto"], efforts: ["max"], maxContextLength: 131072 }],
      }],
      activeProviderId: "test-provider",
    });
    const res = await apiPost("/api/settings", { contextCapTokens: 999999999 });
    assert.equal(res.status, 400);
    assert.ok(res.json.error);
  });

  // ── Health + 404 ──────────────────────────────────────────

  test("GET /api/health → 200", async () => {
    const res = await apiGet("/api/health");
    assert.equal(res.status, 200);
    assert.match(res.json.semantic.path, /semantic[\\/]projects[\\/][a-f0-9]{64}$/);
  });

  test("一次检测覆盖所有服务商，限制双并发且只激活当前服务商的通过模型", async () => {
    writeConfig({
      preset: "auto",
      reasoningEffort: "high",
      activeProviderId: "checked-provider",
      providers: [{
        id: "checked-provider",
        name: "Checked",
        baseUrl: "https://models.test/v1",
        apiKey: "checked-key",
        models: [
          { id: "model-pass", name: "Flash", presets: ["auto", "flash"], efforts: ["high"], maxContextLength: 32768 },
          { id: "model-fail", name: "Pro", presets: ["pro"], efforts: ["high"], maxContextLength: 32768 },
        ],
        defaultPreset: "auto",
        defaultEffort: "high",
      }, {
        id: "other-provider",
        name: "Other",
        baseUrl: "https://other.test/v1",
        apiKey: "other-key",
        models: [{ id: "other-model", name: "Other Model", presets: ["flash"], efforts: ["high"], maxContextLength: 32768 }],
        defaultPreset: "flash",
        defaultEffort: "high",
      }],
    });

    let activatedProvider = null;
    let activeTests = 0;
    let peakTests = 0;
    const tested = await apiPost("/api/providers/test", {}, {
      testProviderModel: async (_provider, model) => {
        activeTests += 1;
        peakTests = Math.max(peakTests, activeTests);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeTests -= 1;
        if (model.id === "model-fail") throw new Error("model unavailable");
      },
      syncProvider: async (id) => { activatedProvider = id; return { model: "model-pass", messageCount: 3 }; },
    });
    assert.equal(tested.status, 200);
    assert.equal(tested.json.passed, 2);
    assert.equal(tested.json.total, 3);
    assert.equal(peakTests, 2);
    assert.deepEqual(tested.json.results.map((item) => [item.modelId, item.ok]), [["model-pass", true], ["model-fail", false], ["other-model", true]]);
    assert.equal(activatedProvider, "checked-provider");
    assert.deepEqual(tested.json.activated, { providerId: "checked-provider", modelId: "model-pass", preset: "flash" });

    const listed = await apiGet("/api/providers");
    assert.equal(listed.json.modelVerification.dirty, false);
    const checked = listed.json.providers.find((provider) => provider.id === "checked-provider");
    assert.deepEqual(checked.modelTest, { passed: 1, failed: 1, tested: 2, total: 2 });
    assert.equal(checked.models[0].testStatus, "passed");
    assert.equal(checked.models[1].testStatus, "failed");
    const other = listed.json.providers.find((provider) => provider.id === "other-provider");
    assert.equal(other.models[0].testStatus, "passed");
    const cfg = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(cfg.activeProviderId, "checked-provider");
    assert.equal(cfg.preset, "flash");
    assert.equal("selectedModelId" in cfg.providers.find((provider) => provider.id === "checked-provider"), false);

    const reimported = await apiPost("/api/providers/import", {
      providers: [{ id: "checked-provider", name: "Checked updated" }],
    });
    assert.equal(reimported.status, 200);
    assert.equal(reimported.json.requiresModelTest, true);
    const invalidated = await apiGet("/api/providers");
    assert.equal(invalidated.json.modelVerification.dirty, true);
    assert.equal(invalidated.json.providers.flatMap((provider) => provider.models).every((model) => model.testStatus === "untested"), true);
  });

  test("内部单模型服务商检测后保持唯一 preset，不生成外部 DeepSeek 模式", async () => {
    writeConfig({
      preset: "auto",
      reasoningEffort: "max",
      activeProviderId: "internal-provider",
      providers: [{
        id: "internal-provider",
        name: "Internal",
        baseUrl: "http://intranet.test/v1",
        apiKey: "internal-key",
        models: [{ id: "internal-model", name: "Internal Model", presets: ["flash"], efforts: ["high"], maxContextLength: 81920 }],
        defaultPreset: "flash",
        defaultEffort: "high",
      }],
    });
    const tested = await apiPost("/api/providers/test", {}, {
      testProviderModel: async () => {},
      syncProvider: async () => ({ model: "internal-model", messageCount: 2 }),
    });
    assert.equal(tested.status, 200);
    assert.deepEqual(tested.json.activated, { providerId: "internal-provider", modelId: "internal-model", preset: "flash" });
    const overview = await apiGet("/api/overview");
    assert.deepEqual(overview.json.providerCapabilities.presets, ["flash"]);
  });

  test("索引召回模式 API 读取并更新当前会话模式", async () => {
    const get = await apiGet("/api/index-retrieval-mode", {
      getIndexRetrievalMode: () => ({ mode: "auto", semanticAvailable: true }),
    });
    assert.equal(get.status, 200);
    assert.deepEqual(get.json, { mode: "auto", semanticAvailable: true });

    let applied = null;
    const post = await apiPost("/api/index-retrieval-mode", { mode: "off" }, {
      setIndexRetrievalMode: (mode) => {
        applied = mode;
        return { ok: true, mode, semanticAvailable: true };
      },
    });
    assert.equal(post.status, 200);
    assert.equal(applied, "off");
    assert.equal(post.json.mode, "off");

    const rejected = await apiPost("/api/index-retrieval-mode", { mode: "invalid" }, {
      setIndexRetrievalMode: () => ({ ok: false, error: "mode must be auto, tool, or off" }),
    });
    assert.equal(rejected.status, 409);
    assert.match(rejected.json.error, /auto, tool, or off/);
  });

  test("未知 API 路径 → 404", async () => {
    const res = await apiGet("/api/nonexistent-endpoint");
    assert.equal(res.status, 404);
  });
});
