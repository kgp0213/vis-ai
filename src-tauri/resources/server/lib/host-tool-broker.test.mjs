import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createFileEffectStore, createHostToolBroker } from "./host-tool-broker.mjs";
import { createOperationPolicy } from "./operation-policy.mjs";

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

test("broker does not confirm an explicit unsuccessful result and retries only retry-safe failures", async () => {
  const store = memoryIntentStore();
  let calls = 0;
  const broker = createHostToolBroker({
    effectStore: store,
    operations: {
      send_message: {
        effect: true,
        execute: async () => {
          calls += 1;
          return calls === 1
            ? { ok: false, retrySafe: true, error: "temporary refusal" }
            : { ok: true, messageId: "m-recovered" };
        },
      },
    },
  });
  const context = { taskId: "task:result", unitId: "unit:1", effectKey: "send" };
  const first = await broker.invoke("send_message", { text: "hello" }, context);
  assert.equal(first.ok, false);
  assert.equal([...store.intents.values()][0].state, "prepared");
  const second = await broker.invoke("send_message", { text: "hello" }, context);
  assert.deepEqual(second, { ok: true, messageId: "m-recovered" });
  assert.equal(calls, 2);
  assert.equal([...store.intents.values()][0].state, "confirmed");
});

test("broker requires confirmation after an ambiguous unsuccessful result", async () => {
  const store = memoryIntentStore();
  let calls = 0;
  const broker = createHostToolBroker({
    effectStore: store,
    operations: {
      send_message: {
        effect: true,
        execute: async () => {
          calls += 1;
          return { ok: false, error: "request timed out", meta: { timeout: true } };
        },
      },
    },
  });
  const context = { taskId: "task:result", unitId: "unit:2", effectKey: "send" };
  const first = await broker.invoke("send_message", { text: "hello" }, context);
  assert.equal(first.ok, false);
  assert.equal([...store.intents.values()][0].state, "unknown");
  await assert.rejects(() => broker.invoke("send_message", { text: "hello" }, context), (error) => error.code === "EFFECT_CONFIRMATION_REQUIRED");
  assert.equal(calls, 1);
});

test("broker coalesces concurrent calls before the durable ledger finishes loading", async () => {
  const store = memoryIntentStore();
  let sends = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const broker = createHostToolBroker({
    effectStore: store,
    operations: {
      send_message: {
        effect: true,
        execute: async () => {
          sends += 1;
          await gate;
          return { ok: true, messageId: "m-concurrent" };
        },
      },
    },
  });
  const context = { taskId: "task:concurrent", unitId: "unit:1", effectKey: "send" };
  const first = broker.invoke("send_message", { text: "hello" }, context);
  const second = broker.invoke("send_message", { text: "hello" }, context);
  await new Promise((resolve) => setImmediate(resolve));
  release();
  const results = await Promise.all([first, second]);
  assert.equal(sends, 1);
  assert.deepEqual(results[0], results[1]);
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

test("broker reuses an operation-scoped approval without prompting twice", async () => {
  const policy = createOperationPolicy();
  let prompts = 0;
  let executions = 0;
  const broker = createHostToolBroker({
    operationPolicy: policy,
    authorize: async () => { prompts += 1; return true; },
    operations: {
      send_message: { effect: false, requiresApproval: true, execute: async () => { executions += 1; return { ok: true }; } },
    },
  });
  const context = { operationId: "op-approval", sessionId: "s", workspace: "w" };
  await broker.invoke("send_message", { to: "self", text: "hello" }, context);
  await broker.invoke("send_message", { to: "self", text: "hello" }, context);
  assert.equal(prompts, 1);
  assert.equal(executions, 2);
});

test("file effect store survives restart and keeps the recovery ledger bounded to facts", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-effect-ledger-"));
  const path = join(root, "effects.json");
  try {
    const first = createFileEffectStore({ path });
    await first.put({
      effectId: "effect:1",
      state: "unknown",
      idempotencyKey: "raw-key-should-not-be-used-by-callers",
      argsHash: "hash-1",
      error: { code: "NETWORK", message: "connection closed" },
    });
    await first.flush();
    const second = createFileEffectStore({ path });
    const restored = await second.get("effect:1");
    assert.equal(restored.state, "unknown");
    assert.equal(restored.argsHash, "hash-1");
    assert.equal(restored.error.code, "NETWORK");
    assert.equal(restored.idempotencyKey, undefined);
    assert.match(await readFile(path, "utf8"), /"version": 1/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("file effect store bounds persisted results while retaining the effect fact", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-effect-ledger-bounded-"));
  const path = join(root, "effects.json");
  try {
    const store = createFileEffectStore({ path });
    const broker = createHostToolBroker({
      effectStore: store,
      operations: {
        send_message: {
          effect: true,
          execute: async () => ({ ok: true, messageId: "m-large", output: "x".repeat(100_000) }),
        },
      },
    });
    const context = { taskId: "task:large", unitId: "unit:1", effectKey: "send" };
    const result = await broker.invoke("send_message", { text: "hello" }, context);
    assert.equal(result.output.length, 100_000);
    await store.flush();
    const raw = await readFile(path, "utf8");
    assert.ok(Buffer.byteLength(raw, "utf8") < 30_000);
    const stored = (await store.list())[0];
    assert.equal(stored.state, "confirmed");
    assert.equal(stored.result.messageId, "m-large");
    assert.equal(stored.result.truncated, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("corrupt file effect ledgers are backed up and fail closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-effect-ledger-corrupt-"));
  const path = join(root, "effects.json");
  try {
    await (await import("node:fs/promises")).writeFile(path, "{not-json", "utf8");
    const store = createFileEffectStore({ path });
    await assert.rejects(() => store.get("effect:missing"), (error) => error.code === "EFFECT_LEDGER_UNAVAILABLE");
    const files = await (await import("node:fs/promises")).readdir(root);
    assert.equal(files.some((name) => name.startsWith("effects.json.corrupt-")), true);
    let sends = 0;
    const broker = createHostToolBroker({
      effectStore: store,
      operations: { send_message: { effect: true, execute: async () => { sends += 1; return { ok: true }; } } },
    });
    await assert.rejects(() => broker.invoke("send_message", { text: "hello" }, { taskId: "t", unitId: "u", effectKey: "send" }), (error) => {
      assert.equal(error.code, "EFFECT_LEDGER_UNAVAILABLE");
      return true;
    });
    assert.equal(sends, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("file effect store bounds oversized legacy results while loading", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-effect-ledger-legacy-bounded-"));
  const path = join(root, "effects.json");
  try {
    const entries = Array.from({ length: 80 }, (_, index) => [`key-${index}`, "x".repeat(2_000)]);
    await (await import("node:fs/promises")).writeFile(
      path,
      JSON.stringify({ version: 1, effects: [{ effectId: "effect:legacy", state: "confirmed", result: Object.fromEntries(entries) }] }),
      "utf8",
    );
    const store = createFileEffectStore({ path });
    const value = await store.get("effect:legacy");
    assert.ok(Buffer.byteLength(JSON.stringify(value.result), "utf8") <= 16 * 1024);
    assert.equal(value.result.truncated, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
