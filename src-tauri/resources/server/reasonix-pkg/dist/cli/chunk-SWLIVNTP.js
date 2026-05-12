#!/usr/bin/env node

// src/config.ts
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

// src/cli/ui/theme/tokens.ts
function card(fg, tone) {
  return {
    user: { color: fg.meta, glyph: "\u25C7" },
    reasoning: { color: tone.accent, glyph: "\u25C6" },
    streaming: { color: tone.brand, glyph: "\u25C8" },
    task: { color: tone.warn, glyph: "\u25B6" },
    tool: { color: tone.info, glyph: "\u25A3" },
    plan: { color: tone.accent, glyph: "\u229E" },
    diff: { color: tone.ok, glyph: "\xB1" },
    error: { color: tone.err, glyph: "\u2716" },
    warn: { color: tone.warn, glyph: "\u26A0" },
    usage: { color: fg.meta, glyph: "\u03A3" },
    subagent: { color: tone.violet, glyph: "\u232C" },
    approval: { color: tone.warn, glyph: "?" },
    search: { color: tone.info, glyph: "\u2299" },
    memory: { color: fg.meta, glyph: "\u2311" },
    ctx: { color: tone.brand, glyph: "\u25D4" },
    doctor: { color: fg.meta, glyph: "\u2695" },
    branch: { color: tone.violet, glyph: "\u2387" }
  };
}
function defineTheme(base) {
  return { ...base, card: card(base.fg, base.tone) };
}
var githubDark = defineTheme({
  fg: {
    strong: "#e6edf3",
    body: "#c9d1d9",
    sub: "#8b949e",
    meta: "#6e7681",
    faint: "#484f58"
  },
  tone: {
    brand: "#79c0ff",
    accent: "#d2a8ff",
    violet: "#b395f5",
    ok: "#7ee787",
    warn: "#f0b07d",
    err: "#ff8b81",
    info: "#79c0ff"
  },
  toneActive: {
    brand: "#a5d6ff",
    accent: "#e2c5ff",
    violet: "#c8aaff",
    ok: "#a8f5ad",
    warn: "#ffc99e",
    err: "#ffaba3",
    info: "#a5d6ff"
  },
  surface: {
    bg: "#0a0c10",
    bgInput: "#0d1015",
    bgCode: "#06080c",
    bgElev: "#11141a"
  }
});
var dark = defineTheme({
  fg: {
    strong: "#f4f7fb",
    body: "#d8dee9",
    sub: "#a7b1c2",
    meta: "#778294",
    faint: "#4d5666"
  },
  tone: {
    brand: "#7dd3fc",
    accent: "#c084fc",
    violet: "#a78bfa",
    ok: "#86efac",
    warn: "#fbbf24",
    err: "#f87171",
    info: "#60a5fa"
  },
  toneActive: {
    brand: "#bae6fd",
    accent: "#e9d5ff",
    violet: "#ddd6fe",
    ok: "#bbf7d0",
    warn: "#fde68a",
    err: "#fecaca",
    info: "#bfdbfe"
  },
  surface: {
    bg: "#0b1020",
    bgInput: "#111827",
    bgCode: "#080c16",
    bgElev: "#151d2f"
  }
});
var light = defineTheme({
  fg: {
    strong: "#111827",
    body: "#1f2937",
    sub: "#4b5563",
    meta: "#6b7280",
    faint: "#9ca3af"
  },
  tone: {
    brand: "#2563eb",
    accent: "#7c3aed",
    violet: "#6d28d9",
    ok: "#15803d",
    warn: "#b45309",
    err: "#dc2626",
    info: "#0369a1"
  },
  toneActive: {
    brand: "#1d4ed8",
    accent: "#6d28d9",
    violet: "#5b21b6",
    ok: "#166534",
    warn: "#92400e",
    err: "#b91c1c",
    info: "#075985"
  },
  surface: {
    bg: "#ffffff",
    bgInput: "#f8fafc",
    bgCode: "#f3f4f6",
    bgElev: "#eef2f7"
  }
});
var tokyoNight = defineTheme({
  fg: {
    strong: "#c0caf5",
    body: "#a9b1d6",
    sub: "#9aa5ce",
    meta: "#565f89",
    faint: "#414868"
  },
  tone: {
    brand: "#7aa2f7",
    accent: "#bb9af7",
    violet: "#9d7cd8",
    ok: "#9ece6a",
    warn: "#e0af68",
    err: "#f7768e",
    info: "#2ac3de"
  },
  toneActive: {
    brand: "#a9c7ff",
    accent: "#d7b9ff",
    violet: "#c6a0f6",
    ok: "#b9f27c",
    warn: "#ffd089",
    err: "#ff9cac",
    info: "#7dcfff"
  },
  surface: {
    bg: "#1a1b26",
    bgInput: "#1f2335",
    bgCode: "#16161e",
    bgElev: "#24283b"
  }
});
var githubLight = defineTheme({
  fg: {
    strong: "#1f2328",
    body: "#24292f",
    sub: "#57606a",
    meta: "#6e7781",
    faint: "#8c959f"
  },
  tone: {
    brand: "#0969da",
    accent: "#8250df",
    violet: "#6639ba",
    ok: "#1a7f37",
    warn: "#9a6700",
    err: "#cf222e",
    info: "#0969da"
  },
  toneActive: {
    brand: "#0550ae",
    accent: "#6639ba",
    violet: "#512a97",
    ok: "#116329",
    warn: "#7d4e00",
    err: "#a40e26",
    info: "#0550ae"
  },
  surface: {
    bg: "#ffffff",
    bgInput: "#f6f8fa",
    bgCode: "#f6f8fa",
    bgElev: "#eaeef2"
  }
});
var highContrast = defineTheme({
  fg: {
    strong: "#ffffff",
    body: "#f5f5f5",
    sub: "#d4d4d4",
    meta: "#bdbdbd",
    faint: "#8a8a8a"
  },
  tone: {
    brand: "#00e5ff",
    accent: "#ff4dff",
    violet: "#b388ff",
    ok: "#00ff66",
    warn: "#ffdd00",
    err: "#ff4d4d",
    info: "#4da3ff"
  },
  toneActive: {
    brand: "#80f2ff",
    accent: "#ff99ff",
    violet: "#d0b3ff",
    ok: "#80ffb3",
    warn: "#ffee80",
    err: "#ff9999",
    info: "#99c9ff"
  },
  surface: {
    bg: "#000000",
    bgInput: "#0a0a0a",
    bgCode: "#050505",
    bgElev: "#141414"
  }
});
var THEMES = {
  default: githubDark,
  dark,
  light,
  "tokyo-night": tokyoNight,
  "github-dark": githubDark,
  "github-light": githubLight,
  "high-contrast": highContrast
};
var DEFAULT_THEME_NAME = "default";
function isThemeName(value) {
  return Object.prototype.hasOwnProperty.call(THEMES, value);
}
function resolveThemeName(value) {
  if (!value || value === "auto") return DEFAULT_THEME_NAME;
  return isThemeName(value) ? value : DEFAULT_THEME_NAME;
}
function listThemeNames() {
  return Object.keys(THEMES);
}
var DEFAULT_THEME = THEMES[DEFAULT_THEME_NAME];
var activeTheme = DEFAULT_THEME;
var activeThemeVersion = 0;
function setActiveTheme(theme) {
  const previousTheme = activeTheme;
  activeTheme = theme;
  activeThemeVersion += 1;
  const version = activeThemeVersion;
  return () => {
    if (activeThemeVersion !== version || activeTheme !== theme) return;
    activeTheme = previousTheme;
    activeThemeVersion += 1;
  };
}
function proxyTokens(select) {
  const target = select(DEFAULT_THEME);
  return new Proxy(target, {
    get(_target, prop) {
      return select(activeTheme)[prop];
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(select(activeTheme), prop);
    },
    has(_target, prop) {
      return prop in select(activeTheme);
    },
    ownKeys() {
      return Reflect.ownKeys(select(activeTheme));
    }
  });
}
var FG = proxyTokens((theme) => theme.fg);
var TONE = proxyTokens((theme) => theme.tone);
var TONE_ACTIVE = proxyTokens((theme) => theme.toneActive);
var SURFACE = proxyTokens((theme) => theme.surface);
var CARD = proxyTokens((theme) => theme.card);
var USD_TO_CNY = 7.2;
var SYMBOL = { USD: "$", CNY: "\xA5" };
function formatBalance(amount, currency, opts) {
  const cur = currency ?? "CNY";
  const sym = SYMBOL[cur];
  const digits = opts?.fractionDigits ?? 2;
  const body = sym ? `${sym}${amount.toFixed(digits)}` : `${cur} ${amount.toFixed(digits)}`;
  return opts?.label ? `w ${body}` : body;
}
function formatCost(costUsd, currency, fractionDigits = 4) {
  const cur = currency ?? "CNY";
  const amount = cur === "CNY" ? costUsd * USD_TO_CNY : costUsd;
  return formatBalance(amount, cur, { fractionDigits });
}
function balanceColor(amount, currency) {
  const cny = (currency ?? "CNY") === "USD" ? amount * USD_TO_CNY : amount;
  if (cny < 5) return TONE.err;
  if (cny < 20) return TONE.warn;
  return TONE.brand;
}

// src/index/config.ts
import picomatch from "picomatch";
var DEFAULT_INDEX_EXCLUDES = {
  dirs: [
    "node_modules",
    ".git",
    ".hg",
    ".svn",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    "target",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".cache",
    "coverage",
    ".turbo",
    ".vercel",
    ".reasonix"
  ],
  files: [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "poetry.lock",
    "Pipfile.lock",
    "go.sum",
    ".DS_Store"
  ],
  exts: [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".ico",
    ".tiff",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".zip",
    ".tar",
    ".gz",
    ".bz2",
    ".xz",
    ".rar",
    ".7z",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".bin",
    ".class",
    ".jar",
    ".war",
    ".wasm",
    ".o",
    ".obj",
    ".lib",
    ".a",
    ".pyc",
    ".pyo",
    ".mp3",
    ".mp4",
    ".wav",
    ".ogg",
    ".webm",
    ".mov",
    ".avi",
    ".pdf",
    ".sqlite",
    ".db"
  ]
};
var DEFAULT_MAX_FILE_BYTES = 256 * 1024;
var DEFAULT_RESPECT_GITIGNORE = true;
function defaultIndexConfig() {
  return {
    excludeDirs: [...DEFAULT_INDEX_EXCLUDES.dirs],
    excludeFiles: [...DEFAULT_INDEX_EXCLUDES.files],
    excludeExts: [...DEFAULT_INDEX_EXCLUDES.exts],
    excludePatterns: [],
    respectGitignore: DEFAULT_RESPECT_GITIGNORE,
    maxFileBytes: DEFAULT_MAX_FILE_BYTES
  };
}
function resolveIndexConfig(user) {
  const d = defaultIndexConfig();
  if (!user) return d;
  return {
    excludeDirs: Array.isArray(user.excludeDirs) ? [...user.excludeDirs] : d.excludeDirs,
    excludeFiles: Array.isArray(user.excludeFiles) ? [...user.excludeFiles] : d.excludeFiles,
    excludeExts: Array.isArray(user.excludeExts) ? user.excludeExts.map((e) => e.toLowerCase()) : d.excludeExts,
    excludePatterns: Array.isArray(user.excludePatterns) ? [...user.excludePatterns] : [],
    respectGitignore: typeof user.respectGitignore === "boolean" ? user.respectGitignore : d.respectGitignore,
    maxFileBytes: typeof user.maxFileBytes === "number" && user.maxFileBytes > 0 ? user.maxFileBytes : d.maxFileBytes
  };
}
function compileFilters(cfg) {
  const matcher = cfg.excludePatterns.length === 0 ? () => false : picomatch(cfg.excludePatterns, { dot: true });
  return {
    dirSet: new Set(cfg.excludeDirs),
    fileSet: new Set(cfg.excludeFiles),
    extSet: new Set(cfg.excludeExts.map((e) => e.toLowerCase())),
    patternMatch: matcher,
    respectGitignore: cfg.respectGitignore,
    maxFileBytes: cfg.maxFileBytes
  };
}

// src/config.ts
var DEFAULT_OLLAMA_URL = "http://localhost:11434";
var DEFAULT_EMBED_MODEL = "nomic-embed-text";
var DEFAULT_TIMEOUT_MS = 3e4;
function defaultConfigPath() {
  return join(homedir(), ".reasonix", "config.json");
}
function readConfig(path = defaultConfigPath()) {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
  }
  return {};
}
function writeConfig(cfg, path = defaultConfigPath()) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2), "utf8");
  try {
    chmodSync(path, 384);
  } catch {
  }
}
function loadLanguage(path = defaultConfigPath()) {
  return readConfig(path).lang;
}
function mcpEnvFor(serverName, cfg) {
  if (!serverName) return void 0;
  const entry = cfg.mcpEnv?.[serverName];
  if (!entry) return void 0;
  const filtered = {};
  for (const [k, v] of Object.entries(entry)) {
    if (typeof v === "string" && v.length > 0) filtered[k] = v;
  }
  return Object.keys(filtered).length > 0 ? filtered : void 0;
}
function saveLanguage(lang, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.lang = lang;
  writeConfig(cfg, path);
}
function loadApiKey(path = defaultConfigPath()) {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
  return readConfig(path).apiKey;
}
function loadBaseUrl(path = defaultConfigPath()) {
  if (process.env.DEEPSEEK_BASE_URL) return process.env.DEEPSEEK_BASE_URL;
  return readConfig(path).baseUrl;
}
function searchEnabled(path = defaultConfigPath()) {
  const env = process.env.REASONIX_SEARCH;
  if (env === "off" || env === "false" || env === "0") return false;
  const cfg = readConfig(path).search;
  if (cfg === false) return false;
  return true;
}
function webSearchEngine(path = defaultConfigPath()) {
  const cfg = readConfig(path).webSearchEngine;
  if (cfg === "searxng") return "searxng";
  return "mojeek";
}
function webSearchEndpoint(path = defaultConfigPath()) {
  const cfg = readConfig(path).webSearchEndpoint;
  if (cfg && typeof cfg === "string") return cfg;
  return "http://localhost:8080";
}
function saveApiKey(key, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.apiKey = key.trim();
  writeConfig(cfg, path);
}
function findProjectKey(cfg, rootDir) {
  const projects = cfg.projects;
  if (!projects) return void 0;
  if (Object.hasOwn(projects, rootDir)) return rootDir;
  if (process.platform !== "win32") return void 0;
  const lower = rootDir.toLowerCase();
  for (const k of Object.keys(projects)) {
    if (k.toLowerCase() === lower) return k;
  }
  return void 0;
}
function loadProjectShellAllowed(rootDir, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  const key = findProjectKey(cfg, rootDir);
  if (key === void 0) return [];
  return cfg.projects?.[key]?.shellAllowed ?? [];
}
function addProjectShellAllowed(rootDir, prefix, path = defaultConfigPath()) {
  const trimmed = prefix.trim();
  if (!trimmed) return;
  const cfg = readConfig(path);
  if (!cfg.projects) cfg.projects = {};
  const key = findProjectKey(cfg, rootDir) ?? rootDir;
  if (!cfg.projects[key]) cfg.projects[key] = {};
  const existing = cfg.projects[key].shellAllowed ?? [];
  if (existing.includes(trimmed)) return;
  cfg.projects[key].shellAllowed = [...existing, trimmed];
  writeConfig(cfg, path);
}
function removeProjectShellAllowed(rootDir, prefix, path = defaultConfigPath()) {
  const trimmed = prefix.trim();
  if (!trimmed) return false;
  const cfg = readConfig(path);
  const key = findProjectKey(cfg, rootDir);
  if (key === void 0) return false;
  const existing = cfg.projects?.[key]?.shellAllowed ?? [];
  if (!existing.includes(trimmed)) return false;
  const next = existing.filter((p) => p !== trimmed);
  if (!cfg.projects) cfg.projects = {};
  if (!cfg.projects[key]) cfg.projects[key] = {};
  cfg.projects[key].shellAllowed = next;
  writeConfig(cfg, path);
  return true;
}
function clearProjectShellAllowed(rootDir, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  const key = findProjectKey(cfg, rootDir);
  if (key === void 0) return 0;
  const existing = cfg.projects?.[key]?.shellAllowed ?? [];
  if (existing.length === 0) return 0;
  if (!cfg.projects) cfg.projects = {};
  if (!cfg.projects[key]) cfg.projects[key] = {};
  cfg.projects[key].shellAllowed = [];
  writeConfig(cfg, path);
  return existing.length;
}
function loadEditMode(path = defaultConfigPath()) {
  const v = readConfig(path).editMode;
  if (v === "auto" || v === "yolo") return v;
  return "review";
}
function saveEditMode(mode, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.editMode = mode;
  writeConfig(cfg, path);
}
function editModeHintShown(path = defaultConfigPath()) {
  return readConfig(path).editModeHintShown === true;
}
function mouseClipboardHintShown(path = defaultConfigPath()) {
  return readConfig(path).mouseClipboardHintShown === true;
}
function loadReasoningEffort(path = defaultConfigPath()) {
  const v = readConfig(path).reasoningEffort;
  return v === "high" ? "high" : "max";
}
function loadTheme(path = defaultConfigPath()) {
  const value = readConfig(path).theme;
  if (value === "auto") return "auto";
  if (typeof value === "string" && isThemeName(value)) return value;
  return void 0;
}
function resolveThemePreference(configTheme, envTheme) {
  if (configTheme && configTheme !== "auto") return configTheme;
  return resolveThemeName(envTheme);
}
function saveTheme(theme, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.theme = theme;
  writeConfig(cfg, path);
}
function saveReasoningEffort(effort, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.reasoningEffort = effort;
  writeConfig(cfg, path);
}
function loadIndexUserConfig(path = defaultConfigPath()) {
  return readConfig(path).index ?? {};
}
function loadIndexConfig(path = defaultConfigPath()) {
  return resolveIndexConfig(readConfig(path).index);
}
function loadSemanticEmbeddingUserConfig(path = defaultConfigPath()) {
  return normalizeSemanticEmbeddingUserConfig(readConfig(path).semantic);
}
function saveSemanticEmbeddingConfig(user, path = defaultConfigPath()) {
  const cfg = readConfig(path);
  cfg.semantic = normalizeSemanticEmbeddingUserConfig(user);
  writeConfig(cfg, path);
}
function resolveSemanticEmbeddingConfig(path = defaultConfigPath()) {
  const user = loadSemanticEmbeddingUserConfig(path);
  const provider = user.provider ?? "ollama";
  if (provider === "openai-compat") {
    const baseUrl = user.openaiCompat?.baseUrl?.trim() ?? "";
    const apiKey = user.openaiCompat?.apiKey?.trim() ?? "";
    const model = user.openaiCompat?.model?.trim() ?? "";
    if (!baseUrl) throw new Error("OpenAI-compatible embeddings require an API URL.");
    requireValidUrl(baseUrl, "OpenAI-compatible API URL");
    if (!apiKey) throw new Error("OpenAI-compatible embeddings require an API key.");
    if (!model) throw new Error("OpenAI-compatible embeddings require a model.");
    return {
      provider,
      baseUrl,
      apiKey,
      model,
      extraBody: normalizeExtraBody(user.openaiCompat?.extraBody),
      timeoutMs: DEFAULT_TIMEOUT_MS
    };
  }
  return {
    provider: "ollama",
    baseUrl: user.ollama?.baseUrl?.trim() || process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL,
    model: user.ollama?.model?.trim() || process.env.REASONIX_EMBED_MODEL || DEFAULT_EMBED_MODEL,
    timeoutMs: DEFAULT_TIMEOUT_MS
  };
}
function redactSemanticEmbeddingConfig(user) {
  const normalized = normalizeSemanticEmbeddingUserConfig(user);
  return {
    provider: normalized.provider ?? "ollama",
    ollama: {
      baseUrl: normalized.ollama?.baseUrl?.trim() || process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL,
      model: normalized.ollama?.model?.trim() || process.env.REASONIX_EMBED_MODEL || DEFAULT_EMBED_MODEL
    },
    openaiCompat: {
      baseUrl: normalized.openaiCompat?.baseUrl?.trim() ?? "",
      apiKey: normalized.openaiCompat?.apiKey ? redactKey(normalized.openaiCompat.apiKey) : "",
      apiKeySet: Boolean(normalized.openaiCompat?.apiKey?.trim()),
      model: normalized.openaiCompat?.model?.trim() ?? "",
      extraBody: normalizeExtraBody(normalized.openaiCompat?.extraBody)
    }
  };
}
function markEditModeHintShown(path = defaultConfigPath()) {
  const cfg = readConfig(path);
  if (cfg.editModeHintShown === true) return;
  cfg.editModeHintShown = true;
  writeConfig(cfg, path);
}
function markMouseClipboardHintShown(path = defaultConfigPath()) {
  const cfg = readConfig(path);
  if (cfg.mouseClipboardHintShown === true) return;
  cfg.mouseClipboardHintShown = true;
  writeConfig(cfg, path);
}
function isPlausibleKey(key) {
  const trimmed = key.trim();
  if (trimmed.length < 16) return false;
  return !/\s/.test(trimmed);
}
function redactKey(key) {
  if (!key) return "";
  if (key.length <= 12) return "****";
  return `${key.slice(0, 6)}\u2026${key.slice(-4)}`;
}
function normalizeSemanticEmbeddingUserConfig(cfg) {
  return {
    provider: cfg?.provider === "openai-compat" ? "openai-compat" : "ollama",
    ollama: {
      baseUrl: normalizeOptionalString(cfg?.ollama?.baseUrl),
      model: normalizeOptionalString(cfg?.ollama?.model)
    },
    openaiCompat: {
      baseUrl: normalizeOptionalString(cfg?.openaiCompat?.baseUrl),
      apiKey: normalizeOptionalString(cfg?.openaiCompat?.apiKey),
      model: normalizeOptionalString(cfg?.openaiCompat?.model),
      extraBody: normalizeExtraBody(cfg?.openaiCompat?.extraBody)
    }
  };
}
function normalizeOptionalString(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : void 0;
}
function normalizeExtraBody(value) {
  if (value === void 0) return {};
  if (!isPlainObject(value)) {
    throw new Error("Semantic embedding extraBody must be a JSON object.");
  }
  return { ...value };
}
function requireValidUrl(value, label) {
  try {
    new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
}
function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export {
  THEMES,
  DEFAULT_THEME_NAME,
  isThemeName,
  resolveThemeName,
  listThemeNames,
  setActiveTheme,
  FG,
  TONE,
  TONE_ACTIVE,
  SURFACE,
  CARD,
  formatBalance,
  formatCost,
  balanceColor,
  DEFAULT_INDEX_EXCLUDES,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_RESPECT_GITIGNORE,
  defaultIndexConfig,
  resolveIndexConfig,
  compileFilters,
  defaultConfigPath,
  readConfig,
  writeConfig,
  loadLanguage,
  mcpEnvFor,
  saveLanguage,
  loadApiKey,
  loadBaseUrl,
  searchEnabled,
  webSearchEngine,
  webSearchEndpoint,
  saveApiKey,
  loadProjectShellAllowed,
  addProjectShellAllowed,
  removeProjectShellAllowed,
  clearProjectShellAllowed,
  loadEditMode,
  saveEditMode,
  editModeHintShown,
  mouseClipboardHintShown,
  loadReasoningEffort,
  loadTheme,
  resolveThemePreference,
  saveTheme,
  saveReasoningEffort,
  loadIndexUserConfig,
  loadIndexConfig,
  loadSemanticEmbeddingUserConfig,
  saveSemanticEmbeddingConfig,
  resolveSemanticEmbeddingConfig,
  redactSemanticEmbeddingConfig,
  markEditModeHintShown,
  markMouseClipboardHintShown,
  isPlausibleKey,
  redactKey
};
//# sourceMappingURL=chunk-SWLIVNTP.js.map