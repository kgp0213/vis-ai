# Visionox Agent 系统审计报告（源码复核版）

**审计范围**：将 Visionox 当作完整 Agent 系统进行端到端审计，覆盖用户输入→会话隔离→任务识别→模型规划→工具调用→失败恢复→产物验证→最终回执→Transcript/SSE→Dashboard 展示全链路。

**对比基准**：Kimi Code (`D:\kimi-code`) 的 transcript apply.ts、transcriptService.ts、sessionEventBroadcaster.ts。

**审计时间**：2026-07-29（复核修订版）

**实施状态**：本报告保留修复前的调用链证据。复核后已将崩溃中的 Steering 收敛为 `not_applied`、dispatching 队列输入收敛为 `unknown`，不再经 `ctx.submitPrompt` 自动重放；同时补齐 Transcript Operation Reducer、冷恢复规则、共享 schema 样例和旧 epoch 缓冲丢弃。`npm run quality:check` 已通过。

---

## 一、总体判断

Visionox 的总体方向是正确的：

- **仍然只有一个普通模型工具循环**，没有形成第二套 Agent Loop。
- **Operation/Session/Workspace 隔离已显著加强**：`operation-runtime.mjs` 使用不可变 scope 快照（line 96），session/workspace 切换时强制 stop 而非重标记（line 176-180）。
- **事件 Reducer 具备重复事件、终态保护和序号缺口检测**：`execution-reducer.mjs` 有 `seenEventIds` 去重、`terminalStateTransition` 拒绝迟到终态、`event-gap` 异常标记。
- **模型上下文与 UI Transcript 分离方向正确**：`execution-transcript.mjs` 是只读投影模型（line 162-163 注释明确声明），不调度或调用模型。

---

## 二、复核修正记录

### 修正 1：Steering 重复注入风险比初版评估更严重

初版认为 `hasInputInModelHistory` 检查在投放路径中提供了缓解。源码复核发现：

**`hasInputInModelHistory` 检查仅存在于 `beforeModelRequest` → `projectBoundaryDeliveries` → `delivery.type === "steer"` 路径**（launcher.mjs:5374-5391）。但崩溃恢复后的 steer 输入走的是**完全不同的代码路径**：

- 恢复后 `delivery` 从 `"steer"` 强制改为 `"queue"`（admission.mjs:199）
- 恢复后的输入由 `promoteNextQueue`（launcher.mjs:8510）拾取
- 通过 `scheduleQueuedSessionInputDrain` → `ctx.submitPrompt`（launcher.mjs:8538-8544）投放
- **`ctx.submitPrompt` 路径没有任何 `hasInputInModelHistory` 检查**

同时，`delivery.type === "steering"` 在 `projectBoundaryDeliveries` 中映射的是 `operationSteeringRuntime`（launcher.mjs:5329），这是**一个独立系统**（operation 级别的 steering 指令），与 `sessionInputAdmission` 无关。`operationSteeringRuntime` 的恢复逻辑不同：`queued` 状态被恢复为 `not_applied`（launcher.mjs:8847-8861），不会重新注入。

### 修正 2：Todos/Prompts/Background-task-notifications 持久化已确认

初版认为 todos、prompts 和 background-task-notifications 只通过 dashboard 事件流传递、重启后可能丢失。源码复核发现：

- **Todos**：`activeTodos` 全局变量通过 `writeActiveSessionMeta({ todos: activeTodos })` 持久化（launcher.mjs:456），启动时通过 `restoreActiveTodos(meta.todos)` 恢复（launcher.mjs:8778）
- **Prompts/Steering**：`activePromptEntities` 通过 `writeActiveSessionMeta({ prompts: activePromptEntities })` 持久化（launcher.mjs:439），启动时通过 `restoreActivePromptEntities(meta.prompts)` 恢复（launcher.mjs:8780）
- **Background-task-notifications**：通过 `taskOutputStore.listPendingNotifications()` 持久化读取（launcher.mjs:2104），通过 `restorePendingBackgroundTaskNotifications` 恢复到内存队列（launcher.mjs:2102-2119）
- `projectExecutionTranscript` 的外部参数来自 `meta.todos` 和 `meta.prompts`（launcher.mjs:8961-8962），后者从持久化的 session metadata 读取

这些实体**不会在重启后丢失**。`todo-update` / `prompt-update` 事件只是 Dashboard 广播机制，不是持久化机制。

---

## 三、已确认的风险与缺陷（复核修订版）

### 风险 1：Steering 崩溃恢复 — 恢复路径缺少历史去重，语义降级

**严重度**：中高（初版为"中"，复核后升级）

**涉及代码路径**：

```
正常投放路径（有 hasInputInModelHistory 检查）：
  promoteSteers → beforeModelRequest → projectBoundaryDeliveries → delivery.type="steer"
  → hasInputInModelHistory 检查 (launcher.mjs:5381)
  → loop.appendAndPersist (launcher.mjs:5410)

恢复投放路径（无 hasInputInModelHistory 检查）：
  recoverInterruptedEntries → delivery="queue", status=ACTIVE_STATUS
  → promoteNextQueue (launcher.mjs:8510)
  → scheduleQueuedSessionInputDrain → ctx.submitPrompt (launcher.mjs:8538)
  → 无 hasInputInModelHistory 检查
```

**风险链路**：

1. 用户提交 steer 输入 → `sessionInputAdmission.admit` with `delivery: "steer"`
2. `promoteSteers` 提升为 `status: "promoted"` → `beforeModelRequest` → `projectBoundaryDeliveries` → `delivery.type: "steer"`
3. `hasInputInModelHistory` 检查通过（不在历史中）→ `loop.appendAndPersist` 将 steering 写入模型历史（launcher.mjs:5410）
4. 进程在 `resolve("dispatched")` 持久化完成前崩溃
5. 重启后 `recoverInterruptedEntries` 将其重置为 `delivery: "queue"` + `status: ACTIVE_STATUS`
6. 新操作完成后 `scheduleQueuedSessionInputDrain` 拾取 → `promoteNextQueue` → `ctx.submitPrompt`
7. **`ctx.submitPrompt` 没有 `hasInputInModelHistory` 检查 → 同一指令以"用户排队消息"身份再次注入模型上下文**

**双重问题**：

| 问题 | 说明 |
|------|------|
| 重复注入 | 同一 steer 指令已存在于模型历史中，但恢复后通过 `ctx.submitPrompt` 再次注入，无去重 |
| 语义降级 | 原始 delivery=`"steer"` 被强制改为 `"queue"`：steering 指令本应在当前 turn 的 steering 上下文中注入，恢复后变成下一个 turn 的排队用户输入 |

**operationSteeringRuntime 的对比**：同一系统中 `operationSteeringRuntime` 的恢复逻辑是安全的——`queued` 状态恢复为 `not_applied`（launcher.mjs:8847-8849），不重新注入。但 `sessionInputAdmission` 的恢复逻辑反而将条目放回投放队列。

**改进方向**：

1. **在 `scheduleQueuedSessionInputDrain` 中增加 `hasInputInModelHistory` 检查**（launcher.mjs:8538 前），与 `beforeModelRequest` 路径保持一致
2. **在 `recoverInterruptedEntries()` 中直接检查模型历史**：恢复时若输入已存在于模型历史，立即标记为 `"dispatched"` + `"model_history_already_contains_input"`，而非重置为 `ACTIVE_STATUS`
3. **保留原始 `delivery` 字段**：恢复时不强制改为 `"queue"`，改为在投放时根据历史检查结果决定是否跳过或以原始语义投放

---

### 风险 2：Dashboard 滚动反馈环 — 双重触发与 reflow 过载（确认）

**严重度**：中

**代码位置**：
- `chat.ts:3485-3503`（两个 y2 effect：messages 变化触发 + MutationObserver）
- `chat.ts:1665-1689`（`pinFeedToBottom` 实现）
- `chat.ts:3391-3429`（`onScroll` 处理器）

**复核确认**：

流式输出期间，**每个 token 触发两次 `pinFeedToBottom`**：
1. React effect #1（chat.ts:3485-3492）：`streaming.text` 变化 → 触发
2. MutationObserver（chat.ts:3494-3503）：DOM `characterData` 变化 → 触发

每次 `pinFeedToBottom` 的执行流程：
```
sync: el.scrollTop = el.scrollHeight      // forced reflow #1
rAF:  el.scrollTop = el.scrollHeight      // forced reflow #2 (下一帧)
```

两次调用竞争同一个 `autoScrollTokenRef`：
- 第 1 次：token=N+1, 同步 reflow → schedule rAF
- 第 2 次：token=N+2, cancel 前次 rAF, 同步 reflow → schedule 新 rAF
- rAF 执行时：再 1 次同步 reflow

**每个 token 约 3 次 forced reflow**（2 次来自双调用的同步设置 + 1 次来自最终 rAF 设置）。

20-50 tokens/sec 流式输出 → **60-150 forced reflows/sec**。长对话中（数百条消息、大量 DOM 节点），每次 reflow 需遍历整个布局树，性能退化明显。

**已有保护确认**：
- `shouldAutoScroll` 守卫（用户滚动后关闭）
- `autoScrollInFlight` 防止 onScroll 反弹
- `userScrollIntentActive` grace period 防止滚轮死锁
- `lastScrollUpIntentAtRef` 记录用户上滚意图

这些保护正确，但缺少**MutationObserver 去抖**和**滚动状态机**。

**改进方向**：见初版报告（不变）。

---

### 风险 3：Transcript append 语义 — 不支持部分重叠恢复（确认，表述修正）

**严重度**：中低

**代码位置**：
- 服务端：`execution-reducer.mjs:68-95`（`appendDelta`）
- 客户端：`event-reducer.ts:625-677`（`assistant_delta` handler）
- 对比：`apply.ts:379-399`（`appendAtOffset`）

**复核确认与修正**：

Visionox 的 `appendDelta` **拒绝任何 `effectiveOffset < currentOffset` 的 delta**（line 89: `return { changed: false }`），而非 Kimi Code 的"检查重叠内容一致性后 trim"。这意味着：

| 场景 | Visionox 行为 | Kimi Code 行为 |
|------|---------------|---------------|
| offset === currentLength | 追加（正常） | 追加（正常） |
| offset < currentLength | **直接丢弃**（line 89） | 检查重叠内容→一致则 trim 后追加，不一致则 gap |
| offset > currentLength | gap → resyncRequired（line 90） | gap → 返回 `{ gap }` |

Visionox 的策略更保守但不灵活：**任何部分重叠都被当作过期数据丢弃，从不 trim**。这导致恢复场景中无法通过"重叠验证 + trim"实现渐进式恢复，只能全量 resync。

客户端 `event-reducer.ts` 的 `check` 函数（line 651-660）更精细：返回 `"ok" | "duplicate" | "gap"` 三态，但同样不支持部分重叠 trim（`supplied < expected → "duplicate"` → 整条丢弃）。

**改进方向**：在 `appendDelta` 中增加 Kimi Code 的重叠内容一致性检查和 trim 逻辑（初版建议不变）。

---

### 风险 4：事件 Ring 缺少磁盘 Journal（确认，但持久化实体不丢失）

**严重度**：中低（初版为"中"，复核后降级）

**代码位置**：`dashboard-event-stream.mjs:31-152`

**复核修正**：

初版声称 todos/prompts/background-task-notifications 可能在重启后丢失——**这是错误的**。这些实体都有独立的持久化路径（`writeActiveSessionMeta` / `taskOutputStore`），不会在重启后丢失。

事件 Ring 缺少磁盘 journal 的实际影响是：

- **SSE 补发效率降低**：内存 Ring 溢出（`cursor-too-old`）或进程重启（`epoch-changed`）→ 强制全量 snapshot resync，而非渐进式事件补发
- **不影响数据完整性**：所有持久化实体的 canonical snapshot 包含完整数据

与 Kimi Code 的三层设计（内存 tail → 磁盘 journal → 全量 snapshot）相比，Visionox 缺少中间层，但**数据完整性不受影响**。

**改进方向**：为 SSE 补发效率增加可选磁盘 journal 层（优先级降低，从优先级 2 移到优先级 3）。

---

### 风险 5：Launcher 编排职责过重（确认）

**严重度**：中低

复核发现新的证据：

- `hasInputInModelHistory` 检查在 launcher.mjs:5381（`beforeModelRequest` 路径），但 `scheduleQueuedSessionInputDrain`（launcher.mjs:8538）缺少同一检查
- `recoverInterruptedEntries`（admission.mjs:193）和 `scheduleQueuedSessionInputDrain`（launcher.mjs:8509）在两个不同文件中，恢复→投放的完整链路没有端到端契约测试
- `delivery` 字段在恢复时被强制改变（admission.mjs:199），但投放路径的映射逻辑（`projectBoundaryDeliveries` vs `ctx.submitPrompt`）没有文档化

---

## 四、事实来源表（复核确认版）

| 状态字段 | 持久化来源 | 读取路径 | 恢复路径 |
|---------|-----------|---------|---------|
| Operation state | 纯运行时（不持久化） | `operationRuntime.getActive()` | 不恢复（正确行为） |
| Input admission | `meta.promptInputs` → `sessionInputAdmission.restore()` | `sessionInputAdmission.list()` | `recoverInterruptedEntries()` → `delivery="queue"` |
| Operation steering | `meta.prompts` → `operationSteeringRuntime.restore()` | `operationSteeringRuntime.list()` | `queued` → `not_applied`（安全） |
| Todos | `writeActiveSessionMeta({ todos })` | `activeTodos` 全局变量 | `restoreActiveTodos(meta.todos)` |
| Prompts | `writeActiveSessionMeta({ prompts })` | `activePromptEntities` 全局变量 | `restoreActivePromptEntities(meta.prompts)` |
| Background task notifications | `taskOutputStore` | `backgroundTaskNotifications.claim()` | `restorePendingBackgroundTaskNotifications()` |
| Session entries (JSONL) | 文件持久化 | `parseActiveSessionJsonl` | 文件读取 |
| Dashboard events (SSE) | 纯内存 Ring | `dashboard-event-stream.replay()` | 新 epoch → 全量 resync |

---

## 五、建议的下一步（复核修订版）

### 优先级 1：专项验证（不改代码）

1. **Steering 重复注入端到端测试**：
   - 构造 steer 输入 → promote → 写入模型历史 → 模拟崩溃（不调用 resolve）→ 重启恢复
   - 验证恢复后是否通过 `scheduleQueuedSessionInputDrain` → `ctx.submitPrompt` 被重复注入
   - **重点验证 `ctx.submitPrompt` 路径是否缺少 `hasInputInModelHistory` 检查**

2. **Dashboard 滚动浏览器测试**：长对话 + 高频流式 + 图片 + 工具卡片 + 用户上滚

### 优先级 2：对照补齐（独立模块，高优先级）

3. **在 `scheduleQueuedSessionInputDrain` 中增加 `hasInputInModelHistory` 检查**（launcher.mjs:8538 前）
4. **在 `recoverInterruptedEntries()` 中增加模型历史检查**：若已存在于历史中，直接标记 `"dispatched"` 而非重置为 `ACTIVE_STATUS`
5. **在 `appendDelta` 中增加重叠内容一致性检查与 trim**（参考 Kimi Code `appendAtOffset`）

### 优先级 3：架构演进（确认缺口后）

6. **为 SSE 补发效率增加可选磁盘 journal 层**
7. **建立恢复链路契约测试**：`recoverInterruptedEntries` → `promoteNextQueue` → `scheduleQueuedSessionInputDrain` → `ctx.submitPrompt`
8. **考虑 post-turn heal 机制**

---

## 六、工作区状态声明

初次复核阶段为只读分析；后续实施已基于当前工作区完成上述可靠性修复，并保留原有普通模型工具循环作为唯一执行内核。未引入磁盘事件 Journal、第二套模型循环、领域专用后台流程或真实外部发送。

## 七、六项能力续接复核（2026-07-29）

本节是对前文风险记录的当前状态校正：

- Steering 崩溃窗口已按恢复边界收敛：`session-input-admission.recoverInterruptedEntries()` 对原始 `steer` 标记 `not_applied`，已经开始派发的输入标记 `unknown`；正常投放路径和历史边界均使用 `admittedInputId` 去重，不自动重放不确定输入。
- 普通文件问答的目标契约已采用轻量策略；当前测试覆盖“文件名词不单独触发执行任务”。等价路径的产物匹配也已规范化，前文 A2/A3 只保留为历史发现。
- Transcript 的 `Task` 已成为全局实体，专用实体操作不再落入 `entity_type_unknown`；Task 输出与文本 Frame 共用部分重叠、重复和 gap 处理。
- Snapshot 不再只是 Dashboard 事件的附带结果：服务端构建和 Dashboard 消费两侧都校验 Schema、集合结构和嵌套执行状态；未来 Runtime Fact 版本 fail closed。
- SSE 事件对过旧、超前、epoch 变化和同序不同 ID 分别触发 canonical resync；快照加载期仍缓存后续事件并按游标重放。

当前残余架构取舍仍是：事件 Ring 没有 Kimi Code 的磁盘 Journal，只影响补发效率而不影响 JSONL/Runtime Fact canonical snapshot 的完整性；Launcher 仍是大型兼容装配层，后续可在契约稳定后继续按 Transcript、事件和恢复边界拆包。未执行真实模型外部网络任务、DWS 发送、NSIS 或 release 构建。
