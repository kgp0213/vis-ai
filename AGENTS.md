# AGENTS.md - Visionox-Whale AI 代理行为规范
用户可能不专业，表达可能不清楚，你需要从专业资深程序员，资深项目经理，资深软件测试等方面梳理用户需求，并给出专业建议。

## 1. 构建目标

- 唯一验证目标：`src-tauri/target/release/visionox-whale.exe` 及其同级 `resources/` 目录。
- `target/debug` 仅用于快速查看 UI 调整效果，不得替代 release 交付验证锚点。
- 默认构建命令：`npm run tauri:build -- --no-bundle`。
- 安装包构建：`npm run bundle:nsis`（仅在用户明确要求时）。

## 2. 禁止的构建行为

- UI 调试可使用 `npm run tauri:dev`；普通源码构建与交付仍使用规范 release 命令，禁止直接运行 `cargo build` 绕过资源准备。
- 禁止在仓库内创建额外构建目录（`target/*-build`、`*.old`、`*.bak` 等）。
- 禁止手动拷贝资源到 `target/release`——构建流程自动生成规范 `resources/`。
- 禁止复制 `server/` 或产生审计/临时副本到仓库内。
- 若 release 文件被锁定，关闭相关进程（Visionox、Node、OfficeCLI）后继续使用同一目标，不得重定向输出。
- 删除生成物前，必须确认其绝对路径位于仓库内，且不是规范可执行文件或资源树。

## 3. 运行时资源约束

- 程序运行时只允许从 `current_exe()` 同级的 `resources/` 读取资源。
- 非 Rust 测试代码不得通过 `CARGO_MANIFEST_DIR`、绝对项目路径或安装目录读取运行时资源。
- 资源缺失必须明确失败，由构建流程修复。

## 4. visionox-pkg 补丁边界

- `visionox-pkg/dist/` 下的产物是上游 bundle，直接修改会被升级覆盖。
- 如需修改 bundle 产物，必须记录补丁到 `scripts/check-bundle-patches.js` 的已知补丁列表。
- 构建前 `check:bundle-patches` 会自动校验，不通过则构建中止。

## 5. 临时文件与清理

- 所有临时数据（解压、审计、比较、测试）必须放在系统临时目录（`os.tmpdir()`），绝不允许置于仓库内。
- 命令完成后（无论成功或失败）须立即清理临时数据。
- 在运行任何会创建新持久目录或资源副本的命令前，必须事先汇报。

## 6. 依赖与网络

- 未经允许，不得在构建或验证过程中下载任何依赖或工具，仅使用既有离线缓存。但是可以用GH命令连接github 同步officecli
- 未经明确要求，不得主动启动或安装 NSIS 包。

## 7. 测试与质量门禁

- 修改后应运行 `npm test` 确认 Node 测试通过。
- 提交前运行 `npm run quality:check`（包含 bundle 语法、补丁检查、仓库卫生、Node 测试、Edge 冒烟渲染）。
- Rust 测试需要用户授权；测试产物应使用系统临时目录，避免污染项目构建输出。

## 8. 进程管理

- 在执行明确要求的重新构建时，可以关闭 Visionox 所属进程（visionox-whale.exe、node.exe、officecli.exe）。
- 关闭后须等待进程完全退出再操作目标文件。
