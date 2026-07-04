#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  SkillStore
} from "./chunk-2K65GZBT.js";

// src/core/event-redaction.ts
var SECRET_KEY_RE = /(secret|token|password|passphrase|api[-_]?key|authorization|cookie|credential|passwd|pwd)/i;
function redactEventValue(value) {
  return redactUnknown(value, null);
}
function redactUnknown(value, key) {
  if (Array.isArray(value)) return value.map((item) => redactUnknown(item, null));
  if (value && typeof value === "object") {
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = redactUnknown(childValue, childKey);
    }
    return out;
  }
  if (typeof value === "string") {
    if (key && SECRET_KEY_RE.test(key) || /^Bearer\s+/i.test(value)) return "[redacted]";
  }
  return value;
}

// src/core/eventize.ts
var Eventizer = class {
  nextId = 0;
  lastTurn = -1;
  nextToolSeq = 0;
  /** Tool calls announced via tool_call_delta but not yet dispatched. FIFO upgraded by tool_start. */
  preparingCallIds = [];
  /** Tool calls dispatched but not yet finished. FIFO popped by tool result. */
  inflightCallIds = [];
  /** Per-turn dedupe so each toolCallIndex emits exactly one tool.preparing. */
  announcedToolIdx = /* @__PURE__ */ new Set();
  consume(ev, ctx) {
    const out = [];
    if (ev.turn !== this.lastTurn) {
      this.lastTurn = ev.turn;
      this.announcedToolIdx.clear();
      out.push(this.turnStartedEvent(ev.turn, ctx));
    }
    switch (ev.role) {
      case "assistant_delta":
        if (ev.content) out.push(this.deltaEvent(ev.turn, "content", ev.content));
        if (ev.reasoningDelta) out.push(this.deltaEvent(ev.turn, "reasoning", ev.reasoningDelta));
        break;
      case "tool_call_delta": {
        const idx = ev.toolCallIndex;
        const name = ev.toolName;
        if (idx === void 0 || !name) break;
        const key = `${ev.turn}:${idx}`;
        if (this.announcedToolIdx.has(key)) break;
        this.announcedToolIdx.add(key);
        const callId = `tc-${++this.nextToolSeq}`;
        this.preparingCallIds.push(callId);
        out.push(this.toolPreparingEvent(ev.turn, callId, name));
        break;
      }
      case "assistant_final":
        out.push(this.finalEvent(ev));
        break;
      case "tool_start": {
        const callId = this.preparingCallIds.shift() ?? `tc-${++this.nextToolSeq}`;
        this.inflightCallIds.push(callId);
        out.push(this.toolIntentEvent(ev.turn, callId, ev.toolName ?? "", ev.toolArgs ?? ""));
        out.push(this.toolDispatchedEvent(ev.turn, callId));
        break;
      }
      case "tool": {
        const callId = this.inflightCallIds.shift() ?? `tc-orphan-${++this.nextToolSeq}`;
        const ok = !looksLikeToolError(ev.content, ev.toolName);
        out.push(this.toolResultEvent(ev.turn, callId, ok, ev.content, 0));
        break;
      }
      case "warning":
        out.push(this.classifyWarning(ev));
        break;
      case "error":
        out.push(this.errorEvent(ev.turn, ev.error ?? ev.content, false));
        break;
      case "status":
        out.push(this.statusEvent(ev.turn, ev.content));
        break;
      // `done` / `branch_*` intentionally drop — no kernel-level event.
      default:
        break;
    }
    return out;
  }
  emitUserMessage(turn, text) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "user.message",
      text
    };
  }
  emitSlashInvoked(turn, name, args) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "slash.invoked",
      name,
      args
    };
  }
  emitSessionOpened(turn, name, resumedFromTurn) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "session.opened",
      name,
      resumedFromTurn
    };
  }
  emitSessionCompacted(turn, before, after, reason, replacementMessages) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "session.compacted",
      beforeMessages: before,
      afterMessages: after,
      reason,
      replacementMessages
    };
  }
  emitToolCall(turn, name, args) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "tool.call",
      name,
      args: redactEventValue(args)
    };
  }
  emitToolConfirmAllow(turn, kind, payload) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "tool.confirm.allow",
      kind,
      payload: redactEventValue(payload)
    };
  }
  emitToolConfirmDeny(turn, kind, payload, denyContext) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "tool.confirm.deny",
      kind,
      payload: redactEventValue(payload),
      denyContext
    };
  }
  emitToolConfirmAlwaysAllow(turn, kind, payload, prefix) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "tool.confirm.always_allow",
      kind,
      payload: redactEventValue(payload),
      prefix
    };
  }
  turnStartedEvent(turn, ctx) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "model.turn.started",
      model: ctx.model,
      reasoningEffort: ctx.reasoningEffort,
      prefixHash: ctx.prefixHash
    };
  }
  deltaEvent(turn, channel, text) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "model.delta",
      channel,
      text
    };
  }
  finalEvent(ev) {
    const usage = ev.stats ? {
      prompt_tokens: ev.stats.usage.promptTokens,
      completion_tokens: ev.stats.usage.completionTokens,
      total_tokens: ev.stats.usage.totalTokens,
      prompt_cache_hit_tokens: ev.stats.usage.promptCacheHitTokens,
      prompt_cache_miss_tokens: ev.stats.usage.promptCacheMissTokens
    } : {};
    const costUsd = ev.stats?.cost ?? 0;
    const out = {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn: ev.turn,
      type: "model.final",
      content: ev.content,
      // toolCalls land later via tool_start → tool.intent — not in this event.
      toolCalls: [],
      usage,
      costUsd
    };
    if (ev.forcedSummary) out.forcedSummary = true;
    return out;
  }
  toolPreparingEvent(turn, callId, name) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "tool.preparing",
      callId,
      name
    };
  }
  toolIntentEvent(turn, callId, name, args) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "tool.intent",
      callId,
      name,
      args
    };
  }
  toolDispatchedEvent(turn, callId) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "tool.dispatched",
      callId
    };
  }
  toolResultEvent(turn, callId, ok, output, durationMs) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "tool.result",
      callId,
      ok,
      output,
      durationMs
    };
  }
  statusEvent(turn, text) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "status",
      text
    };
  }
  errorEvent(turn, message, recoverable) {
    return {
      id: ++this.nextId,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn,
      type: "error",
      message,
      recoverable
    };
  }
  /** Pattern-match warning text since LoopEvent doesn't carry a typed kind. */
  classifyWarning(ev) {
    const c = ev.content;
    if (/\bauto-escalating to\b|\barmed\b.*pro|NEEDS_PRO/.test(c)) {
      return {
        id: ++this.nextId,
        ts: (/* @__PURE__ */ new Date()).toISOString(),
        turn: ev.turn,
        type: "policy.escalated",
        fromModel: "",
        toModel: "",
        reason: c.includes("armed") ? "user-request" : "self-report"
      };
    }
    if (/budget\b.*\$|\$\d.*\/\s*\$\d/.test(c)) {
      const blocked = /blocked|exceeded|refus/i.test(c);
      return {
        id: ++this.nextId,
        ts: (/* @__PURE__ */ new Date()).toISOString(),
        turn: ev.turn,
        type: blocked ? "policy.budget.blocked" : "policy.budget.warning",
        spentUsd: 0,
        capUsd: 0
      };
    }
    return this.errorEvent(ev.turn, c, true);
  }
};
function looksLikeToolError(content, _toolName) {
  if (!content) return false;
  if (content.startsWith("ERROR:")) return true;
  if (content.startsWith("[hook block]")) return true;
  if (/^\{"error"\s*:/.test(content)) return true;
  if (/\bConfirmationError:|\bNeedsConfirmationError\b/.test(content)) return true;
  return false;
}

// src/core/pause-policy.ts
function shouldAutoResolveCheckpoint(editMode) {
  return editMode === "auto" || editMode === "yolo" || editMode === "admin";
}
function autoResolveVerdict(req, editMode) {
  if (req.kind === "plan_checkpoint" && shouldAutoResolveCheckpoint(editMode)) {
    return { type: "continue" };
  }
  return null;
}

// src/tools/skills.ts
function registerSkillTools(registry, opts = {}) {
  const store = new SkillStore({
    homeDir: opts.homeDir,
    projectRoot: opts.projectRoot,
    disableBuiltins: opts.disableBuiltins
  });
  const subagentRunner = opts.subagentRunner;
  registry.register({
    name: "run_skill",
    description: "Invoke a playbook from the Skills index pinned in the system prompt. Each entry is a self-contained instruction block. Pass `name` as the BARE skill identifier (e.g. 'explore'), NOT the `[\u{1F9EC} subagent]` tag that appears after it in the index. Entries tagged `[\u{1F9EC} subagent]` spawn an isolated subagent \u2014 only the final distilled answer comes back, the model's tool calls + reasoning during the run never enter your context. Plain skills are inlined: the body becomes a tool result you read and follow. For subagent skills, supply 'arguments' describing the concrete task \u2014 they'll be the only context the subagent has.",
    readOnly: true,
    parallelSafe: true,
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Skill identifier as it appears in the pinned Skills index (e.g. 'explore', 'review', 'security-review'). Case-sensitive."
        },
        arguments: {
          type: "string",
          description: "Free-form arguments the skill should act on. For inline skills: appended to the body as an 'Arguments:' line; the skill's own instructions decide how to consume them. For `[\u{1F9EC} subagent]` skills: REQUIRED \u2014 becomes the entire task description the subagent receives, since it has no other context."
        }
      },
      required: ["name"]
    },
    fn: async (args, ctx) => {
      const raw = typeof args.name === "string" ? args.name.trim() : "";
      if (!raw) {
        return JSON.stringify({ error: "run_skill requires a 'name' argument" });
      }
      const stripped = raw.replace(/\[[^\]]*\]/g, " ").trim();
      const tokens = stripped.split(/\s+/).filter(Boolean);
      const name = tokens.find((t) => /^[a-zA-Z0-9]/.test(t)) ?? "";
      if (!name) {
        return JSON.stringify({
          error: "run_skill requires a 'name' argument",
          hint: `'${raw}' is just a marker/tag, not a skill name`
        });
      }
      const skill = store.read(name);
      if (!skill) {
        const available = store.list().map((s) => s.name).join(", ");
        return JSON.stringify({
          error: `unknown skill: ${JSON.stringify(name)}`,
          available: available || "(none \u2014 user has not defined any skills)"
        });
      }
      const rawArgs = typeof args.arguments === "string" ? args.arguments.trim() : "";
      if (skill.runAs === "subagent") {
        if (!subagentRunner) {
          return JSON.stringify({
            error: `run_skill: skill ${JSON.stringify(name)} is marked runAs=subagent but no subagent runner is configured for this session. Skill authors who need isolation should run inside visionox code (or a library setup that passes subagentRunner to registerSkillTools).`
          });
        }
        if (!rawArgs) {
          return JSON.stringify({
            error: `run_skill: skill ${JSON.stringify(name)} is a subagent and requires 'arguments' \u2014 the subagent has no other context, so describe the concrete task in the arguments field.`
          });
        }
        return subagentRunner(skill, rawArgs, ctx?.signal);
      }
      const header = [
        `# Skill: ${skill.name}`,
        skill.description ? `> ${skill.description}` : "",
        `(scope: ${skill.scope} \xB7 ${skill.path})`
      ].filter(Boolean).join("\n");
      const argsBlock = rawArgs ? `

Arguments: ${rawArgs}` : "";
      const inner = `${header}

${skill.body}${argsBlock}`;
      return `<skill-pin name=${JSON.stringify(skill.name)}>
${inner}
</skill-pin>`;
    }
  });
  return registry;
}

export {
  registerSkillTools,
  Eventizer,
  shouldAutoResolveCheckpoint,
  autoResolveVerdict
};
//# sourceMappingURL=chunk-45U62RI3.js.map