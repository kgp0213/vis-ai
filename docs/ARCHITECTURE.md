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
  ├─ 子进程崩溃监控 (阻塞等待)
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
| 打包 | Tauri Bundle | Windows release exe；明确交付时生成并校验 NSIS |

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
│   │   └── visionox-pkg/             Visionox 服务端与 Dashboard
│   ├── resources/bootstrap-skills/   内置 bootstrap skills
│   ├── resources/third-party-resources.json  第三方运行资源来源、版本与哈希
│   ├── resources/THIRD_PARTY_NOTICES.md      随程序分发的第三方说明
│   └── tauri.conf.json               Tauri 配置
├── contracts/api-responses.schema.json       核心 HTTP 响应契约
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
记忆预算、语义召回、会话知识、会话回收站、用户数据备份、原子/版本化文件持久化、提示队列、DLP、
活动计划存储、定时任务存储/时间策略和 OfficeCLI 策略等模块。提示队列由
`lib/prompt-queue-store.mjs` 独立管理 TTL、容量、幂等和事务回滚，不再把存储细节留在 Launcher 中。

活动会话解析、元数据、pending fallback 和部分定时任务编排已经抽取。后续不固定按行数或旧路线图
机械拆分，而是从仍留在 Launcher 的活动会话 I/O/归档、MCP 生命周期、计划任务运行时等边界中，
按故障影响、变更频率和测试覆盖选择一项。模型循环和 Dashboard context 装配属于高风险核心路径，
只有先建立充分行为基线后才处理。

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

模式记忆、提示队列、知识清单和会话元数据（包括 active session metadata）统一使用
`lib/versioned-json-file.mjs` 校验 JSON 与 schema
版本。损坏文件或高于当前程序支持版本的文件会进入只读保护，不会被默认值静默覆盖；问题同时暴露在
`/api/health` 的 `storageIssues` 和概览页中。运行时问题分为 `debug`、`warning`、`error`、`fatal`：临时
清理等可忽略失败只进入调试诊断；功能降级和用户数据不完整分别使用 warning/error；继续操作可能破坏
原文件时直接 fatal 中止。概览只显示需要用户处理且带稳定问题键的 warning/error，不展示技术噪声。

每个快照是独立目录，包含 schema 版本、应用版本、时间、文件数量、字节数和逐文件 SHA-256 清单。
预览恢复时同时校验归档路径、目标路径和内容哈希，并将文件分类为缺失、相同、冲突、损坏或无效。
默认恢复只补齐缺失文件；覆盖冲突需要 UI 二次确认。概览健康统计使用 15 秒缓存，创建或恢复后立即失效，
避免 5 秒界面轮询反复遍历所有会话。

概览页会在创建快照前显示预计大小、文件数量和磁盘可用空间，允许显式删除快照。保留数量范围为
1–100，默认 10；自动裁剪只在快照成功创建或用户保存保留策略后执行，不在只读列表操作中删除数据。
备份保留数归一化和恢复按钮安全判定已抽取到 `dashboard/backup-support.js`，作为 Dashboard 可读源码迁移
的首个独立策略模块，并由单元测试、API 静态资源测试和 Edge 备份流程共同保护。

## 接口与运行资源契约

`contracts/api-responses.schema.json` 定义概览、健康、备份、定时任务和 Provider 等核心响应的最低结构。
质量门禁同时检查真实 API 响应和 schema，防止 Dashboard 与服务端在字段变更时静默失配。

`resources/third-party-resources.json` 是打包运行资源的机器可读清单，记录 Node、OfficeCLI、Reasonix、
KaTeX 和 bootstrap skills 的版本、来源、许可证与可用哈希；`THIRD_PARTY_NOTICES.md` 随资源一起分发。
OfficeCLI 与 KaTeX 使用 README 记录的上游仓库。bootstrap skills 是混合来源和混合许可证集合，按每个
`SKILL.md` 元数据及随附许可证判断，不能整体标为 MIT。版本检查不执行二进制，也不在构建时联网查询。
Superpowers 工作流的运行副本只位于 `resources/bootstrap-skills/`，来源和 MIT 许可证由 provenance 与
`SUPERPOWERS_LICENSE.txt` 固定。仓库根目录中被忽略的 `skills/superpowers/` 只可作为本地上游参考，
不参与运行时加载、构建或打包，不能作为交付资源依赖。

`runtime-manifest.json` 进一步固定 Node.js 与 OfficeCLI 的版本、大小和 SHA-256。二进制不进入 Git；普通
构建完全离线。明确授权的危险维护入口可从公开上游获取资源，但必须下载到系统临时目录并在写入源码
资源前完成清单校验。OfficeCLI MCP 在 Dashboard 服务可用后后台初始化，不阻塞 Tauri 首屏启动路径。

## 架构决策与后续优先级

长期维护以可验证的行为边界为准，不记录易过期的源码行数、提交领先数量或健康度评分。当前接受的
重点只有三项：建立可重建的 Dashboard 源码；继续按职责与测试边界拆分 Launcher；保持二进制资源和
Windows release 的可复现治理。Dashboard 源码迁移时再复核 CSP 中 `unsafe-inline`/`unsafe-eval` 的真实依赖。

以下建议不作为当前整改目标：把 Launcher 压到任意行数、消除全部顶级 `let`、在缺少受控二进制的 CI
中强制 release 构建、机械修改依赖版本范围、把 bundle target 固定为 NSIS，或把实验性 Unix 代码描述为
Linux 产品支持。`cargo audit`、`npm audit` 和上游同步属于明确授权的联网维护动作，不进入默认离线门禁。

项目规则只从根目录 `AGENTS.md`、`AGENT.md`、`agent.md`、`CLAUDE.md`、`claude.md` 和 `visionox.md` 读取；
`REASONIX.md` 不参与项目记忆注入。历史编辑模式 `review` 仅作为 `auto` 的配置兼容别名。

## Windows 专项集成

文件剪贴板由 Rust/Tauri 层读取：优先 Win32 `CF_HDROP`，必要时使用 `FileNameW` 回退，再把路径列表交给
Dashboard。实现位于 `src-tauri/src/lib.rs` 的 `get_clipboard_files_blocking()`。当前不保证虚拟文件的
`FileGroupDescriptorW` 或 Unix 剪贴板行为；修改时需验证单/多文件、文件夹、Unicode、长路径、纯文本和截图。
PowerShell 只能作为排障工具，不能加入产品启动依赖。

本地文档在交给 OfficeCLI 前由 `prepare_local_document` 统一准备，默认 `dlp.mode=auto`。普通文件保持原
路径；只有命中文件头特征时才调用 `resources/server/visionox-file/visionox_file.py`。发现、超时、取消、
缓存和参数重写由 `lib/dlp-file.mjs` 管理，Agent 约束位于同目录 `SKILL.md`。运行时只从 exe 同级资源发现
脚本，不读取源码目录或机器专用路径。该文件头判断只是当前环境的兼容策略，不是通用加密标准；输出不得
覆盖原文件，新增特征必须用测试证明普通文件不会被误判。

## 质量边界

提交前统一运行 `npm run quality:check`。Rust 工具链由根目录 `rust-toolchain.toml` 固定为 1.94.0。
`npm run tauri:dev` 会先准备当前运行资源，可用于快速查看 UI 调整；其 `target/debug` 产物不是交付验证
基准。质量门禁会检查 release 构建仍只能进入规范 wrapper，且不会自行构建 Rust 或创建 `target/debug`；
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
7. 子进程崩溃监控线程启动（阻塞等待，支持自动重启）
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
| 编辑模式 | review/auto/yolo | auto/yolo/admin（review 仅作历史配置别名） |
| 配色 | dark/light | 8 套 |
| 搜索 | Mojeek only | 4 引擎热切换 |
| 记忆 | 2 层 | 9 层（含会话短期记忆） |
| 工作模式 | 无 | 4 模式切换 |
| 部署 | npm 包 | Windows release exe / NSIS |

> 仓库保留的 Unix 条件代码和 Linux 配置属于实验性兼容基础；当前没有经过持续验证的 Linux 交付承诺。
