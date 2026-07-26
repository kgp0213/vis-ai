type TerminalState = "succeeded" | "failed" | "cancelled" | "unknown";

const TERMINAL_TOOL_STATES = new Set<TerminalState>(["succeeded", "failed", "cancelled", "unknown"]);

export interface DashboardEventGuard {
  accept(event: any): boolean;
  reset(): void;
  size(): number;
}

export interface DashboardEntityState {
  id: string;
  state?: string;
  [key: string]: any;
}

export interface DashboardReducerState {
  epoch: string | null;
  lastSeq: number;
  seen: Set<string>;
  streamOffsets: Record<string, { content: number; reasoning: number; token: string | null; attempt: number }>;
  messages: Record<string, DashboardEntityState>;
  tools: Record<string, DashboardEntityState>;
  interactions: Record<string, DashboardEntityState>;
  attachments: Record<string, DashboardEntityState>;
  artifacts: Record<string, DashboardEntityState>;
  goals: Record<string, DashboardEntityState>;
  todos: Record<string, DashboardEntityState>;
  prompts: Record<string, DashboardEntityState>;
  anomalies: any[];
}

export interface DashboardBatcher {
  enqueue(event: any): void;
  flush(): void;
  discard(predicate?: (event: any) => boolean): void;
  dispose(): void;
}

/**
 * Small client-side convergence guard. The existing chat handler remains the
 * renderer; this layer only rejects duplicate or late terminal facts.
 */
export function createDashboardEventGuard(maxEvents = 4096): DashboardEventGuard {
  const eventIds = new Set<string>();
  const terminalTools = new Map<string, TerminalState>();
  const terminalMessages = new Map<string, { fingerprint: string; eventEpoch: string | null; eventSeq: number | null; revision: string | null }>();

  const assistantFinalFingerprint = (event: any): string => {
    try {
      return JSON.stringify({
        text: event?.text ?? "",
        taskState: event?.taskState ?? null,
        artifactIncomplete: event?.artifactIncomplete === true,
        warnings: Array.isArray(event?.warnings) ? event.warnings : [],
        receipt: event?.receipt ?? null,
      });
    } catch {
      return String(event?.text ?? "");
    }
  };

  const remember = (id: string): boolean => {
    if (!id) return true;
    if (eventIds.has(id)) return false;
    eventIds.add(id);
    while (eventIds.size > maxEvents) eventIds.delete(eventIds.values().next().value as string);
    return true;
  };

  return {
    accept(event: any): boolean {
      if (!event || typeof event !== "object") return false;
      if (!remember(String(event.eventId ?? ""))) return false;

      const toolCallId = String(event.toolCallId ?? event.id ?? "");
      const status = String(event.status ?? "");
      if ((event.kind === "tool" || event.kind === "tool_start") && toolCallId) {
        const previous = terminalTools.get(toolCallId);
        if (previous && TERMINAL_TOOL_STATES.has(previous)) return false;
        if (TERMINAL_TOOL_STATES.has(status as TerminalState)) terminalTools.set(toolCallId, status as TerminalState);
      }

      if (event.kind === "assistant_final" && event.id) {
        const id = String(event.id);
        const fingerprint = assistantFinalFingerprint(event);
        const previous = terminalMessages.get(id);
        const nextEpoch = event.eventEpoch ? String(event.eventEpoch) : null;
        const nextSeq = Number.isSafeInteger(Number(event.eventSeq)) ? Number(event.eventSeq) : null;
        const revision = event.revision ? String(event.revision) : null;
        const correction = event.correction === true || Boolean(revision);
        if (previous) {
          if (nextEpoch && previous.eventEpoch === nextEpoch && nextSeq !== null && previous.eventSeq !== null && nextSeq <= previous.eventSeq) return false;
          if (!correction) return false;
          if (revision && revision === previous.revision && fingerprint === previous.fingerprint) return false;
        }
        terminalMessages.set(id, { fingerprint, eventEpoch: nextEpoch, eventSeq: nextSeq, revision });
      }
      if (event.kind === "messages-reset") {
        terminalTools.clear();
        terminalMessages.clear();
      }
      return true;
    },
    reset() {
      eventIds.clear();
      terminalTools.clear();
      terminalMessages.clear();
    },
    size: () => eventIds.size,
  };
}

const terminalStates = new Set(["completed", "succeeded", "failed", "cancelled", "unknown"]);

export function createDashboardReducerState(seed?: Partial<DashboardReducerState>): DashboardReducerState {
  return {
    epoch: seed?.epoch ?? null,
    lastSeq: seed?.lastSeq ?? 0,
    seen: new Set(seed?.seen ?? []),
    streamOffsets: { ...(seed?.streamOffsets ?? {}) },
    messages: { ...(seed?.messages ?? {}) },
    tools: { ...(seed?.tools ?? {}) },
    interactions: { ...(seed?.interactions ?? {}) },
    attachments: { ...(seed?.attachments ?? {}) },
    artifacts: { ...(seed?.artifacts ?? {}) },
    goals: { ...(seed?.goals ?? {}) },
    todos: { ...(seed?.todos ?? {}) },
    prompts: { ...(seed?.prompts ?? {}) },
    anomalies: [...(seed?.anomalies ?? [])],
  };
}

function entityBucket(kind: string, event: any): keyof Pick<DashboardReducerState, "messages" | "tools" | "interactions" | "attachments" | "artifacts" | "goals" | "todos" | "prompts"> | null {
  const explicit = String(event?.entityType ?? event?.entityKind ?? event?.payload?.entityType ?? "").toLowerCase();
  if (explicit === "message" || event?.kind?.startsWith("message")) return "messages";
  if (explicit === "tool" || event?.kind?.startsWith("tool")) return "tools";
  if (explicit === "interaction" || event?.kind?.startsWith("interaction")) return "interactions";
  if (explicit === "attachment" || event?.kind?.startsWith("attachment")) return "attachments";
  if (explicit === "artifact" || event?.kind?.startsWith("artifact")) return "artifacts";
  if (explicit === "goal" || event?.kind === "goal-update" || event?.kind?.startsWith("goal.")) return "goals";
  if (explicit === "todo" || event?.kind === "todo-update" || event?.kind?.startsWith("todo.")) return "todos";
  if (explicit === "prompt" || event?.kind === "prompt-update" || event?.kind === "operation-steering" || event?.kind?.startsWith("prompt.")) return "prompts";
  return null;
}

export function applyDashboardEvent(input: DashboardReducerState, event: any): { state: DashboardReducerState; changed: boolean; duplicate?: boolean; resyncRequired?: boolean; anomaly?: string } {
  const state = createDashboardReducerState(input);
  if (!event || typeof event !== "object") return { state, changed: false, anomaly: "invalid-event" };
  const eventId = String(event.eventId ?? "");
  if (eventId && state.seen.has(eventId)) return { state, changed: false, duplicate: true };
  const eventIds = [eventId, ...(Array.isArray(event.coalescedEventIds) ? event.coalescedEventIds.map((id: any) => String(id ?? "")) : [])]
    .filter((id, index, values) => id && values.indexOf(id) === index);
  const epoch = event.eventEpoch ? String(event.eventEpoch) : null;
  if (epoch && state.epoch && epoch !== state.epoch) return { state, changed: false, resyncRequired: true, anomaly: "epoch-changed" };
  if (epoch) state.epoch = epoch;
  const seq = Number(event.eventSeq);
  const firstSeq = firstEventSequence(event);
  if (Number.isSafeInteger(seq) && firstSeq !== null && firstSeq > state.lastSeq + 1) {
    state.anomalies.push({ type: "event-gap", expected: state.lastSeq + 1, received: firstSeq });
    // The canonical snapshot will contain the observed event's facts. Advance
    // the cursor so post-resync live events are compared against this point
    // instead of repeatedly reopening the same gap.
    state.lastSeq = Math.max(state.lastSeq, seq);
    return { state, changed: false, resyncRequired: true, anomaly: "event-gap" };
  }
  if (Number.isSafeInteger(seq)) state.lastSeq = Math.max(state.lastSeq, seq);
  for (const id of eventIds) state.seen.add(id);
  while (state.seen.size > 4096) state.seen.delete(state.seen.values().next().value as string);

  const kind = String(event.kind ?? "");
  if (kind === "assistant_delta") {
    const messageId = String(event.messageId ?? event.id ?? "");
    if (!messageId) return { state, changed: false, anomaly: "delta-missing-message" };
    const previous = state.streamOffsets[messageId] ?? { content: 0, reasoning: 0, token: null, attempt: 1 };
    const attempt = Math.max(1, Number.isSafeInteger(Number(event.attempt)) ? Number(event.attempt) : previous.attempt);
    // A retry replaces the current stream, but a delayed chunk from an older
    // attempt must never rewind the reducer back to that attempt. The server
    // projector normally filters this case; keep the reducer safe for replay,
    // tests, and other event consumers as well.
    if (attempt < previous.attempt) {
      state.anomalies.push({ type: "stale-attempt", entityId: messageId, expected: previous.attempt, received: attempt });
      return { state, changed: false, duplicate: true, anomaly: "stale-attempt" };
    }
    const reset = event.streamReset === true || attempt > previous.attempt;
    const content = String(event.contentDelta ?? "");
    const reasoning = String(event.reasoningDelta ?? "");
    const token = event.streamId ?? event.stepId ?? event.turnId ?? previous.token ?? null;
    const enforceOffsets = event.streamId != null
      || event.stepId != null
      || event.turnId != null
      || event.attempt !== undefined
      || event.streamReset === true;
    const expectedContent = reset ? 0 : previous.content;
    const expectedReasoning = reset ? 0 : previous.reasoning;
    const contentOffset = Number(event.offset);
    const reasoningOffset = Number(event.reasoningOffset);
    const check = (value: string, supplied: number, expected: number, field: string): "ok" | "duplicate" | "gap" => {
      if (!value || !enforceOffsets || !Number.isSafeInteger(supplied) || supplied < 0) return "ok";
      if (supplied === 0 && expected > 0 && token !== previous.token && !reset) return "ok";
      if (supplied < expected) return "duplicate";
      if (supplied > expected) {
        state.anomalies.push({ type: "delta-gap", entityId: messageId, field, expected, received: supplied });
        return "gap";
      }
      return "ok";
    };
    const contentStatus = check(content, contentOffset, expectedContent, "content");
    const reasoningStatus = check(reasoning, reasoningOffset, expectedReasoning, "reasoning");
    if (contentStatus === "gap" || reasoningStatus === "gap") return { state, changed: false, resyncRequired: true, anomaly: "delta-gap" };
    const acceptedContent = contentStatus === "duplicate" ? "" : content;
    const acceptedReasoning = reasoningStatus === "duplicate" ? "" : reasoning;
    if (!acceptedContent && !acceptedReasoning) return { state, changed: false, duplicate: true };
    state.streamOffsets = {
      ...state.streamOffsets,
      [messageId]: {
        content: expectedContent + acceptedContent.length,
        reasoning: expectedReasoning + acceptedReasoning.length,
        token: token === null ? null : String(token),
        attempt,
      },
    };
    return { state, changed: true };
  }
  if (kind === "todo-update") {
    const previousTodos = state.todos;
    const nextTodos: Record<string, DashboardEntityState> = {};
    for (const [index, item] of (Array.isArray(event.todos) ? event.todos : []).entries()) {
      const itemId = String(item?.id ?? `todo-${index + 1}`);
      const previous = previousTodos[itemId];
      const next = { ...(previous ?? { id: itemId }), ...item, id: itemId };
      nextTodos[itemId] = next;
    }
    const changed = Object.keys(previousTodos).length !== Object.keys(nextTodos).length
      || Object.keys(nextTodos).some((id) => JSON.stringify(previousTodos[id]) !== JSON.stringify(nextTodos[id]));
    state.todos = nextTodos;
    return { state, changed };
  }
  if (kind === "prompt-update") {
    const previousPrompts = state.prompts;
    const nextPrompts: Record<string, DashboardEntityState> = {};
    for (const [index, item] of (Array.isArray(event.prompts) ? event.prompts : []).entries()) {
      const itemId = String(item?.id ?? `prompt-${index + 1}`);
      const previous = previousPrompts[itemId];
      const next = { ...(previous ?? { id: itemId }), ...item, id: itemId };
      nextPrompts[itemId] = next;
    }
    const changed = Object.keys(previousPrompts).length !== Object.keys(nextPrompts).length
      || Object.keys(nextPrompts).some((id) => JSON.stringify(previousPrompts[id]) !== JSON.stringify(nextPrompts[id]));
    state.prompts = nextPrompts;
    return { state, changed };
  }
  const bucket = entityBucket(kind, event);
  const payload = event.payload && typeof event.payload === "object" ? event.payload : event;
  const entityPayload = kind === "operation-steering" && event.steering && typeof event.steering === "object"
    ? event.prompt ?? event.steering
    : payload;
  const id = String(event.entityId ?? event.toolCallId ?? event.interactionId ?? event.attachmentId ?? event.artifactId ?? event.id ?? entityPayload?.id ?? "");
  if (!bucket || !id) return { state, changed: false };
  const previous = state[bucket][id];
  const requestedState = String(entityPayload.state ?? payload.state ?? event.status ?? (String(event.kind).split(".").at(-1) ?? ""));
  if (previous && terminalStates.has(String(previous.state)) && requestedState && requestedState !== previous.state) {
    state.anomalies.push({ type: "late-terminal-update", entityId: id, state: requestedState });
    return { state, changed: false, anomaly: "late-terminal-update" };
  }
  state[bucket] = { ...state[bucket], [id]: { ...(previous ?? { id }), ...entityPayload, id, ...(requestedState ? { state: requestedState } : {}) } };
  return { state, changed: JSON.stringify(previous) !== JSON.stringify(state[bucket][id]) };
}

const DELTA_KINDS = new Set(["assistant_delta", "reasoning_delta", "tool_output", "task_progress"]);
const DELTA_FIELDS = ["contentDelta", "reasoningDelta", "outputDelta", "textDelta", "delta"];
const OFFSET_FIELDS: Record<string, string> = {
  contentDelta: "offset",
  reasoningDelta: "reasoningOffset",
  outputDelta: "offset",
  textDelta: "offset",
  delta: "offset",
};
const STREAM_ID_FIELDS = ["sessionId", "turnId", "messageId", "id", "toolCallId", "taskId", "contentIndex"];

function textLength(value: any): number {
  return typeof value === "string" ? value.length : 0;
}

function eventChars(event: any): number {
  try { return JSON.stringify(event).length; } catch { return 0; }
}

function firstEventSequence(event: any): number | null {
  const values = [Number(event?.eventSeq)];
  for (const id of Array.isArray(event?.coalescedEventIds) ? event.coalescedEventIds : []) {
    const match = /:\d+$/u.exec(String(id ?? ""));
    if (match) values.push(Number(match[0].slice(1)));
  }
  const valid = values.filter((value) => Number.isSafeInteger(value) && value >= 0);
  return valid.length > 0 ? Math.min(...valid) : null;
}

function streamIdentityMatches(left: any, right: any): boolean {
  if (String(left?.kind ?? "") !== String(right?.kind ?? "")) return false;
  let identified = false;
  let entityIdentified = false;
  for (const field of STREAM_ID_FIELDS) {
    const a = left?.[field];
    const b = right?.[field];
    if (a !== undefined || b !== undefined) {
      identified = true;
      if (["messageId", "id", "toolCallId", "taskId", "contentIndex"].includes(field)) entityIdentified = true;
      if (String(a ?? "") !== String(b ?? "")) return false;
    }
  }
  return identified && entityIdentified;
}

function deltaFields(event: any): string[] {
  return DELTA_FIELDS.filter((field) => textLength(event?.[field]) > 0);
}

function canMergeDelta(left: any, right: any): boolean {
  if (!DELTA_KINDS.has(String(left?.kind ?? "")) || !streamIdentityMatches(left, right)) return false;
  const fields = deltaFields(right);
  if (fields.length === 0) return false;
  for (const field of fields) {
    const previousText = textLength(left?.[field]) > 0 ? String(left[field]) : "";
    if (!previousText) return false;
    const previousOffset = Number(left?.[OFFSET_FIELDS[field]]);
    const nextOffset = Number(right?.[OFFSET_FIELDS[field]]);
    if (!Number.isSafeInteger(previousOffset) || !Number.isSafeInteger(nextOffset)) return false;
    if (nextOffset !== previousOffset + previousText.length) return false;
  }
  return true;
}

function mergeDelta(left: any, right: any): any {
  const merged = {
    ...left,
    ...(right?.eventEpoch !== undefined ? { eventEpoch: right.eventEpoch } : {}),
    ...(right?.eventSeq !== undefined ? { eventSeq: right.eventSeq } : {}),
    ...(right?.eventId !== undefined ? { eventId: right.eventId } : {}),
    ...(right?.emittedAt !== undefined ? { emittedAt: right.emittedAt } : {}),
    ...(right?.occurredAt !== undefined ? { occurredAt: right.occurredAt } : {}),
  };
  const coalescedEventIds = [
    ...(Array.isArray(left?.coalescedEventIds) ? left.coalescedEventIds : []),
    ...(left?.eventId ? [left.eventId] : []),
    ...(Array.isArray(right?.coalescedEventIds) ? right.coalescedEventIds : []),
    ...(right?.eventId ? [right.eventId] : []),
  ].filter((id, index, values) => id && id !== merged.eventId && values.indexOf(id) === index);
  if (coalescedEventIds.length > 0) merged.coalescedEventIds = coalescedEventIds;
  for (const field of DELTA_FIELDS) {
    const next = right?.[field];
    if (typeof next === "string" && next) merged[field] = `${typeof merged[field] === "string" ? merged[field] : ""}${next}`;
  }
  return merged;
}

function splitDelta(event: any, maxChars: number): any[] {
  const fields = deltaFields(event);
  if (fields.length === 0) return [event];
  const longest = Math.max(...fields.map((field) => textLength(event[field])));
  if (longest <= maxChars) return [event];
  const chunks: any[] = [];
  for (let offset = 0; offset < longest; offset += maxChars) {
    const chunk = { ...event };
    if (event.eventId) {
      // A single incoming event may become several queued chunks. Give each
      // chunk its own identity so reducer event-id dedupe does not drop the
      // tail during replay.
      chunk.eventId = `${event.eventId}:chunk:${Math.floor(offset / maxChars) + 1}`;
      chunk.coalescedEventIds = [event.eventId];
    }
    for (const field of fields) {
      const value = String(event[field]);
      const start = Math.min(offset, value.length);
      const end = Math.min(value.length, offset + maxChars);
      chunk[field] = value.slice(start, end);
      const offsetField = OFFSET_FIELDS[field];
      const baseOffset = Number(event[offsetField]);
      if (Number.isSafeInteger(baseOffset)) chunk[offsetField] = baseOffset + start;
    }
    chunks.push(chunk);
  }
  return chunks;
}

/** Coalesces contiguous transient deltas; control/terminal events remain barriers. */
export function createDashboardEventBatcher({ onFlush, maxEvents = 64, maxChars = 24000, delayMs = 16 } : { onFlush: (events: any[]) => void; maxEvents?: number; maxChars?: number; delayMs?: number }): DashboardBatcher {
  const queue: any[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const eventLimit = Math.max(1, maxEvents);
  const charLimit = Math.max(1, maxChars);
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (disposed || queue.length === 0) return;
    const batch = queue.splice(0);
    onFlush(batch);
  };
  const schedule = () => {
    if (timer || disposed) return;
    timer = setTimeout(flush, Math.max(0, delayMs));
  };
  return {
    enqueue(event: any) {
      if (disposed || !event) return;
      const kind = String(event.kind ?? "");
      const chunks = DELTA_KINDS.has(kind) ? splitDelta(event, charLimit) : [event];
      for (const chunk of chunks) {
        const isDelta = DELTA_KINDS.has(String(chunk.kind ?? ""));
        if (!isDelta) flush();
        const previous = queue.at(-1);
        if (isDelta && previous && canMergeDelta(previous, chunk)) {
          queue[queue.length - 1] = mergeDelta(previous, chunk);
        } else {
          if (isDelta && queue.length > 0 && eventChars(queue[0]) + eventChars(chunk) >= charLimit) flush();
          queue.push(chunk);
        }
        const chars = queue.reduce((sum, item) => sum + eventChars(item), 0);
        if (!isDelta || queue.length >= eventLimit || chars >= charLimit) flush();
        else schedule();
      }
    },
    flush,
    discard(predicate) {
      if (timer) clearTimeout(timer);
      timer = null;
      if (typeof predicate !== "function") {
        queue.splice(0);
        return;
      }
      for (let index = queue.length - 1; index >= 0; index--) {
        if (predicate(queue[index])) queue.splice(index, 1);
      }
      if (queue.length > 0 && !disposed) schedule();
    },
    dispose() {
      if (disposed) return;
      flush();
      disposed = true;
    },
  };
}
