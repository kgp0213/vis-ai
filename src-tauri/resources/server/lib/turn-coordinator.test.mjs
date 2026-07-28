import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createTurnCoordinator } from "./turn-coordinator.mjs";

describe("turn coordinator", () => {
  test("admits one active turn per session and is idempotent on finish", () => {
    const coordinator = createTurnCoordinator({ idFactory: () => "1", now: () => "2026-01-01T00:00:00.000Z" });
    const first = coordinator.begin({ sessionId: "session-a", operationId: "op-a", requestId: "req-a" });
    assert.equal(first.accepted, true);
    assert.equal(coordinator.begin({ sessionId: "session-a", operationId: "op-b", requestId: "req-b" }).code, "TURN_ACTIVE");
    assert.equal(coordinator.step(first.turn.turnId, { stepId: "step-a" }).stepId, "step-a");
    assert.equal(coordinator.finish(first.turn.turnId, "completed").accepted, true);
    assert.equal(coordinator.finish(first.turn.turnId, "unknown").duplicate, true);
  });

  test("isolates sessions and marks interrupted turns unknown", () => {
    const coordinator = createTurnCoordinator({ idFactory: (() => { let n = 0; return () => String(++n); })() });
    const a = coordinator.begin({ sessionId: "a" });
    const b = coordinator.begin({ sessionId: "b" });
    assert.equal(a.accepted, true);
    assert.equal(b.accepted, true);
    assert.equal(coordinator.interrupt(a.turn.turnId).turn.state, "unknown");
    assert.equal(coordinator.getActive("a"), null);
    assert.equal(coordinator.getActive("b").state, "running");
    assert.equal(coordinator.listActive().length, 1);
    assert.equal(coordinator.cancel(b.turn.turnId, "user_cancelled").turn.state, "cancelled");
    assert.equal(coordinator.listActive().length, 0);
  });

  test("rejects invalid admission and invalid terminal states without mutating a turn", () => {
    const coordinator = createTurnCoordinator();
    assert.equal(coordinator.begin({}).code, "TURN_SESSION_REQUIRED");
    const turn = coordinator.begin({ sessionId: "session-c" });
    assert.equal(coordinator.step("missing").code, "TURN_NOT_ACTIVE");
    assert.equal(coordinator.finish(turn.turn.turnId, "running").code, "TURN_INVALID_STATE");
    assert.equal(coordinator.finish("missing", "unknown").code, "TURN_NOT_FOUND");
  });
});
