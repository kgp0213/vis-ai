# Visionox UI Design Tokens

> 仅记录当前 `app.css` 中实际生效的 CSS 变量和设计约定。
> 完整设计规范（组件库、交互动效等）已移除——这些内容从未实现，仅存在于设计文档中。
> 配色方案详见 [开发指南](DEVELOPMENT.md) 第六章。

---

## 一、Design Tokens（`:root` / `[data-theme="dark"]` 默认）

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
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
--shadow-glow: 0 0 20px rgba(245, 166, 35, 0.15);

/* Typography */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;

--text-xs: 0.75rem;
--text-sm: 0.8125rem;
--text-base: 0.9375rem;
--text-lg: 1.125rem;
--text-xl: 1.5rem;
--text-2xl: 2rem;

/* Spacing */
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.25rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-10: 2.5rem;
--space-12: 3rem;
--space-16: 4rem;

/* Motion */
--duration-instant: 100ms;
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 400ms;

--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
--ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

/* Radius */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;

/* Legacy aliases used by bundled dashboard panels */
--bg: var(--surface-base);
--bg-0: var(--surface-base);
--bg-input: var(--surface-input);
--bg-elev: var(--surface-raised);
--bg-elev-2: var(--surface-overlay);
```

## 二、浅色主题覆盖（`[data-theme="light"]`）

```css
--surface-base: #fafafa;
--surface-raised: #ffffff;
--surface-overlay: #f5f5f7;
--surface-input: #f0f0f2;
--text-primary: #1a1a1f;
--text-secondary: #5c5f6a;
--text-tertiary: #8b8f9a;
--text-placeholder: #b0b3bc;
--accent-primary: #d97706;
--accent-primary-hover: #b45309;
--border-subtle: #e5e5e8;
--border-default: #d1d1d6;
--border-strong: #a0a3aa;
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
--shadow-glow: 0 0 20px rgba(217, 119, 6, 0.1);
```

## 三、主题切换

- 通过 `<select>` 下拉框切换 `html[data-theme="..."]`
- 选择通过 `localStorage` 持久化，cookie `visionox-theme` 作为兼容兜底
- 当前 UI 可选 8 套：`dark`（默认）、`light`、`warm-sand`、`cool-ash`、`soft-sage`、`deep-charcoal`、`midnight-ink`、`espresso`
- 对应源文件均位于 `src-tauri/theme/`，且已全部合并到 `app.css`

---

*版本: 2.2 | 2026-07-03 | 校正文档引用 + 小幅润色*
