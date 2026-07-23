#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }

// src/memory/session.ts
import { execFileSync } from "child_process";
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "fs";
import { homedir } from "os";
import { dirname, join, posix as posixPath, win32 as win32Path } from "path";
function detectGitBranch(cwd) {
  try {
    const out = execFileSync("git", ["branch", "--show-current"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 800,
      encoding: "utf8"
    }).trim();
    return out || void 0;
  } catch {
    return void 0;
  }
}
function sessionsDir() {
  return join(homedir(), ".visionox", "sessions");
}
function sessionPath(name) {
  return join(sessionsDir(), `${sanitizeName(name)}.jsonl`);
}
function sanitizeName(name) {
  const cleaned = name.replace(/[^\w\-\u4e00-\u9fa5]/g, "_").slice(0, 64);
  return cleaned || "default";
}
function timestampSuffix() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/[^\d]/g, "").slice(0, 12);
}
function freshSessionName(currentName) {
  const base = currentName ? currentName.replace(/-\d{12,14}$/, "") : "default";
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[^\d]/g, "").slice(0, 14);
  return `${base || "default"}-${stamp}`;
}
function findSessionsByPrefix(prefix) {
  const dir = sessionsDir();
  if (!existsSync(dir)) return [];
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl") && !f.endsWith(".events.jsonl") && f.startsWith(prefix)).sort().reverse();
    return files.map((f) => f.replace(/\.jsonl$/, ""));
  } catch {
    return [];
  }
}
function resolveSession(sessionName, forceNew, forceResume) {
  let resolved = sessionName;
  let preview;
  if (sessionName && forceNew) {
    resolved = `${sessionName}-${timestampSuffix()}`;
  } else if (sessionName && !forceResume) {
    let sessionToCheck = sessionName;
    const prefixed = findSessionsByPrefix(`${sessionName}-`);
    if (prefixed.length > 0) {
      sessionToCheck = prefixed[0];
    }
    const prior = loadSessionMessages(sessionToCheck);
    if (prior.length > 0) {
      resolved = sessionToCheck;
      const p = sessionPath(sessionToCheck);
      const mtime = existsSync(p) ? statSync(p).mtime : /* @__PURE__ */ new Date();
      preview = { messageCount: prior.length, lastActive: mtime };
    }
  } else if (sessionName && forceResume) {
    const prefixed = findSessionsByPrefix(`${sessionName}-`);
    if (prefixed.length > 0) {
      resolved = prefixed[0];
    }
  }
  return { resolved, preview };
}
function loadSessionMessages(name) {
  const path = sessionPath(name);
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf8");
    const out = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg && typeof msg === "object" && "role" in msg) out.push(msg);
      } catch {
      }
    }
    return out;
  } catch {
    return [];
  }
}
function appendSessionMessage(name, message) {
  const path = sessionPath(name);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(message)}
`, "utf8");
  try {
    chmodSync(path, 384);
  } catch {
  }
}
function listSessions() {
  const dir = sessionsDir();
  if (!existsSync(dir)) return [];
  try {
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".jsonl") && !f.endsWith(".events.jsonl")
    );
    return files.map((file) => {
      const path = join(dir, file);
      const stat = statSync(path);
      const name = file.replace(/\.jsonl$/, "");
      let meta = loadSessionMeta(name);
      const hasFreshMessageCount = Number.isFinite(meta.messageCount) && meta.messageCountFileSize === stat.size && Number.isFinite(meta.messageCountFileMtimeMs) && meta.messageCountFileMtimeMs === stat.mtimeMs;
      const messageCount = hasFreshMessageCount ? Math.max(0, Math.floor(meta.messageCount)) : countLines(path);
      if (!hasFreshMessageCount) {
        try {
          meta = patchSessionMeta(name, {
            messageCount,
            messageCountFileSize: stat.size,
            messageCountFileMtimeMs: stat.mtimeMs
          });
        } catch {
        }
      }
      return {
        name,
        path,
        size: stat.size,
        messageCount,
        mtime: stat.mtime,
        meta
      };
    }).sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  } catch {
    return [];
  }
}
function normalizeWorkspace(p, platform = process.platform) {
  if (typeof p !== "string" || p.length === 0) return "";
  if (platform === "win32") {
    const resolved = win32Path.resolve(p);
    return resolved.replace(/\\/g, "/").replace(/^([A-Z]):/i, (_, d) => `${d.toLowerCase()}:`);
  }
  return posixPath.resolve(p);
}
function listSessionsForWorkspace(workspace) {
  const want = normalizeWorkspace(workspace);
  return listSessions().filter(
    (s) => typeof s.meta.workspace === "string" && normalizeWorkspace(s.meta.workspace) === want
  );
}
function metaPath(name) {
  return join(sessionsDir(), `${sanitizeName(name)}.meta.json`);
}
function loadSessionMeta(name) {
  const p = metaPath(name);
  if (!existsSync(p)) return {};
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}
function patchSessionMeta(name, patch) {
  const cur = loadSessionMeta(name);
  const next = { ...cur, ...patch };
  const p = metaPath(name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(next), "utf8");
  try {
    chmodSync(p, 384);
  } catch {
  }
  return next;
}
function renameSession(oldName, newName) {
  const safeOld = sanitizeName(oldName);
  const safeNew = sanitizeName(newName);
  if (safeOld === safeNew) return false;
  const oldJsonl = sessionPath(oldName);
  const newJsonl = sessionPath(newName);
  if (!existsSync(oldJsonl) || existsSync(newJsonl)) return false;
  const pairs = [{ source: oldJsonl, target: newJsonl }];
  for (const ext of [".events.jsonl", ".meta.json", ".pending.json", ".plan.json"]) {
    const source = oldJsonl.replace(/\.jsonl$/, ext);
    const target = newJsonl.replace(/\.jsonl$/, ext);
    if (!existsSync(source)) continue;
    if (existsSync(target)) return false;
    pairs.push({ source, target });
  }
  const moved = [];
  try {
    for (const pair of pairs) {
      renameSync(pair.source, pair.target);
      moved.push(pair);
    }
    return true;
  } catch {
    for (const pair of moved.reverse()) {
      try {
        if (existsSync(pair.target) && !existsSync(pair.source)) renameSync(pair.target, pair.source);
      } catch {
        // Preserve the original failure; callers will report the rename as unsuccessful.
      }
    }
    return false;
  }
}
function pruneStaleSessions(daysOld = 90) {
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1e3;
  const deleted = [];
  for (const s of listSessions()) {
    if (s.mtime.getTime() < cutoff) {
      if (deleteSession(s.name)) deleted.push(s.name);
    }
  }
  return deleted;
}
function deleteSession(name) {
  const path = sessionPath(name);
  try {
    unlinkSync(path);
    for (const ext of [".events.jsonl", ".pending.json", ".meta.json", ".plan.json"]) {
      const sidecar = path.replace(/\.jsonl$/, ext);
      try {
        unlinkSync(sidecar);
      } catch {
      }
    }
    return true;
  } catch {
    return false;
  }
}
function atomicWriteSync2(path, body, tmp, mode = 384) {
  try {
    writeFileSync(tmp, body, "utf8");
    try {
      chmodSync(tmp, mode);
    } catch {
    }
    try {
      renameSync(tmp, path);
    } catch (err) {
      if (err.code !== "EXDEV") throw err;
      copyFileSync(tmp, path);
      try {
        chmodSync(path, mode);
      } catch {
      }
    }
  } catch (err2) {
    try {
      unlinkSync(tmp);
    } catch {
    }
    throw err2;
  }
  try {
    unlinkSync(tmp);
  } catch {
  }
}
function rewriteSession(name, messages) {
  const path = sessionPath(name);
  mkdirSync(dirname(path), { recursive: true });
  const body = messages.map((m) => JSON.stringify(m)).join("\n");
  const tmp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  if (existsSync(path) && statSync(path).size > 0) {
    const backup = `${path}.backup`;
    copyFileSync(path, backup);
    try { chmodSync(backup, 384); } catch {}
  }
  atomicWriteSync2(path, body ? `${body}
` : "", tmp);
}
function archiveSession(name) {
  const path = sessionPath(name);
  if (!existsSync(path)) return null;
  try {
    if (statSync(path).size === 0) return null;
  } catch {
    return null;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const target = `${name}__archive_${timestampSuffix()}${attempt > 0 ? `_${attempt}` : ""}`;
    if (renameSession(name, target)) return target;
  }
  return null;
}
function countLines(path) {
  try {
    const raw = readFileSync(path, "utf8");
    return raw.split(/\r?\n/).filter((l) => l.trim()).length;
  } catch {
    return 0;
  }
}

export {
  detectGitBranch,
  sessionsDir,
  sessionPath,
  sanitizeName,
  timestampSuffix,
  freshSessionName,
  resolveSession,
  loadSessionMessages,
  appendSessionMessage,
  listSessions,
  listSessionsForWorkspace,
  loadSessionMeta,
  patchSessionMeta,
  renameSession,
  pruneStaleSessions,
  deleteSession,
  rewriteSession,
  archiveSession
};
//# sourceMappingURL=chunk-6PBZN4VI.js.map
