import { createHash } from "node:crypto";

const SCHEMA_VERSION = 1;
const MAX_RULES = 128;
const MAX_PATTERN_LENGTH = 240;
const MAX_REASON_LENGTH = 240;
const DECISIONS = new Set(["allow", "deny", "ask"]);
const SCOPES = new Set(["operation", "session", "project", "user", "turn-override", "session-runtime"]);
const SCOPE_RANK = Object.freeze({
  "turn-override": 5,
  operation: 5,
  "session-runtime": 4,
  session: 4,
  project: 3,
  user: 2,
});

function text(value, limit = 240) {
  const result = String(value ?? "").trim();
  return result ? result.slice(0, limit) : null;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value ?? ""), "utf8").digest("hex")}`;
}

function normalizeWorkspace(value) {
  const raw = text(value, 1_000);
  if (!raw) return null;
  return raw.startsWith("workspace:") ? raw : `workspace:${sha256(raw.toLowerCase())}`;
}

function normalizeScope(value) {
  const scope = text(value, 32) || "user";
  return SCOPES.has(scope) ? scope : null;
}

/** Parse the Kimi-style Tool(arg-glob) pattern without evaluating arbitrary regex. */
export function parsePermissionRulePattern(pattern) {
  if (pattern && typeof pattern === "object") {
    const toolPattern = text(pattern.toolPattern, MAX_PATTERN_LENGTH);
    const argPattern = pattern.argPattern === null || pattern.argPattern === undefined
      ? null
      : text(pattern.argPattern, MAX_PATTERN_LENGTH);
    return toolPattern && (argPattern === null || argPattern) ? { toolPattern, argPattern } : null;
  }
  const value = text(pattern, MAX_PATTERN_LENGTH);
  if (!value) return null;
  const open = value.indexOf("(");
  if (open < 0) return { toolPattern: value, argPattern: null };
  if (!value.endsWith(")") || open === 0) return null;
  const toolPattern = value.slice(0, open).trim();
  const argPattern = value.slice(open + 1, -1);
  if (!toolPattern || !argPattern) return null;
  return { toolPattern, argPattern };
}

function globRegExp(pattern) {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*") {
      // A run of stars has the same meaning as one star. This keeps the DSL
      // predictable and avoids accidentally introducing regex semantics.
      while (pattern[index + 1] === "*") index += 1;
      source += ".*";
    } else if (char === "?") {
      source += ".";
    } else {
      source += char.replace(/[\\^$.*+()[\]{}|]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

function globMatches(pattern, value) {
  try { return globRegExp(pattern).test(String(value ?? "")); } catch { return false; }
}

function commandFor(request) {
  if (typeof request?.command === "string") return request.command.trim();
  if (typeof request?.args?.command === "string") return request.args.command.trim();
  return "";
}

function patternMatches(rule, request) {
  const parsed = rule.pattern;
  if (!parsed || !globMatches(parsed.toolPattern, text(request.toolName, 160) || "")) return false;
  if (!parsed.argPattern) return true;
  const command = commandFor(request);
  if (!command) return false;
  if (parsed.argPattern.startsWith("!")) {
    const excluded = parsed.argPattern.slice(1).trim();
    return Boolean(excluded) && !globMatches(excluded, command);
  }
  return globMatches(parsed.argPattern, command);
}

function scopeMatches(rule, request) {
  const operationId = text(request.operationId, 180);
  const sessionId = text(request.sessionId, 180);
  const workspace = normalizeWorkspace(request.workspace);
  switch (rule.scope) {
    case "operation":
    case "turn-override":
      return Boolean(rule.operationId && rule.operationId === operationId);
    case "session":
    case "session-runtime":
      return Boolean(rule.sessionId && rule.sessionId === sessionId
        && (!rule.workspaceFingerprint || rule.workspaceFingerprint === workspace));
    case "project":
      return Boolean(rule.workspaceFingerprint && rule.workspaceFingerprint === workspace);
    case "user":
      return true;
    default:
      return false;
  }
}

function normalizeRule(value, { now = () => new Date().toISOString() } = {}) {
  if (!value || typeof value !== "object") return null;
  const decision = text(value.decision, 16);
  const scope = normalizeScope(value.scope);
  const pattern = parsePermissionRulePattern(value.pattern ?? value.rule);
  if (!DECISIONS.has(decision) || !scope || !pattern) return null;

  const operationId = text(value.operationId, 180);
  const sessionId = text(value.sessionId, 180);
  const workspaceFingerprint = normalizeWorkspace(value.workspaceFingerprint ?? value.workspace);
  // A project/session rule must carry an explicit binding. This prevents a
  // project rule in a user-level config file from silently becoming global.
  if (["project"].includes(scope) && !workspaceFingerprint) return null;
  if (["operation", "turn-override"].includes(scope) && !operationId) return null;
  if (["session", "session-runtime"].includes(scope) && !sessionId) return null;

  const createdAt = text(value.createdAt, 40) || now();
  const ruleId = text(value.ruleId, 180) || `rule:${sha256(stable({ decision, scope, operationId, sessionId, workspaceFingerprint, pattern }))}`;
  return {
    schemaVersion: SCHEMA_VERSION,
    ruleId,
    decision,
    scope,
    operationId: ["operation", "turn-override"].includes(scope) ? operationId : null,
    sessionId: ["session", "session-runtime"].includes(scope) ? sessionId : null,
    workspaceFingerprint: ["project", "session", "session-runtime"].includes(scope) ? workspaceFingerprint : null,
    pattern,
    patternFingerprint: sha256(stable(pattern)),
    reason: text(value.reason, MAX_REASON_LENGTH),
    source: text(value.source, 80) || "config",
    createdAt,
    expiresAt: text(value.expiresAt, 40),
  };
}

function publicRule(rule) {
  if (!rule) return null;
  return {
    schemaVersion: rule.schemaVersion,
    ruleId: rule.ruleId,
    decision: rule.decision,
    scope: rule.scope,
    operationId: rule.operationId,
    sessionId: rule.sessionId,
    workspaceFingerprint: rule.workspaceFingerprint,
    pattern: rule.pattern,
    patternFingerprint: rule.patternFingerprint,
    reason: rule.reason,
    source: rule.source,
    createdAt: rule.createdAt,
    expiresAt: rule.expiresAt,
  };
}

function specificity(rule) {
  return (rule.pattern.argPattern ? 2 : 1) + (rule.pattern.toolPattern.includes("*") || rule.pattern.toolPattern.includes("?") ? 0 : 1);
}

function isExpired(rule, now) {
  if (!rule?.expiresAt) return false;
  const current = Date.parse(now());
  const expires = Date.parse(rule.expiresAt);
  return Number.isFinite(current) && Number.isFinite(expires) && expires <= current;
}

export function readPermissionRules(config) {
  const permission = config?.permission ?? config?.permissions ?? {};
  const asEntries = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
  const withDecision = (entry, decision) => entry && typeof entry === "object"
    ? { ...entry, decision: entry.decision ?? decision }
    : { pattern: entry, decision };
  const candidates = asEntries(permission?.rules).length > 0
    ? asEntries(permission.rules)
    : asEntries(config?.permissionRules);
  const values = [
    ...candidates,
    ...asEntries(permission?.deny).map((entry) => withDecision(entry, "deny")),
    ...asEntries(permission?.allow).map((entry) => withDecision(entry, "allow")),
    ...asEntries(permission?.ask).map((entry) => withDecision(entry, "ask")),
  ];
  const rules = [];
  for (const value of values) {
    const rule = normalizeRule(value);
    if (!rule || rules.some((item) => item.ruleId === rule.ruleId)) continue;
    rules.push(rule);
  }
  return rules.slice(0, MAX_RULES).map(publicRule);
}

/**
 * Ordered static permission policy. It only returns a decision; it never
 * executes a tool and does not replace the existing pauseGate or shell policy.
 */
export function createPermissionRuleRuntime({ initialRules = [], now = () => new Date().toISOString(), maxRules = MAX_RULES } = {}) {
  const rules = [];
  const limit = Math.max(1, Math.min(MAX_RULES, Number(maxRules) || MAX_RULES));

  function setRules(values = []) {
    rules.length = 0;
    for (const value of Array.isArray(values) ? values : []) {
      const rule = normalizeRule(value, { now });
      if (!rule || isExpired(rule, now) || rules.some((item) => item.ruleId === rule.ruleId)) continue;
      rules.push(rule);
      if (rules.length >= limit) break;
    }
    return rules.length;
  }

  function evaluate(request = {}) {
    if (request.requiresApproval !== true) return { decision: "allow", matched: false, reason: "policy-allows", rule: null };
    const timestamp = Date.parse(now());
    const matches = rules.filter((rule) => {
      if (rule.expiresAt && Number.isFinite(timestamp) && Date.parse(rule.expiresAt) <= timestamp) return false;
      return scopeMatches(rule, request) && patternMatches(rule, request);
    });
    if (!matches.length) return { decision: "none", matched: false, reason: "no-configured-rule", rule: null };
    matches.sort((a, b) => {
      // Explicit deny always wins, including over an allow from a broader scope.
      if (a.decision !== b.decision) {
        if (a.decision === "deny") return -1;
        if (b.decision === "deny") return 1;
        if (a.decision === "ask") return -1;
        if (b.decision === "ask") return 1;
      }
      const scopeDifference = (SCOPE_RANK[b.scope] || 0) - (SCOPE_RANK[a.scope] || 0);
      if (scopeDifference !== 0) return scopeDifference;
      const specificDifference = specificity(b) - specificity(a);
      if (specificDifference !== 0) return specificDifference;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    const rule = matches[0];
    return {
      decision: rule.decision,
      matched: true,
      reason: rule.reason || `configured-${rule.decision}`,
      rule: publicRule(rule),
    };
  }

  setRules(initialRules);
  return {
    evaluate,
    setRules,
    list: () => rules.map(publicRule),
    snapshot: () => rules.map(publicRule),
    size: () => rules.length,
  };
}

export const permissionRuleInternals = Object.freeze({
  normalizeRule,
  normalizeWorkspace,
  patternMatches,
  scopeMatches,
  globMatches,
});
