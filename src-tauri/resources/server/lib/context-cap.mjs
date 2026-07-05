// Context cap resolution — extracted from launcher.mjs applyContextCap for testability.
// Pure 3-tier priority chain: manual cap → provider model maxContextLength → null (fall through).

/**
 * Resolve the effective context cap for a model.
 * @param {string} model - model id
 * @param {object} config - config object with optional `contextCapTokens`
 * @param {object|null} provider - active provider with `models[]`
 * @returns {number|null} cap in tokens, or null if no override (fall through to hardcoded table)
 */
export function resolveContextCap(model, config, provider) {
  if (config.contextCapTokens && typeof config.contextCapTokens === "number") {
    return config.contextCapTokens;
  }
  const modelObj = provider?.models?.find((m) => m.id === model);
  if (modelObj?.maxContextLength && typeof modelObj.maxContextLength === "number") {
    return modelObj.maxContextLength;
  }
  return null;
}
