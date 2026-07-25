import { isTerminalExecutionState, normalizeExecutionEvent, normalizeExecutionId, terminalStateTransition } from "./execution-contract.mjs";

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
  return normalizeExecutionId(event.entityId ?? payload.entityId ?? payload.id ?? payload.toolCallId ?? payload.interactionId, null);
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

function applyEntityState(state, kind, id, payload) {
  const key = ENTITY_KEYS[kind];
  if (!key || !id) return { changed: false };
  const previous = state[key][id] ?? { id, state: "running" };
  const transition = terminalStateTransition(previous.state, payload.state);
  if (!transition.accepted) return { changed: false, anomaly: "late-terminal-update" };
  const next = { ...previous, ...payload, id, state: transition.state };
  state[key] = { ...state[key], [id]: next };
  return { changed: transition.changed || JSON.stringify(previous) !== JSON.stringify(next) };
}

function appendDelta(state, payload, field, kind) {
  const id = normalizeExecutionId(payload.messageId ?? payload.entityId ?? payload.id, null);
  if (!id) return { changed: false, anomaly: "delta-missing-entity" };
  const key = kind === "reasoning" ? "messages" : "messages";
  const previous = state[key][id] ?? { id, state: "running", content: "", reasoning: "", offsets: {} };
  const offset = Number.isSafeInteger(Number(payload.offset)) && Number(payload.offset) >= 0 ? Number(payload.offset) : previous.offsets?.[field] ?? previous[field]?.length ?? 0;
  const currentText = String(previous[field] ?? "");
  const currentOffset = Number(previous.offsets?.[field] ?? currentText.length);
  if (offset < currentOffset) return { changed: false };
  if (offset > currentOffset) return { changed: false, anomaly: "delta-gap", resyncRequired: true };
  const nextText = currentText + String(payload.delta ?? payload.text ?? "");
  const next = { ...previous, [field]: nextText, offsets: { ...(previous.offsets ?? {}), [field]: nextText.length } };
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
  if (event.eventSeq !== null && event.eventSeq > state.lastSeq + 1) {
    addAnomaly(state, { type: "event-gap", expected: state.lastSeq + 1, received: event.eventSeq, eventId: event.eventId });
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
      state[key] = { ...state[key], [id]: { ...(previous ?? {}), ...payload, id } };
      result = { changed: JSON.stringify(previous) !== JSON.stringify(state[key][id]) };
    } else result = { changed: false, anomaly: "upsert-missing-entity" };
  } else if (event.kind === "receipt.updated") {
    const id = entityIdFor(event, payload) ?? "current";
    const previous = state.receipts[id];
    state.receipts = { ...state.receipts, [id]: { ...(previous ?? {}), ...payload, id } };
    result = { changed: JSON.stringify(previous) !== JSON.stringify(state.receipts[id]) };
  }
  if (result.anomaly) addAnomaly(state, { type: result.anomaly, eventId: event.eventId, entityId: event.entityId });
  return { state, ...result };
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
