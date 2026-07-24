// Recovered from the product bundle; types are tightened incrementally without changing behavior.
// @ts-nocheck
import { marked } from "marked";
import { createPortal as T2, memo as preactMemo } from "preact/compat";
import { useCallback as q2, useEffect as y2, useRef as A2, useState as d2 } from "preact/hooks";
import { ChatMessage, ToolCard, parseToolArgs } from "../components/chat-internals.js";
import { MODE, TOKEN, api, writeClipboardText } from "../lib/api.js";
import { appBus, requestChatMessageJump, showToast } from "../lib/bus.js";
import { QUICK_CAPS_USD, budgetTone, bumpSuggestions, deriveBudgetState } from "../lib/budget.js";
import { fmtBytes, fmtCompactNum, fmtCost, fmtNum, fmtPct, fmtRelativeTime, fmtUsd, primaryBalance } from "../lib/format.js";
import { html as html4 } from "../lib/html.js";
import { INTERVAL_PRESETS_MS, formatRemaining, parseCustomInterval } from "../lib/loop-control.js";
import { showArtifactPreview } from "../lib/markdown.js";
import { subscribeSse, usePoll } from "../lib/use-poll.js";
import { compareVersions } from "../lib/version.js";
import { t as t4, useLang } from "../i18n/index.js";
const N2: any = preactMemo;

function planStatus(p3) {
  if (p3.status) return p3.status;
  if (p3.completionRatio >= 1) return "done";
  if (p3.completionRatio > 0) return "active";
  return "idle";
}
function statusPill(p3) {
  const status = planStatus(p3);
  if (status === "done") return html4`<span class="pill ok">${t4("plans.done")}</span>`;
  if (status === "active") return html4`<span class="pill info">${t4("plans.active")}</span>`;
  if (status === "pending") return html4`<span class="pill warn">${t4("plans.pending")}</span>`;
  return html4`<span class="pill">${t4("plans.idle")}</span>`;
}
function PlansPanel() {
  useLang();
  const { data, error, loading, reload } = usePoll("/plans", 8e3);
  const [openIdx, setOpenIdx] = d2(null);
  const [filter, setFilter] = d2("");
  const [statusFilter, setStatusFilter] = d2("all");
  const [deleting, setDeleting] = d2(false);
  const deletePlan = q2(async (path) => {
    setDeleting(true);
    try {
      await api("/plans", { method: "DELETE", body: { path } });
      setOpenIdx(null);
      await reload();
    } catch (err) {
      alert(err.message);
    } finally { setDeleting(false); }
  }, [reload]);
  const completeStep = q2(async (stepId) => {
    setDeleting(true);
    try {
      await api("/plans/active/step", { method: "POST", body: { stepId } });
      await reload();
    } catch (err) {
      alert(err.message);
    } finally { setDeleting(false); }
  }, [reload]);
  const cancelActivePlan = q2(async () => {
    setDeleting(true);
    try {
      await api("/plans", { method: "DELETE", body: { active: true } });
      setOpenIdx(null);
      await reload();
    } catch (err) {
      alert(err.message);
    } finally { setDeleting(false); }
  }, [reload]);
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("plans.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "plans", error: error.message })}</div>`;
  const plans = data?.plans ?? [];
  if (plans.length === 0)
    return html4`<div class="card" style="color:var(--fg-3)">
      ${t4("plans.noPlans")}
    </div>`;
  const activePlans = plans.filter((p3) => ["active", "pending", "idle"].includes(planStatus(p3)));
  const donePlans = plans.filter((p3) => planStatus(p3) === "done");
  const statusFiltered = statusFilter === "all" ? plans : statusFilter === "active" ? activePlans : donePlans;
  const filtered = filter.trim() ? statusFiltered.filter(
    (p3) => p3.session.toLowerCase().includes(filter.toLowerCase()) || (p3.summary ?? "").toLowerCase().includes(filter.toLowerCase())
  ) : statusFiltered;
  const open = openIdx !== null ? plans[openIdx] : null;
  return html4`
    <div class="sessions-grid">
      <div class="sessions-list">
        <div class="ssl-h">
          <input
            type="text"
            placeholder=${t4("plans.filterPlaceholder")}
            value=${filter}
            onInput=${(e3) => setFilter(e3.target.value)}
            style="flex:1"
          />
        </div>
        <div class="chips" style="padding:0 12px 8px">
          <span
            class=${`chip-f ${statusFilter === "all" ? "active" : ""}`}
            onClick=${() => setStatusFilter("all")}
          >${t4("common.all")} <span class="ct">${plans.length}</span></span>
          <span
            class=${`chip-f ${statusFilter === "active" ? "active" : ""}`}
            onClick=${() => setStatusFilter("active")}
          >
            ${t4("plans.active")}
            <span class="ct">${activePlans.length}</span>
          </span>
          <span
            class=${`chip-f ${statusFilter === "done" ? "active" : ""}`}
            onClick=${() => setStatusFilter("done")}
          >
            ${t4("plans.done")} <span class="ct">${donePlans.length}</span>
          </span>
        </div>
        <div class="ssl-rows">
          ${filtered.map((p3) => {
    const idx = plans.indexOf(p3);
    const sel = idx === openIdx;
    return html4`
              <div class=${`ssl-row ${sel ? "sel" : ""}`} onClick=${() => setOpenIdx(idx)}>
                <span class="name">${p3.summary ?? p3.session} ${statusPill(p3)}</span>
                ${p3.summary && p3.session !== p3.summary ? html4`<span class="preview">${p3.session}</span>` : null}
                <span class="meta">
                  <span><span class="v">${p3.totalSteps}</span> ${t4("plans.steps")}</span>
                  <span><span class="v">${p3.completedSteps} / ${p3.totalSteps}</span> · ${fmtPct(p3.completionRatio)}</span>
                  <span>${fmtRelativeTime(p3.completedAt ?? p3.updatedAt)}</span>
                </span>
              </div>
            `;
  })}
        </div>
      </div>

      <div class="sessions-detail">
        ${open == null ? html4`<div style="color:var(--fg-3);font-size:13px;text-align:center;padding:60px 20px">
                ${t4("plans.pickHint")}
              </div>` : html4`
                <div class="sessions-detail-h">
                  <span class="name">${open.summary ?? t4("plans.noTitle")}</span>
                  <span class="ws">${open.session} · ${fmtRelativeTime(open.completedAt ?? open.updatedAt)}</span>
                  <span class="actions">
                    <button class="btn ghost" onClick=${() => setOpenIdx(null)}>${t4("common.back")}</button>
                    ${planStatus(open) === "done" ? html4`<button class="btn danger" disabled=${deleting || !open.path} onClick=${() => { if (confirm(t4("plans.confirmDelete"))) deletePlan(open.path); }}>${t4("common.delete")}</button>` : html4`<button class="btn danger" disabled=${deleting} onClick=${() => { if (confirm(t4("plans.confirmCancel"))) cancelActivePlan(); }}>${t4("plans.cancelActive")}</button>`}
                  </span>
                </div>

                ${open.body ? html4`
                  <h3 style="margin:0 0 6px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
                    ${t4("plans.planBody")}
                  </h3>
                  <div class="md modal-plan-body" style="margin-bottom:14px" dangerouslySetInnerHTML=${{ __html: marked.parse(open.body) }}></div>
                ` : null}

                <h3 style="margin:0 0 6px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
                  ${t4("plans.stepTimeline", { done: open.completedSteps, total: open.totalSteps })}
                </h3>
                <div class="plan-timeline" style="margin-bottom:14px">
                  ${open.steps.map((step, i3) => {
    const done = open.completedStepIds.includes(step.id);
    const cls = done ? "done" : i3 === open.completedSteps ? "active" : "";
    return html4`
                      <div class=${`plan-step ${cls}`}>
                        <span class="lbl">${t4("plans.step", { n: i3 + 1 })}</span>
                        <span class="name">${step.title}</span>
                        ${step.action ? html4`<span class="meta">${step.action}</span>` : null}
                        ${step.risk ? html4`<span
                                class=${`pill ${step.risk === "high" ? "err" : step.risk === "medium" ? "warn" : ""}`}
                                style="align-self:flex-start;margin-top:4px"
                              >${step.risk}</span>` : null}
                        ${planStatus(open) === "active" && !done ? html4`<button class="btn ghost" disabled=${deleting} style="align-self:flex-start;margin-top:6px" onClick=${(ev) => { ev.stopPropagation(); completeStep(step.id); }}>${t4("plans.markDone")}</button>` : null}
                      </div>
                    `;
  })}
                </div>
              `}
      </div>
    </div>
  `;
}

export { PlansPanel, planStatus, statusPill };
