import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolvePackageSources, packageSourceName } from "./runtime-mirror-policy.mjs";

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function runtimeRequirementsHash(requirement = {}) {
  return `sha256:${createHash("sha256").update(stableJson({
    id: requirement.id ?? null,
    skillId: requirement.skillId ?? null,
    skillVersion: requirement.skillVersion ?? null,
    kind: requirement.kind ?? null,
    versionRange: requirement.versionRange ?? null,
    packages: Array.isArray(requirement.packages) ? requirement.packages.map((pkg) => ({ name: pkg?.name ?? null, version: pkg?.version ?? null, integrity: pkg?.integrity ?? null, importName: pkg?.importName ?? null })) : [],
    healthChecks: Array.isArray(requirement.healthChecks) ? requirement.healthChecks : [],
    lockHash: requirement.lockHash ?? null,
  })).digest("hex")}`;
}

function publicStatus(status, extra = {}) {
  return { status, ...extra };
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
}

async function acquireEnvironmentLock(lockPath, signal = null) {
  await mkdir(join(lockPath, ".."), { recursive: true });
  for (let attempt = 0; attempt < 1_200; attempt += 1) {
    if (signal?.aborted) {
      const error = new Error("runtime installation cancelled");
      error.name = "AbortError";
      throw error;
    }
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
      if (!processIsAlive(Number(owner?.pid)) || ageMs > 30 * 60_000) {
        await rm(lockPath, { recursive: true, force: true });
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const error = new Error("runtime environment is locked by another active process");
  error.code = "RUNTIME_ENVIRONMENT_LOCKED";
  throw error;
}

export function createRuntimeEnvironmentManager({
  rootDir,
  registry,
  now = () => new Date().toISOString(),
  install = null,
  repair = null,
  resolveLocal = null,
  cacheProbe = null,
  healthCheck = async () => true,
  authorizeNetwork = async () => false,
} = {}) {
  if (!rootDir) throw new TypeError("runtime environment rootDir is required");
  if (!registry || typeof registry.upsertEnvironment !== "function") throw new TypeError("runtime environment registry is required");

  function environmentIdFor(requirement, hash) {
    const prefix = String(requirement.kind || "runtime").replace(/[^a-z0-9_-]/giu, "_").slice(0, 24) || "runtime";
    return `${prefix}env_${hash.replace(/^sha256:/u, "").slice(0, 16)}`;
  }

  function resultFromEnvironment(environment, flags = {}) {
    return {
      environmentId: environment?.id ?? null,
      toolId: environment?.baseToolId ?? null,
      kind: environment?.kind ?? null,
      status: environment?.status ?? "degraded",
      selected: environment?.status === "healthy",
      bound: Object.keys(environment?.bindings && typeof environment.bindings === "object" ? environment.bindings : {}).length > 0,
      reused: flags.reused === true,
      repaired: flags.repaired === true,
      installed: flags.installed === true,
      packageSource: environment?.packageSource ?? null,
      requirementsHash: environment?.requirementsHash ?? null,
      bindings: environment?.bindings && typeof environment.bindings === "object" ? structuredClone(environment.bindings) : {},
      packages: Array.isArray(environment?.packages) ? structuredClone(environment.packages) : [],
    };
  }

  const inflight = new Map();

  function replaceRoot(value, from, to) {
    if (typeof value !== "string") return value;
    return value === from || value.startsWith(`${from}\\`) || value.startsWith(`${from}/`)
      ? `${to}${value.slice(from.length)}`
      : value;
  }

  async function ensureCapabilityInternal(requirement = {}, context = {}) {
    if (context.signal?.aborted) return { status: "interrupted", code: "RUNTIME_INSTALL_CANCELLED", requirementId: requirement.id ?? null };
    const hash = runtimeRequirementsHash(requirement);
    const normalized = { ...requirement, requirementsHash: hash };
    const existing = await registry.findEnvironment?.(normalized);
    if (existing?.status === "healthy") {
      if (await healthCheck(existing, normalized, context)) {
        await registry.upsertEnvironment({ ...existing, lastUsedAt: now(), lastVerifiedAt: now() });
        return resultFromEnvironment({ ...existing, lastUsedAt: now(), lastVerifiedAt: now() }, { reused: true });
      }
      await registry.upsertEnvironment({ ...existing, status: "degraded", lastVerifiedAt: now(), metadata: { ...(existing.metadata || {}), healthError: "runtime health check failed" } });
    }

    if (typeof resolveLocal === "function") {
      try {
        const local = await resolveLocal(normalized, context);
        if (local?.status === "healthy" && await healthCheck(local, normalized, context)) {
          const saved = await registry.upsertEnvironment({ ...local, requirementsHash: hash, status: "healthy", lastVerifiedAt: now(), lastUsedAt: now(), metadata: { ...(local.metadata || {}), requirement: normalized } });
          return resultFromEnvironment(saved, { reused: true });
        }
      } catch {
        // Discovery/probing failures must not make a partially verified runtime healthy.
      }
    }

    if (existing && typeof repair === "function" && context.allowNetwork !== true) {
      try {
        const repaired = await repair(existing, normalized, context);
        if (repaired?.status === "healthy" && await healthCheck(repaired, normalized, context)) {
          const saved = await registry.upsertEnvironment({ ...existing, ...repaired, requirementsHash: hash, status: "healthy", lastVerifiedAt: now(), lastUsedAt: now() });
          return resultFromEnvironment(saved, { repaired: true });
        }
      } catch {
        // A failed local repair falls through to an explicit installation decision.
      }
    }

    if (context.allowInstall === false) return publicStatus("unavailable", { code: "RUNTIME_OPTIONAL_CAPABILITY_UNAVAILABLE", requirementsHash: hash, requirementId: requirement.id ?? null, message: "可选运行时能力当前不可用，未请求联网安装授权。" });
    const packageCacheRoot = join(rootDir, "package-cache");
    let useLocalCache = false;
    if (typeof cacheProbe === "function") {
      try { useLocalCache = await cacheProbe(normalized, { ...context, packageCacheRoot }); } catch {}
    }
    const approved = useLocalCache || context.allowNetwork === true || await authorizeNetwork({ requirement: normalized, context });
    if (!approved) return publicStatus("approval_required", { code: "RUNTIME_INSTALL_APPROVAL_REQUIRED", requirementsHash: hash, requirementId: requirement.id ?? null, message: "缺少运行时依赖，需要一次安装授权；安装将优先使用国内镜像，必要时回退官方源。" });
    if (typeof install !== "function") return publicStatus("blocked", { code: "RUNTIME_INSTALLER_UNAVAILABLE", requirementsHash: hash, requirementId: requirement.id ?? null });

    const environmentId = existing?.id ?? environmentIdFor(requirement, hash);
    let releaseEnvironmentLock;
    try {
      releaseEnvironmentLock = await acquireEnvironmentLock(join(rootDir, "locks", `${environmentId}.lock`), context.signal);
    } catch (error) {
      return publicStatus("interrupted", {
        code: error?.name === "AbortError" || context.signal?.aborted ? "RUNTIME_INSTALL_CANCELLED" : error?.code || "RUNTIME_ENVIRONMENT_LOCKED",
        requirementsHash: hash,
        requirementId: requirement.id ?? null,
        error: String(error?.message || error).slice(0, 500),
      });
    }
    try {
      // A second process may have completed this exact environment while we waited.
      await registry.reload?.();
      const concurrent = await registry.findEnvironment?.(normalized);
      if (concurrent?.status === "healthy" && await healthCheck(concurrent, normalized, context)) {
        await registry.upsertEnvironment({ ...concurrent, lastUsedAt: now(), lastVerifiedAt: now() });
        const reused = resultFromEnvironment(concurrent, { reused: true });
        await releaseEnvironmentLock();
        return reused;
      }
    } catch (error) {
      await releaseEnvironmentLock();
      if (error?.name === "AbortError" || context.signal?.aborted) return publicStatus("interrupted", { code: "RUNTIME_INSTALL_CANCELLED", requirementsHash: hash, requirementId: requirement.id ?? null });
      throw error;
    }
    const stagingRoot = join(rootDir, "staging", environmentId);
    const managedRoot = join(rootDir, "environments", environmentId);
    let packageSources = useLocalCache ? [] : resolvePackageSources(requirement.kind, {
      configured: context.packageSources,
      allowOfficialFallback: context.allowOfficialFallback !== false,
      domesticOnly: context.domesticOnly === true,
    });
    const latestExisting = await registry.findEnvironment?.(normalized) ?? existing;
    const installing = await registry.upsertEnvironment({
      ...(latestExisting || {}),
      id: environmentId,
      kind: requirement.kind,
      requirementsHash: hash,
      root: stagingRoot,
      status: "installing",
      packageSource: useLocalCache ? "local-cache" : packageSources[0] ?? null,
      metadata: { packageSources, requirement: normalized },
    });
    try {
      await mkdir(stagingRoot, { recursive: true });
      await mkdir(join(rootDir, "environments"), { recursive: true });
      let installed;
      try {
        installed = await install({ requirement: normalized, stagingRoot, managedRoot, packageSources, context: { ...context, packageCacheRoot, offline: useLocalCache } });
      } catch (cacheError) {
        if (!useLocalCache || context.allowNetwork === true || context.signal?.aborted || cacheError?.name === "AbortError") throw cacheError;
        const networkApproved = await authorizeNetwork({ requirement: normalized, context: { ...context, cacheRepairError: String(cacheError?.message || cacheError).slice(0, 500) } });
        if (!networkApproved) throw cacheError;
        useLocalCache = false;
        packageSources = resolvePackageSources(requirement.kind, {
          configured: context.packageSources,
          allowOfficialFallback: context.allowOfficialFallback !== false,
          domesticOnly: context.domesticOnly === true,
        });
        await rm(stagingRoot, { recursive: true, force: true });
        await mkdir(stagingRoot, { recursive: true });
        installed = await install({ requirement: normalized, stagingRoot, managedRoot, packageSources, context: { ...context, packageCacheRoot, offline: false } });
      }
      const sourceRoot = installed?.stagingRoot ?? stagingRoot;
      if (sourceRoot !== managedRoot) {
        await rm(managedRoot, { recursive: true, force: true });
        await rename(sourceRoot, managedRoot);
      }
      const candidate = {
        ...installing,
        ...(installed || {}),
        id: environmentId,
        requirementsHash: hash,
        status: "healthy",
        root: managedRoot,
        executable: replaceRoot(installed?.executable, sourceRoot, managedRoot),
        scriptsPath: replaceRoot(installed?.scriptsPath, sourceRoot, managedRoot),
        modulePaths: Array.isArray(installed?.modulePaths) ? installed.modulePaths.map((value) => replaceRoot(value, sourceRoot, managedRoot)) : [],
        bindings: Object.fromEntries(Object.entries(installed?.bindings || {}).map(([key, value]) => [key, replaceRoot(value, sourceRoot, managedRoot)])),
        packageSource: packageSourceName(installed?.packageSource ?? packageSources[0]) ?? installed?.packageSource ?? packageSources[0] ?? null,
        lastVerifiedAt: now(),
        lastUsedAt: now(),
      };
      if (!await healthCheck(candidate, normalized, context)) throw new Error("runtime health check failed");
      const saved = await registry.upsertEnvironment(candidate);
      return resultFromEnvironment(saved, { installed: true });
    } catch (error) {
      await registry.upsertEnvironment({ ...installing, status: "interrupted", lastVerifiedAt: now(), metadata: { ...(installing.metadata || {}), error: String(error?.message || error).slice(0, 500) } });
      return publicStatus("interrupted", { code: context.signal?.aborted || error?.name === "AbortError" ? "RUNTIME_INSTALL_CANCELLED" : "RUNTIME_INSTALL_INTERRUPTED", requirementsHash: hash, requirementId: requirement.id ?? null, error: String(error?.message || error).slice(0, 500) });
    } finally {
      await releaseEnvironmentLock();
    }
  }

  function ensureCapability(requirement = {}, context = {}) {
    const hash = runtimeRequirementsHash(requirement);
    const key = `${context.operationId ?? "global"}:${hash}`;
    if (inflight.has(key)) return inflight.get(key);
    const pending = ensureCapabilityInternal(requirement, context).finally(() => {
      if (inflight.get(key) === pending) inflight.delete(key);
    });
    inflight.set(key, pending);
    return pending;
  }

  async function repairCapability(environment, context = {}) {
    const requirement = environment?.metadata?.requirement;
    if (!requirement || typeof requirement !== "object") {
      return { status: "blocked", code: "RUNTIME_REQUIREMENTS_UNKNOWN", environmentId: environment?.id ?? null, message: "该环境缺少可重建的需求记录，请重新调用对应 Skill。" };
    }
    await registry.upsertEnvironment({ ...environment, status: "degraded", lastVerifiedAt: now() });
    return ensureCapability(requirement, context);
  }

  return { ensureCapability, repairCapability, runtimeRequirementsHash };
}
