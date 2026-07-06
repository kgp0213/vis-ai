# 问题分析与解决方案建议

> 生成时间：2026-07-04
> 最后更新：2026-07-04（源码核实后修订）
> 涉及范围：`src-tauri/`（Tauri 桌面外壳）、`visionox-pkg/dashboard/`（桌面 Dashboard UI）
> **注意**：本文档分析的是实际运行的 `visionox-pkg/dashboard/dist/app.js`（旧版 Preact/htm）和 `visionox-pkg/dashboard/app.css`，而非新版 `tep/dashboard/src/`。

---

## 背景

用户反馈以下两个问题：

1. **审批卡片宽度偏宽**：auto/yolo 模式下需要用户授权时弹出的审批卡片，视觉上比普通聊天消息更宽，两头超出聊天窗口。
2. **确认窗口视觉优化**：auto/yolo 模式下需要用户授权时弹出的确认窗口视觉表现有待改进。

本文档分别分析这两个问题的根因，并给出建议的解决方案。

---

## 问题一：审批卡片宽度偏宽

### 现象

- auto/yolo 模式下弹出的审批卡片（命令执行确认、路径访问确认、计划审批、计划检查点、计划修订、选项确认）视觉上比普通聊天消息更宽，两头超出聊天窗口。

### 源码事实（经实际运行代码核实）

实际运行的是 `visionox-pkg/dashboard/dist/app.js`（旧版 Preact/htm），类名与新版 `tep/dashboard/src/` 不同。

#### 1. 普通 AI 消息的结构

文件：`visionox-pkg/dashboard/dist/app.js:23230`

```js
${avatar ? html4`<img class="avatar" src=${avatar} width="28" height="28" alt="" />`
          : html4`<div class="glyph">·</div>`}
<div class="body">
  ${msg.reasoning ? ... : null}
  ${renderMessageBody(msg.text)}
  ...
</div>
```

外层容器类名为 `.chat-msg`：

文件：`visionox-pkg/dashboard/app.css:1764`

```css
.chat-msg {
  display: flex;
  gap: var(--space-3);   /* 约 12px */
  align-items: flex-start;
  line-height: 1.6;
}
```

左侧图标/头像 `.glyph`：

文件：`visionox-pkg/dashboard/app.css:1783`

```css
.chat-msg .glyph {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

消息内容 `.body`：

文件：`visionox-pkg/dashboard/app.css:1827`

```css
.chat-msg .body {
  flex: 1;
  min-width: 0;
  background: var(--surface-raised);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
}
```

#### 2. 审批卡片的结构

文件：`visionox-pkg/dashboard/dist/app.js:23241`

```js
function ModalCard({ accent, icon, title, subtitle, children }) {
  return html4`
    <div class="modal-card" style=${`border-left-color: ${accent};`}>
      <div class="modal-card-head">
        <span class="modal-card-icon" style=${`color: ${accent};`}>${icon}</span>
        <div>
          <div class="modal-card-title">${title}</div>
          ...
        </div>
      </div>
      ${children}
    </div>
  `;
}
```

文件：`visionox-pkg/dashboard/app.css:4361`

```css
.modal-card {
  margin: 0 0 6px 0;
  background: var(--surface-raised);
  border: 1px solid var(--border-default);
  border-left: 3px solid var(--accent-primary);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
  box-shadow: var(--shadow-md);
}
```

### 根因分析

**审批卡片没有和普通消息共用 `.chat-msg` 布局容器。**

普通消息的可用宽度计算：
```
.chat-msg .body 宽度 = 容器宽度 - .glyph 宽度(36px) - gap(var(--space-3), 约12px)
                    ≈ 容器宽度 - 48px
```

审批卡片 `.modal-card` 直接放在父容器中，宽度 = 容器宽度。

因此，**审批卡片比普通消息宽约 48px**。这个差值正好就是左侧 `.glyph`（36px）+ `.chat-msg` 的 `gap`（约 12px）所占用的空间。

左侧没有 glyph 缩进，所以审批卡片左边明显“顶出去”；右侧由于消息气泡本身有圆角和背景区，审批卡片直接顶到容器边缘，视觉上也会显得更满。

### 解决方案建议

#### 方案 A：把审批卡片包进 `.chat-msg` 结构（推荐）

在渲染 `ShellModal`、`ChoiceModal`、`PathModal`、`PlanModal` 等审批弹窗时，外层包一层：

```js
html4`
  <div class="chat-msg assistant">
    <div class="glyph">⚡</div>
    <div class="body">
      <${ShellModal} modal=${modal} onResolve=${onResolve} />
    </div>
  </div>
`
```

这样审批卡片就和普通 AI 消息处于同一布局容器，自动扣除左侧 glyph + gap 的空间。

- **优点**：与普通消息完全对齐，不依赖固定像素值；如果以后调整 `.glyph` 尺寸或 gap，审批卡片会自动跟随。
- **缺点**：需要修改渲染审批模态的入口代码（`app.js` 中调用 ModalCard 的位置）。

#### 方案 B：给 `.modal-card` 加左侧缩进

不改动 DOM 层级，只在 CSS 中给 `.modal-card` 加与 glyph + gap 等效的左边距：

```css
.modal-card {
  margin-left: calc(36px + var(--space-3));
}
```

或者更直观一点：

```css
.modal-card {
  margin-left: 48px;  /* 36px glyph + 12px gap */
}
```

- **优点**：改动最小，只改 CSS。
- **缺点**：硬编码值，如果 `.chat-msg` 的 gap 或 `.glyph` 尺寸变化，这里会错位。

#### 方案 C：同时处理右侧对齐

如果用户觉得审批卡片右侧也“超出”，可以考虑给 `.modal-card` 同时加左右 margin，或把它放进一个与 `.chat-msg .body` 等宽的容器。但通常只需要对齐左侧即可，因为右侧消息气泡本身也是顶到容器右边缘的。

### 建议

推荐 **方案 A**，因为它让审批卡片和普通消息共用同一套布局容器，最稳定、最不易出错。如果希望改动最小、只改 CSS，可以选 **方案 B**，但要接受硬编码风险。

---

## 问题二：确认窗口视觉优化

### 现象

- auto/yolo 模式下需要用户授权时弹出的确认窗口（命令执行确认、路径访问确认、计划审批、计划检查点、计划修订、选项确认）视觉表现有待改进。

### 已完成改动

#### 1. TUI 确认窗口（`tep/src/cli/ui/`）

针对终端 TUI 版本的确认窗口，已做以下轻量视觉优化：

- `ApprovalCard`：增加背景色、标题与 meta 分居两端、meta 使用 tone 色、footer 支持双行快捷键提示。
- `EditConfirm`：diff 上下增加分隔线、旧/新标签加粗并 pill 化、页脚拆为主操作/辅助操作两行。
- `SingleSelect`：增加 `recommended` 字段高亮推荐项、hint 颜色提升为 `FG.sub`。
- `PlanConfirm`、`PlanCheckpointConfirm`、`ShellConfirm`、`PathConfirm`：给默认项标记 `recommended`。
- `zh-CN.ts` / `EN.ts` / `types.ts`：增加 `footerPrimary` / `footerSecondary` 文案和类型。

#### 2. 桌面 Dashboard 审批卡片（`tep/dashboard/src/ui/extra-cards.tsx` + `styles.css`）

> **注意**：这部分改动基于新版 `tep/dashboard/src/` 源码，类名为 `.approval`。实际运行的是旧版 `visionox-pkg/dashboard/dist/app.js`，审批卡片类名为 `.modal-card`，因此新版 `.approval` 样式当前不会生效。

已完成的样式改动包括：

- `.approval` 增加阴影、边框加重、圆角统一。
- `.ap-head` 增加背景色，图标增加同色微阴影。
- 操作按钮区分更明确：主操作实心主题色，次操作 outline。
- `.ap-preview` 增加左侧彩色强调线。
- meta 信息改成 pill 样式。

### 状态

- TUI 确认窗口优化已完成并通过类型检查与 lint。
- 桌面 Dashboard 审批卡片视觉优化：**基于新版源码已完成，但未在实际运行的旧版中生效**。
- 如果要让桌面端生效，需要：
  1. 把样式改动迁移到旧版 `visionox-pkg/dashboard/app.css` 的 `.modal-card` 相关规则上；或
  2. 用新版 `tep/dashboard` 重新构建并替换 `visionox-pkg/dashboard`。

---

## 总结与优先级

| 优先级 | 问题 | 建议方案 | 状态 |
|--------|------|----------|------|
| P0 | 审批卡片宽度偏宽 | 把审批卡片包进 `.chat-msg` 结构（推荐），或给 `.modal-card` 加左侧缩进 | 待修复 |
| P1 | 确认窗口视觉优化（TUI） | 已完成 | 已完成 |
| P2 | 确认窗口视觉优化（桌面 Dashboard） | 迁移到旧版 `.modal-card` 样式，或重新构建新版 dashboard | 部分完成（新版源码已改，旧版运行时未生效） |

---

## 假设说明

1. 实际运行代码是 `visionox-pkg/dashboard/dist/app.js` + `visionox-pkg/dashboard/app.css`，而非新版 `tep/dashboard/src/`。
2. 审批卡片宽度差异的根因已确认：旧版中审批卡片（`.modal-card`）未使用 `.chat-msg` 布局容器，缺少左侧 `.glyph`（36px）+ `gap`（约 12px）的缩进。
3. 桌面 Dashboard 视觉优化若要生效，必须同步修改旧版 `visionox-pkg/dashboard/app.css` 中的 `.modal-card` 规则，或放弃旧版直接切到新版构建。
