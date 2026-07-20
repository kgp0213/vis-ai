import test from "node:test";
import assert from "node:assert/strict";

import { classifyComplexTaskReuse } from "./complex-task-reuse-policy.mjs";

test("active complex tasks are reused instead of creating duplicate work", () => {
  const result = classifyComplexTaskReuse({ lifecycle: "waiting_user" });
  assert.deepEqual(result, { reusable: true, reason: "active" });
});

test("only a verified delivered outcome is reusable", () => {
  for (const outcome of ["failed", "cancelled", "partial"]) {
    assert.equal(classifyComplexTaskReuse({ lifecycle: "terminal", outcome: { outcome } }).reusable, false);
  }
  assert.equal(classifyComplexTaskReuse({ lifecycle: "terminal", outcome: { outcome: "delivered_with_warnings" }, artifactRefs: ["artifact:1"] }).reusable, true);
});

test("a delivered task without an artifact or output is not falsely reported as complete", () => {
  const result = classifyComplexTaskReuse({ lifecycle: "terminal", outcome: { outcome: "delivered" } }, {
    outputPath: "missing.md",
    pathExists: () => false,
  });
  assert.deepEqual(result, { reusable: false, reason: "missing-artifact" });
});
