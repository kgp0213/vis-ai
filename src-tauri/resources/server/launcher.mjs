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

import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { access, appendFile, copyFile, cp, readFile, readdir, rename, rm, stat as fsStat, writeFile } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

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
      timeout: CONSTANTS.LOGIN_SHELL_TIMEOUT_MS,
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
const DEFAULT_SOUL_RESOURCE = resolve(__dirname, "..", "default-soul.md");
const bootstrapSkillsRoot = resolve(__dirname, "..", "bootstrap-skills");

// ── Centralized constants ───────────────────────────────────────
const CONSTANTS = {
  // Model defaults
  DEFAULT_MODEL: "deepseek-v4-flash",

  // Logging
  LOG_MAX: 500,
  LOG_MSG_MAX: 2000,

  // Timing
  LOGIN_SHELL_TIMEOUT_MS: 2000,
  BALANCE_REFRESH_MS: 60_000,
  BALANCE_FETCH_TIMEOUT_MS: 5000,
  SKILL_RATE_LIMIT: 10,
  SKILL_RATE_WINDOW_MS: 60_000,

  // Size limits
  MAX_BODY_SIZE: 1024 * 1024,       // 1 MB
  MAX_ZIP_SIZE: 50 * 1024 * 1024,   // 50 MB
  MAX_UNZIP_BUFFER_BYTES: 10 * 1024 * 1024, // 10 MB
  MESSAGES_CAP: 10_000,

  // Mode memory
  MODE_MEMORY_VERSION: 1,
  MODE_MEMORY_ITEM_LIMIT: 60,
  MODE_MEMORY_PROMPT_LIMIT: 8,
  MODE_MEMORY_TEXT_LIMIT: 180,
  MODE_MEMORY_KEYWORD_LIMIT: 8,

  // Mode versions
  DEFAULT_MODE_VERSION: 2,
  OFFICE_MODE_VERSION: 3,
};
const DEFAULT_SOUL_FALLBACK = `# Visionox Core Identity

## 我是谁
我是 Visionox，一个运行在 Windows 桌面环境中的 AI 助手。
我可以通过文件系统、Shell、Web 搜索和项目工具帮助用户完成软件工程、文档整理、信息分析和自动化任务。

## 协作方式
- 优先直接解决问题，减少套话和冗余前置语。
- 先利用已有上下文、文件和工具自行确认，再在确实需要时提问。
- 对不确定的信息明确说明，并在重要事实可能变化时主动核验。
- 可以给出判断和建议，但必须尊重用户的最新指令。

## 记忆边界
- 使用 \`remember\` 保存跨工作场景都应生效的长期记忆。
- 使用 \`remember_mode_preference\` 保存仅属于当前工作场景的长期记忆、术语、流程和偏好。
- 使用 \`remember_session\` 保存只在当前对话生效的临时记忆。
- 身份、名称和长期风格属于 soul 层；场景知识不要写进 soul。

## 安全与隐私
- 私密信息只在完成用户任务所需范围内使用，不主动外传。
- 对删除、覆盖、发布、提交、推送等有外部影响的动作保持谨慎。
- 不把历史测试数据当作长期身份或事实保留。`;

// ── Log buffer for developer mode ─────────────────────────────────
const logBuffer = [];
const _origError = console.error;
const _origLog = console.log;
const _origWarn = console.warn;
console.error = (...args) => {
  let msg = args.join(" ");
  if (msg.length > CONSTANTS.LOG_MSG_MAX) msg = msg.slice(0, CONSTANTS.LOG_MSG_MAX) + `… (truncated ${msg.length - CONSTANTS.LOG_MSG_MAX} chars)`;
  logBuffer.push({ ts: Date.now(), msg });
  if (logBuffer.length > CONSTANTS.LOG_MAX) logBuffer.shift();
  _origError.apply(console, args);
};
console.log = (...args) => {
  let msg = args.join(" ");
  if (msg.length > CONSTANTS.LOG_MSG_MAX) msg = msg.slice(0, CONSTANTS.LOG_MSG_MAX) + `… (truncated ${msg.length - CONSTANTS.LOG_MSG_MAX} chars)`;
  logBuffer.push({ ts: Date.now(), msg });
  if (logBuffer.length > CONSTANTS.LOG_MAX) logBuffer.shift();
  _origLog.apply(console, args);
};
console.warn = (...args) => {
  let msg = args.join(" ");
  if (msg.length > CONSTANTS.LOG_MSG_MAX) msg = msg.slice(0, CONSTANTS.LOG_MSG_MAX) + `… (truncated ${msg.length - CONSTANTS.LOG_MSG_MAX} chars)`;
  logBuffer.push({ ts: Date.now(), msg });
  if (logBuffer.length > CONSTANTS.LOG_MAX) logBuffer.shift();
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
const SOUL_HOME = resolve(visionoxDataDir, "soul.md");
const sessionsDir = resolve(visionoxDataDir, "sessions");
const skillsRoot = resolve(visionoxDataDir, "skills");
if (!existsSync(sessionsDir)) {
  mkdirSync(sessionsDir, { recursive: true });
}
const modeMemoryDir = resolve(visionoxDataDir, "mode-memory");
if (!existsSync(modeMemoryDir)) {
  mkdirSync(modeMemoryDir, { recursive: true });
}

const configPath = resolve(visionoxDataDir, "config.json");
const usageLogPath = resolve(visionoxDataDir, "usage.jsonl");

function readDefaultSoul() {
  try {
    if (existsSync(DEFAULT_SOUL_RESOURCE)) {
      const content = readFileSync(DEFAULT_SOUL_RESOURCE, "utf8").trim();
      if (content) return content;
    }
  } catch {}
  return DEFAULT_SOUL_FALLBACK;
}

function deployDefaultSoul() {
  try {
    const current = existsSync(SOUL_HOME) ? readFileSync(SOUL_HOME, "utf8").trim() : "";
    if (current) return;
    writeFileSync(SOUL_HOME, `${readDefaultSoul()}\n`, "utf8");
    console.error(`[launcher] default soul.md deployed to ${SOUL_HOME}`);
  } catch (err) {
    console.error(`[launcher] failed to deploy default soul.md: ${err.message}`);
  }
}

deployDefaultSoul();

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
let baseUrl = loadBaseUrl();

const PRESET_MODELS = {
  flash: "deepseek-v4-flash",
  pro: "deepseek-v4-pro",
};
const LEGACY_PRESET_ALIASES = {
  fast: "flash",
  smart: "auto",
  max: "pro",
};

// Keep preset and model semantics centralized. `preset` is the user's model
// commitment; `model` is only the baseline model used when preset=auto.
// New loops, live updates, and dashboard APIs must use this effective model
// instead of reading config.model directly, otherwise pro/flash labels drift.
// Legacy names mirror resolvePreset(): fast→flash, smart→auto, max→pro.
function effectiveModelConfig(source = config) {
  const rawPreset = source.preset ?? "auto";
  const preset = LEGACY_PRESET_ALIASES[rawPreset] ?? rawPreset;
  const configuredModel = source.model ?? CONSTANTS.DEFAULT_MODEL;
  const lockedModel = PRESET_MODELS[preset];
  return {
    rawPreset,
    preset,
    configuredModel,
    model: lockedModel ?? configuredModel,
    locked: Boolean(lockedModel),
    autoEscalate: preset === "auto" ? source.autoEscalate !== false : false,
  };
}

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
    const data = await client.getBalance({ signal: AbortSignal.timeout(CONSTANTS.BALANCE_FETCH_TIMEOUT_MS) });
    if (data?.balance_infos?.length) balanceData = data;
  } catch {
    // Keep the last successful balance. The dashboard polls /overview, so a
    // transient startup/network failure should not blank every balance surface.
  }
}

function normalizedBalanceInfos() {
  const infos = Array.isArray(balanceData?.balance_infos) ? balanceData.balance_infos : [];
  if (infos.length === 0) return null;
  const primary = pickPrimaryBalance(infos);
  if (!primary) return infos;
  return [primary, ...infos.filter((info) => info !== primary)];
}

function primaryBalanceSummary() {
  const infos = normalizedBalanceInfos();
  if (!infos?.length) return null;
  const primary = infos[0];
  return {
    currency: primary.currency,
    total: Number(primary.total_balance),
    total_balance: primary.total_balance,
    is_available: balanceData?.is_available,
  };
}

// Workspace directory — configurable via config.workspaceDir
let workspaceDir = resolve(home, config.workspaceDir ?? "visionox-workspace");
if (!existsSync(workspaceDir)) {
  mkdirSync(workspaceDir, { recursive: true });
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function hashFile(path) {
  return hashBuffer(await readFile(path));
}

async function hashDirectory(rootDir) {
  const hash = createHash("sha256");
  const visit = async (dir, rel = "") => {
    const entries = (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.name !== "_visionox_builtin.json")
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = resolve(dir, entry.name);
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      hash.update(childRel);
      if (entry.isDirectory()) {
        await visit(abs, childRel);
      } else if (entry.isFile()) {
        hash.update(await readFile(abs));
      }
    }
  };
  await visit(rootDir);
  return hash.digest("hex");
}

function validateSkillMarkdown(contents) {
  const trimmed = String(contents ?? "").trimStart();
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(trimmed);
  if (!match) {
    return { ok: false, error: "SKILL.md must start with YAML frontmatter delimited by ---." };
  }
  const frontmatter = match[1];
  const nameMatch = /^name:\s*["']?([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])["']?\s*$/m.exec(frontmatter);
  if (!nameMatch) {
    return { ok: false, error: "SKILL.md frontmatter must include a valid lowercase-hyphen name." };
  }
  return { ok: true, name: nameMatch[1], frontmatter };
}

async function readSkillVersion(skillDir) {
  try {
    const skillMd = await readFile(resolve(skillDir, "SKILL.md"), "utf8");
    return /^version:\s*["']?([^"'\r\n]+)["']?\s*$/m.exec(skillMd)?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

async function readBuiltinMarker(skillDir) {
  try {
    const marker = JSON.parse(await readFile(resolve(skillDir, "_visionox_builtin.json"), "utf8"));
    return marker?.owner === "visionox-bootstrap" ? marker : null;
  } catch {
    return null;
  }
}

async function writeBuiltinMarker(skillDir, name, sourceHash) {
  const marker = {
    owner: "visionox-bootstrap",
    name,
    version: await readSkillVersion(skillDir),
    sourceHash,
    installedAt: new Date().toISOString(),
  };
  writeFileSync(resolve(skillDir, "_visionox_builtin.json"), `${JSON.stringify(marker, null, 2)}\n`, "utf8");
}

function backupPathFor(target) {
  return `${target}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

async function installBootstrapSkill(name, { force = false } = {}) {
  const sourceDir = resolve(bootstrapSkillsRoot, name);
  const targetDir = resolve(skillsRoot, name);
  const skillMdPath = resolve(sourceDir, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    return { name, installed: false, reason: "missing bootstrap SKILL.md" };
  }
  const validation = validateSkillMarkdown(await readFile(skillMdPath, "utf8"));
  if (!validation.ok || validation.name !== name) {
    return { name, installed: false, reason: validation.error || "bootstrap name mismatch" };
  }
  const sourceHash = await hashDirectory(sourceDir);
  if (existsSync(targetDir)) {
    const marker = await readBuiltinMarker(targetDir);
    if (!marker) {
      return { name, installed: false, skipped: true, reason: "user skill with same name exists" };
    }
    const currentHash = marker.sourceHash || await hashDirectory(targetDir);
    if (!force && currentHash === sourceHash) {
      return { name, installed: false, skipped: true, reason: "already up to date" };
    }
    const backupDir = backupPathFor(targetDir);
    await cp(targetDir, backupDir, { recursive: true });
    await rm(targetDir, { recursive: true, force: true });
    await cp(sourceDir, targetDir, { recursive: true });
    await writeBuiltinMarker(targetDir, name, sourceHash);
    return { name, installed: true, upgraded: true, backup: backupDir, path: targetDir };
  }
  await cp(sourceDir, targetDir, { recursive: true });
  await writeBuiltinMarker(targetDir, name, sourceHash);
  return { name, installed: true, path: targetDir };
}

async function deployBootstrapSkills({ force = false } = {}) {
  const result = { root: skillsRoot, source: bootstrapSkillsRoot, installed: [], skipped: [], errors: [] };
  if (!existsSync(bootstrapSkillsRoot)) {
    result.errors.push({ reason: "bootstrap-skills resource directory not found", path: bootstrapSkillsRoot });
    return result;
  }
  if (!existsSync(skillsRoot)) mkdirSync(skillsRoot, { recursive: true });
  for (const entry of await readdir(bootstrapSkillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const item = await installBootstrapSkill(entry.name, { force });
    if (item.installed) result.installed.push(item);
    else if (item.skipped) result.skipped.push(item);
    else result.errors.push(item);
  }
  console.error(`[launcher] bootstrap skills: installed=${result.installed.length}, skipped=${result.skipped.length}, errors=${result.errors.length}`);
  return result;
}

async function getSkillEnvironmentStatus() {
  const bootstrap = [];
  if (existsSync(bootstrapSkillsRoot)) {
    for (const entry of await readdir(bootstrapSkillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const targetDir = resolve(skillsRoot, entry.name);
      const skillMd = resolve(targetDir, "SKILL.md");
      bootstrap.push({
        name: entry.name,
        installed: existsSync(skillMd),
        builtin: Boolean(await readBuiltinMarker(targetDir)),
        version: await readSkillVersion(targetDir),
      });
    }
  }
  return {
    skillsRoot,
    bootstrapSkillsRoot,
    skillsRootExists: existsSync(skillsRoot),
    bootstrap,
    ok: bootstrap.length > 0 && bootstrap.every((s) => s.installed),
  };
}

async function deploySkillGuide(rootDir) {
  const guideSrc = resolve(__dirname, "..", "skill-creation-guide.md");
  const guideDir = resolve(rootDir, ".visionox");
  const guideDst = resolve(guideDir, "skill-creation-guide.md");
  if (!existsSync(guideSrc)) return { deployed: false, reason: "source guide not found" };
  if (!existsSync(guideDir)) mkdirSync(guideDir, { recursive: true });
  if (!existsSync(guideDst)) {
    await copyFile(guideSrc, guideDst);
    console.error(`[launcher] skill-creation-guide.md deployed to workspace`);
    return { deployed: true, path: guideDst };
  }
  if (await hashFile(guideSrc) !== await hashFile(guideDst)) {
    const backup = backupPathFor(guideDst);
    await copyFile(guideDst, backup);
    await copyFile(guideSrc, guideDst);
    console.error(`[launcher] skill-creation-guide.md refreshed in workspace`);
    return { deployed: true, refreshed: true, backup, path: guideDst };
  }
  return { deployed: false, skipped: true, reason: "already up to date", path: guideDst };
}
await deployBootstrapSkills();
await deploySkillGuide(workspaceDir);

const startupModelConfig = effectiveModelConfig();
console.error(`[launcher] apiKey ${apiKey ? "found" : "NOT FOUND — chat will be disabled"}, preset=${startupModelConfig.preset}, model=${startupModelConfig.model}`);
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
const DEFAULT_MODES = {
  general: {
    version: CONSTANTS.DEFAULT_MODE_VERSION,
    label: "通用",
    description: "日常问答、资料梳理、轻量排查和跨领域任务。",
    hint: "平衡准确性和简洁度，必要时再切换到专业模式。",
    eccRules: ["common", "rust"],
    skills: ["coding-standards", "verification-loop"],
    prompt: "你处于通用模式。先判断用户目标属于问答、代码、办公还是设计；若任务明显属于专业场景，按该场景的工作习惯组织答案，但不要擅自切换模式。保持回答直接、可执行，必要时指出下一步。",
  },
  coding: {
    version: CONSTANTS.DEFAULT_MODE_VERSION,
    label: "编程",
    description: "代码阅读、修复、重构、测试、构建和工程审查。",
    hint: "优先读上下文，改动小而准，完成后运行针对性验证。",
    eccRules: ["common", "rust", "typescript", "python"],
    skills: ["coding-standards", "tdd-workflow", "rust-patterns", "python-patterns", "api-design", "verification-loop", "error-handling"],
    prompt: "你处于编程模式。修改前先阅读相关上下文，优先沿用项目既有模式；代码注释优先英文且只解释非显然逻辑。实现后运行与风险匹配的验证，清楚报告改动、验证结果和残余风险。",
  },
  office: {
    version: CONSTANTS.OFFICE_MODE_VERSION,
    label: "办公",
    description: "文档、表格、PDF、PPT、报告、数据整理和格式转换。",
    hint: "关注结构、准确性、可交付文件和中文排版质量。",
    eccRules: ["common"],
    skills: ["officecli", "pdf", "pdf-extract", "md-to-pdf-cjk"],
    prompt: "你处于办公模式。优先明确输入文件、目标格式、输出位置和质量要求；OfficeCLI（Word/Excel/PPT）通过 MCP 工具注入时，优先使用 create/view/get/query/set/add/remove/move/validate/batch/merge/watch 等工具处理 Office 文档。交付前先 validate 检查质量，并通过 view issues 定位问题和自修复；PDF 仍使用 pdf、pdf-extract、md-to-pdf-cjk 等专项技能。",
  },
  design: {
    version: CONSTANTS.DEFAULT_MODE_VERSION,
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
function createInstallTempDir(prefix) {
  const dir = resolve(skillsRoot, `.${prefix}-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function findSkillPayloadRoot(dir, expectedName) {
  const directSkill = resolve(dir, "SKILL.md");
  if (existsSync(directSkill)) {
    return dir;
  }
  const candidates = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(dir, entry.name))
    .filter((candidate) => existsSync(resolve(candidate, "SKILL.md")));
  if (candidates.length === 1) {
    return candidates[0];
  }
  const named = candidates.find((candidate) => {
    const validation = validateSkillMarkdown(readFileSync(resolve(candidate, "SKILL.md"), "utf8"));
    return validation.ok && validation.name === expectedName;
  });
  return named || null;
}

function validateSkillDirForInstall(dir, expectedName) {
  const skillMd = resolve(dir, "SKILL.md");
  if (!existsSync(skillMd)) {
    return { ok: false, error: `skill directory must contain SKILL.md at its root: ${dir}` };
  }
  const validation = validateSkillMarkdown(readFileSync(skillMd, "utf8"));
  if (!validation.ok) return validation;
  if (validation.name !== expectedName) {
    return { ok: false, error: `SKILL.md name "${validation.name}" does not match install name "${expectedName}".` };
  }
  return { ok: true };
}

function installSkillDirectoryAtomic(name, srcDir, { overwrite = false } = {}) {
  const skillDir = resolve(skillsRoot, name);
  if (existsSync(skillDir) && !overwrite) {
    return {
      error: `skill already exists: ${skillDir}`,
      hint: "Pass overwrite: true only when replacing this skill is intentional.",
    };
  }

  const validation = validateSkillDirForInstall(srcDir, name);
  if (!validation.ok) {
    return { error: validation.error };
  }

  if (!existsSync(skillsRoot)) mkdirSync(skillsRoot, { recursive: true });
  const stagingDir = resolve(skillsRoot, `.${name}-stage-${randomUUID()}`);
  let backup = null;
  try {
    cpSync(srcDir, stagingDir, { recursive: true });
    const stagedValidation = validateSkillDirForInstall(stagingDir, name);
    if (!stagedValidation.ok) return { error: stagedValidation.error };

    if (existsSync(skillDir)) {
      backup = backupPathFor(skillDir);
      cpSync(skillDir, backup, { recursive: true });
      rmSync(skillDir, { recursive: true, force: true });
    }
    renameSync(stagingDir, skillDir);
    return {
      installed: true,
      name,
      path: skillDir,
      backup,
      hint: "新对话或 /new 后即可使用此 skill。",
    };
  } catch (err) {
    try { rmSync(stagingDir, { recursive: true, force: true }); } catch {}
    return { error: `install failed: ${err.message}` };
  }
}

function extractSkillArchive(sourcePath, destDir) {
  const result = process.platform === "win32"
    ? spawnSync(
        "powershell.exe",
        ["-NoProfile", "-Command", "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force", sourcePath, destDir],
        { encoding: "utf8", maxBuffer: CONSTANTS.MAX_UNZIP_BUFFER_BYTES }
      )
    : spawnSync("unzip", ["-o", sourcePath, "-d", destDir], { encoding: "utf8", maxBuffer: CONSTANTS.MAX_UNZIP_BUFFER_BYTES });
  if (result.error) return { error: result.error.message };
  if (result.status !== 0) {
    return { error: (result.stderr || result.stdout || `archive extraction exited with ${result.status}`).trim() };
  }
  return { ok: true };
}

tools.register({
  name: "install_skill",
  description: `安装或导入一个 Skill。支持三种方式:
1. name + body — 仅写入 SKILL.md，不含辅助文件。适合快速创建简单 skill。
2. name + source — 从 .skill 文件（ZIP 格式）解压安装。适合分发打包好的 skill。
3. name + source_dir — 从本地目录递归复制所有文件（含 scripts/、references/、templates/、README.md 等）。适合开发中的完整 skill 目录。
默认不会覆盖已有 Skill；需要替换时必须显式传 overwrite: true。Skill 安装后在新对话或 /new 后加载。`,
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
      overwrite: {
        type: "boolean",
        description: "是否允许覆盖同名已有 Skill。默认 false。",
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
    while (skillInstallTimes.length > 0 && now - skillInstallTimes[0] > CONSTANTS.SKILL_RATE_WINDOW_MS) {
      skillInstallTimes.shift();
    }
    if (skillInstallTimes.length >= CONSTANTS.SKILL_RATE_LIMIT) {
      return JSON.stringify({
        error: `rate limit: max ${CONSTANTS.SKILL_RATE_LIMIT} installs per minute. Please wait and retry.`,
      });
    }

    // P2-3: concurrency guard
    if (installingSkill) {
      return JSON.stringify({
        error: "another skill installation is in progress, please wait",
      });
    }

    // P2-3: body size cap
    if (args.body && typeof args.body === 'string' && args.body.length > CONSTANTS.MAX_BODY_SIZE) {
      return JSON.stringify({
        error: `body too large: ${args.body.length} bytes (max ${CONSTANTS.MAX_BODY_SIZE})`,
      });
    }

    const modes = ["body", "source", "source_dir"].filter((key) => args[key]);
    if (modes.length !== 1) {
      return JSON.stringify({
        error: "provide exactly one of: body (SKILL.md content), source (.skill/.zip file path), or source_dir (local directory path).",
      });
    }

    skillInstallTimes.push(now);
    installingSkill = true;
    try {
      const overwrite = Boolean(args.overwrite);

      if (args.body) {
        const body = String(args.body);
        const validation = validateSkillMarkdown(body);
        if (!validation.ok) return JSON.stringify({ error: validation.error });
        if (validation.name !== name) {
          return JSON.stringify({ error: `SKILL.md name "${validation.name}" does not match install name "${name}".` });
        }
        const sourceDir = createInstallTempDir(`${name}-body`);
        try {
          writeFileSync(resolve(sourceDir, "SKILL.md"), body, "utf8");
          return JSON.stringify(installSkillDirectoryAtomic(name, sourceDir, { overwrite }));
        } finally {
          try { rmSync(sourceDir, { recursive: true, force: true }); } catch {}
        }
      }

      if (args.source) {
        const src = String(args.source);
        if (!existsSync(src)) {
          return JSON.stringify({ error: `source file not found: ${src}` });
        }
        if (!src.endsWith(".skill") && !src.endsWith(".zip")) {
          return JSON.stringify({ error: `source must be a .skill or .zip file, got: ${src}` });
        }
        const srcStat = statSync(src);
        if (srcStat.size > CONSTANTS.MAX_ZIP_SIZE) {
          return JSON.stringify({
            error: `source file too large: ${srcStat.size} bytes (max ${CONSTANTS.MAX_ZIP_SIZE})`,
          });
        }
        const extractDir = createInstallTempDir(`${name}-extract`);
        const archivePath = src.endsWith(".skill") ? resolve(extractDir, `${name}.zip`) : src;
        try {
          if (src.endsWith(".skill")) await copyFile(src, archivePath);
          const extracted = extractSkillArchive(archivePath, extractDir);
          if (!extracted.ok) return JSON.stringify({ error: `extract failed: ${extracted.error}` });
          if (src.endsWith(".skill")) {
            try { await rm(archivePath, { force: true }); } catch {}
          }
          const payloadRoot = findSkillPayloadRoot(extractDir, name);
          if (!payloadRoot) {
            return JSON.stringify({
              error: "archive must contain SKILL.md at its root or in a single top-level skill directory.",
            });
          }
          return JSON.stringify(installSkillDirectoryAtomic(name, payloadRoot, { overwrite }));
        } finally {
          try { rmSync(extractDir, { recursive: true, force: true }); } catch {}
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
        const payloadRoot = findSkillPayloadRoot(srcDir, name);
        if (!payloadRoot) {
          return JSON.stringify({
            error: `source_dir must contain SKILL.md at its root or in a single top-level skill directory: ${srcDir}`,
            hint: "SKILL.md is required (with YAML frontmatter). See skill-creation-guide.md.",
          });
        }
        return JSON.stringify(installSkillDirectoryAtomic(name, payloadRoot, { overwrite }));
      }

      return JSON.stringify({
        error: "provide exactly one of: body (SKILL.md content), source (.skill/.zip file path), or source_dir (local directory path).",
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
  description: "保存一条用户明确要求记住、只应在当前工作场景生效的长期记忆。可记录当前场景的偏好、常用知识点、术语解释、流程或关键词关联；内容会按 work mode 独立存储，并在该场景的新对话提示词中注入。不要用它记录跨所有场景都应生效的身份信息或临时上下文。",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "精简后的场景记忆内容。可以是可执行的工作习惯，也可以是该场景常用知识点或关键词关联，不要原样粘贴长对话。",
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
    const text = compactText(args.text, CONSTANTS.MODE_MEMORY_TEXT_LIMIT);
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
      hint: "此记忆只影响当前工作场景的新对话提示词，不会写入全局长期记忆，也不会改写默认 mode prompt 或 ECC 规则。",
    });
  },
});
console.error(`[launcher] remember_mode_preference tool registered`);

// ── MCP servers ──────────────────────────────────────────────────
function hasOfficecliMcpSpec(specs) {
  return specs.some((rawSpec) => {
    const specText = String(rawSpec).trim();
    try {
      const spec = parseMcpSpec(specText);
      const commandName = basename(spec?.command ?? "").toLowerCase();
      return spec?.name === "officecli" || commandName === "officecli" || commandName === "officecli.exe";
    } catch {
      return specText.toLowerCase().includes("officecli");
    }
  });
}

function quoteMcpCommand(command) {
  return JSON.stringify(command);
}

function resolveBundledOfficecli() {
  const base = process.resourcesPath || __dirname;
  const rel = process.resourcesPath ? join("server", "officecli.exe") : "officecli.exe";
  const candidate = resolve(base, rel);
  return existsSync(candidate) ? candidate : null;
}

function autoOfficecliMcpSpec() {
  const bundled = resolveBundledOfficecli();
  if (bundled) return `officecli=${quoteMcpCommand(bundled)} mcp`;
  return null;
}

function effectiveMcpSpecs(cfg) {
  const manualSpecs = (cfg.mcp ?? []).map((spec) => String(spec).trim()).filter(Boolean);
  if (hasOfficecliMcpSpec(manualSpecs)) return manualSpecs;
  const autoSpec = autoOfficecliMcpSpec();
  if (!autoSpec) {
    console.error("[launcher] auto-MCP: bundled officecli.exe not found; configure config.mcp manually to use a PATH or custom OfficeCLI executable");
    return manualSpecs;
  }
  console.error(`[launcher] auto-MCP: officecli injected as ${autoSpec}`);
  return [...manualSpecs, autoSpec];
}

const mcpServers = [];
let mcpStartupPromise = null;

function startMcpInBackground() {
  if (mcpStartupPromise) return mcpStartupPromise;
  mcpStartupPromise = reloadMcp()
    .then((count) => {
      if (count > 0) console.error(`[launcher] ${count} MCP server(s) connected, ${tools.size} total tools`);
      return count;
    })
    .catch((err) => {
      console.error(`[launcher] MCP startup failed: ${err.message}`);
      return mcpServers.length;
    });
  return mcpStartupPromise;
}

async function reloadMcp() {
  const cfg = readConfig(configPath);
  const specs = effectiveMcpSpecs(cfg);
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
      const { registeredNames } = await bridgeMcpTools(client, { registry: tools });
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
function loadSoul() {
  try {
    if (existsSync(SOUL_HOME)) {
      const content = readFileSync(SOUL_HOME, "utf8").trim();
      if (content) return content;
    }
  } catch {}
  return readDefaultSoul();
}

// ── Mode system ────────────────────────────────────────────────
function mergeDefaultModes(modes) {
  const merged = Object.fromEntries(
    Object.entries(DEFAULT_MODES).map(([id, defaults]) => {
      const existing = modes?.[id];
      const source = existing?.version === defaults.version
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
    if (!existing || existing.version === DEFAULT_MODES[id].version) continue;
    migrated.push(id);
    backup[id] = existing;
  }
  return migrated.length > 0 ? { migrated, backup } : null;
}

function migrationTargetVersion(migration) {
  return Math.max(...migration.migrated.map((id) => DEFAULT_MODES[id]?.version ?? CONSTANTS.DEFAULT_MODE_VERSION));
}

function appendModePromptBackup(migration) {
  if (!migration) return;
  const targetVersion = migrationTargetVersion(migration);
  const backups = Array.isArray(config.modePromptBackups) ? config.modePromptBackups : [];
  backups.push({
    migratedAt: new Date().toISOString(),
    fromVersion: "legacy",
    toVersion: targetVersion,
    modes: migration.backup,
  });
  config.modePromptBackups = backups.slice(-5);
  config.modePromptMigration = {
    version: targetVersion,
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
    version: Number(mode?.version ?? fallback.version ?? CONSTANTS.DEFAULT_MODE_VERSION),
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

function safeModeId(modeId = config.mode || "general") {
  const raw = String(modeId || "general").trim();
  return /^[a-zA-Z0-9_-]{1,32}$/.test(raw) ? raw : "general";
}

function modeMemoryPath(modeId = config.mode || "general") {
  return resolve(modeMemoryDir, `${safeModeId(modeId)}.json`);
}

function compactText(value, max = CONSTANTS.MODE_MEMORY_TEXT_LIMIT) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeModeMemoryItem(item, index = 0) {
  const now = new Date().toISOString();
  const text = compactText(item?.text ?? item?.body ?? item?.summary ?? "");
  if (!text) return null;
  const keywords = Array.isArray(item?.keywords)
    ? item.keywords.map((k) => compactText(k, 32)).filter(Boolean).slice(0, CONSTANTS.MODE_MEMORY_KEYWORD_LIMIT)
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
  return { version: CONSTANTS.MODE_MEMORY_VERSION, mode, path, updatedAt: parsed?.updatedAt || null, items };
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
    .slice(0, CONSTANTS.MODE_MEMORY_ITEM_LIMIT);
  const data = { version: CONSTANTS.MODE_MEMORY_VERSION, mode, updatedAt: new Date().toISOString(), items };
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
    version: CONSTANTS.MODE_MEMORY_VERSION,
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
    .slice(0, CONSTANTS.MODE_MEMORY_PROMPT_LIMIT);
  if (items.length === 0) return "";
  const lines = items.map((item) => {
    const suffix = item.keywords.length ? ` [${item.keywords.join(", ")}]` : "";
    return `- ${compactText(item.text, CONSTANTS.MODE_MEMORY_TEXT_LIMIT)}${suffix}`;
  });
  return `\n\n# Current work mode memory\n\nThese are compact, user-approved memories for the current work mode. They may include scenario-specific preferences, recurring knowledge, terminology, workflows, and keyword associations. Apply them only in this work mode and only when relevant; they do not override the user's current explicit instructions, global identity, or ECC rules.\n\n${lines.join("\n")}`;
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
- When the user asks you to **remember** identity, name, or facts/preferences that should apply across all work modes → use remember with global scope unless it is clearly project-specific
- When the user asks to remember something for the current/active work mode, a named scenario (coding/office/design/general), or phrases it as "在当前场景/编程场景/办公场景/设计场景下记住" → use remember_mode_preference so it stays isolated to that work mode. This includes scenario-specific knowledge, terminology, workflows, keyword associations, and answering preferences.
- If the user says only "remember" while the content is obviously tied to the current work scenario rather than global identity or cross-mode preference, prefer remember_mode_preference and mention that it is scoped to the current work mode.
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
  const modelConfig = effectiveModelConfig();
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
  const VISION_MODELS = {
    "deepseek-v4-pro": { vision: true, visionDetail: "high" },
  };
  const visionCfg = VISION_MODELS[modelConfig.model] || {};
  return new CacheFirstLoop({
    client,
    prefix,
    tools,
    model: modelConfig.model,
    reasoningEffort: config.reasoningEffort ?? "max",
    autoEscalate: modelConfig.autoEscalate,
    vision: visionCfg.vision ?? false,
    visionDetail: visionCfg.visionDetail ?? "",
  });
}

let client = null;
let loop = null;

if (apiKey) {
  try {
    client = new DeepSeekClient({ apiKey, baseUrl });
    loop = buildLoop(client, workspaceDir);
    console.error(`[launcher] CacheFirstLoop created (model=${effectiveModelConfig().model}, effort=${config.reasoningEffort ?? "max"})`);
  } catch (err) {
    console.error(`[launcher] failed to create loop: ${err.message}`);
  }
}
if (client) refreshBalance();
setInterval(() => { if (client) refreshBalance(); }, CONSTANTS.BALANCE_REFRESH_MS);

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
let installingSkill = false;

// ── Messages store ──────────────────────────────────────────────
let nextMsgId = 1;
const messages = [];
function pushMessage(msg) {
  messages.push(msg);
  while (messages.length > CONSTANTS.MESSAGES_CAP) messages.shift();
}

// ── Active session autosave ─────────────────────────────────────
// The current conversation is incrementally saved to disk so that
// crashes or forced exits do not lose messages. The active file lives
// outside sessionsDir so it is never shown in the saved-sessions list.
const activeSessionFile = resolve(visionoxDataDir, "active-session.jsonl");
const activeSessionMetaFile = resolve(visionoxDataDir, "active-session.meta.json");

function hasUserMessage() {
  return messages.some((m) => m.role === "user");
}

async function appendActiveMessage(msg) {
  try {
    const record = { role: msg.role, content: msg.text ?? "" };
    await appendFile(activeSessionFile, `${JSON.stringify(record)}\n`, "utf8");
  } catch (err) {
    console.error(`[launcher] active-session append failed: ${err.message}`);
  }
}

async function finalizeActiveSession() {
  try {
    await access(activeSessionFile);
  } catch {
    return null;
  }
  try {
    const st = await fsStat(activeSessionFile);
    if (st.size === 0 || !hasUserMessage()) {
      await rm(activeSessionFile, { force: true });
      await rm(activeSessionMetaFile, { force: true });
      return null;
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const destFile = resolve(sessionsDir, `${ts}.jsonl`);
    const destMeta = resolve(sessionsDir, `${ts}.meta.json`);
    await rename(activeSessionFile, destFile);
    try {
      await rename(activeSessionMetaFile, destMeta);
    } catch {
      writeSessionMeta(ts, { messageCount: messages.length });
    }
    console.error(`[launcher] active session finalized: ${destFile}`);
    return ts;
  } catch (err) {
    console.error(`[launcher] failed to finalize active session: ${err.message}`);
    return null;
  }
}

async function clearActiveSession() {
  try {
    await rm(activeSessionFile, { force: true });
    await rm(activeSessionMetaFile, { force: true });
  } catch (err) {
    console.error(`[launcher] failed to clear active session: ${err.message}`);
  }
}

async function writeActiveSessionMeta() {
  try {
    const mode = config.mode || "general";
    const modeInfo = modeSummary(mode);
    const meta = {
      version: 1,
      mode,
      modeLabel: modeInfo.label,
      modeDescription: modeInfo.description,
      workspace: workspaceDir,
      messageCount: messages.length,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(activeSessionMetaFile, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  } catch (err) {
    console.error(`[launcher] failed to write active session meta: ${err.message}`);
  }
}

async function loadActiveSession() {
  try {
    await access(activeSessionFile);
  } catch {
    return false;
  }
  try {
    const raw = await readFile(activeSessionFile, "utf8");
    const entries = raw.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
    if (entries.length === 0) {
      await clearActiveSession();
      return false;
    }
    messages.length = 0;
    nextMsgId = 1;
    for (const entry of entries) {
      const role = entry.role === "tool" ? "tool" : entry.role;
      const id = role === "assistant" ? `assistant-${Date.now()}-${nextMsgId}` : `${role}-${nextMsgId}`;
      pushMessage({ id, role, text: entry.content || "" });
      nextMsgId++;
    }
    try {
      const metaRaw = await readFile(activeSessionMetaFile, "utf8");
      const meta = JSON.parse(metaRaw);
      applyModeForSessionMeta(meta);
    } catch {
      // ignore missing/broken meta
    }
    console.error(`[launcher] active session restored: ${entries.length} messages`);
    return true;
  } catch (err) {
    console.error(`[launcher] failed to load active session: ${err.message}`);
    await clearActiveSession();
    return false;
  }
}

function isValidSessionName(name) {
  return /^[\w.-]+$/.test(String(name || ""));
}

function sessionMetaPath(name) {
  if (!isValidSessionName(name)) throw new Error(`Invalid session name: ${name}`);
  return resolve(sessionsDir, `${name}.meta.json`);
}

function readSessionMeta(name) {
  try {
    const path = sessionMetaPath(name);
    if (!existsSync(path)) return {};
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessionMeta(name, patch = {}) {
  const path = sessionMetaPath(name);
  const current = readSessionMeta(name);
  const mode = config.mode || "general";
  const modeInfo = modeSummary(mode);
  const next = {
    version: 1,
    ...current,
    ...patch,
    mode,
    modeLabel: modeInfo.label,
    modeDescription: modeInfo.description,
    workspace: workspaceDir,
    savedAt: patch.savedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

function applyModeForSessionMeta(meta) {
  const modeId = typeof meta?.mode === "string" ? meta.mode : "";
  if (!modeId) return { changed: false, mode: config.mode || "general", skipped: "no mode metadata" };
  const modes = config.modes || DEFAULT_MODES;
  if (!modes[modeId]) return { changed: false, mode: config.mode || "general", skipped: `unknown mode: ${modeId}` };
  const previous = config.mode || "general";
  if (previous !== modeId) {
    ctx.setMode(modeId);
  }
  if (client) {
    loop = buildLoop(client, workspaceDir);
    ctx.loop = loop;
  }
  return { changed: previous !== modeId, mode: modeId, previous };
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
  getSkillEnvironmentStatus,
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
    syncRuntimeConfig({ ...config, preset: name });
    // Re-resolve through effectiveModelConfig so locked presets override
    // stale config.model values when switching live or rebuilding after /new.
    const modelConfig = effectiveModelConfig();
    loop?.configure({ model: modelConfig.model, autoEscalate: modelConfig.autoEscalate });
  },
  applyEffortLive: (effort) => {
    syncRuntimeConfig({ ...config, reasoningEffort: effort });
    loop?.configure({ reasoningEffort: effort });
    console.error(`[launcher] effort: ${effort}`);
  },
  applyModelLive: (m) => {
    syncRuntimeConfig({ ...config, model: m });
    // A manual model pick updates the auto baseline only; pro/flash presets stay
    // locked to their preset model to keep every UI surface consistent.
    const modelConfig = effectiveModelConfig();
    loop?.configure({ model: modelConfig.model, autoEscalate: modelConfig.autoEscalate });
    console.error(`[launcher] model: ${modelConfig.model}`);
  },
  setBudgetUsdLive: (usd) => { loop?.setBudget(usd); },

  reloadMcp,
  invokeMcpTool,
  repairSkillEnvironment: async () => {
    const bootstrap = await deployBootstrapSkills();
    const guide = await deploySkillGuide(workspaceDir);
    console.error(`[launcher] skill environment repaired`);
    return { repaired: true, bootstrap, guide, status: await getSkillEnvironmentStatus() };
  },

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
        ctx.loop = loop;
        refreshBalance();
        console.error(`[launcher] client & loop recreated with new credentials`);
      } else {
        client = null;
        loop = null;
        ctx.loop = loop;
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
      ctx.loop = loop;
      console.error(`[launcher] loop rebuilt for new workspace: ${workspaceDir}`);
    }

    // Deploy skill-creation-guide to new workspace
    await deploySkillGuide(workspaceDir);

    // P2-1: re-register MCP tools for new workspace
    await reloadMcp();

    console.error(`[launcher] workspace synced: ${workspaceDir}`);
  },

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
  submitPrompt: async (text, sessionName, images) => {
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

      // ── Session switch: archive current active session first ───
      if (sessionName && loop) {
        await finalizeActiveSession();
      }

      // ── Session resume: load historical messages ──────────────
      if (sessionName && loop) {
        // P2-7: validate sessionName to prevent path traversal
        if (!isValidSessionName(sessionName)) {
          return { accepted: false, reason: `Invalid session name: ${sessionName}. Use only alphanumeric, underscore, dot, or hyphen.` };
        }
        try {
          const sessionFile = resolve(sessionsDir, sessionName + ".jsonl");
          const sessionMeta = readSessionMeta(sessionName);
          const modeRestore = applyModeForSessionMeta(sessionMeta);
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
          // Seed active-session file with the resumed session so continued
          // conversation survives a crash/restart with full context.
          try {
            await writeFile(activeSessionFile, raw, "utf8");
            try {
              const metaRaw = readFileSync(resolve(sessionsDir, sessionName + ".meta.json"), "utf8");
              await writeFile(activeSessionMetaFile, metaRaw, "utf8");
            } catch {
              await writeActiveSessionMeta();
            }
          } catch (err) {
            console.error(`[launcher] failed to seed active session from ${sessionName}: ${err.message}`);
          }
          broadcastDashboardEvent({ kind: "messages-reset", messages: loaded, mode: modeRestore.mode, modeChanged: modeRestore.changed });
          console.error(`[launcher] session loaded: ${sessionName} (${entries.length} messages, mode: ${modeRestore.mode}${modeRestore.changed ? `, restored from ${modeRestore.previous}` : ""})`);
          if (!text || !text.trim()) {
            return { accepted: true, loaded: true, session: sessionName, mode: modeRestore.mode, modeChanged: modeRestore.changed };
          }
        } catch (err) {
          console.error(`[launcher] failed to load session ${sessionName}: ${err.message}`);
          return { accepted: false, reason: `Failed to load session: ${err.message}` };
        }
      }

      // Handle /new and /clear: finalize active session and reset
      if (text === "/new" || text === "/clear") {
        await finalizeActiveSession();
        // Reset the AI's internal context (CacheFirstLoop log)
        if (loop) loop.clearLog();
        // Clear session memories
        clearSessionMemories();
        // Rebuild loop to pick up mode/rules changes
        if (client) {
          loop = buildLoop(client, workspaceDir);
          ctx.loop = loop;
          console.error(`[launcher] loop rebuilt (mode: ${config.mode}, model=${effectiveModelConfig().model}, effort=${config.reasoningEffort ?? "max"})`);
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
        const welcomeMsg = { id: welcomeId, role: "assistant", text: "我是你的AI助手，我可以帮你原理图检查、脚本分析、光学数据采集、编辑文件、执行命令、搜索网络。直接告诉我要做什么吧。" };
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

      if (loop && images && images.length > 0) {
        loop.setPendingImages(images);
      }

      const userMsgId = String(nextMsgId++);
      pushMessage({ id: userMsgId, role: "user", text, images: images?.length ? images : undefined });
      appendActiveMessage({ role: "user", text });
      broadcastDashboardEvent({ kind: "user", id: userMsgId, text, images: images?.length ? images : undefined });

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
                const ectx = { model: ev.stats?.model ?? loop.model ?? effectiveModelConfig().model, prefixHash: "", reasoningEffort: loop.reasoningEffort ?? "max" };
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
            appendActiveMessage({ role: "assistant", text: assistantText });
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
    const balance = normalizedBalanceInfos();
    const balanceSupported = isDeepSeekApi(baseUrl);
    return {
      turns: s.turns,
      totalCostUsd: s.totalCostUsd,
      lastTurnCostUsd: s.lastTurnCostUsd,
      totalInputCostUsd: s.totalInputCostUsd,
      totalOutputCostUsd: s.totalOutputCostUsd,
      cacheHitRatio: s.cacheHitRatio,
      lastPromptTokens: s.lastPromptTokens,
      contextCapTokens: 65536,
      balanceSupported,
      balance,
      primaryBalance: primaryBalanceSummary(),
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
ctx.applyEffortLive(config.reasoningEffort ?? "max");

// ── Restore active session (crash recovery) ─────────────────────
const restoredActiveSession = await loadActiveSession();

// ── Initial welcome message ──────────────────────────────────────
if (!restoredActiveSession) {
  pushMessage({
    id: "welcome",
    role: "assistant",
    text: (apiKey ? "" : "⚠️ 未配置 API Key，请在 设置 → 模型服务 中配置后开始对话。\n\n")
      + "我是你的AI助手，我可以帮你原理图检查、脚本分析、光学数据采集、编辑文件、执行命令、搜索网络。直接告诉我要做什么吧。",
  });
}

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

  setImmediate(() => {
    startMcpInBackground();
  });

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
