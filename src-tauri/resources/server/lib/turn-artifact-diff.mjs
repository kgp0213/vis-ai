/**
 * Turn-scoped directory snapshot diff for artifact tracking.
 *
 * Tools such as run_command can create deliverable files whose paths never
 * appear in the command string or in the tool output, so the per-tool artifact
 * extraction in the launcher cannot see them. This module watches the
 * directories a turn touches: it snapshots a bounded candidate set (seeded at
 * turn start and extended as tool events stream by) and diffs the same
 * directories when the turn settles. New or changed regular files become
 * artifact candidates for the launcher to register through its normal
 * evidence pipeline.
 *
 * Everything here is deliberately side-effect free except read-only fs scans;
 * the launcher owns receipt recording, verification status, and dedupe.
 */
import { readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

export const TURN_DIRECTORY_SCAN_LIMITS = Object.freeze({
  maxDirectories: 8,
  maxDepth: 3,
  maxEntriesPerDirectory: 2000,
});

export const TURN_DIRECTORY_SCAN_SKIPPED_DIR_NAMES = Object.freeze(new Set([
  "node_modules", ".git", ".hg", ".svn", "vendor", "dist", "build", "target",
  "__pycache__", ".next", ".nuxt", ".cache", "coverage", ".idea", ".vscode",
]));

export const TURN_DIRECTORY_SCAN_SKIPPED_EXTENSIONS = Object.freeze(new Set([
  ".tmp", ".temp", ".lock", ".part", ".crdownload", ".download", ".swp", ".swo", ".bak",
]));

const MAX_CANDIDATE_PATH_LENGTH = 500;
const FILE_EXTENSION_RE = /^\.[a-z0-9]{1,8}$/i;
const WINDOWS_ABSOLUTE_RE = /^[A-Za-z]:[\\/]/;

export function normalizeTurnScanKey(value) {
  const path = String(value ?? "");
  return process.platform === "win32" ? path.toLowerCase() : path;
}

function defaultIsDirectory(abs) {
  try {
    return statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

function parseMaybeJson(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Read-only recursive listing of a directory. Returns a Map of
 * normalizeTurnScanKey(path) -> { path, size, mtimeMs } for non-empty regular
 * files, or { skipped: true, reason } when the directory exceeds the entry
 * bound — a partial listing cannot be diffed reliably, so the whole directory
 * is skipped and the caller records a diagnostic.
 */
export function snapshotDirectoryEntries(rootDir, {
  maxDepth = TURN_DIRECTORY_SCAN_LIMITS.maxDepth,
  maxEntriesPerDirectory = TURN_DIRECTORY_SCAN_LIMITS.maxEntriesPerDirectory,
  skippedDirNames = TURN_DIRECTORY_SCAN_SKIPPED_DIR_NAMES,
  skippedExtensions = TURN_DIRECTORY_SCAN_SKIPPED_EXTENSIONS,
} = {}) {
  const entries = new Map();
  let overflow = false;
  const stack = [{ dir: String(rootDir ?? ""), depth: 0 }];
  while (stack.length > 0 && !overflow) {
    const { dir, depth } = stack.pop();
    let children;
    try {
      children = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      const abs = join(dir, child.name);
      if (child.isDirectory()) {
        if (skippedDirNames.has(child.name.toLowerCase())) continue;
        if (depth + 1 < maxDepth) stack.push({ dir: abs, depth: depth + 1 });
        continue;
      }
      if (!child.isFile()) continue;
      if (skippedExtensions.has(extname(child.name).toLowerCase())) continue;
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (!st.isFile() || st.size <= 0) continue;
      if (entries.size >= maxEntriesPerDirectory) {
        overflow = true;
        break;
      }
      entries.set(normalizeTurnScanKey(abs), { path: abs, size: st.size, mtimeMs: st.mtimeMs });
    }
  }
  if (overflow) {
    return { entries: null, skipped: true, reason: `more than ${maxEntriesPerDirectory} entries within depth ${maxDepth}` };
  }
  return { entries, skipped: false, reason: null };
}

/**
 * Files that are new or changed relative to the baseline, using the same
 * semantics as the launcher's per-tool baseline check: baseline missing, or
 * newer mtime, or different size.
 */
export function diffDirectoryEntries(baselineEntries, currentEntries) {
  const changed = [];
  for (const [key, current] of currentEntries ?? []) {
    const baseline = baselineEntries?.get(key) ?? null;
    if (!baseline || current.mtimeMs > baseline.mtimeMs || current.size !== baseline.size) {
      changed.push({ path: current.path, size: current.size, mtimeMs: current.mtimeMs });
    }
  }
  return changed;
}

function normalizeCandidateDirToken(token) {
  let value = String(token ?? "").trim();
  value = value.replace(/^[({<"'“”‘’]+/u, "").replace(/[.,;:：，。；、)）\]>}"'“”‘’]+$/u, "").trim();
  if (!value || value.length > MAX_CANDIDATE_PATH_LENGTH || value.includes("://")) return null;
  return value;
}

/**
 * Extract directory candidates from a shell command string. Any token that
 * looks like a path contributes: tokens with a file extension contribute their
 * dirname; extension-less tokens contribute themselves when they exist as a
 * directory. The command's own outputs are intentionally not required to
 * appear in the string — referencing the directory is enough.
 */
export function directoryCandidatesFromCommand(command, { workspaceDir = process.cwd(), isDirectory = defaultIsDirectory } = {}) {
  const value = String(command ?? "");
  if (!value.trim()) return [];
  const candidates = [];
  const seen = new Set();
  const add = (dir) => {
    const key = normalizeTurnScanKey(dir);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(dir);
  };
  for (const match of value.matchAll(/"([^"]+)"|'([^']+)'|([^\s"']+)/gu)) {
    const token = normalizeCandidateDirToken(match[1] ?? match[2] ?? match[3]);
    if (!token) continue;
    const isWindowsAbs = WINDOWS_ABSOLUTE_RE.test(token);
    const isPosixAbs = token.startsWith("/") && !WINDOWS_ABSOLUTE_RE.test(token);
    const isUnc = token.startsWith("\\\\");
    const hasSeparator = /[\\/]/u.test(token);
    const ext = extname(token).toLowerCase();
    const hasFileExtension = FILE_EXTENSION_RE.test(ext);
    if (!isWindowsAbs && !isPosixAbs && !isUnc) {
      if (token.startsWith("-") || token.includes("=")) continue;
      if (!hasSeparator && !hasFileExtension) {
        // A bare word can still be a relative directory argument
        // (`python convert.py mipi`); probe it, but never trust it blindly.
        try {
          const abs = resolve(workspaceDir, token);
          if (isDirectory(abs)) add(abs);
        } catch {}
        continue;
      }
    }
    const cleaned = token.replace(/[\\/]+$/u, "");
    // Never snapshot a filesystem root or a bare drive root.
    if (!cleaned || cleaned === "/" || /^[A-Za-z]:$/u.test(cleaned) || cleaned === "\\\\") continue;
    let abs;
    try {
      abs = resolve(workspaceDir, cleaned);
    } catch {
      continue;
    }
    if (hasFileExtension) add(dirname(abs));
    else if (isDirectory(abs)) add(abs);
  }
  return candidates;
}

const DIRECTORY_ARG_TOOLS = /^(?:list_directory|list_files|read_directory|search_files|create_directory)$/i;
const FILE_PATH_ARG_KEYS = ["path", "filePath", "file_path", "filename", "source", "sourcePath"];

/**
 * Directory candidates from a single tool event. `args` may be an object or
 * the raw JSON string carried by the event stream; `result` is only consulted
 * for prepare_local_document's readableDirectory (available at completion).
 */
export function directoryCandidatesFromToolEvent({ toolName, args, result } = {}, { workspaceDir = process.cwd(), isDirectory = defaultIsDirectory } = {}) {
  const parsed = parseMaybeJson(args);
  const name = String(toolName ?? "");
  const candidates = [];
  const seen = new Set();
  const add = (dir) => {
    const key = normalizeTurnScanKey(dir);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(dir);
  };
  const addExistingDirOrDirname = (raw) => {
    const value = normalizeCandidateDirToken(raw);
    if (!value) return;
    let abs;
    try {
      abs = resolve(workspaceDir, value);
    } catch {
      return;
    }
    add(isDirectory(abs) ? abs : dirname(abs));
  };
  if (/^(?:run_command|run_background)$/i.test(name)) {
    for (const dir of directoryCandidatesFromCommand(parsed.command, { workspaceDir, isDirectory })) add(dir);
  }
  for (const key of FILE_PATH_ARG_KEYS) {
    if (typeof parsed[key] !== "string") continue;
    if (DIRECTORY_ARG_TOOLS.test(name)) addExistingDirOrDirname(parsed[key]);
    else {
      const value = normalizeCandidateDirToken(parsed[key]);
      if (!value) continue;
      try {
        add(dirname(resolve(workspaceDir, value)));
      } catch {}
    }
  }
  if (/^multi_edit$/i.test(name) && Array.isArray(parsed.edits)) {
    for (const edit of parsed.edits) {
      if (typeof edit?.path !== "string") continue;
      const value = normalizeCandidateDirToken(edit.path);
      if (!value) continue;
      try {
        add(dirname(resolve(workspaceDir, value)));
      } catch {}
    }
  }
  if (/^prepare_local_document$/i.test(name)) {
    const parsedResult = parseMaybeJson(result);
    const readableDirs = [parsedResult.readableDirectory];
    if (Array.isArray(parsedResult.sources)) {
      for (const source of parsedResult.sources) readableDirs.push(source?.readableDirectory);
    }
    for (const raw of readableDirs) {
      if (typeof raw !== "string") continue;
      const value = normalizeCandidateDirToken(raw);
      if (!value) continue;
      try {
        add(resolve(workspaceDir, value));
      } catch {}
    }
  }
  return candidates;
}

/**
 * Turn-scoped scan coordinator. Candidate directories are collected as they
 * appear (turn start seeds, then every tool event); the baseline for a
 * directory is captured the first time it is noted, so directories discovered
 * at tool_start are diffed against their pre-execution state. Directories
 * beyond the bound, or directories too large to snapshot, are skipped with a
 * diagnostic instead of being partially tracked.
 */
export function createTurnDirectoryScan({ workspaceDir = process.cwd(), limits = {}, isDirectory = defaultIsDirectory } = {}) {
  const mergedLimits = { ...TURN_DIRECTORY_SCAN_LIMITS, ...(limits && typeof limits === "object" ? limits : {}) };
  const directories = new Map();
  let diagnostics = [];
  const noteDirectory = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return false;
    let abs;
    try {
      abs = resolve(workspaceDir, raw);
    } catch {
      return false;
    }
    const key = normalizeTurnScanKey(abs);
    if (directories.has(key)) return true;
    if (directories.size >= mergedLimits.maxDirectories) {
      diagnostics.push({ kind: "directory-limit", dir: abs, detail: `a turn tracks at most ${mergedLimits.maxDirectories} directories` });
      return false;
    }
    const baseline = snapshotDirectoryEntries(abs, mergedLimits);
    if (baseline.skipped) {
      diagnostics.push({ kind: "entry-limit", dir: abs, detail: baseline.reason });
      return false;
    }
    directories.set(key, { dir: abs, baseline: baseline.entries });
    return true;
  };
  const noteToolEvent = (event = {}) => {
    for (const candidate of directoryCandidatesFromToolEvent(event, { workspaceDir, isDirectory })) {
      noteDirectory(candidate);
    }
  };
  const scanChanged = () => {
    const changed = [];
    const seen = new Set();
    for (const [key, tracked] of directories) {
      const current = snapshotDirectoryEntries(tracked.dir, mergedLimits);
      if (current.skipped) {
        diagnostics.push({ kind: "entry-limit", dir: tracked.dir, detail: current.reason });
        directories.delete(key);
        continue;
      }
      // Candidate directories may overlap (a parent and its child); each file
      // is reported once, decided by the first tracked baseline that saw it.
      for (const entry of diffDirectoryEntries(tracked.baseline, current.entries)) {
        const entryKey = normalizeTurnScanKey(entry.path);
        if (seen.has(entryKey)) continue;
        seen.add(entryKey);
        changed.push(entry);
      }
    }
    return { changed, diagnostics: [...diagnostics] };
  };
  const drainDiagnostics = () => {
    const drained = diagnostics;
    diagnostics = [];
    return drained;
  };
  return {
    noteDirectory,
    noteToolEvent,
    scanChanged,
    drainDiagnostics,
    trackedDirectories: () => [...directories.values()].map((tracked) => tracked.dir),
  };
}
