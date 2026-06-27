import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { isInsideWorkspace } from "./learn-sandbox-impl.mjs";

test("isInsideWorkspace: descendant path returns true", () => {
  const ws = process.platform === "win32" ? "C:\\ws" : "/ws";
  const sub = process.platform === "win32" ? "C:\\ws\\sub" : "/ws/sub";
  assert.equal(isInsideWorkspace(sub, ws), true);
});

test("isInsideWorkspace: workspace root itself returns true", () => {
  const ws = process.platform === "win32" ? "C:\\ws" : "/ws";
  assert.equal(isInsideWorkspace(ws, ws), true);
});

test("isInsideWorkspace: parent traversal returns false", () => {
  const ws = process.platform === "win32" ? "C:\\ws" : "/ws";
  const outside = resolve(ws, "..", "other");
  assert.equal(isInsideWorkspace(outside, ws), false);
});

test("isInsideWorkspace: cross-drive path returns false (Windows only)", () => {
  if (process.platform !== "win32") return;
  const ws = "C:\\ws";
  const other = "D:\\other";
  assert.equal(isInsideWorkspace(other, ws), false);
});

test("isInsideWorkspace: mixed separators and case-insensitive root match (Windows)", () => {
  if (process.platform !== "win32") return;
  assert.equal(isInsideWorkspace("C:\\WS\\sub", "c:\\ws"), true);
  assert.equal(isInsideWorkspace("C:/ws/sub", "C:\\ws"), true);
});

test("isInsideWorkspace: empty workspaceDir returns false", () => {
  assert.equal(isInsideWorkspace("/any/path", null), false);
  assert.equal(isInsideWorkspace("/any/path", undefined), false);
  assert.equal(isInsideWorkspace("/any/path", ""), false);
});
