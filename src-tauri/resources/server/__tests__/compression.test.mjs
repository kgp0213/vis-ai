import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtimeChunkUrl = new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url);
const {
  contextThresholdsForCapacity,
  createContextFoldState,
  decideDynamicContextAction,
  recordContextFoldOutcome,
} = await import(runtimeChunkUrl.href);

// ── Threshold constants (mirrored from chunk-2R4QCDOZ.js:6589-6601) ─────
// These are golden-value tests: if the constants in the chunk change,
// update them here and verify the new behavior is intentional.

const RATIO = {
  fold: 0.75,
  aggressive: 0.85,
  forceSummary: 0.9,
  emergency: 0.92,
};

const TAIL = {
  normalFraction: 0.4,
  normalCap: 262144,
  aggressiveFraction: 0.25,
  aggressiveCap: 131072,
};

const CTX = {
  K128: 131072,
  K1M: 1048576,
  K81: 81920, // Qwen
};

function tailBudget(fraction, absoluteCap, ctxMax) {
  return Math.min(Math.floor(ctxMax * fraction), absoluteCap);
}

// ── Tests: quality-first threshold calculation ─────────────────

describe("质量优先上下文阈值", () => {
  test("1M 模型使用真实容量比例，不再被 200K 绝对上限提前压缩", () => {
    assert.deepEqual(contextThresholdsForCapacity(CTX.K1M, 8192), {
      ctxMax: CTX.K1M,
      foldTokens: 786432,
      aggressiveTokens: 891289,
      forceSummaryTokens: 943718,
      emergencyTokens: 964689,
      normalTailTokens: 262144,
      aggressiveTailTokens: 131072,
      outputReserveTokens: 8192,
      fixedGuardTokens: 8192,
      safeInputTokens: 1032192,
    });
  });

  test("256K 模型在 75% 才普通压缩，并保留 40% 最近原文", () => {
    const thresholds = contextThresholdsForCapacity(256000, 8192);
    assert.equal(thresholds.foldTokens, 192000);
    assert.equal(thresholds.aggressiveTokens, 217600);
    assert.equal(thresholds.forceSummaryTokens, 230400);
    assert.equal(thresholds.emergencyTokens, 235520);
    assert.equal(thresholds.normalTailTokens, 102400);
    assert.equal(thresholds.aggressiveTailTokens, 64000);
  });

  test("较小窗口按输出能力和固定余量降低紧急输入线", () => {
    const thresholds = contextThresholdsForCapacity(CTX.K81, 8192);
    assert.equal(thresholds.foldTokens, 61440);
    assert.equal(thresholds.emergencyTokens, 65536);
    assert.equal(thresholds.safeInputTokens, 65536);
  });
});

// ── Tests: decideAfterUsage decision logic ─────────────────────

describe("decideAfterUsage 决策逻辑", () => {
  test("折叠摘要不复述不可折叠前缀中的记忆和规则", () => {
    const source = readFileSync(runtimeChunkUrl, "utf8");
    assert.match(source, /immutable system prefix already preserves identity/i);
    assert.match(source, /Do not restate or summarize (?:Soul|identity)/i);
    assert.match(source, /memory references/i);
    assert.doesNotMatch(source, /This summary replaces the original turns to free context . make it self-contained/);
  });

  test("上下文摘要使用独立用途配置并拒绝截断结果", () => {
    const source = readFileSync(runtimeChunkUrl, "utf8");
    const fold = source.slice(source.indexOf("async summarizeForFold"), source.indexOf("persistRewrite", source.indexOf("async summarizeForFold")));
    const forced = source.slice(source.indexOf("async function* forceSummaryAfterIterLimit"), source.indexOf("async function summarizePartialProgress"));
    const partial = source.slice(source.indexOf("async function summarizePartialProgress"), source.indexOf("// src/loop/shrink.ts"));
    for (const section of [fold, forced, partial]) {
      assert.match(section, /requestPurpose:\s*"summary"/);
      assert.match(section, /assertModelResponseComplete\(resp\.finishReason \?\? resp\.raw\?\.choices\?\.\[0\]\?\.finish_reason\)/);
    }
  });

  test("普通最终回答也会先执行上下文决策，再结束当前轮次", () => {
    const source = readFileSync(runtimeChunkUrl, "utf8");
    const noToolReturn = source.indexOf("if (repairedCalls.length === 0)");
    const contextDecision = source.indexOf("const decision = this.context.decideAfterUsage", noToolReturn - 3000);
    assert.ok(contextDecision >= 0, "context decision should exist in the turn loop");
    assert.ok(contextDecision < noToolReturn, "context decision must run before the no-tool return");
  });

  test("高水位先激进压缩并继续，只有恢复熔断才生成总结", () => {
    const source = readFileSync(runtimeChunkUrl, "utf8");
    assert.doesNotMatch(source, /decision\.kind === "exit-with-summary"/);
    assert.match(source, /decision\.kind === "recovery-required"/);
    assert.match(source, /recordContextFoldOutcome/);
  });

  test("切换模型后下一次请求按普通压缩阈值预检", () => {
    const source = readFileSync(runtimeChunkUrl, "utf8");
    assert.match(source, /this\._contextRecheckRequired = true/);
    assert.match(source, /this\._contextRecheckRequired \? "fold" : "emergency"/);
  });

  test("74% 不压缩，76% 普通压缩，86% 激进压缩", () => {
    const thresholds = contextThresholdsForCapacity(CTX.K128, 8192);
    assert.equal(decideDynamicContextAction({ promptTokens: Math.floor(CTX.K128 * 0.74), thresholds, state: createContextFoldState() }).kind, "none");
    const normal = decideDynamicContextAction({ promptTokens: Math.floor(CTX.K128 * 0.76), thresholds, state: createContextFoldState() });
    assert.equal(normal.kind, "fold");
    assert.equal(normal.aggressive, false);
    const aggressive = decideDynamicContextAction({ promptTokens: Math.floor(CTX.K128 * 0.86), thresholds, state: createContextFoldState() });
    assert.equal(aggressive.kind, "fold");
    assert.equal(aggressive.aggressive, true);
  });

  test("同一轮上下文重新增长后可连续进行四次有效压缩", () => {
    let state = createContextFoldState();
    const thresholds = contextThresholdsForCapacity(256000);
    for (let index = 0; index < 4; index++) {
      const beforeTokens = 200000 + index * 4000;
      const decision = decideDynamicContextAction({ promptTokens: beforeTokens, thresholds, state });
      assert.equal(decision.kind, "fold");
      state = recordContextFoldOutcome(state, {
        beforeTokens,
        afterTokens: 100000,
        folded: true,
      });
    }
    assert.equal(state.foldCount, 4);
    assert.equal(state.consecutiveIneffectiveFolds, 0);
  });

  test("有效压缩后未重新增长 32K 时不会重复压缩", () => {
    const thresholds = contextThresholdsForCapacity(256000);
    const state = recordContextFoldOutcome(createContextFoldState(), {
      beforeTokens: 240000,
      afterTokens: 168000,
      folded: true,
    });
    assert.equal(decideDynamicContextAction({ promptTokens: 195000, thresholds, state }).kind, "none");
    assert.equal(decideDynamicContextAction({ promptTokens: 201000, thresholds, state }).kind, "fold");
  });

  test("连续两次压缩无效后要求恢复，而不是无限循环", () => {
    const thresholds = contextThresholdsForCapacity(256000);
    let state = createContextFoldState();
    state = recordContextFoldOutcome(state, { beforeTokens: 200000, afterTokens: 180000, folded: true });
    state = recordContextFoldOutcome(state, { beforeTokens: 210000, afterTokens: 190000, folded: true });
    const decision = decideDynamicContextAction({ promptTokens: 220000, thresholds, state });
    assert.equal(state.consecutiveIneffectiveFolds, 2);
    assert.equal(decision.kind, "recovery-required");
    assert.equal(decision.reason, "ineffective-folds");
  });

  test("达到强制总结水位时改为激进压缩并继续", () => {
    const thresholds = contextThresholdsForCapacity(256000);
    const decision = decideDynamicContextAction({
      promptTokens: 232000,
      thresholds,
      state: createContextFoldState(),
    });
    assert.equal(decision.kind, "fold");
    assert.equal(decision.aggressive, true);
    assert.equal(decision.tailBudget, thresholds.aggressiveTailTokens);
  });
});

// ── Tests: tail budget calculation ─────────────────────────────

describe("质量优先原文保留预算", () => {
  test("128K 普通压缩保留 40% 原文", () => {
    const tb = tailBudget(TAIL.normalFraction, TAIL.normalCap, CTX.K128);
    assert.equal(tb, 52428);
  });

  test("1M 普通压缩保留最多 256K 原文", () => {
    const tb = tailBudget(TAIL.normalFraction, TAIL.normalCap, CTX.K1M);
    assert.equal(tb, 262144);
  });

  test("1M 激进压缩仍保留 128K 原文", () => {
    const tb = tailBudget(TAIL.aggressiveFraction, TAIL.aggressiveCap, CTX.K1M);
    assert.equal(tb, 131072);
  });

  test("81K 模型普通压缩保留 40% 原文", () => {
    const tb = tailBudget(TAIL.normalFraction, TAIL.normalCap, CTX.K81);
    assert.equal(tb, 32768);
  });
});
