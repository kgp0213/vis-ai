// Provider & model config pure functions — extracted from launcher.mjs for testability.
// No side effects, no disk I/O, no global state. All inputs passed as parameters.

export const DEFAULT_MODEL = "deepseek-v4-flash";

export const PRESET_MODELS = {
  flash: "deepseek-v4-flash",
  pro: "deepseek-v4-pro",
};

export const LEGACY_PRESET_ALIASES = {
  fast: "flash",
  smart: "auto",
  max: "pro",
};

/**
 * Find the active provider from a config object.
 * @param {object} cfg - config object with `providers` and `activeProviderId`
 * @returns {object|null} the active provider, first provider, or null
 */
export function getActiveProvider(cfg) {
  const providers = cfg.providers ?? [];
  return providers.find((p) => p.id === cfg.activeProviderId) ?? providers[0] ?? null;
}

/**
 * Summarise all presets, efforts, and model IDs available in a provider.
 * @param {object|null} provider
 * @returns {{presets: string[], efforts: string[], modelIds: string[]}}
 */
export function getProviderCapabilities(provider) {
  const allPresets = new Set();
  const allEfforts = new Set();
  const modelIds = [];
  for (const m of provider?.models?.filter((model) => model.disabled !== true) ?? []) {
    for (const p of m.presets ?? []) allPresets.add(p);
    for (const e of m.efforts ?? []) allEfforts.add(e);
    modelIds.push(m.id);
  }
  return { presets: [...allPresets], efforts: [...allEfforts], modelIds };
}

/**
 * Resolve a preset against a provider's capabilities, falling back to defaultPreset.
 * @returns {string} the resolved preset
 */
export function resolvePresetForProvider(preset, provider) {
  const caps = getProviderCapabilities(provider);
  if (caps.presets.includes(preset)) return preset;
  return provider?.defaultPreset ?? "flash";
}

/**
 * Resolve an effort against a provider's capabilities, falling back to defaultEffort.
 * @returns {string} the resolved effort
 */
export function resolveEffortForProvider(effort, provider) {
  const caps = getProviderCapabilities(provider);
  if (caps.efforts.includes(effort)) return effort;
  return provider?.defaultEffort ?? "high";
}

/** Resolve an effort against one concrete model instead of the provider union. */
export function resolveEffortForModel(effort, provider, modelId) {
  const model = provider?.models?.find((item) => item.disabled !== true && item.id === modelId);
  const efforts = Array.isArray(model?.efforts) ? model.efforts : [];
  if (efforts.length === 0) return effort ?? provider?.defaultEffort ?? "high";
  if (efforts.includes(effort)) return effort;
  if (efforts.includes(provider?.defaultEffort)) return provider.defaultEffort;
  return efforts[0];
}

/**
 * Find the model ID that supports a given preset within a provider.
 * @returns {string} model id, falling back to first model or DEFAULT_MODEL
 */
export function resolveModelForProvider(preset, provider) {
  const models = provider?.models?.filter((model) => model.disabled !== true) ?? [];
  const model = models.find((m) => m.presets?.includes(preset));
  return model?.id ?? models[0]?.id ?? DEFAULT_MODEL;
}

/**
 * Central model-config resolver. Provider mode takes precedence; falls back to
 * legacy hardcoded PRESET_MODELS logic when no provider is configured.
 *
 * @param {object} source - config object (must have `preset`, optionally `model`,
 *   `providers`, `activeProviderId`, `autoEscalate`)
 * @returns {{rawPreset, preset, configuredModel, model, locked, autoEscalate}}
 */
export function effectiveModelConfig(source) {
  const rawPreset = source.preset ?? "auto";
  const preset = LEGACY_PRESET_ALIASES[rawPreset] ?? rawPreset;
  const provider = getActiveProvider(source);

  if (provider) {
    const resolvedPreset = resolvePresetForProvider(preset, provider);
    const model = resolveModelForProvider(resolvedPreset, provider);
    const escalationModel = provider.escalationModel ?? PRESET_MODELS.pro;
    const canEscalate = provider.models?.some((item) => item.disabled !== true && item.id === escalationModel) === true;
    return {
      rawPreset,
      preset: resolvedPreset,
      configuredModel: model,
      model,
      locked: true,
      autoEscalate: provider.autoEscalate === true && resolvedPreset === "auto" && canEscalate,
      escalationModel,
    };
  }

  // Fallback: no provider, use legacy hardcoded logic
  const configuredModel = source.model ?? DEFAULT_MODEL;
  const lockedModel = PRESET_MODELS[preset];
  return {
    rawPreset,
    preset,
    configuredModel,
    model: lockedModel ?? configuredModel,
    locked: Boolean(lockedModel),
    autoEscalate: preset === "auto" ? source.autoEscalate !== false : false,
    escalationModel: source.escalationModel ?? PRESET_MODELS.pro,
  };
}

/**
 * Pick a lightweight model for context summarization (history fold).
 * Priority: flash/lite/mini → smallest maxContextLength → first model.
 * @param {Array|undefined} models - provider.models array
 * @returns {string|undefined} model id
 */
export function pickSummaryModel(models) {
  const enabledModels = models?.filter((model) => model.disabled !== true) ?? [];
  if (enabledModels.length === 0) return undefined;
  const flash = enabledModels.find((m) => /flash|lite|mini/i.test(m.id));
  if (flash) return flash.id;
  const smallest = enabledModels
    .slice()
    .sort((a, b) => (
      a.capabilities?.maxContextTokens ?? a.maxContextLength ?? Infinity
    ) - (
      b.capabilities?.maxContextTokens ?? b.maxContextLength ?? Infinity
    ))[0];
  return smallest?.id ?? enabledModels[0]?.id;
}

/**
 * Pure version of migrateProviders: build the legacy provider object from
 * old-style apiKey/baseUrl config without writing to disk.
 * @param {object} cfg - config with optional apiKey/baseUrl/providers
 * @returns {{providers: Array, activeProviderId: string}|null}
 */
export function buildLegacyProvider(cfg) {
  if (cfg.providers) return null;
  if (!cfg.apiKey && !cfg.baseUrl) return null;
  return {
    providers: [{
      id: "legacy",
      name: "默认",
      baseUrl: cfg.baseUrl ?? "https://api.deepseek.com",
      apiKey: cfg.apiKey ?? "",
      models: [
        { id: "deepseek-v4-flash", name: "Flash", presets: ["auto", "flash"], efforts: ["high", "max"], thinkingMode: "enabled" },
        { id: "deepseek-v4-pro", name: "Pro", presets: ["pro"], efforts: ["high", "max"], thinkingMode: "enabled", multimodal: false },
      ],
      defaultPreset: cfg.preset ?? "auto",
      defaultEffort: cfg.reasoningEffort ?? "max",
      autoEscalate: cfg.autoEscalate !== false,
      escalationModel: "deepseek-v4-pro",
    }],
    activeProviderId: "legacy",
  };
}
