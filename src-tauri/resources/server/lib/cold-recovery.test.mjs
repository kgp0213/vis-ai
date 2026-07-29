import assert from "node:assert/strict";
import test from "node:test";

import { recoverColdSnapshotEntities } from "./cold-recovery.mjs";

test("converges active execution facts to unknown without replaying work", () => {
  const result = recoverColdSnapshotEntities({
    operation: { id: "op-1", state: "running" },
    turns: [{ id: "turn-1", state: "running" }],
    steps: [{ id: "step-1", state: "running" }],
    tools: [{ id: "tool-1", state: "running" }],
    admission: { id: "admission-1", active: true, busy: true },
  }, { reason: "process_restarted" });
  assert.equal(result.snapshot.operation.state, "unknown");
  assert.equal(result.snapshot.turns[0].state, "unknown");
  assert.equal(result.snapshot.steps[0].state, "unknown");
  assert.equal(result.snapshot.tools[0].state, "unknown");
  assert.equal(result.snapshot.admission.active, false);
  assert.equal(result.snapshot.admission.busy, false);
  assert.equal(result.replayedSideEffects, undefined);
  assert.equal(result.changes.length, 5);
});

test("converges an in-flight assistant message but preserves ordinary user messages", () => {
  const result = recoverColdSnapshotEntities({
    messages: [
      { id: "assistant-live", role: "assistant", operationId: "op-1", executionState: "running", finalized: false },
      { id: "user-message", role: "user", text: "running is ordinary text" },
    ],
  });
  assert.equal(result.snapshot.messages[0].executionState, "unknown");
  assert.equal(result.snapshot.messages[0].taskState, "unknown");
  assert.equal(result.snapshot.messages[0].finalized, false);
  assert.equal(result.snapshot.messages[1].executionState, undefined);
  assert.equal(result.snapshot.messages[1].text, "running is ordinary text");
  assert.ok(result.changes.some((change) => change.collection === "messages" && change.entityId === "assistant-live"));
});

test("marks pending interactions interrupted and queued prompts not_applied", () => {
  const result = recoverColdSnapshotEntities({
    interactions: [{ id: "modal-1", state: "pending" }],
    prompts: [
      { id: "prompt-1", status: "queued" },
      { id: "prompt-2", status: "applied" },
    ],
  });
  assert.equal(result.snapshot.interactions[0].state, "interrupted");
  assert.equal(result.snapshot.prompts[0].status, "not_applied");
  assert.equal(result.snapshot.prompts[1].status, "applied");
  assert.ok(result.warnings.some((warning) => warning.includes("modal-1")));
});

test("marks active background task notification facts lost but preserves terminal facts", () => {
  const result = recoverColdSnapshotEntities({
    taskNotifications: [
      { id: "task-1", status: "running" },
      { id: "task-2", status: "completed" },
    ],
  });
  assert.equal(result.snapshot.taskNotifications[0].status, "lost");
  assert.equal(result.snapshot.taskNotifications[1].status, "completed");
});
