#!/usr/bin/env node
import "./chunk-IEA6JOIP.js";
import "./chunk-VFG4GIT3.js";
import "./chunk-7SPOFTMT.js";
import "./chunk-CFY2XLY6.js";
import "./chunk-ARF3N2SY.js";
import "./chunk-DAEAAVDF.js";
import "./chunk-H4OLWRSX.js";
import "./chunk-3Q3C4W66.js";
import "./chunk-BYZGO3BX.js";
import "./chunk-CD4SCQL4.js";
import "./chunk-WE3YZULK.js";
import "./chunk-5X7LZJDE.js";
import {
  listSessions,
  loadSessionMessages,
  sessionPath
} from "./chunk-YJFKFTAL.js";
import "./chunk-MHGPBJ2T.js";
import "./chunk-65Q5HQ26.js";
import "./chunk-ZTLZO42A.js";
import "./chunk-ORM6PK57.js";
import "./chunk-CRPQUBP6.js";

// src/cli/commands/sessions.ts
function sessionsCommand(opts) {
  if (opts.name) {
    inspectSession(opts.name, !!opts.verbose);
  } else {
    listAll();
  }
}
function listAll() {
  const items = listSessions();
  if (items.length === 0) {
    console.log(
      "no saved sessions yet \u2014 run `reasonix chat` (sessions are auto-saved unless --no-session)."
    );
    return;
  }
  console.log("Saved sessions (~/.reasonix/sessions/):");
  console.log("");
  console.log(`  ${"name".padEnd(22)} ${"msgs".padStart(6)}  ${"size".padStart(8)}  modified`);
  console.log(`  ${"\u2500".repeat(60)}`);
  for (const s of items) {
    const sizeKb = `${(s.size / 1024).toFixed(1)} KB`;
    const when = s.mtime.toISOString().replace("T", " ").slice(0, 16);
    console.log(
      `  ${s.name.padEnd(22)} ${String(s.messageCount).padStart(6)}  ${sizeKb.padStart(8)}  ${when}`
    );
  }
  console.log("");
  console.log("Inspect:  reasonix sessions <name>");
  console.log("Resume:   reasonix chat --session <name>");
}
function inspectSession(name, verbose) {
  const path = sessionPath(name);
  const messages = loadSessionMessages(name);
  if (messages.length === 0) {
    console.error(`no session named "${name}" (or it's empty).`);
    console.error(`looked at: ${path}`);
    process.exit(1);
  }
  console.log(`[session] ${name}   ${messages.length} messages   ${path}`);
  console.log("");
  let turnIndex = 0;
  for (const msg of messages) {
    renderMessage(msg, turnIndex, verbose);
    if (msg.role === "user") turnIndex++;
  }
}
function renderMessage(msg, turnIdx, verbose) {
  const turn = turnIdx > 0 ? `[t${turnIdx}]` : "[start]";
  const content = typeof msg.content === "string" ? msg.content : "";
  const flat = oneLine(content);
  if (msg.role === "user") {
    console.log(`${turn} USER: ${flat}`);
  } else if (msg.role === "assistant") {
    console.log(`${turn} AGENT: ${flat || "(tool call only)"}`);
    if (verbose && msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        console.log(
          `         \u2192 call ${tc.function?.name} ${truncate(tc.function?.arguments ?? "", 80)}`
        );
      }
    }
  } else if (msg.role === "tool") {
    console.log(`${turn} TOOL ${msg.name ?? "?"}: ${truncate(flat, 160)}`);
  } else if (msg.role === "system") {
    if (verbose) console.log(`${turn} SYSTEM: ${truncate(flat, 160)}`);
  }
}
function oneLine(s, max = 200) {
  const collapsed = s.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}\u2026` : collapsed;
}
function truncate(s, max) {
  return s.length <= max ? s : `${s.slice(0, max)}\u2026`;
}
export {
  sessionsCommand
};
//# sourceMappingURL=sessions-BOWFPTXT.js.map