import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
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
const dashboardAppUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const dashboardIndexUrl = new URL("../visionox-pkg/dashboard/index.html", import.meta.url);
const dashboardSourceRootUrl = new URL("../visionox-pkg/dashboard/src/", import.meta.url);
const launcherUrl = new URL("../launcher.mjs", import.meta.url);
const knowledgeRuntimeUrl = new URL("../lib/knowledge-runtime.mjs", import.meta.url);
const modelTaskRequestUrl = new URL("../lib/model-task-request.mjs", import.meta.url);
const fileAccessRescueSkillUrl = new URL("../../bootstrap-skills/file-access-rescue/SKILL.md", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const { listSessions, sessionPath } = await import(sessionUrl.href);

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


  test("会话列表发现旧计数元数据后按 JSONL 重新计数并修复文件签名", () => {
    const name = "stale-message-count";
    const path = sessionPath(name);
    const metaPath = path.replace(/\.jsonl$/, ".meta.json");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Array.from({ length: 1094 }, (_, index) => JSON.stringify({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `message-${index}`,
    })).join("\n") + "\n", "utf8");
    writeFileSync(metaPath, JSON.stringify({ messageCount: 167 }), "utf8");

    const first = listSessions().find((session) => session.name === name);
    assert.equal(first?.messageCount, 1094);

    const repaired = JSON.parse(readFileSync(metaPath, "utf8"));
    const stat = statSync(path);
    assert.equal(repaired.messageCount, 1094);
    assert.equal(repaired.messageCountFileSize, stat.size);
    assert.equal(repaired.messageCountFileMtimeMs, stat.mtimeMs);

    const second = listSessions().find((session) => session.name === name);
    assert.equal(second?.messageCount, 1094);

    writeFileSync(path, `${readFileSync(path, "utf8")}${JSON.stringify({ role: "user", content: "new-message" })}\n`, "utf8");
    const afterAppend = listSessions().find((session) => session.name === name);
    assert.equal(afterAppend?.messageCount, 1095);
    assert.equal(afterAppend?.meta.messageCountFileSize, statSync(path).size);
  });

  test("大会话按页查看且 Markdown 导出保留完整首尾内容", async () => {
    const name = "large-session";
    const path = sessionPath(name);
    mkdirSync(dirname(path), { recursive: true });
    const records = [];
    for (let i = 0; i < 620; i++) {
      records.push(JSON.stringify({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `${i === 0 ? "FIRST-MARKER " : ""}${i === 619 ? "LAST-MARKER " : ""}${"x".repeat(7200)}`,
      }));
    }
    writeFileSync(path, `${records.join("\n")}\n`, "utf8");

    const latest = await api("GET", `/api/sessions/${encodeURIComponent(name)}?limit=200`);
    assert.equal(latest.status, 200);
    assert.equal(latest.json.messages.length, 200);
    assert.equal(latest.json.totalMessages, 620);
    assert.equal(latest.json.hasMore, true);
    assert.match(latest.json.messages.at(-1).content, /LAST-MARKER/);

    const earlier = await api("GET", `/api/sessions/${encodeURIComponent(name)}?limit=200&offset=600`);
    assert.equal(earlier.status, 200);
    assert.equal(earlier.json.messages.length, 20);
    assert.match(earlier.json.messages[0].content, /FIRST-MARKER/);

    const exported = await api("POST", `/api/sessions/${encodeURIComponent(name)}/export`, {});
    assert.equal(exported.status, 200);
    const markdown = readFileSync(exported.json.path, "utf8");
    assert.match(markdown, /FIRST-MARKER/);
    assert.match(markdown, /LAST-MARKER/);
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

  test("排队内容由服务端持久化接口管理，并透传稳定请求编号", async () => {
    const queues = new Map();
    let submitted = null;
    const uploadedAttachmentId = `att_${"a".repeat(32)}`;
    const queueCtx = {
      listPromptQueue: (scope) => queues.get(scope) ?? [],
      upsertPromptQueueItem: (scope, item) => {
        const current = queues.get(scope) ?? [];
        const next = [...current.filter((entry) => entry.id !== item.id), item];
        queues.set(scope, next);
        return { ok: true, item, items: next };
      },
      removePromptQueueItem: (scope, id) => {
        const next = id ? (queues.get(scope) ?? []).filter((entry) => entry.id !== id) : [];
        queues.set(scope, next);
        return { ok: true, items: next };
      },
      submitPrompt: async (prompt, session, images, opts) => {
        submitted = { prompt, session, images, opts };
        return { accepted: true, requestId: opts.requestId, turnId: "turn-queue-1" };
      },
      handleAttachmentUpload: async (action) => action === "init"
        ? { uploadId: "upload-1", chunkBytes: 524288, size: 3 }
        : action === "finish"
          ? { attachment: { id: uploadedAttachmentId, kind: "image" } }
          : { received: 3, complete: true },
    };

    const item = { id: "queued-stable-1", text: "queued prompt", images: [], status: "queued", createdAt: 1 };
    const stored = await api("POST", "/api/prompt-queue", { scope: "workspace-a", item }, queueCtx);
    assert.equal(stored.status, 200);
    const listed = await api("GET", "/api/prompt-queue?scope=workspace-a", null, queueCtx);
    assert.equal(listed.status, 200);
    assert.equal(listed.json.items[0].id, item.id);

    const upload = await api("POST", "/api/attachments", { action: "init", name: "screen.png", size: 3 }, queueCtx);
    assert.equal(upload.status, 200);
    assert.equal(upload.json.uploadId, "upload-1");

    const sent = await api("POST", "/api/submit", { prompt: item.text, requestId: item.id, attachments: [uploadedAttachmentId] }, queueCtx);
    assert.equal(sent.status, 202);
    assert.equal(submitted.opts.requestId, item.id);
    assert.deepEqual(submitted.opts.attachmentIds, [uploadedAttachmentId]);

    const removed = await api("DELETE", "/api/prompt-queue", { scope: "workspace-a", id: item.id }, queueCtx);
    assert.equal(removed.status, 200);
    assert.equal(removed.json.items.length, 0);
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

    const recent = await api("POST", "/api/artifacts/recent", { limit: 20 }, artifactCtx);
    assert.equal(recent.status, 200);
    const recentPaths = recent.json.files.map((file) => file.path);
    assert.ok(recentPaths.includes(generatedFile));
    assert.ok(recentPaths.includes(saved.json.path));
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
    assert.equal(registered.json.openable, false);

    const preview = await api("POST", "/api/artifacts/preview", { path: docPath });
    assert.equal(preview.status, 200);
    assert.equal(preview.json.filename, "阅读 测试.md");
    assert.match(preview.json.content, /外部文档/);

    const externalOpen = await api("POST", "/api/artifacts/open-file", { path: docPath });
    assert.equal(externalOpen.status, 403);
    assert.match(externalOpen.json.error, /external opening of Markdown files is disabled/i);

    const recent = await api("POST", "/api/artifacts/recent", { limit: 20 });
    assert.equal(recent.status, 200);
    const opened = recent.json.files.find((file) => file.path === docPath);
    assert.equal(opened?.source, "opened");

    const unsupported = await api("POST", "/api/artifacts/register-opened-document", {
      path: txtPath,
    });
    assert.equal(unsupported.status, 400);
  });

  test("聊天输入不会因内联产物选择回调触发历史消息列表重渲染", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    assert.match(app, /const selectArtifactMessage = q2\(\(msg\) => \{/);
    assert.match(app, /onSelectArtifactMessage=\$\{selectArtifactMessage\}/);
    assert.doesNotMatch(app, /onSelectArtifactMessage=\$\{\(msg\) => \{/);
  });

  test("会话页以独立批量模式管理会话和可预览回收站", async () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const plansPanel = app.slice(app.indexOf("function PlansPanel("), app.indexOf("function SessionsPanel("));
    const sessionsPanel = app.slice(app.indexOf("function SessionsPanel("), app.indexOf("function parseCustomInterval"));
    assert.doesNotMatch(plansPanel, /selectedNames|retentionDraft/);
    assert.match(sessionsPanel, /const \[selectedNames, setSelectedNames\] = d2/);
    assert.match(sessionsPanel, /const \[selectedTrashIds, setSelectedTrashIds\] = d2/);
    assert.match(sessionsPanel, /const \[listMode, setListMode\] = d2\("sessions"\)/);
    assert.match(sessionsPanel, /const \[selectionMode, setSelectionMode\] = d2\(false\)/);
    assert.match(sessionsPanel, /const \[retentionDraft, setRetentionDraft\] = d2\(30\)/);
    assert.match(sessionsPanel, /\/sessions\/trash\/\$\{encodeURIComponent\(item\.id\)\}\?limit=200/);
    assert.match(sessionsPanel, /\/sessions\/trash\/batch-restore/);
    assert.match(sessionsPanel, /\/sessions\/trash\/batch/);
    assert.match(sessionsPanel, /session-list-tabs/);
    assert.match(sessionsPanel, /session-batch-bar/);
    assert.match(sessionsPanel, /session-page-feedback/);
    assert.match(sessionsPanel, /visionox\.sessions\.skipTrashConfirm/);
    assert.match(sessionsPanel, /t4\("sessions\.dontAskAgain"\)/);
    assert.match(sessionsPanel, /t4\("sessions\.restoreConfirmBack"\)/);
    assert.doesNotMatch(sessionsPanel, /confirm\("将此会话移入回收站/);
    assert.doesNotMatch(sessionsPanel, /confirm\(`将选中的 \$\{names\.length\} 个会话移入回收站/);

    const calls = [];
    const trashedPath = join(tmpRoot, "trashed-session.jsonl");
    writeFileSync(trashedPath, `${JSON.stringify({ role: "user", content: "preview me" })}\n`);
    const ctx = {
      trashSessions: (names) => {
        calls.push(["trash", names]);
        return { ok: true, movedCount: names.length, failedCount: 0, moved: names.map((name) => ({ name })) };
      },
      getSessionTrashEntry: (id) => ({ id, name: "old-session", path: trashedPath, movedAt: new Date().toISOString() }),
      restoreSessionTrash: (id, newName) => {
        calls.push(["restore", id, newName]);
        return { ok: true, restored: true, name: newName || "restored-session" };
      },
      deleteSessionTrash: (ids) => {
        calls.push(["permanent", ids]);
        return { ok: true, deletedCount: ids.length, failedCount: 0 };
      },
      setSessionTrashRetentionDays: (days) => {
        calls.push(["retention", days]);
        return { ok: true, retentionDays: days, pruned: 0 };
      },
      listSessionTrash: () => [{ id: "trash-1", name: "old-session", movedAt: new Date().toISOString(), files: [] }],
      getSessionTrashRetentionDays: () => 30,
    };
    const batch = await api("POST", "/api/sessions/batch-trash", { names: ["a", "b"] }, ctx);
    assert.equal(batch.status, 200);
    assert.equal(batch.json.movedCount, 2);
    const preview = await api("GET", "/api/sessions/trash/trash-1?limit=200", null, ctx);
    assert.equal(preview.status, 200);
    assert.equal(preview.json.messages[0].content, "preview me");
    const restore = await api("POST", "/api/sessions/trash/trash-1/restore", { newName: "restored-copy" }, ctx);
    assert.equal(restore.status, 200);
    const permanent = await api("DELETE", "/api/sessions/trash/batch", { ids: ["trash-1"] }, ctx);
    assert.equal(permanent.status, 200);
    const retention = await api("POST", "/api/sessions/trash-retention", { retentionDays: 45 }, ctx);
    assert.equal(retention.status, 200);
    assert.deepEqual(calls, [["trash", ["a", "b"]], ["restore", "trash-1", "restored-copy"], ["permanent", ["trash-1"]], ["retention", 45]]);
  });

  test("设置页密钥必须由用户明确点击保存，输入过程不会自动提交", () => {
    const source = readFileSync(dashboardAppUrl, "utf8");
    assert.doesNotMatch(source, /onInput=\$\{\(e3\) => \{ if\(e3\.target\.value\.trim\(\)\.length >= 16\) save\(\{ bingApiKey:/);
    assert.match(source, /bingApiKey: draft\.bingApiKey/);
  });

  test("开发者日志只在底部时自动跟随，查看历史时保留滚动位置", () => {
    const source = readFileSync(dashboardAppUrl, "utf8");
    const settingsPanel = source.slice(source.indexOf("function sameDevLogSnapshot"), source.indexOf("// dashboard/src/panels/skills.ts"));
    assert.match(settingsPanel, /function sameDevLogSnapshot/);
    assert.match(settingsPanel, /if \(sameDevLogSnapshot\(current, next\)\) return/);
    assert.match(settingsPanel, /devLogFollowRef\.current/);
    assert.match(settingsPanel, /el\.scrollHeight - el\.scrollTop - el\.clientHeight <= 24/);
    assert.match(settingsPanel, /if \(!devLogFollowing\) return/);
    assert.match(settingsPanel, /settings\.devNewLogs/);
    assert.match(settingsPanel, /settings\.devBackToBottom/);
    assert.match(settingsPanel, /ref=\$\{devLogPanelRef\} onScroll=\$\{handleDevLogScroll\}/);
    assert.doesNotMatch(settingsPanel, /document\.getElementById\("dev-log-panel"\)/);
  });

  test("主界面提供模型导入，设置页保留凭据维护与全量检测", () => {
    const source = readFileSync(dashboardAppUrl, "utf8");
    const chatPanel = source.slice(source.indexOf("function ChatPanel("), source.indexOf("var ChatFeed ="));
    const settingsPanel = source.slice(source.indexOf("function SettingsPanel("), source.indexOf("// dashboard/src/panels/skills.ts"));
    assert.doesNotMatch(source, /function formatProviderImportPreview/);
    assert.doesNotMatch(chatPanel, /JSON\.stringify\(providerImportDraft/);
    assert.match(chatPanel, /loadProviderImportFile[\s\S]*?\/providers\/import\/preview[\s\S]*?confirmProviderImport\(draft, plan\)/);
    assert.match(chatPanel, /confirmProviderImport[\s\S]*?\/providers\/import/);
    assert.match(chatPanel, /testAllProviders/);
    assert.match(chatPanel, /cleanupFailedModels/);
    assert.match(chatPanel, /\/providers\/cleanup-failed/);
    assert.doesNotMatch(settingsPanel, /providerImportDraft|confirmSettingsProviderImport|settings-provider-import-file/);
    assert.match(settingsPanel, /testManagedProviders/);
    assert.match(chatPanel, /dash\.kind === "config-changed"[\s\S]*?Promise\.allSettled\(\[api\("\/overview"\), api\("\/providers"\)\]\)/);
    assert.match(settingsPanel, /\/providers\/credentials\/test/);
    assert.match(settingsPanel, /\/providers\/credentials\/save/);
    assert.match(settingsPanel, /disabled=\$\{saving \|\| credentialTesting \|\| !credentialVerification\}/);
    assert.match(settingsPanel, /settings\.credentialsRetest/);
    assert.doesNotMatch(settingsPanel, /save\(\{ preset:/);
    assert.doesNotMatch(settingsPanel, /save\(\{ reasoningEffort:/);
  });

  test("临时提示固定在视口内，不参与根页面高度计算", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const css = readFileSync(new URL("../visionox-pkg/dashboard/app.css", import.meta.url), "utf8");
    assert.match(app, /<div class="toast-stack">/);
    assert.match(css, /\.toast-stack\s*\{[\s\S]*?position:\s*fixed;/);
    assert.match(css, /\.toast-stack\s*\{[\s\S]*?width:\s*min\(400px, calc\(100vw - 2 \* var\(--space-4\)\)\);/);
    assert.doesNotMatch(css, /@keyframes toast-enter\s*\{[\s\S]*?translateX\(100%\)/);
  });

  test("模型菜单在操作位置显示固定高度反馈，不再发送远端 Toast", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const chatPanel = app.slice(app.indexOf("function ChatPanel("), app.indexOf("var ChatFeed ="));
    const providerSwitch = chatPanel.slice(chatPanel.indexOf("const selectProviderModel"), chatPanel.indexOf("const pickWorkspace"));
    assert.match(chatPanel, /const \[modelNotice, setModelNotice\] = d2\(null\)/);
    assert.match(chatPanel, /role="status" aria-live="polite" style="min-height:18px/);
    assert.match(chatPanel, /pushModelNotice\(t4\("chat\.modelApplying"\)/);
    assert.match(providerSwitch, /pushModelNotice\(t4\("chat\.modelSwitching"\)/);
    assert.doesNotMatch(providerSwitch, /showToast\(/);
  });

  test("概览位于任务和 OA 之间，系统能力合并后不再占用高级入口", () => {
    const source = readFileSync(new URL("app.ts", dashboardSourceRootUrl), "utf8");
    const changesSource = readFileSync(new URL("panels/changes.ts", dashboardSourceRootUrl), "utf8");
    const systemSource = readFileSync(new URL("panels/system.ts", dashboardSourceRootUrl), "utf8");
    const workspace = source.slice(source.indexOf('label: t4("app.sectionWorkspace")'), source.indexOf('label: t4("app.sectionConfigure")'));
    const advanced = source.slice(source.indexOf('label: t4("app.sectionConfigure")'), source.indexOf("function App("));
    const workspaceIds = [...workspace.matchAll(/\{ id: "([^"]+)"/g)].map((match) => match[1]);
    const ids = [...advanced.matchAll(/\{ id: "([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(workspaceIds, ["chat", "sessions", "files", "tasks", "overview"]);
    assert.match(source, /id: "tasks"[\s\S]*?id: "overview"[\s\S]*?title="\\u529E\\u516C OA"/);
    assert.deepEqual(ids, ["memory", "skills", "tools", "mcp", "semantic", "hooks", "permissions", "settings"]);
    assert.doesNotMatch(advanced, /\{ id: "overview"/);
    assert.doesNotMatch(advanced, /\{ id: "health"/);
    assert.doesNotMatch(advanced, /\{ id: "changes"/);
    assert.match(advanced, /ChangesPanel is hidden because it duplicates the main chat/);
    assert.match(advanced, /future replacement should be a read-only "session changes" summary/);
    assert.match(advanced, /SystemPanel is retained for diagnostics/);
    assert.match(source, /import \{ ChangesPanel \} from "\.\/panels\/changes\.js"/);
    assert.match(source, /import \{ SystemPanel \} from "\.\/panels\/system\.js"/);
    assert.match(changesSource, /function ChangesPanel\(\)/);
    assert.match(systemSource, /function SystemPanel\(\)/);
    assert.match(advanced, /id: "memory"[\s\S]*?breakBefore: true/);
    assert.match(advanced, /id: "mcp"[\s\S]*?breakBefore: true/);
    assert.match(advanced, /id: "permissions"[\s\S]*?breakBefore: true/);
  });

  test("概览合并工作状态、操作提醒、会话计划和本地系统摘要", () => {
    const source = readFileSync(dashboardAppUrl, "utf8");
    const overview = source.slice(source.indexOf("function OverviewPanel()"), source.indexOf("// dashboard/src/panels/permissions.ts"));
    assert.match(overview, /usePoll\("\/overview", 5e3, "overview"\)/);
    assert.match(overview, /usePoll\("\/health", 5e3, "health"\)/);
    assert.match(overview, /activeProviderName/);
    assert.match(overview, /VisionoxOverviewAlertPolicy\.evaluate/);
    assert.match(overview, /modelVerificationDirty: o3\.modelVerification\?\.dirty/);
    assert.match(overview, /retrievalMode: retrievalData\?\.mode/);
    assert.match(overview, /api\("\/providers\/test", \{ method: "POST", body: \{\} \}\)/);
    assert.match(overview, /tabId: "semantic"/);
    assert.match(overview, /currentSessionBlock\(c3\)/);
    assert.match(overview, /recentPlansRail\(c3\)/);
    assert.match(overview, /h3\.sessions\.totalBytes/);
    assert.match(overview, /h3\.memory\.totalBytes/);
    assert.match(overview, /h3\.semantic\.totalBytes/);
    assert.match(overview, /usePoll\("\/backups", 15e3\)/);
    assert.match(overview, /api\("\/backups", \{ method: "POST", body: \{\} \}\)/);
    assert.match(overview, /\/backups\/\$\{encodeURIComponent\(id\)\}\/preview/);
    assert.match(overview, /\/backups\/\$\{encodeURIComponent\(id\)\}\/restore/);
    assert.match(overview, /VisionoxBackupPolicy\.restoreActions\(backupPreview\.counts\)/);
    assert.match(overview, /actions\.canOverwriteConflicts/);
    assert.match(overview, /usePoll\("\/backups\/estimate", 3e4\)/);
    assert.match(overview, /api\("\/backups\/retention"/);
    assert.match(overview, /method: "DELETE"/);
    assert.match(overview, /const storageHealth = h3\?\.storage\?\.backups/);
    assert.match(overview, /storageHealth\.totalBytes/);
    assert.match(overview, /storageHealth\.backups\.latestAt/);
    assert.match(overview, /h3\?\.storageIssues\?\.length/);
    assert.match(overview, /h3\.jobs > 0/);
    assert.match(overview, /<details/);
    assert.match(overview, /overview\.userDataPaths/);
    assert.doesNotMatch(overview, /overview\.elevatedMode|editMode === "admin"|editMode === "yolo"/);
    assert.doesNotMatch(overview, /<tr><td class="dim">\$\{t4\("overview\.projectRoot"\)\}/);
    assert.doesNotMatch(overview, /toolActivityFeed\(c3\)/);
    assert.doesNotMatch(overview, /h3\.usageLog\.bytes/);
  });

  test("会话整理保持原任务类型并显式控制知识提炼和自动 embedding", () => {
    const source = readFileSync(dashboardAppUrl, "utf8");
    const launcher = readFileSync(launcherUrl, "utf8");
    const knowledgeRuntime = readFileSync(knowledgeRuntimeUrl, "utf8");
    const modelTaskRequest = readFileSync(modelTaskRequestUrl, "utf8");
    assert.match(source, /knowledgeEnabled: draft\.knowledgeEnabled/);
    assert.match(source, /knowledgeAutoIndex: draft\.knowledgeAutoIndex/);
    assert.match(source, /sessionCleanupPromptAddendum: draft\.sessionCleanupPromptAddendum/);
    assert.match(source, /maxlength="4000"/);
    assert.match(source, /\/sessions\/batch-trash/);
    assert.match(source, /\/sessions\/trash-retention/);
    assert.match(source, /selectedNames\.size/);
    assert.match(source, /semanticConfig\?\.openaiCompat\?\.apiKeySet === true/);
    assert.match(source, /includeKnowledgeDocs/);
    assert.doesNotMatch(source, /value="knowledge_digest"/);
    assert.match(launcher, /new Set\(\["prompt", "report", "session_cleanup"\]\)/);
    assert.match(launcher, /const knowledge = await generateSessionKnowledge\(task, signal, qualityState\)[\s\S]*?guardSessionCleanupDeletion\([\s\S]*?trashSessions\(deletion\.names, runId\)/);
    assert.match(launcher, /item\.action !== "trash_candidate"[\s\S]*?protectedKnowledgeNames/);
    assert.match(launcher, /selectPendingKnowledgeSessions/);
    assert.match(launcher, /writeKnowledgeManifest/);
    assert.match(launcher, /workspace: task\.workspaceDir/);
    assert.match(knowledgeRuntime, /realpathSync\(candidate\)[\s\S]*?resolves outside the bound workspace/);
    assert.match(launcher, /sourceFingerprint\(candidates\).*instructionId/);
    assert.match(knowledgeRuntime, /const root = resolve\(projectRoot, "knowledge"\)/);
    assert.match(knowledgeRuntime, /renameSync\(legacyRoot, root\)/);
    assert.match(launcher, /update\.action === "delete" && item\.action !== "delete" \? "keep"/);
    assert.match(launcher, /if \(!client\)[\s\S]*?semantic cleanup review/);
    assert.match(launcher, /buildSessionQualityPrompt/);
    assert.match(launcher, /normalizeSessionQualityEvaluations/);
    assert.match(launcher, /requestTaskModelJson/);
    assert.match(modelTaskRequest, /responseFormat: structuredOutput \? \{ type: "json_object" \} : undefined/);
    assert.match(launcher, /offset \+= 4/);
    assert.match(launcher, /evaluationFailures\.push/);
    assert.match(launcher, /knowledgeAIFailed: aiFailed/);
    assert.match(source, /AI 评估失败/);
    assert.match(launcher, /addToolToPrefix: addToolToActivePrefix/);
    assert.match(launcher, /const updateKnowledgeSemanticIndex = knowledgeRuntime\.updateSemanticIndex/);
    assert.match(knowledgeRuntime, /onActiveIndexUpdated/);
    assert.match(launcher, /hasSemanticSearch = true[\s\S]*?prefix\?\.addTool/);
    assert.match(launcher, /evaluateKnowledgeDocument/);
    assert.match(launcher, /documentQuality\.action === "revise"/);
    assert.match(launcher, /DEFAULT_SESSION_TRASH_RETENTION_DAYS = 30/);
    assert.match(launcher, /pruneExpiredSessionTrash\(\);/);
  });

  test("语义搜索覆盖项目知识并在结果中标注来源类型", () => {
    const semanticTool = readFileSync(new URL("../visionox-pkg/dist/cli/chunk-YYQAUTTN.js", import.meta.url), "utf8");
    assert.match(semanticTool, /past decisions, prior solutions, established workflows, validation evidence/);
    assert.match(semanticTool, /startsWith\("knowledge\/"\) \? "knowledge" : "workspace"/);
    assert.match(semanticTool, /\[\$\{sourceType\}\] \$\{entry\.path\}:\$\{entry\.startLine\}-\$\{entry\.endLine\}/);
  });

  test("聊天输入区提供会话级索引模式并展示自动召回来源", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const launcher = readFileSync(launcherUrl, "utf8");
    const knowledgeRuntime = readFileSync(knowledgeRuntimeUrl, "utf8");
    const chatPanel = app.slice(app.indexOf("function ChatPanel("), app.indexOf("var ChatFeed ="));
    assert.match(chatPanel, /\/index-retrieval-mode/);
    assert.match(chatPanel, /<div class="popover-h">\$\{t4\("chat\.indexTitle"\)\}<\/div>/);
    assert.match(chatPanel, /\[\["auto", t4\("chat\.indexAuto"\)\], \["tool", t4\("chat\.indexTool"\)\], \["off", t4\("chat\.indexOff"\)\]\]/);
    assert.match(chatPanel, /indexRetrievalMode === mode2/);
    assert.match(chatPanel, /title=\$\{globalThis\.VisionoxIndexModePolicy\.hint\(mode2\)\}/);
    assert.match(chatPanel, /changeIndexRetrievalMode\(\{ target: \{ value: mode2 \} \}\)/);
    assert.match(chatPanel, /dash\.kind === "semantic-retrieval"/);
    assert.match(chatPanel, /t4\("chat\.refsCount", \{ count: semanticRetrievalSources\.length \}\)/);
    assert.match(chatPanel, /t4\("chat\.retrievalTimeout"\)/);
    assert.match(chatPanel, /previewRetrievedSource/);
    assert.match(chatPanel, /VisionoxIndexModePolicy\.normalize/);
    assert.match(launcher, /indexRetrievalMode === "off"[\s\S]*?semantic_search/);
    assert.match(launcher, /querySemanticGroups/);
    assert.match(knowledgeRuntime, /DEFAULT_CACHE_MAX = 100/);
    assert.match(launcher, /const retrievalText = manualSkillTask \?\? text/);
    assert.match(launcher, /retrieveSemanticContext\(retrievalText, retrievalHistory/);
    assert.match(launcher, /restoreOriginalUserInput[\s\S]*?syncActiveSessionFromLoop/);
    assert.match(launcher, /indexRetrievalMode,/);
    assert.match(launcher, /let indexRetrievalMode = normalizeIndexRetrievalMode\(config\.indexRetrievalMode\)/);
    assert.match(launcher, /cfg\.indexRetrievalMode = next[\s\S]*?writeConfig\(cfg, configPath\)/);
    const resetConversation = launcher.slice(launcher.indexOf("async function resetActiveConversation"), launcher.indexOf("const SLASH_COMMAND_META"));
    assert.doesNotMatch(resetConversation, /indexRetrievalMode = "tool"/);
    assert.doesNotMatch(launcher, /indexRetrievalMode = normalizeIndexRetrievalMode\(meta\.indexRetrievalMode\)/);
    assert.doesNotMatch(launcher, /indexRetrievalMode = normalizeIndexRetrievalMode\(sessionMeta\.indexRetrievalMode\)/);
  });

  test("全量检测所有已保存模型，并保留外部多模式和内部固定模式分支", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const server = readFileSync(new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url), "utf8");
    const chatPanel = app.slice(app.indexOf("function ChatPanel("), app.indexOf("var ChatFeed ="));
    const settingsPanel = app.slice(app.indexOf("function SettingsPanel("), app.indexOf("// dashboard/src/panels/skills.ts"));
    assert.match(chatPanel, /confirmProviderImport/);
    assert.match(settingsPanel, /testManagedProviders/);
    assert.match(chatPanel, /t4\("chat\.configDirtyRetest"\)/);
    assert.match(chatPanel, /t4\("chat\.testAllBtn"\)/);
    assert.match(chatPanel, /setModelVerification\(pr\.modelVerification \?\? null\)/);
    assert.match(chatPanel, /model\.testStatus/);
    assert.match(chatPanel, /const allModels = \(providers \?\? \[\]\)\.flatMap/);
    assert.match(chatPanel, /providerDisplayGroups\(providers \?\? \[\]\)/);
    assert.match(chatPanel, /providerDisplayLabel\(provider\)/);
    assert.match(app, /return `\$\{name\} · \$\{results\.join\(" · "\)\}`/);
    const providerLabel = app.slice(app.indexOf("function providerOptionLabel"), app.indexOf("var CHAT_RENDER_STEP"));
    assert.match(providerLabel, /model\.testStatus === "passed" \? `\$\{modelName\} ✓` : modelName/);
    assert.doesNotMatch(providerLabel, /未检测|×/);
    assert.match(chatPanel, /providerCaps\?\.presets\?\.length \?\? 0\) > 1/);
    assert.match(chatPanel, /\$\{preset\}\$\{t4\("chat\.fixedSuffix"\)\}/);
    assert.match(chatPanel, /selectProviderModel/);
    assert.match(server, /rest\[0\] === "test"/);
    assert.match(server, /testProviderModelCommunication/);
    assert.match(server, /Math\.min\(2, jobs\.length\)/);
    assert.match(server, /timeoutMs: 1e4/);
    assert.match(server, /modelVerification = \{ dirty: true, reason: "provider-import"/);
    assert.match(server, /delete model\.verification/);
    assert.match(server, /activationPresetForModel/);
    assert.doesNotMatch(server, /selectedModelId/);
  });

  test("长会话默认只渲染最近消息，并可继续加载和跳转历史", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    assert.match(app, /CHAT_INITIAL_RENDER_COUNT = 30/);
    assert.match(app, /const hiddenCount = Math\.max\(0, allMessages\.length - visibleCount\)/);
    assert.match(app, /allMessages\.slice\(hiddenCount\)/);
    assert.match(app, /setVisibleMessageCount\(\(count\) => Math\.max\(count, messages\.length - index\)\)/);
    assert.match(app, /const loadEarlierMessages = q2\((?:async )?\(\) => \{/);
    assert.match(app, /onLoadEarlier=\$\{loadEarlierMessages\}/);
    assert.doesNotMatch(app, /onLoadEarlier=\$\{\(\) =>/);
  });

  test("千条会话恢复使用 UI 窗口分页，普通输入不触发顶层逐字渲染", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const css = readFileSync(new URL("../visionox-pkg/dashboard/app.css", import.meta.url), "utf8");
    const launcher = readFileSync(launcherUrl, "utf8");
    const inputHandler = /const onInput = q2\([\s\S]*?\n  \);/.exec(app)?.[0] ?? "";

    assert.match(app, /CHAT_MESSAGE_PAGE_SIZE = 60/);
    assert.match(app, /CHAT_TOP_LOAD_THRESHOLD = 96/);
    assert.match(app, /totalMessages/);
    assert.match(app, /api\(`\/messages\?limit=\$\{CHAT_MESSAGE_PAGE_SIZE\}&offset=\$\{messages\.length\}`\)/);
    assert.match(app, /captureChatScrollAnchor/);
    assert.match(app, /restoreChatScrollAnchor/);
    assert.match(app, /scrollbarDraggingRef/);
    assert.match(app, /loadEarlierMessagesRef/);
    assert.match(app, /topLoadArmedRef/);
    assert.match(app, /t4\("chat\.shownOfTotal", \{ shown: renderedMessages\.length, total: displayTotal \}\)/);
    assert.match(app, /const inputValueRef = A2/);
    assert.match(inputHandler, /inputValueRef\.current = v3/);
    assert.doesNotMatch(inputHandler, /setInput\(v3\)/);
    assert.match(launcher, /DASHBOARD_MESSAGE_WINDOW = 60/);
    assert.match(launcher, /messages\.slice\(-DASHBOARD_MESSAGE_WINDOW\)/);
    assert.match(launcher, /await readFile\(sessionFile, "utf8"\)/);
    assert.doesNotMatch(launcher, /const raw = readFileSync\(sessionFile, "utf8"\)/);
    assert.match(css, /\.chat-msg\.message-complete\s*\{[\s\S]*?content-visibility:\s*auto/);
    assert.match(css, /contain-intrinsic-size:\s*auto 160px/);
    assert.doesNotMatch(css, /\.chat-msg\.message-streaming\s*\{[\s\S]*?content-visibility:\s*auto/);
    assert.doesNotMatch(css, /\.chat-msg\s*\{[\s\S]*?animation:\s*message-enter/);
  });

  test("长会话阅读历史时实时消息不会挤掉当前窗口，启动错误不会改变 Hook 数量", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const bootErrorReturn = app.indexOf("if (bootError) {");
    const finalChatHook = app.indexOf("loadEarlierMessagesRef.current = loadEarlierMessages;");

    assert.ok(bootErrorReturn > finalChatHook);
    assert.match(app, /const preserveVisibleHistoryOnAppend = q2\(\(\) => \{/);
    assert.match(app, /if \(!shouldAutoScroll\.current\) setVisibleMessageCount\(\(count\) => count \+ 1\)/);
    assert.match(app, /if \(!cur\) preserveVisibleHistoryOnAppend\(\)/);
    assert.match(app, /if \(!replacedStreaming\) preserveVisibleHistoryOnAppend\(\)/);
  });

  test("排队提交使用服务端存储和稳定请求编号", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    assert.match(app, /api\(`\/prompt-queue\?scope=\$\{encodeURIComponent\(queueStorageKey\)\}`\)/);
    assert.match(app, /var body = \{ prompt: text, requestId \}/);
    assert.match(app, /persistQueuedPrompt\(item\)/);
    assert.doesNotMatch(app, /localStorage\.setItem\(queueStorageKey/);
    assert.match(app, /queuePaused \|\| busy/);
    assert.match(app, /setQueuePaused\(true\)/);
    assert.match(app, /chat\.queueResume/);
    assert.match(app, /operation\?\.state === "stopping"/);
    assert.match(app, /dash\.operation\?\.state === "cancelled"/);
  });

  test("五类交互卡片校验 gate、避免重复提交并保持计划事务一致", () => {
    const chat = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");
    const chatInternals = readFileSync(new URL("components/chat-internals.ts", dashboardSourceRootUrl), "utf8");
    const markdown = readFileSync(new URL("lib/markdown.ts", dashboardSourceRootUrl), "utf8");
    const css = readFileSync(new URL("../visionox-pkg/dashboard/app.css", import.meta.url), "utf8");
    const launcher = readFileSync(launcherUrl, "utf8");
    const server = readFileSync(serverUrl, "utf8");
    const planTools = readFileSync(new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url), "utf8");

    assert.match(chat, /\.\.\.\(gateModal \? \{ gateId \} : \{\}\)/);
    assert.match(chat, /const \[modalResolving, setModalResolving\]/);
    assert.match(chatInternals, /disabled=\$\{!feedback\.trim\(\)\}/);
    assert.match(chatInternals, /disabled=\$\{!reviseText\.trim\(\)\}/);
    assert.match(markdown, /renderer\.html = \(\{ text \}\) => escapeHtml\(text\)/);
    assert.match(css, /\.modal-resolving/);
    assert.match(css, /\.modal-step-risk-med/);

    assert.match(server, /modal gateId must be a non-negative integer/);
    assert.match(server, /status: 409, body: \{ error: "modal is no longer active" \}/);
    assert.match(launcher, /const queuedModals = \[\]/);
    assert.match(launcher, /activeGateId !== gateId/);
    assert.match(launcher, /pendingPlanRevision = \{ reason, remainingSteps, summary \}/);
    assert.match(launcher, /if \(resolved && choice === "approve"\) \{[\s\S]{0,300}activatePendingPlan\(\)/);
    assert.match(launcher, /if \(resolved && choice !== "approve"\) pendingPlan = null/);
    assert.match(launcher, /stepId .* is not in the active plan/);
    assert.match(chat, /dash\.kind === "plan-activated"/);
    assert.match(planTools, /onPlanSubmitted\?\.\(plan, steps, summary\)/);
    assert.match(planTools, /completed: checkpoint\?\.completed/);
    assert.match(planTools, /never repeat or translate the title/);
  });

  test("选择卡片为可变长度 ID 保留列间距并安全换行", () => {
    const css = readFileSync(new URL("../visionox-pkg/dashboard/app.css", import.meta.url), "utf8");

    assert.match(css, /grid-template-columns:\s*minmax\(28px, max-content\) minmax\(0, 1fr\)/);
    assert.doesNotMatch(css, /grid-template-columns:\s*28px 1fr/);
    assert.match(css, /\.modal-choice-id\s*\{[\s\S]*?min-width:\s*28px;[\s\S]*?max-width:\s*96px;[\s\S]*?overflow-wrap:\s*anywhere;/);
    assert.match(css, /\.modal-choice-title\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?overflow-wrap:\s*anywhere;/);
    assert.match(css, /\.modal-choice-summary\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?grid-column:\s*2;[\s\S]*?overflow-wrap:\s*anywhere;/);
  });

  test("完成任务条会自动退场，配额耗尽的未完成计划会续跑并保留人工入口", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const css = readFileSync(new URL("../visionox-pkg/dashboard/app.css", import.meta.url), "utf8");
    const launcher = readFileSync(launcherUrl, "utf8");
    const loop = readFileSync(new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url), "utf8");

    assert.match(app, /todos\.every\(\(todo\) => todo\.status === "completed"\)/);
    assert.match(app, /setTimeout\(\(\) => \{\s*setTodos[\s\S]*?\}, 5e3\)/);
    assert.match(app, /dash\.kind === "plan-continuation-needed"/);
    assert.match(app, /继续执行当前未完成计划/);
    assert.match(app, /class="plan-continuation-bar"/);
    assert.match(css, /\.plan-continuation-bar/);

    assert.match(loop, /forcedSummaryReason: opts\.reason/);
    assert.match(launcher, /decidePlanContinuation\(/);
    assert.match(launcher, /MAX_PLAN_AUTO_CONTINUATIONS = 2/);
    assert.match(launcher, /kind: "plan-continuation-needed"/);
    assert.match(launcher, /incompleteFinal: !budgetForcedSummary && sawToolActivity/);
    assert.match(launcher, /kind: "assistant_final",\s*id: assistantId,\s*text: assistantText/);
  });

  test("OfficeCLI 批处理保护在所有模式生效并保留运行时纠偏", () => {
    const launcher = readFileSync(launcherUrl, "utf8");
    const loop = readFileSync(new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url), "utf8");
    const systemPrompt = readFileSync(new URL("../lib/system-prompt.mjs", import.meta.url), "utf8");
    const officeSkill = readFileSync(new URL("../../bootstrap-skills/officecli/SKILL.md", import.meta.url), "utf8");

    assert.match(launcher, /validateOfficecliInvocation/);
    assert.match(launcher, /wrapMcpToolsWithRecovery/);
    assert.match(systemPrompt, /in any work mode/);
    assert.match(systemPrompt, /never join multiple add\/set commands with newlines/);
    assert.match(loop, /OfficeCLI efficiency guard/);
    assert.match(officeSkill, /"command":"add"/);
    assert.doesNotMatch(officeSkill, /"op":"add"/);
  });

  test("活动会话和配置性重建都会保留模型上下文", () => {
    const launcher = readFileSync(launcherUrl, "utf8");
    const app = readFileSync(dashboardAppUrl, "utf8");
    assert.match(launcher, /const modelEntries = activeEntriesForModel\(entries\)/);
    assert.match(launcher, /loop\.log\.compactInPlace\(modelEntries\)/);
    assert.match(launcher, /function rebuildLoopPreservingContext/);
    assert.match(launcher, /rebuilt\.log\.compactInPlace\(priorEntries\)/);
    assert.match(launcher, /busy && loop\?\.model !== modelConfig\.model/);
    assert.match(launcher, /const appliedSwitch = commitPendingModelSwitch\(\)/);
    assert.match(launcher, /for \(const model of runtimeContextCapModels\) delete DEEPSEEK_CONTEXT_TOKENS\[model\]/);
    assert.match(launcher, /modelcfg=/);
    assert.match(launcher, /provider\?\.models\?\.filter\(\(item\) => item\.disabled !== true\)/);
    assert.match(app, /将在当前回答结束后切换，保留/);
    assert.match(app, /t4\("chat\.modelSwitchedKeepCount"/);
    assert.match(app, /stats\.estimatedContextTokens \?\? stats\.lastPromptTokens/);
    assert.match(app, /stats\.contextFoldTokens/);
    assert.doesNotMatch(app, /class="fold-mark" style="left:50%"/);
  });

  test("刷新和加载历史会话恢复稳定对话与工具事实，模型仍保留完整工具上下文", () => {
    const launcher = readFileSync(launcherUrl, "utf8");
    const activeSession = readFileSync(new URL("../lib/active-session.mjs", import.meta.url), "utf8");

    assert.match(activeSession, /toolStatusFromResult/);
    assert.match(activeSession, /entry\.tool_calls/);
    assert.match(activeSession, /系统自动续跑/);
    assert.doesNotMatch(activeSession, /reasoning:\s*entry\.reasoning/);
    assert.match(launcher, /const dashboardEntries = activeEntriesForDashboard\(entries\)/);
    assert.match(launcher, /loop\.adoptHistory\?\.\(modelEntries, loop\.model\)/);
    assert.match(launcher, /for \(const entry of dashboardEntries\)/);
  });

  test("错过的定时任务会在启动后补跑，忙碌时按顺序进入去重队列", () => {
    const launcher = readFileSync(launcherUrl, "utf8");
    const app = readFileSync(dashboardAppUrl, "utf8");
    assert.match(launcher, /task\.enabled && task\.missedRunAt/);
    assert.match(launcher, /triggerSchedule\(task\.id, \{ manual: false, catchUp: true \}\)/);
    assert.match(launcher, /decideRejectedScheduleSubmission/);
    assert.match(launcher, /createScheduleRuntime/);
    assert.match(launcher, /queueScheduleTrigger/);
    assert.match(launcher, /requestScheduleQueueDrain/);
    assert.match(launcher, /SCHEDULE_QUEUE_RECHECK_MS/);
    assert.doesNotMatch(launcher, /SCHEDULE_BUSY_RETRY_MS/);
    assert.match(launcher, /refreshScheduleTimer\(task\)/);
    assert.match(launcher, /scheduleRunRegistry/);
    assert.match(launcher, /MAX_CONCURRENT_SCHEDULE_RUNS = 1/);
    assert.match(app, /tasks\.runQueued/);
    assert.match(app, /task\.queued && task\.queuePosition/);
  });

  test("dashboard events retain the originating operation session across a switch", () => {
    const launcher = readFileSync(launcherUrl, "utf8");
    assert.match(launcher, /operationSessionIds/);
    assert.match(launcher, /const sessionId = [\s\S]{0,200}operationSessionIds/);
    assert.match(launcher, /operationSessionIds\.set\(operation\.id, operation\.context\?\.conversationId/);
    assert.match(launcher, /const operationId = ev\.operationId \?\? scoped\?\.operationId \?\? activeMessageSendContext\.operationId/);
  });

  test("file-access-rescue 兜底技能保持可索引，并要求先准备本地文档", () => {
    const skill = readFileSync(fileAccessRescueSkillUrl, "utf8");
    const frontmatter = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(skill)?.[1] ?? "";
    assert.match(frontmatter, /^name:\s*file-access-rescue$/m);
    assert.match(frontmatter, /^description:\s*\S.+$/m);
    assert.doesNotMatch(frontmatter, /^triggers:/m);
    assert.match(skill, /prepare_local_document/);
    assert.match(skill, /VISIONOX_DOCUMENT_READABLE_PATH/);
    assert.match(skill, /documentRef/);
    assert.doesNotMatch(skill, /returned `readablePath`/);
  });
});
