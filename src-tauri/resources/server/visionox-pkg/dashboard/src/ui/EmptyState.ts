// 共享 UI 原语：空态与骨架屏。统一各面板"加载中…/暂无数据"的纯文本写法。
// EmptyState：图标 + 标题 + 描述 + 可选动作；Skeleton：shimmer 灰条（尊重 reduced-motion）。
import { html } from "../lib/html.js";

export function EmptyState({ icon = "∅", title, desc = null, action = null }) {
  return html`
    <div class="ui-empty">
      <div class="ui-empty-icon" aria-hidden="true">${icon}</div>
      <div class="ui-empty-title">${title}</div>
      ${desc ? html`<div class="ui-empty-desc">${desc}</div>` : null}
      ${action ? html`<div class="ui-empty-action">${action}</div>` : null}
    </div>
  `;
}

export function Skeleton({ lines = 3, widths = null }) {
  const arr = Array.from({ length: Math.max(1, lines) });
  return html`
    <div class="ui-skeleton" aria-hidden="true">
      ${arr.map((_, i) => {
        const w = widths && widths[i] != null ? widths[i] : (i === arr.length - 1 ? "72%" : `${88 - i * 6}%`);
        return html`<div class="ui-skeleton-line" style=${`width:${w}`}></div>`;
      })}
    </div>
  `;
}
