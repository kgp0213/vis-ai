import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";

const tmpRoot = mkdtempSync(join(tmpdir(), "visionox-dashboard-regression-"));
const tmpHome = join(tmpRoot, "home");
const tmpWorkspace = join(tmpRoot, "workspace");
mkdirSync(tmpHome, { recursive: true });
mkdirSync(tmpWorkspace, { recursive: true });

process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const sessionUrl = new URL("../visionox-pkg/dist/cli/chunk-6PBZN4VI.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const { sessionPath } = await import(sessionUrl.href);

const TOKEN = "dashboard-regression-token";

describe("Dashboard 回归护栏", () => {
  let configPath;

  before(() => {
    configPath = join(tmpRoot, "config.json");
    writeFileSync(configPath, JSON.stringify({
      editMode: "admin",
      preset: "auto",
      reasoningEffort: "max",
      providers: [],
    }, null, 2));
  });

  after(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

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
      getCurrentCwd: () => tmpWorkspace,
      loop: { model: "test-model" },
      syncProvider: async () => {},
      refreshContextCap: () => {},
      usageLogPath: join(tmpRoot, "usage.log"),
      getGeneratedArtifactPaths: () => [],
      ...overrides,
    };
  }

  async function api(method, path, body = null, ctxOverrides = {}) {
    const req = body === null || body === undefined
      ? { url: path, method, headers: { "x-reasonix-token": TOKEN } }
      : Readable.from([Buffer.from(JSON.stringify(body))]);
    req.url = path;
    req.method = method;
    req.headers = {
      "x-reasonix-token": TOKEN,
      ...(body === null || body === undefined ? {} : { "content-type": "application/json" }),
    };
    const res = mockRes();
    await dispatch(req, res, mockCtx(ctxOverrides), TOKEN);
    return res;
  }

  test("会话重命名后仍可按新名称加载并继续会话", async () => {
    const oldName = "rename-source";
    const newName = "rename-target";
    const oldPath = sessionPath(oldName);
    mkdirSync(dirname(oldPath), { recursive: true });
    writeFileSync(oldPath, [
      JSON.stringify({ role: "user", content: "hello" }),
      JSON.stringify({ role: "assistant", content: "world" }),
      "",
    ].join("\n"), "utf8");

    const renamed = await api("POST", `/api/sessions/${encodeURIComponent(oldName)}/rename`, { newName });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.json.newName, newName);
    assert.equal(existsSync(sessionPath(oldName)), false);
    assert.equal(existsSync(sessionPath(newName)), true);

    const detail = await api("GET", `/api/sessions/${encodeURIComponent(newName)}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.json.name, newName);
    assert.equal(detail.json.messages.length, 2);

    let submitted = null;
    const resumed = await api("POST", "/api/submit", { prompt: "", session: newName }, {
      submitPrompt: async (prompt, session, images) => {
        submitted = { prompt, session, images };
        return { accepted: true, session, turnId: "resume-test" };
      },
    });
    assert.equal(resumed.status, 202);
    assert.equal(resumed.json.accepted, true);
    assert.deepEqual(submitted, { prompt: "", session: newName, images: null });
  });

  test("任务运行接口返回最新运行结果，供任务详情刷新展示", async () => {
    const reportPath = join(tmpRoot, "Downloads", "weekly-report.md");
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, "# Weekly\n\nDone.\n", "utf8");
    const schedules = [{
      id: "task-report",
      kind: "report",
      name: "Weekly report",
      enabled: true,
      type: "daily",
      timeOfDay: "09:00",
      history: [],
    }];
    const ctx = {
      listSchedules: () => schedules,
      runScheduleNow: async (id) => {
        assert.equal(id, "task-report");
        const run = {
          runId: "run-report-1",
          startedAt: "2026-07-07T01:00:00.000Z",
          completedAt: "2026-07-07T01:00:01.000Z",
          durationMs: 1000,
          status: "completed",
          manual: true,
          accepted: true,
          summary: "Report generated",
          reportPath,
          reportPeriod: "weekly",
          reportSessions: 3,
          reportMessages: 25,
          assistantMessageId: "assistant-1",
        };
        schedules[0].history.unshift(run);
        schedules[0].lastStatus = "completed";
        schedules[0].lastRunAt = run.completedAt;
        return { ok: true, accepted: true, runId: run.runId, schedule: schedules[0] };
      },
    };

    const run = await api("POST", "/api/schedules/task-report/run", {}, ctx);
    assert.equal(run.status, 202);
    assert.equal(run.json.runId, "run-report-1");
    assert.equal(run.json.schedule.history[0].status, "completed");
    assert.equal(run.json.schedule.history[0].reportPath, reportPath);
    assert.equal(run.json.schedule.history[0].assistantMessageId, "assistant-1");

    const list = await api("GET", "/api/schedules", null, ctx);
    assert.equal(list.status, 200);
    assert.equal(list.json.schedules[0].history[0].summary, "Report generated");

    const resolvedReport = await api("POST", "/api/artifacts/resolve", {
      candidates: [reportPath],
    }, ctx);
    assert.equal(resolvedReport.status, 200);
    assert.equal(resolvedReport.json.files.length, 1);
    assert.equal(resolvedReport.json.files[0].path, reportPath);

    const previewReport = await api("POST", "/api/artifacts/preview", {
      path: reportPath,
    }, ctx);
    assert.equal(previewReport.status, 200);
    assert.equal(previewReport.json.filename, "weekly-report.md");
    assert.match(previewReport.json.content, /# Weekly/);
  });

  test("产物 API 只解析工作区或已登记的生成文件，并支持预览与另存", async () => {
    const workspaceFile = join(tmpWorkspace, "conversation-summary.md");
    const generatedFile = join(tmpRoot, "generated-outside.md");
    const unrelatedFile = join(tmpRoot, "unrelated.md");
    writeFileSync(workspaceFile, "# Summary\n\nWorkspace file.\n", "utf8");
    writeFileSync(generatedFile, "# Generated\n\nAllowed by registry.\n", "utf8");
    writeFileSync(unrelatedFile, "# Unrelated\n\nShould not resolve.\n", "utf8");

    const artifactCtx = {
      getGeneratedArtifactPaths: () => [generatedFile],
      resolveDlpReadablePath: async (path) => ({ path }),
    };

    const resolved = await api("POST", "/api/artifacts/resolve", {
      candidates: [workspaceFile, generatedFile, unrelatedFile],
    }, artifactCtx);
    assert.equal(resolved.status, 200);
    const resolvedPaths = resolved.json.files.map((file) => file.path);
    assert.ok(resolvedPaths.includes(workspaceFile));
    assert.ok(resolvedPaths.includes(generatedFile));
    assert.equal(resolvedPaths.includes(unrelatedFile), false);

    const preview = await api("POST", "/api/artifacts/preview", { path: workspaceFile }, artifactCtx);
    assert.equal(preview.status, 200);
    assert.equal(preview.json.filename, "conversation-summary.md");
    assert.match(preview.json.content, /Workspace file/);

    const saved = await api("POST", "/api/artifacts/save", {
      filename: "task-result.md",
      content: "# Saved\n\nArtifact body.\n",
    }, artifactCtx);
    assert.equal(saved.status, 200);
    assert.equal(existsSync(saved.json.path), true);
    assert.match(readFileSync(saved.json.path, "utf8"), /Artifact body/);
  });

  test("用户主动打开的 Markdown 文档登记后才允许预览", async () => {
    const docsDir = join(tmpRoot, "external-docs");
    const docPath = join(docsDir, "阅读 测试.md");
    const txtPath = join(docsDir, "note.txt");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(docPath, "# 外部文档\n\n用于测试双击打开。\n", "utf8");
    writeFileSync(txtPath, "plain text\n", "utf8");

    const denied = await api("POST", "/api/artifacts/preview", { path: docPath });
    assert.equal(denied.status, 403);

    const registered = await api("POST", "/api/artifacts/register-opened-document", {
      path: "阅读 测试.md",
      cwd: docsDir,
    });
    assert.equal(registered.status, 200);
    assert.equal(registered.json.path, docPath);
    assert.equal(registered.json.filename, "阅读 测试.md");
    assert.equal(registered.json.previewable, true);

    const preview = await api("POST", "/api/artifacts/preview", { path: docPath });
    assert.equal(preview.status, 200);
    assert.equal(preview.json.filename, "阅读 测试.md");
    assert.match(preview.json.content, /外部文档/);

    const unsupported = await api("POST", "/api/artifacts/register-opened-document", {
      path: txtPath,
    });
    assert.equal(unsupported.status, 400);
  });
});
