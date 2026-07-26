import test from "node:test";
import assert from "node:assert/strict";

import { createToolRepeatRuntime } from "./tool-repeat-runtime.mjs";

test("same-request duplicate reuses a completed result without exposing arguments", () => {
  const runtime = createToolRepeatRuntime();
  runtime.beginRequest("op-1");
  assert.equal(runtime.beforeExecute({ operationId: "op-1", toolName: "read_file", args: { path: "a.txt" } }), null);
  const first = runtime.augment({ operationId: "op-1", toolName: "read_file", args: { path: "a.txt" }, result: JSON.stringify({ ok: true, content: "a" }) });
  const duplicate = runtime.beforeExecute({ operationId: "op-1", toolName: "read_file", args: { path: "a.txt" } });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.result, first);
  assert.doesNotMatch(JSON.stringify(duplicate), /a\.txt/);
});

test("cross-request repeats escalate reminders and keep structured output valid", () => {
  const events = [];
  const runtime = createToolRepeatRuntime({ onRepeat: (event) => events.push(event) });
  let result = JSON.stringify({ ok: true, messageId: "m-1" });
  for (let count = 1; count <= 5; count += 1) {
    runtime.beginRequest("op-2");
    result = runtime.augment({ operationId: "op-2", toolName: "search", args: { query: "same" }, result });
    const parsed = JSON.parse(result);
    assert.equal(parsed.ok, true);
    if (count >= 3) assert.equal(parsed._visionox.toolRepeat.repeatCount, count);
  }
  assert.deepEqual(events.map((event) => event.action), ["reminder", "decision"]);
  // Diagnostics must never include raw argument values.
  assert.equal(events.every((event) => event.reminder === undefined || !event.reminder.includes("same")), true);
  assert.equal(runtime.snapshot("op-2").at(-1).repeatCount, 5);
});

test("different arguments reset the consecutive repeat streak", () => {
  const runtime = createToolRepeatRuntime();
  for (let count = 0; count < 3; count += 1) {
    runtime.beginRequest("op-3");
    runtime.augment({ operationId: "op-3", toolName: "read_file", args: { path: "same" }, result: "ok" });
  }
  runtime.beginRequest("op-3");
  const result = runtime.augment({ operationId: "op-3", toolName: "read_file", args: { path: "different" }, result: "ok" });
  assert.equal(result, "ok");
  // The changed arguments start a fresh streak. Two more identical calls are
  // required before the reminder threshold is reached again.
  runtime.beginRequest("op-3");
  runtime.augment({ operationId: "op-3", toolName: "read_file", args: { path: "different" }, result: "ok" });
  runtime.beginRequest("op-3");
  runtime.augment({ operationId: "op-3", toolName: "read_file", args: { path: "different" }, result: "ok" });
  assert.equal(runtime.snapshot("op-3").at(-1).repeatCount, 3);
});

test("array results stay valid while a steering event records the repeat", () => {
  const events = [];
  const runtime = createToolRepeatRuntime({ onRepeat: (event) => events.push(event) });
  for (let count = 0; count < 3; count += 1) {
    runtime.beginRequest("op-4");
    const result = runtime.augment({ operationId: "op-4", toolName: "list_directory", args: { path: "a" }, result: "[1,2]" });
    assert.deepEqual(JSON.parse(result), [1, 2]);
  }
  assert.equal(events[0].resultAugmented, false);
});

test("missing arguments still produce a stable repeat key", () => {
  const runtime = createToolRepeatRuntime();
  runtime.beginRequest("op-5");
  runtime.augment({ operationId: "op-5", toolName: "probe", result: "ok" });
  const duplicate = runtime.beforeExecute({ operationId: "op-5", toolName: "probe" });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.result, "ok");
});

test("non-repeatable or failed results are never reused", () => {
  const runtime = createToolRepeatRuntime();
  runtime.beginRequest("op-6");
  runtime.augment({ operationId: "op-6", toolName: "write_file", args: { path: "out.txt" }, result: '{"ok":true}', repeatable: false });
  assert.equal(runtime.beforeExecute({ operationId: "op-6", toolName: "write_file", args: { path: "out.txt" }, repeatable: false }), null);

  runtime.beginRequest("op-7");
  runtime.augment({ operationId: "op-7", toolName: "read_file", args: { path: "missing.txt" }, result: '{"ok":false}', cacheable: false });
  assert.equal(runtime.beforeExecute({ operationId: "op-7", toolName: "read_file", args: { path: "missing.txt" } }), null);
});
