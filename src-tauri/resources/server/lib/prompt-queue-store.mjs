import { assertVersionedJsonWritable, readVersionedJsonFile, writeVersionedJsonFile } from "./versioned-json-file.mjs";

const VERSION = 1;

function cloneMapOfArrays(map) {
  return new Map([...map].map(([key, items]) => [key, [...items]]));
}

export function createPromptQueueStore({
  path,
  normalizeScope,
  normalizeItem,
  queueLimit = 5,
  acceptedLimit = 200,
  acceptedTtlMs = 86_400_000,
  clock = () => Date.now(),
  onIssue = () => {},
} = {}) {
  if (!path || typeof normalizeScope !== "function" || typeof normalizeItem !== "function") {
    throw new TypeError("path, normalizeScope and normalizeItem are required");
  }
  const options = {
    version: VERSION,
    validate: (value) => value.queues && typeof value.queues === "object" && !Array.isArray(value.queues)
      && Array.isArray(value.accepted) || "prompt queue must contain queues and accepted",
  };
  const stored = readVersionedJsonFile(path, options);
  const queues = new Map();
  const accepted = new Map();
  let readOnlyError = stored.error;
  if (stored.ok && stored.value) {
    for (const [scope, rawItems] of Object.entries(stored.value.queues)) {
      const items = Array.isArray(rawItems) ? rawItems.map(normalizeItem).filter(Boolean).slice(0, queueLimit) : [];
      if (items.length) queues.set(normalizeScope(scope), items);
    }
    const now = clock();
    for (const entry of stored.value.accepted.filter((item) => item && typeof item.id === "string" && Number.isFinite(item.acceptedAt) && now - item.acceptedAt < acceptedTtlMs).slice(-acceptedLimit)) {
      accepted.set(entry.id, entry);
    }
  }
  onIssue(readOnlyError);

  function persist() {
    assertVersionedJsonWritable(path, options);
    writeVersionedJsonFile(path, {
      queues: Object.fromEntries([...queues].filter(([, items]) => items.length)),
      accepted: [...accepted.values()].slice(-acceptedLimit),
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
    if (clock() - entry.acceptedAt >= acceptedTtlMs) {
      accepted.delete(id);
      return null;
    }
    return entry;
  }

  function rememberAccepted(id, result = {}) {
    if (!id) return;
    commit(() => {
      accepted.delete(id);
      accepted.set(id, { id, acceptedAt: clock(), turnId: result.turnId ?? null });
      while (accepted.size > acceptedLimit) accepted.delete(accepted.keys().next().value);
    });
  }

  return { list, upsert, remove, acceptedRequest, rememberAccepted, status: () => ({ readOnlyError }) };
}
