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
const MODEL_CAPABILITY_FIELDS = new Set([
  "protocol",
  "inputModalities",
  "streaming",
  "toolCalling",
  "structuredOutput",
  "progressiveToolDiscovery",
  "maxContextTokens",
  "maxOutputTokens",
  "maxImagesPerRequest",
  "maxMediaBytes",
  "roles",
]);
const MODEL_PROTOCOLS = new Set(["openai-chat-completions"]);
const MODEL_INPUT_MODALITIES = new Set(["text", "image", "video", "audio"]);
const MODEL_ROLES = new Set(["chat", "document-draft", "document-review", "vision-review", "summary"]);
const LEGACY_TEXT_ROLES = ["chat", "document-draft", "document-review", "summary"];
const REQUEST_PROFILE_NAMES = new Set([
  "toolContinuation",
  "finalAnswer",
  "summary",
  "report",
  "knowledge",
  "learn",
  "sessionReview",
  "messageRisk",
  "documentReview",
  "promptOptimization",
]);
const SAFE_VERIFICATION_FALLBACK_PURPOSES = new Set([
  "summary",
  "report",
  "knowledge",
  "learn",
  "sessionReview",
  "messageRisk",
  "documentReview",
  "promptOptimization",
]);
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
  "maxModelCallsPerJob",
  "maxVisualUnitsPerBatch",
  "requestTimeoutMs",
  "jobTimeoutMs",
  "qualityThresholds",
]);
const DOCUMENT_QUALITY_THRESHOLD_FIELDS = new Set([
  "unitLengthRatio",
  "lengthRatio",
  "signalRatio",
  "commandRatio",
  "tableRatio",
  "formulaRatio",
  "urlRatio",
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

export function validateEffortParams(value, efforts) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return "effortParams must be a plain JSON object";
  }
  if (!Array.isArray(efforts) || efforts.length === 0) {
    return "effortParams requires a non-empty efforts array";
  }
  const declared = new Set();
  for (const effort of efforts) {
    if (typeof effort !== "string" || !effort.trim() || effort.length > 64) {
      return "efforts must contain non-empty strings no longer than 64 characters";
    }
    if (declared.has(effort)) return `efforts contains duplicate option "${effort}"`;
    declared.add(effort);
  }
  for (const effort of Object.keys(value)) {
    if (!declared.has(effort)) return `effortParams option "${effort}" is not declared in efforts`;
    const issue = validateRequestDefaults(value[effort]);
    if (issue) return `effortParams.${effort} ${issue}`;
  }
  for (const effort of declared) {
    if (!Object.hasOwn(value, effort)) return `effortParams is missing declared effort "${effort}"`;
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
    (!Number.isSafeInteger(value.maxToolIterations) || value.maxToolIterations < 4 || value.maxToolIterations > 256)
  ) {
    return "agentPolicy maxToolIterations must be an integer from 4 to 256";
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
      ["maxModelCallsPerJob", 4, 10000],
      ["maxVisualUnitsPerBatch", 1, 20],
      ["requestTimeoutMs", 30000, 1800000],
      ["jobTimeoutMs", 1000, 172800000],
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
    if (policy.qualityThresholds !== undefined) {
      const thresholds = policy.qualityThresholds;
      if (!thresholds || typeof thresholds !== "object" || Array.isArray(thresholds) || Object.getPrototypeOf(thresholds) !== Object.prototype) {
        return "agentPolicy documentPolicy.qualityThresholds must be a plain JSON object";
      }
      for (const [name, ratio] of Object.entries(thresholds)) {
        if (!DOCUMENT_QUALITY_THRESHOLD_FIELDS.has(name)) return `agentPolicy documentPolicy.qualityThresholds contains unknown field "${name}"`;
        if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
          return `agentPolicy documentPolicy.qualityThresholds.${name} must be a number from 0 to 1`;
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

function validateCapabilityList(value, field, allowed) {
  if (!Array.isArray(value) || value.length === 0 || value.length > allowed.size) {
    return `capabilities ${field} must be a non-empty array`;
  }
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== "string" || !allowed.has(entry)) {
      return `capabilities ${field} contains unsupported value "${String(entry)}"`;
    }
    if (seen.has(entry)) return `capabilities ${field} contains duplicate value "${entry}"`;
    seen.add(entry);
  }
  return null;
}

export function validateModelCapabilities(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return "capabilities must be a plain JSON object";
  }
  for (const key of Object.keys(value)) {
    if (!MODEL_CAPABILITY_FIELDS.has(key)) return `capabilities contains unknown field "${key}"`;
  }
  if (value.protocol !== undefined && !MODEL_PROTOCOLS.has(value.protocol)) {
    return 'capabilities protocol must be "openai-chat-completions"';
  }
  if (value.inputModalities !== undefined) {
    const issue = validateCapabilityList(value.inputModalities, "inputModalities", MODEL_INPUT_MODALITIES);
    if (issue) return issue;
    if (!value.inputModalities.includes("text")) return "capabilities inputModalities must include text";
  }
  for (const field of ["streaming", "toolCalling", "structuredOutput", "progressiveToolDiscovery"]) {
    if (value[field] !== undefined && typeof value[field] !== "boolean") {
      return `capabilities ${field} must be a boolean`;
    }
  }
  for (const field of ["maxContextTokens", "maxOutputTokens", "maxImagesPerRequest", "maxMediaBytes"]) {
    if (value[field] !== undefined && (!Number.isSafeInteger(value[field]) || value[field] <= 0)) {
      return `capabilities ${field} must be a positive integer`;
    }
  }
  if (value.roles !== undefined) {
    const issue = validateCapabilityList(value.roles, "roles", MODEL_ROLES);
    if (issue) return issue;
  }
  if (Array.isArray(value.inputModalities) && !value.inputModalities.includes("image")) {
    if (value.maxImagesPerRequest !== undefined) return "capabilities maxImagesPerRequest requires image inputModalities";
    if (value.roles?.includes("vision-review")) return "capabilities vision-review role requires image inputModalities";
  }
  if (Array.isArray(value.inputModalities) && !value.inputModalities.some((entry) => entry !== "text") && value.maxMediaBytes !== undefined) {
    return "capabilities maxMediaBytes requires a non-text input modality";
  }
  return validateJsonValue(value, "capabilities", 0, new Set());
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validCapabilityList(value, allowed) {
  if (!Array.isArray(value) || value.length === 0 || value.length > allowed.size) return null;
  if (value.some((entry) => typeof entry !== "string" || !allowed.has(entry))) return null;
  if (new Set(value).size !== value.length) return null;
  return [...value];
}

export function resolveProviderModelCapabilities(provider, modelId) {
  const model = provider?.models?.find((item) => item?.id === modelId);
  if (!model) return {};
  const declared = model.capabilities && typeof model.capabilities === "object" && !Array.isArray(model.capabilities)
    ? model.capabilities
    : {};
  const declaredModalities = validCapabilityList(declared.inputModalities, MODEL_INPUT_MODALITIES);
  const inputModalities = declaredModalities?.includes("text")
    ? declaredModalities
    : model.multimodal === true ? ["text", "image"] : ["text"];
  const supportsImages = inputModalities.includes("image");
  const supportsMedia = inputModalities.some((entry) => entry !== "text");
  const declaredRoles = validCapabilityList(declared.roles, MODEL_ROLES);
  let roles = declaredRoles ?? (supportsImages
    ? ["chat", "document-draft", "document-review", "vision-review", "summary"]
    : [...LEGACY_TEXT_ROLES]);
  if (!supportsImages) roles = roles.filter((role) => role !== "vision-review");
  if (roles.length === 0) roles = [...LEGACY_TEXT_ROLES];
  const legacyMaxImages = isPositiveInteger(model.visionPolicy?.maxImages) ? model.visionPolicy.maxImages : 5;
  return {
    protocol: MODEL_PROTOCOLS.has(declared.protocol) ? declared.protocol : "openai-chat-completions",
    inputModalities,
    streaming: typeof declared.streaming === "boolean" ? declared.streaming : true,
    toolCalling: typeof declared.toolCalling === "boolean" ? declared.toolCalling : true,
    structuredOutput: typeof declared.structuredOutput === "boolean" ? declared.structuredOutput : false,
    progressiveToolDiscovery: declared.progressiveToolDiscovery === true,
    maxContextTokens: isPositiveInteger(declared.maxContextTokens)
      ? declared.maxContextTokens
      : isPositiveInteger(model.maxContextLength) ? model.maxContextLength : null,
    maxOutputTokens: isPositiveInteger(declared.maxOutputTokens) ? declared.maxOutputTokens : null,
    maxImagesPerRequest: supportsImages
      ? isPositiveInteger(declared.maxImagesPerRequest) ? declared.maxImagesPerRequest : legacyMaxImages
      : 0,
    maxMediaBytes: supportsMedia
      ? isPositiveInteger(declared.maxMediaBytes) ? declared.maxMediaBytes : 10 * 1024 * 1024
      : 0,
    roles,
  };
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

function safeVerificationTaskDefaults(value) {
  const safe = mergeJsonObjects({}, value && typeof value === "object" && !Array.isArray(value) ? value : {});
  // Probe configurations commonly use max_tokens: 8. Reusing that value for a
  // real task would silently starve the result; keep the model's normal output
  // budget and reuse only the lightweight thinking/sampling controls.
  delete safe.max_tokens;
  delete safe.max_completion_tokens;
  return safe;
}

export function resolveProviderModelRequest(provider, modelId, options = {}) {
  const policy = provider?.requestPolicy === JSON_REQUEST_POLICY ? JSON_REQUEST_POLICY : "legacy";
  const model = provider?.models?.find((item) => item?.id === modelId);
  let requestDefaults = policy === JSON_REQUEST_POLICY ? model?.requestDefaults ?? {} : {};
  if (policy === JSON_REQUEST_POLICY) {
    const deferPromptOptimizationProfile = options.purpose === "promptOptimization";
    const issue = validateRequestDefaults(requestDefaults);
    if (issue) throw new Error(`invalid request configuration for model "${modelId}": ${issue}`);
    if (options.purpose === "verification" && model?.verificationRequestDefaults !== undefined) {
      const verificationIssue = validateRequestDefaults(model.verificationRequestDefaults);
      if (verificationIssue) throw new Error(`invalid verification request configuration for model "${modelId}": ${verificationIssue}`);
      requestDefaults = mergeJsonObjects(requestDefaults, model.verificationRequestDefaults);
    } else if (!deferPromptOptimizationProfile && model?.agentPolicy?.requestProfiles?.[options.purpose] !== undefined) {
      const profile = model.agentPolicy.requestProfiles[options.purpose];
      const profileIssue = validateRequestDefaults(profile);
      if (profileIssue) throw new Error(`invalid ${options.purpose} request configuration for model "${modelId}": ${profileIssue}`);
      requestDefaults = mergeJsonObjects(requestDefaults, profile);
    } else if (!deferPromptOptimizationProfile && SAFE_VERIFICATION_FALLBACK_PURPOSES.has(options.purpose) && model?.verificationRequestDefaults !== undefined) {
      const verificationIssue = validateRequestDefaults(model.verificationRequestDefaults);
      if (verificationIssue) throw new Error(`invalid verification request configuration for model "${modelId}": ${verificationIssue}`);
      requestDefaults = mergeJsonObjects(requestDefaults, safeVerificationTaskDefaults(model.verificationRequestDefaults));
    }
    if (options.purpose !== "verification" && model?.effortParams !== undefined) {
      const effortIssue = validateEffortParams(model.effortParams, model.efforts);
      if (effortIssue) throw new Error(`invalid reasoning effort configuration for model "${modelId}": ${effortIssue}`);
      const efforts = model.efforts;
      const fallbackEffort = efforts.includes(provider?.defaultEffort) ? provider.defaultEffort : efforts[0];
      const selectedEffort = efforts.includes(options.reasoningEffort) ? options.reasoningEffort : fallbackEffort;
      requestDefaults = mergeJsonObjects(requestDefaults, model.effortParams[selectedEffort]);
    }
    if (deferPromptOptimizationProfile) {
      const profile = model?.agentPolicy?.requestProfiles?.promptOptimization;
      if (profile !== undefined) {
        const profileIssue = validateRequestDefaults(profile);
        if (profileIssue) throw new Error(`invalid promptOptimization request configuration for model "${modelId}": ${profileIssue}`);
        requestDefaults = mergeJsonObjects(requestDefaults, profile);
      } else if (model?.verificationRequestDefaults !== undefined) {
        const verificationIssue = validateRequestDefaults(model.verificationRequestDefaults);
        if (verificationIssue) throw new Error(`invalid verification request configuration for model "${modelId}": ${verificationIssue}`);
        requestDefaults = mergeJsonObjects(requestDefaults, safeVerificationTaskDefaults(model.verificationRequestDefaults));
      }
    }
  }
  return { policy, requestDefaults };
}

export function resolveDocumentOutputBudget(provider, modelId, options = {}) {
  const purpose = String(options.purpose || "toolContinuation");
  const request = resolveProviderModelRequest(provider, modelId, { purpose });
  const agentPolicy = resolveProviderModelAgentPolicy(provider, modelId);
  const requestMaximum = Number(request.requestDefaults?.max_tokens ?? request.requestDefaults?.max_completion_tokens);
  const policyMaximum = Number(agentPolicy.documentPolicy?.batchOutputTokens);
  const fallback = Number(options.fallback);
  const configuredValues = [requestMaximum, policyMaximum, fallback]
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  const configured = configuredValues.length > 0 ? Math.min(...configuredValues) : 8_192;
  const capabilityMaximum = Number(resolveProviderModelCapabilities(provider, modelId).maxOutputTokens);
  return Number.isSafeInteger(capabilityMaximum) && capabilityMaximum > 0
    ? Math.min(configured, capabilityMaximum)
    : configured;
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
