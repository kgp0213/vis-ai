# Visionox 配色方案指南

> 4 套 UI 配色方案，通过左下角下拉框切换，实时生效无需刷新。

## 目录结构

```
src-tauri/theme/
  dark.css          深色（默认，app.css :root 的显式副本）
  warm-sand.css     暖沙 — 温暖纸质感
  cool-ash.css      冷灰 — 现代清爽感
  soft-sage.css     柔绿 — 自然有机感
  COLOR_SCHEME_GUIDE.md  本文档
```

以上文件为参考文档。实际生效的 CSS 已合并到：
```
src-tauri/resources/server/visionox-pkg/dashboard/app.css
```

## 切换机制

```
html[data-theme="dark"]       → 深色（默认，无 data-theme 时也走 :root）
html[data-theme="warm-sand"]  → 暖沙
html[data-theme="cool-ash"]   → 冷灰
html[data-theme="soft-sage"]  → 柔绿
```

左下角 `<select>` 下拉框切换 `data-theme`，setAttribute 后 CSS 变量即时生效，无需页面刷新。选择通过 cookie `visionox-theme` 持久化，下次打开自动恢复。

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

## 方案一：深色（默认）

- 暗底 #0c0d10 + 琥珀强调 #f5a623
- 适合暗色偏好用户

## 方案二：暖沙

- 暖黄底 #faf6f0 + 古铜强调 #c4935f
- 类似 Notion / Arc，适合长时间阅读

## 方案三：冷灰

- 冷灰白底 #f5f7fa + 灰蓝强调 #7a9fba
- 类似 GitHub Light / Linear，清爽干净

## 方案四：柔绿

- 柔绿底 #f7f9f5 + 鼠尾草绿强调 #8aaa7a
- 类似 Helix Editor，自然安静

## 新增方案的步骤

1. 在 `src-tauri/theme/` 创建 `new-theme.css`
2. 在 `app.css` 末尾追加 `[data-theme="new-theme"] { ... }` 块（覆盖全部 surface/text/accent/semantic/border/shadow 变量）
3. 在 `app.js` 的 `<select>` 中加一个 `<option value="new-theme">`

---

*版本: 2.0 | 2026-05-18 | 适用: Visionox Desktop*
