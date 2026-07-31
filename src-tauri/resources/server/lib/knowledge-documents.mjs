import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, realpathSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { basename, dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { atomicWriteFileSync } from "./atomic-file.mjs";
import { createKnowledgeDocumentCatalog } from "./knowledge-document-catalog.mjs";
import { createKnowledgeIndexCoordinator } from "./knowledge-index-coordinator.mjs";

const ROUTE_PREFIX = "/api/knowledge/documents";
const REINDEX_PATH = `${ROUTE_PREFIX}/reindex`;
const UPLOADS_DIR_NAME = "uploads";
const RAW_DIR_NAME = "_raw";
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_TEXT_BYTES = 256 * 1024;
const DEFAULT_PDF_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_PDF_PAGES = 500;
const UPLOAD_NAME_MAX_CHARS = 120;
const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ".pdf"]);
// Built at runtime so no control-character escapes appear in source.
const CONTROL_CHAR_RANGE_RE = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}]`, "g");
let pdfExtractionTail = Promise.resolve();

function requiredFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`knowledge documents ${name} dependency is required`);
  return value;
}

function knowledgeError(status, {
  code,
  title,
  message,
  retryable = false,
  action,
  details = {},
}) {
  return {
    status,
    body: {
      error: message,
      code,
      title,
      message,
      retryable,
      action,
      details,
    },
  };
}

/**
 * Upload filename hygiene. The name travels in a query parameter, so path
 * separators are rejected outright instead of being silently stripped.
 * Returns { name, base, ext } or { error }.
 */
export function sanitizeUploadName(raw, { requireExtension = null } = {}) {
  const original = String(raw ?? "").trim();
  if (!original) return { error: "文件名为空" };
  if (original.includes("/") || original.includes("\\")) return { error: "文件名不能包含路径分隔符" };
  if (original === "." || original === ".." || original.startsWith(".")) return { error: "非法文件名" };
  const cleaned = original
    .replace(/[<>:"|?*]/g, "_")
    .replace(CONTROL_CHAR_RANGE_RE, "_")
    .replace(/[. ]+$/, "");
  if (!cleaned) return { error: "文件名清洗后为空" };
  if (cleaned.length > UPLOAD_NAME_MAX_CHARS) return { error: `文件名过长（上限 ${UPLOAD_NAME_MAX_CHARS} 字符）` };
  const ext = extname(cleaned).toLowerCase();
  const base = cleaned.slice(0, cleaned.length - ext.length);
  if (!base) return { error: "文件名缺少主体部分" };
  if (requireExtension && ext !== requireExtension) {
    return { error: `该操作只接受 ${requireExtension} 文件` };
  }
  if (!requireExtension && !SUPPORTED_EXTENSIONS.has(ext)) {
    return { error: `不支持的格式 ${ext || "(无扩展名)"}，仅支持 .md / .txt / .pdf` };
  }
  return { name: cleaned, base, ext };
}

function uniqueUploadName(existingNames, name, base, ext) {
  const normalizedNames = new Set([...existingNames].map((item) => String(item).toLowerCase()));
  if (!normalizedNames.has(name.toLowerCase())) return { finalName: name, renamed: false };
  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}${ext}`;
    if (!normalizedNames.has(candidate.toLowerCase())) return { finalName: candidate, renamed: true };
  }
}

function decodeUtf8Strict(buffer) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Lazy pdfjs-dist text extractor. pdfjs-dist ships as a packaged resource at
 * server/visionox-pkg/node_modules/pdfjs-dist (see third-party-resources.json),
 * so the module URL resolves relative to this file in both dev and release
 * layouts. Extraction runs without a worker and without canvas (text only).
 * standardFontDataUrl feeds the standard-14 font data, which CJK PDFs rely on.
 */
export async function createPdfJsTextExtractor({ moduleUrl, standardFontDataUrl } = {}) {
  const url = moduleUrl ?? defaultPdfJsModuleUrl();
  const pdfjs = await import(url);
  const fonts = standardFontDataUrl ?? defaultStandardFontDataUrl();
  return async (bytes, { signal, maxPages = DEFAULT_MAX_PDF_PAGES } = {}) => {
    signal?.throwIfAborted?.();
    const data = bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const loadingTask = pdfjs.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      standardFontDataUrl: fonts,
    });
    const abortLoading = () => loadingTask.destroy();
    signal?.addEventListener("abort", abortLoading, { once: true });
    let doc;
    try {
      doc = await loadingTask.promise;
      if (doc.numPages > maxPages) {
        throw new Error(`PDF 页数 ${doc.numPages} 超过上限 ${maxPages}`);
      }
      const sections = [];
      const pageMap = [];
      let nextLine = 1;
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
        signal?.throwIfAborted?.();
        const page = await doc.getPage(pageNumber);
        const content = await page.getTextContent();
        signal?.throwIfAborted?.();
        const section = `## Page ${pageNumber}\n\n${content.items.map((item) => item.str).join(" ")}`;
        const lineCount = section.split("\n").length;
        sections.push(section);
        pageMap.push({ pageNumber, startLine: nextLine, endLine: nextLine + lineCount - 1 });
        nextLine += lineCount + 1;
      }
      return { text: sections.join("\n\n"), pageMap };
    } finally {
      signal?.removeEventListener("abort", abortLoading);
      await doc?.destroy?.();
    }
  };
}

function createAbortError(message, code) {
  const error = new Error(message);
  error.name = "AbortError";
  error.code = code;
  return error;
}

function enqueuePdfExtraction(callback, signal) {
  const previous = pdfExtractionTail.catch(() => {});
  let releaseTurn;
  const turn = new Promise((resolvePromise) => { releaseTurn = resolvePromise; });
  pdfExtractionTail = previous.then(() => turn);
  const waitForTurn = new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      rejectPromise(createAbortError("PDF 解析已取消", "pdf_extraction_cancelled"));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    previous.then(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      resolvePromise();
    });
  });
  return waitForTurn.then(callback).finally(() => releaseTurn());
}

async function runPdfExtraction(extractor, bytes, { signal, timeoutMs, maxPages }) {
  return enqueuePdfExtraction(async () => {
    if (signal?.aborted) throw createAbortError("PDF 解析已取消", "pdf_extraction_cancelled");
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort(signal.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(createAbortError(`PDF 解析超过 ${timeoutMs}ms`, "pdf_extraction_timeout"));
    }, timeoutMs);
    timer.unref?.();
    const aborted = new Promise((resolvePromise, rejectPromise) => {
      controller.signal.addEventListener("abort", () => {
        rejectPromise(timedOut
          ? createAbortError(`PDF 解析超过 ${timeoutMs}ms`, "pdf_extraction_timeout")
          : createAbortError("PDF 解析已取消", "pdf_extraction_cancelled"));
      }, { once: true });
    });
    try {
      return await Promise.race([
        Promise.resolve().then(() => extractor(bytes, { signal: controller.signal, maxPages })),
        aborted,
      ]);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }, signal);
}

function defaultPdfJsModuleUrl() {
  const here = dirname(fileURLToPath(import.meta.url));
  return pathToFileURL(
    resolve(here, "..", "visionox-pkg", "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs"),
  ).href;
}

function defaultStandardFontDataUrl() {
  const here = dirname(fileURLToPath(import.meta.url));
  // pdfjs validates for a trailing forward slash regardless of platform.
  return `${resolve(here, "..", "visionox-pkg", "node_modules", "pdfjs-dist", "standard_fonts")}/`;
}

/**
 * HTTP API for user-driven knowledge documents. Owns upload/list/delete of
 * `<workspace>/knowledge/uploads/` and the reindex trigger. Index building and
 * embedding stay inside the injected knowledgeRuntime — this module never
 * creates a competing model or indexing loop.
 */
export function createKnowledgeDocumentsApi({
  knowledgeRuntime,
  getCurrentCwd,
  getIndexConfig,
  extractPdfText = null,
  maxUploadBytes = DEFAULT_MAX_UPLOAD_BYTES,
  documentCatalog = null,
  knowledgeIndexCoordinator = null,
  getSemanticIndexDir = null,
  verifyKnowledgeIndex = null,
  autoReindex = true,
  autoReindexDelayMs = 1500,
  pdfTimeoutMs = DEFAULT_PDF_TIMEOUT_MS,
  maxPdfPages = DEFAULT_MAX_PDF_PAGES,
} = {}) {
  const runtime = knowledgeRuntime ?? null;
  for (const key of ["paths", "readManifest", "setIndexDirty", "writeKnowledgeFile", "updateSemanticIndex"]) {
    requiredFunction(runtime?.[key], `knowledgeRuntime.${key}`);
  }
  const currentCwd = requiredFunction(getCurrentCwd, "getCurrentCwd");
  const indexConfig = requiredFunction(getIndexConfig, "getIndexConfig");
  const catalog = documentCatalog ?? createKnowledgeDocumentCatalog({ knowledgeRuntime: runtime });
  const indexCoordinator = knowledgeIndexCoordinator ?? createKnowledgeIndexCoordinator({
    catalog,
    updateSemanticIndex: (task, signal) => runtime.updateSemanticIndex(task, signal),
    getIndexDir: getSemanticIndexDir,
    verifyIndex: verifyKnowledgeIndex,
    setIndexDirty: (workspace, dirty) => runtime.setIndexDirty(workspace, dirty),
    debounceMs: autoReindexDelayMs,
  });
  const mutationQueues = new Map();
  const recoveredWorkspaces = new Set();
  let pdfExtractorPromise = null;

  function loadPdfExtractor() {
    if (extractPdfText) return Promise.resolve(extractPdfText);
    pdfExtractorPromise ??= createPdfJsTextExtractor().catch((error) => {
      pdfExtractorPromise = null;
      throw error;
    });
    return pdfExtractorPromise;
  }

  function matches(pathname) {
    const normalized = String(pathname ?? "").replace(/\/+$/, "");
    return normalized === ROUTE_PREFIX || normalized.startsWith(`${ROUTE_PREFIX}/`);
  }

  function enqueueMutation(workspace, callback) {
    const key = resolve(workspace).toLowerCase();
    const previous = mutationQueues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(callback);
    mutationQueues.set(key, current);
    return current.finally(() => {
      if (mutationQueues.get(key) === current) mutationQueues.delete(key);
    });
  }

  function workspaceContext(expectedWorkspaceFingerprint = null) {
    const workspace = currentCwd();
    if (!workspace) {
      return { error: knowledgeError(503, {
        code: "knowledge_workspace_required",
        title: "需要工作区",
        message: "知识库文档需要已附加的工作区会话（code-mode）",
        action: "请先附加工作区后重试",
      }) };
    }
    try {
      const knowledgePaths = runtime.paths(workspace);
      const uploadsDir = resolve(knowledgePaths.root, UPLOADS_DIR_NAME);
      const rawDir = resolve(uploadsDir, RAW_DIR_NAME);
      const actualWorkspaceFingerprint = catalog.workspaceFingerprint(workspace);
      if (expectedWorkspaceFingerprint && expectedWorkspaceFingerprint !== actualWorkspaceFingerprint) {
        return { error: knowledgeError(409, {
          code: "knowledge_workspace_changed",
          title: "工作区已切换",
          message: "知识库请求所属工作区已经变化，操作未执行",
          retryable: true,
          action: "刷新知识库列表后重试",
          details: {
            expectedWorkspaceFingerprint,
            actualWorkspaceFingerprint,
          },
        }) };
      }
      assertInsideWorkspace(knowledgePaths.projectRoot, uploadsDir);
      assertInsideWorkspace(knowledgePaths.projectRoot, rawDir);
      const recoveryKey = resolve(workspace).toLowerCase();
      if (!recoveredWorkspaces.has(recoveryKey)) {
        if (existsSync(catalog.locations(workspace).catalogPath)) catalog.recoverInterrupted(workspace);
        recoveredWorkspaces.add(recoveryKey);
      }
      return { workspace, workspaceFingerprint: actualWorkspaceFingerprint, knowledgePaths, uploadsDir, rawDir };
    } catch (error) {
      return { error: knowledgeError(400, {
        code: "knowledge_directory_unavailable",
        title: "知识目录不可用",
        message: `知识目录不可用：${error.message}`,
        action: "检查当前工作区目录和访问权限后重试",
      }) };
    }
  }

  function assertInsideWorkspace(projectRoot, candidate) {
    const rootReal = realpathSync(projectRoot);
    if (existsSync(candidate)) {
      const candidateReal = realpathSync(candidate);
      if (!(candidateReal === rootReal || candidateReal.startsWith(rootReal + sep))) {
        throw new Error("knowledge uploads directory resolves outside the bound workspace");
      }
    }
  }

  function resolveUploadTarget(uploadsDir, fileName) {
    const target = resolve(uploadsDir, fileName);
    if (!(target === uploadsDir || target.startsWith(uploadsDir + sep))) {
      throw new Error("upload path escapes the knowledge uploads directory");
    }
    return target;
  }

  function resolveCatalogTarget(context, relativePath, { raw = false } = {}) {
    const baseDir = raw ? context.rawDir : context.uploadsDir;
    const target = resolve(context.knowledgePaths.projectRoot, String(relativePath || ""));
    if (!(target === baseDir || target.startsWith(baseDir + sep))) {
      throw Object.assign(new Error("catalog path escapes the knowledge uploads directory"), {
        code: "knowledge_document_path_invalid",
      });
    }
    return target;
  }

  function maxTextBytes() {
    const value = Number(indexConfig()?.maxFileBytes);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_TEXT_BYTES;
  }

  function listDocuments(workspace) {
    const state = catalog.read(workspace);
    return {
      state,
      documents: state.documents
        .map((document) => ({
          ...document,
          name: document.displayName,
          size: document.sizeBytes,
          updatedAt: document.updatedAt,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      deletedDocuments: state.tombstones
        .map((tombstone) => ({
          ...tombstone,
          displayName: tombstone.displayName || basename(tombstone.markdownPath || "deleted.md"),
          name: tombstone.displayName || basename(tombstone.markdownPath || "deleted.md"),
          size: Number(tombstone.sizeBytes || 0),
          status: "deleted_pending_index",
          updatedAt: tombstone.updatedAt || tombstone.deletedAt,
          indexedRevision: 0,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  async function handleList(context) {
    const manifest = runtime.readManifest(context.workspace);
    const config = indexConfig() ?? {};
    const listed = listDocuments(context.workspace);
    return {
      status: 200,
      body: {
        documents: listed.documents,
        deletedDocuments: listed.deletedDocuments,
        workspaceFingerprint: listed.state.workspaceFingerprint,
        contentRevision: listed.state.contentRevision,
        indexedRevision: listed.state.indexedRevision,
        activeJob: listed.state.activeJob,
        lastJob: listed.state.lastJob,
        warnings: listed.state.warnings,
        indexDirty: manifest.indexDirty === true || listed.state.contentRevision !== listed.state.indexedRevision,
        manifestReadOnly: Boolean(manifest.readOnlyError),
        includeKnowledgeDocs: config.includeKnowledgeDocs === true,
        maxFileBytes: maxTextBytes(),
        uploadsPath: "knowledge/uploads",
      },
    };
  }

  async function handleUpload(context, query, body, signal = null) {
    if (signal?.aborted) return knowledgeError(499, {
      code: "knowledge_document_upload_cancelled",
      title: "上传已取消",
      message: "知识文档上传已取消，未入库",
      action: "需要时可重新上传",
    });
    const parsedName = sanitizeUploadName(query?.get?.("name"));
    if (parsedName.error) return knowledgeError(400, {
      code: "knowledge_document_invalid_name",
      title: "文件名无效",
      message: parsedName.error,
      action: "请使用 .md、.txt 或 .pdf 文件名后重试",
    });
    if (!body || body.length === 0) return knowledgeError(400, {
      code: "knowledge_document_empty",
      title: "文件内容为空",
      message: "上传内容为空",
      action: "请选择包含内容的文件后重试",
    });
    if (body.length > maxUploadBytes) {
      return knowledgeError(413, {
        code: "knowledge_document_too_large",
        title: "文件过大",
        message: `文件超过上传上限 ${Math.round(maxUploadBytes / 1024 / 1024)}MB`,
        action: "缩小文件后重试",
        details: { maxUploadBytes },
      });
    }

    const { ext, base } = parsedName;
    const limit = maxTextBytes();
    let markdown = null;
    let pageMap = [];
    let rawPayload = null;
    if (ext === ".md" || ext === ".txt") {
      try {
        markdown = decodeUtf8Strict(body);
      } catch {
        return knowledgeError(415, {
          code: "knowledge_document_encoding_unsupported",
          title: "文本编码不受支持",
          message: "文本文件必须是 UTF-8 编码（GBK 等编码请先转换后再上传）",
          action: "将文件转换为 UTF-8 编码后重试",
        });
      }
      if (ext === ".txt") rawPayload = body;
    } else if (ext === ".pdf") {
      let extractor;
      try {
        extractor = await loadPdfExtractor();
      } catch (error) {
        return knowledgeError(422, {
          code: "knowledge_pdf_runtime_unavailable",
          title: "PDF 解析组件不可用",
          message: `PDF 解析组件不可用：${error.message}`,
          retryable: true,
          action: "修复应用运行时资源后重试",
        });
      }
      try {
        const extracted = await runPdfExtraction(extractor, body, {
          signal,
          timeoutMs: pdfTimeoutMs,
          maxPages: maxPdfPages,
        });
        markdown = typeof extracted === "string" ? extracted : extracted?.text;
        pageMap = Array.isArray(extracted?.pageMap) ? extracted.pageMap : [];
      } catch (error) {
        if (error?.code === "pdf_extraction_timeout") {
          return knowledgeError(422, {
            code: "knowledge_pdf_timeout",
            title: "PDF 解析超时",
            message: `PDF 解析超时（上限 ${pdfTimeoutMs}ms），未入库`,
            retryable: true,
            action: "确认文件可读取后重试，或拆分较大的 PDF",
            details: { timeoutMs: pdfTimeoutMs },
          });
        }
        if (error?.code === "pdf_extraction_cancelled" || signal?.aborted) {
          return knowledgeError(499, {
            code: "knowledge_pdf_cancelled",
            title: "PDF 解析已取消",
            message: "PDF 解析已取消，未入库",
            action: "需要时可重新上传",
          });
        }
        return knowledgeError(422, {
          code: "knowledge_pdf_parse_failed",
          title: "PDF 解析失败",
          message: `PDF 解析失败：${String(error?.message || error).slice(0, 200)}`,
          action: "确认 PDF 未加密且具有可提取文本后重试",
        });
      }
      if (!markdown || !markdown.trim()) {
        return knowledgeError(422, {
          code: "knowledge_pdf_text_missing",
          title: "PDF 没有可提取文本",
          message: "该 PDF 无可提取文本（可能是扫描件），未入库",
          action: "请先对扫描件执行 OCR，再上传可检索文本",
        });
      }
      rawPayload = body;
    }
    const markdownBytes = Buffer.byteLength(markdown, "utf8");
    if (markdownBytes > limit) {
      return knowledgeError(413, {
        code: "knowledge_markdown_too_large",
        title: "转换结果过大",
        message: `转换后的 Markdown 为 ${Math.ceil(markdownBytes / 1024)}KB，超过索引单文件上限 ${Math.round(limit / 1024)}KB（maxFileBytes）。请调大语义索引配置的 maxFileBytes 后重试，注意该值对 workspace 索引同样生效`,
        action: "调大 maxFileBytes 或拆分文档后重试",
        details: { markdownBytes, maxFileBytes: limit },
      });
    }

    return enqueueMutation(context.workspace, async () => {
      if (signal?.aborted) return knowledgeError(499, {
        code: "knowledge_document_upload_cancelled",
        title: "上传已取消",
        message: "知识文档上传已取消，未入库",
        action: "需要时可重新上传",
      });
      mkdirSync(context.uploadsDir, { recursive: true });
      assertInsideWorkspace(context.knowledgePaths.projectRoot, context.uploadsDir);
      catalog.read(context.workspace);
      const existing = new Set(readdirSync(context.uploadsDir, { withFileTypes: true })
        .filter((entry) => entry.name.toLowerCase().endsWith(".md"))
        .map((entry) => entry.name));
      const desiredMarkdownName = `${base}.md`;
      const { finalName: markdownName, renamed } = uniqueUploadName(existing, desiredMarkdownName, base, ".md");
      const finalBase = markdownName.slice(0, -3);
      const markdownTarget = resolveUploadTarget(context.uploadsDir, markdownName);
      const rawTarget = rawPayload ? resolveUploadTarget(context.rawDir, `${finalBase}${ext}`) : null;
      let catalogCommitted = false;
      try {
        if (rawPayload) {
          mkdirSync(context.rawDir, { recursive: true });
          assertInsideWorkspace(context.knowledgePaths.projectRoot, context.rawDir);
          assertInsideWorkspace(context.knowledgePaths.projectRoot, rawTarget);
          atomicWriteFileSync(rawTarget, rawPayload, null);
        }
        assertInsideWorkspace(context.knowledgePaths.projectRoot, markdownTarget);
        runtime.writeKnowledgeFile(markdownTarget, markdown);
        const stats = statSync(markdownTarget);
        const committed = catalog.commitUpload(context.workspace, {
          sourceName: parsedName.name,
          sourceType: ext.slice(1),
          displayName: markdownName,
          markdownPath: `knowledge/uploads/${markdownName}`,
          rawPath: rawTarget ? `knowledge/uploads/_raw/${finalBase}${ext}` : null,
          contentHash: createHash("sha256").update(rawPayload ?? Buffer.from(markdown, "utf8")).digest("hex"),
          markdownHash: createHash("sha256").update(markdown, "utf8").digest("hex"),
          parserVersion: ext === ".pdf" ? "pdfjs-v1" : ext === ".txt" ? "utf8-v1" : "markdown-v1",
          pageMap,
          sizeBytes: stats.size,
          mtimeMs: stats.mtimeMs,
          updatedAt: stats.mtime.toISOString(),
        });
        catalogCommitted = true;
        let warning = null;
        try {
          runtime.clearRetrievalCache?.();
        } catch (error) {
          warning = `文档已保存，检索缓存清理失败：${error.message}`;
        }
        try {
          runtime.setIndexDirty(context.workspace, true);
        } catch (error) {
          const dirtyWarning = `文档已保存，旧索引脏标记写入失败，但文档目录已保留待重建状态：${error.message}`;
          warning = warning ? `${warning}；${dirtyWarning}` : dirtyWarning;
        }
        let indexJob = null;
        if (autoReindex) {
          try {
            indexJob = indexCoordinator.schedule(context.workspace);
          } catch (error) {
            const scheduleWarning = `文档已保存，自动索引调度失败，仍保留待重建状态：${error.message}`;
            warning = warning ? `${warning}；${scheduleWarning}` : scheduleWarning;
          }
        }
        return {
          status: 201,
          body: {
            ok: true,
            document: {
              ...committed.document,
              name: markdownName,
              size: markdownBytes,
              path: `knowledge/uploads/${markdownName}`,
            },
            contentRevision: committed.revision,
            workspaceFingerprint: committed.catalog.workspaceFingerprint,
            indexJob,
            warning,
            renamed,
            indexDirty: true,
          },
        };
      } catch (error) {
        if (!catalogCommitted) {
          for (const target of [markdownTarget, rawTarget]) {
            if (!target || !existsSync(target)) continue;
            try { unlinkSync(target); } catch {}
          }
        }
        throw error;
      }
    });
  }

  async function handleDelete(context, query, documentId = null) {
    let displayName = null;
    if (!documentId) {
      const parsedName = sanitizeUploadName(query?.get?.("name"), { requireExtension: ".md" });
      if (parsedName.error) return knowledgeError(400, {
        code: "knowledge_document_invalid_name",
        title: "文件名无效",
        message: parsedName.error,
        action: "请使用列表中的 documentId 删除，或提供唯一的 .md 名称",
      });
      displayName = parsedName.name;
    }
    return enqueueMutation(context.workspace, async () => {
      const found = catalog.find(context.workspace, { documentId, displayName });
      if (found.matches.length === 0) return knowledgeError(404, {
        code: "knowledge_document_not_found",
        title: "文档不存在",
        message: `文档不存在：${documentId || displayName}`,
        action: "刷新文档列表后重试",
      });
      if (found.matches.length > 1) return knowledgeError(409, {
        code: "knowledge_document_name_conflict",
        title: "文档名称不唯一",
        message: `文档名称不唯一，请使用 documentId：${displayName}`,
        action: "刷新列表并使用目标文档的稳定 ID 删除",
        details: { matches: found.matches.map((item) => item.documentId) },
      });
      const document = found.matches[0];
      let markdownTarget;
      let rawTarget;
      try {
        markdownTarget = resolveCatalogTarget(context, document.markdownPath);
        rawTarget = document.rawPath ? resolveCatalogTarget(context, document.rawPath, { raw: true }) : null;
      } catch (error) {
        return knowledgeError(400, {
          code: "knowledge_document_path_invalid",
          title: "文档路径无效",
          message: `文档目录记录包含不安全路径：${document.displayName}`,
          action: "请刷新或修复知识文档目录后重试",
          details: { documentId: document.documentId },
        });
      }
      if (!existsSync(markdownTarget)) return knowledgeError(404, {
        code: "knowledge_document_not_found",
        title: "文档不存在",
        message: `文档不存在：${document.displayName}`,
        action: "刷新文档列表以修复目录状态",
      });
      const committed = catalog.commitDelete(context.workspace, document.documentId);
      const cleanupWarnings = [];
      try {
        unlinkSync(markdownTarget);
      } catch (error) {
        cleanupWarnings.push(`Markdown 清理失败：${error.message}`);
      }
      const removedRaw = [];
      if (rawTarget && existsSync(rawTarget)) {
        try {
          unlinkSync(rawTarget);
          removedRaw.push(basename(rawTarget));
        } catch (error) {
          cleanupWarnings.push(`原件清理失败：${error.message}`);
        }
      }
      let warning = cleanupWarnings.length > 0 ? cleanupWarnings.join("；") : null;
      try {
        runtime.clearRetrievalCache?.();
      } catch (error) {
        const cacheWarning = `文档已删除，检索缓存清理失败：${error.message}`;
        warning = warning ? `${warning}；${cacheWarning}` : cacheWarning;
      }
      try {
        runtime.setIndexDirty(context.workspace, true);
      } catch (error) {
        const dirtyWarning = `文档已删除，旧索引脏标记写入失败，但 tombstone 已保留：${error.message}`;
        warning = warning ? `${warning}；${dirtyWarning}` : dirtyWarning;
      }
      let indexJob = null;
      if (autoReindex) {
        try {
          indexJob = indexCoordinator.schedule(context.workspace);
        } catch (error) {
          const scheduleWarning = `文档已删除，自动索引调度失败，tombstone 仍保留待重建状态：${error.message}`;
          warning = warning ? `${warning}；${scheduleWarning}` : scheduleWarning;
        }
      }
      return {
        status: 200,
        body: {
          deleted: true,
          document: {
            ...committed.document,
            status: "deleted_pending_index",
            deletedRevision: committed.revision,
          },
          documentId: document.documentId,
          name: document.displayName,
          removedRaw,
          contentRevision: committed.revision,
          workspaceFingerprint: committed.catalog.workspaceFingerprint,
          indexJob,
          warning,
          indexDirty: true,
        },
      };
    });
  }

  async function handleReindex(context, method, jobId = null) {
    if (method === "POST" && !jobId) {
      const job = indexCoordinator.start(context.workspace);
      return {
        status: 202,
        body: {
          accepted: true,
          status: job.status,
          jobId: job.jobId,
          workspaceFingerprint: job.workspaceFingerprint,
          job,
        },
      };
    }
    if (method === "GET" && jobId) {
      const state = indexCoordinator.getState(context.workspace);
      const job = [state.activeJob, state.lastJob].find((item) => item?.jobId === jobId) ?? null;
      return job ? { status: 200, body: { workspaceFingerprint: job.workspaceFingerprint, job } } : knowledgeError(404, {
        code: "knowledge_index_job_not_found",
        title: "索引任务不存在",
        message: `索引任务不存在：${jobId}`,
        action: "刷新知识库状态后重试",
      });
    }
    if (method === "DELETE" && jobId) {
      const cancelled = indexCoordinator.cancel(context.workspace, jobId);
      return cancelled
        ? {
          status: 200,
          body: {
            cancelled: true,
            jobId,
            workspaceFingerprint: indexCoordinator.getState(context.workspace).workspaceFingerprint,
          },
        }
        : knowledgeError(404, {
          code: "knowledge_index_job_not_found",
          title: "索引任务不存在",
          message: `索引任务不存在：${jobId}`,
          action: "刷新知识库状态后重试",
        });
    }
    return knowledgeError(405, {
      code: "knowledge_method_not_allowed",
      title: "请求方法不受支持",
      message: jobId ? "GET/DELETE only" : "POST only",
      action: "刷新页面后重试",
    });
  }

  async function handle({ method, pathname, query, body, signal = null, workspaceFingerprint = null, requestId = null } = {}) {
    try {
      const normalized = String(pathname ?? "").replace(/\/+$/, "");
      const context = workspaceContext(workspaceFingerprint);
      if (context.error) return context.error;
      if (normalized === REINDEX_PATH || normalized.startsWith(`${REINDEX_PATH}/`)) {
        const jobId = normalized.slice(REINDEX_PATH.length).replace(/^\/+/, "") || null;
        return await handleReindex(context, method, jobId ? decodeURIComponent(jobId) : null);
      }
      if (method === "GET") return await handleList(context);
      if (method === "POST") return await handleUpload(context, query, body, signal);
      if (method === "DELETE") {
        const suffix = normalized.slice(ROUTE_PREFIX.length).replace(/^\/+/, "");
        return await handleDelete(context, query, suffix ? decodeURIComponent(suffix) : null);
      }
      return knowledgeError(405, {
        code: "knowledge_method_not_allowed",
        title: "请求方法不受支持",
        message: "GET/POST/DELETE only",
        action: "刷新页面后重试",
      });
    } catch (error) {
      const operation = method === "DELETE" ? "delete" : method === "POST" ? "upload" : "request";
      return knowledgeError(500, {
        code: `knowledge_document_${operation}_failed`,
        title: "知识文档处理失败",
        message: `知识文档处理失败：${String(error?.message || error).slice(0, 200)}`,
        retryable: true,
        action: "保留当前文件并查看服务日志后重试",
      });
    }
  }

  function retrievalState(workspace) {
    const before = catalog.read(workspace, { reconcile: false });
    const current = catalog.read(workspace);
    if (current.contentRevision !== before.contentRevision) {
      runtime.clearRetrievalCache?.();
      try {
        runtime.setIndexDirty(workspace, true);
      } catch (error) {
        current.warnings = [...(current.warnings || []), `index dirty marker update failed: ${error.message}`].slice(-100);
        catalog.write(workspace, current);
      }
    }
    return current;
  }

  return {
    matches,
    handle,
    reconcileCommittedIndex: (workspace, result) => indexCoordinator.reconcileCommittedIndex(workspace, result),
    retrievalState,
    shutdown: () => indexCoordinator.shutdown(),
    whenIdle: async () => {
      await Promise.all([...mutationQueues.values()]);
      await indexCoordinator.whenIdle();
    },
  };
}

async function readRawBody(req, maxBytes) {
  const chunks = [];
  let total = 0;
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
    };
    const onData = (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        if (settled) return;
        settled = true;
        cleanup();
        chunks.length = 0;
        rejectPromise(new Error(`body exceeds ${Math.round(maxBytes / 1024 / 1024)}MB upload limit`));
        req.resume();
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolvePromise(Buffer.concat(chunks));
    };
    const onError = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(error);
    };
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
  });
}

/**
 * Dashboard server wrapper that prepends the knowledge-documents route to the
 * upstream dispatch. The upstream server bundle (visionox-pkg/dist) has a
 * fixed route table with no extension hook, so composition happens here in the
 * maintained layer; all other requests fall through to upstream `dispatch`.
 */
export function startKnowledgeAwareDashboardServer({
  dispatch,
  checkAuth,
  knowledgeDocumentsApi,
  knowledgeDocumentsMaxUploadBytes = DEFAULT_MAX_UPLOAD_BYTES,
  ctx,
  opts = {},
} = {}) {
  const upstreamDispatch = requiredFunction(dispatch, "dispatch");
  const upstreamCheckAuth = requiredFunction(checkAuth, "checkAuth");
  const token = opts.token;
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 0;
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (knowledgeDocumentsApi?.matches?.(url.pathname)) {
        handleKnowledgeRequest(req, res, url).catch((error) => {
          if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: `knowledge documents handler crashed: ${error.message}` }));
        });
        return;
      }
      upstreamDispatch(req, res, ctx, token).catch((error) => {
        if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({
          message: error.message,
          code: "internal_error",
          title: "服务处理失败",
          retryable: true,
          action: "查看日志后重试",
        }));
      });
    });
    server.on("error", rejectPromise);
    server.listen(port, host, () => {
      const address = server.address();
      const finalPort = address.port;
      const url = `http://${host}:${finalPort}/?token=${token}`;
      let closed = false;
      const close = () => new Promise((done) => {
        if (closed) return done();
        closed = true;
        server.close(() => done());
        setTimeout(() => server.closeAllConnections?.(), 1e3).unref();
      });
      resolvePromise({ url, token, port: finalPort, close });
    });
  });

  async function handleKnowledgeRequest(req, res, url) {
    const method = (req.method ?? "GET").toUpperCase();
    const isMutation = method === "POST" || method === "DELETE" || method === "PUT";
    const authFailure = upstreamCheckAuth(req, token, isMutation);
    if (authFailure) {
      res.writeHead(authFailure.status, { "content-type": "application/json" });
      res.end(authFailure.body);
      return;
    }
    const requestController = new AbortController();
    const abortRequest = () => {
      if (!res.writableEnded && !requestController.signal.aborted) {
        requestController.abort(createAbortError("knowledge request disconnected", "knowledge_request_disconnected"));
      }
    };
    req.on("aborted", abortRequest);
    res.on("close", abortRequest);
    let body = null;
    try {
      if (isMutation) {
        body = await readRawBody(req, knowledgeDocumentsMaxUploadBytes);
      }
      const result = await knowledgeDocumentsApi.handle({
        method,
        pathname: url.pathname,
        query: url.searchParams,
        body,
        signal: requestController.signal,
        workspaceFingerprint: typeof req.headers["x-visionox-workspace-fingerprint"] === "string"
          ? req.headers["x-visionox-workspace-fingerprint"]
          : null,
        requestId: typeof req.headers["x-visionox-request-id"] === "string"
          ? req.headers["x-visionox-request-id"]
          : null,
      });
      if (requestController.signal.aborted || res.destroyed) return;
      res.writeHead(result.status, { "content-type": "application/json" });
      res.end(JSON.stringify(result.body));
    } catch (error) {
      if (requestController.signal.aborted || res.destroyed) return;
      if (String(error?.message || "").includes("upload limit")) {
        res.writeHead(413, { "content-type": "application/json" });
        res.end(JSON.stringify(knowledgeError(413, {
          code: "knowledge_document_too_large",
          title: "文件过大",
          message: error.message,
          action: "缩小文件后重试",
          details: { maxUploadBytes: knowledgeDocumentsMaxUploadBytes },
        }).body));
        return;
      }
      throw error;
    } finally {
      req.removeListener("aborted", abortRequest);
      res.removeListener("close", abortRequest);
    }
  }
}
