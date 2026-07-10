# Visionox-Whale 架构说明

> 应用版本：1.28.0

---

## 系统架构

```
Tauri Shell (Rust)
  ├─ WebView2 窗口 → 加载页 spinner
  ├─ spawn node.exe launcher.mjs --port 0
  ├─ 读取 stdout → {url, token, port}
  ├─ TCP 健康检查 (15×200ms) → 通过后导航到 dashboard
  ├─ 子进程崩溃监控 (2s 轮询)
  ├─ JobObject KILL_ON_JOB_CLOSE 兜底
  └─ 系统托盘 (最小化/退出)

Node.js Launcher
  ├─ DeepSeekClient + CacheFirstLoop
  ├─ 注册 40+ 工具 (文件/Shell/Web/Memory/MCP/Skill)
  ├─ 启动 Dashboard HTTP Server (127.0.0.1)
  └─ 全局诊断日志 → ~/.visionox/logs/visionox-whale.log / visionox-server-stderr.log

Dashboard SPA (WebView2)
  └─ Chat / Sessions / Tools / Memory / Settings / MCP ...
```

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 桌面壳 | Rust + Tauri v2 | 窗口管理、进程管理、系统托盘 |
| AI 运行时 | Node.js v22+ | Agent loop、工具注册、MCP 管理 |
| 前端界面 | Preact + WebView2 | Dashboard SPA |
| 通信 | HTTP API + SSE | Launcher 与 Dashboard 之间 |
| 打包 | Tauri Bundle | 开发可只构建 exe；分发时按平台生成 NSIS / deb / AppImage |

---

## 项目结构

```
vis-ai/
├── src/index.html                    加载页（iframe 恢复 + Rust 兜底逻辑）
├── src-tauri/
│   ├── src/main.rs                   入口
│   ├── src/lib.rs                    窗口/进程管理/托盘/健康检查/刷新恢复
│   ├── resources/server/
│   │   ├── node.exe                  Node.js 二进制
│   │   ├── officecli.exe             OfficeCLI 二进制
│   │   ├── launcher.mjs              启动脚本
│   │   └── visionox-pkg/             Visionox 服务端
│   ├── resources/bootstrap-skills/   内置 bootstrap skills
│   └── tauri.conf.json               Tauri 配置
├── docs/                             项目文档
├── archive/                          归档旧实现
└── scripts/
    ├── cherry-claude.cjs             CLAUDE.md 兼容迁移脚本
    └── restore-visionox-pkg.js       上游 reasonix 包恢复工具（维护/升级时使用）
```

---

## 关键文件

| 文件 | 作用 |
|------|------|
| `src-tauri/src/lib.rs` | 窗口创建、Node 进程管理、健康检查、启动流程、全局诊断日志、子进程崩溃监控 |
| `src/index.html` | 加载页 UI、iframe 恢复逻辑、三层刷新恢复机制 |
| `src-tauri/resources/server/launcher.mjs` | AI Agent 启动器、工具注册、MCP 管理、会话管理、Skill 安装、系统提示词 |
| `src-tauri/resources/server/visionox-pkg/` | Vendored 上游服务端代码（Dashboard + CLI chunks） |
| `src-tauri/Cargo.toml` | Rust 依赖与 features |
| `src-tauri/tauri.conf.json` | 窗口配置、资源打包、跨平台 bundle 配置 |

> 维护边界：当前 `visionox-pkg` 下的 Dashboard bundle 与 API bundle 含本项目本地补丁。普通 `restore:pkg` 已禁用；更新上游包前需要先迁移本地补丁，更新后运行 `npm run check:bundle-patches`。

---

## 启动流程

```
1. Tauri 创建 WebView2 窗口，加载 src/index.html（显示 spinner）
2. Rust 后台 spawn Node.js 进程运行 launcher.mjs
3. Launcher 启动 Dashboard HTTP Server，输出 {url, token, port} 到 stdout
4. Rust 读取 stdout，执行 TCP 健康检查（最多 15 次 × 200ms）
5. 健康检查通过后 eval 注入 __DASHBOARD_URL__ 到 WebView
6. 加载页 JS 检测到 URL 后创建全屏 iframe 加载 Dashboard
7. 子进程崩溃监控线程启动（2s 轮询，支持自动重启）
```

### 刷新恢复机制

iframe 方案下按 F5 刷新壳页面时，依赖三层恢复：

1. **localStorage 后备**：所有 sessionStorage 读取点增加 `|| localStorage` 回退
2. **Rust 兜底**：`get_dashboard_url` 命令返回当前有效 URL，前端从 Rust 重建
3. **iframe 失败回退**：注册 error 事件 + 6s 超时守卫，触发 fallbackToRust()

---

## 与上游差异

| 方面 | 上游 | Visionox |
|------|------|----------|
| 进程管理 | 无 | JobObject + 崩溃监控 + 启动超时 |
| 诊断 | stdout/stderr | 全局 `.visionox/logs/` 诊断日志 + 日志面板 |
| 编辑模式 | review/auto/yolo | + admin |
| 配色 | dark/light | 8 套 |
| 搜索 | Mojeek only | 4 引擎热切换 |
| 记忆 | 2 层 | 8 层 + 短期记忆 |
| 工作模式 | 无 | 4 模式切换 |
| 部署 | npm 包 | Windows 绿色便携版 |
