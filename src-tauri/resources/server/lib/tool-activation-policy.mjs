/**
 * Pure tool-activation policy adapted from Kimi Code's layered tool policy.
 *
 * This is deliberately separate from permission/approval policy. Activation
 * decides which tools may be advertised and dispatched; authorization still
 * decides whether an active tool may perform a side effect.
 */

const MAX_PATTERNS = 128;
const MAX_PATTERN_LENGTH = 160;

function text(value, limit = MAX_PATTERN_LENGTH) {
  return String(value ?? "").trim().slice(0, limit);
}

function list(value) {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.map((item) => text(item)).filter(Boolean))].slice(0, MAX_PATTERNS);
}

function hasGlobMagic(pattern) {
  return /[*?\[\]{}]/u.test(String(pattern ?? ""));
}

function escapeRegex(value) {
  return String(value).replace(/[\\^$+?.()|]/gu, "\\$&");
}

function globRegex(pattern) {
  let source = "^";
  const raw = String(pattern ?? "");
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "*") {
      source += ".*";
    } else if (char === "?") {
      source += ".";
    } else if (char === "[") {
      const close = raw.indexOf("]", index + 1);
      if (close > index + 1) {
        const body = raw.slice(index + 1, close).replace(/[\\^]/gu, "\\$&");
        source += `[${body}]`;
        index = close;
      } else {
        source += "\\[";
      }
    } else {
      source += escapeRegex(char);
    }
  }
  try {
    return new RegExp(`${source}$`, "u");
  } catch {
    return /^$/u;
  }
}

function patternMatches(pattern, name, source) {
  const candidate = text(name, 240);
  const rule = text(pattern);
  if (!candidate || !rule) return false;
  // Match Kimi's safety rule: built-ins are exact names, while MCP names can
  // use globs to cover a server or a capability family.
  return source === "mcp" && hasGlobMagic(rule) && rule !== "*"
    ? globRegex(rule).test(candidate)
    : rule === candidate;
}

function sourceFor(name, mcpTools) {
  return mcpTools.has(name) || name.startsWith("mcp__") ? "mcp" : "builtin";
}

function normalizeProfile(policy = {}) {
  const source = policy && typeof policy === "object" && !Array.isArray(policy) ? policy : {};
  return {
    tools: source.tools === undefined ? undefined : list(source.tools) ?? [],
    disallowedTools: list(source.disallowedTools) ?? [],
  };
}

function normalizeGlobal(policy = {}) {
  const source = policy && typeof policy === "object" && !Array.isArray(policy) ? policy : {};
  const enabled = list(source.enabled);
  return {
    // An absent or explicitly empty global allowlist is unconstrained, matching
    // Kimi's global [tools] semantics and preserving legacy configurations.
    enabled: enabled && enabled.length > 0 ? enabled : undefined,
    disabled: list(source.disabled) ?? [],
  };
}

function normalizeSession(names) {
  return list(names) ?? [];
}

function allPatterns(policy) {
  return [
    ...(policy.profile.tools ?? []),
    ...(policy.profile.disallowedTools ?? []),
    ...(policy.global.enabled ?? []),
    ...(policy.global.disabled ?? []),
    ...policy.sessionDisabledTools,
  ];
}

function evaluateLayer(layer, name, source, label) {
  if (layer.tools !== undefined && !layer.tools.some((pattern) => patternMatches(pattern, name, source))) {
    return { active: false, layer: label, reason: `${label}_allowlist`, matchedPattern: null };
  }
  const denied = layer.disallowedTools?.find((pattern) => patternMatches(pattern, name, source));
  if (denied) return { active: false, layer: label, reason: `${label}_denylist`, matchedPattern: denied };
  return { active: true };
}

function evaluateToolActivation(policy, name, source = null) {
  const toolName = text(name, 240);
  const resolvedSource = source ?? sourceFor(toolName, policy.mcpTools);
  const profile = evaluateLayer(policy.profile, toolName, resolvedSource, "profile");
  if (!profile.active) return { ...profile, name: toolName, source: resolvedSource };
  const global = evaluateLayer({
    tools: policy.global.enabled,
    disallowedTools: policy.global.disabled,
  }, toolName, resolvedSource, "global");
  if (!global.active) return { ...global, name: toolName, source: resolvedSource };
  const sessionDenied = policy.sessionDisabledTools.find((pattern) => patternMatches(pattern, toolName, resolvedSource));
  if (sessionDenied) {
    return {
      active: false,
      layer: "session",
      reason: "session_denylist",
      matchedPattern: sessionDenied,
      name: toolName,
      source: resolvedSource,
    };
  }
  return { active: true, name: toolName, source: resolvedSource, layer: "default", reason: "active" };
}

function diagnosePattern(pattern, knownTools, mcpTools) {
  const value = text(pattern);
  if (!value) return null;
  const source = value.startsWith("mcp__") ? "mcp" : "builtin";
  if (source === "mcp" && !hasGlobMagic(value) && !value.slice("mcp__".length).includes("__")) {
    return { pattern: value, kind: "incomplete-mcp-name" };
  }
  const matches = [...knownTools].filter((name) => patternMatches(value, name, sourceFor(name, mcpTools)));
  if (hasGlobMagic(value)) {
    if (source !== "mcp" && matches.length === 0) return { pattern: value, kind: "wildcard-not-mcp" };
    if (matches.length === 0) return { pattern: value, kind: "no-match" };
    return null;
  }
  if (matches.length === 0 && !mcpTools.has(value)) return { pattern: value, kind: "unknown-tool" };
  return null;
}

export function composeToolActivationPolicy({
  profile = {},
  global = {},
  sessionDisabledTools = [],
  knownTools = [],
  mcpTools = [],
} = {}) {
  const known = new Set((Array.isArray(knownTools) ? knownTools : []).map((name) => text(name, 240)).filter(Boolean));
  const mcp = new Set((Array.isArray(mcpTools) ? mcpTools : []).map((name) => text(name, 240)).filter(Boolean));
  const policy = {
    profile: normalizeProfile(profile),
    global: normalizeGlobal(global),
    sessionDisabledTools: normalizeSession(sessionDisabledTools),
    knownTools: known,
    mcpTools: mcp,
  };
  const diagnostics = allPatterns(policy)
    .map((pattern) => diagnosePattern(pattern, known, mcp))
    .filter(Boolean);
  return { ...policy, diagnostics };
}

export function resolveToolActivationPolicy({
  config = {},
  mode = {},
  sessionDisabledTools = [],
  knownTools = [],
  mcpTools = [],
} = {}) {
  const configuredGlobal = config?.toolPolicy ?? config?.tools ?? {};
  return composeToolActivationPolicy({
    profile: mode,
    global: configuredGlobal,
    sessionDisabledTools,
    knownTools,
    mcpTools,
  });
}

export function isToolActive(policy, name, source = null) {
  return evaluateToolActivation(policy, name, source).active === true;
}

export function explainToolActivation(policy, name, source = null) {
  return evaluateToolActivation(policy, name, source);
}

export function filterToolSpecsByActivation(specs, policy) {
  return (Array.isArray(specs) ? specs : []).filter((spec) => {
    const name = text(spec?.function?.name, 240);
    return name && isToolActive(policy, name);
  });
}

export function publicToolActivationPolicy(policy) {
  return {
    profile: { ...policy.profile, tools: policy.profile.tools ? [...policy.profile.tools] : undefined },
    global: { ...policy.global, enabled: policy.global.enabled ? [...policy.global.enabled] : undefined },
    sessionDisabledTools: [...policy.sessionDisabledTools],
    diagnostics: policy.diagnostics.map((item) => ({ ...item })),
  };
}
