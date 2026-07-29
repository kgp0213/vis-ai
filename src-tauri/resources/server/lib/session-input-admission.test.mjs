import assert from "node:assert/strict";
import test from "node:test";

import { createSessionInputAdmission } from "./session-input-admission.mjs";

function ids() {
  let value = 0;
  return () => `test-${++value}`;
}

test("admits input idempotently and rejects id reuse with different content", () => {
  const runtime = createSessionInputAdmission({ idFactory: ids(), now: () => "2026-07-26T00:00:00.000Z" });
  const first = runtime.admit({ id: "input-1", sessionId: "session-1", operationId: "op-1", text: "继续检查", delivery: "steer" });
  assert.equal(first.ok, true);
  const duplicate = runtime.admit({ id: "input-1", sessionId: "session-1", operationId: "op-1", text: "继续检查", delivery: "steer" });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  const conflict = runtime.admit({ id: "input-1", sessionId: "session-1", operationId: "op-1", text: "换一个任务", delivery: "steer" });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "SESSION_INPUT_CONFLICT");
});

test("steer inputs promote in FIFO order only at the matching session boundary", () => {
  const events = [];
  const runtime = createSessionInputAdmission({ idFactory: ids(), onEvent: (event) => events.push(event) });
  runtime.admit({ id: "s-1", sessionId: "session-1", operationId: "op-1", workspace: "C:/work", text: "追加证据", delivery: "steer" });
  runtime.admit({ id: "s-2", sessionId: "session-1", operationId: "op-1", workspace: "C:/work", text: "再验证一次", delivery: "steer" });
  assert.deepEqual(runtime.promoteSteers("session-1", { operationId: "op-other", workspace: "C:/work" }), []);
  const promoted = runtime.promoteSteers("session-1", { operationId: "op-1", workspace: "C:/work" });
  assert.deepEqual(promoted.map((entry) => entry.id), ["s-1", "s-2"]);
  assert.equal(promoted.every((entry) => entry.status === "promoted"), true);
  assert.equal(events.every((event) => event.input.text === undefined), true);
});

test("queue promotion is one-at-a-time and may cross operation boundaries only in one workspace", () => {
  const runtime = createSessionInputAdmission({ idFactory: ids() });
  runtime.admit({ id: "q-1", sessionId: "session-1", operationId: "op-old", workspace: "C:/work", text: "第一项", delivery: "queue" });
  runtime.admit({ id: "q-2", sessionId: "session-1", operationId: "op-old", workspace: "C:/work", text: "第二项", delivery: "queue" });
  const first = runtime.promoteNextQueue("session-1", { operationId: "op-new", workspace: "C:/work" });
  assert.equal(first.id, "q-1");
  const second = runtime.promoteNextQueue("session-1", { operationId: "op-new", workspace: "C:/work" });
  assert.equal(second.id, "q-2");
  runtime.admit({ id: "q-3", sessionId: "session-1", operationId: "op-new", workspace: "C:/other", text: "不应跨工作区", delivery: "queue" });
  assert.equal(runtime.promoteNextQueue("session-1", { operationId: "op-new", workspace: "C:/work" }), null);
});

test("closing an operation interrupts only its steer inputs and cancellation is idempotent", () => {
  const runtime = createSessionInputAdmission({ idFactory: ids() });
  runtime.admit({ id: "s-1", sessionId: "session-1", operationId: "op-1", text: "中断我", delivery: "steer" });
  runtime.admit({ id: "q-1", sessionId: "session-1", operationId: "op-1", text: "保留排队", delivery: "queue" });
  const changed = runtime.closeOperation("op-1", { reason: "cancelled" });
  assert.deepEqual(changed.map((entry) => entry.id), ["s-1"]);
  assert.equal(runtime.resolve("s-1", "cancelled", "late cancel").input.status, "interrupted");
  assert.equal(runtime.list("session-1", { includeTerminal: false }).map((entry) => entry.id).join(","), "q-1");
});

test("closing an operation publishes interruption only after persistence succeeds", () => {
  const events = [];
  let fail = false;
  const runtime = createSessionInputAdmission({
    onChange: () => { if (fail) throw new Error("metadata unavailable"); },
    onEvent: (event) => events.push(event),
  });
  runtime.admit({ id: "s-1", sessionId: "session-1", operationId: "op-1", text: "保留事实", delivery: "steer" });
  events.length = 0;
  fail = true;
  assert.deepEqual(runtime.closeOperation("op-1", { reason: "cancelled" }), []);
  assert.equal(runtime.list("session-1")[0].status, "admitted");
  assert.deepEqual(events, []);

  fail = false;
  const changed = runtime.closeOperation("op-1", { reason: "cancelled" });
  assert.equal(changed[0].status, "interrupted");
  assert.equal(events.filter((event) => event.kind === "session-input-resolved").length, 1);
});

test("a normally finished operation converts an undelivered steer into a durable next-turn queue input", () => {
  const events = [];
  const runtime = createSessionInputAdmission({ onEvent: (event) => events.push(event) });
  runtime.admit({ id: "s-late", sessionId: "session-1", operationId: "op-1", text: "交付后台结果", delivery: "steer" });

  const changed = runtime.closeOperation("op-1", {
    reason: "operation_completed",
    requeueUndelivered: true,
  });

  assert.equal(changed[0].status, "admitted");
  assert.equal(changed[0].delivery, "queue");
  assert.equal(changed[0].operationId, null);
  assert.equal(runtime.list("session-1", { includeTerminal: false })[0].id, "s-late");
  assert.equal(events.at(-1).kind, "session-input-requeued");
});

test("restart recovery requeues inputs stranded at promoted or dispatching boundaries", () => {
  const persisted = [];
  const initial = [
      {
        id: "steer-promoted",
        sessionId: "session-1",
        operationId: "op-dead",
        workspace: "C:/work",
        text: "continue after the background task",
        delivery: "steer",
        status: "promoted",
        admittedSeq: 1,
        promotedSeq: 2,
      },
      {
        id: "queue-dispatching",
        sessionId: "session-1",
        operationId: "op-dead",
        workspace: "C:/work",
        requestId: "request-queue",
        text: "queued user follow-up",
        delivery: "queue",
        status: "dispatching",
        dispatchToken: "dispatch-dead",
        admittedSeq: 3,
        promotedSeq: 4,
      },
      {
        id: "already-dispatched",
        sessionId: "session-1",
        workspace: "C:/work",
        text: "completed admission",
        delivery: "queue",
        status: "dispatched",
        admittedSeq: 5,
      },
    ];
  const runtime = createSessionInputAdmission({
    initial,
    now: () => "2026-07-28T00:00:00.000Z",
    onChange: (entries) => persisted.push(entries),
  });

  const pending = runtime.list("session-1", { includeTerminal: false });
  assert.deepEqual(pending.map((entry) => entry.id), ["steer-promoted", "queue-dispatching"]);
  for (const entry of pending) {
    assert.equal(entry.status, "admitted");
    assert.equal(entry.delivery, "queue");
    assert.equal(entry.operationId, null);
    assert.equal(entry.dispatchToken, null);
    assert.equal(entry.resolution.reason, "process_restarted_before_delivery_confirmed");
  }
  assert.equal(runtime.list("session-1").find((entry) => entry.id === "already-dispatched")?.status, "dispatched");
  assert.equal(persisted.length, 1);
});

test("requeues promoted input after model history persistence failure", () => {
  const events = [];
  const runtime = createSessionInputAdmission({ onEvent: (event) => events.push(event) });
  runtime.admit({ id: "s-1", sessionId: "session-1", operationId: "op-1", text: "重试注入", delivery: "steer" });
  runtime.promoteSteers("session-1", { operationId: "op-1" });
  const requeued = runtime.requeuePromoted("s-1", {
    operationId: "op-1",
    clearOperation: true,
    reason: "model_history_persist_failed",
  });
  assert.equal(requeued.ok, true);
  assert.equal(requeued.input.status, "admitted");
  assert.equal(requeued.input.operationId, null);
  assert.equal(runtime.list("session-1", { includeTerminal: false })[0].status, "admitted");
  assert.equal(events.at(-1).kind, "session-input-requeued");
});

test("marks a queued prompt as dispatched and rejects a second dispatch", () => {
  const runtime = createSessionInputAdmission();
  runtime.admit({ id: "q-1", requestId: "req-1", sessionId: "session-1", text: "只派发一次", delivery: "queue" });
  const promoted = runtime.promoteNextQueue("session-1", { operationId: "op-1" });
  assert.equal(promoted.status, "promoted");
  const reservation = runtime.beginDispatch("q-1", { operationId: "op-1" });
  assert.equal(reservation.ok, true);
  assert.equal(reservation.input.status, "dispatching");
  assert.ok(reservation.input.dispatchToken);
  assert.equal(runtime.beginDispatch("q-1", { operationId: "op-1" }).duplicate, true);
  const dispatched = runtime.resolve("q-1", "dispatched", "prompt_accepted", { operationId: "op-1" });
  assert.equal(dispatched.input.status, "dispatched");
  assert.equal(runtime.promoteNextQueue("session-1", { operationId: "op-2" }), null);
  assert.equal(runtime.resolve("q-1", "failed", "retry" ).duplicate, true);
});

test("dispatch resolution persistence failure becomes an observable unknown fact", () => {
  let fail = false;
  const runtime = createSessionInputAdmission({
    onChange: () => { if (fail) throw new Error("metadata unavailable"); },
  });
  runtime.admit({ id: "q-fail", sessionId: "session-1", text: "需要确认派发结果", delivery: "queue" });
  runtime.promoteNextQueue("session-1", { operationId: "op-1" });
  const reservation = runtime.beginDispatch("q-fail", { operationId: "op-1" });
  assert.equal(reservation.input.status, "dispatching");
  fail = true;
  const resolved = runtime.resolve("q-fail", "dispatched", "prompt_accepted", { operationId: "op-1" });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.code, "SESSION_INPUT_PERSIST_FAILED");
  assert.equal(resolved.input.status, "unknown");
  assert.equal(runtime.list("session-1", { includeTerminal: true })[0].status, "unknown");
});

test("steer delivery resolution persistence failure becomes unknown instead of replayable", () => {
  let fail = false;
  const runtime = createSessionInputAdmission({
    onChange: () => { if (fail) throw new Error("metadata unavailable"); },
  });
  runtime.admit({ id: "s-fail", sessionId: "session-1", operationId: "op-1", text: "already in model history", delivery: "steer" });
  runtime.promoteSteers("session-1", { operationId: "op-1" });
  fail = true;

  const resolved = runtime.resolve("s-fail", "dispatched", "model_history_persisted", { operationId: "op-1" });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.uncertain, true);
  assert.equal(resolved.input.status, "unknown");
  assert.equal(runtime.list("session-1", { includeTerminal: false }).length, 0);
});

test("restores durable facts without allowing invalid entries", () => {
  const runtime = createSessionInputAdmission({ idFactory: ids() });
  const source = runtime.admit({ id: "input-1", sessionId: "session-1", text: "可恢复", delivery: "queue" }).input;
  const restored = createSessionInputAdmission({ initial: [source, { id: "bad", sessionId: "", text: "忽略" }] });
  assert.equal(restored.list("session-1")[0].id, "input-1");
  assert.equal(restored.snapshot().length, 1);
});

test("workspace binding is persisted as a stable key instead of an absolute path", () => {
  const runtime = createSessionInputAdmission({ idFactory: ids() });
  const admitted = runtime.admit({ id: "input-1", sessionId: "session-1", workspace: "C:/Users/Lenovo/Documents/work", text: "不泄露路径", delivery: "queue" }).input;
  assert.match(admitted.workspace, /^sha256:[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(runtime.snapshot()).includes("C:/Users/Lenovo/Documents/work"), false);
});

test("persistence failure rejects admission and emits no durable event", () => {
  const events = [];
  const errors = [];
  const runtime = createSessionInputAdmission({
    onChange: () => { throw new Error("disk full"); },
    onError: (error) => errors.push(error?.message ?? null),
    onEvent: (event) => events.push(event),
  });
  const result = runtime.admit({ id: "input-1", sessionId: "session-1", text: "必须落盘", delivery: "queue" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "SESSION_INPUT_PERSIST_FAILED");
  assert.deepEqual(runtime.snapshot(), []);
  assert.deepEqual(events, []);
  assert.equal(errors.at(-1), "disk full");
  assert.equal(runtime.lastError()?.code, "SESSION_INPUT_PERSIST_FAILED");
});

test("promotion rolls back when durable metadata cannot be written", () => {
  let fail = false;
  const runtime = createSessionInputAdmission({
    onChange: () => { if (fail) throw new Error("metadata unavailable"); },
  });
  assert.equal(runtime.admit({ id: "input-1", sessionId: "session-1", operationId: "op-1", text: "稍后注入", delivery: "steer" }).ok, true);
  fail = true;
  assert.deepEqual(runtime.promoteSteers("session-1", { operationId: "op-1" }), []);
  assert.equal(runtime.list("session-1")[0].status, "admitted");
  assert.equal(runtime.lastError()?.error, "metadata unavailable");
});
