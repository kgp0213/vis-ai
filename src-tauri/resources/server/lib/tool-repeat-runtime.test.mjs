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
  // 真实场景里重复调用的原始结果保持一致；提醒注入只影响返回给模型的副本，
  // 空转判定基于注入前的原始输出，升级才不会被注入本身打断。
  const raw = JSON.stringify({ ok: true, messageId: "m-1" });
  for (let count = 1; count <= 5; count += 1) {
    runtime.beginRequest("op-2");
    const result = runtime.augment({ operationId: "op-2", toolName: "search", args: { query: "same" }, result: raw });
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

test("identical arguments with changing output reset the streak (watching progress)", () => {
  const events = [];
  const runtime = createToolRepeatRuntime({ onRepeat: (event) => events.push(event) });
  // 同参数但输出持续变化（监视日志/进度推进）：不算空转，连击始终为 1。
  for (let count = 1; count <= 8; count += 1) {
    runtime.beginRequest("op-watch");
    const result = runtime.augment({ operationId: "op-watch", toolName: "tail_log", args: { path: "build.log" }, result: JSON.stringify({ ok: true, line: count }) });
    assert.deepEqual(JSON.parse(result), { ok: true, line: count });
  }
  assert.equal(events.length, 0);
  assert.equal(runtime.snapshot("op-watch").length, 0);
});

test("poll-exempt tools never escalate even with identical output", () => {
  const events = [];
  const runtime = createToolRepeatRuntime({ onRepeat: (event) => events.push(event) });
  for (let count = 0; count < 15; count += 1) {
    runtime.beginRequest("op-poll");
    const result = runtime.augment({ operationId: "op-poll", toolName: "read_tool_output", args: { jobId: "job-1" }, result: "running", pollExempt: true });
    assert.equal(result, "running");
  }
  assert.equal(events.length, 0);
  assert.equal(runtime.snapshot("op-poll").length, 0);
});

test("low-information window emits one soft reminder across differing calls", () => {
  const events = [];
  const runtime = createToolRepeatRuntime({ onRepeat: (event) => events.push(event) });
  // 不同参数但输出连续完全相同：不定罪为重复，只发一次性软提醒。
  for (let count = 1; count <= 9; count += 1) {
    runtime.beginRequest("op-low");
    const result = runtime.augment({ operationId: "op-low", toolName: "probe", args: { path: `file-${count}.txt` }, result: "not found" });
    if (count === 7) assert.match(result, /没有产生任何新信息/);
  }
  const lowEvents = events.filter((event) => event.action === "low_info");
  assert.equal(lowEvents.length, 1);
  assert.equal(lowEvents[0].repeatCount, 6);
  // 软提醒不带原始参数值。
  assert.equal(lowEvents[0].reminder === undefined || !lowEvents[0].reminder.includes("file-"), true);
});

test("stop_suggested pauses the call until user steer resets escalation", () => {
  const runtime = createToolRepeatRuntime({
    thresholds: { reminderStart: 2, decisionStart: 3, handoffStart: 4, stopSuggestionStart: 5, lowInfoStart: 99 },
  });
  for (let count = 0; count < 5; count += 1) {
    runtime.beginRequest("op-block");
    runtime.augment({ operationId: "op-block", toolName: "search", args: { query: "secret-query-xyz" }, result: "same rows" });
  }
  const blocked = runtime.beforeExecute({ operationId: "op-block", toolName: "search", args: { query: "secret-query-xyz" } });
  assert.equal(blocked.blocked, true);
  const parsed = JSON.parse(blocked.result);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, "tool_repeat_blocked");
  assert.equal(parsed.retryable, false);
  // 拒绝结果不得泄露原始参数值。
  assert.doesNotMatch(blocked.result, /secret-query-xyz/);
  // 用户插话确认后：暂停名单清空，调用重新放行。
  runtime.resetEscalation("op-block");
  runtime.beginRequest("op-block");
  assert.equal(runtime.beforeExecute({ operationId: "op-block", toolName: "search", args: { query: "secret-query-xyz" } }), null);
});
