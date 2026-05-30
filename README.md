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
| [Reasonix](https://github.com/esengine/DeepSeek-Reasonix) | 260530 | AI Agent 核心
| [Tauri](https://v2.tauri.app/) | v2 | Rust 桌面框架，使用系统 WebView2 |
| Node.js | v22+ | 运行时，运行 Visionox 服务端（node.exe 随发行版自带） |
| DeepSeek API | — | AI 模型后端（需用户自备 API Key） |

## 项目结构

```
vis-ai/
├── src/                          # Tauri 加载页
│   └── index.html                #   加载页 UI (spinner + 状态文字)，由 generate_context!() 嵌入
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/
│   │   ├── main.rs               #   程序入口
│   │   └── lib.rs                #   窗口创建、Node 进程管理、TCP 健康检查、系统托盘、全局诊断日志
│   ├── resources/server/         #   随 exe 分发的运行时资源
│   │   ├── node.exe              #     Node.js 二进制
│   │   ├── launcher.mjs          #     启动脚本 — 实例化 DeepSeekClient + CacheFirstLoop
│   │   └── visionox-pkg/         #     Visionox 服务端包（260530）
│   ├── icons/                    #   应用图标
│   ├── build.rs                  #   Tauri 构建脚本
│   ├── Cargo.toml                #   Rust 依赖
│   └── tauri.conf.json           #   Tauri 构建配置
├── CHANGELOG-0.43.0.md           # 二开变更记录（§一 ~ §三十七）
├── package.json                  # Node.js 项目配置（仅含 Tauri CLI）
├── README.md
├── RULES.md                      # 项目开发规则（Rust/Tauri 编码规范）
├── CODE_REVIEW_FINAL.md          # 源码审查终稿（P0-P4 修复状态）
├── cherry-claude.cjs             # CLAUDE.md 全局记忆注入脚本（仅开发用）
└── scripts/
    └── restore-visionox-pkg.js   # Visionox 服务端包恢复脚本
```

运行时生成的文件（exe 同级目录）：
- `launcher-diag.log` — Rust 侧全局诊断日志
- `launcher-stderr.log` — Node.js stderr 输出

## 架构

```
┌─────────────────────────────────────────────────┐
│                  Tauri Shell (Rust)               │
│                                                   │
│  窗口创建 (WebviewUrl::App + generate_context!)    │
│    → 加载页 spinner 立即可见                       │
│    → spawn Node.js launcher.mjs                  │
│    → 读取 stdout 获取 {url, port, token}          │
│    → TCP 直连 /api/health?token=xxx 轮询         │
│      (200ms×15次, 仅校验 HTTP 200 状态行)         │
│    → 健康检查通过 → eval window.location.replace  │
│    → 加载页跳转 dashboard                          │
│    → 系统托盘 (最小化/退出)                        │
│    → 后台监控子进程存活 (2s 轮询)                  │
│    → 全局诊断日志 (launcher-diag.log)             │
│                                                   │
│        spawn node.exe launcher.mjs --port 0       │
│        (JobObject KILL_ON_JOB_CLOSE 兜底)         │
└───────────────────────────────┬──────────────────┘
                                │
        ┌───────────────────────┴──────────────────┐
        │           Node.js Launcher                │
        │  - 加载 ~/.visionox/config.json           │
        │  - 创建 DeepSeekClient + CacheFirstLoop   │
        │  - 注册 ~40 个工具 (文件/SHELL/WEB/AI)     │
        │  - 连接 MCP 服务器                         │
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

## 启动流程（260530）

```
双击 Visionox.exe
  → 窗口打开 → 灰背景 (#f3f4f6) → spinner 旋转动画 + "Visionox" + "Starting server…"
  → Rust 后台 spawn Node → 读 stdout JSON {url, token, port}
  → 30s watchdog 超时保护 → 超时则显示错误并停止等待
  → TCP 健康检查 GET /api/health?token=xxx (最长 ~3s, 15 次 × 200ms)
  → 健康检查通过 → win_for_url.eval("window.location.replace('{url}')") 跳转 dashboard
  → spawn 子进程存活监控线程 (每 2s 检查, 崩溃时显示错误页面)
  → 全局诊断日志写入 launcher-diag.log
```

关键设计：
- **Rust 直接执行跳转** — 健康检查通过后通过 `eval()` 注入 `window.location.replace(url)`
- **TCP 健康检查** — 原始 HTTP GET，仅校验 HTTP 200 状态行，比 fetch/SSE 更可靠
- **JobObject KILL_ON_JOB_CLOSE** — 父进程退出时 Windows 自动终止所有子进程，防止残留 node.exe
- **catch_unwind 兜底** — 后台线程 panic 时捕获并通过 eval 通知 UI，避免静默失败
- **30s 启动超时** — Node 卡住时不会永久 spinner

详见 `CHANGELOG-0.43.0.md` §二十七 ~ §三十七。

## 当前进度

### 260530 已完成的二开功能

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
| **搜索引擎选择器** | 4 引擎可选（Bing国内版/Mojeek/SearXNG/Bing API），热切换无需重启 | **§二十八** |
| **Bug 修复** | yolo模式路径解析、隐藏目录过滤、标题栏轮询更新 | **§二十九** |
| **导航栏缩减 40%** | 240px → 144px，折叠态 64px → 40px | **§三十** |
| **会话恢复修复** | "加载并继续会话" prompt required 错误 | **§三十一** |
| **多配色方案** | 5 套（浅色/深色/暖沙/冷灰/柔绿），右下角下拉切换 | **§三十二** |
| **OA/API 快捷链接** | 导航栏"计划"下方新增 OA + API 入口 | **§三十三** |
| **项目目录清理** | 从 1680 MB 缩减到 269 MB | **§三十四** |
| **上游 P0-1 合入** | login-shell PATH 发现（macOS/Linux 工具路径注入） | **§三十七** |
| **上游 P0-2 合入** | multi_edit 写入失败自动回滚 | **§三十七** |
| **上游 P1-1 合入** | 系统提示词压缩 -58% + 品牌化（降低 API 费用） | **§三十七** |
| **上游 P1-2 合入** | 工具描述压缩 -28%（降低 API 费用） | **§三十七** |
| **P0 功能修复** | submitPrompt 竞态、read_line 超时、Node 崩溃监控、健康检查收紧、后台 panic 通知 | 2026-05-30 |
| **P1 稳定性修复** | JobObject 竞态、child.wait 超时、Mutex 中毒、静默 Result、close reject | 2026-05-30 |
| **P2 工具链修复** | MCP 清理、install_skill 速率限制、YAML 校验、会话名校验、console.warn | 2026-05-30 |
| **P4 代码质量** | 全局 diag 日志、SAFETY 注释、单元测试(5)、硬编码路径修复、文档更新 | 2026-05-30 |
| **会话记录去重** | assistant_final 每次只写一条到 JSONL，消除 38 条重复/空消息膨胀 | 2026-05-30 |

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
# 注意: 修改 lib.rs 或 src/index.html 后建议先 cargo clean 再编译，
#       避免增量编译缓存导致加载页/启动逻辑未更新。
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

### 故障排查

启动失败时，检查 exe 同级目录下的诊断日志：

```bash
# Rust 侧全局诊断日志（启动流程、健康检查、进程管理、错误信息）
type launcher-diag.log

# Node.js 侧 stderr 输出（AI Agent 初始化、工具注册、请求处理）
type launcher-stderr.log
```

关键错误信息（含时间戳）会写入 `launcher-diag.log`，常见：
- `readline timeout` — Node 启动超过 30s
- `health check TIMED OUT` — 服务器 HTTP 健康检查失败
- `server FAILED` — 服务器启动阶段异常
- `thread panicked` — Rust 后台线程崩溃
- `child process exited unexpectedly` — Node 进程意外退出

### 常见构建问题

#### 同一份源码两次编译产物行为不一致（cargo build vs npx tauri build）

**现象**：
- `cd src-tauri && cargo build --release` 产出的 exe 启动后加载页正常居中
- `npx tauri build --bundles nsis` 内部调用 cargo 产出的 exe 启动后 spinner 跑偏
- 两次产物大小不同（差约 28KB），MD5 不同
- 源码完全相同——`lib.rs`、`index.html`、`Cargo.toml`、`tauri.conf.json`、`build.rs` 已逐行比对无差异

**根因**：

`npx tauri build` 内部实际执行的 cargo 命令为：

```
cargo build --bins --features tauri/custom-protocol --release
```

若不进行 `cargo clean` 增量编译两次可能混合编译多个 crate 导致产物不一致。

若 `Cargo.toml` 中 `tauri` 依赖未声明 `custom-protocol` feature：

```toml
# 错误的配置——缺少 custom-protocol
tauri = { version = "2", features = ["tray-icon"] }
```

则裸 `cargo build --release` 产出的二进制**不包含** custom-protocol 协议处理。两个构建入口走了不同的 Tauri asset 加载机制：

| 构建方式 | custom-protocol | asset 加载协议 |
|----------|:---:|---------------|
| `cargo build --release` | 缺失 | fallback 机制（非 `tauri://localhost/`） |
| `npx tauri build` | 有（CLI 自动注入 `--features`） | `tauri://localhost/` 自定义协议 |

custom-protocol 影响 WebView 初始化、CSP 上下文、CSS 渲染环境。这是 spinner 的 `display:flex; align-items:center; justify-content:center` 居中行为不一致的直接原因。

**增量编译放大**：先执行 `cargo build --release`（无 custom-protocol），再执行 `npx tauri build`（有 custom-protocol），Cargo 将重编 `tauri` crate 自身，但 `visionox-desktop` 的部分编译单元可能因增量编译缓存未正确 invalidate，产生 feature 混合状态的二进制——这进一步放大了两次产物的差异。

**排查过程**：

1. 逐行比对源码文件——无差异，排除源码变化
2. 确认加载页走 `include_str!("../../src/index.html")` 编译期嵌入，非 `generate_context!()` 前端嵌入——排除 asset 嵌入路径差异
3. 发现 `cargo clean` 后方式一正常，方式二异常——指向增量编译缓存问题
4. **关键突破**：`npx tauri build --verbose` 输出显示内部 cargo 命令为 `cargo build --bins --features tauri/custom-protocol --release`，与手工执行的 `cargo build --release` feature 集不同

**解决方案**：

在 `Cargo.toml` 中显式声明 `custom-protocol` feature，确保两种构建方式使用相同的 feature 集：

```toml
# 正确的配置
tauri = { version = "2", features = ["tray-icon", "custom-protocol"] }
```

此后 `cargo build --release` 和 `npx tauri build` 产出的二进制行为一致，无需在切换构建方式前 `cargo clean`。

**教训**：

- `npx tauri build` 会自动注入 `--features tauri/custom-protocol`，但不会修改 `Cargo.toml`
- 裸 `cargo build` 只看 `Cargo.toml` 中声明的 features，不会自动补全
- 构建入口不一致时，先检查 `--verbose` 输出中的实际 cargo 命令

#### 启动后 spinner 不居中、跑偏到左上角（custom-protocol 已配置）

**现象**：`custom-protocol` feature 已正确配置，构建产物启动后 spinner 仍然不居中，`.wrap` 元素出现在左上角。

**根因**：

`lib.rs` 的 `initialization_script` 通过 `document.write()` 在 WebView 初始化阶段注入加载页 HTML。在 WebView2（Windows）中，`document.write()` 在一个尚未完成初始化的 document 上执行时，可能触发 **quirks 模式渲染**——浏览器没有正确建立 viewport 高度继承链（`html.height: 100%` → viewport），`html` 和 `body` 的高度计算为 `auto`（= 内容高度），导致 `body { display: flex; align-items: center; justify-content: center }` 没有额外的垂直空间可供居中，内容贴到左上角。

原设计存在双重冗余：

| 路径 | 机制 | 说明 |
|------|------|------|
| 1 | `generate_context!()` → `frontendDist: "../src"` → 嵌入 `src/index.html` | WebView 通过 `WebviewUrl::App("index.html")` 加载 |
| 2 | `include_str!("../../src/index.html")` → init_script → `document.write()` | 在 WebView 初始化时拦截页面写入同一份 HTML |

两个路径嵌入的是同一份 `src/index.html`，但路径 2 的 `document.write()` 破坏了正常的 WebView 渲染流程。

**排查过程**：

1. 确认 `custom-protocol` 已配置——排除 feature 不一致
2. 确认 `src/index.html` CSS `display:flex; align-items:center; justify-content:center` 写法正确
3. 用浏览器直接打开 `src/index.html`——spinner 完美居中，排除 CSS 本身问题
4. 定位到 `initialization_script` 中的 `document.write()` ——在 WebView2 中此 API 对 viewport 初始化的影响与标准浏览器不同
5. 删除 `document.write()` 逻辑后重新编译——spinner 正常居中

**解决方案**：

删除 `initialization_script` 中的 `document.write()` 调用，让 WebView 通过正常页面加载流程渲染嵌入的 `index.html`：

```rust
// 之前的代码：
let init_script = format!("...document.open();document.write('{html}');document.close();...", ...);
WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
    .initialization_script(init_script)  // ← 删除这一行
    ...

// 修复后：
WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
    // 不再传入 initialization_script
    // spinner 由 generate_context!() 嵌入的 src/index.html 正常渲染
    ...
```

同时删除 `LOADING_HTML` 常量和 `init_html`/`init_script` 变量，因为它们唯一的用途就是构造 `document.write()` 的参数。

`window.location.replace()` 导航到 dashboard 的逻辑走的是 Rust 侧的 `win_for_url.eval(...)`，不受此次修改影响。

**教训**：

- WebView2 不是标准浏览器——`document.write()` 的渲染语义与 Chromium/Chrome 有微妙差异
- `generate_context!()` 嵌入的前端资源已经提供了完整的加载页，无需再用脚本注入一份
- `background_color` 窗口属性与加载页背景色一致即可消除白屏闪烁，不需要脚本提前写内容

### 关键文件修改指南

| 需求 | 修改文件 |
|------|----------|
| 启动流程 / 健康检查 / 子进程管理 | `src-tauri/src/lib.rs` |
| 加载页外观 | `src/index.html` — spinner 样式 + 状态文字 |
| 系统托盘菜单 | `src-tauri/src/lib.rs` — `TrayIconBuilder` |
| CSP 安全策略 | `src-tauri/tauri.conf.json` — `app.security.csp` |
| 新增工具 / 速率限制 | `src-tauri/resources/server/launcher.mjs` |
| 修改系统提示词 | `src-tauri/resources/server/launcher.mjs` — `buildSystemPrompt()` |
| 仪表盘 UI | `src-tauri/resources/server/visionox-pkg/dashboard/` |
| 构建配置 | `src-tauri/build.rs` + `src-tauri/Cargo.toml` |
| 全局记忆注入 | `cherry-claude.cjs` — CLAUDE.md 导入逻辑 |
| 服务端包恢复 | `scripts/restore-visionox-pkg.js` |
| 诊断日志 | exe 同级 `launcher-diag.log` (Rust) + `launcher-stderr.log` (Node) |

## 与上游的差异

| 差异 | 上游 Reasonix | Visionox |
|------|--------------|----------|
| 架构 | React SPA 桌面端 (Vite) → IPC spawn 后端 | WebView2 → eval window.location.replace → dashboard |
| 启动方式 | React `<Splash>` 组件 (水下粒子动画) | WebviewUrl::App 嵌入 spinner + "Visionox" |
| 进程管理 | 无 | JobObject KILL_ON_JOB_CLOSE + 崩溃监控 + 30s 启动超时 |
| 诊断 | stdout/stderr | 全局 launcher-diag.log + launcher-stderr.log |
| 品牌化 | Reasonix | Visionox（所有 UI 文本 + 路径已替换） |
| 搜索后端 | Mojeek only | 4 引擎可选，默认 Bing 国内版 (cn.bing.com) |
| 搜索引擎切换 | 需重启 | 热切换，保存即生效 |
| 编辑模式 | review / auto / yolo | 新增 admin 模式（绕过沙箱） |
| 配色方案 | dark / light 双色 | 5 套（浅色/深色/暖沙/冷灰/柔绿） |
| 导航栏 | 仅功能分区 | 新增 OA/API 快捷链接 |
| 部署方式 | npm 包 + 独立桌面端 | Windows 绿色便携版 (免安装) |
| 数据目录 | `~/.reasonix/` | `~/.visionox/` |

## License

MIT（继承自 Reasonix）
