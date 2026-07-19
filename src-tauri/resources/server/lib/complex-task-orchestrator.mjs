import { randomUUID } from "node:crypto";

const DEFAULT_MAX_CONCURRENCY = 1;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_ASSEMBLY_LEASE_MS = 60_000;
const ACTIVE_LIFECYCLES = new Set(["leased", "running", "assembling"]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function boundedInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function compactError(error) {
  return String(error?.message || error || "unknown task orchestration error").slice(0, 2_000);
}

function adapterRegistry(value) {
  if (value instanceof Map) return new Map(value);
  if (value && typeof value === "object" && !Array.isArray(value)) return new Map(Object.entries(value));
  return new Map();
}

function adapterFor(adapters, task) {
  const type = text(task?.contract?.taskType || task?.taskType || task?.kind);
  if (typeof adapters === "function") return adapters(type, task) ?? null;
  if (adapters && typeof adapters.resolve === "function") return adapters.resolve(type, task) ?? null;
  return adapters.get(type) ?? null;
}

function pinnedEngine(task) {
  const pin = task?.metadata?.complexTaskEngine;
  return pin && typeof pin === "object" && !Array.isArray(pin) ? clone(pin) : null;
}

function unresolvedCoverage(task) {
  const required = Array.isArray(task?.contract?.completion?.requiredCoverage)
    ? task.contract.completion.requiredCoverage.map(String)
    : [];
  const completed = new Set(Object.entries(task?.coverageLedger ?? {})
    .filter(([, entry]) => ["completed", "degraded", "source_fallback"].includes(String(entry?.state ?? "")))
    .map(([coverage]) => coverage));
  return {
    required: required.length,
    completed: required.filter((coverage) => completed.has(coverage)).length,
    unresolved: required.filter((coverage) => !completed.has(coverage)),
  };
}

function artifactRefs(task) {
  return [...new Set(Object.values(task?.unitResults ?? {})
    .flatMap((result) => Array.isArray(result?.artifactRefs) ? result.artifactRefs.map(String) : [])
    .filter(Boolean))];
}

function failedOutcome(task, message, code = "ORCHESTRATION_FAILURE", { forceFailed = false } = {}) {
  const refs = artifactRefs(task);
  return {
    schemaVersion: 1,
    taskId: task.id,
    outcome: forceFailed || refs.length === 0 ? "failed" : "partial",
    summary: `任务未能完成：${message}`,
    artifactRefs: refs,
    coverage: unresolvedCoverage(task),
    warnings: [{ code, message }],
    blockingReason: message,
    userAction: null,
    resumable: true,
  };
}

function assemblyOutcome(task, assembled) {
  if (assembled?.outcome && typeof assembled.outcome === "object") return clone(assembled.outcome);
  const report = assembled?.report && typeof assembled.report === "object" ? assembled.report : {};
  const selectedRefs = Array.isArray(assembled?.selectedArtifacts)
    ? assembled.selectedArtifacts.map((item) => item?.manifest?.artifactId).filter(Boolean)
    : [];
  const committedRefs = Array.isArray(assembled?.artifactRefs) ? assembled.artifactRefs.map(String).filter(Boolean) : [];
  const refs = [...new Set([...artifactRefs(task), ...selectedRefs, ...committedRefs])];
  const complete = assembled?.ok === true;
  const coverage = {
    required: Array.isArray(report.required) ? report.required.length : unresolvedCoverage(task).required,
    completed: Array.isArray(report.covered) ? report.covered.length : unresolvedCoverage(task).completed,
    unresolved: Array.isArray(report.missing) ? [...report.missing] : unresolvedCoverage(task).unresolved,
  };
  const warnings = [];
  if (!complete) warnings.push({ code: "ASSEMBLY_INCOMPLETE", message: "产物装配未通过完整性检查，已保留可用结果。" });
  for (const invalid of Array.isArray(report.invalid) ? report.invalid : []) {
    warnings.push({ code: text(invalid?.code) || "ASSEMBLY_INVALID", message: compactError(invalid?.message || invalid?.code) });
  }
  for (const result of Object.values(task?.unitResults ?? {})) {
    for (const warning of Array.isArray(result?.warnings) ? result.warnings : []) {
      warnings.push({
        code: text(warning?.code || warning?.type) || "UNIT_WARNING",
        message: compactError(warning?.message || warning),
        ...(result?.unitId ? { unitId: result.unitId } : {}),
      });
    }
    if (result?.fallbackKind === "source" && !(result?.warnings ?? []).length) {
      warnings.push({ code: "SOURCE_FALLBACK", message: "部分范围使用了提取原文保底，需要用户复核。", ...(result?.unitId ? { unitId: result.unitId } : {}) });
    }
  }
  const uniqueWarnings = [...new Map(warnings.map((warning) => [`${warning.code}\0${warning.message}\0${warning.unitId || ""}`, warning])).values()];
  return {
    schemaVersion: 1,
    taskId: task.id,
    outcome: complete ? (uniqueWarnings.length ? "delivered_with_warnings" : "delivered") : (refs.length ? "partial" : "failed"),
    summary: complete ? (uniqueWarnings.length ? "任务产物已完成装配，但部分内容需要复核。" : "任务产物已完成装配。") : "任务已收敛，但产物装配不完整。",
    artifactRefs: refs,
    coverage,
    warnings: uniqueWarnings,
    blockingReason: complete ? null : "artifact assembly incomplete",
    userAction: complete ? null : { kind: "review", label: "查看可用产物" },
    resumable: !complete,
  };
}

function pendingAssemblySnapshot(task, assembled) {
  const selectedRefs = Array.isArray(assembled?.selectedArtifacts)
    ? assembled.selectedArtifacts.map((item) => item?.manifest?.artifactId).filter(Boolean)
    : [];
  const explicitRefs = Array.isArray(assembled?.artifactRefs) ? assembled.artifactRefs.map(String).filter(Boolean) : [];
  return {
    schemaVersion: 1,
    taskId: task.id,
    artifactRefs: [...new Set([...artifactRefs(task), ...selectedRefs, ...explicitRefs])],
    report: assembled?.report && typeof assembled.report === "object" ? clone(assembled.report) : null,
    outcome: assembled?.outcome && typeof assembled.outcome === "object" ? clone(assembled.outcome) : null,
  };
}

function normalizeOutcome(task, outcome, fallback) {
  const source = outcome && typeof outcome === "object" ? clone(outcome) : {};
  const coverage = source.coverage && typeof source.coverage === "object"
    ? source.coverage
    : unresolvedCoverage(task);
  const refs = Array.isArray(source.artifactRefs)
    ? source.artifactRefs.map(String).filter(Boolean)
    : artifactRefs(task);
  const kind = ["delivered", "delivered_with_warnings", "partial", "failed", "cancelled", "abandoned"].includes(text(source.outcome))
    ? text(source.outcome)
    : fallback?.outcome || "failed";
  return {
    schemaVersion: 1,
    taskId: task.id,
    outcome: kind,
    summary: text(source.summary) || fallback?.summary || "任务未能完成。",
    artifactRefs: [...new Set(refs)],
    coverage,
    warnings: Array.isArray(source.warnings) ? source.warnings : (fallback?.warnings || []),
    blockingReason: source.blockingReason ?? fallback?.blockingReason ?? null,
    userAction: source.userAction ?? fallback?.userAction ?? null,
    resumable: source.resumable === true,
  };
}

function createLeaseHeartbeat({ store, taskId, guard, owner, ttlMs, intervalMs, signal }) {
  let stopped = false;
  let timer = null;
  let inFlight = null;
  let failure = null;
  if (typeof store.heartbeat !== "function") {
    return { get failure() { return null; }, async stop() {} };
  }
  const schedule = () => {
    if (stopped || failure || signal?.aborted) return;
    timer = setTimeout(tick, intervalMs);
    timer.unref?.();
  };
  const tick = async () => {
    if (stopped || signal?.aborted) return;
    inFlight = (async () => {
      try {
        const result = await store.heartbeat(taskId, {
          expectedRevision: guard.revision,
          leaseId: guard.leaseId,
          epoch: guard.epoch,
          owner,
          ttlMs,
          now: Date.now(),
        });
        if (!result?.ok) failure = result?.reason || "assembly-heartbeat-rejected";
        else guard.revision = result.task.revision;
      } catch (error) {
        failure = `assembly-heartbeat-error:${compactError(error)}`;
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
    },
  };
}

export function createComplexTaskOrchestrator(options = {}) {
  const store = options.store;
  if (!store || typeof store.list !== "function" || typeof store.read !== "function"
    || typeof store.acquireLease !== "function" || typeof store.transition !== "function"
    || typeof store.complete !== "function") {
    throw new TypeError("complex task orchestrator requires store list, read, lease, transition, and complete APIs");
  }
  const worker = options.worker;
  if (!worker || typeof worker.runOne !== "function") throw new TypeError("complex task orchestrator requires a durable worker");
  const supervisor = options.supervisor;
  if (!supervisor || typeof supervisor.reconcile !== "function") throw new TypeError("complex task orchestrator requires a supervisor");
  const assembler = options.assembler;
  if (typeof assembler !== "function") throw new TypeError("complex task orchestrator requires an assembler");

  const adapters = adapterRegistry(options.adapters);
  const maxConcurrency = boundedInteger(options.maxConcurrency, DEFAULT_MAX_CONCURRENCY, { max: 32 });
  const pollIntervalMs = boundedInteger(options.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS, { min: 1 });
  const assemblyLeaseMs = boundedInteger(options.assemblyLeaseMs, DEFAULT_ASSEMBLY_LEASE_MS, { min: 100 });
  const assemblyHeartbeatMs = boundedInteger(options.assemblyHeartbeatMs, Math.max(25, Math.floor(assemblyLeaseMs / 3)), { min: 10, max: Math.max(10, assemblyLeaseMs - 1) });
  const owner = text(options.owner) || `orchestrator:${randomUUID()}`;
  const active = new Map();
  let initialized = false;
  let running = false;
  let stopped = false;
  let polling = false;
  let currentRun = null;
  let wakeTimer = null;

  async function latestTask(value) {
    if (value?.id) {
      try { return await store.read(value.id); } catch { return value; }
    }
    return value;
  }

  async function moveToBlocked(task, error, code = "ORCHESTRATOR_ERROR") {
    const message = compactError(error);
    let current = await latestTask(task);
    if (!current || ["terminal", "waiting_user", "blocked", "paused"].includes(current.lifecycle)) {
      return { status: current?.lifecycle || "blocked", reason: message, task: current };
    }
    const input = {
      expectedRevision: current.revision,
      lifecycle: "blocked",
      quality: "failed",
      blockingReason: { code, message },
      now: Date.now(),
    };
    if (ACTIVE_LIFECYCLES.has(current.lifecycle) && current.lease) {
      input.leaseId = current.lease.leaseId;
      input.epoch = current.lease.epoch;
      input.owner = current.lease.owner;
    }
    let moved = await store.transition(current.id, input);
    if (!moved?.applied && moved?.reason === "stale-lease" && typeof store.recoverExpiredLease === "function") {
      const recovered = await store.recoverExpiredLease(current.id, {
        expectedRevision: current.revision,
        expectedEpoch: current.epoch,
        now: Date.now(),
        reason: message,
      });
      if (recovered?.applied) {
        current = recovered.task;
        moved = await store.transition(current.id, {
          expectedRevision: current.revision,
          lifecycle: "blocked",
          quality: "failed",
          blockingReason: { code, message },
          now: Date.now(),
        });
      }
    }
    return moved?.applied
      ? { status: "blocked", reason: message, task: moved.task }
      : { status: "superseded", reason: moved?.reason || message, task: moved?.task || current };
  }

  async function assembleTask(task, adapter, enginePin, signal) {
    let current = await latestTask(task);
    if (!current || current.lifecycle !== "queued") {
      return { status: "superseded", reason: `assembly-lifecycle-${current?.lifecycle || "missing"}`, task: current };
    }
    const lease = await store.acquireLease(current.id, {
      expectedRevision: current.revision,
      owner,
      ttlMs: assemblyLeaseMs,
      now: Date.now(),
    });
    if (!lease?.ok) return { status: "superseded", reason: lease?.reason || "assembly-lease-rejected", task: lease?.task || current };
    const guard = { leaseId: lease.leaseId, epoch: Number(lease.epoch), revision: lease.task.revision };
    const entering = await store.transition(current.id, {
      expectedRevision: guard.revision,
      lifecycle: "assembling",
      leaseId: guard.leaseId,
      epoch: guard.epoch,
      owner,
      now: Date.now(),
    });
    if (!entering?.applied) return { status: "superseded", reason: entering?.reason || "assembly-transition-rejected", task: entering?.task || lease.task };
    current = entering.task;
    guard.revision = current.revision;
    const heartbeat = createLeaseHeartbeat({
      store,
      taskId: current.id,
      guard,
      owner,
      ttlMs: assemblyLeaseMs,
      intervalMs: assemblyHeartbeatMs,
      signal,
    });
    let outcome;
    let waiting = null;
    let failed = false;
    try {
      const assembled = await assembler({
        task: clone(current),
        adapter,
        enginePin: clone(enginePin),
        lease: { leaseId: guard.leaseId, epoch: guard.epoch },
        signal,
      });
      if (assembled?.waitingUser === true || assembled?.status === "waiting_user") waiting = {
        userInputRequest: clone(assembled.userInputRequest ?? null),
        blockingReason: clone(assembled.blockingReason ?? { code: "ASSEMBLY_WAITING_USER", message: "任务装配需要用户选择后才能继续。" }),
        pendingAssembly: pendingAssemblySnapshot(current, assembled),
      };
      else outcome = assemblyOutcome(current, assembled);
    } catch (error) {
      failed = true;
      outcome = failedOutcome(current, compactError(error), "ASSEMBLY_ERROR");
    } finally {
      await heartbeat.stop();
    }
    if (heartbeat.failure) return { status: "superseded", reason: heartbeat.failure, task: await latestTask(current) };
    if (waiting) {
      const moved = await store.transition(current.id, {
        expectedRevision: guard.revision,
        lifecycle: "waiting_user",
        leaseId: guard.leaseId,
        epoch: guard.epoch,
        owner,
        quality: "needs_review",
        userInputRequest: waiting.userInputRequest,
        blockingReason: waiting.blockingReason,
        pendingAssembly: waiting.pendingAssembly,
        now: Date.now(),
      });
      return moved?.applied
        ? { status: "waiting_user", reason: "assembly-waiting-user", task: moved.task, pendingAssembly: waiting.pendingAssembly }
        : { status: "superseded", reason: moved?.reason || "assembly-waiting-transition-rejected", task: moved?.task || current };
    }
    const completed = await store.complete(current.id, outcome, {
      expectedRevision: guard.revision,
      leaseId: guard.leaseId,
      epoch: guard.epoch,
      owner,
      quality: failed || outcome.outcome === "failed" ? "failed" : outcome.outcome === "delivered" ? "passed" : "needs_review",
      now: Date.now(),
    });
    if (!completed?.applied) return { status: "superseded", reason: completed?.reason || "assembly-commit-rejected", task: completed?.task || current };
    return { status: failed ? "assembled_failure" : "assembled", task: completed.task, outcome: completed.task.outcome };
  }

  async function processTask(task, signal) {
    const adapter = adapterFor(adapters, task);
    if (!adapter) {
      const issue = { taskId: task.id, operation: "adapter", message: `task adapter is not registered: ${task?.contract?.taskType || "unknown"}` };
      return { result: await moveToBlocked(task, issue.message, "ADAPTER_UNAVAILABLE"), issue };
    }
    const enginePin = pinnedEngine(task);
    try {
      const result = await worker.runOne(task.id, { signal, controlSignal: signal, enginePin: clone(enginePin), adapter });
      if (result?.status === "ready_for_assembly") {
        return { result: await assembleTask(result.task || task, adapter, enginePin, signal), issue: null };
      }
      return { result: result || { status: "blocked", reason: "worker-returned-no-result", task }, issue: null };
    } catch (error) {
      const issue = { taskId: task.id, operation: "worker", message: compactError(error) };
      return { result: await moveToBlocked(task, error, "WORKER_EXCEPTION"), issue };
    }
  }

  function scheduleWake() {
    if (stopped || !polling || wakeTimer) return;
    wakeTimer = setTimeout(() => {
      wakeTimer = null;
      if (stopped || !polling) return;
      void runOnce().catch(async (error) => {
        try { await options.onError?.(error, { operation: "poll" }); } catch { /* Error reporting cannot stop polling. */ }
      }).finally(() => scheduleWake());
    }, pollIntervalMs);
    wakeTimer.unref?.();
  }

  async function performRun(input = {}) {
    const report = { initialized: false, started: [], results: [], issues: [], rescheduleRequested: false };
    if (stopped) return { ...report, stopped: true };
    if (!initialized) {
      report.reconcile = await supervisor.reconcile({ now: input.now ?? Date.now() });
      initialized = true;
      report.initialized = true;
    }
    const tasks = await store.list();
    report.scanned = tasks.length;
    const selected = tasks
      .filter((task) => task?.lifecycle === "queued" && !active.has(task.id))
      .slice(0, maxConcurrency);
    const runs = selected.map(async (task) => {
      if (stopped) return null;
      const controller = new AbortController();
      active.set(task.id, controller);
      report.started.push(task.id);
      try {
        return await processTask(task, controller.signal);
      } finally {
        if (active.get(task.id) === controller) active.delete(task.id);
      }
    });
    for (const entry of await Promise.all(runs)) {
      if (!entry) continue;
      report.results.push(entry.result);
      if (entry.issue) report.issues.push(entry.issue);
      if (entry.result?.status === "unit_completed") report.rescheduleRequested = true;
      try { await options.onChange?.(entry.result?.task ?? null, entry.result); } catch (error) {
        report.issues.push({ taskId: entry.result?.task?.id ?? null, operation: "onChange", message: compactError(error) });
      }
    }
    if (report.rescheduleRequested) scheduleWake();
    return report;
  }

  function runOnce(input = {}) {
    if (currentRun) return currentRun;
    running = true;
    currentRun = performRun(input).finally(() => {
      running = false;
      currentRun = null;
    });
    return currentRun;
  }

  async function start() {
    stopped = false;
    polling = true;
    const report = await runOnce();
    if (!stopped) scheduleWake();
    return report;
  }

  async function wake() {
    if (stopped) return { stopped: true, started: [], results: [], issues: [] };
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = null;
    const report = await runOnce();
    if (polling && !stopped) scheduleWake();
    return report;
  }

  async function stop() {
    stopped = true;
    polling = false;
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = null;
    for (const controller of active.values()) controller.abort(new Error("complex task orchestrator stopped"));
    if (currentRun) await currentRun;
  }

  return {
    maxConcurrency,
    get initialized() { return initialized; },
    get running() { return running; },
    runOnce,
    start,
    wake,
    stop,
  };
}
