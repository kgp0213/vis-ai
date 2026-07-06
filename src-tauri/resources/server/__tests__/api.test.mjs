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
