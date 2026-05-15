#!/usr/bin/env node
import {
  bootstrapSemanticSearchInCodeMode
} from "./chunk-V5D77TFD.js";
import {
  chatCommand
} from "./chunk-VM6A6QLY.js";
import "./chunk-BQNUJJN7.js";
import {
  preflightStdioSpec
} from "./chunk-7G3SESEU.js";
import "./chunk-MRLXEMZ7.js";
import {
  markPhase
} from "./chunk-CPOV2O73.js";
import {
  ToolRegistry,
  registerChoiceTool,
  registerFilesystemTools,
  registerMemoryTools,
  registerPlanTool,
  registerTodoTool
} from "./chunk-BTSIAOUG.js";
import {
  parseMcpSpec
} from "./chunk-SJNIIH5W.js";
import "./chunk-XJLZ4HKU.js";
import "./chunk-XHQIK7B6.js";
import "./chunk-DDA76P44.js";
import "./chunk-NLV2YORE.js";
import "./chunk-SUZRC4NC.js";
import "./chunk-MHDNZXJJ.js";
import "./chunk-JBBMMYOI.js";
import "./chunk-AFFZF3MW.js";
import "./chunk-DAEAAVDF.js";
import "./chunk-KMWKGPFZ.js";
import "./chunk-3Q3C4W66.js";
import "./chunk-4DCHFFEY.js";
import "./chunk-WJ3YX4PZ.js";
import "./chunk-TPDWAMG6.js";
import "./chunk-SOZE7V7V.js";
import "./chunk-6NMWJSES.js";
import {
  JobRegistry,
  registerShellTools
} from "./chunk-NTVW2TWO.js";
import {
  SkillStore,
  detectForeignAgentPlatform
} from "./chunk-6DR4F3MC.js";
import {
  MCP_CATALOG
} from "./chunk-FM57FNPJ.js";
import "./chunk-4D662BWT.js";
import "./chunk-CGX5GIW6.js";
import "./chunk-5X7LZJDE.js";
import {
  sanitizeName
} from "./chunk-6CXT5JRM.js";
import {
  t
} from "./chunk-TWJAH4XD.js";
import {
  defaultConfigPath,
  loadEditMode,
  loadProjectShellAllowed,
  readConfig,
  writeConfig
} from "./chunk-SWLIVNTP.js";
import "./chunk-ZTLZO42A.js";
import "./chunk-ORM6PK57.js";
import "./chunk-CRPQUBP6.js";

// src/cli/commands/code.tsx
import { readFileSync } from "fs";
import { basename, resolve } from "path";

// src/tools/scaffold.ts
var VALID_SKILL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
var VALID_SERVER_NAME = /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/;
var VALID_TOOL_NAME = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
function registerScaffoldTools(registry, opts = {}) {
  const configPath = opts.configPath ?? defaultConfigPath();
  registry.register({
    name: "create_skill",
    description: 'Scaffold a new skill (`SKILL.md` in `.visionox/skills/<name>.md`) the user can invoke later via `/skill <name>`. Use this when the user asks the agent to add a playbook, automate a recurring workflow, or capture a multi-step recipe as a named skill. The frontmatter is filled from the structured args here (description / allowed_tools / run_as / model) so the model never has to write raw YAML. Use `run_as: "subagent"` for read-and-synthesize playbooks where only the final answer should come back; default `"inline"` appends the body to the parent log so the user sees the steps. Refuses to overwrite an existing skill \u2014 pick a different name or ask the user to delete the old one.',
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Skill identifier \u2014 letters/digits/`_`/`-`/`.`, 1\u201364 chars. Becomes the `name` frontmatter and the `<name>.md` filename."
        },
        description: {
          type: "string",
          description: 'One-line summary shown in the pinned skills index. Lead with the verb ("Run X and \u2026") so the parent agent can scan it.'
        },
        body: {
          type: "string",
          description: "Markdown body of the skill \u2014 the playbook the model follows when invoked. Plain prose + bullets; reference tools by name."
        },
        scope: {
          type: "string",
          enum: ["project", "global"],
          description: "`project` = `.visionox/skills/` under the workspace (default, requires `reasonix code`); `global` = `~/.visionox/skills/` shared across all repos."
        },
        allowed_tools: {
          type: "array",
          items: { type: "string" },
          description: "Optional whitelist of tool names the subagent registry is scoped to (only meaningful for `run_as: subagent`). Common values: `read_file`, `search_content`, `directory_tree`, `run_command`. Omit to give the subagent the full inherited toolset."
        },
        run_as: {
          type: "string",
          enum: ["inline", "subagent"],
          description: "`inline` (default) appends the body to the parent log as a tool result. `subagent` spawns an isolated child loop and only the final answer comes back \u2014 use for read-and-synthesize playbooks (explore, research, review)."
        },
        model: {
          type: "string",
          enum: ["deepseek-v4-flash", "deepseek-v4-pro"],
          description: "Subagent model override (only meaningful for `run_as: subagent`). Default is the same as `spawn_subagent` \u2014 `deepseek-v4-flash`. Set to `deepseek-v4-pro` only when the playbook empirically needs the stronger model."
        }
      },
      required: ["name", "description", "body"]
    },
    fn: async (args) => {
      const name = typeof args.name === "string" ? args.name.trim() : "";
      if (!VALID_SKILL_NAME.test(name)) {
        return JSON.stringify({
          error: `invalid skill name: ${JSON.stringify(name)} \u2014 use letters, digits, _, -, .`
        });
      }
      const description = typeof args.description === "string" ? args.description.trim().replace(/\n+/g, " ") : "";
      if (!description) {
        return JSON.stringify({
          error: "create_skill requires a non-empty 'description'"
        });
      }
      const body = typeof args.body === "string" ? args.body : "";
      if (!body.trim()) {
        return JSON.stringify({ error: "create_skill requires a non-empty 'body'" });
      }
      const scope = args.scope === "global" ? "global" : opts.projectRoot ? "project" : "global";
      const runAs = args.run_as === "subagent" ? "subagent" : "inline";
      const allowedTools = parseAllowedTools(args.allowed_tools);
      if (allowedTools && "error" in allowedTools) {
        return JSON.stringify({ error: allowedTools.error });
      }
      const model = typeof args.model === "string" && args.model.startsWith("deepseek-") ? args.model : void 0;
      const content = serializeSkill({
        name,
        description,
        runAs,
        allowedTools: allowedTools ?? void 0,
        model,
        body
      });
      const store = new SkillStore({
        homeDir: opts.homeDir,
        projectRoot: opts.projectRoot
      });
      const result = store.createWithContent(name, scope, content);
      if ("error" in result) {
        return JSON.stringify({ error: result.error });
      }
      return JSON.stringify({
        success: true,
        path: result.path,
        scope,
        name,
        run_as: runAs
      });
    }
  });
  registry.register({
    name: "add_mcp_server",
    description: 'Register a new MCP server in the user\'s Reasonix config (`mcp` array). Takes effect on the next session \u2014 does NOT spawn the server now. Use stdio for local commands (npx packages, local binaries), `sse` or `streamable-http` for remote endpoints. Pass `from_catalog: "<name>"` (e.g. `"filesystem"`, `"memory"`, `"github"`) to auto-fill `command` + `args` from the bundled catalog \u2014 the user still has to supply user-args (filesystem: a sandbox dir; github: GITHUB_PERSONAL_ACCESS_TOKEN in env). Refuses to add a server whose name collides with an existing entry.',
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Server name \u2014 used as the namespace prefix on every tool the server exposes. Letters/digits/`_`/`-`, must start with a letter or `_`."
        },
        transport: {
          type: "string",
          enum: ["stdio", "sse", "streamable-http"],
          description: "`stdio` = spawn a local command and pipe MCP over stdin/stdout. `sse` = HTTP+SSE remote. `streamable-http` = Streamable HTTP remote. Required unless `from_catalog` is set."
        },
        command: {
          type: "string",
          description: 'Argv[0] for stdio servers \u2014 typically `npx` or a binary path. Required when `transport: "stdio"` (and no `from_catalog`).'
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: 'Remaining argv for stdio servers \u2014 e.g. `["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]`. The dir at the tail is enforced to exist by the preflight check.'
        },
        url: {
          type: "string",
          description: "Endpoint URL for `sse` / `streamable-http` transports. Must be `http://` or `https://`."
        },
        from_catalog: {
          type: "string",
          description: "Optional shortcut \u2014 name out of the bundled catalog (`filesystem`, `memory`, `github`, `puppeteer`, `everything`). When set, fills `command` + `args` from the catalog entry; you still supply `name` (defaults to the catalog name) and any user-args via `args`."
        }
      },
      required: ["name"]
    },
    fn: async (args) => {
      const name = typeof args.name === "string" ? args.name.trim() : "";
      if (!VALID_SERVER_NAME.test(name)) {
        return JSON.stringify({
          error: `invalid server name: ${JSON.stringify(name)} \u2014 must match [a-zA-Z_][a-zA-Z0-9_-]*`
        });
      }
      const specStr = buildSpecString({
        name,
        transport: typeof args.transport === "string" ? args.transport : void 0,
        command: typeof args.command === "string" ? args.command : void 0,
        argv: Array.isArray(args.args) ? args.args.filter((a) => typeof a === "string") : void 0,
        url: typeof args.url === "string" ? args.url : void 0,
        fromCatalog: typeof args.from_catalog === "string" ? args.from_catalog : void 0
      });
      if ("error" in specStr) {
        return JSON.stringify({ error: specStr.error });
      }
      let parsed;
      try {
        parsed = parseMcpSpec(specStr.spec);
      } catch (err) {
        return JSON.stringify({ error: err.message });
      }
      if (parsed.transport === "stdio") {
        try {
          preflightStdioSpec(parsed);
        } catch (err) {
          return JSON.stringify({ error: err.message });
        }
      }
      const cfg = readConfig(configPath);
      const existing = cfg.mcp ?? [];
      const collision = existing.find((s) => parseSpecName(s) === name);
      if (collision) {
        return JSON.stringify({
          error: `MCP server ${JSON.stringify(name)} already registered: ${collision}`
        });
      }
      cfg.mcp = [...existing, specStr.spec];
      writeConfig(cfg, configPath);
      return JSON.stringify({
        success: true,
        name,
        transport: parsed.transport,
        spec: specStr.spec,
        config_path: configPath,
        active_on_next_launch: true
      });
    }
  });
  return registry;
}
function serializeSkill(args) {
  const lines = ["---", `name: ${args.name}`, `description: ${args.description}`];
  if (args.runAs === "subagent") {
    lines.push("runAs: subagent");
  }
  if (args.allowedTools && args.allowedTools.length > 0) {
    lines.push(`allowed-tools: ${args.allowedTools.join(", ")}`);
  }
  if (args.model) {
    lines.push(`model: ${args.model}`);
  }
  lines.push("---", "");
  return `${lines.join("\n")}
${args.body.trim()}
`;
}
function parseAllowedTools(raw) {
  if (raw === void 0 || raw === null) return void 0;
  if (!Array.isArray(raw)) {
    return { error: "'allowed_tools' must be an array of tool-name strings" };
  }
  const out = [];
  for (const v of raw) {
    if (typeof v !== "string") {
      return { error: "'allowed_tools' entries must be strings" };
    }
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (!VALID_TOOL_NAME.test(trimmed)) {
      return { error: `invalid tool name in allowed_tools: ${JSON.stringify(trimmed)}` };
    }
    out.push(trimmed);
  }
  return out.length > 0 ? out : void 0;
}
function buildSpecString(input) {
  if (input.fromCatalog) {
    const entry = MCP_CATALOG.find((e) => e.name === input.fromCatalog);
    if (!entry) {
      const known = MCP_CATALOG.map((e) => e.name).join(", ");
      return {
        error: `unknown catalog entry: ${JSON.stringify(input.fromCatalog)} \u2014 known: ${known}`
      };
    }
    const userArgs = input.argv ?? [];
    if (entry.userArgs && userArgs.length === 0) {
      return {
        error: `catalog entry "${entry.name}" needs ${entry.userArgs} \u2014 pass it via the 'args' parameter`
      };
    }
    const tail = userArgs.map(quoteIfNeeded).join(" ");
    const body = `npx -y ${entry.package}${tail ? ` ${tail}` : ""}`;
    return { spec: `${input.name}=${body}` };
  }
  const transport = input.transport;
  if (!transport) {
    return { error: "add_mcp_server requires 'transport' (or 'from_catalog')" };
  }
  if (transport === "stdio") {
    if (!input.command || !input.command.trim()) {
      return { error: "stdio transport requires 'command'" };
    }
    const tail = (input.argv ?? []).map(quoteIfNeeded).join(" ");
    const body = `${quoteIfNeeded(input.command.trim())}${tail ? ` ${tail}` : ""}`;
    return { spec: `${input.name}=${body}` };
  }
  if (transport === "sse" || transport === "streamable-http") {
    if (!input.url || !/^https?:\/\//i.test(input.url)) {
      return { error: `${transport} transport requires an http(s):// 'url'` };
    }
    const prefix = transport === "streamable-http" ? "streamable+" : "";
    return { spec: `${input.name}=${prefix}${input.url.trim()}` };
  }
  return { error: `unknown transport: ${JSON.stringify(transport)}` };
}
function parseSpecName(spec) {
  const m = spec.trim().match(/^([a-zA-Z_][a-zA-Z0-9_-]*)=/);
  return m ? m[1] ?? null : null;
}
function quoteIfNeeded(s) {
  return /\s|"/.test(s) ? `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : s;
}

// src/cli/commands/code.tsx
async function codeCommand(opts = {}) {
  markPhase("code_command_enter");
  const { codeSystemPrompt } = await import("./prompt-CZSOFYK6.js");
  const rootDir = resolve(opts.dir ?? process.cwd());
  const session = opts.noSession ? void 0 : `code-${sanitizeName(basename(rootDir))}`;
  const tools = new ToolRegistry();
  const jobs = new JobRegistry();
  const registerRootedTools = (root) => {
    registerFilesystemTools(tools, { rootDir: root });
    registerShellTools(tools, {
      rootDir: root,
      // Per-project "always allow" list persisted from prior ShellConfirm
      // choices; merged on top of the built-in allowlist in shell.ts.
      // GETTER form — re-read every dispatch so a prefix the user adds
      // via ShellConfirm mid-session takes effect on the next shell call
      // instead of waiting for `/new` or a relaunch.
      extraAllowed: () => loadProjectShellAllowed(root),
      // `yolo` edit-mode disables shell confirmations entirely. Re-read
      // from config on each dispatch so /mode yolo (or Shift+Tab cycling
      // through to it) flips the gate live without forcing a relaunch.
      allowAll: () => loadEditMode() === "yolo",
      jobs
    });
    registerMemoryTools(tools, { projectRoot: root });
  };
  const reBootstrapSemantic = async (root) => {
    const result = await bootstrapSemanticSearchInCodeMode(tools, root);
    if (!result.enabled) tools.unregister("semantic_search");
    return result;
  };
  registerRootedTools(rootDir);
  registerPlanTool(tools);
  registerChoiceTool(tools);
  registerTodoTool(tools);
  registerScaffoldTools(tools, { projectRoot: rootDir });
  markPhase("semantic_bootstrap_start");
  const semantic = await reBootstrapSemantic(rootDir);
  markPhase(
    semantic.enabled ? "semantic_bootstrap_done_enabled" : "semantic_bootstrap_done_skipped"
  );
  process.stderr.write(
    `${t("startup.codeRooted", {
      rootDir,
      session: session ?? t("startup.ephemeral"),
      tools: tools.size,
      semantic: semantic.enabled ? t("startup.semanticOn") : ""
    })}
`
  );
  const foreign = detectForeignAgentPlatform(rootDir);
  if (foreign) {
    process.stderr.write(
      `\u26A0 workspace contains another agent platform's files (${foreign.join(", ")}). Reasonix Code may read them as project content; relaunch with --dir <your-project> if that's not what you want.
`
    );
  }
  process.once("exit", () => {
    void jobs.shutdown();
  });
  let systemAppendFileContents;
  if (opts.systemAppend !== void 0 && opts.systemAppend.trim().length === 0) {
    process.stderr.write("--system-append is empty \u2014 no prompt text will be appended\n");
  }
  if (opts.systemAppendFile) {
    const filePath = resolve(opts.systemAppendFile);
    try {
      systemAppendFileContents = readFileSync(filePath, "utf8");
    } catch (err) {
      const e = err;
      process.stderr.write(
        `Error: cannot read --system-append-file "${filePath}": ${e.code ? `[${e.code}] ` : ""}${e.message}
`
      );
      process.exit(1);
    }
  }
  await chatCommand({
    model: opts.model ?? "deepseek-v4-flash",
    budgetUsd: opts.budgetUsd,
    system: codeSystemPrompt(rootDir, {
      hasSemanticSearch: semantic.enabled,
      systemAppend: opts.systemAppend,
      systemAppendFile: systemAppendFileContents,
      modelId: opts.model ?? "deepseek-v4-flash"
    }),
    transcript: opts.transcript,
    session,
    seedTools: tools,
    codeMode: {
      rootDir,
      jobs,
      reregisterTools: registerRootedTools,
      reBootstrapSemantic
    },
    mcp: readConfig().mcp,
    forceResume: opts.forceResume,
    forceNew: opts.forceNew,
    noDashboard: opts.noDashboard,
    dashboardPort: opts.dashboardPort,
    altScreen: opts.altScreen,
    mouse: opts.mouse
  });
}
export {
  codeCommand
};
//# sourceMappingURL=code-TTOCA52N.js.map