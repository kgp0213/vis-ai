#!/usr/bin/env node
import {
  buildTransportFromSpec,
  preflightStdioSpec
} from "./chunk-7G3SESEU.js";
import {
  McpClient,
  inspectMcpServer,
  parseMcpSpec
} from "./chunk-SJNIIH5W.js";
import {
  mcpEnvFor,
  readConfig
} from "./chunk-SWLIVNTP.js";
import "./chunk-CRPQUBP6.js";

// src/cli/commands/mcp-inspect.ts
async function mcpInspectCommand(opts) {
  const spec = parseMcpSpec(opts.spec);
  if (spec.transport === "stdio") preflightStdioSpec(spec);
  const transport = buildTransportFromSpec(spec, { env: mcpEnvFor(spec.name, readConfig()) });
  const client = new McpClient({ transport });
  try {
    await client.initialize();
    const report = await inspectMcpServer(client);
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatReport(spec.name ?? "(anon)", report));
    }
  } finally {
    await client.close();
  }
}
function formatMcpInspectFailure(err) {
  const error = err instanceof Error ? err : new Error(String(err));
  const message = error.message;
  const code = error.code;
  if (code === "ENOENT") {
    const command = message.match(/^spawn\s+([^\s]+)\s+ENOENT$/)?.[1] ?? "the command";
    return `${message} \u2014 try: install or verify \`${command}\`, then check the MCP spec's command spelling`;
  }
  if (code === "ECONNREFUSED") {
    const target = message.match(/\b(https?:\/\/\S+|\d+\.\d+\.\d+\.\d+:\d+|localhost:\d+)\b/i)?.[1];
    return `${message} \u2014 try: confirm ${target ?? "the MCP server"} is running and the host/port match the spec`;
  }
  if (/^MCP request initialize \(id=\d+\) timed out after \d+ms$/.test(message)) {
    return `${message} \u2014 try: confirm the target speaks MCP and completes the handshake before the request timeout`;
  }
  if (/^(empty MCP spec|MCP spec ".*" has name but no command)/.test(message)) {
    return `${message} \u2014 try: pass \`name=command args\` or an http(s):// URL`;
  }
  return message;
}
function formatReport(nsName, r) {
  const lines = [];
  lines.push(`MCP server [${nsName}]`);
  lines.push(
    `  server     ${r.serverInfo.name || "(unknown)"}${r.serverInfo.version ? ` v${r.serverInfo.version}` : ""}`
  );
  lines.push(`  protocol   ${r.protocolVersion}`);
  const capKeys = Object.keys(r.capabilities);
  lines.push(`  caps       ${capKeys.length > 0 ? capKeys.join(", ") : "(none advertised)"}`);
  if (r.instructions) {
    lines.push(`  notes      ${r.instructions.trim().slice(0, 200)}`);
  }
  lines.push("");
  lines.push(formatSection("Tools", r.tools, toolLine));
  lines.push(formatSection("Resources", r.resources, resourceLine));
  lines.push(formatSection("Prompts", r.prompts, promptLine));
  return lines.join("\n");
}
function formatSection(title, section, render) {
  if (!section.supported) {
    return `${title}: (not supported \u2014 ${section.reason})`;
  }
  if (section.items.length === 0) {
    return `${title}: (none)`;
  }
  const lines = [`${title} (${section.items.length}):`];
  for (const item of section.items) lines.push(`  ${render(item)}`);
  return lines.join("\n");
}
function toolLine(t) {
  const desc = t.description ? ` \u2014 ${oneLine(t.description, 80)}` : "";
  return `\xB7 ${t.name}${desc}`;
}
function resourceLine(r) {
  const mime = r.mimeType ? ` [${r.mimeType}]` : "";
  return `\xB7 ${r.name}${mime}  ${r.uri}`;
}
function promptLine(p) {
  const argPart = p.arguments && p.arguments.length > 0 ? ` (${p.arguments.map((a) => a.required ? a.name : `${a.name}?`).join(", ")})` : "";
  const desc = p.description ? ` \u2014 ${oneLine(p.description, 80)}` : "";
  return `\xB7 ${p.name}${argPart}${desc}`;
}
function oneLine(s, max) {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}\u2026`;
}
export {
  formatMcpInspectFailure,
  mcpInspectCommand
};
//# sourceMappingURL=mcp-inspect-XWBO52H6.js.map