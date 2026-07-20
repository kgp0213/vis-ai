import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
const loop = readFileSync(new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url), "utf8");

test("多次上下文压缩采用静默、状态、单次提醒三级反馈", () => {
  assert.match(loop, /role: "context_compacted"/);
  assert.match(loop, /notice: foldCount === 1 \? "silent" : foldCount === 4 \? "warning" : "status"/);
  assert.match(launcher, /case "context_compacted"/);
  assert.match(launcher, /ev\.notice === "silent"/);
  assert.match(launcher, /ev\.notice === "warning" \? "warning" : "status"/);
  assert.match(launcher, /eventizer\.emitSessionCompacted/);
  assert.match(launcher, /case "output_recovery"/);
  assert.match(launcher, /case "output_recovery_required"/);
});

test("Launcher 把模型输出上限传给上下文安全预算", () => {
  assert.match(launcher, /maxOutputTokens: capabilities\.maxOutputTokens/);
  assert.match(launcher, /maxOutputTokens: resolveProviderModelCapabilities\(provider, modelConfig\.model\)\.maxOutputTokens/);
});
