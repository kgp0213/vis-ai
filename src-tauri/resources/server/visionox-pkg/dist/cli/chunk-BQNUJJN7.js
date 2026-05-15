#!/usr/bin/env node

// src/cli/ui/mcp-lifecycle.ts
var STATE = {
  handshake: { glyph: "\u21BB", label: "handshake\u2026" },
  connected: { glyph: "\u2713", label: "connected" },
  failed: { glyph: "\u2716", label: "failed" },
  disabled: { glyph: "\u25CB", label: "disabled" },
  reconnect: { glyph: "\u21BB", label: "reconnect\u2026" }
};
var NAME_COL = 22;
var STATE_COL = 15;
function formatMcpLifecycleEvent(ev) {
  const { glyph, label } = STATE[ev.state];
  const namePart = `MCP \xB7 ${ev.name}`;
  const namePad = " ".repeat(Math.max(1, NAME_COL - namePart.length));
  const stateField = `${glyph} ${label}`.padEnd(STATE_COL);
  return `\u2318 ${namePart}${namePad}${stateField}${describeDetail(ev)}`;
}
function describeDetail(ev) {
  if (ev.state === "handshake") return "initialise \u2192 tools/list \u2192 resources/list";
  if (ev.state === "failed") return ev.reason;
  if (ev.state === "disabled") return `via /mcp disable ${ev.name}`;
  if (ev.state === "reconnect") return "tearing down \xB7 re-handshake \xB7 listing tools";
  const parts = [`${ev.tools} tools`];
  if (ev.resources && ev.resources > 0) parts.push(`${ev.resources} resources`);
  if (ev.prompts && ev.prompts > 0) parts.push(`${ev.prompts} prompts`);
  parts.push(`${ev.ms}ms`);
  return parts.join(" \xB7 ");
}

// src/cli/ui/mcp-toast.ts
function formatMcpSlowToast(t) {
  const seconds = (t.p95Ms / 1e3).toFixed(1);
  return `\u26A0 MCP \`${t.name}\` slow \xB7 ${seconds}s p95 over the last ${t.sampleSize} calls`;
}

export {
  formatMcpLifecycleEvent,
  formatMcpSlowToast
};
//# sourceMappingURL=chunk-BQNUJJN7.js.map