import { createHash, randomUUID } from "node:crypto";

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function text(value) {
  return String(value ?? "").trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function locationFor(input = {}) {
  const sessionId = text(input.sessionId ?? input.conversationId);
  const workspace = text(input.workspace ?? input.workspaceDir);
  return { sessionId: sessionId || null, workspace: workspace || null };
}

function locationHash(location) {
  return hashValue([location.sessionId, location.workspace]);
}

function publicEpoch(epoch) {
  if (!epoch) return null;
  return {
    epochId: epoch.epochId,
    sessionId: epoch.sessionId,
    workspace: epoch.workspace,
    revision: epoch.revision,
    baselineSeq: epoch.baselineSeq,
    baselineHash: epoch.baselineHash,
    snapshotHash: epoch.snapshotHash,
    replacementRequested: epoch.replacementRequested,
    replacementReason: epoch.replacementReason,
    createdAt: epoch.createdAt,
    updatedAt: epoch.updatedAt,
  };
}

function invalidInput(message) {
  const error = new TypeError(message);
  error.code = "INVALID_CONTEXT_EPOCH";
  return error;
}

/**
 * Keeps the model-visible context baseline separate from the durable history.
 * A normal reconciliation advances only the observed snapshot. A replacement
 * (for example after compaction or a model/location change) atomically swaps
 * the baseline and snapshot. Failed preparation never mutates the stored
 * epoch because callers only commit through prepare().
 */
export function createContextEpochRuntime({
  idFactory = randomUUID,
  now = () => new Date().toISOString(),
  maxBaselineChars = 64_000,
  maxSnapshotBytes = 256_000,
  onEvent = () => {},
} = {}) {
  const epochs = new Map();

  function emit(kind, epoch, details = {}) {
    try {
      onEvent({ kind, epoch: publicEpoch(epoch), ...details });
    } catch {
      // Diagnostic observers must not make context admission fail.
    }
  }

  function get(sessionId) {
    return epochs.get(text(sessionId)) ?? null;
  }

  function initialize(input = {}) {
    const location = locationFor(input);
    if (!location.sessionId) throw invalidInput("sessionId is required");
    const baseline = text(input.baseline).slice(0, maxBaselineChars);
    const snapshot = clone(input.snapshot ?? {});
    const snapshotText = JSON.stringify(stableValue(snapshot));
    if (Buffer.byteLength(snapshotText, "utf8") > maxSnapshotBytes) {
      throw invalidInput("context snapshot is too large");
    }
    const epoch = {
      epochId: text(input.epochId) || `context-epoch:${idFactory()}`,
      sessionId: location.sessionId,
      workspace: location.workspace,
      locationHash: locationHash(location),
      baseline,
      snapshot,
      revision: 1,
      baselineSeq: Number.isSafeInteger(input.baselineSeq) ? Math.max(0, input.baselineSeq) : 0,
      baselineHash: hashValue(baseline),
      snapshotHash: hashValue(snapshot),
      replacementRequested: false,
      replacementReason: null,
      createdAt: now(),
      updatedAt: now(),
    };
    epochs.set(location.sessionId, epoch);
    emit("context-epoch.initialized", epoch);
    return { action: "initialized", changed: true, epoch: publicEpoch(epoch) };
  }

  function prepare(input = {}) {
    const location = locationFor(input);
    if (!location.sessionId) throw invalidInput("sessionId is required");
    const baseline = text(input.baseline).slice(0, maxBaselineChars);
    const snapshot = clone(input.snapshot ?? {});
    const snapshotText = JSON.stringify(stableValue(snapshot));
    if (Buffer.byteLength(snapshotText, "utf8") > maxSnapshotBytes) {
      throw invalidInput("context snapshot is too large");
    }
    const existing = epochs.get(location.sessionId);
    if (!existing) return initialize({ ...input, baseline, snapshot });

    const incomingLocationHash = locationHash(location);
    if (existing.locationHash !== incomingLocationHash) {
      return {
        action: "blocked",
        changed: false,
        code: "CONTEXT_EPOCH_LOCATION_CHANGED",
        reason: "context epoch belongs to a different workspace or session location",
        expected: publicEpoch(existing),
        actual: { sessionId: location.sessionId, workspace: location.workspace, locationHash: incomingLocationHash },
      };
    }

    const nextSnapshotHash = hashValue(snapshot);
    const nextBaselineHash = hashValue(baseline);
    const replacement = existing.replacementRequested || nextBaselineHash !== existing.baselineHash;
    if (replacement) {
      existing.baseline = baseline;
      existing.snapshot = snapshot;
      existing.baselineHash = nextBaselineHash;
      existing.snapshotHash = nextSnapshotHash;
      existing.baselineSeq = Number.isSafeInteger(input.baselineSeq) ? Math.max(0, input.baselineSeq) : existing.baselineSeq;
      existing.revision += 1;
      existing.replacementRequested = false;
      existing.replacementReason = null;
      existing.updatedAt = now();
      emit("context-epoch.replaced", existing);
      return { action: "replaced", changed: true, epoch: publicEpoch(existing) };
    }
    if (nextSnapshotHash !== existing.snapshotHash) {
      existing.snapshot = snapshot;
      existing.snapshotHash = nextSnapshotHash;
      existing.revision += 1;
      existing.updatedAt = now();
      emit("context-epoch.reconciled", existing);
      return { action: "reconciled", changed: true, epoch: publicEpoch(existing) };
    }
    return { action: "unchanged", changed: false, epoch: publicEpoch(existing) };
  }

  function requestReplacement(sessionId, reason = "manual") {
    const epoch = get(sessionId);
    if (!epoch) return { accepted: false, code: "CONTEXT_EPOCH_NOT_FOUND" };
    epoch.replacementRequested = true;
    epoch.replacementReason = text(reason) || "manual";
    epoch.updatedAt = now();
    emit("context-epoch.replacement-requested", epoch, { reason: epoch.replacementReason });
    return { accepted: true, epoch: publicEpoch(epoch) };
  }

  function reset(sessionId, reason = "reset") {
    const id = text(sessionId);
    const epoch = epochs.get(id);
    if (!epoch) return { accepted: false, code: "CONTEXT_EPOCH_NOT_FOUND" };
    epochs.delete(id);
    emit("context-epoch.reset", epoch, { reason: text(reason) || "reset" });
    return { accepted: true, epoch: publicEpoch(epoch) };
  }

  function modelBaseline(sessionId) {
    const epoch = get(sessionId);
    return epoch ? { baseline: epoch.baseline, snapshot: clone(epoch.snapshot), epoch: publicEpoch(epoch) } : null;
  }

  return {
    initialize,
    prepare,
    requestReplacement,
    reset,
    get: (sessionId) => publicEpoch(get(sessionId)),
    modelBaseline,
    list: () => [...epochs.values()].map(publicEpoch),
  };
}

export { hashValue as contextEpochHash, locationHash as contextEpochLocationHash };
