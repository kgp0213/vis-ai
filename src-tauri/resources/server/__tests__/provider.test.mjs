import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MODEL,
  PRESET_MODELS,
  LEGACY_PRESET_ALIASES,
  getActiveProvider,
  getProviderCapabilities,
  resolvePresetForProvider,
  resolveEffortForProvider,
  resolveModelForProvider,
  effectiveModelConfig,
  pickSummaryModel,
  buildLegacyProvider,
} from "../lib/provider.mjs";

// ── Test fixtures ──────────────────────────────────────────────

const officialProvider = {
  id: "deepseek-official",
  name: "DeepSeek 官方",
  baseUrl: "https://api.deepseek.com",
  apiKey: "sk-test",
  models: [
    { id: "deepseek-v4-flash", name: "Flash", presets: ["auto", "flash"], efforts: ["high", "max"], thinkingMode: "enabled", maxContextLength: 131072 },
    { id: "deepseek-v4-pro", name: "Pro", presets: ["pro"], efforts: ["high", "max"], thinkingMode: "enabled", multimodal: false, maxContextLength: 131072 },
  ],
  defaultPreset: "auto",
  defaultEffort: "max",
  autoEscalate: true,
  escalationModel: "deepseek-v4-pro",
};

const localProvider = {
  id: "local-deepseek",
  name: "本地 DeepSeek",
  baseUrl: "http://10.40.5.70:8001/v1",
  apiKey: "local-key",
  models: [
    { id: "deepseek-v4-flash", name: "Flash", presets: ["flash"], efforts: ["high"], thinkingMode: "disabled", maxContextLength: 1048576 },
  ],
  defaultPreset: "flash",
  defaultEffort: "high",
  autoEscalate: false,
};

// ── getActiveProvider ──────────────────────────────────────────

describe("getActiveProvider", () => {
  test("匹配 activeProviderId → 返回该 provider", () => {
    const cfg = { providers: [officialProvider, localProvider], activeProviderId: "local-deepseek" };
    assert.equal(getActiveProvider(cfg), localProvider);
  });

  test("activeProviderId 不存在 → 返回第一个 provider", () => {
    const cfg = { providers: [officialProvider, localProvider], activeProviderId: "nonexistent" };
    assert.equal(getActiveProvider(cfg), officialProvider);
  });

  test("providers 为空 → 返回 null", () => {
    assert.equal(getActiveProvider({ providers: [], activeProviderId: "x" }), null);
    assert.equal(getActiveProvider({}), null);
  });
});

// ── getProviderCapabilities ────────────────────────────────────

describe("getProviderCapabilities", () => {
  test("正常 provider → 汇总 presets/efforts/modelIds", () => {
    const caps = getProviderCapabilities(officialProvider);
    assert.deepEqual(caps.presets.sort(), ["auto", "flash", "pro"]);
    assert.deepEqual(caps.efforts.sort(), ["high", "max"]);
    assert.deepEqual(caps.modelIds, ["deepseek-v4-flash", "deepseek-v4-pro"]);
  });

  test("models 为空 → 返回空数组", () => {
    const caps = getProviderCapabilities({ models: [] });
    assert.deepEqual(caps.presets, []);
    assert.deepEqual(caps.efforts, []);
    assert.deepEqual(caps.modelIds, []);
  });

  test("provider 为 null → 返回空数组", () => {
    const caps = getProviderCapabilities(null);
    assert.deepEqual(caps.presets, []);
    assert.deepEqual(caps.modelIds, []);
  });

  test("停用模型不参与能力和运行模型解析", () => {
    const provider = {
      defaultPreset: "flash",
      models: [
        { id: "retired-pro", disabled: true, presets: ["pro"], efforts: ["max"] },
        { id: "active-flash", presets: ["flash"], efforts: ["high"] },
      ],
    };
    const caps = getProviderCapabilities(provider);
    assert.deepEqual(caps.presets, ["flash"]);
    assert.deepEqual(caps.modelIds, ["active-flash"]);
    assert.equal(resolveModelForProvider("pro", provider), "active-flash");
    assert.equal(pickSummaryModel(provider.models), "active-flash");
  });
});

// ── resolvePresetForProvider ───────────────────────────────────

describe("resolvePresetForProvider", () => {
  test("provider 支持 preset → 原样返回", () => {
    assert.equal(resolvePresetForProvider("flash", officialProvider), "flash");
    assert.equal(resolvePresetForProvider("auto", officialProvider), "auto");
  });

  test("provider 不支持 → 回退 defaultPreset", () => {
    assert.equal(resolvePresetForProvider("pro", localProvider), "flash");
  });

  test("无 defaultPreset → 回退 flash", () => {
    const p = { models: [{ presets: ["flash"] }] };
    assert.equal(resolvePresetForProvider("pro", p), "flash");
  });

  test("provider 为 null → 回退 flash", () => {
    assert.equal(resolvePresetForProvider("auto", null), "flash");
  });
});

// ── resolveEffortForProvider ───────────────────────────────────

describe("resolveEffortForProvider", () => {
  test("provider 支持 effort → 原样返回", () => {
    assert.equal(resolveEffortForProvider("max", officialProvider), "max");
    assert.equal(resolveEffortForProvider("high", localProvider), "high");
  });

  test("provider 不支持 → 回退 defaultEffort", () => {
    assert.equal(resolveEffortForProvider("max", localProvider), "high");
  });

  test("无 defaultEffort → 回退 high", () => {
    const p = { models: [{ efforts: ["high"] }] };
    assert.equal(resolveEffortForProvider("max", p), "high");
  });

  test("provider 为 null → 回退 high", () => {
    assert.equal(resolveEffortForProvider("max", null), "high");
  });
});

// ── resolveModelForProvider ────────────────────────────────────

describe("resolveModelForProvider", () => {
  test("按 preset 找到 model → 返回 model id", () => {
    assert.equal(resolveModelForProvider("flash", officialProvider), "deepseek-v4-flash");
    assert.equal(resolveModelForProvider("pro", officialProvider), "deepseek-v4-pro");
  });

  test("未找到 → 返回第一个 model id", () => {
    assert.equal(resolveModelForProvider("nonexistent", officialProvider), "deepseek-v4-flash");
  });

  test("provider 为 null → 返回 DEFAULT_MODEL", () => {
    assert.equal(resolveModelForProvider("flash", null), DEFAULT_MODEL);
  });
});

// ── effectiveModelConfig ───────────────────────────────────────

describe("effectiveModelConfig", () => {
  test("Provider 模式 + preset=auto → locked=true, autoEscalate 取决于 provider", () => {
    const cfg = { preset: "auto", providers: [officialProvider], activeProviderId: "deepseek-official" };
    const mc = effectiveModelConfig(cfg);
    assert.equal(mc.preset, "auto");
    assert.equal(mc.model, "deepseek-v4-flash");
    assert.equal(mc.locked, true);
    assert.equal(mc.autoEscalate, true);
    assert.equal(mc.escalationModel, "deepseek-v4-pro");
  });

  test("Provider 模式 + preset=flash → model 为 flash 模型", () => {
    const cfg = { preset: "flash", providers: [officialProvider], activeProviderId: "deepseek-official" };
    const mc = effectiveModelConfig(cfg);
    assert.equal(mc.preset, "flash");
    assert.equal(mc.model, "deepseek-v4-flash");
  });

  test("Provider 的自定义 escalationModel 直接进入运行配置", () => {
    const provider = {
      ...officialProvider,
      models: [
        { id: "qwen-fast", presets: ["auto"], efforts: ["high"] },
        { id: "qwen-strong", presets: ["pro"], efforts: ["high"] },
      ],
      escalationModel: "qwen-strong",
    };
    const mc = effectiveModelConfig({ preset: "auto", providers: [provider], activeProviderId: provider.id });
    assert.equal(mc.model, "qwen-fast");
    assert.equal(mc.escalationModel, "qwen-strong");
    assert.equal(mc.autoEscalate, true);
  });

  test("Provider 模式 + preset=pro（本地不支持）→ 回退 flash", () => {
    const cfg = { preset: "pro", providers: [localProvider], activeProviderId: "local-deepseek" };
    const mc = effectiveModelConfig(cfg);
    assert.equal(mc.preset, "flash"); // 回退到 defaultPreset
    assert.equal(mc.model, "deepseek-v4-flash");
    assert.equal(mc.autoEscalate, false); // localProvider.autoEscalate=false
  });

  test("无 Provider + preset=flash → locked=true, model=deepseek-v4-flash", () => {
    const cfg = { preset: "flash" };
    const mc = effectiveModelConfig(cfg);
    assert.equal(mc.model, PRESET_MODELS.flash);
    assert.equal(mc.locked, true);
  });

  test("无 Provider + preset=pro → locked=true, model=deepseek-v4-pro", () => {
    const cfg = { preset: "pro" };
    const mc = effectiveModelConfig(cfg);
    assert.equal(mc.model, PRESET_MODELS.pro);
    assert.equal(mc.locked, true);
  });

  test("无 Provider + preset=auto → locked=false, autoEscalate=true", () => {
    const cfg = { preset: "auto" };
    const mc = effectiveModelConfig(cfg);
    assert.equal(mc.locked, false);
    assert.equal(mc.autoEscalate, true);
    assert.equal(mc.model, DEFAULT_MODEL);
  });

  test("Legacy 别名 fast→flash, smart→auto, max→pro", () => {
    assert.equal(LEGACY_PRESET_ALIASES.fast, "flash");
    assert.equal(LEGACY_PRESET_ALIASES.smart, "auto");
    assert.equal(LEGACY_PRESET_ALIASES.max, "pro");
    // 通过 effectiveModelConfig 验证别名生效
    const mc = effectiveModelConfig({ preset: "fast" });
    assert.equal(mc.preset, "flash");
    assert.equal(mc.model, "deepseek-v4-flash");
  });

  test("无 Provider + 自定义 model → model=config.model", () => {
    const cfg = { preset: "auto", model: "qwen3.5-397b-a17b" };
    const mc = effectiveModelConfig(cfg);
    assert.equal(mc.model, "qwen3.5-397b-a17b");
    assert.equal(mc.locked, false);
  });
});

// ── pickSummaryModel ───────────────────────────────────────────

describe("pickSummaryModel", () => {
  test("含 flash 模型 → 返回 flash", () => {
    const models = [
      { id: "deepseek-v4-pro", maxContextLength: 131072 },
      { id: "deepseek-v4-flash", maxContextLength: 131072 },
    ];
    assert.equal(pickSummaryModel(models), "deepseek-v4-flash");
  });

  test("无 flash → 返回 maxContextLength 最小的", () => {
    const models = [
      { id: "qwen3.5-397b-a17b", maxContextLength: 81920 },
      { id: "deepseek-v4-pro", maxContextLength: 131072 },
    ];
    assert.equal(pickSummaryModel(models), "qwen3.5-397b-a17b");
  });

  test("无 maxContextLength → 返回第一个", () => {
    const models = [{ id: "model-a" }, { id: "model-b" }];
    assert.equal(pickSummaryModel(models), "model-a");
  });

  test("空数组 → undefined", () => {
    assert.equal(pickSummaryModel([]), undefined);
    assert.equal(pickSummaryModel(undefined), undefined);
    assert.equal(pickSummaryModel(null), undefined);
  });
});

// ── buildLegacyProvider ────────────────────────────────────────

describe("buildLegacyProvider", () => {
  test("有 apiKey/baseUrl → 生成 legacy provider", () => {
    const cfg = { apiKey: "sk-test", baseUrl: "https://api.deepseek.com", preset: "auto", reasoningEffort: "max" };
    const result = buildLegacyProvider(cfg);
    assert.ok(result);
    assert.equal(result.activeProviderId, "legacy");
    assert.equal(result.providers.length, 1);
    assert.equal(result.providers[0].id, "legacy");
    assert.equal(result.providers[0].apiKey, "sk-test");
    assert.equal(result.providers[0].models.length, 2);
    assert.equal(result.providers[0].defaultPreset, "auto");
    assert.equal(result.providers[0].models.find((model) => model.id === "deepseek-v4-pro").multimodal, false);
  });

  test("已有 providers → 返回 null", () => {
    const cfg = { apiKey: "sk-test", providers: [{ id: "existing" }] };
    assert.equal(buildLegacyProvider(cfg), null);
  });

  test("无 apiKey/baseUrl → 返回 null", () => {
    assert.equal(buildLegacyProvider({}), null);
    assert.equal(buildLegacyProvider({ preset: "auto" }), null);
  });
});
