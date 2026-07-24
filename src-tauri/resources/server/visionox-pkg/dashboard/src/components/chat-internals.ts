// Recovered from the product bundle; types are tightened incrementally without changing behavior.
// @ts-nocheck
import { marked } from "marked";
import { memo as preactMemo } from "preact/compat";
import { useEffect as y2, useRef as A2, useState as d2 } from "preact/hooks";
import { html as html4 } from "../lib/html.js";
import { t as t4, useLang } from "../i18n/index.js";
import {
  escapeHtml,
  hlLine,
  langFromPath,
  protectWindowsPathBackslashesForMarkdown,
  renderHighlightedBlock,
  renderMarkdownToString,
  renderSearchReplace,
} from "../lib/markdown.js";

export type ChatRole = "user" | "assistant" | "tool" | "info" | "warning" | "error";
export type ChatMsg = Record<string, any> & { id: string; role: ChatRole };
export type OnResolve = (kind: string, ...args: any[]) => void;
const N2: any = preactMemo;

var ROLE_AVATAR = {
  user: "/assets/128x128.png",
  assistant: "/assets/ai-avatar.png"
};
function renderMessageBody(text, role) {
  if (!text) return null;
  const source = role === "user" ? protectWindowsPathBackslashesForMarkdown(text) : text;
  return html4`<div class="md" dangerouslySetInnerHTML=${{ __html: renderMarkdownToString(source) }}></div>`;
}
function parseToolArgs(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function toolTextStats(text) {
  const value = text ?? "";
  return {
    chars: value.length,
    lines: value ? value.split(/\r?\n/).length : 0
  };
}
function isLongToolText(text) {
  const stats = toolTextStats(text);
  return stats.chars > 1600 || stats.lines > 30;
}
function renderToolOutput(text, kind = "pre", lang = "") {
  const value = text ?? "";
  const body = kind === "highlight" ? html4`<div dangerouslySetInnerHTML=${{ __html: renderHighlightedBlock(value, lang) }}></div>` : html4`<pre class="tool-card-output">${value}</pre>`;
  return body;
}
function chatSearchText(msg) {
  if (!msg) return "";
  const parts = [msg.role, msg.toolName, msg.text, msg.reasoning, msg.toolArgs];
  return parts.filter(Boolean).join("\n");
}
function computeChatSearchMatches(messages, query) {
  const needle = (query ?? "").trim().toLowerCase();
  if (!needle) return [];
  const matches = [];
  messages.forEach((msg, index) => {
    if (chatSearchText(msg).toLowerCase().includes(needle)) {
      matches.push({ id: msg.id, index });
    }
  });
  return matches;
}
function ToolCard({ msg }) {
  useLang();
  const args = parseToolArgs(msg.toolArgs);
  const name = msg.toolName ?? "tool";
  const path = args?.path ?? args?.file_path ?? args?.filename;
  const progressStatus = ["queued", "running", "succeeded", "failed", "cancelled"].includes(msg.toolStatus) ? msg.toolStatus : "succeeded";
  const progressLabel = { queued: "排队中", running: "执行中", succeeded: "已完成", failed: "失败", cancelled: "已取消" }[progressStatus];
  const progressBadge = html4`<span class=${`tool-progress-status tool-progress-${progressStatus}`}>${progressLabel}</span>`;
  if ((name === "edit_file" || name.endsWith("_edit_file")) && args && typeof args.search === "string" && typeof args.replace === "string") {
    const diffHtml = renderSearchReplace(
      args.search,
      args.replace,
      path ?? ""
    );
    return html4`
      <div class="tool-card">
        <div class="tool-card-head">
          <span class="tool-card-icon">✎</span>
          <span class="tool-card-name">edit_file</span>
          ${progressBadge}
          ${path ? html4`<code class="tool-card-path">${path}</code>` : null}
        </div>
        <div dangerouslySetInnerHTML=${{ __html: diffHtml }}></div>
        ${msg.text ? html4`<div class="tool-card-result">${msg.text}</div>` : null}
      </div>
    `;
  }
  if ((name === "write_file" || name.endsWith("_write_file")) && args && typeof args.content === "string") {
    const lang = langFromPath(path);
    return html4`
      <div class="tool-card">
        <div class="tool-card-head">
          <span class="tool-card-icon">+</span>
          <span class="tool-card-name">write_file</span>
          ${progressBadge}
          ${path ? html4`<code class="tool-card-path">${path}</code>` : null}
          ${lang ? html4`<span class="pill">${lang}</span>` : null}
        </div>
        ${renderToolOutput(args.content, "highlight", lang)}
        ${msg.text ? html4`<div class="tool-card-result">${msg.text}</div>` : null}
      </div>
    `;
  }
  if (name === "read_file" || name.endsWith("_read_file") || name === "filesystem_read_file") {
    const lang = langFromPath(path);
    return html4`
      <div class="tool-card">
        <div class="tool-card-head">
          <span class="tool-card-icon">▤</span>
          <span class="tool-card-name">read_file</span>
          ${progressBadge}
          ${path ? html4`<code class="tool-card-path">${path}</code>` : null}
          ${lang ? html4`<span class="pill">${lang}</span>` : null}
        </div>
        ${renderToolOutput(msg.text ?? "", "highlight", lang)}
      </div>
    `;
  }
  if (name === "run_command" || name === "run_background") {
    const cmd = args?.command;
    return html4`
      <div class="tool-card">
        <div class="tool-card-head">
          <span class="tool-card-icon">⚡</span>
          <span class="tool-card-name">${name === "run_background" ? "run_background" : "run_command"}</span>
          ${progressBadge}
        </div>
        ${cmd ? html4`<pre class="tool-card-cmd"><span class="tool-card-prompt">$</span> <code>${cmd}</code></pre>` : null}
        ${msg.text ? renderToolOutput(msg.text) : null}
      </div>
    `;
  }
  if (name === "list_files" || name === "file_exists" || name === "delete_file" || name === "create_directory" || name === "delete_directory" || name.endsWith("_list_files")) {
    return html4`
      <div class="tool-card">
        <div class="tool-card-head">
          <span class="tool-card-icon">▣</span>
          <span class="tool-card-name">${name}</span>
          ${progressBadge}
          ${path ? html4`<code class="tool-card-path">${path}</code>` : null}
        </div>
        ${renderToolOutput(msg.text)}
      </div>
    `;
  }
  return html4`
    <div class="tool-card">
      <div class="tool-card-head">
        <span class="tool-card-icon">▣</span>
        <span class="tool-card-name">${name}</span>
        ${progressBadge}
      </div>
      ${args ? html4`<details class="tool-card-args"><summary>${t4("modal.arguments")}</summary><pre>${escapeHtml(JSON.stringify(args, null, 2))}</pre></details>` : null}
      ${renderToolOutput(msg.text)}
    </div>
  `;
}
function renderExecutionReceipt(receipt, taskState, artifactIncomplete, interventionChoice, warnings) {
  if (!receipt || typeof receipt !== "object") return null;
  const completion = receipt.completion || {};
  const tools = receipt.tools || {};
  const artifactEvents = Array.isArray(receipt.artifactEvidence) ? receipt.artifactEvidence : [];
  const lastArtifact = artifactEvents.at(-1);
  const intervention = receipt.intervention || {};
  const state = taskState || completion.taskState || (completion.ok ? "completed" : "unknown");
  const stateLabel = state === "completed" ? "已完成" : state === "needs_intervention" ? "需要干预" : state === "incomplete" ? "未完成" : state === "completed_with_warnings" ? "已完成但有提醒" : "结果待确认";
  const stateClass = state === "completed" ? "ok" : state === "completed_with_warnings" ? "warn" : "err";
  return html4`
    <details class=${`execution-receipt execution-receipt-${stateClass}`}>
      <summary><strong>执行回执</strong><span class="execution-receipt-state">${stateLabel}</span></summary>
      <div class="execution-receipt-grid">
        <span>工具</span><span>${tools.results ?? 0} 次，成功 ${tools.successes ?? 0}，失败 ${tools.failures ?? 0}${tools.lastName ? ` · 最近 ${tools.lastName}` : ""}</span>
        <span>产物</span><span>${artifactIncomplete ? "未完成或待验证" : lastArtifact?.verified ? "已发现并验证" : "未发现可验证产物"}</span>
        ${receipt.mediaReduced || receipt.mediaOmitted > 0 ? html4`<span>媒体</span><span>已降级，省略 ${receipt.mediaOmitted ?? 0} 项${receipt.mediaRecovery ? ` · ${receipt.mediaRecovery}` : ""}${receipt.mediaWarnings?.length ? ` · ${receipt.mediaWarnings[0]}` : ""}</span>` : null}
        ${intervention.shown > 0 ? html4`<span>干预</span><span>已显示 ${intervention.shown} 次${interventionChoice ? ` · 选择 ${interventionChoice}` : ""}</span>` : null}
        ${warnings?.length ? html4`<span>提醒</span><span>${warnings.slice(0, 2).join("；")}</span>` : null}
      </div>
    </details>
  `;
}
var ChatMessage = N2(function ChatMessage2({ msg, streaming, index, searchMatch, onCopy, onFillInput, reasoningExpanded = false, selectedForArtifacts = false, onSelectForArtifacts, userAvatar = null }) {
  useLang();
  const role = msg.role;
  const avatar = role === "user" ? userAvatar || ROLE_AVATAR.user : ROLE_AVATAR[role];
  const onAvatarError = (event) => {
    if (role !== "user" || avatar === ROLE_AVATAR.user || event.currentTarget.dataset.avatarFallback === "1") return;
    event.currentTarget.dataset.avatarFallback = "1";
    event.currentTarget.src = ROLE_AVATAR.user;
  };
  const canCopy = Boolean((msg.text || "").trim());
  const showCopy = role !== "user" && onCopy && canCopy;
  const showFillInput = role === "user" && onFillInput && canCopy;
  const showActions = !streaming && (showCopy || showFillInput);
  const reasoningRef = A2(null);
  const reasoningLive = Boolean(streaming && msg.reasoning);
  const [reasoningOpen, setReasoningOpen] = d2(Boolean(reasoningExpanded));
  const reasoningLength = String(msg.reasoning || "").length;
  y2(() => {
    const node = reasoningRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [msg.reasoning, reasoningLive]);
  y2(() => {
    if (!reasoningLive) setReasoningOpen(Boolean(reasoningExpanded));
  }, [reasoningExpanded, reasoningLive]);
  const onReasoningToggle = (event) => {
    const next = Boolean(event.currentTarget.open);
    setReasoningOpen((current) => current === next ? current : next);
  };
  const actions = showActions ? html4`
    <div class="chat-msg-actions">
      ${showCopy ? html4`<button type="button" onClick=${() => onCopy(msg)}>${t4("chat.copyMessage")}</button>` : null}
      ${showFillInput ? html4`<button type="button" onClick=${() => onFillInput(msg)}>${t4("chat.fillInput")}</button>` : null}
    </div>
  ` : null;
  const selectableForArtifacts = role === "assistant" && typeof onSelectForArtifacts === "function";
  const selectArtifacts = (ev) => {
    if (!selectableForArtifacts) return;
    if (ev?.target?.closest?.("button,a,[data-artifact-action],.chat-artifact-actions")) return;
    onSelectForArtifacts(msg);
  };
  const selectArtifactsKey = (ev) => {
    if (!selectableForArtifacts) return;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onSelectForArtifacts(msg);
    }
  };
  if (role === "tool") {
    const toolComplete = !["queued", "running"].includes(msg.toolStatus);
    return html4`
      <div class=${`chat-msg tool ${toolComplete ? "message-complete" : "message-streaming"} ${searchMatch ? "search-hit" : ""} ${showActions ? "has-actions" : ""}`} data-msg-index=${index} data-msg-id=${msg.id ?? ""}>
        <div class="glyph">▣</div>
        <div class="chat-tool-wrap">
          <${ToolCard} msg=${msg} />
          ${actions}
        </div>
      </div>
    `;
  }
  return html4`
    <div
      class=${`chat-msg ${role} ${streaming ? "message-streaming" : "message-complete"} ${searchMatch ? "search-hit" : ""} ${selectedForArtifacts ? "artifact-selected" : ""} ${selectableForArtifacts ? "artifact-selectable" : ""} ${showActions ? "has-actions" : ""}`}
      data-msg-index=${index}
      data-msg-id=${msg.id ?? ""}
      onClick=${selectArtifacts}
      onKeyDown=${selectArtifactsKey}
      tabIndex=${selectableForArtifacts ? 0 : void 0}
      title=${selectableForArtifacts ? "点击查看这条回复相关文件" : void 0}
    >
      ${avatar ? html4`<img key=${avatar} class="avatar" src=${avatar} width="28" height="28" alt="" loading="lazy" decoding="async" onError=${onAvatarError} />`
                : html4`<div class="glyph">·</div>`}
      <div class="body">
        ${msg.reasoning ? reasoningLive ? html4`
          <div class="reasoning reasoning-live-tail" ref=${reasoningRef}>${msg.reasoning}</div>
        ` : html4`
          <details class="reasoning-details" open=${reasoningOpen} onToggle=${onReasoningToggle}>
            <summary class="reasoning-summary">
              <span class="reasoning-summary-label">思考过程</span>
              <span class="reasoning-summary-meta">约 ${reasoningLength.toLocaleString()} 字</span>
            </summary>
            <div class="reasoning">${msg.reasoning}</div>
          </details>
        ` : null}
        ${renderMessageBody(msg.text, role)}
        ${role === "assistant" && !streaming ? renderExecutionReceipt(msg.receipt, msg.taskState, msg.artifactIncomplete, msg.interventionChoice, msg.warnings) : null}
        ${msg.images && msg.images.length > 0 ? html4`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${msg.images.map(function(imgUrl) { return html4`<a href=${imgUrl} target="_blank" rel="noopener noreferrer" style="display:block;max-width:220px;border-radius:6px;overflow:hidden;border:1px solid var(--border-subtle,#2a2e38)"><img src=${imgUrl} style="width:100%;height:auto;display:block" /></a>`; })}</div>` : null}
        ${streaming ? html4`<span class="chat-streaming-cursor"></span>` : null}
        ${actions}
      </div>
    </div>
  `;
});
function ModalCard({ accent, icon, title, subtitle, children }) {
  return html4`
    <div class="modal-card" style=${`border-left-color: ${accent};`}>
      <div class="modal-card-head">
        <span class="modal-card-icon" style=${`color: ${accent};`}>${icon}</span>
        <div>
          <div class="modal-card-title">${title}</div>
          ${subtitle ? html4`<div class="modal-card-subtitle">${subtitle}</div>` : null}
        </div>
      </div>
      ${children}
    </div>
  `;
}
function ShellModal({ modal, onResolve }) {
  useLang();
  const isBg = modal.shellKind === "run_background";
  return html4`
    <${ModalCard}
      accent="#f87171"
      icon=${isBg ? "\u23F1" : "\u26A1"}
      title=${isBg ? t4("modal.shellBgTitle") : t4("modal.shellTitle")}
      subtitle=${isBg ? t4("modal.shellBgSubtitle") : t4("modal.shellSubtitle")}
    >
      <div class="modal-cmd"><span class="modal-cmd-prompt">$</span> <code>${modal.command}</code></div>
      <div class="modal-actions">
        <button class="primary" onClick=${() => onResolve("shell", "run_once")}>${t4("modal.runOnce")}</button>
        <button onClick=${() => onResolve("shell", "always_allow")}>${t4("modal.alwaysAllow", { prefix: modal.allowPrefix ?? "" })}</button>
        <button class="danger" onClick=${() => onResolve("shell", "deny")}>${t4("modal.deny")}</button>
      </div>
    <//>
  `;
}
function ChoiceModal({ modal, onResolve }) {
  useLang();
  const [custom, setCustom] = d2("");
  const [showCustom, setShowCustom] = d2(false);
  const contextInput = modal.contextInput;
  return html4`
    <${ModalCard} accent=${contextInput ? "#f59e0b" : "#f0abfc"} icon=${contextInput ? "!" : "🔀"} title=${contextInput?.title || t4("modal.choiceTitle")} subtitle=${contextInput ? null : modal.question}>
      ${contextInput ? html4`
        <div class="modal-context-alert">
          <div class="modal-context-alert-title">当前任务已暂停</div>
          <div class="modal-context-alert-reason">${contextInput.reason}</div>
        </div>
        <div class="modal-context-status">
          <div class="modal-context-status-label">当前状态</div>
          <div>${contextInput.statusSummary}</div>
        </div>
        <div class="modal-context-recommendation"><strong>建议：</strong>${contextInput.recommendation}</div>
        <div class="modal-context-question">${modal.question}</div>
      ` : null}
      ${modal.options.map(
    (opt) => html4`
        <button
          key=${opt.id}
          class="modal-choice-row"
          onClick=${() => onResolve("choice", { kind: "pick", optionId: opt.id })}
        >
          <span class="modal-choice-id">${opt.id}</span>
          <span class="modal-choice-title">${opt.title}</span>
          ${opt.summary ? html4`<span class="modal-choice-summary">${opt.summary}</span>` : null}
        </button>
      `
  )}
      ${modal.allowCustom ? showCustom ? html4`
            <div class="modal-custom">
              <textarea
                placeholder=${t4("modal.typePlaceholder")}
                rows="2"
                value=${custom}
                onInput=${(e3) => setCustom(e3.target.value)}
              ></textarea>
              <div class="modal-actions">
                <button class="primary" onClick=${() => onResolve("choice", { kind: "custom", text: custom })} disabled=${!custom.trim()}>${t4("modal.send")}</button>
                <button onClick=${() => {
    setShowCustom(false);
    setCustom("");
  }}>${t4("common.back")}</button>
              </div>
            </div>
          ` : html4`
            <button class="modal-choice-row" onClick=${() => setShowCustom(true)}>
              <span class="modal-choice-id">·</span>
              <span class="modal-choice-title">${t4("modal.typeOwn")}</span>
              <span class="modal-choice-summary">${t4("modal.typeOwnSummary")}</span>
            </button>
          ` : null}
      <button class="modal-choice-row modal-choice-cancel" onClick=${() => onResolve("choice", { kind: "cancel" })}>
        <span class="modal-choice-id">×</span>
        <span class="modal-choice-title">${t4("modal.cancel")}</span>
        <span class="modal-choice-summary">${t4("modal.cancelSummary")}</span>
      </button>
    <//>
  `;
}
function PlanModal({ modal, onResolve }) {
  useLang();
  const [feedback, setFeedback] = d2("");
  const [refining, setRefining] = d2(false);
  return html4`
    <${ModalCard} accent="#67e8f9" icon="◆" title=${t4("modal.planTitle")} subtitle=${modal.summary || t4("modal.planSubtitle")}>
      <div class="md modal-plan-body" dangerouslySetInnerHTML=${{ __html: marked.parse(modal.plan || "") }}></div>
      ${modal.steps?.length ? html4`
        <div class="modal-plan-steps">
          ${modal.steps.map((s) => html4`
            <div class="modal-plan-step">
              <span class=${`modal-step-risk modal-step-risk-${s.risk || "low"}`}></span>
              <span class="modal-step-id">${s.id}</span>
              <span class="modal-step-title">${s.title}</span>
            </div>
          `)}
        </div>
      ` : null}
      ${refining ? html4`
          <textarea
            placeholder=${t4("modal.refinePlaceholder")}
            rows="3"
            value=${feedback}
            onInput=${(e3) => setFeedback(e3.target.value)}
          ></textarea>
          <div class="modal-actions">
            <button class="primary" disabled=${!feedback.trim()} onClick=${() => onResolve("plan", "refine", feedback)}>${t4("modal.sendRefinement")}</button>
            <button onClick=${() => {
    setRefining(false);
    setFeedback("");
  }}>${t4("common.back")}</button>
          </div>
        ` : html4`
          <div class="modal-actions">
            <button class="primary" onClick=${() => onResolve("plan", "approve")}>${t4("modal.approve")}</button>
            <button onClick=${() => setRefining(true)}>${t4("modal.refine")}</button>
            <button class="danger" onClick=${() => onResolve("plan", "cancel")}>${t4("modal.cancel")}</button>
          </div>
        `}
    <//>
  `;
}
function lineDiff(aLines, bLines) {
  const m3 = aLines.length;
  const n3 = bLines.length;
  const dp = Array.from({ length: m3 + 1 }, () => new Array(n3 + 1).fill(0));
  for (let i4 = 1; i4 <= m3; i4++) {
    for (let j5 = 1; j5 <= n3; j5++) {
      if (aLines[i4 - 1] === bLines[j5 - 1]) dp[i4][j5] = dp[i4 - 1][j5 - 1] + 1;
      else dp[i4][j5] = Math.max(dp[i4 - 1][j5], dp[i4][j5 - 1]);
    }
  }
  const out = [];
  let i3 = m3;
  let j4 = n3;
  while (i3 > 0 || j4 > 0) {
    if (i3 > 0 && j4 > 0 && aLines[i3 - 1] === bLines[j4 - 1]) {
      out.push({ kind: "context", text: aLines[i3 - 1] });
      i3--;
      j4--;
    } else if (j4 > 0 && (i3 === 0 || dp[i3][j4 - 1] >= dp[i3 - 1][j4])) {
      out.push({ kind: "ins", text: bLines[j4 - 1] });
      j4--;
    } else {
      out.push({ kind: "del", text: aLines[i3 - 1] });
      i3--;
    }
  }
  return out.reverse();
}
function pairDiffRows(diff) {
  const rows = [];
  let k3 = 0;
  while (k3 < diff.length) {
    const entry = diff[k3];
    if (entry.kind === "context") {
      rows.push({ left: entry.text, right: entry.text, kind: "context" });
      k3++;
      continue;
    }
    const dels = [];
    const inss = [];
    while (k3 < diff.length && diff[k3].kind === "del") {
      dels.push(diff[k3].text);
      k3++;
    }
    while (k3 < diff.length && diff[k3].kind === "ins") {
      inss.push(diff[k3].text);
      k3++;
    }
    const pairs = Math.max(dels.length, inss.length);
    for (let p3 = 0; p3 < pairs; p3++) {
      const dp = dels[p3];
      const ip = inss[p3];
      rows.push({
        left: dp ?? null,
        right: ip ?? null,
        kind: dp != null && ip != null ? "change" : dp != null ? "del" : "ins"
      });
    }
  }
  return rows;
}
function EditReviewModal({ modal, onResolve }) {
  useLang();
  const search = modal.search ?? "";
  const replace = modal.replace ?? "";
  const lang = langFromPath(modal.path);
  const aLines = search.split("\n");
  const bLines = replace.split("\n");
  const rows = pairDiffRows(lineDiff(aLines, bLines));
  return html4`
    <${ModalCard}
      accent="#86efac"
      icon="◆"
      title=${t4("modal.editTitle")}
      subtitle=${t4("modal.editSubtitle", { path: modal.path ?? "", remaining: modal.remaining, total: modal.total })}
    >
      <div class="edit-diff-wrap">
        <div class="edit-diff-head">
          <div class="edit-diff-side edit-diff-side-old">
            <span class="edit-diff-marker">−</span> ${t4("modal.before")}
          </div>
          <div class="edit-diff-side edit-diff-side-new">
            <span class="edit-diff-marker">+</span> ${t4("modal.after")}
          </div>
        </div>
        <div class="edit-diff-body">
          ${rows.map(
    (row, i3) => html4`
            <div key=${i3} class=${`edit-diff-row edit-diff-row-${row.kind}`}>
              <div class="edit-diff-cell edit-diff-cell-old">
                ${row.left != null ? html4`<span
                        class="edit-diff-line"
                        dangerouslySetInnerHTML=${{ __html: hlLine(row.left, lang) || "&nbsp;" }}
                      ></span>` : html4`<span class="edit-diff-empty">&nbsp;</span>`}
              </div>
              <div class="edit-diff-cell edit-diff-cell-new">
                ${row.right != null ? html4`<span
                        class="edit-diff-line"
                        dangerouslySetInnerHTML=${{ __html: hlLine(row.right, lang) || "&nbsp;" }}
                      ></span>` : html4`<span class="edit-diff-empty">&nbsp;</span>`}
              </div>
            </div>
          `
  )}
        </div>
      </div>
      <div class="modal-actions">
        <button class="primary" onClick=${() => onResolve("edit-review", "apply")}>${t4("chat.confirmBtn")}</button>
        <button onClick=${() => onResolve("edit-review", "reject")}>${t4("chat.rejectBtn")}</button>
        <button onClick=${() => onResolve("edit-review", "apply-rest-of-turn")}>${t4("chat.applyRestBtn")}</button>
      </div>
    <//>
  `;
}
function WorkspaceModal({ modal, onResolve }) {
  useLang();
  return html4`
    <${ModalCard}
      accent="#fbbf24"
      icon="◇"
      title=${t4("modal.workspaceTitle")}
      subtitle=${t4("modal.workspaceSubtitle")}
    >
      <div class="modal-cmd"><span class="modal-cmd-prompt">→</span> <code>${modal.path}</code></div>
      <div class="modal-actions">
        <button class="primary" onClick=${() => onResolve("workspace", "switch")}>${t4("modal.switchBtn")}</button>
        <button class="danger" onClick=${() => onResolve("workspace", "deny")}>${t4("modal.denyBtn")}</button>
      </div>
    <//>
  `;
}
function CheckpointModal({ modal, onResolve }) {
  useLang();
  const [reviseText, setReviseText] = d2("");
  const [staged, setStaged] = d2(false);
  const label = modal.title ? `${modal.stepId} \xB7 ${modal.title}` : modal.stepId;
  const counter = (modal.total ?? 0) > 0 ? ` (${modal.completed}/${modal.total})` : "";
  return html4`
    <${ModalCard}
      accent="#a5f3fc"
      icon="✓"
      title=${t4("modal.stepComplete", { counter })}
      subtitle=${label}
    >
      ${modal.result ? html4`<div class="modal-checkpoint-result">${modal.result}</div>` : null}
      ${modal.notes ? html4`<div class="modal-checkpoint-notes">${modal.notes}</div>` : null}
      ${staged ? html4`
          <textarea
            placeholder=${t4("modal.revisePlaceholder")}
            rows="3"
            value=${reviseText}
            onInput=${(e3) => setReviseText(e3.target.value)}
          ></textarea>
          <div class="modal-actions">
            <button class="primary" disabled=${!reviseText.trim()} onClick=${() => onResolve("checkpoint", "revise", reviseText)}>${t4("modal.sendRevision")}</button>
            <button onClick=${() => {
    setStaged(false);
    setReviseText("");
  }}>${t4("common.back")}</button>
          </div>
        ` : html4`
          <div class="modal-actions">
            <button class="primary" onClick=${() => onResolve("checkpoint", "continue")}>${t4("modal.continueBtn")}</button>
            <button onClick=${() => setStaged(true)}>${t4("modal.reviseBtn")}</button>
            <button class="danger" onClick=${() => onResolve("checkpoint", "stop")}>${t4("modal.stopBtn")}</button>
          </div>
        `}
    <//>
  `;
}
function PickerModal({
  modal,
  onResolve
}) {
  useLang();
  const [selectedId, setSelectedId] = d2(modal.items[0]?.id ?? null);
  const [query2, setQuery] = d2(modal.query ?? "");
  const [renameTarget, setRenameTarget] = d2(null);
  const [renameText, setRenameText] = d2("");
  const [showNew, setShowNew] = d2(false);
  const [newText, setNewText] = d2("");
  const has = (a3) => modal.actions.includes(a3);
  const selected = modal.items.find((i3) => i3.id === selectedId) ?? null;
  const submitRefine = (next) => {
    setQuery(next);
    if (has("refine")) onResolve("picker", { action: "refine", query: next });
  };
  const startRename = (id) => {
    const item = modal.items.find((i3) => i3.id === id);
    if (!item) return;
    setRenameTarget(id);
    setRenameText(item.title);
  };
  const sendRename = () => {
    if (!renameTarget || !renameText.trim()) return;
    onResolve("picker", { action: "rename", id: renameTarget, text: renameText });
    setRenameTarget(null);
    setRenameText("");
  };
  const sendNew = () => {
    onResolve("picker", newText.trim() ? { action: "new", text: newText } : { action: "new" });
    setShowNew(false);
    setNewText("");
  };
  return html4`
    <${ModalCard}
      accent="#fcd34d"
      icon="≡"
      title=${modal.title}
      subtitle=${modal.hint}
    >
      ${has("refine") ? html4`<input
              class="modal-picker-search"
              type="search"
              placeholder=${t4("modal.pickerFilter")}
              value=${query2}
              onInput=${(e3) => submitRefine(e3.target.value)}
            />` : null}
      <div class="modal-picker-list">
        ${modal.items.length === 0 ? html4`<div class="modal-picker-empty">${t4("modal.pickerEmpty")}</div>` : modal.items.map(
    (it) => html4`
                  <button
                    key=${it.id}
                    class=${`modal-picker-row${it.id === selectedId ? " selected" : ""}`}
                    onClick=${() => setSelectedId(it.id)}
                    onDblClick=${() => has("pick") && onResolve("picker", { action: "pick", id: it.id })}
                  >
                    <span class="modal-picker-title">${it.title}</span>
                    ${it.badge ? html4`<span class="modal-picker-badge">${it.badge}</span>` : null}
                    ${it.subtitle ? html4`<span class="modal-picker-subtitle">${it.subtitle}</span>` : null}
                    ${it.meta ? html4`<span class="modal-picker-meta">${it.meta}</span>` : null}
                  </button>
                `
  )}
      </div>
      ${modal.hasMore && has("load-more") ? html4`<button
              class="modal-picker-more"
              onClick=${() => onResolve("picker", { action: "load-more" })}
            >${t4("modal.pickerLoadMore")}</button>` : null}
      ${renameTarget ? html4`
            <div class="modal-picker-form">
              <input
                type="text"
                value=${renameText}
                onInput=${(e3) => setRenameText(e3.target.value)}
              />
              <div class="modal-actions">
                <button class="primary" onClick=${sendRename} disabled=${!renameText.trim()}>${t4("common.save")}</button>
                <button onClick=${() => setRenameTarget(null)}>${t4("common.back")}</button>
              </div>
            </div>
          ` : showNew ? html4`
              <div class="modal-picker-form">
                <input
                  type="text"
                  placeholder=${t4("modal.pickerNewPlaceholder")}
                  value=${newText}
                  onInput=${(e3) => setNewText(e3.target.value)}
                />
                <div class="modal-actions">
                  <button class="primary" onClick=${sendNew}>${t4("common.add")}</button>
                  <button onClick=${() => setShowNew(false)}>${t4("common.back")}</button>
                </div>
              </div>
            ` : html4`
              <div class="modal-actions">
                ${has("pick") && selected ? html4`<button
                        class="primary"
                        onClick=${() => onResolve("picker", { action: "pick", id: selected.id })}
                      >${t4("modal.pickerPick")}</button>` : null}
                ${has("install") && selected ? html4`<button
                        class="primary"
                        onClick=${() => onResolve("picker", { action: "install", id: selected.id })}
                      >${t4("modal.pickerInstall")}</button>` : null}
                ${has("uninstall") && selected ? html4`<button
                        onClick=${() => onResolve("picker", { action: "uninstall", id: selected.id })}
                      >${t4("modal.pickerUninstall")}</button>` : null}
                ${has("rename") && selected ? html4`<button onClick=${() => startRename(selected.id)}>${t4("modal.pickerRename")}</button>` : null}
                ${has("delete") && selected ? html4`<button
                        class="danger"
                        onClick=${() => onResolve("picker", { action: "delete", id: selected.id })}
                      >${t4("common.delete")}</button>` : null}
                ${has("new") ? html4`<button onClick=${() => setShowNew(true)}>${t4("modal.pickerNew")}</button>` : null}
                <button onClick=${() => onResolve("picker", { action: "cancel" })}>${t4("modal.cancel")}</button>
              </div>
            `}
    <//>
  `;
}
function ViewerModal({
  modal,
  onResolve
}) {
  useLang();
  return html4`
    <${ModalCard}
      accent="#67e8f9"
      icon="◇"
      title=${modal.title}
      subtitle=${modal.meta}
    >
      ${modal.steps && modal.steps.length > 0 ? html4`
            <ol class="modal-viewer-steps">
              ${modal.steps.map(
    (s3) => html4`
                  <li key=${s3.id} class=${`modal-viewer-step modal-viewer-step-${s3.status}`}>
                    <span class="modal-viewer-step-mark">${s3.status === "done" ? "\u2713" : "\xB7"}</span>
                    <span class="modal-viewer-step-title">${s3.title}</span>
                  </li>
                `
  )}
            </ol>
          ` : null}
      ${modal.body ? html4`<div class="md modal-viewer-body" dangerouslySetInnerHTML=${{ __html: marked.parse(modal.body) }}></div>` : null}
      <div class="modal-actions">
        <button onClick=${() => onResolve("viewer", { action: "close" })}>${t4("modal.viewerClose")}</button>
      </div>
    <//>
  `;
}
function RevisionModal({ modal, onResolve }) {
  useLang();
  const riskColor = (r3) => r3 === "high" ? "#f87171" : r3 === "med" ? "#fbbf24" : r3 === "low" ? "#86efac" : "#9ca3af";
  return html4`
    <${ModalCard}
      accent="#c4b5fd"
      icon="✎"
      title=${t4("modal.revisionTitle")}
      subtitle=${modal.summary || modal.reason}
    >
      <div class="modal-revise-reason">${modal.reason}</div>
      <ol class="modal-revise-steps">
        ${modal.remainingSteps.map(
    (s3) => html4`
            <li key=${s3.id}>
              <span class="modal-revise-dot" style=${`background:${riskColor(s3.risk)}`}></span>
              <span class="modal-revise-id">${s3.id}</span>
              <span class="modal-revise-title">${s3.title}</span>
              <span class="modal-revise-action">${s3.action}</span>
            </li>
          `
  )}
      </ol>
      <div class="modal-actions">
        <button class="primary" onClick=${() => onResolve("revision", "accept")}>${t4("modal.accept")}</button>
        <button class="danger" onClick=${() => onResolve("revision", "reject")}>${t4("modal.reject")}</button>
      </div>
    <//>
  `;
}

export {
  ChatMessage,
  CheckpointModal,
  ChoiceModal,
  EditReviewModal,
  ModalCard,
  PickerModal,
  PlanModal,
  RevisionModal,
  ShellModal,
  ToolCard,
  ViewerModal,
  WorkspaceModal,
  computeChatSearchMatches,
  parseToolArgs,
  renderMessageBody,
};
