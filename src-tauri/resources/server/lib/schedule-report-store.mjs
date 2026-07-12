import { createHash } from "node:crypto";
import { existsSync, rmdirSync, rmSync, unlinkSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";

import { atomicWriteFileSync } from "./atomic-file.mjs";

function safeSegment(value, fallback) {
  const input = String(value || "");
  const readable = input.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || fallback;
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 10);
  return `${readable}-${hash}`;
}

function safeFilename(value) {
  const raw = basename(String(value || "report.md")).replace(/[\\/:*?"<>|]/g, "_");
  const extension = extname(raw).toLowerCase() === ".md" ? ".md" : ".md";
  const stem = raw.slice(0, raw.length - extname(raw).length).trim().slice(0, 96) || "report";
  return `${stem}${extension}`;
}

export function createScheduleReportStore(rootDir) {
  const root = resolve(rootDir);

  function taskDir(taskId) {
    return resolve(root, safeSegment(taskId, "task"));
  }

  function isManagedPath(path) {
    if (!path) return false;
    const absolute = resolve(path);
    const relative = absolute.slice(root.length);
    return absolute !== root && (relative.startsWith("\\") || relative.startsWith("/"));
  }

  return {
    isManagedPath,
    write({ taskId, runId, filename, markdown }) {
      if (!taskId || !runId) throw new TypeError("taskId and runId are required");
      if (typeof markdown !== "string" || !markdown.trim()) throw new TypeError("report markdown is required");
      const runPrefix = safeSegment(runId, "run").slice(0, 28);
      const target = resolve(taskDir(taskId), `${runPrefix}-${safeFilename(filename)}`);
      atomicWriteFileSync(target, markdown, "utf8");
      return target;
    },
    removePath(path) {
      if (!isManagedPath(path)) return false;
      const absolute = resolve(path);
      if (!existsSync(absolute)) return false;
      unlinkSync(absolute);
      const parent = dirname(absolute);
      try { rmdirSync(parent); } catch {}
      return true;
    },
    removeTask(taskId) {
      const target = taskDir(taskId);
      if (!existsSync(target)) return false;
      rmSync(target, { recursive: true, force: true });
      return true;
    },
  };
}
