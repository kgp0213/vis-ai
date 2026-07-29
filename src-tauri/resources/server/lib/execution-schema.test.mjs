import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  EXECUTION_SCHEMA_VERSION,
  validateDashboardEvent,
  validateExecutionEvent,
  validateRuntimeFact,
  validateSessionRecord,
  validateSessionSnapshot,
  validateTranscriptOperation,
} from "./execution-schema.mjs";

const contractVectors = JSON.parse(readFileSync(new URL("../__fixtures__/execution-schema-vectors.json", import.meta.url), "utf8"));

test("accepts legacy session records with a compatibility warning", () => {
  const result = validateSessionRecord({ role: "assistant", content: "旧会话" });
  assert.equal(result.ok, true);
  assert.equal(result.value.schemaVersion, EXECUTION_SCHEMA_VERSION);
  assert.ok(result.warnings.includes("missing_schema_version"));
});

test("validates canonical session snapshots without closing generic status values", () => {
  const valid = validateSessionSnapshot({
    schemaVersion: 1,
    sessionId: "session-1",
    eventCursor: "epoch-a:1",
    messages: [{ id: "message-1", role: "assistant", content: "done", executionState: "completed" }],
    tools: [{ id: "tool-1", status: "waiting_auth", state: "running" }],
  });
  assert.equal(valid.ok, true);
  const invalid = validateSessionSnapshot({
    schemaVersion: 1,
    sessionId: "session-1",
    messages: [{ id: "message-1", role: "assistant", content: "done", executionState: "not-a-state" }],
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes("messages.executionState_invalid"));
});

test("accepts intervention and approval task outcomes across canonical boundaries", () => {
  for (const taskState of ["needs_intervention", "awaiting_approval"]) {
    const result = validateSessionSnapshot({
      schemaVersion: 1,
      sessionId: "session-1",
      eventCursor: "epoch-a:1",
      messages: [{ id: `message-${taskState}`, role: "assistant", content: "paused", taskState }],
    });
    assert.equal(result.ok, true, taskState);
  }
});

test("canonical snapshots require stable entity ids and closed goal states", () => {
  const missingId = validateSessionSnapshot({
    schemaVersion: 1,
    sessionId: "session-1",
    messages: [{ role: "assistant", content: "done" }],
  });
  assert.equal(missingId.ok, false);
  assert.ok(missingId.errors.includes("messages_id_required"));
  const invalidGoal = validateSessionSnapshot({
    schemaVersion: 1,
    sessionId: "session-1",
    messages: [{ id: "message-1", role: "assistant", content: "done", goalState: "maybe" }],
  });
  assert.equal(invalidGoal.ok, false);
  assert.ok(invalidGoal.errors.includes("messages.goalState_invalid"));
  const legacy = validateSessionSnapshot({ messages: [{ role: "assistant", content: "old" }] });
  assert.equal(legacy.ok, true);
});

test("rejects session records with unsupported roles or non-text content", () => {
  assert.equal(validateSessionRecord({ role: "developer", content: "x" }).ok, false);
  assert.equal(validateSessionRecord({ role: "user", content: 42 }).ok, false);
});

test("requires a complete cursor identity for replayable execution events", () => {
  const missingCursor = validateExecutionEvent({ kind: "tool.succeeded", eventSeq: 4 });
  assert.equal(missingCursor.ok, false);
  assert.ok(missingCursor.errors.includes("event_epoch_required"));
  assert.ok(missingCursor.errors.includes("event_id_required"));

  const valid = validateExecutionEvent({
    schemaVersion: 1,
    kind: "tool.succeeded",
    eventEpoch: "epoch-a",
    eventSeq: 4,
    eventId: "epoch-a:4",
    entityId: "call-1",
    payload: { state: "succeeded" },
  });
  assert.equal(valid.ok, true);
});

test("rejects runtime facts from another session and non-monotonic sequence values", () => {
  const result = validateRuntimeFact({
    schemaVersion: 1,
    factId: "fact-1",
    sequence: 0,
    sessionId: "session-a",
    type: "tool.upsert",
    payload: {},
  }, { sessionId: "session-b" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("sequence_invalid"));
  assert.ok(result.errors.includes("session_mismatch"));
});

test("requires dashboard replay events to expose the same cursor fields", () => {
  const result = validateDashboardEvent({ kind: "assistant_final", eventSeq: 2 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("event_epoch_required"));
  assert.ok(result.errors.includes("event_id_required"));
});

test("rejects unknown execution state fields at JSONL and SSE boundaries", () => {
  assert.equal(validateExecutionEvent({
    kind: "tool.succeeded",
    eventEpoch: "epoch-a",
    eventSeq: 1,
    eventId: "epoch-a:1",
    entityId: "call-1",
    state: "finished-but-not-a-contract",
  }).ok, false);
  assert.equal(validateDashboardEvent({
    kind: "turn_finalized",
    eventEpoch: "epoch-a",
    eventSeq: 2,
    eventId: "epoch-a:2",
    id: "message-1",
    executionState: "finished-but-not-a-contract",
  }).ok, false);
});

test("accepts idempotent transcript operations and rejects append gaps", () => {
  assert.equal(validateTranscriptOperation({ op: "turn.upsert", turn: { turnId: "turn-1", ordinal: 1, state: "running" } }).ok, true);
  const gap = validateTranscriptOperation({
    op: "append",
    target: { type: "frame", turnId: "turn-1", stepId: "turn-1.s1", frameId: "frame-1" },
    offset: -1,
    text: "x",
  });
  assert.equal(gap.ok, false);
  assert.ok(gap.errors.includes("append_offset_invalid"));
});

test("closes every transcript operation shape at the process boundary", () => {
  assert.equal(validateTranscriptOperation({
    op: "marker.upsert",
    beforeTurn: 2,
    item: { kind: "marker", markerId: "marker-1" },
  }).ok, true);
  assert.ok(validateTranscriptOperation({
    op: "marker.upsert",
    item: { kind: "marker" },
  }).errors.includes("marker_id_required"));
  assert.ok(validateTranscriptOperation({
    op: "taskref.upsert",
    item: { kind: "taskref" },
  }).errors.includes("taskref_id_required"));
  assert.ok(validateTranscriptOperation({
    op: "marker.upsert",
    beforeTurn: -1,
    item: { kind: "marker", markerId: "marker-1" },
  }).errors.includes("before_turn_invalid"));
  assert.ok(validateTranscriptOperation({ op: "reset", snapshot: [] }).errors.includes("snapshot_required"));
  assert.ok(validateTranscriptOperation({ op: "meta.merge", meta: [] }).errors.includes("meta_required"));
  assert.ok(validateTranscriptOperation({ op: "items.remove", ids: "turn-1" }).errors.includes("item_ids_required"));
  assert.ok(validateTranscriptOperation({
    op: "entity.upsert",
    entityType: "artifacts",
    entity: { status: "verified" },
  }).errors.includes("entity_id_required"));
});

test("server Dashboard schema matches the shared transport vectors", () => {
  for (const vector of contractVectors.dashboardEvents) {
    assert.equal(validateDashboardEvent(vector.event).ok, vector.ok, vector.name);
  }
});

test("all server execution boundaries match the shared schema vectors", () => {
  for (const vector of contractVectors.sessionRecords) {
    assert.equal(validateSessionRecord(vector.record).ok, vector.ok, vector.name);
  }
  for (const vector of contractVectors.executionEvents) {
    assert.equal(validateExecutionEvent(vector.event).ok, vector.ok, vector.name);
  }
  for (const vector of contractVectors.runtimeFacts) {
    assert.equal(validateRuntimeFact(vector.fact, { sessionId: vector.sessionId }).ok, vector.ok, vector.name);
  }
  for (const vector of contractVectors.transcriptOperations) {
    assert.equal(validateTranscriptOperation(vector.operation).ok, vector.ok, vector.name);
  }
});
