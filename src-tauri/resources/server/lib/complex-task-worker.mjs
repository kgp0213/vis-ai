import { randomUUID } from "node:crypto";

import { validateUnitResult } from "./complex-task-contracts.mjs";
import { workPlanUnitPlans } from "./complex-task-plan.mjs";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 120_000;
const DEFAULT_LEASE_TTL_MS = 60_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 20_000;
const CONTROL_DRAIN_GRACE_MS = 1_000;
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
  if (task?.workPlan) return workPlanUnitPlans(task.workPlan);
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

async function runWithTimeout(callback, timeoutMs, controlSignal = null) {
  if (controlSignal?.aborted) throw controlStopError(controlSignal.reason);
  const controller = new AbortController();
  let timer;
  let settled = false;
  let removeControlListener = null;
  let stoppedByControl = false;
  const operation = Promise.resolve().then(() => callback(controller.signal));
  operation.catch(() => {});
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (settled) return;
      controller.abort(timeoutError(timeoutMs));
      reject(timeoutError(timeoutMs));
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
  } finally {
    settled = true;
    clearTimeout(timer);
    removeControlListener?.();
    controller.abort();
    if (stoppedByControl) {
      let drainTimer;
      const drain = new Promise((resolveDrain) => {
        drainTimer = setTimeout(resolveDrain, CONTROL_DRAIN_GRACE_MS);
        drainTimer.unref?.();
      });
      await Promise.race([operation.catch(() => {}), drain]);
      clearTimeout(drainTimer);
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

function createHeartbeat({ store, taskId, owner, guard, leaseTtlMs, intervalMs, now }) {
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
    inFlight = (async () => {
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
    })();
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

  async function runOne(id, _parentOptions = {}) {
    const runOptions = _parentOptions && typeof _parentOptions === "object" ? _parentOptions : {};
    const controlSignal = controlSignalFrom(runOptions);
    let task = await store.read(id);
    if (stopRequested(runOptions)) return { status: "stopped", reason: "control-signal", task };
    if (task.lifecycle !== "queued") return { status: "not-runnable", reason: `lifecycle-${task.lifecycle}`, task };
    if (!runnablePlan(task)) {
      if (allUnitsResolved(task)) return { status: "ready_for_assembly", task };
    }
    const lease = await store.acquireLease(task.id, { expectedRevision: task.revision, owner, ttlMs: leaseTtlMs, now: now() });
    if (!lease.ok) return { status: "not-claimed", reason: lease.reason, task: lease.task || task };
    const guard = { leaseId: lease.leaseId, epochId: Number(lease.epoch), revision: lease.task.revision };
    task = lease.task;
    const releaseForControl = async () => {
      const current = await store.read(task.id).catch(() => task);
      if (current.lifecycle !== "running" || !current.lease) return { status: "stopped", reason: "control-signal", task: current };
      const released = await store.releaseLease(task.id, {
        expectedRevision: current.revision,
        leaseId: current.lease.leaseId,
        epoch: current.lease.epoch,
        owner,
        now: now(),
      });
      return { status: "stopped", reason: "control-signal", task: released.task || current };
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
    const heartbeat = createHeartbeat({ store, taskId: task.id, owner, guard, leaseTtlMs, intervalMs: heartbeatIntervalMs, now });
    let heartbeatHalted = false;
    const haltHeartbeat = async () => {
      if (heartbeatHalted) return;
      heartbeatHalted = true;
      await heartbeat.stop();
    };
    const executionStartedAt = timestamp(task.executionStartedAt, number(now(), Date.now()));
    const limit = Math.max(1, Math.min(number(options.maxAttempts, DEFAULT_MAX_ATTEMPTS), number(task.contract?.executionLimits?.attemptLimit, DEFAULT_MAX_ATTEMPTS)));
    const wallClockMs = Math.max(1, number(options.wallClockMs, task.contract?.executionLimits?.wallClockMs ?? 3_600_000));
    const attemptTimeoutMs = Math.max(1, number(options.attemptTimeoutMs, DEFAULT_ATTEMPT_TIMEOUT_MS));
    const diagnostics = { category: "model-output-invalid", attempts: [] };
    let accepted = null;
    let pendingRequest = null;
    let controlStopped = false;
    let lastAttemptId = null;
    try {
      const effectResolution = effectResolutionFor(task, plan);
      if (effectResolution) {
        if (typeof toolBroker.resolveEffect !== "function") {
          throw Object.assign(new Error("host tool broker cannot resolve the pending external effect"), { code: "EFFECT_RESOLUTION_UNAVAILABLE" });
        }
        await toolBroker.resolveEffect(effectResolution.effectId, { action: effectResolution.action });
      }
      for (let attempt = 1; attempt <= limit; attempt += 1) {
        if (stopRequested(runOptions)) {
          controlStopped = true;
          break;
        }
        if (heartbeat.failure) return { status: "superseded", reason: heartbeat.failure, task: await store.read(task.id) };
        const elapsedMs = Math.max(0, number(now(), Date.now()) - executionStartedAt);
        const remainingWallClockMs = wallClockMs - elapsedMs;
        if (remainingWallClockMs <= 0) {
          diagnostics.category = "attempt-timeout";
          diagnostics.attempts.push({ attempt, category: "attempt-timeout", message: `task wall clock exceeded ${wallClockMs}ms`, rawResponse: "" });
          break;
        }
        const attemptId = `${owner}:${task.id}:${plan.unitId}:${attempt}:${randomUUID()}`;
        lastAttemptId = attemptId;
        let interaction = null;
        let toolCallIndex = 0;
        const invokeBoundTool = async (name, args, context = {}) => {
          const callIndex = toolCallIndex;
          toolCallIndex += 1;
          const response = await toolBroker.invoke(name, args, {
            ...context,
            taskId: task.id,
            unitId: plan.unitId,
            attemptId,
            leaseId: guard.leaseId,
            epochId: guard.epochId,
            effectKey: context.effectKey || `${plan.unitId}:call:${callIndex}:${name}`,
          });
          if (response?.kind === "user_input_request") interaction = response;
          return response;
        };
        try {
          const raw = await runWithTimeout((signal) => executeUnit({
            task: clone(task),
            unitPlan: clone(plan),
            attempt,
            attemptId,
            signal,
            tools: { invoke: invokeBoundTool },
            invokeTool: invokeBoundTool,
          }), Math.max(1, Math.min(attemptTimeoutMs, remainingWallClockMs)), controlSignal);
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
          const category = code === "attempt_timeout" ? "attempt-timeout" : code.includes("balance") ? "insufficient_balance" : code.includes("auth") ? "authentication" : code.includes("quota") ? "quota" : "model-error";
          diagnostics.category = category;
          diagnostics.attempts.push({ attempt, category, message: errorMessage(error), code, rawResponse: "" });
          if (["insufficient_balance", "authentication", "quota"].includes(category)) break;
        }
      }

      if (!accepted && !controlStopped) {
        const recoverUnit = typeof options.recoverUnit === "function"
          ? options.recoverUnit
          : typeof runOptions.adapter?.recoverUnit === "function" ? runOptions.adapter.recoverUnit.bind(runOptions.adapter)
            : typeof options.adapter?.recoverUnit === "function" ? options.adapter.recoverUnit.bind(options.adapter) : null;
        if (recoverUnit) {
          const recoveryAttemptId = `recovery:${owner}:${task.id}:${plan.unitId}:${randomUUID()}`;
          lastAttemptId = recoveryAttemptId;
          try {
            const recoveredRaw = await runWithTimeout((signal) => recoverUnit({
              task: clone(task),
              unitPlan: clone(plan),
              diagnostics: clone(diagnostics),
              attemptId: recoveryAttemptId,
              signal,
            }), attemptTimeoutMs, controlSignal);
            const recovered = recoveredRaw?.ok === true && recoveredRaw.value ? recoveredRaw.value : recoveredRaw;
            const parsed = parseModelResponse(recovered, plan, recoveryAttemptId);
            if (parsed.ok) {
              accepted = parsed.value;
              diagnostics.recoveredBy = "adapter";
            } else {
              diagnostics.attempts.push({ attempt: "recovery", category: "fallback-invalid", message: parsed.errors?.join("; ") || "adapter recovery did not return a UnitResult", rawResponse: parsed.rawResponse });
            }
          } catch (error) {
            if (errorCode(error) === "task_control_stopped" || stopRequested(runOptions)) controlStopped = true;
            else diagnostics.attempts.push({ attempt: "recovery", category: "fallback-error", message: errorMessage(error), code: errorCode(error), rawResponse: "" });
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
