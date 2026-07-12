import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const SCHEMA_VERSION = 1;
const HOME_SOURCES = [
  ["config", "config.json"],
  ["soul", "soul.md"],
  ["schedules", "schedules.json"],
  ["sessions", "sessions"],
  ["session-trash", "session-trash"],
  ["memory", "memory"],
  ["memory-trash", "memory-trash"],
  ["soul-history", "soul-history"],
  ["mode-memory", "mode-memory"],
];

function isInside(root, candidate, { allowRoot = false } = {}) {
  const rel = relative(resolve(root), resolve(candidate));
  return (allowRoot && rel === "") || Boolean(rel) && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  if (lstatSync(root).isSymbolicLink()) return [];
  if (statSync(root).isFile()) return [root];
  const files = [];
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) files.push(...walkFiles(path));
    else if (stat.isFile()) files.push(path);
  }
  return files;
}

function directoryStat(path) {
  const files = walkFiles(path);
  return {
    path,
    exists: existsSync(path),
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + statSync(file).size, 0),
  };
}

function writeAtomic(target, content) {
  const temp = `${target}.${randomUUID()}.tmp`;
  mkdirSync(dirname(target), { recursive: true });
  try {
    writeFileSync(temp, content);
    renameSync(temp, target);
  } finally {
    rmSync(temp, { force: true });
  }
}

function parseManifest(path) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(manifest.files)) {
    throw new Error("unsupported backup manifest");
  }
  return manifest;
}

export function createUserDataBackupStore({
  dataDir,
  backupDir,
  getWorkspaceDir = () => null,
  appVersion = "unknown",
  now = () => new Date(),
  clock = () => Date.now(),
  uuid = randomUUID,
} = {}) {
  if (!dataDir) throw new TypeError("dataDir and backupDir are required");
  backupDir ??= join(dataDir, "backups", "snapshots");
  const home = resolve(dataDir);
  const backups = resolve(backupDir);
  if ((backups === home || isInside(home, backups)) && backups !== resolve(home, "backups", "snapshots")) {
    throw new Error("backupDir inside dataDir must be the backups/snapshots directory");
  }
  let healthCache = null;
  let healthCacheAt = 0;

  function sources() {
    const result = HOME_SOURCES.map(([key, path]) => ({ key, root: resolve(home, path), archiveRoot: join("home", path) }));
    const workspace = getWorkspaceDir?.();
    if (workspace) result.push({ key: "knowledge", root: resolve(workspace, "knowledge"), archiveRoot: join("workspace", "knowledge") });
    return result;
  }

  function sourceMap() {
    return new Map(sources().map((source) => [source.key, source]));
  }

  function safeBackupDir(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(String(id || ""))) throw new Error("invalid backup id");
    const path = resolve(backups, String(id));
    if (!isInside(backups, path)) throw new Error("backup path escapes backup directory");
    return path;
  }

  function readBackup(id) {
    const dir = safeBackupDir(id);
    const manifest = parseManifest(join(dir, "manifest.json"));
    if (manifest.id !== id) throw new Error("backup manifest id mismatch");
    return { dir, manifest };
  }

  function list() {
    if (!existsSync(backups)) return [];
    return readdirSync(backups).filter((id) => !id.startsWith(".")).map((id) => {
      try {
        const { manifest } = readBackup(id);
        const { files: _files, ...summary } = manifest;
        return { ...summary, status: "ok" };
      } catch (error) {
        return { id, status: "corrupt", error: error.message };
      }
    }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  function create() {
    mkdirSync(backups, { recursive: true });
    const createdAt = now().toISOString();
    const id = `${createdAt.replace(/[:.]/g, "-")}-${uuid().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8)}`;
    const staging = resolve(backups, `.${id}.staging`);
    const finalDir = safeBackupDir(id);
    const files = [];
    try {
      mkdirSync(staging, { recursive: true });
      for (const source of sources()) {
        for (const input of walkFiles(source.root)) {
          const rel = statSync(source.root).isFile() ? "" : relative(source.root, input);
          const archivePath = rel ? join(source.archiveRoot, rel) : source.archiveRoot;
          const output = resolve(staging, "data", archivePath);
          if (!isInside(resolve(staging, "data"), output)) throw new Error("backup file escapes staging directory");
          const content = readFileSync(input);
          mkdirSync(dirname(output), { recursive: true });
          writeFileSync(output, content);
          files.push({ source: source.key, path: rel.replaceAll("\\", "/"), archivePath: archivePath.replaceAll("\\", "/"), bytes: content.length, sha256: createHash("sha256").update(content).digest("hex") });
        }
      }
      const manifest = { schemaVersion: SCHEMA_VERSION, id, createdAt, appVersion, fileCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), files };
      writeFileSync(join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      renameSync(staging, finalDir);
      healthCache = null;
      return manifest;
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  }

  function inspect(id) {
    const { dir, manifest } = readBackup(id);
    const targets = sourceMap();
    const files = manifest.files.map((entry) => {
      const source = targets.get(entry.source);
      if (!source || typeof entry.path !== "string" || typeof entry.archivePath !== "string") return { ...entry, status: "invalid" };
      const archived = resolve(dir, "data", entry.archivePath);
      const target = entry.path ? resolve(source.root, entry.path) : source.root;
      if (!isInside(resolve(dir, "data"), archived) || !(target === source.root || isInside(source.root, target))) return { ...entry, status: "invalid" };
      if (!existsSync(archived) || sha256(archived) !== entry.sha256) return { ...entry, status: "corrupt" };
      if (!existsSync(target)) return { ...entry, status: "missing" };
      return { ...entry, status: sha256(target) === entry.sha256 ? "same" : "conflict" };
    });
    const counts = Object.fromEntries(["missing", "same", "conflict", "corrupt", "invalid"].map((status) => [status, files.filter((file) => file.status === status).length]));
    return { id, createdAt: manifest.createdAt, fileCount: files.length, counts, files };
  }

  function restore(id, { overwrite = false } = {}) {
    const preview = inspect(id);
    if (preview.counts.corrupt || preview.counts.invalid) throw new Error("backup integrity check failed");
    const { dir } = readBackup(id);
    const targets = sourceMap();
    let restored = 0;
    let skipped = 0;
    for (const entry of preview.files) {
      if (entry.status === "same" || entry.status === "conflict" && !overwrite) {
        skipped++;
        continue;
      }
      const source = targets.get(entry.source);
      const target = entry.path ? resolve(source.root, entry.path) : source.root;
      writeAtomic(target, readFileSync(resolve(dir, "data", entry.archivePath)));
      restored++;
    }
    healthCache = null;
    return { id, restored, skipped, overwrite };
  }

  function health() {
    const timestamp = clock();
    if (healthCache && timestamp - healthCacheAt < 15_000) return healthCache;
    const byKey = Object.fromEntries(sources().map((source) => [source.key, directoryStat(source.root)]));
    const backupItems = list();
    const valid = backupItems.filter((item) => item.status === "ok");
    healthCache = {
      totalBytes: Object.values(byKey).reduce((sum, item) => sum + item.totalBytes, 0),
      sources: byKey,
      backups: { path: backups, count: valid.length, corrupt: backupItems.length - valid.length, latestAt: valid[0]?.createdAt ?? null },
    };
    healthCacheAt = timestamp;
    return healthCache;
  }

  return { list, create, inspect, restore, health };
}
