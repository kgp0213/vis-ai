# Visionox Desktop — AI Coding Agent 桌面版

基于 [Reasonix](https://github.com/esengine/DeepSeek-Reasonix)（DeepSeek 原生 AI 编程代理）的 Tauri v2 桌面 GUI 封装，
为 Windows 用户提供免命令行的"绿色便携版"体验。

## 仓库地址

| 角色 | 地址 |
|------|------|
| **上游** | <https://github.com/esengine/DeepSeek-Reasonix> |
| **本仓库** | <https://gitee.com/hufz_admin/vis-ai> |

## 依赖

| 组件 | 版本 | 说明 |
|------|------|------|
| [Reasonix](https://github.com/esengine/DeepSeek-Reasonix) | v0.43.0 | AI Agent 核心（DeepSeek API、CacheFirstLoop、工具系统、Web 仪表盘） |
| [Tauri](https://v2.tauri.app/) | v2 | Rust 桌面框架，使用系统 WebView2 |
| Node.js | v22+ | 运行时，运行 Visionox 服务端（node.exe 随发行版自带） |
| DeepSeek API | — | AI 模型后端（需用户自备 API Key） |

## 项目结构

```
vis-ai/
├── src/                          # Tauri 加载页
│   └── index.html                #   极简外壳 (112B)，实际内容由 lib.rs 的 init_script 注入
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/
│   │   ├── main.rs               #   程序入口
│   │   └── lib.rs                #   窗口创建、Node 进程管理、TCP 健康检查、系统托盘
│   ├── resources/server/         #   随 exe 分发的运行时资源
│   │   ├── node.exe              #     Node.js 二进制
│   │   ├── launcher.mjs          #     启动脚本 — 实例化 DeepSeekClient + CacheFirstLoop
│   │   └── visionox-pkg/         #     Visionox 服务端包（vendored from npm reasonix 0.43.0）
│   ├── icons/                    #   应用图标
│   ├── build.rs                  #   Tauri 构建脚本
│   ├── Cargo.toml                #   Rust 依赖
│   └── tauri.conf.json           #   Tauri 构建配置
├── CHANGELOG-0.43.0.md           # 二开变更记录（§一 ~ §二十七）
├── package.json                  # Node.js 项目配置（仅含 Tauri CLI）
└── README.md
```

## 架构

```
┌─────────────────────────────────────────────────┐
│                  Tauri Shell (Rust)               │
│                                                   │
│  窗口创建 (data URL + initialization_script)       │
│    → 加载页 spinner 立即可见                       │
│    → spawn Node.js launcher.mjs                  │
│    → TCP 直连 /api/health 轮询 (200ms×15次)       │
│    → 健康检查通过 → eval 注入 __DASHBOARD_URL__    │
│    → 加载页 JS 自助跳转 dashboard                  │
│    → 系统托盘 (最小化/退出)                        │
│                                                   │
│                    spawn node.exe launcher.mjs    │
└───────────────────────────────┬──────────────────┘
                                │
        ┌───────────────────────┴──────────────────┐
        │           Node.js Launcher                │
        │  - 加载 ~/.visionox/config.json           │
        │  - 创建 DeepSeekClient + CacheFirstLoop   │
        │  - 注册 ~40 个工具 (文件/SHELL/WEB/AI)     │
        │  - 启动仪表盘 HTTP 服务器 (127.0.0.1)       │
        │  - stdout 输出 {"url","token","port"}     │
        └──────────────────────┬──────────────────┘
                               │
                    HTTP Server on 127.0.0.1:{port}
                               │
        ┌──────────────────────┴──────────────────┐
        │         WebView2 (Dashboard SPA)          │
        │  Chat / Sessions / Plans / Tools /        │
        │  Permissions / MCP / Skills / Memory /    │
        │  Settings / System / Usage ...            │
        └──────────────────────────────────────────┘
```

## 启动流程（v0.43.0 最终方案）

```
双击 Visionox.exe
  → 窗口打开 → 灰背景 (#f3f4f6) → spinner 旋转动画 + "Visionox" + "Starting server…"
  → Rust 后台 spawn Node → 读 stdout → TCP 健康检查 /api/health (最长 3s)
  → 健康检查通过 → inject window.__DASHBOARD_URL__
  → 加载页 JS 检测到 URL → "Server ready…" (绿色) → 跳转 dashboard
  → 全程无"无法连接"错误闪现
```

关键设计：
- **Rust 不执行跳转** — 只注入全局变量，JS 自主决定跳转时机
- **TCP 健康检查** — 原始 HTTP GET，比 fetch/SSE 更可靠
- **初始化脚本双保险** — 即使 Tauri 前端嵌入失败，init_script 仍能注入加载页 HTML

详见 `CHANGELOG-0.43.0.md` §二十七。

## 当前进度

### v0.43.0 已完成的二开功能

| 功能 | 说明 | 参考 |
|------|------|------|
| Admin 编辑模式 | 绕过工具沙箱限制 | §二 |
| 路径品牌化 | `.reasonix` → `.visionox` 全局替换 (16 JS + 40+ 字符串) | §三 Fix2, §四 |
| 主题切换修复 | 浅色/暗色主题切换按钮 + CSS 变量 | §三 Fix3 |
| 数据迁移 | `.reasonix/` → `.visionox/` (sessions/memory/usage) | §三 Fix4 |
| 会话管理增强 | 删除会话 + 从 GUI 恢复历史会话 | §九 |
| 图片资源修复 | PNG 路由恢复 + auth skip | §十二 |
| Embedding 分批修复 | OpenAI-compat API 413 错误 | §十三 |
| install_skill 增强 | source_dir 目录安装 + 异步化 | §十四~十五 |
| 浅色主题优化 | 对比度 + 子像素渲染 | §十七 |
| 导航栏优化 | 会话/计划交换 + 配置折叠 | §十八 |
| 工作空间热切换 | 沙箱目录切换实时生效 | §十九 |
| 标题栏增强 | Visionox + 工作空间路径 + 编译日期 | §二十~二十三 |
| SideRail 删除 | 聊天区域全宽化 | §二十二 |
| 导航栏/图标缩小 | 110px 侧边栏 | §二十四 |
| 开发者模式 | Settings 底部日志面板 | §二十六 |
| **启动闪屏修复** | 加载页动画持续可见 + 健康检查 + 无缝跳转 | **§二十七** |

### 待完成

- [ ] 安装包构建（NSIS/MSI，当前仅便携版）
- [ ] macOS/Linux 跨平台适配
- [ ] 自动更新检测

## 开发指南

### 环境要求

- Windows 10/11
- Node.js v22+
- Rust 工具链（rustup + cargo）
- DeepSeek API Key（从 <https://platform.deepseek.com/api_keys> 获取）

### 首次构建

```bash
# 1. 克隆
git clone git@gitee.com:hufz_admin/vis-ai.git
cd vis-ai

# 2. 安装 Tauri CLI
npm install

# 3. 同步 visionox-pkg 到资源目录
#    方式 A: 从 upstream-v0.43.0.tar.gz 解压 (推荐)
#    方式 B: npm install -g reasonix && 手动复制到 src-tauri/resources/server/visionox-pkg/

# 4. 放置 Node.js 二进制
#    从 https://nodejs.org 下载 Windows 64-bit zip
#    解压 node.exe 到 src-tauri/resources/server/node.exe

# 5. 编译
cd src-tauri
cargo build --release
# 产物: src-tauri/target/release/visionox-desktop.exe
```

### 开发调试

```bash
# 编译 Rust（release 模式，含内联加载页）
cd src-tauri
cargo build --release

# 单独测试 Launcher（不启动 GUI）
node src-tauri/resources/server/launcher.mjs --port 28980

# 修改 lib.rs 后需重新编译，cargo build --release 会自动处理
# 修改 src/index.html (加载页外壳) 后同样需重新编译
```

### 关键文件修改指南

| 需求 | 修改文件 |
|------|----------|
| 启动流程 / 健康检查 | `src-tauri/src/lib.rs` |
| 加载页外观 | `src-tauri/src/lib.rs` — `LOADING_HTML` 常量 |
| 系统托盘菜单 | `src-tauri/src/lib.rs` — `TrayIconBuilder` |
| CSP 安全策略 | `src-tauri/tauri.conf.json` — `app.security.csp` |
| 新增工具 | `src-tauri/resources/server/launcher.mjs` |
| 修改系统提示词 | `src-tauri/resources/server/launcher.mjs` — `buildSystemPrompt()` |
| 仪表盘 UI | `src-tauri/resources/server/visionox-pkg/dashboard/` |
| 构建配置 | `src-tauri/build.rs` + `src-tauri/Cargo.toml` |

## 与上游的差异

| 差异 | 上游 Reasonix | Visionox |
|------|--------------|----------|
| 架构 | React SPA 桌面端 (Vite) → IPC spawn 后端 | 静态加载页 (内联 Rust) → HTTP redirect 到 dashboard |
| 启动动画 | React `<Splash>` 组件 (水下粒子动画) | Rust 内联 spinner + "Visionox" |
| 品牌化 | Reasonix | Visionox（所有 UI 文本 + 路径已替换） |
| 编辑模式 | review / auto / yolo | 新增 admin 模式（绕过沙箱） |
| 部署方式 | npm 包 + 独立桌面端 | Windows 绿色便携版 (免安装) |
| 数据目录 | `~/.reasonix/` | `~/.visionox/` |

## License

MIT（继承自 Reasonix）
