import { createHash, randomUUID } from "node:crypto";

const TERMINAL_STATES = new Set(["completed", "cancelled", "failed", "unknown"]);

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function text(value) {
  return String(value ?? "").trim();
}

function normalizeLocation(location = {}) {
  const sessionId = text(location.sessionId ?? location.conversationId);
  const workspace = text(location.workspace ?? location.workspaceDir);
  return {
    sessionId: sessionId || null,
    workspace: workspace || null,
  };
}

function fingerprint(location) {
  const value = normalizeLocation(location);
  return createHash("sha256")
    .update(JSON.stringify([value.sessionId, value.workspace]))
    .digest("hex");
}

function publicRun(run) {
  if (!run) return null;
  return {
    runId: run.runId,
    sessionId: run.sessionId,
    operationId: run.operationId,
    state: run.state,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt ?? null,
    location: clone(run.location),
    locationFingerprint: run.locationFingerprint,
    requestId: run.requestId,
    queuedWakeCount: run.wakes.length,
  };
}

function invalidInput(message) {
  const error = new TypeError(message);
  error.code = "INVALID_SESSION_RUN";
  return error;
}

/**
 * Coordinates process-local runs by Session. It deliberately does not call
 * the model loop. The Launcher owns execution; this module only admits a
 * run, coalesces repeated wakes and fences a run against a changed Session
 * location.
 */
export function createSessionRunCoordinator({
  getLocation = () => ({}),
  idFactory = randomUUID,
  now = () => new Date().toISOString(),
  maxQueuedWakes = 8,
  onEvent = () => {},
} = {}) {
  const activeBySession = new Map();
  const activeByRun = new Map();

  function emit(kind, run, details = {}) {
    try {
      onEvent({ kind, run: publicRun(run), ...details });
    } catch {
      // Observers are diagnostic only and must never block admission or cleanup.
    }
  }

  function resolveLocation(input = {}) {
    const supplied = normalizeLocation(input);
    if (supplied.sessionId || supplied.workspace) return supplied;
    return normalizeLocation(getLocation());
  }

  function requireSession(location) {
    if (!location.sessionId) throw invalidInput("sessionId is required");
    return location;
  }

  function getActive(sessionId) {
    return activeBySession.get(text(sessionId)) ?? null;
  }

  function begin(input = {}) {
    const location = requireSession(resolveLocation(input));
    const sessionId = location.sessionId;
    const requestId = text(input.requestId) || null;
    const existing = activeBySession.get(sessionId);
    if (existing && existing.state === "running") {
      if (requestId && existing.requestId === requestId) {
        return { accepted: false, duplicate: true, coalesced: false, run: publicRun(existing) };
      }
      if (input.coalesce !== false) {
        return queueWake(existing, { requestId, reason: input.reason ?? "follow-up" });
      }
      return {
        accepted: false,
        duplicate: false,
        coalesced: false,
        code: "SESSION_RUN_ACTIVE",
        run: publicRun(existing),
      };
    }

    const run = {
      runId: String(input.runId ?? `session-run:${idFactory()}`),
      sessionId,
      operationId: text(input.operationId) || null,
      requestId,
      state: "running",
      startedAt: now(),
      finishedAt: null,
      location,
      locationFingerprint: fingerprint(location),
      wakes: [],
    };
    activeBySession.set(sessionId, run);
    activeByRun.set(run.runId, run);
    emit("session-run.started", run);
    return { accepted: true, duplicate: false, coalesced: false, run: publicRun(run) };
  }

  function queueWake(run, input = {}) {
    const requestId = text(input.requestId) || null;
    if (requestId && run.wakes.some((wake) => wake.requestId === requestId)) {
      return { accepted: true, duplicate: true, coalesced: true, wake: clone(run.wakes.find((wake) => wake.requestId === requestId)), run: publicRun(run) };
    }
    if (run.wakes.length >= Math.max(1, Number(maxQueuedWakes) || 8)) {
      return { accepted: false, coalesced: false, code: "SESSION_WAKE_QUEUE_FULL", run: publicRun(run) };
    }
    const wake = {
      wakeId: `wake:${idFactory()}`,
      requestId,
      reason: text(input.reason) || "follow-up",
      queuedAt: now(),
    };
    run.wakes.push(wake);
    emit("session-run.wake-queued", run, { wake: clone(wake) });
    return { accepted: true, duplicate: false, coalesced: true, wake: clone(wake), run: publicRun(run) };
  }

  function assertCurrent(runOrId, locationInput = {}) {
    const run = typeof runOrId === "string" ? activeByRun.get(runOrId) : runOrId;
    if (!run || activeByRun.get(run.runId) !== run) {
      return { ok: false, code: "SESSION_RUN_NOT_FOUND", reason: "session run is no longer active" };
    }
    if (run.state !== "running") {
      return { ok: false, code: "SESSION_RUN_TERMINAL", reason: `session run is ${run.state}`, run: publicRun(run) };
    }
    const current = resolveLocation(locationInput);
    const currentFingerprint = fingerprint(current);
    if (currentFingerprint !== run.locationFingerprint) {
      emit("session-run.fenced", run, { currentLocation: clone(current) });
      return {
        ok: false,
        code: "SESSION_LOCATION_CHANGED",
        reason: "session workspace or identity changed while the run was active",
        expected: { ...clone(run.location), fingerprint: run.locationFingerprint },
        actual: { ...clone(current), fingerprint: currentFingerprint },
        run: publicRun(run),
      };
    }
    return { ok: true, run: publicRun(run), location: clone(current) };
  }

  function finish(runOrId, state = "completed", details = {}) {
    const run = typeof runOrId === "string" ? activeByRun.get(runOrId) : runOrId;
    if (!run || activeByRun.get(run.runId) !== run) return { accepted: false, code: "SESSION_RUN_NOT_FOUND" };
    if (!TERMINAL_STATES.has(state)) throw invalidInput(`invalid terminal state: ${state}`);
    if (run.state !== "running") return { accepted: false, duplicate: true, run: publicRun(run) };
    run.state = state;
    run.finishedAt = now();
    activeByRun.delete(run.runId);
    if (activeBySession.get(run.sessionId) === run) activeBySession.delete(run.sessionId);
    const nextWake = run.wakes.shift() ?? null;
    emit("session-run.finished", run, { state, nextWake: clone(nextWake), ...details });
    return { accepted: true, duplicate: false, run: publicRun(run), nextWake: clone(nextWake) };
  }

  function interrupt(runOrId, reason = "interrupted") {
    return finish(runOrId, "unknown", { reason });
  }

  return {
    begin,
    queueWake: (runOrId, input) => {
      const run = typeof runOrId === "string" ? activeByRun.get(runOrId) : runOrId;
      if (!run || activeByRun.get(run.runId) !== run) return { accepted: false, code: "SESSION_RUN_NOT_FOUND" };
      if (run.state !== "running") return { accepted: false, code: "SESSION_RUN_TERMINAL", run: publicRun(run) };
      return queueWake(run, input);
    },
    assertCurrent,
    finish,
    interrupt,
    getActive: (sessionId) => publicRun(getActive(sessionId)),
    listActive: () => [...activeBySession.values()].map(publicRun),
  };
}

export { fingerprint as sessionLocationFingerprint };
