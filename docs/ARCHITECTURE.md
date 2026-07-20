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
│   │   ├── dws.exe                   V来家/企业钉钉 CLI
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

## 复杂任务执行引擎的灰度边界

复杂任务执行引擎当前仍以 `legacy` 为生产默认。`VISIONOX_COMPLEX_TASK_ENGINE` 环境变量优先于
`config.json` 中的 `complexTaskEngine`；只有显式设置 `v2-canary` 或 `v2-default` 才运行 v2，
`shadow` 仍执行兼容路径。缺省值或无法识别的值必须收敛到 `legacy`，不得因拼写错误意外启用实验路径。
启动诊断通过 `lib/complex-task-engine-routing.mjs` 的纯函数提供稳定的来源、有效性、实验状态和风险码，
不读取 Provider 凭据，也不把配置正文写入日志。

当前 v2 文档路径仍在完整提取并形成可审计来源清单之后创建 durable Task。因此，提取阶段尚不具备
Task lease、heartbeat、Outbox 和进程恢复能力；显式启用 v2 时诊断必须标记
`COMPLEX_TASK_V2_PRE_INTAKE_NOT_DURABLE`。在加入受校验的 planning draft、分批提取 checkpoint 和
原子 finalize 之前，不得把 v2 改成默认，也不得用空 `requiredCoverage`、虚构 source unit 或降低覆盖要求
绕过 `TaskContract`。该 intake 改造需要同时覆盖 Store、Supervisor、取消/恢复、来源变化和 UI 状态，
应作为独立纵向切片实施；旧文档流程继续作为生产兼容路径。

通用 Task Store 的 revision、lease 和 epoch CAS 当前以单 Node sidecar 为可靠边界。桌面端通过 Tauri
单实例插件和服务监控器在启动替代 sidecar 前回收并等待旧进程，满足现有产品路径的单写者假设。
在引入外部 Worker、多 sidecar 或共享任务目录前，必须增加跨进程 mutation/event 锁和真实子进程并发测试；
不得把当前实例内 Promise 串行化描述为跨进程 CAS。

## 配置兼容性

用户配置位于 `~/.visionox/config.json`，通过 `configSchemaVersion` 管理格式。旧配置迁移前会在
同一用户数据根目录的 `backups/` 下创建一次权限受限的迁移恢复文件，随后复用核心配置 I/O 的
原子写入。损坏 JSON、未知版本或备份失败时，Launcher 拒绝覆盖原配置并明确失败。

迁移日志只记录版本和状态，不输出 API Key 或配置正文。

## 模型请求配置契约

Provider 的 `requestPolicy: "json"` 表示模型请求参数由导入 JSON 管理。模型的 `requestDefaults` 会合并到
OpenAI 兼容的 `/chat/completions` 请求中；`model`、`messages`、`stream` 和 `tools` 属于程序维护的协议字段，
不允许被配置覆盖。厂商新增的采样、思考或扩展字段无需在程序中逐项登记，只要仍使用兼容协议即可透传。

模型可选配 `verificationRequestDefaults`。全模型检测和设置页凭据检测会将该对象递归覆盖到
`requestDefaults`，但不会改变正式聊天配置。该机制用于让通信检测关闭耗时思考或采用更轻量的采样参数；
检测仍固定为单次尝试、10 秒超时和最多 64 个输出 token，并要求返回固定探针标记。检测配置也经过协议保留字段、JSON 深度和大小校验，
并纳入模型检测指纹；导入任何模型配置后，旧检测结果会失效。

程序不把 UI 的 DeepSeek `efforts` 或 `thinkingMode` 映射为 Qwen 的 `thinking_budget`。JSON 策略下的模型
升级应通过配置文件按新接口的真实字段和层级更新；只有服务不再兼容 `/chat/completions` 时才扩展程序协议层。

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

`resources/third-party-resources.json` 是打包运行资源的机器可读清单，记录 Node、OfficeCLI、DWS、Reasonix、
KaTeX 和 bootstrap skills 的版本、来源、许可证与可用哈希；`THIRD_PARTY_NOTICES.md` 随资源一起分发。
OfficeCLI 与 KaTeX 使用 README 记录的上游仓库。bootstrap skills 是混合来源和混合许可证集合，按每个
`SKILL.md` 元数据及随附许可证判断，不能整体标为 MIT。版本检查不执行二进制，也不在构建时联网查询。
Superpowers 工作流的运行副本只位于 `resources/bootstrap-skills/`，来源和 MIT 许可证由 provenance 与
`SUPERPOWERS_LICENSE.txt` 固定。仓库根目录中被忽略的 `skills/superpowers/` 只可作为本地上游参考，
不参与运行时加载、构建或打包，不能作为交付资源依赖。

`runtime-manifest.json` 进一步固定 Node.js、OfficeCLI 与 DWS 的版本、大小和 SHA-256。二进制不进入 Git；普通
构建完全离线。明确授权的危险维护入口可从公开上游获取资源，但必须下载到系统临时目录并在写入源码
资源前完成清单校验。OfficeCLI MCP 在 Dashboard 服务可用后后台初始化，不阻塞 Tauri 首屏启动路径；
OfficeCLI 请求使用 180 秒超时，其他 MCP 保持上游默认 60 秒，避免长文档操作被通用超时提前终止。

## V来家集成边界

`lib/vhome-integration.mjs` 的常规后台检查只执行内置 `dws.exe` 的 `auth status` 和 `contact user get-self`，
带 8 秒进程超时、并发去重和 60 秒缓存。Dashboard 首次渲染后请求 `/api/vhome/status`，之后每 5 分钟刷新；
因此 DWS 启动、网络或 OAuth 异常不会进入桌面程序首屏关键路径。登录进程记录启动路径、stdout/stderr、
退出码、signal 和各失败分支的稳定原因码到本机服务日志；原始输出限制为 64 KiB 尾部，便于异机故障定位。
API 只返回连接状态、用户名、组织名、检查时间、Device Flow 临时授权状态以及经过脱敏的失败提示与短诊断，
不返回 userId、corpId、Token 或原始命令输出。

用户点击登录后，`POST /api/vhome/login` 启动可取消的 Device Flow 子进程；Dashboard 在授权期间短轮询状态，
只显示钉钉登录 URL、一次性 user code 和过期时间。`DELETE /api/vhome/login` 取消等待，`POST /api/vhome/logout`
仅退出服务端保留的当前组织 ID。登录、等待和失败均不阻塞普通 AI 功能；Launcher 不会在启动时自动打开浏览器。

模型通过内置 `dws` Skill 使用协作能力。明确的 V来家业务请求可自动路由到该 Skill；技术讨论不自动路由。
Skill 调用前检查连接状态，未连接时直接引导用户登录。消息读取按未读会话、指定会话、@我、发送者和关键词
区分命令与时间参数，并以当前二进制的逐级 `--help` 为最终依据，避免静态手册参数漂移。
消息发送通过结构化 `dws_write` 工具执行：模型只能提交收件人类型、稳定 ID 和内容。宿主只把当前聊天请求或
用户保存的定时任务原始提示作为发送授权，系统包装、检索内容、引用示例和功能讨论均不构成授权；随后由本地
规则与独立模型审查最终消息。明确授权的安全内容可直发，重要内容按用户当前指令决定，有害、不确定、附件或
未授权内容必须确认，后台没有交互界面时不发送。实际发送才添加 `--yes` 和幂等 UUID。其他外部写操作仍由
`dws_exec` 展示真实命令、目的和影响并逐次确认。Visionox 不读取、迁移或备份
`~/.dws/`。安装包包含 `dws.exe`、Apache-2.0 LICENSE/NOTICE，以及内置 Skill 的精选只读命令参考；不包含 portable
用户态目录、身份、Token、日志或上游脚本。Launcher 根据自身资源目录解析内置
`dws.exe`，通过 `VISIONOX_DWS_EXECUTABLE` 和 `VISIONOX_NODE_EXECUTABLE` 将实际路径传给 Skill 只读适配器，
不依赖开发机路径、系统 `PATH` 或仓库目录。受控 `dws_read` 单次最多读取 200 条并要求继续分页；Shell 策略拒绝
项目外 DWS 绝对路径、绕过只读工具的直接查询，以及绕过 `dws_write` 的消息发送，避免旧会话沿用开发机路径或
不同模型漏掉写入确认。

对话式 Skill 创建由 `skill-routing.mjs` 的本地高精度规则识别，要求 V来家领域、创建动作和 Skill/工作流对象同时
成立，并排除源码、测试、文档和产品讨论；不调用 embedding、网络或额外模型。命中后加载独立的
`vhome-skill-builder`，由系统级提示词、Skill 工作流和 `ask_choice` 工具描述三层共同要求模型使用交互卡片，避免
不同模型退化为正文 A/B/C 菜单。

`vhome-skill-drafts.mjs` 管理七天有效、带修订冲突保护的版本化草稿，并确定性生成最小 Skill 目录。生成内容只包含
`SKILL.md`、`references/workflow.md`，需要调度时才增加通过现有 schema 校验的 `integration.json` 与
`schedule-templates.json`。`dws_read` 复用内置只读适配器并拒绝写命令、未知参数和过量分页；测试和安装预演位于
系统临时目录。`install_vhome_skill_draft` 自行发起最终确认卡片，确认后复用现有原子 Skill 安装和历史回滚机制，
取消时不安装且保留草稿，内置 Skill 永远不可覆盖。

V来家采用三层维护边界：软件内核负责认证、进程、脱敏、连接门禁和副作用确认；`dws/SKILL.md` 负责模型可读的
交互流程；`integration.json` 与 `schedule-templates.json` 负责机器可读的兼容版本、能力和只读定时模板。普通定时
任务可以保存 `skillName + skillAction + 用户补充要求`，每次运行时再从当前已安装 Skill 解析模板并通过结构化
`skillInvocation` 调用，因此更新 Skill 后已有任务自动使用新流程。模板必须通过 schema、DWS 最低版本、变量白名单
和风险等级校验；当前只允许 AI 读取后整理总结，自动发送、审批、修改和删除不进入定时模板。

定时 Skill 的完整回答写入用户数据目录下的受管理 Markdown 报告，任务页可直接预览。知识归档必须绑定一个
稳定的归档工作区，目标为 `<workspace>/knowledge/vhome/`，不会跟随当前工作区切换。归档前由模型执行质量、
证据覆盖和复用价值审核；来源指纹负责去重，同主题结果追加到同一文档。自动归档和归档后更新 embedding 索引
均为独立的用户可选项，默认关闭。

Skill 包更新沿用原子目录替换并保留最近三份历史，`rollback_skill` 仅在用户明确要求时恢复上一版。Skill 更新不修改
DWS OAuth 凭据、软件认证内核或 DWS 二进制；DWS 自升级仍是独立且需要用户明确确认的维护动作。需要 V来家连接的
定时模板在未登录时记录为“等待登录”，不自动打开浏览器；重新登录后由状态轮询触发一次补跑。

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

本地文档在交给解析器前由 `prepare_local_document` 统一准备，默认 `dlp.mode=auto`。普通文件保持原路径；
只有命中文件头特征时才调用 `resources/server/visionox-file/visionox_file.py`。`lib/dlp-file.mjs` 为每个已准备
文档生成稳定 `documentRef`，双向记录原始路径和当前可读路径，并将活动引用写入会话元数据。切换 Skill、
恢复会话或临时明文缺失时，所有文档工具都可通过原始路径重新准备；任务结束不自动删除明文副本，也不得
把特定工作区路径写死到源码。运行时只从 exe 同级资源发现脚本，不读取源码目录或机器专用路径。该文件头
判断只是当前环境的兼容策略，不是通用加密标准；输出不得覆盖原文件，新增特征必须用测试证明普通文件不会
被误判。

现有 PDF 的文本读取由 `lib/pdf-text.mjs` 使用随包 PDF.js 延迟执行，不经过 OfficeCLI，也不依赖系统 Python。
复杂 PDF 编辑继续使用 `pdf` Skill；`md-to-pdf-cjk` 只负责 Markdown 生成 PDF。PDF.js 判断文本极少时向上层
报告可能为扫描件，再由用户决定是否使用 OCR，避免无意义地轮换文本解析器。

单文档保存型整理使用通用前台工具循环：先 `prepare_local_document`，按格式通过 `extract_pdf_text`、
OfficeCLI 文本视图或 `read_file` 分批读取，每批必须先由 `write_file`/`append_file` 持久化，再请求下一批。
`lib/context-input-transaction.mjs` 将大段只读结果按 SHA-256 无损缓存到用户数据目录，记录
`pending -> materialized -> foldable` 状态；普通上下文压缩必须等待 pending 输入处理完成，紧急压缩保留
`read_context_input` 引用。重复阻塞、缓存失败或未完整处理便声称完成时，Launcher 通过一次一问卡片让用户
选择继续、调整要求、接受部分结果或停止。该机制与文档格式和模型无关，Skill 只负责提示策略，不是可靠性
前提。

`lib/document-extractors.mjs` 与 `lib/document-markdown-workflow.mjs` 继续服务多文档报告及历史后台任务。
页或元素仍是覆盖、哈希、恢复和重试单位；旧任务的清单、检查点、审校结果与状态查询保持兼容。

多文档报告及历史后台任务的任务清单、来源批次、中间 Markdown、批次检查点和追加式事件流水位于
`%USERPROFILE%\.visionox\document-jobs\`，默认保留 30 天。每个完成批次先保存包含内容哈希的独立检查点，
再写预览区块并登记任务清单；恢复时优先核对来源哈希和检查点，旧版遗留的孤立区块通过确定性质量审计后
以“需要复核”登记，禁止无条件信任或重复生成。最终状态不会覆盖事件流水中的早期中断原因。

文档长任务区分“后台工作器结束”和“用户目标已经交付”。任务清单持久化发起会话 ID、工作区、工作模式和
原始用户目标；`lib/long-task-handoff.mjs` 以任务执行代次和终态生成一次性交接键。正常完成、需复核、失败、
执行预算暂停、程序中断或来源变化后，结果进入 FIFO 交接队列；前台对话繁忙时等待空闲，同一原会话和工作区
仍活动时由全局 Launcher 自动续接模型，切换会话或工作区后则保留为“待处理”，不会注入当前错误会话。该逻辑
位于工作模式之外，通用、编程等模式共享同一生命周期。应用重启会扫描未交付终态，并用租约和持久交接状态避免
同一执行代次重复接管；用户主动暂停、停止或放弃不会被自动恢复。

输出路径在任务入队、发生任何模型调用之前由 `lib/document-output-reservation.mjs` 规范化并保留。默认命名同时
排除磁盘文件、活动任务和本进程尚未落盘的并发保留；显式路径冲突通常直接返回用户选择。只有在来源内容哈希、任务契约和
目标路径都与已有任务一致时，才允许请求进入重复任务完整性核验，从而区分已验证、缺失可恢复和已被修改的产物，不能把
普通同名文件误当成可覆盖结果。
宿主组装完整内容后先在任务目录写入带 SHA-256 的 `final-draft.md`，再提交到用户目标路径。若运行期间有外部程序
占用目标路径，任务进入 `awaiting_output`，完整草稿仍可预览；冲突解除后提交草稿不再调用模型。
任务仍处于执行或自动交接状态时，前台文件写入工具以及 `run_command`/`run_background` 中直接引用受管输出的命令和辅助脚本
都会被宿主拒绝，避免模型绕过文件工具边界覆盖或删除后台产物；用户明确结束任务后才可自行编辑已交付文件。

后台队列单批执行并在前台对话繁忙时于批次边界让行；程序重启后运行中任务变为可继续状态。Windows 原子
文件替换对 `EPERM`、`EACCES` 和 `EBUSY` 做有限退避重试；若终端安全策略持续禁止替换已有 manifest，则写入
最多八份单调修订号的不可变快照，读取时选择最新有效版本，禁止退回非原子的原地覆盖。非关键进度心跳失败
只记录诊断，不得成为未处理 Promise 或终止 Node 服务，关键清单写入失败则停止当前任务并保留检查点。源文件只读，
最终正文由宿主按来源顺序组装，先持久化最终草稿，再原子写入创建任务时的目标路径，不依赖模型在一次回答中生成整份文件。每次执行窗口还受
`maxModelCallsPerJob` 和 `jobTimeoutMs` 约束；达到预算会暂停并保留检查点，瞬态模型故障会在当前窗口临时熔断，避免对每个后续区块重复等待。
每个批次清单记录来源字符数和 SHA-256；任务身份优先使用来源文件 SHA-256 内容指纹（旧 manifest 的统计指纹不静默复用），
来源变化重跑时原子刷新任务指纹并记录事件。写入前再次核对提取数量、来源标记顺序、缺失、重复和意外上下文标记。
PDF 页码选择随任务持久化，程序重启后继续任务不会退回到全文件范围。损坏的任务 manifest 以“需要处理”占位显示，
可从后台删除记录，不会让整个任务列表或启动维护失败。

模型 JSON 中的文档能力和预算是初始提示，不是任务能否完成的唯一真相。宿主按实际探测和本次任务观测到的
超时、输出截断、上下文错误、非重试错误及多模态可用性做分批、缩小、熔断和备用候选切换；这些决策按能力与
错误类别实现，不按 Qwen、DeepSeek、Kimi 等模型名称分支。模型较弱时允许内容质量降级并明确复核范围，但不得
导致任务消失、无限重试、覆盖已有文件或在没有交付结论时静默结束。

定时会话报告采用独立的 map/reduce 流程：采集阶段保留完整消息，按当前模型上下文能力切成稳定区块；每个区块先生成证据摘要，随后按覆盖清单归并。历史会话和中间摘要均作为不可信数据传入模型，区块缺失、重复、意外或空摘要会使本次运行失败并进入补跑路径，不会把截断结果标记为成功。任务历史同时记录总消息、实际保留消息、来源字符数和分块覆盖数，便于用户判断报告是否完整。

定时任务完成回调必须匹配仍处于 `running` 的同一 `runId`；迟到或重复回调会被丢弃。启动恢复同时收敛 `running` 和带未完成历史的 `stopping` 任务，避免任务长期停留在“停止中”。会话知识评估对相同版本的失败候选使用指数退避；新会话或内容变化会立即优先处理，避免一个持续不可用的模型阻塞整个整理队列。

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
6. 加载页 JS 检测到 URL 后创建隐藏 iframe，Dashboard 首次渲染后发送 `vis_dashboard_ready`
7. 加载页收到同源 ready 后才显示 iframe；12 秒未就绪则显示日志诊断入口
8. 子进程崩溃监控线程启动（阻塞等待，支持自动重启；主动退出时由 shutdown 标志禁止重启）
```

### 刷新恢复机制

iframe 方案下按 F5 刷新壳页面时，依赖三层恢复：

1. **localStorage 后备**：所有 sessionStorage 读取点增加 `|| localStorage` 回退
2. **Rust 兜底**：`get_dashboard_url` 命令返回当前有效 URL，前端从 Rust 重建
3. **iframe 失败回退**：注册 error 事件，并要求 Dashboard 首次渲染后完成同源 ready 握手；12 秒超时显示可操作诊断页

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
