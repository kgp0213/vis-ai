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

const reportStore = {
  period: "daily",
  date: new Date().toISOString().slice(0, 10),
  startDate: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  markdown: "",
  stats: null,
  error: null
};
function ReportsPanel() {
  useLang();
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const [period, setPeriod] = d2(reportStore.period ?? "daily");
  const [date, setDate] = d2(reportStore.date ?? today);
  const [startDate, setStartDate] = d2(reportStore.startDate ?? weekAgo);
  const [endDate, setEndDate] = d2(reportStore.endDate ?? today);
  const [markdown, setMarkdown] = d2(reportStore.markdown ?? "");
  const [stats, setStats] = d2(reportStore.stats ?? null);
  const [busy, setBusy] = d2(false);
  const [error, setError] = d2(reportStore.error ?? null);
  const [info, setInfo] = d2(null);
  const [previewSources, setPreviewSources] = d2(null);
  const isCustom = period === "custom";

  y2(() => {
    reportStore.period = period;
    reportStore.date = date;
    reportStore.startDate = startDate;
    reportStore.endDate = endDate;
    reportStore.markdown = markdown;
    reportStore.stats = stats;
    reportStore.error = error;
  }, [period, date, startDate, endDate, markdown, stats, error]);

  const generate = q2(async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    setMarkdown("");
    setStats(null);
    setPreviewSources(null);
    try {
      let previewUrl = `/report/preview?period=${encodeURIComponent(period)}&date=${encodeURIComponent(date)}`;
      let reportUrl = `/report?period=${encodeURIComponent(period)}&date=${encodeURIComponent(date)}`;
      if (isCustom) {
        const range = `&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
        previewUrl += range;
        reportUrl += range;
      }
      const previewRes = await api(previewUrl);
      setPreviewSources(previewRes.sources || []);
      const res = await api(reportUrl);
      setMarkdown(res.markdown || "");
      setStats(res.stats || null);
    } catch (err) {
      setError(err.message || String(err));
      setMarkdown("");
      setStats(null);
    } finally {
      setBusy(false);
    }
  }, [period, date, startDate, endDate]);

  const exportMd = q2(async () => {
    if (!markdown) return;
    setInfo(null);
    setError(null);
    try {
      const suffix = isCustom ? `${startDate}_${endDate}` : date;
      const filename = `Visionox-Whale_Report_${suffix}.md`;
      const res = await api("/report/export", {
        method: "POST",
        body: { markdown, filename }
      });
      setInfo(`\u5DF2\u5BFC\u51FA\u5230 ${res.path || res.filename}`);
    } catch (err) {
      setError(`\u5BFC\u51FA\u5931\u8D25\uFF1A${err.message || String(err)}`);
    }
  }, [markdown, isCustom, startDate, endDate, date]);

  const [showPromptEditor, setShowPromptEditor] = d2(false);
  const [promptDefault, setPromptDefault] = d2("");
  const [promptAddendum, setPromptAddendum] = d2("");
  const [promptBusy, setPromptBusy] = d2(false);

  const openPromptEditor = q2(async () => {
    setError(null);
    setInfo(null);
    setShowPromptEditor(true);
    setPromptBusy(true);
    try {
      const res = await api("/report/prompt");
      setPromptDefault(res.default || "");
      setPromptAddendum(res.addendum || "");
    } catch (err) {
      setError(`\u52A0\u8F7D\u63D0\u793A\u8BCD\u5931\u8D25\uFF1A${err.message || String(err)}`);
    } finally {
      setPromptBusy(false);
    }
  }, []);

  const savePromptTemplate = q2(async () => {
    setPromptBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api("/report/prompt", {
        method: "POST",
        body: { addendum: promptAddendum }
      });
      setPromptAddendum(res.addendum || "");
      setShowPromptEditor(false);
      setInfo(t4("reports.promptSaved"));
    } catch (err) {
      setError(`\u4FDD\u5B58\u63D0\u793A\u8BCD\u5931\u8D25\uFF1A${err.message || String(err)}`);
    } finally {
      setPromptBusy(false);
    }
  }, [promptAddendum]);

  const resetPromptTemplate = q2(async () => {
    setPromptBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api("/report/prompt", { method: "DELETE" });
      setPromptAddendum(res.addendum || "");
      setInfo(t4("reports.promptSaved"));
    } catch (err) {
      setError(`\u91CD\u7F6E\u63D0\u793A\u8BCD\u5931\u8D25\uFF1A${err.message || String(err)}`);
    } finally {
      setPromptBusy(false);
    }
  }, []);

  return html4`
    <div class="reports-panel">
      <div class="reports-controls">
        <label>
          <span>${t4("reports.period")}</span>
          <select value=${period} onChange=${(e3) => setPeriod(e3.target.value)} disabled=${busy}>
            <option value="daily">${t4("reports.daily")}</option>
            <option value="weekly">${t4("reports.weekly")}</option>
            <option value="yearly">${t4("reports.yearly")}</option>
            <option value="custom">${t4("reports.custom")}</option>
          </select>
        </label>
        ${isCustom ? html4`
          <label>
            <span>${t4("reports.startDate")}</span>
            <input type="date" value=${startDate} onChange=${(e3) => setStartDate(e3.target.value)} disabled=${busy} />
          </label>
          <label>
            <span>${t4("reports.endDate")}</span>
            <input type="date" value=${endDate} onChange=${(e3) => setEndDate(e3.target.value)} disabled=${busy} />
          </label>
        ` : html4`
          <label>
            <span>${t4("reports.date")}</span>
            <input type="date" value=${date} onChange=${(e3) => setDate(e3.target.value)} disabled=${busy} />
          </label>
        `}
        <button class="btn primary" onClick=${generate} disabled=${busy}>
          ${busy ? t4("reports.generating") : t4("reports.generate")}
        </button>
        <button class="btn" onClick=${exportMd} disabled=${!markdown || busy} title=${t4("reports.export")}>
          ${t4("reports.export")}
        </button>
        <button class="btn" onClick=${openPromptEditor} disabled=${busy} title=${t4("reports.prompt")}>
          ${t4("reports.prompt")}
        </button>
      </div>

      ${showPromptEditor ? html4`
        <div class="reports-prompt-editor">
          <div class="reports-prompt-default">
            <div class="reports-prompt-default-label">\u9ED8\u8BA4\u63D0\u793A\u8BCD\uFF08\u968F\u7248\u672C\u66F4\u65B0\uFF0C\u53EA\u8BFB\uFF09</div>
            <pre>${promptDefault}</pre>
          </div>
          <textarea
            value=${promptAddendum}
            onChange=${(e3) => setPromptAddendum(e3.target.value)}
            disabled=${promptBusy}
            placeholder="\u5728\u6B64\u8FFD\u52A0\u4F60\u7684\u7279\u6B8A\u8981\u6C42\uFF08\u6807\u9898\u504F\u597D\u3001\u7AE0\u8282\u8981\u6C42\u3001\u98CE\u683C\u8981\u6C42\u7B49\uFF09\u3002\u9ED8\u8BA4\u63D0\u793A\u8BCD\u4F1A\u968F\u7248\u672C\u81EA\u52A8\u66F4\u65B0\uFF0C\u8FD9\u91CC\u7684\u5185\u5BB9\u4F1A\u88AB\u4FDD\u7559\u3002"
          />
          <div class="reports-prompt-actions">
            <button class="btn primary" onClick=${savePromptTemplate} disabled=${promptBusy}>${t4("reports.savePrompt")}</button>
            <button class="btn" onClick=${resetPromptTemplate} disabled=${promptBusy}>${t4("reports.resetPrompt")}</button>
            <button class="btn" onClick=${() => setShowPromptEditor(false)} disabled=${promptBusy}>${t4("reports.cancelPrompt")}</button>
          </div>
        </div>
      ` : null}

      ${error ? html4`<div class="notice err">${t4("reports.error", { error })}</div>` : null}
      ${info ? html4`<div class="notice">${info}</div>` : null}
      ${stats && !busy ? html4`<div class="reports-stats">
        ${t4("reports.stats", { sessions: String(stats.sessions), messages: String(stats.messages) })}
        <span class="dim">${new Date(stats.start).toLocaleDateString()} – ${new Date(stats.end).toLocaleDateString()}</span>
      </div>` : null}

      <div class="reports-output">
        ${markdown ? html4`<div class="reports-md" dangerouslySetInnerHTML=${{ __html: marked(markdown, { breaks: true, gfm: true }) }} />` : busy && previewSources ? html4`
          <div class="reports-preview">
            <div class="reports-preview-h">${t4("reports.generatingPreview", { sessions: String(previewSources.length), messages: String(previewSources.reduce((a, s) => a + (s.messageCount || 0), 0)) })}</div>
            ${previewSources.map((src) => html4`
              <div class="reports-preview-source" key=${src.source}>
                <div class="reports-preview-title">${src.source} · ${new Date(src.mtime).toLocaleString()} · ${src.messageCount} msgs</div>
                ${src.preview.map((m, idx) => html4`
                  <div class="reports-preview-msg" key=${idx}><strong>${m.role}:</strong> ${m.content}</div>
                `)}
              </div>
            `)}
          </div>
        ` : html4`<div class="reports-empty">${t4("reports.empty")}</div>`}
      </div>
    </div>
  `;
}

export { ReportsPanel };
