import { createHash, randomUUID } from "node:crypto";

const SCHEMA_VERSION = 1;
const MAX_STEP_NO_PROGRESS = 3;
const MAX_PLAN_ATTEMPTS = 3;
const LARGE_CONTEXT_CHARS = 24_000;
const LARGE_TOOL_RESULT_CHARS = 64_000;
const MAX_EVIDENCE_CALLS = 60;
const MAX_PROGRESS_KEYS = 200;
const CONTROL_TOOL_RE = /^(?:ask_choice|submit_plan|mark_step_complete|revise_plan|todo_write)$/i;

const DISCUSSION_RE = /(?:如何|怎么|怎样|是否|能否|可否|评估|分析|讨论|建议|方案|为什么|how|why|discuss|evaluate|suggest)/i;
const EXECUTION_RE = /(?:修改|实现|创建|生成|保存|转换|提取|重构|迁移|整理|处理|运行|测试|构建|提交|推送|发送|部署|安装|删除|覆盖|写入|落地|fix|implement|create|generate|save|convert|extract|refactor|migrate|run|test|build|commit|push|send|deploy|install|delete|write)/i;
const EXPLICIT_PLAN_RE = /(?:制定|生成|给出|按照|按).{0,8}计划|先.{0,24}(?:再|然后)|按计划落地|逐步执行|step[- ]by[- ]step|create.{0,8}plan|follow.{0,8}plan/i;
const MULTI_STEP_RE = /(?:然后|随后|接着|再|同时|并且|以及).{0,32}(?:修改|实现|创建|生成|保存|运行|测试|构建|验证|提交|检查)|(?:modify|implement|create|run|test|build).{0,40}(?:then|and then|also).{0,40}(?:modify|implement|create|run|test|build)/i;
const MULTI_TARGET_RE = /(?:多个|多份|两个以上|所有|全部|批量|整批|目录下|整个仓库|跨模块|多来源|multi[- ]file|multiple|all files|batch|repository-wide|cross-module)/i;
const LONG_RUNNING_RE = /(?:大型|长时间|持续|全量|完整内容|全部内容|断点|恢复|跨压缩|重启后继续|large|long-running|full content|resume|checkpoint|restart)/i;
const HIGH_IMPACT_RE = /(?:批量删除|全部删除|删除.{0,24}(?:全部|生产|数据库)|覆盖|提交|推送|发送|部署|安装|改数据库|迁移数据|drop\s+table|delete all|overwrite|commit|push|send|deploy|install|migration)/i;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function nowIso(now = Date.now()) {
  return new Date(Number(now) || Date.now()).toISOString();
}

function hash(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

export function normalizeForegroundModelFailure(value = {}) {
  const message = String(value?.error ?? value?.message ?? value?.content ?? value ?? "").trim();
  if (!message) return null;
  const explicitCode = message.match(/["'](?:code|type)["']\s*:\s*["']([^"']+)["']/i)?.[1];
  const knownCode = message.match(/\b(AccountQuotaExceeded|insufficient_quota|invalid_api_key|authentication_error|permission_denied)\b/i)?.[1];
  const status = Number(message.match(/\b(?:HTTP|OpenAI|DeepSeek)?\s*(401|402|403|429)\b/i)?.[1] || 0) || null;
  const retryAt = message.match(/20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})/i)?.[0] ?? null;
  const permanentPattern = /AccountQuotaExceeded|insufficient[_ -]?quota|billing[_ -]?hard[_ -]?limit|余额不足|账户[^\r\n]{0,20}配额|配额(?:已)?耗尽|invalid[_ -]?api[_ -]?key|authentication[_ -]?(?:error|failed)|permission[_ -]?denied|unauthorized|forbidden/i;
  const recoverable = typeof value?.recoverable === "boolean"
    ? value.recoverable
    : !(permanentPattern.test(message) || [401, 402, 403].includes(status));
  return {
    message: message.slice(0, 4_000),
    code: String(explicitCode || knownCode || (status ? `HTTP_${status}` : "MODEL_REQUEST_FAILED")),
    status,
    recoverable,
    retryAt,
  };
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== "object") return null;
  const steps = (Array.isArray(plan.steps) ? plan.steps : [])
    .filter((step) => step && typeof step.id === "string" && step.id.trim())
    .slice(0, 50)
    .map((step) => ({
      id: step.id.trim(),
      title: String(step.title || step.id).trim(),
      action: String(step.action || step.title || step.id).trim(),
      ...(step.risk ? { risk: String(step.risk) } : {}),
    }));
  if (steps.length === 0) return null;
  const valid = new Set(steps.map((step) => step.id));
  const completedStepIds = [...new Set(Array.isArray(plan.completedStepIds) ? plan.completedStepIds.map(String) : [])]
    .filter((stepId) => valid.has(stepId));
  return {
    steps,
    completedStepIds,
    summary: typeof plan.summary === "string" ? plan.summary.slice(0, 500) : null,
    body: typeof plan.body === "string" ? plan.body.slice(0, 20_000) : null,
  };
}

function summarizeHistory(history) {
  const messages = Array.isArray(history) ? history : [];
  let toolResultCount = 0;
  let toolResultChars = 0;
  for (const entry of messages) {
    if (entry?.role !== "tool") continue;
    toolResultCount += 1;
    toolResultChars += typeof entry.content === "string" ? entry.content.length : 0;
  }
  return {
    messageCount: messages.length,
    toolResultCount,
    toolResultChars,
  };
}

function signalSet(input = {}) {
  const prompt = String(input.prompt ?? "").trim();
  const hasExecution = EXECUTION_RE.test(prompt);
  const discussionOnly = DISCUSSION_RE.test(prompt) && !hasExecution;
  return {
    activePlan: Boolean(input.activePlan && Number(input.activePlan.totalSteps) > Number(input.activePlan.completedSteps || 0)),
    completeCoverage: input.completeCoverage === true,
    artifact: input.artifactRequired === true,
    explicitPlan: EXPLICIT_PLAN_RE.test(prompt) && hasExecution,
    multiStep: MULTI_STEP_RE.test(prompt) || ((prompt.match(/(?:修改|实现|创建|生成|运行|测试|构建|验证|提交|modify|implement|create|run|test|build)/gi) ?? []).length >= 3),
    multiTarget: MULTI_TARGET_RE.test(prompt),
    longRunning: LONG_RUNNING_RE.test(prompt),
    highImpact: HIGH_IMPACT_RE.test(prompt),
    execution: hasExecution,
    discussionOnly,
  };
}

export function assessTaskComplexity(input = {}) {
  const signals = signalSet(input);
  const weighted = [
    ["active-plan", signals.activePlan, 6],
    ["complete-coverage", signals.completeCoverage, 5],
    ["explicit-plan", signals.explicitPlan, 3],
    ["multi-step", signals.multiStep, 2],
    ["multi-target", signals.multiTarget, 2],
    ["long-running", signals.longRunning, 2],
    ["high-impact-side-effect", signals.highImpact, 4],
    ["artifact", signals.artifact, 1],
  ];
  const reasons = weighted.filter(([, enabled]) => enabled).map(([reason]) => reason);
  let score = weighted.reduce((sum, [, enabled, weight]) => sum + (enabled ? weight : 0), 0);
  if (signals.execution && (signals.multiStep || signals.multiTarget)) score += 2;
  if (signals.discussionOnly && !signals.activePlan && !signals.completeCoverage && !signals.artifact) score = 0;
  const classification = score >= 4 ? "complex" : "simple";
  return { classification, score, reasons, signals };
}

export function startForegroundTask(input = {}) {
  const assessment = input.assessment ?? assessTaskComplexity(input);
  const createdAt = nowIso(input.now);
  const workPlan = normalizePlan(input.activePlan);
  return {
    schemaVersion: SCHEMA_VERSION,
    id: String(input.taskId || `foreground:${randomUUID()}`),
    turnId: String(input.turnId || randomUUID()),
    classification: assessment.classification === "complex" ? "complex" : "simple",
    lifecycle: assessment.classification === "complex" ? "assessing" : "running",
    goal: String(input.prompt ?? "").trim().slice(0, 12_000),
    assessment: clone(assessment),
    acceptance: {
      artifactRequired: input.artifactRequired === true,
      completeCoverage: input.completeCoverage === true,
      verificationRequired: assessment.classification === "complex",
      partialAccepted: false,
    },
    inherited: summarizeHistory(input.history),
    workPlan,
    checkpoints: { steps: {} },
    evidence: {
      calls: [],
      totalToolCalls: 0,
      totalToolResultChars: 0,
      successfulToolCalls: 0,
      mutatingToolCalls: 0,
      verificationToolCalls: 0,
      novelProgressCount: 0,
      artifacts: [],
      progressKeys: [],
    },
    dispatch: {
      currentPhase: assessment.classification === "complex" ? "assessment" : "ordinary",
      currentStepId: null,
      planningAttempts: 0,
      verificationAttempts: 0,
      stepNoProgressStreak: {},
      baselineToolCalls: 0,
      baselineArtifactCount: 0,
      baselineVerificationToolCalls: 0,
      baselineNovelProgressCount: 0,
      windowOpen: false,
    },
    upgrade: assessment.classification === "complex" ? null : { upgraded: false, reasons: [] },
    createdAt,
    updatedAt: createdAt,
  };
}

export function restoreForegroundTask(value) {
  if (!value || value.schemaVersion !== SCHEMA_VERSION) return null;
  if (!/^foreground:/.test(String(value.id || ""))) return null;
  if (!new Set(["simple", "complex"]).has(value.classification)) return null;
  const restored = clone(value);
  restored.workPlan = normalizePlan(restored.workPlan);
  restored.acceptance ??= {};
  restored.acceptance.partialAccepted = restored.acceptance.partialAccepted === true;
  restored.evidence ??= {};
  restored.evidence.calls = (Array.isArray(restored.evidence.calls) ? restored.evidence.calls : []).slice(-MAX_EVIDENCE_CALLS);
  restored.evidence.artifacts = [...new Set(Array.isArray(restored.evidence.artifacts) ? restored.evidence.artifacts.map(String) : [])].slice(-100);
  restored.evidence.progressKeys = [...new Set(Array.isArray(restored.evidence.progressKeys) ? restored.evidence.progressKeys.map(String) : [])]
    .slice(-MAX_PROGRESS_KEYS);
  restored.evidence.novelProgressCount = Number(restored.evidence.novelProgressCount || 0);
  restored.checkpoints = restored.checkpoints && typeof restored.checkpoints === "object" ? restored.checkpoints : { steps: {} };
  restored.checkpoints.steps = restored.checkpoints.steps && typeof restored.checkpoints.steps === "object"
    ? restored.checkpoints.steps
    : {};
  restored.dispatch ??= { planningAttempts: 0, verificationAttempts: 0, stepNoProgressStreak: {} };
  restored.dispatch.stepNoProgressStreak = restored.dispatch.stepNoProgressStreak && typeof restored.dispatch.stepNoProgressStreak === "object"
    ? restored.dispatch.stepNoProgressStreak
    : {};
  restored.dispatch.baselineToolCalls = Number(restored.dispatch.baselineToolCalls || 0);
  restored.dispatch.baselineArtifactCount = Number(restored.dispatch.baselineArtifactCount || 0);
  restored.dispatch.baselineVerificationToolCalls = Number(restored.dispatch.baselineVerificationToolCalls || 0);
  restored.dispatch.baselineNovelProgressCount = Number(restored.dispatch.baselineNovelProgressCount || 0);
  restored.dispatch.windowOpen = restored.dispatch.windowOpen === true;
  delete restored.dispatch.stepAttempts;
  return restored;
}

export function resumeForegroundTask(state, input = {}) {
  const next = restoreForegroundTask(state);
  if (!next || new Set(["completed", "partial", "stopped"]).has(next.lifecycle)) return null;
  next.turnId = String(input.turnId || next.turnId);
  next.inherited = summarizeHistory(input.history);
  next.workPlan = normalizePlan(input.activePlan) ?? next.workPlan;
  if (next.lifecycle === "waiting_user" && input.resumeWaitingUser !== true) {
    next.updatedAt = nowIso(input.now);
    return next;
  }
  if (next.lifecycle === "waiting_user") {
    if (next.blockingReason === "step-no-progress" && next.dispatch.currentStepId) {
      next.dispatch.stepNoProgressStreak[next.dispatch.currentStepId] = 0;
    }
    delete next.blockingReason;
    delete next.blockingFailure;
  }
  next.lifecycle = "running";
  next.updatedAt = nowIso(input.now);
  return next;
}

export function recordForegroundPlan(state, plan, now = Date.now()) {
  const next = restoreForegroundTask(state);
  if (!next) return state;
  const normalized = normalizePlan(plan);
  if (!normalized) return next;
  const priorCompleted = new Set([
    ...(next.workPlan?.completedStepIds ?? []),
    ...(next.revision?.previousPlan?.completedStepIds ?? []),
  ]);
  normalized.completedStepIds = [...new Set([...normalized.completedStepIds, ...priorCompleted])]
    .filter((stepId) => normalized.steps.some((step) => step.id === stepId));
  next.classification = "complex";
  next.lifecycle = "running";
  next.workPlan = normalized;
  delete next.revision;
  next.updatedAt = nowIso(now);
  return next;
}

export function recordForegroundStepCompletion(state, update = {}, now = Date.now()) {
  const next = restoreForegroundTask(state);
  const stepId = String(update.stepId || "").trim();
  if (!next?.workPlan || !stepId || !next.workPlan.steps.some((step) => step.id === stepId)) return next ?? state;
  if (next.workPlan.completedStepIds.includes(stepId)) return next;
  if (next.dispatch.currentPhase !== "step" || next.dispatch.currentStepId !== stepId) {
    throw new Error(`mark_step_complete: "${stepId}" is not the current supervised step.`);
  }
  const toolCalls = next.evidence.calls.filter((call) => (
    call.stepId === stepId
    && call.index > next.dispatch.baselineToolCalls
    && call.progressEvidence === true
    && call.novel === true
  ));
  const novelProgressCount = Math.max(
    0,
    next.evidence.novelProgressCount - next.dispatch.baselineNovelProgressCount,
  );
  const artifacts = next.evidence.artifacts.slice(next.dispatch.baselineArtifactCount);
  if (novelProgressCount === 0 && artifacts.length === 0) {
    throw new Error("mark_step_complete requires new host evidence from the current supervised step.");
  }
  next.checkpoints.steps[stepId] = {
    stepId,
    result: String(update.result || "").trim().slice(0, 4_000),
    toolCallIndexes: toolCalls.map((call) => call.index),
    novelProgressCount,
    artifacts,
    completedAt: nowIso(now),
  };
  next.workPlan.completedStepIds = [...new Set([...next.workPlan.completedStepIds, stepId])];
  next.lifecycle = next.workPlan.completedStepIds.length === next.workPlan.steps.length ? "verifying" : "running";
  next.dispatch.stepNoProgressStreak[stepId] = 0;
  next.dispatch.currentStepId = null;
  next.dispatch.windowOpen = false;
  next.updatedAt = nowIso(now);
  return next;
}

export function recordForegroundToolEvent(state, event = {}, now = Date.now()) {
  const next = restoreForegroundTask(state);
  if (!next) return state;
  const toolName = String(event.toolName || "unknown").trim() || "unknown";
  const toolArgs = typeof event.toolArgs === "string" ? event.toolArgs : JSON.stringify(event.toolArgs ?? {});
  const content = typeof event.content === "string" ? event.content : JSON.stringify(event.content ?? "");
  const succeeded = event.succeeded === true;
  const phase = String(next.dispatch.currentPhase || "ordinary");
  const progressEvidence = succeeded && event.progressEvidence !== false && !CONTROL_TOOL_RE.test(toolName);
  const progressKey = progressEvidence ? `${toolName}:${hash(toolArgs)}:${hash(content)}` : null;
  const novel = progressEvidence && !next.evidence.progressKeys.includes(progressKey);
  const call = {
    index: next.evidence.totalToolCalls + 1,
    toolName,
    argsHash: hash(toolArgs),
    resultHash: hash(content),
    resultChars: content.length,
    readOnly: event.readOnly === true,
    succeeded,
    progressEvidence,
    novel,
    phase,
    ...(next.dispatch.currentStepId ? { stepId: next.dispatch.currentStepId } : {}),
  };
  next.evidence.calls = [...next.evidence.calls, call].slice(-MAX_EVIDENCE_CALLS);
  next.evidence.totalToolCalls += 1;
  next.evidence.totalToolResultChars += content.length;
  if (succeeded) next.evidence.successfulToolCalls += 1;
  if (succeeded && !event.readOnly) next.evidence.mutatingToolCalls += 1;
  if (novel) {
    next.evidence.progressKeys = [...next.evidence.progressKeys, progressKey].slice(-MAX_PROGRESS_KEYS);
    next.evidence.novelProgressCount += 1;
  }
  const verificationEvidence = event.verificationEvidence === undefined
    ? event.readOnly === true
    : event.verificationEvidence === true;
  if (phase === "verification" && verificationEvidence && succeeded) next.evidence.verificationToolCalls += 1;
  next.updatedAt = nowIso(now);
  return next;
}

export function recordForegroundArtifacts(state, paths = [], now = Date.now()) {
  const next = restoreForegroundTask(state);
  if (!next) return state;
  next.evidence.artifacts = [...new Set([...next.evidence.artifacts, ...(Array.isArray(paths) ? paths.map(String) : [])])].slice(-100);
  next.updatedAt = nowIso(now);
  return next;
}

function repeatedCallCount(state) {
  let previousKey = null;
  let current = 0;
  let longest = 0;
  for (const call of state.evidence.calls) {
    const key = `${call.toolName}:${call.argsHash}:${call.resultHash}`;
    current = key === previousKey ? current + 1 : 1;
    previousKey = key;
    longest = Math.max(longest, current);
  }
  return longest;
}

function dynamicUpgradeReasons(state, runtime = {}) {
  const reasons = [];
  if (runtime.plan && Number(runtime.plan.totalSteps) > Number(runtime.plan.completedSteps || 0)) reasons.push("active-plan");
  if (runtime.budgetForcedSummary === true) reasons.push("tool-window-exhausted");
  const pendingChars = Number(runtime.contextStatus?.pendingChars || 0);
  if (pendingChars >= LARGE_CONTEXT_CHARS || state.evidence.totalToolResultChars >= LARGE_TOOL_RESULT_CHARS) reasons.push("large-context-input");
  if (state.evidence.totalToolCalls >= 6) reasons.push("long-tool-chain");
  if (repeatedCallCount(state) >= 3) reasons.push("repeated-no-progress");
  return [...new Set(reasons)];
}

function syncRuntimePlan(state, plan) {
  if (!plan?.steps?.length) return state;
  return recordForegroundPlan(state, plan);
}

function nextStep(state) {
  if (!state.workPlan) return null;
  const completed = new Set(state.workPlan.completedStepIds);
  return state.workPlan.steps.find((step) => !completed.has(step.id)) ?? null;
}

function settleStepWindow(state, now = Date.now()) {
  if (
    state.dispatch.currentPhase !== "step"
    || !state.dispatch.currentStepId
    || state.dispatch.windowOpen !== true
  ) return state;
  const stepId = state.dispatch.currentStepId;
  const novelCallCount = Math.max(
    0,
    state.evidence.novelProgressCount - state.dispatch.baselineNovelProgressCount,
  );
  const artifactCount = Math.max(0, state.evidence.artifacts.length - state.dispatch.baselineArtifactCount);
  const madeProgress = novelCallCount > 0 || artifactCount > 0;
  state.dispatch.stepNoProgressStreak[stepId] = madeProgress
    ? 0
    : Number(state.dispatch.stepNoProgressStreak[stepId] || 0) + 1;
  state.dispatch.lastWindow = {
    stepId,
    madeProgress,
    novelCallCount,
    artifactCount,
    settledAt: nowIso(now),
  };
  state.dispatch.windowOpen = false;
  return state;
}

function closeStepWindowWithoutPenalty(state) {
  if (state.dispatch.currentPhase === "step") state.dispatch.windowOpen = false;
  return state;
}

function missingStepCheckpointIds(state) {
  return (state.workPlan?.completedStepIds ?? [])
    .filter((stepId) => !state.checkpoints.steps[stepId]);
}

export function evaluateForegroundTask(state, runtime = {}) {
  let next = restoreForegroundTask(state);
  if (!next) return { state, decision: { type: "none", reason: "missing-state" } };
  if (next.lifecycle === "completed") return { state: next, decision: { type: "complete", reason: "already-completed" } };
  if (next.lifecycle === "partial") return { state: next, decision: { type: "partial", reason: "already-partial" } };
  if (next.lifecycle === "stopped") return { state: next, decision: { type: "stopped", reason: "already-stopped" } };
  if (next.lifecycle === "waiting_user") {
    return {
      state: next,
      decision: {
        type: "intervene",
        reason: String(next.blockingReason || "waiting-user"),
      },
    };
  }
  next = syncRuntimePlan(next, runtime.plan);
  if (runtime.aborted === true) {
    next.lifecycle = "stopped";
    return { state: next, decision: { type: "stopped", reason: "aborted" } };
  }

  const modelFailure = normalizeForegroundModelFailure(runtime.modelFailure);
  if (modelFailure?.recoverable === false) {
    closeStepWindowWithoutPenalty(next);
    next.lifecycle = "waiting_user";
    next.blockingReason = "provider-blocked";
    next.blockingFailure = modelFailure;
    next.updatedAt = nowIso(runtime.now);
    return { state: next, decision: { type: "intervene", reason: "provider-blocked", failure: modelFailure } };
  }

  if (next.classification === "simple") {
    const reasons = dynamicUpgradeReasons(next, runtime);
    if (reasons.length === 0) return { state: next, decision: { type: "none", reason: "simple-task" } };
    next.classification = "complex";
    next.lifecycle = "assessing";
    next.acceptance.verificationRequired = true;
    next.upgrade = {
      upgraded: true,
      reasons,
      planningRequired: true,
      inheritedMessageCount: next.inherited.messageCount,
      inheritedToolResultCount: next.inherited.toolResultCount + next.evidence.totalToolCalls,
      at: nowIso(runtime.now),
    };
  }

  const contextNeedsAttention = Number(runtime.contextStatus?.cacheFailureCount || 0) > 0
    || runtime.contextStatus?.requiresIntervention === true;
  if (contextNeedsAttention) {
    closeStepWindowWithoutPenalty(next);
    next.lifecycle = "waiting_user";
    return { state: next, decision: { type: "intervene", reason: "context-input-risk" } };
  }

  next = settleStepWindow(next, runtime.now);

  if (next.acceptance.partialAccepted) {
    if (next.dispatch.verificationAttempts === 0) {
      next.lifecycle = "verifying";
      return { state: next, decision: { type: "verify", reason: "user-accepted-partial" } };
    }
    if (
      (next.acceptance.verificationRequired || next.evidence.mutatingToolCalls > 0)
      && next.evidence.verificationToolCalls <= next.dispatch.baselineVerificationToolCalls
    ) {
      next.lifecycle = "waiting_user";
      return { state: next, decision: { type: "intervene", reason: "verification-evidence-missing" } };
    }
    next.lifecycle = "partial";
    next.updatedAt = nowIso(runtime.now);
    return { state: next, decision: { type: "partial", reason: "user-accepted-partial-verified" } };
  }

  const step = nextStep(next);
  if (step) {
    const noProgressStreak = Number(next.dispatch.stepNoProgressStreak[step.id] || 0);
    if (noProgressStreak >= MAX_STEP_NO_PROGRESS) {
      next.lifecycle = "waiting_user";
      next.blockingReason = "step-no-progress";
      return { state: next, decision: { type: "intervene", reason: "step-no-progress", step } };
    }
    return { state: next, decision: { type: "step", reason: "next-plan-step", step } };
  }

  if (!next.workPlan) {
    if (next.dispatch.planningAttempts >= MAX_PLAN_ATTEMPTS) {
      next.lifecycle = "waiting_user";
      return { state: next, decision: { type: "intervene", reason: "plan-attempts-exhausted" } };
    }
    return { state: next, decision: { type: "plan", reason: next.upgrade?.upgraded ? "runtime-upgrade" : "initial-complex-task" } };
  }

  if (next.dispatch.verificationAttempts === 0) {
    next.lifecycle = "verifying";
    return { state: next, decision: { type: "verify", reason: "plan-complete" } };
  }

  const missingCheckpoints = missingStepCheckpointIds(next);
  if (!next.acceptance.partialAccepted && missingCheckpoints.length > 0) {
    next.lifecycle = "waiting_user";
    next.blockingReason = "step-evidence-missing";
    return { state: next, decision: { type: "intervene", reason: "step-evidence-missing", missingStepIds: missingCheckpoints } };
  }

  const artifactCount = Math.max(
    next.evidence.artifacts.length,
    Number.isFinite(runtime.artifactCount) ? Number(runtime.artifactCount) : 0,
  );
  if (!next.acceptance.partialAccepted && next.acceptance.artifactRequired && artifactCount <= 0) {
    next.lifecycle = "waiting_user";
    return { state: next, decision: { type: "intervene", reason: "artifact-missing" } };
  }
  if (
    (next.acceptance.verificationRequired || next.evidence.mutatingToolCalls > 0)
    && next.evidence.verificationToolCalls <= next.dispatch.baselineVerificationToolCalls
  ) {
    next.lifecycle = "waiting_user";
    return { state: next, decision: { type: "intervene", reason: "verification-evidence-missing" } };
  }
  if (!next.acceptance.partialAccepted && Number(runtime.contextStatus?.pendingCount || 0) > 0 && next.acceptance.completeCoverage) {
    next.lifecycle = "waiting_user";
    return { state: next, decision: { type: "intervene", reason: "source-coverage-pending" } };
  }
  next.lifecycle = "completed";
  next.updatedAt = nowIso(runtime.now);
  return { state: next, decision: { type: "complete", reason: "acceptance-passed" } };
}

export function beginForegroundDispatch(state, decision = {}, now = Date.now()) {
  const next = restoreForegroundTask(state);
  if (!next) return state;
  if (decision.type === "plan") {
    next.dispatch.planningAttempts += 1;
    next.dispatch.currentPhase = "planning";
    next.dispatch.currentStepId = null;
  } else if (decision.type === "step" && decision.step?.id) {
    const stepId = String(decision.step.id);
    next.dispatch.stepNoProgressStreak[stepId] = Number(next.dispatch.stepNoProgressStreak[stepId] || 0);
    next.dispatch.currentPhase = "step";
    next.dispatch.currentStepId = stepId;
  } else if (decision.type === "verify") {
    next.dispatch.verificationAttempts += 1;
    next.dispatch.currentPhase = "verification";
    next.dispatch.currentStepId = null;
  }
  next.dispatch.baselineToolCalls = next.evidence.totalToolCalls;
  next.dispatch.baselineArtifactCount = next.evidence.artifacts.length;
  next.dispatch.baselineVerificationToolCalls = next.evidence.verificationToolCalls;
  next.dispatch.baselineNovelProgressCount = next.evidence.novelProgressCount;
  next.dispatch.windowOpen = true;
  next.lifecycle = decision.type === "verify" ? "verifying" : "running";
  next.updatedAt = nowIso(now);
  return next;
}

function evidenceSummary(state) {
  return `继承消息 ${state.inherited.messageCount} 条，既有工具结果 ${state.inherited.toolResultCount} 条，本任务新增工具调用 ${state.evidence.totalToolCalls} 次。`;
}

export function buildForegroundTaskPrompt(state, decision = {}, options = {}) {
  const update = String(options.userUpdate || "").trim();
  const common = [
    "[系统通用复杂任务调度]",
    "继续使用同一个普通模型工具循环；当前对话、工具结果、上下文缓存和已生成文件均已原地继承。",
    "不要重建另一套执行流程，不要重复已经取得的工具结果。",
    evidenceSummary(state),
  ];
  if (decision.type === "plan") {
    const retained = Object.values(state.checkpoints.steps)
      .map((checkpoint) => `${checkpoint.stepId}: ${checkpoint.result}`)
      .join("；");
    common.push(
      `任务目标：${state.goal}`,
      "先利用已有上下文完成必要的只读调查。只有高影响歧义才用 ask_choice 一次询问一个问题。",
      "条件明确后调用 submit_plan，提供稳定步骤 id；不要在计划批准前执行有副作用的操作。",
    );
    if (retained) common.push(`重新规划必须继承的已确认事实：${retained}`);
  } else if (decision.type === "step") {
    const completed = state.workPlan?.completedStepIds?.join(", ") || "无";
    common.push(
      `当前唯一步骤：${decision.step.id} | ${decision.step.title} | ${decision.step.action}`,
      `已完成步骤：${completed}`,
      "只执行并验证当前步骤。完成后调用 mark_step_complete，暂不开始下一步骤；宿主会调度后续步骤。",
    );
  } else if (decision.type === "verify") {
    common.push(
      `任务目标：${state.goal}`,
      "计划步骤已结算。现在只做最终验收：检查实际产物、测试或来源覆盖证据，不要重做已完成步骤。",
      "发现缺口时明确报告事实并修复可安全修复的部分；无法确认时停止并请求用户干预，不得虚假声称完成。",
    );
  }
  if (update) common.push(`用户本轮补充：${update.slice(0, 2000)}`);
  return common.join("\n");
}

export function buildForegroundIntervention(state, decision = {}) {
  const step = decision.step ? `当前步骤“${decision.step.title}”` : "当前复杂任务";
  const reasonText = {
    "step-no-progress": `${step}连续多个执行窗口没有形成新的成功工具证据、产物或检查点。`,
    "plan-attempts-exhausted": "模型多次未能形成可执行计划。",
    "context-input-risk": "输入缓存或未处理输入需要先由用户决定如何处置。",
    "artifact-missing": "计划步骤已经结束，但没有检测到用户要求的实际文件。",
    "verification-evidence-missing": "任务包含写入或外部操作，但最终验收没有产生新的验证证据。",
    "step-evidence-missing": "已有步骤被标记完成，但缺少宿主可确认的步骤检查点，不能进入最终交付。",
    "source-coverage-pending": "仍有来源输入未完成处理，不能按完整结果交付。",
    "plan-persistence-failed": "批准的计划未能可靠保存，因此尚未开始执行步骤。",
    "plan-revision-requested": "当前步骤请求调整计划，需要先确认剩余范围。",
    "provider-blocked": "模型服务当前因鉴权、余额或配额限制无法继续。任务计划、已完成步骤和工具结果均已保留。",
    "waiting-user": `${step}已暂停，正在等待用户决定下一步。`,
  }[decision.reason] || `${step}需要用户确认后才能继续。`;
  if (decision.reason === "provider-blocked") {
    const retryAt = decision.failure?.retryAt || state?.blockingFailure?.retryAt;
    const retryHint = retryAt ? `服务方提示可重试时间：${retryAt}。\n\n` : "";
    const question = `${reasonText}\n\n${retryHint}推荐：切换到可用模型后继续当前步骤。`;
    const options = [
      { id: "switch-model", title: "保留任务并切换模型（推荐）", summary: "先在主界面切换模型，再发送“继续”；不会消耗新的步骤尝试次数。" },
      { id: "wait", title: "稍后再继续", summary: "保持暂停，不消耗新的步骤尝试次数。" },
      { id: "accept-partial", title: "接受部分结果", summary: "验证并保留当前成果，明确标记未完成范围。" },
      { id: "stop", title: "停止并保留现场", summary: "停止执行，保留计划、上下文和现有产物。" },
    ];
    return { kind: "choice", question, options, allowCustom: true, payload: { question, options, allowCustom: true } };
  }
  const question = `${reasonText}\n\n推荐：保留现有上下文和工具结果，从当前步骤继续。`;
  const options = [
    { id: "continue", title: "继续当前步骤（推荐）", summary: "保留已有成果，只重置当前步骤的尝试预算。" },
    { id: "revise", title: "调整剩余计划", summary: "保留已完成步骤，重新规划尚未完成部分。" },
    { id: "accept-partial", title: "接受部分结果", summary: "保留当前成果，并明确标记未完成范围。" },
    { id: "stop", title: "停止并保留现场", summary: "停止执行，保留上下文、计划和证据供后续恢复。" },
  ];
  return { kind: "choice", question, options, allowCustom: true, payload: { question, options, allowCustom: true } };
}

export function applyForegroundIntervention(state, choice, decision = {}, now = Date.now()) {
  const next = restoreForegroundTask(state);
  if (!next) return state;
  const selected = String(choice || "stop");
  if (selected === "continue") {
    if (decision.step?.id) next.dispatch.stepNoProgressStreak[decision.step.id] = 0;
    else if (decision.reason === "step-no-progress" && next.dispatch.currentStepId) {
      next.dispatch.stepNoProgressStreak[next.dispatch.currentStepId] = 0;
    }
    else if (decision.reason === "plan-attempts-exhausted") next.dispatch.planningAttempts = 0;
    else next.dispatch.verificationAttempts = 0;
    next.lifecycle = "running";
  } else if (selected === "wait" || selected === "switch-model") {
    next.lifecycle = "waiting_user";
  } else if (selected === "revise") {
    next.dispatch.planningAttempts = 0;
    next.revision = {
      previousPlan: clone(next.workPlan),
      requestedAt: nowIso(now),
    };
    next.workPlan = null;
    next.lifecycle = "assessing";
  } else if (selected === "accept-partial") {
    next.acceptance.partialAccepted = true;
    next.dispatch.verificationAttempts = 0;
    next.lifecycle = "verifying";
  } else {
    next.lifecycle = "stopped";
  }
  if (selected !== "wait" && selected !== "switch-model") {
    delete next.blockingReason;
    delete next.blockingFailure;
  }
  next.updatedAt = nowIso(now);
  return next;
}

export function pauseForegroundTask(state, reason = "waiting-user", now = Date.now()) {
  const next = restoreForegroundTask(state);
  if (!next) return state;
  next.lifecycle = "waiting_user";
  next.blockingReason = String(reason || "waiting-user");
  next.updatedAt = nowIso(now);
  return next;
}

export function finishForegroundTask(state, lifecycle = "completed", now = Date.now()) {
  const next = restoreForegroundTask(state);
  if (!next) return state;
  next.lifecycle = new Set(["completed", "partial", "stopped", "waiting_user"]).has(lifecycle) ? lifecycle : "completed";
  next.updatedAt = nowIso(now);
  return next;
}

export function foregroundStepBoundaryMessage(state, result, args = {}) {
  if (state?.classification !== "complex") return null;
  let parsed = null;
  try { parsed = typeof result === "string" ? JSON.parse(result) : result; } catch { return null; }
  if (parsed?.kind !== "step_completed") return null;
  const stepId = String(args.stepId || parsed.stepId || "").trim();
  return stepId ? `[系统步骤检查点] ${stepId} 已记录，宿主正在判断下一步骤或最终验收。` : null;
}
