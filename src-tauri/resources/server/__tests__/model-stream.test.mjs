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
