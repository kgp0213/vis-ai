#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  buildCodeToolset
} from "./chunk-YFGF5NKA.js";
import {
  Eventizer,
  autoResolveVerdict
} from "./chunk-45U62RI3.js";
import {
  formatMcpLifecycleEvent,
  formatMcpSlowToast
} from "./chunk-H6PS7IUE.js";
import {
  buildTransportFromSpec,
  preflightStdioSpec
} from "./chunk-PQXPXJBJ.js";
import {
  CacheFirstLoop,
  ImmutablePrefix,
  bridgeMcpTools
} from "./chunk-2R4QCDOZ.js";
import "./chunk-F3PXYSNN.js";
import {
  openTranscriptFile,
  recordFromLoopEvent,
  writeRecord
} from "./chunk-FHOGSSCH.js";
import {
  McpClient,
  parseMcpSpec
} from "./chunk-6AK4EY3D.js";
import {
  codeSystemPrompt
} from "./chunk-5JJRUIPA.js";
import {
  canonicalPresetName,
  resolvePreset
} from "./chunk-2425HK6U.js";
import "./chunk-PV55UMTO.js";
import {
  DeepSeekClient
} from "./chunk-2KDUS647.js";
import "./chunk-25T6CVUP.js";
import {
  loadDotenv
} from "./chunk-2UQP6H6T.js";
import "./chunk-YYQAUTTN.js";
import {
  pauseGate
} from "./chunk-O52OLQL3.js";
import "./chunk-2K65GZBT.js";
import "./chunk-PLHAZOLZ.js";
import "./chunk-XCGGEJTI.js";
import "./chunk-7O5ALB4C.js";
import "./chunk-S4XVGLRW.js";
import {
  timestampSuffix
} from "./chunk-6PBZN4VI.js";
import {
  t
} from "./chunk-RE4RAVFF.js";
import {
  loadApiKey,
  loadBaseUrl,
  loadEditMode,
  loadPreset,
  loadReasoningEffort,
  mcpEnvFor,
  readConfig
} from "./chunk-XPDVG52A.js";
import "./chunk-HFEAY5DT.js";
import "./chunk-YQ6NTIIE.js";
import {
  VERSION
} from "./chunk-XXC2BYTV.js";
import "./chunk-TUK7OWJA.js";

// src/cli/commands/acp.ts
import { AsyncLocalStorage } from "async_hooks";
import { existsSync, statSync } from "fs";
import { resolve } from "path";

// src/acp/dispatch.ts
var READ_TOOLS = /* @__PURE__ */ new Set([
  "read_file",
  "list_directory",
  "directory_tree",
  "get_file_info",
  "glob"
]);
var EDIT_TOOLS = /* @__PURE__ */ new Set([
  "write_file",
  "append_file",
  "edit_file",
  "multi_edit",
  "create_directory",
  "delete_file",
  "delete_directory",
  "move_file",
  "copy_file"
]);
var SEARCH_TOOLS = /* @__PURE__ */ new Set(["search_content", "search_files"]);
var EXECUTE_TOOLS = /* @__PURE__ */ new Set(["run_command", "run_background"]);
function toolKindFor(name) {
  if (READ_TOOLS.has(name)) return "read";
  if (EDIT_TOOLS.has(name)) return "edit";
  if (SEARCH_TOOLS.has(name)) return "search";
  if (EXECUTE_TOOLS.has(name)) return "execute";
  return "other";
}
function tryParseJson(raw) {
  if (!raw) return void 0;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
function dispatchKernelEvent(server, sessionId, ev) {
  switch (ev.type) {
    case "model.delta": {
      if (!ev.text) return;
      const variant = ev.channel === "reasoning" ? "agent_thought_chunk" : "agent_message_chunk";
      emit(server, {
        sessionId,
        update: { sessionUpdate: variant, content: { type: "text", text: ev.text } }
      });
      return;
    }
    case "tool.preparing": {
      emit(server, {
        sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId: ev.callId,
          title: ev.name,
          kind: toolKindFor(ev.name),
          status: "pending"
        }
      });
      return;
    }
    case "tool.intent": {
      emit(server, {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: ev.callId,
          status: "in_progress"
        }
      });
      const rawInput = tryParseJson(ev.args);
      if (rawInput !== void 0) {
        emit(server, {
          sessionId,
          update: {
            sessionUpdate: "tool_call",
            toolCallId: ev.callId,
            title: ev.name,
            kind: toolKindFor(ev.name),
            status: "in_progress",
            rawInput
          }
        });
      }
      return;
    }
    case "tool.result": {
      emit(server, {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: ev.callId,
          status: ev.ok ? "completed" : "failed",
          content: [
            {
              type: "content",
              content: { type: "text", text: clip(ev.output) }
            }
          ]
        }
      });
      return;
    }
    default:
      return;
  }
}
var MAX_RESULT_CHARS = 8e3;
function clip(text) {
  if (text.length <= MAX_RESULT_CHARS) return text;
  return `${text.slice(0, MAX_RESULT_CHARS)}
\u2026(${text.length - MAX_RESULT_CHARS} more chars truncated)`;
}
function emit(server, params) {
  server.sendNotification("session/update", params);
}

// src/acp/gates.ts
var ID_ALLOW_ONCE = "allow_once";
var ID_ALLOW_ALWAYS = "allow_always";
var ID_REJECT = "reject";
var ID_REFINE = "refine";
var ID_REVISE = "revise";
var ID_STOP = "stop";
var ID_CANCEL = "cancel";
var ID_ACCEPT = "accept";
function permissionOptionsFor(req) {
  switch (req.kind) {
    case "run_command":
    case "run_background":
    case "path_access":
      return [
        { optionId: ID_ALLOW_ONCE, name: "Allow once", kind: "allow_once" },
        { optionId: ID_ALLOW_ALWAYS, name: "Allow always", kind: "allow_always" },
        { optionId: ID_REJECT, name: "Reject", kind: "reject_once" }
      ];
    case "plan_proposed":
      return [
        { optionId: ID_ALLOW_ONCE, name: "Approve plan", kind: "allow_once" },
        { optionId: ID_REFINE, name: "Refine", kind: "allow_once" },
        { optionId: ID_CANCEL, name: "Cancel", kind: "reject_once" }
      ];
    case "plan_checkpoint":
      return [
        { optionId: ID_ALLOW_ONCE, name: "Continue", kind: "allow_once" },
        { optionId: ID_REVISE, name: "Revise", kind: "allow_once" },
        { optionId: ID_STOP, name: "Stop", kind: "reject_once" }
      ];
    case "plan_revision":
      return [
        { optionId: ID_ACCEPT, name: "Accept revision", kind: "allow_once" },
        { optionId: ID_REJECT, name: "Keep original plan", kind: "reject_once" }
      ];
    case "choice": {
      const payload = req.payload;
      const opts = (payload.options ?? []).map((o) => ({
        optionId: o.id,
        name: o.title ?? o.id,
        kind: "allow_once"
      }));
      opts.push({ optionId: ID_CANCEL, name: "Cancel", kind: "reject_once" });
      return opts;
    }
  }
}
function commandPrefix(command) {
  const first = command.trim().split(/\s+/)[0] ?? command.trim();
  return `${first} *`;
}
function pathPrefix(p) {
  return p;
}
function verdictFor(req, result) {
  const cancelled = result.outcome.outcome === "cancelled";
  const optionId = result.outcome.outcome === "selected" ? result.outcome.optionId : null;
  switch (req.kind) {
    case "run_command":
    case "run_background": {
      if (cancelled || optionId === ID_REJECT) return { type: "deny" };
      if (optionId === ID_ALLOW_ALWAYS) {
        const payload = req.payload;
        return { type: "always_allow", prefix: commandPrefix(payload.command ?? "") };
      }
      return { type: "run_once" };
    }
    case "path_access": {
      if (cancelled || optionId === ID_REJECT) return { type: "deny" };
      if (optionId === ID_ALLOW_ALWAYS) {
        const payload = req.payload;
        return { type: "always_allow", prefix: pathPrefix(payload.allowPrefix) };
      }
      return { type: "run_once" };
    }
    case "plan_proposed": {
      if (cancelled || optionId === ID_CANCEL) return { type: "cancel" };
      if (optionId === ID_REFINE) return { type: "refine" };
      return { type: "approve" };
    }
    case "plan_checkpoint": {
      if (cancelled || optionId === ID_STOP) return { type: "stop" };
      if (optionId === ID_REVISE) return { type: "revise" };
      return { type: "continue" };
    }
    case "plan_revision": {
      if (cancelled) return { type: "cancelled" };
      if (optionId === ID_ACCEPT) return { type: "accepted" };
      return { type: "rejected" };
    }
    case "choice": {
      if (cancelled || optionId === ID_CANCEL || !optionId) return { type: "cancel" };
      return { type: "pick", optionId };
    }
  }
}
function permissionTitleFor(req) {
  switch (req.kind) {
    case "run_command":
    case "run_background":
      return `Run command \u2014 ${(req.payload.command ?? "").slice(0, 80)}`;
    case "path_access":
      return `Access path \u2014 ${req.payload.path}`;
    case "plan_proposed":
      return "Approve plan";
    case "plan_checkpoint":
      return `Checkpoint \u2014 ${req.payload.title ?? "step complete"}`;
    case "plan_revision":
      return "Approve plan revision";
    case "choice":
      return req.payload.question ?? "Choose an option";
  }
}
function permissionKindFor(req) {
  if (req.kind === "run_command" || req.kind === "run_background") return "execute";
  if (req.kind === "path_access") {
    return req.payload.intent === "write" ? "edit" : "other";
  }
  return "other";
}
async function requestPermissionForGate(server, sessionId, req) {
  const params = {
    sessionId,
    toolCall: {
      toolCallId: `gate-${req.id}`,
      title: permissionTitleFor(req),
      kind: permissionKindFor(req),
      status: "pending",
      rawInput: req.payload
    },
    options: permissionOptionsFor(req)
  };
  let result;
  try {
    result = await server.sendRequest(
      "session/request_permission",
      params
    );
  } catch {
    result = { outcome: { outcome: "cancelled" } };
  }
  return verdictFor(req, result);
}

// src/acp/protocol.ts
var ACP_PROTOCOL_VERSION = 1;
var ERR_PARSE = -32700;
var ERR_METHOD_NOT_FOUND = -32601;
var ERR_INVALID_PARAMS = -32602;
var ERR_INTERNAL = -32603;
function flattenPrompt(blocks) {
  const parts = [];
  for (const b of blocks) {
    if (b.type === "text") parts.push(b.text);
    else if (b.type === "resource" && b.resource.text) parts.push(b.resource.text);
  }
  return parts.join("\n\n").trim();
}

// src/acp/server.ts
import { createInterface } from "readline";
var AcpServer = class {
  requestHandlers = /* @__PURE__ */ new Map();
  notificationHandlers = /* @__PURE__ */ new Map();
  pending = /* @__PURE__ */ new Map();
  nextOutboundId = 1;
  output;
  rl;
  closed = false;
  constructor(opts = {}) {
    this.output = opts.output ?? process.stdout;
    const input = opts.input ?? process.stdin;
    this.rl = createInterface({ input });
    this.rl.on("line", (line) => {
      void this.handleLine(line);
    });
  }
  onRequest(method, handler) {
    this.requestHandlers.set(method, handler);
  }
  onNotification(method, handler) {
    this.notificationHandlers.set(method, handler);
  }
  sendNotification(method, params) {
    this.write({ jsonrpc: "2.0", method, params });
  }
  /** Send an outbound JSON-RPC request and resolve when the peer responds. */
  sendRequest(method, params) {
    const id = this.nextOutboundId++;
    return new Promise((resolve2, reject) => {
      this.pending.set(id, {
        resolve: resolve2,
        reject
      });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const p of this.pending.values()) p.reject(new Error("server closed"));
    this.pending.clear();
    this.rl.close();
  }
  /** Wait for the input stream to end. */
  done() {
    return new Promise((resolve2) => this.rl.once("close", () => resolve2()));
  }
  write(msg) {
    this.output.write(`${JSON.stringify(msg)}
`);
  }
  writeError(id, code, message) {
    this.write({ jsonrpc: "2.0", id, error: { code, message } });
  }
  async handleLine(raw) {
    const line = raw.trim();
    if (!line) return;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      this.writeError(null, ERR_PARSE, "parse error");
      return;
    }
    if (!parsed || typeof parsed !== "object") {
      this.writeError(null, ERR_PARSE, "expected JSON object");
      return;
    }
    const msg = parsed;
    if (typeof msg.method === "string" && msg.id !== void 0) {
      const id = msg.id;
      const handler = this.requestHandlers.get(msg.method);
      if (!handler) {
        this.writeError(id, ERR_METHOD_NOT_FOUND, `method not found: ${msg.method}`);
        return;
      }
      try {
        const result = await handler(msg.params);
        this.write({ jsonrpc: "2.0", id, result });
      } catch (err) {
        this.writeError(id, ERR_INTERNAL, err.message);
      }
      return;
    }
    if (typeof msg.method === "string" && msg.id === void 0) {
      const handler = this.notificationHandlers.get(msg.method);
      if (!handler) return;
      try {
        await handler(msg.params);
      } catch {
      }
      return;
    }
    if (msg.id !== void 0 && msg.method === void 0) {
      const response = parsed;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response.result);
      }
    }
  }
};

// src/cli/commands/acp.ts
function resolveMcpPrefix(specName, specCount, globalPrefix) {
  if (specName) return `${specName}_`;
  if (specCount === 1 && globalPrefix) return globalPrefix;
  return "";
}
async function loadMcpServers(tools, specs, globalPrefix) {
  const clients = [];
  if (specs.length === 0) return clients;
  const cfg = readConfig();
  const disabledNames = new Set(cfg.mcpDisabled ?? []);
  for (const raw of specs) {
    let label = "anon";
    let mcp;
    try {
      const spec = parseMcpSpec(raw);
      label = spec.name ?? "anon";
      if (spec.name && disabledNames.has(spec.name)) {
        process.stderr.write(`${formatMcpLifecycleEvent({ state: "disabled", name: label })}
`);
        continue;
      }
      process.stderr.write(`${formatMcpLifecycleEvent({ state: "handshake", name: label })}
`);
      const t0 = Date.now();
      const prefix = resolveMcpPrefix(spec.name, specs.length, globalPrefix);
      if (spec.transport === "stdio") preflightStdioSpec(spec);
      const transport = buildTransportFromSpec(spec, { env: mcpEnvFor(spec.name, cfg) });
      mcp = new McpClient({ transport });
      await mcp.initialize();
      const bridge = await bridgeMcpTools(mcp, {
        registry: tools,
        namePrefix: prefix,
        serverName: label,
        onSlow: (info) => process.stderr.write(
          `${formatMcpSlowToast({ name: info.serverName, p95Ms: info.p95Ms, sampleSize: info.sampleSize })}
`
        )
      });
      process.stderr.write(
        `${formatMcpLifecycleEvent({
          state: "connected",
          name: label,
          tools: bridge.registeredNames.length,
          ms: Date.now() - t0
        })}
`
      );
      clients.push(mcp);
    } catch (err) {
      await mcp?.close().catch(() => void 0);
      process.stderr.write(
        `${formatMcpLifecycleEvent({ state: "failed", name: label, reason: err.message })}
  \u2192 ${t("mcpLifecycle.failedSetupConfigHint")}
`
      );
    }
  }
  return clients;
}
function resolveDir(raw, fallback) {
  if (!raw) return fallback;
  const abs = resolve(raw);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new Error(`workspace directory not found: ${abs}`);
  }
  return abs;
}
async function buildSession(opts) {
  const preset = canonicalPresetName(loadPreset());
  const resolved = resolvePreset(preset);
  const model = opts.modelOverride || resolved.model;
  const toolset = await buildCodeToolset({ rootDir: opts.rootDir });
  const mcpClients = await loadMcpServers(toolset.tools, opts.mcpSpecs ?? [], opts.mcpPrefix);
  const system = codeSystemPrompt(opts.rootDir, {
    hasSemanticSearch: toolset.semantic.enabled,
    modelId: model
  });
  const client = new DeepSeekClient({ baseUrl: loadBaseUrl() });
  const prefix = new ImmutablePrefix({ system, toolSpecs: toolset.tools.specs() });
  const loop = new CacheFirstLoop({
    client,
    prefix,
    tools: toolset.tools,
    model,
    budgetUsd: opts.budgetUsd,
    session: `acp-${timestampSuffix()}`
  });
  return {
    id: `sess_${timestampSuffix()}-${Math.random().toString(36).slice(2, 8)}`,
    rootDir: opts.rootDir,
    model,
    toolset,
    mcpClients,
    loop,
    eventizer: new Eventizer(),
    ctx: {
      model,
      prefixHash: prefix.fingerprint,
      reasoningEffort: loadReasoningEffort()
    },
    aborter: null
  };
}
async function acpCommand(opts) {
  loadDotenv();
  if (loadApiKey()) {
    process.env.DEEPSEEK_API_KEY = loadApiKey();
  }
  const defaultDir = resolveDir(opts.dir, process.cwd());
  const sessions = /* @__PURE__ */ new Map();
  const sessionContext = new AsyncLocalStorage();
  const server = new AcpServer();
  let transcriptStream = null;
  if (opts.transcript) {
    const defaultModel = opts.model || resolvePreset(canonicalPresetName(loadPreset())).model;
    transcriptStream = openTranscriptFile(opts.transcript, {
      version: 1,
      source: "reasonix acp",
      model: defaultModel,
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  pauseGate.on((req) => {
    const editMode = opts.yolo ? "yolo" : loadEditMode();
    const auto = autoResolveVerdict(req, editMode);
    if (auto !== null) {
      pauseGate.resolve(req.id, auto);
      return;
    }
    const activeSessionId = sessionContext.getStore();
    if (!activeSessionId || !sessions.has(activeSessionId)) {
      pauseGate.cancel(req.id);
      return;
    }
    void (async () => {
      const verdict = await requestPermissionForGate(server, activeSessionId, req);
      pauseGate.resolve(req.id, verdict);
    })();
  });
  server.onRequest("initialize", (params) => {
    if (!params || typeof params !== "object") {
      throw Object.assign(new Error("initialize: missing params"), { code: ERR_INVALID_PARAMS });
    }
    return {
      protocolVersion: ACP_PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
        promptCapabilities: { image: false, audio: false, embeddedContext: true },
        mcpCapabilities: { http: false, sse: false }
      },
      agentInfo: { name: "reasonix", title: "Reasonix", version: VERSION },
      authMethods: []
    };
  });
  server.onRequest("session/new", async (params) => {
    const rootDir = resolveDir(params?.cwd, defaultDir);
    const session = await buildSession({
      rootDir,
      modelOverride: opts.model,
      budgetUsd: opts.budgetUsd,
      mcpSpecs: opts.mcpSpecs,
      mcpPrefix: opts.mcpPrefix
    });
    sessions.set(session.id, session);
    return { sessionId: session.id };
  });
  server.onRequest("session/prompt", async (params) => {
    if (!params?.sessionId) {
      throw Object.assign(new Error("session/prompt: missing sessionId"), {
        code: ERR_INVALID_PARAMS
      });
    }
    const session = sessions.get(params.sessionId);
    if (!session) {
      throw Object.assign(new Error(`session/prompt: unknown session ${params.sessionId}`), {
        code: ERR_INVALID_PARAMS
      });
    }
    const text = flattenPrompt(params.prompt);
    if (!text) {
      throw Object.assign(new Error("session/prompt: empty prompt"), { code: ERR_INVALID_PARAMS });
    }
    session.aborter = new AbortController();
    let stopReason = "end_turn";
    try {
      await sessionContext.run(session.id, async () => {
        for await (const ev of session.loop.step(text)) {
          if (session.aborter?.signal.aborted) {
            stopReason = "cancelled";
            break;
          }
          if (transcriptStream) {
            writeRecord(
              transcriptStream,
              recordFromLoopEvent(ev, {
                model: session.ctx.model,
                prefixHash: session.ctx.prefixHash
              })
            );
          }
          for (const kev of session.eventizer.consume(ev, session.ctx)) {
            dispatchKernelEvent(server, session.id, kev);
            if (kev.type === "error") stopReason = "error";
          }
        }
      });
    } catch (err) {
      const message = err.message;
      server.sendNotification("session/update", {
        sessionId: session.id,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: `

[error] ${message}` }
        }
      });
      stopReason = "error";
    } finally {
      session.aborter = null;
    }
    return { stopReason };
  });
  server.onNotification("session/cancel", (params) => {
    const session = params?.sessionId ? sessions.get(params.sessionId) : void 0;
    session?.aborter?.abort();
  });
  try {
    await server.done();
  } finally {
    transcriptStream?.end();
    const closes = [];
    for (const session of sessions.values()) {
      for (const mcp of session.mcpClients) {
        closes.push(mcp.close().catch(() => void 0));
      }
    }
    await Promise.all(closes);
  }
}
export {
  acpCommand,
  loadMcpServers
};
//# sourceMappingURL=acp-DAGPCVFZ.js.map
