import { test } from "node:test";
import assert from "node:assert/strict";

import { parseLearnCommand } from "./learn.mjs";

test("/learn parser accepts command boundaries and rejects lookalike names", () => {
  assert.equal(parseLearnCommand("/learn")?.cmd, "help");
  assert.equal(parseLearnCommand("  /LEARN status  ")?.cmd, "status");
  assert.equal(parseLearnCommand("/learn tutor hint")?.tail, "hint");
  assert.equal(parseLearnCommand("/learner status"), null);
  assert.equal(parseLearnCommand("/learn-index ."), null);
});
