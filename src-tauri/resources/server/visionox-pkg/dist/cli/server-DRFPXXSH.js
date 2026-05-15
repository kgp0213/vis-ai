#!/usr/bin/env node
import {
  registerSemanticSearchTool
} from "./chunk-RAUPWSYA.js";
import {
  readEventLogFile,
  recentEventFiles
} from "./chunk-FWGEHRB7.js";
import {
  SLASH_COMMANDS,
  createCheckpoint,
  deleteCheckpoint,
  fmtAgo,
  listCheckpoints,
  listPlanArchives,
  loadCheckpoint,
  restoreCheckpoint
} from "./chunk-A3LL4XDV.js";
import {
  fetchSmitheryDetail,
  handleToFetchResult,
  loadMorePages,
  openRegistry,
  specStringFor
} from "./chunk-SOZE7V7V.js";
import "./chunk-7VFNPMKG.js";
import {
  BUILTIN_ALLOWLIST,
  lineDiff
} from "./chunk-BYZGO3BX.js";
import {
  PROJECT_MEMORY_FILE,
  SKILLS_DIRNAME,
  SKILL_FILE,
  findProjectMemoryPath,
  parseFrontmatter,
  resolveProjectMemoryWritePath,
  validateSkillFrontmatter
} from "./chunk-CD4SCQL4.js";
import "./chunk-FM57FNPJ.js";
import {
  checkOllamaStatus,
  pullOllamaModel,
  startOllamaDaemon
} from "./chunk-2CXPDAWX.js";
import {
  INDEX_DIR_NAME,
  buildIndex,
  compareIndexIdentity,
  indexExists,
  querySemantic,
  readIndexMeta,
  walkChunks
} from "./chunk-4H3ZRJ2U.js";
import {
  HOOK_EVENTS,
  globalSettingsPath,
  loadHooks,
  projectSettingsPath
} from "./chunk-WE3YZULK.js";
import "./chunk-5X7LZJDE.js";
import {
  listSessions,
  sessionPath,
  sessionsDir
} from "./chunk-YJFKFTAL.js";
import {
  getLanguage,
  getSupportedLanguages,
  setLanguage
} from "./chunk-MHGPBJ2T.js";
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
} from "./chunk-65Q5HQ26.js";
import {
  aggregateUsage,
  bucketCacheHitRatio,
  formatLogSize,
  readUsageLog
} from "./chunk-ZTLZO42A.js";
import {
  DEEPSEEK_PRICING,
  cacheSavingsUsd
} from "./chunk-ORM6PK57.js";
import {
  VERSION
} from "./chunk-CRPQUBP6.js";

// src/server/index.ts
import { randomBytes } from "crypto";
import { createServer } from "http";

// src/server/api/events.ts
var PING_INTERVAL_MS = 25e3;
function handleEvents(req, res, ctx) {
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
  if (ctx.isBusy) writeEvent({ kind: "busy-change", busy: ctx.isBusy() });
  const unsubscribe = ctx.subscribeEvents(writeEvent);
  const ping = setInterval(() => writeEvent({ kind: "ping" }), PING_INTERVAL_MS);
  ping.unref?.();
  const cleanup = () => {
    clearInterval(ping);
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
import { closeSync, fstatSync, openSync, readFileSync, readSync } from "fs";
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
function loadCachedFile(path) {
  const fd = openSync(path, "r");
  try {
    const stat = fstatSync(fd);
    const cached = fileCache.get(path);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.body;
    const buf = Buffer.alloc(stat.size);
    let read = 0;
    while (read < stat.size) {
      const n = readSync(fd, buf, read, stat.size - read, read);
      if (n <= 0) break;
      read += n;
    }
    const body = buf.toString("utf8", 0, read);
    fileCache.set(path, { body, mtimeMs: stat.mtimeMs });
    return body;
  } finally {
    closeSync(fd);
  }
}
function loadIndexTemplate() {
  return loadCachedFile(join(ASSET_DIR, "index.html"));
}
function loadApp() {
  return loadCachedFile(join(ASSET_DIR, "dist", "app.js"));
}
function loadAppMap() {
  try {
    return loadCachedFile(join(ASSET_DIR, "dist", "app.js.map"));
  } catch {
    return null;
  }
}
function loadCss() {
  return loadCachedFile(join(ASSET_DIR, "app.css"));
}
function renderIndexHtml(token, mode) {
  const tpl = loadIndexTemplate();
  const safeToken = token.replace(/[^a-zA-Z0-9]/g, "");
  return tpl.replaceAll("__REASONIX_TOKEN__", safeToken).replaceAll("__REASONIX_MODE__", mode);
}
var VENDOR_CSS_NAMES = /* @__PURE__ */ new Set(["vendor-hljs.css", "vendor-uplot.css"]);
function loadVendorCss(name) {
  return loadCachedFile(join(ASSET_DIR, "dist", name));
}
function serveAsset(name) {
  if (name === "app.js") {
    return { body: loadApp(), contentType: "application/javascript; charset=utf-8" };
  }
  if (name === "app.js.map") {
    const body = loadAppMap();
    return body == null ? null : { body, contentType: "application/json; charset=utf-8" };
  }
  if (name === "app.css") {
    return { body: loadCss(), contentType: "text/css; charset=utf-8" };
  }
  if (VENDOR_CSS_NAMES.has(name)) {
    return { body: loadVendorCss(name), contentType: "text/css; charset=utf-8" };
  }
  if (name.endsWith(".png")) {
    try {
      const body = readFileSync(join(ASSET_DIR, "dist", name));
      return { body, contentType: "image/png" };
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
  ctx.abortTurn();
  ctx.audit?.({ ts: Date.now(), action: "abort-turn" });
  return { status: 202, body: { aborted: true } };
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
var VALID = /* @__PURE__ */ new Set(["review", "auto", "yolo"]);
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
      return { status: 400, body: { error: "mode must be review | auto | yolo" } };
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
  let fd;
  try {
    fd = openSync2(resolved, "r");
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
async function handleHealth(method, _rest, _body, ctx) {
  if (method !== "GET") {
    return { status: 405, body: { error: "GET only" } };
  }
  const home = homedir();
  const visionoxHome = join4(home, ".visionox");
  const sessionsStat = dirSize(join4(visionoxHome, "sessions"));
  const memoryStat = dirSize(join4(visionoxHome, "memory"));
  const semanticStat = dirSize(join4(visionoxHome, "semantic"));
  let usageBytes = 0;
  if (existsSync2(ctx.usageLogPath)) {
    try {
      usageBytes = statSync2(ctx.usageLogPath).size;
    } catch {
    }
  }
  const sessions = listSessions();
  return {
    status: 200,
    body: {
      version: VERSION,
      latestVersion: ctx.getLatestVersion?.() ?? null,
      visionoxHome,
      sessions: {
        path: sessionsStat.path,
        count: sessions.length,
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
      jobs: ctx.jobs ? ctx.jobs.list().length : null
    }
  };
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
    return { status: 200, body: { status: ctx.getLoopRunStatus() } };
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
    return { status: 200, body: { started: true } };
  }
  if (method === "POST" && rest[0] === "stop") {
    if (!ctx.stopAutoLoop) {
      return { status: 503, body: { error: "auto-loop stop not wired" } };
    }
    ctx.stopAutoLoop();
    ctx.audit?.({ ts: Date.now(), action: "auto-loop-stop" });
    return { status: 200, body: { stopped: true } };
  }
  return {
    status: 405,
    body: { error: `method ${method} not supported on /api/loop/${rest[0] ?? ""}` }
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
  statSync as statSync3,
  unlinkSync,
  writeFileSync as writeFileSync2
} from "fs";
import { homedir as homedir2 } from "os";
import { basename, dirname as dirname3, join as join5, resolve as resolvePath } from "path";
function projectHash(rootDir) {
  return createHash("sha1").update(resolvePath(rootDir)).digest("hex").slice(0, 16);
}
function globalMemoryDir() {
  return join5(homedir2(), ".visionox", "memory", "global");
}
function projectMemoryDir(rootDir) {
  return join5(homedir2(), ".visionox", "memory", projectHash(rootDir));
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
function listMemoryFiles(dir) {
  if (!existsSync5(dir)) return [];
  try {
    return readdirSync3(dir).filter((f) => f.endsWith(".md")).map((f) => {
      const stat = statSync3(join5(dir, f));
      return {
        name: f.replace(/\.md$/, ""),
        size: stat.size,
        mtime: stat.mtime.getTime()
      };
    }).sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}
async function handleMemory(method, rest, body, ctx) {
  const cwd = ctx.getCurrentCwd?.();
  const globalDir = globalMemoryDir();
  const projectMemDir = cwd ? projectMemoryDir(cwd) : "";
  if (method === "GET" && rest.length === 0) {
    const existingProjectMemory = cwd ? findProjectMemoryPath(cwd) : null;
    const projectMemoryPath = existingProjectMemory ?? (cwd ? join5(cwd, PROJECT_MEMORY_FILE) : null);
    const projectMemoryExists = existingProjectMemory !== null;
    return {
      status: 200,
      body: {
        project: {
          path: projectMemoryPath,
          exists: projectMemoryExists,
          file: projectMemoryPath ? basename(projectMemoryPath) : PROJECT_MEMORY_FILE
        },
        global: {
          path: globalDir,
          files: listMemoryFiles(globalDir)
        },
        projectMem: {
          path: projectMemDir,
          files: projectMemDir ? listMemoryFiles(projectMemDir) : []
        }
      }
    };
  }
  const [scope, ...nameParts] = rest;
  const name = nameParts.join("/");
  if (method === "GET") {
    if (scope === "project") {
      if (!cwd) return { status: 503, body: { error: "no active project" } };
      const path = findProjectMemoryPath(cwd);
      if (!path) return { status: 404, body: { error: "project memory file not found" } };
      return { status: 200, body: { path, body: readFileSync4(path, "utf8") } };
    }
    if ((scope === "global" || scope === "project-mem") && name && SAFE_NAME.test(name)) {
      const dir = scope === "global" ? globalDir : projectMemDir;
      if (!dir) return { status: 503, body: { error: "no project root for project-mem" } };
      const path = join5(dir, `${name}.md`);
      if (!existsSync5(path)) return { status: 404, body: { error: "not found" } };
      return { status: 200, body: { path, body: readFileSync4(path, "utf8") } };
    }
    return { status: 400, body: { error: "bad scope or name" } };
  }
  if (method === "POST") {
    const { body: contents } = parseBody6(body);
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
      const dir = scope === "global" ? globalDir : projectMemDir;
      if (!dir) return { status: 503, body: { error: "no project root for project-mem" } };
      mkdirSync2(dir, { recursive: true });
      const path = join5(dir, `${name}.md`);
      writeFileSync2(path, contents, "utf8");
      ctx.audit?.({ ts: Date.now(), action: "save-memory", payload: { scope, name, path } });
      return { status: 200, body: { saved: true, path } };
    }
    return { status: 400, body: { error: "bad scope or name" } };
  }
  if (method === "DELETE") {
    if ((scope === "global" || scope === "project-mem") && name && SAFE_NAME.test(name)) {
      const dir = scope === "global" ? globalDir : projectMemDir;
      if (!dir) return { status: 503, body: { error: "no project root for project-mem" } };
      const path = join5(dir, `${name}.md`);
      if (existsSync5(path)) {
        unlinkSync(path);
        ctx.audit?.({ ts: Date.now(), action: "delete-memory", payload: { scope, name, path } });
        return { status: 200, body: { deleted: true } };
      }
      return { status: 404, body: { error: "not found" } };
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

// src/server/api/messages.ts
async function handleMessages(method, _rest, _body, ctx) {
  if (method !== "GET") {
    return { status: 405, body: { error: "GET only" } };
  }
  const messages = ctx.getMessages ? ctx.getMessages() : [];
  return {
    status: 200,
    body: {
      messages,
      busy: ctx.isBusy ? ctx.isBusy() : false
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
    const { kind, choice, text } = parsed;
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
      ctx.resolveShellConfirm(choice);
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
        ctx.resolveChoiceConfirm({ kind: "pick", optionId: c.optionId });
        return { status: 200, body: { resolved: true } };
      }
      if (c.kind === "custom" && typeof c.text === "string") {
        ctx.resolveChoiceConfirm({ kind: "custom", text: c.text });
        return { status: 200, body: { resolved: true } };
      }
      if (c.kind === "cancel") {
        ctx.resolveChoiceConfirm({ kind: "cancel" });
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
      ctx.resolvePlanConfirm(choice, typeof text === "string" && text.trim() ? text : void 0);
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
      ctx.resolveCheckpointConfirm(
        choice,
        typeof text === "string" && text.trim() ? text : void 0
      );
      return { status: 200, body: { resolved: true } };
    }
    if (kind === "revision") {
      if (!ctx.resolveReviseConfirm) {
        return { status: 503, body: { error: "revision modal resolution not wired" } };
      }
      if (choice !== "accept" && choice !== "reject") {
        return { status: 400, body: { error: "revision choice must be accept / reject" } };
      }
      ctx.resolveReviseConfirm(choice);
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
  return {
    status: 200,
    body: {
      models,
      current: ctx.loop?.model ?? null,
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
var TOOL_FEED_CAP = 6;
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
var TTL_MS = 3e4;
var cache = /* @__PURE__ */ new Map();
function computeCockpit(ctx, now = Date.now()) {
  return {
    balance: extractBalance(ctx.getStats?.() ?? null),
    currentSession: extractCurrentSession(ctx),
    ...readWarmCached(ctx.usageLogPath, now, ctx.sessionsDir)
  };
}
function extractBalance(stats) {
  const first = stats?.balance?.[0];
  if (!first) return null;
  return { currency: first.currency, total: first.total_balance };
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
  const cwd = ctx.getCurrentCwd?.() ?? null;
  const isDesktop = ctx.mode === "desktop";
  const semanticIndexExists = isDesktop ? null : (cwd ? await indexExists(cwd).catch(() => false) : null);
  const overview = {
    version: VERSION,
    mode: ctx.mode,
    latestVersion: ctx.getLatestVersion?.() ?? null,
    session: ctx.getSessionName?.() ?? null,
    cwd,
    model: ctx.loop?.model ?? null,
    editMode: ctx.getEditMode?.() ?? null,
    planMode: ctx.getPlanMode?.() ?? null,
    pendingEdits: ctx.getPendingEditCount?.() ?? null,
    mcpServerCount: ctx.mcpServers?.length ?? null,
    hasApiKey: ctx.hasApiKey ?? null,
    toolCount: ctx.tools ? ctx.tools.size : null,
    preset: cfg.preset ?? "auto",
    reasoningEffort: cfg.reasoningEffort ?? "max",
    budgetUsd: ctx.loop?.budgetUsd ?? null,
    stats: ctx.getStats?.() ?? null,
    semanticIndexExists,
    cockpit: computeCockpit(ctx)
  };
  return { status: 200, body: overview };
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
async function handlePlans(method, _rest, _body, _ctx) {
  if (method !== "GET") {
    return { status: 405, body: { error: "GET only" } };
  }
  const out = [];
  for (const session of listSessions()) {
    const archives = listPlanArchives(session.name);
    for (const a of archives) {
      const total = a.steps.length;
      const done = a.completedStepIds.length;
      const row = {
        session: session.name,
        path: a.path,
        completedAt: a.completedAt,
        totalSteps: total,
        completedSteps: done,
        completionRatio: total > 0 ? done / total : 0,
        steps: a.steps,
        completedStepIds: a.completedStepIds
      };
      if (a.summary) row.summary = a.summary;
      out.push(row);
    }
  }
  out.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
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
  if (sub === "validate-provider" && method === "POST") return await validateProviderApi(body, ctx);
  if (sub === "search" && method === "POST") return await runSearch(body, ctx);
  return { status: 404, body: { error: "no such semantic endpoint" } };
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
    const hits = await querySemantic(root, query, {
      topK,
      minScore,
      configPath: ctx.configPath
    });
    if (hits === null) {
      return { status: 404, body: { error: "no semantic index for this project" } };
    }
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
  const dir = join7(root, INDEX_DIR_NAME);
  const dataPath = join7(dir, "index.jsonl");
  const diskMeta = await readIndexMeta(dir);
  if (!diskMeta) return { exists: false };
  let chunks = 0;
  const files = /* @__PURE__ */ new Set();
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
        if (typeof rec.p === "string") files.add(rec.p);
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
    const result = await buildIndex(root, {
      rebuild: job.rebuild,
      configPath: ctx.configPath,
      signal: job.controller.signal,
      indexConfig: loadIndexConfig(ctx.configPath),
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
    job.phase = "done";
    job.finishedAt = Date.now();
    job.result = result;
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
  if (!job || job.phase === "done" || job.phase === "error" || job.phase === "cancelled") {
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

function normalizeEmbeddingUrl(url) {
  if (!url || typeof url !== "string") return url;
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/embeddings")) return trimmed;
  return trimmed + "/embeddings";
}
async function validateProviderApi(rawBody, ctx) {
  let parsed;
  try { parsed = JSON.parse(rawBody || "{}"); } catch {
    return { status: 400, body: { error: "body must be JSON" } };
  }
  const prev = loadSemanticEmbeddingUserConfig(ctx.configPath);
  try {
    const next = {
      provider: parsed.provider === "openai-compat" ? "openai-compat" : "ollama",
      ollama: { baseUrl: typeof parsed.ollama?.baseUrl === "string" ? parsed.ollama.baseUrl : prev.ollama?.baseUrl, model: typeof parsed.ollama?.model === "string" ? parsed.ollama.model : prev.ollama?.model },
      openaiCompat: { baseUrl: typeof parsed.openaiCompat?.baseUrl === "string" ? normalizeEmbeddingUrl(parsed.openaiCompat.baseUrl) : prev.openaiCompat?.baseUrl, apiKey: typeof parsed.openaiCompat?.apiKey === "string" ? parsed.openaiCompat.apiKey.trim() || prev.openaiCompat?.apiKey : prev.openaiCompat?.apiKey, model: typeof parsed.openaiCompat?.model === "string" ? parsed.openaiCompat.model : prev.openaiCompat?.model, extraBody: parsed.openaiCompat?.extraBody === void 0 ? prev.openaiCompat?.extraBody : parsed.openaiCompat.extraBody }
    };
    saveSemanticEmbeddingConfig(next, ctx.configPath);
    const config = resolveSemanticEmbeddingConfig(ctx.configPath);
    const startedAt = Date.now();
    if (config.provider === "ollama") {
      const status = await checkOllamaStatus(config.model, config.baseUrl);
      const latencyMs = Date.now() - startedAt;
      if (!status.binaryFound) return { status: 200, body: { ok: false, error: "Ollama binary not found.", provider: "ollama", model: config.model } };
      if (!status.daemonRunning) return { status: 200, body: { ok: false, error: "Ollama daemon not running.", provider: "ollama", model: config.model } };
      if (!status.modelPulled) return { status: 200, body: { ok: false, error: "Model not pulled.", provider: "ollama", model: config.model } };
      return { status: 200, body: { ok: true, provider: "ollama", model: config.model, dim: null, latencyMs } };
    }
    const body2 = JSON.stringify({ model: config.model, input: "test", ...(config.extraBody || {}) });
    const url = config.baseUrl.replace(/\/+$/, "");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(config.apiKey ? { Authorization: "Bearer " + config.apiKey } : {}) }, body: body2, signal: AbortSignal.timeout(config.timeoutMs || 30000) });
    const latencyMs = Date.now() - startedAt;
    if (!res.ok) { let detail = res.status + " " + res.statusText; try { const t = await res.text(); detail += " — " + t.slice(0, 200); } catch {} return { status: 200, body: { ok: false, error: "API returned " + detail, provider: "openai-compat", model: config.model } }; }
    const json = await res.json();
    if (!json || !Array.isArray(json.data) || !json.data[0] || !Array.isArray(json.data[0].embedding)) return { status: 200, body: { ok: false, error: "Model returned text, not embeddings.", provider: "openai-compat", model: config.model } };
    const dim = json.data[0].embedding.length;
    return { status: 200, body: { ok: true, provider: "openai-compat", model: config.model, dim, latencyMs } };
  } catch (err) { return { status: 200, body: { ok: false, error: err.message } }; }
  finally { saveSemanticEmbeddingConfig(prev, ctx.configPath); }
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
      baseUrl: typeof parsed.openaiCompat?.baseUrl === "string" ? normalizeEmbeddingUrl(parsed.openaiCompat.baseUrl) : existing.openaiCompat?.baseUrl,
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
import { existsSync as existsSync8, readFileSync as readFileSync5 } from "fs";
function parseTranscript(path, maxBytes = 4 * 1024 * 1024) {
  let raw;
  try {
    raw = readFileSync5(path, "utf8");
  } catch {
    return [];
  }
  if (raw.length > maxBytes) raw = raw.slice(0, maxBytes);
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      const role = typeof rec.role === "string" ? rec.role : "unknown";
      const msg = { role };
      if (typeof rec.content === "string") msg.content = rec.content;
      else if (rec.content !== void 0) msg.content = JSON.stringify(rec.content);
      if (typeof rec.tool_name === "string") msg.toolName = rec.tool_name;
      if (typeof rec.toolName === "string") msg.toolName = rec.toolName;
      out.push(msg);
    } catch {
    }
  }
  return out;
}
async function handleSessions(method, rest, _body, _ctx) {
  if (rest.length === 0) {
    if (method === "GET") {
      const sessions = listSessions();
      return {
        status: 200,
        body: {
          sessions: sessions.map((s) => ({
            name: s.name,
            path: s.path,
            size: s.size,
            messageCount: s.messageCount,
            mtime: s.mtime.getTime()
          }))
        }
      };
    }
    return { status: 405, body: { error: "GET only for list" } };
  }
  const name = decodeURIComponent(rest[0]);
  const path = sessionPath(name);
  if (method === "DELETE") {
    try {
      unlinkSync(path);
      const metaPath = path.replace(/\.jsonl$/, ".meta.json");
      try { unlinkSync(metaPath); } catch {}
      return { status: 200, body: { deleted: true, name } };
    } catch {
      return { status: 404, body: { error: `no such session: ${name}` } };
    }
  }
  if (method !== "GET") {
    return { status: 405, body: { error: "GET or DELETE only" } };
  }
  if (!existsSync8(path)) {
    return { status: 404, body: { error: `no such session: ${name}` } };
  }
  const messages = parseTranscript(path);
  return {
    status: 200,
    body: {
      name,
      path,
      messages,
      messageCount: messages.length
    }
  };
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
async function handleSettings(method, _rest, body, ctx) {
  if (method === "GET") {
    const cfg = readConfig(ctx.configPath);
    if (cfg.search === void 0) {
      cfg.search = true;
      writeConfig(cfg, ctx.configPath);
    }
    const live = ctx.loop;
    return {
      status: 200,
      body: {
        apiKey: cfg.apiKey ? redactKey(cfg.apiKey) : null,
        apiKeySet: Boolean(cfg.apiKey),
        baseUrl: cfg.baseUrl ?? null,
        lang: getLanguage(),
        preset: cfg.preset ?? "auto",
        reasoningEffort: cfg.reasoningEffort ?? "max",
        search: cfg.search !== false,
        editMode: cfg.editMode ?? "review",
        session: cfg.session ?? null,
        model: live?.model ?? null,
        proNext: live?.proArmed ?? false,
        budgetUsd: live?.budgetUsd ?? null,
        sessionSpendUsd: ctx.getStats?.()?.totalCostUsd ?? null,
        workspaceDir: cfg.workspaceDir ?? null,
        // Hint to the SPA which fields require restart.
        appliesAt: {
          workspaceDir: "next-session",
          apiKey: "next-session",
          baseUrl: "next-session",
          preset: "next-session",
          reasoningEffort: "next-turn",
          search: "next-session",
          model: "next-turn",
          proNext: "next-turn",
          budgetUsd: "live"
        }
      }
    };
  }
  if (method === "POST") {
    const fields = parseBody9(body);
    const cfg = readConfig(ctx.configPath);
    const changed = [];
    let langPending = null;
    let presetPendingLive = null;
    let effortPendingLive = null;
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
      cfg.apiKey = fields.apiKey.trim();
      changed.push("apiKey");
    }
    if (fields.baseUrl !== void 0) {
      if (typeof fields.baseUrl !== "string" || !fields.baseUrl.trim()) {
        return { status: 400, body: { error: "baseUrl must be a non-empty string" } };
      }
      cfg.baseUrl = fields.baseUrl.trim();
      changed.push("baseUrl");
    }
    if (fields.preset !== void 0) {
      if (typeof fields.preset !== "string" || !VALID_PRESETS.has(fields.preset)) {
        return { status: 400, body: { error: "preset must be auto | flash | pro" } };
      }
      cfg.preset = fields.preset;
      presetPendingLive = fields.preset;
      changed.push("preset");
    }
    if (fields.reasoningEffort !== void 0) {
      if (typeof fields.reasoningEffort !== "string" || !VALID_EFFORTS.has(fields.reasoningEffort)) {
        return { status: 400, body: { error: "reasoningEffort must be high | max" } };
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
    let modelPendingLive = null;
    let proNextPending = null;
    let budgetPending;
    if (fields.model !== void 0) {
      if (typeof fields.model !== "string" || !fields.model.trim()) {
        return { status: 400, body: { error: "model must be a non-empty string" } };
      }
      modelPendingLive = fields.model.trim();
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
      ctx.setWorkspaceDir?.(fields.workspaceDir.trim());
      changed.push("workspaceDir");
    }
    if (changed.length > 0) {
      writeConfig(cfg, ctx.configPath);
      if (langPending) setLanguage(langPending);
      if (presetPendingLive) ctx.applyPresetLive?.(presetPendingLive);
      if (effortPendingLive) ctx.applyEffortLive?.(effortPendingLive);
      if (modelPendingLive) ctx.applyModelLive?.(modelPendingLive);
      if (proNextPending !== null) ctx.setProNextLive?.(proNextPending);
      if (budgetPending !== void 0) ctx.setBudgetUsdLive?.(budgetPending);
      ctx.audit?.({ ts: Date.now(), action: "set-settings", payload: { fields: changed } });
    }
    return { status: 200, body: { changed } };
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
var SAFE_NAME2 = /^[a-zA-Z0-9一-鿿][a-zA-Z0-9一-鿿 ._()（）-]{0,63}$/;
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
  const cwd = ctx.getCurrentCwd?.();
  if (method === "GET" && rest.length === 0) {
    const runs7d = countSubagentRuns(ctx.usageLogPath);
    const tag = (rows) => rows.map((r) => ({ ...r, runs7d: runs7d.get(r.name) ?? 0 }));
    return {
      status: 200,
      body: {
        global: tag(listSkills(globalSkillsDir(), "global")),
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
          global: globalSkillsDir(),
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
    dir = globalSkillsDir();
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
    rmSync(resolved.layout === "folder" ? dirname4(resolved.path) : resolved.path, {
      recursive: true,
      force: true
    });
    ctx.audit?.({ ts: Date.now(), action: "delete-skill", payload: { scope, name } });
    return { status: 200, body: { deleted: true } };
  }
  return { status: 405, body: { error: `method ${method} not supported` } };
}

// src/server/api/slash.ts
async function handleSlash(method, _rest, _body, ctx) {
  if (method !== "GET") return { status: 405, body: { error: "GET only" } };
  const codeMode = ctx.getCurrentCwd?.() != null;
  const commands = SLASH_COMMANDS.filter((c) => c.contextual !== "code" || codeMode).map((c) => ({
    cmd: c.cmd,
    summary: c.summary,
    argsHint: c.argsHint,
    contextual: c.contextual,
    aliases: c.aliases
  }));
  return { status: 200, body: { commands, codeMode } };
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
        error: "submit requires an attached dashboard session \u2014 open `/dashboard` from inside `visionox code` or `reasonix chat`."
      }
    };
  }
  const { prompt } = parseBody11(body);
  if (typeof prompt !== "string" || !prompt.trim()) {
    return { status: 400, body: { error: "prompt (non-empty string) required" } };
  }
  const result = ctx.submitPrompt(prompt);
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
  return { status: 202, body: { accepted: true } };
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
async function handleApi(pathTail, method, body, ctx, query = new URLSearchParams()) {
  const normalized = pathTail.replace(/\/+$/, "");
  const [head, ...rest] = normalized.split("/");
  try {
    switch (head) {
      case "overview":
        return await handleOverview(method, rest, body, ctx);
      case "usage":
        return await handleUsage(method, rest, body, ctx);
      case "tools":
        return await handleTools(method, rest, body, ctx);
      case "permissions":
        return await handlePermissions(method, rest, body, ctx);
      case "messages":
        return await handleMessages(method, rest, body, ctx);
      case "submit":
        return await handleSubmit(method, rest, body, ctx);
      case "abort":
        return await handleAbort(method, rest, body, ctx);
      case "health":
        return await handleHealth(method, rest, body, ctx);
      case "sessions":
        return await handleSessions(method, rest, body, ctx);
      case "plans":
        return await handlePlans(method, rest, body, ctx);
      case "modal":
        return await handleModal(method, rest, body, ctx);
      case "edit-mode":
        return await handleEditMode(method, rest, body, ctx);
      case "settings":
        return await handleSettings(method, rest, body, ctx);
      case "hooks":
        return await handleHooks(method, rest, body, ctx);
      case "memory":
        return await handleMemory(method, rest, body, ctx);
      case "skills":
        return await handleSkills(method, rest, body, ctx);
      case "mcp":
        return await handleMcp(method, rest, body, ctx, query);
      case "semantic":
        return await handleSemantic(method, rest, body, ctx);
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
      case "logs":
        if (method !== "GET") return { status: 405, body: { error: "GET only" } };
        return { status: 200, body: { logs: ctx.getLogs?.() ?? [] } };
      case "models":
        return await handleModels(method, rest, body, ctx);
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
var MAX_BODY_BYTES = 256 * 1024;
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
    const html = renderIndexHtml(expectedToken, ctx.mode);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  if (path.startsWith("/assets/")) {
    const assetName = path.slice("/assets/".length);
    if (!assetName.endsWith(".png")) {
      const fail = checkAuth(req, expectedToken, false);
      if (fail) {
        res.writeHead(fail.status);
        res.end();
        return;
      }
    }
    const asset = serveAsset(assetName);
    if (!asset) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": asset.contentType });
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
    handleEvents(req, res, ctx);
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
//# sourceMappingURL=server-DRFPXXSH.js.map