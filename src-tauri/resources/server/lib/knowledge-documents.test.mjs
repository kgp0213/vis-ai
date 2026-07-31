import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { createKnowledgeRuntime } from "./knowledge-runtime.mjs";
import { createKnowledgeDocumentCatalog } from "./knowledge-document-catalog.mjs";
import {
  createKnowledgeDocumentsApi,
  createPdfJsTextExtractor,
  sanitizeUploadName,
} from "./knowledge-documents.mjs";

const fixtureRoots = [];
afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createFixture({
  indexConfig = {},
  pdfText = "extracted pdf text",
  pdfError = null,
  maxUploadBytes,
  cwd = null,
  autoReindex = false,
  autoReindexDelayMs = 5,
  pdfTimeoutMs,
  maxPdfPages,
  extractPdfText,
  runtimeOverrides = null,
  documentCatalogFactory = null,
  knowledgeIndexCoordinator = null,
  getCurrentCwd = null,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "visionox-knowledge-docs-"));
  fixtureRoots.push(root);
  const workspace = join(root, "workspace");
  mkdirSync(workspace, { recursive: true });
  const configPath = join(root, "config.json");
  let config = {
    semantic: { provider: "ollama", ollama: { baseUrl: "http://localhost:11434", model: "embed-test" } },
    index: {},
  };
  let buildCount = 0;
  let buildGate = null;
  const runtime = createKnowledgeRuntime({
    configPath,
    loadSemanticEmbeddingUserConfig: () => config.semantic,
    registerSemanticSearchTool: async () => true,
    querySemanticGroups: async () => ({ knowledge: [], workspace: [] }),
    buildIndex: async () => {
      buildCount += 1;
      if (buildGate) await buildGate;
      return { committed: true, chunksSkipped: 0, skipBuckets: {} };
    },
    loadIndexConfig: () => ({}),
    readConfig: () => config,
    writeConfig: (next) => { config = next; },
    atomicWriteFile: (target, content) => {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
    },
  });
  if (runtimeOverrides) Object.assign(runtime, runtimeOverrides);
  const documentCatalog = documentCatalogFactory
    ? documentCatalogFactory(runtime, workspace)
    : null;
  const api = createKnowledgeDocumentsApi({
    knowledgeRuntime: runtime,
    getCurrentCwd: getCurrentCwd ?? (() => cwd ?? workspace),
    getIndexConfig: () => ({ maxFileBytes: 256 * 1024, includeKnowledgeDocs: false, ...indexConfig }),
    extractPdfText: extractPdfText ?? (pdfError
      ? async () => { throw new Error(pdfError); }
      : async () => pdfText),
    ...(maxUploadBytes ? { maxUploadBytes } : {}),
    autoReindex,
    autoReindexDelayMs,
    verifyKnowledgeIndex: async () => ({ ok: true }),
    ...(documentCatalog ? { documentCatalog } : {}),
    ...(knowledgeIndexCoordinator ? { knowledgeIndexCoordinator } : {}),
    ...(pdfTimeoutMs ? { pdfTimeoutMs } : {}),
    ...(maxPdfPages ? { maxPdfPages } : {}),
  });
  return {
    root,
    workspace,
    api,
    runtime,
    getConfig: () => config,
    getBuildCount: () => buildCount,
    holdBuild: () => {
      let release;
      buildGate = new Promise((resolvePromise) => { release = resolvePromise; });
      return release;
    },
  };
}

const ROUTE = "/api/knowledge/documents";
const queryOf = (name) => new URLSearchParams({ name });
const upload = (api, name, body) => api.handle({ method: "POST", pathname: ROUTE, query: queryOf(name), body });
const list = (api) => api.handle({ method: "GET", pathname: ROUTE, query: new URLSearchParams(), body: null });
const remove = (api, name) => api.handle({ method: "DELETE", pathname: ROUTE, query: queryOf(name), body: null });
const removeById = (api, documentId) => api.handle({
  method: "DELETE",
  pathname: `${ROUTE}/${encodeURIComponent(documentId)}`,
  query: new URLSearchParams(),
  body: null,
});
const reindex = (api) => api.handle({ method: "POST", pathname: `${ROUTE}/reindex`, query: new URLSearchParams(), body: null });

describe("sanitizeUploadName", () => {
  test("accepts plain names in supported formats", () => {
    assert.equal(sanitizeUploadName("report.pdf").name, "report.pdf");
    assert.equal(sanitizeUploadName("报告 v2.md").name, "报告 v2.md");
    assert.equal(sanitizeUploadName("notes.txt").ext, ".txt");
  });

  test("rejects path separators, dotfiles and traversal", () => {
    for (const name of ["../x.md", "a/b.md", "a\\b.md", ".hidden.md", "..", "."]) {
      assert.ok(sanitizeUploadName(name).error, `expected error for ${name}`);
    }
  });

  test("rejects unsupported formats and enforces required extension", () => {
    assert.ok(sanitizeUploadName("doc.docx").error);
    assert.ok(sanitizeUploadName("noext").error);
    assert.ok(sanitizeUploadName("a.txt", { requireExtension: ".md" }).error);
    assert.equal(sanitizeUploadName("a.md", { requireExtension: ".md" }).name, "a.md");
  });

  test("cleans windows-forbidden characters and trailing dots", () => {
    assert.equal(sanitizeUploadName("we<ir>d.md").name, "we_ir_d.md");
    assert.equal(sanitizeUploadName("x.md.").name, "x.md");
  });
});

describe("createKnowledgeDocumentsApi routing", () => {
  test("matches only the documents route and the reindex subroute", () => {
    const { api } = createFixture();
    assert.ok(api.matches(ROUTE));
    assert.ok(api.matches(`${ROUTE}/`));
    assert.ok(api.matches(`${ROUTE}/reindex`));
    assert.ok(api.matches(`${ROUTE}/document-id`));
    assert.ok(!api.matches("/api/other"));
  });

  test("returns 503 without an attached workspace", async () => {
    const { api } = createFixture({ cwd: "" });
    const result = await list(api);
    assert.equal(result.status, 503);
  });
});

describe("uploads", () => {
  test("returns structured validation errors without losing the legacy error field", async () => {
    const { api } = createFixture();
    const result = await upload(api, "bad.docx", Buffer.from("x"));
    assert.equal(result.status, 400);
    assert.equal(result.body.error, result.body.message);
    assert.equal(result.body.code, "knowledge_document_invalid_name");
    assert.equal(result.body.retryable, false);
    assert.ok(result.body.title);
    assert.ok(result.body.action);
    assert.deepEqual(result.body.details, {});
  });

  test("uploads .md into knowledge/uploads without a _raw copy and marks the index dirty", async () => {
    const { api, workspace, runtime } = createFixture();
    const result = await upload(api, "notes.md", Buffer.from("# 标题\n\n正文内容", "utf8"));
    assert.equal(result.status, 201);
    assert.equal(result.body.renamed, false);
    assert.ok(result.body.workspaceFingerprint);
    const target = join(workspace, "knowledge", "uploads", "notes.md");
    assert.equal(readFileSync(target, "utf8"), "# 标题\n\n正文内容");
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "_raw")));
    assert.equal(runtime.readManifest(workspace).indexDirty, true);
  });

  test("renames duplicate uploads with a numeric suffix", async () => {
    const { api, workspace } = createFixture();
    await upload(api, "notes.md", Buffer.from("first", "utf8"));
    const second = await upload(api, "notes.md", Buffer.from("second", "utf8"));
    assert.equal(second.status, 201);
    assert.equal(second.body.renamed, true);
    assert.equal(second.body.document.name, "notes-2.md");
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "notes.md"), "utf8"), "first");
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "notes-2.md"), "utf8"), "second");
  });

  test("treats final markdown names as case-insensitive and never overwrites", async () => {
    const { api, workspace } = createFixture();
    await upload(api, "Report.md", Buffer.from("first", "utf8"));
    const second = await upload(api, "report.md", Buffer.from("second", "utf8"));
    assert.equal(second.status, 201);
    assert.equal(second.body.renamed, true);
    assert.equal(second.body.document.name, "report-2.md");
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "Report.md"), "utf8"), "first");
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "report-2.md"), "utf8"), "second");
  });

  test("renames duplicate converted uploads by their final markdown target", async () => {
    const { api, workspace } = createFixture();
    const first = await upload(api, "data.txt", Buffer.from("first", "utf8"));
    const second = await upload(api, "data.txt", Buffer.from("second", "utf8"));
    assert.equal(first.body.document.name, "data.md");
    assert.equal(second.body.document.name, "data-2.md");
    assert.equal(second.body.renamed, true);
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "data.md"), "utf8"), "first");
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "data-2.md"), "utf8"), "second");
    assert.deepEqual(
      readdirSync(join(workspace, "knowledge", "uploads", "_raw")).sort(),
      ["data-2.txt", "data.txt"],
    );
  });

  test("does not overwrite markdown when txt and pdf source names share a basename", async () => {
    const { api, workspace } = createFixture({ pdfText: "pdf version" });
    const text = await upload(api, "report.txt", Buffer.from("text version", "utf8"));
    const pdf = await upload(api, "report.pdf", Buffer.from("%PDF-fake", "utf8"));
    assert.equal(text.body.document.name, "report.md");
    assert.equal(pdf.body.document.name, "report-2.md");
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "report.md"), "utf8"), "text version");
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "report-2.md"), "utf8"), "pdf version");
  });

  test("does not overwrite an existing markdown upload with a converted source", async () => {
    const { api, workspace } = createFixture();
    await upload(api, "notes.md", Buffer.from("markdown", "utf8"));
    const converted = await upload(api, "notes.txt", Buffer.from("text", "utf8"));
    assert.equal(converted.body.document.name, "notes-2.md");
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "notes.md"), "utf8"), "markdown");
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "notes-2.md"), "utf8"), "text");
  });

  test("uploads .txt with a _raw copy and strips a UTF-8 BOM", async () => {
    const { api, workspace } = createFixture();
    const result = await upload(api, "data.txt", Buffer.from("﻿hello txt", "utf8"));
    assert.equal(result.status, 201);
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "data.md"), "utf8"), "hello txt");
    const raw = readFileSync(join(workspace, "knowledge", "uploads", "_raw", "data.txt"));
    assert.equal(raw[0], 0xef); // original bytes preserved verbatim
  });

  test("cleans the exact raw file when markdown persistence fails", async () => {
    const { api, workspace } = createFixture({
      runtimeOverrides: {
        writeKnowledgeFile: () => { throw new Error("markdown write failed"); },
      },
    });
    const result = await upload(api, "partial.txt", Buffer.from("text"));
    assert.equal(result.status, 500);
    assert.equal(result.body.code, "knowledge_document_upload_failed");
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "partial.md")));
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "_raw", "partial.txt")));
  });

  test("cleans created files when catalog persistence fails", async () => {
    const { api, workspace } = createFixture({
      documentCatalogFactory: (runtime) => {
        const catalog = createKnowledgeDocumentCatalog({ knowledgeRuntime: runtime });
        return {
          ...catalog,
          commitUpload: () => { throw new Error("catalog write failed"); },
        };
      },
    });
    const result = await upload(api, "catalog.txt", Buffer.from("text"));
    assert.equal(result.status, 500);
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "catalog.md")));
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "_raw", "catalog.txt")));
  });

  test("keeps catalog revision authoritative when legacy dirty persistence fails", async () => {
    const { api } = createFixture({
      runtimeOverrides: {
        setIndexDirty: () => { throw new Error("manifest read-only"); },
      },
    });
    const uploaded = await upload(api, "warning.md", Buffer.from("text"));
    assert.equal(uploaded.status, 201);
    assert.match(uploaded.body.warning, /目录已保留待重建状态/);
    assert.equal(uploaded.body.contentRevision, 1);
    const state = await list(api);
    assert.equal(state.body.contentRevision, 1);
    assert.equal(state.body.indexDirty, true);
  });

  test("keeps committed files when automatic index scheduling fails", async () => {
    const { api, workspace } = createFixture({
      autoReindex: true,
      knowledgeIndexCoordinator: {
        schedule: () => { throw new Error("job state is read-only"); },
      },
    });
    const uploaded = await upload(api, "durable.txt", Buffer.from("durable content"));
    assert.equal(uploaded.status, 201);
    assert.match(uploaded.body.warning, /自动索引调度失败/);
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "durable.md"), "utf8"), "durable content");
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "_raw", "durable.txt"), "utf8"), "durable content");
    const state = await list(api);
    assert.equal(state.body.documents.length, 1);
    assert.equal(state.body.indexDirty, true);
  });

  test("rejects a stale workspace fingerprint before writing files", async () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-knowledge-switch-"));
    fixtureRoots.push(root);
    const workspaceA = join(root, "a");
    const workspaceB = join(root, "b");
    mkdirSync(workspaceA, { recursive: true });
    mkdirSync(workspaceB, { recursive: true });
    let activeWorkspace = workspaceA;
    const { api } = createFixture({ getCurrentCwd: () => activeWorkspace });
    const initial = await list(api);
    activeWorkspace = workspaceB;
    const result = await api.handle({
      method: "POST",
      pathname: ROUTE,
      query: queryOf("wrong-workspace.md"),
      body: Buffer.from("must not be written"),
      workspaceFingerprint: initial.body.workspaceFingerprint,
      requestId: "request-stale-workspace",
    });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, "knowledge_workspace_changed");
    assert.ok(!existsSync(join(workspaceB, "knowledge", "uploads", "wrong-workspace.md")));
  });

  test("rejects a raw directory junction that resolves outside the workspace", async () => {
    const { api, root, workspace } = createFixture();
    const uploads = join(workspace, "knowledge", "uploads");
    const outside = join(root, "outside-raw");
    mkdirSync(uploads, { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(uploads, "_raw"), process.platform === "win32" ? "junction" : "dir");
    const result = await upload(api, "escape.txt", Buffer.from("outside write"));
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "knowledge_directory_unavailable");
    assert.ok(!existsSync(join(outside, "escape.txt")));
  });

  test("does not persist a non-PDF upload after its request is cancelled", async () => {
    const { api, workspace } = createFixture();
    const controller = new AbortController();
    controller.abort();
    const result = await api.handle({
      method: "POST",
      pathname: ROUTE,
      query: queryOf("cancelled.txt"),
      body: Buffer.from("cancelled content"),
      signal: controller.signal,
    });
    assert.equal(result.status, 499);
    assert.equal(result.body.code, "knowledge_document_upload_cancelled");
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "cancelled.md")));
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "_raw", "cancelled.txt")));
  });

  test("rejects non UTF-8 text with 415", async () => {
    const { api } = createFixture();
    const result = await upload(api, "gbk.txt", Buffer.from([0xd6, 0xd0, 0xce, 0xc4]));
    assert.equal(result.status, 415);
  });

  test("extracts pdf text into .md and keeps the original under _raw", async () => {
    const { api, workspace } = createFixture({ pdfText: "PDF 正文 第二页" });
    const payload = Buffer.from("%PDF-1.4 fake-bytes", "utf8");
    const result = await upload(api, "doc.pdf", payload);
    assert.equal(result.status, 201);
    assert.equal(readFileSync(join(workspace, "knowledge", "uploads", "doc.md"), "utf8"), "PDF 正文 第二页");
    assert.deepEqual(readFileSync(join(workspace, "knowledge", "uploads", "_raw", "doc.pdf")), payload);
  });

  test("persists pdf page boundaries and page-to-line provenance", async () => {
    const { api, workspace } = createFixture({
      extractPdfText: async () => ({
        text: "## Page 1\n\nfirst page\n\n## Page 2\n\nsecond page",
        pageMap: [
          { pageNumber: 1, startLine: 1, endLine: 3 },
          { pageNumber: 2, startLine: 5, endLine: 7 },
        ],
      }),
    });
    const result = await upload(api, "paged.pdf", Buffer.from("%PDF-fake"));
    assert.equal(result.status, 201);
    assert.equal(result.body.document.pageMap.length, 2);
    assert.match(readFileSync(join(workspace, "knowledge", "uploads", "paged.md"), "utf8"), /## Page 2/);
  });

  test("times out pdf extraction without writing partial files", async () => {
    const { api, workspace } = createFixture({
      pdfTimeoutMs: 5,
      extractPdfText: async () => new Promise(() => {}),
    });
    const result = await upload(api, "slow.pdf", Buffer.from("%PDF-fake"));
    assert.equal(result.status, 422);
    assert.match(result.body.error, /超时/);
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "slow.md")));
  });

  test("serializes concurrent pdf extraction", async () => {
    let active = 0;
    let maxActive = 0;
    const { api } = createFixture({
      extractPdfText: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
        active -= 1;
        return "pdf text";
      },
    });
    const [first, second] = await Promise.all([
      upload(api, "one.pdf", Buffer.from("%PDF-one")),
      upload(api, "two.pdf", Buffer.from("%PDF-two")),
    ]);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(maxActive, 1);
  });

  test("cancels a queued pdf request without waiting for the active extraction", async () => {
    let releaseFirst;
    let firstStarted;
    const gate = new Promise((resolvePromise) => { releaseFirst = resolvePromise; });
    const started = new Promise((resolvePromise) => { firstStarted = resolvePromise; });
    const { api, workspace } = createFixture({
      extractPdfText: async (bytes) => {
        if (Buffer.from(bytes).toString().includes("first")) {
          firstStarted();
          await gate;
        }
        return "pdf text";
      },
    });
    const first = upload(api, "first.pdf", Buffer.from("%PDF-first"));
    await started;
    const controller = new AbortController();
    const second = api.handle({
      method: "POST",
      pathname: ROUTE,
      query: queryOf("second.pdf"),
      body: Buffer.from("%PDF-second"),
      signal: controller.signal,
    });
    controller.abort();
    let cancelled;
    try {
      cancelled = await Promise.race([
        second,
        new Promise((_, rejectPromise) => setTimeout(() => rejectPromise(new Error("queued cancellation stalled")), 25)),
      ]);
    } finally {
      releaseFirst();
      await first;
    }
    assert.equal(cancelled.status, 499);
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "second.md")));
  });

  test("rejects scanned PDFs (no text layer) without writing anything or marking dirty", async () => {
    const { api, workspace, runtime } = createFixture({ pdfText: "   \n  " });
    const result = await upload(api, "scan.pdf", Buffer.from("%PDF-fake"));
    assert.equal(result.status, 422);
    assert.match(result.body.error, /无可提取文本/);
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads")));
    assert.equal(runtime.readManifest(workspace).indexDirty, false);
  });

  test("surfaces extractor failures as 422", async () => {
    const { api } = createFixture({ pdfError: "encrypted payload" });
    const result = await upload(api, "locked.pdf", Buffer.from("%PDF-fake"));
    assert.equal(result.status, 422);
    assert.match(result.body.error, /PDF 解析失败/);
  });

  test("rejects markdown larger than maxFileBytes with an actionable message", async () => {
    const { api, workspace } = createFixture({ indexConfig: { maxFileBytes: 16 } });
    const result = await upload(api, "big.md", Buffer.from("x".repeat(64), "utf8"));
    assert.equal(result.status, 413);
    assert.match(result.body.error, /maxFileBytes/);
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads")));
  });

  test("rejects bodies above the upload cap", async () => {
    const { api } = createFixture({ maxUploadBytes: 4 });
    const result = await upload(api, "big.md", Buffer.from("0123456789", "utf8"));
    assert.equal(result.status, 413);
  });

  test("rejects unsupported formats and traversal names", async () => {
    const { api } = createFixture();
    assert.equal((await upload(api, "doc.docx", Buffer.from("x"))).status, 400);
    assert.equal((await upload(api, "../../evil.md", Buffer.from("x"))).status, 400);
  });
});

describe("list and delete", () => {
  test("lists uploaded markdown with metadata and index status", async () => {
    const { api } = createFixture();
    await upload(api, "notes.md", Buffer.from("n", "utf8"));
    await upload(api, "data.txt", Buffer.from("d", "utf8"));
    const result = await list(api);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.documents.map((doc) => doc.name), ["data.md", "notes.md"]);
    assert.equal(result.body.includeKnowledgeDocs, false);
    assert.equal(result.body.indexDirty, true);
    assert.equal(result.body.contentRevision, 2);
    assert.equal(result.body.indexedRevision, 0);
    assert.ok(result.body.workspaceFingerprint);
    assert.ok(result.body.documents.every((doc) => doc.documentId));
    assert.ok(result.body.documents.every((doc) => doc.status === "ready" || doc.status === "stale"));
    assert.ok(result.body.documents[0].size > 0);
    assert.ok(result.body.documents[0].updatedAt);
  });

  test("reconciles external markdown changes before exposing retrieval state", async () => {
    const { api, workspace } = createFixture();
    await upload(api, "external.md", Buffer.from("first", "utf8"));
    const before = api.retrievalState(workspace);
    writeFileSync(join(workspace, "knowledge", "uploads", "external.md"), "changed outside api", "utf8");
    const after = api.retrievalState(workspace);
    assert.ok(after.contentRevision > before.contentRevision);
    assert.equal(after.documents[0].status, "stale");
    assert.notEqual(after.documents[0].markdownHash, before.documents[0].markdownHash);
  });

  test("delete removes the markdown product and its _raw original, then marks dirty", async () => {
    const { api, workspace, runtime } = createFixture();
    await upload(api, "data.txt", Buffer.from("d", "utf8"));
    const result = await remove(api, "data.md");
    assert.equal(result.status, 200);
    assert.ok(result.body.workspaceFingerprint);
    assert.equal(result.body.document.documentId, result.body.documentId);
    assert.equal(result.body.document.status, "deleted_pending_index");
    assert.equal(result.body.document.deletedRevision, result.body.contentRevision);
    assert.deepEqual(result.body.removedRaw, ["data.txt"]);
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "data.md")));
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "_raw", "data.txt")));
    assert.equal(runtime.readManifest(workspace).indexDirty, true);
    const listed = await list(api);
    assert.equal(listed.body.documents.length, 0);
    assert.equal(listed.body.deletedDocuments.length, 1);
    assert.equal(listed.body.deletedDocuments[0].status, "deleted_pending_index");
    assert.equal(listed.body.deletedDocuments[0].documentId, result.body.documentId);
  });

  test("delete by document id removes only the exact converted source", async () => {
    const { api, workspace } = createFixture({ pdfText: "pdf version" });
    const text = await upload(api, "report.txt", Buffer.from("text version", "utf8"));
    const pdf = await upload(api, "report.pdf", Buffer.from("%PDF-fake", "utf8"));
    const result = await removeById(api, text.body.document.documentId);
    assert.equal(result.status, 200);
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "report.md")));
    assert.ok(!existsSync(join(workspace, "knowledge", "uploads", "_raw", "report.txt")));
    assert.ok(existsSync(join(workspace, "knowledge", "uploads", "report-2.md")));
    assert.ok(existsSync(join(workspace, "knowledge", "uploads", "_raw", "report-2.pdf")));
    assert.equal(pdf.body.document.name, "report-2.md");
  });

  test("preserves files when catalog tombstone persistence fails", async () => {
    const { api, workspace } = createFixture({
      documentCatalogFactory: (runtime) => {
        const catalog = createKnowledgeDocumentCatalog({ knowledgeRuntime: runtime });
        return {
          ...catalog,
          commitDelete: () => { throw new Error("catalog write failed"); },
        };
      },
    });
    const uploaded = await upload(api, "keep.txt", Buffer.from("keep"));
    const result = await removeById(api, uploaded.body.document.documentId);
    assert.equal(result.status, 500);
    assert.equal(result.body.code, "knowledge_document_delete_failed");
    assert.ok(existsSync(join(workspace, "knowledge", "uploads", "keep.md")));
    assert.ok(existsSync(join(workspace, "knowledge", "uploads", "_raw", "keep.txt")));
  });

  test("rejects catalog paths that escape the knowledge uploads directory", async () => {
    let commitCalled = false;
    const { api, root } = createFixture({
      documentCatalogFactory: (runtime, workspace) => {
        const catalog = createKnowledgeDocumentCatalog({ knowledgeRuntime: runtime });
        return {
          ...catalog,
          find: () => ({
            catalog: catalog.read(workspace),
            matches: [{
              documentId: "unsafe-document",
              displayName: "outside.md",
              markdownPath: "../outside.md",
              rawPath: null,
            }],
          }),
          commitDelete: () => { commitCalled = true; },
        };
      },
    });
    const outside = join(root, "outside.md");
    writeFileSync(outside, "must stay", "utf8");
    const result = await removeById(api, "unsafe-document");
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "knowledge_document_path_invalid");
    assert.equal(readFileSync(outside, "utf8"), "must stay");
    assert.equal(commitCalled, false);
  });

  test("delete rejects missing documents, traversal and non-markdown names", async () => {
    const { api } = createFixture();
    assert.equal((await remove(api, "missing.md")).status, 404);
    assert.equal((await remove(api, "../x.md")).status, 400);
    assert.equal((await remove(api, "doc.pdf")).status, 400);
  });
});

describe("reindex", () => {
  test("accepts a rebuild, enables knowledge docs and clears the dirty flag", async () => {
    const { api, getConfig, getBuildCount } = createFixture();
    await upload(api, "notes.md", Buffer.from("n", "utf8"));
    const result = await reindex(api);
    assert.equal(result.status, 202);
    assert.ok(result.body.workspaceFingerprint);
    await api.whenIdle();
    assert.equal(getBuildCount(), 1);
    assert.equal(getConfig().index.includeKnowledgeDocs, true);
  });

  test("reuses the active job for concurrent rebuild requests", async () => {
    const { api, holdBuild } = createFixture();
    const release = holdBuild();
    const first = await reindex(api);
    const second = await reindex(api);
    assert.equal(first.status, 202);
    assert.equal(second.status, 202);
    assert.equal(second.body.jobId, first.body.jobId);
    release();
    await api.whenIdle();
  });

  test("automatically rebuilds once after a burst of document mutations", async () => {
    const { api, getBuildCount } = createFixture({ autoReindex: true, autoReindexDelayMs: 5 });
    await upload(api, "one.md", Buffer.from("one", "utf8"));
    await upload(api, "two.md", Buffer.from("two", "utf8"));
    await api.whenIdle();
    assert.equal(getBuildCount(), 1);
    const state = await list(api);
    assert.equal(state.body.indexDirty, false);
    assert.equal(state.body.indexedRevision, state.body.contentRevision);
    assert.equal(state.body.lastJob.status, "completed");
  });

  test("rejects non-POST methods", async () => {
    const { api } = createFixture();
    const result = await api.handle({ method: "GET", pathname: `${ROUTE}/reindex`, query: new URLSearchParams(), body: null });
    assert.equal(result.status, 405);
  });
});

function buildMinimalPdf(text) {
  const stream = `BT /F1 24 Tf 100 700 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

describe("createPdfJsTextExtractor (packaged pdfjs-dist)", () => {
  test("rejects a PDF above the configured page limit before reading pages", async () => {
    const moduleSource = `
      export function getDocument() {
        return {
          destroy() {},
          promise: Promise.resolve({
            numPages: 3,
            getPage() { throw new Error("page read should not start"); },
            async destroy() {}
          })
        };
      }
    `;
    const extractor = await createPdfJsTextExtractor({
      moduleUrl: `data:text/javascript,${encodeURIComponent(moduleSource)}`,
      standardFontDataUrl: "file:///unused/",
    });
    await assert.rejects(
      extractor(Buffer.from("%PDF-fake"), { maxPages: 2 }),
      /PDF 页数 3 超过上限 2/,
    );
  });

  test("extracts text from a real PDF via the packaged module", async (t) => {
    let extractor;
    try {
      extractor = await createPdfJsTextExtractor();
    } catch (error) {
      t.skip(`packaged pdfjs-dist unavailable: ${error.message}`);
      return;
    }
    const result = await extractor(buildMinimalPdf("Hello Knowledge"));
    assert.match(result.text, /## Page 1[\s\S]*Hello Knowledge/);
    assert.deepEqual(result.pageMap.map((item) => item.pageNumber), [1]);
  });
});
