import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../../../", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, root), "utf8");

test("assistant execution receipts survive persistence and are rendered by the dashboard", () => {
  const launcher = read("src-tauri/resources/server/launcher.mjs");
  const activeSession = read("src-tauri/resources/server/lib/active-session.mjs");
  const app = read("src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js");
  assert.match(launcher, /receipt: receiptSnapshot/);
  assert.match(launcher, /requestOperationStop\(operation\.context/);
  assert.match(activeSession, /receipt: entry\.receipt/);
  assert.match(app, /function renderExecutionReceipt\(/);
  assert.match(app, /execution-receipt/);
  assert.match(app, /receipt: dash\.receipt/);
});
