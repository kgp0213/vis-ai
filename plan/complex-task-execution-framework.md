# Visionox-Whale 通用复杂任务执行框架

> 状态：历史方案与可复用基础设施说明；生产执行主线已改为前台统一模型循环
> 更新：2026-07-20
> 适用范围：文档转换、报告生成、目录整理、知识构建及其他长程复杂任务

## 2026-07-20 主线纠偏

本文件记录的 Durable Store、Supervisor、Coverage Ledger、Artifact Store、Outbox 和副作用治理仍是可复用基础设施；“独立 Bounded Agent Worker + 文档 Adapter 纵向切片”不再代表最终执行架构。若 Worker 直接调用模型并拥有自己的循环，它会与普通 `CacheFirstLoop` 形成第二套执行内核，继续造成简单任务与复杂任务行为分裂。

当前唯一目标以 `complex-task-state-machine-primary-goals.md` 为准：简单任务直接使用普通模型工具循环；复杂任务由通用状态机监督，但复用同一个普通模型工具执行内核。Adapter、Skill 和格式解析器只提供步骤能力与证据，不拥有任务生命周期。本文后续关于文档 Worker、按格式迁移和旧流程回滚的内容保留为历史方案与可复用机制说明，不得据此为 PDF、Word 或其他领域增加专用自动续跑。

当前源码已把确定性准入、运行时升级、单步骤调度、步骤检查点、最终验收和用户干预接到同一个前台 `CacheFirstLoop`。旧 Durable Store、Outbox 和历史结果投影继续用于兼容查看与交付，但旧文档 Worker 和 v2 Worker 不再接受新任务或恢复执行。完整状态以主目标文档 10.2 节为准。

## 2026-07-19 已验证实施状态

以下内容记录 2026-07-19 独立 Worker 方案曾经验证过的基础设施能力，不代表当前生产模型执行路径，也不得作为恢复 Worker 的依据：

| 已落地能力 | 当前实现与验证边界 |
|---|---|
| 持久任务内核 | TaskContract、WorkPlan、Coverage Ledger、manifest 快照、追加式事件、lease、epoch、heartbeat 和 checkpoint 已接入通用 Store/Orchestrator/Supervisor。 |
| 异常恢复 | 过期 lease 和停滞 attempt 可收敛；真实子进程强制退出测试证明重启后保留已完成单元，只继续未完成单元。单次调用超时后先做有界 drain；无法确认旧调用已经退出时进入 `attempt-termination-unconfirmed` 并隔离迟到调用，禁止并发重试。模型和 Adapter recovery 都受任务总 wall-clock 约束。每个工作单元的模型尝试与宿主恢复次数通过带 lease/revision/epoch CAS 的 `attemptBudget` 跨重启持久累计，重启不会重新获得自动预算；显式 replan 建立新预算代并保留旧代审计。当前 CAS 可靠边界是单 Tauri 实例内的单 Node sidecar，尚未提供多 sidecar/多进程文件锁。 |
| 来源完整性 | 文档 Adapter 分别建立 expected/extracted inventory；数量或原子来源集合不一致时以 `EXTRACTION_INCOMPLETE` 阻止错误完成。来源指纹变化后旧任务只能取消并新建任务，不能沿用旧检查点。纯视觉或空文本来源没有安全回退时不写空 artifact、不结算覆盖，明确进入 `needs_review` 并保留缺失范围。 |
| 运行时钉住 | 文档 Adapter、Skill hash 和工具 schema 版本写入契约与产物；生产 strict pin 不匹配时在 Worker 启动前转为可见 `blocked`。 |
| 产物与提交 | 单元产物写入不可变 Artifact Store，经确定性 Assembler 和带冲突处理的 Committer 提交；“确认覆盖”持久化 `conflictPolicy: replace`，“使用新文件名”生成新的路径输入请求，两者均保留 `pendingAssembly` 和已有产物，不重新调用模型。通用任务进入终态后释放其输出预留，失败或取消不会永久占用路径。 |
| 持久通知 | terminal、`waiting_user` 和 `blocked` 都进入多消费者 Outbox；启动时可重建缺失通知或审计事件。会话交付首次扫描失败后仍以合并的周期 durable rescan 重试，停止时清理扫描与重试计时器；派发受宿主超时和 AbortSignal 约束，挂起回合不会永久占住交付队列，迟到结果不能确认 Outbox。Prompt Receipt 在启动模型前持久化 `accepted`，完成后持久化 `completed`；完成状态无法落盘时持久化 `failed`、提示用户并禁止自动重放。内部交付收据在对应 Outbox consumer 成功确认后才显式释放，并标记为普通（非 durable）收据；失败、等待用户或未知状态不会释放。会话派发、读取或确认失败会按 consumer 持久化 `retrying`、`blocked_user_retry` 或 `exhausted`，重启不会自动投递后两种状态；终态会话交付只允许用户显式执行 `retry_delivery`，该动作保留旧 Outcome/失败证据，创建新的持久 `attemptId` 并派生新的内部 requestId。派发成功后的确认重试不会再次生成回复。无法恢复原会话身份的损坏 manifest 只进入任务中心，不创建永远无法匹配的 conversation consumer。 |
| 启动维护隔离 | Outbox 修复、租约回收和过期清理分别隔离失败；维护、Orchestrator 启动和会话交付恢复也各有独立失败边界，单项异常不会跳过后续恢复步骤。过期清理在删除前重新核验 revision、终态和 Outbox，不能删除扫描后已恢复的任务。 |
| UI 与对话接管 | 后台投影聚合单元、Ledger、待装配和终态产物；未提交产物不伪造最终路径。后台面板显示真实 `question/choices`、结果摘要和阻塞原因；数字、`id`、`choiceId`、`value` 或 `label` 均映射为持久选择 ID，输出路径操作携带 `requestId`。历史会话重开后会重新注入仍待交付的任务结果；前台释放 `busy` 和旧 operation 后才排空交付队列。 |
| 回归证据 | 已新增进程恢复、来源变化、空来源回退、超时并发隔离、跨 epoch/重规划预算、Outbox 周期重扫、交付超时取消、清理竞态、运行时钉住、产物投影、会话重开、交付重试、收据顺序、启动隔离和 handoff CAS 故障注入测试；最终 `npm test` 为 `1102/1102`，`npm run quality:check` 通过，核心覆盖率为行 `93.83%`、分支 `71.07%`、函数 `92.13%`。 |

尚未完成、不得在发布说明中宣称完成：主目标文档第 9 节的 release 真实任务矩阵、完整通用 TaskContract、领域覆盖证据标准、更多语言和弱模型下的准入误判评估，以及外部副作用的统一验收策略。旧 Store 的会话交付和 `retry_delivery` 仅用于交付已经形成的历史 Outcome，不会重新执行任务。旧非终态任务必须显示为已退役/阻塞，不能进入无消费者的 queued 状态。本轮组件测试证据不等同于外部真实模型、release EXE 或安装包验收。

## 0. 架构决策

### 0.1 核心问题

复杂任务在不同模型下会产生明显不同的内容质量，这是模型能力差异的正常结果。当前系统的问题不是没有消除这种差异，而是让模型差异影响了任务生命周期：

- 局部输出截断触发切分、审校和修复循环，调用数快速膨胀。
- 模型断流、空响应或工具参数错误可能使整个任务停止。
- 后台工作结束后，原对话不一定继续接管。
- 已完成的单元可能因恢复、模型切换或最终提交失败而重复执行。
- 用户可能只看到任务数量归零，却没有得到结果、阻塞原因或继续入口。

### 0.2 最终决策

> 宿主程序负责任务事实、生命周期和最终提交；模型负责生成语义候选。
> 模型差异可以影响内容质量，但不能决定来源范围、任务状态和是否完成。

目标架构采用：

```text
TaskContract
  -> Durable Orchestrator + Task Supervisor
  -> Task Adapter + Version-pinned Skill
  -> Bounded Agent Worker
  -> UnitResult / UserInputRequest
  -> Immutable Artifact Store
  -> Deterministic Assembler
  -> Persistent Outbox
  -> 对话与后台任务中心
```

### 0.3 对“完成”的定义

系统不能保证任何任务都成功生成理想内容。损坏文件、权限不足、API 欠费和网络不可用都可能阻止成功。系统必须保证的是任务闭环：

- 能完成时，交付完整结果。
- 内容质量不足时，交付带警告结果和受影响范围。
- 只能完成一部分时，保留并交付部分产物。
- 需要用户选择或补充时，持久进入 `waiting_user`。
- 被外部条件阻止时，持久进入 `blocked` 并说明恢复条件。
- 宿主完整性或提交失败时，保留草稿、证据和恢复入口。

“永远交付”在本方案中统一改为：

> 每个任务都必须形成持久、可见、可解释、可继续的 Outcome；不能静默结束，也不能伪造成功。

### 0.4 非目标

本方案不追求：

- 让所有模型生成相同质量的内容。
- 用无限重试掩盖模型、网络或输入问题。
- 让模型自行决定任务范围、权限和最终完成状态。
- 用一个巨大的通用流程替代所有领域逻辑。
- 将所有简单对话都转成后台任务。
- 在第一阶段建立复杂的模型评分或自动学习系统。

---

## 1. 已知事实与证据边界

### 1.1 复杂任务的共同特征

本文讨论的复杂任务通常同时具备以下特征：

- 输入规模和格式不可预测。
- 包含多个有依赖关系的步骤。
- 执行时间可能超过单个对话回合。
- 模型、工具、文件系统和外部服务都可能失败。
- 需要检查点、恢复、取消和最终交付。
- 某些操作会产生不可逆或外部副作用。

### 1.2 当前源码事实

| 当前组件 | 已核实事实 | 可复用边界 |
|---|---|---|
| `document-extractors.mjs` | 提取层基本不依赖模型 | 作为文档 Adapter 的领域工具保留 |
| `document-job-store.mjs` | 固定 `kind: "document"`，绑定 sections、checkpoints 和 final draft | 复用原子写、事件日志、快照和哈希思想，不直接视为通用存储 |
| `long-task-handoff.mjs` | 绑定 `document:` 和 `get_document_job_status` | 复用终态接管、租约校验和交付验证思想，不直接视为 Worker Queue |
| `document-markdown-workflow.mjs` | 混合领域策略、模型路由、恢复、质量处理和装配 | 作为迁移来源，不能整体搬入新内核 |
| `report-workflow.mjs` | 独立报告流水线 | 后续作为第二个 Adapter 验证通用性 |
| `pdf-markdown-workflow.mjs` | 与通用文档流程存在职责重叠 | 迁移后收敛到文档 Adapter 的 PDF 实现 |
| Skill 子 Agent | 上游存在 `spawnSubagent`，但 Launcher 注册 Skill 工具时未传 `subagentRunner` | Agent loop 可借鉴，不能视为已接通的持久 Worker |
| ToolRegistry 子注册表 | 复制工具定义，但未证明继承宿主 interceptor 和审计策略 | 后台工具调用必须经过独立 Host Tool Broker |
| 输出预留与原子写 | 已有输出身份、冲突检测、草稿哈希和原子写机制 | 必须迁入新框架，不能随旧策略删除 |

### 1.3 任务记录说明了两类独立问题

本机任务记录可以证明模型调用会被审校和修复阶段放大，但不能直接作为通用模型排行榜：

- 同一次调用可能属于 draft、quality-review、quality-repair、unit-repair 或 summary。
- 不同任务运行使用了不同配置、回退链和模型角色。
- 同一模型名称可能来自不同 provider、base URL 或配置版本。
- 事件日志与个别旧 manifest 的计数存在不一致，需要先统一统计口径。

典型任务 `446fcbea` 有 114 次模型调用，其中包含大量审校与修复调用。其 63 个来源单元已处理完，最终失败原因却是输出文件冲突，而不是语义质量门。这说明必须拆开两条问题链：

1. **模型差异放大问题**：重试、递归切分和审校循环放大局部失败。
2. **宿主生命周期问题**：输出冲突、清单不一致、恢复竞争和交付中断会推翻已有工作。

后续统计必须至少按以下维度分层：

- provider、model、配置指纹。
- Task Adapter、Skill 版本和任务类型。
- 调用角色与阶段。
- 输入模态、来源规模和内容特征。
- 成功、截断、超时、协议错误、权限错误和用户取消等失败类别。

任何裸成功率或固定阈值都不能直接决定模型是否永久退出候选。

---

## 2. 系统不变量

以下不变量优先于提示词策略和模型行为，必须由宿主程序验证。

### 2.1 生命周期不变量

1. 每个接受的任务都有唯一 `taskId`、持久 manifest 和追加式事件记录。
2. 每次执行都有独立 `epochId`；旧执行不能覆盖新执行状态。
3. `running` 必须对应有效租约和最近心跳。
4. `stalled` 只能是瞬态检测结果，必须转为重试、降级、`waiting_user` 或 `blocked`。
5. 任何需要用户注意的状态和所有终态都必须写入持久 Outbox，直到前端确认展示。
6. 每个 Outbox consumer 都有独立的持久交付状态。失败只能有界重试；`blocked_user_retry` 或 `exhausted` 在重启后不得自动派发，必须保留原因和用户动作。
7. Prompt Receipt 在对应交付确认前不得释放；只有 `completed` 收据可以显式释放，释放后才回到普通 TTL/LRU 管理。用户确认 `retry_delivery` 时必须创建新的 attempt 身份，不能删除旧收据或旧失败证据。
8. 程序重启后必须回收过期租约，并从最近有效检查点恢复或形成明确阻塞。

### 2.2 来源覆盖不变量

1. Task Adapter 必须建立来源清单和稳定指纹。
2. Adapter 必须把来源拆成稳定的原子 coverage item；每个必要 item 必须出现在 Coverage Ledger 中。
3. 每个范围最终只能处于以下一种状态：
   - `completed`
   - `degraded`
   - `source_fallback`
   - `waiting_user`
   - `blocked`
   - `cancelled`
   - `unresolved`
   - `host_integrity_failed`
4. 模型不能静默跳过来源。无法整理时，优先保存可读原文或提取结果，并标记原因。
5. 全局完成由 Coverage Ledger 和 TaskContract 判定，不由模型自报。
6. `primaryCoverage` 用于覆盖结算；`contextRefs` 只用于推理。上下文可以重叠，但同一原子 coverage item 在一次装配 revision 中只能选择一个主产物。

### 2.3 产物不变量

1. 单元产物写入后不可原地修改，修复产生新 revision。
2. 每个产物记录内容哈希、来源范围、模型配置指纹、Skill hash 和生成时间。
3. 最终文件只能由 Assembler 从已验证产物装配。
4. 最终提交必须使用输出预留、冲突策略和原子替换。
5. 输出冲突不能触发内容重算；任务应转为等待用户选择新路径或确认覆盖。
6. 任务失败、暂停或等待用户时不得删除已有草稿和检查点。

### 2.4 副作用不变量

1. 每个有副作用的工具调用都需要稳定操作标识和持久 effect intent。
2. effect intent 使用 `prepared -> dispatched -> confirmed / unknown` 状态机；恢复时先判断上次副作用是否已经发生。
3. 下游支持幂等键时必须传递稳定键；下游不支持时，优先查询确认。无法确认时进入 `unknown` 并请求用户决定，或明确声明采用 at-least-once 语义，不能承诺绝不重复。
4. Worker 不直接持有任意宿主工具权限。
5. 所有后台工具调用经过 Host Tool Broker，统一执行参数校验、权限、审计和确认策略。

---

## 3. 核心数据契约

以下为逻辑契约，不要求第一阶段立即采用特定数据库或编程语言实现。

### 3.1 TaskContract

```text
TaskContract {
  schemaVersion
  taskId
  taskType
  goal
  workspace
  sources[] {
    sourceId
    uri
    kind
    fingerprint
    required
  }
  output {
    format
    requestedPath
    conflictPolicy
  }
  completion {
    requiredCoverage
    requiredArtifacts[]
  }
  quality {
    requestedFidelity
    semanticReviewMode
    maxRepairPasses
  }
  permissions
  interactionPolicy
  executionLimits {
    wallClock
    stallTimeout
    attemptLimit
  }
  pinned {
    adapterVersion
    skillHash
    toolSchemaVersion
    initialModelConfigFingerprints[]
  }
}
```

`executionLimits` 用于保证终止性和可恢复性，不以节省 token 为目标。不考虑 token 成本也不能允许无限循环或无期限占用。

以下字段是权威字段，只能由宿主程序、Task Adapter 或用户确认产生：原始用户目标、用户选择的来源、`requiredCoverage`、权限上限、输出冲突策略和系统执行上限。模型可以补充语义说明和处理建议，但不能降低覆盖要求、扩大权限、删除来源或自行改变系统上限。任何范围或权限变化都必须创建新的契约 revision，并在必要时请求用户确认。

### 3.2 UnitPlan

```text
UnitPlan {
  unitId
  primaryCoverage[]
  dependencies[]
  contextRefs[] {
    sourceId
    range
    role: context-only
  }
  requiredCapabilities[]
  outputRole
  fallbackPolicy
  planRevision
}
```

Task Adapter 负责提出初始单元和依赖图。模型可以建议合并、拆分或增加上下文，但 Orchestrator 必须验证：

- 所有来源范围仍被覆盖。
- 新单元没有越权访问。
- 依赖图无环。
- 旧产物和检查点仍可追溯。

### 3.3 UnitResult

```text
UnitResult {
  unitId
  attemptId
  proposedStatus
  artifactRefs[]
  proposedPrimaryCoverage[]
  contextRefsUsed[]
  missingSourceRanges[]
  evidenceRefs[]
  warnings[]
  confidence
  nextActionProposal
}
```

`proposedStatus` 和 `proposedPrimaryCoverage` 都是模型或 Worker 的提议。宿主只能从 Adapter 已授权的 primary coverage 中结算正式覆盖；模型声称覆盖了某范围不等于该范围已经完成。

### 3.4 UserInputRequest

```text
UserInputRequest {
  requestId
  taskId
  reason
  question
  choices[]
  existingArtifactRefs[]
  resumeToken
  expiresAt?
}
```

后台 Worker 不继承 `ask_choice` 或其他仅适合前台回合的交互工具。需要用户时必须持久生成 `UserInputRequest`，任务进入 `waiting_user`。

### 3.5 ArtifactManifest

```text
ArtifactManifest {
  artifactId
  revision
  mediaType
  path
  sha256
  primaryCoverage[]
  contextRefs[]
  producer {
    adapterVersion
    skillHash
    modelConfigFingerprint
    toolSchemaVersion
  }
  createdAt
}
```

### 3.6 OutcomeEnvelope

```text
OutcomeEnvelope {
  taskId
  outcome
  summary
  artifactRefs[]
  coverage
  warnings[]
  blockingReason?
  userAction?
  resumable
}
```

`OutcomeEnvelope` 是后台任务向对话和 UI 交付结果或请求用户介入的统一持久协议。

---

## 4. 生命周期与结果状态

### 4.1 分离三个维度

不能继续用一个 `status` 同时表达运行进度、交付结果和内容质量。

**生命周期：**

```text
created -> queued -> leased -> running
                         |-> waiting_user
                         |-> blocked
                         |-> paused
                         |-> assembling
                         |-> terminal
```

**结果：**

- `delivered`
- `delivered_with_warnings`
- `partial`
- `failed`
- `cancelled`

**质量：**

- `verified`
- `needs_review`
- `unknown`

例如，一个任务可以是：

```text
lifecycle = terminal
outcome = delivered_with_warnings
quality = needs_review
```

这不是失败，也不能继续占用“正在运行”数量。

### 4.2 合法状态转换与写入权限

所有转换都必须携带预期 revision；不在表中的转换默认拒绝。

| 当前状态 | 事件 | 下一状态 | 权威主体与守卫条件 |
|---|---|---|---|
| created | 契约验证通过 | queued | 宿主；TaskContract 权威字段完整 |
| queued | 领取任务 | leased | Orchestrator；生成未过期 lease |
| leased | Worker 启动 | running | Worker Runtime；lease、epoch 和 revision 匹配 |
| running | 有效心跳或检查点 | running | Supervisor 验证进度证据后续租 |
| running | 硬停滞或瞬态失败 | queued / blocked / waiting_user | Supervisor；先终止旧 attempt 并保存检查点 |
| running | 需要用户信息 | waiting_user | 宿主验证 UserInputRequest 合法且不可自动补全 |
| waiting_user | 用户回答 | queued | 用户；创建新 epoch，保留旧产物 |
| running | 外部依赖不可用 | blocked | Broker 或 Supervisor 提供可验证失败类别 |
| blocked | 外部条件恢复 | queued | 宿主重新探测通过或用户确认，创建新 epoch |
| queued / leased / running | 用户暂停 | paused | 用户；回收 lease，等待在途调用收敛 |
| paused | 用户继续 | queued | 用户；创建新 epoch |
| running | 来源发生变化 | waiting_user / blocked | Adapter 重新指纹确认，不混用旧来源产物 |
| running | required coverage 已结算 | assembling | Orchestrator；DAG 和 Coverage Ledger 硬门通过 |
| assembling | 输出冲突 | waiting_user | Artifact Committer；保留 final draft，不重算内容 |
| assembling | 原子提交成功 | terminal | 宿主；写 outcome 与 Outbox 原子事件 |
| assembling | 宿主完整性失败 | terminal | 宿主；outcome=failed，保留证据和恢复入口 |
| 任意非终态 | 用户取消或放弃 | terminal | 用户；outcome=cancelled，停止新副作用 |
| terminal | 用户选择重试可恢复结果 | queued | 用户；创建新 outcome revision 和 execution epoch |

`stalled`、`source_changed` 和 `unknown_effect` 是原因或检测结果，不作为可长期停留但没有动作的状态。它们必须由表中转换收敛到可恢复状态或终态。

### 4.3 阻塞与失败的区别

- `waiting_user`：程序已经提出一个用户可以回答的问题。
- `blocked`：额度、凭据、网络、权限或文件占用等外部条件未满足。
- `partial`：已有可查看产物，但 TaskContract 仍有必要范围未覆盖。
- `failed`：宿主无法保证状态或产物完整性，例如 manifest 无法恢复或原子提交失败。

`failed` 不能只包含错误字符串，必须附带已有产物、覆盖范围和恢复建议。

### 4.4 租约、epoch 与幂等

- Worker 领取任务时获得带有效期的 lease。
- 每次恢复、重试或模型切换创建新的 execution epoch。
- 所有状态写入携带预期 revision、leaseId 和 epochId。
- 迟到的旧响应可以保存为诊断证据，但不能更新正式任务状态。
- 单元执行和最终提交使用稳定幂等键，重复请求返回已有结果。

---

## 5. 组件边界

### 5.1 Durable Orchestrator

Orchestrator 不做领域语义判断，但必须做控制面决策：

- 验证 TaskContract。
- 管理任务队列、优先级和并发。
- 检查 DAG 依赖是否就绪。
- 发放和回收租约。
- 调度重试、降级、模型切换或等待用户。
- 根据 Coverage Ledger 判定是否允许装配。
- 写入终态和 Outbox。

### 5.2 Task Supervisor

Supervisor 是当前方案必须新增的组件：

- 监控 Worker 心跳、模型流和工具进度。
- 区分“模型仍在计算”和“没有任何可验证进展”。
- 软超时时只提示仍在运行，不立即重复任务。
- 硬停滞时中止当前 attempt，保留检查点并进入恢复决策。
- 进程启动时发现过期 lease，执行恢复或形成阻塞。
- 防止任务静默停止或永远保持 running。

心跳不能只更新“仍存活”，还应包含可验证进度，例如当前 unit、最后事件和新增产物引用。

### 5.3 Task Adapter

每类复杂任务仍需要有限的领域适配器。Adapter 负责：

- 枚举来源和稳定来源范围。
- 建立初始 UnitPlan、DAG 和上下文边界。
- 定义确定性完整性检查。
- 定义原文兜底策略。
- 定义最终装配方式。

文档转换、目录归档和报告生成可以共享内核，但不能假设拥有相同的来源单元和装配规则。

### 5.4 Version-pinned Skill

Skill 负责模型可理解的语义策略：

- 任务目标和内容质量要求。
- 如何分析一个有界单元。
- 如何表达不确定性和缺口。
- 何时建议拆分、降级或请求用户。

任务创建时固定 Skill 内容 hash。运行期间即使磁盘上的 Skill 更新，现有任务也继续使用原版本，恢复时不会漂移。

### 5.5 Bounded Agent Worker

Worker 每次只处理一个有界单元或一个明确的 reduce 节点：

- 获得 TaskContract 的必要子集、UnitPlan 和只读上下文。
- 通过 Host Tool Broker 使用允许的工具。
- 生成候选产物和结构化 UnitResult。
- 可以提出 replan、degrade 或 UserInputRequest。
- 不能直接修改全局来源范围、全局状态或最终文件。

“有界”用于隔离失败和支持恢复，不是为了限制模型充分分析。需要跨页、跨章节或跨文件推理时，由 Adapter 建立重叠上下文或 reduce 节点。

### 5.6 Host Tool Broker

Host Tool Broker 是 Worker 与实际工具之间的唯一通道：

- 校验参数 schema。
- 执行 workspace 和路径边界检查。
- 继承 Launcher 的安全策略、DWS 确认策略和审计规则。
- 为副作用生成幂等键。
- 记录开始、进度、结果和失败类别。
- 把交互需求转换为 UserInputRequest。

仅使用 `allowed-tools` 名称列表不足以保证后台 Worker 与前台 Agent 拥有相同的安全约束。

### 5.7 Artifact Store 与 Assembler

Artifact Store 保存不可变单元产物和证据。Assembler：

- 读取 Coverage Ledger 和 DAG 顺序。
- 拒绝 primary coverage 遗漏、主产物冲突或哈希不一致；context-only 引用允许重叠。
- 同一原子 coverage item 有多个候选产物时，按 Adapter 规则选择一个主产物，其余保留为证据或 revision。
- 按 Adapter 规则装配。
- 执行输出预留和冲突策略。
- 写入最终草稿后再原子提交。
- 输出 ArtifactManifest 和 OutcomeEnvelope。

### 5.8 Persistent Outbox

Outbox 保存尚未成功展示的用户通知：

- 任务完成。
- 带警告交付。
- 部分交付。
- 等待用户。
- 外部阻塞。
- 宿主失败。

通知不能依赖原始 SSE 流、原对话回合或当前窗口仍然打开。前端确认展示后才能标记 delivered。

任务状态转换与对应 Outbox 记录必须原子提交。初期文件存储可以把二者写成同一条权威 Event Store 事件，再由投影生成 manifest 和 Outbox；如果实现采用分步写入，启动维护必须从事件日志重建缺失通知。前端确认同样使用幂等 ack，重复投递不能产生重复对话消息。

交付状态必须按 consumer 持久化。`ready` 和 `retrying` 可以按有界退避自动继续；`blocked_user_retry` 和 `exhausted` 是稳定的用户注意状态，进程重启或重新打开会话不得把它们重置为可自动派发。通用终态任务只有在 conversation consumer 仍待确认且处于上述两种状态时，才允许用户显式执行 `retry_delivery`。该动作只创建新的交付 `attemptId`，不改变业务任务 lifecycle、Outcome、产物和覆盖账本，也不重新执行已完成的业务单元。

内部交付 Prompt Receipt 是 Outbox 之外的模型调用幂等栅栏。收据必须在交付待确认期间保持 durable；只有模型结果已经持久化为 `completed` 且对应 consumer 的 Outbox ack 成功后，才能显式释放为普通收据并重新开始 TTL。`accepted`、`failed`、未知结果或等待用户的收据不得释放。用户批准的新交付 attempt 必须派生新的内部 requestId，不能复用或删除旧 attempt 的收据。

---

## 6. 执行语义

### 6.1 任务规划

1. Intake 只从用户请求和明确的用户选择中提取语义意图；宿主程序创建 TaskContract 草案。
2. 宿主和 Adapter 根据用户选择的来源、原始目标、系统权限上限和 Adapter 规则生成权威的来源清单、required coverage、输出、权限和完成条件。
3. Adapter 枚举完整来源并生成初始 DAG。
4. 模型可以审阅计划并提出调整，但不能修改权威字段；范围或权限变化必须由宿主重新计算，必要时请求用户确认。
5. 宿主验证调整没有遗漏、越权或破坏恢复兼容性，并拒绝降低 required coverage 或系统执行上限的提议。
6. 固定 TaskContract、Adapter 版本、Skill hash 和初始配置指纹后开始执行。

### 6.2 故障隔离而非简单独立

工作单元的目标是隔离失败，不代表语义互不相关：

- 跨页表格需要共享前后页上下文。
- 章节边界可能需要重叠页。
- 报告生成需要 map 完成后的 reduce 屏障。
- 目录移动需要先完成索引和冲突检查。

DAG 明确表达这些依赖。一个单元失败时，不阻塞无依赖的其他单元；依赖它的节点进入等待、兜底或降级，而不是无限重试。Adapter 的 primary coverage 才进入装配账本，重叠上下文只记录为 context-only 引用。

### 6.3 分级失败处理

单元失败后按以下顺序处理：

1. 判断是否为瞬态传输错误，并进行有界重试。
2. 判断是否需要缩小范围或增加上下文，由模型提出、宿主验证 replan。
3. 在有满足能力要求的候选时切换模型。
4. 使用 Adapter 定义的确定性或原文兜底。
5. 无法继续时生成 UserInputRequest 或 blocked Outcome。

任何一级都必须有终止条件，不能形成 split、review、repair 的无界循环。

### 6.4 质量门分层

**硬门：确定性完整性**

- 来源覆盖。
- 产物存在与哈希匹配。
- DAG 依赖满足。
- 输出预留与冲突处理。
- 原子提交成功。

**硬门：安全与副作用**

- 权限和路径边界。
- 高风险操作确认。
- 幂等和审计。

**软门：语义质量**

- LLM 审阅。
- 结构、清晰度和内容忠实度建议。
- 用户人工复核。

语义审阅可以触发有限的针对性修复，但不能删除已有草稿、无限循环或把已覆盖的整个任务改判为无产物失败。达到上限后交付 `delivered_with_warnings`。

### 6.5 文档任务的最低交付

对于能够成功提取来源的文档：

- 模型整理成功：交付结构化结果。
- 部分模型整理失败：失败范围使用提取原文或可读的 loss-aware fallback。
- 多模态内容无法识别：保留页码、图片引用和待复核标记。
- 所有模型不可用：仍保存提取结果、来源清单和失败报告。

如果提取本身失败，则交付 blocked Outcome，明确文件、失败阶段、已尝试工具和用户可采取的操作，不能生成看似完整的虚假文档。

---

## 7. 模型能力与路由

### 7.1 三类能力证据

1. **配置声明**：JSON 中的 context、output、multimodal 等字段，只是能力 hint。
2. **轻量探测**：验证认证、基础响应和必要模态，不代表长任务一定成功。
3. **运行证据**：真实任务中的延迟、截断、协议错误和结果可用性。

路由必须综合三类证据，不能完全相信 JSON，也不能因一次探活失败永久排除模型。

### 7.2 能力匹配

每个 UnitPlan 声明所需能力，例如：

- text
- vision
- structured_output
- long_context
- tool_calling

Router 按能力选择候选，不按 `qwen`、`deepseek`、`kimi` 等名称硬编码。纯文本单元不应因为原任务包含图片就强制使用多模态模型；视觉单元不能路由给已知纯文本模型。

### 7.3 配置指纹

运行记录至少按以下指纹隔离：

- providerId
- modelId
- base URL 的非敏感摘要
- 模型参数摘要
- 能力声明
- Adapter 版本
- Skill hash
- 调用角色

模型名称相同但配置不同，不能合并评分。API key 不写入指纹明文。

### 7.4 运行表现记忆

模型表现记忆不是第一阶段阻塞项。实现时必须包含：

- 最小样本量。
- 置信区间或可信度。
- 时间衰减。
- 失败类别区分。
- 新模型探索机会。
- 用户显式选择优先级。

不得使用“历史成功率低于 20% 永久排除”这类裸阈值。某模型可能只在特定模态、阶段或旧配置下失败。

### 7.5 恢复时切换模型

恢复任务时：

- 已完成产物保持不变。
- 新 epoch 重新检查候选模型可用性。
- 可以跨 provider 切换，但必须记录配置指纹变化。
- 新模型只处理未完成或用户指定重做的单元。
- 不得因模型切换重新覆盖已验证产物。

---

## 8. 用户交互与后台体验

### 8.1 后台任务中心

后台 UI 至少分开显示：

- **正在运行**：queued、leased、running、assembling。
- **需要处理**：waiting_user、blocked、partial、delivered_with_warnings。
- **已完成**：delivered。

“正在运行 0”不代表没有需要用户处理的任务。入口应同时显示 attention count。

### 8.2 每个任务必须展示

- 原始目标。
- 当前阶段和当前单元。
- 已覆盖范围与总范围。
- 最近一次可验证进展时间。
- 当前模型和发生切换的原因。
- 已有产物。
- 警告或阻塞原因。
- 下一步可执行操作。

### 8.3 用户动作

根据状态提供有限、明确的动作：

- 预览已有结果。
- 继续。
- 回答一个待补充问题。
- 更换模型后继续。
- 重做指定单元。
- 确认后只重新交付已有 Outcome，不重新执行业务任务。
- 选择新输出路径或确认覆盖。
- 暂停、取消或放弃。

### 8.4 对话接管

后台任务形成交付结果或需要用户介入的 Outcome 后：

1. 写入 Outbox。
2. 向原对话投递结构化 background-task-result。
3. 原模型只负责向用户解释结果和提出下一步，不重新猜测任务状态。
4. 即使原对话不存在或当前切换了工作区，任务中心仍保留通知。
5. 用户重新打开原对话时补投尚未确认的 Outcome。

---

## 9. 文档转换作为首个 Task Adapter

文档转换用于验证框架，但新内核不能绑定 PDF。

### 9.1 Adapter 负责

- PDF 页、Word 段落/章节、PPT 页、Excel 表/区域和 HTML DOM 区块的来源枚举。
- 跨页、跨章节和跨表依赖。
- 文本、图片、表格和附件的能力需求。
- loss-aware fallback。
- Markdown/HTML 等目标格式装配。

### 9.2 必须保留的现有可靠性机制

- 来源指纹和 source plan。
- execution epoch。
- 单元 checkpoint。
- 最终草稿哈希。
- 输出身份和输出预留。
- 路径冲突检测。
- 原子提交。
- 已有产物预览。
- 降级范围和模型诊断。

### 9.3 不直接迁移的策略

- 递归 split 放大。
- 阻塞式 review/repair 循环。
- 按模型名称写死的路由分支。
- 任务级整包重试。
- 把 `qualityPassed: false` 与无结果失败混为一谈。

---

## 10. 渐进迁移方案

### 阶段 0：冻结契约与建立故障基线

目标：在继续改执行策略前，先定义可以自动验证的系统行为。

- 固定 TaskContract、UnitPlan、UnitResult、ArtifactManifest 和 OutcomeEnvelope v1。
- 固定生命周期、结果和质量三个维度。
- 建立事件统计脚本，统一调用数和失败分类口径。
- 为当前文档流程记录覆盖、提交和通知基线。

验收：

- 契约可序列化、升级和验证。
- 每个状态转换有合法性测试。
- 统计可以从事件日志重复生成。

### 阶段 1：通用持久任务内核

目标：先解决静默停止和不可恢复，不迁移文档语义策略。

第一步先基于现有文件存储完成一条端到端 vertical slice，再从已验证行为中抽出通用 Store 接口；不先建设脱离实际任务的完整平台。

- 建立通用 Task Store 和追加式 Event Store。
- 实现 lease、epoch、heartbeat 和 Supervisor。
- 实现 Persistent Outbox。
- 实现 Host Tool Broker、effect-intent 状态机和幂等调用记录。
- 将现有 document store 和 handoff 通过兼容层接入。

验收：

- 强杀进程后可恢复或明确阻塞。
- 无心跳任务不会永久 running。
- 终态通知不会因关闭对话而丢失。
- 终态事件与 Outbox 可以原子提交或从 Event Store 重建。
- 重复恢复不会重放已经 confirmed 的副作用；unknown effect 会要求确认而非盲目重发。

### 阶段 2：后台 Agent 与用户接管

目标：让 Worker 真正脱离父对话回合运行。

- 接入 durable worker runner。
- 移除对父 `AbortSignal` 和父回合续传的生命周期依赖。
- 后台交互统一转为 UserInputRequest。
- 对话通过 Outbox 接收结果。

验收：

- 切换对话、工作区或关闭窗口后任务状态仍正确。
- 任务完成后对话主动给出结论。
- 没有原对话时任务中心仍能完整交付。

### 阶段 3：文档 Adapter 双轨迁移

目标：以功能开关运行新旧两条路径，不大爆炸替换。

- 抽出文档来源枚举、覆盖账本和装配器。
- 将模型调用接入 Bounded Worker。
- 把语义策略迁入版本化 Skill。
- 保留旧流程作为回滚路径。
- 先迁移一种代表性文档，再扩展 Word、PPT、Excel 和 HTML。

验收：

- 强模型、弱模型和不可用模型都能形成明确 Outcome。
- 弱模型允许质量较低，但不能静默停止。
- 提取成功而模型失败时仍有可查看的最低交付。
- 输出冲突只要求处理路径，不重新执行内容生成。

### 阶段 4：第二类任务验证通用性

目标：选择报告生成或目录整理，验证内核不是文档专用。

- 为第二类任务实现 Task Adapter 和 Skill。
- 复用相同 Store、Supervisor、Broker、Artifact Store 和 Outbox。
- 不复制文档流程的领域代码。

验收：

- 通用组件无需增加第二套生命周期逻辑。
- 领域差异只出现在 Adapter、Skill 和 Validator。

### 阶段 5：模型表现记忆

目标：在事件口径稳定后，再优化路由效率和成功概率。

- 建立分层运行指标。
- 加入样本量、置信度和时间衰减。
- 支持用户固定模型和允许跨 provider 回退。
- 通过离线回放验证路由变化，不直接在线自修改关键策略。

---

## 11. 故障注入与发布门禁

### 11.1 必测故障

| 场景 | 预期结果 |
|---|---|
| 模型 SSE 中断 | 当前 attempt 失败，有界重试或回退；任务不消失 |
| 模型空响应 | 保存诊断，切换策略或形成降级结果 |
| malformed UnitResult | 宿主拒绝状态和覆盖更新，保留原始响应作为诊断 |
| 模型谎报 primary coverage | Ledger 按 Adapter 权威来源核验，不能据模型声明结算完成 |
| Intake 或模型缩小 required coverage | 权威字段校验拒绝；必要的范围变更要求用户确认 |
| 工具参数缺失 | Broker 拒绝，避免相同错误无限重复 |
| Broker 越权或路径越界 | 调用被拒绝并审计，Worker 不能绕过宿主策略 |
| 输出截断 | 当前单元 replan 或降级，不推翻其他单元 |
| 模型反复请求 replan | 达到 attempt/replan 上限后降级、等待用户或阻塞 |
| replan 产生 DAG 环 | Orchestrator 拒绝新 plan revision |
| API 欠费或认证失败 | 进入 blocked，明确 provider 和恢复条件 |
| 模型探活成功但长调用失败 | 记录运行证据，不把探活当成功保证 |
| 进程被强杀 | 过期 lease 被回收，从 checkpoint 恢复 |
| 两个 Worker 抢同一单元 | 只有持有有效 lease/epoch 的结果可以提交 |
| 迟到 epoch 响应 | 保存为诊断证据，不更新正式状态 |
| 同一任务重复恢复 | 不重复写文件；confirmed effect 不重放，unknown effect 请求确认 |
| 外部副作用成功、内部记账前崩溃 | effect 进入 unknown；查询下游、人工确认或明确 at-least-once，不盲目重发 |
| 恢复时切换模型 | 只处理未完成单元，已完成产物保持不变 |
| Skill 在运行中更新 | 当前任务继续使用固定 hash |
| 来源读取过程中变化 | 指纹校验失败并收敛到 waiting_user/blocked，不混用旧产物 |
| 输出文件中途出现 | 进入 waiting_user，不重新生成内容 |
| 原对话关闭或切换 | Outcome 保留在 Outbox 和任务中心 |
| 前端通知失败 | Outbox 重试，直到确认展示 |
| 终态提交后、通知投影前强杀 | 启动时从原子事件重建 Outbox，不能静默归零 |
| Outbox 重放或 ack 前崩溃 | 使用稳定 deliveryId，前端幂等展示和确认 |
| manifest 主文件损坏 | 从快照恢复；不能恢复则保留目录并进入 failed |

### 11.2 架构验收指标

不能再使用“调用数必须低于 60”或“任务不允许 failed”作为通用门禁。正确指标是：

- 100% 接受的任务拥有持久 manifest 和可追溯事件。
- 100% 必要来源范围在 Coverage Ledger 中有结论。
- 100% 终态形成 OutcomeEnvelope。
- 100% waiting_user/blocked 状态在 UI 中有原因和动作。
- 过期 running/lease 能在规定时间内被 Supervisor 收敛。
- 重复恢复和迟到响应不会覆盖新状态；副作用按 effect-intent 语义收敛，unknown 不会被当作未执行而盲目重放。
- 输出冲突、模型失败和语义质量不足不会删除已有产物。
- 强模型与弱模型允许输出质量不同，但生命周期测试结果一致。

内容质量另设评测集，不与生命周期门禁混为一项：

- 来源忠实度。
- 覆盖完整度。
- 表格、图片和结构保真度。
- 可读性。
- 用户接受率和局部重做率。

---

## 12. 当前代码到目标架构的迁移映射

| 当前模块 | 目标处理 |
|---|---|
| `document-job-store.mjs` | 保留文件原子写、事件、快照和哈希经验；抽出通用 Store 接口，文档字段移入 Adapter 数据 |
| `long-task-handoff.mjs` | 保留租约竞争、终态接管和交付验证经验；Outbox 通用化，文档 prompt 移入 Adapter |
| `document-markdown-workflow.mjs` | 通过 strangler 逐段拆分；先迁可靠性不变量，再迁领域策略，最后下线旧路径 |
| `document-intelligence.mjs` | 保留文档契约和提示构建中有价值部分，适配新的 TaskContract/Skill 边界 |
| `document-output-reservation.mjs` | 保留并扩展为通用 Artifact Committer 的输出预留能力 |
| `model-request-policy.mjs` | 保留通用传输和能力解析；移除按模型名称累积的文档专用策略 |
| 上游 `spawnSubagent` | 复用 Agent loop 能力，外层增加 durable runner、Supervisor 和 Broker |
| 前端后台任务面板 | 改为消费统一 Task/Outcome 协议，并分开展示 active 与 attention |

在新路径通过故障门禁前，不删除旧工作流，不一次性关闭所有审校，不把未验证的通用组件直接替换现有交付路径。

---

## 13. 实施优先级

按以下顺序推进：

1. 数据契约、状态机和系统不变量。
2. 可重复的事件统计与故障注入测试。
3. 通用 Store、Supervisor、lease、epoch 和 Outbox。
4. Host Tool Broker 和副作用幂等。
5. durable Agent Worker。
6. 文档 Adapter 双轨迁移。
7. 后台任务 UI 与对话接管。
8. 第二类复杂任务验证。
9. 模型表现记忆和路由优化。
10. 旧策略层下线。

不得把模型表现记忆、Prompt 优化或某个 provider 的特殊参数提前当成架构主线。第一目标始终是：

> 不论模型强弱或外部服务状态，任务都必须收敛为用户可见、可解释、可继续的 Outcome。

---

## 14. 决策检查清单

开始编码前必须确认：

- [ ] TaskContract 和完成判据已经明确。
- [ ] 原始目标、来源、required coverage、权限和系统上限由宿主/Adapter 管理，模型不能降低。
- [ ] 来源范围能够被 Adapter 穷举并建立指纹。
- [ ] primary coverage 与 context-only 引用已经分离。
- [ ] 每个单元失败都有确定的降级或阻塞路径。
- [ ] 模型不能直接改变全局状态和最终文件。
- [ ] Worker 工具全部经过 Host Tool Broker。
- [ ] 外部副作用使用 effect-intent 状态机，并定义 unknown 的处理方式。
- [ ] 运行时 Skill、工具 schema 和模型配置均可追溯。
- [ ] 任务重启、重复恢复和迟到响应不会重放 confirmed effect，也不会把 unknown effect 当作未执行。
- [ ] 状态转换与 Outbox 原子提交，或可以从权威事件重建。
- [ ] UI 能区分正在运行和需要用户处理。
- [ ] 故障注入测试覆盖本次新增状态转换。

这份清单全部满足后，才进入对应阶段的源码实现。
