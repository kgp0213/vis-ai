import test from "node:test";
import assert from "node:assert/strict";

import { DeepSeekClient } from "../visionox-pkg/dist/cli/chunk-2KDUS647.js";
import { DeepSeekClient as PackageDeepSeekClient } from "../visionox-pkg/dist/index.js";

function sseResponse(events) {
  return new Response(events.join("\n\n") + "\n\n", {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function rawSseResponse(body) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function clientFor(events, Client = DeepSeekClient) {
  return new Client({
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

test("a complete final SSE frame is consumed at EOF without a trailing blank line", async () => {
  for (const Client of [DeepSeekClient, PackageDeepSeekClient]) {
    const client = new Client({
      apiKey: "test-key",
      baseUrl: "https://provider.invalid/v1",
      fetch: async () => rawSseResponse('data: {"choices":[{"delta":{"content":"tail"},"finish_reason":"stop"}]}'),
    });

    const chunks = await collect(client);
    assert.equal(chunks.map((chunk) => chunk.contentDelta ?? "").join(""), "tail");
    assert.equal(chunks.findLast((chunk) => chunk.finishReason)?.finishReason, "stop");
    assert.equal(chunks.at(-1)?.streamComplete, true);
  }
});

test("stream payloads request usage while preserving explicit provider options", () => {
  const request = {
    model: "test-model",
    messages: [{ role: "user", content: "test" }],
  };
  for (const Client of [DeepSeekClient, PackageDeepSeekClient]) {
    const legacy = new Client({ apiKey: "test-key", baseUrl: "https://provider.invalid/v1" });
    assert.deepEqual(legacy.buildPayload(request, true).stream_options, { include_usage: true });
    assert.equal(Object.hasOwn(legacy.buildPayload(request, false), "stream_options"), false);

    const configured = new Client({
      apiKey: "test-key",
      baseUrl: "https://provider.invalid/v1",
      requestConfigForModel: () => ({
        policy: "json",
        requestDefaults: { stream_options: { include_usage: false, continuous_usage_stats: true } },
      }),
    });
    assert.deepEqual(configured.buildPayload(request, true).stream_options, {
      include_usage: false,
      continuous_usage_stats: true,
    });

    const completionTokenClient = new Client({
      apiKey: "test-key",
      baseUrl: "https://provider.invalid/v1",
      requestConfigForModel: () => ({ policy: "json", requestDefaults: { max_completion_tokens: 12000 } }),
    });
    const completionPayload = completionTokenClient.buildPayload({ ...request, maxTokens: 4096 }, false);
    assert.equal(completionPayload.max_completion_tokens, 4096);
    assert.equal(Object.hasOwn(completionPayload, "max_tokens"), false);
  }
});

test("an older gateway can reject stream_options without breaking streaming", async () => {
  const payloads = [];
  const client = new DeepSeekClient({
    apiKey: "test-key",
    baseUrl: "https://provider.invalid/v1",
    fetch: async (_url, init) => {
      const payload = JSON.parse(init.body);
      payloads.push(payload);
      if (payload.stream_options) {
        return new Response('unknown field "stream_options"', { status: 400 });
      }
      return sseResponse([
        'data: {"choices":[{"delta":{"content":"fallback works"},"finish_reason":null}]}',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ]);
    },
  });

  const chunks = await collect(client);
  assert.equal(chunks.map((chunk) => chunk.contentDelta ?? "").join(""), "fallback works");
  assert.equal(payloads.length, 2);
  assert.deepEqual(payloads[0].stream_options, { include_usage: true });
  assert.equal(Object.hasOwn(payloads[1], "stream_options"), false);

  const secondRun = await collect(client);
  assert.equal(secondRun.map((chunk) => chunk.contentDelta ?? "").join(""), "fallback works");
  assert.equal(payloads.length, 3, "unsupported stream_options should be cached after the first fallback");
  assert.equal(Object.hasOwn(payloads[2], "stream_options"), false);
});

test("a gateway returning 422 invalid_request_error for stream_options falls back for both bundle entrypoints", async () => {
  for (const Client of [DeepSeekClient, PackageDeepSeekClient]) {
    const payloads = [];
    const client = new Client({
      apiKey: "test-key",
      baseUrl: "https://provider.invalid/v1",
      fetch: async (_url, init) => {
        const payload = JSON.parse(init.body);
        payloads.push(payload);
        if (payload.stream_options) {
          return new Response(JSON.stringify({
            error: {
              type: "invalid_request_error",
              message: "extra_forbidden: stream_options",
            },
          }), { status: 422, headers: { "content-type": "application/json" } });
        }
        return sseResponse([
          'data: {"choices":[{"delta":{"content":"422 fallback works"},"finish_reason":null}]}',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
          "data: [DONE]",
        ]);
      },
    });

    const chunks = await collect(client);
    assert.equal(chunks.map((chunk) => chunk.contentDelta ?? "").join(""), "422 fallback works");
    assert.equal(payloads.length, 2);
    assert.deepEqual(payloads[0].stream_options, { include_usage: true });
    assert.equal(Object.hasOwn(payloads[1], "stream_options"), false);
  }
});

test("a 422 unrelated to stream_options is not retried with a different payload", async () => {
  for (const Client of [DeepSeekClient, PackageDeepSeekClient]) {
    let requestCount = 0;
    const client = new Client({
      apiKey: "test-key",
      baseUrl: "https://provider.invalid/v1",
      fetch: async () => {
        requestCount += 1;
        return new Response(JSON.stringify({
          error: { type: "invalid_request_error", message: "max_tokens is too large" },
        }), { status: 422, headers: { "content-type": "application/json" } });
      },
    });

    await assert.rejects(
      () => collect(client),
      (error) => /DeepSeek 422/.test(error?.message || ""),
    );
    assert.equal(requestCount, 1);
  }
});

test("an SSE event:error frame is surfaced as a provider error", async () => {
  await assert.rejects(
    () => collect(clientFor([
      "event: error\ndata: {\"message\":\"gateway rejected request\"}",
      "data: [DONE]",
    ])),
    (error) => error?.name === "ModelProviderStreamError" && /gateway rejected request/.test(error.message),
  );
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
    assert.equal(outcome.error?.name, "ModelRequestTimeoutError");
    assert.equal(outcome.error?.code, "MODEL_REQUEST_TIMEOUT");
  });

  await t.test("stream", async () => {
    const outcome = await observeBeforeSafetyTimeout(async (signal) => {
      for await (const _chunk of client.stream({ ...request, signal })) {
        // The mock never produces a response; timeout must abort before any chunk exists.
      }
    });
    assert.equal(outcome.kind, "rejected", "stream ignored client.timeoutMs while the caller signal remained active");
    assert.equal(outcome.error?.name, "ModelRequestTimeoutError");
    assert.equal(outcome.error?.code, "MODEL_REQUEST_TIMEOUT");
  });
});

test("caller cancellation remains distinguishable from an internal model timeout", async () => {
  const client = new DeepSeekClient({
    apiKey: "test-key",
    baseUrl: "https://provider.invalid/v1",
    timeoutMs: 200,
    fetch: pendingFetchUntilAbort,
  });
  const controller = new AbortController();
  const request = client.chat({
    model: "test-model",
    messages: [{ role: "user", content: "test" }],
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(request, (error) => error?.name === "AbortError" && error?.code !== "MODEL_REQUEST_TIMEOUT");
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

test("the package entrypoint mirrors the CLI timeout and provider stream safeguards", async (t) => {
  const client = new PackageDeepSeekClient({
    apiKey: "test-key",
    baseUrl: "https://provider.invalid/v1",
    timeoutMs: 20,
    fetch: pendingFetchUntilAbort,
  });
  const request = {
    model: "test-model",
    messages: [{ role: "user", content: "test" }],
  };

  await t.test("chat timeout", async () => {
    const outcome = await observeBeforeSafetyTimeout((signal) => client.chat({ ...request, signal }));
    assert.equal(outcome.kind, "rejected", "package chat ignored client.timeoutMs while the caller signal remained active");
    assert.equal(outcome.error?.name, "ModelRequestTimeoutError");
    assert.equal(outcome.error?.code, "MODEL_REQUEST_TIMEOUT");
  });

  await t.test("stream timeout", async () => {
    const outcome = await observeBeforeSafetyTimeout(async (signal) => {
      for await (const _chunk of client.stream({ ...request, signal })) {
        // The mock never produces a response; timeout must abort before any chunk exists.
      }
    });
    assert.equal(outcome.kind, "rejected", "package stream ignored client.timeoutMs while the caller signal remained active");
    assert.equal(outcome.error?.name, "ModelRequestTimeoutError");
    assert.equal(outcome.error?.code, "MODEL_REQUEST_TIMEOUT");
  });

  await t.test("provider SSE error", async () => {
    await assert.rejects(
      () => collect(clientFor([
        'data: {"error":{"message":"package upstream overloaded","type":"server_error"}}',
        "data: [DONE]",
      ], PackageDeepSeekClient)),
      (error) => error?.name === "ModelProviderStreamError" && /package upstream overloaded/.test(error.message),
    );
  });
});
