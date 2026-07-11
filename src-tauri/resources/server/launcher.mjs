#!/usr/bin/env node
/**
 * Visionox-Whale — Server Launcher (v4)
 *
 * Full session context with all agent tools: filesystem, shell, web search,
 * memory, plan, choice, and todo.  The dashboard can chat, run tools, and
 * stream events — same capability set as the upstream agent.
 *
 * Usage: node launcher.mjs [--port <n>] [--token <hex>]
 */

try {
  process.stderr.write("[launcher] entered launcher.mjs\n");
} catch {}

async function importEarly(spec) {
  try {
    return await import(spec);
  } catch (err) {
    try {
      process.stderr.write(`[launcher] early import failed: ${spec}: ${err?.stack || err?.message || err}\n`);
    } catch {}
    throw err;
  }
}

const { resolve, dirname, join, basename, sep, extname } = await importEarly("node:path");
const { fileURLToPath, pathToFileURL } = await importEarly("node:url");
const { homedir } = await importEarly("node:os");
const { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync, appendFileSync, rmSync, cpSync, copyFileSync } = await importEarly("node:fs");
const { access, appendFile, copyFile, cp, readFile, readdir, rename, rm, stat: fsStat, writeFile } = await importEarly("node:fs/promises");
const { createHash, randomBytes, randomUUID } = await importEarly("node:crypto");
const { spawnSync } = await importEarly("node:child_process");
const { createInterface } = await importEarly("node:readline");

const {
  getActiveProvider,
  resolvePresetForProvider,
  resolveEffortForProvider,
  effectiveModelConfig,
  pickSummaryModel,
  buildLegacyProvider,
} = await importEarly("./lib/provider.mjs");
const { resolveContextPolicy } = await importEarly("./lib/context-cap.mjs");
const { requestToModal } = await importEarly("./lib/pause-gate-modal.mjs");
const { buildSystemPrompt, presentToolSpecsForMode, PROJECT_MEMORY_CANDIDATES } = await importEarly("./lib/system-prompt.mjs");
const { activeEntriesForDashboard, activeEntriesForModel, parseActiveSessionJsonl, serializeActiveSession } = await importEarly("./lib/active-session.mjs");
const { decidePlanContinuation } = await importEarly("./lib/plan-continuation.mjs");
const { isKnownPlanStep, isPlanComplete, normalizeCompletedStepIds } = await importEarly("./lib/plan-state-policy.mjs");
const { validateOfficecliInvocation } = await importEarly("./lib/officecli-policy.mjs");
const { buildBudgetedBlocks, buildMemoryIndex, memoryTokenBudgetForCapacity } = await importEarly("./lib/memory-prompt.mjs");
const { isMcpToolTimeout, mcpRecoveryError } = await importEarly("./lib/mcp-recovery.mjs");
const { getDlpConfig, prepareLocalDocument, resolveReadablePathForDlp, wrapReadFileToolWithDlp, wrapToolsPathArgsWithDlp } = await importEarly("./lib/dlp-file.mjs");

// NOTE: learn.mjs / learn-track.mjs are loaded lazily below so a missing
// resource file cannot brick the whole launcher startup.

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

// ── Lazy-loaded learn modules ─────────────────────────────────────
// These are loaded on demand so a missing file cannot break startup.
let learnModule = null;
let learnTrackModule = null;

async function loadLearnModule() {
  if (learnModule) return learnModule;
  try {
    learnModule = await import("./learn.mjs");
  } catch (err) {
    console.error(`[launcher] failed to load learn.mjs: ${err.message}`);
    learnModule = null;
  }
  return learnModule;
}

async function loadLearnTrackModule() {
  if (learnTrackModule) return learnTrackModule;
  try {
    learnTrackModule = await import("./learn-track.mjs");
  } catch (err) {
    console.error(`[launcher] failed to load learn-track.mjs: ${err.message}`);
    learnTrackModule = null;
  }
  return learnTrackModule;
}

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

  // Session memory sub-budgets — session memory is model-writable and volatile,
  // so cap per-entry body and the collective block to bound the system prompt.
  SESSION_MEMORY_BODY_MAX_CHARS: 2000,
  SESSION_MEMORY_BLOCK_MAX_CHARS: 6000,
  HIGH_PRIORITY_MEMORY_BLOCK_MAX_CHARS: 6000,
  PERSISTENT_MEMORY_INDEX_MAX_CHARS: 4000,

  // Rules sub-budget — coding mode can load ~100KB of rule files; cap the
  // collective rules block. Tail-drop (custom rules first to go) keeps each
  // rule file intact rather than truncating mid-rule.
  RULES_MAX_CHARS: 12000,

  // Mode versions
  DEFAULT_MODE_VERSION: 5,
  OFFICE_MODE_VERSION: 7,
};
const DEFAULT_SOUL_FALLBACK = `# Visionox-Whale Core Identity

## 我是谁
我是 Visionox-Whale，一个运行在 Windows 桌面环境中的 AI 助手。
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
const memoryTrashDir = resolve(visionoxDataDir, "memory-trash");
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

// ── Deploy ECC rules ───────────────────────────────────────────
// Copies bundled ECC rule packs from resources/ecc-rules/ to
// ~/.visionox/rules/ecc/ on first run or when resource packs are updated.
// Uses a version marker (.ecc-version) to detect resource changes; when the
// marker changes, all shipped packs are replaced wholesale. The user's custom
// directory (~/.visionox/rules) is never touched by this function.
const ECC_RULES_RESOURCE = resolve(__dirname, "..", "ecc-rules");
const ECC_RULES_HOME = resolve(visionoxDataDir, "rules", "ecc");
const ECC_VERSION_FILE = resolve(ECC_RULES_HOME, ".ecc-version");

function deployEccRules() {
  try {
    if (!existsSync(ECC_RULES_RESOURCE)) return;
    if (!existsSync(ECC_RULES_HOME)) mkdirSync(ECC_RULES_HOME, { recursive: true });

    // Version marker: content hash of all .md files in resource packs.
    // Stable across rebuilds (unlike mtime) — only changes when content changes.
    const resourceEntries = readdirSync(ECC_RULES_RESOURCE).filter(
      (e) => statSync(resolve(ECC_RULES_RESOURCE, e)).isDirectory()
    );
    const fingerprint = resourceEntries.map((e) => {
      const dir = resolve(ECC_RULES_RESOURCE, e);
      const files = readdirSync(dir).filter(f => f.endsWith(".md")).sort();
      const hashes = files.map(f => {
        try {
          return createHash("md5").update(readFileSync(resolve(dir, f))).digest("hex").slice(0, 8);
        } catch { return "?"; }
      }).join(",");
      return `${e}:${hashes}`;
    }).join("|");
    const lastVersion = existsSync(ECC_VERSION_FILE)
      ? readFileSync(ECC_VERSION_FILE, "utf8").trim()
      : "";
    const needsFullSync = lastVersion !== fingerprint;

    let deployed = 0;
    for (const entry of resourceEntries) {
      const srcDir = resolve(ECC_RULES_RESOURCE, entry);
      const dstDir = resolve(ECC_RULES_HOME, entry);
      if (needsFullSync || !existsSync(dstDir)) {
        // Full replace: remove old pack, copy fresh from resources
        if (existsSync(dstDir)) rmSync(dstDir, { recursive: true, force: true });
        cpSync(srcDir, dstDir, { recursive: true });
        deployed++;
      } else {
        // Same version — only copy any new files, preserve user edits
        for (const file of readdirSync(srcDir)) {
          const srcFile = resolve(srcDir, file);
          const dstFile = resolve(dstDir, file);
          if (!existsSync(dstFile) && statSync(srcFile).isFile()) {
            copyFileSync(srcFile, dstFile);
            deployed++;
          }
        }
      }
    }

    if (needsFullSync || deployed > 0) {
      writeFileSync(ECC_VERSION_FILE, fingerprint, "utf8");
      console.error(`[launcher] ECC rules: ${needsFullSync ? "full sync" : `${deployed} file(s)`} deployed to ${ECC_RULES_HOME}`);
    }
  } catch (err) {
    console.error(`[launcher] failed to deploy ECC rules: ${err.message}`);
  }
}

deployEccRules();

// ── Import server module ────────────────────────────────────────
const serverModUrl = distPath("server-XGDBRWMB.js");
console.error(`[launcher] importing ${serverModUrl}`);

let startDashboardServer;
try {
  ({ startDashboardServer } = await import(serverModUrl));
} catch (err) {
  console.error(`[launcher] server module import failed: ${err.message}`);
  process.stdout.write(JSON.stringify({ error: `server module import failed: ${err.message}` }) + "\n");
  process.exit(1);
}

// ── Import core modules ─────────────────────────────────────────
console.error(`[launcher] importing core modules...`);

let modules;
try {
  modules = await Promise.all([
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
    import(distPath("chunk-XCGGEJTI.js")),
    import(distPath("chunk-6PBZN4VI.js")),
    import(distPath("chunk-YQ6NTIIE.js")),
    import(distPath("chunk-PV55UMTO.js")),
    import(distPath("chunk-3BXRZFWS.js")),
  ]);
} catch (err) {
  console.error(`[launcher] chunk import failed: ${err.message}`);
  process.stdout.write(JSON.stringify({ error: `chunk import failed: ${err.message}` }) + "\n");
  process.exit(1);
}

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
  { registerShellTools, JobRegistry, pauseGate },
  { McpClient, parseMcpSpec, inspectMcpServer },
  { buildTransportFromSpec },
  { registerSemanticSearchTool },
  { applySkillsIndex, applyProjectMemory, listProjectMemoryPaths, readProjectMemories },
  { MemoryStore, effectivePriority },
  { registerSkillTools, Eventizer, autoResolveVerdict, shouldAutoResolveCheckpoint },
  { openEventSink, eventLogPath },
  { getLatestVersion, VERSION },
  { buildIndex, querySemantic, indexExists },
  { listSessions, loadSessionMessages, sessionPath, deleteSession },
  { DEEPSEEK_CONTEXT_TOKENS, DEFAULT_CONTEXT_TOKENS, DEEPSEEK_PRICING },
  { countTokens, estimateRequestTokens },
  { loadPlanState, savePlanState, clearPlanState, archivePlanState, listAllPlanArchives },
] = modules;

// ── Load config ─────────────────────────────────────────────────
loadDotenv();
const config = readConfig(configPath);

// ── Provider migration & helpers ───────────────────────────────
// Migrate legacy single-provider config (apiKey/baseUrl) to providers[] on first run.
{
  const legacy = buildLegacyProvider(config);
  if (legacy) {
    config.providers = legacy.providers;
    config.activeProviderId = legacy.activeProviderId;
    writeConfig(config, configPath);
    console.error("[launcher] migrated legacy apiKey/baseUrl to providers[0] (id=legacy)");
  }
}

// ── Semantic indexing: seed default intranet API config ──────────
// On first install (or when config.semantic is absent/incomplete), pre-fill
// the intranet OpenAI-compatible embedding API so the user can just click
// "Save" in the semantic panel without manual entry. Users can still override
// any field — the seed only fills missing values, never overwrites existing ones.
{
  const INTRANET_SEMANTIC_DEFAULTS = {
    provider: "openai-compat",
    openaiCompat: {
      baseUrl: "http://10.71.4.202:10307/v1/embeddings",
      apiKey: "qwen3-embedding-j29c7suqz",
      model: "Qwen3-Embedding",
      extraBody: {},
    },
  };

  let changed = false;
  if (!config.semantic || typeof config.semantic !== "object") {
    // First install: no semantic config at all — seed the full default.
    config.semantic = { ...INTRANET_SEMANTIC_DEFAULTS, ollama: { baseUrl: undefined, model: undefined } };
    changed = true;
  } else {
    // Existing config: only fill missing openai-compat fields so we never
    // overwrite a user's customisation. Also default provider to openai-compat
    // if unset (so "Save" without touching anything picks the intranet API).
    if (!config.semantic.provider) {
      config.semantic.provider = INTRANET_SEMANTIC_DEFAULTS.provider;
      changed = true;
    }
    if (!config.semantic.openaiCompat || typeof config.semantic.openaiCompat !== "object") {
      config.semantic.openaiCompat = {};
    }
    const oc = config.semantic.openaiCompat;
    if (!oc.baseUrl) { oc.baseUrl = INTRANET_SEMANTIC_DEFAULTS.openaiCompat.baseUrl; changed = true; }
    if (!oc.apiKey)  { oc.apiKey  = INTRANET_SEMANTIC_DEFAULTS.openaiCompat.apiKey;  changed = true; }
    if (!oc.model)   { oc.model   = INTRANET_SEMANTIC_DEFAULTS.openaiCompat.model;   changed = true; }
    if (!oc.extraBody || typeof oc.extraBody !== "object") { oc.extraBody = {}; }
  }
  if (changed) {
    writeConfig(config, configPath);
    console.error("[launcher] semantic config seeded with intranet defaults (openai-compat, Qwen3-Embedding)");
  }
}

let apiKey = loadApiKey();
let baseUrl = loadBaseUrl();

// ── Provider management functions — imported from ./lib/provider.mjs ──

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

async function writeBuiltinMarker(skillDir, name, sourceHash, sourceMtime) {
  const marker = {
    owner: "visionox-bootstrap",
    name,
    version: await readSkillVersion(skillDir),
    sourceHash,
    sourceMtime,
    installedAt: new Date().toISOString(),
  };
  writeFileSync(resolve(skillDir, "_visionox_builtin.json"), `${JSON.stringify(marker, null, 2)}\n`, "utf8");
}

function backupPathFor(target) {
  return `${target}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

// Source skill directories are build-time artifacts — their mtime doesn't change
// after install. Cache the hash in the marker keyed by source dir mtime so we
// can skip reading all source files on steady-state startup.
function sourceDirMtime(sourceDir) {
  try { return statSync(sourceDir).mtimeMs; } catch { return null; }
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
  const srcMtime = sourceDirMtime(sourceDir);
  if (existsSync(targetDir)) {
    const marker = await readBuiltinMarker(targetDir);
    if (!marker) {
      return { name, installed: false, skipped: true, reason: "user skill with same name exists" };
    }
    // Fast path: source dir unchanged since last install → reuse cached hash.
    let sourceHash;
    if (!force && srcMtime !== null && marker.sourceMtime === srcMtime && marker.sourceHash) {
      sourceHash = marker.sourceHash;
    } else {
      sourceHash = await hashDirectory(sourceDir);
    }
    const currentHash = marker.sourceHash || await hashDirectory(targetDir);
    if (!force && currentHash === sourceHash) {
      return { name, installed: false, skipped: true, reason: "already up to date" };
    }
    const backupDir = backupPathFor(targetDir);
    await cp(targetDir, backupDir, { recursive: true });
    await rm(targetDir, { recursive: true, force: true });
    await cp(sourceDir, targetDir, { recursive: true });
    await writeBuiltinMarker(targetDir, name, sourceHash, srcMtime);
    return { name, installed: true, upgraded: true, backup: backupDir, path: targetDir };
  }
  const sourceHash = await hashDirectory(sourceDir);
  await cp(sourceDir, targetDir, { recursive: true });
  await writeBuiltinMarker(targetDir, name, sourceHash, srcMtime);
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

const startupModelConfig = effectiveModelConfig(config);
console.error(`[launcher] apiKey ${apiKey ? "found" : "NOT FOUND — chat will be disabled"}, preset=${startupModelConfig.preset}, model=${startupModelConfig.model}`);

// ESM live bindings let ContextManager and dashboard stats share this runtime
// map. Rebuild it from the active provider snapshot so reused model IDs cannot
// retain a capacity from an older JSON import or another provider.
const runtimeContextCapModels = new Set();
let activeContextPolicy = null;

function contextPolicyFor(model, cfg = config) {
  return resolveContextPolicy(model, cfg, getActiveProvider(cfg), DEFAULT_CONTEXT_TOKENS);
}

function applyContextCap(model, cfg = config) {
  const policy = contextPolicyFor(model, cfg);
  DEEPSEEK_CONTEXT_TOKENS[model] = policy.effectiveCap;
  runtimeContextCapModels.add(model);
  return policy;
}

function rebuildProviderContextCaps(cfg = config) {
  for (const model of runtimeContextCapModels) delete DEEPSEEK_CONTEXT_TOKENS[model];
  runtimeContextCapModels.clear();
  const provider = getActiveProvider(cfg);
  for (const model of provider?.models ?? []) applyContextCap(model.id, cfg);
  const effective = effectiveModelConfig(cfg);
  const policy = applyContextCap(effective.model, cfg);
  activeContextPolicy = policy;
  console.error(`[launcher] context capacity refreshed: provider=${policy.providerId ?? "none"}, model=${policy.model}, cap=${policy.effectiveCap}, source=${policy.source}, declaredSource=${policy.capacitySource}${policy.clamped ? ", userLimitClamped=true" : ""}`);
  return policy;
}
rebuildProviderContextCaps(config);
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
  wrapReadFileToolWithDlp(tools, {
    readConfig: () => readConfig(configPath),
    env: { homeDir: home, projectRoot: resolve(__dirname, "..", "..", ".."), serverDir: __dirname, rootDir },
    logger: console,
  });

  tools.register({
    name: "prepare_local_document",
    description: "Prepare a user-provided local document path before reading/parsing it. Use this FIRST for local PDF/Word/Excel/PPT/XML/DSN/text/image files, odd Chinese filenames, wildcard paths, or when another document reader fails. It fixes common Windows path typos such as D:_folder, resolves one matching local file, and returns readablePath for the next parser. Do not explain internal path preparation details to the user.",
    parameters: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "The raw user path, wildcard, or full user sentence containing a local document path.",
        },
        allowMultiple: {
          type: "boolean",
          description: "Return candidate list instead of error when multiple files match. Default false.",
        },
      },
      required: ["input"],
    },
    fn: async (args, toolCtx) => JSON.stringify(await prepareLocalDocument(args?.input ?? args, {
      cfg: readConfig(configPath),
      env: { homeDir: home, projectRoot: resolve(__dirname, "..", "..", ".."), serverDir: __dirname, rootDir },
      logger: console,
      allowMultiple: Boolean(args?.allowMultiple),
      signal: toolCtx?.signal,
    })),
  });

  registerShellTools(tools, {
    rootDir,
    extraAllowed: () => loadProjectShellAllowed(rootDir, configPath),
    allowAll: () => loadEditMode(configPath) === "yolo" || loadEditMode(configPath) === "admin",
    jobs,
    getOperationId: opts.getOperationId,
  });
  wrapToolsPathArgsWithDlp(tools, ["run_command", "run_background"], {
    readConfig: () => readConfig(configPath),
    env: { homeDir: home, projectRoot: resolve(__dirname, "..", "..", ".."), serverDir: __dirname, rootDir },
    logger: console,
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

tools.setToolInterceptor((name, args) => {
  const issue = validateOfficecliInvocation(name, args);
  return issue ? JSON.stringify(issue) : undefined;
});

// Workspace-dependent tools — registered via shared function
const wsResult = await registerWorkspaceTools(tools, workspaceDir, { jobs, getOperationId: () => activeOperation?.id ?? null });
wsToolNames = wsResult.toolNames;
hasSemanticSearch = wsResult.hasSemantic;

// Shell edit mode — default to admin on first run
if (!config.editMode) {
  config.editMode = "admin";
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
    eccRules: ["common"],
    skills: [
      "coding-standards", "verification-loop", "andrej-karpathy-guidelines",
      "brainstorming", "writing-plans", "executing-plans", "search-first",
      "context-budget", "verification-before-completion", "using-superpowers",
      "dispatching-parallel-agents", "subagent-driven-development",
      "requesting-code-review", "receiving-code-review",
      "finishing-a-development-branch", "using-git-worktrees",
      "production-audit", "file-access-rescue", "basic-skill-example", "skill-creation-guide", "writing-skills",
    ],
    prompt: "你处于通用模式。先判断用户目标属于问答、代码、办公还是设计；若任务明显属于专业场景，按该场景的工作习惯组织答案，但不要擅自切换模式。保持回答直接、可执行，必要时指出下一步。系统内置 22 种语言的 ECC 编码规范（angular/cpp/go/java/swift/vue 等），可在工作模式配置中按需启用。",
  },
  coding: {
    version: CONSTANTS.DEFAULT_MODE_VERSION,
    label: "编程",
    description: "代码阅读、修复、重构、测试、构建和工程审查。",
    hint: "优先读上下文，改动小而准，完成后运行针对性验证。",
    eccRules: ["common", "rust", "typescript", "python"],
    skills: [
      "coding-standards", "andrej-karpathy-guidelines", "tdd-workflow",
      "rust-patterns", "python-patterns", "api-design", "verification-loop",
      "error-handling", "git-workflow", "systematic-debugging", "security-review",
      "database-migrations", "test-driven-development", "codebase-onboarding",
      "docker-patterns", "fastapi-patterns", "postgres-patterns",
      "requesting-code-review", "receiving-code-review", "production-audit",
    ],
    prompt: "你处于编程模式。修改前先阅读相关上下文，优先沿用项目既有模式；代码注释优先英文且只解释非显然逻辑。实现后运行与风险匹配的验证，清楚报告改动、验证结果和残余风险。",
  },
  office: {
    version: CONSTANTS.OFFICE_MODE_VERSION,
    label: "办公",
    description: "文档、表格、PDF、PPT、报告、数据整理和格式转换。",
    hint: "关注结构、准确性、可交付文件和中文排版质量。",
    eccRules: ["common"],
    skills: ["file-access-rescue", "officecli", "pdf", "md-to-pdf-cjk"],
    prompt: "你处于办公模式。处理任何本地文档路径（PDF/Word/Excel/PPT/XML/DSN/文本/图片等）时，先调用 prepare_local_document，把用户原始路径或完整句子交给它，后续只使用返回的 readablePath 交给 officecli、pdf 或 read_file 等工具。不要先安装依赖、写临时解析脚本、复制源文件到工作区或搜索旧提取产物。OfficeCLI（Word/Excel/PPT）通过 MCP 工具注入时，优先使用 create/view/get/query/set/add/remove/move/validate/batch/merge/watch 等工具处理 Office 文档。PDF 也先准备本地文档，再使用 pdf/officecli 等专项工具。交付前先 validate 检查质量，并通过 view issues 定位问题和自修复。",
  },
  design: {
    version: CONSTANTS.DEFAULT_MODE_VERSION,
    label: "设计",
    description: "界面体验、前端布局、视觉风格、交互状态和可用性优化。",
    hint: "先服务真实工作流，再处理视觉细节和状态反馈。",
    eccRules: ["common", "web"],
    skills: ["frontend-patterns", "e2e-testing", "react-patterns", "context-budget"],
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
registerPlanTool(tools, {
  onPlanSubmitted: (plan, steps, summary) => {
    // Stash the plan in memory; it will be persisted on the first
    // mark_step_complete call (i.e., after the user approves and AI
    // starts executing). If the user cancels, onStepCompleted is never
    // called so nothing hits disk — matching TUI behaviour.
    pendingPlan = {
      steps: Array.isArray(steps) ? steps : [],
      summary,
      body: plan,
    };
  },
  onStepCompleted: (update) => {
    // Non-dashboard confirmation gates can approve plans without passing
    // through resolvePlanConfirm, so keep this activation fallback.
    if (pendingPlan) activatePendingPlan();
    if (!isKnownPlanStep(activePlanSteps, update?.stepId)) {
      throw new Error(`mark_step_complete: stepId "${update?.stepId ?? ""}" is not in the active plan.`);
    }
    const checkpointTotal = activePlanSteps?.length ?? 0;
    const completedIds = normalizeCompletedStepIds(activePlanSteps, [...(activeCompletedIds ?? [])]);
    const checkpointCompleted = completedIds.includes(update.stepId)
      ? completedIds.length
      : completedIds.length + 1;
    if (update?.stepId && activeCompletedIds) {
      markStepDone(update.stepId);
    }
    // Notify dashboard that a step was completed (for live UI updates).
    if (update?.stepId) {
      broadcastDashboardEvent({
        kind: "plan-step-complete",
        stepId: update.stepId,
        result: update.result,
        title: update.title,
        completed: checkpointCompleted,
        total: checkpointTotal,
      });
    }
    return { completed: checkpointCompleted, total: checkpointTotal };
  },
  onPlanRevisionProposed: (reason, remainingSteps, summary) => {
    pendingPlanRevision = { reason, remainingSteps, summary };
  },
});
registerChoiceTool(tools);
registerTodoTool(tools, {
  onTodosUpdated: (todos) => broadcastDashboardEvent({ kind: "todo-update", todos })
});

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

// ── Session history service ─────────────────────────────────────
const SESSION_SEARCH_MAX_LIMIT = 200;
const SESSION_CLEANUP_PREVIEW_TTL_MS = 30 * 60 * 1000;
const SESSION_TRASH_DIR = resolve(visionoxDataDir, "session-trash");
const sessionCleanupPreviews = new Map();

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function parseDateFilter(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeSessionMessages(name) {
  try {
    return loadSessionMessages(name);
  } catch {
    return [];
  }
}

function compactMessageText(message, max = 180) {
  const content = typeof message?.content === "string" ? message.content : JSON.stringify(message?.content ?? "");
  const text = content.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function summarizeSessionMessages(messages, meta = {}) {
  if (typeof meta.summary === "string" && meta.summary.trim()) return meta.summary.trim();
  const firstUser = messages.find((m) => m?.role === "user" && compactMessageText(m));
  const firstAssistant = messages.find((m) => m?.role === "assistant" && compactMessageText(m));
  const source = firstUser || firstAssistant || messages.find((m) => compactMessageText(m));
  return source ? compactMessageText(source) : "";
}

function buildSessionSearchText(session, messages = []) {
  const meta = session.meta || {};
  const sampled = [
    ...messages.slice(0, 8),
    ...messages.slice(Math.max(0, messages.length - 8)),
  ].map((m) => compactMessageText(m, 320));
  return [
    session.name,
    meta.summary,
    meta.workspace,
    meta.mode,
    meta.modeLabel,
    ...sampled,
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function describeSession(session, messages = null, { includePreview = true } = {}) {
  const loaded = Array.isArray(messages) ? messages : [];
  const meta = session.meta || {};
  const out = {
    name: session.name,
    messageCount: session.messageCount,
    lastActive: session.mtime instanceof Date ? session.mtime.toISOString() : new Date(session.mtime).toISOString(),
    workspace: meta.workspace || null,
    mode: meta.mode || null,
    modeLabel: meta.modeLabel || null,
    summary: Array.isArray(messages) ? summarizeSessionMessages(loaded, meta) : (meta.summary || null),
  };
  if (includePreview && Array.isArray(messages)) {
    out.preview = loaded.slice(-5).map((m) => ({
      role: m?.role || "unknown",
      content: compactMessageText(m, 220),
    }));
  }
  return out;
}

function searchSessions(args = {}) {
  const limit = clampNumber(args.limit, 1, SESSION_SEARCH_MAX_LIMIT, 50);
  const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
  const terms = query.split(/\s+/).filter(Boolean);
  const since = parseDateFilter(args.since);
  const until = parseDateFilter(args.until);
  const minMessages = Number.isFinite(args.minMessages) ? Math.max(0, Math.floor(args.minMessages)) : null;
  const maxMessages = Number.isFinite(args.maxMessages) ? Math.max(0, Math.floor(args.maxMessages)) : null;
  const workspace = typeof args.workspace === "string" && args.workspace.trim() ? args.workspace.trim().toLowerCase() : "";
  const mode = typeof args.mode === "string" && args.mode.trim() ? args.mode.trim().toLowerCase() : "";
  const includePreview = args.includePreview !== false;
  const results = [];
  let scanned = 0;

  for (const session of listSessions()) {
    scanned++;
    if (since && session.mtime < since) continue;
    if (until && session.mtime > until) continue;
    if (minMessages !== null && session.messageCount < minMessages) continue;
    if (maxMessages !== null && session.messageCount > maxMessages) continue;
    const meta = session.meta || {};
    if (workspace && !String(meta.workspace || "").toLowerCase().includes(workspace)) continue;
    if (mode && String(meta.mode || meta.modeLabel || "").toLowerCase() !== mode) continue;

    let messages = null;
    if (terms.length > 0 || includePreview) messages = safeSessionMessages(session.name);
    if (terms.length > 0) {
      const haystack = buildSessionSearchText(session, messages).toLowerCase();
      if (!terms.every((term) => haystack.includes(term))) continue;
    }
    results.push(describeSession(session, messages, { includePreview }));
    if (results.length >= limit) break;
  }
  return { scanned, count: results.length, sessions: results };
}

function classifyCleanupCandidate(session, messages) {
  const messageCount = messages.length || session.messageCount || 0;
  const meta = session.meta || {};
  const text = buildSessionSearchText(session, messages);
  const lower = text.toLowerCase();
  const short = messageCount <= 4;
  const veryShort = messageCount <= 2;
  const valuable = /(客户|需求|项目|代码|脚本|文件|ppt|word|excel|pdf|readme|方案|认证|测试计划|debug|构建|打包|优化|源码)/i.test(text);

  if (valuable && messageCount >= 2) {
    return { category: "valuable", action: "keep", confidence: 0.82, reason: "包含项目、文件、代码或需求相关信息，建议保留" };
  }

  if (messageCount === 0 || !text.trim()) {
    return { category: "empty", action: "delete", confidence: 0.98, reason: "空会话或无法读取有效消息" };
  }
  if (short && /整理聊天记录|聊天记录整理|清理聊天|清理检查报告|delete_session|session cleanup|session_cleanup/.test(lower)) {
    return { category: "cleanup_task", action: "delete", confidence: 0.95, reason: "历史会话整理任务自产的短记录" };
  }
  if (veryShort && /(天气|weather|气温|预报)/i.test(text) && !valuable) {
    return { category: "light_query", action: "archive", confidence: 0.88, reason: "轻量查询类短会话，建议归档而不是直接删除" };
  }
  if (short && /(test-summary\.md|hello\.py|创建.*测试|测试运行|通信测试|授权卡片测试)/i.test(text)) {
    return { category: "test_run", action: "archive", confidence: 0.86, reason: "重复功能测试或临时测试会话，建议归档" };
  }
  if (messageCount >= 5 && /(总结|方案|建议|计划|修复|实现|落地|复盘|报告)/i.test(text)) {
    return { category: "knowledge", action: "extract", confidence: 0.78, reason: "可能包含可沉淀的项目知识，建议提炼" };
  }
  if (veryShort && !meta.summary && text.length < 120) {
    return { category: "tiny_no_summary", action: "archive", confidence: 0.68, reason: "内容极短且无摘要，建议人工复核后归档" };
  }
  return null;
}

function cleanupRecommendationCounts(items) {
  const counts = { delete: 0, archive: 0, keep: 0, extract: 0, review: 0 };
  for (const item of items || []) {
    const action = item?.action || "review";
    counts[action] = (counts[action] || 0) + 1;
  }
  return counts;
}

function normalizeSemanticCleanupMode(value) {
  return ["off", "uncertain", "deep"].includes(value) ? value : "off";
}

async function semanticReviewCleanupItems(items, semanticMode = "off", signal) {
  const mode = normalizeSemanticCleanupMode(semanticMode);
  if (mode === "off" || !client || !items.length) return { items, reviewed: 0, error: null };
  const reviewable = mode === "deep"
    ? items.slice(0, 60)
    : items.filter((item) => item.confidence < 0.86 || item.action === "archive" || item.action === "extract").slice(0, 24);
  if (reviewable.length === 0) return { items, reviewed: 0, error: null };

  const payload = reviewable.map((item) => ({
    name: item.name,
    messageCount: item.messageCount,
    currentAction: item.action,
    category: item.category,
    confidence: item.confidence,
    reason: item.reason,
    preview: item.preview,
  }));
  const prompt = [
    "你是 Visionox-Whale 的历史会话整理器。请只基于给定预览判断每个会话的整理建议。",
    "可选 action 只有 delete、archive、keep、extract：",
    "- delete：空会话、系统自产清理记录、明显无价值且可放入回收站的记录。",
    "- archive：低价值但不应直接删除的临时查询或测试记录。",
    "- keep：包含项目、客户、需求、文件、代码、决策、问题排查等用户可能回看的信息。",
    "- extract：包含可沉淀为长期记忆或知识的内容。",
    "宁可 keep，也不要误删。返回严格 JSON 数组，不要 Markdown，不要解释。",
    JSON.stringify(payload),
  ].join("\n\n");
  try {
    const modelConfig = effectiveModelConfig(config);
    const resp = await client.chat({
      model: modelConfig.model,
      messages: [
        { role: "system", content: "你只返回 JSON 数组，每项包含 name, action, confidence, reason。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 4000,
      signal,
    });
    const raw = String(resp?.content || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("semantic review did not return an array");
    const byName = new Map(parsed.map((item) => [String(item.name || ""), item]));
    const next = items.map((item) => {
      const update = byName.get(item.name);
      if (!update || !["delete", "archive", "keep", "extract"].includes(update.action)) return item;
      return {
        ...item,
        action: update.action,
        confidence: Number.isFinite(update.confidence) ? Math.max(0, Math.min(1, Number(update.confidence))) : item.confidence,
        reason: typeof update.reason === "string" && update.reason.trim() ? update.reason.trim().slice(0, 240) : item.reason,
        semanticReviewed: true,
      };
    });
    return { items: next, reviewed: reviewable.length, error: null };
  } catch (err) {
    console.error(`[launcher] session cleanup semantic review failed: ${err.message}`);
    return { items, reviewed: 0, error: err.message };
  }
}

function softDeleteSession(name, runId = "") {
  if (!isValidSessionName(name)) return { ok: false, error: "invalid session name" };
  const jsonl = sessionPath(name);
  if (!existsSync(jsonl)) return { ok: false, error: "not found" };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const trashDir = resolve(SESSION_TRASH_DIR, `${stamp}-${runId || randomUUID()}`);
  mkdirSync(trashDir, { recursive: true });
  const moved = [];
  const sidecars = [".jsonl", ".events.jsonl", ".pending.json", ".meta.json", ".plan.json"];
  try {
    for (const ext of sidecars) {
      const source = ext === ".jsonl" ? jsonl : jsonl.replace(/\.jsonl$/, ext);
      if (!existsSync(source)) continue;
      const target = resolve(trashDir, basename(source));
      renameSync(source, target);
      moved.push(target);
    }
    writeFileSync(resolve(trashDir, "trash-meta.json"), `${JSON.stringify({ name, movedAt: new Date().toISOString(), files: moved.map((p) => basename(p)) }, null, 2)}\n`, "utf8");
    return { ok: true, trashDir, moved };
  } catch (err) {
    return { ok: false, error: err.message, trashDir, moved };
  }
}

function pruneExpiredCleanupPreviews() {
  const now = Date.now();
  for (const [id, preview] of sessionCleanupPreviews) {
    if (now - preview.createdMs > SESSION_CLEANUP_PREVIEW_TTL_MS) {
      sessionCleanupPreviews.delete(id);
    }
  }
}

async function buildSessionCleanupPreview(args = {}, options = {}) {
  pruneExpiredCleanupPreviews();
  const scanLimit = clampNumber(args.scanLimit ?? args.limit, 1, 1000, 200);
  const returnLimit = clampNumber(args.returnLimit, 1, 200, Math.min(80, scanLimit));
  const minConfidence = Number.isFinite(args.minConfidence) ? Math.max(0, Math.min(1, Number(args.minConfidence))) : 0.8;
  const includeReview = args.includeReview === true;
  const semanticMode = normalizeSemanticCleanupMode(args.semanticMode);
  const categories = Array.isArray(args.categories) && args.categories.length > 0
    ? new Set(args.categories.map((c) => String(c)))
    : null;
  const recommendations = [];
  const review = [];
  let scanned = 0;

  for (const session of listSessions()) {
    throwIfScheduleAborted(options.signal);
    if (scanned >= scanLimit) break;
    scanned++;
    const messages = safeSessionMessages(session.name);
    const hit = classifyCleanupCandidate(session, messages);
    if (!hit || (categories && !categories.has(hit.category))) continue;
    const item = {
      ...describeSession(session, messages, { includePreview: true }),
      category: hit.category,
      action: hit.action,
      confidence: hit.confidence,
      reason: hit.reason,
      semanticReviewed: false,
    };
    if (hit.confidence >= minConfidence || hit.action === "keep" || hit.action === "extract") recommendations.push(item);
    else if (includeReview) review.push(item);
  }

  const semantic = await semanticReviewCleanupItems(recommendations, semanticMode, options.signal);
  throwIfScheduleAborted(options.signal);
  const reviewedRecommendations = semantic.items;
  const returnedCandidates = reviewedRecommendations.slice(0, returnLimit);
  const counts = cleanupRecommendationCounts(returnedCandidates);
  const cleanupId = randomUUID();
  const preview = {
    cleanupId,
    createdAt: new Date().toISOString(),
    createdMs: Date.now(),
    scanned,
    candidateCount: reviewedRecommendations.length,
    returnedCandidateCount: returnedCandidates.length,
    minConfidence,
    semanticMode,
    semanticReviewed: semantic.reviewed,
    semanticError: semantic.error,
    recommendationCounts: counts,
    categories: [...new Set(reviewedRecommendations.map((c) => c.category))],
    candidates: returnedCandidates,
    review: includeReview ? review.slice(0, Math.max(0, returnLimit - returnedCandidates.length)) : [],
  };
  sessionCleanupPreviews.set(cleanupId, {
    createdMs: preview.createdMs,
    candidates: returnedCandidates,
  });
  return preview;
}

function applySessionCleanup({ cleanupId, names, confirm = false } = {}) {
  pruneExpiredCleanupPreviews();
  if (confirm !== true) {
    return { ok: false, error: "confirm must be true. 只有在用户明确确认后才能删除会话。" };
  }
  let requested = [];
  if (cleanupId) {
    const preview = sessionCleanupPreviews.get(String(cleanupId));
    if (!preview) return { ok: false, error: "cleanup preview expired or not found" };
    requested = preview.candidates.filter((c) => c.action === "delete").map((c) => c.name);
  } else if (Array.isArray(names)) {
    requested = names.map((n) => String(n).trim()).filter(Boolean);
  }
  requested = [...new Set(requested)].filter(isValidSessionName);
  if (requested.length === 0) return { ok: false, error: "no valid session names to delete" };

  const existing = new Set(listSessions().map((s) => s.name));
  const deleted = [];
  const failed = [];
  for (const name of requested) {
    if (!existing.has(name)) {
      failed.push({ name, error: "not found" });
      continue;
    }
    const moved = softDeleteSession(name, String(cleanupId || "manual").slice(0, 8));
    if (moved.ok) deleted.push({ name, trashDir: moved.trashDir });
    else failed.push({ name, error: moved.error || "move to trash failed" });
  }
  console.error(`[launcher] session cleanup moved_to_trash=${deleted.length} failed=${failed.length}`);
  if (deleted.length > 0) broadcastDashboardEvent({ kind: "sessions-changed", action: "cleanup", count: deleted.length });
  return { ok: failed.length === 0, deleted, failed, deletedCount: deleted.length, failedCount: failed.length, trashRoot: SESSION_TRASH_DIR };
}

function summarizeSessionCleanup(preview, result = null) {
  const candidateCount = preview?.candidateCount ?? 0;
  const scanned = preview?.scanned ?? 0;
  const counts = preview?.recommendationCounts || {};
  const detail = `删除 ${counts.delete || 0} / 归档 ${counts.archive || 0} / 保留 ${counts.keep || 0} / 提炼 ${counts.extract || 0}`;
  if (result) {
    return `扫描 ${scanned} 个会话，生成 ${candidateCount} 条整理建议（${detail}），已移入回收站 ${result.deletedCount || 0} 个，失败 ${result.failedCount || 0} 个。`;
  }
  return `扫描 ${scanned} 个会话，生成 ${candidateCount} 条整理建议（${detail}），尚未移动任何会话。`;
}

// ── Session history tools ───────────────────────────────────────
tools.register({
  name: "list_sessions",
  description: "列出用户的历史对话会话。返回每个会话的名称、消息数、最后活跃时间、工作区、模式、摘要等元信息。当用户要求查找、回顾或总结历史对话记录时应优先调用此工具。",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "number", description: "最多返回多少个会话，默认 50" },
    },
  },
  fn: async (args) => {
    const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 50;
    const sessions = listSessions().slice(0, limit);
    return JSON.stringify({
      count: sessions.length,
      sessions: sessions.map((s) => ({
        name: s.name,
        messageCount: s.messageCount,
        lastActive: s.mtime.toISOString(),
        workspace: s.meta?.workspace || null,
        mode: s.meta?.mode || null,
        summary: s.meta?.summary || null,
      })),
    });
  },
});

tools.register({
  name: "read_session",
  description: "读取指定历史会话的消息内容。参数 name 来自 list_sessions。为避免 token 过多，默认只返回最近 200 条消息；如需更多可传入 limit。当用户要求查看某个历史会话的具体内容时调用。",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "会话名称" },
      limit: { type: "number", description: "最多返回最近多少条消息，默认 200" },
    },
    required: ["name"],
  },
  fn: async (args) => {
    const name = String(args.name ?? "").trim();
    if (!name) return JSON.stringify({ error: "name is required" });
    const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 200;
    const messages = loadSessionMessages(name);
    if (messages.length === 0) return JSON.stringify({ error: `session not found or empty: ${name}` });
    const trimmed = messages.slice(-limit);
    const text = trimmed.map((m) => {
      const role = m.role || "unknown";
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
      return `[${role}] ${content}`;
    }).join("\n\n");
    const MAX_CHARS = 30_000;
    return JSON.stringify({
      name,
      totalMessages: messages.length,
      returnedMessages: trimmed.length,
      truncated: text.length > MAX_CHARS,
      transcript: text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n\n...[内容已截断]" : text,
    });
  },
});

tools.register({
  name: "search_sessions",
  description: "搜索历史对话会话。当用户要求查找、整理、回顾、总结、提炼历史对话时，优先使用此工具；不要猜测会话文件路径，也不要用 shell 到磁盘乱找。支持关键词、时间范围、消息数、工作区和模式过滤。",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "关键词，可包含多个词；全部词都需命中" },
      since: { type: "string", description: "起始时间或日期，例如 2026-07-01" },
      until: { type: "string", description: "结束时间或日期，例如 2026-07-07" },
      minMessages: { type: "number", description: "最少消息数" },
      maxMessages: { type: "number", description: "最多消息数" },
      workspace: { type: "string", description: "工作区路径关键词" },
      mode: { type: "string", description: "工作模式 id" },
      limit: { type: "number", description: "返回数量，默认 50，最大 200" },
      includePreview: { type: "boolean", description: "是否返回每个会话的末尾预览，默认 true" },
    },
  },
  fn: async (args) => JSON.stringify(searchSessions(args || {})),
});

tools.register({
  name: "preview_session_cleanup",
  description: "预览可整理的历史会话候选，只分析不删除。用于用户说“整理历史对话/清理无意义记录/找出可删除会话”时。返回 cleanupId，后续只有在用户明确确认删除后才可交给 apply_session_cleanup。",
  parameters: {
    type: "object",
    properties: {
      scanLimit: { type: "number", description: "最多扫描多少个最近会话，默认 200" },
      returnLimit: { type: "number", description: "最多返回多少个候选，默认 80" },
      minConfidence: { type: "number", description: "最低置信度，默认 0.8" },
      includeReview: { type: "boolean", description: "是否返回低置信度人工复核候选，默认 false" },
      semanticMode: { type: "string", description: "语义复核模式：off, uncertain, deep。默认 off" },
      categories: {
        type: "array",
        items: { type: "string" },
        description: "可选类别过滤：empty, cleanup_task, weather_query, test_run, tiny_no_summary",
      },
    },
  },
  fn: async (args, toolCtx) => JSON.stringify(await buildSessionCleanupPreview(args || {}, { signal: toolCtx?.signal })),
});

tools.register({
  name: "apply_session_cleanup",
  description: "删除历史会话。高风险工具：只有用户在最新回复中明确确认删除时才能调用。优先传入 preview_session_cleanup 返回的 cleanupId；也可传 names。该工具会删除对应归档会话及其元数据。",
  parameters: {
    type: "object",
    properties: {
      cleanupId: { type: "string", description: "preview_session_cleanup 返回的 cleanupId" },
      names: {
        type: "array",
        items: { type: "string" },
        description: "显式要删除的会话名列表；与 cleanupId 二选一",
      },
      confirm: { type: "boolean", description: "必须为 true，表示用户已经明确确认删除" },
    },
  },
  fn: async (args) => JSON.stringify(applySessionCleanup(args || {})),
});
console.error(`[launcher] session history tools registered`);

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
    const text = String(args.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) return JSON.stringify({ error: "text is required" });
    if (text.length > CONSTANTS.MODE_MEMORY_TEXT_LIMIT) return JSON.stringify({ error: `text exceeds ${CONSTANTS.MODE_MEMORY_TEXT_LIMIT} characters; summarize it before saving` });
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
const mcpRestartPromises = new Map();

async function restartMcpServer(serverName) {
  if (mcpRestartPromises.has(serverName)) return mcpRestartPromises.get(serverName);
  const restart = (async () => {
    const index = mcpServers.findIndex((server) => server.label === serverName);
    if (index < 0) return false;
    const server = mcpServers[index];
    for (const name of server.toolNames) {
      tools.unregister(name);
      loop?.prefix?.removeTool(name);
    }
    try { await server.host?.client?.close?.(); } catch {}
    mcpServers.splice(index, 1);
    console.error(`[launcher] MCP "${serverName}" restarting after tools/call timeout`);
    await reloadMcp();
    const recovered = mcpServers.some((item) => item.label === serverName);
    console.error(`[launcher] MCP "${serverName}" restart ${recovered ? "completed" : "failed"}`);
    return recovered;
  })().finally(() => mcpRestartPromises.delete(serverName));
  mcpRestartPromises.set(serverName, restart);
  return restart;
}

function wrapMcpToolsWithRecovery(serverName, registeredNames) {
  if (serverName !== "officecli") return;
  for (const name of registeredNames) {
    const tool = tools.get(name);
    if (!tool?.fn) continue;
    const original = tool.fn;
    tool.fn = async (args, toolCtx) => {
      try {
        return await original(args, toolCtx);
      } catch (err) {
        if (!isMcpToolTimeout(err)) throw err;
        const recovered = await restartMcpServer(serverName);
        const message = recovered
          ? mcpRecoveryError(serverName)
          : `${serverName} MCP request timed out and automatic restart failed. Stop issuing OfficeCLI commands and report the blocker.`;
        throw new Error(message);
      }
    };
  }
}

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
      wrapMcpToolsWithRecovery(spec.name, registeredNames);
      const dlpWrapped = wrapToolsPathArgsWithDlp(tools, registeredNames, {
        readConfig: () => readConfig(configPath),
        env: { homeDir: home, projectRoot: resolve(__dirname, "..", "..", ".."), serverDir: __dirname, rootDir: workspaceDir },
        logger: console,
      });
      // Add new tool specs to loop prefix
      for (const ts of tools.specs().filter((s) => registeredNames.includes(s.function?.name))) {
        loop?.prefix?.addTool(presentSingleToolSpec(ts));
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
      console.error(`[launcher] MCP "${spec.name}": ${registeredNames.length} tools bridged${dlpWrapped ? `, ${dlpWrapped} DLP path wrapper(s)` : ""}`);
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
  const temp = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  try {
    writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    renameSync(temp, path);
  } finally {
    if (existsSync(temp)) rmSync(temp, { force: true });
  }
  return { ...data, path };
}
function writeModeMemoryTrash(mode, item) {
  mkdirSync(memoryTrashDir, { recursive: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = resolve(memoryTrashDir, `${id}.json`);
  const temp = `${path}.tmp-${process.pid}`;
  const entry = { id, kind: "mode", mode, item, name: item.text, deletedAt: new Date().toISOString() };
  try {
    writeFileSync(temp, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    renameSync(temp, path);
  } finally {
    if (existsSync(temp)) rmSync(temp, { force: true });
  }
  return { id, path };
}
function restoreModeMemoryTrash(entry) {
  const current = readModeMemory(entry?.mode);
  const item = normalizeModeMemoryItem(entry?.item);
  if (!item || current.items.some((old) => old.id === item.id || old.text === item.text)) return null;
  if (current.items.length >= CONSTANTS.MODE_MEMORY_ITEM_LIMIT) return null;
  return writeModeMemory(current.mode, { items: [item, ...current.items] });
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
        items: memory.items,
      };
    }),
  };
}

function addModeMemory(modeId, input = {}) {
  const rawText = String(input.text ?? "").replace(/\s+/g, " ").trim();
  if (rawText.length > CONSTANTS.MODE_MEMORY_TEXT_LIMIT) throw new Error(`mode memory text exceeds ${CONSTANTS.MODE_MEMORY_TEXT_LIMIT} characters`);
  const current = readModeMemory(modeId);
  const item = normalizeModeMemoryItem({
    ...input,
    id: input.id || randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  if (!item) throw new Error("text is required");
  const exists = current.items.find((old) => old.text === item.text);
  if (!exists && current.items.length >= CONSTANTS.MODE_MEMORY_ITEM_LIMIT) {
    throw new Error(`mode memory capacity reached (${CONSTANTS.MODE_MEMORY_ITEM_LIMIT}); delete an existing item before adding another`);
  }
  const items = exists
    ? current.items.map((old) => old.id === exists.id ? { ...old, ...item, id: old.id, createdAt: old.createdAt } : old)
    : [item, ...current.items];
  return { item: exists ? items.find((old) => old.id === exists.id) : item, memory: writeModeMemory(current.mode, { items }) };
}

function updateModeMemory(modeId, id, patch = {}) {
  if (patch.text !== void 0) {
    const rawText = String(patch.text ?? "").replace(/\s+/g, " ").trim();
    if (!rawText || rawText.length > CONSTANTS.MODE_MEMORY_TEXT_LIMIT) throw new Error(`mode memory text must contain 1-${CONSTANTS.MODE_MEMORY_TEXT_LIMIT} characters`);
  }
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
  const removed = current.items.find((item) => item.id === id);
  const items = current.items.filter((item) => item.id !== id);
  if (items.length === current.items.length) return false;
  const trash = writeModeMemoryTrash(current.mode, removed);
  try {
    writeModeMemory(current.mode, { items });
  } catch (err) {
    try { rmSync(trash.path, { force: true }); } catch {}
    throw err;
  }
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

function addSessionMemory(name, description, body, { persist = true } = {}) {
  const trimmedBody = String(body ?? "");
  const cappedBody = trimmedBody.length > CONSTANTS.SESSION_MEMORY_BODY_MAX_CHARS
    ? `${trimmedBody.slice(0, CONSTANTS.SESSION_MEMORY_BODY_MAX_CHARS)}\n\n… (truncated ${trimmedBody.length - CONSTANTS.SESSION_MEMORY_BODY_MAX_CHARS} chars)`
    : trimmedBody;
  const normalizedName = String(name ?? "").trim().toLowerCase();
  const existing = sessionMemories.findIndex((memory) => String(memory.name ?? "").trim().toLowerCase() === normalizedName);
  if (existing >= 0) sessionMemories.splice(existing, 1);
  sessionMemories.push({ name, description, body: cappedBody, ts: Date.now() });
  if (sessionMemories.length > 50) sessionMemories.shift();
  if (persist) void writeActiveSessionMeta({ sessionMemories: sessionMemories.map((memory) => ({ ...memory })) });
}
function moveModeMemory(id, { sourceMode, targetMode, copy = false } = {}) {
  const source = readModeMemory(sourceMode);
  const target = readModeMemory(targetMode);
  const item = source.items.find((entry) => entry.id === id);
  if (!item) return null;
  if (target.items.some((entry) => entry.text === item.text)) throw new Error("target mode already contains the same memory");
  if (target.items.length >= CONSTANTS.MODE_MEMORY_ITEM_LIMIT) throw new Error(`target mode memory capacity reached (${CONSTANTS.MODE_MEMORY_ITEM_LIMIT})`);
  const now = new Date().toISOString();
  const targetItem = { ...item, id: copy ? randomUUID() : item.id, createdAt: copy ? now : item.createdAt, updatedAt: now };
  try {
    writeModeMemory(target.mode, { items: [targetItem, ...target.items] });
    if (!copy) writeModeMemory(source.mode, { items: source.items.filter((entry) => entry.id !== id) });
  } catch (err) {
    try { writeModeMemory(target.mode, { items: target.items }); } catch {}
    try { writeModeMemory(source.mode, { items: source.items }); } catch {}
    throw err;
  }
  return { moved: !copy, copied: copy, sourceMode: source.mode, targetMode: target.mode, item: targetItem };
}
function batchModeMemory({ action, items } = {}) {
  const grouped = new Map();
  for (const ref of Array.isArray(items) ? items : []) {
    const mode = safeModeId(ref?.mode);
    if (!grouped.has(mode)) grouped.set(mode, { before: readModeMemory(mode), ids: new Set() });
    grouped.get(mode).ids.add(String(ref?.id ?? ""));
  }
  const updates = [];
  let changed = 0;
  for (const [mode, group] of grouped) {
    const next = [];
    for (const item of group.before.items) {
      if (!group.ids.has(item.id)) {
        next.push(item);
        continue;
      }
      changed++;
      if (action !== "delete") next.push({ ...item, enabled: action === "enable", updatedAt: new Date().toISOString() });
    }
    updates.push({ mode, before: group.before.items, next });
  }
  const written = [];
  const trash = [];
  try {
    if (action === "delete") {
      for (const update of updates) {
        const deleted = update.before.filter((item) => !update.next.some((next) => next.id === item.id));
        for (const item of deleted) trash.push(writeModeMemoryTrash(update.mode, item));
      }
    }
    for (const update of updates) {
      writeModeMemory(update.mode, { items: update.next });
      written.push(update);
    }
  } catch (err) {
    for (const update of written.reverse()) try { writeModeMemory(update.mode, { items: update.before }); } catch {}
    for (const item of trash) try { rmSync(item.path, { force: true }); } catch {}
    throw err;
  }
  return { action, changed };
}
function clearSessionMemories() { sessionMemories.length = 0; }
function listSessionMemories() { return sessionMemories.map((memory) => ({ ...memory })); }
function deleteSessionMemory(name) {
  const normalizedName = String(name ?? "").trim().toLowerCase();
  const index = sessionMemories.findIndex((memory) => String(memory.name ?? "").trim().toLowerCase() === normalizedName);
  if (index < 0) return false;
  sessionMemories.splice(index, 1);
  void writeActiveSessionMeta({ sessionMemories: listSessionMemories() });
  return true;
}
function restoreSessionMemories(entries) {
  clearSessionMemories();
  if (!Array.isArray(entries)) return;
  for (const entry of entries.slice(-50)) {
    const name = String(entry?.name ?? "").trim();
    const body = String(entry?.body ?? "").trim();
    if (!name || !body) continue;
    addSessionMemory(name, String(entry?.description ?? ""), body, { persist: false });
  }
}

// ── Tutor mode (session-level) ──────────────────────────────────
let sessionTutorMode = null; // { enabled: true, style: "socratic" | "hint" | "pair" }

function setTutorMode(style) {
  if (!style || style === "off") {
    sessionTutorMode = null;
    return null;
  }
  const valid = ["socratic", "hint", "pair"].includes(style) ? style : "socratic";
  sessionTutorMode = { enabled: true, style: valid };
  return sessionTutorMode;
}

function getTutorMode() {
  return sessionTutorMode;
}

function clearTutorMode() {
  sessionTutorMode = null;
}

// ── Learning-track mode (session-level) ─────────────────────────
let sessionLearningMode = null; // { enabled: true, style: "on" | "senior" }

function setLearningMode(style) {
  if (!style || style === "off") {
    sessionLearningMode = null;
    return null;
  }
  const valid = ["on", "senior"].includes(style) ? style : "on";
  sessionLearningMode = { enabled: true, style: valid };
  return sessionLearningMode;
}

function getLearningMode() {
  return sessionLearningMode;
}

function clearLearningMode() {
  sessionLearningMode = null;
}

function formatTutorPrompt(style) {
  const socratic = `# Tutor mode — Socratic

You are now a Socratic programming tutor. Your goal is to help the user learn and understand, not to write code for them.
- Do NOT give complete solutions or full implementations directly.
- Guide the user to the answer through focused, open-ended questions.
- If you provide code examples, keep them under 8 lines and use them only to illustrate a concept.
- Before the user finalizes any implementation, prompt them to review: ownership, safety, error handling, testability, readability, and edge cases.
- Always respond in the same language as the user's message.`;

  const hint = `# Tutor mode — Hint assistant

You are a supportive coding tutor who helps users when they are stuck.
- Observe the user's question and current approach, then provide hints rather than full answers.
- Break complex problems into smaller steps and ask the user which part they want to tackle next.
- Offer targeted suggestions: "Have you considered...?" / "What would happen if...?"
- Only provide larger code snippets if the user explicitly asks for them.`;

  const pair = `# Tutor mode — Pair programmer

You are a collaborative pair programming partner.
- Work together with the user to design, write, and review code.
- Propose options and trade-offs, then let the user decide.
- You may write code, but always explain your reasoning and ask for confirmation before making significant changes.
- Keep the user in the driver's seat.`;

  const fragments = { socratic, hint, pair };
  return fragments[style] ?? socratic;
}

function formatLearningPrompt(style, rootDir) {
  let dueList = "- (none)";
  let activeList = "- (none)";
  if (learnTrackModule) {
    try {
      const mgr = new learnTrackModule.LearningConceptManager();
      const due = mgr.getDueConcepts();
      const active = mgr.getActiveConcepts(20);
      dueList = due.slice(0, 10).map((c) => `- ${c.name} (${c.id})`).join("\n") || "- (none)";
      activeList = active.slice(0, 10).map((c) => `- ${c.name} (${c.id})`).join("\n") || "- (none)";
    } catch (err) {
      console.error(`[launcher] learn-track query failed: ${err.message}`);
    }
  }

  const on = `# Active-learning mode

You are in an active-learning / spaced-repetition loop. Help the user deliberately practice concepts in this project.
- Review concepts below and weave them into explanations when relevant to the user's question.
- For any concept the user seems to be using, pause briefly and ask them to explain it in their own words or point to where it lives in this project.
- Encourage the user to make connections between new code and the concepts in the library.

## Concepts due for review now
${dueList}

## Recently active concepts
${activeList}`;

  const senior = `# Senior-engineer learning mode

You are a senior engineer mentoring the user toward ownership of this codebase. Treat every interaction as a learning opportunity.
- When discussing any implementation, explain *why* the project chose this approach and what alternatives were rejected.
- Reference concepts from the library and ask the user to locate the relevant code, tests, and docs.
- Push for depth: edge cases, failure modes, observability, maintainability, and design trade-offs.
- Occasionally assign tiny "senior-review challenges": "How would you verify this works?" / "What would break if X changes?"

## Concepts due for review now
${dueList}

## Recently active concepts
${activeList}`;

  const fragments = { on, senior };
  return fragments[style] ?? on;
}

function selectSessionMemoriesForPrompt(maxTokens = Infinity) {
  let selected = sessionMemories.map((m) => ({ memory: m, text: (() => {
    const title = String(m.name).replace(/[\r\n]/g, " ").trim();
    return `## ${title}\n\n${m.body}`;
  })() }));
  const dropped = [];
  while (selected.length > 0) {
    const joined = selected.map((entry) => entry.text).join("\n\n");
    if (joined.length <= CONSTANTS.SESSION_MEMORY_BLOCK_MAX_CHARS && countTokens(joined) <= maxTokens) break;
    dropped.push(selected.shift().memory);
  }
  return { selected, dropped };
}
function getSessionMemoryBlock(maxTokens = Infinity) {
  if (sessionMemories.length === 0) return "";
  const { selected, dropped } = selectSessionMemoriesForPrompt(maxTokens);
  if (selected.length === 0) return "";
  const suffix = dropped.length > 0 ? `\n\n… dropped ${dropped.length} older session memories` : "";
  return `\n# Session memory (this conversation only)\n\n${selected.map((entry) => entry.text).join("\n\n")}${suffix}`;
}

function collectPersistentMemoryPrompt(rootDir, maxTokens = Infinity) {
  let store;
  try {
    store = new MemoryStore({ projectRoot: rootDir });
  } catch (err) {
    console.error(`[launcher] persistent memory skipped: ${err.message}`);
    return { text: "", status: { entries: {}, totalChars: 0, totalTokens: 0, budgetTokens: Number.isFinite(maxTokens) ? maxTokens : null } };
  }
  let entries = [];
  try {
    entries = store.list();
  } catch (err) {
    console.error(`[launcher] persistent memory list skipped: ${err.message}`);
  }
  const keyFor = (entry) => `${entry.scope}:${entry.name}`;
  const highEntries = entries.filter((entry) => effectivePriority(entry, config) === "high").sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")) || keyFor(a).localeCompare(keyFor(b)));
  const highHeader = [
    "# HIGH PRIORITY constraints (must observe)",
    "",
    "These user-approved memories were marked high priority. Treat them as hard rules unless the current user message explicitly updates or contradicts them."
  ].join("\n");
  const finiteTokenBudget = Number.isFinite(maxTokens);
  const highTokenBudget = finiteTokenBudget ? Math.floor(maxTokens * 0.6) : Infinity;
  const projectIndexTokenBudget = finiteTokenBudget ? Math.floor(maxTokens * 0.2) : Infinity;
  const globalIndexTokenBudget = finiteTokenBudget ? Math.floor(maxTokens * 0.1) : Infinity;
  const high = buildBudgetedBlocks(highEntries.map((entry) => ({
    key: keyFor(entry),
    text: [`!!! [${entry.scope}/${entry.type}/${entry.name}] ${entry.description || "(no description)"}`, entry.body].filter(Boolean).join("\n\n"),
  })), { header: highHeader, maxChars: CONSTANTS.HIGH_PRIORITY_MEMORY_BLOCK_MAX_CHARS, maxTokens: highTokenBudget, countTokens });
  const excludedKeys = new Set(high.selectedKeys);
  const global = buildMemoryIndex(entries.filter((entry) => entry.scope === "global").map((entry) => ({ ...entry, key: keyFor(entry) })), { maxChars: CONSTANTS.PERSISTENT_MEMORY_INDEX_MAX_CHARS, maxTokens: globalIndexTokenBudget, countTokens, excludedKeys });
  const project = buildMemoryIndex(entries.filter((entry) => entry.scope === "project").map((entry) => ({ ...entry, key: keyFor(entry) })), { maxChars: CONSTANTS.PERSISTENT_MEMORY_INDEX_MAX_CHARS, maxTokens: projectIndexTokenBudget, countTokens, excludedKeys });
  const blocks = [];
  if (high.selectedKeys.length > 0 || high.omittedKeys.length > 0) blocks.push(high.text);
  if (global.text) {
    blocks.push([
      "# User memory - global",
      "",
      "Cross-project facts and preferences the user explicitly asked to remember. Treat these as authoritative unless the current user message updates or contradicts them. Use `recall_memory` only when the one-line index is not enough.",
      "",
      "```",
      global.text,
      "```",
    ].join("\n"));
  }
  if (project.text) {
    blocks.push([
      "# User memory - this project",
      "",
      "Per-project facts and decisions the user established in prior sessions. Treat these as authoritative for this workspace unless the current user message updates or contradicts them.",
      "",
      "```",
      project.text,
      "```",
    ].join("\n"));
  }
  const text = blocks.length ? `\n\n${blocks.join("\n\n")}` : "";
  const statuses = {};
  for (const key of high.selectedKeys) statuses[key] = "high-full";
  for (const key of [...global.selectedKeys, ...project.selectedKeys]) statuses[key] = "index";
  for (const key of [...high.omittedKeys, ...global.omittedKeys, ...project.omittedKeys]) if (!statuses[key]) statuses[key] = "omitted";
  return { text, status: { entries: statuses, totalChars: text.length, totalTokens: countTokens(text), budgetTokens: finiteTokenBudget ? maxTokens : null } };
}

function formatPersistentMemoryForPrompt(rootDir, maxTokens = Infinity) {
  return collectPersistentMemoryPrompt(rootDir, maxTokens).text;
}

function memoryPromptBudget(model) {
  const contextTokens = DEEPSEEK_CONTEXT_TOKENS[model] ?? DEFAULT_CONTEXT_TOKENS;
  const totalTokens = memoryTokenBudgetForCapacity(contextTokens);
  const sessionTokens = Math.floor(totalTokens * 0.25);
  const modeText = formatModeMemoryForPrompt(config.mode);
  const modeTokens = countTokens(modeText);
  return {
    contextTokens,
    totalTokens,
    sessionTokens,
    persistentTokens: Math.max(0, totalTokens - sessionTokens - modeTokens),
    modeText,
    modeTokens,
  };
}

function getMemoryInjectionStatus(rootDir = workspaceDir, model = effectiveModelConfig(config).model) {
  const budget = memoryPromptBudget(model);
  const modeMemory = readModeMemory(config.mode || "general");
  const modeEnabled = modeMemory.items.filter((item) => item.enabled).sort((a, b) => b.priority - a.priority || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const modeSelected = modeEnabled.slice(0, CONSTANTS.MODE_MEMORY_PROMPT_LIMIT);
  const session = selectSessionMemoriesForPrompt(budget.sessionTokens);
  const sessionText = getSessionMemoryBlock(budget.sessionTokens);
  const persistent = collectPersistentMemoryPrompt(rootDir, budget.persistentTokens);
  const project = getProjectMemoryStatus(rootDir);
  const soul = loadSoul();
  const soulChars = soul.length;
  const projectTokens = countTokens(readProjectMemories(rootDir).map((item) => item.content).join("\n\n"));
  const recallableTokens = persistent.status.totalTokens + budget.modeTokens + countTokens(sessionText);
  return {
    persistent: persistent.status,
    mode: { selectedIds: modeSelected.map((item) => item.id), omittedIds: modeEnabled.slice(CONSTANTS.MODE_MEMORY_PROMPT_LIMIT).map((item) => item.id) },
    session: { selectedNames: session.selected.map((entry) => entry.memory.name), omittedNames: session.dropped.map((entry) => entry.name) },
    project,
    soul: { chars: soulChars, tokens: countTokens(soul) },
    budget: { model, contextTokens: budget.contextTokens, recallableTokens, maxRecallableTokens: budget.totalTokens, pinnedTokens: countTokens(soul) + projectTokens },
    totalTokens: recallableTokens + countTokens(soul) + projectTokens,
    totalChars: persistent.status.totalChars + budget.modeText.length + sessionText.length + project.totalChars + soulChars,
  };
}

// ── Build session ───────────────────────────────────────────────
// Dynamically register all available ECC rule packs from ~/.visionox/rules/ecc/
const ALL_ECC_RULES = Object.create(null);
{
  const eccRoot = ECC_RULES_HOME;
  if (existsSync(eccRoot)) {
    for (const entry of readdirSync(eccRoot)) {
      const dir = resolve(eccRoot, entry);
      if (statSync(dir).isDirectory()) ALL_ECC_RULES[entry] = dir;
    }
  }
}
// Custom rules always available (user-defined, ~/.visionox/rules)
ALL_ECC_RULES["custom"] = resolve(visionoxDataDir, "rules");

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
  // Enforce a collective budget: drop trailing rules (custom set is loaded
  // last by orderedRuleSets, so it is dropped first) until the joined block
  // fits. Keep each rule file intact rather than truncating mid-rule.
  if (rules.length === 0) return rules;
  let joined = rules.join("\n\n");
  if (joined.length <= CONSTANTS.RULES_MAX_CHARS) return rules;
  let dropped = 0;
  while (rules.length > 1 && joined.length > CONSTANTS.RULES_MAX_CHARS) {
    rules.pop();
    dropped++;
    joined = rules.join("\n\n");
  }
  if (dropped > 0) {
    rules.push(`<!-- rules truncated: dropped ${dropped} rule file(s) (lowest priority first) to fit ${CONSTANTS.RULES_MAX_CHARS}-char budget -->`);
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

const GENERATED_ARTIFACT_EXT_RE = /\.(md|markdown|html|htm|txt|pdf|doc|docx|ppt|pptx|xls|xlsx|csv|json|xml|yaml|yml|py|js|ts|tsx|jsx|css|sql|ps1|bat|cmd|sh|ini|toml)(?:$|[?#\s，。；;、)）（\]`*_~])/i;
const GENERATED_ARTIFACT_PREVIEW_EXTS = new Set([
  ".md", ".markdown", ".html", ".htm", ".txt", ".py", ".js", ".ts", ".tsx",
  ".jsx", ".css", ".json", ".xml", ".yaml", ".yml", ".sql", ".ps1", ".bat",
  ".cmd", ".sh", ".ini", ".toml", ".csv",
]);
const GENERATED_ARTIFACT_SCRIPT_EXTS = new Set([".py", ".js", ".ts", ".tsx", ".jsx", ".ps1", ".bat", ".cmd", ".sh"]);
const GENERATED_ARTIFACT_PREVIEW_MAX_BYTES = 512 * 1024;
const generatedArtifactPaths = new Map();

function rememberGeneratedArtifactPath(value) {
  let raw = String(value || "").trim();
  raw = raw.replace(/^["'“”‘’`*_~]+|["'“”‘’`*_~]+$/g, "").trim();
  if (!raw || raw.length > 500 || !GENERATED_ARTIFACT_EXT_RE.test(raw)) return null;
  let abs;
  try {
    abs = resolve(workspaceDir, raw);
  } catch {
    return null;
  }
  const key = process.platform === "win32" ? abs.toLowerCase() : abs;
  generatedArtifactPaths.set(key, abs);
  while (generatedArtifactPaths.size > 200) {
    const first = generatedArtifactPaths.keys().next().value;
    generatedArtifactPaths.delete(first);
  }
  return abs;
}

function collectGeneratedArtifactPaths() {
  const paths = new Map(generatedArtifactPaths);
  if (Array.isArray(schedules)) {
    for (const schedule of schedules) {
      for (const run of schedule?.history || []) {
        if (typeof run?.reportPath !== "string" || !run.reportPath.trim()) continue;
        try {
          const abs = resolve(workspaceDir, run.reportPath);
          const key = process.platform === "win32" ? abs.toLowerCase() : abs;
          paths.set(key, abs);
        } catch {
        }
      }
    }
  }
  return Array.from(paths.values());
}

function generatedArtifactFileInfo(abs) {
  try {
    const st = statSync(abs);
    if (!st.isFile()) return null;
    const ext = extname(abs).toLowerCase();
    return {
      path: abs,
      dir: dirname(abs),
      filename: basename(abs),
      ext,
      size: st.size,
      mtimeMs: st.mtimeMs,
      previewable: GENERATED_ARTIFACT_PREVIEW_EXTS.has(ext) && st.size <= GENERATED_ARTIFACT_PREVIEW_MAX_BYTES,
      openable: !GENERATED_ARTIFACT_SCRIPT_EXTS.has(ext),
    };
  } catch {
    return null;
  }
}

function parseMaybeJsonObject(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function rememberToolGeneratedArtifacts(toolName, toolArgs) {
  if (!/^(write_file|edit|multi_edit|save_file)$/i.test(String(toolName || ""))) return [];
  const args = parseMaybeJsonObject(toolArgs);
  if (!args) return [];
  const paths = [];
  for (const key of ["path", "filePath", "file_path", "filename", "output", "outputPath", "reportPath"]) {
    if (typeof args[key] === "string") {
      const remembered = rememberGeneratedArtifactPath(args[key]);
      if (remembered) paths.push(remembered);
    }
  }
  return Array.from(new Set(paths));
}
// buildSystemPrompt — imported from ./lib/system-prompt.mjs

function currentEditMode() {
  return loadEditMode(configPath);
}

function presentedToolSpecs() {
  return presentToolSpecsForMode(tools.specs(), { editMode: currentEditMode() });
}

function presentSingleToolSpec(spec) {
  return presentToolSpecsForMode([spec], { editMode: currentEditMode() })[0] ?? spec;
}

function buildSystemPromptForLoop(rootDir, hasSemantic) {
  return buildSystemPrompt(tools.specs(), rootDir, hasSemantic, { editMode: currentEditMode() });
}

// ── System-prompt assembly cache ─────────────────────────────────
// buildLoop is invoked from 11 call sites (/new, mode switch, workspace sync,
// side-question paths...). Each call re-reads soul, all rule files, every
// SKILL.md, project memory, and persistent memory from disk synchronously.
// Cache the assembled static prefix (everything up to session memory) keyed
// by an mtime fingerprint of its sources. Session memory, tutor, and learning
// blocks stay dynamic (per-turn). writeConfig/edit-skill/edit-rule update
// mtimes on disk, so the cache self-invalidates.
let _prefixCache = { fingerprint: null, upToPersistent: null, mc: null };
let activeMemoryRuntime = null;

function safeMtime(p) {
  try { return statSync(p).mtimeMs; } catch { return 0; }
}

function dirMtime(p) {
  // Directory mtime updates on direct child add/remove (not on nested edits),
  // which is sufficient for "skill/rule added or removed" detection. Content
  // edits inside existing files are caught by the per-file mtime in loadRules
  // only on cache miss; acceptable trade-off — a /new or restart refreshes.
  try { return statSync(p).mtimeMs; } catch { return 0; }
}

function flatMdMtimeFingerprint(dir) {
  if (!existsSync(dir)) return "0";
  try {
    const files = readdirSync(dir).filter((name) => name.endsWith(".md")).sort();
    return files.map((name) => `${name}:${safeMtime(resolve(dir, name))}`).join(",");
  } catch {
    return "err";
  }
}

function projectMemoryDirForRoot(rootDir) {
  const abs = resolve(rootDir);
  const hash = createHash("sha1").update(abs).digest("hex").slice(0, 16);
  return resolve(visionoxDataDir, "memory", hash);
}

function listProjectMemoryPathsForPrompt(rootDir) {
  const paths = [];
  const seen = new Set();
  for (const name of PROJECT_MEMORY_CANDIDATES) {
    const p = resolve(rootDir, name);
    if (!existsSync(p)) continue;
    let real = p;
    try { real = realpathSync.native(p); } catch {}
    const key = process.platform === "win32" ? real.toLowerCase() : real;
    if (seen.has(key)) continue;
    seen.add(key);
    paths.push(real);
  }
  return paths;
}
function getProjectMemoryStatus(rootDir = workspaceDir) {
  const paths = listProjectMemoryPaths(rootDir);
  const included = readProjectMemories(rootDir);
  const byPath = new Map(included.map((item) => [item.path, item]));
  const files = paths.map((path) => {
    const memory = byPath.get(path);
    return {
      path,
      state: memory ? memory.truncated ? "truncated" : "full" : "omitted",
      originalChars: memory?.originalChars ?? 0,
      injectedChars: memory?.content?.length ?? 0,
    };
  });
  return { files, totalChars: included.reduce((sum, item) => sum + item.content.length, 0), maxChars: 12e3 };
}

function computePrefixFingerprint(rootDir) {
  const mc = getModeConfig();
  const parts = [
    `mode=${config.mode}`,
    `model=${effectiveModelConfig(config).model}`,
    `edit=${currentEditMode()}`,
    `soul=${safeMtime(SOUL_HOME)}`,
    `root=${rootDir}`,
    `sem=${hasSemanticSearch ? 1 : 0}`,
  ];
  for (const name of orderedRuleSets(mc.eccRules || [])) {
    const dir = ALL_ECC_RULES[name];
    parts.push(`rule:${name}=${dir ? dirMtime(dir) : 0}`);
  }
  // Project + global skill roots read by SkillStore
  parts.push(`skills:proj=${dirMtime(resolve(rootDir, ".visionox", "skills"))}`);
  parts.push(`skills:home=${dirMtime(skillsRoot)}`);
  // Mode memory file
  parts.push(`mmode=${safeMtime(resolve(modeMemoryDir, `${safeModeId(config.mode)}.json`))}`);
  // Every active project instruction file participates in cache invalidation.
  const projectMemoryPaths = listProjectMemoryPathsForPrompt(rootDir);
  parts.push(`pmem=${projectMemoryPaths.map((path) => `${path}:${safeMtime(path)}`).join(",") || "0"}`);
  // Persistent memory: MemoryStore stores flat .md files under global and the
  // current project hash. Include file mtimes so edits inside existing files
  // invalidate the prefix cache without requiring an app restart.
  parts.push(`memg=${flatMdMtimeFingerprint(resolve(visionoxDataDir, "memory", "global"))}`);
  parts.push(`memp=${flatMdMtimeFingerprint(projectMemoryDirForRoot(rootDir))}`);
  return parts.join("|");
}
function memoryRuntimeFingerprint(rootDir) {
  const session = sessionMemories.map((item) => `${item.name}:${item.ts}:${item.body.length}`).join(",");
  return `${computePrefixFingerprint(rootDir)}|session=${session}`;
}
function getMemoryRuntimeStatus(rootDir = workspaceDir) {
  const currentFingerprint = memoryRuntimeFingerprint(rootDir);
  return {
    pending: !activeMemoryRuntime || activeMemoryRuntime.fingerprint !== currentFingerprint,
    appliedAt: activeMemoryRuntime?.appliedAt ?? null,
    active: activeMemoryRuntime?.injection ?? null,
    next: getMemoryInjectionStatus(rootDir),
  };
}

function buildLoop(client, rootDir) {
  const modelConfig = effectiveModelConfig(config);
  const memoryBudget = memoryPromptBudget(modelConfig.model);
  const fingerprint = computePrefixFingerprint(rootDir);
  let system, mc;
  if (_prefixCache.fingerprint === fingerprint && _prefixCache.upToPersistent !== null) {
    // Cache hit: skip all disk reads for soul/project-memory/mode/rules/skills/persistent.
    system = _prefixCache.upToPersistent;
    mc = _prefixCache.mc;
  } else {
    mc = getModeConfig();
    const soul = loadSoul();
    const baseSystem = buildSystemPromptForLoop(rootDir, hasSemanticSearch);
    const systemWithSoul = soul ? `# Identity\n\n${soul}\n\n---\n\n${baseSystem}` : baseSystem;
    // L1 Project memory — injected right after Soul, before work mode.
    const systemWithProject = applyProjectMemory(systemWithSoul, rootDir);
    const modeLines = [
      `Current work mode: ${mc.label}`,
      mc.description ? `Scenario: ${mc.description}` : "",
      mc.hint ? `User-facing behavior: ${mc.hint}` : "",
      mc.skills?.length ? `Relevant skills: ${mc.skills.join(", ")}` : "",
      `Mode changes made in the dashboard apply immediately (the loop is rebuilt on switch); do not claim a prompt changed mid-turn unless this prefix was rebuilt.`,
      mc.prompt || "",
    ].filter(Boolean);
    const systemWithMode = systemWithProject + `\n\n# Work mode\n\nThis block only defines the working habits for the current scenario. If it conflicts with the identity/environment assumptions in # Identity (soul) above, soul wins.\n${modeLines.join("\n")}${memoryBudget.modeText}`;
    const loadedRules = loadRules();
    const systemWithRules = loadedRules.length > 0
      ? systemWithMode + "\n\n# Coding Rules\n\n" + loadedRules.join("\n\n")
      : systemWithMode;
    // L6 Skills index — injected before persistent memory to match the documented
    // "技能索引 → 持久记忆" order. applySkillsIndex appends a skills catalogue block.
    // modeSkills marks the current mode's recommended skills with ★ so the
    // catalogue and the "Relevant skills" hint above no longer contradict.
    const systemWithSkills = applySkillsIndex(systemWithRules, { projectRoot: rootDir, modeSkills: mc.skills });
    system = systemWithSkills + formatPersistentMemoryForPrompt(rootDir, memoryBudget.persistentTokens);
    _prefixCache = { fingerprint, upToPersistent: system, mc };
    console.error(`[launcher] system prefix rebuilt (fingerprint changed)`);
  }
  // Session-scoped layers stay dynamic — never cached.
  const systemWithSession = system + getSessionMemoryBlock(memoryBudget.sessionTokens);
  activeMemoryRuntime = { fingerprint: memoryRuntimeFingerprint(rootDir), appliedAt: new Date().toISOString(), injection: getMemoryInjectionStatus(rootDir, modelConfig.model) };
  const systemWithTutor = sessionTutorMode?.enabled
    ? systemWithSession + "\n\n" + formatTutorPrompt(sessionTutorMode.style)
    : systemWithSession;
  const systemWithLearning = sessionLearningMode?.enabled
    ? systemWithTutor + "\n\n" + formatLearningPrompt(sessionLearningMode.style, rootDir)
    : systemWithTutor;
  const prefix = new ImmutablePrefix({
    system: systemWithLearning,
    toolSpecs: presentedToolSpecs(),
  });
  // Determine vision capability from the active provider model config.
  const provider = getActiveProvider(config);
  const activeModel = provider?.models?.find((m) => m.id === modelConfig.model);
  const visionCfg = activeModel?.multimodal
    ? { vision: true, visionDetail: "high" }
    : { "deepseek-v4-pro": { vision: true, visionDetail: "high" } }[modelConfig.model] ?? {};

  // Set provider-driven globals for chunk-2R4QCDOZ.js thinkingMode/summaryModel overrides
  if (provider) {
    const tmMap = {};
    for (const m of provider.models ?? []) tmMap[m.id] = m.thinkingMode;
    globalThis.__visionoxThinkingModeMap = tmMap;
    globalThis.__visionoxSummaryModel = pickSummaryModel(provider.models);
  }

  activeContextPolicy = applyContextCap(modelConfig.model);

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

function rebuildLoopPreservingContext(nextClient = client, rootDir = workspaceDir) {
  const priorEntries = loop?.log?.toMessages ? loop.log.toMessages() : [];
  const previousModel = loop?.model ?? null;
  const rebuilt = buildLoop(nextClient, rootDir);
  const context = priorEntries.length > 0
    ? (rebuilt.adoptHistory?.(priorEntries, rebuilt.model) ?? (rebuilt.log.compactInPlace(priorEntries), { messageCount: priorEntries.length }))
    : { messageCount: 0, changedCount: 0, reasoningAdded: 0, reasoningRemoved: 0, tokensSaved: 0 };
  loop = rebuilt;
  ctx.loop = loop;
  console.error(`[launcher] loop rebuilt with ${context.messageCount} context messages preserved`);
  activeContextPolicy = applyContextCap(loop.model);
  return { previousModel, model: loop.model, ...context, contextStatus: loop.contextStatus?.() ?? null };
}

if (apiKey) {
  try {
    client = new DeepSeekClient({ apiKey, baseUrl });
    loop = buildLoop(client, workspaceDir);
    console.error(`[launcher] CacheFirstLoop created (model=${effectiveModelConfig(config).model}, effort=${config.reasoningEffort ?? "max"})`);
  } catch (err) {
    console.error(`[launcher] failed to create loop: ${err.message}`);
  }
}
if (client) refreshBalance();
setInterval(() => { if (client) refreshBalance(); }, CONSTANTS.BALANCE_REFRESH_MS);

// ── Event sink (writes .events.jsonl for cockpit tool activity) ──
let eventSink = null;
let eventizer = null;

// ── Plan state (mirrors TUI's planStepsRef/completedStepIdsRef) ──
// Holds the in-memory plan between submit_plan approval and step completion.
// Persisted to ~/.visionox/sessions/<session>.plan.json on first step_complete,
// archived to <session>.plan.<ts>.done.json when all steps are done.
const DESKTOP_SESSION_NAME = "desktop";
let pendingPlan = null;       // { steps, summary, body } — set by onPlanSubmitted, cleared on persist
let activePlanSteps = null;   // [{id,title,action,risk?}] — persisted plan steps
let activeCompletedIds = null;// Set<string> of completed step ids
let activePlanSummary = null; // string
let activePlanBody = null;    // string (markdown)
let activePlanUpdatedAt = null;// ISO timestamp from the persisted plan file
let pendingPlanRevision = null;// committed only after the user accepts the revision card

/** Get the current session name for plan file paths. */
function currentSessionName() {
  return DESKTOP_SESSION_NAME;
}

/** Reset in-memory plan refs (called on /new, session switch, or cancel). */
function resetPlanRefs() {
  pendingPlan = null;
  activePlanSteps = null;
  activeCompletedIds = null;
  activePlanSummary = null;
  activePlanBody = null;
  activePlanUpdatedAt = null;
  pendingPlanRevision = null;
}

/** Restore a persisted active plan after launcher restart. */
function hydrateActivePlanFromDisk() {
  if (activePlanSteps) return;
  const session = currentSessionName();
  const stored = loadPlanState(session);
  if (!stored) return;
  activePlanSteps = stored.steps;
  activeCompletedIds = new Set(normalizeCompletedStepIds(stored.steps, stored.completedStepIds));
  activePlanBody = stored.body ?? null;
  activePlanSummary = stored.summary ?? null;
  activePlanUpdatedAt = stored.updatedAt ?? null;
  console.error(`[launcher] active plan restored (${activePlanSteps.length} steps) for session ${session}`);
}

/** Snapshot used by the dashboard plans panel. */
function getActivePlanSnapshot() {
  if (pendingPlan && !activePlanSteps) {
    return {
      session: currentSessionName(),
      status: "pending",
      path: null,
      completedAt: null,
      updatedAt: null,
      totalSteps: pendingPlan.steps.length,
      completedSteps: 0,
      completionRatio: 0,
      steps: pendingPlan.steps,
      completedStepIds: [],
      body: pendingPlan.body,
      summary: pendingPlan.summary,
    };
  }
  hydrateActivePlanFromDisk();
  if (!activePlanSteps || !activeCompletedIds) return null;
  const completedStepIds = normalizeCompletedStepIds(activePlanSteps, [...activeCompletedIds]);
  return {
    session: currentSessionName(),
    status: "active",
    path: null,
    completedAt: activePlanUpdatedAt,
    updatedAt: activePlanUpdatedAt,
    totalSteps: activePlanSteps.length,
    completedSteps: completedStepIds.length,
    completionRatio: activePlanSteps.length > 0 ? completedStepIds.length / activePlanSteps.length : 0,
    steps: activePlanSteps,
    completedStepIds,
    body: activePlanBody,
    summary: activePlanSummary,
  };
}

const MAX_PLAN_AUTO_CONTINUATIONS = 2;

function incompleteActivePlanSnapshot() {
  const plan = getActivePlanSnapshot();
  if (!plan || plan.totalSteps <= 0 || plan.completedSteps >= plan.totalSteps) return null;
  return plan;
}

function planAutoContinuationPrompt(plan, attempt, reason = "budget") {
  const remaining = Math.max(0, plan.totalSteps - plan.completedSteps);
  return [
    `[系统自动续跑 ${attempt}/${MAX_PLAN_AUTO_CONTINUATIONS}]`,
    `当前已批准计划仍有 ${remaining} 个步骤未完成。`,
    reason === "budget" ? "上一执行窗口的工具额度已刷新。" : "上一响应只汇报了进度，没有完成计划。",
    "继续执行当前计划，不要重新制定计划，不要只报告进度。",
    "从上一次中断处继续，完成后验证实际产物，并为每个完成步骤调用 mark_step_complete。",
    "若正在生成 Office 文件，先检查现有内容，再按页或逻辑区块使用 batch 补齐，避免重复写入。",
  ].join("\n");
}

/** Persist the active plan to disk. Called on first mark_step_complete. */
function persistActivePlan() {
  if (!activePlanSteps) return;
  const session = currentSessionName();
  try {
    const completedStepIds = normalizeCompletedStepIds(activePlanSteps, [...(activeCompletedIds ?? [])]);
    activeCompletedIds = new Set(completedStepIds);
    savePlanState(session, activePlanSteps, completedStepIds, {
      body: activePlanBody,
      summary: activePlanSummary,
    });
    const stored = loadPlanState(session);
    activePlanUpdatedAt = stored?.updatedAt ?? new Date().toISOString();
  } catch (err) {
    console.error(`[launcher] persistActivePlan failed: ${err.message}`);
  }
}

/** Promote an approved pending plan, replacing any older unfinished plan. */
function activatePendingPlan() {
  if (!pendingPlan) return false;
  const nextPlan = pendingPlan;
  pendingPlan = null;
  activePlanSteps = nextPlan.steps;
  activeCompletedIds = new Set();
  activePlanBody = nextPlan.body;
  activePlanSummary = nextPlan.summary;
  activePlanUpdatedAt = null;
  pendingPlanRevision = null;
  persistActivePlan();
  console.error(`[launcher] plan activated (${activePlanSteps.length} steps) for session ${currentSessionName()}`);
  broadcastDashboardEvent({ kind: "plan-activated", session: currentSessionName() });
  return true;
}

/** Mark a step complete; archive the plan if all steps are done. */
function markStepDone(stepId) {
  hydrateActivePlanFromDisk();
  if (!activePlanSteps || !activeCompletedIds || !isKnownPlanStep(activePlanSteps, stepId)) return false;
  activeCompletedIds.add(stepId);
  persistActivePlan();
  if (isPlanComplete(activePlanSteps, [...activeCompletedIds])) {
    const session = currentSessionName();
    try {
      archivePlanState(session);
      console.error(`[launcher] plan archived (${activeCompletedIds.size}/${activePlanSteps.length} steps) for session ${session}`);
      broadcastDashboardEvent({ kind: "plan-archived", session });
    } catch (err) {
      console.error(`[launcher] archivePlanState failed: ${err.message}`);
    }
    resetPlanRefs();
  }
  return true;
}

function completeActivePlanStep(stepId) {
  hydrateActivePlanFromDisk();
  if (!activePlanSteps || !activeCompletedIds) {
    return { ok: false, error: "no active plan" };
  }
  if (!activePlanSteps.some((step) => step.id === stepId)) {
    return { ok: false, error: "step is not in the active plan" };
  }
  markStepDone(stepId);
  broadcastDashboardEvent({ kind: "plan-step-complete", stepId, manual: true });
  return { ok: true, plan: getActivePlanSnapshot() };
}

function cancelActivePlan() {
  const session = currentSessionName();
  resetPlanRefs();
  try { clearPlanState(session); } catch {}
  broadcastDashboardEvent({ kind: "plan-cancelled", session });
  return { ok: true };
}

// ── Scheduled tasks ─────────────────────────────────────────────
const promptQueueFile = resolve(visionoxDataDir, "prompt-queue.json");
const PROMPT_QUEUE_LIMIT = 5;
const ACCEPTED_PROMPT_LIMIT = 200;
const ACCEPTED_PROMPT_TTL_MS = 24 * 60 * 60 * 1000;

function normalizePromptQueueScope(value) {
  const scope = typeof value === "string" ? value.trim() : "";
  return scope && scope.length <= 800 ? scope : "default";
}

function normalizePromptQueueItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim().slice(0, 160) : null;
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  const images = Array.isArray(raw.images)
    ? raw.images.filter((image) => typeof image === "string" && image.startsWith("data:image/")).slice(0, 5)
    : [];
  if (!id || (!text && images.length === 0)) return null;
  return {
    id,
    text,
    images,
    status: raw.status === "failed" ? "failed" : "queued",
    error: raw.status === "failed" && typeof raw.error === "string" ? raw.error.slice(0, 500) : null,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
  };
}

function readPromptQueueState() {
  try {
    const parsed = JSON.parse(readFileSync(promptQueueFile, "utf8"));
    const queues = new Map();
    for (const [scope, rawItems] of Object.entries(parsed?.queues ?? {})) {
      const items = Array.isArray(rawItems) ? rawItems.map(normalizePromptQueueItem).filter(Boolean).slice(0, PROMPT_QUEUE_LIMIT) : [];
      if (items.length > 0) queues.set(normalizePromptQueueScope(scope), items);
    }
    const now = Date.now();
    const accepted = new Map(
      (Array.isArray(parsed?.accepted) ? parsed.accepted : [])
        .filter((entry) => entry && typeof entry.id === "string" && Number.isFinite(entry.acceptedAt) && now - entry.acceptedAt < ACCEPTED_PROMPT_TTL_MS)
        .slice(-ACCEPTED_PROMPT_LIMIT)
        .map((entry) => [entry.id, entry])
    );
    return { queues, accepted };
  } catch {
    return { queues: new Map(), accepted: new Map() };
  }
}

const promptQueueState = readPromptQueueState();

function writePromptQueueState() {
  try {
    const queues = Object.fromEntries([...promptQueueState.queues.entries()].filter(([, items]) => items.length > 0));
    const accepted = [...promptQueueState.accepted.values()].slice(-ACCEPTED_PROMPT_LIMIT);
    const tmpFile = `${promptQueueFile}.tmp`;
    writeFileSync(tmpFile, JSON.stringify({ version: 1, queues, accepted }, null, 2), "utf8");
    renameSync(tmpFile, promptQueueFile);
  } catch (err) {
    console.error(`[launcher] prompt queue write failed: ${err.message}`);
  }
}

function listPromptQueue(scope) {
  return [...(promptQueueState.queues.get(normalizePromptQueueScope(scope)) ?? [])];
}

function upsertPromptQueueItem(scope, rawItem) {
  const key = normalizePromptQueueScope(scope);
  const item = normalizePromptQueueItem(rawItem);
  if (!item) return { ok: false, error: "invalid queued prompt" };
  const current = listPromptQueue(key);
  const index = current.findIndex((entry) => entry.id === item.id);
  if (index >= 0) current[index] = item;
  else if (current.length < PROMPT_QUEUE_LIMIT) current.push(item);
  else return { ok: false, error: `queue limit is ${PROMPT_QUEUE_LIMIT}` };
  promptQueueState.queues.set(key, current);
  writePromptQueueState();
  return { ok: true, item, items: current };
}

function removePromptQueueItem(scope, id = null) {
  const key = normalizePromptQueueScope(scope);
  if (!id) {
    promptQueueState.queues.delete(key);
    writePromptQueueState();
    return { ok: true, items: [] };
  }
  const current = listPromptQueue(key).filter((entry) => entry.id !== id);
  if (current.length > 0) promptQueueState.queues.set(key, current);
  else promptQueueState.queues.delete(key);
  writePromptQueueState();
  return { ok: true, items: current };
}

function acceptedPromptRequest(id) {
  if (!id) return null;
  const entry = promptQueueState.accepted.get(id);
  if (!entry) return null;
  if (Date.now() - entry.acceptedAt >= ACCEPTED_PROMPT_TTL_MS) {
    promptQueueState.accepted.delete(id);
    return null;
  }
  return entry;
}

function rememberAcceptedPromptRequest(id, result = {}) {
  if (!id) return;
  promptQueueState.accepted.delete(id);
  promptQueueState.accepted.set(id, {
    id,
    acceptedAt: Date.now(),
    turnId: result.turnId ?? null,
  });
  while (promptQueueState.accepted.size > ACCEPTED_PROMPT_LIMIT) {
    promptQueueState.accepted.delete(promptQueueState.accepted.keys().next().value);
  }
  writePromptQueueState();
}

const schedulesFile = resolve(visionoxDataDir, "schedules.json");
const MIN_SCHEDULE_INTERVAL_MS = 60 * 1000;
const MAX_SCHEDULE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SCHEDULE_DELAY_MS = 2_147_000_000;
const SCHEDULE_BUSY_RETRY_MS = 30 * 1000;
const SCHEDULE_HISTORY_LIMIT = 20;
const MAX_CONCURRENT_SCHEDULE_RUNS = 2;
const SCHEDULE_RUN_MODES = new Set(["auto", "readonly", "confirm"]);
const SCHEDULE_TYPES = new Set(["interval", "daily", "weekly"]);
const SCHEDULE_KINDS = new Set(["prompt", "report", "session_cleanup"]);
const SCHEDULE_SESSION_CLEANUP_ACTIONS = new Set(["preview", "delete"]);
const SCHEDULE_SESSION_CLEANUP_STRENGTHS = new Set(["conservative", "standard", "aggressive"]);
const SCHEDULE_SESSION_CLEANUP_SEMANTIC_MODES = new Set(["off", "uncertain", "deep"]);
const SCHEDULE_REPORT_PERIODS = new Set(["daily", "weekly", "yearly", "custom"]);
const SCHEDULE_REPORT_RANGE_MODES = new Set([
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "last_7_days",
  "last_30_days",
  "this_year",
  "last_year",
  "custom",
]);
let schedules = [];
const scheduleTimers = new Map();
const runningScheduleIds = new Set();
const scheduleRunControllers = new Map();

function scheduleAbortError() {
  return new DOMException("scheduled task cancelled", "AbortError");
}

function throwIfScheduleAborted(signal) {
  if (signal?.aborted) throw scheduleAbortError();
}

function isValidDailyTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeToMinutes(value) {
  if (!isValidDailyTime(value)) return null;
  const [h, m] = value.split(":").map((v) => Number.parseInt(v, 10));
  return h * 60 + m;
}

function isValidRunWindow(start, end) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return s !== null && e !== null && s < e;
}

function isWeekday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function normalizeDayOfWeek(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(6, Math.floor(n)));
}

function normalizeReportPeriod(value, fallback = "weekly") {
  return SCHEDULE_REPORT_PERIODS.has(value) ? value : fallback;
}

function reportPeriodForRangeMode(mode) {
  if (mode === "today" || mode === "yesterday") return "daily";
  if (mode === "this_week" || mode === "last_week") return "weekly";
  if (mode === "this_year" || mode === "last_year") return "yearly";
  return "custom";
}

function legacyReportRangeMode(raw) {
  const period = normalizeReportPeriod(raw?.reportPeriod);
  if (period === "daily") return "yesterday";
  if (period === "weekly") return "last_week";
  if (period === "yearly") return "this_year";
  return "custom";
}

function normalizeReportRangeMode(value, fallback = "yesterday") {
  return SCHEDULE_REPORT_RANGE_MODES.has(value) ? value : fallback;
}

function normalizeReportDate(value) {
  if (typeof value !== "string" || !value.trim()) return new Date().toISOString().slice(0, 10);
  return value.trim().slice(0, 10);
}

function validateReportRange(mode, start, end) {
  if (mode !== "custom") return { ok: true };
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return { ok: false, error: "report custom range requires valid start and end dates" };
  }
  if (e < s) return { ok: false, error: "report end date must be after start date" };
  return { ok: true };
}

function isScheduleAllowedAt(task, atMs = Date.now()) {
  const date = new Date(atMs);
  if (task.weekdaysOnly && !isWeekday(date)) {
    return { ok: false, reason: "outside run window: weekdays only" };
  }
  if (task.windowEnabled) {
    const start = timeToMinutes(task.windowStart);
    const end = timeToMinutes(task.windowEnd);
    if (start === null || end === null || start >= end) {
      return { ok: false, reason: "invalid run window" };
    }
    const current = date.getHours() * 60 + date.getMinutes();
    if (current < start || current >= end) {
      return { ok: false, reason: `outside run window: ${task.windowStart}-${task.windowEnd}` };
    }
  }
  return { ok: true, reason: null };
}

function nextScheduleWindowStart(task, fromMs) {
  const candidate = new Date(fromMs);
  candidate.setSeconds(0, 0);
  const windowStart = task.windowEnabled ? task.windowStart : "00:00";
  const start = timeToMinutes(windowStart) ?? 0;
  for (let i = 0; i < 14; i++) {
    if (task.weekdaysOnly && !isWeekday(candidate)) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (task.windowEnabled) {
      const end = timeToMinutes(task.windowEnd);
      const current = candidate.getHours() * 60 + candidate.getMinutes();
      if (current < start) {
        candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
      } else if (end !== null && current >= end) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
        continue;
      }
    }
    if (isScheduleAllowedAt(task, candidate.getTime()).ok) return candidate.toISOString();
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
  }
  return null;
}

function computeNextScheduleRun(task, fromMs = Date.now()) {
  if (!task?.enabled) return null;
  let nextIso = null;
  if (task.type === "daily") {
    if (!isValidDailyTime(task.timeOfDay)) return null;
    const [h, m] = task.timeOfDay.split(":").map((v) => Number.parseInt(v, 10));
    const next = new Date(fromMs);
    next.setSeconds(0, 0);
    next.setHours(h, m, 0, 0);
    if (next.getTime() <= fromMs) next.setDate(next.getDate() + 1);
    nextIso = next.toISOString();
  } else if (task.type === "weekly") {
    if (!isValidDailyTime(task.timeOfDay)) return null;
    const [h, m] = task.timeOfDay.split(":").map((v) => Number.parseInt(v, 10));
    const targetDay = normalizeDayOfWeek(task.dayOfWeek, 1);
    const next = new Date(fromMs);
    next.setSeconds(0, 0);
    next.setHours(h, m, 0, 0);
    let addDays = (targetDay - next.getDay() + 7) % 7;
    if (addDays === 0 && next.getTime() <= fromMs) addDays = 7;
    if (addDays > 0) next.setDate(next.getDate() + addDays);
    nextIso = next.toISOString();
  } else {
    const intervalMs = Number(task.intervalMs);
    if (!Number.isFinite(intervalMs) || intervalMs < MIN_SCHEDULE_INTERVAL_MS || intervalMs > MAX_SCHEDULE_INTERVAL_MS) {
      return null;
    }
    nextIso = new Date(fromMs + intervalMs).toISOString();
  }
  return nextScheduleWindowStart(task, Date.parse(nextIso));
}

function isLegacySessionCleanupSchedule(raw, prompt) {
  const name = typeof raw?.name === "string" ? raw.name : "";
  const text = `${name}\n${prompt || ""}`;
  return /整理聊天记录|聊天记录整理|清理聊天记录/.test(text) && /(删除|清理|整理|无意义|天气|会话|聊天记录)/.test(text);
}

function cleanupMinConfidenceForStrength(strength) {
  if (strength === "conservative") return 0.9;
  if (strength === "aggressive") return 0.65;
  return 0.8;
}

function normalizeSchedule(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : randomUUID();
  const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
  let kind = SCHEDULE_KINDS.has(raw.kind) ? raw.kind : "prompt";
  if (isLegacySessionCleanupSchedule(raw, prompt)) {
    kind = "session_cleanup";
  }
  if (kind === "prompt" && !prompt) return null;
  const type = SCHEDULE_TYPES.has(raw.type) ? raw.type : "interval";
  const sessionCleanupAction = SCHEDULE_SESSION_CLEANUP_ACTIONS.has(raw.sessionCleanupAction) ? raw.sessionCleanupAction : "preview";
  const sessionCleanupStrength = SCHEDULE_SESSION_CLEANUP_STRENGTHS.has(raw.sessionCleanupStrength) ? raw.sessionCleanupStrength : "standard";
  const sessionCleanupSemanticMode = SCHEDULE_SESSION_CLEANUP_SEMANTIC_MODES.has(raw.sessionCleanupSemanticMode) ? raw.sessionCleanupSemanticMode : "uncertain";
  const reportRangeMode = normalizeReportRangeMode(raw.reportRangeMode, legacyReportRangeMode(raw));
  const reportPeriod = reportPeriodForRangeMode(reportRangeMode);
  const reportStartDate = normalizeReportDate(raw.reportStartDate);
  const reportEndDate = normalizeReportDate(raw.reportEndDate);
  if (kind === "report" && !validateReportRange(reportRangeMode, reportStartDate, reportEndDate).ok) return null;
  const nowIso = new Date().toISOString();
  const persistedNextRunAt = typeof raw.nextRunAt === "string" && Number.isFinite(Date.parse(raw.nextRunAt)) ? raw.nextRunAt : null;
  const persistedMissedRunAt = typeof raw.missedRunAt === "string" && Number.isFinite(Date.parse(raw.missedRunAt)) ? raw.missedRunAt : null;
  const missedRunAt = raw.enabled !== false && persistedNextRunAt && Date.parse(persistedNextRunAt) <= Date.now()
    ? persistedNextRunAt
    : persistedMissedRunAt;
  const task = {
    id,
    kind,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 80) : (kind === "report" ? "会话报告任务" : kind === "session_cleanup" ? "会话整理任务" : prompt.slice(0, 36)),
    prompt: kind === "prompt" ? prompt : "",
    sessionCleanupAction: kind === "session_cleanup" ? sessionCleanupAction : "preview",
    sessionCleanupStrength: kind === "session_cleanup" ? sessionCleanupStrength : "standard",
    sessionCleanupSemanticMode: kind === "session_cleanup" ? sessionCleanupSemanticMode : "off",
    reportRangeMode,
    reportPeriod,
    reportDate: normalizeReportDate(raw.reportDate),
    reportStartDate,
    reportEndDate,
    reportExport: raw.reportExport !== false,
    type,
    runMode: kind === "prompt" && SCHEDULE_RUN_MODES.has(raw.runMode) ? raw.runMode : "auto",
    intervalMs: type === "interval" ? Number(raw.intervalMs) || 60 * 60 * 1000 : null,
    timeOfDay: (type === "daily" || type === "weekly") && isValidDailyTime(raw.timeOfDay) ? raw.timeOfDay : "09:00",
    dayOfWeek: type === "weekly" ? normalizeDayOfWeek(raw.dayOfWeek, 1) : null,
    weekdaysOnly: raw.weekdaysOnly === true,
    windowEnabled: raw.windowEnabled === true,
    windowStart: isValidDailyTime(raw.windowStart) ? raw.windowStart : "09:00",
    windowEnd: isValidDailyTime(raw.windowEnd) ? raw.windowEnd : "18:00",
    enabled: raw.enabled !== false,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso,
    workspaceDir: typeof raw.workspaceDir === "string" && raw.workspaceDir.trim() ? raw.workspaceDir : workspaceDir,
    lastRunAt: typeof raw.lastRunAt === "string" ? raw.lastRunAt : null,
    lastStatus: typeof raw.lastStatus === "string" ? raw.lastStatus : null,
    lastError: typeof raw.lastError === "string" ? raw.lastError : null,
    runCount: Number.isFinite(raw.runCount) ? Math.max(0, Math.floor(raw.runCount)) : 0,
    history: Array.isArray(raw.history) ? raw.history.slice(0, SCHEDULE_HISTORY_LIMIT).map(normalizeScheduleHistoryEntry).filter(Boolean) : [],
    nextRunAt: typeof raw.nextRunAt === "string" ? raw.nextRunAt : null,
    missedRunAt,
  };
  if (task.type === "interval") {
    task.intervalMs = Math.max(MIN_SCHEDULE_INTERVAL_MS, Math.min(MAX_SCHEDULE_INTERVAL_MS, task.intervalMs));
    task.timeOfDay = null;
  } else {
    task.intervalMs = null;
  }
  task.nextRunAt = computeNextScheduleRun(task);
  return task;
}

function normalizeScheduleHistoryEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const startedAt = typeof raw.startedAt === "string" ? raw.startedAt : null;
  if (!startedAt) return null;
  return {
    runId: typeof raw.runId === "string" && raw.runId.trim() ? raw.runId : randomUUID(),
    startedAt,
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
    durationMs: Number.isFinite(raw.durationMs) ? Math.max(0, Math.floor(raw.durationMs)) : null,
    status: typeof raw.status === "string" ? raw.status : "unknown",
    manual: raw.manual === true,
    catchUp: raw.catchUp === true,
    accepted: raw.accepted === true,
    reason: typeof raw.reason === "string" ? raw.reason : null,
    summary: typeof raw.summary === "string" ? raw.summary : null,
    assistantMessageId: typeof raw.assistantMessageId === "string" ? raw.assistantMessageId : null,
    userMessageId: typeof raw.userMessageId === "string" ? raw.userMessageId : null,
    lastPromptTokens: Number.isFinite(raw.lastPromptTokens) ? Math.max(0, Math.floor(raw.lastPromptTokens)) : null,
    lastTurnCostUsd: Number.isFinite(raw.lastTurnCostUsd) ? Math.max(0, raw.lastTurnCostUsd) : null,
    totalCostUsd: Number.isFinite(raw.totalCostUsd) ? Math.max(0, raw.totalCostUsd) : null,
    workspaceDir: typeof raw.workspaceDir === "string" ? raw.workspaceDir : null,
    reportRangeMode: typeof raw.reportRangeMode === "string" ? raw.reportRangeMode : null,
    reportPeriod: typeof raw.reportPeriod === "string" ? raw.reportPeriod : null,
    reportStart: typeof raw.reportStart === "string" ? raw.reportStart : null,
    reportEnd: typeof raw.reportEnd === "string" ? raw.reportEnd : null,
    reportSessions: Number.isFinite(raw.reportSessions) ? Math.max(0, Math.floor(raw.reportSessions)) : null,
    reportMessages: Number.isFinite(raw.reportMessages) ? Math.max(0, Math.floor(raw.reportMessages)) : null,
    reportPath: typeof raw.reportPath === "string" ? raw.reportPath : null,
    cleanupAction: typeof raw.cleanupAction === "string" ? raw.cleanupAction : null,
    cleanupPreviewId: typeof raw.cleanupPreviewId === "string" ? raw.cleanupPreviewId : null,
    cleanupCandidates: Number.isFinite(raw.cleanupCandidates) ? Math.max(0, Math.floor(raw.cleanupCandidates)) : null,
    cleanupDeleted: Number.isFinite(raw.cleanupDeleted) ? Math.max(0, Math.floor(raw.cleanupDeleted)) : null,
    cleanupFailed: Number.isFinite(raw.cleanupFailed) ? Math.max(0, Math.floor(raw.cleanupFailed)) : null,
    cleanupArchive: Number.isFinite(raw.cleanupArchive) ? Math.max(0, Math.floor(raw.cleanupArchive)) : null,
    cleanupKeep: Number.isFinite(raw.cleanupKeep) ? Math.max(0, Math.floor(raw.cleanupKeep)) : null,
    cleanupExtract: Number.isFinite(raw.cleanupExtract) ? Math.max(0, Math.floor(raw.cleanupExtract)) : null,
    cleanupSemanticReviewed: Number.isFinite(raw.cleanupSemanticReviewed) ? Math.max(0, Math.floor(raw.cleanupSemanticReviewed)) : null,
    cleanupTrashRoot: typeof raw.cleanupTrashRoot === "string" ? raw.cleanupTrashRoot : null,
  };
}

function sameScheduleWorkspace(task) {
  if (!task?.workspaceDir) return true;
  try {
    return resolve(task.workspaceDir) === resolve(workspaceDir);
  } catch {
    return task.workspaceDir === workspaceDir;
  }
}

function readSchedules() {
  try {
    const parsed = JSON.parse(readFileSync(schedulesFile, "utf8"));
    if (!Array.isArray(parsed?.schedules)) return [];
    return parsed.schedules.map(normalizeSchedule).filter(Boolean);
  } catch {
    return [];
  }
}

function writeSchedules() {
  try {
    const tmpFile = `${schedulesFile}.tmp`;
    writeFileSync(tmpFile, JSON.stringify({ schedules }, null, 2));
    renameSync(tmpFile, schedulesFile);
  } catch (err) {
    console.error(`[launcher] writeSchedules failed: ${err.message}`);
  }
}

function repairInterruptedSchedules() {
  const nowIso = new Date().toISOString();
  let dirty = false;
  for (const task of schedules) {
    if (task.lastStatus !== "running") continue;
    const runningEntry = Array.isArray(task.history) ? task.history.find((entry) => entry?.status === "running") : null;
    const reason = "interrupted by launcher restart";
    if (runningEntry) {
      runningEntry.completedAt = nowIso;
      runningEntry.durationMs = Number.isFinite(Date.parse(runningEntry.startedAt)) ? Math.max(0, Date.parse(nowIso) - Date.parse(runningEntry.startedAt)) : null;
      runningEntry.status = "failed";
      runningEntry.accepted = false;
      runningEntry.reason = runningEntry.reason || reason;
      runningEntry.summary = runningEntry.summary || reason;
    }
    task.updatedAt = nowIso;
    task.lastStatus = "failed";
    task.lastError = reason;
    task.nextRunAt = computeNextScheduleRun(task);
    dirty = true;
    console.error(`[launcher] repaired interrupted schedule: ${task.id} (${task.name || "unnamed"})`);
  }
  if (dirty) writeSchedules();
}

function publicSchedule(task) {
  return {
    ...task,
    workspaceMismatch: !sameScheduleWorkspace(task),
    currentWorkspaceDir: workspaceDir,
  };
}

function refreshScheduleTimer(task) {
  const previous = scheduleTimers.get(task.id);
  if (previous) clearTimeout(previous);
  scheduleTimers.delete(task.id);
  if (!task.enabled || !task.nextRunAt) return;
  const due = Date.parse(task.nextRunAt);
  if (!Number.isFinite(due)) return;
  const delay = Math.max(0, Math.min(MAX_SCHEDULE_DELAY_MS, due - Date.now()));
  const timer = setTimeout(() => {
    void triggerSchedule(task.id, { manual: false });
  }, delay);
  scheduleTimers.set(task.id, timer);
}

function refreshAllScheduleTimers() {
  for (const timer of scheduleTimers.values()) clearTimeout(timer);
  scheduleTimers.clear();
  for (const task of schedules) refreshScheduleTimer(task);
  const missed = schedules.filter((task) => task.enabled && task.missedRunAt);
  if (missed.length > 0) {
    missed.forEach((task, index) => {
      setTimeout(() => {
        void triggerSchedule(task.id, { manual: false, catchUp: true });
      }, 1000 + index * 500);
    });
  }
}

function scheduleFromInput(input, previous = null) {
  const patch = input && typeof input === "object" ? input : {};
  const kind = SCHEDULE_KINDS.has(patch.kind) ? patch.kind : previous?.kind ?? "prompt";
  const type = SCHEDULE_TYPES.has(patch.type) ? patch.type : previous?.type ?? "interval";
  const name = typeof patch.name === "string" ? patch.name.trim() : previous?.name ?? "";
  const prompt = typeof patch.prompt === "string" ? patch.prompt.trim() : previous?.prompt ?? "";
  const enabled = typeof patch.enabled === "boolean" ? patch.enabled : previous?.enabled ?? true;
  const runMode = SCHEDULE_RUN_MODES.has(patch.runMode) ? patch.runMode : previous?.runMode ?? "auto";
  const weekdaysOnly = typeof patch.weekdaysOnly === "boolean" ? patch.weekdaysOnly : previous?.weekdaysOnly ?? false;
  const windowEnabled = typeof patch.windowEnabled === "boolean" ? patch.windowEnabled : previous?.windowEnabled ?? false;
  const windowStart = typeof patch.windowStart === "string" ? patch.windowStart : previous?.windowStart ?? "09:00";
  const windowEnd = typeof patch.windowEnd === "string" ? patch.windowEnd : previous?.windowEnd ?? "18:00";
  const reportRangeMode = normalizeReportRangeMode(
    patch.reportRangeMode ?? previous?.reportRangeMode,
    legacyReportRangeMode({ reportPeriod: patch.reportPeriod ?? previous?.reportPeriod })
  );
  const reportPeriod = reportPeriodForRangeMode(reportRangeMode);
  const reportDate = normalizeReportDate(patch.reportDate ?? previous?.reportDate);
  const reportStartDate = normalizeReportDate(patch.reportStartDate ?? previous?.reportStartDate);
  const reportEndDate = normalizeReportDate(patch.reportEndDate ?? previous?.reportEndDate);
  const reportExport = typeof patch.reportExport === "boolean" ? patch.reportExport : previous?.reportExport ?? true;
  const previousCleanupAction = SCHEDULE_SESSION_CLEANUP_ACTIONS.has(previous?.sessionCleanupAction) ? previous.sessionCleanupAction : "preview";
  const sessionCleanupAction = SCHEDULE_SESSION_CLEANUP_ACTIONS.has(patch.sessionCleanupAction)
    ? patch.sessionCleanupAction
    : previousCleanupAction;
  const previousCleanupStrength = SCHEDULE_SESSION_CLEANUP_STRENGTHS.has(previous?.sessionCleanupStrength) ? previous.sessionCleanupStrength : "standard";
  const sessionCleanupStrength = SCHEDULE_SESSION_CLEANUP_STRENGTHS.has(patch.sessionCleanupStrength)
    ? patch.sessionCleanupStrength
    : previousCleanupStrength;
  const previousCleanupSemanticMode = SCHEDULE_SESSION_CLEANUP_SEMANTIC_MODES.has(previous?.sessionCleanupSemanticMode) ? previous.sessionCleanupSemanticMode : "uncertain";
  const sessionCleanupSemanticMode = SCHEDULE_SESSION_CLEANUP_SEMANTIC_MODES.has(patch.sessionCleanupSemanticMode)
    ? patch.sessionCleanupSemanticMode
    : previousCleanupSemanticMode;
  if (kind === "prompt" && !prompt) return { ok: false, error: "prompt must be a non-empty string" };
  const reportRangeCheck = validateReportRange(reportRangeMode, reportStartDate, reportEndDate);
  if (kind === "report" && !reportRangeCheck.ok) return { ok: false, error: reportRangeCheck.error };
  if (name.length > 80) return { ok: false, error: "name must be 80 characters or fewer" };
  if (windowEnabled && !isValidRunWindow(windowStart, windowEnd)) {
    return { ok: false, error: "run window must use HH:mm and start before end" };
  }
  const nowIso = new Date().toISOString();
  const task = {
    id: previous?.id ?? randomUUID(),
    kind,
    name: name || (kind === "report" ? "会话报告任务" : kind === "session_cleanup" ? "会话整理任务" : prompt.slice(0, 36)),
    prompt: kind === "prompt" ? prompt : "",
    sessionCleanupAction: kind === "session_cleanup" ? sessionCleanupAction : "preview",
    sessionCleanupStrength: kind === "session_cleanup" ? sessionCleanupStrength : "standard",
    sessionCleanupSemanticMode: kind === "session_cleanup" ? sessionCleanupSemanticMode : "off",
    reportRangeMode,
    reportPeriod,
    reportDate,
    reportStartDate,
    reportEndDate,
    reportExport,
    type,
    runMode: kind === "prompt" ? runMode : "auto",
    intervalMs: null,
    timeOfDay: null,
    dayOfWeek: null,
    weekdaysOnly,
    windowEnabled,
    windowStart,
    windowEnd,
    enabled,
    createdAt: previous?.createdAt ?? nowIso,
    updatedAt: nowIso,
    workspaceDir: previous?.workspaceDir ?? workspaceDir,
    lastRunAt: previous?.lastRunAt ?? null,
    lastStatus: previous?.lastStatus ?? null,
    lastError: previous?.lastError ?? null,
    runCount: previous?.runCount ?? 0,
    history: previous?.history ?? [],
    nextRunAt: null,
    missedRunAt: previous?.missedRunAt ?? null,
  };
  if (type === "daily" || type === "weekly") {
    const timeOfDay = typeof patch.timeOfDay === "string" ? patch.timeOfDay : previous?.timeOfDay ?? "09:00";
    if (!isValidDailyTime(timeOfDay)) return { ok: false, error: "timeOfDay must use HH:mm in 24-hour local time" };
    task.timeOfDay = timeOfDay;
    if (type === "weekly") {
      task.dayOfWeek = normalizeDayOfWeek(patch.dayOfWeek ?? previous?.dayOfWeek, 1);
    }
  } else {
    const intervalMs = Number(patch.intervalMs ?? previous?.intervalMs ?? 60 * 60 * 1000);
    if (!Number.isFinite(intervalMs) || intervalMs < MIN_SCHEDULE_INTERVAL_MS || intervalMs > MAX_SCHEDULE_INTERVAL_MS) {
      return { ok: false, error: `intervalMs must be between ${MIN_SCHEDULE_INTERVAL_MS} and ${MAX_SCHEDULE_INTERVAL_MS}` };
    }
    task.intervalMs = Math.floor(intervalMs);
  }
  task.nextRunAt = computeNextScheduleRun(task);
  return { ok: true, task };
}

function recordScheduleRun(task, entry) {
  task.history = [entry, ...(Array.isArray(task.history) ? task.history : [])].slice(0, SCHEDULE_HISTORY_LIMIT);
}

function updateScheduleRun(task, runId, patch) {
  if (!task || !runId || !Array.isArray(task.history)) return null;
  const idx = task.history.findIndex((entry) => entry?.runId === runId);
  if (idx < 0) return null;
  const updated = normalizeScheduleHistoryEntry({ ...task.history[idx], ...patch });
  if (!updated) return null;
  task.history[idx] = updated;
  return updated;
}

function summarizeScheduleResult(text) {
  if (typeof text !== "string") return null;
  const summary = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
  if (!summary) return null;
  return summary.length > 260 ? `${summary.slice(0, 257)}...` : summary;
}

function scheduleRunStats(stats) {
  if (!stats || typeof stats !== "object") return {};
  return {
    lastPromptTokens: Number.isFinite(stats.lastPromptTokens) ? stats.lastPromptTokens : null,
    lastTurnCostUsd: Number.isFinite(stats.lastTurnCostUsd) ? stats.lastTurnCostUsd : null,
    totalCostUsd: Number.isFinite(stats.totalCostUsd) ? stats.totalCostUsd : null,
  };
}

function shiftLocalDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function reportRangeFromTask(task, baseDate = new Date()) {
  const rangeMode = normalizeReportRangeMode(task.reportRangeMode, legacyReportRangeMode(task));
  if (rangeMode === "custom") {
    return {
      rangeMode,
      period: "custom",
      anchorDate: new Date(task.reportEndDate || Date.now()),
      customRange: {
        start: new Date(task.reportStartDate || Date.now()),
        end: new Date(task.reportEndDate || Date.now()),
      },
    };
  }
  if (rangeMode === "last_7_days" || rangeMode === "last_30_days") {
    const days = rangeMode === "last_7_days" ? 7 : 30;
    return {
      rangeMode,
      period: "custom",
      anchorDate: baseDate,
      customRange: {
        start: shiftLocalDays(baseDate, -(days - 1)),
        end: baseDate,
      },
    };
  }
  let anchorDate = baseDate;
  if (rangeMode === "yesterday") anchorDate = shiftLocalDays(baseDate, -1);
  if (rangeMode === "last_week") anchorDate = shiftLocalDays(baseDate, -7);
  if (rangeMode === "last_year") anchorDate = new Date(baseDate.getFullYear() - 1, baseDate.getMonth(), baseDate.getDate());
  if (Number.isNaN(anchorDate.getTime())) anchorDate = new Date();
  return {
    rangeMode,
    period: reportPeriodForRangeMode(rangeMode),
    anchorDate,
    customRange: null,
  };
}

function writeScheduledReport(markdown, stats, task) {
  const dir = join(homedir(), "Downloads");
  mkdirSync(dir, { recursive: true });
  const period = stats?.period || task.reportPeriod || "report";
  const date = stats?.start instanceof Date ? formatDateKey(stats.start) : new Date().toISOString().slice(0, 10);
  const safeTaskName = String(task.name || "scheduled-report").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
  const fileName = `Visionox-Whale_${safeTaskName}_${period}_${date}.md`.replace(/[\\/:*?"<>|]/g, "_");
  const filePath = join(dir, fileName);
  writeFileSync(filePath, markdown, "utf8");
  rememberGeneratedArtifactPath(filePath);
  return filePath;
}

async function runScheduleReportTask(taskId, runId, startedAt = new Date().toISOString(), signal) {
  const task = schedules.find((item) => item.id === taskId);
  if (!task) return;
  try {
    throwIfScheduleAborted(signal);
    const baseDate = new Date(startedAt);
    const { rangeMode, period, anchorDate, customRange } = reportRangeFromTask(task, Number.isNaN(baseDate.getTime()) ? new Date() : baseDate);
    const { markdown, stats } = await generateReport(period, anchorDate, customRange, { signal });
    throwIfScheduleAborted(signal);
    const reportPath = task.reportExport ? writeScheduledReport(markdown, stats, task) : null;
    completeScheduleRun(task.id, runId, {
      status: "completed",
      reason: null,
      summary: summarizeScheduleResult(markdown),
      reportRangeMode: rangeMode,
      reportPeriod: stats.period,
      reportStart: stats.start?.toISOString?.() ?? null,
      reportEnd: stats.end?.toISOString?.() ?? null,
      reportSessions: stats.sessions,
      reportMessages: stats.messages,
      reportPath,
    });
  } catch (err) {
    const cancelled = signal?.aborted || err?.name === "AbortError";
    completeScheduleRun(task.id, runId, {
      status: cancelled ? "cancelled" : "failed",
      reason: cancelled ? "cancelled by user" : err.message || "scheduled report failed",
      summary: cancelled ? "cancelled by user" : err.message || "scheduled report failed",
    });
  }
}

async function runScheduleSessionCleanupTask(taskId, runId, startedAt = new Date().toISOString(), signal) {
  const task = schedules.find((item) => item.id === taskId);
  if (!task) return;
  try {
    throwIfScheduleAborted(signal);
    const preview = await buildSessionCleanupPreview({
      scanLimit: 500,
      returnLimit: 200,
      minConfidence: cleanupMinConfidenceForStrength(task.sessionCleanupStrength),
      semanticMode: task.sessionCleanupSemanticMode,
      includeReview: false,
    }, { signal });
    throwIfScheduleAborted(signal);
    const shouldDelete = task.sessionCleanupAction === "delete";
    const result = shouldDelete && preview.returnedCandidateCount > 0
      ? applySessionCleanup({ cleanupId: preview.cleanupId, confirm: true })
      : null;
    completeScheduleRun(task.id, runId, {
      status: "completed",
      reason: result && result.failedCount > 0 ? `${result.failedCount} session(s) failed to delete` : null,
      summary: summarizeSessionCleanup(preview, result),
      cleanupAction: shouldDelete ? "delete" : "preview",
      cleanupPreviewId: preview.cleanupId,
      cleanupCandidates: preview.candidateCount,
      cleanupDeleted: result?.deletedCount ?? 0,
      cleanupFailed: result?.failedCount ?? 0,
      cleanupArchive: preview.recommendationCounts?.archive ?? 0,
      cleanupKeep: preview.recommendationCounts?.keep ?? 0,
      cleanupExtract: preview.recommendationCounts?.extract ?? 0,
      cleanupSemanticReviewed: preview.semanticReviewed ?? 0,
      cleanupTrashRoot: result?.trashRoot ?? null,
    });
  } catch (err) {
    const cancelled = signal?.aborted || err?.name === "AbortError";
    completeScheduleRun(task.id, runId, {
      status: cancelled ? "cancelled" : "failed",
      reason: cancelled ? "cancelled by user" : err.message || "session cleanup failed",
      summary: cancelled ? "cancelled by user" : err.message || "session cleanup failed",
      cleanupAction: task.sessionCleanupAction === "delete" ? "delete" : "preview",
    });
  }
}

function completeScheduleRun(taskId, runId, patch) {
  const task = schedules.find((item) => item.id === taskId);
  if (!task) {
    runningScheduleIds.delete(taskId);
    scheduleRunControllers.delete(taskId);
    return;
  }
  const completedAt = patch.completedAt || new Date().toISOString();
  const startedAt = task.history?.find((entry) => entry?.runId === runId)?.startedAt;
  const durationMs = Number.isFinite(patch.durationMs)
    ? patch.durationMs
    : Math.max(0, Date.parse(completedAt) - (Number.isFinite(Date.parse(startedAt)) ? Date.parse(startedAt) : Date.now()));
  const status = patch.status || (patch.reason ? "failed" : "completed");
  task.updatedAt = completedAt;
  task.lastStatus = status;
  task.lastError = patch.reason || null;
  updateScheduleRun(task, runId, {
    ...patch,
    completedAt,
    durationMs,
    status,
    accepted: status === "completed",
    reason: patch.reason || null,
  });
  runningScheduleIds.delete(taskId);
  scheduleRunControllers.delete(taskId);
  if (task.enabled) {
    const next = Date.parse(task.nextRunAt);
    if (!Number.isFinite(next) || next <= Date.now()) {
      task.nextRunAt = computeNextScheduleRun(task, Date.now());
    }
    refreshScheduleTimer(task);
  }
  writeSchedules();
  broadcastDashboardEvent({
    kind: "schedule-run",
    id: task.id,
    runId,
    name: task.name,
    accepted: status === "completed",
    status: task.lastStatus,
    reason: task.lastError,
  });
}

function renderSchedulePrompt(task, startedAt, previousLastRunAt) {
  const now = new Date(startedAt);
  const vars = {
    date: formatDateKey(now),
    time: now.toTimeString().slice(0, 8),
    workspace: task.workspaceDir || workspaceDir,
    lastRunAt: previousLastRunAt || "",
    taskName: task.name || "",
  };
  let body = task.prompt;
  for (const [key, value] of Object.entries(vars)) {
    body = body.replaceAll(`{${key}}`, value);
  }
  const label = task.name || "scheduled task";
  const modeLine = task.runMode === "readonly"
    ? "请以只读方式执行：可以分析、总结、检查和提出建议，但不要修改文件、删除内容或执行有副作用的命令。"
    : "按用户配置的定时任务执行。";
  return [
    `[定时任务: ${label}]`,
    `绑定工作区: ${task.workspaceDir || workspaceDir}`,
    `触发时间: ${startedAt}`,
    modeLine,
    "",
    body,
  ].join("\n");
}

function createScheduleConfirmationMessage(task, startedAt) {
  const assistantId = `assistant-${Date.now()}-${nextMsgId++}`;
  const text = [
    `定时任务“${task.name || "未命名任务"}”已到触发时间，但该任务设置为“需要确认”。`,
    "",
    `绑定工作区：${task.workspaceDir || workspaceDir}`,
    `触发时间：${startedAt}`,
    "",
    "请在“任务”页点击“立即运行”后再执行。"
  ].join("\n");
  pushMessage({ id: assistantId, role: "assistant", text });
  appendActiveMessage({ role: "assistant", text });
  broadcastDashboardEvent({ kind: "assistant_final", id: assistantId, text });
}

async function triggerSchedule(id, { manual = false, catchUp = false } = {}) {
  const task = schedules.find((item) => item.id === id);
  if (!task) return { ok: false, error: "schedule not found" };
  if (runningScheduleIds.has(id)) {
    if (!manual) {
      task.nextRunAt = computeNextScheduleRun(task, Date.now());
      writeSchedules();
      refreshScheduleTimer(task);
    }
    return { ok: true, accepted: false, reason: "task is already running", runId: null, schedule: publicSchedule(task) };
  }
  if (runningScheduleIds.size >= MAX_CONCURRENT_SCHEDULE_RUNS) {
    const reason = `scheduled task concurrency limit reached (${MAX_CONCURRENT_SCHEDULE_RUNS})`;
    if (!manual) {
      task.missedRunAt = new Date().toISOString();
      task.lastStatus = "deferred";
      task.lastError = reason;
      task.nextRunAt = computeNextScheduleRun(task, Date.now());
      writeSchedules();
      refreshScheduleTimer(task);
      setTimeout(() => void triggerSchedule(task.id, { manual: false, catchUp: true }), SCHEDULE_BUSY_RETRY_MS);
    }
    return { ok: true, accepted: false, reason, runId: null, schedule: publicSchedule(task) };
  }
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const startedMs = Date.parse(startedAt);
  const previousLastRunAt = task.lastRunAt;
  task.lastRunAt = startedAt;
  task.missedRunAt = null;
  if (!sameScheduleWorkspace(task)) {
    const reason = `workspace mismatch: task is bound to ${task.workspaceDir}, current workspace is ${workspaceDir}`;
    const completedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    task.runCount += 1;
    task.lastStatus = "skipped";
    task.lastError = reason;
    task.nextRunAt = computeNextScheduleRun(task);
    recordScheduleRun(task, {
      runId,
      startedAt,
      completedAt,
      durationMs: Math.max(0, Date.parse(completedAt) - startedMs),
      status: "skipped",
      manual,
      catchUp,
      accepted: false,
      reason,
      summary: reason,
      workspaceDir,
    });
    writeSchedules();
    refreshScheduleTimer(task);
    broadcastDashboardEvent({
      kind: "schedule-run",
      id: task.id,
      runId,
      name: task.name,
      accepted: false,
      status: task.lastStatus,
      reason: task.lastError,
    });
    return { ok: true, accepted: false, reason, runId, schedule: publicSchedule(task) };
  }
  const windowCheck = manual || catchUp ? { ok: true, reason: null } : isScheduleAllowedAt(task, Date.parse(startedAt));
  if (!windowCheck.ok) {
    const reason = windowCheck.reason || "outside run window";
    const completedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    task.runCount += 1;
    task.lastStatus = "skipped";
    task.lastError = reason;
    task.nextRunAt = computeNextScheduleRun(task, Date.parse(startedAt));
    recordScheduleRun(task, {
      runId,
      startedAt,
      completedAt,
      durationMs: Math.max(0, Date.parse(completedAt) - startedMs),
      status: "skipped",
      manual,
      catchUp,
      accepted: false,
      reason,
      summary: reason,
      workspaceDir,
    });
    writeSchedules();
    refreshScheduleTimer(task);
    broadcastDashboardEvent({
      kind: "schedule-run",
      id: task.id,
      runId,
      name: task.name,
      accepted: false,
      status: task.lastStatus,
      reason: task.lastError,
    });
    return { ok: true, accepted: false, reason, runId, schedule: publicSchedule(task) };
  }
  if (task.runMode === "confirm" && !manual) {
    const reason = "waiting for manual confirmation";
    const completedAt = new Date().toISOString();
    if (task.lastStatus !== "pending_confirmation") {
      createScheduleConfirmationMessage(task, startedAt);
    }
    task.updatedAt = new Date().toISOString();
    task.runCount += 1;
    task.lastStatus = "pending_confirmation";
    task.lastError = reason;
    task.nextRunAt = computeNextScheduleRun(task);
    recordScheduleRun(task, {
      runId,
      startedAt,
      completedAt,
      durationMs: Math.max(0, Date.parse(completedAt) - startedMs),
      status: "pending_confirmation",
      manual,
      catchUp,
      accepted: false,
      reason,
      summary: reason,
      workspaceDir,
    });
    writeSchedules();
    refreshScheduleTimer(task);
    broadcastDashboardEvent({
      kind: "schedule-run",
      id: task.id,
      runId,
      name: task.name,
      accepted: false,
      status: task.lastStatus,
      reason: task.lastError,
    });
    return { ok: true, accepted: false, reason, runId, schedule: publicSchedule(task) };
  }
  task.updatedAt = startedAt;
  task.runCount += 1;
  task.lastStatus = "running";
  task.lastError = null;
  task.nextRunAt = computeNextScheduleRun(task);
  runningScheduleIds.add(task.id);
  const runController = new AbortController();
  scheduleRunControllers.set(task.id, { runId, controller: runController });
  recordScheduleRun(task, {
    runId,
    startedAt,
    status: "running",
    manual,
    catchUp,
    accepted: true,
    reason: null,
    workspaceDir,
  });
  writeSchedules();
  refreshScheduleTimer(task);
  broadcastDashboardEvent({
    kind: "schedule-run",
    id: task.id,
    runId,
    name: task.name,
    accepted: true,
    status: task.lastStatus,
    reason: task.lastError,
  });
  if (task.kind === "report") {
    void runScheduleReportTask(task.id, runId, startedAt, runController.signal);
    return { ok: true, accepted: true, runId, schedule: publicSchedule(task) };
  }
  if (task.kind === "session_cleanup") {
    void runScheduleSessionCleanupTask(task.id, runId, startedAt, runController.signal);
    return { ok: true, accepted: true, runId, schedule: publicSchedule(task) };
  }
  const prompt = renderSchedulePrompt(task, startedAt, previousLastRunAt);
  let result;
  try {
    result = await ctx.submitPrompt(prompt, null, null, {
      readonly: task.runMode === "readonly",
      newConversation: true,
      signal: runController.signal,
      onComplete: (done) => {
        completeScheduleRun(task.id, runId, {
          status: done.cancelled ? "cancelled" : done.ok ? "completed" : "failed",
          reason: done.cancelled ? "cancelled by user" : done.ok ? null : done.error || "scheduled task failed",
          summary: done.cancelled ? "cancelled by user" : done.ok ? summarizeScheduleResult(done.assistantText) : done.error || "scheduled task failed",
          assistantMessageId: done.assistantMessageId,
          userMessageId: done.userMessageId,
          ...scheduleRunStats(done.stats),
        });
      },
    });
  } catch (err) {
    result = { accepted: false, reason: err.message };
  }
  if (!result.accepted) {
    const reason = result.reason ?? "loop is busy";
    const shouldDefer = !manual && /busy/i.test(reason);
    completeScheduleRun(task.id, runId, {
      status: manual ? "rejected" : shouldDefer ? "deferred" : "skipped",
      reason,
      summary: reason,
    });
    if (shouldDefer) {
      task.missedRunAt = startedAt;
      writeSchedules();
      setTimeout(() => {
        void triggerSchedule(task.id, { manual: false, catchUp: true });
      }, SCHEDULE_BUSY_RETRY_MS);
    }
    return { ok: true, accepted: false, reason, runId, schedule: publicSchedule(task) };
  }
  return { ok: true, accepted: true, runId, schedule: publicSchedule(task) };
}

function cancelScheduleRun(id) {
  const task = schedules.find((item) => item.id === id);
  if (!task) return { ok: false, error: "schedule not found" };
  const active = scheduleRunControllers.get(id);
  if (!active || !runningScheduleIds.has(id)) {
    return { ok: false, error: "task is not running" };
  }
  active.controller.abort();
  task.lastStatus = "stopping";
  task.lastError = "cancellation requested";
  task.updatedAt = new Date().toISOString();
  writeSchedules();
  broadcastDashboardEvent({ kind: "schedule-run", id, runId: active.runId, name: task.name, status: "stopping", reason: task.lastError });
  return { ok: true, cancelled: true, runId: active.runId, schedule: publicSchedule(task) };
}

schedules = readSchedules();
repairInterruptedSchedules();

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
let activeOperation = null;
let pendingModelSwitch = null;

function publicActiveOperation(operation = activeOperation) {
  if (!operation) return null;
  return {
    id: operation.id,
    kind: operation.kind,
    state: operation.state,
    startedAt: operation.startedAt,
    stopRequestedAt: operation.stopRequestedAt ?? null,
  };
}

jobs.setChangeListener?.((change) => {
  broadcastDashboardEvent({ kind: "background-job-change", ...change });
});

function beginActiveOperation(kind) {
  const operation = {
    id: randomUUID(),
    kind,
    state: "running",
    startedAt: new Date().toISOString(),
    stopRequestedAt: null,
    controller: new AbortController(),
  };
  activeOperation = operation;
  broadcastDashboardEvent({ kind: "operation-change", operation: publicActiveOperation(operation) });
  return operation;
}

function finishActiveOperation(operation) {
  if (!operation || activeOperation?.id !== operation.id) return;
  broadcastDashboardEvent({
    kind: "operation-change",
    operation: { ...publicActiveOperation(operation), state: operation.controller.signal.aborted ? "cancelled" : "completed" },
  });
  activeOperation = null;
}

function operationKindForPrompt(text, opts = {}) {
  if (opts.newConversation === true) return "scheduled-prompt";
  if (text === "/compact") return "compact";
  if (text?.startsWith?.("/btw ")) return "side-question";
  if (text === "/report" || text?.startsWith?.("/report ")) return "report";
  if (text?.startsWith?.("/learn")) return "learn";
  return "chat";
}

function modelRuntimeOptions(modelConfig) {
  const provider = getActiveProvider(config);
  const activeModel = provider?.models?.find((model) => model.id === modelConfig.model);
  const legacyVision = { "deepseek-v4-pro": { vision: true, visionDetail: "high" } }[modelConfig.model] ?? {};
  return {
    model: modelConfig.model,
    autoEscalate: modelConfig.autoEscalate,
    vision: activeModel?.multimodal === true || legacyVision.vision === true,
    visionDetail: activeModel?.multimodal === true ? "high" : legacyVision.visionDetail ?? "",
  };
}

function commitModelSwitch(modelConfig, source = "model") {
  const previousModel = loop?.model ?? null;
  activeContextPolicy = applyContextCap(modelConfig.model);
  const result = loop?.configure(modelRuntimeOptions(modelConfig));
  const contextMessages = loop?.log?.toMessages?.().length ?? 0;
  const modelSwitch = result?.modelSwitch ?? {
    previousModel,
    model: loop?.model ?? modelConfig.model,
    messageCount: contextMessages,
    changedCount: 0,
    reasoningAdded: 0,
    reasoningRemoved: 0,
    tokensSaved: 0,
    contextStatus: loop?.contextStatus?.() ?? null,
  };
  void syncActiveSessionFromLoop();
  console.error(`[launcher] ${source} switch: ${modelSwitch.previousModel ?? "none"} -> ${modelSwitch.model}; context=${modelSwitch.messageCount}`);
  return { ...modelSwitch, deferred: false };
}

function requestModelSwitch(modelConfig, source = "model") {
  if (busy && loop?.model !== modelConfig.model) {
    pendingModelSwitch = { modelConfig, source };
    return {
      previousModel: loop?.model ?? null,
      model: modelConfig.model,
      messageCount: loop?.log?.toMessages?.().length ?? 0,
      contextStatus: loop?.contextStatus?.(modelConfig.model) ?? null,
      deferred: true,
    };
  }
  // A later selection of the current model cancels an earlier deferred switch.
  pendingModelSwitch = null;
  return commitModelSwitch(modelConfig, source);
}

function commitPendingModelSwitch() {
  if (!pendingModelSwitch) return null;
  const pending = pendingModelSwitch;
  pendingModelSwitch = null;
  return commitModelSwitch(pending.modelConfig, pending.source);
}

// P2-3: install_skill rate limiter
const skillInstallTimes = [];
let installingSkill = false;

// ── Messages store ──────────────────────────────────────────────
let nextMsgId = 1;
const messages = [];
const DASHBOARD_MESSAGE_WINDOW = 60;
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

// Persistent append stream for the active session — avoids open/write/close per
// message (appendFile does all three every call). Lazily opened; closed before
// any rename/rm so Windows doesn't hold the file open.
let activeSessionStream = null;

function getActiveSessionStream() {
  if (!activeSessionStream) {
    const stream = createWriteStream(activeSessionFile, { flags: "a" });
    activeSessionStream = stream;
    stream.on("error", (err) => {
      if (activeSessionStream === stream) activeSessionStream = null;
      console.error(`[launcher] active-session stream error: ${err.message}`);
    });
  }
  return activeSessionStream;
}

function closeActiveSessionStream() {
  if (activeSessionStream) {
    const s = activeSessionStream;
    activeSessionStream = null;
    return new Promise((resolve) => {
      s.end(() => resolve());
    });
  }
  return Promise.resolve();
}

function appendActiveMessage(msg) {
  try {
    const record = {
      role: msg.role,
      content: msg.content !== undefined ? msg.content : msg.text ?? "",
      ...(Array.isArray(msg.images) && msg.images.length > 0 ? { images: msg.images } : {}),
      ...(msg.reasoning ? { reasoning: msg.reasoning } : {}),
      ...(msg.toolName ? { toolName: msg.toolName } : {}),
      ...(msg.toolArgs !== undefined ? { toolArgs: msg.toolArgs } : {}),
    };
    const stream = getActiveSessionStream();
    stream.write(`${JSON.stringify(record)}\n`);
  } catch (err) {
    console.error(`[launcher] active-session append failed: ${err.message}`);
  }
}

async function writeActiveSessionEntries(entries) {
  await closeActiveSessionStream();
  const serialized = serializeActiveSession(entries);
  const tmpFile = `${activeSessionFile}.tmp`;
  await writeFile(tmpFile, serialized, "utf8");
  await rename(tmpFile, activeSessionFile);
}

async function syncActiveSessionFromLoop(pendingUser = null) {
  if (!loop?.log?.toMessages) return;
  try {
    const entries = loop.log.toMessages();
    const pendingText = typeof pendingUser?.text === "string" ? pendingUser.text : "";
    if (pendingText) {
      const lastUser = [...entries].reverse().find((entry) => entry?.role === "user");
      const lastUserText = typeof lastUser?.content === "string" ? lastUser.content : "";
      if (lastUserText !== pendingText) {
        entries.push({
          role: "user",
          content: pendingText,
          ...(Array.isArray(pendingUser.images) && pendingUser.images.length > 0 ? { images: pendingUser.images } : {}),
        });
      }
    }
    await writeActiveSessionEntries(entries);
    await writeActiveSessionMeta({ messageCount: entries.length });
  } catch (err) {
    console.error(`[launcher] active-session model sync failed: ${err.message}`);
  }
}

async function finalizeActiveSession() {
  await closeActiveSessionStream();
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
      const raw = await readFile(destFile, "utf8");
      const messageCount = raw.split(/\r?\n/).filter((line) => line.trim()).length;
      writeSessionMeta(ts, { messageCount });
    }
    console.error(`[launcher] active session finalized: ${destFile}`);
    broadcastDashboardEvent({ kind: "sessions-changed", action: "finalize", name: ts });
    return ts;
  } catch (err) {
    console.error(`[launcher] failed to finalize active session: ${err.message}`);
    return null;
  }
}

async function clearActiveSession() {
  await closeActiveSessionStream();
  try {
    await rm(activeSessionFile, { force: true });
    await rm(activeSessionMetaFile, { force: true });
  } catch (err) {
    console.error(`[launcher] failed to clear active session: ${err.message}`);
  }
}

async function writeActiveSessionMeta(patch = {}) {
  try {
    let current = {};
    try {
      current = JSON.parse(await readFile(activeSessionMetaFile, "utf8"));
    } catch {
    }
    const sessionStat = await fsStat(activeSessionFile);
    const mode = config.mode || "general";
    const modeInfo = modeSummary(mode);
    const now = new Date().toISOString();
    const meta = {
      version: 1,
      ...current,
      ...patch,
      mode,
      modeLabel: modeInfo.label,
      modeDescription: modeInfo.description,
      workspace: workspaceDir,
      messageCount: Number.isFinite(patch.messageCount) ? Math.max(0, Math.floor(patch.messageCount)) : messages.length,
      messageCountFileSize: sessionStat.size,
      messageCountFileMtimeMs: sessionStat.mtimeMs,
      savedAt: patch.savedAt || current.savedAt || now,
      updatedAt: now,
      sessionMemories: sessionMemories.map((memory) => ({ ...memory })),
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
    const parsed = parseActiveSessionJsonl(raw);
    const entries = parsed.entries;
    if (entries.length === 0) {
      await clearActiveSession();
      return false;
    }
    if (parsed.errors.length > 0) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backup = `${activeSessionFile}.corrupt-${stamp}`;
      try {
        await writeFile(backup, raw, "utf8");
        await writeActiveSessionEntries(entries);
        console.error(`[launcher] active session repaired: kept ${entries.length} records, skipped ${parsed.errors.length}; backup=${backup}`);
      } catch (err) {
        console.error(`[launcher] failed to repair active session: ${err.message}`);
      }
    }
    const modelEntries = activeEntriesForModel(entries);
    if (loop && modelEntries.length > 0) loop.adoptHistory?.(modelEntries, loop.model) ?? loop.log.compactInPlace(modelEntries);
    messages.length = 0;
    nextMsgId = 1;
    for (const entry of activeEntriesForDashboard(entries)) {
      pushMessage(entry);
      nextMsgId++;
    }
    try {
      const metaRaw = await readFile(activeSessionMetaFile, "utf8");
      const meta = JSON.parse(metaRaw);
      restoreSessionMemories(meta.sessionMemories);
      const modeRestore = applyModeForSessionMeta(meta);
      if (!modeRestore.changed && client) rebuildLoopPreservingContext(client, workspaceDir);
    } catch {
      // ignore missing/broken meta
    }
    await writeActiveSessionMeta({ messageCount: entries.length });
    console.error(`[launcher] active session restored: ui=${messages.length}, model=${modelEntries.length}`);
    return true;
  } catch (err) {
    console.error(`[launcher] failed to load active session: ${err.message}`);
    return false;
  }
}

async function resetActiveConversation({ withWelcome = true, reason = "new conversation" } = {}) {
  await finalizeActiveSession();
  if (loop) loop.clearLog();
  clearSessionMemories();
  clearTutorMode();
  clearLearningMode();
  resetPlanRefs();
  generatedArtifactPaths.clear();
  try { clearPlanState(currentSessionName()); } catch {}
  if (client) {
    loop = buildLoop(client, workspaceDir);
    ctx.loop = loop;
    console.error(`[launcher] loop rebuilt for ${reason} (mode: ${config.mode}, model=${effectiveModelConfig(config).model}, effort=${config.reasoningEffort ?? "max"})`);
  }
  if (eventizer) {
    eventizer = new Eventizer();
    try { eventSink?.append(eventizer.emitSessionOpened(0, "desktop", 0)); } catch {}
  }
  messages.length = 0;
  nextMsgId = 1;
  if (withWelcome) {
    const welcomeId = `assistant-${Date.now()}`;
    const welcomeMsg = { id: welcomeId, role: "assistant", text: "我是你的AI助手，我可以帮你原理图检查、脚本分析、光学数据采集、编辑文件、执行命令、搜索网络。直接告诉我要做什么吧。" };
    pushMessage(welcomeMsg);
    broadcastDashboardEvent({ kind: "messages-reset", messages: [welcomeMsg], totalMessages: 1 });
  } else {
    broadcastDashboardEvent({ kind: "messages-reset", messages: [], totalMessages: 0 });
  }
}

function isValidSessionName(name) {
  const value = String(name || "");
  return value.length > 0 && value.length <= 64 && /^[\w.\-\u4e00-\u9fa5]+$/u.test(value);
}

function sessionArtifactPath(name, suffix) {
  if (!isValidSessionName(name)) throw new Error(`Invalid session name: ${name}`);
  const p = resolve(sessionsDir, `${name}${suffix}`);
  const root = resolve(sessionsDir);
  if (p !== root && !p.startsWith(root + sep)) throw new Error(`Invalid session path: ${name}`);
  return p;
}

function sessionJsonlPath(name) {
  return sessionArtifactPath(name, ".jsonl");
}

function sessionMetaPath(name) {
  return sessionArtifactPath(name, ".meta.json");
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
  let messageCountSignature = {};
  if (Number.isFinite(patch.messageCount)) {
    try {
      const sessionStat = statSync(sessionJsonlPath(name));
      messageCountSignature = {
        messageCountFileSize: sessionStat.size,
        messageCountFileMtimeMs: sessionStat.mtimeMs,
      };
    } catch {
    }
  }
  const mode = config.mode || "general";
  const modeInfo = modeSummary(mode);
  const next = {
    version: 1,
    ...current,
    ...patch,
    ...messageCountSignature,
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
  return { changed: previous !== modeId, mode: modeId, previous };
}

// ── Conversation report engine ─────────────────────────────────
// Generate daily / weekly / yearly summaries from archived sessions and the
// active session.  Uses the currently active LLM provider and returns the
// report markdown in-memory (no file is persisted).

const REPORT_MAX_PROMPT_CHARS = 80_000;
const REPORT_MAX_PER_MESSAGE_CHARS = 6_000;

function getLocalDateRange(period, anchorDate = new Date()) {
  const d = new Date(anchorDate);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid anchor date: ${anchorDate}`);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  let end;
  if (period === "daily") {
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else if (period === "weekly") {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day; // Monday as first day
    start.setDate(start.getDate() + mondayOffset);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (period === "yearly") {
    start.setMonth(0, 1);
    end = new Date(start.getFullYear() + 1, 0, 1);
  } else {
    throw new Error(`unsupported report period: ${period}`);
  }
  return { start, end };
}

function formatDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const REPORT_COLLECTION_MAX_CHARS = 120_000;
async function scanJsonlMessages(filePath, retainChars = 0) {
  const messages = [];
  let retainedChars = 0;
  let totalMessages = 0;
  try {
    const input = createReadStream(filePath, { encoding: "utf8" });
    const lines = createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== "object") continue;
      totalMessages++;
      if (retainChars <= 0) continue;
      const content = String(parsed.content ?? "");
      const message = {
        role: typeof parsed.role === "string" ? parsed.role : "unknown",
        content: content.length > REPORT_MAX_PER_MESSAGE_CHARS ? content.slice(0, REPORT_MAX_PER_MESSAGE_CHARS) : content,
      };
      const chars = message.content.length + message.role.length + 16;
      while (messages.length > 0 && retainedChars + chars > retainChars) {
        const removed = messages.shift();
        retainedChars -= removed.__chars;
      }
      if (chars <= retainChars) {
        Object.defineProperty(message, "__chars", { value: chars, enumerable: false });
        messages.push(message);
        retainedChars += chars;
      }
    }
  } catch {
    return { messages: [], totalMessages: 0, retainedChars: 0 };
  }
  return { messages, totalMessages, retainedChars };
}

// Short-TTL cache for collectConversations: the dashboard's "Generate" click
// calls /report/preview then /report back-to-back, each invoking
// collectConversations independently → double full-read of all in-range
// sessions. Cache the result for 30s so the second call is free.
const REPORT_CONV_CACHE_TTL_MS = 30_000;
let _reportConvCache = { key: null, ts: 0, value: null };

async function collectConversations(start, end) {
  const cacheKey = `${start.getTime()}-${end.getTime()}`;
  if (_reportConvCache.key === cacheKey && Date.now() - _reportConvCache.ts < REPORT_CONV_CACHE_TTL_MS) {
    return _reportConvCache.value;
  }
  const conversations = [];
  let totalMessages = 0;
  const candidates = [];

  // Archived sessions
  try {
    const files = await readdir(sessionsDir);
    for (const name of files) {
      if (!name.endsWith(".jsonl") || name.endsWith(".events.jsonl")) continue;
      const filePath = resolve(sessionsDir, name);
      let mtime;
      try {
        mtime = (await fsStat(filePath)).mtime;
      } catch {
        continue;
      }
      if (mtime < start || mtime >= end) continue;
      candidates.push({ source: name.replace(/\.jsonl$/, ""), mtime, filePath });
    }
  } catch (err) {
    console.error(`[report] failed to list sessions: ${err.message}`);
  }

  // Active session (if current moment falls inside the requested range)
  const now = new Date();
  if (now >= start && now < end && hasUserMessage()) candidates.push({ source: "active", mtime: now, filePath: activeSessionFile });

  candidates.sort((a, b) => b.mtime - a.mtime);
  let remainingChars = REPORT_COLLECTION_MAX_CHARS;
  for (const candidate of candidates) {
    const scanned = await scanJsonlMessages(candidate.filePath, remainingChars);
    totalMessages += scanned.totalMessages;
    if (scanned.messages.length > 0) {
      conversations.push({ source: candidate.source, mtime: candidate.mtime, messages: scanned.messages });
      remainingChars = Math.max(0, remainingChars - scanned.retainedChars);
    }
  }
  conversations.sort((a, b) => a.mtime - b.mtime);
  const result = { conversations, totalMessages, totalSessions: candidates.length };
  _reportConvCache = { key: cacheKey, ts: Date.now(), value: result };
  return result;
}

async function previewReportSources(period, anchorDate, customRange = null) {
  let start;
  let end;
  if (customRange && customRange.start && customRange.end) {
    const s = new Date(customRange.start);
    const e = new Date(customRange.end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      throw new Error("自定义时间范围无效");
    }
    start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
    end = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1, 0, 0, 0, 0);
  } else {
    ({ start, end } = getLocalDateRange(period, anchorDate));
  }
  const { conversations, totalMessages, totalSessions } = await collectConversations(start, end);
  const MAX_PREVIEW_CHARS = 8_000;
  const sources = [];
  let chars = 0;
  for (const conv of conversations) {
    const preview = conv.messages.slice(-5).map((m) => {
      let content = String(m.content ?? "").trim().replace(/\s+/g, " ");
      if (content.length > 160) content = content.slice(0, 160) + "…";
      return { role: m.role || "unknown", content };
    });
    const entry = {
      source: conv.source,
      mtime: conv.mtime.toISOString(),
      messageCount: conv.messages.length,
      preview
    };
    const entryChars = JSON.stringify(entry).length;
    if (chars + entryChars > MAX_PREVIEW_CHARS && sources.length > 0) break;
    sources.push(entry);
    chars += entryChars;
  }
  return {
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    totalSessions,
    totalMessages,
    sources
  };
}

function buildConversationText(conversations) {
  let chars = 0;
  const lines = [];
  for (const conv of conversations) {
    lines.push(`\n## 会话: ${conv.source} (${formatDateKey(conv.mtime)})`);
    for (const msg of conv.messages) {
      const role = msg.role || "unknown";
      let content = String(msg.content ?? "").trim();
      if (content.length > REPORT_MAX_PER_MESSAGE_CHARS) {
        content = content.slice(0, REPORT_MAX_PER_MESSAGE_CHARS) + "\n\n… (truncated)";
      }
      if (!content) continue;
      const text = `### ${role}\n${content}`;
      chars += text.length;
      lines.push(text);
    }
  }
  let combined = lines.join("\n\n");
  if (combined.length > REPORT_MAX_PROMPT_CHARS) {
    // Drop oldest messages until it fits
    while (combined.length > REPORT_MAX_PROMPT_CHARS && lines.length > 4) {
      lines.shift();
      combined = lines.join("\n\n");
    }
    combined = `> 部分早期消息因长度限制被省略。\n\n${combined}`;
  }
  return combined;
}

const DEFAULT_REPORT_PROMPT_TEMPLATE = `你是一位高效的对话记录整理助手。请仅根据下方提供的 Visionox-Whale 历史会话记录生成一份结构化的 {periodLabel}。
要求：
1. 使用 Markdown 格式，标题为「{date} Visionox-Whale {periodLabel}」。
2. 你只能基于提供的对话记录进行总结；不要主动读取或引用工作区文件、代码库、网络内容。
3. 如果某些信息在对话记录中不清楚或缺失，请在报告中直接说明，不要编造。
4. 只有在用户明确要求、或对话记录本身明确提到工作区文件时，才可以补充引用工作区内容。
5. 包含以下章节：
   - 概览：统计会话数、消息数、涉及的主要工作区/模式（从会话 meta 推断，不读取文件）。
   - 主要话题与任务：按主题分组，列出用户重点关注的事项。
   - 关键决策与变更：总结明确做出的决定、代码改动、文件操作。
   - 待办 / 阻塞 / 风险：提取尚未完成或需要跟进的事项。
   - 下一步建议：给出 3-5 条可执行的建议。
6. 保持客观、简洁，不要编造记录中没有的信息。
7. 如果记录为空或无法识别有效内容，直接返回「本期暂无有效对话记录」。
8. 报告应总结"对话中发生了什么"——不要把对话记录里 assistant 提到的文件路径、代码片段、命令输出复述进报告。文件细节只在"关键决策与变更"章节用一句话概括（例如"修改了 launcher.mjs 的报告生成逻辑"），不要展开原文。`;

function buildReportPrompt(periodLabel, date, conversationText, stats) {
  const cfg = readConfig(configPath);
  const baseSystem = DEFAULT_REPORT_PROMPT_TEMPLATE.replace(/\{periodLabel\}/g, periodLabel).replace(/\{date\}/g, date);
  const addendum = cfg.reportPromptAddendum?.trim();
  const systemContent = addendum ? `${baseSystem}\n\n# 用户自定义要求\n\n${addendum}` : baseSystem;
  return [
    {
      role: "system",
      content: systemContent,
    },
    {
      role: "user",
      content:
        `会话数：${stats.sessions}，消息数：${stats.messages}，时间范围：${formatDateKey(stats.start)} 至 ${formatDateKey(stats.end)}\n\n` +
        `---\n${conversationText}\n---\n\n请生成 ${periodLabel}。`,
    },
  ];
}

async function migrateReportPromptAddendum(signal) {
  const cfg = readConfig(configPath);
  const oldTemplate = cfg.reportPromptTemplate;
  if (typeof oldTemplate !== "string" || oldTemplate.trim() === "") {
    return { migrated: false, reason: "no-legacy-template" };
  }
  const trimmedOld = oldTemplate.trim();
  const trimmedNew = DEFAULT_REPORT_PROMPT_TEMPLATE.trim();
  if (trimmedOld === trimmedNew) {
    delete cfg.reportPromptTemplate;
    writeConfig(cfg, configPath);
    console.error("[launcher] report prompt migration: legacy template equals current default, removed");
    return { migrated: true, reason: "equal-to-default", addendum: "" };
  }
  let addendum = "";
  if (client) {
    try {
      const modelConfig = effectiveModelConfig(config);
      const migrationMessages = [
        {
          role: "system",
          content:
            "你是提示词迁移助手。下面给你两份报告生成提示词：一份是用户在旧版本里自定义的模板，另一份是新版本默认模板。" +
            "请识别用户旧模板中**相对于新默认的特有意图**（标题偏好、章节要求、风格要求、语言要求等），" +
            "把这些特有意图提取为简洁的中文追加说明（addendum）。" +
            "如果旧模板与新默认本质相同（仅措辞或版本差异、占位符差异），返回空字符串。" +
            "只输出 addendum 本身，不要解释、不要包裹在代码块里。最多 300 字。",
        },
        {
          role: "user",
          content:
            `# 新版本默认模板\n\n${DEFAULT_REPORT_PROMPT_TEMPLATE}\n\n` +
            `# 用户旧模板\n\n${oldTemplate}\n\n` +
            `请输出 addendum（若无需保留则输出空字符串）：`,
        },
      ];
      const result = await client.chat({
        model: modelConfig.model,
        messages: migrationMessages,
        temperature: 0.2,
        maxTokens: 600,
        signal,
      });
      addendum = (result.content || "").trim();
      if (addendum.startsWith("```")) {
        addendum = addendum.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
      }
      console.error(`[launcher] report prompt migration: LLM summarized addendum (${addendum.length} chars)`);
    } catch (err) {
      if (signal?.aborted) throw err;
      console.error(`[launcher] report prompt migration: LLM summarize failed (${err.message}), fallback to raw legacy template`);
      addendum = `（从旧版本迁移的用户自定义提示词，建议清理后重新编辑）\n\n${oldTemplate}`;
    }
  } else {
    console.error("[launcher] report prompt migration: no LLM client, fallback to raw legacy template");
    addendum = `（从旧版本迁移的用户自定义提示词，建议清理后重新编辑）\n\n${oldTemplate}`;
  }
  const next = readConfig(configPath);
  delete next.reportPromptTemplate;
  if (addendum) {
    next.reportPromptAddendum = addendum;
  } else {
    delete next.reportPromptAddendum;
  }
  writeConfig(next, configPath);
  return { migrated: true, reason: "summarized", addendum };
}

async function generateReport(period, anchorDate, customRange = null, options = {}) {
  if (!client) {
    throw new Error("当前未配置可用的 LLM provider，无法生成报告");
  }
  await migrateReportPromptAddendum(options.signal);
  let start;
  let end;
  if (customRange && customRange.start && customRange.end) {
    const s = new Date(customRange.start);
    const e = new Date(customRange.end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      throw new Error("自定义时间范围无效");
    }
    start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
    end = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1, 0, 0, 0, 0);
  } else {
    ({ start, end } = getLocalDateRange(period, anchorDate));
  }
  const { conversations, totalMessages, totalSessions } = await collectConversations(start, end);
  const stats = { period, start, end, sessions: totalSessions, messages: totalMessages };

  const periodLabel = period === "daily" ? "日报" : period === "weekly" ? "周报" : period === "yearly" ? "年度报告" : "自定义报告";

  if (totalSessions === 0) {
    return {
      markdown: `## Visionox-Whale ${periodLabel}\n\n` +
        `时间范围：**${formatDateKey(start)}** 至 **${formatDateKey(end)}**\n\n本期暂无有效对话记录。`,
      stats,
    };
  }

  const conversationText = buildConversationText(conversations);
  const date = formatDateKey(start);
  const messages = buildReportPrompt(periodLabel, date, conversationText, stats);
  const cfg = effectiveModelConfig(config);
  const model = cfg.model;

  console.error(`[report] generating ${period} report: ${totalSessions} sessions, ${totalMessages} messages, model=${model}`);
  const result = await client.chat({
    model,
    messages,
    temperature: 0.3,
    maxTokens: 4096,
    signal: options.signal,
  });
  const markdown = result.content?.trim() || "生成失败：模型返回空内容";
  return { markdown, stats };
}

// ── pauseGate modal bridge ──────────────────────────────────────
// Bridges tool confirmation requests (pauseGate.ask) to dashboard modals via SSE.
// Without this listener, gate.ask() throws "no confirmation listener registered".
let activeModal = null;
let activeGateId = null;
const queuedModals = [];

function setActiveModal(modal) {
  if (modal) {
    if (activeModal) {
      queuedModals.push(modal);
      return;
    }
    activeModal = modal;
    activeGateId = modal._gateId;
    broadcastDashboardEvent({ kind: "modal-up", modal });
    return;
  }

  if (activeModal) {
    broadcastDashboardEvent({
      kind: "modal-down",
      modalKind: activeModal.kind,
      gateId: activeGateId,
    });
  }
  activeModal = null;
  activeGateId = null;

  const next = queuedModals.shift();
  if (next) setActiveModal(next);
}

function clearActiveModals() {
  queuedModals.length = 0;
  setActiveModal(null);
}

function resolveActiveGate(expectedKind, gateId, verdict) {
  if (!activeModal || activeModal.kind !== expectedKind || activeGateId !== gateId) return false;
  pauseGate.resolve(activeGateId, verdict);
  setActiveModal(null);
  return true;
}

// Register pauseGate listener — maps tool confirmation requests to dashboard modals.
pauseGate.on((request) => {
  const { id, kind, payload } = request;

  // 1. Auto-resolve policy (e.g., plan_checkpoint auto-continues in auto/yolo/admin)
  const auto = autoResolveVerdict(request, loadEditMode(configPath));
  if (auto) {
    pauseGate.resolve(id, auto);
    return;
  }

  // 2. path_access — auto-deny (HTTP dashboard has no path-access modal kind)
  if (kind === "path_access") {
    broadcastDashboardEvent({
      turn: 0,
      role: "warning",
      kind: "warning",
      id: `warn-${Date.now()}`,
      text: `沙箱外路径访问被拒绝: ${payload.path}。如需访问，请切换到 admin 模式。`
    });
    pauseGate.resolve(id, { type: "deny", denyContext: "path_access not supported in desktop dashboard" });
    return;
  }

  // 3. Map pauseGate kind to dashboard modal
  const modal = requestToModal(request);
  if (!modal) {
    broadcastDashboardEvent({
      turn: 0, role: "warning", kind: "warning",
      id: `warn-${Date.now()}`,
      text: `未知的确认请求类型: ${kind}，已自动取消。`
    });
    pauseGate.cancel(id);
    return;
  }

  setActiveModal(modal);
});

const auditLogPath = resolve(visionoxDataDir, "audit.jsonl");
function appendAuditEntry(entry) {
  try {
    if (existsSync(auditLogPath) && statSync(auditLogPath).size >= 10 * 1024 * 1024) {
      const backup = `${auditLogPath}.1`;
      rmSync(backup, { force: true });
      renameSync(auditLogPath, backup);
    }
    appendFileSync(auditLogPath, `${JSON.stringify(entry)}\n`);
  } catch {
  }
}

// Wire audit listener for tool confirmations (allow/deny/always_allow)
pauseGate.setAuditListener((event) => {
  appendAuditEntry({ ts: Date.now(), action: "tool-confirm", payload: event });
});

// ── Slash command registry ──────────────────────────────────────
// Static metadata for the commands handled inside submitPrompt(). The
// runtime handlers live in submitPrompt (they close over loop/client/messages
// etc.), but this table is the single source of truth for command names,
// descriptions, and usage strings — exposed to the dashboard via
// ctx.getSlashCommands() so the UI can render a dynamic command menu instead
// of hardcoding the list.
//
// matchType:
//   "exact"   — matches only "/name" with no args
//   "prefix"  — matches "/name ..." (requires a space after the name, so
//               "/reportfoo" is NOT mistaken for "/report"; this fixes the
//               pre-refactor bug where /report used startsWith("/report"))
//   "prefix-or-exact" — matches both "/name" and "/name ..." (e.g. /cost)
//
// Note: /help, /?, /learn, and /retry are NOT listed here because they have
// special routing (help runs before busy; learn needs lazy module load;
// retry falls through into the AI loop). They are documented separately.
const SLASH_COMMAND_META = [
  { name: "/help",  aliases: ["/?"], desc: "显示能力概览", usage: "/help", group: "system" },
  { name: "/new",   aliases: ["/clear"], desc: "新建会话（清空当前对话）", usage: "/new", group: "session" },
  { name: "/status", desc: "查看模型、上下文、费用、余额", usage: "/status", group: "system" },
  { name: "/compact", desc: "手动压缩上下文（LLM 摘要旧消息）", usage: "/compact", group: "session" },
  { name: "/retry", desc: "截断并重发上一条用户消息", usage: "/retry", group: "session" },
  { name: "/cost",  desc: "查看费用或估算发送文本的成本", usage: "/cost [文本]", group: "system", matchType: "prefix-or-exact" },
  { name: "/context", desc: "上下文窗口占用分解", usage: "/context", group: "system" },
  { name: "/btw",  desc: "旁路提问（不污染主上下文）", usage: "/btw <问题>", group: "session", matchType: "prefix" },
  { name: "/report", desc: "生成日报/周报/年报", usage: "/report daily|weekly|yearly [日期]", group: "session", matchType: "prefix-or-exact" },
  { name: "/learn", desc: "技能萃取、语义索引、导师模式", usage: "/learn help", group: "system" },
];

/**
 * Resolve a raw input line to a registered command name (without the leading
 * slash) plus its raw args string, or null if the input is not a slash
 * command. Uses a strict `^\/([a-zA-Z0-9_-]+)` name match so "/btwabc" is NOT
 * parsed as "/btw" (fixes the pre-refactor /btw and /report word-boundary
 * bugs in one place).
 */
function parseSlashInput(text) {
  const m = (text || "").trim().match(/^\/([a-zA-Z0-9_-]+)(?:\s+([\s\S]*))?$/);
  if (!m) return null;
  return { name: m[1].toLowerCase(), args: (m[2] ?? "").trim() };
}

/**
 * Test whether a parsed {name, args} matches a command entry's matchType.
 * "exact"          → name matches and args must be empty
 * "prefix"         → name matches and args must be non-empty (requires args)
 * "prefix-or-exact"→ name matches regardless of args
 * (entries without matchType default to "exact")
 */
function matchSlashCommand(entry, name) {
  const matchType = entry.matchType ?? "exact";
  // Check primary name or alias (without leading slash)
  const names = [entry.name.replace(/^\//, ""), ...(entry.aliases ?? []).map(a => a.replace(/^\//, ""))];
  if (!names.includes(name)) return false;
  if (matchType === "exact") return true;            // arg presence checked by caller
  if (matchType === "prefix") return true;            // arg presence checked by caller
  return true; // prefix-or-exact
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
  getGeneratedArtifactPaths: collectGeneratedArtifactPaths,
  getEditMode: () => loadEditMode(configPath),
  getPlanMode: () => false,
  getPendingEditCount: () => 0,
  getLatestVersion: () => latestVersion,
  getSessionName: () => "desktop",
  getModels: () => null,
  getLoopRunStatus: () => null,
  getActiveModal: () => activeModal,
  getActivePlan: () => getActivePlanSnapshot(),
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
  getDlpStatus: () => {
    const dlp = getDlpConfig(readConfig(configPath), {
      homeDir: home,
      projectRoot: resolve(__dirname, "..", "..", ".."),
      serverDir: __dirname,
    });
    return {
      mode: dlp.mode,
      enabled: process.platform === "win32" && dlp.mode !== "off",
      scriptPath: dlp.scriptPath,
      scriptFound: Boolean(dlp.scriptPath),
      timeoutMs: dlp.timeoutMs,
      pythonPath: dlp.pythonPath,
    };
  },
  resolveDlpReadablePath: (path) => resolveReadablePathForDlp(path, {
    cfg: readConfig(configPath),
    env: {
      homeDir: home,
      projectRoot: resolve(__dirname, "..", "..", ".."),
      serverDir: __dirname,
      rootDir: workspaceDir,
    },
    logger: console,
  }),
  getModeMemory: (modeId) => listModeMemory(modeId || config.mode || "general"),
  getAllModeMemory: () => listAllModeMemory(),
  getSessionMemories: () => listSessionMemories(),
  deleteSessionMemory,
  getMemoryInjectionStatus: () => getMemoryInjectionStatus(workspaceDir),
  getMemoryRuntimeStatus: () => getMemoryRuntimeStatus(workspaceDir),
  getProjectMemoryStatus: () => getProjectMemoryStatus(workspaceDir),
  getDefaultSoul: () => readDefaultSoul(),
  applyMemoryChanges: () => client ? ({ applied: true, ...rebuildLoopPreservingContext(client, workspaceDir) }) : ({ applied: false, error: "model client is not configured" }),
  addModeMemory: (input, modeId) => addModeMemory(modeId || config.mode || "general", input),
  updateModeMemory: (id, patch, modeId) => updateModeMemory(modeId || config.mode || "general", id, patch),
  deleteModeMemory: (id, modeId) => deleteModeMemory(modeId || config.mode || "general", id),
  moveModeMemory,
  batchModeMemory,
  restoreModeMemoryTrash,
  listPromptQueue,
  upsertPromptQueueItem,
  removePromptQueueItem,
  listSchedules: () => schedules.map(publicSchedule),
  createSchedule: (input) => {
    const result = scheduleFromInput(input);
    if (!result.ok) return result;
    schedules.push(result.task);
    writeSchedules();
    refreshScheduleTimer(result.task);
    broadcastDashboardEvent({ kind: "schedule-changed", action: "create", id: result.task.id });
    return { ok: true, schedule: publicSchedule(result.task) };
  },
  updateSchedule: (id, patch) => {
    const idx = schedules.findIndex((item) => item.id === id);
    if (idx < 0) return { ok: false, error: "schedule not found" };
    const result = scheduleFromInput(patch, schedules[idx]);
    if (!result.ok) return result;
    schedules[idx] = result.task;
    writeSchedules();
    refreshScheduleTimer(result.task);
    broadcastDashboardEvent({ kind: "schedule-changed", action: "update", id });
    return { ok: true, schedule: publicSchedule(result.task) };
  },
  setScheduleEnabled: (id, enabled) => {
    const task = schedules.find((item) => item.id === id);
    if (!task) return { ok: false, error: "schedule not found" };
    task.enabled = !!enabled;
    task.updatedAt = new Date().toISOString();
    task.nextRunAt = computeNextScheduleRun(task);
    writeSchedules();
    refreshScheduleTimer(task);
    broadcastDashboardEvent({ kind: "schedule-changed", action: "toggle", id });
    return { ok: true, schedule: publicSchedule(task) };
  },
  deleteSchedule: (id) => {
    const idx = schedules.findIndex((item) => item.id === id);
    if (idx < 0) return { ok: false, error: "schedule not found" };
    if (runningScheduleIds.has(id)) return { ok: false, error: "task is currently running" };
    const timer = scheduleTimers.get(id);
    if (timer) clearTimeout(timer);
    scheduleTimers.delete(id);
    schedules.splice(idx, 1);
    writeSchedules();
    broadcastDashboardEvent({ kind: "schedule-changed", action: "delete", id });
    return { ok: true };
  },
  runScheduleNow: (id) => triggerSchedule(id, { manual: true }),
  cancelScheduleRun,

  // ── Reports ────────────────────────────────────────────────
  generateReport,
  previewReportSources,
  getReportPromptTemplate: () => ({
    default: DEFAULT_REPORT_PROMPT_TEMPLATE,
    addendum: readConfig(configPath).reportPromptAddendum || "",
  }),
  setReportPromptAddendum: (addendum) => {
    const cfg = readConfig(configPath);
    const v = addendum === null || addendum === undefined ? "" : String(addendum).trim();
    if (v) {
      cfg.reportPromptAddendum = v;
    } else {
      delete cfg.reportPromptAddendum;
    }
    writeConfig(cfg, configPath);
    console.error(`[launcher] report prompt addendum ${cfg.reportPromptAddendum ? "updated" : "cleared"}`);
    return { default: DEFAULT_REPORT_PROMPT_TEMPLATE, addendum: v };
  },

  // ── Setters / actions ──────────────────────────────────────
  audit: (entry) => {
    appendAuditEntry(entry);
  },
  // ── Modal resolution callbacks (called by POST /modal/resolve) ──
  resolveShellConfirm: (choice, gateId) => {
    const prefix = activeModal?.allowPrefix ?? "";
    const verdict = choice === "deny" ? { type: "deny", denyContext: "user denied" }
      : choice === "always_allow" ? { type: "always_allow", prefix }
      : { type: "run_once" };
    return resolveActiveGate("shell", gateId, verdict);
  },
  resolveChoiceConfirm: (resolution, gateId) => {
    const verdict = resolution?.kind === "pick" ? { type: "pick", optionId: resolution.optionId }
      : resolution?.kind === "custom" ? { type: "text", text: resolution.text }
      : { type: "cancel" };
    return resolveActiveGate("choice", gateId, verdict);
  },
  resolvePlanConfirm: (choice, text, gateId) => {
    const feedback = text || "";
    const verdict = choice === "approve" ? { type: "approve", feedback }
      : choice === "refine" ? { type: "refine", feedback }
      : { type: "cancel", feedback };
    const resolved = resolveActiveGate("plan", gateId, verdict);
    if (resolved && choice === "approve") activatePendingPlan();
    if (resolved && choice !== "approve") pendingPlan = null;
    return resolved;
  },
  resolveCheckpointConfirm: (choice, text, gateId) => {
    const verdict = choice === "continue" ? { type: "continue" }
      : choice === "revise" ? { type: "revise", feedback: text || "" }
      : { type: "stop" };
    return resolveActiveGate("checkpoint", gateId, verdict);
  },
  resolveReviseConfirm: (choice, gateId) => {
    const verdict = choice === "accept" ? { type: "accepted" } : { type: "rejected" };
    const resolved = resolveActiveGate("revision", gateId, verdict);
    if (!resolved) return false;
    if (choice === "accept" && pendingPlanRevision && activePlanSteps && activeCompletedIds) {
      activePlanSteps = [
        ...activePlanSteps.filter((step) => activeCompletedIds.has(step.id)),
        ...pendingPlanRevision.remainingSteps,
      ];
      if (pendingPlanRevision.summary) activePlanSummary = pendingPlanRevision.summary;
      persistActivePlan();
    }
    pendingPlanRevision = null;
    return true;
  },
  setEditMode: (m) => {
    // "review" is a legacy alias for "auto" after the merge
    const resolved = m === "review" ? "auto" : m;
    const cfg = readConfig(configPath);
    cfg.editMode = resolved;
    writeConfig(cfg, configPath);
    console.error(`[launcher] edit mode: ${resolved}`);
    return resolved;
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
    // Rebuild the loop immediately so the new mode's prompt, memory, rules,
    // and skills catalogue take effect on the very next turn — not deferred
    // until /new. Without this, /status would report the new mode while the
    // cached system prefix still carried the old mode's content.
    if (client) {
      rebuildLoopPreservingContext(client, workspaceDir);
    }
    return true;
  },
  applyPresetLive: (name) => {
    console.error(`[launcher] preset: ${name}`);
    syncRuntimeConfig({ ...config, preset: name });
    // Re-resolve through effectiveModelConfig so locked presets override
    // stale config.model values when switching live or rebuilding after /new.
    const modelConfig = effectiveModelConfig(config);
    activeContextPolicy = applyContextCap(modelConfig.model);
    const modelSwitch = requestModelSwitch(modelConfig, "preset");
    broadcastDashboardEvent({ kind: "config-changed" });
    return modelSwitch;
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
    const modelConfig = effectiveModelConfig(config);
    activeContextPolicy = applyContextCap(modelConfig.model);
    const modelSwitch = requestModelSwitch(modelConfig, "model");
    console.error(`[launcher] model: ${modelConfig.model}`);
    broadcastDashboardEvent({ kind: "config-changed" });
    return modelSwitch;
  },
  // Refresh context cap after provider/model config changes (e.g. JSON import).
  // Re-reads config, clears stale DEEPSEEK_CONTEXT_TOKENS[model] if manual cap
  // was removed, and re-applies the priority chain: manual > maxContextLength > hardcoded.
  refreshContextCap: () => {
    const cfg = readConfig(configPath);
    syncRuntimeConfig(cfg);
    const modelConfig = effectiveModelConfig(config);
    activeContextPolicy = rebuildProviderContextCaps(config);
    // Re-select summary model in case provider models were updated by import.
    const provider = getActiveProvider(cfg);
    if (provider) {
      globalThis.__visionoxThinkingModeMap = Object.fromEntries(
        (provider.models ?? []).map((model) => [model.id, model.thinkingMode])
      );
      globalThis.__visionoxSummaryModel = pickSummaryModel(provider.models);
    }
    const modelSwitch = requestModelSwitch(modelConfig, "context-cap");
    console.error(`[launcher] context cap refreshed: model=${modelConfig.model}, cap=${DEEPSEEK_CONTEXT_TOKENS[modelConfig.model] ?? DEFAULT_CONTEXT_TOKENS}`);
    broadcastDashboardEvent({ kind: "config-changed" });
    return { modelSwitch, contextPolicy: activeContextPolicy };
  },
  setBudgetUsdLive: (usd) => { loop?.setBudget(usd); },
  completeActivePlanStep,
  cancelActivePlan,

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

  // Sync provider switch: immediately rebuild client + loop with new provider.
  // Falls back preset/effort if current values are not supported by the new provider.
  syncProvider: async (providerId) => {
    const cfg = readConfig(configPath);
    const provider = cfg.providers?.find((p) => p.id === providerId);
    if (!provider) {
      console.error(`[launcher] syncProvider: provider "${providerId}" not found`);
      return;
    }

    cfg.activeProviderId = providerId;
    writeConfig(cfg, configPath);
    syncRuntimeConfig(cfg);

    // Resolve preset/effort for new provider — fallback if unsupported
    const newPreset = resolvePresetForProvider(cfg.preset ?? "auto", provider);
    const newEffort = resolveEffortForProvider(cfg.reasoningEffort ?? "max", provider);
    if (newPreset !== cfg.preset) cfg.preset = newPreset;
    if (newEffort !== cfg.reasoningEffort) cfg.reasoningEffort = newEffort;
    writeConfig(cfg, configPath);
    syncRuntimeConfig(cfg);
    activeContextPolicy = rebuildProviderContextCaps(config);

    // Rebuild client + loop immediately (no /new needed)
    apiKey = provider.apiKey;
    baseUrl = provider.baseUrl;
    if (apiKey) {
      client = new DeepSeekClient({ apiKey, baseUrl });
      const modelSwitch = rebuildLoopPreservingContext(client, workspaceDir);
      refreshBalance();
      console.error(`[launcher] provider switched: ${providerId} (preset=${newPreset}, effort=${newEffort})`);
      return { providerId, ...modelSwitch };
    } else {
      client = null;
      loop = null;
      ctx.loop = loop;
      balanceData = null;
      console.error(`[launcher] provider switched: ${providerId} but no apiKey, client cleared`);
    }
    broadcastDashboardEvent({ kind: "config-changed" });
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
        rebuildLoopPreservingContext(client, workspaceDir);
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
    const result = await registerWorkspaceTools(tools, configuredDir, { jobs, getOperationId: () => activeOperation?.id ?? null });
    hasSemanticSearch = result.hasSemantic;
    wsToolNames = result.toolNames;
    workspaceDir = configuredDir;

    // Rebuild loop with new system prompt & prefix
    if (loop && client) {
      rebuildLoopPreservingContext(client, workspaceDir);
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
  getActiveOperation: () => publicActiveOperation(),
  listBackgroundJobs: () => jobs.listMetadata(),
  getBackgroundJob: (id) => jobs.read(id),
  stopBackgroundJob: (id) => jobs.stop(id),

  subscribeEvents: (handler) => {
    eventSubscribers.add(handler);
    return () => {
      eventSubscribers.delete(handler);
    };
  },
  notifySessionsChanged: (action, name) => broadcastDashboardEvent({ kind: "sessions-changed", action, name }),

  // Expose the slash-command registry to the dashboard so the UI can render
  // a dynamic command menu (autocomplete, /help list) instead of hardcoding
  // the command set. Returns {name, aliases, desc, usage, group}[].
  getSlashCommands: () => SLASH_COMMAND_META.map(({ name, aliases, desc, usage, group }) => ({
    name, aliases: aliases ?? [], desc, usage, group: group ?? "system",
  })),

  // P0-1: busy guard must be checked and set BEFORE any await to prevent
  // race conditions where two rapid calls both pass the busy check.
  submitPrompt: async (text, sessionName, images, opts = {}) => {
    const requestId = typeof opts.requestId === "string" ? opts.requestId.trim().slice(0, 160) : "";
    const duplicate = acceptedPromptRequest(requestId);
    if (duplicate) {
      return { accepted: true, duplicate: true, requestId, turnId: duplicate.turnId };
    }
    if (busy) {
      return { accepted: false, reason: "loop is busy with a turn" };
    }

    // ── Intercept /help — show user-facing capability overview ──
    const trimmed = (text || "").trim();
    if (trimmed === "/help" || trimmed === "/?") {
      const mc = getModeConfig();
      const modeList = Object.entries(config.modes ?? DEFAULT_MODES)
        .filter(([id]) => DEFAULT_MODES[id])
        .map(([id, m]) => `  • **${m.label}**（${id}）— ${m.description}`)
        .join("\n");
      let skillCount = 0;
      try { skillCount = (await readdir(bootstrapSkillsRoot)).filter(e => statSync(resolve(bootstrapSkillsRoot, e)).isDirectory()).length; } catch {}
      const helpText = `## Visionox-Whale 能力概览

### 🎯 四种工作模式

${modeList}

当前模式：**${mc.label}**。切换模式后即时生效，每种模式有专属的提示词、编码规范和推荐技能。

### 🧩 内置技能（${skillCount} 个）

技能是可调用的专业工作流，模型会根据任务自动选用，也可通过 \`/skill <名称>\` 手动调用。常用技能：

| 类别 | 技能 | 用途 |
|------|------|------|
| 编码规范 | coding-standards、tdd-workflow | 编码风格、测试驱动开发 |
| 代码模式 | rust-patterns、python-patterns、api-design | 语言最佳实践 |
| 工程流程 | git-workflow、systematic-debugging、security-review | Git 操作、系统调试、安全审查 |
| 前端设计 | frontend-patterns、react-patterns、e2e-testing | 前端开发、React、端到端测试 |
| 办公文档 | file-access-rescue、officecli、pdf、md-to-pdf-cjk | 本地文档准备、Word/Excel/PPT/PDF 操作 |
| 规划执行 | brainstorming、writing-plans、executing-plans | 方案构思、计划编写、任务执行 |
| 代码审查 | requesting-code-review、receiving-code-review | 发起审查、处理审查反馈 |

### 📋 其他能力

- **记忆系统**：记住你的偏好和项目知识（跨会话生效）
- **/learn**：技能萃取、语义索引、导师模式（输入 \`/learn help\` 了解更多）
- **斜杠命令**：输入 \`/\` 可查看所有可用命令
- **22 种语言编码规范**：可在工作模式配置中按需启用（angular/cpp/go/java/swift/vue 等）

### 💡 快速开始

直接输入你的问题或任务即可。例如：
- "帮我写一个 Python 脚本处理 CSV"
- "审查这段代码的安全问题"
- "生成一份项目周报 Word 文档"`;

      const userId = `user-${Date.now()}-${nextMsgId++}`;
      const assistantId = `assistant-${Date.now()}-${nextMsgId++}`;
      pushMessage({ id: userId, role: "user", text: trimmed });
      pushMessage({ id: assistantId, role: "assistant", text: helpText });
      broadcastDashboardEvent({ kind: "user", id: userId, text: trimmed });
      broadcastDashboardEvent({ kind: "assistant_final", id: assistantId, text: helpText });
      return { accepted: true, loaded: false };
    }

    busy = true;
    const operation = beginActiveOperation(operationKindForPrompt(text, opts));
    const stopFromExternalSignal = () => {
      if (operation.controller.signal.aborted) return;
      operation.state = "stopping";
      operation.stopRequestedAt = new Date().toISOString();
      operation.controller.abort();
      broadcastDashboardEvent({ kind: "operation-change", operation: publicActiveOperation(operation) });
      void jobs.stopOwned(operation.id, { graceMs: 100 });
      loop?.abort();
    };
    if (opts.signal?.aborted) stopFromExternalSignal();
    else opts.signal?.addEventListener("abort", stopFromExternalSignal, { once: true });
    const detachExternalSignal = () => opts.signal?.removeEventListener("abort", stopFromExternalSignal);

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
          return { accepted: false, reason: `Invalid session name: ${sessionName}. Use only letters, numbers, Chinese characters, underscore, dot, or hyphen.` };
        }
        clearSessionMemories();
        try {
          const sessionFile = sessionJsonlPath(sessionName);
          const sessionMeta = readSessionMeta(sessionName);
          restoreSessionMemories(sessionMeta.sessionMemories);
          const modeRestore = applyModeForSessionMeta(sessionMeta);
          if (!modeRestore.changed && client) rebuildLoopPreservingContext(client, workspaceDir);
          const raw = await readFile(sessionFile, "utf8");
          const parsed = parseActiveSessionJsonl(raw);
          const entries = parsed.entries;
          const modelEntries = activeEntriesForModel(entries);
          const dashboardEntries = activeEntriesForDashboard(entries);
          // Load into AI context
          loop.adoptHistory?.(modelEntries, loop.model) ?? loop.log.compactInPlace(modelEntries);
          // Populate dashboard messages
          messages.length = 0;
          nextMsgId = 1;
          for (const entry of dashboardEntries) {
            pushMessage(entry);
            nextMsgId++;
          }
          // Seed active-session file with the resumed session so continued
          // conversation survives a crash/restart with full context.
          try {
            await writeFile(activeSessionFile, raw, "utf8");
            await writeActiveSessionMeta({ ...sessionMeta, messageCount: entries.length });
          } catch (err) {
            console.error(`[launcher] failed to seed active session from ${sessionName}: ${err.message}`);
          }
          broadcastDashboardEvent({
            kind: "messages-reset",
            messages: messages.slice(-DASHBOARD_MESSAGE_WINDOW),
            totalMessages: messages.length,
            mode: modeRestore.mode,
            modeChanged: modeRestore.changed,
          });
          console.error(`[launcher] session loaded: ${sessionName} (ui=${dashboardEntries.length}, model=${modelEntries.length}, mode: ${modeRestore.mode}${modeRestore.changed ? `, restored from ${modeRestore.previous}` : ""})`);
          if (!text || !text.trim()) {
            return { accepted: true, loaded: true, session: sessionName, mode: modeRestore.mode, modeChanged: modeRestore.changed };
          }
        } catch (err) {
          console.error(`[launcher] failed to load session ${sessionName}: ${err.message}`);
          return { accepted: false, reason: `Failed to load session: ${err.message}` };
        }
      }

      // Handle /learn: Visionox-Whale learning command (does not enter AI loop)
      // Lazy-load learn modules so a missing resource file cannot break startup.
      const [learn, learnTrack] = await Promise.all([loadLearnModule(), loadLearnTrackModule()]);
      const learnCmd = learn?.parseLearnCommand(text) ?? null;
      if (learnCmd) {
        if (!learn) {
          const assistantId = `assistant-${Date.now()}`;
          const errMsg = "/learn 模块加载失败：请确认 resources/server/learn.mjs 存在，然后重启应用。";
          pushMessage({ id: assistantId, role: "assistant", text: errMsg });
          appendActiveMessage({ role: "assistant", text: errMsg });
          broadcastDashboardEvent({ kind: "assistant_final", id: assistantId, text: errMsg });
          return { accepted: true };
        }
        const modelConfig = effectiveModelConfig(config);
        const learnOpts = {
          client,
          model: modelConfig.model,
          workspaceDir,
          skillsRoot,
          hasSemanticSearch,
          configPath,
          tail: learnCmd.tail,
          allowAllPaths: () => loadEditMode(configPath) === "admin",
          buildIndex,
          querySemantic,
          indexExists,
          loadSemanticEmbeddingUserConfig,
          setTutorMode,
          getTutorMode,
          setLearningMode,
          getLearningMode,
          signal: operation.controller.signal,
          rebuildLoop: () => {
            pauseGate.cancelAll();
            clearActiveModals();
            broadcastDashboardEvent({ kind: "todo-update", todos: [] });
            if (client) {
              rebuildLoopPreservingContext(client, workspaceDir);
            }
          },
        };
        const result = await learn.executeLearnCommand(learnCmd, learnOpts);
        if (operation.controller.signal.aborted) return { accepted: true, cancelled: true };
        const assistantId = `assistant-${Date.now()}`;
        const assistantMsg = { id: assistantId, role: "assistant", text: result.message };
        pushMessage(assistantMsg);
        appendActiveMessage({ role: "assistant", text: result.message });
        broadcastDashboardEvent({ kind: "busy-change", busy: true });
        broadcastDashboardEvent({ kind: "assistant_final", id: assistantId, text: result.message });
        return { accepted: true };
      }

      // /status — show model, context, cost, balance (no AI loop, instant)
      if (text === "/status") {
        const mc = effectiveModelConfig(config);
        const s = loop ? loop.stats.summary() : null;
        const ctxCap = loop ? (DEEPSEEK_CONTEXT_TOKENS[loop.model] ?? DEFAULT_CONTEXT_TOKENS) : 0;
        const ctxPct = s && ctxCap > 0 ? (s.lastPromptTokens / ctxCap * 100) : 0;
        const bal = primaryBalanceSummary();
        const lines = [
          `\u{1F4CB} \u72B6\u6001`,
          ``,
          `\u6A21\u578B: ${loop?.model ?? mc.model ?? "\u2014"}`,
          `\u9884\u8BBE: ${mc.preset} (${mc.locked ? "\u9501\u5B9A" : "auto"})`,
          `\u63A8\u7406\u5F3A\u5EA6: ${config.reasoningEffort ?? "max"}`,
          `\u5DE5\u4F5C\u6A21\u5F0F: ${config.mode ?? "general"}`,
          ``,
          `\u4E0A\u4E0B\u6587: ${s ? s.lastPromptTokens.toLocaleString() : 0} / ${(ctxCap / 1e3).toFixed(0)}K (${ctxPct.toFixed(1)}%)`,
          `  \u251C \u666E\u901A\u6298\u53E0: 50% (${(ctxCap * 0.5 / 1e3).toFixed(0)}K)`,
          `  \u251C \u6FC0\u8FDB\u6298\u53E0: 70% (${(ctxCap * 0.7 / 1e3).toFixed(0)}K)`,
          `  \u2514 \u5F3A\u5236\u6458\u8981: 80% (${(ctxCap * 0.8 / 1e3).toFixed(0)}K)`,
          ``,
          `\u8F6E\u6B21: ${s?.turns ?? 0}`,
          `\u7F13\u5B58\u547D\u4E2D: ${s ? (s.cacheHitRatio * 100).toFixed(1) + "%" : "\u2014"}`,
          `\u672C\u8F6E\u8D39\u7528: ${s ? "$" + s.lastTurnCostUsd.toFixed(6) : "\u2014"}`,
          `\u7D2F\u8BA1\u8D39\u7528: ${s ? "$" + s.totalCostUsd.toFixed(6) : "\u2014"}`,
        ];
        if (bal) {
          lines.push(``, `\u4F59\u989D: ${bal.total} ${bal.currency}`);
        }
        if (!loop) {
          lines.push(``, `\u26A0\uFE0F API Key \u672A\u914D\u7F6E\uFF0C\u5BF9\u8BDD\u4E0D\u53EF\u7528`);
        }
        const statusId = `assistant-${Date.now()}`;
        const statusText = lines.join("\n");
        pushMessage({ id: statusId, role: "assistant", text: statusText });
        broadcastDashboardEvent({ kind: "assistant_final", id: statusId, text: statusText });
        return { accepted: true };
      }

      // Handle /new and /clear: finalize active session and reset
      if (text === "/new" || text === "/clear") {
        await resetActiveConversation({ withWelcome: true, reason: "manual new conversation" });
        // busy is already true from the outer guard; just broadcast events
        broadcastDashboardEvent({ kind: "busy-change", busy: true });
        return { accepted: true };
      }

      if (!loop) {
        return {
          accepted: false,
          reason: "API key not configured. Open Settings tab to add your DeepSeek API key, then restart the app."
        };
      }

      if (opts.newConversation === true) {
        await resetActiveConversation({ withWelcome: false, reason: "scheduled task" });
      }

      // /compact — manually trigger context compression (async LLM summarization)
      if (text === "/compact") {
        broadcastDashboardEvent({ kind: "busy-change", busy: true });
        const compactId = `assistant-${Date.now()}`;
        pushMessage({ id: compactId, role: "assistant", text: "\u23F3 \u6B63\u5728\u538B\u7F29\u4E0A\u4E0B\u6587..." });
        broadcastDashboardEvent({ kind: "assistant_final", id: compactId, text: "\u23F3 \u6B63\u5728\u538B\u7F29\u4E0A\u4E0B\u6587..." });
        try {
          const result = await loop.compactHistory();
          let resultText;
          if (result.folded) {
            resultText = `\u2705 \u4E0A\u4E0B\u6587\u5DF2\u538B\u7F29\n\n\u6D88\u606F: ${result.beforeMessages} \u2192 ${result.afterMessages}\n\u6458\u8981: ${result.summaryChars} \u5B57\u7B26`;
          } else {
            resultText = `\u2139\uFE0F \u65E0\u9700\u538B\u7F29\uFF08\u5BF9\u8BDD\u592A\u77ED\u6216\u5C3E\u90E8\u5360\u6BD4\u4E0D\u8DB3\uFF09`;
          }
          const doneId = `assistant-${Date.now()}`;
          pushMessage({ id: doneId, role: "assistant", text: resultText });
          broadcastDashboardEvent({ kind: "assistant_final", id: doneId, text: resultText });
        } catch (err) {
          const errId = `assistant-${Date.now()}`;
          const errText = `\u274C \u538B\u7F29\u5931\u8D25: ${err.message}`;
          pushMessage({ id: errId, role: "assistant", text: errText });
          broadcastDashboardEvent({ kind: "assistant_final", id: errId, text: errText });
        } finally {
          await syncActiveSessionFromLoop();
          busy = false;
          broadcastDashboardEvent({ kind: "busy-change", busy: false });
        }
        return { accepted: true };
      }

      // /retry — truncate & resend last user message (fresh sample)
      if (text === "/retry") {
        const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
        if (lastUserIdx < 0) {
          const id = `assistant-${Date.now()}`;
          const msg = "\u2139\uFE0F \u6CA1\u6709\u53EF\u91CD\u53D1\u7684\u6D88\u606F";
          pushMessage({ id, role: "assistant", text: msg });
          broadcastDashboardEvent({ kind: "assistant_final", id, text: msg });
          return { accepted: true };
        }
        const lastUserText = messages[lastUserIdx].text;
        const modelRetryText = loop?.retryLastUser?.();
        messages.splice(lastUserIdx);
        // Broadcast truncated message list
        broadcastDashboardEvent({
          kind: "messages-reset",
          messages: messages.slice(-DASHBOARD_MESSAGE_WINDOW),
          totalMessages: messages.length,
        });
        text = modelRetryText || lastUserText;
        // Fall through to AI loop with the retried text
      }

      // /cost — show last turn cost or estimate cost of sending text
      if (text === "/cost" || text.startsWith("/cost ")) {
        const id = `assistant-${Date.now()}`;
        let costText;
        if (text === "/cost") {
          const s = loop.stats.summary();
          const ctxCap = DEEPSEEK_CONTEXT_TOKENS[loop.model] ?? DEFAULT_CONTEXT_TOKENS;
          const ctxPct = s.lastPromptTokens / ctxCap * 100;
          costText = [
            `\u{1F4B8} \u8D39\u7528\u4FE1\u606F`,
            ``,
            `\u6A21\u578B: ${loop.model}`,
            `\u8F6E\u6B21: ${s.turns}`,
            ``,
            `\u4E0A\u8F6E\u8F93\u5165: ${s.lastPromptTokens.toLocaleString()} tokens (${ctxPct.toFixed(1)}% of ${(ctxCap / 1e3).toFixed(0)}K)`,
            `\u7F13\u5B58\u547D\u4E2D: ${(s.cacheHitRatio * 100).toFixed(1)}%`,
            `\u4E0A\u8F6E\u8D39\u7528: $${s.lastTurnCostUsd.toFixed(6)}`,
            `\u7D2F\u8BA1\u8F93\u5165\u8D39\u7528: $${s.totalInputCostUsd.toFixed(6)}`,
            `\u7D2E\u8BA1\u8F93\u51FA\u8D39\u7528: $${s.totalOutputCostUsd.toFixed(6)}`,
            `\u7D2E\u8BA1\u8D39\u7528: $${s.totalCostUsd.toFixed(6)}`,
          ].join("\n");
        } else {
          const sample = text.slice(6).trim();
          const msgs = loop.log.toMessages();
          const estInput = estimateRequestTokens([...msgs, { role: "user", content: sample }], loop.prefix.toolSpecs);
          const ctxCap = DEEPSEEK_CONTEXT_TOKENS[loop.model] ?? DEFAULT_CONTEXT_TOKENS;
          const pricing = DEEPSEEK_PRICING[loop.model];
          const estCost = pricing ? (estInput * pricing.inputCacheMiss / 1e6).toFixed(6) : "\u2014";
          costText = [
            `\u{1F4CD} \u6210\u672C\u4F30\u7B97`,
            ``,
            `\u9884\u4F30\u8F93\u5165: ${estInput.toLocaleString()} tokens (${(estInput / ctxCap * 100).toFixed(1)}% of ${(ctxCap / 1e3).toFixed(0)}K)`,
            `\u9884\u4F30\u8D39\u7528: $${estCost}${pricing ? ` (\u6309 ${loop.model} cache-miss \u4EF7)` : ""}`,
          ].join("\n");
        }
        pushMessage({ id, role: "assistant", text: costText });
        broadcastDashboardEvent({ kind: "assistant_final", id, text: costText });
        return { accepted: true };
      }

      // /context — show context window breakdown
      if (text === "/context") {
        const id = `assistant-${Date.now()}`;
        const systemTokens = countTokens(loop.prefix.system);
        const toolsTokens = countTokens(JSON.stringify(loop.prefix.toolSpecs));
        const entries = loop.log.toMessages();
        let userTokens = 0, assistantTokens = 0, toolResultTokens = 0;
        for (const e of entries) {
          const content = typeof e.content === "string" ? e.content : "";
          if (e.role === "user") userTokens += countTokens(content);
          else if (e.role === "assistant") assistantTokens += countTokens(content);
          else if (e.role === "tool") toolResultTokens += countTokens(content);
        }
        const logTokens = userTokens + assistantTokens + toolResultTokens;
        const total = systemTokens + toolsTokens + logTokens;
        const ctxCap = DEEPSEEK_CONTEXT_TOKENS[loop.model] ?? DEFAULT_CONTEXT_TOKENS;
        const ctxText = [
          `\u{1F4D0} \u4E0A\u4E0B\u6587\u5206\u89E3`,
          ``,
          `\u7CFB\u7EDF\u63D0\u793A\u8BCD: ${systemTokens.toLocaleString()} tokens`,
          `\u5DE5\u5177\u5B9A\u4E49: ${toolsTokens.toLocaleString()} tokens (${loop.prefix.toolSpecs.length} \u4E2A\u5DE5\u5177)`,
          `\u5BF9\u8BDD\u65E5\u5FD7: ${logTokens.toLocaleString()} tokens (${entries.length} \u6761\u6D88\u606F)`,
          `  \u251C \u7528\u6237: ${userTokens.toLocaleString()}`,
          `  \u251C \u52A9\u624B: ${assistantTokens.toLocaleString()}`,
          `  \u2514 \u5DE5\u5177\u7ED3\u679C: ${toolResultTokens.toLocaleString()}`,
          ``,
          `\u603B\u8BA1: ${total.toLocaleString()} / ${ctxCap.toLocaleString()} (${(total / ctxCap * 100).toFixed(1)}%)`,
          `\u5269\u4F59: ${(ctxCap - total).toLocaleString()} tokens`,
        ].join("\n");
        pushMessage({ id, role: "assistant", text: ctxText });
        broadcastDashboardEvent({ kind: "assistant_final", id, text: ctxText });
        return { accepted: true };
      }

      // /btw <question> — side question from blank slate (no context pollution)
      if (text.startsWith("/btw ")) {
        const question = text.slice(5).trim();
        if (!question) {
          const id = `assistant-${Date.now()}`;
          pushMessage({ id, role: "assistant", text: "\u2139\uFE0F \u7528\u6CD5: /btw <\u95EE\u9898>" });
          broadcastDashboardEvent({ kind: "assistant_final", id, text: "\u2139\uFE0F \u7528\u6CD5: /btw <\u95EE\u9898>" });
          return { accepted: true };
        }
        broadcastDashboardEvent({ kind: "busy-change", busy: true });
        const btwId = `assistant-${Date.now()}`;
        pushMessage({ id: btwId, role: "assistant", text: "\u{1F4AC} \u65C1\u8DEF\u63D0\u95EE\u4E2D..." });
        broadcastDashboardEvent({ kind: "assistant_final", id: btwId, text: "\u{1F4AC} \u65C1\u8DEF\u63D0\u95EE\u4E2D..." });
        try {
          const tmpLoop = buildLoop(client, workspaceDir);
          const stopTmpLoop = () => tmpLoop.abort();
          operation.controller.signal.addEventListener("abort", stopTmpLoop, { once: true });
          tmpLoop.clearLog();
          let answer = "";
          for await (const ev of tmpLoop.step(question)) {
            if (ev.role === "assistant_delta") answer += ev.content ?? "";
            if (ev.role === "assistant_final" && ev.content && ev.content.length > answer.length) answer = ev.content;
          }
          operation.controller.signal.removeEventListener("abort", stopTmpLoop);
          if (operation.controller.signal.aborted) return { accepted: true, cancelled: true };
          const doneId = `assistant-${Date.now()}`;
          pushMessage({ id: doneId, role: "assistant", text: `\u{1F4AC} \u65C1\u8DEF\u56DE\u7B54\n\n${answer}` });
          broadcastDashboardEvent({ kind: "assistant_final", id: doneId, text: `\u{1F4AC} \u65C1\u8DEF\u56DE\u7B54\n\n${answer}` });
        } catch (err) {
          if (operation.controller.signal.aborted) return { accepted: true, cancelled: true };
          const errId = `assistant-${Date.now()}`;
          pushMessage({ id: errId, role: "assistant", text: `\u274C \u65C1\u8DEF\u63D0\u95EE\u5931\u8D25: ${err.message}` });
          broadcastDashboardEvent({ kind: "assistant_final", id: errId, text: `\u274C \u65C1\u8DEF\u63D0\u95EE\u5931\u8D25: ${err.message}` });
        } finally {
          busy = false;
          broadcastDashboardEvent({ kind: "busy-change", busy: false });
        }
        return { accepted: true };
      }

      // /report daily|weekly [date] — generate summary report from session history
      // Fixed: was startsWith("/report") which matched "/reportfoo" too;
      // now requires either exact "/report" or "/report " + args.
      if (text === "/report" || text.startsWith("/report ")) {
        const parts = text.split(/\s+/);
        const period = parts[1] ?? "daily";
        if (!["daily", "weekly", "yearly"].includes(period)) {
          const id = `assistant-${Date.now()}`;
          pushMessage({ id, role: "assistant", text: "\u2139\uFE0F \u7528\u6CD5: /report daily|weekly|yearly [YYYY-MM-DD]" });
          broadcastDashboardEvent({ kind: "assistant_final", id, text: "\u2139\uFE0F \u7528\u6CD5: /report daily|weekly|yearly [YYYY-MM-DD]" });
          return { accepted: true };
        }
        broadcastDashboardEvent({ kind: "busy-change", busy: true });
        const reportId = `assistant-${Date.now()}`;
        pushMessage({ id: reportId, role: "assistant", text: `\u{1F4CA} \u6B63\u5728\u751F\u6210${period === "daily" ? "\u65E5\u62A5" : period === "weekly" ? "\u5468\u62A5" : "\u5E74\u62A5"}...` });
        broadcastDashboardEvent({ kind: "assistant_final", id: reportId, text: `\u{1F4CA} \u6B63\u5728\u751F\u6210${period === "daily" ? "\u65E5\u62A5" : period === "weekly" ? "\u5468\u62A5" : "\u5E74\u62A5"}...` });
        try {
          // Delegate to the async report engine (same path as the dashboard
          // ReportsPanel) instead of a duplicate synchronous reader that
          // blocked the event loop and used the stale `entry.text` field.
          const dateArg = parts[2];
          const anchorDate = dateArg ? new Date(dateArg) : new Date();
          const { markdown, stats } = await generateReport(period, Number.isNaN(anchorDate.getTime()) ? new Date() : anchorDate, null, { signal: operation.controller.signal });
          const doneId = `assistant-${Date.now()}`;
          pushMessage({ id: doneId, role: "assistant", text: `${markdown}\n\n---\n\u4F1A\u8BDD\u6570\uFF1A${stats.sessions} \u6D88\u606F\u6570\uFF1A${stats.messages}` });
          broadcastDashboardEvent({ kind: "assistant_final", id: doneId, text: `${markdown}\n\n---\n\u4F1A\u8BDD\u6570\uFF1A${stats.sessions} \u6D88\u606F\u6570\uFF1A${stats.messages}` });
        } catch (err) {
          if (operation.controller.signal.aborted) return { accepted: true, cancelled: true };
          const errId = `assistant-${Date.now()}`;
          pushMessage({ id: errId, role: "assistant", text: `\u274C \u62A5\u544A\u751F\u6210\u5931\u8D25: ${err.message}` });
          broadcastDashboardEvent({ kind: "assistant_final", id: errId, text: `\u274C \u62A5\u544A\u751F\u6210\u5931\u8D25: ${err.message}` });
        } finally {
          busy = false;
          broadcastDashboardEvent({ kind: "busy-change", busy: false });
        }
        return { accepted: true };
      }

      // Unknown slash command — surface a hint instead of leaking the raw
      // "/typo" text to the AI loop as a user message. /retry's fallthrough
      // rewrites `text` to the retried user content (never starts with "/"),
      // so it won't trip this guard.
      if (text.startsWith("/")) {
        const parsed = parseSlashInput(text);
        if (parsed) {
          const id = `assistant-${Date.now()}`;
          const hint = `ℹ️ 未知命令: ${parsed.name ? `/${parsed.name}` : text.split(/\s/)[0]}\n\n输入 /help 查看可用命令。`;
          pushMessage({ id, role: "assistant", text: hint });
          broadcastDashboardEvent({ kind: "assistant_final", id, text: hint });
          return { accepted: true };
        }
      }

      broadcastDashboardEvent({ kind: "busy-change", busy: true });

      if (loop && images && images.length > 0) {
        loop.setPendingImages(images);
      }

      const userMsgId = String(nextMsgId++);
      pushMessage({ id: userMsgId, role: "user", text, images: images?.length ? images : undefined });
      appendActiveMessage({ role: "user", text, images: images?.length ? images : undefined });
      broadcastDashboardEvent({ kind: "user", id: userMsgId, text, images: images?.length ? images : undefined });

      const assistantId = `assistant-${Date.now()}`;
      const completeTurn = typeof opts.onComplete === "function" ? opts.onComplete : null;

      // Fire-and-forget: process the turn asynchronously
      // When committed=true, the outer finally skips busy-reset because
      // the fire-and-forget's own finally handles it.
      committed = true;
      const previousPlanMode = tools.planMode;
      if (opts.readonly === true) {
        tools.setPlanMode(true);
      }
      (async () => {
        let assistantText = "";
        let turnError = null;
        let continuationAttempts = 0;
        let continuationNeeded = false;
        let loopInput = text;
        const turnArtifactPaths = new Set();
        try {
          while (true) {
            let budgetForcedSummary = false;
            let sawToolActivity = false;
            for await (const ev of loop.step(loopInput)) {
              if (ev.role === "tool") {
                sawToolActivity = true;
                const artifactPaths = rememberToolGeneratedArtifacts(ev.toolName, ev.toolArgs);
                const newFiles = [];
                for (const artifactPath of artifactPaths) {
                  const key = process.platform === "win32" ? artifactPath.toLowerCase() : artifactPath;
                  if (turnArtifactPaths.has(key)) continue;
                  turnArtifactPaths.add(key);
                  const info = generatedArtifactFileInfo(artifactPath);
                  if (info) newFiles.push(info);
                }
                if (newFiles.length > 0) {
                  broadcastDashboardEvent({
                    kind: "artifact-created",
                    assistantId,
                    files: newFiles,
                  });
                }
              }
              // Write event to .events.jsonl for cockpit tool activity
              if (eventSink && eventizer) {
                try {
                  const ectx = { model: ev.stats?.model ?? loop.model ?? effectiveModelConfig(config).model, prefixHash: "", reasoningEffort: loop.reasoningEffort ?? "max" };
                  for (const out of eventizer.consume(ev, ectx)) eventSink.append(out);
                } catch {}
              }

              const dashev = loopEventToDashboard(ev, assistantId);
              broadcastDashboardEvent(dashev);

              if (ev.role === "assistant_delta") {
                assistantText += ev.content ?? "";
              }
              if (ev.role === "assistant_final") {
                if (ev.forcedSummaryReason === "budget") {
                  budgetForcedSummary = true;
                  assistantText = ev.content || assistantText;
                } else if (ev.content && ev.content.length > assistantText.length) {
                  // Keep the longest content — the last real answer wins over
                  // shorter intermediate reasoning/tool-use summaries.
                  assistantText = ev.content;
                }
              }
            }

            const continuation = decidePlanContinuation({
              forcedSummaryReason: budgetForcedSummary ? "budget" : null,
              plan: incompleteActivePlanSnapshot(),
              attempts: continuationAttempts,
              maxAttempts: MAX_PLAN_AUTO_CONTINUATIONS,
              aborted: operation.controller.signal.aborted,
              incompleteFinal: !budgetForcedSummary && sawToolActivity,
            });
            if (continuation.action === "continue") {
              const incompletePlan = continuation.plan;
              const continuationReason = budgetForcedSummary ? "budget" : "incomplete-final";
              continuationAttempts++;
              broadcastDashboardEvent({
                kind: "status",
                text: continuationReason === "budget"
                  ? `本轮工具额度已用完，计划仍有 ${incompletePlan.totalSteps - incompletePlan.completedSteps} 步未完成，正在自动继续（${continuationAttempts}/${MAX_PLAN_AUTO_CONTINUATIONS}）`
                  : `计划仍有 ${incompletePlan.totalSteps - incompletePlan.completedSteps} 步未完成，正在继续执行（${continuationAttempts}/${MAX_PLAN_AUTO_CONTINUATIONS}）`,
              });
              assistantText = "";
              loopInput = planAutoContinuationPrompt(incompletePlan, continuationAttempts, continuationReason);
              continue;
            }
            if (continuation.action === "pause") {
              const incompletePlan = continuation.plan;
              continuationNeeded = true;
              broadcastDashboardEvent({
                kind: "plan-continuation-needed",
                attempts: continuationAttempts,
                maxAttempts: MAX_PLAN_AUTO_CONTINUATIONS,
                plan: incompletePlan,
              });
            }
            break;
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
            broadcastDashboardEvent({
              kind: "assistant_final",
              id: assistantId,
              text: assistantText,
              forcedSummary: continuationNeeded,
              planIncomplete: continuationNeeded,
            });
          }
        } catch (err) {
          turnError = err;
          broadcastDashboardEvent({
            kind: "error",
            id: `${assistantId}-error-${Date.now()}`,
            text: err.message,
          });
        } finally {
          await syncActiveSessionFromLoop({ text, images });
          if (opts.readonly === true) {
            tools.setPlanMode(previousPlanMode);
          }
          if (completeTurn) {
            try {
              completeTurn({
                ok: !turnError && !operation.controller.signal.aborted,
                cancelled: operation.controller.signal.aborted,
                error: turnError?.message ?? null,
                assistantText,
                assistantMessageId: assistantId,
                userMessageId: userMsgId,
                stats: loop?.stats?.summary?.() ?? null,
              });
            } catch (err) {
              console.error(`[launcher] submitPrompt completion callback failed: ${err.message}`);
            }
          }
          const appliedSwitch = commitPendingModelSwitch();
          if (appliedSwitch) {
            broadcastDashboardEvent({
              kind: "status",
              text: `\u5DF2\u5207\u6362\u5230 ${appliedSwitch.model}\uFF0C\u4FDD\u7559 ${appliedSwitch.messageCount} \u6761\u4E0A\u4E0B\u6587`,
            });
            broadcastDashboardEvent({ kind: "config-changed" });
          }
          busy = false;
          broadcastDashboardEvent({ kind: "busy-change", busy: false });
          detachExternalSignal();
          finishActiveOperation(operation);
        }
      })();

      const acceptedResult = { accepted: true, requestId: requestId || null, turnId: assistantId };
      rememberAcceptedPromptRequest(requestId, acceptedResult);
      return acceptedResult;
    } finally {
      // Reset busy on any early-return path (session load, /new, no-loop, etc.)
      if (!committed) {
        detachExternalSignal();
        busy = false;
        broadcastDashboardEvent({ kind: "busy-change", busy: false });
        finishActiveOperation(operation);
      }
    }
  },

  abortTurn: () => {
    pauseGate.cancelAll();
    clearActiveModals();
    broadcastDashboardEvent({ kind: "todo-update", todos: [] });
    if (busy) {
      if (activeOperation) {
        activeOperation.state = "stopping";
        activeOperation.stopRequestedAt = new Date().toISOString();
        activeOperation.controller.abort();
        broadcastDashboardEvent({ kind: "operation-change", operation: publicActiveOperation() });
        void jobs.stopOwned(activeOperation.id, { graceMs: 100 });
      }
      loop?.abort();
    }
    return { accepted: busy, operation: publicActiveOperation() };
  },

  isBusy: () => busy,

  getStats: () => {
    if (!loop) return null;
    const s = loop.stats.summary();
    const contextStatus = loop.contextStatus?.() ?? null;
    const contextPolicy = contextPolicyFor(loop.model);
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
      contextCapTokens: contextStatus?.ctxMax ?? DEEPSEEK_CONTEXT_TOKENS[loop.model] ?? DEFAULT_CONTEXT_TOKENS,
      estimatedContextTokens: contextStatus?.estimatedTokens ?? s.lastPromptTokens,
      contextFoldTokens: contextStatus?.foldTokens ?? null,
      contextAggressiveTokens: contextStatus?.aggressiveTokens ?? null,
      contextForceSummaryTokens: contextStatus?.forceSummaryTokens ?? null,
      contextNeedsCompaction: contextStatus?.needsCompaction ?? false,
      contextCapacitySource: contextPolicy.capacitySource,
      contextEffectiveSource: contextPolicy.source,
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
refreshAllScheduleTimers();

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
    for (const timer of scheduleTimers.values()) clearTimeout(timer);
    scheduleTimers.clear();
    // Flush the active-session append stream before exiting so buffered
    // messages are not lost. closeActiveSessionStream resolves immediately
    // when no stream was opened.
    closeActiveSessionStream()
      .then(() => close())
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
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
