import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, basename, relative, resolve, sep } from "node:path";

const DAY_MS = 86_400_000;
const SIDECARS = [".jsonl", ".events.jsonl", ".pending.json", ".meta.json", ".plan.json"];

function isChildPath(root, path) {
  const rel = relative(root, path);
  return Boolean(rel) && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

export function createSessionTrashStore({
  sessionsDir,
  trashDir,
  sessionPath,
  isValidSessionName,
  readConfig,
  writeConfig,
  onChanged = () => {},
  logger = console,
  defaultRetentionDays = 30,
  now = () => new Date(),
  uuid = randomUUID,
}) {
  if (!sessionsDir || !trashDir || typeof sessionPath !== "function" || typeof isValidSessionName !== "function") {
    throw new TypeError("sessionsDir, trashDir, sessionPath and isValidSessionName are required");
  }

  function retentionDays() {
    const value = Number(readConfig?.().sessionTrashRetentionDays);
    return Number.isFinite(value) ? Math.max(1, Math.min(365, Math.floor(value))) : defaultRetentionDays;
  }

  function getEntry(id) {
    const safeId = String(id || "").trim();
    const dir = resolve(trashDir, safeId);
    if (!safeId || !isChildPath(trashDir, dir) || !existsSync(dir)) return null;
    try {
      const meta = JSON.parse(readFileSync(resolve(dir, "trash-meta.json"), "utf8"));
      const files = Array.isArray(meta.files) ? meta.files.filter((file) => typeof file === "string" && basename(file) === file) : [];
      const paths = files.map((file) => resolve(dir, file)).filter((path) => isChildPath(dir, path) && existsSync(path));
      const movedAt = String(meta.movedAt || "");
      const movedMs = Date.parse(movedAt);
      const totalBytes = paths.reduce((sum, path) => {
        try { return sum + statSync(path).size; } catch { return sum; }
      }, 0);
      return {
        id: safeId,
        name: String(meta.name || safeId),
        movedAt,
        expiresAt: Number.isFinite(movedMs) ? new Date(movedMs + retentionDays() * DAY_MS).toISOString() : null,
        files,
        fileCount: paths.length,
        totalBytes,
        path: paths.find((path) => path.endsWith(".jsonl") && !path.endsWith(".events.jsonl")) || null,
        dir,
      };
    } catch {
      return null;
    }
  }

  function list({ prune = true } = {}) {
    if (prune) pruneExpired();
    if (!existsSync(trashDir)) return [];
    const items = [];
    for (const id of readdirSync(trashDir)) {
      const dir = resolve(trashDir, id);
      if (!isChildPath(trashDir, dir)) continue;
      try {
        if (!statSync(dir).isDirectory()) continue;
        const entry = getEntry(id);
        if (entry) {
          const { path: _path, dir: _dir, ...publicEntry } = entry;
          items.push(publicEntry);
        }
      } catch {}
    }
    return items.sort((a, b) => Date.parse(b.movedAt) - Date.parse(a.movedAt));
  }

  function pruneExpired(timestamp = Date.now()) {
    if (!existsSync(trashDir)) return { deleted: 0 };
    const cutoff = timestamp - retentionDays() * DAY_MS;
    let deleted = 0;
    for (const item of list({ prune: false })) {
      const movedAt = Date.parse(item.movedAt);
      if (!Number.isFinite(movedAt) || movedAt > cutoff) continue;
      const dir = resolve(trashDir, item.id);
      if (!isChildPath(trashDir, dir) || !existsSync(dir)) continue;
      rmSync(dir, { recursive: true, force: true });
      deleted++;
    }
    if (deleted > 0) logger.error?.(`[launcher] expired session trash removed=${deleted}`);
    return { deleted };
  }

  function softDelete(name, runId = "") {
    if (!isValidSessionName(name)) return { ok: false, error: "invalid session name" };
    const jsonl = sessionPath(name);
    if (!existsSync(jsonl)) return { ok: false, error: "not found" };
    const stamp = now().toISOString().replace(/[:.]/g, "-");
    const itemId = createHash("sha256").update(name).digest("hex").slice(0, 10);
    const destinationDir = resolve(trashDir, `${stamp}-${runId || uuid()}-${itemId}`);
    mkdirSync(destinationDir, { recursive: true });
    const moved = [];
    try {
      for (const ext of SIDECARS) {
        const source = ext === ".jsonl" ? jsonl : jsonl.replace(/\.jsonl$/, ext);
        if (!existsSync(source)) continue;
        const target = resolve(destinationDir, basename(source));
        renameSync(source, target);
        moved.push({ source, target });
      }
      const meta = { name, movedAt: now().toISOString(), files: moved.map(({ target }) => basename(target)) };
      writeFileSync(resolve(destinationDir, "trash-meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
      return { ok: true, trashDir: destinationDir, moved: moved.map(({ target }) => target) };
    } catch (error) {
      for (const { source, target } of moved.reverse()) {
        try { if (existsSync(target) && !existsSync(source)) renameSync(target, source); } catch {}
      }
      try { if (existsSync(destinationDir)) rmSync(destinationDir, { recursive: true, force: true }); } catch {}
      return { ok: false, error: error.message, trashDir: destinationDir, moved: [] };
    }
  }

  function trash(names, runId = "manual") {
    const requested = [...new Set((Array.isArray(names) ? names : []).map((name) => String(name).trim()).filter(isValidSessionName))];
    const moved = [];
    const failed = [];
    for (const name of requested) {
      const result = softDelete(name, runId.slice(0, 12));
      if (result.ok) moved.push({ name, trashDir: result.trashDir });
      else failed.push({ name, error: result.error || "move to trash failed" });
    }
    if (moved.length > 0) onChanged({ kind: "sessions-changed", action: "trash", count: moved.length });
    return { ok: failed.length === 0, moved, failed, movedCount: moved.length, failedCount: failed.length };
  }

  function restore(id, requestedName = null) {
    const entry = getEntry(id);
    if (!entry) return { ok: false, error: "trash item not found" };
    try {
      const meta = JSON.parse(readFileSync(resolve(entry.dir, "trash-meta.json"), "utf8"));
      const files = Array.isArray(meta.files) ? meta.files : [];
      const originalName = String(meta.name || entry.id);
      const restoredName = requestedName == null || String(requestedName).trim() === "" ? originalName : String(requestedName).trim();
      if (!isValidSessionName(restoredName)) throw new Error("invalid restored session name");
      mkdirSync(sessionsDir, { recursive: true });
      const targets = [];
      for (const file of files) {
        if (basename(file) !== file) throw new Error("invalid trash filename");
        const restoredFile = file.startsWith(`${originalName}.`) ? `${restoredName}${file.slice(originalName.length)}` : file;
        const destination = resolve(sessionsDir, restoredFile);
        if (!isChildPath(sessionsDir, destination)) throw new Error("invalid restored session path");
        if (existsSync(destination)) throw new Error(`session file already exists: ${file}`);
        targets.push({ source: resolve(entry.dir, file), destination });
      }
      const moved = [];
      try {
        for (const target of targets) {
          renameSync(target.source, target.destination);
          moved.push(target);
        }
      } catch (error) {
        for (const target of moved.reverse()) {
          try { if (existsSync(target.destination) && !existsSync(target.source)) renameSync(target.destination, target.source); } catch {}
        }
        throw error;
      }
      rmSync(entry.dir, { recursive: true, force: true });
      onChanged({ kind: "sessions-changed", action: "restore", name: restoredName });
      return { ok: true, restored: true, name: restoredName };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function remove(ids) {
    const requested = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean))];
    const deleted = [];
    const failed = [];
    for (const id of requested) {
      const entry = getEntry(id);
      if (!entry) { failed.push({ id, error: "trash item not found" }); continue; }
      try { rmSync(entry.dir, { recursive: true, force: true }); deleted.push({ id, name: entry.name }); }
      catch (error) { failed.push({ id, error: error.message }); }
    }
    if (deleted.length > 0) onChanged({ kind: "sessions-changed", action: "trash-delete", count: deleted.length });
    return { ok: failed.length === 0, deleted, failed, deletedCount: deleted.length, failedCount: failed.length };
  }

  function setRetentionDays(days) {
    const value = Number(days);
    if (!Number.isFinite(value) || value < 1 || value > 365) return { ok: false, error: "retentionDays must be between 1 and 365" };
    const config = readConfig?.() ?? {};
    config.sessionTrashRetentionDays = Math.floor(value);
    writeConfig?.(config);
    const pruned = pruneExpired();
    return { ok: true, retentionDays: config.sessionTrashRetentionDays, pruned: pruned.deleted };
  }

  return { delete: remove, getEntry, list, pruneExpired, restore, retentionDays, setRetentionDays, softDelete, trash };
}
