# Visionox 配色方案指南

> 7 套 UI 配色方案（4 主 + 3 深色变体），通过左下角下拉框切换，实时生效无需刷新。

## 目录结构

```
src-tauri/theme/
  dark.css               深色（默认，app.css :root 的显式副本）
  warm-sand.css          暖沙 — 温暖纸质感（浅色）
  cool-ash.css           冷灰 — 现代清爽感（浅色）
  soft-sage.css          柔绿 — 自然有机感（浅色）
  deep-charcoal.css      深炭灰 — 暖石墨质感（深色）
  midnight-ink.css       午夜墨蓝 — 墨水专业感（深色）
  espresso.css           浓缩咖啡 — 皮革温润感（深色）
  docs/COLOR_SCHEMES.md  本文档
```

以上文件为参考文档。实际生效的 CSS 已合并到：
```
src-tauri/resources/server/visionox-pkg/dashboard/app.css
```

## 切换机制

```
html[data-theme="dark"]           → 深色（默认，无 data-theme 时也走 :root）
html[data-theme="warm-sand"]      → 暖沙
html[data-theme="cool-ash"]       → 冷灰
html[data-theme="soft-sage"]      → 柔绿
html[data-theme="deep-charcoal"]  → 深炭灰
html[data-theme="midnight-ink"]   → 午夜墨蓝
html[data-theme="espresso"]       → 浓缩咖啡
```

左下角 `<select>` 下拉框切换 `data-theme`，setAttribute 后 CSS 变量即时生效，无需页面刷新。选择通过 cookie `visionox-theme` 持久化，下次打开自动恢复。

---

## Design Tokens（所有方案共用）

| 类别 | 变量名 | 用途 |
|------|--------|------|
| Surfaces | `--surface-base` | 页面背景 |
| | `--surface-raised` | 卡片/面板 |
| | `--surface-overlay` | 弹窗/悬浮层 |
| | `--surface-input` | 输入框 |
| Text | `--text-primary` | 正文 |
| | `--text-secondary` | 描述 |
| | `--text-tertiary` | 提示 |
| | `--text-placeholder` | 占位符 |
| Brand | `--accent-primary` | 主按钮/链接 |
| | `--accent-primary-hover` | 悬停 |
| | `--accent-secondary` | 次要强调 |
| Semantic | `--color-success` | 成功 |
| | `--color-warning` | 警告 |
| | `--color-error` | 错误 |
| | `--color-info` | 信息 |
| Borders | `--border-subtle/default/strong` | 边框层级 |
| Shadows | `--shadow-sm/md/lg` | 阴影层级 |
| | `--shadow-glow` | 发光（accent 色） |

---

## 主方案一：深色（默认）

- 暗底 `#0c0d10` + 琥珀强调 `#f5a623`
- 适合暗色偏好用户，所有深色方案的 anchor

---

## 主方案二：暖沙

- 暖黄底 `#faf6f0` + 古铜强调 `#c4935f`
- 类似 Notion / Arc，适合长时间阅读

---

## 主方案三：冷灰

- 冷灰白底 `#f5f7fa` + 灰蓝强调 `#7a9fba`
- 类似 GitHub Light / Linear，清爽干净

---

## 主方案四：柔绿

- 柔绿底 `#f7f9f5` + 鼠尾草绿强调 `#8aaa7a`
- 类似 Helix Editor，自然安静

---

## 深色变体详细规格

> 来源：已删除的 `src-tauri/theme/dark-schemes.md`（2026-05-20），于 2026-06-03 合并入本文档
>
> 风格：舒适夜间阅读，避免高饱和蓝紫"终端感"。

### 设计原则（3 套共用）

1. **背景不放纯黑** — 使用 `#1a1c20` 左右的深灰，降低与文字的绝对对比
2. **文字不放纯白** — 主文字使用 `#d0d4dc` 左右的灰白，减少眩光
3. **强调色低饱和** — 避免 `#00ffff`、`#ff00ff` 等高饱和色，使用 Muted Earth Tone
4. **语义色去荧光** — success/warning/error/info 全部降低明度和饱和

---

### 变体 A：Deep Charcoal（深炭灰）

**氛围**：像高质量石墨纸/炭笔素描，温暖而沉稳

| Token | 色值 | 说明 |
|-------|------|------|
| `--surface-base` | `#1a1c20` | 页面背景，暖调深炭 |
| `--surface-raised` | `#1f2127` | 卡片/面板，微提亮 |
| `--surface-overlay` | `#252830` | 弹窗/悬浮层 |
| `--surface-input` | `#22252a` | 输入框 |
| `--text-primary` | `#d4d6db` | 正文，非纯白 |
| `--text-secondary` | `#8a8e96` | 描述文字 |
| `--text-tertiary` | `#5a5e66` | 提示/禁用 |
| `--text-placeholder` | `#4a4e56` | 占位符 |
| `--accent-primary` | `#b8a07a` | 主按钮，低饱和暖金 |
| `--accent-primary-hover` | `#c9b48e` | 悬停，微提亮 |
| `--accent-secondary` | `#8a7a5e` | 次要强调 |
| `--color-success` | `#6a9a7a` | 柔和绿 |
| `--color-warning` | `#b8a06a` | 柔和琥珀 |
| `--color-error` | `#b07070` | 柔和玫瑰红 |
| `--color-info` | `#6a8aaa` | 柔和蓝灰 |
| `--border-subtle` | `#2a2d33` | 极淡边框 |
| `--border-default` | `#353840` | 默认边框 |
| `--border-strong` | `#454850` | 强调边框 |
| `--shadow-sm/md/lg` | `rgba(0,0,0,0.3~0.5)` | 纯黑阴影（深色模式通用） |
| `--shadow-glow` | `rgba(184,160,122,0.08)` | 暖金微光 |

---

### 变体 B：Midnight Ink（午夜墨蓝）

**氛围**：像钢笔墨水在纸上晕开，冷调但柔和，专业克制

| Token | 色值 | 说明 |
|-------|------|------|
| `--surface-base` | `#171920` | 页面背景，带蓝调的墨黑 |
| `--surface-raised` | `#1c1e27` | 卡片/面板 |
| `--surface-overlay` | `#222530` | 弹窗/悬浮层 |
| `--surface-input` | `#1f212a` | 输入框 |
| `--text-primary` | `#d0d4e0` | 正文，带蓝调的灰白 |
| `--text-secondary` | `#848a9a` | 描述文字 |
| `--text-tertiary` | `#555a6a` | 提示/禁用 |
| `--text-placeholder` | `#454a5a` | 占位符 |
| `--accent-primary` | `#7a9ab8` | 主按钮，低饱和灰蓝 |
| `--accent-primary-hover` | `#8aaaca` | 悬停，微提亮 |
| `--accent-secondary` | `#5a7a98` | 次要强调 |
| `--color-success` | `#6a9a8a` | 柔和青绿 |
| `--color-warning` | `#a89a6a` | 柔和黄 |
| `--color-error` | `#a07080` | 柔和玫瑰 |
| `--color-info` | `#6a8aaa` | 柔和蓝 |
| `--border-subtle` | `#252838` | 极淡边框 |
| `--border-default` | `#303548` | 默认边框 |
| `--border-strong` | `#404558` | 强调边框 |
| `--shadow-glow` | `rgba(122,154,184,0.08)` | 灰蓝微光 |

---

### 变体 C：Espresso（浓缩咖啡）

**氛围**：像深夜咖啡馆的皮革沙发与木质桌面，温暖而私密

| Token | 色值 | 说明 |
|-------|------|------|
| `--surface-base` | `#1c1917` | 页面背景，深棕灰 |
| `--surface-raised` | `#211e1b` | 卡片/面板 |
| `--surface-overlay` | `#282520` | 弹窗/悬浮层 |
| `--surface-input` | `#252220` | 输入框 |
| `--text-primary` | `#ddd8d3` | 正文，暖灰白 |
| `--text-secondary` | `#9a9590` | 描述文字 |
| `--text-tertiary` | `#6a6560` | 提示/禁用 |
| `--text-placeholder` | `#5a5550` | 占位符 |
| `--accent-primary` | `#b0906a` | 主按钮，低饱和咖啡金 |
| `--accent-primary-hover` | `#c0a07a` | 悬停，微提亮 |
| `--accent-secondary` | `#8a7050` | 次要强调 |
| `--color-success` | `#7a9a6a` | 柔和橄榄绿 |
| `--color-warning` | `#b0a06a` | 柔和金黄 |
| `--color-error` | `#b07070` | 柔和砖红 |
| `--color-info` | `#7a8aaa` | 柔和灰蓝 |
| `--border-subtle` | `#2a2724` | 极淡边框 |
| `--border-default` | `#35322e` | 默认边框 |
| `--border-strong` | `#45423e` | 强调边框 |
| `--shadow-glow` | `rgba(176,144,106,0.08)` | 咖啡金微光 |

---

### 与原深色方案对比

| 维度 | 原默认深色 | 新深色变体 |
|------|-----------|-----------|
| 背景 | `#0c0d10` 近纯黑 | `#1a1c20` 深炭灰 |
| 主文字 | `#f0f0f2` 近纯白 | `#d4d6db` 灰白 |
| 强调色 | `#f5a623` 高饱和琥珀 | `#b8a07a` 低饱和暖金 |
| 对比度 | 高，刺眼 | 中低，舒适 |
| 氛围 | 终端/黑客 | 编辑器/IDE |

---

## 新增方案的步骤

1. 在 `src-tauri/theme/` 创建 `new-theme.css`
2. 在 `app.css` 末尾追加 `[data-theme="new-theme"] { ... }` 块（覆盖全部 surface/text/accent/semantic/border/shadow 变量）
3. 在 `app.js` 的 `<select>` 中加一个 `<option value="new-theme">`

---

*版本: 3.1 | 2026-05-20 → 2026-06-07 交叉验证 | 适用: Visionox Desktop（7 套方案，README.md 已同步）*
