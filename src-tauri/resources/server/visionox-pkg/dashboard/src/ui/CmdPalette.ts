// 共享 UI 原语：命令面板（Cmd K）。
// 复用 app.css 1639-1738 行已有的 .cmd-palette / .cmd-input-row / .cmd-list / .cmd-row / .cmd-section-h / .kbd 样式（此前为死代码，此处接线）。
// 令牌化随 9 套主题自适应；键盘模型：↑↓ 移动、Enter 执行、Esc 关闭、Home/End 跳首尾。
// 组件保持纯展示 + 触发回调：items 由调用方（app.ts）注入并预分组（含 section 字段），动作逻辑不内聚在此处。
import { useEffect as y2, useRef as A2, useState as d2 } from "preact/hooks";
import { html } from "../lib/html.js";
import { t as t4 } from "../i18n/index.js";

// items: [{ id, name, desc?, glyph?, section, kbd?, run() }] —— section 相同的连续项归为一组，标题取该组第一项的 section。
export function CmdPalette({ open, onClose, items = [], placeholder = t4("uiPrim.cmdPlaceholder"), ariaLabel = t4("uiPrim.cmdAria") }) {
  const [query, setQuery] = d2("");
  const [sel, setSel] = d2(0);
  const inputRef = A2(null);
  const listRef = A2(null);

  // 打开时重置并聚焦搜索框。
  y2(() => {
    if (!open) return;
    setQuery("");
    setSel(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // 过滤（大小写不敏感，匹配名称 / 描述 / 分组名）。
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => (it.name + " " + (it.desc ?? "") + " " + (it.section ?? "")).toLowerCase().includes(q))
    : items;

  // 查询变化后选中项回到第一项。
  y2(() => { setSel(0); }, [q]);

  // 保证选中项可见。
  y2(() => {
    if (!open) return;
    listRef.current?.querySelector(".cmd-row.sel")?.scrollIntoView({ block: "nearest" });
  }, [sel, open, filtered.length]);

  if (!open) return null;

  const exec = (item) => {
    if (!item) return;
    onClose?.();
    // 关闭后再执行，避免动作打开的新界面与面板叠层。
    setTimeout(() => item.run?.(), 0);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose?.(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); return; }
    if (e.key === "Home") { e.preventDefault(); setSel(0); return; }
    if (e.key === "End") { e.preventDefault(); setSel(Math.max(0, filtered.length - 1)); return; }
    if (e.key === "Enter") { e.preventDefault(); exec(filtered[sel]); return; }
  };

  // 计算每行所属分组标题（与上一项不同则输出一个 .cmd-section-h）。
  let lastSection = null;

  return html`
    <div class="cmd-overlay" role="presentation" onPointerDown=${(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div class="cmd-palette" role="dialog" aria-modal="true" aria-label=${ariaLabel} onKeyDown=${onKeyDown}>
        <div class="cmd-input-row">
          <span class="g" aria-hidden="true">›</span>
          <input
            ref=${inputRef}
            type="text"
            value=${query}
            placeholder=${placeholder}
            aria-label=${placeholder}
            onInput=${(e) => setQuery(e.currentTarget.value)}
          />
          <span class="kbd">esc</span>
        </div>
        <div class="cmd-list" role="listbox" aria-label=${ariaLabel} ref=${listRef}>
          ${filtered.length === 0 ? html`<div class="cmd-empty">${t4("uiPrim.cmdEmpty")}</div>` : null}
          ${filtered.map((it, i) => {
            const showHead = it.section !== lastSection;
            lastSection = it.section;
            return html`
              ${showHead ? html`<div class="cmd-section-h">${it.section}</div>` : null}
              <div
                key=${it.id}
                class=${`cmd-row ${i === sel ? "sel" : ""}`}
                role="option"
                aria-selected=${i === sel}
                onPointerEnter=${() => setSel(i)}
                onClick=${() => exec(it)}
              >
                <span class="g" aria-hidden="true">${it.glyph ?? "›"}</span>
                <span class="name">${it.name}</span>
                ${it.desc ? html`<span class="desc">${it.desc}</span>` : null}
                ${it.kbd ? html`<span class="kbd">${it.kbd}</span>` : null}
              </div>
            `;
          })}
        </div>
      </div>
    </div>
  `;
}
