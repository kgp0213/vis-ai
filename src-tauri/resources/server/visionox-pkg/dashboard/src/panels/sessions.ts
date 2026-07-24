// Recovered from the product bundle; types are tightened incrementally without changing behavior.
// @ts-nocheck
import { createPortal as T2, memo as preactMemo } from "preact/compat";
import { useCallback as q2, useEffect as y2, useRef as A2, useState as d2 } from "preact/hooks";
import { ChatMessage, ToolCard, computeChatSearchMatches, parseToolArgs } from "../components/chat-internals.js";
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
import { CHAT_DRAFT_KEY } from "./chat.js";
const N2: any = preactMemo;

function SessionsPanel({ userAvatar = null } = {}) {
  useLang();
  const { data, error, loading, refresh } = usePoll("/sessions", 3e4);
  const [open, setOpen] = d2(null);
  const [openLoading, setOpenLoading] = d2(false);
  const [filter, setFilter] = d2("");
  const [selectedNames, setSelectedNames] = d2(() => /* @__PURE__ */ new Set());
  const [selectedTrashIds, setSelectedTrashIds] = d2(() => /* @__PURE__ */ new Set());
  const [listMode, setListMode] = d2("sessions");
  const [selectionMode, setSelectionMode] = d2(false);
  const [restoreName, setRestoreName] = d2("");
  const [skipTrashConfirm, setSkipTrashConfirm] = d2(() => { try { return localStorage.getItem("visionox.sessions.skipTrashConfirm") === "1"; } catch { return false; } });
  const [trashConfirm, setTrashConfirm] = d2(null);
  const [dontAskAgain, setDontAskAgain] = d2(false);
  const [retentionDraft, setRetentionDraft] = d2(30);
  const [deleting, setDeleting] = d2(false);
  const [resuming, setResuming] = d2(false);
  const [info, setInfo] = d2(null);
  const [transcriptSearch, setTranscriptSearch] = d2("");
  const [transcriptSearchIndex, setTranscriptSearchIndex] = d2(0);
  const transcriptFeedRef = A2(null);
  const detailRequestRef = A2(0);
  const closeDetail = q2(() => {
    detailRequestRef.current++;
    setOpen(null);
    setOpenLoading(false);
  }, []);
  y2(() => {
    if (!trashConfirm) return;
    const onKeyDown = (event) => { if (event.key === "Escape" && !deleting) setTrashConfirm(null); };
    document.addEventListener("keydown", onKeyDown);
    const frame = requestAnimationFrame(() => document.querySelector(".session-confirm-card .modal-actions .primary")?.focus());
    return () => { document.removeEventListener("keydown", onKeyDown); cancelAnimationFrame(frame); };
  }, [trashConfirm, deleting]);
  y2(() => subscribeSse("sessions-changed", refresh), [refresh]);
  y2(() => {
    if (Number.isFinite(data?.trash?.retentionDays)) setRetentionDraft(data.trash.retentionDays);
  }, [data?.trash?.retentionDays]);
  y2(() => {
    const sessionNames = new Set((data?.sessions ?? []).map((item) => item.name));
    const trashIds = new Set((data?.trash?.items ?? []).map((item) => item.id));
    setSelectedNames((current) => new Set([...current].filter((name) => sessionNames.has(name))));
    setSelectedTrashIds((current) => new Set([...current].filter((id) => trashIds.has(id))));
  }, [data]);
  const view = q2(async (name) => {
    const requestId = ++detailRequestRef.current;
    setInfo(null);
    setTranscriptSearch("");
    setTranscriptSearchIndex(0);
    setOpen({ kind: "session", name, messages: null });
    setOpenLoading(true);
    try {
      const detail = await api(`/sessions/${encodeURIComponent(name)}?limit=200`);
      if (requestId !== detailRequestRef.current) return;
      setOpen({
        kind: "session",
        name,
        messages: detail.messages,
        totalMessages: detail.totalMessages ?? detail.messageCount ?? detail.messages?.length ?? 0,
        hasMore: Boolean(detail.hasMore),
        mode: detail.mode ?? null,
        modeLabel: detail.modeLabel ?? null,
        modeDescription: detail.modeDescription ?? "",
        meta: detail.meta ?? {},
        invalidRecords: detail.invalidRecords ?? 0,
        invalidLines: detail.invalidLines ?? [],
        integrityWarning: detail.integrityWarning ?? null
      });
    } catch (err) {
      if (requestId !== detailRequestRef.current) return;
      setOpen({ kind: "session", name, messages: null, error: err.message });
    } finally {
      if (requestId === detailRequestRef.current) setOpenLoading(false);
    }
  }, []);
  const executeTrash = q2(async (names) => {
    if (names.length === 0) return;
    setDeleting(true);
    setInfo(null);
    try {
      const result = { movedCount: 0, failedCount: 0 };
      for (let offset = 0; offset < names.length; offset += 200) {
        const part = await api("/sessions/batch-trash", { method: "POST", body: { names: names.slice(offset, offset + 200) } });
        result.movedCount += part.movedCount || 0;
        result.failedCount += part.failedCount || 0;
      }
      setSelectedNames(/* @__PURE__ */ new Set());
      if (open && names.includes(open.name)) closeDetail();
      setInfo(`已移入回收站 ${result.movedCount || 0} 个，失败 ${result.failedCount || 0} 个。`);
      await refresh();
    } catch (err) {
      setInfo(err.message);
    } finally {
      setDeleting(false);
    }
  }, [open, refresh, closeDetail]);
  const requestTrash = q2((names) => {
    if (names.length === 0) return;
    if (skipTrashConfirm) { void executeTrash(names); return; }
    setDontAskAgain(false);
    setTrashConfirm({ names });
  }, [skipTrashConfirm, executeTrash]);
  const confirmTrash = q2(() => {
    const names = trashConfirm?.names ?? [];
    if (dontAskAgain) {
      try { localStorage.setItem("visionox.sessions.skipTrashConfirm", "1"); } catch {}
      setSkipTrashConfirm(true);
    }
    setTrashConfirm(null);
    void executeTrash(names);
  }, [trashConfirm, dontAskAgain, executeTrash]);
  const restoreTrashConfirmation = q2(() => {
    try { localStorage.removeItem("visionox.sessions.skipTrashConfirm"); } catch {}
    setSkipTrashConfirm(false);
    setInfo("删除确认已恢复。");
  }, []);
  const remove = q2((name) => requestTrash([name]), [requestTrash]);
  const toggleSelectedSession = q2((name) => {
    setSelectedNames((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);
  const toggleSelectedTrash = q2((id) => {
    setSelectedTrashIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const viewTrash = q2(async (item) => {
    const requestId = ++detailRequestRef.current;
    setInfo(null);
    setRestoreName(item.name);
    setOpen({ kind: "trash", id: item.id, name: item.name, messages: null });
    setOpenLoading(true);
    try {
      const detail = await api(`/sessions/trash/${encodeURIComponent(item.id)}?limit=200`);
      if (requestId !== detailRequestRef.current) return;
      setOpen({ kind: "trash", ...detail, id: item.id, name: detail.name ?? item.name });
      setRestoreName(detail.name ?? item.name);
    } catch (err) {
      if (requestId !== detailRequestRef.current) return;
      setOpen({ kind: "trash", id: item.id, name: item.name, messages: null, error: err.message });
    } finally {
      if (requestId === detailRequestRef.current) setOpenLoading(false);
    }
  }, []);
  const batchTrash = q2(async () => {
    const names = [...selectedNames];
    requestTrash(names);
  }, [selectedNames, requestTrash]);
  const restoreTrashSession = q2(async (id, newName = null) => {
    setDeleting(true);
    setInfo(null);
    try {
      await api(`/sessions/trash/${encodeURIComponent(id)}/restore`, { method: "POST", body: { newName } });
      setInfo("会话已从回收站恢复。");
      setSelectedTrashIds((current) => { const next = new Set(current); next.delete(id); return next; });
      if (open?.kind === "trash" && open.id === id) closeDetail();
      await refresh();
    } catch (err) {
      setInfo(err.message);
    } finally {
      setDeleting(false);
    }
  }, [open, refresh, closeDetail]);
  const batchRestoreTrash = q2(async () => {
    const ids = [...selectedTrashIds];
    if (ids.length === 0) return;
    setDeleting(true);
    setInfo(null);
    try {
      const result = { restoredCount: 0, failedCount: 0 };
      for (let offset = 0; offset < ids.length; offset += 200) {
        const part = await api("/sessions/trash/batch-restore", { method: "POST", body: { items: ids.slice(offset, offset + 200).map((id) => ({ id })) } });
        result.restoredCount += part.restoredCount || 0;
        result.failedCount += part.failedCount || 0;
      }
      setSelectedTrashIds(/* @__PURE__ */ new Set());
      if (open?.kind === "trash" && ids.includes(open.id)) closeDetail();
      setInfo(`已恢复 ${result.restoredCount || 0} 个，失败 ${result.failedCount || 0} 个。名称冲突的会话可打开预览后改名恢复。`);
      await refresh();
    } catch (err) { setInfo(err.message); }
    finally { setDeleting(false); }
  }, [selectedTrashIds, open, refresh, closeDetail]);
  const permanentlyDeleteTrash = q2(async (ids) => {
    if (ids.length === 0 || !confirm(`永久删除 ${ids.length} 个回收站会话？此操作无法撤销。`)) return;
    setDeleting(true);
    setInfo(null);
    try {
      const result = await api("/sessions/trash/batch", { method: "DELETE", body: { ids } });
      setSelectedTrashIds(/* @__PURE__ */ new Set());
      if (open?.kind === "trash" && ids.includes(open.id)) closeDetail();
      setInfo(`已永久删除 ${result.deletedCount || 0} 个，失败 ${result.failedCount || 0} 个。`);
      await refresh();
    } catch (err) { setInfo(err.message); }
    finally { setDeleting(false); }
  }, [open, refresh, closeDetail]);
  const saveTrashRetention = q2(async () => {
    const retentionDays = Math.max(1, Math.min(365, Number(retentionDraft) || 30));
    setDeleting(true);
    try {
      const result = await api("/sessions/trash-retention", { method: "POST", body: { retentionDays } });
      setRetentionDraft(result.retentionDays);
      setInfo(`回收站文件将在 ${result.retentionDays} 天后自动删除。`);
      await refresh();
    } catch (err) {
      setInfo(err.message);
    } finally {
      setDeleting(false);
    }
  }, [retentionDraft, refresh]);
  const exportSession = q2(async (name) => {
    setInfo(null);
    try {
      const res = await api(`/sessions/${encodeURIComponent(name)}/export`, { method: "POST", body: {} });
      setInfo(res.invalidRecords > 0
        ? `${t4("sessions.exported", { path: res.path || res.filename || name })} ${res.integrityWarning || `已跳过 ${res.invalidRecords} 条无法解析的记录。`}`
        : t4("sessions.exported", { path: res.path || res.filename || name }));
    } catch (err) {
      setInfo(t4("sessions.exportFailed", { error: err.message }));
    }
  }, []);
  const loadEarlierTranscript = q2(async () => {
    if (!open?.name || !open?.hasMore || openLoading) return;
    setOpenLoading(true);
    try {
      const offset = open.messages?.length ?? 0;
      const path = open.kind === "trash" ? `/sessions/trash/${encodeURIComponent(open.id)}?limit=200&offset=${offset}` : `/sessions/${encodeURIComponent(open.name)}?limit=200&offset=${offset}`;
      const detail = await api(path);
      setOpen((current) => current?.name === open.name && current?.kind === open.kind ? {
        ...current,
        messages: [...(detail.messages ?? []), ...(current.messages ?? [])],
        totalMessages: detail.totalMessages ?? current.totalMessages,
        hasMore: Boolean(detail.hasMore),
        invalidRecords: detail.invalidRecords ?? current.invalidRecords ?? 0,
        invalidLines: detail.invalidLines ?? current.invalidLines ?? [],
        integrityWarning: detail.integrityWarning ?? current.integrityWarning ?? null,
        error: null
      } : current);
    } catch (err) {
      setOpen((current) => current ? { ...current, error: err.message } : current);
    } finally {
      setOpenLoading(false);
    }
  }, [open, openLoading]);
  const doResume = q2(async (name) => {
    setResuming(true);
    try {
      let currentMessages = 0;
      let currentBusy = false;
      try {
        const cur = await api("/messages");
        currentMessages = cur.totalMessages ?? cur.messages?.length ?? 0;
        currentBusy = Boolean(cur.busy);
      } catch {
      }
      let draftCount = 0;
      try {
        for (let i3 = 0; i3 < localStorage.length; i3++) {
          const key = localStorage.key(i3) || "";
          if ((key === CHAT_DRAFT_KEY || key.startsWith("visionox.chatDraft.v2:")) && (localStorage.getItem(key) || "").trim()) {
            draftCount++;
          }
        }
      } catch {
      }
      if ((currentMessages > 0 || currentBusy || draftCount > 0) && !confirm(t4("sessions.resumeConfirm", {
        messages: currentMessages,
        busy: String(currentBusy),
        drafts: draftCount
      }))) {
        return;
      }
      await api("/submit", { method: "POST", body: { prompt: "", session: name } });
      appBus.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tabId: "chat" } }));
      closeDetail();
    } catch (err) {
      if (open) setOpen({ ...open, error: err.message });
    } finally {
      setResuming(false);
    }
  }, [open, closeDetail]);
  const [renaming, setRenaming] = d2(false);
  const [renameText, setRenameText] = d2("");
  const [renameBusy, setRenameBusy] = d2(false);
  const startRename = q2(() => {
    if (!open) return;
    setRenameText(open.name);
    setRenaming(true);
  }, [open]);
  const cancelRename = q2(() => {
    setRenaming(false);
    setRenameText("");
  }, []);
  const doRename = q2(async () => {
    if (!open || !renameText.trim()) return;
    const oldName = open.name;
    const newName = renameText.trim();
    if (newName === oldName) {
      setRenaming(false);
      return;
    }
    setRenameBusy(true);
    try {
      const res = await api(`/sessions/${encodeURIComponent(oldName)}/rename`, {
        method: "POST",
        body: { newName }
      });
      setRenaming(false);
      setRenameText("");
      if (res.newName) await view(res.newName);
    } catch (err) {
      if (open) setOpen({ ...open, error: t4("sessions.renameFailed", { error: err.message }) });
    } finally {
      setRenameBusy(false);
    }
  }, [open, renameText]);
  const detailChatMessages = T2(() => (open?.messages ?? []).map((m3, i3) => ({
    id: `r-${i3}`,
    role: m3.role === "tool" ? "tool" : m3.role === "assistant" ? "assistant" : m3.role === "user" ? "user" : "info",
    text: m3.content ?? "",
    toolName: m3.toolName
  })), [open?.messages]);
  const transcriptMatches = T2(() => computeChatSearchMatches(detailChatMessages, transcriptSearch), [detailChatMessages, transcriptSearch]);
  y2(() => {
    setTranscriptSearchIndex((cur) => transcriptMatches.length ? Math.min(Math.max(cur, 0), transcriptMatches.length - 1) : 0);
  }, [transcriptSearch, transcriptMatches.length]);
  y2(() => {
    if (!transcriptSearch.trim() || transcriptMatches.length === 0) return;
    const match = transcriptMatches[Math.min(transcriptSearchIndex, transcriptMatches.length - 1)];
    const el = transcriptFeedRef.current?.querySelector(`[data-msg-index="${match.index}"]`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [transcriptSearch, transcriptSearchIndex, transcriptMatches.length]);
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("sessions.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "sessions", error: error.message })}</div>`;
  const sessions = data?.sessions ?? [];
  const query = filter.trim().toLowerCase();
  const filtered = query ? sessions.filter((s3) => [
    s3.name,
    s3.summary,
    s3.searchText,
    s3.modeLabel,
    s3.mode,
    s3.meta?.workspace
  ].filter(Boolean).join(" ").toLowerCase().includes(query)) : sessions;
  const trashItems = data?.trash?.items ?? [];
  const filteredTrash = query ? trashItems.filter((item) => item.name.toLowerCase().includes(query)) : trashItems;
  const allFilteredSelected = filtered.length > 0 && filtered.every((session) => selectedNames.has(session.name));
  const allFilteredTrashSelected = filteredTrash.length > 0 && filteredTrash.every((item) => selectedTrashIds.has(item.id));
  return html4`
    <div class="sessions-grid">
      ${trashConfirm ? html4`<div class="session-confirm-overlay" role="presentation" onClick=${() => setTrashConfirm(null)}><div class="modal-card session-confirm-card" role="dialog" aria-modal="true" aria-labelledby="session-trash-confirm-title" onClick=${(event) => event.stopPropagation()}><div class="modal-card-head"><span class="modal-card-icon" style="color:var(--c-warn)">!</span><div><div class="modal-card-title" id="session-trash-confirm-title">移入回收站</div><div class="modal-card-subtitle">${trashConfirm.names.length === 1 ? `确认将“${trashConfirm.names[0]}”移入回收站？` : `确认将选中的 ${trashConfirm.names.length} 个会话移入回收站？`} 保留期内可以恢复。</div></div></div><label class="checkbox-row"><input type="checkbox" checked=${dontAskAgain} onChange=${(event) => setDontAskAgain(event.target.checked)} /><span>下次不再提示</span></label><div class="modal-actions"><button class="primary" disabled=${deleting} onClick=${confirmTrash}>移入回收站</button><button disabled=${deleting} onClick=${() => setTrashConfirm(null)}>取消</button></div></div></div>` : null}
      ${info ? html4`<div class="card accent-brand session-page-feedback" role="status">${info}</div>` : null}
      <div class="sessions-list">
        <div class="session-list-tabs">
          <button class=${listMode === "sessions" ? "active" : ""} onClick=${() => { setListMode("sessions"); setSelectionMode(false); closeDetail(); }}>会话 <span>${sessions.length}</span></button>
          <button class=${listMode === "trash" ? "active" : ""} onClick=${() => { setListMode("trash"); setSelectionMode(false); closeDetail(); }}>回收站 <span>${trashItems.length}</span></button>
        </div>
        <div class="ssl-h">
          <input
            type="text"
            placeholder=${t4("sessions.filterPlaceholder")}
            value=${filter}
            onInput=${(e3) => setFilter(e3.target.value)}
            style="flex:1"
          />
          <button class=${`btn btn-sm ${selectionMode ? "primary" : ""}`} onClick=${() => { setSelectionMode((value) => !value); setSelectedNames(/* @__PURE__ */ new Set()); setSelectedTrashIds(/* @__PURE__ */ new Set()); }}>${selectionMode ? "退出批量" : "批量管理"}</button>
        </div>
        ${listMode === "trash" ? html4`<div class="session-trash-settings"><span>自动清理</span><select value=${retentionDraft} onChange=${(event) => setRetentionDraft(Number(event.target.value))}><option value="7">7 天</option><option value="15">15 天</option><option value="30">30 天</option><option value="60">60 天</option><option value="90">90 天</option><option value="365">365 天</option></select><button class="btn btn-sm" disabled=${deleting || retentionDraft === data?.trash?.retentionDays} onClick=${saveTrashRetention}>保存</button>${skipTrashConfirm ? html4`<button class="btn btn-sm" onClick=${restoreTrashConfirmation}>恢复删除确认</button>` : null}${trashItems.length > 0 ? html4`<button class="btn btn-sm danger" disabled=${deleting} onClick=${() => permanentlyDeleteTrash(trashItems.map((item) => item.id))}>清空</button>` : null}</div>` : null}
        <div class="ssl-rows">
          ${listMode === "sessions" ? html4`
          ${filtered.length === 0 ? html4`<div style="padding:18px;color:var(--fg-3);font-size:13px">${t4("sessions.noSessions")}</div>` : null}
          ${filtered.map(
    (s3) => html4`
              <div
                class=${`ssl-row ${open?.name === s3.name ? "sel" : ""}`}
                onClick=${() => selectionMode ? toggleSelectedSession(s3.name) : view(s3.name)}
              >
                <div class="session-row-title">${selectionMode ? html4`<input class="session-select-box" type="checkbox" aria-label=${`选择会话 ${s3.name}`} checked=${selectedNames.has(s3.name)} onClick=${(event) => event.stopPropagation()} onChange=${() => toggleSelectedSession(s3.name)} />` : null}<span class="name">${s3.name}</span></div>
                <span class="preview">${s3.summary || t4("sessions.noSummary")}</span>
                <span class="meta">
                  <span><span class="v">${fmtNum(s3.messageCount)}</span> ${t4("sessions.msgs")}</span>
                  ${s3.modeLabel ? html4`<span>${s3.modeLabel}</span>` : null}
                  <span><span class="v">${fmtBytes(s3.size)}</span></span>
                  <span>${fmtRelativeTime(s3.mtime)}</span>
                </span>
              </div>
            `
  )}` : html4`
          ${filteredTrash.length === 0 ? html4`<div style="padding:18px;color:var(--fg-3);font-size:13px">回收站为空</div>` : null}
          ${filteredTrash.map((item) => html4`<div class=${`ssl-row ${open?.kind === "trash" && open.id === item.id ? "sel" : ""}`} onClick=${() => selectionMode ? toggleSelectedTrash(item.id) : viewTrash(item)}>
            <div class="session-row-title">${selectionMode ? html4`<input class="session-select-box" type="checkbox" aria-label=${`选择回收站会话 ${item.name}`} checked=${selectedTrashIds.has(item.id)} onClick=${(event) => event.stopPropagation()} onChange=${() => toggleSelectedTrash(item.id)} />` : null}<span class="name">${item.name}</span></div>
            <span class="preview">${item.fileCount} 个文件 · ${fmtBytes(item.totalBytes)}</span>
            <span class="meta"><span>删除于 ${fmtRelativeTime(Date.parse(item.movedAt))}</span><span>清理于 ${item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "\u2014"}</span></span>
          </div>`)}
          `}
        </div>
        ${selectionMode ? html4`<div class="session-batch-bar"><span>已选 ${listMode === "sessions" ? selectedNames.size : selectedTrashIds.size} 项</span><button class="btn btn-sm" onClick=${() => listMode === "sessions" ? setSelectedNames(allFilteredSelected ? /* @__PURE__ */ new Set() : new Set(filtered.map((session) => session.name))) : setSelectedTrashIds(allFilteredTrashSelected ? /* @__PURE__ */ new Set() : new Set(filteredTrash.map((item) => item.id)))}>${(listMode === "sessions" ? allFilteredSelected : allFilteredTrashSelected) ? "取消全选" : "全选当前"}</button>${listMode === "sessions" ? html4`<button class="btn btn-sm danger" disabled=${deleting || selectedNames.size === 0} onClick=${batchTrash}>移入回收站</button>` : html4`<button class="btn btn-sm" disabled=${deleting || selectedTrashIds.size === 0} onClick=${batchRestoreTrash}>恢复</button><button class="btn btn-sm danger" disabled=${deleting || selectedTrashIds.size === 0} onClick=${() => permanentlyDeleteTrash([...selectedTrashIds])}>永久删除</button>`}</div>` : null}
      </div>

      <div class="sessions-detail">
        ${open == null ? html4`<div style="color:var(--fg-3);font-size:13px;text-align:center;padding:60px 20px">
                ${t4("sessions.pickHint")}
              </div>` : open.kind === "trash" ? html4`
                <div class="sessions-detail-h"><span class="name">${open.name}</span><span class="ws">回收站预览 · ${fmtNum(open.totalMessages ?? open.messages?.length ?? 0)} 条消息</span><span class="actions"><button class="btn ghost" onClick=${closeDetail}>返回</button><button class="btn ghost danger" disabled=${deleting} onClick=${() => permanentlyDeleteTrash([open.id])}>永久删除</button></span></div>
                <div class="card accent-brand session-trash-restore"><div class="card-h"><span class="title">确认内容后恢复</span></div><div class="card-b"><label>恢复后的会话名称</label><div class="session-restore-row"><input class="input" value=${restoreName} onInput=${(event) => setRestoreName(event.target.value)} /><button class="btn primary" disabled=${deleting || !restoreName.trim()} onClick=${() => restoreTrashSession(open.id, restoreName.trim())}>恢复会话</button></div><span>如果原名称已被使用，可以修改名称后恢复，不会覆盖现有会话。</span></div></div>
                ${open.integrityWarning ? html4`<div class="card accent-warn session-integrity-warning" role="alert">${open.integrityWarning}${open.invalidLines?.length ? html4`<span>受影响行：${open.invalidLines.join(", ")}${open.invalidRecords > open.invalidLines.length ? " 等" : ""}</span>` : null}</div>` : null}
                ${openLoading && !open.messages ? html4`<div style="color:var(--fg-3)">${t4("sessions.loadingTranscript")}</div>` : open.error ? html4`<div class="card accent-err">${open.error}</div>` : detailChatMessages.length > 0 ? html4`<div class="chat-feed" ref=${transcriptFeedRef} style="max-height:calc(100vh - 280px);overflow-y:auto">${open.hasMore ? html4`<div class="chat-history-loader"><button type="button" onClick=${loadEarlierTranscript} disabled=${openLoading}>${openLoading ? "加载中..." : "加载更早的 200 条消息"}</button></div>` : null}${detailChatMessages.map((m3, i3) => html4`<${ChatMessage} key=${i3} msg=${m3} index=${i3} streaming=${false} userAvatar=${userAvatar} />`)}</div>` : html4`<div style="color:var(--fg-3)">${t4("sessions.emptyTranscript")}</div>`}
              ` : html4`
                <div class="sessions-detail-h">
                  ${renaming ? html4`
                    <div class="sessions-rename-row">
                      <input
                        type="text"
                        value=${renameText}
                        onInput=${(e3) => setRenameText(e3.target.value)}
                        onKeyDown=${(e3) => { if (e3.key === "Enter") doRename(); if (e3.key === "Escape") cancelRename(); }}
                        placeholder=${t4("sessions.renamePlaceholder")}
                        disabled=${renameBusy}
                      />
                      <button class="btn primary" onClick=${doRename} disabled=${!renameText.trim() || renameBusy}>${t4("common.save")}</button>
                      <button class="btn" onClick=${cancelRename} disabled=${renameBusy}>${t4("common.cancel")}</button>
                    </div>
                  ` : html4`
                    <span class="name">${open.name}</span>
                    <span class="ws">
                      ${open.messages ? t4("sessions.messages", { count: open.totalMessages ?? open.messages.length, s: (open.totalMessages ?? open.messages.length) === 1 ? "" : "s" }) : t4("common.loading")}
                      ${open.modeLabel ? html4` · ${open.modeLabel}` : null}
                    </span>
                    <span class="actions">
                      <button class="btn ghost" onClick=${startRename} disabled=${renameBusy}>${t4("sessions.rename")}</button>
                      <button class="btn ghost" onClick=${() => exportSession(open.name)}>${t4("sessions.exportMarkdown")}</button>
                      <button class="btn ghost" onClick=${closeDetail}>${t4("common.back")}</button>
                      <button class="btn ghost danger" disabled=${deleting} onClick=${() => remove(open.name)}>${deleting ? "..." : t4("common.delete")}</button>
                    </span>
                  `}
                </div>
                <div class="card accent-brand" style="margin-bottom:10px">
                  <div class="card-h"><span class="title">继续会话</span></div>
                  <div class="card-b" style="font-size:12.5px;color:var(--fg-2)">
                    加载历史消息到当前聊天，并恢复保存时的工作场景${open.modeLabel ? html4`（${open.modeLabel}）` : null}，AI 将获得完整上下文，你可以直接继续对话。
                    <button class="btn primary" style="margin-top:8px;width:100%"
                            disabled=${resuming}
                            onClick=${() => doResume(open.name)}>
                      ${resuming ? "加载中..." : "加载并继续会话"}
                    </button>
                  </div>
                </div>
                ${open.integrityWarning ? html4`<div class="card accent-warn session-integrity-warning" role="alert">${open.integrityWarning}${open.invalidLines?.length ? html4`<span>受影响行：${open.invalidLines.join(", ")}${open.invalidRecords > open.invalidLines.length ? " 等" : ""}</span>` : null}</div>` : null}
                ${openLoading && !open.messages ? html4`<div style="color:var(--fg-3)">${t4("sessions.loadingTranscript")}</div>` : open.error ? html4`<div class="card accent-err">${open.error}</div>` : detailChatMessages.length > 0 ? html4`
                          <div class="chat-searchbar session-transcript-search">
                            <span class="chat-search-icon">⌕</span>
                            <input
                              type="search"
                              value=${transcriptSearch}
                              placeholder=${t4("sessions.transcriptSearchPlaceholder")}
                              onInput=${(e3) => {
      setTranscriptSearch(e3.target.value);
      setTranscriptSearchIndex(0);
    }}
                              onKeyDown=${(e3) => {
      if (e3.key === "Enter" && transcriptMatches.length > 0) {
        e3.preventDefault();
        setTranscriptSearchIndex((i3) => e3.shiftKey ? (i3 - 1 + transcriptMatches.length) % transcriptMatches.length : (i3 + 1) % transcriptMatches.length);
      }
    }}
                            />
                            <span class="chat-search-count">
                              ${transcriptSearch.trim() ? t4("sessions.transcriptSearchCount", { current: transcriptMatches.length ? transcriptSearchIndex + 1 : 0, total: transcriptMatches.length }) : t4("sessions.transcriptSearchIdle")}
                            </span>
                            <button type="button" disabled=${transcriptMatches.length === 0} onClick=${() => setTranscriptSearchIndex((i3) => (i3 - 1 + transcriptMatches.length) % transcriptMatches.length)} title=${t4("chat.searchPrev")}>↑</button>
                            <button type="button" disabled=${transcriptMatches.length === 0} onClick=${() => setTranscriptSearchIndex((i3) => (i3 + 1) % transcriptMatches.length)} title=${t4("chat.searchNext")}>↓</button>
                            ${transcriptSearch ? html4`<button type="button" onClick=${() => setTranscriptSearch("")} title=${t4("chat.searchClear")}>×</button>` : null}
                          </div>
                          <div class="chat-feed" ref=${transcriptFeedRef} style="max-height:calc(100vh - 260px);overflow-y:auto">
                            ${open.hasMore ? html4`<div class="chat-history-loader"><button type="button" onClick=${loadEarlierTranscript} disabled=${openLoading}>${openLoading ? "加载中..." : "加载更早的 200 条消息"}</button></div>` : null}
                            ${detailChatMessages.map(
    (m3, i3) => html4`
                                <${ChatMessage}
                                  key=${i3}
                                  msg=${m3}
                                  index=${i3}
                                  searchMatch=${transcriptMatches.length ? i3 === transcriptMatches[Math.min(transcriptSearchIndex, transcriptMatches.length - 1)]?.index : false}
                                  streaming=${false}
                                  userAvatar=${userAvatar}
                                />
                              `
  )}
                          </div>` : html4`<div style="color:var(--fg-3)">${t4("sessions.emptyTranscript")}</div>`}
              `}
      </div>
    </div>
  `;
}

export { SessionsPanel };
