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

## 📄 License

MIT
