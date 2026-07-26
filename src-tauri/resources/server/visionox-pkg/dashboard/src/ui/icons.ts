// 共享 UI 原语：可换色线性 SVG 图标。
// 全部使用 currentColor 描边，随文本色 / 主题自动适配；viewBox 16x16，stroke-width 1.5，round 线帽。
// 用于替换 composer chips 与右侧操作中的 emoji（🤖💻📋🔍✨），解决 emoji 不可换色、跨平台字形不一致、基线漂移问题。
import { html } from "../lib/html.js";

type IconProps = { size?: number };

function base(children: unknown, size = 14) {
  return html`<svg viewBox="0 0 16 16" width=${size} height=${size} aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${children}</svg>`;
}

// 模型：芯片 / 处理器
export function IconModel({ size }: IconProps = {}) {
  return base(html`
    <rect x="4" y="4" width="8" height="8" rx="1.5" />
    <path d="M6.5 1.5v2M9.5 1.5v2M6.5 12.5v2M9.5 12.5v2M1.5 6.5h2M1.5 9.5h2M12.5 6.5h2M12.5 9.5h2" />
  `, size);
}

// 工作空间：显示器
export function IconWorkspace({ size }: IconProps = {}) {
  return base(html`
    <rect x="2" y="3" width="12" height="8.5" rx="1.5" />
    <path d="M6 14h4M8 11.5V14" />
  `, size);
}

// 后台：任务清单
export function IconJobs({ size }: IconProps = {}) {
  return base(html`
    <path d="M5.5 4h8M5.5 8h8M5.5 12h8" />
    <circle cx="2.75" cy="4" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="2.75" cy="8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="2.75" cy="12" r="0.9" fill="currentColor" stroke="none" />
  `, size);
}

// 索引 / 搜索：放大镜
export function IconSearch({ size }: IconProps = {}) {
  return base(html`
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5 14 14" />
  `, size);
}

// 优化提示词：魔法棒
export function IconWand({ size }: IconProps = {}) {
  return base(html`
    <path d="M3 13 10.5 5.5" />
    <path d="M11.5 2v2M13.5 4h2M11.5 6v2M9.5 4h-2" stroke-width="1.2" />
  `, size);
}

// 附件（plus 菜单内）：回形针
export function IconAttach({ size }: IconProps = {}) {
  return base(html`
    <path d="M12.5 7.5 7 13a3 3 0 0 1-4.2-4.2l5.6-5.6a2 2 0 0 1 2.8 2.8l-5.6 5.6a1 1 0 0 1-1.4-1.4l5-5" />
  `, size);
}

// 技能（plus 菜单内）：扳手
export function IconSkill({ size }: IconProps = {}) {
  return base(html`
    <path d="M9.7 2.3a3.5 3.5 0 0 0-4.4 4.4L2 10l4 4 3.3-3.3a3.5 3.5 0 0 0 4.4-4.4L11 9 9 7l2.7-2.7a3.5 3.5 0 0 0-2-2z" />
  `, size);
}
