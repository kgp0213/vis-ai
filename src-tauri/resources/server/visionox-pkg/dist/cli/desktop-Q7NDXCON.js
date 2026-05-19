#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  createMcpRuntime
} from "./chunk-3Z6IBU3D.js";
import {
  buildCodeToolset
} from "./chunk-YFGF5NKA.js";
import {
  Eventizer,
  autoResolveVerdict
} from "./chunk-45U62RI3.js";
import "./chunk-H6PS7IUE.js";
import "./chunk-PQXPXJBJ.js";
import {
  CacheFirstLoop,
  ImmutablePrefix,
  listDirectory,
  listFilesWithStatsAsync,
  parseAtQuery,
  rankPickerCandidates
} from "./chunk-2R4QCDOZ.js";
import "./chunk-F3PXYSNN.js";
import "./chunk-FHOGSSCH.js";
import {
  parseMcpSpec
} from "./chunk-6AK4EY3D.js";
import {
  MemoryStore,
  codeSystemPrompt
} from "./chunk-5JJRUIPA.js";
import {
  canonicalPresetName,
  resolvePreset
} from "./chunk-2425HK6U.js";
import {
  countTokens
} from "./chunk-PV55UMTO.js";
import {
  DeepSeekClient,
  pickPrimaryBalance
} from "./chunk-2KDUS647.js";
import "./chunk-25T6CVUP.js";
import {
  loadDotenv
} from "./chunk-2UQP6H6T.js";
import "./chunk-YYQAUTTN.js";
import {
  pauseGate
} from "./chunk-O52OLQL3.js";
import {
  SkillStore
} from "./chunk-2K65GZBT.js";
import "./chunk-PLHAZOLZ.js";
import "./chunk-XCGGEJTI.js";
import "./chunk-7O5ALB4C.js";
import "./chunk-S4XVGLRW.js";
import {
  deleteSession,
  listSessionsForWorkspace,
  loadSessionMessages,
  loadSessionMeta,
  patchSessionMeta,
  timestampSuffix
} from "./chunk-6PBZN4VI.js";
import "./chunk-RE4RAVFF.js";
import {
  isPlausibleKey,
  loadApiKey,
  loadBaseUrl,
  loadEditMode,
  loadEditor,
  loadPreset,
  loadReasoningEffort,
  loadRecentWorkspaces,
  loadWorkspaceDir,
  pushRecentWorkspace,
  readConfig,
  saveApiKey,
  saveBaseUrl,
  saveEditMode,
  saveEditor,
  savePreset,
  saveReasoningEffort,
  saveWorkspaceDir,
  writeConfig
} from "./chunk-XPDVG52A.js";
import "./chunk-HFEAY5DT.js";
import "./chunk-YQ6NTIIE.js";
import {
  VERSION
} from "./chunk-XXC2BYTV.js";
import "./chunk-TUK7OWJA.js";

// src/cli/commands/desktop.ts
import { AsyncLocalStorage } from "async_hooks";
import { existsSync, statSync, writeSync } from "fs";
import { readFile } from "fs/promises";
import { isAbsolute, join, resolve } from "path";
import { stdin } from "process";
import { createInterface } from "readline";
function emit(ev, tabId) {
  const payload = tabId ? { ...ev, tabId } : ev;
  writeSync(1, Buffer.from(`${JSON.stringify(payload)}
`, "utf8"));
}
function buildLoadedMessages(records) {
  const out = [];
  let turn = 0;
  let pendingAssistantIdx = -1;
  for (const rec of records) {
    if (rec.role === "system") continue;
    if (rec.role === "user") {
      out.push({ kind: "user", text: rec.content ?? "" });
      pendingAssistantIdx = -1;
      continue;
    }
    if (rec.role === "assistant") {
      turn++;
      const segments = [];
      if (rec.reasoning_content) segments.push({ kind: "reasoning", text: rec.reasoning_content });
      if (rec.content) segments.push({ kind: "text", text: rec.content });
      if (rec.tool_calls) {
        for (let i = 0; i < rec.tool_calls.length; i++) {
          const tc = rec.tool_calls[i];
          if (!tc) continue;
          segments.push({
            kind: "tool",
            callId: tc.id ?? `tc-r-${turn}-${i}`,
            name: tc.function?.name ?? "",
            args: tc.function?.arguments ?? ""
          });
        }
      }
      out.push({ kind: "assistant", turn, segments, pending: false });
      pendingAssistantIdx = out.length - 1;
      continue;
    }
    if (rec.role === "tool") {
      if (pendingAssistantIdx < 0) continue;
      const host = out[pendingAssistantIdx];
      if (host?.kind !== "assistant") continue;
      const callId = rec.tool_call_id;
      if (!callId) continue;
      const seg = host.segments.find((s) => s.kind === "tool" && s.callId === callId);
      if (seg && seg.kind === "tool") {
        seg.result = rec.content ?? "";
        seg.ok = !/error|failed/i.test(seg.result.slice(0, 200));
      }
    }
  }
  return out;
}
function emitSettings(tab) {
  const apiKey = loadApiKey();
  const recent = loadRecentWorkspaces().filter((p) => p !== tab.rootDir);
  emit(
    {
      type: "$settings",
      reasoningEffort: loadReasoningEffort(),
      editMode: loadEditMode(),
      budgetUsd: tab.runtime?.loop.budgetUsd ?? null,
      baseUrl: loadBaseUrl(),
      apiKeyPrefix: apiKey ? `${apiKey.slice(0, 6)}\u2026${apiKey.slice(-3)}` : void 0,
      workspaceDir: tab.rootDir,
      recentWorkspaces: recent,
      model: tab.currentModel,
      preset: tab.currentPreset,
      editor: loadEditor(),
      version: VERSION
    },
    tab.id
  );
}
async function emitBalance(tab) {
  if (!tab.runtime) return;
  const bal = await tab.runtime.loop.client.getBalance().catch(() => null);
  if (!bal) return;
  const primary = pickPrimaryBalance(bal.balance_infos);
  if (!primary) return;
  emit(
    {
      type: "$balance",
      currency: primary.currency,
      total: Number(primary.total_balance),
      isAvailable: bal.is_available
    },
    tab.id
  );
}
function emitSessions(tab) {
  try {
    const items = listSessionsForWorkspace(tab.rootDir).map((s) => ({
      name: s.name,
      messageCount: s.messageCount,
      mtime: s.mtime.toISOString(),
      summary: s.meta.summary
    }));
    emit({ type: "$sessions", items }, tab.id);
  } catch (err) {
    emit({ type: "$error", message: `session_list failed: ${err.message}` }, tab.id);
  }
}
function summarizeMcpSpec(raw) {
  try {
    const parsed = parseMcpSpec(raw);
    if (parsed.transport === "stdio") {
      const argv = [parsed.command, ...parsed.args].join(" ");
      return {
        raw,
        name: parsed.name,
        transport: "stdio",
        summary: `stdio \xB7 ${argv}`,
        status: "configured"
      };
    }
    return {
      raw,
      name: parsed.name,
      transport: parsed.transport,
      summary: `${parsed.transport} \xB7 ${parsed.url}`,
      status: "configured"
    };
  } catch (err) {
    return {
      raw,
      name: null,
      transport: "stdio",
      summary: raw,
      parseError: err.message,
      status: "failed",
      statusReason: err.message
    };
  }
}
function emitMcpSpecs(tab) {
  const cfg = readConfig();
  const specs = (cfg.mcp ?? []).map((raw) => {
    const base = summarizeMcpSpec(raw);
    const live = tab.mcpStatuses.get(raw);
    if (!live) return base;
    return { ...base, status: live.kind, statusReason: live.reason, toolCount: live.toolCount };
  });
  const bridged = specs.length > 0 && specs.every((s) => s.status === "connected");
  emit({ type: "$mcp_specs", specs, bridged }, tab.id);
}
function emitMemory(tab) {
  try {
    const store = new MemoryStore({ projectRoot: tab.rootDir });
    const entries = store.list().map((e) => ({
      name: e.name,
      scope: e.scope,
      description: e.description
    }));
    emit({ type: "$memory", entries }, tab.id);
  } catch (err) {
    emit({ type: "$error", message: `memory_get failed: ${err.message}` }, tab.id);
  }
}
function emitCtxBreakdown(tab) {
  if (!tab.runtime) return;
  try {
    const sys = countTokens(tab.runtime.loop.prefix.system);
    const tools = countTokens(JSON.stringify(tab.runtime.loop.prefix.toolSpecs));
    emit({ type: "$ctx_breakdown", reservedTokens: sys + tools }, tab.id);
  } catch {
  }
}
function emitSkills(tab) {
  try {
    const store = new SkillStore({ projectRoot: tab.rootDir });
    const items = store.list().map((s) => ({
      name: s.name,
      description: s.description,
      scope: s.scope,
      path: s.path,
      runAs: s.runAs,
      model: s.model
    }));
    emit({ type: "$skills", items }, tab.id);
  } catch (err) {
    emit({ type: "$error", message: `skills_get failed: ${err.message}` }, tab.id);
  }
}
var tabCounter = 0;
function nextTabId() {
  tabCounter++;
  return `t${tabCounter}`;
}
function mintSessionFor(rootDir) {
  const name = `desktop-${timestampSuffix()}-${tabCounter}`;
  try {
    patchSessionMeta(name, { workspace: rootDir });
  } catch {
  }
  return name;
}
function buildRuntimeFor(tab) {
  if (!tab.toolset) throw new Error("buildRuntimeFor called before initTabToolset finished");
  const toolset = tab.toolset;
  const client = new DeepSeekClient({ baseUrl: loadBaseUrl() });
  const prefix = new ImmutablePrefix({ system: tab.system, toolSpecs: toolset.tools.specs() });
  const reasoningEffort = loadReasoningEffort();
  const { autoEscalate } = resolvePreset(tab.currentPreset);
  const loop = new CacheFirstLoop({
    client,
    prefix,
    tools: toolset.tools,
    model: tab.currentModel,
    budgetUsd: tab.budgetUsd,
    session: tab.currentSession,
    reasoningEffort,
    autoEscalate
  });
  const eventizer = new Eventizer();
  const ctx = { model: tab.currentModel, prefixHash: prefix.fingerprint, reasoningEffort };
  return { loop, eventizer, ctx };
}
var TS_EXPORT_RE = /^export\s+(?:default\s+)?(?:async\s+)?(function|class|const|let|var|interface|type|enum)\s+\*?\s*(\w+)/;
var FILE_INDEX_TTL_MS = 1e4;
async function getFileIndexFor(tab) {
  const fresh = tab.fileIndex && Date.now() - tab.fileIndexBuiltAt < FILE_INDEX_TTL_MS;
  if (fresh) return tab.fileIndex;
  if (tab.fileIndexBuilding) return tab.fileIndexBuilding;
  tab.fileIndexBuilding = listFilesWithStatsAsync(tab.rootDir, { maxResults: 5e3 }).then((res) => {
    tab.fileIndex = res;
    tab.fileIndexBuiltAt = Date.now();
    tab.fileIndexBuilding = null;
    return res;
  }).catch((err) => {
    tab.fileIndexBuilding = null;
    throw err;
  });
  return tab.fileIndexBuilding;
}
async function getSymbolIndexFor(tab) {
  if (tab.symbolIndex) return tab.symbolIndex;
  if (tab.symbolBuilding) return tab.symbolBuilding;
  tab.symbolBuilding = (async () => {
    const files = await getFileIndexFor(tab);
    const sourceExts = /\.(?:ts|tsx|js|jsx|mts|cts)$/;
    const candidates = files.filter((f) => sourceExts.test(f.path)).slice(0, 1500);
    const out = [];
    const PARALLEL = 16;
    for (let i = 0; i < candidates.length; i += PARALLEL) {
      const batch = candidates.slice(i, i + PARALLEL);
      await Promise.all(
        batch.map(async (entry) => {
          const abs = isAbsolute(entry.path) ? entry.path : join(tab.rootDir, entry.path);
          try {
            const text = await readFile(abs, "utf8");
            const lines = text.split(/\r?\n/);
            for (let li = 0; li < lines.length; li++) {
              const line = lines[li];
              if (!line.startsWith("export ")) continue;
              const m = TS_EXPORT_RE.exec(line);
              if (m) out.push({ kind: m[1], name: m[2], path: entry.path, line: li + 1 });
            }
          } catch {
          }
        })
      );
    }
    tab.symbolIndex = out;
    tab.symbolBuilding = null;
    return out;
  })().catch((err) => {
    tab.symbolBuilding = null;
    throw err;
  });
  return tab.symbolBuilding;
}
function rankSymbols(syms, q, limit) {
  const needle = q.toLowerCase();
  const scored = [];
  for (const s of syms) {
    const lower = s.name.toLowerCase();
    let score;
    if (lower === needle) score = 0;
    else if (lower.startsWith(needle)) score = 100;
    else if (lower.includes(needle)) score = 500 + lower.indexOf(needle);
    else continue;
    scored.push({ entry: s, score });
  }
  scored.sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name));
  return scored.slice(0, limit).map((s) => `${s.entry.path}:${s.entry.line}`);
}
function pushMentionRecent(tab, path) {
  const MAX = 20;
  const idx = tab.recentMentions.indexOf(path);
  if (idx >= 0) tab.recentMentions.splice(idx, 1);
  tab.recentMentions.unshift(path);
  if (tab.recentMentions.length > MAX) tab.recentMentions.length = MAX;
}
async function desktopCommand(opts) {
  loadDotenv();
  const tabs = /* @__PURE__ */ new Map();
  const tabContext = new AsyncLocalStorage();
  function activeRunningTab() {
    const id = tabContext.getStore();
    return id ? tabs.get(id) : void 0;
  }
  function createTabSkeleton(initialDir) {
    const dir = resolve(initialDir ?? opts.dir ?? loadWorkspaceDir() ?? process.cwd());
    pushRecentWorkspace(dir);
    const preset = canonicalPresetName(loadPreset());
    const resolved = resolvePreset(preset);
    const model = opts.model || resolved.model;
    const tab = {
      id: nextTabId(),
      rootDir: dir,
      currentSession: "",
      currentPreset: preset,
      currentModel: model,
      budgetUsd: opts.budgetUsd,
      toolset: null,
      system: "",
      runtime: null,
      aborter: null,
      fileIndex: null,
      fileIndexBuilding: null,
      fileIndexBuiltAt: 0,
      symbolIndex: null,
      symbolBuilding: null,
      recentMentions: [],
      pendingGateIds: /* @__PURE__ */ new Set(),
      completedStepIds: /* @__PURE__ */ new Set(),
      planTotalSteps: 0,
      mcpRuntime: null,
      mcpStatuses: /* @__PURE__ */ new Map()
    };
    tab.currentSession = mintSessionFor(dir);
    tabs.set(tab.id, tab);
    return tab;
  }
  async function initTabToolset(tab) {
    const toolset = await buildCodeToolset({ rootDir: tab.rootDir });
    tab.toolset = toolset;
    tab.system = codeSystemPrompt(tab.rootDir, {
      hasSemanticSearch: toolset.semantic.enabled,
      modelId: tab.currentModel
    });
    if (loadApiKey()) {
      process.env.DEEPSEEK_API_KEY = loadApiKey();
      tab.runtime = buildRuntimeFor(tab);
      void bridgeTabMcp(tab);
    }
  }
  function bridgeTabMcp(tab) {
    if (!tab.runtime || !tab.toolset) return Promise.resolve();
    if (tab.mcpRuntime) {
      return tab.mcpRuntime.reloadFromConfig(tab.runtime.loop).then(() => emitMcpSpecs(tab)).catch((err) => {
        emit({ type: "$error", message: `mcp reload failed: ${err.message}` }, tab.id);
      });
    }
    const requested = (readConfig().mcp ?? []).length;
    if (requested === 0) return Promise.resolve();
    const runtime = createMcpRuntime({
      getTools: () => {
        if (!tab.toolset) throw new Error("toolset gone");
        return tab.toolset.tools;
      },
      getMcpPrefix: () => void 0,
      getRequestedCount: () => requested,
      progressSink: { current: null }
    });
    tab.mcpRuntime = runtime;
    runtime.setLifecycleSink((notice) => {
      if (notice.kind === "slow") return;
      const cfg = readConfig().mcp ?? [];
      const target = cfg.find((raw) => {
        try {
          return parseMcpSpec(raw).name === notice.name;
        } catch {
          return false;
        }
      });
      if (!target) return;
      if (notice.kind === "handshake") {
        tab.mcpStatuses.set(target, { kind: "handshake" });
      } else if (notice.kind === "connected") {
        tab.mcpStatuses.set(target, { kind: "connected", toolCount: notice.tools });
      } else if (notice.kind === "failed") {
        tab.mcpStatuses.set(target, { kind: "failed", reason: notice.reason });
      } else if (notice.kind === "disabled") {
        tab.mcpStatuses.set(target, { kind: "disabled" });
      }
      emitMcpSpecs(tab);
    });
    return runtime.reloadFromConfig(tab.runtime.loop).then(() => void 0).catch((err) => {
      emit({ type: "$error", message: `mcp bridge failed: ${err.message}` }, tab.id);
    });
  }
  async function closeTab(tab) {
    tab.aborter?.abort();
    try {
      await tab.toolset?.jobs.shutdown();
    } catch {
    }
    if (tab.mcpRuntime) {
      try {
        await tab.mcpRuntime.closeAll();
      } catch {
      }
    }
    tabs.delete(tab.id);
    emit({ type: "$tab_closed" }, tab.id);
  }
  async function runTurn(tab, text) {
    if (!tab.runtime) return;
    const rt = tab.runtime;
    tab.aborter = new AbortController();
    if (tab.currentSession) {
      const existing = loadSessionMeta(tab.currentSession).summary;
      if (!existing || !existing.trim()) {
        const summary = text.replace(/\s+/g, " ").trim().slice(0, 60);
        if (summary) {
          try {
            patchSessionMeta(tab.currentSession, { summary });
          } catch {
          }
        }
      }
    }
    await tabContext.run(tab.id, async () => {
      try {
        for await (const ev of rt.loop.step(text)) {
          for (const kev of rt.eventizer.consume(ev, rt.ctx)) emit(kev, tab.id);
          if (ev.role === "tool" && (ev.toolName === "remember" || ev.toolName === "forget")) {
            emitMemory(tab);
          }
          if (tab.aborter?.signal.aborted) break;
        }
      } catch (err) {
        emit({ type: "$error", message: err.message }, tab.id);
      } finally {
        tab.aborter = null;
        emit({ type: "$turn_complete" }, tab.id);
        if (tab.planTotalSteps > 0 && tab.completedStepIds.size >= tab.planTotalSteps) {
          tab.completedStepIds.clear();
          tab.planTotalSteps = 0;
          emit({ type: "$plan_cleared" }, tab.id);
        }
        emitSessions(tab);
        void emitBalance(tab);
      }
    });
  }
  async function switchWorkspace(tab, nextDir) {
    const target = resolve(nextDir);
    if (target === tab.rootDir) {
      emitSettings(tab);
      return;
    }
    if (!existsSync(target) || !statSync(target).isDirectory()) {
      emit({ type: "$error", message: `Workspace not found: ${target}` }, tab.id);
      emitSettings(tab);
      return;
    }
    tab.aborter?.abort();
    try {
      await tab.toolset?.jobs.shutdown();
    } catch {
    }
    tab.rootDir = target;
    saveWorkspaceDir(target);
    pushRecentWorkspace(target);
    tab.fileIndex = null;
    tab.fileIndexBuilding = null;
    tab.fileIndexBuiltAt = 0;
    tab.symbolIndex = null;
    tab.symbolBuilding = null;
    tab.recentMentions.length = 0;
    tab.currentSession = mintSessionFor(target);
    tab.toolset = await buildCodeToolset({ rootDir: target });
    tab.system = codeSystemPrompt(target, {
      hasSemanticSearch: tab.toolset.semantic.enabled,
      modelId: tab.currentModel
    });
    if (tab.runtime) tab.runtime = buildRuntimeFor(tab);
    emitSessions(tab);
    emitSettings(tab);
    emitSkills(tab);
  }
  function forgetGate(id) {
    for (const t of tabs.values()) {
      if (t.pendingGateIds.delete(id)) return t;
    }
    return void 0;
  }
  function cancelPendingGates(tab) {
    const hadActivePlan = tab.planTotalSteps > 0 || tab.completedStepIds.size > 0;
    const ids = [...tab.pendingGateIds];
    tab.pendingGateIds.clear();
    for (const id of ids) pauseGate.cancel(id);
    if (hadActivePlan) {
      tab.completedStepIds.clear();
      tab.planTotalSteps = 0;
      emit({ type: "$plan_cleared" }, tab.id);
    }
  }
  const first = createTabSkeleton();
  process.once("exit", () => {
    for (const t of tabs.values()) void t.toolset?.jobs.shutdown();
  });
  pauseGate.on((req) => {
    const tab = activeRunningTab();
    const tabId = tab?.id;
    if (tab) tab.pendingGateIds.add(req.id);
    const auto = autoResolveVerdict(req, loadEditMode());
    if (auto !== null) {
      if (req.kind === "plan_checkpoint") {
        const payload = req.payload;
        if (tab) tab.completedStepIds.add(payload.stepId);
        emit(
          {
            type: "$step_completed",
            stepId: payload.stepId,
            title: payload.title,
            result: payload.result,
            notes: payload.notes
          },
          tabId
        );
      }
      if (tab) tab.pendingGateIds.delete(req.id);
      pauseGate.resolve(req.id, auto);
      return;
    }
    if (req.kind === "run_command" || req.kind === "run_background") {
      const payload = req.payload;
      emit(
        { type: "$confirm_required", id: req.id, kind: req.kind, command: payload.command ?? "" },
        tabId
      );
      return;
    }
    if (req.kind === "path_access") {
      const payload = req.payload;
      emit(
        {
          type: "$path_access_required",
          id: req.id,
          path: payload.path,
          intent: payload.intent,
          toolName: payload.toolName,
          sandboxRoot: payload.sandboxRoot,
          allowPrefix: payload.allowPrefix
        },
        tabId
      );
      return;
    }
    if (req.kind === "choice") {
      const payload = req.payload;
      emit(
        {
          type: "$choice_required",
          id: req.id,
          question: payload.question,
          options: payload.options,
          allowCustom: payload.allowCustom
        },
        tabId
      );
      return;
    }
    if (req.kind === "plan_proposed") {
      const payload = req.payload;
      if (tab) {
        tab.completedStepIds.clear();
        tab.planTotalSteps = payload.steps?.length ?? 0;
      }
      emit(
        {
          type: "$plan_required",
          id: req.id,
          plan: payload.plan,
          steps: payload.steps,
          summary: payload.summary
        },
        tabId
      );
      return;
    }
    if (req.kind === "plan_checkpoint") {
      const payload = req.payload;
      if (tab) tab.completedStepIds.add(payload.stepId);
      emit(
        {
          type: "$step_completed",
          stepId: payload.stepId,
          title: payload.title,
          result: payload.result,
          notes: payload.notes
        },
        tabId
      );
      emit(
        {
          type: "$checkpoint_required",
          id: req.id,
          stepId: payload.stepId,
          title: payload.title,
          result: payload.result,
          notes: payload.notes,
          completed: tab?.completedStepIds.size ?? 0,
          total: tab?.planTotalSteps ?? 0
        },
        tabId
      );
      return;
    }
    if (req.kind === "plan_revision") {
      const payload = req.payload;
      emit(
        {
          type: "$revision_required",
          id: req.id,
          reason: payload.reason,
          remainingSteps: payload.remainingSteps,
          summary: payload.summary
        },
        tabId
      );
      return;
    }
    const exhaustive = req.kind;
    process.stderr.write(
      `[desktop] no handler for pause kind "${String(exhaustive)}" \u2014 auto-cancelling gate id=${req.id}
`
    );
    if (tab) tab.pendingGateIds.delete(req.id);
    pauseGate.cancel(req.id);
  });
  emit({ type: "$tab_opened", workspaceDir: first.rootDir }, first.id);
  emitSessions(first);
  emitSettings(first);
  emitMcpSpecs(first);
  emitSkills(first);
  emitMemory(first);
  if (!loadApiKey()) emit({ type: "$needs_setup", reason: "no_api_key" }, first.id);
  void emitBalance(first);
  void initTabToolset(first).then(() => {
    if (loadApiKey()) emit({ type: "$ready" }, first.id);
    emitCtxBreakdown(first);
  }).catch((err) => {
    emit({ type: "$error", message: `init failed: ${err.message}` }, first.id);
  });
  const rl = createInterface({ input: stdin });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      emit({ type: "$error", message: `bad json on stdin: ${trimmed.slice(0, 80)}` });
      return;
    }
    if (msg.cmd === "tab_open") {
      try {
        const tab2 = createTabSkeleton(msg.workspaceDir);
        emit({ type: "$tab_opened", workspaceDir: tab2.rootDir }, tab2.id);
        emitSessions(tab2);
        emitSettings(tab2);
        emitMcpSpecs(tab2);
        emitSkills(tab2);
        emitMemory(tab2);
        if (!loadApiKey()) emit({ type: "$needs_setup", reason: "no_api_key" }, tab2.id);
        void emitBalance(tab2);
        void initTabToolset(tab2).then(() => {
          if (loadApiKey()) emit({ type: "$ready" }, tab2.id);
          emitCtxBreakdown(tab2);
        }).catch((err) => {
          emit({ type: "$error", message: `init failed: ${err.message}` }, tab2.id);
        });
      } catch (err) {
        emit({ type: "$error", message: `tab_open failed: ${err.message}` });
      }
      return;
    }
    if (msg.cmd === "confirm_response") {
      forgetGate(msg.id);
      pauseGate.resolve(msg.id, msg.response);
      return;
    }
    if (msg.cmd === "choice_response") {
      forgetGate(msg.id);
      pauseGate.resolve(msg.id, msg.response);
      return;
    }
    if (msg.cmd === "plan_response") {
      const tab2 = forgetGate(msg.id);
      if (tab2 && msg.response.type === "cancel") {
        tab2.completedStepIds.clear();
        tab2.planTotalSteps = 0;
        emit({ type: "$plan_cleared" }, tab2.id);
      }
      pauseGate.resolve(msg.id, msg.response);
      return;
    }
    if (msg.cmd === "checkpoint_response") {
      const tab2 = forgetGate(msg.id);
      if (tab2 && msg.response.type === "stop") {
        tab2.completedStepIds.clear();
        tab2.planTotalSteps = 0;
        emit({ type: "$plan_cleared" }, tab2.id);
      }
      pauseGate.resolve(msg.id, msg.response);
      return;
    }
    if (msg.cmd === "revision_response") {
      forgetGate(msg.id);
      pauseGate.resolve(msg.id, msg.response);
      return;
    }
    if (msg.cmd === "setup_save_key") {
      const key = msg.key.trim();
      if (!isPlausibleKey(key)) {
        emit({
          type: "$error",
          message: "Key looks too short \u2014 paste the full token (16+ chars, no spaces)."
        });
        return;
      }
      try {
        saveApiKey(key);
        process.env.DEEPSEEK_API_KEY = key;
        for (const tab2 of tabs.values()) {
          if (!tab2.toolset) {
            emitSettings(tab2);
            void emitBalance(tab2);
            continue;
          }
          tab2.runtime = buildRuntimeFor(tab2);
          emit({ type: "$ready" }, tab2.id);
          emitSettings(tab2);
          void emitBalance(tab2);
        }
      } catch (err) {
        emit({ type: "$error", message: `saveApiKey failed: ${err.message}` });
      }
      return;
    }
    const tab = msg.tabId ? tabs.get(msg.tabId) : first;
    if (!tab) {
      emit({ type: "$error", message: `unknown tab: ${msg.tabId}` });
      return;
    }
    if (msg.cmd === "abort") {
      tab.aborter?.abort();
      cancelPendingGates(tab);
      return;
    }
    if (msg.cmd === "tab_close") {
      void closeTab(tab);
      return;
    }
    if (msg.cmd === "mcp_specs_get") {
      emitMcpSpecs(tab);
      return;
    }
    if (msg.cmd === "mcp_specs_add") {
      const spec = msg.spec.trim();
      if (!spec) {
        emit({ type: "$error", message: "mcp_specs_add: spec is empty" }, tab.id);
        return;
      }
      try {
        parseMcpSpec(spec);
      } catch (err) {
        emit({ type: "$error", message: `mcp_specs_add: ${err.message}` }, tab.id);
        return;
      }
      try {
        const cfg = readConfig();
        const list = cfg.mcp ?? [];
        if (!list.includes(spec)) {
          cfg.mcp = [...list, spec];
          writeConfig(cfg);
        }
        emitMcpSpecs(tab);
        void bridgeTabMcp(tab);
      } catch (err) {
        emit({ type: "$error", message: `mcp_specs_add: ${err.message}` }, tab.id);
      }
      return;
    }
    if (msg.cmd === "mcp_specs_remove") {
      try {
        const cfg = readConfig();
        const list = cfg.mcp ?? [];
        if (list.includes(msg.spec)) {
          cfg.mcp = list.filter((s) => s !== msg.spec);
          writeConfig(cfg);
        }
        tab.mcpStatuses.delete(msg.spec);
        emitMcpSpecs(tab);
        void bridgeTabMcp(tab);
      } catch (err) {
        emit({ type: "$error", message: `mcp_specs_remove: ${err.message}` }, tab.id);
      }
      return;
    }
    if (msg.cmd === "skills_get") {
      emitSkills(tab);
      return;
    }
    if (msg.cmd === "skill_run") {
      if (!tab.runtime) {
        emit(
          { type: "$error", message: "Not configured yet \u2014 paste your DeepSeek API key first." },
          tab.id
        );
        return;
      }
      try {
        const store = new SkillStore({ projectRoot: tab.rootDir });
        const found = store.read(msg.name);
        if (!found) {
          emit({ type: "$error", message: `skill not found: ${msg.name}` }, tab.id);
          return;
        }
        const extra = msg.args?.trim() ?? "";
        const header = `# Skill: ${found.name}${found.description ? `
> ${found.description}` : ""}`;
        const argsLine = extra ? `

Arguments: ${extra}` : "";
        const payload = `${header}

${found.body}${argsLine}`;
        void runTurn(tab, payload);
      } catch (err) {
        emit({ type: "$error", message: `skill_run: ${err.message}` }, tab.id);
      }
      return;
    }
    if (msg.cmd === "session_list") {
      emitSessions(tab);
      return;
    }
    if (msg.cmd === "session_delete") {
      deleteSession(msg.name);
      emitSessions(tab);
      return;
    }
    if (msg.cmd === "session_load") {
      try {
        const records = loadSessionMessages(msg.name);
        const meta = loadSessionMeta(msg.name);
        tab.aborter?.abort();
        cancelPendingGates(tab);
        tab.currentSession = msg.name;
        if (tab.runtime) tab.runtime = buildRuntimeFor(tab);
        emit(
          {
            type: "$session_loaded",
            name: msg.name,
            messages: buildLoadedMessages(records),
            carryover: {
              totalCostUsd: meta.totalCostUsd ?? 0,
              cacheHitTokens: meta.cacheHitTokens ?? 0,
              cacheMissTokens: meta.cacheMissTokens ?? 0
            }
          },
          tab.id
        );
      } catch (err) {
        emit({ type: "$error", message: `session_load failed: ${err.message}` }, tab.id);
      }
      return;
    }
    if (msg.cmd === "new_chat") {
      tab.aborter?.abort();
      cancelPendingGates(tab);
      tab.currentSession = mintSessionFor(tab.rootDir);
      if (tab.runtime) tab.runtime = buildRuntimeFor(tab);
      emitSessions(tab);
      return;
    }
    if (msg.cmd === "settings_get") {
      emitSettings(tab);
      return;
    }
    if (msg.cmd === "settings_save") {
      try {
        if (msg.reasoningEffort !== void 0) {
          saveReasoningEffort(msg.reasoningEffort);
          tab.runtime?.loop.configure({ reasoningEffort: msg.reasoningEffort });
        }
        if (msg.editMode !== void 0) saveEditMode(msg.editMode);
        if (msg.budgetUsd !== void 0) {
          tab.budgetUsd = msg.budgetUsd ?? void 0;
          tab.runtime?.loop.setBudget(msg.budgetUsd);
        }
        if (msg.baseUrl !== void 0) saveBaseUrl(msg.baseUrl);
        if (msg.workspaceDir !== void 0) {
          void switchWorkspace(tab, msg.workspaceDir);
          return;
        }
        if (msg.editor !== void 0) saveEditor(msg.editor);
        if (msg.preset !== void 0) {
          tab.currentPreset = canonicalPresetName(msg.preset);
          const resolved = resolvePreset(tab.currentPreset);
          tab.currentModel = resolved.model;
          savePreset(tab.currentPreset);
          if (tab.toolset) {
            tab.system = codeSystemPrompt(tab.rootDir, {
              hasSemanticSearch: tab.toolset.semantic.enabled,
              modelId: tab.currentModel
            });
            if (tab.runtime) tab.runtime = buildRuntimeFor(tab);
          }
        }
        emitSettings(tab);
      } catch (err) {
        emit(
          { type: "$error", message: `settings_save failed: ${err.message}` },
          tab.id
        );
      }
      return;
    }
    if (msg.cmd === "mention_query") {
      const nonce = msg.nonce;
      const query = msg.query;
      const parsed = parseAtQuery(query);
      const treeWalk = parsed.trailingSlash || query.length === 0;
      if (treeWalk) {
        void listDirectory(tab.rootDir, parsed.dir).then((entries) => {
          const results = entries.map((e) => e.isDir ? `${e.path}/` : e.path);
          emit({ type: "$mention_results", nonce, query, results }, tab.id);
        }).catch((err) => {
          emit(
            { type: "$error", message: `mention_query (dir) failed: ${err.message}` },
            tab.id
          );
          emit({ type: "$mention_results", nonce, query, results: [] }, tab.id);
        });
        return;
      }
      const wantSymbols = query.length >= 2 && !query.includes("/");
      void (async () => {
        try {
          const files = await getFileIndexFor(tab);
          const fileResults = rankPickerCandidates(files, query, {
            limit: wantSymbols ? 19 : 25,
            recentlyUsed: tab.recentMentions
          });
          let symResults = [];
          if (wantSymbols) {
            const syms = await getSymbolIndexFor(tab);
            symResults = rankSymbols(syms, query, 6);
          }
          emit(
            { type: "$mention_results", nonce, query, results: [...symResults, ...fileResults] },
            tab.id
          );
        } catch (err) {
          emit(
            { type: "$error", message: `mention_query failed: ${err.message}` },
            tab.id
          );
          emit({ type: "$mention_results", nonce, query, results: [] }, tab.id);
        }
      })();
      return;
    }
    if (msg.cmd === "mention_picked") {
      pushMentionRecent(tab, msg.path);
      return;
    }
    if (msg.cmd === "mention_preview") {
      const nonce = msg.nonce;
      const rel = msg.path;
      const abs = isAbsolute(rel) ? rel : join(tab.rootDir, rel);
      const safeAbs = resolve(abs);
      const safeRoot = resolve(tab.rootDir);
      if (!safeAbs.startsWith(safeRoot)) {
        emit({ type: "$mention_preview", nonce, path: rel, head: "", totalLines: 0 }, tab.id);
        return;
      }
      void readFile(safeAbs, "utf8").then((text) => {
        const lines = text.split(/\r?\n/);
        if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
        const head = lines.slice(0, 12).join("\n");
        emit(
          { type: "$mention_preview", nonce, path: rel, head, totalLines: lines.length },
          tab.id
        );
      }).catch(() => {
        emit({ type: "$mention_preview", nonce, path: rel, head: "", totalLines: 0 }, tab.id);
      });
      return;
    }
    if (msg.cmd === "user_input") {
      if (!tab.runtime) {
        emit(
          { type: "$error", message: "Not configured yet \u2014 paste your DeepSeek API key first." },
          tab.id
        );
        return;
      }
      void runTurn(tab, msg.text);
    }
  });
  await new Promise((resolve2) => rl.on("close", resolve2));
}
export {
  desktopCommand
};
//# sourceMappingURL=desktop-Q7NDXCON.js.map