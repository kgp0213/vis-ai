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

function SkillsPanel() {
  useLang();
  const [data, setData] = d2(null);
  const [error, setError] = d2(null);
  const [open, setOpen] = d2(null);
  const [body, setBody] = d2("");
  const [busy, setBusy] = d2(false);
  const [info, setInfo] = d2(null);
  const [newName, setNewName] = d2("");
  const [newScope, setNewScope] = d2("global");
  const [repairInfo, setRepairInfo] = d2(null);
  const [filter, setFilter] = d2("");
  const [scopeFilter, setScopeFilter] = d2("all");
  const load = q2(async () => {
    try {
      setData(await api("/skills"));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  const openSkill = q2(async (scope, name) => {
    setOpen({ scope, name });
    if (scope === "builtin") {
      setBody("");
      return;
    }
    setBusy(true);
    try {
      const r3 = await api(`/skills/${scope}/${encodeURIComponent(name)}`);
      setBody(r3.body);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);
  const save = q2(async () => {
    if (!open) return;
    setBusy(true);
    try {
      await api(`/skills/${open.scope}/${encodeURIComponent(open.name)}`, {
        method: "POST",
        body: { body }
      });
      setInfo(t4("skills.saved", { scope: open.scope, name: open.name }));
      setTimeout(() => setInfo(null), 3e3);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, body, load]);
  const remove = q2(async () => {
    if (!open) return;
    if (!confirm(t4("skills.deleteConfirm", { scope: open.scope, name: open.name }))) return;
    setBusy(true);
    try {
      const result = await api(`/skills/${open.scope}/${encodeURIComponent(open.name)}`, { method: "DELETE" });
      if (result.disabledBuiltin) {
        setInfo(t4("skills.disabledBuiltin"));
        setTimeout(() => setInfo(null), 4e3);
      }
      setOpen(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, load]);
  const create = q2(async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const stub = `---
name: ${newName.trim()}
description: TODO \u2014 one-line description that helps the model match this skill
---

# ${newName.trim()}

`;
    try {
      await api(`/skills/${newScope}/${encodeURIComponent(newName.trim())}`, {
        method: "POST",
        body: { body: stub }
      });
      setNewName("");
      await load();
      openSkill(newScope, newName.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [newName, newScope, load, openSkill]);
  const repairEnvironment = q2(async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/skills/repair", { method: "POST" });
      await load();
      setRepairInfo(t4("skills.repairOk"));
      setTimeout(() => setRepairInfo(null), 4e3);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [load]);
  if (!data && !error)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("skills.loading")}</div>`;
  if (error && !data) return html4`<div class="card accent-err">${error}</div>`;
  if (!data) return null;
  const allWith = [
    ...data.project.map((s3) => ({ scope: "project", ...s3 })),
    ...data.global.map((s3) => ({ scope: "global", ...s3 })),
    ...data.builtin.map((s3) => ({ scope: "builtin", ...s3 }))
  ];
  const scopeFiltered = scopeFilter === "all" ? allWith : allWith.filter((s3) => s3.scope === scopeFilter);
  const filtered = filter.trim() ? scopeFiltered.filter(
    (s3) => s3.name.toLowerCase().includes(filter.toLowerCase()) || (s3.description ?? "").toLowerCase().includes(filter.toLowerCase())
  ) : scopeFiltered;
  return html4`
    <div class="sessions-grid">
      <div class="sessions-list">
        <div class="ssl-h">
          <input
            type="text"
            placeholder=${t4("skills.filterPlaceholder")}
            value=${filter}
            onInput=${(e3) => setFilter(e3.target.value)}
            style="flex:1"
          />
        </div>
        <div class="chips" style="padding:0 12px 8px">
          <span
            class=${`chip-f ${scopeFilter === "all" ? "active" : ""}`}
            onClick=${() => setScopeFilter("all")}
          >${t4("common.all")} <span class="ct">${allWith.length}</span></span>
          <span
            class=${`chip-f ${scopeFilter === "project" ? "active" : ""}`}
            onClick=${() => setScopeFilter("project")}
          >${t4("skills.project")} <span class="ct">${data.project.length}</span></span>
          <span
            class=${`chip-f ${scopeFilter === "global" ? "active" : ""}`}
            onClick=${() => setScopeFilter("global")}
          >${t4("skills.global")} <span class="ct">${data.global.length}</span></span>
          <span
            class=${`chip-f ${scopeFilter === "builtin" ? "active" : ""}`}
            onClick=${() => setScopeFilter("builtin")}
          >${t4("skills.builtin")} <span class="ct">${data.builtin.length}</span></span>
        </div>

        <div style="padding:0 12px 8px;display:flex;gap:6px;flex-wrap:wrap">
          <select
            value=${newScope}
            onChange=${(e3) => setNewScope(e3.target.value)}
            style="flex:0 0 auto;font-size:11.5px;padding:5px 6px"
          >
            <option value="global">${t4("skills.global")}</option>
            ${data.paths.project ? html4`<option value="project">${t4("skills.project")}</option>` : null}
          </select>
          <input
            type="text"
            placeholder=${t4("skills.newSkill")}
            value=${newName}
            onInput=${(e3) => setNewName(e3.target.value)}
            style="flex:1;min-width:0"
          />
          <button class="btn primary" disabled=${busy || !newName.trim()} onClick=${create} style="flex:0 0 auto">+</button>
          <button class="btn" disabled=${busy} onClick=${repairEnvironment} style="flex:0 0 auto">${t4("skills.repairEnv")}</button>
        </div>
        ${repairInfo ? html4`<div style="padding:0 12px 8px"><span class="pill ok">${repairInfo}</span></div>` : null}
        ${info ? html4`<div style="padding:0 12px 8px"><span class="pill ok">${info}</span></div>` : null}
        ${error ? html4`<div class="notice err" style="margin:0 12px 8px">${error}</div>` : null}

        <div class="ssl-rows">
          ${filtered.map((s3) => {
    const sel = open?.scope === s3.scope && open?.name === s3.name;
    return html4`
              <div
                class=${`ssl-row ${sel ? "sel" : ""}`}
                onClick=${() => openSkill(s3.scope, s3.name)}
              >
                <span class="name">
                  ${s3.name}
                  ${s3.managedBuiltin ? html4`<span class="pill">${t4("skills.managedBuiltin")}</span>` : null}
                  ${s3.scope === "builtin" ? html4`<span class="pill">${t4("skills.builtin")}</span>` : null}
                </span>
                <span class="preview">${s3.description ?? t4("skills.noDescription")}</span>
                <span class="meta">
                  ${typeof s3.runs7d === "number" && s3.runs7d > 0 ? html4`<span><span class="v">${s3.runs7d}</span> ${t4("skills.runs7d")}</span>` : null}
                  <span class="dim">${s3.scope}</span>
                </span>
              </div>
            `;
  })}
        </div>
      </div>

      <div class="sessions-detail">
        ${open == null ? html4`<div style="color:var(--fg-3);font-size:13px;text-align:center;padding:60px 20px">
                ${t4("skills.pickHint")}
              </div>` : open.scope === "builtin" ? (() => {
    const builtin = data.builtin.find((b2) => b2.name === open.name);
    return html4`
                    <div class="sessions-detail-h">
                      <span class="name">${open.scope}/${open.name}</span>
                      <span class="ws"><span class="pill">${t4("skills.readOnlyBuiltin")}</span></span>
                      <span class="actions">
                        <button class="btn ghost" onClick=${() => setOpen(null)}>${t4("common.back")}</button>
                      </span>
                    </div>
                    <div style="color:var(--fg-2);font-size:13px;line-height:1.6">
                      ${builtin?.description ?? t4("skills.noDescription")}
                    </div>
                    <div style="margin-top:14px;color:var(--fg-3);font-size:11.5px">
                      ${t4("skills.builtinDesc")}
                    </div>
                  `;
  })() : html4`
                <div class="sessions-detail-h">
                  <span class="name">${open.scope}/${open.name}</span>
                  <span class="ws">${body.length.toLocaleString()} chars</span>
                  <span class="actions">
                    <button class="btn primary" disabled=${busy} onClick=${save}>${t4("common.save")}</button>
                    <button class="btn" disabled=${busy} onClick=${remove}
                      style="border-color:var(--c-err);color:var(--c-err)">${t4("common.delete")}</button>
                    <button class="btn ghost" onClick=${() => setOpen(null)}>${t4("common.back")}</button>
                  </span>
                </div>
                ${info ? html4`<div style="margin-bottom:8px"><span class="pill ok">${info}</span></div>` : null}
                ${error ? html4`<div class="card accent-err" style="margin-bottom:8px">${error}</div>` : null}
                <textarea
                  style="width:100%;min-height:520px;background:var(--bg-input);color:var(--fg-0);border:1px solid var(--bd);border-radius:var(--r);padding:12px;font-family:var(--font-mono);font-size:13px;line-height:1.55;resize:vertical"
                  value=${body}
                  onInput=${(e3) => setBody(e3.target.value)}
                  disabled=${busy}
                ></textarea>
                <div style="margin-top:8px;color:var(--fg-3);font-size:11.5px">
                  ${t4("skills.reloadHint")}
                </div>
              `}
      </div>
    </div>
  `;
}

export { SkillsPanel };
