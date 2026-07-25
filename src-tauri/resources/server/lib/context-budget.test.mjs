import assert from "node:assert/strict";
import { test } from "node:test";

import { buildContextBudgetStatus, estimateContextTokens } from "./context-budget.mjs";

test("context budget estimates tokens conservatively and keeps resource references", () => {
  assert.equal(estimateContextTokens(350), 100);
  const status = buildContextBudgetStatus({
    totalInputChars: 1000,
    materializedChars: 400,
    pendingChars: 600,
    pendingInputs: [{ resourceId: "tool-output-1.txt" }, { resourceId: "tool-output-1.txt" }, { resourceId: "C:\\secret.txt" }],
  }, { assistantText: "完成", toolResultBytes: 2048, compressed: true });
  assert.equal(status.inputChars, 1002);
  assert.equal(status.toolResultBytes, 2048);
  assert.equal(status.compressed, true);
  assert.deepEqual(status.resourceRefs, ["tool-output-1.txt"]);
  assert.equal(status.estimatedTokens > 0, true);
});
