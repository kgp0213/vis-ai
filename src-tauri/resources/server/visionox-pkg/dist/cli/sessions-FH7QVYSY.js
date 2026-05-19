#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import "./chunk-2R4QCDOZ.js";
import "./chunk-F3PXYSNN.js";
import "./chunk-FHOGSSCH.js";
import "./chunk-6AK4EY3D.js";
import "./chunk-5JJRUIPA.js";
import "./chunk-PV55UMTO.js";
import "./chunk-2KDUS647.js";
import "./chunk-25T6CVUP.js";
import "./chunk-2UQP6H6T.js";
import "./chunk-O52OLQL3.js";
import "./chunk-2K65GZBT.js";
import "./chunk-7O5ALB4C.js";
import "./chunk-S4XVGLRW.js";
import {
  listSessions,
  loadSessionMessages,
  sessionPath
} from "./chunk-6PBZN4VI.js";
import "./chunk-RE4RAVFF.js";
import "./chunk-XPDVG52A.js";
import "./chunk-HFEAY5DT.js";
import "./chunk-YQ6NTIIE.js";
import "./chunk-XXC2BYTV.js";
import "./chunk-TUK7OWJA.js";

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
//# sourceMappingURL=sessions-FH7QVYSY.js.map