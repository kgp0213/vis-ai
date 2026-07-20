import { randomUUID } from "node:crypto";

const AUTO_HANDOFF_STATUSES = new Set([
  "completed",
  "completed_with_warnings",
  "awaiting_output",
  "failed",
  "interrupted",
  "paused",
  "source_changed",
]);

const ATTENTION_STATES = new Set([
  "queued",
  "running",
  "waiting_conversation",
  "needs_user",
  "user_paused",
]);

const FINISHED_HANDOFF_STATES = new Set(["delivered", "needs_user"]);
const RETRYABLE_HANDOFF_STATES = new Set(["needs_user"]);
const RECOVERABLE_STATUSES = new Set(["failed", "interrupted", "paused", "source_changed"]);
const DEFAULT_DISPATCH_TIMEOUT_MS = 5 * 60 * 1_000;
const DEFAULT_MAX_RECOVERY_ATTEMPTS = 2;
const DELIVERY_HISTORY_LIMIT = 20;

function compactText(value, max = 4_000) {
  const text = String(value ?? "").trim();
  return text.length <= max ? text : `${text.slice(0, max)}\n[内容已截断]`;
}

function jobIdOf(job) {
  return String(job?.documentJobId ?? job?.id ?? "").replace(/^document:/i, "").trim();
}

function originOf(job) {
  const origin = job?.origin ?? job?.handoff?.origin;
  return origin && typeof origin === "object" ? origin : null;
}

function comparableContextPath(value) {
  const path = String(value ?? "").trim().replace(/[\\/]+$/, "");
  return process.platform === "win32" ? path.toLowerCase() : path;
}

function warningSummary(job) {
  return (Array.isArray(job?.warnings) ? job.warnings : [])
    .slice(0, 12)
    .map((warning) => ({
      type: compactText(warning?.type, 120),
      message: compactText(warning?.message ?? warning, 800),
    }));
}

function modelIssueSummary(job) {
  return (Array.isArray(job?.modelIssues) ? job.modelIssues : [])
    .slice(0, 12)
    .map((issue) => ({
      providerId: compactText(issue?.providerId, 120),
      modelId: compactText(issue?.modelId, 160),
      category: compactText(issue?.category, 120),
      message: compactText(issue?.message ?? issue, 800),
      action: compactText(issue?.action, 800),
      retryable: issue?.retryable === true,
      requiresUserAction: issue?.requiresUserAction === true,
    }));
}

function rememberBounded(set, value, max = 1_000) {
  set.add(value);
  while (set.size > max) set.delete(set.values().next().value);
}

function handoffAttemptId(job, terminalKey) {
  if (job?.handoff?.terminalKey !== terminalKey) return null;
  const attemptId = String(job?.handoff?.attemptId ?? "").trim();
  return attemptId || null;
}

function handoffDeliveryKey(terminalKey, attemptId = null) {
  const terminal = String(terminalKey ?? "").trim();
  const attempt = String(attemptId ?? "").trim();
  return attempt ? `${terminal}:${attempt}` : terminal;
}

// Every asynchronous handoff transition must compare the snapshot it was
// derived from.  Keep optional legacy fields out of the guard when an older
// manifest did not persist them; the durable store can still compare the
// fields that are present (and always compares userControlled semantics).
function handoffGuardFor(job) {
  const handoff = job?.handoff && typeof job.handoff === "object" ? job.handoff : {};
  const guard = { userControlled: handoff.userControlled === true };
  for (const key of ["state", "terminalKey", "attemptId", "terminalStatus", "leaseId", "dispatchId"]) {
    if (Object.prototype.hasOwnProperty.call(handoff, key)) guard[key] = handoff[key];
  }
  return guard;
}

function deliveryFailureHistory(handoff = {}) {
  const history = Array.isArray(handoff.deliveryHistory) ? handoff.deliveryHistory.slice(-(DELIVERY_HISTORY_LIMIT - 1)) : [];
  const lastError = compactText(handoff.lastError, 1_500);
  if (!lastError) return history;
  history.push({
    attemptId: String(handoff.attemptId ?? "").trim() || null,
    dispatchId: String(handoff.dispatchId ?? "").trim() || null,
    state: String(handoff.state ?? "").trim() || null,
    attempts: Math.max(0, Number(handoff.attempts) || 0),
    failedAt: handoff.failedAt ?? null,
    lastError,
  });
  return history;
}

function failureClassOf(job) {
  const status = String(job?.status ?? "").toLowerCase();
  if (!RECOVERABLE_STATUSES.has(status)) return null;
  const diagnostics = Array.isArray(job?.modelDiagnostics) ? job.modelDiagnostics : [];
  const modelCategory = diagnostics.find((item) => item?.category)?.category;
  const warningType = (Array.isArray(job?.warnings) ? job.warnings : []).find((item) => item?.type)?.type;
  const raw = modelCategory || warningType || job?.errorCode || job?.error || status;
  const normalized = String(raw ?? status)
    .toLowerCase()
    .replace(/[a-f0-9]{8,}/g, "<id>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
  return `${status}:${normalized || "unknown"}`;
}

export function longTaskTerminalKey(job) {
  const id = jobIdOf(job);
  const status = String(job?.status ?? "").toLowerCase();
  if (!id || !AUTO_HANDOFF_STATUSES.has(status)) return null;
  const persistedKey = String(job?.handoff?.terminalKey ?? "").trim();
  const persistedStatus = String(job?.handoff?.terminalStatus ?? "").toLowerCase();
  const durableEpoch = job?.executionEpoch?.id ?? job?.completedAt ?? job?.stoppedAt ?? null;
  if (persistedKey
    && (!persistedStatus || persistedStatus === status)
    && (durableEpoch == null || persistedKey === `${id}:${String(durableEpoch)}:${status}`)) {
    return persistedKey;
  }
  const epoch = String(
    durableEpoch
      ?? job?.revision
      ?? job?.updatedAt
      ?? "unknown",
  );
  return `${id}:${epoch}:${status}`;
}

export function longTaskNeedsAttention(job) {
  const state = String(job?.handoff?.state ?? "").toLowerCase();
  if (ATTENTION_STATES.has(state)) return true;
  const status = String(job?.status ?? "").toLowerCase();
  if (!originOf(job)?.conversationId && [
    "completed_with_warnings",
    "awaiting_output",
    "failed",
    "interrupted",
    "paused",
    "source_changed",
  ].includes(status)) return true;
  return state === "waiting_worker" && Boolean(longTaskTerminalKey(job));
}

export function buildLongTaskHandoffPrompt(job) {
  const id = jobIdOf(job);
  const origin = originOf(job) ?? {};
  const status = String(job?.status ?? "unknown");
  const envelope = {
    jobId: id ? `document:${id}` : "unknown",
    status,
    originalGoal: compactText(origin.userPrompt, 6_000),
    originatingMode: compactText(origin.mode, 80),
    workspace: compactText(origin.workspace, 500),
    outputPath: compactText(job?.outputPath, 1_000),
    error: compactText(job?.error, 1_500),
    progress: job?.progress ?? null,
    qualityPassed: job?.qualityPassed ?? null,
    warnings: warningSummary(job),
    modelIssues: modelIssueSummary(job),
  };
  return [
    `[系统后台任务接管 ${envelope.jobId}]`,
    "这是此前用户目标的后台执行结果，不是新的用户请求。后台工作器结束不等于用户目标已经交付；现在由你继续接管原任务。",
    "",
    "<background-task-result>",
    JSON.stringify(envelope, null, 2),
    "</background-task-result>",
    "",
    "必须遵守：",
    "1. 先调用 get_document_job_status 读取这一个任务的最新持久状态；不要轮询，也不要重新启动相同任务。",
    "2. completed：核实输出文件存在并做必要的轻量抽查，然后向用户明确交付路径、完成范围和验证结论。",
    "3. completed_with_warnings：检查警告和产物，只做有证据的针对性补救；无法安全自动修复时，明确说明受影响范围、已有可用产物和用户下一步，不得假装完全通过。",
    "4. awaiting_output：模型工作已经完成，最终草稿也已保存；只处理目标路径冲突，绝不能重新做内容整理。failed、paused、interrupted、source_changed：根据错误、检查点和预览判断能否安全收尾。不要盲目重跑、不要覆盖同名文件、不要重复同一种失败调用；需要凭据、额度、覆盖确认或用户选择时，清楚提出这一项阻塞。",
    "5. 不论结果好坏，本轮都必须给用户一个明确结论：已交付、已降级交付，或等待哪一项用户操作。不能只汇报进度，不能静默结束。",
  ].join("\n");
}

export function createLongTaskHandoffCoordinator(options = {}) {
  const instanceId = String(options.instanceId || randomUUID());
  const configuredDispatchTimeoutMs = Number(options.dispatchTimeoutMs);
  const dispatchTimeoutMs = Number.isFinite(configuredDispatchTimeoutMs) && configuredDispatchTimeoutMs > 0
    ? configuredDispatchTimeoutMs
    : DEFAULT_DISPATCH_TIMEOUT_MS;
  const maxRecoveryAttempts = Math.max(1, Number(options.maxRecoveryAttempts) || DEFAULT_MAX_RECOVERY_ATTEMPTS);
  const queue = [];
  const queuedKeys = new Set();
  const handledKeys = new Set();
  const retryingKeys = new Set();
  let draining = false;
  let drainScheduled = false;

  const notify = (notice) => {
    try { options.notify?.(notice); } catch { /* Notifications are best effort. */ }
  };

  async function persist(job, patch, guard = {}) {
    if (typeof options.persist !== "function") return;
    let baseHandoff = job?.handoff ?? {};
    if (typeof options.loadJob === "function") {
      try {
        const latest = await options.loadJob(jobIdOf(job));
        if (latest?.handoff && typeof latest.handoff === "object") baseHandoff = latest.handoff;
      } catch {
        // The caller's loaded snapshot remains the only safe base when the
        // manifest cannot be read. The outer drain guard reports the failure.
      }
    }
    return options.persist(jobIdOf(job), {
      ...baseHandoff,
      ...patch,
      origin: originOf(job) ?? baseHandoff.origin ?? null,
      updatedAt: new Date().toISOString(),
    }, guard);
  }

  function scheduleDrain() {
    if (drainScheduled || draining || options.isBusy?.()) return;
    drainScheduled = true;
    queueMicrotask(() => {
      drainScheduled = false;
      void drain().catch((error) => notify({ kind: "coordinator-error", error: compactText(error?.message ?? error, 1_000) }));
    });
  }

  async function observe(job, { deferDrain = false } = {}) {
    const terminalKey = longTaskTerminalKey(job);
    if (!terminalKey) return { accepted: false, reason: "not-auto-handoff-terminal" };
    if (job?.handoff?.userControlled === true) return { accepted: false, reason: "user-controlled" };
    const attemptId = handoffAttemptId(job, terminalKey);
    const deliveryKey = handoffDeliveryKey(terminalKey, attemptId);
    if (retryingKeys.has(terminalKey)) return { accepted: false, reason: "retry-in-progress" };
    if (handledKeys.has(deliveryKey) || queuedKeys.has(deliveryKey)) {
      return { accepted: false, reason: "duplicate" };
    }

    const origin = originOf(job);
    if (!origin?.conversationId) return { accepted: false, reason: "missing-conversation-origin" };
    const handoff = job?.handoff ?? {};
    const expectedHandoff = handoffGuardFor(job);
    if (origin.autoHandoff === false) {
      if (!(handoffDeliveryKey(handoff.terminalKey, handoff.attemptId) === deliveryKey && handoff.state === "external_delivery")) {
        const persisted = await persist(job, {
          state: "external_delivery",
          terminalKey,
          attemptId,
          terminalStatus: job.status,
          leaseId: null,
          queuedAt: null,
        }, { expected: expectedHandoff });
        if (persisted?.applied === false) return { accepted: false, reason: "handoff-race" };
      }
      rememberBounded(handledKeys, deliveryKey);
      return { accepted: false, reason: "external-delivery-channel" };
    }
    if (handoff.terminalKey === terminalKey) {
      if (FINISHED_HANDOFF_STATES.has(handoff.state)) {
        rememberBounded(handledKeys, deliveryKey);
        return { accepted: false, reason: handoff.state };
      }
      if (["queued", "running"].includes(handoff.state) && handoff.leaseId === instanceId) {
        return { accepted: false, reason: "already-owned" };
      }
    }

    const failureClass = failureClassOf(job);
    const recoveryAttempts = Math.max(0, Number(handoff.recoveryAttempts) || 0);
    if (failureClass && recoveryAttempts > 0 && handoff.lastFailureClass === failureClass) {
      const reason = "自动接管已停止：同一失败原因再次出现，请先处理模型服务或任务输入后再重试";
      const persisted = await persist(job, {
        state: "needs_user",
        terminalKey,
        attemptId,
        terminalStatus: job.status,
        leaseId: null,
        lastFailureClass: failureClass,
        recoveryAttempts,
        lastError: reason,
        failedAt: new Date().toISOString(),
      }, { expected: expectedHandoff });
      if (persisted?.applied === false) return { accepted: false, reason: "handoff-race" };
      rememberBounded(handledKeys, deliveryKey);
      notify({ kind: "handoff-failed", jobId: jobIdOf(job), status: job.status, error: reason });
      return { accepted: false, reason: "repeated-failure" };
    }
    if (failureClass && recoveryAttempts >= maxRecoveryAttempts) {
      const reason = `自动接管已停止：同一任务最多自动恢复 ${maxRecoveryAttempts} 次，请由用户确认后再重试`;
      const persisted = await persist(job, {
        state: "needs_user",
        terminalKey,
        attemptId,
        terminalStatus: job.status,
        leaseId: null,
        lastFailureClass: failureClass,
        recoveryAttempts,
        lastError: reason,
        failedAt: new Date().toISOString(),
      }, { expected: expectedHandoff });
      if (persisted?.applied === false) return { accepted: false, reason: "handoff-race" };
      rememberBounded(handledKeys, deliveryKey);
      notify({ kind: "handoff-failed", jobId: jobIdOf(job), status: job.status, error: reason });
      return { accepted: false, reason: "recovery-limit" };
    }

    const activeConversationId = String(options.getConversationId?.() ?? "");
    const activeWorkspace = comparableContextPath(options.getWorkspace?.());
    const originWorkspace = comparableContextPath(origin.workspace);
    const contextMatches = activeConversationId
      && activeConversationId === String(origin.conversationId)
      && (!activeWorkspace || !originWorkspace || activeWorkspace === originWorkspace);
    if (!contextMatches) {
      if (!(handoffDeliveryKey(handoff.terminalKey, handoff.attemptId) === deliveryKey && handoff.state === "waiting_conversation")) {
        const persisted = await persist(job, {
          state: "waiting_conversation",
          terminalKey,
          attemptId,
          terminalStatus: job.status,
          leaseId: null,
          queuedAt: null,
        }, { expected: expectedHandoff });
        if (persisted?.applied === false) return { accepted: false, reason: "handoff-race" };
        notify({
          kind: "waiting-conversation",
          jobId: jobIdOf(job),
          status: job.status,
          conversationId: origin.conversationId,
        });
      }
      return { accepted: false, reason: "different-conversation" };
    }

    const queuedHandoff = {
      state: "queued",
      terminalKey,
      attemptId,
      terminalStatus: job.status,
      leaseId: instanceId,
      queuedAt: new Date().toISOString(),
      lastError: null,
      lastFailureClass: failureClass,
    };
    const persisted = await persist(job, queuedHandoff, { expected: expectedHandoff });
    if (persisted?.applied === false) {
      return { accepted: false, reason: "handoff-race" };
    }
    queuedKeys.add(deliveryKey);
    queue.push({
      job: persisted?.job ?? { ...job, handoff: { ...(job.handoff ?? {}), ...queuedHandoff } },
      terminalKey,
      attemptId,
      deliveryKey,
    });
    notify({ kind: "handoff-queued", jobId: jobIdOf(job), status: job.status });
    if (!deferDrain) scheduleDrain();
    return { accepted: true, terminalKey, attemptId };
  }

  async function retryDelivery(job, { deferDrain = false } = {}) {
    const initialTerminalKey = longTaskTerminalKey(job);
    if (!initialTerminalKey) return { accepted: false, reason: "not-auto-handoff-terminal" };
    if (typeof options.persist !== "function") return { accepted: false, reason: "delivery-persistence-unavailable" };
    if (retryingKeys.has(initialTerminalKey)) return { accepted: false, reason: "retry-in-progress" };

    retryingKeys.add(initialTerminalKey);
    try {
      let current = job;
      if (typeof options.loadJob === "function") {
        try {
          current = await options.loadJob(jobIdOf(job));
          if (!current) return { accepted: false, reason: "delivery-job-missing" };
        } catch (error) {
          return { accepted: false, reason: "delivery-load-failed", error: compactText(error?.message ?? error, 1_500) };
        }
      }
      const terminalKey = longTaskTerminalKey(current);
      if (!terminalKey || terminalKey !== initialTerminalKey) return { accepted: false, reason: "terminal-changed" };
      const handoff = current?.handoff ?? {};
      if (!RETRYABLE_HANDOFF_STATES.has(String(handoff.state ?? ""))) {
        return { accepted: false, reason: "delivery-not-retryable" };
      }
      if (handoff.userControlled === true) return { accepted: false, reason: "user-controlled" };
      const origin = originOf(current);
      if (!origin?.conversationId) return { accepted: false, reason: "missing-conversation-origin" };
      if (origin.autoHandoff === false) return { accepted: false, reason: "external-delivery-channel" };

      const attemptId = `attempt:${randomUUID()}`;
      const deliveryKey = handoffDeliveryKey(terminalKey, attemptId);
      const activeConversationId = String(options.getConversationId?.() ?? "");
      const activeWorkspace = comparableContextPath(options.getWorkspace?.());
      const originWorkspace = comparableContextPath(origin.workspace);
      const contextMatches = activeConversationId
        && activeConversationId === String(origin.conversationId)
        && (!activeWorkspace || !originWorkspace || activeWorkspace === originWorkspace);
      const state = contextMatches ? "queued" : "waiting_conversation";
      const persisted = await persist(current, {
        state,
        terminalKey,
        attemptId,
        terminalStatus: current.status,
        leaseId: contextMatches ? instanceId : null,
        queuedAt: contextMatches ? new Date().toISOString() : null,
        retryApprovedAt: new Date().toISOString(),
        deliveryHistory: deliveryFailureHistory(handoff),
        lastError: null,
        failedAt: null,
        userControlled: false,
      }, {
        expected: {
          ...handoffGuardFor(current),
          state: "needs_user",
          terminalKey,
          userControlled: false,
        },
      });
      if (persisted?.applied === false) return { accepted: false, reason: "delivery-retry-race" };

      if (contextMatches) {
        queuedKeys.add(deliveryKey);
        queue.push({ job: current, terminalKey, attemptId, deliveryKey });
        notify({ kind: "handoff-retry-queued", jobId: jobIdOf(current), status: current.status, terminalKey, attemptId });
        if (!deferDrain) scheduleDrain();
      } else {
        notify({
          kind: "waiting-conversation",
          jobId: jobIdOf(current),
          status: current.status,
          conversationId: origin.conversationId,
          terminalKey,
          attemptId,
        });
      }
      return { accepted: true, terminalKey, attemptId, queued: contextMatches, waitingConversation: !contextMatches };
    } finally {
      retryingKeys.delete(initialTerminalKey);
    }
  }

  async function drain() {
    if (draining || options.isBusy?.()) return { processed: 0, pending: queue.length };
    draining = true;
    let processed = 0;
    try {
      while (queue.length > 0 && !options.isBusy?.()) {
        const queued = queue.shift();
        queuedKeys.delete(queued.deliveryKey || handoffDeliveryKey(queued.terminalKey, queued.attemptId));
        try {
          const loaded = typeof options.loadJob === "function"
            ? await options.loadJob(jobIdOf(queued.job))
            : queued.job;
          // A missing persisted job is a stale queue entry, not permission to
          // resurrect the in-memory snapshot and deliver it anyway.
          if (typeof options.loadJob === "function" && loaded == null) continue;
          const job = loaded ?? queued.job;
          if (longTaskTerminalKey(job) !== queued.terminalKey) continue;
          if (handoffAttemptId(job, queued.terminalKey) !== (queued.attemptId || null)) continue;

          const origin = originOf(job);
          const activeConversationId = String(options.getConversationId?.() ?? "");
          const activeWorkspace = comparableContextPath(options.getWorkspace?.());
          const originWorkspace = comparableContextPath(origin?.workspace);
          const contextMatches = origin?.conversationId
            && activeConversationId === String(origin.conversationId)
            && (!activeWorkspace || !originWorkspace || activeWorkspace === originWorkspace);
          if (!contextMatches) {
            const persisted = await persist(job, {
              state: "waiting_conversation",
              terminalKey: queued.terminalKey,
              attemptId: queued.attemptId || null,
              terminalStatus: job.status,
              leaseId: null,
              queuedAt: null,
            }, { expected: handoffGuardFor(job) });
            if (persisted?.applied === false) continue;
            notify({ kind: "waiting-conversation", jobId: jobIdOf(job), status: job.status, conversationId: origin?.conversationId ?? null });
            continue;
          }

          const attempts = Math.max(0, Number(job?.handoff?.attempts) || 0) + 1;
          const failureClass = failureClassOf(job);
          const recoveryAttempts = Math.max(0, Number(job?.handoff?.recoveryAttempts) || 0)
            + (failureClass ? 1 : 0);
          const dispatchId = `${queued.terminalKey}:${instanceId}:${attempts}`;
          const claimed = await persist(job, {
            state: "running",
            terminalKey: queued.terminalKey,
            attemptId: queued.attemptId || null,
            terminalStatus: job.status,
            leaseId: instanceId,
            attempts,
            recoveryAttempts,
            lastFailureClass: failureClass ?? job?.handoff?.lastFailureClass ?? null,
            dispatchId,
            startedAt: new Date().toISOString(),
          }, { expected: handoffGuardFor(job) });
          if (claimed?.applied === false) continue;
          notify({ kind: "handoff-running", jobId: jobIdOf(job), status: job.status });

          let result;
          try {
            const dispatchController = new AbortController();
            const dispatchPromise = Promise.resolve(options.dispatch?.({
              job,
              terminalKey: queued.terminalKey,
              attemptId: queued.attemptId || null,
              dispatchId,
              prompt: buildLongTaskHandoffPrompt(job),
              signal: dispatchController.signal,
            }));
            let timeoutHandle;
            const timeout = new Promise((resolve) => {
              timeoutHandle = setTimeout(() => {
                dispatchController.abort(new DOMException("handoff dispatch timed out", "TimeoutError"));
                resolve({
                  accepted: false,
                  completed: true,
                  ok: false,
                  error: `handoff dispatch timed out after ${dispatchTimeoutMs}ms`,
                });
              }, dispatchTimeoutMs);
            });
            try {
              result = await Promise.race([dispatchPromise, timeout]);
            } finally {
              clearTimeout(timeoutHandle);
            }
          } catch (error) {
            result = { accepted: false, completed: true, ok: false, error: error?.message || String(error) };
          }

          // A user action, a resume in another epoch, or a process recovery
          // may have claimed the job while the model turn was in flight. Never
          // let this stale lease overwrite that newer lifecycle state.
          const latest = typeof options.loadJob === "function"
            ? await options.loadJob(jobIdOf(job))
            : job;
          const leaseStillOwnsTerminal = (candidate) => candidate
            && longTaskTerminalKey(candidate) === queued.terminalKey
            && handoffAttemptId(candidate, queued.terminalKey) === (queued.attemptId || null)
            && candidate.handoff?.state === "running"
            && candidate.handoff?.leaseId === instanceId
            && candidate.handoff?.dispatchId === dispatchId
            && candidate.handoff?.userControlled !== true;
          if (!leaseStillOwnsTerminal(latest)) continue;

          if (result?.accepted === false && /busy/i.test(String(result?.reason ?? result?.error ?? ""))) {
            const deliveryKey = queued.deliveryKey || handoffDeliveryKey(queued.terminalKey, queued.attemptId);
            const requeued = await persist(job, {
              state: "queued",
              terminalKey: queued.terminalKey,
              attemptId: queued.attemptId || null,
              terminalStatus: job.status,
              leaseId: instanceId,
              attempts,
            }, { expected: {
              ...handoffGuardFor(job),
              state: "running",
              leaseId: instanceId,
              dispatchId,
              ...(queued.attemptId ? { attemptId: queued.attemptId } : {}),
            } });
            if (requeued?.applied === false) {
              break;
            }
            queuedKeys.add(deliveryKey);
            queue.unshift({
              job: requeued?.job ?? { ...job, handoff: { ...(job.handoff ?? {}), state: "queued", attempts } },
              terminalKey: queued.terminalKey,
              attemptId: queued.attemptId || null,
              deliveryKey,
            });
            break;
          }

          processed++;
          const deliveredText = String(result?.assistantText ?? "").trim();
          const dispatchSucceeded = result?.accepted !== false && result?.ok !== false && result?.completed !== false && Boolean(deliveredText);
          let deliveryProof = { ok: true };
          if (dispatchSucceeded && typeof options.verifyDelivery === "function") {
            try {
              deliveryProof = await options.verifyDelivery({
                job: latest,
                terminalKey: queued.terminalKey,
                attemptId: queued.attemptId || null,
                dispatchId,
                result,
              }) ?? { ok: false, error: "host delivery verification returned no result" };
            } catch (error) {
              deliveryProof = { ok: false, error: error?.message || String(error) };
            }
          }
          // Verification may restore an artifact or trigger another lifecycle
          // transition. Re-read after that await so an old delivery cannot
          // commit against a newer epoch/status while retaining stale lease
          // fields in the handoff object.
          const verifiedLatest = typeof options.loadJob === "function"
            ? await options.loadJob(jobIdOf(job))
            : latest;
          if (!leaseStillOwnsTerminal(verifiedLatest)) continue;
          if (dispatchSucceeded && deliveryProof?.ok !== false) {
            const expected = {
              state: "running",
              terminalKey: queued.terminalKey,
              leaseId: instanceId,
              dispatchId,
              userControlled: false,
              attemptId: queued.attemptId || null,
            };
            const persisted = await persist(verifiedLatest, {
              state: "delivered",
              terminalKey: queued.terminalKey,
              attemptId: queued.attemptId || null,
              terminalStatus: verifiedLatest.status,
              leaseId: null,
              attempts,
              recoveryAttempts,
              lastFailureClass: failureClass ?? job?.handoff?.lastFailureClass ?? null,
              dispatchId,
              deliveredAt: new Date().toISOString(),
              lastError: null,
              assistantMessageId: result?.assistantMessageId ?? null,
              artifactStatus: deliveryProof?.artifactStatus ?? null,
            }, { expected });
            if (persisted?.applied === false) continue;
            rememberBounded(handledKeys, queued.deliveryKey || handoffDeliveryKey(queued.terminalKey, queued.attemptId));
            notify({
              kind: "handoff-delivered",
              jobId: jobIdOf(job),
              status: job.status,
              terminalKey: queued.terminalKey,
              attemptId: queued.attemptId || null,
              dispatchId,
            });
          } else {
            const error = compactText(
              result?.error
                ?? result?.reason
                ?? deliveryProof?.error
                ?? (result?.accepted !== false && !deliveredText ? "automatic handoff returned no delivery conclusion" : "automatic handoff did not complete"),
              1_500,
            );
            const expected = {
              state: "running",
              terminalKey: queued.terminalKey,
              leaseId: instanceId,
              dispatchId,
              userControlled: false,
              attemptId: queued.attemptId || null,
            };
            const persisted = await persist(verifiedLatest, {
              state: "needs_user",
              terminalKey: queued.terminalKey,
              attemptId: queued.attemptId || null,
              terminalStatus: verifiedLatest.status,
              leaseId: null,
              attempts,
              recoveryAttempts,
              lastFailureClass: failureClass ?? job?.handoff?.lastFailureClass ?? null,
              dispatchId,
              artifactStatus: deliveryProof?.artifactStatus ?? null,
              failedAt: new Date().toISOString(),
              lastError: error,
            }, { expected });
            if (persisted?.applied === false) continue;
            rememberBounded(handledKeys, queued.deliveryKey || handoffDeliveryKey(queued.terminalKey, queued.attemptId));
            notify({ kind: "handoff-failed", jobId: jobIdOf(job), status: job.status, attemptId: queued.attemptId || null, error });
          }
        } catch (error) {
          const message = compactText(error?.message ?? error, 1_500);
          notify({ kind: "coordinator-error", jobId: jobIdOf(queued.job), error: message });
          // Keep the rest of the FIFO queue serviceable. The failed item is
          // re-discovered by startup/session rehydration after its manifest is
          // readable again; this drain must not reject or strand later items.
        }
      }
    } finally {
      draining = false;
    }
    if (queue.length > 0 && !options.isBusy?.()) scheduleDrain();
    return { processed, pending: queue.length };
  }

  async function rehydrate(jobs = []) {
    const ordered = [...(Array.isArray(jobs) ? jobs : [])]
      .sort((left, right) => Date.parse(left?.updatedAt ?? left?.createdAt ?? 0) - Date.parse(right?.updatedAt ?? right?.createdAt ?? 0));
    for (const job of ordered) {
      try {
        await observe(job, { deferDrain: true });
      } catch (error) {
        notify({ kind: "coordinator-error", jobId: jobIdOf(job), error: compactText(error?.message ?? error, 1_500) });
      }
    }
    return drain();
  }

  return {
    drain,
    observe,
    retryDelivery,
    pendingCount: () => queue.length,
    rehydrate,
  };
}
