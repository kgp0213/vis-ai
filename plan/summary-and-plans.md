# 项目问题整理与计划

> 生成时间：2026-06-24
> 项目路径：`C:\Users\Lenovo\Documents\vis-ai`
> 技术栈：Tauri v2 (Rust) + Node.js sidecar (`launcher.mjs`) + Preact dashboard（基于上游 0.47.1 二开，非 React）

---

## 一、已完成的修复

### 1.1 可维护性修复（第一阶段 + 第二阶段）

| # | 任务 | 关键改动 | 状态 |
|---|------|----------|------|
| 1.1 | 归档 `tep/desktop/` | 移动到 `archive/tep-desktop/`，新增 `archive/README.md` | ✅ |
| 1.2 | 清理 `launcher.mjs` 空 stub | 删除 `setPlanMode`、`setProNextLive`、`startAutoLoop`、`stopAutoLoop` | ✅ |
| 1.3 | 集中 `launcher.mjs` 常量 | 新增顶部 `CONSTANTS` 对象，统一日志、超时、大小限制、速率限制、模式记忆等魔法值 | ✅ |
| 1.4 | 集中 `lib.rs` 常量 | 新增常量区：启动超时、健康检查、窗口尺寸、监控间隔、重启退避、关闭宽限期等 | ✅ |
| 1.5 | `single_instance` 处理启动参数 | 新增 `StartupArgs` 状态、`get_startup_args` 命令、事件通知、前端转发 | ✅ |
| 2.1 | 启动超时改为 IO 安全 | 用 `mpsc::channel` + `recv_timeout` 替换 sleep + 原子标志 | ✅ |
| 2.2 | 子进程崩溃后自动重启 | 监控线程检测到子进程退出后，按指数退避重试最多 5 次，成功后恢复 iframe | ✅ |
| 2.3 | 健康检查使用 `url` crate | 新增 `url = "2"` 依赖，解析 URL、读取响应体、支持 chunked 编码、校验 `version` | ✅ |

**验证结果**：`cargo test` 5/5 通过，`cargo build --release` 成功。

### 1.2 WebView2 刷新后卡在 "Starting server..."

**根因**：
- `03b21c81`（feat: iframe dashboard + Windows clipboard full-path paste + model preset system）将 dashboard 加载方式从顶层导航（`window.location.replace(url)`）改为全屏 iframe。顶层页面变成 `src/index.html` 壳页面。
- `03b21c81` 版本的 `src/index.html` 是纯静态加载页（spinner + "Starting server..."，**无任何 JavaScript**），iframe 方案引入时未给壳页面配恢复逻辑。刷新壳页面后 sessionStorage 清空、iframe 被丢弃、无恢复机制，页面永久停在加载态。
- 后续补丁版本引入 `restoreFromRustAndShow()` 等恢复逻辑后，又出现"未等待 `window.__TAURI__.invoke` 就绪就调用"的问题，导致运行时错误中断脚本。

**修复内容**：
- `src/index.html`：
  - 所有 `sessionStorage.getItem` 读取点增加 `|| localStorage.getItem(...)` 回退（localStorage 在 WebView2 中跨刷新持久化）。
  - 增加 `waitForTauri` 轮询，确保 `invoke` 就绪后再调用 `get_dashboard_url`。
  - 给 `get_startup_args` 调用加上 `invoke` 存在性检查，避免未就绪时抛错。
  - 新增 `restoreFromRustAndShow()`：storage 均无 URL 时 `invoke("get_dashboard_url")` 直接从 Rust 取当前有效 URL。
  - 新增 `fallbackToRust()`：iframe `error` 事件 + 6s 超时守卫，触发则清空 storage 残留、移除坏 frame、恢复 spinner（"Reconnecting..."）、从 Rust 重建。应对 localStorage 残留旧端口 URL 的边缘情况。
- `src-tauri/src/lib.rs`：
  - 新增 `get_dashboard_url` 命令，从 Rust `ServerState` 直接返回当前 dashboard URL。
  - 两处 eval（首次启动 / 崩溃重启）同步写入 sessionStorage + localStorage（统一 `try{...}catch`），并调用 `window.__visionoxRestoreDashboard()` 触发前端恢复。

**验证结果**：通过 WebView2 DevTools 协议模拟 `Page.reload`，刷新后 iframe 成功恢复。已编入 1.0.2 release。

---

## 二、待解决的问题

### 2.1 多模型服务商（Provider）配置与切换

**需求**：
- 同时保存多组 `baseUrl` + `apiKey`，支持导入 JSON 配置。
- 在 UI 顶部模型下拉框附近切换 provider。
- 不同 provider 支持不同的模型和 effort，切换时不冲突。

**用户提供的典型配置**：

| 名称 | baseUrl | apiKey | served-model-name | 说明 |
|------|---------|--------|-------------------|------|
| DeepSeek 官方 | `https://api.deepseek.com` | `sk-...` | `deepseek-v4-pro` / `deepseek-v4-flash` | 全参数模型，支持 pro/flash/auto/high/max |
| 本地 DeepSeek | `http://10.40.5.70:8001/v1` | `deepseek-v4-flash-base-8c72nc00` | `deepseek-v4-flash` | 本地，仅支持 flash/high |
| 本地 Qwen | `http://10.40.5.70:8000/v1` | `qwen35-secret-8c72nc00` | `qwen3.5-397b-a17b` | 本地，仅支持 flash/high |

#### 2.1.1 现有数据流梳理（代码核实结果）

在动手前，我完整读了 `launcher.mjs`、`server-XGDBRWMB.js`、`chunk-2R4QCDOZ.js`、`chunk-XPDVG52A.js`、`app.js`、`app.css` 的相关逻辑。现有 model/preset/effort 三层语义如下：

```
┌─────────────────────────────────────────────────────────────┐
│ config.json 字段                                            │
│   apiKey        — API 密钥（单值，待迁移为 provider）        │
│   baseUrl       — API 地址（单值，待迁移为 provider）        │
│   model         — auto 模式下的基线模型（默认 flash）        │
│   preset        — 模型预设：auto / flash / pro              │
│   reasoningEffort — 推理强度：high / max                    │
│   autoEscalate  — auto 模式是否允许自动升级到 pro            │
└─────────────────────────────────────────────────────────────┘

preset 与 model 的关系（launcher.mjs:286-314, server:2956-2980）:
  PRESET_MODELS = { flash: "deepseek-v4-flash", pro: "deepseek-v4-pro" }
  effectiveModelConfig():
    preset=flash → model 锁定为 deepseek-v4-flash（locked=true）
    preset=pro   → model 锁定为 deepseek-v4-pro（locked=true）
    preset=auto  → model = config.model（默认 deepseek-v4-flash），autoEscalate 可升级

effort 与 model 的关系（chunk-2R4QCDOZ.js:7477-7717）:
  CacheFirstLoop.model = deepseek-v4-flash（默认）
  CacheFirstLoop.reasoningEffort = max（默认）
  autoEscalate=true 时，困难轮次自动切到 ESCALATION_MODEL=deepseek-v4-pro
  isThinkingModeModel(): flash/pro 启用 thinking 模式，其他模型返回 undefined

UI 状态栏布局（app.js:24379-24446）:
  .header-pickers (flex, gap, flex-wrap)
    ├─ .work-mode-summary + .work-mode-picker  （通用/编程/办公/设计）
    ├─ .mode-picker (effort: high / max)
    ├─ .mode-picker (preset: auto / flash / pro)
    └─ .mode-picker (editMode: review / auto / yolo / admin)

数据更新链:
  UI setSetting(key, value) → POST /api/settings {key: value}
    → handleSettings POST → cfg[key] = value → writeConfig
    → preset/effort: 走 applyPresetLive/applyEffortLive → loop.configure()
    → apiKey/baseUrl: 不走 live，等 syncWorkspace（下次 submitPrompt）重建 client

GET /api/settings 和 GET /api/overview 都返回 modelState() 结果:
  preset, reasoningEffort, model(displayModel), configuredModel, effectiveModel, runtimeModel, modelDrift
```

**关键发现**：
1. preset 和 effort 是**独立维度**，分别通过 `applyPresetLive` 和 `applyEffortLive` 实时生效（`loop.configure()`），不需要等 `/new`。
2. `apiKey`/`baseUrl` 切换目前**不走 live**，只写 config，等 `syncWorkspace` 在下次 `submitPrompt` 时重建 client。provider 切换需要打破这个延迟。
3. `PRESET_MODELS` 硬编码为 deepseek-v4-flash/pro，`ESCALATION_MODEL` 硬编码为 deepseek-v4-pro，`isThinkingModeModel` 硬编码判断 flash/pro。换 provider 后这些需要适配。
4. effort 只有 `high`/`max` 两个值（`VALID_EFFORTS = Set(["high", "max"])`），不是文档原 schema 写的 low/medium/high/max。

#### 2.1.2 effort 兼容性设计

根据胡老师确认及 [`plan/本地模型对比报告_DeepSeek-V4-vs-Qwen3.5-397B.md`](本地模型对比报告_DeepSeek-V4-vs-Qwen3.5-397B.md) 的实测数据：

**本地模型推理强度只支持 high，模型 id 只支持 flash**。

> ⚠️ **报告关键发现（纠正之前计划中的错误）**：
> - **两个本地模型均不支持独立思考 token**：`reasoning.effort` 参数无效，`reasoning` 始终返回 null，`thinking`/`extra_body.thinking` 参数无效。
> - **本地 DeepSeek-V4-Flash 的 thinkingMode 应为 `disabled`**（之前计划误写为 `enabled`）。报告实测 `reasoning` 始终 null。
> - **同一个模型 ID 在官方和本地能力不同**：官方 `deepseek-v4-flash` 支持 thinking 模式（`isThinkingModeModel` 返回 enabled），本地 vLLM 部署的 `deepseek-v4-flash` **不支持**。
> - **effort 参数对本地模型 API 层面无效**，但 UI 层面仍需限制（避免发送无效参数、避免用户误以为 max 可用）。
> - **Qwen 支持多模态（图像识别）**，DeepSeek 本地版明确拒绝（400: "not a multimodal model"）。影响 vision 配置。
> - **上下文长度差异巨大**：DeepSeek 本地 1M tokens，Qwen 81K tokens。影响 max_tokens 和长文档处理。
> - **Qwen JSON Mode 限制**：根节点必须为对象 `{}`，数组 `[]` 会报错。

三个 provider 的能力矩阵（基于实测报告修正）：

| Provider | preset 可选 | effort 可选 | 模型 id | thinkingMode | autoEscalate | 多模态 | 最大上下文 | JSON Mode |
|----------|------------|------------|---------|:----------:|:----------:|:------:|:----------:|:---------:|
| DeepSeek 官方 | auto, flash, pro | high, max | deepseek-v4-flash, deepseek-v4-pro | enabled | ✅ | ❌ | — | 正常 |
| 本地 DeepSeek | flash | high | deepseek-v4-flash | **disabled** | ❌ | ❌ | 1,048,576 | 正常 |
| 本地 Qwen | flash | high | qwen3.5-397b-a17b | disabled | ❌ | ✅ | 81,920 | 根节点必须 `{}` |

**兼容设计要点**：

1. **preset 维度**：本地 provider 只有 `flash`，没有 `auto`（无 autoEscalate）和 `pro`（无 pro 模型）。UI 需隐藏/禁用不支持的 preset 按钮。

2. **effort 维度**：本地 provider 只有 `high`，没有 `max`。UI 需隐藏/禁用不支持的 effort 按钮。**注意**：effort 参数对本地模型 API 无效（`reasoning.effort` 被忽略），UI 限制仅用于避免用户困惑。

3. **Qwen 的 preset 映射**：Qwen 不是 deepseek 模型，但 UI 上仍用 `flash` 这个 preset 标签（表示"使用快速模型"）。实际 model id 是 `qwen3.5-397b-a17b`。需要 provider schema 声明 `presets: ["flash"]` 对应的实际 model id。

4. **切换 provider 时的回退规则**：
   - 若当前 preset 不在新 provider 支持列表 → 回退到该 provider 的 `defaultPreset`（通常为 `flash`）
   - 若当前 effort 不在新 provider 支持列表 → 回退到该 provider 的 `defaultEffort`（通常为 `high`）
   - 回退后立即 `loop.configure()` 生效

5. **thinkingMode 适配**（报告纠正）：`thinkingMode` 是 **per-model per-provider** 的属性，不能按模型 ID 全局判断。同一个 `deepseek-v4-flash` 在官方支持 thinking，在本地 vLLM 不支持。`isThinkingModeModel` 的硬编码逻辑必须改为从 provider model 配置读取。保守策略：不支持的模型返回 `"disabled"`，避免发送 thinking 参数导致 API 报错。

6. **多模态适配**：Qwen 支持图像识别，DeepSeek 本地版不支持。当前 `lib.rs` 的 vision 配置（`chunk-2R4QCDOZ.js:1609` 硬编码 `deepseek-v4-pro` 有 vision）需要改为从 provider model 配置读取 `multimodal` 字段。切到 DeepSeek 本地版时粘贴图片应提示"不支持"，切到 Qwen 时正常处理。

7. **上下文长度适配**：Qwen 仅 81K tokens（约为 DeepSeek 1M 的 8%）。schema 增加 `maxContextLength` 字段，launcher 在构建请求时据此限制 max_tokens，避免超出上下文导致 API 报错。

8. **JSON Mode 适配**：Qwen 要求 JSON 根节点为对象。若 tool calling 的参数解析依赖数组根节点，需在 Qwen provider 下加额外提示或降级处理。

#### 2.1.3 修订后的 JSON Schema

> 基于 [`plan/本地模型对比报告`](本地模型对比报告_DeepSeek-V4-vs-Qwen3.5-397B.md) 实测数据修正。

```json
{
  "providers": [
    {
      "id": "deepseek-official",
      "name": "DeepSeek 官方",
      "baseUrl": "https://api.deepseek.com",
      "apiKey": "sk-...",
      "models": [
        {
          "id": "deepseek-v4-flash",
          "name": "Flash",
          "presets": ["auto", "flash"],
          "efforts": ["high", "max"],
          "thinkingMode": "enabled",
          "multimodal": false,
          "maxContextLength": 131072
        },
        {
          "id": "deepseek-v4-pro",
          "name": "Pro",
          "presets": ["pro"],
          "efforts": ["high", "max"],
          "thinkingMode": "enabled",
          "multimodal": true,
          "maxContextLength": 131072
        }
      ],
      "defaultPreset": "auto",
      "defaultEffort": "max",
      "autoEscalate": true,
      "escalationModel": "deepseek-v4-pro"
    },
    {
      "id": "local-deepseek",
      "name": "本地 DeepSeek",
      "baseUrl": "http://10.40.5.70:8001/v1",
      "apiKey": "deepseek-v4-flash-base-8c72nc00",
      "models": [
        {
          "id": "deepseek-v4-flash",
          "name": "Flash",
          "presets": ["flash"],
          "efforts": ["high"],
          "thinkingMode": "disabled",
          "multimodal": false,
          "maxContextLength": 1048576
        }
      ],
      "defaultPreset": "flash",
      "defaultEffort": "high",
      "autoEscalate": false
    },
    {
      "id": "local-qwen",
      "name": "本地 Qwen",
      "baseUrl": "http://10.40.5.70:8000/v1",
      "apiKey": "qwen35-secret-8c72nc00",
      "models": [
        {
          "id": "qwen3.5-397b-a17b",
          "name": "Qwen3.5-397B",
          "presets": ["flash"],
          "efforts": ["high"],
          "thinkingMode": "disabled",
          "multimodal": true,
          "maxContextLength": 81920,
          "jsonModeRootObjectOnly": true
        }
      ],
      "defaultPreset": "flash",
      "defaultEffort": "high",
      "autoEscalate": false
    }
  ],
  "activeProviderId": "deepseek-official"
}
```

**与上一版 schema 的差异（基于实测报告修正）**：
- 本地 DeepSeek `thinkingMode` 从 `enabled` 改为 **`disabled`**（报告实测 `reasoning` 始终 null）
- 新增 `multimodal` 字段：Qwen ✅，DeepSeek 本地 ❌（影响图片粘贴处理）
- 新增 `maxContextLength` 字段：DeepSeek 本地 1M，Qwen 81K（影响 max_tokens 限制）
- 新增 `jsonModeRootObjectOnly` 字段：Qwen 为 true（JSON 根节点必须为对象）
- DeepSeek 官方 `maxContextLength` 暂设 131072（官方未公开 1M，保守值，待确认）

**与原 schema 的差异**：
- `models[]` 增加 `presets`、`thinkingMode`、`multimodal`、`maxContextLength`、`jsonModeRootObjectOnly` 字段
- provider 级别增加 `defaultPreset`、`defaultEffort`、`autoEscalate`、`escalationModel`
- 移除了原 schema 中不存在的 `low`/`medium` effort（代码只认 `high`/`max`）
- `defaultModel` 改为通过 `defaultPreset` + `models[].presets` 推导，不再单独声明

**导入语义**：同 `id` 整体覆盖（包括 models），不同 `id` 追加。

---

## 三、实施计划（Provider 切换功能）

> ⚠️ 本节原方案存在若干问题，已按评审意见修订。修订以 **【修订】** 标注。
> 本计划基于代码核实结果制定，所有行号和函数名均来自实际源码。

### 步骤 1：确定 JSON schema ✅ 已完成

见 2.1.3 节修订后的 JSON Schema。关键决策：
- `models[]` 含 `presets`、`efforts`、`thinkingMode` 三个维度
- provider 级别 `defaultPreset`/`defaultEffort`/`autoEscalate`/`escalationModel`
- 导入语义：同 `id` 整体覆盖（含 models），不同 `id` 追加
- effort 只有 `high`/`max`（代码 `VALID_EFFORTS` 只认这两个值）

### 步骤 2：后端改造 `launcher.mjs` + `server-XGDBRWMB.js` + `chunk-XPDVG52A.js`

#### 2.1 config.json 迁移（`chunk-XPDVG52A.js` / `launcher.mjs`）

**文件**：`chunk-XPDVG52A.js:2286-2293`（`loadApiKey`/`loadBaseUrl`）、`launcher.mjs:282-284`

- 新增 `migrateProviders(config)` 函数，在 `readConfig` 后调用：
  - 若 `config.providers` 不存在但有顶层 `apiKey`/`baseUrl`：
    - 构造 `providers[0]` = `{ id: "legacy", name: "默认", baseUrl: config.baseUrl, apiKey: config.apiKey, models: [默认 flash/pro], defaultPreset: config.preset ?? "auto", defaultEffort: config.reasoningEffort ?? "max", autoEscalate: config.autoEscalate ?? true, escalationModel: "deepseek-v4-pro" }`
    - 设 `activeProviderId = "legacy"`
    - 保留顶层 `apiKey`/`baseUrl` 不删（向后兼容），但后续读取统一走 `getActiveProvider()`
  - 若 `config.providers` 已存在，跳过迁移

- 修改 `loadApiKey()`（`chunk-XPDVG52A.js:2286`）：
  - 环境变量 `DEEPSEEK_API_KEY` 优先（保留）
  - 否则 `readConfig(path)` → 找 `activeProviderId` → 返回对应 provider 的 `apiKey`
  - 无 provider 则回退到顶层 `cfg.apiKey`（兼容）

- 修改 `loadBaseUrl()`（`chunk-XPDVG52A.js:2290`）：
  - 同上逻辑，环境变量优先，否则从 active provider 读取

#### 2.2 provider 管理函数（`launcher.mjs`）

新增以下函数（放在 `effectiveModelConfig` 附近，约 `launcher.mjs:314` 后）：

```js
function getActiveProvider(cfg = config) {
  const providers = cfg.providers ?? [];
  return providers.find(p => p.id === cfg.activeProviderId) ?? providers[0] ?? null;
}

function getProviderCapabilities(provider) {
  // 汇总 provider 所有 models 的 presets/efforts
  const allPresets = new Set();
  const allEfforts = new Set();
  const modelIds = [];
  for (const m of provider?.models ?? []) {
    for (const p of m.presets ?? []) allPresets.add(p);
    for (const e of m.efforts ?? []) allEfforts.add(e);
    modelIds.push(m.id);
  }
  return { presets: [...allPresets], efforts: [...allEfforts], modelIds };
}

function resolvePresetForProvider(preset, provider) {
  // 当前 preset 是否被 provider 支持？不支持则回退到 defaultPreset
  const caps = getProviderCapabilities(provider);
  if (caps.presets.includes(preset)) return preset;
  return provider?.defaultPreset ?? "flash";
}

function resolveEffortForProvider(effort, provider) {
  const caps = getProviderCapabilities(provider);
  if (caps.efforts.includes(effort)) return effort;
  return provider?.defaultEffort ?? "high";
}

function resolveModelForProvider(preset, provider) {
  // 根据 preset 找到 provider 中支持该 preset 的 model
  const model = provider?.models?.find(m => m.presets?.includes(preset));
  return model?.id ?? provider?.models?.[0]?.id ?? "deepseek-v4-flash";
}
```

#### 2.3 修改 `effectiveModelConfig`（`launcher.mjs:301`）

现有逻辑用硬编码的 `PRESET_MODELS`。改为优先从 active provider 解析：

```js
function effectiveModelConfig(source = config) {
  const rawPreset = source.preset ?? "auto";
  const preset = LEGACY_PRESET_ALIASES[rawPreset] ?? rawPreset;
  const provider = getActiveProvider(source);

  if (provider) {
    // Provider 模式：从 provider 解析
    const resolvedPreset = resolvePresetForProvider(preset, provider);
    const model = resolveModelForProvider(resolvedPreset, provider);
    const caps = getProviderCapabilities(provider);
    return {
      rawPreset,
      preset: resolvedPreset,
      configuredModel: model,
      model,
      locked: true, // provider 模式下 model 由 preset 决定
      autoEscalate: provider.autoEscalate === true && resolvedPreset === "auto",
    };
  }

  // 兼容模式：无 provider 时走旧逻辑
  const configuredModel = source.model ?? CONSTANTS.DEFAULT_MODEL;
  const lockedModel = PRESET_MODELS[preset];
  return {
    rawPreset,
    preset,
    configuredModel,
    model: lockedModel ?? configuredModel,
    locked: Boolean(lockedModel),
    autoEscalate: preset === "auto" ? source.autoEscalate !== false : false,
  };
}
```

#### 2.4 `syncProvider()` 独立函数（`launcher.mjs`，约 1996 `syncWorkspace` 旁）

```js
syncProvider: async (providerId) => {
  const cfg = readConfig(configPath);
  const provider = cfg.providers?.find(p => p.id === providerId);
  if (!provider) return;

  cfg.activeProviderId = providerId;
  writeConfig(cfg, configPath);
  syncRuntimeConfig(cfg);

  // 回退不兼容的 preset/effort
  const newPreset = resolvePresetForProvider(cfg.preset ?? "auto", provider);
  const newEffort = resolveEffortForProvider(cfg.reasoningEffort ?? "max", provider);
  if (newPreset !== cfg.preset) cfg.preset = newPreset;
  if (newEffort !== cfg.reasoningEffort) cfg.reasoningEffort = newEffort;
  writeConfig(cfg, configPath);

  // 重建 client + loop（立即生效，不等 submitPrompt）
  const newApiKey = provider.apiKey;
  const newBaseUrl = provider.baseUrl;
  apiKey = newApiKey;
  baseUrl = newBaseUrl;
  if (apiKey) {
    client = new DeepSeekClient({ apiKey, baseUrl });
    loop = buildLoop(client, workspaceDir);
    ctx.loop = loop;
    refreshBalance();
    console.error(`[launcher] provider switched: ${providerId} (preset=${newPreset}, effort=${newEffort})`);
  }

  // 广播 settings 变更
  broadcastSettings?.(cfg);
},
```

#### 2.5 API 端点（`server-XGDBRWMB.js`）

在 `handleApi` switch 中新增（约 3679 `case "settings"` 后）：

```js
case "providers":
  return await handleProviders(method, rest, body, ctx);
```

新增 `handleProviders` 函数：

```js
async function handleProviders(method, rest, body, ctx) {
  if (method === "GET") {
    const cfg = readConfig(ctx.configPath);
    const providers = (cfg.providers ?? []).map(p => ({
      ...p,
      apiKey: p.apiKey ? redactKey(p.apiKey) : null,
      apiKeySet: Boolean(p.apiKey),
    }));
    return { status: 200, body: { providers, activeProviderId: cfg.activeProviderId ?? null } };
  }
  if (method === "POST" && rest[0] === "active") {
    // POST /api/providers/active { id: "xxx" }
    const parsed = JSON.parse(body || "{}");
    await ctx.syncProvider?.(parsed.id);
    return { status: 200, body: { ok: true } };
  }
  if (method === "POST" && rest[0] === "import") {
    // POST /api/providers/import { providers: [...] }
    const parsed = JSON.parse(body || "{}");
    const cfg = readConfig(ctx.configPath);
    const incoming = parsed.providers ?? [];
    const existing = cfg.providers ?? [];
    for (const p of incoming) {
      const idx = existing.findIndex(e => e.id === p.id);
      if (idx >= 0) existing[idx] = p; // 整体覆盖
      else existing.push(p);           // 追加
    }
    cfg.providers = existing;
    writeConfig(cfg, ctx.configPath);
    return { status: 200, body: { ok: true, count: existing.length } };
  }
  return { status: 404, body: { error: "not found" } };
}
```

#### 2.6 修改 `handleSettings` GET/POST（`server-XGDBRWMB.js:2999`）

- GET：响应增加 `providers`、`activeProviderId`、`providerCapabilities`（当前 provider 的 presets/efforts 可选值），供 UI 过滤按钮
- POST：`preset` 校验从 `VALID_PRESETS` 改为结合当前 provider capabilities 校验；`reasoningEffort` 同理

#### 2.7 `isThinkingModeModel` / `thinkingModeForModel` 适配（`chunk-2R4QCDOZ.js:6884-6893`）

当前硬编码 `deepseek-v4-flash`/`deepseek-v4-pro`。改为从 provider model 的 `thinkingMode` 字段读取：
- 若 model 在 provider.models 中有 `thinkingMode`，用该值
- 否则回退到现有硬编码逻辑（兼容无 provider 场景）

> ⚠️ **实测报告纠正**：同一个 `deepseek-v4-flash` 在官方支持 thinking，在本地 vLLM 部署**不支持**（`reasoning` 始终 null）。因此 `thinkingMode` 必须是 per-model per-provider 的属性，不能按模型 ID 全局判断。

> 注意：`chunk-2R4QCDOZ.js` 是上游编译产物，修改需谨慎。可通过 `launcher.mjs` 在创建 loop 时注入 `thinkingModeOverride` 配置，避免直接改 chunk。

#### 2.8 多模态适配（基于实测报告新增）

报告确认：DeepSeek 本地版明确拒绝图片输入（400: "not a multimodal model"），Qwen 支持图像识别。

当前 vision 配置在 `launcher.mjs:1609` 硬编码：
```js
"deepseek-v4-pro": { vision: true, visionDetail: "high" },
```

改造：
- `buildLoop` 时从 active provider 的 model 配置读取 `multimodal` 字段
- 切到不支持多模态的 provider 时，粘贴图片应在 Dashboard 前端拦截提示（而非发到 API 后报 400）
- Qwen 的 `multimodal: true` 时，vision 配置自动启用

#### 2.9 上下文长度适配（基于实测报告新增）

报告确认：DeepSeek 本地 1,048,576 tokens，Qwen 仅 81,920 tokens。

- schema 中 `maxContextLength` 字段供 launcher 参考
- `buildLoop` 时根据 `maxContextLength` 限制 `max_tokens`，避免超出上下文
- Dashboard 状态栏可选择性展示当前 provider 的上下文上限（可选，非必须）

#### 2.10 JSON Mode 适配（基于实测报告新增）

报告确认：Qwen 的 `response_format: json_object` 要求根节点为对象 `{}`，数组 `[]` 会报错。

- schema 中 `jsonModeRootObjectOnly` 字段标记此限制
- 若 Visionox 的 tool calling 参数解析依赖数组根节点 JSON，需在 Qwen provider 下加额外提示
- 保守方案：Qwen provider 下 tool calling 的 JSON 解析增加 try-catch 容错

### 步骤 3：Dashboard 改造（路径 B — 手术式修改压缩产物）

> ⚠️ **【修订】致命前提错误**：原方案步骤 3-4 声称"dashboard 源码在 `tep/dashboard/src/`，可以正规修改 UI 并重新 build"。经核实，此前提不成立：

| 维度 | 当前运行 (visionox-pkg) | 原方案要用的 (tep/dashboard) |
|------|------------------------|------------------------------|
| 版本 | 260623（基于上游 0.47.1 二开） | 0.53.2（上游最新） |
| 框架 | **Preact 10.22** | **React 19.2** |
| 二开补丁 | ~40 处（品牌化/admin/配色/会话恢复/开发者模式/搜索引擎…） | 零，纯上游原始代码 |
| git 跟踪 | ✅ 已提交 | ❌ `.gitignore` 第 57 行忽略 |

上游在 0.53.x 把 dashboard 从 Preact 迁到了 React 19。直接用 `tep/dashboard` build 替换 dist 等于：Preact→React 框架切换 + 跨 6 版本升级 + ~40 处二开补丁全丢失 + 不可复现（tep/ 被 gitignore）。**不可行。**

**修订方案——路径 B（手术式修改压缩产物）**：

**文件**：`src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js`（压缩产物）

与项目历史上所有 UI 修改（品牌化、admin、配色、会话恢复、开发者模式、搜索引擎选择器）保持一致，在压缩产物中增量添加。

#### 3.1 UI 布局设计

当前 `.header-pickers` 布局（`app.js:24382-24446`）：

```
[工作场景: 通用/编程/办公/设计] [effort: high/max] [preset: auto/flash/pro] [editMode: review/auto/yolo/admin]
```

新增 provider 后的目标布局：

```
[Provider▼] [工作场景: 通用/编程/办公/设计] [effort: high/max] [preset: auto/flash/pro] [editMode: review/auto/yolo/admin]
```

- provider 放在最左侧，用 `<select>` 下拉框（而非 mode-btn 分段控件），因为 provider 数量可能多且名称较长
- 切换 provider 后，effort/preset 按钮根据 provider capabilities 动态过滤（隐藏不支持的按钮）

#### 3.2 具体改动点（`app.js`）

**a) 新增 state（约 23688 行附近）**：
```js
const [providers, setProviders] = d2(null);
const [activeProviderId, setActiveProviderId] = d2(null);
const [providerCaps, setProviderCaps] = d2(null);
```

**b) 加载 provider 数据（约 24306 行 `api("/overview")` 附近）**：
```js
const pr = await api("/providers");
setProviders(pr.providers ?? []);
setActiveProviderId(pr.activeProviderId);
const caps = pr.providers?.find(p => p.id === pr.activeProviderId);
setProviderCaps(getCaps(caps)); // { presets: [...], efforts: [...] }
```

**c) 新增 provider 切换函数**：
```js
const switchProvider = q2(async (id) => {
  await api("/providers/active", { method: "POST", body: { id } });
  // 后端会回退 preset/effort 并重建 client
  // 前端刷新 overview 拿新状态
  const o3 = await api("/overview");
  setPresetLocal(o3.preset);
  setEffortLocal(o3.reasoningEffort);
  const pr = await api("/providers");
  setProviders(pr.providers);
  setActiveProviderId(id);
  const caps = pr.providers?.find(p => p.id === id);
  setProviderCaps(getCaps(caps));
  showToast(`已切换到 ${caps?.name ?? id}`, "info");
}, []);
```

**d) 渲染 provider `<select>`（约 24382 行 `.header-pickers` 开头）**：
```js
${providers ? html4`
  <select
    class="provider-select"
    value=${activeProviderId ?? ""}
    onChange=${(e) => switchProvider(e.target.value)}
    title="模型服务商"
  >
    ${providers.map(p => html4`<option value=${p.id} selected=${p.id === activeProviderId}>${p.name}</option>`)}
  </select>
` : null}
```

**e) effort/preset 按钮过滤（约 24402/24417 行）**：

effort 按钮：
```js
// 原: ${["high", "max"].map(...)}
// 改: ${(providerCaps?.efforts ?? ["high", "max"]).map(...)}
```

preset 按钮：
```js
// 原: ${["auto", "flash", "pro"].map(...)}
// 改: ${(providerCaps?.presets ?? ["auto", "flash", "pro"]).map(...)}
```

**f) Settings 面板增加 provider 管理（约 27851 行 `sectionApi` 附近）**：
- 新增 "模型服务商" section
- 展示 provider 列表（名称、baseUrl、apiKeySet 状态）
- JSON 导入 textarea + 导入按钮
- 调用 `POST /api/providers/import`

**g) i18n 补充（约 19299/19965 行）**：
```js
// en
provider: "Provider",
providerImport: "Import JSON",
providerImportBtn: "Import",
// zh-CN
provider: "服务商",
providerImport: "导入 JSON",
providerImportBtn: "导入",
```

#### 3.3 CSS 改动（`app.css`）

在 `.mode-picker` 附近新增：
```css
.provider-select {
  height: 28px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  padding: 0 var(--space-2);
  cursor: pointer;
}
.provider-select:hover {
  border-color: var(--border-strong);
}
```

### 步骤 4：构建并替换 dashboard

**【修订】** 原步骤 4（`tep/dashboard/` build → 替换 dist）因路径 B 不依赖 tep，改为：

- 修改 `app.js` 后，若 `tauri.conf.json` 的 `bundle.resources` 已包含 `visionox-pkg/**/*`，`cargo build --release` 会自动嵌入新产物。
- 开发调试可直接替换 `target/release/resources/server/visionox-pkg/dashboard/dist/app.js` 后运行 exe。

### 步骤 5：验证

- 导入用户提供的 JSON，确认三个 provider 都写入 `config.json`。
- **【修订】验证 config.json 迁移**：用旧版 config.json（仅顶层 `apiKey`/`baseUrl`）启动，确认自动迁移为 `providers[0]`。
- 在 UI 切换 provider，确认：
  - 状态栏 provider 下拉框显示正确。
  - **effort 按钮动态过滤**：切到本地 provider 只显示 `high`，切回官方显示 `high`/`max`。
  - **preset 按钮动态过滤**：切到本地 provider 只显示 `flash`，切回官方显示 `auto`/`flash`/`pro`。
  - 发送消息后，后端使用正确的 `baseUrl` + `apiKey` + `model`。
  - **切换后立即生效**（验证 `syncProvider()` 独立调用，不等下次 `submitPrompt`）。
- **验证 Qwen 模型**：切到本地 Qwen，发送消息，确认 API 请求使用 `qwen3.5-397b-a17b` 模型，thinking 模式为 disabled。
- **验证 autoEscalate**：切到官方 provider + preset=auto，触发困难轮次，确认自动升级到 pro；切到本地 provider 确认不升级。
- **【实测报告新增】验证 thinkingMode**：切到本地 DeepSeek，发送消息，确认不发送 thinking 参数（`reasoning` 始终 null）；切回官方确认 thinking 正常。
- **【实测报告新增】验证多模态**：切到本地 DeepSeek，粘贴图片，确认前端拦截提示"不支持多模态"；切到 Qwen 确认图片正常发送识别。
- **【实测报告新增】验证上下文长度**：切到 Qwen，发送超长文本（>81K tokens），确认 max_tokens 被限制，不报 API 错误。
- **【实测报告新增】验证 JSON Mode**：切到 Qwen，触发 tool calling，确认 JSON 根节点为对象的场景正常；若遇到数组根节点场景确认有容错处理。
- 关闭重启后，保留上次激活的 provider。

---

## 四、相关文件清单

| 文件 | 作用 | 路径 B 是否涉及 |
|------|------|:---:|
| `src-tauri/resources/server/launcher.mjs` | Node sidecar，负责模型配置、API 请求、后端逻辑 | ✅ |
| `src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js` | 当前运行的 dashboard（压缩产物，路径 B 直接改此文件） | ✅ |
| `src-tauri/resources/server/visionox-pkg/dashboard/app.css` | Dashboard 样式（provider 下拉框样式） | ✅ |
| `src-tauri/src/lib.rs` | Tauri Rust 主入口 | — |
| `src/index.html` | Tauri 加载页壳 | — |
| `~/.visionox/config.json` | 用户配置文件（新增 `providers` / `activeProviderId`） | ✅ |

> **【修订】** 删除原清单中 `tep/dashboard/src/*` 四项。路径 B 不依赖 tep/dashboard 源码（Preact/React 不兼容 + gitignore + 二开补丁丢失，见步骤 3 修订说明）。若未来走路径 C（全量升级），文件清单需重新评估。

---

## 五、备注

- 已完成的工作已通过 `cargo test` 和 release build 验证，并已提交（1.0.2）推送到 Gitee。
- Provider 功能尚未开始编码，当前停留在方案讨论和 schema 确认阶段。
- **【修订】** 原备注"由于 dashboard 源码在 `tep/dashboard/src/`，本次可以正规修改 UI 并重新 build"——此前提不成立。tep/dashboard 是上游 0.53.2 React 19 源码，与当前 0.47.1 Preact 二开版本不兼容，且被 `.gitignore` 忽略。本次采用路径 B（手术式修改压缩产物），与历史所有 UI 修改方式一致。路径 C（全量升级）作为独立项目另立项。

---

## 六、评审记录（2026-06-25）

本节为评审补充，记录修订原因供后续维护者参考。

| # | 原方案问题 | 严重度 | 修订内容 |
|---|-----------|:---:|---------|
| R1 | 步骤 3-4 前提错误：声称可基于 `tep/dashboard/src/` build 替换 dist | 致命 | tep/dashboard 是上游 0.53.2 React 19 源码，与当前 0.47.1 Preact 二开版本框架+版本双重不兼容，且被 gitignore。改为路径 B（手术式改压缩产物）。 |
| R2 | commit 引用错误：根因写 `09e7ca4d` 改为 iframe | 事实错误 | 引入 iframe 的是 `03b21c81`。`09e7ca4d` 是文件路径粘贴功能，与 iframe 无关。 |
| R3 | 根因"更深层原因"归因到 iframe 引入时刻 | 事实错误 | `03b21c81` 版本的 index.html 是纯静态加载页（无 JS），不存在 IIFE 也不存在 invoke 调用。"未等待 invoke 就绪"是后续补丁引入恢复逻辑后才出现的问题。 |
| R4 | config.json 迁移策略缺失 | 设计缺陷 | 现有顶层 `apiKey`/`baseUrl`（单 provider）需自动迁移为 `providers[0]`，原方案未提及。 |
| R5 | provider 切换耦合 `syncWorkspace` | 设计缺陷 | provider 切换是独立动作，不应等下次 `submitPrompt` 才生效。改为独立 `syncProvider()`。 |
| R6 | "后端命令"命名混淆 | 术语错误 | 项目实际用 HTTP API 风格（`/api/settings` 等），非 Tauri command。改为 `/api/providers` RESTful 路由。 |
| R7 | schema 缺少 preset 维度 | 设计缺陷 | `flash` 是 preset，`high` 是 effort，不同维度。原 schema 只有 `efforts`，需补 `presets` 字段。 |
| R8 | 导入语义边界未明确 | 设计缺陷 | 同 `id` 但 `models` 列表不同时，整体覆盖还是合并？需在 step 1 明确。 |
| R9 | schema effort 值错误 | 事实错误 | 原 schema 写 `low`/`medium`/`high`/`max`，代码 `VALID_EFFORTS` 只认 `high`/`max`。已修正。 |
| R10 | thinkingMode 硬编码 | 适配风险 | `isThinkingModeModel` 硬编码 flash/pro，Qwen 不在列表。schema 增加 `thinkingMode` 字段，Qwen 设为 `disabled`。 |
| R11 | autoEscalate/escalationModel 硬编码 | 适配风险 | `ESCALATION_MODEL` 硬编码 `deepseek-v4-pro`，本地 provider 无 pro 模型。改为 provider 级别声明 `autoEscalate`/`escalationModel`。 |
| R12 | 本地 DeepSeek thinkingMode 误写 enabled | 事实错误 | 实测报告确认本地 vLLM 部署的 deepseek-v4-flash 不支持 thinking（`reasoning` 始终 null）。已改为 `disabled`。同一模型 ID 在官方和本地能力不同，thinkingMode 必须是 per-model per-provider 属性。 |
| R13 | 缺少多模态能力维度 | 设计缺陷 | 实测报告确认 DeepSeek 本地版拒绝图片（400），Qwen 支持图像识别。schema 增加 `multimodal` 字段，步骤 2.8 补充多模态适配。 |
| R14 | 缺少上下文长度维度 | 设计缺陷 | 实测报告确认 DeepSeek 本地 1M tokens，Qwen 仅 81K tokens。schema 增加 `maxContextLength` 字段，步骤 2.9 补充上下文适配。 |
| R15 | 缺少 JSON Mode 限制维度 | 设计缺陷 | 实测报告确认 Qwen JSON Mode 要求根节点为对象。schema 增加 `jsonModeRootObjectOnly` 字段，步骤 2.10 补充 JSON 适配。 |
