const RECOVERABLE_LIFECYCLES = new Set(["leased", "running", "assembling"]);

function compactError(error) {
  return String(error?.message || error || "unknown supervisor error").slice(0, 1_000);
}

export function createComplexTaskSupervisor({ store, onIssue } = {}) {
  if (!store || typeof store.list !== "function" || typeof store.recoverExpiredLease !== "function") throw new TypeError("complex task supervisor requires a compatible store");

  async function reconcile({ now = Date.now() } = {}) {
    const report = { scanned: 0, requeued: [], active: [], needsAttention: [], pendingDeliveries: [], issues: [] };
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
          } else report.active.push(task.id);
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
