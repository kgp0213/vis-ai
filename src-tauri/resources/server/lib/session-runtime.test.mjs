import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { atomicWriteFile } from "./atomic-file.mjs";
import { createActiveSessionMetaStore } from "./active-session-meta.mjs";
import { createSessionRuntime } from "./session-runtime.mjs";

async function createHarness() {
  const root = await mkdtemp(join(tmpdir(), "visionox-session-runtime-"));
  const sessionsDir = join(root, "sessions");
  await mkdir(sessionsDir, { recursive: true });
  const activeSessionFile = join(root, "active-session.jsonl");
  const activeSessionMetaFile = join(root, "active-session.meta.json");
  const messages = [];
  let nextMessageId = 1;
  let conversationId = "conversation-1";
  let loopMessages = [];
  const loop = {
    model: "test-model",
    log: {
      toMessages: () => loopMessages,
      compactInPlace(entries) { loopMessages = entries; },
    },
    adoptHistory(entries) { loopMessages = entries; },
  };
  const metaStore = createActiveSessionMetaStore({ path: activeSessionMetaFile });
  const runtime = createSessionRuntime({
    activeSessionFile,
    activeSessionMetaFile,
    sessionsDir,
    metaStore,
    atomicWriteFile,
    getMessages: () => messages,
    clearMessages: () => { messages.length = 0; },
    pushMessage: (message) => messages.push(message),
    getNextMessageId: () => nextMessageId,
    setNextMessageId: (value) => { nextMessageId = value; },
    getLoop: () => loop,
    getConversationId: () => conversationId,
    getWorkspace: () => root,
    getMode: () => "general",
    modeSummary: () => ({ label: "通用", description: "test" }),
    getSessionMemories: () => [],
    getIndexRetrievalMode: () => "off",
    hasUserMessage: () => messages.some((message) => message.role === "user"),
  });
  return {
    root,
    activeSessionFile,
    activeSessionMetaFile,
    messages,
    loop,
    runtime,
    setLoopMessages(value) { loopMessages = value; },
    setConversationId(value) { conversationId = value; },
  };
}

test("session runtime appends and synchronizes model history", async () => {
  const harness = await createHarness();
  try {
    harness.runtime.appendMessage({ role: "user", text: "hello" });
    harness.runtime.appendMessage({ role: "assistant", text: "world", taskState: "completed" });
    await harness.runtime.close();
    const raw = await readFile(harness.activeSessionFile, "utf8");
    assert.equal(raw.split(/\r?\n/).filter(Boolean).length, 2);

    harness.setLoopMessages([
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" },
    ]);
    await harness.runtime.syncFromLoop();
    assert.equal((await readFile(harness.activeSessionFile, "utf8")).includes('"content":"world"'), true);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("session runtime repairs malformed JSONL and restores model/dashboard projections", async () => {
  const harness = await createHarness();
  try {
    await writeFile(harness.activeSessionFile, [
      JSON.stringify({ role: "user", content: "keep me" }),
      "{malformed",
      JSON.stringify({ role: "assistant", content: "answer", receipt: { completion: { ok: true } } }),
      "",
    ].join("\n"), "utf8");
    assert.equal(await harness.runtime.load(), true);
    assert.deepEqual(harness.messages.map((message) => message.text), ["keep me", "answer"]);
    assert.deepEqual(harness.loop.log.toMessages(), [
      { role: "user", content: "keep me" },
      { role: "assistant", content: "answer" },
    ]);
    const repaired = await readFile(harness.activeSessionFile, "utf8");
    assert.equal(repaired.includes("malformed"), false);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("session runtime finalizes only conversations containing a user message", async () => {
  const harness = await createHarness();
  try {
    harness.runtime.appendMessage({ role: "assistant", text: "welcome" });
    await harness.runtime.close();
    assert.equal(await harness.runtime.finalize(), null);

    harness.runtime.appendMessage({ role: "user", text: "persist this" });
    harness.messages.push({ role: "user", text: "persist this" });
    await harness.runtime.close();
    harness.setConversationId("conversation-2");
    const name = await harness.runtime.finalize();
    assert.match(name, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});
