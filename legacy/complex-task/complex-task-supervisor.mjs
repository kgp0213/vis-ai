const RECOVERABLE_LIFECYCLES = new Set(["leased", "running", "assembling"]);
const STALL_CHECK_LIFECYCLES = new Set(["leased", "running"]);

function compactError(error) {
  return String(error?.message || error || "unknown supervisor error").slice(0, 1_000);
}

function timestamp(value) {
  const parsed = typeof value === "number" ? value : Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function stalledTask(task, now) {
  if (!STALL_CHECK_LIFECYCLES.has(task?.lifecycle)) return null;
  const stallTimeoutMs = Number(task?.contract?.executionLimits?.stallTimeoutMs);
  if (!Number.isFinite(stallTimeoutMs) || stallTimeoutMs <= 0) return null;
  const lastProgressAt = timestamp(task?.progress?.lastProgressAt)
    ?? timestamp(task?.executionStartedAt)
    ?? timestamp(task?.lease?.acquiredAt);
  if (!Number.isFinite(lastProgressAt) || Number(now) - lastProgressAt < stallTimeoutMs) return null;
  return { stallTimeoutMs, lastProgressAt };
}

export function createComplexTaskSupervisor({ store, onIssue, verifySources, sourceCheckIntervalMs } = {}) {
  if (!store || typeof store.list !== "function" || typeof store.recoverExpiredLease !== "function") throw new TypeError("complex task supervisor requires a compatible store");
  const sourceCheckInterval = Math.max(0, Number(sourceCheckIntervalMs) || 60_000);
  const sourceChecks = new Map();

  async function sourceChangedFor(task, now) {
    if (typeof verifySources !== "function") return null;
    const last = sourceChecks.get(task.id);
    if (last !== undefined && Number(now) - last < sourceCheckInterval) return null;
    sourceChecks.set(task.id, Number(now));
    const result = await verifySources(task);
    if (result === true || result?.ok === true) return null;
    return {
      code: "SOURCE_CHANGED",
      changed: Array.isArray(result?.changed) ? result.changed : [],
      message: String(result?.message || "任务来源在执行期间发生变化，旧检查点不能直接套用。"),
    };
  }

  async function moveSourceChanged(task, issue, now) {
    const input = {
      expectedRevision: task.revision,
      lifecycle: "waiting_user",
      quality: "needs_review",
      blockingReason: { code: issue.code, message: issue.message, changed: issue.changed },
      userInputRequest: {
        kind: "user_input_request",
        requestId: `request:source-changed:${task.id}:${task.revision}`,
        taskId: task.id,
        reason: "source-changed",
        question: "任务来源文件已经变化，旧检查点不能继续使用。请创建一项读取新来源的新任务，或停止当前任务。",
        choices: [{ id: "restart-new-task", label: "按新来源创建任务" }, { id: "cancel", label: "停止当前任务" }],
      },
      now,
    };
    if (STALL_CHECK_LIFECYCLES.has(task.lifecycle) && task.lease) {
      input.leaseId = task.lease.leaseId;
      input.epoch = task.lease.epoch;
      input.owner = task.lease.owner;
    }
    return store.transition(task.id, input);
  }

  async function reconcile({ now = Date.now() } = {}) {
    const report = { scanned: 0, requeued: [], stalled: [], sourceChanged: [], active: [], needsAttention: [], pendingDeliveries: [], issues: [] };
    const tasks = await store.list();
    report.scanned = tasks.length;
    for (const task of tasks) {
      try {
        if (task.corrupt) { report.needsAttention.push(task.id); continue; }
        if (RECOVERABLE_LIFECYCLES.has(task.lifecycle)) {
          const expiresAt = Number(task.lease?.expiresAt);
          if (!task.lease || !Number.isFinite(expiresAt) || expiresAt <= Number(now)) {
            const recovered = await store.recoverExpiredLease(task.id, {
              expectedRevision: task.revision,
              expectedEpoch: task.epoch,
              now,
              reason: task.lease ? "worker lease expired" : "task had no worker lease",
            });
            if (recovered.applied) report.requeued.push(task.id);
            else if (recovered.reason === "lease-active") report.active.push(task.id);
            else if (!["revision-mismatch", "epoch-mismatch", "not-running"].includes(recovered.reason)) report.issues.push({ taskId: task.id, operation: "recover", message: recovered.reason });
          } else {
            const sourceIssue = await sourceChangedFor(task, now);
            if (sourceIssue) {
              const moved = await moveSourceChanged(task, sourceIssue, now);
              if (moved?.applied) report.sourceChanged.push(task.id);
              else if (!['revision-mismatch', 'epoch-mismatch', 'stale-lease'].includes(moved?.reason)) report.issues.push({ taskId: task.id, operation: "source-check", message: moved?.reason || "source change transition rejected" });
              continue;
            }
            const stalled = stalledTask(task, now);
            if (stalled && typeof store.recoverStalledLease === "function") {
              const recovered = await store.recoverStalledLease(task.id, {
                expectedRevision: task.revision,
                expectedEpoch: task.epoch,
                stallTimeoutMs: stalled.stallTimeoutMs,
                lastProgressAt: stalled.lastProgressAt,
                now,
                reason: `worker made no verifiable progress for ${stalled.stallTimeoutMs}ms`,
              });
              if (recovered.applied) {
                report.stalled.push(task.id);
                report.requeued.push(task.id);
              } else if (["progress-active", "revision-mismatch", "epoch-mismatch"].includes(recovered.reason)) report.active.push(task.id);
              else if (recovered.reason === "lease-expired") {
                const expired = await store.recoverExpiredLease(task.id, {
                  expectedRevision: recovered.task?.revision ?? task.revision,
                  expectedEpoch: recovered.task?.epoch ?? task.epoch,
                  now,
                  reason: "worker lease expired while checking progress",
                });
                if (expired.applied) report.requeued.push(task.id);
                else if (!['revision-mismatch', 'epoch-mismatch', 'not-running'].includes(expired.reason)) report.issues.push({ taskId: task.id, operation: "recover", message: expired.reason });
              } else report.issues.push({ taskId: task.id, operation: "recover-stalled", message: recovered.reason });
            } else report.active.push(task.id);
          }
        } else if (task.lifecycle === "queued") {
          const sourceIssue = await sourceChangedFor(task, now);
          if (sourceIssue) {
            const moved = await moveSourceChanged(task, sourceIssue, now);
            if (moved?.applied) report.sourceChanged.push(task.id);
            else if (!['revision-mismatch', 'epoch-mismatch'].includes(moved?.reason)) report.issues.push({ taskId: task.id, operation: "source-check", message: moved?.reason || "source change transition rejected" });
            continue;
          }
        }
        if (["waiting_user", "blocked", "paused"].includes(task.lifecycle)) report.needsAttention.push(task.id);
        for (const delivery of task.outbox ?? []) if ((delivery.pendingConsumers ?? []).length > 0) report.pendingDeliveries.push({ taskId: task.id, deliveryId: delivery.deliveryId });
      } catch (error) {
        const issue = { taskId: task.id, operation: "reconcile", message: compactError(error) };
        report.issues.push(issue);
        try { onIssue?.(issue, error); } catch { /* Diagnostics must not stop later task recovery. */ }
      }
    }
    return report;
  }

  return { reconcile };
}
