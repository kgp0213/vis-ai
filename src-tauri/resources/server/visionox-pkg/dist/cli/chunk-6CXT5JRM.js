#!/usr/bin/env node

// src/memory/session.ts
import { execFileSync } from "child_process";
import {
  appendFileSync,
  chmodSync,
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
import { dirname, join } from "path";
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
      const messageCount = countLines(path);
      return {
        name,
        path,
        size: stat.size,
        messageCount,
        mtime: stat.mtime,
        meta: loadSessionMeta(name)
      };
    }).sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  } catch {
    return [];
  }
}
function listSessionsForWorkspace(workspace) {
  return listSessions().filter((s) => s.meta.workspace === workspace);
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
  renameSync(oldJsonl, newJsonl);
  for (const ext of [".events.jsonl", ".meta.json", ".pending.json", ".plan.json"]) {
    const oldP = oldJsonl.replace(/\.jsonl$/, ext);
    const newP = newJsonl.replace(/\.jsonl$/, ext);
    if (existsSync(oldP)) {
      try {
        renameSync(oldP, newP);
      } catch {
      }
    }
  }
  return true;
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
function rewriteSession(name, messages) {
  const path = sessionPath(name);
  mkdirSync(dirname(path), { recursive: true });
  const body = messages.map((m) => JSON.stringify(m)).join("\n");
  writeFileSync(path, body ? `${body}
` : "", "utf8");
  try {
    chmodSync(path, 384);
  } catch {
  }
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
//# sourceMappingURL=chunk-6CXT5JRM.js.map