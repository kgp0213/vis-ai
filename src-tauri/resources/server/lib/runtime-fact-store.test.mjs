import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { createRuntimeFactStore } from "./runtime-fact-store.mjs";
import { toolFrameEntityId } from "./tool-progress.mjs";

test("runtime fact store persists typed facts and restores a complete session snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "session-a.facts.jsonl");
  try {
    const store = createRuntimeFactStore({
      file,
      sessionId: "session-a",
      epoch: "epoch-a",
      now: () => "2026-07-28T00:00:00.000Z",
      idFactory: (() => { let id = 0; return () => `fact-${++id}`; })(),
    });
    await store.load();
    await store.append({ type: "message.upsert", entityId: "m1", payload: { id: "m1", role: "user", text: "hello" } });
    await store.append({ type: "tool.upsert", operationId: "op-1", turnId: "turn-1", stepId: "step-1", entityId: "call-1", payload: { id: "call-1", name: "read_file", state: "running" } });
    await store.append({ type: "tool.upsert", operationId: "op-1", turnId: "turn-1", stepId: "step-1", entityId: "call-1", payload: { id: "call-1", name: "read_file", state: "succeeded", isError: false } });
    await store.append({ type: "operation.replace", operationId: "op-1", entityId: "op-1", payload: { id: "op-1", state: "completed" } });

    const restored = createRuntimeFactStore({ file, sessionId: "session-a", epoch: "epoch-a" });
    await restored.load();
    const snapshot = restored.snapshot();
    assert.equal(snapshot.schemaVersion, 1);
    assert.equal(snapshot.sessionId, "session-a");
    assert.equal(snapshot.eventCursor, "epoch-a:4");
    assert.equal(snapshot.messages[0].text, "hello");
    assert.equal(snapshot.tools[0].state, "succeeded");
    assert.equal(snapshot.operation.state, "completed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store persists and cold-restores a scoped tool frame id", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-tool-id-"));
  const file = join(root, "session-tool-id.facts.jsonl");
  try {
    const entityId = toolFrameEntityId({ toolCallId: "call-1", turnId: "turn-1", stepId: "step-1" });
    const first = createRuntimeFactStore({ file, sessionId: "session-tool-id", epoch: "epoch-tool-id" });
    await first.load();
    assert.equal((await first.append({
      type: "tool.upsert",
      operationId: "op-1",
      turnId: "turn-1",
      stepId: "step-1",
      entityId,
      payload: { id: entityId, toolCallId: "call-1", state: "succeeded" },
    })).accepted, true);
    const restored = createRuntimeFactStore({ file, sessionId: "session-tool-id", epoch: "epoch-tool-id" });
    await restored.load();
    assert.equal(restored.snapshot().tools[0].id, entityId);
    assert.equal(restored.snapshot().tools[0].state, "succeeded");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store is idempotent and rejects terminal downgrades", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "session-b.facts.jsonl");
  try {
    const store = createRuntimeFactStore({ file, sessionId: "session-b", epoch: "epoch-b" });
    await store.load();
    const fact = { factId: "fixed", type: "message.upsert", entityId: "m", payload: { id: "m", role: "assistant", text: "done", taskState: "completed" } };
    assert.equal((await store.append(fact)).duplicate, false);
    assert.equal((await store.append(fact)).duplicate, true);
    const downgrade = await store.append({ type: "message.upsert", entityId: "m", payload: { id: "m", role: "assistant", text: "", taskState: "unknown" } });
    assert.equal(downgrade.accepted, false);
    assert.equal(downgrade.code, "TERMINAL_STATE_DOWNGRADE");
    assert.equal(store.snapshot().messages[0].taskState, "completed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store closes interrupted operation and tool facts as unknown on restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "session-recovery.facts.jsonl");
  try {
    const first = createRuntimeFactStore({ file, sessionId: "session-recovery", epoch: "epoch-first" });
    await first.load();
    await first.append({ type: "operation.replace", entityId: "op-running", payload: { id: "op-running", state: "running" } });
    await first.append({ type: "tool.upsert", entityId: "call-running", payload: { id: "call-running", state: "running" } });

    const restored = createRuntimeFactStore({ file, sessionId: "session-recovery", epoch: "epoch-restored" });
    await restored.load();
    const snapshot = restored.snapshot();
    assert.equal(snapshot.operation.state, "unknown");
    assert.equal(snapshot.operation.recoveryReason, "process_restarted");
    assert.equal(snapshot.tools[0].state, "unknown");
    assert.equal(snapshot.tools[0].recoveryReason, "process_restarted");
    assert.equal(snapshot.busy, false);

    const reloaded = createRuntimeFactStore({ file, sessionId: "session-recovery", epoch: "epoch-reloaded" });
    await reloaded.load();
    assert.equal(reloaded.snapshot().operation.state, "unknown");
    assert.equal(reloaded.snapshot().tools[0].state, "unknown");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store persists cold recovery for an in-flight assistant message", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "session-message-recovery.facts.jsonl");
  try {
    const first = createRuntimeFactStore({ file, sessionId: "session-message-recovery", epoch: "epoch-first" });
    await first.load();
    await first.append({
      type: "message.upsert",
      operationId: "op-message",
      entityId: "assistant-live",
      payload: { id: "assistant-live", role: "assistant", executionState: "running", finalized: false },
    });

    const restored = createRuntimeFactStore({ file, sessionId: "session-message-recovery", epoch: "epoch-restored" });
    await restored.load();
    assert.equal(restored.snapshot().messages[0].executionState, "unknown");
    assert.equal(restored.snapshot().messages[0].recoveryReason, "process_restarted");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store allows a new operation after the previous operation is terminal", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "session-operations.facts.jsonl");
  try {
    const store = createRuntimeFactStore({ file, sessionId: "session-operations", epoch: "epoch-operations" });
    await store.load();
    await store.append({ type: "operation.replace", entityId: "op-1", payload: { id: "op-1", state: "completed" } });
    const next = await store.append({ type: "operation.replace", entityId: "op-2", payload: { id: "op-2", state: "running" } });
    assert.equal(next.accepted, true);
    assert.equal(store.snapshot().operation.id, "op-2");
    assert.equal(store.snapshot().busy, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store replaces and explicitly clears the Plan singleton", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "session-plan.facts.jsonl");
  try {
    const store = createRuntimeFactStore({ file, sessionId: "session-plan", epoch: "epoch-plan" });
    await store.load();
    await store.append({ type: "plan.replace", entityId: "plan-1", payload: { planId: "plan-1", status: "active" } });
    assert.equal(store.snapshot().plan.planId, "plan-1");
    await store.append({ type: "plan.clear", entityId: "plan-1", payload: {} });
    assert.equal(store.snapshot().plan, null);

    const restored = createRuntimeFactStore({ file, sessionId: "session-plan", epoch: "epoch-plan" });
    await restored.load();
    assert.equal(restored.snapshot().plan, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store preserves terminal message metadata across reload", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "session-terminal.facts.jsonl");
  try {
    const store = createRuntimeFactStore({ file, sessionId: "session-terminal", epoch: "epoch-terminal" });
    await store.load();
    const taskContract = { contractVersion: 1, executionRequired: true };
    const evidenceRefs = [{ evidenceId: "artifact-1", type: "artifact", verified: true }];
    await store.append({
      type: "message.upsert",
      entityId: "assistant-1",
      payload: {
        id: "assistant-1",
        role: "assistant",
        text: "done",
        finalized: true,
        taskState: "completed",
        executionState: "completed",
        goalState: "verified",
        taskContract,
        evidenceRefs,
        interventionChoice: "continue",
      },
    });

    const restored = createRuntimeFactStore({ file, sessionId: "session-terminal", epoch: "epoch-reloaded" });
    await restored.load();
    const message = restored.snapshot().messages[0];
    assert.deepEqual(message.taskContract, taskContract);
    assert.deepEqual(message.evidenceRefs, evidenceRefs);
    assert.equal(message.interventionChoice, "continue");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store repairs cold unknown and appends an explicit warning correction", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "session-repair.facts.jsonl");
  try {
    const store = createRuntimeFactStore({ file, sessionId: "session-repair", epoch: "epoch-repair" });
    await store.load();
    await store.append({
      type: "message.upsert",
      entityId: "assistant-repair",
      payload: { id: "assistant-repair", role: "assistant", executionState: "unknown", finalized: true },
    });
    const repaired = await store.append({
      type: "message.upsert",
      entityId: "assistant-repair",
      payload: {
        id: "assistant-repair",
        role: "assistant",
        executionState: "completed",
        taskState: "completed",
        goalState: "verified",
        finalized: true,
        receipt: { completion: { ok: true, taskState: "completed" } },
        evidenceRefs: [{ evidenceId: "test-1", type: "test", verified: true }],
      },
    });
    assert.equal(repaired.accepted, true);
    assert.equal(store.snapshot().messages[0].executionState, "completed");

    const corrected = await store.append({
      type: "message.upsert",
      entityId: "assistant-repair",
      payload: {
        id: "assistant-repair",
        role: "assistant",
        executionState: "completed_with_warnings",
        taskState: "completed_with_warnings",
        goalState: "verified",
        finalized: true,
        correction: true,
        revision: 2,
        warnings: ["cleanup warning"],
      },
    });
    assert.equal(corrected.accepted, true);
    assert.equal(store.snapshot().messages[0].taskState, "completed_with_warnings");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store replaces reset messages so truncated history cannot revive", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "session-reset.facts.jsonl");
  try {
    const store = createRuntimeFactStore({ file, sessionId: "session-reset", epoch: "epoch-reset" });
    await store.load();
    await store.append({
      type: "message.upsert",
      entityId: "keep",
      payload: { id: "keep", role: "assistant", text: "old", finalized: true, taskState: "completed", evidenceRefs: [{ evidenceId: "artifact-1" }] },
    });
    await store.append({ type: "message.upsert", entityId: "remove", payload: { id: "remove", role: "assistant", text: "remove", taskState: "completed" } });
    await store.append({ type: "messages.replace", payload: { items: [{ id: "keep", role: "assistant", text: "reset" }] } });
    const messages = store.snapshot().messages;
    assert.deepEqual(messages.map((message) => message.id), ["keep"]);
    assert.equal(messages[0].text, "reset");
    assert.equal(messages[0].finalized, true);
    assert.equal(messages[0].taskState, "completed");
    assert.deepEqual(messages[0].evidenceRefs, [{ evidenceId: "artifact-1" }]);

    const restored = createRuntimeFactStore({ file, sessionId: "session-reset", epoch: "epoch-restored" });
    await restored.load();
    assert.deepEqual(restored.snapshot().messages, messages);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store permits an explicit failed tool recovery in the same scoped frame", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "session-tool-recovery.facts.jsonl");
  try {
    const store = createRuntimeFactStore({ file, sessionId: "session-tool-recovery", epoch: "epoch-tool" });
    await store.load();
    for (const state of ["queued", "running", "recovered"]) {
      const id = `frame-${state}`;
      await store.append({ type: "tool.upsert", entityId: id, payload: { id, state: "failed" } });
      assert.equal((await store.append({ type: "tool.upsert", entityId: id, payload: { id, state } })).accepted, true);
      assert.equal(store.snapshot().tools.find((tool) => tool.id === id).state, state);
    }
    await store.append({ type: "tool.upsert", entityId: "frame-done", payload: { id: "frame-done", state: "succeeded" } });
    const late = await store.append({ type: "tool.upsert", entityId: "frame-done", payload: { id: "frame-done", state: "running" } });
    assert.equal(late.accepted, false);
    assert.equal(late.code, "TERMINAL_STATE_DOWNGRADE");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store repairs a damaged JSONL tail before appending new facts", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "session-tail-repair.facts.jsonl");
  try {
    const first = createRuntimeFactStore({ file, sessionId: "session-tail-repair", epoch: "epoch-first" });
    await first.load();
    await first.append({ type: "message.upsert", entityId: "before", payload: { id: "before", role: "user", text: "before" } });
    await appendFile(file, '{"schemaVersion":1,"factId":"partial', "utf8");

    const repaired = createRuntimeFactStore({ file, sessionId: "session-tail-repair", epoch: "epoch-repaired" });
    await repaired.load();
    await repaired.append({ type: "message.upsert", entityId: "after", payload: { id: "after", role: "assistant", text: "after" } });

    const reloaded = createRuntimeFactStore({ file, sessionId: "session-tail-repair", epoch: "epoch-reloaded" });
    await reloaded.load();
    assert.deepEqual(reloaded.snapshot().messages.map((message) => message.id), ["before", "after"]);
    assert.doesNotMatch(await readFile(file, "utf8"), /partial/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime fact store rejects a persisted future schema instead of downgrading it", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-facts-"));
  const file = join(root, "future-schema.facts.jsonl");
  try {
    await appendFile(file, `${JSON.stringify({
      schemaVersion: 2,
      factId: "future-1",
      sequence: 1,
      occurredAt: "2026-07-29T00:00:00.000Z",
      sessionId: "session-future",
      type: "message.upsert",
      payload: { id: "message-1", role: "user", text: "hello" },
    })}\n`, "utf8");
    const store = createRuntimeFactStore({ file, sessionId: "session-future", epoch: "epoch-future" });
    await assert.rejects(store.load(), /schema_version_unsupported/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
