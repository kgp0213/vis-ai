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
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { exec as execCb, spawnSync } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCb);

// ── Login-shell PATH augmentation (#1252) ───────────────────────────
// GUI apps on macOS/Linux don't source .zshrc/.bashrc, so nvm/asdf/fnm
// injected PATH entries are missing.  Probe the user's interactive shell
// once and prepend any missing directories to process.env.PATH.
// On Windows the registry PATH is inherited correctly; this is a no-op.
let _loginPathCached;

function resolveLoginShellPath() {
  if (_loginPathCached !== undefined) return _loginPathCached;
  _loginPathCached = null;
  if (process.platform === "win32") return null;

  const shell = process.env.SHELL || "/bin/bash";
  const marker = "__VNX_PATH__=";
  try {
    const result = spawnSync(shell, ["-ilc", `printf '${marker}%s\\n' "$PATH"`], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status !== 0 && result.signal === null) return null;
    const stdout = result.stdout ?? "";
    const idx = stdout.lastIndexOf(marker);
    if (idx < 0) return null;
    const tail = stdout.slice(idx + marker.length);
    const nl = tail.indexOf("\n");
    const path = (nl >= 0 ? tail.slice(0, nl) : tail).trim();
    if (!path || !path.includes("/")) return null;
    _loginPathCached = path;
    return path;
  } catch {
    return null;
  }
}

function augmentProcessPath() {
  const loginPath = resolveLoginShellPath();
  if (!loginPath) return { added: [] };
  const current = process.env.PATH ?? "";
  const seen = new Set(current.split(":").map((s) => s.trim()).filter(Boolean));
  const additions = [];
  for (const entry of loginPath.split(":")) {
    const t = entry.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    additions.push(t);
  }
  if (additions.length > 0) {
    process.env.PATH = additions.concat(current ? [current] : []).join(":");
    console.error(`[launcher] augmented PATH with ${additions.length} login-shell entries`);
  }
  return { added: additions };
}

// Probe once at import time — must run before any child_process spawn.
augmentProcessPath();

const __dirname = dirname(fileURLToPath(import.meta.url));
const VISIONOX_DIR = resolve(__dirname, "visionox-pkg");

// ── Log buffer for developer mode ─────────────────────────────────
const LOG_MAX = 500;
const logBuffer = [];
const _origError = console.error;
const _origLog = console.log;
const _origWarn = console.warn;
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
console.warn = (...args) => {
  const msg = args.join(" ");
  logBuffer.push({ ts: Date.now(), msg });
  if (logBuffer.length > LOG_MAX) logBuffer.shift();
  _origWarn.apply(console, args);
};

// ── Parse args ─────────────────────────────────────────────────
const args = process.argv.slice(2);
let port = 0;
let tokenOverride = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && i + 1 < args.length) {
    port = parseInt(args[++i], 10);
  } else if (args[i].startsWith("--port=")) {
    port = parseInt(args[i].split("=")[1], 10);
  }
  if (args[i] === "--token" && i + 1 < args.length) {
    tokenOverride = args[++i];
  } else if (args[i].startsWith("--token=")) {
    tokenOverride = args[i].split("=").slice(1).join("=");
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
const serverModUrl = distPath("server-XGDBRWMB.js");
console.error(`[launcher] importing ${serverModUrl}`);
const { startDashboardServer } = await import(serverModUrl);

// ── Import core modules ─────────────────────────────────────────
console.error(`[launcher] importing core modules...`);

const [
  { DeepSeekClient, pickPrimaryBalance },
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
  { registerSkillTools, Eventizer },
  { openEventSink, eventLogPath },
  { getLatestVersion, VERSION },
] = await Promise.all([
  import(distPath("chunk-2KDUS647.js")),
  import(distPath("chunk-2R4QCDOZ.js")),
  import(distPath("chunk-XPDVG52A.js")),
  import(distPath("chunk-2UQP6H6T.js")),
  import(distPath("chunk-O52OLQL3.js")),
  import(distPath("chunk-6AK4EY3D.js")),
  import(distPath("chunk-PQXPXJBJ.js")),
  import(distPath("chunk-YYQAUTTN.js")),
  import(distPath("chunk-2K65GZBT.js")),
  import(distPath("chunk-45U62RI3.js")),
  import(distPath("chunk-4QUNBQQ2.js")),
  import(distPath("chunk-XXC2BYTV.js")),
]);

// ── Load config ─────────────────────────────────────────────────
loadDotenv();
let apiKey = loadApiKey();
const config = readConfig(configPath);
const model = config.model ?? "deepseek-v4-flash";
let baseUrl = loadBaseUrl();

// ── Balance ──────────────────────────────────────────────────────
let balanceData = null;

function isDeepSeekApi(url) {
  if (!url) return false;
  try {
    const host = new URL(url).host;
    return host === "api.deepseek.com" || host.endsWith(".deepseek.com");
  } catch {
    return url.includes("deepseek.com");
  }
}

async function refreshBalance() {
  if (!client || !apiKey || !isDeepSeekApi(baseUrl)) {
    balanceData = null;
    return;
  }
  try {
    const data = await client.getBalance({ signal: AbortSignal.timeout(5000) });
    balanceData = data;
  } catch {
    balanceData = null;
  }
}

// Workspace directory — configurable via config.workspaceDir
let workspaceDir = resolve(home, config.workspaceDir ?? "visionox-workspace");
if (!existsSync(workspaceDir)) {
  mkdirSync(workspaceDir, { recursive: true });
}

function deploySkillGuide(rootDir) {
  const guideSrc = resolve(__dirname, "..", "skill-creation-guide.md");
  const guideDir = resolve(rootDir, ".visionox");
  const guideDst = resolve(guideDir, "skill-creation-guide.md");
  if (existsSync(guideSrc) && !existsSync(guideDst)) {
    if (!existsSync(guideDir)) mkdirSync(guideDir, { recursive: true });
    copyFileSync(guideSrc, guideDst);
    console.error(`[launcher] skill-creation-guide.md deployed to workspace`);
  }
}
deploySkillGuide(workspaceDir);

console.error(`[launcher] apiKey ${apiKey ? "found" : "NOT FOUND — chat will be disabled"}, model=${model}`);
console.error(`[launcher] workspace: ${workspaceDir}`);

// Workspace-dependent tool names — for unregister/re-register on workspace switch
const WORKSPACE_TOOL_NAMES_BASE = [
  "read_file", "list_directory", "search_files", "get_file_info",
  "write_file", "create_directory", "move_file", "delete_file",
  "delete_directory", "copy_file",
  "run_command", "run_background", "job_output", "wait_for_job",
  "stop_job", "list_jobs",
  "remember", "forget", "recall_memory",
  "semantic_search",
  "run_skill",
];
let wsToolNames = [...WORKSPACE_TOOL_NAMES_BASE];
let hasSemanticSearch = false;

async function registerWorkspaceTools(tools, rootDir, opts = {}) {
  const { jobs } = opts;

  registerFilesystemTools(tools, {
    rootDir,
    allowWriting: true,
    allowAllPaths: () => loadEditMode(configPath) === "admin",
  });

  registerShellTools(tools, {
    rootDir,
    extraAllowed: () => loadProjectShellAllowed(rootDir, configPath),
    allowAll: () => loadEditMode(configPath) === "yolo" || loadEditMode(configPath) === "admin",
    jobs,
  });

  registerMemoryTools(tools, { projectRoot: rootDir });

  let hasSemantic = false;
  try {
    const semanticCfg = loadSemanticEmbeddingUserConfig(configPath);
    const provider = semanticCfg.provider === "openai-compat" ? "openai-compat" : "ollama";
    const cfgKey = provider === "openai-compat" ? "openaiCompat" : "ollama";
    const providerCfg = semanticCfg[cfgKey];
    const registered = await registerSemanticSearchTool(tools, {
      root: rootDir,
      provider,
      model: providerCfg?.model,
      baseUrl: providerCfg?.baseUrl,
      apiKey: providerCfg?.apiKey,
      extraBody: providerCfg?.extraBody,
    });
    if (registered) {
      hasSemantic = true;
      console.error(`[launcher] semantic_search tool registered`);
    }
  } catch (err) {
    console.error(`[launcher] semantic_search skipped: ${err.message}`);
  }

  registerSkillTools(tools, { homeDir: home, projectRoot: rootDir });
  console.error(`[launcher] skill tools registered (run_skill), ${tools.size} total tools`);
  // install_skill is re-registered unconditionally below — skip here
  // to avoid "tool already exists" errors on re-registration

  return { hasSemantic };
}

// ── Create registry & register all tools ────────────────────────
const tools = new ToolRegistry();
const jobs = new JobRegistry();

// Workspace-dependent tools — registered via shared function
const wsResult = await registerWorkspaceTools(tools, workspaceDir, { jobs });
hasSemanticSearch = wsResult.hasSemantic;
if (!hasSemanticSearch) {
  wsToolNames = wsToolNames.filter((n) => n !== "semantic_search");
}

// Shell edit mode — default to auto on first run
if (!config.editMode) {
  config.editMode = "auto";
  writeConfig(config, configPath);
}

// Web tools — search + fetch (not workspace-dependent)
if (searchEnabled(configPath)) {
  registerWebTools(tools, {});
  console.error(`[launcher] web tools registered`);
}

// Utility tools (not workspace-dependent)
registerPlanTool(tools);
registerChoiceTool(tools);
registerTodoTool(tools);

console.error(`[launcher] ${tools.size} tools registered`);

// ── install_skill tool ────────────────────────────────────────────
const skillsRoot = resolve(homedir(), ".visionox", "skills");

tools.register({
  name: "install_skill",
  description: `安装或导入一个 Skill。支持三种方式:
1. name + body — 仅写入 SKILL.md，不含辅助文件。适合快速创建简单 skill。
2. name + source — 从 .skill 文件（ZIP 格式）解压安装。适合分发打包好的 skill。
3. name + source_dir — 从本地目录递归复制所有文件（含 scripts/、references/、templates/、README.md 等）。适合开发中的完整 skill 目录。
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
        description: "SKILL.md 的完整内容（含 YAML frontmatter）。与 source、source_dir 三选一。",
      },
      source: {
        type: "string",
        description: ".skill 文件的本地路径（ZIP 格式）。与 body、source_dir 三选一。",
      },
      source_dir: {
        type: "string",
        description: "本地目录路径，递归复制所有文件到 ~/.visionox/skills/<name>/。目录必须包含 SKILL.md。与 body、source 三选一。",
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

    // P2-3: rate limit — max 10 installs per minute
    const now = Date.now();
    while (skillInstallTimes.length > 0 && now - skillInstallTimes[0] > SKILL_RATE_WINDOW) {
      skillInstallTimes.shift();
    }
    if (skillInstallTimes.length >= SKILL_RATE_LIMIT) {
      return JSON.stringify({
        error: `rate limit: max ${SKILL_RATE_LIMIT} installs per minute. Please wait and retry.`,
      });
    }

    // P2-3: concurrency guard
    if (installingSkill) {
      return JSON.stringify({
        error: "another skill installation is in progress, please wait",
      });
    }

    // P2-3: body size cap
    if (args.body && typeof args.body === 'string' && args.body.length > MAX_BODY_SIZE) {
      return JSON.stringify({
        error: `body too large: ${args.body.length} bytes (max ${MAX_BODY_SIZE})`,
      });
    }

    skillInstallTimes.push(now);
    installingSkill = true;
    try {
    const skillDir = resolve(skillsRoot, name);
    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true });
    }

    if (args.body) {
      const body = String(args.body);
      const trimmed = body.trimStart();
      const delimCount = (trimmed.match(/^---\s*$/gm) || []).length;
      if (!trimmed.startsWith('---') || delimCount < 2) {
        return JSON.stringify({
          error: "SKILL.md must have YAML frontmatter starting with --- on the first line and ending with --- on its own line. See skill-creation-guide.md for the format.",
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
      // P2-3: size check before extraction
      const srcStat = statSync(src);
      if (srcStat.size > MAX_ZIP_SIZE) {
        return JSON.stringify({
          error: `source file too large: ${srcStat.size} bytes (max ${MAX_ZIP_SIZE})`,
        });
      }
      try {
        const zipPath = src.endsWith(".skill") ? src.replace(/\.skill$/, ".zip") : src;
        if (src.endsWith(".skill")) {
          copyFileSync(src, zipPath);
        }
        if (process.platform === "win32") {
          await exec(
            `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${skillDir}' -Force"`,
            { maxBuffer: 10 * 1024 * 1024 }
          );
        } else {
          await exec(`unzip -o "${zipPath}" -d "${skillDir}"`, { maxBuffer: 10 * 1024 * 1024 });
        }
        if (src.endsWith(".skill")) {
          try { unlinkSync(zipPath); } catch {}
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

    if (args.source_dir) {
      const srcDir = String(args.source_dir);
      if (!existsSync(srcDir)) {
        return JSON.stringify({ error: `source_dir not found: ${srcDir}` });
      }
      if (!statSync(srcDir).isDirectory()) {
        return JSON.stringify({
          error: `source_dir must be a directory, got a file: ${srcDir}`,
          hint: "Use 'source' for ZIP/.skill files, or 'body' for SKILL.md content directly.",
        });
      }
      const skillMdPath = resolve(srcDir, "SKILL.md");
      if (!existsSync(skillMdPath)) {
        return JSON.stringify({
          error: `source_dir must contain SKILL.md at its root: ${srcDir}`,
          hint: "SKILL.md is required (with YAML frontmatter). See skill-creation-guide.md.",
        });
      }
      try {
        await cp(srcDir, skillDir, { recursive: true });
        return JSON.stringify({
          installed: true,
          name,
          path: skillDir,
          hint: "新对话中即可使用此 skill（所有辅助文件已一并复制）。",
        });
      } catch (err) {
        return JSON.stringify({ error: `copy failed: ${err.message}` });
      }
    }

    return JSON.stringify({
      error: "provide one of: body (SKILL.md content), source (.skill file path), or source_dir (local directory path).",
    });
    } finally {
      installingSkill = false;
    }
  },
});

console.error(`[launcher] install_skill tool registered — skills root: ${skillsRoot}`);

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
  // P2-2: trim specs so comparison with mcpServers[i].spec (already trimmed) is reliable
  const specs = (cfg.mcp ?? []).map(s => s.trim());
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
function buildSystemPrompt(rootDir, hasSemantic) {
  const routing = hasSemantic ? `

# Search routing

You have BOTH \`semantic_search\` (vector index) and \`search_content\` (literal grep).

- **Descriptive queries** ("where do we handle X", "which file owns Y", "how does Z work") → call \`semantic_search\` FIRST.
- **Exact-token queries** (specific identifier, regex, "find every call to foo") → call \`search_content\`.

If \`semantic_search\` returns nothing useful, fall back to \`search_content\`.` : "";

  return `You are Visionox, a helpful DeepSeek-powered AI assistant. Be concise and accurate.

## Tools

- **Filesystem**: read_file, write_file, list_directory, search_files — sandboxed to ${rootDir}
- **Shell**: run_command — execute commands in ${rootDir}
- **Web**: web_search, web_fetch — search the web and fetch pages
- **Memory**: save and recall project/global memory
- **Planning**: create and manage plans, track todos
- **Choices**: ask the user to make choices when needed

## Tool selection strategy

- To find code by **meaning or intent** ("where is auth handled?") → use semantic_search (if available) or search_files with keywords
- To find **exact symbols or strings** ("every call to login()") → use search_files with literal patterns
- To **read or edit files** → use read_file / write_file directly by path
- To **run commands** → use run_command; prefer single commands over chained scripts
- To **search the internet** → use web_search for broad queries, web_fetch for reading a specific URL
- When you are **unsure which tool fits**, explain your reasoning briefly and proceed with the most likely choice

## Safety boundaries

- All file operations are sandboxed to the workspace: ${rootDir}
- Shell commands execute inside the workspace by default; do NOT attempt to escape the sandbox
- In admin mode, the sandbox restriction is lifted — but always confirm destructive operations with the user
- Never expose or transmit API keys, tokens, or credentials shown in conversation

## Error handling

When a tool call fails:
1. Check whether the path, command, or argument is correct
2. Verify file/command permissions (read-only files, missing executables)
3. Try an alternative approach — e.g., if run_command fails, read the relevant files directly
4. Report the failure clearly to the user with enough context for them to decide next steps

Respond in the same language as the user's message.${routing}`;
}

function buildLoop(client, rootDir) {
  const system = buildSystemPrompt(rootDir, hasSemanticSearch);
  const systemWithSkills = applySkillsIndex(system, { projectRoot: rootDir });
  const prefix = new ImmutablePrefix({
    system: systemWithSkills,
    toolSpecs: tools.specs(),
  });
  return new CacheFirstLoop({
    client,
    prefix,
    tools,
    model,
    reasoningEffort: config.reasoningEffort ?? "max",
    autoEscalate: config.autoEscalate !== false,
  });
}

let client = null;
let loop = null;

if (apiKey) {
  try {
    client = new DeepSeekClient({ apiKey, baseUrl });
    loop = buildLoop(client, workspaceDir);
    console.error(`[launcher] CacheFirstLoop created (model=${model})`);
  } catch (err) {
    console.error(`[launcher] failed to create loop: ${err.message}`);
  }
}
if (client) refreshBalance();

// ── Event sink (writes .events.jsonl for cockpit tool activity) ──
let eventSink = null;
let eventizer = null;
try {
  eventSink = openEventSink(eventLogPath("desktop"));
  eventizer = new Eventizer();
  eventSink.append(eventizer.emitSessionOpened(0, "desktop", 0));
  console.error(`[launcher] event sink opened`);
} catch (err) {
  console.error(`[launcher] event sink init failed: ${err.message}`);
}

// Async version check (populates latestVersion for health page)
let latestVersion = VERSION;
getLatestVersion().then((v) => { if (v) latestVersion = v; }).catch(() => {});

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

// P2-3: install_skill rate limiter
const skillInstallTimes = [];
const SKILL_RATE_LIMIT = 10;
const SKILL_RATE_WINDOW = 60_000;
const MAX_BODY_SIZE = 1024 * 1024;     // 1 MB
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50 MB
let installingSkill = false;

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
  getLatestVersion: () => latestVersion,
  getSessionName: () => "desktop",
  getModels: () => null,
  getLoopRunStatus: () => null,
  getActiveModal: () => null,
  hasApiKey: () => !!apiKey,
  getLogs: () => logBuffer.slice(),

  // ── Setters / actions ──────────────────────────────────────
  setEditMode: (m) => {
    const cfg = readConfig(configPath);
    cfg.editMode = m;
    writeConfig(cfg, configPath);
    console.error(`[launcher] edit mode: ${m}`);
    return m;
  },
  setPlanMode: () => {},
  applyPresetLive: (name) => {
    console.error(`[launcher] preset: ${name}`);
    if (name === "pro") {
      loop?.configure({ model: "deepseek-v4-pro", autoEscalate: false });
    } else if (name === "flash") {
      loop?.configure({ model: "deepseek-v4-flash", autoEscalate: false });
    } else {
      loop?.configure({ model: "deepseek-v4-flash", autoEscalate: true });
    }
  },
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
    console.error(`[launcher] workspaceDir saved to config: ${dir} (takes effect next /new)`);
  },

  // Sync workspace: unregister old tools, re-register with new root, rebuild loop.
  // Called at the start of submitPrompt so the new conversation uses the new workspace.
  syncWorkspace: async () => {
    const cfg = readConfig(configPath);

    // Reload API key & baseUrl — may have been changed in Settings
    const newApiKey = loadApiKey();
    const newBaseUrl = loadBaseUrl();
    if (newApiKey !== apiKey || newBaseUrl !== baseUrl) {
      console.error(`[launcher] apiKey/baseUrl changed, recreating client`);
      apiKey = newApiKey;
      baseUrl = newBaseUrl;
      if (apiKey) {
        client = new DeepSeekClient({ apiKey, baseUrl });
        loop = buildLoop(client, workspaceDir);
        refreshBalance();
        console.error(`[launcher] client & loop recreated with new credentials`);
      } else {
        client = null;
        loop = null;
        balanceData = null;
        console.error(`[launcher] apiKey removed, client cleared`);
      }
    }

    const configuredDir = resolve(home, cfg.workspaceDir ?? "visionox-workspace");
    if (configuredDir === workspaceDir) return;

    console.error(`[launcher] workspace switch: ${workspaceDir} → ${configuredDir}`);

    // P2-1: unregister MCP tools from old workspace
    for (const srv of mcpServers) {
      for (const name of srv.toolNames) {
        tools.unregister(name);
        loop?.prefix?.removeTool(name);
      }
    }

    // Unregister old workspace tools
    for (const name of wsToolNames) {
      tools.unregister(name);
      loop?.prefix?.removeTool(name);
    }

    // Re-register with new root
    if (!existsSync(configuredDir)) mkdirSync(configuredDir, { recursive: true });
    const result = await registerWorkspaceTools(tools, configuredDir, { jobs });
    hasSemanticSearch = result.hasSemantic;
    wsToolNames = [...WORKSPACE_TOOL_NAMES_BASE];
    if (!hasSemanticSearch) {
      wsToolNames = wsToolNames.filter((n) => n !== "semantic_search");
    }
    workspaceDir = configuredDir;

    // Rebuild loop with new system prompt & prefix
    if (loop && client) {
      loop = buildLoop(client, workspaceDir);
      console.error(`[launcher] loop rebuilt for new workspace: ${workspaceDir}`);
    }

    // Deploy skill-creation-guide to new workspace
    deploySkillGuide(workspaceDir);

    // P2-1: re-register MCP tools for new workspace
    await reloadMcp();

    console.error(`[launcher] workspace synced: ${workspaceDir}`);
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

  // P0-1: busy guard must be checked and set BEFORE any await to prevent
  // race conditions where two rapid calls both pass the busy check.
  submitPrompt: async (text, sessionName) => {
    if (busy) {
      return { accepted: false, reason: "loop is busy with a turn" };
    }
    busy = true;

    // committed: set to true when the fire-and-forget IIFE takes ownership
    // of busy-reset. Early-return paths leave it false so the outer finally
    // block resets busy.
    let committed = false;
    try {
      // ── Sync workspace if changed ─────────────────────────────
      await ctx.syncWorkspace();

      // ── Session resume: load historical messages ──────────────
      if (sessionName && loop) {
        // P2-7: validate sessionName to prevent path traversal
        if (!/^[\w.-]+$/.test(sessionName)) {
          return { accepted: false, reason: `Invalid session name: ${sessionName}. Use only alphanumeric, underscore, dot, or hyphen.` };
        }
        try {
          const sessionFile = resolve(sessionsDir, sessionName + ".jsonl");
          const raw = readFileSync(sessionFile, "utf8");
          const entries = raw.split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l));
          // Load into AI context
          loop.log.compactInPlace(entries);
          // Populate dashboard messages
          messages.length = 0;
          nextMsgId = 1;
          const loaded = [];
          for (const entry of entries) {
            const role = entry.role === "tool" ? "tool" : entry.role;
            const id = role === "assistant" ? `assistant-${Date.now()}-${nextMsgId}` : `${role}-${nextMsgId}`;
            messages.push({ id, role, text: entry.content || "" });
            loaded.push({ id, role, text: entry.content || "" });
            nextMsgId++;
          }
          broadcastDashboardEvent({ kind: "messages-reset", messages: loaded });
          console.error(`[launcher] session loaded: ${sessionName} (${entries.length} messages)`);
          if (!text || !text.trim()) {
            return { accepted: true, loaded: true, session: sessionName };
          }
        } catch (err) {
          console.error(`[launcher] failed to load session ${sessionName}: ${err.message}`);
          return { accepted: false, reason: `Failed to load session: ${err.message}` };
        }
      }

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
        // Reset eventizer for new session
        if (eventizer) {
          eventizer = new Eventizer();
          try { eventSink?.append(eventizer.emitSessionOpened(0, "desktop", 0)); } catch {}
        }
        // Clear dashboard messages
        messages.length = 0;
        nextMsgId = 1;
        // Add welcome message
        const welcomeId = `assistant-${Date.now()}`;
        const welcomeMsg = { id: welcomeId, role: "assistant", text: "我是你的AI助手，我可以帮你原理图检查、脚本分析、光学数据采集、编辑文件、执行命令、搜索网络。直接告诉我要做什么吧。\n需要创建或导入 skill 时使用 install_skill 工具；编写规范参考 .visionox/skill-creation-guide.md" };
        messages.push(welcomeMsg);
        // busy is already true from the outer guard; just broadcast events
        broadcastDashboardEvent({ kind: "busy-change", busy: true });
        broadcastDashboardEvent({ kind: "assistant_final", id: welcomeId, text: welcomeMsg.text });
        return { accepted: true };
      }

      if (!loop) {
        return {
          accepted: false,
          reason: "API key not configured. Open Settings tab to add your DeepSeek API key, then restart the app."
        };
      }

      broadcastDashboardEvent({ kind: "busy-change", busy: true });

      const userMsgId = String(nextMsgId++);
      messages.push({ id: userMsgId, role: "user", text });
      broadcastDashboardEvent({ kind: "user", id: userMsgId, text });

      const assistantId = `assistant-${Date.now()}`;

      // Fire-and-forget: process the turn asynchronously
      // When committed=true, the outer finally skips busy-reset because
      // the fire-and-forget's own finally handles it.
      committed = true;
      (async () => {
        let assistantText = "";
        try {
          for await (const ev of loop.step(text)) {
            // Write event to .events.jsonl for cockpit tool activity
            if (eventSink && eventizer) {
              try {
                const ectx = { model: ev.stats?.model ?? loop.model ?? model, prefixHash: "", reasoningEffort: loop.reasoningEffort ?? "max" };
                for (const out of eventizer.consume(ev, ectx)) eventSink.append(out);
              } catch {}
            }

            const dashev = loopEventToDashboard(ev, assistantId);
            broadcastDashboardEvent(dashev);

            if (ev.role === "assistant_delta") {
              assistantText += ev.content ?? "";
            }
            if (ev.role === "assistant_final") {
              // Keep the longest content — the last real answer wins over
              // shorter intermediate reasoning/tool-use summaries
              if (ev.content && ev.content.length > assistantText.length) {
                assistantText = ev.content;
              }
            }
          }
          // Push only once, after the loop finishes, to avoid duplicates
          // from multi-iteration tool-call turns and DeepSeek thinking phases
          if (assistantText) {
            messages.push({
              id: assistantId,
              role: "assistant",
              text: assistantText,
            });
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
    } finally {
      // Reset busy on any early-return path (session load, /new, no-loop, etc.)
      if (!committed) {
        busy = false;
        broadcastDashboardEvent({ kind: "busy-change", busy: false });
      }
    }
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
      balance: balanceData?.balance_infos ?? null,
    };
  },
};

// Sync preset → loop model on startup so the dashboard /overview
// returns consistent preset and model fields from the first poll
if (config.preset && config.preset !== "auto") {
  ctx.applyPresetLive(config.preset);
}

// ── Initial welcome message ──────────────────────────────────────
messages.push({
  id: "welcome",
  role: "assistant",
  text: (apiKey ? "" : "⚠️ 未配置 API Key，请在 设置 → 模型服务 中配置后开始对话。\n\n")
    + "我是你的AI助手，我可以帮你原理图检查、脚本分析、光学数据采集、编辑文件、执行命令、搜索网络。直接告诉我要做什么吧。\n需要创建或导入 skill 时使用 install_skill 工具；编写规范参考 .visionox/skill-creation-guide.md",
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
    try { eventSink?.close(); } catch {}
    close().then(() => process.exit(0)).catch(() => process.exit(1));
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
