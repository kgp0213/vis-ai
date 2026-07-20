import test from "node:test";
import assert from "node:assert/strict";

import { fetchWithRetry } from "../visionox-pkg/dist/index.js";

test("account quota 429 responses are returned without retry amplification", async () => {
  let calls = 0;
  const response = await fetchWithRetry(async () => {
    calls += 1;
    return new Response(JSON.stringify({
      error: {
        code: "AccountQuotaExceeded",
        message: "quota resets at 2026-07-21T01:00:28+08:00",
      },
    }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "3600" },
    });
  }, "https://example.invalid/chat", {}, {
    maxAttempts: 4,
    initialBackoffMs: 0,
    maxBackoffMs: 0,
  });

  assert.equal(response.status, 429);
  assert.equal(calls, 1);
  assert.equal((await response.json()).error.code, "AccountQuotaExceeded");
});

test("transient 429 responses remain retryable and bounded", async () => {
  let calls = 0;
  const response = await fetchWithRetry(async () => {
    calls += 1;
    if (calls < 3) {
      return new Response('{"error":{"code":"rate_limit","message":"try again"}}', { status: 429 });
    }
    return new Response('{"ok":true}', { status: 200 });
  }, "https://example.invalid/chat", {}, {
    maxAttempts: 4,
    initialBackoffMs: 0,
    maxBackoffMs: 0,
  });

  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});
