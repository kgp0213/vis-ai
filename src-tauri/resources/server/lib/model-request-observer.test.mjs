import test from "node:test";
import assert from "node:assert/strict";

import { createModelRequestObserver } from "./model-request-observer.mjs";

test("model request observer attributes retries to the active async turn", async () => {
  const recorded = [];
  const published = [];
  const observer = createModelRequestObserver();
  const context = {
    operationId: "operation-1",
    requestId: "request-1",
    receipt: { recordModelRetry: (event) => recorded.push(event) },
    publish: (event) => published.push(event),
  };

  await observer.run(context, async () => {
    await Promise.resolve();
    observer.onRetry({ attempt: 1, reason: "http 429", waitMs: 500 });
  });

  assert.deepEqual(recorded[0], {
    requestId: "request-1",
    attempt: 1,
    maxAttempts: 4,
    delayMs: 500,
    reason: "http 429",
    statusCode: 429,
  });
  assert.equal(published[0].kind, "model-retry");
  assert.equal(published[0].id, "model-retry-operation-1");
});

test("model request observer keeps concurrent async contexts isolated", async () => {
  const seen = [];
  const observer = createModelRequestObserver();
  await Promise.all(["one", "two"].map((requestId) => observer.run({
    operationId: requestId,
    requestId,
    receipt: { recordModelRetry: (event) => seen.push(event.requestId) },
  }, async () => {
    await new Promise((resolve) => setTimeout(resolve, requestId === "one" ? 5 : 0));
    observer.onRetry({ attempt: 1, reason: "fetch failed", waitMs: 1 });
  })));
  assert.deepEqual(seen.sort(), ["one", "two"]);
});

test("model request observer records provider result facts on the active receipt", async () => {
  const recorded = [];
  const published = [];
  const observer = createModelRequestObserver();
  await observer.run({
    operationId: "op-result",
    requestId: "req-result",
    receipt: { recordProviderResult: (event) => recorded.push(event) },
    publish: (event) => published.push(event),
  }, async () => observer.onResult({ finishReason: "tool_call", attempt: 1 }));
  assert.equal(recorded[0].requestId, "req-result");
  assert.equal(published[0].kind, "model-result");
});
