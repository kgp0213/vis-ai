import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("../visionox-pkg/node_modules/typescript/lib/typescript.js");

async function loadTimeline() {
  const source = await readFile(new URL("../visionox-pkg/dashboard/src/lib/chat-timeline.ts", import.meta.url), "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
    fileName: "chat-timeline.ts",
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output, "utf8").toString("base64")}`);
}

function roles(projection) {
  return projection.frames.map((frame) => frame.message.role);
}

test("keeps assistant explanation, tool execution and follow-up in event order", async () => {
  const { projectChatTimeline } = await loadTimeline();
  const projection = projectChatTimeline([
    { id: "answer-before", role: "assistant", text: "I will inspect it.", turnId: "turn-1", eventEpoch: "epoch-1", eventSeq: 10 },
    { id: "answer-after", role: "assistant", text: "Inspection complete.", turnId: "turn-1", eventEpoch: "epoch-1", eventSeq: 30 },
  ], [
    { id: "tool-1", toolCallId: "call-1", role: "tool", text: "ok", turnId: "turn-1", stepId: "step-1", eventEpoch: "epoch-1", eventSeq: 20 },
  ]);

  assert.deepEqual(roles(projection), ["assistant", "tool", "assistant"]);
  assert.deepEqual(projection.frames.map((frame) => frame.message.id), ["answer-before", "tool-1", "answer-after"]);
});

test("creates a new assistant segment at every tool boundary", async () => {
  const { projectChatTimeline } = await loadTimeline();
  const projection = projectChatTimeline([
    { id: "a-1", role: "assistant", text: "First", turnId: "turn-1", eventEpoch: "epoch-1", eventSeq: 1 },
    { id: "a-2", role: "assistant", text: "Second", turnId: "turn-1", eventEpoch: "epoch-1", eventSeq: 3 },
    { id: "a-3", role: "assistant", text: "Third", turnId: "turn-1", eventEpoch: "epoch-1", eventSeq: 5 },
  ], [
    { id: "t-1", role: "tool", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", eventEpoch: "epoch-1", eventSeq: 2 },
    { id: "t-2", role: "tool", toolCallId: "call-2", turnId: "turn-1", stepId: "step-2", eventEpoch: "epoch-1", eventSeq: 4 },
  ]);

  assert.deepEqual(projection.frames.map((frame) => frame.segmentId), [
    "turn-1:assistant:1",
    "turn-1:tool:1",
    "turn-1:assistant:2",
    "turn-1:tool:2",
    "turn-1:assistant:3",
  ]);
  assert.equal(projection.turns.length, 1);
  assert.deepEqual(projection.turns[0].frames.map((frame) => frame.message.id), ["a-1", "t-1", "a-2", "t-2", "a-3"]);
});

test("filters empty assistant tool-call rows but keeps meaningful receipts", async () => {
  const { projectChatTimeline } = await loadTimeline();
  const projection = projectChatTimeline([
    { id: "empty", role: "assistant", text: "  ", turnId: "turn-1", eventSeq: 1, eventEpoch: "epoch-1" },
    { id: "receipt", role: "assistant", text: "", receipt: { state: "completed" }, turnId: "turn-1", eventSeq: 3, eventEpoch: "epoch-1" },
    { id: "warning", role: "assistant", warnings: ["Needs review"], turnId: "turn-1", eventSeq: 4, eventEpoch: "epoch-1" },
  ], [
    { id: "tool", role: "tool", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", eventSeq: 2, eventEpoch: "epoch-1" },
  ]);

  assert.deepEqual(projection.frames.map((frame) => frame.message.id), ["tool", "receipt", "warning"]);
});

test("projects equivalent live and snapshot inputs to the same timeline", async () => {
  const { projectChatTimeline } = await loadTimeline();
  const assistantBefore = { id: "a-1", role: "assistant", text: "Before", turnId: "turn-1", eventEpoch: "epoch-1", eventSeq: 1 };
  const tool = { id: "t-1", role: "tool", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", eventEpoch: "epoch-1", eventSeq: 2, status: "succeeded", content: "ok" };
  const assistantAfter = { id: "a-2", role: "assistant", text: "After", turnId: "turn-1", eventEpoch: "epoch-1", eventSeq: 3 };

  const live = projectChatTimeline([assistantBefore, tool, assistantAfter]);
  const snapshot = projectChatTimeline([assistantBefore, assistantAfter], [tool]);

  assert.deepEqual(snapshot.frames, live.frames);
  assert.deepEqual(snapshot.turns, live.turns);
});

test("preserves source order for legacy records without eventSeq", async () => {
  const { projectChatTimeline } = await loadTimeline();
  const projection = projectChatTimeline([
    { id: "user", role: "user", text: "Run", createdAt: 300 },
    { id: "assistant", role: "assistant", text: "Working", createdAt: 100 },
    { id: "tool", role: "tool", toolCallId: "call-1", text: "ok", createdAt: 200 },
  ]);

  assert.deepEqual(projection.frames.map((frame) => frame.message.id), ["user", "assistant", "tool"]);
});

test("updates tool retries in place without moving their first timeline position", async () => {
  const { projectChatTimeline } = await loadTimeline();
  const projection = projectChatTimeline([
    { id: "a-1", role: "assistant", text: "Before", turnId: "turn-1", eventEpoch: "epoch-1", eventSeq: 1 },
    { id: "tool-failed", role: "tool", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", toolStatus: "failed", text: "failed", eventEpoch: "epoch-1", eventSeq: 2 },
    { id: "a-2", role: "assistant", text: "After", turnId: "turn-1", eventEpoch: "epoch-1", eventSeq: 4 },
  ], [
    { id: "tool-retry", role: "tool", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", status: "recovered", content: "recovered", eventEpoch: "epoch-1", eventSeq: 3 },
  ]);

  assert.deepEqual(projection.frames.map((frame) => frame.message.id), ["a-1", "tool-retry", "a-2"]);
  assert.equal(projection.frames[1].message.toolStatus, "recovered");
  assert.equal(projection.frames[1].message.text, "recovered");
  assert.equal(projection.frames[1].eventSeq, 2);
});

test("keeps streaming segments on both sides of a tool boundary independent", async () => {
  const { projectChatTimeline } = await loadTimeline();
  const projection = projectChatTimeline([], [
    { id: "tool", role: "tool", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", eventEpoch: "epoch-1", eventSeq: 20 },
  ], [
    { messageId: "answer", role: "assistant", text: "Before tool", turnId: "turn-1", segmentId: "answer:segment:1", eventEpoch: "epoch-1", startEventSeq: 10 },
    { messageId: "answer", role: "assistant", text: "After tool", turnId: "turn-1", segmentId: "answer:segment:2", eventEpoch: "epoch-1", startEventSeq: 30 },
  ]);

  assert.deepEqual(projection.frames.map((frame) => frame.segmentId), ["answer:segment:1", "turn-1:tool:1", "answer:segment:2"]);
  assert.deepEqual(projection.frames.map((frame) => frame.startEventSeq), [10, 20, 30]);
  assert.deepEqual(projection.frames.map((frame) => frame.message.text), ["Before tool", "", "After tool"]);
  assert.equal(projection.frames[0].streaming, true);
  assert.equal(projection.frames[2].streaming, true);
});

test("replaces only the final streaming segment when the assistant final arrives", async () => {
  const { projectChatTimeline } = await loadTimeline();
  const projection = projectChatTimeline([
    { id: "answer", role: "assistant", text: "Final follow-up", turnId: "turn-1", eventEpoch: "epoch-1", eventSeq: 40, finalized: true },
  ], [
    { id: "tool", role: "tool", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", eventEpoch: "epoch-1", eventSeq: 20 },
  ], [
    { messageId: "answer", role: "assistant", text: "Before tool", turnId: "turn-1", segmentId: "answer:segment:1", eventEpoch: "epoch-1", startEventSeq: 10 },
    { messageId: "answer", role: "assistant", text: "Partial follow-up", turnId: "turn-1", segmentId: "answer:segment:2", eventEpoch: "epoch-1", startEventSeq: 30 },
  ]);

  assert.deepEqual(projection.frames.map((frame) => frame.message.text), ["Before tool", "", "Final follow-up"]);
  assert.deepEqual(projection.frames.map((frame) => frame.segmentId), ["answer:segment:1", "turn-1:tool:1", "answer:segment:2"]);
  assert.deepEqual(projection.frames.map((frame) => frame.startEventSeq), [10, 20, 30]);
  assert.equal(projection.frames.length, 3);
  assert.equal(projection.frames.filter((frame) => frame.message.text === "Final follow-up").length, 1);
  assert.equal(projection.frames.some((frame) => frame.startEventSeq === 40), false);
  assert.equal(projection.frames[2].streaming, false);
  assert.equal(projection.frames[2].message.finalized, true);
});

test("does not mutate live, snapshot or streaming inputs", async () => {
  const { projectChatTimeline } = await loadTimeline();
  const messages = [{ id: "a", role: "assistant", text: "answer", turnId: "turn-1", eventEpoch: "epoch-1", eventSeq: 1 }];
  const tools = [{ id: "t", role: "tool", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", status: "running", eventEpoch: "epoch-1", eventSeq: 2 }];
  const streams = [{ messageId: "a", role: "assistant", text: "partial", turnId: "turn-1", segmentId: "a:segment:1", eventEpoch: "epoch-1", startEventSeq: 1 }];
  const before = JSON.stringify({ messages, tools, streams });
  projectChatTimeline(messages, tools, streams);
  assert.equal(JSON.stringify({ messages, tools, streams }), before);
});

test("does not treat ordinary assistant text as an authoritative final receipt", async () => {
  const { assistantHasAuthoritativeFinalEvidence } = await loadTimeline();
  assert.equal(assistantHasAuthoritativeFinalEvidence({ text: "The tool is done." }), false);
  assert.equal(assistantHasAuthoritativeFinalEvidence({ text: "Done", finalized: true }), true);
  assert.equal(assistantHasAuthoritativeFinalEvidence({ text: "Done", receipt: {} }), true);
  assert.equal(assistantHasAuthoritativeFinalEvidence({ text: "Done", taskState: "completed" }), true);
  assert.equal(assistantHasAuthoritativeFinalEvidence({ text: "Done", executionState: "failed" }), true);
  assert.equal(assistantHasAuthoritativeFinalEvidence({ text: "Done", goalState: "verified" }), true);
});

test("keeps a frozen pre-tool segment when the final receipt arrives after the tool", async () => {
  const { projectChatTimeline } = await loadTimeline();
  const projection = projectChatTimeline([
    { id: "answer:segment:1", messageId: "answer", assistantMessageId: "answer", role: "assistant", text: "Before", turnId: "turn-1", segmentId: "answer:segment:1", eventSeq: 10, eventEpoch: "epoch-1" },
    { id: "tool", role: "tool", toolCallId: "call-1", stepId: "step-1", turnId: "turn-1", eventSeq: 20, eventEpoch: "epoch-1", toolStatus: "succeeded" },
    { id: "answer", role: "assistant", text: "After", turnId: "turn-1", segmentId: "answer:segment:2", eventSeq: 30, eventEpoch: "epoch-1", finalized: true, receipt: { completion: { ok: true } } },
  ]);

  assert.deepEqual(projection.frames.map((frame) => frame.message.text), ["Before", "", "After"]);
  assert.deepEqual(projection.frames.map((frame) => frame.segmentId), ["answer:segment:1", "turn-1:tool:1", "answer:segment:2"]);
});

test("coalesces an early content-final row with the frozen row at the next tool boundary", async () => {
  const { projectChatTimeline } = await loadTimeline();
  const projection = projectChatTimeline([
    { id: "answer", role: "assistant", text: "Before", turnId: "turn-1", segmentId: "answer:segment:1", eventSeq: 10, eventEpoch: "epoch-1" },
    { id: "tool", role: "tool", toolCallId: "call-1", stepId: "step-1", turnId: "turn-1", eventSeq: 20, eventEpoch: "epoch-1", toolStatus: "running" },
    { id: "answer:answer:segment:1", messageId: "answer", assistantMessageId: "answer", role: "assistant", text: "Before", turnId: "turn-1", segmentId: "answer:segment:1", eventSeq: 10, eventEpoch: "epoch-1", finalized: true },
  ]);

  assert.deepEqual(projection.frames.map((frame) => frame.message.role), ["assistant", "tool"]);
  assert.deepEqual(projection.frames.map((frame) => frame.message.text), ["Before", ""]);
  assert.equal(projection.frames[0].message.finalized, true);
});
