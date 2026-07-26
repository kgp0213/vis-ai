export const EXECUTION_PHASES = Object.freeze([
  "running",
  "streaming",
  "tool_call",
  "retrying",
  "awaiting_approval",
  "interrupted",
  "ended",
]);

const TERMINAL_PHASES = new Set(["interrupted", "ended"]);
const TERMINAL_STATES = new Set(["completed", "cancelled", "failed", "unknown"]);

function text(value) { return String(value ?? "").trim(); }

function terminalState(value) {
  const normalized = text(value).toLowerCase();
  return TERMINAL_STATES.has(normalized) ? normalized : null;
}

export function phaseForEvent(event = {}) {
  const role = text(event.role ?? event.kind).toLowerCase();
  if (["assistant_delta", "reasoning_delta", "assistant_start"].includes(role)) return "streaming";
  if (["tool_queued", "tool_start", "tool", "tool_call", "tool_result"].includes(role)) return "tool_call";
  if (["model-retry", "model_retry", "retry"].includes(role)) return "retrying";
  if (["awaiting_approval", "interaction_pending", "modal"].includes(role)) return "awaiting_approval";
  if (["assistant_final", "error", "operation_finished", "ended"].includes(role)) return "ended";
  if (["operation_started", "running"].includes(role)) return "running";
  return null;
}

export function createExecutionPhaseTracker({ operationId = null, sessionId = null, turnId = null, now = () => new Date().toISOString() } = {}) {
  let current = {
    phase: "running",
    terminalState: null,
    operationId: text(operationId) || null,
    sessionId: text(sessionId) || null,
    turnId: text(turnId) || null,
    stepId: null,
    toolCallId: null,
    reason: null,
    updatedAt: now(),
  };

  function transition(phase, details = {}) {
    if (!EXECUTION_PHASES.includes(phase)) return { accepted: false, changed: false, reason: "invalid_phase", state: snapshot() };
    const requestedTerminal = terminalState(details.terminalState);
    // The vendored loop emits an assistant_final envelope before executing
    // returned tool calls. Until the turn receipt commits a terminal state,
    // that provisional `ended` phase may legitimately move back to tool_call
    // or retrying; once terminalState is set, all late phases are rejected.
    const provisionalEnvelope = current.phase === "ended"
      && current.terminalState === null
      && ["tool_call", "retrying"].includes(phase);
    if (TERMINAL_PHASES.has(current.phase) && phase !== current.phase && !provisionalEnvelope) {
      return { accepted: false, changed: false, reason: "late_phase", state: snapshot() };
    }
    if (current.terminalState !== null && TERMINAL_PHASES.has(current.phase)) {
      // Terminal facts are write-once.  In particular, a second finish() must
      // not turn a completed/cancelled/failed operation into a different
      // result, even when the late callback uses the same phase name.
      return { accepted: false, changed: false, reason: "terminal_state_committed", state: snapshot() };
    }
    const next = {
      ...current,
      phase,
      stepId: text(details.stepId) || current.stepId,
      toolCallId: text(details.toolCallId) || current.toolCallId,
      reason: text(details.reason) || current.reason,
      terminalState: requestedTerminal ?? current.terminalState,
      updatedAt: now(),
    };
    const changed = JSON.stringify(next) !== JSON.stringify(current);
    current = next;
    return { accepted: true, changed, state: snapshot() };
  }

  function observe(event = {}) {
    const phase = phaseForEvent(event);
    if (!phase) return { accepted: false, changed: false, reason: "unmapped_event", state: snapshot() };
    return transition(phase, {
      stepId: event.stepId,
      toolCallId: event.toolCallId ?? event.callId,
      reason: event.reason ?? event.error,
      terminalState: event.taskState ?? event.finalState,
    });
  }

  function finish(state, reason = null) {
    const normalized = terminalState(state) ?? "unknown";
    return transition(normalized === "cancelled" ? "interrupted" : "ended", {
      terminalState: normalized,
      reason,
    });
  }

  function snapshot() {
    return { ...current };
  }

  return { transition, observe, finish, snapshot };
}
