import assert from "node:assert/strict";
import { test } from "node:test";

import { createLifecycleMachine, LifecycleTransitionError } from "./lifecycle-transaction.mjs";

test("guards an async transition and commits the selected state", async () => {
  const machine = createLifecycleMachine("ready");
  let observed;
  await machine.transaction({ operation: "persist", from: "ready", enter: "writing", commit: "saved", rollback: "failed" }, async () => {
    observed = machine.snapshot;
  });
  assert.deepEqual(observed, { state: "writing", transitioning: true, operation: "persist" });
  assert.equal(machine.state, "saved");
});

test("rolls back on failure and keeps the primary error", async () => {
  const machine = createLifecycleMachine("ready");
  const failure = new Error("write failed");
  await assert.rejects(
    machine.transaction({ operation: "persist", from: "ready", enter: "writing", commit: "saved", rollback: "failed" }, async () => {
      throw failure;
    }),
    failure,
  );
  assert.equal(machine.state, "failed");
});

test("cleanup failure does not overwrite the committed state", async () => {
  const machine = createLifecycleMachine("ready");
  await assert.rejects(
    machine.transaction({ operation: "persist", from: "ready", enter: "writing", commit: "saved", rollback: "failed" }, async (tx) => {
      tx.defer(() => { throw new Error("cleanup failed"); });
    }),
    /cleanup failed/,
  );
  assert.equal(machine.state, "saved");
});

test("rejects a nested transition", async () => {
  const machine = createLifecycleMachine("ready");
  let nested;
  await machine.transaction({ operation: "persist", from: "ready", enter: "writing", commit: "saved", rollback: "failed" }, async () => {
    try {
      machine.switch({ operation: "nested", from: "writing", to: "failed" });
    } catch (error) {
      nested = error;
    }
  });
  assert.ok(nested instanceof LifecycleTransitionError);
  assert.equal(nested.reason, "transition_conflict");
});

test("restores the previous state when a successful callback omits commit", async () => {
  const machine = createLifecycleMachine("ready");
  await assert.rejects(
    machine.transaction({ operation: "persist", from: "ready", enter: "writing", rollback: "failed" }, async () => {}),
    (error) => error.reason === "missing_commit_state",
  );
  assert.equal(machine.state, "failed");
  assert.equal(machine.snapshot.transitioning, false);
});

test("restores the previous state when a failed callback omits rollback", async () => {
  const machine = createLifecycleMachine("ready");
  await assert.rejects(
    machine.transaction({ operation: "persist", from: "ready", enter: "writing", commit: "saved" }, async () => {
      throw new Error("write failed");
    }),
    (error) => error.cause?.message === "write failed",
  );
  assert.equal(machine.state, "ready");
  assert.equal(machine.snapshot.transitioning, false);
});
