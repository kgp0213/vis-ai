import { randomUUID } from "node:crypto";

import { validateDashboardEvent } from "./execution-schema.mjs";

const DEFAULT_CAPACITY = 2048;
const TRANSIENT_KINDS = new Set([
  "assistant_delta",
  "reasoning_delta",
  "status",
  "ping",
  "overview",
  "health",
  "logs",
]);

function parseCursor(value) {
  const match = /^([^:]+):(\d+)$/u.exec(String(value ?? "").trim());
  if (!match) return null;
  const seq = Number(match[2]);
  return Number.isSafeInteger(seq) && seq >= 0 ? { epoch: match[1], seq } : null;
}

function cursor(epoch, seq) {
  return `${epoch}:${seq}`;
}

function isReplayable(event) {
  return event?.replayable === true || !TRANSIENT_KINDS.has(String(event?.kind ?? ""));
}

/** Process-local ordered Dashboard event stream with bounded replay. */
export function createDashboardEventStream({ epoch = randomUUID(), capacity = DEFAULT_CAPACITY, now = () => new Date() } = {}) {
  if (!String(epoch).trim() || String(epoch).includes(":")) throw new TypeError("dashboard event epoch must be non-empty and cannot contain ':'");
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new TypeError("dashboard event capacity must be a positive integer");
  const normalizedEpoch = String(epoch);
  const ring = [];
  const subscribers = new Set();
  let nextSeq = 1;
  let committedSeq = 0;
  const staged = new Map();

  function buildEvent(event) {
    if (!event || typeof event !== "object") return event;
    if (["eventEpoch", "eventSeq", "eventId"].some((field) => event[field] !== undefined && event[field] !== null)) {
      throw new TypeError("execution schema violation: producer_cursor_fields_forbidden");
    }
    const base = {
      ...event,
      schemaVersion: Number.isSafeInteger(Number(event.schemaVersion)) ? Number(event.schemaVersion) : 1,
      occurredAt: event.occurredAt ?? now().toISOString(),
      operationId: event.operationId ?? null,
      sessionId: event.sessionId ?? null,
      entityId: event.entityId ?? event.toolCallId ?? event.interactionId ?? event.attachmentId ?? event.artifactId ?? event.id ?? null,
    };
    let delivered = base;
    if (isReplayable(event)) {
      const seq = nextSeq++;
      delivered = {
        ...base,
        eventEpoch: normalizedEpoch,
        eventSeq: seq,
        eventId: cursor(normalizedEpoch, seq),
        emittedAt: now().toISOString(),
      };
    }
    const validation = validateDashboardEvent(delivered);
    if (!validation.ok) {
      throw new TypeError(`execution schema violation: ${validation.errors.join(", ")}`);
    }
    return delivered;
  }

  function deliver(delivered) {
    for (const subscriber of [...subscribers]) {
      if (!subscriber.active) continue;
      if (subscriber.replaying) {
        subscriber.queued.push(delivered);
        continue;
      }
      try { subscriber.handler(delivered); } catch { /* A Dashboard subscriber cannot stop the runtime. */ }
    }
  }

  function stage(event) {
    const delivered = buildEvent(event);
    if (delivered?.eventSeq !== undefined && delivered?.eventSeq !== null) staged.set(delivered.eventId, delivered);
    return delivered;
  }

  function commit(delivered) {
    if (!delivered || typeof delivered !== "object") return delivered;
    const sequence = delivered.eventSeq;
    if (sequence !== undefined && sequence !== null) {
      if (sequence <= committedSeq) return delivered;
      if (sequence !== committedSeq + 1) throw new Error("dashboard event commit sequence gap");
      staged.delete(delivered.eventId);
      ring.push(delivered);
      if (ring.length > capacity) ring.shift();
      committedSeq = sequence;
    }
    deliver(delivered);
    return delivered;
  }

  function abort(delivered, reason = "event-persistence-failed") {
    if (!delivered || delivered.eventSeq === undefined || delivered.eventSeq === null) return delivered;
    const replacement = {
      ...delivered,
      kind: "resync-required",
      reason,
      failedEventId: delivered.eventId,
      failedEventKind: delivered.kind,
    };
    staged.delete(delivered.eventId);
    return commit(replacement);
  }

  function publish(event) {
    return commit(stage(event));
  }

  function replay(value) {
    const parsed = parseCursor(value);
    const latestSeq = committedSeq;
    const latestCursor = cursor(normalizedEpoch, latestSeq);
    const oldestSeq = ring[0]?.eventSeq ?? committedSeq + 1;
    if (!parsed) {
      return { ok: false, reason: "invalid-cursor", epoch: normalizedEpoch, oldestCursor: cursor(normalizedEpoch, oldestSeq), latestCursor };
    }
    if (parsed.epoch !== normalizedEpoch) {
      return { ok: false, reason: "epoch-changed", epoch: normalizedEpoch, oldestCursor: cursor(normalizedEpoch, oldestSeq), latestCursor };
    }
    if (parsed.seq > latestSeq) {
      return { ok: false, reason: "cursor-ahead", epoch: normalizedEpoch, oldestCursor: cursor(normalizedEpoch, oldestSeq), latestCursor };
    }
    if (parsed.seq < oldestSeq - 1) {
      return { ok: false, reason: "cursor-too-old", epoch: normalizedEpoch, oldestCursor: cursor(normalizedEpoch, oldestSeq), latestCursor };
    }
    return {
      ok: true,
      epoch: normalizedEpoch,
      events: ring.filter((event) => event.eventSeq > parsed.seq),
      latestCursor,
    };
  }

  function subscribe(handler, { cursor: requestedCursor = null } = {}) {
    if (typeof handler !== "function") throw new TypeError("dashboard event subscriber must be a function");
    const subscriber = {
      handler,
      active: true,
      replaying: Boolean(requestedCursor),
      queued: [],
    };
    subscribers.add(subscriber);
    if (!requestedCursor) return () => {
      subscriber.active = false;
      subscribers.delete(subscriber);
    };

    const deliver = (event) => {
      if (!subscriber.active) return;
      try { subscriber.handler(event); } catch { /* A Dashboard subscriber cannot stop the runtime. */ }
    };
    const snapshot = replay(requestedCursor);
    if (snapshot.ok) {
      for (const event of snapshot.events) deliver(event);
    } else {
      deliver({ kind: "resync-required", ...snapshot });
    }
    if (subscriber.active) {
      // Keep the barrier active while draining. A replay handler may publish
      // synchronously; those events must remain behind every already queued
      // event instead of being delivered in the middle of the drain.
      while (subscriber.active && subscriber.queued.length > 0) {
        const queued = subscriber.queued;
        subscriber.queued = [];
        for (const event of queued) deliver(event);
      }
      subscriber.replaying = false;
    }
    return () => {
      subscriber.active = false;
      subscribers.delete(subscriber);
    };
  }

  return {
    epoch: normalizedEpoch,
    publish,
    stage,
    commit,
    abort,
    replay,
    subscribe,
    latestCursor: () => cursor(normalizedEpoch, committedSeq),
    size: () => ring.length,
  };
}

export { DEFAULT_CAPACITY as DASHBOARD_EVENT_CAPACITY, TRANSIENT_KINDS as TRANSIENT_DASHBOARD_EVENT_KINDS };
