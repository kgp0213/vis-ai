import { createHash } from "node:crypto";
import { basename, dirname, extname } from "node:path";

import {
  buildDocumentContract,
  buildDocumentReviewMessages,
  buildDocumentSectionMessages,
  createDocumentContextUnit,
  evaluateDocumentAssembly,
  evaluateDocumentQuality,
  normalizeDocumentPolicy,
  parseDocumentReview,
  renderDocumentSourceFallback,
} from "./document-intelligence.mjs";

function abortError(message = "document task cancelled") {
  return new DOMException(message, "AbortError");
}

function delay(ms, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(abortError());
    }, { once: true });
  });
}

function cleanMarkdown(value) {
  let text = String(value ?? "").trim();
  const fenced = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) text = fenced[1].trim();
  return text.replace(/^# (?!#)/gm, "## ");
}

function titleForPath(path) {
  const name = basename(String(path ?? "document"));
  const extension = extname(name);
  return extension ? name.slice(0, -extension.length) : name;
}

function batchSummary(section, batch) {
  const compact = String(section ?? "")
    .replace(/<!--[^>]*-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${batch.label || batch.id}: ${compact.slice(0, 1_200)}`;
}

function normalizeBatch(batch, index = 0) {
  const units = Array.isArray(batch?.units) ? batch.units.map((unit, unitIndex) => ({
    ...unit,
    id: String(unit?.id || `${batch?.id || `batch-${index + 1}`}-unit-${unitIndex + 1}`),
    location: String(unit?.location || unit?.id || `unit ${unitIndex + 1}`),
    text: String(unit?.text ?? ""),
  })) : [];
  const contextUnits = Array.isArray(batch?.contextUnits) ? batch.contextUnits.map((unit, unitIndex) => ({
    ...unit,
    id: String(unit?.id || `${batch?.id || `batch-${index + 1}`}-context-${unitIndex + 1}`),
    location: String(unit?.location || unit?.id || `context ${unitIndex + 1}`),
    text: String(unit?.text ?? ""),
    contextRole: unit?.contextRole === "before" ? "before" : "after",
    contextOnly: true,
    visualDataUrl: null,
  })) : [];
  return {
    ...batch,
    id: String(batch?.id || `batch-${String(index + 1).padStart(4, "0")}`),
    index: Number(batch?.index) || index + 1,
    label: String(batch?.label || units[0]?.location || `batch ${index + 1}`),
    units,
    contextUnits,
    unitIds: units.map((unit) => unit.id),
    text: String(batch?.text || units.map((unit) => `--- Source unit ${unit.id} (${unit.location}) ---\n\n${unit.text}`).join("\n\n")),
  };
}

function uniqueContextUnits(units) {
  const seen = new Set();
  return units.filter((unit) => {
    if (!unit) return false;
    const key = `${unit.contextRole}:${unit.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitBatchWithContext(batch, runtime, countTokens) {
  const middle = Math.ceil(batch.units.length / 2);
  const leftUnits = batch.units.slice(0, middle);
  const rightUnits = batch.units.slice(middle);
  const contextOptions = { maxTokens: runtime.policy.contextOverlapTokens, countTokens };
  const useContext = runtime.policy.semanticBatching !== false;
  const inheritedBefore = useContext ? batch.contextUnits.filter((unit) => unit.contextRole === "before") : [];
  const inheritedAfter = useContext ? batch.contextUnits.filter((unit) => unit.contextRole === "after") : [];
  const left = normalizeBatch({
    id: `${batch.id}-a`,
    label: `${batch.label} A`,
    units: leftUnits,
    contextUnits: uniqueContextUnits([
      ...inheritedBefore,
      useContext ? createDocumentContextUnit(rightUnits[0], "after", contextOptions) : null,
    ]),
  });
  const right = normalizeBatch({
    id: `${batch.id}-b`,
    label: `${batch.label} B`,
    units: rightUnits,
    contextUnits: uniqueContextUnits([
      useContext ? createDocumentContextUnit(leftUnits.at(-1), "before", contextOptions) : null,
      ...inheritedAfter,
    ]),
  });
  return { left, right };
}

function unitManifest(units) {
  return units.map((unit) => {
    const text = String(unit.text ?? "");
    return {
      id: unit.id,
      location: unit.location,
      chars: text.length,
      sourceHash: unit.sourceHash || createHash("sha256").update(text).digest("hex"),
    };
  });
}

function batchRecordMatches(record, batch) {
  if (!record || record.id !== batch.id) return false;
  const expected = unitManifest(batch.units);
  const actual = Array.isArray(record.unitManifest) ? record.unitManifest : [];
  if (actual.length !== expected.length || record.unitIds?.length !== batch.unitIds.length) return false;
  return expected.every((unit, index) => {
    const saved = actual[index];
    return saved?.id === unit.id
      && record.unitIds[index] === unit.id
      && saved.chars === unit.chars
      && typeof saved.sourceHash === "string"
      && saved.sourceHash === unit.sourceHash;
  });
}

function candidateKey(candidate) {
  return candidate?.key || `${candidate?.providerId || "unknown"}\0${candidate?.modelId || "unknown"}`;
}

function effectiveDocumentPolicy(value, candidates = []) {
  const base = normalizeDocumentPolicy(value);
  const merged = { ...base };
  const minimumFields = [
    "batchInputTokens",
    "batchOutputTokens",
    "maxUnitsPerBatch",
    "maxRetries",
    "contextOverlapTokens",
    "maxSplitDepth",
    "maxModelCallsPerBatch",
    "maxVisualUnitsPerBatch",
    "requestTimeoutMs",
  ];
  for (const candidate of candidates) {
    const policy = candidate?.documentPolicy;
    if (policy && typeof policy === "object" && !Array.isArray(policy)) {
      for (const field of minimumFields) {
        if (Number.isSafeInteger(policy[field])) merged[field] = Math.min(merged[field], policy[field]);
      }
    }
    if (candidate?.multimodal === true && Number.isSafeInteger(candidate.maxImages)) {
      merged.maxVisualUnitsPerBatch = Math.min(merged.maxVisualUnitsPerBatch, candidate.maxImages);
    }
  }
  return normalizeDocumentPolicy(merged);
}

function documentPolicyTrace(requested, effective, candidates) {
  return {
    requested: {
      batchInputTokens: requested.batchInputTokens,
      batchOutputTokens: requested.batchOutputTokens,
      maxUnitsPerBatch: requested.maxUnitsPerBatch,
    },
    effective: {
      batchInputTokens: effective.batchInputTokens,
      batchOutputTokens: effective.batchOutputTokens,
      maxUnitsPerBatch: effective.maxUnitsPerBatch,
      maxVisualUnitsPerBatch: effective.maxVisualUnitsPerBatch,
      requestTimeoutMs: effective.requestTimeoutMs,
    },
    candidates: candidates.map((candidate) => ({
      providerId: candidate.providerId,
      modelId: candidate.modelId,
      role: candidate.role,
      multimodal: candidate.multimodal === true,
      hasDocumentPolicy: Boolean(candidate.documentPolicy),
      documentPolicy: candidate.documentPolicy ? {
        batchInputTokens: candidate.documentPolicy.batchInputTokens ?? null,
        batchOutputTokens: candidate.documentPolicy.batchOutputTokens ?? null,
        maxUnitsPerBatch: candidate.documentPolicy.maxUnitsPerBatch ?? null,
      } : null,
    })),
  };
}

export function isNonRetryableDocumentModelError(error) {
  const message = String(error?.message || error || "");
  if (/\b429\b|rate.?limit|temporar(?:y|ily)|\b5\d\d\b/i.test(message)) return false;
  return /(?:\b(?:400|401|403|404|405|410|422)\b|invalid_request_error|failed to deserialize|unknown variant|unsupported (?:content|media|message)|model .* (?:not found|does not exist))/i.test(message);
}

function messagesWithBatchVisuals(messages, batch, candidate) {
  if (candidate?.multimodal !== true) return { messages, visualUnitIds: [] };
  const maxImages = Math.max(1, Math.min(20, Number(candidate.maxImages) || 5));
  const visualUnits = (batch.units ?? []).filter((unit) => unit.visualPending && /^data:image\//i.test(String(unit.visualDataUrl || ""))).slice(0, maxImages);
  if (visualUnits.length === 0) return { messages, visualUnitIds: [] };
  const next = messages.map((message) => ({ ...message }));
  const userIndex = next.findLastIndex((message) => message.role === "user");
  if (userIndex < 0) return { messages, visualUnitIds: [] };
  const original = typeof next[userIndex].content === "string" ? next[userIndex].content : JSON.stringify(next[userIndex].content ?? "");
  next[userIndex].content = [
    { type: "text", text: `${original}\n\nThe following images correspond to source units. Analyze visible information and preserve it under the matching source-unit marker.` },
    ...visualUnits.flatMap((unit) => [
      { type: "text", text: `Visual for ${unit.id} (${unit.location})` },
      { type: "image_url", image_url: { url: unit.visualDataUrl, detail: "high" } },
    ]),
  ];
  return { messages: next, visualUnitIds: visualUnits.map((unit) => unit.id) };
}

function publicBackgroundJob(job) {
  const completed = Number(job?.progress?.completedUnits) || 0;
  const total = Number(job?.progress?.totalUnits) || null;
  const progress = job?.progress ?? {};
  const latestBatch = [...(job?.batches ?? [])]
    .filter((batch) => batch.providerId && batch.modelId)
    .sort((left, right) => Number(left.index) - Number(right.index))
    .at(-1) ?? null;
  return {
    id: `document:${job.id}`,
    documentJobId: job.id,
    command: `整理 ${job.sourceName || basename(job.sourcePath || "document")}`,
    running: job.running === true,
    paused: job.paused === true,
    lifecycle: "task",
    kind: "document",
    status: job.status,
    progress: {
      completed,
      total,
      percent: total ? Math.min(100, Math.round(completed / total * 100)) : null,
      completedBatches: Number(progress.completedBatches) || 0,
      totalBatches: Number(progress.totalBatches) || null,
      stage: progress.stage || null,
      currentBatch: progress.currentBatch || null,
      currentLabel: progress.currentLabel || null,
      attempt: Number(progress.attempt) || null,
      maxAttempts: Number(progress.maxAttempts) || null,
      generatedChars: Number(progress.generatedChars) || 0,
      elapsedMs: Number(progress.elapsedMs) || 0,
      modelCalls: Number(progress.modelCalls) || 0,
      modelCallLimit: Number(progress.modelCallLimit) || null,
      unitLabel: progress.unitLabel || (/\.pdf$/i.test(String(job.sourcePath || "")) ? "页" : "区块"),
      lastHeartbeatAt: progress.lastHeartbeatAt || null,
    },
    model: job.currentModel ?? (latestBatch ? `${latestBatch.providerId}/${latestBatch.modelId}` : null),
    modelRole: job.currentModelRole ?? latestBatch?.modelRole ?? null,
    sourceKind: job.sourceKind ?? null,
    outputPath: job.outputPath,
    policy: job.policy ? {
      batchInputTokens: job.policy.batchInputTokens,
      maxUnitsPerBatch: job.policy.maxUnitsPerBatch,
      maxVisualUnitsPerBatch: job.policy.maxVisualUnitsPerBatch,
    } : null,
    previewAvailable: Array.isArray(job.batches) && job.batches.length > 0,
    qualityPassed: job.qualityPassed,
    warnings: job.warnings ?? [],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error ?? null,
  };
}

export function createDocumentMarkdownManager(options = {}) {
  if (!options.store) throw new TypeError("document job store is required");
  if (typeof options.prepareDocument !== "function") throw new TypeError("prepareDocument is required");
  if (typeof options.processSourceBatches !== "function") throw new TypeError("processSourceBatches is required");
  if (typeof options.generate !== "function") throw new TypeError("generate is required");
  if (typeof options.writeOutput !== "function") throw new TypeError("writeOutput is required");

  const store = options.store;
  const queue = [];
  const runtimes = new Map();
  const completions = new Map();
  let draining = false;

  const emit = async (id, changes = {}) => {
    const job = await store.update(id, changes);
    options.onChange?.(publicBackgroundJob(job), job);
    return job;
  };

  function reportPersistenceError(runtime, error, context) {
    runtime.lastPersistenceError = {
      context,
      code: String(error?.code || "UNKNOWN"),
      message: String(error?.message || error).slice(0, 1_000),
      at: new Date().toISOString(),
    };
    try { options.onPersistenceError?.(error, runtime.id, context); } catch { /* Diagnostics must not stop the worker. */ }
  }

  function notifyError(error, jobId, prepared) {
    try { options.onError?.(error, jobId, prepared); } catch { /* Error reporting must not stop the worker. */ }
  }

  function queueEmit(runtime, changes) {
    runtime.emitQueue = (runtime.emitQueue ?? Promise.resolve())
      .catch(() => {})
      .then(() => emit(runtime.id, changes));
    return runtime.emitQueue;
  }

  function updateProgress(runtime, changes = {}, extra = {}) {
    return queueEmit(runtime, {
      ...extra,
      progress: {
        ...changes,
        lastHeartbeatAt: new Date().toISOString(),
      },
    });
  }

  function queueProgress(runtime, changes = {}, extra = {}, context = "progress") {
    void updateProgress(runtime, changes, extra).catch((error) => reportPersistenceError(runtime, error, context));
  }

  function reserveModelCall(runtime, budget, details) {
    if (budget.used >= budget.limit) return false;
    budget.used++;
    queueProgress(runtime, {
      ...details,
      modelCalls: budget.used,
      modelCallLimit: budget.limit,
    }, {}, "model-call-reservation");
    return true;
  }

  async function waitForTurn(runtime) {
    let announced = false;
    while (runtime.paused || options.isForegroundBusy?.()) {
      if (runtime.controller.signal.aborted) throw abortError();
      const waitingForForeground = !runtime.paused && options.isForegroundBusy?.();
      await emit(runtime.id, {
        status: runtime.paused ? "paused" : "waiting_foreground",
        running: !runtime.paused,
        paused: runtime.paused,
      });
      if (waitingForForeground && !announced) {
        announced = true;
        options.onWaitingForForeground?.(runtime.id);
      }
      await delay(runtime.policy.foregroundPollMs, runtime.controller.signal);
    }
    if (announced) await emit(runtime.id, { status: "running", running: true, paused: false });
  }

  function softenReview(review) {
    const advisoryIssues = review.issues.filter((issue) => issue.type === "structure");
    const issues = review.issues.filter((issue) => issue.type !== "structure");
    return { ...review, pass: issues.length === 0, issues, advisoryIssues };
  }

  async function requestReview(candidate, batch, section, runtime, budget) {
    const messages = buildDocumentReviewMessages({ batch, markdown: section, contract: runtime.contract });
    const errors = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!reserveModelCall(runtime, budget, {
        stage: "quality-review",
        currentBatch: batch.id,
        currentLabel: batch.label,
        attempt: attempt + 1,
        maxAttempts: 2,
        generatedChars: 0,
        elapsedMs: 0,
      })) break;
      const reviewMessages = attempt === 0 ? messages : buildDocumentReviewMessages({ batch, markdown: section, contract: runtime.contract, retry: true });
      const withVisuals = messagesWithBatchVisuals(reviewMessages, batch, candidate);
      try {
        const value = await options.generate({
          candidate,
          batch,
          contract: runtime.contract,
          messages: withVisuals.messages,
          purpose: "verification",
          maxTokens: 2_048,
          requestTimeoutMs: runtime.policy.requestTimeoutMs,
          onProgress: (progress) => { queueProgress(runtime, {
            stage: "quality-review",
            currentBatch: batch.id,
            currentLabel: batch.label,
            attempt: attempt + 1,
            maxAttempts: 2,
            generatedChars: Number(progress?.generatedChars) || 0,
            elapsedMs: Number(progress?.elapsedMs) || 0,
            modelCalls: budget.used,
            modelCallLimit: budget.limit,
          }, {}, "quality-review-progress"); },
          signal: runtime.controller.signal,
        });
        const parsed = parseDocumentReview(value, batch.unitIds);
        if (parsed) return { ...softenReview(parsed), errors };
      } catch (error) {
        if (runtime.controller.signal.aborted || error?.name === "AbortError") throw error;
        errors.push(String(error?.message || error).slice(0, 500));
        if (isNonRetryableDocumentModelError(error)) {
          runtime.disabledCandidates.add(candidateKey(candidate));
          break;
        }
      }
    }
    return {
      pass: false,
      unavailable: true,
      issues: batch.unitIds.map((unitId) => ({ unitId, type: "other", detail: "审校模型未返回有效 JSON" })),
      advisoryIssues: [],
      errors,
    };
  }

  async function tryCandidate(candidate, batch, runtime, budget) {
    let lastQuality = null;
    let lastReview = null;
    let lastSection = "";
    let attempts = 0;
    let reviewRepairs = 0;
    const errors = [];
    for (let attempt = 0; attempt <= runtime.policy.maxRetries; attempt++) {
      await waitForTurn(runtime);
      if (!reserveModelCall(runtime, budget, {
        stage: attempt > 0 ? "quality-repair" : "draft",
        currentBatch: batch.id,
        currentLabel: batch.label,
        attempt: attempt + 1,
        maxAttempts: runtime.policy.maxRetries + 1,
        generatedChars: 0,
        elapsedMs: 0,
      })) {
        errors.push(`document batch model-call budget exhausted (${budget.used}/${budget.limit})`);
        break;
      }
      attempts++;
      const withVisuals = messagesWithBatchVisuals(
        buildDocumentSectionMessages({ batch, contract: runtime.contract, retry: attempt > 0 }),
        batch,
        candidate,
      );
      let section;
      try {
        section = cleanMarkdown(await options.generate({
          candidate,
          batch,
          contract: runtime.contract,
          messages: withVisuals.messages,
          purpose: "toolContinuation",
          maxTokens: runtime.policy.batchOutputTokens,
          requestTimeoutMs: runtime.policy.requestTimeoutMs,
          onProgress: (progress) => { queueProgress(runtime, {
            stage: attempt > 0 ? "quality-repair" : "draft",
            currentBatch: batch.id,
            currentLabel: batch.label,
            attempt: attempt + 1,
            maxAttempts: runtime.policy.maxRetries + 1,
            generatedChars: Number(progress?.generatedChars) || 0,
            elapsedMs: Number(progress?.elapsedMs) || 0,
            modelCalls: budget.used,
            modelCallLimit: budget.limit,
          }, {}, "draft-progress"); },
          retry: attempt > 0,
          signal: runtime.controller.signal,
        }));
      } catch (error) {
        if (runtime.controller.signal.aborted || error?.name === "AbortError") throw error;
        errors.push(String(error?.message || error).slice(0, 500));
        if (isNonRetryableDocumentModelError(error)) {
          runtime.disabledCandidates.add(candidateKey(candidate));
          break;
        }
        continue;
      }
      lastSection = section;
      lastQuality = evaluateDocumentQuality({
        units: batch.units,
        markdown: section,
        fidelity: runtime.contract.fidelity,
        resolvedVisualUnitIds: withVisuals.visualUnitIds,
      });
      if (!lastQuality.passed) {
        const onlyUnresolvedVisuals = lastQuality.failures.every((failure) => failure.type === "visual-pending");
        if (onlyUnresolvedVisuals) break;
        continue;
      }
      lastReview = await requestReview(candidate, batch, section, runtime, budget);
      errors.push(...(lastReview.errors ?? []));
      if (lastReview.pass) return { passed: true, section, quality: lastQuality, review: lastReview, attempts, candidate, errors };
      if (lastReview.unavailable || reviewRepairs >= 1) break;
      reviewRepairs++;
    }
    return { passed: false, section: lastSection, quality: lastQuality, review: lastReview, attempts, candidate, errors };
  }

  async function candidateAvailable(candidate, runtime) {
    if (runtime.disabledCandidates.has(candidateKey(candidate))) return false;
    if (candidate.role === "primary") return true;
    if (!runtime.policy.autoFallback) return false;
    try { return await options.probeModel?.(candidate, runtime.controller.signal) === true; } catch { return false; }
  }

  function canSplitResult(result) {
    const types = new Set((result?.quality?.failures ?? []).map((failure) => failure.type));
    if (["coverage", "length-retention", "technical-value-retention"].some((type) => types.has(type))) return true;
    return (result?.errors ?? []).some((message) => /timeout|timed out|deadline|总时长上限/i.test(message));
  }

  async function processBatch(batch, runtime, state) {
    const candidates = runtime.candidates;
    const attempts = [];
    let bestResult = null;
    let splitEligible = false;
    for (const candidate of candidates) {
      if (state.budget.used >= state.budget.limit) break;
      if (!await candidateAvailable(candidate, runtime)) continue;
      await updateProgress(runtime, {
        stage: "selecting-model",
        currentBatch: batch.id,
        currentLabel: batch.label,
        modelCalls: state.budget.used,
        modelCallLimit: state.budget.limit,
      }, {
        currentModel: `${candidate.providerId}/${candidate.modelId}`,
        currentModelRole: candidate.role || "primary",
      });
      const result = await tryCandidate(candidate, batch, runtime, state.budget);
      attempts.push({
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        role: candidate.role,
        attempts: result.attempts,
        passed: result.passed,
        failures: result.quality?.failures ?? [],
        reviewIssues: result.review?.issues ?? [],
        advisoryReviewIssues: result.review?.advisoryIssues ?? [],
        errors: result.errors ?? [],
        disabledForJob: runtime.disabledCandidates.has(candidateKey(candidate)),
        at: new Date().toISOString(),
      });
      if (result.passed) return { ...result, status: "completed", attempts };
      const onlyUnresolvedVisuals = (result.quality?.failures ?? []).length > 0
        && result.quality.failures.every((failure) => failure.type === "visual-pending");
      if (result.section && (result.quality?.passed || onlyUnresolvedVisuals)) bestResult = result;
      if (canSplitResult(result)) splitEligible = true;
    }

    if (!bestResult && splitEligible && batch.units.length > 1 && state.depth < runtime.policy.maxSplitDepth && state.budget.used < state.budget.limit) {
      const countTokens = typeof options.countTokens === "function" ? options.countTokens : (text) => Math.ceil(String(text ?? "").length / 2);
      const { left, right } = splitBatchWithContext(batch, runtime, countTokens);
      const childState = { depth: state.depth + 1, budget: state.budget };
      const leftResult = await processBatch(left, runtime, childState);
      const rightResult = await processBatch(right, runtime, childState);
      return {
        passed: leftResult.passed && rightResult.passed,
        section: [leftResult.section, rightResult.section].filter(Boolean).join("\n\n"),
        status: leftResult.passed && rightResult.passed ? "completed" : "needs_review",
        candidate: rightResult.candidate ?? leftResult.candidate,
        quality: { passed: leftResult.passed && rightResult.passed, split: true },
        review: null,
        attempts: [...attempts, ...(leftResult.attempts ?? []), ...(rightResult.attempts ?? [])],
      };
    }

    if (bestResult) {
      return {
        ...bestResult,
        passed: false,
        status: "needs_review",
        attempts,
      };
    }

    return {
      passed: false,
      section: renderDocumentSourceFallback(batch.units, "模型整理和备用模型修复均未通过质量检查"),
      status: "needs_review",
      candidate: attempts.length > 0 ? candidates.find((candidate) => candidate.providerId === attempts.at(-1).providerId && candidate.modelId === attempts.at(-1).modelId) : null,
      quality: attempts.at(-1)?.failures ? { passed: false, failures: attempts.at(-1).failures } : { passed: false, failures: [{ type: "model-unavailable" }] },
      review: null,
      attempts,
    };
  }

  async function upsertBatch(runtime, record) {
    await (runtime.emitQueue ?? Promise.resolve()).catch(() => {});
    const job = await store.read(runtime.id);
    const batches = [...(job.batches ?? [])];
    const index = batches.findIndex((item) => item.id === record.id);
    if (index >= 0) batches[index] = record;
    else batches.push(record);
    const completedUnits = batches.reduce((sum, item) => sum + (["completed", "needs_review"].includes(item.status) ? item.unitIds?.length ?? 0 : 0), 0);
    const completedBatches = batches.filter((item) => ["completed", "needs_review"].includes(item.status)).length;
    const modelHistory = batches.flatMap((item) => item.attempts ?? []);
    await queueEmit(runtime, {
      batches,
      modelHistory,
      progress: {
        completedUnits,
        completedBatches,
        stage: "batch-complete",
        currentBatch: record.id,
        currentLabel: record.label,
        generatedChars: Number(record.sectionChars) || 0,
        elapsedMs: 0,
        lastHeartbeatAt: new Date().toISOString(),
      },
    });
    await store.appendEvent?.(runtime.id, {
      type: "batch-committed",
      batchId: record.id,
      status: record.status,
      providerId: record.providerId ?? null,
      modelId: record.modelId ?? null,
      modelRole: record.modelRole ?? null,
    }).catch((error) => reportPersistenceError(runtime, error, "batch-event"));
  }

  async function savedSection(id, sectionId) {
    try { return await store.readSection(id, sectionId); } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async function recoverSavedBatch(runtime, batch, prior) {
    if (prior && ["completed", "needs_review"].includes(prior.status)) {
      const compatible = batchRecordMatches(prior, batch);
      const section = compatible ? await savedSection(runtime.id, prior.sectionId || batch.id) : null;
      if (section !== null) return { section, record: prior, source: "manifest" };
    }

    const checkpoint = await store.readBatchCheckpoint?.(runtime.id, batch.id);
    if (checkpoint && batchRecordMatches(checkpoint.record, batch)) {
      const record = {
        ...checkpoint.record,
        index: batch.index,
        label: batch.label,
        recoveredAt: new Date().toISOString(),
      };
      const existing = await savedSection(runtime.id, record.sectionId || batch.id);
      if (existing !== checkpoint.content) await store.writeSection(runtime.id, record.sectionId || batch.id, checkpoint.content);
      await upsertBatch(runtime, record);
      await store.appendEvent?.(runtime.id, { type: "batch-recovered", batchId: batch.id, source: "checkpoint" })
        .catch((error) => reportPersistenceError(runtime, error, "recovery-event"));
      return { section: checkpoint.content, record, source: "checkpoint" };
    }

    const orphan = await savedSection(runtime.id, batch.id);
    if (orphan === null) return null;
    const quality = evaluateDocumentQuality({
      units: batch.units,
      markdown: orphan,
      fidelity: runtime.contract.fidelity,
      resolvedVisualUnitIds: [],
    });
    const unsafeFailures = (quality.failures ?? []).filter((failure) => failure.type !== "visual-pending");
    if (unsafeFailures.length > 0) {
      await store.appendEvent?.(runtime.id, {
        type: "orphan-section-rejected",
        batchId: batch.id,
        failures: unsafeFailures.map((failure) => failure.type),
      }).catch((error) => reportPersistenceError(runtime, error, "recovery-event"));
      return null;
    }
    const record = {
      id: batch.id,
      index: batch.index,
      label: batch.label,
      unitIds: batch.unitIds,
      unitManifest: unitManifest(batch.units),
      status: "needs_review",
      sectionId: batch.id,
      providerId: null,
      modelId: null,
      modelRole: "recovered",
      quality,
      review: {
        pass: false,
        issues: [{ unitId: batch.unitIds[0] || batch.id, type: "other", detail: "区块在上次中断前已保存，但审校记录未提交，需要复核。" }],
        advisoryIssues: [],
        errors: [],
      },
      attempts: [],
      modelCalls: 0,
      sectionChars: orphan.length,
      recoveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.writeBatchCheckpoint?.(runtime.id, record, orphan);
    await upsertBatch(runtime, record);
    await store.appendEvent?.(runtime.id, { type: "batch-recovered", batchId: batch.id, source: "orphan-section" })
      .catch((error) => reportPersistenceError(runtime, error, "recovery-event"));
    return { section: orphan, record, source: "orphan-section" };
  }

  function groupSummaryNotes(notes, runtime) {
    const countTokens = typeof options.countTokens === "function" ? options.countTokens : (text) => Math.ceil(String(text).length / 2);
    const limit = Math.max(1_024, runtime.policy.batchInputTokens);
    const groups = [];
    let current = [];
    let tokens = 0;
    for (const note of notes) {
      const noteTokens = Math.max(1, Number(countTokens(note)) || 1);
      if (current.length > 0 && tokens + noteTokens > limit) {
        groups.push(current);
        current = [];
        tokens = 0;
      }
      current.push(note);
      tokens += noteTokens;
    }
    if (current.length > 0) groups.push(current);
    return groups;
  }

  async function generateSummaryLevel(title, notes, runtime) {
    for (const candidate of runtime.candidates) {
      if (!await candidateAvailable(candidate, runtime)) continue;
      try {
        await waitForTurn(runtime);
        await updateProgress(runtime, { stage: "summary", currentBatch: null, currentLabel: title, generatedChars: 0, elapsedMs: 0 }, {
          currentModel: `${candidate.providerId}/${candidate.modelId}`,
          currentModelRole: candidate.role || "primary",
        });
        return cleanMarkdown(await options.generateSummary?.({
          title,
          sectionSummaries: notes,
          contract: runtime.contract,
          candidate,
          requestTimeoutMs: runtime.policy.requestTimeoutMs,
          onProgress: (progress) => { queueProgress(runtime, {
            stage: "summary",
            currentBatch: null,
            currentLabel: title,
            generatedChars: Number(progress?.generatedChars) || 0,
            elapsedMs: Number(progress?.elapsedMs) || 0,
          }, {}, "summary-progress"); },
          signal: runtime.controller.signal,
        }));
      } catch (error) {
        if (runtime.controller.signal.aborted || error?.name === "AbortError") throw error;
        if (isNonRetryableDocumentModelError(error)) runtime.disabledCandidates.add(candidateKey(candidate));
      }
    }
    return "";
  }

  async function generateHierarchicalSummary(title, notes, runtime) {
    if (typeof options.generateSummary !== "function" || notes.length === 0) return "";
    let level = notes;
    for (let depth = 0; depth < 8; depth++) {
      const groups = groupSummaryNotes(level, runtime);
      const next = [];
      for (let index = 0; index < groups.length; index++) {
        const generated = await generateSummaryLevel(groups.length === 1 ? title : `${title}（摘要组 ${index + 1}/${groups.length}）`, groups[index], runtime);
        const compact = String(generated || groups[index].join("\n"))
          .replace(/^##\s+摘要\s*/i, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 1_200);
        if (compact) next.push(compact);
      }
      if (next.length <= 1) return next[0] ? `## 摘要\n\n${next[0]}` : "";
      level = next;
    }
    return "";
  }

  async function execute(runtime) {
    let prepared;
    try {
      await emit(runtime.id, { status: "running", running: true, paused: false, error: null });
      await store.appendEvent?.(runtime.id, { type: "execution-started", retryFailed: runtime.retryFailed === true })
        .catch((error) => reportPersistenceError(runtime, error, "execution-event"));
      prepared = await options.prepareDocument(runtime.input.sourcePath, runtime.controller.signal);
      if (!prepared?.ok) throw new Error(prepared?.error || "document preparation failed");
      await emit(runtime.id, {
        sourcePath: prepared.sourcePath || runtime.input.sourcePath,
        readablePath: prepared.readablePath || prepared.sourcePath || runtime.input.sourcePath,
        sourceKind: prepared.documentKind || runtime.contract.format,
      });
      const previous = await store.read(runtime.id);
      const priorBatches = new Map((previous.batches ?? []).map((batch) => [batch.id, batch]));
      const sectionSummaries = [];
      let batchIndex = 0;
      let degraded = false;
      const sourceSummary = await options.processSourceBatches(prepared, {
        policy: runtime.policy,
        contract: runtime.contract,
        countTokens: options.countTokens,
        signal: runtime.controller.signal,
        captureVisuals: runtime.candidates.some((candidate) => candidate.multimodal === true),
        pages: runtime.input.pages,
        onPlan: async (plan = {}) => {
          await updateProgress(runtime, {
            totalUnits: Number(plan.totalUnits) || null,
            totalBatches: Number(plan.totalBatches) || null,
            unitLabel: plan.unitLabel || (prepared.documentKind === "pdf" ? "页" : "区块"),
            stage: "extracting",
            currentBatch: null,
            currentLabel: null,
          });
        },
        onBatch: async (value) => {
          await waitForTurn(runtime);
          const batch = normalizeBatch(value, batchIndex++);
          const prior = priorBatches.get(batch.id);
          const retryFailed = runtime.retryFailed === true;
          const recovered = !retryFailed || prior?.status === "completed"
            ? await recoverSavedBatch(runtime, batch, prior)
            : null;
          if (recovered) {
            sectionSummaries.push(batchSummary(recovered.section, batch));
            if (recovered.record.status !== "completed") degraded = true;
            return;
          }
          const budget = { used: 0, limit: runtime.policy.maxModelCallsPerBatch };
          const result = await processBatch(batch, runtime, { depth: 0, budget });
          const sectionId = batch.id;
          await (runtime.emitQueue ?? Promise.resolve()).catch(() => {});
          const record = {
            id: batch.id,
            index: batch.index,
            label: batch.label,
            unitIds: batch.unitIds,
            unitManifest: unitManifest(batch.units),
            status: result.status,
            sectionId,
            providerId: result.candidate?.providerId ?? null,
            modelId: result.candidate?.modelId ?? null,
            modelRole: result.candidate?.role ?? null,
            quality: result.quality,
            review: result.review,
            attempts: result.attempts,
            modelCalls: budget.used,
            sectionChars: result.section.length,
            updatedAt: new Date().toISOString(),
          };
          await store.writeBatchCheckpoint?.(runtime.id, record, result.section);
          await store.writeSection(runtime.id, sectionId, result.section);
          await upsertBatch(runtime, record);
          sectionSummaries.push(batchSummary(result.section, batch));
          if (!result.passed) degraded = true;
        },
      });

      await (runtime.emitQueue ?? Promise.resolve()).catch(() => {});
      const current = await store.read(runtime.id);
      const totalUnits = Number(sourceSummary?.totalUnits) || current.batches.reduce((sum, batch) => sum + (batch.unitIds?.length ?? 0), 0);
      if (Number.isFinite(Number(sourceSummary?.selectedPages)) && Number(sourceSummary.selectedPages) !== Number(sourceSummary.processedPages)) {
        throw new Error(`document extraction stopped after ${sourceSummary.processedPages} of ${sourceSummary.selectedPages} selected pages`);
      }
      const orderedBatches = [...current.batches].sort((a, b) => a.index - b.index);
      const expectedUnitIds = orderedBatches.flatMap((batch) => batch.unitIds ?? []);
      if (expectedUnitIds.length !== totalUnits) {
        throw new Error(`document extraction manifest contains ${expectedUnitIds.length} of ${totalUnits} source units`);
      }
      await emit(runtime.id, {
        progress: {
          totalUnits,
          totalBatches: current.batches.length,
          completedUnits: totalUnits,
          completedBatches: current.batches.length,
          stage: "assembling",
          currentBatch: null,
          currentLabel: null,
          generatedChars: 0,
          elapsedMs: 0,
          lastHeartbeatAt: new Date().toISOString(),
        },
      });
      const sections = [];
      for (const batch of orderedBatches) {
        sections.push(await store.readSection(runtime.id, batch.sectionId || batch.id));
        if (batch.status !== "completed") degraded = true;
      }
      const detailedBody = sections.join("\n\n");
      const assemblyAudit = runtime.contract.fidelity === "complete-with-summary"
        ? evaluateDocumentAssembly({ expectedUnitIds, markdown: detailedBody })
        : { passed: true, expectedUnits: expectedUnitIds.length, actualMarkers: null };
      const batchDegraded = degraded;
      if (!assemblyAudit.passed) degraded = true;

      let summary = "";
      if (runtime.contract.fidelity === "complete-with-summary") {
        try {
          summary = await generateHierarchicalSummary(titleForPath(prepared.sourcePath || runtime.input.sourcePath), sectionSummaries, runtime);
        } catch { /* A missing summary must not discard the verified body. */ }
        if (!/^##\s+摘要/m.test(summary)) summary = `## 摘要\n\n文档正文已按 ${totalUnits} 个来源区块完成整理。${degraded ? "部分区块保留了原始提取内容，需要复核。" : "详细内容见下文。"}`;
      }
      const title = titleForPath(prepared.sourcePath || runtime.input.sourcePath);
      const content = [`# ${title}`, summary, "## 详细正文", detailedBody].filter(Boolean).join("\n\n");
      await options.writeOutput({
        outputPath: runtime.input.outputPath,
        content,
        signal: runtime.controller.signal,
        workspaceRoot: runtime.input.workspaceRoot,
        allowOutsideWorkspace: runtime.input.allowOutsideWorkspace === true,
        allowOutputOverwrite: runtime.input.allowOutputOverwrite === true || Boolean((await store.read(runtime.id)).outputCommittedAt),
      });
      const outputCommittedAt = new Date().toISOString();
      const warnings = [];
      if (batchDegraded) warnings.push({ type: "document-quality-degraded", message: "部分来源区块使用原文保底，需要复核。" });
      if (!assemblyAudit.passed) warnings.push({ type: "document-assembly-audit", message: "最终正文的来源顺序或覆盖审计未通过，需要复核。", details: assemblyAudit });
      await (runtime.emitQueue ?? Promise.resolve()).catch(() => {});
      await emit(runtime.id, {
        status: degraded ? "completed_with_warnings" : "completed",
        running: false,
        paused: false,
        qualityPassed: !degraded,
        sourceAudit: {
          totalUnits,
          selectedPages: Number.isFinite(Number(sourceSummary?.selectedPages)) ? Number(sourceSummary.selectedPages) : null,
          processedPages: Number.isFinite(Number(sourceSummary?.processedPages)) ? Number(sourceSummary.processedPages) : null,
          assembly: assemblyAudit,
        },
        warnings,
        completedAt: new Date().toISOString(),
        outputCommittedAt,
        currentModel: null,
        currentModelRole: null,
        progress: {
          stage: "completed",
          currentBatch: null,
          currentLabel: null,
          generatedChars: content.length,
          elapsedMs: 0,
          lastHeartbeatAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      const cancelled = runtime.controller.signal.aborted || error?.name === "AbortError";
      await (runtime.emitQueue ?? Promise.resolve()).catch(() => {});
      try {
        await emit(runtime.id, {
          status: cancelled ? "cancelled" : "failed",
          running: false,
          paused: false,
          qualityPassed: false,
          error: cancelled ? "cancelled by user" : String(error?.message || error),
          completedAt: new Date().toISOString(),
          currentModel: null,
          currentModelRole: null,
          progress: {
            stage: cancelled ? "cancelled" : "failed",
            currentBatch: null,
            currentLabel: null,
            lastHeartbeatAt: new Date().toISOString(),
          },
        });
      } catch (persistenceError) {
        reportPersistenceError(runtime, persistenceError, "terminal-state");
      }
      if (!cancelled) notifyError(error, runtime.id, prepared);
    }
  }

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0) {
        const runtime = queue.shift();
        if (runtime.controller.signal.aborted) {
          let cancelled;
          try {
            cancelled = await emit(runtime.id, {
              status: "cancelled",
              running: false,
              paused: false,
              qualityPassed: false,
              error: "cancelled by user",
              completedAt: new Date().toISOString(),
            });
          } catch (error) {
            reportPersistenceError(runtime, error, "queued-cancellation");
            cancelled = { id: runtime.id, status: "cancelled", running: false, error: "cancelled by user" };
          }
          runtime.resolve?.(cancelled);
          runtimes.delete(runtime.id);
          completions.delete(runtime.id);
          continue;
        }
        runtime.executing = true;
        try {
          let workerError = null;
          try {
            await execute(runtime);
          } catch (error) {
            workerError = error;
            notifyError(error, runtime.id);
          }
          if (workerError) {
            runtime.resolve?.({ id: runtime.id, status: "failed", running: false, error: String(workerError?.message || workerError) });
            continue;
          }
          try {
            runtime.resolve?.(await store.read(runtime.id));
          } catch (error) {
            reportPersistenceError(runtime, error, "completion-read");
            runtime.resolve?.({ id: runtime.id, status: "failed", running: false, error: String(error?.message || error) });
          }
        } finally {
          runtime.executing = false;
          runtimes.delete(runtime.id);
          completions.delete(runtime.id);
        }
      }
    } finally {
      draining = false;
    }
  }

  function enqueue(runtime) {
    runtimes.set(runtime.id, runtime);
    queue.push(runtime);
    queueMicrotask(() => {
      void drain().catch((error) => notifyError(error, runtime.id));
    });
  }

  async function start(input = {}) {
    const requestedPolicy = normalizeDocumentPolicy(input.policy);
    const contract = input.contract ?? buildDocumentContract({
      sourcePath: input.sourcePath,
      outputPath: input.outputPath,
      pages: input.pages,
      fidelity: input.fidelity,
      summaryOnlyConfirmed: input.summaryOnlyConfirmed,
      overwriteConfirmed: input.overwriteConfirmed,
      instructions: input.instructions,
    });
    if (contract.requiresDecision) return { ok: false, requiresUserChoice: true, decision: contract.decision };
    const candidates = options.modelCandidates?.(requestedPolicy) ?? [];
    if (candidates.length === 0) throw new Error("no document model is configured");
    const policy = effectiveDocumentPolicy(requestedPolicy, candidates);
    const policyTrace = documentPolicyTrace(requestedPolicy, policy, candidates);
    const job = await store.create({
      sourcePath: input.sourcePath,
      outputPath: input.outputPath,
      pages: input.pages,
      workspaceRoot: input.workspaceRoot,
      allowOutsideWorkspace: input.allowOutsideWorkspace,
      allowOutputOverwrite: input.allowOutputOverwrite,
      contract,
      policy,
      policyTrace,
    });
    await store.appendEvent?.(job.id, { type: "policy-selected", ...policyTrace }).catch(() => {});
    options.onPolicy?.(job.id, policyTrace);
    let resolveCompletion;
    const completion = new Promise((resolve) => { resolveCompletion = resolve; });
    completions.set(job.id, completion);
    enqueue({
      id: job.id,
      input,
      policy,
      contract,
      candidates,
      controller: new AbortController(),
      disabledCandidates: new Set(),
      emitQueue: Promise.resolve(),
      paused: false,
      retryFailed: false,
      executing: false,
      resolve: resolveCompletion,
    });
    return { ok: true, accepted: true, background: true, id: job.id, outputPath: input.outputPath, contract };
  }

  async function resume(id, { retryFailed = false } = {}) {
    const job = await store.read(id);
    if (runtimes.has(id)) {
      const runtime = runtimes.get(id);
      runtime.paused = false;
      runtime.retryFailed ||= retryFailed;
      await emit(id, { status: "running", running: true, paused: false });
      return { ok: true, resumed: true, id };
    }
    const storedPolicy = normalizeDocumentPolicy(job.policy);
    const candidates = options.modelCandidates?.(storedPolicy) ?? [];
    if (candidates.length === 0) throw new Error("no document model is configured");
    const policy = effectiveDocumentPolicy(storedPolicy, candidates);
    const policyTrace = documentPolicyTrace(storedPolicy, policy, candidates);
    let resolveCompletion;
    const completion = new Promise((resolve) => { resolveCompletion = resolve; });
    completions.set(id, completion);
    const runtime = {
      id,
      input: {
        sourcePath: job.sourcePath,
        outputPath: job.outputPath,
        pages: job.pages,
        workspaceRoot: job.workspaceRoot || dirname(job.outputPath),
        allowOutsideWorkspace: job.allowOutsideWorkspace === true,
        allowOutputOverwrite: job.allowOutputOverwrite === true,
      },
      policy,
      contract: job.contract ?? buildDocumentContract({ sourcePath: job.sourcePath, outputPath: job.outputPath }),
      candidates,
      controller: new AbortController(),
      disabledCandidates: new Set(),
      emitQueue: Promise.resolve(),
      paused: false,
      retryFailed,
      executing: false,
      resolve: resolveCompletion,
    };
    try {
      await emit(id, { status: "queued", running: false, paused: false, error: null, policy, policyTrace });
      await store.appendEvent?.(id, { type: "resume-requested", retryFailed, ...policyTrace }).catch(() => {});
      options.onPolicy?.(id, policyTrace);
    } catch (error) {
      completions.delete(id);
      throw error;
    }
    enqueue(runtime);
    return { ok: true, resumed: true, id };
  }

  async function control(rawId, action) {
    const id = String(rawId).replace(/^document:/, "");
    const runtime = runtimes.get(id);
    if (action === "pause") {
      if (!runtime) return { ok: false, error: "document job is not running" };
      runtime.paused = true;
      await emit(id, { status: "pausing", paused: true });
      return { ok: true, paused: true, id };
    }
    if (action === "resume") return resume(id);
    if (action === "retry") return resume(id, { retryFailed: true });
    if (action === "cancel" || action === "stop") {
      if (runtime) {
        runtime.controller.abort();
        if (!runtime.executing) {
          const queueIndex = queue.indexOf(runtime);
          if (queueIndex >= 0) queue.splice(queueIndex, 1);
          const cancelled = await emit(id, {
            status: "cancelled",
            running: false,
            paused: false,
            qualityPassed: false,
            error: "cancelled by user",
            completedAt: new Date().toISOString(),
          });
          runtime.resolve?.(cancelled);
          runtimes.delete(id);
          completions.delete(id);
        }
      } else {
        await emit(id, { status: "cancelled", running: false, paused: false, qualityPassed: false, error: "cancelled by user", completedAt: new Date().toISOString() });
      }
      return { ok: true, cancelled: true, id };
    }
    return { ok: false, error: `unknown document job action: ${action}` };
  }

  async function listMetadata() {
    return Promise.all((await store.list()).map(async (job) => {
      const metadata = publicBackgroundJob(job);
      if (!metadata.previewAvailable) metadata.previewAvailable = (await store.listSectionIds?.(job.id) ?? []).length > 0;
      return metadata;
    }));
  }

  async function getMetadata(rawId) {
    const id = String(rawId).replace(/^document:/, "");
    try {
      const job = await store.read(id);
      const metadata = publicBackgroundJob(job);
      const ordered = [...(job.batches ?? [])]
        .filter((batch) => batch.sectionId && ["completed", "needs_review"].includes(batch.status))
        .sort((left, right) => left.index - right.index);
      const orphanSectionIds = ordered.length === 0 ? await store.listSectionIds?.(id) ?? [] : [];
      if (ordered.length > 0 || orphanSectionIds.length > 0) {
        const sections = [];
        const sectionIds = ordered.length > 0 ? ordered.map((batch) => batch.sectionId) : orphanSectionIds;
        for (const sectionId of sectionIds) {
          try { sections.push(await store.readSection(id, sectionId)); } catch { /* Keep other completed sections previewable. */ }
        }
        const title = titleForPath(job.sourcePath);
        const notice = ["completed", "completed_with_warnings"].includes(job.status)
          ? ""
          : "> 此为后台任务的中间预览，仅包含已经完成并保存的区块。";
        let content = [`# ${title}`, notice, "## 已完成内容", ...sections].filter(Boolean).join("\n\n");
        const truncated = content.length > 2_000_000;
        if (truncated) content = `${content.slice(0, 2_000_000)}\n\n> 预览内容过长，后续部分暂未显示。`;
        metadata.preview = {
          filename: `${basename(job.outputPath || `${title}.md`).replace(/\.(?:md|markdown)$/i, "")}-中间预览.md`,
          content,
          partial: !["completed", "completed_with_warnings"].includes(job.status),
          truncated,
        };
      }
      metadata.events = await store.readEvents?.(id, 100) ?? [];
      return metadata;
    } catch {
      return null;
    }
  }

  async function wait(id) {
    const completion = completions.get(id);
    if (completion) return completion;
    return store.read(id);
  }

  return { control, getMetadata, listMetadata, resume, start, wait };
}
