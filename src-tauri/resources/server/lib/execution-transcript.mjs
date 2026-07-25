import { redactToolProgressValue } from "./tool-progress.mjs";
import { normalizeGoal, normalizePromptSteering, normalizeTodo } from "./execution-entities.mjs";

const INTERNAL_USER_PROMPT_RE = /^\[(?:系统自动续跑\s+\d+\/\d+|系统后台任务接管\s+document:[^\]]+|系统通用复杂任务调度|系统步骤检查点)\]/u;
const TERMINAL_TOOL_STATES = new Set(["succeeded", "failed", "cancelled", "unknown"]);

function textOf(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .filter((part) => part && part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

function safeId(value, fallback) {
  const text = String(value ?? "").trim();
  return text && /^[A-Za-z0-9._:-]+$/u.test(text) ? text : fallback;
}

function isInternalUser(entry) {
  if (entry?.role !== "user") return false;
  if (entry.internal === true) return true;
  return INTERNAL_USER_PROMPT_RE.test(textOf(entry.content ?? entry.text).trim());
}

function attachmentEntity(value, index, sessionId) {
  const source = typeof value === "string" ? { id: value } : value;
  const id = safeId(source?.id, `att-${index + 1}`);
  return {
    id,
    kind: source?.kind ?? source?.mimeType?.split("/")[0] ?? "file",
    mimeType: source?.mimeType ?? null,
    name: source?.name ?? null,
    size: Number.isFinite(Number(source?.size)) ? Math.max(0, Number(source.size)) : null,
    sessionId: sessionId ?? null,
  };
}

function artifactEntity(value, index, sessionId) {
  const source = typeof value === "string" ? { path: value } : value;
  const path = String(source?.path ?? source?.file?.path ?? "").trim();
  const id = safeId(source?.artifactId ?? source?.id, `artifact-${index + 1}`);
  return {
    id,
    artifactId: id,
    path: path || null,
    role: String(source?.role ?? "artifact"),
    sessionId: sessionId ?? null,
    verified: source?.verified === true || source?.verification === "verified",
    size: Number.isFinite(Number(source?.size ?? source?.file?.size)) ? Math.max(0, Number(source.size ?? source?.file?.size)) : null,
  };
}

function normalizeToolState(entry) {
  if (typeof entry?.toolStatus === "string" && entry.toolStatus.trim()) return entry.toolStatus.trim();
  if (entry?.isError === true) return "failed";
  return entry?.role === "tool" ? "succeeded" : "running";
}

function toolFrameFrom(entry, fallbackId, index, turnId = "session") {
  const toolCallId = safeId(entry?.toolCallId ?? entry?.tool_call_id, fallbackId);
  const state = normalizeToolState(entry);
  return {
    kind: "tool",
    frameId: `tool:${turnId}:${toolCallId}:${index}`,
    toolCallId,
    name: String(entry?.toolName ?? entry?.tool_name ?? entry?.name ?? "tool"),
    state: TERMINAL_TOOL_STATES.has(state) ? state : "running",
    outputPreview: String(redactToolProgressValue(textOf(entry.content ?? entry.text), { maxText: 1000 })),
    error: entry?.isError === true ? String(redactToolProgressValue(textOf(entry.content ?? entry.text), { maxText: 1000 })) : null,
  };
}

function scopedToolFrameKey(turnId, toolCallId) {
  return `${turnId || "session"}:${toolCallId}`;
}

function newTurn(id, prompt, entry, ordinal) {
  return {
    kind: "turn",
    turnId: id,
    ordinal,
    state: "unknown",
    prompt: prompt || null,
    startedAt: entry?.createdAt ?? entry?.timestamp ?? null,
    endedAt: null,
    steps: [],
    explicitState: entry?.taskState ?? entry?.state ?? entry?.receipt?.taskState ?? null,
    hasAssistant: false,
    hasUnresolvedTool: false,
  };
}

function closeTurn(turn, state = "unknown", endedAt = null) {
  if (!turn) return;
  turn.state = state;
  turn.endedAt = endedAt;
}

function inferTurnState(turn) {
  const explicit = String(turn?.explicitState ?? "").trim().toLowerCase();
  if (["completed", "succeeded", "failed", "cancelled", "unknown", "incomplete", "needs_intervention"].includes(explicit)) {
    if (explicit === "succeeded") return "completed";
    return explicit;
  }
  if (!turn?.hasAssistant || turn?.hasUnresolvedTool) return "unknown";
  return "completed";
}

/**
 * Projects persisted session entries into a stable, display-safe execution
 * transcript. This is a read model only; it never schedules or calls a model.
 */
export function projectExecutionTranscript(entries, { sessionId = null, goals = [], todos = [], prompts = [] } = {}) {
  const items = [];
  const attachments = new Map();
  const interactions = new Map();
  const artifacts = new Map();
  const receipts = new Map();
  const goalEntities = new Map();
  const todoEntities = new Map();
  const promptEntities = new Map();
  let turn = null;
  let turnOrdinal = 0;
  let stepOrdinal = 0;
  let messageOrdinal = 0;
  const toolFrames = new Map();

  const finishStep = () => {
    if (!turn?.steps.length) return;
    const step = turn.steps.at(-1);
    const unresolved = step.frames.some((frame) => frame.kind === "tool" && !TERMINAL_TOOL_STATES.has(frame.state));
    step.state = unresolved ? "unknown" : "completed";
  };
  const finishTurn = () => {
    if (!turn) return;
    finishStep();
    turn.hasUnresolvedTool = turn.steps.some((step) => step.frames.some((frame) => frame.kind === "tool" && !TERMINAL_TOOL_STATES.has(frame.state)));
    closeTurn(turn, inferTurnState(turn));
    turn = null;
    stepOrdinal = 0;
  };
  const startTurn = (entry) => {
    finishTurn();
    turnOrdinal += 1;
    const prompt = textOf(entry.content ?? entry.text);
    turn = newTurn(`t${turnOrdinal}`, prompt, entry, turnOrdinal);
    items.push(turn);
  };
  const ensureTurn = () => {
    if (!turn) {
      turnOrdinal += 1;
      turn = newTurn(`t${turnOrdinal}`, "", null, turnOrdinal);
      items.push(turn);
    }
    return turn;
  };
  const addStep = () => {
    const current = ensureTurn();
    stepOrdinal += 1;
    const step = { kind: "step", stepId: `${current.turnId}.s${stepOrdinal}`, ordinal: stepOrdinal, state: "running", frames: [] };
    current.steps.push(step);
    return step;
  };

  for (const raw of Array.isArray(entries) ? entries : []) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw;
    if (entry.role === "user") {
      if (isInternalUser(entry)) continue;
      startTurn(entry);
      for (const rawAttachment of Array.isArray(entry.attachments) ? entry.attachments : []) {
        const attachment = attachmentEntity(rawAttachment, attachments.size, sessionId);
        attachments.set(attachment.id, attachment);
        turn.attachmentIds = [...(turn.attachmentIds ?? []), attachment.id];
      }
      for (const rawImage of Array.isArray(entry.images) ? entry.images : []) {
        const attachment = attachmentEntity({ kind: "image", mimeType: "image/*", id: rawImage?.id ?? `image-${attachments.size + 1}` }, attachments.size, sessionId);
        attachments.set(attachment.id, attachment);
        turn.attachmentIds = [...(turn.attachmentIds ?? []), attachment.id];
      }
      continue;
    }
    if (entry.role === "assistant") {
      ensureTurn();
      turn.hasAssistant = true;
      const step = addStep();
      const text = textOf(entry.content ?? entry.text);
      if (text) {
        const textPreview = text.slice(0, 12000);
        step.frames.push({
          kind: "text",
          frameId: `${step.stepId}.text`,
          role: "assistant",
          text: textPreview,
          textLength: text.length,
          truncated: textPreview.length < text.length,
        });
      }
      for (const call of Array.isArray(entry.tool_calls) ? entry.tool_calls : []) {
        const frame = toolFrameFrom({ ...call, toolCallId: call.id, toolName: call.function?.name, content: "" }, `call-${messageOrdinal}`, messageOrdinal, turn.turnId);
        step.frames.push(frame);
        toolFrames.set(scopedToolFrameKey(turn.turnId, frame.toolCallId), frame);
        messageOrdinal += 1;
      }
      if (entry.receipt?.intervention?.interactionId) {
        const interactionId = safeId(entry.receipt.intervention.interactionId, `interaction-${messageOrdinal}`);
        interactions.set(interactionId, { id: interactionId, state: entry.receipt.intervention.active ? "pending" : "resolved", turnId: turn?.turnId ?? null });
      }
      if (entry.receipt && typeof entry.receipt === "object") {
        const receiptId = safeId(entry.receipt.turnId ?? entry.receipt.requestId, `receipt-${messageOrdinal + 1}`);
        receipts.set(receiptId, { id: receiptId, ...entry.receipt });
        for (const evidence of Array.isArray(entry.receipt.artifactEvidence) ? entry.receipt.artifactEvidence : []) {
          for (const file of Array.isArray(evidence?.files) ? evidence.files : []) {
            const artifact = artifactEntity({ ...file, verified: evidence.verified, role: "artifact" }, artifacts.size, sessionId);
            artifacts.set(artifact.id, artifact);
          }
        }
      }
      for (const rawArtifact of Array.isArray(entry.artifactFiles) ? entry.artifactFiles : []) {
        const artifact = artifactEntity(rawArtifact, artifacts.size, sessionId);
        artifacts.set(artifact.id, artifact);
      }
      if (entry.taskState || entry.state || entry.receipt?.taskState) {
        turn.explicitState = entry.taskState ?? entry.state ?? entry.receipt.taskState;
      }
      continue;
    }
    if (entry.role === "tool") {
      const current = ensureTurn();
      const frame = toolFrameFrom(entry, `tool-${messageOrdinal}`, messageOrdinal, current.turnId);
      const existing = toolFrames.get(scopedToolFrameKey(current.turnId, frame.toolCallId));
      if (existing) {
        existing.state = frame.state;
        existing.outputPreview = frame.outputPreview;
        existing.error = frame.error;
      } else {
        const step = addStep();
        step.frames.push(frame);
        toolFrames.set(scopedToolFrameKey(current.turnId, frame.toolCallId), frame);
      }
      messageOrdinal += 1;
      continue;
    }
    if (["warning", "error", "info"].includes(entry.role)) {
      const step = addStep();
      step.frames.push({ kind: "marker", frameId: `${step.stepId}.marker`, marker: entry.role, text: textOf(entry.content ?? entry.text).slice(0, 2000) });
    }
  }
  finishTurn();
  for (const [index, value] of (Array.isArray(goals) ? goals : []).entries()) {
    const goal = normalizeGoal({ ...value, sessionId: value?.sessionId ?? sessionId }, `goal-${index + 1}`);
    goalEntities.set(goal.id, goal);
  }
  for (const [index, value] of (Array.isArray(todos) ? todos : []).entries()) {
    const todo = normalizeTodo({ ...value, sessionId: value?.sessionId ?? sessionId }, `todo-${index + 1}`);
    todoEntities.set(todo.id, todo);
  }
  for (const [index, value] of (Array.isArray(prompts) ? prompts : []).entries()) {
    const prompt = normalizePromptSteering({ ...value, sessionId: value?.sessionId ?? sessionId }, `prompt-${index + 1}`);
    promptEntities.set(prompt.id, prompt);
  }
  return {
    schemaVersion: 1,
    sessionId: sessionId ?? null,
    items,
    attachments: [...attachments.values()],
    interactions: [...interactions.values()],
    artifacts: [...artifacts.values()],
    receipts: [...receipts.values()],
    goals: [...goalEntities.values()],
    todos: [...todoEntities.values()],
    prompts: [...promptEntities.values()],
    hasMoreOlder: false,
  };
}

function compareOrdinal(item, value) {
  return Number(item?.ordinal ?? 0) - Number(value ?? 0);
}

/** Turn-granular pagination; tool frames never get split across pages. */
export function paginateExecutionTranscript(snapshot, { beforeTurn = null, afterTurn = null, limit = 20 } = {}) {
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  const beforeRequested = Boolean(beforeTurn);
  const afterRequested = Boolean(afterTurn);
  const before = beforeRequested ? items.find((item) => item.turnId === beforeTurn)?.ordinal : null;
  const after = afterRequested ? items.find((item) => item.turnId === afterTurn)?.ordinal : null;
  if ((beforeRequested && before === undefined) || (afterRequested && after === undefined)) {
    return {
      ...snapshot,
      items: [],
      hasMoreOlder: false,
      hasMoreNewer: false,
      cursor: null,
      resyncRequired: true,
      cursorError: "transcript cursor is no longer valid",
    };
  }
  let selected;
  if (after !== null && after !== undefined) {
    selected = items.filter((item) => compareOrdinal(item, after) > 0).slice(0, pageSize);
  } else if (before !== null && before !== undefined) {
    const older = items.filter((item) => compareOrdinal(item, before) < 0);
    selected = older.slice(Math.max(0, older.length - pageSize));
  } else {
    selected = items.slice(Math.max(0, items.length - pageSize));
  }
  const first = selected[0]?.ordinal;
  const last = selected.at(-1)?.ordinal;
  return {
    ...snapshot,
    items: selected,
    hasMoreOlder: first !== undefined && items.some((item) => compareOrdinal(item, first) < 0),
    hasMoreNewer: last !== undefined && items.some((item) => compareOrdinal(item, last) > 0),
    cursor: last === undefined ? null : `t${last}`,
  };
}
