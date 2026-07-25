import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { atomicWriteFile } from "./atomic-file.mjs";
import { createActiveSessionMetaStore } from "./active-session-meta.mjs";
import { createSessionRuntime } from "./session-runtime.mjs";

async function createHarness(options = {}) {
  const root = await mkdtemp(join(tmpdir(), "visionox-session-runtime-"));
  const sessionsDir = join(root, "sessions");
  await mkdir(sessionsDir, { recursive: true });
  const activeSessionFile = join(root, "active-session.jsonl");
  const activeSessionMetaFile = join(root, "active-session.meta.json");
  const messages = [];
  let nextMessageId = 1;
  let conversationId = "conversation-1";
  let todos = [];
  let goals = [];
  let prompts = [];
  let loopMessages = [];
  const issues = [];
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
    getTodos: () => todos,
    getGoals: () => goals,
    getPrompts: () => prompts,
    getIndexRetrievalMode: () => "off",
    hasUserMessage: () => messages.some((message) => message.role === "user"),
    materializeAttachments: options.materializeAttachments,
    migrateLegacyAttachments: options.migrateLegacyAttachments,
    onPersistentIssue: (...args) => issues.push(args),
  });
  return {
    root,
    activeSessionFile,
    activeSessionMetaFile,
    messages,
    issues,
    loop,
    runtime,
    setLoopMessages(value) { loopMessages = value; },
    setConversationId(value) { conversationId = value; },
    setTodos(value) { todos = value; },
    setGoals(value) { goals = value; },
    setPrompts(value) { prompts = value; },
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

test("session runtime preserves final receipt facts across model-history synchronization", async () => {
  const harness = await createHarness();
  try {
    harness.runtime.appendMessage({ role: "user", text: "finish this", id: "user-1" });
    harness.setLoopMessages([
      { role: "user", content: "finish this" },
      { role: "assistant", content: "completed output" },
    ]);
    await harness.runtime.syncFromLoop();
    const receipt = { completion: { ok: true, taskState: "completed" }, artifactEvidence: [{ paths: ["C:/out.md"], verified: true }] };
    assert.equal(await harness.runtime.persistTurnFinalization({
      modelEntries: harness.loop.log.toMessages(),
      pendingUser: { text: "finish this" },
      assistant: { messageId: "assistant-1", turnId: "turn-1", text: "completed output" },
      operationId: "op-1",
      receipt,
      taskState: "completed",
      artifactEvidence: receipt.artifactEvidence,
    }), true);

    await harness.runtime.syncFromLoop();
    const entries = (await readFile(harness.activeSessionFile, "utf8"))
      .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const assistant = entries.find((entry) => entry.role === "assistant");
    assert.equal(assistant.id, "assistant-1");
    assert.equal(assistant.turnId, "turn-1");
    assert.equal(assistant.operationId, "op-1");
    assert.deepEqual(assistant.receipt, receipt);
    assert.equal(assistant.taskState, "completed");
    assert.deepEqual(assistant.artifactEvidence, receipt.artifactEvidence);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("session runtime stores empty-text terminal facts without a visible blank assistant", async () => {
  const harness = await createHarness();
  try {
    harness.setLoopMessages([{ role: "user", content: "run the command" }]);
    assert.equal(await harness.runtime.persistTurnFinalization({
      modelEntries: harness.loop.log.toMessages(),
      pendingUser: { text: "run the command" },
      assistant: { messageId: "assistant-empty", turnId: "turn-empty", text: "" },
      operationId: "op-empty",
      receipt: { completion: { ok: false, taskState: "unknown" } },
      taskState: "unknown",
      warnings: ["执行结果无法确认"],
    }), true);

    const entries = (await readFile(harness.activeSessionFile, "utf8"))
      .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    assert.equal(entries.some((entry) => entry.role === "assistant" && entry.id === "assistant-empty"), false);
    const fact = entries.find((entry) => entry.role === "execution");
    assert.equal(fact.operationId, "op-empty");
    assert.equal(fact.messageId, "assistant-empty");
    assert.equal(fact.taskState, "unknown");

    await harness.runtime.syncFromLoop();
    const afterSync = (await readFile(harness.activeSessionFile, "utf8"))
      .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    assert.equal(afterSync.filter((entry) => entry.role === "execution").length, 1);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("session runtime serializes append and metadata writes", async () => {
  const harness = await createHarness();
  try {
    for (let index = 0; index < 40; index++) {
      harness.runtime.appendMessage({ role: index === 0 ? "user" : "assistant", text: `message-${index}` });
      if (index % 4 === 0) void harness.runtime.writeMeta({ messageCount: index + 1 });
    }
    await harness.runtime.writeMeta({ messageCount: 40 });
    await harness.runtime.close();
    const lines = (await readFile(harness.activeSessionFile, "utf8")).split(/\r?\n/).filter(Boolean);
    assert.equal(lines.length, 40);
    assert.equal(JSON.parse(lines[39]).content, "message-39");
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("session runtime persists and restores todo state through metadata", async () => {
  const harness = await createHarness();
  let restoredTodos = null;
  try {
    harness.setTodos([{ id: "todo-1", content: "verify output", activeForm: "Verifying output", status: "in_progress" }]);
    harness.runtime.appendMessage({ role: "user", text: "track this" });
    await harness.runtime.close();
    await harness.runtime.writeMeta({});
    const rawMeta = JSON.parse(await readFile(harness.activeSessionMetaFile, "utf8"));
    assert.deepEqual(rawMeta.todos, [{ id: "todo-1", content: "verify output", activeForm: "Verifying output", status: "in_progress" }]);

    const resumed = await createHarness();
    restoredTodos = resumed;
    await writeFile(resumed.activeSessionFile, `${JSON.stringify({ role: "user", content: "track this" })}\n`, "utf8");
    const metadata = JSON.parse(await readFile(harness.activeSessionMetaFile, "utf8"));
    const applied = [];
    resumed.runtime = createSessionRuntime({
      activeSessionFile: resumed.activeSessionFile,
      activeSessionMetaFile: resumed.activeSessionMetaFile,
      sessionsDir: join(resumed.root, "sessions"),
      metaStore: createActiveSessionMetaStore({ path: resumed.activeSessionMetaFile }),
      atomicWriteFile,
      getMessages: () => resumed.messages,
      clearMessages: () => { resumed.messages.length = 0; },
      pushMessage: (message) => resumed.messages.push(message),
      getNextMessageId: () => 1,
      setNextMessageId: () => {},
      getLoop: () => resumed.loop,
      getConversationId: () => "conversation-1",
      getWorkspace: () => resumed.root,
      getMode: () => "general",
      modeSummary: () => ({ label: "通用", description: "test" }),
      getSessionMemories: () => [],
      getIndexRetrievalMode: () => "off",
      applyLoadedMetadata: (meta) => applied.push(meta.todos),
      hasUserMessage: () => true,
    });
    await writeFile(resumed.activeSessionMetaFile, JSON.stringify(metadata), "utf8");
    assert.equal(await resumed.runtime.load(), true);
    assert.deepEqual(applied[0], rawMeta.todos);
  } finally {
    if (restoredTodos) await rm(restoredTodos.root, { recursive: true, force: true });
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("session runtime persists redacted goal and prompt entities", async () => {
  const harness = await createHarness();
  try {
    harness.setGoals([{ id: "goal-1", title: "交付", status: "active" }]);
    harness.setPrompts([{ id: "prompt-1", operationId: "op-1", sessionId: "conversation-1", instruction: "secret", instructionLength: 6, status: "queued" }]);
    harness.runtime.appendMessage({ role: "user", text: "persist entities" });
    await harness.runtime.writeMeta({});
    const rawMeta = JSON.parse(await readFile(harness.activeSessionMetaFile, "utf8"));
    assert.deepEqual(rawMeta.goals, [{ id: "goal-1", title: "交付", status: "active" }]);
    assert.equal(rawMeta.prompts[0].instruction, undefined);
    assert.equal(rawMeta.prompts[0].instructionLength, 6);
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

test("session runtime restores attachment previews and reports missing blobs", async () => {
  const harness = await createHarness({
    materializeAttachments: async () => ({ images: [], warnings: ["附件 att-missing 不可用"] }),
  });
  try {
    await writeFile(harness.activeSessionFile, `${JSON.stringify({
      role: "user",
      content: "inspect this",
      attachments: [{ id: "att-missing", kind: "image", mimeType: "image/png" }],
    })}\n`, "utf8");

    assert.equal(await harness.runtime.load(), true);
    assert.deepEqual(harness.messages[0].attachments, [{ id: "att-missing", kind: "image", mimeType: "image/png" }]);
    assert.deepEqual(harness.messages[0].warnings, ["附件 att-missing 不可用"]);
    assert.ok(harness.issues.some(([kind, message, level]) => kind === "active-session-attachments" && /att-missing/.test(message) && level === "warning"));
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});

test("session runtime persists legacy image migration before restoring history", async () => {
  const attachment = { id: "att-migrated", kind: "image", mimeType: "image/png" };
  const harness = await createHarness({
    migrateLegacyAttachments: async (entries) => ({
      entries: entries.map((entry) => ({ role: entry.role, content: "inspect", attachments: [attachment] })),
      migrated: 1,
      errors: [],
    }),
    materializeAttachments: async () => ({ images: ["data:image/png;base64,AAAA"], warnings: [] }),
  });
  try {
    await writeFile(harness.activeSessionFile, `${JSON.stringify({ role: "user", content: "legacy", images: ["data:image/png;base64,AAAA"] })}\n`, "utf8");
    assert.equal(await harness.runtime.load(), true);
    const persisted = await readFile(harness.activeSessionFile, "utf8");
    assert.doesNotMatch(persisted, /base64/);
    assert.match(persisted, /att-migrated/);
    assert.deepEqual(harness.messages[0].images, ["data:image/png;base64,AAAA"]);
  } finally {
    await rm(harness.root, { recursive: true, force: true });
  }
});
