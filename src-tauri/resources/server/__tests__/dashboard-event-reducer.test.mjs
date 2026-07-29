import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("../visionox-pkg/node_modules/typescript/lib/typescript.js");
const sourcePath = new URL("../visionox-pkg/dashboard/src/lib/event-reducer.ts", import.meta.url);
const contractVectors = JSON.parse(await readFile(new URL("../__fixtures__/execution-schema-vectors.json", import.meta.url), "utf8"));

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

test("accepts authoritative finalization after compatibility content and rejects a late downgrade", async () => {
  const { createDashboardEventGuard } = await loadReducer();
  const guard = createDashboardEventGuard();
  assert.equal(guard.accept({ kind: "assistant_final", id: "m-final", eventEpoch: "e", eventSeq: 1, eventId: "e:1", text: "done" }), true);
  assert.equal(guard.accept({ kind: "turn_finalized", id: "m-final", eventEpoch: "e", eventSeq: 2, eventId: "e:2", text: "done", executionState: "completed", goalState: "verified" }), true);
  assert.equal(guard.accept({ kind: "turn_finalized", id: "m-final", eventEpoch: "e", eventSeq: 3, eventId: "e:3", text: "done", executionState: "unknown", goalState: "unknown" }), false);
  assert.equal(guard.accept({ kind: "turn_finalized", id: "m-final", eventEpoch: "e", eventSeq: 4, eventId: "e:4", revision: "cleanup-warning", correction: true, text: "done", executionState: "completed", goalState: "verified", warnings: ["cleanup"] }), true);
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

test("Dashboard deltas keep the novel suffix of a matching overlap", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  let state = createDashboardReducerState();
  state = applyDashboardEvent(state, {
    kind: "assistant_delta", id: "m1", stepId: "step-1", attempt: 1,
    offset: 0, contentDelta: "abcd",
  }).state;
  const overlap = applyDashboardEvent(state, {
    kind: "assistant_delta", id: "m1", stepId: "step-1", attempt: 1,
    offset: 2, contentDelta: "cdef",
  });
  assert.equal(overlap.changed, true);
  assert.equal(overlap.resyncRequired, undefined);
  assert.equal(overlap.state.streamOffsets.m1.content, 6);
  assert.equal(overlap.state.streamOffsets.m1.contentText, "abcdef");

  const duplicate = applyDashboardEvent(overlap.state, {
    kind: "assistant_delta", id: "m1", stepId: "step-1", attempt: 1,
    offset: 0, contentDelta: "abcdef",
  });
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.duplicate, true);
});

test("Dashboard deltas resync instead of accepting a mismatched overlap", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  let state = createDashboardReducerState();
  state = applyDashboardEvent(state, {
    kind: "assistant_delta", id: "m1", stepId: "step-1", attempt: 1,
    offset: 0, contentDelta: "abcd",
  }).state;
  const divergent = applyDashboardEvent(state, {
    kind: "assistant_delta", id: "m1", stepId: "step-1", attempt: 1,
    offset: 2, contentDelta: "ZZef",
  });
  assert.equal(divergent.changed, false);
  assert.equal(divergent.resyncRequired, true);
  assert.equal(divergent.anomaly, "delta-gap");
  assert.equal(divergent.state.streamOffsets.m1.contentText, "abcd");
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

test("transport cursor requests canonical resync for a late event sequence before batching", async () => {
  const { observeDashboardEventCursor } = await loadReducer();
  const late = observeDashboardEventCursor({ epoch: "e", lastSeq: 2 }, {
    kind: "tool",
    eventEpoch: "e",
    eventSeq: 1,
    eventId: "e:1",
    toolCallId: "late-tool",
    status: "failed",
  });
  assert.equal(late.resyncRequired, true);
  assert.equal(late.anomaly, "event-out-of-order");
  assert.equal(late.cursor.lastSeq, 2);
});

test("transport cursor requests canonical resync for a conflicting same-sequence event", async () => {
  const { observeDashboardEventCursor } = await loadReducer();
  const result = observeDashboardEventCursor({ epoch: "epoch-conflict", lastSeq: 2 }, {
    kind: "status",
    eventEpoch: "epoch-conflict",
    eventSeq: 2,
    eventId: "epoch-conflict:2-other",
  });
  assert.equal(result.resyncRequired, true);
  assert.equal(result.anomaly, "event-sequence-conflict");
});

test("Dashboard reducer rejects late and conflicting sequenced events before projection", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  const seed = createDashboardReducerState({ epoch: "epoch-reducer", lastSeq: 2 });
  const late = applyDashboardEvent(seed, {
    kind: "status",
    eventEpoch: "epoch-reducer",
    eventSeq: 1,
    eventId: "epoch-reducer:1",
  });
  assert.equal(late.resyncRequired, true);
  assert.equal(late.anomaly, "event-out-of-order");
  const conflict = applyDashboardEvent(seed, {
    kind: "status",
    eventEpoch: "epoch-reducer",
    eventSeq: 2,
    eventId: "epoch-reducer:2-other",
  });
  assert.equal(conflict.resyncRequired, true);
  assert.equal(conflict.anomaly, "event-sequence-conflict");
});

test("hydrates the reducer from a complete session snapshot and continues after its cursor", async () => {
  const { applyDashboardEvent, createDashboardReducerStateFromSnapshot } = await loadReducer();
  let state = createDashboardReducerStateFromSnapshot({
    schemaVersion: 1,
    sessionId: "session-a",
    eventCursor: "epoch-a:7",
    messages: [{ id: "m1", role: "assistant", text: "done", taskState: "completed" }],
    tools: [{ id: "tool-1", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", state: "succeeded" }],
    interactions: [], attachments: [], artifacts: [], goals: [], todos: [], prompts: [],
  });
  assert.equal(state.epoch, "epoch-a");
  assert.equal(state.lastSeq, 7);
  assert.equal(state.messages.m1.taskState, "completed");
  assert.equal(Object.values(state.tools)[0].state, "succeeded");

  const next = applyDashboardEvent(state, {
    kind: "artifact-created",
    eventEpoch: "epoch-a",
    eventSeq: 8,
    eventId: "epoch-a:8",
    artifactId: "artifact-1",
    payload: { id: "artifact-1", path: "C:/work/report.md", verified: true },
  });
  assert.equal(next.resyncRequired, undefined);
  assert.equal(next.state.artifacts["artifact-1"].verified, true);
});

test("Dashboard reducer matches the shared cross-layer convergence vectors", async () => {
  const { applyDashboardEvent, createDashboardReducerState, mergeDashboardTextAtOffset } = await loadReducer();
  let state = createDashboardReducerState();
  for (const event of contractVectors.convergence.toolEvents) state = applyDashboardEvent(state, event).state;
  const tool = Object.values(state.tools)[0];
  assert.equal(tool.state, contractVectors.convergence.expectedToolState);
  assert.equal(state.anomalies.at(-1).type, contractVectors.convergence.expectedToolAnomaly);
  for (const vector of contractVectors.convergence.textOffsets) {
    assert.deepEqual(mergeDashboardTextAtOffset(vector.local, vector.offset, vector.chunk), vector.expected, vector.name);
  }
});

test("uses the canonical snapshot page boundary when durable messages shift the legacy page", async () => {
  const { mergeCanonicalMessagePage } = await loadReducer();
  const legacyPage = [
    { id: "m-1034", role: "user", text: "boundary" },
    { id: "m-1035", role: "assistant", text: "compatibility" },
  ];
  const snapshotPage = [
    { id: "m-1035", role: "assistant", text: "authoritative", taskState: "completed" },
    { id: "m-durable-only", role: "assistant", text: "durable terminal", taskState: "completed" },
  ];

  assert.deepEqual(mergeCanonicalMessagePage(legacyPage, snapshotPage), [
    { id: "m-1035", role: "assistant", text: "authoritative", taskState: "completed" },
    { id: "m-durable-only", role: "assistant", text: "durable terminal", taskState: "completed" },
  ]);
});

test("projects canonical page metadata and keeps fact-only tools on their matching page", async () => {
  const { projectDashboardMessagePage } = await loadReducer();
  const projected = projectDashboardMessagePage({
    messages: [
      { id: "m-1034", role: "assistant", text: "legacy boundary", turnId: "turn-old" },
      { id: "m-1035", role: "assistant", text: "legacy latest", turnId: "turn-current" },
    ],
    totalMessages: 1036,
    snapshot: {
      eventCursor: "epoch-a:9",
      messages: [
        { id: "m-1035", role: "assistant", text: "canonical latest", turnId: "turn-current" },
        { id: "m-durable-only", role: "assistant", text: "durable terminal", turnId: "turn-durable" },
      ],
      tools: [
        { id: "tool-old", toolCallId: "call-old", turnId: "turn-old", stepId: "step-1", state: "succeeded" },
        { id: "tool-current", toolCallId: "call-current", turnId: "turn-current", stepId: "step-1", state: "succeeded" },
        { id: "tool-durable", toolCallId: "call-durable", turnId: "turn-durable", stepId: "step-1", state: "succeeded" },
      ],
      messagePage: { totalMessages: 1037, startIndex: 1035, hasMore: true },
    },
  });

  assert.deepEqual(projected.messages.map((message) => message.id), ["m-1035", "m-durable-only"]);
  assert.equal(projected.messages[0].text, "canonical latest");
  assert.deepEqual(projected.tools.map((tool) => tool.id), ["tool-current", "tool-durable"]);
  assert.deepEqual(
    [projected.totalMessages, projected.startIndex, projected.loadedCount, projected.hasMore],
    [1037, 1035, 2, true],
  );
});

test("prepends canonical history pages without duplicating an overlapping boundary", async () => {
  const { mergeDashboardMessagePages } = await loadReducer();
  const current = [
    { id: "m-2", role: "assistant", text: "new authoritative", taskState: "completed" },
    { id: "m-3", role: "assistant", text: "latest" },
  ];
  const earlier = [
    { id: "m-1", role: "user", text: "first" },
    { id: "m-2", role: "assistant", text: "old boundary" },
  ];

  assert.deepEqual(mergeDashboardMessagePages(earlier, current), [
    { id: "m-1", role: "user", text: "first" },
    { id: "m-2", role: "assistant", text: "new authoritative", taskState: "completed" },
    { id: "m-3", role: "assistant", text: "latest" },
  ]);
});

test("deduplicates a restored tool row and canonical fact by Turn and call id", async () => {
  const { mergeDashboardMessagePages } = await loadReducer();
  const earlier = [{
    id: "restored-tool-123-1",
    role: "tool",
    toolCallId: "call-1",
    turnId: "turn-1",
    text: "legacy result",
  }];
  const current = [{
    id: "[\"turn-1\",\"step-1\",\"call-1\"]",
    role: "tool",
    toolCallId: "call-1",
    turnId: "turn-1",
    stepId: "step-1",
    text: "canonical result",
    toolStatus: "succeeded",
  }];

  assert.deepEqual(mergeDashboardMessagePages(earlier, current), current);
});

test("tracks the global SSE cursor across foreign sessions before reducing the active session", async () => {
  const {
    applyDashboardEvent,
    createDashboardEventCursor,
    createDashboardReducerState,
    observeDashboardEventCursor,
  } = await loadReducer();
  let cursor = createDashboardEventCursor("epoch-a:7");
  const foreign = observeDashboardEventCursor(cursor, {
    kind: "status",
    sessionId: "session-b",
    eventEpoch: "epoch-a",
    eventSeq: 8,
    eventId: "epoch-a:8",
  });
  assert.equal(foreign.resyncRequired, undefined);
  assert.equal(foreign.cursor.lastSeq, 8);
  cursor = foreign.cursor;

  const activeEvent = {
    kind: "user",
    sessionId: "session-a",
    eventEpoch: "epoch-a",
    eventSeq: 9,
    eventId: "epoch-a:9",
    id: "message-9",
    text: "still contiguous globally",
  };
  const active = observeDashboardEventCursor(cursor, activeEvent);
  assert.equal(active.resyncRequired, undefined);

  const projection = applyDashboardEvent(
    createDashboardReducerState({ epoch: cursor.epoch, lastSeq: cursor.lastSeq }),
    activeEvent,
  );
  assert.equal(projection.resyncRequired, undefined);
  assert.equal(projection.state.messages["message-9"].text, "still contiguous globally");
});

test("rejects malformed dashboard replay events and requests a canonical resync", async () => {
  const { createDashboardEventGuard, observeDashboardEventCursor, validateDashboardEventShape } = await loadReducer();
  assert.equal(validateDashboardEventShape({ kind: "user", eventSeq: 2 }).ok, false);
  const guard = createDashboardEventGuard();
  assert.equal(guard.accept({ kind: "user", eventSeq: 2 }), false);
  const observed = observeDashboardEventCursor({ epoch: "epoch-a", lastSeq: 1 }, { kind: "user", eventSeq: 2 });
  assert.equal(observed.resyncRequired, true);
  assert.equal(observed.anomaly, "invalid-event");
});

test("Dashboard rejects an unknown execution state before reducing the event", async () => {
  const { validateDashboardEventShape, createDashboardEventGuard } = await loadReducer();
  const event = {
    kind: "turn_finalized",
    eventEpoch: "epoch-a",
    eventSeq: 1,
    eventId: "epoch-a:1",
    id: "message-1",
    executionState: "finished-but-not-a-contract",
  };
  assert.equal(validateDashboardEventShape(event).ok, false);
  assert.equal(createDashboardEventGuard().accept(event), false);
});

test("Dashboard rejects malformed canonical snapshot entities", async () => {
  const {
    createDashboardReducerStateFromSnapshot,
    validateDashboardSessionSnapshotShape,
  } = await loadReducer();
  const snapshot = {
    schemaVersion: 1,
    sessionId: "session-1",
    messages: [{ id: "message-1", role: "assistant", executionState: "not-a-state" }],
  };
  assert.equal(validateDashboardSessionSnapshotShape(snapshot).ok, false);
  assert.throws(() => createDashboardReducerStateFromSnapshot(snapshot), /snapshot schema/u);
});

test("Dashboard schema matches the shared server transport vectors", async () => {
  const { validateDashboardEventShape } = await loadReducer();
  for (const vector of contractVectors.dashboardEvents) {
    assert.equal(validateDashboardEventShape(vector.event).ok, vector.ok, vector.name);
  }
});

test("replays events that arrived after the initial snapshot cursor", async () => {
  const {
    applyDashboardEvent,
    createDashboardReducerStateFromSnapshot,
    dashboardEventsAfterCursor,
  } = await loadReducer();
  let state = createDashboardReducerStateFromSnapshot({
    eventCursor: "epoch-a:5",
    messages: [{ id: "m-5", role: "assistant", text: "snapshot" }],
  });
  const buffered = [
    { kind: "warning", eventEpoch: "epoch-a", eventSeq: 5, eventId: "epoch-a:5-notice", id: "warning-5", text: "already represented by snapshot" },
    { kind: "user", eventEpoch: "epoch-a", eventSeq: 6, eventId: "epoch-a:6", id: "m-6", text: "arrived while loading" },
    { kind: "user", eventEpoch: "epoch-a", eventSeq: 6, eventId: "epoch-a:6", id: "m-6", text: "duplicate transport delivery" },
    { kind: "assistant_final", eventEpoch: "epoch-a", eventSeq: 7, eventId: "epoch-a:7", id: "m-7", text: "finished" },
  ];

  const replay = dashboardEventsAfterCursor(buffered, state);
  assert.deepEqual(replay.map((event) => event.eventId), ["epoch-a:6", "epoch-a:7"]);
  for (const event of replay) state = applyDashboardEvent(state, event).state;
  assert.equal(state.messages["warning-5"], undefined);
  assert.equal(state.messages["m-6"].text, "arrived while loading");
  assert.equal(state.messages["m-7"].text, "finished");
  assert.equal(state.lastSeq, 7);
});

test("canonical recovery discards buffered events from the previous process epoch", async () => {
  const { dashboardEventsAfterCursor } = await loadReducer();
  const replay = dashboardEventsAfterCursor([
    { kind: "warning", eventEpoch: "old-epoch", eventSeq: 99, eventId: "old-epoch:99", id: "stale", text: "stale process" },
    { kind: "user", eventEpoch: "new-epoch", eventSeq: 4, eventId: "new-epoch:4", id: "represented", text: "snapshot already has this" },
    { kind: "assistant_final", eventEpoch: "new-epoch", eventSeq: 5, eventId: "new-epoch:5", id: "fresh", text: "fresh event" },
  ], { epoch: "new-epoch", lastSeq: 4 });
  assert.deepEqual(replay.map((event) => event.eventId), ["new-epoch:5"]);
});

test("rejects a snapshot response after its Session or projection generation changes", async () => {
  const { dashboardSnapshotResponseIsCurrent } = await loadReducer();
  const base = {
    requestGeneration: 3,
    currentGeneration: 3,
    requestSessionId: "session-a",
    activeSessionId: "session-a",
    responseSessionId: "session-a",
  };

  assert.equal(dashboardSnapshotResponseIsCurrent(base), true);
  assert.equal(dashboardSnapshotResponseIsCurrent({ ...base, currentGeneration: 4 }), false);
  assert.equal(dashboardSnapshotResponseIsCurrent({ ...base, activeSessionId: "session-b" }), false);
  assert.equal(dashboardSnapshotResponseIsCurrent({ ...base, responseSessionId: "session-b" }), false);
  assert.equal(dashboardSnapshotResponseIsCurrent({
    requestGeneration: 1,
    currentGeneration: 1,
    requestSessionId: null,
    activeSessionId: null,
    responseSessionId: "session-a",
  }), true);
});

test("projects replayable notices into the durable message projection", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  const warning = applyDashboardEvent(createDashboardReducerState({ epoch: "epoch-a", lastSeq: 7 }), {
    kind: "warning",
    eventEpoch: "epoch-a",
    eventSeq: 8,
    eventId: "epoch-a:8",
    id: "warning-8",
    text: "结果需要用户复核",
  });

  assert.deepEqual(warning.state.messages["warning-8"], {
    id: "warning-8",
    role: "warning",
    text: "结果需要用户复核",
  });
  assert.equal(warning.state.lastSeq, 8);
});

test("messages reset replaces durable entities without discarding metadata or cursor", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  const state = createDashboardReducerState({ epoch: "epoch-a", lastSeq: 4 });
  const reset = applyDashboardEvent(state, {
    kind: "messages-reset",
    eventEpoch: "epoch-a",
    eventSeq: 5,
    eventId: "epoch-a:5",
    messages: [{ id: "m1", role: "assistant", text: "done", receipt: { ok: true }, attachments: [{ id: "att-1" }] }],
    tools: [{ id: "tool-1", state: "succeeded" }],
  });
  assert.equal(reset.state.lastSeq, 5);
  assert.deepEqual(reset.state.messages.m1.receipt, { ok: true });
  assert.deepEqual(reset.state.messages.m1.attachments, [{ id: "att-1" }]);
  assert.equal(reset.state.tools["tool-1"].state, "succeeded");
});

test("snapshot plus replay converges with a fresh durable snapshot", async () => {
  const { applyDashboardEvent, createDashboardReducerStateFromSnapshot } = await loadReducer();
  const taskContract = { contractVersion: 1, executionRequired: true };
  const evidenceRefs = [{ evidenceId: "artifact-1", type: "artifact", verified: true }];
  const initialSnapshot = {
    schemaVersion: 1,
    sessionId: "session-a",
    eventCursor: "epoch-a:1",
    messages: [{ id: "user-1", role: "user", text: "start" }],
    tools: [], interactions: [], attachments: [], artifacts: [], goals: [], todos: [], prompts: [],
    taskNotifications: [], plan: null, operation: { id: "op-1", state: "running" }, admission: null, busy: true,
  };
  const toolFrameId = JSON.stringify(["turn-1", "step-1", "call-1"]);
  const events = [
    { kind: "tool_start", eventEpoch: "epoch-a", eventSeq: 2, eventId: "epoch-a:2", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", status: "running" },
    { kind: "tool", eventEpoch: "epoch-a", eventSeq: 3, eventId: "epoch-a:3", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1", status: "succeeded", isError: false },
    { kind: "artifact-created", eventEpoch: "epoch-a", eventSeq: 4, eventId: "epoch-a:4", artifactId: "artifact-1", payload: { id: "artifact-1", path: "C:/work/report.md", verified: true } },
    { kind: "plan-activated", eventEpoch: "epoch-a", eventSeq: 5, eventId: "epoch-a:5", plan: { id: "plan-1", planId: "plan-1", status: "active", completedStepIds: [] } },
    { kind: "turn_finalized", eventEpoch: "epoch-a", eventSeq: 6, eventId: "epoch-a:6", id: "assistant-1", text: "done", executionState: "completed", goalState: "verified", taskState: "completed", taskContract, evidenceRefs, interventionChoice: "continue", receipt: { ok: true }, warnings: [] },
    { kind: "busy-change", eventEpoch: "epoch-a", eventSeq: 7, eventId: "epoch-a:7", busy: false },
  ];
  let replayed = createDashboardReducerStateFromSnapshot(initialSnapshot);
  for (const event of events) replayed = applyDashboardEvent(replayed, event).state;

  const finalSnapshot = {
    ...initialSnapshot,
    eventCursor: "epoch-a:7",
    messages: [
      initialSnapshot.messages[0],
      { id: "assistant-1", role: "assistant", text: "done", finalized: true, taskState: "completed", executionState: "completed", goalState: "verified", taskContract, evidenceRefs, interventionChoice: "continue", receipt: { ok: true }, warnings: [], artifactIncomplete: false },
    ],
    tools: [{ ...events[1], id: toolFrameId, state: "succeeded" }],
    artifacts: [{ id: "artifact-1", path: "C:/work/report.md", verified: true }],
    plan: events[3].plan,
    busy: false,
  };
  const refreshed = createDashboardReducerStateFromSnapshot(finalSnapshot);
  for (const key of ["messages", "tools", "artifacts", "plan", "operation", "busy"]) {
    assert.deepEqual(replayed[key], refreshed[key], `projection mismatch for ${key}`);
  }
});

test("artifact events project every identified file through the reducer", async () => {
  const { applyDashboardEvent, createDashboardReducerState } = await loadReducer();
  const result = applyDashboardEvent(createDashboardReducerState(), {
    kind: "artifact-created",
    files: [
      { id: "artifact-a", path: "C:/work/a.md", verified: true },
      { id: "artifact-b", path: "C:/work/b.md", verified: false },
    ],
  });
  assert.deepEqual(Object.keys(result.state.artifacts), ["artifact-a", "artifact-b"]);
  assert.equal(result.state.artifacts["artifact-b"].path, "C:/work/b.md");
});
