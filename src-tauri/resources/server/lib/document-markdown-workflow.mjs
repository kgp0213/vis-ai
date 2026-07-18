import { createHash } from "node:crypto";
import { basename, dirname, extname } from "node:path";

import {
  buildDocumentContract,
  buildDocumentReviewMessages,
  buildDocumentSectionMessages,
  createDocumentContextUnit,
  evaluateDocumentAssembly,
  evaluateDocumentQuality,
  mergeDocumentUnitSections,
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

function titleForDocument(prepared, contract = {}) {
  const configured = String(contract?.title ?? "").trim();
  if (configured) return configured;
  const sources = Array.isArray(prepared?.sources) ? prepared.sources : [];
  if (sources.length > 1) return `${sources.length} 份文档汇总`;
  return titleForPath(prepared?.sourcePath || contract?.sourcePath);
}

function titleForJob(job) {
  const configured = String(job?.contract?.title ?? "").trim();
  if (configured) return configured;
  const sourcePaths = Array.isArray(job?.sourcePaths) ? job.sourcePaths : [];
  if (sourcePaths.length > 1) return `${sourcePaths.length} 份文档汇总`;
  return titleForPath(job?.sourcePath);
}

function renderCollectionSources(prepared, sourceSummary) {
  const summaries = Array.isArray(sourceSummary?.sourceSummaries) ? sourceSummary.sourceSummaries : [];
  if (summaries.length <= 1) return "";
  const byPath = new Map(summaries.map((entry) => [String(entry.sourcePath), entry]));
  const sources = Array.isArray(prepared?.sources) ? prepared.sources : [];
  const rows = sources.map((source, index) => {
    const sourcePath = String(source?.sourcePath || source?.readablePath || "");
    const summary = byPath.get(sourcePath) ?? summaries[index] ?? {};
    const sourceId = summary.sourceId || `source-${String(index + 1).padStart(3, "0")}`;
    const sourceName = basename(sourcePath) || `document-${index + 1}`;
    const kind = summary.documentKind || source?.documentKind || "document";
    const units = Number(summary.totalUnits) || 0;
    return `- \`${sourceId}\` ${sourceName}（${kind}，${units} 个来源区块）`;
  });
  return ["## 来源清单", ...rows].join("\n\n");
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

const SOURCE_PLAN_POLICY_FIELDS = [
  "batchInputTokens",
  "maxUnitsPerBatch",
  "maxVisualUnitsPerBatch",
  "semanticBatching",
  "contextOverlapTokens",
];

function sourcePlanPolicy(policy) {
  return Object.fromEntries(SOURCE_PLAN_POLICY_FIELDS.map((field) => [field, policy?.[field] ?? null]));
}

function sourcePlanBatch(batch) {
  return {
    id: String(batch?.id ?? ""),
    index: Number(batch?.index) || 0,
    label: String(batch?.label ?? ""),
    unitIds: Array.isArray(batch?.unitIds) ? batch.unitIds.map(String) : [],
    unitManifest: unitManifest(batch?.units ?? []),
  };
}

function hashSourcePlan(plan) {
  const stable = {
    schemaVersion: 1,
    sourceFingerprint: plan?.sourceFingerprint ?? null,
    planningPolicy: plan?.planningPolicy ?? null,
    batches: (Array.isArray(plan?.batches) ? plan.batches : [])
      .slice()
      .sort((left, right) => (Number(left.index) || 0) - (Number(right.index) || 0))
      .map((batch) => ({
        id: batch.id,
        index: batch.index,
        unitIds: batch.unitIds,
        unitManifest: batch.unitManifest,
      })),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function executionEpochSnapshot(jobId, sequence, reason, candidates, sourcePlanHash = null, inheritedModelCallCount = 0) {
  return {
    id: `${jobId}:${sequence}`,
    sequence,
    reason,
    startedAt: new Date().toISOString(),
    sourcePlanHash: sourcePlanHash || null,
    inheritedModelCallCount: Number(inheritedModelCallCount) || 0,
    candidates: (Array.isArray(candidates) ? candidates : []).map((candidate) => ({
      providerId: candidate?.providerId ?? null,
      modelId: candidate?.modelId ?? null,
      role: candidate?.role ?? null,
      configFingerprint: candidate?.configFingerprint ?? null,
      verificationStatus: candidate?.verificationStatus ?? null,
      documentPolicy: candidate?.documentPolicy ?? null,
    })),
  };
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

function sourceFingerprintsMatch(left, right) {
  const normalize = (value) => (Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .map((entry) => ({
      path: String(entry?.path ?? ""),
      size: Number(entry?.size) || 0,
      sha256: String(entry?.sha256 ?? ""),
    }));
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function candidateKey(candidate) {
  return candidate?.key || `${candidate?.providerId || "unknown"}\0${candidate?.modelId || "unknown"}`;
}

function candidateCircuitKey(candidate) {
  const key = candidateKey(candidate);
  const fingerprint = String(candidate?.configFingerprint ?? "").trim();
  return fingerprint ? `${key}\0${fingerprint}` : key;
}

const DOCUMENT_MODEL_ERROR_DEFINITIONS = Object.freeze({
  insufficient_balance: {
    message: "模型账户余额不足，暂时无法调用。",
    action: "充值或更换可用模型后，再重试受影响区块。",
    retryable: false,
    requiresUserAction: true,
  },
  quota_exhausted: {
    message: "模型调用额度不足或已用尽。",
    action: "补充额度或更换可用模型后，再重试受影响区块。",
    retryable: false,
    requiresUserAction: true,
  },
  authentication: {
    message: "模型 API Key 无效，或当前账号没有访问权限。",
    action: "检查服务商配置和 API Key 后，再重试受影响区块。",
    retryable: false,
    requiresUserAction: true,
  },
  rate_limit: {
    message: "模型服务请求过于频繁，触发了限流。",
    action: "稍后再重试受影响区块。",
    retryable: true,
    requiresUserAction: false,
  },
  timeout: {
    message: "模型响应超时，未能在规定时间内返回完整结果。",
    action: "确认模型服务可用后，再重试受影响区块。",
    retryable: true,
    requiresUserAction: false,
  },
  output_truncated: {
    message: "模型输出达到长度上限，结果不完整。",
    action: "缩小处理区块或调整模型输出上限后，再重试。",
    retryable: true,
    requiresUserAction: true,
  },
  context_overflow: {
    message: "当前区块超过模型上下文窗口，正在自动拆分后继续。",
    action: "程序会缩小区块重试；如果仍失败，可降低单区块大小或更换模型。",
    retryable: true,
    requiresUserAction: false,
  },
  capability_mismatch: {
    message: "模型不支持本次请求所需的内容或参数格式。",
    action: "检查模型 JSON 能力配置，或改用兼容模型后重试。",
    retryable: false,
    requiresUserAction: true,
  },
  model_unavailable: {
    message: "指定模型不存在、已下架或当前不可用。",
    action: "更新模型配置或改用其他模型后重试。",
    retryable: false,
    requiresUserAction: true,
  },
  network: {
    message: "无法连接模型服务，可能是网络、代理或服务暂时不可用。",
    action: "检查网络或代理后，再重试受影响区块。",
    retryable: true,
    requiresUserAction: false,
  },
  unknown: {
    message: "模型调用失败，未能完成本区块处理。",
    action: "查看技术详情，确认模型配置后再重试。",
    retryable: true,
    requiresUserAction: false,
  },
});

function diagnosticText(value) {
  return String(value ?? "")
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|authorization)\s*[:=]\s*["']?[^\s,"'}]+/gi, "$1=[redacted]")
    .replace(/\b(?:sk|key)-[a-z0-9_-]{12,}\b/gi, "[redacted-key]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function diagnosticStatusCode(value) {
  const match = diagnosticText(value).match(/\b([45]\d{2})\b/);
  return match ? Number(match[1]) : null;
}

/**
 * Convert provider-specific failures into a stable, user-facing category.
 * The raw provider message remains available as a short, redacted technical detail.
 */
export function classifyDocumentModelError(error) {
  const raw = diagnosticText(typeof error === "string" ? error : error?.message || error?.error || error);
  const errorName = String(error?.name || error?.errorName || "");
  const source = `${errorName} ${raw}`;
  let category = "unknown";
  if (/(?:\b402\b|balance.{0,30}(?:insufficient|not enough|exhausted|empty)|(?:insufficient|not enough).{0,30}balance|余额(?:不足|已用尽|耗尽)|欠费)/iu.test(source)) category = "insufficient_balance";
  else if (/quota\s+(?:is\s+)?(?:insufficient|exhausted|exceeded)|insufficient\s+quota|配额(?:不足|已用尽|耗尽)|调用额度/iu.test(source)) category = "quota_exhausted";
  else if (/(?:context[_ -]?(?:length|window|limit)|maximum context|context window|上下文.{0,12}(?:超出|过大|上限|窗口)|输入.{0,12}(?:过长|超限))/iu.test(source)) category = "context_overflow";
  else if (/output.{0,30}(?:limit|truncat|incomplete)|truncat(?:ed|ion)|结果不完整|输出达到.{0,12}上限|finish.?reason.{0,12}length/iu.test(source)) category = "output_truncated";
  else if (/timeout|timed out|deadline|aborted due to timeout|总时长上限|响应超时|请求超时/iu.test(source)) category = "timeout";
  else if (/\b429\b|rate.?limit|too many requests|请求过于频繁|限流/iu.test(source)) category = "rate_limit";
  else if (/\b(?:401|403)\b|unauthori[sz]ed|forbidden|invalid api key|api key.{0,20}(?:invalid|错误|无效)|无权限|未授权/iu.test(source)) category = "authentication";
  else if (/unknown variant|unsupported (?:content|media|message)|image_url|不支持.*(?:图片|参数|格式)|failed to deserialize|invalid_request_error/iu.test(source)) category = "capability_mismatch";
  else if (/\b(?:404|410)\b|model .*?(?:not found|does not exist)|模型.*(?:不存在|下架|不可用)/i.test(source)) category = "model_unavailable";
  else if (/fetch failed|enotfound|econn(reset|refused)|network|proxy|certificate|tls|ssl|网络|代理|连接失败/iu.test(source)) category = "network";
  const definition = DOCUMENT_MODEL_ERROR_DEFINITIONS[category];
  return {
    category,
    message: definition.message,
    action: definition.action,
    retryable: definition.retryable,
    requiresUserAction: definition.requiresUserAction,
    statusCode: diagnosticStatusCode(raw),
    technicalMessage: raw || "未返回具体错误信息",
  };
}

function diagnosticEntryKey(entry) {
  return [entry.providerId, entry.modelId, entry.category, entry.batchId || "task", entry.origin || "request"].join("\0");
}

function normalizeDiagnosticList(value) {
  return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === "object") : [];
}

function modelDiagnosticMap(value) {
  return new Map(normalizeDiagnosticList(value).map((entry) => [diagnosticEntryKey(entry), entry]));
}

function disabledCandidateSet(value) {
  return new Set(Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : []);
}

function disabledCandidateDetailMap(value) {
  return new Map((Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry === "object" && String(entry.key ?? ""))
    .map((entry) => [String(entry.key), entry]));
}

/** Group per-call diagnostics into concise task-level entries for the UI. */
export function summarizeDocumentModelDiagnostics(value) {
  const groups = new Map();
  for (const entry of normalizeDiagnosticList(value)) {
    if (entry.active === false) continue;
    const key = [entry.providerId, entry.modelId, entry.category].join("\0");
    const existing = groups.get(key) ?? {
      providerId: entry.providerId ?? null,
      modelId: entry.modelId ?? null,
      category: entry.category || "unknown",
      message: entry.message || DOCUMENT_MODEL_ERROR_DEFINITIONS.unknown.message,
      action: entry.action || DOCUMENT_MODEL_ERROR_DEFINITIONS.unknown.action,
      retryable: entry.retryable !== false,
      requiresUserAction: entry.requiresUserAction === true,
      occurrences: 0,
      affectedBatches: [],
      technicalMessages: [],
      statusCodes: [],
      stages: [],
    };
    existing.occurrences += Math.max(1, Number(entry.occurrences) || 1);
    existing.retryable &&= entry.retryable !== false;
    existing.requiresUserAction ||= entry.requiresUserAction === true;
    if (entry.batchId && !existing.affectedBatches.some((batch) => batch.id === entry.batchId)) {
      existing.affectedBatches.push({ id: entry.batchId, label: entry.batchLabel || entry.batchId });
    }
    if (entry.technicalMessage && !existing.technicalMessages.includes(entry.technicalMessage)) existing.technicalMessages.push(entry.technicalMessage);
    if (Number.isInteger(entry.statusCode) && !existing.statusCodes.includes(entry.statusCode)) existing.statusCodes.push(entry.statusCode);
    if (entry.stage && !existing.stages.includes(entry.stage)) existing.stages.push(entry.stage);
    groups.set(key, existing);
  }
  return [...groups.values()].map((entry) => ({
    ...entry,
    affectedBatches: entry.affectedBatches.slice(0, 50),
    technicalMessages: entry.technicalMessages.slice(0, 3),
    statusCodes: entry.statusCodes.slice(0, 3),
    stages: entry.stages.slice(0, 8),
  }));
}

export function buildDocumentQualityWarnings({ batches = [], diagnostics = [], assemblyAudit = null } = {}) {
  const records = Array.isArray(batches) ? batches : [];
  const degraded = records.filter((batch) => batch?.status !== "completed");
  const warnings = [];
  if (degraded.length > 0) {
    warnings.push({
      type: "document-quality-degraded",
      message: `${degraded.length} 个来源区块未通过完整质量审查，输出文件已生成，需要复核。`,
      batchCount: degraded.length,
    });
  }
  const visualPending = records.filter((batch) => (batch?.quality?.failures ?? []).some((failure) => failure?.type === "visual-pending"));
  if (visualPending.length > 0) {
    warnings.push({
      type: "document-visual-review-pending",
      message: `${visualPending.length} 个区块包含图片或图表，视觉内容尚未完成模型复核。`,
      batchCount: visualPending.length,
    });
  }
  const sourceFallback = records.filter((batch) => batch?.sourceFallback === true);
  if (sourceFallback.length > 0) {
    warnings.push({
      type: "document-source-fallback",
      message: `${sourceFallback.length} 个区块未能生成合格的模型整理，已保留原始提取内容。`,
      batchCount: sourceFallback.length,
    });
  }
  const reviewUnavailable = records.filter((batch) => (batch?.review?.unavailable === true) || (batch?.review?.errors?.length > 0 && batch?.status !== "completed"));
  if (reviewUnavailable.length > 0) {
    warnings.push({
      type: "document-quality-review-unavailable",
      message: `${reviewUnavailable.length} 个区块未能完成独立质量审校。`,
      batchCount: reviewUnavailable.length,
    });
  }
  for (const issue of summarizeDocumentModelDiagnostics(diagnostics)) {
    const batchesText = issue.affectedBatches.length > 0
      ? `影响区块：${issue.affectedBatches.slice(0, 6).map((batch) => batch.label).join("、")}${issue.affectedBatches.length > 6 ? "等" : ""}。`
      : "影响任务级模型调用。";
    warnings.push({
      type: "model-service-issue",
      category: issue.category,
      providerId: issue.providerId,
      modelId: issue.modelId,
      message: `${issue.message} ${batchesText}`,
      action: issue.action,
      retryable: issue.retryable,
      requiresUserAction: issue.requiresUserAction,
      occurrences: issue.occurrences,
      affectedBatches: issue.affectedBatches,
      technicalMessages: issue.technicalMessages,
    });
  }
  if (assemblyAudit && assemblyAudit.passed === false) {
    warnings.push({
      type: "document-assembly-audit",
      message: "最终正文的来源顺序或覆盖审计未通过，需要复核。",
      details: assemblyAudit,
    });
  }
  return warnings;
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
  const primaryCandidates = candidates.filter((candidate) => candidate?.role === "primary");
  const policyCandidates = primaryCandidates.length > 0 ? primaryCandidates : candidates.slice(0, 1);
  for (const candidate of policyCandidates) {
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
  let effective = normalizeDocumentPolicy(merged);
  for (const candidate of policyCandidates) effective = boundPolicyToCandidateCapabilities(effective, candidate);
  return effective;
}

function positiveCapabilityInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function boundPolicyToCandidateCapabilities(policy, candidate) {
  const bounded = { ...policy };
  const maxOutputTokens = positiveCapabilityInteger(candidate?.maxOutputTokens);
  if (maxOutputTokens !== null) bounded.batchOutputTokens = Math.min(bounded.batchOutputTokens, maxOutputTokens);

  const maxContextTokens = positiveCapabilityInteger(candidate?.maxContextTokens);
  if (maxContextTokens !== null) {
    const declaredReserve = positiveCapabilityInteger(candidate?.contextReserveTokens);
    const reserve = Math.min(
      Math.floor(maxContextTokens / 2),
      declaredReserve ?? Math.max(1_024, Math.floor(maxContextTokens / 10)),
    );
    const availableInput = Math.max(256, maxContextTokens - bounded.batchOutputTokens - reserve);
    bounded.batchInputTokens = Math.min(bounded.batchInputTokens, availableInput);
  }
  return bounded;
}

function documentPolicyForCandidate(basePolicy, candidate) {
  const policy = boundPolicyToCandidateCapabilities(normalizeDocumentPolicy({
    ...basePolicy,
    ...(candidate?.documentPolicy && typeof candidate.documentPolicy === "object" ? candidate.documentPolicy : {}),
  }), candidate);
  if (candidate?.multimodal === true && Number.isSafeInteger(candidate.maxImages)) {
    policy.maxVisualUnitsPerBatch = Math.min(policy.maxVisualUnitsPerBatch, candidate.maxImages);
  }
  return policy;
}

function batchPolicyViolations(batch, policy, countTokens) {
  const violations = [];
  const units = Array.isArray(batch?.units) ? batch.units : [];
  const inputTokens = countTokens(String(batch?.text || units.map((unit) => unit.text || "").join("\n\n")));
  const visualUnits = units.filter((unit) => unit?.visualPending && /^data:image\//i.test(String(unit?.visualDataUrl || ""))).length;
  if (units.length > policy.maxUnitsPerBatch) violations.push({ type: "units", actual: units.length, limit: policy.maxUnitsPerBatch });
  if (inputTokens > policy.batchInputTokens) violations.push({ type: "input-tokens", actual: inputTokens, limit: policy.batchInputTokens });
  if (visualUnits > policy.maxVisualUnitsPerBatch) violations.push({ type: "visual-units", actual: visualUnits, limit: policy.maxVisualUnitsPerBatch });
  return violations;
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
  if (/(?:context[_ -]?(?:length|window|limit)|maximum context|context window|上下文.{0,12}(?:超出|过大|上限|窗口)|输入.{0,12}(?:过长|超限))/iu.test(message)) return false;
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

function targetedRepairUnitIds(result, batch) {
  const requested = new Set();
  let hasUnscopedFailure = false;
  for (const failure of result?.quality?.failures ?? []) {
    if (failure?.type === "coverage") {
      for (const id of [...(failure.missingUnitIds ?? []), ...(failure.thinUnitIds ?? []), ...(failure.duplicateUnitIds ?? [])]) requested.add(String(id));
      if ((failure.unexpectedUnitIds ?? []).length > 0) hasUnscopedFailure = true;
    } else if (failure?.type === "visual-pending") {
      for (const id of failure.unitIds ?? []) requested.add(String(id));
    } else {
      hasUnscopedFailure = true;
    }
  }
  for (const issue of result?.review?.issues ?? []) {
    if (issue?.unitId) requested.add(String(issue.unitId));
  }
  if (hasUnscopedFailure) return [];
  return (batch?.unitIds ?? []).filter((id) => requested.has(String(id)));
}

function repairContextUnits(batch, targetIds) {
  const target = new Set(targetIds);
  const neighbors = [];
  for (let index = 0; index < (batch?.units ?? []).length; index++) {
    if (!target.has(batch.units[index].id)) continue;
    for (const neighborIndex of [index - 1, index + 1]) {
      const unit = batch.units[neighborIndex];
      if (!unit || target.has(unit.id)) continue;
      neighbors.push({ ...unit, contextOnly: true, contextRole: neighborIndex < index ? "before" : "after", visualDataUrl: null });
    }
  }
  return uniqueContextUnits([...(batch?.contextUnits ?? []), ...neighbors]);
}

function createRepairBatch(batch, unitIds, suffix = "1") {
  const wanted = new Set(unitIds);
  return normalizeBatch({
    id: `${batch.id}-repair-${suffix}`,
    index: batch.index,
    label: `${batch.label} · targeted repair`,
    units: (batch.units ?? []).filter((unit) => wanted.has(unit.id)),
    contextUnits: repairContextUnits(batch, unitIds),
  });
}

function canonicalRepairBase(batch, section) {
  const fallback = renderDocumentSourceFallback(batch.units, "等待针对性修复");
  if (!String(section ?? "").trim()) return fallback;
  const merged = mergeDocumentUnitSections({
    markdown: fallback,
    patchMarkdown: section,
    allowedUnitIds: batch.unitIds,
  });
  return merged.ok ? merged.markdown : fallback;
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
    command: `整理 ${job.sourceName || titleForJob(job)}`,
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
      taskModelCalls: Number(job?.modelCallCount) || 0,
      totalSources: Number(progress.totalSources) || (Array.isArray(job.sourcePaths) && job.sourcePaths.length > 0 ? job.sourcePaths.length : 1),
      completedSources: Number(progress.completedSources) || 0,
      currentSource: progress.currentSource || null,
      unitLabel: progress.unitLabel || (/\.pdf$/i.test(String(job.sourcePath || "")) ? "页" : "区块"),
      lastHeartbeatAt: progress.lastHeartbeatAt || null,
    },
    model: job.currentModel ?? (latestBatch ? `${latestBatch.providerId}/${latestBatch.modelId}` : null),
    modelRole: job.currentModelRole ?? latestBatch?.modelRole ?? null,
    sourceKind: job.sourceKind ?? null,
    taskType: job.taskType ?? "document",
    sourcePaths: Array.isArray(job.sourcePaths) ? job.sourcePaths : [],
    sourceFingerprint: job.sourceFingerprint ?? null,
    taskFingerprint: job.taskFingerprint ?? null,
    outputPath: job.outputPath,
    contract: job.contract ?? null,
    sourceAudit: job.sourceAudit ?? null,
    modelHistory: Array.isArray(job.modelHistory) ? job.modelHistory : [],
    policyTrace: job.policyTrace ?? null,
    policy: job.policy ? {
      batchInputTokens: job.policy.batchInputTokens,
      maxUnitsPerBatch: job.policy.maxUnitsPerBatch,
      maxVisualUnitsPerBatch: job.policy.maxVisualUnitsPerBatch,
    } : null,
    previewAvailable: Array.isArray(job.batches) && job.batches.length > 0,
    qualityPassed: job.qualityPassed,
    lastModelCall: job.lastModelCall ?? null,
    modelIssues: summarizeDocumentModelDiagnostics(job.modelDiagnostics),
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

  function persistedModelDiagnostics(runtime) {
    return [...(runtime.modelDiagnostics ?? new Map()).values()];
  }

  function persistedDisabledCandidates(runtime) {
    return [...(runtime.disabledCandidates ?? new Set())];
  }

  function persistedDisabledCandidateDetails(runtime) {
    return [...(runtime.disabledCandidateDetails ?? new Map()).values()];
  }

  function candidateDisabled(runtime, candidate) {
    return runtime.disabledCandidates?.has(candidateCircuitKey(candidate)) === true;
  }

  function persistCandidateCircuit(runtime, context) {
    queueProgress(runtime, {}, {
      disabledCandidates: persistedDisabledCandidates(runtime),
      disabledCandidateDetails: persistedDisabledCandidateDetails(runtime),
    }, context);
  }

  function disableCandidate(runtime, candidate, origin = "request") {
    runtime.disabledCandidates ??= new Set();
    runtime.disabledCandidateDetails ??= new Map();
    runtime.candidateAvailability ??= new Map();
    const key = candidateCircuitKey(candidate);
    runtime.candidateAvailability.set(key, false);
    if (runtime.disabledCandidates.has(key)) return;
    runtime.disabledCandidates.add(key);
    runtime.disabledCandidateDetails.set(key, {
      key,
      origin,
      disabledAt: new Date().toISOString(),
      verificationCheckedAt: candidate?.verificationCheckedAt ?? null,
    });
    persistCandidateCircuit(runtime, "model-circuit-disabled");
  }

  function enableCandidate(runtime, candidate) {
    const key = candidateCircuitKey(candidate);
    runtime.disabledCandidates?.delete(key);
    runtime.disabledCandidateDetails?.delete(key);
    runtime.candidateAvailability ??= new Map();
    runtime.candidateAvailability.set(key, true);
    persistCandidateCircuit(runtime, "model-circuit-enabled");
  }

  function recordModelDiagnostic(runtime, details, error, origin = "request") {
    runtime.modelDiagnostics ??= new Map();
    const classified = classifyDocumentModelError(error);
    const now = new Date().toISOString();
    const next = {
      providerId: details?.providerId ?? null,
      modelId: details?.modelId ?? null,
      role: details?.role ?? null,
      stage: details?.stage ?? null,
      batchId: details?.batchId ?? null,
      batchLabel: details?.batchLabel ?? null,
      origin,
      ...classified,
      active: true,
      occurrences: 1,
      firstAt: now,
      lastAt: now,
    };
    const key = diagnosticEntryKey(next);
    const previous = runtime.modelDiagnostics.get(key);
    if (previous) {
      next.occurrences = Math.max(1, Number(previous.occurrences) || 1) + 1;
      next.firstAt = previous.firstAt || now;
    }
    runtime.modelDiagnostics.set(key, next);
    queueProgress(runtime, {}, { modelDiagnostics: persistedModelDiagnostics(runtime) }, "model-diagnostic");
    if (!previous) {
      void store.appendEvent?.(runtime.id, {
        type: origin === "probe" ? "model-probe-failed" : "model-diagnostic",
        providerId: next.providerId,
        modelId: next.modelId,
        role: next.role,
        stage: next.stage,
        batchId: next.batchId,
        batchLabel: next.batchLabel,
        category: next.category,
        message: next.message,
        action: next.action,
        statusCode: next.statusCode,
        technicalMessage: next.technicalMessage,
      }).catch((eventError) => reportPersistenceError(runtime, eventError, "model-diagnostic-event"));
    }
    return next;
  }

  function resolveModelDiagnostics(runtime, details, origin = "request") {
    let changed = false;
    for (const [key, entry] of runtime.modelDiagnostics ?? []) {
      if (entry.active === false || entry.origin !== origin) continue;
      if (entry.providerId !== (details?.providerId ?? null) || entry.modelId !== (details?.modelId ?? null)) continue;
      if ((entry.batchId ?? null) !== (details?.batchId ?? null)) continue;
      runtime.modelDiagnostics.set(key, { ...entry, active: false, resolvedAt: new Date().toISOString() });
      changed = true;
    }
    if (changed) queueProgress(runtime, {}, { modelDiagnostics: persistedModelDiagnostics(runtime) }, "model-diagnostic-resolved");
  }

  function resolveBatchModelDiagnostics(runtime, batchId) {
    let changed = false;
    for (const [key, entry] of runtime.modelDiagnostics ?? []) {
      if (entry.active === false || entry.batchId !== batchId) continue;
      runtime.modelDiagnostics.set(key, { ...entry, active: false, resolvedAt: new Date().toISOString() });
      changed = true;
    }
    if (changed) queueProgress(runtime, {}, { modelDiagnostics: persistedModelDiagnostics(runtime) }, "batch-diagnostic-resolved");
  }

  function reserveTaskModelCall(runtime, details) {
    runtime.modelCallCount = Math.max(0, Number(runtime.modelCallCount) || 0) + 1;
    const call = {
      id: `${runtime.id}:${runtime.modelCallCount}`,
      number: runtime.modelCallCount,
      providerId: details.providerId ?? null,
      modelId: details.modelId ?? null,
      role: details.role ?? null,
      purpose: details.purpose ?? null,
      stage: details.stage ?? null,
      batchId: details.batchId ?? null,
      batchLabel: details.batchLabel ?? null,
      startedAt: new Date().toISOString(),
      finishReason: null,
    };
    queueProgress(runtime, {
      taskModelCalls: runtime.modelCallCount,
    }, {
      modelCallCount: runtime.modelCallCount,
      lastModelCall: call,
    }, "task-model-call-reservation");
    return call;
  }

  function reserveModelCall(runtime, budget, details) {
    if (budget.used >= budget.limit) return null;
    budget.used++;
    const call = reserveTaskModelCall(runtime, details);
    queueProgress(runtime, {
      ...details,
      modelCalls: budget.used,
      modelCallLimit: budget.limit,
      taskModelCalls: runtime.modelCallCount,
    }, {}, "model-call-reservation");
    return call;
  }

  async function runTrackedModelCall(runtime, call, invoke) {
    await store.appendEvent?.(runtime.id, {
      type: "model-call-started",
      ...call,
    }).catch((error) => reportPersistenceError(runtime, error, "model-call-start-event"));
    const startedAt = Date.parse(call.startedAt) || Date.now();
    try {
      const result = await invoke(call);
      resolveModelDiagnostics(runtime, call);
      const completed = {
        ...call,
        type: "model-call-completed",
        completedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - startedAt),
        outputChars: String(result ?? "").length,
        status: "completed",
      };
      queueProgress(runtime, { taskModelCalls: runtime.modelCallCount }, { lastModelCall: completed }, "model-call-completion");
      await store.appendEvent?.(runtime.id, completed)
        .catch((error) => reportPersistenceError(runtime, error, "model-call-completed-event"));
      return result;
    } catch (error) {
      recordModelDiagnostic(runtime, call, error);
      const failed = {
        ...call,
        type: "model-call-failed",
        completedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - startedAt),
        status: "failed",
        errorName: String(error?.name || "Error"),
        error: String(error?.message || error).slice(0, 500),
      };
      queueProgress(runtime, { taskModelCalls: runtime.modelCallCount }, { lastModelCall: failed }, "model-call-failure");
      await store.appendEvent?.(runtime.id, failed)
        .catch((eventError) => reportPersistenceError(runtime, eventError, "model-call-failed-event"));
      throw error;
    }
  }

  async function waitForTurn(runtime) {
    let announced = false;
    while (runtime.paused || options.isForegroundBusy?.() || options.isProviderBusy?.()) {
      if (runtime.controller.signal.aborted) throw abortError();
      const waitingForForeground = !runtime.paused && options.isForegroundBusy?.();
      const waitingForProvider = !runtime.paused && !waitingForForeground && options.isProviderBusy?.();
      await emit(runtime.id, {
        status: runtime.paused ? "paused" : waitingForForeground ? "waiting_foreground" : "waiting_provider",
        running: !runtime.paused,
        paused: runtime.paused,
        progress: {
          stage: runtime.paused ? "paused" : waitingForForeground ? "waiting-foreground" : "waiting-provider",
          lastHeartbeatAt: new Date().toISOString(),
        },
      });
      if ((waitingForForeground || waitingForProvider) && !announced) {
        announced = true;
        if (waitingForForeground) options.onWaitingForForeground?.(runtime.id);
        else options.onWaitingForProvider?.(runtime.id);
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

  async function requestReview(candidate, batch, section, runtime, budget, candidatePolicy) {
    const messages = buildDocumentReviewMessages({ batch, markdown: section, contract: runtime.contract });
    const errors = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const modelCall = reserveModelCall(runtime, budget, {
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        role: candidate.role,
        purpose: "verification",
        stage: "quality-review",
        batchId: batch.id,
        batchLabel: batch.label,
        currentBatch: batch.id,
        currentLabel: batch.label,
        attempt: attempt + 1,
        maxAttempts: 2,
        generatedChars: 0,
        elapsedMs: 0,
      });
      if (!modelCall) break;
      const reviewMessages = attempt === 0 ? messages : buildDocumentReviewMessages({ batch, markdown: section, contract: runtime.contract, retry: true });
      const withVisuals = messagesWithBatchVisuals(reviewMessages, batch, candidate);
      try {
        const value = await runTrackedModelCall(runtime, modelCall, () => options.generate({
          candidate,
          batch,
          contract: runtime.contract,
          messages: withVisuals.messages,
          purpose: "verification",
          maxTokens: Math.min(2_048, positiveCapabilityInteger(candidate?.maxOutputTokens) ?? 2_048),
          requestTimeoutMs: candidatePolicy.requestTimeoutMs,
          onProgress: (progress) => {
            if (progress?.finishReason) modelCall.finishReason = progress.finishReason;
            queueProgress(runtime, {
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
        }));
        const parsed = parseDocumentReview(value, batch.unitIds);
        if (parsed) return { ...softenReview(parsed), errors };
      } catch (error) {
        if (runtime.controller.signal.aborted || error?.name === "AbortError") throw error;
        errors.push(String(error?.message || error).slice(0, 500));
        if (isNonRetryableDocumentModelError(error)) {
          disableCandidate(runtime, candidate);
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

  async function tryTargetedRepair(candidate, batch, runtime, budget, candidatePolicy, seedResult) {
    const targetIds = targetedRepairUnitIds(seedResult, batch);
    if (targetIds.length === 0) return null;
    const visualIds = new Set((seedResult?.quality?.failures ?? [])
      .filter((failure) => failure?.type === "visual-pending")
      .flatMap((failure) => failure.unitIds ?? []).map(String));
    if (visualIds.size > 0 && targetIds.every((id) => visualIds.has(id)) && candidate.multimodal !== true) return null;

    const repairBatch = createRepairBatch(batch, targetIds);
    const base = canonicalRepairBase(batch, seedResult.section);
    const issueText = [
      ...(seedResult?.quality?.failures ?? []).map((failure) => `${failure.type}: ${JSON.stringify(failure)}`),
      ...(seedResult?.review?.issues ?? []).map((issue) => `${issue.type} ${issue.unitId}: ${issue.detail}`),
    ].join("\n");
    const messages = buildDocumentSectionMessages({ batch: repairBatch, contract: runtime.contract, retry: true });
    const lastMessage = messages.at(-1);
    if (lastMessage && typeof lastMessage.content === "string") {
      lastMessage.content = `${lastMessage.content}\n\n<targeted_repair>\nRepair only these source-unit markers: ${targetIds.join(", ")}.\nDo not emit any other marker.\nKnown issues:\n${issueText}\n</targeted_repair>`;
    }
    const withVisuals = messagesWithBatchVisuals(messages, repairBatch, candidate);
    const modelCall = reserveModelCall(runtime, budget, {
      providerId: candidate.providerId,
      modelId: candidate.modelId,
      role: candidate.role,
      purpose: "toolContinuation",
      stage: "unit-repair",
      batchId: batch.id,
      batchLabel: batch.label,
      currentBatch: batch.id,
      currentLabel: batch.label,
      attempt: 1,
      maxAttempts: 1,
      generatedChars: 0,
      elapsedMs: 0,
      repairUnitIds: targetIds,
    });
    if (!modelCall) return null;
    try {
      await store.appendEvent?.(runtime.id, {
        type: "unit-repair-started",
        batchId: batch.id,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        unitIds: targetIds,
      }).catch((error) => reportPersistenceError(runtime, error, "unit-repair-event"));
      const patch = cleanMarkdown(await runTrackedModelCall(runtime, modelCall, () => options.generate({
        candidate,
        batch: repairBatch,
        contract: runtime.contract,
        messages: withVisuals.messages,
        purpose: "toolContinuation",
        maxTokens: candidatePolicy.batchOutputTokens,
        requestTimeoutMs: candidatePolicy.requestTimeoutMs,
        onProgress: (progress) => {
          if (progress?.finishReason) modelCall.finishReason = progress.finishReason;
          queueProgress(runtime, {
            stage: "unit-repair",
            currentBatch: batch.id,
            currentLabel: batch.label,
            repairUnitIds: targetIds,
            generatedChars: Number(progress?.generatedChars) || 0,
            elapsedMs: Number(progress?.elapsedMs) || 0,
            modelCalls: budget.used,
            modelCallLimit: budget.limit,
          }, {}, "unit-repair-progress");
        },
        retry: true,
        signal: runtime.controller.signal,
      })));
      const merged = mergeDocumentUnitSections({ markdown: base, patchMarkdown: patch, allowedUnitIds: targetIds });
      const replaced = new Set(merged.replacedUnitIds ?? []);
      if (!merged.ok || replaced.size !== targetIds.length || targetIds.some((id) => !replaced.has(id))) {
        await store.appendEvent?.(runtime.id, {
          type: "unit-repair-rejected",
          batchId: batch.id,
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          unitIds: targetIds,
          replacedUnitIds: merged.replacedUnitIds ?? [],
          reason: "patch markers did not match the requested unit set",
        }).catch((error) => reportPersistenceError(runtime, error, "unit-repair-event"));
        return {
          passed: false,
          section: base,
          quality: evaluateDocumentQuality({ units: batch.units, markdown: base, fidelity: runtime.contract.fidelity, resolvedVisualUnitIds: seedResult.resolvedVisualUnitIds ?? [] }),
          review: null,
          attempts: 1,
          candidate,
          errors: ["targeted repair returned an incomplete or unexpected marker set"],
          failureCategories: [],
        };
      }
      const resolvedVisualUnitIds = [...new Set([...(seedResult.resolvedVisualUnitIds ?? []), ...withVisuals.visualUnitIds])];
      const quality = evaluateDocumentQuality({ units: batch.units, markdown: merged.markdown, fidelity: runtime.contract.fidelity, resolvedVisualUnitIds });
      if (!quality.passed) {
        await store.appendEvent?.(runtime.id, {
          type: "unit-repair-completed",
          batchId: batch.id,
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          unitIds: targetIds,
          passed: false,
          failures: quality.failures,
        }).catch((error) => reportPersistenceError(runtime, error, "unit-repair-event"));
        return { passed: false, section: merged.markdown, quality, review: null, attempts: 1, candidate, errors: [], failureCategories: [], resolvedVisualUnitIds };
      }
      const review = await requestReview(candidate, batch, merged.markdown, runtime, budget, candidatePolicy);
      await store.appendEvent?.(runtime.id, {
        type: "unit-repair-completed",
        batchId: batch.id,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        unitIds: targetIds,
        passed: review.pass === true,
      }).catch((error) => reportPersistenceError(runtime, error, "unit-repair-event"));
      return {
        passed: review.pass === true,
        section: merged.markdown,
        quality,
        review,
        attempts: 1,
        candidate,
        errors: review.errors ?? [],
        failureCategories: [],
        resolvedVisualUnitIds,
      };
    } catch (error) {
      if (runtime.controller.signal.aborted || error?.name === "AbortError") throw error;
      if (isNonRetryableDocumentModelError(error)) disableCandidate(runtime, candidate);
      return {
        passed: false,
        section: base,
        quality: evaluateDocumentQuality({ units: batch.units, markdown: base, fidelity: runtime.contract.fidelity, resolvedVisualUnitIds: seedResult.resolvedVisualUnitIds ?? [] }),
        review: null,
        attempts: 1,
        candidate,
        errors: [String(error?.message || error).slice(0, 500)],
        failureCategories: [classifyDocumentModelError(error).category],
        resolvedVisualUnitIds: seedResult.resolvedVisualUnitIds ?? [],
      };
    }
  }

  async function tryCandidate(candidate, batch, runtime, budget, candidatePolicy, seedResult = null) {
    let lastQuality = null;
    let lastReview = null;
    let lastSection = "";
    let lastResolvedVisualUnitIds = [];
    let attempts = 0;
    let reviewRepairs = 0;
    const errors = [];
    const failureCategories = new Set();
    if (seedResult && candidatePolicy.maxRetries >= 0) {
      const targeted = await tryTargetedRepair(candidate, batch, runtime, budget, candidatePolicy, seedResult);
      if (targeted) return targeted;
    }
    for (let attempt = 0; attempt <= candidatePolicy.maxRetries; attempt++) {
      await waitForTurn(runtime);
      const modelCall = reserveModelCall(runtime, budget, {
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        role: candidate.role,
        purpose: "toolContinuation",
        stage: attempt > 0 ? "quality-repair" : "draft",
        batchId: batch.id,
        batchLabel: batch.label,
        currentBatch: batch.id,
        currentLabel: batch.label,
        attempt: attempt + 1,
        maxAttempts: candidatePolicy.maxRetries + 1,
        generatedChars: 0,
        elapsedMs: 0,
      });
      if (!modelCall) {
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
        section = cleanMarkdown(await runTrackedModelCall(runtime, modelCall, () => options.generate({
          candidate,
          batch,
          contract: runtime.contract,
          messages: withVisuals.messages,
          purpose: "toolContinuation",
          maxTokens: candidatePolicy.batchOutputTokens,
          requestTimeoutMs: candidatePolicy.requestTimeoutMs,
          onProgress: (progress) => {
            if (progress?.finishReason) modelCall.finishReason = progress.finishReason;
            queueProgress(runtime, {
            stage: attempt > 0 ? "quality-repair" : "draft",
            currentBatch: batch.id,
            currentLabel: batch.label,
            attempt: attempt + 1,
            maxAttempts: candidatePolicy.maxRetries + 1,
            generatedChars: Number(progress?.generatedChars) || 0,
            elapsedMs: Number(progress?.elapsedMs) || 0,
            modelCalls: budget.used,
            modelCallLimit: budget.limit,
          }, {}, "draft-progress"); },
          retry: attempt > 0,
          signal: runtime.controller.signal,
        })));
      } catch (error) {
        if (runtime.controller.signal.aborted || error?.name === "AbortError") throw error;
        errors.push(String(error?.message || error).slice(0, 500));
        const category = classifyDocumentModelError(error).category;
        failureCategories.add(category);
        if (isNonRetryableDocumentModelError(error)) {
          disableCandidate(runtime, candidate);
          break;
        }
        if (["output_truncated", "context_overflow"].includes(category)) break;
        continue;
      }
      lastSection = section;
      lastQuality = evaluateDocumentQuality({
        units: batch.units,
        markdown: section,
        fidelity: runtime.contract.fidelity,
        resolvedVisualUnitIds: withVisuals.visualUnitIds,
      });
      lastResolvedVisualUnitIds = withVisuals.visualUnitIds;
      if (!lastQuality.passed) {
        const onlyUnresolvedVisuals = lastQuality.failures.every((failure) => failure.type === "visual-pending");
        if (onlyUnresolvedVisuals) break;
        if (attempt < candidatePolicy.maxRetries) {
          const targeted = await tryTargetedRepair(candidate, batch, runtime, budget, candidatePolicy, {
            section,
            quality: lastQuality,
            review: null,
            resolvedVisualUnitIds: lastResolvedVisualUnitIds,
          });
          if (targeted) return targeted;
        }
        continue;
      }
      lastReview = await requestReview(candidate, batch, section, runtime, budget, candidatePolicy);
      errors.push(...(lastReview.errors ?? []));
      if (lastReview.pass) return { passed: true, section, quality: lastQuality, review: lastReview, attempts, candidate, errors, failureCategories: [...failureCategories], resolvedVisualUnitIds: lastResolvedVisualUnitIds };
      if (lastReview.unavailable || reviewRepairs >= 1) break;
      reviewRepairs++;
      const targeted = await tryTargetedRepair(candidate, batch, runtime, budget, candidatePolicy, {
        section,
        quality: lastQuality,
        review: lastReview,
        resolvedVisualUnitIds: lastResolvedVisualUnitIds,
      });
      if (targeted) return { ...targeted, attempts: attempts + targeted.attempts };
    }
    return { passed: false, section: lastSection, quality: lastQuality, review: lastReview, attempts, candidate, errors, failureCategories: [...failureCategories], resolvedVisualUnitIds: lastResolvedVisualUnitIds };
  }

  async function candidateAvailable(candidate, runtime, batch = null) {
    if (candidate.role !== "primary" && !runtime.policy.autoFallback) return false;
    runtime.candidateAvailability ??= new Map();
    const key = candidateCircuitKey(candidate);
    const verificationStatus = String(candidate?.verificationStatus ?? "").toLowerCase();
    if (candidateDisabled(runtime, candidate)) {
      const disabledOrigin = runtime.disabledCandidateDetails?.get(key)?.origin;
      if (verificationStatus === "passed" && ["probe", "verification"].includes(disabledOrigin)) enableCandidate(runtime, candidate);
      else return false;
    }
    if (runtime.candidateAvailability.has(key)) return runtime.candidateAvailability.get(key) === true;
    const details = {
      providerId: candidate.providerId,
      modelId: candidate.modelId,
      role: candidate.role,
      stage: "availability-probe",
      batchId: batch?.id ?? null,
      batchLabel: batch?.label ?? null,
    };
    if (verificationStatus === "failed") {
      recordModelDiagnostic(runtime, details, candidate.verificationError || "最近一次模型检测未通过", "verification");
      disableCandidate(runtime, candidate, "verification");
      return false;
    }
    if (verificationStatus === "passed" && candidate.requiresProbe !== true) {
      runtime.candidateAvailability.set(key, true);
      return true;
    }
    const explicitlyRequiresProbe = candidate.requiresProbe === true || ["untested", "stale"].includes(verificationStatus);
    if (!explicitlyRequiresProbe && candidate.role === "primary") {
      runtime.candidateAvailability.set(key, true);
      return true;
    }
    if (typeof options.probeModel !== "function") {
      runtime.candidateAvailability.set(key, true);
      return true;
    }
    try {
      const result = await options.probeModel(candidate, runtime.controller.signal);
      if (runtime.controller.signal.aborted) throw abortError();
      if (result === true || result?.ok === true) {
        runtime.candidateAvailability.set(key, true);
        resolveModelDiagnostics(runtime, details, "probe");
        return true;
      }
      recordModelDiagnostic(runtime, details, result?.error || result?.message || "模型连通性检测未通过", "probe");
      disableCandidate(runtime, candidate, "probe");
      return false;
    } catch (error) {
      if (runtime.controller.signal.aborted || error?.name === "AbortError") throw error;
      recordModelDiagnostic(runtime, details, error, "probe");
      disableCandidate(runtime, candidate, "probe");
      return false;
    }
  }

  function canSplitResult(result) {
    const types = new Set((result?.quality?.failures ?? []).map((failure) => failure.type));
    if (["coverage", "length-retention", "technical-value-retention"].some((type) => types.has(type))) return true;
    const categories = new Set(result?.failureCategories ?? []);
    if (categories.has("output_truncated") || categories.has("context_overflow") || categories.has("timeout")) return true;
    return (result?.errors ?? []).some((message) => /timeout|timed out|deadline|总时长上限/i.test(message));
  }

  async function processBatch(batch, runtime, state, startCandidateIndex = 0) {
    const candidates = runtime.candidates;
    const attempts = [];
    let bestResult = null;
    let splitEligible = false;
    const countTokens = typeof options.countTokens === "function" ? options.countTokens : (text) => Math.ceil(String(text ?? "").length / 2);
    for (let candidateIndex = startCandidateIndex; candidateIndex < candidates.length; candidateIndex++) {
      const candidate = candidates[candidateIndex];
      if (state.budget.used >= state.budget.limit) break;
      if (!await candidateAvailable(candidate, runtime, batch)) continue;
      const candidatePolicy = documentPolicyForCandidate(runtime.policy, candidate);
      const repairIds = bestResult ? targetedRepairUnitIds(bestResult, batch) : [];
      const policyBatch = repairIds.length > 0 ? createRepairBatch(batch, repairIds, "policy") : batch;
      const policyViolations = batchPolicyViolations(policyBatch, candidatePolicy, countTokens);
      const splitDepthLimit = Math.min(runtime.policy.maxSplitDepth, candidatePolicy.maxSplitDepth);
      if (repairIds.length === 0 && policyViolations.length > 0 && batch.units.length > 1 && state.depth < splitDepthLimit) {
        const { left, right } = splitBatchWithContext(batch, { ...runtime, policy: candidatePolicy }, countTokens);
        await store.appendEvent?.(runtime.id, {
          type: candidate.role === "fallback" ? "fallback-batch-split" : "candidate-batch-split",
          batchId: batch.id,
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          role: candidate.role,
          depth: state.depth,
          violations: policyViolations,
          childBatchIds: [left.id, right.id],
        }).catch((error) => reportPersistenceError(runtime, error, "candidate-split-event"));
        const childState = { depth: state.depth + 1, budget: state.budget };
        const leftResult = await processBatch(left, runtime, childState, candidateIndex);
        const rightResult = await processBatch(right, runtime, childState, candidateIndex);
        const passed = leftResult.passed && rightResult.passed;
        if (passed) resolveBatchModelDiagnostics(runtime, batch.id);
        return {
          passed,
          section: [leftResult.section, rightResult.section].filter(Boolean).join("\n\n"),
          status: passed ? "completed" : "needs_review",
          sourceFallback: leftResult.sourceFallback === true || rightResult.sourceFallback === true,
          candidate: rightResult.candidate ?? leftResult.candidate,
          quality: { passed, split: true, policyDriven: true },
          review: null,
          attempts: [...attempts, ...(leftResult.attempts ?? []), ...(rightResult.attempts ?? [])],
          resolvedVisualUnitIds: [...new Set([...(leftResult.resolvedVisualUnitIds ?? []), ...(rightResult.resolvedVisualUnitIds ?? [])])],
        };
      }
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
      const result = await tryCandidate(candidate, batch, runtime, state.budget, candidatePolicy, bestResult);
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
        disabledForJob: candidateDisabled(runtime, candidate),
        policy: {
          batchInputTokens: candidatePolicy.batchInputTokens,
          batchOutputTokens: candidatePolicy.batchOutputTokens,
          maxUnitsPerBatch: candidatePolicy.maxUnitsPerBatch,
          requestTimeoutMs: candidatePolicy.requestTimeoutMs,
        },
        at: new Date().toISOString(),
      });
      if (result.passed) {
        resolveBatchModelDiagnostics(runtime, batch.id);
        return { ...result, status: "completed", attempts };
      }
      const onlyUnresolvedVisuals = (result.quality?.failures ?? []).length > 0
        && result.quality.failures.every((failure) => failure.type === "visual-pending");
      if (result.section && (result.quality?.passed || onlyUnresolvedVisuals)) bestResult = result;
      if (canSplitResult(result)) splitEligible = true;
    }

    if (!bestResult && splitEligible && batch.units.length > 1 && state.depth < runtime.policy.maxSplitDepth && state.budget.used < state.budget.limit) {
      const { left, right } = splitBatchWithContext(batch, runtime, countTokens);
      const childState = { depth: state.depth + 1, budget: state.budget };
      const leftResult = await processBatch(left, runtime, childState);
      const rightResult = await processBatch(right, runtime, childState);
      const passed = leftResult.passed && rightResult.passed;
      if (passed) resolveBatchModelDiagnostics(runtime, batch.id);
      return {
        passed,
        section: [leftResult.section, rightResult.section].filter(Boolean).join("\n\n"),
        status: passed ? "completed" : "needs_review",
        sourceFallback: leftResult.sourceFallback === true || rightResult.sourceFallback === true,
        candidate: rightResult.candidate ?? leftResult.candidate,
        quality: { passed, split: true },
        review: null,
        attempts: [...attempts, ...(leftResult.attempts ?? []), ...(rightResult.attempts ?? [])],
        resolvedVisualUnitIds: [...new Set([...(leftResult.resolvedVisualUnitIds ?? []), ...(rightResult.resolvedVisualUnitIds ?? [])])],
      };
    }

    if (bestResult) {
      return {
        ...bestResult,
        passed: false,
        status: "needs_review",
        sourceFallback: false,
        attempts,
      };
    }

    return {
      passed: false,
      section: renderDocumentSourceFallback(batch.units, "模型整理和备用模型修复均未通过质量检查"),
      status: "needs_review",
      sourceFallback: true,
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
        const candidatePolicy = documentPolicyForCandidate(runtime.policy, candidate);
        const modelCall = reserveTaskModelCall(runtime, {
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          role: candidate.role,
          purpose: "toolContinuation",
          stage: "summary",
          batchLabel: title,
        });
        await updateProgress(runtime, { stage: "summary", currentBatch: null, currentLabel: title, generatedChars: 0, elapsedMs: 0 }, {
          currentModel: `${candidate.providerId}/${candidate.modelId}`,
          currentModelRole: candidate.role || "primary",
        });
        return cleanMarkdown(await runTrackedModelCall(runtime, modelCall, () => options.generateSummary?.({
          title,
          sectionSummaries: notes,
          contract: runtime.contract,
          candidate,
          requestTimeoutMs: candidatePolicy.requestTimeoutMs,
          onProgress: (progress) => {
            if (progress?.finishReason) modelCall.finishReason = progress.finishReason;
            queueProgress(runtime, {
            stage: "summary",
            currentBatch: null,
            currentLabel: title,
            generatedChars: Number(progress?.generatedChars) || 0,
            elapsedMs: Number(progress?.elapsedMs) || 0,
          }, {}, "summary-progress"); },
          signal: runtime.controller.signal,
        })));
      } catch (error) {
        if (runtime.controller.signal.aborted || error?.name === "AbortError") throw error;
        if (isNonRetryableDocumentModelError(error)) disableCandidate(runtime, candidate);
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
      runtime.modelDiagnostics ??= new Map();
      runtime.disabledCandidates ??= new Set();
      runtime.disabledCandidateDetails ??= new Map();
      runtime.candidateAvailability ??= new Map();
      await emit(runtime.id, {
        status: "running",
        running: true,
        paused: false,
        error: null,
        modelDiagnostics: persistedModelDiagnostics(runtime),
        disabledCandidates: persistedDisabledCandidates(runtime),
        disabledCandidateDetails: persistedDisabledCandidateDetails(runtime),
        executionEpoch: runtime.executionEpoch ?? null,
      });
      await store.appendEvent?.(runtime.id, {
        type: "execution-started",
        retryFailed: runtime.retryFailed === true,
        epochId: runtime.executionEpoch?.id ?? null,
        sourcePlanHash: runtime.executionEpoch?.sourcePlanHash ?? null,
      })
        .catch((error) => reportPersistenceError(runtime, error, "execution-event"));
      const prepareInput = Array.isArray(runtime.input.sourcePaths) && runtime.input.sourcePaths.length > 0
        ? runtime.input.sourcePaths
        : runtime.input.sourcePath;
      prepared = await options.prepareDocument(prepareInput, runtime.controller.signal);
      if (!prepared?.ok) throw new Error(prepared?.error || "document preparation failed");
      const sourceFingerprint = await options.fingerprintSource?.(prepared, runtime.controller.signal);
      const previous = await store.read(runtime.id);
      if (previous.sourceFingerprint && sourceFingerprint && !sourceFingerprintsMatch(previous.sourceFingerprint, sourceFingerprint)) {
        await store.appendEvent?.(runtime.id, {
          type: "source-changed",
          previous: previous.sourceFingerprint,
          current: sourceFingerprint,
        }).catch((error) => reportPersistenceError(runtime, error, "source-change-event"));
        await emit(runtime.id, {
          status: "source_changed",
          running: false,
          paused: true,
          error: "source changed while the task was waiting to resume; choose whether to restart with the new version",
          sourceFingerprint,
          progress: { stage: "source-changed", currentBatch: null, currentLabel: null, lastHeartbeatAt: new Date().toISOString() },
        });
        return;
      }
      const effectiveSourceFingerprint = sourceFingerprint ?? previous.sourceFingerprint ?? null;
      const priorSourcePlan = previous.sourcePlan?.schemaVersion === 1 ? previous.sourcePlan : null;
      const sourcePlanBatches = new Map((priorSourcePlan?.batches ?? []).map((batch) => [batch.id, batch]));
      runtime.sourcePlan = {
        schemaVersion: 1,
        status: "planning",
        sourceFingerprint: effectiveSourceFingerprint,
        planningPolicy: sourcePlanPolicy(runtime.policy),
        batches: [...sourcePlanBatches.values()],
        totalUnits: priorSourcePlan?.totalUnits ?? null,
        totalBatches: priorSourcePlan?.totalBatches ?? null,
        planHash: priorSourcePlan?.planHash ?? null,
        createdAt: priorSourcePlan?.createdAt ?? new Date().toISOString(),
        completedAt: null,
      };
      await emit(runtime.id, {
        sourcePath: prepared.sourcePath || runtime.input.sourcePath,
        sourcePaths: Array.isArray(prepared.sources) && prepared.sources.length > 0
          ? prepared.sources.map((source) => source.sourcePath || source.readablePath).filter(Boolean)
          : runtime.input.sourcePaths,
        readablePath: prepared.readablePath || prepared.sourcePath || runtime.input.sourcePath,
        sourceKind: prepared.documentKind || runtime.contract.format,
        sourceCount: Array.isArray(prepared.sources) && prepared.sources.length > 0 ? prepared.sources.length : 1,
        sourceFingerprint: effectiveSourceFingerprint,
        sourcePlan: runtime.sourcePlan,
      });
      const priorBatches = new Map((previous.batches ?? []).map((batch) => [batch.id, batch]));
      const activeBatchIds = new Set();
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
          runtime.sourcePlan = {
            ...runtime.sourcePlan,
            status: "planning",
            totalUnits: Number(plan.totalUnits) || runtime.sourcePlan.totalUnits || null,
            totalBatches: Number(plan.totalBatches) || runtime.sourcePlan.totalBatches || null,
            batches: [...sourcePlanBatches.values()].sort((left, right) => left.index - right.index),
          };
          await queueEmit(runtime, { sourcePlan: runtime.sourcePlan });
          await updateProgress(runtime, {
          totalUnits: Number(plan.totalUnits) || null,
          totalBatches: Number(plan.totalBatches) || null,
            totalSources: Number(plan.totalSources) || null,
            completedSources: Number(plan.completedSources) || 0,
            currentSource: plan.currentSource || null,
            unitLabel: plan.unitLabel || (prepared.documentKind === "pdf" ? "页" : "区块"),
            stage: "extracting",
            currentBatch: null,
            currentLabel: null,
          });
        },
        onBatch: async (value) => {
          await waitForTurn(runtime);
          const batch = normalizeBatch(value, batchIndex++);
          activeBatchIds.add(batch.id);
          sourcePlanBatches.set(batch.id, sourcePlanBatch(batch));
          runtime.sourcePlan = {
            ...runtime.sourcePlan,
            batches: [...sourcePlanBatches.values()].sort((left, right) => left.index - right.index),
          };
          await queueEmit(runtime, { sourcePlan: runtime.sourcePlan });
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
            resolvedVisualUnitIds: result.resolvedVisualUnitIds ?? [],
            attempts: result.attempts,
            sourceFallback: result.sourceFallback === true,
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
      let current = await store.read(runtime.id);
      const staleBatches = current.batches.filter((batch) => !activeBatchIds.has(batch.id));
      if (staleBatches.length > 0) {
        const batches = current.batches.filter((batch) => activeBatchIds.has(batch.id));
        await emit(runtime.id, {
          batches,
          modelHistory: batches.flatMap((batch) => batch.attempts ?? []),
        });
        await store.appendEvent?.(runtime.id, {
          type: "stale-batches-pruned",
          count: staleBatches.length,
          batchIds: staleBatches.map((batch) => batch.id),
        }).catch((error) => reportPersistenceError(runtime, error, "stale-batches-event"));
        current = await store.read(runtime.id);
      }
      const finalizedPlan = {
        ...runtime.sourcePlan,
        status: "completed",
        batches: [...sourcePlanBatches.values()]
          .filter((batch) => activeBatchIds.has(batch.id))
          .sort((left, right) => left.index - right.index),
        totalUnits: Number(sourceSummary?.totalUnits) || runtime.sourcePlan?.totalUnits || null,
        totalBatches: Number(sourceSummary?.batches) || runtime.sourcePlan?.totalBatches || activeBatchIds.size,
        completedAt: new Date().toISOString(),
      };
      finalizedPlan.planHash = hashSourcePlan(finalizedPlan);
      runtime.sourcePlan = finalizedPlan;
      runtime.executionEpoch = {
        ...(runtime.executionEpoch ?? {}),
        sourcePlanHash: finalizedPlan.planHash,
      };
      await queueEmit(runtime, { sourcePlan: finalizedPlan, executionEpoch: runtime.executionEpoch });
      await store.appendEvent?.(runtime.id, {
        type: "source-plan-finalized",
        planHash: finalizedPlan.planHash,
        totalUnits: finalizedPlan.totalUnits,
        totalBatches: finalizedPlan.totalBatches,
        epochId: runtime.executionEpoch?.id ?? null,
      }).catch((error) => reportPersistenceError(runtime, error, "source-plan-event"));
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
      if (!assemblyAudit.passed) degraded = true;

      let summary = "";
      if (runtime.contract.fidelity === "complete-with-summary") {
        try {
          summary = await generateHierarchicalSummary(titleForDocument(prepared, runtime.contract), sectionSummaries, runtime);
        } catch { /* A missing summary must not discard the verified body. */ }
        if (!/^##\s+摘要/m.test(summary)) summary = `## 摘要\n\n文档正文已按 ${totalUnits} 个来源区块完成整理。${degraded ? "部分区块未通过完整质量审查，需要复核。" : "详细内容见下文。"}`;
      }
      const title = titleForDocument(prepared, runtime.contract);
      const sourceList = renderCollectionSources(prepared, sourceSummary);
      const content = [`# ${title}`, summary, sourceList, "## 详细正文", detailedBody].filter(Boolean).join("\n\n");
      const finalFingerprint = await options.fingerprintSource?.(prepared, runtime.controller.signal);
      const storedFingerprint = (await store.read(runtime.id)).sourceFingerprint;
      if (storedFingerprint && finalFingerprint && !sourceFingerprintsMatch(storedFingerprint, finalFingerprint)) {
        await store.appendEvent?.(runtime.id, {
          type: "source-changed",
          previous: storedFingerprint,
          current: finalFingerprint,
          stage: "before-output",
        }).catch((error) => reportPersistenceError(runtime, error, "source-change-event"));
        await emit(runtime.id, {
          status: "source_changed",
          running: false,
          paused: true,
          error: "source changed before final output; the draft is preserved for review",
          sourceFingerprint: finalFingerprint,
          progress: { stage: "source-changed", currentBatch: null, currentLabel: null, lastHeartbeatAt: new Date().toISOString() },
        });
        return;
      }
      await options.writeOutput({
        outputPath: runtime.input.outputPath,
        content,
        signal: runtime.controller.signal,
        workspaceRoot: runtime.input.workspaceRoot,
        allowOutsideWorkspace: runtime.input.allowOutsideWorkspace === true,
        allowOutputOverwrite: runtime.input.allowOutputOverwrite === true || Boolean((await store.read(runtime.id)).outputCommittedAt),
      });
      const outputCommittedAt = new Date().toISOString();
      await (runtime.emitQueue ?? Promise.resolve()).catch(() => {});
      const finalState = await store.read(runtime.id);
      const warnings = buildDocumentQualityWarnings({
        batches: finalState.batches,
        diagnostics: finalState.modelDiagnostics,
        assemblyAudit,
      });
      await emit(runtime.id, {
        status: degraded ? "completed_with_warnings" : "completed",
        running: false,
        paused: false,
        qualityPassed: !degraded,
        sourceAudit: {
          totalUnits,
          sourceCount: Array.isArray(sourceSummary?.sourceSummaries) ? sourceSummary.sourceSummaries.length : 1,
          sources: Array.isArray(sourceSummary?.sourceSummaries) ? sourceSummary.sourceSummaries : [],
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
          totalSources: Array.isArray(sourceSummary?.sourceSummaries) ? sourceSummary.sourceSummaries.length : 1,
          completedSources: Array.isArray(sourceSummary?.sourceSummaries) ? sourceSummary.sourceSummaries.length : 1,
          currentSource: null,
          generatedChars: content.length,
          elapsedMs: 0,
          lastHeartbeatAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      const cancelled = runtime.controller.signal.aborted || error?.name === "AbortError";
      const terminalAction = runtime.stopAction === "abandon" ? "abandon" : "stop";
      const terminalStatus = cancelled ? (terminalAction === "abandon" ? "abandoned" : "stopped") : "failed";
      await (runtime.emitQueue ?? Promise.resolve()).catch(() => {});
      try {
        await emit(runtime.id, {
          status: terminalStatus,
          running: false,
          paused: terminalStatus === "stopped",
          qualityPassed: false,
          error: cancelled ? (terminalAction === "abandon" ? "abandoned by user" : null) : String(error?.message || error),
          completedAt: terminalAction === "abandon" || !cancelled ? new Date().toISOString() : null,
          stoppedAt: cancelled ? new Date().toISOString() : null,
          currentModel: null,
          currentModelRole: null,
          progress: {
            stage: terminalStatus,
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
          const abandoned = runtime.stopAction === "abandon";
          let stopped;
          try {
            stopped = await emit(runtime.id, {
              status: abandoned ? "abandoned" : "stopped",
              running: false,
              paused: !abandoned,
              qualityPassed: false,
              error: abandoned ? "abandoned by user" : null,
              completedAt: abandoned ? new Date().toISOString() : null,
              stoppedAt: new Date().toISOString(),
              progress: { stage: abandoned ? "abandoned" : "stopped", currentBatch: null, currentLabel: null, lastHeartbeatAt: new Date().toISOString() },
            });
          } catch (error) {
            reportPersistenceError(runtime, error, "queued-stop");
            stopped = { id: runtime.id, status: abandoned ? "abandoned" : "stopped", running: false, paused: !abandoned };
          }
          runtime.resolve?.(stopped);
          runtimes.delete(runtime.id);
          completions.delete(runtime.id);
          options.onIdle?.(runtime.id);
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
          options.onIdle?.(runtime.id);
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
      sourcePaths: input.sourcePaths,
      taskType: input.taskType,
      taskFingerprint: input.taskFingerprint,
      outputPath: input.outputPath,
      pages: input.pages,
      fidelity: input.fidelity,
      summaryOnlyConfirmed: input.summaryOnlyConfirmed,
      overwriteConfirmed: input.overwriteConfirmed,
      instructions: input.instructions,
      title: input.title,
    });
    if (contract.requiresDecision) return { ok: false, requiresUserChoice: true, decision: contract.decision };
    const candidates = options.modelCandidates?.(requestedPolicy) ?? [];
    if (candidates.length === 0) throw new Error("no document model is configured");
    const policy = effectiveDocumentPolicy(requestedPolicy, candidates);
    const policyTrace = documentPolicyTrace(requestedPolicy, policy, candidates);
    if (input.taskFingerprint && typeof store.list === "function") {
      const duplicate = (await store.list()).find((job) => job.taskFingerprint === input.taskFingerprint);
      if (duplicate) {
        if (["completed", "completed_with_warnings"].includes(duplicate.status)) {
          return {
            ok: true,
            accepted: false,
            reused: true,
            completed: true,
            id: duplicate.id,
            status: duplicate.status,
            outputPath: duplicate.outputPath,
            contract: duplicate.contract ?? contract,
          };
        }
        if (["queued", "running", "waiting_foreground", "waiting_provider", "pausing"].includes(duplicate.status)) {
          return { ok: true, accepted: true, background: true, reused: true, id: duplicate.id, outputPath: duplicate.outputPath, contract: duplicate.contract ?? contract };
        }
        if (["paused", "interrupted", "stopped", "failed"].includes(duplicate.status)) {
          await resume(duplicate.id, { retryFailed: duplicate.status === "failed" });
          return { ok: true, accepted: true, background: true, reused: true, resumed: true, id: duplicate.id, outputPath: duplicate.outputPath, contract: duplicate.contract ?? contract };
        }
      }
    }
    const job = await store.create({
      sourcePath: input.sourcePath,
      sourcePaths: input.sourcePaths,
      sourceName: input.sourceName,
      outputPath: input.outputPath,
      taskType: input.taskType,
      taskFingerprint: input.taskFingerprint,
      pages: input.pages,
      workspaceRoot: input.workspaceRoot,
      allowOutsideWorkspace: input.allowOutsideWorkspace,
      allowOutputOverwrite: input.allowOutputOverwrite,
      contract,
      policy,
      policyTrace,
    });
    const executionEpoch = executionEpochSnapshot(job.id, 1, "start", candidates, null, 0);
    await store.update(job.id, { executionEpoch });
    await store.appendEvent?.(job.id, { type: "policy-selected", ...policyTrace }).catch(() => {});
    await store.appendEvent?.(job.id, { type: "execution-epoch-started", epochId: executionEpoch.id, sequence: executionEpoch.sequence, reason: executionEpoch.reason }).catch(() => {});
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
      sourcePlan: null,
      executionEpoch,
      modelCallCount: 0,
      modelDiagnostics: new Map(),
      controller: new AbortController(),
      disabledCandidates: new Set(),
      disabledCandidateDetails: new Map(),
      candidateAvailability: new Map(),
      emitQueue: Promise.resolve(),
      paused: false,
      stopAction: null,
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
    const policy = storedPolicy;
    const policyTrace = documentPolicyTrace(storedPolicy, policy, candidates);
    const executionEpoch = executionEpochSnapshot(
      id,
      (Number(job.executionEpoch?.sequence) || 0) + 1,
      "resume",
      candidates,
      job.sourcePlan?.planHash ?? null,
      job.modelCallCount,
    );
    await store.update(id, { executionEpoch });
    let resolveCompletion;
    const completion = new Promise((resolve) => { resolveCompletion = resolve; });
    completions.set(id, completion);
    const runtime = {
      id,
      input: {
        sourcePath: job.sourcePath,
        sourcePaths: job.sourcePaths,
        outputPath: job.outputPath,
        taskType: job.taskType,
        taskFingerprint: job.taskFingerprint,
        pages: job.pages,
        workspaceRoot: job.workspaceRoot || dirname(job.outputPath),
        allowOutsideWorkspace: job.allowOutsideWorkspace === true,
        allowOutputOverwrite: job.allowOutputOverwrite === true,
      },
      policy,
      contract: job.contract ?? buildDocumentContract({ sourcePath: job.sourcePath, outputPath: job.outputPath }),
      candidates,
      sourcePlan: job.sourcePlan ?? null,
      executionEpoch,
      modelCallCount: Number(job.modelCallCount) || (job.batches ?? []).reduce((sum, batch) => sum + (Number(batch.modelCalls) || 0), 0),
      modelDiagnostics: modelDiagnosticMap(job.modelDiagnostics),
      controller: new AbortController(),
      disabledCandidates: disabledCandidateSet(job.disabledCandidates),
      disabledCandidateDetails: disabledCandidateDetailMap(job.disabledCandidateDetails),
      candidateAvailability: new Map(),
      emitQueue: Promise.resolve(),
      paused: false,
      stopAction: null,
      retryFailed,
      executing: false,
      resolve: resolveCompletion,
    };
    try {
      await emit(id, { status: "queued", running: false, paused: false, error: null, policy, policyTrace, executionEpoch });
      await store.appendEvent?.(id, { type: "resume-requested", retryFailed, epochId: executionEpoch.id, sourcePlanHash: executionEpoch.sourcePlanHash, ...policyTrace }).catch(() => {});
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
      if (runtime.stopAction) return { ok: false, error: "document job is stopping; wait for the current action to finish" };
      runtime.paused = true;
      await emit(id, { status: "pausing", paused: true });
      return { ok: true, paused: true, id };
    }
    if (action === "resume") return resume(id);
    if (action === "retry") return resume(id, { retryFailed: true });
    if (action === "cancel" || action === "stop" || action === "abandon") {
      const abandon = action === "abandon";
      if (runtime) {
        runtime.stopAction = abandon ? "abandon" : "stop";
        runtime.controller.abort();
        if (!runtime.executing) {
          const queueIndex = queue.indexOf(runtime);
          if (queueIndex >= 0) queue.splice(queueIndex, 1);
          const stopped = await emit(id, {
            status: abandon ? "abandoned" : "stopped",
            running: false,
            paused: !abandon,
            qualityPassed: false,
            error: abandon ? "abandoned by user" : null,
            completedAt: abandon ? new Date().toISOString() : null,
            stoppedAt: new Date().toISOString(),
            progress: { stage: abandon ? "abandoned" : "stopped", currentBatch: null, currentLabel: null, lastHeartbeatAt: new Date().toISOString() },
          });
          runtime.resolve?.(stopped);
          runtimes.delete(id);
          completions.delete(id);
          options.onIdle?.(id);
        }
      } else {
        const job = await store.read(id);
        const stoppable = ["queued", "paused", "interrupted", "stopped", "source_changed"].includes(job.status);
        const abandonable = stoppable || job.status === "failed";
        if (abandon ? abandonable : stoppable) {
          await emit(id, {
            status: abandon ? "abandoned" : "stopped",
            running: false,
            paused: !abandon,
            qualityPassed: false,
            error: abandon ? "abandoned by user" : null,
            completedAt: abandon ? new Date().toISOString() : null,
            stoppedAt: new Date().toISOString(),
            progress: { stage: abandon ? "abandoned" : "stopped", currentBatch: null, currentLabel: null, lastHeartbeatAt: new Date().toISOString() },
          });
        } else {
          return { ok: false, error: "document job is not in a stoppable state" };
        }
      }
      return { ok: true, stopped: true, abandoned: abandon, id };
    }
    if (action === "delete") {
      if (runtime || ["running", "queued", "waiting_foreground", "waiting_provider", "pausing"].includes((await store.read(id)).status)) {
        return { ok: false, error: "请先立即停止或放弃任务，再删除任务记录" };
      }
      const job = await store.read(id);
      await store.remove(id);
      options.onDelete?.(publicBackgroundJob(job), job);
      return { ok: true, deleted: true, id, outputPath: job.outputPath ?? null };
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
        const title = titleForJob(job);
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

  return {
    activeCount: () => [...runtimes.values()].filter((runtime) => !runtime.paused && !runtime.controller.signal.aborted).length,
    control,
    getMetadata,
    isProviderBusy: () => [...runtimes.values()].some((runtime) => runtime.executing && !runtime.paused && !runtime.controller.signal.aborted),
    listMetadata,
    resume,
    start,
    wait,
  };
}
