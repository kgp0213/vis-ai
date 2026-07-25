import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizePromptSteering, normalizeTodo, upsertEntity } from "./execution-entities.mjs";

test("goal, todo and prompt entities have stable bounded states", () => {
  assert.equal(normalizeTodo({ id: "todo", status: "bad" }).status, "pending");
  assert.equal(normalizePromptSteering({ id: "p", status: "applied", instruction: "secret" }).instructionLength, 6);
  const first = upsertEntity({}, { id: "p", status: "applied" }, normalizePromptSteering, "p");
  const late = upsertEntity(first.map, { id: "p", status: "queued" }, normalizePromptSteering, "p");
  assert.equal(late.ignored, true);
});
