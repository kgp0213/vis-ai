import { existsSync, readdirSync, statSync } from "node:fs";
import { access, open, readFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const DLP_MAGIC = Buffer.from([0, 0, 0, 0]);
const DEFAULT_TIMEOUT_MS = 60_000;

const DEFAULT_SKIP_EXTENSIONS = new Set([
  ".c", ".cc", ".cpp", ".cxx", ".h", ".hh", ".hpp",
  ".py", ".pyw", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".rs", ".go", ".java", ".kt", ".kts", ".cs", ".php", ".rb",
  ".ini", ".cfg", ".conf", ".toml", ".yaml", ".yml", ".json",
  ".net", ".sp", ".spice", ".v", ".sv", ".vh", ".svh",
]);

const OFFICE_READABLE_EXTENSIONS = [
  ".doc", ".docx", ".docm",
  ".xls", ".xlsx", ".xlsm",
  ".ppt", ".pptx", ".pptm",
  ".pdf",
];

const DOCUMENT_PATH_EXTENSIONS = [
  ...OFFICE_READABLE_EXTENSIONS,
  ".txt", ".md", ".markdown", ".csv", ".tsv",
  ".xml", ".dsn", ".json", ".jsonl", ".yaml", ".yml",
  ".html", ".htm", ".rtf",
  ".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".tif", ".tiff",
  ".log", ".dat", ".ini", ".cfg", ".conf",
];

const decryptCache = new Map();
const DOCUMENT_REF_PREFIX = "visionox-document:";
const DEFAULT_PREPARED_DOCUMENT_LIMIT = 100;
const SCRIPT_EXTENSIONS = new Set([".py", ".pyw", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".ps1", ".bat", ".cmd", ".sh"]);

function preparedDocumentPathUsage() {
  return {
    documentRefField: "documentRef",
    readablePathEnv: "VISIONOX_DOCUMENT_READABLE_PATH",
    readableRootEnv: "VISIONOX_DOCUMENT_ROOT",
  };
}

function preparedPathKey(value) {
  try {
    const key = resolve(String(value ?? ""));
    return process.platform === "win32" ? key.toLowerCase() : key;
  } catch {
    return null;
  }
}

function preparedDocumentId(sourcePath) {
  return `doc_${createHash("sha256").update(preparedPathKey(sourcePath) ?? String(sourcePath)).digest("hex").slice(0, 20)}`;
}

function publicPreparedDocument(entry) {
  return {
    documentId: entry.documentId,
    documentRef: `${DOCUMENT_REF_PREFIX}${entry.documentId}`,
    sourcePath: entry.sourcePath,
    readablePath: entry.readablePath,
    readableDirectory: dirname(entry.readablePath),
    documentKind: entry.documentKind,
    encrypted: entry.encrypted,
    sourceSize: entry.sourceSize,
    sourceMtimeMs: entry.sourceMtimeMs,
    sourceRevision: entry.sourceRevision,
    lastUsedAt: entry.lastUsedAt,
    updatedAt: entry.updatedAt,
  };
}

export function createPreparedDocumentRegistry({ maxEntries = DEFAULT_PREPARED_DOCUMENT_LIMIT, onChange = () => {} } = {}) {
  const limit = Math.max(1, Math.min(500, Number(maxEntries) || DEFAULT_PREPARED_DOCUMENT_LIMIT));
  const byId = new Map();
  const byPath = new Map();

  function notify() {
    onChange(snapshot());
  }

  function removeEntry(entry) {
    byId.delete(entry.documentId);
    for (const [key, id] of byPath) {
      if (id === entry.documentId) byPath.delete(key);
    }
  }

  function register(value, { notifyChange = true } = {}) {
    if (!value?.sourcePath) throw new TypeError("prepared document sourcePath is required");
    const sourcePath = resolve(String(value.sourcePath));
    const sourceKey = preparedPathKey(sourcePath);
    const existingId = byPath.get(sourceKey);
    const requestedId = /^doc_[a-f0-9]{20}$/.test(String(value.documentId ?? "")) ? String(value.documentId) : null;
    const documentId = requestedId ?? existingId ?? preparedDocumentId(sourcePath);
    const previous = byId.get(documentId);
    if (previous) removeEntry(previous);
    const readablePath = resolve(String(value.readablePath || sourcePath));
    const stat = safeStat(sourcePath);
    const entry = {
      documentId,
      sourcePath,
      readablePath,
      documentKind: value.documentKind || publicDocumentKind(sourcePath),
      encrypted: value.encrypted === true,
      sourceSize: stat?.size ?? (Number.isFinite(value.sourceSize) ? Number(value.sourceSize) : null),
      sourceMtimeMs: stat?.mtimeMs ?? (Number.isFinite(value.sourceMtimeMs) ? Number(value.sourceMtimeMs) : null),
      sourceRevision: sourceRevision(sourcePath, stat, value.sourceRevision),
      lastUsedAt: typeof value.lastUsedAt === "string" && value.lastUsedAt.trim()
        ? value.lastUsedAt
        : previous?.lastUsedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    byId.set(documentId, entry);
    byPath.set(sourceKey, documentId);
    byPath.set(preparedPathKey(readablePath), documentId);
    while (byId.size > limit) removeEntry(byId.values().next().value);
    if (notifyChange) notify();
    return publicPreparedDocument(entry);
  }

  function find(value) {
    const raw = typeof value === "object" && value
      ? String(value.documentRef ?? value.documentId ?? value.path ?? "").trim()
      : String(value ?? "").trim();
    if (!raw) return null;
    const unquoted = raw.replace(/^["']|["']$/g, "");
    const id = unquoted.startsWith(DOCUMENT_REF_PREFIX) ? unquoted.slice(DOCUMENT_REF_PREFIX.length) : unquoted;
    const byDocumentId = byId.get(id);
    if (byDocumentId) return publicPreparedDocument(byDocumentId);
    const pathId = byPath.get(preparedPathKey(unquoted));
    return pathId && byId.has(pathId) ? publicPreparedDocument(byId.get(pathId)) : null;
  }

  function snapshot() {
    return [...byId.values()].map(publicPreparedDocument);
  }

  function latest(value = null) {
    const matched = value == null ? null : find(value);
    if (matched) return matched;
    const entries = snapshot();
    return entries.length > 0 ? entries.at(-1) : null;
  }

  function touch(value, { notifyChange = true, minIntervalMs = 15_000 } = {}) {
    const raw = typeof value === "object" && value
      ? String(value.documentRef ?? value.documentId ?? value.path ?? "").trim()
      : String(value ?? "").trim();
    const unquoted = raw.replace(/^['"]|['"]$/g, "");
    const id = unquoted.startsWith(DOCUMENT_REF_PREFIX) ? unquoted.slice(DOCUMENT_REF_PREFIX.length) : unquoted;
    const entry = byId.get(id) ?? byId.get(byPath.get(preparedPathKey(unquoted)));
    if (!entry) return null;
    const now = Date.now();
    const previousMs = Date.parse(entry.lastUsedAt || "");
    if (Number.isFinite(previousMs) && now - previousMs < Math.max(0, Number(minIntervalMs) || 0)) {
      return publicPreparedDocument(entry);
    }
    entry.lastUsedAt = new Date(now).toISOString();
    if (notifyChange) notify();
    return publicPreparedDocument(entry);
  }

  function restore(entries, { replace = true, notifyChange = false } = {}) {
    if (replace) {
      byId.clear();
      byPath.clear();
    }
    for (const entry of Array.isArray(entries) ? entries.slice(-limit) : []) {
      try {
        register(entry, { notifyChange: false });
      } catch {
        // Ignore malformed or stale metadata; source access will be requested again if needed.
      }
    }
    if (notifyChange) notify();
    return snapshot();
  }

  function clear({ notifyChange = true } = {}) {
    byId.clear();
    byPath.clear();
    if (notifyChange) notify();
  }

  return { register, find, latest, touch, snapshot, restore, clear };
}

function collectPreparedDocumentInputStrings(value, output = [], seen = new Set()) {
  if (typeof value === "string") {
    if (value.trim()) output.push(value.trim());
    return output;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return output;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectPreparedDocumentInputStrings(item, output, seen);
    return output;
  }
  if (typeof value.documentRef === "string" && value.documentRef.trim()) {
    output.unshift(value.documentRef.trim());
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === "documentRef") continue;
    collectPreparedDocumentInputStrings(item, output, seen);
  }
  return output;
}

function splitShellCommandSegments(command) {
  const segments = [];
  let current = "";
  let quote = null;
  const push = () => {
    if (current.trim()) segments.push(current.trim());
    current = "";
  };
  const text = String(command ?? "");
  for (let index = 0; index < text.length; index++) {
    const ch = text[index];
    if (ch === "\\" && quote && index + 1 < text.length) {
      current += ch + text[++index];
      continue;
    }
    if ((ch === '"' || ch === "'") && !quote) quote = ch;
    else if (ch === quote) quote = null;
    if (!quote && (ch === ";" || ch === "\n" || ch === "\r" || ch === "&" || ch === "|")) {
      push();
      if ((ch === "&" || ch === "|") && text[index + 1] === ch) index++;
      continue;
    }
    current += ch;
  }
  push();
  return segments;
}

async function requestsPreparedDocumentEnvironment(value, rootDir) {
  const commands = collectPreparedDocumentInputStrings(value)
    .filter((text) => text.length > 0);
  for (const command of commands) {
    const segments = splitShellCommandSegments(command);
    if (segments.length > 1) {
      for (const segment of segments) {
        if (await requestsPreparedDocumentEnvironment(segment, rootDir)) return true;
      }
      continue;
    }
    const tokens = splitCommandLine(command);
    if (tokens.length === 0) continue;
    const executable = basename(tokens[0]).replace(/\.exe$/iu, "").toLowerCase();
    const inlineInterpreter = new Set(["node", "nodejs", "python", "python3", "py", "pwsh", "powershell"]);
    const scriptTokens = [];
    if (SCRIPT_EXTENSIONS.has(extname(tokens[0]).toLowerCase())) {
      scriptTokens.push(tokens[0]);
    } else if (inlineInterpreter.has(executable)) {
      const preloadFlags = new Set(["-r", "--require", "--loader", "--experimental-loader", "--import"]);
      const inlineFlags = new Set(["-e", "--eval", "-p", "--print", "-c", "--command"]);
      for (let index = 1; index < tokens.length; index++) {
        const token = tokens[index];
        const normalized = token.toLowerCase();
        const inlineFlag = [...inlineFlags].some((flag) => normalized === flag || normalized.startsWith(`${flag}=`));
        if (inlineFlag) {
          const code = normalized.includes("=") ? token.slice(token.indexOf("=") + 1) : tokens[index + 1] ?? "";
          if (/VISIONOX_DOCUMENT_(?:REF|READABLE_PATH|ROOT)\b/iu.test(code)) return true;
          break;
        }
        if (normalized === "--") {
          if (SCRIPT_EXTENSIONS.has(extname(tokens[index + 1] ?? "").toLowerCase())) scriptTokens.push(tokens[index + 1]);
          break;
        }
        const preloadFlag = [...preloadFlags].find((flag) => normalized === flag || normalized.startsWith(`${flag}=`));
        if (preloadFlag) {
          const preload = normalized.startsWith(`${preloadFlag}=`)
            ? token.slice(token.indexOf("=") + 1)
            : tokens[++index];
          if (SCRIPT_EXTENSIONS.has(extname(preload ?? "").toLowerCase())) scriptTokens.push(preload);
          continue;
        }
        if (normalized === "-m" && ["python", "python3", "py"].includes(executable)) break;
        if (token.startsWith("-")) {
          const optionValue = tokens[index + 1];
          if (optionValue && !optionValue.startsWith("-") && !SCRIPT_EXTENSIONS.has(extname(optionValue).toLowerCase())) index++;
          continue;
        }
        if (SCRIPT_EXTENSIONS.has(extname(token).toLowerCase())) scriptTokens.push(token);
        break;
      }
    }
    for (const scriptToken of scriptTokens) {
      const scriptPath = resolveInputPath(scriptToken, rootDir);
      try {
        const script = await readFile(scriptPath, "utf8");
        if (/VISIONOX_DOCUMENT_(?:REF|READABLE_PATH|ROOT)\b/iu.test(script)) return true;
      } catch {
        // The normal command path validation will report a missing script.
      }
    }
  }
  return false;
}

function includesPreparedCandidate(text, candidate) {
  const haystack = process.platform === "win32" ? text.toLowerCase() : text;
  const needle = process.platform === "win32" ? candidate.toLowerCase() : candidate;
  return haystack.includes(needle);
}

function selectPreparedDocument(registry, input, rootDir) {
  const entries = registry?.snapshot?.() ?? [];
  if (entries.length === 0) return null;
  const values = collectPreparedDocumentInputStrings(input);
  const referencedEntries = new Map();
  const referencePattern = /visionox-document:[A-Za-z0-9_-]+/gu;
  for (const value of values) {
    for (const documentRef of value.match(referencePattern) ?? []) {
      const exact = registry.find(documentRef);
      if (!exact) throw new DlpDecryptError("文档引用已失效，无法绑定当前明文文件", { documentRef });
      referencedEntries.set(exact.documentId, exact);
    }
  }
  if (referencedEntries.size > 1) {
    throw new DlpDecryptError("命令中的文档引用互相冲突，无法确定当前明文文件", {
      documentRefs: [...referencedEntries.values()].map((entry) => entry.documentRef),
    });
  }

  const matches = new Map();
  for (const value of values) {
    const exact = registry.find(value);
    if (exact) matches.set(exact.documentId, exact);
    for (const entry of entries) {
      const rel = relative(rootDir, entry.sourcePath);
      const candidates = [entry.documentRef, entry.sourcePath, entry.readablePath];
      if (rel && !rel.startsWith("..") && !isAbsolute(rel)) candidates.push(rel);
      if (candidates.some((candidate) => candidate && includesPreparedCandidate(value, candidate))) {
        matches.set(entry.documentId, entry);
      }
    }
  }
  const referenced = referencedEntries.values().next().value ?? null;
  if (referenced && [...matches.values()].some((entry) => entry.documentId !== referenced.documentId)) {
    throw new DlpDecryptError("文档引用 documentRef 与命令中的文档路径冲突，已阻止执行", {
      documentRef: referenced.documentRef,
      matchedDocumentRefs: [...matches.values()].map((entry) => entry.documentRef),
    });
  }
  if (referenced) return referenced;
  if (matches.size === 1) return matches.values().next().value;
  if (matches.size > 1) return null;
  return entries.length === 1 ? entries[0] : null;
}

/** Runtime-only variables for child processes; keep real paths out of model messages. */
export async function preparedDocumentEnvironment(registry, input = null, rootDir = process.cwd(), options = {}) {
  const entries = registry?.snapshot?.() ?? [];
  let entry = selectPreparedDocument(registry, input, resolve(rootDir));
  if (!entry && entries.length > 1 && (
    await requestsPreparedDocumentEnvironment(input, resolve(rootDir))
    || requestsPreparedDocumentPathPlaceholder(input)
  )) {
    throw new DlpDecryptError(
      "命令请求使用已准备文档的环境变量，但当前会话准备了多个文档且未提供 documentRef，无法安全选择输入文件。请在 run_command/run_background 的 documentRef 字段中传入目标文档引用后重试。",
      {
        code: "DOCUMENT_REF_REQUIRED",
        documentRefs: entries.map((item) => item.documentRef).filter(Boolean),
        hint: "请在 run_command/run_background 的 documentRef 字段中传入目标文档引用，然后让脚本读取 VISIONOX_DOCUMENT_READABLE_PATH。",
      },
    );
  }
  if (!entry) return {};
  if (options.readConfig || options.cfg || options.env) {
    const env = { ...(options.env ?? {}), rootDir: options.env?.rootDir ?? resolve(rootDir) };
    const resolved = await resolveReadablePathForDlp(entry.documentRef, {
      cfg: typeof options.readConfig === "function" ? options.readConfig() : options.cfg ?? {},
      env,
      logger: options.logger,
      signal: options.signal,
      registry,
    });
    entry = registry.find(resolved.documentRef) ?? {
      ...entry,
      readablePath: resolved.path,
      readableDirectory: dirname(resolved.path),
    };
  }
  return {
    VISIONOX_DOCUMENT_REF: entry.documentRef,
    VISIONOX_DOCUMENT_READABLE_PATH: entry.readablePath,
    VISIONOX_DOCUMENT_ROOT: entry.readableDirectory,
    VISIONOX_WORKSPACE_ROOT: resolve(rootDir),
  };
}

export function preparedDocumentToolResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const {
    sourcePath: _sourcePath,
    readablePath: _readablePath,
    sourcePaths: _sourcePaths,
    sources,
    ...visible
  } = result;
  if (Array.isArray(sources)) visible.sources = sources.map(preparedDocumentToolResult);
  if (visible.ok && visible.documentRef) {
    visible.pathUsage = visible.pathUsage ?? preparedDocumentPathUsage();
    visible.note = "Keep using documentRef with supported tools and commands; the host manages the current readable file path.";
  }
  return visible;
}

export function latestPreparedDocumentRef(registry, documentKind = null) {
  const entries = registry?.snapshot?.();
  if (!Array.isArray(entries)) return null;
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (documentKind && entry?.documentKind !== documentKind) continue;
    if (typeof entry?.documentRef === "string" && entry.documentRef.trim()) return entry.documentRef;
  }
  return null;
}

export class DlpDecryptError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "DlpDecryptError";
    this.details = details;
  }
}

export function defaultDlpScriptCandidates({ homeDir = homedir(), projectRoot, serverDir } = {}) {
  const candidates = [];
  if (serverDir) {
    candidates.push(
      resolve(serverDir, "visionox-file", "visionox_file.py"),
    );
  }
  candidates.push(
    resolve(homeDir, ".visionox", "skills", "visionox-file", "visionox_file.py"),
  );
  if (projectRoot) {
    candidates.push(
      resolve(projectRoot, "skills", "skills", "visionox-file-temp", "visionox_file.py"),
      resolve(projectRoot, "skills", "skills", "visionox-file", "visionox_file.py"),
      resolve(projectRoot, "src-tauri", "resources", "server", "visionox-file", "visionox_file.py"),
      resolve(projectRoot, "resources", "server", "visionox-file", "visionox_file.py"),
    );
  }
  return candidates;
}

export function resolveDlpScriptPath(cfg = {}, env = {}) {
  const configured = cfg.dlp?.visionoxFileScript || cfg.dlp?.scriptPath;
  const candidates = configured
    ? [configured]
    : defaultDlpScriptCandidates(env);
  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

export function getDlpConfig(cfg = {}, env = {}) {
  const raw = cfg.dlp && typeof cfg.dlp === "object" ? cfg.dlp : {};
  const mode = ["auto", "on", "off"].includes(raw.mode) ? raw.mode : "auto";
  const timeoutMs = Number.isFinite(raw.timeoutMs)
    ? Math.max(5_000, Math.min(300_000, Number(raw.timeoutMs)))
    : DEFAULT_TIMEOUT_MS;
  const skipExtensions = new Set(
    Array.isArray(raw.skipExtensions)
      ? raw.skipExtensions.map((v) => String(v).toLowerCase()).filter(Boolean)
      : DEFAULT_SKIP_EXTENSIONS,
  );
  return {
    mode,
    timeoutMs,
    pythonPath: typeof raw.pythonPath === "string" && raw.pythonPath.trim() ? raw.pythonPath.trim() : "python",
    scriptPath: resolveDlpScriptPath(cfg, env),
    skipExtensions,
  };
}

export async function readFileHeader(path, length = 4) {
  let fh;
  try {
    fh = await open(path, "r");
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh?.close().catch(() => {});
  }
}

export async function isDlpEncryptedFile(path) {
  const header = await readFileHeader(path, 4);
  return header.length === 4 && header.equals(DLP_MAGIC);
}

function cacheKey(path, stat) {
  return `${path}|${stat.size}|${stat.mtimeMs}`;
}

function sourceRevision(path, stat, fallback = null) {
  if (!stat && typeof fallback === "string" && /^[a-f0-9]{24}$/i.test(fallback)) return fallback.toLowerCase();
  const size = Number.isFinite(stat?.size) ? stat.size : Number.isFinite(fallback?.size) ? fallback.size : "unknown";
  const mtime = Number.isFinite(stat?.mtimeMs) ? stat.mtimeMs : Number.isFinite(fallback?.mtimeMs) ? fallback.mtimeMs : "unknown";
  return createHash("sha256").update(`${preparedPathKey(path) ?? path}|${size}|${mtime}`).digest("hex").slice(0, 24);
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseJsonFromStdout(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("visionox-file did not print a JSON object");
  }
  return JSON.parse(stdout.slice(start, end + 1));
}

function runDecryptProcess(command, args, timeoutMs, signal) {
  return new Promise((resolveProcess) => {
    if (signal?.aborted) {
      resolveProcess({ ok: false, aborted: true, stdout: "", stderr: "" });
      return;
    }
    const child = spawn(command, args, {
      windowsHide: false,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolveProcess(result);
    };
    const onAbort = () => {
      try { child.kill(); } catch {}
      finish({ ok: false, aborted: true, stdout, stderr });
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      finish({ ok: false, timedOut: true, stdout, stderr });
    }, timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", (err) => {
      finish({ ok: false, error: err, stdout, stderr });
    });
    child.on("close", (code, signal) => {
      finish({ ok: code === 0, code, signal, stdout, stderr });
    });
  });
}

function looksLikeMissingPython(run) {
  const text = `${run?.stdout ?? ""}\n${run?.stderr ?? ""}`;
  return run?.error?.code === "ENOENT" ||
    /Python was not found|Microsoft Store|App execution aliases/i.test(text);
}

async function runVisionoxFile({ pythonPath, scriptPath, sourcePath, timeoutMs, signal }) {
  const first = await runDecryptProcess(pythonPath, [scriptPath, sourcePath], timeoutMs, signal);
  if (first.ok) return first;
  if (first.aborted) return first;
  if (pythonPath === "python" && looksLikeMissingPython(first)) {
    return await runDecryptProcess("py", ["-3", scriptPath, sourcePath], timeoutMs, signal);
  }
  return first;
}

function pickDecryptedPath(result, sourcePath) {
  const files = Array.isArray(result.files) ? result.files : [];
  const sourceName = basename(sourcePath).toLowerCase();
  const exact = files.find((f) =>
    f?.status === "ok" &&
    typeof f.dst === "string" &&
    typeof f.src === "string" &&
    resolve(f.src).toLowerCase() === resolve(sourcePath).toLowerCase()
  );
  if (exact) return exact.dst;
  const byName = files.find((f) =>
    f?.status === "ok" &&
    typeof f.dst === "string" &&
    String(f.name ?? "").toLowerCase() === sourceName
  );
  return byName?.dst ?? null;
}

function publicFileAccessReason(reason) {
  return String(reason ?? "内部文件读取失败")
    .replace(/visionox[-_]file(?:\.py)?/gi, "内部文件读取组件")
    .replace(/\bdlp\b/gi, "文件权限")
    .replace(/加密/g, "保护")
    .replace(/解密/g, "读取");
}

function publicFileAccessError(reason) {
  const publicReason = publicFileAccessReason(reason);
  return [
    "文件暂时无法读取。",
    `原因: ${publicReason}`,
  ].join("\n");
}

function formatDecryptFailure(reason, details = {}) {
  const hint = [
    publicFileAccessError(reason),
    "请确认当前在公司办公网络或权限环境内，Python 与 tkinter 可用，并且文件未被 Office/其他程序占用。",
    "可手动验证: python -c \"import tkinter; print('OK')\"",
  ].join("\n");
  return new DlpDecryptError(hint, details);
}

function normalizeDrivePathInput(value) {
  const s = String(value ?? "").trim();
  if (!s) return s;
  return s.replace(/^([A-Za-z]):(?![\\/])/, "$1:\\");
}

function inputPathVariants(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const normalized = normalizeDrivePathInput(raw);
  return Array.from(new Set([raw, normalized].filter(Boolean)));
}

function resolveInputPath(value, rootDir) {
  const raw = String(value ?? "").trim();
  const normalized = normalizeDrivePathInput(raw);
  const base = isAbsolute(normalized) || /^[A-Za-z]:[\\/]/.test(normalized)
    ? normalized
    : resolve(rootDir ?? process.cwd(), normalized);
  return resolve(base);
}

function publicDocumentKind(path) {
  const ext = extname(path).toLowerCase();
  if ([".doc", ".docx", ".docm", ".rtf"].includes(ext)) return "word";
  if ([".xls", ".xlsx", ".xlsm", ".csv", ".tsv"].includes(ext)) return "spreadsheet";
  if ([".ppt", ".pptx", ".pptm"].includes(ext)) return "presentation";
  if (ext === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".tif", ".tiff"].includes(ext)) return "image";
  if ([".xml", ".dsn", ".json", ".jsonl", ".yaml", ".yml", ".txt", ".md", ".markdown", ".log", ".ini", ".cfg", ".conf"].includes(ext)) return "text";
  return "file";
}

function suggestedToolsForPath(path) {
  const kind = publicDocumentKind(path);
  if (kind === "pdf") return ["pdf skill", "available PDF reader"];
  if (kind === "word" || kind === "spreadsheet" || kind === "presentation") return ["officecli"];
  if (kind === "image") return ["image-capable document tools", "read_file metadata fallback"];
  if (kind === "text") return ["read_file"];
  return ["read_file", "domain-specific tool if available"];
}

async function binaryDocumentKind(path) {
  const kind = publicDocumentKind(path);
  if (kind !== "file" && kind !== "text") return kind;
  const header = await readFileHeader(path, 8);
  if (header.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "office-package";
  if (header.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) return "office-compound";
  if (header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image";
  if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image";
  return null;
}

function binaryReadError(path, kind) {
  return JSON.stringify({
    ok: false,
    code: "BINARY_INPUT_NOT_READ_AS_TEXT",
    error: `read_file only accepts UTF-8 text; detected ${kind || "binary"} input`,
    path,
    documentKind: kind || "binary",
    useTool: "prepare_local_document",
  });
}

function buildPreparedDocumentResult({ input, sourcePath, readable, candidates = [] }) {
  const changed = Boolean(readable?.path && resolve(readable.path) !== resolve(sourcePath));
  return {
    ok: true,
    input,
    sourcePath,
    readablePath: readable?.path ?? sourcePath,
    documentId: readable?.documentId ?? null,
    documentRef: readable?.documentRef ?? null,
    pathChanged: changed,
    usedCompatibilityAdapter: Boolean(readable?.encrypted || readable?.decrypted),
    cached: Boolean(readable?.cached),
    documentKind: publicDocumentKind(sourcePath),
    suggestedTools: suggestedToolsForPath(sourcePath),
    candidateCount: candidates.length || 1,
    pathUsage: preparedDocumentPathUsage(),
    note: "Keep documentRef for later tools. For scripts, set the tool's documentRef and read VISIONOX_DOCUMENT_READABLE_PATH or VISIONOX_DOCUMENT_ROOT; the host restores the readable copy when needed.",
  };
}

function buildCandidateError(input, candidates) {
  if (!candidates || candidates.length === 0) {
    return {
      ok: false,
      input,
      error: "未找到匹配的本地文件",
      hint: "请确认盘符、目录、文件名或通配符是否正确。",
    };
  }
  return {
    ok: false,
    input,
    error: "匹配到多个文件，请让用户确认具体文件",
    candidates: candidates.slice(0, 20).map((c) => c.abs ?? c),
    candidateCount: candidates.length,
  };
}

function trimCandidatePath(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/^["'“”‘’`<（(]+/, "")
    .replace(/["'“”‘’`>，。；;、)）\]\}]+$/g, "")
    .trim();
}

function findDocumentPathCandidate(text, start, rootDir, extensions = DOCUMENT_PATH_EXTENSIONS) {
  const tail = String(text).slice(start);
  const hardStop = tail.search(/[<>\r\n|]/);
  const searchable = hardStop >= 0 ? tail.slice(0, hardStop) : tail;
  let best = null;
  const lower = searchable.toLowerCase();
  for (const ext of extensions) {
    let idx = lower.indexOf(ext);
    while (idx >= 0) {
      const end = idx + ext.length;
      const next = searchable[end] || "";
      if (!next || /[\s"'“”‘’`),;，。；、\]}）]/.test(next)) {
        const candidate = trimCandidatePath(searchable.slice(0, end));
        const matches = pathCandidatesFromString(candidate, rootDir) ?? [];
        if (matches.length === 1 && (!best || candidate.length > best.raw.length)) {
          best = { raw: candidate, abs: matches[0].abs, fromPattern: matches[0].fromPattern };
        } else if (matches.length > 1 && (!best || candidate.length > best.raw.length)) {
          best = { raw: candidate, multiple: matches };
        }
      }
      idx = lower.indexOf(ext, idx + 1);
    }
  }
  return best;
}

function extractDocumentPathCandidates(text, rootDir) {
  const input = String(text ?? "");
  const out = [];
  const drivePath = /[A-Za-z]:(?:[\\/])?/g;
  let match;
  while ((match = drivePath.exec(input)) !== null) {
    const candidate = findDocumentPathCandidate(input, match.index, rootDir);
    if (!candidate) continue;
    if (candidate.multiple) out.push(...candidate.multiple);
    else out.push({ abs: candidate.abs, fromPattern: candidate.fromPattern, raw: candidate.raw });
    drivePath.lastIndex = match.index + Math.max(candidate.raw?.length ?? 2, 2);
  }
  const seen = new Set();
  return out.filter((item) => {
    const key = resolve(item.abs).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function candidatesFromInput(input, rootDir) {
  const direct = pathCandidatesFromString(input, rootDir) ?? [];
  if (direct.length > 0) return direct.map((item) => ({ ...item, raw: String(input ?? "").trim() }));
  return extractDocumentPathCandidates(input, rootDir);
}

export async function prepareLocalDocument(input, { cfg = {}, env = {}, logger = console, allowMultiple = false, signal, registry } = {}) {
  const raw = typeof input === "string"
    ? input
    : String(input?.path ?? input?.file ?? input?.input ?? input?.text ?? input?.prompt ?? "").trim();
  const managed = registry?.find(raw);
  if (managed) {
    const readable = await resolveReadablePathForDlp(raw, { cfg, env, logger, signal, registry });
    return buildPreparedDocumentResult({ input: raw, sourcePath: managed.sourcePath, readable });
  }
  const candidates = candidatesFromInput(raw, env.rootDir);
  if (candidates.length !== 1) {
    if (allowMultiple && candidates.length > 1) {
      return {
        ok: true,
        input: raw,
        multiple: true,
        candidateCount: candidates.length,
        candidates: candidates.slice(0, 50).map((c) => c.abs),
        note: "Ask the user to choose one candidate before parsing document content.",
      };
    }
    return buildCandidateError(raw, candidates);
  }
  const sourcePath = candidates[0].abs;
  const readable = await resolveReadablePathForDlp(sourcePath, { cfg, env, logger, signal, registry });
  return buildPreparedDocumentResult({ input: raw, sourcePath, readable, candidates });
}

export async function prepareLocalDocuments(inputs, options = {}) {
  const values = (Array.isArray(inputs) ? inputs : [inputs])
    .map((value) => typeof value === "string" ? value.trim() : value)
    .filter((value) => typeof value !== "string" || value.length > 0);
  if (values.length === 0) return { ok: false, error: "至少需要一个本地文档路径" };
  if (values.length > 50) return { ok: false, error: "单次多文档任务最多支持 50 个来源文件" };
  if (values.length === 1) return prepareLocalDocument(values[0], options);

  const sources = [];
  const seen = new Set();
  for (let index = 0; index < values.length; index++) {
    const prepared = await prepareLocalDocument(values[index], options);
    if (!prepared?.ok) {
      return {
        ...prepared,
        ok: false,
        sourceIndex: index,
        error: `第 ${index + 1} 个来源准备失败：${prepared?.error || "未知错误"}`,
      };
    }
    const key = preparedPathKey(prepared.sourcePath) ?? prepared.sourcePath;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(prepared);
  }
  if (sources.length === 0) return { ok: false, error: "没有可处理的唯一来源文件" };
  if (sources.length === 1) return sources[0];
  return {
    ok: true,
    multiple: true,
    documentKind: "collection",
    sourcePath: sources[0].sourcePath,
    readablePath: sources[0].readablePath,
    sourcePaths: sources.map((source) => source.sourcePath),
    sources,
    sourceCount: sources.length,
    usedCompatibilityAdapter: sources.some((source) => source.usedCompatibilityAdapter === true),
  };
}

export async function resolveReadablePathForDlp(path, { cfg = {}, env = {}, logger = console, signal, registry } = {}) {
  if (signal?.aborted) throw new DOMException("document preparation cancelled", "AbortError");
  const managed = registry?.find(path);
  if (managed) registry?.touch?.(managed.documentRef);
  const rawPath = String(path ?? "").trim();
  if (rawPath.startsWith(DOCUMENT_REF_PREFIX) && !managed) {
    throw new DlpDecryptError("文档引用已失效，无法恢复原始文件路径", { documentRef: rawPath });
  }
  const abs = resolveInputPath(managed?.sourcePath ?? path, env.rootDir);
  const withManagedDocument = (result) => {
    if (!registry) return result;
    const prepared = registry.register({
      documentId: managed?.documentId,
      sourcePath: abs,
      readablePath: result.path,
      documentKind: managed?.documentKind,
      encrypted: result.encrypted,
    });
    return { ...result, sourcePath: abs, documentId: prepared.documentId, documentRef: prepared.documentRef };
  };
  const dlp = getDlpConfig(cfg, env);
  if (process.platform !== "win32") return withManagedDocument({ path: abs, encrypted: false, skipped: "non-windows" });
  if (dlp.mode === "off") return withManagedDocument({ path: abs, encrypted: false, skipped: "disabled" });
  const ext = extname(abs).toLowerCase();
  if (dlp.mode !== "on" && dlp.skipExtensions.has(ext)) {
    return withManagedDocument({ path: abs, encrypted: false, skipped: "extension" });
  }

  let stat;
  try {
    stat = statSync(abs);
  } catch (err) {
    throw new DlpDecryptError(`无法读取文件状态: ${err.message}`, { sourcePath: abs });
  }
  if (!stat.isFile()) return withManagedDocument({ path: abs, encrypted: false, skipped: "not-file" });

  let encrypted = false;
  try {
    encrypted = await isDlpEncryptedFile(abs);
  } catch (err) {
    throw new DlpDecryptError(`无法检测文件状态: ${err.message}`, { sourcePath: abs });
  }
  if (!encrypted) return withManagedDocument({ path: abs, encrypted: false });

  if (!dlp.scriptPath) {
    throw formatDecryptFailure("未找到内部文件读取组件，请联系管理员检查客户端配置。", {
      sourcePath: abs,
    });
  }

  const key = cacheKey(abs, stat);
  const cached = decryptCache.get(key);
  if (cached && await pathExists(cached)) {
    return withManagedDocument({ path: cached, encrypted: true, decrypted: true, cached: true, sourcePath: abs });
  }

  logger?.error?.(`[dlp] encrypted file detected, decrypting via visionox-file: ${abs}`);
  const run = await runVisionoxFile({
    pythonPath: dlp.pythonPath,
    scriptPath: dlp.scriptPath,
    sourcePath: abs,
    timeoutMs: dlp.timeoutMs,
    signal,
  });
  if (run.aborted) throw new DOMException("document preparation cancelled", "AbortError");
  if (!run.ok) {
    const reason = run.timedOut
      ? `读取超时 (${dlp.timeoutMs}ms)`
      : run.error
        ? `${run.error.message}`
        : `内部文件读取组件退出码 ${run.code ?? "unknown"}${run.signal ? `, signal ${run.signal}` : ""}`;
    throw formatDecryptFailure(reason, {
      sourcePath: abs,
      scriptPath: dlp.scriptPath,
      stderr: run.stderr?.slice(0, 2000),
      stdout: run.stdout?.slice(0, 2000),
    });
  }

  let parsed;
  try {
    parsed = parseJsonFromStdout(run.stdout);
  } catch (err) {
    throw formatDecryptFailure(`无法解析内部文件读取组件输出: ${err.message}`, {
      sourcePath: abs,
      stdout: run.stdout?.slice(0, 2000),
      stderr: run.stderr?.slice(0, 2000),
    });
  }
  if (!parsed?.ok) {
    throw formatDecryptFailure(parsed?.error || "内部文件读取组件返回失败", {
      sourcePath: abs,
      result: parsed,
    });
  }
  const decryptedPath = pickDecryptedPath(parsed, abs);
  if (!decryptedPath || !await pathExists(decryptedPath)) {
    throw formatDecryptFailure("内部文件读取组件未返回有效临时文件路径", {
      sourcePath: abs,
      result: parsed,
      tempRoot: resolve(tmpdir(), "visionox_decrypted"),
    });
  }
  decryptCache.set(key, decryptedPath);
  return withManagedDocument({ path: decryptedPath, encrypted: true, decrypted: true, cached: false, sourcePath: abs });
}

export function wrapReadFileToolWithDlp(tools, options = {}) {
  const original = tools.get("read_file");
  if (!original || original.__visionoxDlpWrapped) return false;
  tools.unregister("read_file");
  tools.register({
    ...original,
    __visionoxDlpWrapped: true,
    description: `${original.description ?? ""} Uses Visionox file access compatibility for workplace documents when needed.`,
    fn: async (args, ctx) => {
      const cfg = typeof options.readConfig === "function" ? options.readConfig() : {};
      const resolved = await resolveReadablePathForDlp(args.path, {
        cfg,
        env: options.env,
        logger: options.logger,
        signal: ctx?.signal,
        registry: options.registry,
      });
      const detectedKind = await binaryDocumentKind(resolved.path);
      if (detectedKind) return binaryReadError(args.path, detectedKind);
      return await original.fn({ ...args, path: resolved.path }, ctx);
    },
  });
  return true;
}

function looksLikePathString(value) {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (!s || s.length > 1024 || /[\r\n]/.test(s)) return false;
  return isAbsolute(s) || /^[A-Za-z]:(?:[\\/])?/.test(s) || s.includes("\\") || s.includes("/");
}

function hasPathWildcard(value) {
  return /[*?]/.test(String(value ?? ""));
}

function normalizedPathSegment(value) {
  const normalized = String(value ?? "").replace(/\s/gu, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function expandWhitespaceNormalizedPath(value, rootDir) {
  const raw = normalizeDrivePathInput(value);
  if (!looksLikePathString(raw) || hasPathWildcard(raw) || /[\r\n]/.test(raw)) return [];
  const absolute = resolveInputPath(raw, rootDir);
  const parsed = parse(absolute);
  const parts = absolute.slice(parsed.root.length).split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return [];

  let states = [{ path: parsed.root }];
  for (let index = 0; index < parts.length && states.length > 0; index++) {
    const segment = parts[index];
    const last = index === parts.length - 1;
    const next = [];
    for (const state of states) {
      const entries = safeReadDir(state.path);
      const exact = entries.filter((entry) => entry.name === segment);
      const matches = exact.length > 0
        ? exact
        : entries.filter((entry) => normalizedPathSegment(entry.name) === normalizedPathSegment(segment));
      for (const entry of matches) {
        if (last) {
          if (entry.isFile() || entry.isSymbolicLink()) next.push({ path: join(state.path, entry.name) });
        } else if (entry.isDirectory()) {
          next.push({ path: join(state.path, entry.name) });
        }
        if (next.length >= 50) break;
      }
      if (next.length >= 50) break;
    }
    states = next;
  }
  return Array.from(new Set(states.map((state) => resolve(state.path))));
}

function wildcardSegmentToRegExp(segment) {
  let pattern = "^";
  for (const ch of String(segment)) {
    if (ch === "*") pattern += ".*";
    else if (ch === "?") pattern += ".";
    else pattern += ch.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }
  pattern += "$";
  return new RegExp(pattern, process.platform === "win32" ? "i" : "");
}

function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function safeReadDir(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function expandWildcardPath(value, rootDir) {
  const raw = normalizeDrivePathInput(value);
  if (!hasPathWildcard(raw) || /[\r\n]/.test(raw)) return [];
  const absPattern = isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)
    ? resolve(raw)
    : resolve(rootDir ?? process.cwd(), raw);
  const parsed = parse(absPattern);
  const parts = absPattern
    .slice(parsed.root.length)
    .split(/[\\/]+/)
    .filter(Boolean);
  if (parts.length === 0) return [];

  const out = [];
  const walk = (dir, idx) => {
    const segment = parts[idx];
    const re = wildcardSegmentToRegExp(segment);
    const last = idx === parts.length - 1;
    for (const entry of safeReadDir(dir)) {
      if (!re.test(entry.name)) continue;
      const full = join(dir, entry.name);
      if (last) {
        if (entry.isFile()) out.push(full);
      } else if (entry.isDirectory()) {
        walk(full, idx + 1);
      }
    }
  };

  const root = parsed.root || ".";
  if (!safeStat(root)?.isDirectory()) return [];
  walk(root, 0);
  return Array.from(new Set(out.map((p) => resolve(p))));
}

function pathCandidatesFromString(value, rootDir) {
  if (!looksLikePathString(value)) return null;
  const out = [];
  for (const s of inputPathVariants(value)) {
    if (hasPathWildcard(s)) {
      out.push(...expandWildcardPath(s, rootDir).map((abs) => ({ abs, fromPattern: true })));
      continue;
    }
    const abs = resolveInputPath(s, rootDir);
    if (existsSync(abs)) {
      out.push({ abs, fromPattern: false });
    } else {
      out.push(...expandWhitespaceNormalizedPath(s, rootDir).map((corrected) => ({ abs: corrected, fromPattern: false, corrected: true })));
    }
  }
  const seen = new Set();
  return out.filter((item) => {
    const key = resolve(item.abs).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function singlePathCandidateFromString(value, rootDir) {
  const candidates = pathCandidatesFromString(value, rootDir);
  return candidates?.length === 1 ? candidates[0] : null;
}

function existingPathFromString(value, rootDir) {
  return singlePathCandidateFromString(value, rootDir)?.abs ?? null;
}

function isOfficecliCommandArg(meta) {
  return String(meta?.toolName ?? "").toLowerCase() === "officecli" && meta?.key === "command";
}

function isShellCommandArg(meta) {
  const name = String(meta?.toolName ?? "").toLowerCase();
  return (name === "run_command" || name === "run_background") && meta?.key === "command";
}

const PREPARED_DOCUMENT_ENVIRONMENT_PATHS = Object.freeze({
  VISIONOX_DOCUMENT_READABLE_PATH: "VISIONOX_DOCUMENT_READABLE_PATH",
  VISIONOX_DOCUMENT_ROOT: "VISIONOX_DOCUMENT_ROOT",
});

function escapeRegExp(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function commandPathArgument(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function replaceEnvironmentPlaceholder(text, placeholder, value) {
  const escaped = escapeRegExp(placeholder);
  const replacement = commandPathArgument(value);
  const quoted = new RegExp(`(["'])${escaped}\\1`, "giu");
  const unquoted = new RegExp(`(^|[^A-Za-z0-9_])${escaped}(?=$|[^A-Za-z0-9_])`, "giu");
  return text
    .replace(quoted, replacement)
    .replace(unquoted, (_match, prefix) => `${prefix}${replacement}`);
}

function preparedEnvironmentPlaceholders(name) {
  return [
    `$env:${name}`,
    `%${name}%`,
    `\${${name}}`,
    `$${name}`,
  ];
}

function requestsPreparedDocumentPathPlaceholder(value) {
  const texts = typeof value === "string"
    ? [value]
    : collectPreparedDocumentInputStrings(value);
  return texts.some((text) => Object.keys(PREPARED_DOCUMENT_ENVIRONMENT_PATHS).some((name) => (
    preparedEnvironmentPlaceholders(name).some((placeholder) => text.toLowerCase().includes(placeholder.toLowerCase()))
  )));
}

async function resolvePreparedDocumentPathPlaceholders(command, options) {
  if (!requestsPreparedDocumentPathPlaceholder(command)) return command;
  const environment = await preparedDocumentEnvironment(
    options.registry,
    options.bindingInput ?? { command },
    options.env?.rootDir ?? process.cwd(),
    options,
  );
  if (!environment.VISIONOX_DOCUMENT_READABLE_PATH) return command;
  let resolved = String(command);
  for (const [name, environmentKey] of Object.entries(PREPARED_DOCUMENT_ENVIRONMENT_PATHS)) {
    const value = environment[environmentKey];
    if (!value) continue;
    for (const placeholder of preparedEnvironmentPlaceholders(name)) {
      resolved = replaceEnvironmentPlaceholder(resolved, placeholder, value);
    }
  }
  return resolved;
}

function looksDestructiveCommand(command) {
  return /^\s*(del|erase|rm|remove-item|move|mv|ren|rename|set-content|out-file|write-output|copy|cp|xcopy|robocopy)\b/i.test(String(command ?? ""));
}

function splitCommandLine(command) {
  const args = [];
  let current = "";
  let quote = null;
  const text = String(command);
  for (let index = 0; index < text.length; index++) {
    const ch = text[index];
    if (ch === "\\" && quote && text[index + 1] === quote) {
      current += quote;
      index++;
      continue;
    }
    if ((ch === '"' || ch === "'") && !quote) {
      quote = ch;
      continue;
    }
    if (quote === ch) {
      quote = null;
      continue;
    }
    if (!quote && /\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current) args.push(current);
  return args;
}

function findOfficePathCandidate(text, start, rootDir) {
  return findDocumentPathCandidate(text, start, rootDir, OFFICE_READABLE_EXTENSIONS);
}

function quotedPathBounds(text, start, rawLength) {
  const before = text[start - 1] || "";
  const after = text[start + rawLength] || "";
  if ((before === '"' || before === "'") && after === before) {
    return { start: start - 1, end: start + rawLength + 1 };
  }
  return { start, end: start + rawLength };
}

async function resolveRegisteredPathsInCommand(command, options) {
  const registry = options.registry;
  if (!registry) return { command, changed: false, matched: false };
  let text = String(command ?? "");
  let changed = false;
  let matched = false;
  for (const entry of registry.snapshot()) {
    const candidates = [...new Set([entry.documentRef, entry.readablePath, entry.sourcePath].filter(Boolean))]
      .sort((a, b) => b.length - a.length);
    for (const candidate of candidates) {
      const haystack = process.platform === "win32" ? text.toLowerCase() : text;
      const needle = process.platform === "win32" ? candidate.toLowerCase() : candidate;
      const start = haystack.indexOf(needle);
      if (start < 0) continue;
      matched = true;
      const result = await resolveDlpPathToken(candidate, options);
      const bounds = quotedPathBounds(text, start, candidate.length);
      const replacement = `"${String(result.value).replace(/"/g, '\\"')}"`;
      if (text.slice(bounds.start, bounds.end) !== replacement) {
        text = `${text.slice(0, bounds.start)}${replacement}${text.slice(bounds.end)}`;
        changed = true;
      }
      break;
    }
  }
  return { command: changed ? text : command, changed, matched };
}

async function resolveEmbeddedOfficePaths(command, options) {
  const registered = await resolveRegisteredPathsInCommand(command, options);
  const text = String(registered.command ?? "");
  const drivePath = /[A-Za-z]:(?:[\\/])?/g;
  let match;
  let changed = registered.changed;
  let matched = registered.matched;
  let cursor = 0;
  let out = "";
  while ((match = drivePath.exec(text)) !== null) {
    const start = match.index;
    if (start < cursor) continue;
    const candidate = findOfficePathCandidate(text, start, options.env?.rootDir);
    if (!candidate || candidate.multiple) continue;
    matched = true;
    const result = await resolveDlpPathToken(candidate.fromPattern ? candidate.raw : candidate.abs, options);
    if (!result.changed) continue;
    const bounds = quotedPathBounds(text, start, candidate.raw.length);
    changed = true;
    out += text.slice(cursor, bounds.start);
    out += `"${String(result.value).replace(/"/g, '\\"')}"`;
    cursor = bounds.end;
    drivePath.lastIndex = cursor;
  }
  if (!changed) return { command, changed: false, matched };
  out += text.slice(cursor);
  return { command: out, changed: true, matched };
}

async function resolveEmbeddedDocumentPaths(command, options) {
  const registered = await resolveRegisteredDocumentString(command, options);
  const text = String(registered.value ?? "");
  const drivePath = /[A-Za-z]:(?:[\\/])?/g;
  let match;
  let changed = registered.changed;
  let cursor = 0;
  let out = "";
  while ((match = drivePath.exec(text)) !== null) {
    const start = match.index;
    if (start < cursor) continue;
    const candidate = findDocumentPathCandidate(text, start, options.env?.rootDir);
    if (!candidate || candidate.multiple) continue;
    const result = await resolveDlpPathToken(candidate.fromPattern ? candidate.raw : candidate.abs, options);
    if (!result.changed) continue;
    const bounds = quotedPathBounds(text, start, candidate.raw.length);
    changed = true;
    out += text.slice(cursor, bounds.start);
    out += `"${String(result.value).replace(/"/g, '\\"')}"`;
    cursor = bounds.end;
    drivePath.lastIndex = cursor;
  }
  if (!changed) return { command, changed: false };
  out += text.slice(cursor);
  return { command: out, changed: true };
}

function preparedTempAliasTokens(value) {
  const tokens = splitCommandLine(String(value ?? ""));
  return tokens.filter((token) => {
    const normalized = token.replace(/\//gu, "\\").toLowerCase();
    const tempRoot = resolve(tmpdir(), "visionox_decrypted");
    const candidate = resolve(token);
    const relativeToTempRoot = relative(tempRoot, candidate);
    const insideTempRoot = relativeToTempRoot === "" ||
      (!relativeToTempRoot.startsWith("..") && !isAbsolute(relativeToTempRoot));
    if (!insideTempRoot || !normalized.includes("\\visionox_decrypted\\")) return false;
    return DOCUMENT_PATH_EXTENSIONS.includes(extname(token).toLowerCase());
  });
}

async function resolvePreparedTempAliases(value, options) {
  const original = String(value ?? "");
  const entries = options.registry?.snapshot?.() ?? [];
  if (!original || entries.length === 0) return { value, changed: false };
  let text = original;
  let changed = false;
  for (const token of preparedTempAliasTokens(original)) {
    // A real file under the managed temporary root is authoritative. Only
    // recover paths that are stale, otherwise a coincidental basename could
    // silently redirect a user's explicit path to another document.
    if (await pathExists(resolve(token))) continue;
    const key = normalizedPathSegment(basename(token));
    const matches = entries.filter((entry) => (
      [entry.sourcePath, entry.readablePath]
        .filter(Boolean)
        .some((path) => normalizedPathSegment(basename(path)) === key)
    ));
    const unique = new Map(matches.map((entry) => [entry.documentId, entry]));
    if (unique.size !== 1) {
      throw new DlpDecryptError(
        unique.size === 0
          ? "命令使用了无法识别的临时文档路径，无法恢复当前明文文件。请重新准备原始文件并传入 documentRef。"
          : "命令使用了存在歧义的临时文档路径，无法确定当前明文文件。请传入 documentRef。",
        {
          code: "DOCUMENT_REF_REQUIRED",
          documentRefs: [...unique.values()].map((entry) => entry.documentRef).filter(Boolean),
          hint: "请在工具的 documentRef 字段中传入 prepare_local_document 返回的引用，不要拼接临时目录。",
        },
      );
    }
    const entry = unique.values().next().value;
    const resolved = await resolveDlpPathToken(entry.documentRef, options);
    if (!resolved.value || resolved.value === token) continue;
    text = text.split(token).join(resolved.value);
    changed = true;
  }
  return { value: changed ? text : value, changed };
}

async function resolveRegisteredDocumentString(value, options) {
  const original = String(value ?? "");
  if (!original || !options.registry) return { value, changed: false };
  const tempAliases = await resolvePreparedTempAliases(original, options);
  let text = String(tempAliases.value ?? original);
  let changed = tempAliases.changed;
  const entries = options.registry.snapshot?.() ?? [];
  const uniqueRelativeNames = new Map();
  for (const entry of entries) {
    const rel = relative(options.env?.rootDir ?? process.cwd(), entry.sourcePath);
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) {
      const key = rel.toLowerCase();
      uniqueRelativeNames.set(key, uniqueRelativeNames.has(key) ? null : entry);
    }
  }
  const candidates = [];
  for (const entry of entries) candidates.push(entry.documentRef, entry.sourcePath, entry.readablePath);
  for (const [name, entry] of uniqueRelativeNames) {
    if (entry) candidates.push(relative(options.env?.rootDir ?? process.cwd(), entry.sourcePath));
  }
  for (const candidate of [...new Set(candidates.filter(Boolean))].sort((a, b) => b.length - a.length)) {
    if (!text.includes(candidate)) continue;
    const resolved = await resolveDlpPathToken(candidate, options);
    if (!resolved.changed || !resolved.value || resolved.value === candidate) continue;
    if (/[\\/]/u.test(candidate)) {
      text = text.split(candidate).join(resolved.value);
      changed = true;
      continue;
    }
    const escaped = candidate.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    const token = new RegExp(`(^|[\\s\"'=(,:])${escaped}(?=$|[\\s\"'\\),;，。；、])`, "giu");
    const next = text.replace(token, `$1${resolved.value}`);
    changed ||= next !== text;
    text = next;
  }
  return { value: changed ? text : value, changed };
}

async function resolveDlpPathToken(value, options) {
  const raw = String(value ?? "").trim();
  const managed = options.registry?.find(value)
    ?? (raw && options.env?.rootDir && !/\s/u.test(raw)
      ? options.registry?.find(resolveInputPath(raw, options.env.rootDir))
      : null);
  const candidate = managed
    ? { abs: managed.sourcePath, fromPattern: false }
    : singlePathCandidateFromString(value, options.env?.rootDir);
  if (!candidate) return { value, changed: false };
  const resolved = await resolveReadablePathForDlp(candidate.abs, {
    cfg: typeof options.readConfig === "function" ? options.readConfig() : {},
    env: options.env,
    logger: options.logger,
    signal: options.signal,
    registry: options.registry,
  });
  if (managed) return { value: resolved.path, changed: String(value) !== resolved.path };
  if (resolved.encrypted) return { value: resolved.path, changed: true };
  if (candidate.fromPattern) return { value: candidate.abs, changed: true };
  return { value, changed: false };
}

async function resolveOfficecliCommandString(command, options) {
  const embedded = await resolveEmbeddedOfficePaths(command, options);
  if (embedded.changed || embedded.matched) {
    return splitCommandLine(embedded.command);
  }
  const tokens = splitCommandLine(command);
  if (tokens.length === 0) return command;
  let changed = false;
  const rewritten = [];
  for (const token of tokens) {
    const result = await resolveDlpPathToken(token, options);
    rewritten.push(result.value);
    changed ||= result.changed;
  }
  return changed ? rewritten : command;
}

async function resolveDlpPathsInArgs(value, options, meta = {}) {
  if (meta?.key === "documentRef") return value;
  if (isOfficecliCommandArg(meta)) {
    if (typeof value === "string") {
      const bound = await resolvePreparedDocumentPathPlaceholders(value, options);
      return await resolveOfficecliCommandString(bound, options);
    }
    if (Array.isArray(value)) {
      const out = [];
      for (const item of value) {
        if (typeof item === "string") {
          const bound = await resolvePreparedDocumentPathPlaceholders(item, options);
          const result = await resolveDlpPathToken(bound, options);
          out.push(result.value);
        } else {
          out.push(item);
        }
      }
      return out;
    }
  }
  if (isShellCommandArg(meta) && typeof value === "string" && !looksDestructiveCommand(value)) {
    const bound = await resolvePreparedDocumentPathPlaceholders(value, options);
    const embedded = await resolveEmbeddedDocumentPaths(bound, options);
    return embedded.command;
  }
  if (typeof value === "string") {
    const registered = await resolveRegisteredDocumentString(value, options);
    if (registered.changed) return registered.value;
    const result = await resolveDlpPathToken(value, options);
    return result.changed ? result.value : value;
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await resolveDlpPathsInArgs(item, options, meta));
    return out;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = await resolveDlpPathsInArgs(item, options, { ...meta, key });
    }
    return out;
  }
  return value;
}

async function findUnboundScriptDocument(command, options) {
  if (!options.registry || typeof command !== "string") return null;
  const entries = options.registry.snapshot?.() ?? [];
  if (entries.length === 0) return null;
  for (const token of splitCommandLine(command)) {
    const ext = extname(token).toLowerCase();
    if (!SCRIPT_EXTENSIONS.has(ext)) continue;
    const scriptPath = resolveInputPath(token, options.env?.rootDir);
    let source;
    try {
      source = await readFile(scriptPath, "utf8");
    } catch {
      continue;
    }
    const matched = entries.find((entry) => {
      const candidates = [entry.sourcePath, entry.readablePath].flatMap((path) => [
        path,
        path.replace(/\\/gu, "\\\\"),
        path.replace(/\\/gu, "/"),
      ]);
      return candidates.some((candidate) => includesPreparedCandidate(source, candidate));
    });
    if (!matched) continue;
    return {
      ok: false,
      code: "UNBOUND_DOCUMENT_SCRIPT_INPUT",
      error: "脚本引用了已准备文档的路径，宿主无法保证后续读取使用当前明文文件。",
      script: scriptPath,
      documentRef: matched.documentRef,
      hint: "请让脚本读取 VISIONOX_DOCUMENT_READABLE_PATH 或 VISIONOX_DOCUMENT_ROOT，不要硬编码原始路径或临时路径。",
    };
  }
  return null;
}

export function wrapToolsPathArgsWithDlp(tools, toolNames, options = {}) {
  let count = 0;
  for (const name of toolNames) {
    if (!name || name === "read_file") continue;
    const original = tools.get(name);
    if (!original || original.__visionoxDlpPathArgsWrapped) continue;
    tools.unregister(name);
    tools.register({
      ...original,
      __visionoxDlpPathArgsWrapped: true,
      fn: async (args, ctx) => {
        const rewritten = await resolveDlpPathsInArgs(args, {
          ...options,
          bindingInput: args,
          signal: ctx?.signal,
        }, { toolName: name });
        if (isShellCommandArg({ toolName: name, key: "command" }) && typeof rewritten?.command === "string") {
          const issue = await findUnboundScriptDocument(rewritten.command, options);
          if (issue) return JSON.stringify(issue);
        }
        try {
          return await original.fn(rewritten, ctx);
        } catch (err) {
          if (err instanceof DlpDecryptError) throw err;
          throw err;
        }
      },
    });
    count++;
  }
  return count;
}
