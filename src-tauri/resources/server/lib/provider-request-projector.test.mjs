import test from "node:test";
import assert from "node:assert/strict";

import {
  invokeLoopStepWithProviderProjection,
  projectProviderRequest,
} from "./provider-request-projector.mjs";

async function collect(iterator) {
  const events = [];
  for await (const event of iterator) events.push(event);
  return events;
}

function makeLoop({ stream, chat, history = [] } = {}) {
  const client = {
    ...(stream ? { stream } : {}),
    ...(chat ? { chat } : {}),
  };
  const loop = {
    client,
    buildMessages() { return history; },
    step() {
      return (async function* stepEvents() {
        const messages = this.buildMessages();
        if (typeof this.client.stream === "function") {
          for await (const chunk of this.client.stream({ messages })) yield chunk;
        } else if (typeof this.client.chat === "function") {
          yield await this.client.chat({ messages });
        }
      }).call(this);
    },
  };
  return loop;
}

test("observes valid tool exchanges without changing the request", () => {
  const history = [
    { role: "user", content: "read" },
    { role: "assistant", content: "", tool_calls: [{ id: "call-1", type: "function", function: { name: "read_file", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "call-1", content: "ok" },
  ];
  const result = projectProviderRequest({ history });
  assert.equal(result.changed, false);
  assert.deepEqual(result.messages, history);
  assert.deepEqual(result.anomalies, []);
});

test("records a tool result displaced by a user message", () => {
  const result = projectProviderRequest({ history: [
    { role: "assistant", tool_calls: [{ id: "call-1" }] },
    { role: "user", content: "later" },
    { role: "tool", tool_call_id: "call-1", content: "ok" },
  ] });
  assert.equal(result.changed, false);
  assert.equal(result.anomalies.some((item) => item.code === "tool_result_reordered"), true);
});

test("strict mode repairs displaced results and makes missing results explicitly unknown", () => {
  const result = projectProviderRequest({
    mode: "strict",
    history: [
      { role: "assistant", tool_calls: [{ id: "call-1" }, { id: "call-2" }] },
      { role: "user", content: "intervened" },
      { role: "tool", tool_call_id: "call-1", content: "ok" },
    ],
  });
  assert.equal(result.changed, true);
  assert.equal(result.messages.filter((item) => item.role === "tool").length, 2);
  assert.equal(result.messages.some((item) => item.role === "tool" && item.tool_call_id === "call-2" && item.visionoxUnknown === true), true);
  assert.equal(result.anomalies.some((item) => item.code === "missing_tool_result" && item.toolCallId === "call-2"), true);
});

test("strict mode drops orphan and duplicate tool results without touching the source", () => {
  const history = [
    { role: "assistant", tool_calls: [{ id: "call-1" }, { id: "call-1" }] },
    { role: "tool", tool_call_id: "orphan", content: "bad" },
    { role: "tool", tool_call_id: "call-1", content: "first" },
    { role: "tool", tool_call_id: "call-1", content: "duplicate" },
  ];
  const result = projectProviderRequest({ history, mode: "strict" });
  assert.equal(result.changed, true);
  assert.equal(result.messages.some((item) => item.tool_call_id === "orphan"), false);
  assert.equal(result.messages.filter((item) => item.tool_call_id === "call-1").length, 1);
  assert.equal(history[1].tool_call_id, "orphan");
  assert.equal(result.anomalies.some((item) => item.code === "orphan_tool_result"), true);
  assert.equal(result.anomalies.some((item) => item.code === "duplicate_tool_call"), true);
});

test("strict mode merges adjacent assistant messages and records the illegal role order", () => {
  const result = projectProviderRequest({
    mode: "strict",
    history: [
      { role: "user", content: "start" },
      { role: "assistant", content: "first" },
      { role: "assistant", content: "second" },
    ],
  });

  assert.equal(result.changed, true);
  assert.deepEqual(result.messages.map((message) => message.role), ["user", "assistant"]);
  assert.equal(result.messages[1].content, "first\nsecond");
  assert.equal(result.anomalies.some((item) => item.code === "consecutive_assistant"), true);
});

test("records system or developer messages that appear after conversation history", () => {
  const result = projectProviderRequest({ history: [
    { role: "user", content: "start" },
    { role: "system", content: "late policy" },
  ] });

  assert.equal(result.changed, false);
  assert.equal(result.anomalies.some((item) => item.code === "system_message_out_of_order"), true);
});

test("strict provider sends the repaired projection while leaving loop history intact", async () => {
  const history = [
    { role: "assistant", tool_calls: [{ id: "call-1" }, { id: "call-2" }] },
    { role: "user", content: "intervened" },
    { role: "tool", tool_call_id: "call-1", content: "ok" },
  ];
  const requests = [];
  const loop = makeLoop({
    history,
    stream: async function* stream(request) {
      requests.push(request);
      yield { delta: "ok" };
    },
  });
  const originalBuildMessages = loop.buildMessages;
  const originalClient = loop.client;
  const receipt = { projections: [], recordProviderProjection(value) { this.projections.push(value); } };
  await collect(invokeLoopStepWithProviderProjection({
    activeLoop: loop,
    input: "go",
    providerCapabilities: { strictToolExchange: true },
    turnReceipt: receipt,
    requestId: "req-1",
    operationId: "op-1",
  }));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].messages.some((message) => message.visionoxUnknown === true), true);
  assert.deepEqual(history, [
    { role: "assistant", tool_calls: [{ id: "call-1" }, { id: "call-2" }] },
    { role: "user", content: "intervened" },
    { role: "tool", tool_call_id: "call-1", content: "ok" },
  ]);
  assert.equal(loop.buildMessages, originalBuildMessages);
  assert.equal(loop.client, originalClient);
  assert.equal(receipt.projections.some((item) => item.mode === "strict-outbound" && item.changed), true);
});

test("a tool protocol 400 gets one strict-copy retry", async () => {
  const requests = [];
  const history = [
    { role: "assistant", tool_calls: [{ id: "call-1" }] },
    { role: "user", content: "intervened" },
    { role: "tool", tool_call_id: "call-1", content: "ok" },
  ];
  const loop = makeLoop({
    history,
    stream: async function* stream(request) {
      requests.push(request);
      if (requests.length === 1) throw new Error("API 400: assistant tool_calls must be followed by corresponding tool messages");
      yield { delta: "repaired" };
    },
  });
  const receipt = { projections: [], recordProviderProjection(value) { this.projections.push(value); } };
  const events = await collect(invokeLoopStepWithProviderProjection({
    activeLoop: loop,
    input: "go",
    providerCapabilities: {},
    turnReceipt: receipt,
    requestId: "req-2",
    operationId: "op-2",
  }));
  assert.deepEqual(events, [{ delta: "repaired" }]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].messages, history);
  assert.deepEqual(requests[1].messages.map((message) => message.role), ["assistant", "tool", "user"]);
  assert.equal(receipt.projections.some((item) => item.mode === "tool-protocol-400-retry"), true);
});

for (const [name, error] of [
  ["ordinary 400", new Error("API 400: max_tokens is invalid")],
  ["authentication", Object.assign(new Error("unauthorized"), { statusCode: 401 })],
  ["rate limit", Object.assign(new Error("too many requests"), { statusCode: 429 })],
  ["network", new Error("fetch failed")],
]) {
  test(`does not retry ${name}`, async () => {
    let calls = 0;
    const loop = makeLoop({
      history: [{ role: "user", content: "go" }],
      stream: async function* stream() {
        calls += 1;
        throw error;
      },
    });
    await assert.rejects(
      () => collect(invokeLoopStepWithProviderProjection({ activeLoop: loop, input: "go" })),
      error,
    );
    assert.equal(calls, 1);
  });
}

test("does not retry after a stream has emitted output", async () => {
  let calls = 0;
  const loop = makeLoop({
    history: [{ role: "user", content: "go" }],
    stream: async function* stream() {
      calls += 1;
      yield { delta: "partial" };
      throw new Error("API 400: assistant tool_calls must be followed by corresponding tool messages");
    },
  });
  await assert.rejects(
    () => collect(invokeLoopStepWithProviderProjection({ activeLoop: loop, input: "go" })),
    /assistant tool_calls/,
  );
  assert.equal(calls, 1);
});

test("records repair failure and restores loop bindings", async () => {
  const history = [
    { role: "assistant", tool_calls: [{ id: "call-1" }] },
    { role: "user", content: "intervened" },
  ];
  const loop = makeLoop({
    history,
    stream: async function* stream() {
      throw new Error("API 400: assistant tool_calls must be followed by corresponding tool messages");
    },
  });
  const originalBuildMessages = loop.buildMessages;
  const originalClient = loop.client;
  const receipt = { projections: [], recordProviderProjection(value) { this.projections.push(value); } };
  await assert.rejects(
    () => collect(invokeLoopStepWithProviderProjection({ activeLoop: loop, input: "go", turnReceipt: receipt })),
    /assistant tool_calls/,
  );
  assert.equal(receipt.projections.some((item) => item.anomalies?.some((anomaly) => anomaly.code === "provider_request_repair_failed")), true);
  assert.equal(loop.buildMessages, originalBuildMessages);
  assert.equal(loop.client, originalClient);
});

test("retries a non-streaming chat request once and restores bindings on early iterator return", async () => {
  const history = [
    { role: "assistant", tool_calls: [{ id: "call-chat" }] },
    { role: "user", content: "intervened" },
    { role: "tool", tool_call_id: "call-chat", content: "ok" },
  ];
  const requests = [];
  const loop = makeLoop({
    history,
    chat: async (request) => {
      requests.push(request);
      if (requests.length === 1) throw new Error("API 400: assistant tool_calls must be followed by corresponding tool messages");
      return { content: "chat repaired" };
    },
  });
  const originalBuildMessages = loop.buildMessages;
  const originalClient = loop.client;
  const receipt = { projections: [], recordProviderProjection(value) { this.projections.push(value); } };
  const iterator = invokeLoopStepWithProviderProjection({ activeLoop: loop, input: "go", turnReceipt: receipt });
  await iterator.return();
  assert.equal(loop.buildMessages, originalBuildMessages);
  assert.equal(loop.client, originalClient);

  const secondLoop = makeLoop({ history, chat: async (request) => {
    requests.push(request);
    if (requests.length === 1) throw new Error("API 400: assistant tool_calls must be followed by corresponding tool messages");
    return { content: "chat repaired" };
  } });
  const events = await collect(invokeLoopStepWithProviderProjection({ activeLoop: secondLoop, input: "go", turnReceipt: receipt }));
  assert.deepEqual(events, [{ content: "chat repaired" }]);
  assert.equal(requests.at(-1).messages[1].role, "tool");
  assert.equal(receipt.projections.some((item) => item.mode === "tool-protocol-400-retry"), true);
});
