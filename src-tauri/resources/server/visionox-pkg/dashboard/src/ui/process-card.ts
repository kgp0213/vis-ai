// 共享 UI 原语：ProcessCard —— 过程信息容器。
//
// 设计目标（与 WorkBuddy 参考实现对齐）：
// 把"任务过程中"的信息（工具调用、深度思考、计划）统一收进同一种浅灰底块容器，
// 让用户学一次就处处通用。核心行为：
//   1. 单一焦点 —— 任一时刻只有"当前步"高亮，其余弱化。
//   2. 热度衰减 —— 细节量随与"此刻"的距离递减：当前步展开细节，已完成步一行，整组完成后收敛成计数。
//   3. 让位而非消失 —— 完成后收敛成一行摘要，但保留可展开的审计能力。
//   4. 异常粘性 —— 失败的步骤/组永不自动收敛，必须保持可见。
//
// 结构：
//   <div class="process-card" data-state="running|settled|failed">
//     <details class="process-card-details" open?>
//       <summary class="process-card-summary">  ← 标题行：图标 + 名称 + 计数/状态 + 折叠箭头
//       <div class="process-card-body">          ← 状态行列表（本原语渲染）
//     </details>
//   </div>
//
// 状态行（ProcessRow）由调用方以数据形式提供，本原语负责统一渲染：
//   { id, status: "pending"|"active"|"done"|"failed", label, target?, detail? }
//   - active 行：高亮 + spinner，下方缩进子区显示 detail（输出尾部等"酌情细节"）。
//   - done 行：✓ + 名称 + target，弱化。
//   - failed 行：✗ + 警示色，保持展开。
//   - pending 行：○ + 名称，最弱化（可不传）。
import { html } from "../lib/html.js";
import { IconCheck, IconX, IconDot, IconChevron } from "./icons.js";

export type ProcessRowStatus = "pending" | "active" | "done" | "failed";

export type ProcessRow = {
  id: string;
  status: ProcessRowStatus;
  label: string;            // 步骤名称（如工具名）
  target?: string | null;   // 次要目标（如路径 / 命令），弱化显示
  detail?: string | null;   // 当前步的就地展开细节（输出尾部等），仅 active 行渲染
};

type ProcessCardProps = {
  icon?: unknown;                       // 标题行左侧图标（html 片段）
  title: unknown;                       // 标题行主文案（html 片段或字符串）
  meta?: unknown;                       // 标题行右侧次要信息（计数 / 状态）
  state: "running" | "settled" | "failed";
  rows: ProcessRow[];
  open?: boolean;                       // 受控展开（搜索命中时强制展开）
  defaultOpen?: boolean;                // 非受控时的初始展开
  maxDetailLines?: number;              // active 行 detail 最多渲染行数
  ariaLabel?: string;
};

const DEFAULT_DETAIL_LINES = 3;

function statusMark(status: ProcessRowStatus) {
  switch (status) {
    case "active":
      return html`<span class="spinner process-row-spinner" aria-hidden="true"></span>`;
    case "failed":
      return html`<span class="process-row-mark process-row-mark-failed"><${IconX} size=${12} /></span>`;
    case "done":
      return html`<span class="process-row-mark process-row-mark-done"><${IconCheck} size=${12} /></span>`;
    default:
      return html`<span class="process-row-mark process-row-mark-pending"><${IconDot} size=${12} /></span>`;
  }
}

function renderRow(row: ProcessRow, maxDetailLines: number) {
  const detail = (row.detail ?? "").trim();
  const detailLines = row.status === "active" && detail
    ? detail.split(/\r?\n/).filter((l) => l.trim()).slice(-maxDetailLines)
    : [];
  return html`
    <div key=${row.id} class=${`process-row process-row-${row.status}`} data-row-id=${row.id}>
      <div class="process-row-head">
        ${statusMark(row.status)}
        <span class="process-row-label">${row.label}</span>
        ${row.target ? html`<span class="process-row-target" title=${row.target}>${row.target}</span>` : null}
      </div>
      ${detailLines.length > 0 ? html`
        <div class="process-row-detail">${detailLines.map((l) => html`<div class="process-row-detail-line">${l}</div>`)}</div>
      ` : null}
    </div>
  `;
}

export function ProcessCard({
  icon,
  title,
  meta,
  state,
  rows,
  open,
  defaultOpen = false,
  maxDetailLines = DEFAULT_DETAIL_LINES,
  ariaLabel,
}: ProcessCardProps) {
  const openAttr = open !== void 0 ? open : defaultOpen || void 0;
  return html`
    <div class=${`process-card process-card-${state}`} role="group" aria-label=${ariaLabel}>
      <details class="process-card-details" open=${openAttr}>
        <summary class="process-card-summary">
          ${icon ? html`<span class="process-card-icon">${icon}</span>` : null}
          <span class="process-card-title">${title}</span>
          ${meta ? html`<span class="process-card-meta">${meta}</span>` : null}
          <span class="process-card-chevron"><${IconChevron} size=${13} /></span>
        </summary>
        <div class="process-card-body">
          ${rows.map((r) => renderRow(r, maxDetailLines))}
        </div>
      </details>
    </div>
  `;
}
