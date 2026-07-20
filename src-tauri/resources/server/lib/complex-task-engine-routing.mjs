/**
 * Rollout selection for the durable complex-task runner.
 *
 * This module deliberately has no launcher or provider dependencies.  The
 * selected execution engine is task metadata, not live configuration: callers
 * must invoke pinComplexTaskEngine only while creating a task.
 */

export const COMPLEX_TASK_ENGINE_MODES = Object.freeze([
  "legacy",
  "shadow",
  "v2-canary",
  "v2-default",
]);

const MODE_SET = new Set(COMPLEX_TASK_ENGINE_MODES);
const V2_EXECUTION_MODES = new Set(["v2-canary", "v2-default"]);
const LOCAL_SOURCE_KINDS = new Set(["local", "local-file", "file"]);
const REMOTE_URI_RE = /^(?:https?|ftp|data):\/\//i;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function canonicalMode(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

/** Normalize a configured rollout mode without allowing an unsafe value. */
export function normalizeComplexTaskEngine(value, fallback = "legacy") {
  const normalized = canonicalMode(value);
  if (MODE_SET.has(normalized)) return normalized;
  const normalizedFallback = canonicalMode(fallback);
  return MODE_SET.has(normalizedFallback) ? normalizedFallback : "legacy";
}

/**
 * Resolve the product rollout flag without changing the production default.
 *
 * Environment configuration deliberately wins over config.json, including
 * when it is invalid.  An invalid higher-priority value fails closed to
 * legacy instead of unexpectedly enabling a lower-priority experimental
 * value.  The diagnostic is data-only so launcher startup can log it without
 * making this module depend on logging or UI services.
 */
export function resolveComplexTaskEngineRollout({ envValue, configValue } = {}) {
  const environmentMode = canonicalMode(envValue);
  const configuredMode = canonicalMode(configValue);
  const source = environmentMode ? "environment" : configuredMode ? "config" : "default";
  const requestedMode = environmentMode || configuredMode;
  const valid = requestedMode === "" || MODE_SET.has(requestedMode);
  const mode = requestedMode && valid ? requestedMode : "legacy";
  const v2ExecutionEnabled = V2_EXECUTION_MODES.has(mode);
  const experimental = mode !== "legacy";

  const diagnostic = !valid
    ? {
      level: "warning",
      code: "COMPLEX_TASK_ENGINE_INVALID_MODE",
      message: `unsupported complex-task engine mode ${JSON.stringify(requestedMode.slice(0, 80))}; using legacy`,
    }
    : v2ExecutionEnabled
      ? {
        level: "warning",
        code: "COMPLEX_TASK_V2_PRE_INTAKE_NOT_DURABLE",
        message: `complex-task engine ${mode} is experimental; document extraction occurs before the durable Task is created`,
      }
      : {
        level: "info",
        code: "COMPLEX_TASK_ENGINE_SELECTED",
        message: `complex-task engine ${mode} selected from ${source}`,
      };

  return {
    mode,
    source,
    explicit: source !== "default",
    valid,
    experimental,
    v2ExecutionEnabled,
    preIntakeDurability: v2ExecutionEnabled ? "not-durable-before-extraction" : "not-applicable",
    diagnostic,
  };
}

/**
 * The canary is allowed to fail closed to the already-proven legacy path.
 * Explicit v2 modes must surface extraction failures instead of silently
 * changing the requested execution engine.
 */
export function shouldFallbackToLegacyOnExtractionFailure(value) {
  return normalizeComplexTaskEngine(value) === "v2-canary";
}

function normalizedSources(input) {
  if (Array.isArray(input?.sources)) return input.sources;
  if (input?.source && typeof input.source === "object" && !Array.isArray(input.source)) return [input.source];
  return [];
}

function unitIds(value) {
  if (!Array.isArray(value)) return null;
  const ids = value.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (ids.length !== value.length || new Set(ids).size !== ids.length) return null;
  return ids;
}

function inventoryComplete(source) {
  const inventory = source?.extractionInventory ?? source?.inventory;
  if (!inventory || typeof inventory !== "object" || inventory.complete !== true) return false;

  const expected = unitIds(inventory.expectedUnitIds ?? inventory.expectedUnits);
  const extracted = unitIds(inventory.extractedUnitIds ?? inventory.extractedUnits);
  const total = Number(inventory.totalUnits);
  const completed = Number(inventory.extractedUnitCount ?? inventory.completedUnits);
  const hasCounts = Number.isSafeInteger(total) && total > 0
    && Number.isSafeInteger(completed) && completed >= 0;
  if (expected && extracted) {
    if (expected.length === 0) return false;
    const extractedSet = new Set(extracted);
    return expected.length === extracted.length
      && expected.every((id) => extractedSet.has(id))
      && (!hasCounts || (expected.length === total && extracted.length === completed && completed === total));
  }

  return hasCounts && completed >= total
    && (!extracted || extracted.length === completed);
}

function sourceIsLocal(source) {
  const kind = String(source?.kind ?? source?.type ?? "").trim().toLowerCase();
  const uri = String(source?.uri ?? source?.path ?? "").trim();
  return LOCAL_SOURCE_KINDS.has(kind) && uri.length > 0 && !REMOTE_URI_RE.test(uri);
}

/**
 * Evaluate the deliberately narrow first document canary cohort.
 * Provider/model names are not inspected here; capability routing belongs to
 * the adapter and model policy layers.
 */
export function evaluateDocumentCanaryEligibility(input = {}) {
  const sources = normalizedSources(input);
  if (sources.length !== 1) {
    return {
      eligible: false,
      reason: "requires-single-source",
      sourceCount: sources.length,
    };
  }
  const source = sources[0];
  if (!sourceIsLocal(source)) {
    return {
      eligible: false,
      reason: "source-not-local",
      sourceCount: 1,
    };
  }
  if (!inventoryComplete(source)) {
    return {
      eligible: false,
      reason: "extraction-incomplete",
      sourceCount: 1,
    };
  }
  return {
    eligible: true,
    reason: "eligible",
    sourceCount: 1,
  };
}

export function isDocumentCanaryEligible(input = {}) {
  return evaluateDocumentCanaryEligibility(input).eligible;
}

function selectedAt(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  return new Date().toISOString();
}

/** Select one immutable-at-creation execution route from the current flag. */
export function selectComplexTaskEngine({ configuredMode, complexTaskEngine, sources, source, now } = {}) {
  const rolloutMode = normalizeComplexTaskEngine(configuredMode ?? complexTaskEngine);
  const canary = evaluateDocumentCanaryEligibility({ sources, source });
  let executionEngine = "legacy";
  let reason = "legacy-mode";
  let shadow = false;
  let shadowEngine;

  if (rolloutMode === "shadow") {
    shadow = true;
    shadowEngine = "v2";
    reason = "shadow-mode";
  } else if (rolloutMode === "v2-default") {
    executionEngine = "v2";
    reason = "default-v2";
  } else if (rolloutMode === "v2-canary" && canary.eligible) {
    executionEngine = "v2";
    reason = "eligible";
  } else if (rolloutMode === "v2-canary") {
    reason = canary.reason;
  }

  return {
    schemaVersion: 1,
    rolloutMode,
    executionEngine,
    shadow,
    ...(shadowEngine ? { shadowEngine } : {}),
    reason,
    canary: clone(canary),
    selectedAt: selectedAt(now),
  };
}

function isPinned(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Number(value.schemaVersion) === 1
    && MODE_SET.has(canonicalMode(value.rolloutMode))
    && (value.executionEngine === "legacy" || value.executionEngine === "v2")
    && typeof value.selectedAt === "string" && value.selectedAt.length > 0;
}

/**
 * Pin routing metadata into a task's metadata at creation time.
 * Existing valid metadata is returned unchanged, so changing the global flag
 * cannot retarget a queued/running task.
 */
export function pinComplexTaskEngine(metadata = {}, options = {}) {
  const base = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? clone(metadata)
    : {};
  if (isPinned(base.complexTaskEngine)) return base;
  base.complexTaskEngine = selectComplexTaskEngine(options);
  return base;
}
