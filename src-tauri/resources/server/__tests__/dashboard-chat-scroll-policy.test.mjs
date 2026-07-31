import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("../visionox-pkg/node_modules/typescript/lib/typescript.js");

async function loadScrollPolicy() {
  const source = await readFile(new URL("../visionox-pkg/dashboard/src/lib/chat-scroll-policy.ts", import.meta.url), "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
    fileName: "chat-scroll-policy.ts",
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output, "utf8").toString("base64")}`);
}

test("user scrolling owns the feed until they explicitly return to the bottom", async () => {
  const { createChatScrollState, reduceChatScrollState } = await loadScrollPolicy();
  let state = createChatScrollState();

  let reduced = reduceChatScrollState(state, { type: "content-growth", added: 1 });
  assert.equal(reduced.effect, "pin-bottom");
  assert.equal(reduced.state.owner, "auto");

  state = reduceChatScrollState(reduced.state, { type: "user-scroll-up" }).state;
  reduced = reduceChatScrollState(state, { type: "content-growth", added: 3 });
  assert.equal(reduced.effect, "none");
  assert.equal(reduced.state.owner, "user");
  assert.equal(reduced.state.newBelowCount, 3);

  reduced = reduceChatScrollState(reduced.state, { type: "user-reached-bottom" });
  assert.equal(reduced.effect, "pin-bottom");
  assert.equal(reduced.state.owner, "auto");
  assert.equal(reduced.state.newBelowCount, 0);
});

test("history anchors and message jumps do not silently rearm automatic following", async () => {
  const { createChatScrollState, reduceChatScrollState } = await loadScrollPolicy();
  let state = reduceChatScrollState(createChatScrollState(), { type: "user-scroll-up" }).state;

  state = reduceChatScrollState(state, { type: "anchor-start" }).state;
  assert.equal(state.owner, "anchor");
  let reduced = reduceChatScrollState(state, { type: "content-growth", added: 2 });
  assert.equal(reduced.effect, "none");
  state = reduceChatScrollState(reduced.state, { type: "anchor-end" }).state;
  assert.equal(state.owner, "user");
  assert.equal(state.newBelowCount, 2);

  state = reduceChatScrollState(state, { type: "jump-start" }).state;
  assert.equal(state.owner, "jump");
  state = reduceChatScrollState(state, { type: "jump-end", atBottom: false }).state;
  assert.equal(state.owner, "user");
  assert.equal(state.newBelowCount, 2);

  reduced = reduceChatScrollState(state, { type: "jump-start" });
  state = reduceChatScrollState(reduced.state, { type: "jump-end", atBottom: true }).state;
  assert.equal(state.owner, "auto");
  assert.equal(state.newBelowCount, 0);
});

test("the frame scheduler coalesces repeated pin requests into one scroll write", async () => {
  const { createFrameScheduler } = await loadScrollPolicy();
  const callbacks = new Map();
  let nextId = 1;
  let writes = 0;
  const scheduler = createFrameScheduler({
    requestFrame(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      callbacks.delete(id);
    },
    run() {
      writes += 1;
    },
  });

  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();
  assert.equal(callbacks.size, 1);
  callbacks.values().next().value();
  assert.equal(writes, 1);
  assert.equal(callbacks.size, 0);

  scheduler.schedule();
  scheduler.cancel();
  assert.equal(callbacks.size, 0);
  assert.equal(writes, 1);
});
