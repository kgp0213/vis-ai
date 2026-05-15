#!/usr/bin/env node
import {
  loadOverlay
} from "./chunk-Y5XNV3NX.js";
import {
  createMcpRuntime
} from "./chunk-SXLJBFIV.js";
import {
  Eventizer,
  registerSkillTools,
  shouldAutoResolveCheckpoint
} from "./chunk-A7VHMMDE.js";
import {
  formatMcpLifecycleEvent,
  formatMcpSlowToast
} from "./chunk-LTXADNCO.js";
import {
  buildTransportFromSpec
} from "./chunk-BOFL3T45.js";
import {
  dumpStartupProfile,
  markPhase
} from "./chunk-CPOV2O73.js";
import {
  CacheFirstLoop,
  ImmutablePrefix,
  ToolRegistry,
  applyEditBlocks,
  detectAtPicker,
  expandAtMentions,
  expandAtUrls,
  formatSubagentResult,
  listDirectory,
  parseAtQuery,
  parseEditBlocks,
  rankPickerCandidates,
  registerChoiceTool,
  registerMemoryTools,
  registerSingleMcpTool,
  registerWebTools,
  restoreSnapshots,
  snapshotBeforeEdits,
  spawnSubagent,
  toWholeFileEditBlock,
  walkFilesStream,
  webFetch
} from "./chunk-IEA6JOIP.js";
import {
  openTranscriptFile,
  recordFromLoopEvent,
  writeRecord
} from "./chunk-7SPOFTMT.js";
import {
  McpClient,
  parseMcpSpec
} from "./chunk-CFY2XLY6.js";
import {
  MemoryStore,
  effectivePriority
} from "./chunk-ARF3N2SY.js";
import {
  KeystrokeProvider,
  SingleSelect,
  useKeystroke
} from "./chunk-4W2CICFQ.js";
import {
  COLOR,
  GLYPH,
  GRADIENT,
  ThemeProvider,
  useColor,
  useThemeTokens
} from "./chunk-UV7XJUJH.js";
import {
  PRESETS,
  PRESET_DESCRIPTIONS,
  resolvePreset
} from "./chunk-E46ECXJD.js";
import {
  runDoctorChecks
} from "./chunk-KZYLMMU5.js";
import {
  countTokens
} from "./chunk-DAEAAVDF.js";
import {
  DeepSeekClient,
  pickPrimaryBalance
} from "./chunk-H4OLWRSX.js";
import {
  loadDotenv
} from "./chunk-3Q3C4W66.js";
import {
  renderDashboard
} from "./chunk-4DCHFFEY.js";
import {
  MANUAL_UPDATE_COMMANDS,
  planUpdate
} from "./chunk-WJ3YX4PZ.js";
import {
  SLASH_COMMANDS,
  SLASH_GROUP_ORDER,
  archivePlanState,
  clearPlanState,
  countAdvancedCommands,
  createCheckpoint,
  deleteCheckpoint,
  detectSlashArgContext,
  findCheckpoint,
  fmtAgo,
  listCheckpoints,
  listPlanArchives,
  loadPlanState,
  orderSlashCommandsByGroup,
  parseSlash,
  relativeTime,
  resolveSlashAlias,
  restoreCheckpoint,
  savePlanState,
  suggestSlashCommands
} from "./chunk-A3LL4XDV.js";
import {
  fetchSmitheryDetail,
  loadMorePages,
  openRegistry,
  specStringFor
} from "./chunk-SOZE7V7V.js";
import {
  eventLogPath,
  openEventSink
} from "./chunk-7VFNPMKG.js";
import {
  BUILTIN_ALLOWLIST,
  formatCommandResult,
  pauseGate,
  runCommand
} from "./chunk-BYZGO3BX.js";
import {
  PROJECT_MEMORY_FILE,
  SkillStore,
  memoryEnabled,
  readProjectMemory,
  resolveProjectMemoryWritePath
} from "./chunk-CD4SCQL4.js";
import {
  HOOK_EVENTS,
  formatHookOutcomeMessage,
  globalSettingsPath,
  loadHooks,
  projectSettingsPath,
  runHooks
} from "./chunk-WE3YZULK.js";
import {
  deleteSession,
  detectGitBranch,
  freshSessionName,
  listSessionsForWorkspace,
  loadSessionMessages,
  loadSessionMeta,
  patchSessionMeta,
  renameSession,
  resolveSession,
  sanitizeName,
  sessionsDir
} from "./chunk-YJFKFTAL.js";
import {
  getLanguage,
  getSupportedLanguages,
  notifyLanguageChange,
  onLanguageChange,
  setLanguage,
  t,
  tObj
} from "./chunk-MHGPBJ2T.js";
import {
  CARD,
  FG,
  SURFACE,
  TONE,
  TONE_ACTIVE,
  addProjectShellAllowed,
  balanceColor,
  clearProjectShellAllowed,
  defaultConfigPath,
  editModeHintShown,
  formatBalance,
  formatCost,
  isPlausibleKey,
  isThemeName,
  listThemeNames,
  loadApiKey,
  loadBaseUrl,
  loadEditMode,
  loadProjectShellAllowed,
  loadReasoningEffort,
  loadTheme,
  markEditModeHintShown,
  markMouseClipboardHintShown,
  mcpEnvFor,
  mouseClipboardHintShown,
  readConfig,
  redactKey,
  removeProjectShellAllowed,
  resolveThemePreference,
  saveApiKey,
  saveEditMode,
  savePreset,
  saveTheme,
  searchEnabled,
  webSearchEndpoint,
  webSearchEngine,
  writeConfig
} from "./chunk-65Q5HQ26.js";
import {
  aggregateUsage,
  appendUsage,
  defaultUsageLogPath,
  readUsageLog
} from "./chunk-ZTLZO42A.js";
import {
  DEEPSEEK_CONTEXT_TOKENS,
  DEEPSEEK_PRICING,
  DEFAULT_CONTEXT_TOKENS
} from "./chunk-ORM6PK57.js";
import {
  VERSION,
  compareVersions,
  detectInstallSource,
  detectNpmInstallPrefix,
  getLatestVersion
} from "./chunk-CRPQUBP6.js";

// src/cli/commands/chat.tsx
import { render } from "ink";
import React69, { useState as useState31 } from "react";

// src/cli/ui/App.tsx
import { statSync } from "fs";
import { resolve } from "path";
import { Box as Box54, Text as Text57, useStdin, useStdout as useStdout18 } from "ink";
import React66, { useCallback as useCallback13, useEffect as useEffect17, useMemo as useMemo12, useRef as useRef10, useState as useState29 } from "react";

// src/code/pending-edits.ts
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
function pendingEditsPath(sessionName) {
  return join(sessionsDir(), `${sanitizeName(sessionName)}.pending.json`);
}
function savePendingEdits(sessionName, blocks) {
  if (!sessionName) return;
  const path = pendingEditsPath(sessionName);
  try {
    if (blocks.length === 0) {
      if (existsSync(path)) unlinkSync(path);
      return;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(blocks, null, 2), "utf8");
  } catch {
  }
}
function loadPendingEdits(sessionName) {
  if (!sessionName) return null;
  const path = pendingEditsPath(sessionName);
  if (!existsSync(path)) return null;
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const out = [];
    for (const item of parsed) {
      if (item && typeof item === "object" && typeof item.path === "string" && typeof item.search === "string" && typeof item.replace === "string" && typeof item.offset === "number") {
        out.push(item);
      }
    }
    return out;
  } catch {
    return null;
  }
}
function clearPendingEdits(sessionName) {
  if (!sessionName) return;
  const path = pendingEditsPath(sessionName);
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
  }
}

// src/slash-usage.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, renameSync, writeFileSync as writeFileSync2 } from "fs";
import { homedir } from "os";
import { dirname as dirname2, join as join2 } from "path";
function slashUsagePath() {
  const override = process.env.REASONIX_SLASH_USAGE_PATH;
  if (override) return override;
  return join2(homedir(), ".visionox", "slash-usage.json");
}
function loadSlashUsage() {
  const path = slashUsagePath();
  if (!existsSync2(path)) return {};
  try {
    const raw = readFileSync2(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed.counts ?? {})) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
function persist(counts) {
  const path = slashUsagePath();
  const tmp = `${path}.tmp`;
  const payload = { version: 1, counts };
  try {
    mkdirSync2(dirname2(path), { recursive: true });
    writeFileSync2(tmp, JSON.stringify(payload), "utf8");
    renameSync(tmp, path);
  } catch {
  }
}
function recordSlashUse(name) {
  const counts = { ...loadSlashUsage() };
  counts[name] = (counts[name] ?? 0) + 1;
  persist(counts);
  return counts;
}

// src/cli/edit/external-editor.ts
import { spawn } from "child_process";
import { mkdtempSync, readFileSync as readFileSync3, rmSync, writeFileSync as writeFileSync3 } from "fs";
import { tmpdir } from "os";
import { join as join3 } from "path";
function detectEditor(env = process.env) {
  for (const key of ["GIT_EDITOR", "VISUAL", "EDITOR"]) {
    const raw = env[key];
    if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  }
  return null;
}
async function openInExternalEditor(initial2) {
  const editor = detectEditor();
  if (!editor) {
    return {
      kind: "missing",
      content: initial2,
      detail: t("composer.editorMissing")
    };
  }
  const dir = mkdtempSync(join3(tmpdir(), "reasonix-compose-"));
  const path = join3(dir, "REASONIX_INPUT.md");
  try {
    writeFileSync3(path, initial2, "utf8");
    await spawnEditor(editor, path);
    const raw = readFileSync3(path, "utf8");
    return { kind: "ok", content: stripTrailingNewline(raw) };
  } catch (err) {
    return {
      kind: "failed",
      content: initial2,
      detail: t("composer.editorExited", { code: err.message })
    };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
    }
  }
}
function spawnEditor(editor, path) {
  return new Promise((resolve2, reject) => {
    const child = spawn(`${editor} "${path}"`, {
      shell: true,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 || code === null) resolve2();
      else reject(new Error(String(code)));
    });
  });
}
function stripTrailingNewline(s) {
  if (s.endsWith("\r\n")) return s.slice(0, -2);
  if (s.endsWith("\n")) return s.slice(0, -1);
  return s;
}

// src/cli/ui/AtMentionSuggestions.tsx
import { Box, Text } from "ink";
import React from "react";
var ROW_WINDOW = 8;
function AtMentionSuggestions({
  state,
  selectedIndex
}) {
  const color = useColor();
  if (!state) return null;
  const isBrowse = state.kind === "browse";
  const entries = state.entries;
  const total = entries.length;
  const windowStart = total <= ROW_WINDOW ? 0 : Math.max(0, Math.min(selectedIndex - Math.floor(ROW_WINDOW / 2), total - ROW_WINDOW));
  const shown = entries.slice(windowStart, windowStart + ROW_WINDOW);
  const hiddenAbove = windowStart;
  const hiddenBelow = total - windowStart - shown.length;
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", paddingX: 1, marginTop: 1 }, /* @__PURE__ */ React.createElement(HeaderRow, { state, hiddenAbove }), total === 0 ? /* @__PURE__ */ React.createElement(EmptyRow, { state, color }) : null, shown.map((entry, i) => /* @__PURE__ */ React.createElement(
    EntryRow,
    {
      key: `${entry.insertPath}:${entry.isDir ? "d" : "f"}`,
      entry,
      isSelected: windowStart + i === selectedIndex
    }
  )), hiddenBelow > 0 ? /* @__PURE__ */ React.createElement(Text, { dimColor: true }, `   \u2193 ${hiddenBelow} below`) : null, /* @__PURE__ */ React.createElement(FooterRow, { isBrowse, hasFolder: shown.some((e) => e.isDir) }));
}
function HeaderRow({
  state,
  hiddenAbove
}) {
  const color = useColor();
  const total = state.entries.length;
  const lead = /* @__PURE__ */ React.createElement(Text, { color: color.primary, bold: true }, "@ ");
  if (state.kind === "browse") {
    const where = state.baseDir === "" ? "/" : `${state.baseDir}/`;
    const counter = state.loading ? t("atMentions.loading") : t(total === 1 ? "atMentions.entrySingular" : "atMentions.entryPlural", { count: total });
    return /* @__PURE__ */ React.createElement(Box, null, lead, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, `${where}  ${counter}`), hiddenAbove > 0 ? /* @__PURE__ */ React.createElement(Text, { dimColor: true }, `   \u2191 ${hiddenAbove} above`) : null);
  }
  const status2 = state.searching ? `${t("atMentions.searching")} ${state.scanned} ${t("atMentions.scanned")} \xB7 ${total} ${total === 1 ? t("atMentions.match") : t("atMentions.matches")}` : `${total} ${total === 1 ? t("atMentions.match") : t("atMentions.matches")} ${t("atMentions.forFilter", { filter: state.filter })}`;
  return /* @__PURE__ */ React.createElement(Box, null, lead, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, status2), hiddenAbove > 0 ? /* @__PURE__ */ React.createElement(Text, { dimColor: true }, `   \u2191 ${hiddenAbove} above`) : null);
}
function EmptyRow({ state, color }) {
  if (state.kind === "browse") {
    if (state.loading) return null;
    return /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Text, { color: color.warn, bold: true }, GLYPH.warn), /* @__PURE__ */ React.createElement(Text, null, " "), /* @__PURE__ */ React.createElement(Text, { color: color.warn }, t("atMentions.emptyDir")));
  }
  if (state.searching) {
    return /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, t("atMentions.scanning")));
  }
  return /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Text, { color: color.warn, bold: true }, GLYPH.warn), /* @__PURE__ */ React.createElement(Text, null, " "), /* @__PURE__ */ React.createElement(Text, { color: color.warn }, t("atMentions.noMatch", { filter: state.filter })));
}
function EntryRow({ entry, isSelected }) {
  const color = useColor();
  const cursor = isSelected ? `${GLYPH.cur} ` : "  ";
  const labelColor = entry.isDir ? color.accent : color.primary;
  const labelText = entry.isDir ? `${entry.label}/` : entry.label;
  return /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Text, { color: isSelected ? color.primary : color.info, bold: isSelected }, cursor), /* @__PURE__ */ React.createElement(Text, { color: labelColor, bold: isSelected }, labelText.padEnd(20)), entry.dirSuffix ? /* @__PURE__ */ React.createElement(Text, { dimColor: true }, `  ${entry.dirSuffix}`) : null);
}
function FooterRow({ isBrowse, hasFolder }) {
  const hintKey = isBrowse && hasFolder ? "atMentions.footerBrowse" : "atMentions.footerInsert";
  return /* @__PURE__ */ React.createElement(Box, { marginTop: 0 }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, `  ${t(hintKey)}`));
}

// src/cli/ui/BootSplash.tsx
import { Box as Box2, Text as Text2 } from "ink";
import React2, { useEffect, useState } from "react";
var REASONIX_LOGO = [
  "\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2557   \u2588\u2588\u2557\u2588\u2588\u2557\u2588\u2588\u2557  \u2588\u2588\u2557",
  "\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551\u2588\u2588\u2551\u255A\u2588\u2588\u2557\u2588\u2588\u2554\u255D",
  "\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2551 \u255A\u2588\u2588\u2588\u2554\u255D ",
  "\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u255A\u2550\u2550\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551\u255A\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2551 \u2588\u2588\u2554\u2588\u2588\u2557 ",
  "\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551 \u255A\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2554\u255D \u2588\u2588\u2557",
  "\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D  \u255A\u2550\u2550\u2550\u255D\u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D"
];
var WHALE_LINES = [
  "                _____:_____",
  "          __.-''           ''-.__",
  "       ,-'   \u2591\u2591\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2591\u2591     '-.",
  "     ,'   \u2591\u2592\u2592\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2592\u2592\u2591     '\\",
  "    /   \u2591\u2592\u2593\u2593\u2593\u2593\u25C9\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2592\u2591     '\\___",
  "   |  \u2591\u2592\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2592\u2591         '\\\\__",
  "   |  \u2591\u2592\u2593\u2593\u2593\u2593\u2593\u2593 \u203F\u203F\u203F \u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2592\u2591          \\\\__\\",
  "   |  \u2591\u2592\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2592\u2591          //__/",
  "    \\   \u2591\u2592\u2592\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2592\u2592\u2591         //",
  "     '\\.   \u2591\u2591\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2591\u2591       __,/'",
  "        '-..___                 ___..-'",
  "              '''---..........---'''"
];
var SPOUT_FRAMES = [
  ["                  ", "                  ", "                  "],
  ["                  ", "                  ", "                 ."],
  ["                  ", "                 .", "                 :"],
  ["                 .", "                 :", "                 :"],
  ["              .  '  .", "                 :", "                 :"],
  ["              '  .  '", "                 '", "                 :"],
  ["              .     .", "                  '", "                  "]
];
var WAVE_SOURCE = "~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^";
var WAVE_WIDTH = 44;
var FRAME_MS = 200;
function BootSplash() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t2 = setInterval(() => setFrame((f) => f + 1), FRAME_MS);
    return () => clearInterval(t2);
  }, []);
  const spout = SPOUT_FRAMES[frame % SPOUT_FRAMES.length];
  const waveOffset = frame % 4;
  const wave = WAVE_SOURCE.slice(waveOffset, waveOffset + WAVE_WIDTH);
  const dots = ".".repeat(frame % 4 + 1);
  return /* @__PURE__ */ React2.createElement(Box2, { flexDirection: "column", alignItems: "center", marginY: 1 }, /* @__PURE__ */ React2.createElement(Box2, { flexDirection: "column", alignItems: "flex-start", marginBottom: 1 }, REASONIX_LOGO.map((line) => /* @__PURE__ */ React2.createElement(Text2, { key: line, color: TONE.brand, bold: true }, line))), /* @__PURE__ */ React2.createElement(Box2, { flexDirection: "column", alignItems: "flex-start" }, spout.map((line, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length spout column, position is the identity
    /* @__PURE__ */ React2.createElement(Text2, { key: i, color: TONE.accent }, line.length > 0 ? line : " ")
  )), WHALE_LINES.map((line) => /* @__PURE__ */ React2.createElement(Text2, { key: line, color: TONE.brand, bold: true }, line)), /* @__PURE__ */ React2.createElement(Text2, { color: FG.faint }, wave)), /* @__PURE__ */ React2.createElement(Box2, { marginTop: 1 }, /* @__PURE__ */ React2.createElement(Text2, { color: FG.meta }, `${t("common.loading")}${dots}`)));
}

// src/cli/ui/CheckpointPicker.tsx
import { Box as Box3, Text as Text3, useStdout } from "ink";
import React3, { useMemo, useState as useState2 } from "react";

// src/cli/ui/dashboard/use-picker-broadcast.ts
import { useEffect as useEffect2 } from "react";
function useViewerBroadcast(active, snapshot, onClose, ports) {
  const { broadcast, resolverRef, snapshotRef } = ports;
  useEffect2(() => {
    if (!active) return;
    return () => {
      broadcast({ kind: "modal-down", modalKind: "viewer" });
      if (resolverRef.current) resolverRef.current = null;
      if (snapshotRef.current) snapshotRef.current = null;
    };
  }, [active, broadcast, resolverRef, snapshotRef]);
  useEffect2(() => {
    if (!active) return;
    snapshotRef.current = snapshot;
    resolverRef.current = onClose;
    broadcast({ kind: "modal-up", modal: { kind: "viewer", ...snapshot } });
  }, [active, snapshot, onClose, broadcast, resolverRef, snapshotRef]);
}
function usePickerBroadcast(active, snapshot, onResolve, ports) {
  const { broadcast, resolverRef, snapshotRef } = ports;
  useEffect2(() => {
    if (!active) return;
    return () => {
      broadcast({ kind: "modal-down", modalKind: "picker" });
      if (resolverRef.current) resolverRef.current = null;
      if (snapshotRef.current) snapshotRef.current = null;
    };
  }, [active, broadcast, resolverRef, snapshotRef]);
  useEffect2(() => {
    if (!active) return;
    snapshotRef.current = snapshot;
    resolverRef.current = onResolve;
    broadcast({ kind: "modal-up", modal: { kind: "picker", ...snapshot } });
  }, [active, snapshot, onResolve, broadcast, resolverRef, snapshotRef]);
}

// src/cli/ui/CheckpointPicker.tsx
var PAGE_MARGIN = 6;
function CheckpointPicker({
  checkpoints,
  workspace,
  onChoose,
  pickerPorts
}) {
  const [focus, setFocus] = useState2(0);
  const { stdout } = useStdout();
  const rows = stdout?.rows ?? 40;
  const visibleCount = Math.max(3, rows - PAGE_MARGIN);
  const snapshot = useMemo(
    () => ({
      pickerKind: "checkpoints",
      title: t("checkpointPicker.title", { workspace }),
      items: checkpoints.map((c) => {
        const sizeKb = (c.bytes / 1024).toFixed(1);
        const tag2 = c.source === "manual" ? "" : ` (${c.source})`;
        return {
          id: c.id,
          title: `${c.name}${tag2}`,
          subtitle: `${c.fileCount} file${c.fileCount === 1 ? "" : "s"} \xB7 ${sizeKb} KB`,
          badge: c.id.slice(0, 7),
          meta: fmtAgo(c.createdAt)
        };
      }),
      actions: ["pick", "delete", "cancel"],
      hint: t("checkpointPicker.footer")
    }),
    [checkpoints, workspace]
  );
  usePickerBroadcast(
    !!pickerPorts,
    {
      ...snapshot,
      actions: [...snapshot.actions]
    },
    (res) => {
      if (res.action === "pick") return onChoose({ kind: "restore", id: res.id });
      if (res.action === "delete") return onChoose({ kind: "delete", id: res.id });
      if (res.action === "cancel") return onChoose({ kind: "quit" });
    },
    pickerPorts ?? {
      broadcast: () => void 0,
      resolverRef: { current: null },
      snapshotRef: { current: null }
    }
  );
  useKeystroke((ev) => {
    if (ev.escape) return onChoose({ kind: "quit" });
    if (ev.upArrow) return setFocus((f) => Math.max(0, f - 1));
    if (ev.downArrow) return setFocus((f) => Math.min(checkpoints.length - 1, f + 1));
    if (checkpoints.length === 0) {
      if (ev.return) return onChoose({ kind: "quit" });
      return;
    }
    const target = checkpoints[focus];
    if (!target) return;
    if (ev.return) return onChoose({ kind: "restore", id: target.id });
    if (ev.input === "q") return onChoose({ kind: "quit" });
    if (ev.input === "d") return onChoose({ kind: "delete", id: target.id });
  });
  const start = Math.max(
    0,
    Math.min(focus - Math.floor(visibleCount / 2), checkpoints.length - visibleCount)
  );
  const end = Math.min(checkpoints.length, start + visibleCount);
  const shown = checkpoints.slice(start, end);
  const hiddenBelow = checkpoints.length - end;
  return /* @__PURE__ */ React3.createElement(Box3, { flexDirection: "column", marginY: 1 }, /* @__PURE__ */ React3.createElement(Box3, null, /* @__PURE__ */ React3.createElement(Text3, { bold: true, color: TONE.brand }, t("checkpointPicker.header")), /* @__PURE__ */ React3.createElement(Text3, { color: FG.meta }, `  \xB7  ${workspace}`)), /* @__PURE__ */ React3.createElement(Box3, { height: 1 }), checkpoints.length === 0 ? /* @__PURE__ */ React3.createElement(Box3, null, /* @__PURE__ */ React3.createElement(Text3, { color: FG.faint }, t("checkpointPicker.empty"))) : shown.map((c, i) => /* @__PURE__ */ React3.createElement(CheckpointRow, { key: c.id, info: c, focused: start + i === focus })), hiddenBelow > 0 ? /* @__PURE__ */ React3.createElement(Box3, null, /* @__PURE__ */ React3.createElement(Text3, { color: FG.faint }, t("checkpointPicker.more", { hidden: hiddenBelow }))) : null, /* @__PURE__ */ React3.createElement(Box3, { marginTop: 1 }, /* @__PURE__ */ React3.createElement(Text3, { color: FG.faint }, checkpoints.length === 0 ? t("checkpointPicker.footerEmpty") : t("checkpointPicker.footer"))));
}
function CheckpointRow({
  info,
  focused
}) {
  const tag2 = info.source === "manual" ? "" : ` (${info.source})`;
  const sizeKb = (info.bytes / 1024).toFixed(1);
  const time = fmtAgo(info.createdAt);
  return /* @__PURE__ */ React3.createElement(Box3, null, /* @__PURE__ */ React3.createElement(Text3, { color: focused ? TONE.brand : FG.faint }, focused ? "  \u25B8 " : "    "), /* @__PURE__ */ React3.createElement(Text3, { color: FG.meta }, info.id.slice(0, 7).padEnd(8)), /* @__PURE__ */ React3.createElement(Text3, { bold: focused, color: focused ? FG.strong : FG.sub }, info.name), /* @__PURE__ */ React3.createElement(Text3, { color: FG.faint }, tag2), /* @__PURE__ */ React3.createElement(Box3, { flexGrow: 1 }), /* @__PURE__ */ React3.createElement(Text3, { color: FG.faint }, `${time.padStart(8)}  \xB7  `), /* @__PURE__ */ React3.createElement(
    Text3,
    {
      color: FG.faint
    },
    `${info.fileCount} file${info.fileCount === 1 ? "" : "s"}, ${sizeKb} KB`
  ));
}

// src/cli/ui/ChoiceConfirm.tsx
import React6 from "react";

// src/cli/ui/cards/ApprovalCard.tsx
import { Box as Box4, Text as Text4, useStdout as useStdout2 } from "ink";
import React4 from "react";
var SEPARATOR_PAD = 6;
var MIN_SEPARATOR = 20;
var TONE_PALETTE = {
  warn: { color: CARD.warn.color, glyph: "?" },
  error: { color: CARD.error.color, glyph: "\u2717" },
  approval: { color: CARD.approval.color, glyph: "?" },
  diff: { color: CARD.diff.color, glyph: "\xB1" },
  memory: { color: CARD.memory.color, glyph: "\u2311" },
  user: { color: CARD.user.color, glyph: "\u25C7" },
  ok: { color: CARD.diff.color, glyph: "\u2713" },
  accent: { color: CARD.plan.color, glyph: "\u229E" },
  info: { color: CARD.tool.color, glyph: "?" }
};
function ApprovalCard({
  tone,
  glyph,
  title,
  metaRight,
  metaRightColor,
  children,
  footerHint
}) {
  const effectiveFooter = footerHint ?? t("cardLabels.defaultFooter");
  const palette = TONE_PALETTE[tone];
  const headerGlyph = glyph ?? palette.glyph;
  const { stdout } = useStdout2();
  const cols = stdout?.columns ?? 80;
  const ruleWidth = Math.max(MIN_SEPARATOR, cols - SEPARATOR_PAD);
  return /* @__PURE__ */ React4.createElement(Box4, { flexDirection: "column", marginY: 1, flexShrink: 0 }, /* @__PURE__ */ React4.createElement(Box4, { flexDirection: "row" }, /* @__PURE__ */ React4.createElement(Text4, { color: palette.color, backgroundColor: SURFACE.bgElev }, " \u258E "), /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: palette.color, backgroundColor: SURFACE.bgElev }, `${headerGlyph}  `), /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: FG.strong, backgroundColor: SURFACE.bgElev }, ` ${title} `), metaRight !== void 0 && /* @__PURE__ */ React4.createElement(Text4, { color: metaRightColor ?? FG.faint, backgroundColor: SURFACE.bgElev }, `  ${metaRight} `)), /* @__PURE__ */ React4.createElement(Box4, { flexDirection: "column", paddingX: 2, marginTop: 1, flexShrink: 0 }, children), /* @__PURE__ */ React4.createElement(Box4, { paddingX: 2, marginTop: 1, flexShrink: 0 }, /* @__PURE__ */ React4.createElement(Text4, { color: FG.faint }, "\u2500".repeat(ruleWidth))), /* @__PURE__ */ React4.createElement(Box4, { paddingX: 2, flexShrink: 0 }, /* @__PURE__ */ React4.createElement(Text4, { color: FG.faint }, effectiveFooter)));
}

// src/cli/ui/layout/viewport-budget.tsx
import { useStdout as useStdout3 } from "ink";
import React5, { createContext, useContext, useEffect as useEffect3, useMemo as useMemo2, useReducer } from "react";
var ZONE_PRIORITY = {
  modal: 100,
  status: 60,
  input: 50,
  stream: 10,
  safety: 5
};
function allocateRows(claims, totalRows) {
  const sorted = [...claims].sort((a, b) => b.priority - a.priority);
  const out = /* @__PURE__ */ new Map();
  let remaining = Math.max(0, totalRows);
  for (const c of sorted) {
    const want = Math.min(c.max, Math.max(c.min, remaining));
    out.set(c.zone, want);
    remaining = Math.max(0, remaining - want);
  }
  return out;
}
function reducer(state, action) {
  switch (action.type) {
    case "claim": {
      const next = new Map(state.claims);
      next.set(action.zone, action.spec);
      return { ...state, claims: next };
    }
    case "release": {
      if (!state.claims.has(action.zone)) return state;
      const next = new Map(state.claims);
      next.delete(action.zone);
      return { ...state, claims: next };
    }
    case "resize":
      if (action.rows === state.totalRows) return state;
      return { ...state, totalRows: action.rows };
  }
}
var BudgetContext = createContext(null);
function ViewportBudgetProvider({
  children,
  initialRows
}) {
  const { stdout } = useStdout3();
  const [state, dispatch] = useReducer(reducer, void 0, () => ({
    claims: /* @__PURE__ */ new Map(),
    totalRows: initialRows ?? stdout?.rows ?? 40
  }));
  useEffect3(() => {
    if (initialRows !== void 0) return void 0;
    if (!stdout) return void 0;
    const onResize = () => dispatch({ type: "resize", rows: stdout.rows ?? 40 });
    onResize();
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout, initialRows]);
  const allocations = useMemo2(() => {
    const list2 = [];
    for (const [zone, spec] of state.claims) {
      list2.push({ zone, priority: ZONE_PRIORITY[zone], ...spec });
    }
    return allocateRows(list2, state.totalRows);
  }, [state.claims, state.totalRows]);
  const value = useMemo2(
    () => ({
      totalRows: state.totalRows,
      allocations,
      claims: state.claims,
      dispatch
    }),
    [state.totalRows, allocations, state.claims]
  );
  return /* @__PURE__ */ React5.createElement(BudgetContext.Provider, { value }, children);
}
function useReserveRows(zone, spec) {
  const ctx = useContext(BudgetContext);
  const dispatch = ctx?.dispatch;
  useEffect3(() => {
    if (!dispatch) return void 0;
    dispatch({ type: "claim", zone, spec: { min: spec.min, max: spec.max } });
    return () => {
      dispatch({ type: "release", zone });
    };
  }, [dispatch, zone, spec.min, spec.max]);
  if (!ctx) return Number.isFinite(spec.max) ? spec.max : 40;
  const allocated = ctx.allocations.get(zone);
  if (allocated !== void 0) return allocated;
  return Number.isFinite(spec.max) ? spec.max : ctx.totalRows;
}
function useTotalRows() {
  const ctx = useContext(BudgetContext);
  const { stdout } = useStdout3();
  return ctx?.totalRows ?? stdout?.rows ?? 40;
}

// src/cli/ui/ChoiceConfirm.tsx
var CUSTOM_VALUE = "__custom__";
var CANCEL_VALUE = "__cancel__";
function ChoiceConfirmInner({ question, options: options2, allowCustom, onChoose }) {
  const optionRows = options2.length + (allowCustom ? 1 : 0) + 1;
  useReserveRows("modal", { min: 6, max: Math.max(10, optionRows + 6) });
  const items = options2.map((opt) => ({
    value: opt.id,
    label: `${opt.id} \xB7 ${opt.title}`,
    hint: opt.summary
  }));
  if (allowCustom) {
    items.push({
      value: CUSTOM_VALUE,
      label: t("choiceConfirm.customLabel"),
      hint: t("choiceConfirm.customDesc")
    });
  }
  items.push({
    value: CANCEL_VALUE,
    label: t("choiceConfirm.cancelLabel"),
    hint: t("choiceConfirm.cancelDesc")
  });
  return /* @__PURE__ */ React6.createElement(ApprovalCard, { tone: "info", title: question, metaRight: t("shellConfirm.awaiting") }, /* @__PURE__ */ React6.createElement(
    SingleSelect,
    {
      initialValue: options2[0]?.id,
      items,
      onSubmit: (v) => {
        if (v === CUSTOM_VALUE) onChoose({ kind: "custom" });
        else if (v === CANCEL_VALUE) onChoose({ kind: "cancel" });
        else onChoose({ kind: "pick", optionId: v });
      },
      onCancel: () => onChoose({ kind: "cancel" })
    }
  ));
}
var ChoiceConfirm = React6.memo(ChoiceConfirmInner);

// src/cli/ui/EditConfirm.tsx
import { Box as Box7, Text as Text7 } from "ink";
import React9, { useMemo as useMemo3, useState as useState4 } from "react";

// src/code/diff-preview.ts
function formatEditBlockDiff(block2, opts = {}) {
  const contextLines = Math.max(0, opts.contextLines ?? 2);
  const maxLines = Math.max(4, opts.maxLines ?? 20);
  const indent = opts.indent ?? "        ";
  const search = block2.search === "" ? [] : block2.search.split("\n");
  const replace = block2.replace.split("\n");
  if (search.length === 0) {
    return renderAllPlus(replace, indent, maxLines);
  }
  let leading = 0;
  while (leading < search.length && leading < replace.length && search[leading] === replace[leading]) {
    leading++;
  }
  let trailing = 0;
  while (trailing < search.length - leading && trailing < replace.length - leading && search[search.length - 1 - trailing] === replace[replace.length - 1 - trailing]) {
    trailing++;
  }
  const searchMiddle = search.slice(leading, search.length - trailing);
  const replaceMiddle = replace.slice(leading, replace.length - trailing);
  const leadShown = search.slice(Math.max(0, leading - contextLines), leading);
  const leadHidden = leading - leadShown.length;
  const trailShown = search.slice(
    search.length - trailing,
    search.length - trailing + contextLines
  );
  const trailHidden = trailing - trailShown.length;
  const out = [];
  if (leadHidden > 0) {
    out.push(`${indent}  \u2026 ${leadHidden} unchanged line${leadHidden === 1 ? "" : "s"} above`);
  }
  for (const l of leadShown) out.push(`${indent}  ${l}`);
  for (const l of searchMiddle) out.push(`${indent}- ${l}`);
  for (const l of replaceMiddle) out.push(`${indent}+ ${l}`);
  for (const l of trailShown) out.push(`${indent}  ${l}`);
  if (trailHidden > 0) {
    out.push(`${indent}  \u2026 ${trailHidden} unchanged line${trailHidden === 1 ? "" : "s"} below`);
  }
  return capLines(out, maxLines, indent);
}
function formatAllBlockDiffs(blocks, opts = {}) {
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const removed = b.search === "" ? 0 : countLines(b.search);
    const added = countLines(b.replace);
    const tag2 = b.search === "" ? "NEW " : "    ";
    if (i > 0) out.push("");
    const label = opts.numbered ? `[${i + 1}] ` : "";
    out.push(`  ${label}${tag2}${b.path}  (-${removed} +${added} lines)`);
    out.push(...formatEditBlockDiff(b, opts));
  }
  return out;
}
function countLines(s) {
  if (s.length === 0) return 0;
  return (s.match(/\n/g)?.length ?? 0) + 1;
}
function formatEditBlockSplit(block2, opts = {}) {
  const contextLines = Math.max(0, opts.contextLines ?? 2);
  const maxLines = Math.max(4, opts.maxLines ?? 40);
  const startLine = opts.startLine ?? 1;
  const search = block2.search === "" ? [] : block2.search.split("\n");
  const replace = block2.replace.split("\n");
  if (search.length === 0) {
    const rows2 = [];
    let n = startLine;
    for (const l of replace) {
      rows2.push({
        left: { num: null, text: "", kind: "pad" },
        right: { num: n++, text: l, kind: "add" }
      });
    }
    return capRows(rows2, maxLines);
  }
  let leading = 0;
  while (leading < search.length && leading < replace.length && search[leading] === replace[leading]) {
    leading++;
  }
  let trailing = 0;
  while (trailing < search.length - leading && trailing < replace.length - leading && search[search.length - 1 - trailing] === replace[replace.length - 1 - trailing]) {
    trailing++;
  }
  const searchMiddle = search.slice(leading, search.length - trailing);
  const replaceMiddle = replace.slice(leading, replace.length - trailing);
  const leadStartIdx = Math.max(0, leading - contextLines);
  const leadShown = search.slice(leadStartIdx, leading);
  const trailShown = search.slice(
    search.length - trailing,
    search.length - trailing + contextLines
  );
  const rows = [];
  let leftNum = startLine + leadStartIdx;
  let rightNum = startLine + leadStartIdx;
  for (const l of leadShown) {
    rows.push({
      left: { num: leftNum++, text: l, kind: "ctx" },
      right: { num: rightNum++, text: l, kind: "ctx" }
    });
  }
  const pairedCount = Math.min(searchMiddle.length, replaceMiddle.length);
  for (let i = 0; i < pairedCount; i++) {
    rows.push({
      left: { num: leftNum++, text: searchMiddle[i], kind: "del" },
      right: { num: rightNum++, text: replaceMiddle[i], kind: "add" }
    });
  }
  for (let i = pairedCount; i < searchMiddle.length; i++) {
    rows.push({
      left: { num: leftNum++, text: searchMiddle[i], kind: "del" },
      right: { num: null, text: "", kind: "pad" }
    });
  }
  for (let i = pairedCount; i < replaceMiddle.length; i++) {
    rows.push({
      left: { num: null, text: "", kind: "pad" },
      right: { num: rightNum++, text: replaceMiddle[i], kind: "add" }
    });
  }
  for (const l of trailShown) {
    rows.push({
      left: { num: leftNum++, text: l, kind: "ctx" },
      right: { num: rightNum++, text: l, kind: "ctx" }
    });
  }
  return capRows(rows, maxLines);
}
function capRows(rows, maxRows) {
  if (rows.length <= maxRows) return rows;
  const head = rows.slice(0, maxRows - 1);
  const hidden = rows.length - head.length;
  head.push({
    left: { num: null, text: `\u2026 (${hidden} more lines)`, kind: "pad" },
    right: { num: null, text: "", kind: "pad" }
  });
  return head;
}
function renderAllPlus(lines, indent, maxLines) {
  const out = lines.map((l) => `${indent}+ ${l}`);
  return capLines(out, maxLines, indent);
}
function capLines(lines, maxLines, indent) {
  if (lines.length <= maxLines) return lines;
  const head = lines.slice(0, maxLines - 1);
  const hidden = lines.length - head.length;
  head.push(`${indent}\u2026 (${hidden} more diff lines \u2014 full content applies on /apply)`);
  return head;
}

// src/cli/ui/DenyContextInput.tsx
import { Box as Box5, Text as Text5 } from "ink";
import React7, { useState as useState3 } from "react";
var DEFAULT_DESCRIPTION = t("denyContextInput.description");
function DenyContextInput({
  description = DEFAULT_DESCRIPTION,
  onSubmit,
  onCancel
}) {
  const [value, setValue] = useState3("");
  useKeystroke((ev) => {
    if (ev.paste) {
      setValue((v) => v + ev.input);
      return;
    }
    if (ev.escape) {
      onCancel();
      return;
    }
    if (ev.return) {
      onSubmit(value);
      return;
    }
    if (ev.backspace) {
      setValue((v) => v.slice(0, -1));
      return;
    }
    if (ev.input && !ev.tab && !ev.upArrow && !ev.downArrow && !ev.leftArrow && !ev.rightArrow) {
      setValue((v) => v + ev.input);
    }
  });
  return /* @__PURE__ */ React7.createElement(Box5, { flexDirection: "column" }, /* @__PURE__ */ React7.createElement(Box5, { flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React7.createElement(Text5, { color: FG.sub }, description)), /* @__PURE__ */ React7.createElement(Box5, null, /* @__PURE__ */ React7.createElement(Text5, { bold: true, color: TONE.brand }, "\u203A "), /* @__PURE__ */ React7.createElement(Text5, { color: FG.body }, value), /* @__PURE__ */ React7.createElement(Text5, { backgroundColor: TONE.brand, color: "#000" }, " ")));
}

// src/cli/ui/SplitDiff.tsx
import { Box as Box6, Text as Text6, useStdout as useStdout4 } from "ink";
import React8 from "react";
function SplitDiff({ rows, totalCols }) {
  const { stdout } = useStdout4();
  const cols = totalCols ?? stdout?.columns ?? 80;
  const innerCols = Math.max(40, cols - 6);
  const halfCols = Math.floor((innerCols - 3) / 2);
  return /* @__PURE__ */ React8.createElement(Box6, { flexDirection: "column" }, rows.map((row2, i) => /* @__PURE__ */ React8.createElement(Box6, { key: `r-${i}-${row2.left.num ?? "p"}-${row2.right.num ?? "p"}` }, /* @__PURE__ */ React8.createElement(Cell, { side: row2.left, width: halfCols, which: "left" }), /* @__PURE__ */ React8.createElement(Text6, { color: COLOR.info, dimColor: true }, " \u2502 "), /* @__PURE__ */ React8.createElement(Cell, { side: row2.right, width: halfCols, which: "right" }))));
}
function Cell({
  side,
  width,
  which
}) {
  const numPad = 4;
  const sgnPad = 1;
  const inner = Math.max(
    8,
    width - numPad - sgnPad - 2
    /* spaces */
  );
  const numStr = side.num !== null ? String(side.num).padStart(numPad) : " ".repeat(numPad);
  const sign = side.kind === "del" ? "-" : side.kind === "add" ? "+" : side.kind === "pad" ? " " : " ";
  const raw = side.text;
  const truncated = raw.length > inner ? `${raw.slice(0, inner - 1)}\u2026` : raw;
  const padded = truncated.padEnd(inner);
  if (side.kind === "del") {
    return /* @__PURE__ */ React8.createElement(Text6, { color: "#fbc8c8", backgroundColor: "#2a1212" }, `${numStr} ${sign} ${padded}`);
  }
  if (side.kind === "add") {
    return /* @__PURE__ */ React8.createElement(Text6, { color: "#bef0c8", backgroundColor: "#0c2718" }, `${numStr} ${sign} ${padded}`);
  }
  if (side.kind === "pad") {
    return /* @__PURE__ */ React8.createElement(Text6, { color: COLOR.info, dimColor: true, italic: !!raw }, `${numStr} ${sign} ${padded}`);
  }
  return /* @__PURE__ */ React8.createElement(Text6, { dimColor: true }, `${numStr} ${sign} ${padded}`);
}

// src/cli/ui/EditConfirm.tsx
var MODAL_OVERHEAD_ROWS = 18;
var MIN_DIFF_ROWS = 8;
function EditConfirm({ block: block2, onChoose }) {
  const rows = useTotalRows();
  const allocated = useReserveRows("modal", {
    min: MODAL_OVERHEAD_ROWS + MIN_DIFF_ROWS,
    max: Math.max(MODAL_OVERHEAD_ROWS + MIN_DIFF_ROWS, rows - 4)
  });
  const budget2 = Math.max(MIN_DIFF_ROWS, allocated - MODAL_OVERHEAD_ROWS);
  const allRows = useMemo3(
    () => formatEditBlockSplit(block2, { contextLines: 2, maxLines: 1e5 }),
    [block2]
  );
  const [scroll, setScroll] = useState4(0);
  const maxScroll = Math.max(0, allRows.length - budget2);
  const effectiveScroll = Math.min(scroll, maxScroll);
  const [phase, setPhase] = useState4("review");
  useKeystroke((ev) => {
    if (ev.paste) return;
    if (phase === "context") return;
    const input = ev.input;
    const key = ev;
    if (key.return || input === "y") {
      onChoose("apply");
      return;
    }
    if (input === "n") {
      setPhase("context");
      return;
    }
    if (input === "a") {
      onChoose("apply-rest-of-turn");
      return;
    }
    if (input === "A") {
      onChoose("flip-to-auto");
      return;
    }
    if (key.downArrow || input === "j") {
      setScroll((s) => Math.min(maxScroll, s + 1));
      return;
    }
    if (key.upArrow || input === "k") {
      setScroll((s) => Math.max(0, s - 1));
      return;
    }
    if (key.pageDown || input === " " || input === "f") {
      setScroll((s) => Math.min(maxScroll, s + Math.max(1, budget2 - 2)));
      return;
    }
    if (key.pageUp || input === "b") {
      setScroll((s) => Math.max(0, s - Math.max(1, budget2 - 2)));
      return;
    }
    if (input === "g") {
      setScroll(0);
      return;
    }
    if (input === "G") {
      setScroll(maxScroll);
      return;
    }
  });
  const isNew = block2.search === "";
  const removed = isNew ? 0 : (block2.search.match(/\n/g)?.length ?? 0) + 1;
  const added = block2.replace === "" ? 0 : (block2.replace.match(/\n/g)?.length ?? 0) + 1;
  const tag2 = isNew ? t("editConfirm.newTag") : t("editConfirm.editTag");
  const tone = isNew ? "ok" : "warn";
  const glyph = isNew ? "\u271A" : "\u270E";
  const visibleRows = allRows.slice(effectiveScroll, effectiveScroll + budget2);
  const hiddenAbove = effectiveScroll;
  const hiddenBelow = Math.max(0, allRows.length - effectiveScroll - budget2);
  const totalLines = allRows.length;
  const showScrollHud = hiddenAbove + hiddenBelow > 0;
  const metaParts = [t("editConfirm.linesCount", { removed, added })];
  if (showScrollHud) {
    metaParts.push(
      t("editConfirm.viewingRange", {
        start: effectiveScroll + 1,
        end: effectiveScroll + visibleRows.length,
        total: totalLines
      })
    );
  }
  if (phase === "context") {
    return /* @__PURE__ */ React9.createElement(
      ApprovalCard,
      {
        tone: "error",
        glyph: "\u2717",
        title: t("shellConfirm.denyTitle"),
        metaRight: t("shellConfirm.optional"),
        footerHint: t("editConfirm.denyFooter")
      },
      /* @__PURE__ */ React9.createElement(
        DenyContextInput,
        {
          onSubmit: (context2) => onChoose("reject", context2),
          onCancel: () => setPhase("review")
        }
      )
    );
  }
  return /* @__PURE__ */ React9.createElement(
    ApprovalCard,
    {
      tone,
      glyph,
      title: `${tag2}  ${block2.path}`,
      metaRight: metaParts.join("  \xB7  "),
      footerHint: t("editConfirm.footer")
    },
    hiddenAbove > 0 ? /* @__PURE__ */ React9.createElement(Text7, { dimColor: true }, t(hiddenAbove === 1 ? "editConfirm.linesAbove" : "editConfirm.linesAbovePlural", {
      count: hiddenAbove
    })) : null,
    /* @__PURE__ */ React9.createElement(SplitDiff, { rows: visibleRows }),
    /* @__PURE__ */ React9.createElement(Box7, null, /* @__PURE__ */ React9.createElement(Text7, { color: "#fbc8c8", backgroundColor: "#2a1212" }, t("editConfirm.oldLabel")), /* @__PURE__ */ React9.createElement(Text7, null, "  "), /* @__PURE__ */ React9.createElement(Text7, { color: "#bef0c8", backgroundColor: "#0c2718" }, t("editConfirm.newLabel")), /* @__PURE__ */ React9.createElement(Text7, { dimColor: true }, t("editConfirm.sideBySide"))),
    hiddenBelow > 0 ? /* @__PURE__ */ React9.createElement(Text7, { dimColor: true }, t(hiddenBelow === 1 ? "editConfirm.linesBelow" : "editConfirm.linesBelowPlural", {
      count: hiddenBelow
    })) : null
  );
}

// src/cli/ui/McpHub.tsx
import { Box as Box10, Text as Text10 } from "ink";
import React12, { useState as useState7 } from "react";

// src/cli/ui/McpBrowser.tsx
import { Box as Box8, Text as Text8 } from "ink";
import React10, { useState as useState5 } from "react";

// src/cli/ui/mcp-disable.ts
function toggleMcpDisabled(action, name) {
  const trimmed = name.trim();
  if (!trimmed) {
    return `usage: /mcp ${action} <name>  \xB7  pick a name shown in /mcp (anonymous servers can't be named-toggled).`;
  }
  const cfg = readConfig();
  const current = new Set(cfg.mcpDisabled ?? []);
  if (action === "disable") {
    if (current.has(trimmed)) {
      return `\u25B8 ${trimmed} is already disabled \u2014 restart to apply, or /mcp enable ${trimmed}.`;
    }
    current.add(trimmed);
    writeConfig({ ...cfg, mcpDisabled: [...current].sort() });
    return `\u25B8 ${trimmed} disabled \u2014 takes effect on next launch. /mcp enable ${trimmed} to revert.`;
  }
  if (!current.has(trimmed)) {
    return `\u25B8 ${trimmed} is not disabled.`;
  }
  current.delete(trimmed);
  writeConfig({ ...cfg, mcpDisabled: current.size > 0 ? [...current].sort() : void 0 });
  return `\u25B8 ${trimmed} re-enabled \u2014 takes effect on next launch.`;
}

// src/cli/ui/mcp-health.ts
function healthBadge(elapsedMs) {
  if (elapsedMs === 0) return { glyph: "\u2717", label: t("mcpHealth.noData"), color: COLOR.err };
  if (elapsedMs < 500)
    return { glyph: "\u25CF", label: t("mcpHealth.healthy", { ms: elapsedMs }), color: COLOR.ok };
  if (elapsedMs < 3e3)
    return { glyph: "\u25CC", label: t("mcpHealth.slow", { ms: elapsedMs }), color: COLOR.warn };
  return { glyph: "\u2717", label: t("mcpHealth.verySlow", { ms: elapsedMs }), color: COLOR.err };
}
function slashHealthBadge(elapsedMs) {
  if (elapsedMs < 500) return t("mcpHealth.healthy", { ms: elapsedMs });
  if (elapsedMs < 3e3) return t("mcpHealth.slow", { ms: elapsedMs });
  return t("mcpHealth.verySlow", { ms: elapsedMs });
}

// src/mcp/drift.ts
function classifyToolListDrift(before, after) {
  const beforeNames = before.map(nameOf);
  const afterNames = after.map(nameOf);
  const beforeSet = new Set(beforeNames);
  const afterSet = new Set(afterNames);
  const added = afterNames.filter((n) => !beforeSet.has(n));
  const removed = beforeNames.filter((n) => !afterSet.has(n));
  const edited = [];
  const sharedLen = Math.min(before.length, after.length);
  for (let i = 0; i < sharedLen; i++) {
    if (beforeNames[i] === afterNames[i] && hash(before[i]) !== hash(after[i])) {
      edited.push(beforeNames[i]);
    }
  }
  if (before.length === after.length && edited.length === 0 && beforeNames.every((n, i) => n === afterNames[i])) {
    return { kind: "identity", added: [], removed: [], edited: [] };
  }
  if (removed.length > 0) {
    return { kind: "remove", added, removed, edited };
  }
  if (after.length > before.length && beforeNames.every((n, i) => n === afterNames[i] && hash(before[i]) === hash(after[i]))) {
    return { kind: "append", added, removed: [], edited: [] };
  }
  const sameNameSet = beforeSet.size === afterSet.size && [...beforeSet].every((n) => afterSet.has(n));
  if (sameNameSet) {
    const positionsMatch = beforeNames.every((n, i) => n === afterNames[i]);
    if (positionsMatch) {
      return { kind: "edit", added: [], removed: [], edited };
    }
    return { kind: "reorder", added: [], removed: [], edited };
  }
  return { kind: "reorder", added, removed: [], edited };
}
function nameOf(spec) {
  return spec.function?.name ?? "";
}
function hash(spec) {
  return JSON.stringify(spec);
}

// src/mcp/reconnect.ts
async function reconnectMcpServer(args) {
  const t0 = Date.now();
  const accept = args.accept ?? ["identity"];
  let parsed;
  try {
    parsed = parseMcpSpec(args.spec);
  } catch (err) {
    return {
      ok: false,
      reason: "spec_parse",
      message: err.message,
      ms: Date.now() - t0
    };
  }
  const transport = buildTransportFromSpec(parsed, { env: args.env });
  const next = new McpClient({ transport });
  try {
    await next.initialize();
    const listed = await next.listTools();
    const drift = classifyToolListDrift(toolsToSpecs(args.beforeTools), toolsToSpecs(listed.tools));
    const acceptedKind = drift.kind === "identity" ? "identity" : drift.kind === "append" && accept.includes("append") ? "append" : null;
    if (acceptedKind === null) {
      await next.close().catch(() => {
      });
      const refused = drift.kind;
      return {
        ok: false,
        reason: driftReason(refused),
        message: driftMessage(drift),
        ms: Date.now() - t0
      };
    }
    const addedTools = acceptedKind === "append" ? listed.tools.filter((t2) => drift.added.includes(t2.name)) : [];
    const old = args.host.client;
    args.host.client = next;
    await old.close().catch(() => {
    });
    return {
      ok: true,
      kind: acceptedKind,
      afterTools: listed.tools,
      addedTools,
      ms: Date.now() - t0
    };
  } catch (err) {
    await next.close().catch(() => {
    });
    return {
      ok: false,
      reason: "handshake",
      message: err.message,
      ms: Date.now() - t0
    };
  }
}
function driftReason(kind) {
  if (kind === "append") return "drift_added";
  if (kind === "edit") return "drift_edited";
  if (kind === "reorder") return "drift_reordered";
  return "drift_removed";
}
function driftMessage(drift) {
  if (drift.kind === "append") {
    return `tool list grew (${drift.added.length} added: ${drift.added.join(", ")}). Restart Reasonix to bridge the new tool(s).`;
  }
  if (drift.kind === "edit") {
    return `tool description/schema changed for ${drift.edited.join(", ")}. Restart Reasonix to apply.`;
  }
  if (drift.kind === "remove") {
    return `tool(s) removed: ${drift.removed.join(", ")}. Restart Reasonix to drop them from the registry.`;
  }
  return "tool list reordered or restructured \u2014 cache prefix would be invalidated. Restart Reasonix.";
}
function toolsToSpecs(tools) {
  return tools.map((t2) => ({
    type: "function",
    function: {
      name: t2.name,
      description: t2.description ?? "",
      parameters: t2.inputSchema
    }
  }));
}

// src/cli/ui/mcp-reconnect-kickoff.ts
function kickOffMcpReconnect(target, postInfo, applyAppend) {
  const beforeTools = target.report.tools.supported ? target.report.tools.items : [];
  const accept = applyAppend ? ["identity", "append"] : ["identity"];
  let liveTarget = target;
  void (async () => {
    try {
      const env = (() => {
        try {
          return mcpEnvFor(parseMcpSpec(liveTarget.spec).name, readConfig());
        } catch {
          return void 0;
        }
      })();
      const result = await reconnectMcpServer({
        host: liveTarget.host,
        spec: liveTarget.spec,
        beforeTools,
        accept,
        env
      });
      if (result.ok) {
        if (result.kind === "append" && applyAppend) {
          liveTarget = applyAppend(liveTarget, result.addedTools);
        }
        postInfo(
          formatMcpLifecycleEvent({
            state: "connected",
            name: target.label,
            tools: result.afterTools.length,
            ms: result.ms
          })
        );
        if (result.kind === "append") {
          const names = result.addedTools.map((t2) => t2.name).join(", ");
          postInfo(`\u25B8 ${target.label}: added ${result.addedTools.length} tool(s) \u2014 ${names}`);
        }
      } else {
        postInfo(
          formatMcpLifecycleEvent({
            state: "failed",
            name: target.label,
            reason: `${result.reason} \xB7 ${result.message}`
          })
        );
      }
    } catch (err) {
      postInfo(
        formatMcpLifecycleEvent({
          state: "failed",
          name: target.label,
          reason: err.message
        })
      );
    }
  })();
  return formatMcpLifecycleEvent({ state: "reconnect", name: target.label });
}

// src/cli/ui/McpBrowser.tsx
function McpBrowser({
  servers,
  configPath,
  onClose,
  postInfo,
  applyAppend
}) {
  const [index, setIndex] = useState5(0);
  const max = Math.max(0, servers.length - 1);
  useKeystroke((ev) => {
    if (ev.paste) return;
    if (ev.upArrow) setIndex((i) => Math.max(0, i - 1));
    else if (ev.downArrow) setIndex((i) => Math.min(max, i + 1));
    else if (ev.escape) onClose();
    else if (ev.input === "r") {
      const target = servers[index];
      if (!target) return;
      postInfo(kickOffMcpReconnect(target, postInfo, applyAppend));
      onClose();
    } else if (ev.input === "d") {
      const target = servers[index];
      if (!target) return;
      postInfo(toggleMcpDisabled("disable", target.label));
      onClose();
    }
  });
  return /* @__PURE__ */ React10.createElement(Box8, { flexDirection: "column", paddingX: 1 }, /* @__PURE__ */ React10.createElement(Box8, null, /* @__PURE__ */ React10.createElement(Text8, { bold: true, color: COLOR.brand }, t("mcpBrowser.title")), /* @__PURE__ */ React10.createElement(
    Text8,
    {
      dimColor: true
    },
    `  \xB7  ${configPath}  \xB7  ${t("mcpBrowser.serverCount", { count: servers.length, s: servers.length === 1 ? "" : "s" })}`
  )), /* @__PURE__ */ React10.createElement(Box8, { marginTop: 1, flexDirection: "column" }, servers.length === 0 ? /* @__PURE__ */ React10.createElement(Text8, { dimColor: true }, t("mcpBrowser.empty")) : servers.map((s, i) => /* @__PURE__ */ React10.createElement(ServerRow, { key: s.label + s.spec, server: s, active: i === index }))), /* @__PURE__ */ React10.createElement(Box8, { marginTop: 1 }, /* @__PURE__ */ React10.createElement(Text8, { dimColor: true }, t("mcpBrowser.footer"))));
}
function ServerRow({ server, active }) {
  const { label, toolCount, report } = server;
  const resourceCount = report.resources.supported ? report.resources.items.length : 0;
  const promptCount = report.prompts.supported ? report.prompts.items.length : 0;
  const elapsed = report.elapsedMs;
  const health = healthBadge(elapsed);
  const counts = `${toolCount} tools \xB7 ${resourceCount} resources \xB7 ${promptCount} prompts`;
  return /* @__PURE__ */ React10.createElement(Box8, { flexDirection: "column", marginBottom: active ? 1 : 0 }, /* @__PURE__ */ React10.createElement(Box8, null, /* @__PURE__ */ React10.createElement(Text8, { color: active ? COLOR.brand : void 0 }, active ? "\u25B8  " : "   "), /* @__PURE__ */ React10.createElement(Text8, { bold: active, color: active ? "#e6edf3" : void 0 }, label.padEnd(14)), /* @__PURE__ */ React10.createElement(Text8, { color: health.color }, `${health.glyph} ${health.label}`), /* @__PURE__ */ React10.createElement(Text8, { dimColor: true }, `      ${counts}`)), active ? /* @__PURE__ */ React10.createElement(Box8, null, /* @__PURE__ */ React10.createElement(Text8, { dimColor: true }, `     ${capabilityList(server)}`)) : null);
}
function capabilityList(s) {
  const caps = ["tools/list", "tools/call"];
  if (s.report.resources.supported) caps.push("resources/list");
  if (s.report.prompts.supported) caps.push("prompts/list");
  return caps.join("  ");
}

// src/cli/ui/McpMarketplace.tsx
import { Box as Box9, Text as Text9 } from "ink";
import React11, { useCallback, useEffect as useEffect4, useMemo as useMemo4, useState as useState6 } from "react";
var VISIBLE_ROWS = 10;
function buildMarketplacePickerSnapshot(args) {
  return {
    pickerKind: "mcp-marketplace",
    title: `${t("mcpMarketplace.title")} \xB7 ${args.status}`,
    query: args.query,
    items: args.filtered.map((e) => {
      const installedSpec = isInstalled(args.installedSpecs, e);
      return {
        id: e.name,
        title: e.title || e.name,
        subtitle: e.description?.slice(0, 200) ?? void 0,
        badge: installedSpec ? "installed" : e.source === "official" ? "official" : e.source === "smithery" ? "smithery" : "local",
        meta: e.popularity !== void 0 ? `\u2605 ${e.popularity.toLocaleString()}` : void 0
      };
    }),
    actions: ["install", "uninstall", "refine", "load-more", "cancel"],
    hasMore: args.hasMore,
    hint: t("mcpMarketplace.footerHint")
  };
}
function rankAndFilter(entries, query) {
  const q = query.trim().toLowerCase();
  const list2 = q ? entries.filter((e) => `${e.name} ${e.title} ${e.description}`.toLowerCase().includes(q)) : entries;
  return [...list2].sort((a, b) => {
    const ap = a.popularity ?? -1;
    const bp = b.popularity ?? -1;
    if (ap !== bp) return bp - ap;
    return a.name.localeCompare(b.name);
  });
}
function readInstalledSpecs() {
  return readConfig().mcp ?? [];
}
function isInstalled(installedSpecs, entry) {
  if (!entry.install) return null;
  try {
    const spec = specStringFor(entry.name, entry.install);
    return installedSpecs.includes(spec) ? spec : null;
  } catch {
    return null;
  }
}
function McpMarketplace({ onClose, postInfo, reloadMcp, pickerPorts }) {
  const [state, setState] = useState6({
    handle: null,
    loading: true,
    query: "",
    selected: 0,
    status: t("mcpMarketplace.opening"),
    installedSpecs: readInstalledSpecs()
  });
  useEffect4(() => {
    let cancelled = false;
    (async () => {
      try {
        const handle = await openRegistry({});
        if (cancelled) return;
        setState((s) => ({
          ...s,
          handle,
          loading: false,
          status: `${handle.source} \xB7 ${handle.cache.entries.length} entries${handle.fromCache ? t("mcpMarketplace.cached") : ""}`
        }));
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          status: t("mcpMarketplace.statusError", { message: err.message })
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const filtered = useMemo4(() => {
    if (!state.handle) return [];
    return rankAndFilter(state.handle.cache.entries, state.query);
  }, [state.handle, state.query]);
  const selected = filtered[state.selected];
  const fetchMore = useCallback(async () => {
    if (!state.handle || state.loading) return;
    if (state.handle.cache.pagination.nextCursor === null) {
      setState((s) => ({ ...s, status: t("mcpMarketplace.allLoaded") }));
      return;
    }
    setState((s) => ({ ...s, loading: true, status: t("mcpMarketplace.loadingMore") }));
    try {
      const r = await loadMorePages(state.handle, { pages: 5 });
      setState((s) => ({
        ...s,
        loading: false,
        status: `+${r.newEntries} \xB7 ${state.handle?.cache.entries.length ?? 0} total${r.exhausted ? " \xB7 exhausted" : ""}`
      }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, status: `error: ${err.message}` }));
    }
  }, [state.handle, state.loading]);
  const doUninstall = useCallback(
    async (entry, installed) => {
      const cfg = readConfig();
      const next = (cfg.mcp ?? []).filter((s) => s !== installed);
      writeConfig({ ...cfg, mcp: next });
      setState((s) => ({ ...s, installedSpecs: next, status: `uninstalled ${entry.name}` }));
      if (reloadMcp) {
        try {
          await reloadMcp();
          postInfo(`\u2713 uninstalled ${entry.name} \u2014 bridge dropped`);
        } catch (err) {
          postInfo(
            `\u2713 uninstalled ${entry.name} \u2014 restart \`reasonix code\` to drop the bridge (reload failed: ${err.message})`
          );
        }
      } else {
        postInfo(`\u2713 uninstalled ${entry.name} \u2014 restart \`reasonix code\` to drop the bridge`);
      }
    },
    [postInfo, reloadMcp]
  );
  const doInstall = useCallback(
    async (entry) => {
      let install = entry.install;
      if (!install && entry.source === "smithery") {
        setState((s) => ({ ...s, loading: true, status: t("mcpMarketplace.fetchingDetail") }));
        try {
          const detail = await fetchSmitheryDetail(entry.name);
          if (detail) {
            install = detail;
            entry.install = detail;
          }
        } catch {
        }
        setState((s) => ({ ...s, loading: false }));
      }
      if (!install) {
        setState((s) => ({
          ...s,
          status: `no install info for ${entry.name} \u2014 try \`npx -y @smithery/cli install ${entry.name}\``
        }));
        return;
      }
      try {
        const spec = specStringFor(entry.name, install);
        const cfg = readConfig();
        const existing = cfg.mcp ?? [];
        if (existing.includes(spec)) {
          setState((s) => ({
            ...s,
            installedSpecs: existing,
            status: `already installed: ${spec}`
          }));
          return;
        }
        const next = [...existing, spec];
        writeConfig({ ...cfg, mcp: next });
        setState((s) => ({ ...s, installedSpecs: next, status: `installed \u2192 ${spec}` }));
        const envHint = install.requiredEnv?.length ? `  \xB7  needs env: ${install.requiredEnv.join(", ")}` : "";
        if (reloadMcp) {
          try {
            const r = await reloadMcp();
            const failedHere = r.failed.find((f) => f.spec === spec);
            if (failedHere) {
              postInfo(`\u25B2 installed ${entry.name} \u2014 bridge failed: ${failedHere.reason}${envHint}`);
            } else {
              postInfo(`\u2713 installed ${entry.name} \u2014 bridged${envHint}`);
            }
          } catch (err) {
            postInfo(
              `\u2713 installed ${entry.name} \u2014 restart \`reasonix code\` to bridge (reload failed: ${err.message})${envHint}`
            );
          }
        } else {
          postInfo(`\u2713 installed ${entry.name} \u2014 restart \`reasonix code\` to bridge${envHint}`);
        }
      } catch (err) {
        setState((s) => ({ ...s, status: `install failed: ${err.message}` }));
      }
    },
    [postInfo, reloadMcp]
  );
  const installOrToggle = useCallback(
    async (entry) => {
      const installed = isInstalled(state.installedSpecs, entry);
      if (installed) await doUninstall(entry, installed);
      else await doInstall(entry);
    },
    [state.installedSpecs, doInstall, doUninstall]
  );
  const pickerSnapshot = useMemo4(
    () => buildMarketplacePickerSnapshot({
      filtered,
      installedSpecs: state.installedSpecs,
      query: state.query,
      status: state.status,
      hasMore: state.handle?.cache.pagination.nextCursor != null
    }),
    [filtered, state.installedSpecs, state.handle, state.query, state.status]
  );
  usePickerBroadcast(
    !!pickerPorts,
    { ...pickerSnapshot, actions: [...pickerSnapshot.actions] },
    (res) => {
      if (res.action === "cancel") return onClose();
      if (res.action === "refine") {
        setState((s) => ({ ...s, query: res.query, selected: 0 }));
        return;
      }
      if (res.action === "load-more") {
        void fetchMore();
        return;
      }
      if (res.action === "install") {
        const entry = state.handle?.cache.entries.find((e) => e.name === res.id);
        if (!entry) return;
        if (isInstalled(state.installedSpecs, entry)) {
          setState((s) => ({ ...s, status: `already installed: ${entry.name}` }));
          return;
        }
        void doInstall(entry);
        return;
      }
      if (res.action === "uninstall") {
        const entry = state.handle?.cache.entries.find((e) => e.name === res.id);
        if (!entry) return;
        const installed = isInstalled(state.installedSpecs, entry);
        if (!installed) {
          setState((s) => ({ ...s, status: `not installed: ${entry.name}` }));
          return;
        }
        void doUninstall(entry, installed);
      }
    },
    pickerPorts ?? {
      broadcast: () => void 0,
      resolverRef: { current: null },
      snapshotRef: { current: null }
    }
  );
  useKeystroke((ev) => {
    if (ev.paste) return;
    if (ev.escape) {
      onClose();
      return;
    }
    if (ev.upArrow) {
      setState((s) => ({ ...s, selected: Math.max(0, s.selected - 1) }));
      return;
    }
    if (ev.downArrow) {
      setState((s) => ({ ...s, selected: Math.min(filtered.length - 1, s.selected + 1) }));
      return;
    }
    if (ev.return) {
      if (selected) void installOrToggle(selected);
      return;
    }
    if (ev.pageDown) {
      void fetchMore();
      return;
    }
    if (ev.backspace || ev.delete) {
      setState((s) => ({ ...s, query: s.query.slice(0, -1), selected: 0 }));
      return;
    }
    if (ev.input && !ev.ctrl && !ev.meta) {
      setState((s) => ({ ...s, query: s.query + ev.input, selected: 0 }));
    }
  });
  const overlay = useMemo4(() => loadOverlay("zh-CN"), []);
  const start = Math.max(
    0,
    Math.min(state.selected - Math.floor(VISIBLE_ROWS / 2), filtered.length - VISIBLE_ROWS)
  );
  const window = filtered.slice(Math.max(0, start), Math.max(0, start) + VISIBLE_ROWS);
  return /* @__PURE__ */ React11.createElement(Box9, { flexDirection: "column", paddingX: 1 }, /* @__PURE__ */ React11.createElement(Box9, null, /* @__PURE__ */ React11.createElement(Text9, { bold: true, color: COLOR.brand }, "\u25C8 MCP marketplace"), /* @__PURE__ */ React11.createElement(Text9, { dimColor: true }, `  \xB7  ${state.status}`)), /* @__PURE__ */ React11.createElement(Box9, { marginTop: 1 }, /* @__PURE__ */ React11.createElement(Text9, null, t("mcpMarketplace.filter")), /* @__PURE__ */ React11.createElement(Text9, null, state.query || t("mcpMarketplace.filterPlaceholder")), /* @__PURE__ */ React11.createElement(
    Text9,
    {
      dimColor: true
    },
    `  ${t(filtered.length === 1 ? "mcpMarketplace.matchSingular" : "mcpMarketplace.matchPlural", { n: filtered.length })}`
  )), /* @__PURE__ */ React11.createElement(Box9, { marginTop: 1, flexDirection: "column" }, window.length === 0 ? /* @__PURE__ */ React11.createElement(Text9, { dimColor: true }, state.loading ? t("mcpMarketplace.loading") : t("mcpMarketplace.noEntries")) : window.map((e, i) => {
    const idx = (start || 0) + i;
    const active = idx === state.selected;
    const tag2 = e.source === "official" ? "[off]" : e.source === "smithery" ? "[smt]" : "[loc]";
    const installedSpec = isInstalled(state.installedSpecs, e);
    const installedBadge = installedSpec ? " \u2713" : "";
    const pop = e.popularity !== void 0 ? ` \xB7 ${e.popularity.toLocaleString()}` : "";
    return /* @__PURE__ */ React11.createElement(Box9, { key: e.name }, /* @__PURE__ */ React11.createElement(Text9, { color: active ? COLOR.brand : void 0 }, active ? "\u25B8 " : "  "), /* @__PURE__ */ React11.createElement(Text9, { bold: active }, e.name.padEnd(38).slice(0, 38)), /* @__PURE__ */ React11.createElement(Text9, { dimColor: true }, ` ${tag2}${pop}${installedBadge}`));
  })), selected ? /* @__PURE__ */ React11.createElement(Box9, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React11.createElement(Text9, { bold: true }, overlay?.[selected.name]?.title ?? selected.title, overlay?.[selected.name] ? /* @__PURE__ */ React11.createElement(Text9, { dimColor: true }, `  \xB7  ${selected.title}`) : null), /* @__PURE__ */ React11.createElement(Text9, { dimColor: true }, overlay?.[selected.name]?.description ?? selected.description?.slice(0, 200) ?? null), selected.install ? /* @__PURE__ */ React11.createElement(Text9, { dimColor: true }, t("mcpMarketplace.specLine", {
    runtime: selected.install.runtime,
    id: selected.install.packageId ?? selected.install.url ?? "\u2014",
    transport: selected.install.transport
  })) : /* @__PURE__ */ React11.createElement(Text9, { dimColor: true }, t("mcpMarketplace.smitheryDetail")), selected.install?.requiredEnv?.length ? /* @__PURE__ */ React11.createElement(Text9, { color: "yellow" }, t("mcpMarketplace.needsEnv", { env: selected.install.requiredEnv.join(", ") })) : null) : null, /* @__PURE__ */ React11.createElement(Box9, { marginTop: 1 }, /* @__PURE__ */ React11.createElement(Text9, { dimColor: true }, t("mcpMarketplace.footerHint"))));
}

// src/cli/ui/McpHub.tsx
function McpHub({
  initialTab,
  liveServers,
  configPath,
  onClose,
  postInfo,
  applyAppend,
  reloadMcp,
  pickerPorts
}) {
  const [tab, setTab] = useState7(initialTab);
  useKeystroke((ev) => {
    if (ev.paste) return;
    if (ev.tab) setTab((t2) => t2 === "live" ? "marketplace" : "live");
  });
  return /* @__PURE__ */ React12.createElement(Box10, { flexDirection: "column" }, /* @__PURE__ */ React12.createElement(Box10, { paddingX: 1 }, /* @__PURE__ */ React12.createElement(Text10, { bold: true, color: COLOR.brand }, "\u25C8 MCP"), /* @__PURE__ */ React12.createElement(Text10, null, "  "), /* @__PURE__ */ React12.createElement(
    TabPill,
    {
      label: t("handlers.mcp.liveTab"),
      count: liveServers.length,
      active: tab === "live"
    }
  ), /* @__PURE__ */ React12.createElement(Text10, null, "  "), /* @__PURE__ */ React12.createElement(TabPill, { label: t("handlers.mcp.marketplaceTab"), active: tab === "marketplace" }), /* @__PURE__ */ React12.createElement(Text10, { dimColor: true }, `   ${t("handlers.mcp.tabHint")}`)), tab === "live" ? /* @__PURE__ */ React12.createElement(
    McpBrowser,
    {
      servers: liveServers,
      configPath,
      onClose,
      postInfo,
      applyAppend
    }
  ) : /* @__PURE__ */ React12.createElement(
    McpMarketplace,
    {
      onClose,
      postInfo,
      reloadMcp,
      pickerPorts
    }
  ));
}
function TabPill({ label, count, active }) {
  const text = count !== void 0 ? `${label} (${count})` : label;
  if (active) {
    return /* @__PURE__ */ React12.createElement(Text10, { bold: true, color: COLOR.brand }, "[", text, "]");
  }
  return /* @__PURE__ */ React12.createElement(Text10, { dimColor: true }, ` ${text} `);
}

// src/cli/ui/ModelPicker.tsx
import { Box as Box11, Text as Text12, useStdout as useStdout5 } from "ink";
import React14, { useState as useState8 } from "react";

// src/cli/ui/primitives/Pill.tsx
import { Text as Text11 } from "ink";
import React13 from "react";
function Pill({ label, bg, fg, bold = true }) {
  return /* @__PURE__ */ React13.createElement(Text11, { backgroundColor: bg, color: fg, bold }, ` ${label} `);
}
var PILL_SECTION = {
  reason: { bg: "#2a1f3d", fg: "#d2a8ff" },
  output: { bg: "#0d1d2e", fg: "#79c0ff" },
  tool: { bg: "#0f2230", fg: "#79c0ff" },
  shell: { bg: "#0f2230", fg: "#79c0ff" },
  task: { bg: "#0d1d2e", fg: "#79c0ff" },
  taskDone: { bg: "#102815", fg: "#7ee787" },
  taskFailed: { bg: "#2c1416", fg: "#ff8b81" },
  plan: { bg: "#2a1f3d", fg: "#d2a8ff" },
  user: { bg: "#11141a", fg: "#8b949e" },
  empty: { bg: "#11141a", fg: "#6e7681" }
};
var PILL_PATH = { bg: "#11141a", fg: "#8b949e" };
var PILL_MODEL = {
  flash: { bg: "#11141a", fg: "#79c0ff" },
  pro: { bg: "#11141a", fg: "#d2a8ff" },
  r1: { bg: "#11141a", fg: "#b395f5" },
  unknown: { bg: "#11141a", fg: "#8b949e" }
};
function modelBadgeFor(model2) {
  if (!model2) return { label: "?", kind: "unknown" };
  const stripped = model2.replace(/^deepseek-/, "");
  if (stripped === "v4-flash" || stripped === "chat") return { label: "v4-flash", kind: "flash" };
  if (stripped === "v4-pro") return { label: "v4-pro", kind: "pro" };
  if (stripped === "r1" || stripped === "reasoner") return { label: "r1", kind: "r1" };
  return { label: stripped, kind: "unknown" };
}

// src/cli/ui/ModelPicker.tsx
var PAGE_MARGIN2 = 8;
var PRESET_NAMES = ["auto", "flash", "pro"];
function ModelPicker({
  models,
  current,
  currentEffort,
  currentAutoEscalate,
  onChoose,
  onRefresh
}) {
  const modelList = (models && models.length > 0 ? models : FALLBACK_MODELS).slice();
  if (!modelList.includes(current)) modelList.unshift(current);
  const presetRows = PRESET_NAMES.map((name) => ({ kind: "preset", name }));
  const modelRows = modelList.map((id) => ({ kind: "model", id }));
  const rows = [...presetRows, ...modelRows];
  const activePreset = detectActivePreset(current, currentEffort, currentAutoEscalate);
  const initialIndex = activePreset ? PRESET_NAMES.indexOf(activePreset) : presetRows.length + Math.max(0, modelList.indexOf(current));
  const [focus, setFocus] = useState8(initialIndex);
  const { stdout } = useStdout5();
  const termRows = stdout?.rows ?? 40;
  const visibleCount = Math.max(6, termRows - PAGE_MARGIN2);
  useKeystroke((ev) => {
    if (ev.escape) return onChoose({ kind: "quit" });
    if (ev.upArrow) return setFocus((f) => Math.max(0, f - 1));
    if (ev.downArrow) return setFocus((f) => Math.min(rows.length - 1, f + 1));
    if (ev.return) {
      const target = rows[focus];
      if (!target) return;
      if (target.kind === "preset") return onChoose({ kind: "preset", name: target.name });
      return onChoose({ kind: "select", id: target.id });
    }
    if (!ev.input) return;
    if (ev.input === "q") return onChoose({ kind: "quit" });
    if (ev.input === "r") onRefresh?.();
  });
  const start = Math.max(
    0,
    Math.min(focus - Math.floor(visibleCount / 2), rows.length - visibleCount)
  );
  const end = Math.min(rows.length, start + visibleCount);
  const shown = rows.slice(start, end);
  const hiddenAbove = start;
  const hiddenBelow = rows.length - end;
  const loading = models === null;
  const empty = models !== null && models.length === 0;
  let lastSection = null;
  return /* @__PURE__ */ React14.createElement(Box11, { flexDirection: "column", marginY: 1 }, /* @__PURE__ */ React14.createElement(Box11, null, /* @__PURE__ */ React14.createElement(Text12, { bold: true, color: TONE.brand }, t("modelPicker.header")), /* @__PURE__ */ React14.createElement(Text12, { color: FG.meta }, loading ? t("modelPicker.loading") : empty ? t("modelPicker.catalogEmpty") : t("modelPicker.modelsAvailable", { count: modelList.length }))), /* @__PURE__ */ React14.createElement(Box11, { height: 1 }), hiddenAbove > 0 ? /* @__PURE__ */ React14.createElement(Box11, null, /* @__PURE__ */ React14.createElement(Text12, { color: FG.faint }, `     \u2026 ${hiddenAbove}`)) : null, shown.map((row2, i) => {
    const idx = start + i;
    const focused = idx === focus;
    const showHeader = row2.kind !== lastSection;
    lastSection = row2.kind;
    const header = showHeader ? /* @__PURE__ */ React14.createElement(Box11, { key: `hdr-${row2.kind}`, marginTop: idx === 0 ? 0 : 1 }, /* @__PURE__ */ React14.createElement(Text12, { color: FG.meta }, row2.kind === "preset" ? t("modelPicker.presetsHeader") : t("modelPicker.modelsHeader"))) : null;
    const body = row2.kind === "preset" ? /* @__PURE__ */ React14.createElement(
      PresetRow,
      {
        key: `p-${row2.name}`,
        name: row2.name,
        focused,
        active: activePreset === row2.name
      }
    ) : /* @__PURE__ */ React14.createElement(
      ModelRow,
      {
        key: `m-${row2.id}`,
        id: row2.id,
        focused,
        active: !activePreset && row2.id === current
      }
    );
    return /* @__PURE__ */ React14.createElement(React14.Fragment, { key: `row-${idx}` }, header, body);
  }), hiddenBelow > 0 ? /* @__PURE__ */ React14.createElement(Box11, null, /* @__PURE__ */ React14.createElement(Text12, { color: FG.faint }, t("cardLabels.more", { count: hiddenBelow }))) : null, /* @__PURE__ */ React14.createElement(Box11, { marginTop: 1 }, /* @__PURE__ */ React14.createElement(Text12, { color: FG.faint }, t("modelPicker.pickerFooter"))));
}
function PresetRow({
  name,
  focused,
  active
}) {
  const desc = PRESET_DESCRIPTIONS[name];
  return /* @__PURE__ */ React14.createElement(Box11, null, /* @__PURE__ */ React14.createElement(Text12, { color: focused ? TONE.brand : FG.faint }, focused ? "  \u25B8 " : "    "), /* @__PURE__ */ React14.createElement(Text12, { bold: focused, color: focused ? FG.strong : FG.sub }, name.padEnd(8)), /* @__PURE__ */ React14.createElement(Text12, { color: focused ? FG.body : FG.meta }, desc.headline.padEnd(28)), /* @__PURE__ */ React14.createElement(Text12, { color: FG.meta }, `  ${desc.cost}`), active ? /* @__PURE__ */ React14.createElement(Text12, { color: TONE.brand }, t("modelPicker.currentLabel")) : null);
}
function ModelRow({
  id,
  focused,
  active
}) {
  const badge = modelBadgeFor(id);
  return /* @__PURE__ */ React14.createElement(Box11, null, /* @__PURE__ */ React14.createElement(Text12, { color: focused ? TONE.brand : FG.faint }, focused ? "  \u25B8 " : "    "), /* @__PURE__ */ React14.createElement(Text12, { bold: focused, color: focused ? FG.strong : FG.sub }, id.padEnd(24)), /* @__PURE__ */ React14.createElement(Text12, null, " "), /* @__PURE__ */ React14.createElement(Pill, { label: badge.label, ...PILL_MODEL[badge.kind], bold: false }), active ? /* @__PURE__ */ React14.createElement(Text12, { color: TONE.brand }, t("modelPicker.currentLabel")) : null);
}
function detectActivePreset(model2, effort, autoEscalate) {
  for (const name of PRESET_NAMES) {
    const p = PRESETS[name];
    if (p.model === model2 && p.reasoningEffort === effort && p.autoEscalate === autoEscalate) {
      return name;
    }
  }
  return null;
}
var FALLBACK_MODELS = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-chat",
  "deepseek-reasoner"
];

// src/cli/ui/PathConfirm.tsx
import { homedir as homedir2 } from "os";
import { Box as Box12, Text as Text13 } from "ink";
import React15, { useState as useState9 } from "react";
function tildeify(p) {
  const home = homedir2();
  if (!home) return p;
  const normalized = home.replace(/[\\/]+$/, "");
  if (p === normalized) return "~";
  if (p.startsWith(`${normalized}/`)) return `~/${p.slice(normalized.length + 1)}`;
  if (p.startsWith(`${normalized}\\`)) return `~\\${p.slice(normalized.length + 1)}`;
  return p;
}
function PathConfirm({
  path,
  intent,
  toolName,
  sandboxRoot,
  allowPrefix,
  onChoose
}) {
  useReserveRows("modal", { min: 8, max: 14 });
  const [phase, setPhase] = useState9("pick");
  if (phase === "deny") {
    return /* @__PURE__ */ React15.createElement(
      ApprovalCard,
      {
        tone: "error",
        glyph: "\u2717",
        title: t("pathConfirm.denyTitle"),
        metaRight: t("pathConfirm.optional"),
        footerHint: t("pathConfirm.denyFooter")
      },
      /* @__PURE__ */ React15.createElement(
        DenyContextInput,
        {
          onSubmit: (context2) => onChoose("deny", context2 || void 0),
          onCancel: () => onChoose("deny")
        }
      )
    );
  }
  return /* @__PURE__ */ React15.createElement(
    ApprovalCard,
    {
      tone: "warn",
      glyph: "!",
      title: t("pathConfirm.title"),
      metaRight: t("pathConfirm.awaiting"),
      footerHint: t("pathConfirm.pickFooter")
    },
    /* @__PURE__ */ React15.createElement(Box12, { marginBottom: 1 }, /* @__PURE__ */ React15.createElement(Text13, { color: FG.faint }, t(intent === "write" ? "pathConfirm.subtitleWrite" : "pathConfirm.subtitleRead", {
      tool: toolName
    }))),
    /* @__PURE__ */ React15.createElement(
      InfoRows,
      {
        path: tildeify(path),
        sandboxRoot: tildeify(sandboxRoot),
        allowPrefix: tildeify(allowPrefix)
      }
    ),
    /* @__PURE__ */ React15.createElement(
      SingleSelect,
      {
        initialValue: "run_once",
        items: [
          {
            value: "run_once",
            label: t("pathConfirm.allowOnce"),
            hint: t("pathConfirm.allowOnceDesc")
          },
          {
            value: "always_allow",
            label: t("pathConfirm.allowAlways"),
            hint: t("pathConfirm.allowAlwaysDesc", { prefix: tildeify(allowPrefix) })
          },
          {
            value: "deny",
            label: t("pathConfirm.deny"),
            hint: t("pathConfirm.denyDesc")
          }
        ],
        onSubmit: (v) => {
          if (v === "deny") setPhase("deny");
          else onChoose(v);
        },
        onTab: (v) => {
          if (v === "deny") setPhase("deny");
        },
        onCancel: () => onChoose("deny")
      }
    )
  );
}
function InfoRows({
  path,
  sandboxRoot,
  allowPrefix
}) {
  const rows = [
    { label: t("pathConfirm.pathLabel"), value: path },
    { label: t("pathConfirm.sandboxLabel"), value: sandboxRoot }
  ];
  if (allowPrefix !== path) {
    rows.push({ label: t("pathConfirm.allowPrefixLabel"), value: allowPrefix });
  }
  const labelWidth = Math.max(...rows.map((r) => r.label.length));
  return /* @__PURE__ */ React15.createElement(Box12, { flexDirection: "column", marginBottom: 1 }, rows.map((r) => /* @__PURE__ */ React15.createElement(Box12, { key: r.label, flexDirection: "row", gap: 1 }, /* @__PURE__ */ React15.createElement(Text13, { color: FG.faint }, r.label.padEnd(labelWidth)), /* @__PURE__ */ React15.createElement(Text13, { color: FG.body }, r.value))));
}

// src/cli/ui/PlanCheckpointConfirm.tsx
import { Box as Box15 } from "ink";
import React18 from "react";

// src/cli/ui/PlanStepList.tsx
import { Box as Box14, Text as Text15 } from "ink";
import React17 from "react";

// src/cli/ui/char-bar.tsx
import { Box as Box13, Text as Text14 } from "ink";
import React16 from "react";
function CharBar({
  pct,
  width = 24,
  color = COLOR.primary,
  emptyColor,
  showLabel = true,
  label
}) {
  const total = Math.max(4, width);
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const filled = Math.round(total * clamped / 100);
  return /* @__PURE__ */ React16.createElement(Box13, null, /* @__PURE__ */ React16.createElement(Text14, { color }, GLYPH.block.repeat(filled)), /* @__PURE__ */ React16.createElement(Text14, { color: emptyColor ?? COLOR.info, dimColor: true }, GLYPH.shade1.repeat(total - filled)), showLabel ? /* @__PURE__ */ React16.createElement(Text14, { dimColor: true }, `  ${label ?? `${Math.round(clamped)}%`}`) : null);
}

// src/cli/ui/PlanStepList.tsx
function getStatus(stepId, statuses) {
  if (!statuses) return "pending";
  if (statuses instanceof Map) {
    return statuses.get(stepId) ?? "pending";
  }
  return statuses[stepId] ?? "pending";
}
function statusGlyph(status2, isCur) {
  if (status2 === "done") return { glyph: GLYPH.done, color: COLOR.ok };
  if (status2 === "running") return { glyph: GLYPH.cur, color: COLOR.primary };
  if (status2 === "skipped") return { glyph: GLYPH.fail, color: COLOR.info };
  if (isCur) return { glyph: GLYPH.cur, color: COLOR.primary };
  return { glyph: GLYPH.pending, color: COLOR.info };
}
function riskLabel(risk) {
  if (risk === "med") return { text: `${GLYPH.warn}${t("planFlow.riskMed")}`, color: COLOR.warn };
  if (risk === "high") return { text: `${GLYPH.warn}${t("planFlow.riskHigh")}`, color: COLOR.err };
  return null;
}
function PlanStepListInner({ steps, statuses, focusStepId }) {
  if (steps.length === 0) return null;
  const statusList = steps.map((s) => getStatus(s.id, statuses));
  const total = steps.length;
  const doneCount = statusList.filter((s) => s === "done").length;
  const pct = Math.round(doneCount / total * 100);
  const showProgress = doneCount > 0;
  return /* @__PURE__ */ React17.createElement(Box14, { flexDirection: "column" }, /* @__PURE__ */ React17.createElement(Box14, null, /* @__PURE__ */ React17.createElement(Text15, { dimColor: true }, showProgress ? t(
    total === 1 ? "planFlow.stepList.counterDoneSingular" : "planFlow.stepList.counterDone",
    { done: doneCount, total, pct }
  ) : t(total === 1 ? "planFlow.stepList.counterSingular" : "planFlow.stepList.counter", {
    total
  }))), /* @__PURE__ */ React17.createElement(Box14, { flexDirection: "column" }, steps.map((step, i) => {
    const status2 = statusList[i];
    const isLast = i === total - 1;
    const isCur = focusStepId === step.id;
    const sg = statusGlyph(status2, isCur);
    const risk = riskLabel(step.risk);
    const titleDim = status2 === "done" || status2 === "skipped";
    return /* @__PURE__ */ React17.createElement(Box14, { key: step.id }, /* @__PURE__ */ React17.createElement(Text15, { color: COLOR.info, dimColor: true }, isLast ? GLYPH.branchEnd : GLYPH.branch), /* @__PURE__ */ React17.createElement(Text15, null, "  "), /* @__PURE__ */ React17.createElement(Text15, { color: sg.color, bold: status2 === "running" || isCur }, sg.glyph), /* @__PURE__ */ React17.createElement(Text15, null, "  "), /* @__PURE__ */ React17.createElement(
      Text15,
      {
        dimColor: titleDim,
        bold: isCur || status2 === "running",
        strikethrough: status2 === "done" || status2 === "skipped"
      },
      `${step.id} \xB7 ${step.title}`
    ), risk ? /* @__PURE__ */ React17.createElement(React17.Fragment, null, /* @__PURE__ */ React17.createElement(Text15, null, "   "), /* @__PURE__ */ React17.createElement(Text15, { color: risk.color }, risk.text)) : null);
  })), showProgress ? /* @__PURE__ */ React17.createElement(Box14, null, /* @__PURE__ */ React17.createElement(Text15, null, "      "), /* @__PURE__ */ React17.createElement(CharBar, { pct, width: 24 })) : null);
}
var PlanStepList = React17.memo(PlanStepListInner);

// src/cli/ui/PlanCheckpointConfirm.tsx
function PlanCheckpointConfirmInner({
  stepId,
  title,
  completed,
  total,
  steps,
  completedStepIds,
  onChoose
}) {
  const stepRows = steps?.length ?? 0;
  useReserveRows("modal", { min: 10, max: Math.max(14, stepRows + 12) });
  const label = title ? `${stepId} \xB7 ${title}` : stepId;
  const counter = total > 0 ? `${completed}/${total}` : "";
  const isLast = total > 0 && completed >= total;
  const statuses = buildStatusMap(steps, completedStepIds, stepId, isLast);
  const subtitle = counter ? `${counter}  \xB7  ${label}` : label;
  return /* @__PURE__ */ React18.createElement(ApprovalCard, { tone: "ok", glyph: "\u26C1", title: t("planFlow.checkpoint.title"), metaRight: subtitle }, steps && steps.length > 0 ? /* @__PURE__ */ React18.createElement(Box15, { marginBottom: 1, flexDirection: "column" }, /* @__PURE__ */ React18.createElement(PlanStepList, { steps, statuses, focusStepId: stepId })) : null, /* @__PURE__ */ React18.createElement(
    SingleSelect,
    {
      initialValue: isLast ? "stop" : "continue",
      items: [
        {
          value: "continue",
          label: t("planFlow.checkpoint.continue"),
          hint: t("planFlow.checkpoint.continueHint")
        },
        {
          value: "revise",
          label: t("planFlow.checkpoint.revise"),
          hint: t("planFlow.checkpoint.reviseHint")
        },
        {
          value: "stop",
          label: t("planFlow.checkpoint.stop"),
          hint: t("planFlow.checkpoint.stopHint")
        }
      ],
      onSubmit: (v) => onChoose(v),
      onCancel: () => onChoose("stop")
    }
  ));
}
var PlanCheckpointConfirm = React18.memo(PlanCheckpointConfirmInner);
function buildStatusMap(steps, completedStepIds, currentStepId, isLast) {
  const map = /* @__PURE__ */ new Map();
  if (!steps) return map;
  for (const step of steps) {
    if (completedStepIds?.has(step.id) || step.id === currentStepId) {
      map.set(step.id, "done");
    } else {
      map.set(step.id, "pending");
    }
  }
  void isLast;
  return map;
}

// src/cli/ui/PlanConfirm.tsx
import { Box as Box17, Text as Text17, useStdout as useStdout6 } from "ink";
import React20, { useMemo as useMemo5, useState as useState10 } from "react";

// src/cli/ui/markdown-view.tsx
import { Box as Box16, Text as Text16, Transform } from "ink";
import React19 from "react";

// node_modules/marked/lib/marked.esm.js
function _getDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null
  };
}
var _defaults = _getDefaults();
function changeDefaults(newDefaults) {
  _defaults = newDefaults;
}
var noopTest = { exec: () => null };
function edit(regex, opt = "") {
  let source = typeof regex === "string" ? regex : regex.source;
  const obj = {
    replace: (name, val) => {
      let valSource = typeof val === "string" ? val : val.source;
      valSource = valSource.replace(other.caret, "$1");
      source = source.replace(name, valSource);
      return obj;
    },
    getRegex: () => {
      return new RegExp(source, opt);
    }
  };
  return obj;
}
var other = {
  codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  listReplaceTabs: /^\t+/,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: (bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
  hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
  fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
  headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
  htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i")
};
var newline = /^(?:[ \t]*(?:\n|$))+/;
var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var bullet = /(?:[*+-]|\d{1,9}[.)])/;
var lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var blockText = /^[^\n]+/;
var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var html = edit(
  "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))",
  "i"
).replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
var blockNormal = {
  blockquote,
  code: blockCode,
  def,
  fences,
  heading,
  hr,
  html,
  lheading,
  list,
  newline,
  paragraph,
  table: noopTest,
  text: blockText
};
var gfmTable = edit(
  "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockGfm = {
  ...blockNormal,
  lheading: lheadingGfm,
  table: gfmTable,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
};
var blockPedantic = {
  ...blockNormal,
  html: edit(
    `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
  ).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: noopTest,
  // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
};
var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var br = /^( {2,}|\\)\n(?!\s*$)/;
var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var _punctuation = /[\p{P}\p{S}]/u;
var _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
var punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
var _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
var _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
var emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
var emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimUnd = edit(
  "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
  "gu"
).replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
var tag = edit(
  "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
).replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
var link = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
var inlineNormal = {
  _backpedal: noopTest,
  // only used for GFM url
  anyPunctuation,
  autolink,
  blockSkip,
  br,
  code: inlineCode,
  del: noopTest,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape,
  link,
  nolink,
  punctuation,
  reflink,
  reflinkSearch,
  tag,
  text: inlineText,
  url: noopTest
};
var inlinePedantic = {
  ...inlineNormal,
  link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
};
var inlineGfm = {
  ...inlineNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim: emStrongLDelimGfm,
  url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
};
var inlineBreaks = {
  ...inlineGfm,
  br: edit(br).replace("{2,}", "*").getRegex(),
  text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
};
var block = {
  normal: blockNormal,
  gfm: blockGfm,
  pedantic: blockPedantic
};
var inline = {
  normal: inlineNormal,
  gfm: inlineGfm,
  breaks: inlineBreaks,
  pedantic: inlinePedantic
};
var escapeReplacements = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
var getEscapeReplacement = (ch) => escapeReplacements[ch];
function escape2(html2, encode) {
  if (encode) {
    if (other.escapeTest.test(html2)) {
      return html2.replace(other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (other.escapeTestNoEncode.test(html2)) {
      return html2.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }
  return html2;
}
function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(other.percentDecode, "%");
  } catch {
    return null;
  }
  return href;
}
function splitCells(tableRow, count) {
  const row2 = tableRow.replace(other.findPipe, (match, offset, str) => {
    let escaped = false;
    let curr = offset;
    while (--curr >= 0 && str[curr] === "\\") escaped = !escaped;
    if (escaped) {
      return "|";
    } else {
      return " |";
    }
  }), cells = row2.split(other.splitPipe);
  let i = 0;
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !cells.at(-1)?.trim()) {
    cells.pop();
  }
  if (count) {
    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count) cells.push("");
    }
  }
  for (; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(other.slashPipe, "|");
  }
  return cells;
}
function rtrim(str, c, invert) {
  const l = str.length;
  if (l === 0) {
    return "";
  }
  let suffLen = 0;
  while (suffLen < l) {
    const currChar = str.charAt(l - suffLen - 1);
    if (currChar === c && !invert) {
      suffLen++;
    } else if (currChar !== c && invert) {
      suffLen++;
    } else {
      break;
    }
  }
  return str.slice(0, l - suffLen);
}
function findClosingBracket(str, b) {
  if (str.indexOf(b[1]) === -1) {
    return -1;
  }
  let level = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\\") {
      i++;
    } else if (str[i] === b[0]) {
      level++;
    } else if (str[i] === b[1]) {
      level--;
      if (level < 0) {
        return i;
      }
    }
  }
  if (level > 0) {
    return -2;
  }
  return -1;
}
function outputLink(cap, link2, raw, lexer2, rules) {
  const href = link2.href;
  const title = link2.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, "$1");
  lexer2.state.inLink = true;
  const token = {
    type: cap[0].charAt(0) === "!" ? "image" : "link",
    raw,
    href,
    title,
    text,
    tokens: lexer2.inlineTokens(text)
  };
  lexer2.state.inLink = false;
  return token;
}
function indentCodeCompensation(raw, text, rules) {
  const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
  if (matchIndentToCode === null) {
    return text;
  }
  const indentToCode = matchIndentToCode[1];
  return text.split("\n").map((node) => {
    const matchIndentInNode = node.match(rules.other.beginningSpace);
    if (matchIndentInNode === null) {
      return node;
    }
    const [indentInNode] = matchIndentInNode;
    if (indentInNode.length >= indentToCode.length) {
      return node.slice(indentToCode.length);
    }
    return node;
  }).join("\n");
}
var _Tokenizer = class {
  options;
  rules;
  // set by the lexer
  lexer;
  // set by the lexer
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: "space",
        raw: cap[0]
      };
    }
  }
  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const text = cap[0].replace(this.rules.other.codeRemoveIndent, "");
      return {
        type: "code",
        raw: cap[0],
        codeBlockStyle: "indented",
        text: !this.options.pedantic ? rtrim(text, "\n") : text
      };
    }
  }
  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || "", this.rules);
      return {
        type: "code",
        raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
        text
      };
    }
  }
  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (this.rules.other.endingHash.test(text)) {
        const trimmed = rtrim(text, "#");
        if (this.options.pedantic) {
          text = trimmed.trim();
        } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
          text = trimmed.trim();
        }
      }
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[1].length,
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) {
      return {
        type: "hr",
        raw: rtrim(cap[0], "\n")
      };
    }
  }
  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], "\n").split("\n");
      let raw = "";
      let text = "";
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i;
        for (i = 0; i < lines.length; i++) {
          if (this.rules.other.blockquoteStart.test(lines[i])) {
            currentLines.push(lines[i]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i]);
          } else {
            break;
          }
        }
        lines = lines.slice(i);
        const currentRaw = currentLines.join("\n");
        const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
        raw = raw ? `${raw}
${currentRaw}` : currentRaw;
        text = text ? `${text}
${currentText}` : currentText;
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = top;
        if (lines.length === 0) {
          break;
        }
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "code") {
          break;
        } else if (lastToken?.type === "blockquote") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.blockquote(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
          break;
        } else if (lastToken?.type === "list") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.list(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.raw.length) + newToken.raw;
          lines = newText.substring(tokens.at(-1).raw.length).split("\n");
          continue;
        }
      }
      return {
        type: "blockquote",
        raw,
        tokens,
        text
      };
    }
  }
  list(src) {
    let cap = this.rules.block.list.exec(src);
    if (cap) {
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list2 = {
        type: "list",
        raw: "",
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : "",
        loose: false,
        items: []
      };
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      if (this.options.pedantic) {
        bull = isordered ? bull : "[*+-]";
      }
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      while (src) {
        let endEarly = false;
        let raw = "";
        let itemContents = "";
        if (!(cap = itemRegex.exec(src))) {
          break;
        }
        if (this.rules.block.hr.test(src)) {
          break;
        }
        raw = cap[0];
        src = src.substring(raw.length);
        let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t2) => " ".repeat(3 * t2.length));
        let nextLine = src.split("\n", 1)[0];
        let blankLine = !line.trim();
        let indent = 0;
        if (this.options.pedantic) {
          indent = 2;
          itemContents = line.trimStart();
        } else if (blankLine) {
          indent = cap[1].length + 1;
        } else {
          indent = cap[2].search(this.rules.other.nonSpaceChar);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += cap[1].length;
        }
        if (blankLine && this.rules.other.blankLine.test(nextLine)) {
          raw += nextLine + "\n";
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          while (src) {
            const rawLine = src.split("\n", 1)[0];
            let nextLineWithoutTabs;
            nextLine = rawLine;
            if (this.options.pedantic) {
              nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
              nextLineWithoutTabs = nextLine;
            } else {
              nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
            }
            if (fencesBeginRegex.test(nextLine)) {
              break;
            }
            if (headingBeginRegex.test(nextLine)) {
              break;
            }
            if (htmlBeginRegex.test(nextLine)) {
              break;
            }
            if (nextBulletRegex.test(nextLine)) {
              break;
            }
            if (hrRegex.test(nextLine)) {
              break;
            }
            if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
              itemContents += "\n" + nextLineWithoutTabs.slice(indent);
            } else {
              if (blankLine) {
                break;
              }
              if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                break;
              }
              if (fencesBeginRegex.test(line)) {
                break;
              }
              if (headingBeginRegex.test(line)) {
                break;
              }
              if (hrRegex.test(line)) {
                break;
              }
              itemContents += "\n" + nextLine;
            }
            if (!blankLine && !nextLine.trim()) {
              blankLine = true;
            }
            raw += rawLine + "\n";
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }
        if (!list2.loose) {
          if (endsWithBlankLine) {
            list2.loose = true;
          } else if (this.rules.other.doubleBlankLine.test(raw)) {
            endsWithBlankLine = true;
          }
        }
        let istask = null;
        let ischecked;
        if (this.options.gfm) {
          istask = this.rules.other.listIsTask.exec(itemContents);
          if (istask) {
            ischecked = istask[0] !== "[ ] ";
            itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
          }
        }
        list2.items.push({
          type: "list_item",
          raw,
          task: !!istask,
          checked: ischecked,
          loose: false,
          text: itemContents,
          tokens: []
        });
        list2.raw += raw;
      }
      const lastItem = list2.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        return;
      }
      list2.raw = list2.raw.trimEnd();
      for (let i = 0; i < list2.items.length; i++) {
        this.lexer.state.top = false;
        list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
        if (!list2.loose) {
          const spacers = list2.items[i].tokens.filter((t2) => t2.type === "space");
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t2) => this.rules.other.anyLine.test(t2.raw));
          list2.loose = hasMultipleLineBreaks;
        }
      }
      if (list2.loose) {
        for (let i = 0; i < list2.items.length; i++) {
          list2.items[i].loose = true;
        }
      }
      return list2;
    }
  }
  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const token = {
        type: "html",
        block: true,
        raw: cap[0],
        pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
        text: cap[0]
      };
      return token;
    }
  }
  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
      return {
        type: "def",
        tag: tag2,
        raw: cap[0],
        href,
        title
      };
    }
  }
  table(src) {
    const cap = this.rules.block.table.exec(src);
    if (!cap) {
      return;
    }
    if (!this.rules.other.tableDelimiter.test(cap[2])) {
      return;
    }
    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
    const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
    const item = {
      type: "table",
      raw: cap[0],
      header: [],
      align: [],
      rows: []
    };
    if (headers.length !== aligns.length) {
      return;
    }
    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push("right");
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push("center");
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push("left");
      } else {
        item.align.push(null);
      }
    }
    for (let i = 0; i < headers.length; i++) {
      item.header.push({
        text: headers[i],
        tokens: this.lexer.inline(headers[i]),
        header: true,
        align: item.align[i]
      });
    }
    for (const row2 of rows) {
      item.rows.push(splitCells(row2, item.header.length).map((cell, i) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i]
        };
      }));
    }
    return item;
  }
  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[2].charAt(0) === "=" ? 1 : 2,
        text: cap[1],
        tokens: this.lexer.inline(cap[1])
      };
    }
  }
  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
      return {
        type: "paragraph",
        raw: cap[0],
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap) {
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0])
      };
    }
  }
  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) {
      return {
        type: "escape",
        raw: cap[0],
        text: cap[1]
      };
    }
  }
  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }
      return {
        type: "html",
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0]
      };
    }
  }
  link(src) {
    const cap = this.rules.inline.link.exec(src);
    if (cap) {
      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
          return;
        }
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        const lastParenIndex = findClosingBracket(cap[2], "()");
        if (lastParenIndex === -2) {
          return;
        }
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf("!") === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = "";
        }
      }
      let href = cap[2];
      let title = "";
      if (this.options.pedantic) {
        const link2 = this.rules.other.pedanticHrefTitle.exec(href);
        if (link2) {
          href = link2[1];
          title = link2[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : "";
      }
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      return outputLink(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
      }, cap[0], this.lexer, this.rules);
    }
  }
  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
      const link2 = links[linkString.toLowerCase()];
      if (!link2) {
        const text = cap[0].charAt(0);
        return {
          type: "text",
          raw: text,
          text
        };
      }
      return outputLink(cap, link2, cap[0], this.lexer, this.rules);
    }
  }
  emStrong(src, maskedSrc, prevChar = "") {
    let match = this.rules.inline.emStrongLDelim.exec(src);
    if (!match) return;
    if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
    const nextChar = match[1] || match[2] || "";
    if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
      const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      endReg.lastIndex = 0;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      while ((match = endReg.exec(maskedSrc)) != null) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = [...rDelim].length;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6]) {
          if (lLength % 3 && !((lLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue;
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        if (Math.min(lLength, rLength) % 2) {
          const text2 = raw.slice(1, -1);
          return {
            type: "em",
            raw,
            text: text2,
            tokens: this.lexer.inlineTokens(text2)
          };
        }
        const text = raw.slice(2, -2);
        return {
          type: "strong",
          raw,
          text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }
  }
  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      return {
        type: "codespan",
        raw: cap[0],
        text
      };
    }
  }
  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) {
      return {
        type: "br",
        raw: cap[0]
      };
    }
  }
  del(src) {
    const cap = this.rules.inline.del.exec(src);
    if (cap) {
      return {
        type: "del",
        raw: cap[0],
        text: cap[2],
        tokens: this.lexer.inlineTokens(cap[2])
      };
    }
  }
  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[1];
        href = "mailto:" + text;
      } else {
        text = cap[1];
        href = text;
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  url(src) {
    let cap;
    if (cap = this.rules.inline.url.exec(src)) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[0];
        href = "mailto:" + text;
      } else {
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === "www.") {
          href = "http://" + cap[0];
        } else {
          href = cap[0];
        }
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap) {
      const escaped = this.lexer.state.inRawBlock;
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        escaped
      };
    }
  }
};
var _Lexer = class __Lexer {
  tokens;
  options;
  state;
  tokenizer;
  inlineQueue;
  constructor(options2) {
    this.tokens = [];
    this.tokens.links = /* @__PURE__ */ Object.create(null);
    this.options = options2 || _defaults;
    this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      top: true
    };
    const rules = {
      other,
      block: block.normal,
      inline: inline.normal
    };
    if (this.options.pedantic) {
      rules.block = block.pedantic;
      rules.inline = inline.pedantic;
    } else if (this.options.gfm) {
      rules.block = block.gfm;
      if (this.options.breaks) {
        rules.inline = inline.breaks;
      } else {
        rules.inline = inline.gfm;
      }
    }
    this.tokenizer.rules = rules;
  }
  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block,
      inline
    };
  }
  /**
   * Static Lex Method
   */
  static lex(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.lex(src);
  }
  /**
   * Static Lex Inline Method
   */
  static lexInline(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.inlineTokens(src);
  }
  /**
   * Preprocessing
   */
  lex(src) {
    src = src.replace(other.carriageReturn, "\n");
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }
  blockTokens(src, tokens = [], lastParagraphClipped = false) {
    if (this.options.pedantic) {
      src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
    }
    while (src) {
      let token;
      if (this.options.extensions?.block?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.space(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== void 0) {
          lastToken.raw += "\n";
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.code(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.fences(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.heading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.hr(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.blockquote(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.list(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.html(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.def(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.raw;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else if (!this.tokens.links[token.tag]) {
          this.tokens.links[token.tag] = {
            href: token.href,
            title: token.title
          };
        }
        continue;
      }
      if (token = this.tokenizer.table(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.lheading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startBlock) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startBlock.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && lastToken?.type === "paragraph") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = cutSrc.length !== src.length;
        src = src.substring(token.raw.length);
        continue;
      }
      if (token = this.tokenizer.text(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    this.state.top = true;
    return tokens;
  }
  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }
  /**
   * Lexing/Compiling
   */
  inlineTokens(src, tokens = []) {
    let maskedSrc = src;
    let match = null;
    if (this.tokens.links) {
      const links = Object.keys(this.tokens.links);
      if (links.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
          if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
            maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }
    while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    }
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }
    let keepPrevChar = false;
    let prevChar = "";
    while (src) {
      if (!keepPrevChar) {
        prevChar = "";
      }
      keepPrevChar = false;
      let token;
      if (this.options.extensions?.inline?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.escape(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.tag(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.link(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.reflink(src, this.tokens.links)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.type === "text" && lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.codespan(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.br(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.del(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.autolink(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (!this.state.inLink && (token = this.tokenizer.url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startInline.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (token = this.tokenizer.inlineText(cutSrc)) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== "_") {
          prevChar = token.raw.slice(-1);
        }
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    return tokens;
  }
};
var _Renderer = class {
  options;
  parser;
  // set by the parser
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(token) {
    return "";
  }
  code({ text, lang, escaped }) {
    const langString = (lang || "").match(other.notSpaceStart)?.[0];
    const code = text.replace(other.endingNewline, "") + "\n";
    if (!langString) {
      return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
    }
    return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
  }
  blockquote({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote>
${body}</blockquote>
`;
  }
  html({ text }) {
    return text;
  }
  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
  }
  hr(token) {
    return "<hr>\n";
  }
  list(token) {
    const ordered = token.ordered;
    const start = token.start;
    let body = "";
    for (let j = 0; j < token.items.length; j++) {
      const item = token.items[j];
      body += this.listitem(item);
    }
    const type = ordered ? "ol" : "ul";
    const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
    return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
  }
  listitem(item) {
    let itemBody = "";
    if (item.task) {
      const checkbox = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens[0]?.type === "paragraph") {
          item.tokens[0].text = checkbox + " " + item.tokens[0].text;
          if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
            item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
            item.tokens[0].tokens[0].escaped = true;
          }
        } else {
          item.tokens.unshift({
            type: "text",
            raw: checkbox + " ",
            text: checkbox + " ",
            escaped: true
          });
        }
      } else {
        itemBody += checkbox + " ";
      }
    }
    itemBody += this.parser.parse(item.tokens, !!item.loose);
    return `<li>${itemBody}</li>
`;
  }
  checkbox({ checked }) {
    return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>
`;
  }
  table(token) {
    let header = "";
    let cell = "";
    for (let j = 0; j < token.header.length; j++) {
      cell += this.tablecell(token.header[j]);
    }
    header += this.tablerow({ text: cell });
    let body = "";
    for (let j = 0; j < token.rows.length; j++) {
      const row2 = token.rows[j];
      cell = "";
      for (let k = 0; k < row2.length; k++) {
        cell += this.tablecell(row2[k]);
      }
      body += this.tablerow({ text: cell });
    }
    if (body) body = `<tbody>${body}</tbody>`;
    return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
  }
  tablerow({ text }) {
    return `<tr>
${text}</tr>
`;
  }
  tablecell(token) {
    const content = this.parser.parseInline(token.tokens);
    const type = token.header ? "th" : "td";
    const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
    return tag2 + content + `</${type}>
`;
  }
  /**
   * span level renderer
   */
  strong({ tokens }) {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`;
  }
  em({ tokens }) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  }
  codespan({ text }) {
    return `<code>${escape2(text, true)}</code>`;
  }
  br(token) {
    return "<br>";
  }
  del({ tokens }) {
    return `<del>${this.parser.parseInline(tokens)}</del>`;
  }
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return text;
    }
    href = cleanHref;
    let out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + escape2(title) + '"';
    }
    out += ">" + text + "</a>";
    return out;
  }
  image({ href, title, text, tokens }) {
    if (tokens) {
      text = this.parser.parseInline(tokens, this.parser.textRenderer);
    }
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return escape2(text);
    }
    href = cleanHref;
    let out = `<img src="${href}" alt="${text}"`;
    if (title) {
      out += ` title="${escape2(title)}"`;
    }
    out += ">";
    return out;
  }
  text(token) {
    return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
  }
};
var _TextRenderer = class {
  // no need for block level renderers
  strong({ text }) {
    return text;
  }
  em({ text }) {
    return text;
  }
  codespan({ text }) {
    return text;
  }
  del({ text }) {
    return text;
  }
  html({ text }) {
    return text;
  }
  text({ text }) {
    return text;
  }
  link({ text }) {
    return "" + text;
  }
  image({ text }) {
    return "" + text;
  }
  br() {
    return "";
  }
};
var _Parser = class __Parser {
  options;
  renderer;
  textRenderer;
  constructor(options2) {
    this.options = options2 || _defaults;
    this.options.renderer = this.options.renderer || new _Renderer();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new _TextRenderer();
  }
  /**
   * Static Parse Method
   */
  static parse(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parse(tokens);
  }
  /**
   * Static Parse Inline Method
   */
  static parseInline(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parseInline(tokens);
  }
  /**
   * Parse Loop
   */
  parse(tokens, top = true) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const genericToken = anyToken;
        const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
        if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "space": {
          out += this.renderer.space(token);
          continue;
        }
        case "hr": {
          out += this.renderer.hr(token);
          continue;
        }
        case "heading": {
          out += this.renderer.heading(token);
          continue;
        }
        case "code": {
          out += this.renderer.code(token);
          continue;
        }
        case "table": {
          out += this.renderer.table(token);
          continue;
        }
        case "blockquote": {
          out += this.renderer.blockquote(token);
          continue;
        }
        case "list": {
          out += this.renderer.list(token);
          continue;
        }
        case "html": {
          out += this.renderer.html(token);
          continue;
        }
        case "paragraph": {
          out += this.renderer.paragraph(token);
          continue;
        }
        case "text": {
          let textToken = token;
          let body = this.renderer.text(textToken);
          while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
            textToken = tokens[++i];
            body += "\n" + this.renderer.text(textToken);
          }
          if (top) {
            out += this.renderer.paragraph({
              type: "paragraph",
              raw: body,
              text: body,
              tokens: [{ type: "text", raw: body, text: body, escaped: true }]
            });
          } else {
            out += body;
          }
          continue;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
  /**
   * Parse Inline Tokens
   */
  parseInline(tokens, renderer = this.renderer) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
        if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "escape": {
          out += renderer.text(token);
          break;
        }
        case "html": {
          out += renderer.html(token);
          break;
        }
        case "link": {
          out += renderer.link(token);
          break;
        }
        case "image": {
          out += renderer.image(token);
          break;
        }
        case "strong": {
          out += renderer.strong(token);
          break;
        }
        case "em": {
          out += renderer.em(token);
          break;
        }
        case "codespan": {
          out += renderer.codespan(token);
          break;
        }
        case "br": {
          out += renderer.br(token);
          break;
        }
        case "del": {
          out += renderer.del(token);
          break;
        }
        case "text": {
          out += renderer.text(token);
          break;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
};
var _Hooks = class {
  options;
  block;
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  static passThroughHooks = /* @__PURE__ */ new Set([
    "preprocess",
    "postprocess",
    "processAllTokens"
  ]);
  /**
   * Process markdown before marked
   */
  preprocess(markdown) {
    return markdown;
  }
  /**
   * Process HTML after marked is finished
   */
  postprocess(html2) {
    return html2;
  }
  /**
   * Process all tokens before walk tokens
   */
  processAllTokens(tokens) {
    return tokens;
  }
  /**
   * Provide function to tokenize markdown
   */
  provideLexer() {
    return this.block ? _Lexer.lex : _Lexer.lexInline;
  }
  /**
   * Provide function to parse tokens
   */
  provideParser() {
    return this.block ? _Parser.parse : _Parser.parseInline;
  }
};
var Marked = class {
  defaults = _getDefaults();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = _Parser;
  Renderer = _Renderer;
  TextRenderer = _TextRenderer;
  Lexer = _Lexer;
  Tokenizer = _Tokenizer;
  Hooks = _Hooks;
  constructor(...args) {
    this.use(...args);
  }
  /**
   * Run callback for every token
   */
  walkTokens(tokens, callback) {
    let values = [];
    for (const token of tokens) {
      values = values.concat(callback.call(this, token));
      switch (token.type) {
        case "table": {
          const tableToken = token;
          for (const cell of tableToken.header) {
            values = values.concat(this.walkTokens(cell.tokens, callback));
          }
          for (const row2 of tableToken.rows) {
            for (const cell of row2) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
          }
          break;
        }
        case "list": {
          const listToken = token;
          values = values.concat(this.walkTokens(listToken.items, callback));
          break;
        }
        default: {
          const genericToken = token;
          if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
            this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
              const tokens2 = genericToken[childTokens].flat(Infinity);
              values = values.concat(this.walkTokens(tokens2, callback));
            });
          } else if (genericToken.tokens) {
            values = values.concat(this.walkTokens(genericToken.tokens, callback));
          }
        }
      }
    }
    return values;
  }
  use(...args) {
    const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
    args.forEach((pack) => {
      const opts = { ...pack };
      opts.async = this.defaults.async || opts.async || false;
      if (pack.extensions) {
        pack.extensions.forEach((ext) => {
          if (!ext.name) {
            throw new Error("extension name required");
          }
          if ("renderer" in ext) {
            const prevRenderer = extensions.renderers[ext.name];
            if (prevRenderer) {
              extensions.renderers[ext.name] = function(...args2) {
                let ret = ext.renderer.apply(this, args2);
                if (ret === false) {
                  ret = prevRenderer.apply(this, args2);
                }
                return ret;
              };
            } else {
              extensions.renderers[ext.name] = ext.renderer;
            }
          }
          if ("tokenizer" in ext) {
            if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
              throw new Error("extension level must be 'block' or 'inline'");
            }
            const extLevel = extensions[ext.level];
            if (extLevel) {
              extLevel.unshift(ext.tokenizer);
            } else {
              extensions[ext.level] = [ext.tokenizer];
            }
            if (ext.start) {
              if (ext.level === "block") {
                if (extensions.startBlock) {
                  extensions.startBlock.push(ext.start);
                } else {
                  extensions.startBlock = [ext.start];
                }
              } else if (ext.level === "inline") {
                if (extensions.startInline) {
                  extensions.startInline.push(ext.start);
                } else {
                  extensions.startInline = [ext.start];
                }
              }
            }
          }
          if ("childTokens" in ext && ext.childTokens) {
            extensions.childTokens[ext.name] = ext.childTokens;
          }
        });
        opts.extensions = extensions;
      }
      if (pack.renderer) {
        const renderer = this.defaults.renderer || new _Renderer(this.defaults);
        for (const prop in pack.renderer) {
          if (!(prop in renderer)) {
            throw new Error(`renderer '${prop}' does not exist`);
          }
          if (["options", "parser"].includes(prop)) {
            continue;
          }
          const rendererProp = prop;
          const rendererFunc = pack.renderer[rendererProp];
          const prevRenderer = renderer[rendererProp];
          renderer[rendererProp] = (...args2) => {
            let ret = rendererFunc.apply(renderer, args2);
            if (ret === false) {
              ret = prevRenderer.apply(renderer, args2);
            }
            return ret || "";
          };
        }
        opts.renderer = renderer;
      }
      if (pack.tokenizer) {
        const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
        for (const prop in pack.tokenizer) {
          if (!(prop in tokenizer)) {
            throw new Error(`tokenizer '${prop}' does not exist`);
          }
          if (["options", "rules", "lexer"].includes(prop)) {
            continue;
          }
          const tokenizerProp = prop;
          const tokenizerFunc = pack.tokenizer[tokenizerProp];
          const prevTokenizer = tokenizer[tokenizerProp];
          tokenizer[tokenizerProp] = (...args2) => {
            let ret = tokenizerFunc.apply(tokenizer, args2);
            if (ret === false) {
              ret = prevTokenizer.apply(tokenizer, args2);
            }
            return ret;
          };
        }
        opts.tokenizer = tokenizer;
      }
      if (pack.hooks) {
        const hooks2 = this.defaults.hooks || new _Hooks();
        for (const prop in pack.hooks) {
          if (!(prop in hooks2)) {
            throw new Error(`hook '${prop}' does not exist`);
          }
          if (["options", "block"].includes(prop)) {
            continue;
          }
          const hooksProp = prop;
          const hooksFunc = pack.hooks[hooksProp];
          const prevHook = hooks2[hooksProp];
          if (_Hooks.passThroughHooks.has(prop)) {
            hooks2[hooksProp] = (arg) => {
              if (this.defaults.async) {
                return Promise.resolve(hooksFunc.call(hooks2, arg)).then((ret2) => {
                  return prevHook.call(hooks2, ret2);
                });
              }
              const ret = hooksFunc.call(hooks2, arg);
              return prevHook.call(hooks2, ret);
            };
          } else {
            hooks2[hooksProp] = (...args2) => {
              let ret = hooksFunc.apply(hooks2, args2);
              if (ret === false) {
                ret = prevHook.apply(hooks2, args2);
              }
              return ret;
            };
          }
        }
        opts.hooks = hooks2;
      }
      if (pack.walkTokens) {
        const walkTokens2 = this.defaults.walkTokens;
        const packWalktokens = pack.walkTokens;
        opts.walkTokens = function(token) {
          let values = [];
          values.push(packWalktokens.call(this, token));
          if (walkTokens2) {
            values = values.concat(walkTokens2.call(this, token));
          }
          return values;
        };
      }
      this.defaults = { ...this.defaults, ...opts };
    });
    return this;
  }
  setOptions(opt) {
    this.defaults = { ...this.defaults, ...opt };
    return this;
  }
  lexer(src, options2) {
    return _Lexer.lex(src, options2 ?? this.defaults);
  }
  parser(tokens, options2) {
    return _Parser.parse(tokens, options2 ?? this.defaults);
  }
  parseMarkdown(blockType) {
    const parse2 = (src, options2) => {
      const origOpt = { ...options2 };
      const opt = { ...this.defaults, ...origOpt };
      const throwError = this.onError(!!opt.silent, !!opt.async);
      if (this.defaults.async === true && origOpt.async === false) {
        return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      }
      if (typeof src === "undefined" || src === null) {
        return throwError(new Error("marked(): input parameter is undefined or null"));
      }
      if (typeof src !== "string") {
        return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
      }
      if (opt.hooks) {
        opt.hooks.options = opt;
        opt.hooks.block = blockType;
      }
      const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
      const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
      if (opt.async) {
        return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html2) => opt.hooks ? opt.hooks.postprocess(html2) : html2).catch(throwError);
      }
      try {
        if (opt.hooks) {
          src = opt.hooks.preprocess(src);
        }
        let tokens = lexer2(src, opt);
        if (opt.hooks) {
          tokens = opt.hooks.processAllTokens(tokens);
        }
        if (opt.walkTokens) {
          this.walkTokens(tokens, opt.walkTokens);
        }
        let html2 = parser2(tokens, opt);
        if (opt.hooks) {
          html2 = opt.hooks.postprocess(html2);
        }
        return html2;
      } catch (e) {
        return throwError(e);
      }
    };
    return parse2;
  }
  onError(silent, async) {
    return (e) => {
      e.message += "\nPlease report this to https://github.com/markedjs/marked.";
      if (silent) {
        const msg = "<p>An error occurred:</p><pre>" + escape2(e.message + "", true) + "</pre>";
        if (async) {
          return Promise.resolve(msg);
        }
        return msg;
      }
      if (async) {
        return Promise.reject(e);
      }
      throw e;
    };
  }
};
var markedInstance = new Marked();
function marked(src, opt) {
  return markedInstance.parse(src, opt);
}
marked.options = marked.setOptions = function(options2) {
  markedInstance.setOptions(options2);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.getDefaults = _getDefaults;
marked.defaults = _defaults;
marked.use = function(...args) {
  markedInstance.use(...args);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.walkTokens = function(tokens, callback) {
  return markedInstance.walkTokens(tokens, callback);
};
marked.parseInline = markedInstance.parseInline;
marked.Parser = _Parser;
marked.parser = _Parser.parse;
marked.Renderer = _Renderer;
marked.TextRenderer = _TextRenderer;
marked.Lexer = _Lexer;
marked.lexer = _Lexer.lex;
marked.Tokenizer = _Tokenizer;
marked.Hooks = _Hooks;
marked.parse = marked;
var options = marked.options;
var setOptions = marked.setOptions;
var use = marked.use;
var walkTokens = marked.walkTokens;
var parseInline = marked.parseInline;
var parser = _Parser.parse;
var lexer = _Lexer.lex;

// src/cli/ui/html-entities.ts
var NAMED = {
  quot: '"',
  apos: "'",
  amp: "&",
  lt: "<",
  gt: ">",
  nbsp: "\xA0"
};
var ENTITY_RE = /&(?:#x([0-9A-Fa-f]+)|#(\d+)|([a-zA-Z]+));/g;
function decodeHtmlEntities(text) {
  if (text.indexOf("&") === -1) return text;
  return text.replace(
    ENTITY_RE,
    (match, hex, dec, name) => {
      if (hex !== void 0) {
        const code = Number.parseInt(hex, 16);
        return Number.isFinite(code) && code > 0 ? safeFromCodePoint(code, match) : match;
      }
      if (dec !== void 0) {
        const code = Number.parseInt(dec, 10);
        return Number.isFinite(code) && code > 0 ? safeFromCodePoint(code, match) : match;
      }
      if (name !== void 0) {
        const lower = name.toLowerCase();
        return Object.hasOwn(NAMED, lower) ? NAMED[lower] : match;
      }
      return match;
    }
  );
}
function safeFromCodePoint(code, fallback) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}

// src/cli/ui/markdown-lines.ts
var FILE_REF_RE = /\b([A-Za-z0-9_./@\-]+\.[A-Za-z0-9]{1,6})(?::(\d+)(?:-(\d+))?)?\b/g;
marked.use({ gfm: true, breaks: false });
function markdownToLines(text) {
  if (text.length === 0) return [];
  const tokens = marked.lexer(text);
  const out = [];
  for (const tok of tokens) emitBlock(tok, out, 0);
  return out;
}
function emitBlock(tok, out, depth) {
  switch (tok.type) {
    case "heading": {
      const h = tok;
      out.push({ kind: "heading", level: h.depth, spans: inline2(h.tokens ?? []) });
      return;
    }
    case "paragraph": {
      const p = tok;
      out.push({ kind: "paragraph", spans: inline2(p.tokens ?? []) });
      return;
    }
    case "code": {
      const c = tok;
      out.push({
        kind: "code",
        lang: (c.lang ?? "").split(/\s+/)[0] ?? "",
        text: decodeHtmlEntities(c.text)
      });
      return;
    }
    case "list": {
      const l = tok;
      const startIndex = Number(l.start) || 1;
      l.items.forEach((item, i) => emitListItem(item, out, l.ordered, startIndex + i, depth));
      return;
    }
    case "hr":
      out.push({ kind: "hr" });
      return;
    case "blockquote": {
      const bq = tok;
      for (const child of bq.tokens ?? []) {
        if (child.type === "paragraph") {
          out.push({ kind: "blockquote", spans: inline2(child.tokens ?? []) });
        } else if (child.type === "space") {
        } else {
          const flat = plainTokens(child);
          if (flat.length > 0) out.push({ kind: "blockquote", spans: [{ text: flat }] });
        }
      }
      return;
    }
    case "space":
      out.push({ kind: "blank" });
      return;
    case "html": {
      const h = tok;
      out.push({ kind: "paragraph", spans: [{ text: h.text }] });
      return;
    }
    default: {
      const raw = tok.raw ?? "";
      if (raw.trim().length > 0) out.push({ kind: "paragraph", spans: [{ text: raw }] });
    }
  }
}
function emitListItem(item, out, ordered, index, depth) {
  const task = item.task ? item.checked ? "done" : "todo" : void 0;
  const head = {
    kind: "list",
    ordered,
    index,
    depth,
    spans: [],
    ...task ? { task } : {}
  };
  out.push(head);
  for (const tok of item.tokens) {
    if (tok.type === "text") {
      const t2 = tok;
      const spans = t2.tokens ? inline2(t2.tokens) : inlineFromText(t2.text);
      head.spans.push(...spans);
    } else if (tok.type === "list") {
      const sub = tok;
      const subStart = Number(sub.start) || 1;
      sub.items.forEach((s, i) => emitListItem(s, out, sub.ordered, subStart + i, depth + 1));
    } else {
      emitBlock(tok, out, depth);
    }
  }
}
function inline2(tokens) {
  const out = [];
  walk(tokens, {}, out);
  return mergeAdjacent(out);
}
function walk(tokens, style, out) {
  for (const tok of tokens) {
    switch (tok.type) {
      case "text": {
        const t2 = tok;
        if (t2.tokens && t2.tokens.length > 0) walk(t2.tokens, style, out);
        else pushTextSpans(t2.text, style, out);
        break;
      }
      case "strong":
        walk(tok.tokens, { ...style, bold: true }, out);
        break;
      case "em":
        walk(tok.tokens, { ...style, italic: true }, out);
        break;
      case "del":
        walk(tok.tokens, { ...style, strike: true }, out);
        break;
      case "codespan":
        out.push({ text: decodeHtmlEntities(tok.text), code: true, ...style });
        break;
      case "link": {
        const l = tok;
        const before = out.length;
        walk(l.tokens, style, out);
        for (let i = before; i < out.length; i++) {
          const span = out[i];
          if (!span.link) span.link = l.href;
        }
        break;
      }
      case "image": {
        const im = tok;
        out.push({ text: `[image: ${im.text || im.href}]`, ...style });
        break;
      }
      case "br":
        out.push({ text: "\n", ...style });
        break;
      case "escape":
        pushTextSpans(tok.text, style, out);
        break;
      case "html":
        pushTextSpans(tok.text, style, out);
        break;
      default:
        pushTextSpans(tok.raw ?? "", style, out);
    }
  }
}
function pushTextSpans(text, style, out) {
  if (text.length === 0) return;
  let cursor = 0;
  for (const m of text.matchAll(FILE_REF_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (start > cursor) out.push({ text: text.slice(cursor, start), ...style });
    const path = m[1];
    const ln = m[2] ? Number(m[2]) : void 0;
    const lnEnd = m[3] ? Number(m[3]) : void 0;
    out.push({
      text: m[0],
      ...style,
      fileRef: {
        path,
        ...ln !== void 0 ? { line: ln } : {},
        ...lnEnd !== void 0 ? { lineEnd: lnEnd } : {}
      }
    });
    cursor = end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), ...style });
}
function inlineFromText(text) {
  const out = [];
  pushTextSpans(text, {}, out);
  return out;
}
function mergeAdjacent(spans) {
  if (spans.length < 2) return spans;
  const out = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && stylesEqual(last, s)) {
      out[out.length - 1] = { ...last, text: last.text + s.text };
    } else {
      out.push(s);
    }
  }
  return out;
}
function stylesEqual(a, b) {
  return !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.strike === !!b.strike && !!a.code === !!b.code && a.link === b.link && fileRefEqual(a.fileRef, b.fileRef);
}
function fileRefEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.path === b.path && a.line === b.line && a.lineEnd === b.lineEnd;
}
function plainTokens(tok) {
  if ("raw" in tok && typeof tok.raw === "string") {
    return tok.raw.trim();
  }
  return "";
}

// src/cli/ui/markdown-view.tsx
var FG_BODY = "#c9d1d9";
var FG_FAINT = "#6e7681";
var FG_STRONG = "#f0f6fc";
var FG_META = "#8b949e";
var TONE_BRAND = "#79c0ff";
var TONE_OK = "#7ee787";
var SURFACE_ELEV = "#161b22";
function MarkdownView({ text }) {
  return /* @__PURE__ */ React19.createElement(MarkdownLines, { lines: markdownToLines(text) });
}
function MarkdownLines({
  lines
}) {
  return /* @__PURE__ */ React19.createElement(Box16, { flexDirection: "column" }, lines.map((line, i) => /* @__PURE__ */ React19.createElement(LineRow, { key: `md-${i}-${line.kind}`, line })));
}
function LineRow({ line }) {
  switch (line.kind) {
    case "blank":
      return /* @__PURE__ */ React19.createElement(Text16, null, " ");
    case "hr":
      return /* @__PURE__ */ React19.createElement(Text16, { color: FG_FAINT }, "\u2500\u2500\u2500\u2500\u2500\u2500");
    case "heading":
      return /* @__PURE__ */ React19.createElement(Box16, null, /* @__PURE__ */ React19.createElement(Text16, { bold: true, color: FG_STRONG }, `${"#".repeat(line.level)} `), /* @__PURE__ */ React19.createElement(Spans, { spans: line.spans, bold: true, strongColor: true }));
    case "paragraph":
      return /* @__PURE__ */ React19.createElement(Box16, null, /* @__PURE__ */ React19.createElement(Spans, { spans: line.spans }));
    case "list": {
      const indent = " ".repeat(line.depth * 2);
      const marker = line.task === "done" ? "\u2713" : line.task === "todo" ? "\u25CB" : line.ordered ? `${line.index}.` : "\xB7";
      const markerColor = line.task === "done" ? TONE_OK : line.task === "todo" ? FG_FAINT : FG_META;
      return /* @__PURE__ */ React19.createElement(Box16, null, /* @__PURE__ */ React19.createElement(Text16, { color: markerColor }, `${indent}${marker} `), /* @__PURE__ */ React19.createElement(Spans, { spans: line.spans, dim: line.task === "done", strike: line.task === "done" }));
    }
    case "code":
      return /* @__PURE__ */ React19.createElement(CodeBlock, { lang: line.lang, text: line.text });
    case "blockquote":
      return /* @__PURE__ */ React19.createElement(Box16, null, /* @__PURE__ */ React19.createElement(Text16, { color: TONE_BRAND }, "\u258E "), /* @__PURE__ */ React19.createElement(Spans, { spans: line.spans, italic: true }));
  }
}
function spanKey(span, i) {
  return `${i}-${span.text.length}-${span.bold ? "b" : ""}${span.italic ? "i" : ""}${span.code ? "c" : ""}${span.strike ? "s" : ""}${span.link ? "l" : ""}`;
}
function CodeBlock({ lang, text }) {
  const lines = text.split("\n");
  return /* @__PURE__ */ React19.createElement(Box16, { flexDirection: "column" }, lang.length > 0 ? /* @__PURE__ */ React19.createElement(Text16, { color: FG_META }, ` ${lang}`) : null, lines.map((ln, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: code lines are positional + stable per render
    /* @__PURE__ */ React19.createElement(Text16, { key: `code-${i}`, backgroundColor: SURFACE_ELEV }, ` ${ln} `)
  )));
}
function Spans({ spans, bold, italic, dim, strike, strongColor }) {
  if (spans.length === 0) return /* @__PURE__ */ React19.createElement(Text16, null, " ");
  return /* @__PURE__ */ React19.createElement(React19.Fragment, null, spans.map((span, i) => /* @__PURE__ */ React19.createElement(
    SpanText,
    {
      key: spanKey(span, i),
      span,
      ambientBold: bold,
      ambientItalic: italic,
      ambientDim: dim,
      ambientStrike: strike,
      strongColor
    }
  )));
}
function SpanText({
  span,
  ambientBold,
  ambientItalic,
  ambientDim,
  ambientStrike,
  strongColor
}) {
  if (span.code) {
    return /* @__PURE__ */ React19.createElement(Text16, { color: FG_STRONG, backgroundColor: SURFACE_ELEV }, ` ${span.text} `);
  }
  const color = span.fileRef ? TONE_BRAND : span.link ? TONE_BRAND : strongColor ? FG_STRONG : FG_BODY;
  const inner = /* @__PURE__ */ React19.createElement(
    Text16,
    {
      color,
      bold: !!(span.bold || ambientBold),
      italic: !!(span.italic || ambientItalic),
      dimColor: !!ambientDim,
      strikethrough: !!(span.strike || ambientStrike),
      underline: !!(span.link || span.fileRef)
    },
    span.text
  );
  const target = linkTarget(span);
  if (!target) return inner;
  return /* @__PURE__ */ React19.createElement(Transform, { transform: (text) => `\x1B]8;;${target}\x1B\\${text}\x1B]8;;\x1B\\` }, inner);
}
function linkTarget(span) {
  if (span.link) return span.link;
  if (span.fileRef) {
    const { path, line } = span.fileRef;
    return line ? `file://${path}:${line}` : `file://${path}`;
  }
  return null;
}

// src/cli/ui/plan-open-questions.ts
var HEADER_RE = /^(#{1,6})\s*(open[-\s]?questions?|risks?|unknowns?|assumptions?|unclear|待确认|开放问题|风险|未知|假设|不确定)(?:[\s:：/、,，].*)?$/im;
function extractOpenQuestionsSection(plan2) {
  const lines = plan2.split("\n");
  let startIdx = -1;
  let startLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = line.match(HEADER_RE);
    if (m) {
      startIdx = i;
      startLevel = (m[1] ?? "#").length;
      break;
    }
  }
  if (startIdx === -1) return null;
  let endIdx = lines.length;
  for (let j = startIdx + 1; j < lines.length; j++) {
    const line = lines[j] ?? "";
    const lh = line.match(/^(#{1,6})\s+\S/);
    if (lh && (lh[1] ?? "").length <= startLevel) {
      endIdx = j;
      break;
    }
  }
  const block2 = lines.slice(startIdx, endIdx).join("\n").replace(/\s+$/g, "");
  return block2.length > 0 ? block2 : null;
}

// src/cli/ui/PlanConfirm.tsx
var DEFAULT_DETAIL_LINES = 12;
var MIN_DETAIL_LINES = 6;
var EXPANDED_MODAL_OVERHEAD_ROWS = 12;
var EXPANDED_DETAIL_CHROME_ROWS = 4;
function PlanConfirmInner({ plan: plan2, steps, summary, onChoose }) {
  const { stdout } = useStdout6();
  const totalRows = useTotalRows();
  const [expanded, setExpanded] = useState10(false);
  const [detailOffset, setDetailOffset] = useState10(0);
  const stepRows = steps?.length ?? 0;
  const hasSteps = stepRows > 0;
  const openQuestions = extractOpenQuestionsSection(plan2);
  const planLines = useMemo5(() => plan2.split("\n"), [plan2]);
  const effectiveSummary = useMemo5(
    () => summarizePlan(plan2, summary, steps),
    [plan2, summary, steps]
  );
  const oqRows = openQuestions ? Math.min(openQuestions.split("\n").length, 8) : 0;
  const modalRows = useReserveRows("modal", {
    min: 10,
    max: expanded ? Math.max(10, totalRows - EXPANDED_DETAIL_CHROME_ROWS) : Math.max(16, Math.min(32, (hasSteps ? stepRows + 2 : 2) + oqRows + 14))
  });
  const detailViewRows = expanded ? Math.max(10, modalRows - EXPANDED_MODAL_OVERHEAD_ROWS) : Math.max(
    MIN_DETAIL_LINES,
    Math.min(18, Math.floor(((stdout?.rows ?? 32) - 14) / 2) || DEFAULT_DETAIL_LINES)
  );
  const maxDetailOffset = Math.max(0, planLines.length - detailViewRows);
  const clampedDetailOffset = Math.min(detailOffset, maxDetailOffset);
  const rawSliceStart = clampedDetailOffset;
  const rawSliceEnd = Math.min(planLines.length, rawSliceStart + detailViewRows);
  const { displayStart, displayEnd } = (() => {
    let start = rawSliceStart;
    let end = rawSliceEnd;
    while (start < end && planLines[start]?.trim() === "" && end < planLines.length) {
      start += 1;
      end += 1;
    }
    return { displayStart: start, displayEnd: end };
  })();
  const visiblePlanLines = planLines.slice(displayStart, displayEnd);
  const detailOverflow = planLines.length > detailViewRows;
  const showDetailScrollHint = expanded && plan2.trim().length > 0 && detailOverflow;
  const detailOwnsScrollKey = expanded && detailOverflow;
  const isDetailScrollKey = (ev) => detailOwnsScrollKey && !!(ev.pageUp || ev.pageDown || ev.home || ev.end || ev.mouseScrollUp || ev.mouseScrollDown || ev.upArrow || ev.downArrow);
  useKeystroke((ev) => {
    if (ev.paste) return;
    if (ev.ctrl && ev.input === "p") {
      setExpanded((v) => !v);
      return;
    }
    if (!isDetailScrollKey(ev)) return;
    if (ev.pageUp || ev.mouseScrollUp) {
      setDetailOffset((n) => Math.max(0, n - detailViewRows));
    } else if (ev.pageDown || ev.mouseScrollDown) {
      setDetailOffset((n) => Math.min(maxDetailOffset, n + detailViewRows));
    } else if (ev.home) {
      setDetailOffset(0);
    } else if (ev.end) {
      setDetailOffset(maxDetailOffset);
    } else if (ev.upArrow) {
      setDetailOffset((n) => Math.max(0, n - 1));
    } else if (ev.downArrow) {
      setDetailOffset((n) => Math.min(maxDetailOffset, n + 1));
    }
  });
  const refineLabel = t("planFlow.picker.refine");
  const bannerTemplate = t("planFlow.openQuestionsBanner");
  const [bannerBefore, bannerAfter] = bannerTemplate.split("{refine}");
  return /* @__PURE__ */ React20.createElement(
    ApprovalCard,
    {
      tone: "accent",
      glyph: "\u229E",
      title: t("planFlow.approveCardTitle"),
      metaRight: t("planFlow.approveCardMetaRight"),
      metaRightColor: CARD.plan.color
    },
    openQuestions ? /* @__PURE__ */ React20.createElement(Box17, { marginBottom: 1, flexDirection: "column" }, /* @__PURE__ */ React20.createElement(Text17, { color: TONE.warn }, bannerBefore ?? "", /* @__PURE__ */ React20.createElement(Text17, { bold: true }, refineLabel), bannerAfter ?? ""), /* @__PURE__ */ React20.createElement(Box17, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React20.createElement(Text17, { color: TONE.warn, bold: true }, t("planFlow.openQuestionsHeader")), /* @__PURE__ */ React20.createElement(MarkdownView, { text: openQuestions }))) : null,
    !expanded || plan2.trim().length === 0 ? /* @__PURE__ */ React20.createElement(Box17, { marginBottom: 1, flexDirection: "column" }, effectiveSummary ? /* @__PURE__ */ React20.createElement(Text17, { color: FG.body }, effectiveSummary) : /* @__PURE__ */ React20.createElement(Text17, { color: FG.faint }, t("planFlow.noPlanSummary")), !expanded && hasSteps ? /* @__PURE__ */ React20.createElement(Box17, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React20.createElement(PlanStepList, { steps })) : null, /* @__PURE__ */ React20.createElement(Text17, { color: FG.faint }, expanded ? t("planFlow.detailExpandedHint") : t("planFlow.detailCollapsedHint"))) : null,
    expanded && plan2.trim().length > 0 ? /* @__PURE__ */ React20.createElement(
      PlanDetailWindow,
      {
        lines: visiblePlanLines,
        overflow: detailOverflow,
        start: displayStart + 1,
        end: displayEnd,
        total: planLines.length
      }
    ) : null,
    showDetailScrollHint ? /* @__PURE__ */ React20.createElement(Box17, { marginBottom: 1 }, /* @__PURE__ */ React20.createElement(Text17, { color: FG.faint }, t("planFlow.detailScrollHint"))) : null,
    /* @__PURE__ */ React20.createElement(
      SingleSelect,
      {
        initialValue: openQuestions ? "refine" : "approve",
        items: [
          {
            value: "approve",
            label: t("planFlow.picker.accept"),
            hint: t("planFlow.picker.acceptHint")
          },
          {
            value: "refine",
            label: refineLabel,
            hint: t("planFlow.picker.refineHint")
          },
          {
            value: "revise",
            label: t("planFlow.picker.revise"),
            hint: t("planFlow.picker.reviseHint")
          },
          {
            value: "cancel",
            label: t("planFlow.picker.reject"),
            hint: t("planFlow.picker.rejectHint")
          }
        ],
        onSubmit: (v) => onChoose(v),
        onCancel: () => onChoose("cancel"),
        inlineHints: true,
        ignoreKey: isDetailScrollKey
      }
    )
  );
}
function PlanDetailWindow({
  lines,
  overflow,
  start,
  end,
  total
}) {
  return /* @__PURE__ */ React20.createElement(Box17, { flexDirection: "column" }, overflow ? /* @__PURE__ */ React20.createElement(Text17, { color: FG.faint }, t("planFlow.detailWindow", { start, end, total })) : null, lines.map((line, i) => /* @__PURE__ */ React20.createElement(Text17, { key: `plan-detail-${start + i}`, wrap: "truncate" }, line.length > 0 ? line : " ")));
}
function summarizePlan(plan2, summary, steps) {
  const trimmedSummary = summary?.trim();
  if (trimmedSummary) return trimmedSummary;
  const firstTextLine = plan2.split("\n").map((line) => line.trim()).find((line) => line.length > 0 && !/^#{1,6}\s*$/.test(line));
  if (firstTextLine) return firstTextLine.replace(/^#{1,6}\s+/, "").slice(0, 160);
  if (steps && steps.length > 0) return steps[0]?.title ?? "";
  return "";
}
var PlanConfirm = React20.memo(PlanConfirmInner);

// src/cli/ui/PlanRefineInput.tsx
import { Box as Box18, Text as Text18 } from "ink";
import React22, { useState as useState12 } from "react";

// src/cli/ui/ticker.tsx
import { useAnimation } from "ink";
import React21, { createContext as createContext2, useContext as useContext2, useState as useState11 } from "react";
var FAST_TICK_MS = 120;
var SLOW_TICK_MS = 1e3;
var TickerActiveContext = createContext2(true);
function TickerProvider({ children, disabled }) {
  return /* @__PURE__ */ React21.createElement(TickerActiveContext.Provider, { value: !disabled }, children);
}
function useTickerActive() {
  return useContext2(TickerActiveContext);
}
function useTick() {
  const isActive = useTickerActive();
  return useAnimation({ interval: FAST_TICK_MS, isActive }).frame;
}
function useSlowTick() {
  const isActive = useTickerActive();
  return useAnimation({ interval: SLOW_TICK_MS, isActive }).frame;
}
function useCursorBlink() {
  const isActive = useTickerActive();
  const tick = useSlowTick();
  return !isActive || tick % 2 === 0;
}
function useElapsedSeconds() {
  const [start] = useState11(() => Date.now());
  useSlowTick();
  return Math.floor((Date.now() - start) / 1e3);
}

// src/cli/ui/PlanRefineInput.tsx
var MODE_VISUALS = {
  approve: { glyph: "\u25C7", tone: "user", cursorColor: CARD.user.color },
  refine: { glyph: "\u270E", tone: "warn", cursorColor: CARD.warn.color },
  reject: { glyph: "\u2717", tone: "error", cursorColor: CARD.error.color },
  "checkpoint-revise": { glyph: "\u270E", tone: "warn", cursorColor: CARD.warn.color },
  "choice-custom": { glyph: "\u2325", tone: "accent", cursorColor: CARD.plan.color }
};
function modeMeta(mode2) {
  const v = MODE_VISUALS[mode2];
  return {
    title: t(`planFlow.modes.${mode2}.title`),
    hint: t(`planFlow.modes.${mode2}.hint`),
    blankHint: t(`planFlow.modes.${mode2}.blankHint`),
    glyph: v.glyph,
    tone: v.tone,
    cursorColor: v.cursorColor
  };
}
function PlanRefineInput({ mode: mode2, questions, onSubmit, onCancel }) {
  const [value, setValue] = useState12("");
  useKeystroke((ev) => {
    if (ev.paste) {
      setValue((v) => v + ev.input.replace(/\r?\n/g, " "));
      return;
    }
    if (ev.escape) {
      onCancel();
      return;
    }
    if (ev.return) {
      onSubmit(value.trim());
      return;
    }
    if (ev.backspace || ev.delete) {
      setValue((v) => v.slice(0, -1));
      return;
    }
    if (ev.input && !ev.ctrl && !ev.meta) {
      setValue((v) => v + ev.input);
    }
  });
  const tick = useTick();
  const cursorOn = Math.floor(tick / 4) % 2 === 0;
  const meta = modeMeta(mode2);
  const showQuestions = mode2 === "refine" && !!questions && questions.trim().length > 0;
  return /* @__PURE__ */ React22.createElement(
    ApprovalCard,
    {
      tone: meta.tone,
      glyph: meta.glyph,
      title: meta.title,
      footerHint: t("planFlow.refineFooter")
    },
    showQuestions ? /* @__PURE__ */ React22.createElement(Box18, { marginBottom: 1, flexDirection: "column" }, /* @__PURE__ */ React22.createElement(Text18, { color: TONE.warn, bold: true }, t("planFlow.refineQuestionsHeading")), /* @__PURE__ */ React22.createElement(MarkdownView, { text: questions })) : null,
    /* @__PURE__ */ React22.createElement(Box18, { marginBottom: 1 }, /* @__PURE__ */ React22.createElement(Text18, { color: FG.sub }, meta.hint, value === "" ? meta.blankHint : "")),
    /* @__PURE__ */ React22.createElement(Box18, null, /* @__PURE__ */ React22.createElement(Text18, { color: meta.cursorColor, bold: true }, "\u203A "), /* @__PURE__ */ React22.createElement(Text18, null, value), /* @__PURE__ */ React22.createElement(Text18, { color: meta.cursorColor, bold: true }, cursorOn ? "\u258D" : " "))
  );
}

// src/cli/ui/PlanReviseConfirm.tsx
import { Box as Box19, Text as Text19 } from "ink";
import React23 from "react";
function computeDiff(oldSteps, newSteps) {
  const oldIds = new Set(oldSteps.map((s) => s.id));
  const newIds = new Set(newSteps.map((s) => s.id));
  const rows = [];
  for (const s of oldSteps) {
    if (!newIds.has(s.id)) rows.push({ kind: "removed", step: s });
  }
  for (const s of newSteps) {
    rows.push({ kind: oldIds.has(s.id) ? "kept" : "added", step: s });
  }
  return rows;
}
function riskDots(risk) {
  switch (risk) {
    case "high":
      return { dots: "\u25CF\u25CF\u25CF", color: "#f87171" };
    case "med":
      return { dots: "\u25CF\u25CF ", color: "#fbbf24" };
    case "low":
      return { dots: "\u25CF  ", color: "#4ade80" };
    default:
      return { dots: "   ", color: "#94a3b8" };
  }
}
function PlanReviseConfirmInner({
  reason,
  oldRemaining,
  newRemaining,
  summary,
  onChoose
}) {
  const rows = computeDiff(oldRemaining, newRemaining);
  const removedCount = rows.filter((r) => r.kind === "removed").length;
  const addedCount = rows.filter((r) => r.kind === "added").length;
  const keptCount = rows.filter((r) => r.kind === "kept").length;
  return /* @__PURE__ */ React23.createElement(
    ApprovalCard,
    {
      tone: "warn",
      glyph: "\\u270f",
      title: t("planReviseConfirm.title"),
      metaRight: t("planReviseConfirm.metaRight", {
        removed: removedCount,
        added: addedCount,
        kept: keptCount
      })
    },
    /* @__PURE__ */ React23.createElement(Box19, { marginBottom: 1 }, /* @__PURE__ */ React23.createElement(Text19, null, reason)),
    summary ? /* @__PURE__ */ React23.createElement(Box19, { marginBottom: 1 }, /* @__PURE__ */ React23.createElement(Text19, { dimColor: true }, t("planReviseConfirm.updatedSummary", { summary }))) : null,
    /* @__PURE__ */ React23.createElement(Box19, { marginBottom: 1, flexDirection: "column" }, rows.map((row2) => {
      const risk = riskDots(row2.step.risk);
      const prefix = row2.kind === "removed" ? "\u2212" : row2.kind === "added" ? "+" : " ";
      const prefixColor = row2.kind === "removed" ? "#f87171" : row2.kind === "added" ? "#4ade80" : "#94a3b8";
      const dim = row2.kind === "kept";
      const strike = row2.kind === "removed";
      return /* @__PURE__ */ React23.createElement(Box19, { key: `${row2.kind}-${row2.step.id}` }, /* @__PURE__ */ React23.createElement(Text19, { color: prefixColor, bold: true }, `${prefix} `), /* @__PURE__ */ React23.createElement(Text19, { color: risk.color, bold: true, dimColor: dim }, risk.dots), /* @__PURE__ */ React23.createElement(Text19, { dimColor: dim, strikethrough: strike }, ` ${row2.step.id} \xB7 ${row2.step.title}`));
    })),
    /* @__PURE__ */ React23.createElement(
      SingleSelect,
      {
        initialValue: "accept",
        items: [
          {
            value: "accept",
            label: t("planReviseConfirm.acceptLabel"),
            hint: t("planReviseConfirm.acceptHint")
          },
          {
            value: "reject",
            label: t("planReviseConfirm.rejectLabel"),
            hint: t("planReviseConfirm.rejectHint")
          }
        ],
        onSubmit: (v) => onChoose(v),
        onCancel: () => onChoose("reject")
      }
    )
  );
}
var PlanReviseConfirm = React23.memo(PlanReviseConfirmInner);

// src/cli/ui/PlanReviseEditor.tsx
import { Box as Box20, Text as Text20 } from "ink";
import React24, { useState as useState13 } from "react";
function PlanReviseEditor({
  steps,
  completedStepIds,
  onAccept,
  onCancel
}) {
  const [rows, setRows] = useState13(
    () => steps.map((s) => ({ step: s, done: completedStepIds?.has(s.id) ?? false, skipped: false }))
  );
  const firstEditableIndex = rows.findIndex((r) => !r.done);
  const [focus, setFocus] = useState13(firstEditableIndex < 0 ? 0 : firstEditableIndex);
  useKeystroke((ev) => {
    if (ev.paste) return;
    if (ev.escape) {
      onCancel();
      return;
    }
    if (ev.return) {
      const revised = rows.map((r) => r.step);
      const skippedIds = rows.filter((r) => r.skipped).map((r) => r.step.id);
      onAccept(revised, skippedIds);
      return;
    }
    if (ev.upArrow) {
      setFocus((f) => Math.max(0, f - 1));
      return;
    }
    if (ev.downArrow) {
      setFocus((f) => Math.min(rows.length - 1, f + 1));
      return;
    }
    const ch = ev.input;
    if (ch === " ") {
      setRows((prev) => {
        const next = [...prev];
        const cur = next[focus];
        if (!cur || cur.done) return prev;
        next[focus] = { ...cur, skipped: !cur.skipped };
        return next;
      });
      return;
    }
    if (ch === "k") {
      setRows((prev) => {
        if (focus <= 0) return prev;
        const a = prev[focus - 1];
        const b = prev[focus];
        if (!a || !b || a.done || b.done) return prev;
        const next = [...prev];
        next[focus - 1] = b;
        next[focus] = a;
        return next;
      });
      setFocus((f) => Math.max(0, f - 1));
      return;
    }
    if (ch === "j") {
      setRows((prev) => {
        if (focus >= prev.length - 1) return prev;
        const a = prev[focus];
        const b = prev[focus + 1];
        if (!a || !b || a.done || b.done) return prev;
        const next = [...prev];
        next[focus] = b;
        next[focus + 1] = a;
        return next;
      });
      setFocus((f) => Math.min(rows.length - 1, f + 1));
      return;
    }
  });
  return /* @__PURE__ */ React24.createElement(
    ApprovalCard,
    {
      tone: "accent",
      glyph: "\u270E",
      title: t("planFlow.reviseTitle"),
      metaRight: t("planFlow.reviseSteps", { count: rows.length }),
      footerHint: t("planFlow.reviseFooter")
    },
    rows.map((r, i) => /* @__PURE__ */ React24.createElement(ReviseRow, { key: r.step.id, row: r, index: i, focused: i === focus }))
  );
}
function ReviseRow({
  row: row2,
  index,
  focused
}) {
  const marker = row2.done ? "[\u2713]" : row2.skipped ? "[s]" : focused ? "[ ]" : "[ ]";
  const markerColor = row2.done ? TONE.ok : row2.skipped ? FG.faint : focused ? TONE.brand : FG.faint;
  const titleColor = row2.done ? FG.sub : row2.skipped ? FG.faint : focused ? FG.strong : FG.sub;
  const focusGlyph = focused ? /* @__PURE__ */ React24.createElement(Text20, { color: TONE.brand }, "\u25B8 ") : /* @__PURE__ */ React24.createElement(Text20, null, "  ");
  return /* @__PURE__ */ React24.createElement(Box20, null, focusGlyph, /* @__PURE__ */ React24.createElement(Text20, { color: markerColor }, marker), /* @__PURE__ */ React24.createElement(Text20, { color: titleColor, bold: focused, italic: row2.skipped, strikethrough: row2.skipped }, ` ${index + 1}. ${row2.step.title}`), row2.skipped ? /* @__PURE__ */ React24.createElement(Text20, { color: TONE.warn }, "     \u2190 skipped") : null);
}

// src/cli/ui/PromptInput.tsx
import { Box as Box21, Text as Text21, useStdout as useStdout7 } from "ink";
import React25, { useRef, useState as useState14 } from "react";

// src/cli/ui/key-normalize.ts
var CSI_TAIL_TO_FLAGS = [
  // Arrow keys — the most common ConPTY victim.
  { tail: "[A", flags: { upArrow: true } },
  { tail: "[B", flags: { downArrow: true } },
  { tail: "[C", flags: { rightArrow: true } },
  { tail: "[D", flags: { leftArrow: true } },
  // Page navigation.
  { tail: "[5~", flags: { pageUp: true } },
  { tail: "[6~", flags: { pageDown: true } },
  // Forward-delete (the key labelled Delete on most keyboards).
  { tail: "[3~", flags: { delete: true } },
  // Shift+Tab — terminal sends `\x1b[Z` rather than tab-with-shift.
  // `[1;2Z` is the modifier-encoded variant some Windows PowerShell
  // hosts emit; `[27;2;9~` and `[9;2u` cover modifyOtherKeys / Kitty
  // forms. Issue #373.
  { tail: "[Z", flags: { shift: true, tab: true } },
  { tail: "[1;2Z", flags: { shift: true, tab: true } },
  { tail: "[27;2;9~", flags: { shift: true, tab: true } },
  { tail: "[9;2u", flags: { shift: true, tab: true } }
];
function alreadyStructured(flags) {
  return Boolean(
    flags.upArrow || flags.downArrow || flags.leftArrow || flags.rightArrow || flags.pageUp || flags.pageDown || flags.delete || flags.tab && flags.shift
  );
}
function recoverCsiTail(input, existing = {}) {
  if (alreadyStructured(existing)) return null;
  for (const entry of CSI_TAIL_TO_FLAGS) {
    if (input === entry.tail || input === `\x1B${entry.tail}`) {
      return entry.flags;
    }
  }
  return null;
}
var STRIPPABLE_CSI_FRAGMENTS = [
  "\x1B[200~",
  "\x1B[201~",
  "[200~",
  "[201~",
  ...CSI_TAIL_TO_FLAGS.flatMap((e) => [`\x1B${e.tail}`, e.tail])
];
function stripCsiFragments(input) {
  let out = input;
  for (const frag of STRIPPABLE_CSI_FRAGMENTS) {
    if (out.includes(frag)) out = out.replaceAll(frag, "");
  }
  return out;
}

// src/cli/ui/multiline-keys.ts
var BACKSLASH_SUFFIX = /\\$/;
var NOOP = { next: null, cursor: null, submit: false };
function processMultilineKey(value, cursor, keyIn) {
  const recovered = recoverCsiTail(keyIn.input, keyIn);
  const key = recovered ? { ...keyIn, ...recovered, input: "" } : keyIn;
  if (key.tab || key.escape) {
    return NOOP;
  }
  if (key.ctrl && key.input === "x") {
    return { ...NOOP, openExternalEditor: true };
  }
  if (key.pageUp) {
    return cursor === 0 ? NOOP : { next: null, cursor: 0, submit: false };
  }
  if (key.pageDown) {
    return cursor === value.length ? NOOP : { next: null, cursor: value.length, submit: false };
  }
  if (key.ctrl && key.input === "p") {
    if (value.includes("\n")) {
      const moved = moveCursorUp(value, cursor);
      if (moved !== cursor) return { next: null, cursor: moved, submit: false };
    }
    return { ...NOOP, historyHandoff: "prev" };
  }
  if (key.ctrl && key.input === "n") {
    if (value.includes("\n")) {
      const moved = moveCursorDown(value, cursor);
      if (moved !== cursor) return { next: null, cursor: moved, submit: false };
    }
    return { ...NOOP, historyHandoff: "next" };
  }
  if (key.leftArrow) {
    return { next: null, cursor: Math.max(0, cursor - 1), submit: false };
  }
  if (key.rightArrow) {
    return { next: null, cursor: Math.min(value.length, cursor + 1), submit: false };
  }
  if (key.upArrow || key.downArrow) {
    return NOOP;
  }
  if (key.ctrl && key.input === "a" || key.home) {
    return { next: null, cursor: startOfLine(value, cursor), submit: false };
  }
  if (key.ctrl && key.input === "e" || key.end) {
    return { next: null, cursor: endOfLine(value, cursor), submit: false };
  }
  if (key.ctrl && key.input === "u") {
    return value.length === 0 ? NOOP : { next: "", cursor: 0, submit: false };
  }
  if (key.ctrl && key.input === "k") {
    const lineEnd = endOfLine(value, cursor);
    if (lineEnd === cursor) return NOOP;
    return {
      next: value.slice(0, cursor) + value.slice(lineEnd),
      cursor,
      submit: false
    };
  }
  if (key.ctrl && key.input === "w" || key.meta && (key.backspace || key.input === "\x7F" || key.input === "\b")) {
    if (cursor === 0) return NOOP;
    const wordStart = previousWordStart(value, cursor);
    return {
      next: value.slice(0, wordStart) + value.slice(cursor),
      cursor: wordStart,
      submit: false
    };
  }
  if (key.meta && key.input === "b") {
    const target = previousWordStart(value, cursor);
    return target === cursor ? NOOP : { next: null, cursor: target, submit: false };
  }
  if (key.meta && key.input === "f") {
    const target = nextWordEnd(value, cursor);
    return target === cursor ? NOOP : { next: null, cursor: target, submit: false };
  }
  const stripped = stripCsiFragments(key.input);
  const looksLikePaste = stripped.length > 1 && (stripped.includes("\n") || stripped.includes("\r"));
  if (looksLikePaste) {
    const normalized = stripped.replace(/\r\n?/g, "\n");
    return {
      next: null,
      cursor: null,
      submit: false,
      pasteRequest: { content: normalized }
    };
  }
  if (key.input === "\n" || key.ctrl && key.input === "j") {
    return insertAt(value, cursor, "\n");
  }
  if (key.return) {
    if (key.shift || key.meta) return insertAt(value, cursor, "\n");
    if (cursor === value.length && BACKSLASH_SUFFIX.test(value)) {
      const replaced = `${value.slice(0, -1)}
`;
      return { next: replaced, cursor: replaced.length, submit: false };
    }
    return { next: null, cursor: null, submit: true, submitValue: value };
  }
  if (key.backspace || key.delete || key.input === "\x7F" || key.input === "\b") {
    if (cursor === 0) return NOOP;
    return {
      next: value.slice(0, cursor - 1) + value.slice(cursor),
      cursor: cursor - 1,
      submit: false
    };
  }
  if ((key.ctrl || key.meta) && key.input.length === 0) return NOOP;
  if (key.ctrl || key.meta) return NOOP;
  if (key.input.length > 0) {
    return insertAt(value, cursor, key.input);
  }
  return NOOP;
}
function insertAt(value, cursor, insert) {
  return {
    next: value.slice(0, cursor) + insert + value.slice(cursor),
    cursor: cursor + insert.length,
    submit: false
  };
}
function lineAndColumn(value, cursor) {
  let line = 0;
  let col = 0;
  const n = Math.min(cursor, value.length);
  for (let i = 0; i < n; i++) {
    if (value[i] === "\n") {
      line++;
      col = 0;
    } else {
      col++;
    }
  }
  return { line, col };
}
function startOfLine(value, cursor) {
  return value.lastIndexOf("\n", cursor - 1) + 1;
}
function previousWordStart(value, cursor) {
  let i = cursor;
  while (i > 0 && /\s/.test(value[i - 1] ?? "")) i--;
  while (i > 0 && !/\s/.test(value[i - 1] ?? "")) i--;
  return i;
}
function nextWordEnd(value, cursor) {
  let i = cursor;
  const n = value.length;
  while (i < n && /\s/.test(value[i] ?? "")) i++;
  while (i < n && !/\s/.test(value[i] ?? "")) i++;
  return i;
}
function endOfLine(value, cursor) {
  const nl = value.indexOf("\n", cursor);
  return nl === -1 ? value.length : nl;
}
function moveCursorUp(value, cursor) {
  const curStart = startOfLine(value, cursor);
  if (curStart === 0) return cursor;
  const col = cursor - curStart;
  const prevEnd = curStart - 1;
  const prevStart = value.lastIndexOf("\n", prevEnd - 1) + 1;
  const prevLen = prevEnd - prevStart;
  return prevStart + Math.min(col, prevLen);
}
function moveCursorDown(value, cursor) {
  const nextNl = value.indexOf("\n", cursor);
  if (nextNl === -1) return cursor;
  const curStart = startOfLine(value, cursor);
  const col = cursor - curStart;
  const nextStart = nextNl + 1;
  const followingNl = value.indexOf("\n", nextStart);
  const nextLen = (followingNl === -1 ? value.length : followingNl) - nextStart;
  return nextStart + Math.min(col, nextLen);
}

// src/cli/ui/paste-sentinels.ts
var PASTE_SENTINEL_BASE = 57600;
var PASTE_SENTINEL_RANGE = 256;
var PASTE_SENTINEL_END = PASTE_SENTINEL_BASE + PASTE_SENTINEL_RANGE;
function encodePasteSentinel(id) {
  if (id < 0 || id >= PASTE_SENTINEL_RANGE) {
    throw new Error(`paste sentinel id ${id} out of range [0, ${PASTE_SENTINEL_RANGE})`);
  }
  return String.fromCharCode(PASTE_SENTINEL_BASE + id);
}
function decodePasteSentinel(ch) {
  if (ch.length === 0) return null;
  const cp = ch.charCodeAt(0);
  if (cp < PASTE_SENTINEL_BASE || cp >= PASTE_SENTINEL_END) return null;
  return cp - PASTE_SENTINEL_BASE;
}
function makePasteEntry(id, content) {
  return {
    id,
    content,
    lineCount: content.split("\n").length,
    charCount: content.length
  };
}
function expandPasteSentinels(text, pastes) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const id = decodePasteSentinel(ch);
    if (id === null) {
      out += ch;
      continue;
    }
    const entry = pastes.get(id);
    out += entry?.content ?? "";
  }
  return out;
}
function listPasteIdsInBuffer(text) {
  const ids = [];
  for (let i = 0; i < text.length; i++) {
    const id = decodePasteSentinel(text[i]);
    if (id !== null) ids.push(id);
  }
  return ids;
}
function formatBytesShort(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 1024 * 10 ? 1 : 0)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

// src/cli/ui/prompt-viewport.ts
function charCells(ch) {
  if (ch.length === 0) return 0;
  const code = ch.charCodeAt(0);
  if (code < 32 || code === 127) return 0;
  if (code < 4352) return 1;
  if (code >= 4352 && code <= 4447) return 2;
  if (code >= 11904 && code <= 12350) return 2;
  if (code >= 12353 && code <= 13311) return 2;
  if (code >= 13312 && code <= 19903) return 2;
  if (code >= 19968 && code <= 40959) return 2;
  if (code >= 40960 && code <= 42191) return 2;
  if (code >= 44032 && code <= 55203) return 2;
  if (code >= 63744 && code <= 64255) return 2;
  if (code >= 65072 && code <= 65103) return 2;
  if (code >= 65280 && code <= 65376) return 2;
  if (code >= 65504 && code <= 65510) return 2;
  return 1;
}
function stringCells(s, pastes) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const id = decodePasteSentinel(ch);
    if (id !== null) {
      n += pasteSentinelCells(id, pastes);
    } else {
      n += charCells(ch);
    }
  }
  return n;
}
function pasteSentinelLabel(id, entry) {
  if (!entry) return `[paste #${id + 1} \xB7 (missing)]`;
  return `[paste #${id + 1} \xB7 ${entry.lineCount}l \xB7 ${formatBytesShort(entry.charCount)}]`;
}
function pasteSentinelCells(id, pastes) {
  const entry = pastes?.get(id);
  return pasteSentinelLabel(id, entry).length;
}
function buildViewport(line, cursorCol, visibleCells, pastes) {
  if (visibleCells <= 0) {
    return {
      segments: [],
      cursorCell: cursorCol === null ? null : 0,
      hiddenLeft: false,
      hiddenRight: line.length > 0
    };
  }
  const totalCells = stringCells(line, pastes);
  if (totalCells <= visibleCells) {
    const segments = textToSegments(line, pastes);
    let cursorCell = null;
    if (cursorCol !== null) {
      cursorCell = stringCells(line.slice(0, cursorCol), pastes);
    }
    return { segments, cursorCell, hiddenLeft: false, hiddenRight: false };
  }
  if (cursorCol === null) {
    return clipFromLeft(line, visibleCells, pastes);
  }
  return clipAroundCursor(line, cursorCol, visibleCells, pastes);
}
function clipFromLeft(line, visibleCells, pastes) {
  const budget2 = Math.max(1, visibleCells - 1);
  let used = 0;
  let end = 0;
  while (end < line.length) {
    const ch = line[end];
    const cw = charCellsAt(line, end, pastes);
    if (used + cw > budget2) break;
    used += cw;
    end++;
  }
  const segments = textToSegments(line.slice(0, end), pastes);
  return { segments, cursorCell: null, hiddenLeft: false, hiddenRight: end < line.length };
}
function clipAroundCursor(line, cursorCol, visibleCells, pastes) {
  let budget2 = visibleCells;
  const reservedForMarkers = 2;
  budget2 = Math.max(1, budget2 - reservedForMarkers);
  const halfBudget = Math.floor(budget2 / 2);
  let start = cursorCol;
  let leftCells = 0;
  while (start > 0 && leftCells < halfBudget) {
    const cw = charCellsAt(line, start - 1, pastes);
    if (leftCells + cw > halfBudget) break;
    start--;
    leftCells += cw;
  }
  const rightBudget = budget2 - leftCells;
  let end = cursorCol;
  let rightCells = 0;
  const cursorChar = cursorCol < line.length ? charCellsAt(line, cursorCol, pastes) : 1;
  if (rightBudget >= cursorChar) {
    if (cursorCol < line.length) end = cursorCol + 1;
    rightCells = cursorChar;
    while (end < line.length && rightCells < rightBudget) {
      const cw = charCellsAt(line, end, pastes);
      if (rightCells + cw > rightBudget) break;
      rightCells += cw;
      end++;
    }
  }
  let extraLeftBudget = rightBudget - rightCells;
  while (start > 0 && extraLeftBudget > 0) {
    const cw = charCellsAt(line, start - 1, pastes);
    if (cw > extraLeftBudget) break;
    start--;
    leftCells += cw;
    extraLeftBudget -= cw;
  }
  const hiddenLeft = start > 0;
  const hiddenRight = end < line.length;
  const segments = textToSegments(line.slice(start, end), pastes);
  const cursorCell = stringCells(line.slice(start, cursorCol), pastes);
  return { segments, cursorCell, hiddenLeft, hiddenRight };
}
function charCellsAt(line, idx, pastes) {
  const ch = line[idx];
  const id = decodePasteSentinel(ch);
  if (id !== null) {
    const entry = pastes?.get(id);
    return pasteSentinelLabel(id, entry).length;
  }
  return charCells(ch);
}
function textToSegments(line, pastes) {
  const out = [];
  let buf = "";
  const flushBuf = () => {
    if (buf.length > 0) {
      out.push({ kind: "text", text: buf });
      buf = "";
    }
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const id = decodePasteSentinel(ch);
    if (id !== null) {
      flushBuf();
      const label = pasteSentinelLabel(id, pastes?.get(id));
      out.push({ kind: "paste", id, label });
    } else {
      buf += ch;
    }
  }
  flushBuf();
  return out;
}

// src/cli/ui/PromptInput.tsx
var INLINE_PASTE_THRESHOLD = 200;
function shouldInlinePaste(content) {
  return !content.includes("\n") && content.length <= INLINE_PASTE_THRESHOLD;
}
function PromptInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  onHistoryPrev,
  onHistoryNext,
  onOpenExternalEditor
}) {
  const inputLineCount = value.length > 0 ? value.split("\n").length : 1;
  const reserveMax = Math.min(Math.ceil(inputLineCount / 4) * 4 + 3, 24);
  useReserveRows("input", { min: 1, max: reserveMax });
  const [cursor, setCursor] = useState14(value.length);
  const pastesRef = useRef(/* @__PURE__ */ new Map());
  const nextPasteIdRef = useRef(0);
  const lastLocalValueRef = useRef(value);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  if (value !== lastLocalValueRef.current) {
    lastLocalValueRef.current = value;
    if (cursor !== value.length) {
      cursorRef.current = value.length;
      setCursor(value.length);
    }
  }
  const registerPaste = (content) => {
    const v = lastLocalValueRef.current;
    const c = cursorRef.current;
    const insertion = shouldInlinePaste(content) ? content : (() => {
      const id = nextPasteIdRef.current % PASTE_SENTINEL_RANGE;
      nextPasteIdRef.current = id + 1;
      pastesRef.current.set(id, makePasteEntry(id, content));
      return encodePasteSentinel(id);
    })();
    const next = v.slice(0, c) + insertion + v.slice(c);
    lastLocalValueRef.current = next;
    cursorRef.current = c + insertion.length;
    onChange(next);
    setCursor(c + insertion.length);
  };
  useKeystroke((ev) => {
    if (disabled) return;
    if (ev.paste) {
      if (ev.input.length > 0) registerPaste(ev.input);
      return;
    }
    const key = {
      input: ev.input,
      return: ev.return,
      shift: ev.shift,
      ctrl: ev.ctrl,
      meta: ev.meta,
      backspace: ev.backspace,
      delete: ev.delete,
      tab: ev.tab,
      upArrow: ev.upArrow,
      downArrow: ev.downArrow,
      leftArrow: ev.leftArrow,
      rightArrow: ev.rightArrow,
      escape: ev.escape,
      pageUp: ev.pageUp,
      pageDown: ev.pageDown,
      home: ev.home,
      end: ev.end
    };
    const action = processMultilineKey(lastLocalValueRef.current, cursorRef.current, key);
    if (action.pasteRequest) {
      registerPaste(action.pasteRequest.content);
      return;
    }
    if (action.next !== null) {
      lastLocalValueRef.current = action.next;
      onChange(action.next);
    }
    if (action.cursor !== null) {
      cursorRef.current = action.cursor;
      setCursor(action.cursor);
    }
    if (action.submit) {
      const raw = action.submitValue ?? lastLocalValueRef.current;
      const expanded = expandPasteSentinels(raw, pastesRef.current);
      const reachable = new Set(listPasteIdsInBuffer(raw));
      for (const id of pastesRef.current.keys()) {
        if (!reachable.has(id)) pastesRef.current.delete(id);
      }
      onSubmit(expanded);
    }
    if (action.historyHandoff === "prev") onHistoryPrev?.();
    if (action.historyHandoff === "next") onHistoryNext?.();
    if (action.openExternalEditor) onOpenExternalEditor?.();
  }, !disabled);
  const { stdout } = useStdout7();
  const cols = stdout?.columns ?? 80;
  const promptPrefix = "\u203A ";
  const continuationIndent = "  ";
  const prefixCells = promptPrefix.length;
  const visibleCells = Math.max(8, cols - prefixCells - 3);
  const effectivePlaceholder = disabled ? placeholder ?? t("composer.waitingForResponse") : placeholder ?? t("composer.placeholder");
  const lines = value.length > 0 ? value.split("\n") : [""];
  const accentColor = disabled ? FG.faint : TONE.brand;
  const cursorVisible = useCursorBlink();
  const { line: cursorLine, col: cursorCol } = lineAndColumn(value, cursor);
  const renderItems = collapseLinesForDisplay(lines, cursorLine);
  const showHugeBufferHints = lines.length > 20;
  return /* @__PURE__ */ React25.createElement(Box21, { flexDirection: "column", paddingX: 1 }, (() => {
    const rows = [];
    let firstRowEmitted = false;
    for (let renderIdx = 0; renderIdx < renderItems.length; renderIdx++) {
      const item = renderItems[renderIdx];
      if (item.kind === "skip") {
        rows.push(
          /* @__PURE__ */ React25.createElement(Box21, { key: `skip-${renderIdx}` }, /* @__PURE__ */ React25.createElement(Text21, { color: FG.faint }, continuationIndent), /* @__PURE__ */ React25.createElement(Text21, { color: FG.faint }, `[\u2026 ${item.linesHidden} line${item.linesHidden === 1 ? "" : "s"} hidden \u2014 full content kept, submitted on Enter \u2026]`))
        );
        continue;
      }
      const i = item.originalIndex;
      const line = item.line;
      const isCursorLine = i === cursorLine;
      const showPlaceholder = i === 0 && value.length === 0;
      if (showPlaceholder) {
        rows.push(
          /* @__PURE__ */ React25.createElement(
            PromptLine,
            {
              key: `ln-${i}-text-0`,
              line: "",
              isFirst: true,
              isCursorLine: isCursorLine && !disabled,
              cursorCol: isCursorLine ? cursorCol : null,
              cursorVisible,
              showPlaceholder: true,
              placeholderText: effectivePlaceholder,
              promptPrefix,
              continuationIndent,
              visibleCells,
              accentColor,
              pastes: pastesRef.current,
              disabled: disabled === true
            }
          )
        );
        firstRowEmitted = true;
        continue;
      }
      const segs = splitLineByPastes(line);
      for (let segIdx = 0; segIdx < segs.length; segIdx++) {
        const seg = segs[segIdx];
        const isFirst = !firstRowEmitted;
        firstRowEmitted = true;
        if (seg.kind === "paste") {
          const cursorOnIt = isCursorLine && cursorCol >= seg.startOffset && cursorCol <= seg.startOffset + 1;
          rows.push(
            /* @__PURE__ */ React25.createElement(
              PasteChipRow,
              {
                key: `ln-${i}-paste-${segIdx}`,
                entry: pastesRef.current.get(seg.id),
                pasteId: seg.id,
                isFirst,
                active: cursorOnIt && !disabled,
                visibleCells,
                accentColor
              }
            )
          );
          continue;
        }
        const segHasCursor = isCursorLine && cursorCol >= seg.startOffset && cursorCol <= seg.startOffset + seg.text.length;
        rows.push(
          /* @__PURE__ */ React25.createElement(
            PromptLine,
            {
              key: `ln-${i}-text-${segIdx}`,
              line: seg.text,
              isFirst,
              isCursorLine: segHasCursor && !disabled,
              cursorCol: segHasCursor ? cursorCol - seg.startOffset : null,
              cursorVisible,
              showPlaceholder: false,
              placeholderText: "",
              promptPrefix,
              continuationIndent,
              visibleCells,
              accentColor,
              pastes: pastesRef.current,
              disabled: disabled === true
            }
          )
        );
      }
      if (segs.length === 0) {
        const isFirst = !firstRowEmitted;
        firstRowEmitted = true;
        rows.push(
          /* @__PURE__ */ React25.createElement(
            PromptLine,
            {
              key: `ln-${i}-empty`,
              line: "",
              isFirst,
              isCursorLine: isCursorLine && !disabled,
              cursorCol: isCursorLine ? 0 : null,
              cursorVisible,
              showPlaceholder: false,
              placeholderText: "",
              promptPrefix,
              continuationIndent,
              visibleCells,
              accentColor,
              pastes: pastesRef.current,
              disabled: disabled === true
            }
          )
        );
      }
    }
    return rows;
  })(), showHugeBufferHints && !disabled ? /* @__PURE__ */ React25.createElement(Box21, null, /* @__PURE__ */ React25.createElement(Text21, { color: FG.faint }, `  [${lines.length} lines \xB7 PgUp/PgDn jump \xB7 Ctrl+U clear \xB7 Ctrl+W del word]`)) : null, !disabled ? /* @__PURE__ */ React25.createElement(Box21, { marginTop: 1 }, /* @__PURE__ */ React25.createElement(HintRow, null)) : /* @__PURE__ */ React25.createElement(Box21, { marginTop: 1 }, /* @__PURE__ */ React25.createElement(Text21, { color: FG.faint }, "  esc to stop")));
}
function HintRow() {
  const items = [
    { key: "\u23CE", tKey: "composer.hintSend" },
    { key: "\u21E7\u23CE", tKey: "composer.hintNewline" },
    { key: "^U", tKey: "composer.hintClear" },
    { key: "^P/^N", tKey: "composer.hintHistory" },
    { key: "esc", tKey: "composer.hintAbort" },
    { key: "^C", tKey: "composer.hintQuit" }
  ];
  return /* @__PURE__ */ React25.createElement(Box21, { flexDirection: "row" }, /* @__PURE__ */ React25.createElement(Text21, null, "  "), items.map((item, i) => /* @__PURE__ */ React25.createElement(React25.Fragment, { key: item.key }, i > 0 && /* @__PURE__ */ React25.createElement(Text21, { color: FG.faint }, "  \xB7  "), /* @__PURE__ */ React25.createElement(Text21, { color: FG.meta }, item.key), /* @__PURE__ */ React25.createElement(Text21, { color: FG.faint }, ` ${t(item.tKey)}`))));
}
function splitLineByPastes(line) {
  const out = [];
  let textBuf = "";
  let textStart = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const id = decodePasteSentinel(ch);
    if (id === null) {
      if (textBuf === "") textStart = i;
      textBuf += ch;
      continue;
    }
    if (textBuf !== "") {
      out.push({ kind: "text", text: textBuf, startOffset: textStart });
      textBuf = "";
    }
    out.push({ kind: "paste", id, startOffset: i });
  }
  if (textBuf !== "") out.push({ kind: "text", text: textBuf, startOffset: textStart });
  return out;
}
function PasteChipRow({
  entry,
  pasteId,
  isFirst,
  active,
  visibleCells,
  accentColor
}) {
  const promptPrefix = "\u203A ";
  const continuationIndent = "  ";
  const lead = isFirst ? promptPrefix : continuationIndent;
  const leadColor = isFirst ? accentColor : FG.faint;
  const labelText = formatChipLabel(entry, pasteId, visibleCells - 6);
  if (active) {
    return /* @__PURE__ */ React25.createElement(Box21, null, /* @__PURE__ */ React25.createElement(Text21, { bold: true, color: leadColor }, lead), /* @__PURE__ */ React25.createElement(Text21, { bold: true, color: accentColor }, "\u25B8 "), /* @__PURE__ */ React25.createElement(Text21, { bold: true, color: "black", backgroundColor: accentColor }, `  ${labelText}  `));
  }
  return /* @__PURE__ */ React25.createElement(Box21, null, /* @__PURE__ */ React25.createElement(Text21, { bold: true, color: leadColor }, lead), /* @__PURE__ */ React25.createElement(Text21, { color: FG.faint }, "  "), /* @__PURE__ */ React25.createElement(Text21, { color: FG.meta }, "\u250C "), /* @__PURE__ */ React25.createElement(Text21, { color: FG.body, backgroundColor: SURFACE.bgElev }, `${labelText} `), /* @__PURE__ */ React25.createElement(Text21, { color: FG.meta }, " \u2510"));
}
function formatChipLabel(entry, pasteId, budget2) {
  if (!entry) return `\u{1F4CB} paste #${pasteId + 1} \xB7 (missing)`;
  const lines = `${entry.lineCount} line${entry.lineCount === 1 ? "" : "s"}`;
  const bytes = formatBytesShort(entry.charCount);
  const kind = sniffChipKind(entry.content);
  const full = `\u{1F4CB} pasted  ${lines} \xB7 ${bytes}  \xB7  ${kind}  ^O expand \xB7 \u232B remove`;
  if (full.length <= Math.max(40, budget2)) return full;
  const compact2 = `\u{1F4CB} pasted  ${lines} \xB7 ${bytes}  \xB7  ${kind}`;
  if (compact2.length <= Math.max(30, budget2)) return compact2;
  return `\u{1F4CB} pasted  ${lines} \xB7 ${bytes}`;
}
function sniffChipKind(content) {
  const head = content.slice(0, 1024);
  if (/^\s*[{[]/.test(head)) {
    try {
      JSON.parse(head);
      return "json";
    } catch {
    }
  }
  if (/\n\s+at\s+\S+\s*\(/.test(head)) return "stacktrace";
  if (/^(diff --git|@@ )/m.test(head)) return "diff";
  if (/^\s*<!doctype|^\s*<html/i.test(head)) return "html";
  if (/^\s*\$\s+\w/.test(head) || /\n\s*\$\s+\w/.test(head)) return "shell";
  return "text";
}
function PromptLine({
  line,
  isFirst,
  isCursorLine,
  cursorCol,
  cursorVisible,
  showPlaceholder,
  placeholderText,
  promptPrefix,
  continuationIndent,
  visibleCells,
  accentColor,
  pastes,
  disabled
}) {
  if (showPlaceholder) {
    return /* @__PURE__ */ React25.createElement(Box21, null, /* @__PURE__ */ React25.createElement(Text21, { bold: true, color: accentColor }, promptPrefix), !disabled ? /* @__PURE__ */ React25.createElement(Text21, { color: accentColor }, cursorVisible ? "\u258C" : " ") : null, /* @__PURE__ */ React25.createElement(Text21, { color: FG.faint }, placeholderText));
  }
  const viewport = buildViewport(line, isCursorLine ? cursorCol : null, visibleCells, pastes);
  return /* @__PURE__ */ React25.createElement(Box21, null, isFirst ? /* @__PURE__ */ React25.createElement(Text21, { bold: true, color: accentColor }, promptPrefix) : /* @__PURE__ */ React25.createElement(Text21, { color: FG.faint }, continuationIndent), viewport.hiddenLeft ? /* @__PURE__ */ React25.createElement(Text21, { color: FG.faint }, "\u2039") : null, /* @__PURE__ */ React25.createElement(
    ViewportContent,
    {
      segments: viewport.segments,
      cursorCell: isCursorLine ? viewport.cursorCell : null,
      accentColor,
      cursorVisible
    }
  ), viewport.hiddenRight ? /* @__PURE__ */ React25.createElement(Text21, { color: FG.faint }, "\u203A") : null);
}
function ViewportContent({
  segments,
  cursorCell,
  accentColor,
  cursorVisible
}) {
  if (cursorCell === null) {
    return /* @__PURE__ */ React25.createElement(React25.Fragment, null, segments.map((seg, i) => renderSegment(seg, i, false)));
  }
  const out = [];
  let cells = 0;
  let placed = false;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segCells = segmentCells(seg);
    if (placed) {
      out.push(renderSegment(seg, i, false));
      continue;
    }
    if (cursorCell >= cells + segCells) {
      out.push(renderSegment(seg, i, false));
      cells += segCells;
      continue;
    }
    if (seg.kind === "paste") {
      out.push(
        /* @__PURE__ */ React25.createElement(
          Text21,
          {
            key: `p-${i}-cursor`,
            color: FG.body,
            backgroundColor: SURFACE.bgElev,
            inverse: cursorVisible
          },
          seg.label
        )
      );
      placed = true;
      cells += segCells;
      continue;
    }
    const offsetIntoSeg = cursorCell - cells;
    const split = splitTextByCells(seg.text, offsetIntoSeg);
    if (split.before.length > 0) {
      out.push(/* @__PURE__ */ React25.createElement(Text21, { key: `t-${i}-b` }, split.before));
    }
    if (split.atCursor.length > 0) {
      out.push(
        /* @__PURE__ */ React25.createElement(Text21, { key: `t-${i}-c`, inverse: cursorVisible, color: accentColor }, split.atCursor)
      );
    } else {
      out.push(
        /* @__PURE__ */ React25.createElement(Text21, { key: `t-${i}-c-eol`, color: accentColor }, cursorVisible ? "\u258C" : " ")
      );
    }
    if (split.after.length > 0) {
      out.push(/* @__PURE__ */ React25.createElement(Text21, { key: `t-${i}-a` }, split.after));
    }
    placed = true;
    cells += segCells;
  }
  if (!placed) {
    out.push(
      /* @__PURE__ */ React25.createElement(Text21, { key: "cursor-eol", color: accentColor }, cursorVisible ? "\u258C" : " ")
    );
  }
  return /* @__PURE__ */ React25.createElement(React25.Fragment, null, out);
}
function segmentCells(seg) {
  if (seg.kind === "paste") return seg.label.length;
  return stringCells(seg.text);
}
function splitTextByCells(text, cellOffset) {
  let cells = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const cw = charCellsForText(ch);
    if (cells === cellOffset) {
      return { before: text.slice(0, i), atCursor: ch, after: text.slice(i + 1) };
    }
    if (cells + cw > cellOffset) {
      return { before: text.slice(0, i), atCursor: ch, after: text.slice(i + 1) };
    }
    cells += cw;
  }
  return { before: text, atCursor: "", after: "" };
}
function charCellsForText(ch) {
  const code = ch.charCodeAt(0);
  if (code < 32 || code === 127) return 0;
  if (code < 4352) return 1;
  if (code >= 4352 && code <= 4447) return 2;
  if (code >= 11904 && code <= 12350) return 2;
  if (code >= 12353 && code <= 13311) return 2;
  if (code >= 13312 && code <= 19903) return 2;
  if (code >= 19968 && code <= 40959) return 2;
  if (code >= 40960 && code <= 42191) return 2;
  if (code >= 44032 && code <= 55203) return 2;
  if (code >= 63744 && code <= 64255) return 2;
  if (code >= 65072 && code <= 65103) return 2;
  if (code >= 65280 && code <= 65376) return 2;
  if (code >= 65504 && code <= 65510) return 2;
  return 1;
}
function renderSegment(seg, key, _inverse) {
  if (seg.kind === "text") {
    return /* @__PURE__ */ React25.createElement(Text21, { key: `s-${key}` }, seg.text);
  }
  return /* @__PURE__ */ React25.createElement(Text21, { key: `s-${key}`, backgroundColor: SURFACE.bgElev, color: FG.body }, seg.label);
}
var COLLAPSE_THRESHOLD = 20;
var COLLAPSE_HEAD_LINES = 3;
var COLLAPSE_TAIL_LINES = 2;
function collapseLinesForDisplay(lines, cursorLine) {
  if (lines.length <= COLLAPSE_THRESHOLD) {
    return lines.map((line, i) => ({ kind: "line", line, originalIndex: i }));
  }
  const keep = /* @__PURE__ */ new Set();
  for (let i = 0; i < COLLAPSE_HEAD_LINES && i < lines.length; i++) keep.add(i);
  for (let i = Math.max(0, lines.length - COLLAPSE_TAIL_LINES); i < lines.length; i++) keep.add(i);
  if (cursorLine >= 0 && cursorLine < lines.length) keep.add(cursorLine);
  const sorted = [...keep].sort((a, b) => a - b);
  const out = [];
  let prev = -1;
  for (const idx of sorted) {
    if (idx - prev > 1) {
      out.push({ kind: "skip", linesHidden: idx - prev - 1 });
    }
    out.push({ kind: "line", line: lines[idx] ?? "", originalIndex: idx });
    prev = idx;
  }
  return out;
}

// src/cli/ui/SessionPicker.tsx
import { Box as Box22, Text as Text22, useStdout as useStdout8 } from "ink";
import React26, { useMemo as useMemo6, useState as useState15 } from "react";
var PAGE_MARGIN3 = 6;
function SessionPicker({
  sessions: sessions2,
  workspace,
  onChoose,
  walletCurrency,
  pickerPorts
}) {
  const [focus, setFocus] = useState15(0);
  const [renaming, setRenaming] = useState15(null);
  const { stdout } = useStdout8();
  const rows = stdout?.rows ?? 40;
  const visibleCount = Math.max(3, rows - PAGE_MARGIN3);
  const snapshot = useMemo6(
    () => ({
      pickerKind: "sessions",
      title: t("sessionPicker.title", { workspace }),
      items: sessions2.map((s) => {
        const branch = s.meta.branch ?? "main";
        const count = s.messageCount;
        const summary = s.meta.summary ?? t(count === 1 ? "sessionPicker.messages" : "sessionPicker.messagesPlural", { count });
        const turns = s.meta.turnCount ?? Math.ceil(s.messageCount / 2);
        const currency = walletCurrency ?? s.meta.balanceCurrency;
        const costLabel = s.meta.totalCostUsd !== void 0 ? formatCost(s.meta.totalCostUsd, currency, 2) : "";
        return {
          id: s.name,
          title: s.name,
          subtitle: summary,
          badge: branch,
          meta: costLabel ? `${t("sessionPicker.turns", { count: turns })} \xB7 ${costLabel}` : t("sessionPicker.turns", { count: turns })
        };
      }),
      actions: ["pick", "delete", "rename", "new", "cancel"],
      hint: t("sessionPicker.pickerHint")
    }),
    [sessions2, workspace, walletCurrency]
  );
  usePickerBroadcast(
    !!pickerPorts,
    {
      ...snapshot,
      actions: [...snapshot.actions]
    },
    (res) => {
      if (res.action === "pick") return onChoose({ kind: "open", name: res.id });
      if (res.action === "delete") return onChoose({ kind: "delete", name: res.id });
      if (res.action === "rename")
        return onChoose({ kind: "rename", name: res.id, newName: res.text });
      if (res.action === "new") return onChoose({ kind: "new" });
      if (res.action === "cancel") return onChoose({ kind: "quit" });
    },
    pickerPorts ?? {
      broadcast: () => void 0,
      resolverRef: { current: null },
      snapshotRef: { current: null }
    }
  );
  useKeystroke((ev) => {
    if (ev.paste) {
      if (renaming) setRenaming({ ...renaming, buf: renaming.buf + ev.input });
      return;
    }
    if (renaming) {
      if (ev.escape) return setRenaming(null);
      if (ev.return) {
        const newName = renaming.buf.trim();
        if (newName.length === 0 || newName === renaming.from) {
          setRenaming(null);
          return;
        }
        onChoose({ kind: "rename", name: renaming.from, newName });
        setRenaming(null);
        return;
      }
      if (ev.backspace) {
        setRenaming({ ...renaming, buf: renaming.buf.slice(0, -1) });
        return;
      }
      if (ev.input && !ev.ctrl && !ev.meta && !ev.tab) {
        setRenaming({ ...renaming, buf: renaming.buf + ev.input });
      }
      return;
    }
    if (ev.escape) return onChoose({ kind: "quit" });
    if (ev.upArrow) return setFocus((f) => Math.max(0, f - 1));
    if (ev.downArrow) return setFocus((f) => Math.min(sessions2.length, f + 1));
    if (ev.return) {
      if (sessions2.length === 0 || focus === sessions2.length) return onChoose({ kind: "new" });
      const target2 = sessions2[focus];
      return onChoose({ kind: "open", name: target2.name });
    }
    if (!ev.input) return;
    if (ev.input === "n") return onChoose({ kind: "new" });
    if (ev.input === "q") return onChoose({ kind: "quit" });
    if (sessions2.length === 0) return;
    const target = sessions2[focus];
    if (!target) return;
    if (ev.input === "d") return onChoose({ kind: "delete", name: target.name });
    if (ev.input === "r") return setRenaming({ from: target.name, buf: "" });
  });
  const start = Math.max(
    0,
    Math.min(focus - Math.floor(visibleCount / 2), sessions2.length - visibleCount)
  );
  const end = Math.min(sessions2.length, start + visibleCount);
  const shown = sessions2.slice(start, end);
  const hiddenBelow = sessions2.length - end;
  return /* @__PURE__ */ React26.createElement(Box22, { flexDirection: "column", marginY: 1 }, /* @__PURE__ */ React26.createElement(Box22, null, /* @__PURE__ */ React26.createElement(Text22, { bold: true, color: TONE.brand }, t("sessionPicker.header")), /* @__PURE__ */ React26.createElement(Text22, { color: FG.meta }, `  \xB7  ${workspace}`)), /* @__PURE__ */ React26.createElement(Box22, { height: 1 }), sessions2.length === 0 ? /* @__PURE__ */ React26.createElement(Box22, null, /* @__PURE__ */ React26.createElement(Text22, { color: FG.faint }, t("sessionPicker.empty")), /* @__PURE__ */ React26.createElement(Text22, { bold: true, color: TONE.brand }, "\u23CE"), /* @__PURE__ */ React26.createElement(Text22, { color: FG.faint }, t("sessionPicker.emptyNew"))) : shown.map((s, i) => /* @__PURE__ */ React26.createElement(
    SessionRow,
    {
      key: s.name,
      info: s,
      focused: start + i === focus,
      walletCurrency
    }
  )), hiddenBelow > 0 ? /* @__PURE__ */ React26.createElement(Box22, null, /* @__PURE__ */ React26.createElement(Text22, { color: FG.faint }, t("cardLabels.more", { count: hiddenBelow }))) : null, renaming ? /* @__PURE__ */ React26.createElement(Box22, { marginTop: 1 }, /* @__PURE__ */ React26.createElement(Text22, { color: FG.faint }, t("sessionPicker.renamePrompt", { from: renaming.from })), /* @__PURE__ */ React26.createElement(Text22, { bold: true, color: TONE.brand }, renaming.buf), /* @__PURE__ */ React26.createElement(Text22, { backgroundColor: TONE.brand, color: "black" }, " ")) : null, /* @__PURE__ */ React26.createElement(Box22, { marginTop: 1 }, /* @__PURE__ */ React26.createElement(Text22, { color: FG.faint }, renaming ? t("sessionPicker.renameHint") : sessions2.length === 0 ? t("sessionPicker.emptyHint") : t("sessionPicker.pickerHint"))));
}
function SessionRow({
  info,
  focused,
  walletCurrency
}) {
  const branch = info.meta.branch ?? "main";
  const count = info.messageCount;
  const summary = info.meta.summary ?? t(count === 1 ? "sessionPicker.messages" : "sessionPicker.messagesPlural", { count });
  const turns = info.meta.turnCount ?? Math.ceil(info.messageCount / 2);
  const currency = walletCurrency ?? info.meta.balanceCurrency;
  const costLabel = info.meta.totalCostUsd !== void 0 ? formatCost(info.meta.totalCostUsd, currency, 2) : "";
  const time = relativeTime2(info.mtime);
  return /* @__PURE__ */ React26.createElement(Box22, null, /* @__PURE__ */ React26.createElement(Text22, { color: focused ? TONE.brand : FG.faint }, focused ? "  \u25B8 " : "    "), /* @__PURE__ */ React26.createElement(Text22, { bold: focused, color: focused ? FG.strong : FG.sub }, info.name.padEnd(12)), /* @__PURE__ */ React26.createElement(Text22, { color: FG.meta }, ` \xB7 ${branch.padEnd(8)} \xB7 `), /* @__PURE__ */ React26.createElement(Text22, { color: focused ? FG.body : FG.sub }, truncate(summary, 40)), /* @__PURE__ */ React26.createElement(Box22, { flexGrow: 1 }), /* @__PURE__ */ React26.createElement(Text22, { color: FG.faint }, `${time.padStart(11)}   `), /* @__PURE__ */ React26.createElement(Text22, { color: FG.faint }, t("sessionPicker.turns", { count: turns })), costLabel ? /* @__PURE__ */ React26.createElement(Text22, { color: FG.faint }, ` \xB7 ${costLabel}`) : null);
}
function truncate(s, max) {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}\u2026`;
}
function relativeTime2(date) {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 6e4);
  if (mins < 1) return t("sessionPicker.justNow");
  if (mins < 60) return t("sessionPicker.minAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("sessionPicker.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t("sessionPicker.yesterday");
  if (days < 7) return t("sessionPicker.daysAgo", { count: days });
  return date.toISOString().slice(0, 10);
}

// src/cli/ui/ShellConfirm.tsx
import { homedir as homedir3 } from "os";
import { Box as Box23, Text as Text23 } from "ink";
import React27, { useState as useState16 } from "react";
var CHROME_ROWS = 18;
var MIN_COMMAND_LINES = 3;
function clampCommand(command, max) {
  const lines = command.split("\n");
  if (lines.length <= max) return { preview: command, hidden: 0 };
  return { preview: lines.slice(0, max).join("\n"), hidden: lines.length - max };
}
function tildeify2(path) {
  const home = homedir3();
  if (!home) return path;
  const normalized = home.replace(/[\\/]+$/, "");
  if (path === normalized) return "~";
  if (path.startsWith(`${normalized}/`)) return `~/${path.slice(normalized.length + 1)}`;
  if (path.startsWith(`${normalized}\\`)) return `~\\${path.slice(normalized.length + 1)}`;
  return path;
}
function ShellConfirm({
  command,
  allowPrefix,
  kind,
  cwd: cwd2,
  timeoutSec,
  waitSec,
  onChoose
}) {
  useReserveRows("modal", { min: 8, max: 14 });
  const totalRows = useTotalRows();
  const maxCommandLines = Math.max(MIN_COMMAND_LINES, totalRows - CHROME_ROWS);
  const { preview, hidden } = clampCommand(command, maxCommandLines);
  const isBackground = kind === "run_background";
  const subtitle = isBackground ? t("shellConfirm.bgSubtitle") : t("shellConfirm.subtitle");
  const [phase, setPhase] = useState16("pick");
  if (phase === "deny") {
    return /* @__PURE__ */ React27.createElement(
      ApprovalCard,
      {
        tone: "error",
        glyph: "\u2717",
        title: t("shellConfirm.denyTitle"),
        metaRight: t("shellConfirm.optional"),
        footerHint: t("shellConfirm.denyFooter")
      },
      /* @__PURE__ */ React27.createElement(
        DenyContextInput,
        {
          onSubmit: (context2) => onChoose("deny", context2 || void 0),
          onCancel: () => onChoose("deny")
        }
      )
    );
  }
  return /* @__PURE__ */ React27.createElement(
    ApprovalCard,
    {
      tone: "warn",
      glyph: isBackground ? "\u23F1" : "?",
      title: isBackground ? t("shellConfirm.bgTitle") : t("shellConfirm.title"),
      metaRight: t("shellConfirm.awaiting"),
      footerHint: t("shellConfirm.pickFooter")
    },
    /* @__PURE__ */ React27.createElement(Box23, { marginBottom: 1 }, /* @__PURE__ */ React27.createElement(Text23, { color: FG.faint }, subtitle)),
    /* @__PURE__ */ React27.createElement(Box23, { marginBottom: 1, flexDirection: "column" }, /* @__PURE__ */ React27.createElement(Box23, null, /* @__PURE__ */ React27.createElement(Text23, { bold: true, color: TONE.err }, "$ "), /* @__PURE__ */ React27.createElement(Text23, { bold: true, color: FG.strong }, preview)), hidden > 0 ? /* @__PURE__ */ React27.createElement(Text23, { color: FG.faint }, t(hidden === 1 ? "shellConfirm.previewMore" : "shellConfirm.previewMorePlural", {
      n: hidden
    })) : null),
    /* @__PURE__ */ React27.createElement(InfoRows2, { cwd: cwd2, timeoutSec, waitSec, kind }),
    /* @__PURE__ */ React27.createElement(
      SingleSelect,
      {
        initialValue: "run_once",
        items: [
          {
            value: "run_once",
            label: t("shellConfirm.allowOnce"),
            hint: t("shellConfirm.allowOnceDesc")
          },
          {
            value: "always_allow",
            label: t("shellConfirm.allowAlways"),
            hint: t("shellConfirm.allowAlwaysDesc", { prefix: allowPrefix })
          },
          {
            value: "deny",
            label: t("shellConfirm.deny"),
            hint: t("shellConfirm.denyDesc")
          }
        ],
        onSubmit: (v) => {
          if (v === "deny") setPhase("deny");
          else onChoose(v);
        },
        onTab: (v) => {
          if (v === "deny") setPhase("deny");
        },
        onCancel: () => onChoose("deny")
      }
    )
  );
}
function InfoRows2({
  cwd: cwd2,
  timeoutSec,
  waitSec,
  kind
}) {
  const rows = [];
  if (cwd2) rows.push({ label: t("shellConfirm.cwdLabel"), value: tildeify2(cwd2) });
  if (kind === "run_background" && waitSec !== void 0 && waitSec > 0) {
    rows.push({ label: t("shellConfirm.waitLabel"), value: `${waitSec}s` });
  } else if (kind !== "run_background" && timeoutSec !== void 0) {
    rows.push({ label: t("shellConfirm.timeoutLabel"), value: `${timeoutSec}s` });
  }
  if (rows.length === 0) return null;
  const labelWidth = Math.max(...rows.map((r) => r.label.length));
  return /* @__PURE__ */ React27.createElement(Box23, { flexDirection: "column", marginBottom: 1 }, rows.map((r) => /* @__PURE__ */ React27.createElement(Box23, { key: r.label, flexDirection: "row", gap: 1 }, /* @__PURE__ */ React27.createElement(Text23, { color: FG.faint }, r.label.padEnd(labelWidth)), /* @__PURE__ */ React27.createElement(Text23, { color: FG.body }, r.value))));
}
function derivePrefix(command) {
  const tokens = command.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0];
  const first = tokens[0];
  const TWO_TOKEN_WRAPPERS = /* @__PURE__ */ new Set([
    "npm",
    "npx",
    "pnpm",
    "yarn",
    "bun",
    "git",
    "cargo",
    "go",
    "docker",
    "kubectl",
    "python",
    "python3",
    "deno",
    "pip",
    "pip3",
    "make",
    "rake",
    "bundle",
    "gem"
  ]);
  return TWO_TOKEN_WRAPPERS.has(first) ? `${first} ${tokens[1]}` : first;
}

// src/cli/ui/SlashArgPicker.tsx
import { Box as Box24, Text as Text24 } from "ink";
import React28 from "react";
function SlashArgPicker({
  matches,
  selectedIndex,
  spec,
  kind,
  partial
}) {
  const color = useColor();
  const headerRow = /* @__PURE__ */ React28.createElement(Box24, null, /* @__PURE__ */ React28.createElement(Text24, { color: color.accent, bold: true }, "/ "), /* @__PURE__ */ React28.createElement(Text24, { color: color.accent, bold: true }, `/${spec.cmd}`), spec.argsHint ? /* @__PURE__ */ React28.createElement(Text24, { dimColor: true }, ` ${spec.argsHint}`) : null, /* @__PURE__ */ React28.createElement(Text24, { dimColor: true }, `  ${spec.summary}`));
  if (kind === "hint") {
    return /* @__PURE__ */ React28.createElement(Box24, { paddingX: 1, marginTop: 1 }, headerRow);
  }
  if (matches === null) return null;
  if (matches.length === 0) {
    return /* @__PURE__ */ React28.createElement(Box24, { flexDirection: "column", paddingX: 1, marginTop: 1 }, headerRow, /* @__PURE__ */ React28.createElement(Box24, null, /* @__PURE__ */ React28.createElement(Text24, { color: color.warn, bold: true }, GLYPH.warn), /* @__PURE__ */ React28.createElement(Text24, { color: color.warn }, t("slashArgPicker.noMatch", { partial })), /* @__PURE__ */ React28.createElement(Text24, { dimColor: true }, t("slashArgPicker.keepTyping"))));
  }
  const MAX = 8;
  const total = matches.length;
  const windowStart = total <= MAX ? 0 : Math.max(0, Math.min(selectedIndex - Math.floor(MAX / 2), total - MAX));
  const shown = matches.slice(windowStart, windowStart + MAX);
  const hiddenAbove = windowStart;
  const hiddenBelow = total - windowStart - shown.length;
  return /* @__PURE__ */ React28.createElement(Box24, { flexDirection: "column", paddingX: 1, marginTop: 1 }, headerRow, hiddenAbove > 0 ? /* @__PURE__ */ React28.createElement(Text24, { dimColor: true }, t("slashArgPicker.above", { hidden: hiddenAbove })) : null, shown.map((value, i) => /* @__PURE__ */ React28.createElement(ArgRow, { key: value, value, isSelected: windowStart + i === selectedIndex })), hiddenBelow > 0 ? /* @__PURE__ */ React28.createElement(Text24, { dimColor: true }, t("slashArgPicker.below", { hidden: hiddenBelow })) : null, /* @__PURE__ */ React28.createElement(Box24, { marginTop: 0 }, /* @__PURE__ */ React28.createElement(Text24, { dimColor: true }, t("slashArgPicker.footer"))));
}
function ArgRow({ value, isSelected }) {
  const color = useColor();
  return /* @__PURE__ */ React28.createElement(Box24, null, /* @__PURE__ */ React28.createElement(Text24, { color: isSelected ? color.primary : color.info, bold: isSelected }, isSelected ? `${GLYPH.cur} ` : "  "), /* @__PURE__ */ React28.createElement(Text24, { color: isSelected ? color.user : color.info, bold: isSelected, dimColor: !isSelected }, value));
}

// src/cli/ui/SlashSuggestions.tsx
import { Box as Box25, Text as Text25, useStdout as useStdout9 } from "ink";
import React29 from "react";
var GROUP_MODE_MAX_ROWS = 24;
var SEARCH_MODE_MAX_ROWS = 8;
var COMMAND_NAME_CELLS = 14;
var ARGS_CELLS = 14;
function groupLabel(group) {
  const key = `slashSuggestions.group${group.charAt(0).toUpperCase() + group.slice(1)}`;
  return t(key);
}
function SlashSuggestions({
  matches,
  selectedIndex,
  groupMode,
  advancedHidden
}) {
  const color = useColor();
  const { stdout } = useStdout9();
  const cols = stdout?.columns ?? 80;
  const [rememberedWindowStart, setRememberedWindowStart] = React29.useState(0);
  const maxRows = groupMode ? GROUP_MODE_MAX_ROWS : SEARCH_MODE_MAX_ROWS;
  const safeMatches = matches ?? [];
  const windowStart = computeWindowStart(
    safeMatches,
    maxRows,
    selectedIndex,
    rememberedWindowStart,
    groupMode
  );
  React29.useEffect(() => {
    setRememberedWindowStart(windowStart);
  }, [windowStart]);
  if (matches === null) return null;
  if (matches.length === 0) {
    return /* @__PURE__ */ React29.createElement(Box25, { paddingX: 1, marginTop: 1 }, /* @__PURE__ */ React29.createElement(Text25, { color: color.warn, bold: true }, GLYPH.warn), /* @__PURE__ */ React29.createElement(Text25, null, " "), /* @__PURE__ */ React29.createElement(Text25, { color: color.warn }, t("slashSuggestions.noMatch")), /* @__PURE__ */ React29.createElement(Text25, { dimColor: true }, t("slashSuggestions.backspaceHint")));
  }
  const total = matches.length;
  const items = buildVisibleItems(matches, windowStart, maxRows, groupMode);
  const shownCommands = items.filter((item) => item.kind === "command");
  const hiddenAbove = windowStart;
  const hiddenBelow = total - windowStart - shownCommands.length;
  return /* @__PURE__ */ React29.createElement(Box25, { flexDirection: "column", paddingX: 1, marginTop: 1, flexShrink: 0, flexWrap: "nowrap" }, /* @__PURE__ */ React29.createElement(Box25, null, /* @__PURE__ */ React29.createElement(Text25, { color: color.accent, bold: true }, "/ "), /* @__PURE__ */ React29.createElement(Text25, { dimColor: true }, t(
    total === 1 ? "slashSuggestions.commandCount" : "slashSuggestions.commandCountPlural",
    { count: total }
  )), hiddenAbove > 0 ? /* @__PURE__ */ React29.createElement(Text25, { dimColor: true }, t("slashSuggestions.aboveLabel", { count: hiddenAbove })) : null), items.map((item) => {
    if (item.kind === "group") {
      return /* @__PURE__ */ React29.createElement(GroupHeader, { key: `group:${item.group}:${item.beforeIndex}`, group: item.group });
    }
    return /* @__PURE__ */ React29.createElement(
      SuggestionRow,
      {
        key: `cmd:${item.spec.group}:${item.spec.cmd}`,
        spec: item.spec,
        isSelected: item.index === selectedIndex,
        columns: cols
      }
    );
  }), hiddenBelow > 0 ? /* @__PURE__ */ React29.createElement(Text25, { dimColor: true }, t("slashSuggestions.belowLabel", { count: hiddenBelow })) : null, groupMode && advancedHidden && advancedHidden > 0 ? /* @__PURE__ */ React29.createElement(Box25, { marginTop: 1 }, /* @__PURE__ */ React29.createElement(Text25, { dimColor: true }, t("slashSuggestions.advancedHint", { count: advancedHidden }))) : null, /* @__PURE__ */ React29.createElement(Box25, { marginTop: 0 }, /* @__PURE__ */ React29.createElement(Text25, { dimColor: true }, t("slashSuggestions.footerHint"))));
}
function computeWindowStart(matches, maxRows, selectedIndex, currentWindowStart, groupMode = false) {
  if (matches.length <= 0) return 0;
  const maxWindowStart = Math.max(0, matches.length - 1);
  let start = Math.max(0, Math.min(currentWindowStart, maxWindowStart));
  const clampedSelectedIndex = Math.max(0, Math.min(selectedIndex, matches.length - 1));
  if (clampedSelectedIndex < start) start = clampedSelectedIndex;
  while (start < clampedSelectedIndex) {
    const visibleCommandIndexes = buildVisibleItems(matches, start, maxRows, groupMode).filter((item) => item.kind === "command").map((item) => item.index);
    if (visibleCommandIndexes.includes(clampedSelectedIndex)) break;
    start += 1;
  }
  return Math.min(start, maxWindowStart);
}
function buildVisibleItems(matches, windowStart, maxRows, groupMode = false) {
  const out = [];
  for (let idx = windowStart; idx < matches.length && out.length < maxRows; idx += 1) {
    const spec = matches[idx];
    if (groupMode && shouldShowGroupHeader(matches, idx)) {
      if (out.length >= maxRows) break;
      out.push({ kind: "group", group: spec.group, beforeIndex: idx });
    }
    if (out.length >= maxRows) break;
    out.push({ kind: "command", spec, index: idx });
  }
  return out;
}
function shouldShowGroupHeader(matches, idx) {
  return idx === 0 || matches[idx]?.group !== matches[idx - 1]?.group;
}
function GroupHeader({ group }) {
  return /* @__PURE__ */ React29.createElement(Box25, { flexShrink: 0, height: 1, flexWrap: "nowrap" }, /* @__PURE__ */ React29.createElement(Text25, { dimColor: true, wrap: "truncate" }, `  ${groupLabel(group)}`));
}
function SuggestionRow({
  spec,
  isSelected,
  columns
}) {
  const color = useColor();
  const name = `/${spec.cmd}`;
  const argsSuffix = spec.argsHint ? spec.argsHint : "";
  const key = `slash.${spec.cmd}.description`;
  const translated = t(key);
  const summary = translated === key ? spec.summary : translated;
  const aliasHint = spec.aliases?.length ? ` \xB7 /${spec.aliases.join(" /")}` : "";
  const reservedCells = 2 + COMMAND_NAME_CELLS + ARGS_CELLS + 2 + 2;
  const summaryBudget = Math.max(8, columns - reservedCells);
  const summaryText = truncateCells(`${summary}${aliasHint}`, summaryBudget);
  return /* @__PURE__ */ React29.createElement(Box25, { flexDirection: "row", flexWrap: "nowrap", flexShrink: 0, height: 1, minHeight: 1 }, /* @__PURE__ */ React29.createElement(Text25, { color: isSelected ? color.primary : color.info, bold: isSelected, wrap: "truncate" }, isSelected ? `${GLYPH.cur} ` : "  "), /* @__PURE__ */ React29.createElement(Text25, { color: color.accent, bold: isSelected, wrap: "truncate" }, padOrTrim(name, COMMAND_NAME_CELLS)), /* @__PURE__ */ React29.createElement(Text25, { dimColor: true, wrap: "truncate" }, padOrTrim(argsSuffix, ARGS_CELLS)), /* @__PURE__ */ React29.createElement(Text25, { wrap: "truncate" }, "  "), /* @__PURE__ */ React29.createElement(Text25, { color: isSelected ? color.user : color.info, dimColor: !isSelected, wrap: "truncate" }, summaryText));
}
function padOrTrim(value, cells) {
  const trimmed = truncateCells(value, cells);
  return trimmed.padEnd(cells);
}
function truncateCells(value, maxCells) {
  if (value.length <= maxCells) return value;
  if (maxCells <= 1) return value.slice(0, Math.max(0, maxCells));
  return `${value.slice(0, maxCells - 1)}\u2026`;
}

// src/cli/ui/ThemePicker.tsx
import { Box as Box26, Text as Text26 } from "ink";
import React30 from "react";
function ThemePicker({
  currentPreference,
  activeTheme,
  onChoose
}) {
  const choices = ["auto", ...listThemeNames()];
  const items = choices.map((value) => ({
    value,
    label: value,
    hint: describeTheme(value, currentPreference, activeTheme)
  }));
  return /* @__PURE__ */ React30.createElement(Box26, { flexDirection: "column", marginY: 1 }, /* @__PURE__ */ React30.createElement(Text26, { bold: true }, t("themePicker.header")), /* @__PURE__ */ React30.createElement(
    SingleSelect,
    {
      items,
      initialValue: currentPreference,
      onSubmit: (value) => onChoose({ kind: "select", value }),
      onCancel: () => onChoose({ kind: "quit" }),
      footer: t("themePicker.footer")
    }
  ));
}
function describeTheme(value, currentPreference, activeTheme) {
  const tags = [];
  if (value === currentPreference) tags.push(t("themePicker.currentPref"));
  if (value === activeTheme) tags.push(t("themePicker.activeNow"));
  if (value === "auto") tags.push(t("themePicker.autoDesc"));
  return tags.join(" \xB7 ");
}

// src/cli/ui/WelcomeBanner.tsx
import { Box as Box27, Text as Text27 } from "ink";
import React31 from "react";
var HINTS = ["/help", "/init", "/memory", "/cost"];
function WelcomeBanner({
  inCodeMode,
  workspaceRoot,
  dashboardUrl
}) {
  const tagline = inCodeMode ? t("ui.taglineCode") : t("ui.taglineChat");
  const taglineSub = t("ui.taglineSub");
  const startTextRaw = t("ui.startSessionHint");
  return /* @__PURE__ */ React31.createElement(Box27, { flexDirection: "column", alignItems: "center", marginY: 1 }, /* @__PURE__ */ React31.createElement(
    Box27,
    {
      flexDirection: "column",
      alignItems: "center",
      borderStyle: "round",
      borderColor: TONE.brand,
      paddingX: 4,
      paddingY: 1
    },
    /* @__PURE__ */ React31.createElement(Box27, { flexDirection: "row", gap: 2 }, /* @__PURE__ */ React31.createElement(Text27, { color: TONE.brand, bold: true }, "REASONIX"), /* @__PURE__ */ React31.createElement(Text27, { color: FG.faint }, "\xD7"), /* @__PURE__ */ React31.createElement(Box27, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React31.createElement(Text27, null, "\u{1F40B}"), /* @__PURE__ */ React31.createElement(Text27, { color: TONE.accent, bold: true }, "DeepSeek"))),
    /* @__PURE__ */ React31.createElement(Box27, { marginTop: 1, flexDirection: "column", alignItems: "center" }, /* @__PURE__ */ React31.createElement(Text27, { color: FG.body }, tagline), /* @__PURE__ */ React31.createElement(Text27, { color: FG.meta }, taglineSub))
  ), /* @__PURE__ */ React31.createElement(Box27, { marginTop: 1 }, /* @__PURE__ */ React31.createElement(Text27, { color: FG.sub }, startTextRaw)), /* @__PURE__ */ React31.createElement(Box27, { marginTop: 1, flexDirection: "row", gap: 3 }, HINTS.map((cmd) => /* @__PURE__ */ React31.createElement(Text27, { key: cmd, color: FG.meta }, cmd))), inCodeMode && workspaceRoot ? /* @__PURE__ */ React31.createElement(Box27, { marginTop: 1, flexDirection: "row", gap: 1 }, /* @__PURE__ */ React31.createElement(Text27, { color: TONE.brand }, t("welcomeBanner.workspace")), /* @__PURE__ */ React31.createElement(Text27, { color: FG.faint }, "\xB7"), /* @__PURE__ */ React31.createElement(Text27, { color: FG.body }, workspaceRoot), /* @__PURE__ */ React31.createElement(Text27, { color: FG.faint }, t("welcomeBanner.relaunchHint"))) : null, dashboardUrl ? /* @__PURE__ */ React31.createElement(Box27, { marginTop: 1, flexDirection: "row", gap: 1 }, /* @__PURE__ */ React31.createElement(Text27, { color: TONE.brand, bold: true }, t("welcomeBanner.dashboard")), /* @__PURE__ */ React31.createElement(Text27, { color: FG.faint }, "\xB7"), /* @__PURE__ */ React31.createElement(Text27, { color: TONE.accent }, dashboardUrl)) : null);
}

// src/cli/ui/bang.ts
function detectBangCommand(text) {
  if (!text.startsWith("!")) return null;
  const body = text.slice(1).trim();
  if (!body) return null;
  return body;
}
function formatBangUserMessage(cmd, output) {
  return `[!${cmd}]
${output}`;
}

// src/cli/ui/copy-mode/CopyMode.tsx
import { Box as Box28, Text as Text28, useStdout as useStdout10 } from "ink";
import React32, { useMemo as useMemo7, useState as useState17 } from "react";

// src/frame/width.ts
import stringWidthLib from "string-width";
var segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
function graphemes(s) {
  return Array.from(segmenter.segment(s), (seg) => seg.segment);
}
function graphemeWidth(g) {
  if (g.length === 0) return 0;
  const w = stringWidthLib(g);
  if (w <= 0) return 0;
  if (w >= 2) return 2;
  return 1;
}
function clipToCells(s, maxCells) {
  if (maxCells <= 0) return "";
  if (stringWidthLib(s) <= maxCells) return s;
  const cap = maxCells - 1;
  let out = "";
  let cells = 0;
  for (const g of graphemes(s)) {
    const w = graphemeWidth(g);
    if (cells + w > cap) break;
    out += g;
    cells += w;
  }
  return `${out}\u2026`;
}
function wrapToCells(s, maxCells) {
  if (maxCells <= 0) return [];
  if (s.length === 0) return [""];
  const out = [];
  let cur = "";
  let cells = 0;
  for (const g of graphemes(s)) {
    const w = graphemeWidth(g);
    if (cells + w > maxCells) {
      out.push(cur);
      cur = g;
      cells = w;
    } else {
      cur += g;
      cells += w;
    }
  }
  if (cur.length > 0 || out.length === 0) out.push(cur);
  return out;
}

// src/cli/ui/clipboard.ts
import { mkdtempSync as mkdtempSync2, writeFileSync as writeFileSync4 } from "fs";
import { tmpdir as tmpdir2 } from "os";
import { join as join4 } from "path";
var OSC_52_LIMIT = 75e3;
function writeClipboard(text) {
  const dir = mkdtempSync2(join4(tmpdir2(), "reasonix-clip-"));
  const filePath = join4(dir, "clip.txt");
  let osc52 = false;
  if (text.length <= OSC_52_LIMIT) {
    const b64 = Buffer.from(text, "utf8").toString("base64");
    process.stdout.write(`\x1B]52;c;${b64}\x1B\\`);
    osc52 = true;
  }
  let writtenPath = null;
  try {
    writeFileSync4(filePath, text, "utf8");
    writtenPath = filePath;
  } catch {
  }
  return { osc52, filePath: writtenPath, size: text.length };
}

// src/cli/ui/copy-mode/snapshot.ts
function buildSnapshot(cards) {
  const out = [];
  for (const card of cards) {
    if (card.kind === "user") {
      pushCard(out, card.id, "user", t("copyMode.labelUser"), card.text);
    } else if (card.kind === "streaming") {
      pushCard(out, card.id, "assistant", t("copyMode.labelAssistant"), card.text);
    } else if (card.kind === "reasoning") {
      pushCard(out, card.id, "reasoning", t("copyMode.labelReasoning"), card.text);
    }
  }
  return out;
}
function pushCard(out, cardId, role, label, body) {
  if (out.length > 0) out.push({ cardId, kind: "blank", role, text: "" });
  out.push({ cardId, kind: "header", role, text: `\u2500\u2500\u2500 ${label} \u2500\u2500\u2500` });
  const lines = body.length === 0 ? [""] : body.split("\n");
  for (const line of lines) out.push({ cardId, kind: "text", role, text: line });
}
function yankRange(snapshot, fromIdx, toIdx) {
  const lo = Math.min(fromIdx, toIdx);
  const hi = Math.max(fromIdx, toIdx);
  const picks = [];
  for (let i = lo; i <= hi; i++) {
    const line = snapshot[i];
    if (!line) continue;
    if (line.kind === "header") continue;
    picks.push(line.text);
  }
  while (picks.length > 0 && picks[picks.length - 1] === "") picks.pop();
  while (picks.length > 0 && picks[0] === "") picks.shift();
  return picks.join("\n");
}
function isYankable(line) {
  return !!line && line.kind !== "header";
}

// src/cli/ui/copy-mode/CopyMode.tsx
var CHROME_ROWS2 = 3;
function CopyMode({ cards, onClose }) {
  const snapshot = useMemo7(() => buildSnapshot(cards), [cards]);
  const { stdout } = useStdout10();
  const termRows = stdout?.rows ?? 30;
  const termCols = stdout?.columns ?? 80;
  const bodyRows = Math.max(4, termRows - CHROME_ROWS2);
  const lastYankableIdx = findLastYankable(snapshot);
  const initialCursor = findFirstYankable(snapshot);
  const [cursor, setCursor] = useState17(initialCursor);
  const [anchor, setAnchor] = useState17(null);
  const [status2, setStatus] = useState17(null);
  const stepDown = (i) => stepBy(snapshot, i, 1);
  const stepUp = (i) => stepBy(snapshot, i, -1);
  useKeystroke((ev) => {
    if (ev.escape || ev.input === "q" && !ev.ctrl && !ev.meta) return onClose(null);
    if (ev.input === "j" || ev.downArrow) return setCursor(stepDown(cursor));
    if (ev.input === "k" || ev.upArrow) return setCursor(stepUp(cursor));
    if (ev.pageDown) return setCursor(scrollBy(snapshot, cursor, bodyRows));
    if (ev.pageUp) return setCursor(scrollBy(snapshot, cursor, -bodyRows));
    if (ev.input === "g") return setCursor(initialCursor);
    if (ev.input === "G") return setCursor(lastYankableIdx);
    if (ev.input === "v" || ev.input === "V") {
      setAnchor((a) => a === null ? cursor : null);
      return;
    }
    if (ev.input === "y" || ev.return) {
      const from = anchor ?? cursor;
      const to = cursor;
      const text = yankRange(snapshot, from, to).trim();
      if (text.length === 0) {
        setStatus(t("copyMode.statusEmpty"));
        return;
      }
      const w = writeClipboard(text);
      setStatus(t("copyMode.statusYanked", { size: text.length, osc52: w.osc52 ? "y" : "n" }));
      setTimeout(() => onClose(w), 600);
    }
  });
  const window = computeWindow(snapshot, cursor, bodyRows);
  const selRange = anchor === null ? null : [Math.min(anchor, cursor), Math.max(anchor, cursor)];
  const totalY = countYankable(snapshot);
  const cursorY = countYankableUntil(snapshot, cursor);
  return /* @__PURE__ */ React32.createElement(Box28, { flexDirection: "column" }, /* @__PURE__ */ React32.createElement(Box28, null, /* @__PURE__ */ React32.createElement(Text28, { color: TONE.brand, bold: true }, t("copyMode.title")), /* @__PURE__ */ React32.createElement(Text28, { color: FG.faint }, `  ${t("copyMode.help")}`)), /* @__PURE__ */ React32.createElement(Box28, { flexDirection: "column" }, snapshot.length === 0 ? /* @__PURE__ */ React32.createElement(Text28, { color: FG.faint }, t("copyMode.empty")) : window.lines.map((line, i) => {
    const idx = window.start + i;
    return /* @__PURE__ */ React32.createElement(
      CopyLine,
      {
        key: `${line.cardId}-${idx}`,
        line,
        cols: termCols,
        isCursor: idx === cursor,
        inSelection: selRange !== null && idx >= selRange[0] && idx <= selRange[1]
      }
    );
  })), /* @__PURE__ */ React32.createElement(Box28, null, /* @__PURE__ */ React32.createElement(Text28, { color: FG.meta }, t("copyMode.statusBar", {
    cur: cursorY > 0 ? cursorY : 1,
    total: Math.max(1, totalY),
    sel: anchor === null ? "\u2014" : String(rangeYankable(snapshot, anchor, cursor))
  })), status2 ? /* @__PURE__ */ React32.createElement(Text28, { color: TONE.ok }, `  ${status2}`) : null));
}
function CopyLine({
  line,
  cols,
  isCursor,
  inSelection
}) {
  const marker = isCursor ? "\u25B8 " : "  ";
  const room = Math.max(1, cols - 2);
  const display = line.kind === "blank" ? "" : clipToCells(line.text, room);
  if (line.kind === "header") {
    return /* @__PURE__ */ React32.createElement(Box28, null, /* @__PURE__ */ React32.createElement(Text28, { color: isCursor ? TONE.brand : FG.faint }, marker), /* @__PURE__ */ React32.createElement(Text28, { color: FG.meta }, display));
  }
  const color = isCursor ? TONE.brand : FG.body;
  return /* @__PURE__ */ React32.createElement(Box28, null, /* @__PURE__ */ React32.createElement(Text28, { color: isCursor ? TONE.brand : FG.faint }, marker), /* @__PURE__ */ React32.createElement(Text28, { color, inverse: inSelection }, display.length === 0 ? " " : display));
}
function findFirstYankable(snapshot) {
  for (let i = 0; i < snapshot.length; i++) if (isYankable(snapshot[i])) return i;
  return 0;
}
function findLastYankable(snapshot) {
  for (let i = snapshot.length - 1; i >= 0; i--) if (isYankable(snapshot[i])) return i;
  return Math.max(0, snapshot.length - 1);
}
function stepBy(snapshot, from, dir) {
  const last = snapshot.length - 1;
  let i = Math.max(0, Math.min(last, from + dir));
  while (i > 0 && i < last && snapshot[i]?.kind === "header") i += dir;
  if (i < 0) return 0;
  if (i > last) return last;
  return i;
}
function scrollBy(snapshot, from, delta) {
  const last = snapshot.length - 1;
  return Math.max(0, Math.min(last, from + delta));
}
function computeWindow(snapshot, cursor, rows) {
  if (snapshot.length <= rows) return { start: 0, lines: snapshot.slice() };
  const half = Math.floor(rows / 2);
  let start = Math.max(0, cursor - half);
  if (start + rows > snapshot.length) start = snapshot.length - rows;
  return { start, lines: snapshot.slice(start, start + rows) };
}
function countYankable(snapshot) {
  let n = 0;
  for (const line of snapshot) if (isYankable(line)) n++;
  return n;
}
function countYankableUntil(snapshot, idx) {
  let n = 0;
  for (let i = 0; i <= Math.min(idx, snapshot.length - 1); i++) if (isYankable(snapshot[i])) n++;
  return n;
}
function rangeYankable(snapshot, a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let n = 0;
  for (let i = lo; i <= hi; i++) if (isYankable(snapshot[i])) n++;
  return n;
}

// src/cli/ui/edit-history.ts
function isEntryFullyUndone(e) {
  return e.snapshots.length > 0 && e.snapshots.every((s) => e.undoneFiles.has(s.path));
}
function entryStatus(e) {
  if (e.undoneFiles.size === 0) return "applied";
  if (isEntryFullyUndone(e)) return "UNDONE";
  return "PARTIAL";
}
function formatEditResults(results) {
  const lines = results.map((r) => {
    const mark = r.status === "applied" || r.status === "created" ? "\u2713" : "\u2717";
    const detail = r.message ? ` (${r.message})` : "";
    return `  ${mark} ${r.status.padEnd(11)} ${r.path}${detail}`;
  });
  const ok = results.filter((r) => r.status === "applied" || r.status === "created").length;
  const total = results.length;
  const header = `\u25B8 edit blocks: ${ok}/${total} applied \u2014 /undo to roll back, or \`git diff\` to review`;
  return [header, ...lines].join("\n");
}
function formatPendingPreview(blocks) {
  const partial = blocks.length > 1 ? "  \xB7  /apply N or 1,3-4 for partial" : "";
  const header = `\u25B8 ${blocks.length} pending edit block(s) \u2014 /apply (or y) to commit \xB7 /discard (or n) to drop${partial}`;
  const diffLines = formatAllBlockDiffs(blocks, { numbered: blocks.length > 1 });
  return [header, ...diffLines].join("\n");
}
function parseEditIndices(raw, max) {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: [] };
  if (max <= 0) return { error: "no pending edits to address" };
  const seen = /* @__PURE__ */ new Set();
  const tokens = trimmed.split(",").map((t2) => t2.trim()).filter((t2) => t2.length > 0);
  if (tokens.length === 0) return { ok: [] };
  for (const tok of tokens) {
    const range = tok.match(/^(\d+)-(\d+)$/);
    if (range) {
      const a = Number.parseInt(range[1] ?? "", 10);
      const b = Number.parseInt(range[2] ?? "", 10);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 1 || b < 1) {
        return { error: `invalid range: "${tok}"` };
      }
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (hi > max) return { error: `index ${hi} out of range (max ${max})` };
      for (let i = lo; i <= hi; i++) seen.add(i);
      continue;
    }
    if (!/^\d+$/.test(tok)) return { error: `invalid index: "${tok}"` };
    const n = Number.parseInt(tok, 10);
    if (!Number.isFinite(n) || n < 1) return { error: `invalid index: "${tok}"` };
    if (n > max) return { error: `index ${n} out of range (max ${max})` };
    seen.add(n);
  }
  return { ok: [...seen].sort((a, b) => a - b) };
}
function partitionEdits(edits, indices1Based) {
  const picked = new Set(indices1Based);
  const selected = [];
  const remaining = [];
  for (let i = 0; i < edits.length; i++) {
    if (picked.has(i + 1)) selected.push(edits[i]);
    else remaining.push(edits[i]);
  }
  return { selected, remaining };
}
function formatUndoRows(results) {
  return results.map((r) => {
    const mark = r.status === "applied" ? "\u2713" : "\u2717";
    const detail = r.message ? ` (${r.message})` : "";
    return `  ${mark} ${r.path}${detail}`;
  });
}

// src/cli/ui/effects/loop-to-dashboard.ts
function loopEventToDashboard(ev, ctx) {
  const id = `${ctx.assistantId}-${ev.role}-${Date.now()}`;
  switch (ev.role) {
    case "assistant_delta":
      return {
        kind: "assistant_delta",
        id: ctx.assistantId,
        contentDelta: ev.content || void 0,
        reasoningDelta: ev.reasoningDelta
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
        args: ev.toolArgs
      };
    case "warning":
      return { kind: "warning", id, text: ev.content };
    case "error":
      return { kind: "error", id, text: ev.content };
    case "status":
      return { kind: "status", text: ev.content };
    default:
      return null;
  }
}

// src/cli/ui/hash-memory.ts
import { closeSync, fstatSync, mkdirSync as mkdirSync3, openSync, readSync, writeSync } from "fs";
import { homedir as homedir4 } from "os";
import { dirname as dirname3, join as join5 } from "path";
var PROJECT_HEADER = `# Reasonix project memory

Notes the user pinned via the \`#\` prompt prefix. The whole file is
loaded into the immutable system prefix every session \u2014 keep it terse.

`;
var GLOBAL_HEADER = `# Reasonix global memory

Cross-project notes the user pinned via the \`#g\` prompt prefix. Loaded
into every Reasonix session's prefix regardless of working directory.
Private to this machine \u2014 not committed anywhere.

`;
function detectHashMemory(text) {
  if (text.startsWith("\\#")) {
    return { kind: "escape", text: text.slice(1) };
  }
  if (!text.startsWith("#")) return null;
  if (text.startsWith("##")) return null;
  if (/^#g\s*$/.test(text)) return null;
  const globalMatch = /^#g\s+(.+)$/s.exec(text);
  if (globalMatch) {
    const body2 = globalMatch[1].trim();
    if (!body2) return null;
    return { kind: "memory-global", note: body2 };
  }
  const body = text.slice(1).trim();
  if (!body) return null;
  return { kind: "memory", note: body };
}
function appendProjectMemory(rootDir, note) {
  return appendBulletToFile(resolveProjectMemoryWritePath(rootDir), note, PROJECT_HEADER);
}
var GLOBAL_MEMORY_DIR = ".visionox";
var GLOBAL_MEMORY_FILE = "visionox.md";
function globalMemoryPath(homeDir = homedir4()) {
  return join5(homeDir, GLOBAL_MEMORY_DIR, GLOBAL_MEMORY_FILE);
}
function appendGlobalMemory(note, homeDir) {
  return appendBulletToFile(globalMemoryPath(homeDir), note, GLOBAL_HEADER);
}
function appendBulletToFile(path, note, newFileHeader) {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("note body cannot be empty");
  const bullet2 = `- ${trimmed}
`;
  mkdirSync3(dirname3(path), { recursive: true });
  const fd = openSync(path, "a+");
  try {
    const stat = fstatSync(fd);
    if (stat.size === 0) {
      writeSync(fd, `${newFileHeader}${bullet2}`);
      return { path, created: true };
    }
    const tail = Buffer.alloc(1);
    readSync(fd, tail, 0, 1, stat.size - 1);
    const prefix = tail[0] !== 10 ? "\n" : "";
    writeSync(fd, `${prefix}${bullet2}`);
    return { path, created: false };
  } finally {
    closeSync(fd);
  }
}

// src/cli/ui/hooks/apply-slash-result.ts
function applySlashResult(result, ctx) {
  if (result.exit) {
    if (ctx.isLoopActive()) ctx.stopLoop();
    ctx.quitProcess();
    return { kind: "consumed" };
  }
  if (result.clear) {
    ctx.resetPendingModals?.();
    ctx.stdoutWrite("\x1B[2J\x1B[3J\x1B[H");
    ctx.log.reset();
    if (result.info) ctx.log.pushInfo(result.info);
    if (ctx.codeModeOn) {
      ctx.pendingEdits.current = [];
      clearPendingEdits(ctx.session);
      ctx.syncPendingCount();
    }
    if (ctx.isLoopActive()) ctx.stopLoop();
    return { kind: "consumed" };
  }
  if (result.info) {
    if (result.ctxBreakdown) {
      ctx.log.showCtx({ text: result.info, ...result.ctxBreakdown });
    } else {
      ctx.log.pushInfo(result.info);
    }
  }
  if (result.replayPlan) {
    const rp = result.replayPlan;
    const done = new Set(rp.completedStepIds);
    const titleSuffix = rp.summary ? ` \u2014 ${rp.summary}` : "";
    ctx.log.showPlan({
      title: `Replay #${rp.index}/${rp.total} \xB7 ${rp.relativeTime}${titleSuffix}`,
      steps: rp.steps.map((s) => ({
        id: s.id,
        title: s.title,
        status: done.has(s.id) ? "done" : "queued"
      })),
      variant: "replay"
    });
  }
  if (result.resubmit) {
    return { kind: "resubmit", text: result.resubmit };
  }
  ctx.pushHistory(ctx.text);
  return { kind: "consumed" };
}

// src/cli/ui/hooks/handle-assistant-final.ts
function handleAssistantFinal(ev, ctx) {
  ctx.flush();
  ctx.translator.reasoningDone(ctx.streamRef.reasoning);
  ctx.translator.streamingDone();
  ctx.broadcastDashboardEvent({
    kind: "assistant_final",
    id: ctx.assistantId,
    text: ev.content || ctx.streamRef.text,
    reasoning: ctx.streamRef.reasoning || void 0
  });
  ctx.setSummary(ctx.getSessionSummary());
  if (ev.stats?.usage) {
    appendUsage({
      session: ctx.session,
      model: ev.stats.model,
      usage: ev.stats.usage
    });
    ctx.translator.turnEnd(ev.stats, ctx.streamRef.reasoning, {
      promptCap: ctx.ctxMax > 0 ? ctx.ctxMax : void 0
    });
    if (ctx.ctxMax > 0) {
      ctx.log.pushCtxPressureIfHigh(ev.stats.usage.promptTokens, ctx.ctxMax);
    }
  }
  const finalText = ev.content || ctx.streamRef.text;
  ctx.assistantIterCounter.current++;
  ctx.streamRef.text = "";
  ctx.streamRef.reasoning = "";
  ctx.streamRef.toolCallBuild = void 0;
  ctx.contentBuf.current = "";
  ctx.reasoningBuf.current = "";
  ctx.toolCallBuildBuf.current = null;
  if (!ctx.codeModeOn || !finalText || ev.forcedSummary) return;
  const blocks = parseEditBlocks(finalText);
  if (blocks.length === 0) return;
  if (ctx.editModeRef.current === "auto" || ctx.editModeRef.current === "yolo") {
    const snaps = snapshotBeforeEdits(blocks, ctx.currentRootDir);
    const results = applyEditBlocks(blocks, ctx.currentRootDir);
    const good = results.some((r) => r.status === "applied" || r.status === "created");
    if (good) {
      ctx.recordEdit("auto-text", blocks, results, snaps);
      ctx.armUndoBanner(results);
    }
    ctx.log.pushInfo(formatEditResults(results));
  } else {
    ctx.pendingEdits.current = [...ctx.pendingEdits.current, ...blocks];
    savePendingEdits(ctx.session, ctx.pendingEdits.current);
    ctx.syncPendingCount();
    ctx.log.pushInfo(formatPendingPreview(ctx.pendingEdits.current));
  }
}

// src/cli/ui/hooks/handle-stream-events.ts
function parseJsonOrRaw(input) {
  if (!input) return void 0;
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}
function handleToolStart(ev, ctx) {
  ctx.setOngoingTool({ name: ev.toolName ?? "?", args: ev.toolArgs });
  ctx.setToolProgress(null);
  ctx.toolStartedAtRef.current = Date.now();
  ctx.translator.toolStart(ev.toolName ?? "?", parseJsonOrRaw(ev.toolArgs), ev.callId);
  if (!ctx.codeModeOn || !ev.toolArgs) return;
  try {
    const parsed = JSON.parse(ev.toolArgs);
    for (const k of ["path", "file_path", "file"]) {
      const v = parsed[k];
      if (typeof v === "string" && v.trim()) {
        ctx.recordRecentFile(v.trim());
        break;
      }
    }
  } catch {
  }
}
function handleErrorEvent(ev, ctx) {
  ctx.setOngoingTool(null);
  ctx.setToolProgress(null);
  ctx.toolStartedAtRef.current = null;
  ctx.translator.toolAbort(ev.error ?? ev.content);
  ctx.log.pushError(t("common.error"), ev.error ?? ev.content);
}
function handleWarningEvent(ev, ctx) {
  ctx.log.pushWarning(t("common.warning"), ev.content);
  if (ev.content?.startsWith("\u21E7 ")) ctx.setTurnOnPro(true);
}

// src/cli/ui/hooks/handle-tool-event.ts
function handleToolEvent(ev, ctx) {
  ctx.flush();
  ctx.setOngoingTool(null);
  ctx.setToolProgress(null);
  ctx.translator.toolEnd(ev.content);
  ctx.toolStartedAtRef.current = null;
  if (ev.toolName === "mark_step_complete") {
    try {
      const parsed = JSON.parse(ev.content);
      const stepId = parsed.stepId;
      if (parsed.kind === "step_completed" && typeof stepId === "string") {
        ctx.completedStepIdsRef.current.add(stepId);
        ctx.persistPlanState();
        ctx.log.completePlanStep(stepId);
        const total = ctx.planStepsRef.current?.length ?? 0;
        const completed = ctx.completedStepIdsRef.current.size;
        const stepFromPlan = ctx.planStepsRef.current?.find((s) => s.id === stepId);
        const title = parsed.title ?? stepFromPlan?.title;
        if (title) ctx.log.pushStepProgress(completed, total, title);
        if (ctx.session && total > 0 && completed >= total) {
          const archive = archivePlanState(ctx.session);
          if (archive) {
            ctx.log.pushInfo(t("planFlow.completeMsg", { total, s: total === 1 ? "" : "s" }));
          }
        }
      }
    } catch {
    }
  }
}

// src/cli/ui/state/provider.tsx
import React33 from "react";

// src/cli/ui/state/reducer.ts
function reduce(state, event) {
  switch (event.type) {
    case "user.submit":
      return appendCard(state, makeUserCard(event.text));
    case "turn.start":
      return { ...state, turnInProgress: true };
    case "turn.thinking":
      return appendCard(
        state,
        makeLiveCard("thinking", `thinking \xB7 ${state.session.model}`, "brand")
      );
    case "reasoning.start":
      return appendCard(state, makeReasoningCard(event.id, event.model ?? state.session.model));
    case "reasoning.chunk":
      return mutateCard(state, event.id, "reasoning", (c) => ({ ...c, text: c.text + event.text }));
    case "reasoning.end":
      return mutateCard(state, event.id, "reasoning", (c) => ({
        ...c,
        paragraphs: event.paragraphs,
        tokens: event.tokens,
        streaming: false,
        endedAt: Date.now(),
        ...event.aborted ? { aborted: true } : {}
      }));
    case "streaming.start":
      return appendCard(state, makeStreamingCard(event.id, event.model ?? state.session.model));
    case "streaming.chunk":
      return mutateCard(state, event.id, "streaming", (c) => ({ ...c, text: c.text + event.text }));
    case "streaming.end":
      return mutateCard(state, event.id, "streaming", (c) => ({
        ...c,
        done: true,
        endedAt: Date.now(),
        ...event.aborted ? { aborted: true } : {}
      }));
    case "tool.start":
      return appendCard(state, makeToolCard(event.id, event.name, event.args));
    case "tool.chunk":
      return mutateCard(state, event.id, "tool", (c) => ({ ...c, output: c.output + event.text }));
    case "tool.end": {
      const finalOutput = event.output ?? "";
      const rejected = isPlanModeRejection(finalOutput);
      return mutateCard(state, event.id, "tool", (c) => ({
        ...c,
        done: true,
        output: event.output ?? c.output,
        exitCode: event.exitCode,
        elapsedMs: event.elapsedMs,
        ...event.aborted ? { aborted: true } : {},
        ...rejected ? { rejected: true } : {}
      }));
    }
    case "tool.retry":
      return mutateCard(state, event.id, "tool", (c) => ({
        ...c,
        retry: { attempt: event.attempt, max: event.max }
      }));
    case "turn.abort":
      return {
        ...state,
        turnInProgress: false,
        composer: { ...state.composer, abortedHint: true }
      };
    case "turn.end": {
      const sessionCost = state.status.sessionCost + event.usage.cost;
      return {
        ...state,
        turnInProgress: false,
        status: {
          ...state.status,
          cost: event.usage.cost,
          sessionCost,
          cacheHit: event.usage.cacheHit
        }
      };
    }
    case "mode.change":
      return { ...state, status: { ...state.status, mode: event.mode } };
    case "network.change":
      return {
        ...state,
        status: { ...state.status, network: event.state, networkDetail: event.detail }
      };
    case "language.change":
      return { ...state, lang: event.lang };
    case "session.update":
      return { ...state, status: { ...state.status, ...event.patch } };
    case "session.model.change":
      return state.session.model === event.model ? state : { ...state, session: { ...state.session, model: event.model } };
    case "session.preset.change":
      return state.status.preset === event.preset ? state : { ...state, status: { ...state.status, preset: event.preset } };
    case "mcp.loading": {
      const current = state.status.mcpLoading;
      if (event.total <= 0) {
        if (!current) return state;
        const { mcpLoading: _drop, ...rest } = state.status;
        return { ...state, status: rest };
      }
      if (current && current.ready === event.ready && current.total === event.total) return state;
      return {
        ...state,
        status: { ...state.status, mcpLoading: { ready: event.ready, total: event.total } }
      };
    }
    case "focus.move":
      return {
        ...state,
        focusedCardId: moveFocus(state.cards, state.focusedCardId, event.direction)
      };
    case "focus.set":
      return { ...state, focusedCardId: event.cardId };
    case "card.toggle":
      return state;
    case "composer.input":
      return {
        ...state,
        composer: {
          ...state.composer,
          value: event.value,
          cursor: event.value.length,
          abortedHint: false
        }
      };
    case "composer.cursor":
      return { ...state, composer: { ...state.composer, cursor: event.index } };
    case "composer.history":
      return state;
    case "picker.open":
      return { ...state, composer: { ...state.composer, picker: event.kind } };
    case "picker.close":
      return { ...state, composer: { ...state.composer, picker: null } };
    case "toast.show":
      return { ...state, toasts: [...state.toasts, makeToast(event)] };
    case "toast.hide":
      return { ...state, toasts: state.toasts.filter((t2) => t2.id !== event.id) };
    case "live.show":
      return appendCard(state, {
        kind: "live",
        id: event.id,
        ts: event.ts,
        variant: event.variant,
        tone: event.tone,
        text: event.text,
        meta: event.meta
      });
    case "tip.show":
      return appendCard(state, {
        kind: "tip",
        id: event.id,
        ts: event.ts,
        topic: event.topic,
        sections: event.sections,
        footer: event.footer,
        oneTime: event.oneTime
      });
    case "session.reset":
      return { ...state, cards: [], focusedCardId: null, toasts: [] };
    case "plan.show":
      return appendCard(state, {
        kind: "plan",
        id: event.id,
        ts: Date.now(),
        title: event.title,
        steps: event.steps,
        variant: event.variant
      });
    case "plan.drop": {
      let dropped = false;
      const cards = state.cards.map((c, i) => {
        if (dropped) return c;
        if (c.kind !== "plan" || c.variant !== "active") return c;
        if (state.cards.slice(i + 1).some((cc) => cc.kind === "plan" && cc.variant === "active")) {
          return c;
        }
        dropped = true;
        return { ...c, variant: "replay" };
      });
      return dropped ? { ...state, cards } : state;
    }
    case "plan.step.complete": {
      let changed = false;
      const cards = state.cards.map((c) => {
        if (c.kind !== "plan") return c;
        let stepChanged = false;
        const next = c.steps.map((s) => {
          if (s.id !== event.stepId || s.status === "done") return s;
          stepChanged = true;
          return { ...s, status: "done" };
        });
        if (!stepChanged) return c;
        changed = true;
        return { ...c, steps: next };
      });
      return changed ? { ...state, cards } : state;
    }
    case "ctx.show":
      return appendCard(state, {
        kind: "ctx",
        id: event.id,
        ts: Date.now(),
        text: event.text,
        systemTokens: event.systemTokens,
        toolsTokens: event.toolsTokens,
        logTokens: event.logTokens,
        inputTokens: event.inputTokens,
        ctxMax: event.ctxMax,
        toolsCount: event.toolsCount,
        logMessages: event.logMessages,
        topTools: event.topTools
      });
    case "doctor.show":
      return appendCard(state, {
        kind: "doctor",
        id: event.id,
        ts: Date.now(),
        checks: event.checks
      });
    case "usage.show":
      return appendCard(state, {
        kind: "usage",
        id: event.id,
        ts: Date.now(),
        turn: event.turn,
        tokens: event.tokens,
        cacheHit: event.cacheHit,
        cost: event.cost,
        sessionCost: event.sessionCost,
        balance: event.balance,
        balanceCurrency: event.balanceCurrency,
        elapsedMs: event.elapsedMs
      });
  }
}
function appendCard(state, card) {
  return { ...state, cards: [...state.cards, card] };
}
function mutateCard(state, id, kind, patch) {
  const idx = state.cards.findIndex((c) => c.id === id && c.kind === kind);
  if (idx < 0) return state;
  const next = state.cards.slice();
  next[idx] = patch(state.cards[idx]);
  return { ...state, cards: next };
}
function moveFocus(cards, current, dir) {
  const last = cards.length - 1;
  if (last < 0) return null;
  if (dir === "first") return cards[0].id;
  if (dir === "last") return cards[last].id;
  const idx = current ? cards.findIndex((c) => c.id === current) : -1;
  if (idx < 0) return cards[last].id;
  const next = dir === "next" ? Math.min(idx + 1, last) : Math.max(idx - 1, 0);
  return cards[next].id;
}
var toastSeq = 0;
function makeToast(event) {
  toastSeq += 1;
  return {
    id: `toast-${toastSeq}`,
    tone: event.tone,
    title: event.title,
    detail: event.detail,
    bornAt: Date.now(),
    ttlMs: event.ttlMs
  };
}
var cardSeq = 0;
function nextId(prefix) {
  cardSeq += 1;
  return `${prefix}-${cardSeq}`;
}
function makeUserCard(text) {
  return { kind: "user", id: nextId("user"), ts: Date.now(), text };
}
function makeReasoningCard(id, model2) {
  return {
    kind: "reasoning",
    id,
    ts: Date.now(),
    text: "",
    paragraphs: 0,
    tokens: 0,
    streaming: true,
    ...model2 ? { model: model2 } : {}
  };
}
function makeStreamingCard(id, model2) {
  return {
    kind: "streaming",
    id,
    ts: Date.now(),
    text: "",
    done: false,
    ...model2 ? { model: model2 } : {}
  };
}
function makeToolCard(id, name, args) {
  return {
    kind: "tool",
    id,
    ts: Date.now(),
    name,
    args,
    output: "",
    done: false,
    elapsedMs: 0
  };
}
function makeLiveCard(variant, text, tone) {
  return { kind: "live", id: nextId("live"), ts: Date.now(), variant, text, tone };
}
function isPlanModeRejection(output) {
  if (!output) return false;
  try {
    const parsed = JSON.parse(output);
    return parsed?.rejectedReason === "plan-mode";
  } catch {
    return false;
  }
}

// src/cli/ui/state/state.ts
function initialState(session, cards = []) {
  return {
    lang: getLanguage(),
    session,
    cards,
    composer: {
      value: "",
      cursor: 0,
      picker: null,
      shell: false,
      abortedHint: false
    },
    status: {
      mode: "auto",
      network: "online",
      cost: 0,
      sessionCost: 0,
      cacheHit: 0
    },
    focusedCardId: null,
    toasts: [],
    turnInProgress: false
  };
}

// src/cli/ui/state/store.ts
function createStore(session, initialCards) {
  let state = initialState(session, initialCards);
  const stateListeners = /* @__PURE__ */ new Set();
  const eventListeners = /* @__PURE__ */ new Set();
  return {
    getState() {
      return state;
    },
    dispatch(event) {
      state = reduce(state, event);
      for (const listener of stateListeners) listener();
      for (const listener of eventListeners) listener(event);
    },
    subscribe(listener) {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    onEvent(listener) {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    }
  };
}

// src/cli/ui/state/provider.tsx
var StoreCtx = React33.createContext(null);
function AgentStoreProvider({
  session,
  initialCards,
  children
}) {
  const initialCardsRef = React33.useRef(initialCards);
  const store = React33.useMemo(() => createStore(session, initialCardsRef.current), [session]);
  return /* @__PURE__ */ React33.createElement(StoreCtx.Provider, { value: store }, children);
}
function useAgentStore() {
  const store = React33.useContext(StoreCtx);
  if (!store) throw new Error("useAgentStore must be used inside AgentStoreProvider");
  return store;
}
function useAgentState(selector) {
  const store = useAgentStore();
  const subscribe = React33.useCallback((cb) => store.subscribe(cb), [store]);
  const getSnapshot = React33.useCallback(() => selector(store.getState()), [store, selector]);
  return React33.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
function useDispatch() {
  return useAgentStore().dispatch;
}

// src/cli/ui/hooks/useActivityPhase.ts
function deriveActivityLabel(cards) {
  if (cards.some((c) => c.kind === "reasoning" && c.streaming)) return "thinking\u2026";
  const last = cards[cards.length - 1];
  if (!last || last.kind === "user") return "waiting for model\u2026";
  return "processing\u2026";
}
function useActivityLabel() {
  return useAgentState((s) => deriveActivityLabel(s.cards));
}

// src/cli/ui/hooks/useAgentSession.ts
import { useMemo as useMemo8 } from "react";
function useAgentSession({
  sessionId,
  model: model2,
  workspace,
  branch
}) {
  return useMemo8(
    () => ({
      id: sessionId ?? "default",
      branch: branch ?? "main",
      workspace,
      model: model2
    }),
    [sessionId, branch, workspace, model2]
  );
}

// src/cli/ui/hooks/useCodeMode.ts
import { useCallback as useCallback2 } from "react";
function useCodeMode(opts) {
  const { codeMode, pendingEdits, currentRootDir, session, syncPendingCount, recordEdit } = opts;
  const codeApply = useCallback2(
    (indices) => {
      if (!codeMode) return "not in code mode";
      const blocks = pendingEdits.current;
      if (blocks.length === 0) {
        return "nothing pending \u2014 the model hasn't proposed edits since the last /apply or /discard.";
      }
      const useSubset = indices !== void 0 && indices.length > 0;
      const { selected, remaining } = useSubset ? partitionEdits(blocks, indices) : { selected: blocks, remaining: [] };
      if (selected.length === 0) {
        return "\u25B8 no edits matched those indices \u2014 nothing applied. Use /apply with no args to commit them all.";
      }
      const snaps = snapshotBeforeEdits(selected, currentRootDir);
      const results = applyEditBlocks(selected, currentRootDir);
      const anyApplied = results.some((r) => r.status === "applied" || r.status === "created");
      if (anyApplied) recordEdit("review-apply", selected, results, snaps);
      pendingEdits.current = remaining;
      if (remaining.length === 0) clearPendingEdits(session ?? null);
      else savePendingEdits(session ?? null, remaining);
      syncPendingCount();
      const tail = remaining.length > 0 ? `
\u25B8 ${remaining.length} edit block(s) still pending \u2014 /apply or /discard to clear them.` : "";
      return formatEditResults(results) + tail;
    },
    [codeMode, currentRootDir, session, syncPendingCount, recordEdit, pendingEdits]
  );
  const codeDiscard = useCallback2(
    (indices) => {
      const blocks = pendingEdits.current;
      if (blocks.length === 0) return "nothing pending to discard.";
      const useSubset = indices !== void 0 && indices.length > 0;
      const { selected, remaining } = useSubset ? partitionEdits(blocks, indices) : { selected: blocks, remaining: [] };
      if (selected.length === 0) {
        return "\u25B8 no edits matched those indices \u2014 nothing discarded.";
      }
      pendingEdits.current = remaining;
      if (remaining.length === 0) clearPendingEdits(session ?? null);
      else savePendingEdits(session ?? null, remaining);
      syncPendingCount();
      const tail = remaining.length > 0 ? `  (${remaining.length} block(s) still pending)` : ". Nothing was written to disk.";
      return `\u25B8 discarded ${selected.length} pending edit block(s)${tail}`;
    },
    [session, syncPendingCount, pendingEdits]
  );
  return { codeApply, codeDiscard };
}

// src/cli/ui/hooks/useEditGate.ts
import {
  useCallback as useCallback3,
  useEffect as useEffect5,
  useRef as useRef2,
  useState as useState18
} from "react";
var FLASH_MS = 1200;
function useEditGate(codeMode) {
  const pendingEdits = useRef2([]);
  const [pendingCount, setPendingCount] = useState18(0);
  const [pendingTick, setPendingTick] = useState18(0);
  const syncPendingCount = useCallback3(() => {
    setPendingCount(pendingEdits.current.length);
    setPendingTick((t2) => t2 + 1);
  }, []);
  const [editMode, setEditMode] = useState18(() => codeMode ? loadEditMode() : "review");
  const editModeRef = useRef2(editMode);
  useEffect5(() => {
    editModeRef.current = editMode;
    if (codeMode) saveEditMode(editMode);
  }, [editMode, codeMode]);
  const [modeFlash, setModeFlash] = useState18(false);
  const flashTimerRef = useRef2(null);
  const prevEditModeRef = useRef2(editMode);
  useEffect5(() => {
    if (prevEditModeRef.current === editMode) return;
    prevEditModeRef.current = editMode;
    setModeFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setModeFlash(false);
      flashTimerRef.current = null;
    }, FLASH_MS);
  }, [editMode]);
  return {
    pendingEdits,
    pendingCount,
    pendingTick,
    syncPendingCount,
    editMode,
    setEditMode,
    editModeRef,
    modeFlash
  };
}

// src/cli/ui/hooks/useHookList.ts
import { useCallback as useCallback4, useState as useState19 } from "react";
function useHookList(initialProjectRoot) {
  const [hookList, setHookList] = useState19(
    () => loadHooks({ projectRoot: initialProjectRoot })
  );
  const reloadHooks = useCallback4((projectRoot) => {
    const fresh = loadHooks({ projectRoot });
    setHookList(fresh);
    return fresh.length;
  }, []);
  return { hookList, reloadHooks };
}

// src/cli/ui/hooks/useInputRecall.ts
import { useCallback as useCallback5, useRef as useRef3 } from "react";
function useInputRecall(setInput) {
  const promptHistory = useRef3([]);
  const historyCursor = useRef3(-1);
  const recallPrev = useCallback5(() => {
    const hist = promptHistory.current;
    if (hist.length === 0) return;
    const nextCursor = Math.min(historyCursor.current + 1, hist.length - 1);
    historyCursor.current = nextCursor;
    setInput(hist[hist.length - 1 - nextCursor] ?? "");
  }, [setInput]);
  const recallNext = useCallback5(() => {
    if (historyCursor.current < 0) return;
    const hist = promptHistory.current;
    const nextCursor = historyCursor.current - 1;
    historyCursor.current = nextCursor;
    setInput(nextCursor < 0 ? "" : hist[hist.length - 1 - nextCursor] ?? "");
  }, [setInput]);
  const pushHistory = useCallback5((text) => {
    promptHistory.current.push(text);
  }, []);
  const resetCursor = useCallback5(() => {
    historyCursor.current = -1;
  }, []);
  return { recallPrev, recallNext, pushHistory, resetCursor };
}

// src/cli/ui/hooks/useLanguageReload.ts
import { useEffect as useEffect6, useState as useState20 } from "react";
function useLanguageReload() {
  const [version, setVersion] = useState20(0);
  useEffect6(() => onLanguageChange(() => setVersion((v) => v + 1)), []);
  return version;
}

// src/cli/ui/hooks/useLoopMode.ts
import { useCallback as useCallback6, useEffect as useEffect7, useRef as useRef4, useState as useState21 } from "react";
function useLoopMode(opts) {
  const { log, busyRef, handleSubmitRef } = opts;
  const [activeLoop, setActiveLoop] = useState21(null);
  const activeLoopRef = useRef4(null);
  const loopTimerRef = useRef4(null);
  const loopFiringRef = useRef4(false);
  useEffect7(() => {
    activeLoopRef.current = activeLoop;
  }, [activeLoop]);
  const stopLoop = useCallback6(() => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    const cur = activeLoopRef.current;
    if (!cur) return;
    setActiveLoop(null);
    log.pushInfo(`\u25B8 loop stopped (after ${cur.iter} iter${cur.iter === 1 ? "" : "s"}).`);
  }, [log]);
  const startLoop = useCallback6((intervalMs, prompt) => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    setActiveLoop({
      prompt,
      intervalMs,
      nextFireAt: Date.now() + intervalMs,
      iter: 0
    });
  }, []);
  const getLoopStatus = useCallback6(() => {
    const cur = activeLoopRef.current;
    if (!cur) return null;
    return {
      prompt: cur.prompt,
      intervalMs: cur.intervalMs,
      iter: cur.iter,
      nextFireMs: Math.max(0, cur.nextFireAt - Date.now())
    };
  }, []);
  const isLoopActive = useCallback6(() => activeLoopRef.current !== null, []);
  const isLoopFiring = useCallback6(() => loopFiringRef.current, []);
  const clearFiringFlag = useCallback6(() => {
    loopFiringRef.current = false;
  }, []);
  useEffect7(() => {
    if (!activeLoop) return;
    const delay = Math.max(0, activeLoop.nextFireAt - Date.now());
    const timer = setTimeout(async () => {
      loopTimerRef.current = null;
      if (busyRef.current) {
        setActiveLoop((cur2) => cur2 ? { ...cur2, nextFireAt: Date.now() + 1e3 } : cur2);
        return;
      }
      const cur = activeLoopRef.current;
      if (!cur) return;
      const nextIter = cur.iter + 1;
      setActiveLoop(
        (c) => c ? { ...c, iter: nextIter, nextFireAt: Date.now() + cur.intervalMs } : c
      );
      log.pushInfo(`\u25B8 /loop iter ${nextIter} \u2192 ${cur.prompt}`);
      loopFiringRef.current = true;
      try {
        await handleSubmitRef.current?.(cur.prompt);
      } catch {
        stopLoop();
      } finally {
        loopFiringRef.current = false;
      }
    }, delay);
    loopTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [activeLoop, stopLoop, log, busyRef, handleSubmitRef]);
  return {
    startLoop,
    stopLoop,
    getLoopStatus,
    isLoopActive,
    isLoopFiring,
    clearFiringFlag,
    activeLoop
  };
}

// src/cli/ui/hooks/usePresetMode.ts
import { useState as useState22 } from "react";
function usePresetMode(model2) {
  const [preset2, setPreset] = useState22(
    () => model2 === "deepseek-v4-pro" ? "pro" : "auto"
  );
  const [proArmed, setProArmed] = useState22(false);
  const [turnOnPro, setTurnOnPro] = useState22(false);
  return { preset: preset2, setPreset, proArmed, setProArmed, turnOnPro, setTurnOnPro };
}

// src/cli/ui/hooks/useQuit.ts
import { useCallback as useCallback7, useEffect as useEffect8 } from "react";
function useQuit(transcriptRef) {
  const quitProcess = useCallback7(() => {
    transcriptRef.current?.end();
    process.exit(0);
  }, [transcriptRef]);
  useEffect8(() => {
    process.on("SIGINT", quitProcess);
    return () => {
      process.off("SIGINT", quitProcess);
    };
  }, [quitProcess]);
  return quitProcess;
}

// src/cli/ui/hooks/useScrollback.ts
import { useMemo as useMemo9 } from "react";
var seq = 0;
function nextId2(prefix) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}
function formatTok(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}
function useScrollback() {
  const dispatch = useDispatch();
  return useMemo9(
    () => ({
      pushUser(text) {
        const id = nextId2("u");
        dispatch({ type: "user.submit", text });
        return id;
      },
      pushWarning(title, message) {
        const id = nextId2("warn");
        dispatch({
          type: "live.show",
          id,
          ts: Date.now(),
          variant: "ctxPressure",
          tone: "warn",
          text: title,
          meta: message
        });
        return id;
      },
      pushError(title, message, stack) {
        const id = nextId2("err");
        dispatch({
          type: "live.show",
          id,
          ts: Date.now(),
          variant: "aborted",
          tone: "err",
          text: title,
          meta: stack ? `${message}
${stack}` : message
        });
        return id;
      },
      pushInfo(text, tone = "info") {
        const id = nextId2("info");
        dispatch({
          type: "live.show",
          id,
          ts: Date.now(),
          variant: "stepProgress",
          tone,
          text
        });
        return id;
      },
      pushTip({ topic, sections, footer, oneTime = true }) {
        const id = nextId2("tip");
        dispatch({
          type: "tip.show",
          id,
          ts: Date.now(),
          topic,
          sections: sections.map((s) => ({
            title: s.title,
            rows: s.rows.map((r) => ({ key: r.key, text: r.text }))
          })),
          footer,
          oneTime
        });
        return id;
      },
      pushCtxPressureIfHigh(usedTokens, ctxMax) {
        if (ctxMax <= 0) return;
        const pct = usedTokens / ctxMax * 100;
        if (pct < 80) return;
        const tone = pct >= 95 ? "err" : "warn";
        const used = formatTok(usedTokens);
        const max = formatTok(ctxMax);
        dispatch({
          type: "live.show",
          id: nextId2("ctxp"),
          ts: Date.now(),
          variant: "ctxPressure",
          tone,
          text: `Context  ${used} / ${max}  \xB7  ${pct.toFixed(0)}%`,
          meta: pct >= 95 ? "trimming oldest turns to fit; expect short-term memory loss" : "approaching the budget; older turns will be dropped past 95%"
        });
      },
      pushStepProgress(stepIndex, total, title, elapsedMs) {
        const id = nextId2("step");
        const meta = elapsedMs !== void 0 ? `${(elapsedMs / 1e3).toFixed(1)}s \xB7 done` : "done";
        dispatch({
          type: "live.show",
          id,
          ts: Date.now(),
          variant: "stepProgress",
          tone: "ok",
          text: `Step ${stepIndex} of ${total}  \xB7  ${title}`,
          meta
        });
        return id;
      },
      pushPlanAnnounce(text) {
        const id = nextId2("plan");
        dispatch({
          type: "live.show",
          id,
          ts: Date.now(),
          variant: "stepProgress",
          tone: "accent",
          text: "\u229E Plan submitted",
          meta: text.slice(0, 80)
        });
        return id;
      },
      showDoctor(checks) {
        const id = nextId2("doc");
        dispatch({ type: "doctor.show", id, checks: [...checks] });
        return id;
      },
      showUsageVerbose(args) {
        const id = nextId2("cost");
        dispatch({
          type: "usage.show",
          id,
          turn: args.turn,
          tokens: {
            prompt: args.promptTokens,
            reason: args.reasonTokens,
            output: args.outputTokens,
            promptCap: args.promptCap
          },
          cacheHit: args.cacheHit,
          cost: args.cost,
          sessionCost: args.sessionCost,
          balance: args.balance,
          balanceCurrency: args.balanceCurrency,
          elapsedMs: args.elapsedMs
        });
        return id;
      },
      showPlan({ title, steps, variant }) {
        const id = nextId2("plan");
        dispatch({ type: "plan.show", id, title, steps, variant });
        return id;
      },
      completePlanStep(stepId) {
        dispatch({ type: "plan.step.complete", stepId });
      },
      showCtx(args) {
        const id = nextId2("ctx");
        dispatch({ type: "ctx.show", id, ...args, topTools: [...args.topTools] });
        return id;
      },
      startReasoning(model2) {
        const id = nextId2("r");
        dispatch({ type: "reasoning.start", id, ...model2 ? { model: model2 } : {} });
        return id;
      },
      appendReasoning(id, chunk) {
        if (chunk.length > 0) dispatch({ type: "reasoning.chunk", id, text: chunk });
      },
      endReasoning(id, paragraphs, tokens, aborted) {
        dispatch({ type: "reasoning.end", id, paragraphs, tokens, aborted });
      },
      startStreaming(model2) {
        const id = nextId2("s");
        dispatch({ type: "streaming.start", id, ...model2 ? { model: model2 } : {} });
        return id;
      },
      appendStreaming(id, chunk) {
        if (chunk.length > 0) dispatch({ type: "streaming.chunk", id, text: chunk });
      },
      endStreaming(id, aborted) {
        dispatch({ type: "streaming.end", id, aborted });
      },
      startTool(name, args, presetId) {
        const id = presetId ?? nextId2("tool");
        dispatch({ type: "tool.start", id, name, args });
        return id;
      },
      appendToolOutput(id, chunk) {
        if (chunk.length > 0) dispatch({ type: "tool.chunk", id, text: chunk });
      },
      endTool(id, info) {
        dispatch({
          type: "tool.end",
          id,
          output: info.output,
          exitCode: info.exitCode,
          elapsedMs: info.elapsedMs,
          aborted: info.aborted
        });
      },
      retryTool(id, attempt, max) {
        dispatch({ type: "tool.retry", id, attempt, max });
      },
      thinking() {
        const id = nextId2("think");
        dispatch({ type: "turn.thinking" });
        return id;
      },
      abortTurn() {
        dispatch({ type: "turn.abort" });
      },
      endTurn(usage, extras) {
        dispatch({
          type: "turn.end",
          usage,
          promptCap: extras?.promptCap,
          elapsedMs: extras?.elapsedMs
        });
      },
      reset() {
        dispatch({ type: "session.reset" });
      }
    }),
    [dispatch]
  );
}

// src/cli/ui/hooks/useTerminalSetup.ts
import { useStdout as useStdout11 } from "ink";
import { useEffect as useEffect9 } from "react";
function useTerminalSetup(mouse) {
  const { stdout } = useStdout11();
  useEffect9(() => {
    if (!stdout || !stdout.isTTY) return;
    stdout.write("\x1B[?2004h");
    stdout.write("\x1B[>4;2m");
    if (mouse) stdout.write("\x1B[?1007h");
    return () => {
      if (mouse) stdout.write("\x1B[?1007l");
      stdout.write("\x1B[?2004l");
      stdout.write("\x1B[>4m");
    };
  }, [stdout, mouse]);
}

// src/cli/ui/hooks/useToolProgressDisplay.ts
import { useCallback as useCallback8, useEffect as useEffect10, useState as useState23 } from "react";
function useToolProgressDisplay(progressSink) {
  const [ongoingTool, setOngoingTool] = useState23(null);
  const [toolProgress, setToolProgress] = useState23(null);
  const [statusLine, setStatusLine] = useState23(null);
  useEffect10(() => {
    if (!progressSink) return;
    progressSink.current = (info) => {
      setToolProgress({
        progress: info.progress,
        total: info.total,
        message: info.message
      });
    };
    return () => {
      if (progressSink.current) progressSink.current = null;
    };
  }, [progressSink]);
  const clear = useCallback8(() => {
    setOngoingTool(null);
    setToolProgress(null);
    setStatusLine(null);
  }, []);
  return {
    ongoingTool,
    setOngoingTool,
    toolProgress,
    setToolProgress,
    statusLine,
    setStatusLine,
    clear
  };
}

// src/cli/ui/hooks/useTranscriptWriter.ts
import { useCallback as useCallback9 } from "react";
function useTranscriptWriter(transcriptRef, model2, prefixHash) {
  return useCallback9(
    (ev) => {
      const stream = transcriptRef.current;
      if (!stream) return;
      writeRecord(stream, recordFromLoopEvent(ev, { model: model2, prefixHash }));
    },
    [transcriptRef, model2, prefixHash]
  );
}

// src/cli/ui/hooks/useWorkspaceRoot.ts
import {
  useEffect as useEffect11,
  useRef as useRef5,
  useState as useState24
} from "react";
function useWorkspaceRoot(launchRoot) {
  const [currentRootDir, setCurrentRootDir] = useState24(() => launchRoot ?? process.cwd());
  const currentRootDirRef = useRef5(currentRootDir);
  useEffect11(() => {
    currentRootDirRef.current = currentRootDir;
  }, [currentRootDir]);
  return { currentRootDir, setCurrentRootDir, currentRootDirRef };
}

// src/cli/ui/layout/CardStream.tsx
import { Box as Box49, Text as Text51, useBoxMetrics } from "ink";
import React59, { useEffect as useEffect12, useMemo as useMemo10, useRef as useRef6 } from "react";

// src/cli/ui/cards/CardRenderer.tsx
import { Box as Box48, Text as Text50 } from "ink";
import React57 from "react";

// src/cli/ui/cards/CtxCard.tsx
import { Box as Box31, Text as Text30 } from "ink";
import React36 from "react";

// src/cli/ui/primitives/Card.tsx
import { Box as Box29 } from "ink";
import React34, { useContext as useContext3 } from "react";
var ActiveCardContext = React34.createContext(true);
var STRIPE_BORDER = {
  topLeft: " ",
  top: " ",
  topRight: " ",
  left: "\u258E",
  right: " ",
  bottomLeft: " ",
  bottom: " ",
  bottomRight: " "
};
function Card({ tone, children }) {
  const active = useContext3(ActiveCardContext);
  if (!active) {
    return /* @__PURE__ */ React34.createElement(Box29, { flexDirection: "column" }, children);
  }
  return /* @__PURE__ */ React34.createElement(
    Box29,
    {
      flexDirection: "column",
      borderStyle: STRIPE_BORDER,
      borderColor: tone,
      borderTop: false,
      borderRight: false,
      borderBottom: false,
      paddingLeft: 1,
      marginTop: 1,
      width: "100%"
    },
    children
  );
}

// src/cli/ui/primitives/CardHeader.tsx
import { Box as Box30, Text as Text29 } from "ink";
import React35, { useContext as useContext4 } from "react";
function CardHeader({
  glyph,
  tone,
  title,
  titleColor,
  titleBg,
  subtitle,
  meta,
  right
}) {
  const active = useContext4(ActiveCardContext);
  const visibleMeta = active ? meta : meta?.filter((item) => typeof item !== "string");
  return /* @__PURE__ */ React35.createElement(Box30, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React35.createElement(Text29, { color: tone }, glyph), titleBg ? /* @__PURE__ */ React35.createElement(Text29, { backgroundColor: titleBg, color: titleColor ?? tone, bold: true }, ` ${title} `) : /* @__PURE__ */ React35.createElement(Text29, { bold: true, color: titleColor ?? tone }, title), subtitle ? /* @__PURE__ */ React35.createElement(Text29, { color: FG.body }, subtitle) : null, visibleMeta?.map((item, i) => {
    const isStr = typeof item === "string";
    const text = isStr ? item : item.text;
    const color = isStr ? FG.faint : item.color;
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: meta items are positional
      /* @__PURE__ */ React35.createElement(React35.Fragment, { key: `m-${i}` }, /* @__PURE__ */ React35.createElement(Text29, { color: FG.faint }, "\xB7"), /* @__PURE__ */ React35.createElement(Text29, { color }, text))
    );
  }), active ? right : null);
}

// src/cli/ui/cards/CtxCard.tsx
var BAR_CELLS = 32;
function row(label, tokens, ratio, color) {
  const filled = Math.max(0, Math.min(BAR_CELLS, Math.round(ratio * BAR_CELLS)));
  return /* @__PURE__ */ React36.createElement(Box31, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React36.createElement(Text30, { color: FG.sub }, label.padEnd(7)), /* @__PURE__ */ React36.createElement(Text30, { color }, "\u2588".repeat(filled)), /* @__PURE__ */ React36.createElement(Text30, { color: FG.faint }, "\u2591".repeat(BAR_CELLS - filled)), /* @__PURE__ */ React36.createElement(Text30, { bold: true, color: FG.body }, tokens.toLocaleString()), /* @__PURE__ */ React36.createElement(Text30, { color: FG.faint }, `\xB7 ${(ratio * 100).toFixed(1)}%`));
}
function CtxCard({ card }) {
  const cap = Math.max(1, card.ctxMax);
  const used = card.systemTokens + card.toolsTokens + card.logTokens + card.inputTokens;
  const usedPct = used / cap * 100;
  return /* @__PURE__ */ React36.createElement(Card, { tone: TONE.brand }, /* @__PURE__ */ React36.createElement(
    CardHeader,
    {
      glyph: "\u2318",
      tone: TONE.brand,
      title: t("cardTitles.context"),
      meta: [`${used.toLocaleString()} / ${cap.toLocaleString()} (${usedPct.toFixed(1)}%)`]
    }
  ), row(t("cardLabels.system"), card.systemTokens, card.systemTokens / cap, TONE.brand), row(t("cardLabels.tools"), card.toolsTokens, card.toolsTokens / cap, TONE.warn), row(t("cardLabels.log"), card.logTokens, card.logTokens / cap, TONE.ok), row(t("cardLabels.input"), card.inputTokens, card.inputTokens / cap, TONE.accent), card.topTools.length > 0 ? /* @__PURE__ */ React36.createElement(React36.Fragment, null, /* @__PURE__ */ React36.createElement(Text30, { color: FG.faint }, `${t("cardLabels.topTools")} \xB7 ${card.toolsCount} ${t("cardLabels.tools")} \xB7 ${card.logMessages} ${t("cardLabels.logMsgs")}`), card.topTools.slice(0, 5).map((tool) => /* @__PURE__ */ React36.createElement(Box31, { key: `${tool.turn}-${tool.name}`, flexDirection: "row", gap: 1 }, /* @__PURE__ */ React36.createElement(Text30, { color: FG.sub }, tool.name), /* @__PURE__ */ React36.createElement(
    Text30,
    {
      color: FG.faint
    },
    `\xB7 ${t("cardLabels.turn")} ${tool.turn} \xB7 ${tool.tokens.toLocaleString()}`
  )))) : null);
}

// src/cli/ui/cards/DiffCard.tsx
import { Box as Box32, Text as Text31 } from "ink";
import React37 from "react";
var LINE_COLOR = {
  ctx: FG.sub,
  add: TONE.ok,
  del: TONE.err,
  fold: FG.faint
};
var LINE_GLYPH = {
  ctx: " ",
  add: "+",
  del: "-",
  fold: "\u22EE"
};
function DiffCard({ card }) {
  const showFooter = card.hunks.length > 0;
  return /* @__PURE__ */ React37.createElement(Card, { tone: TONE.ok }, /* @__PURE__ */ React37.createElement(
    CardHeader,
    {
      glyph: "\xB1",
      tone: TONE.ok,
      title: card.file,
      titleColor: FG.body,
      meta: [
        { text: `+${card.stats.add}`, color: TONE.ok },
        { text: `-${card.stats.del}`, color: TONE.err }
      ]
    }
  ), card.hunks.map((hunk) => /* @__PURE__ */ React37.createElement(Box32, { key: `${card.id}:${hunk.header}`, flexDirection: "column" }, /* @__PURE__ */ React37.createElement(Text31, { italic: true, color: FG.faint }, hunk.header), hunk.lines.map((line, li) => /* @__PURE__ */ React37.createElement(Box32, { key: `${card.id}:${hunk.header}:${li}`, flexDirection: "row", gap: 1 }, /* @__PURE__ */ React37.createElement(Text31, { color: LINE_COLOR[line.kind] }, LINE_GLYPH[line.kind]), /* @__PURE__ */ React37.createElement(Text31, { color: LINE_COLOR[line.kind], dimColor: line.kind === "ctx" }, line.text))))), showFooter && /* @__PURE__ */ React37.createElement(Box32, { flexDirection: "row", gap: 2 }, /* @__PURE__ */ React37.createElement(Text31, { bold: true, color: TONE.ok }, t("cardLabels.applyAction")), /* @__PURE__ */ React37.createElement(Text31, { color: FG.sub }, t("cardLabels.skipAction")), /* @__PURE__ */ React37.createElement(Text31, { bold: true, color: TONE.err }, t("cardLabels.rejectAction"))));
}

// src/cli/ui/cards/DoctorCard.tsx
import { Box as Box33, Text as Text32 } from "ink";
import React38 from "react";
var LEVEL_GLYPH = {
  ok: "\u2713",
  warn: "\u26A0",
  fail: "\u2716"
};
function levelTag(level) {
  switch (level) {
    case "ok":
      return t("cardLabels.levelOk");
    case "warn":
      return t("cardLabels.levelWarn");
    case "fail":
      return t("cardLabels.levelFail");
  }
}
function DoctorCard({ card }) {
  const { fg, tone } = useThemeTokens();
  const levelColor = {
    ok: tone.ok,
    warn: tone.warn,
    fail: tone.err
  };
  const ok = card.checks.filter((c) => c.level === "ok").length;
  const warn = card.checks.filter((c) => c.level === "warn").length;
  const fail = card.checks.filter((c) => c.level === "fail").length;
  const labelWidth = card.checks.reduce((m, c) => Math.max(m, c.label.length), 0);
  const summary = `${card.checks.length} ${t("cardLabels.checksLabel")} \xB7 ${ok} ${t("cardLabels.passed")}${warn > 0 ? ` \xB7 ${warn} ${t("cardLabels.warnTag")}` : ""}${fail > 0 ? ` \xB7 ${fail} ${t("cardLabels.failTag")}` : ""}`;
  return /* @__PURE__ */ React38.createElement(Card, { tone: CARD.tool.color }, /* @__PURE__ */ React38.createElement(
    CardHeader,
    {
      glyph: "\u2695",
      tone: CARD.tool.color,
      title: t("cardTitles.doctor"),
      meta: [summary]
    }
  ), card.checks.map((c) => /* @__PURE__ */ React38.createElement(Box33, { key: c.label, flexDirection: "row", gap: 1 }, /* @__PURE__ */ React38.createElement(Text32, { color: levelColor[c.level] }, LEVEL_GLYPH[c.level]), /* @__PURE__ */ React38.createElement(Text32, { bold: true, color: fg.body }, c.label.padEnd(labelWidth + 1)), /* @__PURE__ */ React38.createElement(Text32, { color: fg.sub }, c.detail), /* @__PURE__ */ React38.createElement(Text32, { color: levelColor[c.level] }, levelTag(c.level)))));
}

// src/cli/ui/cards/ErrorCard.tsx
import { Box as Box34, Text as Text33 } from "ink";
import React39 from "react";
var STACK_TAIL = 5;
function ErrorCard({ card }) {
  const retryNote = card.retries !== void 0 && card.retries > 0 ? `${card.retries} ${t("cardLabels.retries")}` : null;
  const stackLines = card.stack ? card.stack.split("\n") : [];
  const stackTrunc = stackLines.length > STACK_TAIL;
  const stackVisible = stackTrunc ? stackLines.slice(-STACK_TAIL) : stackLines;
  const stackHidden = stackTrunc ? stackLines.length - stackVisible.length : 0;
  const hasStack = stackVisible.length > 0;
  const messageLines = card.message.split("\n");
  return /* @__PURE__ */ React39.createElement(Card, { tone: TONE.err }, /* @__PURE__ */ React39.createElement(
    CardHeader,
    {
      glyph: "\u2716",
      tone: TONE.err,
      title: card.title || t("cardTitles.error"),
      meta: retryNote ? [retryNote] : void 0
    }
  ), messageLines.map((line, i) => /* @__PURE__ */ React39.createElement(Text33, { key: `${card.id}:msg:${i}`, color: TONE.err }, line || " ")), hasStack ? /* @__PURE__ */ React39.createElement(Box34, { flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React39.createElement(Text33, { color: FG.meta }, t("cardLabels.stackTrace")), stackHidden > 0 ? /* @__PURE__ */ React39.createElement(Text33, { color: FG.faint }, t(
    stackHidden === 1 ? "cardLabels.earlierStackLine" : "cardLabels.earlierStackLines",
    { count: stackHidden }
  )) : null, stackVisible.map((line, i) => /* @__PURE__ */ React39.createElement(Text33, { key: `${card.id}:stk:${stackHidden + i}`, color: FG.meta }, line || " "))) : null);
}

// src/cli/ui/cards/LiveCard.tsx
import { Box as Box35, Text as Text35 } from "ink";
import React41 from "react";

// src/cli/ui/primitives/Spinner.tsx
import { Text as Text34 } from "ink";
import React40 from "react";
var FRAMES = {
  circle: ["\u25D0", "\u25D3", "\u25D1", "\u25D2"],
  braille: ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827"]
};
function Spinner({ kind = "circle", color, bold }) {
  const frames = FRAMES[kind];
  const tick = useTick();
  const frame = tick % frames.length;
  return /* @__PURE__ */ React40.createElement(Text34, { bold, color }, frames[frame]);
}

// src/cli/ui/cards/LiveCard.tsx
var TONE_TO_COLOR = {
  ok: TONE.ok,
  warn: TONE.warn,
  err: TONE.err,
  info: TONE.info,
  brand: TONE.brand,
  accent: TONE.accent,
  ghost: FG.meta
};
var VARIANT_GLYPH = {
  thinking: null,
  undo: "\u21B6",
  ctxPressure: "\u26A0",
  aborted: "\u2014",
  retry: "\u21BB",
  checkpoint: "\u26C1",
  stepProgress: "\u2713",
  mcpEvent: "\u2318",
  sessionOp: "\u25CD"
};
function LiveCard({ card }) {
  const color = TONE_TO_COLOR[card.tone];
  const glyph = VARIANT_GLYPH[card.variant];
  return /* @__PURE__ */ React41.createElement(Box35, { paddingLeft: 2, flexDirection: "row", gap: 1 }, card.variant === "thinking" ? /* @__PURE__ */ React41.createElement(Spinner, { kind: "circle", color, bold: true }) : /* @__PURE__ */ React41.createElement(Text35, { bold: true, color }, glyph), /* @__PURE__ */ React41.createElement(Text35, { color: FG.body }, card.text), card.meta !== void 0 ? /* @__PURE__ */ React41.createElement(Text35, { color: FG.faint }, `\xB7 ${card.meta}`) : null);
}

// src/cli/ui/cards/MemoryCard.tsx
import { Box as Box36, Text as Text36 } from "ink";
import React42 from "react";
var CATEGORY_ORDER = [
  "user",
  "feedback",
  "project",
  "reference"
];
function categoryLabel(c) {
  switch (c) {
    case "user":
      return t("cardLabels.categoryUser");
    case "feedback":
      return t("cardLabels.categoryFeedback");
    case "project":
      return t("cardLabels.categoryProject");
    case "reference":
      return t("cardLabels.categoryReference");
  }
}
var CATEGORY_GLYPH = {
  user: "\u25C7",
  feedback: "\u2726",
  project: "\u25C7",
  reference: "\u2192"
};
var CATEGORY_GLYPH_COLOR = {
  user: FG.meta,
  feedback: TONE.warn,
  project: FG.meta,
  reference: TONE.info
};
function MemoryCard({ card }) {
  const counts = countByCategory(card.entries);
  const summary = CATEGORY_ORDER.filter((c) => counts[c] > 0).map((c) => `${counts[c]} ${categoryLabel(c)}`).join(" \xB7 ");
  const tokens = card.tokens > 1024 ? `~${(card.tokens / 1024).toFixed(1)}K ${t("cardLabels.tok")}` : `~${card.tokens} ${t("cardLabels.tok")}`;
  return /* @__PURE__ */ React42.createElement(Card, { tone: FG.meta }, /* @__PURE__ */ React42.createElement(
    CardHeader,
    {
      glyph: "\u2311",
      tone: FG.meta,
      title: t("cardTitles.context"),
      titleColor: FG.sub,
      meta: summary ? [summary, tokens] : [tokens]
    }
  ), CATEGORY_ORDER.filter((c) => counts[c] > 0).map((category) => {
    const all = card.entries.filter((e) => e.category === category);
    const shown = all.slice(0, 5);
    const remaining = all.length - shown.length;
    return /* @__PURE__ */ React42.createElement(Box36, { key: category, flexDirection: "column" }, /* @__PURE__ */ React42.createElement(Text36, { color: FG.faint }, `${categoryLabel(category)} (${counts[category]})`), shown.map((entry) => /* @__PURE__ */ React42.createElement(Box36, { key: `${category}:${entry.summary}`, flexDirection: "row", gap: 1 }, /* @__PURE__ */ React42.createElement(Text36, { color: CATEGORY_GLYPH_COLOR[category] }, CATEGORY_GLYPH[category]), /* @__PURE__ */ React42.createElement(Text36, { color: FG.sub }, entry.summary))), remaining > 0 ? /* @__PURE__ */ React42.createElement(Text36, { color: FG.faint }, t("cardLabels.more", { count: remaining })) : null);
  }));
}
function countByCategory(entries) {
  const out = {
    user: 0,
    feedback: 0,
    project: 0,
    reference: 0
  };
  for (const e of entries) out[e.category] += 1;
  return out;
}

// src/cli/ui/cards/PlanCard.tsx
import { Box as Box37, Text as Text37 } from "ink";
import React43 from "react";
var STATUS_GLYPH = {
  queued: "\u25CB",
  running: "\u25B6",
  done: "\u2713",
  failed: "\u2717",
  blocked: "!",
  skipped: "s"
};
var VISIBLE_WINDOW = 5;
function PlanCard({ card }) {
  const { fg, tone, toneActive } = useThemeTokens();
  const statusColor = {
    queued: fg.faint,
    running: toneActive.brand,
    done: tone.ok,
    failed: tone.err,
    blocked: tone.warn,
    skipped: fg.faint
  };
  const doneCount = card.steps.filter((s) => s.status === "done").length;
  const variantTag = card.variant === "resumed" ? t("cardLabels.resumed") : card.variant === "replay" ? t("cardLabels.archive") : "";
  const progress = `${variantTag}${doneCount}/${card.steps.length} ${t("cardLabels.done")}`;
  const hasRunning = card.steps.some((s) => s.status === "running");
  const cardTone = hasRunning ? toneActive.accent : tone.accent;
  const window = pickWindow(card.steps);
  return /* @__PURE__ */ React43.createElement(Card, { tone: cardTone }, /* @__PURE__ */ React43.createElement(CardHeader, { glyph: "\u229E", tone: cardTone, title: card.title, meta: [progress] }), window.hiddenBefore > 0 ? /* @__PURE__ */ React43.createElement(Box37, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React43.createElement(Text37, { color: tone.ok }, "\u2713"), /* @__PURE__ */ React43.createElement(Text37, { color: fg.faint }, `\u22EF ${window.hiddenBefore} ${t("cardLabels.done")}`)) : null, window.steps.map((step) => {
    const isActive = step.status === "running";
    const titleColor = isActive ? fg.strong : fg.sub;
    return /* @__PURE__ */ React43.createElement(Box37, { key: step.id, flexDirection: "row", gap: 1 }, /* @__PURE__ */ React43.createElement(Text37, { color: statusColor[step.status] }, STATUS_GLYPH[step.status]), /* @__PURE__ */ React43.createElement(Text37, { bold: isActive, color: titleColor }, `${step.indexLabel}. ${step.title}`), isActive ? /* @__PURE__ */ React43.createElement(Text37, { color: toneActive.brand }, t("cardLabels.inProgress")) : null);
  }), window.hiddenAfter > 0 ? /* @__PURE__ */ React43.createElement(Box37, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React43.createElement(Text37, { color: fg.faint }, "\u25CB"), /* @__PURE__ */ React43.createElement(Text37, { color: fg.faint }, `\u22EF ${window.hiddenAfter} ${t("cardLabels.upcoming")}`)) : null);
}
function pickWindow(steps) {
  if (steps.length <= VISIBLE_WINDOW) {
    return {
      steps: steps.map((s, i) => ({ ...s, indexLabel: i + 1 })),
      hiddenBefore: 0,
      hiddenAfter: 0
    };
  }
  const anchor = anchorIndex(steps);
  const start = Math.max(0, Math.min(anchor, steps.length - VISIBLE_WINDOW));
  const end = start + VISIBLE_WINDOW;
  return {
    steps: steps.slice(start, end).map((s, i) => ({ ...s, indexLabel: start + i + 1 })),
    hiddenBefore: start,
    hiddenAfter: Math.max(0, steps.length - end)
  };
}
function anchorIndex(steps) {
  const runningIdx = steps.findIndex((s) => s.status === "running");
  if (runningIdx >= 0) return runningIdx;
  const firstPending = steps.findIndex((s) => s.status === "queued" || s.status === "blocked");
  if (firstPending >= 0) return firstPending;
  return Math.max(0, steps.length - VISIBLE_WINDOW);
}

// src/cli/ui/cards/ReasoningCard.tsx
import { Box as Box38, Text as Text39, useStdout as useStdout12 } from "ink";
import React45 from "react";

// src/cli/ui/primitives/CursorBlock.tsx
import { Text as Text38 } from "ink";
import React44 from "react";
function CursorBlock() {
  const tick = useTick();
  const on = Math.floor(tick / 4) % 2 === 0;
  return /* @__PURE__ */ React44.createElement(Text38, { inverse: on, color: CARD.streaming.color }, " ");
}

// src/cli/ui/cards/ReasoningCard.tsx
var STREAMING_PREVIEW_LINES = 3;
var SETTLED_HEAD_LINES = 2;
var SETTLED_TAIL_LINES = 2;
var XL_TOKEN_THRESHOLD = 800;
function ReasoningCard({
  card,
  expanded
}) {
  const { stdout } = useStdout12();
  const cols = stdout?.columns ?? 80;
  const lineCells = Math.max(20, cols - 4);
  const allLines = card.text.length > 0 ? card.text.split("\n") : [];
  const isEmpty = !card.streaming && !card.aborted && allLines.length === 0;
  const showBody = expanded && (allLines.length > 0 || card.streaming || isEmpty);
  const tone = card.aborted ? TONE.err : card.streaming ? TONE_ACTIVE.accent : TONE.accent;
  return /* @__PURE__ */ React45.createElement(Card, { tone }, /* @__PURE__ */ React45.createElement(ReasoningHeader, { card, isEmpty }), showBody && (isEmpty ? /* @__PURE__ */ React45.createElement(EmptyHint, null) : card.streaming ? /* @__PURE__ */ React45.createElement(StreamingPreview, { card, allLines, lineCells }) : /* @__PURE__ */ React45.createElement(SettledPreview, { card, allLines, lineCells })));
}
function ReasoningHeader({
  card,
  isEmpty
}) {
  const streamingActive = card.streaming && !card.aborted;
  const headColor = card.aborted ? TONE.err : streamingActive ? TONE_ACTIVE.accent : isEmpty ? FG.faint : TONE.accent;
  const glyph = streamingActive ? "\u25C7" : "\u25C6";
  const title = streamingActive ? t("cardTitles.reasoningEllipsis") : card.aborted ? t("cardTitles.reasoningAborted") : t("cardTitles.reasoning");
  const pill = isEmpty ? PILL_SECTION.empty : PILL_SECTION.reason;
  const meta = [];
  const m = headerMeta(card);
  if (m) meta.push(m);
  const duration = headerDuration(card);
  if (duration) meta.push(duration);
  const modelBadge = card.model ? modelBadgeFor(card.model) : null;
  return /* @__PURE__ */ React45.createElement(
    CardHeader,
    {
      glyph,
      tone: headColor,
      title,
      titleColor: pill.fg,
      titleBg: pill.bg,
      meta: meta.length > 0 ? meta : void 0,
      right: /* @__PURE__ */ React45.createElement(React45.Fragment, null, streamingActive ? /* @__PURE__ */ React45.createElement(Spinner, { kind: "braille", color: TONE_ACTIVE.accent }) : null, modelBadge ? /* @__PURE__ */ React45.createElement(Pill, { label: modelBadge.label, ...PILL_MODEL[modelBadge.kind], bold: false }) : null)
    }
  );
}
function headerMeta(card) {
  if (card.streaming) {
    return card.tokens > 0 ? `${card.tokens.toLocaleString()} ${t("cardLabels.tok")}` : "";
  }
  const parts = [];
  if (card.tokens > 0) parts.push(`${card.tokens.toLocaleString()} ${t("cardLabels.tok")}`);
  if (card.paragraphs > 0) parts.push(`${card.paragraphs} ${t("cardLabels.pilcrow")}`);
  return parts.join(" \xB7 ");
}
function headerDuration(card) {
  if (card.streaming || !card.endedAt) return "";
  const seconds = Math.max(0, (card.endedAt - card.ts) / 1e3);
  return `${seconds.toFixed(1)}s`;
}
function StreamingPreview({ card, allLines, lineCells }) {
  const visualLines = allLines.flatMap((l) => wrapToCells(l, lineCells));
  const visible = visualLines.slice(-STREAMING_PREVIEW_LINES);
  const hasOverflow = visualLines.length > visible.length;
  return /* @__PURE__ */ React45.createElement(React45.Fragment, null, hasOverflow ? /* @__PURE__ */ React45.createElement(Text39, { color: FG.faint }, "\u22EE") : null, /* @__PURE__ */ React45.createElement(
    BodyLines,
    {
      card,
      lines: visible,
      lineCells,
      anchor: !hasOverflow,
      cursorOnLast: true
    }
  ));
}
function SettledPreview({ card, allLines, lineCells }) {
  const visualLines = allLines.flatMap((l) => wrapToCells(l, lineCells));
  if (card.tokens >= XL_TOKEN_THRESHOLD) {
    const visible = visualLines.slice(-SETTLED_TAIL_LINES);
    const droppedLines = Math.max(0, visualLines.length - visible.length);
    return /* @__PURE__ */ React45.createElement(React45.Fragment, null, droppedLines > 0 ? /* @__PURE__ */ React45.createElement(ScrollPastHint, { card }) : null, /* @__PURE__ */ React45.createElement(BodyLines, { card, lines: visible, lineCells, indexOffset: droppedLines }));
  }
  const totalShown = SETTLED_HEAD_LINES + SETTLED_TAIL_LINES;
  if (visualLines.length <= totalShown) {
    return /* @__PURE__ */ React45.createElement(BodyLines, { card, lines: visualLines, lineCells, anchor: true });
  }
  const headLines = visualLines.slice(0, SETTLED_HEAD_LINES);
  const tailLines = visualLines.slice(-SETTLED_TAIL_LINES);
  const droppedMid = visualLines.length - headLines.length - tailLines.length;
  return /* @__PURE__ */ React45.createElement(React45.Fragment, null, /* @__PURE__ */ React45.createElement(BodyLines, { card, lines: headLines, lineCells, anchor: true }), /* @__PURE__ */ React45.createElement(MidElisionHint, { droppedLines: droppedMid }), /* @__PURE__ */ React45.createElement(
    BodyLines,
    {
      card,
      lines: tailLines,
      lineCells,
      indexOffset: headLines.length + droppedMid
    }
  ));
}
function EmptyHint() {
  return /* @__PURE__ */ React45.createElement(Text39, { italic: true, color: FG.faint }, "no thinking \u2014 direct answer");
}
function BodyLines({
  card,
  lines,
  lineCells,
  cursorOnLast = false,
  indexOffset = 0,
  anchor = false
}) {
  const tone = card.aborted ? TONE.err : card.streaming ? TONE_ACTIVE.accent : TONE.accent;
  const innerCells = lineCells - (anchor ? 2 : 0);
  return /* @__PURE__ */ React45.createElement(React45.Fragment, null, lines.map((line, i) => {
    const isLast = i === lines.length - 1;
    const isFirst = i === 0;
    return /* @__PURE__ */ React45.createElement(Box38, { key: `${card.id}:b:${indexOffset + i}`, flexDirection: "row", gap: 1 }, anchor ? /* @__PURE__ */ React45.createElement(Text39, { color: tone }, isFirst ? "\u21B3" : " ") : null, /* @__PURE__ */ React45.createElement(Text39, { italic: true, color: FG.meta }, clipToCells(line, innerCells)), isLast && cursorOnLast && /* @__PURE__ */ React45.createElement(CursorBlock, null));
  }));
}
function MidElisionHint({ droppedLines }) {
  return /* @__PURE__ */ React45.createElement(Text39, { color: FG.faint }, `\u22EF ${droppedLines} line${droppedLines === 1 ? "" : "s"} elided`);
}
function ScrollPastHint({ card }) {
  const parts = [];
  if (card.paragraphs > 0) parts.push(`${card.paragraphs} \xB6`);
  if (card.tokens > 0) parts.push(`~${card.tokens.toLocaleString()} tok`);
  return /* @__PURE__ */ React45.createElement(Text39, { color: FG.faint }, `\u22EF ${parts.join(" + ")} scrolled past \xB7 /reasoning last`);
}

// src/cli/ui/cards/SearchCard.tsx
import { Box as Box39, Text as Text40 } from "ink";
import React46 from "react";
function SearchCard({ card }) {
  const fileCount = new Set(card.hits.map((h) => h.file)).size;
  const elapsed = `${(card.elapsedMs / 1e3).toFixed(2)}s`;
  const stats2 = t(card.hits.length === 1 ? "cardLabels.hitSingular" : "cardLabels.hitsPlural", {
    count: card.hits.length,
    files: fileCount
  });
  const grouped = groupByFile(card.hits.slice(0, 10));
  return /* @__PURE__ */ React46.createElement(Card, { tone: TONE.info }, /* @__PURE__ */ React46.createElement(
    CardHeader,
    {
      glyph: "\u2299",
      tone: TONE.info,
      title: t("cardTitles.search"),
      subtitle: `"${card.query}"`,
      meta: [stats2, elapsed]
    }
  ), grouped.map(([file, hits]) => /* @__PURE__ */ React46.createElement(Box39, { key: file, flexDirection: "column" }, /* @__PURE__ */ React46.createElement(Text40, { bold: true, color: FG.strong }, file), hits.map((h, i) => /* @__PURE__ */ React46.createElement(Box39, { key: `${file}:${h.line}:${i}`, flexDirection: "row", gap: 1 }, /* @__PURE__ */ React46.createElement(Text40, { color: FG.faint }, `${h.line.toString().padStart(4)} \u2502`), /* @__PURE__ */ React46.createElement(HighlightedLine, { text: h.preview, start: h.matchStart, end: h.matchEnd }))))), card.hits.length > 10 ? /* @__PURE__ */ React46.createElement(Text40, { color: FG.faint }, t(
    card.hits.length - 10 === 1 ? "cardLabels.moreHitSingular" : "cardLabels.moreHitsPlural",
    { count: card.hits.length - 10 }
  )) : null);
}
function HighlightedLine({
  text,
  start,
  end
}) {
  if (start < 0 || end <= start || end > text.length) {
    return /* @__PURE__ */ React46.createElement(Text40, { color: FG.sub }, text);
  }
  return /* @__PURE__ */ React46.createElement(React46.Fragment, null, /* @__PURE__ */ React46.createElement(Text40, { color: FG.sub }, text.slice(0, start)), /* @__PURE__ */ React46.createElement(Text40, { bold: true, inverse: true }, text.slice(start, end)), /* @__PURE__ */ React46.createElement(Text40, { color: FG.sub }, text.slice(end)));
}
function groupByFile(hits) {
  const map = /* @__PURE__ */ new Map();
  for (const h of hits) {
    const list2 = map.get(h.file) ?? [];
    list2.push(h);
    map.set(h.file, list2);
  }
  return Array.from(map.entries());
}

// src/cli/ui/cards/StreamingCard.tsx
import { Box as Box41, Text as Text42, useStdout as useStdout14 } from "ink";
import React48, { useContext as useContext5 } from "react";

// src/cli/ui/layout/LiveExpandContext.ts
import { createContext as createContext3 } from "react";
var LiveExpandContext = createContext3(false);

// src/cli/ui/markdown.tsx
import { highlight, supportsLanguage } from "cli-highlight";
import { Box as Box40, Text as Text41, Transform as Transform2, useStdout as useStdout13 } from "ink";
import React47 from "react";
import stringWidth from "string-width";
var BODY_LEFT_CELLS = 7;
var MarkdownWidthCtx = React47.createContext(void 0);
function useWidth() {
  const ctx = React47.useContext(MarkdownWidthCtx);
  if (ctx !== void 0) return ctx;
  return (useStdout13()?.stdout?.columns ?? process.stdout.columns ?? 80) - BODY_LEFT_CELLS;
}
marked.setOptions({ gfm: true, breaks: false });
function Markdown({ text, width }) {
  const tokens = React47.useMemo(() => marked.lexer(text), [text]);
  const ctxWidth = width !== void 0 ? Math.max(1, width) : void 0;
  return /* @__PURE__ */ React47.createElement(MarkdownWidthCtx.Provider, { value: ctxWidth }, /* @__PURE__ */ React47.createElement(Box40, { flexDirection: "column", gap: 1 }, tokens.map((token, i) => /* @__PURE__ */ React47.createElement(BlockToken, { key: `${i}-${token.type}`, token }))));
}
function BlockToken({ token }) {
  switch (token.type) {
    case "heading":
      return /* @__PURE__ */ React47.createElement(Heading, { token });
    case "paragraph":
      return /* @__PURE__ */ React47.createElement(Paragraph, { token });
    case "list":
      return /* @__PURE__ */ React47.createElement(List, { token, depth: 0 });
    case "code":
      return /* @__PURE__ */ React47.createElement(CodeBlock2, { token });
    case "blockquote":
      return /* @__PURE__ */ React47.createElement(Blockquote, { token });
    case "hr":
      return /* @__PURE__ */ React47.createElement(HorizontalRule, null);
    case "table":
      return /* @__PURE__ */ React47.createElement(Table, { token });
    case "html":
      return /* @__PURE__ */ React47.createElement(Text41, { color: FG.body }, token.text);
    case "space":
      return null;
    default:
      return /* @__PURE__ */ React47.createElement(Text41, { color: FG.body }, token.raw ?? "");
  }
}
function Heading({ token }) {
  return /* @__PURE__ */ React47.createElement(Box40, null, /* @__PURE__ */ React47.createElement(Text41, { bold: true, color: FG.strong, backgroundColor: SURFACE.bgElev }, ` ${plainText(token.tokens)} `));
}
function Paragraph({ token }) {
  return /* @__PURE__ */ React47.createElement(Text41, { color: FG.body }, /* @__PURE__ */ React47.createElement(Inline, { tokens: token.tokens ?? [] }));
}
function List({ token, depth }) {
  return /* @__PURE__ */ React47.createElement(Box40, { flexDirection: "column" }, token.items.map((item, i) => /* @__PURE__ */ React47.createElement(
    ListItem,
    {
      key: `${i}-${item.text.slice(0, 24)}`,
      item,
      ordered: token.ordered,
      index: i + (Number(token.start) || 1),
      depth
    }
  )));
}
function ListItem({
  item,
  ordered,
  index,
  depth
}) {
  const marker = item.task ? item.checked ? "\u2713" : "\u25CB" : ordered ? `${index}.` : "\xB7";
  const markerColor = item.task ? item.checked ? TONE.ok : FG.faint : FG.meta;
  const dim = item.task && item.checked === true;
  const indent = " ".repeat(depth + 1);
  return /* @__PURE__ */ React47.createElement(Box40, null, /* @__PURE__ */ React47.createElement(Text41, { color: markerColor }, `${indent}${marker} `), /* @__PURE__ */ React47.createElement(Box40, { flexDirection: "column" }, item.tokens.map((tok, i) => {
    if (tok.type === "text") {
      const inner = tok.tokens;
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: list-item children are positional and stable per render
        /* @__PURE__ */ React47.createElement(Text41, { key: `t-${i}`, color: dim ? FG.faint : FG.body, strikethrough: dim }, inner ? /* @__PURE__ */ React47.createElement(Inline, { tokens: inner }) : tok.text)
      );
    }
    if (tok.type === "list") {
      return /* @__PURE__ */ React47.createElement(List, { key: `l-${i}`, token: tok, depth: depth + 1 });
    }
    return /* @__PURE__ */ React47.createElement(BlockToken, { key: `b-${i}-${tok.type}`, token: tok });
  })));
}
function CodeBlock2({ token }) {
  const lang = token.lang?.split(/\s+/)[0] ?? "";
  const colored = highlightCode(decodeHtmlEntities(token.text), lang);
  const lines = colored.split("\n");
  return /* @__PURE__ */ React47.createElement(Box40, { flexDirection: "column" }, lang ? /* @__PURE__ */ React47.createElement(Box40, null, /* @__PURE__ */ React47.createElement(Text41, { color: FG.meta }, ` ${lang}`)) : null, /* @__PURE__ */ React47.createElement(Box40, { flexDirection: "column" }, lines.map((line, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: code lines are positional and stable per render
    /* @__PURE__ */ React47.createElement(Text41, { key: `code-${i}`, backgroundColor: SURFACE.bgElev }, ` ${line} `)
  ))));
}
function highlightCode(source, lang) {
  if (!lang) return source;
  try {
    if (supportsLanguage(lang)) return highlight(source, { language: lang, ignoreIllegals: true });
    return highlight(source, { ignoreIllegals: true });
  } catch {
    return source;
  }
}
function Blockquote({ token }) {
  return /* @__PURE__ */ React47.createElement(Box40, { flexDirection: "column" }, (token.tokens ?? []).map((child, i) => /* @__PURE__ */ React47.createElement(Box40, { key: `${i}-${child.type}`, flexDirection: "row" }, /* @__PURE__ */ React47.createElement(Text41, { color: TONE.brand }, " \u258E "), /* @__PURE__ */ React47.createElement(Box40, { flexDirection: "column", flexGrow: 1 }, child.type === "paragraph" ? /* @__PURE__ */ React47.createElement(Text41, { italic: true, color: FG.sub }, /* @__PURE__ */ React47.createElement(Inline, { tokens: child.tokens ?? [] })) : /* @__PURE__ */ React47.createElement(BlockToken, { token: child })))));
}
function padToCells(text, cells) {
  const w = stringWidth(text);
  if (w >= cells) return text;
  return text + " ".repeat(cells - w);
}
function HorizontalRule() {
  const width = useWidth();
  const rule = "\u2500".repeat(Math.max(width, 1));
  return /* @__PURE__ */ React47.createElement(Text41, { color: FG.faint }, ` ${rule}`);
}
function tableLayout(headerCells, bodyCells, availableWidth) {
  const colCount = headerCells.length;
  const GAP = " ";
  const GAP_W = stringWidth(GAP);
  const widths = new Array(colCount).fill(0);
  for (let c = 0; c < colCount; c++) {
    widths[c] = Math.max(
      stringWidth(headerCells[c] ?? ""),
      ...bodyCells.map((r) => stringWidth(r[c] ?? ""))
    );
  }
  const totalWidth = widths.reduce((s, w) => s + w, 0) + GAP_W * (colCount - 1);
  if (totalWidth <= availableWidth) {
    return { fallback: false, widths, colCount, gap: GAP };
  }
  const rawLabel = Math.max(...headerCells.map((h) => stringWidth(h))) + 2;
  const labelPad = Math.min(rawLabel, availableWidth - 1);
  const valueCells = availableWidth - labelPad;
  return { fallback: true, labelPad, valueCells };
}
function Table({ token }) {
  const width = useWidth();
  const headerCells = token.header.map((c) => plainText(c.tokens));
  const bodyCells = token.rows.map((row2) => row2.map((c) => plainText(c.tokens)));
  const layout = tableLayout(headerCells, bodyCells, width);
  if (!layout.fallback)
    return /* @__PURE__ */ React47.createElement(
      ColumnarTable,
      {
        headerCells,
        bodyCells,
        widths: layout.widths,
        colCount: headerCells.length,
        gap: layout.gap
      }
    );
  return /* @__PURE__ */ React47.createElement(
    FallbackTable,
    {
      headerCells,
      bodyCells,
      labelPad: layout.labelPad,
      valueCells: layout.valueCells
    }
  );
}
function ColumnarTable({
  headerCells,
  bodyCells,
  widths,
  colCount,
  gap
}) {
  const ruleRow = widths.map((w) => "\u2500".repeat(w)).join(gap);
  return /* @__PURE__ */ React47.createElement(Box40, { flexDirection: "column" }, /* @__PURE__ */ React47.createElement(Box40, null, /* @__PURE__ */ React47.createElement(Text41, null, " "), headerCells.map((cell, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: header cells positional
    /* @__PURE__ */ React47.createElement(React47.Fragment, { key: `h-${i}` }, /* @__PURE__ */ React47.createElement(Text41, { bold: true, color: FG.sub }, padToCells(cell, widths[i])), i < colCount - 1 ? /* @__PURE__ */ React47.createElement(Text41, null, gap) : null)
  ))), /* @__PURE__ */ React47.createElement(Box40, null, /* @__PURE__ */ React47.createElement(Text41, null, " "), /* @__PURE__ */ React47.createElement(Text41, { color: FG.faint }, ruleRow)), bodyCells.map((row2, ri) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: body rows positional
    /* @__PURE__ */ React47.createElement(Box40, { key: `tr-${ri}` }, /* @__PURE__ */ React47.createElement(Text41, null, " "), row2.map((cell, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: cells positional
      /* @__PURE__ */ React47.createElement(React47.Fragment, { key: `c-${ri}-${i}` }, /* @__PURE__ */ React47.createElement(Text41, { color: FG.body }, padToCells(cell ?? "", widths[i])), i < colCount - 1 ? /* @__PURE__ */ React47.createElement(Text41, null, gap) : null)
    )))
  )));
}
function FallbackTable({
  headerCells,
  bodyCells,
  labelPad,
  valueCells
}) {
  return /* @__PURE__ */ React47.createElement(Box40, { flexDirection: "column" }, bodyCells.map((row2, ri) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: body rows positional
    /* @__PURE__ */ React47.createElement(Box40, { key: `fr-${ri}`, flexDirection: "column" }, ri > 0 ? /* @__PURE__ */ React47.createElement(Text41, null, " ") : null, headerCells.map((h, ci) => {
      const label = `${padToCells(h, labelPad - 2)}: `;
      const lines = wrapToCells(row2[ci] ?? "", valueCells);
      return lines.map((line, li) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fallback table lines are positional
        /* @__PURE__ */ React47.createElement(Box40, { key: `fc-${ri}-${ci}-${li}` }, li === 0 ? /* @__PURE__ */ React47.createElement(Text41, { bold: true, color: FG.sub }, label) : /* @__PURE__ */ React47.createElement(Text41, null, padToCells("", labelPad)), /* @__PURE__ */ React47.createElement(Text41, { color: FG.body }, line))
      ));
    }))
  )));
}
function Inline({ tokens }) {
  return /* @__PURE__ */ React47.createElement(React47.Fragment, null, tokens.map((tok, i) => /* @__PURE__ */ React47.createElement(InlineToken, { key: `${i}-${tok.type}`, token: tok })));
}
var FILE_REF_RE2 = /\b([A-Za-z0-9_./@\-]+\.[A-Za-z0-9]{1,6})(?::(\d+)(?:-(\d+))?)?\b/g;
var MENTION_RE = /(?<![A-Za-z0-9_])@([A-Za-z0-9_./\-]+\.[A-Za-z0-9]{1,6})/g;
function looksLikeFileRef(path, hasLine) {
  if (hasLine) return true;
  if (path.includes("/")) return true;
  const ext = path.split(".").pop() ?? "";
  return ext.length >= 2;
}
function osc8(children, target, color) {
  return /* @__PURE__ */ React47.createElement(Transform2, { transform: (text) => `\x1B]8;;${target}\x1B\\${text}\x1B]8;;\x1B\\` }, /* @__PURE__ */ React47.createElement(Text41, { color, underline: true }, children));
}
function renderInlineText(raw) {
  if (!raw) return /* @__PURE__ */ React47.createElement(Text41, null, raw);
  const out = [];
  let cursor = 0;
  const hits = [];
  for (const m of raw.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const path = m[1];
    hits.push({
      start,
      end,
      node: /* @__PURE__ */ React47.createElement(Text41, { color: TONE.warn, underline: true }, `@${path}`)
    });
  }
  for (const m of raw.matchAll(FILE_REF_RE2)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (hits.some((h) => start < h.end && end > h.start)) continue;
    const path = m[1];
    const line = m[2];
    if (!looksLikeFileRef(path, line !== void 0)) continue;
    const target = line ? `file://${path}:${line}` : `file://${path}`;
    hits.push({ start, end, node: osc8(m[0], target, TONE.brand) });
  }
  hits.sort((a, b) => a.start - b.start);
  let key = 0;
  for (const h of hits) {
    if (h.start > cursor) {
      out.push(/* @__PURE__ */ React47.createElement(Text41, { key: `t-${key++}` }, raw.slice(cursor, h.start)));
    }
    out.push(/* @__PURE__ */ React47.createElement(React47.Fragment, { key: `r-${key++}` }, h.node));
    cursor = h.end;
  }
  if (cursor < raw.length) out.push(/* @__PURE__ */ React47.createElement(Text41, { key: `t-${key++}` }, raw.slice(cursor)));
  return /* @__PURE__ */ React47.createElement(React47.Fragment, null, out);
}
function InlineToken({ token }) {
  switch (token.type) {
    case "text": {
      const t2 = token;
      return t2.tokens ? /* @__PURE__ */ React47.createElement(Inline, { tokens: t2.tokens }) : renderInlineText(t2.text);
    }
    case "strong":
      return /* @__PURE__ */ React47.createElement(Text41, { bold: true, color: FG.strong }, /* @__PURE__ */ React47.createElement(Inline, { tokens: token.tokens }));
    case "em":
      return /* @__PURE__ */ React47.createElement(Text41, { italic: true }, /* @__PURE__ */ React47.createElement(Inline, { tokens: token.tokens }));
    case "codespan":
      return /* @__PURE__ */ React47.createElement(Text41, { color: FG.strong, backgroundColor: SURFACE.bgElev }, ` ${decodeHtmlEntities(token.text)} `);
    case "del":
      return /* @__PURE__ */ React47.createElement(Text41, { color: TONE.err, strikethrough: true }, /* @__PURE__ */ React47.createElement(Inline, { tokens: token.tokens }));
    case "link": {
      const l = token;
      return osc8(/* @__PURE__ */ React47.createElement(Inline, { tokens: l.tokens }), l.href, TONE.brand);
    }
    case "image": {
      const im = token;
      return /* @__PURE__ */ React47.createElement(Text41, { color: TONE.brand }, `[image: ${im.text || im.href}]`);
    }
    case "br":
      return /* @__PURE__ */ React47.createElement(Text41, null, "\n");
    case "escape":
      return /* @__PURE__ */ React47.createElement(Text41, null, token.text);
    case "html":
      return /* @__PURE__ */ React47.createElement(Text41, null, token.text);
    default:
      return /* @__PURE__ */ React47.createElement(Text41, null, token.raw ?? "");
  }
}
function plainText(tokens) {
  if (!tokens) return "";
  let out = "";
  for (const t2 of tokens) {
    switch (t2.type) {
      case "text":
        out += t2.text;
        break;
      case "strong":
      case "em":
      case "del":
      case "link":
        out += plainText(t2.tokens ?? []);
        break;
      case "codespan":
        out += decodeHtmlEntities(t2.text);
        break;
      case "br":
        out += "\n";
        break;
      case "escape":
        out += t2.text;
        break;
      default:
        out += t2.raw ?? "";
    }
  }
  return out;
}

// src/cli/ui/cards/StreamingCard.tsx
var STREAMING_PREVIEW_LINES2 = 4;
var EXPANDED_MAX_LINES = 60;
var MIN_ELAPSED_MS_FOR_RATE = 500;
var MIN_TOKENS_FOR_RATE = 4;
var LIVE_TOKEN_CALIBRATION_CHARS = 500;
var ESTIMATED_CHARS_PER_TOKEN = 4;
function formatTokenCount(n) {
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}k`;
  return String(n);
}
function rateFromTokens(tokens, startTs, endTs) {
  const elapsedMs = endTs - startTs;
  if (elapsedMs < MIN_ELAPSED_MS_FOR_RATE || tokens < MIN_TOKENS_FOR_RATE) {
    return { tokens, tps: null };
  }
  return { tokens, tps: Math.round(tokens * 1e3 / elapsedMs) };
}
function tokenRate(text, startTs, endTs) {
  return rateFromTokens(countTokens(text), startTs, endTs);
}
function estimateLiveTokenCount(text, cardId, calibration, countFn = countTokens) {
  const chars = text.length;
  const shouldCalibrate = chars > 0 && (!calibration || calibration.cardId !== cardId || chars < calibration.chars || calibration.chars === 0 && chars > 0 || chars - calibration.chars >= LIVE_TOKEN_CALIBRATION_CHARS);
  if (shouldCalibrate) {
    const tokens = countFn(text);
    return { tokens, calibration: { cardId, chars, tokens }, exact: true };
  }
  const base = calibration?.cardId === cardId && chars >= calibration.chars ? calibration : null;
  const baseChars = base?.chars ?? 0;
  const baseTokens = base?.tokens ?? 0;
  const estimatedDelta = Math.ceil(Math.max(0, chars - baseChars) / ESTIMATED_CHARS_PER_TOKEN);
  return {
    tokens: baseTokens + estimatedDelta,
    calibration: base ?? { cardId, chars: 0, tokens: 0 },
    exact: false
  };
}
function useLiveTokenRate(card, enabled) {
  const calibrationRef = React48.useRef(null);
  if (!enabled) return { tokens: 0, tps: null };
  const estimate = estimateLiveTokenCount(card.text, card.id, calibrationRef.current);
  calibrationRef.current = estimate.calibration;
  return rateFromTokens(estimate.tokens, card.ts, Date.now());
}
var PILL_RATE = { bg: "#11141a", fg: "#8b949e" };
function StreamingCard({ card }) {
  const { stdout } = useStdout14();
  const cols = stdout?.columns ?? 80;
  const expanded = useContext5(LiveExpandContext);
  const reserveCap = expanded ? EXPANDED_MAX_LINES + 2 : STREAMING_PREVIEW_LINES2 + 2;
  useReserveRows("stream", {
    min: STREAMING_PREVIEW_LINES2 + 1,
    max: reserveCap
  });
  useSlowTick();
  const liveRate = useLiveTokenRate(card, !card.done && !card.aborted);
  const modelBadge = card.model ? modelBadgeFor(card.model) : null;
  const modelPill = modelBadge ? /* @__PURE__ */ React48.createElement(Pill, { label: modelBadge.label, ...PILL_MODEL[modelBadge.kind], bold: false }) : null;
  if (card.done && !card.aborted) {
    const { tokens, tps } = tokenRate(card.text, card.ts, card.endedAt ?? Date.now());
    const ratePill = tokens >= MIN_TOKENS_FOR_RATE && tps !== null ? /* @__PURE__ */ React48.createElement(Pill, { label: `${formatTokenCount(tokens)} tok \xB7 ${tps} t/s`, ...PILL_RATE, bold: false }) : null;
    return /* @__PURE__ */ React48.createElement(Card, { tone: TONE.ok }, /* @__PURE__ */ React48.createElement(
      CardHeader,
      {
        glyph: "\u2039",
        tone: TONE.ok,
        title: t("cardTitles.reply"),
        right: /* @__PURE__ */ React48.createElement(React48.Fragment, null, ratePill, modelPill)
      }
    ), /* @__PURE__ */ React48.createElement(Markdown, { text: card.text }));
  }
  const lineCells = Math.max(20, cols - 4);
  const allLines = card.text.length > 0 ? card.text.split("\n") : [""];
  const visualLines = allLines.flatMap((l) => wrapToCells(l, lineCells));
  const cap = expanded ? EXPANDED_MAX_LINES : STREAMING_PREVIEW_LINES2;
  const visible = visualLines.slice(-cap);
  const droppedAbove = Math.max(0, visualLines.length - visible.length);
  const aborted = !!card.aborted;
  const headColor = aborted ? TONE.err : TONE_ACTIVE.brand;
  const glyph = aborted ? "\u2039" : "\u25C8";
  const headLabel = aborted ? t("cardLabels.aborted") : t("cardLabels.writing");
  const liveRatePill = !aborted && liveRate.tokens >= MIN_TOKENS_FOR_RATE && liveRate.tps !== null ? /* @__PURE__ */ React48.createElement(Pill, { label: `${liveRate.tps} t/s`, ...PILL_RATE, bold: false }) : null;
  const expandPill = !aborted ? /* @__PURE__ */ React48.createElement(Pill, { label: expanded ? "expanded \u2303o" : "preview \u2303o", ...PILL_RATE, bold: false }) : null;
  return /* @__PURE__ */ React48.createElement(Card, { tone: headColor }, /* @__PURE__ */ React48.createElement(
    CardHeader,
    {
      glyph,
      tone: headColor,
      title: headLabel,
      right: /* @__PURE__ */ React48.createElement(React48.Fragment, null, liveRatePill, expandPill, aborted ? null : /* @__PURE__ */ React48.createElement(Spinner, { kind: "braille", color: TONE_ACTIVE.brand }), modelPill)
    }
  ), expanded && droppedAbove > 0 ? /* @__PURE__ */ React48.createElement(Text42, { color: FG.faint }, t(droppedAbove === 1 ? "cardLabels.earlierLine" : "cardLabels.earlierLines", {
    count: droppedAbove
  })) : null, visible.map((line, i) => /* @__PURE__ */ React48.createElement(Box41, { key: `${card.id}:${visualLines.length - visible.length + i}`, flexDirection: "row" }, /* @__PURE__ */ React48.createElement(Text42, { color: aborted ? FG.meta : FG.body }, clipToCells(line, lineCells)))), aborted ? /* @__PURE__ */ React48.createElement(Text42, { color: FG.faint }, t("cardLabels.truncatedByEsc")) : null);
}

// src/cli/ui/cards/SubAgentCard.tsx
import { Box as Box42, Text as Text43 } from "ink";
import React49, { useContext as useContext6 } from "react";
function SubAgentCard({ card }) {
  const { fg, tone, toneActive } = useThemeTokens();
  const statusColor = {
    running: toneActive.violet,
    done: tone.ok,
    failed: tone.err
  };
  const headColor = statusColor[card.status];
  const headGlyph = card.status === "failed" ? "\u2717" : "\u232C";
  const runningChildren = card.children.filter((c) => !isChildDone(c)).length;
  const isRunning = card.status === "running";
  const inLive = useContext6(ActiveCardContext);
  const headerMeta2 = isRunning ? runningChildren > 0 ? [`${runningChildren} ${t("cardLabels.runningLabel")}`] : [t("cardLabels.workingLabel")] : [{ text: card.status, color: headColor }];
  return /* @__PURE__ */ React49.createElement(Card, { tone: headColor }, /* @__PURE__ */ React49.createElement(
    CardHeader,
    {
      glyph: headGlyph,
      tone: headColor,
      title: t("cardTitles.subagent"),
      titleColor: tone.violet,
      subtitle: card.task,
      meta: headerMeta2
    }
  ), card.name ? /* @__PURE__ */ React49.createElement(Text43, { color: fg.faint }, `${t("cardLabels.agent")} \xB7 ${card.name}`) : null, card.tools && card.tools.length > 0 && /* @__PURE__ */ React49.createElement(Text43, { color: fg.faint }, `${t("cardLabels.tools")} \xB7 ${card.tools.join(", ")}`), card.children.map((child) => /* @__PURE__ */ React49.createElement(Box42, { key: child.id, flexDirection: "row", gap: 1 }, inLive ? null : /* @__PURE__ */ React49.createElement(Text43, { color: tone.violet }, "\u258E"), /* @__PURE__ */ React49.createElement(ChildRow, { card: child }))));
}
function isChildDone(card) {
  switch (card.kind) {
    case "tool":
    case "streaming":
      return card.done;
    case "reasoning":
      return !card.streaming;
    default:
      return true;
  }
}
function ChildRow({ card }) {
  const { fg, tone } = useThemeTokens();
  const v = childVisual(card, tone.ok, tone.err, fg.faint);
  const isDone = isChildDone(card);
  return /* @__PURE__ */ React49.createElement(React49.Fragment, null, v.statusGlyph, /* @__PURE__ */ React49.createElement(Text43, { color: v.kindColor }, v.kindGlyph), /* @__PURE__ */ React49.createElement(Text43, { dimColor: isDone, color: fg.body }, v.text));
}
function runningGlyph(color) {
  return /* @__PURE__ */ React49.createElement(Spinner, { kind: "circle", color });
}
function doneGlyph(color) {
  return /* @__PURE__ */ React49.createElement(Text43, { color }, "\u2713");
}
function failedGlyph(color) {
  return /* @__PURE__ */ React49.createElement(Text43, { color }, "\u2716");
}
function childVisual(card, doneColor, failedColor, fallbackColor) {
  switch (card.kind) {
    case "reasoning": {
      const done = !card.streaming;
      return {
        statusGlyph: done ? doneGlyph(doneColor) : runningGlyph(CARD.reasoning.color),
        kindGlyph: "\u25C6",
        kindColor: CARD.reasoning.color,
        text: t("cardLabels.reasoningLabel", { count: card.paragraphs })
      };
    }
    case "tool": {
      const elapsed = card.elapsedMs > 0 ? ` \xB7 ${(card.elapsedMs / 1e3).toFixed(2)}s` : "";
      return {
        statusGlyph: card.done ? doneGlyph(doneColor) : runningGlyph(CARD.tool.color),
        kindGlyph: "\u25A3",
        kindColor: CARD.tool.color,
        text: `${card.name}${elapsed}`
      };
    }
    case "streaming":
      return {
        statusGlyph: card.done ? doneGlyph(doneColor) : runningGlyph(CARD.streaming.color),
        kindGlyph: "\u25C8",
        kindColor: CARD.streaming.color,
        text: card.done ? t("cardLabels.response") : t("cardLabels.writing")
      };
    case "diff":
      return {
        statusGlyph: doneGlyph(doneColor),
        kindGlyph: "\xB1",
        kindColor: CARD.diff.color,
        text: card.file
      };
    case "error":
      return {
        statusGlyph: failedGlyph(failedColor),
        kindGlyph: "\u2716",
        kindColor: CARD.error.color,
        text: card.title
      };
    default:
      return {
        statusGlyph: /* @__PURE__ */ React49.createElement(Text43, { color: fallbackColor }, "\xB7"),
        kindGlyph: "\xB7",
        kindColor: fallbackColor,
        text: card.kind
      };
  }
}

// src/cli/ui/cards/TaskCard.tsx
import { Box as Box43, Text as Text44 } from "ink";
import React50 from "react";
var STEP_GLYPH = {
  queued: "\u25CB",
  running: "\u25B6",
  done: "\u2713",
  failed: "\u2717"
};
var TASK_GLYPH = {
  running: "\u25B6",
  done: "\u2713",
  failed: "\u2717"
};
var TASK_PILL = {
  running: PILL_SECTION.task,
  done: PILL_SECTION.taskDone,
  failed: PILL_SECTION.taskFailed
};
function TaskCard({ card }) {
  const { fg, tone } = useThemeTokens();
  const stepColor = {
    queued: fg.faint,
    running: tone.warn,
    done: tone.ok,
    failed: tone.err
  };
  const taskColor = {
    running: tone.warn,
    done: tone.ok,
    failed: tone.err
  };
  const pill = TASK_PILL[card.status];
  const elapsed = `${(card.elapsedMs / 1e3).toFixed(1)}s`;
  return /* @__PURE__ */ React50.createElement(Card, { tone: taskColor[card.status] }, /* @__PURE__ */ React50.createElement(
    CardHeader,
    {
      glyph: TASK_GLYPH[card.status],
      tone: taskColor[card.status],
      title: t("cardTitles.task"),
      titleColor: pill.fg,
      titleBg: pill.bg,
      subtitle: `${card.index} / ${card.total}  ${card.title}`,
      meta: [elapsed, card.status]
    }
  ), card.steps.map((step) => /* @__PURE__ */ React50.createElement(Box43, { key: step.id, flexDirection: "row", gap: 1 }, /* @__PURE__ */ React50.createElement(Text44, { color: stepColor[step.status] }, STEP_GLYPH[step.status]), /* @__PURE__ */ React50.createElement(Text44, { bold: true, color: fg.body }, (step.toolName ?? t("cardLabels.stepLabel")).padEnd(7)), /* @__PURE__ */ React50.createElement(Pill, { label: step.title, ...PILL_PATH, bold: false }), step.detail ? /* @__PURE__ */ React50.createElement(Text44, { color: fg.faint }, step.detail) : null, step.elapsedMs !== void 0 ? /* @__PURE__ */ React50.createElement(Text44, { color: fg.faint }, `${(step.elapsedMs / 1e3).toFixed(2)}s`) : null)));
}

// src/cli/ui/cards/TipCard.tsx
import { Box as Box44, Text as Text45 } from "ink";
import React51 from "react";
import stringWidth2 from "string-width";
var KEY_GUTTER = 4;
function TipCard({ card }) {
  const keyWidth = card.sections.reduce(
    (max, sec) => sec.rows.reduce((m, r) => Math.max(m, stringWidth2(r.key)), max),
    0
  );
  return /* @__PURE__ */ React51.createElement(Box44, { flexDirection: "column", paddingLeft: 2, marginY: 1 }, /* @__PURE__ */ React51.createElement(Box44, { flexDirection: "row", justifyContent: "space-between" }, /* @__PURE__ */ React51.createElement(Box44, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React51.createElement(Text45, { color: TONE.accent, bold: true }, "\u24D8"), /* @__PURE__ */ React51.createElement(Text45, { color: FG.body, bold: true }, card.topic)), card.oneTime ? /* @__PURE__ */ React51.createElement(Text45, { color: FG.faint }, t("ui.tipShownOnce")) : null), card.sections.map((section, i) => /* @__PURE__ */ React51.createElement(Box44, { key: section.title ?? `section-${i}`, flexDirection: "column", marginTop: 1 }, section.title ? /* @__PURE__ */ React51.createElement(Box44, { marginBottom: 0 }, /* @__PURE__ */ React51.createElement(Text45, { color: FG.sub }, section.title)) : null, section.rows.map((row2) => /* @__PURE__ */ React51.createElement(
    TipRowRender,
    {
      key: row2.key,
      row: row2,
      keyWidth,
      indent: section.title ? 2 : 0
    }
  )))), card.footer ? /* @__PURE__ */ React51.createElement(Box44, { marginTop: 1 }, /* @__PURE__ */ React51.createElement(Text45, { color: FG.faint }, card.footer)) : null);
}
function TipRowRender({
  row: row2,
  keyWidth,
  indent
}) {
  const pad = " ".repeat(Math.max(0, keyWidth - stringWidth2(row2.key) + KEY_GUTTER));
  const lead = indent > 0 ? " ".repeat(indent) : "";
  return /* @__PURE__ */ React51.createElement(Box44, { flexDirection: "row" }, lead ? /* @__PURE__ */ React51.createElement(Text45, null, lead) : null, /* @__PURE__ */ React51.createElement(Text45, { color: TONE.accent }, row2.key), /* @__PURE__ */ React51.createElement(Text45, null, pad), /* @__PURE__ */ React51.createElement(Text45, { color: FG.body }, row2.text));
}

// src/cli/ui/cards/ToolCard.tsx
import { Text as Text46, useStdout as useStdout15 } from "ink";
import React53 from "react";

// src/cli/ui/state/inflight-context.tsx
import React52, { createContext as createContext4, useContext as useContext7, useSyncExternalStore } from "react";
var Ctx = createContext4(null);
function InflightProvider({
  inflight,
  children
}) {
  return /* @__PURE__ */ React52.createElement(Ctx.Provider, { value: inflight }, children);
}
function useIsInflight(id) {
  const inflight = useContext7(Ctx);
  return useSyncExternalStore(
    (cb) => inflight ? inflight.subscribe(cb) : noop,
    () => inflight ? inflight.has(id) : false,
    () => false
  );
}
var noop = () => {
};

// src/cli/ui/cards/ToolCard.tsx
var READ_TAIL = 2;
var OTHER_TAIL = 5;
function tailLinesFor(name) {
  const lower = name.toLowerCase();
  return /(?:^|_)(read|search|list|tree|get|status|diff|fetch|grep)(_|$)/.test(lower) || lower === "job_output" ? READ_TAIL : OTHER_TAIL;
}
function ToolCard({ card }) {
  const { stdout } = useStdout15();
  const cols = stdout?.columns ?? 80;
  const lineCells = Math.max(20, cols - 4);
  const argsLabel = formatArgsSummary(card.args);
  const subagentMarkdown = React53.useMemo(
    () => unwrapSubagentMarkdown(card.name, card.output),
    [card.name, card.output]
  );
  const allLines = card.output.length > 0 ? card.output.split("\n") : [];
  const tail = tailLinesFor(card.name);
  const truncated = allLines.length > tail;
  const visible = truncated ? allLines.slice(-tail) : allLines;
  const hidden = truncated ? allLines.length - visible.length : 0;
  const isInflight = useIsInflight(card.id);
  const status2 = toolStatus(card, isInflight);
  const headColor = headerColorFor(status2);
  const errColor = card.exitCode && card.exitCode !== 0 ? TONE.err : FG.sub;
  const showBody = !card.rejected && (subagentMarkdown !== null || visible.length > 0);
  const meta = [];
  if (card.retry) {
    meta.push({ text: `\u21BB ${card.retry.attempt}/${card.retry.max}`, color: TONE.warn });
  }
  if (card.rejected) {
    meta.push({ text: t("cardLabels.rejected"), color: TONE.err });
  }
  for (const part of metaTrail(card)) meta.push(part);
  return /* @__PURE__ */ React53.createElement(Card, { tone: headColor }, /* @__PURE__ */ React53.createElement(
    CardHeader,
    {
      glyph: statusGlyph2(status2),
      tone: headColor,
      title: card.name,
      subtitle: argsLabel || void 0,
      meta: meta.length > 0 ? meta : void 0,
      right: status2 === "running" ? /* @__PURE__ */ React53.createElement(Spinner, { kind: "braille", color: TONE_ACTIVE.brand, bold: true }) : void 0
    }
  ), showBody && (subagentMarkdown !== null ? /* @__PURE__ */ React53.createElement(Markdown, { text: subagentMarkdown, width: lineCells }) : /* @__PURE__ */ React53.createElement(React53.Fragment, null, hidden > 0 ? /* @__PURE__ */ React53.createElement(Text46, { color: FG.faint }, t(hidden === 1 ? "cardLabels.earlierLine" : "cardLabels.earlierLines", {
    count: hidden
  })) : null, visible.map((line, i) => /* @__PURE__ */ React53.createElement(
    Text46,
    {
      key: `${card.id}:${hidden + i}`,
      color: errColor,
      dimColor: !card.exitCode || card.exitCode === 0
    },
    clipToCells(line, lineCells) || " "
  )))));
}
function unwrapSubagentMarkdown(name, output) {
  if (name !== "spawn_subagent") return null;
  if (output.length === 0) return null;
  try {
    const parsed = JSON.parse(output);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed;
    if (obj.success !== true) return null;
    if (typeof obj.output !== "string") return null;
    return obj.output;
  } catch {
    return null;
  }
}
function toolStatus(card, isInflight) {
  if (isInflight) return "running";
  if (card.rejected) return "rejected";
  if (card.aborted) return "aborted";
  if (card.exitCode !== void 0 && card.exitCode !== 0) return "error";
  return "ok";
}
function statusGlyph2(s) {
  switch (s) {
    case "running":
      return "\u25A2";
    case "ok":
      return "\u2713";
    case "rejected":
      return "\u2717";
    case "error":
      return "\u2716";
    case "aborted":
      return "\u2298";
  }
}
function headerColorFor(s) {
  switch (s) {
    case "ok":
      return TONE.ok;
    case "rejected":
    case "error":
    case "aborted":
      return TONE.err;
    case "running":
      return TONE_ACTIVE.brand;
  }
}
function metaTrail(card) {
  const parts = [];
  const inputBytes = largestStringInputBytes(card.args);
  if (inputBytes !== null) parts.push(t("cardLabels.bytesIn", { bytes: formatBytes(inputBytes) }));
  if (card.elapsedMs > 0)
    parts.push(t("cardLabels.elapsedSec", { secs: (card.elapsedMs / 1e3).toFixed(2) }));
  if (card.done && !card.rejected && !card.aborted && card.exitCode !== void 0 && card.exitCode !== 0) {
    parts.push(t("cardLabels.exit", { code: card.exitCode }));
  }
  return parts;
}
function formatArgsSummary(args) {
  if (typeof args === "string") return args.length > 60 ? `${args.slice(0, 60)}\u2026` : args;
  if (args && typeof args === "object") {
    const keys2 = Object.keys(args);
    if (keys2.length === 0) return "";
    const first = keys2[0];
    const value = args[first];
    if (typeof value === "string") {
      const trimmed = value.length > 40 ? `${value.slice(0, 40)}\u2026` : value;
      return keys2.length === 1 ? trimmed : `${trimmed}  +${keys2.length - 1}`;
    }
    return keys2.join(" ");
  }
  return "";
}
var INPUT_SIZE_THRESHOLD = 1024;
function largestStringInputBytes(args) {
  let max = 0;
  if (typeof args === "string") {
    max = args.length;
  } else if (args && typeof args === "object") {
    for (const v of Object.values(args)) {
      if (typeof v === "string" && v.length > max) max = v.length;
    }
  }
  return max >= INPUT_SIZE_THRESHOLD ? max : null;
}
function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// src/cli/ui/cards/UsageCard.tsx
import { Box as Box46, Text as Text47 } from "ink";
import React54 from "react";
var BAR_CELLS2 = 30;
function compactNum(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(n);
}
function bar(ratio, color) {
  const filled = Math.max(0, Math.min(BAR_CELLS2, Math.round(ratio * BAR_CELLS2)));
  const empty = BAR_CELLS2 - filled;
  return /* @__PURE__ */ React54.createElement(React54.Fragment, null, /* @__PURE__ */ React54.createElement(Text47, { color }, "\u2588".repeat(filled)), /* @__PURE__ */ React54.createElement(Text47, { color: FG.faint }, "\u2591".repeat(empty)));
}
function UsageCard({ card }) {
  if (card.compact) return /* @__PURE__ */ React54.createElement(CompactUsageRow, { card });
  const cap = Math.max(1, card.tokens.promptCap);
  const promptRatio = card.tokens.prompt / cap;
  const reasonRatio = card.tokens.reason / cap;
  const outputRatio = card.tokens.output / cap;
  const headerMeta2 = [
    `${t("cardLabels.turn")} ${card.turn}`,
    formatCost(card.cost, card.balanceCurrency)
  ];
  if (card.elapsedMs !== void 0) headerMeta2.push(`${(card.elapsedMs / 1e3).toFixed(1)}s`);
  return /* @__PURE__ */ React54.createElement(Card, { tone: FG.meta }, /* @__PURE__ */ React54.createElement(CardHeader, { glyph: "\u03A3", tone: FG.meta, title: t("cardTitles.usage"), meta: headerMeta2 }), /* @__PURE__ */ React54.createElement(Box46, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React54.createElement(Text47, { color: FG.sub }, t("cardLabels.prompt")), bar(promptRatio, TONE.brand), /* @__PURE__ */ React54.createElement(Text47, { bold: true, color: FG.body }, card.tokens.prompt.toLocaleString()), /* @__PURE__ */ React54.createElement(Text47, { color: FG.faint }, `/ 1M \xB7 ${(promptRatio * 100).toFixed(1)}%`)), /* @__PURE__ */ React54.createElement(Box46, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React54.createElement(Text47, { color: FG.sub }, t("cardLabels.reason")), bar(reasonRatio, TONE.accent), /* @__PURE__ */ React54.createElement(Text47, { bold: true, color: FG.body }, card.tokens.reason.toLocaleString())), /* @__PURE__ */ React54.createElement(Box46, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React54.createElement(Text47, { color: FG.sub }, t("cardLabels.output")), bar(outputRatio, TONE.brand), /* @__PURE__ */ React54.createElement(Text47, { bold: true, color: FG.body }, card.tokens.output.toLocaleString())), /* @__PURE__ */ React54.createElement(Box46, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React54.createElement(Text47, { color: FG.sub }, t("cardLabels.cache"), " "), bar(card.cacheHit, TONE.ok), /* @__PURE__ */ React54.createElement(Text47, { bold: true, color: TONE.ok }, `${(card.cacheHit * 100).toFixed(1)}%`)), /* @__PURE__ */ React54.createElement(Box46, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React54.createElement(Text47, { color: FG.faint }, t("cardLabels.session")), /* @__PURE__ */ React54.createElement(Text47, { bold: true, color: FG.body }, `\u26C1 ${formatCost(card.sessionCost, card.balanceCurrency, 3)}`), card.balance !== void 0 ? /* @__PURE__ */ React54.createElement(React54.Fragment, null, /* @__PURE__ */ React54.createElement(Text47, { color: FG.faint }, `\xB7 ${t("cardLabels.balance")}`), /* @__PURE__ */ React54.createElement(Text47, { bold: true, color: TONE.brand }, formatBalance(card.balance, card.balanceCurrency))) : null));
}
function CompactUsageRow({ card }) {
  const elapsed = card.elapsedMs !== void 0 ? ` \xB7 ${(card.elapsedMs / 1e3).toFixed(1)}s` : "";
  return /* @__PURE__ */ React54.createElement(Box46, { flexDirection: "row", gap: 1, marginTop: 1 }, /* @__PURE__ */ React54.createElement(Text47, { color: FG.meta }, "\u03A3"), /* @__PURE__ */ React54.createElement(Text47, { color: FG.faint }, `${t("cardLabels.turn")} ${card.turn}`), /* @__PURE__ */ React54.createElement(Text47, { color: FG.meta }, `\xB7 ${compactNum(card.tokens.prompt)} ${t("cardLabels.prompt")} \xB7 ${compactNum(card.tokens.output)} ${t("cardLabels.output")}`), /* @__PURE__ */ React54.createElement(Text47, { color: FG.faint }, `\xB7 ${t("cardLabels.cache")}`), /* @__PURE__ */ React54.createElement(Text47, { color: TONE.ok }, `${(card.cacheHit * 100).toFixed(0)}%`), /* @__PURE__ */ React54.createElement(Text47, { color: FG.faint }, `\xB7 ${formatCost(card.cost, card.balanceCurrency)}${elapsed}`), card.balance !== void 0 ? /* @__PURE__ */ React54.createElement(Text47, { color: TONE.brand }, `\xB7 ${formatBalance(card.balance, card.balanceCurrency)}`) : null);
}

// src/cli/ui/cards/UserCard.tsx
import { Box as Box47, Text as Text48 } from "ink";
import React55 from "react";

// src/cli/ui/cards/time.ts
function formatRelativeTime(ts, now = Date.now()) {
  const diffSec = Math.max(0, Math.floor((now - ts) / 1e3));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// src/cli/ui/cards/UserCard.tsx
function UserCard({ card }) {
  return /* @__PURE__ */ React55.createElement(Card, { tone: CARD.user.color }, /* @__PURE__ */ React55.createElement(
    CardHeader,
    {
      glyph: CARD.user.glyph,
      tone: CARD.user.color,
      title: t("cardTitles.you"),
      titleColor: PILL_SECTION.user.fg,
      titleBg: PILL_SECTION.user.bg,
      meta: [formatRelativeTime(card.ts)]
    }
  ), /* @__PURE__ */ React55.createElement(Box47, { flexDirection: "row", gap: 1 }, /* @__PURE__ */ React55.createElement(Text48, { color: FG.sub }, "\u21B3"), /* @__PURE__ */ React55.createElement(Text48, null, card.text)));
}

// src/cli/ui/cards/WarnCard.tsx
import { Text as Text49 } from "ink";
import React56 from "react";
function WarnCard({ card }) {
  const messageLines = card.message.length > 0 ? card.message.split("\n") : [];
  return /* @__PURE__ */ React56.createElement(Card, { tone: TONE.warn }, /* @__PURE__ */ React56.createElement(
    CardHeader,
    {
      glyph: "\u26A0",
      tone: TONE.warn,
      title: card.title,
      meta: card.detail ? [card.detail] : void 0
    }
  ), messageLines.map((line, i) => /* @__PURE__ */ React56.createElement(Text49, { key: `${card.id}:${i}`, color: FG.body }, line || " ")));
}

// src/cli/ui/cards/CardRenderer.tsx
var CardRenderer = React57.memo(function CardRenderer2({
  card
}) {
  return /* @__PURE__ */ React57.createElement(Box48, { flexDirection: "column" }, renderCard(card));
});
function renderCard(card) {
  switch (card.kind) {
    case "user":
      return /* @__PURE__ */ React57.createElement(UserCard, { card });
    case "reasoning":
      return /* @__PURE__ */ React57.createElement(ReasoningCard, { card, expanded: true });
    case "streaming":
      return /* @__PURE__ */ React57.createElement(StreamingCard, { card });
    case "tool":
      return /* @__PURE__ */ React57.createElement(ToolCard, { card });
    case "task":
      return /* @__PURE__ */ React57.createElement(TaskCard, { card });
    case "plan":
      return /* @__PURE__ */ React57.createElement(PlanCard, { card });
    case "diff":
      return /* @__PURE__ */ React57.createElement(DiffCard, { card });
    case "error":
      return /* @__PURE__ */ React57.createElement(ErrorCard, { card });
    case "warn":
      return /* @__PURE__ */ React57.createElement(WarnCard, { card });
    case "usage":
      return /* @__PURE__ */ React57.createElement(UsageCard, { card });
    case "memory":
      return /* @__PURE__ */ React57.createElement(MemoryCard, { card });
    case "subagent":
      return /* @__PURE__ */ React57.createElement(SubAgentCard, { card });
    case "search":
      return /* @__PURE__ */ React57.createElement(SearchCard, { card });
    case "live":
      return /* @__PURE__ */ React57.createElement(LiveCard, { card });
    case "tip":
      return /* @__PURE__ */ React57.createElement(TipCard, { card });
    case "ctx":
      return /* @__PURE__ */ React57.createElement(CtxCard, { card });
    case "doctor":
      return /* @__PURE__ */ React57.createElement(DoctorCard, { card });
    default:
      return /* @__PURE__ */ React57.createElement(FallbackCard, { card });
  }
}
function FallbackCard({ card }) {
  return /* @__PURE__ */ React57.createElement(Box48, { flexDirection: "row" }, /* @__PURE__ */ React57.createElement(Text50, { color: FG.faint }, `  \xB7 ${card.kind} card \xB7 not yet migrated`));
}

// src/cli/ui/state/chat-scroll-provider.tsx
import React58 from "react";

// src/cli/ui/state/chat-scroll-store.ts
var SCROLL_ARROW_ROWS = 3;
var SCROLL_PAGE_ROWS = 5;
var COALESCE_MS = 16;
var EMPTY_HEIGHTS = /* @__PURE__ */ new Map();
var initial = {
  scrollRows: 0,
  pinned: true,
  maxScroll: 0,
  scrollVersion: 0,
  cardHeights: EMPTY_HEIGHTS
};
function createChatScrollStore() {
  let state = initial;
  const listeners = /* @__PURE__ */ new Set();
  let pendingDelta = 0;
  let flushTimer = null;
  let pendingMaxShrink = null;
  let shrinkTimer = null;
  function set(next) {
    const merged = { ...state, ...next };
    if (merged.scrollRows === state.scrollRows && merged.pinned === state.pinned && merged.maxScroll === state.maxScroll && merged.scrollVersion === state.scrollVersion && merged.cardHeights === state.cardHeights) {
      return;
    }
    state = merged;
    for (const l of listeners) l();
  }
  function applyDelta() {
    const d = pendingDelta;
    pendingDelta = 0;
    if (d === 0) return;
    const next = Math.max(0, Math.min(state.maxScroll, state.scrollRows + d));
    set({
      scrollRows: next,
      pinned: d < 0 ? false : next >= state.maxScroll ? true : state.pinned,
      scrollVersion: state.scrollVersion + 1
    });
  }
  function schedule(delta) {
    if (flushTimer === null) {
      pendingDelta = delta;
      applyDelta();
      flushTimer = setTimeout(() => {
        flushTimer = null;
        if (pendingDelta !== 0) applyDelta();
      }, COALESCE_MS);
    } else {
      pendingDelta += delta;
    }
  }
  function flushShrink() {
    if (shrinkTimer !== null) {
      clearTimeout(shrinkTimer);
      shrinkTimer = null;
    }
    const target = pendingMaxShrink;
    pendingMaxShrink = null;
    if (target === null) return;
    const nextScrollRows = state.pinned ? target : Math.min(state.scrollRows, target);
    set({ maxScroll: target, scrollRows: nextScrollRows });
  }
  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    scrollUp: () => schedule(-SCROLL_ARROW_ROWS),
    scrollDown: () => schedule(SCROLL_ARROW_ROWS),
    scrollPageUp: () => schedule(-SCROLL_PAGE_ROWS),
    scrollPageDown: () => schedule(SCROLL_PAGE_ROWS),
    jumpToBottom() {
      pendingDelta = 0;
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      pendingMaxShrink = null;
      if (shrinkTimer !== null) {
        clearTimeout(shrinkTimer);
        shrinkTimer = null;
      }
      set({ pinned: true });
    },
    setMaxScroll(rows) {
      const m = rows < 0 ? 0 : rows;
      const currentMax = pendingMaxShrink ?? state.maxScroll;
      if (state.pinned && m < currentMax) {
        pendingMaxShrink = m;
        if (shrinkTimer === null) {
          shrinkTimer = setTimeout(() => {
            shrinkTimer = null;
            flushShrink();
          }, COALESCE_MS);
        }
        return;
      }
      if (pendingMaxShrink !== null) flushShrink();
      const nextScrollRows = state.pinned ? m : Math.min(state.scrollRows, m);
      set({ maxScroll: m, scrollRows: nextScrollRows });
    },
    setCardHeight(id, rows) {
      if (state.cardHeights.get(id) === rows) return;
      const next = new Map(state.cardHeights);
      next.set(id, rows);
      set({ cardHeights: next });
    },
    pruneCardHeights(liveIds) {
      let drop = 0;
      for (const id of state.cardHeights.keys()) {
        if (!liveIds.has(id)) drop++;
      }
      if (drop === 0) return;
      const next = /* @__PURE__ */ new Map();
      for (const [id, h] of state.cardHeights) {
        if (liveIds.has(id)) next.set(id, h);
      }
      set({ cardHeights: next });
    }
  };
}

// src/cli/ui/state/chat-scroll-provider.tsx
var Ctx2 = React58.createContext(null);
function ChatScrollProvider({
  children
}) {
  const store = React58.useMemo(() => createChatScrollStore(), []);
  return /* @__PURE__ */ React58.createElement(Ctx2.Provider, { value: store }, children);
}
function useStore() {
  const s = React58.useContext(Ctx2);
  if (!s) throw new Error("useChatScroll* must be used inside ChatScrollProvider");
  return s;
}
function useChatScrollState(selector) {
  const store = useStore();
  const subscribe = React58.useCallback((cb) => store.subscribe(cb), [store]);
  const getSnapshot = React58.useCallback(() => selector(store.getState()), [store, selector]);
  return React58.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
function useChatScrollActions() {
  return useStore();
}

// src/cli/ui/layout/CardStream.tsx
var VISIBLE_BUFFER_ROWS = 30;
function computeCardStreamItems(cards, cardHeights, scrollRows, outerHeight) {
  const bucket = Math.floor(scrollRows / VISIBLE_BUFFER_ROWS) * VISIBLE_BUFFER_ROWS;
  const winStart = Math.max(0, bucket - VISIBLE_BUFFER_ROWS);
  const winEnd = bucket + outerHeight + VISIBLE_BUFFER_ROWS * 2;
  const out = [];
  let cursor = 0;
  let pendingSpacer = 0;
  let spacerKey = 0;
  for (const card of cards) {
    const h = cardHeights.get(card.id);
    const cardEnd = cursor + (h ?? 0);
    const live = h === void 0 || cardEnd >= winStart && cursor <= winEnd;
    if (live) {
      if (pendingSpacer > 0) {
        out.push({ kind: "spacer", rows: pendingSpacer, key: `sp-${spacerKey++}` });
        pendingSpacer = 0;
      }
      out.push({ kind: "card", card });
    } else {
      pendingSpacer += h ?? 0;
    }
    cursor = cardEnd;
  }
  if (pendingSpacer > 0) {
    out.push({ kind: "spacer", rows: pendingSpacer, key: `sp-${spacerKey}` });
  }
  return out;
}
function CardStream({
  suppressLive = false
}) {
  const cards = useAgentState((s) => s.cards);
  const scrollRows = useChatScrollState((s) => s.scrollRows);
  const cardHeights = useChatScrollState((s) => s.cardHeights);
  const { setMaxScroll, setCardHeight, pruneCardHeights } = useChatScrollActions();
  const outerRef = useRef6(null);
  const innerRef = useRef6(null);
  const outer = useBoxMetrics(outerRef);
  const inner = useBoxMetrics(innerRef);
  const maxScroll = Math.max(0, inner.height - outer.height);
  useEffect12(() => {
    setMaxScroll(maxScroll);
  }, [maxScroll, setMaxScroll]);
  useEffect12(() => {
    const live = /* @__PURE__ */ new Set();
    for (const c of cards) live.add(c.id);
    pruneCardHeights(live);
  }, [cards, pruneCardHeights]);
  let visible = cards;
  if (suppressLive && cards.length > 0 && !isFullySettled(cards[cards.length - 1])) {
    visible = cards.slice(0, -1);
  }
  const items = useMemo10(
    () => computeCardStreamItems(visible, cardHeights, scrollRows, outer.height),
    [visible, cardHeights, scrollRows, outer.height]
  );
  return /* @__PURE__ */ React59.createElement(React59.Fragment, null, /* @__PURE__ */ React59.createElement(Box49, { height: 1, flexShrink: 0 }, scrollRows > 0 ? /* @__PURE__ */ React59.createElement(ScrollIndicator, { scrollRows, maxScroll }) : null), /* @__PURE__ */ React59.createElement(Box49, { ref: outerRef, flexDirection: "column", flexGrow: 1, overflow: "hidden" }, /* @__PURE__ */ React59.createElement(Box49, { ref: innerRef, flexDirection: "column", marginTop: -scrollRows, flexShrink: 0 }, items.map(
    (item) => item.kind === "spacer" ? /* @__PURE__ */ React59.createElement(Box49, { key: item.key, height: item.rows, flexShrink: 0 }) : /* @__PURE__ */ React59.createElement(MeasuredCard, { key: item.card.id, card: item.card, report: setCardHeight })
  ))));
}
function MeasuredCard({
  card,
  report
}) {
  const ref = useRef6(null);
  const m = useBoxMetrics(ref);
  useEffect12(() => {
    if (m.height > 0) report(card.id, m.height);
  }, [card.id, m.height, report]);
  return /* @__PURE__ */ React59.createElement(Box49, { ref, flexDirection: "column", flexShrink: 0 }, /* @__PURE__ */ React59.createElement(CardRenderer, { card }));
}
function ScrollIndicator({
  scrollRows,
  maxScroll
}) {
  const version = useChatScrollState((s) => s.scrollVersion);
  const [hot, setHot] = React59.useState(false);
  React59.useEffect(() => {
    if (version === 0) return;
    setHot(true);
    const id = setTimeout(() => setHot(false), 220);
    return () => clearTimeout(id);
  }, [version]);
  const remaining = Math.max(0, maxScroll - scrollRows);
  const above = scrollRows === 1 ? t("cardStream.scrollAbove", { scroll: scrollRows, max: maxScroll }) : t("cardStream.scrollAbovePlural", { scroll: scrollRows, max: maxScroll });
  const more = remaining > 0 ? t("cardStream.scrollMore", { remaining }) : "";
  const text = `${above}${more}${t("cardStream.scrollPgUp")}`;
  return /* @__PURE__ */ React59.createElement(Text51, { color: hot ? TONE.accent : FG.faint }, text);
}
function isFullySettled(card) {
  switch (card.kind) {
    case "streaming":
    case "tool":
      return card.done || !!card.aborted;
    case "reasoning":
      return !card.streaming || !!card.aborted;
    case "task":
    case "subagent":
      return card.status !== "running";
    case "plan":
      return card.steps.every((s) => s.status === "done" || s.status === "skipped");
    default:
      return true;
  }
}

// src/cli/ui/layout/LiveRows.tsx
import { Box as Box50, Text as Text52 } from "ink";
import React60 from "react";
var SPINNER_FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
function ThinkingRow({ text }) {
  const elapsed = useElapsedSeconds();
  const { fg, tone } = useThemeTokens();
  return /* @__PURE__ */ React60.createElement(Box50, { marginY: 1, paddingX: 1, gap: 1 }, /* @__PURE__ */ React60.createElement(Spinner, { kind: "circle", color: TONE.accent }), /* @__PURE__ */ React60.createElement(Text52, { italic: true, color: FG.sub }, text), /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, `${elapsed}s`));
}
function ModeStatusBar({
  editMode,
  pendingCount,
  flash,
  planMode,
  undoArmed,
  jobs: jobs2
}) {
  useSlowTick();
  const running = jobs2?.runningCount() ?? 0;
  const jobsTag = running > 0 ? /* @__PURE__ */ React60.createElement(Text52, { color: TONE.warn, bold: true }, `  \xB7  \u23F5 ${running} job${running === 1 ? "" : "s"}`) : null;
  if (planMode) {
    return /* @__PURE__ */ React60.createElement(ModeBarFrame, null, /* @__PURE__ */ React60.createElement(ModePill, { label: t("editMode.plan"), color: TONE.err, flash }), /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, t("editMode.writesGated")), jobsTag);
  }
  const label = editMode === "yolo" ? t("editMode.yolo") : editMode === "auto" ? t("editMode.auto") : t("editMode.review");
  const pillColor = editMode === "yolo" ? TONE.err : editMode === "auto" ? TONE.accent : TONE.brand;
  const mid = editMode === "yolo" ? t("editMode.editsShellAuto") : editMode === "auto" ? t("editMode.editsLandNow") : pendingCount > 0 ? t("editMode.queuedApplyDiscard", { count: pendingCount }) : t("editMode.editsQueued");
  return /* @__PURE__ */ React60.createElement(ModeBarFrame, null, /* @__PURE__ */ React60.createElement(ModePill, { label, color: pillColor, flash }), /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, t("editMode.shiftTabFlip", { mid })), jobsTag);
}
function ModeBarFrame({ children }) {
  return /* @__PURE__ */ React60.createElement(Box50, { paddingX: 1 }, children);
}
function ModePill({
  label,
  color,
  flash
}) {
  return /* @__PURE__ */ React60.createElement(Text52, { color, bold: true, inverse: flash }, `[${label}]`);
}
function UndoBanner({
  banner
}) {
  useTick();
  const totalMs = 5e3;
  const paused = banner.pausedRemainingMs !== null;
  const remainingMs = paused ? banner.pausedRemainingMs ?? 0 : Math.max(0, banner.expiresAt - Date.now());
  const remainingSec = Math.ceil(remainingMs / 1e3);
  const ok = banner.results.filter((r) => r.status === "applied" || r.status === "created").length;
  const total = banner.results.length;
  const urgent = !paused && remainingSec <= 1;
  const pct = remainingMs / totalMs * 100;
  const tone = paused ? TONE.warn : urgent ? TONE.err : TONE.accent;
  return /* @__PURE__ */ React60.createElement(Box50, { marginY: 1, paddingX: 1 }, /* @__PURE__ */ React60.createElement(Text52, { backgroundColor: TONE.accent, color: "black", bold: true }, ` \u2713 AUTO-APPLIED ${ok}/${total} `), /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, "   press "), /* @__PURE__ */ React60.createElement(Text52, { backgroundColor: TONE.brand, color: "black", bold: true }, " u "), /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, paused ? " to undo \xB7 " : " to undo \xB7 "), /* @__PURE__ */ React60.createElement(Text52, { backgroundColor: paused ? TONE.warn : FG.faint, color: "black", bold: true }, " space "), /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, paused ? " to resume  " : " to pause  "), /* @__PURE__ */ React60.createElement(CharBar, { pct, width: 20, color: tone, showLabel: false }), /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, "  "), /* @__PURE__ */ React60.createElement(Text52, { color: tone, bold: urgent || paused }, paused ? `${remainingSec}s \xB7 paused` : `${remainingSec}s`));
}
function subagentPhaseLabel(phase, iter, elapsedMs) {
  if (phase === "summarising") return "summarising findings\u2026";
  if (iter === 0 && elapsedMs < 2e3) return "exploring task\u2026";
  if (iter === 0) return "thinking\u2026";
  return "working through tools\u2026";
}
function SubagentRow({ activity }) {
  useTick();
  const seconds = (activity.elapsedMs / 1e3).toFixed(1);
  const phase = subagentPhaseLabel(activity.phase, activity.iter, activity.elapsedMs);
  const last = activity.lastInner;
  const subtitle = activity.skillName ?? truncate2(activity.task, 48);
  const modelBadge = activity.model ? modelBadgeFor(activity.model) : null;
  return /* @__PURE__ */ React60.createElement(Card, { tone: CARD.subagent.color }, /* @__PURE__ */ React60.createElement(
    CardHeader,
    {
      glyph: "\u232C",
      tone: CARD.subagent.color,
      title: "subagent",
      titleColor: PILL_SECTION.plan.fg,
      titleBg: PILL_SECTION.plan.bg,
      subtitle,
      meta: [`iter ${activity.iter}`, `${seconds}s`],
      right: /* @__PURE__ */ React60.createElement(React60.Fragment, null, modelBadge ? /* @__PURE__ */ React60.createElement(Pill, { label: modelBadge.label, ...PILL_MODEL[modelBadge.kind], bold: false }) : null, /* @__PURE__ */ React60.createElement(Spinner, { kind: "braille", color: CARD.subagent.color }))
    }
  ), /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, "task  ", /* @__PURE__ */ React60.createElement(Text52, { color: FG.sub }, activity.task)), /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, "last  ", last ? /* @__PURE__ */ React60.createElement(React60.Fragment, null, /* @__PURE__ */ React60.createElement(Text52, { color: last.color }, `${last.glyph} `), /* @__PURE__ */ React60.createElement(Text52, { color: FG.body }, last.label), last.meta ? /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, `   ${last.meta}`) : null) : /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, t("editMode.queuedDots"))), /* @__PURE__ */ React60.createElement(Text52, { color: TONE.brand }, "\u25B6  ", phase));
}
function SubagentLiveStack({
  activities,
  max = 3
}) {
  const tick = useTick();
  if (activities.length === 0) return null;
  if (activities.length === 1) return /* @__PURE__ */ React60.createElement(SubagentRow, { activity: activities[0] });
  const visible = activities.slice(0, max);
  const overflow = activities.length - visible.length;
  const summarising = activities.filter((a) => a.phase === "summarising").length;
  const metaParts = [`${activities.length} running`];
  if (summarising > 0) metaParts.push(`${summarising} summarising`);
  return /* @__PURE__ */ React60.createElement(Card, { tone: CARD.subagent.color }, /* @__PURE__ */ React60.createElement(
    CardHeader,
    {
      glyph: "\u232C",
      tone: CARD.subagent.color,
      title: "subagents",
      titleColor: PILL_SECTION.plan.fg,
      titleBg: PILL_SECTION.plan.bg,
      subtitle: metaParts.join(" \xB7 "),
      right: /* @__PURE__ */ React60.createElement(Spinner, { kind: "braille", color: CARD.subagent.color })
    }
  ), visible.map((a, i) => /* @__PURE__ */ React60.createElement(CompactSubagentLine, { key: a.runId, activity: a, tick, index: i })), overflow > 0 ? /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, `  +${overflow} more running\u2026`) : null);
}
function CompactSubagentLine({
  activity,
  tick,
  index
}) {
  const summarising = activity.phase === "summarising";
  const spinnerFrame = SPINNER_FRAMES[(tick + index) % SPINNER_FRAMES.length] ?? "\xB7";
  const glyph = summarising ? "\u25B6" : spinnerFrame;
  const glyphColor = summarising ? TONE.brand : CARD.subagent.color;
  const seconds = (activity.elapsedMs / 1e3).toFixed(1).padStart(5);
  const title = activity.skillName ?? truncate2(activity.task, 28);
  const titlePadded = title.padEnd(28);
  const last = activity.lastInner;
  return /* @__PURE__ */ React60.createElement(Box50, { flexDirection: "row" }, /* @__PURE__ */ React60.createElement(Text52, { color: glyphColor, bold: true }, `  ${glyph} `), /* @__PURE__ */ React60.createElement(Text52, { color: FG.body }, titlePadded), /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, `  iter ${String(activity.iter).padStart(2)} \xB7 ${seconds}s \xB7 `), last ? /* @__PURE__ */ React60.createElement(React60.Fragment, null, /* @__PURE__ */ React60.createElement(Text52, { color: last.color }, `${last.glyph} `), /* @__PURE__ */ React60.createElement(Text52, { color: FG.body }, truncate2(last.label, 18)), last.meta ? /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, `  ${last.meta}`) : null) : /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, t("editMode.queuedDots")));
}
function truncate2(text, max) {
  return text.length > max ? `${text.slice(0, max)}\u2026` : text;
}
function OngoingToolRow({
  tool,
  progress
}) {
  const tick = useTick();
  const elapsed = useElapsedSeconds();
  const summary = summarizeToolArgs(tool.name, tool.args);
  return /* @__PURE__ */ React60.createElement(Box50, { marginY: 1, flexDirection: "column", paddingX: 1 }, /* @__PURE__ */ React60.createElement(Box50, null, /* @__PURE__ */ React60.createElement(Text52, { color: CARD.tool.color, bold: true }, SPINNER_FRAMES[tick % SPINNER_FRAMES.length]), /* @__PURE__ */ React60.createElement(Text52, null, "  "), /* @__PURE__ */ React60.createElement(Text52, { color: CARD.tool.color, bold: true }, `\u25A3 ${tool.name}`), /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, `  running \xB7 ${elapsed}s`)), progress ? /* @__PURE__ */ React60.createElement(Box50, { paddingLeft: 3 }, /* @__PURE__ */ React60.createElement(Text52, { color: TONE.brand }, renderProgressLine(progress))) : null, summary ? /* @__PURE__ */ React60.createElement(Box50, { paddingLeft: 3 }, /* @__PURE__ */ React60.createElement(Text52, { color: FG.faint }, summary)) : null);
}
function renderProgressLine(p) {
  const msg = p.message ? `  ${p.message}` : "";
  if (p.total && p.total > 0) {
    const ratio = Math.max(0, Math.min(1, p.progress / p.total));
    const width = 20;
    const filled = Math.round(ratio * width);
    const bar2 = "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
    const pct = (ratio * 100).toFixed(0);
    return `[${bar2}] ${p.progress}/${p.total} ${pct}%${msg}`;
  }
  return `progress: ${p.progress}${msg}`;
}
function summarizeToolArgs(name, args) {
  if (!args || args === "{}") return "";
  let parsed;
  try {
    parsed = JSON.parse(args);
  } catch {
    return args.length > 80 ? `${args.slice(0, 80)}\u2026` : args;
  }
  const hasSuffix = (s) => name === s || name.endsWith(`_${s}`);
  const path = typeof parsed.path === "string" ? parsed.path : void 0;
  if (hasSuffix("read_file")) {
    const head = typeof parsed.head === "number" ? `, head=${parsed.head}` : "";
    const tail = typeof parsed.tail === "number" ? `, tail=${parsed.tail}` : "";
    return `path: ${path ?? "?"}${head}${tail}`;
  }
  if (hasSuffix("write_file")) {
    const content = typeof parsed.content === "string" ? parsed.content : "";
    return `path: ${path ?? "?"} (${content.length} chars)`;
  }
  if (hasSuffix("edit_file")) {
    const edits = Array.isArray(parsed.edits) ? parsed.edits.length : 0;
    return `path: ${path ?? "?"} (${edits} edit${edits === 1 ? "" : "s"})`;
  }
  if (hasSuffix("list_directory") || hasSuffix("directory_tree")) {
    return `path: ${path ?? "?"}`;
  }
  if (hasSuffix("search_files")) {
    const pattern = typeof parsed.pattern === "string" ? parsed.pattern : "?";
    return `path: ${path ?? "?"} \xB7 pattern: ${pattern}`;
  }
  if (hasSuffix("move_file")) {
    const src = typeof parsed.source === "string" ? parsed.source : "?";
    const dst = typeof parsed.destination === "string" ? parsed.destination : "?";
    return `${src} \u2192 ${dst}`;
  }
  if (hasSuffix("get_file_info")) {
    return `path: ${path ?? "?"}`;
  }
  return args.length > 80 ? `${args.slice(0, 80)}\u2026` : args;
}

// src/cli/ui/layout/StatusRow.tsx
import { Box as Box51, Text as Text54, useStdout as useStdout16 } from "ink";
import React62 from "react";

// src/cli/ui/primitives/Countdown.tsx
import { Text as Text53 } from "ink";
import React61 from "react";
function Countdown({ endsAt, color = TONE.brand }) {
  useSlowTick();
  const remainingSec = Math.max(0, Math.ceil((endsAt - Date.now()) / 1e3));
  return /* @__PURE__ */ React61.createElement(Text53, { bold: true, color }, String(remainingSec));
}

// src/cli/ui/layout/StatusRow.tsx
var RULE_PAD = 4;
var RULE_MIN = 20;
var WALLET_MIN_COLS = 90;
var VERSION_MIN_COLS = 70;
var FEEDBACK_HINT_MIN_COLS = 100;
var PRESET_MIN_COLS = 60;
var DEFAULT_STATUS_BAR_CONFIG = {
  showBalance: true,
  showSessionCost: true,
  showTurnCost: true,
  showCacheHit: true,
  showVersion: true,
  showFeedbackHint: true
};
function StatusRow({
  statusBar = DEFAULT_STATUS_BAR_CONFIG
}) {
  const status2 = useAgentState((s) => s.status);
  const session = useAgentState((s) => s.session);
  const { stdout } = useStdout16();
  const cols = stdout?.columns ?? 80;
  const ruleWidth = Math.max(RULE_MIN, cols - RULE_PAD);
  const hasTurn = status2.cost > 0;
  const hasSession = status2.sessionCost > 0;
  const hasBalance = typeof status2.balance === "number";
  const showWallet = cols >= WALLET_MIN_COLS && (hasSession && statusBar.showSessionCost || hasBalance && statusBar.showBalance);
  return /* @__PURE__ */ React62.createElement(Box51, { flexDirection: "column", flexShrink: 0, flexWrap: "nowrap" }, /* @__PURE__ */ React62.createElement(Box51, { height: 1, flexWrap: "nowrap" }, /* @__PURE__ */ React62.createElement(Text54, null, "  "), /* @__PURE__ */ React62.createElement(Text54, { color: FG.faint, wrap: "truncate" }, "\u2500".repeat(ruleWidth))), /* @__PURE__ */ React62.createElement(Box51, { flexDirection: "row", height: 1, minHeight: 1, flexWrap: "nowrap", flexShrink: 0 }, /* @__PURE__ */ React62.createElement(Text54, { wrap: "truncate" }, "  "), status2.recording ? /* @__PURE__ */ React62.createElement(RecordingPill, { rec: status2.recording }) : status2.countdownSeconds !== void 0 ? /* @__PURE__ */ React62.createElement(CountdownRow, { mode: status2.mode, secondsLeft: status2.countdownSeconds }) : /* @__PURE__ */ React62.createElement(ModePill2, { mode: status2.mode, network: status2.network, detail: status2.networkDetail }), cols >= PRESET_MIN_COLS && status2.preset !== void 0 && /* @__PURE__ */ React62.createElement(PresetPill, { preset: status2.preset, model: session.model }), /* @__PURE__ */ React62.createElement(Sep, null), /* @__PURE__ */ React62.createElement(Text54, { color: FG.sub, wrap: "truncate" }, `${session.id} \xB7 ${session.branch}`), hasTurn && statusBar.showTurnCost && /* @__PURE__ */ React62.createElement(React62.Fragment, null, /* @__PURE__ */ React62.createElement(Sep, null), /* @__PURE__ */ React62.createElement(Text54, { bold: true, color: TONE.brand, wrap: "truncate" }, "\u25B8 "), /* @__PURE__ */ React62.createElement(Text54, { bold: true, color: FG.body, wrap: "truncate" }, `${formatCost(status2.cost, status2.balanceCurrency)} ${t("statusBar.turn")}`)), statusBar.showCacheHit && /* @__PURE__ */ React62.createElement(React62.Fragment, null, /* @__PURE__ */ React62.createElement(Sep, null), /* @__PURE__ */ React62.createElement(
    Text54,
    {
      color: TONE.accent,
      wrap: "truncate"
    },
    `${t("statusBar.cache")} ${Math.round(status2.cacheHit * 100)}%`
  )), status2.mcpLoading && status2.mcpLoading.ready < status2.mcpLoading.total && /* @__PURE__ */ React62.createElement(McpLoadingPill, { ready: status2.mcpLoading.ready, total: status2.mcpLoading.total }), showWallet && /* @__PURE__ */ React62.createElement(
    WalletPill,
    {
      sessionCostUsd: status2.sessionCost,
      balance: status2.balance,
      currency: status2.balanceCurrency,
      showSessionCost: statusBar.showSessionCost,
      showBalance: statusBar.showBalance
    }
  ), statusBar.showVersion && cols >= VERSION_MIN_COLS && /* @__PURE__ */ React62.createElement(React62.Fragment, null, /* @__PURE__ */ React62.createElement(Sep, null), /* @__PURE__ */ React62.createElement(Text54, { color: FG.faint, wrap: "truncate" }, `v${VERSION}`)), statusBar.showFeedbackHint && cols >= FEEDBACK_HINT_MIN_COLS && /* @__PURE__ */ React62.createElement(React62.Fragment, null, /* @__PURE__ */ React62.createElement(Sep, null), /* @__PURE__ */ React62.createElement(Text54, { color: FG.meta, wrap: "truncate" }, "\u2691 "), /* @__PURE__ */ React62.createElement(Text54, { color: FG.sub, wrap: "truncate" }, "/feedback"))));
}
function PresetPill({
  preset: preset2,
  model: model2
}) {
  const label = preset2 ?? shortModelLabel(model2);
  const color = preset2 === "pro" ? TONE.accent : preset2 === "flash" ? TONE.brand : FG.sub;
  return /* @__PURE__ */ React62.createElement(React62.Fragment, null, /* @__PURE__ */ React62.createElement(Sep, null), /* @__PURE__ */ React62.createElement(Text54, { color: FG.meta, wrap: "truncate" }, "\u25B4 "), /* @__PURE__ */ React62.createElement(Text54, { color, wrap: "truncate" }, label));
}
function shortModelLabel(model2) {
  if (model2 === "deepseek-v4-flash") return "flash";
  if (model2 === "deepseek-v4-pro") return "pro";
  return model2.replace(/^deepseek-/, "");
}
function McpLoadingPill({
  ready,
  total
}) {
  return /* @__PURE__ */ React62.createElement(React62.Fragment, null, /* @__PURE__ */ React62.createElement(Sep, null), /* @__PURE__ */ React62.createElement(Text54, { color: TONE.brand, wrap: "truncate" }, "\u2301 "), /* @__PURE__ */ React62.createElement(
    Text54,
    {
      color: FG.body,
      wrap: "truncate"
    },
    `${t("statusBar.mcpLoading")} ${ready}/${total}`
  ));
}
function WalletPill({
  sessionCostUsd,
  balance,
  currency,
  showSessionCost,
  showBalance: showBalanceCfg
}) {
  const showSpent = showSessionCost && sessionCostUsd > 0;
  const showBalanceLine = showBalanceCfg && typeof balance === "number";
  return /* @__PURE__ */ React62.createElement(React62.Fragment, null, /* @__PURE__ */ React62.createElement(Sep, null), /* @__PURE__ */ React62.createElement(Text54, { color: FG.meta, wrap: "truncate" }, "\u26C1 "), showSpent && /* @__PURE__ */ React62.createElement(
    Text54,
    {
      color: FG.body,
      wrap: "truncate"
    },
    `${formatCost(sessionCostUsd, currency, 2)} ${t("statusBar.spent")}`
  ), showSpent && showBalanceLine && /* @__PURE__ */ React62.createElement(Text54, { color: FG.meta, wrap: "truncate" }, "  /  "), showBalanceLine && /* @__PURE__ */ React62.createElement(Text54, { bold: true, color: balanceColor(balance, currency), wrap: "truncate" }, formatBalance(balance, currency, { fractionDigits: 2 })), showBalanceLine && /* @__PURE__ */ React62.createElement(Text54, { color: FG.faint, wrap: "truncate" }, t("statusBar.left")));
}
function ModePill2({
  mode: mode2,
  network,
  detail
}) {
  const modeLabel = `${t("statusBar.editsLabel")}${mode2}`;
  if (network === "online") {
    const pill = modeGlyph(mode2);
    return /* @__PURE__ */ React62.createElement(Box51, { flexDirection: "row", height: 1, flexWrap: "nowrap" }, /* @__PURE__ */ React62.createElement(Text54, { color: pill.color, wrap: "truncate" }, pill.glyph), /* @__PURE__ */ React62.createElement(Text54, { color: FG.sub, wrap: "truncate" }, ` ${modeLabel}`));
  }
  const dot = networkDot(network);
  if (network === "slow") {
    const tail = detail ? ` \xB7 ${detail}` : "";
    return /* @__PURE__ */ React62.createElement(Box51, { flexDirection: "row", height: 1, flexWrap: "nowrap" }, /* @__PURE__ */ React62.createElement(Text54, { color: dot.color, wrap: "truncate" }, dot.glyph), /* @__PURE__ */ React62.createElement(
      Text54,
      {
        color: dot.color,
        wrap: "truncate"
      },
      ` ${modeLabel} \xB7 ${t("statusBar.slow")}${tail}`
    ));
  }
  if (network === "disconnected") {
    const tail = detail ? ` \xB7 ${detail}` : "";
    return /* @__PURE__ */ React62.createElement(Box51, { flexDirection: "row", height: 1, flexWrap: "nowrap" }, /* @__PURE__ */ React62.createElement(Text54, { color: dot.color, wrap: "truncate" }, dot.glyph), /* @__PURE__ */ React62.createElement(Text54, { color: dot.color, wrap: "truncate" }, ` ${t("statusBar.disconnect")}${tail}`));
  }
  return /* @__PURE__ */ React62.createElement(Box51, { flexDirection: "row", height: 1, flexWrap: "nowrap" }, /* @__PURE__ */ React62.createElement(Text54, { color: dot.color, wrap: "truncate" }, dot.glyph), /* @__PURE__ */ React62.createElement(Text54, { color: dot.color, wrap: "truncate" }, ` ${t("statusBar.reconnecting")}`));
}
function CountdownRow({
  mode: mode2,
  secondsLeft
}) {
  const pill = modeGlyph(mode2);
  const endsAt = Date.now() + secondsLeft * 1e3;
  return /* @__PURE__ */ React62.createElement(Box51, { flexDirection: "row", height: 1, flexWrap: "nowrap" }, /* @__PURE__ */ React62.createElement(Text54, { color: pill.color, wrap: "truncate" }, pill.glyph), /* @__PURE__ */ React62.createElement(Text54, { color: FG.sub, wrap: "truncate" }, ` ${t("statusBar.editsLabel")}${mode2}   \xB7   `), /* @__PURE__ */ React62.createElement(Text54, { color: TONE.warn, wrap: "truncate" }, t("statusBar.approvingIn")), /* @__PURE__ */ React62.createElement(Countdown, { endsAt }), /* @__PURE__ */ React62.createElement(Text54, { color: TONE.warn, wrap: "truncate" }, t("statusBar.escToInterrupt")));
}
function RecordingPill({ rec }) {
  const sizeMb = (rec.sizeBytes / (1024 * 1024)).toFixed(1);
  return /* @__PURE__ */ React62.createElement(Box51, { flexDirection: "row", height: 1, flexWrap: "nowrap" }, /* @__PURE__ */ React62.createElement(Text54, { bold: true, color: TONE.err, wrap: "truncate" }, t("statusBar.recordingGlyph")), /* @__PURE__ */ React62.createElement(
    Text54,
    {
      color: TONE.err,
      wrap: "truncate"
    },
    ` ${sizeMb}${t("statusBar.mb")} \xB7 ${rec.events}${t("statusBar.evt")}`
  ));
}
function Sep() {
  return /* @__PURE__ */ React62.createElement(Text54, { color: FG.meta, wrap: "truncate" }, "   \xB7   ");
}
function modeGlyph(mode2) {
  switch (mode2) {
    case "auto":
      return { glyph: "\u25CF", color: TONE.ok };
    case "ask":
      return { glyph: "\u25D0", color: TONE.warn };
    case "plan":
      return { glyph: "\u229E", color: TONE.accent };
    case "edit":
      return { glyph: "\xB1", color: TONE.ok };
  }
}
function networkDot(state) {
  switch (state) {
    case "online":
      return { glyph: "\u25CF", color: TONE.ok };
    case "slow":
      return { glyph: "\u25CC", color: TONE.warn };
    case "disconnected":
      return { glyph: "\u2717", color: TONE.err };
    case "reconnecting":
      return { glyph: "\u21BB", color: TONE.brand };
  }
}

// src/cli/ui/layout/ToastRail.tsx
import { Box as Box52, Text as Text55, useStdout as useStdout17 } from "ink";
import React63, { useEffect as useEffect13 } from "react";
var TONE_COLOR = {
  ok: TONE.ok,
  info: TONE.brand,
  warn: TONE.warn,
  err: TONE.err
};
var TONE_GLYPH = {
  ok: "\u2713",
  info: "\u24D8",
  warn: "\u26A0",
  err: "\u2717"
};
function bodyColor(toast, now) {
  const elapsed = now - toast.bornAt;
  const remaining = toast.ttlMs - elapsed;
  return remaining < toast.ttlMs / 3 ? FG.meta : FG.body;
}
function ToastRail() {
  const toasts = useAgentState((s) => s.toasts);
  const dispatch = useDispatch();
  useSlowTick();
  const { stdout } = useStdout17();
  const cols = stdout?.columns ?? 80;
  const rule = "\u2501".repeat(Math.max(20, cols - 4));
  const now = Date.now();
  useEffect13(() => {
    const timers = [];
    for (const t2 of toasts) {
      const remaining = Math.max(0, t2.ttlMs - (Date.now() - t2.bornAt));
      timers.push(setTimeout(() => dispatch({ type: "toast.hide", id: t2.id }), remaining));
    }
    return () => {
      for (const id of timers) clearTimeout(id);
    };
  }, [toasts, dispatch]);
  const visible = toasts.filter((t2) => now - t2.bornAt < t2.ttlMs);
  if (visible.length === 0) return null;
  return /* @__PURE__ */ React63.createElement(Box52, { flexDirection: "column" }, visible.map((t2) => {
    const color = TONE_COLOR[t2.tone];
    const glyph = TONE_GLYPH[t2.tone];
    const body = bodyColor(t2, now);
    const remainingSec = Math.max(0, Math.ceil((t2.ttlMs - (now - t2.bornAt)) / 1e3));
    return /* @__PURE__ */ React63.createElement(Box52, { key: t2.id, flexDirection: "column", paddingX: 1 }, /* @__PURE__ */ React63.createElement(Text55, { color }, rule), /* @__PURE__ */ React63.createElement(Box52, { flexDirection: "row" }, /* @__PURE__ */ React63.createElement(Text55, { color }, glyph), /* @__PURE__ */ React63.createElement(Text55, { bold: true, color: body }, ` ${t2.title}`), t2.detail !== void 0 && /* @__PURE__ */ React63.createElement(Text55, { color: FG.sub }, `  \xB7  ${t2.detail}`), /* @__PURE__ */ React63.createElement(Box52, { flexGrow: 1 }), /* @__PURE__ */ React63.createElement(Text55, { color: FG.faint }, `${remainingSec}s`)));
  }));
}

// src/cli/ui/layout/plan-live-row.tsx
import React64 from "react";
function isActivePlanInFlight(card) {
  if (card.kind !== "plan") return false;
  if (card.variant !== "active") return false;
  return !card.steps.every((s) => s.status === "done" || s.status === "skipped");
}
function PlanLiveRow() {
  const planCard = useAgentState((s) => {
    for (let i = s.cards.length - 1; i >= 0; i--) {
      const c = s.cards[i];
      if (isActivePlanInFlight(c)) return c;
    }
    return null;
  });
  if (!planCard) return null;
  return /* @__PURE__ */ React64.createElement(PlanCard, { card: planCard });
}

// src/cli/ui/loop.ts
var MIN_LOOP_INTERVAL_MS = 5e3;
var MAX_LOOP_INTERVAL_MS = 6 * 60 * 6e4;
function parseLoopInterval(raw) {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const m = /^([0-9]+(?:\.[0-9]+)?)(s|sec|secs|m|min|mins|h|hr|hrs)?$/.exec(s);
  if (!m) return null;
  const n = Number.parseFloat(m[1] ?? "");
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2] ?? "s";
  let ms;
  if (unit === "s" || unit === "sec" || unit === "secs") ms = Math.round(n * 1e3);
  else if (unit === "m" || unit === "min" || unit === "mins") ms = Math.round(n * 6e4);
  else if (unit === "h" || unit === "hr" || unit === "hrs") ms = Math.round(n * 60 * 6e4);
  else return null;
  if (ms < MIN_LOOP_INTERVAL_MS) return null;
  if (ms > MAX_LOOP_INTERVAL_MS) return null;
  return { ms };
}
function parseLoopCommand(args) {
  if (args.length === 0) return { kind: "status" };
  const first = (args[0] ?? "").toLowerCase();
  if (args.length === 1 && (first === "stop" || first === "off" || first === "cancel")) {
    return { kind: "stop" };
  }
  const interval = parseLoopInterval(args[0] ?? "");
  if (!interval) {
    return {
      kind: "error",
      message: "usage: /loop <interval> <prompt>   (interval = 5s..6h, e.g. 30s, 5m, 1h)\n       /loop stop                  (cancel an active loop)\n       /loop                       (show active-loop status)"
    };
  }
  const prompt = args.slice(1).join(" ").trim();
  if (!prompt) {
    return {
      kind: "error",
      message: `usage: /loop ${args[0]} <prompt>   \u2014 interval is fine but the prompt is missing.`
    };
  }
  return { kind: "start", intervalMs: interval.ms, prompt };
}
function formatLoopStatus(prompt, nextFireMs, iter) {
  const preview = prompt.length > 36 ? `${prompt.slice(0, 33)}\u2026` : prompt;
  const when = nextFireMs <= 0 ? "firing now" : `next in ${formatDuration(nextFireMs)}`;
  return `loop: \`${preview}\` \xB7 ${when} \xB7 iter ${iter}`;
}
function formatDuration(ms) {
  if (ms < 1e3) return `${ms}ms`;
  const totalSec = Math.round(ms / 1e3);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return s === 0 ? `${m}m` : `${m}m${s}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h${mm}m`;
}

// src/cli/ui/mcp-append.ts
function applyMcpAppend(loop2, target, addedTools) {
  const accepted = [];
  for (const mcpTool of addedTools) {
    if (!mcpTool.name) continue;
    const registeredName = registerSingleMcpTool(mcpTool, target.bridgeEnv);
    if (!registeredName) continue;
    const spec = {
      type: "function",
      function: {
        name: registeredName,
        description: mcpTool.description ?? "",
        parameters: mcpTool.inputSchema
      }
    };
    loop2.prefix.addTool(spec);
    accepted.push(mcpTool);
  }
  if (accepted.length === 0 || !target.report.tools.supported) return target;
  const merged = [...target.report.tools.items, ...accepted];
  return {
    ...target,
    toolCount: merged.length,
    report: {
      ...target.report,
      tools: {
        supported: true,
        items: merged
      }
    }
  };
}

// src/cli/ui/mcp-browse.ts
function formatResourceList(servers) {
  const lines = [];
  let total = 0;
  for (const s of servers) {
    if (!s.report.resources.supported) continue;
    const items = s.report.resources.items;
    if (items.length === 0) continue;
    lines.push(`[${s.label}] ${items.length} resource(s):`);
    for (const r of items.slice(0, 20)) {
      const name = r.name && r.name !== r.uri ? `  ${r.name}` : "";
      const mime = r.mimeType ? ` \xB7 ${r.mimeType}` : "";
      lines.push(`  \xB7 ${r.uri}${name}${mime}`);
      total++;
    }
    if (items.length > 20) lines.push(`  (+${items.length - 20} more)`);
    lines.push("");
  }
  if (total === 0) {
    return "No resources on any connected MCP server (or no servers connected). `/mcp` shows the current set.";
  }
  lines.push("Read one: `/resource <uri>` \u2014 or use Tab in the picker.");
  return lines.join("\n");
}
function formatPromptList(servers) {
  const lines = [];
  let total = 0;
  for (const s of servers) {
    if (!s.report.prompts.supported) continue;
    const items = s.report.prompts.items;
    if (items.length === 0) continue;
    lines.push(`[${s.label}] ${items.length} prompt(s):`);
    for (const p of items.slice(0, 20)) {
      const desc = p.description ? ` \u2014 ${p.description}` : "";
      const argHint = p.arguments && p.arguments.length > 0 ? ` (args: ${p.arguments.map((a) => a.name + (a.required ? "*" : "?")).join(", ")})` : "";
      lines.push(`  \xB7 ${p.name}${argHint}${desc}`);
      total++;
    }
    if (items.length > 20) lines.push(`  (+${items.length - 20} more)`);
    lines.push("");
  }
  if (total === 0) {
    return "No prompts on any connected MCP server (or no servers connected). `/mcp` shows the current set.";
  }
  lines.push(
    "Fetch one: `/prompt <name>` \u2014 args are not supported yet; prompts with required args will surface an error from the server."
  );
  return lines.join("\n");
}
function findServerForResource(servers, uri) {
  for (const s of servers) {
    if (!s.report.resources.supported) continue;
    if (s.report.resources.items.some((r) => r.uri === uri)) return s;
  }
  return null;
}
function findServerForPrompt(servers, name) {
  for (const s of servers) {
    if (!s.report.prompts.supported) continue;
    if (s.report.prompts.items.some((p) => p.name === name)) return s;
  }
  return null;
}
function formatResourceContents(uri, result) {
  const lines = [`Resource ${uri} (${result.contents.length} content block(s)):`, ""];
  for (let i = 0; i < result.contents.length; i++) {
    const c = result.contents[i];
    const header = `\u2014 block ${i + 1}${c.mimeType ? ` \xB7 ${c.mimeType}` : ""}`;
    lines.push(header);
    lines.push(formatOneResourceContent(c));
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
function formatOneResourceContent(c) {
  if ("text" in c) {
    const MAX = 8e3;
    if (c.text.length > MAX) {
      return `${c.text.slice(0, MAX)}

[\u2026truncated ${c.text.length - MAX} chars; full contents available via McpClient.readResource in library mode.]`;
    }
    return c.text;
  }
  const bytes = typeof c.blob === "string" ? approximateBase64ByteSize(c.blob) : 0;
  return `[binary \xB7 ~${bytes.toLocaleString()} bytes \xB7 base64]`;
}
function approximateBase64ByteSize(b64) {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor(b64.length * 3 / 4) - padding;
}
function formatPromptMessages(name, result) {
  const lines = [
    `Prompt ${name}${result.description ? ` \u2014 ${result.description}` : ""}`,
    `(${result.messages.length} message(s))`,
    ""
  ];
  for (let i = 0; i < result.messages.length; i++) {
    const m = result.messages[i];
    lines.push(`\u2014 ${i + 1}. ${m.role}`);
    lines.push(formatOnePromptMessage(m));
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
function formatOnePromptMessage(m) {
  const block2 = m.content;
  if (block2.type === "text" && typeof block2.text === "string") return block2.text;
  if (block2.type === "resource" && block2.resource) {
    return `[resource: ${block2.resource.uri}]
${formatOneResourceContent(block2.resource)}`;
  }
  return `[non-text content: ${block2.type ?? "unknown"}]`;
}
async function handleMcpBrowseSlash(kind, arg, servers, log) {
  if (!arg) {
    log.pushInfo(kind === "resource" ? formatResourceList(servers) : formatPromptList(servers));
    return;
  }
  if (kind === "resource") {
    const server2 = findServerForResource(servers, arg);
    if (!server2) {
      log.pushWarning(
        `no server exposes resource "${arg}"`,
        "`/resource` with no arg lists what's available."
      );
      return;
    }
    try {
      const result = await server2.readResource(arg);
      log.pushInfo(formatResourceContents(arg, result));
    } catch (err) {
      log.pushWarning("readResource failed", err.message);
    }
    return;
  }
  const server = findServerForPrompt(servers, arg);
  if (!server) {
    log.pushWarning(
      `no server exposes prompt "${arg}"`,
      "`/prompt` with no arg lists what's available."
    );
    return;
  }
  try {
    const result = await server.getPrompt(arg);
    log.pushInfo(formatPromptMessages(arg, result));
  } catch (err) {
    log.pushWarning("getPrompt failed", err.message);
  }
}

// src/cli/ui/mcp-server-list.ts
function sameMcpServerSummary(a, b) {
  return a === b || a.label === b.label && a.spec === b.spec;
}
function replaceMcpServerSummary(servers, target, updated) {
  return servers.map((server) => sameMcpServerSummary(server, target) ? updated : server);
}

// src/cli/ui/paste-collapse.ts
var DEFAULT_PASTE_LINE_THRESHOLD = 40;
var DEFAULT_PASTE_CHAR_THRESHOLD = 2e3;
var DEFAULT_PASTE_HEAD_LINES = 10;
function formatLongPaste(input, opts = {}) {
  const lineCap = opts.lineThreshold ?? DEFAULT_PASTE_LINE_THRESHOLD;
  const charCap = opts.charThreshold ?? DEFAULT_PASTE_CHAR_THRESHOLD;
  const headN = Math.max(1, opts.headLines ?? DEFAULT_PASTE_HEAD_LINES);
  const originalChars = input.length;
  const lines = input.split("\n");
  const originalLines = lines.length;
  if (originalChars <= charCap && originalLines <= lineCap) {
    return { displayText: input, collapsed: false, originalChars, originalLines };
  }
  const header = `\u25B8 pasted ${formatBytes2(originalChars)} (${originalLines} lines) \u2014 first ${Math.min(headN, originalLines)} shown, full text sent to model`;
  const head = lines.slice(0, headN).join("\n");
  const remaining = originalLines - headN;
  const footer = remaining > 0 ? `\u2026 (${remaining} more line${remaining === 1 ? "" : "s"})` : "";
  const displayText = footer ? `${header}
${head}
${footer}` : `${header}
${head}`;
  return { displayText, collapsed: true, originalChars, originalLines };
}
function formatBytes2(n) {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

// src/cli/ui/slash/handlers/admin.ts
var doctor = (_args, _loop, ctx) => {
  const root = ctx.codeRoot ?? process.cwd();
  if (!ctx.postDoctor) return { info: t("handlers.admin.doctorNeedsTui") };
  void (async () => {
    const checks = await runDoctorChecks(root);
    ctx.postDoctor(
      checks.map((c) => ({ label: c.label.trim(), level: c.level, detail: c.detail }))
    );
  })();
  return { info: t("handlers.admin.doctorRunning") };
};
var hooks = (args, loop2, ctx) => {
  const sub = (args[0] ?? "").toLowerCase();
  if (sub === "reload") {
    if (!ctx.reloadHooks) {
      return { info: t("handlers.admin.hooksReloadUnavailable") };
    }
    const count = ctx.reloadHooks();
    return { info: t("handlers.admin.hooksReloaded", { count }) };
  }
  if (sub !== "" && sub !== "list" && sub !== "ls") {
    return { info: t("handlers.admin.hooksUsage") };
  }
  const all = loop2.hooks;
  const projPath = ctx.codeRoot ? projectSettingsPath(ctx.codeRoot) : void 0;
  const globPath = globalSettingsPath();
  if (all.length === 0) {
    const lines2 = [
      t("handlers.admin.hooksNone"),
      "",
      t("handlers.admin.hooksDropHint"),
      ctx.codeRoot ? t("handlers.admin.hooksProject", { path: projPath }) : t("handlers.admin.hooksProjectFallback"),
      t("handlers.admin.hooksGlobal", { path: globPath }),
      "",
      t("handlers.admin.hooksEvents"),
      t("handlers.admin.hooksExitCodes")
    ];
    return { info: lines2.join("\n") };
  }
  const grouped = /* @__PURE__ */ new Map();
  for (const event of HOOK_EVENTS) grouped.set(event, []);
  for (const h of all) grouped.get(h.event)?.push(h);
  const lines = [t("handlers.admin.hooksLoaded", { count: all.length })];
  for (const event of HOOK_EVENTS) {
    const list2 = grouped.get(event) ?? [];
    if (list2.length === 0) continue;
    lines.push("", `${event}:`);
    for (const h of list2) {
      const match = h.match && h.match !== "*" ? ` match=${h.match}` : "";
      const desc = h.description ? `  \u2014 ${h.description}` : "";
      lines.push(`  [${h.scope}]${match} ${h.command}${desc}`);
    }
  }
  lines.push(
    "",
    t("handlers.admin.hooksSources", {
      project: projPath ?? "(none \u2014 chat mode)",
      global: globPath
    })
  );
  return { info: lines.join("\n") };
};
var update = (_args, _loop, ctx) => {
  const latest = ctx.latestVersion ?? null;
  const lines = [t("handlers.admin.updateCurrent", { version: VERSION })];
  if (latest === null) {
    ctx.refreshLatestVersion?.();
    lines.push(
      t("handlers.admin.updateLatestPending"),
      "",
      t("handlers.admin.updateRetryHint"),
      t("handlers.admin.updateRetryHint2")
    );
    return { info: lines.join("\n") };
  }
  lines.push(t("handlers.admin.updateLatest", { version: latest }));
  if (compareVersions(VERSION, latest) >= 0) {
    lines.push("", t("handlers.admin.updateUpToDate"));
    return { info: lines.join("\n") };
  }
  const installSource = detectInstallSource();
  const npmPrefix = installSource === "npm" ? detectNpmInstallPrefix() : null;
  const plan2 = planUpdate({ current: VERSION, latest, installSource, npmPrefix });
  if (plan2.action === "npx-hint") {
    lines.push("", t("handlers.admin.updateNpxHint"), t("handlers.admin.updateNpxForce"));
    return { info: lines.join("\n") };
  }
  lines.push("", t("handlers.admin.updateUpgradeHint"), t("handlers.admin.updateUpgradeCmd1"));
  if (plan2.action === "run-install" && plan2.command) {
    lines.push(t("handlers.admin.updateUpgradeCmd2", { command: plan2.command.join(" ") }));
  } else {
    lines.push(...MANUAL_UPDATE_COMMANDS.map((c) => `  ${c}`));
  }
  lines.push(
    "",
    t("handlers.admin.updateInSessionDisabled"),
    t("handlers.admin.updateInSessionDisabled2")
  );
  return { info: lines.join("\n") };
};
var stats = () => {
  const path = defaultUsageLogPath();
  const records = readUsageLog(path);
  if (records.length === 0) {
    return {
      info: [
        t("handlers.admin.statsNoData"),
        "",
        `  ${path}`,
        "",
        t("handlers.admin.statsEveryTurn"),
        t("handlers.admin.statsWillAppear")
      ].join("\n")
    };
  }
  const agg = aggregateUsage(records);
  return { info: renderDashboard(agg, path) };
};
var handlers = {
  hook: hooks,
  hooks,
  update,
  stats,
  doctor
};

// src/cli/ui/slash/handlers/basic.ts
var exit = () => ({ exit: true });
var resetLog = (_args, loop2) => {
  const { dropped, archived, systemRebuilt } = loop2.clearLog();
  const head = archived ? t("handlers.basic.newInfoArchived", { count: dropped, archived }) : t("handlers.basic.newInfo", { count: dropped });
  const info = systemRebuilt ? head + t("handlers.basic.newInfoSystemReloaded") : head;
  return { clear: true, info };
};
function groupHeader(group) {
  const cap = group.charAt(0).toUpperCase() + group.slice(1);
  const label = t(`slashSuggestions.group${cap}`);
  const detail = t(`slashSuggestions.groupDetail${cap}`);
  return `${label}  \xB7  ${detail}`;
}
function renderRow(spec) {
  const name = `/${spec.cmd}${spec.argsHint ? ` ${spec.argsHint}` : ""}`;
  const desc = t(`slash.${spec.cmd}.description`);
  const summary = desc === `slash.${spec.cmd}.description` ? spec.summary : desc;
  return `  ${name.padEnd(28)}  ${summary}`;
}
var help = () => {
  const lines = [t("handlers.basic.helpTitle"), ""];
  const rowsByGroup = /* @__PURE__ */ new Map();
  for (const group of SLASH_GROUP_ORDER) rowsByGroup.set(group, []);
  for (const command of orderSlashCommandsByGroup(SLASH_COMMANDS)) {
    rowsByGroup.get(command.group).push(command);
  }
  for (const group of SLASH_GROUP_ORDER) {
    const rows = rowsByGroup.get(group) ?? [];
    if (rows.length === 0) continue;
    lines.push(`  ${groupHeader(group)}`);
    for (const r of rows) lines.push(renderRow(r));
    lines.push("");
  }
  lines.push(
    t("handlers.basic.helpShellTitle"),
    t("handlers.basic.helpShell"),
    t("handlers.basic.helpShellDetail"),
    t("handlers.basic.helpShellConsent"),
    t("handlers.basic.helpShellExample"),
    "",
    t("handlers.basic.helpMemoryTitle"),
    t("handlers.basic.helpMemoryPin"),
    t("handlers.basic.helpMemoryPinEx"),
    t("handlers.basic.helpMemoryGlobal"),
    t("handlers.basic.helpMemoryGlobalEx"),
    t("handlers.basic.helpMemoryPinBoth"),
    t("handlers.basic.helpMemoryEscape"),
    "",
    t("handlers.basic.helpFileTitle"),
    t("handlers.basic.helpFile"),
    t("handlers.basic.helpFilePicker"),
    "",
    t("handlers.basic.helpUrlTitle"),
    t("handlers.basic.helpUrl"),
    t("handlers.basic.helpUrlCache"),
    t("handlers.basic.helpUrlPunct"),
    "",
    t("handlers.basic.helpPresetsTitle"),
    t("handlers.basic.helpPresetAuto"),
    t("handlers.basic.helpPresetFlash"),
    t("handlers.basic.helpPresetPro"),
    "",
    t("handlers.basic.helpSessionsTitle"),
    t("handlers.basic.helpSessionCustom"),
    t("handlers.basic.helpSessionNone")
  );
  return { info: lines.join("\n") };
};
var retry = (_args, loop2) => {
  const prev = loop2.retryLastUser();
  if (!prev) {
    return { info: t("handlers.basic.retryNone") };
  }
  const preview = prev.length > 80 ? `${prev.slice(0, 80)}\u2026` : prev;
  return {
    info: t("handlers.basic.retryInfo", { preview }),
    resubmit: prev
  };
};
var loop = (args, _loop, ctx) => {
  if (!ctx.startLoop || !ctx.stopLoop || !ctx.getLoopStatus) {
    return { info: t("handlers.basic.loopTuiOnly") };
  }
  const cmd = parseLoopCommand(args);
  if (cmd.kind === "error") return { info: cmd.message };
  if (cmd.kind === "stop") {
    const wasActive = ctx.getLoopStatus() !== null;
    ctx.stopLoop();
    return {
      info: wasActive ? t("handlers.basic.loopStopped") : t("handlers.basic.loopNoActive")
    };
  }
  if (cmd.kind === "status") {
    const status2 = ctx.getLoopStatus();
    if (!status2) {
      return { info: t("handlers.basic.loopNoActiveHint") };
    }
    return { info: `\u25B8 ${formatLoopStatus(status2.prompt, status2.nextFireMs, status2.iter)}` };
  }
  ctx.startLoop(cmd.intervalMs, cmd.prompt);
  return {
    info: t("handlers.basic.loopStarted", {
      prompt: cmd.prompt,
      duration: formatDuration(cmd.intervalMs)
    })
  };
};
var keys = (_args, _loop, ctx) => {
  if (!ctx.postKeys) return { info: t("handlers.basic.keysNeedsTui") };
  const ref = tObj("ui.keysReference");
  ctx.postKeys({ topic: ref.topic, sections: ref.sections, footer: ref.footer });
  return {};
};
var copy = () => ({ openCopyMode: true });
var handlers2 = {
  exit,
  new: resetLog,
  help,
  retry,
  loop,
  keys,
  copy
};

// src/cli/ui/slash/handlers/dashboard.ts
var dashboard = (args, _loop, ctx) => {
  if (!ctx.startDashboard || !ctx.getDashboardUrl) {
    return { info: t("handlers.dashboard.notAvailable") };
  }
  const sub = (args[0] ?? "").toLowerCase();
  if (sub === "stop" || sub === "off") {
    if (!ctx.stopDashboard) {
      return { info: t("handlers.dashboard.stopNoCallback") };
    }
    const url = ctx.getDashboardUrl();
    if (!url) return { info: t("handlers.dashboard.notRunning") };
    ctx.stopDashboard();
    return { info: t("handlers.dashboard.stopping") };
  }
  const existing = ctx.getDashboardUrl();
  if (existing) {
    return {
      info: [
        t("handlers.dashboard.alreadyRunning"),
        `  ${existing}`,
        "",
        t("handlers.dashboard.alreadyRunningHint")
      ].join("\n")
    };
  }
  ctx.startDashboard().then((url) => {
    ctx.postInfo?.(
      [t("handlers.dashboard.ready"), `  ${url}`, "", t("handlers.dashboard.readyHint")].join(
        "\n"
      )
    );
  }).catch((err) => {
    ctx.postInfo?.(t("handlers.dashboard.failed", { reason: err.message }));
  });
  return { info: t("handlers.dashboard.starting") };
};
var handlers3 = { dashboard };

// src/cli/ui/slash/helpers.ts
import { spawnSync } from "child_process";
function resolveMemoryTarget(store, raw) {
  const slash = raw.indexOf("/");
  if (slash > 0) {
    const scopeRaw = raw.slice(0, slash).toLowerCase();
    const name = raw.slice(slash + 1);
    if (scopeRaw !== "global" && scopeRaw !== "project") return null;
    const scope = scopeRaw;
    if (scope === "project" && !store.hasProjectScope()) return null;
    return { scope, name };
  }
  for (const scope of ["project", "global"]) {
    if (scope === "project" && !store.hasProjectScope()) continue;
    try {
      store.read(scope, raw);
      return { scope, name: raw };
    } catch {
    }
  }
  return null;
}
function appendSection(lines, label, section) {
  if (!section || !section.supported) {
    lines.push(
      `  ${label.trim()}    ${section?.supported === false ? "(not supported)" : "(none)"}`
    );
    return;
  }
  const names = section.items.map((i) => i.name);
  if (names.length === 0) {
    lines.push(`  ${label.trim()}    (none)`);
    return;
  }
  const head = names.slice(0, 5).join(", ");
  const more = names.length > 5 ? ` +${names.length - 5} more` : "";
  lines.push(`  ${label.trim()}    ${names.length}  [${head}${more}]`);
}
function compactNum2(n) {
  if (n < 1024) return String(n);
  const k = n / 1024;
  return k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`;
}
function stripOuterQuotes(s) {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}
function runGitCommit(rootDir, message) {
  const add = spawnSync("git", ["add", "-A"], { cwd: rootDir, encoding: "utf8" });
  if (add.error || add.status !== 0) {
    return { info: `git add failed (${add.status ?? "?"}):
${gitTail(add)}` };
  }
  const commit2 = spawnSync("git", ["commit", "-m", message], {
    cwd: rootDir,
    encoding: "utf8"
  });
  if (commit2.error || commit2.status !== 0) {
    return { info: `git commit failed (${commit2.status ?? "?"}):
${gitTail(commit2)}` };
  }
  const firstLine = (commit2.stdout || "").split(/\r?\n/)[0] ?? "";
  return { info: `\u25B8 committed: ${message}${firstLine ? `
  ${firstLine}` : ""}` };
}
function gitTail(res) {
  const stderr = res.stderr ?? "";
  const stdout = res.stdout ?? "";
  const body = stderr.trim() || stdout.trim();
  if (body) return body;
  if (res.error) return res.error.message;
  return "(no output from git)";
}

// src/cli/ui/slash/handlers/edits.ts
var undo = (args, _loop, ctx) => {
  if (!ctx.codeUndo) {
    return { info: t("handlers.edits.undoCodeOnly") };
  }
  return { info: ctx.codeUndo(args) };
};
var history = (_args, _loop, ctx) => {
  if (!ctx.codeHistory) {
    return { info: t("handlers.edits.historyCodeOnly") };
  }
  return { info: ctx.codeHistory() };
};
var show = (args, _loop, ctx) => {
  if (!ctx.codeShowEdit) {
    return { info: t("handlers.edits.showCodeOnly") };
  }
  return { info: ctx.codeShowEdit(args) };
};
var apply = (args, _loop, ctx) => {
  if (!ctx.codeApply) {
    return { info: t("handlers.edits.applyCodeOnly") };
  }
  const parsed = parseIndicesArg(args, ctx.pendingEditCount ?? 0);
  if ("error" in parsed) return { info: `/apply: ${parsed.error}` };
  return { info: ctx.codeApply(parsed.indices) };
};
var discard = (args, _loop, ctx) => {
  if (!ctx.codeDiscard) {
    return { info: t("handlers.edits.discardCodeOnly") };
  }
  const parsed = parseIndicesArg(args, ctx.pendingEditCount ?? 0);
  if ("error" in parsed) return { info: `/discard: ${parsed.error}` };
  return { info: ctx.codeDiscard(parsed.indices) };
};
function parseIndicesArg(args, max) {
  const raw = args.join(",").replace(/,+/g, ",").replace(/^,|,$/g, "");
  if (!raw) return { indices: [] };
  const parsed = parseEditIndices(raw, max);
  if ("error" in parsed) return { error: parsed.error };
  return { indices: parsed.ok };
}
var plan = (args, _loop, ctx) => {
  if (!ctx.setPlanMode) {
    return { info: t("handlers.edits.planCodeOnly") };
  }
  const currentOn = Boolean(ctx.planMode);
  const raw = (args[0] ?? "").toLowerCase();
  let target;
  if (raw === "on" || raw === "true" || raw === "1") target = true;
  else if (raw === "off" || raw === "false" || raw === "0") target = false;
  else target = !currentOn;
  ctx.setPlanMode(target);
  if (target) {
    return { info: t("handlers.edits.planOn") };
  }
  return { info: t("handlers.edits.planOff") };
};
var mode = (args, _loop, ctx) => {
  if (!ctx.setEditMode) {
    return { info: t("handlers.edits.modeCodeOnly") };
  }
  const raw = (args[0] ?? "").toLowerCase();
  const current = ctx.editMode ?? "review";
  let target;
  if (raw === "review") target = "review";
  else if (raw === "auto") target = "auto";
  else if (raw === "yolo") target = "yolo";
  else if (raw === "") {
    target = current === "review" ? "auto" : current === "auto" ? "yolo" : "review";
  } else {
    return { info: t("handlers.edits.modeUsage") };
  }
  ctx.setEditMode(target);
  const banner = target === "yolo" ? t("handlers.edits.modeYolo") : target === "auto" ? t("handlers.edits.modeAuto") : t("handlers.edits.modeReview");
  return { info: banner };
};
var commit = (args, _loop, ctx) => {
  if (!ctx.codeRoot) {
    return { info: t("handlers.edits.commitCodeOnly") };
  }
  const raw = args.join(" ").trim();
  const message = stripOuterQuotes(raw);
  if (!message) {
    return { info: t("handlers.edits.commitUsage", { root: ctx.codeRoot }) };
  }
  return runGitCommit(ctx.codeRoot, message);
};
var walk2 = (_args, _loop, ctx) => {
  if (!ctx.startWalkthrough) {
    return { info: t("handlers.edits.walkCodeOnly") };
  }
  return { info: ctx.startWalkthrough() };
};
var checkpoint = (args, _loop, ctx) => {
  if (!ctx.codeRoot || !ctx.touchedFiles) {
    return { info: t("handlers.edits.checkpointCodeOnly") };
  }
  const sub = (args[0] ?? "").toLowerCase();
  const rest = args.slice(1).join(" ").trim();
  if (sub === "" || sub === "list") {
    const items = [...listCheckpoints(ctx.codeRoot)].reverse();
    if (items.length === 0) {
      return { info: t("handlers.edits.checkpointNone") };
    }
    const lines = [t("handlers.edits.checkpointHeader", { count: items.length }), ""];
    for (const m of items) {
      const sizeKb = (m.bytes / 1024).toFixed(1);
      const tag2 = m.source === "manual" ? "" : ` (${m.source})`;
      lines.push(
        `  ${m.id}  ${fmtAgo(m.createdAt).padEnd(8)}  ${m.name}${tag2}  \xB7  ${m.fileCount} file${m.fileCount === 1 ? "" : "s"}, ${sizeKb} KB`
      );
    }
    lines.push("");
    lines.push(t("handlers.edits.checkpointRestoreHint"));
    return { info: lines.join("\n") };
  }
  if (sub === "forget" || sub === "rm" || sub === "delete") {
    if (!rest) return { info: t("handlers.edits.checkpointForgetUsage") };
    const found = findCheckpoint(ctx.codeRoot, rest);
    if (!found) return { info: t("handlers.edits.checkpointNoMatch", { name: rest }) };
    const ok = deleteCheckpoint(ctx.codeRoot, found.id);
    return {
      info: ok ? t("handlers.edits.checkpointDeleted", { id: found.id, name: found.name }) : t("handlers.edits.checkpointDeleteFailed", { id: found.id })
    };
  }
  const name = args.join(" ").trim();
  if (!name) {
    return { info: t("handlers.edits.checkpointSaveUsage") };
  }
  const paths = ctx.touchedFiles();
  const meta = createCheckpoint({
    rootDir: ctx.codeRoot,
    name,
    paths,
    source: "manual"
  });
  if (paths.length === 0) {
    return {
      info: t("handlers.edits.checkpointSavedEmpty", { name, id: meta.id })
    };
  }
  return {
    info: t("handlers.edits.checkpointSaved", {
      name,
      id: meta.id,
      files: meta.fileCount,
      s: meta.fileCount === 1 ? "" : "s",
      size: (meta.bytes / 1024).toFixed(1)
    })
  };
};
var restore = (args, _loop, ctx) => {
  if (!ctx.codeRoot) {
    return { info: t("handlers.edits.restoreCodeOnly") };
  }
  const target = args.join(" ").trim();
  if (!target) {
    return { openCheckpointPicker: true };
  }
  const found = findCheckpoint(ctx.codeRoot, target);
  if (!found) {
    return { info: t("handlers.edits.restoreNoMatch", { target }) };
  }
  const result = restoreCheckpoint(ctx.codeRoot, found.id);
  const lines = [
    t("handlers.edits.restoreInfo", {
      name: found.name,
      id: found.id,
      when: fmtAgo(found.createdAt)
    })
  ];
  if (result.restored.length > 0) {
    lines.push(
      t("handlers.edits.restoreWrote", {
        count: result.restored.length,
        s: result.restored.length === 1 ? "" : "s"
      })
    );
  }
  if (result.removed.length > 0) {
    lines.push(
      t("handlers.edits.restoreRemoved", {
        count: result.removed.length,
        s: result.removed.length === 1 ? "" : "s"
      })
    );
  }
  if (result.skipped.length > 0) {
    lines.push(
      t("handlers.edits.restoreSkipped", {
        count: result.skipped.length,
        s: result.skipped.length === 1 ? "" : "s"
      })
    );
    for (const s of result.skipped.slice(0, 5)) {
      lines.push(`    ${s.path} \u2014 ${s.reason}`);
    }
    if (result.skipped.length > 5) {
      lines.push(`    \u2026 ${result.skipped.length - 5} more`);
    }
  }
  return { info: lines.join("\n") };
};
var cwd = (args, _loop, ctx) => {
  if (!ctx.switchCwd) {
    return { info: t("handlers.edits.cwdCodeOnly") };
  }
  const target = args.join(" ").trim();
  if (!target) {
    return {
      info: ctx.codeRoot != null ? t("handlers.edits.cwdUsage", { current: ctx.codeRoot }) : t("handlers.edits.cwdUsageNoCurrent")
    };
  }
  const result = ctx.switchCwd(stripOuterQuotes(target));
  return { info: result.info };
};
var handlers4 = {
  undo,
  history,
  show,
  apply,
  discard,
  plan,
  mode,
  commit,
  walk: walk2,
  checkpoint,
  restore,
  cwd
};

// src/cli/ui/slash/handlers/init.ts
import { existsSync as existsSync3 } from "fs";
import * as pathMod from "path";
var INIT_PROMPT = [
  "# Task: Initialize visionox.md",
  "",
  "I want you to generate a visionox.md at the project root that captures",
  "the working knowledge a future Reasonix session needs to be productive",
  "here. This file is auto-pinned into your system prompt every launch,",
  "so its size and accuracy matter.",
  "",
  "## Hard constraints (do NOT relax these)",
  "",
  "- **Length cap: \u2264 80 lines / 3KB total.** Be concise. If you can't fit a",
  "  section, drop it.",
  "- **Only document things you can verify by reading files.** Do NOT",
  "  speculate about architectural intent, future roadmap, or design",
  "  rationale. If it isn't obvious from the code, leave it out.",
  "- **No placeholder text.** No 'TODO: describe X', no 'Add more here'.",
  "  Either state a fact or omit the section.",
  "",
  "## Procedure",
  "",
  "1. Read the top of any existing README* file.",
  "2. Read the manifest (package.json / Cargo.toml / pyproject.toml /",
  "   go.mod / etc.) \u2014 pick whichever exists.",
  "3. `directory_tree` 1-2 levels deep on the project root, skipping",
  "   common build/dependency dirs (node_modules, dist, target, .git,",
  "   venv, __pycache__).",
  "4. Identify: primary language + framework, top-level layout, test",
  "   runner, lint/format setup, build/run/test scripts, any non-obvious",
  "   convention with visible evidence (commit message format, import",
  "   order, naming pattern).",
  "5. Write visionox.md with the sections below, skipping any you can't",
  "   fill from evidence.",
  "",
  "## Sections to use (skip ones with no evidence)",
  "",
  "- **Stack** \u2014 language + framework + 3-5 key deps. One line each.",
  "- **Layout** \u2014 top-level dirs and what lives in each. One line each.",
  "- **Commands** \u2014 verbatim from `scripts` block (or equivalent):",
  "  build / test / lint / typecheck / dev / format. Whatever exists.",
  "- **Conventions** \u2014 only things visible in the code. Examples:",
  "  '*.test.ts colocated with source', 'named exports only',",
  "  'commits use Conventional Commits prefix'. If you can't find any",
  "  CONVENTION evidence, omit the whole section.",
  "- **Watch out for** \u2014 gotchas a new contributor would benefit from",
  "  knowing BEFORE editing. Examples: 'edit_file SEARCH must match",
  "  byte-for-byte', 'this dir is generated, don't edit by hand'.",
  "  Omit if you find nothing concrete.",
  "",
  "## Output",
  "",
  "Write the result to `visionox.md` in the project root using the",
  "filesystem tools (edit_file with empty SEARCH if creating new,",
  "write_file if overwriting). After writing, STOP \u2014 do not summarize",
  "what you did, do not propose follow-up tasks. The user will review",
  "the pending edit via /apply.",
  "",
  "Start now."
].join("\n");
var init = (args, _loop, ctx) => {
  if (!ctx.codeRoot) {
    return { info: t("handlers.init.codeOnly") };
  }
  const force = (args[0] ?? "").toLowerCase() === "force";
  const target = pathMod.join(ctx.codeRoot, "visionox.md");
  if (existsSync3(target) && !force) {
    return {
      info: [
        t("handlers.init.exists", { path: target }),
        "",
        t("handlers.init.existsForce"),
        "",
        t("handlers.init.existsEdit"),
        t("handlers.init.existsPinned")
      ].join("\n")
    };
  }
  return {
    info: t("handlers.init.info"),
    resubmit: INIT_PROMPT
  };
};
var handlers5 = {
  init
};

// src/cli/ui/slash/handlers/jobs.ts
function statusIcon(r) {
  if (r.running) return "\u25CF";
  if (r.spawnError) return "\u2717";
  if (r.exitCode === 0) return "\u2713";
  if (r.exitCode !== null) return "\u2717";
  return "\u25CB";
}
function fmtAge(ms) {
  const s = Math.floor(ms / 1e3);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function detectPorts(output) {
  if (!output) return [];
  const found = /* @__PURE__ */ new Set();
  const patterns = [
    /(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})\b/g,
    /(?:listening|listening on|bound to|port|on port)[\s:=]+(\d{2,5})\b/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(output)) !== null) {
      const port = Number.parseInt(m[1] ?? "", 10);
      if (port >= 80 && port <= 65535) found.add(port);
      if (found.size >= 3) break;
    }
    if (found.size >= 3) break;
  }
  return [...found];
}
function fmtMeta(r) {
  if (r.running) {
    const ports = detectPorts(r.output);
    if (ports.length > 0) return ports.map((p) => `:${p}`).join(" ");
    return r.pid !== null ? `pid ${r.pid}` : "";
  }
  if (r.spawnError) return r.spawnError;
  if (r.exitCode !== null) return `exit ${r.exitCode}`;
  return "stopped";
}
var jobs = (_args, _loop, ctx) => {
  if (!ctx.jobs) {
    return { info: t("handlers.jobs.codeOnly") };
  }
  const rows = ctx.jobs.list();
  if (rows.length === 0) {
    return { info: t("handlers.jobs.empty") };
  }
  const running = rows.filter((r) => r.running).length;
  const lines = [t("handlers.jobs.header", { running, total: rows.length }), ""];
  const cmdWidth = Math.min(44, Math.max(8, ...rows.map((r) => r.command.length)));
  for (const r of rows) {
    const ico = statusIcon(r);
    const id = `#${String(r.id).padEnd(3)}`;
    const cmd = r.command.length > cmdWidth ? `${r.command.slice(0, cmdWidth - 1)}\u2026` : r.command.padEnd(cmdWidth);
    const meta = fmtMeta(r).padEnd(20);
    const age = fmtAge(Date.now() - r.startedAt).padStart(4);
    lines.push(`  ${ico}  ${id}  ${cmd}  ${meta}  ${age}`);
  }
  lines.push("");
  lines.push(t("handlers.jobs.footer"));
  return { info: lines.join("\n") };
};
var kill = (args, _loop, ctx) => {
  if (!ctx.jobs) return { info: t("handlers.jobs.killCodeOnly") };
  const id = Number.parseInt(args[0] ?? "", 10);
  if (!Number.isFinite(id)) return { info: t("handlers.jobs.killUsage") };
  const rec = ctx.jobs.list().find((r) => r.id === id);
  if (!rec) return { info: t("handlers.jobs.killNotFound", { id }) };
  if (!rec.running)
    return { info: t("handlers.jobs.killAlreadyExited", { id, code: rec.exitCode ?? "?" }) };
  const jobsRef = ctx.jobs;
  void (async () => {
    const final = await jobsRef.stop(id);
    if (!final) return;
    const status2 = final.running ? t("handlers.jobs.killStillAlive") : final.exitCode !== null ? `exit ${final.exitCode}` : "stopped";
    ctx.postInfo?.(t("handlers.jobs.killStatus", { id, status: status2 }));
  })();
  return { info: t("handlers.jobs.killStopping", { id }) };
};
var logs = (args, _loop, ctx) => {
  if (!ctx.jobs) return { info: t("handlers.jobs.logsCodeOnly") };
  const id = Number.parseInt(args[0] ?? "", 10);
  if (!Number.isFinite(id)) {
    return { info: t("handlers.jobs.logsUsage") };
  }
  const requested = Number.parseInt(args[1] ?? "", 10);
  const tail = Number.isFinite(requested) && requested > 0 ? requested : 80;
  const out = ctx.jobs.read(id, { tailLines: tail });
  if (!out) return { info: t("handlers.jobs.logsNotFound", { id }) };
  const status2 = out.running ? t("handlers.jobs.logsRunning", { pid: out.pid ?? "?" }) : out.exitCode !== null ? t("handlers.jobs.logsExited", { code: out.exitCode }) : out.spawnError ? t("handlers.jobs.logsFailed", { reason: out.spawnError }) : t("handlers.jobs.logsStopped");
  const header = t("handlers.jobs.logsStatus", { id, status: status2, command: out.command });
  return { info: out.output ? `${header}
${out.output}` : header };
};
var handlers6 = {
  jobs,
  kill,
  logs
};

// src/cli/ui/slash/handlers/language.ts
var handlers7 = {
  language: (args, _loop, ctx) => {
    const lang = args[0];
    if (!lang) {
      return { openArgPickerFor: "language" };
    }
    const supported = getSupportedLanguages();
    if (!supported.includes(lang)) {
      return {
        info: t("slash.language.unsupported", {
          code: lang,
          supported: supported.join(", ")
        })
      };
    }
    setLanguage(lang);
    notifyLanguageChange();
    ctx.dispatch?.({ type: "language.change", lang });
    return { info: t("slash.language.success") };
  }
};

// src/cli/ui/slash/handlers/mcp.ts
var mcp = (args, loop2, ctx) => {
  const servers = ctx.mcpServers ?? [];
  const specs = ctx.mcpSpecs ?? [];
  const toolSpecs = loop2.prefix.toolSpecs ?? [];
  const sub = args[0];
  if (sub === "disable" || sub === "enable") {
    return toggleDisabled(sub, args[1], { servers, specs });
  }
  if (sub === "reconnect") {
    return triggerReconnect(args[1], servers, ctx.postInfo, loop2);
  }
  if (sub === "browse" || sub === "install" || sub === "marketplace") {
    return { openMcpHub: { tab: "marketplace" } };
  }
  const wantsTextDump = sub === "text";
  if (!wantsTextDump) {
    return { openMcpHub: { tab: servers.length > 0 ? "live" : "marketplace" } };
  }
  if (servers.length === 0 && specs.length === 0 && toolSpecs.length === 0) {
    return { info: t("handlers.mcp.noServers") };
  }
  if (servers.length > 0) {
    const lines2 = [];
    let anyResources = false;
    let anyPrompts = false;
    for (const s of servers) {
      const { report } = s;
      const serverName = report.serverInfo.name || "(unknown)";
      const serverVer = report.serverInfo.version ? ` v${report.serverInfo.version}` : "";
      const health = slashHealthBadge(report.elapsedMs);
      lines2.push(`${health}  [${s.label}] ${serverName}${serverVer}  \u2014  ${s.spec}`);
      lines2.push(t("handlers.mcp.toolsLabel", { count: s.toolCount }));
      appendSection(lines2, "resources", report.resources);
      appendSection(lines2, "prompts  ", report.prompts);
      if (report.resources.supported && report.resources.items.length > 0) anyResources = true;
      if (report.prompts.supported && report.prompts.items.length > 0) anyPrompts = true;
      lines2.push("");
    }
    if (anyResources || anyPrompts) {
      const hints = [];
      if (anyResources) hints.push(t("handlers.mcp.resourcesHint"));
      if (anyPrompts) hints.push(t("handlers.mcp.promptsHint"));
      lines2.push(hints.join(" \xB7 "));
    } else {
      lines2.push(t("handlers.mcp.awarenessOnly"));
    }
    lines2.push(t("handlers.mcp.catalogHint"));
    return { info: lines2.join("\n") };
  }
  const lines = [];
  if (specs.length > 0) {
    lines.push(t("handlers.mcp.fallbackServers", { count: specs.length }));
    for (const spec of specs) lines.push(`  \xB7 ${spec}`);
    lines.push("");
  }
  if (toolSpecs.length > 0) {
    lines.push(t("handlers.mcp.fallbackTools", { count: toolSpecs.length }));
    for (const tool of toolSpecs) lines.push(`  \xB7 ${tool.function.name}`);
  }
  lines.push("");
  lines.push(t("handlers.mcp.fallbackChange"));
  return { info: lines.join("\n") };
};
function toggleDisabled(action, rawName, ctx) {
  const name = rawName?.trim();
  if (!name) {
    return { info: t("handlers.mcp.usageDisableEnable", { action }) };
  }
  const known = /* @__PURE__ */ new Set([
    ...ctx.servers.map((s) => s.label),
    ...ctx.specs.map((spec) => parseLabelFromSpec(spec)).filter((n) => n !== null)
  ]);
  if (!known.has(name)) {
    const list2 = [...known].sort().join(", ") || t("handlers.mcp.noneList");
    return { info: t("handlers.mcp.unknownServer", { name, list: list2 }) };
  }
  return { info: toggleMcpDisabled(action, name) };
}
function parseLabelFromSpec(spec) {
  const match = spec.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)=/);
  return match ? match[1] ?? null : null;
}
function triggerReconnect(rawName, servers, postInfo, loop2) {
  const name = rawName?.trim();
  if (!name) {
    return { info: t("handlers.mcp.usageReconnect") };
  }
  const target = servers.find((s) => s.label === name);
  if (!target) {
    const list2 = servers.map((s) => s.label).sort().join(", ") || t("handlers.mcp.noneList");
    return { info: t("handlers.mcp.unknownServer", { name, list: list2 }) };
  }
  if (!postInfo) {
    return { info: t("handlers.mcp.reconnectNoTui") };
  }
  return {
    info: kickOffMcpReconnect(
      target,
      postInfo,
      (t2, addedTools) => applyMcpAppend(loop2, t2, addedTools)
    )
  };
}
var handlers8 = { mcp };

// src/cli/ui/slash/handlers/memory.ts
import { basename } from "path";
function pickTypeFlag(args) {
  const rest = [];
  let type = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (a === "--type" || a === "-t") {
      const next = args[i + 1];
      if (next) {
        type = next;
        i++;
      }
      continue;
    }
    const eq = a.match(/^--type=(.+)$/);
    if (eq) {
      type = eq[1] ?? null;
      continue;
    }
    rest.push(a);
  }
  return { type, rest };
}
var memory = (args, _loop, ctx) => {
  if (!memoryEnabled()) {
    return { info: t("handlers.memory.disabled") };
  }
  if (!ctx.memoryRoot) {
    return { info: t("handlers.memory.noRoot") };
  }
  const store = new MemoryStore({ projectRoot: ctx.codeRoot });
  const { type: typeFilter, rest: filteredArgs } = pickTypeFlag(args);
  const sub = (filteredArgs[0] ?? args[0] ?? "").toLowerCase();
  if (sub === "list" || sub === "ls") {
    const all = store.list();
    const entries = typeFilter ? all.filter((e) => e.type === typeFilter) : all;
    if (entries.length === 0) {
      return {
        info: typeFilter ? `no memories with type='${typeFilter}'. (${all.length} total across all types)` : t("handlers.memory.listEmpty")
      };
    }
    const header = typeFilter ? `\u25B8 memory entries \u2014 type=${typeFilter} (${entries.length}/${all.length})` : t("handlers.memory.listHeader", { count: entries.length });
    const lines = [header];
    for (const e of entries) {
      const prio = effectivePriority(e);
      const marker = prio === "high" ? "\u26A0 " : prio === "low" ? "\xB7 " : "  ";
      const tag2 = `${e.scope}/${e.type}`.padEnd(18);
      const name = e.name.padEnd(28);
      const desc = e.description.length > 70 ? `${e.description.slice(0, 69)}\u2026` : e.description;
      lines.push(`${marker}${tag2}  ${name}  ${desc}`);
    }
    lines.push("");
    lines.push(t("handlers.memory.listFooter"));
    return { info: lines.join("\n") };
  }
  if (sub === "show" || sub === "cat") {
    const target = args[1];
    if (!target) return { info: t("handlers.memory.showUsage") };
    const resolved = resolveMemoryTarget(store, target);
    if (!resolved) return { info: t("handlers.memory.showNotFound", { target }) };
    try {
      const entry = store.read(resolved.scope, resolved.name);
      return {
        info: [
          `\u25B8 ${entry.scope}/${entry.name}  (${entry.type}, created ${entry.createdAt || "?"})`,
          entry.description ? `  ${entry.description}` : "",
          "",
          entry.body
        ].filter((l) => l !== "").concat("").join("\n")
      };
    } catch (err) {
      return { info: t("handlers.memory.showFailed", { reason: err.message }) };
    }
  }
  if (sub === "forget" || sub === "rm" || sub === "delete") {
    const target = args[1];
    if (!target) return { info: t("handlers.memory.forgetUsage") };
    const resolved = resolveMemoryTarget(store, target);
    if (!resolved) return { info: t("handlers.memory.forgetNotFound", { target }) };
    try {
      const ok = store.delete(resolved.scope, resolved.name);
      return {
        info: ok ? t("handlers.memory.forgetInfo", { scope: resolved.scope, name: resolved.name }) : t("handlers.memory.forgetFailed", { scope: resolved.scope, name: resolved.name })
      };
    } catch (err) {
      return { info: t("handlers.memory.forgetError", { reason: err.message }) };
    }
  }
  if (sub === "clear") {
    const rawScope = (args[1] ?? "").toLowerCase();
    if (rawScope !== "global" && rawScope !== "project") {
      return { info: t("handlers.memory.clearUsage") };
    }
    if ((args[2] ?? "").toLowerCase() !== "confirm") {
      return {
        info: t("handlers.memory.clearConfirm", { scope: rawScope })
      };
    }
    const scope = rawScope;
    const all = store.list();
    const inScope = all.filter((e) => e.scope === scope);
    const expiring = scope === "project" ? all.filter((e) => e.scope === "global" && e.expires === "project_end") : [];
    let deleted = 0;
    for (const e of inScope) {
      try {
        if (store.delete(scope, e.name)) deleted++;
      } catch {
      }
    }
    for (const e of expiring) {
      try {
        if (store.delete("global", e.name)) deleted++;
      } catch {
      }
    }
    const extra = expiring.length > 0 ? ` (+${expiring.length} global expires=project_end)` : "";
    return { info: `${t("handlers.memory.cleared", { scope, count: deleted })}${extra}` };
  }
  const parts = [];
  const projMem = readProjectMemory(ctx.memoryRoot);
  if (projMem) {
    const label = basename(projMem.path);
    const hdr = projMem.truncated ? `\u25B8 ${label}: ${projMem.path} (${projMem.originalChars.toLocaleString()} chars, truncated)` : `\u25B8 ${label}: ${projMem.path} (${projMem.originalChars.toLocaleString()} chars)`;
    parts.push(hdr, "", projMem.content);
  }
  const globalIdx = store.loadIndex("global");
  if (globalIdx) {
    parts.push(
      "",
      `\u25B8 global memory (${globalIdx.originalChars.toLocaleString()} chars${globalIdx.truncated ? ", truncated" : ""})`,
      "",
      globalIdx.content
    );
  }
  const projectIdx = store.loadIndex("project");
  if (projectIdx) {
    parts.push(
      "",
      `\u25B8 project memory (${projectIdx.originalChars.toLocaleString()} chars${projectIdx.truncated ? ", truncated" : ""})`,
      "",
      projectIdx.content
    );
  }
  if (parts.length === 0) {
    return {
      info: [
        t("handlers.memory.noMemory", { root: ctx.memoryRoot }),
        "",
        t("handlers.memory.layers"),
        t("handlers.memory.layerProject", { file: PROJECT_MEMORY_FILE }),
        t("handlers.memory.layerGlobal"),
        t("handlers.memory.layerProjectHash"),
        "",
        t("handlers.memory.askModel"),
        t("handlers.memory.changesNote"),
        "",
        t("handlers.memory.subcommands")
      ].join("\n")
    };
  }
  parts.push("", t("handlers.memory.changesNoteShort"));
  return { info: parts.join("\n") };
};
var handlers9 = { memory };

// src/cli/ui/slash/handlers/model.ts
function inferPresetFromModel(id) {
  if (id === "deepseek-v4-pro") return "pro";
  if (id === "deepseek-v4-flash") return "flash";
  return null;
}
var model = (args, loop2, ctx) => {
  const id = args[0];
  const known = ctx.models ?? null;
  if (!id) {
    return { openModelPicker: true };
  }
  loop2.configure({ model: id, autoEscalate: false });
  ctx.dispatch?.({ type: "session.model.change", model: id });
  const inferred = inferPresetFromModel(id);
  ctx.dispatch?.({ type: "session.preset.change", preset: inferred });
  if (inferred) {
    try {
      savePreset(inferred);
    } catch {
    }
  }
  if (known && known.length > 0 && !known.includes(id)) {
    return {
      info: t("handlers.model.modelNotInCatalog", { id, list: known.join(", ") })
    };
  }
  return { info: t("handlers.model.modelSet", { id }) };
};
var preset = (args, loop2, ctx) => {
  const name = (args[0] ?? "").toLowerCase();
  const apply2 = (presetName, p) => {
    loop2.configure({
      model: p.model,
      autoEscalate: p.autoEscalate,
      reasoningEffort: p.reasoningEffort
    });
    ctx.dispatch?.({ type: "session.model.change", model: p.model });
    ctx.dispatch?.({ type: "session.preset.change", preset: presetName });
    try {
      savePreset(presetName);
    } catch {
    }
  };
  if (name === "auto") {
    apply2("auto", PRESETS.auto);
    return { info: t("handlers.model.presetAuto") };
  }
  if (name === "flash") {
    apply2("flash", PRESETS.flash);
    return { info: t("handlers.model.presetFlash") };
  }
  if (name === "pro") {
    apply2("pro", PRESETS.pro);
    return { info: t("handlers.model.presetPro") };
  }
  if (name === "") {
    return { openModelPicker: true };
  }
  return { info: t("handlers.model.presetUsage") };
};
var ESCALATION_MODEL_ID = "deepseek-v4-pro";
var pro = (args, loop2, ctx) => {
  const arg = (args[0] ?? "").toLowerCase();
  if (arg === "off" || arg === "cancel" || arg === "disarm") {
    if (!loop2.proArmed) {
      return { info: t("handlers.model.proNothingArmed") };
    }
    if (ctx.disarmPro) ctx.disarmPro();
    else loop2.disarmPro();
    return { info: t("handlers.model.proDisarmed") };
  }
  if (arg && arg !== "on" && arg !== "arm") {
    return { info: t("handlers.model.proUsage") };
  }
  if (ctx.armPro) ctx.armPro();
  else loop2.armProForNextTurn();
  return {
    info: t("handlers.model.proArmed", { model: ESCALATION_MODEL_ID })
  };
};
var budget = (args, loop2) => {
  const arg = args[0]?.trim() ?? "";
  if (arg === "") {
    if (loop2.budgetUsd === null) {
      return { info: t("handlers.model.budgetNoCap") };
    }
    const spent2 = loop2.stats.totalCost;
    const pct = spent2 / loop2.budgetUsd * 100;
    return {
      info: t("handlers.model.budgetStatus", {
        spent: spent2.toFixed(4),
        cap: loop2.budgetUsd.toFixed(2),
        pct: pct.toFixed(1)
      })
    };
  }
  if (arg === "off" || arg === "none" || arg === "0") {
    loop2.setBudget(null);
    return { info: t("handlers.model.budgetOff") };
  }
  const cleaned = arg.replace(/^\$/, "");
  const usd = Number(cleaned);
  if (!Number.isFinite(usd) || usd <= 0) {
    return { info: t("handlers.model.budgetUsage", { arg }) };
  }
  loop2.setBudget(usd);
  const spent = loop2.stats.totalCost;
  if (spent >= usd) {
    return {
      info: t("handlers.model.budgetExhausted", {
        cap: usd.toFixed(2),
        spent: spent.toFixed(4)
      })
    };
  }
  return {
    info: t("handlers.model.budgetSet", {
      cap: usd.toFixed(2),
      spent: spent.toFixed(4)
    })
  };
};
var handlers10 = {
  model,
  preset,
  pro,
  budget
};

// src/cli/ui/slash/handlers/observability.ts
import { release } from "os";

// src/cli/ui/ctx-breakdown.tsx
import { Box as Box53, Text as Text56 } from "ink";
import React65 from "react";
function computeCtxBreakdown(loop2) {
  const systemTokens = countTokens(loop2.prefix.system);
  const toolsTokens = countTokens(JSON.stringify(loop2.prefix.toolSpecs));
  const entries = loop2.log.toMessages();
  let userTokens = 0;
  let assistantTokens = 0;
  let toolResultTokens = 0;
  let toolCallTokens = 0;
  const toolBreakdown = [];
  let logTurn = 0;
  for (const e of entries) {
    const content = typeof e.content === "string" ? e.content : "";
    if (e.role === "user") {
      userTokens += countTokens(content);
      logTurn += 1;
    } else if (e.role === "assistant") {
      assistantTokens += countTokens(content);
      if (Array.isArray(e.tool_calls) && e.tool_calls.length > 0) {
        toolCallTokens += countTokens(JSON.stringify(e.tool_calls));
      }
    } else if (e.role === "tool") {
      const n = countTokens(content);
      toolResultTokens += n;
      toolBreakdown.push({ name: e.name ?? "?", tokens: n, turn: logTurn });
    }
  }
  const logTokens = userTokens + assistantTokens + toolResultTokens + toolCallTokens;
  const ctxMax = DEEPSEEK_CONTEXT_TOKENS[loop2.model] ?? DEFAULT_CONTEXT_TOKENS;
  const topTools = [...toolBreakdown].sort((a, b) => b.tokens - a.tokens).slice(0, 5);
  return {
    systemTokens,
    toolsTokens,
    logTokens,
    inputTokens: 0,
    ctxMax,
    toolsCount: loop2.prefix.toolSpecs.length,
    logMessages: entries.length,
    topTools
  };
}

// src/cli/ui/feedback.ts
var FEEDBACK_ISSUE_BASE = "https://github.com/esengine/DeepSeek-Reasonix/issues/new";
var FEEDBACK_BODY_QUERY_LIMIT = 6e3;
function buildFeedbackIssueUrl(diagnostic) {
  const trimmed = diagnostic.length > FEEDBACK_BODY_QUERY_LIMIT ? diagnostic.slice(0, FEEDBACK_BODY_QUERY_LIMIT) : diagnostic;
  return `${FEEDBACK_ISSUE_BASE}?body=${encodeURIComponent(trimmed)}`;
}
function buildFeedbackDiagnostic(input) {
  const lines = [];
  lines.push(`**Reasonix**: ${formatVersion(input.version, input.latestVersion)}`);
  lines.push(`**Platform**: ${input.platform} (${input.osRelease})`);
  lines.push(`**Terminal**: ${formatTerminal(input)}`);
  if (typeof input.cols === "number" && typeof input.rows === "number") {
    lines.push(`**Size**: ${input.cols}\xD7${input.rows}`);
  }
  lines.push(`**Node**: ${input.nodeVersion}`);
  lines.push(`**Locale**: ${input.locale}`);
  if (input.theme) lines.push(`**Theme**: ${input.theme}`);
  lines.push(`**Model**: ${formatModel(input.model, input.reasoningEffort)}`);
  const modeLine = formatMode(input.editMode, input.planMode);
  if (modeLine) lines.push(`**Mode**: ${modeLine}`);
  if (typeof input.mcpServerCount === "number") {
    lines.push(`**MCP**: ${input.mcpServerCount} server(s)`);
  }
  if (input.sessionId) lines.push(`**Session**: ${input.sessionId}`);
  lines.push("", "<!-- describe what you were doing when this happened -->", "");
  return lines.join("\n");
}
function formatVersion(installed, latest) {
  if (!latest) return installed;
  const cmp = compareVersions(installed, latest);
  if (cmp === 0) return `${installed} (latest)`;
  if (cmp > 0) return installed;
  return `${installed} (latest: ${latest})`;
}
function formatModel(model2, effort) {
  return effort ? `${model2} \xB7 effort=${effort}` : model2;
}
function formatMode(editMode, planMode) {
  const parts = [];
  if (editMode) parts.push(`edit=${editMode}`);
  parts.push(`plan=${planMode ? "on" : "off"}`);
  return parts.join(" \xB7 ");
}
function formatTerminal(input) {
  const head = input.termProgram ?? "(unknown)";
  const env = [];
  if (input.termProgram) env.push(`TERM_PROGRAM=${input.termProgram}`);
  if (input.term) env.push(`TERM=${input.term}`);
  if (input.colorTerm) env.push(`COLORTERM=${input.colorTerm}`);
  if (input.inWindowsTerminal) env.push("WT_SESSION=set");
  if (input.inTmux) env.push("TMUX=set");
  if (input.inSsh) env.push("SSH_TTY=set");
  if (input.wslDistro) env.push(`WSL=${input.wslDistro}`);
  if (env.length === 0) return head;
  return `${head} (${env.join(", ")})`;
}

// src/cli/ui/open-url.ts
import { spawn as spawn2 } from "child_process";
import { platform } from "os";
function openUrl(url) {
  if (process.env.CI) return { opened: false, reason: "ci" };
  if (process.env.REASONIX_NO_OPEN) return { opened: false, reason: "disabled" };
  const os = platform();
  let cmd;
  let args;
  if (os === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else if (os === "darwin") {
    cmd = "open";
    args = [url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  try {
    const child = spawn2(cmd, args, { detached: true, stdio: "ignore" });
    child.unref();
    return { opened: true };
  } catch {
    return { opened: false, reason: "spawn-failed" };
  }
}

// src/cli/ui/slash/handlers/observability.ts
var context = (_args, loop2) => {
  const breakdown = computeCtxBreakdown(loop2);
  const total = breakdown.systemTokens + breakdown.toolsTokens + breakdown.logTokens + breakdown.inputTokens;
  const winPct = breakdown.ctxMax > 0 ? Math.round(total / breakdown.ctxMax * 100) : 0;
  const fallbackInfo = t("handlers.observability.contextInfo", {
    total: compactNum2(total),
    max: compactNum2(breakdown.ctxMax),
    pct: winPct,
    sys: compactNum2(breakdown.systemTokens),
    tools: compactNum2(breakdown.toolsTokens),
    log: compactNum2(breakdown.logTokens)
  });
  return { info: fallbackInfo, ctxBreakdown: breakdown };
};
var status = (_args, loop2, ctx) => {
  const ctxMax = DEEPSEEK_CONTEXT_TOKENS[loop2.model] ?? DEFAULT_CONTEXT_TOKENS;
  const summary = loop2.stats.summary();
  const lastPromptTokens = summary.lastPromptTokens;
  const ctxPct = ctxMax > 0 ? Math.round(lastPromptTokens / ctxMax * 100) : 0;
  const ctxBar = lastPromptTokens > 0 ? renderTinyBar(ctxPct, 16) : "";
  const ctxLine = lastPromptTokens > 0 ? t("handlers.observability.statusCtx", {
    bar: ctxBar,
    used: compactNum2(lastPromptTokens),
    max: compactNum2(ctxMax),
    pct: ctxPct
  }) : t("handlers.observability.statusCtxNone");
  const cost2 = summary.totalCostUsd;
  const cacheLine = summary.turns > 3 ? (() => {
    const cachePct = summary.cacheHitRatio * 100;
    return t("handlers.observability.statusCost", {
      cost: cost2.toFixed(4),
      bar: renderTinyBar(cachePct, 12),
      pct: cachePct.toFixed(1),
      turns: summary.turns
    });
  })() : t("handlers.observability.statusCostCold", {
    cost: cost2.toFixed(4),
    turns: summary.turns
  });
  const budgetLine = typeof loop2.budgetUsd === "number" ? (() => {
    const pct = Math.round(cost2 / loop2.budgetUsd * 100);
    const tag2 = pct >= 100 ? " \u25B2 EXHAUSTED" : pct >= 80 ? " \u25B2 80%+" : "";
    return t("handlers.observability.statusBudget", {
      spent: cost2.toFixed(4),
      cap: loop2.budgetUsd.toFixed(2),
      pct,
      tag: tag2
    });
  })() : "";
  const pending = ctx.pendingEditCount ?? 0;
  const sessionLine = loop2.sessionName ? t("handlers.observability.statusSession", {
    name: loop2.sessionName,
    count: loop2.log.length,
    resumed: loop2.resumedMessageCount
  }) : t("handlers.observability.statusSessionEphemeral");
  const mcpCount = ctx.mcpSpecs?.length ?? 0;
  const toolCount = loop2.prefix.toolSpecs.length;
  const mcpLine = t("handlers.observability.statusMcp", { servers: mcpCount, tools: toolCount });
  const pendingLine = pending > 0 ? t("handlers.observability.statusEdits", { count: pending }) : "";
  const planLine = ctx.planMode ? t("handlers.observability.statusPlan") : "";
  const modeLine = ctx.editMode === "yolo" ? t("handlers.observability.statusModeYolo") : ctx.editMode === "auto" ? t("handlers.observability.statusModeAuto") : ctx.editMode === "review" ? t("handlers.observability.statusModeReview") : "";
  const dashUrl = ctx.getDashboardUrl?.();
  const dashLine = dashUrl ? t("handlers.observability.statusDash", { url: dashUrl }) : "";
  const workspaceLine = ctx.codeRoot ? t("handlers.observability.statusWorkspace", { path: ctx.codeRoot }) : "";
  const lines = [
    t("handlers.observability.statusModel", { model: loop2.model }),
    t("handlers.observability.statusFlags", {
      stream: loop2.stream ? "on" : "off",
      effort: loop2.reasoningEffort
    }),
    cacheLine,
    ctxLine,
    mcpLine,
    sessionLine
  ];
  if (workspaceLine) lines.push(workspaceLine);
  if (budgetLine) lines.push(budgetLine);
  if (pendingLine) lines.push(pendingLine);
  if (planLine) lines.push(planLine);
  if (modeLine) lines.push(modeLine);
  if (dashLine) lines.push(dashLine);
  return { info: lines.join("\n") };
};
function renderTinyBar(pct, width) {
  const w = Math.max(4, width);
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round(w * clamped / 100);
  return `[${"\u2588".repeat(filled)}${"\u2591".repeat(w - filled)}]`;
}
var compact = (_args, loop2, ctx) => {
  void loop2.compactHistory().then((r) => {
    if (!r.folded) {
      ctx.postInfo?.(t("handlers.observability.compactNoop"));
      return;
    }
    ctx.postInfo?.(
      t("handlers.observability.compactDone", {
        before: r.beforeMessages,
        after: r.afterMessages,
        chars: r.summaryChars.toLocaleString()
      })
    );
  }).catch((err) => {
    ctx.postInfo?.(t("handlers.observability.compactFailed", { reason: err.message }));
  });
  return { info: t("handlers.observability.compactStarting") };
};
var cost = (args, loop2, ctx) => {
  if (args.length > 0) {
    return estimateCost(args.join(" "), loop2);
  }
  const turn = loop2.stats.turns[loop2.stats.turns.length - 1];
  if (!turn) {
    return { info: t("handlers.observability.costNoTurn") };
  }
  if (!ctx.postUsage) {
    return { info: t("handlers.observability.costNeedsTui") };
  }
  const summary = loop2.stats.summary();
  const ctxMax = DEEPSEEK_CONTEXT_TOKENS[loop2.model] ?? DEFAULT_CONTEXT_TOKENS;
  ctx.postUsage({
    turn: turn.turn,
    promptTokens: turn.usage.promptTokens,
    reasonTokens: 0,
    outputTokens: turn.usage.completionTokens,
    promptCap: ctxMax,
    cacheHit: turn.cacheHitRatio,
    cost: turn.cost,
    sessionCost: summary.totalCostUsd
  });
  return {};
};
function estimateCost(userText, loop2) {
  const pricing = DEEPSEEK_PRICING[loop2.model];
  if (!pricing) {
    return { info: t("handlers.observability.costNoPricing", { model: loop2.model }) };
  }
  const userTokens = countTokens(userText);
  const breakdown = computeCtxBreakdown(loop2);
  const promptTokens = breakdown.systemTokens + breakdown.toolsTokens + breakdown.logTokens + userTokens;
  const turns = loop2.stats.turns;
  const avgOutput = turns.length > 0 ? Math.round(turns.reduce((s, tk) => s + tk.usage.completionTokens, 0) / turns.length) : 800;
  const cacheHit = loop2.stats.summary().cacheHitRatio;
  const inputUsdMiss = promptTokens * pricing.inputCacheMiss / 1e6;
  const inputUsdLikely = promptTokens * ((1 - cacheHit) * pricing.inputCacheMiss + cacheHit * pricing.inputCacheHit) / 1e6;
  const outputUsd = avgOutput * pricing.output / 1e6;
  const fmt = (n) => `$${n < 0.01 ? n.toFixed(5) : n.toFixed(4)}`;
  const lines = [
    t("handlers.observability.costEstimate", {
      model: loop2.model,
      prompt: promptTokens.toLocaleString(),
      sys: compactNum2(breakdown.systemTokens),
      tools: compactNum2(breakdown.toolsTokens),
      log: compactNum2(breakdown.logTokens),
      msg: compactNum2(userTokens)
    }),
    t("handlers.observability.costWorstCase", {
      input: fmt(inputUsdMiss),
      output: fmt(outputUsd),
      avg: avgOutput.toLocaleString(),
      total: fmt(inputUsdMiss + outputUsd)
    }),
    turns.length > 0 ? t("handlers.observability.costLikely", {
      pct: Math.round(cacheHit * 100),
      input: fmt(inputUsdLikely),
      output: fmt(outputUsd),
      total: fmt(inputUsdLikely + outputUsd)
    }) : t("handlers.observability.costLikelyCold")
  ];
  return { info: lines.join("\n") };
}
var feedback = (_args, loop2, ctx) => {
  const themeName = resolveThemePreference(loadTheme(), process.env.REASONIX_THEME);
  const diagnostic = buildFeedbackDiagnostic({
    version: VERSION,
    latestVersion: ctx.latestVersion ?? void 0,
    platform: process.platform,
    osRelease: release(),
    termProgram: process.env.TERM_PROGRAM,
    term: process.env.TERM,
    colorTerm: process.env.COLORTERM,
    inWindowsTerminal: !!process.env.WT_SESSION,
    inTmux: !!process.env.TMUX,
    inSsh: !!process.env.SSH_TTY,
    wslDistro: process.env.WSL_DISTRO_NAME,
    cols: process.stdout.columns,
    rows: process.stdout.rows,
    nodeVersion: process.version,
    locale: getLanguage(),
    theme: themeName,
    model: loop2.model,
    reasoningEffort: loop2.reasoningEffort,
    editMode: ctx.editMode,
    planMode: ctx.planMode,
    mcpServerCount: ctx.mcpServers?.length ?? ctx.mcpSpecs?.length,
    sessionId: ctx.sessionId
  });
  writeClipboard(diagnostic);
  const url = buildFeedbackIssueUrl(diagnostic);
  const opened = openUrl(url);
  const lines = [
    opened.opened ? "\u25B8 issue page opened with the diagnostic block pre-filled. Just describe what you were doing and submit." : `\u25B8 couldn't open the browser (${opened.reason ?? "unknown"}). Diagnostic info is on your clipboard; open this URL manually: ${url}`,
    "",
    diagnostic
  ];
  return { info: lines.join("\n") };
};
var handlers11 = {
  context,
  status,
  compact,
  cost,
  feedback
};

// src/cli/ui/slash/handlers/permissions.ts
var permissions = (args, _loop, ctx) => {
  const sub = (args[0] ?? "").toLowerCase();
  const root = ctx.codeRoot;
  const mode2 = ctx.editMode ?? null;
  if (sub === "" || sub === "list" || sub === "ls") {
    return { info: renderListing(root, mode2) };
  }
  if (!root) {
    return { info: t("handlers.permissions.mutateCodeOnly") };
  }
  if (sub === "add") {
    const prefix = args.slice(1).join(" ").trim();
    if (!prefix) {
      return { info: t("handlers.permissions.addUsage") };
    }
    const before = loadProjectShellAllowed(root);
    if (before.includes(prefix)) {
      return { info: t("handlers.permissions.addAlready", { prefix }) };
    }
    if (BUILTIN_ALLOWLIST.includes(prefix)) {
      return { info: t("handlers.permissions.addBuiltin", { prefix }) };
    }
    addProjectShellAllowed(root, prefix);
    return { info: t("handlers.permissions.addInfo", { prefix }) };
  }
  if (sub === "remove" || sub === "rm" || sub === "delete") {
    const target = args.slice(1).join(" ").trim();
    if (!target) {
      return { info: t("handlers.permissions.removeUsage") };
    }
    const existing = loadProjectShellAllowed(root);
    let prefix = null;
    if (/^\d+$/.test(target)) {
      const idx = Number.parseInt(target, 10);
      if (idx < 1 || idx > existing.length) {
        return {
          info: existing.length === 0 ? t("handlers.permissions.removeEmpty") : t("handlers.permissions.removeIndexOob", { idx, count: existing.length })
        };
      }
      prefix = existing[idx - 1] ?? null;
    } else {
      prefix = target;
    }
    if (prefix === null) return { info: t("handlers.permissions.removeNothing") };
    if (BUILTIN_ALLOWLIST.includes(prefix) && !existing.includes(prefix)) {
      return { info: t("handlers.permissions.removeBuiltin", { prefix }) };
    }
    const ok = removeProjectShellAllowed(root, prefix);
    return {
      info: ok ? t("handlers.permissions.removeInfo", { prefix }) : t("handlers.permissions.removeNotFound", { prefix })
    };
  }
  if (sub === "clear") {
    if ((args[1] ?? "").toLowerCase() !== "confirm") {
      const count = loadProjectShellAllowed(root).length;
      return {
        info: count === 0 ? t("handlers.permissions.clearAlready") : t("handlers.permissions.clearConfirm", {
          count,
          plural: count === 1 ? "y" : "ies",
          root
        })
      };
    }
    const dropped = clearProjectShellAllowed(root);
    return {
      info: dropped === 0 ? t("handlers.permissions.clearedNone") : t("handlers.permissions.cleared", {
        count: dropped,
        plural: dropped === 1 ? "y" : "ies"
      })
    };
  }
  return { info: t("handlers.permissions.usage") };
};
function renderListing(root, mode2) {
  const lines = [];
  if (mode2 === "yolo") {
    lines.push(t("handlers.permissions.modeYolo"));
  } else if (mode2 === "auto") {
    lines.push(t("handlers.permissions.modeAuto"));
  } else if (mode2 === "review") {
    lines.push(t("handlers.permissions.modeReview"));
  }
  lines.push("");
  if (root) {
    const project = loadProjectShellAllowed(root);
    lines.push(t("handlers.permissions.projectHeader", { count: project.length, root }));
    if (project.length === 0) {
      lines.push(t("handlers.permissions.projectNone1"));
      lines.push(t("handlers.permissions.projectNone2"));
    } else {
      project.forEach((p, i) => {
        lines.push(`  ${String(i + 1).padStart(2)}. ${p}`);
      });
    }
  } else {
    lines.push(t("handlers.permissions.projectNoRoot"));
  }
  lines.push("");
  lines.push(t("handlers.permissions.builtinHeader", { count: BUILTIN_ALLOWLIST.length }));
  const grouped = /* @__PURE__ */ new Map();
  for (const entry of BUILTIN_ALLOWLIST) {
    const head = entry.split(" ")[0] ?? entry;
    if (!grouped.has(head)) grouped.set(head, []);
    grouped.get(head).push(entry);
  }
  for (const [head, items] of grouped) {
    if (items.length === 1 && items[0] === head) {
      lines.push(`  \xB7 ${head}`);
    } else {
      const tail = items.map((i) => i.slice(head.length).trim() || "(bare)").join(", ");
      lines.push(`  \xB7 ${head}: ${tail}`);
    }
  }
  lines.push("");
  lines.push(t("handlers.permissions.subcommands"));
  return lines.join("\n");
}
var handlers12 = {
  permissions,
  perms: permissions
};

// src/cli/ui/slash/handlers/plans.ts
import { basename as basename2 } from "path";
var plans = (args, loop2, ctx) => {
  const sessionName = loop2.sessionName;
  if (!sessionName) {
    return { info: t("handlers.plans.noSession") };
  }
  const sub = (args[0] ?? "").toLowerCase();
  if (sub === "done") {
    return handleDone(args.slice(1), ctx);
  }
  const lines = [];
  const active = loadPlanState(sessionName);
  if (active && active.steps.length > 0) {
    const total = active.steps.length;
    const done = active.completedStepIds.length;
    const when = relativeTime(active.updatedAt);
    const label = active.summary ? `: ${active.summary}` : "";
    lines.push(
      t("handlers.plans.activePlan", {
        label,
        done,
        total,
        s: total === 1 ? "" : "s",
        when
      })
    );
  } else {
    lines.push(t("handlers.plans.activeNone"));
  }
  const archives = listPlanArchives(sessionName);
  if (archives.length === 0) {
    lines.push("");
    lines.push(t("handlers.plans.noArchives"));
    return { info: lines.join("\n") };
  }
  lines.push("");
  lines.push(t("handlers.plans.archivedHeader", { count: archives.length }));
  for (const a of archives) {
    const when = relativeTime(a.completedAt);
    const total = a.steps.length;
    const done = a.completedStepIds.length;
    const completion = done >= total ? t("handlers.plans.completionComplete") : `${done}/${total}`;
    const label = a.summary ?? a.path.split(/[\\/]/).pop() ?? a.path;
    lines.push(
      t("handlers.plans.archivedRow", {
        when: when.padEnd(10),
        total,
        s: total === 1 ? "" : "s",
        completion,
        label
      })
    );
  }
  return { info: lines.join("\n") };
};
var replay = (args, loop2) => {
  const sessionName = loop2.sessionName;
  if (!sessionName) {
    return { info: t("handlers.plans.replayNoSession") };
  }
  const archives = listPlanArchives(sessionName);
  if (archives.length === 0) {
    return { info: t("handlers.plans.replayNoArchives") };
  }
  const arg = args[0]?.trim() ?? "";
  const index = arg ? Number.parseInt(arg, 10) : 1;
  if (!Number.isFinite(index) || index < 1 || index > archives.length) {
    return {
      info: t("handlers.plans.replayInvalidIndex", { max: archives.length })
    };
  }
  const a = archives[index - 1];
  return {
    replayPlan: {
      summary: a.summary,
      body: a.body,
      steps: a.steps,
      completedStepIds: a.completedStepIds,
      completedAt: a.completedAt,
      relativeTime: relativeTime(a.completedAt),
      archiveBasename: basename2(a.path),
      index,
      total: archives.length
    }
  };
};
var stop = (_args, loop2) => {
  loop2.abort();
  return { info: t("handlers.plans.stopAborted") };
};
function handleDone(rest, ctx) {
  const target = (rest[0] ?? "").trim();
  if (!target) {
    return { info: t("handlers.plans.doneUsage") };
  }
  if (target.toLowerCase() === "all") {
    const fn2 = ctx.markAllPlanStepsDone;
    if (!fn2) return { info: t("handlers.plans.doneUnavailable") };
    const added = fn2();
    if (added === 0) return { info: t("handlers.plans.doneAllNoop") };
    return { info: t("handlers.plans.doneAllOk", { count: added }) };
  }
  const fn = ctx.markPlanStepDone;
  if (!fn) return { info: t("handlers.plans.doneUnavailable") };
  const outcome = fn(target);
  switch (outcome) {
    case "ok":
      return { info: t("handlers.plans.doneOk", { id: target }) };
    case "already-done":
      return { info: t("handlers.plans.doneAlready", { id: target }) };
    case "not-in-plan":
      return { info: t("handlers.plans.doneNotInPlan", { id: target }) };
    case "no-plan":
      return { info: t("handlers.plans.doneNoPlan") };
  }
}
var handlers13 = {
  plans,
  replay,
  stop
};

// src/cli/ui/slash/handlers/sessions.ts
var sessions = () => ({ openSessionsPicker: true });
var handlers14 = {
  sessions
};

// src/cli/ui/slash/handlers/skill.ts
var skill = (args, _loop, ctx) => {
  const store = new SkillStore({ projectRoot: ctx.codeRoot });
  const sub = (args[0] ?? "").toLowerCase();
  if (sub === "new" || sub === "init") {
    const name2 = args[1];
    if (!name2) return { info: t("handlers.skill.newUsage") };
    const wantsGlobal = args.slice(2).includes("--global") || !ctx.codeRoot;
    const result = store.create(name2, wantsGlobal ? "global" : "project");
    if ("error" in result) {
      return { info: t("handlers.skill.newError", { reason: result.error }) };
    }
    return { info: t("handlers.skill.newCreated", { name: name2, path: result.path }) };
  }
  if (sub === "" || sub === "list" || sub === "ls") {
    const skills = store.list();
    if (skills.length === 0) {
      const lines2 = [t("handlers.skill.listEmpty")];
      if (store.hasProjectScope()) {
        lines2.push(t("handlers.skill.listProjectScope"));
      }
      lines2.push(t("handlers.skill.listGlobalScope"));
      if (!store.hasProjectScope()) {
        lines2.push(t("handlers.skill.listProjectOnly"));
      }
      lines2.push(
        "",
        t("handlers.skill.listFrontmatter"),
        t("handlers.skill.listInvoke"),
        "",
        t("handlers.skill.listEmptyNewHint")
      );
      return { info: lines2.join("\n") };
    }
    const lines = [t("handlers.skill.listHeader", { count: skills.length })];
    for (const s of skills) {
      const scope = `(${s.scope})`.padEnd(11);
      const name2 = s.name.padEnd(24);
      const desc = s.description.length > 70 ? `${s.description.slice(0, 69)}\u2026` : s.description;
      lines.push(`  ${scope} ${name2}  ${desc}`);
    }
    lines.push("");
    lines.push(t("handlers.skill.listFooter"));
    return { info: lines.join("\n") };
  }
  if (sub === "show" || sub === "cat") {
    const target = args[1];
    if (!target) return { info: t("handlers.skill.showUsage") };
    const found2 = store.read(target);
    if (!found2) return { info: t("handlers.skill.showNotFound", { name: target }) };
    return {
      info: [
        `\u25B8 ${found2.name}  (${found2.scope})`,
        found2.description ? `  ${found2.description}` : "",
        `  ${found2.path}`,
        "",
        found2.body
      ].filter((l) => l !== "").join("\n")
    };
  }
  const name = args[0] ?? "";
  const found = store.read(name);
  if (!found) {
    return { info: t("handlers.skill.runNotFound", { name }) };
  }
  const extra = args.slice(1).join(" ").trim();
  const header = `# Skill: ${found.name}${found.description ? `
> ${found.description}` : ""}`;
  const argsLine = extra ? `

Arguments: ${extra}` : "";
  const payload = `${header}

${found.body}${argsLine}`;
  return {
    info: t("handlers.skill.runInfo", {
      name: found.name,
      args: extra ? ` \u2014 ${extra}` : ""
    }),
    resubmit: payload
  };
};
var handlers15 = {
  skill,
  skills: skill
};

// src/cli/ui/slash/handlers/theme.ts
var themeChoices = ["auto", ...listThemeNames()];
function isThemeChoice(value) {
  return value === "auto" || isThemeName(value);
}
var theme = (args) => {
  const next = args[0];
  if (!next) return { openThemePicker: true };
  if (!isThemeChoice(next)) {
    return { info: `unknown theme: ${next}
available: ${themeChoices.join(", ")}` };
  }
  saveTheme(next);
  const active = resolveThemePreference(next, process.env.REASONIX_THEME);
  return { info: `theme saved: ${next}
active on next launch: ${active}` };
};
var handlers16 = {
  theme
};

// src/cli/ui/slash/handlers/web-search-engine.ts
var handlers17 = {
  "search-engine": (args, _loop, ctx) => {
    const engine = args[0];
    if (!engine || engine !== "mojeek" && engine !== "searxng") {
      return {
        info: [
          t("handlers.webSearchEngine.currentEngine", { engine: webSearchEngine() }),
          t("handlers.webSearchEngine.endpoint", { url: webSearchEndpoint() }),
          "",
          t("handlers.webSearchEngine.usageHeader"),
          t("handlers.webSearchEngine.usageMojeek"),
          t("handlers.webSearchEngine.usageSearxng"),
          t("handlers.webSearchEngine.usageSearxngUrl"),
          "",
          t("handlers.webSearchEngine.alias"),
          "",
          t("handlers.webSearchEngine.searxngInfo"),
          t("handlers.webSearchEngine.searxngInstall")
        ].join("\n")
      };
    }
    const cfg = readConfig();
    cfg.webSearchEngine = engine;
    if (engine === "searxng" && args[1]) {
      const raw = args[1];
      cfg.webSearchEndpoint = raw.includes("://") ? raw : `http://${raw}`;
    }
    writeConfig(cfg);
    const note = engine === "searxng" ? t("handlers.webSearchEngine.switchedSearxngNote", { endpoint: webSearchEndpoint() }) : "";
    ctx.postInfo?.(t("handlers.webSearchEngine.switched", { engine, note }));
    const detail = engine === "searxng" ? t("handlers.webSearchEngine.confirmedDetail", { endpoint: webSearchEndpoint() }) : "";
    return { info: t("handlers.webSearchEngine.confirmed", { engine, detail }) };
  },
  se: (args, loop2, ctx) => handlers17["search-engine"](args, loop2, ctx)
};

// src/cli/ui/slash/nearest.ts
function nearestCommands(input, all, opts = {}) {
  if (!input) return [];
  const max = opts.max ?? 3;
  const maxDistance = Math.min(opts.maxDistance ?? 3, Math.floor(input.length / 2));
  if (max <= 0 || maxDistance <= 0) return [];
  return all.map((name) => ({ name, distance: levenshtein(input, name) })).filter((entry) => entry.distance <= maxDistance).sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name)).slice(0, max).map((entry) => entry.name);
}
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let next = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    next[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const cost2 = a[i] === b[j] ? 0 : 1;
      next[j + 1] = Math.min((next[j] ?? 0) + 1, (prev[j + 1] ?? 0) + 1, (prev[j] ?? 0) + cost2);
    }
    [prev, next] = [next, prev];
  }
  return prev[b.length] ?? 0;
}

// src/cli/ui/slash/dispatch.ts
var HANDLERS = {
  ...handlers,
  ...handlers2,
  ...handlers3,
  ...handlers4,
  ...handlers5,
  ...handlers6,
  ...handlers7,
  ...handlers8,
  ...handlers9,
  ...handlers10,
  ...handlers11,
  ...handlers12,
  ...handlers13,
  ...handlers14,
  ...handlers16,
  ...handlers15,
  ...handlers17
};
function handleSlash(cmd, args, loop2, ctx = {}) {
  const h = HANDLERS[resolveSlashAlias(cmd)];
  if (h) return h(args, loop2, ctx);
  const suggestions = nearestCommands(cmd, Object.keys(HANDLERS));
  if (suggestions.length > 0) {
    const list2 = suggestions.map((name) => `/${name}`).join(", ");
    return { unknown: true, info: t("handlers.basic.unknownCommand", { cmd, list: list2 }) };
  }
  return { unknown: true, info: t("handlers.basic.unknownCommandShort", { cmd }) };
}

// src/cli/ui/state/TurnTranslator.ts
var TurnTranslator = class {
  constructor(log) {
    this.log = log;
  }
  log;
  reasoningCardId = null;
  streamingCardId = null;
  toolCardId = null;
  toolStartedAt = 0;
  flushBuffers(reasoningChunk, contentChunk, model2) {
    if (reasoningChunk) {
      if (!this.reasoningCardId) this.reasoningCardId = this.log.startReasoning(model2);
      this.log.appendReasoning(this.reasoningCardId, reasoningChunk);
    }
    if (contentChunk) {
      if (!this.streamingCardId) this.streamingCardId = this.log.startStreaming(model2);
      this.log.appendStreaming(this.streamingCardId, contentChunk);
    }
  }
  toolStart(name, args, callId) {
    this.toolStartedAt = Date.now();
    this.toolCardId = this.log.startTool(name, args, callId);
  }
  toolEnd(output) {
    if (this.toolCardId) {
      this.log.endTool(this.toolCardId, {
        output,
        elapsedMs: Date.now() - this.toolStartedAt
      });
      this.toolCardId = null;
    }
  }
  toolAbort(output) {
    if (this.toolCardId) {
      this.log.endTool(this.toolCardId, {
        output,
        elapsedMs: Date.now() - this.toolStartedAt,
        aborted: true
      });
      this.toolCardId = null;
    }
  }
  toolRetry(attempt, max) {
    if (this.toolCardId) this.log.retryTool(this.toolCardId, attempt, max);
  }
  reasoningDone(reasoningText) {
    if (!this.reasoningCardId) return;
    const paragraphs = reasoningText ? reasoningText.split(/\n\s*\n/).length : 0;
    const tokens = Math.round(reasoningText.length / 4);
    this.log.endReasoning(this.reasoningCardId, paragraphs, tokens);
    this.reasoningCardId = null;
  }
  streamingDone() {
    if (!this.streamingCardId) return;
    this.log.endStreaming(this.streamingCardId);
    this.streamingCardId = null;
  }
  turnEnd(stats2, reasoningText, extras) {
    this.log.endTurn(
      {
        prompt: stats2.usage.promptTokens,
        reason: Math.round(reasoningText.length / 4),
        output: stats2.usage.completionTokens,
        cacheHit: stats2.cacheHitRatio,
        cost: stats2.cost
      },
      extras
    );
  }
  abort() {
    if (this.streamingCardId) {
      this.log.endStreaming(this.streamingCardId, true);
      this.streamingCardId = null;
    }
    if (this.reasoningCardId) {
      this.log.endReasoning(this.reasoningCardId, 0, 0, true);
      this.reasoningCardId = null;
    }
    if (this.toolCardId) {
      this.log.endTool(this.toolCardId, {
        elapsedMs: Date.now() - this.toolStartedAt,
        aborted: true
      });
      this.toolCardId = null;
    }
    this.log.abortTurn();
  }
};

// src/cli/ui/state/cards-to-messages.ts
function cardsToDashboardMessages(cards) {
  const out = [];
  let pendingReasoning = null;
  for (const card of cards) {
    switch (card.kind) {
      case "reasoning":
        pendingReasoning = card;
        break;
      case "user":
        out.push({ id: card.id, role: "user", text: card.text });
        break;
      case "streaming": {
        const msg = { id: card.id, role: "assistant", text: card.text };
        if (pendingReasoning?.text) msg.reasoning = pendingReasoning.text;
        pendingReasoning = null;
        out.push(msg);
        break;
      }
      case "tool": {
        const msg = {
          id: card.id,
          role: "tool",
          text: card.output,
          toolName: card.name
        };
        if (card.args !== void 0) msg.toolArgs = JSON.stringify(card.args);
        out.push(msg);
        break;
      }
      case "live":
        if (card.variant === "stepProgress" || card.variant === "sessionOp") {
          out.push({
            id: card.id,
            role: card.tone === "warn" ? "warning" : "info",
            text: card.meta ? `${card.text}
${card.meta}` : card.text
          });
        } else if (card.tone === "warn" || card.tone === "err") {
          out.push({
            id: card.id,
            role: "warning",
            text: card.meta ? `${card.text}: ${card.meta}` : card.text
          });
        }
        break;
      case "ctx":
        out.push({ id: card.id, role: "info", text: card.text });
        break;
      case "tip": {
        const sectionTexts = card.sections.map((sec) => {
          const body2 = sec.rows.map((r) => `${r.key}	${r.text}`).join("\n");
          return sec.title ? `[${sec.title}]
${body2}` : body2;
        });
        const body = sectionTexts.join("\n\n");
        const text = card.footer ? `${card.topic}
${body}
${card.footer}` : `${card.topic}
${body}`;
        out.push({ id: card.id, role: "info", text });
        break;
      }
      case "plan": {
        const done = card.steps.filter((s) => s.status === "done").length;
        const tag2 = card.variant === "resumed" ? "[resumed]" : card.variant === "replay" ? "[replay]" : "";
        const head = `\u25B8 ${card.title}${tag2 ? ` ${tag2}` : ""} \u2014 ${done}/${card.steps.length} done`;
        out.push({ id: card.id, role: "info", text: head });
        break;
      }
      default:
        break;
    }
  }
  return out;
}

// src/cli/ui/state/hydrate.ts
function hydrateCardsFromMessages(messages) {
  const cards = [];
  const toolCardByCallId = /* @__PURE__ */ new Map();
  let seq2 = 0;
  const ts = Date.now();
  const id = (k) => `hyd-${k}-${++seq2}`;
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") {
      const text = typeof m.content === "string" ? m.content : "";
      if (text) cards.push({ kind: "user", id: id("user"), ts, text });
      continue;
    }
    if (m.role === "assistant") {
      const reasoning = m.reasoning_content;
      if (typeof reasoning === "string" && reasoning.length > 0) {
        cards.push({
          kind: "reasoning",
          id: id("reasoning"),
          ts,
          text: reasoning,
          paragraphs: reasoning.split(/\n\n+/).length,
          tokens: 0,
          streaming: false
        });
      }
      const text = typeof m.content === "string" ? m.content : "";
      if (text) {
        cards.push({ kind: "streaming", id: id("streaming"), ts, text, done: true });
      }
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          let parsedArgs = tc.function.arguments;
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
          }
          const card = {
            kind: "tool",
            id: id("tool"),
            ts,
            name: tc.function.name,
            args: parsedArgs,
            output: "",
            done: false,
            elapsedMs: 0
          };
          cards.push(card);
          if (tc.id) toolCardByCallId.set(tc.id, card);
        }
      }
      continue;
    }
    if (m.role === "tool") {
      const callId = m.tool_call_id;
      const card = callId ? toolCardByCallId.get(callId) : void 0;
      const text = typeof m.content === "string" ? m.content : "";
      if (card) {
        card.output = text;
        card.done = true;
      }
    }
  }
  return cards;
}

// src/cli/ui/useCompletionPickers.ts
import { useCallback as useCallback10, useEffect as useEffect14, useMemo as useMemo11, useReducer as useReducer2, useRef as useRef7, useState as useState25 } from "react";
var SEARCH_DEBOUNCE_MS = 80;
var SEARCH_FLUSH_MS = 50;
var SEARCH_RESULT_CAP = 200;
function useCompletionPickers({
  input,
  setInput,
  codeMode,
  rootDir,
  models,
  mcpServers,
  slashUsage
}) {
  const [slashSelected, setSlashSelected] = useState25(0);
  const slashMatches = useMemo11(() => {
    if (!input.startsWith("/") || input.includes(" ")) return null;
    return suggestSlashCommands(input.slice(1), !!codeMode, slashUsage);
  }, [input, codeMode, slashUsage]);
  const slashGroupMode = input === "/";
  const slashAdvancedHidden = useMemo11(
    () => slashGroupMode ? countAdvancedCommands(!!codeMode) : 0,
    [slashGroupMode, codeMode]
  );
  useEffect14(() => {
    setSlashSelected((prev) => {
      if (!slashMatches || slashMatches.length === 0) return 0;
      if (prev >= slashMatches.length) return slashMatches.length - 1;
      return prev;
    });
  }, [slashMatches]);
  const [atSelected, setAtSelected] = useState25(0);
  const recentFilesRef = useRef7([]);
  const recordRecentFile = useCallback10((p) => {
    const list2 = recentFilesRef.current;
    const i = list2.indexOf(p);
    if (i >= 0) list2.splice(i, 1);
    list2.unshift(p);
    if (list2.length > 20) list2.length = 20;
  }, []);
  const atPicker = useMemo11(() => {
    if (!codeMode) return null;
    if (slashMatches !== null) return null;
    return detectAtPicker(input);
  }, [codeMode, input, slashMatches]);
  const parsed = useMemo11(
    () => atPicker ? parseAtQuery(atPicker.query) : null,
    [atPicker]
  );
  const atMode = parsed ? parsed.trailingSlash || parsed.filter === "" ? "browse" : "search" : null;
  const browseDir = parsed && atMode === "browse" ? parsed.dir : "";
  const browse = useBrowseListing(rootDir, atMode === "browse" ? browseDir : null);
  const search = useStreamingSearch(
    rootDir,
    atMode === "search" && parsed ? parsed.filter : null,
    recentFilesRef
  );
  const atState = useMemo11(() => {
    if (!parsed) return null;
    if (atMode === "browse") {
      return {
        kind: "browse",
        baseDir: browseDir,
        entries: browse.entries,
        loading: browse.loading
      };
    }
    return {
      kind: "search",
      filter: parsed.filter,
      entries: search.entries,
      scanned: search.scanned,
      searching: search.searching
    };
  }, [parsed, atMode, browseDir, browse, search]);
  useEffect14(() => {
    setAtSelected((prev) => {
      const len = atState?.entries.length ?? 0;
      if (len === 0) return 0;
      if (prev >= len) return len - 1;
      return prev;
    });
  }, [atState]);
  const pickAtMention = useCallback10(
    (entry, action) => {
      if (!atPicker) return;
      const before = input.slice(0, atPicker.atOffset);
      const tail = action === "drill" && entry.isDir ? `${entry.insertPath}/` : `${entry.insertPath} `;
      setInput(`${before}@${tail}`);
    },
    [atPicker, input, setInput]
  );
  const [slashArgSelected, setSlashArgSelected] = useState25(0);
  const slashArgContext = useMemo11(() => {
    if (!input.startsWith("/")) return null;
    if (slashMatches !== null) return null;
    return detectSlashArgContext(input, !!codeMode);
  }, [input, slashMatches, codeMode]);
  const slashArgMatches = useMemo11(() => {
    if (!slashArgContext || slashArgContext.kind !== "picker") return null;
    const completer = slashArgContext.spec.argCompleter;
    const partial = slashArgContext.partial;
    const needle = partial.toLowerCase();
    if (Array.isArray(completer)) {
      if (partial && completer.some((v) => v.toLowerCase() === needle)) return null;
      if (!partial) return completer.slice();
      return completer.filter((v) => v.toLowerCase().startsWith(needle));
    }
    if (completer === "models") {
      const all = models ?? [];
      if (partial && all.some((m) => m.toLowerCase() === needle)) return null;
      if (!partial) return all.slice(0, 40);
      return all.filter((m) => m.toLowerCase().includes(needle)).slice(0, 40);
    }
    if (completer === "mcp-resources") {
      const uris = [];
      const servers = mcpServers ?? [];
      for (const s of servers) {
        if (!s.report.resources.supported) continue;
        for (const r of s.report.resources.items) uris.push(r.uri);
      }
      if (partial && uris.some((u) => u.toLowerCase() === needle)) return null;
      if (!partial) return uris.slice(0, 40);
      return uris.filter((u) => u.toLowerCase().includes(needle)).slice(0, 40);
    }
    if (completer === "mcp-prompts") {
      const names = [];
      const servers = mcpServers ?? [];
      for (const s of servers) {
        if (!s.report.prompts.supported) continue;
        for (const p of s.report.prompts.items) names.push(p.name);
      }
      if (partial && names.some((n) => n.toLowerCase() === needle)) return null;
      if (!partial) return names.slice(0, 40);
      return names.filter((n) => n.toLowerCase().includes(needle)).slice(0, 40);
    }
    return null;
  }, [slashArgContext, models, mcpServers]);
  useEffect14(() => {
    setSlashArgSelected((prev) => {
      if (!slashArgMatches || slashArgMatches.length === 0) return 0;
      if (prev >= slashArgMatches.length) return slashArgMatches.length - 1;
      return prev;
    });
  }, [slashArgMatches]);
  const pickSlashArg = useCallback10(
    (chosen) => {
      if (!slashArgContext) return;
      const before = input.slice(0, slashArgContext.partialOffset);
      setInput(`${before}${chosen}`);
    },
    [slashArgContext, input, setInput]
  );
  return {
    slashMatches,
    slashSelected,
    setSlashSelected,
    slashGroupMode,
    slashAdvancedHidden,
    atState,
    atSelected,
    setAtSelected,
    pickAtMention,
    recordRecentFile,
    slashArgContext,
    slashArgMatches,
    slashArgSelected,
    setSlashArgSelected,
    pickSlashArg
  };
}
function useBrowseListing(rootDir, dir) {
  const [entries, setEntries] = useState25([]);
  const [loading, setLoading] = useState25(false);
  useEffect14(() => {
    if (dir === null) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listDirectory(rootDir, dir).then(
      (raw) => {
        if (cancelled) return;
        setEntries(raw.map(toBrowseEntry));
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setEntries([]);
        setLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [rootDir, dir]);
  return { entries, loading };
}
function toBrowseEntry(d) {
  return { label: d.name, insertPath: d.path, dirSuffix: "", isDir: d.isDir };
}
function useStreamingSearch(rootDir, filter, recentFilesRef) {
  const [, bumpRender] = useReducer2((x) => x + 1, 0);
  const hitsRef = useRef7([]);
  const scannedRef = useRef7(0);
  const searchingRef = useRef7(false);
  const rankedRef = useRef7([]);
  useEffect14(() => {
    if (filter === null) {
      hitsRef.current = [];
      scannedRef.current = 0;
      searchingRef.current = false;
      rankedRef.current = [];
      bumpRender();
      return;
    }
    hitsRef.current = [];
    scannedRef.current = 0;
    searchingRef.current = true;
    rankedRef.current = [];
    bumpRender();
    const ac = new AbortController();
    let flushTimer = null;
    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        rankedRef.current = rankSearchHits(hitsRef.current, filter, recentFilesRef.current ?? []);
        bumpRender();
      }, SEARCH_FLUSH_MS);
    };
    const debounce = setTimeout(() => {
      walkFilesStream(rootDir, {
        signal: ac.signal,
        onEntry: (e) => {
          hitsRef.current.push(e);
          if (hitsRef.current.length >= SEARCH_RESULT_CAP * 8) return false;
          scheduleFlush();
        },
        onProgress: (n) => {
          scannedRef.current = n;
          scheduleFlush();
        }
      }).then(() => {
        searchingRef.current = false;
        rankedRef.current = rankSearchHits(hitsRef.current, filter, recentFilesRef.current ?? []);
        bumpRender();
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(debounce);
      if (flushTimer) clearTimeout(flushTimer);
      ac.abort();
    };
  }, [rootDir, filter, recentFilesRef]);
  return {
    entries: rankedRef.current,
    scanned: scannedRef.current,
    searching: searchingRef.current
  };
}
function rankSearchHits(hits, filter, recent) {
  const ranked = rankPickerCandidates(hits, filter, {
    limit: SEARCH_RESULT_CAP,
    recentlyUsed: recent
  });
  return ranked.map((path) => {
    const slash = path.lastIndexOf("/");
    return {
      label: slash >= 0 ? path.slice(slash + 1) : path,
      insertPath: path,
      dirSuffix: slash >= 0 ? `${path.slice(0, slash)}/` : "",
      isDir: false
    };
  });
}

// src/cli/ui/useEditHistory.ts
import { useCallback as useCallback11, useRef as useRef8, useState as useState26 } from "react";
function useEditHistory(codeMode) {
  const editHistory = useRef8([]);
  const nextHistoryId = useRef8(1);
  const currentTurnEntry = useRef8(null);
  const [undoBanner, setUndoBanner] = useState26(null);
  const undoTimeoutRef = useRef8(null);
  const recordEdit = useCallback11(
    (source, blocks, results, snaps) => {
      if (snaps.length === 0) return;
      let entry = currentTurnEntry.current;
      if (!entry) {
        entry = {
          id: nextHistoryId.current++,
          at: Date.now(),
          source,
          blocks: [],
          results: [],
          snapshots: [],
          undoneFiles: /* @__PURE__ */ new Set()
        };
        currentTurnEntry.current = entry;
        editHistory.current.push(entry);
      }
      entry.blocks.push(...blocks);
      entry.results.push(...results);
      const seen = new Set(entry.snapshots.map((s) => s.path));
      for (const s of snaps) {
        if (!seen.has(s.path)) entry.snapshots.push(s);
      }
    },
    []
  );
  const armUndoBanner = useCallback11((results) => {
    setUndoBanner({ results, expiresAt: Date.now() + 5e3, pausedRemainingMs: null });
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      setUndoBanner(null);
      undoTimeoutRef.current = null;
    }, 5e3);
  }, []);
  const toggleUndoPause = useCallback11(() => {
    setUndoBanner((prev) => {
      if (!prev) return prev;
      if (prev.pausedRemainingMs === null) {
        const remaining2 = Math.max(0, prev.expiresAt - Date.now());
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
          undoTimeoutRef.current = null;
        }
        return { ...prev, pausedRemainingMs: remaining2 };
      }
      const remaining = prev.pausedRemainingMs;
      undoTimeoutRef.current = setTimeout(() => {
        setUndoBanner(null);
        undoTimeoutRef.current = null;
      }, remaining);
      return { ...prev, expiresAt: Date.now() + remaining, pausedRemainingMs: null };
    });
  }, []);
  const codeUndo = useCallback11(
    (args = []) => {
      if (!codeMode) return "not in code mode";
      const root = codeMode.rootDir;
      const revert = (entry2, paths) => {
        const subset = entry2.snapshots.filter((s) => paths.includes(s.path));
        if (subset.length === 0) {
          return `batch #${entry2.id}: nothing to undo (already restored or path not in batch)`;
        }
        const results = restoreSnapshots(subset, root);
        for (const s of subset) entry2.undoneFiles.add(s.path);
        if (currentTurnEntry.current === entry2 && isEntryFullyUndone(entry2)) {
          currentTurnEntry.current = null;
        }
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
          undoTimeoutRef.current = null;
        }
        setUndoBanner(null);
        const when = new Date(entry2.at).toISOString().replace("T", " ").slice(11, 19);
        const scope = subset.length === 1 ? subset[0].path : `${subset.length} file(s)`;
        const header = `\u25B8 undo: reverted ${scope} from batch #${entry2.id} (${when})`;
        return [header, ...formatUndoRows(results)].join("\n");
      };
      const idArg = args[0];
      const pathArg = args[1];
      if (!idArg) {
        for (let i = editHistory.current.length - 1; i >= 0; i--) {
          const e = editHistory.current[i];
          if (isEntryFullyUndone(e)) continue;
          const remaining = e.snapshots.map((s) => s.path).filter((p) => !e.undoneFiles.has(p));
          return revert(e, remaining);
        }
        return "nothing to undo \u2014 every batch in the session history is already undone";
      }
      const id = Number.parseInt(idArg, 10);
      if (!Number.isFinite(id)) {
        return "usage: /undo [id] [path]   (omit id for newest; id from /history; path from /show <id>)";
      }
      const entry = editHistory.current.find((e) => e.id === id);
      if (!entry) return `no edit #${id} \u2014 run /history to see valid ids`;
      if (!pathArg) {
        const remaining = entry.snapshots.map((s) => s.path).filter((p) => !entry.undoneFiles.has(p));
        if (remaining.length === 0) return `batch #${id} is already fully undone`;
        return revert(entry, remaining);
      }
      const snap = entry.snapshots.find((s) => s.path === pathArg);
      if (!snap) {
        const files = [...new Set(entry.blocks.map((b) => b.path))];
        return `batch #${id} doesn't include "${pathArg}" \u2014 files in this batch: ${files.join(", ")}`;
      }
      if (entry.undoneFiles.has(pathArg)) {
        return `${pathArg} in batch #${id} is already undone`;
      }
      return revert(entry, [pathArg]);
    },
    [codeMode]
  );
  const codeHistory = useCallback11(() => {
    if (!codeMode) return "not in code mode";
    const entries = editHistory.current;
    if (entries.length === 0) return "no edits recorded this session yet";
    const lines = ["Edit history (oldest first):"];
    for (const e of entries) {
      const when = new Date(e.at).toISOString().replace("T", " ").slice(11, 19);
      const files = new Set(e.blocks.map((b) => b.path));
      const fileList = [...files].join(", ");
      const fileSummary = fileList.length > 60 ? `${fileList.slice(0, 60)}\u2026` : fileList;
      const status2 = entryStatus(e);
      const statusText = status2 === "applied" ? "applied" : status2 === "PARTIAL" ? "PARTIAL" : "UNDONE ";
      lines.push(
        `  #${String(e.id).padStart(3)}  ${when}  ${statusText}  ${e.source.padEnd(12)} ${files.size} file \xB7 ${e.blocks.length} block   ${fileSummary}`
      );
    }
    lines.push("");
    lines.push(
      "/show <id>            \u2192 per-file summary    \xB7    /show <id> <path>  \u2192 full diff of one file"
    );
    lines.push(
      "/undo                 \u2192 newest non-undone   \xB7    /undo <id> [path]  \u2192 target a specific batch or file"
    );
    return lines.join("\n");
  }, [codeMode]);
  const codeShowEdit = useCallback11(
    (args = []) => {
      if (!codeMode) return "not in code mode";
      const entries = editHistory.current;
      if (entries.length === 0) return "no edits recorded this session \u2014 /history is empty";
      const idArg = args[0];
      const pathArg = args[1];
      let entry;
      if (!idArg) {
        entry = [...entries].reverse().find((e) => !isEntryFullyUndone(e)) ?? entries[entries.length - 1];
      } else {
        const id = Number.parseInt(idArg, 10);
        if (!Number.isFinite(id)) {
          return "usage: /show [id] [path]   (omit id for newest; path from the per-file summary)";
        }
        entry = entries.find((e) => e.id === id);
        if (!entry) return `no edit #${id} \u2014 run /history to see valid ids`;
      }
      if (!entry) return "unexpected: history lookup failed";
      if (pathArg) {
        const fileBlocks = entry.blocks.filter((b) => b.path === pathArg);
        if (fileBlocks.length === 0) {
          const files2 = [...new Set(entry.blocks.map((b) => b.path))];
          return `batch #${entry.id} doesn't include "${pathArg}" \u2014 files in this batch: ${files2.join(", ")}`;
        }
        const when2 = new Date(entry.at).toISOString().replace("T", " ").slice(11, 19);
        const state = entry.undoneFiles.has(pathArg) ? "UNDONE" : "applied";
        const header2 = `\u25B8 edit #${entry.id} \xB7 ${when2} \xB7 ${pathArg} \xB7 ${state} \xB7 ${fileBlocks.length} block(s)`;
        const diff = formatAllBlockDiffs(fileBlocks, { maxLines: 60, contextLines: 2 });
        const footer = entry.undoneFiles.has(pathArg) ? "(already reverted \u2014 /history shows the batch-level status)" : `/undo ${entry.id} ${pathArg}  \u2192 revert just this file`;
        return [header2, ...diff, "", footer].join("\n");
      }
      const when = new Date(entry.at).toISOString().replace("T", " ").slice(11, 19);
      const files = [...new Set(entry.blocks.map((b) => b.path))];
      const status2 = entryStatus(entry);
      const header = `\u25B8 edit #${entry.id} \xB7 ${when} \xB7 ${entry.source} \xB7 ${status2} \xB7 ${files.length} file(s)`;
      const countLines2 = (s) => s.length === 0 ? 0 : (s.match(/\n/g)?.length ?? 0) + 1;
      const fileLines = files.map((path) => {
        const fileBlocks = entry.blocks.filter((b) => b.path === path);
        let removed = 0;
        let added = 0;
        for (const b of fileBlocks) {
          removed += countLines2(b.search);
          added += countLines2(b.replace);
        }
        const state = entry.undoneFiles.has(path) ? "UNDONE" : "applied";
        return `  ${state.padEnd(7)}  -${String(removed).padStart(3)}/+${String(added).padStart(3)}   ${path}  (${fileBlocks.length} block${fileBlocks.length === 1 ? "" : "s"})`;
      });
      return [
        header,
        ...fileLines,
        "",
        `/show ${entry.id} <path>   \u2192 full diff of one file`,
        `/undo ${entry.id} <path>   \u2192 revert just that file   \xB7   /undo ${entry.id} \u2192 revert whole batch`
      ].join("\n");
    },
    [codeMode]
  );
  const sealCurrentEntry = useCallback11(() => {
    currentTurnEntry.current = null;
  }, []);
  const hasUndoable = useCallback11(
    () => editHistory.current.some((e) => !isEntryFullyUndone(e)),
    []
  );
  const touchedPaths = useCallback11(() => {
    const seen = /* @__PURE__ */ new Set();
    for (const entry of editHistory.current) {
      for (const b of entry.blocks) seen.add(b.path);
    }
    return [...seen];
  }, []);
  return {
    undoBanner,
    recordEdit,
    armUndoBanner,
    toggleUndoPause,
    codeUndo,
    codeHistory,
    codeShowEdit,
    sealCurrentEntry,
    hasUndoable,
    touchedPaths
  };
}

// src/cli/ui/useSessionInfo.ts
import { useCallback as useCallback12, useEffect as useEffect15, useState as useState27 } from "react";
function useSessionInfo(loop2) {
  const [balance, setBalance] = useState27(null);
  const [models, setModels] = useState27(null);
  const [latestVersion, setLatestVersion] = useState27(null);
  useEffect15(() => {
    let cancelled = false;
    void (async () => {
      const bal = await loop2.client.getBalance().catch(() => null);
      if (cancelled || !bal) return;
      const primary = pickPrimaryBalance(bal.balance_infos);
      if (!primary) return;
      setBalance({ currency: primary.currency, total: Number(primary.total_balance) });
    })();
    return () => {
      cancelled = true;
    };
  }, [loop2]);
  useEffect15(() => {
    let cancelled = false;
    void (async () => {
      const list2 = await loop2.client.listModels().catch(() => null);
      if (cancelled || !list2) return;
      setModels(list2.data.map((m) => m.id));
    })();
    return () => {
      cancelled = true;
    };
  }, [loop2]);
  useEffect15(() => {
    let cancelled = false;
    void (async () => {
      const latest = await getLatestVersion();
      if (cancelled || !latest) return;
      setLatestVersion(latest);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const updateAvailable = latestVersion && compareVersions(VERSION, latestVersion) < 0 ? latestVersion : null;
  const refreshBalance = useCallback12(() => {
    void (async () => {
      const bal = await loop2.client.getBalance().catch(() => null);
      const primary = bal ? pickPrimaryBalance(bal.balance_infos) : null;
      if (primary) {
        setBalance({ currency: primary.currency, total: Number(primary.total_balance) });
      }
    })();
  }, [loop2]);
  const refreshModels = useCallback12(() => {
    void (async () => {
      const list2 = await loop2.client.listModels().catch(() => null);
      if (list2) setModels(list2.data.map((m) => m.id));
    })();
  }, [loop2]);
  const refreshLatestVersion = useCallback12(() => {
    void (async () => {
      const fresh = await getLatestVersion({ force: true });
      if (fresh) setLatestVersion(fresh);
    })();
  }, []);
  return {
    balance,
    models,
    latestVersion,
    updateAvailable,
    refreshBalance,
    refreshModels,
    refreshLatestVersion
  };
}

// src/cli/ui/useSubagent.ts
import { useEffect as useEffect16, useRef as useRef9, useState as useState28 } from "react";
function reduceSubagentInnerEvent(prev, ev) {
  if (ev.kind === "inner") {
    if (!ev.inner) return prev;
    const summary = summariseInner(ev.inner);
    if (!summary) return prev;
    return mapMatchingRun(prev, ev.runId, (a) => ({ ...a, lastInner: summary }));
  }
  if (ev.kind === "progress") {
    return mapMatchingRun(prev, ev.runId, (a) => {
      const iter = ev.iter ?? a.iter;
      const elapsedMs = ev.elapsedMs ?? a.elapsedMs;
      if (iter === a.iter && elapsedMs === a.elapsedMs) return a;
      return { ...a, iter, elapsedMs };
    });
  }
  if (ev.kind === "phase") {
    return mapMatchingRun(prev, ev.runId, (a) => {
      const phase = ev.phase ?? a.phase;
      if (phase === a.phase) return a;
      return { ...a, phase };
    });
  }
  return prev;
}
function mapMatchingRun(prev, runId, fn) {
  let idx = -1;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i].runId === runId) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return prev;
  const updated = fn(prev[idx]);
  if (updated === prev[idx]) return prev;
  const next = prev.slice();
  next[idx] = updated;
  return next;
}
function summariseInner(ev) {
  if (ev.role === "tool_start") {
    return {
      glyph: "\u25A3",
      color: CARD.tool.color,
      label: ev.toolName ?? t("common.tool"),
      meta: t("common.running")
    };
  }
  if (ev.role === "tool") {
    return {
      glyph: "\u25A3",
      color: CARD.tool.color,
      label: ev.toolName ?? t("common.tool"),
      meta: t("common.done")
    };
  }
  if (ev.role === "warning") {
    return {
      glyph: "\u26A0",
      color: TONE.warn,
      label: t("common.warning"),
      meta: ev.content?.slice(0, 40)
    };
  }
  if (ev.role === "error") {
    return { glyph: "\u2716", color: TONE.err, label: ev.error ?? t("common.error") };
  }
  return null;
}
function useSubagent({
  session,
  log,
  getWalletCurrency
}) {
  const [activities, setActivities] = useState28([]);
  const sinkRef = useRef9({ current: null });
  const getWalletCurrencyRef = useRef9(getWalletCurrency);
  useEffect16(() => {
    getWalletCurrencyRef.current = getWalletCurrency;
  }, [getWalletCurrency]);
  useEffect16(() => {
    sinkRef.current.current = (ev) => {
      if (ev.kind === "start") {
        setActivities((prev) => {
          if (prev.some((a) => a.runId === ev.runId)) return prev;
          const next = {
            runId: ev.runId,
            startedAt: Date.now() - (ev.elapsedMs ?? 0),
            task: ev.task,
            iter: ev.iter ?? 0,
            elapsedMs: ev.elapsedMs ?? 0,
            skillName: ev.skillName,
            model: ev.model,
            phase: "exploring",
            lastInner: null
          };
          return [...prev, next];
        });
        return;
      }
      if (ev.kind === "end") {
        setActivities((prev) => prev.filter((a) => a.runId !== ev.runId));
        const seconds = ((ev.elapsedMs ?? 0) / 1e3).toFixed(1);
        const costTail = ev.costUsd !== void 0 && ev.costUsd > 0 ? ` \xB7 ${formatCost(ev.costUsd, getWalletCurrencyRef.current?.())}` : "";
        const summary = ev.error ? `\u232C subagent "${ev.task}" failed after ${seconds}s \xB7 ${ev.iter ?? 0} tool call(s) \u2014 ${ev.error}` : `\u232C subagent "${ev.task}" done in ${seconds}s \xB7 ${ev.iter ?? 0} tool call(s) \xB7 ${ev.turns ?? 0} turn(s)${costTail}`;
        log.pushInfo(summary);
        if (!ev.error && ev.usage && ev.model) {
          appendUsage({
            session: session ?? null,
            model: ev.model,
            usage: ev.usage,
            kind: "subagent",
            subagent: {
              skillName: ev.skillName,
              taskPreview: ev.task.slice(0, 60),
              toolIters: ev.iter ?? 0,
              durationMs: ev.elapsedMs ?? 0
            }
          });
        }
        return;
      }
      setActivities((prev) => reduceSubagentInnerEvent(prev, ev));
    };
    return () => {
      sinkRef.current.current = null;
    };
  }, [session, log]);
  return { activities, sinkRef };
}

// src/cli/ui/App.tsx
var FLUSH_INTERVAL_MS = (() => {
  const raw = process.env.REASONIX_FLUSH_MS;
  if (!raw) return 50;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 16 || parsed > 1e3) return 50;
  return Math.round(parsed);
})();
function InputAreaWithHistoryHint({
  inputArea
}) {
  const pinned = useChatScrollState((s) => s.pinned);
  if (!pinned) {
    return /* @__PURE__ */ React66.createElement(Text57, { color: FG.faint }, " \u{1F4D6} reading history \u2014 End / PgDn to return \xB7 \u2193 to advance one line");
  }
  return /* @__PURE__ */ React66.createElement(React66.Fragment, null, inputArea);
}
function HistoryTypingCapture({
  input,
  setInput,
  enabled,
  onReturnToBottom
}) {
  const pinned = useChatScrollState((s) => s.pinned);
  useKeystroke((ev) => {
    if (ev.paste) return;
    if (ev.return) {
      onReturnToBottom();
      return;
    }
    if (ev.backspace) {
      setInput(input.slice(0, -1));
      return;
    }
    if (ev.input.length > 0 && ev.input >= " ") {
      setInput(input + ev.input);
    }
  }, enabled && !pinned);
  return null;
}
function LoopStatusRow({
  loop: loop2
}) {
  const [, setTick] = React66.useState(0);
  React66.useEffect(() => {
    const id = setInterval(() => setTick((t2) => t2 + 1), 1e3);
    return () => clearInterval(id);
  }, []);
  const nextFireMs = Math.max(0, loop2.nextFireAt - Date.now());
  return /* @__PURE__ */ React66.createElement(Box54, null, /* @__PURE__ */ React66.createElement(Text57, { color: "cyan" }, `\u25B8 ${formatLoopStatus(loop2.prompt, nextFireMs, loop2.iter)} \xB7 /loop stop or type to cancel`));
}
function App(props) {
  markPhase("app_render_start");
  const session = useAgentSession({
    sessionId: props.session,
    model: props.model,
    workspace: props.codeMode?.rootDir ?? process.cwd()
  });
  const initialCards = React66.useMemo(
    () => props.session ? hydrateCardsFromMessages(loadSessionMessages(props.session)) : [],
    [props.session]
  );
  const [themeName, setThemeName] = React66.useState(
    () => resolveThemePreference(loadTheme(), process.env.REASONIX_THEME)
  );
  const statusBar = React66.useMemo(() => {
    const cfg = readConfig().statusBar ?? {};
    return {
      showBalance: cfg.showBalance !== false,
      showSessionCost: cfg.showSessionCost !== false,
      showTurnCost: cfg.showTurnCost !== false,
      showCacheHit: cfg.showCacheHit !== false,
      showVersion: cfg.showVersion !== false,
      showFeedbackHint: cfg.showFeedbackHint !== false
    };
  }, []);
  return /* @__PURE__ */ React66.createElement(ThemeProvider, { name: themeName }, /* @__PURE__ */ React66.createElement(AgentStoreProvider, { session, initialCards }, /* @__PURE__ */ React66.createElement(ChatScrollProvider, null, /* @__PURE__ */ React66.createElement(
    AppInner,
    {
      ...props,
      themeName,
      setThemeName,
      statusBar
    }
  ))));
}
function AppInner({
  model: model2,
  system,
  rebuildSystem,
  transcript,
  budgetUsd,
  failureThreshold,
  session,
  tools,
  mcpSpecs,
  mcpServers,
  mcpRuntime,
  progressSink,
  codeMode,
  noDashboard,
  dashboardPort,
  onSwitchSession,
  mouse = true,
  startupInfoHints,
  themeName,
  setThemeName,
  statusBar
}) {
  markPhase("app_inner_start");
  const log = useScrollback();
  const agentStore = useAgentStore();
  const hasConversation = useAgentState(
    (s) => s.cards.some((c) => c.kind === "user" || c.kind === "streaming")
  );
  const isStreaming = useAgentState((s) => s.cards.some((c) => c.kind === "streaming" && !c.done));
  const activityLabel = useActivityLabel();
  const chatScroll = useChatScrollActions();
  const [input, setInput] = useState29("");
  const [busy, setBusy] = useState29(false);
  const [slashUsage, setSlashUsage] = useState29(
    () => loadSlashUsage()
  );
  const [liveExpand, setLiveExpand] = useState29(false);
  useEffect17(() => {
    if (!isStreaming && liveExpand) setLiveExpand(false);
  }, [isStreaming, liveExpand]);
  const languageVersion = useLanguageReload();
  const [bootReady, setBootReady] = useState29(false);
  useEffect17(() => {
    const t2 = setTimeout(() => setBootReady(true), 1400);
    return () => clearTimeout(t2);
  }, []);
  useEffect17(() => {
    markPhase("first_paint");
    dumpStartupProfile();
  }, []);
  const [liveMcpServers, setLiveMcpServers] = useState29(() => mcpServers ?? []);
  const abortedThisTurn = useRef10(false);
  useEffect17(() => {
    busyRef.current = busy;
  }, [busy]);
  const {
    ongoingTool,
    setOngoingTool,
    toolProgress,
    setToolProgress,
    statusLine,
    setStatusLine,
    clear: clearToolProgressDisplay
  } = useToolProgressDisplay(progressSink);
  const { stdout } = useStdout18();
  useTerminalSetup(mouse);
  const walletCurrencyRef = useRef10(void 0);
  const { activities: subagentActivities, sinkRef: subagentSinkRef } = useSubagent({
    session,
    log,
    getWalletCurrency: () => walletCurrencyRef.current
  });
  const { currentRootDir, setCurrentRootDir, currentRootDirRef } = useWorkspaceRoot(
    codeMode?.rootDir
  );
  const { hookList, reloadHooks } = useHookList(codeMode?.rootDir);
  const {
    undoBanner,
    recordEdit,
    armUndoBanner,
    toggleUndoPause,
    codeUndo,
    codeHistory,
    codeShowEdit,
    sealCurrentEntry,
    hasUndoable,
    touchedPaths
  } = useEditHistory(codeMode);
  const {
    pendingEdits,
    pendingCount,
    pendingTick,
    syncPendingCount,
    editMode,
    setEditMode,
    editModeRef,
    modeFlash
  } = useEditGate(!!codeMode);
  const { preset: preset2, setPreset, proArmed, setProArmed, turnOnPro, setTurnOnPro } = usePresetMode(model2);
  const planModeRef = useRef10(false);
  const latestVersionRef = useRef10(null);
  const [pendingEditReview, setPendingEditReview] = useState29(null);
  const [walkthroughActive, setWalkthroughActive] = useState29(false);
  const editReviewResolveRef = useRef10(null);
  const turnEditPolicyRef = useRef10("ask");
  const [pendingShell, setPendingShell] = useState29(null);
  const [pendingPath, setPendingPath] = useState29(null);
  const [pendingPlan, setPendingPlan] = useState29(null);
  const [pendingReviseEditor, setPendingReviseEditor] = useState29(null);
  const [pendingSessionsPicker, setPendingSessionsPicker] = useState29(false);
  const [sessionsPickerList, setSessionsPickerList] = useState29([]);
  const [pendingCheckpointPicker, setPendingCheckpointPicker] = useState29(false);
  const [checkpointPickerList, setCheckpointPickerList] = useState29([]);
  const [pendingMcpHub, setPendingMcpHub] = useState29(null);
  const [pendingModelPicker, setPendingModelPicker] = useState29(false);
  const [pendingThemePicker, setPendingThemePicker] = useState29(false);
  const [pendingCopyMode, setPendingCopyMode] = useState29(false);
  const [stagedInput, setStagedInput] = useState29(null);
  const [pendingCheckpoint, setPendingCheckpoint] = useState29(null);
  const [stagedCheckpointRevise, setStagedCheckpointRevise] = useState29(null);
  const [pendingRevision, setPendingRevision] = useState29(null);
  const [pendingChoice, setPendingChoice] = useState29(null);
  const [stagedChoiceCustom, setStagedChoiceCustom] = useState29(null);
  const modalOpen = !!pendingShell || !!pendingPlan || !!pendingReviseEditor || !!pendingSessionsPicker || !!pendingCheckpointPicker || !!pendingMcpHub || pendingModelPicker || pendingThemePicker || pendingCopyMode || !!stagedInput || !!pendingEditReview || walkthroughActive || !!pendingChoice || !!stagedChoiceCustom || !!pendingRevision || !!stagedCheckpointRevise || !!pendingCheckpoint;
  const [planMode, setPlanMode] = useState29(false);
  const [queuedSubmit, setQueuedSubmit] = useState29(null);
  const { recallPrev, recallNext, pushHistory, resetCursor } = useInputRecall(setInput);
  const { setRawMode, isRawModeSupported } = useStdin();
  const handleOpenExternalEditor = useCallback13(async () => {
    if (!isRawModeSupported) {
      log.pushWarning(t("composer.editorFailed"), t("composer.editorNoRawMode"));
      return;
    }
    setRawMode(false);
    try {
      const result = await openInExternalEditor(input);
      if (result.kind === "ok") setInput(result.content);
      else if (result.detail) log.pushWarning(t("composer.editorFailed"), result.detail);
    } finally {
      setRawMode(true);
    }
  }, [input, isRawModeSupported, log, setRawMode]);
  const assistantIterCounter = useRef10(0);
  const atUrlCache = useRef10(/* @__PURE__ */ new Map());
  const handleSubmitRef = useRef10(null);
  const busyRef = useRef10(false);
  const dashboardRef = useRef10(null);
  const dashboardStartingRef = useRef10(null);
  const eventSubscribersRef = useRef10(/* @__PURE__ */ new Set());
  const activePickerResolverRef = useRef10(null);
  const activePickerSnapshotRef = useRef10(null);
  const activeViewerResolverRef = useRef10(null);
  const activeViewerSnapshotRef = useRef10(null);
  const [pendingReplayViewer, setPendingReplayViewer] = useState29(null);
  const planStepsRef = useRef10(null);
  const completedStepIdsRef = useRef10(/* @__PURE__ */ new Set());
  const planBodyRef = useRef10(null);
  const planSummaryRef = useRef10(null);
  const toolStartedAtRef = useRef10(null);
  const persistPlanState = useCallback13(() => {
    if (!session) return;
    const steps = planStepsRef.current;
    if (!steps || steps.length === 0) {
      clearPlanState(session);
      return;
    }
    const extras = {};
    if (planBodyRef.current) extras.body = planBodyRef.current;
    if (planSummaryRef.current) extras.summary = planSummaryRef.current;
    savePlanState(session, steps, completedStepIdsRef.current, extras);
  }, [session]);
  const [summary, setSummary] = useState29({
    turns: 0,
    totalCostUsd: 0,
    totalInputCostUsd: 0,
    totalOutputCostUsd: 0,
    claudeEquivalentUsd: 0,
    savingsVsClaudePct: 0,
    cacheHitRatio: 0,
    lastPromptTokens: 0,
    lastTurnCostUsd: 0
  });
  const transcriptRef = useRef10(null);
  if (transcript && !transcriptRef.current) {
    transcriptRef.current = openTranscriptFile(transcript, {
      version: 1,
      source: "reasonix chat",
      model: model2,
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  const eventSinkRef = useRef10(null);
  const eventizerRef = useRef10(null);
  if (session && !eventSinkRef.current) {
    eventSinkRef.current = openEventSink(eventLogPath(session));
    eventizerRef.current = new Eventizer();
    eventSinkRef.current.append(eventizerRef.current.emitSessionOpened(0, session, 0));
  }
  useEffect17(() => {
    return () => {
      transcriptRef.current?.end();
      void eventSinkRef.current?.close();
    };
  }, []);
  const loopRef = useRef10(null);
  const loop2 = useMemo12(() => {
    if (loopRef.current) return loopRef.current;
    const client = new DeepSeekClient({ baseUrl: loadBaseUrl() });
    if (tools && !tools.has("run_skill")) {
      registerSkillTools(tools, {
        projectRoot: codeMode?.rootDir,
        subagentRunner: async (skill2, task, signal) => {
          const result = await spawnSubagent({
            client,
            parentRegistry: tools,
            parentSignal: signal,
            // Skill body is the subagent's persona/playbook; the user-
            // supplied task is what to actually do inside it.
            system: skill2.body,
            task,
            // Per-skill model override (frontmatter `model: ...`),
            // else falls through to spawnSubagent's default.
            model: skill2.model,
            allowedTools: skill2.allowedTools,
            sink: subagentSinkRef.current,
            // Stamped onto every event so the TUI sink + usage log can
            // attribute the run to a skill without extra bookkeeping.
            skillName: skill2.name
          });
          return formatSubagentResult(result);
        }
      });
    }
    const prefix = new ImmutablePrefix({
      system,
      toolSpecs: tools?.specs()
    });
    const l = new CacheFirstLoop({
      client,
      prefix,
      tools,
      model: model2,
      budgetUsd,
      failureThreshold,
      session,
      hooks: hookList,
      hookCwd: currentRootDir,
      // Restore the user's last-chosen effort cap. Without this a
      // `/effort high` silently reverted to `max` on relaunch — the
      // loop's constructor default wins over persisted state.
      reasoningEffort: loadReasoningEffort(),
      rebuildSystem
    });
    loopRef.current = l;
    return l;
  }, [model2, system, rebuildSystem, budgetUsd, failureThreshold, session, tools, codeMode]);
  useEffect17(() => {
    if (!session || !tools) return;
    tools.setAuditListener((event) => {
      const sink = eventSinkRef.current;
      const eventizer = eventizerRef.current;
      if (!sink || !eventizer) return;
      sink.append(eventizer.emitToolCall(loop2.currentTurn, event.name, event.args));
    });
    pauseGate.setAuditListener((event) => {
      const sink = eventSinkRef.current;
      const eventizer = eventizerRef.current;
      if (!sink || !eventizer) return;
      switch (event.type) {
        case "tool.confirm.allow":
          sink.append(eventizer.emitToolConfirmAllow(loop2.currentTurn, event.kind, event.payload));
          break;
        case "tool.confirm.deny":
          sink.append(
            eventizer.emitToolConfirmDeny(
              loop2.currentTurn,
              event.kind,
              event.payload,
              event.denyContext
            )
          );
          break;
        case "tool.confirm.always_allow":
          sink.append(
            eventizer.emitToolConfirmAlwaysAllow(
              loop2.currentTurn,
              event.kind,
              event.payload,
              event.prefix
            )
          );
          break;
      }
    });
    return () => {
      tools.setAuditListener(null);
      pauseGate.setAuditListener(null);
    };
  }, [loop2, session, tools]);
  useEffect17(() => {
    loop2.hooks = hookList;
  }, [loop2, hookList]);
  useEffect17(() => {
    const canonical = loop2.model === "deepseek-v4-pro" ? "pro" : loop2.model === "deepseek-v4-flash" ? loop2.autoEscalate ? "auto" : "flash" : null;
    agentStore.dispatch({ type: "session.preset.change", preset: canonical });
  }, []);
  const mcpBridgeStartedRef = useRef10(false);
  useEffect17(() => {
    if (mcpBridgeStartedRef.current) return;
    if (!mcpRuntime || !mcpSpecs || mcpSpecs.length === 0) return;
    mcpBridgeStartedRef.current = true;
    const total = mcpSpecs.length;
    let ready = 0;
    agentStore.dispatch({ type: "mcp.loading", ready, total });
    const bumpReady = () => {
      ready = Math.min(ready + 1, total);
      agentStore.dispatch({ type: "mcp.loading", ready, total });
    };
    mcpRuntime.setLifecycleSink((notice) => {
      if (notice.kind === "handshake") {
        log.pushInfo(formatMcpLifecycleEvent({ state: "handshake", name: notice.name }));
      } else if (notice.kind === "connected") {
        log.pushInfo(
          formatMcpLifecycleEvent({
            state: "connected",
            name: notice.name,
            tools: notice.tools,
            resources: notice.resources,
            prompts: notice.prompts,
            ms: notice.ms
          })
        );
        bumpReady();
      } else if (notice.kind === "disabled") {
        log.pushInfo(formatMcpLifecycleEvent({ state: "disabled", name: notice.name }));
        bumpReady();
      } else if (notice.kind === "failed") {
        log.pushWarning(
          `MCP \xB7 ${notice.name} failed`,
          `${notice.reason}
\u2192 run \`reasonix setup\` to remove this entry, or fix the underlying issue (missing npm package, network, etc.).`
        );
        bumpReady();
      } else if (notice.kind === "slow") {
        log.pushInfo(
          formatMcpSlowToast({
            name: notice.serverName,
            p95Ms: notice.p95Ms,
            sampleSize: notice.sampleSize
          })
        );
      }
    });
    for (const spec of mcpSpecs) {
      void mcpRuntime.addSpec(spec, loop2).then(() => {
        setLiveMcpServers(mcpRuntime.summaries());
      });
    }
  }, [mcpRuntime, mcpSpecs, loop2, log, agentStore]);
  const { balance, models, latestVersion, refreshBalance, refreshModels, refreshLatestVersion } = useSessionInfo(loop2);
  useEffect17(() => {
    planModeRef.current = planMode;
  }, [planMode]);
  useEffect17(() => {
    latestVersionRef.current = latestVersion ?? null;
  }, [latestVersion]);
  const balanceRef = useRef10(null);
  const modelsRef = useRef10(null);
  useEffect17(() => {
    modelsRef.current = models;
  }, [models]);
  useEffect17(() => {
    balanceRef.current = balance;
    walletCurrencyRef.current = balance?.currency;
    if (balance) {
      agentStore.dispatch({
        type: "session.update",
        patch: { balance: balance.total, balanceCurrency: balance.currency }
      });
    }
  }, [balance, agentStore]);
  const broadcastDashboardEvent = useCallback13((ev) => {
    const subs = eventSubscribersRef.current;
    if (subs.size === 0) return;
    for (const h of subs) {
      try {
        h(ev);
      } catch {
      }
    }
  }, []);
  const pickerPorts = useMemo12(
    () => ({
      broadcast: broadcastDashboardEvent,
      resolverRef: activePickerResolverRef,
      snapshotRef: activePickerSnapshotRef
    }),
    [broadcastDashboardEvent]
  );
  const viewerPorts = useMemo12(
    () => ({
      broadcast: broadcastDashboardEvent,
      resolverRef: activeViewerResolverRef,
      snapshotRef: activeViewerSnapshotRef
    }),
    [broadcastDashboardEvent]
  );
  useViewerBroadcast(
    !!pendingReplayViewer,
    pendingReplayViewer ?? { viewerKind: "replay-plan", title: "" },
    () => setPendingReplayViewer(null),
    viewerPorts
  );
  useEffect17(() => {
    broadcastDashboardEvent({ kind: "busy-change", busy });
  }, [busy, broadcastDashboardEvent]);
  useEffect17(() => {
    if (!pendingShell) return;
    const modal = {
      kind: "shell",
      command: pendingShell.command,
      allowPrefix: derivePrefix(pendingShell.command),
      shellKind: pendingShell.kind
    };
    broadcastDashboardEvent({ kind: "modal-up", modal });
    return () => {
      broadcastDashboardEvent({ kind: "modal-down", modalKind: "shell" });
    };
  }, [pendingShell, broadcastDashboardEvent]);
  useEffect17(() => {
    if (!pendingChoice) return;
    const modal = {
      kind: "choice",
      question: pendingChoice.question,
      options: pendingChoice.options,
      allowCustom: pendingChoice.allowCustom
    };
    broadcastDashboardEvent({ kind: "modal-up", modal });
    return () => {
      broadcastDashboardEvent({ kind: "modal-down", modalKind: "choice" });
    };
  }, [pendingChoice, broadcastDashboardEvent]);
  useEffect17(() => {
    if (!pendingPlan) return;
    broadcastDashboardEvent({
      kind: "modal-up",
      modal: { kind: "plan", body: pendingPlan }
    });
    return () => {
      broadcastDashboardEvent({ kind: "modal-down", modalKind: "plan" });
    };
  }, [pendingPlan, broadcastDashboardEvent]);
  useEffect17(() => {
    if (!pendingEditReview) return;
    const previewLines = (pendingEditReview.search || pendingEditReview.replace || "").split("\n").slice(0, 12);
    const preview = previewLines.join("\n");
    broadcastDashboardEvent({
      kind: "modal-up",
      modal: {
        kind: "edit-review",
        path: pendingEditReview.path,
        search: pendingEditReview.search ?? "",
        replace: pendingEditReview.replace ?? "",
        preview,
        total: pendingEdits.current.length,
        remaining: pendingEdits.current.length
      }
    });
    return () => {
      broadcastDashboardEvent({ kind: "modal-down", modalKind: "edit-review" });
    };
  }, [pendingEditReview, broadcastDashboardEvent, pendingEdits]);
  useEffect17(() => {
    if (!pendingRevision) return;
    broadcastDashboardEvent({
      kind: "modal-up",
      modal: {
        kind: "revision",
        reason: pendingRevision.reason,
        remainingSteps: pendingRevision.remainingSteps.map((s) => ({
          id: s.id,
          title: s.title,
          action: s.action,
          ...s.risk ? { risk: s.risk } : {}
        })),
        ...pendingRevision.summary ? { summary: pendingRevision.summary } : {}
      }
    });
    return () => {
      broadcastDashboardEvent({ kind: "modal-down", modalKind: "revision" });
    };
  }, [pendingRevision, broadcastDashboardEvent]);
  const {
    slashMatches,
    slashSelected,
    setSlashSelected,
    slashGroupMode,
    slashAdvancedHidden,
    atState,
    atSelected,
    setAtSelected,
    pickAtMention,
    recordRecentFile,
    slashArgContext,
    slashArgMatches,
    slashArgSelected,
    setSlashArgSelected,
    pickSlashArg
  } = useCompletionPickers({
    input,
    setInput,
    codeMode,
    rootDir: currentRootDir,
    models,
    mcpServers: liveMcpServers,
    slashUsage
  });
  const handleHistoryPrev = useCallback13(() => {
    if (atState && atState.entries.length > 0) {
      setAtSelected((i) => Math.max(0, i - 1));
      return;
    }
    if (slashArgMatches && slashArgMatches.length > 0) {
      setSlashArgSelected((i) => Math.max(0, i - 1));
      return;
    }
    if (slashMatches && slashMatches.length > 0) {
      setSlashSelected((i) => Math.max(0, i - 1));
      return;
    }
    recallPrev();
  }, [
    atState,
    slashArgMatches,
    slashMatches,
    setAtSelected,
    setSlashArgSelected,
    setSlashSelected,
    recallPrev
  ]);
  const handleHistoryNext = useCallback13(() => {
    if (atState && atState.entries.length > 0) {
      setAtSelected((i) => Math.min(atState.entries.length - 1, i + 1));
      return;
    }
    if (slashArgMatches && slashArgMatches.length > 0) {
      setSlashArgSelected((i) => Math.min(slashArgMatches.length - 1, i + 1));
      return;
    }
    if (slashMatches && slashMatches.length > 0) {
      setSlashSelected((i) => Math.min(slashMatches.length - 1, i + 1));
      return;
    }
    recallNext();
  }, [
    atState,
    slashArgMatches,
    slashMatches,
    setAtSelected,
    setSlashArgSelected,
    setSlashSelected,
    recallNext
  ]);
  const sessionBannerShown = useRef10(false);
  useEffect17(() => {
    if (sessionBannerShown.current) return;
    sessionBannerShown.current = true;
    if (!session) {
      log.pushInfo(t("ui.ephemeralSession"));
    } else if (loop2.resumedMessageCount > 0) {
      log.pushInfo(t("ui.resumedSession", { name: session, count: loop2.resumedMessageCount }));
    } else {
      log.pushInfo(t("ui.newSession", { name: session }));
    }
    for (const hint of startupInfoHints ?? []) log.pushInfo(hint);
    if (session && codeMode) {
      const restored = loadPendingEdits(session);
      if (restored && restored.length > 0) {
        pendingEdits.current = restored;
        syncPendingCount();
        log.pushInfo(t("ui.restoredEdits", { count: restored.length }));
      }
    }
    if (session && loop2.resumedMessageCount > 0) {
      const restoredPlan = loadPlanState(session);
      if (restoredPlan && restoredPlan.steps.length > 0) {
        planStepsRef.current = restoredPlan.steps;
        completedStepIdsRef.current = new Set(restoredPlan.completedStepIds);
        planBodyRef.current = restoredPlan.body ?? null;
        planSummaryRef.current = restoredPlan.summary ?? null;
        const when = relativeTime(restoredPlan.updatedAt);
        const done = new Set(restoredPlan.completedStepIds);
        const summary2 = restoredPlan.summary ? ` \u2014 ${restoredPlan.summary}` : "";
        log.showPlan({
          title: t("ui.resumedPlan", { when, summary: summary2 }),
          steps: restoredPlan.steps.map((s) => ({
            id: s.id,
            title: s.title,
            status: done.has(s.id) ? "done" : "queued"
          })),
          variant: "resumed"
        });
      }
    }
    if (codeMode && !editModeHintShown()) {
      const tip = tObj("ui.tipEditBindings");
      log.pushTip({ topic: tip.topic, sections: tip.sections, footer: tip.footer });
      markEditModeHintShown();
    }
    if (!mouseClipboardHintShown()) {
      const tip = tObj("ui.tipMouseClipboard");
      log.pushTip({ topic: tip.topic, sections: tip.sections, footer: tip.footer });
      markMouseClipboardHintShown();
    }
  }, [session, loop2, codeMode, syncPendingCount, log, pendingEdits, startupInfoHints]);
  const quitProcess = useQuit(transcriptRef);
  useKeystroke((ev) => {
    const pickerOwnsArrows = (atState?.entries.length ?? 0) > 0 || (slashMatches?.length ?? 0) > 0 || (slashArgMatches?.length ?? 0) > 0 || pendingShell != null || pendingPath != null;
    if (ev.pageUp || ev.mouseScrollUp) chatScroll.scrollPageUp();
    else if (ev.pageDown || ev.mouseScrollDown) chatScroll.scrollPageDown();
    else if (ev.end) chatScroll.jumpToBottom();
    else if (!pickerOwnsArrows && ev.upArrow) chatScroll.scrollUp();
    else if (!pickerOwnsArrows && ev.downArrow) chatScroll.scrollDown();
  }, !modalOpen);
  useKeystroke((ev) => {
    const chKey = ev.input;
    const key = ev;
    if (ev.paste) {
      return;
    }
    if (key.ctrl && key.input === "c") {
      quitProcess();
      return;
    }
    if (key.escape && busy) {
      if (abortedThisTurn.current) return;
      abortedThisTurn.current = true;
      resetPendingModals();
      if (isLoopActive()) stopLoop();
      loop2.abort();
      return;
    }
    if (key.escape && !busy && isLoopActive()) {
      stopLoop();
      return;
    }
    if (key.escape && !busy && (slashMatches || atState || slashArgContext)) {
      setInput("");
      return;
    }
    if (key.escape && walkthroughActive) {
      setWalkthroughActive(false);
      const remaining = pendingEdits.current.length;
      log.pushInfo(
        remaining > 0 ? t("app.walkCancelledRemaining", { count: remaining }) : t("app.walkCancelled")
      );
      return;
    }
    if (codeMode && key.shift && key.tab && !pendingShell && !pendingPath && !pendingPlan && !pendingReviseEditor && !pendingSessionsPicker && !pendingCheckpointPicker && !pendingMcpHub && !stagedInput && !pendingEditReview && !walkthroughActive && !pendingChoice && !stagedChoiceCustom && !pendingRevision) {
      const cur = editModeRef.current;
      const next = cur === "review" ? "auto" : cur === "auto" ? "yolo" : "review";
      setEditMode(next);
      const message = next === "yolo" ? t("app.editModeYolo") : next === "auto" ? t("app.editModeAuto") : t("app.editModeReview");
      log.pushInfo(message);
      return;
    }
    if (codeMode && input.length === 0 && (chKey === "u" || chKey === "U") && !pendingShell && !pendingPath && !pendingPlan && !pendingReviseEditor && !pendingSessionsPicker && !pendingCheckpointPicker && !pendingMcpHub && !stagedInput && !pendingEditReview && !walkthroughActive && !pendingChoice && !stagedChoiceCustom && !pendingRevision && // Fire when EITHER the banner is up OR there's any non-undone
    // history entry — the keybind is useful long after the 5-second
    // banner expires, which users rightly want.
    (undoBanner || hasUndoable())) {
      const out = codeUndo([]);
      log.pushInfo(out);
      return;
    }
    if (codeMode && input.length === 0 && chKey === " " && undoBanner && !pendingShell && !pendingPath && !pendingPlan && !pendingReviseEditor && !pendingSessionsPicker && !pendingCheckpointPicker && !pendingMcpHub && !stagedInput && !pendingEditReview && !walkthroughActive && !pendingChoice && !stagedChoiceCustom && !pendingRevision) {
      toggleUndoPause();
      return;
    }
    if (key.ctrl && key.input === "o" && isStreaming && !pendingShell && !pendingPath && !pendingPlan && !pendingReviseEditor && !pendingSessionsPicker && !pendingCheckpointPicker && !pendingMcpHub && !stagedInput && !pendingEditReview && !walkthroughActive && !pendingChoice && !stagedChoiceCustom && !pendingRevision) {
      setLiveExpand((v) => !v);
      return;
    }
    if (busy) return;
    if (pendingShell || pendingPath) return;
    if (atState && atState.entries.length > 0) {
      const entries = atState.entries;
      if (key.upArrow) {
        setAtSelected((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setAtSelected((i) => Math.min(entries.length - 1, i + 1));
        return;
      }
      if (key.tab) {
        const sel = entries[atSelected] ?? entries[0];
        if (sel) pickAtMention(sel, sel.isDir ? "drill" : "commit");
        return;
      }
    }
    if (slashArgMatches && slashArgMatches.length > 0) {
      if (key.upArrow) {
        setSlashArgSelected((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setSlashArgSelected((i) => Math.min(slashArgMatches.length - 1, i + 1));
        return;
      }
      if (key.tab) {
        const sel = slashArgMatches[slashArgSelected] ?? slashArgMatches[0];
        if (sel) pickSlashArg(sel);
        return;
      }
    }
    if (slashMatches && slashMatches.length > 0) {
      if (key.upArrow) {
        setSlashSelected((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setSlashSelected((i) => Math.min(slashMatches.length - 1, i + 1));
        return;
      }
      if (key.tab) {
        const sel = slashMatches[slashSelected] ?? slashMatches[0];
        if (sel) setInput(`/${sel.cmd}`);
        return;
      }
    }
  });
  useEffect17(() => {
    if (!tools || !codeMode) return;
    tools.setToolInterceptor(async (name, args) => {
      if (name !== "edit_file" && name !== "write_file") return null;
      const rawPath = typeof args.path === "string" ? args.path : "";
      if (!rawPath) return null;
      let relPath = rawPath;
      while (relPath.startsWith("/") || relPath.startsWith("\\")) {
        relPath = relPath.slice(1);
      }
      if (!relPath) return null;
      const rootForEdit = currentRootDirRef.current;
      let block2;
      if (name === "edit_file") {
        const search = typeof args.search === "string" ? args.search : "";
        const replace = typeof args.replace === "string" ? args.replace : "";
        if (!search) return null;
        block2 = { path: relPath, search, replace, offset: 0 };
      } else {
        const content = typeof args.content === "string" ? args.content : "";
        block2 = toWholeFileEditBlock(relPath, content, rootForEdit);
      }
      const applyNow = () => {
        const snaps = snapshotBeforeEdits([block2], rootForEdit);
        const results = applyEditBlocks([block2], rootForEdit);
        const good = results.some((r) => r.status === "applied" || r.status === "created");
        if (good) {
          recordEdit("auto", [block2], results, snaps);
          armUndoBanner(results);
        }
        return formatEditResults(results);
      };
      if (editModeRef.current === "auto" || editModeRef.current === "yolo") return applyNow();
      if (turnEditPolicyRef.current === "apply-all") return applyNow();
      const { choice, denyContext } = await new Promise((resolveChoice) => {
        editReviewResolveRef.current = resolveChoice;
        setPendingEditReview(block2);
      });
      editReviewResolveRef.current = null;
      setPendingEditReview(null);
      if (choice === "reject") {
        const context2 = denyContext ? ` because: ${denyContext}` : "";
        log.pushInfo(t("app.rejectedEdit", { path: block2.path, context: context2 }));
        return `User rejected this edit to ${block2.path}${context2}. Don't retry the same SEARCH/REPLACE \u2014 either try a different approach or ask the user what they want instead.`;
      }
      if (choice === "apply-rest-of-turn") {
        turnEditPolicyRef.current = "apply-all";
        log.pushInfo(t("app.autoApprovingRest"));
        return applyNow();
      }
      if (choice === "flip-to-auto") {
        setEditMode("auto");
        log.pushInfo(t("app.flippedAutoSession"));
        return applyNow();
      }
      return applyNow();
    });
    return () => {
      tools.setToolInterceptor(null);
    };
  }, [tools, codeMode, session, recordEdit, armUndoBanner, syncPendingCount, setEditMode]);
  const { codeApply, codeDiscard } = useCodeMode({
    codeMode: !!codeMode,
    pendingEdits,
    currentRootDir,
    session: session ?? null,
    syncPendingCount,
    recordEdit
  });
  const prefixHash = loop2.prefix.fingerprint;
  const writeTranscript = useTranscriptWriter(transcriptRef, model2, prefixHash);
  const togglePlanMode = useCallback13(
    (on) => {
      setPlanMode(on);
      tools?.setPlanMode(on);
    },
    [tools]
  );
  const {
    startLoop,
    stopLoop,
    getLoopStatus,
    isLoopActive,
    isLoopFiring,
    clearFiringFlag,
    activeLoop
  } = useLoopMode({ log, busyRef, handleSubmitRef });
  const startWalkthrough = useCallback13(() => {
    if (!codeMode) {
      return "/walk is only available inside `reasonix code`.";
    }
    if (pendingEdits.current.length === 0) {
      return "nothing pending \u2014 nothing to walk through.";
    }
    setWalkthroughActive(true);
    return `\u25B8 walking ${pendingEdits.current.length} edit block(s) \u2014 y apply \xB7 n reject \xB7 a apply rest \xB7 A flip to AUTO \xB7 Esc cancels (keeps remaining queued).`;
  }, [codeMode, pendingEdits]);
  const startDashboard = useCallback13(async () => {
    if (dashboardRef.current) return dashboardRef.current.url;
    if (dashboardStartingRef.current) return dashboardStartingRef.current;
    const startup = (async () => {
      const { startDashboardServer } = await import("./server-DRFPXXSH.js");
      const handle = await startDashboardServer(
        {
          mode: "attached",
          configPath: defaultConfigPath(),
          usageLogPath: defaultUsageLogPath(),
          loop: loop2,
          tools,
          mcpServers: liveMcpServers,
          getCurrentCwd: () => codeMode ? currentRootDirRef.current : void 0,
          getEditMode: () => codeMode ? editModeRef.current : void 0,
          getPlanMode: () => planModeRef.current,
          getPendingEditCount: () => pendingEdits.current.length,
          getLatestVersion: () => latestVersionRef.current,
          getSessionName: () => session ?? null,
          setEditMode: (m) => {
            setEditMode(m);
            editModeRef.current = m;
            saveEditMode(m);
            return m;
          },
          setPlanMode: (on) => {
            if (codeMode) togglePlanMode(on);
          },
          applyPresetLive: (name) => {
            const settings = resolvePreset(name);
            loop2.configure({
              model: settings.model,
              autoEscalate: settings.autoEscalate,
              reasoningEffort: settings.reasoningEffort
            });
            agentStore.dispatch({ type: "session.model.change", model: settings.model });
            const canonical = settings.model === "deepseek-v4-pro" ? "pro" : settings.autoEscalate ? "auto" : "flash";
            setPreset(canonical);
            agentStore.dispatch({ type: "session.preset.change", preset: canonical });
            try {
              savePreset(canonical);
            } catch {
            }
          },
          applyEffortLive: (effort) => {
            loop2.configure({ reasoningEffort: effort });
          },
          applyModelLive: (model3) => {
            loop2.configure({ model: model3 });
            agentStore.dispatch({ type: "session.model.change", model: model3 });
          },
          getModels: () => modelsRef.current,
          setProNextLive: (armed) => {
            if (armed) loop2.armProForNextTurn();
            else loop2.disarmPro();
          },
          setBudgetUsdLive: (usd) => {
            loop2.setBudget(usd);
          },
          getLoopRunStatus: () => getLoopStatus(),
          startAutoLoop: (intervalMs, prompt) => startLoop(intervalMs, prompt),
          stopAutoLoop: () => stopLoop(),
          // ---------- Chat bridge ----------
          getMessages: () => cardsToDashboardMessages(agentStore.getState().cards),
          subscribeEvents: (handler) => {
            eventSubscribersRef.current.add(handler);
            return () => {
              eventSubscribersRef.current.delete(handler);
            };
          },
          submitPrompt: (text) => {
            if (busyRef.current) {
              return { accepted: false, reason: "loop is busy with a turn" };
            }
            const fn = handleSubmitRef.current;
            if (!fn) return { accepted: false, reason: "TUI not ready" };
            fn(text).catch(() => void 0);
            return { accepted: true };
          },
          abortTurn: () => {
            if (busyRef.current) loop2.abort();
          },
          isBusy: () => busyRef.current,
          getStats: () => {
            const s = loop2.stats.summary();
            const ctxCap = DEEPSEEK_CONTEXT_TOKENS[loop2.model] ?? DEFAULT_CONTEXT_TOKENS;
            return {
              turns: s.turns,
              totalCostUsd: s.totalCostUsd,
              lastTurnCostUsd: s.lastTurnCostUsd,
              totalInputCostUsd: s.totalInputCostUsd,
              totalOutputCostUsd: s.totalOutputCostUsd,
              cacheHitRatio: s.cacheHitRatio,
              lastPromptTokens: s.lastPromptTokens,
              contextCapTokens: ctxCap,
              // useSessionInfo's Balance is a flat { currency, total }; the
              // dashboard wire shape is the richer DeepSeek BalanceInfo
              // array (granted / topped_up split). Convert as a single-
              // entry array so the SPA always reads `balance[0]` shape.
              balance: balanceRef.current ? [
                {
                  currency: balanceRef.current.currency,
                  total_balance: String(balanceRef.current.total)
                }
              ] : null
            };
          },
          // ---------- Modal mirroring ----------
          getActiveModal: () => {
            const ps = pendingShell;
            if (ps) {
              return {
                kind: "shell",
                command: ps.command,
                allowPrefix: derivePrefix(ps.command),
                shellKind: ps.kind
              };
            }
            const pc = pendingChoice;
            if (pc) {
              return {
                kind: "choice",
                question: pc.question,
                options: pc.options,
                allowCustom: pc.allowCustom
              };
            }
            if (pendingPlanRef.current) {
              return { kind: "plan", body: pendingPlanRef.current };
            }
            const er = pendingEditReview;
            if (er) {
              return {
                kind: "edit-review",
                path: er.path,
                search: er.search ?? "",
                replace: er.replace ?? "",
                preview: (er.search || er.replace || "").split("\n").slice(0, 12).join("\n"),
                total: pendingEdits.current.length,
                remaining: pendingEdits.current.length
              };
            }
            if (pendingRevision) {
              return {
                kind: "revision",
                reason: pendingRevision.reason,
                remainingSteps: pendingRevision.remainingSteps.map((s) => ({
                  id: s.id,
                  title: s.title,
                  action: s.action,
                  ...s.risk ? { risk: s.risk } : {}
                })),
                ...pendingRevision.summary ? { summary: pendingRevision.summary } : {}
              };
            }
            const picker = activePickerSnapshotRef.current;
            if (picker) {
              return { kind: "picker", ...picker };
            }
            const viewer = activeViewerSnapshotRef.current;
            if (viewer) {
              return { kind: "viewer", ...viewer };
            }
            return null;
          },
          resolveShellConfirm: (choice) => {
            const fn = handleShellConfirmRef.current;
            if (fn) Promise.resolve(fn(choice)).catch(() => void 0);
          },
          resolveChoiceConfirm: (choice) => {
            const fn = handleChoiceConfirmRef.current;
            if (fn) fn(choice).catch(() => void 0);
          },
          resolvePlanConfirm: (choice, text) => {
            if (choice === "cancel") {
              handlePlanConfirmRef.current("cancel").catch(() => void 0);
              return;
            }
            const plan2 = pendingPlanRef.current ?? "";
            handleStagedInputSubmitRef.current(text ?? "", { plan: plan2, mode: choice }).catch(() => void 0);
          },
          resolveEditReview: (choice) => {
            const resolve2 = editReviewResolveRef.current;
            if (resolve2) {
              editReviewResolveRef.current = null;
              setPendingEditReview(null);
              resolve2({ choice, denyContext: void 0 });
            }
          },
          resolveCheckpointConfirm: (choice, text) => {
            if (choice === "revise" && typeof text === "string") {
              const snap = pendingCheckpoint;
              setPendingCheckpoint(null);
              if (!snap) return;
              Promise.resolve(handleCheckpointReviseSubmitRef.current(text, snap)).catch(
                () => void 0
              );
              return;
            }
            Promise.resolve(handleCheckpointConfirmRef.current(choice)).catch(() => void 0);
          },
          resolveReviseConfirm: (choice) => {
            Promise.resolve(handleReviseConfirmRef.current(choice)).catch(() => void 0);
          },
          resolvePicker: (resolution) => {
            const fn = activePickerResolverRef.current;
            if (fn) Promise.resolve(fn(resolution)).catch(() => void 0);
          },
          resolveViewer: () => {
            const fn = activeViewerResolverRef.current;
            if (fn) Promise.resolve(fn()).catch(() => void 0);
          },
          // ---------- v0.14 mutation surface ----------
          reloadHooks: () => reloadHooks(codeMode ? currentRootDirRef.current : void 0),
          addToolToPrefix: (spec) => loop2.prefix.addTool(spec),
          reloadMcp: mcpRuntime ? async () => {
            const r = await mcpRuntime.reloadFromConfig(loop2);
            setLiveMcpServers(r.summaries);
            return r.summaries.length;
          } : void 0
        },
        { port: dashboardPort }
      );
      dashboardRef.current = handle;
      setDashboardUrlState(handle.url);
      return handle.url;
    })();
    dashboardStartingRef.current = startup;
    try {
      return await startup;
    } finally {
      dashboardStartingRef.current = null;
    }
  }, [
    loop2,
    tools,
    liveMcpServers,
    codeMode,
    session,
    togglePlanMode,
    pendingShell,
    pendingChoice,
    pendingCheckpoint,
    pendingEditReview,
    pendingRevision,
    agentStore,
    mcpRuntime,
    getLoopStatus,
    startLoop,
    stopLoop,
    pendingEdits,
    editModeRef,
    setEditMode,
    currentRootDirRef,
    reloadHooks,
    setPreset,
    dashboardPort
  ]);
  const stopDashboard = useCallback13(async () => {
    const h = dashboardRef.current;
    if (!h) return;
    dashboardRef.current = null;
    setDashboardUrlState(null);
    try {
      await h.close();
    } catch {
    }
    log.pushInfo(t("app.dashboardStopped"));
  }, [log]);
  const getDashboardUrl = useCallback13(() => {
    return dashboardRef.current?.url ?? null;
  }, []);
  const [dashboardUrl, setDashboardUrlState] = useState29(null);
  useEffect17(() => {
    if (noDashboard) return;
    if (dashboardRef.current) return;
    startDashboard().catch((err) => {
      const reason = err instanceof Error ? err.message : String(err);
      log.pushInfo(t("ui.dashboardAutoStartFailed", { reason }));
    });
  }, [noDashboard, startDashboard, log]);
  useEffect17(() => {
    return () => {
      const h = dashboardRef.current;
      if (h) {
        dashboardRef.current = null;
        h.close().catch(() => void 0);
      }
    };
  }, []);
  const handleWalkChoice = useCallback13(
    (choice) => {
      if (choice === "apply") {
        log.pushInfo(codeApply([1]));
      } else if (choice === "reject") {
        log.pushInfo(codeDiscard([1]));
      } else if (choice === "apply-rest-of-turn") {
        log.pushInfo(codeApply());
        setWalkthroughActive(false);
        return;
      } else if (choice === "flip-to-auto") {
        setEditMode("auto");
        saveEditMode("auto");
        log.pushInfo(codeApply([1]));
        log.pushInfo(t("app.flippedAutoWalk"));
        setWalkthroughActive(false);
        return;
      }
      if (pendingEdits.current.length === 0) setWalkthroughActive(false);
    },
    [codeApply, codeDiscard, log, pendingEdits, setEditMode]
  );
  const handleSubmit = useCallback13(
    async (raw) => {
      let text = raw.trim();
      if (!text) return;
      if (isLoopActive() && !isLoopFiring()) {
        stopLoop();
      }
      clearFiringFlag();
      if (busy) return;
      if (atState && atState.entries.length > 0) {
        const sel = atState.entries[atSelected] ?? atState.entries[0];
        if (sel) {
          pickAtMention(sel, "commit");
          return;
        }
      }
      if (slashArgMatches && slashArgMatches.length > 0 && slashArgContext) {
        const sel = slashArgMatches[slashArgSelected] ?? slashArgMatches[0];
        if (sel) {
          pickSlashArg(sel);
          return;
        }
      }
      if (text.startsWith("/") && !text.includes(" ")) {
        const typed = text.slice(1).toLowerCase();
        const matches = suggestSlashCommands(typed, !!codeMode, slashUsage);
        const exact = matches.find((m) => m.cmd === typed);
        if (!exact && matches.length > 0) {
          const chosen = matches[slashSelected] ?? matches[0];
          if (chosen) text = `/${chosen.cmd}`;
        }
      }
      setInput("");
      resetCursor();
      if (codeMode && pendingEdits.current.length > 0 && (text === "y" || text === "n")) {
        log.pushInfo(text === "y" ? codeApply() : codeDiscard());
        pushHistory(text);
        return;
      }
      const hashParse = detectHashMemory(text);
      if (hashParse?.kind === "memory" || hashParse?.kind === "memory-global") {
        const isGlobal = hashParse.kind === "memory-global";
        const memRoot = currentRootDir;
        pushHistory(text);
        try {
          const result = isGlobal ? appendGlobalMemory(hashParse.note) : appendProjectMemory(memRoot, hashParse.note);
          const verb = result.created ? t("app.notedVerbCreated") : t("app.notedVerbAppended");
          const scopeTag = isGlobal ? t("app.notedScopeGlobal") : t("app.notedScopeProject");
          log.pushInfo(t("app.notedMemory", { scope: scopeTag, verb, path: result.path }));
        } catch (err) {
          log.pushWarning(t("app.memoryWriteFailed"), err.message);
        }
        return;
      }
      if (hashParse?.kind === "escape") {
        text = hashParse.text;
      }
      const bangCmd = detectBangCommand(text);
      if (bangCmd !== null) {
        const bangRoot = currentRootDir;
        pushHistory(text);
        log.pushUser(text);
        setBusy(true);
        try {
          const result = await runCommand(bangCmd, {
            cwd: bangRoot,
            timeoutSec: 60,
            maxOutputChars: 32e3
          });
          const formatted = formatCommandResult(bangCmd, result);
          log.pushInfo(formatted);
          loop2.appendAndPersist({
            role: "user",
            content: formatBangUserMessage(bangCmd, formatted)
          });
        } catch (err) {
          log.pushWarning(t("app.commandFailed"), err.message);
        } finally {
          setBusy(false);
        }
        return;
      }
      const btwMatch = /^\/btw(?:\s+([\s\S]+))?$/.exec(text);
      if (btwMatch) {
        const question = btwMatch[1]?.trim() ?? "";
        pushHistory(text);
        log.pushUser(text);
        if (!question) {
          log.pushInfo(t("app.btwUsage"));
          return;
        }
        setBusy(true);
        try {
          const reply = await loop2.client.chat({
            model: loop2.model,
            messages: [
              {
                role: "system",
                content: "You are answering a side question that is unrelated to the current coding conversation. Answer concisely (1-3 sentences) in plain prose. Do not call tools, do not ask clarifying questions, and do not reference any prior turns."
              },
              { role: "user", content: question }
            ]
          });
          const answer = reply.content.trim() || "(no answer)";
          log.pushInfo(`${t("app.btwHeader")}
${answer}`, "brand");
        } catch (err) {
          log.pushWarning(t("app.btwFailed"), err.message);
        } finally {
          setBusy(false);
        }
        return;
      }
      const mcpBrowseMatch = /^\/(resource|prompt)(?:\s+([\s\S]*))?$/.exec(text);
      if (mcpBrowseMatch) {
        const kind = mcpBrowseMatch[1];
        const arg = mcpBrowseMatch[2]?.trim() ?? "";
        pushHistory(text);
        log.pushUser(text);
        await handleMcpBrowseSlash(kind, arg, liveMcpServers, log);
        return;
      }
      const slash = parseSlash(text);
      if (slash) {
        const sink = eventSinkRef.current;
        const eventizer = eventizerRef.current;
        if (sink && eventizer) {
          sink.append(
            eventizer.emitSlashInvoked(loop2.currentTurn, slash.cmd, slash.args.join(" "))
          );
        }
        setSlashUsage(recordSlashUse(slash.cmd));
        const result = handleSlash(slash.cmd, slash.args, loop2, {
          mcpSpecs,
          mcpServers: liveMcpServers,
          codeUndo: codeMode ? codeUndo : void 0,
          codeApply: codeMode ? codeApply : void 0,
          codeDiscard: codeMode ? codeDiscard : void 0,
          codeHistory: codeMode ? codeHistory : void 0,
          codeShowEdit: codeMode ? codeShowEdit : void 0,
          codeRoot: codeMode ? currentRootDir : void 0,
          pendingEditCount: codeMode ? pendingEdits.current.length : void 0,
          memoryRoot: currentRootDir,
          planMode,
          setPlanMode: codeMode ? togglePlanMode : void 0,
          editMode: codeMode ? editMode : void 0,
          setEditMode: codeMode ? setEditMode : void 0,
          touchedFiles: codeMode ? () => {
            const set = new Set(touchedPaths());
            for (const b of pendingEdits.current) set.add(b.path);
            return [...set];
          } : void 0,
          armPro: () => {
            loop2.armProForNextTurn();
            setProArmed(true);
          },
          disarmPro: () => {
            loop2.disarmPro();
            setProArmed(false);
          },
          startLoop,
          stopLoop,
          getLoopStatus,
          startWalkthrough: codeMode ? startWalkthrough : void 0,
          startDashboard,
          stopDashboard,
          getDashboardUrl,
          sessionId: session,
          jobs: codeMode?.jobs,
          postInfo: (text2) => log.pushInfo(text2),
          postDoctor: (checks) => log.showDoctor(checks),
          postUsage: (args) => log.showUsageVerbose(args),
          postKeys: (args) => log.pushTip({
            topic: args.topic,
            sections: args.sections,
            footer: args.footer,
            oneTime: false
          }),
          dispatch: agentStore.dispatch,
          markPlanStepDone: (stepId) => {
            const steps = planStepsRef.current;
            if (!steps || steps.length === 0) return "no-plan";
            if (!steps.some((s) => s.id === stepId)) return "not-in-plan";
            if (completedStepIdsRef.current.has(stepId)) return "already-done";
            completedStepIdsRef.current.add(stepId);
            persistPlanState();
            log.completePlanStep(stepId);
            return "ok";
          },
          markAllPlanStepsDone: () => {
            const steps = planStepsRef.current;
            if (!steps || steps.length === 0) return 0;
            let added = 0;
            for (const s of steps) {
              if (completedStepIdsRef.current.has(s.id)) continue;
              completedStepIdsRef.current.add(s.id);
              log.completePlanStep(s.id);
              added++;
            }
            if (added > 0) persistPlanState();
            return added;
          },
          reloadHooks: () => reloadHooks(codeMode ? currentRootDir : void 0),
          switchCwd: codeMode?.reregisterTools ? (newPath) => {
            const resolved = resolve(newPath);
            let stat;
            try {
              stat = statSync(resolved);
            } catch (err) {
              return { ok: false, info: `/cwd: ${err.message}` };
            }
            if (!stat.isDirectory()) {
              return { ok: false, info: `/cwd: ${resolved} is not a directory` };
            }
            codeMode.reregisterTools?.(resolved);
            setCurrentRootDir(resolved);
            reloadHooks(resolved);
            const reBootstrap = codeMode.reBootstrapSemantic;
            if (reBootstrap) {
              void reBootstrap(resolved).then(
                (r) => {
                  log.pushInfo(
                    r.enabled ? `\u25B8 semantic_search re-pointed at ${resolved}` : `\u25B8 semantic_search disabled (no compatible index in ${resolved})`
                  );
                },
                (err) => {
                  log.pushInfo(
                    `\u25B8 semantic_search re-bootstrap failed: ${err.message}`
                  );
                }
              );
            }
            return { ok: true, info: `\u25B8 workspace switched to ${resolved}` };
          } : void 0,
          reloadMcp: mcpRuntime ? async () => {
            const r = await mcpRuntime.reloadFromConfig(loop2);
            setLiveMcpServers(r.summaries);
            return r;
          } : void 0,
          latestVersion,
          refreshLatestVersion,
          models,
          refreshModels
        });
        if (result.openSessionsPicker) {
          setSessionsPickerList(listSessionsForWorkspace(currentRootDir));
          setPendingSessionsPicker(true);
          pushHistory(text);
          return;
        }
        if (result.openCheckpointPicker) {
          if (!codeMode) {
            log.pushInfo(t("app.restoreCodeOnly"));
            pushHistory(text);
            return;
          }
          setCheckpointPickerList([...listCheckpoints(currentRootDir)].reverse());
          setPendingCheckpointPicker(true);
          pushHistory(text);
          return;
        }
        if (result.openMcpHub) {
          setPendingMcpHub({ tab: result.openMcpHub.tab });
          pushHistory(text);
          return;
        }
        if (result.openModelPicker) {
          setPendingModelPicker(true);
          pushHistory(text);
          return;
        }
        if (result.openThemePicker) {
          setPendingThemePicker(true);
          pushHistory(text);
          return;
        }
        if (result.openCopyMode) {
          setPendingCopyMode(true);
          pushHistory(text);
          return;
        }
        if (result.openArgPickerFor) {
          pushHistory(text);
          setInput(`/${result.openArgPickerFor} `);
          return;
        }
        if (result.replayPlan) {
          const rp = result.replayPlan;
          const titleSuffix = rp.summary ? ` \u2014 ${rp.summary}` : "";
          const done = new Set(rp.completedStepIds);
          setPendingReplayViewer({
            viewerKind: "replay-plan",
            title: `Replay #${rp.index}/${rp.total} \xB7 ${rp.relativeTime}${titleSuffix}`,
            body: rp.body,
            steps: rp.steps.map((s) => ({
              id: s.id,
              title: s.title,
              status: done.has(s.id) ? "done" : "queued"
            })),
            meta: rp.archiveBasename
          });
        }
        const outcome = applySlashResult(result, {
          log,
          stdoutWrite: (chunk) => stdout?.write(chunk),
          pendingEdits,
          syncPendingCount,
          session: session ?? null,
          codeModeOn: !!codeMode,
          isLoopActive,
          stopLoop,
          quitProcess,
          pushHistory,
          resetPendingModals,
          text
        });
        if (outcome.kind === "resubmit") {
          text = outcome.text;
        } else {
          return;
        }
      }
      if (hookList.some((h) => h.event === "UserPromptSubmit")) {
        const promptReport = await runHooks({
          hooks: hookList,
          payload: { event: "UserPromptSubmit", cwd: currentRootDir, prompt: text }
        });
        for (const o of promptReport.outcomes) {
          if (o.decision === "pass") continue;
          log.pushWarning(t("app.hookUserPromptSubmit"), formatHookOutcomeMessage(o));
        }
        if (promptReport.blocked) return;
      }
      pushHistory(text);
      const pasteDisplay = formatLongPaste(text);
      const userId = log.pushUser(pasteDisplay.displayText);
      broadcastDashboardEvent({ kind: "user", id: userId, text });
      if (session) {
        const existing = loadSessionMeta(session);
        const patch = {};
        if (!existing.summary) patch.summary = text.replace(/\s+/g, " ").slice(0, 80);
        if (!existing.branch) patch.branch = detectGitBranch(currentRootDir);
        if (!existing.workspace) patch.workspace = currentRootDir;
        if (Object.keys(patch).length > 0) patchSessionMeta(session, patch);
      }
      const assistantId = `a-${Date.now()}`;
      const streamRef = { id: assistantId, text: "", reasoning: "" };
      const contentBuf = { current: "" };
      const reasoningBuf = { current: "" };
      const translator = new TurnTranslator(log);
      const toolCallBuildBuf = {
        current: null
      };
      setBusy(true);
      abortedThisTurn.current = false;
      if (codeMode) sealCurrentEntry();
      turnEditPolicyRef.current = "ask";
      if (proArmed) {
        setProArmed(false);
        setTurnOnPro(true);
      } else {
        setTurnOnPro(false);
      }
      const flush = () => {
        if (!contentBuf.current && !reasoningBuf.current && !toolCallBuildBuf.current) return;
        translator.flushBuffers(reasoningBuf.current, contentBuf.current, loop2.currentCallModel);
        streamRef.text += contentBuf.current;
        streamRef.reasoning += reasoningBuf.current;
        if (toolCallBuildBuf.current) {
          streamRef.toolCallBuild = toolCallBuildBuf.current;
        }
        contentBuf.current = "";
        reasoningBuf.current = "";
        toolCallBuildBuf.current = null;
      };
      const timer = setInterval(flush, FLUSH_INTERVAL_MS);
      let modelInput = text;
      if (codeMode) {
        const expanded = expandAtMentions(text, currentRootDir);
        if (expanded.expansions.length > 0) {
          modelInput = expanded.text;
          const inlined = expanded.expansions.filter((ex) => ex.ok).map((ex) => {
            if (ex.isDirectory) {
              const trunc = ex.truncated ? "+" : "";
              return `${ex.path}/ (${ex.entries ?? 0}${trunc} entries)`;
            }
            return `${ex.path} (${(ex.bytes ?? 0).toLocaleString()} bytes)`;
          });
          const skipped = expanded.expansions.filter((ex) => !ex.ok).map((ex) => `${ex.path} (${ex.skip})`);
          const parts = [];
          if (inlined.length > 0) parts.push(`inlined ${inlined.join(", ")}`);
          if (skipped.length > 0) parts.push(`skipped ${skipped.join(", ")}`);
          if (parts.length > 0) log.pushInfo(t("app.atMentions", { parts: parts.join("; ") }));
        }
      }
      if (/(?:^|\s)@https?:\/\//.test(text)) {
        try {
          const urlExpanded = await expandAtUrls(modelInput, {
            fetcher: webFetch,
            cache: atUrlCache.current
          });
          if (urlExpanded.expansions.length > 0) {
            modelInput = urlExpanded.text;
            const inlined = urlExpanded.expansions.filter((ex) => ex.ok).map((ex) => {
              const tag2 = ex.title ? `${ex.title} (${ex.url})` : ex.url;
              const trunc = ex.truncated ? " \xB7 truncated" : "";
              return `${tag2} \xB7 ${(ex.chars ?? 0).toLocaleString()} chars${trunc}`;
            });
            const skipped = urlExpanded.expansions.filter((ex) => !ex.ok).map((ex) => `${ex.url} (${ex.skip ?? "fetch-error"})`);
            const parts = [];
            if (inlined.length > 0) parts.push(`inlined ${inlined.join("; ")}`);
            if (skipped.length > 0) parts.push(`skipped ${skipped.join("; ")}`);
            if (parts.length > 0) log.pushInfo(t("app.atUrl", { parts: parts.join("; ") }));
          }
        } catch (err) {
          log.pushWarning(t("app.atUrlFailed"), err.message);
        }
      }
      try {
        for await (const ev of loop2.step(modelInput)) {
          writeTranscript(ev);
          {
            const sink = eventSinkRef.current;
            const eventizer = eventizerRef.current;
            if (sink && eventizer) {
              const ctx = {
                model: ev.stats?.model ?? loop2.model ?? model2,
                prefixHash,
                reasoningEffort: loop2.reasoningEffort ?? "max"
              };
              for (const out of eventizer.consume(ev, ctx)) sink.append(out);
            }
          }
          if (eventSubscribersRef.current.size > 0) {
            const dashMsg = loopEventToDashboard(ev, { assistantId });
            if (dashMsg) broadcastDashboardEvent(dashMsg);
          }
          if (ev.role !== "status") {
            setStatusLine((cur) => cur ? null : cur);
          }
          if (ev.role === "status") {
            setStatusLine(ev.content);
          } else if (ev.role === "assistant_delta") {
            if (ev.content) contentBuf.current += ev.content;
            if (ev.reasoningDelta) reasoningBuf.current += ev.reasoningDelta;
          } else if (ev.role === "tool_call_delta") {
            if (ev.toolName) {
              toolCallBuildBuf.current = {
                name: ev.toolName,
                chars: ev.toolCallArgsChars ?? 0,
                index: ev.toolCallIndex,
                readyCount: ev.toolCallReadyCount
              };
            }
          } else if (ev.role === "assistant_final") {
            handleAssistantFinal(ev, {
              flush,
              translator,
              streamRef,
              contentBuf,
              reasoningBuf,
              toolCallBuildBuf,
              assistantId,
              setSummary,
              log,
              broadcastDashboardEvent,
              getSessionSummary: () => loop2.stats.summary(),
              session: session ?? null,
              assistantIterCounter,
              codeModeOn: !!codeMode,
              currentRootDir,
              editModeRef,
              recordEdit,
              armUndoBanner,
              pendingEdits,
              syncPendingCount,
              ctxMax: DEEPSEEK_CONTEXT_TOKENS[loop2.model] ?? DEFAULT_CONTEXT_TOKENS
            });
            if (session) {
              const m = loadSessionMeta(session);
              const cost2 = (m.totalCostUsd ?? 0) + (ev.stats?.cost ?? 0);
              const turn = (m.turnCount ?? 0) + 1;
              const currency = walletCurrencyRef.current;
              const u = ev.stats?.usage;
              const cacheHitTokens = (m.cacheHitTokens ?? 0) + (u?.promptCacheHitTokens ?? 0);
              const cacheMissTokens = (m.cacheMissTokens ?? 0) + (u?.promptCacheMissTokens ?? 0);
              patchSessionMeta(session, {
                totalCostUsd: cost2,
                turnCount: turn,
                cacheHitTokens,
                cacheMissTokens,
                ...u?.promptTokens ? { lastPromptTokens: u.promptTokens } : {},
                ...currency ? { balanceCurrency: currency } : {}
              });
            }
          } else if (ev.role === "tool_start") {
            handleToolStart(ev, {
              setOngoingTool,
              setToolProgress,
              toolStartedAtRef,
              translator,
              codeModeOn: !!codeMode,
              recordRecentFile
            });
          } else if (ev.role === "tool") {
            handleToolEvent(ev, {
              flush,
              translator,
              setOngoingTool,
              setToolProgress,
              toolStartedAtRef,
              setPendingShell,
              setPendingPlan,
              setPendingRevision,
              setPendingChoice,
              planStepsRef,
              completedStepIdsRef,
              planBodyRef,
              planSummaryRef,
              persistPlanState,
              log,
              session: session ?? null,
              codeModeOn: !!codeMode
            });
          } else if (ev.role === "error") {
            handleErrorEvent(ev, {
              log,
              setOngoingTool,
              setToolProgress,
              toolStartedAtRef,
              translator
            });
          } else if (ev.role === "warning") {
            handleWarningEvent(ev, { log, setTurnOnPro });
          }
        }
        flush();
        if (hookList.some((h) => h.event === "Stop")) {
          const stopReport = await runHooks({
            hooks: hookList,
            payload: {
              event: "Stop",
              cwd: currentRootDir,
              lastAssistantText: streamRef.text,
              turn: loop2.stats.summary().turns
            }
          });
          for (const o of stopReport.outcomes) {
            if (o.decision === "pass") continue;
            log.pushWarning(t("app.hookStop"), formatHookOutcomeMessage(o));
          }
        }
      } finally {
        clearInterval(timer);
        if (abortedThisTurn.current) {
          translator.abort();
        }
        clearToolProgressDisplay();
        setSummary(loop2.stats.summary());
        setBusy(false);
        setTurnOnPro(false);
        refreshBalance();
      }
    },
    [
      busy,
      codeApply,
      codeDiscard,
      codeHistory,
      codeMode,
      codeShowEdit,
      codeUndo,
      currentRootDir,
      quitProcess,
      hookList,
      loop2,
      latestVersion,
      mcpSpecs,
      liveMcpServers,
      models,
      planMode,
      session,
      slashSelected,
      slashUsage,
      atState,
      atSelected,
      pickAtMention,
      recordRecentFile,
      slashArgMatches,
      slashArgContext,
      slashArgSelected,
      pickSlashArg,
      togglePlanMode,
      writeTranscript,
      recordEdit,
      armUndoBanner,
      sealCurrentEntry,
      editMode,
      editModeRef,
      setEditMode,
      pendingEdits,
      syncPendingCount,
      setCurrentRootDir,
      reloadHooks,
      setOngoingTool,
      setToolProgress,
      setStatusLine,
      clearToolProgressDisplay,
      refreshBalance,
      refreshLatestVersion,
      refreshModels,
      proArmed,
      setProArmed,
      setTurnOnPro,
      persistPlanState,
      stdout,
      stopLoop,
      startLoop,
      getLoopStatus,
      isLoopActive,
      isLoopFiring,
      clearFiringFlag,
      startWalkthrough,
      startDashboard,
      stopDashboard,
      getDashboardUrl,
      broadcastDashboardEvent,
      touchedPaths,
      model2,
      prefixHash,
      log,
      agentStore.dispatch,
      mcpRuntime,
      pushHistory,
      resetCursor
    ]
  );
  useEffect17(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);
  const handleShellConfirm = useCallback13(
    (choice, denyContext) => {
      const pending = pendingShell;
      if (!pending || !codeMode) return;
      const { id, command: cmd, kind } = pending;
      setPendingShell(null);
      if (choice === "deny") {
        const context2 = denyContext ? ` because: ${denyContext}` : "";
        log.pushInfo(t("app.denied", { cmd, context: context2 }));
        pauseGate.resolve(id, { type: "deny", denyContext });
      } else if (choice === "always_allow") {
        const prefix = derivePrefix(cmd);
        log.pushInfo(t("app.alwaysAllowed", { prefix, dir: currentRootDir }));
        pauseGate.resolve(id, { type: "always_allow", prefix });
      } else {
        log.pushInfo(
          kind === "run_background" ? t("app.startingBackground", { cmd }) : t("app.runningCommand", { cmd })
        );
        pauseGate.resolve(id, { type: "run_once" });
      }
    },
    [pendingShell, codeMode, currentRootDir, log]
  );
  const handlePathConfirm = useCallback13(
    (choice, denyContext) => {
      const pending = pendingPath;
      if (!pending) return;
      const { id, allowPrefix } = pending;
      setPendingPath(null);
      if (choice === "deny") {
        pauseGate.resolve(id, { type: "deny", denyContext });
      } else if (choice === "always_allow") {
        pauseGate.resolve(id, { type: "always_allow", prefix: allowPrefix });
      } else {
        pauseGate.resolve(id, { type: "run_once" });
      }
    },
    [pendingPath]
  );
  const pendingGateIdRef = useRef10(null);
  const resetPendingModals = useCallback13(() => {
    const editResolve = editReviewResolveRef.current;
    if (editResolve) {
      editReviewResolveRef.current = null;
      setPendingEditReview(null);
      editResolve({ choice: "reject" });
    }
    setPendingShell(null);
    setPendingPath(null);
    setPendingPlan(null);
    setPendingCheckpoint(null);
    setPendingRevision(null);
    setPendingChoice(null);
    setStagedInput(null);
    setStagedChoiceCustom(null);
    setStagedCheckpointRevise(null);
    pendingGateIdRef.current = null;
    pauseGate.cancelAll();
  }, []);
  useEffect17(() => {
    if (!busy && queuedSubmit !== null) {
      const text = queuedSubmit;
      setQueuedSubmit(null);
      void handleSubmit(text);
    }
  }, [busy, queuedSubmit, handleSubmit]);
  const handlePlanConfirm = useCallback13(
    async (choice) => {
      const hadPendingPlan = pendingPlan !== null;
      if (!hadPendingPlan && choice !== "approve") {
        return;
      }
      if (choice === "refine" || choice === "approve") {
        if (pendingPlan) {
          const questions = extractOpenQuestionsSection(pendingPlan) ?? void 0;
          setStagedInput({ plan: pendingPlan, mode: choice, questions });
          setPendingPlan(null);
        } else if (choice === "approve") {
          setStagedInput({ plan: "", mode: "approve" });
        }
        return;
      }
      if (choice === "revise") {
        if (pendingPlan) {
          setPendingReviseEditor(pendingPlan);
          setPendingPlan(null);
        }
        return;
      }
      if (pendingPlan) {
        const questions = extractOpenQuestionsSection(pendingPlan) ?? void 0;
        setStagedInput({ plan: pendingPlan, mode: "reject", questions });
        setPendingPlan(null);
      }
    },
    [pendingPlan]
  );
  const handlePlanConfirmRef = useRef10(handlePlanConfirm);
  useEffect17(() => {
    handlePlanConfirmRef.current = handlePlanConfirm;
  }, [handlePlanConfirm]);
  const stableHandlePlanConfirm = useCallback13(
    async (choice) => handlePlanConfirmRef.current(choice),
    []
  );
  const handleStagedInputSubmit = useCallback13(
    async (feedback2, override) => {
      const staged = override ?? stagedInput;
      if (override) {
        setPendingPlan(null);
      } else {
        setStagedInput(null);
      }
      if (!staged) return;
      const trimmed = feedback2.trim();
      const tail = trimmed.length > 50 ? `${trimmed.slice(0, 50)}\u2026` : trimmed;
      let marker;
      if (staged.mode === "approve") {
        togglePlanMode(false);
        const approvedSteps = planStepsRef.current;
        if (approvedSteps && approvedSteps.length > 0) {
          completedStepIdsRef.current = /* @__PURE__ */ new Set();
          log.showPlan({
            title: planSummaryRef.current ?? "plan",
            steps: approvedSteps.map((s) => ({
              id: s.id,
              title: s.title,
              status: "queued"
            })),
            variant: "active"
          });
          persistPlanState();
        }
        marker = trimmed ? `\u25B8 plan approved + instructions \u2014 ${tail}` : "\u25B8 plan approved \u2014 implementing";
      } else if (staged.mode === "reject") {
        planStepsRef.current = null;
        completedStepIdsRef.current = /* @__PURE__ */ new Set();
        planBodyRef.current = null;
        planSummaryRef.current = null;
        persistPlanState();
        togglePlanMode(false);
        agentStore.dispatch({ type: "plan.drop" });
        marker = trimmed ? `\u25B8 plan rejected \u2014 ${tail}` : "\u25B8 plan cancelled";
      } else {
        marker = trimmed ? `\u25B8 refining \u2014 ${tail}` : "\u25B8 refining \u2014 using safe defaults";
      }
      log.pushInfo(marker);
      const gateId = pendingGateIdRef.current;
      if (gateId !== null) {
        const fb = trimmed || void 0;
        if (staged.mode === "approve") {
          pauseGate.resolve(gateId, { type: "approve", feedback: fb });
        } else if (staged.mode === "reject") {
          pauseGate.resolve(gateId, { type: "cancel", feedback: fb });
        } else {
          pauseGate.resolve(gateId, { type: "refine", feedback: fb });
        }
      }
    },
    [stagedInput, togglePlanMode, persistPlanState, agentStore, log]
  );
  const handleStagedInputSubmitRef = useRef10(handleStagedInputSubmit);
  useEffect17(() => {
    handleStagedInputSubmitRef.current = handleStagedInputSubmit;
  }, [handleStagedInputSubmit]);
  const handleStagedInputCancel = useCallback13(() => {
    if (stagedInput?.plan) setPendingPlan(stagedInput.plan);
    setStagedInput(null);
  }, [stagedInput]);
  const handleChoiceConfirm = useCallback13(
    async (choice) => {
      const snap = pendingChoice;
      if (!snap) return;
      setPendingChoice(null);
      if (choice.kind === "custom") {
        setStagedChoiceCustom(snap);
        return;
      }
      const gateId = pendingGateIdRef.current;
      if (choice.kind === "cancel") {
        if (gateId !== null) pauseGate.resolve(gateId, { type: "cancel" });
        return;
      }
      const picked = snap.options.find((o) => o.id === choice.optionId);
      if (gateId !== null) {
        pauseGate.resolve(gateId, { type: "pick", optionId: choice.optionId });
      }
    },
    [pendingChoice]
  );
  const handleShellConfirmRef = useRef10(handleShellConfirm);
  useEffect17(() => {
    handleShellConfirmRef.current = handleShellConfirm;
  }, [handleShellConfirm]);
  useEffect17(() => {
    return pauseGate.on((request) => {
      const payload = request.payload;
      pendingGateIdRef.current = request.id;
      chatScroll.jumpToBottom();
      switch (request.kind) {
        case "run_command":
        case "run_background": {
          const p = payload;
          setPendingShell({
            id: request.id,
            command: p.command,
            kind: request.kind,
            cwd: p.cwd,
            timeoutSec: p.timeoutSec,
            waitSec: p.waitSec
          });
          break;
        }
        case "path_access": {
          const p = payload;
          setPendingPath({
            id: request.id,
            path: p.path,
            intent: p.intent,
            toolName: p.toolName,
            sandboxRoot: p.sandboxRoot,
            allowPrefix: p.allowPrefix
          });
          break;
        }
        case "plan_proposed": {
          const p = payload;
          setPendingPlan(p.plan);
          planStepsRef.current = p.steps ?? null;
          planSummaryRef.current = p.summary ?? null;
          planBodyRef.current = p.plan;
          break;
        }
        case "plan_checkpoint": {
          const p = payload;
          const completed = completedStepIdsRef.current.size;
          const total = planStepsRef.current?.length ?? 0;
          if (shouldAutoResolveCheckpoint(editModeRef.current)) {
            handleAutoCheckpointContinueRef.current(p.stepId, p.title);
            pauseGate.resolve(request.id, { type: "continue" });
            break;
          }
          setPendingCheckpoint({
            stepId: p.stepId,
            title: p.title,
            completed,
            total
          });
          break;
        }
        case "plan_revision": {
          const p = payload;
          setPendingRevision({
            reason: p.reason,
            remainingSteps: p.remainingSteps,
            summary: p.summary
          });
          break;
        }
        case "choice": {
          const p = payload;
          setPendingChoice({
            question: p.question,
            options: p.options,
            allowCustom: p.allowCustom
          });
          break;
        }
      }
    });
  }, []);
  const pendingPlanRef = useRef10(null);
  useEffect17(() => {
    pendingPlanRef.current = pendingPlan;
  }, [pendingPlan]);
  const handleChoiceConfirmRef = useRef10(handleChoiceConfirm);
  useEffect17(() => {
    handleChoiceConfirmRef.current = handleChoiceConfirm;
  }, [handleChoiceConfirm]);
  const stableHandleChoiceConfirm = useCallback13(
    async (choice) => handleChoiceConfirmRef.current(choice),
    []
  );
  const handleCheckpointConfirm = useCallback13(
    (choice) => {
      const snap = pendingCheckpoint;
      if (!snap) return;
      setPendingCheckpoint(null);
      const gid = pendingGateIdRef.current;
      if (choice === "revise") {
        setStagedCheckpointRevise(snap);
        return;
      }
      if (codeMode && choice === "continue") {
        const paths = touchedPaths();
        if (paths.length > 0) {
          try {
            const cpName = snap.title ? `${snap.stepId} \xB7 ${snap.title}` : snap.stepId;
            const meta = createCheckpoint({
              rootDir: codeMode.rootDir,
              name: cpName.slice(0, 60),
              paths,
              source: "auto-pre-restore"
            });
            log.pushInfo(
              t("app.checkpointSaved", {
                id: meta.id,
                count: meta.fileCount,
                s: meta.fileCount === 1 ? "" : "s"
              })
            );
          } catch {
          }
        }
      }
      if (gid !== null) {
        pauseGate.resolve(gid, {
          type: choice === "continue" ? "continue" : "stop"
        });
      }
      const label = snap.title ? `${snap.stepId} \xB7 ${snap.title}` : snap.stepId;
      const counter = snap.total > 0 ? ` (${snap.completed}/${snap.total})` : "";
      log.pushInfo(
        choice === "continue" ? t("app.continuingAfter", { label, counter }) : t("app.planStoppedAt", { label, counter })
      );
    },
    [pendingCheckpoint, codeMode, touchedPaths, log]
  );
  const handleCheckpointConfirmRef = useRef10(handleCheckpointConfirm);
  useEffect17(() => {
    handleCheckpointConfirmRef.current = handleCheckpointConfirm;
  }, [handleCheckpointConfirm]);
  const handleAutoCheckpointContinue = useCallback13(
    (stepId, title) => {
      if (codeMode) {
        const paths = touchedPaths();
        if (paths.length > 0) {
          try {
            const cpName = title ? `${stepId} \xB7 ${title}` : stepId;
            createCheckpoint({
              rootDir: codeMode.rootDir,
              name: cpName.slice(0, 60),
              paths,
              source: "auto-pre-restore"
            });
          } catch {
          }
        }
      }
      const completed = completedStepIdsRef.current.size;
      const total = planStepsRef.current?.length ?? 0;
      const label = title ? `${stepId} \xB7 ${title}` : stepId;
      const counter = total > 0 ? ` (${completed}/${total})` : "";
      log.pushInfo(t("app.continuingAfter", { label, counter }));
    },
    [codeMode, touchedPaths, log]
  );
  const handleAutoCheckpointContinueRef = useRef10(handleAutoCheckpointContinue);
  useEffect17(() => {
    handleAutoCheckpointContinueRef.current = handleAutoCheckpointContinue;
  }, [handleAutoCheckpointContinue]);
  const stableHandleCheckpointConfirm = useCallback13(
    (choice) => handleCheckpointConfirmRef.current(choice),
    []
  );
  const handleCheckpointReviseSubmit = useCallback13(
    (feedback2, snapOverride) => {
      const snap = snapOverride;
      setStagedCheckpointRevise(null);
      if (!snap) return;
      const label = snap.title ? `${snap.stepId} \xB7 ${snap.title}` : snap.stepId;
      const trimmed = feedback2.trim();
      const gid = pendingGateIdRef.current;
      if (gid !== null) {
        pauseGate.resolve(
          gid,
          trimmed ? { type: "revise", feedback: trimmed } : { type: "revise" }
        );
      }
      const marker = trimmed ? t("app.revisingAfter", {
        label,
        feedback: trimmed.length > 50 ? `${trimmed.slice(0, 50)}\u2026` : trimmed
      }) : t("app.continuingAfter", { label, counter: "" });
      log.pushInfo(marker);
    },
    [log]
  );
  const handleCheckpointReviseCancel = useCallback13(() => {
    const snap = stagedCheckpointRevise;
    setStagedCheckpointRevise(null);
    if (snap) setPendingCheckpoint(snap);
  }, [stagedCheckpointRevise]);
  const handleCheckpointReviseSubmitRef = useRef10(handleCheckpointReviseSubmit);
  useEffect17(() => {
    handleCheckpointReviseSubmitRef.current = handleCheckpointReviseSubmit;
  }, [handleCheckpointReviseSubmit]);
  const handleChoiceCustomSubmit = useCallback13((answer) => {
    setStagedChoiceCustom(null);
    const trimmed = answer.trim();
    const gateId = pendingGateIdRef.current;
    if (gateId !== null) {
      pauseGate.resolve(gateId, { type: "text", text: trimmed || "" });
    }
  }, []);
  const handleChoiceCustomCancel = useCallback13(() => {
    const snap = stagedChoiceCustom;
    setStagedChoiceCustom(null);
    if (snap) setPendingChoice(snap);
  }, [stagedChoiceCustom]);
  const handleReviseConfirm = useCallback13(
    (choice) => {
      const snap = pendingRevision;
      if (!snap) return;
      setPendingRevision(null);
      const gateId = pendingGateIdRef.current;
      if (choice === "reject") {
        if (gateId !== null) pauseGate.resolve(gateId, { type: "rejected" });
        return;
      }
      const completed = completedStepIdsRef.current;
      const oldSteps = planStepsRef.current ?? [];
      const donePrefix = oldSteps.filter((s) => completed.has(s.id));
      const merged = [...donePrefix];
      for (const s of snap.remainingSteps) {
        if (completed.has(s.id)) continue;
        merged.push(s);
      }
      planStepsRef.current = merged;
      persistPlanState();
      agentStore.dispatch({ type: "plan.drop" });
      log.showPlan({
        title: planSummaryRef.current ?? "plan",
        steps: merged.map((s) => ({
          id: s.id,
          title: s.title,
          status: completed.has(s.id) ? "done" : "queued"
        })),
        variant: "active"
      });
      if (gateId !== null) pauseGate.resolve(gateId, { type: "accepted" });
    },
    [pendingRevision, persistPlanState, agentStore, log]
  );
  const handleReviseConfirmRef = useRef10(handleReviseConfirm);
  useEffect17(() => {
    handleReviseConfirmRef.current = handleReviseConfirm;
  }, [handleReviseConfirm]);
  const stableHandleReviseConfirm = useCallback13(
    async (choice) => handleReviseConfirmRef.current(choice),
    []
  );
  const tickerSuspended = modalOpen || !busy && !isStreaming;
  if (!bootReady) return /* @__PURE__ */ React66.createElement(BootSplash, null);
  return /* @__PURE__ */ React66.createElement(React66.Fragment, null, /* @__PURE__ */ React66.createElement(
    HistoryTypingCapture,
    {
      input,
      setInput,
      enabled: !modalOpen && !busy,
      onReturnToBottom: chatScroll.jumpToBottom
    }
  ), /* @__PURE__ */ React66.createElement(TickerProvider, { disabled: tickerSuspended }, /* @__PURE__ */ React66.createElement(ViewportBudgetProvider, null, /* @__PURE__ */ React66.createElement(InflightProvider, { inflight: loop2.inflight }, /* @__PURE__ */ React66.createElement(Box54, { flexDirection: "row", height: stdout?.rows ?? 24 }, /* @__PURE__ */ React66.createElement(Box54, { flexDirection: "column", flexGrow: 1 }, /* @__PURE__ */ React66.createElement(Box54, { flexDirection: "column", flexGrow: 1 }, /* @__PURE__ */ React66.createElement(LiveExpandContext.Provider, { value: liveExpand }, /* @__PURE__ */ React66.createElement(CardStream, { suppressLive: modalOpen })), !hasConversation && !busy && !isStreaming && slashMatches === null ? /* @__PURE__ */ React66.createElement(
    WelcomeBanner,
    {
      inCodeMode: !!codeMode,
      workspaceRoot: codeMode ? currentRootDir : void 0,
      dashboardUrl,
      languageVersion
    }
  ) : null, !pendingShell && !pendingPath && !pendingPlan && !pendingReviseEditor && !pendingSessionsPicker && !pendingCheckpointPicker && !pendingMcpHub && !stagedInput && !pendingEditReview && ongoingTool ? /* @__PURE__ */ React66.createElement(OngoingToolRow, { tool: ongoingTool, progress: toolProgress }) : null, !pendingShell && !pendingPath && !pendingPlan && !pendingReviseEditor && !pendingSessionsPicker && !pendingCheckpointPicker && !pendingMcpHub && !stagedInput && !pendingEditReview && subagentActivities.length > 0 ? /* @__PURE__ */ React66.createElement(SubagentLiveStack, { activities: subagentActivities, max: 3 }) : null, !pendingShell && !pendingPath && !pendingPlan && !pendingReviseEditor && !pendingSessionsPicker && !pendingCheckpointPicker && !pendingMcpHub && !stagedInput && !pendingEditReview && !ongoingTool && statusLine ? /* @__PURE__ */ React66.createElement(ThinkingRow, { text: statusLine }) : null, undoBanner && !pendingShell && !pendingPlan && !pendingReviseEditor && !pendingSessionsPicker && !pendingCheckpointPicker && !pendingMcpHub && !stagedInput && !pendingEditReview && !pendingChoice && !stagedChoiceCustom && !pendingRevision && !stagedCheckpointRevise && !pendingCheckpoint ? /* @__PURE__ */ React66.createElement(UndoBanner, { banner: undoBanner }) : null, !pendingShell && !pendingPath && !pendingPlan && !pendingReviseEditor && !pendingSessionsPicker && !pendingCheckpointPicker && !pendingMcpHub && !stagedInput && !pendingEditReview && busy && !isStreaming && !ongoingTool && !statusLine ? /* @__PURE__ */ React66.createElement(ThinkingRow, { text: activityLabel }) : null, !pendingShell && !pendingPath && !pendingPlan && !pendingReviseEditor && !pendingSessionsPicker && !pendingCheckpointPicker && !pendingMcpHub && !stagedInput && !pendingEditReview ? /* @__PURE__ */ React66.createElement(PlanLiveRow, null) : null, /* @__PURE__ */ React66.createElement(ToastRail, null)), stagedInput ? /* @__PURE__ */ React66.createElement(
    PlanRefineInput,
    {
      mode: stagedInput.mode,
      questions: stagedInput.questions,
      onSubmit: handleStagedInputSubmit,
      onCancel: handleStagedInputCancel
    }
  ) : stagedChoiceCustom ? /* @__PURE__ */ React66.createElement(
    PlanRefineInput,
    {
      mode: "choice-custom",
      onSubmit: handleChoiceCustomSubmit,
      onCancel: handleChoiceCustomCancel
    }
  ) : stagedCheckpointRevise ? /* @__PURE__ */ React66.createElement(
    PlanRefineInput,
    {
      mode: "checkpoint-revise",
      onSubmit: (text) => handleCheckpointReviseSubmit(text, stagedCheckpointRevise),
      onCancel: handleCheckpointReviseCancel
    }
  ) : pendingChoice ? /* @__PURE__ */ React66.createElement(
    ChoiceConfirm,
    {
      question: pendingChoice.question,
      options: pendingChoice.options,
      allowCustom: pendingChoice.allowCustom,
      onChoose: stableHandleChoiceConfirm
    }
  ) : pendingRevision ? /* @__PURE__ */ React66.createElement(
    PlanReviseConfirm,
    {
      reason: pendingRevision.reason,
      oldRemaining: (planStepsRef.current ?? []).filter(
        (s) => !completedStepIdsRef.current.has(s.id)
      ),
      newRemaining: pendingRevision.remainingSteps,
      summary: pendingRevision.summary,
      onChoose: stableHandleReviseConfirm
    }
  ) : pendingCheckpoint ? /* @__PURE__ */ React66.createElement(
    PlanCheckpointConfirm,
    {
      stepId: pendingCheckpoint.stepId,
      title: pendingCheckpoint.title,
      completed: pendingCheckpoint.completed,
      total: pendingCheckpoint.total,
      steps: planStepsRef.current ?? void 0,
      completedStepIds: completedStepIdsRef.current,
      onChoose: stableHandleCheckpointConfirm
    }
  ) : pendingCheckpointPicker ? /* @__PURE__ */ React66.createElement(
    CheckpointPicker,
    {
      checkpoints: checkpointPickerList,
      workspace: currentRootDir,
      pickerPorts,
      onChoose: (outcome) => {
        if (outcome.kind === "quit") {
          setPendingCheckpointPicker(false);
          return;
        }
        if (outcome.kind === "restore") {
          const target = checkpointPickerList.find((c) => c.id === outcome.id);
          setPendingCheckpointPicker(false);
          if (!target) return;
          const result = restoreCheckpoint(currentRootDir, target.id);
          const lines = [
            `\u25B8 restored "${target.name}" (${target.id.slice(0, 7)}, ${fmtAgo(target.createdAt)})`
          ];
          if (result.restored.length > 0) {
            lines.push(
              `  wrote ${result.restored.length} file${result.restored.length === 1 ? "" : "s"}`
            );
          }
          if (result.removed.length > 0) {
            lines.push(
              `  removed ${result.removed.length} file${result.removed.length === 1 ? "" : "s"}`
            );
          }
          if (result.skipped.length > 0) {
            lines.push(
              `  skipped ${result.skipped.length} file${result.skipped.length === 1 ? "" : "s"}`
            );
          }
          log.pushInfo(lines.join("\n"));
          return;
        }
        if (outcome.kind === "delete") {
          const target = checkpointPickerList.find((c) => c.id === outcome.id);
          if (!target) return;
          deleteCheckpoint(currentRootDir, target.id);
          setCheckpointPickerList([...listCheckpoints(currentRootDir)].reverse());
        }
      }
    }
  ) : pendingSessionsPicker ? /* @__PURE__ */ React66.createElement(
    SessionPicker,
    {
      sessions: sessionsPickerList,
      workspace: currentRootDir,
      walletCurrency: walletCurrencyRef.current,
      pickerPorts,
      onChoose: (outcome) => {
        if (outcome.kind === "open") {
          setPendingSessionsPicker(false);
          if (onSwitchSession) {
            onSwitchSession(outcome.name);
          } else {
            log.pushInfo(
              `\u25B8 to switch to "${outcome.name}", quit and run: reasonix chat --session ${outcome.name}`
            );
          }
          return;
        }
        if (outcome.kind === "new") {
          setPendingSessionsPicker(false);
          if (onSwitchSession) {
            onSwitchSession(freshSessionName(session));
          } else {
            log.pushInfo(
              "\u25B8 to start a fresh session, quit and run: reasonix chat (no --session flag)"
            );
          }
          return;
        }
        if (outcome.kind === "delete") {
          deleteSession(outcome.name);
          setSessionsPickerList(listSessionsForWorkspace(currentRootDir));
          return;
        }
        if (outcome.kind === "rename") {
          renameSession(outcome.name, outcome.newName);
          setSessionsPickerList(listSessionsForWorkspace(currentRootDir));
          return;
        }
        if (outcome.kind === "quit") {
          setPendingSessionsPicker(false);
        }
      }
    }
  ) : pendingThemePicker ? /* @__PURE__ */ React66.createElement(
    ThemePicker,
    {
      currentPreference: loadTheme() ?? "auto",
      activeTheme: themeName,
      onChoose: (outcome) => {
        setPendingThemePicker(false);
        if (outcome.kind === "quit") return;
        saveTheme(outcome.value);
        const active = resolveThemePreference(
          outcome.value,
          process.env.REASONIX_THEME
        );
        setThemeName(active);
        log.pushInfo(`\u25B8 theme saved: ${outcome.value}
  active now: ${active}`);
      }
    }
  ) : pendingCopyMode ? /* @__PURE__ */ React66.createElement(
    CopyMode,
    {
      cards: agentStore.getState().cards,
      onClose: (yanked) => {
        setPendingCopyMode(false);
        if (yanked) {
          const path = yanked.filePath;
          const info = yanked.osc52 ? t("copyMode.yankedToast", { size: yanked.size }) : t("copyMode.yankedToastFile", {
            size: yanked.size,
            path: path ?? "\u2014"
          });
          log.pushInfo(info);
        }
      }
    }
  ) : pendingModelPicker ? /* @__PURE__ */ React66.createElement(
    ModelPicker,
    {
      models,
      current: loop2.model,
      currentEffort: loop2.reasoningEffort,
      currentAutoEscalate: loop2.autoEscalate,
      onRefresh: refreshModels,
      onChoose: (outcome) => {
        setPendingModelPicker(false);
        if (outcome.kind === "select") {
          loop2.configure({ model: outcome.id, autoEscalate: false });
          agentStore.dispatch({ type: "session.model.change", model: outcome.id });
          const inferred = outcome.id === "deepseek-v4-pro" ? "pro" : outcome.id === "deepseek-v4-flash" ? "flash" : null;
          setPreset(inferred ?? "flash");
          agentStore.dispatch({
            type: "session.preset.change",
            preset: inferred
          });
          if (inferred) {
            try {
              savePreset(inferred);
            } catch {
            }
          }
          log.pushInfo(`\u25B8 model: ${outcome.id}`);
          return;
        }
        if (outcome.kind === "preset") {
          const p = PRESETS[outcome.name];
          loop2.configure({
            model: p.model,
            autoEscalate: p.autoEscalate,
            reasoningEffort: p.reasoningEffort
          });
          agentStore.dispatch({ type: "session.model.change", model: p.model });
          setPreset(outcome.name);
          agentStore.dispatch({
            type: "session.preset.change",
            preset: outcome.name
          });
          try {
            savePreset(outcome.name);
          } catch {
          }
          log.pushInfo(`\u25B8 preset: ${outcome.name} \xB7 ${p.model}`);
        }
      }
    }
  ) : pendingMcpHub ? /* @__PURE__ */ React66.createElement(
    McpHub,
    {
      initialTab: pendingMcpHub.tab,
      liveServers: liveMcpServers,
      configPath: defaultConfigPath(),
      pickerPorts,
      onClose: () => setPendingMcpHub(null),
      postInfo: (text) => log.pushInfo(text),
      applyAppend: (target, addedTools) => {
        const updated = applyMcpAppend(loop2, target, addedTools);
        setLiveMcpServers((prev) => replaceMcpServerSummary(prev, target, updated));
        return updated;
      },
      reloadMcp: mcpRuntime ? async () => {
        const r = await mcpRuntime.reloadFromConfig(loop2);
        setLiveMcpServers(r.summaries);
        return r;
      } : void 0
    }
  ) : pendingPlan ? /* @__PURE__ */ React66.createElement(
    PlanConfirm,
    {
      plan: pendingPlan,
      steps: planStepsRef.current ?? void 0,
      summary: planSummaryRef.current ?? void 0,
      onChoose: stableHandlePlanConfirm,
      projectRoot: currentRootDir
    }
  ) : pendingReviseEditor ? /* @__PURE__ */ React66.createElement(
    PlanReviseEditor,
    {
      steps: planStepsRef.current ?? [],
      completedStepIds: completedStepIdsRef.current,
      onAccept: (revised, skippedIds) => {
        planStepsRef.current = revised;
        for (const id of skippedIds) completedStepIdsRef.current.add(id);
        persistPlanState();
        const planText = pendingReviseEditor;
        setPendingReviseEditor(null);
        setPendingPlan(planText);
      },
      onCancel: () => {
        const planText = pendingReviseEditor;
        setPendingReviseEditor(null);
        setPendingPlan(planText);
      }
    }
  ) : pendingShell ? /* @__PURE__ */ React66.createElement(
    ShellConfirm,
    {
      command: pendingShell.command,
      allowPrefix: derivePrefix(pendingShell.command),
      kind: pendingShell.kind,
      cwd: pendingShell.cwd,
      timeoutSec: pendingShell.timeoutSec,
      waitSec: pendingShell.waitSec,
      onChoose: handleShellConfirm
    }
  ) : pendingPath ? /* @__PURE__ */ React66.createElement(
    PathConfirm,
    {
      path: pendingPath.path,
      intent: pendingPath.intent,
      toolName: pendingPath.toolName,
      sandboxRoot: pendingPath.sandboxRoot,
      allowPrefix: pendingPath.allowPrefix,
      onChoose: handlePathConfirm
    }
  ) : pendingEditReview ? /* @__PURE__ */ React66.createElement(
    EditConfirm,
    {
      block: pendingEditReview,
      onChoose: (choice, denyContext) => {
        const resolve2 = editReviewResolveRef.current;
        if (resolve2) {
          editReviewResolveRef.current = null;
          resolve2({ choice, denyContext });
        }
      }
    }
  ) : walkthroughActive && pendingEdits.current.length > 0 ? /* @__PURE__ */ React66.createElement(
    EditConfirm,
    {
      key: `walk-${pendingTick}`,
      block: pendingEdits.current[0],
      onChoose: handleWalkChoice
    }
  ) : /* @__PURE__ */ React66.createElement(
    InputAreaWithHistoryHint,
    {
      inputArea: /* @__PURE__ */ React66.createElement(Box54, { flexDirection: "column", flexShrink: 0, flexWrap: "nowrap" }, /* @__PURE__ */ React66.createElement(Box54, { flexDirection: "column", flexShrink: 0, flexWrap: "nowrap" }, codeMode ? /* @__PURE__ */ React66.createElement(
        ModeStatusBar,
        {
          editMode,
          pendingCount,
          flash: modeFlash,
          planMode,
          undoArmed: !!undoBanner || hasUndoable(),
          jobs: codeMode.jobs
        }
      ) : null, activeLoop ? /* @__PURE__ */ React66.createElement(LoopStatusRow, { loop: activeLoop }) : null, /* @__PURE__ */ React66.createElement(StatusRow, { statusBar }), /* @__PURE__ */ React66.createElement(
        PromptInput,
        {
          value: input,
          onChange: setInput,
          onSubmit: handleSubmit,
          disabled: busy,
          onHistoryPrev: handleHistoryPrev,
          onHistoryNext: handleHistoryNext,
          onOpenExternalEditor: handleOpenExternalEditor
        }
      )), /* @__PURE__ */ React66.createElement(Box54, { flexDirection: "column", flexShrink: 0, flexWrap: "nowrap" }, slashMatches !== null ? /* @__PURE__ */ React66.createElement(
        SlashSuggestions,
        {
          key: `slash-suggestions:${slashGroupMode ? "group" : "search"}`,
          matches: slashMatches,
          selectedIndex: slashSelected,
          groupMode: slashGroupMode,
          advancedHidden: slashAdvancedHidden
        }
      ) : null, atState !== null ? /* @__PURE__ */ React66.createElement(AtMentionSuggestions, { state: atState, selectedIndex: atSelected }) : null), slashArgContext ? /* @__PURE__ */ React66.createElement(
        SlashArgPicker,
        {
          matches: slashArgMatches,
          selectedIndex: slashArgSelected,
          spec: slashArgContext.spec,
          kind: slashArgContext.kind,
          partial: slashArgContext.partial
        }
      ) : null)
    }
  )))))));
}

// src/cli/ui/Setup.tsx
import { Box as Box55, Text as Text59, useApp } from "ink";
import React68, { useState as useState30 } from "react";

// src/cli/ui/MaskedInput.tsx
import { Text as Text58, useInput } from "ink";
import React67, { useRef as useRef11 } from "react";
function stripPasteMarkers(s) {
  return s.replace(/\u001b?\[20[01]~/g, "").replace(/\u001b/g, "");
}
function MaskedInput({
  value,
  onChange,
  onSubmit,
  mask = "\u2022",
  placeholder = ""
}) {
  const valueRef = useRef11(value);
  valueRef.current = value;
  useInput((input, key) => {
    if (key.return) {
      onSubmit(stripPasteMarkers(valueRef.current));
      return;
    }
    if (key.backspace || key.delete) {
      if (valueRef.current.length === 0) return;
      const next = valueRef.current.slice(0, -1);
      valueRef.current = next;
      onChange(next);
      return;
    }
    if (input && !key.ctrl && !key.meta && !key.escape) {
      const cleaned = stripPasteMarkers(input);
      if (cleaned.length === 0) return;
      const next = stripPasteMarkers(valueRef.current + cleaned);
      valueRef.current = next;
      onChange(next);
    }
  });
  if (value.length === 0) {
    if (placeholder.length === 0) {
      return /* @__PURE__ */ React67.createElement(Text58, { inverse: true }, " ");
    }
    return /* @__PURE__ */ React67.createElement(React67.Fragment, null, /* @__PURE__ */ React67.createElement(Text58, { inverse: true }, placeholder[0]), /* @__PURE__ */ React67.createElement(Text58, { color: FG.faint }, placeholder.slice(1)));
  }
  return /* @__PURE__ */ React67.createElement(React67.Fragment, null, /* @__PURE__ */ React67.createElement(Text58, null, mask.repeat(value.length)), /* @__PURE__ */ React67.createElement(Text58, { inverse: true }, " "));
}

// src/cli/ui/Setup.tsx
function Setup({ onReady }) {
  const [value, setValue] = useState30("");
  const [error, setError] = useState30(null);
  const { exit: exit2 } = useApp();
  const handleSubmit = (raw) => {
    const trimmed = raw.trim();
    if (trimmed === "/exit" || trimmed === "/quit") {
      exit2();
      return;
    }
    if (!isPlausibleKey(trimmed)) {
      setError(t("wizard.apiKeyInvalid"));
      setValue("");
      return;
    }
    try {
      saveApiKey(trimmed);
    } catch (err) {
      setError(t("wizard.reviewSaveError", { message: err.message }));
      return;
    }
    onReady(trimmed);
  };
  return /* @__PURE__ */ React68.createElement(Box55, { flexDirection: "column", paddingX: 1, marginY: 1 }, /* @__PURE__ */ React68.createElement(Box55, null, /* @__PURE__ */ React68.createElement(Text59, { bold: true, color: GRADIENT[0] }, GLYPH.brand), /* @__PURE__ */ React68.createElement(Text59, null, "  "), /* @__PURE__ */ React68.createElement(Text59, { bold: true }, t("wizard.welcomeTitle"))), /* @__PURE__ */ React68.createElement(Box55, { marginTop: 1 }, /* @__PURE__ */ React68.createElement(Text59, { color: COLOR.info }, t("wizard.apiKeyPrompt"))), /* @__PURE__ */ React68.createElement(Box55, null, /* @__PURE__ */ React68.createElement(Text59, { dimColor: true }, `  ${t("wizard.apiKeyGetOne")}`)), /* @__PURE__ */ React68.createElement(Box55, null, /* @__PURE__ */ React68.createElement(Text59, { dimColor: true }, t("wizard.apiKeySavedLocally", { path: defaultConfigPath() }))), /* @__PURE__ */ React68.createElement(Box55, { marginTop: 1 }, /* @__PURE__ */ React68.createElement(Text59, { bold: true, color: COLOR.brand }, GLYPH.bar), /* @__PURE__ */ React68.createElement(Text59, { bold: true, color: COLOR.primary }, " \u203A "), /* @__PURE__ */ React68.createElement(
    MaskedInput,
    {
      value,
      onChange: setValue,
      onSubmit: handleSubmit,
      mask: "\u2022",
      placeholder: t("wizard.apiKeyPlaceholder")
    }
  )), error ? /* @__PURE__ */ React68.createElement(Box55, { marginTop: 1 }, /* @__PURE__ */ React68.createElement(Text59, { color: COLOR.err, bold: true }, GLYPH.err), /* @__PURE__ */ React68.createElement(Text59, { color: COLOR.err }, `  ${error}`)) : value ? /* @__PURE__ */ React68.createElement(Box55, { marginTop: 1 }, /* @__PURE__ */ React68.createElement(Text59, { dimColor: true }, t("wizard.apiKeyPreview", { redacted: redactKey(value) }))) : null, /* @__PURE__ */ React68.createElement(Box55, { marginTop: 1 }, /* @__PURE__ */ React68.createElement(Text59, { dimColor: true }, t("wizard.exitHint"))));
}

// src/cli/ui/drain-tty.ts
import process2 from "process";
async function drainTtyResponses(timeoutMs = 50) {
  const stdin = process2.stdin;
  if (!stdin.isTTY && typeof stdin.setRawMode !== "function") {
    return;
  }
  let raised = false;
  try {
    stdin.setRawMode(true);
    raised = true;
  } catch {
    return;
  }
  stdin.resume();
  await new Promise((resolve2) => {
    const onData = (_chunk) => {
    };
    stdin.on("data", onData);
    const timer = setTimeout(() => {
      stdin.off("data", onData);
      stdin.pause();
      if (raised) {
        try {
          stdin.setRawMode(false);
        } catch {
        }
      }
      resolve2();
    }, timeoutMs);
    timer.unref();
  });
}

// src/cli/commands/chat.tsx
function Root({
  initialKey,
  tools,
  mcpSpecs,
  mcpServers,
  progressSink,
  showPicker,
  mcpRuntime,
  startupInfoHints,
  ...appProps
}) {
  const [key, setKey] = useState31(initialKey);
  const [pickerOpen, setPickerOpen] = useState31(showPicker);
  const [activeSession, setActiveSession] = useState31(appProps.session);
  const workspaceRoot = appProps.codeMode?.rootDir ?? process.cwd();
  const [sessions2, setSessions] = useState31(() => listSessionsForWorkspace(workspaceRoot));
  if (!key) {
    return /* @__PURE__ */ React69.createElement(
      Setup,
      {
        onReady: (k) => {
          process.env.DEEPSEEK_API_KEY = k;
          setKey(k);
        }
      }
    );
  }
  process.env.DEEPSEEK_API_KEY = key;
  if (pickerOpen) {
    return /* @__PURE__ */ React69.createElement(KeystrokeProvider, null, /* @__PURE__ */ React69.createElement(
      SessionPicker,
      {
        sessions: sessions2,
        workspace: workspaceRoot,
        onChoose: (outcome) => {
          if (outcome.kind === "open") {
            setActiveSession(outcome.name);
            setPickerOpen(false);
            return;
          }
          if (outcome.kind === "new") {
            setActiveSession(freshSessionName(activeSession));
            setPickerOpen(false);
            return;
          }
          if (outcome.kind === "delete") {
            deleteSession(outcome.name);
            setSessions(listSessionsForWorkspace(workspaceRoot));
            return;
          }
          if (outcome.kind === "rename") {
            renameSession(outcome.name, outcome.newName);
            setSessions(listSessionsForWorkspace(workspaceRoot));
            return;
          }
          if (outcome.kind === "quit") {
            process.exit(0);
          }
        }
      }
    ));
  }
  return /* @__PURE__ */ React69.createElement(KeystrokeProvider, null, /* @__PURE__ */ React69.createElement(
    App,
    {
      key: activeSession ?? "__new__",
      model: appProps.model,
      system: appProps.system,
      rebuildSystem: appProps.rebuildSystem,
      transcript: appProps.transcript,
      budgetUsd: appProps.budgetUsd,
      failureThreshold: appProps.failureThreshold,
      session: activeSession,
      tools,
      mcpSpecs,
      mcpServers,
      mcpRuntime,
      progressSink,
      startupInfoHints,
      codeMode: appProps.codeMode,
      noDashboard: appProps.noDashboard,
      dashboardPort: appProps.dashboardPort,
      mouse: appProps.mouse,
      onSwitchSession: setActiveSession
    }
  ));
}
async function chatCommand(opts) {
  markPhase("chat_command_enter");
  loadDotenv();
  const initialKey = loadApiKey();
  markPhase("config_loaded");
  const requestedSpecs = opts.mcp ?? [];
  const progressSink = { current: null };
  let tools = opts.seedTools;
  if (requestedSpecs.length > 0 && !tools) tools = new ToolRegistry();
  const runtime = createMcpRuntime({
    getTools: () => tools,
    getMcpPrefix: () => opts.mcpPrefix,
    getRequestedCount: () => requestedSpecs.length,
    progressSink
  });
  const mcpSpecs = [...requestedSpecs];
  const mcpServers = [];
  const cfg = readConfig();
  const startupInfoHints = [];
  if (cfg.setupCompleted === true && (cfg.mcp?.length ?? 0) === 0 && mcpSpecs.length === 0) {
    startupInfoHints.push(t("mcpHealth.emptyHint"));
  }
  if (searchEnabled()) {
    if (!tools) tools = new ToolRegistry();
    registerWebTools(tools, {
      webSearchEngine: webSearchEngine(),
      webSearchEndpoint: webSearchEndpoint()
    });
  }
  if (!opts.seedTools) {
    if (!tools) tools = new ToolRegistry();
    registerMemoryTools(tools, {});
    registerChoiceTool(tools);
  }
  const { resolved: resolvedSession } = resolveSession(
    opts.session,
    opts.forceNew,
    opts.forceResume
  );
  const launchWorkspace = opts.codeMode?.rootDir ?? process.cwd();
  const showPicker = !opts.session && !opts.forceResume && listSessionsForWorkspace(launchWorkspace).length > 0;
  markPhase("ink_render_call");
  const { waitUntilExit } = render(
    /* @__PURE__ */ React69.createElement(
      Root,
      {
        initialKey,
        tools,
        mcpSpecs,
        mcpServers,
        mcpRuntime: runtime,
        progressSink,
        startupInfoHints,
        showPicker,
        ...opts,
        session: resolvedSession
      }
    ),
    {
      exitOnCtrlC: true,
      // patchConsole:false — winpty/MINTTY redraw-glitch source.
      patchConsole: false,
      // incrementalRendering:false — Ink's diff drifts when stringWidth
      // misjudges CJK / emoji ZWJ width or when async terminal-event
      // bytes interleave mid-render, leaving residual rows. Full-frame
      // redraws cost more stdout bytes per flush but eliminate the
      // ghost class.
      incrementalRendering: false,
      // Default true — alt-screen is the only mode without scrollback-
      // reflow ghosting. `--no-alt-screen` opts back into scrollback mode
      // for users who need chat output preserved in shell history on exit.
      alternateScreen: opts.altScreen !== false
    }
  );
  try {
    await waitUntilExit();
  } finally {
    await runtime.closeAll();
    await drainTtyResponses();
  }
}

export {
  chatCommand
};
//# sourceMappingURL=chunk-F2AV2QDK.js.map