import {
  createBackgroundTaskRegistry,
  projectBackgroundTask,
} from "./background-task-registry.mjs";

const TASK_ID_RE = /^task:[0-9a-f-]{36}$/i;
const RETIRED_EXECUTION_ACTIONS = new Set(["resume", "retry", "resolve_user_input", "retarget_output"]);
const RETIRABLE_LIFECYCLES = new Set(["queued", "leased", "running", "assembling", "waiting_user"]);
const DEFAULT_EXECUTION_RETIRED_REASON = "旧版复杂任务执行流程已停用。任务现场已经保留；请回到主对话重新发起，后续将由通用复杂任务状态机监督同一个普通模型工具循环。";

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

function withTaskDetail(raw, controller, { executionRetired = false } = {}) {
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
  if (controller?.allowedTaskActions) {
    const allowed = controller.allowedTaskActions(raw);
    detail.allowedActions = executionRetired
      ? allowed.filter((action) => !RETIRED_EXECUTION_ACTIONS.has(action))
      : allowed;
  }
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
  const executionRetired = options.executionRetired === true;
  const executionRetiredReason = text(options.executionRetiredReason) || DEFAULT_EXECUTION_RETIRED_REASON;
  const registry = options.registry ?? createBackgroundTaskRegistry({
    listProcessJobs: options.listProcessJobs,
    listLegacyDocumentJobs: options.listLegacyDocumentJobs,
    listTaskJobs: () => store.list(),
    listPendingDeliveries: async () => pendingDeliverySnapshot(await store.listPendingOutbox?.() ?? []),
  });
  let initialized = false;

  async function retireLegacyExecutionTasks({ now = Date.now() } = {}) {
    const tasks = await store.list();
    const retired = [];
    const needsAttention = [];
    const issues = [];
    if (typeof store.transition !== "function") {
      const issue = maintenanceIssue("retire-execution", new Error("task store transition API is unavailable"));
      return { scanned: tasks.length, requeued: [], retired, needsAttention, issues: [issue] };
    }
    for (const task of tasks) {
      try {
        let current = task;
        if (current.lifecycle === "paused") {
          const queued = await store.transition(current.id, {
            expectedRevision: current.revision,
            lifecycle: "queued",
            userControlled: true,
            now,
          });
          if (queued?.applied !== true) throw new Error(`paused task could not be prepared for retirement: ${queued?.reason || "transition rejected"}`);
          current = queued.task;
        }
        if (!RETIRABLE_LIFECYCLES.has(current?.lifecycle)) continue;
        const blocked = await store.transition(current.id, {
          expectedRevision: current.revision,
          lifecycle: "blocked",
          userControlled: true,
          blockingReason: { code: "EXECUTION_PATH_RETIRED", message: executionRetiredReason },
          now,
        });
        if (blocked?.applied !== true) throw new Error(`task could not be retired: ${blocked?.reason || "transition rejected"}`);
        retired.push(current.id);
        needsAttention.push(current.id);
      } catch (error) {
        issues.push({ ...maintenanceIssue("retire-execution", error), taskId: task?.id ?? null });
      }
    }
    return { scanned: tasks.length, requeued: [], retired, needsAttention, issues };
  }

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
    if (executionRetired) {
      try {
        reconcile = await retireLegacyExecutionTasks({ now });
        issues.push(...reconcile.issues);
      } catch (error) {
        const issue = maintenanceIssue("retire-execution", error);
        issues.push(issue);
        reconcile = { scanned: 0, requeued: [], retired: [], needsAttention: [], issues: [issue] };
      }
    } else if (supervisor?.reconcile) {
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
    return task ? withTaskDetail(task, controller, { executionRetired }) : null;
  }

  async function controlBackgroundJob(id, action, optionsInput = {}) {
    if (!isTaskId(id)) return { ok: false, applied: false, reason: "not-generic-task" };
    const task = await readTask(id);
    if (!task) return { ok: false, applied: false, reason: "not-found" };
    if (!controller?.control) return { ok: false, applied: false, reason: "controller-unavailable" };
    const normalizedAction = text(action).toLowerCase();
    if (executionRetired && RETIRED_EXECUTION_ACTIONS.has(normalizedAction)) {
      return {
        ok: false,
        applied: false,
        reason: "execution-path-retired",
        error: executionRetiredReason,
        task: clone(task),
        job: withTaskDetail(task, controller, { executionRetired }),
      };
    }
    const request = {
      action: normalizedAction,
      expectedRevision: optionsInput.expectedRevision,
      ...(optionsInput.requestId ? { requestId: text(optionsInput.requestId) } : {}),
      ...(Number.isInteger(optionsInput.expectedEpoch) ? { expectedEpoch: optionsInput.expectedEpoch } : { expectedEpoch: Number(task.epoch ?? 0) }),
      payload: normalizeControlRequest(task, normalizedAction, optionsInput),
    };
    const result = await controller.control(id, request);
    if (result?.task) result.job = withTaskDetail(result.task, controller, { executionRetired });
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
