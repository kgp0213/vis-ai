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

function kpi(label, value, delta, deltaTone) {
  const muted = value === "\u2014" || value === "-" || value === null || value === void 0;
  return html4`
    <div class="kpi cock-w-1">
      <div class="label">${label}</div>
      <div class="value" style=${muted ? "color:var(--fg-4)" : ""}>${value ?? "\u2014"}</div>
      ${delta != null ? html4`<div class=${`delta ${deltaTone ?? ""}`}>${delta}</div>` : null}
    </div>
  `;
}
function deltaPctText(deltaPct) {
  if (deltaPct === null) return { text: t4("overview.noPriorData"), tone: "flat" };
  if (Math.abs(deltaPct) < 1) return { text: t4("overview.stable"), tone: "flat" };
  const arrow = deltaPct > 0 ? "\u25B2" : "\u25BC";
  return {
    text: t4("overview.vsPrior", { arrow, pct: Math.abs(deltaPct).toFixed(0) }),
    tone: deltaPct > 0 ? "up" : "down"
  };
}
function deltaPpText(deltaPp) {
  if (deltaPp === null) return { text: t4("overview.noPriorData"), tone: "flat" };
  if (Math.abs(deltaPp) < 0.5) return { text: t4("overview.stable"), tone: "flat" };
  const arrow = deltaPp > 0 ? "\u25B2" : "\u25BC";
  return { text: `${arrow} ${Math.abs(deltaPp).toFixed(1)}pp`, tone: deltaPp > 0 ? "up" : "down" };
}
function deltaCountText(delta) {
  if (delta === null || delta === 0) return { text: t4("overview.stable"), tone: "flat" };
  const arrow = delta > 0 ? "\u25B2" : "\u25BC";
  return { text: `${arrow} ${Math.abs(delta)}`, tone: delta > 0 ? "up" : "down" };
}
function balanceKpi(c3) {
  if (c3.balanceSupported === false) return kpi(t4("overview.balance"), "-", null, "flat");
  if (!c3.balance) return kpi(t4("overview.balance"), "\u2014", null, "flat");
  const symbol = c3.balance.currency === "CNY" ? "\xA5" : c3.balance.currency === "USD" ? "$" : "";
  return kpi(t4("overview.balance"), `${symbol}${c3.balance.total}`, c3.balance.currency, "flat");
}
function budgetKpi(o3) {
  const state = deriveBudgetState(o3.budgetUsd, o3.cockpit?.currentSession?.totalCostUsd ?? null);
  if (state.kind === "off") return null;
  const tone = budgetTone(state);
  const valueColor = tone === "err" ? "color:var(--c-err)" : tone === "warn" ? "color:var(--c-warn)" : "";
  return html4`
    <div class="kpi cock-w-1">
      <div class="label">${t4("overview.budget")}</div>
      <div class="value" style=${valueColor}>${fmtUsd(state.spent)} / ${fmtUsd(state.cap)}</div>
      <div class=${`progress ${tone}`} style="margin-top:4px"><div class="progress-fill" style=${`width:${Math.min(100, state.pct)}%`}></div></div>
    </div>
  `;
}
function tokens7dKpi(c3) {
  if (!c3.tokens7d) return kpi(t4("overview.tokens7d"), "\u2014", t4("overview.noUsageYet"), "flat");
  const d3 = deltaPctText(c3.tokens7d.deltaPct);
  return kpi(t4("overview.tokens7d"), fmtCompactNum(c3.tokens7d.total), d3.text, d3.tone);
}
function cacheHitKpi(c3) {
  if (!c3.cacheHit7d) return kpi(t4("overview.cacheHit"), "\u2014", t4("overview.noUsageYet"), "flat");
  const pct = (c3.cacheHit7d.ratio * 100).toFixed(0);
  const d3 = deltaPpText(c3.cacheHit7d.deltaPp);
  return html4`
    <div class="kpi cock-w-1">
      <div class="label">${t4("overview.cacheHit")}</div>
      <div class="value">${pct}<span class="unit">%</span></div>
      <div class=${`delta ${d3.tone}`}>${d3.text}</div>
    </div>
  `;
}
function toolCallsKpi(c3) {
  if (!c3.toolCalls24h) return kpi(t4("overview.toolCalls24h"), "\u2014", t4("overview.noToolCalls"), "flat");
  const d3 = deltaCountText(c3.toolCalls24h.delta);
  return kpi(t4("overview.toolCalls24h"), fmtNum(c3.toolCalls24h.total), d3.text, d3.tone);
}
function currentSessionBlock(c3) {
  if (!c3.currentSession) {
    return html4`
      <div class="cock-list cock-w-2">
        <div class="ch"><span class="ttl">${t4("overview.currentSession")}</span></div>
        <div style="color:var(--fg-3);font-size:12.5px;padding:8px 0">
          ${t4("overview.noSession")}
        </div>
      </div>
    `;
  }
  const s3 = c3.currentSession;
  const currency = c3.balance?.currency;
  return html4`
    <div class="cock-list cock-w-2">
      <div class="ch"><span class="ttl">${t4("overview.currentSession")}</span></div>
      <div class="card accent-brand" style="margin:0 0 8px;background:transparent;border:none;padding:0">
        <div class="card-h"><span class="glyph">◆</span><span class="title">${s3.id}</span><span class="meta">${s3.turns} turn${s3.turns === 1 ? "" : "s"}</span></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;font-family:var(--font-mono);font-size:11px">
        <div><span style="color:var(--fg-3)">${t4("overview.promptTok")}</span><div style="color:var(--fg-0);font-size:13px;font-weight:600">${fmtNum(s3.lastPromptTokens)}</div></div>
        <div><span style="color:var(--fg-3)">${t4("overview.completionTok")}</span><div style="color:var(--fg-0);font-size:13px;font-weight:600">${fmtNum(s3.completionTokens)}</div></div>
        <div><span style="color:var(--fg-3)">${t4("overview.cost")}</span><div style="color:var(--fg-0);font-size:13px;font-weight:600">${fmtCost(s3.totalCostUsd, currency)}</div></div>
      </div>
    </div>
  `;
}
function costTrendSpark(c3) {
  if (!c3.costTrend14d || c3.costTrend14d.length === 0) {
    return html4`
      <div class="chart cock-w-2">
        <div class="chart-h"><span class="title">${t4("overview.costTrend")}</span></div>
        <div class="chart-v" style="color:var(--fg-4)">—<span class="unit">${t4("overview.noUsageYet")}</span></div>
      </div>
    `;
  }
  const days2 = c3.costTrend14d;
  const total = days2.reduce((s3, d3) => s3 + d3.usd, 0);
  const max2 = Math.max(...days2.map((d3) => d3.usd), 1e-4);
  const w3 = 400;
  const h3 = 60;
  const points2 = days2.map((d3, i3) => {
    const x3 = days2.length === 1 ? 0 : i3 * w3 / (days2.length - 1);
    const y3 = h3 - d3.usd / max2 * (h3 - 6) - 3;
    return `${x3.toFixed(0)},${y3.toFixed(0)}`;
  }).join(" ");
  const area = `${points2} ${w3},${h3} 0,${h3}`;
  const avg = total / days2.length;
  return html4`
    <div class="chart cock-w-2">
      <div class="chart-h"><span class="title">${t4("overview.costTrend")}</span></div>
      <div class="chart-v">${fmtCost(avg, c3.balance?.currency)}<span class="unit">${t4("overview.dayAvg")}</span></div>
      <div class="chart-spark">
        <svg viewBox=${`0 0 ${w3} ${h3}`} preserveAspectRatio="none">
          <polyline fill="none" stroke="var(--c-brand)" stroke-width="1.5" points=${points2} />
          <polyline fill="rgba(121,192,255,.10)" stroke="none" points=${area} />
        </svg>
      </div>
    </div>
  `;
}
function recentPlansRail(c3) {
  return html4`
    <div class="cock-list cock-w-2">
      <div class="ch"><span class="ttl">${t4("overview.recentPlans")}</span></div>
      ${!c3.recentPlans || c3.recentPlans.length === 0 ? html4`<div style="color:var(--fg-3);font-size:12.5px;padding:8px 0">${t4("overview.noPlans")}</div>` : c3.recentPlans.map(
    (p3) => html4`
                <div class=${`rail-step ${p3.status === "done" ? "done" : "active"}`}>
                  <span class="g">${p3.status === "done" ? "\u2713" : "\u23F5"}</span>
                  <span>${p3.title} · ${p3.completedSteps}/${p3.totalSteps} step${p3.totalSteps === 1 ? "" : "s"}</span>
                  <span style="margin-left:auto;color:var(--fg-4);font-family:var(--font-mono);font-size:10.5px">${fmtRelativeTime(p3.whenMs)}</span>
                </div>
              `
  )}
    </div>
  `;
}
function toolActivityFeed(c3) {
  return html4`
    <div class="cock-list cock-w-2">
      <div class="ch"><span class="ttl">${t4("overview.toolActivity")}</span></div>
      ${!c3.toolActivity || c3.toolActivity.length === 0 ? html4`<div style="color:var(--fg-3);font-size:12.5px;padding:8px 0">${t4("overview.noToolCalls")}</div>` : c3.toolActivity.map(
    (r3) => html4`
                <div class=${`feed-row ${r3.level}`}>
                  <span class="g">${r3.level === "ok" ? "\u25CF" : r3.level === "warn" ? "\u25B2" : "\u2715"}</span>
                  <span class="name">${r3.name}${r3.args ? html4` <span class="args">${r3.args}</span>` : null}</span>
                  <span class="when" style="margin-left:auto">${fmtRelativeTime(r3.whenMs)}</span>
                </div>
              `
  )}
    </div>
  `;
}
function OverviewPanel() {
  useLang();
  const [modelChecking, setModelChecking] = d2(false);
  const [actionFeedback, setActionFeedback] = d2(null);
  const [backupBusy, setBackupBusy] = d2(false);
  const [backupPreview, setBackupPreview] = d2(null);
  const [backupRetentionDraft, setBackupRetentionDraft] = d2(10);
  const { data, error, loading, refresh } = usePoll("/overview", 5e3, "overview");
  const { data: healthData, error: healthError, refresh: refreshHealth } = usePoll("/health", 5e3, "health");
  const { data: backupsData, refresh: refreshBackups } = usePoll("/backups", 15e3);
  const { data: backupEstimate } = usePoll("/backups/estimate", 3e4);
  const { data: retrievalData } = usePoll("/index-retrieval-mode", 5e3);
  y2(() => {
    if (Number.isFinite(backupsData?.retentionCount)) setBackupRetentionDraft(backupsData.retentionCount);
  }, [backupsData?.retentionCount]);
  const runModelChecks = q2(async () => {
    if (modelChecking) return;
    setModelChecking(true);
    setActionFeedback(null);
    try {
      const tested = await api("/providers/test", { method: "POST", body: {} });
      setActionFeedback({ tone: tested.passed > 0 ? "ok" : "warn", text: t4("overview.modelCheckDone", { passed: tested.passed, total: tested.total }) });
      await refresh();
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.modelCheckFailed", { error: err.message }) });
    } finally {
      setModelChecking(false);
    }
  }, [modelChecking, refresh]);
  const createBackup = q2(async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setActionFeedback(null);
    try {
      const created = await api("/backups", { method: "POST", body: {} });
      setBackupPreview(null);
      setActionFeedback({ tone: "ok", text: t4("overview.backupCreated", { count: created.fileCount, size: fmtBytes(created.totalBytes) }) });
      await Promise.all([refreshBackups(), refreshHealth()]);
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.backupFailed", { error: err.message }) });
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy, refreshBackups, refreshHealth]);
  const previewBackup = q2(async (id) => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      setBackupPreview(await api(`/backups/${encodeURIComponent(id)}/preview`));
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.restoreFailed", { error: err.message }) });
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy]);
  const restoreBackup = q2(async (id, overwrite) => {
    if (backupBusy || overwrite && !globalThis.confirm(t4("overview.restoreConfirm"))) return;
    setBackupBusy(true);
    try {
      const restored = await api(`/backups/${encodeURIComponent(id)}/restore`, { method: "POST", body: { overwrite } });
      setActionFeedback({ tone: "ok", text: t4("overview.restoreDone", restored) });
      setBackupPreview(await api(`/backups/${encodeURIComponent(id)}/preview`));
      await refreshHealth();
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.restoreFailed", { error: err.message }) });
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy, refreshHealth]);
  const saveBackupRetention = q2(async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const result = await api("/backups/retention", { method: "POST", body: { retentionCount: globalThis.VisionoxBackupPolicy.normalizeRetentionCount(backupRetentionDraft) } });
      setBackupRetentionDraft(result.retentionCount);
      setBackupPreview(null);
      await Promise.all([refreshBackups(), refreshHealth()]);
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.backupFailed", { error: err.message }) });
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy, backupRetentionDraft, refreshBackups, refreshHealth]);
  const deleteBackup = q2(async (id) => {
    if (backupBusy || !globalThis.confirm(t4("overview.deleteBackupConfirm"))) return;
    setBackupBusy(true);
    try {
      await api(`/backups/${encodeURIComponent(id)}`, { method: "DELETE", body: {} });
      if (backupPreview?.id === id) setBackupPreview(null);
      await Promise.all([refreshBackups(), refreshHealth()]);
    } catch (err) {
      setActionFeedback({ tone: "err", text: t4("overview.backupFailed", { error: err.message }) });
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy, backupPreview?.id, refreshBackups, refreshHealth]);
  if (loading && !data)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("overview.loading")}</div>`;
  if (error) return html4`<div class="card accent-err">${t4("overview.failed", { error: error.message })}</div>`;
  if (!data) return null;
  const o3 = data;
  const h3 = healthData;
  const storageHealth = h3?.storage?.backups ? h3.storage : null;
  const c3 = o3.cockpit ?? {
    balance: null,
    tokens7d: null,
    cacheHit7d: null,
    costTrend14d: null,
    currentSession: null,
    toolCalls24h: null,
    recentPlans: null,
    toolActivity: null
  };
  const workspaceName = o3.cwd?.split(/[\\/]/).filter(Boolean).at(-1) ?? "\u2014";
  const sceneName = o3.activeMode?.label ?? o3.workMode ?? "\u2014";
  const budgetState = deriveBudgetState(o3.budgetUsd, c3.currentSession?.totalCostUsd ?? null);
  const alertStates = globalThis.VisionoxOverviewAlertPolicy.evaluate({
    modelVerificationDirty: o3.modelVerification?.dirty,
    modelDrift: o3.modelDrift,
    pendingEdits: o3.pendingEdits,
    corruptBackups: storageHealth?.backups?.corrupt,
    storageIssues: h3?.storageIssues?.length,
    retrievalMode: retrievalData?.mode,
    semanticAvailable: retrievalData?.semanticAvailable,
    budgetKind: budgetState.kind,
    budgetPct: budgetState.pct
  });
  const alerts = alertStates.map((alert) => {
    if (alert.kind === "model_retest") return { tone: alert.tone, text: t4("overview.retestModels"), label: modelChecking ? t4("overview.checkingModels") : t4("overview.checkModels"), action: runModelChecks, disabled: modelChecking };
    if (alert.kind === "model_drift") return { tone: alert.tone, text: t4("overview.modelDrift") };
    if (alert.kind === "pending_edits") return { tone: alert.tone, text: t4("overview.pendingEdits", { count: alert.count }) };
    if (alert.kind === "corrupt_backups") return { tone: alert.tone, text: t4("overview.backupCorrupt", { count: alert.count }) };
    if (alert.kind === "storage_issues") return { tone: alert.tone, text: t4("overview.storageIssues", { count: alert.count }) };
    if (alert.kind === "missing_index") return { tone: alert.tone, text: t4("overview.missingIndex"), label: t4("overview.openIndex"), action: () => appBus.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tabId: "semantic" } })) };
    if (alert.kind === "budget") return { tone: alert.tone, text: t4("overview.budgetWarning", { pct: Math.round(alert.pct) }) };
    return null;
  }).filter(Boolean);
  const missingRequiredIndex = alertStates.some((alert) => alert.kind === "missing_index");
  return html4`
    <div style="display:flex;flex-direction:column;gap:14px">
      ${o3.mode === "standalone" ? html4`<div class="card accent-warn">
              <div class="card-h">
                <span class="title" style="color:var(--c-warn)">${t4("overview.standaloneTitle")}</span>
              </div>
              <div class="card-b">
                ${t4("overview.standaloneDesc")}
              </div>
            </div>` : null}

      <h3 style="margin:0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">
        ${t4("overview.workStatus")}
      </h3>
      <div class="health-grid">
        <div class="health-item"><div class="lbl">${t4("overview.workspace")}</div><div class="v">${workspaceName}</div><div class="meta">${o3.session ?? t4("overview.noSession")}</div></div>
        <div class="health-item"><div class="lbl">${t4("overview.provider")}</div><div class="v">${o3.activeProviderName ?? o3.activeProviderId ?? "\u2014"}</div><div class="meta">${t4("overview.runtimeModel")}: ${o3.runtimeModel ?? o3.displayModel ?? "\u2014"}</div></div>
        <div class="health-item"><div class="lbl">${t4("overview.presetMode")}</div><div class="v">${o3.preset ?? "auto"}</div><div class="meta">${o3.requestPolicy === "json" ? "JSON \u53C2\u6570" : o3.reasoningEffort ?? "\u2014"}</div></div>
        <div class="health-item"><div class="lbl">${t4("overview.workScene")}</div><div class="v">${sceneName}</div><div class="meta">${o3.editMode ?? "\u2014"}</div></div>
        <div class=${`health-item ${missingRequiredIndex ? "warn" : ""}`}><div class="lbl">${t4("system.semanticIndex")}</div><div class="v">${o3.semanticIndexExists ? t4("overview.semanticReady") : t4("overview.semanticMissing")}</div><div class="meta">${o3.semanticIndexExists ? t4("system.built") : t4("system.runIndex")}</div></div>
      </div>

      ${alerts.length > 0 ? html4`
        <h3 style="margin:4px 0 0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${t4("overview.attention")}</h3>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${alerts.map((alert) => html4`<div class=${`card accent-${alert.tone}`} style="padding:10px 12px;display:flex;align-items:center;gap:12px;color:${alert.tone === "err" ? "var(--c-err)" : "var(--c-warn)"}"><span style="flex:1">${alert.text}</span>${alert.action ? html4`<button type="button" disabled=${alert.disabled} onClick=${alert.action}>${alert.label}</button>` : null}</div>`)}
        </div>
      ` : null}
      ${actionFeedback ? html4`<div class=${`card accent-${actionFeedback.tone === "ok" ? "brand" : actionFeedback.tone}`} style="padding:10px 12px">${actionFeedback.text}</div>` : null}

      <h3 style="margin:4px 0 0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${t4("overview.sessionAndPlans")}</h3>
      <div class="cockpit">
        ${currentSessionBlock(c3)}
        ${budgetKpi(o3)}
        ${recentPlansRail(c3)}
      </div>

      <h3 style="margin:4px 0 0;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${t4("overview.localSystem")}</h3>
      ${healthError ? html4`<div class="card accent-warn">${t4("common.loadingFailed", { name: "health", error: healthError.message })}</div>` : null}
      ${h3 ? html4`
        <div class="health-grid">
          <div class=${`health-item ${h3.latestVersion && compareVersions(h3.version, h3.latestVersion) < 0 ? "warn" : ""}`}><div class="lbl">${t4("system.version")}</div><div class="v">${h3.version ?? "\u2014"}</div><div class="meta">${h3.latestVersion && compareVersions(h3.version, h3.latestVersion) < 0 ? t4("system.latestVer", { version: h3.latestVersion }) : t4("system.upToDate")}</div></div>
          <div class="health-item"><div class="lbl">${t4("system.sessions")}</div><div class="v">${fmtBytes(h3.sessions.totalBytes)}</div><div class="meta">${fmtNum(h3.sessions.count)} ${t4("system.files")}</div></div>
          <div class="health-item"><div class="lbl">${t4("system.memory")}</div><div class="v">${fmtBytes(h3.memory.totalBytes)}</div><div class="meta">${fmtNum(h3.memory.fileCount)} ${t4("system.files")}</div></div>
          <div class="health-item"><div class="lbl">${t4("system.semanticIndex")}</div><div class="v">${h3.semantic.exists ? fmtBytes(h3.semantic.totalBytes) : "\u2014"}</div><div class="meta">${h3.semantic.exists ? `${fmtNum(h3.semantic.fileCount)} ${t4("system.files")}` : t4("system.runIndex")}</div></div>
          ${storageHealth ? html4`<div class="health-item"><div class="lbl">${t4("overview.userDataSize")}</div><div class="v">${fmtBytes(storageHealth.totalBytes)}</div><div class="meta">${["current", "migrated"].includes(storageHealth.configStatus) ? t4("overview.storageHealthy") : storageHealth.configStatus ?? "\u2014"}</div></div>` : null}
          ${storageHealth ? html4`<div class=${`health-item ${storageHealth.backups.corrupt > 0 ? "warn" : ""}`}><div class="lbl">${t4("overview.latestBackup")}</div><div class="v">${storageHealth.backups.latestAt ? new Date(storageHealth.backups.latestAt).toLocaleString() : t4("overview.noBackup")}</div><div class="meta">${t4("overview.backupCount", { count: fmtNum(storageHealth.backups.count), size: fmtBytes(storageHealth.sources?.sessions?.totalBytes ?? 0) })}</div></div>` : null}
          ${h3.jobs > 0 ? html4`<div class="health-item"><div class="lbl">${t4("system.backgroundJobs")}</div><div class="v">${t4("system.running", { count: fmtNum(h3.jobs) })}</div><div class="meta">${t4("system.shellSpawn")}</div></div>` : null}
        </div>
        <details class="card" style="padding:10px 14px">
          <summary style="cursor:pointer;color:var(--fg-2);font-size:12px">${t4("overview.dataProtection")}</summary>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
            <div style="display:flex;align-items:center;gap:8px"><button type="button" disabled=${backupBusy} onClick=${createBackup}>${backupBusy ? t4("overview.backupCreating") : t4("overview.createBackup")}</button><span class="dim" style="min-width:0;overflow-wrap:anywhere">${storageHealth?.backups?.path ?? ""}</span></div>
            ${backupEstimate ? html4`<span class="dim">${t4("overview.backupEstimate", { size: fmtBytes(backupEstimate.estimatedBytes), count: fmtNum(backupEstimate.fileCount), free: backupEstimate.freeBytes == null ? "\u2014" : fmtBytes(backupEstimate.freeBytes) })}</span>` : null}
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><label>${t4("overview.backupRetention")} <input type="number" min="1" max="100" value=${backupRetentionDraft} onInput=${(event) => setBackupRetentionDraft(Number(event.target.value))} style="width:72px" /></label><button type="button" class="btn ghost" disabled=${backupBusy || backupRetentionDraft === backupsData?.retentionCount} onClick=${saveBackupRetention}>${t4("overview.saveRetention")}</button></div>
            ${(backupsData?.items ?? []).slice(0, 5).map((item) => html4`<div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;border-top:1px solid var(--line);padding-top:8px"><span style="min-width:0"><strong>${item.status === "ok" ? new Date(item.createdAt).toLocaleString() : item.id}</strong><br><span class="dim">${item.status === "ok" ? `${fmtNum(item.fileCount)} ${t4("system.files")} / ${fmtBytes(item.totalBytes)}` : item.error}</span></span>${item.status === "ok" ? html4`<button type="button" class="btn ghost" disabled=${backupBusy} onClick=${() => previewBackup(item.id)}>${t4("overview.previewBackup")}</button>` : null}<button type="button" class="btn ghost danger" disabled=${backupBusy} onClick=${() => deleteBackup(item.id)}>${t4("overview.deleteBackup")}</button></div>`)}
            ${backupPreview ? (() => { const actions = globalThis.VisionoxBackupPolicy.restoreActions(backupPreview.counts); return html4`<div style="border-top:1px solid var(--line);padding-top:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span style="flex:1;min-width:220px">${t4("overview.previewCounts", backupPreview.counts)}</span><button type="button" class="btn ghost" disabled=${backupBusy || !actions.canRestoreMissing} onClick=${() => restoreBackup(backupPreview.id, false)}>${t4("overview.restoreMissing")}</button><button type="button" class="btn ghost" disabled=${backupBusy || !actions.canOverwriteConflicts} onClick=${() => restoreBackup(backupPreview.id, true)}>${t4("overview.restoreAll")}</button></div>`; })() : null}
          </div>
        </details>
        <details class="card" style="padding:10px 14px">
          <summary style="cursor:pointer;color:var(--fg-2);font-size:12px">${t4("overview.userDataPaths")}</summary>
          <table class="tbl" style="margin-top:8px"><tbody style="font-size:11.5px">
            <tr><td class="dim">${t4("system.home")}</td><td class="path">${h3.visionoxHome}</td></tr>
            <tr><td class="dim">${t4("system.sessionsPath")}</td><td class="path">${h3.sessions.path}</td></tr>
            <tr><td class="dim">${t4("system.memoryPath")}</td><td class="path">${h3.memory.path}</td></tr>
            <tr><td class="dim">${t4("system.semanticPath")}</td><td class="path">${h3.semantic.path}</td></tr>
          </tbody></table>
        </details>
      ` : null}
    </div>
  `;
}

export { OverviewPanel };
