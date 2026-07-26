const DEFAULT_MAX_STREAMS = 256;

function asNonNegativeInteger(value, fallback = null) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function streamToken(event) {
  const value = event?.streamId ?? event?.stepId ?? event?.turnId ?? null;
  return value === null || value === undefined ? null : String(value);
}

/**
 * Projects model-loop assistant deltas into one stable Dashboard message.
 *
 * A model retry is a new stream attempt, not a new assistant bubble.  The
 * projector emits a reset marker while preserving the message id.  Explicit
 * offset gaps are surfaced as resync requests; older/duplicate chunks are
 * ignored.  Events from older loop implementations without a stream token
 * remain append-compatible and use the local offset as their source of truth.
 */
export function createAssistantStreamProjector({ maxStreams = DEFAULT_MAX_STREAMS } = {}) {
  if (!Number.isSafeInteger(maxStreams) || maxStreams < 1) throw new TypeError("maxStreams must be a positive integer");
  const streams = new Map();

  function trim() {
    while (streams.size > maxStreams) streams.delete(streams.keys().next().value);
  }

  function keyFor(id, { operationId = null, sessionId = null } = {}) {
    const scope = [sessionId, operationId]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join("|");
    return scope ? `${scope}|${id}` : id;
  }

  function reset(assistantId = null, context = {}) {
    const id = String(assistantId ?? "").trim();
    if (!id) {
      streams.clear();
      return;
    }
    const scopedKey = keyFor(id, context);
    if (scopedKey !== id) {
      streams.delete(scopedKey);
      return;
    }
    // Backward-compatible reset for callers that only know the assistant id.
    // Remove both legacy and scoped entries so a finished operation cannot
    // leak offsets into a later operation with a reused id.
    for (const key of streams.keys()) {
      if (key === id || key.endsWith(`|${id}`)) streams.delete(key);
    }
  }

  function project(event, { assistantId, operationId = null, sessionId = null } = {}) {
    if (String(event?.role ?? "") !== "assistant_delta") return null;
    const id = String(assistantId ?? event?.messageId ?? event?.id ?? "").trim();
    if (!id) return null;
    let key = keyFor(id, { operationId, sessionId });
    // Older callers may omit scope metadata. If there is exactly one scoped
    // stream for this assistant, continue it for compatibility; ambiguous
    // unscoped events must not guess between concurrent operations.
    if (!operationId && !sessionId && !streams.has(key)) {
      const candidates = [...streams.keys()].filter((candidate) => candidate.endsWith(`|${id}`));
      if (candidates.length === 1) key = candidates[0];
    }
    const contentDelta = text(event.content);
    const reasoningDelta = text(event.reasoningDelta);
    if (!contentDelta && !reasoningDelta) return null;

    const attempt = Math.max(1, asNonNegativeInteger(event.attempt, 1));
    const token = streamToken(event);
    const previous = streams.get(key) ?? {
      attempt,
      token,
      contentOffset: 0,
      reasoningOffset: 0,
      revision: 0,
    };
    if (streams.has(key) && attempt < previous.attempt) return null;
    const retry = Boolean(streams.has(key) && attempt > previous.attempt);
    const explicitReset = event.streamReset === true || event.retry === true;
    const resetStream = retry || explicitReset;
    const priorContentOffset = resetStream ? 0 : previous.contentOffset;
    const priorReasoningOffset = resetStream ? 0 : previous.reasoningOffset;
    const enforceOffsets = Boolean(token || event.attempt !== undefined || event.streamId !== undefined || event.streamReset === true || event.retry === true);

    const validateOffset = (field, supplied, expected, value) => {
      if (!value) return { ok: true, offset: expected };
      const offset = asNonNegativeInteger(supplied, null);
      if (!enforceOffsets || offset === null) return { ok: true, offset: expected };
      // A new step in the same assistant turn commonly restarts its local
      // offset at zero. Keep the single Dashboard bubble append-compatible.
      const newStep = token && previous.token && token !== previous.token;
      if (offset === 0 && expected > 0 && newStep && !resetStream) return { ok: true, offset: expected };
      if (offset < expected) return { ok: false, duplicate: true };
      if (offset > expected) return {
        ok: false,
        gap: {
          kind: "resync-required",
          reason: "assistant-delta-gap",
          field,
          messageId: id,
          expectedOffset: expected,
          receivedOffset: offset,
          operationId,
          sessionId,
        },
      };
      return { ok: true, offset };
    };

    const content = validateOffset("content", event.offset, priorContentOffset, contentDelta);
    const reasoning = validateOffset("reasoning", event.reasoningOffset, priorReasoningOffset, reasoningDelta);
    if (content.gap || reasoning.gap) return content.gap ?? reasoning.gap;
    const acceptedContentDelta = content.duplicate ? "" : contentDelta;
    const acceptedReasoningDelta = reasoning.duplicate ? "" : reasoningDelta;
    if (!acceptedContentDelta && !acceptedReasoningDelta) return null;

    const next = {
      attempt,
      token: token ?? previous.token,
      contentOffset: priorContentOffset + acceptedContentDelta.length,
      reasoningOffset: priorReasoningOffset + acceptedReasoningDelta.length,
      revision: previous.revision + (resetStream ? 1 : 0),
    };
    streams.set(key, next);
    trim();

    return {
      kind: "assistant_delta",
      id,
      messageId: id,
      contentDelta: acceptedContentDelta || undefined,
      reasoningDelta: acceptedReasoningDelta || undefined,
      offset: priorContentOffset,
      reasoningOffset: priorReasoningOffset,
      operationId,
      sessionId,
      ...(resetStream ? {
        streamReset: true,
        revision: `attempt:${attempt}:rev:${next.revision}`,
        retry: {
          attempt,
          maxAttempts: asNonNegativeInteger(event.maxAttempts, null),
          reason: String(event.retryReason ?? event.reason ?? "model retry").slice(0, 320),
        },
      } : {}),
    };
  }

  return { project, reset, size: () => streams.size };
}
