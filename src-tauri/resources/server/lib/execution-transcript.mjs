import { redactToolProgressValue } from "./tool-progress.mjs";
import { normalizeGoal, normalizePromptSteering, normalizeTodo } from "./execution-entities.mjs";
import { normalizeResourceReference } from "./resource-reference.mjs";

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
  const size = Number.isFinite(Number(source?.size)) ? Math.max(0, Number(source.size)) : 0;
  const resource = normalizeResourceReference({
    resourceId: id,
    kind: source?.resource?.kind ?? source?.kind ?? source?.mimeType?.split("/")[0] ?? "attachment",
    preview: source?.resource?.preview ?? source?.name ?? "",
    totalBytes: source?.resource?.totalBytes ?? size,
    offsetBytes: source?.resource?.offsetBytes ?? 0,
    nextOffsetBytes: source?.resource?.nextOffsetBytes ?? 0,
    complete: source?.resource?.complete === true,
    expiresAt: source?.resource?.expiresAt,
    readAction: source?.resource?.readAction ?? "attachment_content",
  });
  return {
    id,
    kind: source?.kind ?? source?.mimeType?.split("/")[0] ?? "file",
    mimeType: source?.mimeType ?? null,
    name: source?.name ?? null,
    size: Number.isFinite(Number(source?.size)) ? size : null,
    sessionId: sessionId ?? null,
    resource,
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
    frameId: `tool:${turnId}:${toolCallId}`,
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
    ...(entry?.messageId || entry?.id ? { messageId: safeId(entry.messageId ?? entry.id, null) } : {}),
    ...(entry?.operationId ? { operationId: safeId(entry.operationId, null) } : {}),
    ...(entry?.phase || entry?.receipt?.phase ? { phase: entry.phase ?? entry.receipt.phase } : {}),
    startedAt: entry?.createdAt ?? entry?.timestamp ?? null,
    endedAt: null,
    steps: [],
    explicitState: entry?.taskState ?? entry?.state ?? entry?.receipt?.taskState ?? null,
    executionState: entry?.executionState ?? entry?.receipt?.executionState ?? null,
    goalState: entry?.goalState ?? entry?.receipt?.goalState ?? null,
    taskContract: entry?.taskContract && typeof entry.taskContract === "object" ? { ...entry.taskContract } : null,
    evidenceRefs: Array.isArray(entry?.evidenceRefs) ? entry.evidenceRefs.slice(-64) : [],
    warnings: Array.isArray(entry?.warnings) ? entry.warnings.slice(-16) : [],
    hasAssistant: false,
    hasUnresolvedTool: false,
    hasExecutionFacts: Boolean(entry?.operationId || entry?.taskState || entry?.receipt || entry?.artifactFiles),
  };
}

function rekeyTurn(turn, nextId, toolFrames) {
  const normalized = safeId(nextId, turn?.turnId ?? "session");
  if (!turn || !normalized || normalized === turn.turnId) return;
  const previousId = turn.turnId;
  turn.turnId = normalized;
  for (const step of turn.steps) {
    step.stepId = `${normalized}.s${step.ordinal}`;
    for (const frame of step.frames) {
      if (frame.kind === "tool") {
        const previousKey = scopedToolFrameKey(previousId, frame.toolCallId);
        const nextKey = scopedToolFrameKey(normalized, frame.toolCallId);
        if (toolFrames.get(previousKey) === frame) {
          toolFrames.delete(previousKey);
          toolFrames.set(nextKey, frame);
        }
        frame.frameId = `tool:${normalized}:${frame.toolCallId}`;
      } else {
        frame.frameId = `${step.stepId}.${frame.kind}`;
      }
    }
  }
}

function closeTurn(turn, state = "unknown", endedAt = null) {
  if (!turn) return;
  turn.state = state;
  turn.endedAt = endedAt;
}

function inferTurnState(turn) {
  const explicit = String(turn?.explicitState ?? "").trim().toLowerCase();
  if (["completed", "completed_with_warnings", "succeeded", "failed", "cancelled", "unknown", "incomplete", "needs_intervention"].includes(explicit)) {
    if (explicit === "succeeded") return "completed";
    return explicit;
  }
  if (!turn?.hasAssistant || turn?.hasUnresolvedTool) return "unknown";
  // Legacy assistant-only conversations may still use the historical display
  // inference. Once a turn carries execution facts, however, text alone is
  // not evidence that the operation or its artifacts completed.
  if (turn?.hasExecutionFacts) return "unknown";
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
  const tasks = new Map();
  const goalEntities = new Map();
  const todoEntities = new Map();
  const promptEntities = new Map();
  const taskNotifications = new Map();
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
    const persistedTurnId = entry?.turnId ?? (entry?.operationId ? `turn:${entry.operationId}` : null);
    turn = newTurn(safeId(persistedTurnId, `t${turnOrdinal}`), prompt, entry, turnOrdinal);
    items.push(turn);
  };
  const ensureTurn = (entry = null) => {
    if (!turn) {
      turnOrdinal += 1;
      const persistedTurnId = entry?.turnId ?? (entry?.operationId ? `turn:${entry.operationId}` : null);
      turn = newTurn(safeId(persistedTurnId, `t${turnOrdinal}`), "", entry, turnOrdinal);
      items.push(turn);
    }
    return turn;
  };
  const addStep = (entry = null) => {
    const current = ensureTurn();
    stepOrdinal += 1;
    const stepId = safeId(entry?.stepId, `${current.turnId}.s${stepOrdinal}`);
    const retry = entry?.retry && typeof entry.retry === "object"
      ? entry.retry
      : Array.isArray(entry?.receipt?.modelRetries) ? entry.receipt.modelRetries.at(-1) : null;
    const step = {
      kind: "step",
      stepId,
      ordinal: stepOrdinal,
      state: "running",
      ...(Number.isSafeInteger(Number(entry?.attempt)) && Number(entry.attempt) > 0 ? { attempt: Number(entry.attempt) } : {}),
      ...(retry ? { retry: {
        attempt: Math.max(1, Number(retry.attempt) || 1),
        maxAttempts: Math.max(1, Number(retry.maxAttempts) || 1),
        reason: String(retry.reason ?? "retry").slice(0, 320),
        statusCode: Number.isInteger(Number(retry.statusCode)) ? Number(retry.statusCode) : null,
      } } : {}),
      ...(entry?.usage && typeof entry.usage === "object" ? { usage: { ...entry.usage } } : {}),
      ...(entry?.finishReason ? { finishReason: String(entry.finishReason).slice(0, 120) } : {}),
      frames: [],
    };
    current.steps.push(step);
    return step;
  };

  const applyPersistedFacts = (entry, current) => {
    if (!current || !entry || typeof entry !== "object") return;
    if (entry.messageId || entry.id) current.messageId = safeId(entry.messageId ?? entry.id, current.messageId ?? null);
    if (entry.operationId) {
      current.operationId = safeId(entry.operationId, current.operationId ?? null);
      current.hasExecutionFacts = true;
    }
    if (entry.executionState || entry.receipt?.executionState) current.executionState = entry.executionState ?? entry.receipt.executionState;
    if (entry.goalState || entry.receipt?.goalState) current.goalState = entry.goalState ?? entry.receipt.goalState;
    if (entry.taskContract && typeof entry.taskContract === "object") current.taskContract = { ...entry.taskContract };
    if (Array.isArray(entry.evidenceRefs)) current.evidenceRefs = entry.evidenceRefs.slice(-64);
    if (Array.isArray(entry.warnings)) current.warnings = entry.warnings.slice(-16);
    if (entry.phase || entry.receipt?.phase) current.phase = entry.phase ?? entry.receipt.phase;
    const explicitState = entry.taskState
      ?? entry.state
      ?? entry.receipt?.taskState
      ?? entry.receipt?.completion?.taskState
      ?? (entry.receipt?.completion?.ok === true ? "completed" : entry.receipt?.completion?.ok === false ? "unknown" : null);
    if (explicitState) current.explicitState = explicitState;
    if (entry.receipt && typeof entry.receipt === "object") {
      current.hasExecutionFacts = true;
      const receiptId = safeId(
        entry.receipt.turnId ?? entry.receipt.requestId ?? entry.operationId,
        `receipt-${messageOrdinal + 1}`,
      );
      receipts.set(receiptId, { id: receiptId, ...entry.receipt });
      if (entry.receipt.executionState) current.executionState = entry.receipt.executionState;
      if (entry.receipt.goalState) current.goalState = entry.receipt.goalState;
      if (entry.receipt.taskContract && typeof entry.receipt.taskContract === "object") current.taskContract = {
        ...(current.taskContract ?? {}),
        ...entry.receipt.taskContract,
        ...(Array.isArray(current.taskContract?.expectedOutputs) && !Array.isArray(entry.receipt.taskContract.expectedOutputs)
          ? { expectedOutputs: current.taskContract.expectedOutputs }
          : {}),
      };
      if (Array.isArray(entry.receipt.evidenceRefs)) current.evidenceRefs = entry.receipt.evidenceRefs.slice(-64);
      if (Array.isArray(entry.receipt.warnings)) current.warnings = entry.receipt.warnings.slice(-16);
      for (const evidence of Array.isArray(entry.receipt.artifactEvidence) ? entry.receipt.artifactEvidence : []) {
        for (const file of Array.isArray(evidence?.files) ? evidence.files : []) {
          const artifact = artifactEntity({ ...file, verified: evidence.verified, role: "artifact" }, artifacts.size, sessionId);
          artifacts.set(artifact.id, artifact);
        }
      }
    }
    if (entry.receipt?.intervention?.interactionId) {
      const interactionId = safeId(entry.receipt.intervention.interactionId, `interaction-${messageOrdinal}`);
      interactions.set(interactionId, {
        id: interactionId,
        state: entry.receipt.intervention.active ? "pending" : "resolved",
        turnId: current.turnId,
      });
    }
    for (const rawArtifact of Array.isArray(entry.artifactFiles) ? entry.artifactFiles : []) {
      current.hasExecutionFacts = true;
      const artifact = artifactEntity(rawArtifact, artifacts.size, sessionId);
      artifacts.set(artifact.id, artifact);
    }
  };

  for (const raw of Array.isArray(entries) ? entries : []) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw;
    if (entry.role === "user") {
      if (entry.backgroundTaskNotification && typeof entry.backgroundTaskNotification === "object") {
        const fact = entry.backgroundTaskNotification;
        const id = safeId(fact.notificationId ?? entry.notificationId, `task-notification-${messageOrdinal + 1}`);
        taskNotifications.set(id, {
          id,
          notificationId: id,
          taskId: safeId(fact.taskId, null),
          jobId: Number.isSafeInteger(Number(fact.jobId)) ? Number(fact.jobId) : null,
          status: String(fact.status ?? "unknown"),
          sessionId: sessionId ?? null,
          operationId: safeId(fact.sourceOperationId ?? entry.operationId, null),
          createdAt: fact.createdAt ?? entry.createdAt ?? null,
        });
        const taskId = safeId(fact.taskId, id);
        tasks.set(taskId, {
          id: taskId,
          taskId,
          state: String(fact.status ?? "unknown"),
          status: String(fact.status ?? "unknown"),
          jobId: Number.isSafeInteger(Number(fact.jobId)) ? Number(fact.jobId) : null,
          sessionId: sessionId ?? null,
          operationId: safeId(fact.sourceOperationId ?? entry.operationId, null),
          createdAt: fact.createdAt ?? entry.createdAt ?? null,
        });
        continue;
      }
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
      ensureTurn(entry);
      if (entry.turnId) rekeyTurn(turn, entry.turnId, toolFrames);
      applyPersistedFacts(entry, turn);
      turn.hasAssistant = true;
      const step = addStep(entry);
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
        turn.hasExecutionFacts = true;
        const frame = toolFrameFrom({ ...call, toolCallId: call.id, toolName: call.function?.name, content: "" }, `call-${messageOrdinal}`, messageOrdinal, turn.turnId);
        step.frames.push(frame);
        toolFrames.set(scopedToolFrameKey(turn.turnId, frame.toolCallId), frame);
        messageOrdinal += 1;
      }
      continue;
    }
    if (entry.role === "execution") {
      const current = ensureTurn(entry);
      current.hasExecutionFacts = true;
      if (entry.turnId) rekeyTurn(current, entry.turnId, toolFrames);
      applyPersistedFacts(entry, current);
      continue;
    }
    if (entry.role === "tool") {
      const current = ensureTurn();
      current.hasExecutionFacts = true;
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
    tasks: [...tasks.values()],
    attachments: [...attachments.values()],
    interactions: [...interactions.values()],
    artifacts: [...artifacts.values()],
    receipts: [...receipts.values()],
    goals: [...goalEntities.values()],
    todos: [...todoEntities.values()],
    prompts: [...promptEntities.values()],
    taskNotifications: [...taskNotifications.values()],
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
  if (beforeRequested && afterRequested) {
    return {
      ...snapshot,
      items: [],
      hasMoreOlder: false,
      hasMoreNewer: false,
      cursor: null,
      resyncRequired: true,
      cursorError: "beforeTurn and afterTurn are mutually exclusive",
    };
  }
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
    cursor: last === undefined ? null : String(selected.at(-1)?.turnId ?? `t${last}`),
  };
}
