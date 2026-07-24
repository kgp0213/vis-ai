import { createHash } from "node:crypto";

import { readVersionedJsonFile, writeVersionedJsonFile } from "./versioned-json-file.mjs";

const SCHEMA = { version: 1, allowUnversioned: false };
const PROVIDER_TYPES = new Set(["openai-compatible", "kimi"]);
const SOURCES = new Set([
  "builtin-default",
  "json-import",
  "dashboard",
  "legacy-migration",
  "config-migration",
  "environment",
  "manual-unknown",
]);

export function normalizeProviderType(value) {
  const type = typeof value === "string" && value.trim() ? value.trim() : "openai-compatible";
  if (!PROVIDER_TYPES.has(type)) throw new Error(`providerType must be one of: ${[...PROVIDER_TYPES].join(", ")}`);
  return type;
}

function normalizedSource(value) {
  if (!SOURCES.has(value)) throw new Error(`unsupported provider provenance source "${value}"`);
  return value;
}

function canonicalProvider(provider) {
  return {
    id: provider?.id ?? null,
    name: provider?.name ?? null,
    providerType: normalizeProviderType(provider?.providerType),
    baseUrl: provider?.baseUrl ?? null,
    apiKey: provider?.apiKey ?? null,
    requestPolicy: provider?.requestPolicy ?? null,
    requestDefaults: provider?.requestDefaults ?? null,
    defaultPreset: provider?.defaultPreset ?? null,
    defaultEffort: provider?.defaultEffort ?? null,
    autoEscalate: provider?.autoEscalate === true,
    escalationModel: provider?.escalationModel ?? null,
    models: (provider?.models ?? []).map((model) => {
      const { verification, ...stable } = model ?? {};
      return stable;
    }),
  };
}

function fingerprint(provider) {
  return createHash("sha256").update(JSON.stringify(canonicalProvider(provider))).digest("hex");
}

function validateSidecar(value) {
  if (value.providers !== undefined && (!value.providers || typeof value.providers !== "object" || Array.isArray(value.providers))) {
    return "providers must be an object";
  }
  return true;
}

export function createProviderProvenanceStore({ path, now = () => new Date().toISOString() } = {}) {
  if (!path) throw new TypeError("provider provenance path is required");

  function read() {
    return readVersionedJsonFile(path, { ...SCHEMA, validate: validateSidecar });
  }

  function currentValue() {
    const stored = read();
    if (!stored.ok) throw new Error(`provider provenance sidecar is protected: ${stored.error}`);
    return stored.value ?? { providers: {} };
  }

  function record(config, providerIds, source) {
    const provenanceSource = normalizedSource(source);
    const ids = new Set(Array.isArray(providerIds) ? providerIds : []);
    const current = currentValue();
    const entries = { ...(current.providers ?? {}) };
    for (const provider of config?.providers ?? []) {
      if (!ids.has(provider.id)) continue;
      entries[provider.id] = {
        source: provenanceSource,
        fingerprint: fingerprint(provider),
        updatedAt: now(),
      };
    }
    for (const id of ids) {
      if (!(config?.providers ?? []).some((provider) => provider.id === id)) delete entries[id];
    }
    return writeVersionedJsonFile(path, { providers: entries }, SCHEMA);
  }

  function sourceFor(provider) {
    const stored = read();
    if (!stored.ok) {
      return {
        source: "manual-unknown",
        previousSource: null,
        changedOutsideManagedFlow: true,
        issue: stored.error,
      };
    }
    const entry = stored.value?.providers?.[provider?.id];
    if (!entry) return { source: "manual-unknown", previousSource: null, changedOutsideManagedFlow: true };
    if (entry.fingerprint !== fingerprint(provider)) {
      return {
        source: "manual-unknown",
        previousSource: SOURCES.has(entry.source) ? entry.source : null,
        changedOutsideManagedFlow: true,
      };
    }
    return {
      source: SOURCES.has(entry.source) ? entry.source : "manual-unknown",
      previousSource: null,
      changedOutsideManagedFlow: false,
      updatedAt: entry.updatedAt ?? null,
    };
  }

  function remove(config, providerIds, source = "dashboard") {
    return record(config, providerIds, source);
  }

  return { path, read, record, remove, sourceFor };
}

function redactedUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function providerIssues(provider, effectiveBaseUrl, apiKeyPresent) {
  const issues = [];
  try {
    normalizeProviderType(provider.providerType);
  } catch (error) {
    issues.push({ code: "provider_type_invalid", message: error.message });
  }
  if (!effectiveBaseUrl) issues.push({ code: "provider_url_invalid", message: "Provider API URL is missing or invalid." });
  if (!apiKeyPresent) issues.push({ code: "provider_api_key_missing", message: "Provider API Key is not configured." });
  if (!(provider.models ?? []).some((model) => model?.disabled !== true && typeof model?.id === "string" && model.id.trim())) {
    issues.push({ code: "provider_model_missing", message: "Provider has no enabled model." });
  }
  return issues;
}

export function providerDiagnostics(config, { provenance = null, env = process.env } = {}) {
  const configuredProviders = config?.providers ?? [];
  const activeProvider = configuredProviders.find((provider) => provider.id === config?.activeProviderId) ?? configuredProviders[0] ?? null;
  const envApiKey = typeof env?.DEEPSEEK_API_KEY === "string" && env.DEEPSEEK_API_KEY.trim() ? env.DEEPSEEK_API_KEY.trim() : null;
  const envBaseUrl = typeof env?.DEEPSEEK_BASE_URL === "string" && env.DEEPSEEK_BASE_URL.trim() ? env.DEEPSEEK_BASE_URL.trim() : null;
  const providers = configuredProviders.map((provider) => {
    const active = provider === activeProvider;
    const effectiveBaseUrl = redactedUrl(active && envBaseUrl ? envBaseUrl : provider.baseUrl);
    const configuredBaseUrl = redactedUrl(provider.baseUrl);
    const configuredApiKeyPresent = typeof provider.apiKey === "string" && Boolean(provider.apiKey.trim());
    const apiKeyPresent = active && envApiKey ? true : configuredApiKeyPresent;
    const model = (provider.models ?? []).find((item) => item.disabled !== true && item.id === config?.model)
      ?? (provider.models ?? []).find((item) => item.disabled !== true)
      ?? null;
    let providerType = "openai-compatible";
    try { providerType = normalizeProviderType(provider.providerType); } catch {}
    const source = provenance?.sourceFor?.(provider) ?? { source: "manual-unknown", changedOutsideManagedFlow: true };
    return {
      id: provider.id,
      name: provider.name ?? provider.id,
      active,
      providerType,
      modelId: model?.id ?? null,
      protocol: model?.capabilities?.protocol ?? "openai-chat-completions",
      inputModalities: Array.isArray(model?.capabilities?.inputModalities) ? [...model.capabilities.inputModalities] : ["text"],
      configuredBaseUrl,
      effectiveBaseUrl,
      configuredApiKeyPresent,
      apiKeyPresent,
      source: source.source,
      previousSource: source.previousSource ?? null,
      changedOutsideManagedFlow: source.changedOutsideManagedFlow === true,
      overrides: {
        ...(active && envApiKey ? { apiKey: "environment" } : {}),
        ...(active && envBaseUrl ? { baseUrl: "environment" } : {}),
      },
      issues: providerIssues(provider, effectiveBaseUrl, apiKeyPresent),
    };
  });
  return {
    activeProviderId: activeProvider?.id ?? null,
    activeModelId: providers.find((provider) => provider.active)?.modelId ?? null,
    providers,
  };
}
