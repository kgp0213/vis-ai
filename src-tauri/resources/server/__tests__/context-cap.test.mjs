import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_CONTEXT_TOKENS, resolveContextCap, resolveContextPolicy } from "../lib/context-cap.mjs";

const provider = {
  id: "test",
  models: [
    { id: "flash", maxContextLength: 131072 },
    { id: "pro", maxContextLength: 131072 },
    { id: "local-flash", maxContextLength: 1048576 },
  ],
};

describe("resolveContextCap — JSON 驱动容量策略", () => {
  test("用户限制低于 JSON 容量时降低有效容量", () => {
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

  test("模型不在当前 Provider JSON 中时保守回退 128K", () => {
    const config = {};
    assert.equal(resolveContextCap("unknown-model", config, provider), FALLBACK_CONTEXT_TOKENS);
  });

  test("无 Provider JSON 时保守回退 128K", () => {
    assert.equal(resolveContextCap("any", {}, null), FALLBACK_CONTEXT_TOKENS);
    assert.equal(resolveContextCap("any", {}, undefined), FALLBACK_CONTEXT_TOKENS);
  });

  test("用户 1M 限制切换到 81K 模型时按 JSON 真实容量裁剪", () => {
    const policy = resolveContextPolicy("local-qwen", { contextCapTokens: 1048576 }, {
      id: "local",
      models: [{ id: "local-qwen", maxContextLength: 81920 }],
    });
    assert.equal(policy.modelMaxContextLength, 81920);
    assert.equal(policy.effectiveCap, 81920);
    assert.equal(policy.capacitySource, "json");
    assert.equal(policy.clamped, true);
  });

  test("同一模型的新 JSON 容量覆盖旧 JSON，不按模型 ID 缓存", () => {
    const config = {};
    const oldProvider = { id: "local", models: [{ id: "same-model", maxContextLength: 1048576 }] };
    const newProvider = { id: "local", models: [{ id: "same-model", maxContextLength: 131072 }] };
    assert.equal(resolveContextCap("same-model", config, oldProvider), 1048576);
    assert.equal(resolveContextCap("same-model", config, newProvider), 131072);
  });
});
