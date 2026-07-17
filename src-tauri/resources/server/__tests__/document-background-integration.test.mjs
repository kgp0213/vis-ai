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
  for (const action of ["pause", "resume", "retry"]) {
    const response = await request("POST", `/api/background-jobs/${encodeURIComponent(id)}`, { action }, ctx);
    assert.equal(response.status, 200);
  }
  assert.deepEqual(actions, [[id, "pause"], [id, "resume"], [id, "retry"]]);
});

test("background task panel controls and previews resumable document jobs", () => {
  const app = readFileSync(dashboardUrl, "utf8");
  const server = readFileSync(serverUrl, "utf8");
  const launcher = readFileSync(launcherUrl, "utf8");
  assert.match(app, /function documentJobStatusLabel/);
  assert.match(app, /function documentJobProgressLabel/);
  assert.match(app, /documentJobStageLabel/);
  assert.match(app, /controlDocumentJob\(job\.id, "pause"\)/);
  assert.match(app, /controlDocumentJob\(job\.id, "resume"\)/);
  assert.match(app, /controlDocumentJob\(job\.id, "retry"\)/);
  assert.match(app, /previewDocumentJob\(job\)/);
  assert.match(app, /回退模型 · /);
  assert.match(app, /encodeURIComponent\(id\)/);
  assert.match(app, /job\.progress\?\.percent/);
  assert.match(app, /detail\?\.job\?\.preview/);
  assert.match(app, /当前还没有可预览的已完成区块/);
  assert.match(server, /parseBody\(body\)\.action/);
  assert.match(server, /\["pause", "resume", "retry", "cancel"\]/);
  assert.match(launcher, /documentMarkdownManager\.listMetadata/);
  assert.match(launcher, /documentMarkdownManager\?\.control\(id, action\)/);
});
