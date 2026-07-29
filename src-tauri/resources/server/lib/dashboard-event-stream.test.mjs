import test from "node:test";
import assert from "node:assert/strict";

import { createDashboardEventStream } from "./dashboard-event-stream.mjs";

test("dashboard event stream sequences replayable events and omits transient deltas", () => {
  const stream = createDashboardEventStream({ epoch: "epoch-a", capacity: 3, now: () => new Date("2026-07-25T00:00:00.000Z") });

  const user = stream.publish({ kind: "user", id: "message-1", text: "hello" });
  const delta = stream.publish({ kind: "assistant_delta", id: "message-2", contentDelta: "partial" });
  const final = stream.publish({ kind: "assistant_final", id: "message-2", text: "done" });

  assert.equal(user.eventId, "epoch-a:1");
  assert.equal(user.schemaVersion, 1);
  assert.equal(user.entityId, "message-1");
  assert.equal(delta.eventId, undefined);
  assert.equal(final.eventId, "epoch-a:2");
  assert.deepEqual(stream.replay("epoch-a:1"), {
    ok: true,
    epoch: "epoch-a",
    events: [final],
    latestCursor: "epoch-a:2",
  });
});

test("rejects malformed replayable event cursor fields at the stream boundary", () => {
  const stream = createDashboardEventStream({ epoch: "epoch-schema" });
  assert.throws(
    () => stream.publish({ kind: "user", id: "message-1", eventSeq: 7, eventEpoch: "spoofed", eventId: "spoofed:7" }),
    /execution schema/u,
  );
});

test("dashboard event stream requires canonical resync for stale or foreign cursors", () => {
  const stream = createDashboardEventStream({ epoch: "epoch-b", capacity: 2 });
  stream.publish({ kind: "user", id: "one" });
  stream.publish({ kind: "assistant_final", id: "two" });
  stream.publish({ kind: "warning", id: "three" });

  assert.deepEqual(stream.replay("epoch-b:0"), {
    ok: false,
    reason: "cursor-too-old",
    epoch: "epoch-b",
    oldestCursor: "epoch-b:2",
    latestCursor: "epoch-b:3",
  });
  assert.equal(stream.replay("old-epoch:2").reason, "epoch-changed");
  assert.equal(stream.replay("invalid").reason, "invalid-cursor");
  assert.equal(stream.replay("epoch-b:99").reason, "cursor-ahead");
});

test("dashboard event stream sends a snapshot before subscribing without a race", () => {
  const stream = createDashboardEventStream({ epoch: "epoch-c" });
  const received = [];
  stream.publish({ kind: "user", id: "one" });
  const unsubscribe = stream.subscribe((event) => received.push(event), { cursor: "epoch-c:0" });
  stream.publish({ kind: "assistant_final", id: "two" });
  unsubscribe();

  assert.deepEqual(received.map((event) => event.id), ["one", "two"]);
});

test("dashboard event stream queues reentrant live events behind replay", () => {
  const stream = createDashboardEventStream({ epoch: "epoch-reentrant" });
  stream.publish({ kind: "user", id: "one" });
  stream.publish({ kind: "assistant_final", id: "two" });
  const received = [];
  let published = false;
  let queuedPublished = false;
  stream.subscribe((event) => {
    received.push(event.id ?? event.kind);
    if (!published && event.id === "one") {
      published = true;
      stream.publish({ kind: "warning", id: "three" });
    }
    if (!queuedPublished && event.id === "three") {
      queuedPublished = true;
      stream.publish({ kind: "warning", id: "four" });
    }
  }, { cursor: "epoch-reentrant:0" });

  assert.deepEqual(received, ["one", "two", "three", "four"]);
});

test("staged replayable events are invisible until their durable fact commits", () => {
  const stream = createDashboardEventStream({ epoch: "durable", capacity: 4 });
  const received = [];
  stream.subscribe((event) => received.push(event));
  const staged = stream.stage({ kind: "assistant_final", sessionId: "session-a", id: "m1", text: "pending" });
  assert.equal(received.length, 0);
  assert.equal(stream.replay("durable:0").events.length, 0);
  stream.commit(staged);
  assert.equal(received.length, 1);
  assert.equal(received[0].eventId, staged.eventId);
  assert.equal(stream.replay("durable:0").events[0].eventId, staged.eventId);
});

test("failed staged events consume their cursor as a canonical resync barrier", () => {
  const stream = createDashboardEventStream({ epoch: "durable-failure", capacity: 4 });
  const received = [];
  stream.subscribe((event) => received.push(event));
  const staged = stream.stage({ kind: "tool", sessionId: "session-a", id: "call-1", status: "succeeded" });
  stream.abort(staged, "fact-write-failed");
  assert.equal(received[0].kind, "resync-required");
  assert.equal(received[0].eventId, staged.eventId);
  assert.equal(stream.latestCursor(), "durable-failure:1");
});
