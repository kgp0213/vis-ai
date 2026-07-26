// 共享 UI 原语：真开关（替换 settings 等处按钮式开/关）。
// role=switch + aria-checked，滑块随 accent 主题变色；尊重 prefers-reduced-motion。
import { html } from "../lib/html.js";
import { t as t4 } from "../i18n/index.js";

export function Switch({ checked = false, onChange, disabled = false, label = "", ariaLabel = null }) {
  const toggle = () => {
    if (disabled) return;
    onChange?.(!checked);
  };
  return html`
    <button
      type="button"
      role="switch"
      aria-checked=${checked ? "true" : "false"}
      aria-label=${ariaLabel ?? label ?? t4("uiPrim.switchAria")}
      class=${`ui-switch ${checked ? "on" : ""}`}
      disabled=${disabled}
      onClick=${toggle}
    >
      <span class="ui-switch-knob"></span>
    </button>
    ${label ? html`<span class="ui-switch-label" onClick=${toggle}>${label}</span>` : null}
  `;
}
