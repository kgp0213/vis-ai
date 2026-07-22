import test from "node:test";
import assert from "node:assert/strict";
import { validateFileWriteArgs } from "./file-write-policy.mjs";

test("file writes reject object content before filesystem dispatch", () => {
  const result = validateFileWriteArgs("append_file", { content: { content: "x" } });
  assert.match(result.error, /requires content to be a string/);
  assert.equal(result.retryable, true);
});

test("large complete string writes are not rejected by an arbitrary host limit", () => {
  assert.equal(validateFileWriteArgs("write_file", { content: "x".repeat(48_000) }), null);
});

test("valid bounded file writes pass through", () => {
  assert.equal(validateFileWriteArgs("append_file", { content: "ok" }), null);
  assert.equal(validateFileWriteArgs("read_file", { content: { bad: true } }), null);
});
