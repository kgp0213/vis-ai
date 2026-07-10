import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";

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
  });

  test("未知 API 路径 → 404", async () => {
    const res = await apiGet("/api/nonexistent-endpoint");
    assert.equal(res.status, 404);
  });
});
