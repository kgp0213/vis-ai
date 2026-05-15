#!/usr/bin/env node
import {
  formatMcpLifecycleEvent,
  formatMcpSlowToast
} from "./chunk-LTXADNCO.js";
import {
  buildTransportFromSpec,
  preflightStdioSpec
} from "./chunk-BOFL3T45.js";
import {
  CacheFirstLoop,
  ImmutablePrefix,
  ToolRegistry,
  bridgeMcpTools
} from "./chunk-IEA6JOIP.js";
import "./chunk-VFG4GIT3.js";
import {
  openTranscriptFile,
  recordFromLoopEvent,
  writeRecord
} from "./chunk-7SPOFTMT.js";
import {
  McpClient,
  parseMcpSpec
} from "./chunk-CFY2XLY6.js";
import "./chunk-ARF3N2SY.js";
import "./chunk-DAEAAVDF.js";
import {
  DeepSeekClient
} from "./chunk-H4OLWRSX.js";
import {
  loadDotenv
} from "./chunk-3Q3C4W66.js";
import "./chunk-BYZGO3BX.js";
import "./chunk-CD4SCQL4.js";
import "./chunk-WE3YZULK.js";
import "./chunk-5X7LZJDE.js";
import "./chunk-YJFKFTAL.js";
import "./chunk-MHGPBJ2T.js";
import {
  defaultConfigPath,
  isPlausibleKey,
  loadApiKey,
  loadBaseUrl,
  mcpEnvFor,
  readConfig,
  saveApiKey
} from "./chunk-65Q5HQ26.js";
import {
  appendUsage
} from "./chunk-ZTLZO42A.js";
import "./chunk-ORM6PK57.js";
import "./chunk-CRPQUBP6.js";

// src/cli/commands/run.ts
import { stdin, stdout } from "process";
import { createInterface } from "readline/promises";
async function ensureApiKey() {
  const existing = loadApiKey();
  if (existing) return existing;
  if (!stdin.isTTY) {
    process.stderr.write(
      "DEEPSEEK_API_KEY is not set and stdin is not a TTY (cannot prompt).\nSet the env var, or run `reasonix chat` once interactively to save a key.\n"
    );
    process.exit(1);
  }
  process.stdout.write(
    "DeepSeek API key not configured.\nGet one at https://platform.deepseek.com/api_keys\n"
  );
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    while (true) {
      const answer = (await rl.question("API key \u203A ")).trim();
      if (!answer) continue;
      if (!isPlausibleKey(answer)) {
        process.stdout.write("Key looks too short. Paste the full token (16+ chars, no spaces).\n");
        continue;
      }
      saveApiKey(answer);
      process.stdout.write(`Saved to ${defaultConfigPath()}

`);
      return answer;
    }
  } finally {
    rl.close();
  }
}
async function runCommand(opts) {
  loadDotenv();
  const apiKey = await ensureApiKey();
  process.env.DEEPSEEK_API_KEY = apiKey;
  const requestedSpecs = opts.mcp ?? [];
  const clients = [];
  let tools;
  let successCount = 0;
  const disabledNames = new Set(readConfig().mcpDisabled ?? []);
  if (requestedSpecs.length > 0) {
    tools = new ToolRegistry();
    for (const raw of requestedSpecs) {
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
        const prefix2 = spec.name ? `${spec.name}_` : requestedSpecs.length === 1 && opts.mcpPrefix ? opts.mcpPrefix : "";
        if (spec.transport === "stdio") preflightStdioSpec(spec);
        const transport = buildTransportFromSpec(spec, {
          env: mcpEnvFor(spec.name, readConfig())
        });
        mcp = new McpClient({ transport });
        await mcp.initialize();
        const bridge = await bridgeMcpTools(mcp, {
          registry: tools,
          namePrefix: prefix2,
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
        successCount++;
      } catch (err) {
        await mcp?.close().catch(() => void 0);
        process.stderr.write(
          `${formatMcpLifecycleEvent({ state: "failed", name: label, reason: err.message })}
  \u2192 run \`reasonix setup\` to remove broken entries from your saved config.
`
        );
      }
    }
    if (successCount === 0) tools = void 0;
  }
  const client = new DeepSeekClient({ baseUrl: loadBaseUrl() });
  const prefix = new ImmutablePrefix({
    system: opts.system,
    toolSpecs: tools?.specs()
  });
  const loop = new CacheFirstLoop({
    client,
    prefix,
    tools,
    model: opts.model,
    budgetUsd: opts.budgetUsd,
    failureThreshold: opts.failureThreshold
  });
  const prefixHash = prefix.fingerprint;
  let transcriptStream = null;
  if (opts.transcript) {
    transcriptStream = openTranscriptFile(opts.transcript, {
      version: 1,
      source: "reasonix run",
      model: opts.model,
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    writeRecord(transcriptStream, {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      turn: 1,
      role: "user",
      content: opts.task
    });
  }
  try {
    for await (const ev of loop.step(opts.task)) {
      if (ev.role === "assistant_delta" && ev.content) process.stdout.write(ev.content);
      if (ev.role === "tool") process.stdout.write(`
[tool ${ev.toolName}] ${ev.content}
`);
      if (ev.role === "error") process.stderr.write(`
[error] ${ev.error}
`);
      if (ev.role === "done") process.stdout.write("\n");
      if (ev.role === "assistant_final" && ev.stats?.usage) {
        appendUsage({ session: null, model: ev.stats.model, usage: ev.stats.usage });
      }
      if (transcriptStream && ev.role !== "assistant_delta") {
        writeRecord(transcriptStream, recordFromLoopEvent(ev, { model: opts.model, prefixHash }));
      }
    }
  } finally {
    transcriptStream?.end();
  }
  const s = loop.stats.summary();
  process.stdout.write(
    `
\u2014 turns:${s.turns} cache:${(s.cacheHitRatio * 100).toFixed(1)}% cost:$${s.totalCostUsd.toFixed(6)} save-vs-claude:${s.savingsVsClaudePct.toFixed(1)}%
`
  );
  if (opts.transcript) {
    process.stdout.write(`
transcript: ${opts.transcript}
`);
    process.stdout.write(`  \u2192 npx reasonix replay ${opts.transcript}
`);
  }
  for (const c of clients) await c.close();
}
export {
  runCommand
};
//# sourceMappingURL=run-BLZPTRDX.js.map