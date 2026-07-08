# Visionox 开发指南

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
npx tauri build --no-bundle
# → src-tauri/target/release/visionox-desktop.exe

# 需要安装包时再显式指定 NSIS
npm run tauri:build -- --bundles nsis
# → src-tauri/target/release/bundle/nsis/Visionox_x.x.x_x64-setup.exe
```

### 构建注意事项

- `tauri.conf.json` 当前 `bundle.targets = "all"`；开发验证优先使用 `npx tauri build --no-bundle`，避免生成安装包。
- `npm run tauri:build` 会先执行 `npm run check:bundle-patches`，防止上游包恢复后丢失本地 Dashboard/API 补丁。
- `Cargo.toml` 中 `tauri` 须声明 `custom-protocol` feature
- 修改 `lib.rs` 或 `src/index.html` 后建议 `cargo clean` 再编译
- 修改 `launcher.mjs` 或 chunk 文件后需手动同步到 `target/release/` 再打包
- `scripts/restore-visionox-pkg.js` 是维护/重拉上游 reasonix 包的工具，不是常规构建步骤。普通 `npm run restore:pkg` 已禁用；必须在备份并准备重新迁移补丁后，才使用 `npm run restore:pkg:danger -- --force`。

---

## 三、调试

```bash
# 单独测试 Launcher
node src-tauri/resources/server/launcher.mjs --port 28980

# 查看诊断日志
type launcher-diag.log    # Rust 侧
type launcher-stderr.log  # Node.js 侧
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

- 修改 `.rs` 后执行 `cargo check`
- 提交前执行 `cargo fmt && cargo clippy -- -D warnings`
- 手动编译和 `npx tauri build` 必须使用相同的 tauri features（当前：`["tray-icon", "custom-protocol"]`）

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

*最后更新：2026-07-06 | 适用：Visionox Desktop 1.20.0*
