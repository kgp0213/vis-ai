# Visionox Desktop — AI Coding Agent 桌面版

基于 Reasonix（DeepSeek 原生 AI 编程代理）的 Tauri v2 桌面 GUI 封装，
为 Windows 用户提供免命令行的"绿色便携版"体验。

## 上游依赖

| 组件 | 版本 | 说明 |
|------|------|------|
| [Reasonix](https://github.com/esengine/DeepSeek-Reasonix) | v0.39.1 | AI Agent 核心（DeepSeek API、Agent Loop、工具系统、Web 仪表盘） |
| [Tauri](https://v2.tauri.app/) | v2 | Rust 桌面框架，使用系统 WebView2 |
| Node.js | v22+ | 运行时，运行 Visionox 服务端 |
| DeepSeek API | — | AI 模型后端（需要用户自备 API Key） |

## 项目结构

```
vis-ai/
├── src/                          # 前端加载页
│   └── index.html                #   启动动画 + 自动导航到仪表盘 URL
├── server/                       # Node.js 启动器（开发用）
│   └── launcher.mjs              #   v4 启动脚本，构建完整 Agent 上下文
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/
│   │   ├── main.rs               #   程序入口
│   │   └── lib.rs                #   Node.js 进程管理、窗口创建、系统托盘
│   ├── resources/server/         #   随 exe 分发的运行时资源
│   │   ├── node.exe              #     Node.js 二进制
│   │   ├── launcher.mjs          #     启动脚本
│   │   └── visionox-pkg/         #     Visionox 服务端包（从 npm reasonix 同步）
│   ├── capabilities/default.json #   Tauri 权限配置
│   ├── icons/                    #   应用图标
│   └── tauri.conf.json           #   Tauri 构建配置
├── package.json                  # Node.js 项目配置
└── README.md
```

## 架构概览

```
┌─────────────────────────────────────────────────┐
│                  Tauri Shell (Rust)               │
│  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  main.rs      │  │  lib.rs                    │ │
│  │  入口点       │  │  启动 Node.js Launcher      │ │
│  │               │  │  读取 stdout 获取 URL       │ │
│  │               │  │  系统托盘 + 窗口管理         │ │
│  └──────────────┘  └───────────┬───────────────┘ │
│                               │                  │
│                    spawn node.exe launcher.mjs    │
└───────────────────────────────┼──────────────────┘
                                │
        ┌───────────────────────┴──────────────────┐
        │           Node.js Launcher (v4)           │
        │  - 加载用户 API Key 配置                  │
        │  - 创建 DeepSeekClient + CacheFirstLoop   │
        │  - 注册 31 个原生工具                     │
        │  - 构建仪表盘上下文                       │
        │  - 启动仪表盘 HTTP 服务器                 │
        └──────────────────────┬──────────────────┘
                               │
                    HTTP Server on 127.0.0.1:{port}
                               │
        ┌──────────────────────┴──────────────────┐
        │         WebView2 (Dashboard SPA)          │
        │  Preact + HTM, 14 个面板                  │
        │  Chat / Plans / Tools / Settings / ...    │
        └──────────────────────────────────────────┘
```

## 当前进度

### 已完成

- [x] Tauri v2 桌面壳（窗口管理、系统托盘、最小化到托盘）
- [x] Node.js 启动器 v4 — 完整 Agent 上下文（DeepSeekClient + CacheFirstLoop）
- [x] 31 个原生工具注册（文件系统、Shell、Web 搜索、记忆、Plan/Choice/Todo）
- [x] 仪表盘 Web UI 正常加载（Preact SPA，14 个面板）
- [x] 聊天对话功能正常（/api/submit → Agent Loop → SSE 流式返回）
- [x] Agent 工具调用正常（AI 可调用 read_file、run_command 等工具）
- [x] Settings 页面可读写配置（API Key、模型、语言等）
- [x] SSE 事件实时推送（assistant_delta、tool_start、tool_result、busy-change）
- [x] 无 API Key 时优雅降级（提示用户在 Settings 配置）
- [x] 便携版打包（双击即用，免安装）

### 待完成

- [ ] Shell 命令确认机制（当前 yolo 模式跳过确认，需接入仪表盘 Modal）
- [ ] Shell 命令 allowlist 持久化
- [ ] 工作区目录可配置（当前固定为 `~/visionox-workspace/`）
- [ ] MCP 服务器支持（Model Context Protocol）
- [ ] 启动时自动检测 API Key 配置状态并引导
- [ ] 自动更新检测
- [ ] 安装包构建（NSIS/MSI，当前仅便携版）
- [ ] macOS/Linux 跨平台适配

### 已知问题

- `src-tauri/resources/server/visionox-pkg/` 不随 Tauri build 自动打包（文件太多太大），需手动同步
- 构建产物 `target/` 约 1.5GB，已加入 .gitignore

## 开发指南

### 环境要求

- Windows 10/11
- Node.js v22+
- Rust 工具链（rustup + cargo）
- Git
- DeepSeek API Key（从 https://platform.deepseek.com/api_keys 获取）

### 首次配置

```bash
# 1. 克隆仓库
git clone git@gitee.com:hufz_admin/vis-ai.git
cd vis-ai

# 2. 安装 Node.js 依赖
npm install

# 3. 同步 Reasonix 包到资源目录
npm install -g reasonix
robocopy "%APPDATA%\npm\node_modules\reasonix" "src-tauri\resources\server\visionox-pkg" /MIR /NFL /NDL

# 4. 下载 Node.js 二进制到资源目录
# 从 https://nodejs.org 下载 Windows 64-bit zip，解压 node.exe 到：
# src-tauri/resources/server/node.exe

# 5. 配置 API Key（二选一）：
# 方式 A：设置环境变量
set DEEPSEEK_API_KEY=sk-your-key-here
# 方式 B：运行一次 reasonix setup
npx reasonix setup
```

### 开发调试

```bash
# Tauri 开发模式（热重载前端）
npm run tauri:dev

# 单独测试 Launcher（不启动 GUI）
cd src-tauri/resources/server
node.exe launcher.mjs --port 28980
# 浏览器打开输出的 URL

# 编译 Rust 部分
cd src-tauri
cargo build --release
```

### 构建便携版

```bash
# 1. 编译 Tauri
npm run tauri:build

# 2. 组装便携版目录
mkdir -p visionox-portable\resources
copy src-tauri\target\release\visionox-desktop.exe visionox-portable\Visionox.exe
xcopy src-tauri\target\release\resources visionox-portable\resources /E /I

# 3. visionox-portable\ 目录即为可分发的绿色版，压缩后约 44MB
```

### 关键文件修改指南

| 需求 | 修改文件 |
|------|----------|
| 新增工具 | `server/launcher.mjs` — 在工具注册区域追加 |
| 修改系统提示词 | `server/launcher.mjs` — `ImmutablePrefix` 中的 `system` |
| 窗口大小/行为 | `src-tauri/src/lib.rs` — `WebviewWindowBuilder` |
| 系统托盘菜单 | `src-tauri/src/lib.rs` — `TrayIconBuilder` |
| CSP 安全策略 | `src-tauri/tauri.conf.json` — `app.security.csp` |
| 前端加载页 | `src/index.html` |
| 仪表盘 UI | Reasonix 上游仓库 `dashboard/` 目录 |

## 核心实现细节

### Launcher 演进

| 版本 | 方式 | 问题 |
|------|------|------|
| v1 | 直接 spawn `reasonix code` 子进程 | TUI 输出无法解析，URL 提取失败 |
| v2 | 直接 `import("startDashboardServer")` 传最小化 ctx | 聊天报 "submit requires an attached dashboard session" |
| v3 | 创建 DeepSeekClient + CacheFirstLoop，传完整 ctx | 聊天可用，但没有工具（空 ToolRegistry） |
| **v4** | 注册全部 31 个工具，完整 Agent 上下文 | 聊天 + Agent 功能全部正常 |

### 为什么不用 spawn 子进程？

`reasonix code` 的 TUI 使用 Ink（React 终端渲染框架），当 stdout 不是 TTY 时
Ink 不渲染任何文本输出。仪表盘 URL（含随机 token）仅在 TUI 渲染中显示，
因此 Rust 无法从 stdout 解析出 URL。

v4 Launcher 直接导入 Reasonix 的内部模块，绕开 TUI 层，在 Node.js 进程中
构造完整 Agent 上下文，并通过固定 token 控制仪表盘 URL 格式。

### 工具沙箱

所有文件系统和 Shell 工具默认沙箱在 `~/visionox-workspace/` 目录内。
工具函数内部调用 `safePath()` 校验路径，拒绝 `../` 逃逸。

## License

MIT（继承自 Reasonix）
