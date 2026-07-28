import { randomUUID } from "node:crypto";

const TERMINAL_STATES = new Set(["completed", "cancelled", "failed", "unknown"]);

function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function publicTurn(turn) {
  if (!turn) return null;
  return {
    turnId: turn.turnId,
    sessionId: turn.sessionId,
    operationId: turn.operationId,
    requestId: turn.requestId,
    workspace: turn.workspace,
    state: turn.state,
    startedAt: turn.startedAt,
    finishedAt: turn.finishedAt,
    nextStep: turn.nextStep,
  };
}

/**
 * Process-local coordinator for turn facts. It admits one active turn per
 * session and never calls a provider or tool loop; Launcher remains the only
 * execution engine.
 */
export function createTurnCoordinator({ idFactory = randomUUID, now = () => new Date().toISOString(), onEvent = () => {} } = {}) {
  const active = new Map();
  const finished = new Map();

  function emit(kind, turn, details = {}) {
    try { onEvent({ kind, turn: publicTurn(turn), ...details }); } catch { /* diagnostics cannot block execution */ }
  }

  function begin({ sessionId, operationId = null, requestId = null, workspace = null, turnId = null } = {}) {
    const session = text(sessionId);
    if (!session) return { accepted: false, code: "TURN_SESSION_REQUIRED" };
    const existing = active.get(session);
    if (existing?.state === "running") {
      if (requestId && existing.requestId === requestId) return { accepted: false, duplicate: true, turn: publicTurn(existing) };
      return { accepted: false, code: "TURN_ACTIVE", turn: publicTurn(existing) };
    }
    const turn = {
      turnId: text(turnId, `turn:${idFactory()}`),
      sessionId: session,
      operationId: text(operationId) || null,
      requestId: text(requestId) || null,
      workspace: text(workspace) || null,
      state: "running",
      startedAt: now(),
      finishedAt: null,
      nextStep: 1,
    };
    active.set(session, turn);
    emit("turn.started", turn);
    return { accepted: true, duplicate: false, turn: publicTurn(turn) };
  }

  function step(turnOrId, { stepId = null } = {}) {
    const turn = typeof turnOrId === "string" ? [...active.values()].find((entry) => entry.turnId === turnOrId) : turnOrId;
    if (!turn || turn.state !== "running") return { accepted: false, code: "TURN_NOT_ACTIVE" };
    const id = text(stepId, `${turn.turnId}.s${turn.nextStep}`);
    turn.nextStep += 1;
    emit("turn.step", turn, { stepId: id });
    return { accepted: true, stepId: id, turn: publicTurn(turn) };
  }

  function finish(turnOrId, state = "unknown", details = {}) {
    const turn = typeof turnOrId === "string" ? [...active.values()].find((entry) => entry.turnId === turnOrId) : turnOrId;
    if (!turn) {
      const prior = finished.get(typeof turnOrId === "string" ? turnOrId : turnOrId?.turnId);
      return prior ? { accepted: false, duplicate: true, turn: publicTurn(prior) } : { accepted: false, code: "TURN_NOT_FOUND" };
    }
    if (!TERMINAL_STATES.has(state)) return { accepted: false, code: "TURN_INVALID_STATE" };
    if (turn.state !== "running") return { accepted: false, duplicate: true, turn: publicTurn(turn) };
    turn.state = state;
    turn.finishedAt = now();
    active.delete(turn.sessionId);
    finished.set(turn.turnId, turn);
    while (finished.size > 128) finished.delete(finished.keys().next().value);
    emit("turn.finished", turn, { state, ...details });
    return { accepted: true, duplicate: false, turn: publicTurn(turn) };
  }

  return {
    begin,
    step,
    finish,
    cancel: (turnOrId, reason = "cancelled") => finish(turnOrId, "cancelled", { reason }),
    interrupt: (turnOrId, reason = "interrupted") => finish(turnOrId, "unknown", { reason }),
    getActive: (sessionId) => publicTurn(active.get(text(sessionId))),
    listActive: () => [...active.values()].map(publicTurn),
  };
}

export { TERMINAL_STATES };
