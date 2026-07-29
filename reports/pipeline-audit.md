# Visionox-Whale 全链路审计报告（对照 kimi-code 事实模型与恢复机制）

- 审计日期：2026-07-29
- 审计链路：用户输入 → 模型规划 → 工具调用 → 失败恢复 → 产物验证 → 最终回答
- 参照系：`D:\kimi-code`（`packages/agent-core-v2` 的 wire/goal/plan 事实模型）
- 方法：定向深读 10 个关键模块 + kimi-code v2 对照。本轮只审计，未修改任何代码。
- 前置：`reports/architecture-review.md`（2026-07-28）已覆盖 operation 生命周期、SSE 重放、崩溃恢复 unknown 收尾、熔断、重试预算、明文残留等，本报告不重复，只列**新发现**。

## 实施后复核（2026-07-29）

本文件保留首次审计时的证据与判断；后续实现已完成以下收口：

- Steering 已写入模型历史但未保存 resolution 的窗口使用稳定 `admittedInputId` 去重；冷恢复时未应用 Steering 转为 `not_applied`，已经开始派发的队列输入转为 `unknown`，不自动重放。
- 普通“看看文件/解释代码”不再因名词命中而强制进入执行型目标验收。
- 产物路径使用平台路径规范化后匹配，等价的 `..` 路径不再误报缺失。
- `current-turn-write` 只证明文件存在；必须通过宿主回读才升级为 `verified`。
- 带工作区作用域的输入在缺少绑定时 fail closed。
- JSONL、Runtime Fact、SSE 和 Dashboard 已增加封闭 schema 校验及共享传输样例。

完整质量门禁 `npm run quality:check` 已通过；原审计章节作为问题发现记录保留，不再代表当前未解决状态。

---

## 1. kimi-code v2 事实模型的四条已验证纪律（吸收目标）

来自 `agent-core-v2/src/agent/goal/goalService.ts` 头注与 `wire/` 目录：

1. **事件溯源单一事实源**：目标/计划状态通过持久化 Op 日志（`wire.dispatch`）写入，Model 由日志重放派生（`wire.getModel`），Op 形状在 `PersistedOpMap` 注册治理。
2. **重放确定性**：`apply` 内绝不取墙钟——`wallClockMs` 只从 Op payload 来；恢复锚点（`wallClockResumedAt`）在 create/resume 边界持久化，避免周期写。
3. **恢复钩子收敛中间态**：`wire.hooks.onDidRestore` 把重放出的 `active` 目标强制回 `paused`；fork 边界用 `forked` Op 清空 Model。
4. **过期调用否决**：`onBeforeExecuteTool` 否决监听器拦截过期/预算耗尽的 goal 工具调用，返回合成结果让循环继续，而不是抛错打断。

## 2. 本项目已经做对的（本轮新确认，与上游纪律同构）

| 链路环节 | 证据 | 对照上游 |
|---|---|---|
| 输入幂等 | `session-input-admission.mjs:226-231`（fingerprint 去重，同 id 不同内容拒绝）；`launcher.mjs:10607-10642`（requestId 收据按 bootId 作用域，reuse-completion/in-flight/failed/uncertain 四态，**uncertain 绝不自动重试**，要求用户显式重提） | ✅ 收据语义与上游"结果未确认不重演"一致 |
| 忙碌竞态 | `launcher.mjs:10600-10602` 注释与实现：busy 检查与设置在**任何 await 之前** | ✅ 上游 P0 级纪律 |
| 崩溃恢复重排队 | `session-input-admission.mjs:176-199`（promoted/dispatching 恢复为 queue 并记录原因）；持久化失败回滚 + 越界后失败置 `unknown` 而非假装成功（`310-351`） | ✅ |
| 计划证据纪律 | `plan-runtime.mjs:262-296`：**模型提案永远不能自行提升步骤**，必须宿主签发证据（`isHostIssuedEvidence` 过滤，refs 为空即拒绝）；持久化失败回滚 | ✅ 与上游"事实只能来自宿主"同构 |
| 计划作用域 | `launcher.mjs:5630`（`activePlanBelongsToRequest` 按 requestId 归属校验）；`plan-runtime.mjs:316-327`（bindSession 切换即全量重置） | ✅ |
| 目标验证事实模型 | `goal-verification-runtime.mjs:70-72`：**助手散文被刻意排除在输入之外，不能证明成功**；只认宿主工具事实与产物证据 | ✅ 这正是 kimi-code 事实模型的核心精神 |
| 最终化持久化纪律 | `finalization-orchestrator.mjs:99-112`：执行事实持久化失败 → 全部状态强制 `unknown` 并追加警告，绝不虚报完成 | ✅ |
| 流式投影 | `assistant-stream-projector.mjs:34-40,86-117`：流键按 sessionId|operationId 作用域；attempt 单调；offset 缺口 → resync-required；重试 = 重置而非新气泡 | ✅ 与上游"retry 是新 attempt 不是新消息"一致 |
| 会话恢复/分叉 | `session-recovery.mjs:36-59`（fork 清除未决干预、非终态工具置 unknown）；`118-139`（工作区快照校验，不匹配即拒绝除非显式覆盖） | ✅ 对照上游 fork 边界清空 Model |

## 3. 本轮新发现的问题（按严重度排序）

### A1【中】崩溃时正在穿越"模型历史边界"的 steer 输入，恢复后可能在模型历史中重复

- **证据**：`session-input-admission.mjs:176-199` `recoverInterruptedEntries` 把所有 `promoted`/`dispatching` 条目一律重置为 `admitted + queue`。但注释（`382-385`）自己写明：promotion 在**跨越模型/历史边界之前**就是持久的。进程若在"steer 已注入 durable 模型历史、尚未 resolve"的窗口崩溃，恢复无法区分这两种情况——下一回合该输入会被**第二次注入模型历史**，模型看到重复的用户指令。
- **影响**：崩溃小窗口内 steer 类输入在模型视角重复，可能引发重复执行或模型困惑。QUEUE 类无此问题（dispatch 前未越界）。
- **状态**：**推断**——launcher 的 model boundary fence（`launcher.mjs:5230-5301`，前次评审确认其顺序可验证、溢出回滚）可能在注入前按 requestId/inputId 查重，本次未能证实或证伪，需专项核验。
- **建议**：核验 fence 注入路径是否有"该 inputId 是否已在历史中"查重；没有则在注入前补一条基于 durable 历史的查重（成本一行判断 + 回归测试）。

### A2【低】纯问答型任务可能被误判为 incomplete（目标验证的意图分类过宽）

- **证据**：`task-contract.mjs:44` 的 `isExecutionTask` 正则含"文件|代码"等宽泛词——"帮我看看这个文件有没有问题"会命中 → `executionRequired=true`。随后 `goal-verification-runtime.mjs:104-108`：无 requiredOutputs、无必填验收、且 `evidenceRefs` 为空 → 判 `missingCriteria=["execution-evidence"]` → goalState/taskState `incomplete`。
- **触发条件**：模型**零工具调用**直接从上下文作答（例如内容已在上下文缓存中）。有任意一次成功工具调用即有证据，不会误判。
- **影响**：用户看到"未完成"提示，但任务其实已完成。低概率、无数据风险，纯体验误判。
- **建议**：`execution-evidence` 类缺失降级为 warning 而非 missingCriterion；或意图正则去掉"文件"裸词（需配套回归测试）。

### A3【低】产物路径匹配不做 resolve，等价路径可能误报缺失

- **证据**：`goal-verification-runtime.mjs:60-63` 只做斜杠归一 + 小写化。`C:\a\sub\..\b.txt` 与 `C:\a\b.txt`（或 8.3 短名）会被判为不匹配 → requiredOutput 判 missing → goalState `incomplete` 误报。
- **建议**：匹配前对两侧做 `resolve` 归一（注意保持纯函数可测）。

### A4【低·设计张力记录】"current-turn-write" 计入已验证证据

- **证据**：`goal-verification-runtime.mjs:3,18`——本回合写入的文件直接算 verified。写入≠内容正确；截断/写错位置的文件也能通过。
- **评估**：`artifactIncomplete` 另有兜底（`finalization-orchestrator.mjs:38-40`），属于可接受的务实取舍，记录在案即可。

### A5【提示】输入作用域匹配在双侧 workspace 缺失时放行

- **证据**：`session-input-admission.mjs:257`——`workspace` 与 `entry.workspace` 任一为 null 即通过。跨工作区 promote 的理论口子；当前 promote 调用方都带 workspace，实际风险低。建议作为不变量写进注释或测试。

### A6【提示】fork 后附件在源 conversationId 缺失时仅警告

- **证据**：`session-recovery.mjs:180-182`——fork 内附件引用悬空只记 warning。已有明示，可接受。

## 4. 场景化检查结论（您关心的串线/误判/恢复失败）

| 场景 | 结论 |
|---|---|
| 快速重复提交同一输入 | ✅ 客户端 send 防重入 + 服务端 requestId 收据双保险 |
| 忙碌中排队/插话 | ✅ admission 状态机 + fence 有序注入；LOOP_BUSY 拒绝已 admitted 的重复派发 |
| 进程崩溃后恢复输入 | ⚠️ queue 类安全；steer 类有 A1 待核验窗口 |
| 模型重试/断流 | ✅ attempt 单调 + offset 缺口重同步；重复 chunk 丢弃 |
| 工具失败后目标判定 | ✅ 工具失败仅产生 warning，不直接判失败；缺失判据才判 incomplete |
| 纯问答任务 | ⚠️ 零工具调用时可能误报 incomplete（A2） |
| 持久化失败 | ✅ 输入/计划/最终化三层都是"失败即 unknown/回滚"，不虚报 |
| 历史重放 | ✅ transcript 投影只读、确定性（entry.createdAt）；fork 清理未决副作用 |

## 5. 建议吸收的改进（借鉴，不照搬；按性价比排序）

1. **A1 核验优先**：fence 注入查重是本轮唯一【中】级项，核验成本小，若是真缺口则修复价值高。
2. **Op 形状注册治理**：vis-ai 的 active-session.jsonl + execution-transcript 投影已具事件溯源雏形，但缺少 kimi-code `PersistedOpMap` 式的记录形状版本注册——建议给 jsonl 记录类型加集中 schema 注册与版本字段，防止未来记录形状漂移导致重放歧义。
3. **"恢复收敛中间态"不变量成文化**：kimi-code 的 onDidRestore（active→paused）、不重放取墙钟两条纪律，vis-ai 实际已遵守（工具置 unknown、投影用 entry 时间戳）——建议写成不变量注释 + 锚点测试，防止后人无意中破坏。
4. **过期工具调用的否决方式**：kimi-code 用合成结果让循环继续，vis-ai 用 throw（`launcher.mjs:2542-2543` 未知 stepId 抛错）。行为等价、无需改动；记录差异备查。

## 6. 诚实的覆盖边界

- 本报告深读了 10 个模块（约 2700 行）+ launcher 的 submit/收据/fence 锚点；`launcher.mjs`（13,068 行）与 `lib/` 全部 134 个模块未逐行通读。
- A1 为推断级发现，需对 fence 注入路径做专项核验才能定性。
- 未做动态模型行为测试（既定边界）；kimi-code 侧只读了 goal/plan/wire 的头注与关键文件，未覆盖其 loop 内部。

## 2026-07-29 续接实施证据

本轮继续按 Kimi Code 的六项能力补齐实现，以下结论以当前源码和测试为准；上文的风险章节保留为历史审计记录，不代表下面已明确收口的问题仍未修复。

| 能力 | 当前证据 | 结论 |
|---|---|---|
| 独立 Transcript 事实域 | `execution-transcript.mjs` + `transcript-operations.mjs`；生产 `/transcript` 通过 `materializeTranscriptSnapshot` 重建 Turn/Step/Frame 和全局实体 | 已落地 |
| 统一 Operation 收敛规则 | 专用 `task/interaction/attachment/todo/prompt.upsert` 进入同一 Transcript Reducer；文本与 Task 输出都使用 offset overlap/gap 规则 | 已落地，Dashboard 保留跨语言镜像 Reducer |
| Turn 分页与全局实体 | 分页拒绝同时提供 before/after；每页携带 tasks、attachments、interactions、artifacts、receipts、goals、todos、prompts、taskNotifications | 已落地 |
| 冷恢复事实边界 | `cold-recovery.mjs` 将活动 Operation/Turn/Step/Tool/助手消息收敛到 `unknown`，交互为 `interrupted`，未应用 Prompt 为 `not_applied`，后台任务通知为 `lost` | 已落地，不自动重放副作用 |
| 事件序号与两级恢复 | Ring 对超前、过旧、epoch 变化和同序冲突统一返回 canonical resync；Dashboard 在批处理前后均做序号保护 | 已落地 |
| 跨边界 Schema | JSONL、Runtime Fact、SSE、Transcript Operation、canonical Snapshot 校验嵌套执行状态和未来版本；generic `status` 保持业务扩展兼容 | 已落地 |

新增回归覆盖包括：Task 专用操作与大结果分页、Snapshot 结构、未来 Runtime Fact 版本、同序冲突事件、Dashboard Reducer 的迟到保护，以及 Reducer 合并后的流式文本。验证结果：`npm test` 1479/1479，`npm run dashboard:typecheck` 通过，`npm run quality:check` 通过；确定性验收无外网、DWS 发送数为 0、临时目录已清理。

仍然保留的非阻塞边界：事件 Ring 仍是进程内内存结构，溢出后走全量 Snapshot；本轮没有引入磁盘 Journal、第二套模型循环、领域专用后台流程、真实 DWS 或 release/NSIS 构建。
