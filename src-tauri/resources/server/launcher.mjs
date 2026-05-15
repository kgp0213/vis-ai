#!/usr/bin/env node
/**
 * Visionox Desktop — Server Launcher (v4)
 *
 * Full session context with all agent tools: filesystem, shell, web search,
 * memory, plan, choice, and todo.  The dashboard can chat, run tools, and
 * stream events — same capability set as the upstream agent.
 *
 * Usage: node launcher.mjs [--port <n>] [--token <hex>]
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VISIONOX_DIR = resolve(__dirname, "visionox-pkg");

// ── Log buffer for developer mode ─────────────────────────────────
const LOG_MAX = 500;
const logBuffer = [];
const _origError = console.error;
const _origLog = console.log;
console.error = (...args) => {
  const msg = args.join(" ");
  logBuffer.push({ ts: Date.now(), msg });
  if (logBuffer.length > LOG_MAX) logBuffer.shift();
  _origError.apply(console, args);
};
console.log = (...args) => {
  const msg = args.join(" ");
  logBuffer.push({ ts: Date.now(), msg });
  if (logBuffer.length > LOG_MAX) logBuffer.shift();
  _origLog.apply(console, args);
};

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

// ── Resolve visionox dist paths ──────────────────────────────────
function distPath(name) {
  return pathToFileURL(resolve(VISIONOX_DIR, "dist", "cli", name)).href;
}

// ── Data dirs ───────────────────────────────────────────────────
const home = homedir();
const visionoxDataDir = resolve(home, ".visionox");
if (!existsSync(visionoxDataDir)) {
  mkdirSync(visionoxDataDir, { recursive: true });
}
const sessionsDir = resolve(visionoxDataDir, "sessions");
if (!existsSync(sessionsDir)) {
  mkdirSync(sessionsDir, { recursive: true });
}

const configPath = resolve(visionoxDataDir, "config.json");
const usageLogPath = resolve(visionoxDataDir, "usage.jsonl");

// ── Import server module ────────────────────────────────────────
const serverModUrl = distPath("server-DRFPXXSH.js");
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
    bridgeMcpTools,
  },
  {
    readConfig, writeConfig, loadApiKey, loadBaseUrl, loadEditMode,
    searchEnabled, webSearchEngine, webSearchEndpoint,
    loadProjectShellAllowed,
    mcpEnvFor,
    loadSemanticEmbeddingUserConfig,
  },
  { loadDotenv },
  { registerShellTools, JobRegistry },
  { McpClient, parseMcpSpec, inspectMcpServer },
  { buildTransportFromSpec },
  { registerSemanticSearchTool },
  { applySkillsIndex },
  { registerSkillTools },
] = await Promise.all([
  import(distPath("chunk-H4OLWRSX.js")),
  import(distPath("chunk-IEA6JOIP.js")),
  import(distPath("chunk-65Q5HQ26.js")),
  import(distPath("chunk-3Q3C4W66.js")),
  import(distPath("chunk-BYZGO3BX.js")),
  import(distPath("chunk-CFY2XLY6.js")),
  import(distPath("chunk-7G3SESEU.js")),
  import(distPath("chunk-RAUPWSYA.js")),
  import(distPath("chunk-6DR4F3MC.js")),
  import(distPath("chunk-A7VHMMDE.js")),
]);

// ── Load config ─────────────────────────────────────────────────
loadDotenv();
const apiKey = loadApiKey();
const config = readConfig(configPath);
const model = config.model ?? "deepseek-v4-flash";
const baseUrl = loadBaseUrl();

// Workspace directory — configurable via config.workspaceDir
const workspaceDir = resolve(home, config.workspaceDir ?? "visionox-workspace");
if (!existsSync(workspaceDir)) {
  mkdirSync(workspaceDir, { recursive: true });
}

// Deploy skill-creation-guide.md to workspace for agent reference
const guideSrc = resolve(__dirname, "..", "skill-creation-guide.md");
const guideDir = resolve(workspaceDir, ".visionox");
const guideDst = resolve(guideDir, "skill-creation-guide.md");
if (existsSync(guideSrc) && !existsSync(guideDst)) {
  if (!existsSync(guideDir)) mkdirSync(guideDir, { recursive: true });
  copyFileSync(guideSrc, guideDst);
  console.error(`[launcher] skill-creation-guide.md deployed to workspace`);
}

console.error(`[launcher] apiKey ${apiKey ? "found" : "NOT FOUND — chat will be disabled"}, model=${model}`);
console.error(`[launcher] workspace: ${workspaceDir}`);

// ── Create registry & register all tools ────────────────────────
const tools = new ToolRegistry();
const jobs = new JobRegistry();

// Filesystem tools — sandboxed to workspaceDir
registerFilesystemTools(tools, {
  rootDir: workspaceDir,
  allowWriting: true,
  allowAllPaths: () => loadEditMode(configPath) === "admin",
});

// Shell tools — gated by edit mode (yolo=auto-approve, auto=semi-auto, review=confirm)
// Default to auto on first run
if (!config.editMode) {
  config.editMode = "auto";
  writeConfig(config, configPath);
}
registerShellTools(tools, {
  rootDir: workspaceDir,
  extraAllowed: () => loadProjectShellAllowed(workspaceDir, configPath),
  allowAll: () => loadEditMode(configPath) === "yolo" || loadEditMode(configPath) === "admin",
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

// ── install_skill tool ────────────────────────────────────────────
const skillsRoot = resolve(homedir(), ".visionox", "skills");

tools.register({
  name: "install_skill",
  description: `安装或导入一个 Skill。支持两种方式:
1. 提供 name + body — 直接写入 SKILL.md 到 ~/.visionox/skills/<name>/
2. 提供 name + source — 从 .skill 文件（ZIP 格式）解压安装
Skill 安装后在新对话中自动加载。`,
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Skill 名称，仅限英文小写+连字符，如 'my-skill'。禁止空格、中文、大写字母。",
      },
      body: {
        type: "string",
        description: "SKILL.md 的完整内容（含 YAML frontmatter）。与 source 二选一。",
      },
      source: {
        type: "string",
        description: ".skill 文件的本地路径（ZIP 格式）。与 body 二选一。",
      },
    },
    required: ["name"],
  },
  fn: async (args) => {
    const name = String(args.name ?? "").trim();
    if (!name || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name)) {
      return JSON.stringify({
        error: `invalid name: "${name}". Use lowercase + hyphens only, e.g. "my-skill". No spaces, no Chinese, no uppercase.`,
      });
    }
    const skillDir = resolve(skillsRoot, name);
    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true });
    }

    if (args.body) {
      const body = String(args.body);
      if (!body.includes("---") || body.indexOf("---") === body.lastIndexOf("---")) {
        return JSON.stringify({
          error: "SKILL.md must have YAML frontmatter (start and end with ---). See skill-creation-guide.md for the format.",
        });
      }
      writeFileSync(resolve(skillDir, "SKILL.md"), body, "utf8");
      return JSON.stringify({
        installed: true,
        name,
        path: skillDir,
        hint: "新对话中即可使用此 skill。",
      });
    }

    if (args.source) {
      const src = String(args.source);
      if (!existsSync(src)) {
        return JSON.stringify({ error: `source file not found: ${src}` });
      }
      if (!src.endsWith(".skill") && !src.endsWith(".zip")) {
        return JSON.stringify({ error: `source must be a .skill or .zip file, got: ${src}` });
      }
      try {
        const zipPath = src.endsWith(".skill") ? src.replace(/\.skill$/, ".zip") : src;
        if (src.endsWith(".skill")) {
          copyFileSync(src, zipPath);
        }
        if (process.platform === "win32") {
          execSync(
            `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${skillDir}' -Force"`,
            { stdio: "pipe" }
          );
        } else {
          execSync(`unzip -o "${zipPath}" -d "${skillDir}"`, { stdio: "pipe" });
        }
        if (src.endsWith(".skill")) {
          try { require("fs").unlinkSync(zipPath); } catch {}
        }
        return JSON.stringify({
          installed: true,
          name,
          path: skillDir,
          hint: "新对话中即可使用此 skill。",
        });
      } catch (err) {
        return JSON.stringify({ error: `extract failed: ${err.message}` });
      }
    }

    return JSON.stringify({
      error: "provide either body (SKILL.md content) or source (.skill file path).",
    });
  },
});

console.error(`[launcher] install_skill tool registered — skills root: ${skillsRoot}`);

// ── Semantic search ──────────────────────────────────────────────
let hasSemanticSearch = false;
try {
  const semanticCfg = loadSemanticEmbeddingUserConfig(configPath);
  const provider = semanticCfg.provider === "openai-compat" ? "openai-compat" : "ollama";
  const cfgKey = provider === "openai-compat" ? "openaiCompat" : "ollama";
  const providerCfg = semanticCfg[cfgKey];
  const registered = await registerSemanticSearchTool(tools, {
    root: workspaceDir,
    provider,
    model: providerCfg?.model,
    baseUrl: providerCfg?.baseUrl,
    apiKey: providerCfg?.apiKey,
    extraBody: providerCfg?.extraBody,
  });
  if (registered) {
    hasSemanticSearch = true;
    console.error(`[launcher] semantic_search tool registered`);
  }
} catch (err) {
  console.error(`[launcher] semantic_search skipped: ${err.message}`);
}

// ── Skill tools ──────────────────────────────────────────────────
registerSkillTools(tools, { homeDir: home, projectRoot: workspaceDir });
console.error(`[launcher] skill tools registered (run_skill), ${tools.size} total tools`);

// ── MCP servers ──────────────────────────────────────────────────
const mcpSpecs = config.mcp ?? [];
const mcpServers = [];

for (const rawSpec of mcpSpecs) {
  try {
    const spec = parseMcpSpec(rawSpec.trim());
    if (!spec) continue;
    const transport = buildTransportFromSpec(spec, { env: mcpEnvFor(spec.name, config) });
    const client = new McpClient({ transport });
    await client.initialize();
    const report = await inspectMcpServer(client);
    const { registeredNames } = bridgeMcpTools(client, { registry: tools });
    mcpServers.push({
      label: spec.name,
      spec: rawSpec.trim(),
      toolCount: registeredNames.length,
      toolNames: registeredNames,
      report,
      host: { client },
      readResource: (uri) => client.readResource(uri),
      getPrompt: (name, args) => client.getPrompt(name, args),
    });
    console.error(`[launcher] MCP "${spec.name}": ${registeredNames.length} tools bridged`);
  } catch (err) {
    console.error(`[launcher] MCP "${rawSpec}" failed: ${err.message}`);
  }
}

if (mcpServers.length > 0) {
  console.error(`[launcher] ${mcpServers.length} MCP server(s) connected, ${tools.size} total tools`);
}

async function reloadMcp() {
  const cfg = readConfig(configPath);
  const specs = cfg.mcp ?? [];
  // Remove servers no longer in config
  for (let i = mcpServers.length - 1; i >= 0; i--) {
    if (!specs.includes(mcpServers[i].spec)) {
      const srv = mcpServers[i];
      for (const name of srv.toolNames) {
        tools.unregister(name);
        loop?.prefix?.removeTool(name);
      }
      srv.host?.client?.close?.();
      mcpServers.splice(i, 1);
      console.error(`[launcher] MCP removed: "${srv.spec}"`);
    }
  }
  // Add new servers from config
  for (const rawSpec of specs) {
    if (mcpServers.some((s) => s.spec === rawSpec)) continue;
    try {
      const spec = parseMcpSpec(rawSpec.trim());
      if (!spec) continue;
      const transport = buildTransportFromSpec(spec, { env: mcpEnvFor(spec.name, cfg) });
      const client = new McpClient({ transport });
      await client.initialize();
      const report = await inspectMcpServer(client);
      const { registeredNames } = bridgeMcpTools(client, { registry: tools });
      // Add new tool specs to loop prefix
      for (const ts of tools.specs().filter((s) => registeredNames.includes(s.function?.name))) {
        loop?.prefix?.addTool(ts);
      }
      mcpServers.push({
        label: spec.name,
        spec: rawSpec.trim(),
        toolCount: registeredNames.length,
        toolNames: registeredNames,
        report,
        host: { client },
        readResource: (uri) => client.readResource(uri),
        getPrompt: (name, args) => client.getPrompt(name, args),
      });
      console.error(`[launcher] MCP "${spec.name}": ${registeredNames.length} tools bridged`);
    } catch (err) {
      console.error(`[launcher] MCP "${rawSpec}" failed: ${err.message}`);
    }
  }
  return mcpServers.length;
}

function invokeMcpTool(serverName, toolName, args) {
  const srv = mcpServers.find((s) => s.label === serverName);
  if (!srv) throw new Error(`MCP server "${serverName}" not found`);
  return srv.host.client.callTool(toolName, args);
}

// ── Build session ───────────────────────────────────────────────
const SEMANTIC_ROUTING = hasSemanticSearch ? `

# Search routing

You have BOTH \`semantic_search\` (vector index) and \`search_content\` (literal grep).

- **Descriptive queries** ("where do we handle X", "which file owns Y", "how does Z work") → call \`semantic_search\` FIRST.
- **Exact-token queries** (specific identifier, regex, "find every call to foo") → call \`search_content\`.

If \`semantic_search\` returns nothing useful, fall back to \`search_content\`.` : "";

const SYSTEM_PROMPT = `You are Visionox, a helpful DeepSeek-powered AI assistant. Be concise and accurate.

You have access to the following tools:
- Filesystem tools: read_file, write_file, list_directory, search_files — sandboxed to ${workspaceDir}
- Shell tools: run_command — execute commands in ${workspaceDir}
- Web tools: web_search, web_fetch — search the web and fetch pages
- Memory tools: save and recall project/global memory
- Plan tools: create and manage plans
- Choice tools: ask the user to make choices
- Todo tools: track tasks

Always use the appropriate tool when you need to access files, run commands, or search the web.
Respond in the same language as the user's message.${SEMANTIC_ROUTING}`;

// Inject skills index so the model knows which /skills are available
const SYSTEM_PROMPT_WITH_SKILLS = applySkillsIndex(SYSTEM_PROMPT, { projectRoot: workspaceDir });

let loop = null;

if (apiKey) {
  try {
    const client = new DeepSeekClient({ apiKey, baseUrl });

    const prefix = new ImmutablePrefix({
      system: SYSTEM_PROMPT_WITH_SKILLS,
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
  mcpServers,

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
  hasApiKey: !!apiKey,
  getLogs: () => logBuffer.slice(),

  // ── Setters / actions ──────────────────────────────────────
  setEditMode: (m) => {
    const cfg = readConfig(configPath);
    cfg.editMode = m;
    writeConfig(cfg, configPath);
    console.error(`[launcher] edit mode: ${m}`);
  },
  setPlanMode: () => {},
  applyPresetLive: (name) => { console.error(`[launcher] preset: ${name}`); },
  applyEffortLive: (effort) => { loop?.configure({ reasoningEffort: effort }); },
  applyModelLive: (m) => { loop?.configure({ model: m }); },
  setProNextLive: () => {},
  setBudgetUsdLive: (usd) => { loop?.setBudget(usd); },

  reloadMcp,
  invokeMcpTool,

  setWorkspaceDir: (dir) => {
    const cfg = readConfig(configPath);
    cfg.workspaceDir = dir;
    writeConfig(cfg, configPath);
    console.error(`[launcher] workspaceDir saved: ${dir} (restart required)`);
  },

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
    // Handle /new and /clear: save session and reset
    if (text === "/new" || text === "/clear") {
      if (messages.length > 0) {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const sessionFile = resolve(sessionsDir, `${ts}.jsonl`);
        try {
          const jsonl = messages.map((m) => JSON.stringify({ role: m.role, content: m.text })).join("\n") + "\n";
          writeFileSync(sessionFile, jsonl, "utf8");
          console.error(`[launcher] session saved: ${sessionFile}`);
        } catch (err) {
          console.error(`[launcher] failed to save session: ${err.message}`);
        }
      }
      // Reset the AI's internal context (CacheFirstLoop log)
      if (loop) loop.clearLog();
      // Clear dashboard messages
      messages.length = 0;
      nextMsgId = 1;
      // Add welcome message
      const welcomeId = `assistant-${Date.now()}`;
      const welcomeMsg = { id: welcomeId, role: "assistant", text: "我是 Visionox，你的 AI 编程助手。我可以帮你浏览代码、编辑文件、执行命令、搜索网络。直接告诉我要做什么吧。\n\n需要创建或导入 skill 时使用 install_skill 工具；编写规范参考 .visionox/skill-creation-guide.md" };
      messages.push(welcomeMsg);
      // Notify client
      busy = true;
      broadcastDashboardEvent({ kind: "busy-change", busy: true });
      broadcastDashboardEvent({ kind: "assistant_final", id: welcomeId, text: welcomeMsg.text });
      busy = false;
      broadcastDashboardEvent({ kind: "busy-change", busy: false });
      return { accepted: true };
    }

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
    broadcastDashboardEvent({ kind: "user", id: userMsgId, text });

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

// ── Initial welcome message ──────────────────────────────────────
messages.push({
  id: "welcome",
  role: "assistant",
  text: "我是 Visionox，你的 AI 编程助手。我可以帮你浏览代码、编辑文件、执行命令、搜索网络。直接告诉我要做什么吧。\n\n需要创建或导入 skill 时使用 install_skill 工具；编写规范参考 .visionox/skill-creation-guide.md",
});

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
