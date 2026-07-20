import {
  createBackgroundTaskRegistry,
  projectBackgroundTask,
} from "./background-task-registry.mjs";

const TASK_ID_RE = /^task:[0-9a-f-]{36}$/i;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isTaskId(value) {
  return TASK_ID_RE.test(text(value));
}

function isNotFound(error) {
  return error?.code === "ENOENT" || /not found|missing/i.test(String(error?.message || error));
}

function maintenanceIssue(operation, error) {
  return {
    operation,
    code: text(error?.code) || "MAINTENANCE_FAILED",
    message: text(error?.message) || String(error || "后台任务启动维护失败"),
  };
}

function pendingDeliverySnapshot(entries) {
  const output = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const consumers = Array.isArray(entry?.pendingConsumers) && entry.pendingConsumers.length
      ? entry.pendingConsumers
      : ["task-center"];
    for (const target of consumers) {
      output.push({
        ...clone(entry),
        target: String(target),
        deliveryState: clone(entry?.deliveryStates?.[target] ?? null),
        pendingConsumers: [...consumers],
      });
    }
  }
  return output;
}

function withTaskDetail(raw, controller) {
  const projected = projectBackgroundTask(raw);
  const detail = {
    ...projected,
    epoch: Number(raw?.epoch ?? 0),
    lease: clone(raw?.lease ?? null),
    userInputRequest: clone(raw?.userInputRequest ?? null),
    pendingAssembly: clone(raw?.pendingAssembly ?? null),
    coverageLedger: clone(raw?.coverageLedger ?? {}),
    workPlan: clone(raw?.workPlan ?? null),
    unitPlans: clone(raw?.unitPlans ?? []),
    unitResults: clone(raw?.unitResults ?? {}),
    contract: clone(raw?.contract ?? null),
    metadata: clone(raw?.metadata ?? null),
    outbox: clone(raw?.outbox ?? []),
  };
  if (controller?.allowedTaskActions) detail.allowedActions = controller.allowedTaskActions(raw);
  return detail;
}

function normalizeControlRequest(task, action, options = {}) {
  const payload = options.payload && typeof options.payload === "object" ? clone(options.payload) : {};
  if (action === "resolve_user_input") {
    const requestId = text(payload.requestId) || text(task?.userInputRequest?.requestId);
    return { ...payload, ...(requestId ? { requestId } : {}) };
  }
  if (action === "retarget_output" && !text(payload.requestedPath) && text(payload.path)) {
    payload.requestedPath = text(payload.path);
    delete payload.path;
  }
  if (action === "ack_outcome" && !text(payload.consumer)) payload.consumer = "task-center";
  if (action === "ack_outcome" && !text(payload.deliveryId) && text(options.deliveryId)) payload.deliveryId = text(options.deliveryId);
  return payload;
}

export function createComplexTaskRuntimeService(options = {}) {
  const store = options.store;
  if (!store || typeof store.read !== "function" || typeof store.list !== "function") {
    throw new TypeError("complex task runtime service requires a task store");
  }
  const controller = options.controller ?? null;
  const supervisor = options.supervisor ?? null;
  const registry = options.registry ?? createBackgroundTaskRegistry({
    listProcessJobs: options.listProcessJobs,
    listLegacyDocumentJobs: options.listLegacyDocumentJobs,
    listTaskJobs: () => store.list(),
    listPendingDeliveries: async () => pendingDeliverySnapshot(await store.listPendingOutbox?.() ?? []),
  });
  let initialized = false;

  async function initialize({ now = Date.now() } = {}) {
    const issues = [];
    let outboxRepair;
    if (typeof store.reconcileOutbox === "function") {
      try {
        outboxRepair = await store.reconcileOutbox({ now });
      } catch (error) {
        const issue = maintenanceIssue("outbox-reconcile", error);
        issues.push(issue);
        outboxRepair = { scanned: 0, repaired: [], auditEvents: 0, issues: [issue] };
      }
    } else {
      outboxRepair = { scanned: 0, repaired: [], auditEvents: 0, issues: [] };
    }

    let reconcile;
    if (supervisor?.reconcile) {
      try {
        reconcile = await supervisor.reconcile({ now });
      } catch (error) {
        const issue = maintenanceIssue("supervisor-reconcile", error);
        issues.push(issue);
        reconcile = { scanned: 0, requeued: [], needsAttention: [], issues: [issue] };
      }
    } else {
      reconcile = { scanned: 0, requeued: [], needsAttention: [], issues: [] };
    }

    let pruned;
    if (store.pruneExpired) {
      try {
        pruned = await store.pruneExpired(now);
      } catch (error) {
        const issue = maintenanceIssue("prune-expired", error);
        issues.push(issue);
        pruned = { deleted: [], kept: 0, issues: [issue] };
      }
    } else {
      pruned = { deleted: [], kept: 0, issues: [] };
    }
    initialized = true;
    return { initialized, outboxRepair, reconcile, pruned, issues };
  }

  async function listBackgroundJobs() {
    return registry.list();
  }

  async function readTask(id) {
    if (!isTaskId(id)) return null;
    try { return await store.read(id); } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async function getBackgroundJob(id) {
    const task = await readTask(id);
    return task ? withTaskDetail(task, controller) : null;
  }

  async function controlBackgroundJob(id, action, optionsInput = {}) {
    if (!isTaskId(id)) return { ok: false, applied: false, reason: "not-generic-task" };
    const task = await readTask(id);
    if (!task) return { ok: false, applied: false, reason: "not-found" };
    if (!controller?.control) return { ok: false, applied: false, reason: "controller-unavailable" };
    const normalizedAction = text(action).toLowerCase();
    const request = {
      action: normalizedAction,
      expectedRevision: optionsInput.expectedRevision,
      ...(optionsInput.requestId ? { requestId: text(optionsInput.requestId) } : {}),
      ...(Number.isInteger(optionsInput.expectedEpoch) ? { expectedEpoch: optionsInput.expectedEpoch } : { expectedEpoch: Number(task.epoch ?? 0) }),
      payload: normalizeControlRequest(task, normalizedAction, optionsInput),
    };
    const result = await controller.control(id, request);
    if (result?.task) result.job = withTaskDetail(result.task, controller);
    if (result?.applied === true && result?.task?.lifecycle === "queued" && typeof options.wake === "function") {
      try {
        Promise.resolve(options.wake(result.task, { action: normalizedAction })).catch((error) => options.onWakeError?.(error, result.task));
      } catch (error) {
        try { options.onWakeError?.(error, result.task); } catch { /* Control result remains authoritative. */ }
      }
    }
    try { await options.onChange?.(result?.task ?? task, { action: normalizedAction, result }); } catch { /* UI invalidation must not change task outcome. */ }
    return result;
  }

  return {
    get initialized() { return initialized; },
    initialize,
    listBackgroundJobs,
    getBackgroundJob,
    controlBackgroundJob,
    pendingDeliverySnapshot,
  };
}
