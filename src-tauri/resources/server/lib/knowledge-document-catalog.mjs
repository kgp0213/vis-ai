import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  realpathSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";

import { readVersionedJsonFile, writeVersionedJsonFile } from "./versioned-json-file.mjs";

const CATALOG_VERSION = 1;
const ACTIVE_JOB_STATES = new Set(["queued", "running"]);
const DOCUMENT_STATES = new Set(["ready", "indexing", "indexed", "stale", "failed", "deleted_pending_index"]);

function isManagedPath(value, { raw = false } = {}) {
  const path = String(value || "").replaceAll("\\", "/");
  const prefix = raw ? "knowledge/uploads/_raw/" : "knowledge/uploads/";
  if (!path.startsWith(prefix)) return false;
  const name = path.slice(prefix.length);
  if (!name || name.includes("/") || name === "." || name === "..") return false;
  return raw || name.toLowerCase().endsWith(".md");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function portablePath(workspace, target) {
  return relative(resolve(workspace), resolve(target)).replaceAll("\\", "/");
}

function assertRealPathInside(projectRoot, candidate) {
  if (!existsSync(candidate)) return;
  const rootReal = realpathSync(projectRoot);
  const candidateReal = realpathSync(candidate);
  const pathFromRoot = relative(rootReal, candidateReal);
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(pathFromRoot)) {
    throw new Error("knowledge document catalog path resolves outside the bound workspace");
  }
}

function validateCatalog(value) {
  if (value.schemaVersion !== CATALOG_VERSION) return "unsupported knowledge document catalog schema";
  if (!Number.isSafeInteger(value.contentRevision) || value.contentRevision < 0) return "invalid contentRevision";
  if (!Number.isSafeInteger(value.indexedRevision) || value.indexedRevision < 0) return "invalid indexedRevision";
  if (!Array.isArray(value.documents) || !Array.isArray(value.tombstones)) return "catalog arrays are invalid";
  const documentIds = new Set();
  for (const document of value.documents) {
    if (!document || typeof document !== "object") return "catalog document is invalid";
    if (!document.documentId || documentIds.has(document.documentId)) return "catalog document id is invalid or duplicated";
    documentIds.add(document.documentId);
    if (!isManagedPath(document.markdownPath)) return "catalog markdown path escapes managed uploads";
    if (document.rawPath && !isManagedPath(document.rawPath, { raw: true })) return "catalog raw path escapes managed uploads";
  }
  for (const tombstone of value.tombstones) {
    if (!tombstone || typeof tombstone !== "object") return "catalog tombstone is invalid";
    if (!isManagedPath(tombstone.markdownPath)) return "catalog tombstone path escapes managed uploads";
    if (tombstone.rawPath && !isManagedPath(tombstone.rawPath, { raw: true })) return "catalog tombstone raw path escapes managed uploads";
  }
  return true;
}

function normalizeJob(value) {
  if (!value || typeof value !== "object") return null;
  return {
    jobId: String(value.jobId || ""),
    workspaceFingerprint: String(value.workspaceFingerprint || ""),
    requestedRevision: Math.max(0, Number(value.requestedRevision) || 0),
    status: String(value.status || "failed"),
    startedAt: value.startedAt ? String(value.startedAt) : null,
    finishedAt: value.finishedAt ? String(value.finishedAt) : null,
    error: value.error ?? null,
  };
}

function normalizeDocument(value) {
  return {
    documentId: String(value.documentId || randomUUID()),
    sourceName: String(value.sourceName || value.displayName || "document.md"),
    sourceType: String(value.sourceType || extname(value.sourceName || ".md").slice(1) || "md").toLowerCase(),
    displayName: String(value.displayName || basename(value.markdownPath || "document.md")),
    markdownPath: String(value.markdownPath || ""),
    rawPath: value.rawPath ? String(value.rawPath) : null,
    contentHash: String(value.contentHash || ""),
    markdownHash: String(value.markdownHash || value.contentHash || ""),
    parserVersion: String(value.parserVersion || "legacy-v1"),
    sizeBytes: Math.max(0, Number(value.sizeBytes) || 0),
    mtimeMs: Math.max(0, Number(value.mtimeMs) || 0),
    status: DOCUMENT_STATES.has(value.status) ? value.status : "stale",
    createdAt: String(value.createdAt || new Date().toISOString()),
    updatedAt: String(value.updatedAt || value.createdAt || new Date().toISOString()),
    indexedRevision: Math.max(0, Number(value.indexedRevision) || 0),
    lastError: value.lastError ?? null,
    pageMap: Array.isArray(value.pageMap) ? value.pageMap : [],
  };
}

export function knowledgeWorkspaceFingerprint(workspace) {
  return `sha256:${sha256(resolve(workspace).toLowerCase())}`;
}

export function createKnowledgeDocumentCatalog({
  knowledgeRuntime,
  now = () => new Date(),
  createId = () => randomUUID(),
  onIssue = () => {},
} = {}) {
  if (typeof knowledgeRuntime?.paths !== "function") throw new TypeError("knowledge document catalog requires knowledgeRuntime.paths");

  function locations(workspace) {
    const knowledgePaths = knowledgeRuntime.paths(workspace);
    const uploadsDir = resolve(knowledgePaths.root, "uploads");
    const result = {
      ...knowledgePaths,
      uploadsDir,
      rawDir: resolve(uploadsDir, "_raw"),
      catalogPath: resolve(uploadsDir, ".documents.json"),
    };
    for (const candidate of [result.root, result.uploadsDir, result.rawDir, result.catalogPath]) {
      assertRealPathInside(result.projectRoot, candidate);
    }
    return result;
  }

  function empty(workspace) {
    return {
      schemaVersion: CATALOG_VERSION,
      workspaceFingerprint: knowledgeWorkspaceFingerprint(workspace),
      contentRevision: 0,
      indexedRevision: 0,
      documents: [],
      tombstones: [],
      activeJob: null,
      lastJob: null,
      warnings: [],
      updatedAt: now().toISOString(),
    };
  }

  function write(workspace, catalog) {
    const target = locations(workspace).catalogPath;
    const normalized = {
      ...catalog,
      schemaVersion: CATALOG_VERSION,
      workspaceFingerprint: knowledgeWorkspaceFingerprint(workspace),
      contentRevision: Math.max(0, Number(catalog.contentRevision) || 0),
      indexedRevision: Math.min(
        Math.max(0, Number(catalog.indexedRevision) || 0),
        Math.max(0, Number(catalog.contentRevision) || 0),
      ),
      documents: (catalog.documents || []).map(normalizeDocument),
      tombstones: Array.isArray(catalog.tombstones) ? catalog.tombstones : [],
      activeJob: normalizeJob(catalog.activeJob),
      lastJob: normalizeJob(catalog.lastJob),
      warnings: Array.isArray(catalog.warnings) ? catalog.warnings.slice(-100) : [],
      updatedAt: now().toISOString(),
    };
    mkdirSync(locations(workspace).uploadsDir, { recursive: true });
    return writeVersionedJsonFile(target, normalized, { version: CATALOG_VERSION });
  }

  function backupInvalid(target) {
    if (!existsSync(target)) return null;
    const backup = `${target}.corrupt-${now().toISOString().replace(/[:.]/g, "-")}.json`;
    copyFileSync(target, backup);
    return backup;
  }

  function rawCandidate(rawDir, markdownBase) {
    if (!existsSync(rawDir)) return { path: null, warning: null };
    const matches = readdirSync(rawDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => basename(name, extname(name)).toLowerCase() === markdownBase.toLowerCase());
    if (matches.length === 1) return { path: resolve(rawDir, matches[0]), warning: null };
    if (matches.length > 1) return { path: null, warning: `ambiguous raw sources for ${markdownBase}.md` };
    return { path: null, warning: null };
  }

  function rebuildFromDisk(workspace, issue = null) {
    const paths = locations(workspace);
    const catalog = empty(workspace);
    if (issue) catalog.warnings.push(issue);
    if (!existsSync(paths.uploadsDir)) return catalog;
    const markdownNames = readdirSync(paths.uploadsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    for (const name of markdownNames) {
      const target = resolve(paths.uploadsDir, name);
      const stats = statSync(target);
      const markdown = readFileSync(target);
      const raw = rawCandidate(paths.rawDir, basename(name, ".md"));
      if (raw.warning) catalog.warnings.push(raw.warning);
      const rawStats = raw.path ? statSync(raw.path) : null;
      const sourceName = raw.path ? basename(raw.path) : name;
      catalog.documents.push(normalizeDocument({
        documentId: createId(),
        sourceName,
        sourceType: extname(sourceName).slice(1) || "md",
        displayName: name,
        markdownPath: portablePath(workspace, target),
        rawPath: raw.path ? portablePath(workspace, raw.path) : null,
        contentHash: raw.path ? sha256(readFileSync(raw.path)) : sha256(markdown),
        markdownHash: sha256(markdown),
        parserVersion: "legacy-v1",
        sizeBytes: stats.size,
        mtimeMs: stats.mtimeMs,
        status: "stale",
        createdAt: (rawStats?.birthtime || stats.birthtime).toISOString(),
        updatedAt: stats.mtime.toISOString(),
      }));
    }
    catalog.contentRevision = catalog.documents.length > 0 ? 1 : 0;
    return catalog;
  }

  function recordFromMarkdown(workspace, paths, name) {
    const target = resolve(paths.uploadsDir, name);
    const stats = statSync(target);
    const markdown = readFileSync(target);
    const raw = rawCandidate(paths.rawDir, basename(name, ".md"));
    const rawStats = raw.path ? statSync(raw.path) : null;
    const sourceName = raw.path ? basename(raw.path) : name;
    return {
      document: normalizeDocument({
        documentId: createId(),
        sourceName,
        sourceType: extname(sourceName).slice(1) || "md",
        displayName: name,
        markdownPath: portablePath(workspace, target),
        rawPath: raw.path ? portablePath(workspace, raw.path) : null,
        contentHash: raw.path ? sha256(readFileSync(raw.path)) : sha256(markdown),
        markdownHash: sha256(markdown),
        parserVersion: "legacy-v1",
        sizeBytes: stats.size,
        mtimeMs: stats.mtimeMs,
        status: "stale",
        createdAt: (rawStats?.birthtime || stats.birthtime).toISOString(),
        updatedAt: stats.mtime.toISOString(),
      }),
      warning: raw.warning,
    };
  }

  function reconcileDisk(workspace, catalog) {
    const paths = locations(workspace);
    const diskNames = existsSync(paths.uploadsDir)
      ? readdirSync(paths.uploadsDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
        .map((entry) => entry.name)
      : [];
    const diskPaths = new Set(diskNames.map((name) => `knowledge/uploads/${name}`.toLowerCase()));
    const tombstonePaths = new Set(catalog.tombstones.map((item) => String(item.markdownPath || "").toLowerCase()));
    for (const tombstonePath of tombstonePaths) diskPaths.delete(tombstonePath);
    const nextDocuments = [];
    let changed = false;
    for (const document of catalog.documents) {
      if (diskPaths.has(document.markdownPath.toLowerCase())) {
        const target = resolve(workspace, document.markdownPath);
        const stats = statSync(target);
        const markdownHash = sha256(readFileSync(target));
        if (markdownHash !== document.markdownHash || stats.mtimeMs !== document.mtimeMs) {
          nextDocuments.push(normalizeDocument({
            ...document,
            markdownHash,
            sizeBytes: stats.size,
            mtimeMs: stats.mtimeMs,
            status: "stale",
            updatedAt: stats.mtime.toISOString(),
          }));
          changed = true;
        } else {
          nextDocuments.push(document);
        }
        diskPaths.delete(document.markdownPath.toLowerCase());
        continue;
      }
      changed = true;
      catalog.tombstones.push({
        documentId: document.documentId,
        sourceName: document.sourceName,
        sourceType: document.sourceType,
        displayName: document.displayName,
        markdownPath: document.markdownPath,
        rawPath: document.rawPath,
        sizeBytes: document.sizeBytes,
        updatedAt: document.updatedAt,
        deletedRevision: catalog.contentRevision + 1,
        deletedAt: now().toISOString(),
        reason: "missing_on_disk",
      });
    }
    for (const name of diskNames.sort((left, right) => left.localeCompare(right))) {
      const markdownPath = `knowledge/uploads/${name}`;
      if (!diskPaths.has(markdownPath.toLowerCase())) continue;
      const created = recordFromMarkdown(workspace, paths, name);
      nextDocuments.push(created.document);
      if (created.warning && !catalog.warnings.includes(created.warning)) catalog.warnings.push(created.warning);
      changed = true;
    }
    if (!changed) return { catalog, changed: false };
    catalog.documents = nextDocuments;
    catalog.contentRevision += 1;
    for (const tombstone of catalog.tombstones) {
      if (tombstone.deletedRevision > catalog.contentRevision) tombstone.deletedRevision = catalog.contentRevision;
    }
    return { catalog, changed: true };
  }

  function read(workspace, { reconcile = true } = {}) {
    const target = locations(workspace).catalogPath;
    const stored = readVersionedJsonFile(target, { version: CATALOG_VERSION, validate: validateCatalog });
    let catalog;
    let changed = false;
    if (!stored.ok) {
      const backup = backupInvalid(target);
      const issue = `knowledge document catalog rebuilt after corruption: ${stored.error}`;
      onIssue(target, issue, backup);
      catalog = rebuildFromDisk(workspace, issue);
      changed = true;
    } else if (!stored.value) {
      catalog = rebuildFromDisk(workspace);
      changed = true;
    } else {
      catalog = {
        ...empty(workspace),
        ...stored.value,
        documents: stored.value.documents.map(normalizeDocument),
        tombstones: stored.value.tombstones,
        activeJob: normalizeJob(stored.value.activeJob),
        lastJob: normalizeJob(stored.value.lastJob),
      };
    }
    if (reconcile) {
      const reconciled = reconcileDisk(workspace, catalog);
      catalog = reconciled.catalog;
      changed ||= reconciled.changed;
    }
    return changed ? write(workspace, catalog) : catalog;
  }

  function recoverInterrupted(workspace) {
    const catalog = read(workspace);
    if (!catalog.activeJob || !ACTIVE_JOB_STATES.has(catalog.activeJob.status)) return catalog;
    catalog.lastJob = {
      ...catalog.activeJob,
      status: "interrupted",
      finishedAt: now().toISOString(),
      error: { code: "knowledge_index_interrupted", message: "indexing stopped before completion" },
    };
    catalog.activeJob = null;
    return write(workspace, catalog);
  }

  function commitUpload(workspace, document) {
    const catalog = read(workspace, { reconcile: false });
    const revision = catalog.contentRevision + 1;
    const record = normalizeDocument({
      ...document,
      documentId: document.documentId || createId(),
      status: "ready",
      indexedRevision: 0,
      createdAt: document.createdAt || now().toISOString(),
      updatedAt: document.updatedAt || now().toISOString(),
    });
    catalog.contentRevision = revision;
    catalog.tombstones = catalog.tombstones.filter((item) => (
      String(item.markdownPath || "").toLowerCase() !== record.markdownPath.toLowerCase()
    ));
    catalog.documents.push(record);
    return { catalog: write(workspace, catalog), document: record, revision };
  }

  function commitDelete(workspace, documentId) {
    const catalog = read(workspace, { reconcile: false });
    const index = catalog.documents.findIndex((item) => item.documentId === documentId);
    if (index < 0) return null;
    const [document] = catalog.documents.splice(index, 1);
    const revision = catalog.contentRevision + 1;
    catalog.contentRevision = revision;
    catalog.tombstones.push({
      documentId,
      sourceName: document.sourceName,
      sourceType: document.sourceType,
      displayName: document.displayName,
      markdownPath: document.markdownPath,
      rawPath: document.rawPath,
      sizeBytes: document.sizeBytes,
      updatedAt: document.updatedAt,
      deletedRevision: revision,
      deletedAt: now().toISOString(),
    });
    return { catalog: write(workspace, catalog), document, revision };
  }

  function find(workspace, { documentId = null, displayName = null } = {}) {
    const catalog = read(workspace);
    const matches = catalog.documents.filter((item) => documentId
      ? item.documentId === documentId
      : item.displayName.toLowerCase() === String(displayName || "").toLowerCase());
    return { catalog, matches };
  }

  return {
    commitDelete,
    commitUpload,
    find,
    locations,
    read,
    recoverInterrupted,
    write,
    workspaceFingerprint: knowledgeWorkspaceFingerprint,
  };
}
