import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { createKnowledgeDocumentsApi, startKnowledgeAwareDashboardServer } from "./knowledge-documents.mjs";

const { checkAuth } = await import("../visionox-pkg/dist/cli/server-XGDBRWMB.js");

const TOKEN = "test-token-0123456789abcdef";
const servers = [];
const fixtureRoots = [];

afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function createServerFixture({
  pdfText = "server pdf text",
  extractPdfText = null,
  updateSemanticIndex = null,
  pdfTimeoutMs = 60_000,
  maxUploadBytes = 25 * 1024 * 1024,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "visionox-kd-server-"));
  fixtureRoots.push(root);
  const workspace = join(root, "workspace");
  mkdirSync(workspace, { recursive: true });
  let dirtyFlag = false;
  let reindexCount = 0;
  const runtime = {
    paths: (ws) => ({ projectRoot: ws, root: join(ws, "knowledge") }),
    readManifest: () => ({ indexDirty: dirtyFlag, readOnlyError: null }),
    setIndexDirty: (ws, dirty) => { dirtyFlag = dirty === true; },
    writeKnowledgeFile: (target, content) => {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
    },
    updateSemanticIndex: updateSemanticIndex ?? (async () => {
      reindexCount += 1;
      return { requested: true, status: "completed" };
    }),
  };
  const api = createKnowledgeDocumentsApi({
    knowledgeRuntime: runtime,
    getCurrentCwd: () => workspace,
    getIndexConfig: () => ({ maxFileBytes: 256 * 1024, includeKnowledgeDocs: true }),
    extractPdfText: extractPdfText ?? (async () => pdfText),
    pdfTimeoutMs,
  });
  const upstreamCalls = [];
  const dispatch = async (req, res) => {
    upstreamCalls.push(`${req.method} ${req.url}`);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ upstream: true }));
  };
  const server = await startKnowledgeAwareDashboardServer({
    dispatch,
    checkAuth,
    knowledgeDocumentsApi: api,
    knowledgeDocumentsMaxUploadBytes: maxUploadBytes,
    ctx: {},
    opts: { port: 0, host: "127.0.0.1", token: TOKEN },
  });
  servers.push(server);
  return {
    workspace,
    api,
    upstreamCalls,
    getReindexCount: () => reindexCount,
    base: `http://127.0.0.1:${server.port}`,
  };
}

const authHeaders = () => ({ "X-Reasonix-Token": TOKEN });

describe("startKnowledgeAwareDashboardServer", () => {
  test("rejects unauthenticated GET and mutation requests like upstream", async () => {
    const { base } = await createServerFixture();
    const noToken = await fetch(`${base}/api/knowledge/documents`);
    assert.equal(noToken.status, 401);
    const queryOnlyMutation = await fetch(`${base}/api/knowledge/documents?name=a.md&token=${TOKEN}`, {
      method: "POST",
      body: Buffer.from("x"),
    });
    assert.equal(queryOnlyMutation.status, 403); // mutations require the header (CSRF defence)
    const badToken = await fetch(`${base}/api/knowledge/documents`, { headers: { "X-Reasonix-Token": "wrong" } });
    assert.equal(badToken.status, 401);
  });

  test("serves list/upload/delete/reindex over HTTP with the header token", async () => {
    const { base, workspace, api, getReindexCount } = await createServerFixture();

    const emptyList = await (await fetch(`${base}/api/knowledge/documents`, { headers: authHeaders() })).json();
    assert.deepEqual(emptyList.documents, []);
    assert.equal(emptyList.includeKnowledgeDocs, true);

    const uploadMd = await fetch(`${base}/api/knowledge/documents?name=${encodeURIComponent("会议 记录.md")}`, {
      method: "POST",
      headers: authHeaders(),
      body: Buffer.from("# 会议纪要\n\n第一条", "utf8"),
    });
    assert.equal(uploadMd.status, 201);
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "会议 记录.md"), "utf8"), "# 会议纪要\n\n第一条");

    const uploadPdf = await fetch(`${base}/api/knowledge/documents?name=doc.pdf`, {
      method: "POST",
      headers: authHeaders(),
      body: Buffer.from("%PDF-1.4 fake"),
    });
    assert.equal(uploadPdf.status, 201);
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "doc.md"), "utf8"), "server pdf text");
    assert.ok(existsSync(join(workspace, "knowledge", "uploads", "_raw", "doc.pdf")));

    const list = await (await fetch(`${base}/api/knowledge/documents`, { headers: authHeaders() })).json();
    assert.deepEqual(list.documents.map((doc) => doc.name).sort(), ["doc.md", "会议 记录.md"].sort());
    assert.equal(list.indexDirty, true);

    const reindex = await fetch(`${base}/api/knowledge/documents/reindex`, { method: "POST", headers: authHeaders() });
    assert.equal(reindex.status, 202);
    const reindexBody = await reindex.json();
    const jobStatus = await fetch(`${base}/api/knowledge/documents/reindex/${reindexBody.jobId}`, { headers: authHeaders() });
    assert.equal(jobStatus.status, 200);
    assert.equal((await jobStatus.json()).job.jobId, reindexBody.jobId);
    await api.whenIdle();
    assert.equal(getReindexCount(), 1);

    const listed = await (await fetch(`${base}/api/knowledge/documents`, { headers: authHeaders() })).json();
    const meeting = listed.documents.find((document) => document.name === "会议 记录.md");
    const del = await fetch(`${base}/api/knowledge/documents/${encodeURIComponent(meeting.documentId)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    assert.equal(del.status, 200);
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "会议 记录.md")));
  });

  test("returns structured API errors and cancels an active reindex job", async () => {
    let releaseBuild;
    const buildGate = new Promise((resolvePromise) => { releaseBuild = resolvePromise; });
    const { base } = await createServerFixture({
      updateSemanticIndex: async (_task, signal) => {
        await Promise.race([
          buildGate,
          new Promise((resolvePromise) => signal.addEventListener("abort", resolvePromise, { once: true })),
        ]);
        if (signal.aborted) throw Object.assign(new Error("cancelled"), { name: "AbortError" });
        return { requested: true, status: "completed" };
      },
    });
    const invalid = await fetch(`${base}/api/knowledge/documents?name=bad.docx`, {
      method: "POST",
      headers: authHeaders(),
      body: Buffer.from("x"),
    });
    assert.equal(invalid.status, 400);
    const invalidBody = await invalid.json();
    assert.equal(invalidBody.code, "knowledge_document_invalid_name");
    assert.equal(invalidBody.error, invalidBody.message);
    assert.ok(invalidBody.action);

    const started = await fetch(`${base}/api/knowledge/documents/reindex`, { method: "POST", headers: authHeaders() });
    const startedBody = await started.json();
    const cancelled = await fetch(`${base}/api/knowledge/documents/reindex/${startedBody.jobId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).cancelled, true);
    releaseBuild();
  });

  test("returns a structured 413 instead of resetting an oversized upload connection", async () => {
    const { base } = await createServerFixture({ maxUploadBytes: 4 });
    const response = await fetch(`${base}/api/knowledge/documents?name=large.md`, {
      method: "POST",
      headers: authHeaders(),
      body: Buffer.from("too large"),
    });
    assert.equal(response.status, 413);
    const body = await response.json();
    assert.equal(body.code, "knowledge_document_too_large");
    assert.equal(body.error, body.message);
    assert.equal(body.details.maxUploadBytes, 4);
  });

  test("rejects a stale workspace fingerprint before an HTTP mutation", async () => {
    const { base, workspace } = await createServerFixture();
    const response = await fetch(`${base}/api/knowledge/documents?name=stale.md`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "X-Visionox-Workspace-Fingerprint": "sha256:stale-workspace",
        "X-Visionox-Request-Id": "request-stale-workspace",
      },
      body: Buffer.from("must not be written"),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, "knowledge_workspace_changed");
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "stale.md")));
  });

  test("aborts pdf extraction when the client disconnects and leaves no files", async () => {
    let extractorStarted;
    const started = new Promise((resolvePromise) => { extractorStarted = resolvePromise; });
    let abortObserved = false;
    const { base, workspace } = await createServerFixture({
      extractPdfText: async (_bytes, { signal } = {}) => {
        extractorStarted();
        return new Promise((resolvePromise) => {
          signal?.addEventListener("abort", () => {
            abortObserved = true;
            resolvePromise("cancelled late result");
          }, { once: true });
          setTimeout(() => resolvePromise("late result"), 100).unref();
        });
      },
    });
    const controller = new AbortController();
    const request = fetch(`${base}/api/knowledge/documents?name=cancel.pdf`, {
      method: "POST",
      headers: authHeaders(),
      body: Buffer.from("%PDF-fake"),
      signal: controller.signal,
    }).catch(() => null);
    await started;
    controller.abort();
    await request;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
    assert.equal(abortObserved, true);
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "cancel.md")));
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "_raw", "cancel.pdf")));
  });

  test("falls through to the upstream dispatch for every other path", async () => {
    const { base, upstreamCalls } = await createServerFixture();
    const api = await (await fetch(`${base}/api/semantic`, { headers: authHeaders() })).json();
    assert.deepEqual(api, { upstream: true });
    const page = await fetch(`${base}/?token=${TOKEN}`);
    assert.equal(page.status, 200);
    assert.deepEqual(upstreamCalls, ["GET /api/semantic", "GET /?token=" + TOKEN]);
  });
});
