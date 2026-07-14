import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createExternalUrlOpener, normalizeExternalUrl } from "./external-url.mjs";

function spawnRecorder(calls) {
  return (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.unref = () => { child.unrefCalled = true; };
    queueMicrotask(() => child.emit("spawn"));
    return child;
  };
}

test("external URL opener accepts only HTTP and HTTPS links", () => {
  assert.equal(normalizeExternalUrl("https://login.dingtalk.com/device?code=A&B=1"), "https://login.dingtalk.com/device?code=A&B=1");
  assert.throws(() => normalizeExternalUrl("file:///C:/secret.txt"), /only HTTP and HTTPS/);
  assert.throws(() => normalizeExternalUrl("javascript:alert(1)"), /only HTTP and HTTPS/);
});

test("Windows default browser uses structured arguments without a shell command", async () => {
  const calls = [];
  const open = createExternalUrlOpener({ platform: "win32", spawnProcess: spawnRecorder(calls) });
  assert.deepEqual(await open("https://login.dingtalk.com/device?user_code=A&B=1"), { opened: true, browser: "default" });
  assert.deepEqual(calls[0].command, "rundll32.exe");
  assert.deepEqual(calls[0].args, ["url.dll,FileProtocolHandler", "https://login.dingtalk.com/device?user_code=A&B=1"]);
  assert.equal(calls[0].options.detached, true);
});

test("Edge fallback resolves an installed executable and rejects a missing one", async () => {
  const calls = [];
  const env = { PROGRAMFILES: "C:\\Program Files" };
  const expected = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
  const open = createExternalUrlOpener({ platform: "win32", env, fileExists: (path) => path === expected, spawnProcess: spawnRecorder(calls) });
  assert.deepEqual(await open("https://login.dingtalk.com/device", { browser: "edge" }), { opened: true, browser: "edge" });
  assert.equal(calls[0].command, expected);
  assert.deepEqual(calls[0].args, ["https://login.dingtalk.com/device"]);

  const missing = createExternalUrlOpener({ platform: "win32", env, fileExists: () => false, spawnProcess: spawnRecorder([]) });
  await assert.rejects(() => missing("https://login.dingtalk.com/device", { browser: "edge" }), /Edge was not found/);
});
