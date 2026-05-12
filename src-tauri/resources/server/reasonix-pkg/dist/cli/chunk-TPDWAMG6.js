#!/usr/bin/env node
import {
  sanitizeName,
  sessionsDir
} from "./chunk-6CXT5JRM.js";

// src/code/plan-store.ts
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "fs";
import { dirname, join } from "path";
function planStatePath(sessionName) {
  return join(sessionsDir(), `${sanitizeName(sessionName)}.plan.json`);
}
function loadPlanState(sessionName) {
  const path = planStatePath(sessionName);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== 1) return null;
    if (!Array.isArray(parsed.steps)) return null;
    if (!Array.isArray(parsed.completedStepIds)) return null;
    if (typeof parsed.updatedAt !== "string") return null;
    const steps = [];
    for (const s of parsed.steps) {
      if (!s || typeof s !== "object") continue;
      const e = s;
      if (typeof e.id !== "string" || !e.id) continue;
      if (typeof e.title !== "string" || !e.title) continue;
      if (typeof e.action !== "string" || !e.action) continue;
      const step = { id: e.id, title: e.title, action: e.action };
      if (e.risk === "low" || e.risk === "med" || e.risk === "high") step.risk = e.risk;
      steps.push(step);
    }
    if (steps.length === 0) return null;
    const completedStepIds = parsed.completedStepIds.filter(
      (id) => typeof id === "string" && id.length > 0
    );
    const out = {
      version: 1,
      steps,
      completedStepIds,
      updatedAt: parsed.updatedAt
    };
    if (typeof parsed.body === "string" && parsed.body) out.body = parsed.body;
    if (typeof parsed.summary === "string" && parsed.summary) out.summary = parsed.summary;
    return out;
  } catch {
    return null;
  }
}
function savePlanState(sessionName, steps, completedStepIds, extras) {
  const path = planStatePath(sessionName);
  try {
    mkdirSync(dirname(path), { recursive: true });
    const state = {
      version: 1,
      steps,
      completedStepIds: [...completedStepIds],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (extras?.body) state.body = extras.body;
    if (extras?.summary) state.summary = extras.summary;
    writeFileSync(path, `${JSON.stringify(state, null, 2)}
`, "utf8");
  } catch (err) {
    process.stderr.write(
      `\u25B8 plan-store: failed to save plan for "${sessionName}": ${err.message}
`
    );
  }
}
function clearPlanState(sessionName) {
  const path = planStatePath(sessionName);
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
  }
}
function archivePlanState(sessionName) {
  const active = planStatePath(sessionName);
  if (!existsSync(active)) return null;
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const suffix = Math.random().toString(36).slice(2, 6);
  const archive = join(
    sessionsDir(),
    `${sanitizeName(sessionName)}.plan.${stamp}-${suffix}.done.json`
  );
  try {
    renameSync(active, archive);
    return archive;
  } catch (err) {
    process.stderr.write(
      `\u25B8 plan-store: failed to archive plan for "${sessionName}": ${err.message}
`
    );
    return null;
  }
}
function listPlanArchives(sessionName) {
  const dir = sessionsDir();
  if (!existsSync(dir)) return [];
  const prefix = `${sanitizeName(sessionName)}.plan.`;
  const suffix = ".done.json";
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const summaries = [];
  for (const name of entries) {
    if (!name.startsWith(prefix) || !name.endsWith(suffix)) continue;
    const full = join(dir, name);
    try {
      const raw = readFileSync(full, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1) continue;
      if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) continue;
      const steps = parsed.steps.filter(
        (s) => !!s && typeof s === "object" && typeof s.id === "string" && typeof s.title === "string" && typeof s.action === "string"
      );
      if (steps.length === 0) continue;
      const completedStepIds = Array.isArray(parsed.completedStepIds) ? parsed.completedStepIds.filter((id) => typeof id === "string" && !!id) : [];
      let completedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : "";
      if (!completedAt || Number.isNaN(Date.parse(completedAt))) {
        try {
          completedAt = statSync(full).mtime.toISOString();
        } catch {
          completedAt = (/* @__PURE__ */ new Date(0)).toISOString();
        }
      }
      const entry = { path: full, completedAt, steps, completedStepIds };
      if (typeof parsed.body === "string" && parsed.body) entry.body = parsed.body;
      if (typeof parsed.summary === "string" && parsed.summary) entry.summary = parsed.summary;
      summaries.push(entry);
    } catch {
    }
  }
  summaries.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return summaries;
}
function relativeTime(updatedAt, now = Date.now()) {
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return updatedAt;
  const diffMs = Math.max(0, now - t);
  const sec = Math.floor(diffMs / 1e3);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return updatedAt.slice(0, 10);
}

// src/cli/ui/slash/commands.ts
var SLASH_GROUP_ORDER = [
  "setup",
  "info",
  "chat",
  "extend",
  "session",
  "code",
  "jobs",
  "advanced"
];
var SLASH_GROUP_RANK = new Map(
  SLASH_GROUP_ORDER.map((group, index) => [group, index])
);
function orderSlashCommandsByGroup(commands) {
  return commands.map((command, index) => ({ command, index })).sort((a, b) => {
    const groupDiff = SLASH_GROUP_RANK.get(a.command.group) - SLASH_GROUP_RANK.get(b.command.group);
    if (groupDiff !== 0) return groupDiff;
    return a.index - b.index;
  }).map((entry) => entry.command);
}
var SLASH_COMMANDS = [
  { cmd: "help", group: "chat", summary: "show the full command reference", aliases: ["?"] },
  {
    cmd: "new",
    group: "chat",
    summary: "start a fresh conversation (clear context + scrollback)",
    aliases: ["reset", "clear"]
  },
  { cmd: "retry", group: "chat", summary: "truncate & resend your last message (fresh sample)" },
  {
    cmd: "compact",
    group: "chat",
    summary: "fold older turns into a summary message (cache-safe). Auto-fires at 50% ctx; this is the manual trigger."
  },
  {
    cmd: "stop",
    group: "chat",
    summary: "abort the current model turn (typed alternative to Esc)"
  },
  {
    cmd: "preset",
    group: "setup",
    argsHint: "<auto|flash|pro>",
    summary: "model bundle \u2014 auto escalates flash \u2192 pro, flash/pro lock. Bare opens picker.",
    argCompleter: ["auto", "flash", "pro"]
  },
  {
    cmd: "model",
    group: "setup",
    argsHint: "<id>",
    summary: "switch DeepSeek model id. Bare opens picker.",
    argCompleter: "models"
  },
  {
    cmd: "language",
    group: "setup",
    argsHint: "<EN|zh-CN>",
    summary: "switch the runtime language",
    argCompleter: ["EN", "zh-CN"],
    aliases: ["lang"]
  },
  {
    cmd: "theme",
    group: "setup",
    argsHint: "[auto|default|dark|light|tokyo-night|github-dark|github-light|high-contrast]",
    summary: "show or persist the terminal theme preference. Bare opens picker.",
    argCompleter: [
      "auto",
      "default",
      "dark",
      "light",
      "tokyo-night",
      "github-dark",
      "github-light",
      "high-contrast"
    ]
  },
  { cmd: "status", group: "info", summary: "current model, flags, context, session" },
  {
    cmd: "cost",
    group: "info",
    argsHint: "[text]",
    summary: "bare \u2192 last turn's spend (Usage card); with text \u2192 estimate cost of sending it next (worst-case + likely-cache)"
  },
  {
    cmd: "context",
    group: "info",
    summary: "show context-window breakdown (system / tools / log / input)"
  },
  {
    cmd: "stats",
    group: "info",
    summary: "cross-session cost dashboard (today / week / month / all-time \xB7 cache hit \xB7 vs Claude)"
  },
  {
    cmd: "doctor",
    group: "info",
    summary: "health check (api / config / api-reach / index / hooks / project)"
  },
  {
    cmd: "keys",
    group: "info",
    summary: "keyboard + mouse + copy/paste reference"
  },
  {
    cmd: "copy",
    group: "chat",
    summary: "vim/tmux-style copy mode \u2014 j/k navigate, v select, y yank to clipboard"
  },
  {
    cmd: "feedback",
    group: "info",
    summary: "open a GitHub issue with diagnostic info copied to clipboard"
  },
  { cmd: "sessions", group: "session", summary: "list saved sessions (current marked with \u25B8)" },
  { cmd: "mcp", group: "extend", summary: "list MCP servers + tools attached to this session" },
  {
    cmd: "resource",
    group: "extend",
    argsHint: "[uri]",
    summary: "browse + read MCP resources (no arg \u2192 list URIs; <uri> \u2192 fetch contents)",
    argCompleter: "mcp-resources"
  },
  {
    cmd: "prompt",
    group: "extend",
    argsHint: "[name]",
    summary: "browse + fetch MCP prompts (no arg \u2192 list names; <name> \u2192 render prompt)",
    argCompleter: "mcp-prompts"
  },
  {
    cmd: "memory",
    group: "extend",
    argsHint: "[list|show <name>|forget <name>|clear <scope> confirm]",
    summary: "show / manage pinned memory (REASONIX.md + ~/.reasonix/memory)"
  },
  {
    cmd: "skill",
    group: "extend",
    argsHint: "[list|show <name>|new <name>|<name> [args]]",
    summary: "list / run / scaffold user skills (<project>/.reasonix/skills + ~/.reasonix/skills)"
  },
  {
    cmd: "init",
    group: "code",
    argsHint: "[force]",
    summary: "scan the project and synthesize a baseline REASONIX.md (model writes; review with /apply). `force` overwrites an existing file.",
    contextual: "code",
    argCompleter: ["force"]
  },
  {
    cmd: "apply",
    group: "code",
    argsHint: "[N|N,M|N-M]",
    summary: "commit pending edit blocks to disk (no arg \u2192 all; `1`, `1,3`, or `1-4` \u2192 that subset, rest stay pending)",
    contextual: "code"
  },
  {
    cmd: "discard",
    group: "code",
    argsHint: "[N|N,M|N-M]",
    summary: "drop pending edit blocks without writing (no arg \u2192 all; indices \u2192 that subset)",
    contextual: "code"
  },
  {
    cmd: "walk",
    group: "code",
    summary: "step through pending edits one block at a time (git-add-p style: y/n per block, a apply rest, A flip AUTO)",
    contextual: "code"
  },
  {
    cmd: "undo",
    group: "code",
    summary: "roll back the last applied edit batch",
    contextual: "code"
  },
  {
    cmd: "history",
    group: "code",
    summary: "list every edit batch this session (ids for /show, undone markers)",
    contextual: "code"
  },
  {
    cmd: "show",
    group: "code",
    argsHint: "[id]",
    summary: "dump a stored edit diff (omit id for newest non-undone)",
    contextual: "code"
  },
  {
    cmd: "commit",
    group: "code",
    argsHint: '"msg"',
    summary: "git add -A && git commit -m ...",
    contextual: "code"
  },
  {
    cmd: "mode",
    group: "code",
    argsHint: "[review|auto|yolo]",
    summary: "edit-gate: review (queue) \xB7 auto (apply+undo) \xB7 yolo (apply+auto-shell). Shift+Tab cycles.",
    contextual: "code",
    argCompleter: ["review", "auto", "yolo"]
  },
  {
    cmd: "plan",
    group: "code",
    argsHint: "[on|off]",
    summary: "toggle read-only plan mode (writes bounced until submit_plan + approval)",
    contextual: "code",
    argCompleter: ["on", "off"]
  },
  {
    cmd: "checkpoint",
    group: "code",
    argsHint: "[name|list|forget <id>]",
    summary: "snapshot every file the session has touched (Cursor-style internal store, not git). /checkpoint alone lists.",
    contextual: "code",
    argCompleter: ["list", "forget"]
  },
  {
    cmd: "restore",
    group: "code",
    argsHint: "<name|id>",
    summary: "roll back files to a named checkpoint (see /checkpoint list)",
    contextual: "code"
  },
  {
    cmd: "cwd",
    group: "code",
    argsHint: "<path>",
    summary: "switch the workspace root mid-session \u2014 re-points fs / shell / memory tools, reloads project hooks, refreshes the at-mention walker",
    contextual: "code",
    aliases: ["sandbox"]
  },
  {
    cmd: "jobs",
    group: "jobs",
    summary: "list background jobs started by run_background",
    contextual: "code"
  },
  {
    cmd: "kill",
    group: "jobs",
    argsHint: "<id>",
    summary: "stop a background job by id (SIGTERM \u2192 SIGKILL after grace)",
    contextual: "code"
  },
  {
    cmd: "logs",
    group: "jobs",
    argsHint: "<id> [lines]",
    summary: "tail a background job's output (default last 80 lines)",
    contextual: "code"
  },
  {
    cmd: "pro",
    group: "advanced",
    argsHint: "[off]",
    summary: "arm v4-pro for the NEXT turn only (one-shot \xB7 auto-disarms after turn)",
    argCompleter: ["off"]
  },
  {
    cmd: "budget",
    group: "advanced",
    argsHint: "[usd|off]",
    summary: "session USD cap \u2014 warns at 80%, refuses next turn at 100%. Off by default. /budget alone shows status",
    argCompleter: ["off", "1", "5", "10", "20", "50"]
  },
  {
    cmd: "search-engine",
    group: "advanced",
    argsHint: "<mojeek|searxng> [<endpoint>]",
    summary: "switch web search backend \u2014 mojeek (default, no deps) or searxng (self-hosted)",
    argCompleter: ["mojeek", "searxng"],
    aliases: ["se"]
  },
  {
    cmd: "hooks",
    group: "advanced",
    argsHint: "[reload]",
    summary: "list active hooks (settings.json under .reasonix/) \xB7 reload re-reads from disk"
  },
  {
    cmd: "permissions",
    group: "advanced",
    argsHint: "[list|add <prefix>|remove <prefix|N>|clear confirm]",
    summary: "show / edit shell allowlist (builtin read-only \xB7 per-project: ~/.reasonix/config.json)",
    argCompleter: ["list", "add", "remove", "clear"]
  },
  {
    cmd: "dashboard",
    group: "advanced",
    argsHint: "[stop]",
    summary: "launch the embedded web dashboard (127.0.0.1, token-gated)",
    argCompleter: ["stop"]
  },
  {
    cmd: "loop",
    group: "advanced",
    argsHint: "<5s..6h> <prompt>  \xB7  stop  \xB7  (no args = status)",
    summary: "auto-resubmit <prompt> every <interval> until you type something / Esc / /loop stop"
  },
  {
    cmd: "plans",
    group: "advanced",
    summary: "list this session's active + archived plans, newest first"
  },
  {
    cmd: "replay",
    group: "advanced",
    summary: "load an archived plan as a read-only Time Travel snapshot (default: newest)",
    argsHint: "[N]"
  },
  {
    cmd: "update",
    group: "advanced",
    summary: "show current vs latest version + the shell command to upgrade"
  },
  { cmd: "exit", group: "advanced", summary: "quit the TUI", aliases: ["quit", "q"] }
];
function suggestSlashCommands(prefix, codeMode = false, counts) {
  const p = prefix.toLowerCase();
  const matches = SLASH_COMMANDS.filter((c) => {
    if (p === "") return c.group !== "advanced";
    if (c.contextual === "code" && !codeMode) return false;
    if (c.cmd.startsWith(p)) return true;
    return c.aliases?.some((a) => a.startsWith(p)) ?? false;
  });
  if (p === "") return orderSlashCommandsByGroup(matches);
  if (!counts) return matches;
  const indexOf = new Map(matches.map((s, i) => [s.cmd, i]));
  return [...matches].sort((a, b) => {
    const diff = (counts[b.cmd] ?? 0) - (counts[a.cmd] ?? 0);
    if (diff !== 0) return diff;
    return (indexOf.get(a.cmd) ?? 0) - (indexOf.get(b.cmd) ?? 0);
  });
}
function countAdvancedCommands(codeMode) {
  return SLASH_COMMANDS.filter(
    (c) => c.group === "advanced" && (c.contextual !== "code" || codeMode)
  ).length;
}
var ALIAS_TO_CMD = (() => {
  const m = {};
  for (const spec of SLASH_COMMANDS) {
    if (!spec.aliases) continue;
    for (const a of spec.aliases) m[a] = spec.cmd;
  }
  return m;
})();
function resolveSlashAlias(name) {
  return ALIAS_TO_CMD[name] ?? name;
}
function detectSlashArgContext(input, codeMode = false) {
  const m = /^\/(\S+) ([\s\S]*)$/.exec(input);
  if (!m) return null;
  const cmdName = resolveSlashAlias(m[1].toLowerCase());
  const tail = m[2] ?? "";
  const spec = SLASH_COMMANDS.find(
    (s) => s.cmd === cmdName && (s.contextual !== "code" || codeMode)
  );
  if (!spec) return null;
  const hasInternalSpace = /\s/.test(tail);
  const partialOffset = input.length - tail.length;
  if (hasInternalSpace) {
    return { spec, partial: tail, partialOffset, kind: "hint" };
  }
  return {
    spec,
    partial: tail,
    partialOffset,
    kind: spec.argCompleter ? "picker" : "hint"
  };
}
function parseSlash(text) {
  if (!text.startsWith("/")) return null;
  const parts = text.slice(1).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? "";
  if (!cmd) return null;
  return { cmd, args: parts.slice(1) };
}

export {
  loadPlanState,
  savePlanState,
  clearPlanState,
  archivePlanState,
  listPlanArchives,
  relativeTime,
  SLASH_GROUP_ORDER,
  orderSlashCommandsByGroup,
  SLASH_COMMANDS,
  suggestSlashCommands,
  countAdvancedCommands,
  resolveSlashAlias,
  detectSlashArgContext,
  parseSlash
};
//# sourceMappingURL=chunk-TPDWAMG6.js.map