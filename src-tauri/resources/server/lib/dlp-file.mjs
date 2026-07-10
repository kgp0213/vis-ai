import { existsSync, readdirSync, statSync } from "node:fs";
import { open, access } from "node:fs/promises";
import { basename, extname, isAbsolute, join, parse, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { spawn } from "node:child_process";

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

export class DlpDecryptError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "DlpDecryptError";
    this.details = details;
  }
}

export function defaultDlpScriptCandidates({ homeDir = homedir(), projectRoot, serverDir } = {}) {
  const candidates = [
    resolve(homeDir, ".visionox", "skills", "visionox-file", "visionox_file.py"),
  ];
  if (serverDir) {
    candidates.push(
      resolve(serverDir, "visionox-file", "visionox_file.py"),
    );
  }
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
  if (kind === "pdf") return ["pdf tools", "officecli", "read_file fallback"];
  if (kind === "word" || kind === "spreadsheet" || kind === "presentation") return ["officecli"];
  if (kind === "image") return ["image-capable document tools", "read_file metadata fallback"];
  if (kind === "text") return ["read_file"];
  return ["read_file", "domain-specific tool if available"];
}

function buildPreparedDocumentResult({ input, sourcePath, readable, candidates = [] }) {
  const changed = Boolean(readable?.path && resolve(readable.path) !== resolve(sourcePath));
  return {
    ok: true,
    input,
    sourcePath,
    readablePath: readable?.path ?? sourcePath,
    pathChanged: changed,
    usedCompatibilityAdapter: Boolean(readable?.encrypted || readable?.decrypted),
    cached: Boolean(readable?.cached),
    documentKind: publicDocumentKind(sourcePath),
    suggestedTools: suggestedToolsForPath(sourcePath),
    candidateCount: candidates.length || 1,
    note: "Use readablePath for the next document parsing tool. Do not describe path preparation internals to the user.",
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

export async function prepareLocalDocument(input, { cfg = {}, env = {}, logger = console, allowMultiple = false, signal } = {}) {
  const raw = typeof input === "string"
    ? input
    : String(input?.path ?? input?.file ?? input?.input ?? input?.text ?? input?.prompt ?? "").trim();
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
  const readable = await resolveReadablePathForDlp(sourcePath, { cfg, env, logger, signal });
  return buildPreparedDocumentResult({ input: raw, sourcePath, readable, candidates });
}

export async function resolveReadablePathForDlp(path, { cfg = {}, env = {}, logger = console, signal } = {}) {
  if (signal?.aborted) throw new DOMException("document preparation cancelled", "AbortError");
  const abs = resolveInputPath(path, env.rootDir);
  const dlp = getDlpConfig(cfg, env);
  if (process.platform !== "win32") return { path: abs, encrypted: false, skipped: "non-windows" };
  if (dlp.mode === "off") return { path: abs, encrypted: false, skipped: "disabled" };
  const ext = extname(abs).toLowerCase();
  if (dlp.mode !== "on" && dlp.skipExtensions.has(ext)) {
    return { path: abs, encrypted: false, skipped: "extension" };
  }

  let stat;
  try {
    stat = statSync(abs);
  } catch (err) {
    throw new DlpDecryptError(`无法读取文件状态: ${err.message}`, { sourcePath: abs });
  }
  if (!stat.isFile()) return { path: abs, encrypted: false, skipped: "not-file" };

  let encrypted = false;
  try {
    encrypted = await isDlpEncryptedFile(abs);
  } catch (err) {
    throw new DlpDecryptError(`无法检测文件状态: ${err.message}`, { sourcePath: abs });
  }
  if (!encrypted) return { path: abs, encrypted: false };

  if (!dlp.scriptPath) {
    throw formatDecryptFailure("未找到内部文件读取组件，请联系管理员检查客户端配置。", {
      sourcePath: abs,
    });
  }

  const key = cacheKey(abs, stat);
  const cached = decryptCache.get(key);
  if (cached && await pathExists(cached)) {
    return { path: cached, encrypted: true, decrypted: true, cached: true, sourcePath: abs };
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
  return { path: decryptedPath, encrypted: true, decrypted: true, cached: false, sourcePath: abs };
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
      });
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
    if (existsSync(abs)) out.push({ abs, fromPattern: false });
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

function looksDestructiveCommand(command) {
  return /^\s*(del|erase|rm|remove-item|move|mv|ren|rename|set-content|out-file|write-output|copy|cp|xcopy|robocopy)\b/i.test(String(command ?? ""));
}

function splitCommandLine(command) {
  const args = [];
  let current = "";
  let quote = null;
  for (const ch of String(command)) {
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

async function resolveEmbeddedOfficePaths(command, options) {
  const text = String(command ?? "");
  const drivePath = /[A-Za-z]:(?:[\\/])?/g;
  let match;
  let changed = false;
  let cursor = 0;
  let out = "";
  while ((match = drivePath.exec(text)) !== null) {
    const start = match.index;
    if (start < cursor) continue;
    const candidate = findOfficePathCandidate(text, start, options.env?.rootDir);
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

async function resolveEmbeddedDocumentPaths(command, options) {
  const text = String(command ?? "");
  const drivePath = /[A-Za-z]:(?:[\\/])?/g;
  let match;
  let changed = false;
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

async function resolveDlpPathToken(value, options) {
  const candidate = singlePathCandidateFromString(value, options.env?.rootDir);
  if (!candidate) return { value, changed: false };
  const resolved = await resolveReadablePathForDlp(candidate.abs, {
    cfg: typeof options.readConfig === "function" ? options.readConfig() : {},
    env: options.env,
    logger: options.logger,
    signal: options.signal,
  });
  if (resolved.encrypted) return { value: resolved.path, changed: true };
  if (candidate.fromPattern) return { value: candidate.abs, changed: true };
  return { value, changed: false };
}

async function resolveOfficecliCommandString(command, options) {
  const embedded = await resolveEmbeddedOfficePaths(command, options);
  if (embedded.changed) {
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
  if (isOfficecliCommandArg(meta)) {
    if (typeof value === "string") {
      return await resolveOfficecliCommandString(value, options);
    }
    if (Array.isArray(value)) {
      const out = [];
      for (const item of value) {
        if (typeof item === "string") {
          const result = await resolveDlpPathToken(item, options);
          out.push(result.value);
        } else {
          out.push(item);
        }
      }
      return out;
    }
  }
  if (isShellCommandArg(meta) && typeof value === "string" && !looksDestructiveCommand(value)) {
    const embedded = await resolveEmbeddedDocumentPaths(value, options);
    return embedded.command;
  }
  if (typeof value === "string") {
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
        const rewritten = await resolveDlpPathsInArgs(args, { ...options, signal: ctx?.signal }, { toolName: name });
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
