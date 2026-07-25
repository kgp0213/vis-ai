# AGENTS.md - Visionox-Whale AI 代理行为规范

本文件适用于仓库根目录及其全部子目录。子目录存在更具体的 `AGENTS.md` 时，按路径作用域叠加执行；子目录规则不得反向覆盖主项目的产品约束。

用户可能不熟悉软件工程术语，需求也可能不完整。代理应结合源码和现有上下文，以资深开发、项目管理和测试视角补全有充分证据的信息。简单、安全、可逆的任务直接执行；只有会显著改变结果的歧义才一次一问。不得用大量问题阻塞普通任务，也不得在未验证产物前声称任务完成。

## 1. 核心架构原则

- 项目只有一个模型执行内核：现有普通模型工具循环。简单任务直接进入该循环；复杂任务通过计划、步骤、执行回执和运行时状态监督同一个循环。
- Session、Schedule、Knowledge、Workspace 和 OperationContext 只负责生命周期、隔离、调度、回执和恢复，不得复制模型请求逻辑或建立第二套模型循环。
- 不得新增 PDF、Word、Excel 或其他领域专用后台模型流程、专用自动续跑协议或模型专用任务执行器。领域 Skill 只能指导普通工具循环使用现有工具。
- 普通任务升级为多步骤任务时，必须继承当前会话、已有工具结果、工作区、明文文件绑定和 operation，不得从空上下文重新执行。
- 执行中发现目标偏离、工具失败、路径失效、结果不完整或运行机制失效时，应提供事实、建议和可执行选项；不得重复弹出相同干预卡片。

## 2. OperationContext 与隔离

- operation 生命周期为 `running -> stopping -> completed/cancelled/failed/unknown`；终态必须幂等，迟到的回调不得覆盖已确定终态。
- 会话切换前，旧 operation 必须停止或进入 `unknown`。旧会话的工具结果、消息、授权和产物不得写入新会话。
- 工作区切换后，旧工作区工具、MCP、语义索引绑定和明文文档绑定必须失效；当前 operation 的工作区快照不得被静默改写。
- 取消操作必须同时撤销工具调用、后台任务和 operation 级外部发送授权。
- 重试必须沿用正确的 session、workspace 和 operation 关系。进程异常退出或结果不可确认时，状态必须为 `unknown`，不得推断为成功。
- 执行回执应保存真实工具错误、产物状态、警告和干预选择，并在会话保存、恢复和 UI 展示中保持一致。

## 3. 源码和生成物所有权

- 主运行时入口：`src-tauri/resources/server/launcher.mjs`。
- 可维护服务端源码：`src-tauri/resources/server/lib/`；测试与源码同域维护。
- Dashboard 源码：`src-tauri/resources/server/visionox-pkg/dashboard/src/`。
- Dashboard 生成物：`dashboard/dist/app.js` 和 `dashboard/app.css`。必须修改源码后运行 `npm run dashboard:build`，不得直接编辑生成物。
- `src-tauri/resources/server/visionox-pkg/dist/` 是上游 CLI bundle。直接修改可能被上游升级覆盖；确需修改时，必须将稳定标记登记到 `scripts/check-bundle-patches.js`。
- `scripts/bundle-source-ownership.json` 是 Dashboard 生成物所有权清单；源码构建结果必须与已提交产物一致。
- `src-tauri/target/` 是生成目录，不得提交，也不得作为源码来源。
- `ECC/`、`DWS/` 及其他第三方或同步目录仅在用户任务明确涉及它们时修改；不得把其中的 `AGENTS.md` 规则反向应用到主项目源码。

## 4. 构建和交付

- 唯一 release 交付锚点是 `src-tauri/target/release/visionox-whale.exe` 及其同级 `resources/`。
- `target/debug` 仅用于快速查看 UI，不得替代 release 交付验证。
- 规范 release 构建命令：`npm run tauri:build -- --no-bundle`。
- 安装包命令：`npm run bundle:nsis`，只有用户明确要求安装包时才执行。
- UI 调试可以使用 `npm run tauri:dev`；普通构建不得直接调用 `cargo build` 绕过资源准备、补丁检查和发布清单。
- 禁止在仓库内创建额外构建目录，例如 `target/*-build`、`*.old`、`*.bak` 或运行时资源副本。
- 禁止手工复制资源到 `target/release`。旧发布资源只能由规范构建脚本的受控清理逻辑处理。
- release 文件被锁定时，只能关闭能够确认由当前项目启动的 Visionox、Node、OfficeCLI 或 DWS 进程，然后继续使用规范目标目录；不得重定向构建输出。

## 5. 分层验证

- 小范围修改先运行与改动直接相关的测试。
- 服务端或共享行为修改后运行 `npm test`。
- Dashboard 修改后运行 `npm run dashboard:build` 和相关 UI 测试；提交前的 `npm run quality:check` 会验证 Dashboard 可重建性。
- 提交前运行 `npm run quality:check`。该命令已包含 Node 测试、核心覆盖率、bundle 语法、补丁检查、仓库卫生、Rust 格式和 Edge 冒烟测试；成功后无需立即重复运行相同的 `npm test`。
- `npm run release:check` 包含隔离 Rust 测试和规范 release 构建，只有用户明确要求完整 release 验收或已授权 Rust 测试时执行。
- Rust 测试产物必须使用系统临时目录，不得创建新的仓库内 target 变体。
- 验证失败时必须区分源码缺陷、工具链问题、网络限制和外部服务限制，不得把环境变化误报为代码修复。

## 6. 运行时资源

- 生产运行时只允许从 `current_exe()` 同级的 `resources/` 读取资源，不得回退到源码目录、仓库绝对路径、安装目录猜测或 `CARGO_MANIFEST_DIR`。
- 测试可以读取源码 fixture 或使用注入的系统临时资源目录，但不得把测试路径回退逻辑带入生产代码。
- 资源缺失必须明确失败，并通过规范构建流程修复。
- `src-tauri/resources/server/visionox-pkg/node_modules/` 是离线构建和测试依赖。它不进入 Git，但在没有下载授权时不得当作“过期文件”删除。
- Node、OfficeCLI、DWS 等二进制必须与 `runtime-manifest.json`、`third-party-resources.json`、许可证、版本和 SHA-256 保持一致。
- Python、Node 及 Skill 依赖由 `%USERPROFILE%\.visionox\runtime\tool-registry.json` 和共享环境统一管理；不得在任务输出目录创建 `.venv`、`node_modules` 或执行临时 `npm --prefix` 安装。
- Skill 应通过可选的 `runtime-requirements.json` 声明依赖。普通工具子进程复用 operation 注入的 `VISIONOX_PYTHON`、`VISIONOX_NODE`、`VIRTUAL_ENV`、`NODE_PATH` 和 `PATH`，不得依赖系统 PATH 猜测解释器位置。
- 本地发现和缓存修复可以自动执行；联网安装必须取得一次 operation 级授权，默认按用户配置、国内镜像、官方源的顺序尝试，禁止使用 HTTP、任意模型传入镜像或 `--trusted-host` 绕过 TLS。

## 7. 加密文件和临时数据

- 审计、解压、比较和测试产生的普通临时数据必须放入系统临时目录，并在命令成功或失败后清理。
- `prepare_local_document` 产生并登记到当前 operation 的明文文件属于运行时工作集，不得在单次工具调用结束后删除。它必须保留到 operation、会话或既定 TTL 的安全回收点。
- 后续工具、命令和临时脚本必须持续使用已绑定的明文路径，不得重新访问原始加密路径。
- 明文绑定必须携带源文件身份、当前路径、operation、workspace 和最近使用时间；绑定失效时应明确提示并允许用户重新准备文件。
- 所有持久化临时目录、资源副本或大规模清理操作必须在执行前向用户说明目标和影响。
- 删除前必须解析并核对绝对路径。禁止对仓库根目录、用户目录或未解析变量执行递归删除；不得删除规范 release 可执行文件或资源树。

## 8. DWS 和外部副作用

- 自动测试默认禁止真实 DWS 发送。相关测试必须使用 `VISIONOX_TEST_MODE=1` 或 `DWS_SKIP_REAL_SEND=1`，并验证没有调用真实外部发送。
- DWS 真实发送、外部消息、附件发送和其他不可逆操作必须遵守当前 operation 的授权范围。没有明确授权时不得发送。
- 用户在当前任务中明确要求发送普通消息或附件，或已经完成二次确认时，同一 operation 内不得重复申请相同授权。
- 定时任务中已经结构化授权的常规通知不得被附件授权规则误伤；收件人、附件或 operation 变化时必须重新判断。
- 真实发送必须记录 operationId、目标、内容类型、幂等标识和结果回执。测试绝不能因为位于 `__tests__` 或被 `npm test` 收纳而默认产生真实副作用。
- 未经用户单独授权，不执行 DWS 真实发送测试，即使目标是用户本人。

## 9. 临时文件、进程和破坏性操作

- 临时目录必须位于 `os.tmpdir()`，且命令结束后清理；operation 级明文文件按第 7 节生命周期处理。
- 关闭进程前必须确认 PID、命令行或父进程属于当前 Visionox-Whale 实例。禁止按名称全局关闭所有 `node.exe`。
- 关闭项目进程后必须等待其完全退出，再操作 release 文件。
- 禁止使用 `git reset --hard`、`git checkout --`、强制推送或其他会丢失用户修改的命令，除非用户明确指定并确认影响。
- 工作区可能存在用户改动。不得回退、覆盖或顺手格式化无关文件；只修改和暂存当前任务涉及的内容。

## 10. 依赖、网络和第三方资源

- 默认使用现有离线缓存。未经用户明确授权，不得下载依赖、工具或运行时二进制。
- 只有用户明确要求同步 OfficeCLI 或其他外部资源时，才允许使用 `gh` 或项目提供的同步脚本访问指定来源。
- 同步第三方资源后必须更新版本、SHA-256、许可证、notice 和资源清单，并运行第三方资源校验。
- 不得主动启动或安装 NSIS 安装包。
- 不得将真实 API Key、DWS 身份文件、聊天状态或开发机器绝对路径写入源码、日志、测试 fixture 或发布资源。

## 11. Git 和提交边界

- 开始修改前检查 `git status`，保留用户已有改动。
- 提交时只包含当前任务文件；不自动提交、推送、创建分支或安装构建产物，除非用户明确要求。
- 提交说明应准确描述行为变化。环境限制、人工测试和未执行的外部验证必须如实记录。
- Qwen 等依赖特定网络的模型测试应记录网络前提；网络切换后成功不能描述为源码修复。

## 12. 语义索引默认配置不可回退

- 新安装或语义配置缺失时，必须默认使用 `openai-compat`。
- 必须预填完整 Embeddings URL `http://10.71.4.202:10307/v1/embeddings` 和模型 ID `Qwen3-Embedding`。
- API Key 必须保持为空；不得将示意值 `api-xxxxx` 写入配置。界面只能用“请输入实际 API Key（例如 api-xxxxx）”提示用户输入。
- 凭据清理、配置迁移、安全扫描和默认值整理只能移除历史真实 API Key，不得清空或删除默认 URL 和模型 ID。
- 默认值源码锚点是 `src-tauri/resources/server/lib/semantic-config-defaults.mjs`，回归锚点是同目录的 `semantic-config-defaults.test.mjs`。
- 涉及语义配置的修改必须运行该专项测试及 `npm test`。除非用户明确要求修改产品默认值，否则重构、去敏、配置合并和上游 bundle 更新都不得改变这一行为。

## 13. 完成和报告

- 完成前核对用户目标、实际改动、测试结果、release 产物和未完成事项。
- 文件类任务必须验证文件存在、大小、修改时间和基本内容；不得仅凭模型回答判断产物完成。
- 错误提示应描述已确认事实、影响和下一步操作，不使用“未检测到文件”等无法说明真实原因的笼统结论。
- 如果任务只能部分完成，应保留现场并明确标记未覆盖范围、恢复方式和需要用户决定的事项。
