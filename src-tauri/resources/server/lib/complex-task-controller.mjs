/**
 * User-facing control plane for durable complex tasks.
 *
 * The controller is intentionally small: it derives safe actions from the
 * authoritative task snapshot, validates the request, and delegates the
 * atomic mutation to the task store. It never edits a manifest directly.
 */

export const TASK_CONTROL_ACTIONS = Object.freeze([
  "pause",
  "resume",
  "retry",
  "retry_delivery",
  "cancel",
  "resolve_user_input",
  "retarget_output",
  "ack_outcome",
  "delete_record",
]);

const ACTION_SET = new Set(TASK_CONTROL_ACTIONS);
const ACTIVE_LIFECYCLES = new Set(["leased", "running", "assembling"]);
const OUTPUT_CONFLICT_RE = /output[-_ ]?conflict|path[-_ ]?conflict|输出.*冲突|路径.*冲突/i;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function pendingConsumers(entry) {
  if (Array.isArray(entry?.pendingConsumers)) return entry.pendingConsumers.map(text).filter(Boolean);
  const consumers = Array.isArray(entry?.consumers) && entry.consumers.length
    ? entry.consumers.map(text).filter(Boolean)
    : ["task-center"];
  const acknowledgements = object(entry?.acknowledgements);
  return consumers.filter((consumer) => acknowledgements[consumer] !== true);
}

function hasPendingOutbox(task) {
  return (Array.isArray(task?.outbox) ? task.outbox : []).some((entry) => pendingConsumers(entry).length > 0);
}

function retryableConversationDelivery(task) {
  return (Array.isArray(task?.outbox) ? task.outbox : []).some((entry) => {
    if (!pendingConsumers(entry).includes("conversation")) return false;
    const status = String(entry?.deliveryStates?.conversation?.status ?? "ready");
    return ["blocked_user_retry", "exhausted"].includes(status);
  });
}

function userInputRequest(task) {
  return task?.userInputRequest ?? task?.pendingUserInput ?? task?.request ?? null;
}

function isOutputConflict(task) {
  const request = userInputRequest(task);
  if (!request || request.allowRetarget === true || request.kind === "output-conflict") return Boolean(request);
  return OUTPUT_CONFLICT_RE.test(`${request.reason ?? ""} ${request.type ?? ""}`);
}

function derivedAllowedActions(task) {
  if (!task || task.corrupt === true || task.lifecycle === "created") return [];
  const lifecycle = String(task.lifecycle ?? task.status ?? "");
  if (lifecycle === "queued" || ACTIVE_LIFECYCLES.has(lifecycle)) return ["pause", "cancel"];
  if (lifecycle === "paused") return ["resume", "retry", "cancel"];
  if (lifecycle === "blocked") return ["retry", "cancel"];
  if (lifecycle === "waiting_user") {
    return ["resolve_user_input", ...(isOutputConflict(task) ? ["retarget_output"] : []), "cancel"];
  }
  if (lifecycle === "terminal") {
    const actions = task.outcome?.resumable === true ? ["retry"] : [];
    if (retryableConversationDelivery(task)) actions.push("retry_delivery");
    if (hasPendingOutbox(task)) actions.push("ack_outcome");
    else actions.push("delete_record");
    return actions;
  }
  return [];
}

/**
 * Return actions that are valid for the supplied snapshot. If a persisted
 * projection supplies a narrower list, intersect it with host-derived policy;
 * never trust a broader client/UI projection.
 */
export function allowedTaskActions(task) {
  const actions = derivedAllowedActions(task);
  if (!Array.isArray(task?.allowedActions)) return actions;
  const projected = new Set(task.allowedActions.map(text));
  return actions.filter((action) => projected.has(action));
}

function failure(reason, task, extra = {}) {
  return {
    ok: false,
    applied: false,
    reason,
    ...(task ? { task: clone(task), allowedActions: allowedTaskActions(task) } : {}),
    ...extra,
  };
}

function success(action, result, fallbackTask) {
  const nextTask = result?.task ?? fallbackTask;
  return {
    ok: true,
    applied: result?.applied !== false,
    action,
    ...(action === "delete_record" ? { deleted: true } : result?.deleted !== undefined ? { deleted: result.deleted === true } : {}),
    ...(nextTask ? { task: clone(nextTask), allowedActions: allowedTaskActions(nextTask) } : {}),
    ...(result?.deliveryId ? { deliveryId: result.deliveryId } : {}),
  };
}

function failedStoreResult(action, result, fallbackTask) {
  const task = result?.task ?? fallbackTask;
  return failure(result?.reason ?? "control-rejected", task, { action });
}

function normalizeAction(value) {
  return text(value).toLowerCase();
}

function payloadFor(request, task) {
  const payload = clone(object(request.payload));
  if (request.action === "retarget_output" && !text(payload.requestId)) {
    const requestId = text(task?.userInputRequest?.requestId);
    if (requestId) payload.requestId = requestId;
  }
  return payload;
}

function storePayload(action, payload) {
  if (action !== "resolve_user_input") return payload;
  if (Object.prototype.hasOwnProperty.call(payload, "answer")) {
    return { requestId: payload.requestId, answer: clone(payload.answer) };
  }
  if (Object.prototype.hasOwnProperty.call(payload, "resolution")) {
    return { requestId: payload.requestId, answer: clone(payload.resolution) };
  }
  if (Object.prototype.hasOwnProperty.call(payload, "choiceId")) {
    return { requestId: payload.requestId, answer: payload.choiceId };
  }
  return { requestId: payload.requestId, answer: clone(payload.value ?? payload.answer) };
}

function validatePayload(action, payload, task) {
  if (action === "resolve_user_input") {
    const request = userInputRequest(task);
    const requestId = text(payload.requestId);
    if (!requestId) return "request-id-required";
    if (text(request?.requestId) && request.requestId !== requestId) return "request-id-mismatch";
    const hasResolution = Object.prototype.hasOwnProperty.call(payload, "resolution")
      || Object.prototype.hasOwnProperty.call(payload, "choiceId")
      || Object.prototype.hasOwnProperty.call(payload, "value")
      || Object.prototype.hasOwnProperty.call(payload, "answer");
    if (!hasResolution) return "resolution-required";
  }
  if (action === "retarget_output") {
    if (!text(payload.requestedPath)) return "requested-path-required";
    const request = userInputRequest(task);
    if (text(request?.requestId) && !text(payload.requestId)) return "request-id-required";
    if (text(request?.requestId) && request.requestId !== text(payload.requestId)) return "request-id-mismatch";
  }
  if (action === "ack_outcome") {
    if (!text(payload.deliveryId)) return "delivery-id-required";
    if (!text(payload.consumer)) return "consumer-required";
    const entry = (Array.isArray(task?.outbox) ? task.outbox : []).find((item) => item.deliveryId === payload.deliveryId);
    if (!entry || !pendingConsumers(entry).includes(payload.consumer)) return "delivery-not-pending";
  }
  if (action === "retry_delivery") {
    if (text(payload.consumer) !== "conversation") return "delivery-retry-consumer-required";
    if (!text(payload.deliveryId)) return "delivery-id-required";
    const entry = (Array.isArray(task?.outbox) ? task.outbox : []).find((item) => item.deliveryId === payload.deliveryId);
    if (!entry || !pendingConsumers(entry).includes("conversation")) return "delivery-not-pending";
    const status = String(entry?.deliveryStates?.conversation?.status ?? "ready");
    if (!["blocked_user_retry", "exhausted"].includes(status)) return "delivery-not-retryable";
  }
  return null;
}

function validateEpoch(action, task, request) {
  const lifecycle = String(task?.lifecycle ?? task?.status ?? "");
  const expectedEpoch = request.expectedEpoch;
  if (expectedEpoch !== undefined && (!Number.isInteger(expectedEpoch) || Number(task.epoch) !== expectedEpoch)) {
    return "epoch-mismatch";
  }
  if (ACTIVE_LIFECYCLES.has(lifecycle) && ["pause", "cancel"].includes(action)) {
    if (!Number.isInteger(expectedEpoch)) return "expected-epoch-required";
    if (task.lease?.epoch !== undefined && Number(task.lease.epoch) !== Number(task.epoch)) return "lease-epoch-mismatch";
  }
  return null;
}

export function createComplexTaskController({ store } = {}) {
  if (!store || typeof store.read !== "function"
    || typeof store.applyUserControl !== "function"
    || typeof store.ackOutbox !== "function"
    || typeof store.removeIfUnreferenced !== "function") {
    throw new TypeError("complex task controller requires read, applyUserControl, ackOutbox, and removeIfUnreferenced store APIs");
  }

  async function control(id, request = {}) {
    const action = normalizeAction(request.action);
    if (!ACTION_SET.has(action)) return failure("unknown-action", null, { action });
    if (!Number.isInteger(request.expectedRevision)) return failure("expected-revision-required", null, { action });

    const task = await store.read(id);
    if (task.revision !== request.expectedRevision) return failure("revision-mismatch", task, { action });

    const allowed = allowedTaskActions(task);
    if (!allowed.includes(action)) return failure("action-not-allowed", task, { action });

    const epochError = validateEpoch(action, task, request);
    if (epochError) return failure(epochError, task, { action });

    const payload = payloadFor(request, task);
    const payloadError = validatePayload(action, payload, task);
    if (payloadError) return failure(payloadError, task, { action });

    if (action === "ack_outcome") {
      const result = await store.ackOutbox(id, payload.deliveryId, {
        expectedRevision: request.expectedRevision,
        consumer: payload.consumer,
        ...(request.now !== undefined ? { now: request.now } : {}),
      });
      return result?.applied === true ? success(action, result, task) : failedStoreResult(action, result, task);
    }

    if (action === "delete_record") {
      const result = await store.removeIfUnreferenced(id, { expectedRevision: request.expectedRevision });
      return result?.applied === true || result?.deleted === true
        ? { ok: true, applied: true, action, deleted: true }
        : failedStoreResult(action, result, task);
    }

    const controlRequest = {
      action,
      expectedRevision: request.expectedRevision,
      ...(request.expectedEpoch !== undefined ? { expectedEpoch: request.expectedEpoch } : {}),
      ...(task.lease?.leaseId ? { leaseId: task.lease.leaseId } : {}),
      payload: storePayload(action, payload),
    };
    const result = await store.applyUserControl(id, controlRequest);
    return result?.applied === true ? success(action, result, task) : failedStoreResult(action, result, task);
  }

  return { control, allowedTaskActions };
}
