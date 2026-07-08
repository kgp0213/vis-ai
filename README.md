# Visionox Desktop

AI 编程代理桌面应用 — 基于 DeepSeek 的 Tauri v2 跨平台桌面 AI 助手（Windows / Ubuntu）。

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🤖 **AI 编程代理** | 多模型支持（DeepSeek / 硅基流动 / OpenAI 兼容）、40+ 内置工具（文件/Shell/Web/Memory/MCP/Skill/Plan），可扩展 |
| 🧠 **8 层记忆系统** | Soul 身份基座 → 项目记忆 → 工作模式 → 场景记忆 → 编码规范 → 自定义规则 → 技能索引 → 持久记忆 → 会话记忆，逐层注入 |
| 🎯 **4 种工作模式** | 通用 / 编程 / 办公 / 设计，一键切换即时生效，每种模式有独立的提示词、技能集和场景记忆 |
| ⏱️ **任务计划** | 支持一次性、每日、每周、自定义间隔任务，可立即测试运行，执行结果集中展示 |
| 📚 **`/learn` 学习命令** | 技能萃取、项目 onboarding、语义索引问答、导师模式、SM-2 间隔重复学习追踪 |
| 📎 **OfficeCLI 办公集成** | 内置 OfficeCLI MCP，原生操作 Word/Excel/PPT，替代 6 个旧 Office 技能 |
| 🔍 **多引擎搜索** | 4 个搜索引擎热切换（Bing 国内版 / Mojeek / SearXNG / Bing API），默认 Bing 免费可用 |
| 📋 **剪贴板增强** | `Ctrl+V` 直接粘贴截图为附件、粘贴文件/文件夹为完整路径，支持 Windows 与 Linux 常见剪贴板环境 |
| 📖 **Markdown 阅读器** | 内置 Markdown 打开与预览，支持顶部按钮手动选择、双击文件关联、源码/预览切换与可调整大小的阅读窗口 |
| 🎨 **8 套配色方案** | 深色 / 浅色 / 暖沙 / 冷灰 / 柔绿 / 深炭灰 / 午夜墨蓝 / 浓缩咖啡，下拉框实时切换 |
| 🧩 **Superpowers 技能包** | 内置 30+ 工作流技能（需求梳理、方案规划、代码评审、系统调试、TDD 等），安装即用 |
| 💬 **会话管理** | 历史会话搜索/预览/导出/继续，跨会话记忆持久化，工作场景自动恢复 |
| 🔌 **MCP 协议支持** | stdio / SSE / Streamable HTTP 三种传输，可接入任意 MCP Server 扩展能力 |
| 🛡️ **3 级编辑模式** | auto（自动）/ yolo（全自动）/ admin（无限制），灵活控制 AI 自主度 |
| 📦 **绿色便携** | Windows NSIS 安装包，开箱即用；Ubuntu deb/AppImage 同步支持 |

---

## 🚀 快速开始

### 环境要求

- **Windows 10/11**（WebView2 系统自带）或 **Ubuntu 22.04+**（需安装系统依赖，见下文构建章节）
- **DeepSeek API Key**（或其他兼容 OpenAI 接口的 API Key）

> **Ubuntu 注意**：Office 文档处理（OfficeCLI）为 Windows 专属功能，Ubuntu 上不可用；其余功能完整。

### 安装

1. 下载最新 `Visionox_x.x.x_x64-setup.exe` 安装包
2. 运行安装，选择安装目录
3. 启动 Visionox，在设置页填入 API Key
4. 开始对话

### 基本使用

| 操作 | 方式 |
|------|------|
| 切换工作模式 | 主界面右上角按钮（通用/编程/办公/设计），切换后即时生效 |
| 切换模型 | 对话框上方 auto/flash/pro 预设，或底部「🤖 模型」面板 |
| 管理任务 | 左侧「任务」页面新建定时任务、测试运行、查看执行结果 |
| 粘贴图片/文件夹 | `Ctrl+V` 粘贴剪贴板中的截图、文件路径或文件夹路径 |
| 保存对话产物 | 助手输出代码/Markdown/HTML 等内容时，可直接复制或另存 |
| 阅读 Markdown | 顶部「打开 MD」选择文档，或在系统中双击 `.md/.markdown` 文件用 Visionox 打开 |
| 导入模型配置 | 底部「🤖 模型」面板 → 选择 JSON 文件批量导入 Provider |
| 管理记忆 | 设置页「记忆」面板，或对话中说「记住…」 |
| 学习命令 | 输入 `/learn help` 查看所有学习功能 |
| 语义索引 | Dashboard「高级 → 语义」面板构建索引，对话中自然语言检索 |

---

## 🆕 v1.20 更新亮点

- **任务与报告合一**：报告能力融合进任务模块，支持一次性、每日、每周和自定义间隔任务，可测试运行并集中查看最近结果。
- **对话产物更好用**：代码、Markdown、HTML、脚本等输出可直接复制、另存、预览和打开目录，生成文件会在对话侧边卡片中持续跟踪。
- **内置 Markdown 阅读器**：新增「打开 MD」入口和系统文件关联，预览窗口支持源码/预览切换、手动缩放，适合在没有 Markdown 阅读器的电脑上直接查看文档。
- **会话与记忆整理增强**：历史会话支持搜索、预览、导出、继续和整理建议，高优先级记忆注入更稳定，模型更容易找到需要的历史上下文。
- **剪贴板与本地文件体验优化**：截图粘贴更快，复制文件或文件夹后可直接把路径贴入对话框，Windows 与 Linux 常见剪贴板环境均可使用。

---

## 🧠 语义索引与个人知识库

Visionox 支持对工作区目录建立语义索引，把代码、文档、笔记等变成可自然语言检索的个人知识库。

### 工作原理

1. 把文本文件按窗口切分为 chunk。
2. 通过 embedding 模型生成向量并保存到本地索引。
3. 对话中用自然语言提问时，模型自动调用 `semantic_search` 找到最相关的片段。

### 配置本地 embedding 模型

如果局域网内已部署兼容 OpenAI 的 embedding 服务，可在「语义」面板选择 `openai-compat` 并按如下参数配置：

| 配置项 | 值 |
|--------|-----|
| `provider` | `openai-compat` |
| `api_url` | `http://10.71.4.202:10307/v1/embeddings` |
| `model_name` | `Qwen3-Embedding` |
| `api_key` | `qwen3-embeding-j29c7suqz` |

配置完成后点击「构建索引」，即可向该本地服务请求 embedding。

### 使用方式

- **Dashboard 图形界面**：「高级 → 语义」→ 选择 provider / 模型 → 构建索引。
- **斜杠命令**：
  - `/learn index ./docs` —— 只索引 docs 目录
  - `/learn ask 如何配置 MCP？` —— 基于已索引内容问答

### 重要说明

- 索引范围是**当前工作区目录**，默认排除 `node_modules`、`.git`、`dist`、`target`、二进制文件等，并遵守 `.gitignore`。
- 索引**不会自动更新**：工作区文件修改后需要重新构建或增量索引。
- 每个工作区的索引相互隔离，切换工作区后需要重新构建。
- 语义索引**不索引对话记录**；查找历史对话请使用 `list_sessions` / `read_session`。

更详细的说明见 [`docs/visionox_indexing_guide.html`](docs/visionox_indexing_guide.html)。

---

## 📚 文档导航

详细文档见 [`docs/`](docs/) 目录：

| 文档 | 内容 |
|------|------|
| [用户使用指南](docs/USER_GUIDE.md) | 记忆系统、工作模式、`/learn` 命令、OfficeCLI 办公 |
| [功能详解](docs/FEATURES.md) | 8 层记忆、ECC 集成、编辑模式、搜索配置 |
| [架构说明](docs/ARCHITECTURE.md) | 系统架构、项目结构、技术栈 |
| [更新日志](docs/CHANGELOG.md) | 版本变更记录 |
| [OfficeCLI 指南](docs/OFFICECLI_GUIDE.md) | Office 办公功能配置与使用 |
| [开发指南](docs/DEVELOPMENT.md) | 二次开发、构建、调试 |
| [Skill 创建](docs/skill-creation-guide.md) | 自定义技能开发完整指南 |
| [设计系统](docs/UI_DESIGN_SYSTEM.md) | Design Tokens 与配色方案 |

---

## 🏗️ 技术架构

```
Tauri Shell (Rust)
  ├─ WebView2 窗口 → 加载页 → Dashboard SPA
  ├─ Node.js Launcher → AI Agent 运行时
  ├─ 进程管理（JobObject + 崩溃监控 + 健康检查）
  └─ 系统托盘（最小化/退出）

Node.js Agent
  ├─ DeepSeekClient + CacheFirstLoop
  ├─ 40+ 工具（文件/Shell/Web/Memory/MCP/Skill）
  └─ Dashboard HTTP Server (127.0.0.1)
```

- **桌面壳**：Rust + Tauri v2（跨平台：Windows / Ubuntu）
- **AI 运行时**：Node.js + DeepSeek API
- **前端界面**：WebView2 / WebKitGTK + Preact SPA
- **打包分发**：Windows NSIS 安装器 / Ubuntu deb + AppImage

---

## 🔧 开发构建

### 环境要求

- **Rust** 1.94+
- **Node.js** 22+
- **Windows 10/11** + WebView2，或 **Ubuntu 22.04+**（需安装系统依赖，见下文）

### 首次克隆后获取运行时二进制

`node.exe`（88MB）和 `officecli.exe`（32MB）因体积过大被 `.gitignore` 排除，未纳入仓库。克隆后需运行一次下载脚本：

```bash
npm run fetch:binaries          # 自动检测平台，下载对应 Node.js 运行时
npm run fetch:binaries -- --force  # 强制重新下载
```

- **Windows**：脚本从 [nodejs.org](https://nodejs.org/dist/) 下载 Node.js v25.2.1 并提取 `node.exe` 到 `src-tauri/resources/server/`；`officecli.exe` 无公开下载源，需从已有安装复制（`%LOCALAPPDATA%\Visionox\resources\server\officecli.exe`），缺失时 Office 文档功能自动禁用。
- **Ubuntu**：脚本跳过下载，依赖系统 `nodejs`（≥ 22）；`officecli.exe` 不需要。

> **提示**：如果不运行此脚本，Windows 上 `npx tauri dev` 会因找不到 `node.exe` 而失败（除非系统 PATH 中有 `node`）；Ubuntu 上不受影响（`lib.rs` 自动 fallback 到系统 `node`）。

### 项目结构

```
visionox-desktop/
├── src/                           # 前端启动壳（index.html，重定向到 dashboard）
├── src-tauri/                     # Tauri 桌面壳（Rust）
│   ├── src/lib.rs                 # Rust 主逻辑（跨平台：Windows JobObject / Unix setsid）
│   ├── src/main.rs                # 入口
│   ├── resources/server/          # Node.js 运行时资源
│   │   ├── launcher.mjs           # ★ 核心入口（AI Agent + HTTP Server + 斜杠命令）
│   │   ├── learn.mjs              # /learn 学习模块
│   │   ├── learn-track.mjs        # SM-2 追踪模块
│   │   ├── learn-sandbox-impl.mjs # 沙箱检查
│   │   ├── node.exe               # 嵌入的 Node.js（gitignore 排除，需 npm run fetch:binaries）
│   │   ├── officecli.exe          # Office MCP 工具（仅 Windows，gitignore 排除，需手动复制）
│   │   └── visionox-pkg/          # ★ 核心包（reasonix npm 包）
│   │       ├── dist/cli/          # 打包后的 JS chunk 文件
│   │       ├── dist/index.js      # 主入口
│   │       ├── dashboard/dist/    # 前端 SPA（app.js + app.css）
│   │       ├── dashboard/index.html
│   │       └── package.json       # reasonix 版本
│   ├── tauri.conf.json            # Tauri 配置（跨平台 bundle）
│   └── Cargo.toml                 # Rust 依赖（windows-sys / nix 平台条件）
├── docs/                          # 项目文档
├── scripts/
│   ├── check-bundle-patches.js    # 发布前校验本地 bundle 补丁是否仍存在
│   ├── restore-visionox-pkg.js    # 维护时恢复指定 reasonix 包
│   └── cherry-claude.cjs          # CLAUDE.md 记忆逻辑补丁脚本
```

### 快速构建（开发测试）

适用于修改了 `launcher.mjs`、`visionox-pkg/dist/cli/*.js`、`app.js`、`app.css` 后的快速构建：

```bash
# 1. 切换到项目根目录
cd C:\Users\Lenovo\Documents\vis-ai

# 2. 确保没有进程占用文件（构建需要锁定 node.exe）
taskkill /F /IM visionox-desktop.exe 2>nul
taskkill /F /IM node.exe 2>nul

# 3. 构建（不生成安装包）
npx tauri build --no-bundle
```

构建产物在 `src-tauri\target\release\visionox-desktop.exe`。

如需生成 NSIS 安装包：

```bash
npm run tauri:build -- --bundles nsis
```

安装包产物在 `src-tauri\target\release\bundle\nsis\`。

### 即时测试（不重新构建）

如果只想快速迭代测试，不重新编译 Rust：

```bash
# 源码目录
SRC=C:\Users\Lenovo\Documents\vis-ai\src-tauri\resources\server
# AppData 安装目录
APP=C:\Users\Lenovo\AppData\Local\Visionox\resources\server

# 复制修改的文件到 AppData
cp "$SRC\launcher.mjs"                    "$APP\launcher.mjs"
cp "$SRC\visionox-pkg\dist\cli\*.js"      "$APP\visionox-pkg\dist\cli\"
cp "$SRC\visionox-pkg\dashboard\dist\app.js" "$APP\visionox-pkg\dashboard\dist\app.js"
cp "$SRC\visionox-pkg\dashboard\app.css"  "$APP\visionox-pkg\dashboard\app.css"
```

然后重启 Visionox 即可生效。

### 构建时的常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `os error 32` (文件被占用) | visionox-desktop.exe 或 node.exe 正在运行 | `taskkill /F /IM visionox-desktop.exe` |
| `server module import failed` | `visionox-pkg` 版本不匹配（chunk 文件名变了） | 从 AppData 恢复旧版 visionox-pkg，不要运行 `restore-visionox-pkg.js` |
| `learn-sandbox-impl.mjs` 缺失 | 文件未在 `tauri.conf.json` 的 `resources` 列表和 `lib.rs` 的 `NEEDED` 列表中 | 确认两个配置都已添加该文件 |

### ⚠️ 重要提醒

**常规开发和构建不要运行 `scripts/restore-visionox-pkg.js`。** 源码中该脚本会从 npm 拉取 `reasonix` 包，并在目标缺失或使用 `--force` 时删除并重建 `src-tauri/resources/server/visionox-pkg`，这会覆盖本项目对 `visionox-pkg/dist/`、`visionox-pkg/dashboard/dist/app.js` 和 `visionox-pkg/dashboard/app.css` 的本地补丁。

`package.json` 中的 `restore:pkg` 已改为保护入口，会直接拒绝执行。确实需要更新上游包时，先备份并重新迁移本地补丁，再运行 `npm run restore:pkg:danger -- --force`，最后执行 `npm run check:bundle-patches` 验证 chunk 文件名、`launcher.mjs` 导入路径和 Dashboard 功能补丁点。

### 打包安装包（NSIS）

生成可分发的 Windows 安装程序：

```bash
# 确保没有进程占用
taskkill /F /IM visionox-desktop.exe 2>nul
taskkill /F /IM node.exe 2>nul

# 完整构建 + 打包 NSIS 安装器
npm run tauri:build -- --bundles nsis
```

产物在 `src-tauri\target\release\bundle\nsis\`：
- `Visionox_1.20.0_x64-setup.exe` — NSIS 安装程序

**安装包配置**（`tauri.conf.json` → `bundle`）：

| 配置项 | 值 | 说明 |
|---|---|---|
| `targets` | `"all"` | 按构建平台自动选择（Windows: nsis / Ubuntu: deb+appimage） |
| `installMode` | `currentUser` | 当前用户安装（无需管理员权限） |
| `resources` | 列表见配置文件 | Windows 打包含 `node.exe`/`officecli.exe`；Ubuntu 用 `tauri.linux.conf.json` 覆盖排除 |
| 注意 | `--no-bundle` 跳过此步骤 | 开发测试时使用 |

### Ubuntu 构建

#### 安装系统依赖

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  nodejs unzip
```

> Ubuntu 不内嵌 `node.exe`，依赖系统 `nodejs`（≥ 22）。如系统 Node 版本过低，可用 [NodeSource](https://github.com/nodesource/distributions) 安装新版。

#### 开发构建

```bash
cd /path/to/vis-ai
npx tauri build --no-bundle
```

构建产物在 `src-tauri/target/release/visionox-desktop`。

#### 打包 deb / AppImage

```bash
npx tauri build
```

产物在 `src-tauri/target/release/bundle/`：
- `deb/visionox_1.20.0_amd64.deb` — Debian 安装包
- `appimage/visionox_1.20.0_amd64.AppImage` — 免安装可执行文件

> **功能差异**：Ubuntu 上 OfficeCLI（Word/Excel/PPT 操作）不可用，`launcher.mjs` 会自动跳过 MCP 注入并打日志，其余功能完整。剪贴板文件/文件夹路径粘贴依赖系统 `xclip` 或 `wl-clipboard`。

---

## 📄 License

MIT
