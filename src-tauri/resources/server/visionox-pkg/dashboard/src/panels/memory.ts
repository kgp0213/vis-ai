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
  const acceptNavigation = () => !dirty || globalThis.confirm("当前修改尚未保存，确定放弃吗？");
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
      showInfo(moved ? "场景记忆已移动" : "记忆已保存");
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
        showInfo("工作场景记忆已新增");
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
      showInfo("长期记忆已新增");
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
    const prompt = open.kind === "persistent" || open.kind === "mode" ? `将“${label}”移入回收站？${tree?.trash?.retentionDays ?? 30} 天内可以恢复。` : `确定删除“${label}”吗？此操作不可撤销。`;
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
      showInfo("记忆已删除");
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
      setError("请选择其他工作场景后再复制");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/mode-memory/${encodeURIComponent(open.name)}/move`, { method: "POST", body: { mode: open.modeId, targetMode: draft.targetMode, copy: true } });
      showInfo("场景记忆已复制");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [open, draft, load]);
  const batchModeMemories = q2(async (action) => {
    if (!tree || selectedModeKeys.length === 0) return;
    if (action === "delete" && !globalThis.confirm(`确定删除选中的 ${selectedModeKeys.length} 条场景记忆吗？`)) return;
    const selected = new Set(selectedModeKeys);
    const items = (tree.modeMemory?.modes ?? []).flatMap((mode) => (mode.items ?? []).map((item) => ({ ...item, modeId: mode.id }))).filter((item) => selected.has(`${item.modeId}:${item.id}`));
    setBusy(true);
    setError(null);
    try {
      await api("/mode-memory/batch", { method: "POST", body: { action, items: items.map((item) => ({ mode: item.modeId, id: item.id })) } });
      setSelectedModeKeys([]);
      showInfo(action === "delete" ? "已批量删除" : action === "enable" ? "已批量启用" : "已批量停用");
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
      if (result.applied === false) throw new Error(result.error || "无法应用记忆");
      showInfo("记忆已应用到当前对话");
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
    if (!globalThis.confirm("恢复此 Soul 版本？当前版本会先自动保存到历史。")) return;
    setBusy(true);
    try {
      await api(`/memory/soul/history/${encodeURIComponent(id)}/restore`, { method: "POST", body: {} });
      const result = await api("/memory/soul");
      const next = { ...draft, content: result.body ?? "", aiName: result.name ?? "", revision: result.revision, history: result.history ?? [] };
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setSoulPreview(null);
      showInfo("Soul 版本已恢复");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [draft, load]);
  const resetSoul = q2(async () => {
    if (!globalThis.confirm("恢复默认 Soul？当前版本会先自动保存到历史。")) return;
    setBusy(true);
    try {
      await api("/memory/soul/reset", { method: "POST", body: {} });
      const result = await api("/memory/soul");
      const next = { ...draft, content: result.body ?? "", aiName: result.name ?? "", revision: result.revision, history: result.history ?? [] };
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setSoulPreview(null);
      showInfo("已恢复默认 Soul");
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
      showInfo("记忆已从回收站恢复");
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
    if (!globalThis.confirm(`永久删除“${label}”？删除后无法恢复。`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/memory/trash/${encodeURIComponent(open.name)}`, { method: "DELETE", body: {} });
      setOpen(null);
      setDraft(null);
      setBaseline("");
      showInfo("记忆已永久删除");
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
    const invalidHint = invalidCount > 0 ? `，其中 ${invalidCount} 条文件已损坏、无法预览` : "";
    if (count === 0 || !globalThis.confirm(`清空回收站中的 ${count} 条记忆${invalidHint}？全部内容将永久删除且无法恢复。`)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api("/memory/trash", { method: "DELETE", body: { confirm: true } });
      setOpen(null);
      setDraft(null);
      setBaseline("");
      showInfo(`已永久删除 ${result.deleted ?? count} 条记忆`);
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
  const soulItems = scopeFilter === "soul" ? [{ kind: "soul", name: "soul", scopeKey: "soul", description: tree.soul?.name ? `AI 身份：${tree.soul.name}` : "AI 身份与行为准则" }] : [];
  const allItems = [...persistentItems, ...modeItems, ...sessionItems, ...soulItems, ...trashItems];
  const needle = query.trim().toLowerCase();
  const visibleItems = allItems.filter((item) => {
    if (scopeFilter !== "all" && item.scopeKey !== scopeFilter) return false;
    if (item.kind === "mode" && modeFilter !== "all" && item.modeId !== modeFilter) return false;
    if (!needle) return true;
    return [item.description, item.body, item.raw, item.item?.text, item.searchText, item.text, item.type, item.modeLabel, ...(item.keywords ?? [])].some((value) => String(value ?? "").toLowerCase().includes(needle));
  });
  const activeInjection = tree.runtime?.active ?? tree.injection;
  const scopeLabel = (item) => item.scopeKey === "global" ? "全局" : item.scopeKey === "project" ? "当前项目" : item.scopeKey === "mode" ? item.modeLabel : item.scopeKey === "soul" ? "AI 身份" : item.scopeKey === "trash" ? "回收站" : "当前会话";
  const injectionState = (item) => {
    if (item.kind === "trash") return "trash";
    if (item.kind === "persistent") return activeInjection?.persistent?.entries?.[`${item.scopeKey}:${item.name}`] ?? "omitted";
    if (item.kind === "mode") return activeInjection?.mode?.selectedIds?.includes(item.name) ? "index" : "omitted";
    if (item.kind === "session") return activeInjection?.session?.selectedNames?.includes(item.name) ? "index" : "omitted";
    return "manual";
  };
  const injectionLabel = (item) => {
    if (item.enabled === false) return "已停用";
    const state = injectionState(item);
    if (state === "high-full") return "全文注入";
    if (state === "index") return item.kind === "persistent" ? "摘要注入" : "将注入";
    if (state === "manual") return "身份配置";
    if (state === "trash") return "可恢复";
    return "未注入";
  };
  const diagnosticLabel = (item) => {
    if (item.kind !== "persistent") return "";
    const key = `${item.scopeKey}:${item.name}`;
    if (tree.diagnostics?.sensitiveKeys?.includes(key)) return "可能包含敏感信息";
    if (tree.diagnostics?.conflicts?.some((group) => group.includes(key))) return "可能冲突";
    if (tree.diagnostics?.duplicates?.some((group) => group.includes(key))) return "内容重复";
    return "";
  };
  return html4`
    <div class="memory-manager">
      <div class="memory-toolbar">
        <div>
          <div class="memory-page-title">记忆管理</div>
          <div class="memory-workspace">${tree.workspace ? `${tree.workspace.name} · ${tree.workspace.path}` : "未选择工作区"}</div>
        </div>
        <input class="memory-search" type="search" placeholder="搜索摘要、内容或关键词" value=${query} onInput=${(event) => setQuery(event.target.value)} />
      </div>
      <div class="memory-scope-tabs">
        ${[["all", "全部"], ["global", "全局"], ["project", "当前项目"], ["mode", "工作场景"], ["session", "当前会话"], ["soul", "AI 身份"], ["trash", "回收站"]].map(([value, label]) => html4`
          <button class=${scopeFilter === value ? "active" : ""} onClick=${() => setScopeFilter(value)}>${label}</button>
        `)}
      </div>
      ${scopeFilter === "mode" ? html4`<div class="memory-mode-tabs">
        <button class=${modeFilter === "all" ? "active" : ""} onClick=${() => setModeFilter("all")}>全部场景</button>
        ${(tree.modeMemory?.modes ?? []).map((mode) => html4`<button class=${modeFilter === mode.id ? "active" : ""} onClick=${() => setModeFilter(mode.id)}>${mode.label ?? mode.id} ${mode.enabledCount ?? 0}/${mode.count ?? 0}</button>`)}
      </div>` : null}
      ${tree.runtime?.pending ? html4`<div class="memory-runtime-pending"><div><strong>当前上下文仍在使用旧记忆</strong><span>磁盘修改已保存，执行应用后当前对话才会使用新版本。</span></div><button class="btn primary" disabled=${busy} onClick=${applyMemoryNow}>立即应用到当前对话</button></div>` : null}
      ${activeInjection ? html4`<div class="memory-budget-summary"><span>当前记忆上下文</span><strong>${Number(activeInjection.totalTokens ?? 0).toLocaleString()} tokens</strong><span>固定 ${Number(activeInjection.budget?.pinnedTokens ?? 0).toLocaleString()} · 可召回 ${Number(activeInjection.budget?.recallableTokens ?? 0).toLocaleString()} / ${Number(activeInjection.budget?.maxRecallableTokens ?? 0).toLocaleString()} · 高优先级全文与普通摘要已去重</span></div>` : null}
      ${info ? html4`<div class="memory-notice ok">${info}</div>` : null}
      ${error ? html4`<div class="memory-notice error">${error}</div>` : null}
      <div class="memory-layout">
        <div class="memory-list-pane">
          <div class="memory-list-head"><span>${visibleItems.length} 条${scopeFilter === "trash" ? ` · ${tree.trash?.retentionDays ?? 30} 天后自动清理${tree.trash?.invalidCount ? ` · ${tree.trash.invalidCount} 条损坏` : ""}` : ""}</span><div class="memory-list-actions">${scopeFilter !== "session" && scopeFilter !== "soul" && scopeFilter !== "trash" ? html4`<button type="button" class=${`btn btn-sm ${createOpen ? "primary" : ""}`} aria-expanded=${createOpen} onClick=${() => setCreateOpen((value) => !value)}>${createOpen ? "收起新增" : "新增记忆"}</button>` : null}${scopeFilter === "trash" && (tree.trash?.total ?? trashItems.length) > 0 ? html4`<button class="btn btn-sm danger" disabled=${busy} onClick=${emptyMemoryTrash}>清空回收站</button>` : null}<button class="btn btn-sm ghost" disabled=${busy} onClick=${load}>刷新</button></div></div>
          ${scopeFilter !== "session" && scopeFilter !== "soul" && scopeFilter !== "trash" && createOpen ? html4`<div class="memory-create-panel">
            <div class="memory-section-title">${newScope === "mode" ? "新增场景记忆" : "新增长期记忆"}</div>
            <div class="memory-create-row">
              <select value=${newScope} onChange=${(event) => setNewScope(event.target.value)} disabled=${busy}>
                <option value="global">全局</option>
                <option value="project-mem">当前项目</option>
                <option value="mode">工作场景</option>
              </select>
              <select value=${newPriority} onChange=${(event) => setNewPriority(event.target.value)} disabled=${busy}>
                <option value="low">低优先级</option><option value="medium">普通</option><option value="high">高优先级</option>
              </select>
            </div>
            ${newScope === "mode" ? html4`<select value=${newMode} onChange=${(event) => setNewMode(event.target.value)} disabled=${busy}>${(tree.modeMemory?.modes ?? []).map((mode) => html4`<option value=${mode.id}>${mode.label ?? mode.id} · ${mode.enabledCount ?? 0}/${mode.count ?? 0} 启用</option>`)}</select>` : html4`<input type="text" placeholder="一句话摘要" value=${newDesc} onInput=${(event) => setNewDesc(event.target.value)} disabled=${busy} />`}
            <textarea rows="3" maxlength=${newScope === "mode" ? 180 : null} placeholder=${newScope === "mode" ? "场景记忆内容，最多 180 字符" : "记忆内容"} value=${newBody} onInput=${(event) => setNewBody(event.target.value)} disabled=${busy}></textarea>
            <div class="memory-create-actions"><button class="btn primary" disabled=${busy || !newBody.trim() || (newScope !== "mode" && !newDesc.trim())} onClick=${createMemory}>新增记忆</button><button type="button" class="btn ghost" disabled=${busy} onClick=${() => setCreateOpen(false)}>取消</button></div>
          </div>` : null}
          ${scopeFilter === "mode" && selectedModeKeys.length > 0 ? html4`<div class="memory-batch-bar"><span>已选 ${selectedModeKeys.length} 条</span><button class="btn" disabled=${busy} onClick=${() => batchModeMemories("enable")}>启用</button><button class="btn" disabled=${busy} onClick=${() => batchModeMemories("disable")}>停用</button><button class="btn danger" disabled=${busy} onClick=${() => batchModeMemories("delete")}>删除</button></div>` : null}
          <div class="memory-rows">
            ${visibleItems.map((item) => html4`
              <div class=${`memory-row ${open?.kind === item.kind && open?.name === item.name && open?.modeId === item.modeId ? "selected" : ""}`}>
                ${scopeFilter === "mode" && item.kind === "mode" ? html4`<input class="memory-row-check" type="checkbox" checked=${selectedModeKeys.includes(`${item.modeId}:${item.name}`)} onChange=${(event) => { const key = `${item.modeId}:${item.name}`; setSelectedModeKeys(event.target.checked ? [...selectedModeKeys, key] : selectedModeKeys.filter((value) => value !== key)); }} />` : null}
                <button class="memory-row-open" onClick=${() => selectItem(item)}>
                  <span class="memory-row-main">${item.description || item.text || item.name}</span>
                  <span class="memory-row-meta">
                    <span>${scopeLabel(item)}</span>
                    <span>${item.kind === "trash" ? `清理于 ${item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "未知"}` : item.kind === "mode" ? `优先级 ${item.priority ?? 50}` : item.kind === "session" ? "临时" : item.kind === "soul" ? "手动维护" : item.priority === "high" ? "高优先级" : item.priority === "low" ? "低优先级" : "普通"}</span>
                    <span class=${injectionState(item) === "omitted" || item.enabled === false ? "memory-disabled" : "memory-injected"}>${injectionLabel(item)}</span>
                    ${diagnosticLabel(item) ? html4`<span class="memory-diagnostic">${diagnosticLabel(item)}</span>` : null}
                  </span>
                </button>
              </div>
            `)}
            ${visibleItems.length === 0 ? html4`<div class="memory-empty">没有符合条件的记忆</div>` : null}
          </div>
          <div class="memory-rule-status">
            <span>当前项目规则</span>
            ${(tree.project?.files ?? []).length > 0 ? tree.project.files.map((file) => html4`<strong>${file.name} · ${fmtBytes(file.size)} · ${file.state === "full" ? "全文" : file.state === "truncated" ? `截断 ${Number(file.injectedChars ?? 0).toLocaleString()} 字符` : "因总预算省略"}</strong>`) : html4`<strong>未配置</strong>`}
            <span>${tree.project?.exists ? `实际注入 ${Number(tree.project.totalChars ?? 0).toLocaleString()} / ${Number(tree.project.maxChars ?? 0).toLocaleString()} 字符` : ""}</span>
          </div>
        </div>
        <div class="memory-detail-pane">
          ${!draft ? html4`<div class="memory-empty-detail">选择一条记忆查看详情</div>` : html4`
            <div class="memory-detail-head">
              <div><div class="memory-section-title">${scopeLabel(draft)}</div><div class="memory-detail-state">${dirty ? "有未保存修改" : "已同步"}</div></div>
              <div class="memory-detail-actions">
                ${open.kind === "trash" ? html4`<button class="btn primary" title=${draft.restoreHint ?? "恢复到原范围"} disabled=${busy || draft.canRestore === false} onClick=${restoreTrash}>恢复此记忆</button><button class="btn danger" disabled=${busy} onClick=${permanentlyDeleteMemoryTrash}>永久删除</button>` : open.kind !== "session" ? html4`<button class="btn primary" disabled=${busy || !dirty || !String(draft.content ?? "").trim()} onClick=${save}>保存</button>` : null}
                ${open.kind !== "soul" && open.kind !== "trash" ? html4`<button class="btn danger" disabled=${busy} onClick=${remove}>删除</button>` : null}
              </div>
            </div>
            ${diagnosticLabel(draft) ? html4`<div class="memory-detail-warning">${diagnosticLabel(draft)}。请核对后自行决定保留、修改或删除，系统不会自动合并。</div>` : null}
            ${open.kind === "persistent" ? html4`
              <label class="memory-field"><span>摘要</span><input value=${draft.description ?? ""} onInput=${(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              <div class="memory-field-row">
                <label class="memory-field"><span>类型</span><select value=${draft.type ?? "user"} onChange=${(event) => setDraft({ ...draft, type: event.target.value })}><option value="user">用户偏好</option><option value="feedback">纠正反馈</option><option value="project">项目事实</option><option value="reference">参考信息</option></select></label>
                <label class="memory-field"><span>优先级</span><select value=${draft.priority ?? "medium"} onChange=${(event) => setDraft({ ...draft, priority: event.target.value })}><option value="low">低</option><option value="medium">普通</option><option value="high">高</option></select></label>
              </div>
            ` : open.kind === "mode" ? html4`
              <div class="memory-field-row">
                <label class="memory-field"><span>目标场景</span><select value=${draft.targetMode ?? open.modeId} onChange=${(event) => setDraft({ ...draft, targetMode: event.target.value })}>${(tree.modeMemory?.modes ?? []).map((mode) => html4`<option value=${mode.id}>${mode.label ?? mode.id}</option>`)}</select></label>
                <label class="memory-field"><span>优先级</span><input type="number" min="0" max="100" value=${draft.priority ?? 50} onInput=${(event) => setDraft({ ...draft, priority: Number(event.target.value) })} /></label>
              </div>
              <div class="memory-mode-actions"><span>${draft.targetMode !== open.modeId ? "保存后将移动到目标场景" : "选择其他场景可移动或复制"}</span><button class="btn" disabled=${busy || !draft.targetMode || draft.targetMode === open.modeId} onClick=${copyModeMemory}>复制到场景</button></div>
              <label class="memory-field"><span>关键词</span><input value=${draft.keywordsText ?? ""} onInput=${(event) => setDraft({ ...draft, keywordsText: event.target.value })} /></label>
              <label class="memory-toggle"><input type="checkbox" checked=${draft.enabled !== false} onChange=${(event) => setDraft({ ...draft, enabled: event.target.checked })} /><span>启用此场景记忆</span></label>
            ` : open.kind === "soul" ? html4`
              <div class="memory-editor-tabs"><button class=${soulEditorMode === "basic" ? "active" : ""} onClick=${() => setSoulEditorMode("basic")}>基础编辑</button><button class=${soulEditorMode === "advanced" ? "active" : ""} onClick=${() => setSoulEditorMode("advanced")}>高级原文</button></div>
              <label class="memory-field"><span>AI 名称</span><input maxlength="80" value=${draft.aiName ?? ""} onInput=${(event) => setDraft({ ...draft, aiName: event.target.value })} /></label>
              ${soulEditorMode === "basic" ? html4`
                <label class="memory-field"><span>身份与定位</span><textarea rows="5" value=${soulSectionValue(draft.content, "我是谁")} onInput=${(event) => setDraft({ ...draft, content: updateSoulSection(draft.content, "我是谁", event.target.value) })}></textarea></label>
                <label class="memory-field"><span>协作方式</span><textarea rows="7" value=${soulSectionValue(draft.content, "协作方式")} onInput=${(event) => setDraft({ ...draft, content: updateSoulSection(draft.content, "协作方式", event.target.value) })}></textarea></label>
                <label class="memory-field"><span>安全与隐私</span><textarea rows="6" value=${soulSectionValue(draft.content, "安全与隐私")} onInput=${(event) => setDraft({ ...draft, content: updateSoulSection(draft.content, "安全与隐私", event.target.value) })}></textarea></label>
              ` : html4`<label class="memory-field memory-content-field"><span>完整 Soul Markdown · ${String(draft.content ?? "").length} 字符</span><textarea rows="18" value=${draft.content ?? ""} onInput=${(event) => setDraft({ ...draft, content: event.target.value })}></textarea></label>`}
              <div class="memory-soul-actions"><button class="btn" disabled=${busy} onClick=${previewSoul}>预览最终注入</button><button class="btn" disabled=${busy} onClick=${resetSoul}>恢复默认 Soul</button></div>
              ${soulPreview ? html4`<div class=${`memory-soul-preview ${soulPreview.valid ? "" : "invalid"}`}><div><strong>最终注入预览</strong><span>${soulPreview.chars}/${soulPreview.maxChars} 字符</span></div><pre>${soulPreview.finalBody}</pre></div>` : null}
              <div class="memory-soul-note"><strong>Soul 不提供删除</strong><span>保存后在下一次 /new 或上下文重建时生效。</span></div>
              ${(draft.history ?? []).length > 0 ? html4`<div class="memory-soul-history"><strong>版本历史</strong>${draft.history.map((item) => html4`<div><span>${new Date(item.savedAt).toLocaleString()} · ${item.name || "未命名"} · ${fmtBytes(item.size)}</span><button class="btn ghost" disabled=${busy} onClick=${() => restoreSoulVersion(item.id)}>恢复此版本</button></div>`)}</div>` : null}
            ` : open.kind === "trash" ? html4`<div class=${`memory-session-note ${draft.canRestore === false ? "memory-trash-blocked" : ""}`}>删除于 ${new Date(draft.deletedAt).toLocaleString()}，${draft.expiresAt ? `${new Date(draft.expiresAt).toLocaleString()} 后自动永久清理。` : `保留 ${tree.trash?.retentionDays ?? 30} 天。`}${draft.canRestore === false ? draft.projectId ? " 这是其他项目的记忆，请打开原项目后恢复；仍可在此预览或永久删除。" : " 旧记录未保存原项目信息，无法安全自动恢复；可预览内容后重新创建。" : " 恢复后将回到原范围。"}</div>` : html4`<div class="memory-session-note">仅在当前对话中生效，恢复该对话时会一并恢复。</div>`}
            ${open.kind !== "soul" ? html4`<label class="memory-field memory-content-field"><span>${open.kind === "mode" ? `内容 · ${String(draft.content ?? "").length}/180` : "内容"}</span><textarea rows="16" maxlength=${open.kind === "mode" ? 180 : null} value=${draft.content ?? ""} disabled=${open.kind === "session" || open.kind === "trash"} onInput=${(event) => setDraft({ ...draft, content: event.target.value })}></textarea></label>` : null}
            <div class="memory-detail-foot">${open.kind === "session" ? "当前会话" : open.kind === "soul" ? draft.path ?? "~/.visionox/soul.md" : `创建 ${draft.createdAt || "未知"} · 更新 ${draft.updatedAt || "未知"} · 来源 ${draft.source === "model" ? "AI" : draft.source === "ui" ? "界面" : "历史数据"}`}</div>
          `}
        </div>
      </div>
    </div>
  `;
}

export { MemoryPanel };
