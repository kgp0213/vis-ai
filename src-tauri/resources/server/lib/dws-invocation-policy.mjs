import { isDwsReadCommand, isDwsWriteCommand } from "../../bootstrap-skills/dws/scripts/dws-json.mjs";

const SHELL_TOOLS = new Set(["run_command", "run_background"]);
const WINDOWS_ABSOLUTE_DWS = /(?:[a-z]:[\\/]|\\\\)[^"'`\r\n|;&<>]*?dws\.exe/gi;
const DWS_ALIAS = /\$env:VISIONOX_DWS_EXECUTABLE|%VISIONOX_DWS_EXECUTABLE%|\bdws(?:\.exe)?\b/gi;

function normalizedPath(value) {
  return String(value ?? "").trim().replaceAll("/", "\\").toLowerCase();
}

function invocationTail(command, absoluteMatches) {
  const candidates = [...absoluteMatches];
  for (const match of command.matchAll(DWS_ALIAS)) candidates.push(match);
  candidates.sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  const invocation = candidates[0];
  if (!invocation) return null;
  return command.slice((invocation.index ?? 0) + invocation[0].length).replace(/^['"]/, "").trim();
}

export function validateDwsInvocation(toolName, args, options = {}) {
  if (!SHELL_TOOLS.has(String(toolName).toLowerCase())) return null;
  const command = String(args?.command ?? "").trim();
  if (!command) return null;

  const bundledExecutable = normalizedPath(options.bundledExecutable);
  const absoluteMatches = [...command.matchAll(WINDOWS_ABSOLUTE_DWS)];
  const externalPath = absoluteMatches
    .map((match) => match[0])
    .find((path) => normalizedPath(path) !== bundledExecutable);
  if (externalPath) {
    return {
      code: "dws-external-executable",
      error: "DWS must run from the Visionox-Whale packaged resource tree. Project, download, and historical absolute paths are not allowed.",
      suggestion: "Use dws_read for read operations. For help or a user-confirmed write, invoke the bundled dws from PATH and never reuse an absolute path from conversation history.",
    };
  }

  const tail = invocationTail(command, absoluteMatches);
  if (tail === null) return null;
  if (/(?:^|\s)--help(?:\s|$)/i.test(tail)) {
    return {
      code: "dws-help-use-tool",
      error: "DWS help discovery must use the packaged dws_help tool instead of shell execution.",
      suggestion: "Call dws_help with command segments, then use dws_read, dws_write, or dws_exec as appropriate.",
    };
  }
  const commandWords = tail.split(/\s+/).filter(Boolean);
  if (isDwsReadCommand(commandWords)) {
    return {
      code: "dws-read-use-tool",
      error: "Read-only DWS queries must use the controlled dws_read tool instead of shell execution.",
      suggestion: "Call dws_read with a limit up to 200 and continue with cursor/time pagination when meta.hasMore is true.",
    };
  }
  if (isDwsWriteCommand(commandWords)) {
    return {
      code: "dws-write-use-tool",
      error: "Supported DWS write actions must use dws_write so Visionox can present an action-specific confirmation card.",
      suggestion: "Call dws_write with action=send_message, the resolved target, and the exact content. The tool asks the user before sending.",
    };
  }
  return {
    code: "dws-exec-use-tool",
    error: "DWS commands must use the controlled dws_exec tool instead of shell execution.",
    suggestion: "Use dws_help to verify the current syntax, then call dws_exec. Future DWS business commands are accepted after user confirmation.",
  };
}
