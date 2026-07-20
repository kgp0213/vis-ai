import { createHash, randomUUID } from "node:crypto";
import { dirname } from "node:path";

import { assertTaskContract } from "./complex-task-contracts.mjs";
import { formatArtifactReference } from "./complex-task-artifact-reference.mjs";

export const DOCUMENT_ADAPTER_VERSION = "document-v2.1";
export const DOCUMENT_TOOL_SCHEMA_VERSION = "1";
const DOCUMENT_SKILL_TEXT = "Visionox-Whale durable document adapter: preserve every authorized source unit, report gaps explicitly, and use source text as a loss-aware fallback.";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value, fallback = "") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function safeId(value, fallback = "unit") {
  const result = text(value, fallback).replace(/[^A-Za-z0-9._:-]+/g, "_").slice(0, 120);
  return result || fallback;
}

function hash(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function sourceList(prepared) {
  return Array.isArray(prepared?.sources) && prepared.sources.length > 0 ? prepared.sources : [prepared];
}

function skillHash() {
  return `sha256:${hash(DOCUMENT_SKILL_TEXT)}`;
}

function pinnedSkillFor(task) {
  const snapshot = task?.metadata?.pinnedSkill;
  const content = text(snapshot?.content, DOCUMENT_SKILL_TEXT);
  const expectedHash = text(snapshot?.hash, text(task?.contract?.pinned?.skillHash, skillHash()));
  if (`sha256:${hash(content)}` !== expectedHash) {
    const error = new Error("document Skill snapshot does not match the pinned hash");
    error.code = "SKILL_PIN_MISMATCH";
    throw error;
  }
  return { hash: expectedHash, content, version: text(snapshot?.version, DOCUMENT_ADAPTER_VERSION) };
}

function normalizeBatches(batches) {
  const used = new Set();
  const units = [];
  const normalized = [];
  for (let batchIndex = 0; batchIndex < (Array.isArray(batches) ? batches.length : 0); batchIndex += 1) {
    const batch = batches[batchIndex] ?? {};
    const batchId = safeId(batch.id, `batch-${batchIndex + 1}`);
    const primary = [];
    for (let unitIndex = 0; unitIndex < (Array.isArray(batch.units) ? batch.units.length : 0); unitIndex += 1) {
      const source = batch.units[unitIndex] ?? {};
      const baseId = safeId(source.id, `${batchId}-unit-${unitIndex + 1}`);
      let unitId = baseId;
      let suffix = 2;
      while (used.has(unitId)) unitId = `${baseId}-${suffix++}`;
      used.add(unitId);
      const unit = {
        ...clone(source),
        id: unitId,
        location: text(source.location, `${batch.label || batchId} · unit ${unitIndex + 1}`),
        text: String(source.text ?? ""),
        batchId,
        batchIndex,
      };
      units.push(unit);
      primary.push(unitId);
    }
    normalized.push({
      ...clone(batch),
      id: batchId,
      label: text(batch.label, batchId),
      units: primary,
      contextUnits: Array.isArray(batch.contextUnits) ? clone(batch.contextUnits) : [],
    });
  }
  return { batches: normalized, units };
}

function sourceSummaryFor(sources, source, index, extractionResult) {
  if (sources.length === 1) return extractionResult && typeof extractionResult === "object" ? extractionResult : null;
  const summaries = Array.isArray(extractionResult?.sourceSummaries) ? extractionResult.sourceSummaries : [];
  const sourcePath = text(source?.sourcePath || source?.readablePath).toLowerCase();
  return summaries.find((summary) => text(summary?.sourcePath || summary?.readablePath).toLowerCase() === sourcePath)
    || summaries.find((summary) => String(summary?.sourceId || "") === text(source?.sourceId))
    || summaries[index]
    || null;
}

function sourceInventory(source, unitIds, summary) {
  const extracted = [...new Set(unitIds.map(String).filter(Boolean))];
  const declaredTotal = Number(summary?.totalUnits);
  const totalUnits = Number.isSafeInteger(declaredTotal) && declaredTotal > 0 ? declaredTotal : null;
  const extractedUnitCount = extracted.length;
  const selectedPages = Number(summary?.selectedPages);
  const processedPages = Number(summary?.processedPages);
  const pageCoverageKnown = Number.isSafeInteger(selectedPages) && Number.isSafeInteger(processedPages);
  const explicitExpected = Array.isArray(summary?.expectedUnitIds)
    ? [...new Set(summary.expectedUnitIds.map(String).filter(Boolean))]
    : null;
  const countComplete = totalUnits !== null && totalUnits === extractedUnitCount;
  const pageComplete = !pageCoverageKnown || selectedPages === processedPages;
  const expectedComplete = !explicitExpected || (explicitExpected.length === extracted.length && explicitExpected.every((id) => extracted.includes(id)));
  return {
    complete: countComplete && pageComplete && expectedComplete,
    ...(explicitExpected ? { expectedUnitIds: explicitExpected } : {}),
    extractedUnitIds: extracted,
    totalUnits,
    extractedUnitCount,
    ...(pageCoverageKnown ? { selectedPages, processedPages } : {}),
    sourcePath: source?.sourcePath || source?.readablePath || null,
    evidence: "extractor-declared",
  };
}

/**
 * Build source inventories from extractor-declared totals, independently of
 * the units collected by the caller.  An emitted unit list is evidence of
 * what was received, never a declaration of what should have existed.
 */
export function buildDocumentSourceInventories({ prepared, batches = [], extractionResult } = {}) {
  const normalized = normalizeBatches(batches);
  const sources = sourceList(prepared);
  return sources.map((source, index) => {
    const sourceId = text(source?.sourceId, `source-${String(index + 1).padStart(3, "0")}`);
    const sourceUnits = normalized.units.filter((unit) => unitBelongsToSource(unit, source, sourceId, index, sources.length));
    return {
      sourceId,
      inventory: sourceInventory(source, sourceUnits.map((unit) => unit.id), sourceSummaryFor(sources, source, index, extractionResult)),
    };
  });
}

function unitBelongsToSource(unit, source, sourceId, sourceIndex, sourceCount) {
  const unitSourceId = text(unit?.sourceId);
  if (unitSourceId) {
    if (unitSourceId === sourceId || unitSourceId.startsWith(`${sourceId}-`) || sourceId.startsWith(`${unitSourceId}-`)) return true;
  }
  const unitSourcePath = text(unit?.sourcePath);
  const sourcePath = text(source?.sourcePath || source?.readablePath);
  if (unitSourcePath && sourcePath && unitSourcePath.toLowerCase() === sourcePath.toLowerCase()) return true;
  // Older single-source extractors did not annotate source ownership. Keep
  // their unambiguous behavior while refusing to infer ownership for a
  // multi-source collection without an explicit identity.
  return sourceCount === 1 || (!unitSourceId && !unitSourcePath && Number(unit?.batchIndex) === sourceIndex);
}

export function buildDocumentTaskDraft({
  taskId = `task:${randomUUID()}`,
  prepared,
  batches = [],
  extractionResult,
  outputPath,
  workspace,
  goal = "将文档整理为完整 Markdown",
  instructions = "",
  fidelity = "complete-with-summary",
  modelConfigFingerprints = [],
  enginePin,
  adapterVersion = DOCUMENT_ADAPTER_VERSION,
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeBatches(batches);
  const sources = sourceList(prepared);
  const inventories = buildDocumentSourceInventories({ prepared, batches, extractionResult });
  if (inventories.length === 0 || inventories.some((entry) => entry.inventory.complete !== true)) {
    const error = new Error("document extraction inventory is incomplete; the extractor-declared source totals do not match the emitted units");
    error.code = "EXTRACTION_INCOMPLETE";
    error.inventories = clone(inventories);
    throw error;
  }
  const sourceIds = sources.map((source, index) => text(source?.sourceId, `source-${String(index + 1).padStart(3, "0")}`));
  const requiredCoverage = normalized.units.map((unit) => unit.id);
  if (requiredCoverage.length === 0) throw new Error("document task requires at least one extracted source unit");
  const documentUnits = Object.fromEntries(normalized.units.map((unit) => [unit.id, clone(unit)]));
  const unitPlans = normalized.batches.map((batch, index) => {
    const previous = index > 0 ? [normalized.batches[index - 1].id] : [];
    const contextRefs = [];
    for (const context of batch.contextUnits) {
      const id = safeId(context?.id, "context");
      contextRefs.push({ sourceId: text(context?.sourceId, sourceIds[0]), range: text(context?.location, id), role: "context-only" });
    }
    const visual = batch.units.some((unitId) => {
      const unit = documentUnits[unitId];
      return unit?.visualPending === true || Boolean(unit?.visualDataUrl) || Boolean(unit?.visualType);
    });
    return {
      unitId: batch.id,
      primaryCoverage: [...batch.units],
      dependencies: previous,
      contextRefs,
      requiredCapabilities: visual ? ["vision"] : ["text"],
      outputRole: "markdown-section",
      fallbackPolicy: "preserve-source",
      planRevision: 1,
    };
  });
  const sourceObjects = sources.map((source, index) => {
    const sourceUnits = normalized.units.filter((unit) => unitBelongsToSource(unit, source, sourceIds[index], index, sources.length));
    const uri = text(source?.sourcePath || source?.readablePath, `source-${index + 1}`);
    const fingerprint = text(source?.fingerprint || source?.sourceFingerprint || prepared?.sourceFingerprint, `sha256:${hash(uri)}`);
    return {
      sourceId: sourceIds[index],
      uri,
      kind: text(source?.documentKind, "document"),
      fingerprint,
      required: true,
      extractionInventory: clone(inventories[index]?.inventory),
    };
  });
  const requestedPath = text(outputPath, "document.md");
  const root = text(workspace, dirname(requestedPath));
  const contract = {
    schemaVersion: 1,
    taskId,
    taskType: "document.markdown",
    goal: text(goal),
    workspace: root,
    sources: sourceObjects,
    output: { format: "markdown", requestedPath, conflictPolicy: "ask" },
    completion: { requiredCoverage, requiredArtifacts: ["final-markdown"] },
    quality: {
      requestedFidelity: fidelity === "summary-only" ? "summary-only" : "complete-with-summary",
      semanticReviewMode: "optional",
      maxRepairPasses: 1,
    },
    permissions: { readSources: true, writeOutput: true },
    interactionPolicy: { mode: "ask_when_blocked", deliveryChannels: ["task-center", "conversation"] },
    executionLimits: { wallClockMs: 14_400_000, stallTimeoutMs: 600_000, attemptLimit: 4 },
    pinned: {
      adapterVersion,
      skillHash: skillHash(),
      toolSchemaVersion: DOCUMENT_TOOL_SCHEMA_VERSION,
      initialModelConfigFingerprints: Array.isArray(modelConfigFingerprints) ? [...modelConfigFingerprints] : [],
    },
  };
  const checked = assertTaskContract(contract);
  return {
    contract: checked,
    unitPlans,
    metadata: {
      adapter: "document",
      adapterVersion,
      createdAt: now,
      title: text(goal),
      instructions: String(instructions ?? ""),
      pinnedSkill: { hash: skillHash(), content: DOCUMENT_SKILL_TEXT, version: adapterVersion },
      documentUnits,
      batchOrder: normalized.batches.map((batch) => batch.id),
      extractionInventory: {
        complete: inventories.every((entry) => entry.inventory.complete === true),
        totalUnits: inventories.reduce((sum, entry) => sum + (Number(entry.inventory.totalUnits) || 0), 0),
        extractedUnitCount: normalized.units.length,
        extractedUnitIds: normalized.units.map((unit) => unit.id),
        sourceSummaries: inventories.map((entry) => ({ sourceId: entry.sourceId, ...clone(entry.inventory) })),
      },
      ...(enginePin ? { complexTaskEngine: clone(enginePin) } : {}),
    },
  };
}

function artifactIdFor(task, unitPlan) {
  return `artifact:${safeId(task?.id || task?.contract?.taskId)}:${safeId(unitPlan.unitId)}`;
}

function artifactRevisionFor(task, attempt = 1) {
  const epoch = Math.max(1, Number.isSafeInteger(Number(task?.epoch)) ? Number(task.epoch) : 1);
  const attemptNumber = Math.max(1, Math.min(999, Number.isSafeInteger(Number(attempt)) ? Number(attempt) : 1));
  return ((epoch - 1) * 1_000) + attemptNumber;
}

function recoveryAttemptFor(diagnostics) {
  const attempts = Array.isArray(diagnostics?.attempts) ? diagnostics.attempts : [];
  const highestModelAttempt = attempts.reduce((highest, entry) => {
    const attempt = Number(entry?.attempt);
    return Number.isSafeInteger(attempt) && attempt > highest ? attempt : highest;
  }, 0);
  return Math.min(999, highestModelAttempt + 1) || 1;
}

function normalizeGenerated(value, unitPlan, units) {
  if (value && typeof value === "object" && value.kind === "user_input_request") return value;
  const objectValue = value && typeof value === "object" ? value : {};
  const fallback = units.map((unit) => String(unit?.text ?? "")).filter(Boolean).join("\n\n");
  const content = String(objectValue.markdown ?? objectValue.content ?? objectValue.text ?? (typeof value === "string" ? value : fallback));
  const usedFallback = !content.trim() || (typeof value !== "object" && !String(value ?? "").trim());
  return {
    markdown: content.trim() || fallback,
    proposedStatus: objectValue.proposedStatus || (usedFallback ? "skipped" : "completed"),
    warnings: Array.isArray(objectValue.warnings) ? objectValue.warnings : [],
    confidence: Number.isFinite(Number(objectValue.confidence)) ? Number(objectValue.confidence) : (usedFallback ? 0.25 : 0.8),
    nextActionProposal: objectValue.nextActionProposal || (usedFallback ? "review-source-fallback" : "continue"),
    modelConfigFingerprint: text(objectValue.modelConfigFingerprint, ""),
    fallbackKind: text(objectValue.fallbackKind, usedFallback ? "source" : ""),
  };
}

function assertRuntimePins(task) {
  const pinned = task?.contract?.pinned;
  if (!pinned || typeof pinned !== "object") return;
  const actual = {
    adapterVersion: DOCUMENT_ADAPTER_VERSION,
    skillHash: skillHash(),
    toolSchemaVersion: DOCUMENT_TOOL_SCHEMA_VERSION,
  };
  for (const field of ["adapterVersion", "skillHash", "toolSchemaVersion"]) {
    if (String(pinned[field] ?? "") && String(pinned[field]) !== actual[field]) {
      const error = new Error(`document runtime pin mismatch: ${field} expected ${pinned[field]} but loaded ${actual[field]}`);
      error.code = "RUNTIME_PIN_MISMATCH";
      error.field = field;
      error.expected = String(pinned[field]);
      error.actual = actual[field];
      throw error;
    }
  }
}

async function reportProgressSafely(reportProgress, evidence) {
  if (typeof reportProgress !== "function") return { ok: false, reason: "progress-reporter-unavailable" };
  try {
    return await reportProgress(evidence);
  } catch (error) {
    return { ok: false, reason: "progress-report-failed", message: String(error?.message || error) };
  }
}

export function createComplexDocumentAdapter({ artifactStore, generateUnit } = {}) {
  if (!artifactStore || typeof artifactStore.put !== "function") throw new TypeError("document adapter requires an artifact store");
  const generate = typeof generateUnit === "function" ? generateUnit : async ({ unitPlan, sourceUnits }) => ({
    markdown: sourceUnits.map((unit) => unit.text).join("\n\n"),
    proposedStatus: "skipped",
    warnings: [{ code: "SOURCE_FALLBACK", message: `unit ${unitPlan.unitId} used extracted source text` }],
    confidence: 0.25,
  });

  async function executeUnit({ task, unitPlan, attempt = 1, attemptId, signal, tools, reportProgress } = {}) {
    assertRuntimePins(task);
    const pinnedSkill = pinnedSkillFor(task);
    const allUnits = task?.metadata?.documentUnits && typeof task.metadata.documentUnits === "object" ? task.metadata.documentUnits : {};
    const sourceUnits = unitPlan.primaryCoverage.map((id) => allUnits[id]).filter(Boolean);
    const contextUnits = (Array.isArray(unitPlan.contextRefs) ? unitPlan.contextRefs : []).map((ref) => Object.values(allUnits).find((unit) => unit.location === ref.range || unit.id === ref.range)).filter(Boolean);
    const generated = normalizeGenerated(await generate({ task: clone(task), unitPlan: clone(unitPlan), sourceUnits: clone(sourceUnits), contextUnits: clone(contextUnits), attempt, attemptId, signal, tools, reportProgress, pinnedSkill: clone(pinnedSkill) }), unitPlan, sourceUnits);
    if (generated.kind === "user_input_request") return generated;
    if (!generated.markdown.trim()) {
      return {
        unitId: unitPlan.unitId,
        attemptId: text(attemptId, `attempt-${attempt}`),
        proposedStatus: "needs_review",
        artifactRefs: [],
        proposedPrimaryCoverage: [],
        contextRefsUsed: [...(unitPlan.contextRefs ?? [])],
        missingSourceRanges: [...unitPlan.primaryCoverage],
        evidenceRefs: sourceUnits.map((unit) => unit.id),
        warnings: [...generated.warnings, { code: "EMPTY_GENERATED_CONTENT", message: "没有可读内容：模型没有生成结果，当前来源也没有可用原文回退，无法安全标记为已完成；请改用支持当前输入的模型或人工处理。" }],
        confidence: 0,
        nextActionProposal: "retry-with-capable-model-or-human-review",
        fallbackKind: "unavailable",
      };
    }
    const artifactId = artifactIdFor(task, unitPlan);
    const revision = artifactRevisionFor(task, attempt);
    const ownerTaskId = text(task?.id || task?.contract?.taskId);
    const stored = await artifactStore.put({
      manifest: {
        schemaVersion: 1,
        artifactId,
        revision,
        mediaType: "text/markdown",
        primaryCoverage: [...unitPlan.primaryCoverage],
        contextRefs: [...(unitPlan.contextRefs ?? [])],
        owner: { taskId: ownerTaskId, unitId: unitPlan.unitId, epoch: Math.max(1, Number(task?.epoch) || 1), attemptId: text(attemptId, `attempt-${attempt}`), kind: "unit" },
        producer: {
          adapterVersion: DOCUMENT_ADAPTER_VERSION,
          skillHash: skillHash(),
          modelConfigFingerprint: text(generated.modelConfigFingerprint, text(task?.metadata?.currentModelConfigFingerprint, "unknown")),
          toolSchemaVersion: DOCUMENT_TOOL_SCHEMA_VERSION,
          ...(generated.fallbackKind ? { fallbackKind: generated.fallbackKind } : {}),
        },
      },
      content: generated.markdown,
    });
    if (stored.ok === false) throw new Error(`document artifact conflict: ${artifactId}@${revision}`);
    const artifactRef = formatArtifactReference(stored.manifest);
    await reportProgressSafely(reportProgress, {
      kind: "artifact-committed",
      unitId: unitPlan.unitId,
      attemptId: text(attemptId, `attempt-${attempt}`),
      coverage: [...unitPlan.primaryCoverage],
      message: artifactRef,
    });
    return {
      unitId: unitPlan.unitId,
      attemptId: text(attemptId, `attempt-${attempt}`),
      proposedStatus: generated.proposedStatus,
      artifactRefs: [artifactRef],
      proposedPrimaryCoverage: [...unitPlan.primaryCoverage],
      contextRefsUsed: [...(unitPlan.contextRefs ?? [])],
      missingSourceRanges: [],
      evidenceRefs: sourceUnits.map((unit) => unit.id),
      warnings: generated.warnings,
      confidence: generated.confidence,
      nextActionProposal: generated.nextActionProposal,
    };
  }

  async function recoverUnit({ task, unitPlan, attemptId, diagnostics, reportProgress } = {}) {
    assertRuntimePins(task);
    const allUnits = task?.metadata?.documentUnits && typeof task.metadata.documentUnits === "object" ? task.metadata.documentUnits : {};
    const sourceUnits = unitPlan.primaryCoverage.map((id) => allUnits[id]).filter(Boolean);
    const content = sourceUnits.map((unit) => String(unit?.text ?? "")).filter(Boolean).join("\n\n");
    if (!content.trim()) {
      return {
        unitId: unitPlan.unitId,
        attemptId: text(attemptId, `source-fallback-${unitPlan.unitId}`),
        proposedStatus: "needs_review",
        artifactRefs: [],
        proposedPrimaryCoverage: [],
        contextRefsUsed: [],
        missingSourceRanges: [...unitPlan.primaryCoverage],
        evidenceRefs: sourceUnits.map((unit) => unit.id),
        warnings: [{ code: "SOURCE_FALLBACK_UNAVAILABLE", message: "模型整理失败，当前来源没有可读原文，无法生成安全的回退文档；请改用多模态模型或人工处理。" }],
        confidence: 0,
        nextActionProposal: "retry-with-multimodal-or-human-review",
        fallbackKind: "unavailable",
      };
    }
    const artifactId = artifactIdFor(task, unitPlan);
    const revision = artifactRevisionFor(task, recoveryAttemptFor(diagnostics));
    const ownerTaskId = text(task?.id || task?.contract?.taskId);
    const stored = await artifactStore.put({
      manifest: {
        schemaVersion: 1,
        artifactId,
        revision,
        mediaType: "text/markdown",
        primaryCoverage: [...unitPlan.primaryCoverage],
        contextRefs: [],
        owner: { taskId: ownerTaskId, unitId: unitPlan.unitId, epoch: Math.max(1, Number(task?.epoch) || 1), attemptId: text(attemptId, `source-fallback-${unitPlan.unitId}`), kind: "unit" },
        producer: {
          adapterVersion: DOCUMENT_ADAPTER_VERSION,
          skillHash: skillHash(),
          modelConfigFingerprint: text(task?.metadata?.currentModelConfigFingerprint, "host:source-fallback"),
          toolSchemaVersion: DOCUMENT_TOOL_SCHEMA_VERSION,
          fallbackKind: "source",
        },
      },
      content,
    });
    if (stored.ok === false) throw new Error(`document source fallback artifact conflict: ${artifactId}`);
    const artifactRef = formatArtifactReference(stored.manifest);
    await reportProgressSafely(reportProgress, {
      kind: "artifact-committed",
      unitId: unitPlan.unitId,
      attemptId: text(attemptId, `source-fallback-${unitPlan.unitId}`),
      coverage: [...unitPlan.primaryCoverage],
      message: artifactRef,
    });
    return {
      unitId: unitPlan.unitId,
      attemptId: text(attemptId, `source-fallback-${unitPlan.unitId}`),
      proposedStatus: "skipped",
      artifactRefs: [artifactRef],
      proposedPrimaryCoverage: [...unitPlan.primaryCoverage],
      contextRefsUsed: [],
      missingSourceRanges: [],
      evidenceRefs: sourceUnits.map((unit) => unit.id),
      warnings: [{ code: "SOURCE_FALLBACK", message: "模型整理失败，已保留提取出的原文作为可交付内容；该区块需要复核。" }],
      confidence: 0.2,
      nextActionProposal: "review-source-fallback",
      fallbackKind: "source",
    };
  }

  async function selectPrimaryCandidate({ candidates }) {
    return [...candidates].sort((left, right) => Number(right.manifest.revision) - Number(left.manifest.revision)
      || String(left.manifest.artifactId).localeCompare(String(right.manifest.artifactId)))[0]?.manifest?.artifactId ?? null;
  }

  async function assemble({ task, selectedArtifacts = [] } = {}) {
    const order = new Map((task?.unitPlans ?? []).map((plan, index) => [plan.unitId, index]));
    const coverageOrder = new Map();
    for (const [index, plan] of (task?.unitPlans ?? []).entries()) {
      for (const coverage of plan.primaryCoverage ?? []) coverageOrder.set(String(coverage), index);
    }
    const artifactOrder = (artifact) => Math.min(...(artifact?.manifest?.primaryCoverage ?? []).map((coverage) => coverageOrder.get(String(coverage)) ?? Number.MAX_SAFE_INTEGER));
    const sorted = [...selectedArtifacts].sort((left, right) => artifactOrder(left) - artifactOrder(right)
      || (order.get(left.unitPlan?.unitId) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.unitPlan?.unitId) ?? Number.MAX_SAFE_INTEGER));
    const chunks = [];
    for (const artifact of sorted) {
      const unitIds = artifact.manifest.primaryCoverage ?? [];
      const labels = unitIds.map((id) => task?.metadata?.documentUnits?.[id]?.location || id).join("、");
      chunks.push(`## ${labels || artifact.manifest.artifactId}\n\n${artifact.content.toString("utf8").trim()}`);
    }
    return chunks.join("\n\n");
  }

  return {
    executeUnit,
    recoverUnit,
    selectPrimaryCandidate,
    assemble,
    version: DOCUMENT_ADAPTER_VERSION,
    adapterVersion: DOCUMENT_ADAPTER_VERSION,
    skillHash: skillHash(),
    toolSchemaVersion: DOCUMENT_TOOL_SCHEMA_VERSION,
  };
}
