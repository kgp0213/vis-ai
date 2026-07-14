import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const dashboard = readFileSync(new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url), "utf8");
const loader = readFileSync(new URL("../../../../src/index.html", import.meta.url), "utf8");

test("plain Windows paths paste locally while copied files prefer the native bridge", () => {
  assert.match(dashboard, /function normalizeClipboardPathText/);
  assert.match(dashboard, /function pathLikeClipboardText/);
  assert.match(dashboard, /function decodeClipboardUri/);
  assert.match(dashboard, /function isImagePathName/);
  assert.match(dashboard, /function shouldPasteImagesAsAttachments/);
  assert.match(dashboard, /if \(shouldPasteImagesAsAttachments\(\)\)/);
  assert.match(dashboard, /if \(fileNames\.length > 0\) return true;/);
  assert.match(dashboard, /if \(gotFullPaths && fullPaths\.length > 0\) return false;/);
  assert.match(dashboard, /if \(plainText\.trim\(\)\) return false;/);
  assert.match(dashboard, /else if \(gotFullPaths && fullPaths\.length > 0\)/);

  const pasteHandler = dashboard.slice(dashboard.indexOf("var onPaste ="), dashboard.indexOf("}, [pendingImages, setChatInput])"));
  assert.match(pasteHandler, /function tryRustBridge\(\)[\s\S]*?tryServerClipboardPaths\(\)/);
  assert.match(pasteHandler, /\n\s*tryRustBridge\(\);\n\s*} else if \(gotFullPaths/);
  assert.doesNotMatch(pasteHandler, /fetch\(clipboardUrl\)[\s\S]*?else \{\s*tryRustBridge\(\)/);
  assert.doesNotMatch(loader, /invokeTauriCommand\("ping"/);
});

test("Windows paths remain readable when rendered as chat messages", () => {
  assert.match(dashboard, /function protectWindowsPathBackslashesForMarkdown/);
  assert.match(dashboard, /renderMessageBody\(msg\.text, role\)/);
});
