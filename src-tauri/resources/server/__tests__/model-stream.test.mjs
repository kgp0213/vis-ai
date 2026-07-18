import test from "node:test";
import assert from "node:assert/strict";

import { DeepSeekClient } from "../visionox-pkg/dist/cli/chunk-2KDUS647.js";

function sseResponse(events) {
  return new Response(events.join("\n\n") + "\n\n", {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function clientFor(events) {
  return new DeepSeekClient({
    apiKey: "test-key",
    baseUrl: "https://provider.invalid/v1",
    fetch: async () => sseResponse(events),
  });
}

function pendingFetchUntilAbort(_url, init = {}) {
  return new Promise((resolve, reject) => {
    const signal = init.signal;
    const onAbort = () => reject(signal?.reason ?? new DOMException("aborted", "AbortError"));
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function observeBeforeSafetyTimeout(startRequest, safetyTimeoutMs = 200) {
  const caller = new AbortController();
  const request = Promise.resolve()
    .then(() => startRequest(caller.signal))
    .then(
      (value) => ({ kind: "resolved", value }),
      (error) => ({ kind: "rejected", error }),
    );
  let safetyTimer;
  const outcome = await Promise.race([
    request,
    new Promise((resolve) => {
      safetyTimer = setTimeout(() => resolve({ kind: "safety-timeout" }), safetyTimeoutMs);
    }),
  ]);
  clearTimeout(safetyTimer);
  caller.abort();
  await request;
  return outcome;
}

async function collect(client) {
  const chunks = [];
  for await (const chunk of client.stream({
    model: "test-model",
    messages: [{ role: "user", content: "test" }],
  })) {
    chunks.push(chunk);
  }
  return chunks;
}

test("empty SSE data events do not terminate a model response", async () => {
  const chunks = await collect(clientFor([
    "data:",
    'data: {"choices":[{"delta":{"content":"complete"},"finish_reason":null}]}',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
    "data: [DONE]",
  ]));

  assert.equal(chunks.map((chunk) => chunk.contentDelta ?? "").join(""), "complete");
  assert.equal(chunks.findLast((chunk) => chunk.finishReason)?.finishReason, "stop");
  assert.equal(chunks.at(-1)?.streamComplete, true);
});
test("malformed non-empty SSE data fails instead of silently dropping a frame", async () => {
  await assert.rejects(
    () => collect(clientFor([
      'data: {"choices":[{"delta":{"content":"before"},"finish_reason":null}]}',
      "data: {not-json}",
      "data: [DONE]",
    ])),
    (error) => error?.name === "ModelStreamProtocolError" && /malformed SSE JSON/.test(error.message),
  );
});

test("a naturally closed stream without a finish reason is retryable incomplete output", async () => {
  await assert.rejects(
    () => collect(clientFor([
      'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}',
    ])),
    (error) => error?.name === "ModelStreamIncompleteError" && /without an explicit completion/.test(error.message),
  );
});

test("client timeout remains active when the caller supplies an external signal", async (t) => {
  const client = new DeepSeekClient({
    apiKey: "test-key",
    baseUrl: "https://provider.invalid/v1",
    timeoutMs: 20,
    fetch: pendingFetchUntilAbort,
  });
  const request = {
    model: "test-model",
    messages: [{ role: "user", content: "test" }],
  };

  await t.test("chat", async () => {
    const outcome = await observeBeforeSafetyTimeout((signal) => client.chat({ ...request, signal }));
    assert.equal(outcome.kind, "rejected", "chat ignored client.timeoutMs while the caller signal remained active");
    assert.equal(outcome.error?.name, "AbortError");
  });

  await t.test("stream", async () => {
    const outcome = await observeBeforeSafetyTimeout(async (signal) => {
      for await (const _chunk of client.stream({ ...request, signal })) {
        // The mock never produces a response; timeout must abort before any chunk exists.
      }
    });
    assert.equal(outcome.kind, "rejected", "stream ignored client.timeoutMs while the caller signal remained active");
    assert.equal(outcome.error?.name, "AbortError");
  });
});

test("an SSE provider error is surfaced even when followed by a done marker", async () => {
  await assert.rejects(
    () => collect(clientFor([
      'data: {"error":{"message":"upstream overloaded","type":"server_error","code":"upstream_failure"}}',
      "data: [DONE]",
    ])),
    (error) => error?.name === "ModelProviderStreamError" && /upstream overloaded/.test(error.message),
  );
});
