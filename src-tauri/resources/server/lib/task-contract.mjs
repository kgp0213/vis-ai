const EXECUTION_KINDS = new Set(["artifact", "file", "office", "media", "code", "external", "side_effect"]);
const COMPLETION_POLICIES = new Set(["execution_only", "evidence_required", "user_confirmation"]);

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeExpectedOutput(value, index) {
  const source = value && typeof value === "object" ? value : { description: value };
  const id = text(source.id, 160) || `output-${index + 1}`;
  const kind = text(source.kind, 80) || "result";
  return {
    id,
    kind,
    description: text(source.description ?? source.title ?? "", 1000),
    ...(text(source.path, 2000) ? { path: text(source.path, 2000) } : {}),
    ...(text(source.outputId, 240) ? { outputId: text(source.outputId, 240) } : {}),
    ...(text(source.artifactId, 240) ? { artifactId: text(source.artifactId, 240) } : {}),
    ...(text(source.resourceId, 240) ? { resourceId: text(source.resourceId, 240) } : {}),
    required: source.required !== false,
    ...(Array.isArray(source.acceptanceCriteria) ? {
      acceptanceCriteria: source.acceptanceCriteria.map((entry) => text(entry, 600)).filter(Boolean).slice(0, 16),
    } : {}),
  };
}

function normalizeCriterion(value, index) {
  const source = value && typeof value === "object" ? value : { description: value };
  return {
    id: text(source.id, 160) || `criterion-${index + 1}`,
    description: text(source.description ?? source.title ?? source, 1000),
    required: source.required !== false,
  };
}

export function isExecutionTask({ intent = "", expectedOutputs = [], sideEffects = [], kind = "" } = {}) {
  const normalizedKind = text(kind, 80).toLowerCase();
  if (EXECUTION_KINDS.has(normalizedKind)) return true;
  if (list(expectedOutputs).length > 0 || list(sideEffects).length > 0) return true;
  return /(?:生成|创建|写入|保存|修改|编译|测试|转换|导出|发送|上传|安装|执行|修复|产物|文件|代码)/iu.test(String(intent));
}

export function createTaskContract({
  operationId = null,
  sessionId = null,
  workspaceFingerprint = null,
  intent = "",
  expectedOutputs = [],
  acceptanceCriteria = [],
  sideEffects = [],
  requiresApproval = false,
  completionPolicy = null,
  kind = "",
  executionRequired = null,
  createdAt = new Date().toISOString(),
} = {}) {
  const outputs = list(expectedOutputs).map(normalizeExpectedOutput);
  const criteria = list(acceptanceCriteria).map(normalizeCriterion).filter((entry) => entry.description);
  const effects = list(sideEffects).map((entry) => text(typeof entry === "object" ? entry.type ?? entry.description : entry, 600)).filter(Boolean).slice(0, 32);
  const requiresVerification = executionRequired === null
    ? isExecutionTask({ intent, expectedOutputs: outputs, sideEffects: effects, kind })
    : executionRequired === true;
  const policy = text(completionPolicy, 80).toLowerCase();
  return {
    contractVersion: 1,
    ...(text(operationId, 240) ? { operationId: text(operationId, 240) } : {}),
    ...(text(sessionId, 240) ? { sessionId: text(sessionId, 240) } : {}),
    ...(text(workspaceFingerprint, 240) ? { workspaceFingerprint: text(workspaceFingerprint, 240) } : {}),
    intent: text(intent, 12000),
    expectedOutputs: outputs,
    acceptanceCriteria: criteria,
    sideEffects: effects,
    requiresApproval: requiresApproval === true,
    executionRequired: requiresVerification,
    completionPolicy: COMPLETION_POLICIES.has(policy)
      ? policy
      : (requiresVerification ? "evidence_required" : "execution_only"),
    createdAt: text(createdAt, 80) || new Date().toISOString(),
  };
}

export function normalizeTaskContract(value, defaults = {}) {
  const source = value && typeof value === "object" ? value : {};
  return createTaskContract({
    ...defaults,
    ...source,
    expectedOutputs: source.expectedOutputs ?? defaults.expectedOutputs,
    acceptanceCriteria: source.acceptanceCriteria ?? defaults.acceptanceCriteria,
    sideEffects: source.sideEffects ?? defaults.sideEffects,
    executionRequired: source.executionRequired ?? defaults.executionRequired,
  });
}

export function mapLegacyTaskState(value) {
  const state = text(value, 80).toLowerCase();
  if (["completed", "completed_with_warnings", "failed", "cancelled", "unknown", "incomplete"].includes(state)) return state;
  if (["succeeded", "success", "done"].includes(state)) return "completed";
  return state ? "unknown" : null;
}

export { EXECUTION_KINDS };
