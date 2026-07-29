import assert from "node:assert/strict";
import test from "node:test";

import { terminalStateTransition } from "./execution-state.mjs";

test("terminal state transitions allow explicit recovery from weak facts", () => {
  assert.equal(terminalStateTransition("unknown", "completed").accepted, true);
  assert.equal(terminalStateTransition("incomplete", "completed_with_warnings").accepted, true);
  assert.equal(terminalStateTransition("completed", "unknown").accepted, false);
});

test("terminal warning corrections require an explicit revision", () => {
  assert.equal(terminalStateTransition("completed", "completed_with_warnings").accepted, false);
  assert.equal(terminalStateTransition("completed", "completed_with_warnings", { correction: true }).accepted, true);
});
