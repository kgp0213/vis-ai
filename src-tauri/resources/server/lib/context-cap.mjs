// Context capacity resolution. Provider JSON is authoritative; a user setting
// can only lower the effective capacity, never exceed the model declaration.

export const FALLBACK_CONTEXT_TOKENS = 131072;

function positiveInteger(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const normalized = Math.floor(value);
  return Number.isSafeInteger(normalized) ? normalized : null;
}

export function resolveContextPolicy(model, config, provider, fallback = FALLBACK_CONTEXT_TOKENS) {
  const modelObj = provider?.models?.find((entry) => entry.id === model);
  const capabilityCap = positiveInteger(modelObj?.capabilities?.maxContextTokens);
  const legacyCap = positiveInteger(modelObj?.maxContextLength);
  const declaredCap = capabilityCap ?? legacyCap;
  const capacitySource = capabilityCap !== null
    ? "json-capabilities"
    : legacyCap !== null ? "json" : "fallback";
  const fallbackCap = positiveInteger(fallback) ?? FALLBACK_CONTEXT_TOKENS;
  const modelCap = declaredCap ?? fallbackCap;
  const userLimit = positiveInteger(config?.contextCapTokens);
  const effectiveCap = userLimit === null ? modelCap : Math.min(userLimit, modelCap);
  return {
    model,
    providerId: provider?.id ?? null,
    modelMaxContextLength: modelCap,
    declaredMaxContextLength: declaredCap,
    declaredMaxContextTokens: declaredCap,
    userLimit,
    effectiveCap,
    capacitySource,
    source: userLimit !== null && userLimit < modelCap ? "user-limit" : capacitySource,
    clamped: userLimit !== null && userLimit > modelCap,
  };
}

/**
 * Resolve the effective context cap for a model.
 * @param {string} model - model id
 * @param {object} config - config object with optional `contextCapTokens`
 * @param {object|null} provider - active provider with `models[]`
 * @returns {number} effective cap in tokens
 */
export function resolveContextCap(model, config, provider) {
  return resolveContextPolicy(model, config, provider).effectiveCap;
}
