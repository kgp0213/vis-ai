# Visionox Desktop

AI 编程代理桌面应用 — 基于 DeepSeek 的 Tauri v2 Windows 桌面 AI 助手。

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🤖 **AI 编程代理** | 多模型支持（DeepSeek / 硅基流动 / OpenAI 兼容）、33+ 内置工具（文件/Shell/Web/Memory/MCP），可扩展 |
| 🧠 **8 层记忆系统** | Soul 身份 → 项目记忆 → 工作模式 → 场景记忆 → 编码规范 → 自定义规则 → 技能索引 → 持久记忆 → 会话记忆，逐层注入 |
| 🎯 **4 种工作模式** | 通用 / 编程 / 办公 / 设计，一键切换即时生效，每种模式有独立的提示词、技能集和场景记忆 |
| 📊 **对话报告** | 基于历史会话生成日报/周报/年报，标题含日期，提示词分离保护用户自定义跨升级不丢 |
| 📚 **`/learn` 学习命令** | 技能萃取、项目 onboarding、语义索引问答、导师模式、SM-2 间隔重复学习追踪 |
| 📎 **OfficeCLI 办公集成** | 内置 OfficeCLI MCP，原生操作 Word/Excel/PPT，替代 6 个旧 Office 技能 |
| 🔍 **多引擎搜索** | 4 个搜索引擎热切换（Bing 国内版 / Mojeek / SearXNG / Bing API），默认 Bing 免费可用 |
| 📋 **剪贴板增强** | `Ctrl+V` 直接粘贴图片为附件、粘贴文件为路径，支持 OneDrive/Outlook/远程桌面等复杂场景 |
| 🎨 **8 套配色方案** | 深色 / 浅色 / 暖沙 / 冷灰 / 柔绿 / 深炭灰 / 午夜墨蓝 / 浓缩咖啡，下拉框实时切换 |
| 🧩 **Superpowers 技能包** | 内置 14+ 工作流技能（需求梳理、方案规划、代码评审、系统调试、TDD 等），安装即用 |
| 💬 **会话管理** | 历史会话保存/删除/继续，跨会话记忆持久化，工作场景自动恢复 |
| 🔌 **MCP 协议支持** | stdio / SSE / Streamable HTTP 三种传输，可接入任意 MCP Server 扩展能力 |
| 🛡️ **4 级编辑模式** | review（需审批）/ auto（自动）/ yolo（全自动）/ admin（无限制），灵活控制 AI 自主度 |
| 📦 **绿色便携** | Windows NSIS 安装包，开箱即用，无需配置 Node.js/Python 环境 |

---

## 🚀 快速开始

### 环境要求

- **Windows 10/11**（WebView2 系统自带）
- **DeepSeek API Key**（或其他兼容 OpenAI 接口的 API Key）

### 安装

1. 下载最新 `Visionox_x.x.x_x64-setup.exe` 安装包
2. 运行安装，选择安装目录
3. 启动 Visionox，在设置页填入 API Key
4. 开始对话

### 基本使用

| 操作 | 方式 |
|------|------|
| 切换工作模式 | 主界面右上角按钮（通用/编程/办公/设计），切换后 `/new` 生效 |
| 切换模型 | 对话框上方 auto/flash/pro 预设，或底部「🤖 模型」面板 |
| 粘贴图片/文件 | `Ctrl+V` 粘贴剪贴板中的图片或文件路径 |
| 导入模型配置 | 底部「🤖 模型」面板 → 选择 JSON 文件批量导入 Provider |
| 管理记忆 | 设置页「记忆」面板，或对话中说「记住…」 |
| 学习命令 | 输入 `/learn help` 查看所有学习功能 |
| 语义索引 | Dashboard「高级 → 语义」面板构建索引，对话中自然语言检索 |

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

更详细的说明见 [`visionox-workspace/visionox_indexing_guide.html`](visionox-workspace/visionox_indexing_guide.html)。

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
  ├─ 33+ 工具（文件/Shell/Web/Memory/MCP/Skill）
  └─ Dashboard HTTP Server (127.0.0.1)
```

- **桌面壳**：Rust + Tauri v2
- **AI 运行时**：Node.js + DeepSeek API
- **前端界面**：WebView2 + Preact SPA
- **打包分发**：Windows NSIS 安装器

---

## 🔧 开发构建

### 环境要求

- **Rust** 1.94+
- **Node.js** 22+
- **Windows 10/11** + WebView2

### 项目结构

```
visionox-desktop/
├── src-tauri/                     # Tauri 桌面壳
│   ├── src/lib.rs                 # Rust 主逻辑
│   ├── src/main.rs                # 入口
│   ├── resources/server/          # Node.js 运行时资源
│   │   ├── launcher.mjs           # ★ 核心入口（AI Agent + HTTP Server）
│   │   ├── learn.mjs              # /learn 学习模块
│   │   ├── learn-track.mjs        # SM-2 追踪模块
│   │   ├── learn-sandbox-impl.mjs # 沙箱检查
│   │   ├── node.exe               # 嵌入的 Node.js
│   │   ├── officecli.exe          # Office MCP 工具
│   │   └── visionox-pkg/          # ★ 核心包（reasonix npm 包）
│   │       ├── dist/cli/          # 打包后的 JS chunk 文件
│   │       ├── dist/index.js      # 主入口
│   │       ├── dashboard/dist/    # 前端 SPA（app.js + app.css）
│   │       ├── dashboard/index.html
│   │       └── package.json       # reasonix 版本
│   ├── tauri.conf.json            # Tauri 配置（bundle.resources 列表）
│   └── Cargo.toml
├── tep/                           # reasonix 上游源码（0.53.2，与 dist 版本不同）
├── plan/                          # 设计文档
└── scripts/
    └── restore-visionox-pkg.js    # 从 npm 下载最新 reasonix 包
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

**不要运行 `scripts/restore-visionox-pkg.js`**（或 `npm install`），这会将 `visionox-pkg` 更新为最新 npm 版本，导致打包后的 chunk 文件名改变，`launcher.mjs` 中的 `import(distPath("server-XGDBRWMB.js"))` 等引用将失效。

所有对 `visionox-pkg/dist/` 和 `visionox-pkg/dashboard/` 的修改都是直接在打包文件上进行的。如需同步到上游，应将改动迁移到 `tep/src/` 中重新构建。

### 打包安装包（NSIS）

生成可分发的 Windows 安装程序：

```bash
# 确保没有进程占用
taskkill /F /IM visionox-desktop.exe 2>nul
taskkill /F /IM node.exe 2>nul

# 完整构建 + 打包 NSIS 安装器
npx tauri build
```

产物在 `src-tauri\target\release\bundle\nsis\`：
- `Visionox_1.12.0_x64-setup.exe` — 安装程序
- `Visionox_1.12.0_x64_en-US.msi` — MSI 安装包（如启用）

**安装包配置**（`tauri.conf.json` → `bundle`）：

| 配置项 | 值 | 说明 |
|---|---|---|
| `targets` | `["nsis"]` | 安装器类型 |
| `installMode` | `currentUser` | 当前用户安装（无需管理员权限） |
| `resources` | 列表见配置文件 | 打包进安装包的资源文件 |
| 注意 | `--no-bundle` 跳过此步骤 | 开发测试时使用 |

---

## 📄 License

MIT
