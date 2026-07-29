import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, truncate } from "node:fs/promises";
import { dirname } from "node:path";

import { validateRuntimeFact } from "./execution-schema.mjs";
import { recoverColdSnapshotEntities } from "./cold-recovery.mjs";
import { isTerminalState, terminalStateTransition } from "./execution-state.mjs";

const SCHEMA_VERSION = 1;
const TERMINAL_FIELDS = ["state", "status", "taskState", "executionState", "goalState"];
const COLLECTIONS = Object.freeze({
  turn: "turns",
  step: "steps",
  message: "messages",
  tool: "tools",
  interaction: "interactions",
  attachment: "attachments",
  artifact: "artifacts",
  receipt: "receipts",
  goal: "goals",
  todo: "todos",
  prompt: "prompts",
  "task-notification": "taskNotifications",
  task_notification: "taskNotifications",
  notification: "taskNotifications",
});

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function text(value) {
  return String(value ?? "").trim();
}

function timestamp(now) {
  const value = now();
  if (value instanceof Date) return value.toISOString();
  const normalized = text(value);
  if (!normalized) throw new TypeError("runtime fact timestamp must be non-empty");
  return normalized;
}

function eventCursor(epoch, sequence) {
  return `${epoch}:${sequence}`;
}

function initialSnapshot(sessionId, epoch) {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId,
    eventCursor: eventCursor(epoch, 0),
    turns: [],
    steps: [],
    messages: [],
    tools: [],
    interactions: [],
    attachments: [],
    artifacts: [],
    receipts: [],
    goals: [],
    todos: [],
    prompts: [],
    plan: null,
    taskNotifications: [],
    operation: null,
    admission: null,
    busy: false,
  };
}

function isActive(value) {
  return ["queued", "running", "starting", "stopping"].includes(text(value).toLowerCase());
}

function deriveBusy(snapshot) {
  if (snapshot.admission?.busy === true || snapshot.admission?.active === true) return true;
  return isActive(snapshot.operation?.state ?? snapshot.operation?.status);
}

function terminalDowngrade(previous, incoming, collection = null) {
  if (!previous || !incoming) return null;
  for (const field of TERMINAL_FIELDS) {
    const before = text(previous[field]).toLowerCase();
    const after = text(incoming[field]).toLowerCase();
    if (!before || !after || before === after) continue;
    const transition = terminalStateTransition(before, after, {
      correction: incoming.correction === true || incoming.revision !== undefined,
      toolRecovery: collection === "tools" && (field === "state" || field === "status"),
    });
    if (!transition.accepted) return field;
  }
  return null;
}

function entityId(fact, payload) {
  return text(
    fact.entityId
      ?? payload.id
      ?? payload.toolCallId
      ?? payload.interactionId
      ?? payload.attachmentId
      ?? payload.artifactId
      ?? payload.notificationId,
  );
}

function scopedPayload(fact, payload, id = null) {
  return {
    ...payload,
    ...(id ? { id } : {}),
    ...(fact.operationId ? { operationId: fact.operationId } : {}),
    ...(fact.turnId ? { turnId: fact.turnId } : {}),
    ...(fact.stepId ? { stepId: fact.stepId } : {}),
  };
}

function applyCollectionUpsert(snapshot, fact, collection) {
  const payload = fact.payload && typeof fact.payload === "object" && !Array.isArray(fact.payload)
    ? clone(fact.payload)
    : {};
  const id = entityId(fact, payload);
  if (!id) return { accepted: false, code: "MISSING_ENTITY_ID" };
  const index = snapshot[collection].findIndex((item) => text(item?.id) === id);
  const previous = index >= 0 ? snapshot[collection][index] : null;
  const incoming = scopedPayload(fact, payload, id);
  const downgradeField = terminalDowngrade(previous, incoming, collection);
  if (downgradeField) {
    return { accepted: false, code: "TERMINAL_STATE_DOWNGRADE", field: downgradeField };
  }
  const next = previous ? { ...previous, ...incoming } : incoming;
  if (index >= 0) snapshot[collection][index] = next;
  else snapshot[collection].push(next);
  return { accepted: true };
}

function applyMessagesReplace(snapshot, fact) {
  const items = fact.payload?.items;
  if (!Array.isArray(items)) return { accepted: false, code: "INVALID_COLLECTION_REPLACEMENT" };
  const previousById = new Map(snapshot.messages.map((message) => [text(message?.id), message]));
  const replacement = new Map();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { accepted: false, code: "INVALID_COLLECTION_ITEM" };
    }
    const payload = clone(item);
    const id = text(payload.id);
    if (!id) return { accepted: false, code: "MISSING_ENTITY_ID" };
    const previous = replacement.get(id) ?? previousById.get(id);
    const incoming = { ...payload, id };
    const next = previous ? { ...previous, ...incoming } : incoming;
    for (const field of TERMINAL_FIELDS) {
      const before = text(previous?.[field]).toLowerCase();
      const after = text(incoming[field]).toLowerCase();
      if (isTerminalState(before) && after !== before) {
        const transition = terminalStateTransition(before, after, {
          correction: payload.correction === true || payload.revision !== undefined,
        });
        if (!transition.accepted) next[field] = previous[field];
      }
    }
    if (previous?.finalized === true) next.finalized = true;
    replacement.set(id, next);
  }
  snapshot.messages = [...replacement.values()];
  return { accepted: true };
}

function applySingleton(snapshot, fact, key) {
  const payload = fact.payload && typeof fact.payload === "object" && !Array.isArray(fact.payload)
    ? scopedPayload(fact, clone(fact.payload), entityId(fact, fact.payload) || null)
    : null;
  const previousId = text(snapshot[key]?.id);
  const nextId = text(payload?.id);
  const sameEntity = !previousId || !nextId || previousId === nextId;
  const downgradeField = sameEntity ? terminalDowngrade(snapshot[key], payload) : null;
  if (downgradeField) {
    return { accepted: false, code: "TERMINAL_STATE_DOWNGRADE", field: downgradeField };
  }
  snapshot[key] = payload;
  return { accepted: true };
}

function applyFact(snapshot, fact) {
  const type = text(fact.type).toLowerCase();
  if (type === "messages.replace") {
    return applyMessagesReplace(snapshot, fact);
  }
  if (type.endsWith(".upsert")) {
    const collection = COLLECTIONS[type.slice(0, -".upsert".length)];
    if (collection) return applyCollectionUpsert(snapshot, fact, collection);
  }
  if (type === "operation.replace" || type === "operation.upsert") {
    return applySingleton(snapshot, fact, "operation");
  }
  if (type === "admission.replace" || type === "admission.upsert") {
    return applySingleton(snapshot, fact, "admission");
  }
  if (type === "plan.replace" || type === "plan.upsert") {
    return applySingleton(snapshot, fact, "plan");
  }
  if (type === "plan.clear") {
    snapshot.plan = null;
    return { accepted: true };
  }
  // Unknown fact types remain durable for forward compatibility. A newer
  // reducer can project them after restart without rewriting the fact log.
  return { accepted: true };
}

function normalizeScopeId(value) {
  const normalized = text(value);
  return normalized || null;
}

function normalizeFact(input, { sessionId, sequence, now, idFactory }) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("runtime fact must be an object");
  }
  const type = text(input.type);
  if (!type) throw new TypeError("runtime fact type is required");
  const inputSessionId = normalizeScopeId(input.sessionId);
  if (inputSessionId && inputSessionId !== sessionId) {
    throw new TypeError(`runtime fact session mismatch: expected ${sessionId}, received ${inputSessionId}`);
  }
  const factId = text(input.factId) || text(idFactory());
  if (!factId) throw new TypeError("runtime fact id is required");
  const normalized = {
    schemaVersion: input.schemaVersion ?? SCHEMA_VERSION,
    factId,
    sequence,
    occurredAt: text(input.occurredAt) || timestamp(now),
    sessionId,
    operationId: normalizeScopeId(input.operationId),
    turnId: normalizeScopeId(input.turnId),
    stepId: normalizeScopeId(input.stepId),
    entityId: normalizeScopeId(input.entityId),
    type,
    payload: clone(input.payload ?? {}),
  };
  const validation = validateRuntimeFact(normalized, { sessionId });
  if (!validation.ok) throw new TypeError(`runtime fact schema violation: ${validation.errors.join(", ")}`);
  return normalized;
}

function normalizePersistedFact(input, sessionId, lineNumber) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError(`runtime fact at line ${lineNumber} must be an object`);
  }
  const factId = text(input.factId);
  const type = text(input.type);
  const sequence = Number(input.sequence);
  if (!factId || !type || !Number.isSafeInteger(sequence) || sequence < 1) {
    throw new TypeError(`runtime fact at line ${lineNumber} has an invalid id, type, or sequence`);
  }
  const factSessionId = text(input.sessionId);
  if (factSessionId !== sessionId) {
    throw new TypeError(`runtime fact at line ${lineNumber} belongs to session ${factSessionId || "<empty>"}`);
  }
  const normalized = {
    schemaVersion: input.schemaVersion ?? SCHEMA_VERSION,
    factId,
    sequence,
    occurredAt: text(input.occurredAt),
    sessionId,
    operationId: normalizeScopeId(input.operationId),
    turnId: normalizeScopeId(input.turnId),
    stepId: normalizeScopeId(input.stepId),
    entityId: normalizeScopeId(input.entityId),
    type,
    payload: clone(input.payload ?? {}),
  };
  const validation = validateRuntimeFact(normalized, { sessionId });
  if (!validation.ok) {
    throw new TypeError(`runtime fact at line ${lineNumber} violates schema: ${validation.errors.join(", ")}`);
  }
  return normalized;
}

/** Append-only RuntimeFactV1 persistence and SessionSnapshotV1 projection. */
export function createRuntimeFactStore({
  file,
  sessionId,
  epoch = randomUUID(),
  now = () => new Date().toISOString(),
  idFactory = randomUUID,
} = {}) {
  const factFile = text(file);
  const normalizedSessionId = text(sessionId);
  const normalizedEpoch = text(epoch);
  if (!factFile) throw new TypeError("runtime fact file is required");
  if (!normalizedSessionId) throw new TypeError("runtime fact sessionId is required");
  if (!normalizedEpoch || normalizedEpoch.includes(":")) {
    throw new TypeError("runtime fact epoch must be non-empty and cannot contain ':'");
  }
  if (typeof now !== "function") throw new TypeError("runtime fact now must be a function");
  if (typeof idFactory !== "function") throw new TypeError("runtime fact idFactory must be a function");

  let state = initialSnapshot(normalizedSessionId, normalizedEpoch);
  let sequence = 0;
  let loaded = false;
  let seenFactIds = new Set();
  let pending = Promise.resolve();

  function projectSnapshot() {
    const result = clone(state);
    result.eventCursor = eventCursor(normalizedEpoch, sequence);
    result.busy = deriveBusy(result);
    return result;
  }

  function serialize(action) {
    const result = pending.then(action);
    pending = result.catch(() => {});
    return result;
  }

  async function load() {
    return serialize(async () => {
      await mkdir(dirname(factFile), { recursive: true });
      let raw = "";
      try {
        raw = await readFile(factFile, "utf8");
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }

      const nextState = initialSnapshot(normalizedSessionId, normalizedEpoch);
      const nextSeen = new Set();
      let nextSequence = 0;
      const lines = raw.split(/\r?\n/u);
      const trailingPartialAllowed = raw.length > 0 && !/\r?\n$/u.test(raw);
      let damagedTailLength = null;
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index].trim();
        if (!line) continue;
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch (error) {
          if (trailingPartialAllowed && index === lines.length - 1) {
            const completePrefix = raw.slice(0, raw.lastIndexOf("\n") + 1);
            damagedTailLength = Buffer.byteLength(completePrefix, "utf8");
            break;
          }
          throw new SyntaxError(`invalid runtime fact JSON at line ${index + 1}: ${error.message}`);
        }
        const fact = normalizePersistedFact(parsed, normalizedSessionId, index + 1);
        if (nextSeen.has(fact.factId)) continue;
        if (fact.sequence <= nextSequence) {
          throw new TypeError(`runtime fact sequence is not monotonic at line ${index + 1}`);
        }
        nextSeen.add(fact.factId);
        nextSequence = fact.sequence;
        applyFact(nextState, fact);
      }
      if (damagedTailLength !== null) {
        await truncate(factFile, damagedTailLength);
      } else if (trailingPartialAllowed) {
        await appendFile(factFile, "\n", "utf8");
      }

      const coldRecovery = recoverColdSnapshotEntities(nextState, { reason: "process_restarted" });
      Object.assign(nextState, coldRecovery.snapshot);
      const interrupted = coldRecovery.changes.map((change) => {
        const collection = change.collection;
        const entity = collection === "operation" || collection === "admission"
          ? nextState[collection]
          : nextState[collection]?.find((candidate) => text(candidate?.id ?? candidate?.toolCallId ?? candidate?.notificationId) === change.entityId);
        const type = collection === "operation"
          ? "operation.replace"
          : collection === "admission"
            ? "admission.replace"
            : collection === "taskNotifications"
              ? "task-notification.upsert"
              : `${collection.slice(0, -1)}.upsert`;
        return {
          factId: change.recoveryFactId,
          type,
          entityId: entity?.id ?? entity?.toolCallId ?? entity?.notificationId ?? change.entityId,
          operationId: entity?.operationId,
          turnId: entity?.turnId,
          stepId: entity?.stepId,
          payload: entity,
        };
      });
      const recoveryFacts = [];
      for (const input of interrupted) {
        const fact = normalizeFact({
          ...input,
          factId: input.recoveryFactId ?? `recovery:${input.type}:${input.entityId ?? recoveryFacts.length + 1}`,
        }, {
          sessionId: normalizedSessionId,
          sequence: nextSequence + 1,
          now,
          idFactory,
        });
        const reduction = applyFact(nextState, fact);
        if (!reduction.accepted) continue;
        nextSequence = fact.sequence;
        nextSeen.add(fact.factId);
        recoveryFacts.push(fact);
      }
      if (recoveryFacts.length > 0) {
        await appendFile(factFile, recoveryFacts.map((fact) => JSON.stringify(fact)).join("\n") + "\n", "utf8");
      }
      state = nextState;
      sequence = nextSequence;
      seenFactIds = nextSeen;
      loaded = true;
      return projectSnapshot();
    });
  }

  async function append(input) {
    return serialize(async () => {
      if (!loaded) throw new Error("runtime fact store must be loaded before append");
      const explicitFactId = text(input?.factId);
      if (explicitFactId && seenFactIds.has(explicitFactId)) {
        return { accepted: false, duplicate: true, factId: explicitFactId, eventCursor: eventCursor(normalizedEpoch, sequence) };
      }
      const fact = normalizeFact(input, {
        sessionId: normalizedSessionId,
        sequence: sequence + 1,
        now,
        idFactory,
      });
      if (seenFactIds.has(fact.factId)) {
        return { accepted: false, duplicate: true, factId: fact.factId, eventCursor: eventCursor(normalizedEpoch, sequence) };
      }

      const nextState = clone(state);
      const reduction = applyFact(nextState, fact);
      if (!reduction.accepted) {
        return {
          accepted: false,
          duplicate: false,
          code: reduction.code,
          ...(reduction.field ? { field: reduction.field } : {}),
          fact: clone(fact),
          eventCursor: eventCursor(normalizedEpoch, sequence),
        };
      }

      await appendFile(factFile, `${JSON.stringify(fact)}\n`, "utf8");
      state = nextState;
      sequence = fact.sequence;
      seenFactIds.add(fact.factId);
      return {
        accepted: true,
        duplicate: false,
        fact: clone(fact),
        eventCursor: eventCursor(normalizedEpoch, sequence),
      };
    });
  }

  return {
    load,
    append,
    snapshot: projectSnapshot,
  };
}
