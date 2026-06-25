# Visionox 开发手册

> 应用版本：1.0.2 | 上游基线：0.47.1 | 最后更新：2026-06-25
> 本文档合并了原 COLOR_SCHEMES.md / ECC_INTEGRATION.md / UI_OPTIMIZATION_PLAN.md 的关键内容。

---

## 一、编码规范

- `cargo fmt` 提交前执行
- 禁止在非测试代码中使用 `unwrap()` / `expect()`，改用 `anyhow::Context`
- `unsafe` 块必须有 `// SAFETY:` 注释说明不变量
- 函数参数优先 `&str` 而非 `String`，`&[T]` 而非 `Vec<T>`
- 变量默认 `let`，只必要时用 `let mut`

## 二、编译与检验

- 修改 `.rs` 后执行 `cargo check` 验证编译
- 提交前执行 `cargo fmt && cargo clippy -- -D warnings`
- 手动编译和 `npx tauri build` 必须使用相同的 `tauri` features（当前：`["tray-icon", "custom-protocol"]`）
- `cargo clean` 后首次编译正确，后续增量编译可能缓存不一致——排查编译参数差异而非源码

## 三、安全检查

- 不在源码中硬编码密钥/Token
- 不在 API 返回中暴露内部路径/堆栈
- `cargo audit` 扫描依赖漏洞

## 四、构建系统

- `npx tauri build` 内部执行的 cargo 命令可通过 `--verbose` 查看
- `npx tauri build` 注入 `--features tauri/custom-protocol`，需在 `Cargo.toml` 中同步
- NSIS 打包后 `target/release/visionox-desktop.exe` 可能被增量编译覆盖——验证时用 `cargo clean && cargo build --release`

## 五、错误处理

- 库代码用 `thiserror` 定义类型化错误
- 应用代码用 `anyhow::Context` 添加上下文
- `let _ =` 丢弃 `Result` 会隐藏错误——必须处理或显式记录（例外：日志写入等 fire-and-forget 操作，但必须通过 `log_diag` 记录失败）

## 六、加载页

- 加载页 HTML 来源：`src/index.html`
- 注入方式：`generate_context!()` + `WebviewUrl::App("index.html".into())`，不再使用 `document.write()`
- URL 守卫：`!window.location.href.startsWith('http://127.0.0.1')` 防止覆盖 dashboard
- 导航方式：健康检查通过后创建全屏 iframe 加载 dashboard，保留 Tauri 父页面上下文
- 窗口背景色：`Color::from((243u8, 244u8, 246u8))` 匹配 `#f3f4f6`

### 刷新恢复机制（1.0.2）

iframe 方案下 F5 刷新的是顶层壳页面，sessionStorage 会清空。恢复依赖三层机制：

1. **localStorage 后备**：`src/index.html` 所有 `sessionStorage.getItem` 读取点增加 `|| localStorage.getItem(...)` 回退，localStorage 在 WebView2 中跨刷新持久化
2. **Rust 兜底**：`lib.rs` 新增 `get_dashboard_url` 命令返回 `ServerState.url`；前端 `restoreFromRustAndShow()` 在 storage 均无 URL 时 `invoke("get_dashboard_url")` 直接取当前有效 URL
3. **iframe 失败回退**：`restoreDashboard()` 对新建 iframe 注册 `error` 事件 + 6s 超时守卫，触发 `fallbackToRust()` 清空残留并从 Rust 重建

`lib.rs` 两处 eval（首次启动 / 崩溃重启）同时写入 sessionStorage + localStorage（统一 `try{...}catch`），并调用 `window.__visionoxRestoreDashboard()` 触发前端恢复。

---

## 七、关键文件

| 文件 | 作用 |
|------|------|
| `src-tauri/src/lib.rs` | 窗口创建、Node 进程管理、健康检查、启动流程、全局 diag 日志、子进程崩溃监控 |
| `src/index.html` | 加载页 UI、spinner CSS |
| `src-tauri/resources/server/launcher.mjs` | AI Agent 启动器、工具注册、MCP 管理、会话管理、skill 安装 |
| `src-tauri/resources/server/launcher-stderr.log` | Node 进程 stderr 输出（自动生成） |
| `launcher-diag.log` | Rust 侧诊断日志（exe 同级目录，自动生成） |
| `src-tauri/Cargo.toml` | Rust 依赖、tauri features |
| `src-tauri/tauri.conf.json` | 窗口配置、资源打包、NSIS 配置。`windows:[]` 为空——主窗口在 `lib.rs` 中动态创建 |
| `src-tauri/capabilities/default.json` | 权限配置，`"windows":["main"]` 对应动态创建的 main 窗口 |
| `src-tauri/build.rs` | 编译脚本、资源复制 |
| `src-tauri/resources/server/visionox-pkg/dist/cli/` | Vendored CLI chunks |
| `src-tauri/theme/` | 配色方案 CSS 源文件（7 套，实际 app.css 已合并 5 套） |

---

## 八、配色方案

> 实际生效的 CSS 位于 `src-tauri/resources/server/visionox-pkg/dashboard/app.css`。
> 源文件位于 `src-tauri/theme/`（设计参考）。

### 当前生效方案（5 套）

通过 `<select>` 下拉框切换 `html[data-theme="..."]`，选择通过 `localStorage` 持久化，cookie `visionox-theme` 作为兼容兜底。

| data-theme | 类型 | 说明 |
|------------|------|------|
| *(无)* | 深色（默认） | 暗底 `#0c0d10` + 琥珀强调 `#f5a623` |
| `light` | 浅色 | 白底 + 深琥珀 |
| `warm-sand` | 浅色 | 暖黄底 `#faf6f0` + 古铜 `#c4935f` |
| `cool-ash` | 浅色 | 冷灰底 + 蓝灰强调 |
| `soft-sage` | 浅色 | 柔绿底 + 自然绿强调 |

### 源码待合并方案（3 套深色变体）

以下文件存在于 `src-tauri/theme/` 但尚未合并到 `app.css`：

| 文件 | 说明 |
|------|------|
| `deep-charcoal.css` | 深炭灰 — 暖石墨质感 |
| `midnight-ink.css` | 午夜墨蓝 — 墨水专业感 |
| `espresso.css` | 浓缩咖啡 — 皮革温润感 |

### 新增方案步骤

1. 在 `src-tauri/theme/` 创建 `new-theme.css`
2. 在 `app.css` 末尾追加 `[data-theme="new-theme"] { ... }` 块
3. 在 `app.js` 的 `<select>` 中加 `<option value="new-theme">`

---

## 九、ECC 集成要点

### 记忆系统层级（L0-L8）

每次 `/new` 按以下顺序注入 system prompt：

| 层 | 内容 | 来源 |
|----|------|------|
| L0 | SOUL（核心身份） | `~/.visionox/soul.md` |
| L1 | 项目记忆 | workspace `{visionox,REASONIX,...}.md`（按 PROJECT_MEMORY_FILES 顺序搜索） |
| L2 | 模式 Prompt | config.json `modes[mode].prompt` |
| L3 | 模式记忆 | `~/.visionox/mode-memory/{mode}.json` |
| L4 | ECC Rules | config.json `modes[mode].eccRules`，从 `.cursor/rules/` 和 `.kiro/steering/` 读取 |
| L5 | 自定义规则 | `~/.visionox/rules/*.md`（始终加载） |
| L6 | Skills | `~/.visionox/skills/*/SKILL.md` |
| L7 | 持久记忆 | `~/.visionox/memory/*/MEMORY.md`（global + project） |
| L8 | 会话记忆 | `remember_session` 工具（内存，不持久化） |

### PROJECT_MEMORY_FILES 搜索顺序

```
["REASONIX.md", "visionox.md", ".claude/CLAUDE.md", "CLAUDE.md", "AGENTS.md", "AGENT.md"]
```

### 规则集（~5 套可用，按 mode 选择）

- common（10 文件）— 通用编码/安全/测试/工作流
- rust（5 文件）— Rust 特有编码风格/安全/测试
- typescript（5 文件）— TS/JS 特有
- python（6 文件）— Python 特有
- custom — 用户自定义（始终加载）

### 与上游 ECC 的关系

Visionox 精选 ECC 的静态资源（Skills/Rules）在 AI 提示词层面使用，不引入运行时依赖。模式系统和 session memory 为自研扩展。

---

## 十、UI 优化当前批次

> 来源：原 UI_OPTIMIZATION_PLAN.md，仅保留当前执行批次。

1. **CSS 变量兼容层** — 新 token 与旧变量混用，补兼容 alias
2. **mode-memory API mode 校验** — 未知 mode 返回 400
3. **精准化 `.card:hover`** — 改为 `.card.interactive:hover`
4. **Memory 页面增加长期记忆/项目记忆新增入口** — 保存后更新 MEMORY.md 索引

---

## 十一、AI 名称管理

AI name 写入 `soul.md` 受控区块，不分散到普通 memory / mode prompt / 独立 config：

```md
<!-- visionox:soul:name:start -->
你的名字是 Visionox。
<!-- visionox:soul:name:end -->
```

安装包/首次启动流程只补齐缺失的默认文件，不可覆盖用户已有的 soul.md、memory、mode-memory 或项目说明记忆。

---

*版本: 2.0 | 2026-06-07 合并精简 | 适用: Visionox Desktop*
