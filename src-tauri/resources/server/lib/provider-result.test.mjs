import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyProviderResult, normalizeProviderResult } from "./provider-result.mjs";

test("normalizes finish reasons and retry facts", () => {
  const result = normalizeProviderResult({ id: "req-1", status: 429, finish_reason: "length", attempt: 2, usage: { total_tokens: 3 } });
  assert.equal(result.requestId, "req-1");
  assert.equal(result.finishReason, "truncated");
  assert.equal(result.retryable, true);
  assert.equal(result.statusCode, 429);
});
test("classifies auth, cancellation and tool outcomes without guessing provider type", () => {
  assert.equal(classifyProviderResult({ statusCode: 401 }).code, "provider_auth_failed");
  assert.equal(classifyProviderResult({ finishReason: "cancelled", cancelled: true }).outcome, "cancelled");
  assert.equal(classifyProviderResult({ finishReason: "tool_calls" }).outcome, "tool_call");
});
