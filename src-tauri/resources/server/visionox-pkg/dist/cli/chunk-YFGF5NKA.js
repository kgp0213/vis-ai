#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  registerSkillTools
} from "./chunk-45U62RI3.js";
import {
  preflightStdioSpec
} from "./chunk-PQXPXJBJ.js";
import {
  ToolRegistry,
  formatSubagentResult,
  registerChoiceTool,
  registerFilesystemTools,
  registerMemoryTools,
  registerPlanTool,
  registerTodoTool,
  registerWebTools,
  spawnSubagent
} from "./chunk-2R4QCDOZ.js";
import {
  parseMcpSpec
} from "./chunk-6AK4EY3D.js";
import {
  DeepSeekClient
} from "./chunk-2KDUS647.js";
import {
  bootstrapSemanticSearchInCodeMode
} from "./chunk-YYQAUTTN.js";
import {
  JobRegistry,
  registerShellTools
} from "./chunk-O52OLQL3.js";
import {
  SkillStore
} from "./chunk-2K65GZBT.js";
import {
  MCP_CATALOG
} from "./chunk-PLHAZOLZ.js";
import {
  defaultConfigPath,
  loadBaseUrl,
  loadEditMode,
  loadProjectShellAllowed,
  readConfig,
  searchEnabled,
  webSearchEndpoint,
  webSearchEngine,
  writeConfig
} from "./chunk-XPDVG52A.js";

// src/tools/scaffold.ts
var VALID_SKILL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
var VALID_SERVER_NAME = /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/;
var VALID_TOOL_NAME = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
function registerScaffoldTools(registry, opts = {}) {
  const configPath = opts.configPath ?? defaultConfigPath();
  registry.register({
    name: "create_skill",
    description: 'Scaffold a new skill (`SKILL.md` in `.reasonix/skills/<name>.md`) the user can invoke later via `/skill <name>`. Use this when the user asks the agent to add a playbook, automate a recurring workflow, or capture a multi-step recipe as a named skill. The frontmatter is filled from the structured args here (description / allowed_tools / run_as / model) so the model never has to write raw YAML. Use `run_as: "subagent"` for read-and-synthesize playbooks where only the final answer should come back; default `"inline"` appends the body to the parent log so the user sees the steps. Refuses to overwrite an existing skill \u2014 pick a different name or ask the user to delete the old one.',
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
          description: "`project` = `.reasonix/skills/` under the workspace (default, requires `reasonix code`); `global` = `~/.reasonix/skills/` shared across all repos."
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

// src/code/setup.ts
async function buildCodeToolset(opts) {
  const tools = new ToolRegistry();
  const jobs = new JobRegistry();
  const registerRooted = (root) => {
    registerFilesystemTools(tools, { rootDir: root });
    registerShellTools(tools, {
      rootDir: root,
      extraAllowed: () => loadProjectShellAllowed(root),
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
  registerRooted(opts.rootDir);
  registerPlanTool(tools);
  registerChoiceTool(tools);
  registerTodoTool(tools);
  registerScaffoldTools(tools, { projectRoot: opts.rootDir });
  if (searchEnabled()) {
    registerWebTools(tools, {
      webSearchEngine: webSearchEngine(),
      webSearchEndpoint: webSearchEndpoint()
    });
  }
  let subagentClient = null;
  registerSkillTools(tools, {
    projectRoot: opts.rootDir,
    subagentRunner: async (skill, task, signal) => {
      if (!subagentClient) subagentClient = new DeepSeekClient({ baseUrl: loadBaseUrl() });
      const result = await spawnSubagent({
        client: subagentClient,
        parentRegistry: tools,
        parentSignal: signal,
        system: skill.body,
        task,
        model: skill.model,
        allowedTools: skill.allowedTools,
        maxToolIters: skill.maxToolIters,
        skillName: skill.name
      });
      return formatSubagentResult(result);
    }
  });
  const semantic = await reBootstrapSemantic(opts.rootDir);
  return { tools, jobs, registerRooted, reBootstrapSemantic, semantic };
}

export {
  buildCodeToolset
};
//# sourceMappingURL=chunk-YFGF5NKA.js.map