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

**建议的 JSON Schema（待用户确认）**：

```json
{
  "providers": [
    {
      "id": "deepseek-official",
      "name": "DeepSeek 官方",
      "baseUrl": "https://api.deepseek.com",
      "apiKey": "sk-...",
      "models": [
        { "id": "deepseek-v4-flash", "name": "Flash", "efforts": ["low", "medium", "high"] },
        { "id": "deepseek-v4-pro",   "name": "Pro",   "efforts": ["low", "medium", "high", "max"] }
      ],
      "defaultModel": "deepseek-v4-flash"
    },
    {
      "id": "local-deepseek",
      "name": "本地 DeepSeek",
      "baseUrl": "http://10.40.5.70:8001/v1",
      "apiKey": "deepseek-v4-flash-base-8c72nc00",
      "models": [
        { "id": "deepseek-v4-flash", "name": "Flash", "efforts": ["high"] }
      ],
      "defaultModel": "deepseek-v4-flash"
    },
    {
      "id": "local-qwen",
      "name": "本地 Qwen",
      "baseUrl": "http://10.40.5.70:8000/v1",
      "apiKey": "qwen35-secret-8c72nc00",
      "models": [
        { "id": "qwen3.5-397b-a17b", "name": "Qwen3.5-397B", "efforts": ["high"] }
      ],
      "defaultModel": "qwen3.5-397b-a17b"
    }
  ],
  "activeProviderId": "deepseek-official"
}
```

**导入语义**：追加/合并，同 `id` 则覆盖 `apiKey` 等字段。

**兼容现有 UI 选项的策略**：
- 顶部状态栏新增 **provider 下拉框**。
- 切换 provider 时，根据 `models` 和 `efforts` 过滤可用选项。
- 若当前选中的 model/effort 在新 provider 不支持，自动回退到该 provider 的 `defaultModel` 和可用 effort。
- `pro / flash / auto / high / max` 等选项保留，但对本地 provider 隐藏或禁用不支持的项。

**待确认点**：
- `flash` 是 **preset**（模型预设），`high` 是 **effort**（推理强度），两者是不同维度。当前 schema 的 `models[].efforts` 只覆盖 effort 维度，**缺少 preset 维度**。需确认本地模型"只支持 flash/high"是否意味着：preset 仅 `flash`、effort 仅 `high`？若是，schema 应增加 `presets` 字段：
  ```json
  { "id": "deepseek-v4-flash", "name": "Flash", "presets": ["flash"], "efforts": ["high"] }
  ```
- 确认上述 JSON schema 是否符合预期。
- 导入语义边界：同 `id` 但 `models` 列表不同时，是整体覆盖还是合并 models？需明确。

---

## 三、实施计划（Provider 切换功能）

> ⚠️ 本节原方案存在若干问题，已按评审意见修订。修订以 **【修订】** 标注。

### 步骤 1：确定 JSON schema

- 与用户确认 provider 配置字段、导入格式、本地模型 preset/effort 映射。
- schema 补充 `presets` 维度（原 schema 缺失，只有 `efforts`）。
- 明确导入语义：同 `id` 整体覆盖还是合并。
- 将 schema 写入 `docs/provider-config-schema.md`（可选）。

### 步骤 2：后端改造 `launcher.mjs`

**文件**：`src-tauri/resources/server/launcher.mjs`

- 在 `~/.visionox/config.json` 中新增 `providers` 和 `activeProviderId` 字段。
- **【修订】config.json 迁移策略**（原方案缺失）：现有顶层 `apiKey` / `baseUrl`（单 provider）需自动迁移。策略：首次检测到无 `providers` 字段时，将旧 `apiKey`/`baseUrl` 迁移为 `providers[0]`（id=`legacy`），设为 active；迁移后旧字段保留但标记 deprecated，后续读取统一走 `providers`。
- 新增函数：
  - `loadProviders()`：读取 providers 列表。
  - `getActiveProvider()`：返回当前激活 provider。
  - `setActiveProvider(id)`：切换激活 provider。
  - `importProviders(json)`：合并/覆盖 providers（按 step 1 确认的语义）。
- 修改 `loadApiKey()` / `loadBaseUrl()`：从激活 provider 读取。
- 修改 `effectiveModelConfig()`：根据 provider 支持的 `models` / `presets` / `efforts` 做校验和回退。
- **【修订】API 路由风格**（原方案称"后端命令"，实际项目用 HTTP API）：遵循 `/api/providers` RESTful 路由：
  - `GET /api/providers` — 列表
  - `POST /api/providers/active` — 切换激活
  - `POST /api/providers/import` — JSON 导入
- **【修订】provider 切换独立 `syncProvider()`**（原方案耦合 `syncWorkspace`）：provider 切换是独立动作，不应等下次 `submitPrompt` 才生效。`POST /api/providers/active` 调用后立即重建 client + loop。`syncWorkspace` 保持职责单一（只管 workspace）。

### 步骤 3：Dashboard 改造

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

与项目历史上所有 UI 修改（品牌化、admin、配色、会话恢复、开发者模式、搜索引擎选择器）保持一致，在压缩产物中增量添加：

- `statusbar` 区域：在 model/effort 下拉左侧新增 provider 下拉框（`<select>`），复用现有 `api()` fetch 封装调用 `/api/providers`。
- `settings` Models 页面：注入 provider 列表展示 + JSON 导入按钮，调用 `/api/providers/import`。
- 切换 provider 后，刷新 settings 并更新状态栏显示。
- i18n：补 `provider` 相关中英文翻译字符串。

> 维护成本：压缩产物中变量名混淆（如 `d2(`、`q2(`、`y2(`），改大功能比源码痛苦，但零框架风险、零版本跳跃。

> **备选——路径 C（先全量升级再加功能）**：作为独立"上游升级"项目单独立项，先完成 0.47.1→0.53.2 全量升级 + 二开补丁重新应用 + 回归验证，再在此基础上加 provider。不要把升级和加功能混在一个迭代里。

### 步骤 4：构建并替换 dashboard

**【修订】** 原步骤 4（`tep/dashboard/` build → 替换 dist）因路径 B 不依赖 tep，改为：

- 修改 `app.js` 后，若 `tauri.conf.json` 的 `bundle.resources` 已包含 `visionox-pkg/**/*`，`cargo build --release` 会自动嵌入新产物。
- 开发调试可直接替换 `target/release/resources/server/visionox-pkg/dashboard/dist/app.js` 后运行 exe。

### 步骤 5：验证

- 导入用户提供的 JSON，确认三个 provider 都写入 `config.json`。
- **【修订】验证 config.json 迁移**：用旧版 config.json（仅顶层 `apiKey`/`baseUrl`）启动，确认自动迁移为 `providers[0]`。
- 在 UI 切换 provider，确认：
  - 状态栏显示正确。
  - 可用 model/preset/effort 自动过滤（原方案漏了 preset 维度）。
  - 发送消息后，后端使用正确的 `baseUrl` + `apiKey` + `model`。
  - **【修订】切换后立即生效**（验证 `syncProvider()` 独立调用，不等下次 `submitPrompt`）。
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
