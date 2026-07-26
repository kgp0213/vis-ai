import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fingerprintFile } from "./source-fingerprint.mjs";

export const RUNTIME_REQUIREMENTS_SCHEMA_VERSION = 1;

function text(value, max = 160) {
  const result = String(value ?? "").trim();
  return result ? result.slice(0, max) : null;
}

function validPackageName(value) {
  return /^(?:@[a-z0-9][a-z0-9._-]{0,63}\/)?[a-z0-9][a-z0-9._-]{0,199}$/iu.test(String(value ?? ""));
}

function validImportName(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/u.test(String(value ?? ""));
}

function validVersionRange(value) {
  return !value || String(value).split(",").every((clause) => /^(?:>=|<=|>|<|=)?\s*\d+(?:\.\d+){0,2}$/u.test(clause.trim()));
}

function normalizeRequirement(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("runtime requirement must be an object");
  const id = text(raw.id, 80);
  const kind = text(raw.kind, 30);
  if (!id || !/^[a-z0-9][a-z0-9_-]{0,79}$/u.test(id)) throw new Error("runtime requirement id is invalid");
  if (!["python", "node"].includes(kind)) throw new Error(`unsupported runtime requirement kind: ${kind}`);
  const versionRange = text(raw.versionRange, 80);
  if (!validVersionRange(versionRange)) throw new Error("runtime requirement versionRange is invalid");
  const rawPackages = Array.isArray(raw.packages) ? raw.packages.slice(0, 128) : [];
  const packages = rawPackages.map((pkg) => ({
    name: text(pkg?.name, 200),
    version: text(pkg?.version, 80),
    integrity: text(pkg?.integrity, 240),
    importName: text(pkg?.importName, 160),
  }));
  if (packages.some((pkg) => !pkg.name || !validPackageName(pkg.name) || (pkg.importName && !validImportName(pkg.importName)))) {
    throw new Error(`runtime requirement ${id} contains an invalid package or import name`);
  }
  const healthChecks = Array.isArray(raw.healthChecks) ? raw.healthChecks.map((item) => text(item, 240)).filter(Boolean).slice(0, 32) : [];
  if (healthChecks.some((item) => !/^import:[A-Za-z_][A-Za-z0-9_.]*$|^require:(?:@[a-z0-9][a-z0-9._-]{0,63}\/)?[a-z0-9][a-z0-9._-]{0,199}$/iu.test(item))) throw new Error(`runtime requirement ${id} contains an invalid health check`);
  return {
    id,
    kind,
    optional: raw.optional === true,
    versionRange,
    lockHash: text(raw.lockHash, 240),
    packages,
    healthChecks,
  };
}

export async function readSkillRuntimeRequirements(skillPath) {
  const path = join(dirname(String(skillPath)), "runtime-requirements.json");
  if (!existsSync(path)) return { schemaVersion: RUNTIME_REQUIREMENTS_SCHEMA_VERSION, requirements: [], path: null };
  const parsed = JSON.parse(await readFile(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || parsed.schemaVersion !== RUNTIME_REQUIREMENTS_SCHEMA_VERSION) throw new Error("unsupported runtime-requirements.json schemaVersion");
  if (!Array.isArray(parsed.requirements)) throw new Error("runtime-requirements.json requirements must be an array");
  return { schemaVersion: RUNTIME_REQUIREMENTS_SCHEMA_VERSION, requirements: parsed.requirements.map(normalizeRequirement), path };
}

function publicRuntimeResult(result) {
  const bindings = result?.bindings && typeof result.bindings === "object" ? result.bindings : {};
  const message = text(result?.message ?? result?.error, 500);
  const code = text(result?.code, 120);
  const category = text(result?.category, 80);
  const title = text(result?.title, 160);
  const action = text(result?.action, 240);
  const recommendedAction = text(result?.recommendedAction, 160);
  return {
    environmentId: result?.environmentId ?? null,
    toolId: result?.toolId ?? null,
    kind: result?.kind ?? null,
    status: result?.status ?? "missing",
    selected: result?.selected === true || result?.status === "healthy",
    bound: result?.bound === true || Object.keys(bindings).length > 0,
    reused: result?.reused === true,
    repaired: result?.repaired === true,
    installed: result?.installed === true,
    packageSource: result?.packageSource ?? null,
    requirementsHash: result?.requirementsHash ?? null,
    ...(code ? { code } : {}),
    ...(category ? { category } : {}),
    ...(title ? { title } : {}),
    ...(message ? { message } : {}),
    ...(action ? { action } : {}),
    ...(recommendedAction ? { recommendedAction } : {}),
    ...(typeof result?.retryable === "boolean" ? { retryable: result.retryable } : {}),
    ...(result?.requirementId ? { requirementId: text(result.requirementId, 120) } : {}),
  };
}

export function createSkillRuntimeCoordinator({ skillStore, resolver, getOperation = () => null, getRuntimeContext = () => ({}), readRequirements = readSkillRuntimeRequirements, packagedRoot = null } = {}) {
  if (!skillStore || typeof skillStore.read !== "function") throw new TypeError("skillStore.read is required");
  if (!resolver || typeof resolver.ensureCapability !== "function") throw new TypeError("runtime resolver is required");

  async function prepare(name, context = {}) {
    const skillName = text(name, 120);
    if (!skillName) return { ok: false, status: "invalid", error: "skill name is required" };
    const skill = skillStore.read(skillName);
    if (!skill) return { ok: false, status: "missing", error: `skill not found: ${skillName}` };
    let skillFingerprint = null;
    try { skillFingerprint = await fingerprintFile(skill.path, { signal: context?.signal }); } catch {}
    let skillSource = "user-custom";
    const skillDir = dirname(String(skill.path ?? ""));
    try {
      const marker = JSON.parse(await readFile(join(skillDir, "_visionox_builtin.json"), "utf8"));
      if (marker?.owner === "visionox-bootstrap") {
        skillSource = "packaged";
        const packagedSkillPath = packagedRoot ? join(String(packagedRoot), skillName, "SKILL.md") : null;
        if (packagedSkillPath && existsSync(packagedSkillPath) && skillFingerprint?.sha256) {
          try {
            const packagedFingerprint = await fingerprintFile(packagedSkillPath, { signal: context?.signal });
            if (packagedFingerprint?.sha256 && packagedFingerprint.sha256 !== skillFingerprint.sha256) skillSource = "stale";
          } catch {}
        }
      }
    } catch {}
    if (skillSource === "user-custom" && packagedRoot && /[\\/]bootstrap-skills[\\/]/iu.test(String(skill.path ?? ""))) skillSource = "packaged";
    const skillInfo = {
      id: skill.name || skillName,
      scope: skill.scope ?? null,
      source: skillSource,
      version: skill.version ?? null,
      fingerprint: skillFingerprint?.sha256 ? `sha256:${skillFingerprint.sha256}` : null,
    };
    let manifest;
    try { manifest = await readRequirements(skill.path); } catch (error) {
      return { ok: false, status: "broken", error: `runtime requirements are invalid: ${error.message}` };
    }
    const operation = getOperation(context) ?? context.operation ?? null;
    const operationContext = operation?.context ?? context.context ?? null;
    const results = [];
    const pendingBindings = {};
    const pendingEnvironments = [];
    for (const declaredRequirement of manifest.requirements) {
      const requirement = {
        ...declaredRequirement,
        skillId: skill.name || skillName,
        skillVersion: skill.version || null,
      };
      const configuredContext = getRuntimeContext(requirement, context) || {};
      const result = await resolver.ensureCapability(requirement, {
        ...configuredContext,
        operationId: operation?.id ?? context.operationId ?? null,
        sessionId: operationContext?.conversationId ?? context.sessionId ?? null,
        workspace: operationContext?.workspace ?? context.workspace ?? null,
        signal: operation?.controller?.signal ?? context.signal ?? null,
        operationKind: operation?.kind ?? context.operationKind ?? null,
        packageSources: configuredContext.packageSources ?? context.packageSources,
        allowInstall: declaredRequirement.optional === true ? false : configuredContext.allowInstall,
      });
      results.push(result);
      if (result?.status !== "healthy") {
        if (declaredRequirement.optional === true) continue;
        return { ok: false, status: result?.status ?? "blocked", skill, skillInfo, requirements: manifest.requirements, results: results.map(publicRuntimeResult), error: result?.message || `runtime capability ${requirement.id} is ${result?.status ?? "unavailable"}` };
      }
      Object.assign(pendingBindings, resolver.bindings?.(result) || {});
      const publicResult = {
        ...publicRuntimeResult(result),
        ...(resolver.publicResult?.(result) || {}),
      };
      pendingEnvironments.push(publicResult);
    }
    if (operationContext) {
      operationContext.runtimeBindings = { ...(operationContext.runtimeBindings || {}), ...pendingBindings };
      const existing = Array.isArray(operationContext.runtimeEnvironments) ? operationContext.runtimeEnvironments : [];
      const pendingIds = new Set(pendingEnvironments.map((item) => item.environmentId).filter(Boolean));
      operationContext.runtimeEnvironments = [
        ...existing.filter((item) => !item.environmentId || !pendingIds.has(item.environmentId)),
        ...pendingEnvironments,
      ];
    }
    return { ok: true, status: "healthy", skill, skillInfo, requirements: manifest.requirements, results: results.map(publicRuntimeResult) };
  }

  function wrapSkillDefinition(definition) {
    if (!definition || typeof definition.fn !== "function") return definition;
    definition.readOnly = false;
    definition.parallelSafe = false;
    const original = definition.fn;
    definition.fn = async (args = {}, ctx = {}) => {
      const prepared = await prepare(args?.name, { ...ctx, operation: getOperation(ctx) });
      if (!prepared.ok) return JSON.stringify({ error: "RUNTIME_CAPABILITY_UNAVAILABLE", status: prepared.status, message: prepared.error, runtimes: prepared.results || [] });
      const result = await original(args, ctx);
      return prepared.results.length > 0 || prepared.skillInfo
        ? `${result}\n<runtime-capabilities>${JSON.stringify(prepared.results)}</runtime-capabilities>\n<skill-runtime>${JSON.stringify({ skill: prepared.skillInfo, requirements: prepared.requirements || [], runtimes: prepared.results })}</skill-runtime>`
        : result;
    };
    return definition;
  }

  return { prepare, wrapSkillDefinition };
}
