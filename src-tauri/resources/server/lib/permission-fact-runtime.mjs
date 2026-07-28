import { createHash } from "node:crypto";

const SCHEMA_VERSION = 1;
const MAX_FACTS = 256;
const MAX_RULE_LENGTH = 160;
const MAX_REASON_LENGTH = 240;
const DECISIONS = new Set(["allow", "deny", "cancelled"]);
const SCOPES = new Set(["operation", "session", "project", "user"]);
const SCOPE_RANK = Object.freeze({ operation: 4, session: 3, project: 2, user: 1 });

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
  // Absolute workspace paths stay in the operation context. Permission facts
  // only keep a stable fingerprint so they can be replayed without leaking a
  // local path into the durable approval store.
  return raw.startsWith("workspace:") ? raw : `workspace:${sha256(raw.toLowerCase())}`;
}

function normalizeArgs(value) {
  if (value === undefined || value === null) return null;
  try { return sha256(stable(value)); } catch { return sha256(String(value)); }
}

function commandFor(request) {
  if (typeof request?.command === "string") return request.command.trim();
  if (typeof request?.args?.command === "string") return request.args.command.trim();
  return "";
}

function normalizeRule(rule, request = {}) {
  if (typeof rule === "string") {
    const value = text(rule, MAX_RULE_LENGTH);
    return value ? { kind: "prefix", value } : null;
  }
  if (!rule || typeof rule !== "object") return null;
  const kind = text(rule.kind, 24);
  const value = text(rule.value, MAX_RULE_LENGTH);
  if (!["tool", "exact", "prefix"].includes(kind)) return null;
  if (kind === "tool") return { kind };
  if (kind === "exact") {
    const argsFingerprint = text(rule.argsFingerprint, 100) || text(request.argsFingerprint, 100) || normalizeArgs(request.args);
    return argsFingerprint ? { kind, argsFingerprint } : null;
  }
  return value ? { kind, value } : null;
}

function safeRule(rule) {
  if (!rule || typeof rule !== "object") return null;
  if (rule.kind === "tool") return { kind: "tool" };
  if (rule.kind === "exact" && text(rule.argsFingerprint, 100)) {
    return { kind: "exact", argsFingerprint: text(rule.argsFingerprint, 100) };
  }
  if (rule.kind === "prefix" && text(rule.value, MAX_RULE_LENGTH)) {
    return { kind: "prefix", value: text(rule.value, MAX_RULE_LENGTH) };
  }
  return null;
}

function scopeMatches(fact, request) {
  switch (fact.scope) {
    case "operation":
      return Boolean(fact.operationId && text(request.operationId, 180) === fact.operationId
        && (!fact.sessionId || text(request.sessionId, 180) === fact.sessionId)
        && (!fact.workspaceFingerprint || normalizeWorkspace(request.workspace) === fact.workspaceFingerprint));
    case "session":
      return Boolean(fact.sessionId && text(request.sessionId, 180) === fact.sessionId
        && (!fact.workspaceFingerprint || normalizeWorkspace(request.workspace) === fact.workspaceFingerprint));
    case "project":
      return Boolean(fact.workspaceFingerprint && normalizeWorkspace(request.workspace) === fact.workspaceFingerprint);
    case "user":
      return true;
    default:
      return false;
  }
}

function ruleMatches(fact, request) {
  if (fact.toolName !== text(request.toolName, 160)) return false;
  const rule = fact.rule;
  if (!rule || rule.kind === "tool") return true;
  if (rule.kind === "exact") return rule.argsFingerprint === normalizeArgs(request.args);
  const command = commandFor(request);
  if (!command || !rule.value) return false;
  return command === rule.value || command.startsWith(`${rule.value} `) || command.startsWith(`${rule.value}\t`);
}

function normalizeFact(value, { now = () => new Date().toISOString() } = {}) {
  if (!value || typeof value !== "object") return null;
  const decision = text(value.decision, 24);
  const scope = text(value.scope, 24);
  const toolName = text(value.toolName, 160);
  const rule = safeRule(value.rule);
  if (!DECISIONS.has(decision) || !SCOPES.has(scope) || !toolName || !rule) return null;
  const operationId = text(value.operationId, 180);
  const sessionId = text(value.sessionId, 180);
  const workspaceFingerprint = normalizeWorkspace(value.workspaceFingerprint ?? value.workspace);
  if (scope === "operation" && !operationId) return null;
  if (scope === "session" && !sessionId) return null;
  if (scope === "project" && !workspaceFingerprint) return null;
  const createdAt = text(value.createdAt, 40) || now();
  const factId = text(value.factId, 180) || `auth:${sha256(stable({ decision, scope, operationId, sessionId, workspaceFingerprint, toolName, rule }))}`;
  return {
    schemaVersion: SCHEMA_VERSION,
    factId,
    decision,
    scope,
    operationId: scope === "operation" ? operationId : null,
    sessionId: ["operation", "session"].includes(scope) ? sessionId : null,
    workspaceFingerprint: ["operation", "session", "project"].includes(scope) ? workspaceFingerprint : null,
    toolName,
    rule,
    argsFingerprint: text(value.argsFingerprint, 100),
    source: text(value.source, 80) || "permission-runtime",
    reason: text(value.reason, MAX_REASON_LENGTH),
    reusable: value.reusable !== false,
    createdAt,
    expiresAt: text(value.expiresAt, 40),
  };
}

function publicFact(fact) {
  return fact ? structuredClone(fact) : null;
}

/**
 * Durable, replayable approval facts inspired by Kimi Code's permissionRules
 * and session-approval-history policies. This module stores no raw commands,
 * credentials or full tool arguments; it only evaluates explicitly supplied
 * exact/prefix/tool rules at the requested scope.
 */
export function createPermissionFactRuntime({
  initial = [],
  persist = () => {},
  now = () => new Date().toISOString(),
  onIssue = () => {},
  maxFacts = MAX_FACTS,
} = {}) {
  const facts = [];
  const limit = Math.max(1, Math.min(MAX_FACTS, Number(maxFacts) || MAX_FACTS));

  function save() {
    try { persist(facts.map(publicFact)); }
    catch (error) { onIssue(error); }
  }

  function trim() {
    if (facts.length <= limit) return;
    // Keep operation/session facts newer than broad project facts when the
    // bounded store is full, because they are the most specific replay data.
    facts.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    while (facts.length > limit) {
      const candidate = facts.findIndex((fact) => fact.scope === "project" || fact.scope === "user");
      facts.splice(candidate >= 0 ? candidate : 0, 1);
    }
  }

  for (const value of Array.isArray(initial) ? initial : initial?.facts ?? []) {
    const fact = normalizeFact(value, { now });
    if (!fact || facts.some((item) => item.factId === fact.factId)) continue;
    facts.push(fact);
  }
  trim();

  function evaluate(request = {}) {
    if (request.requiresApproval !== true) return { decision: "allow", cached: false, reason: "policy-allows", fact: null };
    const currentTime = Date.parse(now());
    const matches = facts.filter((fact) => {
      if (fact.reusable === false) return false;
      if (fact.expiresAt && Number.isFinite(currentTime) && Date.parse(fact.expiresAt) <= currentTime) return false;
      return scopeMatches(fact, request) && ruleMatches(fact, request);
    });
    matches.sort((a, b) => {
      const scopeDifference = SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope];
      if (scopeDifference !== 0) return scopeDifference;
      if (a.decision === b.decision) return String(b.createdAt).localeCompare(String(a.createdAt));
      return a.decision === "deny" ? -1 : 1;
    });
    const fact = matches[0] ?? null;
    if (!fact) return { decision: "ask", cached: false, reason: "approval-required", fact: null };
    if (fact.decision === "deny") return { decision: "deny", cached: true, reason: "permission-fact-deny", fact: publicFact(fact) };
    if (fact.decision === "allow") return { decision: "allow", cached: true, reason: "permission-fact-allow", fact: publicFact(fact) };
    return { decision: "ask", cached: false, reason: "permission-fact-not-reusable", fact: publicFact(fact) };
  }

  function record(input = {}) {
    const scope = SCOPES.has(text(input.scope, 24)) ? text(input.scope, 24) : "operation";
    const fact = normalizeFact({
      ...input,
      scope,
      argsFingerprint: text(input.argsFingerprint, 100) || normalizeArgs(input.args),
      rule: normalizeRule(input.rule
        ?? (input.rulePattern
          ? { kind: "prefix", value: input.rulePattern }
          : input.args !== undefined ? { kind: "exact" } : { kind: "tool" }), input),
      createdAt: input.createdAt || now(),
      reusable: input.reusable !== false,
    }, { now });
    if (!fact) throw new TypeError("permission fact is incomplete or unsafe");
    const existingIndex = facts.findIndex((item) => item.factId === fact.factId);
    if (existingIndex >= 0) return publicFact(facts[existingIndex]);
    facts.push(fact);
    trim();
    save();
    return publicFact(fact);
  }

  function revoke({ operationId = null, sessionId = null, workspace = null } = {}) {
    const operation = text(operationId, 180);
    const session = text(sessionId, 180);
    const workspaceFingerprint = normalizeWorkspace(workspace);
    let removed = 0;
    for (let index = facts.length - 1; index >= 0; index -= 1) {
      const fact = facts[index];
      if (operation && fact.operationId !== operation) continue;
      if (!operation && session && fact.sessionId !== session) continue;
      if (!operation && !session && workspaceFingerprint && fact.workspaceFingerprint !== workspaceFingerprint) continue;
      if (!operation && !session && !workspaceFingerprint) continue;
      // Project/user facts are intentionally not revoked by operation cancel.
      if (fact.scope === "project" || fact.scope === "user") continue;
      facts.splice(index, 1);
      removed += 1;
    }
    if (removed > 0) save();
    return removed;
  }

  return {
    evaluate,
    record,
    revoke,
    size: () => facts.length,
    snapshot: () => facts.map(publicFact),
    list: (scope = {}) => facts.filter((fact) => {
      if (scope.sessionId && !["operation", "session"].includes(fact.scope)) return false;
      if (scope.sessionId && fact.sessionId !== text(scope.sessionId, 180)) return false;
      if (scope.workspace && fact.workspaceFingerprint !== normalizeWorkspace(scope.workspace)) return false;
      return true;
    }).map(publicFact),
  };
}

export function permissionFactRequest({ operationId = null, sessionId = null, workspace = null, toolName = null, args = null, command = null, requiresApproval = true } = {}) {
  return { operationId, sessionId, workspace, toolName, args, command, requiresApproval };
}

export const permissionFactInternals = Object.freeze({ normalizeWorkspace, normalizeArgs, normalizeRule, ruleMatches });
