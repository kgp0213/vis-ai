import test from "node:test";
import assert from "node:assert/strict";

import { createHostToolBroker } from "./host-tool-broker.mjs";

function memoryIntentStore() {
  const intents = new Map();
  return {
    intents,
    async get(id) { return intents.get(id) ?? null; },
    async put(value) { intents.set(value.effectId, structuredClone(value)); return structuredClone(value); },
  };
}

test("broker rejects unknown operations and invalid arguments before dispatch", async () => {
  let calls = 0;
  const broker = createHostToolBroker({
    operations: {
      read_source: {
        validate: (args) => typeof args?.path === "string" && args.path ? true : "path is required",
        execute: async () => { calls += 1; return { ok: true }; },
      },
    },
  });
  await assert.rejects(() => broker.invoke("missing", {}, {}), /not registered/i);
  await assert.rejects(() => broker.invoke("read_source", {}, {}), /path is required/i);
  assert.equal(calls, 0);
});

test("broker reuses a confirmed side effect by stable idempotency key", async () => {
  const store = memoryIntentStore();
  let sends = 0;
  const broker = createHostToolBroker({
    effectStore: store,
    operations: {
      send_message: {
        effect: true,
        validate: (args) => typeof args?.text === "string" ? true : "text is required",
        execute: async (args, context) => {
          sends += 1;
          assert.equal(context.idempotencyKey, "task:1:unit:1:send");
          return { ok: true, messageId: "m-1" };
        },
      },
    },
  });
  const context = { taskId: "task:1", unitId: "unit:1", effectKey: "send" };
  const first = await broker.invoke("send_message", { text: "hello" }, context);
  const second = await broker.invoke("send_message", { text: "hello" }, context);
  assert.equal(sends, 1);
  assert.deepEqual(second, first);
  const intent = [...store.intents.values()][0];
  assert.equal(intent.state, "confirmed");
  assert.equal(intent.result.messageId, "m-1");
});

test("broker exposes unknown effect instead of replaying after uncertain dispatch", async () => {
  const store = memoryIntentStore();
  let sends = 0;
  const broker = createHostToolBroker({
    effectStore: store,
    operations: {
      send_message: {
        effect: true,
        execute: async () => {
          sends += 1;
          const error = new Error("connection closed after send");
          error.effectUnknown = true;
          throw error;
        },
      },
    },
  });
  const context = { taskId: "task:1", unitId: "unit:2", effectKey: "send" };
  await assert.rejects(() => broker.invoke("send_message", { text: "hello" }, context), /connection closed/);
  await assert.rejects(() => broker.invoke("send_message", { text: "hello" }, context), (error) => {
    assert.equal(error.code, "EFFECT_CONFIRMATION_REQUIRED");
    assert.equal(error.effect?.state, "unknown");
    return true;
  });
  assert.equal(sends, 1);
});

test("broker keeps a stable effect identity and rejects argument drift", async () => {
  const store = memoryIntentStore();
  let sends = 0;
  const broker = createHostToolBroker({
    effectStore: store,
    operations: {
      send_message: {
        effect: true,
        execute: async () => { sends += 1; return { ok: true }; },
      },
    },
  });
  const context = { taskId: "task:1", unitId: "unit:3", effectKey: "send" };
  await broker.invoke("send_message", { text: "first" }, context);
  await assert.rejects(() => broker.invoke("send_message", { text: "different" }, context), (error) => {
    assert.equal(error.code, "EFFECT_IDEMPOTENCY_CONFLICT");
    return true;
  });
  assert.equal(sends, 1);
  assert.equal(store.intents.size, 1);
});

test("broker treats an unclassified effect failure as unknown by default", async () => {
  const store = memoryIntentStore();
  let sends = 0;
  const broker = createHostToolBroker({
    effectStore: store,
    operations: {
      send_message: {
        effect: true,
        execute: async () => {
          sends += 1;
          throw new Error("connection closed");
        },
      },
    },
  });
  const context = { taskId: "task:1", unitId: "unit:4", effectKey: "send" };
  await assert.rejects(() => broker.invoke("send_message", { text: "hello" }, context), /connection closed/);
  await assert.rejects(() => broker.invoke("send_message", { text: "hello" }, context), (error) => {
    assert.equal(error.code, "EFFECT_CONFIRMATION_REQUIRED");
    return true;
  });
  assert.equal(sends, 1);
});

test("broker converts an interaction request into a durable user input result", async () => {
  const broker = createHostToolBroker({
    operations: {
      choose_output: {
        interaction: true,
        execute: async () => ({
          reason: "output-conflict",
          question: "请选择输出方式",
          choices: [{ id: "rename", label: "使用新文件名" }],
        }),
      },
    },
  });
  const result = await broker.invoke("choose_output", {}, { taskId: "task:2", unitId: "assemble" });
  assert.equal(result.kind, "user_input_request");
  assert.equal(result.taskId, "task:2");
  assert.equal(result.reason, "output-conflict");
  assert.match(result.requestId, /^request:/);
});
