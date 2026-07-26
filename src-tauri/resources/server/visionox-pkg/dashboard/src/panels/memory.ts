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
import { Select } from "../ui/index.js";
const N2: any = preactMemo;

function soulSectionValue(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(markdown ?? "").match(new RegExp(`^## ${escaped}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"))?.[1]?.trim() ?? "";
}
function updateSoulSection(markdown, heading, value) {
  const source = String(markdown ?? "").trim();
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = `## ${heading}\n${String(value ?? "").trim()}`;
  const re = new RegExp(`^## ${escaped}\\s*\\n[\\s\\S]*?(?=^## |(?![\\s\\S]))`, "m");
  return re.test(source) ? source.replace(re, `${block}\n\n`).trim() : `${source}\n\n${block}`.trim();
}
function MemoryPanel() {
  useLang();
  const [tree, setTree] = d2(null);
  const [error, setError] = d2(null);
  const [open, setOpen] = d2(null);
  const [draft, setDraft] = d2(null);
  const [baseline, setBaseline] = d2("");
  const [busy, setBusy] = d2(false);
  const [info, setInfo] = d2(null);
  const [scopeFilter, setScopeFilter] = d2("all");
  const [query, setQuery] = d2("");
  const [createOpen, setCreateOpen] = d2(false);
  const [newScope, setNewScope] = d2("global");
  const [newMode, setNewMode] = d2("general");
  const [modeFilter, setModeFilter] = d2("all");
  const [selectedModeKeys, setSelectedModeKeys] = d2([]);
  const [soulEditorMode, setSoulEditorMode] = d2("basic");
  const [soulPreview, setSoulPreview] = d2(null);
  const [newDesc, setNewDesc] = d2("");
  const [newBody, setNewBody] = d2("");
  const [newPriority, setNewPriority] = d2("medium");
  const load = q2(async () => {
    try {
      setTree(await api("/memory"));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  const dirty = draft != null && JSON.stringify(draft) !== baseline;
  const acceptNavigation = () => !dirty || globalThis.confirm(t4("memPanel.unsavedConfirm"));
  const showInfo = (message) => {
    setInfo(message);
    setTimeout(() => setInfo(null), 3e3);
  };
  const selectItem = q2(async (item) => {
    if (!acceptNavigation()) return;
    setBusy(true);
    setError(null);
    try {
      let next;
      if (item.kind === "persistent") {
        const result = await api(`/memory/${item.apiScope}/${encodeURIComponent(item.name)}`);
        next = { ...item, ...result.entry, content: result.entry?.body ?? "", revision: result.revision };
      } else if (item.kind === "mode") {
        next = { ...item, content: item.text, keywordsText: (item.keywords ?? []).join(", "), targetMode: item.modeId };
      } else if (item.kind === "soul") {
        const result = await api("/memory/soul");
        next = { ...item, content: result.body ?? "", aiName: result.name ?? "", path: result.path, revision: result.revision, history: result.history ?? [], maxChars: result.maxChars ?? 16e3 };
        setSoulPreview(null);
      } else if (item.kind === "trash") {
        next = { ...item, content: item.kindType === "mode" ? item.item?.text ?? "" : item.raw ?? "" };
      } else {
        next = { ...item, content: item.body ?? "" };
      }
      const serialized = JSON.stringify(next);
      setOpen(item);
      setDraft(next);
      setBaseline(serialized);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [dirty, baseline]);
  const save = q2(async () => {
    if (!open || !draft || open.kind === "session" || open.kind === "trash") return;
    setBusy(true);
    setError(null);
    try {
      let savedDraft = draft;
      let moved = false;
      if (open.kind === "soul") {
        await api("/memory/soul", { method: "POST", body: { body: draft.content, aiName: draft.aiName, expectedRevision: draft.revision } });
        const result = await api("/memory/soul");
        savedDraft = { ...draft, content: result.body ?? "", aiName: result.name ?? "", path: result.path, revision: result.revision, history: result.history ?? [], maxChars: result.maxChars ?? 16e3 };
        setDraft(savedDraft);
        setSoulPreview(null);
      } else if (open.kind === "persistent") {
        const body = [
          "---",
          `name: ${open.name}`,
          `description: ${String(draft.description ?? "").replace(/\r?\n/g, " ")}`,
          `type: ${draft.type ?? "user"}`,
          `scope: ${open.apiScope === "global" ? "global" : "project"}`,
          `created: ${draft.createdAt || new Date().toISOString().slice(0, 10)}`,
          `priority: ${draft.priority ?? "medium"}`,
          "---",
          "",
          String(draft.content ?? "").trim(),
          "",
        ].join("\n");
        const result = await api(`/memory/${open.apiScope}/${encodeURIComponent(open.name)}`, { method: "POST", body: { body, overwrite: true, expectedRevision: draft.revision } });
        savedDraft = { ...draft, revision: result.revision };
        setDraft(savedDraft);
      } else {
        const keywords = String(draft.keywordsText ?? "").split(/[,\s，]+/).map((value) => value.trim()).filter(Boolean).slice(0, 8);
        const payload = { text: draft.content, keywords, priority: Number(draft.priority), enabled: draft.enabled !== false };
        if (draft.targetMode && draft.targetMode !== open.modeId) {
          await api(`/mode-memory/${encodeURIComponent(open.name)}/move`, { method: "POST", body: { mode: open.modeId, targetMode: draft.targetMode, copy: false } });
          moved = true;
          setOpen(null);
          setDraft(null);
          setBaseline("");
        } else {
          await api(`/mode-memory/${encodeURIComponent(open.name)}`, { method: "PATCH", body: { ...payload, mode: open.modeId } });
        }
      }
      if (!moved) setBaseline(JSON.stringify(savedDraft));
      showInfo(moved ? t4("memPanel.moved") : t4("memPanel.saved"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, draft, load]);
  const createMemory = q2(async () => {
    const desc = newDesc.trim();
    const content = newBody.trim();
    if (newScope === "mode") {
      if (!content) return;
      setBusy(true);
      setError(null);
      try {
        const priority = newPriority === "high" ? 90 : newPriority === "low" ? 10 : 50;
        await api("/mode-memory", { method: "POST", body: { mode: newMode, text: content, priority, keywords: [] } });
        setNewBody("");
        setNewPriority("medium");
        setCreateOpen(false);
        showInfo(t4("memPanel.sceneAdded"));
        await load();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!desc || !content) return;
    const name = `memory-${Date.now().toString(36)}`;
    const scope = newScope === "project-mem" ? "project-mem" : "global";
    const memoryBody = [
      "---",
      `name: ${name}`,
      `description: ${desc.replace(/\r?\n/g, " ")}`,
      "type: user",
      `scope: ${scope === "project-mem" ? "project" : "global"}`,
      `created: ${new Date().toISOString().slice(0, 10)}`,
      `priority: ${newPriority}`,
      "---",
      "",
      content,
      "",
    ].join("\n");
    setBusy(true);
    setError(null);
    try {
      await api(`/memory/${scope}/${encodeURIComponent(name)}`, { method: "POST", body: { body: memoryBody } });
      setNewDesc("");
      setNewBody("");
      setNewPriority("medium");
      setCreateOpen(false);
      showInfo(t4("memPanel.longTermAdded"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [newScope, newMode, newDesc, newBody, newPriority, load]);
  const remove = q2(async () => {
    if (!open || !draft) return;
    const label = draft.description || draft.text || draft.name;
    const prompt = open.kind === "persistent" || open.kind === "mode" ? t4("memPanel.trashMoveConfirm", { label, days: tree?.trash?.retentionDays ?? 30 }) : t4("memPanel.deleteConfirm", { label });
    if (!globalThis.confirm(prompt)) return;
    setBusy(true);
    setError(null);
    try {
      const path = open.kind === "persistent" ? `/memory/${open.apiScope}/${encodeURIComponent(open.name)}`
        : open.kind === "mode" ? `/mode-memory/${encodeURIComponent(open.name)}`
        : `/memory/session/${encodeURIComponent(open.name)}`;
      await api(path, { method: "DELETE", body: open.kind === "mode" ? { mode: open.modeId } : void 0 });
      setOpen(null);
      setDraft(null);
      setBaseline("");
      showInfo(t4("memPanel.deleted"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, draft, load]);
  const copyModeMemory = q2(async () => {
    if (!open || open.kind !== "mode" || !draft?.targetMode) return;
    if (draft.targetMode === open.modeId) {
      setError(t4("memPanel.pickOtherScene"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/mode-memory/${encodeURIComponent(open.name)}/move`, { method: "POST", body: { mode: open.modeId, targetMode: draft.targetMode, copy: true } });
      showInfo(t4("memPanel.sceneCopied"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, draft, load]);
  const batchModeMemories = q2(async (action) => {
    if (!tree || selectedModeKeys.length === 0) return;
    if (action === "delete" && !globalThis.confirm(t4("memPanel.batchDeleteConfirm", { count: selectedModeKeys.length }))) return;
    const selected = new Set(selectedModeKeys);
    const items = (tree.modeMemory?.modes ?? []).flatMap((mode) => (mode.items ?? []).map((item) => ({ ...item, modeId: mode.id }))).filter((item) => selected.has(`${item.modeId}:${item.id}`));
    setBusy(true);
    setError(null);
    try {
      await api("/mode-memory/batch", { method: "POST", body: { action, items: items.map((item) => ({ mode: item.modeId, id: item.id })) } });
      setSelectedModeKeys([]);
      showInfo(action === "delete" ? t4("memPanel.batchDeleted") : action === "enable" ? t4("memPanel.batchEnabled") : t4("memPanel.batchDisabled"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [tree, selectedModeKeys, load]);
  const applyMemoryNow = q2(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api("/memory/apply", { method: "POST", body: {} });
      if (result.applied === false) throw new Error(result.error || t4("memPanel.applyFailed"));
      showInfo(t4("memPanel.applied"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [load]);
  const previewSoul = q2(async () => {
    if (!draft || open?.kind !== "soul") return;
    setBusy(true);
    setError(null);
    try {
      setSoulPreview(await api("/memory/soul/preview", { method: "POST", body: { body: draft.content, aiName: draft.aiName } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, draft]);
  const restoreSoulVersion = q2(async (id) => {
    if (!globalThis.confirm(t4("memPanel.soulRestoreConfirm"))) return;
    setBusy(true);
    try {
      await api(`/memory/soul/history/${encodeURIComponent(id)}/restore`, { method: "POST", body: {} });
      const result = await api("/memory/soul");
      const next = { ...draft, content: result.body ?? "", aiName: result.name ?? "", revision: result.revision, history: result.history ?? [] };
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setSoulPreview(null);
      showInfo(t4("memPanel.soulRestored"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [draft, load]);
  const resetSoul = q2(async () => {
    if (!globalThis.confirm(t4("memPanel.soulResetConfirm"))) return;
    setBusy(true);
    try {
      await api("/memory/soul/reset", { method: "POST", body: {} });
      const result = await api("/memory/soul");
      const next = { ...draft, content: result.body ?? "", aiName: result.name ?? "", revision: result.revision, history: result.history ?? [] };
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setSoulPreview(null);
      showInfo(t4("memPanel.soulResetDone"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [draft, load]);
  const restoreTrash = q2(async () => {
    if (!open || open.kind !== "trash") return;
    setBusy(true);
    setError(null);
    try {
      await api(`/memory/trash/${encodeURIComponent(open.name)}/restore`, { method: "POST", body: {} });
      setOpen(null);
      setDraft(null);
      setBaseline("");
      showInfo(t4("memPanel.trashRestored"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, load]);
  const permanentlyDeleteMemoryTrash = q2(async () => {
    if (!open || open.kind !== "trash") return;
    const label = draft?.description || draft?.name || open.name;
    if (!globalThis.confirm(t4("memPanel.permanentDeleteConfirm", { label }))) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/memory/trash/${encodeURIComponent(open.name)}`, { method: "DELETE", body: {} });
      setOpen(null);
      setDraft(null);
      setBaseline("");
      showInfo(t4("memPanel.permanentDeleted"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, draft, load]);
  const emptyMemoryTrash = q2(async () => {
    const count = tree?.trash?.total ?? tree?.trash?.items?.length ?? 0;
    const invalidCount = tree?.trash?.invalidCount ?? 0;
    const invalidHint = invalidCount > 0 ? t4("memPanel.invalidSuffix", { count: invalidCount }) : "";
    if (count === 0 || !globalThis.confirm(t4("memPanel.emptyTrashConfirm", { count, invalid: invalidHint }))) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api("/memory/trash", { method: "DELETE", body: { confirm: true } });
      setOpen(null);
      setDraft(null);
      setBaseline("");
      showInfo(t4("memPanel.emptied", { count: result.deleted ?? count }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [tree, load]);
  if (!tree && !error)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("memory.loading")}</div>`;
  if (error && !tree) return html4`<div class="card accent-err">${error}</div>`;
  if (!tree) return null;
  const persistentItems = [
    ...tree.global.files.map((item) => ({ ...item, kind: "persistent", apiScope: "global", scopeKey: "global" })),
    ...tree.projectMem.files.map((item) => ({ ...item, kind: "persistent", apiScope: "project-mem", scopeKey: "project" })),
  ];
  const modeItems = (tree.modeMemory?.modes ?? []).flatMap((mode) => (mode.items ?? []).map((item) => ({
    ...item, kind: "mode", name: item.id, modeId: mode.id, modeLabel: mode.label ?? mode.id, description: item.text, scopeKey: "mode",
  })));
  const sessionItems = (tree.session?.items ?? []).map((item) => ({ ...item, kind: "session", scopeKey: "session", description: item.description || item.body }));
  const trashItems = (tree.trash?.items ?? []).map((item) => ({ ...item, kindType: item.kind, kind: "trash", name: item.id, scopeKey: "trash", description: item.kind === "mode" ? item.item?.text ?? item.name : item.name }));
  const soulItems = scopeFilter === "soul" ? [{ kind: "soul", name: "soul", scopeKey: "soul", description: tree.soul?.name ? t4("memPanel.aiIdentityNamed", { name: tree.soul.name }) : t4("memPanel.aiIdentityDefault") }] : [];
  const allItems = [...persistentItems, ...modeItems, ...sessionItems, ...soulItems, ...trashItems];
  const needle = query.trim().toLowerCase();
  const visibleItems = allItems.filter((item) => {
    if (scopeFilter !== "all" && item.scopeKey !== scopeFilter) return false;
    if (item.kind === "mode" && modeFilter !== "all" && item.modeId !== modeFilter) return false;
    if (!needle) return true;
    return [item.description, item.body, item.raw, item.item?.text, item.searchText, item.text, item.type, item.modeLabel, ...(item.keywords ?? [])].some((value) => String(value ?? "").toLowerCase().includes(needle));
  });
  const activeInjection = tree.runtime?.active ?? tree.injection;
  const scopeLabel = (item) => item.scopeKey === "global" ? t4("memPanel.scopeGlobal") : item.scopeKey === "project" ? t4("memPanel.scopeProject") : item.scopeKey === "mode" ? item.modeLabel : item.scopeKey === "soul" ? t4("memPanel.scopeSoul") : item.scopeKey === "trash" ? t4("memPanel.scopeTrash") : t4("memPanel.scopeSession");
  const injectionState = (item) => {
    if (item.kind === "trash") return "trash";
    if (item.kind === "persistent") return activeInjection?.persistent?.entries?.[`${item.scopeKey}:${item.name}`] ?? "omitted";
    if (item.kind === "mode") return activeInjection?.mode?.selectedIds?.includes(item.name) ? "index" : "omitted";
    if (item.kind === "session") return activeInjection?.session?.selectedNames?.includes(item.name) ? "index" : "omitted";
    return "manual";
  };
  const injectionLabel = (item) => {
    if (item.enabled === false) return t4("memPanel.stateDisabled");
    const state = injectionState(item);
    if (state === "high-full") return t4("memPanel.stateFullInject");
    if (state === "index") return item.kind === "persistent" ? t4("memPanel.stateSummaryInject") : t4("memPanel.stateWillInject");
    if (state === "manual") return t4("memPanel.stateIdentityConfig");
    if (state === "trash") return t4("memPanel.stateRecoverable");
    return t4("memPanel.stateNotInjected");
  };
  const diagnosticLabel = (item) => {
    if (item.kind !== "persistent") return "";
    const key = `${item.scopeKey}:${item.name}`;
    if (tree.diagnostics?.sensitiveKeys?.includes(key)) return t4("memPanel.diagSensitive");
    if (tree.diagnostics?.conflicts?.some((group) => group.includes(key))) return t4("memPanel.diagConflict");
    if (tree.diagnostics?.duplicates?.some((group) => group.includes(key))) return t4("memPanel.diagDuplicate");
    return "";
  };
  return html4`
    <div class="memory-manager">
      <div class="memory-toolbar">
        <div>
          <div class="memory-page-title">${t4("memPanel.pageTitle")}</div>
          <div class="memory-workspace">${tree.workspace ? `${tree.workspace.name} · ${tree.workspace.path}` : t4("memPanel.noWorkspace")}</div>
        </div>
        <input class="memory-search" type="search" placeholder=${t4("memPanel.searchPlaceholder")} value=${query} onInput=${(event) => setQuery(event.target.value)} />
      </div>
      <div class="memory-scope-tabs">
        ${[["all", t4("memPanel.filterAll")], ["global", t4("memPanel.scopeGlobal")], ["project", t4("memPanel.scopeProject")], ["mode", t4("memPanel.filterMode")], ["session", t4("memPanel.scopeSession")], ["soul", t4("memPanel.scopeSoul")], ["trash", t4("memPanel.scopeTrash")]].map(([value, label]) => html4`
          <button class=${scopeFilter === value ? "active" : ""} onClick=${() => setScopeFilter(value)}>${label}</button>
        `)}
      </div>
      ${scopeFilter === "mode" ? html4`<div class="memory-mode-tabs">
        <button class=${modeFilter === "all" ? "active" : ""} onClick=${() => setModeFilter("all")}>${t4("memPanel.allScenes")}</button>
        ${(tree.modeMemory?.modes ?? []).map((mode) => html4`<button class=${modeFilter === mode.id ? "active" : ""} onClick=${() => setModeFilter(mode.id)}>${mode.label ?? mode.id} ${mode.enabledCount ?? 0}/${mode.count ?? 0}</button>`)}
      </div>` : null}
      ${tree.runtime?.pending ? html4`<div class="memory-runtime-pending"><div><strong>${t4("memPanel.pendingTitle")}</strong><span>${t4("memPanel.pendingDesc")}</span></div><button class="btn primary" disabled=${busy} onClick=${applyMemoryNow}>${t4("memPanel.applyNow")}</button></div>` : null}
      ${activeInjection ? html4`<div class="memory-budget-summary"><span>${t4("memPanel.budgetCurrent")}</span><strong>${Number(activeInjection.totalTokens ?? 0).toLocaleString()} tokens</strong><span>${t4("memPanel.budgetFixed")} ${Number(activeInjection.budget?.pinnedTokens ?? 0).toLocaleString()} \xB7 ${t4("memPanel.budgetRecallable")} ${Number(activeInjection.budget?.recallableTokens ?? 0).toLocaleString()} / ${Number(activeInjection.budget?.maxRecallableTokens ?? 0).toLocaleString()} \xB7 ${t4("memPanel.budgetDedup")}</span></div>` : null}
      ${info ? html4`<div class="memory-notice ok">${info}</div>` : null}
      ${error ? html4`<div class="memory-notice error">${error}</div>` : null}
      <div class="memory-layout">
        <div class="memory-list-pane">
          <div class="memory-list-head"><span>${t4("memPanel.listCount", { count: visibleItems.length })}${scopeFilter === "trash" ? ` \xB7 ${t4("memPanel.trashRetentionHint", { days: tree.trash?.retentionDays ?? 30 })}${tree.trash?.invalidCount ? ` \xB7 ${t4("memPanel.trashInvalidHint", { count: tree.trash.invalidCount })}` : ""}` : ""}</span><div class="memory-list-actions">${scopeFilter !== "session" && scopeFilter !== "soul" && scopeFilter !== "trash" ? html4`<button type="button" class=${`btn btn-sm ${createOpen ? "primary" : ""}`} aria-expanded=${createOpen} onClick=${() => setCreateOpen((value) => !value)}>${createOpen ? t4("memPanel.collapseCreate") : t4("memPanel.createMemory")}</button>` : null}${scopeFilter === "trash" && (tree.trash?.total ?? trashItems.length) > 0 ? html4`<button class="btn btn-sm danger" disabled=${busy} onClick=${emptyMemoryTrash}>${t4("memPanel.emptyTrash")}</button>` : null}<button class="btn btn-sm ghost" disabled=${busy} onClick=${load}>${t4("memPanel.refresh")}</button></div></div>
          ${scopeFilter !== "session" && scopeFilter !== "soul" && scopeFilter !== "trash" && createOpen ? html4`<div class="memory-create-panel">
            <div class="memory-section-title">${newScope === "mode" ? t4("memPanel.createSceneTitle") : t4("memPanel.createLongTermTitle")}</div>
            <div class="memory-create-row">
              <${Select} value=${newScope} onChange=${(v) => setNewScope(v)} disabled=${busy} ariaLabel=${t4("memPanel.ariaScope")} options=${[{ value: "global", label: t4("memPanel.scopeGlobal") }, { value: "project-mem", label: t4("memPanel.scopeProjectMem") }, { value: "mode", label: t4("memPanel.scopeMode") }]} />
              <${Select} value=${newPriority} onChange=${(v) => setNewPriority(v)} disabled=${busy} ariaLabel=${t4("memPanel.ariaPriority")} options=${[{ value: "low", label: t4("memPanel.prioLow") }, { value: "medium", label: t4("memPanel.prioNormal") }, { value: "high", label: t4("memPanel.prioHigh") }]} />
            </div>
            ${newScope === "mode" ? html4`<${Select} value=${newMode} onChange=${(v) => setNewMode(v)} disabled=${busy} ariaLabel=${t4("memPanel.ariaTargetScene")} options=${(tree.modeMemory?.modes ?? []).map((mode) => ({ value: mode.id, label: mode.label ?? mode.id, meta: t4("memPanel.modeEnabledMeta", { enabled: mode.enabledCount ?? 0, count: mode.count ?? 0 }) }))} />` : html4`<input type="text" placeholder=${t4("memPanel.summaryPlaceholder")} value=${newDesc} onInput=${(event) => setNewDesc(event.target.value)} disabled=${busy} />`}
            <textarea rows="3" maxlength=${newScope === "mode" ? 180 : null} placeholder=${newScope === "mode" ? t4("memPanel.bodyPlaceholderMode") : t4("memPanel.bodyPlaceholder")} value=${newBody} onInput=${(event) => setNewBody(event.target.value)} disabled=${busy}></textarea>
            <div class="memory-create-actions"><button class="btn primary" disabled=${busy || !newBody.trim() || (newScope !== "mode" && !newDesc.trim())} onClick=${createMemory}>${t4("memPanel.createMemory")}</button><button type="button" class="btn ghost" disabled=${busy} onClick=${() => setCreateOpen(false)}>${t4("memPanel.cancel")}</button></div>
          </div>` : null}
          ${scopeFilter === "mode" && selectedModeKeys.length > 0 ? html4`<div class="memory-batch-bar"><span>${t4("memPanel.batchSelected", { count: selectedModeKeys.length })}</span><button class="btn" disabled=${busy} onClick=${() => batchModeMemories("enable")}>${t4("memPanel.batchEnable")}</button><button class="btn" disabled=${busy} onClick=${() => batchModeMemories("disable")}>${t4("memPanel.batchDisable")}</button><button class="btn danger" disabled=${busy} onClick=${() => batchModeMemories("delete")}>${t4("memPanel.batchDelete")}</button></div>` : null}
          <div class="memory-rows">
            ${visibleItems.map((item) => html4`
              <div class=${`memory-row ${open?.kind === item.kind && open?.name === item.name && open?.modeId === item.modeId ? "selected" : ""}`}>
                ${scopeFilter === "mode" && item.kind === "mode" ? html4`<input class="memory-row-check" type="checkbox" checked=${selectedModeKeys.includes(`${item.modeId}:${item.name}`)} onChange=${(event) => { const key = `${item.modeId}:${item.name}`; setSelectedModeKeys(event.target.checked ? [...selectedModeKeys, key] : selectedModeKeys.filter((value) => value !== key)); }} />` : null}
                <button class="memory-row-open" onClick=${() => selectItem(item)}>
                  <span class="memory-row-main">${item.description || item.text || item.name}</span>
                  <span class="memory-row-meta">
                    <span>${scopeLabel(item)}</span>
                    <span>${item.kind === "trash" ? t4("memPanel.cleanedAt", { date: item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : t4("memPanel.unknown") }) : item.kind === "mode" ? t4("memPanel.priorityMeta", { prio: item.priority ?? 50 }) : item.kind === "session" ? t4("memPanel.temporary") : item.kind === "soul" ? t4("memPanel.manualMaintain") : item.priority === "high" ? t4("memPanel.prioHighShort") : item.priority === "low" ? t4("memPanel.prioLowShort") : t4("memPanel.prioNormal")}</span>
                    <span class=${injectionState(item) === "omitted" || item.enabled === false ? "memory-disabled" : "memory-injected"}>${injectionLabel(item)}</span>
                    ${diagnosticLabel(item) ? html4`<span class="memory-diagnostic">${diagnosticLabel(item)}</span>` : null}
                  </span>
                </button>
              </div>
            `)}
            ${visibleItems.length === 0 ? html4`<div class="memory-empty">${t4("memPanel.emptyList")}</div>` : null}
          </div>
          <div class="memory-rule-status">
            <span>${t4("memPanel.projectRules")}</span>
            ${(tree.project?.files ?? []).length > 0 ? tree.project.files.map((file) => html4`<strong>${file.name} · ${fmtBytes(file.size)} · ${file.state === "full" ? t4("memPanel.stateFull") : file.state === "truncated" ? t4("memPanel.stateTruncated", { chars: Number(file.injectedChars ?? 0).toLocaleString() }) : t4("memPanel.stateOmitted")}</strong>`) : html4`<strong>${t4("memPanel.notConfigured")}</strong>`}
            <span>${tree.project?.exists ? t4("memPanel.actualInject", { used: Number(tree.project.totalChars ?? 0).toLocaleString(), max: Number(tree.project.maxChars ?? 0).toLocaleString() }) : ""}</span>
          </div>
        </div>
        <div class="memory-detail-pane">
          ${!draft ? html4`<div class="memory-empty-detail">${t4("memPanel.pickDetail")}</div>` : html4`
            <div class="memory-detail-head">
              <div><div class="memory-section-title">${scopeLabel(draft)}</div><div class="memory-detail-state">${dirty ? t4("memPanel.detailDirty") : t4("memPanel.detailSynced")}</div></div>
              <div class="memory-detail-actions">
                ${open.kind === "trash" ? html4`<button class="btn primary" title=${draft.restoreHint ?? t4("memPanel.restoreHintDefault")} disabled=${busy || draft.canRestore === false} onClick=${restoreTrash}>${t4("memPanel.restoreThis")}</button><button class="btn danger" disabled=${busy} onClick=${permanentlyDeleteMemoryTrash}>${t4("memPanel.permanentDelete")}</button>` : open.kind !== "session" ? html4`<button class="btn primary" disabled=${busy || !dirty || !String(draft.content ?? "").trim()} onClick=${save}>${t4("memPanel.saveBtn")}</button>` : null}
                ${open.kind !== "soul" && open.kind !== "trash" ? html4`<button class="btn danger" disabled=${busy} onClick=${remove}>${t4("memPanel.deleteBtn")}</button>` : null}
              </div>
            </div>
            ${diagnosticLabel(draft) ? html4`<div class="memory-detail-warning">${diagnosticLabel(draft)}${t4("memPanel.diagAction")}</div>` : null}
            ${open.kind === "persistent" ? html4`
              <label class="memory-field"><span>${t4("memPanel.fieldSummary")}</span><input value=${draft.description ?? ""} onInput=${(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              <div class="memory-field-row">
                <label class="memory-field"><span>${t4("memPanel.fieldType")}</span><${Select} value=${draft.type ?? "user"} onChange=${(v) => setDraft({ ...draft, type: v })} ariaLabel=${t4("memPanel.fieldType")} options=${[{ value: "user", label: t4("memPanel.typeUser") }, { value: "feedback", label: t4("memPanel.typeFeedback") }, { value: "project", label: t4("memPanel.typeProject") }, { value: "reference", label: t4("memPanel.typeReference") }]} /></label>
                <label class="memory-field"><span>${t4("memPanel.fieldPriority")}</span><${Select} value=${draft.priority ?? "medium"} onChange=${(v) => setDraft({ ...draft, priority: v })} ariaLabel=${t4("memPanel.fieldPriority")} options=${[{ value: "low", label: t4("memPanel.prioLowTiny") }, { value: "medium", label: t4("memPanel.prioNormal") }, { value: "high", label: t4("memPanel.prioHighTiny") }]} /></label>
              </div>
            ` : open.kind === "mode" ? html4`
              <div class="memory-field-row">
                <label class="memory-field"><span>${t4("memPanel.fieldTargetScene")}</span><${Select} value=${draft.targetMode ?? open.modeId} onChange=${(v) => setDraft({ ...draft, targetMode: v })} ariaLabel=${t4("memPanel.fieldTargetScene")} options=${(tree.modeMemory?.modes ?? []).map((mode) => ({ value: mode.id, label: mode.label ?? mode.id }))} /></label>
                <label class="memory-field"><span>${t4("memPanel.fieldPriority")}</span><input type="number" min="0" max="100" value=${draft.priority ?? 50} onInput=${(event) => setDraft({ ...draft, priority: Number(event.target.value) })} /></label>
              </div>
              <div class="memory-mode-actions"><span>${draft.targetMode !== open.modeId ? t4("memPanel.moveHint") : t4("memPanel.copyHint")}</span><button class="btn" disabled=${busy || !draft.targetMode || draft.targetMode === open.modeId} onClick=${copyModeMemory}>${t4("memPanel.copyToScene")}</button></div>
              <label class="memory-field"><span>${t4("memPanel.fieldKeywords")}</span><input value=${draft.keywordsText ?? ""} onInput=${(event) => setDraft({ ...draft, keywordsText: event.target.value })} /></label>
              <label class="memory-toggle"><input type="checkbox" checked=${draft.enabled !== false} onChange=${(event) => setDraft({ ...draft, enabled: event.target.checked })} /><span>${t4("memPanel.enableThis")}</span></label>
            ` : open.kind === "soul" ? html4`
              <div class="memory-editor-tabs"><button class=${soulEditorMode === "basic" ? "active" : ""} onClick=${() => setSoulEditorMode("basic")}>${t4("memPanel.soulBasic")}</button><button class=${soulEditorMode === "advanced" ? "active" : ""} onClick=${() => setSoulEditorMode("advanced")}>${t4("memPanel.soulAdvanced")}</button></div>
              <label class="memory-field"><span>${t4("memPanel.fieldAiName")}</span><input maxlength="80" value=${draft.aiName ?? ""} onInput=${(event) => setDraft({ ...draft, aiName: event.target.value })} /></label>
              ${soulEditorMode === "basic" ? html4`
                <label class="memory-field"><span>${t4("memPanel.soulWho")}</span><textarea rows="5" value=${soulSectionValue(draft.content, "我是谁")} onInput=${(event) => setDraft({ ...draft, content: updateSoulSection(draft.content, "我是谁", event.target.value) })}></textarea></label>
                <label class="memory-field"><span>${t4("memPanel.soulCollab")}</span><textarea rows="7" value=${soulSectionValue(draft.content, "协作方式")} onInput=${(event) => setDraft({ ...draft, content: updateSoulSection(draft.content, "协作方式", event.target.value) })}></textarea></label>
                <label class="memory-field"><span>${t4("memPanel.soulSafety")}</span><textarea rows="6" value=${soulSectionValue(draft.content, "安全与隐私")} onInput=${(event) => setDraft({ ...draft, content: updateSoulSection(draft.content, "安全与隐私", event.target.value) })}></textarea></label>
              ` : html4`<label class="memory-field memory-content-field"><span>${t4("memPanel.soulFullMd", { count: String(draft.content ?? "").length })}</span><textarea rows="18" value=${draft.content ?? ""} onInput=${(event) => setDraft({ ...draft, content: event.target.value })}></textarea></label>`}
              <div class="memory-soul-actions"><button class="btn" disabled=${busy} onClick=${previewSoul}>${t4("memPanel.previewInject")}</button><button class="btn" disabled=${busy} onClick=${resetSoul}>${t4("memPanel.resetSoul")}</button></div>
              ${soulPreview ? html4`<div class=${`memory-soul-preview ${soulPreview.valid ? "" : "invalid"}`}><div><strong>${t4("memPanel.finalPreview")}</strong><span>${t4("memPanel.previewChars", { used: soulPreview.chars, max: soulPreview.maxChars })}</span></div><pre>${soulPreview.finalBody}</pre></div>` : null}
              <div class="memory-soul-note"><strong>${t4("memPanel.soulNoDelete")}</strong><span>${t4("memPanel.soulEffective")}</span></div>
              ${(draft.history ?? []).length > 0 ? html4`<div class="memory-soul-history"><strong>${t4("memPanel.versionHistory")}</strong>${draft.history.map((item) => html4`<div><span>${new Date(item.savedAt).toLocaleString()} · ${item.name || t4("memPanel.unnamed")} · ${fmtBytes(item.size)}</span><button class="btn ghost" disabled=${busy} onClick=${() => restoreSoulVersion(item.id)}>${t4("memPanel.restoreVersion")}</button></div>`)}</div>` : null}
            ` : open.kind === "trash" ? html4`<div class=${`memory-session-note ${draft.canRestore === false ? "memory-trash-blocked" : ""}`}>${t4("memPanel.trashDeletedAt", { date: new Date(draft.deletedAt).toLocaleString() })}${draft.expiresAt ? t4("memPanel.trashExpireAt", { date: new Date(draft.expiresAt).toLocaleString() }) : t4("memPanel.trashRetentionDays", { days: tree.trash?.retentionDays ?? 30 })}${draft.canRestore === false ? draft.projectId ? t4("memPanel.trashOtherProject") : t4("memPanel.trashNoProject") : t4("memPanel.trashWillRestore")}</div>` : html4`<div class="memory-session-note">${t4("memPanel.sessionNote")}</div>`}
            ${open.kind !== "soul" ? html4`<label class="memory-field memory-content-field"><span>${open.kind === "mode" ? t4("memPanel.contentLabelMode", { count: String(draft.content ?? "").length }) : t4("memPanel.contentLabel")}</span><textarea rows="16" maxlength=${open.kind === "mode" ? 180 : null} value=${draft.content ?? ""} disabled=${open.kind === "session" || open.kind === "trash"} onInput=${(event) => setDraft({ ...draft, content: event.target.value })}></textarea></label>` : null}
            <div class="memory-detail-foot">${open.kind === "session" ? t4("memPanel.footSession") : open.kind === "soul" ? draft.path ?? "~/.visionox/soul.md" : t4("memPanel.footCreated", { created: draft.createdAt || t4("memPanel.unknown"), updated: draft.updatedAt || t4("memPanel.unknown"), source: draft.source === "model" ? t4("memPanel.sourceModel") : draft.source === "ui" ? t4("memPanel.sourceUi") : t4("memPanel.sourceHistory") })}</div>
          `}
        </div>
      </div>
    </div>
  `;
}

export { MemoryPanel };
