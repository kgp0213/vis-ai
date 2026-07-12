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
│   │   ├── lib/                      本项目维护的运行时模块
│   │   ├── __tests__/                Node/API/运行时测试
│   │   └── visionox-pkg/             Visionox 服务端
│   ├── resources/bootstrap-skills/   内置 bootstrap skills
│   └── tauri.conf.json               Tauri 配置
├── docs/                             项目文档
└── scripts/
    ├── quality-check.js              本地和 CI 共用质量门禁
    ├── ui-smoke.js                   隔离用户数据的 Edge 渲染检查
    ├── run-tauri-build.js            规范 release 构建入口
    └── restore-visionox-pkg.js       高风险上游恢复工具（默认禁用）
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

## 源码所有权与可复现性

当前仓库存在两类不同性质的代码，维护时必须明确区分：

| 类型 | 路径 | 维护方式 |
|------|------|----------|
| 本项目源码 | `src-tauri/src/`、`src/`、`resources/server/launcher.mjs`、`resources/server/lib/`、`scripts/` | 直接修改，增加针对性测试，执行 `npm run quality:check` |
| 带本地补丁的上游 bundle | `visionox-pkg/dashboard/dist/app.js`、`dashboard/app.css`、`visionox-pkg/dist/cli/*.js` | 目前按受保护源码管理，必须通过 `check:bundle-patches`，禁止被上游恢复脚本覆盖 |

历史审计确认，上游包附带的 Dashboard source map 只对应较早的构建快照；当前 `app.js` 在该
快照之后又积累了大量本地功能修改。因此仓库和 release 都不保留 source map，它不能作为
当前 Dashboard 的可重建源码，也不能用于覆盖当前 bundle。

Dashboard 只有同时满足以下条件后，才允许从“直接维护 bundle”切换到源码构建：

1. 将可读源码放入 Git 跟踪目录，并明确依赖锁文件和离线构建命令。
2. 按记忆、索引、会话、模型、文件中心等功能建立迁移清单，逐项移植本地差异。
3. 生成物通过 bundle marker、全部 Node 测试和真实 Edge 渲染检查。
4. 对比规范 release 资源树，确认构建不下载依赖、不生成 `target/debug` 或第二套资源。

当前功能领域、对应回归证据和切换验收条件见 [Dashboard 功能基线](DASHBOARD_PARITY.md)。

在这些条件满足前，不执行批量反编译、source map 覆盖或上游 bundle 恢复。

## Launcher 模块边界

`launcher.mjs` 仍承担启动装配和运行时协调，但可独立验证的逻辑正在逐步迁入
`resources/server/lib/`。当前已拆分配置迁移、Provider、上下文容量、活动会话、系统提示词、
记忆预算、语义召回、会话知识、会话回收站、用户数据备份、原子文件持久化、DLP、活动计划存储、
定时任务存储/时间策略和 OfficeCLI 策略等模块。

后续按以下顺序拆分，每次只移动一个边界并保持 API 行为不变：

1. 活动会话持久化：消息分页、自动保存和恢复编排。
2. 定时任务执行编排：在已拆分的存储和时间策略之上，逐步缩小 Launcher 中的运行协调代码。
3. 最后才处理模型循环和 Dashboard context 装配，避免一次重构核心运行路径。

模块化的验收标准不是减少行数，而是模块具有明确输入、无隐藏全局状态、具备独立测试，
并且完整质量门禁保持通过。

## 配置兼容性

用户配置位于 `~/.visionox/config.json`，通过 `configSchemaVersion` 管理格式。旧配置迁移前会在
同一用户数据根目录的 `backups/` 下创建一次权限受限的迁移恢复文件，随后复用核心配置 I/O 的
原子写入。损坏 JSON、未知版本或备份失败时，Launcher 拒绝覆盖原配置并明确失败。

迁移日志只记录版本和状态，不输出 API Key 或配置正文。

## 用户数据保护

完整用户快照位于 `~/.visionox/backups/snapshots/`，与 `backups/` 根目录中的配置迁移恢复文件分开。
`lib/user-data-backup.mjs` 只遍历明确白名单：配置、Soul、定时任务、会话及回收站、长期/场景记忆、
记忆回收站/历史，以及当前工作区 `knowledge/`。语义向量、日志、缓存和快照目录本身不在白名单中。

每个快照是独立目录，包含 schema 版本、应用版本、时间、文件数量、字节数和逐文件 SHA-256 清单。
预览恢复时同时校验归档路径、目标路径和内容哈希，并将文件分类为缺失、相同、冲突、损坏或无效。
默认恢复只补齐缺失文件；覆盖冲突需要 UI 二次确认。概览健康统计使用 15 秒缓存，创建或恢复后立即失效，
避免 5 秒界面轮询反复遍历所有会话。

## 质量边界

提交前统一运行 `npm run quality:check`。该命令不会构建 Rust，也不会创建 `target/debug`；
浏览器检查使用系统 Edge 和 `%TEMP%` 下的隔离用户目录，结束后按测试进程 PID 清理子进程与
临时数据。release 可执行文件仍只通过 `npm run tauri:build -- --no-bundle` 生成和验证。

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
