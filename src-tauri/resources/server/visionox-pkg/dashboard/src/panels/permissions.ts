// Recovered from the product bundle; types are tightened incrementally without changing behavior.
// @ts-nocheck
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

function groupByVerb(list2) {
  const groups = /* @__PURE__ */ new Map();
  for (const entry of list2) {
    const sp = entry.indexOf(" ");
    const verb = sp > 0 ? entry.slice(0, sp) : entry;
    const tail = sp > 0 ? entry.slice(sp + 1) : "";
    const arr = groups.get(verb) ?? [];
    arr.push(tail);
    groups.set(verb, arr);
  }
  return [...groups.entries()];
}
function PermissionsPanel() {
  useLang();
  const { data, error, loading, refresh } = usePoll("/permissions", 5e3);
  const [draft, setDraft] = d2("");
  const [busy, setBusy] = d2(false);
  const [feedback, setFeedback] = d2(null);
  const add = q2(async () => {
    const prefix = draft.trim();
    if (!prefix) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api("/permissions", {
        method: "POST",
        body: { prefix }
      });
      if (res.alreadyPresent) setFeedback({ kind: "info", text: t4("permissions.alreadyIn", { prefix }) });
      else setFeedback({ kind: "ok", text: t4("permissions.added", { prefix }) });
      setDraft("");
      await refresh();
    } catch (err) {
      setFeedback({ kind: "err", text: err.message });
    } finally {
      setBusy(false);
    }
  }, [draft, refresh]);
  const remove = q2(
    async (prefix) => {
      if (!confirm(t4("permissions.removeConfirm", { prefix }))) return;
      setBusy(true);
      setFeedback(null);
      try {
        await api("/permissions", { method: "DELETE", body: { prefix } });
        setFeedback({ kind: "ok", text: t4("permissions.removed", { prefix }) });
        await refresh();
      } catch (err) {
        setFeedback({ kind: "err", text: err.message });
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );
  const clearAll = q2(async () => {
    if (!confirm(t4("permissions.clearConfirm"))) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api("/permissions/clear", {
        method: "POST",
        body: { confirm: true }
      });
      setFeedback({
        kind: "ok",
        text: t4("permissions.cleared", { count: res.dropped, y: res.dropped === 1 ? "y" : "ies" })
      });
      await refresh();
    } catch (err) {
      setFeedback({ kind: "err", text: err.message });
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("permissions.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "permissions", error: error.message })}</div>`;
  if (!data) return null;
  const p3 = data;
  const feedbackPill = feedback ? html4`<span
        class=${`pill ${feedback.kind === "err" ? "err" : feedback.kind === "ok" ? "ok" : "warn"}`}
      >${feedback.text}</span>` : null;
  return html4`
    <div style="display:flex;flex-direction:column;gap:14px">
      ${p3.editMode === "admin" ? html4`<div class="card accent-err">
              <div class="card-h"><span class="title" style="color:var(--c-err)">Admin \u6A21\u5F0F</span></div>
              <div class="card-b">
                \u6240\u6709\u5B89\u5168\u9650\u5236\u5DF2\u79FB\u9664\u3002\u6A21\u578B\u53EF\u6267\u884C\u4EFB\u610F Shell \u547D\u4EE4\u5E76\u8BBF\u95EE\u78C1\u76D8\u4EFB\u610F\u4F4D\u7F6E\u7684\u6587\u4EF6\u3002
              </div>
            </div>` : null}
      ${p3.editMode === "yolo" ? html4`<div class="card accent-warn">
              <div class="card-h"><span class="title" style="color:var(--c-warn)">${t4("permissions.yoloTitle")}</span></div>
              <div class="card-b">
                ${t4("permissions.yoloDesc")}
              </div>
            </div>` : null}

      <div class="chips">
        <span class="chip-f static active">${t4("permissions.project")} <span class="ct">${p3.project.length}</span></span>
        <span class="chip-f static">${t4("permissions.builtin")} <span class="ct">${p3.builtin.length}</span></span>
      </div>

      ${p3.currentCwd ? html4`
            <div class="card">
              <div class="card-h">
                <span class="title">${t4("permissions.addPrefix")}</span>
                <span class="meta">${p3.currentCwd}</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <input
                  type="text"
                  placeholder=${t4("permissions.addPlaceholder")}
                  value=${draft}
                  onInput=${(e3) => setDraft(e3.target.value)}
                  onKeyDown=${(e3) => {
    if (e3.key === "Enter") add();
  }}
                  disabled=${busy}
                  style="flex:1"
                />
                <button class="primary" onClick=${add} disabled=${busy || !draft.trim()}>${t4("common.add")}</button>
                <button
                  class="danger"
                  onClick=${clearAll}
                  disabled=${busy || p3.project.length === 0}
                >${t4("permissions.clearAll")}</button>
              </div>
              ${feedbackPill ? html4`<div style="margin-top:8px">${feedbackPill}</div>` : null}
            </div>
          ` : html4`
            <div class="card accent-warn">
              <div class="card-b">
                ${t4("permissions.standaloneWarning")}
              </div>
            </div>
          `}

      <h3 style="margin:6px 0 0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
        ${t4("permissions.projectAllowlist", { count: p3.project.length })}
      </h3>
      ${p3.project.length === 0 ? html4`<div class="card" style="color:var(--fg-3)">${t4("permissions.nothingStored")}</div>` : html4`
            <div class="card" style="padding:0;overflow:hidden">
              <table class="tbl">
                <thead>
                  <tr>
                    <th style="width:48px">${t4("permissions.colNum")}</th>
                    <th>${t4("permissions.colPrefix")}</th>
                    <th style="width:120px"></th>
                  </tr>
                </thead>
                <tbody>
                  ${p3.project.map(
    (prefix, i3) => html4`
                      <tr>
                        <td class="dim">${i3 + 1}</td>
                        <td><code class="mono">${prefix}</code></td>
                        <td>
                          ${p3.currentCwd ? html4`<button
                                  class="danger"
                                  onClick=${() => remove(prefix)}
                                  disabled=${busy}
                                >${t4("common.remove")}</button>` : null}
                        </td>
                      </tr>
                    `
  )}
                </tbody>
              </table>
            </div>
          `}

      <h3 style="margin:6px 0 0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
        ${t4("permissions.builtinTitle", { count: p3.builtin.length })}
      </h3>
      <div class="card" style="font-family:var(--font-mono);font-size:11.5px;line-height:1.8">
        ${groupByVerb(p3.builtin).map(
    ([verb, list2]) => html4`
            <div style="margin-bottom:4px">
              <span class="pill" style="margin-right:6px">${verb}</span>
              <span style="color:var(--fg-2)">${list2.join(" \xB7 ")}</span>
            </div>
          `
  )}
      </div>
    </div>
  `;
}

export { PermissionsPanel };
