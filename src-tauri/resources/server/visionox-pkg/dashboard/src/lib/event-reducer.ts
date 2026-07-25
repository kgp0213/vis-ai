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
  dispose(): void;
}

/**
 * Small client-side convergence guard. The existing chat handler remains the
 * renderer; this layer only rejects duplicate or late terminal facts.
 */
export function createDashboardEventGuard(maxEvents = 4096): DashboardEventGuard {
  const eventIds = new Set<string>();
  const terminalTools = new Map<string, TerminalState>();
  const terminalMessages = new Set<string>();

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
        if (terminalMessages.has(id)) return false;
        terminalMessages.add(id);
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
  const epoch = event.eventEpoch ? String(event.eventEpoch) : null;
  if (epoch && state.epoch && epoch !== state.epoch) return { state, changed: false, resyncRequired: true, anomaly: "epoch-changed" };
  if (epoch) state.epoch = epoch;
  const seq = Number(event.eventSeq);
  if (Number.isSafeInteger(seq) && seq > state.lastSeq + 1) state.anomalies.push({ type: "event-gap", expected: state.lastSeq + 1, received: seq });
  if (Number.isSafeInteger(seq)) state.lastSeq = Math.max(state.lastSeq, seq);
  if (eventId) state.seen.add(eventId);
  while (state.seen.size > 4096) state.seen.delete(state.seen.values().next().value as string);

  const kind = String(event.kind ?? "");
  if (kind === "todo-update") {
    let changed = false;
    const previousTodos = state.todos;
    state.todos = {};
    for (const [index, item] of (Array.isArray(event.todos) ? event.todos : []).entries()) {
      const itemId = String(item?.id ?? `todo-${index + 1}`);
      const previous = state.todos[itemId];
      const next = { ...(previous ?? { id: itemId }), ...item, id: itemId };
      state.todos[itemId] = next;
      changed ||= JSON.stringify(previous) !== JSON.stringify(next);
    }
    changed ||= Object.keys(previousTodos).length !== Object.keys(state.todos).length;
    return { state, changed };
  }
  if (kind === "prompt-update") {
    let changed = false;
    const previousPrompts = state.prompts;
    state.prompts = {};
    for (const [index, item] of (Array.isArray(event.prompts) ? event.prompts : []).entries()) {
      const itemId = String(item?.id ?? `prompt-${index + 1}`);
      const previous = state.prompts[itemId];
      const next = { ...(previous ?? { id: itemId }), ...item, id: itemId };
      state.prompts[itemId] = next;
      changed ||= JSON.stringify(previous) !== JSON.stringify(next);
    }
    changed ||= Object.keys(previousPrompts).length !== Object.keys(state.prompts).length;
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

/** Coalesces only transient deltas; control/terminal events are barriers. */
export function createDashboardEventBatcher({ onFlush, maxEvents = 64, maxChars = 24000, delayMs = 16 } : { onFlush: (events: any[]) => void; maxEvents?: number; maxChars?: number; delayMs?: number }): DashboardBatcher {
  const queue: any[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const transient = new Set(["assistant_delta", "reasoning_delta", "status"]);
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
      if (!transient.has(kind)) flush();
      queue.push(event);
      const chars = queue.reduce((sum, item) => sum + JSON.stringify(item).length, 0);
      if (queue.length >= Math.max(1, maxEvents) || chars >= Math.max(1, maxChars) || !transient.has(kind)) flush();
      else schedule();
    },
    flush,
    dispose() { disposed = true; flush(); },
  };
}
