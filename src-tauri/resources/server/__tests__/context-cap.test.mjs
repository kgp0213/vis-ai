import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveContextCap } from "../lib/context-cap.mjs";

const provider = {
  id: "test",
  models: [
    { id: "flash", maxContextLength: 131072 },
    { id: "pro", maxContextLength: 131072 },
    { id: "local-flash", maxContextLength: 1048576 },
  ],
};

describe("resolveContextCap — 3 级优先链", () => {
  test("第 1 级：config.contextCapTokens 优先", () => {
    const config = { contextCapTokens: 65536 };
    assert.equal(resolveContextCap("flash", config, provider), 65536);
  });

  test("第 1 级：contextCapTokens 为 null → 降级到第 2 级", () => {
    const config = { contextCapTokens: null };
    assert.equal(resolveContextCap("flash", config, provider), 131072);
  });

  test("第 2 级：provider model 的 maxContextLength", () => {
    const config = {};
    assert.equal(resolveContextCap("local-flash", config, provider), 1048576);
  });

  test("第 2 级：model 不在 provider 中 → 返回 null", () => {
    const config = {};
    assert.equal(resolveContextCap("unknown-model", config, provider), null);
  });

  test("第 3 级：无 contextCapTokens + 无 provider → null（回退到硬编码表）", () => {
    assert.equal(resolveContextCap("any", {}, null), null);
    assert.equal(resolveContextCap("any", {}, undefined), null);
  });
});
