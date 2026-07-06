import { existsSync, statSync } from "node:fs";
import { open, access } from "node:fs/promises";
import { basename, extname, isAbsolute, resolve } from "node:path";
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

function runDecryptProcess(command, args, timeoutMs) {
  return new Promise((resolveProcess) => {
    const child = spawn(command, args, {
      windowsHide: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolveProcess({ ok: false, timedOut: true, stdout, stderr });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveProcess({ ok: false, error: err, stdout, stderr });
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveProcess({ ok: code === 0, code, signal, stdout, stderr });
    });
  });
}

async function runVisionoxFile({ pythonPath, scriptPath, sourcePath, timeoutMs }) {
  const first = await runDecryptProcess(pythonPath, [scriptPath, sourcePath], timeoutMs);
  if (first.ok) return first;
  if (pythonPath === "python" && first.error?.code === "ENOENT") {
    return await runDecryptProcess("py", ["-3", scriptPath, sourcePath], timeoutMs);
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

export async function resolveReadablePathForDlp(path, { cfg = {}, env = {}, logger = console } = {}) {
  const abs = isAbsolute(path) ? resolve(path) : resolve(env.rootDir ?? process.cwd(), path);
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
  });
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
  return isAbsolute(s) || /^[A-Za-z]:[\\/]/.test(s) || s.includes("\\") || s.includes("/");
}

function existingPathFromString(value, rootDir) {
  if (!looksLikePathString(value)) return null;
  const abs = isAbsolute(value) ? resolve(value) : resolve(rootDir ?? process.cwd(), value);
  return existsSync(abs) ? abs : null;
}

function isOfficecliCommandArg(meta) {
  return String(meta?.toolName ?? "").toLowerCase() === "officecli" && meta?.key === "command";
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
  const tail = String(text).slice(start);
  const hardStop = tail.search(/["'<>|]/);
  const searchable = hardStop >= 0 ? tail.slice(0, hardStop) : tail;
  let best = null;
  const lower = searchable.toLowerCase();
  for (const ext of OFFICE_READABLE_EXTENSIONS) {
    let idx = lower.indexOf(ext);
    while (idx >= 0) {
      const end = idx + ext.length;
      const next = searchable[end] || "";
      if (!next || /[\s),;，。]/.test(next)) {
        const candidate = searchable.slice(0, end).trim().replace(/[),;，。]+$/g, "");
        const abs = existingPathFromString(candidate, rootDir);
        if (abs && (!best || candidate.length > best.raw.length)) {
          best = { raw: candidate, abs };
        }
      }
      idx = lower.indexOf(ext, idx + 1);
    }
  }
  return best;
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
  const drivePath = /[A-Za-z]:[\\/]/g;
  let match;
  let changed = false;
  let cursor = 0;
  let out = "";
  while ((match = drivePath.exec(text)) !== null) {
    const start = match.index;
    if (start < cursor) continue;
    const candidate = findOfficePathCandidate(text, start, options.env?.rootDir);
    if (!candidate) continue;
    const result = await resolveDlpPathToken(candidate.abs, options);
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
  const candidate = existingPathFromString(value, options.env?.rootDir);
  if (!candidate) return { value, changed: false };
  const resolved = await resolveReadablePathForDlp(candidate, {
    cfg: typeof options.readConfig === "function" ? options.readConfig() : {},
    env: options.env,
    logger: options.logger,
  });
  return resolved.encrypted
    ? { value: resolved.path, changed: true }
    : { value, changed: false };
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
        const rewritten = await resolveDlpPathsInArgs(args, options, { toolName: name });
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
