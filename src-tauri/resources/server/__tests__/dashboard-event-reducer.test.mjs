import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("../visionox-pkg/node_modules/typescript/lib/typescript.js");
const sourcePath = new URL("../visionox-pkg/dashboard/src/lib/event-reducer.ts", import.meta.url);

let reducerPromise;
async function loadReducer() {
  if (!reducerPromise) {
    reducerPromise = readFile(sourcePath, "utf8").then((source) => {
      const output = typescript.transpileModule(source, {
        compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
        fileName: "event-reducer.ts",
      }).outputText;
      return import(`data:text/javascript;base64,${Buffer.from(output, "utf8").toString("base64")}`);
    });
  }
  return reducerPromise;
}

test("coalesces only contiguous assistant deltas and preserves barriers", async () => {
  const { createDashboardEventBatcher } = await loadReducer();
  const batches = [];
  const batcher = createDashboardEventBatcher({ onFlush: (events) => batches.push(events), delayMs: 60_000 });

  batcher.enqueue({ kind: "assistant_delta", id: "m1", sessionId: "s1", turnId: "t1", eventEpoch: "e", eventSeq: 1, eventId: "e:1", offset: 0, contentDelta: "ab" });
  batcher.enqueue({ kind: "assistant_delta", id: "m1", sessionId: "s1", turnId: "t1", eventEpoch: "e", eventSeq: 2, eventId: "e:2", offset: 2, contentDelta: "cd" });
  batcher.enqueue({ kind: "tool_start", toolCallId: "call-1", sessionId: "s1", turnId: "t1", eventEpoch: "e", eventSeq: 3, eventId: "e:3" });
  batcher.enqueue({ kind: "assistant_delta", id: "m1", sessionId: "s1", turnId: "t1", eventEpoch: "e", eventSeq: 4, eventId: "e:4", offset: 4, contentDelta: "ef" });
  batcher.flush();

  assert.equal(batches.length, 3);
  assert.deepEqual(batches[0].map((event) => event.contentDelta), ["abcd"]);
  assert.equal(batches[0][0].offset, 0);
  assert.equal(batches[0][0].eventSeq, 2);
  assert.equal(batches[0][0].eventId, "e:2");
  assert.deepEqual(batches[0][0].coalescedEventIds, ["e:1"]);
  assert.equal(batches[1][0].kind, "tool_start");
  assert.deepEqual(batches[2].map((event) => event.contentDelta), ["ef"]);
  batcher.dispose();
});

test("does not merge gaps or cross sessions, slices oversized deltas, and can discard queued events", async () => {
  const { createDashboardEventBatcher } = await loadReducer();
  const batches = [];
  const batcher = createDashboardEventBatcher({ onFlush: (events) => batches.push(events), maxChars: 4, delayMs: 60_000 });

  const discardBatcher = createDashboardEventBatcher({ onFlush: (events) => batches.push(events), delayMs: 60_000 });
  discardBatcher.enqueue({ kind: "assistant_delta", id: "m1", sessionId: "s1", offset: 0, contentDelta: "queued" });
  discardBatcher.discard();
  discardBatcher.flush();
  assert.deepEqual(batches, []);
  discardBatcher.dispose();

  batcher.enqueue({ kind: "assistant_delta", id: "m1", sessionId: "s1", offset: 0, contentDelta: "abcdef" });
  batcher.enqueue({ kind: "assistant_delta", id: "m1", sessionId: "s1", offset: 9, contentDelta: "gap" });
  batcher.enqueue({ kind: "assistant_delta", id: "m1", sessionId: "s2", offset: 3, contentDelta: "other" });
  batcher.flush();
  const sliced = batches.slice(0).flat();
  assert.deepEqual(sliced.slice(0, 2).map((event) => event.contentDelta), ["abcd", "ef"]);
  assert.deepEqual(sliced.slice(0, 2).map((event) => event.offset), [0, 4]);
  assert.equal(sliced.some((event) => event.sessionId === "s2"), true);
  batcher.dispose();
});

test("split replayable deltas get distinct event ids", async () => {
  const { createDashboardEventBatcher } = await loadReducer();
  const batches = [];
  const batcher = createDashboardEventBatcher({ onFlush: (events) => batches.push(events), maxChars: 3, delayMs: 60_000 });
  batcher.enqueue({ kind: "assistant_delta", id: "m1", eventId: "e:1", offset: 0, contentDelta: "abcdef" });
  batcher.flush();
  const events = batches.flat();
  assert.equal(events.length, 2);
  assert.notEqual(events[0].eventId, events[1].eventId);
  assert.deepEqual(events.map((event) => event.contentDelta), ["abc", "def"]);
  batcher.dispose();
});

test("todo and prompt snapshots are idempotent and remove stale entities", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  let state = createDashboardReducerState();
  const first = applyDashboardEvent(state, {
    eventId: "todo-1",
    kind: "todo-update",
    todos: [{ id: "todo-a", title: "A", status: "active" }],
  });
  state = first.state;
  assert.equal(first.changed, true);
  const repeated = applyDashboardEvent(state, {
    eventId: "todo-2",
    kind: "todo-update",
    todos: [{ id: "todo-a", title: "A", status: "active" }],
  });
  state = repeated.state;
  assert.equal(repeated.changed, false);
  const removed = applyDashboardEvent(state, {
    eventId: "todo-3",
    kind: "todo-update",
    todos: [],
  });
  assert.equal(removed.changed, true);
  assert.deepEqual(removed.state.todos, {});

  const prompt = applyDashboardEvent(removed.state, {
    eventId: "prompt-1",
    kind: "prompt-update",
    prompts: [{ id: "prompt-a", status: "queued" }],
  });
  const promptRepeat = applyDashboardEvent(prompt.state, {
    eventId: "prompt-2",
    kind: "prompt-update",
    prompts: [{ id: "prompt-a", status: "queued" }],
  });
  assert.equal(prompt.changed, true);
  assert.equal(promptRepeat.changed, false);
});

test("rejects out-of-order assistant corrections while allowing a newer revision", async () => {
  const { createDashboardEventGuard } = await loadReducer();
  const guard = createDashboardEventGuard();
  assert.equal(guard.accept({ kind: "assistant_final", id: "m1", eventEpoch: "e", eventSeq: 10, eventId: "e:10", text: "new", taskState: "completed" }), true);
  assert.equal(guard.accept({ kind: "assistant_final", id: "m1", eventEpoch: "e", eventSeq: 9, eventId: "e:9", correction: true, revision: "artifact-rescan", text: "old" }), false);
  assert.equal(guard.accept({ kind: "assistant_final", id: "m1", eventEpoch: "e", eventSeq: 11, eventId: "e:11", correction: true, revision: "finalization-persistence", text: "newer" }), true);
});

test("scopes terminal tool protection to the turn and step", async () => {
  const { createDashboardEventGuard } = await loadReducer();
  const guard = createDashboardEventGuard();
  assert.equal(guard.accept({ kind: "tool", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", status: "succeeded", eventId: "e:1" }), true);
  // Reusing a provider call id in a new execution frame must be accepted.
  assert.equal(guard.accept({ kind: "tool_start", toolCallId: "call-1", turnId: "turn-2", stepId: "step-2", status: "running", eventId: "e:2" }), true);
  assert.equal(guard.accept({ kind: "tool", toolCallId: "call-1", turnId: "turn-2", stepId: "step-2", status: "succeeded", eventId: "e:3" }), true);
  assert.equal(guard.accept({ kind: "tool", toolCallId: "call-1", turnId: "turn-2", stepId: "step-2", status: "failed", eventId: "e:4" }), false);
});

test("allows an explicit failed-to-recovered retry chain but blocks late updates after success", async () => {
  const { createDashboardEventGuard } = await loadReducer();
  const guard = createDashboardEventGuard();
  const frame = { toolCallId: "call-retry", turnId: "turn-1", stepId: "step-1" };
  assert.equal(guard.accept({ kind: "tool", ...frame, status: "failed", eventId: "e:r1" }), true);
  assert.equal(guard.accept({ kind: "tool_start", ...frame, status: "running", eventId: "e:r2" }), true);
  assert.equal(guard.accept({ kind: "tool", ...frame, status: "recovered", eventId: "e:r3" }), true);
  assert.equal(guard.accept({ kind: "tool", ...frame, status: "succeeded", eventId: "e:r4" }), true);
  assert.equal(guard.accept({ kind: "tool", ...frame, status: "failed", eventId: "e:r5" }), false);
});

test("reducer reopens only failed tools for an explicit recovery chain", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  const frame = { kind: "tool", toolCallId: "call-retry", turnId: "turn-1", stepId: "step-1" };
  const frameId = JSON.stringify(["turn-1", "step-1", "call-retry"]);
  let state = createDashboardReducerState();

  for (const status of ["failed", "running", "recovered", "succeeded"]) {
    const reduced = applyDashboardEvent(state, { ...frame, status });
    assert.equal(reduced.changed, true, `${status} should update the existing tool frame`);
    assert.equal(reduced.state.tools[frameId].id, frameId);
    assert.equal(reduced.state.tools[frameId].state, status);
    state = reduced.state;
  }

  const lateFailure = applyDashboardEvent(state, { ...frame, status: "failed" });
  assert.equal(lateFailure.changed, false);
  assert.equal(lateFailure.anomaly, "late-terminal-update");
  assert.equal(lateFailure.state.tools[frameId].state, "succeeded");

  const nextTurn = applyDashboardEvent(state, { ...frame, turnId: "turn-2", status: "running" });
  assert.equal(nextTurn.changed, true);
  assert.equal(nextTurn.state.tools[frameId].state, "succeeded");
  assert.equal(nextTurn.state.tools[JSON.stringify(["turn-2", "step-1", "call-retry"])].state, "running");
});

test("does not collide when tool frame ids contain the reducer separator", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  let state = createDashboardReducerState();
  state = applyDashboardEvent(state, {
    kind: "tool", toolCallId: "call", turnId: "a:b", stepId: "c", status: "succeeded",
  }).state;
  const next = applyDashboardEvent(state, {
    kind: "tool", toolCallId: "call", turnId: "a", stepId: "b:c", status: "running",
  });

  assert.equal(next.changed, true);
  assert.equal(next.anomaly, undefined);
  assert.equal(Object.keys(next.state.tools).length, 2);
});

test("tracks assistant delta offsets, drops duplicates, and requests resync for gaps", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  let state = createDashboardReducerState();
  const first = applyDashboardEvent(state, {
    kind: "assistant_delta",
    id: "m1",
    stepId: "step-1",
    attempt: 1,
    offset: 0,
    contentDelta: "ab",
  });
  state = first.state;
  assert.equal(first.changed, true);
  const duplicate = applyDashboardEvent(state, {
    kind: "assistant_delta",
    id: "m1",
    stepId: "step-1",
    attempt: 1,
    offset: 0,
    contentDelta: "ab",
  });
  assert.equal(duplicate.duplicate, true);
  const gap = applyDashboardEvent(state, {
    kind: "assistant_delta",
    id: "m1",
    stepId: "step-1",
    attempt: 1,
    offset: 4,
    contentDelta: "x",
  });
  assert.equal(gap.resyncRequired, true);
  const retry = applyDashboardEvent(state, {
    kind: "assistant_delta",
    id: "m1",
    stepId: "step-2",
    attempt: 2,
    streamReset: true,
    offset: 0,
    contentDelta: "new",
  });
  assert.equal(retry.changed, true);
  assert.equal(retry.state.streamOffsets.m1.content, 3);
});

test("late delta from an older attempt cannot rewind the stream", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  let state = createDashboardReducerState();
  state = applyDashboardEvent(state, {
    kind: "assistant_delta", id: "m1", attempt: 1, streamId: "step-1", streamReset: true,
    offset: 0, contentDelta: "good",
  }).state;
  state = applyDashboardEvent(state, {
    kind: "assistant_delta", id: "m1", attempt: 2, streamId: "step-2", streamReset: true,
    offset: 0, contentDelta: "final",
  }).state;
  const stale = applyDashboardEvent(state, {
    kind: "assistant_delta", id: "m1", attempt: 1, streamId: "step-1",
    offset: 0, contentDelta: "stale",
  });
  assert.equal(stale.duplicate, true);
  assert.equal(stale.state.streamOffsets.m1.attempt, 2);
  assert.equal(stale.state.streamOffsets.m1.content, 5);
});

test("requests canonical resync for an event sequence gap but accepts a contiguous coalesced batch", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  const initial = createDashboardReducerState({ epoch: "e" });
  const missing = applyDashboardEvent(initial, { kind: "status", eventEpoch: "e", eventSeq: 3, eventId: "e:3", text: "late" });
  assert.equal(missing.resyncRequired, true);
  assert.equal(missing.state.lastSeq, 3);
  const contiguous = applyDashboardEvent(initial, {
    kind: "status",
    eventEpoch: "e",
    eventSeq: 2,
    eventId: "e:2",
    coalescedEventIds: ["e:1"],
    text: "merged",
  });
  assert.equal(contiguous.resyncRequired, undefined);
  assert.equal(contiguous.state.lastSeq, 2);
});
