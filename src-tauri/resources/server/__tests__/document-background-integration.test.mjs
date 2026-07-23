import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const dashboardUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const dashboardCssUrl = new URL("../visionox-pkg/dashboard/app.css", import.meta.url);
const launcherUrl = new URL("../launcher.mjs", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const TOKEN = "document-background-test";

async function request(method, path, body, ctx) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.url = path;
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  let status = null;
  let raw = "";
  const res = {
    writeHead(value) { status = value; },
    end(value) { raw = value ?? ""; },
  };
  await dispatch(req, res, ctx, TOKEN);
  return { status, body: raw ? JSON.parse(raw) : null };
}

test("background API treats string ids as generic tasks and requires explicit actions", async () => {
  const id = "task:12345678-abcd-abcd-abcd-123456789012";
  const actions = [];
  const ctx = {
    listBackgroundJobs: async () => [{ id, kind: "task", running: true, status: "running" }],
    getBackgroundJob: async (value) => value === id ? { id, kind: "task" } : null,
    controlBackgroundJob: async (value, action) => {
      actions.push([value, action]);
      return { ok: true, id: value, action };
    },
    stopBackgroundJob: async (value) => ({ id: value, cancelled: true }),
  };

  const listed = await request("GET", "/api/background-jobs", undefined, ctx);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.jobs[0].kind, "task");
  const detail = await request("GET", `/api/background-jobs/${encodeURIComponent(id)}`, undefined, ctx);
  assert.equal(detail.status, 200);
  for (const action of ["pause", "resume", "retry", "retry_delivery", "stop", "abandon"]) {
    const response = await request("POST", `/api/background-jobs/${encodeURIComponent(id)}`, { action }, ctx);
    assert.equal(response.status, 200);
  }
  const deleted = await request("DELETE", `/api/background-jobs/${encodeURIComponent(id)}`, undefined, ctx);
  assert.equal(deleted.status, 405);
  assert.deepEqual(actions, [[id, "pause"], [id, "resume"], [id, "retry"], [id, "retry_delivery"], [id, "stop"], [id, "abandon"]]);
});

test("background task list includes pending deliveries from a generic snapshot", async () => {
  const id = "task:12345678-abcd-abcd-abcd-123456789012";
  const pendingDeliveries = [{ deliveryId: "delivery-1", taskId: id, revision: 7 }];
  const ctx = {
    listBackgroundJobs: async () => ({
      jobs: [{ id, kind: "complex-task", allowedActions: ["resolve_user_input"] }],
      pendingDeliveries,
    }),
  };

  const listed = await request("GET", "/api/background-jobs", undefined, ctx);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body, {
    jobs: [{ id, kind: "complex-task", allowedActions: ["resolve_user_input"] }],
    pendingDeliveries,
  });
});

test("background task detail treats generic ids as opaque", async () => {
  const id = "task:12345678-abcd-abcd-abcd-123456789012";
  let receivedId = null;
  const detail = await request("GET", `/api/background-jobs/${encodeURIComponent(id)}`, undefined, {
    getBackgroundJob: async (value) => {
      receivedId = value;
      return { id, revision: 7 };
    },
  });
  assert.equal(detail.status, 200);
  assert.equal(receivedId, id);
  assert.equal(detail.body.job.id, id);
});

test("background task control forwards concurrency metadata and delegates action policy", async () => {
  const id = "task:12345678-abcd-abcd-abcd-123456789012";
  const controls = [];
  const ctx = {
    controlBackgroundJob: async (value, action, options) => {
      controls.push({ value, action, options });
      if (action === "unsupported_by_task") {
        return { ok: false, error: "action is not allowed", allowedActions: ["resolve_user_input"] };
      }
      return { ok: true, id: value, action, revision: 8 };
    },
  };
  const controlOptions = {
    expectedRevision: 7,
    requestId: "request-1",
    payload: { choiceId: "continue" },
  };
  const controlled = await request("POST", `/api/background-jobs/${encodeURIComponent(id)}`, {
    action: "resolve_user_input",
    ...controlOptions,
  }, ctx);
  assert.equal(controlled.status, 200);
  assert.deepEqual(controls[0], { value: id, action: "resolve_user_input", options: controlOptions });

  const rejected = await request("POST", `/api/background-jobs/${encodeURIComponent(id)}`, {
    action: "unsupported_by_task",
    expectedRevision: 8,
    requestId: "request-2",
    payload: null,
  }, ctx);
  assert.equal(rejected.status, 409);
  assert.deepEqual(rejected.body.allowedActions, ["resolve_user_input"]);
  assert.equal(controls[1].action, "unsupported_by_task");
});

test("generic background tasks reject DELETE in favor of explicit POST actions", async () => {
  const id = "task:12345678-abcd-abcd-abcd-123456789012";
  let controls = 0;
  const ctx = {
    controlBackgroundJob: async () => {
      controls += 1;
      return { ok: true };
    },
  };
  const deleted = await request("DELETE", `/api/background-jobs/${encodeURIComponent(id)}`, undefined, ctx);
  assert.equal(deleted.status, 405);
  assert.match(deleted.body.error, /POST action/i);
  assert.equal(controls, 0);
});

test("background task list keeps legacy array providers compatible", async () => {
  const listed = await request("GET", "/api/background-jobs", undefined, {
    listBackgroundJobs: async () => [{ id: 3, running: true }],
  });
  assert.deepEqual(listed.body, { jobs: [{ id: 3, running: true }], pendingDeliveries: [] });
});

test("background task panel does not reactivate the retired document worker", () => {
  const app = readFileSync(dashboardUrl, "utf8");
  const css = readFileSync(dashboardCssUrl, "utf8");
  const server = readFileSync(serverUrl, "utf8");
  const launcher = readFileSync(launcherUrl, "utf8");
  assert.match(app, /function documentJobStatusLabel/);
  assert.match(app, /function backgroundJobNeedsAttention/);
  assert.match(app, /function documentHandoffNotice/);
  assert.match(app, /legacy_unassigned/);
  assert.match(app, /待处理 \$\{displayJobs\.filter\(\(job\) => backgroundJobGroup\(job\) === "attention"\)\.length\}/);
  assert.match(app, /运行中 \$\{displayJobs\.filter\(\(job\) => backgroundJobGroup\(job\) === "active"\)\.length\} · 待处理/);
  assert.match(app, /function documentJobProgressLabel/);
  assert.match(app, /documentJobStageLabel/);
  assert.match(app, /已完成，需复核/);
  assert.match(app, /内容已完成，等待交付/);
  assert.match(app, /提交已保存草稿/);
  assert.match(app, /documentRetryLabel/);
  assert.match(app, /retryDocumentDelivery/);
  assert.match(app, /只重新交付已有结果，不会重新处理文档/);
  assert.match(app, /需要复核的原因/);
  assert.match(app, /modelIssues/);
  assert.match(app, /background-jobs-workbench/);
  assert.match(app, /class="background-jobs-layout"/);
  assert.match(app, /class="background-jobs-list"/);
  assert.match(app, /class="background-jobs-detail"/);
  assert.match(app, /class="background-jobs-header"/);
  assert.match(app, /class="background-jobs-close"/);
  assert.match(app, /<span>返回对话<\/span>/);
  assert.match(app, /const closeBackgroundWorkbench = q2/);
  assert.match(app, /const backgroundJobDetailRequestRef = A2\(0\)/);
  assert.match(app, /const detailMatchesSelection = detail && String\(detail\.id \?\? ""\) === String\(selectedId \?\? ""\)/);
  assert.match(app, /const requestId = \+\+backgroundJobDetailRequestRef\.current;[\s\S]*?setBackgroundJobDetail\(null\);[\s\S]*?requestId !== backgroundJobDetailRequestRef\.current/);
  assert.match(app, /window\.addEventListener\("keydown", onEscape\)/);
  assert.match(app, /<div class="chat-input-area" style=/);
  assert.doesNotMatch(app, /chat-input-area-background-hidden/);
  assert.doesNotMatch(app, /display:flex;flex-wrap:wrap;overflow:hidden/);
  assert.match(css, /\.background-jobs-layout\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(220px, 290px\) minmax\(0, 1fr\);[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.background-jobs-close\s*\{[\s\S]*?min-width:\s*104px;[\s\S]*?min-height:\s*36px;/);
  assert.match(css, /\.background-jobs-list\s*,\s*\n?\.background-jobs-detail\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?scrollbar-gutter:\s*stable;/);
  assert.match(css, /\.background-jobs-detail\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?padding:\s*16px 18px;/);
  assert.match(css, /@media\s*\(max-width:\s*720px\) and \(min-height:\s*760px\)[\s\S]*?\.background-jobs-layout\s*\{[\s\S]*?grid-template-rows:\s*minmax\(72px, 32%\) minmax\(0, 1fr\);/);
  assert.match(app, /onControl\(selected\.id, "pause"\)/);
  assert.match(
    app,
    /catch \(err\) \{[\s\S]{0,500}await refreshBackgroundJobs\(\);[\s\S]{0,700}api\(`\/background-jobs\/\$\{encodeURIComponent\(id\)\}`\)[\s\S]{0,500}setError\(err\.message\)/,
    "a 409/control failure must refresh the list and current detail before showing the error",
  );
  assert.match(app, /"missing", "modified"/);
  assert.match(app, /"source_changed", "awaiting_output"/);
  assert.match(app, /另存后台草稿/);
  assert.match(app, /自动使用新文件名/);
  assert.match(app, /立即停止/);
  assert.match(app, /放弃任务会终止后续处理/);
  assert.match(app, /仅删除任务记录和中间草稿/);
  assert.match(app, /备用候选/);
  assert.doesNotMatch(app, /bottom:100%;right:0;width:420px;max-height:280px/);
  assert.match(app, /encodeURIComponent\(id\)/);
  assert.match(app, /progress\.percent/);
  assert.match(app, /"job-timeout": "本次执行总时限已到"/);
  assert.match(app, /"job-call-budget": "本次执行调用预算已用尽"/);
  assert.match(app, /executionModelCalls/);
  assert.match(app, /taskModelCallLimit/);
  assert.match(app, /detail\?\.job\?\.preview/);
  assert.match(app, /!\["missing", "modified"\]\.includes\(job\?\.artifactStatus\)/);
  assert.match(app, /当前还没有可预览的已完成区块/);
  assert.match(server, /request\.expectedRevision/);
  assert.match(server, /generic background jobs require an explicit POST action/);
  assert.match(launcher, /listBackgroundJobs: async \(\) => \(\{ jobs: jobs\.listMetadata\(\), pendingDeliveries: \[\] \}\)/);
  assert.doesNotMatch(launcher, /documentMarkdownManager|documentHandoffCoordinator|createDocumentMarkdownManager/);
  assert.doesNotMatch(launcher, /get_document_job_status|organize_document_to_markdown|organize_pdf_to_markdown/);
  assert.match(launcher, /registerShellTools\(tools/);
  assert.match(launcher, /当前会话上下文清理失败/);
  assert.match(launcher, /new CacheFirstLoop\(/);
  assert.match(launcher, /for await \(const ev of loop\.step\(loopInput\)\)/);
});
