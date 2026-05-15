#!/usr/bin/env node
import {
  MemoryStore,
  sanitizeMemoryName
} from "./chunk-DDA76P44.js";
import {
  countTokens,
  estimateConversationTokens,
  estimateRequestTokens
} from "./chunk-DAEAAVDF.js";
import {
  Usage
} from "./chunk-KMWKGPFZ.js";
import {
  pauseGate
} from "./chunk-NTVW2TWO.js";
import {
  NEGATIVE_CLAIM_RULE,
  TUI_FORMATTING_RULES
} from "./chunk-6DR4F3MC.js";
import {
  formatHookOutcomeMessage,
  runHooks
} from "./chunk-CGX5GIW6.js";
import {
  ignoredByLayers,
  loadGitignoreAt,
  loadGitignoreAtSync
} from "./chunk-5X7LZJDE.js";
import {
  appendSessionMessage,
  archiveSession,
  loadSessionMessages,
  loadSessionMeta,
  rewriteSession
} from "./chunk-6CXT5JRM.js";
import {
  t
} from "./chunk-TWJAH4XD.js";
import {
  DEFAULT_INDEX_EXCLUDES,
  webSearchEndpoint,
  webSearchEngine
} from "./chunk-SWLIVNTP.js";
import {
  DEEPSEEK_CONTEXT_TOKENS,
  DEFAULT_CONTEXT_TOKENS,
  SessionStats
} from "./chunk-ORM6PK57.js";

// src/mcp/latency.ts
var SAMPLE_SIZE = 5;
var DEFAULT_THRESHOLD_MS = 4e3;
var LatencyTracker = class {
  constructor(serverName, opts = {}) {
    this.serverName = serverName;
    this.thresholdMs = opts.thresholdMs ?? DEFAULT_THRESHOLD_MS;
    this.onSlow = opts.onSlow;
  }
  serverName;
  samples = [];
  wasOverThreshold = false;
  thresholdMs;
  onSlow;
  record(elapsedMs) {
    this.samples.push(elapsedMs);
    if (this.samples.length > SAMPLE_SIZE) this.samples.shift();
    if (this.samples.length < SAMPLE_SIZE) return;
    const p95 = computeP95(this.samples);
    const nowOver = p95 > this.thresholdMs;
    if (nowOver && !this.wasOverThreshold) {
      this.onSlow?.({ serverName: this.serverName, p95Ms: p95, sampleSize: this.samples.length });
    }
    this.wasOverThreshold = nowOver;
  }
};
function computeP95(samples) {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx] ?? 0;
}

// src/mcp/registry.ts
var DEFAULT_MAX_RESULT_CHARS = 32e3;
var DEFAULT_MAX_RESULT_TOKENS = 8e3;
function registerSingleMcpTool(mcpTool, env) {
  if (!mcpTool.name) return "";
  const registeredName = `${env.prefix}${mcpTool.name}`;
  env.registry.register({
    name: registeredName,
    description: mcpTool.description ?? "",
    parameters: mcpTool.inputSchema,
    fn: async (args, ctx) => {
      const t0 = env.tracker ? Date.now() : 0;
      const live = env.host.client;
      const toolResult = await live.callTool(mcpTool.name, args, {
        onProgress: env.onProgress ? (info) => env.onProgress({ toolName: registeredName, ...info }) : void 0,
        signal: ctx?.signal
      });
      if (env.tracker) env.tracker.record(Date.now() - t0);
      return flattenMcpResult(toolResult, { maxChars: env.maxResultChars });
    }
  });
  return registeredName;
}
async function bridgeMcpTools(client, opts = {}) {
  const registry = opts.registry ?? new ToolRegistry({ autoFlatten: opts.autoFlatten });
  const prefix = opts.namePrefix ?? "";
  const maxResultChars = opts.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS;
  const result = { registry, registeredNames: [], skipped: [] };
  const serverName = opts.serverName ?? prefix.replace(/_$/, "") ?? "anon";
  const tracker = opts.onSlow ? new LatencyTracker(serverName, { thresholdMs: opts.slowThresholdMs, onSlow: opts.onSlow }) : null;
  const host = opts.host ?? { client };
  const env = {
    registry,
    host,
    prefix,
    maxResultChars,
    tracker,
    onProgress: opts.onProgress
  };
  const listed = await client.listTools();
  for (const mcpTool of listed.tools) {
    if (!mcpTool.name) {
      result.skipped.push({ name: "?", reason: "empty tool name" });
      continue;
    }
    const registeredName = registerSingleMcpTool(mcpTool, env);
    if (registeredName) result.registeredNames.push(registeredName);
  }
  return { ...result, env };
}
function flattenMcpResult(result, opts = {}) {
  const parts = result.content.map(blockToString);
  const joined = parts.join("\n").trim();
  const prefixed = result.isError ? `ERROR: ${joined || "(no error message from server)"}` : joined;
  return opts.maxChars ? truncateForModel(prefixed, opts.maxChars) : prefixed;
}
function truncateForModel(s, maxChars) {
  if (s.length <= maxChars) return s;
  const tailBudget = Math.min(1024, Math.floor(maxChars * 0.1));
  const headBudget = Math.max(0, maxChars - tailBudget);
  const head = s.slice(0, headBudget);
  const tail = s.slice(-tailBudget);
  const dropped = s.length - head.length - tail.length;
  return `${head}

[\u2026truncated ${dropped} chars \u2014 raise BridgeOptions.maxResultChars, or call the tool with a narrower scope (filter, head, pagination)\u2026]

${tail}`;
}
function truncateForModelByTokens(s, maxTokens) {
  if (maxTokens <= 0) return "";
  if (s.length <= maxTokens) return s;
  if (s.length <= maxTokens * 4) {
    const tokens = countTokens(s);
    if (tokens <= maxTokens) return s;
  }
  const markerOverhead = 48;
  const contentBudget = Math.max(0, maxTokens - markerOverhead);
  const tailBudget = Math.min(256, Math.floor(contentBudget * 0.1));
  const headBudget = Math.max(0, contentBudget - tailBudget);
  const head = sizePrefixToTokens(s, headBudget);
  const tail = sizeSuffixToTokens(s, tailBudget);
  const droppedChars = s.length - head.length - tail.length;
  const headTokens = head ? countTokens(head) : 0;
  const tailTokens = tail ? countTokens(tail) : 0;
  const sampleChars = head.length + tail.length;
  const sampleTokens = headTokens + tailTokens;
  const ratio = sampleChars > 0 ? sampleTokens / sampleChars : 0.3;
  const estTotalTokens = Math.ceil(s.length * ratio);
  const droppedTokens = Math.max(0, estTotalTokens - sampleTokens);
  return `${head}

[\u2026truncated ~${droppedTokens} tokens (${droppedChars} chars) \u2014 raise BridgeOptions.maxResultTokens, or call the tool with a narrower scope (filter, head, pagination)\u2026]

${tail}`;
}
function sizePrefixToTokens(s, budget) {
  if (budget <= 0 || s.length === 0) return "";
  let size = Math.min(s.length, budget * 4);
  for (let iter = 0; iter < 6; iter++) {
    if (size <= 0) return "";
    const slice = s.slice(0, size);
    const count = countTokens(slice);
    if (count <= budget) return slice;
    const next = Math.floor(size * (budget / count) * 0.95);
    if (next >= size) return s.slice(0, Math.max(0, size - 1));
    size = next;
  }
  return s.slice(0, Math.max(0, size));
}
function sizeSuffixToTokens(s, budget) {
  if (budget <= 0 || s.length === 0) return "";
  let size = Math.min(s.length, budget * 4);
  for (let iter = 0; iter < 6; iter++) {
    if (size <= 0) return "";
    const slice = s.slice(-size);
    const count = countTokens(slice);
    if (count <= budget) return slice;
    const next = Math.floor(size * (budget / count) * 0.95);
    if (next >= size) return s.slice(-Math.max(0, size - 1));
    size = next;
  }
  return s.slice(-Math.max(0, size));
}
function blockToString(block) {
  if (block.type === "text") return block.text;
  if (block.type === "image") return `[image ${block.mimeType}, ${block.data.length} chars base64]`;
  return `[unknown block: ${JSON.stringify(block)}]`;
}

// src/repair/flatten.ts
function analyzeSchema(schema) {
  if (!schema) return { shouldFlatten: false, leafCount: 0, maxDepth: 0 };
  let leafCount = 0;
  let maxDepth = 0;
  walk(schema, 0, (depth, isLeaf) => {
    if (isLeaf) leafCount++;
    if (depth > maxDepth) maxDepth = depth;
  });
  return {
    shouldFlatten: leafCount > 10 || maxDepth > 2,
    leafCount,
    maxDepth
  };
}
function flattenSchema(schema) {
  const flatProps = {};
  const required = [];
  collect("", schema, flatProps, required, true);
  return {
    type: "object",
    properties: flatProps,
    required
  };
}
function nestArguments(flatArgs) {
  const out = {};
  for (const [key, value] of Object.entries(flatArgs)) {
    setByPath(out, key.split("."), value);
  }
  return out;
}
function walk(schema, depth, visit) {
  if (schema.type === "object" && schema.properties) {
    for (const child of Object.values(schema.properties)) {
      walk(child, depth + 1, visit);
    }
    return;
  }
  if (schema.type === "array" && schema.items) {
    walk(schema.items, depth + 1, visit);
    return;
  }
  visit(depth, true);
}
function collect(prefix, schema, out, required, isRootRequired) {
  if (schema.type === "object" && schema.properties) {
    const requiredSet = new Set(schema.required ?? []);
    for (const [key, child] of Object.entries(schema.properties)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      const childRequired = isRootRequired && requiredSet.has(key);
      collect(nextPrefix, child, out, required, childRequired);
    }
    return;
  }
  out[prefix] = schema;
  if (isRootRequired) required.push(prefix);
}
function setByPath(target, path, value) {
  let cur = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (typeof cur[key] !== "object" || cur[key] === null) cur[key] = {};
    cur = cur[key];
  }
  cur[path[path.length - 1]] = value;
}

// src/tools.ts
var ToolRegistry = class {
  _tools = /* @__PURE__ */ new Map();
  _autoFlatten;
  _planMode = false;
  _interceptor = null;
  _auditListener = null;
  _resultAugmenter = null;
  /** Per-tool fingerprint of the last call that failed schema validation. Cleared by any successful validation for that tool. */
  _lastMalformed = /* @__PURE__ */ new Map();
  constructor(opts = {}) {
    this._autoFlatten = opts.autoFlatten !== false;
  }
  /** Enable / disable plan-mode enforcement at dispatch. */
  setPlanMode(on) {
    this._planMode = Boolean(on);
  }
  /** True when the registry is currently refusing non-readonly calls. */
  get planMode() {
    return this._planMode;
  }
  /** At most one interceptor active; calling twice replaces. */
  setToolInterceptor(fn) {
    this._interceptor = fn;
  }
  setAuditListener(fn) {
    this._auditListener = fn;
  }
  /** Final-stage post-processor; replaces previous augmenter when called twice. Pass null to clear. */
  setResultAugmenter(fn) {
    this._resultAugmenter = fn;
  }
  /** True when an augmenter is already wired — lets late-installing callers skip clobbering an earlier one. */
  get hasResultAugmenter() {
    return this._resultAugmenter !== null;
  }
  register(def) {
    if (!def.name) throw new Error("tool requires a name");
    const internal = { ...def };
    if (this._autoFlatten && def.parameters) {
      const decision = analyzeSchema(def.parameters);
      if (decision.shouldFlatten) {
        internal.flatSchema = flattenSchema(def.parameters);
      }
    }
    this._tools.set(def.name, internal);
    return this;
  }
  /** Drop a registered tool. Returns true if the name was present. Used by MCP hot-unbridge. */
  unregister(name) {
    return this._tools.delete(name);
  }
  has(name) {
    return this._tools.has(name);
  }
  get(name) {
    return this._tools.get(name);
  }
  get size() {
    return this._tools.size;
  }
  /** True if a registered tool's schema was flattened for the model. */
  wasFlattened(name) {
    return Boolean(this._tools.get(name)?.flatSchema);
  }
  /** Unknown / unannotated tools default to false — third-party MCP tools must opt in. */
  isParallelSafe(name) {
    return this._tools.get(name)?.parallelSafe === true;
  }
  specs() {
    return [...this._tools.values()].map((t2) => ({
      type: "function",
      function: {
        name: t2.name,
        description: t2.description ?? "",
        parameters: t2.flatSchema ?? t2.parameters ?? { type: "object", properties: {} }
      }
    }));
  }
  async dispatch(name, argumentsRaw, opts = {}) {
    const tool = this._tools.get(name);
    if (!tool) {
      return JSON.stringify({ error: `unknown tool: ${name}` });
    }
    const fingerprint = fingerprintArgs(argumentsRaw);
    let args;
    try {
      args = typeof argumentsRaw === "string" ? argumentsRaw.trim() ? JSON.parse(argumentsRaw) ?? {} : {} : argumentsRaw ?? {};
    } catch (err) {
      return this._noteMalformed(
        name,
        fingerprint,
        `invalid tool arguments JSON: ${err.message}`
      );
    }
    if (tool.flatSchema && args && typeof args === "object" && hasDotKey(args)) {
      args = nestArguments(args);
    }
    const missing = tool.parameters ? missingRequiredParam(tool.parameters, args) : null;
    if (missing) {
      return this._noteMalformed(
        name,
        fingerprint,
        `missing required parameter "${missing}". Retry with all required parameters filled.`
      );
    }
    this._lastMalformed.delete(name);
    if (this._planMode && !isReadOnlyCall(tool, args)) {
      return JSON.stringify({
        error: `${name}: unavailable in plan mode \u2014 this is a read-only exploration phase. Use read_file / list_directory / search_files / directory_tree / web_search / allowlisted shell commands to investigate. Call submit_plan with your proposed plan when you're ready for the user's review.`,
        rejectedReason: "plan-mode"
      });
    }
    if (this._interceptor) {
      try {
        const short = await this._interceptor(name, args);
        if (typeof short === "string") return short;
      } catch (err) {
        return JSON.stringify({
          error: `${name}: interceptor failed \u2014 ${err.message}`
        });
      }
    }
    let finalResult;
    try {
      try {
        this._auditListener?.({ name, args });
      } catch {
      }
      const result = await tool.fn(args, {
        signal: opts.signal,
        confirmationGate: opts.confirmationGate
      });
      const str = typeof result === "string" ? result : JSON.stringify(result);
      let clipped = str;
      if (opts.maxResultTokens !== void 0) {
        clipped = truncateForModelByTokens(clipped, opts.maxResultTokens);
      }
      if (opts.maxResultChars !== void 0) {
        clipped = truncateForModel(clipped, opts.maxResultChars);
      }
      finalResult = clipped;
    } catch (err) {
      const e = err;
      if (typeof e.toToolResult === "function") {
        try {
          finalResult = JSON.stringify(e.toToolResult());
        } catch {
          finalResult = JSON.stringify({ error: `${e.name}: ${e.message}` });
        }
      } else {
        finalResult = JSON.stringify({ error: `${e.name}: ${e.message}` });
      }
    }
    if (this._resultAugmenter) {
      try {
        return this._resultAugmenter(name, args, finalResult);
      } catch {
      }
    }
    return finalResult;
  }
  /** Records the failed call's fingerprint; on the 2nd consecutive identical malformed call to the same tool, returns a sharper error that tells the model to stop retrying. */
  _noteMalformed(name, fingerprint, detail) {
    const prev = this._lastMalformed.get(name);
    this._lastMalformed.set(name, fingerprint);
    if (prev === fingerprint) {
      return JSON.stringify({
        error: `${name}: same call just failed validation (${detail}) \u2014 DO NOT retry with identical args. Either fix the call (read the schema in the tool spec) or pick a different tool.`,
        consecutiveMalformed: true
      });
    }
    return JSON.stringify({ error: `${name}: ${detail}` });
  }
};
function isReadOnlyCall(tool, args) {
  if (tool.readOnlyCheck) {
    try {
      return Boolean(tool.readOnlyCheck(args));
    } catch {
      return false;
    }
  }
  return tool.readOnly === true;
}
function hasDotKey(obj) {
  for (const k of Object.keys(obj)) {
    if (k.includes(".")) return true;
  }
  return false;
}
function fingerprintArgs(argumentsRaw) {
  if (typeof argumentsRaw === "string") return argumentsRaw;
  try {
    return JSON.stringify(argumentsRaw);
  } catch {
    return "";
  }
}
function missingRequiredParam(schema, args) {
  const required = schema.required;
  if (!required || required.length === 0) return null;
  for (const key of required) {
    if (args[key] === void 0) return key;
  }
  return null;
}

// src/memory/runtime.ts
import { createHash } from "crypto";
var ImmutablePrefix = class {
  system;
  /** Each `addTool` costs one cache-miss turn — DeepSeek's prefix cache is keyed by full tool list. */
  _toolSpecs;
  fewShots;
  /** Invalidated only via `addTool`; bypassing it leaves cache stale → fingerprint diverges from sent prefix. */
  _fingerprintCache = null;
  constructor(opts) {
    this.system = opts.system;
    this._toolSpecs = [...opts.toolSpecs ?? []];
    this.fewShots = Object.freeze([...opts.fewShots ?? []]);
  }
  get toolSpecs() {
    return this._toolSpecs;
  }
  toMessages() {
    return [{ role: "system", content: this.system }, ...this.fewShots.map((m) => ({ ...m }))];
  }
  tools() {
    return this._toolSpecs.map((t2) => structuredClone(t2));
  }
  addTool(spec) {
    const name = spec.function?.name;
    if (!name) return false;
    if (this._toolSpecs.some((t2) => t2.function?.name === name)) return false;
    this._toolSpecs.push(spec);
    this._fingerprintCache = null;
    return true;
  }
  /** Mirror of addTool for MCP hot-unbridge. Same cache-miss cost — prefix changes shape. */
  removeTool(name) {
    const idx = this._toolSpecs.findIndex((t2) => t2.function?.name === name);
    if (idx < 0) return false;
    this._toolSpecs.splice(idx, 1);
    this._fingerprintCache = null;
    return true;
  }
  get fingerprint() {
    if (this._fingerprintCache !== null) return this._fingerprintCache;
    this._fingerprintCache = this.computeFingerprint();
    return this._fingerprintCache;
  }
  /** Dev/test only — throws on cache drift, which always means a non-`addTool` mutation slipped in. */
  verifyFingerprint() {
    const fresh = this.computeFingerprint();
    if (this._fingerprintCache !== null && this._fingerprintCache !== fresh) {
      throw new Error(
        `ImmutablePrefix fingerprint drift: cached=${this._fingerprintCache}, fresh=${fresh}. A mutation path bypassed addTool's cache invalidation \u2014 DeepSeek will see prefix churn that the TUI / transcript log don't know about.`
      );
    }
    this._fingerprintCache = fresh;
    return fresh;
  }
  computeFingerprint() {
    const blob = JSON.stringify({
      system: this.system,
      tools: this._toolSpecs,
      shots: this.fewShots
    });
    return createHash("sha256").update(blob).digest("hex").slice(0, 16);
  }
};
var AppendOnlyLog = class {
  _entries = [];
  append(message) {
    if (!message || typeof message !== "object" || !("role" in message)) {
      throw new Error(`invalid log entry: ${JSON.stringify(message)}`);
    }
    this._entries.push(message);
  }
  extend(messages) {
    for (const m of messages) this.append(m);
  }
  /** The one append-only-breaking path — reserved for `/compact` + recovery. Use `append()` otherwise. */
  compactInPlace(replacement) {
    this._entries = [...replacement];
  }
  get entries() {
    return this._entries;
  }
  toMessages() {
    return this._entries.map((e) => ({ ...e }));
  }
  get length() {
    return this._entries.length;
  }
};
var VolatileScratch = class {
  reasoning = null;
  planState = null;
  notes = [];
  reset() {
    this.reasoning = null;
    this.planState = null;
    this.notes = [];
  }
};

// src/context-manager.ts
var HISTORY_FOLD_THRESHOLD = 0.5;
var HISTORY_FOLD_TAIL_FRACTION = 0.2;
var HISTORY_FOLD_AGGRESSIVE_THRESHOLD = 0.7;
var HISTORY_FOLD_AGGRESSIVE_TAIL_FRACTION = 0.1;
var HISTORY_FOLD_MIN_SAVINGS_FRACTION = 0.3;
var FORCE_SUMMARY_THRESHOLD = 0.8;
var PREFLIGHT_EMERGENCY_THRESHOLD = 0.95;
var HISTORY_FOLD_MARKER = "[CONVERSATION HISTORY SUMMARY \u2014 earlier turns folded for context efficiency]\n\n";
var ContextManager = class {
  constructor(deps) {
    this.deps = deps;
  }
  deps;
  /** Decision after a turn's response — fold, exit with summary, or carry on. */
  decideAfterUsage(usage, model, alreadyFoldedThisTurn) {
    const ctxMax = DEEPSEEK_CONTEXT_TOKENS[model] ?? DEFAULT_CONTEXT_TOKENS;
    if (!usage) return { kind: "none", promptTokens: 0, ctxMax, ratio: 0 };
    const ratio = usage.promptTokens / ctxMax;
    const base = { promptTokens: usage.promptTokens, ctxMax, ratio };
    if (ratio > FORCE_SUMMARY_THRESHOLD) {
      return { kind: "exit-with-summary", ...base };
    }
    if (alreadyFoldedThisTurn) return { kind: "none", ...base };
    if (ratio > HISTORY_FOLD_AGGRESSIVE_THRESHOLD) {
      return {
        kind: "fold",
        ...base,
        tailBudget: Math.floor(ctxMax * HISTORY_FOLD_AGGRESSIVE_TAIL_FRACTION),
        aggressive: true
      };
    }
    if (ratio > HISTORY_FOLD_THRESHOLD) {
      return {
        kind: "fold",
        ...base,
        tailBudget: Math.floor(ctxMax * HISTORY_FOLD_TAIL_FRACTION),
        aggressive: false
      };
    }
    return { kind: "none", ...base };
  }
  /** Local-side preflight before sending a request — catches oversized payloads early. */
  decidePreflight(messages, toolSpecs, model) {
    const ctxMax = DEEPSEEK_CONTEXT_TOKENS[model] ?? DEFAULT_CONTEXT_TOKENS;
    const estimate = estimateRequestTokens(messages, toolSpecs ?? null);
    return {
      needsAction: estimate / ctxMax > PREFLIGHT_EMERGENCY_THRESHOLD,
      estimateTokens: estimate,
      ctxMax
    };
  }
  /** Replace older turns with one summary message; keep tail within keepRecentTokens budget. */
  async fold(model, opts) {
    const ctxMax = DEEPSEEK_CONTEXT_TOKENS[model] ?? DEFAULT_CONTEXT_TOKENS;
    const tailBudget = opts?.keepRecentTokens ?? Math.floor(ctxMax * HISTORY_FOLD_TAIL_FRACTION);
    const all = this.deps.log.toMessages();
    const noop = {
      folded: false,
      beforeMessages: all.length,
      afterMessages: all.length,
      summaryChars: 0
    };
    if (all.length === 0) return noop;
    const tokenCounts = all.map((m) => estimateConversationTokens([m]));
    const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);
    let cumTokens = 0;
    let boundary = all.length;
    for (let i = all.length - 1; i >= 0; i--) {
      if (cumTokens + tokenCounts[i] > tailBudget) break;
      cumTokens += tokenCounts[i];
      if (all[i].role === "user") boundary = i;
    }
    if (boundary <= 0) return noop;
    const head = all.slice(0, boundary);
    const tail = all.slice(boundary);
    const headTokens = totalTokens - cumTokens;
    if (headTokens < totalTokens * HISTORY_FOLD_MIN_SAVINGS_FRACTION) return noop;
    const summary = await this.summarizeForFold(head);
    if (!summary) return noop;
    const summaryMsg = {
      role: "assistant",
      content: HISTORY_FOLD_MARKER + summary
    };
    const replacement = [summaryMsg, ...tail];
    this.deps.log.compactInPlace(replacement);
    this.persistRewrite(replacement);
    return {
      folded: true,
      beforeMessages: all.length,
      afterMessages: replacement.length,
      summaryChars: summary.length
    };
  }
  /** Drop a trailing in-flight assistant-with-tool_calls before a forced summary. Tail-only mutation; prefix cache safe. */
  trimTrailingToolCalls() {
    const tail = this.deps.log.entries[this.deps.log.entries.length - 1];
    if (!tail || tail.role !== "assistant" || !Array.isArray(tail.tool_calls) || tail.tool_calls.length === 0) {
      return false;
    }
    const kept = this.deps.log.entries.slice(0, -1);
    this.deps.log.compactInPlace([...kept]);
    this.persistRewrite([...kept]);
    return true;
  }
  async summarizeForFold(messagesToSummarize) {
    const summaryModel = "deepseek-v4-flash";
    const systemPrompt = "You compress conversation history for a coding agent. Output one prose recap that preserves: the user's overall goal, decisions and conclusions reached, files inspected or modified, important tool results still relevant to ongoing work, and any open todos. Skip turn-by-turn play-by-play. No tool calls, no markdown headings, no SEARCH/REPLACE blocks \u2014 plain prose only.";
    const healed = healLoadedMessages(messagesToSummarize, DEFAULT_MAX_RESULT_CHARS).messages;
    const messages = [
      { role: "system", content: systemPrompt },
      ...healed,
      {
        role: "user",
        content: "Summarize the conversation above as plain prose. This summary replaces the original turns to free context \u2014 make it self-contained."
      }
    ];
    try {
      const resp = await this.deps.client.chat({
        model: summaryModel,
        messages,
        signal: this.deps.getAbortSignal(),
        thinking: thinkingModeForModel(summaryModel),
        reasoningEffort: "high"
      });
      this.deps.stats.record(this.deps.getCurrentTurn(), summaryModel, resp.usage ?? new Usage());
      return stripHallucinatedToolMarkup((resp.content ?? "").trim());
    } catch {
      return "";
    }
  }
  persistRewrite(messages) {
    if (!this.deps.sessionName) return;
    try {
      rewriteSession(this.deps.sessionName, messages);
    } catch {
    }
  }
};

// src/core/inflight.ts
var InflightSet = class {
  _set = /* @__PURE__ */ new Set();
  _listeners = /* @__PURE__ */ new Set();
  add(id) {
    if (this._set.has(id)) return;
    this._set.add(id);
    this._notify();
  }
  delete(id) {
    if (this._set.delete(id)) this._notify();
  }
  has(id) {
    return this._set.has(id);
  }
  /** Snapshot for diagnostics / tests; live view, do not mutate. */
  get size() {
    return this._set.size;
  }
  /** Subscribe to add/delete; returns the unsubscribe function. */
  subscribe(fn) {
    this._listeners.add(fn);
    return () => {
      this._listeners.delete(fn);
    };
  }
  /** Drop everything — only use at session reset. Notifies once. */
  clear() {
    if (this._set.size === 0) return;
    this._set.clear();
    this._notify();
  }
  _notify() {
    for (const fn of this._listeners) {
      try {
        fn();
      } catch {
      }
    }
  }
};

// src/loop/errors.ts
function formatLoopError(err, probe) {
  const msg = err.message ?? "";
  if (msg.includes("maximum context length")) {
    const reqMatch = msg.match(/requested\s+(\d+)\s+tokens/);
    const requested = reqMatch ? `${Number(reqMatch[1]).toLocaleString()} tokens` : t("errors.contextOverflowTooMany");
    return t("errors.contextOverflow", { requested });
  }
  const m = /^DeepSeek (\d{3}):\s*([\s\S]*)$/.exec(msg);
  if (!m) return msg;
  const status = m[1] ?? "";
  const body = m[2] ?? "";
  const inner = extractDeepSeekErrorMessage(body);
  if (status === "401") return t("errors.auth401", { inner });
  if (status === "402") return t("errors.balance402", { inner });
  if (status === "422") return t("errors.badparam422", { inner });
  if (status === "400") return t("errors.badrequest400", { inner });
  if (is5xxStatus(status)) return formatDeepSeek5xx(status, probe);
  return msg;
}
function is5xxError(err) {
  if (!(err instanceof Error)) return false;
  const m = /^DeepSeek (5\d{2}):/.exec(err.message ?? "");
  return m !== null;
}
async function probeDeepSeekReachable(client, timeoutMs = 1500) {
  const balance = await client.getBalance({ signal: AbortSignal.timeout(timeoutMs) });
  return { reachable: balance !== null };
}
function is5xxStatus(status) {
  return status === "500" || status === "502" || status === "503" || status === "504";
}
function formatDeepSeek5xx(status, probe) {
  const head = t("errors.deepseek5xxHead", { status });
  const probeNote = probe === void 0 ? "" : probe.reachable ? t("errors.deepseek5xxReachable") : t("errors.deepseek5xxUnreachable");
  const action = probe?.reachable === false ? t("errors.deepseek5xxActionNetwork") : t("errors.deepseek5xxActionRetry");
  return `${head}${probeNote}${action}`;
}
function reasonPrefixFor(reason, iterCap) {
  if (reason === "aborted") return t("errors.reasonAborted");
  if (reason === "context-guard") return t("errors.reasonContextGuard");
  if (reason === "stuck") return t("errors.reasonStuck");
  return t("errors.reasonBudget", { iterCap });
}
function errorLabelFor(reason, iterCap) {
  if (reason === "aborted") return t("errors.labelAborted");
  if (reason === "context-guard") return t("errors.labelContextGuard");
  if (reason === "stuck") return t("errors.labelStuck");
  return t("errors.labelBudget", { iterCap });
}
function extractDeepSeekErrorMessage(body) {
  const trimmed = body.trim();
  if (!trimmed) return t("errors.innerNoMessage");
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      const obj = parsed;
      if (obj.error && typeof obj.error.message === "string") return obj.error.message;
      if (typeof obj.message === "string") return obj.message;
    }
  } catch {
  }
  return trimmed;
}

// src/loop/escalation.ts
var NEEDS_PRO_MARKER_PREFIX = "<<<NEEDS_PRO";
var NEEDS_PRO_MARKER_RE = /^<<<NEEDS_PRO(?::\s*([^>]*))?>>>/;
var NEEDS_PRO_BUFFER_CHARS = 256;
function parseEscalationMarker(content) {
  const m = NEEDS_PRO_MARKER_RE.exec(content.trimStart());
  if (!m) return { matched: false };
  const reason = m[1]?.trim();
  return { matched: true, reason: reason || void 0 };
}
function isEscalationRequest(content) {
  return parseEscalationMarker(content).matched;
}
function looksLikePartialEscalationMarker(buf) {
  const t2 = buf.trimStart();
  if (t2.length === 0) return true;
  if (t2.length <= NEEDS_PRO_MARKER_PREFIX.length) {
    return NEEDS_PRO_MARKER_PREFIX.startsWith(t2);
  }
  if (!t2.startsWith(NEEDS_PRO_MARKER_PREFIX)) return false;
  const rest = t2.slice(NEEDS_PRO_MARKER_PREFIX.length);
  if (rest[0] !== ">" && rest[0] !== ":") return false;
  return true;
}

// src/loop/thinking.ts
function isThinkingModeModel(model) {
  if (model.includes("reasoner")) return true;
  if (model === "deepseek-v4-flash" || model === "deepseek-v4-pro") return true;
  return false;
}
function thinkingModeForModel(model) {
  if (model === "deepseek-chat") return "disabled";
  if (model.includes("reasoner")) return "enabled";
  if (model === "deepseek-v4-flash" || model === "deepseek-v4-pro") return "enabled";
  return void 0;
}
function stripHallucinatedToolMarkup(s) {
  let out = s;
  out = out.replace(/<｜DSML｜function_calls>[\s\S]*?<\/?｜DSML｜function_calls>/g, "");
  out = out.replace(/<\|DSML\|function_calls>[\s\S]*?<\/?\|DSML\|function_calls>/g, "");
  out = out.replace(/<function_calls>[\s\S]*?<\/function_calls>/g, "");
  out = out.replace(/<｜DSML｜[\s\S]*$/g, "");
  return out.trim();
}

// src/loop/messages.ts
function buildAssistantMessage(content, toolCalls, producingModel, reasoningContent) {
  const msg = { role: "assistant", content };
  if (toolCalls.length > 0) msg.tool_calls = toolCalls;
  if (isThinkingModeModel(producingModel) || reasoningContent && reasoningContent.length > 0) {
    msg.reasoning_content = reasoningContent ?? "";
  }
  return msg;
}
function buildSyntheticAssistantMessage(content, fallbackModel) {
  return buildAssistantMessage(content, [], fallbackModel, "");
}

// src/loop/force-summary.ts
async function* forceSummaryAfterIterLimit(ctx, opts = { reason: "budget" }) {
  try {
    yield { turn: ctx.turn, role: "status", content: t("summary.status") };
    const messages = ctx.buildMessages();
    messages.push({
      role: "user",
      content: "I'm out of tool-call budget for this turn. Summarize in plain prose what you learned from the tool results above. Do NOT emit any tool calls, function-call markup, DSML invocations, or SEARCH/REPLACE edit blocks \u2014 they will be silently discarded. Just plain text."
    });
    const summaryModel = "deepseek-v4-flash";
    const summaryEffort = "high";
    const resp = await ctx.client.chat({
      model: summaryModel,
      messages,
      signal: ctx.signal,
      thinking: thinkingModeForModel(summaryModel),
      reasoningEffort: summaryEffort
    });
    const rawContent = resp.content?.trim() ?? "";
    const cleaned = stripHallucinatedToolMarkup(rawContent);
    const summary = cleaned || t("summary.hallucinatedFallback");
    const reasonPrefix = reasonPrefixFor(opts.reason, ctx.maxToolIters);
    const annotated = `${reasonPrefix}

${summary}`;
    const summaryStats = ctx.recordStats(summaryModel, resp.usage ?? new Usage());
    ctx.appendAndPersist(buildAssistantMessage(summary, [], summaryModel, resp.reasoningContent));
    yield {
      turn: ctx.turn,
      role: "assistant_final",
      content: annotated,
      stats: summaryStats,
      forcedSummary: true
    };
    yield { turn: ctx.turn, role: "done", content: summary };
  } catch (err) {
    const label = errorLabelFor(opts.reason, ctx.maxToolIters);
    yield {
      turn: ctx.turn,
      role: "error",
      content: "",
      error: t("summary.failedAfterReason", { label, message: err.message })
    };
    yield { turn: ctx.turn, role: "done", content: "" };
  }
}

// src/loop/shrink.ts
function looksLikeCompleteJson(s) {
  if (!s || !s.trim()) return false;
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}
function shrinkOversizedToolResults(messages, maxChars) {
  let healedCount = 0;
  let healedFrom = 0;
  const out = messages.map((msg) => {
    if (msg.role !== "tool") return msg;
    const content = typeof msg.content === "string" ? msg.content : "";
    if (content.length <= maxChars) return msg;
    healedCount += 1;
    healedFrom += content.length;
    return { ...msg, content: truncateForModel(content, maxChars) };
  });
  return { messages: out, healedCount, healedFrom };
}
function shrinkOversizedToolResultsByTokens(messages, maxTokens) {
  let healedCount = 0;
  let tokensSaved = 0;
  let charsSaved = 0;
  const out = messages.map((msg) => {
    if (msg.role !== "tool") return msg;
    const content = typeof msg.content === "string" ? msg.content : "";
    if (content.length <= maxTokens) return msg;
    const beforeTokens = countTokens(content);
    if (beforeTokens <= maxTokens) return msg;
    const truncated = truncateForModelByTokens(content, maxTokens);
    const afterTokens = countTokens(truncated);
    healedCount += 1;
    tokensSaved += Math.max(0, beforeTokens - afterTokens);
    charsSaved += Math.max(0, content.length - truncated.length);
    return { ...msg, content: truncated };
  });
  return { messages: out, healedCount, tokensSaved, charsSaved };
}

// src/loop/healing.ts
function fixToolCallPairing(messages) {
  const out = [];
  let droppedAssistantCalls = 0;
  let droppedStrayTools = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "assistant" && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const needed = /* @__PURE__ */ new Set();
      for (const call of msg.tool_calls) {
        if (call?.id) needed.add(call.id);
      }
      const candidates = [];
      let j = i + 1;
      while (j < messages.length && needed.size > 0) {
        const nxt = messages[j];
        if (nxt.role !== "tool") break;
        const id = nxt.tool_call_id ?? "";
        if (!needed.has(id)) break;
        needed.delete(id);
        candidates.push(nxt);
        j++;
      }
      if (needed.size === 0) {
        out.push(msg);
        for (const r of candidates) out.push(r);
        i = j - 1;
      } else {
        droppedAssistantCalls += 1;
        droppedStrayTools += candidates.length;
        i = j - 1;
      }
      continue;
    }
    if (msg.role === "tool") {
      droppedStrayTools += 1;
      continue;
    }
    out.push(msg);
  }
  return { messages: out, droppedAssistantCalls, droppedStrayTools };
}
function healLoadedMessages(messages, maxChars) {
  const shrunk = shrinkOversizedToolResults(messages, maxChars);
  const paired = fixToolCallPairing(shrunk.messages);
  const healedCount = shrunk.healedCount + paired.droppedAssistantCalls + paired.droppedStrayTools;
  return { messages: paired.messages, healedCount, healedFrom: shrunk.healedFrom };
}
function stampMissingReasoningForThinkingMode(messages, model) {
  if (!isThinkingModeModel(model)) {
    return { messages, stampedCount: 0 };
  }
  let stampedCount = 0;
  const out = messages.map((msg) => {
    if (msg.role !== "assistant") return msg;
    if (Object.hasOwn(msg, "reasoning_content")) return msg;
    stampedCount += 1;
    return { ...msg, reasoning_content: "" };
  });
  return { messages: out, stampedCount };
}
function healLoadedMessagesByTokens(messages, maxTokens) {
  const shrunk = shrinkOversizedToolResultsByTokens(messages, maxTokens);
  const paired = fixToolCallPairing(shrunk.messages);
  const healedCount = shrunk.healedCount + paired.droppedAssistantCalls + paired.droppedStrayTools;
  return {
    messages: paired.messages,
    healedCount,
    tokensSaved: shrunk.tokensSaved,
    charsSaved: shrunk.charsSaved
  };
}

// src/loop/hook-events.ts
function safeParseToolArgs(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
function* hookWarnings(outcomes, turn) {
  for (const o of outcomes) {
    if (o.decision === "pass") continue;
    yield { turn, role: "warning", content: formatHookOutcomeMessage(o) };
  }
}

// src/loop/turn-failure-tracker.ts
var FAILURE_ESCALATION_THRESHOLD = 3;
var TurnFailureTracker = class {
  count = 0;
  types = {};
  reset() {
    this.count = 0;
    this.types = {};
  }
  /** True ONLY on the call where the count crosses FAILURE_ESCALATION_THRESHOLD. */
  noteAndCrossedThreshold(resultJson, repair) {
    const before = this.count;
    const bump = (kind, by = 1) => {
      this.count += by;
      this.types[kind] = (this.types[kind] ?? 0) + by;
    };
    if (resultJson.includes('"error"') && resultJson.includes("search text not found")) {
      bump("search-mismatch");
    }
    if (repair) {
      if (repair.scavenged > 0) bump("scavenged", repair.scavenged);
      if (repair.truncationsFixed > 0) bump("truncated", repair.truncationsFixed);
      if (repair.stormsBroken > 0) bump("repeat-loop", repair.stormsBroken);
    }
    return before < FAILURE_ESCALATION_THRESHOLD && this.count >= FAILURE_ESCALATION_THRESHOLD;
  }
  formatBreakdown() {
    const parts = Object.entries(this.types).filter(([, n]) => n > 0).map(([kind, n]) => `${n}\xD7 ${kind}`);
    return parts.length > 0 ? parts.join(", ") : `${this.count} repair/error signal(s)`;
  }
};

// src/repair/scavenge.ts
var MAX_SCAVENGE_INPUT = 100 * 1024;
function scavengeToolCalls(reasoningContent, opts) {
  if (!reasoningContent) return { calls: [], notes: [] };
  if (reasoningContent.length > MAX_SCAVENGE_INPUT) {
    return {
      calls: [],
      notes: [`scavenge skipped: reasoning_content too large (${reasoningContent.length} chars)`]
    };
  }
  const max = opts.maxCalls ?? 4;
  const notes = [];
  const out = [];
  for (const invoke of iterateDsmlInvokes(reasoningContent)) {
    if (out.length >= max) break;
    if (!opts.allowedNames.has(invoke.name)) continue;
    out.push({
      function: {
        name: invoke.name,
        arguments: JSON.stringify(invoke.args)
      }
    });
    notes.push(`scavenged DSML call: ${invoke.name}`);
  }
  const nonDsml = stripDsmlBlocks(reasoningContent);
  for (const candidate of iterateJsonObjects(nonDsml)) {
    if (out.length >= max) break;
    const call = coerceToToolCall(candidate, opts.allowedNames);
    if (call) {
      out.push(call);
      notes.push(`scavenged call: ${call.function.name}`);
    }
  }
  return { calls: out, notes };
}
function stripDsmlBlocks(text) {
  let out = text;
  out = out.replace(/<[｜|]DSML[｜|]function_calls>[\s\S]*?<\/?[｜|]DSML[｜|]function_calls>/g, "");
  out = out.replace(/<[｜|]DSML[｜|]invoke\s+[^>]*>[\s\S]*?<\/[｜|]DSML[｜|]invoke>/g, "");
  return out;
}
function* iterateDsmlInvokes(text) {
  const INVOKE_RE = /<[｜|]DSML[｜|]invoke\s+name="([^"]+)">([\s\S]*?)<\/[｜|]DSML[｜|]invoke>/g;
  for (const match of text.matchAll(INVOKE_RE)) {
    const name = match[1];
    const body = match[2];
    if (!name || body === void 0) continue;
    yield { name, args: parseDsmlParameters(body) };
  }
}
function parseDsmlParameters(body) {
  const PARAM_RE = /<[｜|]DSML[｜|]parameter\s+name="([^"]+)"(?:\s+string="(true|false)")?\s*>([\s\S]*?)<\/[｜|]DSML[｜|]parameter>/g;
  const args = {};
  for (const m of body.matchAll(PARAM_RE)) {
    const key = m[1];
    const stringFlag = m[2];
    const raw = (m[3] ?? "").trim();
    if (!key) continue;
    if (stringFlag === "false") {
      try {
        args[key] = JSON.parse(raw);
        continue;
      } catch {
      }
    }
    args[key] = raw;
  }
  return args;
}
function* iterateJsonObjects(text) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (inString) {
        if (c === "\\") {
          escaped = true;
          continue;
        }
        if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          yield text.slice(i, j + 1);
          i = j;
          break;
        }
      }
    }
  }
}
function coerceToToolCall(candidateJson, allowedNames) {
  let parsed;
  try {
    parsed = JSON.parse(candidateJson);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (typeof parsed.name === "string" && allowedNames.has(parsed.name)) {
    const args = parsed.arguments;
    return {
      function: {
        name: parsed.name,
        arguments: typeof args === "string" ? args : JSON.stringify(args ?? {})
      }
    };
  }
  if (parsed.type === "function" && parsed.function && typeof parsed.function.name === "string" && allowedNames.has(parsed.function.name)) {
    const args = parsed.function.arguments;
    return {
      type: "function",
      function: {
        name: parsed.function.name,
        arguments: typeof args === "string" ? args : JSON.stringify(args ?? {})
      }
    };
  }
  if (typeof parsed.tool_name === "string" && allowedNames.has(parsed.tool_name)) {
    return {
      function: {
        name: parsed.tool_name,
        arguments: JSON.stringify(parsed.tool_args ?? {})
      }
    };
  }
  return null;
}

// src/repair/storm.ts
var StormBreaker = class {
  windowSize;
  threshold;
  isMutating;
  isStormExempt;
  recent = [];
  constructor(windowSize = 6, threshold = 3, isMutating, isStormExempt) {
    this.windowSize = windowSize;
    this.threshold = threshold;
    this.isMutating = isMutating;
    this.isStormExempt = isStormExempt;
  }
  inspect(call) {
    const name = call.function?.name;
    if (!name) return { suppress: false };
    if (this.isStormExempt?.(call)) return { suppress: false };
    const args = call.function?.arguments ?? "";
    const mutating = this.isMutating ? this.isMutating(call) : false;
    const readOnly = !mutating;
    if (mutating) {
      for (let i = this.recent.length - 1; i >= 0; i--) {
        if (this.recent[i].readOnly) this.recent.splice(i, 1);
      }
    }
    const count = this.recent.reduce((n, e) => e.name === name && e.args === args ? n + 1 : n, 0);
    if (count >= this.threshold - 1) {
      return {
        suppress: true,
        reason: `${name} called with identical args ${count + 1} times \u2014 repeat-loop guard tripped`
      };
    }
    this.recent.push({ name, args, readOnly });
    while (this.recent.length > this.windowSize) this.recent.shift();
    return { suppress: false };
  }
  reset() {
    this.recent.length = 0;
  }
};

// src/repair/truncation.ts
function repairTruncatedJson(input) {
  const notes = [];
  if (!input || !input.trim()) {
    return { repaired: "{}", changed: input !== "{}", notes: ["empty input \u2192 {}"] };
  }
  try {
    JSON.parse(input);
    return { repaired: input, changed: false, notes: [] };
  } catch {
  }
  const stack = [];
  let escaped = false;
  let inString = false;
  let lastSignificant = -1;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (!/\s/.test(c)) lastSignificant = i;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escaped = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        stack.pop();
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      stack.push('"');
      continue;
    }
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") stack.pop();
  }
  let s = input.slice(0, lastSignificant + 1);
  if (/,$/.test(s)) {
    s = s.replace(/,$/, "");
    notes.push("trimmed trailing comma");
  }
  if (/"\s*:\s*$/.test(s)) {
    s += " null";
    notes.push("filled dangling key with null");
  }
  if (inString) {
    s += '"';
    stack.pop();
    notes.push("closed unterminated string");
  }
  while (stack.length > 0) {
    const top = stack.pop();
    if (top === "{") s += "}";
    else if (top === "[") s += "]";
    else if (top === '"') s += '"';
  }
  try {
    JSON.parse(s);
    return { repaired: s, changed: true, notes };
  } catch (err) {
    notes.push(`fallback to {}: ${err.message}`);
    return { repaired: "{}", changed: true, notes };
  }
}

// src/repair/index.ts
var ToolCallRepair = class {
  storm;
  opts;
  constructor(opts) {
    this.opts = opts;
    this.storm = new StormBreaker(
      opts.stormWindow ?? 6,
      opts.stormThreshold ?? 3,
      opts.isMutating,
      opts.isStormExempt
    );
  }
  /** Called at start of every user turn — fresh intent shouldn't inherit old repetition state. */
  resetStorm() {
    this.storm.reset();
  }
  process(declaredCalls, reasoningContent, content = null) {
    const report = {
      scavenged: 0,
      truncationsFixed: 0,
      stormsBroken: 0,
      notes: []
    };
    const combined = [reasoningContent ?? "", content ?? ""].filter(Boolean).join("\n");
    const scavenged = scavengeToolCalls(combined || null, {
      allowedNames: this.opts.allowedToolNames,
      maxCalls: this.opts.maxScavenge ?? 4
    });
    const seenSignatures = new Set(declaredCalls.map(signature));
    const merged = [...declaredCalls];
    for (const sc of scavenged.calls) {
      if (!seenSignatures.has(signature(sc))) {
        merged.push(sc);
        report.scavenged++;
        seenSignatures.add(signature(sc));
      }
    }
    report.notes.push(...scavenged.notes);
    for (const call of merged) {
      const args = call.function?.arguments ?? "";
      const r = repairTruncatedJson(args);
      if (r.changed) {
        call.function.arguments = r.repaired;
        report.truncationsFixed++;
        report.notes.push(...r.notes.map((n) => `[${call.function.name}] ${n}`));
      }
    }
    const filtered = [];
    for (const call of merged) {
      const verdict = this.storm.inspect(call);
      if (verdict.suppress) {
        report.stormsBroken++;
        if (verdict.reason) report.notes.push(verdict.reason);
        continue;
      }
      filtered.push(call);
    }
    return { calls: filtered, report };
  }
};
function signature(call) {
  return `${call.function?.name ?? ""}::${call.function?.arguments ?? ""}`;
}

// src/loop.ts
var ESCALATION_MODEL = "deepseek-v4-pro";
var PARENT_BUDGET_WARN_THRESHOLD = 5;
var CacheFirstLoop = class {
  client;
  prefix;
  tools;
  maxToolIters;
  log = new AppendOnlyLog();
  scratch = new VolatileScratch();
  stats = new SessionStats();
  repair;
  // Mutable via configure() — slash commands in the TUI / library callers tweak
  // these mid-session so users don't have to restart.
  model;
  stream;
  reasoningEffort;
  autoEscalate = true;
  budgetUsd;
  /** One-shot 80% warning latch — cleared by setBudget so a bump re-arms at the new boundary. */
  _budgetWarned = false;
  sessionName;
  hooks;
  hookCwd;
  /** PauseGate bridge — defaults to singleton, injectable for tests. */
  confirmationGate;
  /** Number of messages that were pre-loaded from the session file. */
  resumedMessageCount;
  _turn = 0;
  _streamPreference;
  /** Threaded through HTTP + every tool dispatch so Esc cancels in-flight work, not after. */
  _turnAbort = new AbortController();
  /** Authoritative running-id set — UI cards consult this instead of trusting end-event delivery. Insert at dispatch entry, delete in finally. */
  _inflight = new InflightSet();
  _proArmedForNextTurn = false;
  _escalateThisTurn = false;
  _turnFailures = new TurnFailureTracker();
  _turnSelfCorrected = false;
  _foldedThisTurn = false;
  _toolDispatchesThisStep = 0;
  context;
  /** Subscribe API so UI hooks can derive `running` from finally-guaranteed insertions. */
  get inflight() {
    return this._inflight;
  }
  get currentTurn() {
    return this._turn;
  }
  constructor(opts) {
    this.client = opts.client;
    this.prefix = opts.prefix;
    this.tools = opts.tools ?? new ToolRegistry();
    this.model = opts.model ?? "deepseek-v4-flash";
    this.reasoningEffort = opts.reasoningEffort ?? "max";
    if (opts.autoEscalate !== void 0) this.autoEscalate = opts.autoEscalate;
    this.budgetUsd = typeof opts.budgetUsd === "number" && opts.budgetUsd > 0 ? opts.budgetUsd : null;
    this.maxToolIters = opts.maxToolIters ?? 64;
    this.hooks = opts.hooks ?? [];
    this.hookCwd = opts.hookCwd ?? process.cwd();
    this.confirmationGate = opts.confirmationGate ?? pauseGate;
    this._streamPreference = opts.stream ?? true;
    this.stream = this._streamPreference;
    const allowedNames = /* @__PURE__ */ new Set([...this.prefix.toolSpecs.map((s) => s.function.name)]);
    const registry = this.tools;
    const isMutating = (call) => {
      const name = call.function?.name;
      if (!name) return false;
      const def = registry.get(name);
      if (!def) return false;
      if (def.readOnlyCheck) {
        let args = {};
        try {
          args = JSON.parse(call.function?.arguments ?? "{}") ?? {};
        } catch {
        }
        try {
          if (def.readOnlyCheck(args)) return false;
        } catch {
        }
      }
      return def.readOnly !== true;
    };
    const isStormExempt = (call) => {
      const name = call.function?.name;
      if (!name) return false;
      return registry.get(name)?.stormExempt === true;
    };
    this.repair = new ToolCallRepair({
      allowedToolNames: allowedNames,
      isMutating,
      isStormExempt,
      stormThreshold: parsePositiveIntEnv(process.env.REASONIX_STORM_THRESHOLD),
      stormWindow: parsePositiveIntEnv(process.env.REASONIX_STORM_WINDOW)
    });
    if (!this.tools.hasResultAugmenter) {
      this.tools.setResultAugmenter((_name, _args, result) => {
        this._toolDispatchesThisStep++;
        const remaining = this.maxToolIters - this._toolDispatchesThisStep;
        if (remaining <= 0) {
          return `${result}

[budget: 0 of ${this.maxToolIters} tool calls left this turn \u2014 finalize NOW; the next iter forces a summary]`;
        }
        if (remaining <= PARENT_BUDGET_WARN_THRESHOLD) {
          return `${result}

[budget: ${remaining} of ${this.maxToolIters} tool calls left this turn \u2014 wrap up soon]`;
        }
        return result;
      });
    }
    this.sessionName = opts.session ?? null;
    if (this.sessionName) {
      const prior = loadSessionMessages(this.sessionName);
      const shrunk = healLoadedMessagesByTokens(prior, DEFAULT_MAX_RESULT_TOKENS);
      const stamped = stampMissingReasoningForThinkingMode(shrunk.messages, this.model);
      const messages = stamped.messages;
      const healedCount = shrunk.healedCount + stamped.stampedCount;
      const tokensSaved = shrunk.tokensSaved;
      for (const msg of messages) this.log.append(msg);
      this.resumedMessageCount = messages.length;
      if (messages.length > 0) {
        const meta = loadSessionMeta(this.sessionName);
        this.stats.seedCarryover({
          totalCostUsd: meta.totalCostUsd,
          turnCount: meta.turnCount,
          cacheHitTokens: meta.cacheHitTokens,
          cacheMissTokens: meta.cacheMissTokens,
          lastPromptTokens: meta.lastPromptTokens
        });
      }
      if (healedCount > 0) {
        try {
          rewriteSession(this.sessionName, messages);
        } catch {
        }
        process.stderr.write(
          `\u25B8 session "${this.sessionName}": healed ${healedCount} entr${healedCount === 1 ? "y" : "ies"}${tokensSaved > 0 ? ` (shrunk ${tokensSaved.toLocaleString()} tokens of oversized tool output)` : " (dropped dangling tool_calls tail)"}. Rewrote session file.
`
        );
      }
    } else {
      this.resumedMessageCount = 0;
    }
    this.context = new ContextManager({
      client: this.client,
      log: this.log,
      stats: this.stats,
      sessionName: this.sessionName,
      getAbortSignal: () => this._turnAbort.signal,
      getCurrentTurn: () => this._turn
    });
  }
  /** Replace older turns with one summary message; keep tail within keepRecentTokens budget. */
  async compactHistory(opts) {
    return this.context.fold(this.model, opts);
  }
  appendAndPersist(message) {
    this.log.append(message);
    if (this.sessionName) {
      try {
        appendSessionMessage(this.sessionName, message);
      } catch {
      }
    }
  }
  /** Swap the just-appended assistant entry — used by self-correction to restore the original tool_calls without dropping reasoning_content. */
  replaceTailAssistantMessage(message) {
    const entries = this.log.entries;
    const tail = entries[entries.length - 1];
    if (!tail || tail.role !== "assistant") return;
    const kept = entries.slice(0, -1);
    kept.push(message);
    this.log.compactInPlace(kept);
    if (this.sessionName) {
      try {
        rewriteSession(this.sessionName, kept);
      } catch {
      }
    }
  }
  /** "New chat" — drops in-memory messages, archives the on-disk transcript so it survives in Sessions, keeps sessionName so the prefix cache stays warm. */
  clearLog() {
    const dropped = this.log.length;
    this.log.compactInPlace([]);
    let archived = null;
    if (this.sessionName) {
      try {
        archived = archiveSession(this.sessionName);
        if (archived === null) rewriteSession(this.sessionName, []);
      } catch {
      }
    }
    this.scratch.reset();
    this._inflight.clear();
    return { dropped, archived };
  }
  configure(opts) {
    if (opts.model !== void 0) this.model = opts.model;
    if (opts.stream !== void 0) {
      this._streamPreference = opts.stream;
      this.stream = opts.stream;
    }
    if (opts.reasoningEffort !== void 0) this.reasoningEffort = opts.reasoningEffort;
    if (opts.autoEscalate !== void 0) this.autoEscalate = opts.autoEscalate;
  }
  /** `null` disables the cap; any change re-arms the 80% warning. */
  setBudget(usd) {
    this.budgetUsd = typeof usd === "number" && usd > 0 ? usd : null;
    this._budgetWarned = false;
  }
  /** Single-turn upgrade consumed at next step() — distinct from `/preset max` (persistent). */
  armProForNextTurn() {
    this._proArmedForNextTurn = true;
  }
  /** Cancel `/pro` arming before the next turn starts. */
  disarmPro() {
    this._proArmedForNextTurn = false;
  }
  /** UI surface — true while `/pro` is queued but hasn't fired yet. */
  get proArmed() {
    return this._proArmedForNextTurn;
  }
  /** UI surface — true while the current turn is running on pro (armed or auto-escalated). */
  get escalatedThisTurn() {
    return this._escalateThisTurn;
  }
  /** UI surface — model id of the call about to run (or running) right now, including escalation. */
  get currentCallModel() {
    return this.modelForCurrentCall();
  }
  modelForCurrentCall() {
    return this._escalateThisTurn ? ESCALATION_MODEL : this.model;
  }
  /** Returns true ONLY on the tipping call — caller surfaces a one-shot warning. */
  noteToolFailureSignal(resultJson, repair) {
    if (!this._turnFailures.noteAndCrossedThreshold(resultJson, repair)) return false;
    if (this._escalateThisTurn || !this.autoEscalate) return false;
    this._escalateThisTurn = true;
    return true;
  }
  async runOneToolCall(call, signal) {
    const name = call.function?.name ?? "";
    const args = call.function?.arguments ?? "{}";
    const parsedArgs = safeParseToolArgs(args);
    this._inflight.add(this.inflightIdFor(call));
    try {
      const preReport = await runHooks({
        hooks: this.hooks,
        payload: {
          event: "PreToolUse",
          cwd: this.hookCwd,
          toolName: name,
          toolArgs: parsedArgs
        }
      });
      const preWarnings = [...hookWarnings(preReport.outcomes, this._turn)];
      if (preReport.blocked) {
        const blocking = preReport.outcomes[preReport.outcomes.length - 1];
        const reason = (blocking?.stderr || blocking?.stdout || "blocked by PreToolUse hook").trim();
        return {
          preWarnings,
          postWarnings: [],
          result: `[hook block] ${blocking?.hook.command ?? "<unknown>"}
${reason}`
        };
      }
      const result = await this.tools.dispatch(name, args, {
        signal,
        maxResultTokens: DEFAULT_MAX_RESULT_TOKENS,
        confirmationGate: this.confirmationGate
      });
      const postReport = await runHooks({
        hooks: this.hooks,
        payload: {
          event: "PostToolUse",
          cwd: this.hookCwd,
          toolName: name,
          toolArgs: parsedArgs,
          toolResult: result
        }
      });
      const postWarnings = [...hookWarnings(postReport.outcomes, this._turn)];
      return { preWarnings, postWarnings, result };
    } finally {
      this._inflight.delete(this.inflightIdFor(call));
    }
  }
  /** Stable per-call id used as the inflight key AND threaded into tool_start / tool events so the UI matches them up. */
  inflightIdFor(call) {
    if (call.id) return call.id;
    const fallback = call._inflightFallback;
    if (fallback) return fallback;
    const generated = `inflight-${++this._inflightCounter}`;
    call._inflightFallback = generated;
    return generated;
  }
  _inflightCounter = 0;
  buildMessages(pendingUser) {
    const healed = healLoadedMessages(this.log.toMessages(), DEFAULT_MAX_RESULT_CHARS);
    const msgs = [...this.prefix.toMessages(), ...healed.messages];
    if (pendingUser !== null) msgs.push({ role: "user", content: pendingUser });
    return msgs;
  }
  abort() {
    this._turnAbort.abort();
  }
  /** Drop the last user message + everything after; caller re-sends. Persists to session file. */
  retryLastUser() {
    const entries = this.log.entries;
    let lastUserIdx = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return null;
    const raw = entries[lastUserIdx].content;
    const userText = typeof raw === "string" ? raw : "";
    const preserved = entries.slice(0, lastUserIdx).map((m) => ({ ...m }));
    this.log.compactInPlace(preserved);
    if (this.sessionName) {
      try {
        rewriteSession(this.sessionName, preserved);
      } catch {
      }
    }
    return userText;
  }
  async *step(userInput) {
    if (this.budgetUsd !== null) {
      const spent = this.stats.totalCost;
      if (spent >= this.budgetUsd) {
        yield {
          turn: this._turn,
          role: "error",
          content: "",
          error: t("loop.budgetExhausted", {
            spent: spent.toFixed(4),
            cap: this.budgetUsd.toFixed(2)
          })
        };
        return;
      }
      if (!this._budgetWarned && spent >= this.budgetUsd * 0.8) {
        this._budgetWarned = true;
        yield {
          turn: this._turn,
          role: "warning",
          content: t("loop.budget80Pct", {
            spent: spent.toFixed(4),
            cap: this.budgetUsd.toFixed(2)
          })
        };
      }
    }
    this._turn++;
    this.scratch.reset();
    this.repair.resetStorm();
    this._turnFailures.reset();
    this._turnSelfCorrected = false;
    this._escalateThisTurn = false;
    this._foldedThisTurn = false;
    this._toolDispatchesThisStep = 0;
    let armedConsumed = false;
    if (this._proArmedForNextTurn) {
      this._escalateThisTurn = true;
      this._proArmedForNextTurn = false;
      armedConsumed = true;
    }
    const carryAbort = this._turnAbort.signal.aborted;
    this._turnAbort = new AbortController();
    if (carryAbort) this._turnAbort.abort();
    const signal = this._turnAbort.signal;
    if (armedConsumed) {
      yield {
        turn: this._turn,
        role: "warning",
        content: t("loop.proArmed")
      };
    }
    let pendingUser = userInput;
    const toolSpecs = this.prefix.tools();
    const warnAt = Math.max(1, Math.floor(this.maxToolIters * 0.7));
    let warnedForIterBudget = false;
    for (let iter = 0; iter < this.maxToolIters; iter++) {
      if (signal.aborted) {
        yield {
          turn: this._turn,
          role: "warning",
          content: t("loop.abortedAtIter", { iter, cap: this.maxToolIters })
        };
        const stoppedMsg = "[aborted by user (Esc) \u2014 no summary produced. Ask again or /retry when ready; prior tool output is still in the log.]";
        this.appendAndPersist(buildSyntheticAssistantMessage(stoppedMsg, this.model));
        yield {
          turn: this._turn,
          role: "assistant_final",
          content: stoppedMsg,
          forcedSummary: true
        };
        yield { turn: this._turn, role: "done", content: stoppedMsg };
        this._turnAbort = new AbortController();
        return;
      }
      if (iter > 0) {
        yield {
          turn: this._turn,
          role: "status",
          content: t("loop.toolUploadStatus")
        };
      }
      if (!warnedForIterBudget && iter >= warnAt) {
        warnedForIterBudget = true;
        yield {
          turn: this._turn,
          role: "warning",
          content: t("loop.toolBudgetWarning", { iter, cap: this.maxToolIters })
        };
      }
      let messages = this.buildMessages(pendingUser);
      {
        const decision2 = this.context.decidePreflight(messages, this.prefix.toolSpecs, this.model);
        if (decision2.needsAction) {
          const { estimateTokens: estimate, ctxMax } = decision2;
          yield {
            turn: this._turn,
            role: "status",
            content: t("loop.preflightFoldStatus")
          };
          const result = await this.context.fold(this.model);
          if (result.folded) {
            yield {
              turn: this._turn,
              role: "warning",
              content: t("loop.preflightFolded", {
                estimate: estimate.toLocaleString(),
                ctxMax: ctxMax.toLocaleString(),
                pct: Math.round(estimate / ctxMax * 100),
                beforeMessages: result.beforeMessages,
                afterMessages: result.afterMessages,
                summaryChars: result.summaryChars
              })
            };
            messages = this.buildMessages(pendingUser);
          } else {
            yield {
              turn: this._turn,
              role: "warning",
              content: t("loop.preflightNoFold", {
                estimate: estimate.toLocaleString(),
                ctxMax: ctxMax.toLocaleString(),
                pct: Math.round(estimate / ctxMax * 100)
              })
            };
          }
        }
      }
      let assistantContent = "";
      let reasoningContent = "";
      let toolCalls = [];
      let usage = null;
      try {
        if (this.stream) {
          const callBuf = /* @__PURE__ */ new Map();
          const readyIndices = /* @__PURE__ */ new Set();
          const callModel = this.modelForCurrentCall();
          const bufferForEscalation = this.autoEscalate && callModel !== ESCALATION_MODEL;
          let escalationBuf = "";
          let escalationBufFlushed = false;
          for await (const chunk of this.client.stream({
            model: callModel,
            messages,
            tools: toolSpecs.length ? toolSpecs : void 0,
            signal,
            thinking: thinkingModeForModel(callModel),
            reasoningEffort: this.reasoningEffort
          })) {
            if (chunk.contentDelta) {
              assistantContent += chunk.contentDelta;
              if (bufferForEscalation && !escalationBufFlushed) {
                escalationBuf += chunk.contentDelta;
                if (isEscalationRequest(escalationBuf)) {
                  break;
                }
                if (escalationBuf.length >= NEEDS_PRO_BUFFER_CHARS || !looksLikePartialEscalationMarker(escalationBuf)) {
                  escalationBufFlushed = true;
                  yield {
                    turn: this._turn,
                    role: "assistant_delta",
                    content: escalationBuf
                  };
                  escalationBuf = "";
                }
              } else {
                yield {
                  turn: this._turn,
                  role: "assistant_delta",
                  content: chunk.contentDelta
                };
              }
            }
            if (chunk.reasoningDelta) {
              reasoningContent += chunk.reasoningDelta;
              yield {
                turn: this._turn,
                role: "assistant_delta",
                content: "",
                reasoningDelta: chunk.reasoningDelta
              };
            }
            if (chunk.toolCallDelta) {
              const d = chunk.toolCallDelta;
              const cur = callBuf.get(d.index) ?? {
                id: d.id,
                type: "function",
                function: { name: "", arguments: "" }
              };
              if (d.id) cur.id = d.id;
              if (d.name) cur.function.name = (cur.function.name ?? "") + d.name;
              if (d.argumentsDelta)
                cur.function.arguments = (cur.function.arguments ?? "") + d.argumentsDelta;
              callBuf.set(d.index, cur);
              if (!readyIndices.has(d.index) && cur.function.name && looksLikeCompleteJson(cur.function.arguments ?? "")) {
                readyIndices.add(d.index);
              }
              if (cur.function.name) {
                yield {
                  turn: this._turn,
                  role: "tool_call_delta",
                  content: "",
                  toolName: cur.function.name,
                  toolCallArgsChars: (cur.function.arguments ?? "").length,
                  toolCallIndex: d.index,
                  toolCallReadyCount: readyIndices.size
                };
              }
            }
            if (chunk.usage) usage = chunk.usage;
          }
          toolCalls = [...callBuf.values()];
          if (bufferForEscalation && !escalationBufFlushed && escalationBuf.length > 0) {
            if (!isEscalationRequest(escalationBuf)) {
              yield {
                turn: this._turn,
                role: "assistant_delta",
                content: escalationBuf
              };
            }
          }
        } else {
          const callModel = this.modelForCurrentCall();
          const resp = await this.client.chat({
            model: callModel,
            messages,
            tools: toolSpecs.length ? toolSpecs : void 0,
            signal,
            thinking: thinkingModeForModel(callModel),
            reasoningEffort: this.reasoningEffort
          });
          assistantContent = resp.content;
          reasoningContent = resp.reasoningContent ?? "";
          toolCalls = resp.toolCalls;
          usage = resp.usage;
        }
      } catch (err) {
        if (signal.aborted) {
          yield { turn: this._turn, role: "done", content: "" };
          this._turnAbort = new AbortController();
          return;
        }
        const probe = is5xxError(err) ? await probeDeepSeekReachable(this.client) : void 0;
        yield {
          turn: this._turn,
          role: "error",
          content: "",
          error: formatLoopError(err, probe)
        };
        return;
      }
      if (this.autoEscalate && this.modelForCurrentCall() !== ESCALATION_MODEL && isEscalationRequest(assistantContent)) {
        const { reason } = parseEscalationMarker(assistantContent);
        this._escalateThisTurn = true;
        const reasonSuffix = reason ? ` \u2014 ${reason}` : "";
        yield {
          turn: this._turn,
          role: "warning",
          content: t("loop.flashEscalation", { model: ESCALATION_MODEL, reasonSuffix })
        };
        assistantContent = "";
        reasoningContent = "";
        toolCalls = [];
        usage = null;
        iter--;
        continue;
      }
      const turnStats = this.stats.record(
        this._turn,
        this.modelForCurrentCall(),
        usage ?? new Usage()
      );
      if (pendingUser !== null) {
        this.appendAndPersist({ role: "user", content: pendingUser });
        pendingUser = null;
      }
      this.scratch.reasoning = reasoningContent || null;
      const { calls: repairedCalls, report } = this.repair.process(
        toolCalls,
        reasoningContent || null,
        assistantContent || null
      );
      this.appendAndPersist(
        buildAssistantMessage(
          assistantContent,
          repairedCalls,
          this.modelForCurrentCall(),
          reasoningContent
        )
      );
      yield {
        turn: this._turn,
        role: "assistant_final",
        content: assistantContent,
        stats: turnStats,
        repair: report
      };
      if (this.noteToolFailureSignal("", report)) {
        yield {
          turn: this._turn,
          role: "warning",
          content: t("loop.autoEscalation", {
            model: ESCALATION_MODEL,
            breakdown: this._turnFailures.formatBreakdown(),
            fallback: this.model
          })
        };
      }
      const allSuppressed = report.stormsBroken > 0 && repairedCalls.length === 0 && toolCalls.length > 0;
      if (allSuppressed && !this._turnSelfCorrected) {
        this._turnSelfCorrected = true;
        this.replaceTailAssistantMessage(
          buildAssistantMessage(
            assistantContent,
            toolCalls,
            this.modelForCurrentCall(),
            reasoningContent
          )
        );
        for (const call of toolCalls) {
          this.appendAndPersist({
            role: "tool",
            tool_call_id: call.id ?? "",
            name: call.function?.name ?? "",
            content: "[repeat-loop guard] this call was suppressed because it was identical to a previous call in this turn. Earlier results for it are above \u2014 try a meaningfully different approach, or stop and answer if you have enough."
          });
        }
        yield {
          turn: this._turn,
          role: "warning",
          content: t("loop.repeatToolCallWarning")
        };
        continue;
      }
      if (report.stormsBroken > 0) {
        const noteTail = report.notes.length ? ` \u2014 ${report.notes[report.notes.length - 1]}` : "";
        const phrase = allSuppressed ? t("loop.stormStuck") : t("loop.stormSuppressed", { count: report.stormsBroken });
        yield {
          turn: this._turn,
          role: "warning",
          content: `${phrase}${noteTail}`
        };
      }
      if (repairedCalls.length === 0) {
        if (allSuppressed) {
          yield* forceSummaryAfterIterLimit(this.summaryContext(), { reason: "stuck" });
          return;
        }
        yield { turn: this._turn, role: "done", content: assistantContent };
        return;
      }
      const decision = this.context.decideAfterUsage(usage, this.model, this._foldedThisTurn);
      if (decision.kind === "fold") {
        this._foldedThisTurn = true;
        const before = decision.promptTokens;
        const ctxMax = decision.ctxMax;
        const aggressiveTag = decision.aggressive ? t("loop.aggressiveTag") : "";
        yield {
          turn: this._turn,
          role: "status",
          content: t("loop.compactingHistoryStatus", { aggressiveTag })
        };
        const result = await this.compactHistory({ keepRecentTokens: decision.tailBudget });
        if (result.folded) {
          yield {
            turn: this._turn,
            role: "warning",
            content: t(
              decision.aggressive ? "loop.aggressivelyFoldedHistory" : "loop.foldedHistory",
              {
                before: before.toLocaleString(),
                ctxMax: ctxMax.toLocaleString(),
                pct: Math.round(before / ctxMax * 100),
                beforeMessages: result.beforeMessages,
                afterMessages: result.afterMessages,
                summaryChars: result.summaryChars
              }
            )
          };
        }
      } else if (decision.kind === "exit-with-summary") {
        const before = decision.promptTokens;
        const ctxMax = decision.ctxMax;
        yield {
          turn: this._turn,
          role: "warning",
          content: t("loop.forcingSummary", {
            before: before.toLocaleString(),
            ctxMax: ctxMax.toLocaleString(),
            pct: Math.round(before / ctxMax * 100)
          })
        };
        this.context.trimTrailingToolCalls();
        yield* forceSummaryAfterIterLimit(this.summaryContext(), { reason: "context-guard" });
        return;
      }
      const dispatchSerial = (process.env.REASONIX_TOOL_DISPATCH ?? "auto").toLowerCase() === "serial";
      const parallelMaxParsed = Number.parseInt(process.env.REASONIX_PARALLEL_MAX ?? "", 10);
      const parallelMax = Number.isFinite(parallelMaxParsed) && parallelMaxParsed >= 1 ? Math.min(parallelMaxParsed, 16) : 3;
      let callIdx = 0;
      while (callIdx < repairedCalls.length) {
        const chunk = [];
        if (!dispatchSerial) {
          while (callIdx < repairedCalls.length && chunk.length < parallelMax && this.tools.isParallelSafe(repairedCalls[callIdx]?.function?.name ?? "")) {
            chunk.push(repairedCalls[callIdx++]);
          }
        }
        if (chunk.length === 0) {
          chunk.push(repairedCalls[callIdx++]);
        }
        for (const call of chunk) {
          const callId = this.inflightIdFor(call);
          this._inflight.add(callId);
          yield {
            turn: this._turn,
            role: "tool_start",
            content: "",
            toolName: call.function?.name ?? "",
            toolArgs: call.function?.arguments ?? "{}",
            callId
          };
        }
        const settled = await Promise.allSettled(chunk.map((c) => this.runOneToolCall(c, signal)));
        for (let k = 0; k < chunk.length; k++) {
          const call = chunk[k];
          const name = call.function?.name ?? "";
          const args = call.function?.arguments ?? "{}";
          const s = settled[k];
          let result;
          let preWarnings = [];
          let postWarnings = [];
          if (s.status === "fulfilled") {
            preWarnings = s.value.preWarnings;
            postWarnings = s.value.postWarnings;
            result = s.value.result;
          } else {
            const err = s.reason instanceof Error ? s.reason : new Error(String(s.reason));
            result = JSON.stringify({ error: `${err.name}: ${err.message}` });
          }
          for (const w of preWarnings) yield w;
          for (const w of postWarnings) yield w;
          this.appendAndPersist({
            role: "tool",
            tool_call_id: call.id ?? "",
            name,
            content: result
          });
          if (this.noteToolFailureSignal(result)) {
            yield {
              turn: this._turn,
              role: "warning",
              content: t("loop.autoEscalation", {
                model: ESCALATION_MODEL,
                breakdown: this._turnFailures.formatBreakdown(),
                fallback: this.model
              })
            };
          }
          yield {
            turn: this._turn,
            role: "tool",
            content: result,
            toolName: name,
            toolArgs: args,
            callId: this.inflightIdFor(call)
          };
        }
      }
    }
    yield* forceSummaryAfterIterLimit(this.summaryContext(), { reason: "budget" });
  }
  summaryContext() {
    return {
      client: this.client,
      signal: this._turnAbort.signal,
      buildMessages: () => this.buildMessages(null),
      appendAndPersist: (m) => this.appendAndPersist(m),
      recordStats: (model, usage) => this.stats.record(this._turn, model, usage),
      turn: this._turn,
      maxToolIters: this.maxToolIters
    };
  }
  async run(userInput, onEvent) {
    let final = "";
    for await (const ev of this.step(userInput)) {
      onEvent?.(ev);
      if (ev.role === "assistant_final") final = ev.content;
      if (ev.role === "done") break;
    }
    return final;
  }
};
function parsePositiveIntEnv(raw) {
  if (!raw) return void 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : void 0;
}

// src/tools/filesystem.ts
import { promises as fs4 } from "fs";
import * as pathMod4 from "path";
import picomatch2 from "picomatch";

// src/tools/fs/edit.ts
import { promises as fs } from "fs";
import * as pathMod from "path";
function displayRel(rootDir, full) {
  return pathMod.relative(rootDir, full).replaceAll("\\", "/");
}
async function applyEdit(rootDir, abs, args) {
  if (args.search.length === 0) {
    throw new Error("edit_file: search cannot be empty");
  }
  const before = await fs.readFile(abs, "utf8");
  const le = before.includes("\r\n") ? "\r\n" : "\n";
  const adaptedSearch = args.search.replace(/\r?\n/g, le);
  const adaptedReplace = args.replace.replace(/\r?\n/g, le);
  const firstIdx = before.indexOf(adaptedSearch);
  if (firstIdx < 0) {
    throw new Error(`edit_file: search text not found in ${displayRel(rootDir, abs)}`);
  }
  const nextIdx = before.indexOf(adaptedSearch, firstIdx + 1);
  if (nextIdx >= 0) {
    throw new Error(
      `edit_file: search text appears multiple times in ${displayRel(rootDir, abs)} \u2014 include more context to disambiguate`
    );
  }
  const after = before.slice(0, firstIdx) + adaptedReplace + before.slice(firstIdx + adaptedSearch.length);
  await fs.writeFile(abs, after, "utf8");
  const rel = displayRel(rootDir, abs);
  const header = `edited ${rel} (${adaptedSearch.length}\u2192${adaptedReplace.length} chars)`;
  const startLine = before.slice(0, firstIdx).split(/\r?\n/).length;
  const diff = renderEditDiff(adaptedSearch, adaptedReplace, startLine);
  return `${header}
${diff}`;
}
async function applyMultiEdit(rootDir, edits) {
  if (edits.length === 0) {
    throw new Error("multi_edit: edits must contain at least one entry");
  }
  const filesByPath = /* @__PURE__ */ new Map();
  for (let i = 0; i < edits.length; i++) {
    const e = edits[i];
    if (typeof e.abs !== "string" || e.abs.length === 0) {
      throw new Error(`multi_edit: edit #${i + 1} requires a string \`path\` (no edits applied)`);
    }
    if (typeof e.search !== "string") {
      throw new Error(`multi_edit: edit #${i + 1} requires a string \`search\` (no edits applied)`);
    }
    if (typeof e.replace !== "string") {
      throw new Error(
        `multi_edit: edit #${i + 1} requires a string \`replace\` (no edits applied)`
      );
    }
    const rel = displayRel(rootDir, e.abs);
    if (e.search.length === 0) {
      throw new Error(
        `multi_edit: edit #${i + 1} (${rel}) search cannot be empty (no edits applied)`
      );
    }
    let state = filesByPath.get(e.abs);
    if (!state) {
      let before;
      try {
        before = await fs.readFile(e.abs, "utf8");
      } catch (err) {
        throw new Error(
          `multi_edit: edit #${i + 1} cannot read ${rel}: ${err.message} (no edits applied)`
        );
      }
      const le = before.includes("\r\n") ? "\r\n" : "\n";
      state = { buf: before, le, hunks: [], deltaChars: 0, touched: 0 };
      filesByPath.set(e.abs, state);
    }
    const adaptedSearch = e.search.replace(/\r?\n/g, state.le);
    const adaptedReplace = e.replace.replace(/\r?\n/g, state.le);
    const firstIdx = state.buf.indexOf(adaptedSearch);
    if (firstIdx < 0) {
      throw new Error(
        `multi_edit: edit #${i + 1} search text not found in ${rel} \u2014 no edits applied (multi_edit is atomic)`
      );
    }
    const nextIdx = state.buf.indexOf(adaptedSearch, firstIdx + 1);
    if (nextIdx >= 0) {
      throw new Error(
        `multi_edit: edit #${i + 1} search text appears multiple times in ${rel} \u2014 include more context to disambiguate (no edits applied)`
      );
    }
    const startLine = state.buf.slice(0, firstIdx).split(/\r?\n/).length;
    state.buf = state.buf.slice(0, firstIdx) + adaptedReplace + state.buf.slice(firstIdx + adaptedSearch.length);
    state.hunks.push(`# ${rel}
${renderEditDiff(adaptedSearch, adaptedReplace, startLine)}`);
    state.deltaChars += adaptedReplace.length - adaptedSearch.length;
    state.touched++;
  }
  for (const [abs, state] of filesByPath) {
    await fs.writeFile(abs, state.buf, "utf8");
  }
  const fileCount = filesByPath.size;
  const editCount = edits.length;
  let totalDelta = 0;
  const allHunks = [];
  for (const state of filesByPath.values()) {
    totalDelta += state.deltaChars;
    allHunks.push(...state.hunks);
  }
  const sign = totalDelta >= 0 ? "+" : "";
  const editNoun = editCount === 1 ? "edit" : "edits";
  const fileNoun = fileCount === 1 ? "file" : "files";
  const header = `multi_edit: applied ${editCount} ${editNoun} across ${fileCount} ${fileNoun} (${sign}${totalDelta} chars)`;
  return `${header}
${allHunks.join("\n")}`;
}
function renderEditDiff(search, replace, startLine) {
  const a = search.split(/\r?\n/);
  const b = replace.split(/\r?\n/);
  const diff = lineDiff(a, b);
  const hunk = `@@ -${startLine},${a.length} +${startLine},${b.length} @@`;
  const body = diff.map((d) => `${d.op === " " ? " " : d.op} ${d.line}`).join("\n");
  return `${hunk}
${body}`;
}
function lineDiff(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i2 = 1; i2 <= n; i2++) {
    for (let j2 = 1; j2 <= m; j2++) {
      if (a[i2 - 1] === b[j2 - 1]) dp[i2][j2] = dp[i2 - 1][j2 - 1] + 1;
      else dp[i2][j2] = Math.max(dp[i2 - 1][j2], dp[i2][j2 - 1]);
    }
  }
  const out = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.unshift({ op: " ", line: a[i - 1] });
      i--;
      j--;
    } else if ((dp[i - 1][j] ?? 0) > (dp[i][j - 1] ?? 0)) {
      out.unshift({ op: "-", line: a[i - 1] });
      i--;
    } else {
      out.unshift({ op: "+", line: b[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    out.unshift({ op: "-", line: a[i - 1] });
    i--;
  }
  while (j > 0) {
    out.unshift({ op: "+", line: b[j - 1] });
    j--;
  }
  return out;
}

// src/tools/fs/glob.ts
import { promises as fs2 } from "fs";
import * as pathMod2 from "path";
import picomatch from "picomatch";
function displayRel2(rootDir, full) {
  return pathMod2.relative(rootDir, full).replaceAll("\\", "/");
}
async function globFiles(ctx, startAbs, args) {
  if (args.signal?.aborted) {
    throw new DOMException("glob aborted by user", "AbortError");
  }
  const includeDeps = args.include_deps === true;
  const sortBy = args.sort_by ?? "mtime";
  const limit = Math.max(1, Math.min(1e3, Math.floor(args.limit ?? 200)));
  const isMatch = picomatch(args.pattern, { dot: true, nocase: true });
  const hits = [];
  const walk2 = async (dir) => {
    if (args.signal?.aborted) {
      throw new DOMException("glob aborted by user", "AbortError");
    }
    let entries;
    try {
      entries = await fs2.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = pathMod2.join(dir, e.name);
      if (e.isDirectory()) {
        if (!includeDeps && ctx.skipDirNames.has(e.name)) continue;
        await walk2(full);
        continue;
      }
      if (!e.isFile() && !e.isSymbolicLink()) continue;
      const rel = displayRel2(ctx.rootDir, full);
      if (!isMatch(rel)) continue;
      let mtimeMs = 0;
      if (sortBy === "mtime") {
        try {
          const st = await fs2.stat(full);
          mtimeMs = st.mtimeMs;
        } catch {
          continue;
        }
      }
      hits.push({ rel, mtimeMs });
    }
  };
  await walk2(startAbs);
  if (hits.length === 0) return "(no matches)";
  if (sortBy === "mtime") hits.sort((a, b) => b.mtimeMs - a.mtimeMs);
  else hits.sort((a, b) => a.rel.localeCompare(b.rel));
  const truncated = hits.length > limit;
  const shown = hits.slice(0, limit);
  const lines = shown.map((h) => h.rel);
  if (truncated) {
    lines.push(
      `[\u2026 ${hits.length - limit} more matches \u2014 refine pattern or raise limit (max 1000) \u2026]`
    );
  }
  return lines.join("\n");
}

// src/tools/fs/search.ts
import { promises as fs3 } from "fs";
import * as pathMod3 from "path";
function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw new DOMException("search aborted by user", "AbortError");
}
function displayRel3(rootDir, full) {
  return pathMod3.relative(rootDir, full).replaceAll("\\", "/");
}
async function searchFiles(ctx, startAbs, args) {
  throwIfAborted(args.signal);
  const needle = args.pattern.toLowerCase();
  const includeDeps = args.include_deps === true;
  let re = null;
  try {
    re = new RegExp(args.pattern, "i");
  } catch {
    re = null;
  }
  const matches = [];
  let totalBytes = 0;
  const walk2 = async (dir) => {
    throwIfAborted(args.signal);
    let entries;
    try {
      entries = await fs3.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      throwIfAborted(args.signal);
      const full = pathMod3.join(dir, e.name);
      const lower = e.name.toLowerCase();
      const hit = re ? re.test(e.name) : lower.includes(needle);
      if (hit) {
        const rel = displayRel3(ctx.rootDir, full);
        if (totalBytes + rel.length + 1 > ctx.maxListBytes) {
          matches.push("[\u2026 search truncated \u2014 refine pattern \u2026]");
          return;
        }
        matches.push(rel);
        totalBytes += rel.length + 1;
      }
      if (e.isDirectory()) {
        if (!includeDeps && ctx.skipDirNames.has(e.name)) continue;
        await walk2(full);
      }
    }
  };
  await walk2(startAbs);
  return matches.length === 0 ? "(no matches)" : matches.join("\n");
}
var MAX_HITS_PER_FILE = 30;
var SUMMARY_MODE_TRIGGER_RATIO = 0.8;
async function searchContent(ctx, startAbs, args) {
  throwIfAborted(args.signal);
  const caseSensitive = args.case_sensitive === true;
  const includeDeps = args.include_deps === true;
  const ctxLines = Math.max(0, Math.min(20, Math.floor(args.context ?? 0)));
  const summaryOnly = args.summary_only === true;
  let re = null;
  try {
    re = new RegExp(args.pattern, caseSensitive ? "" : "i");
  } catch {
    re = null;
  }
  const needle = caseSensitive ? args.pattern : args.pattern.toLowerCase();
  const matches = [];
  let totalBytes = 0;
  let scanned = 0;
  let truncated = false;
  let summaryMode = summaryOnly;
  let summaryNoticeEmitted = false;
  const fileHitCounts = /* @__PURE__ */ new Map();
  const pushLine = (out) => {
    if (totalBytes + out.length + 1 > ctx.maxListBytes) {
      matches.push(`[\u2026 truncated at ${ctx.maxListBytes} bytes \u2014 refine pattern or path \u2026]`);
      truncated = true;
      return false;
    }
    matches.push(out);
    totalBytes += out.length + 1;
    return true;
  };
  const maybeEnterSummaryMode = () => {
    if (summaryMode) return;
    if (totalBytes <= SUMMARY_MODE_TRIGGER_RATIO * ctx.maxListBytes) return;
    summaryMode = true;
    if (!summaryNoticeEmitted) {
      const pct = Math.round(totalBytes / ctx.maxListBytes * 100);
      pushLine(
        `[switching to summary mode \u2014 byte budget at ${pct}%; remaining files will report match counts only]`
      );
      summaryNoticeEmitted = true;
    }
  };
  const walk2 = async (dir) => {
    if (truncated) return;
    throwIfAborted(args.signal);
    let entries;
    try {
      entries = await fs3.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (truncated) return;
      throwIfAborted(args.signal);
      if (e.isDirectory()) {
        if (!includeDeps && ctx.skipDirNames.has(e.name)) continue;
        await walk2(pathMod3.join(dir, e.name));
        continue;
      }
      if (!e.isFile()) continue;
      const full = pathMod3.join(dir, e.name);
      if (ctx.nameMatch && !ctx.nameMatch(e.name, displayRel3(ctx.rootDir, full))) continue;
      if (ctx.isBinaryByName(e.name)) continue;
      let fh;
      try {
        fh = await fs3.open(full, "r");
      } catch {
        continue;
      }
      let raw;
      try {
        throwIfAborted(args.signal);
        const st = await fh.stat();
        if (st.size > 2 * 1024 * 1024) {
          await fh.close();
          continue;
        }
        raw = await fh.readFile();
      } catch {
        await fh.close().catch(() => {
        });
        continue;
      }
      await fh.close();
      throwIfAborted(args.signal);
      const firstNul = raw.indexOf(0);
      if (firstNul !== -1 && firstNul < 8 * 1024) continue;
      const text = raw.toString("utf8");
      const rel = displayRel3(ctx.rootDir, full);
      const lines = text.split(/\r?\n/);
      const hits = [];
      for (let li = 0; li < lines.length; li++) {
        throwIfAborted(args.signal);
        const line = lines[li];
        const lineForCheck = caseSensitive ? line : line.toLowerCase();
        const hit = re ? re.test(line) : lineForCheck.includes(needle);
        if (hit) hits.push(li);
      }
      scanned++;
      if (hits.length === 0) continue;
      fileHitCounts.set(rel, hits.length);
      if (summaryMode) {
        if (!pushLine(`${rel}: ${hits.length} match${hits.length === 1 ? "" : "es"}`)) return;
        continue;
      }
      const printable = Math.min(hits.length, MAX_HITS_PER_FILE);
      const omittedFromFile = hits.length - printable;
      const printableHits = hits.slice(0, printable);
      if (ctxLines === 0) {
        for (const li of printableHits) {
          if (truncated) return;
          const line = lines[li];
          const display = line.length > 200 ? `${line.slice(0, 200)}\u2026` : line;
          if (!pushLine(`${rel}:${li + 1}: ${display}`)) return;
        }
      } else {
        const hitSet = new Set(printableHits);
        let prevWindowEnd = -2;
        for (const li of printableHits) {
          if (truncated) return;
          const winStart = Math.max(0, li - ctxLines);
          const winEnd = Math.min(lines.length - 1, li + ctxLines);
          if (winStart > prevWindowEnd + 1 && prevWindowEnd >= 0) {
            if (!pushLine("--")) return;
          }
          const realStart = winStart > prevWindowEnd + 1 ? winStart : prevWindowEnd + 1;
          for (let i = realStart; i <= winEnd; i++) {
            const line = lines[i];
            const display = line.length > 200 ? `${line.slice(0, 200)}\u2026` : line;
            const sep2 = hitSet.has(i) ? ":" : "-";
            if (!pushLine(`${rel}:${i + 1}${sep2} ${display}`)) return;
          }
          prevWindowEnd = winEnd;
        }
      }
      if (omittedFromFile > 0) {
        if (!pushLine(
          `[${rel}: ${omittedFromFile} more match${omittedFromFile === 1 ? "" : "es"} in this file \u2014 re-grep with a tighter pattern or use read_file to see them]`
        ))
          return;
      }
      maybeEnterSummaryMode();
    }
  };
  await walk2(startAbs);
  if (matches.length === 0) {
    return scanned === 0 ? "(no files scanned \u2014 path empty or all files filtered out)" : `(no matches across ${scanned} file${scanned === 1 ? "" : "s"})`;
  }
  return matches.join("\n");
}

// src/tools/filesystem.ts
var DEFAULT_MAX_READ_BYTES = 2 * 1024 * 1024;
var DEFAULT_MAX_LIST_BYTES = 256 * 1024;
var DEFAULT_AUTO_PREVIEW_LINES = 200;
var AUTO_PREVIEW_HEAD_LINES = 80;
var AUTO_PREVIEW_TAIL_LINES = 40;
var OUTLINE_MAX_ENTRIES = 30;
var OUTLINE_TAIL_KEEP = 5;
var TS_EXPORT_RE = /^export\s+(?:default\s+)?(?:async\s+)?(function|class|const|let|var|interface|type|enum)\s+\*?\s*(\w+)/;
function extractTsExportOutline(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("export ")) continue;
    const m = TS_EXPORT_RE.exec(line);
    if (!m) continue;
    out.push({ line: i + 1, kind: m[1], name: m[2] });
  }
  return out;
}
function formatOutline(entries) {
  const total = entries.length;
  if (total === 0) return "";
  const lastEntry = entries[total - 1];
  const width = String(lastEntry.line).length;
  const fmt = (e) => `  L${String(e.line).padStart(width, " ")}  export ${e.kind} ${e.name}`;
  const header = `[outline: ${total} top-level export${total === 1 ? "" : "s"}]`;
  if (total <= OUTLINE_MAX_ENTRIES) {
    return [header, ...entries.map(fmt)].join("\n");
  }
  const headCount = OUTLINE_MAX_ENTRIES - OUTLINE_TAIL_KEEP;
  const headEntries = entries.slice(0, headCount);
  const tailEntries = entries.slice(-OUTLINE_TAIL_KEEP);
  const omitted = total - OUTLINE_MAX_ENTRIES;
  const gapStart = headEntries[headEntries.length - 1].line;
  const gapEnd = tailEntries[0].line;
  return [
    header,
    ...headEntries.map(fmt),
    `  [\u2026 ${omitted} more export${omitted === 1 ? "" : "s"} between L${gapStart} and L${gapEnd} \u2026]`,
    ...tailEntries.map(fmt)
  ].join("\n");
}
var SKIP_DIR_NAMES = new Set(DEFAULT_INDEX_EXCLUDES.dirs);
var BINARY_EXTENSIONS = new Set(DEFAULT_INDEX_EXCLUDES.exts);
function displayRel4(rootDir, full) {
  return pathMod4.relative(rootDir, full).replaceAll("\\", "/");
}
var GLOB_METACHARS = /[*?{[]/;
function compileNameFilter(filter) {
  if (!filter) return null;
  if (!GLOB_METACHARS.test(filter)) {
    const needle = filter.toLowerCase();
    return (name) => name.toLowerCase().includes(needle);
  }
  const matchPath = filter.includes("/");
  const isMatch = picomatch2(filter, { dot: true, nocase: true });
  return matchPath ? (_n, rel) => isMatch(rel) : (name) => isMatch(name);
}
function isLikelyBinaryByName(name) {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return BINARY_EXTENSIONS.has(name.slice(dot).toLowerCase());
}
function registerFilesystemTools(registry, opts) {
  const rootDir = pathMod4.resolve(opts.rootDir);
  const allowWriting = opts.allowWriting !== false;
  const maxReadBytes = opts.maxReadBytes ?? DEFAULT_MAX_READ_BYTES;
  const maxListBytes = opts.maxListBytes ?? DEFAULT_MAX_LIST_BYTES;
  const safePath = (raw) => {
    if (typeof raw !== "string" || raw.length === 0) {
      throw new Error("path must be a non-empty string");
    }
    let normalized = raw;
    while (normalized.startsWith("/") || normalized.startsWith("\\")) {
      normalized = normalized.slice(1);
    }
    if (normalized.length === 0) normalized = ".";
    const resolved = pathMod4.resolve(rootDir, normalized);
    const normRoot = pathMod4.resolve(rootDir);
    const rel = pathMod4.relative(normRoot, resolved);
    if (rel.startsWith("..") || pathMod4.isAbsolute(rel)) {
      throw new Error(
        `path escapes sandbox root (${normRoot}): ${raw} \u2014 workspace is pinned at launch; quit and relaunch with \`reasonix code --dir <path>\` to work in a different folder`
      );
    }
    return resolved;
  };
  registry.register({
    name: "read_file",
    parallelSafe: true,
    description: `Read a file under the sandbox root. To save context, PREFER to scope the read instead of pulling the whole file:
  - head: N  \u2192 first N lines (imports, public API, small configs)
  - tail: N  \u2192 last N lines (recently-added code, log tails)
  - range: "A-B"  \u2192 inclusive line range A..B, 1-indexed (e.g. "120-180" around an edit site)
When none of these is given AND the file is longer than ${DEFAULT_AUTO_PREVIEW_LINES} lines, the tool auto-returns a head+tail preview with an "N lines omitted" marker, plus a top-level export outline (function / class / const / interface / type / enum names with line numbers, capped at ${OUTLINE_MAX_ENTRIES}) so you can pick a smart range without a follow-up grep. If you need the middle, re-call with a range. Prefer search_content to locate a symbol first only when the outline doesn't have what you want \u2014 one scoped read beats three full-file reads.`,
    readOnly: true,
    stormExempt: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to read (relative to rootDir or absolute)." },
        head: { type: "integer", description: "If set, return only the first N lines." },
        tail: { type: "integer", description: "If set, return only the last N lines." },
        range: {
          type: "string",
          description: 'Inclusive line range like "50-100" or "50-50". 1-indexed. Takes precedence over head/tail when all three are set. Out-of-range requests clamp to file bounds.'
        }
      },
      required: ["path"]
    },
    fn: async (args) => {
      const abs = safePath(args.path);
      const fh = await fs4.open(abs, "r");
      let raw;
      try {
        const stat2 = await fh.stat();
        if (stat2.isDirectory()) {
          throw new Error(`not a file: ${args.path} (it's a directory)`);
        }
        raw = await fh.readFile();
      } finally {
        await fh.close();
      }
      if (raw.length > maxReadBytes) {
        const headBytes = raw.slice(0, maxReadBytes).toString("utf8");
        return `${headBytes}

[\u2026truncated ${raw.length - maxReadBytes} bytes \u2014 file is ${raw.length} B, cap ${maxReadBytes} B. Retry with head/tail/range for targeted view.]`;
      }
      const text = raw.toString("utf8");
      let lines = text.split(/\r?\n/);
      if (lines.length > 0 && lines[lines.length - 1] === "") lines = lines.slice(0, -1);
      const totalLines = lines.length;
      if (typeof args.range === "string" && /^\d+\s*-\s*\d+$/.test(args.range)) {
        const [rawStart, rawEnd] = args.range.split("-").map((s) => Number.parseInt(s, 10));
        const start = Math.max(1, rawStart ?? 1);
        const end = Math.min(totalLines, Math.max(start, rawEnd ?? totalLines));
        const slice = lines.slice(start - 1, end);
        const label = `[range ${start}-${end} of ${totalLines} lines]`;
        return `${label}
${slice.join("\n")}`;
      }
      if (typeof args.head === "number" && args.head > 0) {
        const count = Math.min(args.head, totalLines);
        const slice = lines.slice(0, count);
        const marker = count < totalLines ? `

[\u2026head ${count} of ${totalLines} lines \u2014 call again with range / tail for more]` : "";
        return slice.join("\n") + marker;
      }
      if (typeof args.tail === "number" && args.tail > 0) {
        const count = Math.min(args.tail, totalLines);
        const slice = lines.slice(totalLines - count);
        const marker = count < totalLines ? `[\u2026tail ${count} of ${totalLines} lines \u2014 call again with range / head for more]

` : "";
        return marker + slice.join("\n");
      }
      if (totalLines <= DEFAULT_AUTO_PREVIEW_LINES) return lines.join("\n");
      const head = lines.slice(0, AUTO_PREVIEW_HEAD_LINES).join("\n");
      const tail = lines.slice(totalLines - AUTO_PREVIEW_TAIL_LINES).join("\n");
      const omitted = totalLines - AUTO_PREVIEW_HEAD_LINES - AUTO_PREVIEW_TAIL_LINES;
      const outline = formatOutline(extractTsExportOutline(lines));
      const parts = [
        `[auto-preview: head ${AUTO_PREVIEW_HEAD_LINES} + tail ${AUTO_PREVIEW_TAIL_LINES} of ${totalLines} lines]`,
        head
      ];
      if (outline) parts.push("", outline);
      parts.push(
        `
[\u2026 ${omitted} lines omitted \u2014 call read_file again with range:"A-B" (1-indexed) or head / tail to get the middle]
`,
        tail
      );
      return parts.join("\n");
    }
  });
  registry.register({
    name: "list_directory",
    parallelSafe: true,
    description: "List entries in a directory under the sandbox root. Returns one line per entry, marking directories with a trailing slash. Not recursive \u2014 use directory_tree for that.",
    readOnly: true,
    stormExempt: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory to list (default: root)." }
      }
    },
    fn: async (args) => {
      const abs = safePath(args.path ?? ".");
      const entries = await fs4.readdir(abs, { withFileTypes: true });
      const lines = [];
      for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        lines.push(e.isDirectory() ? `${e.name}/` : e.name);
      }
      return lines.join("\n") || "(empty directory)";
    }
  });
  registry.register({
    name: "directory_tree",
    parallelSafe: true,
    description: `Recursively list entries in a directory. Shows indented tree structure with directories marked '/'. Budget-aware by default:
  - maxDepth defaults to 2 (root + one level). A depth-4 tree on a real repo blew ~5K tokens in one call. If you truly need deeper, pass maxDepth:N explicitly.
  - Skips ${[...SKIP_DIR_NAMES].sort().join(", ")} unless include_deps:true. Traversing into node_modules / .git / dist is almost always token-waste.
  - Large subtrees (>50 children) auto-collapse to "[N files, M dirs hidden \u2014 list_directory <path> to inspect]" so one huge folder can't dominate the output.
Prefer \`list_directory\` for a single-level view, \`search_files\` to find specific paths, and \`search_content\` to find code.`,
    readOnly: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Root of the tree (default: sandbox root)." },
        maxDepth: {
          type: "integer",
          description: "Max recursion depth (default 2). Depth 0 shows only the top-level entries; depth 2 is usually enough to see module structure."
        },
        include_deps: {
          type: "boolean",
          description: "When true, also traverse node_modules / .git / dist / build / etc. Off by default \u2014 most exploration questions are about the user's own code."
        }
      }
    },
    fn: async (args) => {
      const startAbs = safePath(args.path ?? ".");
      const maxDepth = typeof args.maxDepth === "number" ? args.maxDepth : 2;
      const includeDeps = args.include_deps === true;
      const lines = [];
      let totalBytes = 0;
      let truncated = false;
      const PER_DIR_CHILD_CAP = 50;
      const walk2 = async (dir, depth) => {
        if (truncated) return;
        if (depth > maxDepth) return;
        let entries;
        try {
          entries = await fs4.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        entries.sort((a, b) => a.name.localeCompare(b.name));
        let emitted = 0;
        for (const e of entries) {
          if (truncated) return;
          const skip = e.isDirectory() && !includeDeps && SKIP_DIR_NAMES.has(e.name);
          if (emitted >= PER_DIR_CHILD_CAP) {
            const remaining = entries.length - emitted;
            let restFiles = 0;
            let restDirs = 0;
            for (const r of entries.slice(emitted)) {
              if (r.isDirectory()) restDirs++;
              else restFiles++;
            }
            const indent2 = "  ".repeat(depth);
            lines.push(
              `${indent2}[\u2026 ${remaining} entries hidden (${restDirs} dirs, ${restFiles} files) \u2014 list_directory on this path to see all]`
            );
            return;
          }
          const indent = "  ".repeat(depth);
          const suffix = skip ? " (skipped \u2014 pass include_deps:true to traverse)" : "";
          const line = e.isDirectory() ? `${indent}${e.name}/${suffix}` : `${indent}${e.name}`;
          totalBytes += line.length + 1;
          if (totalBytes > maxListBytes) {
            lines.push(`  [\u2026 tree truncated at ${maxListBytes} bytes \u2026]`);
            truncated = true;
            return;
          }
          lines.push(line);
          emitted++;
          if (e.isDirectory() && !skip) {
            await walk2(pathMod4.join(dir, e.name), depth + 1);
          }
        }
      };
      await walk2(startAbs, 0);
      return lines.join("\n") || "(empty tree)";
    }
  });
  registry.register({
    name: "search_files",
    parallelSafe: true,
    description: "Find files whose NAME matches a substring or regex. Case-insensitive. Walks the directory recursively under the sandbox root. Returns one path per line. Skips dependency / VCS / build directories (node_modules, .git, dist, build, .next, target, .venv) by default.",
    readOnly: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory to start the search at (default: root)." },
        pattern: {
          type: "string",
          description: "Substring (or regex) to match against filenames."
        },
        include_deps: {
          type: "boolean",
          description: "When true, also walk node_modules / .git / dist / build / etc. Off by default \u2014 most filename searches are about the user's own code."
        }
      },
      required: ["pattern"]
    },
    fn: async (args, toolCtx) => searchFiles(
      { rootDir, maxListBytes, skipDirNames: SKIP_DIR_NAMES },
      safePath(args.path ?? "."),
      { ...args, signal: toolCtx?.signal }
    )
  });
  registry.register({
    name: "search_content",
    parallelSafe: true,
    description: "Recursively grep file CONTENTS for a substring or regex. This is the right tool for 'find all places that call X', 'where is Y referenced', 'what files contain Z'. Different from search_files (which matches FILE NAMES). Returns one match per line in 'path:line: text' format. Per-file hits are capped at 30 (a footer reports any extras); when the byte budget is mostly spent the remaining files switch to a 'rel: N matches' histogram so distribution stays visible instead of one popular file drowning the rest. Pass `summary_only:true` to skip line content entirely and get just the histogram. Skips dependency / VCS / build directories (node_modules, .git, dist, build, .next, target, .venv) and binary files by default.",
    readOnly: true,
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Substring (or regex) to search file contents for."
        },
        path: {
          type: "string",
          description: "Directory to start the search at (default: sandbox root)."
        },
        glob: {
          type: "string",
          description: "Optional filename filter. Real glob when the value contains `*`, `?`, `{`, or `[` \u2014 e.g. '*.ts', '**/*.tsx', 'src/**/*.{ts,tsx}'. Plain substring otherwise \u2014 e.g. '.ts' (suffix), 'test' (anywhere in the name). Patterns containing `/` match against the path relative to the search root; otherwise just the basename."
        },
        case_sensitive: {
          type: "boolean",
          description: "When true, match case exactly. Default false (case-insensitive)."
        },
        include_deps: {
          type: "boolean",
          description: "When true, also search inside node_modules / .git / dist / build / etc. Off by default \u2014 most exploration questions are about the user's own code."
        },
        context: {
          type: "integer",
          description: "Lines of context to show around each match (both before and after). Default 0 (just the matching line). Capped at 20. Output uses ripgrep style: `:` after the line number on the matching line, `-` on context lines, `--` separating non-adjacent windows."
        },
        summary_only: {
          type: "boolean",
          description: "When true, skip line content and return one 'rel: N matches' line per matching file. Use for 'where does this exist at all' questions before drilling in with a targeted read_file."
        }
      },
      required: ["pattern"]
    },
    fn: async (args, toolCtx) => searchContent(
      {
        rootDir,
        maxListBytes,
        skipDirNames: SKIP_DIR_NAMES,
        isBinaryByName: isLikelyBinaryByName,
        nameMatch: compileNameFilter(typeof args.glob === "string" ? args.glob : null)
      },
      safePath(args.path ?? "."),
      { ...args, signal: toolCtx?.signal }
    )
  });
  registry.register({
    name: "glob",
    parallelSafe: true,
    description: "List files matching a glob pattern, sorted by mtime (most-recently-modified first) by default. Use this for 'what changed lately', 'find all *.test.ts', 'all configs under src/'. Glob syntax matches the cross-tool standard: `*` (any chars in one segment), `**` (any segments), `?` (one char), `{a,b}` (alternation). Pattern matches against the path RELATIVE to the search root (e.g. 'src/**/*.ts' from project root). Skips node_modules / .git / dist / build / etc by default. Default limit 200; raise via `limit` (max 1000). Different from `search_files` (substring on basename) and `search_content` (matches inside file contents).",
    readOnly: true,
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern, e.g. 'src/**/*.ts', '**/*.{md,mdx}', 'tests/*.test.ts'."
        },
        path: {
          type: "string",
          description: "Base directory to walk (default: sandbox root). The pattern matches relative to this path."
        },
        sort_by: {
          type: "string",
          enum: ["mtime", "name"],
          description: "Sort order. 'mtime' (default) shows most-recently-modified first \u2014 useful for 'what did I change today'. 'name' is alphabetical."
        },
        include_deps: {
          type: "boolean",
          description: "When true, also walk node_modules / .git / dist / build / etc. Off by default."
        },
        limit: {
          type: "integer",
          description: "Cap on returned matches. Default 200; clamped to [1, 1000]."
        }
      },
      required: ["pattern"]
    },
    fn: async (args, toolCtx) => globFiles({ rootDir, skipDirNames: SKIP_DIR_NAMES }, safePath(args.path ?? "."), {
      ...args,
      signal: toolCtx?.signal
    })
  });
  registry.register({
    name: "get_file_info",
    parallelSafe: true,
    description: "Stat a path under the sandbox root. Returns type (file|directory|symlink), size in bytes, mtime in ISO-8601.",
    readOnly: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" }
      },
      required: ["path"]
    },
    fn: async (args) => {
      const abs = safePath(args.path);
      const st = await fs4.lstat(abs);
      const type = st.isDirectory() ? "directory" : st.isSymbolicLink() ? "symlink" : "file";
      return JSON.stringify({
        type,
        size: st.size,
        mtime: st.mtime.toISOString()
      });
    }
  });
  if (!allowWriting) return registry;
  registry.register({
    name: "write_file",
    description: "Create or overwrite a file under the sandbox root with the given content. Parent directories are created as needed.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" }
      },
      required: ["path", "content"]
    },
    fn: async (args) => {
      const abs = safePath(args.path);
      await fs4.mkdir(pathMod4.dirname(abs), { recursive: true });
      await fs4.writeFile(abs, args.content, "utf8");
      return `wrote ${args.content.length} chars to ${displayRel4(rootDir, abs)}`;
    }
  });
  registry.register({
    name: "edit_file",
    description: "Apply a SEARCH/REPLACE edit to an existing file. `search` must match exactly (whitespace sensitive) \u2014 no regex. The match must be unique in the file; otherwise the edit is refused to avoid surprise rewrites.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        search: { type: "string", description: "Exact text to find (must be unique)." },
        replace: { type: "string", description: "Text to substitute in place of `search`." }
      },
      required: ["path", "search", "replace"]
    },
    fn: async (args) => applyEdit(rootDir, safePath(args.path), args)
  });
  registry.register({
    name: "multi_edit",
    description: "Apply N SEARCH/REPLACE edits across ONE OR MORE files in a single atomic call. Edits run sequentially in array order; for edits that touch the same file, a later edit can match text inserted by an earlier one. If ANY edit fails (search not found, ambiguous match, empty search, file unreadable), NO files are written \u2014 atomic at the validation layer. Same per-edit rules as edit_file: `search` is exact text (whitespace sensitive, no regex) and must be unique in its target file at the moment that edit applies. Use this for renames spanning multiple files, cross-file refactors, or any batch where you'd otherwise loop edit_file.",
    parameters: {
      type: "object",
      properties: {
        edits: {
          type: "array",
          description: "Edits to apply in order. Length \u2265 1. Each edit names its own target file.",
          items: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "File the edit targets (sandbox-relative or absolute)."
              },
              search: {
                type: "string",
                description: "Exact text to find (must be unique in the file)."
              },
              replace: { type: "string", description: "Text to substitute in place of `search`." }
            },
            required: ["path", "search", "replace"]
          }
        }
      },
      required: ["edits"]
    },
    fn: async (args) => {
      const resolved = (args.edits ?? []).map((e) => ({
        abs: safePath(e?.path),
        search: e?.search,
        replace: e?.replace
      }));
      return applyMultiEdit(rootDir, resolved);
    }
  });
  registry.register({
    name: "create_directory",
    description: "Create a directory (and any missing parents) under the sandbox root.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"]
    },
    fn: async (args) => {
      const abs = safePath(args.path);
      await fs4.mkdir(abs, { recursive: true });
      return `created ${displayRel4(rootDir, abs)}/`;
    }
  });
  registry.register({
    name: "move_file",
    description: "Rename/move a file or directory under the sandbox root.",
    parameters: {
      type: "object",
      properties: {
        source: { type: "string" },
        destination: { type: "string" }
      },
      required: ["source", "destination"]
    },
    fn: async (args) => {
      const src = safePath(args.source);
      const dst = safePath(args.destination);
      await fs4.mkdir(pathMod4.dirname(dst), { recursive: true });
      await fs4.rename(src, dst);
      return `moved ${displayRel4(rootDir, src)} \u2192 ${displayRel4(rootDir, dst)}`;
    }
  });
  registry.register({
    name: "delete_file",
    description: "Delete one file under the sandbox root. Refuses directories \u2014 use delete_directory for those. Errors if the path doesn't exist.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"]
    },
    fn: async (args) => {
      const abs = safePath(args.path);
      const st = await fs4.lstat(abs);
      if (st.isDirectory()) {
        throw new Error(
          `delete_file: ${args.path} is a directory \u2014 use delete_directory to remove it`
        );
      }
      await fs4.unlink(abs);
      return `deleted ${displayRel4(rootDir, abs)}`;
    }
  });
  registry.register({
    name: "delete_directory",
    description: "Recursively delete a directory under the sandbox root. Pass `recursive:false` to refuse non-empty directories. Errors if the path doesn't exist.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        recursive: {
          type: "boolean",
          description: "When true (default) deletes the directory and all its contents. When false, only removes empty directories \u2014 non-empty refuses with an error."
        }
      },
      required: ["path"]
    },
    fn: async (args) => {
      const abs = safePath(args.path);
      const st = await fs4.lstat(abs);
      if (!st.isDirectory()) {
        throw new Error(`delete_directory: ${args.path} is a file \u2014 use delete_file to remove it`);
      }
      const recursive = args.recursive !== false;
      if (recursive) {
        await fs4.rm(abs, { recursive: true, force: false });
      } else {
        await fs4.rmdir(abs);
      }
      return `deleted ${displayRel4(rootDir, abs)}/${recursive ? " (recursive)" : ""}`;
    }
  });
  registry.register({
    name: "copy_file",
    description: "Copy a file or directory under the sandbox root. Both source and destination resolve under the sandbox. Parent directories of the destination are created as needed. Refuses to overwrite an existing destination \u2014 delete it first if you want to replace it.",
    parameters: {
      type: "object",
      properties: {
        source: { type: "string" },
        destination: { type: "string" }
      },
      required: ["source", "destination"]
    },
    fn: async (args) => {
      const src = safePath(args.source);
      const dst = safePath(args.destination);
      await fs4.mkdir(pathMod4.dirname(dst), { recursive: true });
      await fs4.cp(src, dst, { recursive: true, force: false, errorOnExist: true });
      return `copied ${displayRel4(rootDir, src)} \u2192 ${displayRel4(rootDir, dst)}`;
    }
  });
  return registry;
}

// src/tools/memory.ts
function registerMemoryTools(registry, opts = {}) {
  const store = new MemoryStore({ homeDir: opts.homeDir, projectRoot: opts.projectRoot });
  const hasProject = store.hasProjectScope();
  registry.register({
    name: "remember",
    description: "Save a memory for future sessions. Use when the user states a preference, corrects your approach, shares a non-obvious fact about this project, or explicitly asks you to remember something. Don't remember transient task state \u2014 only things worth recalling next session. The memory is written now but won't re-load into the system prompt until the next `/new` or launch.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["user", "feedback", "project", "reference"],
          description: "'user' = role/skills/prefs; 'feedback' = corrections or confirmed approaches; 'project' = facts/decisions about the current work; 'reference' = pointers to external systems the user uses."
        },
        scope: {
          type: "string",
          enum: ["global", "project"],
          description: "'global' = applies across every project (preferences, tooling); 'project' = scoped to the current sandbox (decisions, local facts). Only available in `reasonix code`."
        },
        name: {
          type: "string",
          description: "filename-safe identifier, 3-40 chars, alnum + _ - . (no path separators, no leading dot)."
        },
        description: {
          type: "string",
          description: "One-line summary shown in MEMORY.md (under ~150 chars)."
        },
        content: {
          type: "string",
          description: "Full memory body in markdown. For feedback/project types, structure as: rule/fact, then **Why:** line, then **How to apply:** line."
        }
      },
      required: ["type", "scope", "name", "description", "content"]
    },
    fn: async (args) => {
      if (args.scope === "project" && !hasProject) {
        return JSON.stringify({
          error: "scope='project' is unavailable in this session (no sandbox root). Retry with scope='global', or ask the user to switch to `reasonix code` for project-scoped memory."
        });
      }
      try {
        const path = store.write({
          name: args.name,
          type: args.type,
          scope: args.scope,
          description: args.description,
          body: args.content
        });
        const key = sanitizeMemoryName(args.name);
        return [
          `\u2713 REMEMBERED (${args.scope}/${key}): ${args.description}`,
          "",
          "TREAT THIS AS ESTABLISHED FACT for the rest of this session.",
          "The user just told you \u2014 don't re-explore the filesystem to re-derive it.",
          `(Saved to ${path}; pins into the system prompt on next /new or launch.)`
        ].join("\n");
      } catch (err) {
        return JSON.stringify({ error: `remember failed: ${err.message}` });
      }
    }
  });
  registry.register({
    name: "forget",
    description: "Delete a memory file and remove it from MEMORY.md. Use when the user explicitly asks to forget something, or when a previously-remembered fact has become wrong. Irreversible \u2014 no tombstone.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Memory name (the identifier used in `remember`)." },
        scope: { type: "string", enum: ["global", "project"] }
      },
      required: ["name", "scope"]
    },
    fn: async (args) => {
      if (args.scope === "project" && !hasProject) {
        return JSON.stringify({
          error: "scope='project' is unavailable in this session (no sandbox root)."
        });
      }
      try {
        const existed = store.delete(args.scope, args.name);
        return existed ? `forgot (${args.scope}/${sanitizeMemoryName(args.name)}). Re-load on next /new or launch.` : `no such memory: ${args.scope}/${args.name} (nothing to forget).`;
      } catch (err) {
        return JSON.stringify({ error: `forget failed: ${err.message}` });
      }
    }
  });
  registry.register({
    name: "recall_memory",
    description: "Read the full body of a memory file when its MEMORY.md one-liner (already in the system prompt) isn't enough detail. Most of the time the index suffices \u2014 only call this when the user's question genuinely requires the full context.",
    readOnly: true,
    parallelSafe: true,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        scope: { type: "string", enum: ["global", "project"] }
      },
      required: ["name", "scope"]
    },
    fn: async (args) => {
      if (args.scope === "project" && !hasProject) {
        return JSON.stringify({
          error: "scope='project' is unavailable in this session (no sandbox root)."
        });
      }
      try {
        const entry = store.read(args.scope, args.name);
        return [
          `# ${entry.name}  (${entry.scope}/${entry.type}, created ${entry.createdAt || "?"})`,
          entry.description ? `> ${entry.description}` : "",
          "",
          entry.body
        ].filter(Boolean).join("\n");
      } catch (err) {
        return JSON.stringify({ error: `recall failed: ${err.message}` });
      }
    }
  });
  return registry;
}

// src/tools/choice.ts
function sanitizeOptions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry;
    const id = typeof e.id === "string" ? e.id.trim() : "";
    const title = typeof e.title === "string" ? e.title.trim() : "";
    if (!id || !title) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const summary = typeof e.summary === "string" ? e.summary.trim() || void 0 : void 0;
    const opt = { id, title };
    if (summary) opt.summary = summary;
    out.push(opt);
  }
  return out;
}
function registerChoiceTool(registry, opts = {}) {
  registry.register({
    name: "ask_choice",
    description: "Present 2\u20136 alternatives to the user. The principle: if the user is supposed to pick, the tool picks \u2014 you don't enumerate the choices as prose. Prose menus have no picker in this TUI, so the user gets a wall of text to scroll through and a letter to type, strictly worse than the magenta picker this tool renders. Call it whenever (a) the user has asked for options, (b) you've analyzed multiple approaches and the final call is theirs, or (c) it's a preference fork you can't resolve without them. Skip it when one option is clearly best (just do it, or submit_plan) or a free-form text answer fits (ask in prose). Keep option ids short and stable (A/B/C). Each option: title + optional summary. allowCustom=true when their real answer might not fit. Max 6 options \u2014 narrow first if more. A one-sentence lead-in before the call is fine; don't repeat the options in it.",
    readOnly: true,
    parameters: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The question to put in front of the user. One sentence. Don't repeat the options in the question text \u2014 the picker renders them separately."
        },
        options: {
          type: "array",
          description: "2\u20134 alternatives. Each needs a stable id and a short title; summary is optional.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Short stable id (A, B, C, or option-1)." },
              title: { type: "string", description: "One-line title shown as the option label." },
              summary: {
                type: "string",
                description: "Optional. A second dimmed line with more detail. Keep under ~80 chars."
              }
            },
            required: ["id", "title"]
          }
        },
        allowCustom: {
          type: "boolean",
          description: "If true, the picker shows a 'Let me type my own answer' escape hatch. Default false. Turn on when the user's real answer might not fit any of your pre-defined options."
        }
      },
      required: ["question", "options"]
    },
    fn: async (args, ctx) => {
      const question = (args?.question ?? "").trim();
      if (!question) {
        throw new Error(
          "ask_choice: question is required \u2014 write one sentence explaining the decision."
        );
      }
      const options = sanitizeOptions(args?.options);
      if (options.length < 2) {
        throw new Error(
          "ask_choice: need at least 2 well-formed options (each with a non-empty id and title). If you just need a text answer, ask the user in plain assistant text instead."
        );
      }
      if (options.length > 6) {
        throw new Error(
          "ask_choice: too many options (max 6). If you really have this many branches, split into two sequential ask_choice calls or narrow down first."
        );
      }
      const allowCustom = args?.allowCustom === true;
      opts.onChoiceRequested?.(question, options);
      const verdict = await (ctx?.confirmationGate ?? pauseGate).ask({
        kind: "choice",
        payload: { question, options, allowCustom }
      });
      if (verdict.type === "pick") return `user picked: ${verdict.optionId}`;
      if (verdict.type === "text") return `user answered: ${verdict.text}`;
      return "user cancelled the choice";
    }
  });
  return registry;
}

// src/tools/plan-core.ts
var SUBMIT_PLAN_DESCRIPTION = "Submit ONE concrete plan you've already decided on. Use this for tasks that warrant a review gate \u2014 multi-file refactors, architecture changes, anything that would be expensive or confusing to undo. Skip it for small fixes (one-line typo, obvious bug with a clear fix) \u2014 just make the change. The user will either approve (you then implement it), ask for refinement, or cancel. If the user has already enabled /plan mode, writes are blocked at dispatch and you MUST use this. CRITICAL: do NOT use submit_plan to present alternative routes (A/B/C, option 1/2/3) for the user to pick from \u2014 the picker only exposes approve/refine/cancel, so a menu plan strands the user with no way to choose. For branching decisions, call `ask_choice` instead; only call submit_plan once the user has picked a direction and you have a single actionable plan. Write the plan as markdown with a one-line summary, a bulleted list of files to touch and what will change, and any risks or open questions. STRONGLY PREFERRED: pass `steps` \u2014 an array of {id, title, action, risk?} \u2014 so the UI renders a structured step list above the approval picker and tracks per-step progress. Use risk='high' for steps that touch prod data / break public APIs / are hard to undo; 'med' for non-trivial but reversible (multi-file edits, schema tweaks); 'low' for safe local work. After each step, call `mark_step_complete` so the user sees progress ticks.";
var MARK_STEP_COMPLETE_DESCRIPTION = "Mark one step of the approved plan as done. MANDATORY: call this exactly once after finishing each step, before starting the next one \u2014 skipping it leaves the user staring at `0/N done` on the resume banner even when the work is finished, and they have no way to know which steps actually ran. The TUI updates the plan card's progress in place; the count is persisted to disk so it survives session resume. After the FINAL step, write a brief reply summarizing what was done and end the turn. Pass the `stepId` from the plan's steps array, a short `result` (what you did), and optional `notes` for anything surprising (errors, scope changes, follow-ups). This tool doesn't change any files. Don't call it if the plan didn't include structured steps, and don't invent ids that weren't in the original plan. If you only realized at the end that you skipped marking steps, mark them then \u2014 late is still better than never.";
var REVISE_PLAN_DESCRIPTION = "Surgically replace the REMAINING steps of an in-flight plan. Call this when the user has given feedback at a checkpoint that warrants a structured plan change \u2014 skip a step, swap two steps, add a new step, change risk, etc. Pass: `reason` (one sentence why), `remainingSteps` (the new tail of the plan, replacing whatever steps haven't been done yet), and optional `summary` (updated one-line plan summary). Done steps are NEVER touched \u2014 keep them out of `remainingSteps`. The TUI shows a diff (removed in red, kept in gray, added in green) and the user accepts or rejects. Don't call this for trivial mid-step adjustments \u2014 just keep executing. Don't call submit_plan for revisions either \u2014 that resets the whole plan including completed steps. Use submit_plan only when the entire approach has changed; use revise_plan when the tail needs editing.";
var STEP_ITEM_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", description: "Stable id, e.g. step-1." },
    title: { type: "string", description: "Short imperative title." },
    action: { type: "string", description: "One-sentence description of the concrete action." },
    risk: {
      type: "string",
      enum: ["low", "med", "high"],
      description: "Self-assessed risk. 'high' = hard-to-undo / touches prod / breaks API; 'med' = non-trivial but reversible; 'low' = safe local work. The UI shows a colored dot per step so the user knows where to focus review. Omit if you're unsure."
    }
  },
  required: ["id", "title", "action"]
};
function sanitizeRisk(raw) {
  if (raw === "low" || raw === "med" || raw === "high") return raw;
  return void 0;
}
function sanitizeSteps(raw) {
  if (!Array.isArray(raw)) return void 0;
  const steps = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry;
    const id = typeof e.id === "string" ? e.id.trim() : "";
    const title = typeof e.title === "string" ? e.title.trim() : "";
    const action = typeof e.action === "string" ? e.action.trim() : "";
    if (!id || !title || !action) continue;
    const step = { id, title, action };
    const risk = sanitizeRisk(e.risk);
    if (risk) step.risk = risk;
    steps.push(step);
  }
  return steps.length > 0 ? steps : void 0;
}
function registerSubmitPlan(registry, opts) {
  registry.register({
    name: "submit_plan",
    description: SUBMIT_PLAN_DESCRIPTION,
    readOnly: true,
    parameters: {
      type: "object",
      properties: {
        plan: {
          type: "string",
          description: "Markdown-formatted plan. Lead with a one-sentence summary. Then a file-by-file breakdown of what you'll change and why. Flag any risks or open questions at the end so the user can weigh in before you start."
        },
        steps: {
          type: "array",
          description: "Structured step list (strongly recommended). When provided, the UI renders a compact step list above the approval picker AND tracks per-step progress via `mark_step_complete`. Use stable ids (step-1, step-2, ...). Skip only for tiny one-step plans where the markdown body is enough.",
          items: STEP_ITEM_SCHEMA
        },
        summary: {
          type: "string",
          description: "Optional. One-sentence human-friendly title for the plan, ~80 chars max. Surfaces in the PlanConfirm picker header and in /plans listings ('\u25B8 refactor auth into signed tokens \xB7 2/5 done'). Skip for trivial plans where the first line of the markdown body is already short and clear."
        }
      },
      required: ["plan"]
    },
    fn: async (args, ctx) => {
      const plan = (args?.plan ?? "").trim();
      if (!plan) {
        throw new Error("submit_plan: empty plan \u2014 write a markdown plan and try again.");
      }
      const steps = sanitizeSteps(args?.steps);
      const summary = typeof args?.summary === "string" ? args.summary.trim() || void 0 : void 0;
      opts.onPlanSubmitted?.(plan, steps);
      const verdict = await (ctx?.confirmationGate ?? pauseGate).ask({
        kind: "plan_proposed",
        payload: { plan, steps, summary }
      });
      const fb = verdict.feedback?.trim();
      if (verdict.type === "approve") {
        return fb ? `plan approved. user's additional instructions: ${fb}` : "plan approved";
      }
      if (verdict.type === "refine") {
        throw new Error(fb ? `user requested refinement: ${fb}` : "user requested refinement");
      }
      throw new Error(fb ? `plan cancelled: ${fb}` : "plan cancelled");
    }
  });
}
function registerMarkStepComplete(registry, opts) {
  registry.register({
    name: "mark_step_complete",
    description: MARK_STEP_COMPLETE_DESCRIPTION,
    readOnly: true,
    parameters: {
      type: "object",
      properties: {
        stepId: {
          type: "string",
          description: "The id of the step being marked complete. Must match one from submit_plan's steps array."
        },
        title: {
          type: "string",
          description: "Optional. The step's title, echoed back for the UI. If omitted, the UI falls back to the id."
        },
        result: {
          type: "string",
          description: "One-sentence summary of what was done for this step."
        },
        notes: {
          type: "string",
          description: "Optional. Anything surprising \u2014 blockers hit, assumptions revised, follow-ups for later steps."
        }
      },
      required: ["stepId", "result"]
    },
    fn: async (args, ctx) => {
      const stepId = (args?.stepId ?? "").trim();
      const result = (args?.result ?? "").trim();
      if (!stepId) {
        throw new Error("mark_step_complete: stepId is required.");
      }
      if (!result) {
        throw new Error(
          "mark_step_complete: result is required \u2014 say in one sentence what you did."
        );
      }
      const title = typeof args?.title === "string" ? args.title.trim() || void 0 : void 0;
      const notes = typeof args?.notes === "string" ? args.notes.trim() || void 0 : void 0;
      const update = { kind: "step_completed", stepId, result };
      if (title) update.title = title;
      if (notes) update.notes = notes;
      opts.onStepCompleted?.(update);
      const verdict = await (ctx?.confirmationGate ?? pauseGate).ask({
        kind: "plan_checkpoint",
        payload: { stepId, title, result, notes }
      });
      if (verdict.type === "continue") return JSON.stringify(update);
      if (verdict.type === "revise") {
        if (verdict.feedback) return `revision requested: ${verdict.feedback}`;
        throw new Error("user requested revision at checkpoint");
      }
      throw new Error("user stopped at checkpoint");
    }
  });
}
function registerRevisePlan(registry, opts) {
  registry.register({
    name: "revise_plan",
    description: REVISE_PLAN_DESCRIPTION,
    readOnly: true,
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "One sentence explaining why you're revising \u2014 what the user asked for, what changed your assessment."
        },
        remainingSteps: {
          type: "array",
          description: "The new tail of the plan \u2014 what should run from here on. Each entry: {id, title, action, risk?}. Use stable ids; reuse old ids when a step is just being adjusted, generate new ones for genuinely new steps.",
          items: STEP_ITEM_SCHEMA
        },
        summary: {
          type: "string",
          description: "Optional. Updated one-line plan summary if the overall framing has shifted."
        }
      },
      required: ["reason", "remainingSteps"]
    },
    fn: async (args, ctx) => {
      const reason = (args?.reason ?? "").trim();
      if (!reason) {
        throw new Error(
          "revise_plan: reason is required \u2014 write one sentence explaining the change."
        );
      }
      const remainingSteps = sanitizeSteps(args?.remainingSteps);
      if (!remainingSteps || remainingSteps.length === 0) {
        throw new Error(
          "revise_plan: remainingSteps must be a non-empty array of well-formed steps. If the user wants to STOP rather than continue, don't revise \u2014 the picker has its own Stop option."
        );
      }
      const summary = typeof args?.summary === "string" ? args.summary.trim() || void 0 : void 0;
      opts.onPlanRevisionProposed?.(reason, remainingSteps, summary);
      const verdict = await (ctx?.confirmationGate ?? pauseGate).ask({
        kind: "plan_revision",
        payload: { reason, remainingSteps, summary }
      });
      if (verdict.type === "accepted") return "revision accepted";
      if (verdict.type === "rejected") throw new Error("revision rejected");
      throw new Error("revision cancelled");
    }
  });
}
function registerPlanTool(registry, opts = {}) {
  registerSubmitPlan(registry, opts);
  registerMarkStepComplete(registry, opts);
  registerRevisePlan(registry, opts);
  return registry;
}

// src/tools/todo.ts
var DESCRIPTION = 'In-session task tracker for multi-step work. NOT a plan \u2014 no approval gate, no checkpoint pauses, doesn\'t touch any files. The tool replaces the entire todo list every call (set semantics, NOT append). Pass the FULL list every time.\n\nWhen to use:\n\u2022 The task has 3+ distinct steps and you want to keep them straight as you work.\n\u2022 The user gave you a multi-part request ("do A, then B, then C").\n\u2022 You\'re partway through a long task and want to record where you are so a future you doesn\'t lose the thread.\n\nWhen NOT to use:\n\u2022 One-shot edits, single-question answers, single-tool tasks.\n\u2022 User-facing approval gates \u2192 that\'s `submit_plan`.\n\u2022 Branching choices \u2192 that\'s `ask_choice`.\n\nRules:\n\u2022 Exactly ONE todo may have status:"in_progress" at a time (or zero \u2014 between steps).\n\u2022 Mark a todo "completed" the moment it\'s actually done \u2014 don\'t batch.\n\u2022 Each todo: `content` (imperative, e.g. "Add tests"), `activeForm` (gerund shown while running, e.g. "Adding tests"), `status`.\n\u2022 Empty `todos:[]` is allowed \u2014 it clears the list when work is fully done.';
function validateTodos(raw) {
  if (!Array.isArray(raw)) {
    throw new Error("todo_write: `todos` must be an array");
  }
  const out = [];
  let inProgressCount = 0;
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") {
      throw new Error(`todo_write: todo #${i + 1} must be an object`);
    }
    const e = entry;
    const content = typeof e.content === "string" ? e.content.trim() : "";
    const activeForm = typeof e.activeForm === "string" ? e.activeForm.trim() : "";
    const status = e.status;
    if (!content) {
      throw new Error(`todo_write: todo #${i + 1} \`content\` must be a non-empty string`);
    }
    if (!activeForm) {
      throw new Error(`todo_write: todo #${i + 1} \`activeForm\` must be a non-empty string`);
    }
    if (status !== "pending" && status !== "in_progress" && status !== "completed") {
      throw new Error(
        `todo_write: todo #${i + 1} \`status\` must be one of pending|in_progress|completed (got ${JSON.stringify(status)})`
      );
    }
    if (status === "in_progress") {
      inProgressCount++;
      if (inProgressCount > 1) {
        throw new Error(
          "todo_write: at most one todo may be in_progress at a time \u2014 mark the previous one completed first"
        );
      }
    }
    out.push({ content, status, activeForm });
  }
  return out;
}
function renderTodos(todos) {
  if (todos.length === 0) return "todos cleared (0 items)";
  let done = 0;
  let inProgress = 0;
  let pending = 0;
  for (const t2 of todos) {
    if (t2.status === "completed") done++;
    else if (t2.status === "in_progress") inProgress++;
    else pending++;
  }
  const header = `todos updated \xB7 ${done} done \xB7 ${inProgress} in progress \xB7 ${pending} pending`;
  const lines = todos.map((t2) => {
    if (t2.status === "completed") return `[x] ${t2.content}`;
    if (t2.status === "in_progress") return `[>] ${t2.activeForm}`;
    return `[ ] ${t2.content}`;
  });
  return `${header}
${lines.join("\n")}`;
}
function registerTodoTool(registry, opts = {}) {
  registry.register({
    name: "todo_write",
    description: DESCRIPTION,
    readOnly: true,
    parameters: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          description: "The COMPLETE new todo list. Replaces whatever was there before. Pass [] to clear.",
          items: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: 'Imperative step description, e.g. "Add tests for parser".'
              },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "completed"],
                description: "Current state. Exactly one item may be in_progress."
              },
              activeForm: {
                type: "string",
                description: 'Gerund form shown while in_progress, e.g. "Adding tests for parser".'
              }
            },
            required: ["content", "status", "activeForm"]
          }
        }
      },
      required: ["todos"]
    },
    fn: async (args) => {
      const todos = validateTodos(args?.todos);
      opts.onTodosUpdated?.(todos);
      return renderTodos(todos);
    }
  });
  return registry;
}

// src/tools/web.ts
import { parse as parseHtml } from "node-html-parser";
var DEFAULT_FETCH_MAX_CHARS = 32e3;
var DEFAULT_FETCH_TIMEOUT_MS = 15e3;
var DEFAULT_TOPK = 5;
var FETCH_MAX_BYTES = 10 * 1024 * 1024;
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var MOJEEK_ENDPOINT = "https://www.mojeek.com/search";
function searchStatusError(status) {
  if (status === 429) return t("webErrors.rateLimit429");
  if (status === 403) return t("webErrors.forbidden403");
  return t("webErrors.status", { status });
}
function fetchStatusError(status, url) {
  if (status === 429) return t("webErrors.fetchRateLimit429", { url });
  if (status === 403) return t("webErrors.fetchForbidden403", { url });
  return t("webErrors.fetchStatus", { status, url });
}
async function webSearch(query, opts = {}) {
  if (opts.engine === "searxng") {
    return searchSearxng(query, opts);
  }
  return searchMojeek(query, opts);
}
async function searchMojeek(query, opts = {}) {
  const topK = Math.max(1, Math.min(10, opts.topK ?? DEFAULT_TOPK));
  const resp = await fetch(`${MOJEEK_ENDPOINT}?q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      "Accept-Language": "en-US,en;q=0.9"
    },
    signal: opts.signal,
    redirect: "follow"
  });
  if (!resp.ok) throw new Error(searchStatusError(resp.status));
  const html = await resp.text();
  const results = parseMojeekResults(html).slice(0, topK);
  if (results.length === 0) {
    if (/no results found|did not match any documents/i.test(html)) return [];
    if (/captcha|verify you are human|access denied|forbidden/i.test(html)) {
      throw new Error(t("webErrors.mojeekBlocked"));
    }
    throw new Error(
      t("webErrors.mojeekNoResults", {
        chars: html.length,
        preview: html.slice(0, 120).replace(/\s+/g, " ")
      })
    );
  }
  return results;
}
function normalizeSearxngEndpoint(raw) {
  let url;
  try {
    url = new URL(raw.includes("://") ? raw : `http://${raw}`);
  } catch {
    throw new Error(t("webErrors.invalidEndpoint", { endpoint: raw }));
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(t("webErrors.endpointMustBeHttp", { protocol: url.protocol }));
  }
  return url.origin;
}
async function searchSearxng(query, opts = {}) {
  const topK = Math.max(1, Math.min(10, opts.topK ?? DEFAULT_TOPK));
  const baseUrl = normalizeSearxngEndpoint(opts.endpoint ?? "http://localhost:8080");
  const url = `${baseUrl}/search?format=html&q=${encodeURIComponent(query)}`;
  let resp;
  try {
    resp = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html"
      },
      signal: opts.signal
    });
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error(
        t("webErrors.cannotReach", { endpoint: opts.endpoint ?? "http://localhost:8080" })
      );
    }
    throw err;
  }
  if (!resp.ok) throw new Error(searchStatusError(resp.status));
  const html = await resp.text();
  const results = parseSearxngHtmlResults(html).slice(0, topK);
  if (results.length === 0) {
    if (/no results found|did not match any documents/i.test(html)) return [];
    throw new Error(t("webErrors.searxngNoResults", { chars: html.length }));
  }
  return results;
}
function parseSearxngHtmlResults(html) {
  const root = parseHtml(html);
  const results = [];
  const articles = root.querySelectorAll("article.result, div.result");
  if (articles.length > 0) {
    for (const article of articles) {
      const link = article.querySelector("h3 a, h4 a, a[href^='http']");
      if (!link) continue;
      const href = link.getAttribute("href");
      if (!href) continue;
      const title = link.textContent.trim();
      if (!title) continue;
      let snippet = "";
      for (const p of article.querySelectorAll("p")) {
        const text = p.textContent.trim();
        if (text.length > 10 && !text.includes(title)) {
          snippet = text;
          break;
        }
      }
      if (!snippet) {
        const cs = article.querySelector(".content, .result-content, [class*='snippet']");
        if (cs) snippet = cs.textContent.trim();
      }
      results.push({ title, url: href, snippet });
    }
    return results;
  }
  for (const a of root.querySelectorAll("h3 a[href]")) {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#")) continue;
    const title = a.textContent.trim();
    if (!title) continue;
    let snippet = "";
    const p = a.parentNode?.parentNode?.querySelector("p");
    if (p) snippet = p.textContent.trim();
    results.push({ title, url: href, snippet });
  }
  return results;
}
function parseMojeekResults(html) {
  const titles = [];
  const titleAnchorRe = /<a\b[^>]*\bclass="title"[^>]*>[\s\S]*?<\/a>/g;
  let m;
  while (true) {
    m = titleAnchorRe.exec(html);
    if (m === null) break;
    titles.push(m[0]);
  }
  const snippets = [];
  const snippetRe = /<p\b[^>]*\bclass="s"[^>]*>([\s\S]*?)<\/p>/g;
  while (true) {
    m = snippetRe.exec(html);
    if (m === null) break;
    snippets.push(m[1] ?? "");
  }
  const hrefRe = /href="([^"]+)"/;
  const innerRe = /<a\b[^>]*>([\s\S]*?)<\/a>/;
  const results = [];
  for (let i = 0; i < titles.length; i++) {
    const anchor = titles[i];
    const hrefMatch = anchor.match(hrefRe);
    const innerMatch = anchor.match(innerRe);
    if (!hrefMatch?.[1]) continue;
    results.push({
      title: decodeHtmlEntities(stripHtml(innerMatch?.[1] ?? "")).trim(),
      url: hrefMatch[1],
      snippet: decodeHtmlEntities(stripHtml(snippets[i] ?? "")).replace(/\s+/g, " ").trim()
    });
  }
  return results;
}
async function webFetch(url, opts = {}) {
  const maxChars = opts.maxChars ?? DEFAULT_FETCH_MAX_CHARS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, timeoutMs);
  const cancel = () => ctl.abort();
  opts.signal?.addEventListener("abort", cancel, { once: true });
  let resp;
  try {
    resp = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain,*/*" },
      signal: ctl.signal,
      redirect: "follow"
    });
  } catch (err) {
    if (timedOut) {
      throw new Error(t("webErrors.fetchTimeout", { ms: timeoutMs, url }));
    }
    throw err;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", cancel);
  }
  if (!resp.ok) throw new Error(fetchStatusError(resp.status, url));
  const contentType = resp.headers.get("content-type") ?? "";
  const declaredLen = Number(resp.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLen) && declaredLen > FETCH_MAX_BYTES) {
    throw new Error(t("webErrors.fetchTooLarge", { len: declaredLen, cap: FETCH_MAX_BYTES, url }));
  }
  const raw = await readBodyCapped(resp, FETCH_MAX_BYTES);
  const title = extractTitle(raw);
  const text = contentType.includes("text/html") ? htmlToText(raw) : raw;
  const truncated = text.length > maxChars;
  const finalText = truncated ? `${text.slice(0, maxChars)}

[\u2026 truncated ${text.length - maxChars} chars \u2026]` : text;
  return { url, title, text: finalText, truncated };
}
async function readBodyCapped(resp, maxBytes) {
  if (!resp.body) return await resp.text();
  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let total = 0;
  let out = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
        }
        throw new Error(t("webErrors.fetchBodyTooLarge", { cap: maxBytes, seen: total }));
      }
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
  } finally {
    try {
      reader.releaseLock();
    } catch {
    }
  }
  return out;
}
var MAX_HTML_INPUT = 5 * 1024 * 1024;
var STRIP_BLOCK_TAGS = "script, style, noscript, nav, footer, aside, svg";
var BLOCK_BREAK_TAGS = /* @__PURE__ */ new Set([
  "p",
  "div",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "tr",
  "section",
  "article"
]);
function htmlToText(html) {
  const input = html.length > MAX_HTML_INPUT ? html.slice(0, MAX_HTML_INPUT) : html;
  const root = parseHtml(input);
  for (const node of root.querySelectorAll(STRIP_BLOCK_TAGS)) node.remove();
  const out = [];
  walkExtract(root, out);
  let s = out.join("");
  s = decodeHtmlEntities(s);
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n[ \t]+/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
function walkExtract(node, out) {
  if (node.nodeType === 3) {
    out.push(node.rawText ?? node.text ?? "");
    return;
  }
  const tag = node.rawTagName?.toLowerCase();
  const isBreak = tag !== void 0 && BLOCK_BREAK_TAGS.has(tag);
  if (isBreak) out.push("\n");
  for (const child of node.childNodes) walkExtract(child, out);
  if (isBreak) out.push("\n");
}
function stripHtml(s) {
  return parseHtml(s).text;
}
var HTML_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};
function decodeHtmlEntities(s) {
  return s.replace(/&(#\d+|#x[0-9a-fA-F]+|\w+);/g, (raw, name) => {
    if (name.startsWith("#x") || name.startsWith("#X")) {
      const code = Number.parseInt(name.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : raw;
    }
    if (name.startsWith("#")) {
      const code = Number.parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : raw;
    }
    return HTML_ENTITIES[name.toLowerCase()] ?? raw;
  });
}
function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return void 0;
  return m[1].replace(/\s+/g, " ").trim() || void 0;
}
function registerWebTools(registry, opts = {}) {
  const defaultTopK = opts.defaultTopK ?? DEFAULT_TOPK;
  const maxFetchChars = opts.maxFetchChars ?? DEFAULT_FETCH_MAX_CHARS;
  registry.register({
    name: "web_search",
    description: "Search the public web. Returns ranked results with title, url, and snippet. Call this when the answer's correctness depends on current state \u2014 anything that changes over time (events, prices, releases, status of a thing in the real world). Composing such answers from training memory invents stale numbers; search first, then ground the answer in the results. For evergreen / definitional questions you don't need this. To change the backend, use /web-search-engine mojeek|searxng.",
    readOnly: true,
    parallelSafe: true,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language search query." },
        topK: {
          type: "integer",
          description: `Number of results to return (1..10). Default ${defaultTopK}.`
        }
      },
      required: ["query"]
    },
    fn: async (args, ctx) => {
      const engine = opts.webSearchEngine ?? webSearchEngine();
      const endpoint = opts.webSearchEndpoint ?? webSearchEndpoint();
      const results = await webSearch(args.query, {
        topK: args.topK ?? defaultTopK,
        signal: ctx?.signal,
        engine,
        endpoint
      });
      return formatSearchResults(args.query, results);
    }
  });
  registry.register({
    name: "web_fetch",
    description: "Download a URL and return its visible text content (HTML pages get scripts/styles/nav stripped). Truncated at the tool-result cap. Use after web_search when a snippet isn't enough.",
    readOnly: true,
    parallelSafe: true,
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute http:// or https:// URL." }
      },
      required: ["url"]
    },
    fn: async (args, ctx) => {
      if (!/^https?:\/\//i.test(args.url)) {
        throw new Error(t("webErrors.fetchInvalidUrl"));
      }
      const page = await webFetch(args.url, { maxChars: maxFetchChars, signal: ctx?.signal });
      const header = page.title ? `${page.title}
${page.url}` : page.url;
      return `${header}

${page.text}`;
    }
  });
  return registry;
}
function formatSearchResults(query, results) {
  const lines = [`query: ${query}`, `
results (${results.length}):`];
  results.forEach((r, i) => {
    lines.push(`
${i + 1}. ${r.title}`);
    lines.push(`   ${r.url}`);
    if (r.snippet) lines.push(`   ${r.snippet}`);
  });
  return lines.join("\n");
}

// src/at-mentions.ts
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { readdir, stat } from "fs/promises";
import { isAbsolute as isAbsolute2, join as join4, relative as relative5, resolve as resolve2 } from "path";

// src/at-mentions-url.ts
var AT_URL_PATTERN = /(?<=^|\s)@(https?:\/\/\S+)/g;
var DEFAULT_AT_URL_MAX_CHARS = 32e3;
async function expandAtUrls(text, opts = {}) {
  const maxChars = opts.maxChars ?? DEFAULT_AT_URL_MAX_CHARS;
  const fetcher = opts.fetcher;
  if (!fetcher) {
    throw new Error("expandAtUrls: fetcher option is required (wire src/tools/web.ts:webFetch)");
  }
  const seen = /* @__PURE__ */ new Map();
  const bodies = /* @__PURE__ */ new Map();
  const order = [];
  for (const match of text.matchAll(AT_URL_PATTERN)) {
    const rawUrl = match[1] ?? "";
    const url = stripUrlTail(rawUrl);
    if (!url) continue;
    if (seen.has(url)) continue;
    const cached = opts.cache?.get(url);
    if (cached) {
      seen.set(url, cached);
      if (cached.body) bodies.set(url, cached.body);
      order.push(url);
      continue;
    }
    let expansion;
    let body = "";
    try {
      const page = await fetcher(url, {
        maxChars,
        timeoutMs: opts.timeoutMs,
        signal: opts.signal
      });
      body = page.text;
      expansion = {
        token: `@${url}`,
        url,
        ok: true,
        title: page.title,
        chars: body.length,
        truncated: page.truncated
      };
    } catch (err) {
      const message = err.message ?? String(err);
      let skip = "fetch-error";
      if (/aborted|timeout/i.test(message)) skip = "timeout";
      else if (/40\d|forbidden|access denied|captcha/i.test(message)) skip = "blocked";
      expansion = {
        token: `@${url}`,
        url,
        ok: false,
        skip,
        error: message
      };
    }
    seen.set(url, expansion);
    if (body) bodies.set(url, body);
    if (opts.cache) opts.cache.set(url, { ...expansion, body });
    order.push(url);
  }
  if (seen.size === 0) return { text, expansions: [] };
  const expansions = order.map((u) => seen.get(u)).filter(Boolean);
  const blocks = [];
  for (const ex of expansions) {
    if (ex.ok) {
      const titleAttr = ex.title ? ` title="${escapeAttr(ex.title)}"` : "";
      const truncTag = ex.truncated ? ' truncated="true"' : "";
      const body = bodies.get(ex.url) ?? "";
      blocks.push(`<url href="${ex.url}"${titleAttr}${truncTag}>
${body}
</url>`);
    } else {
      const reasonAttr = ex.skip ?? "fetch-error";
      blocks.push(`<url href="${ex.url}" skipped="${reasonAttr}" />`);
    }
  }
  const augmented = `${text}

[Referenced URLs]
${blocks.join("\n\n")}`;
  return { text: augmented, expansions };
}
function stripUrlTail(raw) {
  let s = raw;
  while (s.length > 0) {
    const last = s[s.length - 1];
    if (".,;:!?".includes(last)) {
      s = s.slice(0, -1);
      continue;
    }
    if (")]}>".includes(last)) {
      const open = { ")": "(", "]": "[", "}": "{", ">": "<" }[last];
      if (!s.includes(open)) {
        s = s.slice(0, -1);
        continue;
      }
    }
    break;
  }
  return s;
}
function escapeAttr(s) {
  return s.replace(/"/g, "&quot;").replace(/[\r\n]+/g, " ").trim();
}

// src/at-mentions.ts
var DEFAULT_AT_MENTION_MAX_BYTES = 64 * 1024;
var DEFAULT_AT_DIR_MAX_ENTRIES = 200;
var DEFAULT_PICKER_IGNORE_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".cache",
  ".vscode",
  ".idea",
  "target",
  ".venv",
  "venv",
  "__pycache__"
];
function listFilesSync(root, opts = {}) {
  return listFilesWithStatsSync(root, opts).map((e) => e.path);
}
function listFilesWithStatsSync(root, opts = {}) {
  const maxResults = Math.max(1, opts.maxResults ?? 2e3);
  const ignoreDirs = new Set(opts.ignoreDirs ?? DEFAULT_PICKER_IGNORE_DIRS);
  const rootAbs = resolve2(root);
  const respectGi = opts.respectGitignore !== false;
  const out = [];
  const walk2 = (dirAbs, dirRel, layers) => {
    if (out.length >= maxResults) return;
    let effectiveLayers = layers;
    if (respectGi) {
      const ig = loadGitignoreAtSync(dirAbs);
      if (ig) effectiveLayers = [...layers, { dirAbs, ig }];
    }
    let entries;
    try {
      entries = readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      if (out.length >= maxResults) return;
      const relPath = dirRel ? `${dirRel}/${ent.name}` : ent.name;
      const absPath = join4(dirAbs, ent.name);
      if (ent.isDirectory()) {
        if (ent.name.startsWith(".") || ignoreDirs.has(ent.name)) continue;
        if (ignoredByLayers(effectiveLayers, absPath, true)) continue;
        walk2(absPath, relPath, effectiveLayers);
      } else if (ent.isFile()) {
        if (ignoredByLayers(effectiveLayers, absPath, false)) continue;
        let mtimeMs = 0;
        try {
          mtimeMs = statSync(absPath).mtimeMs;
        } catch {
        }
        out.push({ path: relPath, mtimeMs });
      } else if (ent.isSymbolicLink()) {
        let target = null;
        try {
          target = statSync(absPath);
        } catch {
          continue;
        }
        if (!target.isFile()) continue;
        if (ignoredByLayers(effectiveLayers, absPath, false)) continue;
        out.push({ path: relPath, mtimeMs: target.mtimeMs });
      }
    }
  };
  walk2(rootAbs, "", []);
  return out;
}
async function walkFilesStream(root, opts) {
  const ignoreDirs = new Set(opts.ignoreDirs ?? DEFAULT_PICKER_IGNORE_DIRS);
  const respectGi = opts.respectGitignore !== false;
  const rootAbs = resolve2(root);
  const progressGap = Math.max(0, opts.progressIntervalMs ?? 100);
  let scanned = 0;
  let halted = false;
  let lastProgress = 0;
  const reportProgress = (force) => {
    if (!opts.onProgress) return;
    const now = Date.now();
    if (force || now - lastProgress >= progressGap) {
      lastProgress = now;
      opts.onProgress(scanned);
    }
  };
  const emit = (entry) => {
    scanned++;
    if (halted) return;
    if (opts.onEntry(entry) === false) halted = true;
    reportProgress(false);
  };
  const walk2 = async (dirAbs, dirRel, layers) => {
    if (halted || opts.signal?.aborted) return;
    let effectiveLayers = layers;
    if (respectGi) {
      const ig = await loadGitignoreAt(dirAbs);
      if (ig) effectiveLayers = [...layers, { dirAbs, ig }];
    }
    let entries;
    try {
      entries = await readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const fileEnts = [];
    for (const ent of entries) {
      if (halted || opts.signal?.aborted) break;
      const absPath = join4(dirAbs, ent.name);
      if (ent.isDirectory()) {
        if (ent.name.startsWith(".") || ignoreDirs.has(ent.name)) continue;
        if (ignoredByLayers(effectiveLayers, absPath, true)) continue;
        if (fileEnts.length > 0) {
          await flushFiles(fileEnts, dirAbs, dirRel, effectiveLayers, emit);
          fileEnts.length = 0;
          if (halted || opts.signal?.aborted) return;
        }
        await walk2(absPath, dirRel ? `${dirRel}/${ent.name}` : ent.name, effectiveLayers);
      } else if (ent.isFile() || ent.isSymbolicLink()) {
        fileEnts.push(ent);
      }
    }
    if (fileEnts.length > 0 && !halted && !opts.signal?.aborted) {
      await flushFiles(fileEnts, dirAbs, dirRel, effectiveLayers, emit);
    }
  };
  await walk2(rootAbs, "", []);
  reportProgress(true);
  return { scanned, cancelled: !!opts.signal?.aborted };
}
async function flushFiles(ents, dirAbs, dirRel, layers, emit) {
  const accepted = ents.filter((e) => !ignoredByLayers(layers, join4(dirAbs, e.name), false));
  const stats = await Promise.all(
    accepted.map(
      (e) => stat(join4(dirAbs, e.name)).then((s) => ({ mtimeMs: s.mtimeMs, isFile: s.isFile() })).catch(() => null)
    )
  );
  for (let i = 0; i < accepted.length; i++) {
    const ent = accepted[i];
    const s = stats[i];
    if (ent.isSymbolicLink() && (!s || !s.isFile)) continue;
    emit({
      path: dirRel ? `${dirRel}/${ent.name}` : ent.name,
      mtimeMs: s?.mtimeMs ?? 0
    });
  }
}
async function listDirectory(root, relDir, opts = {}) {
  const ignoreDirs = new Set(opts.ignoreDirs ?? DEFAULT_PICKER_IGNORE_DIRS);
  const respectGi = opts.respectGitignore !== false;
  const rootAbs = resolve2(root);
  const dirAbs = resolve2(rootAbs, relDir);
  const rel = relative5(rootAbs, dirAbs);
  if (rel.startsWith("..") || isAbsolute2(rel)) return [];
  const layers = [];
  if (respectGi) {
    const segs = rel ? rel.split(/[\\/]/) : [];
    let cursor = rootAbs;
    const ig = await loadGitignoreAt(cursor);
    if (ig) layers.push({ dirAbs: cursor, ig });
    for (const seg of segs) {
      cursor = join4(cursor, seg);
      const igSeg = await loadGitignoreAt(cursor);
      if (igSeg) layers.push({ dirAbs: cursor, ig: igSeg });
    }
  }
  let raw;
  try {
    raw = await readdir(dirAbs, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirRel = rel.split(/[\\/]/).join("/");
  const dirs = [];
  const files = [];
  for (const ent of raw) {
    const absPath = join4(dirAbs, ent.name);
    if (ent.isDirectory()) {
      if (ent.name.startsWith(".") || ignoreDirs.has(ent.name)) continue;
      if (ignoredByLayers(layers, absPath, true)) continue;
      dirs.push({
        name: ent.name,
        path: dirRel ? `${dirRel}/${ent.name}` : ent.name,
        isDir: true,
        mtimeMs: 0
      });
    } else if (ent.isFile() || ent.isSymbolicLink()) {
      if (ignoredByLayers(layers, absPath, false)) continue;
      files.push(ent);
    }
  }
  const stats = await Promise.all(
    files.map(
      (e) => stat(join4(dirAbs, e.name)).then((s) => ({ mtimeMs: s.mtimeMs, isFile: s.isFile() })).catch(() => null)
    )
  );
  const fileEntries = [];
  for (let i = 0; i < files.length; i++) {
    const ent = files[i];
    const s = stats[i];
    if (ent.isSymbolicLink() && (!s || !s.isFile)) continue;
    fileEntries.push({
      name: ent.name,
      path: dirRel ? `${dirRel}/${ent.name}` : ent.name,
      isDir: false,
      mtimeMs: s?.mtimeMs ?? 0
    });
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  fileEntries.sort((a, b) => a.name.localeCompare(b.name));
  return [...dirs, ...fileEntries];
}
function parseAtQuery(query) {
  const normalized = query.replace(/\\/g, "/");
  const trailingSlash = normalized.endsWith("/");
  const trimmed = trailingSlash ? normalized.slice(0, -1) : normalized;
  const lastSlash = trimmed.lastIndexOf("/");
  if (trailingSlash) return { dir: trimmed, filter: "", trailingSlash: true };
  if (lastSlash < 0) return { dir: "", filter: trimmed, trailingSlash: false };
  return {
    dir: trimmed.slice(0, lastSlash),
    filter: trimmed.slice(lastSlash + 1),
    trailingSlash: false
  };
}
var AT_PICKER_PREFIX = /(?:^|\s)@([a-zA-Z0-9_./\\-]*)$/;
function detectAtPicker(input) {
  const m = AT_PICKER_PREFIX.exec(input);
  if (!m) return null;
  const query = m[1] ?? "";
  const atOffset = input.length - query.length - 1;
  return { query, atOffset };
}
function rankPickerCandidates(files, query, limitOrOpts) {
  const opts = typeof limitOrOpts === "number" ? { limit: limitOrOpts } : limitOrOpts ?? {};
  const limit = opts.limit ?? 40;
  const recent = new Set(opts.recentlyUsed ?? []);
  const entries = files.map(
    (f) => typeof f === "string" ? { path: f, mtimeMs: 0 } : f
  );
  if (!query) {
    const anyMtime = entries.some((e) => e.mtimeMs > 0);
    if (!anyMtime && recent.size === 0) {
      return entries.slice(0, limit).map((e) => e.path);
    }
    const sorted = [...entries].sort((a, b) => {
      const aRecent = recent.has(a.path) ? 1 : 0;
      const bRecent = recent.has(b.path) ? 1 : 0;
      if (aRecent !== bRecent) return bRecent - aRecent;
      if (a.mtimeMs !== b.mtimeMs) return b.mtimeMs - a.mtimeMs;
      return a.path.localeCompare(b.path);
    });
    return sorted.slice(0, limit).map((e) => e.path);
  }
  const needle = query.toLowerCase();
  const scored = [];
  for (const e of entries) {
    const lower = e.path.toLowerCase();
    const hit = lower.indexOf(needle);
    if (hit >= 0) {
      const slash = lower.lastIndexOf("/");
      const base = slash >= 0 ? lower.slice(slash + 1) : lower;
      let cls = 2;
      if (base.startsWith(needle)) cls = 0;
      else if (lower.startsWith(needle)) cls = 1;
      scored.push({
        path: e.path,
        score: cls * 1e4 + Math.min(hit, 9999),
        mtimeMs: e.mtimeMs,
        recent: recent.has(e.path)
      });
      continue;
    }
    const fuzzy = fuzzySubseqScore(needle, lower);
    if (fuzzy === null) continue;
    scored.push({
      path: e.path,
      score: 3e4 + fuzzy,
      mtimeMs: e.mtimeMs,
      recent: recent.has(e.path)
    });
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.recent !== b.recent) return a.recent ? -1 : 1;
    return b.mtimeMs - a.mtimeMs;
  });
  return scored.slice(0, limit).map((s) => s.path);
}
function fuzzySubseqScore(needle, target) {
  if (needle.length === 0) return 0;
  const slashIdx = target.lastIndexOf("/");
  const basenameStart = slashIdx >= 0 ? slashIdx + 1 : 0;
  let qi = 0;
  let lastMatchIdx = -2;
  let consecutive = 0;
  let basenameMatches = 0;
  let totalGap = 0;
  for (let ti = 0; ti < target.length && qi < needle.length; ti++) {
    if (target[ti] !== needle[qi]) continue;
    if (ti === lastMatchIdx + 1) consecutive++;
    else if (lastMatchIdx >= 0) totalGap += ti - lastMatchIdx - 1;
    if (ti >= basenameStart) basenameMatches++;
    lastMatchIdx = ti;
    qi++;
  }
  if (qi < needle.length) return null;
  const quality = Math.max(0, totalGap - consecutive * 10 - basenameMatches * 5);
  const lengthPenalty = Math.floor(target.length / 4);
  return quality + lengthPenalty;
}
var AT_MENTION_PATTERN = /(?<=^|\s)@([a-zA-Z0-9_./\\-]+)/g;
function expandAtMentions(text, rootDir, opts = {}) {
  const maxBytes = opts.maxBytes ?? DEFAULT_AT_MENTION_MAX_BYTES;
  const maxDirEntries = Math.max(1, opts.maxDirEntries ?? DEFAULT_AT_DIR_MAX_ENTRIES);
  const fs5 = opts.fs ?? defaultFs;
  const root = resolve2(rootDir);
  const seen = /* @__PURE__ */ new Map();
  const expansions = [];
  const dirListings = /* @__PURE__ */ new Map();
  for (const match of text.matchAll(AT_MENTION_PATTERN)) {
    const rawPath = match[1] ?? "";
    let cleaned = rawPath;
    while (cleaned.endsWith(".")) cleaned = cleaned.slice(0, -1);
    if (cleaned.endsWith("/") || cleaned.endsWith("\\")) cleaned = cleaned.slice(0, -1);
    if (!cleaned) continue;
    const token = `@${cleaned}`;
    if (seen.has(token)) continue;
    const expansion = resolveMention(cleaned, root, maxBytes, maxDirEntries, fs5, dirListings);
    seen.set(token, expansion);
    expansions.push(expansion);
  }
  if (expansions.length === 0) return { text, expansions };
  const blocks = [];
  for (const ex of expansions) {
    if (ex.ok && ex.isDirectory) {
      const files = dirListings.get(ex.path) ?? [];
      const truncAttr = ex.truncated ? ' truncated="true"' : "";
      const body = files.length > 0 ? `
${files.join("\n")}
` : "\n";
      blocks.push(
        `<directory path="${ex.path}" entries="${ex.entries ?? files.length}"${truncAttr}>${body}</directory>`
      );
    } else if (ex.ok) {
      const content = readSafe(root, ex.path, fs5);
      blocks.push(`<file path="${ex.path}">
${content}
</file>`);
    } else {
      blocks.push(`<file path="${ex.path}" skipped="${ex.skip}" />`);
    }
  }
  const augmented = `${text}

[Referenced files]
${blocks.join("\n\n")}`;
  return { text: augmented, expansions };
}
function resolveMention(rawPath, root, maxBytes, maxDirEntries, fs5, dirListings) {
  if (isAbsolute2(rawPath)) {
    return { token: `@${rawPath}`, path: rawPath, ok: false, skip: "escape" };
  }
  const resolved = resolve2(root, rawPath);
  const rel = relative5(root, resolved);
  if (rel.startsWith("..") || isAbsolute2(rel)) {
    return { token: `@${rawPath}`, path: rawPath, ok: false, skip: "escape" };
  }
  if (!fs5.exists(resolved)) {
    return { token: `@${rawPath}`, path: rawPath, ok: false, skip: "missing" };
  }
  if (fs5.isFile(resolved)) {
    const size = fs5.size(resolved);
    if (size > maxBytes) {
      return { token: `@${rawPath}`, path: rawPath, ok: false, skip: "too-large", bytes: size };
    }
    return { token: `@${rawPath}`, path: rawPath, ok: true, bytes: size };
  }
  if (fs5.isDir?.(resolved) && fs5.listDir) {
    const { files, truncated } = fs5.listDir(resolved, root, maxDirEntries);
    dirListings.set(rawPath, files);
    return {
      token: `@${rawPath}`,
      path: rawPath,
      ok: true,
      isDirectory: true,
      entries: files.length,
      truncated
    };
  }
  return { token: `@${rawPath}`, path: rawPath, ok: false, skip: "not-file" };
}
function readSafe(root, rawPath, fs5) {
  const resolved = resolve2(root, rawPath);
  try {
    return fs5.read(resolved);
  } catch {
    return "(read failed)";
  }
}
var defaultFs = {
  exists: (p) => existsSync(p),
  isFile: (p) => {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  },
  isDir: (p) => {
    try {
      return statSync(p).isDirectory();
    } catch {
      return false;
    }
  },
  listDir: (dirAbs, root, max) => {
    const dirRel = relative5(root, dirAbs).split(/[\\/]/).join("/");
    const walkCap = Math.max(max * 4, 5e3);
    const all = listFilesSync(root, { maxResults: walkCap });
    const prefix = dirRel ? `${dirRel}/` : "";
    const filtered = dirRel ? all.filter((f) => f === dirRel || f.startsWith(prefix)) : all;
    return {
      files: filtered.slice(0, max),
      truncated: filtered.length > max
    };
  },
  size: (p) => {
    try {
      return statSync(p).size;
    } catch {
      return 0;
    }
  },
  read: (p) => readFileSync(p, "utf8")
};

// src/tools/subagent-types.ts
var EXPLORE_SYSTEM = `You are an exploration subagent. Wide-net read-only investigation; return one distilled answer.

How to operate:
- Read-only tools only (read_file, search_files, search_content, directory_tree, list_directory, get_file_info).
- For "find all places that call / reference / use X" \u2014 use search_content (content grep), NOT search_files (which only matches names).
- Cast a wide net first to map the territory, then read the 3-10 most relevant files in full. Stop as soon as you can answer.
- The parent does not see your tool calls \u2014 over-exploration is pure waste.

Final answer:
- One paragraph or short bullets; lead with the conclusion.
- Cite file:line ranges when they back the claim.
- No follow-up offers, no "let me know if you need more" \u2014 the parent will ask again.

${NEGATIVE_CLAIM_RULE}

${TUI_FORMATTING_RULES}`;
var VERIFY_SYSTEM = `You are a verify subagent. Narrow check \u2014 return YES / NO / INCONCLUSIVE with evidence. Do not expand scope.

How to operate:
- Read only what's needed to verify the specific claim. No exploration past the claim.
- Use search_content / read_file to confirm the exact behavior, type, or call site in question.
- Cap at 6-8 tool calls. If you can't verify in that, return INCONCLUSIVE plus what's missing.

Final answer:
- Lead with VERIFIED / NOT VERIFIED / INCONCLUSIVE.
- Cite file:line for the evidence.
- One paragraph or a few bullets. No follow-up offers.

${NEGATIVE_CLAIM_RULE}

${TUI_FORMATTING_RULES}`;
var TYPES = {
  explore: { system: EXPLORE_SYSTEM, maxToolIters: 20 },
  verify: { system: VERIFY_SYSTEM, maxToolIters: 8 }
};
var SUBAGENT_TYPE_NAMES = Object.freeze(
  Object.keys(TYPES)
);

// src/tools/subagent.ts
var runIdCounter = 0;
function nextRunId() {
  runIdCounter++;
  return `sub-${runIdCounter.toString(36)}`;
}
var SUBAGENT_BASE_SYSTEM = `You are a Reasonix subagent. The parent agent spawned you to handle one focused subtask, then return.

Rules:
- Stay on the task you were given. Do not expand scope.
- Use tools as needed. You share the parent's sandbox + safety rules.
- When you're done, your final assistant message is the only thing the parent will see \u2014 make it complete and self-contained. No follow-up offers, no questions, no "let me know if you need more."
- Prefer one clear, distilled answer over a long log of what you tried.

${NEGATIVE_CLAIM_RULE}

${TUI_FORMATTING_RULES}`;
var DEFAULT_MAX_RESULT_CHARS2 = 8e3;
var DEFAULT_MAX_ITERS = 16;
var BUDGET_WARN_THRESHOLD = 3;
function budgetParagraph(maxToolIters) {
  return `Tool budget: you have ${maxToolIters} tool call${maxToolIters === 1 ? "" : "s"} for this task. The cap is enforced from outside \u2014 the call after #${maxToolIters} is refused. Pace yourself: if you can't fully resolve the task within the budget, stop early and return what you have plus what's missing, rather than burning the budget on one branch.`;
}
var DEFAULT_SUBAGENT_MODEL = "deepseek-v4-flash";
var DEFAULT_SUBAGENT_EFFORT = "high";
var SUBAGENT_TOOL_NAME = "spawn_subagent";
var NEVER_INHERITED_TOOLS = /* @__PURE__ */ new Set([SUBAGENT_TOOL_NAME, "submit_plan"]);
async function spawnSubagent(opts) {
  const model = opts.model ?? DEFAULT_SUBAGENT_MODEL;
  const maxToolIters = opts.maxToolIters ?? DEFAULT_MAX_ITERS;
  const maxResultChars = opts.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS2;
  const sink = opts.sink;
  const skillName = opts.skillName;
  const startedAt = Date.now();
  const runId = nextRunId();
  const taskPreview = opts.task.length > 30 ? `${opts.task.slice(0, 30)}\u2026` : opts.task;
  sink?.current?.({
    kind: "start",
    runId,
    task: taskPreview,
    skillName,
    model,
    iter: 0,
    elapsedMs: 0
  });
  if (opts.allowedTools) {
    const missing = opts.allowedTools.filter((n) => !opts.parentRegistry.has(n));
    if (missing.length > 0) {
      const errorMessage2 = `subagent allow-list names tool(s) not registered in the parent: ${missing.join(", ")}. Fix the skill's \`allowed-tools\` frontmatter or check spelling.`;
      sink?.current?.({
        kind: "end",
        runId,
        task: taskPreview,
        skillName,
        model,
        iter: 0,
        elapsedMs: Date.now() - startedAt,
        error: errorMessage2,
        turns: 0,
        costUsd: 0,
        usage: new Usage()
      });
      return {
        success: false,
        output: "",
        error: errorMessage2,
        turns: 0,
        toolIters: 0,
        elapsedMs: Date.now() - startedAt,
        costUsd: 0,
        model,
        skillName,
        usage: new Usage()
      };
    }
  }
  const childTools = opts.allowedTools ? forkRegistryWithAllowList(
    opts.parentRegistry,
    new Set(opts.allowedTools),
    NEVER_INHERITED_TOOLS
  ) : forkRegistryExcluding(opts.parentRegistry, NEVER_INHERITED_TOOLS);
  let dispatchCount = 0;
  childTools.setResultAugmenter((_name, _args, result) => {
    dispatchCount++;
    const remaining = maxToolIters - dispatchCount;
    if (remaining <= 0) {
      return `${result}

[budget: 0 of ${maxToolIters} tool calls left \u2014 finalize NOW; the next tool call will be refused]`;
    }
    if (remaining <= BUDGET_WARN_THRESHOLD) {
      return `${result}

[budget: ${remaining} of ${maxToolIters} tool call${remaining === 1 ? "" : "s"} left \u2014 wrap up soon]`;
    }
    return result;
  });
  const childPrefix = new ImmutablePrefix({
    system: `${opts.system}

${budgetParagraph(maxToolIters)}`,
    toolSpecs: childTools.specs()
  });
  const childLoop = new CacheFirstLoop({
    client: opts.client,
    prefix: childPrefix,
    tools: childTools,
    model,
    // Subagents run on a constrained thinking budget by default — the
    // task is already narrow by construction, and `high` cuts output
    // tokens substantially vs `max`.
    reasoningEffort: DEFAULT_SUBAGENT_EFFORT,
    maxToolIters,
    hooks: [],
    // Streaming on so the parent UI can flip the "summarising" phase the
    // moment the model starts emitting the final answer (first assistant_delta
    // after the last tool result, before assistant_final lands).
    stream: true
  });
  const onParentAbort = () => childLoop.abort();
  if (opts.parentSignal?.aborted) {
    childLoop.abort();
  } else {
    opts.parentSignal?.addEventListener("abort", onParentAbort, { once: true });
  }
  let final = "";
  let errorMessage;
  let toolIter = 0;
  let summarisingEmitted = false;
  try {
    for await (const ev of childLoop.step(opts.task)) {
      sink?.current?.({ kind: "inner", runId, task: taskPreview, skillName, model, inner: ev });
      if (ev.role === "tool") {
        toolIter++;
        summarisingEmitted = false;
        sink?.current?.({
          kind: "progress",
          runId,
          task: taskPreview,
          skillName,
          model,
          iter: toolIter,
          elapsedMs: Date.now() - startedAt
        });
      }
      if (ev.role === "assistant_delta" && !summarisingEmitted && (ev.content ?? "").length > 0) {
        summarisingEmitted = true;
        sink?.current?.({
          kind: "phase",
          runId,
          task: taskPreview,
          skillName,
          model,
          phase: "summarising",
          iter: toolIter,
          elapsedMs: Date.now() - startedAt
        });
      }
      if (ev.role === "assistant_final") {
        if (ev.forcedSummary) {
          errorMessage = ev.content?.trim() || "subagent ended without producing an answer";
        } else {
          final = ev.content ?? "";
        }
      }
      if (ev.role === "error") {
        errorMessage = ev.error ?? "subagent error";
      }
    }
  } catch (err) {
    errorMessage = err.message;
  } finally {
    opts.parentSignal?.removeEventListener("abort", onParentAbort);
  }
  if (!errorMessage && !final) {
    errorMessage = opts.parentSignal?.aborted ? "subagent aborted before producing an answer" : "subagent ended without producing an answer";
  }
  const elapsedMs = Date.now() - startedAt;
  const turns = childLoop.stats.turns.length;
  const costUsd2 = childLoop.stats.totalCost;
  const usage = aggregateChildUsage(childLoop);
  const truncated = final.length > maxResultChars ? `${final.slice(0, maxResultChars)}

[\u2026truncated ${final.length - maxResultChars} chars; ask the subagent for a tighter summary if you need more.]` : final;
  sink?.current?.({
    kind: "end",
    runId,
    task: taskPreview,
    skillName,
    model,
    iter: toolIter,
    elapsedMs,
    summary: errorMessage ? void 0 : truncated.slice(0, 120),
    error: errorMessage,
    turns,
    costUsd: costUsd2,
    usage
  });
  return {
    success: !errorMessage,
    output: errorMessage ? "" : truncated,
    error: errorMessage,
    turns,
    toolIters: toolIter,
    elapsedMs,
    costUsd: costUsd2,
    model,
    skillName,
    usage
  };
}
function aggregateChildUsage(loop) {
  const agg = new Usage();
  for (const t2 of loop.stats.turns) {
    agg.promptTokens += t2.usage.promptTokens;
    agg.completionTokens += t2.usage.completionTokens;
    agg.totalTokens += t2.usage.totalTokens;
    agg.promptCacheHitTokens += t2.usage.promptCacheHitTokens;
    agg.promptCacheMissTokens += t2.usage.promptCacheMissTokens;
  }
  return agg;
}
function formatSubagentResult(r) {
  if (!r.success) {
    return JSON.stringify({
      success: false,
      error: r.error ?? "unknown subagent error",
      turns: r.turns,
      tool_iters: r.toolIters,
      elapsed_ms: r.elapsedMs
    });
  }
  return JSON.stringify({
    success: true,
    output: r.output,
    turns: r.turns,
    tool_iters: r.toolIters,
    elapsed_ms: r.elapsedMs,
    cost_usd: r.costUsd
  });
}
function forkRegistryExcluding(parent, exclude) {
  const child = new ToolRegistry();
  for (const spec of parent.specs()) {
    const name = spec.function.name;
    if (exclude.has(name)) continue;
    const def = parent.get(name);
    if (!def) continue;
    child.register(def);
  }
  if (parent.planMode) child.setPlanMode(true);
  return child;
}
function forkRegistryWithAllowList(parent, allow, alsoExclude) {
  const child = new ToolRegistry();
  for (const spec of parent.specs()) {
    const name = spec.function.name;
    if (!allow.has(name)) continue;
    if (alsoExclude.has(name)) continue;
    const def = parent.get(name);
    if (!def) continue;
    child.register(def);
  }
  if (parent.planMode) child.setPlanMode(true);
  return child;
}

// src/code/edit-blocks.ts
import {
  closeSync,
  existsSync as existsSync2,
  fstatSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  readFileSync as readFileSync2,
  readSync,
  unlinkSync,
  writeFileSync,
  writeSync
} from "fs";
import { dirname as dirname2, resolve as resolve3 } from "path";
var BLOCK_RE = /^(\S[^\n]*)\n<{7} SEARCH\n([\s\S]*?)\n?={7}\n([\s\S]*?)\n?>{7} REPLACE/gm;
function parseEditBlocks(text) {
  const out = [];
  BLOCK_RE.lastIndex = 0;
  let m = BLOCK_RE.exec(text);
  while (m !== null) {
    out.push({
      path: m[1].trim(),
      search: m[2],
      replace: m[3],
      offset: m.index
    });
    m = BLOCK_RE.exec(text);
  }
  return out;
}
function applyEditBlock(block, rootDir) {
  const absRoot = resolve3(rootDir);
  const absTarget = resolve3(absRoot, block.path);
  if (absTarget !== absRoot && !absTarget.startsWith(`${absRoot}${sep()}`)) {
    return {
      path: block.path,
      status: "path-escape",
      message: `resolved path ${absTarget} is outside rootDir ${absRoot}`
    };
  }
  const searchEmpty = block.search.length === 0;
  if (searchEmpty) {
    try {
      mkdirSync(dirname2(absTarget), { recursive: true });
      const fd = openSync(absTarget, "wx");
      try {
        writeSync(fd, block.replace);
      } finally {
        closeSync(fd);
      }
      return { path: block.path, status: "created" };
    } catch (err) {
      const e = err;
      if (e.code === "EEXIST") {
        return {
          path: block.path,
          status: "not-found",
          message: "empty SEARCH only creates new files \u2014 this file already exists"
        };
      }
      return { path: block.path, status: "error", message: e.message };
    }
  }
  try {
    let fd;
    try {
      fd = openSync(absTarget, "r+");
    } catch (err) {
      if (err.code === "ENOENT") {
        return {
          path: block.path,
          status: "file-missing",
          message: "file does not exist; to create it, use an empty SEARCH block"
        };
      }
      throw err;
    }
    try {
      const stat2 = fstatSync(fd);
      const inBuf = Buffer.alloc(stat2.size);
      let readBytes = 0;
      while (readBytes < stat2.size) {
        const n = readSync(fd, inBuf, readBytes, stat2.size - readBytes, readBytes);
        if (n <= 0) break;
        readBytes += n;
      }
      const content = inBuf.toString("utf8", 0, readBytes);
      const le = lineEndingOf(content);
      const adaptedSearch = block.search.replace(/\r?\n/g, le);
      const adaptedReplace = block.replace.replace(/\r?\n/g, le);
      const idx = content.indexOf(adaptedSearch);
      if (idx === -1) {
        return {
          path: block.path,
          status: "not-found",
          message: "SEARCH text does not match the current file content exactly"
        };
      }
      const replaced = `${content.slice(0, idx)}${adaptedReplace}${content.slice(idx + adaptedSearch.length)}`;
      const outBuf = Buffer.from(replaced, "utf8");
      ftruncateSync(fd, outBuf.length);
      let written = 0;
      while (written < outBuf.length) {
        const n = writeSync(fd, outBuf, written, outBuf.length - written, written);
        if (n <= 0) break;
        written += n;
      }
      return { path: block.path, status: "applied" };
    } finally {
      closeSync(fd);
    }
  } catch (err) {
    return { path: block.path, status: "error", message: err.message };
  }
}
function applyEditBlocks(blocks, rootDir) {
  return blocks.map((b) => applyEditBlock(b, rootDir));
}
function toWholeFileEditBlock(path, content, rootDir) {
  const abs = resolve3(rootDir, path);
  let search = "";
  if (existsSync2(abs)) {
    try {
      search = readFileSync2(abs, "utf8");
    } catch {
      search = "";
    }
  }
  return { path, search, replace: content, offset: 0 };
}
function snapshotBeforeEdits(blocks, rootDir) {
  const absRoot = resolve3(rootDir);
  const seen = /* @__PURE__ */ new Set();
  const snapshots = [];
  for (const b of blocks) {
    if (seen.has(b.path)) continue;
    seen.add(b.path);
    const abs = resolve3(absRoot, b.path);
    if (!existsSync2(abs)) {
      snapshots.push({ path: b.path, prevContent: null });
      continue;
    }
    try {
      snapshots.push({ path: b.path, prevContent: readFileSync2(abs, "utf8") });
    } catch {
      snapshots.push({ path: b.path, prevContent: null });
    }
  }
  return snapshots;
}
function restoreSnapshots(snapshots, rootDir) {
  const absRoot = resolve3(rootDir);
  return snapshots.map((snap) => {
    const abs = resolve3(absRoot, snap.path);
    if (abs !== absRoot && !abs.startsWith(`${absRoot}${sep()}`)) {
      return {
        path: snap.path,
        status: "path-escape",
        message: "snapshot path escapes rootDir \u2014 refusing to restore"
      };
    }
    try {
      if (snap.prevContent === null) {
        if (existsSync2(abs)) unlinkSync(abs);
        return {
          path: snap.path,
          status: "applied",
          message: "removed (the edit had created it)"
        };
      }
      writeFileSync(abs, snap.prevContent, "utf8");
      return {
        path: snap.path,
        status: "applied",
        message: "restored to pre-edit content"
      };
    } catch (err) {
      return { path: snap.path, status: "error", message: err.message };
    }
  });
}
function sep() {
  return process.platform === "win32" ? "\\" : "/";
}
function lineEndingOf(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

export {
  ToolRegistry,
  registerSingleMcpTool,
  bridgeMcpTools,
  ImmutablePrefix,
  CacheFirstLoop,
  expandAtUrls,
  walkFilesStream,
  listDirectory,
  parseAtQuery,
  detectAtPicker,
  rankPickerCandidates,
  expandAtMentions,
  registerFilesystemTools,
  registerMemoryTools,
  registerChoiceTool,
  registerPlanTool,
  registerTodoTool,
  spawnSubagent,
  formatSubagentResult,
  webFetch,
  registerWebTools,
  parseEditBlocks,
  applyEditBlocks,
  toWholeFileEditBlock,
  snapshotBeforeEdits,
  restoreSnapshots
};
//# sourceMappingURL=chunk-BTSIAOUG.js.map