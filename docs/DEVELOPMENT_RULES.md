# Visionox 开发规则

> 来源：`.claude/rules/ecc/rust/`，适用本项目的 Rust + Tauri 开发
> 应用版本：1.0.0 | 上游基线：reasonix 0.47.1 | 最后更新：2026-06-07

## 编码规范

- `cargo fmt` 提交前执行
- 禁止在非测试代码中使用 `unwrap()` / `expect()`，改用 `anyhow::Context`
- `unsafe` 块必须有 `// SAFETY:` 注释说明不变量
- 函数参数优先 `&str` 而非 `String`，`&[T]` 而非 `Vec<T>`
- 变量默认 `let`，只必要时用 `let mut`

## 编译与检验

- 修改 `.rs` 后执行 `cargo check` 验证编译
- 提交前执行 `cargo fmt && cargo clippy -- -D warnings`
- 手动编译和 `npx tauri build` 必须使用相同的 `tauri` features（当前：`["tray-icon", "custom-protocol"]`）
- `cargo clean` 后首次编译正确，后续增量编译可能缓存不一致——排查编译参数差异而非源码

## 安全检查

- 不在源码中硬编码密钥/Token
- 不在 API 返回中暴露内部路径/堆栈
- `cargo audit` 扫描依赖漏洞

## 构建系统

- `npx tauri build` 内部执行的 cargo 命令可通过 `--verbose` 查看
- `npx tauri build` 注入 `--features tauri/custom-protocol`，需在 `Cargo.toml` 中同步
- NSIS 打包后 `target/release/visionox-desktop.exe` 可能被增量编译覆盖——验证时用 `cargo clean && cargo build --release`

## 错误处理

- 库代码用 `thiserror` 定义类型化错误
- 应用代码用 `anyhow::Context` 添加上下文
- `let _ =` 丢弃 `Result` 会隐藏错误——必须处理或显式记录（例外：日志写入等 fire-and-forget 操作，但必须通过 `log_diag` 记录失败）

## 加载页相关

- 加载页 HTML 来源：`src/index.html`
- 注入方式：`generate_context!()` + `WebviewUrl::App("index.html".into())`，不再使用 `document.write()`
- URL 守卫：`!window.location.href.startsWith('http://127.0.0.1')` 防止覆盖 dashboard
- 导航方式：健康检查通过后 `window.location.replace(url)` 直接跳转
- 原生窗口背景色：`Color::from((243u8, 244u8, 246u8))` 匹配 #f3f4f6

## 关键文件

| 文件 | 作用 |
|------|------|
| `src-tauri/src/lib.rs` | 窗口创建、Node 进程管理、健康检查、启动流程、全局 diag 日志 (launcher-diag.log)、子进程崩溃监控 |
| `src/index.html` | 加载页 UI、spinner CSS |
| `src-tauri/resources/server/launcher.mjs` | AI Agent 启动器、工具注册、MCP 管理、会话管理、skill 安装 |
| `src-tauri/resources/server/launcher-stderr.log` | Node 进程 stderr 输出（自动生成） |
| `launcher-diag.log` | Rust 侧诊断日志（exe 同级目录，自动生成） |
| `src-tauri/Cargo.toml` | Rust 依赖、tauri features |
| `src-tauri/tauri.conf.json` | 窗口配置、资源打包、NSIS 配置。`windows:[]` 为空——主窗口在 `lib.rs` 中通过 `WebviewWindowBuilder` 动态创建，不在配置中静态声明 |
| `src-tauri/capabilities/default.json` | 权限配置，`"windows":["main"]` 对应动态创建的 main 窗口 |
| `src-tauri/build.rs` | 编译脚本、资源复制 |
| `src-tauri/resources/server/visionox-pkg/dist/cli/` | Vendored Reasonix CLI chunks |
