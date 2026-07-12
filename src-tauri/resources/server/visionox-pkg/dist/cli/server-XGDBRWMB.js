#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  readEventLogFile,
  recentEventFiles
} from "./chunk-J5XJHLWM.js";
import {
  SLASH_COMMANDS,
  createCheckpoint,
  deleteCheckpoint,
  fmtAgo,
  listAllPlanArchives,
  listCheckpoints,
  loadCheckpoint,
  restoreCheckpoint
} from "./chunk-3BXRZFWS.js";
import "./chunk-4QUNBQQ2.js";
import {
  fetchSmitheryDetail,
  handleToFetchResult,
  loadMorePages,
  openRegistry,
  specStringFor
} from "./chunk-XJXDHAES.js";
import {
  registerSemanticSearchTool
} from "./chunk-YYQAUTTN.js";
import {
  BUILTIN_ALLOWLIST,
  lineDiff
} from "./chunk-O52OLQL3.js";
import {
  PROJECT_MEMORY_FILE,
  SKILLS_DIRNAME,
  SKILL_FILE,
  findProjectMemoryPath,
  listProjectMemoryPaths,
  parseFrontmatter,
  resolveProjectMemoryWritePath,
  validateSkillFrontmatter
} from "./chunk-2K65GZBT.js";
import {
  MemoryStore
} from "./chunk-5JJRUIPA.js";
import {
  DeepSeekClient
} from "./chunk-2KDUS647.js";
import {
  analyzeMemoryEntries
} from "../../../lib/memory-prompt.mjs";
import "./chunk-PLHAZOLZ.js";
import {
  checkOllamaStatus,
  pullOllamaModel,
  startOllamaDaemon
} from "./chunk-DOYHN4KB.js";
import {
  INDEX_DIR_NAME,
  buildIndex,
  compareIndexIdentity,
  indexExists,
  querySemanticGroups,
  readIndexMeta,
  semanticIndexDirForRoot,
  walkChunks
} from "./chunk-XCGGEJTI.js";
import {
  HOOK_EVENTS,
  globalSettingsPath,
  loadHooks,
  projectSettingsPath
} from "./chunk-7O5ALB4C.js";
import "./chunk-S4XVGLRW.js";
import {
  deleteSession,
  listSessions,
  renameSession,
  sanitizeName,
  sessionPath,
  sessionsDir
} from "./chunk-6PBZN4VI.js";
import {
  getLanguage,
  getSupportedLanguages,
  setLanguage
} from "./chunk-RE4RAVFF.js";
import {
  DEFAULT_INDEX_EXCLUDES,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_RESPECT_GITIGNORE,
  addProjectShellAllowed,
  clearProjectShellAllowed,
  isPlausibleKey,
  loadIndexConfig,
  loadIndexUserConfig,
  loadProjectShellAllowed,
  loadSemanticEmbeddingUserConfig,
  readConfig,
  redactKey,
  redactSemanticEmbeddingConfig,
  removeProjectShellAllowed,
  resolveIndexConfig,
  resolveSemanticEmbeddingConfig,
  saveSemanticEmbeddingConfig,
  writeConfig
} from "./chunk-XPDVG52A.js";
import {
  aggregateUsage,
  bucketCacheHitRatio,
  formatLogSize,
  readUsageLog
} from "./chunk-HFEAY5DT.js";
import {
  DEEPSEEK_PRICING,
  cacheSavingsUsd
} from "./chunk-YQ6NTIIE.js";
import {
  VERSION
} from "./chunk-XXC2BYTV.js";
import "./chunk-TUK7OWJA.js";

// src/server/index.ts
import { randomBytes } from "crypto";
import { createServer } from "http";

// src/server/api/events.ts
var PING_INTERVAL_MS = 25e3;
function handleEvents(req, res, ctx, query = new URLSearchParams()) {
  const channels = new Set(String(query.get("channels") || "events,overview,health").split(",").map((value) => value.trim()).filter(Boolean));
  const wants = (channel) => channels.has(channel);
  if (!ctx.subscribeEvents) {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "event stream requires an attached dashboard session." }));
    return;
  }
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no"
    // disable Nginx-style buffering if anything proxies us
  });
  const writeEvent = (event) => {
    if (res.writableEnded) return;
    try {
      res.write(`data: ${JSON.stringify(event)}

`);
    } catch {
    }
  };
  const pushOverview = async () => {
    try {
      const result = await handleOverview("GET", [], "", ctx);
      if (result.status === 200) writeEvent({ kind: "overview", ...result.body });
    } catch {
    }
  };
  const pushHealth = async () => {
    try {
      const result = await handleHealth("GET", [], "", ctx);
      if (result.status === 200) writeEvent({ kind: "health", ...result.body });
    } catch {
    }
  };
  const pushLogs = async () => {
    try {
      const result = await handleLogs("GET", [], "", ctx);
      if (result.status === 200) writeEvent({ kind: "logs", logs: result.body.logs });
    } catch {
    }
  };
  if (wants("overview")) pushOverview();
  if (wants("health")) pushHealth();
  if (wants("logs")) pushLogs();
  const overviewInterval = wants("overview") ? setInterval(pushOverview, 5e3) : null;
  const healthInterval = wants("health") ? setInterval(pushHealth, 5e3) : null;
  const logsInterval = wants("logs") ? setInterval(pushLogs, 2e3) : null;
  overviewInterval?.unref?.();
  healthInterval?.unref?.();
  logsInterval?.unref?.();
  if (wants("events") && ctx.isBusy) writeEvent({ kind: "busy-change", busy: ctx.isBusy() });
  const unsubscribe = wants("events") ? ctx.subscribeEvents(writeEvent) : () => {};
  const ping = setInterval(() => writeEvent({ kind: "ping" }), PING_INTERVAL_MS);
  ping.unref?.();
  const cleanup = () => {
    clearInterval(ping);
    if (overviewInterval) clearInterval(overviewInterval);
    if (healthInterval) clearInterval(healthInterval);
    if (logsInterval) clearInterval(logsInterval);
    try {
      unsubscribe();
    } catch {
    }
    if (!res.writableEnded) {
      try {
        res.end();
      } catch {
      }
    }
  };
  req.on("close", cleanup);
  req.on("error", cleanup);
  res.on("close", cleanup);
}

// src/server/assets.ts
import { readFileSync } from "fs";
import { readFile, stat } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
function resolveAssetDir() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "..", "dashboard"),
    join(here, "..", "dashboard"),
    join(here, "dashboard")
  ];
  for (const c of candidates) {
    try {
      readFileSync(join(c, "index.html"), "utf8");
      return c;
    } catch {
    }
  }
  return candidates[0];
}
var ASSET_DIR = resolveAssetDir();
var fileCache = /* @__PURE__ */ new Map();
async function loadCachedFile(path, encoding = "utf8") {
  const s = await stat(path);
  const cached = fileCache.get(path);
  if (cached && cached.mtimeMs === s.mtimeMs && cached.encoding === encoding) {
    return { body: cached.body, mtimeMs: s.mtimeMs };
  }
  const body = await readFile(path, encoding);
  fileCache.set(path, { body, mtimeMs: s.mtimeMs, encoding });
  return { body, mtimeMs: s.mtimeMs };
}
async function loadIndexTemplate() {
  return loadCachedFile(join(ASSET_DIR, "index.html"));
}
async function loadApp() {
  return loadCachedFile(join(ASSET_DIR, "dist", "app.js"));
}
async function loadAppMap() {
  try {
    return loadCachedFile(join(ASSET_DIR, "dist", "app.js.map"));
  } catch {
    return null;
  }
}
async function loadCss() {
  return loadCachedFile(join(ASSET_DIR, "app.css"));
}
async function renderIndexHtml(token, mode) {
  const { body: tpl } = await loadIndexTemplate();
  const safeToken = token.replace(/[^a-zA-Z0-9]/g, "");
  return tpl.replaceAll("__VISIONOX_TOKEN__", safeToken).replaceAll("__VISIONOX_MODE__", mode);
}
var VENDOR_CSS_NAMES = /* @__PURE__ */ new Set(["vendor-hljs.css", "vendor-uplot.css"]);
var KATEX_ASSET_RE = /^vendor\/katex\/(?:katex\.min\.(?:js|css)|LICENSE|fonts\/KaTeX_[A-Za-z0-9-]+\.(?:ttf|woff2?))$/;
var KATEX_FONT_ASSET_RE = /^vendor\/katex\/fonts\/KaTeX_[A-Za-z0-9-]+\.(?:ttf|woff2?)$/;
async function loadVendorCss(name) {
  return loadCachedFile(join(ASSET_DIR, "dist", name));
}
async function serveAsset(name) {
  const assetPath = (sub) => join(ASSET_DIR, sub, name);
  if (name === "app.js") {
    const { body, mtimeMs } = await loadApp();
    return { body, mtimeMs, contentType: "application/javascript; charset=utf-8" };
  }
  if (name === "app.js.map") {
    const result = await loadAppMap();
    return result == null ? null : { body: result.body, mtimeMs: result.mtimeMs, contentType: "application/json; charset=utf-8" };
  }
  if (name === "app.css") {
    const { body, mtimeMs } = await loadCss();
    return { body, mtimeMs, contentType: "text/css; charset=utf-8" };
  }
  if (["katex-support.js", "backup-support.js", "index-mode-support.js", "overview-alerts-support.js"].includes(name)) {
    const { body, mtimeMs } = await loadCachedFile(join(ASSET_DIR, name));
    return { body, mtimeMs, contentType: "application/javascript; charset=utf-8" };
  }
  if (KATEX_ASSET_RE.test(name)) {
    const binary = KATEX_FONT_ASSET_RE.test(name);
    const { body, mtimeMs } = await loadCachedFile(join(ASSET_DIR, name), binary ? null : "utf8");
    const contentType = name.endsWith(".js") ? "application/javascript; charset=utf-8"
      : name.endsWith(".css") ? "text/css; charset=utf-8"
      : name.endsWith(".woff2") ? "font/woff2"
      : name.endsWith(".woff") ? "font/woff"
      : name.endsWith(".ttf") ? "font/ttf"
      : "text/plain; charset=utf-8";
    return { body, mtimeMs, contentType };
  }
  if (VENDOR_CSS_NAMES.has(name)) {
    const { body, mtimeMs } = await loadVendorCss(name);
    return { body, mtimeMs, contentType: "text/css; charset=utf-8" };
  }
  if (name.endsWith(".png")) {
    try {
      const { body, mtimeMs } = await loadCachedFile(assetPath("dist"), null);
      return { body, mtimeMs, contentType: "image/png" };
    } catch { return null; }
  }
  return null;
}

// src/server/api/abort.ts
async function handleAbort(method, _rest, _body, ctx) {
  if (method !== "POST") {
    return { status: 405, body: { error: "POST only" } };
  }
  if (!ctx.abortTurn) {
    return {
      status: 503,
      body: { error: "abort requires an attached dashboard session." }
    };
  }
  const result = await ctx.abortTurn();
  ctx.audit?.({ ts: Date.now(), action: "abort-turn" });
  return { status: result?.accepted === false ? 200 : 202, body: { aborted: result?.accepted !== false, ...result } };
}

async function handleBackgroundJobs(method, rest, _body, ctx) {
  if (method === "GET" && rest.length === 0) {
    const jobs = ctx.listBackgroundJobs ? ctx.listBackgroundJobs() : [];
    return { status: 200, body: { jobs } };
  }
  if (method === "GET" && rest.length === 1) {
    if (!ctx.getBackgroundJob) return { status: 503, body: { error: "background job output is not available" } };
    const id = Number.parseInt(rest[0], 10);
    if (!Number.isInteger(id) || id < 1) return { status: 400, body: { error: "invalid background job id" } };
    const job = ctx.getBackgroundJob(id);
    if (!job) return { status: 404, body: { error: "background job not found" } };
    return { status: 200, body: { job } };
  }
  if (method === "DELETE" && rest.length === 1) {
    if (!ctx.stopBackgroundJob) return { status: 503, body: { error: "background job control is not available" } };
    const id = Number.parseInt(rest[0], 10);
    if (!Number.isInteger(id) || id < 1) return { status: 400, body: { error: "invalid background job id" } };
    const job = await ctx.stopBackgroundJob(id);
    if (!job) return { status: 404, body: { error: "background job not found" } };
    ctx.audit?.({ ts: Date.now(), action: "background-job-stop", payload: { id } });
    return { status: 200, body: { stopped: true, job } };
  }
  return { status: 405, body: { error: "GET list or DELETE /:id only" } };
}

// src/server/api/checkpoint-create.ts
async function handleCheckpointCreate(method, _rest, body, ctx) {
  if (method !== "POST") return { status: 405, body: { error: "POST only" } };
  const rootDir = ctx.getCurrentCwd?.();
  if (!rootDir) return { status: 400, body: { error: "no active workspace" } };
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { status: 400, body: { error: "invalid JSON" } };
  }
  if (!parsed.name) return { status: 400, body: { error: "missing name" } };
  let paths;
  try {
    const { execSync: execSync2 } = await import("child_process");
    const stdout = execSync2("git ls-files --cached --others --exclude-standard", {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024
    });
    paths = stdout.split("\n").filter(Boolean);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not a git repository") || msg.includes("fatal")) {
      return {
        status: 400,
        body: {
          error: `Cannot snapshot \u2014 not a git repository or git is unavailable: ${msg}`
        }
      };
    }
    return {
      status: 500,
      body: { error: `git ls-files failed: ${msg}` }
    };
  }
  const meta = createCheckpoint({
    rootDir,
    name: parsed.name,
    paths
  });
  return {
    status: 200,
    body: {
      id: meta.id,
      name: meta.name,
      fileCount: meta.fileCount,
      bytes: meta.bytes
    }
  };
}

// src/server/api/checkpoint-delete.ts
async function handleCheckpointDelete(method, _rest, body, ctx) {
  if (method !== "POST") return { status: 405, body: { error: "POST only" } };
  const rootDir = ctx.getCurrentCwd?.();
  if (!rootDir) return { status: 400, body: { error: "no active workspace" } };
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { status: 400, body: { error: "invalid JSON" } };
  }
  if (!parsed.id) return { status: 400, body: { error: "missing id" } };
  const ok = deleteCheckpoint(rootDir, parsed.id);
  return ok ? { status: 200, body: { deleted: parsed.id } } : { status: 500, body: { error: "delete failed" } };
}

// src/server/api/checkpoint-diffs.ts
import { readFileSync as readFileSync2 } from "fs";
import { resolve } from "path";
async function handleCheckpointDiffs(method, _rest, _body, ctx, query = new URLSearchParams()) {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  const rootDir = ctx.getCurrentCwd?.();
  if (!rootDir) return { status: 200, body: [] };
  const checkpointId = query.get("id");
  if (!checkpointId) return { status: 400, body: { error: "missing id" } };
  const checkpoint = loadCheckpoint(rootDir, checkpointId);
  if (!checkpoint) return { status: 404, body: { error: "checkpoint not found" } };
  const diffs = [];
  for (const snap of checkpoint.files) {
    const absPath = resolve(rootDir, snap.path);
    let currentContent = null;
    try {
      currentContent = readFileSync2(absPath, "utf8");
    } catch {
      currentContent = null;
    }
    if (snap.content !== null) {
      if (currentContent === null) {
        diffs.push({
          file: snap.path,
          additions: 0,
          deletions: snap.content.split("\n").length,
          status: "deleted"
        });
      } else if (currentContent !== snap.content) {
        const rows = lineDiff(snap.content.split("\n"), currentContent.split("\n"));
        const additions = rows.filter((r) => r.op === "+").length;
        const deletions = rows.filter((r) => r.op === "-").length;
        let patch = `--- a/${snap.path}
+++ b/${snap.path}
`;
        const ctx2 = 3;
        let i = 0;
        while (i < rows.length) {
          while (i < rows.length && rows[i].op === " ") i++;
          if (i >= rows.length) break;
          const hunkStart = Math.max(0, i - ctx2);
          let hunkEnd = i;
          while (hunkEnd < rows.length && rows[hunkEnd].op !== " ") hunkEnd++;
          hunkEnd = Math.min(rows.length, hunkEnd + ctx2);
          const oldCount = rows.slice(hunkStart, hunkEnd).filter((r) => r.op !== "+").length;
          const newCount = rows.slice(hunkStart, hunkEnd).filter((r) => r.op !== "-").length;
          patch += `@@ -${hunkStart + 1},${oldCount} +${hunkStart + 1},${newCount} @@
`;
          for (let j = hunkStart; j < hunkEnd; j++) {
            patch += `${rows[j].op}${rows[j].line}
`;
          }
          i = hunkEnd;
        }
        diffs.push({
          file: snap.path,
          additions,
          deletions,
          patch,
          status: "modified"
        });
      }
    } else {
      if (currentContent !== null) {
        const additions = currentContent.split("\n").length;
        diffs.push({
          file: snap.path,
          additions,
          deletions: 0,
          status: "added"
        });
      }
    }
  }
  return { status: 200, body: diffs };
}

// src/server/api/checkpoint-restore.ts
async function handleCheckpointRestore(method, _rest, body, ctx) {
  if (method !== "POST") return { status: 405, body: { error: "POST only" } };
  const rootDir = ctx.getCurrentCwd?.();
  if (!rootDir) return { status: 400, body: { error: "no active workspace" } };
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { status: 400, body: { error: "invalid JSON" } };
  }
  if (!parsed.id) return { status: 400, body: { error: "missing id" } };
  const result = restoreCheckpoint(rootDir, parsed.id);
  return { status: 200, body: result };
}

// src/server/api/checkpoints.ts
async function handleCheckpoints(method, _rest, _body, ctx) {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  const rootDir = ctx.getCurrentCwd?.();
  if (!rootDir) return { status: 200, body: [] };
  const metas = listCheckpoints(rootDir);
  const items = metas.map((m) => ({
    id: m.id,
    name: m.name,
    createdAt: m.createdAt,
    source: m.source,
    fileCount: m.fileCount,
    bytes: m.bytes,
    ago: fmtAgo(m.createdAt)
  }));
  return { status: 200, body: items };
}

// src/server/api/edit-mode.ts
function parseBody(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
var VALID = /* @__PURE__ */ new Set(["review", "auto", "yolo", "admin"]);
async function handleEditMode(method, _rest, body, ctx) {
  if (method === "GET") {
    return {
      status: 200,
      body: { mode: ctx.getEditMode?.() ?? null }
    };
  }
  if (method === "POST") {
    if (!ctx.setEditMode) {
      return {
        status: 503,
        body: { error: "edit-mode mutation requires an attached `visionox code` session." }
      };
    }
    const { mode } = parseBody(body);
    if (typeof mode !== "string" || !VALID.has(mode)) {
      return { status: 400, body: { error: "mode must be auto | yolo | admin (review is accepted as alias for auto)" } };
    }
    const resolved = ctx.setEditMode(mode);
    ctx.audit?.({ ts: Date.now(), action: "set-edit-mode", payload: { mode: resolved } });
    return { status: 200, body: { mode: resolved } };
  }
  return { status: 405, body: { error: "GET or POST only" } };
}

// src/server/api/file-read.ts
import { closeSync as closeSync2, fstatSync as fstatSync2, openSync as openSync2, readSync as readSync2 } from "fs";
import { extname, join as join2, resolve as resolve2, sep } from "path";
var MAX_FILE_SIZE = 500 * 1024;
var BINARY_EXTS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".class",
  ".pyc",
  ".o",
  ".obj"
]);
async function handleFileRead(method, rest, _body, ctx) {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  const filePath = decodeURIComponent(rest.join("/"));
  if (!filePath) return { status: 400, body: { error: "file path required" } };
  const cwd = ctx.getCurrentCwd?.();
  if (!cwd) return { status: 503, body: { error: "no project directory available" } };
  const resolved = resolve2(join2(cwd, filePath));
  const normalizedCwd = resolve2(cwd);
  if (!resolved.startsWith(normalizedCwd + sep) && resolved !== normalizedCwd) {
    return { status: 403, body: { error: "path escapes workspace" } };
  }
  const ext = extname(filePath).toLowerCase();
  if (BINARY_EXTS.has(ext)) {
    return { status: 400, body: { error: "binary file not supported" } };
  }
  let readPath = resolved;
  try {
    if (ctx.resolveDlpReadablePath) {
      const dlpResolved = await ctx.resolveDlpReadablePath(resolved);
      if (dlpResolved?.path) readPath = dlpResolved.path;
    }
  } catch (err) {
    return { status: 500, body: { error: err.message || "文件暂时无法读取" } };
  }
  let fd;
  try {
    fd = openSync2(readPath, "r");
  } catch (err) {
    const code = err.code;
    if (code === "ENOENT") {
      return { status: 404, body: { error: `file not found: ${filePath}` } };
    }
    return { status: 500, body: { error: "cannot open file" } };
  }
  try {
    const st = fstatSync2(fd);
    if (!st.isFile()) {
      return { status: 400, body: { error: "not a file" } };
    }
    if (st.size > MAX_FILE_SIZE) {
      return {
        status: 413,
        body: { error: `file too large (${st.size} bytes, max ${MAX_FILE_SIZE})` }
      };
    }
    const buf = Buffer.alloc(st.size);
    readSync2(fd, buf, 0, st.size, 0);
    return { status: 200, body: { content: buf.toString("utf-8"), path: filePath, size: st.size } };
  } finally {
    closeSync2(fd);
  }
}

// src/server/api/files.ts
import { existsSync, readdirSync, statSync } from "fs";
import { extname as extname2, join as join3, relative, sep as sep2 } from "path";
var RESULT_CAP = 50;
var MAX_DEPTH = 4;
var SKIP_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".visionox",
  "dist",
  "build",
  "out",
  ".next",
  "coverage",
  ".cache",
  "__pycache__",
  ".venv",
  ".pytest_cache"
]);
var SKIP_EXTS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".lock",
  ".woff",
  ".woff2",
  ".ttf"
]);
async function handleFiles(method, _rest, body, ctx) {
  if (method !== "POST") return { status: 405, body: { error: "POST only" } };
  const cwd = ctx.getCurrentCwd?.();
  if (!cwd || !existsSync(cwd)) {
    return { status: 503, body: { error: "@-mention picker requires a code-mode session" } };
  }
  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch {
    return { status: 400, body: { error: "body must be JSON" } };
  }
  const prefix = typeof parsed.prefix === "string" ? parsed.prefix.trim().toLowerCase() : "";
  const matches = walk(cwd, prefix);
  return { status: 200, body: { files: matches } };
}
function walk(root, prefix) {
  const out = [];
  const stack = [{ path: root, depth: 0 }];
  while (stack.length > 0 && out.length < RESULT_CAP) {
    const { path, depth } = stack.pop();
    if (depth > MAX_DEPTH) continue;
    let names;
    try {
      names = readdirSync(path);
    } catch {
      continue;
    }
    for (const name of names) {
      if (out.length >= RESULT_CAP) break;
      if (name.startsWith(".") && depth === 0) continue;
      if (SKIP_DIRS.has(name)) continue;
      const full = join3(path, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push({ path: full, depth: depth + 1 });
        continue;
      }
      if (!st.isFile()) continue;
      if (SKIP_EXTS.has(extname2(name).toLowerCase())) continue;
      const rel = relative(root, full).split(sep2).join("/");
      if (prefix && !rel.toLowerCase().includes(prefix)) continue;
      out.push(rel);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

// src/server/api/git-diffs.ts
import { execSync } from "child_process";
function parseGitDiff(stdout) {
  const files = [];
  const blocks = stdout.split(/\ndiff --git /).filter(Boolean);
  for (const block of blocks) {
    const fullBlock = block.startsWith("diff --git ") ? block : `diff --git ${block}`;
    const bPath = fullBlock.match(/^diff --git a\/.+ b\/(.+)$/m)?.[1];
    if (!bPath) continue;
    const patchContent = block;
    const additions = (patchContent.match(/^\+/gm) || []).length;
    const deletions = (patchContent.match(/^-/gm) || []).length;
    const isNew = /^new file mode/.test(patchContent);
    const isDeleted = /^deleted file mode/.test(patchContent);
    const status = isNew ? "added" : isDeleted ? "deleted" : "modified";
    files.push({
      file: bPath,
      additions,
      deletions,
      patch: fullBlock,
      status
    });
  }
  return files;
}
async function handleGitDiffs(method, _rest, _body, _ctx) {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  let diffStdout;
  let stagedStdout;
  let untracked;
  try {
    diffStdout = execSync("git diff --no-color --unified=3 HEAD", {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true
    });
    stagedStdout = execSync("git diff --no-color --unified=3 --cached", {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true
    });
    untracked = execSync("git ls-files --others --exclude-standard", {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      windowsHide: true
    });
  } catch {
    return { status: 200, body: [] };
  }
  const seen = /* @__PURE__ */ new Set();
  const allDiffs = [];
  const combined = diffStdout + (stagedStdout ? `
${stagedStdout}` : "");
  for (const f of parseGitDiff(combined)) {
    if (!seen.has(f.file)) {
      seen.add(f.file);
      allDiffs.push(f);
    }
  }
  for (const file of untracked.split("\n").filter(Boolean)) {
    if (!seen.has(file)) {
      seen.add(file);
      allDiffs.push({
        file,
        additions: 0,
        deletions: 0,
        status: "added"
      });
    }
  }
  return { status: 200, body: allDiffs };
}

// src/server/api/health.ts
import { existsSync as existsSync2, readdirSync as readdirSync2, statSync as statSync2 } from "fs";
import { homedir } from "os";
import { join as join4 } from "path";
function dirSize(path) {
  if (!existsSync2(path)) return { path, exists: false, fileCount: 0, totalBytes: 0 };
  let fileCount = 0;
  let totalBytes = 0;
  try {
    const entries = readdirSync2(path);
    for (const name of entries) {
      const full = join4(path, name);
      try {
        const s = statSync2(full);
        if (s.isFile()) {
          fileCount++;
          totalBytes += s.size;
        } else if (s.isDirectory()) {
          try {
            const inner = readdirSync2(full);
            for (const child of inner) {
              try {
                const cs = statSync2(join4(full, child));
                if (cs.isFile()) {
                  fileCount++;
                  totalBytes += cs.size;
                }
              } catch {
              }
            }
          } catch {
          }
        }
      } catch {
      }
    }
  } catch {
    return { path, exists: true, fileCount: 0, totalBytes: 0 };
  }
  return { path, exists: true, fileCount, totalBytes };
}
var HEALTH_FS_CACHE_TTL_MS = 15e3;
var healthFsCache = { ts: 0, root: null, value: null };
function healthFilesystemSnapshot(root) {
  const now = Date.now();
  if (healthFsCache.value && healthFsCache.root === root && now - healthFsCache.ts < HEALTH_FS_CACHE_TTL_MS) return healthFsCache.value;
  const home = homedir();
  const visionoxHome = join4(home, ".visionox");
  const value = {
    visionoxHome,
    sessionsStat: dirSize(join4(visionoxHome, "sessions")),
    memoryStat: dirSize(join4(visionoxHome, "memory")),
    semanticStat: root ? dirSize(semanticIndexDirForRoot(root)) : { path: INDEX_DIR_NAME, exists: false, fileCount: 0, totalBytes: 0 }
  };
  healthFsCache = { ts: now, root, value };
  return value;
}
async function handleHealth(method, _rest, _body, ctx) {
  if (method !== "GET") {
    return { status: 405, body: { error: "GET only" } };
  }
  const { visionoxHome, sessionsStat, memoryStat, semanticStat } = healthFilesystemSnapshot(ctx.getCurrentCwd?.() ?? null);
  let usageBytes = 0;
  if (existsSync2(ctx.usageLogPath)) {
    try {
      usageBytes = statSync2(ctx.usageLogPath).size;
    } catch {
    }
  }
  let storage = null;
  try {
    storage = ctx.userDataBackups?.health?.() ?? null;
  } catch (error) {
    storage = { error: error.message };
  }
  return {
    status: 200,
    body: {
      version: VERSION,
      latestVersion: ctx.getLatestVersion?.() ?? null,
      visionoxHome,
      sessions: {
        path: sessionsStat.path,
        count: sessionsStat.fileCount,
        totalBytes: sessionsStat.totalBytes
      },
      memory: {
        path: memoryStat.path,
        fileCount: memoryStat.fileCount,
        totalBytes: memoryStat.totalBytes
      },
      semantic: {
        path: semanticStat.path,
        exists: semanticStat.exists,
        fileCount: semanticStat.fileCount,
        totalBytes: semanticStat.totalBytes
      },
      usageLog: {
        path: ctx.usageLogPath,
        bytes: usageBytes
      },
      storage: storage ? { ...storage, configStatus: ctx.configMigrationStatus?.status ?? null } : null,
      storageIssues: ctx.getPersistentStorageIssues?.() ?? [],
      jobs: ctx.jobs ? ctx.jobs.listMetadata?.().length ?? ctx.jobs.runningCount?.() ?? null : null,
      cwd: ctx.getCurrentCwd?.() ?? null,
      buildDate: new Date().getHours().toString().padStart(2, "0")
    }
  };
}

// src/server/api/logs.ts
async function handleLogs(method, _rest, _body, ctx) {
  if (method !== "GET") {
    return { status: 405, body: { error: "GET only" } };
  }
  const logs = ctx.getLogs?.() ?? [];
  return { status: 200, body: { logs } };
}

// src/server/api/hooks.ts
import { existsSync as existsSync4, mkdirSync, readFileSync as readFileSync3, writeFileSync } from "fs";
import { dirname as dirname2 } from "path";

// src/server/api/hooks-events.ts
import { existsSync as existsSync3 } from "fs";
var HOOK_LOG_CAP = 12;
function readRecentHookRuns(now = Date.now(), sessionsDirOverride) {
  const dir = sessionsDirOverride ?? sessionsDir();
  if (!existsSync3(dir)) return null;
  const files = recentEventFiles(dir, now);
  if (files.length === 0) return null;
  const rows = [];
  for (const file of files) {
    const events = readEventLogFile(file);
    for (const ev of events) {
      if (ev.type !== "hook.fired") continue;
      const ts = Date.parse(ev.ts);
      if (!Number.isFinite(ts)) continue;
      rows.push({
        hookName: ev.hookName,
        phase: ev.phase,
        outcome: ev.outcome,
        whenMs: ts
      });
    }
  }
  rows.sort((a, b) => b.whenMs - a.whenMs);
  return rows.slice(0, HOOK_LOG_CAP);
}

// src/server/api/hooks.ts
function parseBody2(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
function readSettingsFile(path) {
  if (!existsSync4(path)) return {};
  try {
    const raw = readFileSync3(path, "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
function writeSettingsFile(path, hooksBlock) {
  const existing = readSettingsFile(path);
  existing.hooks = hooksBlock;
  mkdirSync(dirname2(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(existing, null, 2)}
`, "utf8");
}
async function handleHooks(method, rest, body, ctx) {
  if (method === "GET" && rest.length === 0) {
    const projectPath = ctx.getCurrentCwd ? projectSettingsPath(ctx.getCurrentCwd() ?? "") : null;
    const globalPath = globalSettingsPath();
    const projectFile = projectPath ? readSettingsFile(projectPath) : {};
    const globalFile = readSettingsFile(globalPath);
    const resolved = loadHooks({ projectRoot: ctx.getCurrentCwd?.() });
    return {
      status: 200,
      body: {
        project: {
          path: projectPath,
          hooks: projectFile.hooks ?? {}
        },
        global: {
          path: globalPath,
          hooks: globalFile.hooks ?? {}
        },
        resolved,
        events: HOOK_EVENTS,
        recentRuns: readRecentHookRuns(void 0, ctx.sessionsDir)
      }
    };
  }
  if (method === "POST" && rest[0] === "save") {
    const { scope, hooks } = parseBody2(body);
    if (scope !== "project" && scope !== "global") {
      return { status: 400, body: { error: "scope must be project | global" } };
    }
    if (typeof hooks !== "object" || hooks === null) {
      return { status: 400, body: { error: "hooks must be an object keyed by event name" } };
    }
    let path;
    if (scope === "project") {
      const cwd = ctx.getCurrentCwd?.();
      if (!cwd) {
        return {
          status: 503,
          body: { error: "no active project \u2014 open `/dashboard` from inside `visionox code`" }
        };
      }
      path = projectSettingsPath(cwd);
    } else {
      path = globalSettingsPath();
    }
    if (!path) {
      return { status: 500, body: { error: "could not resolve settings path" } };
    }
    writeSettingsFile(path, hooks);
    ctx.audit?.({ ts: Date.now(), action: "save-hooks", payload: { scope, path } });
    return { status: 200, body: { saved: true, path } };
  }
  if (method === "POST" && rest[0] === "reload") {
    if (!ctx.reloadHooks) {
      return {
        status: 503,
        body: { error: "reload requires an attached session \u2014 App.tsx wires the callback" }
      };
    }
    const count = ctx.reloadHooks();
    ctx.audit?.({ ts: Date.now(), action: "reload-hooks", payload: { count } });
    return { status: 200, body: { reloaded: true, count } };
  }
  return { status: 405, body: { error: `method ${method} not supported on this path` } };
}

// src/server/api/index-config.ts
var PREVIEW_INCLUDED_CAP = 50;
var PREVIEW_PER_REASON_CAP = 10;
function parseBody3(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
function isStringArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
async function handleIndexConfig(method, rest, body, ctx) {
  if (rest[0] === "preview" && method === "POST") {
    return await handlePreview(body, ctx);
  }
  if (method === "GET") {
    const user = loadIndexUserConfig(ctx.configPath);
    const resolved = resolveIndexConfig(user);
    return {
      status: 200,
      body: {
        user,
        resolved,
        defaults: {
          excludeDirs: [...DEFAULT_INDEX_EXCLUDES.dirs],
          excludeFiles: [...DEFAULT_INDEX_EXCLUDES.files],
          excludeExts: [...DEFAULT_INDEX_EXCLUDES.exts],
          excludePatterns: [],
          respectGitignore: DEFAULT_RESPECT_GITIGNORE,
          includeKnowledgeDocs: false,
          maxFileBytes: DEFAULT_MAX_FILE_BYTES
        }
      }
    };
  }
  if (method === "POST") {
    const fields = parseBody3(body);
    const next = {};
    const changed = [];
    if (fields.excludeDirs !== void 0) {
      if (!isStringArray(fields.excludeDirs)) {
        return { status: 400, body: { error: "excludeDirs must be string[]" } };
      }
      next.excludeDirs = fields.excludeDirs;
      changed.push("excludeDirs");
    }
    if (fields.excludeFiles !== void 0) {
      if (!isStringArray(fields.excludeFiles)) {
        return { status: 400, body: { error: "excludeFiles must be string[]" } };
      }
      next.excludeFiles = fields.excludeFiles;
      changed.push("excludeFiles");
    }
    if (fields.excludeExts !== void 0) {
      if (!isStringArray(fields.excludeExts)) {
        return { status: 400, body: { error: "excludeExts must be string[]" } };
      }
      next.excludeExts = fields.excludeExts;
      changed.push("excludeExts");
    }
    if (fields.excludePatterns !== void 0) {
      if (!isStringArray(fields.excludePatterns)) {
        return { status: 400, body: { error: "excludePatterns must be string[]" } };
      }
      next.excludePatterns = fields.excludePatterns;
      changed.push("excludePatterns");
    }
    if (fields.respectGitignore !== void 0) {
      if (typeof fields.respectGitignore !== "boolean") {
        return { status: 400, body: { error: "respectGitignore must be boolean" } };
      }
      next.respectGitignore = fields.respectGitignore;
      changed.push("respectGitignore");
    }
    if (fields.includeKnowledgeDocs !== void 0) {
      if (typeof fields.includeKnowledgeDocs !== "boolean") {
        return { status: 400, body: { error: "includeKnowledgeDocs must be boolean" } };
      }
      next.includeKnowledgeDocs = fields.includeKnowledgeDocs;
      changed.push("includeKnowledgeDocs");
    }
    if (fields.maxFileBytes !== void 0) {
      if (typeof fields.maxFileBytes !== "number" || fields.maxFileBytes <= 0) {
        return { status: 400, body: { error: "maxFileBytes must be a positive number" } };
      }
      next.maxFileBytes = fields.maxFileBytes;
      changed.push("maxFileBytes");
    }
    const cfg = readConfig(ctx.configPath);
    cfg.index = { ...cfg.index ?? {}, ...next };
    writeConfig(cfg, ctx.configPath);
    if (changed.length > 0) {
      ctx.audit?.({ ts: Date.now(), action: "set-index-config", payload: { fields: changed } });
    }
    return { status: 200, body: { changed, resolved: resolveIndexConfig(cfg.index) } };
  }
  return { status: 405, body: { error: "GET or POST only" } };
}
async function handlePreview(body, ctx) {
  const root = ctx.getCurrentCwd?.();
  if (!root) {
    return {
      status: 400,
      body: { error: "preview requires a code-mode session (no project root attached)" }
    };
  }
  const fields = parseBody3(body);
  const draft = {};
  if (isStringArray(fields.excludeDirs)) draft.excludeDirs = fields.excludeDirs;
  if (isStringArray(fields.excludeFiles)) draft.excludeFiles = fields.excludeFiles;
  if (isStringArray(fields.excludeExts)) draft.excludeExts = fields.excludeExts;
  if (isStringArray(fields.excludePatterns)) draft.excludePatterns = fields.excludePatterns;
  if (typeof fields.respectGitignore === "boolean")
    draft.respectGitignore = fields.respectGitignore;
  if (typeof fields.maxFileBytes === "number" && fields.maxFileBytes > 0) {
    draft.maxFileBytes = fields.maxFileBytes;
  }
  const resolved = resolveIndexConfig(draft);
  const skipBuckets = {
    defaultDir: 0,
    defaultFile: 0,
    binaryExt: 0,
    binaryContent: 0,
    tooLarge: 0,
    gitignore: 0,
    pattern: 0,
    readError: 0
  };
  const skipSamples = {
    defaultDir: [],
    defaultFile: [],
    binaryExt: [],
    binaryContent: [],
    tooLarge: [],
    gitignore: [],
    pattern: [],
    readError: []
  };
  const includedFiles = /* @__PURE__ */ new Set();
  const sampleIncluded = [];
  for await (const chunk of walkChunks(root, {
    config: resolved,
    onSkip: (rel, reason) => {
      skipBuckets[reason]++;
      const bucket = skipSamples[reason];
      if (bucket.length < PREVIEW_PER_REASON_CAP) bucket.push(rel);
    }
  })) {
    if (!includedFiles.has(chunk.path)) {
      includedFiles.add(chunk.path);
      if (sampleIncluded.length < PREVIEW_INCLUDED_CAP) sampleIncluded.push(chunk.path);
    }
  }
  return {
    status: 200,
    body: {
      filesIncluded: includedFiles.size,
      sampleIncluded,
      skipBuckets,
      skipSamples,
      resolved
    }
  };
}

// src/server/api/loop.ts
function parseBody4(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
var MIN_INTERVAL_MS = 5e3;
var MAX_INTERVAL_MS = 6 * 60 * 60 * 1e3;
async function handleLoop(method, rest, body, ctx) {
  if (method === "GET" && rest[0] === "status") {
    if (!ctx.getLoopRunStatus) {
      return { status: 503, body: { error: "auto-loop not available \u2014 attach to a chat session" } };
    }
    return { status: 200, body: { deprecated: true, replacement: "/api/schedules", status: ctx.getLoopRunStatus() } };
  }
  if (method === "POST" && rest[0] === "start") {
    if (!ctx.startAutoLoop) {
      return { status: 503, body: { error: "auto-loop start not wired" } };
    }
    const { intervalMs, prompt } = parseBody4(body);
    if (typeof prompt !== "string" || !prompt.trim()) {
      return { status: 400, body: { error: "prompt must be a non-empty string" } };
    }
    if (typeof intervalMs !== "number" || !Number.isFinite(intervalMs) || intervalMs < MIN_INTERVAL_MS || intervalMs > MAX_INTERVAL_MS) {
      return {
        status: 400,
        body: {
          error: `intervalMs must be a number in [${MIN_INTERVAL_MS}, ${MAX_INTERVAL_MS}] (5s..6h)`
        }
      };
    }
    ctx.startAutoLoop(intervalMs, prompt.trim());
    ctx.audit?.({ ts: Date.now(), action: "auto-loop-start", payload: { intervalMs } });
    return { status: 200, body: { deprecated: true, replacement: "/api/schedules", started: true } };
  }
  if (method === "POST" && rest[0] === "stop") {
    if (!ctx.stopAutoLoop) {
      return { status: 503, body: { error: "auto-loop stop not wired" } };
    }
    ctx.stopAutoLoop();
    ctx.audit?.({ ts: Date.now(), action: "auto-loop-stop" });
    return { status: 200, body: { deprecated: true, replacement: "/api/schedules", stopped: true } };
  }
  return {
    status: 405,
    body: { error: `method ${method} not supported on /api/loop/${rest[0] ?? ""}` }
  };
}

// src/server/api/schedules.ts
function parseBodySchedules(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
async function handleSchedules(method, rest, body, ctx) {
  if (method === "GET" && rest.length === 0) {
    if (!ctx.listSchedules) {
      return { status: 503, body: { error: "scheduled tasks are not available in this session" } };
    }
    return { status: 200, body: { schedules: ctx.listSchedules() } };
  }
  if (method === "POST" && rest.length === 0) {
    if (!ctx.createSchedule) {
      return { status: 503, body: { error: "scheduled task creation is not wired" } };
    }
    const result = ctx.createSchedule(parseBodySchedules(body));
    if (!result.ok) return { status: 400, body: { error: result.error || "failed to create schedule" } };
    ctx.audit?.({ ts: Date.now(), action: "schedule-create", payload: { id: result.schedule?.id } });
    return { status: 201, body: { schedule: result.schedule } };
  }
  const id = rest[0] || "";
  if (!id) {
    return { status: 405, body: { error: "GET/POST only" } };
  }
  if (method === "POST" && rest.length === 1) {
    if (!ctx.updateSchedule) {
      return { status: 503, body: { error: "scheduled task update is not wired" } };
    }
    const result = ctx.updateSchedule(id, parseBodySchedules(body));
    if (!result.ok) return { status: 400, body: { error: result.error || "failed to update schedule" } };
    ctx.audit?.({ ts: Date.now(), action: "schedule-update", payload: { id } });
    return { status: 200, body: { schedule: result.schedule } };
  }
  if (method === "POST" && rest[1] === "toggle") {
    if (!ctx.setScheduleEnabled) {
      return { status: 503, body: { error: "scheduled task toggle is not wired" } };
    }
    const parsed = parseBodySchedules(body);
    const result = ctx.setScheduleEnabled(id, parsed.enabled !== false);
    if (!result.ok) return { status: 400, body: { error: result.error || "failed to toggle schedule" } };
    ctx.audit?.({ ts: Date.now(), action: "schedule-toggle", payload: { id, enabled: result.schedule?.enabled } });
    return { status: 200, body: { schedule: result.schedule } };
  }
  if (method === "POST" && rest[1] === "run") {
    if (!ctx.runScheduleNow) {
      return { status: 503, body: { error: "scheduled task run is not wired" } };
    }
    const result = await ctx.runScheduleNow(id);
    if (!result.ok) return { status: 400, body: { error: result.error || "failed to run schedule" } };
    ctx.audit?.({ ts: Date.now(), action: "schedule-run", payload: { id, accepted: result.accepted } });
    return { status: result.accepted ? 202 : 409, body: result.accepted ? result : { ...result, error: result.reason || "scheduled task was not accepted" } };
  }
  if (method === "POST" && rest[1] === "cancel") {
    if (!ctx.cancelScheduleRun) {
      return { status: 503, body: { error: "scheduled task cancellation is not wired" } };
    }
    const result = await ctx.cancelScheduleRun(id);
    if (!result.ok) return { status: 409, body: { ...result, error: result.error || "failed to cancel schedule" } };
    ctx.audit?.({ ts: Date.now(), action: "schedule-cancel", payload: { id, runId: result.runId } });
    return { status: 202, body: result };
  }
  if (method === "DELETE" && rest.length === 1) {
    if (!ctx.deleteSchedule) {
      return { status: 503, body: { error: "scheduled task deletion is not wired" } };
    }
    const result = ctx.deleteSchedule(id);
    if (!result.ok) return { status: 400, body: { error: result.error || "failed to delete schedule" } };
    ctx.audit?.({ ts: Date.now(), action: "schedule-delete", payload: { id } });
    return { status: 200, body: { deleted: true } };
  }
  return {
    status: 405,
    body: { error: `method ${method} not supported on /api/schedules/${rest.join("/")}` }
  };
}

// src/server/api/mcp.ts
function parseBody5(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
function clampInt(raw, min, max, fallback) {
  if (raw == null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function findRegistryEntry(entries, name) {
  const exact = entries.find((e) => e.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  const ci = entries.find((e) => e.name.toLowerCase() === lower);
  if (ci) return ci;
  const tail = entries.find((e) => e.name.toLowerCase().endsWith(`/${lower}`));
  if (tail) return tail;
  return null;
}
async function handleMcp(method, rest, body, ctx, query = new URLSearchParams()) {
  if (method === "GET" && rest.length === 0) {
    const servers = (ctx.mcpServers ?? []).map((s) => ({
      label: s.label,
      spec: s.spec,
      toolCount: s.toolCount,
      protocolVersion: s.report.protocolVersion,
      serverInfo: s.report.serverInfo,
      capabilities: s.report.capabilities,
      tools: s.report.tools.supported ? s.report.tools.items : [],
      resources: s.report.resources.supported ? s.report.resources.items : [],
      prompts: s.report.prompts.supported ? s.report.prompts.items : [],
      instructions: s.report.instructions ?? null
    }));
    return {
      status: 200,
      body: {
        servers,
        canHotReload: Boolean(ctx.reloadMcp),
        canInvoke: Boolean(ctx.invokeMcpTool)
      }
    };
  }
  if (method === "GET" && rest[0] === "specs") {
    const cfg = readConfig(ctx.configPath);
    return { status: 200, body: { specs: cfg.mcp ?? [] } };
  }
  if (method === "POST" && rest[0] === "specs") {
    const { spec } = parseBody5(body);
    if (typeof spec !== "string" || !spec.trim()) {
      return { status: 400, body: { error: "spec (non-empty string) required" } };
    }
    const cfg = readConfig(ctx.configPath);
    const list = cfg.mcp ?? [];
    if (list.includes(spec)) {
      return { status: 200, body: { added: false, alreadyPresent: true } };
    }
    cfg.mcp = [...list, spec.trim()];
    writeConfig(cfg, ctx.configPath);
    ctx.audit?.({ ts: Date.now(), action: "add-mcp-spec", payload: { spec } });
    let bridged = false;
    if (ctx.reloadMcp) {
      try {
        await ctx.reloadMcp();
        bridged = true;
      } catch {
      }
    }
    return { status: 200, body: { added: true, requiresRestart: !bridged, bridged } };
  }
  if (method === "DELETE" && rest[0] === "specs") {
    const { spec } = parseBody5(body);
    if (typeof spec !== "string") {
      return { status: 400, body: { error: "spec (string) required" } };
    }
    const cfg = readConfig(ctx.configPath);
    const list = cfg.mcp ?? [];
    if (!list.includes(spec)) {
      return { status: 200, body: { removed: false } };
    }
    cfg.mcp = list.filter((s) => s !== spec);
    writeConfig(cfg, ctx.configPath);
    ctx.audit?.({ ts: Date.now(), action: "remove-mcp-spec", payload: { spec } });
    let bridged = false;
    if (ctx.reloadMcp) {
      try {
        await ctx.reloadMcp();
        bridged = true;
      } catch {
      }
    }
    return { status: 200, body: { removed: true, requiresRestart: !bridged, bridged } };
  }
  if (method === "POST" && rest[0] === "reload") {
    if (!ctx.reloadMcp) {
      return {
        status: 503,
        body: {
          error: "live MCP reload not wired in this session \u2014 restart `visionox code` to apply spec edits."
        }
      };
    }
    const count = await ctx.reloadMcp();
    return { status: 200, body: { reloaded: true, count } };
  }
  if (method === "GET" && rest[0] === "registry" && (rest[1] === void 0 || rest[1] === "list")) {
    const pagesWanted = clampInt(query.get("pages"), 1, 200, 1);
    const maxPages = clampInt(query.get("maxPages"), 1, 200, 20);
    const limit = clampInt(query.get("limit"), 1, 1e3, 30);
    const refreshRaw = query.get("refresh");
    const refresh = refreshRaw === "1" || refreshRaw === "true";
    const q = (query.get("q") ?? "").trim().toLowerCase();
    try {
      const handle = await openRegistry({ noCache: refresh });
      const target = q ? maxPages : pagesWanted;
      const additional = Math.max(0, target - handle.cache.pagination.pagesLoaded);
      if (additional > 0) {
        await loadMorePages(handle, {
          pages: additional,
          matchTarget: q ? limit : void 0,
          filter: q ? (e) => `${e.name} ${e.title} ${e.description}`.toLowerCase().includes(q) : void 0
        });
      }
      const result = handleToFetchResult(handle);
      const matched = q ? result.entries.filter(
        (e) => `${e.name} ${e.title} ${e.description}`.toLowerCase().includes(q)
      ) : result.entries;
      const ranked = matched.slice().sort((a, b) => {
        const ap = a.popularity ?? -1;
        const bp = b.popularity ?? -1;
        if (ap !== bp) return bp - ap;
        return a.name.localeCompare(b.name);
      });
      return {
        status: 200,
        body: {
          source: result.source,
          fromCache: result.fromCache,
          fetchedAt: result.fetchedAt,
          loaded: result.entries.length,
          hasMore: result.hasMore,
          matched: matched.length,
          entries: ranked.slice(0, limit),
          errors: result.errors
        }
      };
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
  }
  if (method === "POST" && rest[0] === "registry" && rest[1] === "install") {
    const { name, maxPages } = parseBody5(body);
    if (typeof name !== "string" || !name.trim()) {
      return { status: 400, body: { error: "name (string) required" } };
    }
    const cap = typeof maxPages === "number" && maxPages > 0 ? maxPages : 30;
    try {
      const handle = await openRegistry({});
      const target = name.trim();
      const lower = target.toLowerCase();
      const filter = (e) => {
        const n = e.name.toLowerCase();
        return n === lower || n.endsWith(`/${lower}`) || n.includes(lower);
      };
      const additional = Math.max(0, cap - handle.cache.pagination.pagesLoaded);
      if (additional > 0) {
        await loadMorePages(handle, { pages: additional, matchTarget: 1, filter });
      }
      const entry = findRegistryEntry(handle.cache.entries, target);
      if (!entry) {
        return {
          status: 404,
          body: {
            error: `no MCP server named "${target}" found in ${handle.cache.pagination.pagesLoaded} page(s)`
          }
        };
      }
      if (!entry.install && entry.source === "smithery") {
        const fetched = await fetchSmitheryDetail(entry.name);
        if (fetched) entry.install = fetched;
      }
      if (!entry.install) {
        return {
          status: 422,
          body: {
            error: `Could not derive install metadata for ${entry.name}`,
            hint: `npx -y @smithery/cli install ${entry.name}`
          }
        };
      }
      const spec = specStringFor(entry.name, entry.install);
      const cfg = readConfig(ctx.configPath);
      const existing = cfg.mcp ?? [];
      if (existing.includes(spec)) {
        return { status: 200, body: { added: false, alreadyPresent: true, spec, entry } };
      }
      cfg.mcp = [...existing, spec];
      writeConfig(cfg, ctx.configPath);
      ctx.audit?.({
        ts: Date.now(),
        action: "install-mcp-from-registry",
        payload: { name: entry.name, spec }
      });
      let bridged = false;
      let bridgeError;
      if (ctx.reloadMcp) {
        try {
          await ctx.reloadMcp();
          bridged = true;
        } catch (err) {
          bridgeError = err.message;
        }
      }
      return {
        status: 200,
        body: {
          added: true,
          requiresRestart: !ctx.reloadMcp || !!bridgeError,
          bridged,
          bridgeError,
          spec,
          entry
        }
      };
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
  }
  if (method === "POST" && rest[0] === "invoke") {
    if (!ctx.invokeMcpTool) {
      return {
        status: 503,
        body: { error: "MCP invocation requires an attached session." }
      };
    }
    const { server, tool, args } = parseBody5(body);
    if (typeof server !== "string" || typeof tool !== "string") {
      return { status: 400, body: { error: "server + tool (strings) required" } };
    }
    try {
      const result = await ctx.invokeMcpTool(
        server,
        tool,
        typeof args === "object" && args !== null ? args : {}
      );
      return { status: 200, body: { result } };
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
  }
  return { status: 405, body: { error: `method ${method} not supported on this path` } };
}

// src/server/api/memory.ts
import { createHash } from "crypto";
import {
  existsSync as existsSync5,
  mkdirSync as mkdirSync2,
  readFileSync as readFileSync4,
  readdirSync as readdirSync3,
  renameSync as renameSync2,
  statSync as statSync3,
  unlinkSync,
  writeFileSync as writeFileSync2
} from "fs";
import { homedir as homedir2 } from "os";
import { basename, dirname as dirname3, join as join5, resolve as resolvePath } from "path";
var SOUL_MAX_CHARS = 16e3;
var SOUL_NAME_START = "<!-- visionox:soul:name:start -->";
var SOUL_NAME_END = "<!-- visionox:soul:name:end -->";
function projectHash(rootDir) {
  return createHash("sha1").update(resolvePath(rootDir)).digest("hex").slice(0, 16);
}
function globalMemoryDir(homeDir = join5(homedir2(), ".visionox")) {
  return join5(homeDir, "memory", "global");
}
function atomicWriteMemoryFile(path, contents) {
  const temp = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  try {
    writeFileSync2(temp, contents, "utf8");
    renameSync2(temp, path);
  } finally {
    if (existsSync5(temp)) unlinkSync(temp);
  }
}
function projectMemoryDir(rootDir, homeDir = join5(homedir2(), ".visionox")) {
  return join5(homeDir, "memory", projectHash(rootDir));
}
function parseBody6(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
var SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
function listMemoryFiles(dir, scope) {
  if (!existsSync5(dir)) return [];
  try {
    return readdirSync3(dir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md").map((f) => {
      const path = join5(dir, f);
      const stat = statSync3(path);
      let data = {};
      let searchText = "";
      let malformed = false;
      try {
        const parsed = parseFrontmatter(readFileSync4(path, "utf8"));
        data = parsed.data ?? {};
        searchText = String(parsed.body ?? "").slice(0, 2e4);
      } catch {
        malformed = true;
      }
      return {
        name: f.replace(/\.md$/, ""),
        description: String(data.description ?? f.replace(/\.md$/, "")),
        type: String(data.type ?? "user"),
        scope,
        priority: ["low", "medium", "high"].includes(data.priority) ? data.priority : "medium",
        createdAt: data.created ?? null,
        updatedAt: data.updated ?? stat.mtime.toISOString(),
        source: data.source ?? "unknown",
        malformed,
        size: stat.size,
        mtime: stat.mtime.getTime(),
        revision: `${stat.mtimeMs}:${stat.size}`,
        searchText
      };
    }).sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}
function memoryDescription(raw, fallback) {
  const match = String(raw ?? "").match(/^description:\s*(.+)$/m);
  if (!match) return fallback;
  return match[1].replace(/^["']|["']$/g, "").trim() || fallback;
}
function rebuildMemoryIndex(dir) {
  if (!dir || !existsSync5(dir)) return;
  let files = [];
  try {
    files = readdirSync3(dir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md").sort((a, b) => a.localeCompare(b));
  } catch {
    return;
  }
  const indexPath = join5(dir, "MEMORY.md");
  if (files.length === 0) {
    if (existsSync5(indexPath)) unlinkSync(indexPath);
    return;
  }
  const lines = files.map((file) => {
    const name = file.replace(/\.md$/, "");
    let raw = "";
    try {
      raw = readFileSync4(join5(dir, file), "utf8");
    } catch {
    }
    return `- [${name}](${file}) — ${memoryDescription(raw, name)}`;
  });
  writeFileSync2(indexPath, `${lines.join("\n")}\n`, "utf8");
}
function fileMeta(path) {
  if (!path || !existsSync5(path)) return { path, exists: false, size: 0, mtime: null };
  try {
    const stat = statSync3(path);
    return { path, exists: true, size: stat.size, mtime: stat.mtime.getTime() };
  } catch {
    return { path, exists: false, size: 0, mtime: null };
  }
}
function fileRevision(path) {
  if (!path || !existsSync5(path)) return null;
  const stat = statSync3(path);
  return `${stat.mtimeMs}:${stat.size}`;
}
function readSoulName(raw) {
  const match = String(raw ?? "").match(new RegExp(`${SOUL_NAME_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\r?\\n([\\s\\S]*?)\\r?\\n${SOUL_NAME_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  if (!match) return "";
  const line = match[1].trim();
  return line.replace(/^你的名字是\s*/, "").replace(/[。.\s]+$/, "").trim();
}
function soulNamePattern() {
  return new RegExp(`${SOUL_NAME_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\r?\\n[\\s\\S]*?\\r?\\n${SOUL_NAME_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\r?\\n*`, "g");
}
function stripSoulNameBlocks(raw) {
  return String(raw ?? "").replace(soulNamePattern(), "").trim();
}
function normalizeSoulName(name) {
  const value = String(name ?? "").trim();
  if (/\r|\n/.test(value)) throw new Error("AI name must be a single line");
  if (value.length > 80) throw new Error("AI name exceeds 80 characters");
  return value;
}
function setSoulNameBlock(raw, name) {
  const trimmedName = normalizeSoulName(name);
  const current = stripSoulNameBlocks(raw);
  const block = trimmedName ? `${SOUL_NAME_START}\n你的名字是 ${trimmedName}。\n${SOUL_NAME_END}` : "";
  return block ? `${block}\n\n${current}`.trim() + "\n" : `${current}\n`;
}
function soulHistoryDir(memoryHomeDir) {
  return join5(memoryHomeDir, "soul-history");
}
function listSoulHistory(memoryHomeDir) {
  const dir = soulHistoryDir(memoryHomeDir);
  if (!existsSync5(dir)) return [];
  return readdirSync3(dir).filter((name) => /^[a-zA-Z0-9_-]+\.md$/.test(name)).map((name) => {
    const path = join5(dir, name);
    const stat = statSync3(path);
    const raw = readFileSync4(path, "utf8");
    return { id: name.slice(0, -3), savedAt: stat.mtime.toISOString(), name: readSoulName(raw), size: stat.size };
  }).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 20);
}
function snapshotSoul(memoryHomeDir, soulPath) {
  if (!existsSync5(soulPath)) return null;
  const dir = soulHistoryDir(memoryHomeDir);
  mkdirSync2(dir, { recursive: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  atomicWriteMemoryFile(join5(dir, `${id}.md`), readFileSync4(soulPath, "utf8"));
  const files = readdirSync3(dir).filter((name) => /^[a-zA-Z0-9_-]+\.md$/.test(name)).sort().reverse();
  for (const old of files.slice(20)) unlinkSync(join5(dir, old));
  return id;
}
function memoryTrashDir(memoryHomeDir) {
  return join5(memoryHomeDir, "memory-trash");
}
function writeMemoryTrash(memoryHomeDir, entry) {
  const dir = memoryTrashDir(memoryHomeDir);
  mkdirSync2(dir, { recursive: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  atomicWriteMemoryFile(join5(dir, `${id}.json`), `${JSON.stringify({ ...entry, id, deletedAt: new Date().toISOString() }, null, 2)}\n`);
  return id;
}
function readMemoryTrash(memoryHomeDir, id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  const path = join5(memoryTrashDir(memoryHomeDir), `${id}.json`);
  if (!existsSync5(path)) return null;
  try { return JSON.parse(readFileSync4(path, "utf8")); } catch { return null; }
}
function listMemoryTrash(memoryHomeDir) {
  const dir = memoryTrashDir(memoryHomeDir);
  if (!existsSync5(dir)) return [];
  return readdirSync3(dir).filter((name) => /^[a-zA-Z0-9_-]+\.json$/.test(name)).map((name) => readMemoryTrash(memoryHomeDir, name.slice(0, -5))).filter(Boolean).sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt))).slice(0, 100);
}
async function handleMemory(method, rest, body, ctx) {
  const cwd = ctx.getCurrentCwd?.();
  const memoryHomeDir = typeof ctx.memoryHomeDir === "string" && ctx.memoryHomeDir ? ctx.memoryHomeDir : join5(homedir2(), ".visionox");
  const soulPath = join5(memoryHomeDir, "soul.md");
  const globalDir = globalMemoryDir(memoryHomeDir);
  const projectMemDir = cwd ? projectMemoryDir(cwd, memoryHomeDir) : "";
  const store = new MemoryStore({ homeDir: memoryHomeDir, projectRoot: cwd || void 0 });
  if (method === "GET" && rest.length === 0) {
    const projectMemoryPaths = cwd ? listProjectMemoryPaths(cwd) : [];
    const projectStatus = ctx.getProjectMemoryStatus?.() ?? null;
    const existingProjectMemory = projectMemoryPaths[0] ?? null;
    const projectMemoryPath = existingProjectMemory ?? (cwd ? join5(cwd, PROJECT_MEMORY_FILE) : null);
    const projectMemoryExists = existingProjectMemory !== null;
    const globalFiles = listMemoryFiles(globalDir, "global");
    const projectFiles = projectMemDir ? listMemoryFiles(projectMemDir, "project") : [];
    const memoryRuntime = ctx.getMemoryRuntimeStatus?.() ?? null;
    let diagnostics = { duplicates: [], conflicts: [], sensitiveKeys: [] };
    try {
      diagnostics = analyzeMemoryEntries(store.list().map((entry) => ({ ...entry, key: `${entry.scope}:${entry.name}` })));
    } catch {
    }
    return {
      status: 200,
      body: {
        project: {
          path: projectMemoryPath,
          exists: projectMemoryExists,
          file: projectMemoryPath ? basename(projectMemoryPath) : PROJECT_MEMORY_FILE,
          id: cwd ? projectHash(cwd) : null,
          files: projectMemoryPaths.map((path) => ({ ...fileMeta(path), path, name: basename(path), ...(projectStatus?.files?.find((item) => item.path === path) ?? {}) })),
          totalChars: projectStatus?.totalChars ?? 0,
          maxChars: projectStatus?.maxChars ?? null
        },
        global: {
          path: globalDir,
          files: globalFiles
        },
        projectMem: {
          path: projectMemDir,
          files: projectFiles
        },
        soul: {
          ...fileMeta(soulPath),
          name: existsSync5(soulPath) ? readSoulName(readFileSync4(soulPath, "utf8")) : ""
        },
        modeMemory: ctx.getAllModeMemory?.() ?? null,
        session: { items: ctx.getSessionMemories?.() ?? [] },
        trash: { items: listMemoryTrash(memoryHomeDir) },
        workspace: cwd ? { path: cwd, name: basename(cwd) } : null,
        injection: memoryRuntime?.next ?? ctx.getMemoryInjectionStatus?.() ?? null,
        runtime: memoryRuntime,
        diagnostics
      }
    };
  }
  const [scope, ...nameParts] = rest;
  const name = nameParts.join("/");
  if (method === "GET") {
    if (scope === "trash") return { status: 200, body: { items: listMemoryTrash(memoryHomeDir) } };
    if (scope === "soul") {
      if (name === "history") return { status: 200, body: { items: listSoulHistory(memoryHomeDir) } };
      const body2 = existsSync5(soulPath) ? readFileSync4(soulPath, "utf8") : "";
      return { status: 200, body: { path: soulPath, body: stripSoulNameBlocks(body2), name: readSoulName(body2), revision: fileRevision(soulPath), chars: body2.length, maxChars: SOUL_MAX_CHARS, history: listSoulHistory(memoryHomeDir), atomic: true } };
    }
    if (scope === "project") {
      if (!cwd) return { status: 503, body: { error: "no active project" } };
      const path = findProjectMemoryPath(cwd);
      if (!path) return { status: 404, body: { error: "project memory file not found" } };
      return { status: 200, body: { path, body: readFileSync4(path, "utf8") } };
    }
    if (scope === "session" && name) {
      const item = (ctx.getSessionMemories?.() ?? []).find((entry) => entry.name === name);
      return item ? { status: 200, body: { entry: item } } : { status: 404, body: { error: "not found" } };
    }
    if ((scope === "global" || scope === "project-mem") && name && SAFE_NAME.test(name)) {
      const dir = scope === "global" ? globalDir : projectMemDir;
      if (!dir) return { status: 503, body: { error: "no project root for project-mem" } };
      const path = join5(dir, `${name}.md`);
      if (!existsSync5(path)) return { status: 404, body: { error: "not found" } };
      const memoryScope = scope === "global" ? "global" : "project";
      return { status: 200, body: { path, body: readFileSync4(path, "utf8"), entry: store.read(memoryScope, name), revision: fileRevision(path) } };
    }
    return { status: 400, body: { error: "bad scope or name" } };
  }
  if (method === "POST") {
    const parsed = parseBody6(body);
    const { body: contents } = parsed;
    if (scope === "apply") {
      if (ctx.isBusy?.()) return { status: 409, body: { error: "memory cannot be applied while an answer is running" } };
      const result = ctx.applyMemoryChanges?.();
      return result ? { status: 200, body: result } : { status: 501, body: { error: "memory apply is not available" } };
    }
    if (scope === "trash" && rest[1] && rest[2] === "restore") {
      const item = readMemoryTrash(memoryHomeDir, rest[1]);
      if (!item) return { status: 404, body: { error: "trash item not found" } };
      if (item.kind === "mode") {
        const result = ctx.restoreModeMemoryTrash?.(item);
        if (!result) return { status: 409, body: { error: "mode memory could not be restored" } };
      } else {
        const targetDir = item.scope === "global" ? globalDir : projectMemDir;
        if (!targetDir) return { status: 503, body: { error: "project is not active" } };
        const target = join5(targetDir, `${item.name}.md`);
        if (existsSync5(target)) return { status: 409, body: { error: "a memory with the same name already exists" } };
        mkdirSync2(targetDir, { recursive: true });
        atomicWriteMemoryFile(target, String(item.raw ?? ""));
        store.regenerateIndex(item.scope === "global" ? "global" : "project");
      }
      unlinkSync(join5(memoryTrashDir(memoryHomeDir), `${item.id}.json`));
      return { status: 200, body: { restored: true, item } };
    }
    if (scope === "soul") {
      if (rest[1] === "preview") {
        try {
          const finalBody = setSoulNameBlock(typeof contents === "string" ? contents : "", parsed.aiName ?? "");
          return { status: 200, body: { valid: finalBody.length <= SOUL_MAX_CHARS, finalBody, body: stripSoulNameBlocks(finalBody), name: readSoulName(finalBody), chars: finalBody.length, maxChars: SOUL_MAX_CHARS } };
        } catch (err) {
          return { status: 400, body: { error: err.message } };
        }
      }
      if (rest[1] === "reset") {
        const defaultSoul = ctx.getDefaultSoul?.();
        if (typeof defaultSoul !== "string" || !defaultSoul.trim()) return { status: 501, body: { error: "default soul is not available" } };
        snapshotSoul(memoryHomeDir, soulPath);
        atomicWriteMemoryFile(soulPath, `${defaultSoul.trim()}\n`);
        return { status: 200, body: { saved: true, reset: true, revision: fileRevision(soulPath) } };
      }
      if (rest[1] === "history" && rest[2] && rest[3] === "restore") {
        const id = rest[2];
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) return { status: 400, body: { error: "bad history id" } };
        const source = join5(soulHistoryDir(memoryHomeDir), `${id}.md`);
        if (!existsSync5(source)) return { status: 404, body: { error: "history version not found" } };
        snapshotSoul(memoryHomeDir, soulPath);
        atomicWriteMemoryFile(soulPath, readFileSync4(source, "utf8"));
        return { status: 200, body: { restored: true, revision: fileRevision(soulPath) } };
      }
      const current = existsSync5(soulPath) ? readFileSync4(soulPath, "utf8") : "";
      if (parsed.expectedRevision && parsed.expectedRevision !== fileRevision(soulPath)) return { status: 409, body: { error: "soul.md changed since it was opened" } };
      let finalBody;
      try {
        finalBody = setSoulNameBlock(typeof contents === "string" ? contents : stripSoulNameBlocks(current), parsed.aiName ?? readSoulName(current));
      } catch (err) {
        return { status: 400, body: { error: err.message } };
      }
      if (finalBody.length > SOUL_MAX_CHARS) return { status: 400, body: { error: `soul.md exceeds ${SOUL_MAX_CHARS} characters` } };
      mkdirSync2(dirname3(soulPath), { recursive: true });
      snapshotSoul(memoryHomeDir, soulPath);
      atomicWriteMemoryFile(soulPath, finalBody);
      ctx.audit?.({ ts: Date.now(), action: "save-memory", payload: { scope: "soul", path: soulPath } });
      return { status: 200, body: { saved: true, path: soulPath, name: readSoulName(finalBody), revision: fileRevision(soulPath), chars: finalBody.length, atomic: true } };
    }
    if (typeof contents !== "string") {
      return { status: 400, body: { error: "body (string) required" } };
    }
    if (scope === "project") {
      if (!cwd) return { status: 503, body: { error: "no active project" } };
      const path = resolveProjectMemoryWritePath(cwd);
      mkdirSync2(dirname3(path), { recursive: true });
      writeFileSync2(path, contents, "utf8");
      ctx.audit?.({ ts: Date.now(), action: "save-memory", payload: { scope, path } });
      return { status: 200, body: { saved: true, path } };
    }
    if ((scope === "global" || scope === "project-mem") && name && SAFE_NAME.test(name)) {
      const memoryScope = scope === "global" ? "global" : "project";
      if (memoryScope === "project" && !cwd) return { status: 503, body: { error: "no project root for project-mem" } };
      const overwrite = parsed.overwrite === true;
      try {
        const currentPath = join5(memoryScope === "global" ? globalDir : projectMemDir, `${name}.md`);
        if (overwrite && parsed.expectedRevision && parsed.expectedRevision !== fileRevision(currentPath)) {
          return { status: 409, body: { error: "memory changed since it was opened" } };
        }
        const parsedMemory = parseFrontmatter(contents);
        const existing = overwrite ? (() => {
          try {
            return store.read(memoryScope, name);
          } catch {
            return null;
          }
        })() : null;
        const description = String(parsedMemory.data?.description ?? existing?.description ?? "").trim();
        const memoryBody = String(parsedMemory.body ?? contents).trim();
        const path = store.write({
          name,
          description,
          type: parsedMemory.data?.type ?? existing?.type ?? "user",
          scope: memoryScope,
          body: memoryBody,
          priority: parsedMemory.data?.priority ?? existing?.priority,
          expires: parsedMemory.data?.expires ?? existing?.expires,
          source: parsedMemory.data?.source ?? existing?.source ?? "ui"
        }, { overwrite });
        ctx.audit?.({ ts: Date.now(), action: overwrite ? "update-memory" : "create-memory", payload: { scope, name, path } });
        return { status: 200, body: { saved: true, created: !overwrite, updated: overwrite, path, revision: fileRevision(path), appliesAt: "next-context-rebuild" } };
      } catch (err) {
        const status = /already exists/i.test(err.message) ? 409 : 400;
        return { status, body: { error: err.message } };
      }
    }
    return { status: 400, body: { error: "bad scope or name" } };
  }
  if (method === "DELETE") {
    if (scope === "session" && name) {
      const deleted = ctx.deleteSessionMemory?.(name) ?? false;
      return deleted ? { status: 200, body: { deleted: true } } : { status: 404, body: { error: "not found" } };
    }
    if ((scope === "global" || scope === "project-mem") && name && SAFE_NAME.test(name)) {
      const memoryScope = scope === "global" ? "global" : "project";
      if (memoryScope === "project" && !cwd) return { status: 503, body: { error: "no project root for project-mem" } };
      try {
        const sourceDir = memoryScope === "global" ? globalDir : projectMemDir;
        const sourcePath = join5(sourceDir, `${name}.md`);
        const raw = existsSync5(sourcePath) ? readFileSync4(sourcePath, "utf8") : null;
        if (raw === null) return { status: 404, body: { error: "not found" } };
        const trashId = writeMemoryTrash(memoryHomeDir, { kind: "persistent", scope: memoryScope, name, raw });
        try {
          if (!store.delete(memoryScope, name)) throw new Error("memory disappeared before deletion");
        } catch (err) {
          try { unlinkSync(join5(memoryTrashDir(memoryHomeDir), `${trashId}.json`)); } catch {}
          throw err;
        }
        ctx.audit?.({ ts: Date.now(), action: "delete-memory", payload: { scope, name } });
        return { status: 200, body: { deleted: true, trashId } };
      } catch (err) {
        return { status: 400, body: { error: err.message } };
      }
    }
    if (scope === "project") {
      if (!cwd) return { status: 503, body: { error: "no active project" } };
      const path = findProjectMemoryPath(cwd);
      if (path) {
        unlinkSync(path);
        ctx.audit?.({ ts: Date.now(), action: "delete-memory", payload: { scope, path } });
        return { status: 200, body: { deleted: true } };
      }
      return { status: 404, body: { error: "not found" } };
    }
    return { status: 400, body: { error: "bad scope or name" } };
  }
  return { status: 405, body: { error: `method ${method} not supported` } };
}

// src/server/api/mode-memory.ts
function parseBodyModeMemory(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
async function handleModeMemory(method, rest, body, ctx, query = new URLSearchParams()) {
  const bodyObj = parseBodyModeMemory(body);
  const modesInfo = ctx.getModes?.() ?? null;
  const currentMode = modesInfo?.current ?? "general";
  const queryMode = query.get("mode");
  const mode = typeof bodyObj.mode === "string" && bodyObj.mode ? bodyObj.mode : typeof queryMode === "string" && queryMode ? queryMode : currentMode;
  const modeIds = modesInfo?.list?.map((m) => m.id) ?? [];
  if (modeIds.length > 0 && !modeIds.includes(mode)) {
    return { status: 400, body: { error: "mode must be one of: " + modeIds.join(", ") } };
  }
  if (method === "GET") {
    if (rest[0] === "all") {
      const all = ctx.getAllModeMemory?.();
      if (!all) return { status: 501, body: { error: "mode memory is not available" } };
      return { status: 200, body: all };
    }
    const memory = ctx.getModeMemory?.(mode);
    if (!memory) return { status: 501, body: { error: "mode memory is not available" } };
    return { status: 200, body: memory };
  }
  if (method === "POST" && rest.length === 0) {
    if (typeof bodyObj.text !== "string" || !bodyObj.text.trim()) {
      return { status: 400, body: { error: "text (string) required" } };
    }
    if (bodyObj.text.trim().length > 180) return { status: 400, body: { error: "mode memory text exceeds 180 characters" } };
    const result = ctx.addModeMemory?.({
      text: bodyObj.text,
      keywords: Array.isArray(bodyObj.keywords) ? bodyObj.keywords : [],
      priority: bodyObj.priority,
      enabled: bodyObj.enabled !== false
    }, mode);
    if (!result) return { status: 501, body: { error: "mode memory is not available" } };
    ctx.audit?.({ ts: Date.now(), action: "add-mode-memory", payload: { mode, id: result.item?.id } });
    return { status: 200, body: result };
  }
  const id = decodeURIComponent(rest[0] || "");
  if (!id) return { status: 400, body: { error: "id required" } };
  if (method === "POST" && rest[1] === "move") {
    if (typeof bodyObj.targetMode !== "string" || !bodyObj.targetMode || bodyObj.targetMode === mode) return { status: 400, body: { error: "different targetMode required" } };
    if (modeIds.length > 0 && !modeIds.includes(bodyObj.targetMode)) return { status: 400, body: { error: "unknown target mode" } };
    const result = ctx.moveModeMemory?.(id, { sourceMode: mode, targetMode: bodyObj.targetMode, copy: bodyObj.copy === true });
    return result ? { status: 200, body: result } : { status: 404, body: { error: "not found" } };
  }
  if (method === "POST" && id === "batch") {
    const items = Array.isArray(bodyObj.items) ? bodyObj.items : [];
    if (!new Set(["enable", "disable", "delete"]).has(bodyObj.action) || items.length === 0) return { status: 400, body: { error: "valid action and items required" } };
    const result = ctx.batchModeMemory?.({ action: bodyObj.action, items });
    return result ? { status: 200, body: result } : { status: 501, body: { error: "batch mode memory is not available" } };
  }
  if (method === "PATCH") {
    const patch = {};
    if (bodyObj.text !== void 0) {
      if (typeof bodyObj.text !== "string" || !bodyObj.text.trim() || bodyObj.text.trim().length > 180) return { status: 400, body: { error: "mode memory text must contain 1-180 characters" } };
      patch.text = bodyObj.text;
    }
    if (bodyObj.keywords !== void 0) patch.keywords = Array.isArray(bodyObj.keywords) ? bodyObj.keywords : [];
    if (bodyObj.priority !== void 0) patch.priority = bodyObj.priority;
    if (bodyObj.enabled !== void 0) patch.enabled = Boolean(bodyObj.enabled);
    const result = ctx.updateModeMemory?.(id, patch, mode);
    if (!result) return { status: 404, body: { error: "not found" } };
    ctx.audit?.({ ts: Date.now(), action: "update-mode-memory", payload: { mode, id } });
    return { status: 200, body: result };
  }
  if (method === "DELETE") {
    const deleted = ctx.deleteModeMemory?.(id, mode);
    if (!deleted) return { status: 404, body: { error: "not found" } };
    ctx.audit?.({ ts: Date.now(), action: "delete-mode-memory", payload: { mode, id } });
    return { status: 200, body: { deleted: true } };
  }
  return { status: 405, body: { error: `method ${method} not supported` } };
}

// src/server/api/messages.ts
async function handleMessages(method, _rest, _body, ctx, query = new URLSearchParams()) {
  if (method !== "GET") {
    return { status: 405, body: { error: "GET only" } };
  }
  const messages = ctx.getMessages ? ctx.getMessages() : [];
  const parsedLimit = Number.parseInt(query.get("limit") || "200", 10);
  const parsedOffset = Number.parseInt(query.get("offset") || "0", 10);
  const limit = Math.min(500, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 200));
  const offset = Math.max(0, Number.isFinite(parsedOffset) ? parsedOffset : 0);
  const end = Math.max(0, messages.length - offset);
  const start = Math.max(0, end - limit);
  const page = messages.slice(start, end);
  return {
    status: 200,
    body: {
      messages: page,
      totalMessages: messages.length,
      startIndex: start,
      hasMore: start > 0,
      busy: ctx.isBusy ? ctx.isBusy() : false,
      operation: ctx.getActiveOperation ? ctx.getActiveOperation() : null
    }
  };
}

// src/server/api/modal.ts
function parsePickerResolution(body) {
  const { action, id, text, query } = body;
  if (typeof action !== "string") return { error: "picker action required" };
  switch (action) {
    case "pick":
    case "delete":
    case "install":
    case "uninstall":
      if (typeof id !== "string" || !id) return { error: `picker ${action} requires id` };
      return { action, id };
    case "rename":
      if (typeof id !== "string" || !id) return { error: "picker rename requires id" };
      if (typeof text !== "string") return { error: "picker rename requires text" };
      return { action: "rename", id, text };
    case "new":
      return typeof text === "string" && text ? { action: "new", text } : { action: "new" };
    case "load-more":
      return { action: "load-more" };
    case "refine":
      if (typeof query !== "string") return { error: "picker refine requires query" };
      return { action: "refine", query };
    case "cancel":
      return { action: "cancel" };
    default:
      return { error: `unknown picker action: ${action}` };
  }
}
function parseBody7(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
async function handleModal(method, rest, body, ctx) {
  if (method === "GET" && rest.length === 0) {
    return {
      status: 200,
      body: { modal: ctx.getActiveModal ? ctx.getActiveModal() : null }
    };
  }
  if (method === "POST" && rest[0] === "resolve") {
    const parsed = parseBody7(body);
    const { kind, choice, text, gateId } = parsed;
    const gateModal = kind === "shell" || kind === "choice" || kind === "plan" || kind === "checkpoint" || kind === "revision";
    if (gateModal && (!Number.isInteger(gateId) || gateId < 0)) {
      return { status: 400, body: { error: "modal gateId must be a non-negative integer" } };
    }
    if (kind === "shell") {
      if (!ctx.resolveShellConfirm) {
        return { status: 503, body: { error: "shell modal resolution not wired" } };
      }
      if (choice !== "run_once" && choice !== "always_allow" && choice !== "deny") {
        return {
          status: 400,
          body: { error: "shell choice must be run_once / always_allow / deny" }
        };
      }
      if (ctx.resolveShellConfirm(choice, gateId) === false) {
        return { status: 409, body: { error: "modal is no longer active" } };
      }
      return { status: 200, body: { resolved: true } };
    }
    if (kind === "choice") {
      if (!ctx.resolveChoiceConfirm) {
        return { status: 503, body: { error: "choice modal resolution not wired" } };
      }
      const c = choice;
      if (!c || typeof c !== "object") {
        return { status: 400, body: { error: "choice must be an object with a kind field" } };
      }
      if (c.kind === "pick" && typeof c.optionId === "string") {
        if (ctx.resolveChoiceConfirm({ kind: "pick", optionId: c.optionId }, gateId) === false) {
          return { status: 409, body: { error: "modal is no longer active" } };
        }
        return { status: 200, body: { resolved: true } };
      }
      if (c.kind === "custom" && typeof c.text === "string") {
        if (ctx.resolveChoiceConfirm({ kind: "custom", text: c.text }, gateId) === false) {
          return { status: 409, body: { error: "modal is no longer active" } };
        }
        return { status: 200, body: { resolved: true } };
      }
      if (c.kind === "cancel") {
        if (ctx.resolveChoiceConfirm({ kind: "cancel" }, gateId) === false) {
          return { status: 409, body: { error: "modal is no longer active" } };
        }
        return { status: 200, body: { resolved: true } };
      }
      return { status: 400, body: { error: "unknown choice resolution shape" } };
    }
    if (kind === "plan") {
      if (!ctx.resolvePlanConfirm) {
        return { status: 503, body: { error: "plan modal resolution not wired" } };
      }
      if (choice !== "approve" && choice !== "refine" && choice !== "cancel") {
        return { status: 400, body: { error: "plan choice must be approve / refine / cancel" } };
      }
      if (ctx.resolvePlanConfirm(choice, typeof text === "string" && text.trim() ? text : void 0, gateId) === false) {
        return { status: 409, body: { error: "modal is no longer active" } };
      }
      if (choice === "cancel") ctx.abortTurn?.();
      return { status: 200, body: { resolved: true } };
    }
    if (kind === "edit-review") {
      if (!ctx.resolveEditReview) {
        return { status: 503, body: { error: "edit-review modal resolution not wired" } };
      }
      if (choice !== "apply" && choice !== "reject" && choice !== "apply-rest-of-turn" && choice !== "flip-to-auto") {
        return { status: 400, body: { error: "edit-review choice invalid" } };
      }
      ctx.resolveEditReview(choice);
      return { status: 200, body: { resolved: true } };
    }
    if (kind === "checkpoint") {
      if (!ctx.resolveCheckpointConfirm) {
        return { status: 503, body: { error: "checkpoint modal resolution not wired" } };
      }
      if (choice !== "continue" && choice !== "revise" && choice !== "stop") {
        return {
          status: 400,
          body: { error: "checkpoint choice must be continue / revise / stop" }
        };
      }
      if (ctx.resolveCheckpointConfirm(
        choice,
        typeof text === "string" && text.trim() ? text : void 0,
        gateId
      ) === false) {
        return { status: 409, body: { error: "modal is no longer active" } };
      }
      if (choice === "stop") ctx.abortTurn?.();
      return { status: 200, body: { resolved: true } };
    }
    if (kind === "revision") {
      if (!ctx.resolveReviseConfirm) {
        return { status: 503, body: { error: "revision modal resolution not wired" } };
      }
      if (choice !== "accept" && choice !== "reject") {
        return { status: 400, body: { error: "revision choice must be accept / reject" } };
      }
      if (ctx.resolveReviseConfirm(choice, gateId) === false) {
        return { status: 409, body: { error: "modal is no longer active" } };
      }
      return { status: 200, body: { resolved: true } };
    }
    if (kind === "picker") {
      if (!ctx.resolvePicker) {
        return { status: 503, body: { error: "picker modal resolution not wired" } };
      }
      const resolution = parsePickerResolution(parsed);
      if ("error" in resolution) {
        return { status: 400, body: { error: resolution.error } };
      }
      ctx.resolvePicker(resolution);
      return { status: 200, body: { resolved: true } };
    }
    if (kind === "viewer") {
      if (!ctx.resolveViewer) {
        return { status: 503, body: { error: "viewer modal resolution not wired" } };
      }
      if (parsed.action !== "close") {
        return { status: 400, body: { error: "viewer action must be close" } };
      }
      ctx.resolveViewer({ action: "close" });
      return { status: 200, body: { resolved: true } };
    }
    return { status: 400, body: { error: `unknown modal kind: ${String(kind)}` } };
  }
  return { status: 405, body: { error: `method ${method} not supported on this path` } };
}

// src/server/api/models.ts
async function handleModels(method, _rest, _body, ctx) {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  const models = ctx.getModels?.() ?? null;
  const cfg = readConfig(ctx.configPath);
  const state = modelState(ctx, cfg);
  return {
    status: 200,
    body: {
      models,
      current: state.displayModel,
      configuredModel: state.configuredModel,
      effectiveModel: state.effectiveModel,
      runtimeModel: state.runtimeModel,
      displayModel: state.displayModel,
      modelDrift: state.modelDrift,
      preset: state.preset,
      /** USD per 1M tokens — same table the cost gauge uses. */
      pricing: DEEPSEEK_PRICING
    }
  };
}

// src/server/api/cockpit-events.ts
import { existsSync as existsSync6 } from "fs";
var DAY_MS = 864e5;
var RECENT_FILES_CAP = 8;
var PLAN_FEED_CAP = 4;
var TOOL_FEED_CAP = 12;
function computeEventsCockpit(now = Date.now(), sessionsDirOverride) {
  const dir = sessionsDirOverride ?? sessionsDir();
  if (!existsSync6(dir)) {
    return { toolCalls24h: null, recentPlans: null, toolActivity: null };
  }
  const files = recentEventFiles(dir, now, RECENT_FILES_CAP);
  if (files.length === 0) {
    return { toolCalls24h: null, recentPlans: null, toolActivity: null };
  }
  let calls24h = 0;
  let callsPrior24h = 0;
  const cutoff24h = now - DAY_MS;
  const cutoff48h = now - 2 * DAY_MS;
  const allTools = [];
  const allPlans = [];
  for (const file of files) {
    const events = readEventLogFile(file);
    if (events.length === 0) continue;
    countToolCalls(events, cutoff24h, cutoff48h, (in24h) => {
      if (in24h) calls24h++;
      else callsPrior24h++;
    });
    collectToolActivity(events, allTools);
    collectPlans(events, allPlans);
  }
  allTools.sort((a, b) => b.whenMs - a.whenMs);
  allPlans.sort((a, b) => b.whenMs - a.whenMs);
  return {
    toolCalls24h: { total: calls24h, delta: calls24h - callsPrior24h },
    recentPlans: allPlans.slice(0, PLAN_FEED_CAP),
    toolActivity: allTools.slice(0, TOOL_FEED_CAP)
  };
}
function countToolCalls(events, cutoff24h, cutoff48h, onCall) {
  for (const ev of events) {
    if (ev.type !== "tool.intent") continue;
    const ts = parseTs(ev.ts);
    if (ts === null) continue;
    if (ts >= cutoff24h) onCall(true);
    else if (ts >= cutoff48h) onCall(false);
  }
}
function collectToolActivity(events, into) {
  const intentByCallId = /* @__PURE__ */ new Map();
  for (const ev of events) {
    if (ev.type === "tool.intent") {
      const ts = parseTs(ev.ts);
      if (ts !== null) intentByCallId.set(ev.callId, { name: ev.name, args: ev.args, ts });
    } else if (ev.type === "tool.result") {
      const intent = intentByCallId.get(ev.callId);
      if (!intent) continue;
      into.push({
        name: intent.name,
        args: summarizeArgs(intent.args),
        level: ev.ok ? "ok" : "err",
        whenMs: intent.ts
      });
    } else if (ev.type === "tool.denied") {
      const intent = intentByCallId.get(ev.callId);
      if (!intent) continue;
      into.push({
        name: intent.name,
        args: summarizeArgs(intent.args),
        level: "warn",
        whenMs: intent.ts
      });
    }
  }
}
function collectPlans(events, into) {
  let current = null;
  let completed = /* @__PURE__ */ new Set();
  for (const ev of events) {
    if (ev.type === "plan.submitted") {
      if (current) {
        into.push(buildPlan(current, completed));
      }
      const ts = parseTs(ev.ts);
      if (ts === null) {
        current = null;
        continue;
      }
      current = {
        id: `${ev.id}`,
        title: planTitle(ev.body, ev.steps),
        totalSteps: ev.steps.length,
        whenMs: ts
      };
      completed = /* @__PURE__ */ new Set();
    } else if (ev.type === "plan.step.completed") {
      if (!current) continue;
      completed.add(ev.stepId);
    }
  }
  if (current) into.push(buildPlan(current, completed));
}
function buildPlan(current, completed) {
  return {
    id: current.id,
    title: current.title,
    totalSteps: current.totalSteps,
    completedSteps: completed.size,
    status: completed.size >= current.totalSteps && current.totalSteps > 0 ? "done" : "active",
    whenMs: current.whenMs
  };
}
function planTitle(body, steps) {
  const firstBodyLine = body.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (firstBodyLine)
    return firstBodyLine.replace(/^#+\s*/, "").trim().slice(0, 80);
  if (steps.length > 0 && steps[0]) return steps[0].title.slice(0, 80);
  return "(plan)";
}
function summarizeArgs(args) {
  if (!args) return "";
  let parsed;
  try {
    parsed = JSON.parse(args);
  } catch {
    return args.slice(0, 60);
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed;
    const path = obj.path ?? obj.file_path ?? obj.filename;
    const command = obj.command;
    if (typeof command === "string")
      return command.length > 60 ? `${command.slice(0, 60)}\u2026` : command;
    if (typeof path === "string") return path;
  }
  return args.slice(0, 60);
}
function parseTs(ts) {
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : null;
}

// src/server/api/cockpit.ts
var TTL_MS = 5e3;
var cache = /* @__PURE__ */ new Map();
function computeCockpit(ctx, now = Date.now()) {
  const stats = ctx.getStats?.() ?? null;
  return {
    balanceSupported: stats?.balanceSupported === true,
    balance: extractBalance(stats),
    currentSession: extractCurrentSession(ctx),
    ...readWarmCached(ctx.usageLogPath, now, ctx.sessionsDir)
  };
}
function pickDashboardBalance(infos) {
  if (!Array.isArray(infos) || infos.length === 0) return null;
  let best = infos[0];
  for (let i = 1; i < infos.length; i++) {
    if (Number(infos[i]?.total_balance ?? infos[i]?.total ?? 0) > Number(best?.total_balance ?? best?.total ?? 0)) best = infos[i];
  }
  return best;
}
function extractBalance(stats) {
  const first = stats?.primaryBalance ?? pickDashboardBalance(stats?.balance);
  if (!first) return null;
  return { currency: first.currency, total: Number(first.total_balance ?? first.total) };
}
function extractCurrentSession(ctx) {
  const id = ctx.getSessionName?.() ?? null;
  const stats = ctx.getStats?.() ?? null;
  const loop = ctx.loop;
  if (!id || !stats || !loop) return null;
  let completion = 0;
  for (const t of loop.stats.turns) completion += t.usage.completionTokens;
  return {
    id,
    turns: stats.turns,
    totalCostUsd: stats.totalCostUsd,
    lastPromptTokens: stats.lastPromptTokens,
    completionTokens: completion
  };
}
function readWarmCached(usageLogPath, now, sessionsDir2) {
  const cacheKey = `${usageLogPath}::${sessionsDir2 ?? ""}`;
  const hit = cache.get(cacheKey);
  if (hit && now - hit.ts < TTL_MS) return hit.data;
  const data = computeWarm(usageLogPath, now, sessionsDir2);
  cache.set(cacheKey, { ts: now, data });
  return data;
}
function computeWarm(usageLogPath, now, sessionsDir2) {
  const events = computeEventsCockpit(now, sessionsDir2);
  const records = readUsageLog(usageLogPath);
  if (records.length === 0) {
    return { tokens7d: null, cacheHit7d: null, costTrend14d: null, ...events };
  }
  const week = aggregateUsage(records, { now }).buckets[1];
  const priorWeekRecords = records.filter(
    (r) => r.ts < week.since && r.ts >= week.since - 7 * 864e5
  );
  const priorWeek = aggregateUsage(priorWeekRecords, { now: week.since }).buckets[1];
  const tokens7dTotal = week.promptTokens + week.completionTokens;
  const tokens7dPrior = priorWeek.promptTokens + priorWeek.completionTokens;
  const tokens7d = {
    total: tokens7dTotal,
    deltaPct: tokens7dPrior > 0 ? (tokens7dTotal - tokens7dPrior) / tokens7dPrior * 100 : null
  };
  const cacheHitRatio = bucketCacheHitRatio(week);
  const cacheHit7d = {
    ratio: cacheHitRatio,
    deltaPp: priorWeek.cacheHitTokens + priorWeek.cacheMissTokens > 0 ? (cacheHitRatio - bucketCacheHitRatio(priorWeek)) * 100 : null
  };
  return {
    tokens7d,
    cacheHit7d,
    costTrend14d: rollupDailyCost(records, now, 14),
    ...events
  };
}
function rollupDailyCost(records, now, days) {
  const since = now - days * 864e5;
  const buckets = /* @__PURE__ */ new Map();
  for (let i = 0; i < days; i++) {
    buckets.set(localDateKey(now - i * 864e5), 0);
  }
  for (const r of records) {
    if (r.ts < since) continue;
    const key = localDateKey(r.ts);
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + r.costUsd);
  }
  return Array.from(buckets.entries()).map(([date, usd]) => ({ date, usd })).sort((a, b) => a.date < b.date ? -1 : 1);
}
function localDateKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// src/server/api/overview.ts
async function handleOverview(method, _rest, _body, ctx) {
  if (method !== "GET") {
    return { status: 405, body: { error: "GET only" } };
  }
  const cfg = readConfig(ctx.configPath);
  const model = modelState(ctx, cfg);
  const cwd = ctx.getCurrentCwd?.() ?? null;
  const semanticIndexExists = cwd ? await indexExists(cwd).catch(() => false) : null;
  const modeInfo = ctx.getModes?.() ?? null;
  const overview = {
    version: VERSION,
    mode: ctx.mode,
    workMode: modeInfo?.current ?? cfg.mode ?? "general",
    modes: modeInfo?.list ?? (()=>{const all=cfg.modes??{};return Object.entries(all).map(([id,m])=>({id,label:m.label??id,rules:m.eccRules??[]}));})(),
    activeMode: modeInfo?.active ?? null,
    eccRules: ctx.getEccRules?.() ?? null,
    latestVersion: ctx.getLatestVersion?.() ?? null,
    session: ctx.getSessionName?.() ?? null,
    cwd,
    model: model.displayModel,
    configuredModel: model.configuredModel,
    effectiveModel: model.effectiveModel,
    runtimeModel: model.runtimeModel,
    displayModel: model.displayModel,
    modelDrift: model.modelDrift,
    editMode: ctx.getEditMode?.() ?? null,
    planMode: ctx.getPlanMode?.() ?? null,
    pendingEdits: ctx.getPendingEditCount?.() ?? null,
    dlp: ctx.getDlpStatus?.() ?? null,
    mcpServerCount: ctx.mcpServers?.length ?? null,
    toolCount: ctx.tools ? ctx.tools.size : null,
    preset: model.preset,
    reasoningEffort: ctx.loop?.reasoningEffort ?? cfg.reasoningEffort ?? "max",
    budgetUsd: ctx.loop?.budgetUsd ?? null,
    stats: ctx.getStats?.() ?? null,
    semanticIndexExists,
    cockpit: computeCockpit(ctx),
    activeProviderId: cfg.activeProviderId ?? null,
    activeProviderName: (() => {
      const provider = (cfg.providers ?? []).find((p) => p.id === cfg.activeProviderId) ?? cfg.providers?.[0];
      return provider?.name ?? provider?.id ?? null;
    })(),
    modelVerification: cfg.modelVerification ?? { dirty: false },
    providerCapabilities: (() => {
      const provider = (cfg.providers ?? []).find((p) => p.id === cfg.activeProviderId) ?? cfg.providers?.[0];
      const allPresets = new Set();
      const allEfforts = new Set();
      for (const m of provider?.models ?? []) {
        for (const pr of m.presets ?? []) allPresets.add(pr);
        for (const ef of m.efforts ?? []) allEfforts.add(ef);
      }
      return { presets: [...allPresets], efforts: [...allEfforts] };
    })()
  };
  return { status: 200, body: overview };
}

// src/server/api/backups.ts (Visionox local patch)
function backupSummary(manifest) {
  if (!manifest) return manifest;
  const { files: _files, ...summary } = manifest;
  return summary;
}
async function handleBackups(method, rest, body, ctx) {
  const store = ctx.userDataBackups;
  if (!store) return { status: 503, body: { error: "user data backup service is unavailable" } };
  if (method === "GET" && rest.length === 0) return { status: 200, body: { items: store.list(), retentionCount: ctx.getUserDataBackupRetentionCount?.() ?? 10 } };
  if (method === "POST" && rest.length === 0) {
    const created = store.create();
    const pruned = store.prune(ctx.getUserDataBackupRetentionCount?.() ?? 10);
    return { status: 200, body: { ...backupSummary(created), pruned: pruned.deletedIds.length } };
  }
  if (method === "GET" && rest[0] === "estimate" && rest.length === 1) return { status: 200, body: store.estimate() };
  if (method === "POST" && rest[0] === "retention" && rest.length === 1) {
    let input;
    try { input = body ? JSON.parse(body) : {}; } catch { return { status: 400, body: { error: "invalid JSON body" } }; }
    const retentionCount = ctx.setUserDataBackupRetentionCount?.(input.retentionCount);
    if (!retentionCount) return { status: 503, body: { error: "backup retention settings are unavailable" } };
    return { status: 200, body: { retentionCount, items: store.list() } };
  }
  const id = rest[0];
  if (method === "DELETE" && id && rest.length === 1) {
    const result = store.remove(id);
    return { status: result.deleted ? 200 : 404, body: result.deleted ? result : { error: "backup not found" } };
  }
  if (method === "GET" && id && rest[1] === "preview" && rest.length === 2) {
    return { status: 200, body: store.inspect(id) };
  }
  if (method === "POST" && id && rest[1] === "restore" && rest.length === 2) {
    let input = {};
    try {
      input = body ? JSON.parse(body) : {};
    } catch {
      return { status: 400, body: { error: "invalid JSON body" } };
    }
    return { status: 200, body: store.restore(id, { overwrite: input.overwrite === true }) };
  }
  return { status: 404, body: { error: "backup endpoint not found" } };
}

// src/server/api/permissions.ts
function parseBody8(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
async function handlePermissions(method, rest, body, ctx) {
  if (method === "GET" && rest.length === 0) {
    const cwd2 = ctx.getCurrentCwd?.();
    return {
      status: 200,
      body: {
        currentCwd: cwd2 ?? null,
        editMode: ctx.getEditMode?.() ?? null,
        builtin: [...BUILTIN_ALLOWLIST],
        project: cwd2 ? loadProjectShellAllowed(cwd2, ctx.configPath) : []
      }
    };
  }
  const cwd = ctx.getCurrentCwd?.();
  if (!cwd) {
    return {
      status: 503,
      body: {
        error: "no active project \u2014 mutations require an attached dashboard session (run `/dashboard` from inside `visionox code`)."
      }
    };
  }
  if (method === "POST" && rest.length === 0) {
    const { prefix } = parseBody8(body);
    if (typeof prefix !== "string" || !prefix.trim()) {
      return { status: 400, body: { error: "prefix (string) required" } };
    }
    const trimmed = prefix.trim();
    if (BUILTIN_ALLOWLIST.includes(trimmed)) {
      return {
        status: 409,
        body: {
          error: `\`${trimmed}\` is already in the builtin allowlist \u2014 no project entry needed.`
        }
      };
    }
    const before = loadProjectShellAllowed(cwd, ctx.configPath);
    if (before.includes(trimmed)) {
      return { status: 200, body: { added: false, prefix: trimmed, alreadyPresent: true } };
    }
    addProjectShellAllowed(cwd, trimmed, ctx.configPath);
    ctx.audit?.({
      ts: Date.now(),
      action: "add-allowlist",
      payload: { prefix: trimmed, project: cwd }
    });
    return { status: 200, body: { added: true, prefix: trimmed } };
  }
  if (method === "DELETE" && rest.length === 0) {
    const { prefix } = parseBody8(body);
    if (typeof prefix !== "string" || !prefix.trim()) {
      return { status: 400, body: { error: "prefix (string) required" } };
    }
    const trimmed = prefix.trim();
    if (BUILTIN_ALLOWLIST.includes(trimmed)) {
      return {
        status: 409,
        body: {
          error: `\`${trimmed}\` is in the builtin allowlist (read-only); builtin entries can't be removed at runtime.`
        }
      };
    }
    const removed = removeProjectShellAllowed(cwd, trimmed, ctx.configPath);
    if (removed) {
      ctx.audit?.({
        ts: Date.now(),
        action: "remove-allowlist",
        payload: { prefix: trimmed, project: cwd }
      });
    }
    return { status: 200, body: { removed, prefix: trimmed } };
  }
  if (method === "POST" && rest[0] === "clear") {
    const { confirm } = parseBody8(body);
    if (confirm !== true) {
      return {
        status: 400,
        body: {
          error: "clear requires { confirm: true } in the body \u2014 guards against accidental wipe."
        }
      };
    }
    const dropped = clearProjectShellAllowed(cwd, ctx.configPath);
    if (dropped > 0) {
      ctx.audit?.({
        ts: Date.now(),
        action: "clear-allowlist",
        payload: { dropped, project: cwd }
      });
    }
    return { status: 200, body: { dropped } };
  }
  return { status: 405, body: { error: `method ${method} not supported on this path` } };
}

// src/server/api/plans.ts
async function handlePlans(method, rest, body, ctx) {
  if (method === "POST" && rest[0] === "active" && rest[1] === "step") {
    let parsed;
    try { parsed = JSON.parse(body || "{}"); } catch { return { status: 400, body: { error: "body must be JSON" } }; }
    const stepId = typeof parsed.stepId === "string" ? parsed.stepId : "";
    if (!stepId) return { status: 400, body: { error: "stepId is required" } };
    const result = ctx.completeActivePlanStep?.(stepId);
    if (!result) return { status: 503, body: { error: "active plan mutations require an attached dashboard session" } };
    if (!result.ok) return { status: 400, body: { error: result.error || "step update failed" } };
    return { status: 200, body: { ok: true, plan: result.plan ?? null } };
  }
  if (method === "DELETE") {
    let parsed;
    try { parsed = JSON.parse(body || "{}"); } catch { return { status: 400, body: { error: "body must be JSON" } }; }
    if (parsed.active === true) {
      const result = ctx.cancelActivePlan?.();
      if (!result) return { status: 503, body: { error: "active plan mutations require an attached dashboard session" } };
      return result.ok ? { status: 200, body: { cancelled: true } } : { status: 400, body: { error: result.error || "cancel failed" } };
    }
    const targetPath = typeof parsed.path === "string" ? parsed.path : "";
    if (!targetPath) return { status: 400, body: { error: "path is required" } };
    // Security: only allow deleting files inside sessionsDir, matching the
    // .plan.*.done.json pattern, to prevent path traversal.
    const sessionsDirPath = sessionsDir();
    const resolved = (await import("node:path")).resolve(targetPath);
    const sessResolved = (await import("node:path")).resolve(sessionsDirPath);
    if (!resolved.startsWith(sessResolved + (await import("node:path")).sep)) {
      return { status: 403, body: { error: "path must be inside sessions directory" } };
    }
    const base = (await import("node:path")).basename(resolved);
    if (!/^[\w.-]+\.plan\.[\w.-]+\.done\.json$/.test(base)) {
      return { status: 400, body: { error: "invalid plan archive filename" } };
    }
    try {
      (await import("node:fs")).unlinkSync(resolved);
      return { status: 200, body: { deleted: true, path: resolved } };
    } catch (err) {
      return { status: 404, body: { error: `failed to delete: ${err.message}` } };
    }
  }
  if (method !== "GET") {
    return { status: 405, body: { error: "GET/DELETE only" } };
  }
  const out = listAllPlanArchives().map((a) => {
    const total = a.steps.length;
    const done = a.completedStepIds.length;
    const row = {
      session: a.sessionName,
      status: "done",
      path: a.path,
      completedAt: a.completedAt,
      updatedAt: a.completedAt,
      totalSteps: total,
      completedSteps: done,
      completionRatio: total > 0 ? done / total : 0,
      steps: a.steps,
      completedStepIds: a.completedStepIds
    };
    if (a.summary) row.summary = a.summary;
    if (a.body) row.body = a.body;
    return row;
  });
  const active = ctx.getActivePlan?.();
  if (active) out.unshift(active);
  return { status: 200, body: { plans: out } };
}

// src/server/api/project-tree.ts
import { existsSync as existsSync7, readdirSync as readdirSync4, statSync as statSync4 } from "fs";
import { extname as extname3, join as join6, relative as relative2, sep as sep3 } from "path";
var MAX_DEPTH2 = 6;
var SKIP_DIRS2 = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".visionox",
  "dist",
  "build",
  "out",
  ".next",
  "coverage",
  ".cache",
  "__pycache__",
  ".venv",
  ".pytest_cache"
]);
var SKIP_EXTS2 = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".lock",
  ".woff",
  ".woff2",
  ".ttf"
]);
async function handleProjectTree(method, _rest, _body, ctx) {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  const cwd = ctx.getCurrentCwd?.();
  if (!cwd || !existsSync7(cwd)) {
    return { status: 503, body: { error: "no project directory available" } };
  }
  const tree = buildTree(cwd, cwd, 0);
  return { status: 200, body: { tree } };
}
function buildTree(root, dirPath, depth) {
  if (depth > MAX_DEPTH2) return [];
  let names;
  try {
    names = readdirSync4(dirPath);
  } catch {
    return [];
  }
  const nodes = [];
  const dirs = [];
  const files = [];
  for (const name of names) {
    if (SKIP_DIRS2.has(name)) continue;
    const full = join6(dirPath, name);
    let st;
    try {
      st = statSync4(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      dirs.push(name);
    } else if (st.isFile() && !SKIP_EXTS2.has(extname3(name).toLowerCase())) {
      files.push(name);
    }
  }
  dirs.sort();
  files.sort();
  for (const name of dirs) {
    const full = join6(dirPath, name);
    const rel = relative2(root, full).split(sep3).join("/");
    const children = buildTree(root, full, depth + 1);
    nodes.push({ name, path: rel, isDir: true, children });
  }
  for (const name of files) {
    const full = join6(dirPath, name);
    const rel = relative2(root, full).split(sep3).join("/");
    nodes.push({ name, path: rel, isDir: false });
  }
  return nodes;
}

// src/server/api/review-diffs.ts
async function handleReviewDiffs(method, _rest, _body, _ctx) {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  return { status: 200, body: [] };
}

// src/server/api/semantic.ts
import { closeSync as closeSync3, fstatSync as fstatSync3, openSync as openSync3, readSync as readSync3 } from "fs";
import { join as join7 } from "path";
var JOBS = /* @__PURE__ */ new Map();
var PULLS = /* @__PURE__ */ new Map();
function getRoot(ctx) {
  const cwd = ctx.getCurrentCwd?.();
  return cwd ?? null;
}
async function handleSemantic(method, rest, body, ctx) {
  const sub = rest[0] ?? "";
  if (sub === "" && method === "GET") return await getStatus(ctx);
  if (sub === "config" && method === "GET") return getSemanticConfig(ctx);
  if (sub === "config" && method === "POST") return saveSemanticConfigApi(body, ctx);
  if (sub === "start" && method === "POST") return await startJob(body, ctx);
  if (sub === "stop" && method === "POST") return await stopJob(ctx);
  if (sub === "ollama" && method === "POST") {
    const action = rest[1] ?? "";
    if (action === "start") return await startDaemon(ctx);
    if (action === "pull") return await startPull(body, ctx);
  }
  if (sub === "search" && method === "POST") return await runSearch(body, ctx);
  return { status: 404, body: { error: "no such semantic endpoint" } };
}

function handleIndexRetrievalMode(method, body, ctx) {
  if (method === "GET") {
    return { status: 200, body: ctx.getIndexRetrievalMode?.() ?? { mode: "tool", semanticAvailable: false } };
  }
  if (method !== "POST") return { status: 405, body: { error: "GET/POST only" } };
  const parsed = parseBody(body);
  const result = ctx.setIndexRetrievalMode?.(parsed.mode);
  if (!result) return { status: 503, body: { error: "index retrieval mode is not available" } };
  return { status: result.ok ? 200 : 409, body: result.ok ? result : { error: result.error } };
}
async function runSearch(rawBody, ctx) {
  const root = getRoot(ctx);
  if (!root) {
    return { status: 503, body: { error: "search requires an attached code-mode session" } };
  }
  let parsed;
  try {
    parsed = JSON.parse(rawBody || "{}");
  } catch {
    return { status: 400, body: { error: "body must be JSON" } };
  }
  const query = typeof parsed.query === "string" ? parsed.query.trim() : "";
  if (!query) return { status: 400, body: { error: "query required" } };
  const topK = typeof parsed.topK === "number" && Number.isFinite(parsed.topK) ? Math.max(1, Math.min(16, Math.floor(parsed.topK))) : 8;
  const minScore = typeof parsed.minScore === "number" && Number.isFinite(parsed.minScore) ? Math.max(0, Math.min(1, parsed.minScore)) : 0.3;
  const startedAt = Date.now();
  const embedding = resolveSemanticEmbeddingConfig(ctx.configPath);
  try {
    const groups = await querySemanticGroups(root, query, {
      knowledgeTopK: topK,
      workspaceTopK: topK,
      minScore,
      configPath: ctx.configPath
    });
    if (groups === null) {
      return { status: 404, body: { error: "no semantic index for this project" } };
    }
    const hits = selectGroupedHits(groups, topK);
    return {
      status: 200,
      body: {
        hits: hits.map((h) => ({
          path: h.entry.path,
          startLine: h.entry.startLine,
          endLine: h.entry.endLine,
          score: h.score,
          snippet: h.entry.text
        })),
        elapsedMs: Date.now() - startedAt,
        provider: embedding.provider,
        model: embedding.model
      }
    };
  } catch (err) {
    return { status: 500, body: { error: err.message } };
  }
}
function selectGroupedHits(groups, topK) {
  const combined = [...groups.knowledge, ...groups.workspace].sort((a, b) => b.score - a.score);
  if (groups.knowledge.length === 0 || groups.workspace.length === 0) return combined.slice(0, topK);
  const sourceLimit = Math.max(1, Math.ceil(topK * 0.75));
  const selected = [];
  const deferred = [];
  const counts = { knowledge: 0, workspace: 0 };
  for (const hit of combined) {
    const source = String(hit.entry.path || "").startsWith("knowledge/") ? "knowledge" : "workspace";
    if (counts[source] >= sourceLimit) deferred.push(hit);
    else {
      selected.push(hit);
      counts[source]++;
    }
    if (selected.length >= topK) break;
  }
  if (selected.length < topK) selected.push(...deferred.slice(0, topK - selected.length));
  return selected.sort((a, b) => b.score - a.score);
}
async function getStatus(ctx) {
  const root = getRoot(ctx);
  if (!root) {
    return {
      status: 200,
      body: {
        attached: false,
        reason: "Semantic indexing requires a code-mode session \u2014 run `/dashboard` from inside `visionox code` instead of standalone `visionox dashboard`."
      }
    };
  }
  const config = loadSemanticEmbeddingUserConfig(ctx.configPath);
  const configView = redactSemanticEmbeddingConfig(config);
  const resolved = resolveSemanticEmbeddingConfig(ctx.configPath);
  const [hasIndex, providerStatus, index] = await Promise.all([
    indexExists(root),
    getProviderStatusFromConfig(configView),
    readIndexMeta2(root, { provider: resolved.provider, model: resolved.model })
  ]);
  const job = JOBS.get(root) ?? null;
  const pull = providerStatus.kind === "ollama" ? PULLS.get(providerStatus.modelName) ?? null : null;
  return {
    status: 200,
    body: {
      attached: true,
      root,
      provider: configView.provider,
      providerConfig: configView,
      providerStatus,
      index: hasIndex ? index : { exists: false },
      ollama: providerStatus.kind === "ollama" ? providerStatus : void 0,
      job: job ? snapshotJob(job) : null,
      pull: pull ? snapshotPull(pull) : null
    }
  };
}
async function readIndexMeta2(root, current) {
  const dir = semanticIndexDirForRoot(root);
  const dataPath = join7(dir, "index.jsonl");
  const diskMeta = await readIndexMeta(dir);
  if (!diskMeta) return { exists: false };
  let chunks = 0;
  const files = /* @__PURE__ */ new Set();
  let knowledgeChunks = 0;
  const knowledgeFiles = /* @__PURE__ */ new Set();
  let sizeBytes = 0;
  try {
    const fd = openSync3(dataPath, "r");
    let raw;
    try {
      const stat = fstatSync3(fd);
      sizeBytes = stat.size;
      const buf = Buffer.alloc(stat.size);
      let read = 0;
      while (read < stat.size) {
        const n = readSync3(fd, buf, read, stat.size - read, read);
        if (n <= 0) break;
        read += n;
      }
      raw = buf.toString("utf8", 0, read);
    } finally {
      closeSync3(fd);
    }
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      chunks++;
      try {
        const rec = JSON.parse(line);
        if (typeof rec.p === "string") {
          files.add(rec.p);
          if (rec.p.startsWith("knowledge/")) {
            knowledgeChunks++;
            knowledgeFiles.add(rec.p);
          }
        }
      } catch {
      }
    }
  } catch {
  }
  const mismatch = compareIndexIdentity(diskMeta, current);
  return {
    exists: true,
    provider: diskMeta.provider,
    chunks,
    files: files.size,
    knowledgeChunks,
    knowledgeFiles: knowledgeFiles.size,
    dim: diskMeta.dim ?? 0,
    sizeBytes,
    lastBuiltMs: diskMeta.updatedAt ? Date.parse(diskMeta.updatedAt) || 0 : 0,
    model: diskMeta.model ?? "",
    builtWith: { provider: diskMeta.provider, model: diskMeta.model },
    current,
    compatible: mismatch === null,
    mismatch
  };
}
function snapshotPull(p) {
  return {
    startedAt: p.startedAt,
    status: p.status,
    lastLine: p.lastLine,
    exitCode: p.exitCode
  };
}
async function startDaemon(ctx) {
  const resolved = resolveSemanticEmbeddingConfig(ctx.configPath);
  if (resolved.provider !== "ollama") {
    return { status: 409, body: { error: "ollama actions require provider=ollama" } };
  }
  const r = await startOllamaDaemon({ baseUrl: resolved.baseUrl, timeoutMs: 15e3 }).catch(
    (err) => ({
      ready: false,
      pid: null,
      error: err.message
    })
  );
  if ("error" in r) return { status: 500, body: { ready: false, error: r.error } };
  return { status: r.ready ? 200 : 504, body: r };
}
async function startPull(body, ctx) {
  const resolved = resolveSemanticEmbeddingConfig(ctx.configPath);
  if (resolved.provider !== "ollama") {
    return { status: 409, body: { error: "ollama actions require provider=ollama" } };
  }
  let parsed = {};
  if (body) {
    try {
      parsed = JSON.parse(body);
    } catch {
      return { status: 400, body: { error: "invalid JSON body" } };
    }
  }
  const model = typeof parsed.model === "string" && parsed.model ? parsed.model : resolved.model;
  const existing = PULLS.get(model);
  if (existing && existing.status === "pulling") {
    return {
      status: 409,
      body: { error: `${model} is already pulling`, pull: snapshotPull(existing) }
    };
  }
  const rec = {
    startedAt: Date.now(),
    status: "pulling",
    lastLine: `pulling ${model}\u2026`,
    exitCode: null
  };
  PULLS.set(model, rec);
  void pullOllamaModel(model, {
    onLine: (line) => {
      if (line.trim().length > 0) rec.lastLine = line.trim();
    }
  }).then((code) => {
    rec.exitCode = code;
    rec.status = code === 0 ? "done" : "error";
    if (code !== 0 && (!rec.lastLine || !rec.lastLine.toLowerCase().includes("error"))) {
      rec.lastLine = `ollama pull exited with code ${code}`;
    }
  }).catch((err) => {
    rec.status = "error";
    rec.lastLine = err.message;
  });
  return { status: 202, body: { started: true, pull: snapshotPull(rec) } };
}
function snapshotJob(j) {
  return {
    startedAt: j.startedAt,
    finishedAt: j.finishedAt ?? null,
    cancelledAt: j.cancelledAt ?? null,
    phase: j.phase,
    lastPhase: j.lastPhase ?? null,
    rebuild: j.rebuild,
    filesScanned: j.filesScanned ?? null,
    filesChanged: j.filesChanged ?? null,
    filesSkipped: j.filesSkipped ?? null,
    chunksTotal: j.chunksTotal ?? null,
    chunksDone: j.chunksDone ?? null,
    aborted: j.aborted,
    result: j.result ?? null,
    error: j.error ?? null
  };
}
async function startJob(body, ctx) {
  const root = getRoot(ctx);
  if (!root) {
    return {
      status: 400,
      body: { error: "no project root \u2014 only available in attached (code-mode) dashboards" }
    };
  }
  const existing = JOBS.get(root);
  if (existing && (existing.phase === "setup" || existing.phase === "scan" || existing.phase === "embed" || existing.phase === "write")) {
    return {
      status: 409,
      body: { error: "an indexing job is already running", job: snapshotJob(existing) }
    };
  }
  let parsed = {};
  if (body) {
    try {
      parsed = JSON.parse(body);
    } catch {
      return { status: 400, body: { error: "invalid JSON body" } };
    }
  }
  const rebuild = parsed.rebuild === true;
  const job = {
    startedAt: Date.now(),
    phase: "setup",
    lastPhase: "setup",
    rebuild,
    aborted: false,
    controller: new AbortController()
  };
  JOBS.set(root, job);
  void runIndex(root, job, ctx).catch((err) => {
    job.phase = "error";
    job.finishedAt = Date.now();
    job.error = err instanceof Error ? err.message : String(err);
  });
  const resolved = resolveSemanticEmbeddingConfig(ctx.configPath);
  return {
    status: 202,
    body: {
      started: true,
      provider: resolved.provider,
      model: resolved.model,
      job: snapshotJob(job)
    }
  };
}
async function runIndex(root, job, ctx) {
  try {
    const resolved = resolveSemanticEmbeddingConfig(ctx.configPath);
    const indexConfig = loadIndexConfig(ctx.configPath);
    const result = await buildIndex(root, {
      rebuild: job.rebuild,
      configPath: ctx.configPath,
      signal: job.controller.signal,
      indexConfig,
      onProgress: (p) => {
        job.phase = p.phase;
        if (p.phase !== "done") job.lastPhase = p.phase;
        if (p.filesScanned !== void 0) job.filesScanned = p.filesScanned;
        if (p.filesChanged !== void 0) job.filesChanged = p.filesChanged;
        if (p.filesSkipped !== void 0) job.filesSkipped = p.filesSkipped;
        if (p.chunksTotal !== void 0) job.chunksTotal = p.chunksTotal;
        if (p.chunksDone !== void 0) job.chunksDone = p.chunksDone;
      }
    });
    const complete = result.committed !== false && result.chunksSkipped === 0 && result.skipBuckets?.readError === 0;
    job.phase = complete ? "done" : "partial";
    job.finishedAt = Date.now();
    job.result = result;
    await ctx.onSemanticIndexCommitted?.({ root, result, indexConfig, complete });
    if (ctx.tools && ctx.addToolToPrefix) {
      try {
        const added = await registerSemanticSearchTool(ctx.tools, { root, ...resolved });
        if (added) {
          const spec = ctx.tools.specs().find((s) => s.function.name === "semantic_search");
          if (spec) ctx.addToolToPrefix(spec);
        }
      } catch {
      }
    }
  } catch (err) {
    if (isAbortError(err)) {
      job.phase = "cancelled";
      job.cancelledAt = Date.now();
      job.finishedAt = job.cancelledAt;
      job.error = void 0;
      return;
    }
    job.phase = "error";
    job.finishedAt = Date.now();
    job.error = err instanceof Error ? err.message : String(err);
  }
}
async function stopJob(ctx) {
  const root = getRoot(ctx);
  if (!root) return { status: 400, body: { error: "no project root" } };
  const job = JOBS.get(root);
  if (!job || job.phase === "done" || job.phase === "partial" || job.phase === "error" || job.phase === "cancelled") {
    return { status: 404, body: { error: "no running job" } };
  }
  job.aborted = true;
  job.controller.abort(new Error("semantic indexing aborted"));
  return { status: 202, body: { stopping: true, job: snapshotJob(job) } };
}
function getSemanticConfig(ctx) {
  return {
    status: 200,
    body: redactSemanticEmbeddingConfig(loadSemanticEmbeddingUserConfig(ctx.configPath))
  };
}
function saveSemanticConfigApi(rawBody, ctx) {
  let parsed;
  try {
    parsed = JSON.parse(rawBody || "{}");
  } catch {
    return { status: 400, body: { error: "body must be JSON" } };
  }
  const existing = loadSemanticEmbeddingUserConfig(ctx.configPath);
  const next = {
    provider: parsed.provider === "openai-compat" ? "openai-compat" : "ollama",
    ollama: {
      baseUrl: typeof parsed.ollama?.baseUrl === "string" ? parsed.ollama.baseUrl : existing.ollama?.baseUrl,
      model: typeof parsed.ollama?.model === "string" ? parsed.ollama.model : existing.ollama?.model
    },
    openaiCompat: {
      baseUrl: typeof parsed.openaiCompat?.baseUrl === "string" ? parsed.openaiCompat.baseUrl : existing.openaiCompat?.baseUrl,
      apiKey: typeof parsed.openaiCompat?.apiKey === "string" ? parsed.openaiCompat.apiKey.trim() || existing.openaiCompat?.apiKey : existing.openaiCompat?.apiKey,
      model: typeof parsed.openaiCompat?.model === "string" ? parsed.openaiCompat.model : existing.openaiCompat?.model,
      extraBody: parsed.openaiCompat?.extraBody === void 0 ? existing.openaiCompat?.extraBody : parsed.openaiCompat.extraBody
    }
  };
  try {
    saveSemanticEmbeddingConfig(next, ctx.configPath);
  } catch (err) {
    return { status: 400, body: { error: err.message } };
  }
  ctx.audit?.({
    ts: Date.now(),
    action: "set-semantic-config",
    payload: { provider: next.provider }
  });
  return {
    status: 200,
    body: {
      changed: collectSemanticConfigChanges(existing, next),
      config: redactSemanticEmbeddingConfig(loadSemanticEmbeddingUserConfig(ctx.configPath))
    }
  };
}
function collectSemanticConfigChanges(before, after) {
  const left = JSON.stringify(before);
  const right = JSON.stringify(after);
  if (left === right) return [];
  return ["semantic"];
}
async function getProviderStatusFromConfig(config) {
  if (config.provider === "openai-compat") {
    return {
      kind: "openai-compat",
      ready: Boolean(
        config.openaiCompat.baseUrl && config.openaiCompat.apiKeySet && config.openaiCompat.model
      ),
      baseUrl: config.openaiCompat.baseUrl,
      apiKeySet: config.openaiCompat.apiKeySet,
      model: config.openaiCompat.model,
      extraBodyKeys: Object.keys(config.openaiCompat.extraBody)
    };
  }
  const ollama = await checkOllamaStatus(config.ollama.model, config.ollama.baseUrl).catch(
    (err) => ({
      binaryFound: false,
      daemonRunning: false,
      modelPulled: false,
      modelName: config.ollama.model,
      installedModels: [],
      error: err instanceof Error ? err.message : String(err)
    })
  );
  return {
    kind: "ollama",
    ready: ollama.daemonRunning && ollama.modelPulled,
    baseUrl: config.ollama.baseUrl,
    ...ollama
  };
}
function isAbortError(err) {
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    if (/aborted/i.test(err.message)) return true;
  }
  return false;
}

// src/server/api/sessions.ts
import { closeSync as closeSync5, createReadStream as createReadStream2, createWriteStream as createWriteStream2, existsSync as existsSync8, fstatSync as fstatSync5, mkdirSync as mkdirSync8, openSync as openSync5, readFileSync as readFileSync5, readSync as readSync5, writeFileSync as writeFileSync8 } from "fs";
import { createInterface as createInterface2 } from "readline";
import { once as once2 } from "events";
function parseTranscriptRecord(line) {
  if (!line.trim()) return null;
  try {
    const rec = JSON.parse(line);
    const role = typeof rec.role === "string" ? rec.role : "unknown";
    const msg = { role };
    if (typeof rec.content === "string") msg.content = rec.content;
    else if (rec.content !== void 0) msg.content = JSON.stringify(rec.content);
    if (typeof rec.tool_name === "string") msg.toolName = rec.tool_name;
    if (typeof rec.toolName === "string") msg.toolName = rec.toolName;
    return msg;
  } catch {
    return null;
  }
}
function parseTranscript(path, maxBytes = 4 * 1024 * 1024) {
  let fd;
  try {
    fd = openSync5(path, "r");
    const size = Math.min(fstatSync5(fd).size, Math.max(0, maxBytes));
    const buffer = Buffer.alloc(size);
    let read = 0;
    while (read < size) {
      const count = readSync5(fd, buffer, read, size - read, read);
      if (count <= 0) break;
      read += count;
    }
    let raw = buffer.toString("utf8", 0, read);
    if (read === size && size < fstatSync5(fd).size) {
      const lastNewline = raw.lastIndexOf("\n");
      if (lastNewline >= 0) raw = raw.slice(0, lastNewline + 1);
    }
    const out = [];
    for (const line of raw.split(/\r?\n/)) {
      const msg = parseTranscriptRecord(line);
      if (msg) out.push(msg);
    }
    return out;
  } catch {
    return [];
  } finally {
    if (fd !== void 0) {
      try {
        closeSync5(fd);
      } catch {
      }
    }
  }
}
async function readTranscriptPage(path, { limit = 200, offset = 0 } = {}) {
  const pageLimit = Math.max(1, Math.min(500, Number.parseInt(String(limit), 10) || 200));
  const pageOffset = Math.max(0, Math.min(100000, Number.parseInt(String(offset), 10) || 0));
  const capacity = pageLimit + pageOffset;
  const ring = [];
  let totalMessages = 0;
  const input = createReadStream2(path, { encoding: "utf8" });
  const lines = createInterface2({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    const msg = parseTranscriptRecord(line);
    if (!msg) continue;
    totalMessages++;
    ring.push(msg);
    if (ring.length > capacity) ring.shift();
  }
  const end = Math.max(0, ring.length - pageOffset);
  const start = Math.max(0, end - pageLimit);
  const messages = ring.slice(start, end);
  return {
    messages,
    totalMessages,
    offset: pageOffset,
    limit: pageLimit,
    startIndex: Math.max(0, totalMessages - pageOffset - messages.length),
    hasMore: totalMessages > pageOffset + messages.length
  };
}

async function writeTranscriptMarkdown(path, filePath, name, meta = {}, messageCount = null) {
  const output = createWriteStream2(filePath, { encoding: "utf8" });
  const writeChunk = async (chunk) => {
    if (!output.write(chunk)) await once2(output, "drain");
  };
  const header = [
    `# ${name}`,
    "",
    `- Messages: ${Number.isFinite(messageCount) ? messageCount : "unknown"}`,
    meta.modeLabel || meta.mode ? `- Mode: ${meta.modeLabel || meta.mode}` : null,
    meta.workspace ? `- Workspace: ${meta.workspace}` : null,
    meta.savedAt ? `- Saved: ${meta.savedAt}` : null,
    "",
    "---",
    ""
  ].filter((line) => line !== null).join("\n");
  try {
    await writeChunk(`${header}\n`);
    const input = createReadStream2(path, { encoding: "utf8" });
    const lines = createInterface2({ input, crlfDelay: Infinity });
    for await (const line of lines) {
      const msg = parseTranscriptRecord(line);
      if (!msg) continue;
      await writeChunk(`## ${msg.role || "unknown"}\n\n${String(msg.content || "").trim() || "(empty)"}\n\n`);
    }
    output.end();
    await once2(output, "finish");
  } catch (err) {
    output.destroy();
    throw err;
  }
}
function summarizeTranscript(messages) {
  const firstUser = messages.find((m) => m.role === "user" && String(m.content || "").trim());
  const firstAssistant = messages.find((m) => m.role === "assistant" && String(m.content || "").trim());
  const source = firstUser || firstAssistant || messages.find((m) => String(m.content || "").trim());
  if (!source) return "";
  const text = String(source.content || "").replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}
function searchTextForTranscript(messages, meta = {}) {
  const parts = [
    meta.modeLabel,
    meta.mode,
    meta.workspace,
    ...messages.slice(0, 20).map((m) => m.content)
  ];
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 4e3);
}
function transcriptToMarkdown(name, messages, meta = {}) {
  const lines = [
    `# ${name}`,
    "",
    `- Messages: ${messages.length}`,
    meta.modeLabel || meta.mode ? `- Mode: ${meta.modeLabel || meta.mode}` : null,
    meta.workspace ? `- Workspace: ${meta.workspace}` : null,
    meta.savedAt ? `- Saved: ${meta.savedAt}` : null,
    "",
    "---",
    ""
  ].filter((line) => line !== null);
  for (const msg of messages) {
    const role = msg.role || "unknown";
    lines.push(`## ${role}`);
    lines.push("");
    lines.push(String(msg.content || "").trim() || "(empty)");
    lines.push("");
  }
  return lines.join("\n");
}
function sessionModeInfo(meta = {}) {
  const mode = typeof meta.mode === "string" && meta.mode ? meta.mode : null;
  return {
    mode,
    modeLabel: typeof meta.modeLabel === "string" && meta.modeLabel ? meta.modeLabel : mode,
    modeDescription: typeof meta.modeDescription === "string" ? meta.modeDescription : ""
  };
}
async function handleSessions(method, rest, _body, _ctx, query = new URLSearchParams()) {
  if (method === "POST" && rest[0] === "batch-trash") {
    const body = parseBody(_body);
    const names = Array.isArray(body.names) ? body.names : [];
    if (names.length === 0 || names.length > 200) return { status: 400, body: { error: "names must contain 1..200 sessions" } };
    const result = _ctx.trashSessions?.(names);
    if (!result) return { status: 503, body: { error: "session trash is not available" } };
    _ctx.notifySessionsChanged?.("trash", String(result.movedCount || 0));
    return { status: result.failedCount > 0 ? 207 : 200, body: result };
  }
  if (method === "POST" && rest[0] === "trash-retention") {
    const body = parseBody(_body);
    const result = _ctx.setSessionTrashRetentionDays?.(body.retentionDays);
    if (!result) return { status: 503, body: { error: "session trash settings are not available" } };
    return { status: result.ok ? 200 : 400, body: result.ok ? result : { error: result.error } };
  }
  if (method === "GET" && rest[0] === "trash" && rest[1]) {
    const entry = _ctx.getSessionTrashEntry?.(decodeURIComponent(rest[1]));
    if (!entry) return { status: 404, body: { error: "trash item not found" } };
    const page = entry.path ? await readTranscriptPage(entry.path, {
      limit: query.get("limit") ?? 200,
      offset: query.get("offset") ?? 0
    }) : { messages: [], totalMessages: 0, offset: 0, limit: 200, startIndex: 0, hasMore: false };
    const { path: _path, dir: _dir, ...item } = entry;
    return { status: 200, body: { ...item, ...page } };
  }
  if (method === "POST" && rest[0] === "trash" && rest[1] === "batch-restore") {
    const body = parseBody(_body);
    const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
    if (items.length === 0) return { status: 400, body: { error: "items must contain 1..200 trash entries" } };
    const restored = [];
    const failed = [];
    for (const item of items) {
      const id = String(item?.id || "");
      const result = _ctx.restoreSessionTrash?.(id, item?.newName);
      if (result?.ok) restored.push({ id, name: result.name });
      else failed.push({ id, error: result?.error || "restore failed" });
    }
    return { status: failed.length > 0 ? 207 : 200, body: { ok: failed.length === 0, restored, failed, restoredCount: restored.length, failedCount: failed.length } };
  }
  if (method === "POST" && rest[0] === "trash" && rest[1] && rest[2] === "restore") {
    const body = parseBody(_body);
    const result = _ctx.restoreSessionTrash?.(decodeURIComponent(rest[1]), body.newName);
    if (!result) return { status: 503, body: { error: "session trash restore is not available" } };
    _ctx.notifySessionsChanged?.("restore", result.name || rest[1]);
    return { status: result.ok ? 200 : 409, body: result.ok ? result : { error: result.error } };
  }
  if (method === "DELETE" && rest[0] === "trash" && (rest[1] === "batch" || rest.length === 1)) {
    const body = parseBody(_body);
    const ids = rest.length === 1 && body.all === true ? (_ctx.listSessionTrash?.() ?? []).map((item) => item.id) : Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0 || ids.length > 5e3) return { status: 400, body: { error: "ids must contain 1..5000 trash entries" } };
    const result = _ctx.deleteSessionTrash?.(ids);
    if (!result) return { status: 503, body: { error: "session trash deletion is not available" } };
    return { status: result.failedCount > 0 ? 207 : 200, body: result };
  }
  if (method === "POST" && rest[1] === "export") {
    const name2 = decodeURIComponent(rest[0] || "");
    if (!name2) return { status: 400, body: { error: "session name required" } };
    const path = sessionPath(name2);
    if (!existsSync8(path)) return { status: 404, body: { error: `no such session: ${name2}` } };
    const session = listSessions().find((s) => s.name === name2);
    const meta = session?.meta ?? {};
    const safeName = `${String(name2).replace(/[\\/:*?"<>|]/g, "_")}.md`;
    const dir = join4(homedir(), "Downloads");
    const filePath = join4(dir, safeName);
    try {
      mkdirSync8(dir, { recursive: true });
      await writeTranscriptMarkdown(path, filePath, name2, meta, session?.messageCount ?? null);
      return { status: 200, body: { path: filePath, filename: safeName } };
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
  }
  if (method === "DELETE") {
    const name2 = decodeURIComponent(rest[0] || "");
    if (!name2) return { status: 400, body: { error: "session name required" } };
    const result = _ctx.trashSessions?.([name2]);
    if (!result) return { status: 503, body: { error: "session trash is not available" } };
    if (result.movedCount > 0) _ctx.notifySessionsChanged?.("trash", name2);
    return { status: result.movedCount > 0 ? 200 : 404, body: { trashed: result.movedCount > 0, ...result } };
  }
  if (method === "POST" && rest[1] === "rename") {
    const name2 = decodeURIComponent(rest[0] || "");
    if (!name2) return { status: 400, body: { error: "session name required" } };
    const body = parseBody(_body);
    const newNameRaw = String(body.newName || "").trim();
    if (!newNameRaw) return { status: 400, body: { error: "newName is required" } };
    const safeNew = sanitizeName(newNameRaw);
    if (!safeNew || safeNew !== newNameRaw) {
      return { status: 400, body: { error: "newName contains invalid characters" } };
    }
    const ok = renameSession(name2, safeNew);
    if (!ok) return { status: 409, body: { error: "rename failed: name conflict, invalid name, or source not found" } };
    _ctx.notifySessionsChanged?.("rename", safeNew);
    return { status: 200, body: { renamed: true, oldName: name2, newName: safeNew } };
  }
  if (method !== "GET") {
    return { status: 405, body: { error: "GET/POST/DELETE only" } };
  }
  if (rest.length === 0) {
    const sessions = listSessions();
    return {
      status: 200,
      body: {
        trash: {
          items: _ctx.listSessionTrash?.() ?? [],
          retentionDays: _ctx.getSessionTrashRetentionDays?.() ?? 30
        },
        sessions: sessions.map((s) => {
          const previewMessages = parseTranscript(s.path, 128 * 1024);
          return {
            name: s.name,
            path: s.path,
            size: s.size,
            messageCount: s.messageCount,
            mtime: s.mtime.getTime(),
            meta: s.meta ?? {},
            summary: summarizeTranscript(previewMessages),
            searchText: searchTextForTranscript(previewMessages, s.meta ?? {}),
            ...sessionModeInfo(s.meta)
          };
        })
      }
    };
  }
  const name = decodeURIComponent(rest[0]);
  const path = sessionPath(name);
  if (!existsSync8(path)) {
    return { status: 404, body: { error: `no such session: ${name}` } };
  }
  const page = await readTranscriptPage(path, {
    limit: query.get("limit") ?? 200,
    offset: query.get("offset") ?? 0
  });
  const session = listSessions().find((s) => s.name === name);
  const meta = session?.meta ?? {};
  return {
    status: 200,
    body: {
      name,
      path,
      messages: page.messages,
      messageCount: page.totalMessages,
      totalMessages: page.totalMessages,
      offset: page.offset,
      limit: page.limit,
      startIndex: page.startIndex,
      hasMore: page.hasMore,
      meta,
      ...sessionModeInfo(meta)
    }
  };
}

// src/server/api/report.ts
async function handleReport(method, _rest, _body, ctx, query = new URLSearchParams()) {
  if (_rest[0] === "export") {
    if (method !== "POST") {
      return { status: 405, body: { error: "POST only" } };
    }
    const body = parseBody(_body);
    const markdown = String(body.markdown || "");
    if (!markdown) {
      return { status: 400, body: { error: "markdown is required" } };
    }
    const safeName = String(body.filename || `Visionox_Report_${new Date().toISOString().slice(0, 10)}.md`).replace(/[\\/:*?"<>|]/g, "_");
    const dir = join4(homedir(), "Downloads");
    const filePath = join4(dir, safeName);
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, markdown, "utf8");
      return { status: 200, body: { path: filePath, filename: safeName } };
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
  }
  if (_rest[0] === "preview") {
    if (method !== "GET") {
      return { status: 405, body: { error: "GET only" } };
    }
    if (!ctx.previewReportSources) {
      return { status: 503, body: { error: "report preview engine not available" } };
    }
    const period = query.get("period") || "daily";
    if (!["daily", "weekly", "yearly", "custom"].includes(period)) {
      return { status: 400, body: { error: "period must be daily, weekly, yearly or custom" } };
    }
    let customRange = null;
    if (period === "custom") {
      const rawStart = query.get("start");
      const rawEnd = query.get("end");
      if (!rawStart || !rawEnd) {
        return { status: 400, body: { error: "custom period requires start and end dates" } };
      }
      const start2 = new Date(rawStart);
      const end2 = new Date(rawEnd);
      if (Number.isNaN(start2.getTime()) || Number.isNaN(end2.getTime())) {
        return { status: 400, body: { error: "invalid start or end date" } };
      }
      if (end2 < start2) {
        return { status: 400, body: { error: "end date must be after start date" } };
      }
      customRange = { start: start2, end: end2 };
    }
    const rawDate = query.get("date");
    const anchorDate = rawDate ? new Date(rawDate) : new Date();
    if (Number.isNaN(anchorDate.getTime())) {
      return { status: 400, body: { error: "invalid date" } };
    }
    try {
      const preview = await ctx.previewReportSources(period, anchorDate, customRange);
      return { status: 200, body: preview };
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
  }
  if (_rest[0] === "prompt") {
    if (method === "GET") {
      const prompt = ctx.getReportPromptTemplate?.() || { default: "", addendum: "" };
      return { status: 200, body: { default: prompt.default || "", addendum: prompt.addendum || "" } };
    }
    if (method === "POST") {
      const body = parseBody(_body);
      const result = ctx.setReportPromptAddendum?.(body.addendum);
      return { status: 200, body: { default: result?.default || "", addendum: result?.addendum || "", saved: true } };
    }
    if (method === "DELETE") {
      const result = ctx.setReportPromptAddendum?.(null);
      return { status: 200, body: { default: result?.default || "", addendum: result?.addendum || "", reset: true } };
    }
    return { status: 405, body: { error: "GET/POST/DELETE only" } };
  }
  if (method !== "GET") {
    return { status: 405, body: { error: "GET only" } };
  }
  if (!ctx.generateReport) {
    return { status: 503, body: { error: "report engine not available" } };
  }
  const period = query.get("period") || "daily";
  if (!["daily", "weekly", "yearly", "custom"].includes(period)) {
    return { status: 400, body: { error: "period must be daily, weekly, yearly or custom" } };
  }
  let customRange = null;
  if (period === "custom") {
    const rawStart = query.get("start");
    const rawEnd = query.get("end");
    if (!rawStart || !rawEnd) {
      return { status: 400, body: { error: "custom period requires start and end dates" } };
    }
    const start2 = new Date(rawStart);
    const end2 = new Date(rawEnd);
    if (Number.isNaN(start2.getTime()) || Number.isNaN(end2.getTime())) {
      return { status: 400, body: { error: "invalid start or end date" } };
    }
    if (end2 < start2) {
      return { status: 400, body: { error: "end date must be after start date" } };
    }
    customRange = { start: start2, end: end2 };
  }
  const rawDate = query.get("date");
  const anchorDate = rawDate ? new Date(rawDate) : new Date();
  if (Number.isNaN(anchorDate.getTime())) {
    return { status: 400, body: { error: "invalid date" } };
  }
  try {
    const { markdown, stats } = await ctx.generateReport(period, anchorDate, customRange);
    return {
      status: 200,
      body: {
        markdown,
        stats: {
          period: stats.period,
          sessions: stats.sessions,
          messages: stats.messages,
          start: stats.start.toISOString(),
          end: stats.end.toISOString()
        }
      }
    };
  } catch (err) {
    console.error(`[report] ${err.message}`);
    return { status: 500, body: { error: err.message } };
  }
}

// src/server/api/settings.ts
function parseBody9(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
var VALID_PRESETS = /* @__PURE__ */ new Set(["auto", "flash", "pro", "fast", "smart", "max"]);
var VALID_EFFORTS = /* @__PURE__ */ new Set(["high", "max"]);
var DEFAULT_MODEL = "deepseek-v4-flash";
var PRESET_MODELS = {
  flash: "deepseek-v4-flash",
  pro: "deepseek-v4-pro"
};
var LEGACY_PRESET_ALIASES = {
  fast: "flash",
  smart: "auto",
  max: "pro"
};
// Dashboard consumers must keep these concepts separate:
// cfg.model is the auto-mode baseline, effectiveModel is the preset commitment,
// runtimeModel is the live loop, and displayModel is the primary UI label.
// Legacy names mirror resolvePreset(): fast->flash, smart->auto, max->pro.
function effectiveModelConfig(cfg) {
  const rawPreset = cfg.preset ?? "auto";
  const preset = LEGACY_PRESET_ALIASES[rawPreset] ?? rawPreset;
  const provider = (cfg.providers ?? []).find((p) => p.id === cfg.activeProviderId) ?? cfg.providers?.[0];
  if (provider) {
    const supportedPresets = new Set();
    for (const m of provider.models ?? []) {
      for (const pr of m.presets ?? []) supportedPresets.add(pr);
    }
    const resolvedPreset = supportedPresets.has(preset) ? preset : (provider.defaultPreset ?? "flash");
    const modelObj = provider.models?.find((m) => m.presets?.includes(resolvedPreset)) ?? provider.models?.[0];
    const model = modelObj?.id ?? DEFAULT_MODEL;
    return { rawPreset, preset: resolvedPreset, configuredModel: model, model, locked: true };
  }
  const configuredModel = cfg.model ?? DEFAULT_MODEL;
  const lockedModel = PRESET_MODELS[preset];
  return {
    rawPreset,
    preset,
    configuredModel,
    model: lockedModel ?? configuredModel,
    locked: Boolean(lockedModel)
  };
}
function modelState(ctx, cfg) {
  const effective = effectiveModelConfig(cfg);
  const runtimeModel = ctx.loop?.model ?? null;
  // `displayModel` is the UI's primary label: actual loop model when available,
  // otherwise the model that will be used when the next loop is created.
  const displayModel = runtimeModel ?? effective.model;
  const modelDrift = effective.locked && Boolean(runtimeModel) && runtimeModel !== effective.model;
  return {
    rawPreset: effective.rawPreset,
    preset: effective.preset,
    configuredModel: effective.configuredModel,
    effectiveModel: effective.model,
    runtimeModel,
    displayModel,
    modelDrift
  };
}
async function handleProviders(method, rest, body, ctx) {
  if (method === "GET") {
    const cfg = readConfig(ctx.configPath);
    const providers = (cfg.providers ?? []).map((p) => {
      const models = (p.models ?? []).map((model) => {
        const { verification, ...publicModel } = model;
        const current = verification?.fingerprint === modelVerificationFingerprint(p, model);
        return {
          ...publicModel,
          testStatus: current ? verification.ok === true ? "passed" : "failed" : "untested",
          testedAt: current ? verification.checkedAt : null,
          testElapsedMs: current ? verification.elapsedMs ?? null : null,
          testError: current && verification.ok !== true ? verification.error ?? "model test failed" : null
        };
      });
      const passed = models.filter((model) => model.testStatus === "passed").length;
      const failed = models.filter((model) => model.testStatus === "failed").length;
      return {
        ...p,
        apiKey: p.apiKey ? redactKey(p.apiKey) : null,
        apiKeySet: Boolean(p.apiKey),
        models,
        modelTest: { passed, failed, tested: passed + failed, total: models.length }
      };
    });
    const activeProvider = providers.find((p) => p.id === cfg.activeProviderId) ?? providers[0] ?? null;
    const allPresets = new Set();
    const allEfforts = new Set();
    for (const m of activeProvider?.models ?? []) {
      for (const pr of m.presets ?? []) allPresets.add(pr);
      for (const ef of m.efforts ?? []) allEfforts.add(ef);
    }
    return {
      status: 200,
      body: {
        providers,
        activeProviderId: cfg.activeProviderId ?? null,
        modelVerification: cfg.modelVerification ?? { dirty: false },
        providerCapabilities: { presets: [...allPresets], efforts: [...allEfforts] },
      },
    };
  }
  if (method === "POST" && rest[0] === "active") {
    let parsed;
    try { parsed = JSON.parse(body || "{}"); } catch { return { status: 400, body: { error: "body must be JSON" } }; }
    if (!parsed.id || typeof parsed.id !== "string") {
      return { status: 400, body: { error: "id is required" } };
    }
    const cfg = readConfig(ctx.configPath);
    if (!cfg.providers?.find((p) => p.id === parsed.id)) {
      return { status: 404, body: { error: `provider "${parsed.id}" not found` } };
    }
    if (ctx.isBusy?.() && cfg.activeProviderId !== parsed.id) {
      return { status: 409, body: { error: "请等待当前回答结束后再切换模型服务" } };
    }
    const modelSwitch = cfg.activeProviderId === parsed.id
      ? null
      : await ctx.syncProvider?.(parsed.id);
    return { status: 200, body: { ok: true, modelSwitch } };
  }
  if (method === "POST" && rest[0] === "test") {
    const cfg = readConfig(ctx.configPath);
    const providers = cfg.providers ?? [];
    const activeProvider = providers.find((item) => item.id === cfg.activeProviderId) ?? providers[0] ?? null;
    const jobs = providers.flatMap((provider) => (provider.models ?? []).map((model) => ({ provider, model })));
    if (jobs.length === 0) return { status: 400, body: { error: "no configured models to test" } };
    if (ctx.isBusy?.()) return { status: 409, body: { error: "请等待当前回答结束后再检测模型" } };
    const results = new Array(jobs.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < jobs.length) {
        const index = cursor++;
        const { provider, model } = jobs[index];
        const startedAt = Date.now();
        const checkedAt = new Date().toISOString();
        try {
          if (!String(provider.baseUrl || "").trim() || !String(provider.apiKey || "").trim()) throw new Error("provider requires baseUrl and apiKey");
          const tester = ctx.testProviderModel ?? testProviderModelCommunication;
          await tester(provider, model);
          model.verification = { ok: true, checkedAt, elapsedMs: Date.now() - startedAt, fingerprint: modelVerificationFingerprint(provider, model) };
        } catch (error) {
          model.verification = {
            ok: false,
            checkedAt,
            elapsedMs: Date.now() - startedAt,
            error: safeProviderTestError(error, provider.apiKey),
            fingerprint: modelVerificationFingerprint(provider, model)
          };
        }
        results[index] = {
          providerId: provider.id,
          providerName: provider.name ?? provider.id,
          modelId: model.id,
          modelName: model.name ?? model.id,
          ok: model.verification.ok,
          elapsedMs: model.verification.elapsedMs,
          error: model.verification.error ?? null
        };
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, jobs.length) }, () => worker()));
    const firstPassed = activeProvider?.models?.find((model) => model.verification?.ok === true);
    let activated = null;
    if (firstPassed) {
      const preset = activationPresetForModel(firstPassed);
      cfg.activeProviderId = activeProvider.id;
      cfg.preset = preset;
      if (!firstPassed.efforts?.includes(cfg.reasoningEffort)) cfg.reasoningEffort = firstPassed.efforts?.[0] ?? activeProvider.defaultEffort ?? "high";
      activated = { providerId: activeProvider.id, modelId: firstPassed.id, preset };
    }
    cfg.modelVerification = {
      dirty: false,
      testedAt: new Date().toISOString(),
      passed: results.filter((item) => item.ok).length,
      total: results.length
    };
    writeConfig(cfg, ctx.configPath);
    const modelSwitch = activated ? await ctx.syncProvider?.(activeProvider.id) : null;
    return { status: 200, body: { ok: true, results, passed: results.filter((item) => item.ok).length, total: results.length, activated, modelSwitch } };
  }
  if (method === "POST" && rest[0] === "import") {
    let parsed;
    try { parsed = JSON.parse(body || "{}"); } catch { return { status: 400, body: { error: "body must be JSON" } }; }
    const incoming = parsed.providers;
    const cfg = readConfig(ctx.configPath);
    const existing = cfg.providers ?? [];
    const validationError = validateIncomingProviders(incoming, existing);
    if (validationError) return { status: 400, body: { error: validationError } };
    for (const p of incoming) {
      if (!p.id || typeof p.id !== "string") continue;
      const idx = existing.findIndex((e) => e.id === p.id);
      if (idx >= 0) {
        for (const key of Object.keys(p)) existing[idx][key] = p[key];
      } else {
        existing.push(p);
      }
    }
    for (const provider of existing) {
      for (const model of provider.models ?? []) delete model.verification;
    }
    cfg.modelVerification = { dirty: true, reason: "provider-import", changedAt: new Date().toISOString() };
    cfg.providers = existing;
    writeConfig(cfg, ctx.configPath);
    const refreshed = ctx.refreshContextCap?.() ?? null;
    return { status: 200, body: { ok: true, count: existing.length, requiresModelTest: true, modelSwitch: refreshed?.modelSwitch ?? null, contextPolicy: refreshed?.contextPolicy ?? null } };
  }
  return { status: 404, body: { error: "not found" } };
}
function validateIncomingProviders(incoming, existing) {
  if (!Array.isArray(incoming) || incoming.length === 0) return "providers must be a non-empty array";
  for (const provider of incoming) {
    if (!provider || typeof provider !== "object" || typeof provider.id !== "string" || !provider.id.trim()) return "each provider must have a non-empty id";
    const prior = existing.find((entry) => entry.id === provider.id);
    const merged = { ...prior, ...provider };
    if (provider.models === void 0 && prior) continue;
    if (!Array.isArray(merged.models) || merged.models.length === 0) return `provider "${provider.id}" must include a non-empty models array`;
    for (const model of merged.models) {
      if (!model || typeof model.id !== "string" || !model.id.trim()) return `provider "${provider.id}" contains a model without an id`;
      if (!Number.isSafeInteger(model.maxContextLength) || model.maxContextLength <= 0) return `model "${model.id}" must declare a positive integer maxContextLength`;
    }
  }
  return null;
}
function activationPresetForModel(model) {
  const presets = Array.isArray(model.presets) ? model.presets : [];
  if (presets.includes("flash")) return "flash";
  if (presets.includes("pro")) return "pro";
  return presets.find((preset) => preset !== "auto") ?? presets[0] ?? "flash";
}
function modelVerificationFingerprint(provider, model) {
  return createHash("sha256").update(JSON.stringify({
    providerId: provider.id,
    baseUrl: String(provider.baseUrl || "").trim().replace(/\/+$/, ""),
    apiKey: String(provider.apiKey || ""),
    modelId: model.id
  })).digest("hex");
}
async function testProviderModelCommunication(provider, model) {
  const client = new DeepSeekClient({
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    timeoutMs: 1e4,
    retry: { maxAttempts: 1 }
  });
  await client.chat({
    model: model.id,
    messages: [{ role: "user", content: "Reply with OK." }],
    maxTokens: 8
  });
}
function safeProviderTestError(error, apiKey) {
  const message = error instanceof Error ? error.message : String(error);
  const secret = String(apiKey || "");
  return (secret ? message.replaceAll(secret, "[redacted]") : message).slice(0, 300);
}
async function handleSettings(method, _rest, body, ctx) {
  if (method === "GET") {
    const cfg = readConfig(ctx.configPath);
    if (cfg.search === void 0) {
      cfg.search = true;
      writeConfig(cfg, ctx.configPath);
    }
    const live = ctx.loop;
    const state = modelState(ctx, cfg);
    const activeProvider = (cfg.providers ?? []).find((provider) => provider.id === cfg.activeProviderId) ?? cfg.providers?.[0] ?? null;
    return {
      status: 200,
      body: {
        apiKey: (activeProvider?.apiKey ?? cfg.apiKey) ? redactKey(activeProvider?.apiKey ?? cfg.apiKey) : null,
        apiKeySet: Boolean(activeProvider?.apiKey ?? cfg.apiKey),
        baseUrl: activeProvider?.baseUrl ?? cfg.baseUrl ?? null,
        credentialTarget: activeProvider ? { kind: "provider", id: activeProvider.id, name: activeProvider.name ?? activeProvider.id } : { kind: "legacy", id: null, name: "Legacy configuration" },
        lang: getLanguage(),
        preset: state.preset,
        reasoningEffort: ctx.loop?.reasoningEffort ?? cfg.reasoningEffort ?? "max",
        search: cfg.search !== false,
        webSearchEngine: cfg.webSearchEngine ?? "bing-scrape",
        webSearchEndpoint: cfg.webSearchEndpoint ?? null,
        bingApiKeySet: Boolean(cfg.bingApiKey),
        editMode: cfg.editMode ?? "admin",
        mode: ctx.getModes?.()?.current ?? cfg.mode ?? "general",
        modes: ctx.getModes?.()?.list ?? (()=>{const all=cfg.modes??{};return Object.entries(all).map(([id,m])=>({id,label:m.label??id,rules:m.eccRules??[]}));})(),
        activeMode: ctx.getModes?.()?.active ?? null,
        eccRules: ctx.getEccRules?.() ?? null,
        session: cfg.session ?? null,
        model: state.displayModel,
        configuredModel: state.configuredModel,
        effectiveModel: state.effectiveModel,
        runtimeModel: state.runtimeModel,
        displayModel: state.displayModel,
        modelDrift: state.modelDrift,
        proNext: live?.proArmed ?? false,
        budgetUsd: live?.budgetUsd ?? null,
        sessionSpendUsd: ctx.getStats?.()?.totalCostUsd ?? null,
        contextCapTokens: cfg.contextCapTokens ?? null,
        providerContextCap: (() => {
          const provider = (cfg.providers ?? []).find((p) => p.id === cfg.activeProviderId) ?? cfg.providers?.[0];
          const mc = effectiveModelConfig(cfg);
          return provider?.models?.find((m) => m.id === mc.model)?.maxContextLength ?? null;
        })(),
        activeProviderId: cfg.activeProviderId ?? null,
        providerCapabilities: (() => {
          const provider = (cfg.providers ?? []).find((p) => p.id === cfg.activeProviderId) ?? cfg.providers?.[0];
          const allPresets = new Set();
          const allEfforts = new Set();
          for (const m of provider?.models ?? []) {
            for (const pr of m.presets ?? []) allPresets.add(pr);
            for (const ef of m.efforts ?? []) allEfforts.add(ef);
          }
          return { presets: [...allPresets], efforts: [...allEfforts] };
        })(),
        // Hint to the SPA which fields require restart.
        appliesAt: {
          apiKey: activeProvider ? "live" : "next-turn",
          baseUrl: activeProvider ? "live" : "next-turn",
          preset: "live",
          reasoningEffort: "live",
          search: "next-session",
          webSearchEngine: "next-session",
          webSearchEndpoint: "next-session",
          bingApiKey: "next-session",
          model: "live",
          proNext: "next-turn",
          budgetUsd: "live",
          mode: "live",
          eccRules: "live",
          contextCapTokens: "live"
        }
      }
    };
  }
  if (method === "POST") {
    const fields = parseBody9(body);
    const cfg = readConfig(ctx.configPath);
    const activeCredentialProvider = (cfg.providers ?? []).find((provider) => provider.id === cfg.activeProviderId) ?? cfg.providers?.[0] ?? null;
    const changed = [];
    let credentialsChanged = false;
    let langPending = null;
    let presetPendingLive = null;
    let effortPendingLive = null;
    let eccRulesPending = null;
    if (fields.lang !== void 0) {
      const raw = String(fields.lang);
      const supported = getSupportedLanguages();
      const langCode = supported.find((l) => l.toLowerCase() === raw.toLowerCase());
      if (!langCode) {
        return { status: 400, body: { error: `lang must be one of: ${supported.join(", ")}` } };
      }
      cfg.lang = langCode;
      langPending = langCode;
      changed.push("lang");
    }
    if (fields.apiKey !== void 0) {
      if (typeof fields.apiKey !== "string" || !isPlausibleKey(fields.apiKey)) {
        return { status: 400, body: { error: "apiKey must be 16+ chars with no whitespace" } };
      }
      if (activeCredentialProvider) activeCredentialProvider.apiKey = fields.apiKey.trim();
      else cfg.apiKey = fields.apiKey.trim();
      credentialsChanged = true;
      changed.push("apiKey");
    }
    if (fields.baseUrl !== void 0) {
      if (typeof fields.baseUrl !== "string" || !fields.baseUrl.trim()) {
        return { status: 400, body: { error: "baseUrl must be a non-empty string" } };
      }
      if (activeCredentialProvider) activeCredentialProvider.baseUrl = fields.baseUrl.trim();
      else cfg.baseUrl = fields.baseUrl.trim();
      credentialsChanged = true;
      changed.push("baseUrl");
    }
    if (fields.preset !== void 0) {
      if (typeof fields.preset !== "string" || !VALID_PRESETS.has(fields.preset)) {
        return { status: 400, body: { error: "preset must be auto | flash | pro" } };
      }
      const provider = (cfg.providers ?? []).find((p) => p.id === cfg.activeProviderId) ?? cfg.providers?.[0];
      if (provider) {
        const capsPresets = new Set();
        for (const m of provider.models ?? []) for (const pr of m.presets ?? []) capsPresets.add(pr);
        const resolvedPreset = LEGACY_PRESET_ALIASES[fields.preset] ?? fields.preset;
        if (!capsPresets.has(resolvedPreset)) {
          return { status: 400, body: { error: `preset "${fields.preset}" not supported by active provider "${provider.id}"` } };
        }
      }
      cfg.preset = fields.preset;
      presetPendingLive = fields.preset;
      changed.push("preset");
    }
    if (fields.reasoningEffort !== void 0) {
      if (typeof fields.reasoningEffort !== "string" || !VALID_EFFORTS.has(fields.reasoningEffort)) {
        return { status: 400, body: { error: "reasoningEffort must be high | max" } };
      }
      const provider = (cfg.providers ?? []).find((p) => p.id === cfg.activeProviderId) ?? cfg.providers?.[0];
      if (provider) {
        const capsEfforts = new Set();
        for (const m of provider.models ?? []) for (const ef of m.efforts ?? []) capsEfforts.add(ef);
        if (!capsEfforts.has(fields.reasoningEffort)) {
          return { status: 400, body: { error: `effort "${fields.reasoningEffort}" not supported by active provider "${provider.id}"` } };
        }
      }
      cfg.reasoningEffort = fields.reasoningEffort;
      effortPendingLive = fields.reasoningEffort;
      changed.push("reasoningEffort");
    }
    if (fields.search !== void 0) {
      if (typeof fields.search !== "boolean") {
        return { status: 400, body: { error: "search must be a boolean" } };
      }
      cfg.search = fields.search;
      changed.push("search");
    }
    if (fields.webSearchEngine !== void 0) {
      const v = String(fields.webSearchEngine);
      if (!["mojeek", "searxng", "bing", "bing-scrape"].includes(v)) {
        return { status: 400, body: { error: "webSearchEngine must be mojeek | searxng | bing | bing-scrape" } };
      }
      cfg.webSearchEngine = v;
      changed.push("webSearchEngine");
    }
    if (fields.webSearchEndpoint !== void 0) {
      if (typeof fields.webSearchEndpoint !== "string" || !fields.webSearchEndpoint.trim()) {
        return { status: 400, body: { error: "webSearchEndpoint must be a non-empty string" } };
      }
      cfg.webSearchEndpoint = fields.webSearchEndpoint.trim();
      changed.push("webSearchEndpoint");
    }
    if (fields.bingApiKey !== void 0) {
      if (fields.bingApiKey === null || fields.bingApiKey === "") {
        cfg.bingApiKey = void 0;
      } else if (typeof fields.bingApiKey === "string" && fields.bingApiKey.trim().length >= 16) {
        cfg.bingApiKey = fields.bingApiKey.trim();
      } else {
        return { status: 400, body: { error: "bingApiKey must be null or a string (16+ chars)" } };
      }
      changed.push("bingApiKey");
    }
    if (fields.mode !== void 0) {
      const modeIds = ctx.getModes?.()?.list?.map((m) => m.id) ?? Object.keys(cfg.modes ?? {});
      if (typeof fields.mode !== "string" || !modeIds.includes(fields.mode)) {
        return { status: 400, body: { error: "mode must be one of: " + modeIds.join(", ") } };
      }
      cfg.mode = fields.mode;
      changed.push("mode");
    }
    if (fields.eccRules !== void 0) {
      if (!Array.isArray(fields.eccRules) || fields.eccRules.some((name) => typeof name !== "string")) {
        return { status: 400, body: { error: "eccRules must be an array of rule pack names" } };
      }
      const available = ctx.getEccRules?.()?.available ?? [];
      const normalized = [...new Set(fields.eccRules)];
      const unknown = normalized.filter((name) => !available.includes(name));
      if (unknown.length > 0) {
        return { status: 400, body: { error: `unknown ECC rule pack(s): ${unknown.join(", ")}` } };
      }
      eccRulesPending = normalized;
      changed.push("eccRules");
    }
    if (fields.contextCapTokens !== void 0) {
      if (fields.contextCapTokens === null) {
        cfg.contextCapTokens = void 0;
      } else if (typeof fields.contextCapTokens === "number" && fields.contextCapTokens > 0 && Number.isFinite(fields.contextCapTokens)) {
        cfg.contextCapTokens = Math.floor(fields.contextCapTokens);
        const capProvider = (cfg.providers ?? []).find((p) => p.id === cfg.activeProviderId) ?? cfg.providers?.[0];
        const capMc = effectiveModelConfig(cfg);
        const capModelObj = capProvider?.models?.find((m) => m.id === capMc.model);
        const capMaxLen = capModelObj?.maxContextLength;
        if (capMaxLen && typeof capMaxLen === "number" && cfg.contextCapTokens > capMaxLen) {
          return { status: 400, body: { error: `contextCapTokens (${cfg.contextCapTokens}) exceeds model "${capMc.model}" maxContextLength (${capMaxLen})` } };
        }
      } else {
        return { status: 400, body: { error: "contextCapTokens must be null or a positive finite number" } };
      }
      changed.push("contextCapTokens");
    }
    let modelPendingLive = null;
    let proNextPending = null;
    let budgetPending;
    if (fields.model !== void 0) {
      if (typeof fields.model !== "string" || !fields.model.trim()) {
        return { status: 400, body: { error: "model must be a non-empty string" } };
      }
      modelPendingLive = fields.model.trim();
      // Persist the baseline model; preset=pro/flash still overrides it at runtime.
      cfg.model = modelPendingLive;
      changed.push("model");
    }
    if (fields.proNext !== void 0) {
      if (typeof fields.proNext !== "boolean") {
        return { status: 400, body: { error: "proNext must be a boolean" } };
      }
      proNextPending = fields.proNext;
      changed.push("proNext");
    }
    if (fields.budgetUsd !== void 0) {
      if (fields.budgetUsd === null) {
        budgetPending = null;
      } else if (typeof fields.budgetUsd === "number" && fields.budgetUsd > 0 && Number.isFinite(fields.budgetUsd)) {
        budgetPending = fields.budgetUsd;
      } else {
        return {
          status: 400,
          body: { error: "budgetUsd must be null or a positive finite number" }
        };
      }
      changed.push("budgetUsd");
    }
    if (fields.workspaceDir !== void 0) {
      if (typeof fields.workspaceDir !== "string" || !fields.workspaceDir.trim()) {
        return { status: 400, body: { error: "workspaceDir must be a non-empty string" } };
      }
      cfg.workspaceDir = fields.workspaceDir.trim();
      ctx.setWorkspaceDir?.(cfg.workspaceDir);
      changed.push("workspaceDir");
    }
    let modelSwitch = null;
    let credentialSync = null;
    if (changed.length > 0) {
      if (credentialsChanged && activeCredentialProvider) {
        for (const model of activeCredentialProvider.models ?? []) delete model.verification;
        cfg.modelVerification = {
          dirty: true,
          reason: "provider-credentials",
          providerId: activeCredentialProvider.id,
          changedAt: new Date().toISOString()
        };
      }
      writeConfig(cfg, ctx.configPath);
      if (credentialsChanged && activeCredentialProvider && ctx.syncProvider) {
        if (ctx.isBusy?.()) credentialSync = { deferred: true, providerId: activeCredentialProvider.id };
        else {
          try {
            credentialSync = await ctx.syncProvider(activeCredentialProvider.id) ?? { deferred: false, providerId: activeCredentialProvider.id };
          } catch (err) {
            credentialSync = { deferred: true, providerId: activeCredentialProvider.id, error: err.message };
          }
        }
      }
      if (changed.includes("mode")) ctx.setMode?.(cfg.mode);
      if (eccRulesPending !== null) ctx.setEccRules?.(eccRulesPending);
      if (langPending) setLanguage(langPending);
      if (presetPendingLive) modelSwitch = ctx.applyPresetLive?.(presetPendingLive) ?? modelSwitch;
      if (effortPendingLive) ctx.applyEffortLive?.(effortPendingLive);
      if (modelPendingLive) modelSwitch = ctx.applyModelLive?.(modelPendingLive) ?? modelSwitch;
      if (proNextPending !== null) ctx.setProNextLive?.(proNextPending);
      if (budgetPending !== void 0) ctx.setBudgetUsdLive?.(budgetPending);
      if (changed.includes("contextCapTokens")) ctx.refreshContextCap?.();
      ctx.audit?.({ ts: Date.now(), action: "set-settings", payload: { fields: changed } });
    }
    return { status: 200, body: { changed, modelSwitch, credentialSync, requiresModelTest: credentialsChanged && Boolean(activeCredentialProvider) } };
  }
  return { status: 405, body: { error: "GET or POST only" } };
}

// src/server/api/skills.ts
import {
  closeSync as closeSync4,
  existsSync as existsSync9,
  fstatSync as fstatSync4,
  mkdirSync as mkdirSync3,
  openSync as openSync4,
  readFileSync as readFileSync6,
  readSync as readSync4,
  readdirSync as readdirSync5,
  rmSync,
  statSync as statSync5,
  writeFileSync as writeFileSync3
} from "fs";
import { homedir as homedir3 } from "os";
import { dirname as dirname4, join as join8 } from "path";
function parseBody10(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
var SAFE_NAME2 = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
function globalSkillsDir() {
  return join8(homedir3(), ".visionox", SKILLS_DIRNAME);
}
function projectSkillsDir(rootDir) {
  return join8(rootDir, ".visionox", SKILLS_DIRNAME);
}
function parseFrontmatterDescription(raw) {
  const desc = parseFrontmatter(raw).data.description?.trim();
  return desc ? desc : void 0;
}
function readSkillListEntry(skillPath, name, scope) {
  try {
    const fd = openSync4(skillPath, "r");
    let stat;
    let raw;
    try {
      stat = fstatSync4(fd);
      if (!stat.isFile()) return null;
      const buf = Buffer.alloc(stat.size);
      let read = 0;
      while (read < stat.size) {
        const n = readSync4(fd, buf, read, stat.size - read, read);
        if (n <= 0) break;
        read += n;
      }
      raw = buf.toString("utf8", 0, read);
    } finally {
      closeSync4(fd);
    }
    const item = {
      name,
      scope,
      path: skillPath,
      size: stat.size,
      mtime: stat.mtime.getTime()
    };
    const desc = parseFrontmatterDescription(raw);
    if (desc) item.description = desc;
    if (scope === "global") {
      try {
        const marker = JSON.parse(readFileSync6(join8(dirname4(skillPath), "_visionox_builtin.json"), "utf8"));
        if (marker?.owner === "visionox-bootstrap") item.managedBuiltin = true;
      } catch {
      }
    }
    return item;
  } catch {
    return null;
  }
}
function resolveSkillPath(dir, name) {
  const folderPath = join8(dir, name, SKILL_FILE);
  try {
    if (statSync5(folderPath).isFile()) return { path: folderPath, layout: "folder" };
  } catch {
  }
  const flatPath = join8(dir, `${name}.md`);
  try {
    if (statSync5(flatPath).isFile()) return { path: flatPath, layout: "flat" };
  } catch {
  }
  return null;
}
function defaultSkillPath(dir, name) {
  return { path: join8(dir, name, SKILL_FILE), layout: "folder" };
}
function listSkills(dir, scope) {
  if (!existsSync9(dir)) return [];
  const out = [];
  try {
    for (const entry of readdirSync5(dir, { withFileTypes: true })) {
      let name;
      let skillPath;
      if (entry.isDirectory()) {
        name = entry.name;
        if (!SAFE_NAME2.test(name)) continue;
        skillPath = join8(dir, name, SKILL_FILE);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        name = entry.name.slice(0, -3);
        if (!SAFE_NAME2.test(name)) continue;
        skillPath = join8(dir, entry.name);
      } else {
        continue;
      }
      const item = readSkillListEntry(skillPath, name, scope);
      if (item) out.push(item);
    }
  } catch {
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
function countSubagentRuns(usageLogPath) {
  const cutoff = Date.now() - 7 * 864e5;
  const counts = /* @__PURE__ */ new Map();
  for (const r of readUsageLog(usageLogPath)) {
    if (r.kind !== "subagent" || r.ts < cutoff) continue;
    const skill = r.subagent?.skillName?.trim();
    if (!skill) continue;
    counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }
  return counts;
}
async function handleSkills(method, rest, body, ctx) {
  if (method === "GET" && rest[0] === "status") {
    if (!ctx.getSkillEnvironmentStatus) {
      return { status: 503, body: { error: "skill environment status is unavailable" } };
    }
    return { status: 200, body: await ctx.getSkillEnvironmentStatus() };
  }
  if (method === "POST" && rest[0] === "repair") {
    if (!ctx.repairSkillEnvironment) {
      return { status: 503, body: { error: "skill environment repair is unavailable" } };
    }
    return { status: 200, body: await ctx.repairSkillEnvironment() };
  }
  const cwd = ctx.getCurrentCwd?.();
  const globalDir = ctx.skillsRoot ?? globalSkillsDir();
  if (method === "GET" && rest.length === 0) {
    const runs7d = countSubagentRuns(ctx.usageLogPath);
    const tag = (rows) => rows.map((r) => ({ ...r, runs7d: runs7d.get(r.name) ?? 0 }));
    return {
      status: 200,
      body: {
        global: tag(listSkills(globalDir, "global")),
        project: cwd ? tag(listSkills(projectSkillsDir(cwd), "project")) : [],
        builtin: [
          {
            name: "explore",
            scope: "builtin",
            description: "subagent \u2014 broad codebase survey",
            runs7d: runs7d.get("explore") ?? 0
          },
          {
            name: "research",
            scope: "builtin",
            description: "subagent \u2014 deep web + repo research",
            runs7d: runs7d.get("research") ?? 0
          }
        ],
        paths: {
          global: globalDir,
          project: cwd ? projectSkillsDir(cwd) : null
        }
      }
    };
  }
  const [scope, ...nameParts] = rest;
  const name = nameParts.join("/");
  if (!scope || !name || !SAFE_NAME2.test(name)) {
    return { status: 400, body: { error: "expected /api/skills/<scope>/<name>" } };
  }
  if (scope !== "project" && scope !== "global") {
    return {
      status: 400,
      body: { error: "scope must be project | global (builtin is read-only)" }
    };
  }
  let dir;
  if (scope === "project") {
    if (!cwd) {
      return {
        status: 503,
        body: { error: "no active project \u2014 open `/dashboard` from `visionox code`" }
      };
    }
    dir = projectSkillsDir(cwd);
  } else {
    dir = globalDir;
  }
  const resolved = resolveSkillPath(dir, name);
  if (method === "GET") {
    if (!resolved) return { status: 404, body: { error: "skill not found" } };
    return {
      status: 200,
      body: { path: resolved.path, body: readFileSync6(resolved.path, "utf8") }
    };
  }
  if (method === "POST") {
    const { body: contents } = parseBody10(body);
    if (typeof contents !== "string") {
      return { status: 400, body: { error: "body (string) required" } };
    }
    const fm = validateSkillFrontmatter(contents);
    if ("error" in fm) {
      return { status: 400, body: { error: fm.error } };
    }
    const target = resolved ?? defaultSkillPath(dir, name);
    mkdirSync3(dirname4(target.path), { recursive: true });
    writeFileSync3(target.path, contents, "utf8");
    ctx.audit?.({
      ts: Date.now(),
      action: "save-skill",
      payload: { scope, name, path: target.path }
    });
    return { status: 200, body: { saved: true, path: target.path } };
  }
  if (method === "DELETE") {
    if (!resolved) return { status: 404, body: { error: "skill not found" } };
    let disabledBuiltin = false;
    if (scope === "global" && resolved.layout === "folder") {
      try {
        const marker = JSON.parse(readFileSync6(join8(dirname4(resolved.path), "_visionox_builtin.json"), "utf8"));
        if (marker?.owner === "visionox-bootstrap") {
          if (!ctx.disableBootstrapSkill) return { status: 503, body: { error: "bootstrap skill disable service is unavailable" } };
          ctx.disableBootstrapSkill(name);
          disabledBuiltin = true;
        }
      } catch (error) {
        if (error?.code !== "ENOENT") {
          return { status: 409, body: { error: "bootstrap skill marker cannot be read; repair the skill environment before deleting" } };
        }
      }
    }
    try {
      rmSync(resolved.layout === "folder" ? dirname4(resolved.path) : resolved.path, {
        recursive: true,
        force: true
      });
    } catch (error) {
      if (disabledBuiltin) ctx.enableBootstrapSkill?.(name);
      throw error;
    }
    ctx.audit?.({ ts: Date.now(), action: "delete-skill", payload: { scope, name } });
    return { status: 200, body: { deleted: true, disabledBuiltin } };
  }
  return { status: 405, body: { error: `method ${method} not supported` } };
}

// src/server/api/slash.ts
async function handleSlash(method, _rest, _body, ctx) {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  const codeMode = ctx.getCurrentCwd?.() != null;
  const HIDDEN_CMDS = new Set([
    "preset","model","theme","mode","pro","permissions","stop",
    "init","apply","discard","walk","undo","history","show",
    "commit","plan","checkpoint","restore","cwd","jobs","kill","logs",
    "resource","prompt","memory","skill","replay","stats","doctor"
  ]);
  const commands = SLASH_COMMANDS
    .filter((c) => c.contextual !== "code" || codeMode)
    .filter((c) => !HIDDEN_CMDS.has(c.cmd))
    .map((c) => ({ cmd: c.cmd, summary: c.summary, argsHint: c.argsHint, contextual: c.contextual, aliases: c.aliases }));
  commands.push({
    cmd: "learn",
    summary: "\u5B66\u4E60\u7CFB\u7EDF\uFF08\u6280\u80FD\u63D0\u53D6/\u9879\u76EE\u8BB0\u5FC6/\u8BED\u4E49\u7D22\u5F15/\u95EE\u7B54/\u5BFC\u5E08\u6A21\u5F0F\uFF09",
    argsHint: "<subcommand>",
    contextual: null,
    aliases: []
  });
  const merged = new Map(commands.map((command) => [command.cmd, command]));
  for (const command of ctx.getSlashCommands?.() ?? []) {
    const cmd = String(command.name ?? "").replace(/^\//, "");
    if (!cmd) continue;
    merged.set(cmd, {
      cmd,
      summary: command.desc ?? "",
      argsHint: String(command.usage ?? "").replace(/^\/[^\s]+\s*/, "") || void 0,
      contextual: null,
      aliases: (command.aliases ?? []).map((alias) => String(alias).replace(/^\//, ""))
    });
  }
  return { status: 200, body: { commands: [...merged.values()], codeMode } };
}

// src/server/api/submit.ts
function parseBody11(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
async function handleSubmit(method, _rest, body, ctx) {
  if (method !== "POST") {
    return { status: 405, body: { error: "POST only" } };
  }
  if (!ctx.submitPrompt) {
    return {
      status: 503,
      body: {
        error: "submit requires an attached dashboard session \u2014 open `/dashboard` from inside `visionox code` or `visionox chat`."
      }
    };
  }
  const { prompt, session, images, requestId } = parseBody11(body);
  let parsedImages = null;
  if (Array.isArray(images) && images.length > 0) {
    parsedImages = images.filter(function(i) { return typeof i === "string" && i.startsWith("data:image/"); });
    if (parsedImages.length === 0) parsedImages = null;
  }
  if (typeof prompt !== "string" || (!prompt.trim() && !parsedImages && !session)) {
    return { status: 400, body: { error: "prompt (non-empty string) required" } };
  }
  const result = await ctx.submitPrompt(prompt, session || null, parsedImages, {
    requestId: typeof requestId === "string" ? requestId : null
  });
  if (!result.accepted) {
    return {
      status: 409,
      body: { accepted: false, reason: result.reason ?? "loop is busy" }
    };
  }
  ctx.audit?.({
    ts: Date.now(),
    action: "submit-prompt",
    payload: { length: prompt.length }
  });
  return { status: 202, body: { accepted: true, ...result } };
}

// src/server/api/tools.ts
async function handleTools(method, _rest, _body, ctx) {
  if (method !== "GET") {
    return { status: 405, body: { error: "GET only" } };
  }
  if (!ctx.tools) {
    return {
      status: 503,
      body: {
        error: "live tools view requires an attached session \u2014 run `/dashboard` from inside `visionox code` instead of standalone `visionox dashboard`.",
        available: false
      }
    };
  }
  const specs = ctx.tools.specs();
  const items = specs.map((s) => {
    const def = ctx.tools.get(s.function.name);
    return {
      name: s.function.name,
      description: s.function.description,
      schema: s.function.parameters,
      readOnly: Boolean(def?.readOnly),
      flattened: ctx.tools.wasFlattened(s.function.name)
    };
  });
  return {
    status: 200,
    body: {
      planMode: ctx.tools.planMode,
      total: items.length,
      tools: items
    }
  };
}

// src/server/api/usage.ts
function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}
function buildSeries(records) {
  const map = /* @__PURE__ */ new Map();
  for (const r of records) {
    const day = dayKey(r.ts);
    let b = map.get(day);
    if (!b) {
      b = {
        day,
        turns: 0,
        promptTokens: 0,
        completionTokens: 0,
        cacheHitTokens: 0,
        cacheMissTokens: 0,
        costUsd: 0,
        cacheSavingsUsd: 0
      };
      map.set(day, b);
    }
    b.turns += 1;
    b.promptTokens += r.promptTokens;
    b.completionTokens += r.completionTokens;
    b.cacheHitTokens += r.cacheHitTokens;
    b.cacheMissTokens += r.cacheMissTokens;
    b.costUsd += r.costUsd;
    b.cacheSavingsUsd += cacheSavingsUsd(r.model, r.cacheHitTokens);
  }
  return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
}
async function handleUsage(method, rest, _body, ctx) {
  if (method !== "GET") {
    return { status: 405, body: { error: "GET only" } };
  }
  const records = readUsageLog(ctx.usageLogPath);
  if (rest[0] === "series") {
    return {
      status: 200,
      body: {
        days: buildSeries(records),
        recordCount: records.length
      }
    };
  }
  const agg = aggregateUsage(records);
  return {
    status: 200,
    body: {
      logPath: ctx.usageLogPath,
      logSize: formatLogSize(ctx.usageLogPath),
      recordCount: records.length,
      buckets: agg.buckets,
      byModel: agg.byModel,
      bySession: agg.bySession,
      firstSeen: agg.firstSeen,
      lastSeen: agg.lastSeen,
      subagents: agg.subagents ?? null
    }
  };
}

// src/server/router.ts
async function handleOpenUrl(method, _rest, body, ctx) {
  if (method !== "POST") {
    return { status: 405, body: { error: "POST only" } };
  }
  const { url } = parseBody11(body);
  if (typeof url !== "string" || !url.trim()) {
    return { status: 400, body: { error: "url required" } };
  }
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);
    if (process.platform === "win32") {
      await execAsync(`start "" "${url.trim()}"`);
    } else if (process.platform === "darwin") {
      await execAsync(`open "${url.trim()}"`);
    } else {
      await execAsync(`xdg-open "${url.trim()}"`);
    }
    return { status: 200, body: { opened: true } };
  } catch (err) {
    return { status: 500, body: { error: err.message } };
  }
}

async function handlePromptQueue(method, _rest, body, ctx, query = new URLSearchParams()) {
  const parsed = parseBody11(body);
  const scope = String(query.get("scope") || parsed.scope || "default");
  if (method === "GET") {
    if (!ctx.listPromptQueue) return { status: 503, body: { error: "prompt queue is not available" } };
    return { status: 200, body: { items: ctx.listPromptQueue(scope) } };
  }
  if (method === "POST") {
    if (!ctx.upsertPromptQueueItem) return { status: 503, body: { error: "prompt queue is not available" } };
    const result = ctx.upsertPromptQueueItem(scope, parsed.item);
    return result.ok ? { status: 200, body: result } : { status: 400, body: { error: result.error || "invalid queued prompt" } };
  }
  if (method === "DELETE") {
    if (!ctx.removePromptQueueItem) return { status: 503, body: { error: "prompt queue is not available" } };
    const result = ctx.removePromptQueueItem(scope, typeof parsed.id === "string" ? parsed.id : null);
    return { status: 200, body: result };
  }
  return { status: 405, body: { error: "GET/POST/DELETE only" } };
}
var ARTIFACT_MAX_BYTES = 10 * 1024 * 1024;
var ARTIFACT_SAFE_EXTS = /* @__PURE__ */ new Set([
  ".md",
  ".markdown",
  ".html",
  ".htm",
  ".txt",
  ".py",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".css",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".sql",
  ".ps1",
  ".bat",
  ".cmd",
  ".sh",
  ".ini",
  ".toml",
  ".csv"
]);
function artifactRootDir() {
  return join4(homedir(), "Downloads", "Visionox-Artifacts");
}
function artifactSafeFilename(name, fallback = "artifact.txt") {
  const raw = String(name || fallback).trim() || fallback;
  const cleaned = raw.replace(/[\\/:*?"<>|]/g, "_").replace(/[\x00-\x1f]/g, "").slice(0, 120).trim();
  const filename = cleaned || fallback;
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  if (!ARTIFACT_SAFE_EXTS.has(ext)) return `${filename}.txt`;
  return filename;
}
function artifactUniquePath(dir, filename) {
  const dot = filename.lastIndexOf(".");
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  const ext = dot >= 0 ? filename.slice(dot) : "";
  let candidate = join4(dir, filename);
  for (let i = 2; existsSync8(candidate) && i < 1e3; i++) {
    candidate = join4(dir, `${base}-${i}${ext}`);
  }
  return candidate;
}
function isArtifactPathInsideRoot(path) {
  const root = resolve2(artifactRootDir());
  const target = resolve2(String(path || ""));
  return target === root || target.startsWith(root + sep);
}
function isPathInside(parent, target) {
  const p = resolve2(String(parent || ""));
  const t = resolve2(String(target || ""));
  const pp = process.platform === "win32" ? p.toLowerCase() : p;
  const tt = process.platform === "win32" ? t.toLowerCase() : t;
  return tt === pp || tt.startsWith(pp + sep);
}
function collectScheduleArtifactPaths(ctx) {
  const schedules = Array.isArray(ctx.listSchedules?.()) ? ctx.listSchedules() : [];
  const out = [];
  for (const schedule of schedules) {
    for (const run of schedule?.history || []) {
      if (typeof run?.reportPath === "string" && run.reportPath.trim()) {
        out.push(run.reportPath);
      }
      for (const path of Array.isArray(run?.knowledgeOutputPaths) ? run.knowledgeOutputPaths : []) {
        if (typeof path === "string" && path.trim()) out.push(path);
      }
    }
  }
  return out;
}
function isArtifactAllowedPath(path, ctx) {
  const target = resolve2(String(path || ""));
  if (isArtifactPathInsideRoot(target)) return true;
  if (isOpenedDocumentPath(target)) return true;
  const cwd = ctx.getCurrentCwd?.();
  if (cwd && isPathInside(cwd, target)) return true;
  const generated = [
    ...(Array.isArray(ctx.getGeneratedArtifactPaths?.()) ? ctx.getGeneratedArtifactPaths() : []),
    ...collectScheduleArtifactPaths(ctx)
  ];
  const targetKey = process.platform === "win32" ? target.toLowerCase() : target;
  return generated.some((item) => {
    const generatedPath = resolve2(String(item || ""));
    const generatedKey = process.platform === "win32" ? generatedPath.toLowerCase() : generatedPath;
    return generatedKey === targetKey;
  });
}
function cleanArtifactPath(value) {
  let raw = String(value || "").trim();
  raw = raw.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  if (/^file:\/\//i.test(raw)) {
    try {
      raw = decodeURIComponent(raw.replace(/^file:\/\/\/?/i, process.platform === "win32" ? "" : "/"));
    } catch {
    }
  }
  return raw;
}
function resolveArtifactPath(value, ctx) {
  const raw = cleanArtifactPath(value);
  if (!raw) return "";
  const cwd = ctx.getCurrentCwd?.() || process.cwd();
  return resolve2(cwd, raw);
}
function resolveOpenedDocumentPath(value, cwd, ctx) {
  const raw = cleanArtifactPath(value);
  if (!raw) return "";
  const base = String(cwd || "").trim() || ctx.getCurrentCwd?.() || process.cwd();
  return resolve2(base, raw);
}
async function openArtifactFolder(dir) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  if (process.platform === "win32") {
    await execFileAsync("explorer.exe", [dir]);
  } else if (process.platform === "darwin") {
    await execFileAsync("open", [dir]);
  } else {
    await execFileAsync("xdg-open", [dir]);
  }
}
async function openArtifactLocation(target) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  let isFile = false;
  try {
    isFile = statSync(target).isFile();
  } catch {
  }
  if (process.platform === "win32") {
    await execFileAsync("explorer.exe", isFile ? ["/select,", target] : [target]);
  } else if (process.platform === "darwin") {
    await execFileAsync("open", isFile ? ["-R", target] : [target]);
  } else {
    await execFileAsync("xdg-open", [isFile ? dirname3(target) : target]);
  }
}
async function openArtifactFile(filePath) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  if (process.platform === "win32") {
    await execFileAsync("rundll32.exe", ["url.dll,FileProtocolHandler", filePath]);
  } else if (process.platform === "darwin") {
    await execFileAsync("open", [filePath]);
  } else {
    await execFileAsync("xdg-open", [filePath]);
  }
}
var ARTIFACT_PREVIEW_EXTS = /* @__PURE__ */ new Set([
  ".md",
  ".markdown",
  ".html",
  ".htm",
  ".txt",
  ".py",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".css",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".sql",
  ".ps1",
  ".bat",
  ".cmd",
  ".sh",
  ".ini",
  ".toml",
  ".csv"
]);
var OPENED_DOCUMENT_EXTS = /* @__PURE__ */ new Set([".md", ".markdown"]);
var OPENED_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
var openedDocumentPaths = /* @__PURE__ */ new Map();
var RECENT_ARTIFACT_LIMIT = 120;
function openedDocumentKey(path) {
  const target = resolve2(String(path || ""));
  return process.platform === "win32" ? target.toLowerCase() : target;
}
function isOpenedDocumentPath(path) {
  return openedDocumentPaths.has(openedDocumentKey(path));
}
function rememberOpenedDocumentPath(path) {
  const key = openedDocumentKey(path);
  openedDocumentPaths.set(key, resolve2(String(path || "")));
  while (openedDocumentPaths.size > 100) {
    const first = openedDocumentPaths.keys().next().value;
    openedDocumentPaths.delete(first);
  }
}
function recentArtifactKey(path) {
  const target = resolve2(String(path || ""));
  return process.platform === "win32" ? target.toLowerCase() : target;
}
function recentArtifactInfo(path, source = "generated") {
  try {
    const target = resolve2(String(path || ""));
    if (!target || !existsSync8(target)) return null;
    const st = statSync(target);
    if (!st.isFile()) return null;
    const ext = extname(target).toLowerCase();
    return {
      path: target,
      dir: dirname3(target),
      filename: basename(target),
      ext,
      size: st.size,
      mtimeMs: st.mtimeMs,
      previewable: ARTIFACT_PREVIEW_EXTS.has(ext) && st.size <= MAX_FILE_SIZE,
      openable: ![".py", ".js", ".ts", ".tsx", ".jsx", ".ps1", ".bat", ".cmd", ".sh"].includes(ext),
      source
    };
  } catch {
    return null;
  }
}
function collectSavedArtifactPaths(limit = RECENT_ARTIFACT_LIMIT) {
  const root = artifactRootDir();
  const out = [];
  if (!existsSync8(root)) return out;
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length > 0 && out.length < limit * 4) {
    const current = stack.shift();
    let entries = [];
    try {
      entries = readdirSync(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => b.name.localeCompare(a.name));
    for (const entry of entries) {
      const full = join4(current.dir, entry.name);
      if (entry.isDirectory() && current.depth < 2) {
        stack.push({ dir: full, depth: current.depth + 1 });
      } else if (entry.isFile()) {
        out.push(full);
        if (out.length >= limit * 4) break;
      }
    }
  }
  return out;
}
function collectRecentArtifacts(ctx, limit = RECENT_ARTIFACT_LIMIT) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (path, source) => {
    const info = recentArtifactInfo(path, source);
    if (!info) return;
    const key = recentArtifactKey(info.path);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(info);
  };
  for (const path of collectScheduleArtifactPaths(ctx)) push(path, "report");
  for (const path of Array.isArray(ctx.getGeneratedArtifactPaths?.()) ? ctx.getGeneratedArtifactPaths() : []) push(path, "generated");
  for (const path of openedDocumentPaths.values()) push(path, "opened");
  for (const path of collectSavedArtifactPaths(limit)) push(path, "saved");
  out.sort((a, b) => Number(b.mtimeMs || 0) - Number(a.mtimeMs || 0));
  return out.slice(0, limit);
}
async function pickMarkdownDocumentPath() {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  if (process.platform === "win32") {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '打开 Markdown 文档'
$dialog.Filter = 'Markdown 文档 (*.md;*.markdown)|*.md;*.markdown'
$dialog.Multiselect = $false
$dialog.CheckFileExists = $true
$dialog.CheckPathExists = $true
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.StartPosition = 'CenterScreen'
$owner.Width = 1
$owner.Height = 1
$owner.ShowInTaskbar = $false
$owner.Opacity = 0
$owner.Show()
$owner.Activate()
$result = $dialog.ShowDialog($owner)
$owner.Close()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.FileName
}
`;
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], { windowsHide: true });
    return String(stdout || "").trim();
  }
  const candidates = [
    ["zenity", ["--file-selection", "--title=打开 Markdown 文档", "--file-filter=Markdown 文档 | *.md *.markdown"]],
    ["kdialog", ["--getopenfilename", ".", "*.md *.markdown|Markdown 文档"]]
  ];
  for (const [program, args] of candidates) {
    try {
      const { stdout } = await execFileAsync(program, args);
      const selected = String(stdout || "").trim();
      if (selected) return selected;
      return "";
    } catch {
    }
  }
  throw new Error("no supported file picker found");
}
async function handleArtifacts(method, rest, body, ctx) {
  if (method !== "POST") {
    return { status: 405, body: { error: "POST only" } };
  }
  const action = rest[0] || "";
  const parsed = parseBody11(body);
  if (action === "recent") {
    const limit = Math.max(1, Math.min(200, Number.parseInt(String(parsed.limit ?? RECENT_ARTIFACT_LIMIT), 10) || RECENT_ARTIFACT_LIMIT));
    return { status: 200, body: { files: collectRecentArtifacts(ctx, limit) } };
  }
  if (action === "pick-markdown-file") {
    try {
      const selected = await pickMarkdownDocumentPath();
      if (!selected) return { status: 200, body: { path: "" } };
      const target = resolve2(selected);
      const ext = extname(target).toLowerCase();
      if (!OPENED_DOCUMENT_EXTS.has(ext)) {
        return { status: 400, body: { error: "only Markdown documents are supported" } };
      }
      if (!existsSync8(target)) return { status: 404, body: { error: "file does not exist" } };
      return { status: 200, body: { path: target } };
    } catch (err) {
      return { status: 500, body: { error: err.message || "file picker failed" } };
    }
  }
  if (action === "register-opened-document") {
    const target = resolveOpenedDocumentPath(parsed.path, parsed.cwd, ctx);
    if (!target) return { status: 400, body: { error: "path is required" } };
    const ext = extname(target).toLowerCase();
    if (!OPENED_DOCUMENT_EXTS.has(ext)) {
      return { status: 400, body: { error: "only Markdown documents are supported" } };
    }
    if (!existsSync8(target)) return { status: 404, body: { error: "file does not exist" } };
    let st;
    try {
      st = statSync(target);
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
    if (!st.isFile()) return { status: 400, body: { error: "not a file" } };
    if (st.size > OPENED_DOCUMENT_MAX_BYTES) {
      return { status: 413, body: { error: `file too large (${st.size} bytes, max ${OPENED_DOCUMENT_MAX_BYTES})` } };
    }
    rememberOpenedDocumentPath(target);
    return {
      status: 200,
      body: {
        path: target,
        dir: dirname3(target),
        filename: basename(target),
        ext,
        size: st.size,
        mtimeMs: st.mtimeMs,
        previewable: true,
        openable: true
      }
    };
  }
  if (action === "resolve") {
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const seen = /* @__PURE__ */ new Set();
    const files = [];
    for (const candidate of candidates.slice(0, 30)) {
      const target = resolveArtifactPath(candidate, ctx);
      if (!target || !isArtifactAllowedPath(target, ctx)) continue;
      const key = process.platform === "win32" ? target.toLowerCase() : target;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        if (!existsSync8(target)) continue;
        const st = statSync(target);
        if (!st.isFile()) continue;
        const ext = extname(target).toLowerCase();
        files.push({
          path: target,
          dir: dirname3(target),
          filename: basename(target),
          ext,
          size: st.size,
          mtimeMs: st.mtimeMs,
          previewable: ARTIFACT_PREVIEW_EXTS.has(ext) && st.size <= MAX_FILE_SIZE,
          openable: ![".py", ".js", ".ts", ".tsx", ".jsx", ".ps1", ".bat", ".cmd", ".sh"].includes(ext)
        });
      } catch {
      }
    }
    return { status: 200, body: { files } };
  }
  if (action === "preview") {
    const target = resolveArtifactPath(parsed.path, ctx);
    if (!target) return { status: 400, body: { error: "path is required" } };
    if (!isArtifactAllowedPath(target, ctx)) return { status: 403, body: { error: "path is not available" } };
    if (!existsSync8(target)) return { status: 404, body: { error: "file does not exist" } };
    let st;
    try {
      st = statSync(target);
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
    if (!st.isFile()) return { status: 400, body: { error: "not a file" } };
    const ext = extname(target).toLowerCase();
    if (!ARTIFACT_PREVIEW_EXTS.has(ext)) return { status: 400, body: { error: "preview is not supported for this file type" } };
    const maxPreviewBytes = isOpenedDocumentPath(target) ? OPENED_DOCUMENT_MAX_BYTES : MAX_FILE_SIZE;
    if (st.size > maxPreviewBytes) return { status: 413, body: { error: `file too large (${st.size} bytes, max ${maxPreviewBytes})` } };
    let readPath = target;
    try {
      if (ctx.resolveDlpReadablePath) {
        const readable = await ctx.resolveDlpReadablePath(target);
        if (readable?.path) readPath = readable.path;
      }
      const content = readFileSync5(readPath, "utf8");
      return { status: 200, body: { path: target, filename: basename(target), ext, content, size: st.size } };
    } catch (err) {
      return { status: 500, body: { error: err.message || "file preview failed" } };
    }
  }
  if (action === "save") {
    const content = String(parsed.content ?? "");
    if (!content) return { status: 400, body: { error: "content is required" } };
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > ARTIFACT_MAX_BYTES) {
      return { status: 413, body: { error: `artifact too large (${bytes} bytes, max ${ARTIFACT_MAX_BYTES})` } };
    }
    const date = new Date().toISOString().slice(0, 10);
    const dir = join4(artifactRootDir(), date);
    const filename = artifactSafeFilename(parsed.filename);
    try {
      mkdirSync8(dir, { recursive: true });
      const filePath = artifactUniquePath(dir, filename);
      writeFileSync8(filePath, content, "utf8");
      return { status: 200, body: { saved: true, path: filePath, dir, filename: basename(filePath) } };
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
  }
  if (action === "open-folder") {
    const raw = parsed.path || parsed.dir || "";
    if (!raw) return { status: 400, body: { error: "path is required" } };
    const target = resolveArtifactPath(raw, ctx);
    if (!isArtifactAllowedPath(target, ctx)) {
      return { status: 403, body: { error: "path is not available" } };
    }
    try {
      if (!existsSync8(target)) mkdirSync8(target, { recursive: true });
      await openArtifactLocation(target);
      return { status: 200, body: { opened: true, dir: target } };
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
  }
  if (action === "open-file") {
    const target = resolveArtifactPath(parsed.path, ctx);
    if (!target) return { status: 400, body: { error: "path is required" } };
    if (!isArtifactAllowedPath(target, ctx)) {
      return { status: 403, body: { error: "path is not available" } };
    }
    if (!existsSync8(target)) {
      return { status: 404, body: { error: "artifact file does not exist" } };
    }
    try {
      await openArtifactFile(target);
      return { status: 200, body: { opened: true, path: target } };
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
  }
  return { status: 404, body: { error: `no such artifact action: ${action}` } };
}
// src/server/api/clipboard-files.ts
var _psScriptPath = null;
function getPsScriptPath() {
  if (_psScriptPath) return _psScriptPath;
  _psScriptPath = join(dirname(fileURLToPath(import.meta.url)), 'read-clipboard.ps1');
  return _psScriptPath;
}

function isExistingClipboardPath(value) {
  if (typeof value !== "string") return false;
  const path = value.trim();
  if (!path) return false;
  try {
    return existsSync(path) && (statSync(path).isFile() || statSync(path).isDirectory());
  } catch {
    return false;
  }
}
function pathFromClipboardLine(line) {
  let raw = String(line || "").trim();
  if (!raw || raw.startsWith("#")) return "";
  raw = raw.replace(/^"(.+)"$/, "$1").trim();
  raw = raw.replace(/^\[(?:文件夹|folder|directory)\]\s*/i, "").trim();
  raw = raw.replace(/^\[(?:文件|file)\]\s*/i, "").trim();
  const labelMatch = raw.match(/^(?:路径|path)\s*[:：]\s*(.+)$/i);
  if (labelMatch) raw = labelMatch[1].trim();
  if (/^file:\/\//i.test(raw)) {
    try {
      return fileURLToPath(raw);
    } catch {
      try {
        return decodeURIComponent(raw.replace(/^file:\/\//i, ""));
      } catch {
        return raw;
      }
    }
  }
  return raw.replace(/^"(.+)"$/, "$1");
}
function uniqueClipboardPaths(paths) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const p of paths) {
    const path = pathFromClipboardLine(p);
    if (!isExistingClipboardPath(path)) continue;
    const key = process.platform === "win32" ? path.toLowerCase() : path;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(path);
  }
  return out;
}
function parseClipboardOutput(out) {
  const text = String(out || "").trim();
  if (!text) return [];
  try {
    const data = JSON.parse(text.split(/\r?\n/).filter(Boolean).pop() || "{}");
    const paths = [];
    if (Array.isArray(data.paths)) paths.push(...data.paths);
    if (Array.isArray(data.files)) {
      for (const f of data.files) {
        if (typeof f === "string") paths.push(f);
        else if (f?.full) paths.push(f.full);
      }
    }
    if (Array.isArray(data.folders)) paths.push(...data.folders);
    return uniqueClipboardPaths(paths);
  } catch {
    return uniqueClipboardPaths(text.split(/\r?\n/));
  }
}
function readWindowsClipboardPaths() {
  var ps1 = getPsScriptPath();
  if (!existsSync(ps1)) {
    console.error('[clipboard-files] read-clipboard.ps1 not found: ' + ps1);
    return { paths: [], error: 'read-clipboard.ps1 not found' };
  }

  var shells = [
    { cmd: 'powershell', args: '-ExecutionPolicy Bypass -Sta -NoProfile -NonInteractive' },
    { cmd: 'pwsh', args: '-ExecutionPolicy Bypass -NoProfile -NonInteractive' }
  ];
  var lastError = '';
  for (var i = 0; i < shells.length; i++) {
    try {
      var shell = shells[i];
      var out = execSync(
        shell.cmd + ' ' + shell.args + ' -File "' + ps1 + '"',
        { encoding: "utf8", timeout: 5000, windowsHide: true }
      );
      var paths = parseClipboardOutput(out);
      if (paths.length === 0) {
        lastError = shell.cmd + ' returned no output';
        continue;
      }
      console.error('[clipboard-files] ' + shell.cmd + ' returned ' + paths.length + ' path(s)');
      return { paths, sourceFormat: "windows-clipboard" };
    } catch (err) {
      lastError = err.message || String(err);
    }
  }
  console.error('[clipboard-files] failed: ' + lastError);
  return { paths: [], error: lastError };
}
function readLinuxClipboardPaths() {
  const commands = [
    'wl-paste --no-newline --type text/uri-list',
    'wl-paste --no-newline',
    'xclip -selection clipboard -t text/uri-list -o',
    'xclip -selection clipboard -o'
  ];
  const errors = [];
  for (const cmd of commands) {
    try {
      const out = execSync(cmd, { encoding: "utf8", timeout: 2000, windowsHide: true });
      const paths = parseClipboardOutput(out);
      if (paths.length > 0) {
        console.error('[clipboard-files] ' + cmd.split(/\s+/)[0] + ' returned ' + paths.length + ' path(s)');
        return { paths, sourceFormat: cmd.includes("uri-list") ? "linux-uri-list" : "linux-text" };
      }
    } catch (err) {
      errors.push(`${cmd}: ${err.message || String(err)}`);
    }
  }
  return { paths: [], error: errors.slice(-2).join("; ") || "no clipboard path found" };
}

function handleClipboardFiles(method, _rest, _body, _ctx) {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  if (process.platform === "win32") return { status: 200, body: readWindowsClipboardPaths() };
  if (process.platform === "linux") return { status: 200, body: readLinuxClipboardPaths() };
  return { status: 200, body: { paths: [], error: `clipboard file paths unsupported on ${process.platform}` } };
}

async function handleApi(pathTail, method, body, ctx, query = new URLSearchParams()) {
  const normalized = pathTail.replace(/\/+$/, "");
  const [head, ...rest] = normalized.split("/");
  try {
    switch (head) {
      case "overview":
        return await handleOverview(method, rest, body, ctx);
      case "backups":
        return await handleBackups(method, rest, body, ctx);
      case "usage":
        return await handleUsage(method, rest, body, ctx);
      case "tools":
        return await handleTools(method, rest, body, ctx);
      case "permissions":
        return await handlePermissions(method, rest, body, ctx);
      case "messages":
        return await handleMessages(method, rest, body, ctx, query);
      case "submit":
        return await handleSubmit(method, rest, body, ctx);
      case "prompt-queue":
        return await handlePromptQueue(method, rest, body, ctx, query);
      case "abort":
        return await handleAbort(method, rest, body, ctx);
      case "background-jobs":
        return await handleBackgroundJobs(method, rest, body, ctx);
      case "health":
        return await handleHealth(method, rest, body, ctx);
      case "logs":
        return await handleLogs(method, rest, body, ctx);
      case "sessions":
        return await handleSessions(method, rest, body, ctx, query);
      case "report":
        return await handleReport(method, rest, body, ctx, query);
      case "plans":
        return await handlePlans(method, rest, body, ctx);
      case "modal":
        return await handleModal(method, rest, body, ctx);
      case "edit-mode":
        return await handleEditMode(method, rest, body, ctx);
      case "providers":
        return await handleProviders(method, rest, body, ctx);
      case "settings":
        return await handleSettings(method, rest, body, ctx);
      case "hooks":
        return await handleHooks(method, rest, body, ctx);
      case "memory":
        return await handleMemory(method, rest, body, ctx);
      case "mode-memory":
        return await handleModeMemory(method, rest, body, ctx, query);
      case "skills":
        return await handleSkills(method, rest, body, ctx);
      case "mcp":
        return await handleMcp(method, rest, body, ctx, query);
      case "semantic":
        return await handleSemantic(method, rest, body, ctx);
      case "index-retrieval-mode":
        return handleIndexRetrievalMode(method, body, ctx);
      case "index-config":
        return await handleIndexConfig(method, rest, body, ctx);
      case "slash":
        return await handleSlash(method, rest, body, ctx);
      case "files":
        return await handleFiles(method, rest, body, ctx);
      case "project-tree":
        return await handleProjectTree(method, rest, body, ctx);
      case "git-diffs":
        return await handleGitDiffs(method, rest, body, ctx);
      case "checkpoints":
        return await handleCheckpoints(method, rest, body, ctx);
      case "checkpoint-diffs":
        return await handleCheckpointDiffs(method, rest, body, ctx, query);
      case "checkpoint-restore":
        return await handleCheckpointRestore(method, rest, body, ctx);
      case "checkpoint-create":
        return await handleCheckpointCreate(method, rest, body, ctx);
      case "checkpoint-delete":
        return await handleCheckpointDelete(method, rest, body, ctx);
      case "review-diffs":
        return await handleReviewDiffs(method, rest, body, ctx);
      case "file":
        return await handleFileRead(method, rest, body, ctx);
      case "loop":
        return await handleLoop(method, rest, body, ctx);
      case "schedules":
        return await handleSchedules(method, rest, body, ctx);
      case "models":
        return await handleModels(method, rest, body, ctx);
      case "open-url":
        return await handleOpenUrl(method, rest, body, ctx);
      case "artifacts":
        return await handleArtifacts(method, rest, body, ctx);
      case "clipboard-files":
        return await handleClipboardFiles(method, rest, body, ctx);
      default:
        return { status: 404, body: { error: `no such endpoint: /${head}` } };
    }
  } catch (err) {
    return {
      status: 500,
      body: { error: `handler crashed: ${err.message}` }
    };
  }
}

// src/server/index.ts
function mintToken() {
  return randomBytes(32).toString("hex");
}
function constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
function checkAuth(req, expectedToken, isMutation) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const queryToken = url.searchParams.get("token") ?? "";
  const headerToken = typeof req.headers["x-reasonix-token"] === "string" ? req.headers["x-reasonix-token"] : "";
  if (isMutation) {
    if (!headerToken || !constantTimeEquals(headerToken, expectedToken)) {
      return {
        status: 403,
        body: JSON.stringify({
          error: "mutation requires X-Reasonix-Token header (CSRF defence \u2014 query token alone is rejected for POST/DELETE)."
        })
      };
    }
    return null;
  }
  if (queryToken && constantTimeEquals(queryToken, expectedToken) || headerToken && constantTimeEquals(headerToken, expectedToken)) {
    return null;
  }
  return {
    status: 401,
    body: JSON.stringify({ error: "missing or invalid token" })
  };
}
var MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB (was 256KB) — for base64 image uploads
async function readBody(req) {
  let total = 0;
  const chunks = [];
  return new Promise((resolve3, reject) => {
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error(`body exceeds ${MAX_BODY_BYTES} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve3(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
async function dispatch(req, res, ctx, expectedToken) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = (req.method ?? "GET").toUpperCase();
  const isMutation = method === "POST" || method === "DELETE" || method === "PUT";
  if (path === "/" || path === "/index.html") {
    const fail = checkAuth(req, expectedToken, false);
    if (fail) {
      res.writeHead(fail.status, { "content-type": "text/plain" });
      res.end("unauthorized \u2014 open the URL printed by /dashboard, including ?token=\u2026");
      return;
    }
    const html = await renderIndexHtml(expectedToken, ctx.mode);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  if (path.startsWith("/assets/")) {
    const assetName = path.slice("/assets/".length);
    if (!assetName.endsWith(".png") && !KATEX_FONT_ASSET_RE.test(assetName)) {
      const fail = checkAuth(req, expectedToken, false);
      if (fail) {
        res.writeHead(fail.status);
        res.end();
        return;
      }
    }
    const asset = await serveAsset(assetName);
    if (!asset) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const etag = String(asset.mtimeMs);
    const headers = {
      "content-type": asset.contentType,
      "cache-control": "public, max-age=0, must-revalidate",
      "etag": etag
    };
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    res.end(asset.body);
    return;
  }
  if (path === "/api/events") {
    const fail = checkAuth(req, expectedToken, false);
    if (fail) {
      res.writeHead(fail.status, { "content-type": "application/json" });
      res.end(fail.body);
      return;
    }
    handleEvents(req, res, ctx, url.searchParams);
    return;
  }
  if (path.startsWith("/api/")) {
    const fail = checkAuth(req, expectedToken, isMutation);
    if (fail) {
      res.writeHead(fail.status, { "content-type": "application/json" });
      res.end(fail.body);
      return;
    }
    let body = "";
    if (isMutation) {
      try {
        body = await readBody(req);
      } catch (err) {
        res.writeHead(413, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
    const result = await handleApi(path.slice("/api/".length), method, body, ctx, url.searchParams);
    res.writeHead(result.status, { "content-type": "application/json" });
    res.end(JSON.stringify(result.body));
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
}
function startDashboardServer(ctx, opts = {}) {
  const token = opts.token ?? mintToken();
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 0;
  return new Promise((resolve3, reject) => {
    const server = createServer((req, res) => {
      dispatch(req, res, ctx, token).catch((err) => {
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "application/json" });
        }
        res.end(JSON.stringify({ error: err.message }));
      });
    });
    server.on("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const finalPort = addr.port;
      const url = `http://${host}:${finalPort}/?token=${token}`;
      let closed = false;
      const close = () => new Promise((doneResolve) => {
        if (closed) return doneResolve();
        closed = true;
        server.close(() => doneResolve());
        setTimeout(() => server.closeAllConnections?.(), 1e3).unref();
      });
      resolve3({ url, token, port: finalPort, close });
    });
  });
}
export {
  checkAuth,
  constantTimeEquals,
  dispatch,
  readBody,
  startDashboardServer
};
//# sourceMappingURL=server-XGDBRWMB.js.map
