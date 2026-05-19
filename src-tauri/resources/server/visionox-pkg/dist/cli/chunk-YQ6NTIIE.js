#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }

// src/telemetry/stats.ts
var DEEPSEEK_PRICING = {
  "deepseek-v4-flash": { inputCacheHit: 0.028, inputCacheMiss: 0.139, output: 0.278 },
  "deepseek-v4-pro": { inputCacheHit: 0.139, inputCacheMiss: 1.667, output: 3.333 },
  // Compat aliases — priced as v4-flash per the deprecation notice.
  "deepseek-chat": { inputCacheHit: 0.028, inputCacheMiss: 0.139, output: 0.278 },
  "deepseek-reasoner": { inputCacheHit: 0.028, inputCacheMiss: 0.139, output: 0.278 }
};
var CLAUDE_SONNET_PRICING = { input: 3, output: 15 };
var DEEPSEEK_CONTEXT_TOKENS = {
  "deepseek-v4-flash": 1e6,
  "deepseek-v4-pro": 1e6,
  "deepseek-chat": 1e6,
  "deepseek-reasoner": 1e6
};
var DEFAULT_CONTEXT_TOKENS = 131072;
function costUsd(model, usage) {
  const p = DEEPSEEK_PRICING[model];
  if (!p) return 0;
  return (usage.promptCacheHitTokens * p.inputCacheHit + usage.promptCacheMissTokens * p.inputCacheMiss + usage.completionTokens * p.output) / 1e6;
}
function inputCostUsd(model, usage) {
  const p = DEEPSEEK_PRICING[model];
  if (!p) return 0;
  return (usage.promptCacheHitTokens * p.inputCacheHit + usage.promptCacheMissTokens * p.inputCacheMiss) / 1e6;
}
function outputCostUsd(model, usage) {
  const p = DEEPSEEK_PRICING[model];
  if (!p) return 0;
  return usage.completionTokens * p.output / 1e6;
}
function cacheSavingsUsd(model, hitTokens) {
  if (hitTokens <= 0) return 0;
  const p = DEEPSEEK_PRICING[model];
  if (!p) return 0;
  return hitTokens * (p.inputCacheMiss - p.inputCacheHit) / 1e6;
}
function claudeEquivalentCost(usage) {
  return (usage.promptTokens * CLAUDE_SONNET_PRICING.input + usage.completionTokens * CLAUDE_SONNET_PRICING.output) / 1e6;
}
var SessionStats = class {
  turns = [];
  /** Cost from prior runs of a resumed session, restored from session meta. */
  _carryoverCost = 0;
  /** Turn count from prior runs of a resumed session. */
  _carryoverTurns = 0;
  _carryoverCacheHit = 0;
  _carryoverCacheMiss = 0;
  /** Last turn's promptTokens before exit — surfaced via summary() until the next live turn lands. */
  _carryoverLastPromptTokens = 0;
  /** Seed totals from a resumed session's persisted meta — only call once at construction. */
  seedCarryover(opts) {
    if (typeof opts.totalCostUsd === "number" && opts.totalCostUsd > 0) {
      this._carryoverCost = opts.totalCostUsd;
    }
    if (typeof opts.turnCount === "number" && opts.turnCount > 0) {
      this._carryoverTurns = opts.turnCount;
    }
    if (typeof opts.cacheHitTokens === "number" && opts.cacheHitTokens > 0) {
      this._carryoverCacheHit = opts.cacheHitTokens;
    }
    if (typeof opts.cacheMissTokens === "number" && opts.cacheMissTokens > 0) {
      this._carryoverCacheMiss = opts.cacheMissTokens;
    }
    if (typeof opts.lastPromptTokens === "number" && opts.lastPromptTokens > 0) {
      this._carryoverLastPromptTokens = opts.lastPromptTokens;
    }
  }
  record(turn, model, usage) {
    const cost = costUsd(model, usage);
    const stats = {
      turn,
      model,
      usage,
      cost,
      cacheHitRatio: usage.cacheHitRatio
    };
    this.turns.push(stats);
    return stats;
  }
  get totalCost() {
    return this._carryoverCost + this.turns.reduce((sum, t) => sum + t.cost, 0);
  }
  get totalClaudeEquivalent() {
    return this.turns.reduce((sum, t) => sum + claudeEquivalentCost(t.usage), 0);
  }
  get savingsVsClaude() {
    const c = this.totalClaudeEquivalent;
    return c > 0 ? 1 - this.totalCost / c : 0;
  }
  get totalInputCost() {
    return this.turns.reduce((sum, t) => sum + inputCostUsd(t.model, t.usage), 0);
  }
  get totalOutputCost() {
    return this.turns.reduce((sum, t) => sum + outputCostUsd(t.model, t.usage), 0);
  }
  get aggregateCacheHitRatio() {
    let hit = this._carryoverCacheHit;
    let miss = this._carryoverCacheMiss;
    for (const t of this.turns) {
      hit += t.usage.promptCacheHitTokens;
      miss += t.usage.promptCacheMissTokens;
    }
    const denom = hit + miss;
    return denom > 0 ? hit / denom : 0;
  }
  summary() {
    const last = this.turns[this.turns.length - 1];
    return {
      turns: this.turns.length + this._carryoverTurns,
      totalCostUsd: round(this.totalCost, 6),
      totalInputCostUsd: round(this.totalInputCost, 6),
      totalOutputCostUsd: round(this.totalOutputCost, 6),
      claudeEquivalentUsd: round(this.totalClaudeEquivalent, 6),
      savingsVsClaudePct: round(this.savingsVsClaude * 100, 2),
      cacheHitRatio: round(this.aggregateCacheHitRatio, 4),
      lastPromptTokens: last?.usage.promptTokens ?? this._carryoverLastPromptTokens,
      lastTurnCostUsd: round(last?.cost ?? 0, 6)
    };
  }
};
function round(n, digits) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export {
  DEEPSEEK_PRICING,
  DEEPSEEK_CONTEXT_TOKENS,
  DEFAULT_CONTEXT_TOKENS,
  costUsd,
  inputCostUsd,
  outputCostUsd,
  cacheSavingsUsd,
  claudeEquivalentCost,
  SessionStats
};
//# sourceMappingURL=chunk-YQ6NTIIE.js.map