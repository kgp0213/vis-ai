import { isTerminalExecutionState, normalizeExecutionEvent, normalizeExecutionId, terminalStateTransition } from "./execution-contract.mjs";
import { mergeTextAtOffset } from "./text-offset-merge.mjs";

const ENTITY_KEYS = Object.freeze({
  turn: "turns",
  step: "steps",
  tool: "tools",
  interaction: "interactions",
  attachment: "attachments",
  artifact: "artifacts",
  message: "messages",
  receipt: "receipts",
  goal: "goals",
  todo: "todos",
  prompt: "prompts",
});

function clone(value) {
  try { return structuredClone(value); } catch { return value; }
}

function initialState() {
  return {
    schemaVersion: 1,
    epoch: null,
    lastSeq: 0,
    seenEventIds: {},
    turns: {},
    steps: {},
    tools: {},
    interactions: {},
    attachments: {},
    artifacts: {},
    messages: {},
    receipts: {},
    goals: {},
    todos: {},
    prompts: {},
    anomalies: [],
  };
}

function entityIdFor(event, payload) {
  const kind = entityKindFor(event.kind, payload);
  const base = normalizeExecutionId(event.entityId ?? payload.entityId ?? payload.id ?? payload.toolCallId ?? payload.interactionId, null);
  if (kind !== "tool" || !base) return base;
  const callId = normalizeExecutionId(payload.toolCallId ?? event.toolCallId ?? base, base);
  const turnId = normalizeExecutionId(payload.turnId ?? event.turnId, null);
  const stepId = normalizeExecutionId(payload.stepId ?? event.stepId, null);
  if (!callId || (!turnId && !stepId)) return base;
  // Scope provider call ids to their execution frame. Provider ids are often
  // reused on retries or in a later Turn; the prefix stays within the closed
  // execution-id alphabet while remaining human-readable in diagnostics.
  return normalizeExecutionId(`tool:${turnId ?? "legacy"}:${stepId ?? "legacy"}:${callId}`, base);
}

function entityKindFor(kind, payload) {
  const explicit = String(payload.entityType ?? payload.entityKind ?? "").trim().toLowerCase();
  if (ENTITY_KEYS[explicit]) return explicit;
  const prefix = String(kind).split(".")[0].toLowerCase();
  return ENTITY_KEYS[prefix] ? prefix : null;
}

function addAnomaly(state, anomaly) {
  state.anomalies = [...state.anomalies, { ...anomaly }].slice(-64);
}

function transitionForKind(kind, previous, incoming, payload = {}) {
  const before = String(previous ?? "").trim().toLowerCase();
  const after = String(incoming ?? "").trim().toLowerCase();
  if (kind === "tool" && before === "failed" && ["queued", "running", "recovered"].includes(after)) {
    return { accepted: true, state: after, changed: before !== after };
  }
  return terminalStateTransition(previous, incoming, {
    correction: payload.correction === true || payload.revision !== undefined,
    toolRecovery: kind === "tool",
  });
}

function applyEntityState(state, kind, id, payload) {
  const key = ENTITY_KEYS[kind];
  if (!key || !id) return { changed: false };
  const previous = state[key][id] ?? { id, state: "running" };
  const transition = transitionForKind(kind, previous.state, payload.state, payload);
  if (!transition.accepted) return { changed: false, anomaly: "late-terminal-update" };
  const next = { ...previous, ...payload, id, state: transition.state };
  state[key] = { ...state[key], [id]: next };
  return { changed: transition.changed || JSON.stringify(previous) !== JSON.stringify(next) };
}

function appendDelta(state, payload, field, kind) {
  const id = normalizeExecutionId(payload.messageId ?? payload.entityId ?? payload.id, null);
  if (!id) return { changed: false, anomaly: "delta-missing-entity" };
  const key = kind === "reasoning" ? "messages" : "messages";
  const previous = state[key][id] ?? { id, state: "running", content: "", reasoning: "", offsets: {}, attempt: 1, streamToken: null };
  const attempt = Math.max(1, Number.isSafeInteger(Number(payload.attempt)) ? Number(payload.attempt) : Number(previous.attempt) || 1);
  if (attempt < (Number(previous.attempt) || 1)) return { changed: false };
  const previousStreamToken = previous.streamToken ?? null;
  const streamToken = payload.streamId ?? payload.stepId ?? payload.turnId ?? previousStreamToken;
  const reset = payload.streamReset === true || attempt > (Number(previous.attempt) || 1);
  const base = reset
    ? { ...previous, content: "", reasoning: "", offsets: {}, attempt, streamToken }
    : { ...previous, attempt, streamToken };
  // Persisted execution events have always treated offsets as authoritative;
  // an omitted offset falls back to the current length below for legacy logs.
  const enforceOffsets = true;
  const offset = Number.isSafeInteger(Number(payload.offset)) && Number(payload.offset) >= 0 ? Number(payload.offset) : base.offsets?.[field] ?? base[field]?.length ?? 0;
  const currentText = String(base[field] ?? "");
  const currentOffset = currentText.length;
  const newStep = streamToken !== null && previousStreamToken !== null && String(streamToken) !== String(previousStreamToken);
  const effectiveOffset = enforceOffsets && offset === 0 && currentOffset > 0 && newStep && !reset ? currentOffset : offset;
  const merged = enforceOffsets
    ? mergeTextAtOffset(currentText, effectiveOffset, payload.delta ?? payload.text ?? "")
    : mergeTextAtOffset(currentText, currentText.length, payload.delta ?? payload.text ?? "");
  if (merged.gap) return { changed: false, anomaly: "delta-gap", resyncRequired: true };
  if (!merged.changed) return { changed: false, duplicate: merged.duplicate === true };
  const nextText = merged.text;
  const next = { ...base, [field]: nextText, offsets: { ...(base.offsets ?? {}), [field]: nextText.length } };
  state[key] = { ...state[key], [id]: next };
  return { changed: true };
}

export function createExecutionState(seed = {}) {
  const state = { ...initialState(), ...(seed && typeof seed === "object" ? clone(seed) : {}) };
  for (const key of Object.values(ENTITY_KEYS)) state[key] = { ...(state[key] ?? {}) };
  state.seenEventIds = { ...(state.seenEventIds ?? {}) };
  state.anomalies = Array.isArray(state.anomalies) ? [...state.anomalies] : [];
  return state;
}

export function applyExecutionEvent(inputState, inputEvent) {
  const state = createExecutionState(inputState);
  const event = normalizeExecutionEvent(inputEvent, { eventEpoch: state.epoch });
  if (event.eventId && state.seenEventIds[event.eventId]) return { state, changed: false, duplicate: true };
  if (event.eventEpoch && state.epoch && event.eventEpoch !== state.epoch) {
    addAnomaly(state, { type: "epoch-changed", previous: state.epoch, received: event.eventEpoch, eventId: event.eventId });
    return { state, changed: false, resyncRequired: true, anomaly: "epoch-changed" };
  }
  if (event.eventEpoch) state.epoch = event.eventEpoch;
  let sequenceGap = false;
  if (event.eventSeq !== null && event.eventSeq < state.lastSeq) {
    addAnomaly(state, { type: "event-out-of-order", expectedAtLeast: state.lastSeq, received: event.eventSeq, eventId: event.eventId });
    return { state, changed: false, resyncRequired: true, anomaly: "event-out-of-order" };
  }
  if (event.eventSeq !== null && event.eventSeq === state.lastSeq && state.lastSeq > 0) {
    addAnomaly(state, { type: "event-sequence-conflict", sequence: event.eventSeq, eventId: event.eventId });
    return { state, changed: false, resyncRequired: true, anomaly: "event-sequence-conflict" };
  }
  if (event.eventSeq !== null && event.eventSeq > state.lastSeq + 1) {
    addAnomaly(state, { type: "event-gap", expected: state.lastSeq + 1, received: event.eventSeq, eventId: event.eventId });
    // A reducer can still apply the observed fact, but callers must hydrate a
    // canonical snapshot before trusting the resulting state. Without this
    // flag, a missing event would be silently treated as a complete replay.
    sequenceGap = true;
  }
  if (event.eventSeq !== null) state.lastSeq = Math.max(state.lastSeq, event.eventSeq);
  if (event.eventId) state.seenEventIds[event.eventId] = true;

  const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
  let result = { changed: false };
  if (event.kind === "text.delta") result = appendDelta(state, payload, "content", "text");
  else if (event.kind === "reasoning.delta") result = appendDelta(state, payload, "reasoning", "reasoning");
  else if (event.kind.endsWith(".state") || event.kind.endsWith(".started") || event.kind.endsWith(".finished") || event.kind.endsWith(".queued") || event.kind.endsWith(".running") || event.kind.endsWith(".succeeded") || event.kind.endsWith(".failed") || event.kind.endsWith(".cancelled") || event.kind.endsWith(".unknown")) {
    const kind = entityKindFor(event.kind, payload);
    const id = entityIdFor(event, payload);
    const stateName = payload.state ?? (event.kind.split(".").at(-1) === "started" ? "running" : event.kind.split(".").at(-1));
    result = applyEntityState(state, kind, id, { ...payload, state: stateName });
  } else if (event.kind === "entity.upsert" || event.kind.endsWith(".upsert")) {
    const kind = entityKindFor(event.kind, payload);
    const id = entityIdFor(event, payload);
    if (kind && id) {
      const key = ENTITY_KEYS[kind];
      const previous = state[key][id];
      const transition = transitionForKind(kind, previous?.state, payload.state, payload);
      if (!transition.accepted) {
        result = { changed: false, anomaly: "late-terminal-update" };
      } else {
        state[key] = { ...state[key], [id]: { ...(previous ?? {}), ...payload, id, state: transition.state } };
        result = { changed: JSON.stringify(previous) !== JSON.stringify(state[key][id]) };
      }
    } else result = { changed: false, anomaly: "upsert-missing-entity" };
  } else if (event.kind === "receipt.updated") {
    const id = entityIdFor(event, payload) ?? "current";
    const previous = state.receipts[id];
    state.receipts = { ...state.receipts, [id]: { ...(previous ?? {}), ...payload, id } };
    result = { changed: JSON.stringify(previous) !== JSON.stringify(state.receipts[id]) };
  }
  if (result.anomaly) addAnomaly(state, { type: result.anomaly, eventId: event.eventId, entityId: event.entityId });
  return { state, ...result, ...(sequenceGap ? { resyncRequired: true, anomaly: result.anomaly ?? "event-gap" } : {}) };
}

export function reduceExecutionEvents(events = [], seed = {}) {
  let state = createExecutionState(seed);
  let resyncRequired = false;
  for (const event of Array.isArray(events) ? events : []) {
    const result = applyExecutionEvent(state, event);
    state = result.state;
    resyncRequired ||= result.resyncRequired === true;
  }
  return { state, resyncRequired };
}
