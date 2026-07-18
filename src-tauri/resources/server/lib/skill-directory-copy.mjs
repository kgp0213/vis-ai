import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_SKILL_FILE_LIMIT = 5_000;
export const DEFAULT_SKILL_BYTE_LIMIT = 100 * 1024 * 1024;
export const DEFAULT_SKILL_COPY_TIMEOUT_MS = 120_000;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function targetIsInsideSource(source, target) {
  const rel = relative(source, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function copySkillDirectoryControlled(sourcePath, targetPath, options = {}) {
  const source = resolve(sourcePath);
  const target = resolve(targetPath);
  const maxFiles = positiveInteger(options.maxFiles, DEFAULT_SKILL_FILE_LIMIT);
  const maxBytes = positiveInteger(options.maxBytes, DEFAULT_SKILL_BYTE_LIMIT);

  if (targetIsInsideSource(source, target)) {
    throw new Error("skill copy target must not be inside its source directory");
  }
  if (existsSync(target)) {
    throw new Error(`skill copy target already exists: ${target}`);
  }
  const sourceStat = lstatSync(source);
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
    throw new Error(`skill copy source must be a real directory: ${source}`);
  }

  let files = 0;
  let bytes = 0;
  mkdirSync(dirname(target), { recursive: true });
  mkdirSync(target);

  const walk = (fromDir, toDir) => {
    const entries = readdirSync(fromDir, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const from = resolve(fromDir, entry.name);
      const to = resolve(toDir, entry.name);
      const stat = lstatSync(from);
      if (stat.isSymbolicLink()) {
        throw new Error(`symbolic links are not allowed in Skill directories: ${from}`);
      }
      if (stat.isDirectory()) {
        mkdirSync(to);
        walk(from, to);
        continue;
      }
      if (!stat.isFile()) {
        throw new Error(`unsupported Skill directory entry: ${from}`);
      }
      files += 1;
      bytes += stat.size;
      if (files > maxFiles) {
        throw new Error(`Skill directory contains more than ${maxFiles} files`);
      }
      if (bytes > maxBytes) {
        throw new Error(`Skill directory exceeds ${maxBytes} bytes`);
      }
      copyFileSync(from, to);
    }
  };

  try {
    walk(source, target);
    return { ok: true, files, bytes };
  } catch (error) {
    try { rmSync(target, { recursive: true, force: true }); } catch {}
    throw error;
  }
}

function parseWorkerResult(stdout) {
  const lines = String(stdout ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines.at(-1));
  } catch {
    return null;
  }
}

export function runIsolatedSkillDirectoryCopy(sourcePath, targetPath, options = {}) {
  const workerPath = options.workerPath ?? fileURLToPath(import.meta.url);
  const nodeExecutable = options.nodeExecutable ?? process.execPath;
  const maxFiles = positiveInteger(options.maxFiles, DEFAULT_SKILL_FILE_LIMIT);
  const maxBytes = positiveInteger(options.maxBytes, DEFAULT_SKILL_BYTE_LIMIT);
  const timeout = positiveInteger(options.timeoutMs, DEFAULT_SKILL_COPY_TIMEOUT_MS);
  const result = spawnSync(nodeExecutable, [
    workerPath,
    "--copy-skill-directory",
    resolve(sourcePath),
    resolve(targetPath),
    String(maxFiles),
    String(maxBytes),
  ], {
    encoding: "utf8",
    windowsHide: true,
    timeout,
    maxBuffer: 1024 * 1024,
  });

  if (result.error) {
    return {
      ok: false,
      error: `isolated Skill copy could not run: ${result.error.message}`,
      exitCode: result.status,
      signal: result.signal ?? null,
    };
  }
  const worker = parseWorkerResult(result.stdout);
  if (result.status !== 0 || worker?.ok !== true) {
    const detail = worker?.error || String(result.stderr ?? "").trim().slice(-1000) || "copy worker exited without a result";
    return {
      ok: false,
      error: `isolated Skill copy failed: ${detail}`,
      exitCode: result.status,
      signal: result.signal ?? null,
    };
  }
  return { ...worker, exitCode: result.status, signal: result.signal ?? null };
}

function isWorkerInvocation() {
  if (process.argv[2] !== "--copy-skill-directory" || !process.argv[1]) return false;
  try {
    return pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isWorkerInvocation()) {
  try {
    const result = copySkillDirectoryControlled(process.argv[3], process.argv[4], {
      maxFiles: process.argv[5],
      maxBytes: process.argv[6],
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
    process.exitCode = 1;
  }
}
