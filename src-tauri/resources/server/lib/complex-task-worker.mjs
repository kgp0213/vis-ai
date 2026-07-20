import { randomUUID } from "node:crypto";

import { validateUnitResult } from "./complex-task-contracts.mjs";
import { workPlanUnitPlans } from "./complex-task-plan.mjs";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 120_000;
const DEFAULT_LEASE_TTL_MS = 60_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 20_000;
const DEFAULT_ATTEMPT_DRAIN_GRACE_MS = 1_000;
const RAW_RESPONSE_LIMIT = 16_000;
const SUCCESS_UNIT_STATES = new Set(["completed", "skipped", "needs_review"]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function timestamp(value, fallback) {
  const parsed = typeof value === "number" ? value : Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeRaw(value) {
  let output;
  if (typeof value === "string") output = value;
  else {
    try { output = JSON.stringify(value); } catch { output = String(value); }
  }
  return String(output ?? "").slice(0, RAW_RESPONSE_LIMIT);
}

function errorMessage(error) {
  return text(error?.message) || String(error ?? "unknown worker error");
}

function errorCode(error) {
  return text(error?.code).toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
}

function stripCodeFence(value) {
  const source = text(value);
  const match = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : source;
}

function parseModelResponse(raw, unitPlan, attemptId) {
  if (raw && typeof raw === "object" && raw.kind === "user_input_request") {
    return { ok: false, category: "user-input-request", request: clone(raw), rawResponse: safeRaw(raw) };
  }
  if (raw === null || raw === undefined || (typeof raw === "string" && !text(raw))) {
    return { ok: false, category: "empty-output", rawResponse: safeRaw(raw) };
  }

  let candidate = raw;
  if (typeof candidate === "string") {
    const source = stripCodeFence(candidate);
    try { candidate = JSON.parse(source); } catch {
      return {
        ok: false,
        category: /(?:tool_call|tool_calls|write_file|append_file|edit_file|function\s*[:{])/i.test(source) ? "tool-style-output" : "malformed-output",
        rawResponse: safeRaw(raw),
      };
    }
  }
  if (candidate && typeof candidate === "object" && candidate.unitResult && typeof candidate.unitResult === "object") candidate = candidate.unitResult;
  if (candidate && typeof candidate === "object" && (candidate.tool_calls || candidate.tool_call || candidate.name && candidate.arguments !== undefined)) {
    return { ok: false, category: "tool-style-output", rawResponse: safeRaw(raw) };
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { ok: false, category: "invalid-structured-output", rawResponse: safeRaw(raw) };
  }

  const normalized = {
    ...clone(candidate),
    unitId: candidate.unitId || unitPlan.unitId,
    attemptId: candidate.attemptId || attemptId,
  };
  const validation = validateUnitResult(normalized, { unitPlan });
  if (!validation.ok) return { ok: false, category: "invalid-structured-output", errors: validation.errors, rawResponse: safeRaw(raw) };
  return { ok: true, value: validation.value, rawResponse: safeRaw(raw) };
}

function taskUnitPlans(task) {
  if (task?.workPlan) return workPlanUnitPlans(task.workPlan, { permissionBoundary: task.contract?.permissions });
  return Array.isArray(task?.unitPlans) ? task.unitPlans : [];
}

function runnablePlan(task) {
  const results = task?.unitResults && typeof task.unitResults === "object" ? task.unitResults : {};
  const plans = taskUnitPlans(task);
  return plans.find((plan) => {
    if (unitIsResolved(plan, results[plan.unitId])) return false;
    return (Array.isArray(plan.dependencies) ? plan.dependencies : []).every((dependency) => unitIsResolved(
      plans.find((candidate) => candidate.unitId === dependency),
      results[dependency],
    ));
  }) || null;
}

function allUnitsResolved(task) {
  const plans = taskUnitPlans(task);
  const results = task?.unitResults && typeof task.unitResults === "object" ? task.unitResults : {};
  return plans.length > 0 && plans.every((plan) => unitIsResolved(plan, results[plan.unitId]));
}

function unitIsResolved(plan, result) {
  const status = text(result?.proposedStatus);
  if (status === "completed" || status === "skipped") return true;
  if (status !== "needs_review") return false;
  const expected = new Set(Array.isArray(plan?.primaryCoverage) ? plan.primaryCoverage : []);
  const actual = new Set(Array.isArray(result?.proposedPrimaryCoverage) ? result.proposedPrimaryCoverage : []);
  return expected.size === actual.size && [...expected].every((coverage) => actual.has(coverage)) && !(result?.missingSourceRanges?.length > 0);
}

function timeoutError(timeoutMs) {
  const error = new Error(`unit attempt exceeded ${timeoutMs}ms`);
  error.code = "ATTEMPT_TIMEOUT";
  error.timeoutMs = timeoutMs;
  return error;
}

function isAbortSignal(value) {
  return Boolean(value && typeof value === "object" && typeof value.aborted === "boolean" && typeof value.addEventListener === "function");
}

function controlStopError(reason = "worker control signal aborted") {
  const error = reason instanceof Error ? reason : new Error(String(reason || "worker control signal aborted"));
  if (!error.code) error.code = "TASK_CONTROL_STOPPED";
  return error;
}

function controlSignalFrom(input = {}) {
  if (isAbortSignal(input.controlSignal)) return input.controlSignal;
  if (isAbortSignal(input.stopSignal)) return input.stopSignal;
  if (isAbortSignal(input.stop)) return input.stop;
  return null;
}

function stopRequested(input = {}) {
  if (input.stop === true) return true;
  const signal = controlSignalFrom(input);
  return Boolean(signal?.aborted);
}

function effectResolutionFor(task, unitPlan) {
  const resolution = task?.userInputResolution;
  if (!resolution || resolution.reason !== "unknown-effect" || !text(resolution.effectId)) return null;
  if (text(resolution.unitId) && resolution.unitId !== unitPlan.unitId) return null;
  const answer = resolution.answer;
  const action = text(typeof answer === "string" ? answer : answer?.choiceId ?? answer?.action ?? answer?.id).toLowerCase();
  return action ? { effectId: resolution.effectId, action } : null;
}

async function runWithTimeout(callback, timeoutMs, controlSignal = null, options = {}) {
  if (controlSignal?.aborted) throw controlStopError(controlSignal.reason);
  const controller = new AbortController();
  const drainGraceMs = Math.max(0, number(options.drainGraceMs, DEFAULT_ATTEMPT_DRAIN_GRACE_MS));
  let timer;
  let settled = false;
  let operationSettled = false;
  let removeControlListener = null;
  let stoppedByControl = false;
  let timedOut = false;
  let failure = null;
  const operation = Promise.resolve().then(() => callback(controller.signal));
  operation.then(() => { operationSettled = true; }, () => { operationSettled = true; });
  operation.catch(() => {});
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      const reason = timeoutError(timeoutMs);
      controller.abort(reason);
      reject(reason);
    }, timeoutMs);
  });
  const control = controlSignal
    ? new Promise((_, reject) => {
      const abort = () => {
        stoppedByControl = true;
        const reason = controlStopError(controlSignal.reason);
        controller.abort(reason);
        reject(reason);
      };
      removeControlListener = () => controlSignal.removeEventListener("abort", abort);
      if (controlSignal.aborted) abort();
      else controlSignal.addEventListener("abort", abort, { once: true });
    })
    : null;
  try {
    return await Promise.race(control ? [operation, timeout, control] : [operation, timeout]);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    settled = true;
    clearTimeout(timer);
    removeControlListener?.();
    controller.abort();
    if (timedOut || stoppedByControl) {
      let drainTimer;
      if (!operationSettled && drainGraceMs > 0) {
        const drain = new Promise((resolveDrain) => {
          drainTimer = setTimeout(resolveDrain, drainGraceMs);
          drainTimer.unref?.();
        });
        await Promise.race([operation.catch(() => {}), drain]);
        clearTimeout(drainTimer);
      }
      if (failure) {
        failure.terminationConfirmed = operationSettled;
        if (!operationSettled) failure.pendingOperation = operation;
      }
    }
  }
}

function failureDisposition({ task, category, options }) {
  if (typeof options.classifyFailure === "function") {
    const choice = options.classifyFailure({ task, category });
    if (["waiting_user", "blocked", "terminal"].includes(choice)) return choice;
  }
  if (task?.contract?.interactionPolicy?.mode === "never") return "terminal";
  if (["model-output-invalid", "user-input-request", "unknown-effect", "effect-idempotency-conflict"].includes(category)) return "waiting_user";
  return "blocked";
}

function diagnosticMessage(category, details = "") {
  const suffix = details ? `：${details}` : "";
  if (category === "model-output-invalid") return `模型输出无法解析，已保存原始诊断${suffix}`;
  if (category === "attempt-timeout") return `模型处理超过单次时限，已保存当前诊断${suffix}`;
  if (category === "attempt-termination-unconfirmed") return "模型调用超时后未确认已经停止，已暂停自动重试以避免并发执行；请稍后继续，若持续无响应请重启程序";
  if (category === "attempt-budget-exhausted") return `该工作单元的模型尝试次数已达到任务上限；不会因重启或恢复自动增加${suffix}`;
  if (category === "recovery-budget-exhausted") return `该工作单元的宿主恢复次数已达到任务上限；请调整任务或人工处理${suffix}`;
  if (category === "attempt-budget-persistence-failed") return `无法持久保存工作单元的尝试预算，已停止自动重试${suffix}`;
  if (category === "user-input-request") return "模型请求用户补充信息后才能继续";
  if (category === "unknown-effect") return `外部操作结果未知，必须确认后才能继续${suffix}`;
  if (category === "effect-idempotency-conflict") return `同一外部操作标识对应了不同参数，已停止执行${suffix}`;
  return `后台单元处理失败，已保存诊断${suffix}`;
}

function makeFallbackResult(unitPlan, attemptId, status, diagnostics, request = null) {
  const last = diagnostics.attempts.at(-1) || {};
  return {
    unitId: unitPlan.unitId,
    attemptId: attemptId || `degraded-${randomUUID()}`,
    proposedStatus: status,
    artifactRefs: [],
    proposedPrimaryCoverage: [],
    contextRefsUsed: [],
    missingSourceRanges: [...unitPlan.primaryCoverage],
    evidenceRefs: [],
    warnings: [{ code: "WORKER_DEGRADED", message: diagnosticMessage(diagnostics.category, last.message || "") }],
    confidence: 0,
    nextActionProposal: status === "needs_review" ? "request-user-input" : "stop-and-review",
    diagnostics: clone(diagnostics),
    degradedCandidate: {
      kind: "raw-model-output",
      rawResponse: last.rawResponse || "",
      attempts: diagnostics.attempts.length,
    },
    ...(request ? { userInputRequest: clone(request) } : {}),
  };
}

function requiredCoverage(task) {
  return Array.isArray(task?.contract?.completion?.requiredCoverage) ? [...task.contract.completion.requiredCoverage] : [];
}

function outcomeForFailure(task, unitResult, reason) {
  const results = Object.values(task?.unitResults || {});
  const artifacts = results.flatMap((result) => Array.isArray(result?.artifactRefs) ? result.artifactRefs : []);
  const covered = new Set(results.flatMap((result) => Array.isArray(result?.proposedPrimaryCoverage) ? result.proposedPrimaryCoverage : []));
  return {
    schemaVersion: 1,
    taskId: task.id,
    outcome: artifacts.length > 0 ? "partial" : "failed",
    summary: `任务未能完成：${reason}`,
    artifactRefs: [...new Set([...artifacts, ...(unitResult?.artifactRefs || [])])],
    coverage: { required: requiredCoverage(task).length, completed: covered.size, unresolved: requiredCoverage(task).filter((item) => !covered.has(item)) },
    warnings: [{ code: "WORKER_FAILURE", message: reason }],
    blockingReason: reason,
    userAction: null,
    resumable: false,
  };
}

function createHeartbeat({ store, taskId, owner, guard, leaseTtlMs, intervalMs, now, mutate }) {
  let stopped = false;
  let timer = null;
  let inFlight = null;
  let failure = null;
  const schedule = () => {
    if (stopped || failure) return;
    timer = setTimeout(tick, intervalMs);
    timer.unref?.();
  };
  const tick = async () => {
    if (stopped) return;
    const operation = async () => {
      try {
        const result = await store.heartbeat(taskId, {
          expectedRevision: guard.revision,
          leaseId: guard.leaseId,
          epoch: guard.epochId,
          owner,
          ttlMs: leaseTtlMs,
          now: now(),
        });
        if (!result.ok) failure = result.reason || "heartbeat-rejected";
        else guard.revision = result.task.revision;
      } catch (error) {
        failure = `heartbeat-error:${errorMessage(error)}`;
      }
    };
    inFlight = typeof mutate === "function" ? mutate(operation) : operation();
    await inFlight;
    inFlight = null;
    schedule();
  };
  schedule();
  return {
    get failure() { return failure; },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (inFlight) await inFlight;
      return failure;
    },
  };
}

export function createDurableAgentWorker(options = {}) {
  const store = options.store;
  if (!store || typeof store.read !== "function" || typeof store.acquireLease !== "function") throw new TypeError("durable worker requires a complex task store");
  const executeUnit = options.executeUnit ?? options.modelExecutor?.executeUnit;
  if (typeof executeUnit !== "function") throw new TypeError("durable worker requires executeUnit");
  const toolBroker = options.toolBroker ?? options.hostToolBroker ?? { invoke: async () => { throw Object.assign(new Error("host tool broker is unavailable"), { code: "TOOL_NOT_ALLOWED" }); } };
  const owner = text(options.owner) || `worker:${randomUUID()}`;
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const leaseTtlMs = Math.max(10, number(options.leaseTtlMs, DEFAULT_LEASE_TTL_MS));
  const heartbeatIntervalMs = Math.max(1, number(options.heartbeatIntervalMs, Math.min(DEFAULT_HEARTBEAT_INTERVAL_MS, Math.floor(leaseTtlMs / 3))));
  const attemptDrainGraceMs = Math.max(0, number(options.attemptDrainGraceMs, DEFAULT_ATTEMPT_DRAIN_GRACE_MS));
  const lingeringAttempts = new Map();

  const fenceLingeringAttempt = (taskId, operation) => {
    if (!operation || typeof operation.then !== "function") return;
    const fence = { operation };
    lingeringAttempts.set(taskId, fence);
    operation.catch(() => {}).finally(() => {
      if (lingeringAttempts.get(taskId) === fence) lingeringAttempts.delete(taskId);
    });
  };

  async function runOne(id, _parentOptions = {}) {
    const runOptions = _parentOptions && typeof _parentOptions === "object" ? _parentOptions : {};
    const controlSignal = controlSignalFrom(runOptions);
    let task = await store.read(id);
    if (stopRequested(runOptions)) return { status: "stopped", reason: "control-signal", task };
    if (lingeringAttempts.has(task.id)) return { status: "not-runnable", reason: "prior-attempt-still-running", task };
    if (task.lifecycle !== "queued") return { status: "not-runnable", reason: `lifecycle-${task.lifecycle}`, task };
    if (!runnablePlan(task)) {
      if (allUnitsResolved(task)) return { status: "ready_for_assembly", task };
    }
    const lease = await store.acquireLease(task.id, { expectedRevision: task.revision, owner, ttlMs: leaseTtlMs, now: now() });
    if (!lease.ok) return { status: "not-claimed", reason: lease.reason, task: lease.task || task };
    const guard = { leaseId: lease.leaseId, epochId: Number(lease.epoch), revision: lease.task.revision };
    task = lease.task;
    let leaseMutationTail = Promise.resolve();
    const mutateLease = (operation) => {
      const next = leaseMutationTail.catch(() => {}).then(operation);
      leaseMutationTail = next.catch(() => {});
      return next;
    };
    const releaseForControl = async () => {
      // Never re-read the task here: a stopped worker may race with lease
      // recovery and reacquisition by the same owner.  The original guard is
      // the only lease this execution is authorized to release.
      const released = await mutateLease(() => store.releaseLease(task.id, {
        expectedRevision: guard.revision,
        leaseId: guard.leaseId,
        epoch: guard.epochId,
        owner,
        now: now(),
      }));
      return { status: "stopped", reason: "control-signal", task: released.task || task };
    };
    let plan = runnablePlan(task);
    if (stopRequested(runOptions)) {
      const released = await store.releaseLease(task.id, { expectedRevision: guard.revision, leaseId: guard.leaseId, epoch: guard.epochId, owner, now: now() });
      return { status: "stopped", reason: "control-signal", task: released.task || task };
    }
    if (!plan) {
      if (allUnitsResolved(task)) {
        const released = await store.releaseLease(task.id, { expectedRevision: guard.revision, leaseId: guard.leaseId, epoch: guard.epochId, owner, now: now() });
        return released.ok ? { status: "ready_for_assembly", task: released.task } : { status: "superseded", reason: released.reason, task: released.task || task };
      }
      const blocked = await store.transition(task.id, { expectedRevision: guard.revision, lifecycle: "blocked", leaseId: guard.leaseId, epoch: guard.epochId, owner, now: now(), quality: "failed" });
      return blocked.applied ? { status: "blocked", reason: "no-runnable-unit", task: blocked.task } : { status: "superseded", reason: blocked.reason, task: blocked.task || task };
    }
    const started = await store.transition(task.id, { expectedRevision: guard.revision, lifecycle: "running", leaseId: guard.leaseId, epoch: guard.epochId, owner, now: now() });
    if (!started.applied) return { status: "superseded", reason: started.reason, task: started.task || task };
    task = started.task;
    guard.revision = task.revision;
    const heartbeat = createHeartbeat({ store, taskId: task.id, owner, guard, leaseTtlMs, intervalMs: heartbeatIntervalMs, now, mutate: mutateLease });
    let heartbeatHalted = false;
    const haltHeartbeat = async () => {
      if (heartbeatHalted) return;
      heartbeatHalted = true;
      await heartbeat.stop();
    };
    const reportProgress = async (evidence) => {
      if (typeof store.recordProgress !== "function") return { ok: false, reason: "progress-store-unavailable" };
      try {
        return await mutateLease(async () => {
          const recorded = await store.recordProgress(task.id, {
            expectedRevision: guard.revision,
            leaseId: guard.leaseId,
            epoch: guard.epochId,
            owner,
            now: now(),
            evidence,
          });
          if (recorded?.ok) {
            guard.revision = recorded.task.revision;
            task = recorded.task;
          }
          return recorded;
        });
      } catch (error) {
        return { ok: false, reason: "progress-record-failed", message: errorMessage(error) };
      }
    };
    const executionStartedAt = timestamp(task.executionStartedAt, number(now(), Date.now()));
    // The contract limit is the durable per-unit model budget across all
    // execution epochs. `maxAttempts` only bounds work done in this run.
    const modelBudgetLimit = Math.max(1, Math.floor(number(task.contract?.executionLimits?.attemptLimit, DEFAULT_MAX_ATTEMPTS)));
    const runAttemptLimit = Math.max(1, Math.floor(number(options.maxAttempts, DEFAULT_MAX_ATTEMPTS)));
    const recoveryBudgetLimit = Math.max(1, Math.floor(number(options.maxRecoveryAttempts, 1)));
    const wallClockMs = Math.max(1, number(options.wallClockMs, task.contract?.executionLimits?.wallClockMs ?? 3_600_000));
    const attemptTimeoutMs = Math.max(1, number(options.attemptTimeoutMs, DEFAULT_ATTEMPT_TIMEOUT_MS));
    const diagnostics = { category: "model-output-invalid", attempts: [] };
    let accepted = null;
    let pendingRequest = null;
    let controlStopped = false;
    let terminationUnconfirmed = false;
    let lastAttemptId = null;
    const reserveAttempt = async (kind, attemptId, limit) => {
      if (typeof store.reserveUnitAttempt !== "function") {
        return { ok: false, reason: "attempt-budget-persistence-failed", message: "attempt reservation API unavailable" };
      }
      try {
        return await mutateLease(async () => {
          const reserved = await store.reserveUnitAttempt(task.id, {
            expectedRevision: guard.revision,
            leaseId: guard.leaseId,
            epoch: guard.epochId,
            owner,
            now: now(),
            unitId: plan.unitId,
            kind,
            attemptId,
            limit,
          });
          if (reserved?.ok && reserved.task) {
            guard.revision = reserved.task.revision;
            task = reserved.task;
          }
          return reserved;
        });
      } catch (error) {
        return { ok: false, reason: "attempt-budget-persistence-failed", message: errorMessage(error) };
      }
    };
    try {
      const effectResolution = effectResolutionFor(task, plan);
      if (effectResolution) {
        if (typeof toolBroker.resolveEffect !== "function") {
          throw Object.assign(new Error("host tool broker cannot resolve the pending external effect"), { code: "EFFECT_RESOLUTION_UNAVAILABLE" });
        }
        await toolBroker.resolveEffect(effectResolution.effectId, { action: effectResolution.action });
      }
      for (let runAttempt = 1; runAttempt <= runAttemptLimit; runAttempt += 1) {
        if (stopRequested(runOptions)) {
          controlStopped = true;
          break;
        }
        if (heartbeat.failure) return { status: "superseded", reason: heartbeat.failure, task: await store.read(task.id) };
        const elapsedMs = Math.max(0, number(now(), Date.now()) - executionStartedAt);
        const remainingWallClockMs = wallClockMs - elapsedMs;
        if (remainingWallClockMs <= 0) {
          diagnostics.category = "attempt-timeout";
          diagnostics.attempts.push({ attempt: runAttempt, category: "attempt-timeout", message: `task wall clock exceeded ${wallClockMs}ms`, rawResponse: "" });
          break;
        }
        const priorModelAttempts = Math.max(0, Math.floor(Number(task.attemptBudget?.units?.[plan.unitId]?.modelAttempts) || 0));
        const attemptId = `${owner}:${task.id}:${plan.unitId}:${priorModelAttempts + 1}:${randomUUID()}`;
        const reservation = await reserveAttempt("model", attemptId, modelBudgetLimit);
        if (!reservation?.ok) {
          if (reservation?.reason === "model-budget-exhausted") {
            diagnostics.category = "attempt-budget-exhausted";
            diagnostics.attempts.push({ attempt: "budget", category: diagnostics.category, message: diagnosticMessage(diagnostics.category), rawResponse: "" });
          } else {
            diagnostics.category = "attempt-budget-persistence-failed";
            diagnostics.attempts.push({ attempt: "budget", category: diagnostics.category, message: reservation?.message || reservation?.reason || diagnosticMessage(diagnostics.category), rawResponse: "" });
          }
          break;
        }
        const attempt = Number(reservation.used) || priorModelAttempts + 1;
        lastAttemptId = attemptId;
        await reportProgress({ kind: "unit-started", unitId: plan.unitId, attemptId, coverage: plan.primaryCoverage });
        let interaction = null;
        let toolCallIndex = 0;
        let attemptSignal = null;
        const reportAttemptProgress = async (evidence) => {
          if (attemptSignal?.aborted) return { ok: false, reason: "attempt-fenced" };
          return reportProgress(evidence);
        };
        const invokeBoundTool = async (name, args, context = {}) => {
          if (attemptSignal?.aborted) {
            const error = new Error(`attempt ${attemptId} is no longer active`);
            error.code = "ATTEMPT_FENCED";
            throw error;
          }
          const callIndex = toolCallIndex;
          toolCallIndex += 1;
          await reportAttemptProgress({ kind: "tool-call-started", unitId: plan.unitId, attemptId, message: String(name) });
          const response = await toolBroker.invoke(name, args, {
            ...context,
            taskId: task.id,
            unitId: plan.unitId,
            attemptId,
            leaseId: guard.leaseId,
            epochId: guard.epochId,
            effectKey: context.effectKey || `${plan.unitId}:call:${callIndex}:${name}`,
          });
          if (attemptSignal?.aborted) {
            const error = new Error(`attempt ${attemptId} ended while host operation ${name} was running`);
            error.code = "ATTEMPT_FENCED";
            throw error;
          }
          await reportAttemptProgress({ kind: "tool-call-completed", unitId: plan.unitId, attemptId, message: String(name) });
          if (response?.kind === "user_input_request") interaction = response;
          return response;
        };
        try {
          const raw = await runWithTimeout((signal) => {
            attemptSignal = signal;
            return executeUnit({
              task: clone(task),
              unitPlan: clone(plan),
              attempt,
              attemptId,
              signal,
              tools: { invoke: invokeBoundTool },
              invokeTool: invokeBoundTool,
              reportProgress: reportAttemptProgress,
            });
          }, Math.max(1, Math.min(attemptTimeoutMs, remainingWallClockMs)), controlSignal, { drainGraceMs: attemptDrainGraceMs });
          await reportProgress({ kind: "model-output", unitId: plan.unitId, attemptId });
          if (interaction) {
            pendingRequest = interaction;
            diagnostics.category = "user-input-request";
            diagnostics.attempts.push({ attempt, category: "user-input-request", message: interaction.question || interaction.reason || "user input required", rawResponse: safeRaw(raw) });
            break;
          }
          const parsed = parseModelResponse(raw, plan, attemptId);
          if (parsed.ok) {
            accepted = parsed.value;
            break;
          }
          diagnostics.category = parsed.category === "user-input-request" ? "user-input-request" : "model-output-invalid";
          diagnostics.attempts.push({ attempt, category: parsed.category, message: parsed.errors?.join("; ") || parsed.request?.question || "model response is not a UnitResult", rawResponse: parsed.rawResponse });
          if (parsed.request) { pendingRequest = parsed.request; break; }
        } catch (error) {
          if (error?.terminationConfirmed === false) {
            fenceLingeringAttempt(task.id, error.pendingOperation);
            terminationUnconfirmed = true;
          }
          if (errorCode(error) === "task_control_stopped" || stopRequested(runOptions)) {
            controlStopped = true;
            break;
          }
          const code = errorCode(error);
          if (code === "effect_confirmation_required") {
            const effect = error?.effect && typeof error.effect === "object" ? clone(error.effect) : {};
            pendingRequest = {
              kind: "user_input_request",
              requestId: `request:${effect.effectId || randomUUID()}`,
              taskId: task.id,
              reason: "unknown-effect",
              question: `外部操作 ${effect.operation || "未知操作"} 可能已经执行。为避免重复操作，请确认处理方式。`,
              choices: [
                { id: "mark-confirmed", label: "已执行，继续" },
                { id: "retry", label: "确认未执行，重试" },
              ],
              effectId: effect.effectId || null,
              operation: effect.operation || null,
              unitId: plan.unitId,
            };
            diagnostics.category = "unknown-effect";
            diagnostics.attempts.push({ attempt, category: "unknown-effect", message: errorMessage(error), code, rawResponse: "", effectId: effect.effectId || null });
            break;
          }
          if (code === "effect_idempotency_conflict") {
            const effect = error?.effect && typeof error.effect === "object" ? clone(error.effect) : {};
            pendingRequest = {
              kind: "user_input_request",
              requestId: `request:${effect.effectId || randomUUID()}:conflict`,
              taskId: task.id,
              reason: "effect-idempotency-conflict",
              question: `外部操作 ${effect.operation || "未知操作"} 的参数与已记录操作不一致，任务已暂停以避免误操作。`,
              choices: [{ id: "cancel", label: "停止任务" }],
              effectId: effect.effectId || null,
              operation: effect.operation || null,
            };
            diagnostics.category = "effect-idempotency-conflict";
            diagnostics.attempts.push({ attempt, category: "effect-idempotency-conflict", message: errorMessage(error), code, rawResponse: "", effectId: effect.effectId || null });
            break;
          }
          const category = terminationUnconfirmed ? "attempt-termination-unconfirmed" : code === "attempt_timeout" ? "attempt-timeout" : code.includes("balance") ? "insufficient_balance" : code.includes("auth") ? "authentication" : code.includes("quota") ? "quota" : "model-error";
          diagnostics.category = category;
          diagnostics.attempts.push({ attempt, category, message: category === "attempt-termination-unconfirmed" ? diagnosticMessage(category) : errorMessage(error), code, rawResponse: "" });
          if (terminationUnconfirmed || ["insufficient_balance", "authentication", "quota"].includes(category)) break;
        }
      }

      if (!accepted && !controlStopped && !terminationUnconfirmed) {
        const recoverUnit = typeof options.recoverUnit === "function"
          ? options.recoverUnit
          : typeof runOptions.adapter?.recoverUnit === "function" ? runOptions.adapter.recoverUnit.bind(runOptions.adapter)
            : typeof options.adapter?.recoverUnit === "function" ? options.adapter.recoverUnit.bind(options.adapter) : null;
        if (recoverUnit) {
          const recoveryAttemptId = `recovery:${owner}:${task.id}:${plan.unitId}:${randomUUID()}`;
          const remainingBeforeRecoveryMs = wallClockMs - Math.max(0, number(now(), Date.now()) - executionStartedAt);
          if (remainingBeforeRecoveryMs <= 0) {
            diagnostics.category = "attempt-timeout";
            diagnostics.attempts.push({ attempt: "recovery", category: diagnostics.category, message: `task wall clock exceeded ${wallClockMs}ms before recovery`, rawResponse: "" });
          } else {
            const reservation = await reserveAttempt("recovery", recoveryAttemptId, recoveryBudgetLimit);
            if (!reservation?.ok) {
              if (reservation?.reason === "recovery-budget-exhausted") {
                diagnostics.category = "recovery-budget-exhausted";
                diagnostics.attempts.push({ attempt: "recovery-budget", category: diagnostics.category, message: diagnosticMessage(diagnostics.category), rawResponse: "" });
              } else {
                diagnostics.category = "attempt-budget-persistence-failed";
                diagnostics.attempts.push({ attempt: "recovery-budget", category: diagnostics.category, message: reservation?.message || reservation?.reason || diagnosticMessage(diagnostics.category), rawResponse: "" });
              }
            } else {
              const remainingAfterReservationMs = wallClockMs - Math.max(0, number(now(), Date.now()) - executionStartedAt);
              if (remainingAfterReservationMs <= 0) {
                diagnostics.category = "attempt-timeout";
                diagnostics.attempts.push({ attempt: "recovery", category: diagnostics.category, message: `task wall clock exceeded ${wallClockMs}ms before recovery`, rawResponse: "" });
              } else {
                lastAttemptId = recoveryAttemptId;
                try {
                  const recoveredRaw = await runWithTimeout((signal) => recoverUnit({
                    task: clone(task),
                    unitPlan: clone(plan),
                    diagnostics: clone(diagnostics),
                    attemptId: recoveryAttemptId,
                    signal,
                    reportProgress: (evidence) => signal.aborted
                      ? { ok: false, reason: "attempt-fenced" }
                      : reportProgress(evidence),
                  }), Math.max(1, Math.min(attemptTimeoutMs, remainingAfterReservationMs)), controlSignal, { drainGraceMs: attemptDrainGraceMs });
                  const recovered = recoveredRaw?.ok === true && recoveredRaw.value ? recoveredRaw.value : recoveredRaw;
                  const parsed = parseModelResponse(recovered, plan, recoveryAttemptId);
                  if (parsed.ok) {
                    accepted = parsed.value;
                    diagnostics.recoveredBy = "adapter";
                  } else {
                    diagnostics.attempts.push({ attempt: "recovery", category: "fallback-invalid", message: parsed.errors?.join("; ") || "adapter recovery did not return a UnitResult", rawResponse: parsed.rawResponse });
                  }
                } catch (error) {
                  if (error?.terminationConfirmed === false) {
                    fenceLingeringAttempt(task.id, error.pendingOperation);
                    terminationUnconfirmed = true;
                  }
                  if (errorCode(error) === "task_control_stopped" || stopRequested(runOptions)) controlStopped = true;
                  else {
                    const category = terminationUnconfirmed ? "attempt-termination-unconfirmed" : errorCode(error) === "attempt_timeout" ? "attempt-timeout" : "fallback-error";
                    diagnostics.category = category;
                    diagnostics.attempts.push({ attempt: "recovery", category, message: category === "attempt-termination-unconfirmed" ? diagnosticMessage(category) : errorMessage(error), code: errorCode(error), rawResponse: "" });
                  }
                }
              }
            }
          }
        }
      }

      await haltHeartbeat();
      if (controlStopped || stopRequested(runOptions)) return await releaseForControl();
      if (heartbeat.failure) return { status: "superseded", reason: heartbeat.failure, task: await store.read(task.id) };
      if (accepted) {
        const checkpoint = await store.checkpointUnit(task.id, accepted, { expectedRevision: guard.revision, leaseId: guard.leaseId, epoch: guard.epochId, owner, now: now() });
        if (!checkpoint.applied) return { status: "superseded", reason: checkpoint.reason, task: checkpoint.task || await store.read(task.id) };
        task = checkpoint.task;
        guard.revision = task.revision;
        if (accepted.proposedStatus === "needs_review") {
          const waiting = await store.transition(task.id, { expectedRevision: guard.revision, lifecycle: "waiting_user", leaseId: guard.leaseId, epoch: guard.epochId, owner, now: now(), quality: "needs_review", blockingReason: { code: "UNIT_NEEDS_REVIEW", message: accepted.warnings?.[0]?.message || "单元结果需要用户复核。" }, userInputRequest: accepted.userInputRequest || null });
          return waiting.applied ? { status: "waiting_user", reason: "unit-needs-review", task: waiting.task, unitResult: accepted } : { status: "superseded", reason: waiting.reason, task: waiting.task || task };
        }
        if (["failed", "blocked"].includes(accepted.proposedStatus)) {
          const blocked = await store.transition(task.id, { expectedRevision: guard.revision, lifecycle: "blocked", leaseId: guard.leaseId, epoch: guard.epochId, owner, now: now(), quality: "failed", blockingReason: { code: "UNIT_REPORTED_FAILURE", message: accepted.warnings?.[0]?.message || "单元报告无法完成。" } });
          return blocked.applied ? { status: "blocked", reason: "unit-reported-failure", task: blocked.task, unitResult: accepted } : { status: "superseded", reason: blocked.reason, task: blocked.task || task };
        }
        const released = await store.releaseLease(task.id, { expectedRevision: guard.revision, leaseId: guard.leaseId, epoch: guard.epochId, owner, now: now() });
        return released.ok ? { status: "unit_completed", task: released.task, unitResult: accepted } : { status: "superseded", reason: released.reason, task: released.task || task };
      }

      const disposition = failureDisposition({ task, category: diagnostics.category, options });
      const fallbackStatus = pendingRequest ? "blocked" : disposition === "waiting_user" ? "needs_review" : disposition === "terminal" ? "failed" : "blocked";
      const fallback = makeFallbackResult(plan, lastAttemptId, fallbackStatus, diagnostics, pendingRequest);
      const checkpoint = await store.checkpointUnit(task.id, fallback, { expectedRevision: guard.revision, leaseId: guard.leaseId, epoch: guard.epochId, owner, now: now() });
      if (!checkpoint.applied) return { status: "superseded", reason: checkpoint.reason, task: checkpoint.task || await store.read(task.id) };
      task = checkpoint.task;
      guard.revision = task.revision;
      if (disposition === "terminal") {
        const assembling = await store.transition(task.id, { expectedRevision: guard.revision, lifecycle: "assembling", leaseId: guard.leaseId, epoch: guard.epochId, owner, now: now(), quality: "failed" });
        if (!assembling.applied) return { status: "superseded", reason: assembling.reason, task: assembling.task || task };
        guard.revision = assembling.task.revision;
        const outcome = outcomeForFailure(assembling.task, fallback, diagnostics.attempts.at(-1)?.message || diagnostics.category);
        const completed = await store.complete(task.id, outcome, { expectedRevision: guard.revision, leaseId: guard.leaseId, epoch: guard.epochId, owner, quality: "failed", now: now() });
        return completed.applied ? { status: "terminal", reason: "bounded-failure", task: completed.task, outcome: completed.task.outcome, unitResult: fallback } : { status: "superseded", reason: completed.reason, task: completed.task || task };
      }
      const lifecycle = disposition === "waiting_user" ? "waiting_user" : "blocked";
      const moved = await store.transition(task.id, { expectedRevision: guard.revision, lifecycle, leaseId: guard.leaseId, epoch: guard.epochId, owner, now: now(), quality: lifecycle === "waiting_user" ? "needs_review" : "failed", blockingReason: { code: diagnostics.category, message: diagnostics.attempts.at(-1)?.message || diagnosticMessage(diagnostics.category) }, userInputRequest: lifecycle === "waiting_user" ? (pendingRequest || fallback.userInputRequest || null) : null });
      return moved.applied ? { status: lifecycle, reason: diagnostics.category, task: moved.task, unitResult: fallback } : { status: "superseded", reason: moved.reason, task: moved.task || task };
    } finally {
      await haltHeartbeat();
    }
  }

  return { owner, runOne };
}
