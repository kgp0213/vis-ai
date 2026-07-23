# Visionox-Whale 开发指南

> 面向二次开发者：环境搭建、构建、调试与编码规范。

---

## 一、环境要求

- Windows 10/11
- Node.js v22+
- Rust 工具链（`rustup` + `cargo`）
- 可用的 OpenAI-compatible 模型凭据（仅运行对话或模型检测时需要，构建不需要）

---

## 二、构建

```bash
git clone git@gitee.com:hufz_admin/vis-ai.git
cd vis-ai
npm ci

# 将获准使用的 node.exe、officecli.exe 和 dws.exe 放入 src-tauri/resources/server/
# 二进制被 Git 忽略，版本、大小和 SHA-256 必须与 runtime-manifest.json 一致

# 开发测试：只构建 exe，不生成安装包
npm run tauri:build -- --no-bundle
# → src-tauri/target/release/visionox-whale.exe

# 需要安装包时再显式指定 NSIS
npm run bundle:nsis
# → src-tauri/target/release/bundle/nsis/Visionox-Whale_x.x.x_x64-setup.exe
```

### npm 脚本参考

<!-- AUTO-GENERATED: package.json scripts -->
| 命令 | 用途 |
|---|---|
| `npm run tauri -- <args>` | 直接调用 Tauri CLI；交付构建不得用它绕过包装器 |
| `pretauri:dev` | `tauri:dev` 的自动前置步骤，准备调试运行时，不单独调用 |
| `npm run tauri:dev` | 准备运行时后启动 UI 调试；不能替代 release 验证 |
| `npm run tauri:build -- --no-bundle` | 规范 release exe 构建 |
| `npm run bundle:nsis` | 构建并校验 NSIS 安装包，仅在明确需要时运行 |
| `npm test` | 串行运行全部 Node 测试 |
| `npm run test:coverage` | 运行 Node 测试并生成覆盖率 |
| `npm run test:coverage:core` | 校验项目核心模块覆盖率门槛 |
| `npm run test:ui:smoke` | 使用真实 Edge 做 Dashboard 冒烟检查 |
| `npm run quality:check` | 运行提交前统一质量门禁 |
| `npm run release:check` | 运行发布门禁并生成规范 release |
| `npm run check:bundle-patches` | 校验受保护的本地 bundle 补丁 |
| `npm run check:runtime-secrets` | 扫描运行资源中的部署密钥和内部标识 |
| `npm run check:hygiene` | 检查仓库和 release 临时/冗余文件 |
| `npm run check:runtime-paths` | 检查运行时资源路径契约 |
| `npm run check:runtime-manifest` | 校验内置二进制版本、大小和 SHA-256 |
| `npm run check:versions` | 校验产品版本一致性 |
| `npm run check:entrypoints` | 防止绕过规范构建入口 |
| `npm run check:test-structure` | 校验测试文件职责和规模 |
| `npm run check:third-party` | 校验第三方资源、来源和许可证 |
| `npm run verify:nsis` | 解包并校验已生成的 NSIS |
| `npm run restore:pkg` | 禁用的保护入口；只输出危险操作说明 |
| `npm run restore:pkg:danger -- --force` | 覆盖上游 bundle，必须先获授权并准备重做本地补丁 |
| `npm run fetch:binaries` | 禁用的保护入口；不会下载资源 |
| `npm run fetch:binaries:danger` | 联网更新内置二进制，必须先获得明确授权 |
<!-- END AUTO-GENERATED -->

### 构建注意事项

- `tauri.conf.json` 当前 `bundle.targets = "all"`；开发验证优先使用 `npm run tauri:build -- --no-bundle`，避免生成安装包。
- `npm run tauri:build` 会临时生成裁剪后的运行时暂存目录并执行 `npm run check:bundle-patches`；Tauri 随后直接生成唯一的 `target/release/resources/` 运行时资源树。暂存目录无论构建成功或失败都会自动删除。
- 构建包装器设置 npm 与 Cargo 离线模式；本地缓存、依赖或运行时资源缺失时直接失败，不允许构建期间下载。
- `Cargo.toml` 中 `tauri` 须声明 `custom-protocol` feature
- 修改 `lib.rs` 或 `src/index.html` 后使用规范命令重新构建；只有确认 Cargo 缓存损坏时才清理 release 缓存。
- 普通源码修改先运行 `npm run quality:check`。只有需要交付 exe 或 NSIS 时才构建 release；不要用原始 `cargo build` 验证交付产物，它不会准备运行时资源。
- 非测试 Rust 代码不得读取 `CARGO_MANIFEST_DIR` 或任何绝对项目路径来补拷运行时资源。运行实例只读取自身同级的 `resources/`，缺失即视为构建失败。
- `npm run release:check` 的 Rust 测试产物写入系统临时目录并自动删除，不会生成或使用项目内的 `target/debug`。
- 实际交付 exe 或 NSIS 时填写 [发布验收清单](RELEASE_CHECKLIST.md)，记录 commit、版本、功能抽查和产物 SHA-256。
- `scripts/restore-visionox-pkg.js` 是维护/重拉上游 reasonix 包的工具，不是常规构建步骤。普通 `npm run restore:pkg` 已禁用；必须在备份并准备重新迁移补丁后，才使用 `npm run restore:pkg:danger -- --force`。
- Node.js、OfficeCLI 和 DWS 都有公开上游来源。普通构建不联网；缺少已批准的本地二进制时应停止并说明。只有用户明确授权联网更新后，才可运行危险维护入口，下载到系统临时目录并通过 manifest 校验后更新源码资源。

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

> 关键文件和系统架构详见 [架构说明](ARCHITECTURE.md)。

---

## 四、编码规范

### Rust

- `cargo fmt` 提交前执行
- 禁止在非测试代码中使用 `unwrap()` / `expect()`，改用 `anyhow::Context`
- `unsafe` 块必须有 `// SAFETY:` 注释
- 函数参数优先 `&str` 而非 `String`，`&[T]` 而非 `Vec<T>`

### 编译检查

- 修改 `.rs` 后先执行质量门禁；需要交付验证时再执行 `npm run release:check`
- 提交前执行 `cargo fmt --check`；需要 Clippy 时显式使用 `cargo clippy --release -- -D warnings`
- 完整交付验证使用 `npm run release:check`；其中构建步骤只通过规范包装器生成 release

### 安全

- 不在源码中硬编码密钥/Token
- 不在 API 返回中暴露内部路径/堆栈
- `cargo audit` 和 `npm audit` 需要联网，只能作为明确授权的维护检查，不属于默认离线质量门禁

---

## 五、配色方案

实际生效的 Design Tokens 和主题覆盖以
`src-tauri/resources/server/visionox-pkg/dashboard/app.css` 为唯一事实来源，不在文档中复制整套变量值。
当前 UI 提供 9 套主题；8 套非默认主题的覆盖样式位于 `src-tauri/theme/`，light 主题直接定义在 `app.css` 中。

新增或调整样式时应复用现有 surface、text、accent、semantic、border、spacing、radius 和 motion 变量，
并保留 bundle 中仍在使用的 legacy alias。组件尺寸、焦点、禁用、加载和错误状态必须在真实 Edge 中验证；
不要仅更新主题源文件而遗漏最终 `app.css`。

### 新增方案步骤

1. 在 `src-tauri/theme/` 创建 `new-theme.css`（可选）
2. 在 `app.css` 末尾追加 `[data-theme="new-theme"] { ... }`
3. 在 `app.js` 的主题选择器中添加对应选项

---

> 加载页机制、刷新恢复和 visionox-pkg 维护边界详见 [架构说明](ARCHITECTURE.md)。

---

## 六、平台范围

Windows release 和 NSIS 是当前唯一受支持的交付目标。仓库中的 Unix 条件代码与 Linux bundle 配置属于未持续验证的实验性兼容基础，不构成 Linux 产品支持承诺。

---

*最后更新：2026-07-23 | 适用：Visionox-Whale 1.28.0*
