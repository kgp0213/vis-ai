# Visionox-Whale 开发指南

> 面向二次开发者：环境搭建、构建、调试与编码规范。

---

## 一、环境要求

- Windows 10/11
- Node.js v22+
- Rust 工具链（`rustup` + `cargo`）
- DeepSeek API Key（或其他兼容 OpenAI 接口的 Key）

---

## 二、构建

```bash
git clone git@gitee.com:hufz_admin/vis-ai.git
cd vis-ai
npm install

# 放置 node.exe 和 officecli.exe 到 src-tauri/resources/server/
# （这两个二进制文件被 gitignore，需单独获取）

# 开发测试：只构建 exe，不生成安装包
npm run tauri:build -- --no-bundle
# → src-tauri/target/release/visionox-whale.exe

# 需要安装包时再显式指定 NSIS
npm run bundle:nsis
# → src-tauri/target/release/bundle/nsis/Visionox-Whale_x.x.x_x64-setup.exe
```

### 构建注意事项

- `tauri.conf.json` 当前 `bundle.targets = "all"`；开发验证优先使用 `npm run tauri:build -- --no-bundle`，避免生成安装包。
- `npm run tauri:build` 会临时生成裁剪后的运行时暂存目录并执行 `npm run check:bundle-patches`；Tauri 随后直接生成唯一的 `target/release/resources/` 运行时资源树。暂存目录无论构建成功或失败都会自动删除。
- 构建包装器设置 npm 与 Cargo 离线模式；本地缓存、依赖或运行时资源缺失时直接失败，不允许构建期间下载。
- `Cargo.toml` 中 `tauri` 须声明 `custom-protocol` feature
- 修改 `lib.rs` 或 `src/index.html` 后使用规范命令重新构建；只有确认 Cargo 缓存损坏时才清理 release 缓存。
- 修改 `launcher.mjs`、Dashboard 或 chunk 文件后必须通过 `npm run tauri:build` 构建，确保构建前暂存和 Tauri 资源复制都执行。不要用原始 `cargo build` 验证交付产物，它不会准备运行时资源。
- 非测试 Rust 代码不得读取 `CARGO_MANIFEST_DIR` 或任何绝对项目路径来补拷运行时资源。运行实例只读取自身同级的 `resources/`，缺失即视为构建失败。
- `npm run release:check` 的 Rust 测试产物写入系统临时目录并自动删除，不会生成或使用项目内的 `target/debug`。
- 实际交付 exe 或 NSIS 时填写 [发布验收清单](RELEASE_CHECKLIST.md)，记录 commit、版本、功能抽查和产物 SHA-256。
- `scripts/restore-visionox-pkg.js` 是维护/重拉上游 reasonix 包的工具，不是常规构建步骤。普通 `npm run restore:pkg` 已禁用；必须在备份并准备重新迁移补丁后，才使用 `npm run restore:pkg:danger -- --force`。

---

## 三、调试

```bash
# 单独测试 Launcher
node src-tauri/resources/server/launcher.mjs --port 28980

# 查看诊断日志
type %USERPROFILE%\.visionox\logs\visionox-whale.log
type %USERPROFILE%\.visionox\logs\visionox-server-stderr.log
```

### 常见错误

| 错误 | 原因 |
|------|------|
| `readline timeout` | Node 启动超过 30s |
| `health check TIMED OUT` | 服务器无响应 |
| `child process exited unexpectedly` | Node 进程意外退出 |

### 关键文件

| 文件 | 作用 |
|------|------|
| `src-tauri/src/lib.rs` | 启动流程、进程管理、刷新恢复 |
| `src/index.html` | 加载页外观 + iframe 恢复逻辑 |
| `src-tauri/resources/server/launcher.mjs` | 系统提示词、工具注册 |
| `src-tauri/resources/server/visionox-pkg/dashboard/` | Dashboard UI |
| `src-tauri/Cargo.toml` + `src-tauri/tauri.conf.json` | 构建配置 |
| `scripts/restore-visionox-pkg.js` | 上游 reasonix 包恢复工具，仅维护/升级时使用 |

---

## 四、编码规范

### Rust

- `cargo fmt` 提交前执行
- 禁止在非测试代码中使用 `unwrap()` / `expect()`，改用 `anyhow::Context`
- `unsafe` 块必须有 `// SAFETY:` 注释
- 函数参数优先 `&str` 而非 `String`，`&[T]` 而非 `Vec<T>`

### 编译检查

- 修改 `.rs` 后执行 `npm run tauri:build -- --no-bundle`，只验证 release 目标
- 提交前执行 `cargo fmt --check`；需要 Clippy 时显式使用 `cargo clippy --release -- -D warnings`
- 交付验证只使用 `npm run tauri:build -- --no-bundle`，不要绕过构建包装器

### 安全

- 不在源码中硬编码密钥/Token
- 不在 API 返回中暴露内部路径/堆栈
- `cargo audit` 扫描依赖漏洞

---

## 五、加载页机制

- 加载页来源：`src/index.html`
- 注入方式：`generate_context!()` + `WebviewUrl::App("index.html")`
- URL 守卫：`!window.location.href.startsWith('http://127.0.0.1')` 防止覆盖 dashboard
- 窗口背景色：`#f3f4f6`

### 刷新恢复（三层）

1. **localStorage 后备**：sessionStorage 读取点增加回退
2. **Rust 兜底**：`get_dashboard_url` Tauri 命令
3. **iframe 失败回退**：error 事件 + 6s 超时守卫

---

## 六、配色方案

当前 8 套配色方案，源文件位于 `src-tauri/theme/`。实际生效的 CSS 在 `src-tauri/resources/server/visionox-pkg/dashboard/app.css`。

### 新增方案步骤

1. 在 `src-tauri/theme/` 创建 `new-theme.css`（可选）
2. 在 `app.css` 末尾追加 `[data-theme="new-theme"] { ... }`
3. 在 `app.js` 的 `<select>` 中添加 `<option value="new-theme">`

---

## 七、visionox-pkg 维护边界

当前实际运行的 Dashboard 和 API 分发代码位于：

- `src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js`
- `src-tauri/resources/server/visionox-pkg/dashboard/app.css`
- `src-tauri/resources/server/visionox-pkg/dist/cli/server-XGDBRWMB.js`

这些文件包含本项目的本地补丁。普通 `restore:pkg` 已禁用；若确实要更新上游 reasonix 包，应先备份并重新迁移本地补丁，再运行 `npm run check:bundle-patches` 验证 chunk 文件名、`launcher.mjs` 导入路径和 Dashboard 功能。

---

*最后更新：2026-07-11 | 适用：Visionox-Whale 1.28.0*
