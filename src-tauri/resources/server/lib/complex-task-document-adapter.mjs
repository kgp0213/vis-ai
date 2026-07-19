import { createHash, randomUUID } from "node:crypto";
import { dirname } from "node:path";

import { assertTaskContract } from "./complex-task-contracts.mjs";

export const DOCUMENT_ADAPTER_VERSION = "document-v2.1";
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

function sourceInventory(source, unitIds) {
  return {
    complete: true,
    expectedUnitIds: [...unitIds],
    extractedUnitIds: [...unitIds],
    totalUnits: unitIds.length,
    extractedUnitCount: unitIds.length,
    sourcePath: source?.sourcePath || source?.readablePath || null,
  };
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
      extractionInventory: sourceInventory(source, sourceUnits.map((unit) => unit.id)),
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
      toolSchemaVersion: "1",
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
      documentUnits,
      batchOrder: normalized.batches.map((batch) => batch.id),
      extractionInventory: {
        complete: true,
        expectedUnitIds: [...requiredCoverage],
        extractedUnitIds: [...requiredCoverage],
        totalUnits: requiredCoverage.length,
        extractedUnitCount: requiredCoverage.length,
      },
      ...(enginePin ? { complexTaskEngine: clone(enginePin) } : {}),
    },
  };
}

function artifactIdFor(task, unitPlan) {
  return `artifact:${safeId(task.id)}:${safeId(unitPlan.unitId)}`;
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

export function createComplexDocumentAdapter({ artifactStore, generateUnit } = {}) {
  if (!artifactStore || typeof artifactStore.put !== "function") throw new TypeError("document adapter requires an artifact store");
  const generate = typeof generateUnit === "function" ? generateUnit : async ({ unitPlan, sourceUnits }) => ({
    markdown: sourceUnits.map((unit) => unit.text).join("\n\n"),
    proposedStatus: "skipped",
    warnings: [{ code: "SOURCE_FALLBACK", message: `unit ${unitPlan.unitId} used extracted source text` }],
    confidence: 0.25,
  });

  async function executeUnit({ task, unitPlan, attempt = 1, attemptId, signal, tools } = {}) {
    const allUnits = task?.metadata?.documentUnits && typeof task.metadata.documentUnits === "object" ? task.metadata.documentUnits : {};
    const sourceUnits = unitPlan.primaryCoverage.map((id) => allUnits[id]).filter(Boolean);
    const contextUnits = (Array.isArray(unitPlan.contextRefs) ? unitPlan.contextRefs : []).map((ref) => Object.values(allUnits).find((unit) => unit.location === ref.range || unit.id === ref.range)).filter(Boolean);
    const generated = normalizeGenerated(await generate({ task: clone(task), unitPlan: clone(unitPlan), sourceUnits: clone(sourceUnits), contextUnits: clone(contextUnits), signal, tools }), unitPlan, sourceUnits);
    if (generated.kind === "user_input_request") return generated;
    const artifactId = artifactIdFor(task, unitPlan);
    const revision = Math.max(1, Number(attempt) || 1);
    const stored = await artifactStore.put({
      manifest: {
        schemaVersion: 1,
        artifactId,
        revision,
        mediaType: "text/markdown",
        primaryCoverage: [...unitPlan.primaryCoverage],
        contextRefs: [...(unitPlan.contextRefs ?? [])],
        producer: {
          adapterVersion: text(task?.contract?.pinned?.adapterVersion, DOCUMENT_ADAPTER_VERSION),
          skillHash: text(task?.contract?.pinned?.skillHash, skillHash()),
          modelConfigFingerprint: text(generated.modelConfigFingerprint, text(task?.metadata?.currentModelConfigFingerprint, "unknown")),
          toolSchemaVersion: text(task?.contract?.pinned?.toolSchemaVersion, "1"),
          ...(generated.fallbackKind ? { fallbackKind: generated.fallbackKind } : {}),
        },
      },
      content: generated.markdown,
    });
    if (stored.ok === false) throw new Error(`document artifact conflict: ${artifactId}@${revision}`);
    return {
      unitId: unitPlan.unitId,
      attemptId: text(attemptId, `attempt-${attempt}`),
      proposedStatus: generated.proposedStatus,
      artifactRefs: [stored.manifest.artifactId],
      proposedPrimaryCoverage: [...unitPlan.primaryCoverage],
      contextRefsUsed: [...(unitPlan.contextRefs ?? [])],
      missingSourceRanges: [],
      evidenceRefs: sourceUnits.map((unit) => unit.id),
      warnings: generated.warnings,
      confidence: generated.confidence,
      nextActionProposal: generated.nextActionProposal,
    };
  }

  async function recoverUnit({ task, unitPlan, attemptId } = {}) {
    const allUnits = task?.metadata?.documentUnits && typeof task.metadata.documentUnits === "object" ? task.metadata.documentUnits : {};
    const sourceUnits = unitPlan.primaryCoverage.map((id) => allUnits[id]).filter(Boolean);
    const content = sourceUnits.map((unit) => String(unit?.text ?? "")).filter(Boolean).join("\n\n");
    const artifactId = artifactIdFor(task, unitPlan);
    const stored = await artifactStore.put({
      manifest: {
        schemaVersion: 1,
        artifactId,
        revision: 1,
        mediaType: "text/markdown",
        primaryCoverage: [...unitPlan.primaryCoverage],
        contextRefs: [],
        producer: {
          adapterVersion: text(task?.contract?.pinned?.adapterVersion, DOCUMENT_ADAPTER_VERSION),
          skillHash: text(task?.contract?.pinned?.skillHash, skillHash()),
          modelConfigFingerprint: text(task?.metadata?.currentModelConfigFingerprint, "host:source-fallback"),
          toolSchemaVersion: text(task?.contract?.pinned?.toolSchemaVersion, "1"),
          fallbackKind: "source",
        },
      },
      content,
    });
    if (stored.ok === false) throw new Error(`document source fallback artifact conflict: ${artifactId}`);
    return {
      unitId: unitPlan.unitId,
      attemptId: text(attemptId, `source-fallback-${unitPlan.unitId}`),
      proposedStatus: "skipped",
      artifactRefs: [stored.manifest.artifactId],
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

  return { executeUnit, recoverUnit, selectPrimaryCandidate, assemble, version: DOCUMENT_ADAPTER_VERSION, skillHash: skillHash() };
}
