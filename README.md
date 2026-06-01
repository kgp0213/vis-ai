# Visionox Desktop

基于 [DeepSeek-Reasonix](https://github.com/esengine/DeepSeek-Reasonix) 的 Tauri v2 Windows 桌面 AI 编程代理。

---

## 基础说明

### 仓库

| 角色 | 地址 |
|------|------|
| 上游 | <https://github.com/esengine/DeepSeek-Reasonix> |
| 本仓库 | <https://gitee.com/hufz_admin/vis-ai> |

### 依赖

| 组件 | 说明 |
|------|------|
| Tauri v2 + WebView2 | Rust 桌面框架（Windows 系统自带 WebView2） |
| Node.js v22+ | AI Agent 运行时（`node.exe` 随 exe 分发） |
| DeepSeek API | 需用户自备 API Key |


### 架构

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
  ├─ 注册 33+ 工具 (文件/Shell/Web/Memory/MCP)
  ├─ 启动 Dashboard HTTP Server (127.0.0.1)
  └─ 全局诊断日志 → launcher-diag.log / launcher-stderr.log

Dashboard SPA (WebView2)
  └─ Chat / Sessions / Tools / Memory / Settings / MCP ...
```

### 项目结构

```
vis-ai/
├── src/index.html                    加载页
├── src-tauri/
│   ├── src/main.rs                   入口
│   ├── src/lib.rs                    窗口/进程管理/托盘/健康检查
│   ├── resources/server/
│   │   ├── node.exe                  Node.js 二进制
│   │   ├── launcher.mjs              启动脚本
│   │   └── visionox-pkg/             Visionox 服务端
│   └── tauri.conf.json               Tauri 配置
├── docs/                             项目文档
├── cherry-claude.cjs                 CLAUDE.md 记忆注入
└── scripts/restore-visionox-pkg.js   服务端包恢复
```

---

## 核心特性

### 记忆系统 (8 层)

每次 `/new` 重建上下文时，按顺序加载：

| 层 | 来源 | 用途 |
|----|------|------|
| Soul | `~/.visionox/soul.md` | AI 身份与行为准则 |
| Project | `workspace/{visionox,REASONIX,...}.md` | 项目专属信息 |
| Mode | `config.json` → `modes[mode].prompt` | 场景行为指令 |
| Mode Memory | `~/.visionox/mode-memory/{mode}.json` | 当前工作场景的长期记忆、偏好与知识点摘要 |
| Rules | `~/.claude/rules/ecc/{lang}/` | 编码规范（mode 控制） |
| Custom | `~/.visionox/rules/*.md` | 用户自定义规则 |
| Skills | `~/.visionox/skills/*/SKILL.md` | 领域技术能力索引 |
| Persistent | `~/.visionox/memory/*/MEMORY.md` | 跨会话持久记忆 |

普通跨场景长期记忆通过 `remember` 工具写入 `~/.visionox/memory/`，并在 `/new` 或应用重启后的新对话中注入 `MEMORY.md` 索引。短期记忆通过 `remember_session` 工具（仅当前对话，`/new` 清除）。当用户要求“在当前/编程/办公/设计工作场景下记住”某个偏好、知识点、术语、流程或关键词关联时，使用 `remember_mode_preference` 写入独立的 mode-memory 层，避免泄露到其他工作场景。

Mode Memory 按工作模式隔离存储，提示词注入时最多选取少量启用项并压缩为摘要，避免默认提示词越来越臃肿。注入顺序为：`soul.md` → 项目记忆 → 工作模式 prompt → 当前模式记忆 → ECC rules → 自定义 rules → skills → 持久/短期记忆；ECC 规则优先级高于模式记忆。

Dashboard 的“配置 → 记忆”页面作为长期记忆中心，集中展示和编辑 `soul.md`、全局长期记忆、当前项目记忆和工作场景记忆。AI 名称属于 soul 层，写入 `soul.md` 的受控区块，不单独保存为普通 memory 或独立配置项。安装包会携带 `resources/default-soul.md`；首次启动时如果 `~/.visionox/soul.md` 不存在或为空，launcher 会释放该默认文件到用户目录并使用它。用户保存过本机 `soul.md` 后不会被升级或重启覆盖。

#### 记忆触发话术

为了让 AI 正确选择存储层，用户应在对话里明确说明记忆类型：

| 目标 | 推荐说法 | 存储 |
|------|----------|------|
| 跨项目长期事实、称呼、稳定偏好 | `请长期记住：我的常用称呼是……` | `remember` → `~/.visionox/memory/global/` |
| 当前项目专属知识、流程、路径 | `请长期记住到当前项目记忆：这个项目的发布流程是……` | `remember` → `~/.visionox/memory/<project-hash>/` |
| 当前工作场景的回答习惯或知识点 | `请在编程场景下长期记住：8K点屏指通过 USB ADB 连接 RK3588 平台并参考 vismm 脚本点亮屏幕。` | `remember_mode_preference` → `~/.visionox/mode-memory/{mode}.json` |
| 只在当前对话有效的临时上下文 | `请临时记住：本轮先按方案 B 处理。` | `remember_session` → 内存 |

避免只说“记一下这个”。如果内容要跨所有场景保留，使用 `长期记住`；如果只应在某个工作场景保留，使用 `在当前/编程/办公/设计场景下长期记住`。例如 8K 点屏、编程排错习惯应存入编程场景记忆，办公场景不会自动读取。

历史会话保存时会同时写入 `*.meta.json`，记录保存时的工作场景、工作空间和消息数量。通过导航栏“会话”页面点击“加载并继续会话”时，会先恢复该会话对应的工作场景并重建提示词，再加载历史消息上下文。

### 工作模式 (4 种)

主界面右上角水平排列，切换后 `/new` 生效：

| 模式 | 规则集 | 适用场景 |
|------|--------|----------|
| 通用 | common + rust | 日常问答、轻量排查 |
| 编程 | common + rust + ts + python | 代码开发、测试、审查 |
| 办公 | common | 文档、表格、PDF、报告 |
| 设计 | common | UI/UX、前端布局 |

### ECC 集成

集成了 [ECC](https://github.com/affaan-m/ECC) v2.0.0-rc.1 的 Skills 和 Rules：

| 组件 | 数量 | 位置 |
|------|------|------|
| Skills | 18 个编码类 | `~/.visionox/skills/` |
| Rules | 26 个文件 | `~/.claude/rules/ecc/{common,rust,ts,python}/` |
| Hooks | preTool/postTool | `launcher.mjs` 内置 |

详见 [`docs/ECC_INTEGRATION.md`](docs/ECC_INTEGRATION.md)。

### 与上游差异

| 方面 | 上游 | Visionox |
|------|------|----------|
| 进程管理 | 无 | JobObject + 崩溃监控 + 启动超时 |
| 诊断 | stdout/stderr | 全局 launcher-diag.log |
| 编辑模式 | review/auto/yolo | + admin |
| 配色 | dark/light | 7 套 |
| 搜索 | Mojeek only | 4 引擎热切换 |
| 记忆 | 2 层 | 8 层 + 短期记忆 |
| 工作模式 | 无 | 4 模式切换 |
| 部署 | npm 包 | Windows 绿色便携版 |

---

## 开发维护

### 环境要求

- Windows 10/11
- Node.js v22+, Rust 工具链
- DeepSeek API Key

### 构建

```bash
git clone git@gitee.com:hufz_admin/vis-ai.git
cd vis-ai
npm install

# 恢复 visionox-pkg
node scripts/restore-visionox-pkg.js

# 放置 node.exe 到 src-tauri/resources/server/

# 编译 Windows 安装器（NSIS exe）
npm run tauri:build
# → src-tauri/target/release/bundle/nsis/Visionox_1.0.0_x64-setup.exe

# 仅编译调试/开发用可执行文件
cd src-tauri
cargo build --release
# → src-tauri/target/release/visionox-desktop.exe
```

### 调试

```bash
# 单独测试 Launcher
node src-tauri/resources/server/launcher.mjs --port 28980

# 诊断日志
type launcher-diag.log    # Rust 侧
type launcher-stderr.log  # Node.js 侧
```

常见错误：
- `readline timeout` — Node 启动超过 30s
- `health check TIMED OUT` — 服务器无响应
- `child process exited unexpectedly` — Node 进程意外退出

### 关键文件

| 需求 | 文件 |
|------|------|
| 启动流程/进程管理 | `src-tauri/src/lib.rs` |
| 加载页外观 | `src/index.html` |
| 系统提示词/工具注册 | `src-tauri/resources/server/launcher.mjs` |
| Dashboard UI | `src-tauri/resources/server/visionox-pkg/dashboard/` |
| 构建配置 | `src-tauri/Cargo.toml` + `src-tauri/tauri.conf.json` |
| 记忆注入 | `cherry-claude.cjs` |
| 服务端包恢复 | `scripts/restore-visionox-pkg.js` |

### 构建注意事项

- `tauri.conf.json` 当前固定 `bundle.targets = ["nsis"]`，`npm run tauri:build` 会生成 Windows NSIS `.exe` 安装器
- `Cargo.toml` 中 `tauri` 须声明 `custom-protocol` feature，否则 `cargo build --release` 和 `npm run tauri:build` 行为不一致
- 修改 `lib.rs` 或 `src/index.html` 后建议 `cargo clean` 再编译
- 修改 `launcher.mjs` 或 chunk 文件后需手动同步到 `target/release/` 再打包

---

## 更新

完整变更记录见 [`docs/CHANGELOG.md`](docs/CHANGELOG.md)。

### 近期更新 (260531)

- **ECC 集成** — 18 个编码 Skills + 26 个 Rules 文件，由工作模式控制加载
- **工作模式** — 通用/编程/办公/设计 4 模式，主界面一键切换
- **记忆系统重构** — 8 层加载架构 + 短期记忆 + 工作场景记忆 + soul.md 身份文件
- **Dashboard 修复** — 记忆页过滤系统索引文件 + 动态文件名显示
- **Hook 系统** — preTool/postTool 框架

### 待完成

- [x] Windows NSIS exe 安装包构建
- [ ] MSI 安装包/自动更新策略
- [ ] macOS/Linux 适配
- [ ] 自动更新

## License

MIT
