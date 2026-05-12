#!/usr/bin/env node
/**
 * Reasonix Desktop — Server Launcher (v4)
 *
 * Full session context with all agent tools: filesystem, shell, web search,
 * memory, plan, choice, and todo.  The dashboard can chat, run tools, and
 * stream events — same capability set as `reasonix code`.
 *
 * Usage: node launcher.mjs [--port <n>] [--token <hex>]
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REASONIX_DIR = resolve(__dirname, "reasonix-pkg");

// ── Parse args ─────────────────────────────────────────────────
const args = process.argv.slice(2);
let port = 0;
let tokenOverride = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && i + 1 < args.length) {
    port = parseInt(args[++i], 10);
  }
  if (args[i] === "--token" && i + 1 < args.length) {
    tokenOverride = args[++i];
  }
}

// ── Resolve reasonix dist paths ─────────────────────────────────
function distPath(name) {
  return pathToFileURL(resolve(REASONIX_DIR, "dist", "cli", name)).href;
}

// ── Data dirs ───────────────────────────────────────────────────
const home = homedir();
const reasonixDataDir = resolve(home, ".reasonix");
if (!existsSync(reasonixDataDir)) {
  mkdirSync(reasonixDataDir, { recursive: true });
}
const sessionsDir = resolve(reasonixDataDir, "sessions");
if (!existsSync(sessionsDir)) {
  mkdirSync(sessionsDir, { recursive: true });
}

// Dedicated workspace so filesystem tools have a sandbox.
const workspaceDir = resolve(home, "reasonix-workspace");
if (!existsSync(workspaceDir)) {
  mkdirSync(workspaceDir, { recursive: true });
}

const configPath = resolve(reasonixDataDir, "config.json");
const usageLogPath = resolve(reasonixDataDir, "usage.jsonl");

// ── Import server module ────────────────────────────────────────
const serverModUrl = distPath("server-2FXGNQ4F.js");
console.error(`[launcher] importing ${serverModUrl}`);
const { startDashboardServer } = await import(serverModUrl);

// ── Import core modules ─────────────────────────────────────────
console.error(`[launcher] importing core modules...`);

const [
  { DeepSeekClient },
  {
    CacheFirstLoop, ImmutablePrefix, ToolRegistry,
    registerFilesystemTools, registerMemoryTools,
    registerChoiceTool, registerPlanTool, registerTodoTool,
    registerWebTools,
  },
  {
    readConfig, loadApiKey, loadBaseUrl, loadEditMode,
    searchEnabled, webSearchEngine, webSearchEndpoint,
    loadProjectShellAllowed,
  },
  { loadDotenv },
  { registerShellTools, JobRegistry },
] = await Promise.all([
  import(distPath("chunk-KMWKGPFZ.js")),
  import(distPath("chunk-BTSIAOUG.js")),
  import(distPath("chunk-SWLIVNTP.js")),
  import(distPath("chunk-3Q3C4W66.js")),
  import(distPath("chunk-NTVW2TWO.js")),
]);

// ── Load config ─────────────────────────────────────────────────
loadDotenv();
const apiKey = loadApiKey();
const config = readConfig(configPath);
const model = config.model ?? "deepseek-v4-flash";
const baseUrl = loadBaseUrl();

console.error(`[launcher] apiKey ${apiKey ? "found" : "NOT FOUND — chat will be disabled"}, model=${model}`);
console.error(`[launcher] workspace: ${workspaceDir}`);

// ── Create registry & register all tools ────────────────────────
const tools = new ToolRegistry();
const jobs = new JobRegistry();

// Filesystem tools — sandboxed to workspaceDir
registerFilesystemTools(tools, {
  rootDir: workspaceDir,
  allowWriting: true,
});

// Shell tools — allowlist-based, confirmation gated by edit mode
registerShellTools(tools, {
  rootDir: workspaceDir,
  extraAllowed: () => loadProjectShellAllowed(workspaceDir, configPath),
  allowAll: () => loadEditMode(configPath) === "yolo",
  jobs,
});

// Web tools — search + fetch
if (searchEnabled(configPath)) {
  registerWebTools(tools, {
    webSearchEngine: webSearchEngine(configPath),
    webSearchEndpoint: webSearchEndpoint(configPath),
  });
  console.error(`[launcher] web tools registered`);
}

// Memory tools
registerMemoryTools(tools, { projectRoot: workspaceDir });

// Utility tools
registerPlanTool(tools);
registerChoiceTool(tools);
registerTodoTool(tools);

console.error(`[launcher] ${tools.size} tools registered`);

// ── Build session ───────────────────────────────────────────────
let loop = null;

if (apiKey) {
  try {
    const client = new DeepSeekClient({ apiKey, baseUrl });

    const prefix = new ImmutablePrefix({
      system: `You are Reasonix, a helpful DeepSeek-powered AI assistant. Be concise and accurate.

You have access to the following tools:
- Filesystem tools: read_file, write_file, list_directory, search_files — sandboxed to ${workspaceDir}
- Shell tools: run_command — execute commands in ${workspaceDir}
- Web tools: web_search, web_fetch — search the web and fetch pages
- Memory tools: save and recall project/global memory
- Plan tools: create and manage plans
- Choice tools: ask the user to make choices
- Todo tools: track tasks

Always use the appropriate tool when you need to access files, run commands, or search the web.
Respond in the same language as the user's message.`,
      toolSpecs: tools.specs(),
    });

    loop = new CacheFirstLoop({
      client,
      prefix,
      tools,
      model,
      reasoningEffort: config.reasoningEffort ?? "max",
      autoEscalate: config.autoEscalate !== false,
    });

    console.error(`[launcher] CacheFirstLoop created (model=${model})`);
  } catch (err) {
    console.error(`[launcher] failed to create loop: ${err.message}`);
  }
}

// ── Event subscribers ───────────────────────────────────────────
const eventSubscribers = new Set();

function broadcastDashboardEvent(ev) {
  if (!ev || eventSubscribers.size === 0) return;
  for (const handler of eventSubscribers) {
    try { handler(ev); } catch { /* swallow */ }
  }
}

// Mirrors loopEventToDashboard() from chunk-VM6A6QLY.js
function loopEventToDashboard(ev, assistantId) {
  const id = `${assistantId}-${ev.role}-${Date.now()}`;
  switch (ev.role) {
    case "assistant_delta":
      return {
        kind: "assistant_delta",
        id: assistantId,
        contentDelta: ev.content || undefined,
        reasoningDelta: ev.reasoningDelta,
      };
    case "tool_start":
      if (!ev.toolName) return null;
      return { kind: "tool_start", id, toolName: ev.toolName, args: ev.toolArgs };
    case "tool":
      if (!ev.toolName) return null;
      return {
        kind: "tool",
        id,
        toolName: ev.toolName,
        content: ev.content,
        args: ev.toolArgs,
      };
    case "warning":
      return { kind: "warning", id, text: ev.content };
    case "error":
      return { kind: "error", id, text: ev.content || ev.error || "unknown error" };
    case "status":
      return { kind: "status", text: ev.content };
    default:
      return null;
  }
}

// ── Busy state ──────────────────────────────────────────────────
let busy = false;

// ── Messages store ──────────────────────────────────────────────
let nextMsgId = 1;
const messages = [];

// ── Dashboard context ───────────────────────────────────────────
const ctx = {
  mode: "desktop",
  configPath,
  usageLogPath,
  sessionsDir,
  loop,
  tools,
  mcpServers: [],

  // ── Getters ────────────────────────────────────────────────
  getCurrentCwd: () => workspaceDir,
  getEditMode: () => loadEditMode(configPath),
  getPlanMode: () => false,
  getPendingEditCount: () => 0,
  getLatestVersion: () => null,
  getSessionName: () => "desktop",
  getModels: () => null,
  getLoopRunStatus: () => null,
  getActiveModal: () => null,

  // ── Setters / actions ──────────────────────────────────────
  setEditMode: (m) => { console.error(`[launcher] edit mode: ${m}`); },
  setPlanMode: () => {},
  applyPresetLive: (name) => { console.error(`[launcher] preset: ${name}`); },
  applyEffortLive: (effort) => { loop?.configure({ reasoningEffort: effort }); },
  applyModelLive: (m) => { loop?.configure({ model: m }); },
  setProNextLive: () => {},
  setBudgetUsdLive: (usd) => { loop?.setBudget(usd); },

  startAutoLoop: () => {},
  stopAutoLoop: () => {},

  // ── Chat bridge ────────────────────────────────────────────
  getMessages: () => messages,

  subscribeEvents: (handler) => {
    eventSubscribers.add(handler);
    return () => {
      eventSubscribers.delete(handler);
    };
  },

  submitPrompt: (text) => {
    if (!loop) {
      return {
        accepted: false,
        reason: "API key not configured. Open Settings tab to add your DeepSeek API key, then restart the app."
      };
    }
    if (busy) {
      return { accepted: false, reason: "loop is busy with a turn" };
    }

    busy = true;
    broadcastDashboardEvent({ kind: "busy-change", busy: true });

    const userMsgId = String(nextMsgId++);
    messages.push({ id: userMsgId, role: "user", text });

    const assistantId = `assistant-${Date.now()}`;

    // Fire-and-forget: process the turn asynchronously
    (async () => {
      let assistantText = "";
      try {
        for await (const ev of loop.step(text)) {
          const dashev = loopEventToDashboard(ev, assistantId);
          broadcastDashboardEvent(dashev);

          if (ev.role === "assistant_delta") {
            assistantText += ev.content ?? "";
          }
          if (ev.role === "assistant_final") {
            messages.push({
              id: assistantId,
              role: "assistant",
              text: ev.content || assistantText,
            });
          }
        }
      } catch (err) {
        broadcastDashboardEvent({
          kind: "error",
          id: `${assistantId}-error-${Date.now()}`,
          text: err.message,
        });
      } finally {
        busy = false;
        broadcastDashboardEvent({ kind: "busy-change", busy: false });
      }
    })();

    return { accepted: true };
  },

  abortTurn: () => {
    if (busy) {
      loop?.abort();
    }
  },

  isBusy: () => busy,

  getStats: () => {
    if (!loop) return null;
    const s = loop.stats.summary();
    return {
      turns: s.turns,
      totalCostUsd: s.totalCostUsd,
      lastTurnCostUsd: s.lastTurnCostUsd,
      totalInputCostUsd: s.totalInputCostUsd,
      totalOutputCostUsd: s.totalOutputCostUsd,
      cacheHitRatio: s.cacheHitRatio,
      lastPromptTokens: s.lastPromptTokens,
      contextCapTokens: 65536,
      balance: null,
    };
  },
};

// ── Start the server ────────────────────────────────────────────
const token = tokenOverride ?? randomBytes(32).toString("hex");

console.error(`[launcher] starting dashboard server on port ${port}...`);

try {
  const { url, token: actualToken, port: actualPort, close } = await startDashboardServer(ctx, {
    port,
    host: "127.0.0.1",
    token,
  });

  console.error(`[launcher] dashboard ready: ${url}`);

  // Write URL as JSON to stdout so the Rust sidecar can parse it
  const msg = JSON.stringify({ url, token: actualToken, port: actualPort });
  process.stdout.write(msg + "\n");

  // ── Keep running until terminated ──────────────────────────
  const cleanup = () => {
    console.error("[launcher] shutting down...");
    close().then(() => process.exit(0));
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
  process.stdin.resume();

} catch (err) {
  console.error(`[launcher] FATAL: ${err.message}`);
  const errMsg = JSON.stringify({ error: err.message });
  process.stdout.write(errMsg + "\n");
  process.exit(1);
}
