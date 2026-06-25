# Visionox UI Design Tokens

> 仅记录当前 `app.css` 中实际生效的 CSS 变量和设计约定。
> 完整设计规范（组件库、交互动效等）已移除——这些内容从未实现，仅存在于设计文档中。
> 配色方案详见 `DEVELOPMENT_RULES.md` 第八章。

---

## 一、Design Tokens（:root / [data-theme="dark"] 默认）

```css
/* Surfaces */
--surface-base: #0c0d10;
--surface-raised: #13151a;
--surface-overlay: #1a1d24;
--surface-input: #0f1014;

/* Text */
--text-primary: #f0f0f2;
--text-secondary: #a0a4ad;
--text-tertiary: #6b7080;
--text-placeholder: #4a4e5a;

/* Brand */
--accent-primary: #f5a623;
--accent-primary-hover: #ffc04d;
--accent-secondary: #e8930a;

/* Semantic */
--color-success: #34d399;
--color-warning: #fbbf24;
--color-error: #f87171;
--color-info: #60a5fa;

/* Borders */
--border-subtle: #1f2229;
--border-default: #2a2e38;
--border-strong: #3d424f;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
--shadow-md: 0 4px 12px rgba(0,0,0,0.4);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
--shadow-glow: 0 0 20px rgba(245,166,35,0.15);
```

## 二、浅色主题覆盖（[data-theme="light"]）

```css
--surface-base: #fafafa;
--surface-raised: #ffffff;
--surface-overlay: #f5f5f7;
--surface-input: #f0f0f2;
--text-primary: #1a1a1f;
--text-secondary: #5c5f6a;
--text-tertiary: #8b8f9a;
--accent-primary: #d97706;
--accent-primary-hover: #b45309;
--border-subtle: #e5e5e8;
--border-default: #d1d3d8;
--border-strong: #b0b3bc;
```

## 三、字体

```css
--font-sans: 'Segoe UI Variable', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif;
--font-mono: 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace;
```

## 四、间距

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;
--space-4: 16px;  --space-5: 20px;  --space-6: 24px;
--space-8: 32px;  --space-10: 40px; --space-12: 48px;
```

## 五、圆角

```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;
```

## 六、主题切换

- 通过 `<select>` 下拉框切换 `html[data-theme="..."]`
- 选择通过 `localStorage` 持久化，cookie `visionox-theme` 作为兼容兜底
- 当前可用：`dark`（默认）、`light`、`warm-sand`、`cool-ash`、`soft-sage`
- 3 个深色变体源文件（deep-charcoal/midnight-ink/espresso）存在于 `src-tauri/theme/`，尚未合并到 `app.css`

---

*版本: 2.0 | 2026-06-07 精简 | 原 2100 行 → 当前 ~80 行*
