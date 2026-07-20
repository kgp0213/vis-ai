import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

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
import { longTaskNeedsAttention, longTaskTerminalKey } from "./long-task-handoff.mjs";

const WAITING_MANIFEST_HEARTBEAT_MS = 5_000;
const DOCUMENT_JOB_CALL_BUDGET_CODE = "DOCUMENT_JOB_CALL_BUDGET_EXCEEDED";
const DOCUMENT_JOB_TIMEOUT_CODE = "DOCUMENT_JOB_TIMEOUT";

function documentJobBudgetError(kind, policy = {}) {
  const minutes = Math.max(1, Math.round((Number(policy.jobTimeoutMs) || 0) / 60_000));
  const error = new Error(kind === "timeout"
    ? `文档任务达到本次执行的总时限（${minutes} 分钟），已保留已完成区块；请检查模型状态或缩小文档后点击“继续”。`
    : `文档任务达到本次执行的总模型调用上限（${Number(policy.maxModelCallsPerJob) || 0} 次），已保留已完成区块；可点击“继续”开启新的执行窗口，或缩小文档后重试。`);
  error.name = kind === "timeout" ? "DocumentJobTimeoutError" : "DocumentJobCallBudgetError";
  error.code = kind === "timeout" ? DOCUMENT_JOB_TIMEOUT_CODE : DOCUMENT_JOB_CALL_BUDGET_CODE;
  error.category = kind === "timeout" ? "job_timeout" : "job_call_budget";
  return error;
}

function abortError(message = "document task cancelled") {
  return new DOMException(message, "AbortError");
}

async function inspectDocumentOutput(job, { verifyHash = false } = {}) {
  const rawPath = String(job?.outputPath ?? "").trim();
  if (!rawPath) return { status: "unknown", path: null, verified: false };
  const outputPath = resolve(String(job?.workspaceRoot || dirname(rawPath)), rawPath);
  let fileStat;
  try {
    fileStat = await stat(outputPath);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return { status: "missing", path: outputPath, verified: false };
    }
    return { status: "unavailable", path: outputPath, verified: false, error: error?.message || String(error) };
  }
  if (!fileStat.isFile()) return { status: "unavailable", path: outputPath, verified: false, error: "output path is not a file" };
  const signature = job?.outputSignature;
  if (!verifyHash && Number.isFinite(Number(signature?.size)) && Number.isFinite(Number(signature?.mtimeMs))) {
    const unchanged = fileStat.size === Number(signature.size) && fileStat.mtimeMs === Number(signature.mtimeMs);
    return {
      status: unchanged ? "verified" : "modified",
      path: outputPath,
      verified: unchanged,
      verification: "stat-signature",
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
    };
  }
  if (!verifyHash || !job?.finalDraft?.sha256) {
    return { status: "present", path: outputPath, verified: false, size: fileStat.size, mtimeMs: fileStat.mtimeMs };
  }
  try {
    const content = await readFile(outputPath);
    const sha256 = createHash("sha256").update(content).digest("hex");
    return {
      status: sha256 === job.finalDraft.sha256 ? "verified" : "modified",
      path: outputPath,
      verified: sha256 === job.finalDraft.sha256,
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      sha256,
    };
  } catch (error) {
    return { status: "unavailable", path: outputPath, verified: false, error: error?.message || String(error) };
  }
}

async function captureDocumentOutputSignature(job) {
  const rawPath = String(job?.outputPath ?? "").trim();
  if (!rawPath) return null;
  const outputPath = resolve(String(job?.workspaceRoot || dirname(rawPath)), rawPath);
  try {
    const fileStat = await stat(outputPath);
    if (!fileStat.isFile()) return null;
    return { size: fileStat.size, mtimeMs: fileStat.mtimeMs, capturedAt: new Date().toISOString() };
  } catch (error) {
    // Test and compatibility writers may acknowledge the write without
    // exposing a filesystem path. The durable output contract is still
    // authoritative; absence of a signature only disables the cheap list
    // check and is verified when the detail view is opened.
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

async function attachDocumentOutputState(metadata, job, { verifyHash = false } = {}) {
  if (!(["completed", "completed_with_warnings"].includes(job?.status) || job?.outputCommittedAt)) return metadata;
  const outputArtifact = await inspectDocumentOutput(job, { verifyHash });
  metadata.outputArtifact = outputArtifact;
  metadata.artifactStatus = outputArtifact.status;
  if (!["missing", "modified", "unavailable"].includes(outputArtifact.status)) return metadata;
  const message = outputArtifact.status === "missing"
    ? "任务曾完成交付，但最终输出文件已不存在；可以从后台保存的最终草稿恢复。"
    : outputArtifact.status === "modified"
      ? "最终输出文件在任务完成后被修改，当前内容与后台保存的最终草稿不一致。"
      : `最终输出文件暂时无法核验：${outputArtifact.error || "文件不可访问"}`;
  metadata.needsAttention = true;
  metadata.warnings = [
    ...(Array.isArray(metadata.warnings) ? metadata.warnings : []),
    { type: `document-output-${outputArtifact.status}`, message },
  ];
  return metadata;
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

export function normalizeDocumentWorkflowReview(review) {
  const issues = Array.isArray(review?.issues) ? review.issues : [];
  return {
    ...review,
    pass: review?.pass === true && issues.length === 0,
    issues,
    advisoryIssues: [],
  };
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
    "maxModelCallsPerJob",
    "maxVisualUnitsPerBatch",
    "requestTimeoutMs",
    "jobTimeoutMs",
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
      maxModelCallsPerJob: effective.maxModelCallsPerJob,
      jobTimeoutMs: effective.jobTimeoutMs,
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
        maxModelCallsPerJob: candidate.documentPolicy.maxModelCallsPerJob ?? null,
        jobTimeoutMs: candidate.documentPolicy.jobTimeoutMs ?? null,
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

function targetedRepairRequiresVision(result, batch) {
  const targets = targetedRepairUnitIds(result, batch);
  if (targets.length === 0) return false;
  const visual = new Set((result?.quality?.failures ?? [])
    .filter((failure) => failure?.type === "visual-pending")
    .flatMap((failure) => failure.unitIds ?? []).map(String));
  return visual.size > 0 && targets.every((id) => visual.has(String(id)));
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

function partitionRepairUnitIds(batch, unitIds, policy, countTokens) {
  const groups = [];
  let current = [];
  for (const id of unitIds) {
    const candidate = [...current, id];
    const candidateBatch = createRepairBatch(batch, candidate, "partition");
    if (current.length > 0 && batchPolicyViolations(candidateBatch, policy, countTokens).length > 0) {
      groups.push(current);
      current = [id];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
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
  const persistedHandoff = job?.handoff && typeof job.handoff === "object"
    ? {
        state: job.handoff.state ?? null,
        terminalStatus: job.handoff.terminalStatus ?? null,
        attemptId: job.handoff.attemptId ?? null,
        attempts: Number(job.handoff.attempts) || 0,
        queuedAt: job.handoff.queuedAt ?? null,
        startedAt: job.handoff.startedAt ?? null,
        deliveredAt: job.handoff.deliveredAt ?? null,
        failedAt: job.handoff.failedAt ?? null,
        lastError: job.handoff.lastError ?? null,
      }
    : null;
  const handoff = persistedHandoff ?? (
    longTaskTerminalKey(job) && !job?.origin?.conversationId
      ? {
          state: "legacy_unassigned",
          terminalStatus: job.status ?? null,
          attempts: 0,
          lastError: "这是旧版本创建的任务，无法安全关联到原会话；请在后台面板中手动点击“继续”或“重试”。",
        }
      : null
  );
  return {
    id: `document:${job.id}`,
    documentJobId: job.id,
    command: `整理 ${job.sourceName || titleForJob(job)}`,
    running: job.running === true,
    paused: job.paused === true,
    lifecycle: "task",
    kind: "document",
    status: job.status,
    needsAttention: longTaskNeedsAttention(job),
    handoff,
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
      executionModelCalls: Number(progress.executionModelCalls) || 0,
      taskModelCallLimit: Number(job?.policy?.maxModelCallsPerJob) || null,
      executionDeadlineAt: job?.executionDeadlineAt || null,
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
    finalDraft: job.finalDraft ? {
      chars: Number(job.finalDraft.chars) || 0,
      sha256: job.finalDraft.sha256 ?? null,
      writtenAt: job.finalDraft.writtenAt ?? null,
      terminalStatus: job.finalDraft.terminalStatus ?? null,
    } : null,
    contract: job.contract ?? null,
    sourceAudit: job.sourceAudit ?? null,
    modelHistory: Array.isArray(job.modelHistory) ? job.modelHistory : [],
    policyTrace: job.policyTrace ?? null,
    policy: job.policy ? {
      batchInputTokens: job.policy.batchInputTokens,
      maxUnitsPerBatch: job.policy.maxUnitsPerBatch,
      maxVisualUnitsPerBatch: job.policy.maxVisualUnitsPerBatch,
      maxModelCallsPerJob: job.policy.maxModelCallsPerJob,
      jobTimeoutMs: job.policy.jobTimeoutMs,
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
  // A resume request can arrive from both the background workbench and the
  // automatic handoff at nearly the same time.  Keep one in-flight promise per
  // job so those callers share the same execution (and, for a saved draft,
  // the same output commit) instead of starting duplicate work.
  const resumeFlights = new Map();
  // A task fingerprint is the semantic identity of a document job. Serialize
  // starts for that identity so later callers reach the normal duplicate path
  // after the first job is durable (and can still register as subscribers).
  const startFlights = new Map();
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

  function assertExecutionAvailable(runtime) {
    if (runtime.budgetError) throw runtime.budgetError;
    if (runtime.controller.signal.aborted) throw abortError();
    if (runtime.deadlineAt && Date.now() >= runtime.deadlineAt) {
      runtime.budgetError = documentJobBudgetError("timeout", runtime.policy);
      runtime.deadlineReached = true;
      throw runtime.budgetError;
    }
  }

  function queueEmit(runtime, changes) {
    runtime.emitQueue = (runtime.emitQueue ?? Promise.resolve())
      .catch(() => {})
      .then(() => emit(runtime.id, changes));
    return runtime.emitQueue;
  }

  async function refreshRuntimeTaskFingerprint(runtime, prepared, sourceFingerprint, previousJob, reason) {
    if (typeof options.refreshTaskFingerprint !== "function" || !sourceFingerprint) return previousJob?.taskFingerprint ?? runtime.input.taskFingerprint ?? null;
    let next;
    try {
      next = String(await options.refreshTaskFingerprint({
        input: runtime.input,
        contract: runtime.contract,
        prepared,
        sourceFingerprint,
        previousJob,
      }) ?? "").trim();
    } catch (error) {
      reportPersistenceError(runtime, error, "task-fingerprint-refresh");
      return previousJob?.taskFingerprint ?? runtime.input.taskFingerprint ?? null;
    }
    if (!next || next === String(previousJob?.taskFingerprint ?? runtime.input.taskFingerprint ?? "")) return next || previousJob?.taskFingerprint || null;
    runtime.input.taskFingerprint = next;
    await queueEmit(runtime, { taskFingerprint: next });
    await store.appendEvent?.(runtime.id, {
      type: "task-fingerprint-refreshed",
      previous: previousJob?.taskFingerprint ?? null,
      current: next,
      reason: String(reason || "source-refresh"),
    }).catch((error) => reportPersistenceError(runtime, error, "task-fingerprint-event"));
    return next;
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

  function enableCandidate(runtime, candidate, available = true) {
    const key = candidateCircuitKey(candidate);
    runtime.disabledCandidates?.delete(key);
    runtime.disabledCandidateDetails?.delete(key);
    runtime.candidateAvailability ??= new Map();
    if (available) runtime.candidateAvailability.set(key, true);
    else runtime.candidateAvailability.delete(key);
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
    assertExecutionAvailable(runtime);
    const limit = Math.max(4, Number(runtime.policy?.maxModelCallsPerJob) || 1_000);
    const executionCalls = Math.max(0, Number(runtime.executionModelCalls) || 0);
    if (executionCalls >= limit) {
      runtime.budgetError = documentJobBudgetError("calls", runtime.policy);
      throw runtime.budgetError;
    }
    runtime.modelCallCount = Math.max(0, Number(runtime.modelCallCount) || 0) + 1;
    runtime.executionModelCalls = executionCalls + 1;
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
      executionModelCalls: runtime.executionModelCalls,
    }, {
      modelCallCount: runtime.modelCallCount,
      executionModelCalls: runtime.executionModelCalls,
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
      executionModelCalls: runtime.executionModelCalls,
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
    let lastWaitingStatus = null;
    let lastWaitingPersistAt = 0;
    while (true) {
      assertExecutionAvailable(runtime);
      const paused = runtime.paused === true;
      const waitingForForeground = !paused && Boolean(options.isForegroundBusy?.());
      const waitingForProvider = !paused && !waitingForForeground && Boolean(options.isProviderBusy?.());
      if (!paused && !waitingForForeground && !waitingForProvider) break;
      const waitingStatus = paused ? "paused" : waitingForForeground ? "waiting_foreground" : "waiting_provider";
      const now = Date.now();
      if (waitingStatus !== lastWaitingStatus || now - lastWaitingPersistAt >= WAITING_MANIFEST_HEARTBEAT_MS) {
        await emit(runtime.id, {
          status: waitingStatus,
          running: !paused,
          paused,
          progress: {
            stage: paused ? "paused" : waitingForForeground ? "waiting-foreground" : "waiting-provider",
            lastHeartbeatAt: new Date(now).toISOString(),
          },
        });
        lastWaitingStatus = waitingStatus;
        lastWaitingPersistAt = now;
      }
      if ((waitingForForeground || waitingForProvider) && !announced) {
        announced = true;
        if (waitingForForeground) options.onWaitingForForeground?.(runtime.id);
        else options.onWaitingForProvider?.(runtime.id);
      }
      await delay(runtime.policy.foregroundPollMs, runtime.controller.signal);
    }
    if (announced) await emit(runtime.id, { status: "running", running: true, paused: false });
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
          maxTokens: candidatePolicy.batchOutputTokens,
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
        if (parsed) return { ...normalizeDocumentWorkflowReview(parsed), errors };
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

    const countTokens = typeof options.countTokens === "function" ? options.countTokens : (text) => Math.ceil(String(text ?? "").length / 2);
    const groups = partitionRepairUnitIds(batch, targetIds, candidatePolicy, countTokens);
    let section = canonicalRepairBase(batch, seedResult.section);
    const resolvedVisualUnitIds = new Set(seedResult.resolvedVisualUnitIds ?? []);
    const errors = [];
    const failureCategories = new Set();
    let attempts = 0;

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const repairIds = groups[groupIndex];
      const repairBatch = createRepairBatch(batch, repairIds, String(groupIndex + 1));
      const issueText = [
        ...(seedResult?.quality?.failures ?? []).map((failure) => `${failure.type}: ${JSON.stringify(failure)}`),
        ...(seedResult?.review?.issues ?? []).filter((issue) => repairIds.includes(issue.unitId)).map((issue) => `${issue.type} ${issue.unitId}: ${issue.detail}`),
      ].join("\n");
      const messages = buildDocumentSectionMessages({ batch: repairBatch, contract: runtime.contract, retry: true });
      const lastMessage = messages.at(-1);
      if (lastMessage && typeof lastMessage.content === "string") {
        lastMessage.content = `${lastMessage.content}\n\n<targeted_repair>\nRepair only these source-unit markers: ${repairIds.join(", ")}.\nDo not emit any other marker.\nKnown issues:\n${issueText}\n</targeted_repair>`;
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
        attempt: groupIndex + 1,
        maxAttempts: groups.length,
        generatedChars: 0,
        elapsedMs: 0,
        repairUnitIds: repairIds,
      });
      if (!modelCall) return null;
      attempts++;
      try {
        await store.appendEvent?.(runtime.id, {
          type: "unit-repair-started",
          batchId: batch.id,
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          unitIds: repairIds,
          group: groupIndex + 1,
          groups: groups.length,
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
              repairUnitIds: repairIds,
              attempt: groupIndex + 1,
              maxAttempts: groups.length,
              generatedChars: Number(progress?.generatedChars) || 0,
              elapsedMs: Number(progress?.elapsedMs) || 0,
              modelCalls: budget.used,
              modelCallLimit: budget.limit,
            }, {}, "unit-repair-progress");
          },
          retry: true,
          signal: runtime.controller.signal,
        })));
        const merged = mergeDocumentUnitSections({ markdown: section, patchMarkdown: patch, allowedUnitIds: repairIds });
        const replaced = new Set(merged.replacedUnitIds ?? []);
        if (!merged.ok || replaced.size !== repairIds.length || repairIds.some((id) => !replaced.has(id))) {
          await store.appendEvent?.(runtime.id, {
            type: "unit-repair-rejected",
            batchId: batch.id,
            providerId: candidate.providerId,
            modelId: candidate.modelId,
            unitIds: repairIds,
            replacedUnitIds: merged.replacedUnitIds ?? [],
            reason: "patch markers did not match the requested unit set",
          }).catch((error) => reportPersistenceError(runtime, error, "unit-repair-event"));
          errors.push("targeted repair returned an incomplete or unexpected marker set");
          break;
        }
        section = merged.markdown;
        for (const id of withVisuals.visualUnitIds) resolvedVisualUnitIds.add(id);
      } catch (error) {
        if (runtime.controller.signal.aborted || error?.name === "AbortError") throw error;
        if (isNonRetryableDocumentModelError(error)) disableCandidate(runtime, candidate);
        errors.push(String(error?.message || error).slice(0, 500));
        failureCategories.add(classifyDocumentModelError(error).category);
        break;
      }
    }

    const resolved = [...resolvedVisualUnitIds];
    const quality = evaluateDocumentQuality({ units: batch.units, markdown: section, fidelity: runtime.contract.fidelity, resolvedVisualUnitIds: resolved, qualityThresholds: candidatePolicy.qualityThresholds });
    if (!quality.passed || errors.length > 0) {
      await store.appendEvent?.(runtime.id, {
        type: "unit-repair-completed",
        batchId: batch.id,
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        unitIds: targetIds,
        passed: false,
        failures: quality.failures,
      }).catch((error) => reportPersistenceError(runtime, error, "unit-repair-event"));
      const repaired = { passed: false, section, quality, review: null, attempts, candidate, errors, failureCategories: [...failureCategories], resolvedVisualUnitIds: resolved };
      return strongerDocumentDraft(seedResult, repaired) === seedResult
        ? { ...seedResult, passed: false, attempts, errors: [...(seedResult.errors ?? []), ...errors], failureCategories: [...new Set([...(seedResult.failureCategories ?? []), ...failureCategories])] }
        : repaired;
    }

    const review = await requestReview(candidate, batch, section, runtime, budget, candidatePolicy);
    await store.appendEvent?.(runtime.id, {
      type: "unit-repair-completed",
      batchId: batch.id,
      providerId: candidate.providerId,
      modelId: candidate.modelId,
      unitIds: targetIds,
      passed: review.pass === true,
    }).catch((error) => reportPersistenceError(runtime, error, "unit-repair-event"));
    const repaired = {
      passed: review.pass === true,
      section,
      quality,
      review,
      attempts,
      candidate,
      errors: review.errors ?? [],
      failureCategories: [...failureCategories],
      resolvedVisualUnitIds: resolved,
    };
    const preferred = strongerDocumentDraft(seedResult, repaired);
    if (preferred === seedResult && review.pass !== true) {
      return {
        ...seedResult,
        passed: false,
        attempts,
        errors: [...(seedResult.errors ?? []), ...(review.errors ?? [])],
        failureCategories: [...new Set([...(seedResult.failureCategories ?? []), ...failureCategories])],
      };
    }
    return repaired;
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
        qualityThresholds: candidatePolicy.qualityThresholds,
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
    if (runtime.transientBlockedCandidates?.has(key)) return false;
    const verificationStatus = String(candidate?.verificationStatus ?? "").toLowerCase();
    if (candidateDisabled(runtime, candidate)) {
      const disabledOrigin = runtime.disabledCandidateDetails?.get(key)?.origin;
      const verificationCanRetry = disabledOrigin === "verification" && ["passed", "stale", "untested"].includes(verificationStatus);
      const probeRecovered = disabledOrigin === "probe" && verificationStatus === "passed";
      if (verificationCanRetry || probeRecovered) enableCandidate(runtime, candidate, verificationStatus === "passed");
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

  function exhaustedTransientCandidate(result, candidatePolicy) {
    if (result?.passed || String(result?.section || "").trim()) return false;
    const categories = new Set(result?.failureCategories ?? []);
    if (!["timeout", "rate_limit", "network", "unknown"].some((category) => categories.has(category))) return false;
    return Number(result?.attempts) >= Math.max(1, Number(candidatePolicy?.maxRetries) + 1);
  }

  function documentDraftRank(result) {
    if (!String(result?.section || "").trim()) return null;
    const quality = result?.quality ?? {};
    const coverage = quality?.coverage ?? {};
    const metrics = quality?.metrics ?? {};
    const retention = ["lengthRatio", "signalRatio", "commandRatio", "tableRatio", "formulaRatio", "urlRatio"]
      .map((key) => Number(metrics[key]))
      .filter(Number.isFinite)
      .map((value) => Math.max(0, Math.min(1, value)));
    const missing = [
      ...(coverage.missingUnitIds ?? []),
      ...(coverage.thinUnitIds ?? []),
      ...(coverage.duplicateUnitIds ?? []),
      ...(coverage.unexpectedUnitIds ?? []),
    ].length;
    return [
      result?.passed === true ? 1 : 0,
      result?.review?.pass === true ? 1 : 0,
      quality?.passed === true ? 1 : 0,
      coverage?.complete === true ? 1 : 0,
      -missing,
      -(quality?.failures?.length ?? 0),
      retention.length > 0 ? Math.min(...retention) : 0,
      retention.length > 0 ? retention.reduce((sum, value) => sum + value, 0) / retention.length : 0,
      String(result.section).replace(/<!--[^>]*-->/g, "").trim().length,
    ];
  }

  function strongerDocumentDraft(current, candidate) {
    const currentRank = documentDraftRank(current);
    const candidateRank = documentDraftRank(candidate);
    if (!candidateRank) return current;
    if (!currentRank) return candidate;
    for (let index = 0; index < currentRank.length; index++) {
      if (candidateRank[index] === currentRank[index]) continue;
      return candidateRank[index] > currentRank[index] ? candidate : current;
    }
    return current;
  }

  async function processBatch(batch, runtime, state, startCandidateIndex = 0, seedResult = null) {
    const candidates = runtime.candidates;
    const attempts = [];
    let bestResult = seedResult;
    let splitEligible = false;
    const countTokens = typeof options.countTokens === "function" ? options.countTokens : (text) => Math.ceil(String(text ?? "").length / 2);
    for (let candidateIndex = startCandidateIndex; candidateIndex < candidates.length; candidateIndex++) {
      const candidate = candidates[candidateIndex];
      if (state.budget.used >= state.budget.limit) break;
      if (!await candidateAvailable(candidate, runtime, batch)) continue;
      if (bestResult && targetedRepairRequiresVision(bestResult, batch) && candidate.multimodal !== true) continue;
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
      if (exhaustedTransientCandidate(result, candidatePolicy)) {
        runtime.transientBlockedCandidates ??= new Set();
        const circuitKey = candidateCircuitKey(candidate);
        if (!runtime.transientBlockedCandidates.has(circuitKey)) {
          runtime.transientBlockedCandidates.add(circuitKey);
          await store.appendEvent?.(runtime.id, {
            type: "candidate-transient-circuit-opened",
            providerId: candidate.providerId,
            modelId: candidate.modelId,
            role: candidate.role,
            batchId: batch.id,
            categories: result.failureCategories ?? [],
            attempts: result.attempts,
            scope: "execution",
          }).catch((error) => reportPersistenceError(runtime, error, "transient-circuit-event"));
        }
      }
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
      qualityThresholds: runtime.policy.qualityThresholds,
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
        runtime.summaryModelFailure = true;
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
    let deadlineTimer = null;
    const executionStartedAtMs = Date.now();
    const executionTimeoutMs = Math.max(1_000, Number(runtime.policy?.jobTimeoutMs) || 21_600_000);
    runtime.executionStartedAt = new Date(executionStartedAtMs).toISOString();
    runtime.deadlineAt = executionStartedAtMs + executionTimeoutMs;
    runtime.executionDeadlineAt = new Date(runtime.deadlineAt).toISOString();
    runtime.executionModelCalls = 0;
    runtime.budgetError = null;
    runtime.deadlineReached = false;
    runtime.executionEpoch = {
      ...(runtime.executionEpoch ?? {}),
      startedAt: runtime.executionStartedAt,
      deadlineAt: runtime.executionDeadlineAt,
    };
    deadlineTimer = setTimeout(() => {
      if (runtime.controller.signal.aborted) return;
      runtime.deadlineReached = true;
      runtime.budgetError = documentJobBudgetError("timeout", runtime.policy);
      runtime.controller.abort(runtime.budgetError);
    }, executionTimeoutMs);
    try {
      runtime.modelDiagnostics ??= new Map();
      runtime.disabledCandidates ??= new Set();
      runtime.disabledCandidateDetails ??= new Map();
      runtime.candidateAvailability ??= new Map();
      // Transient circuits intentionally live for one execution only. Resume
      // starts a fresh epoch and gives a recovered primary model another try.
      runtime.transientBlockedCandidates = new Set();
      await emit(runtime.id, {
        status: "running",
        running: true,
        paused: false,
        error: null,
        modelDiagnostics: persistedModelDiagnostics(runtime),
        disabledCandidates: persistedDisabledCandidates(runtime),
        disabledCandidateDetails: persistedDisabledCandidateDetails(runtime),
        executionEpoch: runtime.executionEpoch ?? null,
        executionStartedAt: runtime.executionStartedAt,
        executionDeadlineAt: runtime.executionDeadlineAt,
        executionModelCalls: 0,
        progress: {
          executionModelCalls: 0,
          taskModelCallLimit: runtime.policy.maxModelCallsPerJob,
          executionDeadlineAt: runtime.executionDeadlineAt,
          lastHeartbeatAt: new Date().toISOString(),
        },
      });
      await store.appendEvent?.(runtime.id, {
        type: "execution-started",
        retryFailed: runtime.retryFailed === true,
        epochId: runtime.executionEpoch?.id ?? null,
        sourcePlanHash: runtime.executionEpoch?.sourcePlanHash ?? null,
        deadlineAt: runtime.executionDeadlineAt,
        maxModelCalls: runtime.policy.maxModelCallsPerJob,
      })
        .catch((error) => reportPersistenceError(runtime, error, "execution-event"));
      assertExecutionAvailable(runtime);
      const prepareInput = Array.isArray(runtime.input.sourcePaths) && runtime.input.sourcePaths.length > 0
        ? runtime.input.sourcePaths
        : runtime.input.sourcePath;
      prepared = await options.prepareDocument(prepareInput, runtime.controller.signal);
      assertExecutionAvailable(runtime);
      if (!prepared?.ok) throw new Error(prepared?.error || "document preparation failed");
      const sourceFingerprint = runtime.initialSourceFingerprint
        ?? await options.fingerprintSource?.(prepared, runtime.controller.signal);
      runtime.initialSourceFingerprint = null;
      const previous = await store.read(runtime.id);
      await refreshRuntimeTaskFingerprint(runtime, prepared, sourceFingerprint, previous, "execution-start");
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
          const recovered = !runtime.forceSourceRebuild && (!retryFailed || prior?.status === "completed")
            ? await recoverSavedBatch(runtime, batch, prior)
            : null;
          if (recovered) {
            sectionSummaries.push(batchSummary(recovered.section, batch));
            if (recovered.record.status !== "completed") degraded = true;
            return;
          }
          let retrySeed = null;
          if (retryFailed && prior?.status === "needs_review" && batchRecordMatches(prior, batch)) {
            const section = await savedSection(runtime.id, prior.sectionId || batch.id);
            if (section !== null) {
              const resolvedVisualUnitIds = Array.isArray(prior.resolvedVisualUnitIds) ? prior.resolvedVisualUnitIds : [];
              retrySeed = {
                passed: false,
                section,
                quality: evaluateDocumentQuality({
                  units: batch.units,
                  markdown: section,
                  fidelity: runtime.contract.fidelity,
                  resolvedVisualUnitIds,
                  qualityThresholds: runtime.policy.qualityThresholds,
                }),
                review: prior.review ?? null,
                resolvedVisualUnitIds,
                attempts: 0,
                errors: [],
                failureCategories: [],
              };
              await store.appendEvent?.(runtime.id, {
                type: "batch-retry-seeded",
                batchId: batch.id,
                sectionId: prior.sectionId || batch.id,
                resolvedVisualUnitIds,
              }).catch((error) => reportPersistenceError(runtime, error, "retry-seed-event"));
            }
          }
          const budget = { used: 0, limit: runtime.policy.maxModelCallsPerBatch };
          const result = await processBatch(batch, runtime, { depth: 0, budget }, 0, retrySeed);
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
      assertExecutionAvailable(runtime);
      const extractionWarnings = (Array.isArray(sourceSummary?.warnings) ? sourceSummary.warnings : []).map((warning) => {
        const expected = Number(warning?.expected);
        const actual = Number(warning?.actual);
        const message = warning?.type === "office-element-count-mismatch" && Number.isFinite(expected) && Number.isFinite(actual)
          ? `Office 文档提取数量与 OfficeCLI 报告不一致：应有 ${expected} 个元素，实际提取 ${actual} 个，输出需要复核。`
          : warning?.type === "office-empty-elements"
            ? `Office 文档有 ${Number(warning?.count) || 0} 个非视觉元素没有可读取文字${Array.isArray(warning?.locations) && warning.locations.length > 0 ? `（例如：${warning.locations.slice(0, 3).join("、")}）` : ""}，可能存在未支持或隐藏内容，输出需要复核。`
            : String(warning?.message || "文档来源提取存在完整性告警，输出需要复核。");
        return { ...warning, message };
      });
      if (extractionWarnings.length > 0) degraded = true;

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
      let summaryFallbackWarning = null;
      if (runtime.contract.fidelity === "complete-with-summary") {
        const summaryExpected = typeof options.generateSummary === "function" && sectionSummaries.length > 0;
        try {
          summary = await generateHierarchicalSummary(titleForDocument(prepared, runtime.contract), sectionSummaries, runtime);
        } catch (error) {
          if (error?.code === DOCUMENT_JOB_TIMEOUT_CODE) throw error;
          summaryFallbackWarning = {
            type: "document-summary-fallback",
            message: "文档正文已完成，但摘要模型未返回有效结果，已使用程序生成的简要说明，需要复核。",
            technicalMessage: String(error?.message || error).slice(0, 500),
          };
          if (runtime.budgetError?.code === DOCUMENT_JOB_CALL_BUDGET_CODE) runtime.budgetError = null;
        }
        if (!/^##\s+摘要/m.test(summary) || (summaryExpected && runtime.summaryModelFailure === true)) {
          if (summaryExpected && runtime.summaryModelFailure === true) {
            summaryFallbackWarning ??= {
              type: "document-summary-fallback",
              message: "文档正文已完成，但摘要模型未返回有效结果，已使用程序生成的简要说明，需要复核。",
            };
          }
          summary = `## 摘要\n\n文档正文已按 ${totalUnits} 个来源区块完成整理。${degraded || summaryFallbackWarning ? "部分处理结果需要复核。" : "详细内容见下文。"}`;
        }
        if (summaryFallbackWarning) degraded = true;
      }
      assertExecutionAvailable(runtime);
      const title = titleForDocument(prepared, runtime.contract);
      const sourceList = renderCollectionSources(prepared, sourceSummary);
      const content = [`# ${title}`, summary, sourceList, "## 详细正文", detailedBody].filter(Boolean).join("\n\n");
      await (runtime.emitQueue ?? Promise.resolve()).catch(() => {});
      const finalState = await store.read(runtime.id);
      const warnings = buildDocumentQualityWarnings({
        batches: finalState.batches,
        diagnostics: finalState.modelDiagnostics,
        assemblyAudit,
      });
      warnings.push(...extractionWarnings);
      if (summaryFallbackWarning) warnings.push(summaryFallbackWarning);
      const terminalStatus = degraded ? "completed_with_warnings" : "completed";
      const sourceAudit = {
        totalUnits,
        sourceCount: Array.isArray(sourceSummary?.sourceSummaries) ? sourceSummary.sourceSummaries.length : 1,
        sources: Array.isArray(sourceSummary?.sourceSummaries) ? sourceSummary.sourceSummaries : [],
        selectedPages: Number.isFinite(Number(sourceSummary?.selectedPages)) ? Number(sourceSummary.selectedPages) : null,
        processedPages: Number.isFinite(Number(sourceSummary?.processedPages)) ? Number(sourceSummary.processedPages) : null,
        extractionWarnings,
        assembly: assemblyAudit,
      };
      await store.writeFinalDraft?.(runtime.id, content, {
        terminalStatus,
        qualityPassed: !degraded,
        warnings,
        sourceAudit,
        outputPath: runtime.input.outputPath,
      });
      const finalFingerprint = await options.fingerprintSource?.(prepared, runtime.controller.signal);
      const beforeOutput = await store.read(runtime.id);
      await refreshRuntimeTaskFingerprint(runtime, prepared, finalFingerprint, beforeOutput, "before-output");
      const storedFingerprint = beforeOutput.sourceFingerprint;
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
          qualityPassed: !degraded,
          warnings,
          sourceAudit,
          progress: { stage: "source-changed", currentBatch: null, currentLabel: null, lastHeartbeatAt: new Date().toISOString() },
        });
        return;
      }
      try {
        await options.writeOutput({
          outputPath: runtime.input.outputPath,
          content,
          signal: runtime.controller.signal,
          workspaceRoot: runtime.input.workspaceRoot,
          allowOutsideWorkspace: runtime.input.allowOutsideWorkspace === true,
          allowOutputOverwrite: runtime.input.allowOutputOverwrite === true,
        });
      } catch (error) {
        if (error?.code !== "DOCUMENT_OUTPUT_CONFLICT") throw error;
        await emit(runtime.id, {
          status: "awaiting_output",
          running: false,
          paused: true,
          qualityPassed: !degraded,
          warnings,
          sourceAudit,
          error: String(error?.message || error),
          currentModel: null,
          currentModelRole: null,
          progress: {
            stage: "awaiting-output",
            currentBatch: null,
            currentLabel: null,
            generatedChars: content.length,
            elapsedMs: 0,
            lastHeartbeatAt: new Date().toISOString(),
          },
        });
        return;
      }
      const outputCommittedAt = new Date().toISOString();
      const outputSignature = await captureDocumentOutputSignature({
        outputPath: runtime.input.outputPath,
        workspaceRoot: runtime.input.workspaceRoot,
      });
      await emit(runtime.id, {
        status: terminalStatus,
        running: false,
        paused: false,
        qualityPassed: !degraded,
        sourceAudit,
        warnings,
        completedAt: new Date().toISOString(),
        outputCommittedAt,
        outputSignature,
        allowOutputOverwrite: false,
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
      const budgetError = runtime.budgetError
        || ([DOCUMENT_JOB_CALL_BUDGET_CODE, DOCUMENT_JOB_TIMEOUT_CODE].includes(error?.code) ? error : null);
      const cancelled = !budgetError && (runtime.controller.signal.aborted || error?.name === "AbortError");
      const terminalAction = runtime.stopAction === "abandon" ? "abandon" : "stop";
      const terminalStatus = budgetError ? "paused" : cancelled ? (terminalAction === "abandon" ? "abandoned" : "stopped") : "failed";
      await (runtime.emitQueue ?? Promise.resolve()).catch(() => {});
      try {
        await emit(runtime.id, {
          status: terminalStatus,
          running: false,
          paused: terminalStatus === "stopped" || terminalStatus === "paused",
          qualityPassed: false,
          error: budgetError ? budgetError.message : cancelled ? (terminalAction === "abandon" ? "abandoned by user" : null) : String(error?.message || error),
          completedAt: budgetError ? null : terminalAction === "abandon" || !cancelled ? new Date().toISOString() : null,
          stoppedAt: cancelled && !budgetError ? new Date().toISOString() : null,
          currentModel: null,
          currentModelRole: null,
          progress: {
            stage: budgetError?.code === DOCUMENT_JOB_TIMEOUT_CODE ? "job-timeout" : budgetError ? "job-call-budget" : terminalStatus,
            currentBatch: null,
            currentLabel: null,
            lastHeartbeatAt: new Date().toISOString(),
          },
        });
      } catch (persistenceError) {
        reportPersistenceError(runtime, persistenceError, "terminal-state");
      }
      if (!cancelled) notifyError(budgetError || error, runtime.id, prepared);
    } finally {
      if (deadlineTimer) clearTimeout(deadlineTimer);
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

  async function startInternal(input = {}) {
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
    const attachOrigin = async (job) => {
      if (!input.origin || typeof input.origin !== "object") return job;
      const existingOrigin = job.origin && typeof job.origin === "object" ? job.origin : null;
      const originKey = (origin) => {
        if (!origin || typeof origin !== "object") return "";
        return JSON.stringify({
          conversationId: String(origin.conversationId ?? ""),
          operationId: String(origin.operationId ?? ""),
          workspace: String(origin.workspace ?? ""),
        });
      };
      const incomingKey = originKey(input.origin);
      const existingKey = originKey(existingOrigin);
      const subscribers = Array.isArray(job.subscribers) ? [...job.subscribers] : [];
      if (existingOrigin && incomingKey && incomingKey !== existingKey && !subscribers.some((entry) => originKey(entry) === incomingKey)) {
        subscribers.push(input.origin);
        while (subscribers.length > 32) subscribers.shift();
      }
      return store.update(job.id, {
        // The first conversation owns automatic delivery.  A duplicate
        // request may subscribe for visibility, but must never steal it.
        origin: existingOrigin ?? input.origin,
        ...(subscribers.length > 0 ? { subscribers } : {}),
        handoff: {
          ...(job.handoff ?? {}),
          state: "waiting_worker",
          terminalKey: null,
          terminalStatus: null,
          leaseId: null,
          lastError: null,
          userControlled: false,
        },
      });
    };
    const duplicateArtifactDecision = (artifactStatus) => ({
      id: "document-output-integrity",
      question: "已有任务的输出文件无法通过完整性核验，如何继续？",
      recommendedChoiceId: "new-file",
      choices: [
        {
          id: "new-file",
          label: "使用新文件名",
          description: "保留现有任务和文件，重新执行并写入新的输出文件。",
        },
        {
          id: "overwrite-rerun",
          label: "确认覆盖并重新执行",
          description: `明确确认后使用 overwriteConfirmed 重新读取来源并生成新的结果（当前状态：${artifactStatus}）。`,
        },
      ],
    });
    const duplicateArtifactReview = (job, artifactStatus, error, code = "DOCUMENT_OUTPUT_INTEGRITY_REVIEW") => ({
      ok: true,
      accepted: false,
      reused: true,
      completed: false,
      status: "needs_review",
      sourceStatus: job.status,
      artifactStatus,
      requiresUserAction: true,
      requiresUserChoice: true,
      id: job.id,
      outputPath: job.outputPath,
      error,
      code,
      decision: duplicateArtifactDecision(artifactStatus),
      contract: job.contract ?? contract,
    });
    const inspectCompletedDuplicate = async (job) => {
      let draft = null;
      let draftError = null;
      if (job.finalDraft?.sha256 && typeof store.readFinalDraft === "function") {
        try {
          draft = await store.readFinalDraft(job.id);
        } catch (error) {
          draftError = error;
        }
      } else {
        draftError = new Error("后台没有可验证的最终草稿，不能确认已完成输出的完整性");
        draftError.code = "DOCUMENT_FINAL_DRAFT_UNAVAILABLE";
      }

      if (draftError) {
        const artifactStatus = !job.finalDraft?.sha256
          ? "unverified"
          : draftError.code === "DOCUMENT_FINAL_DRAFT_CORRUPT" ? "corrupt" : "unavailable";
        const reason = artifactStatus === "unverified"
          ? "旧任务没有可验证的最终草稿"
          : artifactStatus === "corrupt"
            ? "后台最终草稿校验失败"
            : "后台最终草稿无法读取";
        return duplicateArtifactReview(
          job,
          artifactStatus,
          `${reason}：${String(draftError.message || draftError).slice(0, 500)}`,
          draftError.code || "DOCUMENT_FINAL_DRAFT_UNAVAILABLE",
        );
      }

      const output = await inspectDocumentOutput(job, { verifyHash: true });
      if (output.status === "verified") {
        return {
          ok: true,
          accepted: false,
          reused: true,
          completed: true,
          id: job.id,
          status: job.status,
          artifactStatus: "verified",
          outputPath: job.outputPath,
          contract: job.contract ?? contract,
        };
      }
      if (output.status === "missing") {
        try {
          const recovered = await commitSavedFinalDraft(job, draft);
          if (recovered?.ok) {
            const restored = await inspectDocumentOutput({ ...job, finalDraft: draft }, { verifyHash: true });
            if (restored.status === "verified") {
              return {
                ...recovered,
                accepted: false,
                reused: true,
                completed: true,
                recovered: true,
                artifactStatus: "verified",
                contract: job.contract ?? contract,
              };
            }
            return duplicateArtifactReview(job, restored.status, "后台草稿提交后仍无法核验输出文件", "DOCUMENT_OUTPUT_INTEGRITY_REVIEW");
          }
          return {
            ...duplicateArtifactReview(job, "missing", recovered?.error || "后台最终草稿未能提交到输出路径", recovered?.code || "DOCUMENT_OUTPUT_MISSING"),
            ...recovered,
            status: "needs_review",
            completed: false,
            requiresUserAction: true,
          };
        } catch (error) {
          return duplicateArtifactReview(job, "missing", `后台最终草稿自动恢复失败：${String(error?.message || error).slice(0, 500)}`, String(error?.code || "DOCUMENT_OUTPUT_RESTORE_FAILED"));
        }
      }
      const artifactStatus = output.status === "modified" ? "modified" : "unavailable";
      const message = artifactStatus === "modified"
        ? "已有任务的输出文件已被修改，与后台最终草稿不一致；不能直接宣称任务完成。"
        : `已有任务的输出文件无法访问或不是普通文件：${output.error || "文件状态不可用"}`;
      return duplicateArtifactReview(job, artifactStatus, message, artifactStatus === "modified" ? "DOCUMENT_OUTPUT_MODIFIED" : "DOCUMENT_OUTPUT_UNAVAILABLE");
    };
    if (input.taskFingerprint && typeof store.list === "function") {
      const duplicate = (await store.list()).find((job) => job.taskFingerprint === input.taskFingerprint);
      if (duplicate) {
        if (["completed", "completed_with_warnings"].includes(duplicate.status)) {
          const integrity = await inspectCompletedDuplicate(duplicate);
          // A missing file is safely recoverable from the verified draft and
          // is handled above.  For a modified, unavailable, corrupt, or legacy
          // artifact, only an explicit overwrite confirmation may create a
          // fresh execution record.  Without it, never silently overwrite the
          // user's file or loop back to the same completed duplicate.
          if (integrity.completed === true || input.allowOutputOverwrite !== true) return integrity;
          await store.appendEvent?.(duplicate.id, {
            type: "duplicate-rerun-confirmed",
            previousArtifactStatus: integrity.artifactStatus ?? null,
          }).catch(() => {});
        }
        if (["queued", "running", "waiting_foreground", "waiting_provider", "pausing"].includes(duplicate.status)) {
          const attached = await attachOrigin(duplicate);
          return { ok: true, accepted: true, background: true, reused: true, id: attached.id, outputPath: attached.outputPath, contract: attached.contract ?? contract };
        }
        if (["paused", "interrupted", "stopped", "failed", "awaiting_output"].includes(duplicate.status)) {
          await attachOrigin(duplicate);
          await resume(duplicate.id, { retryFailed: duplicate.status === "failed" });
          return { ok: true, accepted: true, background: true, reused: true, resumed: true, id: duplicate.id, outputPath: duplicate.outputPath, contract: duplicate.contract ?? contract };
        }
      }
    }
    // Duplicate identity and artifact integrity take precedence over a
    // filesystem overwrite prompt.  A repeated request for a completed task
    // must be able to report verified/missing/modified output before asking
    // the user to choose a filename; a brand-new task still receives the
    // normal contract decision below.
    if (contract.requiresDecision) return { ok: false, requiresUserChoice: true, decision: contract.decision };
    const candidates = options.modelCandidates?.(requestedPolicy) ?? [];
    if (candidates.length === 0) throw new Error("no document model is configured");
    const policy = effectiveDocumentPolicy(requestedPolicy, candidates);
    const policyTrace = documentPolicyTrace(requestedPolicy, policy, candidates);
    const job = await store.create({
      sourcePath: input.sourcePath,
      sourcePaths: input.sourcePaths,
      sourceName: input.sourceName,
      outputPath: input.outputPath,
      outputIdentity: input.outputIdentity,
      taskType: input.taskType,
      taskFingerprint: input.taskFingerprint,
      sourceFingerprint: input.sourceFingerprint,
      pages: input.pages,
      workspaceRoot: input.workspaceRoot,
      allowOutsideWorkspace: input.allowOutsideWorkspace,
      allowOutputOverwrite: input.allowOutputOverwrite,
      origin: input.origin,
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
      initialSourceFingerprint: input.sourceFingerprint ?? null,
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

  function start(input = {}) {
    const fingerprint = String(input?.taskFingerprint ?? "").trim();
    if (!fingerprint) return startInternal(input);
    const previous = startFlights.get(fingerprint) ?? Promise.resolve();
    const promise = previous.catch(() => {}).then(() => startInternal(input)).finally(() => {
      if (startFlights.get(fingerprint) === promise) startFlights.delete(fingerprint);
    });
    startFlights.set(fingerprint, promise);
    return promise;
  }

  async function commitSavedFinalDraft(job, savedDraft = null) {
    const draft = savedDraft ?? await store.readFinalDraft(job.id);
    try {
      await options.writeOutput({
        outputPath: job.outputPath,
        content: draft.content,
        workspaceRoot: job.workspaceRoot || dirname(job.outputPath),
        allowOutsideWorkspace: job.allowOutsideWorkspace === true,
        allowOutputOverwrite: job.allowOutputOverwrite === true,
      });
    } catch (error) {
      if (error?.code !== "DOCUMENT_OUTPUT_CONFLICT") throw error;
      await emit(job.id, {
        status: "awaiting_output",
        running: false,
        paused: true,
        error: String(error?.message || error),
        progress: { stage: "awaiting-output", currentBatch: null, currentLabel: null, lastHeartbeatAt: new Date().toISOString() },
      });
      return { ok: false, committed: false, requiresUserChoice: true, code: error.code, id: job.id, outputPath: job.outputPath };
    }
    const completedAt = new Date().toISOString();
    const outputSignature = await captureDocumentOutputSignature(job);
    const terminalStatus = ["completed", "completed_with_warnings"].includes(draft.terminalStatus)
      ? draft.terminalStatus
      : draft.qualityPassed === false ? "completed_with_warnings" : "completed";
    await emit(job.id, {
      status: terminalStatus,
      running: false,
      paused: false,
      qualityPassed: draft.qualityPassed !== false,
      warnings: Array.isArray(draft.warnings) ? draft.warnings : job.warnings ?? [],
      sourceAudit: draft.sourceAudit ?? job.sourceAudit ?? null,
      error: null,
      completedAt,
      outputCommittedAt: completedAt,
      outputSignature,
      allowOutputOverwrite: false,
      progress: {
        stage: "completed",
        currentBatch: null,
        currentLabel: null,
        generatedChars: draft.content.length,
        elapsedMs: 0,
        lastHeartbeatAt: completedAt,
      },
    });
    return { ok: true, resumed: true, committed: true, id: job.id, status: terminalStatus, outputPath: job.outputPath };
  }

  async function resumeInternal(id, request = {}) {
    const job = await store.read(id);
    // A stale UI click after a saved-draft commit must be idempotent.  A
    // completed-with-warnings job may still be explicitly retried, but a
    // normal resume must never re-run a completed task.
    if (job.status === "completed" || (job.status === "completed_with_warnings" && request.retryFailed !== true)) {
      if (job.finalDraft && job.outputCommittedAt && typeof store.readFinalDraft === "function") {
        const outputArtifact = await inspectDocumentOutput(job);
        if (outputArtifact.status === "missing") {
          try {
            return await commitSavedFinalDraft(job, await store.readFinalDraft(id));
          } catch (error) {
            await store.appendEvent?.(id, {
              type: "final-output-restore-failed",
              code: String(error?.code || "OUTPUT_RESTORE_FAILED"),
              message: String(error?.message || error).slice(0, 500),
            }).catch(() => {});
            return { ok: false, resumed: false, id, status: job.status, error: error?.message || String(error) };
          }
        }
      }
      return { ok: true, resumed: false, alreadyCompleted: true, id, status: job.status, outputPath: job.outputPath };
    }
    const terminalizingRuntime = runtimes.get(id);
    if (
      terminalizingRuntime?.executing === true
      && ["failed", "paused", "stopped", "abandoned", "source_changed", "awaiting_output", "completed_with_warnings"].includes(job.status)
    ) {
      const completion = completions.get(id);
      if (!completion) {
        return { ok: false, resumed: false, reason: "document worker is finishing", id, status: job.status };
      }
      await completion;
      return resumeInternal(id, request);
    }
    const resetHandoff = {
      ...(job.handoff ?? {}),
      state: "waiting_worker",
      terminalKey: null,
      terminalStatus: null,
      leaseId: null,
      lastError: null,
      userControlled: false,
    };
    const savedDraftCanCompleteResume = job.finalDraft
      && typeof store.readFinalDraft === "function"
      && !job.outputCommittedAt
      && job.status !== "source_changed"
      && !(job.status === "completed_with_warnings" && request.retryFailed === true);
    if (savedDraftCanCompleteResume) {
      try {
        const savedDraft = await store.readFinalDraft(id);
        await store.update(id, { handoff: resetHandoff });
        return commitSavedFinalDraft(job, savedDraft);
      } catch (error) {
        await store.appendEvent?.(id, {
          type: "final-draft-recovery-rejected",
          code: String(error?.code || "FINAL_DRAFT_UNAVAILABLE"),
          message: String(error?.message || error).slice(0, 500),
        }).catch(() => {});
      }
    }
    if (runtimes.has(id)) {
      const runtime = runtimes.get(id);
      runtime.paused = false;
      runtime.retryFailed ||= request.retryFailed === true;
      await emit(id, { status: "running", running: true, paused: false, handoff: resetHandoff });
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
    await store.update(id, { executionEpoch, handoff: resetHandoff });
    let resolveCompletion;
    const completion = new Promise((resolve) => { resolveCompletion = resolve; });
    completions.set(id, completion);
    const runtime = {
      id,
      input: {
        sourcePath: job.sourcePath,
        sourcePaths: job.sourcePaths,
        outputPath: job.outputPath,
        outputIdentity: job.outputIdentity ?? job.outputPath,
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
      initialSourceFingerprint: null,
      controller: new AbortController(),
      disabledCandidates: disabledCandidateSet(job.disabledCandidates),
      disabledCandidateDetails: disabledCandidateDetailMap(job.disabledCandidateDetails),
      candidateAvailability: new Map(),
      emitQueue: Promise.resolve(),
      paused: false,
      stopAction: null,
      retryFailed: request.retryFailed === true,
      forceSourceRebuild: job.status === "source_changed",
      executing: false,
      resolve: resolveCompletion,
    };
    try {
      await emit(id, { status: "queued", running: false, paused: false, error: null, policy, policyTrace, executionEpoch });
      await store.appendEvent?.(id, { type: "resume-requested", retryFailed: request.retryFailed === true, epochId: executionEpoch.id, sourcePlanHash: executionEpoch.sourcePlanHash, ...policyTrace }).catch(() => {});
      options.onPolicy?.(id, policyTrace);
      runtime.retryFailed ||= request.retryFailed === true;
    } catch (error) {
      completions.delete(id);
      throw error;
    }
    enqueue(runtime);
    return { ok: true, resumed: true, id };
  }

  function resume(id, { retryFailed = false } = {}) {
    const key = String(id).replace(/^document:/, "");
    const existing = resumeFlights.get(key);
    if (existing) {
      if (retryFailed === true) {
        existing.retryFailed = true;
        const runtime = runtimes.get(key);
        if (runtime) runtime.retryFailed = true;
      }
      return existing.promise;
    }
    const request = { retryFailed: retryFailed === true, promise: null };
    const promise = resumeInternal(key, request).finally(() => {
      if (resumeFlights.get(key) === request) resumeFlights.delete(key);
    });
    request.promise = promise;
    resumeFlights.set(key, request);
    return promise;
  }

  async function control(rawId, action) {
    const id = String(rawId).replace(/^document:/, "");
    const runtime = runtimes.get(id);
    if (action === "pause") {
      if (!runtime) return { ok: false, error: "document job is not running" };
      if (runtime.stopAction) return { ok: false, error: "document job is stopping; wait for the current action to finish" };
      runtime.paused = true;
      const job = await store.read(id);
      await emit(id, {
        status: "pausing",
        paused: true,
        handoff: { ...(job.handoff ?? {}), state: "user_paused", userControlled: true },
      });
      return { ok: true, paused: true, id };
    }
    if (action === "resume") return resume(id);
    if (action === "retry") return resume(id, { retryFailed: true });
    if (action === "cancel" || action === "stop" || action === "abandon") {
      const abandon = action === "abandon";
      if (runtime) {
        const currentJob = await store.read(id);
        const userHandoff = {
          ...(currentJob.handoff ?? {}),
          state: abandon ? "abandoned" : "user_paused",
          userControlled: true,
          terminalKey: null,
          terminalStatus: null,
          leaseId: null,
        };
        await emit(id, { handoff: userHandoff });
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
            handoff: userHandoff,
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
        const stoppable = ["queued", "paused", "interrupted", "stopped", "source_changed", "awaiting_output"].includes(job.status);
        const abandonable = stoppable || job.status === "failed";
        if (abandon ? abandonable : stoppable) {
          await emit(id, {
            status: abandon ? "abandoned" : "stopped",
            running: false,
            paused: !abandon,
            qualityPassed: false,
            error: abandon ? "abandoned by user" : null,
            handoff: {
              ...(job.handoff ?? {}),
              state: abandon ? "abandoned" : "user_paused",
              userControlled: true,
              terminalKey: null,
              terminalStatus: null,
              leaseId: null,
            },
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
      let job;
      try {
        job = await store.read(id);
      } catch (error) {
        const placeholder = typeof store.list === "function"
          ? (await store.list()).find((item) => item.id === id && item.corrupt === true)
          : null;
        if (!placeholder) throw error;
        job = placeholder;
      }
      const handoffActive = ["queued", "running"].includes(job?.handoff?.state);
      if (runtime || handoffActive || ["running", "queued", "waiting_foreground", "waiting_provider", "pausing"].includes(job.status)) {
        return { ok: false, error: "请先立即停止或放弃任务，再删除任务记录" };
      }
      await store.remove(id);
      options.onDelete?.(publicBackgroundJob(job), job);
      return { ok: true, deleted: true, id, outputPath: job.outputPath ?? null };
    }
    return { ok: false, error: `unknown document job action: ${action}` };
  }

  async function listMetadata() {
    return Promise.all((await store.list()).map(async (job) => {
      const metadata = publicBackgroundJob(job);
      if (job.finalDraft) metadata.previewAvailable = true;
      if (!metadata.previewAvailable) metadata.previewAvailable = (await store.listSectionIds?.(job.id) ?? []).length > 0;
      return attachDocumentOutputState(metadata, job);
    }));
  }

  async function getMetadata(rawId) {
    const id = String(rawId).replace(/^document:/, "");
    try {
      const job = await store.read(id);
      const metadata = publicBackgroundJob(job);
      await attachDocumentOutputState(metadata, job, { verifyHash: true });
      if (job.finalDraft && typeof store.readFinalDraft === "function") {
        try {
          const draft = await store.readFinalDraft(id);
          const truncated = draft.content.length > 2_000_000;
          metadata.previewAvailable = true;
          metadata.preview = {
            filename: basename(job.outputPath || `${titleForJob(job)}.md`),
            content: truncated ? `${draft.content.slice(0, 2_000_000)}\n\n> 预览内容过长，后续部分暂未显示。` : draft.content,
            partial: false,
            staged: !["completed", "completed_with_warnings"].includes(job.status),
            truncated,
          };
        } catch (error) {
          metadata.needsAttention = true;
          metadata.previewError = `后台保存的最终草稿无法校验：${error?.message || error}`;
          metadata.warnings = [
            ...(Array.isArray(metadata.warnings) ? metadata.warnings : []),
            { type: "document-final-draft-unavailable", message: metadata.previewError },
          ];
        }
      }
      const ordered = [...(job.batches ?? [])]
        .filter((batch) => batch.sectionId && ["completed", "needs_review"].includes(batch.status))
        .sort((left, right) => left.index - right.index);
      const orphanSectionIds = ordered.length === 0 ? await store.listSectionIds?.(id) ?? [] : [];
      if (!metadata.preview && (ordered.length > 0 || orphanSectionIds.length > 0)) {
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
    } catch (error) {
      // `document-job-store.list()` exposes a read-only corrupt placeholder so
      // a damaged manifest remains visible in the workbench.  Reuse that
      // placeholder here instead of turning the detail request into a 404.
      try {
        const placeholder = (await store.list()).find((item) => item.id === id && item.corrupt === true);
        if (!placeholder) return null;
        const metadata = publicBackgroundJob(placeholder);
        metadata.needsAttention = true;
        metadata.previewAvailable = false;
        metadata.previewError = placeholder.error || String(error?.message || error);
        metadata.warnings = [
          ...(Array.isArray(metadata.warnings) ? metadata.warnings : []),
          { type: "document-manifest-corrupt", message: metadata.previewError },
        ];
        metadata.events = await store.readEvents?.(id, 100) ?? [];
        return metadata;
      } catch {
        return null;
      }
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
