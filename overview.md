# Dashboard UI 首批落地 — 概览

日期：2026-07-26 · 范围：复盘修订版 P0/P1 中的「规格 → 计划 → 落地」首批三项

## 完成内容

### 1. 共享 UI 原语（`src/ui/`）
新建统一组件库，全部令牌化、随 9 套主题自适应：

| 组件 | 文件 | 说明 |
|------|------|------|
| Select | `src/ui/Select.ts` | 替换全站 30 处原生 `<select>`；支持 meta 描述 / 禁用项 / 可选搜索 / 键盘 ↑↓ Enter Esc / `aria-haspopup=listbox` / 外点关闭 |
| Switch | `src/ui/Switch.ts` | 真开关（`role="switch"` + `aria-checked`），替换 settings 按钮式开关 |
| SectionHeader / FieldRow | `src/ui/SectionHeader.ts` | 分区标题 + 110px 标签字段行，收敛各面板手搓实现 |
| EmptyState / Skeleton | `src/ui/EmptyState.ts` | 空态 + shimmer 骨架屏（含 prefers-reduced-motion） |
| CmdPalette | `src/ui/CmdPalette.ts` | 命令面板（见下） |
| 图标 | `src/ui/icons.ts` | currentColor 线性 SVG 图标族（见下） |
| 出口 | `src/ui/index.ts` | 统一 re-export |

样式：`app.css` 尾部追加 "Shared UI Primitives" 区块（`.ui-select*` / `.ui-switch*` / `.ui-section-h` / `.ui-field-*` / `.ui-empty*` / `.ui-skeleton*`）。

### 2. 命令面板 Cmd K（死代码接线）
此前 `app.css` 1639–1738 行的 `.cmd-palette` 系列样式完整存在但无任何组件接线。本轮：
- `CmdPalette` 组件：搜索过滤（名称/描述/分组）、↑↓/Enter/Esc/Home/End、选中项 `scrollIntoView`、外点关闭、空态提示。
- `app.css` 补 `.cmd-overlay`（fixed 遮罩、12vh 顶对齐）+ `.cmd-empty`。
- `app.ts`：抽出 `applyTheme` helper（侧栏原生 select 的 onChange 同步复用，消除双轨）；注入 `cmdItems`（13 面板「跳转」组 + 9 套主题「动作」组 + 「打开 MD」）；全局 Cmd/Ctrl+K 切换（全站无快捷键冲突）。Esc 已 `preventDefault + stopPropagation`，不触发聊天面板的关闭逻辑。

### 3. 输入框 emoji SVG 化 + 右侧操作统一
- 四个上下文 chip（🤖 模型 / 💻 工作空间 / 📋 后台 / 🔍 索引）与 ➕ 菜单（📎 附件 / 🔧 技能）全部换成 `icons.ts` 的 currentColor 线性 SVG —— 可换色、跨平台字形一致、基线对齐。
- 「优化提示词」从 28px 文字按钮改为 32px 圆形 icon 按钮，与 ➕ / 发送 同族；优化中显示旋转 spinner；`.composer-optimize` 样式重写（含 prefers-reduced-motion）。

## 验证
每个阶段均执行：
```
npm run dashboard:build          → exit 0
node scripts/check-dashboard-build.js → [dashboard-build] verified
```
哈希：#2 `6937a3689a4d/24e03604f327` · #3 `2bfd38556392/3ac14e3f4b78` · #4 `37e500ac4bb3/9b42fa00da32`。
产物 `dashboard/dist/app.js`(1.2 MB) / `dashboard/app.css`(181 KB) 已更新。**未提交 git**。

## 变更文件
- 新增：`src/ui/Select.ts` `Switch.ts` `SectionHeader.ts` `EmptyState.ts` `CmdPalette.ts` `icons.ts` `index.ts`
- 修改：`src/app.css`（原语样式 + cmd-overlay + composer-optimize）· `src/app.ts`（CmdPalette 接线 + applyTheme）· `src/panels/chat.ts`（图标替换 + 优化按钮）

## 下一步
- 逐面板把 30 处原生 `<select>` 换成共享 Select（settings 7 / tasks 11 / memory 6 …）。
- i18n 收敛：600+ 行硬编码中文接入 `t4()`。
