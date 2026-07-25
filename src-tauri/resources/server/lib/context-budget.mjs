const DEFAULT_CHARS_PER_TOKEN = 3.5;
const RESOURCE_ID_RE = /^[A-Za-z0-9._:-]{1,240}$/u;

/** Conservative local estimate used for diagnostics only, never billing. */
export function estimateContextTokens(chars, { charsPerToken = DEFAULT_CHARS_PER_TOKEN } = {}) {
  const value = Math.max(0, Number(chars) || 0);
  const ratio = Number(charsPerToken) > 0 ? Number(charsPerToken) : DEFAULT_CHARS_PER_TOKEN;
  return Math.ceil(value / ratio);
}

export function buildContextBudgetStatus(status = {}, { assistantText = "", toolResultBytes = 0, compressed = false } = {}) {
  const sourceChars = Math.max(0, Number(status.totalInputChars) || 0);
  const materializedChars = Math.max(0, Number(status.materializedChars) || 0);
  const pendingChars = Math.max(0, Number(status.pendingChars) || 0);
  const assistantChars = String(assistantText ?? "").length;
  const inputChars = Math.max(sourceChars, materializedChars + pendingChars) + assistantChars;
  const resourceRefs = [...new Set([
    ...(Array.isArray(status.pendingInputs) ? status.pendingInputs : []).map((entry) => entry?.resourceId),
    ...(Array.isArray(status.resourceRefs) ? status.resourceRefs : []),
  ].map((value) => String(value ?? "").trim()).filter((value) => RESOURCE_ID_RE.test(value)))].slice(0, 32);
  return {
    ...status,
    inputChars,
    estimatedTokens: estimateContextTokens(inputChars),
    toolResultBytes: Math.max(0, Number(toolResultBytes) || 0),
    compressed: compressed === true || status.compressed === true,
    resourceRefs,
  };
}
