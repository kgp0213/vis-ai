#!/usr/bin/env node
import {
  markPhase
} from "./chunk-CPOV2O73.js";
import "./chunk-BTSIAOUG.js";
import "./chunk-SJNIIH5W.js";
import "./chunk-XJLZ4HKU.js";
import "./chunk-XHQIK7B6.js";
import {
  applyMemoryStack
} from "./chunk-DDA76P44.js";
import {
  resolvePreset
} from "./chunk-MHDNZXJJ.js";
import {
  installProxyIfConfigured
} from "./chunk-AFFZF3MW.js";
import "./chunk-DAEAAVDF.js";
import "./chunk-KMWKGPFZ.js";
import "./chunk-3Q3C4W66.js";
import "./chunk-NTVW2TWO.js";
import {
  escalationContract
} from "./chunk-6DR4F3MC.js";
import "./chunk-CGX5GIW6.js";
import "./chunk-5X7LZJDE.js";
import {
  listSessions
} from "./chunk-6CXT5JRM.js";
import {
  t
} from "./chunk-TWJAH4XD.js";
import {
  readConfig
} from "./chunk-SWLIVNTP.js";
import "./chunk-ZTLZO42A.js";
import "./chunk-ORM6PK57.js";
import {
  VERSION
} from "./chunk-CRPQUBP6.js";

// src/cli/index.ts
import { Command } from "commander";

// src/cli/resolve.ts
function resolveDefaults(flags) {
  const cfg = flags.noConfig ? {} : readConfig();
  const preset = pickPreset(flags.preset, cfg.preset);
  const presetSettings = resolvePreset(preset);
  const model = flags.model ?? presetSettings.model;
  const reasoningEffort = presetSettings.reasoningEffort;
  const mcp2 = flags.mcp && flags.mcp.length > 0 ? flags.mcp : cfg.mcp ?? [];
  const session = resolveSession(flags.session, cfg.session);
  return { model, reasoningEffort, mcp: mcp2, session };
}
function pickPreset(flagPreset, configPreset) {
  if (flagPreset && isPresetName(flagPreset)) return flagPreset;
  if (configPreset) return configPreset;
  return "auto";
}
function isPresetName(s) {
  return s === "auto" || s === "flash" || s === "pro" || // Legacy names — kept callable so old `--preset smart` invocations
  // and stale config.json entries don't error out.
  s === "fast" || s === "smart" || s === "max";
}
function resolveSession(flag, configSession) {
  if (flag === false) return void 0;
  if (typeof flag === "string" && flag.length > 0) return flag;
  if (configSession === null) return void 0;
  if (typeof configSession === "string" && configSession.length > 0) return configSession;
  return "default";
}
function resolveContinueFlag(flag, fallbackSession, getLatestSession, warn = () => {
}) {
  if (!flag) return { session: fallbackSession, forceResume: false };
  const latest = getLatestSession();
  if (!latest) {
    warn("\u25B8 -c/--continue: no saved sessions yet \u2014 starting a fresh one.");
    return { session: fallbackSession, forceResume: false };
  }
  return { session: latest.name, forceResume: true };
}

// src/cli/index.ts
installProxyIfConfigured();
markPhase("cli_module_loaded");
function defaultSystemPrompt(modelId) {
  return `You are Reasonix, a helpful DeepSeek-powered assistant. Be concise and accurate. Use tools when available.

# Cite or shut up \u2014 non-negotiable

Every factual claim about a codebase must be backed by evidence. Reasonix VALIDATES your citations \u2014 broken paths render in **red strikethrough with \u274C** in front of the user.

**Positive claims** \u2014 append a markdown link:
- \u2705 \`The MCP client supports listResources [listResources](src/mcp/client.ts:142).\`
- \u274C \`The MCP client supports listResources.\` \u2190 unverifiable, do not write.

**Negative claims** ("X is missing", "Y isn't implemented", "lacks Z") are the #1 hallucination shape. STOP before writing them. If you have a search tool, call it first; if the search returns nothing, cite the search itself as evidence (\`No matches for "foo" in src/\`). If you have no tool, qualify hard: "I haven't verified \u2014 this is a guess."

Asserting absence without checking is how evaluative answers go wrong. Treat the urge to write "missing" as a red flag in your own reasoning.

# Don't invent what changes \u2014 search instead

Your training data has a cutoff. When an answer's correctness depends on something that changes over time (the user is asking what's happening, not what's true) and a search tool is available, search first. Inventing currently-correct values from training memory is the most common way these answers go wrong, and the user usually can't tell until much later.

The signal isn't a topic list \u2014 it's: "if I'm wrong about this, is it because reality moved on?". If yes, ground the answer in fresh evidence; if no (definitions, mechanisms, well-established APIs), answer from memory.

${escalationContract(modelId)}`;
}
function parseBudgetFlag(raw) {
  if (raw === void 0) return void 0;
  if (!Number.isFinite(raw) || raw <= 0) {
    process.stderr.write(
      `\u25B2 ignoring --budget=${raw} (must be a positive number) \u2014 running with no cap
`
    );
    return void 0;
  }
  return raw;
}
function parseDashboardPortFlag(raw) {
  if (raw === void 0) return void 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    process.stderr.write(`${t("ui.dashboardPortInvalid", { value: raw })}
`);
    return void 0;
  }
  return n;
}
function resolveDashboardPort(flagValue, noConfig) {
  if (flagValue !== void 0) return flagValue;
  if (noConfig) return void 0;
  const fromCfg = readConfig().dashboard?.port;
  return typeof fromCfg === "number" && Number.isInteger(fromCfg) && fromCfg >= 1 && fromCfg <= 65535 ? fromCfg : void 0;
}
var program = new Command();
program.name("reasonix").description(t("cli.description")).version(VERSION).option("-c, --continue", t("cli.continue"));
program.action(async (opts) => {
  const cfg = readConfig();
  if (!cfg.setupCompleted) {
    const { setupCommand } = await import("./setup-EJAMRGKQ.js");
    await setupCommand({ forceKeyStep: true });
    return;
  }
  const defaults = resolveDefaults({});
  const continueOpts = resolveContinueFlag(
    opts.continue,
    defaults.session,
    () => listSessions()[0],
    (msg) => process.stderr.write(`${msg}
`)
  );
  const { chatCommand } = await import("./chat-EVPUW4A4.js");
  await chatCommand({
    model: defaults.model,
    system: applyMemoryStack(defaultSystemPrompt(defaults.model), process.cwd()),
    session: continueOpts.session,
    mcp: defaults.mcp,
    forceResume: continueOpts.forceResume
  });
});
program.command("setup").description(t("cli.setup")).action(async () => {
  const { setupCommand } = await import("./setup-EJAMRGKQ.js");
  await setupCommand({ forceKeyStep: true });
});
program.command("code [dir]").description(t("cli.code")).option("-m, --model <id>", t("ui.modelOverride")).option("--no-session", t("ui.noSession")).option("-r, --resume", t("ui.resumeHint")).option("-n, --new", t("ui.newHint")).option("--transcript <path>", t("ui.transcriptHint")).option("--budget <usd>", t("ui.budgetHint"), (v) => Number.parseFloat(v)).option("--no-dashboard", t("ui.noDashboard")).option("--dashboard-port <port>", t("ui.dashboardPortHint")).option("--no-alt-screen", "keep chat output in shell scrollback (legacy mode, ghost-prone)").option("--no-mouse", "disable SGR mouse tracking (keeps drag-select 100% native)").option("--system-append <prompt>", t("ui.systemAppendHint")).option("--system-append-file <path>", t("ui.systemAppendFileHint")).action(async (dir, opts) => {
  const { codeCommand } = await import("./code-TTOCA52N.js");
  await codeCommand({
    dir,
    model: opts.model,
    noSession: opts.session === false,
    transcript: opts.transcript,
    forceResume: !!opts.resume,
    forceNew: !!opts.new,
    budgetUsd: parseBudgetFlag(opts.budget),
    noDashboard: opts.dashboard === false,
    dashboardPort: resolveDashboardPort(parseDashboardPortFlag(opts.dashboardPort), false),
    systemAppend: opts.systemAppend,
    systemAppendFile: opts.systemAppendFile,
    altScreen: opts.altScreen !== false,
    mouse: opts.mouse !== false
  });
});
program.command("chat").description(t("cli.chat")).option("-m, --model <id>", t("ui.modelIdHint")).option("-s, --system <prompt>", t("ui.systemPromptHint")).option("--transcript <path>", t("ui.transcriptHint")).option("--preset <name>", t("ui.presetHint")).option("--budget <usd>", t("ui.budgetHint"), (v) => Number.parseFloat(v)).option("--session <name>", t("ui.sessionNameHint")).option("--no-session", t("ui.ephemeralHint")).option("-r, --resume", t("ui.resumeHint")).option("-c, --continue", t("cli.continue")).option("-n, --new", t("ui.newHint")).option(
  "--mcp <spec>",
  t("ui.mcpSpecHint"),
  (value, previous = []) => [...previous, value],
  []
).option("--mcp-prefix <str>", t("ui.mcpPrefixHint")).option("--no-config", t("ui.noConfigHint")).option("--no-dashboard", t("ui.noDashboard")).option("--dashboard-port <port>", t("ui.dashboardPortHint")).option("--no-alt-screen", "keep chat output in shell scrollback (legacy mode, ghost-prone)").option("--no-mouse", "disable SGR mouse tracking (keeps drag-select 100% native)").action(async (opts) => {
  const defaults = resolveDefaults({
    model: opts.model,
    mcp: opts.mcp,
    session: opts.session,
    preset: opts.preset,
    noConfig: opts.config === false
  });
  const continueOpts = opts.resume ? { session: defaults.session, forceResume: true } : resolveContinueFlag(
    opts.continue,
    defaults.session,
    () => listSessions()[0],
    (msg) => process.stderr.write(`${msg}
`)
  );
  const { chatCommand } = await import("./chat-EVPUW4A4.js");
  await chatCommand({
    model: defaults.model,
    system: applyMemoryStack(opts.system ?? defaultSystemPrompt(defaults.model), process.cwd()),
    transcript: opts.transcript,
    budgetUsd: parseBudgetFlag(opts.budget),
    session: continueOpts.session,
    mcp: defaults.mcp,
    mcpPrefix: opts.mcpPrefix,
    forceResume: continueOpts.forceResume,
    forceNew: !!opts.new,
    noDashboard: opts.dashboard === false,
    dashboardPort: resolveDashboardPort(
      parseDashboardPortFlag(opts.dashboardPort),
      opts.config === false
    ),
    altScreen: opts.altScreen !== false,
    mouse: opts.mouse !== false
  });
});
program.command("run <task>").description(t("cli.run")).option("-m, --model <id>", t("ui.modelIdHint")).option("-s, --system <prompt>", t("ui.systemPromptHint")).option("--preset <name>", t("ui.presetHintShort")).option("--budget <usd>", t("ui.budgetHintShort"), (v) => Number.parseFloat(v)).option("--transcript <path>", t("ui.transcriptHintShort")).option(
  "--mcp <spec>",
  t("ui.mcpSpecHintShort"),
  (value, previous = []) => [...previous, value],
  []
).option("--mcp-prefix <str>", t("ui.mcpPrefixHintShort")).option("--no-config", t("ui.noConfigHint")).action(async (task, opts) => {
  const defaults = resolveDefaults({
    model: opts.model,
    mcp: opts.mcp,
    preset: opts.preset,
    noConfig: opts.config === false
  });
  const { runCommand } = await import("./run-TG7NE73J.js");
  await runCommand({
    task,
    model: defaults.model,
    system: applyMemoryStack(opts.system ?? defaultSystemPrompt(defaults.model), process.cwd()),
    budgetUsd: parseBudgetFlag(opts.budget),
    transcript: opts.transcript,
    mcp: defaults.mcp,
    mcpPrefix: opts.mcpPrefix
  });
});
program.command("stats [transcript]").description(t("cli.stats")).action(async (transcript) => {
  const { statsCommand } = await import("./stats-5RJCATCE.js");
  statsCommand({ transcript });
});
program.command("doctor").description(t("cli.doctor")).option("--json", t("ui.jsonHint")).action(async (opts) => {
  const { doctorCommand } = await import("./doctor-ISVGUPT2.js");
  await doctorCommand({ json: !!opts.json });
});
program.command("commit").description(t("cli.commit")).option("-m, --model <id>", t("ui.modelOverrideFlash")).option("-y, --yes", t("ui.skipConfirmHint")).action(async (opts) => {
  const { commitCommand } = await import("./commit-R6SC44W5.js");
  await commitCommand({ model: opts.model, yes: !!opts.yes });
});
program.command("sessions [name]").description(t("cli.sessions")).option("-v, --verbose", t("ui.verboseHint")).action(async (name, opts) => {
  const { sessionsCommand } = await import("./sessions-XFGZNOOJ.js");
  sessionsCommand({ name, verbose: !!opts.verbose });
});
program.command("prune-sessions").description(t("cli.pruneSessions")).option("--days <n>", t("ui.pruneDaysHint"), (v) => Number.parseInt(v, 10)).option("--dry-run", t("ui.pruneDryRunHint")).action(async (opts) => {
  const { pruneSessionsCommand } = await import("./prune-sessions-FCFOYCBP.js");
  pruneSessionsCommand({ days: opts.days, dryRun: !!opts.dryRun });
});
program.command("events <name>").description(t("cli.events")).option("--type <type>", t("ui.eventTypeHint")).option("--since <id>", t("ui.eventSinceHint"), (v) => Number.parseInt(v, 10)).option("--tail <n>", t("ui.eventTailHint"), (v) => Number.parseInt(v, 10)).option("--json", t("ui.jsonHint")).option("--projection", t("ui.projectionHint")).action(async (name, opts) => {
  const { eventsCommand } = await import("./events-SQXPVV7B.js");
  eventsCommand({
    name,
    type: opts.type,
    since: Number.isFinite(opts.since) ? opts.since : void 0,
    tail: Number.isFinite(opts.tail) ? opts.tail : void 0,
    json: !!opts.json,
    projection: !!opts.projection
  });
});
program.command("replay <transcript>").description(t("cli.replay")).option("--print", t("ui.printHint")).option("--head <n>", t("ui.headHint"), (v) => Number.parseInt(v, 10)).option("--tail <n>", t("ui.tailHint"), (v) => Number.parseInt(v, 10)).action(async (transcript, opts) => {
  const { replayCommand } = await import("./replay-ZDS4TDXB.js");
  await replayCommand({
    path: transcript,
    print: !!opts.print,
    head: Number.isFinite(opts.head) ? opts.head : void 0,
    tail: Number.isFinite(opts.tail) ? opts.tail : void 0
  });
});
program.command("diff <a> <b>").description(t("cli.diff")).option("--md <path>", t("ui.mdReportHint")).option("--print", t("ui.printHintTable")).option("--tui", t("ui.tuiHint")).option("--label-a <label>", t("ui.labelAHint")).option("--label-b <label>", t("ui.labelBHint")).action(async (a, b, opts) => {
  const { diffCommand } = await import("./diff-RO2QQBNN.js");
  await diffCommand({
    a,
    b,
    mdPath: opts.md,
    labelA: opts.labelA,
    labelB: opts.labelB,
    print: !!opts.print,
    tui: !!opts.tui
  });
});
var mcp = program.command("mcp").description(t("cli.mcp"));
mcp.command("list").description(t("ui.mcpListDescription")).option("--json", t("ui.jsonHintCatalog")).option("--local", t("ui.mcpLocalHint")).option("--refresh", t("ui.mcpRefreshHint")).option("--limit <n>", t("ui.mcpLimitHint"), (v) => Number.parseInt(v, 10)).option("--pages <n>", t("ui.mcpPagesHint"), (v) => Number.parseInt(v, 10)).option("--all", t("ui.mcpAllHint")).action(async (opts) => {
  try {
    const { mcpListCommand } = await import("./mcp-RABKZDX4.js");
    await mcpListCommand({
      json: !!opts.json,
      local: !!opts.local,
      refresh: !!opts.refresh,
      limit: typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : void 0,
      pages: typeof opts.pages === "number" && opts.pages > 0 ? opts.pages : void 0,
      all: !!opts.all
    });
  } catch (err) {
    process.stderr.write(`mcp list failed: ${err.message}
`);
    process.exit(1);
  }
});
mcp.command("search <query>").description(t("ui.mcpSearchDescription")).option("--json", t("ui.jsonHintCatalog")).option("--refresh", t("ui.mcpRefreshHint")).option("--limit <n>", t("ui.mcpLimitHint"), (v) => Number.parseInt(v, 10)).option("--max-pages <n>", t("ui.mcpMaxPagesHint"), (v) => Number.parseInt(v, 10)).action(async (query, opts) => {
  try {
    const { mcpSearchCommand } = await import("./mcp-RABKZDX4.js");
    await mcpSearchCommand(query, {
      json: !!opts.json,
      refresh: !!opts.refresh,
      limit: typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : void 0,
      maxPages: typeof opts.maxPages === "number" && opts.maxPages > 0 ? opts.maxPages : void 0
    });
  } catch (err) {
    process.stderr.write(`mcp search failed: ${err.message}
`);
    process.exit(1);
  }
});
mcp.command("install <name>").description(t("ui.mcpInstallDescription")).option("--refresh", t("ui.mcpRefreshHint")).option("--max-pages <n>", t("ui.mcpMaxPagesHint"), (v) => Number.parseInt(v, 10)).action(async (name, opts) => {
  try {
    const { mcpInstallCommand } = await import("./mcp-RABKZDX4.js");
    await mcpInstallCommand(name, {
      refresh: !!opts.refresh,
      maxPages: typeof opts.maxPages === "number" && opts.maxPages > 0 ? opts.maxPages : void 0
    });
  } catch (err) {
    process.stderr.write(`mcp install failed: ${err.message}
`);
    process.exit(1);
  }
});
mcp.command("browse").description(t("ui.mcpBrowseDescription")).action(async () => {
  try {
    const { mcpBrowseCommand } = await import("./mcp-browse-H6O73SHN.js");
    await mcpBrowseCommand();
  } catch (err) {
    process.stderr.write(`mcp browse failed: ${err.message}
`);
    process.exit(1);
  }
});
mcp.command("inspect <spec>").description(t("ui.mcpInspectDescription")).option("--json", t("ui.jsonHintReport")).action(async (spec, opts) => {
  const { formatMcpInspectFailure, mcpInspectCommand } = await import("./mcp-inspect-XWBO52H6.js");
  try {
    await mcpInspectCommand({ spec, json: !!opts.json });
  } catch (err) {
    process.stderr.write(`mcp inspect failed: ${formatMcpInspectFailure(err)}
`);
    process.exit(1);
  }
});
program.command("version").description(t("cli.version")).action(async () => {
  const { versionCommand } = await import("./version-DPEVFI6I.js");
  versionCommand();
});
program.command("update").description(t("cli.update")).option("--dry-run", t("ui.dryRunHint")).action(async (opts) => {
  const { updateCommand } = await import("./update-GUCWB4UN.js");
  await updateCommand({ dryRun: !!opts.dryRun });
});
program.command("index").description(t("cli.index")).option("--rebuild", t("ui.rebuildHint")).option("--model <name>", t("ui.embedModelHint")).option("--dir <path>", t("ui.projectDirHint")).option("--ollama-url <url>", t("ui.ollamaUrlHint")).option("-y, --yes", t("ui.skipPromptsHint")).action(
  async (opts) => {
    const { indexCommand } = await import("./commands-PJMHSP3Z.js");
    await indexCommand(opts);
  }
);
program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
//# sourceMappingURL=index.js.map