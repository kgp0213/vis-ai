import { validateTranscriptOperation } from "./execution-schema.mjs";
import { mergeTextAtOffset } from "./text-offset-merge.mjs";

const TERMINAL_STATES = new Set([
  "completed", "completed_with_warnings", "succeeded", "failed", "cancelled", "unknown", "incomplete", "lost",
]);
const GLOBAL_ENTITY_TYPES = Object.freeze([
  "tasks", "attachments", "interactions", "artifacts", "receipts", "goals", "todos", "prompts", "taskNotifications",
]);
const SPECIFIC_ENTITY_OPERATIONS = Object.freeze({
  "task.upsert": ["tasks", "task"],
  "interaction.upsert": ["interactions", "interaction"],
  "attachment.upsert": ["attachments", "attachment"],
  "todo.upsert": ["todos", "todo"],
  "prompt.upsert": ["prompts", "prompt"],
});

function clone(value) {
  try { return structuredClone(value); } catch { return value; }
}

function text(value) {
  return String(value ?? "").trim();
}

function normalizeState(value, fallback = "running") {
  const normalized = text(value).toLowerCase();
  return normalized || fallback;
}

function isTerminal(value) {
  return TERMINAL_STATES.has(normalizeState(value));
}

function stateRank(value) {
  return {
    unknown: 1,
    incomplete: 2,
    failed: 3,
    cancelled: 3,
    lost: 3,
    completed_with_warnings: 4,
    succeeded: 5,
    completed: 5,
  }[normalizeState(value)] ?? 0;
}

function terminalUpdate(previous, incoming) {
  const before = normalizeState(previous);
  const after = normalizeState(incoming, before);
  if (!isTerminal(before) || before === after) return { accepted: true, state: after };
  if (before === "failed" && ["queued", "running", "recovered"].includes(after)) {
    return { accepted: true, state: after };
  }
  return { accepted: false, state: before };
}

function emptyState(seed = {}) {
  return {
    schemaVersion: 1,
    sessionId: seed.sessionId ?? null,
    items: Array.isArray(seed.items) ? clone(seed.items) : [],
    ...Object.fromEntries(GLOBAL_ENTITY_TYPES.map((key) => [key, Array.isArray(seed[key]) ? clone(seed[key]) : []])),
    meta: seed.meta && typeof seed.meta === "object" && !Array.isArray(seed.meta) ? clone(seed.meta) : {},
    hasMoreOlder: seed.hasMoreOlder === true,
    anomalies: Array.isArray(seed.anomalies) ? clone(seed.anomalies).slice(-64) : [],
  };
}

function standaloneItemId(item) {
  if (item?.kind === "marker") return text(item.markerId);
  if (item?.kind === "taskref") return text(item.refId);
  return "";
}

function applyStandaloneItem(state, input) {
  const item = clone(input.item);
  const id = standaloneItemId(item);
  if (!id) return { changed: false, anomaly: "item_id_missing" };
  const index = state.items.findIndex((candidate) => standaloneItemId(candidate) === id);
  if (index >= 0) {
    if (JSON.stringify(state.items[index]) === JSON.stringify(item)) return { changed: false };
    // Updating an existing standalone fact must not move its timeline anchor.
    state.items[index] = item;
    return { changed: true };
  }
  if (input.beforeTurn !== undefined) {
    const beforeTurn = Number(input.beforeTurn);
    const at = state.items.findIndex((candidate) => candidate?.kind === "turn" && Number(candidate.ordinal) >= beforeTurn);
    if (at >= 0) {
      state.items.splice(at, 0, item);
      return { changed: true };
    }
  }
  state.items.push(item);
  return { changed: true };
}

function recordAnomaly(state, anomaly) {
  state.anomalies = [...state.anomalies, anomaly].slice(-64);
}

function turnAt(state, turnId) {
  return state.items.find((item) => item?.kind === "turn" && item.turnId === turnId) ?? null;
}

function replaceTurn(state, turn) {
  const index = state.items.findIndex((item) => item?.kind === "turn" && item.turnId === turn.turnId);
  if (index >= 0) state.items[index] = turn;
  else {
    state.items.push(turn);
    state.items.sort((left, right) => Number(left?.ordinal ?? 0) - Number(right?.ordinal ?? 0));
  }
}

function ensureTurn(state, turnId) {
  const current = turnAt(state, turnId);
  if (current) return current;
  const skeleton = { kind: "turn", turnId, ordinal: Number.MAX_SAFE_INTEGER, state: "running", steps: [] };
  replaceTurn(state, skeleton);
  return turnAt(state, turnId);
}

function stepAt(turn, stepId) {
  return turn?.steps?.find((step) => step?.stepId === stepId) ?? null;
}

function ensureStep(turn, stepId) {
  if (!Array.isArray(turn.steps)) turn.steps = [];
  const current = stepAt(turn, stepId);
  if (current) return current;
  const skeleton = { kind: "step", stepId, ordinal: Number.MAX_SAFE_INTEGER, state: "running", frames: [] };
  turn.steps.push(skeleton);
  turn.steps.sort((left, right) => Number(left?.ordinal ?? 0) - Number(right?.ordinal ?? 0));
  return stepAt(turn, stepId);
}

function upsertHeader(current, incoming, fallbackKind) {
  const next = { ...current, ...clone(incoming), kind: incoming.kind ?? fallbackKind };
  if (incoming.state !== undefined || current.state !== undefined) {
    const transition = terminalUpdate(current.state, incoming.state);
    if (!transition.accepted) return { accepted: false, value: current };
    next.state = transition.state;
  } else {
    delete next.state;
  }
  return { accepted: true, value: next };
}

function applyTurn(state, input) {
  const header = input.turn && typeof input.turn === "object" ? input.turn : {};
  const id = text(header.turnId);
  if (!id) return { changed: false, anomaly: "turn_id_missing" };
  const existing = turnAt(state, id);
  if (!existing) {
    const turn = { ...clone(header), kind: "turn", turnId: id, steps: Array.isArray(header.steps) ? clone(header.steps) : [] };
    replaceTurn(state, turn);
    return { changed: true };
  }
  const updated = upsertHeader(existing, header, "turn");
  if (!updated.accepted) return { changed: false, anomaly: "late-terminal-update" };
  updated.value.steps = existing.steps ?? [];
  const changed = JSON.stringify(existing) !== JSON.stringify(updated.value);
  if (changed) replaceTurn(state, updated.value);
  return { changed };
}

function applyStep(state, input) {
  const turnId = text(input.turnId);
  const header = input.step && typeof input.step === "object" ? input.step : {};
  const stepId = text(header.stepId);
  if (!turnId || !stepId) return { changed: false, anomaly: "step_id_missing" };
  const turn = ensureTurn(state, turnId);
  const existing = stepAt(turn, stepId);
  if (!existing) {
    turn.steps.push({ ...clone(header), kind: "step", stepId, frames: Array.isArray(header.frames) ? clone(header.frames) : [] });
    turn.steps.sort((left, right) => Number(left?.ordinal ?? 0) - Number(right?.ordinal ?? 0));
    return { changed: true };
  }
  const updated = upsertHeader(existing, header, "step");
  if (!updated.accepted) return { changed: false, anomaly: "late-terminal-update" };
  updated.value.frames = existing.frames ?? [];
  const changed = JSON.stringify(existing) !== JSON.stringify(updated.value);
  if (changed) {
    const index = turn.steps.indexOf(existing);
    turn.steps[index] = updated.value;
  }
  return { changed };
}

function applyFrame(state, input) {
  const turnId = text(input.turnId);
  const stepId = text(input.stepId);
  const frame = input.frame && typeof input.frame === "object" ? input.frame : {};
  const frameId = text(frame.frameId);
  if (!turnId || !stepId || !frameId) return { changed: false, anomaly: "frame_id_missing" };
  const turn = ensureTurn(state, turnId);
  const step = ensureStep(turn, stepId);
  const index = step.frames.findIndex((candidate) => candidate?.frameId === frameId);
  if (index < 0) {
    step.frames.push({ ...clone(frame), frameId });
    return { changed: true };
  }
  const existing = step.frames[index];
  const updated = upsertHeader(existing, frame, existing.kind ?? "frame");
  if (!updated.accepted) return { changed: false, anomaly: "late-terminal-update" };
  const changed = JSON.stringify(existing) !== JSON.stringify(updated.value);
  if (changed) step.frames[index] = updated.value;
  return { changed };
}

function applyAppend(state, input) {
  const target = input.target && typeof input.target === "object" ? input.target : {};
  if (target.type === "task") {
    const taskId = text(target.taskId);
    const index = state.tasks.findIndex((task) => text(task?.id ?? task?.taskId) === taskId);
    const current = index >= 0 ? state.tasks[index] : { id: taskId, taskId, state: "running", outputTail: "" };
    const outputTail = typeof current.outputTail === "string" ? current.outputTail : "";
    const merged = mergeTextAtOffset(outputTail, input.offset, input.text);
    if (merged.gap) return { changed: false, gap: merged.gap };
    if (!merged.changed) return { changed: false, duplicate: merged.duplicate === true };
    const next = { ...current, id: taskId, taskId, outputTail: merged.text };
    if (index >= 0) state.tasks[index] = next;
    else state.tasks.push(next);
    return { changed: true };
  }
  if (target.type !== "frame") return { changed: false, anomaly: "append_target_unsupported" };
  const turn = turnAt(state, text(target.turnId));
  const step = stepAt(turn, text(target.stepId));
  const frame = step?.frames?.find((candidate) => candidate?.frameId === text(target.frameId));
  if (!frame) return { changed: false, anomaly: "append_target_missing" };
  const field = text(target.field) || "text";
  const current = typeof frame[field] === "string" ? frame[field] : "";
  const merged = mergeTextAtOffset(current, input.offset, input.text);
  if (merged.gap) return { changed: false, gap: merged.gap };
  if (!merged.changed) return { changed: false, duplicate: merged.duplicate === true };
  frame[field] = merged.text;
  return { changed: true };
}

function applyEntity(state, input) {
  const type = text(input.entityType ?? input.type).replace(/\.upsert$/u, "");
  if (!GLOBAL_ENTITY_TYPES.includes(type)) return { changed: false, anomaly: "entity_type_unknown" };
  const entity = input.entity && typeof input.entity === "object" ? input.entity : input.payload;
  if (!entity || typeof entity !== "object") return { changed: false, anomaly: "entity_missing" };
  const id = text(entity.id ?? entity[`${type.slice(0, -1)}Id`]);
  if (!id) return { changed: false, anomaly: "entity_id_missing" };
  const collection = state[type];
  const index = collection.findIndex((candidate) => text(candidate?.id ?? candidate?.[`${type.slice(0, -1)}Id`]) === id);
  if (index < 0) {
    collection.push({ ...clone(entity), id });
    return { changed: true };
  }
  const previous = collection[index];
  const transition = terminalUpdate(previous.state ?? previous.status, entity.state ?? entity.status);
  if (!transition.accepted) return { changed: false, anomaly: "late-terminal-update" };
  const next = { ...previous, ...clone(entity), id };
  const changed = JSON.stringify(previous) !== JSON.stringify(next);
  if (changed) collection[index] = next;
  return { changed };
}

export function createTranscriptState(seed = {}) {
  return emptyState(seed);
}

export function applyTranscriptOperation(inputState, inputOperation) {
  const state = emptyState(inputState);
  const validation = validateTranscriptOperation(inputOperation);
  if (!validation.ok) return { state, changed: false, anomaly: "invalid-operation", errors: validation.errors };
  const operation = inputOperation;
  let resultValue;
  switch (operation.op) {
    case "reset":
      return { state: emptyState(operation.snapshot ?? {}), changed: true };
    case "turn.upsert":
      resultValue = applyTurn(state, operation);
      break;
    case "step.upsert":
      resultValue = applyStep(state, operation);
      break;
    case "frame.upsert":
      resultValue = applyFrame(state, operation);
      break;
    case "append":
      resultValue = applyAppend(state, operation);
      break;
    case "entity.upsert":
      resultValue = applyEntity(state, operation);
      break;
    case "task.upsert":
    case "interaction.upsert":
    case "attachment.upsert":
    case "todo.upsert":
    case "prompt.upsert": {
      const [entityType, field] = SPECIFIC_ENTITY_OPERATIONS[operation.op];
      resultValue = applyEntity(state, { ...operation, entityType, entity: operation[field] });
      break;
    }
    case "marker.upsert":
    case "taskref.upsert":
      resultValue = applyStandaloneItem(state, operation);
      break;
    case "meta.merge": {
      const next = { ...(state.meta ?? {}), ...clone(operation.meta) };
      const changed = JSON.stringify(state.meta ?? {}) !== JSON.stringify(next);
      if (changed) state.meta = next;
      resultValue = { changed };
      break;
    }
    case "items.remove": {
      const ids = new Set(Array.isArray(operation.ids) ? operation.ids.map(text) : []);
      const previous = state.items.length;
      state.items = state.items.filter((item) => !ids.has(text(item?.turnId ?? item?.id ?? item?.markerId ?? item?.refId)));
      resultValue = { changed: previous !== state.items.length };
      break;
    }
    default:
      resultValue = { changed: false, anomaly: "operation_unsupported" };
      break;
  }
  if (resultValue?.anomaly) recordAnomaly(state, { type: resultValue.anomaly, op: operation.op });
  return { state, ...resultValue };
}

export function applyTranscriptOperations(inputState, operations = []) {
  let state = emptyState(inputState);
  const accepted = [];
  let gap = null;
  for (const operation of Array.isArray(operations) ? operations : []) {
    const resultValue = applyTranscriptOperation(state, operation);
    if (resultValue.gap) {
      gap = { operation, ...resultValue.gap };
      continue;
    }
    if (resultValue.changed) {
      state = resultValue.state;
      accepted.push(operation);
    }
  }
  return { state, accepted, gap };
}

export function operationsFromTranscriptSnapshot(snapshot = {}) {
  const operations = [];
  for (const item of Array.isArray(snapshot.items) ? snapshot.items : []) {
    if (item?.kind === "turn") {
      const { steps: _steps, ...turn } = item;
      operations.push({ op: "turn.upsert", turn });
      for (const step of Array.isArray(item.steps) ? item.steps : []) {
        const { frames: _frames, ...header } = step;
        operations.push({ op: "step.upsert", turnId: item.turnId, step: header });
        for (const frame of Array.isArray(step.frames) ? step.frames : []) operations.push({ op: "frame.upsert", turnId: item.turnId, stepId: step.stepId, frame });
      }
    } else if (item?.kind === "marker") operations.push({ op: "marker.upsert", item });
    else if (item?.kind === "taskref") operations.push({ op: "taskref.upsert", item });
  }
  for (const type of GLOBAL_ENTITY_TYPES) {
    for (const entity of Array.isArray(snapshot[type]) ? snapshot[type] : []) operations.push({ op: "entity.upsert", entityType: type, entity });
  }
  if (snapshot.meta && typeof snapshot.meta === "object" && !Array.isArray(snapshot.meta) && Object.keys(snapshot.meta).length > 0) {
    operations.push({ op: "meta.merge", meta: snapshot.meta });
  }
  return operations;
}

export function materializeTranscriptSnapshot(snapshot = {}) {
  const operations = operationsFromTranscriptSnapshot(snapshot);
  const reduced = applyTranscriptOperations({ sessionId: snapshot.sessionId, hasMoreOlder: snapshot.hasMoreOlder }, operations).state;
  return {
    schemaVersion: Number(snapshot.schemaVersion) || 1,
    sessionId: snapshot.sessionId ?? null,
    items: reduced.items,
    ...Object.fromEntries(GLOBAL_ENTITY_TYPES.map((key) => [key, reduced[key]])),
    meta: reduced.meta,
    hasMoreOlder: snapshot.hasMoreOlder === true,
    operationCount: operations.length,
    operationAnomalies: reduced.anomalies,
  };
}

export { GLOBAL_ENTITY_TYPES, TERMINAL_STATES };
