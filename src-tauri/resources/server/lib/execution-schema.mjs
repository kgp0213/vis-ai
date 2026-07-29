/**
 * Closed, dependency-free boundary contracts for the execution facts that
 * cross JSONL, Runtime Fact, SSE and Dashboard layers. Validation is
 * intentionally additive: records without schemaVersion remain readable and
 * receive a compatibility warning, while malformed new fields fail closed.
 */

export const EXECUTION_SCHEMA_VERSION = 1;
export const EXECUTION_RECORD_ROLES = Object.freeze([
  "system", "user", "assistant", "tool", "warning", "error", "info", "execution",
]);
export const EXECUTION_STATES = Object.freeze([
  "queued", "starting", "running", "stopping", "completed", "completed_with_warnings",
  "succeeded", "failed", "cancelled", "canceled", "unknown", "incomplete", "lost",
  "timed_out", "killed", "verified", "unverified", "interrupted", "pending", "resolved",
  "active", "recovered", "applied", "not_applied", "expired", "answered", "dismissed",
  "accepted", "rejected", "blocked", "done", "missing", "invalid", "present_unverified",
  "needs_intervention", "awaiting_approval", "truncated", "full", "error",
]);
export const EXECUTION_OUTCOME_STATES = Object.freeze([
  "running", "stopping", "completed", "completed_with_warnings", "succeeded", "failed",
  "cancelled", "canceled", "unknown", "incomplete", "lost", "timed_out", "killed",
  "needs_intervention", "awaiting_approval", "active", "queued", "starting",
]);
export const GOAL_STATES = Object.freeze(["verified", "unverified", "incomplete", "unknown"]);
export const TRANSCRIPT_OPERATIONS = Object.freeze([
  "reset", "turn.upsert", "step.upsert", "frame.upsert", "append", "marker.upsert",
  "taskref.upsert", "task.upsert", "interaction.upsert", "attachment.upsert", "todo.upsert",
  "prompt.upsert", "meta.merge", "items.remove", "entity.upsert",
]);

const ID_RE = /^[A-Za-z0-9._:-]{1,240}$/u;
const REPLAYABLE_EVENT_KINDS = new Set([
  "user", "assistant_content_final", "assistant_final", "turn_finalized", "tool_start",
  "tool_progress", "tool_result", "tool_finished", "tool.succeeded", "tool.failed",
  "tool.cancelled", "tool.unknown", "modal", "interaction.upsert", "attachment.upsert",
  "artifact.upsert", "config-changed", "session-changed", "operation", "plan", "todo-update",
  "background-task-notification", "resync-required",
]);
const TRANSCRIPT_ENTITY_FIELDS = Object.freeze({
  "task.upsert": ["task", "taskId"],
  "interaction.upsert": ["interaction", "interactionId"],
  "attachment.upsert": ["attachment", "attachmentId"],
  "todo.upsert": ["todo", "todoId"],
  "prompt.upsert": ["prompt", "promptId"],
});
const TRANSCRIPT_ENTITY_TYPES = new Set([
  "tasks", "attachments", "interactions", "artifacts", "receipts", "goals", "todos", "prompts", "taskNotifications",
]);

function text(value) {
  return String(value ?? "").trim();
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function result(value, errors = [], warnings = []) {
  return {
    ok: errors.length === 0,
    value,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}

function versionOf(source, errors, warnings) {
  if (source.schemaVersion === undefined || source.schemaVersion === null) {
    warnings.push("missing_schema_version");
    return EXECUTION_SCHEMA_VERSION;
  }
  const version = Number(source.schemaVersion);
  if (!Number.isSafeInteger(version) || version < 1) {
    errors.push("schema_version_invalid");
    return EXECUTION_SCHEMA_VERSION;
  }
  if (version > EXECUTION_SCHEMA_VERSION) errors.push("schema_version_unsupported");
  return version;
}

function validateId(value, field, errors, { required = false } = {}) {
  const normalized = text(value);
  if (!normalized) {
    if (required) errors.push(`${field}_required`);
    return null;
  }
  if (!ID_RE.test(normalized)) errors.push(`${field}_invalid`);
  return normalized || null;
}

function validateStateFields(source, errors) {
  for (const field of ["state", "taskState", "executionState", "goalState"]) {
    if (source[field] === undefined || source[field] === null || source[field] === "") continue;
    const value = text(source[field]).toLowerCase();
    if (!EXECUTION_STATES.includes(value)) errors.push(`${field}_invalid`);
  }
}

function validateNestedExecutionState(source, errors) {
  if (isObject(source)) validateExecutionEventStateFields(source, errors);
}

function validateExecutionEventStateFields(source, errors) {
  for (const field of ["state", "taskState", "executionState", "goalState"]) {
    if (source[field] === undefined || source[field] === null || source[field] === "") continue;
    const value = text(source[field]).toLowerCase();
    if (!EXECUTION_STATES.includes(value)) errors.push(`${field}_invalid`);
  }
}

function validateCursor(source, errors, { requireSequence = false } = {}) {
  const hasSequence = source.eventSeq !== undefined && source.eventSeq !== null;
  if (requireSequence && !hasSequence) errors.push("event_seq_required");
  if (hasSequence) {
    const sequence = Number(source.eventSeq);
    if (!Number.isSafeInteger(sequence) || sequence < 0) errors.push("event_seq_invalid");
    if (!text(source.eventEpoch)) errors.push("event_epoch_required");
    if (!text(source.eventId)) errors.push("event_id_required");
  }
  if (source.eventId !== undefined && source.eventId !== null && !text(source.eventId)) {
    errors.push("event_id_invalid");
  }
}

export function validateSessionRecord(input, { compatibility = true } = {}) {
  const errors = [];
  const warnings = [];
  if (!isObject(input)) return result(null, ["record_object_required"], warnings);
  const role = text(input.role);
  const value = { ...input, schemaVersion: versionOf(input, errors, warnings) };
  if (!EXECUTION_RECORD_ROLES.includes(role)) errors.push("role_invalid");
  if (typeof input.content !== "string" && !Array.isArray(input.content)) errors.push("content_invalid");
  for (const field of ["id", "messageId", "turnId", "operationId", "admittedInputId"]) {
    if (input[field] !== undefined && input[field] !== null) validateId(input[field], field, errors);
  }
  validateStateFields(input, errors);
  if (role === "tool" && !text(input.tool_call_id ?? input.toolCallId)) warnings.push("tool_call_id_missing");
  if (role === "execution" && !text(input.operationId ?? input.turnId)) warnings.push("execution_scope_missing");
  if (!compatibility && warnings.includes("missing_schema_version")) errors.push("schema_version_required");
  return result(value, errors, warnings);
}

export function validateExecutionEvent(input, { compatibility = true } = {}) {
  const errors = [];
  const warnings = [];
  if (!isObject(input)) return result(null, ["event_object_required"], warnings);
  const value = { ...input, schemaVersion: versionOf(input, errors, warnings) };
  const kind = text(input.kind);
  if (!kind) errors.push("event_kind_required");
  validateId(input.eventEpoch, "event_epoch", errors);
  validateId(input.eventId, "event_id", errors);
  validateId(input.entityId ?? input.id ?? input.toolCallId ?? input.interactionId, "entity_id", errors);
  validateId(input.operationId, "operation_id", errors);
  validateId(input.sessionId, "session_id", errors);
  validateId(input.turnId, "turn_id", errors);
  validateId(input.stepId, "step_id", errors);
  validateCursor(input, errors);
  validateExecutionEventStateFields(input, errors);
  if (input.payload !== undefined && !isObject(input.payload)) errors.push("event_payload_invalid");
  else validateNestedExecutionState(input.payload, errors);
  if (!input.eventSeq && !REPLAYABLE_EVENT_KINDS.has(kind) && !compatibility) warnings.push("transient_event");
  return result(value, errors, warnings);
}

export function validateRuntimeFact(input, { sessionId = null, compatibility = true } = {}) {
  const errors = [];
  const warnings = [];
  if (!isObject(input)) return result(null, ["fact_object_required"], warnings);
  const value = { ...input, schemaVersion: versionOf(input, errors, warnings) };
  validateId(input.factId, "fact_id", errors, { required: true });
  const sequence = Number(input.sequence);
  if (!Number.isSafeInteger(sequence) || sequence < 1) errors.push("sequence_invalid");
  const factSession = validateId(input.sessionId, "session_id", errors, { required: true });
  if (sessionId !== null && factSession !== text(sessionId)) errors.push("session_mismatch");
  if (!text(input.type)) errors.push("fact_type_required");
  if (input.payload !== undefined && !isObject(input.payload)) errors.push("fact_payload_invalid");
  else validateNestedExecutionState(input.payload, errors);
  for (const field of ["operationId", "turnId", "stepId", "entityId"]) {
    if (input[field] !== undefined && input[field] !== null) validateId(input[field], field, errors);
  }
  if (!compatibility && warnings.includes("missing_schema_version")) errors.push("schema_version_required");
  return result(value, errors, warnings);
}

export function validateDashboardEvent(input, { compatibility = true } = {}) {
  const errors = [];
  const warnings = [];
  if (!isObject(input)) return result(null, ["dashboard_event_object_required"], warnings);
  const value = { ...input, schemaVersion: versionOf(input, errors, warnings) };
  if (!text(input.kind)) errors.push("event_kind_required");
  validateId(input.operationId, "operation_id", errors);
  validateId(input.sessionId, "session_id", errors);
  validateId(input.entityId ?? input.id ?? input.toolCallId ?? input.interactionId, "entity_id", errors);
  validateCursor(input, errors);
  validateExecutionEventStateFields(input, errors);
  if (input.payload !== undefined && !isObject(input.payload)) errors.push("event_payload_invalid");
  else validateNestedExecutionState(input.payload, errors);
  if (!compatibility && input.eventSeq === undefined && REPLAYABLE_EVENT_KINDS.has(text(input.kind))) {
    warnings.push("unsequenced_replayable_event");
  }
  return result(value, errors, warnings);
}

export function validateTranscriptOperation(input) {
  const errors = [];
  const warnings = [];
  if (!isObject(input)) return result(null, ["operation_object_required"], warnings);
  const op = text(input.op);
  if (!TRANSCRIPT_OPERATIONS.includes(op)) errors.push("operation_unknown");
  if (op === "reset" && !isObject(input.snapshot)) errors.push("snapshot_required");
  if (op === "append") {
    if (!isObject(input.target)) errors.push("append_target_required");
    else if (input.target.type === "frame") {
      validateId(input.target.turnId, "turn_id", errors, { required: true });
      validateId(input.target.stepId, "step_id", errors, { required: true });
      validateId(input.target.frameId, "frame_id", errors, { required: true });
    } else if (input.target.type === "task") {
      validateId(input.target.taskId, "task_id", errors, { required: true });
    } else errors.push("append_target_type_invalid");
    const offset = Number(input.offset);
    if (!Number.isSafeInteger(offset) || offset < 0) errors.push("append_offset_invalid");
    if (typeof input.text !== "string") errors.push("append_text_invalid");
  }
  if (op === "turn.upsert") {
    if (!isObject(input.turn)) errors.push("turn_required");
    validateId(input.turn?.turnId, "turn_id", errors, { required: true });
    validateNestedExecutionState(input.turn, errors);
  }
  if (op === "step.upsert") {
    if (!isObject(input.step)) errors.push("step_required");
    validateId(input.turnId, "turn_id", errors, { required: true });
    validateId(input.step?.stepId, "step_id", errors, { required: true });
    validateNestedExecutionState(input.step, errors);
  }
  if (op === "frame.upsert") {
    if (!isObject(input.frame)) errors.push("frame_required");
    validateId(input.turnId, "turn_id", errors, { required: true });
    validateId(input.stepId, "step_id", errors, { required: true });
    validateId(input.frame?.frameId, "frame_id", errors, { required: true });
    validateNestedExecutionState(input.frame, errors);
  }
  if (op === "marker.upsert" || op === "taskref.upsert") {
    const expectedKind = op === "marker.upsert" ? "marker" : "taskref";
    const idField = op === "marker.upsert" ? "markerId" : "refId";
    if (!isObject(input.item)) errors.push("item_required");
    else {
      if (text(input.item.kind) !== expectedKind) errors.push(`${expectedKind}_kind_invalid`);
      validateId(input.item[idField], `${expectedKind}_id`, errors, { required: true });
    }
    if (input.beforeTurn !== undefined) {
      const beforeTurn = Number(input.beforeTurn);
      if (!Number.isSafeInteger(beforeTurn) || beforeTurn < 0) errors.push("before_turn_invalid");
    }
  }
  if (TRANSCRIPT_ENTITY_FIELDS[op]) {
    const [field, idField] = TRANSCRIPT_ENTITY_FIELDS[op];
    const entity = input[field];
    if (!isObject(entity)) errors.push(`${field}_required`);
    validateId(entity?.[idField] ?? entity?.id, `${field}_id`, errors, { required: true });
    validateNestedExecutionState(entity, errors);
  }
  if (op === "entity.upsert") {
    const entityType = text(input.entityType ?? input.type);
    if (!TRANSCRIPT_ENTITY_TYPES.has(entityType)) errors.push("entity_type_invalid");
    const entity = input.entity ?? input.payload;
    if (!isObject(entity)) errors.push("entity_required");
    else {
      const singularIdField = `${entityType.slice(0, -1)}Id`;
      validateId(entity.id ?? entity[singularIdField], "entity_id", errors, { required: true });
      validateNestedExecutionState(entity, errors);
    }
  }
  if (op === "meta.merge" && !isObject(input.meta)) errors.push("meta_required");
  if (op === "items.remove") {
    if (!Array.isArray(input.ids)) errors.push("item_ids_required");
    else for (const id of input.ids) validateId(id, "item_id", errors, { required: true });
  }
  return result({ ...input, schemaVersion: EXECUTION_SCHEMA_VERSION }, errors, warnings);
}

const SNAPSHOT_ID_FIELDS = Object.freeze({
  messages: ["id", "messageId"],
  turns: ["id", "turnId"],
  steps: ["id", "stepId"],
  tools: ["id", "toolCallId"],
  tasks: ["id", "taskId"],
  interactions: ["id", "interactionId"],
  attachments: ["id", "attachmentId"],
  artifacts: ["id", "artifactId"],
  receipts: ["id", "receiptId", "turnId"],
  goals: ["id", "goalId"],
  todos: ["id", "todoId"],
  prompts: ["id", "promptId"],
  taskNotifications: ["id", "notificationId"],
});

function validateSnapshotEntityState(entity, field, errors) {
  validateStateFields(entity, errors);
  if (entity.goalState !== undefined && entity.goalState !== null && entity.goalState !== ""
    && !GOAL_STATES.includes(text(entity.goalState).toLowerCase())) errors.push(`${field}.goalState_invalid`);
  for (const stateField of ["taskState", "executionState"]) {
    if (entity[stateField] !== undefined && entity[stateField] !== null && entity[stateField] !== ""
      && !EXECUTION_OUTCOME_STATES.includes(text(entity[stateField]).toLowerCase())) errors.push(`${field}.${stateField}_invalid`);
  }
}

function validateSnapshotCollection(value, field, errors, { requireId = false } = {}) {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) {
    errors.push(`${field}_collection_invalid`);
    return;
  }
  for (const [index, entity] of value.entries()) {
    if (!isObject(entity)) {
      errors.push(`${field}[${index}]_object_required`);
      continue;
    }
    const idFields = SNAPSHOT_ID_FIELDS[field] ?? ["id"];
    const id = idFields.map((name) => entity[name]).find((candidate) => candidate !== undefined && candidate !== null && text(candidate));
    if (requireId && !id) errors.push(`${field}_id_required`);
    if (id !== undefined && id !== null) validateId(id, `${field}_id`, errors);
    validateSnapshotEntityState(entity, field, errors);
    for (const fieldName of ["state", "taskState", "executionState", "goalState"]) {
      if (entity[fieldName] !== undefined && entity[fieldName] !== null && entity[fieldName] !== "" && !EXECUTION_STATES.includes(text(entity[fieldName]).toLowerCase())) {
        errors.push(`${field}.${fieldName}_invalid`);
      }
    }
  }
}

/** Canonical Dashboard/Session snapshot contract shared by REST and Dashboard. */
export function validateSessionSnapshot(input, { compatibility = true } = {}) {
  const errors = [];
  const warnings = [];
  if (!isObject(input)) return result(null, ["snapshot_object_required"], warnings);
  const value = { ...input, schemaVersion: versionOf(input, errors, warnings) };
  const canonical = input.schemaVersion !== undefined && input.schemaVersion !== null;
  if (input.sessionId !== undefined && input.sessionId !== null) validateId(input.sessionId, "session_id", errors);
  if (input.eventCursor !== undefined && input.eventCursor !== null) {
    if (typeof input.eventCursor === "string") {
      const match = /^([^:]+):(\d+)$/u.exec(input.eventCursor.trim());
      if (!match) errors.push("event_cursor_invalid");
    } else if (isObject(input.eventCursor)) {
      validateId(input.eventCursor.epoch, "event_epoch", errors, { required: true });
      const sequence = Number(input.eventCursor.seq ?? input.eventCursor.lastSeq);
      if (!Number.isSafeInteger(sequence) || sequence < 0) errors.push("event_cursor_sequence_invalid");
    } else errors.push("event_cursor_invalid");
  }
  for (const field of [
    "messages", "turns", "steps", "tools", "tasks", "interactions", "attachments", "artifacts", "receipts",
    "goals", "todos", "prompts", "taskNotifications",
  ]) validateSnapshotCollection(input[field], field, errors, { requireId: canonical });
  for (const field of ["operation", "admission", "plan"]) {
    if (input[field] !== undefined && input[field] !== null) {
      if (!isObject(input[field])) errors.push(`${field}_object_required`);
      else validateStateFields(input[field], errors);
    }
  }
  if (!compatibility && warnings.includes("missing_schema_version")) errors.push("schema_version_required");
  return result(value, errors, warnings);
}

export function assertExecutionSchema(resultValue, label = "execution record") {
  if (!resultValue?.ok) {
    throw new TypeError(`${label} violates execution schema: ${(resultValue?.errors ?? []).join(", ") || "invalid"}`);
  }
  return resultValue.value;
}
