#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  formatMcpLifecycleEvent,
  formatMcpSlowToast
} from "./chunk-H6PS7IUE.js";
import {
  buildTransportFromSpec,
  preflightStdioSpec
} from "./chunk-PQXPXJBJ.js";
import {
  bridgeMcpTools
} from "./chunk-2R4QCDOZ.js";
import {
  McpClient,
  inspectMcpServer,
  parseMcpSpec
} from "./chunk-6AK4EY3D.js";
import {
  t
} from "./chunk-RE4RAVFF.js";
import {
  mcpEnvFor,
  readConfig
} from "./chunk-XPDVG52A.js";

// src/mcp/summary.ts
function buildMcpServerSummary(opts) {
  return {
    label: opts.label,
    spec: opts.spec,
    toolCount: opts.toolCount,
    report: opts.report,
    host: opts.host,
    bridgeEnv: opts.bridgeEnv,
    readResource(uri) {
      return opts.host.client.readResource(uri);
    },
    getPrompt(name, args) {
      return args !== void 0 ? opts.host.client.getPrompt(name, args) : opts.host.client.getPrompt(name);
    }
  };
}

// src/cli/commands/mcp-runtime.ts
var stderrLifecycleSink = (n) => {
  if (n.kind === "slow") {
    process.stderr.write(
      `${formatMcpSlowToast({ name: n.serverName, p95Ms: n.p95Ms, sampleSize: n.sampleSize })}
`
    );
    return;
  }
  if (n.kind === "failed") {
    process.stderr.write(
      `${formatMcpLifecycleEvent({ state: "failed", name: n.name, reason: n.reason })}
  \u2192 ${t("mcpLifecycle.failedSetupHint")}
`
    );
    return;
  }
  if (n.kind === "connected") {
    process.stderr.write(
      `${formatMcpLifecycleEvent({
        state: "connected",
        name: n.name,
        tools: n.tools,
        resources: n.resources,
        prompts: n.prompts,
        ms: n.ms
      })}
`
    );
    return;
  }
  process.stderr.write(`${formatMcpLifecycleEvent({ state: n.kind, name: n.name })}
`);
};
function createMcpRuntime(ctx) {
  const records = /* @__PURE__ */ new Map();
  const insertionOrder = [];
  let sink = stderrLifecycleSink;
  async function addSpec(raw, loop) {
    if (records.has(raw)) {
      return { ok: true, summary: records.get(raw).summary };
    }
    const tools = ctx.getTools();
    if (!tools) return { ok: false, reason: "no tool registry available" };
    const disabledNames = new Set(readConfig().mcpDisabled ?? []);
    let label = "anon";
    let mcp;
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    ready.catch(() => void 0);
    try {
      const spec = parseMcpSpec(raw);
      label = spec.name ?? "anon";
      if (spec.name && disabledNames.has(spec.name)) {
        sink({ kind: "disabled", name: label });
        rejectReady(new Error(`MCP server "${label}" is disabled`));
        return { ok: false, reason: "disabled by user" };
      }
      sink({ kind: "handshake", name: label });
      const t0 = Date.now();
      const namePrefix = spec.name ? `${spec.name}_` : ctx.getRequestedCount() === 1 && ctx.getMcpPrefix() ? ctx.getMcpPrefix() : "";
      if (spec.transport === "stdio") preflightStdioSpec(spec);
      const transport = buildTransportFromSpec(spec, { env: mcpEnvFor(spec.name, readConfig()) });
      mcp = new McpClient({ transport });
      await mcp.initialize();
      const host = { client: mcp };
      const bridge = await bridgeMcpTools(mcp, {
        registry: tools,
        namePrefix,
        serverName: label,
        host,
        ready,
        onProgress: (info) => ctx.progressSink.current?.(info),
        onSlow: (info) => sink({
          kind: "slow",
          serverName: info.serverName,
          p95Ms: info.p95Ms,
          sampleSize: info.sampleSize
        })
      });
      let report;
      try {
        report = await inspectMcpServer(mcp);
      } catch {
        report = {
          protocolVersion: mcp.protocolVersion,
          serverInfo: mcp.serverInfo,
          capabilities: mcp.serverCapabilities ?? {},
          tools: { supported: true, items: [] },
          resources: { supported: false, reason: "inspect failed" },
          prompts: { supported: false, reason: "inspect failed" },
          elapsedMs: 0
        };
      }
      const ms = Date.now() - t0;
      const resourceCount = report.resources.supported ? report.resources.items.length : 0;
      const promptCount = report.prompts.supported ? report.prompts.items.length : 0;
      sink({
        kind: "connected",
        name: label,
        tools: bridge.registeredNames.length,
        resources: resourceCount,
        prompts: promptCount,
        ms
      });
      resolveReady();
      const summary = buildMcpServerSummary({
        label,
        spec: raw,
        toolCount: bridge.registeredNames.length,
        report,
        host,
        bridgeEnv: bridge.env
      });
      const allSpecs = tools.specs();
      const registeredSpecs = allSpecs.filter(
        (s) => bridge.registeredNames.includes(s.function.name)
      );
      records.set(raw, {
        spec: raw,
        client: mcp,
        summary,
        registeredNames: bridge.registeredNames,
        registeredSpecs
      });
      insertionOrder.push(raw);
      if (loop) for (const s of registeredSpecs) loop.prefix.addTool(s);
      return { ok: true, summary };
    } catch (err) {
      await mcp?.close().catch(() => void 0);
      const reason = err.message;
      sink({ kind: "failed", name: label, reason });
      rejectReady(new Error(`MCP server "${label}" failed to start: ${reason}`));
      return { ok: false, reason };
    }
  }
  async function removeSpec(raw, loop) {
    const record = records.get(raw);
    if (!record) return false;
    await record.client.close().catch(() => void 0);
    const tools = ctx.getTools();
    for (const name of record.registeredNames) {
      tools?.unregister(name);
      loop?.prefix.removeTool(name);
    }
    records.delete(raw);
    const idx = insertionOrder.indexOf(raw);
    if (idx >= 0) insertionOrder.splice(idx, 1);
    return true;
  }
  async function reloadFromConfig(loop) {
    const desired = readConfig().mcp ?? [];
    const desiredSet = new Set(desired);
    const currentSet = new Set(records.keys());
    const added = [];
    const removed = [];
    const failed = [];
    for (const spec of [...currentSet]) {
      if (!desiredSet.has(spec)) {
        await removeSpec(spec, loop);
        removed.push(spec);
      }
    }
    for (const spec of desired) {
      if (currentSet.has(spec)) continue;
      const result = await addSpec(spec, loop);
      if (result.ok) added.push(spec);
      else failed.push({ spec, reason: result.reason });
    }
    return { added, removed, failed, summaries: summaries() };
  }
  function specs() {
    return [...insertionOrder];
  }
  function summaries() {
    return insertionOrder.map((s) => records.get(s)?.summary).filter((s) => Boolean(s));
  }
  async function closeAll() {
    for (const r of records.values()) await r.client.close().catch(() => void 0);
    records.clear();
    insertionOrder.length = 0;
  }
  function setLifecycleSink(s) {
    sink = s;
  }
  return {
    size: () => records.size,
    specs,
    summaries,
    addSpec,
    removeSpec,
    reloadFromConfig,
    closeAll,
    setLifecycleSink
  };
}

export {
  createMcpRuntime
};
//# sourceMappingURL=chunk-3Z6IBU3D.js.map