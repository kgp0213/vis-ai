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
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
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
const LOG_MSG_MAX = 2000;
const logBuffer = [];
const _origError = console.error;
const _origLog = console.log;
const _origWarn = console.warn;
console.error = (...args) => {
  let msg = args.join(" ");
  if (msg.length > LOG_MSG_MAX) msg = msg.slice(0, LOG_MSG_MAX) + `… (truncated ${msg.length - LOG_MSG_MAX} chars)`;
  logBuffer.push({ ts: Date.now(), msg });
  if (logBuffer.length > LOG_MAX) logBuffer.shift();
  _origError.apply(console, args);
};
console.log = (...args) => {
  let msg = args.join(" ");
  if (msg.length > LOG_MSG_MAX) msg = msg.slice(0, LOG_MSG_MAX) + `… (truncated ${msg.length - LOG_MSG_MAX} chars)`;
  logBuffer.push({ ts: Date.now(), msg });
  if (logBuffer.length > LOG_MAX) logBuffer.shift();
  _origLog.apply(console, args);
};
console.warn = (...args) => {
  let msg = args.join(" ");
  if (msg.length > LOG_MSG_MAX) msg = msg.slice(0, LOG_MSG_MAX) + `… (truncated ${msg.length - LOG_MSG_MAX} chars)`;
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
const modeMemoryDir = resolve(visionoxDataDir, "mode-memory");
if (!existsSync(modeMemoryDir)) {
  mkdirSync(modeMemoryDir, { recursive: true });
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
  { MemoryStore },
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
  import(distPath("chunk-5JJRUIPA.js")),
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

// Workspace-dependent tool names — populated by registerWorkspaceTools() return value
let wsToolNames = [];
let hasSemanticSearch = false;

async function registerWorkspaceTools(tools, rootDir, opts = {}) {
  const before = new Set(tools.specs().map(s => s.function?.name).filter(Boolean));
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

  const after = new Set(tools.specs().map(s => s.function?.name).filter(Boolean));
  if (hasSemantic) after.add("semantic_search");
  const toolNames = [...after].filter(n => !before.has(n));

  return { toolNames, hasSemantic };
}

// ── Create registry & register all tools ────────────────────────
const tools = new ToolRegistry();
const jobs = new JobRegistry();

// Workspace-dependent tools — registered via shared function
const wsResult = await registerWorkspaceTools(tools, workspaceDir, { jobs });
wsToolNames = wsResult.toolNames;
hasSemanticSearch = wsResult.hasSemantic;

// Shell edit mode — default to auto on first run
if (!config.editMode) {
  config.editMode = "auto";
  writeConfig(config, configPath);
}

// ESM TDZ: DEFAULT_MODES must be declared before initModesConfig() call
// Prompts reference skills verified present in ~/.visionox/skills/
const DEFAULT_MODE_VERSION = 2;
const DEFAULT_MODES = {
  general: {
    version: DEFAULT_MODE_VERSION,
    label: "通用",
    description: "日常问答、资料梳理、轻量排查和跨领域任务。",
    hint: "平衡准确性和简洁度，必要时再切换到专业模式。",
    eccRules: ["common", "rust"],
    skills: ["coding-standards", "verification-loop"],
    prompt: "你处于通用模式。先判断用户目标属于问答、代码、办公还是设计；若任务明显属于专业场景，按该场景的工作习惯组织答案，但不要擅自切换模式。保持回答直接、可执行，必要时指出下一步。",
  },
  coding: {
    version: DEFAULT_MODE_VERSION,
    label: "编程",
    description: "代码阅读、修复、重构、测试、构建和工程审查。",
    hint: "优先读上下文，改动小而准，完成后运行针对性验证。",
    eccRules: ["common", "rust", "typescript", "python"],
    skills: ["coding-standards", "tdd-workflow", "rust-patterns", "python-patterns", "api-design", "verification-loop", "error-handling"],
    prompt: "你处于编程模式。修改前先阅读相关上下文，优先沿用项目既有模式；代码注释优先英文且只解释非显然逻辑。实现后运行与风险匹配的验证，清楚报告改动、验证结果和残余风险。",
  },
  office: {
    version: DEFAULT_MODE_VERSION,
    label: "办公",
    description: "文档、表格、PDF、PPT、报告、数据整理和格式转换。",
    hint: "关注结构、准确性、可交付文件和中文排版质量。",
    eccRules: ["common"],
    skills: ["docx", "xlsx", "pdf", "pdf-extract", "pptx", "pptx-generator", "visionox-excel-pro", "md-to-pdf-cjk"],
    prompt: "你处于办公模式。优先明确输入文件、目标格式、输出位置和质量要求；处理表格、文档、PDF、PPT 时保持原始数据可追溯，必要时生成中间检查结果。中文文档注意标题层级、表格可读性和交付文件路径。",
  },
  design: {
    version: DEFAULT_MODE_VERSION,
    label: "设计",
    description: "界面体验、前端布局、视觉风格、交互状态和可用性优化。",
    hint: "先服务真实工作流，再处理视觉细节和状态反馈。",
    eccRules: ["common"],
    skills: ["frontend-patterns", "e2e-testing"],
    prompt: "你处于设计模式。先理解用户场景、目标用户和主要任务流；界面应清晰、克制、可扫描，控件行为符合用户直觉。涉及前端实现时同时考虑响应式布局、空/错/加载状态和可验证的交互结果。",
  },
};

// Modes & ECC rules — initialize on first run
initModesConfig();
console.error(`[launcher] active mode: ${config.mode} (rules: ${getModeConfig().eccRules.join(", ")})`);

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

// ── Session memory tool ────────────────────────────────────────
tools.register({
  name: "remember_session",
  description: "保存一条仅当前对话有效的临时记忆。对话结束或 /new 后自动清除。适合记录临时的上下文、中间结论、用户偏好等信息。",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "简短名称，用于在记忆列表中标识" },
      body: { type: "string", description: "记忆的完整内容" },
    },
    required: ["name", "body"],
  },
  fn: async (args) => {
    const name = String(args.name ?? "").trim();
    const body = String(args.body ?? "").trim();
    if (!name || !body) return JSON.stringify({ error: "name and body are required" });
    const desc = body.length > 80 ? body.slice(0, 80) + "…" : body;
    addSessionMemory(name, desc, body);
    return JSON.stringify({ remembered: true, name, chars: body.length, hint: "此记忆在当前对话中生效，/new 后清除" });
  },
});
console.error(`[launcher] remember_session tool registered`);

tools.register({
  name: "remember_mode_preference",
  description: "保存一条用户明确要求记住、用于优化当前工作模式的偏好。偏好会按当前 work mode 独立存储，并在新对话提示词中以精简摘要注入；不要用它记录普通事实或临时上下文。",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "精简后的偏好内容。应表达为可执行的工作习惯，不要原样粘贴长对话。",
      },
      keywords: {
        type: "array",
        items: { type: "string" },
        description: "可选关键词，用于帮助用户识别这条偏好。",
      },
      priority: {
        type: "number",
        description: "0-100，越高越优先注入；默认 50。",
      },
    },
    required: ["text"],
  },
  fn: async (args) => {
    const text = compactText(args.text, MODE_MEMORY_TEXT_LIMIT);
    if (!text) return JSON.stringify({ error: "text is required" });
    const mode = config.mode || "general";
    const { item, memory } = addModeMemory(mode, {
      text,
      keywords: Array.isArray(args.keywords) ? args.keywords : [],
      priority: args.priority,
    });
    return JSON.stringify({
      remembered: true,
      mode,
      item,
      count: memory.items.length,
      hint: "此偏好只影响当前工作模式的新对话提示词，不会改写默认 mode prompt 或 ECC 规则。",
    });
  },
});
console.error(`[launcher] remember_mode_preference tool registered`);

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

// ── Soul (identity) ────────────────────────────────────────────
const SOUL_HOME = resolve(home, ".visionox", "soul.md");

function loadSoul() {
  try {
    if (existsSync(SOUL_HOME)) {
      const content = readFileSync(SOUL_HOME, "utf8").trim();
      if (content) return content;
    }
  } catch {}
  return null;
}

// ── Mode system ────────────────────────────────────────────────
function mergeDefaultModes(modes) {
  const merged = Object.fromEntries(
    Object.entries(DEFAULT_MODES).map(([id, defaults]) => {
      const existing = modes?.[id];
      const source = existing?.version === DEFAULT_MODE_VERSION
        ? { ...defaults, ...existing }
        : defaults;
      return [id, normalizeModeConfig(source, id)];
    })
  );
  for (const [id, mode] of Object.entries(modes ?? {})) {
    if (!merged[id]) merged[id] = normalizeModeConfig(mode, id);
  }
  return merged;
}

function collectModePromptMigration(modes) {
  const migrated = [];
  const backup = {};
  for (const id of Object.keys(DEFAULT_MODES)) {
    const existing = modes?.[id];
    if (!existing || existing.version === DEFAULT_MODE_VERSION) continue;
    migrated.push(id);
    backup[id] = existing;
  }
  return migrated.length > 0 ? { migrated, backup } : null;
}

function appendModePromptBackup(migration) {
  if (!migration) return;
  const backups = Array.isArray(config.modePromptBackups) ? config.modePromptBackups : [];
  backups.push({
    migratedAt: new Date().toISOString(),
    fromVersion: "legacy",
    toVersion: DEFAULT_MODE_VERSION,
    modes: migration.backup,
  });
  config.modePromptBackups = backups.slice(-5);
  config.modePromptMigration = {
    version: DEFAULT_MODE_VERSION,
    migratedAt: config.modePromptBackups[config.modePromptBackups.length - 1].migratedAt,
    migratedModes: migration.migrated,
  };
}

function normalizeModeConfig(mode, id) {
  const fallback = DEFAULT_MODES[id] ?? {};
  const rules = Array.isArray(mode?.eccRules) ? mode.eccRules.filter(Boolean) : (fallback.eccRules ?? ["common"]);
  const skills = Array.isArray(mode?.skills) ? mode.skills.filter(Boolean) : (fallback.skills ?? []);
  return {
    label: String(mode?.label ?? fallback.label ?? id),
    description: String(mode?.description ?? fallback.description ?? ""),
    hint: String(mode?.hint ?? fallback.hint ?? ""),
    version: Number(mode?.version ?? fallback.version ?? DEFAULT_MODE_VERSION),
    eccRules: rules,
    skills,
    prompt: String(mode?.prompt ?? fallback.prompt ?? ""),
  };
}

function syncRuntimeConfig(next) {
  for (const key of Object.keys(config)) {
    if (!(key in next)) delete config[key];
  }
  Object.assign(config, next);
}

function initModesConfig() {
  let changed = false;
  const migration = collectModePromptMigration(config.modes);
  const merged = mergeDefaultModes(config.modes);
  if (JSON.stringify(config.modes) !== JSON.stringify(merged)) {
    appendModePromptBackup(migration);
    config.modes = merged;
    changed = true;
  }
  if (!config.mode || !config.modes[config.mode]) {
    config.mode = "general";
    changed = true;
  }
  if (changed) {
    writeConfig(config, configPath);
    const suffix = migration ? `; migrated legacy prompts: ${migration.migrated.join(", ")}` : "";
    console.error(`[launcher] modes initialized (${Object.keys(DEFAULT_MODES).join(", ")})${suffix}`);
  }
}

function getModeConfig() {
  const fresh = readConfig(configPath);
  if (fresh.mode !== config.mode || JSON.stringify(fresh.modes ?? null) !== JSON.stringify(config.modes ?? null)) {
    syncRuntimeConfig(fresh);
    initModesConfig();
  }
  const mode = config.mode || "general";
  return config.modes?.[mode] || DEFAULT_MODES.general;
}

function modeSummary(modeId = config.mode || "general") {
  const mode = config.modes?.[modeId] || DEFAULT_MODES.general;
  const enabledRules = orderedRuleSets(mode.eccRules || []);
  return {
    id: modeId,
    label: mode.label,
    description: mode.description,
    hint: mode.hint,
    rules: mode.eccRules || [],
    effectiveRules: enabledRules,
    skills: mode.skills || [],
    appliesOn: "new-chat",
  };
}

// ── Mode preference memory (persistent, per work mode) ──────────
const MODE_MEMORY_VERSION = 1;
const MODE_MEMORY_ITEM_LIMIT = 60;
const MODE_MEMORY_PROMPT_LIMIT = 8;
const MODE_MEMORY_TEXT_LIMIT = 180;
const MODE_MEMORY_KEYWORD_LIMIT = 8;

function safeModeId(modeId = config.mode || "general") {
  const raw = String(modeId || "general").trim();
  return /^[a-zA-Z0-9_-]{1,32}$/.test(raw) ? raw : "general";
}

function modeMemoryPath(modeId = config.mode || "general") {
  return resolve(modeMemoryDir, `${safeModeId(modeId)}.json`);
}

function compactText(value, max = MODE_MEMORY_TEXT_LIMIT) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeModeMemoryItem(item, index = 0) {
  const now = new Date().toISOString();
  const text = compactText(item?.text ?? item?.body ?? item?.summary ?? "");
  if (!text) return null;
  const keywords = Array.isArray(item?.keywords)
    ? item.keywords.map((k) => compactText(k, 32)).filter(Boolean).slice(0, MODE_MEMORY_KEYWORD_LIMIT)
    : [];
  return {
    id: String(item?.id || randomUUID()),
    text,
    keywords,
    scope: "current-mode",
    priority: Number.isFinite(Number(item?.priority)) ? Math.max(0, Math.min(100, Number(item.priority))) : 50,
    enabled: item?.enabled !== false,
    source: String(item?.source || "user-explicit"),
    createdAt: String(item?.createdAt || now),
    updatedAt: String(item?.updatedAt || item?.createdAt || now),
    order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
  };
}

function readModeMemory(modeId = config.mode || "general") {
  const mode = safeModeId(modeId);
  const path = modeMemoryPath(mode);
  let parsed = null;
  if (existsSync(path)) {
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      parsed = null;
    }
  }
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
  const items = rawItems.map((item, index) => normalizeModeMemoryItem(item, index)).filter(Boolean);
  return { version: MODE_MEMORY_VERSION, mode, path, updatedAt: parsed?.updatedAt || null, items };
}

function writeModeMemory(modeId, payload) {
  const mode = safeModeId(modeId);
  const items = (Array.isArray(payload?.items) ? payload.items : [])
    .map((item, index) => normalizeModeMemoryItem(item, index))
    .filter(Boolean)
    .sort((a, b) => {
      if (b.enabled !== a.enabled) return Number(b.enabled) - Number(a.enabled);
      if (b.priority !== a.priority) return b.priority - a.priority;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    })
    .slice(0, MODE_MEMORY_ITEM_LIMIT);
  const data = { version: MODE_MEMORY_VERSION, mode, updatedAt: new Date().toISOString(), items };
  const path = modeMemoryPath(mode);
  mkdirSync(modeMemoryDir, { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return { ...data, path };
}

function listModeMemory(modeId = config.mode || "general") {
  return readModeMemory(modeId);
}

function listAllModeMemory() {
  const modes = config.modes || DEFAULT_MODES;
  return {
    version: MODE_MEMORY_VERSION,
    modes: Object.keys(modes).map((id) => {
      const memory = readModeMemory(id);
      return {
        id,
        label: modes[id]?.label || id,
        count: memory.items.length,
        enabledCount: memory.items.filter((item) => item.enabled).length,
        updatedAt: memory.updatedAt || null,
      };
    }),
  };
}

function addModeMemory(modeId, input = {}) {
  const current = readModeMemory(modeId);
  const item = normalizeModeMemoryItem({
    ...input,
    id: input.id || randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  if (!item) throw new Error("text is required");
  const exists = current.items.find((old) => old.text === item.text);
  const items = exists
    ? current.items.map((old) => old.id === exists.id ? { ...old, ...item, id: old.id, createdAt: old.createdAt } : old)
    : [item, ...current.items];
  return { item: exists ? items.find((old) => old.id === exists.id) : item, memory: writeModeMemory(current.mode, { items }) };
}

function updateModeMemory(modeId, id, patch = {}) {
  const current = readModeMemory(modeId);
  const now = new Date().toISOString();
  let updated = null;
  const items = current.items.map((item) => {
    if (item.id !== id) return item;
    updated = normalizeModeMemoryItem({
      ...item,
      ...patch,
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: now,
    });
    return updated;
  });
  if (!updated) return null;
  return { item: updated, memory: writeModeMemory(current.mode, { items }) };
}

function deleteModeMemory(modeId, id) {
  const current = readModeMemory(modeId);
  const items = current.items.filter((item) => item.id !== id);
  if (items.length === current.items.length) return false;
  writeModeMemory(current.mode, { items });
  return true;
}

function formatModeMemoryForPrompt(modeId = config.mode || "general") {
  const memory = readModeMemory(modeId);
  const items = memory.items
    .filter((item) => item.enabled)
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    })
    .slice(0, MODE_MEMORY_PROMPT_LIMIT);
  if (items.length === 0) return "";
  const lines = items.map((item) => {
    const suffix = item.keywords.length ? ` [${item.keywords.join(", ")}]` : "";
    return `- ${compactText(item.text, MODE_MEMORY_TEXT_LIMIT)}${suffix}`;
  });
  return `\n\n# Current work mode preferences\n\nThese are compact, user-approved preferences for the current work mode. Apply them only when relevant; they do not override the user's current explicit instructions or ECC rules.\n\n${lines.join("\n")}`;
}

// ── Session memory (volatile) ──────────────────────────────────
const sessionMemories = [];

function addSessionMemory(name, description, body) {
  sessionMemories.push({ name, description, body, ts: Date.now() });
  if (sessionMemories.length > 50) sessionMemories.shift();
}
function clearSessionMemories() { sessionMemories.length = 0; }
function getSessionMemoryBlock() {
  if (sessionMemories.length === 0) return "";
  const lines = sessionMemories.map((m) => {
    const title = String(m.name).replace(/[\r\n]/g, " ").trim();
    return `## ${title}\n\n${m.body}`;
  });
  return `\n# Session memory (this conversation only)\n\n${lines.join("\n\n")}`;
}

function formatPersistentMemoryForPrompt(rootDir) {
  let store;
  try {
    store = new MemoryStore({ projectRoot: rootDir });
  } catch (err) {
    console.error(`[launcher] persistent memory skipped: ${err.message}`);
    return "";
  }
  const blocks = [];
  const global = store.loadIndex("global");
  if (global) {
    blocks.push([
      "# User memory - global",
      "",
      "Cross-project facts and preferences the user explicitly asked to remember. Treat these as authoritative unless the current user message updates or contradicts them. Use `recall_memory` only when the one-line index is not enough.",
      "",
      "```",
      global.content,
      "```",
    ].join("\n"));
  }
  const project = store.hasProjectScope() ? store.loadIndex("project") : null;
  if (project) {
    blocks.push([
      "# User memory - this project",
      "",
      "Per-project facts and decisions the user established in prior sessions. Treat these as authoritative for this workspace unless the current user message updates or contradicts them.",
      "",
      "```",
      project.content,
      "```",
    ].join("\n"));
  }
  return blocks.length ? `\n\n${blocks.join("\n\n")}` : "";
}

// ── Build session ───────────────────────────────────────────────
const ALL_ECC_RULES = Object.create(null);
ALL_ECC_RULES["common"]     = resolve(home, ".claude", "rules", "ecc", "common");
ALL_ECC_RULES["rust"]       = resolve(home, ".claude", "rules", "ecc", "rust");
ALL_ECC_RULES["typescript"] = resolve(home, ".claude", "rules", "ecc", "typescript");
ALL_ECC_RULES["python"]     = resolve(home, ".claude", "rules", "ecc", "python");
ALL_ECC_RULES["custom"]     = resolve(home, ".visionox", "rules");

function getEnabledRuleSets() {
  return getModeConfig().eccRules || ["common", "rust"];
}

function orderedRuleSets(enabled) {
  const seen = new Set();
  const ordered = [];
  for (const name of [...enabled, "custom"]) {
    if (!ALL_ECC_RULES[name] || seen.has(name)) continue;
    seen.add(name);
    ordered.push(name);
  }
  return ordered;
}

function loadRules() {
  const enabled = orderedRuleSets(getEnabledRuleSets());
  const rules = [];
  for (const name of enabled) {
    const dir = ALL_ECC_RULES[name];
    if (!existsSync(dir)) continue;
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort((a, b) => a.localeCompare(b));
      for (const f of files) {
        try {
          const content = readFileSync(resolve(dir, f), "utf8").trim();
          if (content) rules.push(`<!-- rule: ${f} (${name}) -->\n${content}`);
        } catch {}
      }
    } catch {}
  }
  return rules;
}

function getRuleSetStatus(enabled = getEnabledRuleSets()) {
  return orderedRuleSets(enabled).map((name) => {
    const dir = ALL_ECC_RULES[name];
    let files = [];
    if (dir && existsSync(dir)) {
      try {
        files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort((a, b) => a.localeCompare(b));
      } catch {
        files = [];
      }
    }
    return {
      name,
      path: dir,
      available: Boolean(dir && existsSync(dir)),
      fileCount: files.length,
    };
  });
}

// ── Hook system ─────────────────────────────────────────────────
const hooks = { preTool: [], postTool: [], onStart: [], onStop: [] };

function registerHook(event, pattern, handler) {
  hooks[event] = hooks[event] || [];
  hooks[event].push({ pattern, handler });
}

function runHooks(event, ctx) {
  const list = hooks[event] || [];
  for (const h of list) {
    if (!h.pattern || h.pattern.test(ctx.name)) {
      try { h.handler(ctx); } catch (e) { console.error(`[hook] ${event}:${h.pattern} failed: ${e.message}`); }
    }
  }
}
function buildSystemPrompt(rootDir, hasSemantic) {
  const routing = hasSemantic ? `

# Search routing

You have BOTH \`semantic_search\` (vector index) and \`search_content\` (literal grep).

- **Descriptive queries** ("where do we handle X", "which file owns Y", "how does Z work") → call \`semantic_search\` FIRST.
- **Exact-token queries** (specific identifier, regex, "find every call to foo") → call \`search_content\`.

If \`semantic_search\` returns nothing useful, fall back to \`search_content\`.` : "";

  const toolList = tools.specs()
    .map(s => s.function)
    .filter(f => f?.name)
    .map(f => {
      const firstSentence = (f.description || "").split(".")[0].trim();
      return `- **${f.name}**: ${firstSentence}`;
    })
    .join("\n");

  return `You are Visionox, a helpful DeepSeek-powered AI assistant. Be concise and accurate.

## Tools

${toolList}

## Tool selection strategy

- To find code by **meaning or intent** ("where is auth handled?") → use semantic_search (if available) or search_files with keywords
- To find **exact symbols or strings** ("every call to login()") → use search_files with literal patterns
- To **read or edit files** → use read_file / write_file directly by path
- To **run commands** → use run_command; prefer single commands over chained scripts
- To **search the internet** → use web_search for broad queries, web_fetch for reading a specific URL
- When the user asks you to **remember** a stable fact, name, preference, or correction for future chats → use remember with global scope unless it is clearly project-specific
- Use remember_mode_preference only when the user explicitly says the memory is for optimizing the current work mode prompt
- Use remember_session only for temporary context that should disappear after /new
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
  const soul = loadSoul();
  const mc = getModeConfig();
  const system = buildSystemPrompt(rootDir, hasSemanticSearch);
  const systemWithSoul = soul ? `# Identity\n\n${soul}\n\n---\n\n${system}` : system;
  const modeLines = [
    `Current work mode: ${mc.label}`,
    mc.description ? `Scenario: ${mc.description}` : "",
    mc.hint ? `User-facing behavior: ${mc.hint}` : "",
    mc.skills?.length ? `Relevant skills: ${mc.skills.join(", ")}` : "",
    `Mode changes made in the dashboard apply after /new; do not claim a prompt changed mid-turn unless this prefix was rebuilt.`,
    mc.prompt || "",
  ].filter(Boolean);
  const systemWithMode = systemWithSoul + `\n\n# Work mode\n\n${modeLines.join("\n")}${formatModeMemoryForPrompt(config.mode)}`;
  const loadedRules = loadRules();
  const systemWithRules = loadedRules.length > 0
    ? systemWithMode + "\n\n# Coding Rules\n\n" + loadedRules.join("\n\n")
    : systemWithMode;
  const systemWithPersistentMemory = systemWithRules + formatPersistentMemoryForPrompt(rootDir);
  const systemWithSession = systemWithPersistentMemory + getSessionMemoryBlock();
  const systemWithSkills = applySkillsIndex(systemWithSession, { projectRoot: rootDir });
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

  // ── Register built-in hooks ──────────────────────────────────
  registerHook("postTool", /write_file|edit/, (ctx) => {
    console.error(`[hook] file written: ${ctx.args?.filePath || ctx.args?.path || "unknown"}`);
  });
  console.error(`[launcher] hooks registered`);
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
const MESSAGES_CAP = 10_000;
function pushMessage(msg) {
  messages.push(msg);
  while (messages.length > MESSAGES_CAP) messages.shift();
}

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
  getEccRules: () => ({
    available: Object.keys(ALL_ECC_RULES),
    enabled: getEnabledRuleSets(),
    status: getRuleSetStatus(),
  }),
  getModes: () => ({
    current: config.mode,
    active: modeSummary(config.mode),
    list: Object.keys(config.modes || DEFAULT_MODES).map((id) => modeSummary(id)),
  }),
  getModeMemory: (modeId) => listModeMemory(modeId || config.mode || "general"),
  getAllModeMemory: () => listAllModeMemory(),
  addModeMemory: (input, modeId) => addModeMemory(modeId || config.mode || "general", input),
  updateModeMemory: (id, patch, modeId) => updateModeMemory(modeId || config.mode || "general", id, patch),
  deleteModeMemory: (id, modeId) => deleteModeMemory(modeId || config.mode || "general", id),

  // ── Setters / actions ──────────────────────────────────────
  setEditMode: (m) => {
    const cfg = readConfig(configPath);
    cfg.editMode = m;
    writeConfig(cfg, configPath);
    console.error(`[launcher] edit mode: ${m}`);
    return m;
  },
  setPlanMode: () => {},
  setEccRules: (rules) => {
    const cfg = readConfig(configPath);
    cfg.eccRules = rules;
    writeConfig(cfg, configPath);
    console.error(`[launcher] eccRules: ${rules.join(", ")}`);
    return true;
  },
  setMode: (modeId) => {
    const cfg = readConfig(configPath);
    cfg.modes = mergeDefaultModes(cfg.modes);
    if (!cfg.modes[modeId]) return false;
    cfg.mode = modeId;
    writeConfig(cfg, configPath);
    syncRuntimeConfig(cfg);
    console.error(`[launcher] mode: ${modeId} (${cfg.modes[modeId].label})`);
    return true;
  },
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
    wsToolNames = result.toolNames;
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
            pushMessage({ id, role, text: entry.content || "" });
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
        // Clear session memories
        clearSessionMemories();
        // Rebuild loop to pick up mode/rules changes
        if (client) {
          loop = buildLoop(client, workspaceDir);
          console.error(`[launcher] loop rebuilt (mode: ${config.mode})`);
        }
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
        pushMessage(welcomeMsg);
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
      pushMessage({ id: userMsgId, role: "user", text });
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
            pushMessage({
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

  getHooks: () => hooks,
  registerHook: (event, pattern, handler) => registerHook(event, pattern, handler),
};

// Sync preset → loop model on startup so the dashboard /overview
// returns consistent preset and model fields from the first poll
if (config.preset && config.preset !== "auto") {
  ctx.applyPresetLive(config.preset);
}

// ── Initial welcome message ──────────────────────────────────────
pushMessage({
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
