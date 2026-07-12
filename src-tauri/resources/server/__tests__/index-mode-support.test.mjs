import { after, before, test } from "node:test";
import assert from "node:assert/strict";

before(async () => import("../visionox-pkg/dashboard/index-mode-support.js"));
after(() => delete globalThis.VisionoxIndexModePolicy);

test("index mode policy accepts only the three supported modes", () => {
  assert.equal(globalThis.VisionoxIndexModePolicy.normalize("auto"), "auto");
  assert.equal(globalThis.VisionoxIndexModePolicy.normalize("tool"), "tool");
  assert.equal(globalThis.VisionoxIndexModePolicy.normalize("off"), "off");
  assert.equal(globalThis.VisionoxIndexModePolicy.normalize("unexpected"), "tool");
});

test("index mode hints explain distinct retrieval behavior", () => {
  const hints = ["auto", "tool", "off"].map(globalThis.VisionoxIndexModePolicy.hint);
  assert.equal(new Set(hints).size, 3);
  assert.match(hints[0], /每次发送消息前自动搜索/);
  assert.match(hints[1], /不会主动搜索/);
  assert.match(hints[2], /不向模型提供本地索引搜索工具/);
});
