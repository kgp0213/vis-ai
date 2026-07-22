import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPLEX_TASK_ENGINE_MODES,
  evaluateDocumentCanaryEligibility,
  isDocumentCanaryEligible,
  normalizeComplexTaskEngine,
  pinComplexTaskEngine,
  resolveComplexTaskEngineRollout,
  selectComplexTaskEngine,
  shouldFallbackToLegacyOnExtractionFailure,
} from "./complex-task-engine-routing.mjs";

const completeLocalSource = {
  sourceId: "source-1",
  uri: "C:\\work\\manual.pdf",
  kind: "local-file",
  extractionInventory: {
    complete: true,
    expectedUnitIds: ["page:1", "page:2"],
    extractedUnitIds: ["page:1", "page:2"],
  },
};

test("normalizes supported complex-task rollout modes and safely falls back", () => {
  assert.deepEqual(COMPLEX_TASK_ENGINE_MODES, ["legacy", "shadow", "v2-canary", "v2-default"]);
  assert.equal(normalizeComplexTaskEngine(" V2-CANARY "), "v2-canary");
  assert.equal(normalizeComplexTaskEngine("unknown"), "legacy");
  assert.equal(normalizeComplexTaskEngine("unknown", "v2-default"), "v2-default");
  assert.equal(normalizeComplexTaskEngine(undefined, "not-a-mode"), "legacy");
});

test("product rollout resolution keeps missing and invalid configuration on legacy", () => {
  const defaults = resolveComplexTaskEngineRollout();
  assert.deepEqual(defaults, {
    mode: "legacy",
    source: "default",
    explicit: false,
    valid: true,
    experimental: false,
    v2ExecutionEnabled: false,
    preIntakeDurability: "not-applicable",
    diagnostic: {
      level: "info",
      code: "COMPLEX_TASK_ENGINE_SELECTED",
      message: "complex-task engine legacy selected from default",
    },
  });

  const invalidEnvironment = resolveComplexTaskEngineRollout({
    envValue: "future-v9",
    configValue: "v2-default",
  });
  assert.equal(invalidEnvironment.mode, "legacy");
  assert.equal(invalidEnvironment.source, "environment");
  assert.equal(invalidEnvironment.explicit, true);
  assert.equal(invalidEnvironment.valid, false);
  assert.equal(invalidEnvironment.experimental, false);
  assert.equal(invalidEnvironment.diagnostic.code, "COMPLEX_TASK_ENGINE_INVALID_MODE");
  assert.match(invalidEnvironment.diagnostic.message, /future-v9.*using legacy/);
});

test("explicit v2 rollout is labelled experimental and exposes the pre-intake durability gap", () => {
  const canary = resolveComplexTaskEngineRollout({ configValue: " V2-CANARY " });
  assert.equal(canary.mode, "v2-canary");
  assert.equal(canary.source, "config");
  assert.equal(canary.explicit, true);
  assert.equal(canary.valid, true);
  assert.equal(canary.experimental, true);
  assert.equal(canary.v2ExecutionEnabled, true);
  assert.equal(canary.preIntakeDurability, "not-durable-before-extraction");
  assert.deepEqual(canary.diagnostic, {
    level: "warning",
    code: "COMPLEX_TASK_V2_PRE_INTAKE_NOT_DURABLE",
    message: "complex-task engine v2-canary is experimental; document extraction occurs before the durable Task is created",
  });

  const environmentOverride = resolveComplexTaskEngineRollout({
    envValue: "v2-default",
    configValue: "legacy",
  });
  assert.equal(environmentOverride.mode, "v2-default");
  assert.equal(environmentOverride.source, "environment");
  assert.equal(environmentOverride.preIntakeDurability, "not-durable-before-extraction");

  const shadow = resolveComplexTaskEngineRollout({ configValue: "shadow" });
  assert.equal(shadow.experimental, true);
  assert.equal(shadow.v2ExecutionEnabled, false);
  assert.equal(shadow.preIntakeDurability, "not-applicable");
});

test("only the experimental canary falls back when pre-extraction fails", () => {
  assert.equal(shouldFallbackToLegacyOnExtractionFailure("v2-canary"), true);
  assert.equal(shouldFallbackToLegacyOnExtractionFailure("shadow"), false);
  assert.equal(shouldFallbackToLegacyOnExtractionFailure("v2-default"), false);
  assert.equal(shouldFallbackToLegacyOnExtractionFailure("legacy"), false);
});

test("document canary requires exactly one explicit local source and complete extraction inventory", () => {
  const eligible = evaluateDocumentCanaryEligibility({ sources: [completeLocalSource] });
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.reason, "eligible");
  assert.equal(isDocumentCanaryEligible({ sources: [completeLocalSource] }), true);

  const multiple = evaluateDocumentCanaryEligibility({ sources: [completeLocalSource, completeLocalSource] });
  assert.equal(multiple.eligible, false);
  assert.equal(multiple.reason, "requires-single-source");

  const remote = evaluateDocumentCanaryEligibility({
    sources: [{ ...completeLocalSource, kind: "remote-url" }],
  });
  assert.equal(remote.eligible, false);
  assert.equal(remote.reason, "source-not-local");

  const incomplete = evaluateDocumentCanaryEligibility({
    sources: [{
      ...completeLocalSource,
      extractionInventory: {
        complete: false,
        expectedUnitIds: ["page:1", "page:2"],
        extractedUnitIds: ["page:1"],
      },
    }],
  });
  assert.equal(incomplete.eligible, false);
  assert.equal(incomplete.reason, "extraction-incomplete");
});

test("selects v2 only for eligible canary tasks and never uses provider names", () => {
  const canary = selectComplexTaskEngine({
    configuredMode: "v2-canary",
    sources: [completeLocalSource],
    providerId: "local-qwen",
    now: "2026-07-19T12:00:00.000Z",
  });
  assert.equal(canary.rolloutMode, "v2-canary");
  assert.equal(canary.executionEngine, "v2");
  assert.equal(canary.shadow, false);
  assert.equal(canary.selectedAt, "2026-07-19T12:00:00.000Z");

  const differentlyNamedProvider = selectComplexTaskEngine({
    configuredMode: "v2-canary",
    sources: [completeLocalSource],
    providerId: "deepseek-official",
  });
  assert.equal(differentlyNamedProvider.executionEngine, canary.executionEngine);
  assert.equal(differentlyNamedProvider.reason, canary.reason);

  const fallback = selectComplexTaskEngine({
    configuredMode: "v2-canary",
    sources: [{ ...completeLocalSource, kind: "remote-url" }],
  });
  assert.equal(fallback.executionEngine, "legacy");
  assert.equal(fallback.reason, "source-not-local");

  const defaultV2 = selectComplexTaskEngine({ configuredMode: "v2-default", sources: [] });
  assert.equal(defaultV2.executionEngine, "v2");
  assert.equal(defaultV2.reason, "default-v2");

  const configFieldAlias = selectComplexTaskEngine({ complexTaskEngine: "v2-default", sources: [] });
  assert.equal(configFieldAlias.executionEngine, "v2");

  const shadow = selectComplexTaskEngine({ configuredMode: "shadow", sources: [completeLocalSource] });
  assert.equal(shadow.executionEngine, "legacy");
  assert.equal(shadow.shadow, true);
  assert.equal(shadow.shadowEngine, "v2");
});

test("rejects an inventory that only claims completeness without auditable unit coverage", () => {
  const declarationOnly = evaluateDocumentCanaryEligibility({
    sources: [{
      ...completeLocalSource,
      extractionInventory: { complete: true },
    }],
  });
  assert.equal(declarationOnly.eligible, false);
  assert.equal(declarationOnly.reason, "extraction-incomplete");

  const counted = evaluateDocumentCanaryEligibility({
    sources: [{
      ...completeLocalSource,
      extractionInventory: { complete: true, totalUnits: 5, extractedUnitCount: 5 },
    }],
  });
  assert.equal(counted.eligible, true);

  const selfCertifiedButShort = evaluateDocumentCanaryEligibility({
    sources: [{
      ...completeLocalSource,
      extractionInventory: {
        complete: true,
        expectedUnitIds: ["page:1"],
        extractedUnitIds: ["page:1"],
        totalUnits: 2,
        extractedUnitCount: 1,
      },
    }],
  });
  assert.equal(selfCertifiedButShort.eligible, false);
  assert.equal(selfCertifiedButShort.reason, "extraction-incomplete");

  const emittedMoreThanDeclared = evaluateDocumentCanaryEligibility({
    sources: [{
      ...completeLocalSource,
      extractionInventory: {
        complete: true,
        expectedUnitIds: ["page:1"],
        extractedUnitIds: ["page:1", "page:2"],
        totalUnits: 1,
        extractedUnitCount: 2,
      },
    }],
  });
  assert.equal(emittedMoreThanDeclared.eligible, false);
  assert.equal(emittedMoreThanDeclared.reason, "extraction-incomplete");
});

test("pins routing metadata at task creation and ignores later flag changes", () => {
  const first = pinComplexTaskEngine({}, {
    configuredMode: "v2-canary",
    sources: [completeLocalSource],
    now: "2026-07-19T12:00:00.000Z",
  });
  assert.equal(first.complexTaskEngine.executionEngine, "v2");
  assert.equal(first.complexTaskEngine.rolloutMode, "v2-canary");

  const unchanged = pinComplexTaskEngine(first, {
    configuredMode: "legacy",
    sources: [],
    now: "2026-07-19T13:00:00.000Z",
  });
  assert.deepEqual(unchanged, first);

  const explicit = pinComplexTaskEngine({ owner: "user" }, {
    configuredMode: "legacy",
    sources: [],
  });
  assert.equal(explicit.owner, "user");
  assert.equal(explicit.complexTaskEngine.executionEngine, "legacy");
});
