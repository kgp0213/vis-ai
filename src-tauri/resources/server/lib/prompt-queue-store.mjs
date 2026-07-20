import { assertVersionedJsonWritable, readVersionedJsonFile, writeVersionedJsonFile } from "./versioned-json-file.mjs";

const VERSION = 1;
const MAX_COMPLETION_TEXT = 32_000;
const MAX_COMPLETION_ERROR = 2_000;

function cloneMapOfArrays(map) {
  return new Map([...map].map(([key, items]) => [key, [...items]]));
}

function text(value, maxLength) {
  if (value === undefined || value === null) return null;
  const result = String(value);
  return Number.isFinite(maxLength) ? result.slice(0, maxLength) : result;
}

function normalizeCompletion(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries({
    ok: value.ok === true,
    cancelled: value.cancelled === true || undefined,
    error: text(value.error, MAX_COMPLETION_ERROR) || undefined,
    assistantText: text(value.assistantText, MAX_COMPLETION_TEXT) || undefined,
    assistantMessageId: text(value.assistantMessageId, 200) || undefined,
    userMessageId: text(value.userMessageId, 200) || undefined,
  }).filter(([, item]) => item !== undefined));
}

function normalizeReceipt(value, isDurableReceiptId = () => false) {
  if (!value || typeof value !== "object" || typeof value.id !== "string" || !Number.isFinite(value.acceptedAt)) return null;
  const completion = normalizeCompletion(value.completion);
  const state = value.state === "completed" && completion
    ? "completed"
    : value.state === "failed"
      ? "failed"
      : "accepted";
  const durable = typeof value.durable === "boolean"
    ? value.durable
    : isDurableReceiptId(value.id) === true;
  return {
    id: value.id,
    acceptedAt: Number(value.acceptedAt),
    turnId: text(value.turnId, 200),
    state,
    ownerBootId: text(value.ownerBootId, 200),
    ...(durable || value.durable === false ? { durable } : {}),
    ...(state === "completed" ? {
      completedAt: Number.isFinite(value.completedAt) ? Number(value.completedAt) : Number(value.acceptedAt),
      completion,
    } : state === "failed" ? {
      failedAt: Number.isFinite(value.failedAt) ? Number(value.failedAt) : Number(value.acceptedAt),
      error: text(value.error, MAX_COMPLETION_ERROR) || "本轮执行结果无法确认，未自动重试。",
    } : {}),
  };
}

/**
 * Decide whether a request receipt belongs to this process or can be safely
 * reused. Completed receipts are reusable because the caller can acknowledge
 * the durable delivery without running the model a second time. An accepted
 * receipt owned by another boot is deliberately uncertain: replaying it could
 * duplicate a side effect or visible response.
 */
export function promptRequestReceiptDecision(receipt, ownerBootId) {
  if (!receipt || typeof receipt !== "object") return { action: "execute" };
  if (receipt.state === "completed" && receipt.completion && typeof receipt.completion === "object") {
    return { action: "reuse-completion", completion: structuredClone(receipt.completion) };
  }
  if (receipt.state === "failed") {
    return { action: "failed", reason: text(receipt.error, MAX_COMPLETION_ERROR) || "本轮执行结果无法确认，未自动重试。" };
  }
  if (receipt.state === "accepted" && receipt.ownerBootId && receipt.ownerBootId === ownerBootId) {
    return { action: "in-flight" };
  }
  if (receipt.state === "accepted") {
    return {
      action: "uncertain",
      reason: "上一次进程已接受请求，但结果未确认；为避免重复执行，未自动重试。请显式重新提交。",
    };
  }
  return { action: "execute" };
}

export function createPromptQueueStore({
  path,
  normalizeScope,
  normalizeItem,
  queueLimit = 5,
  acceptedLimit = 200,
  acceptedTtlMs = 86_400_000,
  isDurableReceiptId = () => false,
  clock = () => Date.now(),
  onIssue = () => {},
} = {}) {
  if (!path || typeof normalizeScope !== "function" || typeof normalizeItem !== "function"
    || typeof isDurableReceiptId !== "function") {
    throw new TypeError("path, normalizeScope, normalizeItem and isDurableReceiptId are required functions");
  }
  const options = {
    version: VERSION,
    validate: (value) => Boolean(value.queues && typeof value.queues === "object" && !Array.isArray(value.queues)
      && Array.isArray(value.accepted)) || "prompt queue must contain queues and accepted",
  };
  const stored = readVersionedJsonFile(path, options);
  const queues = new Map();
  const accepted = new Map();
  const durableReceipt = (id, entry = null) => entry?.durable === false
    ? false
    : entry?.durable === true || isDurableReceiptId(id) === true;
  const durabilityMarker = (id, entry = null) => entry?.durable === false
    ? { durable: false }
    : durableReceipt(id, entry)
      ? { durable: true }
      : {};

  function pruneAccepted() {
    let ordinaryCount = 0;
    for (const [id, entry] of accepted) {
      if (!durableReceipt(id, entry)) ordinaryCount += 1;
    }
    for (const [id, entry] of accepted) {
      if (ordinaryCount <= acceptedLimit) break;
      if (durableReceipt(id, entry)) continue;
      accepted.delete(id);
      ordinaryCount -= 1;
    }
  }

  let readOnlyError = stored.error;
  if (stored.ok && stored.value) {
    for (const [scope, rawItems] of Object.entries(stored.value.queues)) {
      const items = Array.isArray(rawItems) ? rawItems.map(normalizeItem).filter(Boolean).slice(0, queueLimit) : [];
      if (items.length) queues.set(normalizeScope(scope), items);
    }
    const now = clock();
    for (const entry of stored.value.accepted
      .map((item) => normalizeReceipt(item, isDurableReceiptId))
      .filter((item) => item && (durableReceipt(item.id, item) || now - item.acceptedAt < acceptedTtlMs))) {
      accepted.set(entry.id, entry);
    }
    pruneAccepted();
  }
  onIssue(readOnlyError);

  function persist() {
    assertVersionedJsonWritable(path, options);
    writeVersionedJsonFile(path, {
      queues: Object.fromEntries([...queues].filter(([, items]) => items.length)),
      accepted: [...accepted.values()],
    }, { version: VERSION });
    readOnlyError = null;
    onIssue(null);
  }

  function commit(mutate) {
    if (readOnlyError) throw new Error(`${readOnlyError}; original prompt queue was not modified`);
    const beforeQueues = cloneMapOfArrays(queues);
    const beforeAccepted = new Map(accepted);
    try {
      const result = mutate();
      persist();
      return result;
    } catch (error) {
      queues.clear();
      for (const [scope, items] of beforeQueues) queues.set(scope, items);
      accepted.clear();
      for (const [id, entry] of beforeAccepted) accepted.set(id, entry);
      throw error;
    }
  }

  function list(scope) {
    return [...(queues.get(normalizeScope(scope)) ?? [])];
  }

  function upsert(scope, rawItem) {
    const key = normalizeScope(scope);
    const item = normalizeItem(rawItem);
    if (!item) return { ok: false, error: "invalid queued prompt" };
    const current = list(key);
    const index = current.findIndex((entry) => entry.id === item.id);
    if (index >= 0) current[index] = item;
    else if (current.length < queueLimit) current.push(item);
    else return { ok: false, error: `queue limit is ${queueLimit}` };
    return commit(() => {
      queues.set(key, current);
      return { ok: true, item, items: current };
    });
  }

  function remove(scope, id = null) {
    const key = normalizeScope(scope);
    const current = id ? list(key).filter((entry) => entry.id !== id) : [];
    return commit(() => {
      if (current.length) queues.set(key, current);
      else queues.delete(key);
      return { ok: true, items: current };
    });
  }

  function acceptedRequest(id) {
    if (!id) return null;
    const entry = accepted.get(id);
    if (!entry) return null;
    if (!durableReceipt(id, entry) && clock() - entry.acceptedAt >= acceptedTtlMs) {
      accepted.delete(id);
      return null;
    }
    return structuredClone(entry);
  }

  function rememberAccepted(id, result = {}) {
    if (!id) return;
    return commit(() => {
      const current = accepted.get(id);
      const entry = {
        id,
        acceptedAt: clock(),
        turnId: text(result.turnId, 200),
        state: "accepted",
        ownerBootId: text(result.ownerBootId, 200),
        ...durabilityMarker(id, current),
      };
      accepted.delete(id);
      accepted.set(id, entry);
      pruneAccepted();
      return structuredClone(entry);
    });
  }

  function rememberCompleted(id, completion, result = {}) {
    if (!id) return;
    const normalized = normalizeCompletion(completion);
    if (!normalized) throw new TypeError("prompt completion is required");
    return commit(() => {
      const current = accepted.get(id);
      const entry = {
        id,
        acceptedAt: current?.acceptedAt ?? clock(),
        turnId: current?.turnId ?? text(normalized.assistantMessageId, 200),
        state: "completed",
        ownerBootId: text(result.ownerBootId, 200) ?? current?.ownerBootId ?? null,
        completedAt: clock(),
        completion: normalized,
        ...durabilityMarker(id, current),
      };
      accepted.delete(id);
      accepted.set(id, entry);
      pruneAccepted();
      return structuredClone(entry);
    });
  }

  function rememberFailed(id, error, result = {}) {
    if (!id) return;
    return commit(() => {
      const current = accepted.get(id);
      const entry = {
        id,
        acceptedAt: current?.acceptedAt ?? clock(),
        turnId: current?.turnId ?? null,
        state: "failed",
        ownerBootId: text(result.ownerBootId, 200) ?? current?.ownerBootId ?? null,
        failedAt: clock(),
        error: text(error, MAX_COMPLETION_ERROR) || "本轮执行结果无法确认，未自动重试。",
        ...durabilityMarker(id, current),
      };
      accepted.delete(id);
      accepted.set(id, entry);
      pruneAccepted();
      return structuredClone(entry);
    });
  }

  function releaseReceipt(id) {
    if (!id) return { ok: false, error: "prompt receipt id is required" };
    const current = accepted.get(id);
    if (!current) return { ok: false, error: "prompt receipt was not found" };
    if (current.state !== "completed") {
      return { ok: false, error: "only a completed prompt receipt can be released" };
    }
    return commit(() => {
      const entry = {
        ...current,
        acceptedAt: clock(),
        durable: false,
      };
      accepted.delete(id);
      accepted.set(id, entry);
      pruneAccepted();
      return { ok: true, receipt: structuredClone(entry) };
    });
  }

  return {
    list,
    upsert,
    remove,
    acceptedRequest,
    rememberAccepted,
    rememberCompleted,
    rememberFailed,
    releaseReceipt,
    status: () => ({ readOnlyError }),
  };
}
