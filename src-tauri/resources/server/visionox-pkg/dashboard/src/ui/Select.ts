// 共享 UI 原语：自定义 Select，替换全站 30 处原生 <select>。
// 令牌化（surface-input 触发 / surface-raised 弹层 / accent 选中左条），随 9 套主题自适应。
// 支持：选项描述 meta、禁用项、可选搜索、键盘 ↑↓/Enter/Esc、aria-haspopup=listbox、外点关闭。
import { useEffect as y2, useRef as A2, useState as d2 } from "preact/hooks";
import { html } from "../lib/html.js";
import { t as t4 } from "../i18n/index.js";

export function Select({
  value,
  options = [],
  onChange,
  placeholder = t4("uiPrim.selectPlaceholder"),
  disabled = false,
  searchable = false,
  ariaLabel = t4("uiPrim.selectAria"),
  width = null,
}) {
  const [open, setOpen] = d2(false);
  const [query, setQuery] = d2("");
  const [active, setActive] = d2(0);
  const rootRef = A2(null);
  const listRef = A2(null);
  const searchRef = A2(null);

  const norm = (options || []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const filtered = query.trim()
    ? norm.filter((o) => `${o.label} ${o.meta ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : norm;
  const enabled = filtered.filter((o) => !o.disabled);
  const current = norm.find((o) => o.value === value);

  const close = () => { setOpen(false); setQuery(""); };
  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    const idx = Math.max(0, filtered.findIndex((o) => o.value === value && !o.disabled));
    setActive(idx);
  };
  const pick = (o) => {
    if (!o || o.disabled) return;
    if (o.value !== value) onChange?.(o.value);
    close();
  };

  // 外点关闭
  y2(() => {
    if (!open) return;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) close(); };
    const onEsc = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
    document.addEventListener("pointerdown", onDoc, true);
    document.addEventListener("keydown", onEsc, true);
    return () => { document.removeEventListener("pointerdown", onDoc, true); document.removeEventListener("keydown", onEsc, true); };
  }, [open]);

  // 打开时聚焦搜索框并滚动到选中项
  y2(() => {
    if (!open) return;
    if (searchable) searchRef.current?.focus();
    const sel = listRef.current?.querySelector(".ui-select-option.sel");
    sel?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const moveActive = (dir) => {
    if (enabled.length === 0) return;
    let i = active;
    for (let step = 0; step < filtered.length; step++) {
      i = (i + dir + filtered.length) % filtered.length;
      if (!filtered[i].disabled) break;
    }
    setActive(i);
    listRef.current?.children?.[i]?.scrollIntoView?.({ block: "nearest" });
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Enter") { e.preventDefault(); pick(filtered[active]); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(filtered.length - 1); }
  };

  return html`
    <div class="ui-select" ref=${rootRef} style=${width ? `width:${width}` : null} onKeyDown=${onKeyDown}>
      <button
        type="button"
        class=${`ui-select-trigger ${open ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded=${open}
        aria-label=${ariaLabel}
        disabled=${disabled}
        onClick=${() => (open ? close() : openMenu())}
      >
        <span class=${`ui-select-value ${current ? "" : "placeholder"}`}>${current ? current.label : placeholder}</span>
        <span class="ui-select-chev" aria-hidden="true">▾</span>
      </button>
      ${open ? html`
        <div class="ui-select-menu" role="listbox" aria-label=${ariaLabel}>
          ${searchable ? html`
            <div class="ui-select-search">
              <input
                ref=${searchRef}
                type="text"
                value=${query}
                placeholder=${t4("uiPrim.selectSearch")}
                onInput=${(e) => { setQuery(e.target.value); setActive(0); }}
              />
            </div>
          ` : null}
          <div class="ui-select-list" ref=${listRef}>
            ${filtered.length === 0 ? html`<div class="ui-select-empty">${t4("uiPrim.selectEmpty")}</div>` : filtered.map((o, i) => html`
              <div
                key=${o.value}
                role="option"
                aria-selected=${o.value === value}
                class=${`ui-select-option ${o.value === value ? "sel" : ""} ${i === active ? "active" : ""} ${o.disabled ? "disabled" : ""}`}
                onMouseEnter=${() => !o.disabled && setActive(i)}
                onMouseDown=${(e) => { e.preventDefault(); pick(o); }}
              >
                <span class="ui-select-check" aria-hidden="true">${o.value === value ? "✓" : ""}</span>
                <span class="ui-select-name">${o.label}</span>
                ${o.meta ? html`<span class="ui-select-meta">${o.meta}</span>` : null}
              </div>
            `)}
          </div>
        </div>
      ` : null}
    </div>
  `;
}
