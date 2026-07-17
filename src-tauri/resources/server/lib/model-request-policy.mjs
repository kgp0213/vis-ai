const JSON_REQUEST_POLICY = "json";
const RESERVED_REQUEST_FIELDS = new Set(["model", "messages", "stream", "tools"]);
const FORBIDDEN_OBJECT_FIELDS = new Set(["__proto__", "prototype", "constructor"]);
const AGENT_POLICY_FIELDS = new Set([
  "documentWorkflow",
  "maxToolIterations",
  "maxToolContinuationWindows",
  "sameFailureClassLimit",
  "toolResultBudget",
  "requestProfiles",
  "documentPolicy",
]);
const TOOL_RESULT_BUDGET_FIELDS = new Set(["defaultTokens", "documentTokens", "absoluteMaxTokens"]);
const VISION_POLICY_FIELDS = new Set(["maxImages", "detail", "estimatedTokensPerImage", "contextReserveTokens"]);
const REQUEST_PROFILE_NAMES = new Set(["toolContinuation", "finalAnswer"]);
const DOCUMENT_POLICY_FIELDS = new Set([
  "defaultFidelity",
  "batchInputTokens",
  "batchOutputTokens",
  "maxUnitsPerBatch",
  "maxRetries",
  "autoFallback",
  "semanticBatching",
  "contextOverlapTokens",
  "fallbackProviderIds",
  "foregroundPollMs",
  "maxSplitDepth",
  "maxModelCallsPerBatch",
  "maxVisualUnitsPerBatch",
  "requestTimeoutMs",
]);
const MAX_REQUEST_DEFAULTS_BYTES = 32 * 1024;
const MAX_REQUEST_DEFAULTS_DEPTH = 8;
const MAX_TOOL_RESULT_TOKENS = 32 * 1024;

function validateJsonValue(value, path, depth, seen) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? null : `${path} must contain only finite numbers`;
  if (typeof value !== "object") return `${path} must contain only JSON values`;
  if (depth > MAX_REQUEST_DEFAULTS_DEPTH) return `${path} exceeds the maximum nesting depth`;
  if (seen.has(value)) return `${path} must not contain circular references`;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        const issue = validateJsonValue(value[index], `${path}[${index}]`, depth + 1, seen);
        if (issue) return issue;
      }
      return null;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) return `${path} must be a plain JSON object`;
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_OBJECT_FIELDS.has(key)) return `${path} contains forbidden field "${key}"`;
      const issue = validateJsonValue(child, `${path}.${key}`, depth + 1, seen);
      if (issue) return issue;
    }
    return null;
  } finally {
    seen.delete(value);
  }
}

export function validateRequestDefaults(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return "requestDefaults must be a plain JSON object";
  }
  for (const key of Object.keys(value)) {
    if (RESERVED_REQUEST_FIELDS.has(key)) return `requestDefaults contains reserved field "${key}"`;
  }
  const issue = validateJsonValue(value, "requestDefaults", 0, new Set());
  if (issue) return issue;
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_REQUEST_DEFAULTS_BYTES) {
    return `requestDefaults must not exceed ${MAX_REQUEST_DEFAULTS_BYTES} bytes`;
  }
  return null;
}

export function validateAgentPolicy(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return "agentPolicy must be a plain JSON object";
  }
  for (const key of Object.keys(value)) {
    if (!AGENT_POLICY_FIELDS.has(key)) return `agentPolicy contains unknown field "${key}"`;
  }
  if (value.documentWorkflow !== undefined && value.documentWorkflow !== "guided") {
    return 'agentPolicy documentWorkflow must be "guided"';
  }
  if (
    value.maxToolIterations !== undefined &&
    (!Number.isSafeInteger(value.maxToolIterations) || value.maxToolIterations < 4 || value.maxToolIterations > 64)
  ) {
    return "agentPolicy maxToolIterations must be an integer from 4 to 64";
  }
  if (
    value.maxToolContinuationWindows !== undefined &&
    (!Number.isSafeInteger(value.maxToolContinuationWindows) || value.maxToolContinuationWindows < 0 || value.maxToolContinuationWindows > 2)
  ) {
    return "agentPolicy maxToolContinuationWindows must be an integer from 0 to 2";
  }
  if (
    value.sameFailureClassLimit !== undefined &&
    (!Number.isSafeInteger(value.sameFailureClassLimit) || value.sameFailureClassLimit < 2 || value.sameFailureClassLimit > 10)
  ) {
    return "agentPolicy sameFailureClassLimit must be an integer from 2 to 10";
  }
  if (value.toolResultBudget !== undefined) {
    const budget = value.toolResultBudget;
    if (!budget || typeof budget !== "object" || Array.isArray(budget) || Object.getPrototypeOf(budget) !== Object.prototype) {
      return "agentPolicy toolResultBudget must be a plain JSON object";
    }
    for (const key of Object.keys(budget)) {
      if (!TOOL_RESULT_BUDGET_FIELDS.has(key)) return `agentPolicy toolResultBudget contains unknown field "${key}"`;
    }
    for (const field of TOOL_RESULT_BUDGET_FIELDS) {
      const tokens = budget[field];
      if (!Number.isSafeInteger(tokens) || tokens < 1024 || tokens > MAX_TOOL_RESULT_TOKENS) {
        return `agentPolicy toolResultBudget.${field} must be an integer from 1024 to ${MAX_TOOL_RESULT_TOKENS}`;
      }
    }
    if (budget.defaultTokens > budget.absoluteMaxTokens) {
      return "agentPolicy toolResultBudget.defaultTokens must not exceed absoluteMaxTokens";
    }
    if (budget.documentTokens > budget.absoluteMaxTokens) {
      return "agentPolicy toolResultBudget.documentTokens must not exceed absoluteMaxTokens";
    }
  }
  if (value.requestProfiles !== undefined) {
    if (options.requestPolicy !== JSON_REQUEST_POLICY) {
      return 'agentPolicy requestProfiles requires provider requestPolicy "json"';
    }
    if (
      !value.requestProfiles ||
      typeof value.requestProfiles !== "object" ||
      Array.isArray(value.requestProfiles) ||
      Object.getPrototypeOf(value.requestProfiles) !== Object.prototype
    ) {
      return "agentPolicy requestProfiles must be a plain JSON object";
    }
    for (const [name, profile] of Object.entries(value.requestProfiles)) {
      if (!REQUEST_PROFILE_NAMES.has(name)) return `agentPolicy requestProfiles contains unknown profile "${name}"`;
      const issue = validateRequestDefaults(profile);
      if (issue) return `agentPolicy requestProfiles.${name} ${issue}`;
    }
  }
  if (value.documentPolicy !== undefined) {
    const policy = value.documentPolicy;
    if (!policy || typeof policy !== "object" || Array.isArray(policy) || Object.getPrototypeOf(policy) !== Object.prototype) {
      return "agentPolicy documentPolicy must be a plain JSON object";
    }
    for (const key of Object.keys(policy)) {
      if (!DOCUMENT_POLICY_FIELDS.has(key)) return `agentPolicy documentPolicy contains unknown field "${key}"`;
    }
    if (policy.defaultFidelity !== undefined && !["complete-with-summary", "summary-only"].includes(policy.defaultFidelity)) {
      return 'agentPolicy documentPolicy.defaultFidelity must be "complete-with-summary" or "summary-only"';
    }
    for (const [field, minimum, maximum] of [
      ["batchInputTokens", 1024, 32000],
      ["batchOutputTokens", 1024, 32768],
      ["maxUnitsPerBatch", 1, 100],
      ["maxRetries", 0, 4],
      ["contextOverlapTokens", 128, 4096],
      ["foregroundPollMs", 10, 5000],
      ["maxSplitDepth", 0, 6],
      ["maxModelCallsPerBatch", 4, 200],
      ["maxVisualUnitsPerBatch", 1, 20],
      ["requestTimeoutMs", 30000, 1800000],
    ]) {
      const fieldValue = policy[field];
      if (fieldValue !== undefined && (!Number.isSafeInteger(fieldValue) || fieldValue < minimum || fieldValue > maximum)) {
        return `agentPolicy documentPolicy.${field} must be an integer from ${minimum} to ${maximum}`;
      }
    }
    if (policy.autoFallback !== undefined && typeof policy.autoFallback !== "boolean") {
      return "agentPolicy documentPolicy.autoFallback must be a boolean";
    }
    if (policy.semanticBatching !== undefined && typeof policy.semanticBatching !== "boolean") {
      return "agentPolicy documentPolicy.semanticBatching must be a boolean";
    }
    if (policy.fallbackProviderIds !== undefined) {
      if (!Array.isArray(policy.fallbackProviderIds) || policy.fallbackProviderIds.length > 32) {
        return "agentPolicy documentPolicy.fallbackProviderIds must be an array with at most 32 entries";
      }
      for (const id of policy.fallbackProviderIds) {
        if (typeof id !== "string" || !id.trim() || id.length > 120) {
          return "agentPolicy documentPolicy.fallbackProviderIds must contain non-empty provider ids up to 120 characters";
        }
      }
    }
  }
  const jsonIssue = validateJsonValue(value, "agentPolicy", 0, new Set());
  if (jsonIssue) return jsonIssue;
  return null;
}

export function validateVisionPolicy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return "visionPolicy must be a plain JSON object";
  }
  for (const key of Object.keys(value)) {
    if (!VISION_POLICY_FIELDS.has(key)) return `visionPolicy contains unknown field "${key}"`;
  }
  if (value.maxImages !== undefined && (!Number.isSafeInteger(value.maxImages) || value.maxImages < 1 || value.maxImages > 5)) {
    return "visionPolicy maxImages must be an integer from 1 to 5";
  }
  if (value.detail !== undefined && !["auto", "low", "high"].includes(value.detail)) {
    return 'visionPolicy detail must be "auto", "low", or "high"';
  }
  if (
    value.estimatedTokensPerImage !== undefined &&
    (!Number.isSafeInteger(value.estimatedTokensPerImage) || value.estimatedTokensPerImage < 256 || value.estimatedTokensPerImage > 32768)
  ) {
    return "visionPolicy estimatedTokensPerImage must be an integer from 256 to 32768";
  }
  if (
    value.contextReserveTokens !== undefined &&
    (!Number.isSafeInteger(value.contextReserveTokens) || value.contextReserveTokens < 0 || value.contextReserveTokens > 65536)
  ) {
    return "visionPolicy contextReserveTokens must be an integer from 0 to 65536";
  }
  return validateJsonValue(value, "visionPolicy", 0, new Set());
}

function mergeJsonObjects(base, overrides) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const current = merged[key];
    if (
      current && value &&
      typeof current === "object" && typeof value === "object" &&
      !Array.isArray(current) && !Array.isArray(value)
    ) {
      merged[key] = mergeJsonObjects(current, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

export function resolveProviderModelRequest(provider, modelId, options = {}) {
  const policy = provider?.requestPolicy === JSON_REQUEST_POLICY ? JSON_REQUEST_POLICY : "legacy";
  const model = provider?.models?.find((item) => item?.id === modelId);
  let requestDefaults = policy === JSON_REQUEST_POLICY ? model?.requestDefaults ?? {} : {};
  if (policy === JSON_REQUEST_POLICY) {
    const issue = validateRequestDefaults(requestDefaults);
    if (issue) throw new Error(`invalid request configuration for model "${modelId}": ${issue}`);
    if (options.purpose === "verification" && model?.verificationRequestDefaults !== undefined) {
      const verificationIssue = validateRequestDefaults(model.verificationRequestDefaults);
      if (verificationIssue) throw new Error(`invalid verification request configuration for model "${modelId}": ${verificationIssue}`);
      requestDefaults = mergeJsonObjects(requestDefaults, model.verificationRequestDefaults);
    } else if (model?.agentPolicy?.requestProfiles?.[options.purpose] !== undefined) {
      const profile = model.agentPolicy.requestProfiles[options.purpose];
      const profileIssue = validateRequestDefaults(profile);
      if (profileIssue) throw new Error(`invalid ${options.purpose} request configuration for model "${modelId}": ${profileIssue}`);
      requestDefaults = mergeJsonObjects(requestDefaults, profile);
    }
  }
  return { policy, requestDefaults };
}

export function resolveProviderModelAgentPolicy(provider, modelId) {
  const model = provider?.models?.find((item) => item?.id === modelId);
  if (model?.agentPolicy === undefined) return {};
  const issue = validateAgentPolicy(model.agentPolicy, { requestPolicy: provider?.requestPolicy });
  if (issue) throw new Error(`invalid agent configuration for model "${modelId}": ${issue}`);
  return model.agentPolicy;
}

export function resolveProviderModelVisionPolicy(provider, modelId) {
  const model = provider?.models?.find((item) => item?.id === modelId);
  if (model?.visionPolicy === undefined) return {};
  const issue = validateVisionPolicy(model.visionPolicy);
  if (issue) throw new Error(`invalid vision configuration for model "${modelId}": ${issue}`);
  return model.visionPolicy;
}
