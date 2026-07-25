import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { atomicWriteFile } from "./atomic-file.mjs";

export const RUNTIME_REGISTRY_SCHEMA_VERSION = 1;
export const RUNTIME_ENVIRONMENT_SIDECAR = "runtime-environment.json";
export const RUNTIME_STATUSES = new Set([
  "discovering",
  "installing",
  "healthy",
  "degraded",
  "broken",
  "missing",
  "interrupted",
]);

const locks = new Map();

function safeText(value, max = 500) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

function normalizeStatus(value, fallback = "degraded") {
  const status = String(value ?? "").trim();
  return RUNTIME_STATUSES.has(status) ? status : fallback;
}

function normalizeRecord(record = {}, kind) {
  const source = record && typeof record === "object" ? record : {};
  const id = safeText(source.id, 180);
  if (!id) throw new TypeError(`${kind} record id is required`);
  if (kind === "tool") {
    return {
      id,
      kind: safeText(source.kind, 40) || "unknown",
      executable: safeText(source.executable, 1_000),
      root: safeText(source.root, 1_000),
      version: safeText(source.version, 80),
      architecture: safeText(source.architecture, 40),
      source: safeText(source.source, 120) || "discovered",
      fingerprint: safeText(source.fingerprint, 240),
      status: normalizeStatus(source.status),
      lastVerifiedAt: safeText(source.lastVerifiedAt, 80),
      metadata: source.metadata && typeof source.metadata === "object" ? structuredClone(source.metadata) : {},
    };
  }
  return {
    id,
    kind: safeText(source.kind, 40) || "unknown",
    baseToolId: safeText(source.baseToolId, 180),
    root: safeText(source.root, 1_000),
    executable: safeText(source.executable, 1_000),
    scriptsPath: safeText(source.scriptsPath, 1_000),
    modulePaths: Array.isArray(source.modulePaths) ? source.modulePaths.map((item) => safeText(item, 1_000)).filter(Boolean).slice(0, 32) : [],
    packages: Array.isArray(source.packages) ? source.packages.slice(0, 500).map((pkg) => ({
      name: safeText(pkg?.name, 200),
      version: safeText(pkg?.version, 80),
      integrity: safeText(pkg?.integrity, 240),
    })).filter((pkg) => pkg.name) : [],
    lockHash: safeText(source.lockHash, 240),
    requirementsHash: safeText(source.requirementsHash, 240),
    fingerprint: safeText(source.fingerprint, 240),
    status: normalizeStatus(source.status),
    lastUsedAt: safeText(source.lastUsedAt, 80),
    lastVerifiedAt: safeText(source.lastVerifiedAt, 80),
    packageSource: safeText(source.packageSource, 300),
    bindings: source.bindings && typeof source.bindings === "object" ? Object.fromEntries(Object.entries(source.bindings).map(([key, value]) => [safeText(key, 80), safeText(value, 1_000)]).filter(([key, value]) => key && value)) : {},
    metadata: source.metadata && typeof source.metadata === "object" ? structuredClone(source.metadata) : {},
  };
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("runtime registry root must be an object");
  if (Number(value.schemaVersion) > RUNTIME_REGISTRY_SCHEMA_VERSION) throw new Error(`unsupported runtime registry schema: ${value.schemaVersion}`);
  return {
    schemaVersion: RUNTIME_REGISTRY_SCHEMA_VERSION,
    updatedAt: safeText(value.updatedAt, 80),
    tools: Array.isArray(value.tools) ? value.tools.map((item) => normalizeRecord(item, "tool")) : [],
    environments: Array.isArray(value.environments) ? value.environments.map((item) => normalizeRecord(item, "environment")) : [],
  };
}

async function withProcessLock(lockPath, task) {
  const previous = locks.get(lockPath) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  locks.set(lockPath, tail);
  await previous;
  let releaseFileLock = null;
  try {
    releaseFileLock = await acquireFileLock(lockPath);
    return await task();
  } finally {
    await releaseFileLock?.();
    release();
    if (locks.get(lockPath) === tail) locks.delete(lockPath);
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
}

async function acquireFileLock(lockPath) {
  await mkdir(dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await mkdir(lockPath);
      await writeFile(join(lockPath, "owner.json"), JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }), "utf8");
      return async () => { await rm(lockPath, { recursive: true, force: true }); };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let owner = null;
      let ageMs = Infinity;
      try { owner = JSON.parse(await readFile(join(lockPath, "owner.json"), "utf8")); } catch {}
      try { ageMs = Date.now() - (await stat(lockPath)).mtimeMs; } catch {}
      if (!processIsAlive(Number(owner?.pid)) || ageMs > 120_000) {
        await rm(lockPath, { recursive: true, force: true });
        continue;
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
    }
  }
  const error = new Error("runtime registry is locked by another active process");
  error.code = "RUNTIME_REGISTRY_LOCKED";
  throw error;
}

export function createRuntimeToolRegistry({ rootDir = join(homedir(), ".visionox", "runtime"), now = () => new Date().toISOString() } = {}) {
  const registryPath = join(rootDir, "tool-registry.json");
  const lockPath = join(rootDir, "locks", "tool-registry.lock");
  const environmentsRoot = resolve(rootDir, "environments");
  let snapshot = { schemaVersion: RUNTIME_REGISTRY_SCHEMA_VERSION, updatedAt: null, tools: [], environments: [] };
  let opened = false;

  async function backupCorruptFile() {
    try {
      await stat(registryPath);
      const backup = `${registryPath}.corrupt-${Date.now()}-${randomUUID()}`;
      await rename(registryPath, backup);
      return backup;
    } catch { return null; }
  }

  function managedEnvironmentRoot(environment) {
    if (!environment?.root) return null;
    const candidate = resolve(environment.root);
    const rel = relative(environmentsRoot, candidate);
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || rel.includes("/") || rel.includes("\\")) return null;
    return candidate;
  }

  async function recoverEnvironmentSidecars() {
    const recovered = [];
    let entries = [];
    try { entries = await readdir(environmentsRoot, { withFileTypes: true }); } catch { return recovered; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const environmentRoot = resolve(environmentsRoot, entry.name);
      try {
        const record = normalizeRecord(JSON.parse(await readFile(join(environmentRoot, RUNTIME_ENVIRONMENT_SIDECAR), "utf8")), "environment");
        recovered.push({ ...record, root: environmentRoot, status: record.status === "installing" ? "interrupted" : record.status });
      } catch {
        // A malformed sidecar is isolated to its environment and is not trusted.
      }
    }
    return recovered;
  }

  async function persistEnvironmentSidecars() {
    for (const environment of snapshot.environments) {
      const environmentRoot = managedEnvironmentRoot(environment);
      if (!environmentRoot || environment.status === "installing") continue;
      try {
        if (!(await stat(environmentRoot)).isDirectory()) continue;
        await atomicWriteFile(join(environmentRoot, RUNTIME_ENVIRONMENT_SIDECAR), `${JSON.stringify(environment, null, 2)}\n`, "utf8");
      } catch {
        // The central registry remains authoritative while a missing environment is repaired.
      }
    }
  }

  async function persist() {
    snapshot.updatedAt = now();
    await mkdir(dirname(registryPath), { recursive: true });
    await mkdir(join(rootDir, "environments"), { recursive: true });
    await mkdir(join(rootDir, "staging"), { recursive: true });
    await mkdir(join(rootDir, "package-cache"), { recursive: true });
    await mkdir(join(rootDir, "locks"), { recursive: true });
    await atomicWriteFile(registryPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await persistEnvironmentSidecars();
    return structuredClone(snapshot);
  }

  async function open() {
    if (opened) return structuredClone(snapshot);
    await mkdir(rootDir, { recursive: true });
    let corruptBackup = null;
    try {
      snapshot = normalizeSnapshot(JSON.parse(await readFile(registryPath, "utf8")));
      let recoveredInterrupted = false;
      snapshot.environments = snapshot.environments.map((environment) => {
        if (environment.status !== "installing") return environment;
        recoveredInterrupted = true;
        return { ...environment, status: "interrupted", metadata: { ...(environment.metadata || {}), interruptedReason: "previous process exited during installation" } };
      });
      if (recoveredInterrupted) await persist();
    } catch (error) {
      if (error?.code !== "ENOENT") corruptBackup = await backupCorruptFile();
      snapshot = { schemaVersion: RUNTIME_REGISTRY_SCHEMA_VERSION, updatedAt: null, tools: [], environments: await recoverEnvironmentSidecars() };
      await persist();
    }
    opened = true;
    return { ...structuredClone(snapshot), corruptBackup };
  }

  async function mutate(mutator) {
    if (!opened) await open();
    return withProcessLock(lockPath, async () => {
      try { snapshot = normalizeSnapshot(JSON.parse(await readFile(registryPath, "utf8"))); } catch {}
      const value = await mutator(snapshot);
      await persist();
      return structuredClone(value ?? snapshot);
    });
  }

  async function reload() {
    try { snapshot = normalizeSnapshot(JSON.parse(await readFile(registryPath, "utf8"))); } catch {}
    opened = true;
    return structuredClone(snapshot);
  }

  const find = (items, id) => items.find((item) => item.id === String(id ?? "").trim()) ?? null;
  const upsert = (items, value, kind) => {
    const record = normalizeRecord(value, kind);
    const index = items.findIndex((item) => item.id === record.id);
    if (index >= 0) items[index] = { ...items[index], ...record };
    else items.push(record);
    return items[index >= 0 ? index : items.length - 1];
  };

  return {
    rootDir,
    registryPath,
    open,
    reload,
    snapshot: () => structuredClone(snapshot),
    listTools: () => structuredClone(snapshot.tools),
    listEnvironments: () => structuredClone(snapshot.environments),
    getTool: (id) => structuredClone(find(snapshot.tools, id)),
    getEnvironment: (id) => structuredClone(find(snapshot.environments, id)),
    findEnvironment: (requirement = {}) => {
      const requirementsHash = safeText(requirement.requirementsHash, 240);
      const kind = safeText(requirement.kind, 40);
      const packages = Array.isArray(requirement.packages) ? requirement.packages : [];
      return structuredClone(snapshot.environments.find((env) => env.status === "healthy"
        && (!kind || env.kind === kind)
        && (!requirementsHash || env.requirementsHash === requirementsHash)
        && packages.every((wanted) => env.packages.some((actual) => actual.name === wanted.name && (!wanted.version || wanted.version === actual.version)))) ?? null);
    },
    findAnyEnvironment: (requirement = {}) => {
      const kind = safeText(requirement.kind, 40);
      return structuredClone(snapshot.environments.find((env) => (!kind || env.kind === kind) && env.status !== "missing") ?? null);
    },
    upsertTool: (value) => mutate((state) => upsert(state.tools, value, "tool")),
    upsertEnvironment: (value) => mutate((state) => upsert(state.environments, value, "environment")),
    repairToolPath: (id, executable, patch = {}) => mutate((state) => {
      const current = find(state.tools, id);
      if (!current) throw new Error(`runtime tool not found: ${id}`);
      return upsert(state.tools, { ...current, ...patch, id, executable }, "tool");
    }),
    removeEnvironment: async (id) => {
      const current = find(snapshot.environments, id);
      const removed = await mutate((state) => {
        state.environments = state.environments.filter((item) => item.id !== String(id ?? ""));
        return true;
      });
      const environmentRoot = managedEnvironmentRoot(current);
      if (environmentRoot) await rm(join(environmentRoot, RUNTIME_ENVIRONMENT_SIDECAR), { force: true });
      return removed;
    },
    persist,
  };
}
