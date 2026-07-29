import assert from "node:assert/strict";
import test from "node:test";

import { createAgentSessionRuntime } from "./agent-session-runtime.mjs";

function input(id, overrides = {}) {
  return {
    schemaVersion: 1,
    inputId: id,
    requestId: `request:${id}`,
    sessionId: "session-a",
    workspace: "C:/work",
    text: id,
    attachments: [],
    delivery: "queue",
    origin: { kind: "user" },
    ...overrides,
  };
}

test("agent session runtime starts an idle turn and drains queued inputs in order", async () => {
  const started = [];
  const completions = new Map();
  const runtime = createAgentSessionRuntime({
    getActiveBinding: () => ({ sessionId: "session-a", workspace: "C:/work" }),
    executeTurn: async (entry, controls) => {
      started.push(entry.inputId);
      completions.set(entry.inputId, controls.complete);
      return { accepted: true, turnId: `turn:${entry.inputId}` };
    },
  });

  assert.equal((await runtime.submit(input("one"))).accepted, true);
  assert.equal((await runtime.submit(input("two"))).queued, true);
  assert.deepEqual(started, ["one"]);
  completions.get("one")({ ok: true, taskState: "completed" });
  await runtime.waitForIdle("session-a", { allowQueued: true });
  assert.deepEqual(started, ["one", "two"]);
  completions.get("two")({ ok: true, taskState: "completed" });
  await runtime.waitForIdle("session-a");
  assert.equal(runtime.snapshot("session-a").busy, false);
});

test("agent session runtime buffers inactive-session work and never crosses workspace scope", async () => {
  let binding = { sessionId: "session-a", workspace: "C:/work" };
  const started = [];
  const runtime = createAgentSessionRuntime({
    getActiveBinding: () => binding,
    executeTurn: async (entry, controls) => {
      started.push(entry.inputId);
      controls.complete({ ok: true, taskState: "completed" });
      return { accepted: true };
    },
  });

  const pending = await runtime.submit(input("background", {
    sessionId: "session-b",
    origin: { kind: "background_task", taskId: "bg-1", status: "completed", notificationId: "task:bg-1:completed" },
  }));
  assert.equal(pending.pendingActivation, true);
  assert.deepEqual(started, []);

  binding = { sessionId: "session-b", workspace: "D:/other" };
  assert.equal((await runtime.activate()).scopeMismatch, true);
  assert.deepEqual(started, []);

  binding = { sessionId: "session-b", workspace: "C:/work" };
  assert.equal((await runtime.activate()).accepted, true);
  await runtime.waitForIdle("session-b");
  assert.deepEqual(started, ["background"]);
});

test("agent session runtime deduplicates stable input ids and steers an active turn", async () => {
  const steered = [];
  let complete;
  const runtime = createAgentSessionRuntime({
    getActiveBinding: () => ({ sessionId: "session-a", workspace: "C:/work" }),
    executeTurn: async (_entry, controls) => {
      complete = controls.complete;
      return { accepted: true };
    },
    steerTurn: async (entry) => {
      steered.push(entry.inputId);
      return { accepted: true };
    },
  });

  await runtime.submit(input("one"));
  const firstSteer = await runtime.submit(input("follow", { delivery: "steer", origin: { kind: "system_trigger", name: "follow-up" } }));
  const duplicate = await runtime.submit(input("follow", { delivery: "steer", origin: { kind: "system_trigger", name: "follow-up" } }));
  assert.equal(firstSteer.steered, true);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(steered, ["follow"]);
  complete({ ok: true, taskState: "completed" });
  await runtime.waitForIdle("session-a");
});

test("agent session runtime bounds completed input dedupe without evicting pending ids", async () => {
  const started = [];
  const runtime = createAgentSessionRuntime({
    maxRecentInputIds: 2,
    getActiveBinding: () => ({ sessionId: "session-a", workspace: "C:/work" }),
    executeTurn: async (entry, controls) => {
      started.push(entry.inputId);
      controls.complete({ ok: true, taskState: "completed" });
      return { accepted: true };
    },
  });

  await runtime.submit(input("one"));
  await runtime.submit(input("two"));
  await runtime.submit(input("three"));
  assert.equal((await runtime.submit(input("three"))).duplicate, true);
  assert.equal((await runtime.submit(input("one"))).duplicate, undefined);
  assert.deepEqual(started, ["one", "two", "three", "one"]);
});

test("agent session runtime reports a full session inbox without remembering the rejected id", async () => {
  let complete;
  const runtime = createAgentSessionRuntime({
    maxQueuedPerSession: 1,
    getActiveBinding: () => ({ sessionId: "session-a", workspace: "C:/work" }),
    executeTurn: async (_entry, controls) => {
      complete = controls.complete;
      return { accepted: true };
    },
  });

  await runtime.submit(input("active"));
  assert.equal((await runtime.submit(input("queued"))).queued, true);
  const rejected = await runtime.submit(input("retryable"));
  assert.deepEqual(rejected, { accepted: false, queueFull: true, queued: 1 });
  assert.deepEqual(await runtime.submit(input("retryable")), rejected);
  complete({ ok: true, taskState: "completed" });
});

test("active-turn queue inputs are delegated to durable admission instead of the in-memory inbox", async () => {
  let complete;
  const deferred = [];
  const runtime = createAgentSessionRuntime({
    getActiveBinding: () => ({ sessionId: "session-a", workspace: "C:/work" }),
    executeTurn: async (_entry, controls) => {
      complete = controls.complete;
      return { accepted: true };
    },
    steerTurn: async (entry) => {
      deferred.push(entry.inputId);
      return { accepted: true, queued: true, status: "admitted" };
    },
  });

  await runtime.submit(input("active"));
  const queued = await runtime.submit(input("durable-queue"));
  assert.equal(queued.durablyQueued, true);
  assert.equal(runtime.snapshot("session-a").queued, 0);
  assert.deepEqual(deferred, ["durable-queue"]);
  complete({ ok: true, taskState: "completed" });
});

test("an input rejected before acceptance can retry with the same stable id", async () => {
  let attempts = 0;
  const runtime = createAgentSessionRuntime({
    getActiveBinding: () => ({ sessionId: "session-a", workspace: "C:/work" }),
    executeTurn: async (_entry, controls) => {
      attempts += 1;
      controls.complete({ ok: false, taskState: "failed" });
      return { accepted: false, reason: "provider unavailable" };
    },
  });

  assert.equal((await runtime.submit(input("retry-after-rejection"))).accepted, false);
  assert.equal((await runtime.submit(input("retry-after-rejection"))).accepted, false);
  assert.equal(attempts, 2);
});
