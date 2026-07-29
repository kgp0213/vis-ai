# Visionox-Whale 架构评审报告（对照 kimi-code 上游）

- 评审日期：2026-07-28
- 参照系：`D:\kimi-code`（Moonshot AI monorepo，`packages/agent-core` / `agent-core-v2`）
- 评审对象：`src-tauri/resources/server/launcher.mjs`、`lib/*.mjs`（自研层）、`visionox-pkg/dist`（上游衍生 bundle）
- 方法：静态走查 + 上游契约对照 + 现有测试佐证。未改动任何代码，未触发真实模型调用与真实 DWS 发送。

---

## 1. 上游 agent-core 值得借鉴的核心契约

来自 `packages/agent-core/src/loop/README.md` 与 `retry.ts`、`tool-scheduler.ts`：

1. **无状态循环**：loop 不持有会话/传输/压缩/权限 UI，全部归宿主层。
2. **中断安全点**：run-turn 负责收敛；provider abort 时 step 封套可以只有 `step.begin` 没有 `step.end`（刻意为之）。
3. **事件配对不变量**：每个已派发的 `tool.call` 必须有对应 `tool.result`，除非 step 在派发前被中断。
4. **用量记账时机**：`LLM.chat` 返回立即记账；即使工具执行被 abort，已花费的 LLM 用量也必须上报。
5. **监听器故障容纳**：live 监听者抛错不得影响循环。
6. **重试预算**：默认 10 次尝试，0.5s 起步指数退避、32s 封顶、25% 抖动，总预算约 2–3 分钟，专门扛持续 429。
7. **资源冲突感知的工具调度**：无冲突任务并行，冲突任务按 provider 顺序串行。
8. **压缩策略分层**：micro / full / handoff 三种压缩。

## 2. 本项目已经做对的（抽样确认，非走过场）

| 上游契约 / 自研要求 | 本项目证据 | 结论 |
|---|---|---|
| 终态幂等、迟到回调不得覆盖终态 | `lib/operation-context.mjs:257-264`（终态集合守卫）+ 唯一生产调用点 `lib/operation-runtime.mjs:132-141`（state 白名单校验 + abort 信号兜底） | ✅ |
| 取消必须撤销授权 | `lib/operation-runtime.mjs:114-127`（stop 先 revoke 再 abort）；`operation-context.mjs:238-248`（stopping 即清 sendAuthorization） | ✅ |
| 监听器故障容纳 | `lib/dashboard-event-stream.mjs:67,110`（订阅者异常吞没注释明确） | ✅ |
| SSE 断线重放/重同步 | `lib/dashboard-event-stream.mjs:72-133`（epoch 游标、cursor-too-old/epoch-changed → resync-required、重放屏障防重入乱序） | ✅ 设计正确 |
| 崩溃恢复不重演副作用 | `lib/active-session.mjs:84-165`（中断工具调用关闭为显式 unknown 结果） | ✅ 与上游契约一致 |
| 排队/引导（steer）有序注入 | `launcher.mjs:5230-5301`（model boundary fence：可验证顺序、溢出阻断、回滚 requeue、异常记录） | ✅ 工程水平高 |
| 相同失败熔断 | `launcher.mjs:1969-1974` + `operation-context.mjs:191-212`（按 工具名+参数指纹 阻断，成功恢复清零，事件重放去重） | ✅ |
| 工作区切换 | 全量测试含 "switches workspace in a fixed order and reloads all workspace-bound tools" | ✅ 有回归锁定 |
| bundle 重试细节 | `visionox-pkg/dist/index.js:11-62`（Retry-After 遵守、配额耗尽不重试、重试前排空响应体、abort 感知 sleep、抖动） | ✅ 细节到位 |

## 3. 发现的缺陷与风险（按严重度排序）

### F1【中高】解密明文临时文件没有任何自动回收

- **证据**：
  - 明文落盘位置：`%TEMP%\visionox_decrypted\<时间戳会话目录>\`（`visionox-file/visionox_file.py:32,280`；`lib/dlp-file.mjs:967`）。
  - 绑定注册表 `clear()` 只清内存 Map，**不删磁盘文件**（`lib/dlp-file.mjs:185-189`）；会话切换/工作区切换调用的就是这个 clear（`launcher.mjs:3828,8533,10486`）。
  - Python 组件有 `--clean` 可整目录清理（`visionox_file.py:321-324`），但 **Node 侧从未调用**（全仓 grep 无调用点），只能靠模型自己决定执行——而 SKILL.md 又要求模型不要主动提这套机制，实际上几乎不会被执行。
  - `decryptCache`（`dlp-file.mjs:970`）同样只在内存，进程重启后缓存失效但文件仍在。
- **影响**：公司内部加密/涉密文档被解密成明文后**永久残留**在系统临时目录（Windows 不会自动清 TEMP），跨会话、跨重启累积。这正好踩在 AGENTS.md §7 的边界上——"保留到安全回收点"目前只有遗忘，没有回收。
- **触发场景**：任何一次加密文档阅读后切换会话/工作区/重启应用。
- **次要瑕疵**：会话目录用秒级时间戳（`%Y%m%d_%H%M%S`），同一秒内两次准备会撞进同一目录。
- **建议**（短期）：
  1. `preparedDocumentRegistry.clear()` 时按条目删除对应明文文件（仅删除 tempRoot 内、路径已 resolve 校验的文件）；
  2. 启动时清理 tempRoot 中超过 N 天（如 7 天）的会话目录；
  3. 进程退出钩子兜底清理本进程产生的目录；
  4. 会话目录名加随机后缀防秒级碰撞。
  注意 AGENTS.md §7 的红线：**不得在单次工具调用结束后就删**，回收点应挂在 operation 终态 / 会话切换 / TTL 上。

### F2【中低】模型请求重试预算明显小于上游，持续过载时过早报错

- **证据**：bundle `fetchWithRetry` 默认 4 次尝试、退避封顶 10s（`visionox-pkg/dist/index.js:12-14`），总预算约 30 秒；上游 agent-core 是 10 次、32s 封顶、约 2–3 分钟（`agent-core/src/loop/retry.ts:13-22`）。
- **影响**：公司内部网关（10.71.4.202:10307）若出现分钟级 429/503 窗口，用户会看到任务失败，而上游设计本意是"扛过去"。当前失败后有熔断与重试提示兜底，所以不是硬伤。
- **建议**（短期）：借鉴上游把预算提到 8–10 次、封顶 30s；该文件属 bundle，修改需登记 `scripts/check-bundle-patches.js`。

### F3【低】`refreshScope` 会重写运行中 operation 的会话/工作区快照

- **证据**：`lib/operation-runtime.mjs:149-154` 直接改写 `context.conversationId/workspace`；三个调用点（`launcher.mjs:10499` 命名会话恢复、`10757` `/new`、`10835` 定时任务新对话）。
- **评估**：三处都是受控重绑定流程（有 `bindOperationSessionRun(replace)` 守卫/先复位会话），大概率是刻意设计。但 AGENTS.md §2 要求"工作区快照不得被静默改写"，这里的语义是"显式改写"，需要保证改写前旧 scope 的工具已全部终止——目前依赖各调用点自觉，没有统一守卫。
- **建议**（短期）：在 `refreshScope` 内断言 operation 无在途工具调用（或改为返回 deferred 状态由调用方确认），并补一条回归测试。

### F4【极低】`closeOperationContext` 不校验目标 state 合法性

- **证据**：`lib/operation-context.mjs:257` 形参 state 无白名单。当前唯一生产调用点已校验（F2 表内），属于纵深防御缺口而非现存 bug。
- **建议**：函数内加一行白名单守卫，成本极低。

### F5【提示】SSE 暂态事件不可重放是设计内取舍

- `dashboard-event-stream.mjs:4-12` 把 assistant_delta 等列为暂态不重放。断线期间的增量丢失依赖 canonical resync 兜底（已有 `dashboard-event-reducer` 测试锁定）。**不是 bug**，但意味着任何新的"关键但必须实时"的事件类型若误放入 TRANSIENT_KINDS，断线后会永久丢失——新增事件类型时应在评审清单里过一遍。

## 4. 场景化检查结论（你关心的"不同任务/业务场景"）

| 场景 | 结论 |
|---|---|
| 忙碌中排队消息 + 引导插入 | ✅ 边界栅栏保证有序注入，溢出会回滚重排队（F 表外加分项） |
| 任务执行中切换会话/工作区 | ✅ operation 先停或 unknown，绑定失效；但明文文件残留（F1） |
| 进程崩溃/强杀后恢复 | ✅ 中断工具调用补 unknown 结果，不会重演副作用 |
| 模型持续 429/网关过载 | ⚠️ 能扛 30 秒级，分钟级会失败（F2） |
| 同一工具反复失败 | ✅ 熔断阻止第三次，恢复后清零 |
| 授权（DWS 发送等）范围 | ✅ 取消即撤销；定时任务结构化授权独立 |
| 阅读加密文档 | ⚠️ 功能正确，明文残留无回收（F1） |
| SSE 断线重连 | ✅ 游标 + resync；暂态事件取舍已知（F5） |

## 5. 改进方向（借鉴，不照搬）

**短期（本周可做，风险低）**
1. F1 明文回收链：clear 删文件 + 启动 TTL 清扫 + 退出兜底 + 目录名随机化。
2. F2 重试预算对齐上游（登记 bundle 补丁标记）。
3. F3/F4 两个小守卫 + 回归测试。

**中期（下次大版本）**
4. 权限审批借鉴上游 `agent/permission`（matches-rule + policies）：把 shell-side-effect-policy / permission-rule-runtime 的规则匹配统一成"规则表 + 策略"两层，便于公司内按业务线配置。
5. 上下文压缩借鉴上游 micro/full/handoff 分层：当前折叠阈值已有（statusbar 的压缩刻度线），可评估 micro 压缩减少长会话质量损失。
6. 工具调度借鉴"资源冲突感知并行"：当前工具以串行为主，读类工具可安全并行，能明显缩短多文件审计类任务的墙钟时间。

## 6. 诚实的覆盖边界

- `launcher.mjs`（12,529 行）与 `lib/`（16,000+ 行）未逐行通读；本报告基于约 15 个高风险模块的定向深读 + 全量测试（1083）与 quality:check 全绿作为基线佐证。
- `visionox-pkg/dist` 是上游构建产物，循环内部依赖上游继承的正确性；"abort 时已花用量必须记账"这一条在 bundle 内未能完全验证，建议补一条专项回归测试。
- 未做动态模型行为测试（不触发真实模型调用是本次的既定边界）。

---

## 附：2026-07-28 后续核验与修复

对一份外部"6 项可靠性问题"清单逐项核验：5 项为误报（SSE 重放乱序、`--api-key secret` 脱敏、工具帧 ID 拼接、脱敏游标跳读、通知队列上限——源码均已有正确实现与测试锁定）。

唯一属实的"崩溃恢复 lost 任务通知无法投递给模型"已修复：
- 根因：通知领取过滤器将投递绑定在 `sourceOperationId` 上，崩溃恢复的通知绑的是死 operation，永远无法被新 operation 领取。
- 修复：新增 `notificationEnqueueScope`/`isProcessRestartedRecovery`（`lib/background-task-notification.mjs`），崩溃恢复的 lost 通知在模型边界恢复点改挂到 live operation；启动恢复点跳过此类记录避免去重污染（`launcher.mjs` 两处）。
- 测试：`lib/background-task-notification.test.mjs` 新增端到端用例；`__tests__/background-task-dashboard.test.mjs` 新增 launcher 接线锚点。全量 1083+ 测试通过。
