# 过程信息统一容器 — ProcessCard 落地

日期：2026-07-27 · 范围：把对话框里"任务过程"信息（工具调用 / 深度思考）统一进同一种容器语言

## 背景与设计原则

用户提供 WorkBuddy 同一任务不同阶段的截图（任务列表 + 工具卡片），指出其本质是**过程信息的生命周期管理**。提炼 4 条原则作为本次设计依据：

1. **单一焦点** — 任一时刻只有"当前步"高亮，其余弱化。
2. **热度衰减** — 细节量随与"此刻"的距离递减：当前步展开细节，已完成步一行，整组完成后收敛成计数。
3. **让位而非消失** — 正文出现时过程主动收敛成一行，但保留可展开的审计能力。
4. **异常粘性** — 失败的步骤/组永不自动收敛，必须保持可见。

我们的缺口：reasoning（`reasoning-live-tail`）/ 计划（右侧栏 step-dot）/ 工具（ToolDock）三套过程信息三种割裂样式。

## 方案：抽取 ProcessCard 共享原语

新增 `src/ui/process-card.ts`，把"过程容器"抽成统一原语：

```
┌─ process-card（浅灰底块 + 圆角边框，与正文分层）─┐
│ ▶ [图标] 标题 · 计数/状态              [chevron] │  ← 标题行（可折叠）
│ ─────────────────────────────────────────────  │
│ ✓ read_file   a.ts                （done，弱化） │
│ ✓ edit_file   b.ts                               │
│ ❀ run_command npm run build       （active 高亮）│
│   ⎿ 输出尾部 2-3 行（就地展开"酌情细节"）         │
└────────────────────────────────────────────────┘
```

- **状态行**（`ProcessRow`）：`{ id, status: pending/active/done/failed, label, target?, detail? }` 数据驱动，本原语统一渲染。
- **三态卡片**：`running`（当前步高亮+展开细节）/ `settled`（收敛成一行，可展开审计）/ `failed`（失败粘性保持展开）。
- **状态图标**：复用 `icons.ts` 新增 `IconCheck/IconX/IconDot/IconChevron/IconTool`（currentColor 线性 SVG，9 主题自适应）。

## 迁移与落地

**1. ToolDock → ProcessCard（chat-internals.ts `ToolGroup`）**
- 滚动字幕纯文本 → 升级为**状态行列表**：每步一行（状态图标 + 名称 + target），当前步下方缩进子区显示输出尾部 3 行（`TOOL_ROW_DETAIL_TAIL_LINES`）。
- `toolRowsFromItems()` 把工具消息映射为 `ProcessRow`；`toolRowStatus()` 映射四态。

**2. 事件驱动收敛（替代固定 2.6s 定时器）**
- 收敛时机：`taskActive` 翻 false **且** 下一条 assistant 正文已出现（`followedByAnswer`，chat.ts 在 renderUnits 循环计算）→ 过程让位正文。
- 兜底：正文迟迟不来时 8s 最大延迟强制收敛（`TOOL_SETTLE_FALLBACK_MS`）。
- **失败粘性**：组内有失败步则永不自动收敛。

**3. reasoning → ProcessCard 壳（chat-internals.ts `ChatMessage`）**
- 深度思考的 live（流式）与 details（完成后）两种形态统一包进 `.process-card` 容器，与工具卡视觉一致；保留 `reasoning-live-tail` 流式钉底行为。

## 变更文件
- `src/ui/process-card.ts`（新增）— ProcessCard 原语 + ProcessRow 类型。
- `src/ui/icons.ts` — 新增 IconCheck/IconX/IconDot/IconChevron/IconTool。
- `src/ui/index.ts` — 出口新增 ProcessCard + 5 图标。
- `src/components/chat-internals.ts` — ToolGroup 重写（状态行 + 事件收敛 + 失败粘性）；reasoning 包进 ProcessCard；导入 ui 原语。
- `src/panels/chat.ts` — renderUnits 循环计算 `followedByAnswer` 传入 ToolGroup；`setAllToolGroupsOpen` 选择器加 `details.process-card-details` 兼容。
- `src/app.css` — 新增 ProcessCard 样式区（`.process-card`/`.process-row-*`/`.process-card-reasoning` + `processCardIn` keyframes + reduced-motion）。**全走 design tokens，零硬编码 hex，9 主题自适应。**

## i18n
零增量。复用现有 key：`toolUsingLiveStep` / `toolUsedCount` / `toolFailedCountSuffix` / `reasoningProcess` / `reasoningThinking` / `reasoningTurnLive` / `reasoningTurnsPrefix` / `reasoningChars`。

## 验证
```
npm run dashboard:build               → exit 0
node scripts/check-dashboard-build.js → [dashboard-build] verified be1c7ba9fa61 b69dfaa06f57
```
- 生成物 `dist/app.js` 含 process-card/ProcessCard/followedByAnswer/toolRowsFromItems（30 处命中）。
- 生成物 `app.css` 含 process-card/process-row（38 处命中），新增块 grep 校验**零硬编码颜色**。
- i18n 复用 key 5 处确认存在。
- 兼容性：Expand/Collapse All 菜单同时覆盖旧 `.tool-log`（单条 ToolCard）与新 `.process-card-details`。

**未提交 git**（沿用 §104 不自动推送、§11 只提交当前任务文件，待用户指示）。

## 待用户验收
真实壳内跑多步工具任务：进行中看状态行列表 + 当前步细节展开、正文出现时过程收敛成一行、点击展开可审计、失败步保持展开。

## 后续（未做，待拍板）
- "过程显示：简洁 / 标准 / 详细"三档设置项。
- 计划卡（`ActivePlanCard`，右侧栏 step-dot）也迁入 ProcessCard 壳，彻底统一三套语言。
