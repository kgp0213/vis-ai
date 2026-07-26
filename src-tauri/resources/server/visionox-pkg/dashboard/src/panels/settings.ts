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
import { getLang, setLang, t as t4, useLang } from "../i18n/index.js";
import { Select } from "../ui/index.js";
import { providerDisplayGroups } from "./chat.js";
const N2: any = preactMemo;

function fmtUsd22(n3) {
  return `$${n3.toFixed(n3 < 1 ? 4 : 2)}`;
}
function formatPricing(p3) {
  if (!p3) return null;
  return t4("settings.modelPricingLine", {
    hit: p3.inputCacheHit.toFixed(3),
    miss: p3.inputCacheMiss.toFixed(3),
    out: p3.output.toFixed(3)
  });
}
function ModelRow({
  current,
  catalog,
  saving,
  locked,
  onPick
}) {
  const list2 = catalog?.models ?? null;
  const ready = list2 && list2.length > 0;
  if (!ready) {
    return html4`<code class="mono">${current ?? "\u2014"}</code>`;
  }
  const options2 = list2.includes(current) ? list2 : [current, ...list2];
  const price = catalog?.pricing[current];
  return html4`
    <span style="display:inline-flex;flex-direction:column;gap:4px">
      <${Select}
        value=${current}
        onChange=${(next) => {
    if (next && next !== current) onPick(next);
  }}
        disabled=${saving || locked}
        searchable
        width="220px"
        ariaLabel=${t4("setPanel.ariaModel")}
        options=${options2.map((m3) => ({ value: m3, label: m3 }))}
      />
      ${price ? html4`<span style="color:var(--fg-3);font-size:11px;font-family:var(--font-mono)">${formatPricing(price)}</span>` : null}
    </span>
  `;
}
function BudgetGauge({ state }) {
  if (state.kind === "off") return null;
  const tone = budgetTone(state);
  const fill = Math.min(100, state.pct);
  const valueColor = tone === "err" ? "color:var(--c-err)" : tone === "warn" ? "color:var(--c-warn)" : "color:var(--fg-1)";
  return html4`
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13px">
        <span style=${valueColor}>
          <strong style="font-family:var(--font-mono)">${fmtUsd22(state.spent)}</strong>
          <span style="color:var(--fg-3)"> ${t4("settings.budgetOf")} </span>
          <strong style="font-family:var(--font-mono)">${fmtUsd22(state.cap)}</strong>
        </span>
        <span style=${`font-family:var(--font-mono);font-size:11px;${valueColor}`}>${state.pct.toFixed(1)}%</span>
      </div>
      <div class=${`progress ${tone}`}><div class="progress-fill" style=${`width:${fill}%`}></div></div>
      <span style="color:var(--fg-3);font-size:11px">
        ${state.kind === "exhausted" ? t4("settings.budgetRefusing") : state.kind === "warn" ? t4("settings.budgetWarnLine") : t4("settings.budgetIdleLine")}
      </span>
    </div>
  `;
}
function BudgetSection({ state, saving, onSetCap, onClear }) {
  const [custom, setCustom] = d2("");
  const submitCustom = () => {
    const n3 = Number.parseFloat(custom);
    if (Number.isFinite(n3) && n3 > 0) {
      onSetCap(n3);
      setCustom("");
    }
  };
  const quickButtons = (caps) => caps.map(
    (c3) => html4`
        <button
          key=${c3}
          class="btn"
          style="font-family:var(--font-mono)"
          disabled=${saving}
          onClick=${() => onSetCap(c3)}
        >$${c3}</button>
      `
  );
  const customField = html4`
    <span style="display:inline-flex;align-items:center;gap:4px;margin-left:auto">
      <span style="color:var(--fg-3);font-size:11px">${t4("settings.budgetCustom")}</span>
      <input
        type="number"
        min="0.01"
        step="0.01"
        value=${custom}
        placeholder="0.00"
        onInput=${(e3) => setCustom(e3.target.value)}
        onKeyDown=${(e3) => {
    if (e3.key === "Enter") submitCustom();
  }}
        style="width:72px;font-family:var(--font-mono)"
        disabled=${saving}
      />
      <button
        class="btn primary"
        disabled=${saving || !(Number.parseFloat(custom) > 0)}
        onClick=${submitCustom}
      >→</button>
    </span>
  `;
  return html4`
    <div class="card" style="display:flex;flex-direction:column;gap:12px">
      <${BudgetGauge} state=${state} />

      ${state.kind === "off" ? html4`
              <div>
                <div style="color:var(--fg-3);font-size:11px;margin-bottom:6px">${t4("settings.budgetSetCap")}</div>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  ${quickButtons(QUICK_CAPS_USD)}
                  ${customField}
                </div>
              </div>
            ` : state.kind === "warn" || state.kind === "exhausted" ? html4`
                <div>
                  <div style="color:var(--fg-3);font-size:11px;margin-bottom:6px">${t4("settings.budgetBumpHint")}</div>
                  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    ${bumpSuggestions(state.cap).map(
    (next) => html4`
                        <button
                          key=${next}
                          class="btn primary"
                          style="font-family:var(--font-mono)"
                          disabled=${saving}
                          onClick=${() => onSetCap(next)}
                        >→ $${next % 1 === 0 ? next : next.toFixed(2)}</button>
                      `
  )}
                    ${customField}
                  </div>
                  <div style="margin-top:8px">
                    <button class="btn" disabled=${saving} onClick=${onClear}>${t4("settings.budgetClear")}</button>
                  </div>
                </div>
              ` : html4`
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  ${bumpSuggestions(state.cap).map(
    (next) => html4`
                      <button
                        key=${next}
                        class="btn"
                        style="font-family:var(--font-mono)"
                        disabled=${saving}
                        onClick=${() => onSetCap(next)}
                      >→ $${next % 1 === 0 ? next : next.toFixed(2)}</button>
                    `
  )}
                  ${customField}
                  <button
                    class="btn"
                    style="margin-left:8px"
                    disabled=${saving}
                    onClick=${onClear}
                  >${t4("settings.budgetClear")}</button>
                </div>
              `}
    </div>
  `;
}
function LoopSection({
  status,
  remainingMs,
  avgIterCostUsd,
  busy,
  onStart,
  onStop
}) {
  const [intervalMs, setIntervalMs] = d2(INTERVAL_PRESETS_MS[1].ms);
  const [prompt, setPrompt] = d2("");
  const [customValue, setCustomValue] = d2("");
  const [customUnit, setCustomUnit] = d2("m");
  if (status) {
    return html4`
      <div class="card" style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="color:var(--c-warn);font-family:var(--font-mono);font-size:11px">⟳ ${t4("settings.loopRunning")}</span>
          <span style="color:var(--fg-3);font-size:11px">
            ${t4("settings.loopIter", { iter: status.iter })} · ${t4("settings.loopFiresIn", { remaining: formatRemaining(remainingMs) })}
          </span>
        </div>
        <div style="background:var(--bg-elev-2);border:1px solid var(--bd);border-radius:var(--r);padding:8px 10px;font-family:var(--font-mono);font-size:12px;color:var(--fg-1);white-space:pre-wrap;max-height:120px;overflow-y:auto">${status.prompt}</div>
        <div>
          <button class="btn danger" disabled=${busy} onClick=${onStop}>${t4("settings.loopStop")}</button>
        </div>
      </div>
    `;
  }
  const customMs = parseCustomInterval(customValue, customUnit);
  const canStart = !busy && intervalMs > 0 && prompt.trim().length > 0;
  return html4`
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div style="color:var(--fg-3);font-size:11px">
        ${t4("settings.loopIdleHint")}
        ${typeof avgIterCostUsd === "number" && avgIterCostUsd > 0 ? html4` ${t4("settings.loopCostHint", { cost: `$${avgIterCostUsd.toFixed(4)}` })}` : null}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <span style="color:var(--fg-3);font-size:11px">${t4("settings.loopInterval")}</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${INTERVAL_PRESETS_MS.map(
    (p3) => html4`
              <button
                key=${p3.ms}
                class=${`btn ${intervalMs === p3.ms && customValue === "" ? "primary" : ""}`}
                style="font-family:var(--font-mono)"
                disabled=${busy}
                onClick=${() => {
      setIntervalMs(p3.ms);
      setCustomValue("");
    }}
              >${p3.label}</button>
            `
  )}
          <span style="display:inline-flex;align-items:center;gap:4px;margin-left:auto">
            <span style="color:var(--fg-3);font-size:11px">${t4("settings.loopCustom")}</span>
            <input
              type="number"
              min="1"
              step="1"
              value=${customValue}
              onInput=${(e3) => {
    const raw = e3.target.value;
    setCustomValue(raw);
    const ms = parseCustomInterval(raw, customUnit);
    if (ms !== null) setIntervalMs(ms);
  }}
              style="width:64px;font-family:var(--font-mono)"
              disabled=${busy}
            />
            <${Select}
              value=${customUnit}
              onChange=${(next) => {
    setCustomUnit(next);
    if (customValue) {
      const ms = parseCustomInterval(customValue, next);
      if (ms !== null) setIntervalMs(ms);
    }
  }}
              disabled=${busy}
              width="70px"
              ariaLabel=${t4("setPanel.ariaTimeUnit")}
              options=${[{ value: "s", label: "s" }, { value: "m", label: "m" }, { value: "h", label: "h" }]}
            />
          </span>
        </div>
        ${customValue && customMs === null ? html4`<span style="color:var(--c-err);font-size:11px">${t4("settings.loopRangeError")}</span>` : null}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <span style="color:var(--fg-3);font-size:11px">${t4("settings.loopPrompt")}</span>
        <textarea
          rows="3"
          placeholder=${t4("settings.loopPromptPlaceholder")}
          value=${prompt}
          onInput=${(e3) => setPrompt(e3.target.value)}
          style="width:100%;font-family:var(--font-mono);resize:vertical"
          disabled=${busy}
        ></textarea>
      </div>
      <div>
        <button
          class="btn primary"
          disabled=${!canStart}
          onClick=${() => onStart(intervalMs, prompt.trim())}
        >${t4("settings.loopStart")}</button>
      </div>
    </div>
  `;
}
function sameDevLogSnapshot(current, next) {
  return current.length === next.length && current.every((entry, index) => entry.ts === next[index]?.ts && entry.msg === next[index]?.msg);
}
function countNewDevLogs(current, next) {
  if (next.length === 0) return 0;
  if (current.length === 0) return next.length;
  const last = current[current.length - 1];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index]?.ts === last.ts && next[index]?.msg === last.msg) return next.length - index - 1;
  }
  return Math.max(1, next.length - current.length);
}
function SettingsPanel() {
  useLang();
  const [data, setData] = d2(null);
  const [error, setError] = d2(null);
  const [saving, setSaving] = d2(false);
  const [saved, setSaved] = d2(null);
  const [draft, setDraft] = d2({});
  const [credentialProviderId, setCredentialProviderId] = d2(null);
  const [credentialVerification, setCredentialVerification] = d2(null);
  const [credentialTesting, setCredentialTesting] = d2(false);
  const [managedProviders, setManagedProviders] = d2([]);
  const [modelVerification, setModelVerification] = d2(null);
  const [providerDiagnostics, setProviderDiagnostics] = d2(null);
  const [providerTesting, setProviderTesting] = d2(false);
  const [runtimeDraft, setRuntimeDraft] = d2({ python: "", node: "", domesticOnly: false, allowOfficialFallback: true });
  const [catalog, setCatalog] = d2(null);
  const [loopStatus, setLoopStatus] = d2(null);
  const [loopAvgCost, setLoopAvgCost] = d2(null);
  const [loopBusy, setLoopBusy] = d2(false);
  const lastStatusSyncRef = A2(0);
  const [now, setNow] = d2(() => Date.now());
  const [showDevLog, setShowDevLog] = d2(false);
  const [devLogs, setDevLogs] = d2([]);
  const devLogsRef = A2([]);
  const devLogPanelRef = A2(null);
  const devLogFollowRef = A2(true);
  const [devLogFollowing, setDevLogFollowing] = d2(true);
  const [devLogNewCount, setDevLogNewCount] = d2(0);
  const applyDevLogs = q2((logs) => {
    const next = Array.isArray(logs) ? logs : [];
    const current = devLogsRef.current;
    if (sameDevLogSnapshot(current, next)) return;
    if (!devLogFollowRef.current) {
      const added = countNewDevLogs(current, next);
      if (added > 0) setDevLogNewCount((count) => count + added);
    }
    devLogsRef.current = next;
    setDevLogs(next);
  }, []);
  const setDevLogFollow = q2((following) => {
    devLogFollowRef.current = following;
    setDevLogFollowing(following);
    if (following) setDevLogNewCount(0);
  }, []);
  const scrollDevLogToBottom = q2(() => {
    setDevLogFollow(true);
    requestAnimationFrame(() => {
      const el = devLogPanelRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [setDevLogFollow]);
  const handleDevLogScroll = q2((event) => {
    const el = event.currentTarget;
    setDevLogFollow(el.scrollHeight - el.scrollTop - el.clientHeight <= 24);
  }, [setDevLogFollow]);
  const toggleDevLog = q2(() => {
    const next = !showDevLog;
    if (next) setDevLogFollow(true);
    setShowDevLog(next);
  }, [showDevLog, setDevLogFollow]);
  const load = q2(async () => {
    try {
      const [r3, providerResult, diagnosticsResult] = await Promise.all([
        api("/settings"),
        api("/providers"),
        api("/providers/diagnostics").catch(() => null),
      ]);
      setData(r3);
      setManagedProviders(providerResult.providers ?? []);
      setModelVerification(providerResult.modelVerification ?? null);
      setProviderDiagnostics(diagnosticsResult);
      setRuntimeDraft({
        python: (r3.runtime?.packageSources?.python ?? []).join("\n"),
        node: (r3.runtime?.packageSources?.node ?? []).join("\n"),
        domesticOnly: r3.runtime?.domesticOnly === true,
        allowOfficialFallback: r3.runtime?.allowOfficialFallback !== false,
      });
      setDraft({});
      setCredentialProviderId((current) => r3.credentialProviders?.some((provider) => provider.id === current) ? current : r3.credentialTarget?.id ?? r3.credentialProviders?.[0]?.id ?? null);
      setCredentialVerification(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  y2(() => {
    api("/models").then(setCatalog).catch(() => void 0);
  }, []);
  const refreshLoop = q2(async () => {
    try {
      const r3 = await api("/loop/status");
      setLoopStatus(r3.status);
      lastStatusSyncRef.current = Date.now();
    } catch {
    }
    try {
      const r3 = await api("/overview");
      setLoopAvgCost(r3.stats?.lastTurnCostUsd ?? null);
    } catch {
    }
  }, []);
  y2(() => {
    let cancelled = false;
    refreshLoop();
    const id = setInterval(() => {
      if (!cancelled) refreshLoop();
    }, 5e3);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshLoop]);
  y2(() => {
    if (!loopStatus) return;
    const id = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(id);
  }, [loopStatus]);
  const remainingMs = loopStatus ? Math.max(0, loopStatus.nextFireMs - (now - lastStatusSyncRef.current)) : 0;
  const startLoop = q2(
    async (intervalMs, prompt) => {
      setLoopBusy(true);
      try {
        await api("/loop/start", { method: "POST", body: { intervalMs, prompt } });
        await refreshLoop();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoopBusy(false);
      }
    },
    [refreshLoop]
  );
  const stopLoop = q2(async () => {
    setLoopBusy(true);
    try {
      await api("/loop/stop", { method: "POST" });
      await refreshLoop();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoopBusy(false);
    }
  }, [refreshLoop]);
  const refreshLogs = q2(async () => {
    try {
      const r3 = await api("/logs");
      applyDevLogs(r3.logs ?? []);
    } catch {
    }
  }, [applyDevLogs]);
  y2(() => {
    if (!showDevLog) return;
    refreshLogs();
    const unsub = subscribeSse("logs", (ev) => {
      applyDevLogs(ev.logs ?? []);
    });
    return unsub;
  }, [showDevLog, refreshLogs, applyDevLogs]);
  y2(() => {
    if (!devLogFollowing) return;
    const el = devLogPanelRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [devLogs, devLogFollowing, showDevLog]);
  const save = q2(
    async (fields) => {
      setSaving(true);
      setError(null);
      try {
        const result = await api("/settings", { method: "POST", body: fields });
        await load();
        setSaved(result.requiresModelTest ? t4("settings.credentialsRetest") : t4("settings.saved", { fields: Object.keys(fields).join(", ") }));
        setTimeout(() => setSaved(null), 3e3);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    },
    [load]
  );
  const testCredentials = q2(async () => {
    const provider = data?.credentialProviders?.find((item) => item.id === credentialProviderId);
    if (!provider) return;
    setCredentialTesting(true);
    setCredentialVerification(null);
    setError(null);
    try {
      const payload = { providerId: provider.id, baseUrl: draft.baseUrl ?? provider.baseUrl };
      if ((draft.apiKey ?? "").trim()) payload.apiKey = draft.apiKey.trim();
      const result = await api("/providers/credentials/test", { method: "POST", body: payload });
      setCredentialVerification({ ...result, apiKey: payload.apiKey, baseUrl: payload.baseUrl });
    } catch (err) {
      setError(t4("setPanel.apiTestFailed", { msg: err.message }));
    } finally {
      setCredentialTesting(false);
    }
  }, [data, credentialProviderId, draft]);
  const saveCredentials = q2(async () => {
    const provider = data?.credentialProviders?.find((item) => item.id === credentialProviderId);
    if (!provider || !credentialVerification) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        providerId: provider.id,
        baseUrl: credentialVerification.baseUrl,
        verificationToken: credentialVerification.verificationToken
      };
      if (credentialVerification.apiKey) payload.apiKey = credentialVerification.apiKey;
      await api("/providers/credentials/save", { method: "POST", body: payload });
      await load();
      setSaved(t4("settings.credentialsRetest"));
      setTimeout(() => setSaved(null), 4e3);
    } catch (err) {
      setCredentialVerification(null);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [data, credentialProviderId, credentialVerification, load]);
  const testManagedProviders = q2(async () => {
    if (providerTesting) return;
    setProviderTesting(true);
    setError(null);
    try {
      const result = await api("/providers/test", { method: "POST", body: {} });
      await load();
      setSaved(t4("setPanel.modelTestDone", { passed: result.passed, total: result.total }));
    } catch (err) {
      setError(t4("setPanel.modelTestFailed", { msg: err.message }));
    } finally {
      setProviderTesting(false);
    }
  }, [providerTesting, load]);
  if (!data && !error)
    return html4`<div class="card" style="color:var(--fg-3)">${t4("settings.loading")}</div>`;
  if (error && !data) return html4`<div class="card accent-err">${error}</div>`;
  if (!data) return null;
  const v3 = data;
  const credentialProvider = v3.credentialProviders?.find((provider) => provider.id === credentialProviderId) ?? v3.credentialProviders?.[0] ?? null;
  const credentialBaseUrl = draft.baseUrl ?? credentialProvider?.baseUrl ?? "";
  const credentialChanged = Boolean((draft.apiKey ?? "").trim()) || credentialBaseUrl !== (credentialProvider?.baseUrl ?? "");
  const activeProviderDiagnostic = providerDiagnostics?.providers?.find((diagnostic) => diagnostic.active) ?? null;
  const provenanceLabel = {
    "builtin-default": t4("setPanel.provenanceBuiltin"),
    "json-import": t4("setPanel.provenanceJsonImport"),
    dashboard: t4("setPanel.provenanceDashboard"),
    "legacy-migration": t4("setPanel.provenanceLegacy"),
    "config-migration": t4("setPanel.provenanceMigration"),
    environment: t4("setPanel.provenanceEnv"),
    "manual-unknown": t4("setPanel.provenanceManual"),
  };
  const lockedPreset = ["flash", "pro"].includes(v3.preset ?? "");
  const modelControlValue = lockedPreset ? v3.effectiveModel ?? v3.displayModel ?? v3.model ?? "\u2014" : v3.configuredModel ?? v3.effectiveModel ?? v3.model ?? "\u2014";
  const runtimeModel = v3.runtimeModel ?? v3.displayModel ?? v3.model ?? "\u2014";
  const modelNote = v3.modelDrift ? t4("setPanel.noteDrift", { runtime: runtimeModel, expected: v3.effectiveModel ?? "\u2014" }) : lockedPreset ? t4("setPanel.noteLocked", { preset: v3.preset, effective: v3.effectiveModel ?? v3.model ?? "\u2014", configured: v3.configuredModel ?? "\u2014" }) : runtimeModel !== modelControlValue ? t4("setPanel.notePending", { runtime: runtimeModel, base: modelControlValue }) : t4("settings.appliesNextTurn");
  const availableEccRules = (v3.eccRules?.available ?? []).filter((name) => name !== "custom");
  const enabledEccRules = new Set(v3.eccRules?.enabled ?? []);
  const toggleEccRule = (name) => {
    const next = enabledEccRules.has(name)
      ? [...enabledEccRules].filter((item) => item !== name)
      : [...enabledEccRules, name];
    save({ eccRules: next });
  };
  const sectionH3 = (text) => html4`
    <h3 style="margin:18px 0 8px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${text}</h3>
  `;
  const fieldRow = (label, control, note) => html4`
    <div style="display:flex;align-items:center;gap:10px;padding:6px 0">
      <span style="flex:0 0 110px;font-family:var(--font-mono);font-size:11.5px;color:var(--fg-3)">${label}</span>
      <div style="flex:1;display:flex;align-items:center;gap:8px">${control}</div>
      ${note ? html4`<span style="color:var(--fg-3);font-size:11px">${note}</span>` : null}
    </div>
  `;
  const currentLang2 = getLang();
  return html4`
    <div style="max-width:760px;display:flex;flex-direction:column;gap:6px">
      ${saved ? html4`<div><span class="pill ok">${saved}</span></div>` : null}
      ${error ? html4`<div class="card accent-err">${error}</div>` : null}

      ${sectionH3(t4("settings.sectionLanguage"))}
      <div class="card">
        ${fieldRow(
    t4("settings.language"),
    html4`
            <${Select}
              value=${currentLang2}
              onChange=${(lang) => {
      setLang(lang);
    }}
              ariaLabel=${t4("settings.language")}
              options=${[
                { value: "en", label: t4("settings.langEn") },
                { value: "zh-CN", label: t4("settings.langZhCn") }
              ]}
            />
          `
  )}
      </div>

      ${sectionH3(t4("settings.sectionApi"))}
      <div class="card">
        <div style="padding:2px 0 8px;border-bottom:1px solid var(--bd);margin-bottom:4px">
          <div style="font-size:12px;color:var(--fg-1);font-weight:600">${t4("settings.credentialCurrent", { name: credentialProvider?.name ?? "Legacy" })}</div>
          <div style="font-size:11px;color:var(--fg-3);margin-top:3px;line-height:1.45">${t4("setPanel.credSaveHint")}</div>
        </div>
        ${fieldRow(
    t4("settings.credentialProvider"),
    html4`<${Select} value=${credentialProvider?.id ?? ""} disabled=${saving || credentialTesting} ariaLabel=${t4("setPanel.ariaCredentialProvider")} onChange=${(nextId) => {
      const next = v3.credentialProviders?.find((provider) => provider.id === nextId);
      setCredentialProviderId(nextId);
      setDraft({ ...draft, apiKey: "", baseUrl: next?.baseUrl ?? "" });
      setCredentialVerification(null);
    }} options=${(v3.credentialProviders ?? []).map((provider) => ({ value: provider.id, label: provider.name }))} />`
  )}
        ${fieldRow(
    t4("settings.apiKey"),
    html4`<code class="mono" style="color:var(--fg-2);font-size:11.5px">${credentialProvider?.apiKey ?? t4("settings.notSet")}</code>`,
    credentialProvider?.credentialTest?.checkedAt ? t4("setPanel.credLastTest", { time: fmtRelativeTime(credentialProvider.credentialTest.checkedAt) }) : t4("setPanel.credNoTest")
  )}
        ${fieldRow(
    t4("settings.replace"),
    html4`
            <input
              type="password"
              placeholder=${t4("settings.pasteKey")}
              value=${draft.apiKey ?? ""}
              onInput=${(e3) => { setDraft({ ...draft, apiKey: e3.target.value }); setCredentialVerification(null); }}
              style="flex:1"
            />
          `
  )}
        ${fieldRow(
    t4("settings.baseUrl"),
    html4`
            <input
              type="text"
              value=${credentialBaseUrl}
              placeholder=${t4("settings.baseUrlPlaceholder")}
              onInput=${(e3) => { setDraft({ ...draft, baseUrl: e3.target.value }); setCredentialVerification(null); }}
              style="flex:1"
            />
          `
  )}
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--bd)">
          <button class="btn" disabled=${saving || credentialTesting || !credentialProvider || !credentialBaseUrl.trim() || (!credentialChanged && !credentialProvider.apiKeySet)} onClick=${testCredentials}>${credentialTesting ? t4("settings.detectingApi") : t4("settings.detectApi")}</button>
          <button class="btn primary" disabled=${saving || credentialTesting || !credentialVerification} onClick=${saveCredentials}>${t4("settings.saveCredentials")}</button>
          <span style="font-size:11px;color:${credentialVerification ? 'var(--c-ok)' : 'var(--fg-3)'}">${credentialVerification ? t4("settings.detectionPassed", { model: credentialVerification.modelId }) : t4("settings.detectionRequired")}</span>
        </div>
      </div>

      ${sectionH3(t4("setPanel.sectionModelMgmt"))}
      <div class="card model-management-card">
        <div class="model-management-head">
          <div>
            <strong>${t4("setPanel.modelMgmtTitle")}</strong>
            <div class="meta">${t4("setPanel.modelCount", { count: managedProviders.reduce((count, provider) => count + (provider.models ?? []).filter((model) => model.disabled !== true).length, 0) })}${modelVerification?.dirty ? t4("setPanel.configDirty") : ""}</div>
          </div>
          <button class="btn" disabled=${providerTesting || saving || managedProviders.length === 0} onClick=${testManagedProviders}>${providerTesting ? t4("setPanel.testing") : t4("setPanel.testAllModels")}</button>
        </div>
        <div class="model-management-groups">
          ${providerDisplayGroups(managedProviders).map((group) => html4`
            <div class="model-management-group"><strong>${group.label}</strong><span>${t4("setPanel.modelCount", { count: group.providers.reduce((count, provider) => count + (provider.models ?? []).filter((model) => model.disabled !== true).length, 0) })}</span></div>
          `)}
        </div>
        ${activeProviderDiagnostic ? html4`
          <div class="provider-diagnostics">
            <div class="provider-diagnostics-head">
              <strong>${t4("setPanel.activeConfig")}</strong>
              <span class=${activeProviderDiagnostic.issues?.length ? "pill warn" : "pill ok"}>${activeProviderDiagnostic.issues?.length ? t4("setPanel.issuesNeedFix", { count: activeProviderDiagnostic.issues.length }) : t4("setPanel.configComplete")}</span>
            </div>
            <div class="provider-diagnostics-grid">
              <span>${t4("setPanel.labelAdapter")}</span><code>${activeProviderDiagnostic.providerType}</code>
              <span>${t4("setPanel.labelModelProtocol")}</span><code>${activeProviderDiagnostic.modelId ?? t4("setPanel.notSelected")} · ${activeProviderDiagnostic.protocol}</code>
              <span>${t4("setPanel.labelEffectiveUrl")}</span><code>${activeProviderDiagnostic.effectiveBaseUrl ?? t4("setPanel.notConfigured")}</code>
              <span>${t4("setPanel.labelApiKey")}</span><code>${activeProviderDiagnostic.apiKeyPresent ? t4("setPanel.provided") : t4("setPanel.notConfigured")}${activeProviderDiagnostic.configuredApiKeyPresent ? t4("setPanel.fromConfigFile") : activeProviderDiagnostic.overrides?.apiKey ? t4("setPanel.fromEnv") : ""}</code>
              <span>${t4("setPanel.labelSource")}</span><code>${provenanceLabel[activeProviderDiagnostic.source] ?? activeProviderDiagnostic.source}${activeProviderDiagnostic.changedOutsideManagedFlow ? t4("setPanel.outsideManaged") : ""}</code>
            </div>
            ${activeProviderDiagnostic.issues?.length ? html4`<div class="provider-diagnostics-issues">${activeProviderDiagnostic.issues.map((issue) => html4`<div>${issue.message}</div>`)}</div>` : null}
          </div>
        ` : null}
      </div>

      ${sectionH3(t4("settings.sectionDefaults"))}
      <div class="card">
        ${v3.modes ? fieldRow(
    t4("setPanel.sectionWorkMode"),
    html4`
            <${Select}
              value=${v3.mode ?? "general"}
              onChange=${(mode) => save({ mode })}
              disabled=${saving}
              ariaLabel=${t4("setPanel.ariaWorkMode")}
              options=${v3.modes.map((m) => ({ value: m.id, label: m.label, meta: m.description || (m.effectiveRules || m.rules || []).join("+") }))}
            />
          `,
    `${(v3.activeMode?.hint || t4("setPanel.workModeHintDefault"))} · ECC ${((v3.activeMode?.effectiveRules || v3.activeMode?.rules || [])).join("+") || "common"}`
  ) : null}
        ${availableEccRules.length > 0 ? fieldRow(
    t4("setPanel.sectionEcc"),
    html4`<div class="ecc-rule-grid">
      ${availableEccRules.map((name) => html4`<label class=${`ecc-rule-option ${enabledEccRules.has(name) ? "active" : ""}`} title=${t4("setPanel.eccRuleTitle", { name })}>
        <input type="checkbox" checked=${enabledEccRules.has(name)} disabled=${saving} onChange=${() => toggleEccRule(name)} />
        <span>${name}</span>
      </label>`)}
    </div>`,
    t4("setPanel.eccEnabledNote", { enabled: enabledEccRules.size, total: availableEccRules.length })
  ) : null}
        ${fieldRow(
    "\u4E0A\u4E0B\u6587\u957F\u5EA6",
    html4`
            <${Select}
              value=${String(v3.contextCapTokens ?? "auto")}
              onChange=${(val) => save({ contextCapTokens: val === "auto" ? null : parseInt(val, 10) })}
              disabled=${saving}
              ariaLabel=${t4("setPanel.ariaContextLength")}
              options=${[
                { value: "auto", label: v3.providerContextCap ? t4("setPanel.contextModelDefault", { cap: Math.round(v3.providerContextCap / 1024) }) : t4("setPanel.contextModelDefaultNoCap") },
                ...[[32768, "32K"], [65536, "64K"], [131072, "128K"], [262144, "256K"], [1048576, "1M"]].map(([n, label]) => ({ value: String(n), label, disabled: Boolean(v3.providerContextCap && n > v3.providerContextCap) })),
                ...(v3.contextCapTokens && ![32768, 65536, 131072, 262144, 1048576].includes(v3.contextCapTokens) ? [{ value: String(v3.contextCapTokens), label: `${Math.round(v3.contextCapTokens / 1024)}K`, disabled: Boolean(v3.providerContextCap && v3.contextCapTokens > v3.providerContextCap) }] : [])
              ]}
            />
          `,
    "\u5373\u65F6\u751F\u6548"
  )}
        ${fieldRow(
    t4("settings.webSearch"),
    html4`
            <button
              class=${`btn ${v3.search ? "primary" : ""}`}
              onClick=${() => save({ search: !v3.search })}
              disabled=${saving}
            >${v3.search ? t4("common.on") : t4("common.off")}</button>
          `,
    t4("settings.webSearchNote")
  )}
        ${v3.search ? html4`
          ${fieldRow(
            "\u641C\u7D22\u5F15\u64CE",
            html4`
              <${Select}
                value=${v3.webSearchEngine ?? "bing-scrape"}
                onChange=${(eng) => save({ webSearchEngine: eng })}
                disabled=${saving}
                ariaLabel=${t4("setPanel.ariaSearchEngine")}
                options=${[
                  { value: "mojeek", label: t4("setPanel.engineMojeek") },
                  { value: "bing-scrape", label: t4("setPanel.engineBingScrape") },
                  { value: "searxng", label: t4("setPanel.engineSearxng") },
                  { value: "bing", label: t4("setPanel.engineBing") }
                ]}
              />
            `,
            "\u5207\u6362\u5F15\u64CE\u540E\u9700\u91CD\u542F\u5E94\u7528\u751F\u6548"
          )}
          ${v3.webSearchEngine === "searxng" || (v3.webSearchEngine ?? "bing-scrape") === "searxng" ? fieldRow(
            "SearXNG \u5730\u5740",
            html4`
              <input
                type="text"
                id="searxng-endpoint"
                value=${v3.webSearchEndpoint ?? "http://localhost:8080"}
                placeholder="https://searx.be"
                style="flex:1"
              />
              <button class="btn" disabled=${saving} onClick=${() => { const el=document.getElementById("searxng-endpoint"); if(el&&el.value.trim()) save({ webSearchEndpoint: el.value.trim() }); }}>${t4("common.save")}</button>
            `,
            "\u586B\u516C\u5171 SearXNG \u5B9E\u4F8B\u5730\u5740\u5373\u53EF\uFF0C\u5982 https://searx.be"
          ) : null}
          ${v3.webSearchEngine === "bing" ? fieldRow(
            "Bing API Key",
            html4`
              <input
                type="password"
                value=${draft.bingApiKey ?? ""}
                placeholder=${v3.bingApiKeySet ? "\u5DF2\u8BBE\u7F6E\uFF0C\u7559\u7A7A\u4FDD\u6301\u73B0\u6709" : "32\u4F4D API Key"}
                onInput=${(e3) => setDraft({ ...draft, bingApiKey: e3.target.value })}
                style="flex:1"
              />
              <button class="btn" disabled=${saving || !(draft.bingApiKey ?? "").trim()} onClick=${() => save({ bingApiKey: draft.bingApiKey })}>${t4("common.save")}</button>
            `,
            "\u4ECE https://portal.azure.com \u514D\u8D39\u83B7\u53D6 (Bing Search v7, 1000\u6B21/\u6708)"
          ) : null}
        ` : null}
      </div>

      ${sectionH3(t4("settings.sectionCompute"))}
      <div class="card">
        ${fieldRow(
    t4("settings.proNext"),
    html4`
            <button
              class=${`btn ${v3.proNext ? "primary" : ""}`}
              onClick=${() => save({ proNext: !v3.proNext })}
              disabled=${saving}
            >${v3.proNext ? t4("settings.proArmed") : t4("settings.proArm")}</button>
          `,
    t4("settings.proNextNote")
  )}
      </div>

      ${sectionH3(t4("settings.sectionBudget"))}
      <${BudgetSection}
        state=${deriveBudgetState(v3.budgetUsd, v3.sessionSpendUsd)}
        saving=${saving}
        onSetCap=${(usd) => save({ budgetUsd: usd })}
        onClear=${() => save({ budgetUsd: null })}
      />

      ${sectionH3(t4("settings.sectionRuntime"))}
      <div class="card">
        ${fieldRow(
          t4("setPanel.mirrorPriority"),
          html4`<div style="display:flex;flex-direction:column;gap:8px;width:100%">
            <label style="display:flex;align-items:center;gap:8px;font-size:12px">
              <input type="checkbox" checked=${runtimeDraft.domesticOnly} onChange=${(e3) => setRuntimeDraft((current) => ({ ...current, domesticOnly: e3.target.checked, allowOfficialFallback: e3.target.checked ? false : current.allowOfficialFallback }))} disabled=${saving} />
              ${t4("setPanel.mirrorOnly")}
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px">
              <input type="checkbox" checked=${runtimeDraft.allowOfficialFallback} onChange=${(e3) => setRuntimeDraft((current) => ({ ...current, allowOfficialFallback: e3.target.checked }))} disabled=${saving || runtimeDraft.domesticOnly} />
              ${t4("setPanel.mirrorFallback")}
            </label>
          </div>`,
          t4("setPanel.mirrorNote")
        )}
        ${fieldRow(
          t4("setPanel.pythonSources"),
          html4`<textarea rows="2" value=${runtimeDraft.python} onInput=${(e3) => setRuntimeDraft((current) => ({ ...current, python: e3.target.value }))} placeholder=${t4("setPanel.oneSourcePerLine")} style="width:100%;font-family:var(--font-mono);resize:vertical" disabled=${saving}></textarea>`,
          t4("setPanel.pythonSourcesHint")
        )}
        ${fieldRow(
          t4("setPanel.nodeSources"),
          html4`<textarea rows="2" value=${runtimeDraft.node} onInput=${(e3) => setRuntimeDraft((current) => ({ ...current, node: e3.target.value }))} placeholder=${t4("setPanel.oneSourcePerLine")} style="width:100%;font-family:var(--font-mono);resize:vertical" disabled=${saving}></textarea>`,
          t4("setPanel.nodeSourcesHint")
        )}
        <div style="display:flex;justify-content:flex-end;margin-top:8px">
          <button class="btn primary" disabled=${saving} onClick=${() => save({ runtime: { packageSources: { python: runtimeDraft.python.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), node: runtimeDraft.node.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) }, domesticOnly: runtimeDraft.domesticOnly, allowOfficialFallback: runtimeDraft.allowOfficialFallback } })}>${t4("setPanel.saveRuntimeSources")}</button>
        </div>
        ${fieldRow(
    t4("settings.activeModel"),
    html4`<${ModelRow}
            current=${modelControlValue}
            catalog=${catalog}
            saving=${saving}
            locked=${lockedPreset}
            onPick=${(m3) => save({ model: m3 })}
          />`,
    // When preset locks the model, avoid showing cfg.model as if it were active.
    modelNote
  )}
        ${fieldRow(
    t4("settings.editMode"),
    html4`<code class="mono">${v3.editMode}</code>`,
    t4("settings.editModeNote")
  )}
      </div>

      ${sectionH3(t4("settings.sectionDev"))}
      <div class="card">
        ${fieldRow(
          t4("settings.devMode"),
          html4`<button
            class=${`btn ${showDevLog ? "primary" : ""}`}
            onClick=${toggleDevLog}
          >${showDevLog ? t4("common.on") : t4("common.off")}</button>`,
          t4("settings.devModeNote")
        )}
        ${showDevLog ? html4`
          <div style="height:26px;margin-top:6px;display:flex;align-items:center;justify-content:flex-end;font-size:11px;color:var(--fg-3)">
            ${devLogFollowing
              ? html4`<span>${t4("settings.devFollowing")}</span>`
              : html4`<button class="btn btn-sm" onClick=${scrollDevLogToBottom}>${devLogNewCount > 0 ? `${t4("settings.devNewLogs", { count: devLogNewCount })} · ` : ""}${t4("settings.devBackToBottom")}</button>`}
          </div>
          <div ref=${devLogPanelRef} onScroll=${handleDevLogScroll} style="max-height:320px;overflow-y:auto;background:var(--bg-0);border:1px solid var(--border-1);border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:11px;line-height:1.6" id="dev-log-panel">
            ${devLogs.length === 0 ? html4`<span style="color:var(--fg-3)">...</span>` : devLogs.map((e) => html4`
              <div style="display:flex;gap:8px">
                <span style="color:var(--fg-3);flex-shrink:0">${new Date(e.ts).toLocaleTimeString()}</span>
                <span style="color:var(--fg-2);word-break:break-all">${e.msg}</span>
              </div>
            `)}
          </div>
        ` : null}
      </div>
    </div>
  `;
}

export { SettingsPanel };
