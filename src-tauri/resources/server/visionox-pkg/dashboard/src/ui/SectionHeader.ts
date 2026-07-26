// 共享 UI 原语：分区标题与字段行。统一替换各面板手搓的内联 h3 / flex 行。
// 全部走 Design Tokens（fg-3 / mono / 间距），随 9 套主题自适应。
import { html } from "../lib/html.js";

export function SectionHeader({ title }) {
  return html`<h3 class="ui-section-h">${title}</h3>`;
}

export function FieldRow({ label, note = null, children }) {
  return html`
    <div class="ui-field-row">
      <span class="ui-field-label">${label}</span>
      <div class="ui-field-control">${children}</div>
      ${note ? html`<span class="ui-field-note">${note}</span>` : null}
    </div>
  `;
}
