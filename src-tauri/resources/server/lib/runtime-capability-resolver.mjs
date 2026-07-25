import { createRuntimeEnvironmentManager, runtimeRequirementsHash } from "./runtime-environment-manager.mjs";

function publicTool(tool) {
  if (!tool) return null;
  return {
    id: tool.id,
    kind: tool.kind,
    version: tool.version ?? null,
    architecture: tool.architecture ?? null,
    source: tool.source ?? null,
    status: tool.status ?? "degraded",
    lastVerifiedAt: tool.lastVerifiedAt ?? null,
  };
}

function publicEnvironment(environment) {
  if (!environment) return null;
  return {
    environmentId: environment.id ?? environment.environmentId ?? null,
    toolId: environment.baseToolId ?? environment.toolId ?? null,
    kind: environment.kind ?? null,
    status: environment.status ?? "degraded",
    reused: environment.reused === true,
    repaired: environment.repaired === true,
    installed: environment.installed === true,
    packageSource: environment.packageSource ?? null,
    requirementsHash: environment.requirementsHash ?? null,
    packages: Array.isArray(environment.packages) ? structuredClone(environment.packages) : [],
  };
}

export function createRuntimeCapabilityResolver({ registry, discovery, environments, now = () => new Date().toISOString() } = {}) {
  if (!registry || !discovery || !environments) throw new TypeError("runtime capability resolver dependencies are required");

  async function discoverRuntime({ force = false } = {}) {
    if (typeof registry.open === "function") await registry.open();
    if (!force && registry.listTools?.().length > 0) return registry.listTools();
    // Snapshot before upserting: registry test doubles and some persistence
    // adapters expose a live array, so enumerating after upsert can grow it.
    const previousTools = [...(registry.listTools?.() ?? [])];
    const tools = await discovery.discover({ force });
    for (const tool of tools) await registry.upsertTool(tool);
    const discoveredIds = new Set(tools.map((tool) => tool.id));
    for (const previous of previousTools) {
      if (previous.source === "launcher-process" || discoveredIds.has(previous.id)) continue;
      await registry.upsertTool({ ...previous, status: "missing", lastVerifiedAt: now() });
    }
    return registry.listTools?.() ?? tools;
  }

  async function resolveCapability(requirement = {}, context = {}) {
    const hash = runtimeRequirementsHash(requirement);
    const environment = registry.findEnvironment?.({ ...requirement, requirementsHash: hash });
    if (environment?.status === "healthy") return { ...environment, environmentId: environment.id, requirementsHash: hash, status: "healthy", reused: true };
    return { status: "missing", requirementsHash: hash, requirementId: requirement.id ?? null };
  }

  async function ensureCapability(requirement = {}, context = {}) {
    const result = await environments.ensureCapability(requirement, context);
    return { ...result, checkedAt: now() };
  }

  async function repairCapability(runtimeId, context = {}) {
    const environment = registry.getEnvironment?.(runtimeId);
    if (!environment) {
      const existingTool = registry.getTool?.(runtimeId);
      if (!existingTool) return { status: "missing", code: "RUNTIME_NOT_FOUND", runtimeId };
      await discoverRuntime({ force: true });
      const repairedTool = registry.getTool?.(runtimeId);
      return repairedTool ? publicTool(repairedTool) : { status: "missing", code: "RUNTIME_NOT_FOUND", runtimeId };
    }
    if (typeof environments.repairCapability === "function") return environments.repairCapability(environment, context);
    return { status: "degraded", code: "RUNTIME_REPAIR_UNAVAILABLE", runtimeId };
  }

  function listCapabilities() {
    return {
      tools: (registry.listTools?.() ?? []).map(publicTool),
      environments: (registry.listEnvironments?.() ?? []).map(publicEnvironment),
    };
  }

  function publicResult(result) {
    if (!result?.environmentId && !result?.id && !result?.toolId && result?.code) {
      return { status: result.status ?? "missing", code: result.code, message: result.message ?? null, requirementsHash: result.requirementsHash ?? null };
    }
    const value = publicEnvironment(result);
    return value || { status: result?.status ?? "missing", code: result?.code ?? null, requirementsHash: result?.requirementsHash ?? null };
  }

  function bindings(result) {
    return result?.bindings && typeof result.bindings === "object" ? structuredClone(result.bindings) : {};
  }

  return { discoverRuntime, resolveCapability, ensureCapability, repairCapability, listCapabilities, publicResult, bindings };
}

export { publicEnvironment };
