const EXECUTION_KINDS = new Set(["artifact", "file", "office", "media", "code", "external", "side_effect"]);
const COMPLETION_POLICIES = new Set(["execution_only", "evidence_required", "user_confirmation"]);
const EVIDENCE_TYPES = new Set(["tool_read", "mutation", "test", "execution", "external_side_effect"]);

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

function normalizeRequiredEvidence(value) {
  return [...new Set(list(value).map((entry) => text(entry, 80).toLowerCase()).filter((entry) => EVIDENCE_TYPES.has(entry)))];
}

function inferRequiredEvidence({ intent = "", expectedOutputs = [], sideEffects = [] } = {}) {
  const value = String(intent);
  const required = [];
  const hasExpectedOutput = list(expectedOutputs).some((output) => output?.required !== false);
  if (!hasExpectedOutput && /(?:修复|修改|写入|保存|创建|生成|转换|导出|删除|重命名|移动|复制|安装|部署|发布)/iu.test(value)) {
    required.push("mutation");
  }
  if (/(?:测试|编译|构建|校验|验证|lint|typecheck|check|build|test)/iu.test(value)) required.push("test");
  if (list(sideEffects).length > 0 || /(?:发送|上传|通知|外部副作用)/iu.test(value)) required.push("external_side_effect");
  if (required.length === 0 && /(?:执行|运行)/iu.test(value)) required.push("execution");
  return [...new Set(required)];
}

export function isExecutionTask({ intent = "", expectedOutputs = [], sideEffects = [], kind = "" } = {}) {
  const normalizedKind = text(kind, 80).toLowerCase();
  if (EXECUTION_KINDS.has(normalizedKind)) return true;
  if (list(expectedOutputs).length > 0 || list(sideEffects).length > 0) return true;
  // A noun such as "文件" or "代码" is not an execution request by itself.
  // Require an explicit mutating/operational verb so questions like "看看这个
  // 文件" remain ordinary chat and do not become an unprovable incomplete task.
  return /(?:生成|创建|写入|保存|修改|编译|测试|转换|导出|发送|上传|安装|执行|修复|删除|重命名|移动|复制|下载|运行|部署|发布|验证|检查并|读取并)/iu.test(String(intent));
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
  requiredEvidence = null,
  createdAt = new Date().toISOString(),
} = {}) {
  const outputs = list(expectedOutputs).map(normalizeExpectedOutput);
  const criteria = list(acceptanceCriteria).map(normalizeCriterion).filter((entry) => entry.description);
  const effects = list(sideEffects).map((entry) => text(typeof entry === "object" ? entry.type ?? entry.description : entry, 600)).filter(Boolean).slice(0, 32);
  const requiresVerification = executionRequired === null
    ? isExecutionTask({ intent, expectedOutputs: outputs, sideEffects: effects, kind })
    : executionRequired === true;
  const evidenceRequirements = requiredEvidence === null
    ? inferRequiredEvidence({ intent, expectedOutputs: outputs, sideEffects: effects })
    : normalizeRequiredEvidence(requiredEvidence);
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
    requiredEvidence: requiresVerification ? evidenceRequirements : [],
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
    requiredEvidence: source.requiredEvidence ?? defaults.requiredEvidence,
  });
}

export function mapLegacyTaskState(value) {
  const state = text(value, 80).toLowerCase();
  if (["completed", "completed_with_warnings", "failed", "cancelled", "unknown", "incomplete"].includes(state)) return state;
  if (["succeeded", "success", "done"].includes(state)) return "completed";
  return state ? "unknown" : null;
}

export { EVIDENCE_TYPES, EXECUTION_KINDS };
