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
  fold: 0.5,
  aggressive: 0.7,
  forceSummary: 0.8,
  emergency: 0.95,
};

const ABSOLUTE_CAP = {
  fold: 200000,
  aggressive: 280000,
  forceSummary: 320000,
  emergency: 380000,
};

const TAIL = {
  normalFraction: 0.2,
  normalCap: 40000,
  aggressiveFraction: 0.1,
  aggressiveCap: 20000,
};

const CTX = {
  K128: 131072,
  K1M: 1048576,
  K81: 81920, // Qwen
};

// ── Helper: effective threshold = min(ratio, absoluteCap / ctxMax) ──────

function effectiveThreshold(ratio, absoluteCap, ctxMax) {
  return Math.min(ratio, absoluteCap / ctxMax);
}

function effectiveThresholdTokens(ratio, absoluteCap, ctxMax) {
  return Math.floor(ctxMax * effectiveThreshold(ratio, absoluteCap, ctxMax));
}

function tailBudget(fraction, absoluteCap, ctxMax) {
  return Math.min(Math.floor(ctxMax * fraction), absoluteCap);
}

// ── decideAfterUsage reimplementation (pure, for golden-value testing) ──

function decideAfterUsage(promptTokens, ctxMax, alreadyFoldedThisTurn = false) {
  const ratio = promptTokens / ctxMax;
  const forceSummaryThr = effectiveThreshold(RATIO.forceSummary, ABSOLUTE_CAP.forceSummary, ctxMax);
  const aggressiveThr = effectiveThreshold(RATIO.aggressive, ABSOLUTE_CAP.aggressive, ctxMax);
  const foldThr = effectiveThreshold(RATIO.fold, ABSOLUTE_CAP.fold, ctxMax);

  if (ratio > forceSummaryThr) return { kind: "exit-with-summary", promptTokens, ctxMax, ratio };
  if (alreadyFoldedThisTurn) return { kind: "none", promptTokens, ctxMax, ratio };
  if (ratio > aggressiveThr) {
    return {
      kind: "fold", promptTokens, ctxMax, ratio,
      tailBudget: tailBudget(TAIL.aggressiveFraction, TAIL.aggressiveCap, ctxMax),
      aggressive: true,
    };
  }
  if (ratio > foldThr) {
    return {
      kind: "fold", promptTokens, ctxMax, ratio,
      tailBudget: tailBudget(TAIL.normalFraction, TAIL.normalCap, ctxMax),
      aggressive: false,
    };
  }
  return { kind: "none", promptTokens, ctxMax, ratio };
}

// ── Tests: effective threshold calculation ─────────────────────

describe("有效阈值计算 min(ratio, absoluteCap/ctxMax)", () => {
  test("运行时导出的阈值与模型容量同步计算", () => {
    assert.deepEqual(contextThresholdsForCapacity(CTX.K1M), {
      ctxMax: CTX.K1M,
      foldTokens: 200000,
      aggressiveTokens: 280000,
      forceSummaryTokens: 320000,
      emergencyTokens: 380000,
      normalTailTokens: 40000,
      aggressiveTailTokens: 20000,
    });
  });
  test("128K ctxMax: ratio 主导，与纯比例一致", () => {
    // min(0.5, 200000/131072) = min(0.5, 1.526) = 0.5
    assert.equal(effectiveThreshold(RATIO.fold, ABSOLUTE_CAP.fold, CTX.K128), 0.5);
    assert.equal(effectiveThresholdTokens(RATIO.fold, ABSOLUTE_CAP.fold, CTX.K128), 65536);
  });

  test("1M ctxMax: absoluteCap 主导，大幅低于比例值", () => {
    // min(0.5, 200000/1048576) = 0.1907 → 200000 tokens
    assert.equal(effectiveThresholdTokens(RATIO.fold, ABSOLUTE_CAP.fold, CTX.K1M), 200000);
    assert.equal(effectiveThresholdTokens(RATIO.aggressive, ABSOLUTE_CAP.aggressive, CTX.K1M), 280000);
    assert.equal(effectiveThresholdTokens(RATIO.forceSummary, ABSOLUTE_CAP.forceSummary, CTX.K1M), 320000);
  });

  test("1M emergency: 380K 而非 95%", () => {
    assert.equal(effectiveThresholdTokens(RATIO.emergency, ABSOLUTE_CAP.emergency, CTX.K1M), 380000);
  });

  test("81K Qwen: ratio 主导（absoluteCap 远大于 ctxMax）", () => {
    // min(0.5, 200000/81920) = min(0.5, 2.44) = 0.5 → 40960 tokens
    assert.equal(effectiveThresholdTokens(RATIO.fold, ABSOLUTE_CAP.fold, CTX.K81), 40960);
  });

  test("1M vs 128K: 1M 的折叠比例远低于 128K（双阈值核心目的）", () => {
    const fold128Ratio = effectiveThreshold(RATIO.fold, ABSOLUTE_CAP.fold, CTX.K128);
    const fold1MRatio = effectiveThreshold(RATIO.fold, ABSOLUTE_CAP.fold, CTX.K1M);
    assert.ok(fold1MRatio < fold128Ratio,
      `1M fold ratio (${fold1MRatio.toFixed(4)}) should be < 128K fold ratio (${fold128Ratio})`);
    // 1M 在 200K 折叠（19% 而非 50%），128K 在 65K 折叠（50%）
    // 双阈值的核心：大上下文模型在更低的 token 比例就开始折叠，但绝对值仍合理
    assert.equal(effectiveThresholdTokens(RATIO.fold, ABSOLUTE_CAP.fold, CTX.K1M), 200000);
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

  test("ratio=0.3, 128K → kind=none", () => {
    const d = decideAfterUsage(Math.floor(CTX.K128 * 0.3), CTX.K128);
    assert.equal(d.kind, "none");
  });

  test("ratio=0.6, 128K → kind=fold, aggressive=false, tailBudget=26214", () => {
    const d = decideAfterUsage(Math.floor(CTX.K128 * 0.6), CTX.K128);
    assert.equal(d.kind, "fold");
    assert.equal(d.aggressive, false);
    assert.equal(d.tailBudget, 26214);
  });

  test("ratio=0.75, 128K → kind=fold, aggressive=true, tailBudget=13107", () => {
    const d = decideAfterUsage(Math.floor(CTX.K128 * 0.75), CTX.K128);
    assert.equal(d.kind, "fold");
    assert.equal(d.aggressive, true);
    assert.equal(d.tailBudget, 13107);
  });

  test("ratio=0.85, 128K → kind=exit-with-summary", () => {
    const d = decideAfterUsage(Math.floor(CTX.K128 * 0.85), CTX.K128);
    assert.equal(d.kind, "exit-with-summary");
  });

  test("1M: ratio=0.15 → none, ratio=0.25 → fold, ratio=0.35 → exit-with-summary", () => {
    assert.equal(decideAfterUsage(Math.floor(CTX.K1M * 0.15), CTX.K1M).kind, "none");
    const fold = decideAfterUsage(Math.floor(CTX.K1M * 0.25), CTX.K1M);
    assert.equal(fold.kind, "fold");
    assert.equal(fold.aggressive, false);
    assert.equal(fold.tailBudget, 40000); // absoluteCap 主导
    const exit = decideAfterUsage(Math.floor(CTX.K1M * 0.35), CTX.K1M);
    assert.equal(exit.kind, "exit-with-summary");
  });

  test("同一轮上下文重新增长后可连续进行四次有效压缩", () => {
    let state = createContextFoldState();
    const thresholds = contextThresholdsForCapacity(256000);
    for (let index = 0; index < 4; index++) {
      const beforeTokens = 144000 + index * 4000;
      const decision = decideDynamicContextAction({ promptTokens: beforeTokens, thresholds, state });
      assert.equal(decision.kind, "fold");
      state = recordContextFoldOutcome(state, {
        beforeTokens,
        afterTokens: 60000,
        folded: true,
      });
    }
    assert.equal(state.foldCount, 4);
    assert.equal(state.consecutiveIneffectiveFolds, 0);
  });

  test("有效压缩后未重新增长 32K 时不会重复压缩", () => {
    const thresholds = contextThresholdsForCapacity(256000);
    const state = recordContextFoldOutcome(createContextFoldState(), {
      beforeTokens: 144000,
      afterTokens: 120000,
      folded: true,
    });
    assert.equal(decideDynamicContextAction({ promptTokens: 145000, thresholds, state }).kind, "none");
    assert.equal(decideDynamicContextAction({ promptTokens: 155000, thresholds, state }).kind, "fold");
  });

  test("连续两次压缩无效后要求恢复，而不是无限循环", () => {
    const thresholds = contextThresholdsForCapacity(256000);
    let state = createContextFoldState();
    state = recordContextFoldOutcome(state, { beforeTokens: 144000, afterTokens: 120000, folded: true });
    state = recordContextFoldOutcome(state, { beforeTokens: 150000, afterTokens: 130000, folded: true });
    const decision = decideDynamicContextAction({ promptTokens: 170000, thresholds, state });
    assert.equal(state.consecutiveIneffectiveFolds, 2);
    assert.equal(decision.kind, "recovery-required");
    assert.equal(decision.reason, "ineffective-folds");
  });

  test("达到强制总结水位时改为激进压缩并继续", () => {
    const thresholds = contextThresholdsForCapacity(256000);
    const decision = decideDynamicContextAction({
      promptTokens: 212382,
      thresholds,
      state: createContextFoldState(),
    });
    assert.equal(decision.kind, "fold");
    assert.equal(decision.aggressive, true);
    assert.equal(decision.tailBudget, thresholds.aggressiveTailTokens);
  });
});

// ── Tests: tail budget calculation ─────────────────────────────

describe("tail budget 计算 min(floor(ctxMax*fraction), absoluteCap)", () => {
  test("128K normal: min(26214, 40000) = 26214（ratio 主导）", () => {
    const tb = tailBudget(TAIL.normalFraction, TAIL.normalCap, CTX.K128);
    assert.equal(tb, 26214);
  });

  test("1M normal: min(209715, 40000) = 40000（absoluteCap 主导）", () => {
    const tb = tailBudget(TAIL.normalFraction, TAIL.normalCap, CTX.K1M);
    assert.equal(tb, 40000);
  });

  test("1M aggressive: min(104857, 20000) = 20000（absoluteCap 主导）", () => {
    const tb = tailBudget(TAIL.aggressiveFraction, TAIL.aggressiveCap, CTX.K1M);
    assert.equal(tb, 20000);
  });

  test("81K Qwen normal: min(16384, 40000) = 16384（ratio 主导）", () => {
    const tb = tailBudget(TAIL.normalFraction, TAIL.normalCap, CTX.K81);
    assert.equal(tb, 16384);
  });
});
