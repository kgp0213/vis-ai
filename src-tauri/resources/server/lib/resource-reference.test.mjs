import test from "node:test";
import assert from "node:assert/strict";

import { normalizeResourceReference } from "./resource-reference.mjs";

test("normalizes a bounded paged resource contract", () => {
  const resource = normalizeResourceReference({
    resourceId: "task-output:bg-1",
    preview: "x".repeat(3000),
    totalBytes: 100,
    offsetBytes: 20,
    nextOffsetBytes: 70,
    readAction: "job_output",
  });
  assert.equal(resource.preview.length, 2400);
  assert.equal(resource.nextOffsetBytes, 70);
  assert.equal(resource.complete, false);
  assert.equal(resource.readAction, "job_output");
});

test("clamps invalid offsets and cursors to the resource length", () => {
  const resource = normalizeResourceReference({
    resourceId: "task-output:bounded",
    totalBytes: 100,
    offsetBytes: 150,
    nextOffsetBytes: 1000,
  });
  assert.equal(resource.offsetBytes, 100);
  assert.equal(resource.nextOffsetBytes, 100);
  assert.equal(resource.complete, true);
});
