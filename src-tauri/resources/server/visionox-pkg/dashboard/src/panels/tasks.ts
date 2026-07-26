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
import { getLang, t as t4, useLang } from "../i18n/index.js";
import { Select } from "../ui/index.js";
import { pickWorkspaceDirectoryFromBridge, showFileArtifactPreview } from "./chat.js";
const N2: any = preactMemo;

function emptyTaskDraft() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  return {
    id: null,
    kind: "prompt",
    name: "",
    prompt: "",
    executionSource: "prompt",
    skillName: "",
    skillAction: "",
    skillPromptAddendum: "",
    skillArchiveWorkspaceDir: "",
    skillAutoArchive: false,
    skillAutoIndex: false,
    sessionCleanupAction: "preview",
    sessionCleanupStrength: "standard",
    sessionCleanupSemanticMode: "uncertain",
    sessionCleanupPromptAddendum: "",
    knowledgeEnabled: false,
    knowledgeLookbackDays: 30,
    knowledgeAutoIndex: false,
    reportRangeMode: "yesterday",
    reportPeriod: "daily",
    reportStartDate: weekAgo,
    reportEndDate: today,
    reportExport: true,
    workspaceScope: "bound",
    rebindWorkspace: false,
    type: "interval",
    intervalMinutes: 60,
    timeOfDay: "09:00",
    dayOfWeek: 1,
    runMode: "auto",
    weekdaysOnly: false,
    windowEnabled: false,
    windowStart: "09:00",
    windowEnd: "18:00",
    enabled: true
  };
}
function taskDraftFromSchedule(task) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  return {
    id: task.id,
    kind: task.kind === "report" ? "report" : task.kind === "session_cleanup" ? "session_cleanup" : "prompt",
    name: task.name ?? "",
    prompt: task.prompt ?? "",
    executionSource: task.skillName ? "skill" : "prompt",
    skillName: task.skillName ?? "",
    skillAction: task.skillAction ?? "",
    skillPromptAddendum: task.skillPromptAddendum ?? "",
    skillArchiveWorkspaceDir: task.skillArchiveWorkspaceDir ?? "",
    skillAutoArchive: task.skillAutoArchive === true,
    skillAutoIndex: task.skillAutoIndex === true,
    sessionCleanupAction: task.sessionCleanupAction === "delete" ? "delete" : "preview",
    sessionCleanupStrength: ["conservative", "standard", "aggressive"].includes(task.sessionCleanupStrength) ? task.sessionCleanupStrength : "standard",
    sessionCleanupSemanticMode: ["off", "uncertain", "deep"].includes(task.sessionCleanupSemanticMode) ? task.sessionCleanupSemanticMode : "uncertain",
    sessionCleanupPromptAddendum: task.sessionCleanupPromptAddendum ?? "",
    knowledgeEnabled: task.knowledgeEnabled === true,
    knowledgeLookbackDays: Math.max(1, Math.min(365, Number(task.knowledgeLookbackDays) || 30)),
    knowledgeAutoIndex: task.knowledgeAutoIndex === true,
    reportRangeMode: task.reportRangeMode ?? (task.reportPeriod === "daily" ? "yesterday" : task.reportPeriod === "yearly" ? "this_year" : task.reportPeriod === "custom" ? "custom" : "last_week"),
    reportPeriod: task.reportPeriod ?? "daily",
    reportStartDate: task.reportStartDate ?? weekAgo,
    reportEndDate: task.reportEndDate ?? today,
    reportExport: task.reportExport !== false,
    workspaceScope: task.workspaceScope === "current" ? "current" : "bound",
    rebindWorkspace: false,
    type: task.type === "daily" || task.type === "weekly" ? task.type : "interval",
    intervalMinutes: Math.max(1, Math.round((task.intervalMs ?? 60 * 60 * 1e3) / 6e4)),
    timeOfDay: task.timeOfDay ?? "09:00",
    dayOfWeek: Number.isFinite(task.dayOfWeek) ? task.dayOfWeek : 1,
    runMode: task.runMode ?? "auto",
    weekdaysOnly: task.weekdaysOnly === true,
    windowEnabled: task.windowEnabled === true,
    windowStart: task.windowStart ?? "09:00",
    windowEnd: task.windowEnd ?? "18:00",
    enabled: task.enabled !== false
  };
}
function fmtScheduleDate(iso) {
  if (!iso) return t4("tasks.never");
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "\u2014";
  return new Date(ms).toLocaleString();
}
function fmtScheduleRule(task) {
  if (task.type === "daily") return `${t4("tasks.daily")} ${task.timeOfDay ?? "09:00"}`;
  if (task.type === "weekly") {
    const labels = scheduleWeekdayLabels();
    const day = labels[Number.isFinite(task.dayOfWeek) ? task.dayOfWeek : 1] ?? labels[1];
    return `${t4("tasks.weekly")} ${day} ${task.timeOfDay ?? "09:00"}`;
  }
  const mins = Math.max(1, Math.round((task.intervalMs ?? 0) / 6e4));
  if (mins < 60) return `${t4("tasks.every")} ${mins}m`;
  if (mins % 1440 === 0) return `${t4("tasks.every")} ${mins / 1440}d`;
  if (mins % 60 === 0) return `${t4("tasks.every")} ${mins / 60}h`;
  return `${t4("tasks.every")} ${mins}m`;
}
function scheduleWeekdayLabels() {
  return getLang() === "zh-CN"
    ? ["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}
function fmtScheduleDuration(ms) {
  if (!Number.isFinite(ms)) return "\u2014";
  const seconds = Math.max(0, Math.round(ms / 1e3));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const minRest = minutes % 60;
  return minRest ? `${hours}h ${minRest}m` : `${hours}h`;
}
function fmtScheduleTokens(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : "\u2014";
}
function fmtScheduleCost(value) {
  return Number.isFinite(value) ? `$${value.toFixed(6)}` : "\u2014";
}
function fmtTaskKind(task) {
  if (task?.kind === "session_cleanup") return t4("tasks.kindSessionCleanup");
  if (task?.kind === "report") return t4("tasks.kindReport");
  return task?.skillName ? `${t4("tasks.executionSkill")} · ${task.skillName}` : t4("tasks.kindPrompt");
}
function fmtReportPeriod(period) {
  if (period === "daily") return t4("tasks.reportDaily");
  if (period === "weekly") return t4("tasks.reportWeekly");
  if (period === "yearly") return t4("tasks.reportYearly");
  if (period === "custom") return t4("tasks.reportCustom");
  return period || "\u2014";
}
function fmtReportRangeMode(mode, period) {
  if (mode === "today") return t4("tasks.reportToday");
  if (mode === "yesterday") return t4("tasks.reportYesterday");
  if (mode === "this_week") return t4("tasks.reportThisWeek");
  if (mode === "last_week") return t4("tasks.reportLastWeek");
  if (mode === "last_7_days") return t4("tasks.reportLast7Days");
  if (mode === "last_30_days") return t4("tasks.reportLast30Days");
  if (mode === "this_year") return t4("tasks.reportThisYear");
  if (mode === "last_year") return t4("tasks.reportLastYear");
  if (mode === "custom") return t4("tasks.reportFixedRange");
  return fmtReportPeriod(period);
}
function fmtReportRange(item) {
  if (!item?.reportStart && !item?.reportEnd) return "\u2014";
  const start = item.reportStart ? fmtScheduleDate(item.reportStart) : "\u2014";
  const end = item.reportEnd ? fmtScheduleDate(item.reportEnd) : "\u2014";
  return `${start} - ${end}`;
}
function taskStatusPill(task) {
  if (task.workspaceMismatch) return html4`<span class="pill warn">${t4("tasks.workspaceMismatch")}</span>`;
  if (!task.enabled) return html4`<span class="pill">${t4("tasks.disabled")}</span>`;
  if (task.lastStatus === "running") return html4`<span class="pill info">${t4("tasks.running")}</span>`;
  if (task.lastStatus === "stopping") return html4`<span class="pill warn">${t4("tasks.stopping")}</span>`;
  if (task.lastStatus === "completed") return html4`<span class="pill ok">${t4("tasks.completed")}</span>`;
  if (task.lastStatus === "cancelled") return html4`<span class="pill warn">${t4("tasks.cancelled")}</span>`;
  if (task.lastStatus === "failed") return html4`<span class="pill err">${t4("tasks.failed")}</span>`;
  if (task.lastStatus === "accepted") return html4`<span class="pill ok">${t4("tasks.accepted")}</span>`;
  if (task.lastStatus === "skipped") return html4`<span class="pill warn">${t4("tasks.skipped")}</span>`;
  if (task.lastStatus === "deferred") return html4`<span class="pill warn">${t4("tasks.deferred")}${task.queued && task.queuePosition ? ` \u00B7 ${task.queuePosition}` : ""}</span>`;
  if (task.lastStatus === "waiting_auth") return html4`<span class="pill warn">${t4("tasks.skillWaitingAuth")}</span>`;
  if (task.lastStatus === "pending_confirmation") return html4`<span class="pill warn">${t4("tasks.pendingConfirmation")}</span>`;
  if (task.lastStatus === "rejected") return html4`<span class="pill err">${t4("tasks.rejected")}</span>`;
  return html4`<span class="pill info">${t4("tasks.enabled")}</span>`;
}
function scheduleRunPill(status) {
  if (status === "running") return html4`<span class="pill info">${t4("tasks.running")}</span>`;
  if (status === "stopping") return html4`<span class="pill warn">${t4("tasks.stopping")}</span>`;
  if (status === "completed") return html4`<span class="pill ok">${t4("tasks.completed")}</span>`;
  if (status === "cancelled") return html4`<span class="pill warn">${t4("tasks.cancelled")}</span>`;
  if (status === "failed") return html4`<span class="pill err">${t4("tasks.failed")}</span>`;
  if (status === "accepted") return html4`<span class="pill ok">${t4("tasks.accepted")}</span>`;
  if (status === "skipped") return html4`<span class="pill warn">${t4("tasks.skipped")}</span>`;
  if (status === "deferred") return html4`<span class="pill warn">${t4("tasks.deferred")}</span>`;
  if (status === "waiting_auth") return html4`<span class="pill warn">${t4("tasks.skillWaitingAuth")}</span>`;
  if (status === "pending_confirmation") return html4`<span class="pill warn">${t4("tasks.pendingConfirmation")}</span>`;
  if (status === "rejected") return html4`<span class="pill err">${t4("tasks.rejected")}</span>`;
  return html4`<span class="pill">${status || "\u2014"}</span>`;
}
function ScheduledTasksPanel() {
  useLang();
  const { data, error, loading, refresh } = usePoll("/schedules", 3e4);
  const { data: semanticConfig } = usePoll("/semantic/config", 3e4);
  const { data: skillTemplateData } = usePoll("/schedules/templates", 6e4);
  const [selectedId, setSelectedId] = d2(null);
  const [draft, setDraft] = d2(() => emptyTaskDraft());
  const [busy, setBusy] = d2(false);
  const [notice, setNotice] = d2(null);
  const [pendingRunNotice, setPendingRunNotice] = d2(null);
  y2(() => {
    const unsubChanged = subscribeSse("schedule-changed", () => refresh());
    const unsubRun = subscribeSse("schedule-run", () => refresh());
    return () => {
      unsubChanged();
      unsubRun();
    };
  }, [refresh]);
  const schedules = data?.schedules ?? [];
  const skillTemplates = (skillTemplateData?.integrations ?? []).flatMap((integration) => integration.compatible
    ? (integration.templates ?? []).map((template) => ({ ...template, skillName: integration.id, integrationName: integration.displayName, integrationVersion: integration.version }))
    : []);
  const selectedSkillTemplate = skillTemplates.find((template) => template.skillName === draft.skillName && template.id === draft.skillAction) ?? null;
  const pendingSchedules = schedules.filter((task) => task.lastStatus === "pending_confirmation");
  const selected = schedules.find((task) => task.id === selectedId) ?? null;
  const latestRun = selected?.history?.[0] ?? null;
  y2(() => {
    if (!pendingRunNotice) return;
    const task = schedules.find((item) => item.id === pendingRunNotice.taskId);
    const run = task?.history?.find((item) => !pendingRunNotice.runId || item.runId === pendingRunNotice.runId);
    if (!run || run.status === "running") return;
    if (run.status === "completed") setNotice(t4("tasks.runCompleted"));
    else if (run.status === "cancelled") setNotice(t4("tasks.runCancelled"));
    else if (run.status === "failed") setNotice(t4("tasks.runFailed"));
    else if (run.status === "skipped") setNotice(t4("tasks.runSkipped"));
    else if (run.status === "rejected") setNotice(t4("tasks.runRejected"));
    else if (run.status === "pending_confirmation") setNotice(t4("tasks.runPending"));
    else setNotice(run.reason || run.summary || t4("tasks.noSummary"));
    setPendingRunNotice(null);
  }, [pendingRunNotice, schedules]);
  const selectTask = q2((task) => {
    setSelectedId(task.id);
    setDraft(taskDraftFromSchedule(task));
    setNotice(null);
    setPendingRunNotice(null);
  }, []);
  const createNew = q2(() => {
    setSelectedId(null);
    setDraft(emptyTaskDraft());
    setNotice(null);
    setPendingRunNotice(null);
  }, []);
  const saveTask = q2(async () => {
    const body = {
      kind: draft.kind,
      name: draft.name,
      prompt: draft.prompt,
      skillName: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillName : null,
      skillAction: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillAction : null,
      skillPromptAddendum: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillPromptAddendum : "",
      skillArchiveWorkspaceDir: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillArchiveWorkspaceDir : null,
      skillAutoArchive: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillAutoArchive : false,
      skillAutoIndex: draft.kind === "prompt" && draft.executionSource === "skill" ? draft.skillAutoIndex : false,
      sessionCleanupAction: draft.sessionCleanupAction,
      sessionCleanupStrength: draft.sessionCleanupStrength,
      sessionCleanupSemanticMode: draft.sessionCleanupSemanticMode,
      sessionCleanupPromptAddendum: draft.sessionCleanupPromptAddendum,
      knowledgeEnabled: draft.knowledgeEnabled,
      knowledgeLookbackDays: draft.knowledgeLookbackDays,
      knowledgeAutoIndex: draft.knowledgeAutoIndex,
      reportRangeMode: draft.reportRangeMode,
      reportPeriod: draft.reportPeriod,
      reportStartDate: draft.reportStartDate,
      reportEndDate: draft.reportEndDate,
      reportExport: draft.reportExport,
      workspaceScope: draft.workspaceScope,
      rebindWorkspace: draft.rebindWorkspace === true,
      type: draft.type,
      runMode: draft.runMode,
      weekdaysOnly: draft.weekdaysOnly,
      windowEnabled: draft.windowEnabled,
      windowStart: draft.windowStart,
      windowEnd: draft.windowEnd,
      enabled: draft.enabled
    };
    if (draft.type === "daily" || draft.type === "weekly") {
      body.timeOfDay = draft.timeOfDay;
      if (draft.type === "weekly") body.dayOfWeek = Number(draft.dayOfWeek);
    }
    else body.intervalMs = Math.max(1, Number(draft.intervalMinutes) || 1) * 6e4;
    setBusy(true);
    setNotice(null);
    setPendingRunNotice(null);
    try {
      const res = draft.id ? await api(`/schedules/${encodeURIComponent(draft.id)}`, { method: "POST", body }) : await api("/schedules", { method: "POST", body });
      setSelectedId(res.schedule.id);
      setDraft(taskDraftFromSchedule(res.schedule));
      setNotice(t4("tasks.saved"));
      await refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }, [draft, refresh]);
  const toggleTask = q2(async (task) => {
    setBusy(true);
    setNotice(null);
    setPendingRunNotice(null);
    try {
      const res = await api(`/schedules/${encodeURIComponent(task.id)}/toggle`, { method: "POST", body: { enabled: !task.enabled } });
      if (selectedId === task.id) setDraft(taskDraftFromSchedule(res.schedule));
      await refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }, [refresh, selectedId]);
  const runTask = q2(async (task) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api(`/schedules/${encodeURIComponent(task.id)}/run`, { method: "POST", body: {} });
      if (res.queued) {
        setPendingRunNotice(null);
        setNotice(t4("tasks.runQueued"));
      } else {
        setPendingRunNotice({ taskId: task.id, runId: res.runId || null });
        setNotice(t4("tasks.runAccepted"));
      }
      await refresh();
    } catch (err) {
      setPendingRunNotice(null);
      setNotice(err.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  const cancelTask = q2(async (task) => {
    setBusy(true);
    setNotice(null);
    try {
      await api(`/schedules/${encodeURIComponent(task.id)}/cancel`, { method: "POST", body: {} });
      setNotice(t4("tasks.stopRequested"));
      await refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  const viewRunConversation = q2((run) => {
    const id = run?.assistantMessageId || run?.userMessageId;
    if (id) requestChatMessageJump(id);
  }, []);
  const taskResultFileAction = q2(async (kind, path) => {
    if (!path) return;
    try {
      if (kind === "preview") {
        await showFileArtifactPreview({ path });
      } else if (kind === "folder") {
        await api("/artifacts/open-folder", { method: "POST", body: { path } });
        showToast(t4("tasks.openedFolder"), "info");
      } else if (kind === "copy") {
        await writeClipboardText(path);
        showToast(t4("tasks.pathCopied"), "info");
      }
    } catch (err) {
      showToast(err.message || t4("tasks.fileOpFailed"), "error", 5e3);
    }
  }, []);
  const pickSkillArchiveWorkspace = q2(async () => {
    try {
      const path = await pickWorkspaceDirectoryFromBridge();
      if (path) setDraft((current) => ({ ...current, skillArchiveWorkspaceDir: path }));
    } catch (err) {
      showToast(err.message || t4("tasks.pickArchiveWorkspaceFailed"), "error", 5e3);
    }
  }, []);
  const archiveTaskResult = q2(async (task, run) => {
    if (!task?.id || !run?.runId) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await api(`/schedules/${encodeURIComponent(task.id)}/archive`, {
        method: "POST",
        body: { runId: run.runId, autoIndex: task.skillAutoIndex === true }
      });
      showToast(result.duplicate ? t4("tasks.resultArchivedDup") : t4("tasks.resultArchived"), "info", 4e3);
      await refresh();
    } catch (err) {
      setNotice(err.message || t4("tasks.archiveFailed"));
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  const deleteTask = q2(async (task) => {
    if (!confirm(t4("tasks.deleteConfirm"))) return;
    setBusy(true);
    setNotice(null);
    setPendingRunNotice(null);
    try {
      await api(`/schedules/${encodeURIComponent(task.id)}`, { method: "DELETE", body: {} });
      if (selectedId === task.id) createNew();
      setNotice(t4("tasks.deleted"));
      await refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }, [createNew, refresh, selectedId]);
  if (loading && !data) return html4`<div class="card" style="color:var(--fg-3)">${t4("tasks.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("common.loadingFailed", { name: "tasks", error: error.message })}</div>`;
  const validWindow = !draft.windowEnabled || /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.windowStart) && /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.windowEnd) && draft.windowStart < draft.windowEnd;
  const intervalMinutes = Number(draft.intervalMinutes);
  const validInterval = Number.isFinite(intervalMinutes) && intervalMinutes >= 1 && intervalMinutes <= 30 * 24 * 60;
  const validSchedule = draft.type === "daily" || draft.type === "weekly" ? /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.timeOfDay) : validInterval;
  const validReport = draft.reportRangeMode === "custom" ? !!draft.reportStartDate && !!draft.reportEndDate && draft.reportEndDate >= draft.reportStartDate : true;
  const validSkillAddendum = draft.executionSource !== "skill" || draft.skillAction !== "topic-investigation" || draft.skillPromptAddendum.trim().length > 0;
  const validPromptTask = draft.executionSource === "skill" ? Boolean(selectedSkillTemplate) && validSkillAddendum : draft.prompt.trim().length > 0;
  const canSave = validWindow && validSchedule && (draft.kind === "report" ? validReport : draft.kind === "session_cleanup" ? true : validPromptTask);
  const embeddingApiReady = semanticConfig?.provider === "openai-compat" && semanticConfig?.openaiCompat?.apiKeySet === true;
  const weekdayLabels = scheduleWeekdayLabels();
  return html4`
    <div class="sessions-grid">
      <div class="sessions-list">
        <div class="ssl-h">
          <strong>${t4("tasks.title")}</strong>
          <button class="btn ghost" style="margin-left:auto" onClick=${createNew}>${t4("tasks.create")}</button>
        </div>
        ${pendingSchedules.length > 0 ? html4`
          <div class="card accent-warn" style="margin:0 12px 10px">
            <div class="card-h"><span class="title">${t4("tasks.pendingTitle")}</span></div>
            <div class="card-b" style="padding-bottom:8px">${t4("tasks.pendingHint")}</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${pendingSchedules.map((task) => html4`
                <div style="display:flex;gap:8px;align-items:center;min-width:0">
                  <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${task.name || t4("tasks.title")}</span>
                  <button class="btn" disabled=${busy} onClick=${(ev) => { ev.stopPropagation(); selectTask(task); runTask(task); }}>${t4("tasks.runNow")}</button>
                </div>
              `)}
            </div>
          </div>
        ` : null}
        <div class="ssl-rows">
          ${schedules.length === 0 ? html4`<div style="padding:18px;color:var(--fg-3);font-size:13px">${t4("tasks.noTasks")}</div>` : schedules.map((task) => html4`
            <div class=${`ssl-row ${task.id === selectedId ? "sel" : ""}`} onClick=${() => selectTask(task)}>
              <span class="name">${task.name || t4("tasks.title")} ${taskStatusPill(task)}</span>
              <span class="preview">${fmtTaskKind(task)} · ${fmtScheduleRule(task)}</span>
              <span class="meta">
                <span>${t4("tasks.nextRun")}: <span class="v">${fmtScheduleDate(task.nextRunAt)}</span></span>
                <span>${t4("tasks.lastRun")}: ${task.lastRunAt ? fmtScheduleDate(task.lastRunAt) : t4("tasks.never")}</span>
                <button class="btn btn-sm" disabled=${busy} style="margin-left:auto" onClick=${(ev) => { ev.stopPropagation(); selectTask(task); runTask(task); }}>${t4("tasks.testRun")}</button>
              </span>
            </div>
          `)}
        </div>
      </div>

      <div class="sessions-detail">
        <div class="sessions-detail-h">
          <span class="name">${draft.id ? draft.name || t4("tasks.title") : t4("tasks.create")}</span>
          <span class="ws">${selected ? `${fmtScheduleRule(selected)} · ${t4("tasks.nextRun")}: ${fmtScheduleDate(selected.nextRunAt)}` : t4("tasks.selectHint")}</span>
          ${selected ? html4`<span class="actions">${selected.lastStatus === "running" || selected.lastStatus === "stopping" ? html4`<button class="btn danger" disabled=${busy || selected.lastStatus === "stopping"} onClick=${() => cancelTask(selected)}>${selected.lastStatus === "stopping" ? t4("tasks.stoppingAction") : t4("tasks.stopTask")}</button>` : html4`<button class="btn primary" disabled=${busy} onClick=${() => runTask(selected)}>${t4("tasks.testRun")}</button>`}</span>` : null}
        </div>
        ${selected?.workspaceMismatch ? html4`<div class="card accent-warn" style="margin-bottom:10px">${t4("tasks.workspaceMismatchHint")}</div>` : null}
        ${notice ? html4`<div class=${`card ${notice === t4("tasks.saved") || notice === t4("tasks.deleted") || notice === t4("tasks.runAccepted") || notice === t4("tasks.runCompleted") || notice === t4("tasks.runPending") ? "accent-brand" : "accent-err"}`} style="margin-bottom:10px">${notice}</div>` : null}
        ${selected ? html4`
          <div class="card" style="margin-bottom:10px">
            <div class="card-h">
              <span class="title">${t4("tasks.latestResult")}</span>
              ${latestRun ? html4`<span>${scheduleRunPill(latestRun.status)}</span>` : null}
            </div>
            ${latestRun ? html4`
              <div class="card-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;border-bottom:1px solid var(--bd)">
                <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.lastRun")}</div><div class="mono" style="font-size:12px">${fmtScheduleDate(latestRun.startedAt)}</div></div>
                <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.duration")}</div><div class="mono" style="font-size:12px">${fmtScheduleDuration(latestRun.durationMs)}</div></div>
                <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.tokens")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.lastPromptTokens)}</div></div>
                <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cost")}</div><div class="mono" style="font-size:12px">${fmtScheduleCost(latestRun.lastTurnCostUsd)}</div></div>
              </div>
              ${latestRun.reportPeriod ? html4`
                <div class="card-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;border-bottom:1px solid var(--bd)">
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.reportScope")}</div><div style="font-size:12px">${fmtReportRangeMode(latestRun.reportRangeMode, latestRun.reportPeriod)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.reportRange")}</div><div class="mono" style="font-size:12px">${fmtReportRange(latestRun)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.reportSessions")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.reportSessions)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.reportMessages")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.reportMessages)}</div></div>
                </div>
              ` : null}
              ${latestRun.cleanupCandidates !== null && latestRun.cleanupCandidates !== void 0 ? html4`
                <div class="card-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;border-bottom:1px solid var(--bd)">
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.sessionCleanupAction")}</div><div style="font-size:12px">${latestRun.cleanupAction === "delete" ? t4("tasks.sessionCleanupDelete") : t4("tasks.sessionCleanupPreview")}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupCandidates")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupCandidates)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupDeleted")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupDeleted)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupArchive")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupArchive)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupKeep")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupKeep)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupExtract")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupExtract)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupSemanticReviewed")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupSemanticReviewed)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.cleanupFailed")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.cleanupFailed)}</div></div>
                </div>
              ` : null}
              ${latestRun.knowledgeSessionsProcessed !== null && latestRun.knowledgeSessionsProcessed !== void 0 ? html4`
                <div class="card-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;border-bottom:1px solid var(--bd)">
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.knowledgeSessions")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeSessionsProcessed)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.knowledgeDocuments")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens((latestRun.knowledgeDocumentsCreated || 0) + (latestRun.knowledgeDocumentsUpdated || 0))}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.knowledgeAIReviewed")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeAIReviewed || 0)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.knowledgeAIFailed")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeAIFailed || 0)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.knowledgeRejectedLowValue")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeRejectedLowValue || 0)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.knowledgeDocumentsRejected")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeDocumentsRejected || 0)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">${t4("tasks.knowledgeTopicsRemoved")}</div><div class="mono" style="font-size:12px">${fmtScheduleTokens(latestRun.knowledgeTopicsRemoved || 0)}</div></div>
                  <div><div style="color:var(--fg-3);font-size:11px">embedding</div><div style="font-size:12px">${latestRun.semanticIndexStatus || "-"}</div></div>
                </div>
              ` : null}
              <div class="card-b" style="display:flex;flex-direction:column;gap:6px">
                <div style="display:flex;gap:8px;align-items:center;color:var(--fg-3);font-size:12px">
                  <span>${t4("tasks.source")}: ${latestRun.manual ? t4("tasks.manual") : t4("tasks.scheduled")}</span>
                  ${latestRun.runId ? html4`<code class="mono" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${latestRun.runId}</code>` : null}
                  ${latestRun.assistantMessageId || latestRun.userMessageId ? html4`<button class="btn btn-sm" style="margin-left:auto" onClick=${() => viewRunConversation(latestRun)}>${t4("tasks.viewConversation")}</button>` : null}
                </div>
                <div style="color:var(--fg-2);overflow-wrap:anywhere">${latestRun.summary || latestRun.reason || t4("tasks.noSummary")}</div>
                ${latestRun.reportPath ? html4`
                  <div style="display:flex;flex-direction:column;gap:6px;color:var(--fg-3);font-size:12px;overflow-wrap:anywhere">
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      <button class="btn btn-sm" onClick=${() => taskResultFileAction("preview", latestRun.reportPath)}>${t4("tasks.previewReport")}</button>
                      ${selected?.skillName ? html4`<button class="btn btn-sm" disabled=${busy || !selected.skillArchiveWorkspaceDir || latestRun.knowledgeArchiveStatus === "accepted" || latestRun.knowledgeArchiveStatus === "duplicate"} title=${selected.skillArchiveWorkspaceDir ? t4("tasks.archiveQualityTitle") : t4("tasks.archivePickFirstTitle")} onClick=${() => archiveTaskResult(selected, latestRun)}>${latestRun.knowledgeArchiveStatus === "accepted" || latestRun.knowledgeArchiveStatus === "duplicate" ? t4("tasks.archivedState") : t4("tasks.archiveToKnowledge")}</button>` : null}
                    </div>
                    <div>${t4("tasks.reportStored")}</div>
                    ${latestRun.knowledgeArchiveError ? html4`<div style="color:var(--c-warn)">${t4("tasks.knowledgeArchiveLabel")}${latestRun.knowledgeArchiveError}</div>` : null}
                    ${latestRun.reportExportPath ? html4`
                      <div>${t4("tasks.reportExportPath")}: <code class="mono">${latestRun.reportExportPath}</code></div>
                      <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <button class="btn btn-sm" onClick=${() => taskResultFileAction("folder", latestRun.reportExportPath)}>${t4("tasks.openFolder")}</button>
                        <button class="btn btn-sm" onClick=${() => taskResultFileAction("copy", latestRun.reportExportPath)}>${t4("tasks.copyPath")}</button>
                      </div>
                    ` : null}
                    ${latestRun.reportExportError ? html4`<div style="color:var(--c-warn)">${t4("tasks.reportExportFailed", { error: latestRun.reportExportError })}</div>` : null}
                  </div>
                ` : null}
                ${latestRun.cleanupTrashRoot ? html4`<div style="color:var(--fg-3);font-size:12px;overflow-wrap:anywhere">${t4("tasks.cleanupTrashRoot")}: <code class="mono">${latestRun.cleanupTrashRoot}</code></div>` : null}
                ${latestRun.knowledgeOutputPaths?.length ? html4`
                  <div style="display:flex;flex-direction:column;gap:5px;color:var(--fg-3);font-size:12px">
                    ${latestRun.knowledgeOutputPaths.map((path) => html4`
                      <div style="display:flex;gap:6px;align-items:center;min-width:0">
                        <code class="mono" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${path}</code>
                        <button class="btn btn-sm" onClick=${() => taskResultFileAction("preview", path)}>${t4("tasks.previewAction")}</button>
                      </div>
                    `)}
                  </div>
                ` : null}
              </div>
            ` : html4`<div class="card-b">${t4("tasks.noHistory")}</div>`}
          </div>
        ` : null}
        <div class="card">
          <div class="form-row">
            <span class="lbl">${t4("tasks.taskKind")}</span>
            <${Select} value=${draft.kind} ariaLabel=${t4("tasks.taskKind")} onChange=${(kind) => {
    setDraft({
      ...draft,
      kind,
      runMode: kind === "prompt" ? draft.runMode : "auto",
      executionSource: kind === "prompt" ? draft.executionSource : "prompt",
      skillName: kind === "prompt" ? draft.skillName : "",
      skillAction: kind === "prompt" ? draft.skillAction : ""
    });
  }} options=${[
              { value: "prompt", label: t4("tasks.kindPrompt") },
              { value: "report", label: t4("tasks.kindReport") },
              { value: "session_cleanup", label: t4("tasks.kindSessionCleanup") }
            ]} />
          </div>
          <div class="form-row">
            <span class="lbl">${t4("tasks.name")}</span>
            <input class="input" type="text" value=${draft.name} onInput=${(e3) => setDraft({ ...draft, name: e3.target.value })} />
          </div>
          ${draft.kind === "session_cleanup" ? html4`
            <div class="form-row">
              <span class="lbl">${t4("tasks.sessionCleanupAction")}</span>
              <${Select} value=${draft.sessionCleanupAction} ariaLabel=${t4("tasks.ariaCleanupAction")} onChange=${(v) => setDraft({ ...draft, sessionCleanupAction: v })} options=${[{ value: "preview", label: t4("tasks.sessionCleanupPreview") }, { value: "delete", label: t4("tasks.sessionCleanupDelete") }]} />
            </div>
            <div class="form-row">
              <span class="lbl">${t4("tasks.sessionCleanupStrength")}</span>
              <${Select} value=${draft.sessionCleanupStrength} ariaLabel=${t4("tasks.ariaCleanupStrength")} onChange=${(v) => setDraft({ ...draft, sessionCleanupStrength: v })} options=${[{ value: "conservative", label: t4("tasks.sessionCleanupConservative") }, { value: "standard", label: t4("tasks.sessionCleanupStandard") }, { value: "aggressive", label: t4("tasks.sessionCleanupAggressive") }]} />
            </div>
            <div class="form-row">
              <span class="lbl">${t4("tasks.sessionCleanupSemanticMode")}</span>
              <${Select} value=${draft.sessionCleanupSemanticMode} ariaLabel=${t4("tasks.ariaSemanticMode")} onChange=${(v) => setDraft({ ...draft, sessionCleanupSemanticMode: v })} options=${[{ value: "off", label: t4("tasks.sessionCleanupSemanticOff") }, { value: "uncertain", label: t4("tasks.sessionCleanupSemanticUncertain") }, { value: "deep", label: t4("tasks.sessionCleanupSemanticDeep") }]} />
            </div>
            <div class="form-row" style="align-items:flex-start">
              <span class="lbl">${t4("tasks.sessionCleanupPromptAddendum")}</span>
              <textarea
                class="input"
                maxlength="4000"
                rows="5"
                value=${draft.sessionCleanupPromptAddendum}
                onInput=${(e3) => setDraft({ ...draft, sessionCleanupPromptAddendum: e3.target.value.slice(0, 4000) })}
                style="resize:vertical;line-height:1.5"
              ></textarea>
            </div>
            <label class="checkbox-row" style="margin-top:8px;cursor:pointer">
              <input type="checkbox" checked=${draft.knowledgeEnabled} onChange=${(e3) => setDraft({ ...draft, knowledgeEnabled: e3.target.checked, knowledgeAutoIndex: e3.target.checked ? draft.knowledgeAutoIndex : false })} />
              <span>${t4("tasks.knowledgeEnabled")}</span>
            </label>
            ${draft.knowledgeEnabled ? html4`
              <div class="form-row">
                <span class="lbl">${t4("tasks.knowledgeLookbackDays")}</span>
                <input class="input mono" type="number" min="1" max="365" value=${draft.knowledgeLookbackDays} onInput=${(e3) => setDraft({ ...draft, knowledgeLookbackDays: Math.max(1, Math.min(365, Number(e3.target.value) || 30)) })} />
              </div>
              <label class="checkbox-row" style="margin-top:8px;cursor:${embeddingApiReady ? "pointer" : "not-allowed"};opacity:${embeddingApiReady ? 1 : 0.6}">
                <input type="checkbox" disabled=${!embeddingApiReady} checked=${draft.knowledgeAutoIndex && embeddingApiReady} onChange=${(e3) => setDraft({ ...draft, knowledgeAutoIndex: e3.target.checked })} />
                <span>${t4("tasks.knowledgeAutoIndex")}${embeddingApiReady ? "" : ` · ${t4("tasks.knowledgeAutoIndexUnavailable")}`}</span>
              </label>
            ` : null}
            <div class="form-row" style="align-items:flex-start">
              <span class="lbl">${t4("tasks.summary")}</span>
              <div style="flex:1;min-width:0;color:var(--fg-3);font-size:12px;line-height:1.5">${t4("tasks.sessionCleanupHint")}</div>
            </div>
          ` : draft.kind === "report" ? html4`
            <div class="form-row">
              <span class="lbl">${t4("tasks.reportRange")}</span>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <${Select} value=${draft.reportRangeMode} ariaLabel=${t4("tasks.reportRange")} onChange=${(v) => setDraft({ ...draft, reportRangeMode: v })} options=${[
                  { value: "yesterday", label: t4("tasks.reportYesterday") },
                  { value: "today", label: t4("tasks.reportToday") },
                  { value: "last_week", label: t4("tasks.reportLastWeek") },
                  { value: "this_week", label: t4("tasks.reportThisWeek") },
                  { value: "last_7_days", label: t4("tasks.reportLast7Days") },
                  { value: "last_30_days", label: t4("tasks.reportLast30Days") },
                  { value: "this_year", label: t4("tasks.reportThisYear") },
                  { value: "last_year", label: t4("tasks.reportLastYear") },
                  { value: "custom", label: t4("tasks.reportFixedRange") }
                ]} />
                ${draft.reportRangeMode === "custom" ? html4`
                  <span style="color:var(--fg-3);font-size:12px">${t4("tasks.reportStart")}</span>
                  <input class="input mono" type="date" value=${draft.reportStartDate} onInput=${(e3) => setDraft({ ...draft, reportStartDate: e3.target.value })} />
                  <span style="color:var(--fg-3);font-size:12px">${t4("tasks.reportEnd")}</span>
                  <input class="input mono" type="date" value=${draft.reportEndDate} onInput=${(e3) => setDraft({ ...draft, reportEndDate: e3.target.value })} />
                ` : null}
                <label style="display:flex;align-items:center;gap:6px;color:var(--fg-2);font-size:12px">
                  <input type="checkbox" checked=${draft.reportExport} onChange=${(e3) => setDraft({ ...draft, reportExport: e3.target.checked })} />
                  ${t4("tasks.reportExport")}
                </label>
              </div>
            </div>
            <div class="form-row" style="align-items:flex-start">
              <span class="lbl">${t4("tasks.summary")}</span>
              <div style="flex:1;min-width:0;color:var(--fg-3);font-size:12px;line-height:1.5">${t4("tasks.reportTaskHint")}</div>
            </div>
          ` : html4`
            <div class="form-row" style="align-items:flex-start">
              <span class="lbl">${t4("tasks.executionSource")}</span>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                <${Select} value=${draft.executionSource} ariaLabel=${t4("tasks.executionSource")} onChange=${(executionSource) => {
    const first = skillTemplates[0] ?? null;
    setDraft({
      ...draft,
      executionSource,
      skillName: executionSource === "skill" ? draft.skillName || first?.skillName || "" : "",
      skillAction: executionSource === "skill" ? draft.skillAction || first?.id || "" : "",
      runMode: executionSource === "skill" ? "readonly" : draft.runMode
    });
  }} options=${[
                  { value: "prompt", label: t4("tasks.executionPrompt") },
                  { value: "skill", label: t4("tasks.executionSkill") }
                ]} />
              </div>
            </div>
            ${draft.executionSource === "skill" ? html4`
              <div class="form-row" style="align-items:flex-start">
                <span class="lbl">${t4("tasks.skillTemplate")}</span>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                  ${skillTemplates.length > 0 ? html4`
                    <${Select} value=${draft.skillName && draft.skillAction ? `${draft.skillName}/${draft.skillAction}` : ""} ariaLabel=${t4("tasks.skillTemplate")} searchable onChange=${(val) => {
    const template = skillTemplates.find((item) => `${item.skillName}/${item.id}` === val);
    if (!template) return;
    setDraft({ ...draft, skillName: template.skillName, skillAction: template.id, name: draft.name || template.title, runMode: "readonly" });
  }} options=${skillTemplates.map((template) => ({ value: `${template.skillName}/${template.id}`, label: template.title, meta: template.integrationName }))} />
                    <span style="color:var(--fg-3);font-size:11px;line-height:1.45">${selectedSkillTemplate?.description ?? ""}</span>
                    <span style="color:var(--c-warn);font-size:11px;line-height:1.45">${t4("tasks.skillReadOnlyHint")}</span>
                  ` : html4`<span style="color:var(--c-warn);font-size:12px">${t4("tasks.skillTemplateUnavailable")}</span>`}
                </div>
              </div>
              <div class="form-row" style="align-items:flex-start">
                <span class="lbl">${t4("tasks.skillAddendum")}</span>
                <textarea class="input" maxlength="2000" rows="4" placeholder=${t4("tasks.skillAddendumPlaceholder")} value=${draft.skillPromptAddendum} onInput=${(e3) => setDraft({ ...draft, skillPromptAddendum: e3.target.value.slice(0, 2000) })}></textarea>
              </div>
              <div class="form-row" style="align-items:flex-start">
                <span class="lbl">${t4("tasks.knowledgeArchive")}</span>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:7px">
                  <div style="display:flex;gap:7px;align-items:center;min-width:0">
                    <input class="input mono" style="flex:1;min-width:0" readonly value=${draft.skillArchiveWorkspaceDir} placeholder=${t4("tasks.noArchiveWorkspace")} />
                    <button class="btn" type="button" onClick=${pickSkillArchiveWorkspace}>${t4("common.choose")}</button>
                    ${draft.skillArchiveWorkspaceDir ? html4`<button class="btn ghost" type="button" onClick=${() => setDraft({ ...draft, skillArchiveWorkspaceDir: "", skillAutoArchive: false, skillAutoIndex: false })}>${t4("common.clear")}</button>` : null}
                  </div>
                  <span style="color:var(--fg-3);font-size:11px;line-height:1.45">${t4("tasks.archiveFixedHint")}</span>
                  <label style="display:flex;align-items:center;gap:6px;color:var(--fg-2);font-size:12px">
                    <input type="checkbox" disabled=${!draft.skillArchiveWorkspaceDir} checked=${draft.skillAutoArchive} onChange=${(e3) => setDraft({ ...draft, skillAutoArchive: e3.target.checked })} />
                    ${t4("tasks.autoArchiveHQ")}
                  </label>
                  <label style="display:flex;align-items:center;gap:6px;color:var(--fg-2);font-size:12px">
                    <input type="checkbox" disabled=${!draft.skillArchiveWorkspaceDir || !embeddingApiReady} checked=${draft.skillAutoIndex && embeddingApiReady} onChange=${(e3) => setDraft({ ...draft, skillAutoIndex: e3.target.checked })} />
                    ${t4("tasks.autoIndexAfterArchive")}${embeddingApiReady ? "" : ` · ${t4("tasks.needEmbeddingApi")}`}
                  </label>
                </div>
              </div>
            ` : html4`
              <div class="form-row" style="align-items:flex-start">
                <span class="lbl">${t4("tasks.prompt")}</span>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                  <textarea class="input mono" rows="8" placeholder=${t4("tasks.promptPlaceholder")} value=${draft.prompt} onInput=${(e3) => setDraft({ ...draft, prompt: e3.target.value })}></textarea>
                  <span style="color:var(--fg-3);font-size:11px">${t4("tasks.templateVars")}</span>
                </div>
              </div>
              <div class="form-row">
                <span class="lbl">${t4("tasks.runMode")}</span>
                <${Select} value=${draft.runMode} ariaLabel=${t4("tasks.ariaRunMode")} onChange=${(v) => setDraft({ ...draft, runMode: v })} options=${[
                  { value: "auto", label: t4("tasks.runModeAuto") },
                  { value: "readonly", label: t4("tasks.runModeReadonly") },
                  { value: "confirm", label: t4("tasks.runModeConfirm") }
                ]} />
              </div>
              <div class="form-row" style="align-items:flex-start">
                <span class="lbl">${t4("tasks.workspaceScope")}</span>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                  <${Select} value=${draft.workspaceScope} ariaLabel=${t4("tasks.ariaWorkspaceScope")} onChange=${(v) => setDraft({ ...draft, workspaceScope: v, rebindWorkspace: false })} options=${[
                    { value: "bound", label: t4("tasks.workspaceScopeBound") },
                    { value: "current", label: t4("tasks.workspaceScopeCurrent") }
                  ]} />
                  <span style="color:var(--fg-3);font-size:11px;line-height:1.45">${t4("tasks.workspaceScopeHint")}</span>
                </div>
              </div>
            `}
          `}
          <div class="form-row">
            <span class="lbl">${t4("tasks.type")}</span>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <${Select} value=${draft.type} ariaLabel=${t4("tasks.ariaTaskType")} onChange=${(v) => setDraft({ ...draft, type: v })} options=${[
                { value: "daily", label: t4("tasks.daily") },
                { value: "weekly", label: t4("tasks.weekly") },
                { value: "interval", label: t4("tasks.customInterval") }
              ]} />
              ${draft.type === "daily" || draft.type === "weekly" ? html4`
                ${draft.type === "weekly" ? html4`
                  <span style="color:var(--fg-3);font-size:12px">${t4("tasks.dayOfWeek")}</span>
                  <${Select} value=${String(draft.dayOfWeek)} ariaLabel=${t4("tasks.ariaWeekday")} onChange=${(v) => setDraft({ ...draft, dayOfWeek: Number(v) })} options=${weekdayLabels.map((label, idx) => ({ value: String(idx), label }))} />
                ` : null}
                <span style="color:var(--fg-3);font-size:12px">${t4("tasks.at")}</span>
                <input class="input mono" type="time" value=${draft.timeOfDay} onInput=${(e3) => setDraft({ ...draft, timeOfDay: e3.target.value })} />
              ` : html4`
                <span style="color:var(--fg-3);font-size:12px">${t4("tasks.every")}</span>
                <input class="input mono" type="number" min="1" max=${String(30 * 24 * 60)} step="1" style="width:90px" value=${draft.intervalMinutes} onInput=${(e3) => setDraft({ ...draft, intervalMinutes: e3.target.value })} />
                <span style="color:var(--fg-3);font-size:12px">min</span>
              `}
              <label style="display:flex;align-items:center;gap:6px;margin-left:auto;color:var(--fg-2);font-size:12px">
                <input type="checkbox" checked=${draft.enabled} onChange=${(e3) => setDraft({ ...draft, enabled: e3.target.checked })} />
                ${t4("tasks.enabled")}
              </label>
            </div>
          </div>
          <div class="form-row">
            <span class="lbl">${t4("tasks.runWindow")}</span>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <label style="display:flex;align-items:center;gap:6px;color:var(--fg-2);font-size:12px">
                <input type="checkbox" checked=${draft.weekdaysOnly} onChange=${(e3) => setDraft({ ...draft, weekdaysOnly: e3.target.checked })} />
                ${t4("tasks.weekdaysOnly")}
              </label>
              <label style="display:flex;align-items:center;gap:6px;color:var(--fg-2);font-size:12px">
                <input type="checkbox" checked=${draft.windowEnabled} onChange=${(e3) => setDraft({ ...draft, windowEnabled: e3.target.checked })} />
                ${t4("tasks.enableWindow")}
              </label>
              ${draft.windowEnabled ? html4`
                <span style="color:var(--fg-3);font-size:12px">${t4("tasks.from")}</span>
                <input class="input mono" type="time" value=${draft.windowStart} onInput=${(e3) => setDraft({ ...draft, windowStart: e3.target.value })} />
                <span style="color:var(--fg-3);font-size:12px">${t4("tasks.to")}</span>
                <input class="input mono" type="time" value=${draft.windowEnd} onInput=${(e3) => setDraft({ ...draft, windowEnd: e3.target.value })} />
              ` : null}
            </div>
          </div>
          ${selected && draft.kind === "prompt" && draft.executionSource !== "skill" ? html4`
            <div class="form-row">
              <span class="lbl">${t4("tasks.workspace")}</span>
              <div style="min-width:0;display:flex;flex-direction:column;gap:4px">
                <code class="mono" style="font-size:11px;color:var(--fg-2);overflow-wrap:anywhere">${draft.workspaceScope === "current" || draft.rebindWorkspace ? selected.currentWorkspaceDir : selected.workspaceDir || "\u2014"}</code>
                <span style="color:var(--fg-3);font-size:11px">${t4("tasks.currentWorkspace")}: ${selected.currentWorkspaceDir || "\u2014"}</span>
                ${draft.workspaceScope === "bound" && selected.workspaceMismatch ? html4`<button class="btn btn-sm" style="align-self:flex-start" disabled=${draft.rebindWorkspace} onClick=${() => setDraft({ ...draft, rebindWorkspace: true })}>${t4("tasks.workspaceRebind")}</button>` : null}
              </div>
            </div>
          ` : null}
          ${selected && draft.kind === "session_cleanup" ? html4`
            <div class="form-row" style="align-items:flex-start">
              <span class="lbl">${t4("tasks.cleanupWorkspace")}</span>
              <div style="min-width:0;display:flex;flex-direction:column;gap:5px">
                <code class="mono" style="font-size:11px;color:var(--fg-2);overflow-wrap:anywhere">${draft.rebindWorkspace ? selected.currentWorkspaceDir : selected.workspaceDir || "\u2014"}</code>
                <span style="color:var(--fg-3);font-size:11px;line-height:1.45">${t4("tasks.cleanupWorkspaceHint")}</span>
                ${selected.workspaceDifferent ? html4`<button class="btn btn-sm" style="align-self:flex-start" disabled=${draft.rebindWorkspace} onClick=${() => setDraft({ ...draft, rebindWorkspace: true })}>${t4("tasks.workspaceRebind")}</button>` : null}
              </div>
            </div>
          ` : null}
          <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap">
            <button class="primary" disabled=${busy || !canSave} onClick=${() => saveTask()}>${draft.id ? t4("tasks.update") : t4("tasks.save")}</button>
            ${selected ? html4`
              <button disabled=${busy} onClick=${() => toggleTask(selected)}>${selected.enabled ? t4("tasks.disabled") : t4("tasks.enabled")}</button>
              <button class="danger" disabled=${busy} onClick=${() => deleteTask(selected)}>${t4("common.delete")}</button>
            ` : null}
          </div>
          <div style="margin-top:10px;color:var(--fg-3);font-size:12px">${t4("tasks.busyHint")} ${t4("tasks.minInterval")}</div>
        </div>
        ${selected ? html4`
          <div class="card" style="margin-top:10px">
            <div class="card-h"><span class="title">${t4("tasks.history")}</span></div>
            ${(selected.history ?? []).length === 0 ? html4`<div class="card-b">${t4("tasks.noHistory")}</div>` : html4`
              <div style="display:flex;flex-direction:column;gap:8px">
                ${(selected.history ?? []).map((item) => html4`
                  <div style="display:grid;grid-template-columns:130px 100px minmax(0,1fr);gap:8px;align-items:start;font-size:12px;border-bottom:1px solid var(--bd);padding-bottom:8px">
                    <span class="mono" style="color:var(--fg-3)">${fmtScheduleDate(item.startedAt)}</span>
                    <span>${scheduleRunPill(item.status)}</span>
                    <span style="min-width:0;color:var(--fg-2);overflow-wrap:anywhere;display:flex;flex-direction:column;gap:4px">
                      <span style="display:flex;gap:8px;align-items:center;min-width:0;flex-wrap:wrap">
                        <span>
                          ${item.manual ? t4("tasks.manual") : t4("tasks.scheduled")}
                          <span style="color:var(--fg-3)"> · ${t4("tasks.duration")}: ${fmtScheduleDuration(item.durationMs)} · ${t4("tasks.tokens")}: ${fmtScheduleTokens(item.lastPromptTokens)} · ${t4("tasks.cost")}: ${fmtScheduleCost(item.lastTurnCostUsd)}</span>
                        </span>
                        ${item.assistantMessageId || item.userMessageId ? html4`<button class="btn btn-sm" onClick=${() => viewRunConversation(item)}>${t4("tasks.viewConversation")}</button>` : null}
                      </span>
                      <span>${item.summary || item.reason || t4("tasks.noSummary")}</span>
                      ${item.reportPeriod ? html4`<span style="color:var(--fg-3)">
                        ${fmtReportRangeMode(item.reportRangeMode, item.reportPeriod)} · ${t4("tasks.reportRange")}: ${fmtReportRange(item)} · ${t4("tasks.reportSessions")}: ${fmtScheduleTokens(item.reportSessions)} · ${t4("tasks.reportMessages")}: ${fmtScheduleTokens(item.reportMessages)}
                      </span>` : null}
                      ${item.cleanupCandidates !== null && item.cleanupCandidates !== void 0 ? html4`<span style="color:var(--fg-3)">
                        ${item.cleanupAction === "delete" ? t4("tasks.sessionCleanupDelete") : t4("tasks.sessionCleanupPreview")} · ${t4("tasks.cleanupCandidates")}: ${fmtScheduleTokens(item.cleanupCandidates)} · ${t4("tasks.cleanupDeleted")}: ${fmtScheduleTokens(item.cleanupDeleted)} · ${t4("tasks.cleanupArchive")}: ${fmtScheduleTokens(item.cleanupArchive)} · ${t4("tasks.cleanupKeep")}: ${fmtScheduleTokens(item.cleanupKeep)} · ${t4("tasks.cleanupExtract")}: ${fmtScheduleTokens(item.cleanupExtract)} · ${t4("tasks.cleanupSemanticReviewed")}: ${fmtScheduleTokens(item.cleanupSemanticReviewed)} · ${t4("tasks.cleanupFailed")}: ${fmtScheduleTokens(item.cleanupFailed)}
                      </span>` : null}
                      ${item.reportPath ? html4`<span style="color:var(--fg-3);overflow-wrap:anywhere">${t4("tasks.reportExportPath")}: <code class="mono">${item.reportPath}</code></span>` : null}
                      ${item.reason && item.summary && item.reason !== item.summary ? html4`<span style="color:var(--fg-3)">${item.reason}</span>` : null}
                    </span>
                  </div>
                `)}
              </div>
            `}
          </div>
        ` : null}
      </div>
    </div>
  `;
}

export { ScheduledTasksPanel };
