const JSON_REQUEST_POLICY = "json";
const RESERVED_REQUEST_FIELDS = new Set(["model", "messages", "stream", "tools"]);
const FORBIDDEN_OBJECT_FIELDS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_REQUEST_DEFAULTS_BYTES = 32 * 1024;
const MAX_REQUEST_DEFAULTS_DEPTH = 8;

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

export function resolveProviderModelRequest(provider, modelId) {
  const policy = provider?.requestPolicy === JSON_REQUEST_POLICY ? JSON_REQUEST_POLICY : "legacy";
  const model = provider?.models?.find((item) => item?.id === modelId);
  const requestDefaults = policy === JSON_REQUEST_POLICY ? model?.requestDefaults ?? {} : {};
  if (policy === JSON_REQUEST_POLICY) {
    const issue = validateRequestDefaults(requestDefaults);
    if (issue) throw new Error(`invalid request configuration for model "${modelId}": ${issue}`);
  }
  return { policy, requestDefaults };
}
