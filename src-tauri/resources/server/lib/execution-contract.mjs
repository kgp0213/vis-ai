const SCHEMA_VERSION = 1;
const ID_RE = /^[A-Za-z0-9._:-]{1,240}$/u;

import { validateExecutionEvent } from "./execution-schema.mjs";
import { EXECUTION_TERMINAL_STATES as TERMINAL_STATE_SET, isTerminalState, terminalStateTransition } from "./execution-state.mjs";

export const EXECUTION_SCHEMA_VERSION = SCHEMA_VERSION;
export const EXECUTION_ENTITY_KINDS = Object.freeze([
  "turn", "step", "tool", "interaction", "attachment", "artifact", "message", "receipt", "goal", "todo", "prompt",
]);
export const EXECUTION_TERMINAL_STATES = Object.freeze([...TERMINAL_STATE_SET]);

function text(value) {
  return String(value ?? "").trim();
}

function clone(value) {
  try { return structuredClone(value); } catch { return value; }
}

export function normalizeExecutionId(value, fallback = null) {
  const id = text(value);
  if (ID_RE.test(id)) return id;
  const replacement = text(fallback);
  return ID_RE.test(replacement) ? replacement : null;
}

export function isTerminalExecutionState(value) { return isTerminalState(value); }

export function normalizeExecutionEvent(input = {}, defaults = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const eventEpoch = text(source.eventEpoch ?? defaults.eventEpoch) || null;
  const eventSeqValue = source.eventSeq ?? defaults.eventSeq;
  const eventSeq = Number.isSafeInteger(Number(eventSeqValue)) && Number(eventSeqValue) >= 0 ? Number(eventSeqValue) : null;
  const operationId = normalizeExecutionId(source.operationId ?? defaults.operationId);
  const sessionId = normalizeExecutionId(source.sessionId ?? defaults.sessionId);
  const turnId = normalizeExecutionId(source.turnId ?? defaults.turnId);
  const stepId = normalizeExecutionId(source.stepId ?? defaults.stepId);
  const kind = text(source.kind);
  if (!kind) throw new TypeError("execution event kind is required");
  const entityId = normalizeExecutionId(source.entityId ?? source.id ?? source.toolCallId ?? source.interactionId);
  const eventId = normalizeExecutionId(
    source.eventId,
    eventEpoch && eventSeq !== null ? `${eventEpoch}:${eventSeq}` : null,
  );
  const normalized = {
    schemaVersion: Number.isSafeInteger(Number(source.schemaVersion)) ? Number(source.schemaVersion) : SCHEMA_VERSION,
    eventEpoch,
    eventSeq,
    eventId,
    operationId,
    sessionId,
    turnId,
    stepId,
    kind,
    occurredAt: text(source.occurredAt ?? source.emittedAt) || new Date().toISOString(),
    entityId,
    payload: clone(source.payload && typeof source.payload === "object" ? source.payload : source),
  };
  const validation = validateExecutionEvent(normalized);
  if (!validation.ok) {
    throw new TypeError(`execution schema violation: ${validation.errors.join(", ")}`);
  }
  return normalized;
}

export function createExecutionEvent({ kind, epoch = null, seq = null, eventId = null, payload = {}, ...scope } = {}) {
  return normalizeExecutionEvent({
    schemaVersion: SCHEMA_VERSION,
    eventEpoch: epoch,
    eventSeq: seq,
    eventId,
    kind,
    payload,
    ...scope,
  });
}

export { terminalStateTransition };
