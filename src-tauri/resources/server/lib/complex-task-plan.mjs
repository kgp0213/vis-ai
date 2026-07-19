import { createHash, randomUUID } from "node:crypto";

export const PLAN_SCHEMA_VERSION = 1;
export const WORK_NODE_STATUSES = Object.freeze([
  "pending",
  "ready",
  "running",
  "completed",
  "skipped",
  "failed",
  "blocked",
  "waiting_user",
  "cancelled",
]);

const STATUS_SET = new Set(WORK_NODE_STATUSES);
const COMPLETED_STATUSES = new Set(["completed", "skipped"]);
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REQUIRED_TERMINATION_FIELDS = Object.freeze(["maxAttempts", "wallClockMs", "stallTimeoutMs"]);
const DEFAULT_NODE_TERMINATION = Object.freeze({ maxAttempts: 3, wallClockMs: 300_000, stallTimeoutMs: 60_000 });
const DEFAULT_PLAN_TERMINATION = Object.freeze({ maxReplans: 3 });

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function errorResult(errors) {
  return { ok: false, errors: [...new Set(errors.filter(Boolean))], value: null };
}

function assertResult(result, code, label) {
  if (result.ok) return result.value;
  const error = new TypeError(`invalid ${label}: ${result.errors.join("; ")}`);
  error.code = code;
  error.errors = result.errors;
  throw error;
}

function positiveInteger(value, field, errors, { required = true } = {}) {
  if (!Number.isInteger(value) || value <= 0) {
    if (required || value !== undefined) errors.push(`${field} must be a positive integer`);
    return null;
  }
  return value;
}

function nonNegativeInteger(value, field, errors, { required = true } = {}) {
  if (!Number.isInteger(value) || value < 0) {
    if (required || value !== undefined) errors.push(`${field} must be a non-negative integer`);
    return null;
  }
  return value;
}

function stringArray(value, field, errors, { required = true, unique = true } = {}) {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  const values = value.map((item) => text(item));
  if (values.some((item) => !item)) errors.push(`${field} must contain only non-empty strings`);
  if (unique && new Set(values).size !== values.length) errors.push(`${field} values must be unique`);
  return values.filter(Boolean);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function hash(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}`;
}

function fingerprintInput(plan) {
  const copy = clone(plan) || {};
  delete copy.revisionId;
  delete copy.topologicalOrder;
  delete copy.nodeResults;
  delete copy.completedNodeIds;
  delete copy.replanCount;
  delete copy.replanReason;
  if (Array.isArray(copy.nodes)) {
    copy.nodes = copy.nodes.map((node) => {
      const stable = { ...node };
      delete stable.status;
      return stable;
    });
  }
  return copy;
}

function normalizePermissionValue(value, field, errors) {
  if (Array.isArray(value)) {
    if (value.some((item) => typeof item !== "string" || !text(item))) errors.push(`${field} must contain valid strings`);
    return value.map((item) => text(item)).filter(Boolean);
  }
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, normalizePermissionValue(nested, `${field}.${key}`, errors)]));
  }
  if (![undefined, null, true, false].includes(value) && typeof value !== "string" && typeof value !== "number") {
    errors.push(`${field} contains an unsupported permission value`);
  }
  return value;
}

function normalizePermissions(value, field, errors, { required = true } = {}) {
  if (!isObject(value)) {
    if (required) errors.push(`${field} must be an object`);
    return {};
  }
  return normalizePermissionValue(value, field, errors);
}

function permissionSubset(child, parent, path, errors) {
  if (child === undefined || child === null || child === false) return;
  if (parent === undefined || parent === null) {
    if (child === true || (Array.isArray(child) && child.length > 0) || (isObject(child) && Object.keys(child).length > 0) || typeof child === "string" || typeof child === "number") {
      errors.push(`${path} is outside the host permission boundary`);
    }
    return;
  }
  if (Array.isArray(child)) {
    if (!Array.isArray(parent)) {
      errors.push(`${path} is outside the host permission boundary`);
      return;
    }
    const allowed = new Set(parent.map(String));
    for (const item of child) if (!allowed.has(String(item))) errors.push(`${path} permission is outside the host permission boundary: ${item}`);
    return;
  }
  if (isObject(child)) {
    if (!isObject(parent)) {
      errors.push(`${path} is outside the host permission boundary`);
      return;
    }
    for (const [key, value] of Object.entries(child)) permissionSubset(value, parent[key], `${path}.${key}`, errors);
    return;
  }
  if (typeof child === "boolean") {
    if (child === true && parent !== true) errors.push(`${path} permission is outside the host permission boundary`);
    return;
  }
  if (child !== parent) errors.push(`${path} permission is outside the host permission boundary`);
}

function normalizeAcceptance(node, index, errors) {
  const field = `nodes[${index}].acceptanceCriteria`;
  const raw = node.acceptanceCriteria ?? node.acceptance?.criteria ?? node.acceptance?.checks;
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push(`${field} must not be empty`);
    return [];
  }
  const criteria = [];
  for (const [criterionIndex, item] of raw.entries()) {
    if (typeof item === "string" && text(item)) {
      criteria.push(text(item));
    } else if (isObject(item)) {
      const hasDescription = [item.id, item.description, item.check, item.type].some((value) => Boolean(text(value)));
      if (!hasDescription) errors.push(`${field}[${criterionIndex}] must describe an acceptance check`);
      criteria.push(clone(item));
    } else {
      errors.push(`${field}[${criterionIndex}] must be a non-empty string or check object`);
    }
  }
  return criteria;
}

function normalizeTermination(node, index, errors, defaults = null) {
  const field = `nodes[${index}].termination`;
  const raw = node.termination ?? node.terminationLimits;
  if (raw === undefined && defaults) return clone(defaults);
  if (!isObject(raw)) {
    errors.push(`${field} must be an object`);
    return {};
  }
  const value = { ...clone(raw) };
  for (const name of REQUIRED_TERMINATION_FIELDS) positiveInteger(value[name], `${field}.${name}`, errors);
  for (const name of ["maxToolCalls", "maxReplans"]) {
    if (value[name] !== undefined) positiveInteger(value[name], `${field}.${name}`, errors);
  }
  return value;
}

function normalizeNode(input, index, errors, { defaults = null } = {}) {
  const node = isObject(input) ? input : {};
  const nodeId = text(node.nodeId ?? node.unitId);
  if (!SAFE_ID_RE.test(nodeId)) errors.push(`nodes[${index}].nodeId is invalid`);
  const goal = text(node.goal);
  if (!goal) errors.push(`nodes[${index}].goal is required`);
  const acceptanceCriteria = normalizeAcceptance(node, index, errors);
  const permissions = normalizePermissions(node.permissions, `nodes[${index}].permissions`, errors, { required: true });
  const requiredCapabilities = stringArray(node.requiredCapabilities ?? node.capabilities, `nodes[${index}].requiredCapabilities`, errors, { required: true });
  const dependencies = stringArray(node.dependencies ?? [], `nodes[${index}].dependencies`, errors);
  if (dependencies.includes(nodeId)) errors.push(`nodes[${index}] cannot depend on itself`);
  const termination = normalizeTermination(node, index, errors, defaults);
  const status = text(node.status || "pending");
  if (!STATUS_SET.has(status)) errors.push(`nodes[${index}].status is invalid`);
  const primaryCoverage = node.primaryCoverage === undefined
    ? []
    : stringArray(node.primaryCoverage, `nodes[${index}].primaryCoverage`, errors);
  const replaces = node.replaces === undefined ? [] : stringArray(node.replaces, `nodes[${index}].replaces`, errors);
  const normalized = {
    ...clone(node),
    nodeId,
    goal,
    acceptanceCriteria,
    permissions,
    requiredCapabilities,
    dependencies,
    termination,
    primaryCoverage,
    replaces,
    status,
  };
  delete normalized.unitId;
  delete normalized.terminationLimits;
  return normalized;
}

function dependencyOrder(nodes, errors) {
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  for (const node of nodes) for (const dependency of node.dependencies) {
    if (!byId.has(dependency)) errors.push(`nodes[${node.nodeId}] has unknown dependency: ${dependency}`);
  }
  const visiting = new Set();
  const visited = new Set();
  const order = [];
  function visit(id, path = []) {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      const cycle = [...path.slice(start >= 0 ? start : 0), id];
      errors.push(`dependency cycle detected: ${cycle.join(" -> ")}`);
      return;
    }
    if (visited.has(id) || !byId.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependencies) visit(dependency, [...path, id]);
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }
  for (const node of nodes) visit(node.nodeId);
  return order;
}

function normalizePlan(input, { create = false, permissionBoundary } = {}) {
  const errors = [];
  if (!isObject(input)) return errorResult(["plan must be an object"]);
  const source = clone(input);
  const schemaVersion = source.schemaVersion ?? (create ? PLAN_SCHEMA_VERSION : undefined);
  if (schemaVersion !== PLAN_SCHEMA_VERSION) errors.push("schemaVersion must be 1");
  const planId = text(source.planId) || (create ? `plan:${randomUUID()}` : "");
  if (!SAFE_ID_RE.test(planId)) errors.push("planId is invalid");
  const planRevision = source.planRevision ?? (create ? 1 : undefined);
  if (!Number.isInteger(planRevision) || planRevision < 1) errors.push("planRevision must be a positive integer");
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : source.unitPlans;
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) errors.push("nodes must not be empty");
  const rootPermissions = normalizePermissions(source.permissions, "permissions", errors, { required: false });
  const rawRequiredCoverage = source.requiredCoverage;
  const requiredCoverage = rawRequiredCoverage === undefined
    ? []
    : stringArray(rawRequiredCoverage, "requiredCoverage", errors);
  const rootTermination = source.termination === undefined
    ? (create ? clone(DEFAULT_PLAN_TERMINATION) : {})
    : normalizePermissions(source.termination, "termination", errors, { required: true });
  if (rootTermination.maxReplans !== undefined) positiveInteger(rootTermination.maxReplans, "termination.maxReplans", errors);
  const replanCount = source.replanCount ?? 0;
  nonNegativeInteger(replanCount, "replanCount", errors);
  const defaults = create ? DEFAULT_NODE_TERMINATION : null;
  const nodes = (Array.isArray(rawNodes) ? rawNodes : []).map((item, index) => normalizeNode(item, index, errors, { defaults }));
  const ids = new Set();
  for (const node of nodes) {
    if (ids.has(node.nodeId)) errors.push(`node ids must be unique: ${node.nodeId}`);
    ids.add(node.nodeId);
  }
  const coverageOwners = new Map();
  for (const node of nodes) for (const coverage of node.primaryCoverage) {
    if (coverageOwners.has(coverage)) errors.push(`primary coverage must have one owner: ${coverage}`);
    coverageOwners.set(coverage, node.nodeId);
  }
  if (requiredCoverage.length > 0) {
    for (const coverage of requiredCoverage) if (!coverageOwners.has(coverage)) errors.push(`required coverage is unplanned: ${coverage}`);
    for (const coverage of coverageOwners.keys()) if (!requiredCoverage.includes(coverage)) errors.push(`primary coverage is not authorized: ${coverage}`);
  }
  if (permissionBoundary) permissionSubset(rootPermissions, permissionBoundary, "permissions", errors);
  for (const node of nodes) {
    if (Object.keys(rootPermissions).length > 0) permissionSubset(node.permissions, rootPermissions, `nodes[${node.nodeId}].permissions`, errors);
    if (permissionBoundary) permissionSubset(node.permissions, permissionBoundary, `nodes[${node.nodeId}].permissions`, errors);
  }
  const topologicalOrder = dependencyOrder(nodes, errors);
  const completedNodeIds = stringArray(source.completedNodeIds ?? [], "completedNodeIds", errors);
  for (const id of completedNodeIds) if (!ids.has(id)) errors.push(`completedNodeIds contains unknown node: ${id}`);
  if (errors.length) return errorResult(errors);
  const normalized = {
    ...source,
    schemaVersion: PLAN_SCHEMA_VERSION,
    planId,
    planRevision,
    nodes,
    requiredCoverage,
    permissions: rootPermissions,
    termination: rootTermination,
    replanCount,
    completedNodeIds: [...new Set([...completedNodeIds, ...nodes.filter((node) => COMPLETED_STATUSES.has(node.status)).map((node) => node.nodeId)])],
    topologicalOrder,
  };
  delete normalized.unitPlans;
  const revisionId = hash(fingerprintInput(normalized));
  if (source.revisionId && source.revisionId !== revisionId) return errorResult(["revisionId does not match the plan contents"]);
  normalized.revisionId = revisionId;
  return { ok: true, errors: [], value: normalized };
}

export function validateWorkPlan(input, options = {}) {
  return normalizePlan(input, { ...options, create: false });
}

export function assertWorkPlan(input, options = {}) {
  return assertResult(validateWorkPlan(input, options), "INVALID_WORK_PLAN", "work plan");
}

function defaultsForCreate(input) {
  const source = clone(input) || {};
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : source.unitPlans;
  const rootPermissions = isObject(source.permissions) ? source.permissions : {};
  const nodes = (Array.isArray(rawNodes) ? rawNodes : []).map((raw, index) => {
    const item = isObject(raw) ? raw : {};
    const id = text(item.nodeId ?? item.unitId) || `node-${index + 1}`;
    return {
      ...item,
      nodeId: id,
      goal: text(item.goal) || `Execute work node ${id}`,
      acceptanceCriteria: item.acceptanceCriteria ?? item.acceptance?.criteria ?? item.acceptance?.checks ?? ["node result is persisted and passes host validation"],
      permissions: item.permissions ?? rootPermissions,
      requiredCapabilities: item.requiredCapabilities ?? item.capabilities ?? [],
      termination: item.termination ?? item.terminationLimits ?? clone(DEFAULT_NODE_TERMINATION),
      primaryCoverage: item.primaryCoverage ?? [id],
      status: item.status || "pending",
    };
  });
  return {
    ...source,
    schemaVersion: source.schemaVersion ?? PLAN_SCHEMA_VERSION,
    planId: text(source.planId) || `plan:${randomUUID()}`,
    planRevision: source.planRevision ?? 1,
    nodes,
    requiredCoverage: source.requiredCoverage ?? nodes.flatMap((item) => item.primaryCoverage ?? []),
    permissions: rootPermissions,
    termination: source.termination ?? clone(DEFAULT_PLAN_TERMINATION),
  };
}

export function createWorkPlan(input = {}, options = {}) {
  return assertResult(normalizePlan(defaultsForCreate(input), { ...options, create: true }), "INVALID_WORK_PLAN", "work plan");
}

function completedIds(plan) {
  const result = new Set(Array.isArray(plan.completedNodeIds) ? plan.completedNodeIds : []);
  for (const node of plan.nodes) if (COMPLETED_STATUSES.has(node.status)) result.add(node.nodeId);
  for (const [id, value] of Object.entries(plan.nodeResults ?? {})) if (COMPLETED_STATUSES.has(text(value?.status ?? value?.proposedStatus))) result.add(id);
  return result;
}

function replanError(message) {
  return errorResult([message]);
}

export function replanWorkPlan(currentInput, input = {}, options = {}) {
  const currentResult = validateWorkPlan(currentInput, options);
  if (!currentResult.ok) return errorResult(["current plan is invalid", ...currentResult.errors]);
  const current = currentResult.value;
  const errors = [];
  if (!isObject(input)) return replanError("replan request must be an object");
  const maxReplans = Number(current.termination?.maxReplans ?? options.maxReplans ?? DEFAULT_PLAN_TERMINATION.maxReplans);
  if (!Number.isInteger(maxReplans) || maxReplans < 0) return replanError("plan replan limit is invalid");
  if (current.replanCount >= maxReplans) return replanError(`plan replan limit reached: ${maxReplans}`);
  if (!Array.isArray(input.nodes)) return replanError("replan nodes must be an array");
  const currentById = new Map(current.nodes.map((node) => [node.nodeId, node]));
  const done = completedIds(current);
  const replacements = input.nodes.map((item, index) => normalizeNode(item, index, errors));
  const explicitTargets = input.replaceNodeIds === undefined ? null : stringArray(input.replaceNodeIds, "replaceNodeIds", errors);
  const targets = new Set(explicitTargets || []);
  for (const replacement of replacements) {
    if (currentById.has(replacement.nodeId) && !done.has(replacement.nodeId)) targets.add(replacement.nodeId);
    for (const replacedId of replacement.replaces) targets.add(replacedId);
  }
  for (const id of targets) {
    if (!currentById.has(id)) errors.push(`replan target is unknown: ${id}`);
    else if (done.has(id)) errors.push(`cannot replace completed node: ${id}`);
  }
  for (const replacement of replacements) {
    if (done.has(replacement.nodeId) && !targets.has(replacement.nodeId)) errors.push(`cannot replace completed node: ${replacement.nodeId}`);
    for (const id of replacement.replaces) if (done.has(id)) errors.push(`cannot replace completed node: ${id}`);
    if (COMPLETED_STATUSES.has(replacement.status)) errors.push(`replacement node must not be completed: ${replacement.nodeId}`);
  }
  if (errors.length) return errorResult(errors);
  const nodes = current.nodes.filter((node) => !targets.has(node.nodeId)).map(clone);
  const existingIds = new Set(nodes.map((node) => node.nodeId));
  for (const replacement of replacements) {
    if (existingIds.has(replacement.nodeId)) {
      // A matching unresolved ID was removed above; a remaining ID would alter a node implicitly.
      errors.push(`replacement node id already exists and was not targeted: ${replacement.nodeId}`);
      continue;
    }
    nodes.push({ ...clone(replacement), status: "pending", replaces: [] });
    existingIds.add(replacement.nodeId);
  }
  if (errors.length) return errorResult(errors);
  const currentResults = isObject(current.nodeResults) ? current.nodeResults : {};
  const nodeResults = Object.fromEntries(Object.entries(currentResults).filter(([id]) => existingIds.has(id) && !targets.has(id)));
  const candidate = {
    ...clone(current),
    nodes,
    nodeResults,
    completedNodeIds: [...done].filter((id) => existingIds.has(id)),
    planRevision: current.planRevision + 1,
    parentRevision: current.revisionId,
    replanCount: current.replanCount + 1,
    replanReason: text(input.reason) || "bounded replan",
  };
  delete candidate.revisionId;
  delete candidate.topologicalOrder;
  if (input.requiredCoverage !== undefined && JSON.stringify(canonical(input.requiredCoverage)) !== JSON.stringify(canonical(current.requiredCoverage))) {
    return replanError("replan cannot change required coverage");
  }
  const checked = validateWorkPlan(candidate, options);
  if (!checked.ok) return checked;
  return checked;
}

export function assertReplannedWorkPlan(currentInput, input = {}, options = {}) {
  return assertResult(replanWorkPlan(currentInput, input, options), "INVALID_REPLAN", "replanned work plan");
}

export function getRunnableWorkNodes(input) {
  const plan = input?.nodes && input?.revisionId ? input : assertWorkPlan(input);
  const done = completedIds(plan);
  const results = isObject(plan.nodeResults) ? plan.nodeResults : {};
  return plan.nodes.filter((node) => {
    if (done.has(node.nodeId) || ["running", "cancelled", "blocked", "waiting_user"].includes(node.status)) return false;
    return node.dependencies.every((id) => done.has(id) || COMPLETED_STATUSES.has(text(results[id]?.status ?? results[id]?.proposedStatus)));
  }).map(clone);
}

/**
 * Project the authoritative graph into the v1 UnitPlan shape consumed by
 * adapters and workers. This keeps existing adapters compatible while the
 * WorkPlan remains the source of node identity, order, and dependencies.
 */
export function workPlanUnitPlans(input, options = {}) {
  const plan = assertWorkPlan(input, options);
  const byId = new Map(plan.nodes.map((node) => [node.nodeId, node]));
  return plan.topologicalOrder.map((nodeId) => {
    const node = byId.get(nodeId);
    const { nodeId: _nodeId, status: _status, ...fields } = clone(node);
    return {
      ...fields,
      unitId: nodeId,
      primaryCoverage: [...node.primaryCoverage],
      dependencies: [...node.dependencies],
      contextRefs: Array.isArray(node.contextRefs) ? clone(node.contextRefs) : [],
      requiredCapabilities: [...node.requiredCapabilities],
      outputRole: text(node.outputRole) || "artifact",
      fallbackPolicy: text(node.fallbackPolicy) || "host-recovery",
      planRevision: plan.planRevision,
    };
  });
}

export function computePlanFingerprint(plan) {
  return hash(fingerprintInput(plan));
}

// Descriptive aliases keep callers independent from the internal name chosen for the graph.
export const validatePlanGraph = validateWorkPlan;
export const assertPlanGraph = assertWorkPlan;
export const stablePlanRevision = computePlanFingerprint;
