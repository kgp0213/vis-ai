import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const dashboardUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
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

test("document background API supports string ids and lifecycle actions", async () => {
  const id = "document:12345678-abcd-abcd-abcd-123456789012";
  const actions = [];
  const ctx = {
    listBackgroundJobs: async () => [{ id, kind: "document", running: true, status: "running" }],
    getBackgroundJob: async (value) => value === id ? { id, kind: "document" } : null,
    controlBackgroundJob: async (value, action) => {
      actions.push([value, action]);
      return { ok: true, id: value, action };
    },
    stopBackgroundJob: async (value) => ({ id: value, cancelled: true }),
  };

  const listed = await request("GET", "/api/background-jobs", undefined, ctx);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.jobs[0].kind, "document");
  const detail = await request("GET", `/api/background-jobs/${encodeURIComponent(id)}`, undefined, ctx);
  assert.equal(detail.status, 200);
  for (const action of ["pause", "resume", "retry", "stop", "abandon"]) {
    const response = await request("POST", `/api/background-jobs/${encodeURIComponent(id)}`, { action }, ctx);
    assert.equal(response.status, 200);
  }
  const deleted = await request("DELETE", `/api/background-jobs/${encodeURIComponent(id)}`, undefined, ctx);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.action, "delete");
  assert.deepEqual(actions, [[id, "pause"], [id, "resume"], [id, "retry"], [id, "stop"], [id, "abandon"], [id, "delete"]]);
});

test("background task panel controls and previews resumable document jobs", () => {
  const app = readFileSync(dashboardUrl, "utf8");
  const server = readFileSync(serverUrl, "utf8");
  const launcher = readFileSync(launcherUrl, "utf8");
  assert.match(app, /function documentJobStatusLabel/);
  assert.match(app, /function documentJobProgressLabel/);
  assert.match(app, /documentJobStageLabel/);
  assert.match(app, /已完成，需复核/);
  assert.match(app, /documentRetryLabel/);
  assert.match(app, /余额\/额度处理后重试/);
  assert.match(app, /需要复核的原因/);
  assert.match(app, /modelIssues/);
  assert.match(app, /background-jobs-workbench/);
  assert.match(app, /onControl\(selected\.id, "pause"\)/);
  assert.match(app, /onControl\(selected\.id, "resume"\)/);
  assert.match(app, /onControl\(selected\.id, "retry"\)/);
  assert.match(app, /立即停止/);
  assert.match(app, /放弃任务会终止后续处理/);
  assert.match(app, /仅删除任务记录和中间草稿/);
  assert.match(app, /备用候选/);
  assert.doesNotMatch(app, /bottom:100%;right:0;width:420px;max-height:280px/);
  assert.match(app, /encodeURIComponent\(id\)/);
  assert.match(app, /progress\.percent/);
  assert.match(app, /detail\?\.job\?\.preview/);
  assert.match(app, /当前还没有可预览的已完成区块/);
  assert.match(server, /parseBody\(body\)\.action/);
  assert.match(server, /\["pause", "resume", "retry", "stop", "cancel", "abandon"\]/);
  assert.match(launcher, /documentMarkdownManager\.listMetadata/);
  assert.match(launcher, /documentMarkdownManager\?\.control\(id, action\)/);
  assert.match(launcher, /后台文档已生成但需要复核/);
  assert.match(launcher, /job\.modelIssues/);
});
