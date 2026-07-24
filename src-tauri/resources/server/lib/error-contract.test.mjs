import test from "node:test";
import assert from "node:assert/strict";

import { normalizeApiError, structuredError } from "./error-contract.mjs";

test("structured API errors preserve the legacy error string", () => {
  assert.deepEqual(structuredError({
    code: "provider_auth_failed",
    title: "模型鉴权失败",
    message: "API Key 无效",
    retryable: false,
    action: "检查 API Key",
    details: { providerId: "kimi" },
  }), {
    error: "API Key 无效",
    code: "provider_auth_failed",
    title: "模型鉴权失败",
    message: "API Key 无效",
    retryable: false,
    action: "检查 API Key",
    details: { providerId: "kimi" },
    cause: null,
  });
});

test("legacy API errors are classified at the response boundary", () => {
  const result = normalizeApiError({ status: 503, body: { error: "fetch failed" } });
  assert.equal(result.status, 503);
  assert.equal(result.body.error, "fetch failed");
  assert.equal(result.body.code, "provider_network_failed");
  assert.equal(result.body.retryable, true);
  assert.match(result.body.action, /网络|稍后重试/u);
});

test("error normalization keeps successful responses unchanged", () => {
  const success = { status: 200, body: { ok: true } };
  assert.equal(normalizeApiError(success), success);
});
