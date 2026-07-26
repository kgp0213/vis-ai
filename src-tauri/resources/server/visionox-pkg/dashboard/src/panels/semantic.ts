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

function SemanticPanel() {
  useLang();
  const [data, setData] = d2(null);
  const [draft, setDraft] = d2(null);
  const [draftDirty, setDraftDirty] = d2(false);
  const draftDirtyRef = A2(false);
  const [error, setError] = d2(null);
  const [busy, setBusy] = d2(false);
  const [info, setInfo] = d2(null);
  const load = q2(async () => {
    try {
      const [semantic, config] = await Promise.all([
        api("/semantic"),
        api("/semantic/config")
      ]);
      setData(semantic);
      setDraft((current) => current && draftDirtyRef.current ? current : toConfigDraft(config));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
    const phase2 = data?.job?.phase;
    const running2 = isActiveSemanticPhase(phase2);
    const pulling2 = data?.pull?.status === "pulling";
    const ms = running2 || pulling2 ? 1200 : 5e3;
    const id = setInterval(load, ms);
    return () => clearInterval(id);
  }, [load, data?.job?.phase, data?.pull?.status]);
  const start = q2(
    async (rebuild) => {
      if (!draft) return;
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        const validation = validateSemanticDraft(draft);
        if (draftDirty) {
          throw new Error(t4("semantic.saveBeforeIndex"));
        }
        if (validation.error) {
          throw new Error(validation.error);
        }
        await api("/semantic/start", { method: "POST", body: { rebuild: !!rebuild } });
        setInfo(rebuild ? t4("semantic.rebuildStarted") : t4("semantic.incrementalStarted"));
        await load();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [draft, draftDirty, load]
  );
  const stop = q2(async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/semantic/stop", { method: "POST", body: {} });
      setInfo(t4("semantic.stopRequested"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [load]);
  const startDaemon = q2(async () => {
    setBusy(true);
    setError(null);
    setInfo(t4("semantic.startingDaemon"));
    try {
      const r3 = await api("/semantic/ollama/start", {
        method: "POST",
        body: {}
      });
      setInfo(r3.ready ? t4("semantic.daemonUp") : t4("semantic.daemonTimeout"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [load]);
  const pullModel = q2(
    async (model) => {
      setBusy(true);
      setError(null);
      setInfo(t4("semantic.pullingModel", { model }));
      try {
        await api("/semantic/ollama/pull", { method: "POST", body: { model } });
        await load();
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [load]
  );
  const saveProviderConfig = q2(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const extraBody = semanticValidation.extraBody;
      await api("/semantic/config", {
        method: "POST",
        body: {
          provider: draft.provider,
          ollama: {
            baseUrl: draft.ollama.baseUrl,
            model: draft.ollama.model
          },
          openaiCompat: {
            baseUrl: draft.openaiCompat.baseUrl,
            apiKey: draft.openaiCompat.apiKey,
            model: draft.openaiCompat.model,
            extraBody
          }
        }
      });
      setDraftDirty(false);
      draftDirtyRef.current = false;
      setInfo(t4("semantic.savedConfig", { count: 1 }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [draft, load]);
  if (!data && !error) {
    return html4`<div class="card" style="color:var(--fg-3)">${t4("common.loading")}</div>`;
  }
  if (error && !data) return html4`<div class="card accent-err">${error}</div>`;
  if (!data || !draft) return null;
  if (!data.attached) {
    return html4`
      <div class="card" style="color:var(--fg-3)">
        <div class="card-h"><span class="title">${t4("semantic.codeRequired")}</span></div>
        <div class="card-b">${data.reason}</div>
      </div>
    `;
  }
  const job = data.job;
  const phase = job?.phase;
  const running = isActiveSemanticPhase(phase);
  const pull = data.pull;
  const pulling = pull?.status === "pulling";
  const provider = data.providerStatus?.kind ?? draft.provider;
  const ready = data.providerStatus?.ready === true;
  const isOllama = provider === "ollama";
  const ollama = data.providerStatus?.kind === "ollama" ? data.providerStatus : null;
  const remote = data.providerStatus?.kind === "openai-compat" ? data.providerStatus : null;
  const binaryFound = ollama?.binaryFound === true;
  const daemonRunning = ollama?.daemonRunning === true;
  const modelPulled = ollama?.modelPulled === true;
  const modelName = isOllama ? ollama?.modelName ?? draft.ollama.model ?? "nomic-embed-text" : draft.openaiCompat.model;
  const sectionH3 = (text) => html4`
    <h3 style="margin:18px 0 8px;font-family:var(--font-mono);font-size:11px;color:var(--fg-3);text-transform:uppercase;letter-spacing:.1em">${text}</h3>
  `;
  const idx = data.index;
  const indexReady = idx?.exists === true && idx.compatible !== false;
  const indexMismatch = idx?.exists === true && idx.compatible === false;
  const semanticValidation = validateSemanticDraft(draft);
  const semanticDraftBlocked = draftDirty || semanticValidation.error !== null;
  return html4`
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:14px;align-items:start">
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
        <div class="chips">
          <span class=${`chip-f static ${indexReady ? "active" : ""}`}>
            ${indexReady ? t4("semantic.indexBuilt") : t4("semantic.noIndex")}
          </span>
          ${ready ? html4`<span class="chip-f static" style="border-color:var(--c-ok);color:var(--c-ok)">${t4("semantic.ready")}</span>` : html4`<span class="chip-f static" style="border-color:var(--c-warn);color:var(--c-warn)">${t4("semantic.setupNeeded")}</span>`}
        </div>
        ${error ? html4`<div class="card accent-err">${error}</div>` : null}

        <div class="card">
          <div class="card-h"><span class="title">${t4("semantic.provider")}</span></div>
          <div class="form-row">
            <span class="lbl">${t4("semantic.providerType")}</span>
            <${Select}
              value=${draft.provider}
              ariaLabel=${t4("semantic.providerType")}
              onChange=${(v) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      provider: v
    });
  }}
              options=${[
                { value: "ollama", label: "Ollama" },
                { value: "openai-compat", label: "OpenAI-Compatible" }
              ]}
            />
          </div>
          ${draft.provider === "ollama" ? html4`
                <div class="form-row">
                  <span class="lbl">${t4("semantic.model")}</span>
                  <input
                    class="input mono"
                    type="text"
                    value=${draft.ollama.model}
                    onInput=${(e3) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      ollama: { ...draft.ollama, model: e3.target.value }
    });
  }}
                  />
                </div>
              ` : html4`
                <div class="form-row">
                  <span class="lbl">${t4("semantic.apiUrl")}</span>
                  <input
                    class="input mono"
                    type="text"
                    placeholder="https://your-embedding-host.example/v1/embeddings"
                    value=${draft.openaiCompat.baseUrl}
                    onInput=${(e3) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      openaiCompat: {
        ...draft.openaiCompat,
        baseUrl: e3.target.value
      }
    });
  }}
                  />
                </div>
                <div class="form-row">
                  <span class="lbl">${t4("semantic.apiKey")}</span>
                  <input
                    class="input mono"
                    type="password"
                    placeholder=${draft.openaiCompat.apiKeySet ? t4("semantic.keepExistingKey") : t4("semantic.enterApiKey")}
                    value=${draft.openaiCompat.apiKey}
                    onInput=${(e3) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      openaiCompat: {
        ...draft.openaiCompat,
        apiKey: e3.target.value
      }
    });
  }}
                  />
                  <div style="color:var(--fg-3);font-size:12px">${t4("semantic.apiKeyStoredNote")}</div>
                </div>
                <div class="form-row">
                  <span class="lbl">${t4("semantic.model")}</span>
                  <input
                    class="input mono"
                    type="text"
                    placeholder="Qwen3-Embedding"
                    value=${draft.openaiCompat.model}
                    onInput=${(e3) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      openaiCompat: {
        ...draft.openaiCompat,
        model: e3.target.value
      }
    });
  }}
                  />
                </div>
                <details style="margin-top:10px">
                  <summary style="cursor:pointer;color:var(--fg-2);font-size:12px">${t4("semantic.customRequestBody")}</summary>
                  <div class="form-row" style="margin-top:10px">
                    <span class="lbl">${t4("semantic.customRequestBody")}</span>
                    <textarea
                      class="input mono"
                      rows="6"
                      value=${draft.openaiCompat.extraBodyText}
                      onInput=${(e3) => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
    setDraft({
      ...draft,
      openaiCompat: {
        ...draft.openaiCompat,
        extraBodyText: e3.target.value
      }
    });
  }}
                    ></textarea>
                  </div>
                </details>
                ${semanticValidation.error ? html4`<div style="color:var(--c-err);font-size:12px;margin-top:-2px">${semanticValidation.error}</div>` : null}
              `}
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="btn primary" disabled=${busy || semanticValidation.error !== null} onClick=${saveProviderConfig}>${t4("common.save")}</button>
          </div>
        </div>
        ${info ? html4`<div><span class="pill info">${info}</span></div>` : null}

        ${indexReady ? html4`<${SemanticSearchSection} />` : null}

        ${isOllama && !binaryFound ? html4`
              <div class="card">
                <div class="card-h"><span class="title">${t4("semantic.installOllama")}</span></div>
                <div class="card-b" style="font-size:13px">
                  ${t4("semantic.installOllamaDesc")}
                  <ul style="margin:10px 0 4px 18px;padding:0">
                    <li><strong>${t4("semantic.macWindows")}</strong> ${t4("semantic.download")} <a href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com/download</a></li>
                    <li><strong>${t4("semantic.linux")}</strong> <code class="mono">curl -fsSL https://ollama.com/install.sh | sh</code></li>
                  </ul>
                  <div style="color:var(--fg-3);margin-top:8px">${t4("semantic.refreshHint", { model: modelName })}</div>
                </div>
              </div>
            ` : null}
        ${isOllama && binaryFound && !daemonRunning ? html4`
              <div class="card">
                <div class="card-h"><span class="title">${t4("semantic.daemon")}</span></div>
                <div class="card-b" style="font-size:13px">
                  ${t4("semantic.daemonDesc")}
                  <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
                    <button class="primary" disabled=${busy} onClick=${startDaemon}>${t4("semantic.startDaemon")}</button>
                    <span style="color:var(--fg-3);font-size:12px">${t4("semantic.runsOllama")}</span>
                  </div>
                </div>
              </div>
            ` : null}
        ${isOllama && daemonRunning && !modelPulled ? html4`
              <div class="card">
                <div class="card-h"><span class="title">${t4("semantic.model")}</span></div>
                <div class="card-b" style="font-size:13px">
                  ${t4("semantic.modelMissing", { model: modelName })}${pulling ? "" : ` ${t4("semantic.modelSize")}`}
                  <div style="display:flex;gap:8px;margin-top:10px">
                    <button class="primary" disabled=${busy || pulling} onClick=${() => pullModel(modelName)}>
                      ${pulling ? t4("semantic.pulling") : t4("semantic.pullModel", { model: modelName })}
                    </button>
                  </div>
                  ${pull ? html4`
                        <div style="margin-top:10px;display:flex;gap:10px;align-items:center;font-size:11.5px">
                          <span class=${`pill ${pull.status === "done" ? "ok" : pull.status === "error" ? "err" : ""}`}>${pull.status}</span>
                          <span style="color:var(--fg-3)">${((Date.now() - pull.startedAt) / 1e3).toFixed(1)}s</span>
                          ${pull.lastLine ? html4`<code class="mono" style="color:var(--fg-3)">${pull.lastLine}</code>` : null}
                        </div>
                      ` : null}
                </div>
              </div>
            ` : null}
        ${!isOllama ? html4`
              <div class="card">
                <div class="card-h"><span class="title">${t4("semantic.remoteProvider")}</span></div>
                <div class="card-b" style="font-size:13px;color:var(--fg-2)">
                  ${t4("semantic.remoteProviderDesc")}
                </div>
              </div>
            ` : null}

        ${job ? html4`
              ${sectionH3(t4("semantic.job"))}
              <${SemanticJobView} job=${job} running=${running} />
            ` : null}
      </div>

      <aside style="display:flex;flex-direction:column;gap:10px">
        <div class="card">
          <div class="card-h">
            <span class="title">${t4("semantic.indexStatus")}</span>
            <span class="meta">
              ${idx?.exists ? idx.compatible === false ? html4`<span class="pill warn">${t4("semantic.incompatibleStatus")}</span>` : html4`<span class="pill ok">${t4("semantic.builtStatus")}</span>` : html4`<span class="pill">${t4("system.none")}</span>`}
            </span>
          </div>
          ${idx?.exists ? html4`
                <div class="rail-kv"><span class="k">${t4("semantic.provider")}</span><span class="v">${idx.builtWith?.provider ?? idx.provider ?? provider}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.chunks")}</span><span class="v">${fmtNum(idx.chunks)}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.files")}</span><span class="v">${fmtNum(idx.files)}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.knowledgeDocs")}</span><span class="v">${t4("semantic.knowledgeDocsValue", { files: fmtNum(idx.knowledgeFiles || 0), chunks: fmtNum(idx.knowledgeChunks || 0) })}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.model")}</span><span class="v" style="font-size:11px">${idx.builtWith?.model ?? idx.model ?? modelName}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.dim")}</span><span class="v">${fmtNum(idx.dim)}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.size")}</span><span class="v">${fmtBytes(idx.sizeBytes)}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.lastBuild")}</span><span class="v">${fmtRelativeTime(idx.lastBuiltMs ?? null)}</span></div>
                ${idx.compatible === false ? html4`
                      <div class="rail-kv"><span class="k">${t4("semantic.builtWith")}</span><span class="v" style="font-size:11px">${idx.builtWith?.provider} · ${idx.builtWith?.model}</span></div>
                      <div class="rail-kv"><span class="k">${t4("semantic.currentTarget")}</span><span class="v" style="font-size:11px">${idx.current?.provider} · ${idx.current?.model}</span></div>
                      <div style="color:var(--c-warn);font-size:12px;padding-top:8px">${t4("semantic.incompatibleHint")}</div>
                    ` : null}
              ` : html4`<div style="color:var(--fg-3);font-size:12.5px;padding:6px 0">${t4("semantic.runIndexHint")}</div>`}
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
            <button class="primary" disabled=${busy || running || !ready || semanticDraftBlocked} onClick=${() => start(false)}>${indexReady ? t4("semantic.reIndex") : t4("semantic.build")}</button>
            ${idx?.exists ? html4`<button disabled=${busy || running || !ready || semanticDraftBlocked} onClick=${() => start(true)}>${t4("semantic.rebuild")}</button>` : null}
            ${running ? html4`<button onClick=${stop} style="border-color:var(--c-err);color:var(--c-err)">${t4("semantic.stop")}</button>` : null}
          </div>
        </div>

        <div class="card">
          <div class="card-h"><span class="title">${isOllama ? t4("semantic.ollama") : t4("semantic.openaiCompat")}</span></div>
          ${isOllama ? html4`
                <div class="rail-kv"><span class="k">${t4("semantic.binary")}</span><span class="v">${binaryFound ? html4`<span class="pill ok">${t4("semantic.found")}</span>` : html4`<span class="pill err">${t4("semantic.missing")}</span>`}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.daemonStatus")}</span><span class="v">${daemonRunning ? html4`<span class="pill ok">${t4("semantic.up")}</span>` : html4`<span class="pill warn">${t4("semantic.down")}</span>`}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.model")}</span><span class="v">${modelPulled ? html4`<span class="pill ok">${t4("semantic.pulled")}</span>` : html4`<span class="pill warn">${t4("semantic.missing")}</span>`}</span></div>
              ` : html4`
                <div class="rail-kv"><span class="k">${t4("semantic.apiUrl")}</span><span class="v" style="font-size:11px;max-width:160px;overflow-wrap:anywhere;word-break:break-word;text-align:right">${remote?.baseUrl ?? draft.openaiCompat.baseUrl}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.apiKey")}</span><span class="v">${remote?.apiKeySet ? html4`<span class="pill ok">${t4("semantic.found")}</span>` : html4`<span class="pill warn">${t4("semantic.missing")}</span>`}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.model")}</span><span class="v" style="font-size:11px">${remote?.model ?? draft.openaiCompat.model}</span></div>
                <div class="rail-kv"><span class="k">${t4("semantic.extraBody")}</span><span class="v">${fmtNum(remote?.extraBodyKeys.length ?? 0)}</span></div>
              `}
        </div>

        <${SemanticExcludesCard} />
      </aside>
    </div>
  `;
}
function toConfigDraft(config) {
  return {
    provider: config.provider,
    ollama: {
      baseUrl: config.ollama.baseUrl,
      model: config.ollama.model
    },
    openaiCompat: {
      baseUrl: config.openaiCompat.baseUrl,
      apiKey: "",
      model: config.openaiCompat.model,
      extraBodyText: JSON.stringify(config.openaiCompat.extraBody ?? {}, null, 2),
      apiKeySet: config.openaiCompat.apiKeySet
    }
  };
}
function validateSemanticDraft(draft) {
  if (draft.provider !== "openai-compat") {
    return { extraBody: {}, error: null };
  }
  const raw = draft.openaiCompat.extraBodyText.trim();
  if (!raw) {
    return { extraBody: {}, error: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      extraBody: {},
      error: t4("semantic.invalidCustomRequestBody", { error: err.message })
    };
  }
  if (!isPlainObject(parsed)) {
    return { extraBody: {}, error: t4("semantic.customRequestBodyMustBeObject") };
  }
  return { extraBody: parsed, error: null };
}
function SemanticSearchSection() {
  useLang();
  const [query2, setQuery] = d2("");
  const [hits, setHits] = d2(null);
  const [meta, setMeta] = d2(null);
  const [busy, setBusy] = d2(false);
  const [error, setError] = d2(null);
  const runSearch = q2(async () => {
    const q4 = query2.trim();
    if (!q4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r3 = await api("/semantic/search", {
        method: "POST",
        body: { query: q4, topK: 8, minScore: 0.3 }
      });
      setHits(r3.hits);
      setMeta({ elapsedMs: r3.elapsedMs, model: r3.model });
    } catch (err) {
      setError(err.message);
      setHits(null);
    } finally {
      setBusy(false);
    }
  }, [query2, busy]);
  return html4`
    <div style="margin-bottom:14px">
      <div style="position:relative">
        <div style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--c-brand);font-family:var(--font-mono);font-size:14px;pointer-events:none">≈</div>
        <input
          type="text"
          class="mono"
          style="width:100%;padding:10px 14px 10px 38px;font-size:13.5px;background:var(--bg-input);border:1px solid var(--bd);border-radius:var(--r);color:var(--fg-0);outline:none"
          placeholder=${t4("semantic.searchPlaceholder")}
          value=${query2}
          disabled=${busy}
          onInput=${(e3) => setQuery(e3.target.value)}
          onKeyDown=${(e3) => {
    if (e3.key === "Enter") {
      e3.preventDefault();
      runSearch();
    }
  }}
        />
      </div>
      ${hits || busy || error ? html4`
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--fg-3);margin:8px 0 6px;display:flex;align-items:center;gap:8px">
              ${busy ? html4`<span>${t4("semantic.searching")}</span>` : error ? html4`<span style="color:var(--c-err)">${error}</span>` : hits ? html4`<span>${t4("semantic.results", { count: hits.length, s: hits.length === 1 ? "" : "s", ms: meta?.elapsedMs ?? 0, model: meta?.model ?? "" })}</span>` : null}
            </div>
            ${hits && hits.length > 0 ? html4`
                  <div class="card" style="padding:0;max-height:420px;overflow-y:auto">
                    ${hits.map(
    (h3) => html4`
                        <div class="sr-card">
                          <div class="sr-h">
                            <span class="sr-path">${h3.path}</span>
                            <span class="sr-loc">L${h3.startLine} – L${h3.endLine}</span>
                            <span class="sr-score">${h3.score.toFixed(3)}</span>
                          </div>
                          <div class="sr-snip">${truncateSnippet(h3.snippet)}</div>
                        </div>
                      `
  )}
                  </div>
                ` : hits && hits.length === 0 && !busy ? html4`<div class="card" style="color:var(--fg-3);font-size:12px">${t4("semantic.noMatches")}</div>` : null}
          ` : null}
    </div>
  `;
}
function truncateSnippet(text, maxLines = 8) {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return `${lines.slice(0, maxLines).join("\n")}
  \u2026(${lines.length - maxLines} more lines)`;
}
function toDraft(c3) {
  return {
    excludeDirs: c3.excludeDirs ?? [],
    excludeFiles: c3.excludeFiles ?? [],
    excludeExts: c3.excludeExts ?? [],
    excludePatterns: c3.excludePatterns ?? [],
    respectGitignore: c3.respectGitignore !== false,
    includeKnowledgeDocs: c3.includeKnowledgeDocs === true,
    maxFileBytes: c3.maxFileBytes ?? 262144
  };
}
function fromDraft(d3) {
  return {
    excludeDirs: d3.excludeDirs,
    excludeFiles: d3.excludeFiles,
    excludeExts: d3.excludeExts,
    excludePatterns: d3.excludePatterns,
    respectGitignore: !!d3.respectGitignore,
    includeKnowledgeDocs: !!d3.includeKnowledgeDocs,
    maxFileBytes: d3.maxFileBytes
  };
}
function SemanticExcludesCard() {
  useLang();
  const [data, setData] = d2(null);
  const [draft, setDraft] = d2(null);
  const [preview, setPreview] = d2(null);
  const [busy, setBusy] = d2(false);
  const [error, setError] = d2(null);
  const [info, setInfo] = d2(null);
  const load = q2(async () => {
    try {
      const r3 = await api("/index-config");
      setData(r3);
      setDraft(toDraft(r3.resolved));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  const reset = q2(() => {
    if (data) setDraft(toDraft(data.defaults));
    setPreview(null);
  }, [data]);
  const save = q2(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const payload = fromDraft(draft);
      const r3 = await api("/index-config", {
        method: "POST",
        body: payload
      });
      setInfo(t4("semantic.savedConfig", { count: r3.changed.length || 0 }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [draft, load]);
  const runPreview = q2(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setInfo(t4("semantic.runningPreview"));
    try {
      const payload = fromDraft(draft);
      const r3 = await api("/index-config/preview", {
        method: "POST",
        body: payload
      });
      setPreview(r3);
      setInfo(null);
    } catch (err) {
      setError(err.message);
      setInfo(null);
    } finally {
      setBusy(false);
    }
  }, [draft]);
  if (!draft) {
    return html4`
      <div class="card">
        <div class="card-h"><span class="title">${t4("semantic.indexConfig")}</span></div>
        <div style="color:var(--fg-3);font-size:12.5px">${t4("common.loading")}</div>
      </div>
    `;
  }
  return html4`
    <div class="card">
      <div class="card-h">
        <span class="title">${t4("semantic.indexConfig")}</span>
        <span class="meta">
          <a class="mono" style="color:var(--c-brand);text-decoration:none;font-size:11px;cursor:pointer" onClick=${reset}>${t4("semantic.reset")}</a>
        </span>
      </div>
      ${info ? html4`<div style="margin-bottom:8px"><span class="pill ok">${info}</span></div>` : null}
      ${error ? html4`<div class="card accent-err" style="margin-bottom:8px">${error}</div>` : null}

      <${ChipFormRow}
        label=${t4("semantic.excludeDirs")}
        value=${draft.excludeDirs}
        onChange=${(v3) => setDraft({ ...draft, excludeDirs: v3 })}
        placeholder="dist"
      />
      <${ChipFormRow}
        label=${t4("semantic.excludeFiles")}
        value=${draft.excludeFiles}
        onChange=${(v3) => setDraft({ ...draft, excludeFiles: v3 })}
        placeholder="package-lock.json"
      />
      <${ChipFormRow}
        label=${t4("semantic.excludeExts")}
        value=${draft.excludeExts}
        onChange=${(v3) => setDraft({ ...draft, excludeExts: v3 })}
        placeholder=".lock"
      />
      <${ChipFormRow}
        label=${t4("semantic.excludePatterns")}
        sub=${t4("semantic.glob")}
        value=${draft.excludePatterns}
        onChange=${(v3) => setDraft({ ...draft, excludePatterns: v3 })}
        placeholder="**/*.test.ts"
      />

      <div class="checkbox-row" style="margin-top:8px;cursor:pointer" onClick=${() => setDraft({ ...draft, respectGitignore: !draft.respectGitignore })}>
        <span class=${`box ${draft.respectGitignore ? "on" : ""}`}>${draft.respectGitignore ? "\u2713" : ""}</span>
        <span>${t4("semantic.respectGitignore")}</span>
      </div>

      <div class="checkbox-row" style="margin-top:8px;cursor:pointer" onClick=${() => setDraft({ ...draft, includeKnowledgeDocs: !draft.includeKnowledgeDocs })}>
        <span class=${`box ${draft.includeKnowledgeDocs ? "on" : ""}`}>${draft.includeKnowledgeDocs ? "\u2713" : ""}</span>
        <span>${t4("semantic.includeKnowledgeDocs")}</span>
      </div>

      <div class="form-row" style="margin-top:10px">
        <span class="lbl">${t4("semantic.maxFileBytes")}</span>
        <input
          class="input mono"
          type="number"
          min="1024"
          step="1024"
          value=${draft.maxFileBytes}
          onInput=${(e3) => setDraft({ ...draft, maxFileBytes: Number(e3.target.value) || 0 })}
          style="font-size:12px"
        />
        <span class="help">${t4("semantic.skipLarger", { size: (draft.maxFileBytes / 1024 / 1024).toFixed(1) })}</span>
      </div>

      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn ghost" style="flex:1" disabled=${busy} onClick=${runPreview}><span class="g">⊕</span><span>${t4("semantic.preview")}</span></button>
        <button class="btn primary" style="flex:1" disabled=${busy} onClick=${save}>${t4("common.save")}</button>
      </div>

      ${preview ? html4`<div style="margin-top:10px"><${ExcludesPreview} preview=${preview} /></div>` : null}
    </div>
  `;
}
function ExcludesPreview({ preview }) {
  useLang();
  const buckets = preview.skipBuckets || {};
  const samples = preview.skipSamples || {};
  const totalSkipped = Object.values(buckets).reduce((a3, b2) => a3 + (b2 || 0), 0);
  const reasons = [
    "gitignore",
    "pattern",
    "defaultDir",
    "defaultFile",
    "binaryExt",
    "binaryContent",
    "tooLarge",
    "readError"
  ].filter((k3) => (buckets[k3] || 0) > 0);
  return html4`
    <div class="excludes-preview">
      <div class="summary">${t4("semantic.previewSummary", { included: preview.filesIncluded, skipped: totalSkipped })}</div>
      ${reasons.length === 0 ? html4`<div style="color:var(--fg-3)">${t4("semantic.nothingSkipped")}</div>` : reasons.map(
    (r3) => html4`
              <details>
                <summary><strong>${r3}: ${buckets[r3]}</strong></summary>
                <ul>
                  ${(samples[r3] || []).map((p3) => html4`<li><code>${p3}</code></li>`)}
                  ${(buckets[r3] || 0) > (samples[r3] || []).length ? html4`<li style="color:var(--fg-3)">…${(buckets[r3] || 0) - (samples[r3] || []).length} more</li>` : null}
                </ul>
              </details>
            `
  )}
      ${preview.sampleIncluded?.length ? html4`
            <details>
              <summary>${t4("semantic.firstIncluded", { count: preview.sampleIncluded.length })}</summary>
              <ul>
                ${preview.sampleIncluded.map((p3) => html4`<li><code>${p3}</code></li>`)}
              </ul>
            </details>
          ` : null}
    </div>
  `;
}
function ChipFormRow({
  label,
  sub,
  value,
  onChange,
  placeholder = "+ add"
}) {
  const [adding, setAdding] = d2("");
  const remove = (entry) => onChange(value.filter((v3) => v3 !== entry));
  const commit = () => {
    const trimmed = adding.trim();
    if (!trimmed || value.includes(trimmed)) {
      setAdding("");
      return;
    }
    onChange([...value, trimmed]);
    setAdding("");
  };
  return html4`
    <div class="form-row">
      <span class="lbl">${label}${sub ? html4`<span style="color:var(--fg-3);font-weight:400;text-transform:none;letter-spacing:0"> · ${sub}</span>` : null}</span>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${value.map(
    (e3) => html4`
            <span class="chip-f static">
              <span>${e3}</span>
              <span class="x" style="cursor:pointer" onClick=${() => remove(e3)} title="remove">×</span>
            </span>
          `
  )}
        <input
          type="text"
          class="chip-add-input"
          value=${adding}
          placeholder=${placeholder}
          onInput=${(ev) => setAdding(ev.target.value)}
          onKeyDown=${(ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      commit();
    }
  }}
          onBlur=${commit}
        />
      </div>
    </div>
  `;
}
function SemanticJobView({ job, running }) {
  useLang();
  const phaseLabel = {
    setup: t4("semantic.phaseSetup"),
    scan: t4("semantic.phaseScan"),
    embed: t4("semantic.phaseEmbed"),
    write: t4("semantic.phaseWrite"),
    done: t4("semantic.phaseDone"),
    partial: t4("semantic.phasePartial"),
    error: t4("semantic.phaseError"),
    cancelled: t4("semantic.phaseCancelled")
  }[job.phase] ?? job.phase;
  const total = job.chunksTotal ?? 0;
  const doneN = job.chunksDone ?? 0;
  const ratio = total > 0 ? Math.min(1, doneN / total) : 0;
  const elapsedBase = job.finishedAt ?? Date.now();
  const elapsedSeconds = (elapsedBase - job.startedAt) / 1e3;
  const elapsed = elapsedSeconds < 0.1 ? "<0.1s" : `${elapsedSeconds.toFixed(1)}s`;
  const phaseSummary = job.phase === "error" && job.lastPhase === "setup" ? t4("semantic.setupFailed") : phaseLabel;
  return html4`
    <div class="kv">
      <div><span class="kv-key">phase</span>
        <span class=${`pill ${job.phase === "error" ? "pill-err" : job.phase === "cancelled" || job.phase === "partial" ? "warn" : running ? "pill-active" : "pill-dim"}`}>${phaseSummary}</span>
        ${job.aborted && running ? html4`<span class="pill warn" style="margin-left: 6px;">${t4("semantic.stopping")}</span>` : null}
        <span style="color:var(--fg-3);margin-left:8px">${elapsed}</span>
      </div>
      ${job.filesScanned !== null && job.filesScanned !== void 0 ? html4`<div><span class="kv-key">${t4("semantic.files")}</span>${t4("semantic.scanned", { count: job.filesScanned })}${job.filesChanged != null ? ` \xB7 ${t4("semantic.changed", { count: job.filesChanged })}` : ""}${job.filesSkipped ? ` \xB7 ${t4("semantic.skipped", { count: job.filesSkipped })}` : ""}</div>` : null}
      ${total > 0 ? html4`
            <div>
              <span class="kv-key">${t4("semantic.chunks")}</span>${t4("semantic.chunksProgress", { done: doneN, total, pct: (ratio * 100).toFixed(0) })}
            </div>
            <div class="bar" style="margin-top: 4px;">
              <div class="fill" style=${`width: ${(ratio * 100).toFixed(1)}%; background: var(--primary);`}></div>
            </div>
          ` : null}
      ${job.error ? html4`<div><span class="kv-key">${t4("semantic.phaseError")}</span><span class="err">${job.error}</span></div>` : null}
      ${job.result ? html4`<div><span class="kv-key">${t4("semantic.result")}</span>${t4("semantic.added", { count: job.result.chunksAdded })} · ${t4("semantic.removed", { count: job.result.chunksRemoved })}${job.result.chunksSkipped ? ` \xB7 ${t4("semantic.failed", { count: job.result.chunksSkipped })}` : ""} · ${(job.result.durationMs / 1e3).toFixed(1)}s</div>` : null}
      ${job.result?.skipBuckets ? html4`<${SkipBucketsView} buckets=${job.result.skipBuckets} />` : null}
    </div>
  `;
}
function SkipBucketsView({ buckets }) {
  useLang();
  const order = [
    ["gitignore", "gitignore"],
    ["pattern", "pattern"],
    ["defaultDir", "defaultDir"],
    ["defaultFile", "defaultFile"],
    ["binaryExt", "binaryExt"],
    ["binaryContent", "binaryContent"],
    ["tooLarge", "tooLarge"],
    ["readError", "readError"]
  ];
  const total = order.reduce((a3, [k3]) => a3 + (buckets[k3] || 0), 0);
  if (total === 0) return null;
  const parts = order.filter(([k3]) => (buckets[k3] || 0) > 0).map(([k3, label]) => `${label}: ${buckets[k3]}`);
  return html4`<div><span class="kv-key">${t4("semantic.skipped")}</span>${t4("semantic.skippedFiles", { total, details: parts.join(", ") })}</div>`;
}
function isActiveSemanticPhase(phase) {
  return phase === "setup" || phase === "scan" || phase === "embed" || phase === "write";
}
function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export { SemanticPanel };
