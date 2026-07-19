export const TASK_LIFECYCLE_STATES = Object.freeze([
  "created", "queued", "leased", "running", "waiting_user", "blocked", "paused", "assembling", "terminal",
]);
export const TASK_OUTCOMES = Object.freeze([
  "delivered", "delivered_with_warnings", "partial", "failed", "cancelled", "abandoned",
]);
// `passed` remains accepted for v1 compatibility; `verified` is the public name.
export const TASK_QUALITY_STATES = Object.freeze(["unknown", "verified", "passed", "needs_review", "degraded", "failed"]);

const TASK_ID_RE = /^task:[0-9a-f-]{36}$/i;
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UNIT_RESULT_STATES = new Set(["completed", "failed", "blocked", "needs_review", "skipped"]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value, field, errors, { required = false } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  const result = value.map((item) => text(item));
  if (result.some((item) => !item)) errors.push(`${field} must contain only non-empty strings`);
  if (required && result.length === 0) errors.push(`${field} must not be empty`);
  if (new Set(result).size !== result.length) errors.push(`${field} values must be unique`);
  return result.filter(Boolean);
}

function object(value, field, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${field} must be an object`);
    return {};
  }
  return value;
}

function assertResult(result, code, label) {
  if (result.ok) return result.value;
  const error = new TypeError(`invalid ${label}: ${result.errors.join("; ")}`);
  error.code = code;
  error.errors = result.errors;
  throw error;
}

export function validateTaskContract(input) {
  const errors = [];
  const root = object(input, "contract", errors);
  const schemaVersion = Number(root.schemaVersion);
  if (schemaVersion !== 1) errors.push("schemaVersion must be 1");
  const taskId = text(root.taskId);
  if (!TASK_ID_RE.test(taskId)) errors.push("taskId must use task:<uuid>");
  const taskType = text(root.taskType);
  const goal = text(root.goal);
  const workspace = text(root.workspace);
  if (!taskType) errors.push("taskType is required");
  if (!goal) errors.push("goal is required");
  if (!workspace) errors.push("workspace is required");

  if (!Array.isArray(root.sources) || root.sources.length === 0) errors.push("sources must not be empty");
  const sourceIds = new Set();
  const sources = Array.isArray(root.sources) ? root.sources.map((source, index) => {
    const item = object(source, `sources[${index}]`, errors);
    const sourceId = text(item.sourceId);
    if (!SAFE_ID_RE.test(sourceId)) errors.push(`sources[${index}].sourceId is invalid`);
    if (sourceIds.has(sourceId)) errors.push("source ids must be unique");
    sourceIds.add(sourceId);
    for (const field of ["uri", "kind", "fingerprint"]) if (!text(item[field])) errors.push(`sources[${index}].${field} is required`);
    return { ...clone(item), sourceId, uri: text(item.uri), kind: text(item.kind), fingerprint: text(item.fingerprint), required: item.required !== false };
  }) : [];

  const outputInput = object(root.output, "output", errors);
  for (const field of ["format", "requestedPath", "conflictPolicy"]) if (!text(outputInput[field])) errors.push(`output.${field} is required`);
  const completionInput = object(root.completion, "completion", errors);
  const requiredCoverage = stringArray(completionInput.requiredCoverage, "completion.requiredCoverage", errors, { required: true });
  const requiredArtifacts = stringArray(completionInput.requiredArtifacts, "completion.requiredArtifacts", errors, { required: true });
  const qualityInput = object(root.quality, "quality", errors);
  if (!text(qualityInput.requestedFidelity)) errors.push("quality.requestedFidelity is required");
  if (!text(qualityInput.semanticReviewMode)) errors.push("quality.semanticReviewMode is required");
  if (!Number.isInteger(qualityInput.maxRepairPasses) || qualityInput.maxRepairPasses < 0) errors.push("quality.maxRepairPasses must be a non-negative integer");
  const permissions = object(root.permissions, "permissions", errors);
  const interactionInput = object(root.interactionPolicy, "interactionPolicy", errors);
  if (!text(interactionInput.mode)) errors.push("interactionPolicy.mode is required");
  const deliveryChannels = stringArray(interactionInput.deliveryChannels ?? ["task-center"], "interactionPolicy.deliveryChannels", errors, { required: true });
  const limits = object(root.executionLimits, "executionLimits", errors);
  for (const field of ["wallClockMs", "stallTimeoutMs", "attemptLimit"]) {
    if (!Number.isInteger(limits[field]) || limits[field] <= 0) errors.push(`executionLimits.${field} must be a positive integer`);
  }
  const pinned = object(root.pinned, "pinned", errors);
  for (const field of ["adapterVersion", "skillHash", "toolSchemaVersion"]) if (!text(pinned[field])) errors.push(`pinned.${field} is required`);
  const modelPins = stringArray(pinned.initialModelConfigFingerprints, "pinned.initialModelConfigFingerprints", errors);
  if (errors.length) return { ok: false, errors, value: null };
  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: 1,
      taskId,
      taskType,
      goal,
      workspace,
      sources,
      output: { ...clone(outputInput), format: text(outputInput.format), requestedPath: text(outputInput.requestedPath), conflictPolicy: text(outputInput.conflictPolicy) },
      completion: { ...clone(completionInput), requiredCoverage, requiredArtifacts },
      quality: { ...clone(qualityInput), requestedFidelity: text(qualityInput.requestedFidelity), semanticReviewMode: text(qualityInput.semanticReviewMode) },
      permissions: clone(permissions),
      interactionPolicy: { ...clone(interactionInput), mode: text(interactionInput.mode), deliveryChannels },
      executionLimits: clone(limits),
      pinned: { ...clone(pinned), initialModelConfigFingerprints: modelPins },
    },
  };
}

export function assertTaskContract(input) {
  return assertResult(validateTaskContract(input), "INVALID_TASK_CONTRACT", "task contract");
}

function normalizeUnitPlan(input, index, errors) {
  const plan = object(input, `unitPlans[${index}]`, errors);
  const unitId = text(plan.unitId);
  if (!SAFE_ID_RE.test(unitId)) errors.push(`unitPlans[${index}].unitId is invalid`);
  const primaryCoverage = stringArray(plan.primaryCoverage, `unitPlans[${index}].primaryCoverage`, errors, { required: true });
  const dependencies = stringArray(plan.dependencies, `unitPlans[${index}].dependencies`, errors);
  const requiredCapabilities = stringArray(plan.requiredCapabilities, `unitPlans[${index}].requiredCapabilities`, errors);
  if (!text(plan.outputRole)) errors.push(`unitPlans[${index}].outputRole is required`);
  if (!text(plan.fallbackPolicy)) errors.push(`unitPlans[${index}].fallbackPolicy is required`);
  if (!Number.isInteger(plan.planRevision) || plan.planRevision < 1) errors.push(`unitPlans[${index}].planRevision must be positive`);
  const contextRefs = Array.isArray(plan.contextRefs) ? plan.contextRefs.map((ref, refIndex) => {
    const item = object(ref, `unitPlans[${index}].contextRefs[${refIndex}]`, errors);
    if (!text(item.sourceId) || !text(item.range) || item.role !== "context-only") errors.push(`unitPlans[${index}].contextRefs[${refIndex}] must be context-only`);
    return { sourceId: text(item.sourceId), range: text(item.range), role: "context-only" };
  }) : (errors.push(`unitPlans[${index}].contextRefs must be an array`), []);
  return { ...clone(plan), unitId, primaryCoverage, dependencies, contextRefs, requiredCapabilities, outputRole: text(plan.outputRole), fallbackPolicy: text(plan.fallbackPolicy) };
}

export function validateUnitPlanSet(input, { requiredCoverage = [] } = {}) {
  const errors = [];
  if (!Array.isArray(input) || input.length === 0) return { ok: false, errors: ["unitPlans must not be empty"], value: null };
  const plans = input.map((plan, index) => normalizeUnitPlan(plan, index, errors));
  const ids = new Set();
  const coverageOwners = new Map();
  for (const plan of plans) {
    if (ids.has(plan.unitId)) errors.push("unit ids must be unique");
    ids.add(plan.unitId);
    for (const coverage of plan.primaryCoverage) {
      if (coverageOwners.has(coverage)) errors.push(`primary coverage must have one owner: ${coverage}`);
      coverageOwners.set(coverage, plan.unitId);
    }
  }
  for (const plan of plans) for (const dependency of plan.dependencies) if (!ids.has(dependency)) errors.push(`unknown unit dependency: ${dependency}`);
  const required = new Set(requiredCoverage);
  for (const coverage of required) if (!coverageOwners.has(coverage)) errors.push(`required coverage is unplanned: ${coverage}`);
  for (const coverage of coverageOwners.keys()) if (required.size && !required.has(coverage)) errors.push(`primary coverage is not authorized: ${coverage}`);
  const visiting = new Set();
  const visited = new Set();
  const byId = new Map(plans.map((plan) => [plan.unitId, plan]));
  function visit(id) {
    if (visiting.has(id)) { errors.push(`unit dependency cycle detected at ${id}`); return; }
    if (visited.has(id) || !byId.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
  return errors.length ? { ok: false, errors, value: null } : { ok: true, errors: [], value: plans };
}

export function assertUnitPlanSet(input, options) {
  return assertResult(validateUnitPlanSet(input, options), "INVALID_UNIT_PLAN", "unit plan set");
}

export function validateUnitResult(input, { unitPlan } = {}) {
  const errors = [];
  const result = object(input, "unitResult", errors);
  const unitId = text(result.unitId);
  if (!SAFE_ID_RE.test(unitId)) errors.push("unitResult.unitId is invalid");
  if (unitPlan && unitPlan.unitId !== unitId) errors.push("unitResult does not match the unit plan");
  if (!text(result.attemptId)) errors.push("unitResult.attemptId is required");
  if (!UNIT_RESULT_STATES.has(text(result.proposedStatus))) errors.push("unitResult.proposedStatus is invalid");
  const artifactRefs = stringArray(result.artifactRefs, "unitResult.artifactRefs", errors);
  const proposedPrimaryCoverage = stringArray(result.proposedPrimaryCoverage, "unitResult.proposedPrimaryCoverage", errors);
  const contextRefsUsed = Array.isArray(result.contextRefsUsed) ? clone(result.contextRefsUsed) : (errors.push("unitResult.contextRefsUsed must be an array"), []);
  const missingSourceRanges = stringArray(result.missingSourceRanges, "unitResult.missingSourceRanges", errors);
  const evidenceRefs = stringArray(result.evidenceRefs, "unitResult.evidenceRefs", errors);
  const warnings = Array.isArray(result.warnings) ? clone(result.warnings) : (errors.push("unitResult.warnings must be an array"), []);
  if (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) errors.push("unitResult.confidence must be between 0 and 1");
  if (unitPlan) {
    const authorized = new Set(unitPlan.primaryCoverage);
    if (proposedPrimaryCoverage.some((item) => !authorized.has(item))) errors.push("unitResult exceeds authorized primary coverage");
  }
  return errors.length ? { ok: false, errors, value: null } : {
    ok: true,
    errors: [],
    value: { ...clone(result), unitId, attemptId: text(result.attemptId), proposedStatus: text(result.proposedStatus), artifactRefs, proposedPrimaryCoverage, contextRefsUsed, missingSourceRanges, evidenceRefs, warnings },
  };
}

export function assertUnitResult(input, options) {
  return assertResult(validateUnitResult(input, options), "INVALID_UNIT_RESULT", "unit result");
}

export function validateArtifactManifest(input) {
  const errors = [];
  const artifact = object(input, "artifact", errors);
  if (artifact.schemaVersion !== 1) errors.push("artifact.schemaVersion must be 1");
  for (const field of ["artifactId", "mediaType", "path", "createdAt"]) if (!text(artifact[field])) errors.push(`artifact.${field} is required`);
  if (!Number.isInteger(artifact.revision) || artifact.revision < 1) errors.push("artifact.revision must be positive");
  if (!/^[a-f0-9]{64}$/i.test(text(artifact.sha256))) errors.push("artifact.sha256 must be a SHA-256 hash");
  const primaryCoverage = stringArray(artifact.primaryCoverage, "artifact.primaryCoverage", errors);
  const contextRefs = Array.isArray(artifact.contextRefs) ? clone(artifact.contextRefs) : (errors.push("artifact.contextRefs must be an array"), []);
  const producer = object(artifact.producer, "artifact.producer", errors);
  for (const field of ["adapterVersion", "skillHash", "modelConfigFingerprint", "toolSchemaVersion"]) if (!text(producer[field])) errors.push(`artifact.producer.${field} is required`);
  return errors.length ? { ok: false, errors, value: null } : { ok: true, errors: [], value: { ...clone(artifact), primaryCoverage, contextRefs, producer: clone(producer) } };
}

export function assertArtifactManifest(input) {
  return assertResult(validateArtifactManifest(input), "INVALID_ARTIFACT_MANIFEST", "artifact manifest");
}

export function validateOutcomeEnvelope(input) {
  const errors = [];
  const outcome = object(input, "outcome", errors);
  if (outcome.schemaVersion !== 1) errors.push("outcome.schemaVersion must be 1");
  if (!TASK_ID_RE.test(text(outcome.taskId))) errors.push("outcome.taskId is invalid");
  if (!TASK_OUTCOMES.includes(text(outcome.outcome))) errors.push("outcome must be a terminal outcome");
  if (!text(outcome.summary)) errors.push("outcome.summary is required");
  const artifactRefs = stringArray(outcome.artifactRefs, "outcome.artifactRefs", errors);
  object(outcome.coverage, "outcome.coverage", errors);
  const warnings = Array.isArray(outcome.warnings) ? clone(outcome.warnings) : (errors.push("outcome.warnings must be an array"), []);
  if (typeof outcome.resumable !== "boolean") errors.push("outcome.resumable must be boolean");
  return errors.length ? { ok: false, errors, value: null } : { ok: true, errors: [], value: { ...clone(outcome), taskId: text(outcome.taskId), outcome: text(outcome.outcome), summary: text(outcome.summary), artifactRefs, warnings } };
}

export function assertOutcomeEnvelope(input) {
  return assertResult(validateOutcomeEnvelope(input), "INVALID_OUTCOME_ENVELOPE", "outcome envelope");
}

export function isTerminalLifecycle(lifecycle) {
  return lifecycle === "terminal";
}
