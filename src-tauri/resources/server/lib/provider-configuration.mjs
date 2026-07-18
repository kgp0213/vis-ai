import { validateAgentPolicy, validateModelCapabilities, validateRequestDefaults, validateVisionPolicy } from "./model-request-policy.mjs";

const PROVIDER_CHANGE_FIELDS = new Set([
  "name", "baseUrl", "apiKey", "requestPolicy", "requestDefaults",
  "defaultPreset", "defaultEffort", "autoEscalate", "escalationModel",
]);
const MODEL_CHANGE_FIELDS = new Set([
  "id", "name", "presets", "efforts", "thinkingMode", "multimodal",
  "maxContextLength", "capabilities", "requestDefaults", "verificationRequestDefaults", "agentPolicy", "visionPolicy", "disabled",
]);
const V3_OPERATIONS = new Set([
  "updateProvider", "removeProvider", "upsertModel", "updateModel", "disableModel", "removeModel", "syncModels",
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function stableModelKey(model) {
  return String(model?.key || model?.id || "").trim();
}

function findProvider(config, providerId) {
  const provider = config.providers?.find((item) => item.id === providerId);
  if (!provider) throw new Error(`provider "${providerId}" not found`);
  return provider;
}

function findModel(provider, key) {
  const model = provider.models?.find((item) => stableModelKey(item) === key);
  if (!model) throw new Error(`model "${key}" not found in provider "${provider.id}"`);
  return model;
}

function applyAllowedChanges(target, changes, allowed, label) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) throw new Error(`${label} changes must be an object`);
  for (const [field, value] of Object.entries(changes)) {
    if (!allowed.has(field)) throw new Error(`${label} cannot change field "${field}"`);
    target[field] = clone(value);
  }
}

function validateProvider(provider) {
  if (!provider || typeof provider.id !== "string" || !provider.id.trim()) return "each provider must have a non-empty id";
  if (provider.requestPolicy !== undefined && !["legacy", "json"].includes(provider.requestPolicy)) {
    return `provider "${provider.id}" requestPolicy must be legacy | json`;
  }
  if (!Array.isArray(provider.models) || provider.models.length === 0) return `provider "${provider.id}" must include a non-empty models array`;
  const keys = new Set();
  const ids = new Set();
  let enabled = 0;
  for (const model of provider.models) {
    const key = stableModelKey(model);
    if (!key) return `provider "${provider.id}" contains a model without a key or id`;
    if (keys.has(key)) return `provider "${provider.id}" contains duplicate model key "${key}"`;
    keys.add(key);
    if (!model || typeof model.id !== "string" || !model.id.trim()) return `provider "${provider.id}" contains a model without an id`;
    if (ids.has(model.id)) return `provider "${provider.id}" contains duplicate model id "${model.id}"`;
    ids.add(model.id);
    if (model.capabilities !== undefined) {
      const capabilitiesIssue = validateModelCapabilities(model.capabilities);
      if (capabilitiesIssue) return `model "${model.id}" ${capabilitiesIssue}`;
    }
    const declaredContextTokens = model.capabilities?.maxContextTokens;
    if (
      (!Number.isSafeInteger(model.maxContextLength) || model.maxContextLength <= 0) &&
      (!Number.isSafeInteger(declaredContextTokens) || declaredContextTokens <= 0)
    ) {
      return `model "${model.id}" must declare a positive integer maxContextLength or capabilities.maxContextTokens`;
    }
    if (provider.requestPolicy === "json") {
      const requestIssue = validateRequestDefaults(model.requestDefaults);
      if (requestIssue) return `model "${model.id}" ${requestIssue}`;
      if (model.verificationRequestDefaults !== undefined) {
        const verificationIssue = validateRequestDefaults(model.verificationRequestDefaults);
        if (verificationIssue) return `model "${model.id}" verification ${verificationIssue}`;
      }
    } else if (model.verificationRequestDefaults !== undefined) {
      return `model "${model.id}" verificationRequestDefaults requires provider requestPolicy "json"`;
    }
    if (model.agentPolicy !== undefined) {
      const agentPolicyIssue = validateAgentPolicy(model.agentPolicy, { requestPolicy: provider.requestPolicy });
      if (agentPolicyIssue) return `model "${model.id}" ${agentPolicyIssue}`;
    }
    if (model.visionPolicy !== undefined) {
      const visionPolicyIssue = validateVisionPolicy(model.visionPolicy);
      if (visionPolicyIssue) return `model "${model.id}" ${visionPolicyIssue}`;
    }
    if (model.disabled !== true) enabled += 1;
  }
  if (enabled === 0) return `provider "${provider.id}" must keep at least one enabled model`;
  return null;
}

function normalizeProviderModels(provider) {
  for (const model of provider.models ?? []) model.key = stableModelKey(model);
}

function importV2(source, payload) {
  const config = clone(source);
  const existing = config.providers ?? [];
  const incoming = payload.providers;
  const removeProviderIds = payload.removeProviderIds ?? [];
  const importMode = payload.importMode ?? "merge";
  if (!Array.isArray(incoming) || incoming.length === 0) throw new Error("providers must be a non-empty array");
  if (!["merge", "replace"].includes(importMode)) throw new Error("importMode must be merge | replace");
  if (!Array.isArray(removeProviderIds) || removeProviderIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("removeProviderIds must be an array of non-empty provider ids");
  }
  const removalIds = [...new Set(removeProviderIds.map((id) => id.trim()))];
  const incomingIds = new Set(incoming.map((provider) => provider?.id));
  const conflict = removalIds.find((id) => incomingIds.has(id));
  if (conflict) throw new Error(`provider "${conflict}" cannot be both imported and removed`);
  const touched = new Set();
  const actions = [];
  for (const raw of incoming) {
    if (!raw || typeof raw.id !== "string" || !raw.id.trim()) throw new Error("each provider must have a non-empty id");
    const provider = clone(raw);
    const index = existing.findIndex((item) => item.id === provider.id);
    if (index >= 0) {
      existing[index] = importMode === "replace" ? provider : { ...existing[index], ...provider };
      actions.push({ kind: importMode === "replace" ? "replace-provider" : "update-provider", providerId: provider.id, destructive: importMode === "replace", label: `${importMode === "replace" ? "替换" : "更新"}服务商 ${provider.name ?? provider.id}` });
    } else {
      existing.push(provider);
      actions.push({ kind: "add-provider", providerId: provider.id, destructive: false, label: `新增服务商 ${provider.name ?? provider.id}` });
    }
    touched.add(provider.id);
  }
  config.providers = existing;
  if (payload.activeProviderId !== undefined) {
    if (typeof payload.activeProviderId !== "string" || !existing.some((provider) => provider.id === payload.activeProviderId)) {
      throw new Error("activeProviderId must reference an imported or existing provider");
    }
    config.activeProviderId = payload.activeProviderId;
  }
  for (const providerId of removalIds) {
    const index = existing.findIndex((provider) => provider.id === providerId);
    if (index < 0) continue;
    const activeProvider = existing.find((provider) => provider.id === config.activeProviderId) ?? existing[0];
    if (activeProvider?.id === providerId) throw new Error(`cannot remove active provider "${providerId}"; switch to another provider first`);
    if (existing.length === 1) throw new Error("cannot remove the only configured provider");
    const [provider] = existing.splice(index, 1);
    touched.add(provider.id);
    actions.push({ kind: "remove-provider", providerId: provider.id, destructive: true, requiresConfirmation: true, label: `永久删除服务商 ${provider.name ?? provider.id}` });
  }
  for (const provider of existing) {
    normalizeProviderModels(provider);
    const issue = validateProvider(provider);
    if (issue) throw new Error(issue);
  }
  return { config, actions, touchedProviderIds: [...touched] };
}

function importV3(source, payload) {
  if (!Array.isArray(payload.operations) || payload.operations.length === 0) throw new Error("schemaVersion 3 requires a non-empty operations array");
  if (payload.operations.length > 100) throw new Error("operations must not exceed 100 items");
  const config = clone(source);
  config.providers ??= [];
  for (const provider of config.providers) normalizeProviderModels(provider);
  const touched = new Set();
  const actions = [];
  for (const operation of payload.operations) {
    if (!operation || !V3_OPERATIONS.has(operation.op)) throw new Error(`unsupported provider operation "${operation?.op ?? ""}"`);
    if (operation.op === "removeProvider") {
      const index = config.providers.findIndex((item) => item.id === operation.providerId);
      if (index < 0) throw new Error(`provider "${operation.providerId}" not found`);
      const activeProvider = config.providers.find((item) => item.id === config.activeProviderId) ?? config.providers[0];
      if (activeProvider?.id === operation.providerId) throw new Error(`cannot remove active provider "${operation.providerId}"; switch to another provider first`);
      if (config.providers.length === 1) throw new Error("cannot remove the only configured provider");
      const [provider] = config.providers.splice(index, 1);
      touched.add(provider.id);
      actions.push({ kind: "remove-provider", providerId: provider.id, destructive: true, requiresConfirmation: true, label: `永久删除服务商 ${provider.name ?? provider.id}` });
      continue;
    }
    const provider = findProvider(config, operation.providerId);
    touched.add(provider.id);
    if (operation.op === "updateProvider") {
      applyAllowedChanges(provider, operation.changes, PROVIDER_CHANGE_FIELDS, "provider");
      if (operation.changes.apiKey !== undefined || operation.changes.baseUrl !== undefined) delete provider.credentialVerification;
      actions.push({ kind: "update-provider", providerId: provider.id, destructive: false, label: `更新服务商 ${provider.name ?? provider.id}` });
      continue;
    }
    if (operation.op === "upsertModel") {
      const incoming = clone(operation.model);
      const key = stableModelKey(incoming);
      if (!incoming?.key || !key) throw new Error("upsertModel requires a stable model.key");
      const index = provider.models.findIndex((model) => stableModelKey(model) === key);
      if (index >= 0) provider.models[index] = { ...provider.models[index], ...incoming, key };
      else provider.models.push({ ...incoming, key });
      actions.push({ kind: index >= 0 ? "update-model" : "add-model", providerId: provider.id, modelKey: key, destructive: false, label: `${index >= 0 ? "更新" : "新增"}模型 ${incoming.name ?? incoming.id}` });
      continue;
    }
    if (operation.op === "updateModel") {
      const model = findModel(provider, operation.modelKey);
      applyAllowedChanges(model, operation.changes, MODEL_CHANGE_FIELDS, "model");
      model.key = stableModelKey(model);
      actions.push({ kind: "update-model", providerId: provider.id, modelKey: model.key, destructive: false, label: `更新模型 ${model.name ?? model.id}` });
      continue;
    }
    if (operation.op === "disableModel") {
      const model = findModel(provider, operation.modelKey);
      model.disabled = true;
      actions.push({ kind: "disable-model", providerId: provider.id, modelKey: model.key, destructive: false, label: `停用模型 ${model.name ?? model.id}` });
      continue;
    }
    if (operation.op === "removeModel") {
      const index = provider.models.findIndex((model) => stableModelKey(model) === operation.modelKey);
      if (index < 0) throw new Error(`model "${operation.modelKey}" not found in provider "${provider.id}"`);
      const [model] = provider.models.splice(index, 1);
      actions.push({ kind: "remove-model", providerId: provider.id, modelKey: stableModelKey(model), destructive: true, requiresConfirmation: true, label: `永久删除模型 ${model.name ?? model.id}` });
      continue;
    }
    const incomingModels = operation.models;
    if (!Array.isArray(incomingModels) || incomingModels.length === 0) throw new Error("syncModels requires a non-empty models array");
    const present = new Set();
    for (const rawModel of incomingModels) {
      const incoming = clone(rawModel);
      const key = stableModelKey(incoming);
      if (!incoming?.key || !key) throw new Error("syncModels requires stable model.key values");
      if (present.has(key)) throw new Error(`syncModels contains duplicate model key "${key}"`);
      present.add(key);
      const index = provider.models.findIndex((model) => stableModelKey(model) === key);
      if (index >= 0) provider.models[index] = { ...incoming, key, disabled: false };
      else provider.models.push({ ...incoming, key, disabled: false });
      actions.push({ kind: index >= 0 ? "update-model" : "add-model", providerId: provider.id, modelKey: key, destructive: false, label: `${index >= 0 ? "同步" : "新增"}模型 ${incoming.name ?? incoming.id}` });
    }
    for (const model of provider.models) {
      if (!present.has(stableModelKey(model)) && model.disabled !== true) {
        model.disabled = true;
        actions.push({ kind: "disable-model", providerId: provider.id, modelKey: stableModelKey(model), destructive: false, label: `停用未在清单中的模型 ${model.name ?? model.id}` });
      }
    }
  }
  for (const providerId of touched) {
    const provider = config.providers.find((item) => item.id === providerId);
    if (!provider) continue;
    const issue = validateProvider(provider);
    if (issue) throw new Error(issue);
  }
  return { config, actions, touchedProviderIds: [...touched] };
}

export function previewProviderImport(source, payload, options = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("provider JSON must be an object");
  const schemaVersion = payload.schemaVersion ?? 2;
  if (![2, 3].includes(schemaVersion)) throw new Error("schemaVersion must be 2 or 3");
  const result = schemaVersion === 3 ? importV3(source, payload) : importV2(source, payload);
  const destructive = result.actions.some((action) => action.destructive);
  const requiresConfirmation = result.actions.some((action) => action.requiresConfirmation);
  if (requiresConfirmation && Object.hasOwn(options, "confirmDestructive") && options.confirmDestructive !== true) {
    throw new Error("confirmDestructive must be true before applying permanent removals");
  }
  // Any imported model configuration can change routing assumptions shared by
  // providers, so the UI intentionally requires one fresh full-model check.
  for (const provider of result.config.providers ?? []) {
    if (schemaVersion === 2) delete provider.credentialVerification;
    for (const model of provider.models ?? []) delete model.verification;
  }
  return {
    config: result.config,
    touchedProviderIds: result.touchedProviderIds,
    preview: {
      schemaVersion,
      destructive,
      requiresConfirmation,
      actions: result.actions,
      providerCount: result.touchedProviderIds.length,
      modelChanges: result.actions.filter((action) => action.kind.endsWith("model")).length,
    },
  };
}
