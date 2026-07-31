/**
 * Pure client-side projection for chat messages, tool progress and transient
 * assistant streams. The projector deliberately does not own transport state
 * or mutate the supplied entities, so snapshot replay and live rendering use
 * the same ordering rules.
 */

export type ChatTimelineEntity = Record<string, any>;

export interface ChatTimelineFrame {
  id: string;
  kind: "message" | "tool";
  role: string;
  turnId: string;
  segmentId: string;
  /** First event position of this frame. Retries keep this anchor. */
  startEventSeq: number | null;
  /** Alias exposed to consumers that use the existing eventSeq convention. */
  eventSeq: number | null;
  eventEpoch: string | null;
  message: ChatTimelineEntity;
  streaming: boolean;
}

export interface ChatTurnProjection {
  id: string;
  turnId: string;
  frames: ChatTimelineFrame[];
}

export interface ChatTimelineProjection {
  frames: ChatTimelineFrame[];
  turns: ChatTurnProjection[];
}

export interface ChatStreamingSegment extends ChatTimelineEntity {
  messageId?: string;
  segmentId: string;
  startEventSeq?: number | null;
  /** Frozen live segments stay in the timeline but no longer show a cursor. */
  streaming?: boolean;
}

interface InternalFrame {
  message: ChatTimelineEntity;
  sourceIndex: number;
  eventSeq: number | null;
  eventEpoch: string | null;
  turnId: string | null;
  role: string;
  toolKey: string | null;
  stepKey: string | null;
  streaming: boolean;
  explicitSegmentId: string | null;
}

function textValue(value: any): string {
  return value === null || value === undefined ? "" : String(value);
}

function frameValue(value: any): string {
  return textValue(value).trim();
}

function eventSequence(value: any): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function eventEpoch(value: any): string | null {
  const valueString = frameValue(value);
  return valueString || null;
}

function roleOf(entity: ChatTimelineEntity): string {
  return frameValue(entity?.role).toLowerCase() || "assistant";
}

function toolCallIdOf(entity: ChatTimelineEntity): string {
  return frameValue(entity?.toolCallId ?? entity?.tool_call_id ?? entity?.callId);
}

function turnIdOf(entity: ChatTimelineEntity): string | null {
  const turn = frameValue(entity?.turnId ?? entity?.turn_id);
  return turn || null;
}

function stepIdOf(entity: ChatTimelineEntity): string {
  return frameValue(entity?.stepId ?? entity?.step_id);
}

function toolIdentity(entity: ChatTimelineEntity): string | null {
  const callId = toolCallIdOf(entity);
  if (!callId) return null;
  return `tool:${JSON.stringify([turnIdOf(entity) ?? "", stepIdOf(entity), callId])}`;
}

/**
 * A streamed assistant segment can be materialized twice while an event
 * stream catches up: once as `assistant_content_final` and once as the
 * frozen row emitted at the following tool boundary.  Both records carry the
 * same explicit segment id, so treat them as one frame instead of relying on
 * their generated row ids (which are intentionally different).
 */
function assistantSegmentIdentity(entity: ChatTimelineEntity): string | null {
  const segment = frameValue(entity?.__timelineSegmentId ?? entity?.segmentId);
  if (!segment) return null;
  const message = frameValue(entity?.assistantMessageId ?? entity?.messageId ?? entity?.id);
  if (!message) return null;
  return `assistant:${JSON.stringify([message, segment])}`;
}

function assistantHasMeaning(entity: ChatTimelineEntity): boolean {
  if (frameValue(entity?.text ?? entity?.content ?? entity?.message)) return true;
  if (frameValue(entity?.reasoning ?? entity?.reasoningText)) return true;
  if (Array.isArray(entity?.warnings) && entity.warnings.length > 0) return true;
  if (entity?.receipt !== undefined && entity?.receipt !== null) return true;
  if (entity?.finalized === true) return true;
  for (const field of [
    "taskState",
    "executionState",
    "goalState",
    "taskContract",
    "evidenceRefs",
    "interventionChoice",
    "artifactIncomplete",
    "error",
    "diagnosticMessage",
  ]) {
    if (entity?.[field] !== undefined && entity?.[field] !== null && entity?.[field] !== "") return true;
  }
  return false;
}

const TERMINAL_EXECUTION_STATES = new Set([
  "completed",
  "completed_with_warnings",
  "succeeded",
  "failed",
  "cancelled",
  "canceled",
  "incomplete",
  "needs_intervention",
  "unknown",
  "verified",
  "present_unverified",
  "invalid",
]);

function hasTerminalValue(value: any): boolean {
  const normalized = frameValue(value).toLowerCase();
  return Boolean(normalized) && TERMINAL_EXECUTION_STATES.has(normalized);
}

/**
 * A plain assistant sentence is not proof that the execution turn is done.
 * Tool groups may only settle after the runtime publishes a terminal fact or
 * receipt; this prevents a streamed progress sentence from hiding a failed
 * or still-running tool group.
 */
export function assistantHasAuthoritativeFinalEvidence(entity: ChatTimelineEntity): boolean {
  if (!entity || typeof entity !== "object") return false;
  if (entity.finalized === true) return true;
  if (entity.receipt && typeof entity.receipt === "object") return true;
  return [entity.taskState, entity.executionState, entity.goalState].some(hasTerminalValue);
}

/** Normalize the two server representations (`text` and `content`) to one. */
function normalizeTool(entity: ChatTimelineEntity, sourceIndex: number): ChatTimelineEntity {
  const callId = toolCallIdOf(entity);
  const content = entity?.content !== undefined ? entity.content : entity?.text;
  const text = typeof content === "string" ? content : content === undefined || content === null ? "" : JSON.stringify(content);
  const id = frameValue(entity?.id) || `tool-${callId || sourceIndex + 1}`;
  return {
    ...entity,
    id,
    role: "tool",
    toolCallId: callId || entity?.toolCallId,
    text,
    ...(entity?.toolArgs !== undefined || entity?.args !== undefined
      ? { toolArgs: entity?.toolArgs ?? entity?.args }
      : {}),
    toolStatus: entity?.toolStatus ?? entity?.status ?? entity?.state ?? "unknown",
  };
}

function normalizeMessage(entity: ChatTimelineEntity, sourceIndex: number): ChatTimelineEntity {
  const id = frameValue(entity?.id) || `message-${sourceIndex + 1}`;
  return { ...entity, id };
}

function toInternal(entity: ChatTimelineEntity, sourceIndex: number, streaming = false): InternalFrame {
  const role = roleOf(entity);
  const message = role === "tool" ? normalizeTool(entity, sourceIndex) : normalizeMessage(entity, sourceIndex);
  const seq = streaming
    ? eventSequence(entity?.startEventSeq ?? entity?.eventSeq)
    : eventSequence(entity?.eventSeq ?? entity?.startEventSeq);
  return {
    message,
    sourceIndex,
    eventSeq: seq,
    eventEpoch: eventEpoch(entity?.eventEpoch ?? entity?.epoch),
    turnId: turnIdOf(entity),
    role,
    toolKey: role === "tool" ? toolIdentity(entity) : null,
    stepKey: role === "tool" ? stepIdOf(entity) : null,
    streaming,
    explicitSegmentId: streaming ? frameValue(entity?.segmentId) || null : frameValue(entity?.segmentId) || null,
  };
}

function mergeToolRetry(existing: InternalFrame, next: InternalFrame): InternalFrame {
  const oldText = frameValue(existing.message?.text);
  const nextText = frameValue(next.message?.text);
  const message = {
    ...existing.message,
    ...next.message,
    ...(nextText || !oldText ? {} : { text: existing.message.text }),
  };
  const oldSeq = existing.eventSeq;
  const nextSeq = next.eventSeq;
  const firstSeq = oldSeq === null ? nextSeq : nextSeq === null ? oldSeq : Math.min(oldSeq, nextSeq);
  return {
    ...existing,
    message,
    eventSeq: firstSeq,
    eventEpoch: existing.eventEpoch ?? next.eventEpoch,
  };
}

function mergeAssistantSegment(existing: InternalFrame, next: InternalFrame): InternalFrame {
  const oldText = frameValue(existing.message?.text);
  const nextText = frameValue(next.message?.text);
  const message = {
    ...existing.message,
    ...next.message,
    id: existing.message?.id ?? next.message?.id,
    ...(nextText || !oldText ? {} : { text: existing.message.text }),
  };
  const oldSeq = existing.eventSeq;
  const nextSeq = next.eventSeq;
  const firstSeq = oldSeq === null ? nextSeq : nextSeq === null ? oldSeq : Math.min(oldSeq, nextSeq);
  return {
    ...existing,
    message,
    eventSeq: firstSeq,
    eventEpoch: existing.eventEpoch ?? next.eventEpoch,
  };
}

function mergeEntities(
  messages: ChatTimelineEntity[],
  tools: ChatTimelineEntity[],
): InternalFrame[] {
  const items: InternalFrame[] = [];
  const toolIndexes = new Map<string, number>();
  const assistantSegmentIndexes = new Map<string, number>();
  const append = (entity: ChatTimelineEntity, sourceIndex: number) => {
    if (!entity || typeof entity !== "object") return;
    const item = toInternal(entity, sourceIndex);
    if (item.role === "tool" && item.toolKey) {
      const existingIndex = toolIndexes.get(item.toolKey);
      if (existingIndex !== undefined) {
        items[existingIndex] = mergeToolRetry(items[existingIndex], item);
        return;
      }
      toolIndexes.set(item.toolKey, items.length);
    }
    if (item.role === "assistant") {
      const segmentKey = assistantSegmentIdentity(item.message);
      if (segmentKey) {
        const existingIndex = assistantSegmentIndexes.get(segmentKey);
        if (existingIndex !== undefined) {
          items[existingIndex] = mergeAssistantSegment(items[existingIndex], item);
          return;
        }
        assistantSegmentIndexes.set(segmentKey, items.length);
      }
    }
    items.push(item);
  };
  for (const [index, entity] of (Array.isArray(messages) ? messages : []).entries()) append(entity, index);
  const offset = Array.isArray(messages) ? messages.length : 0;
  for (const [index, entity] of (Array.isArray(tools) ? tools : []).entries()) append(entity, offset + index);
  return items;
}

function streamingIdentity(item: InternalFrame): string {
  return frameValue(item.message?.messageId ?? item.message?.id);
}

function replaceFinalStreamingSegments(items: InternalFrame[]): InternalFrame[] {
  const streams = items.filter((item) => item.streaming && item.role === "assistant");
  const finals = items.filter((item) => !item.streaming && item.role === "assistant");
  const consumedFinals = new Set<InternalFrame>();
  for (const final of finals) {
    const finalId = streamingIdentity(final);
    if (!finalId) continue;
    const candidates = streams.filter((stream) => {
      if (stream.streaming === false || streamingIdentity(stream) !== finalId) return false;
      const finalSegment = frameValue(final.message?.segmentId);
      return !finalSegment || finalSegment === final.explicitSegmentId;
    });
    if (candidates.length === 0) continue;
    candidates.sort((left, right) => (left.eventSeq ?? Number.MAX_SAFE_INTEGER) - (right.eventSeq ?? Number.MAX_SAFE_INTEGER) || left.sourceIndex - right.sourceIndex);
    const target = candidates.at(-1)!;
    const finalText = frameValue(final.message?.text ?? final.message?.content);
    target.message = {
      ...target.message,
      ...final.message,
      ...(finalText || !frameValue(target.message?.text) ? {} : { text: target.message.text }),
      id: final.message.id ?? target.message.id,
    };
    target.streaming = false;
    target.eventEpoch = target.eventEpoch ?? final.eventEpoch;
    consumedFinals.add(final);
  }
  return items.filter((item) => !consumedFinals.has(item));
}

/** Sort only sequenced records belonging to the same epoch in their source slots. */
function orderWithinEpochSlots(items: InternalFrame[]): InternalFrame[] {
  const result = items.slice();
  const groups = new Map<string, number[]>();
  for (const [index, item] of result.entries()) {
    if (item.eventSeq === null) continue;
    const key = item.eventEpoch || "__unscoped__";
    const indexes = groups.get(key) ?? [];
    indexes.push(index);
    groups.set(key, indexes);
  }
  for (const indexes of groups.values()) {
    if (indexes.length < 2) continue;
    const ordered = indexes.map((index) => result[index]).sort((left, right) => (left.eventSeq! - right.eventSeq!) || (left.sourceIndex - right.sourceIndex));
    for (const [slot, item] of indexes.entries()) result[item] = ordered[slot];
  }
  return result;
}

function assignTurnIds(items: InternalFrame[]): void {
  let legacyTurn = "";
  let legacyIndex = 0;
  for (const item of items) {
    if (item.turnId) {
      legacyTurn = item.turnId;
      continue;
    }
    if (item.role === "user" || !legacyTurn) legacyTurn = `legacy-turn-${++legacyIndex}`;
    item.turnId = legacyTurn;
  }
}

function assignSegments(items: InternalFrame[]): void {
  const counters = new Map<string, { assistant: number; tool: number; other: number }>();
  let previous: InternalFrame | null = null;
  let previousSegment = "";
  let previousToolStep = "";
  for (const item of items) {
    const turn = item.turnId ?? "legacy-turn-1";
    const counter = counters.get(turn) ?? { assistant: 0, tool: 0, other: 0 };
    let segment = item.explicitSegmentId;
    if (!segment) {
      if (item.role === "assistant") {
        if (previous?.turnId === turn && previous.role === "assistant") segment = previousSegment;
        else segment = `${turn}:assistant:${++counter.assistant}`;
      } else if (item.role === "tool") {
        const step = item.stepKey || `call:${frameValue(item.message?.toolCallId)}`;
        if (previous?.turnId === turn && previous.role === "tool" && previousToolStep === step) segment = previousSegment;
        else segment = `${turn}:tool:${++counter.tool}`;
        previousToolStep = step;
      } else {
        segment = `${turn}:${item.role || "message"}:${++counter.other}`;
      }
    }
    counters.set(turn, counter);
    item.explicitSegmentId = segment;
    previous = item;
    previousSegment = segment;
  }
}

function frameFromInternal(item: InternalFrame, index: number): ChatTimelineFrame {
  const segmentId = item.explicitSegmentId || `${item.turnId ?? "legacy-turn-1"}:message:${index + 1}`;
  const messageId = frameValue(item.message?.id) || `${item.role}-${index + 1}`;
  return {
    id: item.streaming ? `${messageId}:${segmentId}` : messageId,
    kind: item.role === "tool" ? "tool" : "message",
    role: item.role,
    turnId: item.turnId ?? "legacy-turn-1",
    segmentId,
    startEventSeq: item.eventSeq,
    eventSeq: item.eventSeq,
    eventEpoch: item.eventEpoch,
    message: item.message,
    streaming: item.streaming,
  };
}

/**
 * Projects live and snapshot entities into one deterministic chat timeline.
 * `tools` may be a separate canonical snapshot collection. `streamingSegments`
 * are transient assistant fragments and may share a messageId while retaining
 * distinct segment IDs across tool boundaries.
 */
export function projectChatTimeline(
  messages: ChatTimelineEntity[] = [],
  tools: ChatTimelineEntity[] = [],
  streamingSegments: ChatStreamingSegment[] = [],
): ChatTimelineProjection {
  const base = mergeEntities(Array.isArray(messages) ? messages : [], Array.isArray(tools) ? tools : []);
  const streamOffset = base.length + 1;
  const streams = (Array.isArray(streamingSegments) ? streamingSegments : [])
    .filter((segment) => segment && typeof segment === "object")
    .map((segment, index) => toInternal({ ...segment, role: "assistant" }, streamOffset + index, segment.streaming !== false));
  let items = replaceFinalStreamingSegments([...base, ...streams]);
  items = items.filter((item) => item.role !== "assistant" || assistantHasMeaning(item.message));
  items = orderWithinEpochSlots(items);
  assignTurnIds(items);
  assignSegments(items);
  const frames = items.map(frameFromInternal);
  const turnMap = new Map<string, ChatTurnProjection>();
  for (const frame of frames) {
    const existing = turnMap.get(frame.turnId);
    if (existing) existing.frames.push(frame);
    else turnMap.set(frame.turnId, { id: `turn:${frame.turnId}`, turnId: frame.turnId, frames: [frame] });
  }
  return { frames, turns: [...turnMap.values()] };
}
