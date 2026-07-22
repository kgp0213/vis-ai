#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const READ_COMMANDS = new Set([
  "auth status",
  "contact user get-self",
  "contact user search",
  "contact dept list-members",
  "chat search",
  "chat message list",
  "chat message list-topic-replies",
  "chat message list-unread-conversations",
  "chat message list-mentions",
  "chat message list-by-sender",
  "chat message search",
  "chat message list-favorites",
  "calendar event list",
  "todo task list",
  "oa approval list-pending",
  "report inbox list",
  "report outbox list",
  "report entry get",
  "report entry stats",
  "aisearch person",
  "aisearch enterprise",
  "aisearch behavior",
  "drive recent",
  "drive search",
  "drive stats",
  "sheet table-get",
  "sheet pivot-table list",
  "wiki space list",
  "wiki space search",
  "wiki node search",
  "minutes list all",
  "minutes list mine",
  "minutes list shared",
  "minutes get info",
  "minutes get summary",
  "minutes get todos",
  "minutes get transcription",
]);

const VALUE_FLAGS = new Set([
  "--behavior-type", "--calendar-id", "--chat-scope", "--count", "--created-from", "--created-to", "--creator-type", "--cursor",
  "--depts", "--dimension", "--direction", "--end", "--extensions", "--file-types", "--group",
  "--id", "--keyword", "--limit", "--modified-end", "--modified-from", "--modified-start", "--modified-to", "--node", "--open-dingtalk-id",
  "--operate-type", "--org-ids", "--page", "--pivot-table-id", "--plan-finish-date-end", "--plan-finish-date-start", "--priority", "--profile", "--queries", "--query", "--range", "--role-types", "--sender-open-dingtalk-id", "--sender-user-id",
  "--sender-user-ids", "--sheet-id", "--size", "--start", "--status", "--target", "--template-name", "--time", "--time-range", "--topic-id",
  "--types", "--user", "--workspace",
]);

const BOOLEAN_FLAGS = new Set(["--exclude-muted", "--mock", "--no-header"]);
export const DWS_READ_LIMIT = 200;
const LIMIT_FLAGS = new Map([["--count", DWS_READ_LIMIT], ["--limit", DWS_READ_LIMIT], ["--size", DWS_READ_LIMIT]]);
const WRITE_COMMANDS = new Set(["chat message send"]);
const WRITE_VALUE_FLAGS = new Set(["--file-path", "--group", "--msg-type", "--open-dingtalk-id", "--text", "--title", "--user", "--uuid"]);
const WRITE_TARGET_FLAGS = new Set(["--group", "--open-dingtalk-id", "--user"]);
const VISIONOX_MANAGED_FLAGS = new Set(["--format", "--timeout", "--yes"]);
const MAX_EXEC_ARGS = 256;
const MAX_EXEC_ARG_CHARS = 64 * 1024;
const MAX_EXEC_TOTAL_CHARS = 1024 * 1024;

function commandPath(args) {
  const words = [];
  for (const arg of args) {
    if (arg.startsWith("-")) break;
    words.push(arg);
  }
  return words.join(" ");
}

export function isDwsReadCommand(rawArgs) {
  const args = Array.isArray(rawArgs) ? rawArgs.map((value) => String(value)) : [];
  return READ_COMMANDS.has(commandPath(args));
}

export function isDwsWriteCommand(rawArgs) {
  const args = Array.isArray(rawArgs) ? rawArgs.map((value) => String(value)) : [];
  return WRITE_COMMANDS.has(commandPath(args));
}

function normalizedExecArgs(rawArgs, { allowEmpty = false } = {}) {
  if (!Array.isArray(rawArgs)) throw new Error("DWS args must be an array");
  if (!allowEmpty && rawArgs.length === 0) throw new Error("DWS execution requires at least one argument");
  if (rawArgs.length > MAX_EXEC_ARGS) throw new Error(`DWS execution accepts at most ${MAX_EXEC_ARGS} arguments`);
  const args = rawArgs.map((value) => String(value));
  let totalChars = 0;
  for (const arg of args) {
    if (arg.includes("\0")) throw new Error("DWS arguments cannot contain NUL characters");
    if (arg.length > MAX_EXEC_ARG_CHARS) throw new Error(`DWS argument exceeds ${MAX_EXEC_ARG_CHARS} characters`);
    totalChars += arg.length;
    if (totalChars > MAX_EXEC_TOTAL_CHARS) throw new Error(`DWS arguments exceed ${MAX_EXEC_TOTAL_CHARS} total characters`);
    if (VISIONOX_MANAGED_FLAGS.has(arg.toLowerCase())) {
      throw new Error(`${arg} is managed by Visionox and cannot be supplied by the caller`);
    }
  }
  return args;
}

export function validateDwsExecArgs(rawArgs) {
  return normalizedExecArgs(rawArgs);
}

export function validateDwsHelpArgs(rawArgs) {
  const args = normalizedExecArgs(rawArgs, { allowEmpty: true });
  if (args.some((arg) => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(arg))) {
    throw new Error("DWS help accepts command segments only");
  }
  return args;
}

export function validateDwsReadArgs(rawArgs) {
  const args = Array.isArray(rawArgs) ? rawArgs.map((value) => String(value)) : [];
  const path = commandPath(args);
  if (!READ_COMMANDS.has(path)) throw new Error(`DWS command is not allowed for read-only execution: ${path || "(empty)"}`);

  for (let index = path.split(" ").length; index < args.length; index += 1) {
    const flag = args[index];
    if (BOOLEAN_FLAGS.has(flag)) continue;
    if (!VALUE_FLAGS.has(flag)) throw new Error(`DWS flag is not allowed for read-only execution: ${flag}`);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`DWS flag requires a value: ${flag}`);
    if (LIMIT_FLAGS.has(flag)) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1 || number > LIMIT_FLAGS.get(flag)) {
        throw new Error(`${flag} must be an integer from 1 to ${LIMIT_FLAGS.get(flag)}`);
      }
    }
    index += 1;
  }
  return args;
}

export function validateDwsWriteArgs(rawArgs) {
  const args = Array.isArray(rawArgs) ? rawArgs.map((value) => String(value)) : [];
  const path = commandPath(args);
  if (!WRITE_COMMANDS.has(path)) throw new Error(`DWS command is not allowed for controlled write execution: ${path || "(empty)"}`);
  const values = new Map();
  for (let index = path.split(" ").length; index < args.length; index += 2) {
    const flag = args[index];
    if (!WRITE_VALUE_FLAGS.has(flag)) throw new Error(`DWS write flag is not allowed: ${flag}`);
    const value = args[index + 1];
    if (value === undefined || value.length === 0) throw new Error(`DWS write flag requires a value: ${flag}`);
    if (values.has(flag)) throw new Error(`DWS write flag cannot be repeated: ${flag}`);
    values.set(flag, value);
  }
  const targetCount = [...WRITE_TARGET_FLAGS].filter((flag) => values.has(flag)).length;
  if (targetCount !== 1) throw new Error("DWS message send requires exactly one target: --group, --user, or --open-dingtalk-id");
  const messageType = values.get("--msg-type") || "text";
  if (!new Set(["text", "file", "audio", "video"]).has(messageType)) throw new Error(`unsupported DWS message type: ${messageType}`);
  if (messageType === "text" && !values.get("--text")?.trim()) throw new Error("DWS text message requires --text");
  if (messageType !== "text" && !values.get("--file-path")?.trim()) throw new Error(`DWS ${messageType} message requires --file-path`);
  if (!values.get("--uuid")?.trim()) throw new Error("DWS controlled write requires --uuid for idempotency");
  return args;
}

function payloadError(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload.error || payload.errorMessage || payload.errMsg || payload.message || null;
}

export function normalizeDwsResponse({ status = 0, stdout = "", stderr = "" } = {}) {
  let payload;
  try {
    payload = JSON.parse(String(stdout || "").trim());
  } catch (error) {
    return { ok: false, data: null, error: `DWS returned invalid JSON: ${error.message}`, meta: { status, stderr: String(stderr || "").trim() || null } };
  }
  const success = payload?.success;
  const hasResult = payload && typeof payload === "object" && ("result" in payload || "data" in payload || "items" in payload);
  const explicitFailure = success === false || success === "false" || (status !== 0 && success !== true && success !== "true");
  const returnedError = payloadError(payload);
  const benignError = String(payload?.errorMsg || "").toLowerCase() === "ok" && hasResult;
  const ok = status === 0 && !explicitFailure && (!returnedError || benignError || success === true || success === "true" || hasResult);
  return {
    ok,
    data: ok ? (payload.result ?? payload.data ?? payload.items ?? payload) : null,
    error: ok ? null : String(returnedError || stderr || `DWS exited with status ${status}`).trim(),
    meta: {
      status,
      requestId: payload?.requestId ?? payload?.traceId ?? null,
      hasMore: payload?.hasMore ?? payload?.result?.hasMore ?? null,
      nextCursor: payload?.nextCursor ?? payload?.result?.nextCursor ?? null,
    },
  };
}

export function normalizeDwsExecResponse({ status = 0, stdout = "", stderr = "" } = {}) {
  const output = String(stdout || "").trim();
  try {
    const normalized = normalizeDwsResponse({ status, stdout: output, stderr });
    if (!normalized.error?.startsWith("DWS returned invalid JSON:")) return { ...normalized, text: null };
  } catch {}
  const errorText = String(stderr || "").trim();
  return {
    ok: status === 0,
    data: null,
    text: output || null,
    error: status === 0 ? null : (errorText || output || `DWS exited with status ${status}`),
    meta: { status, format: "text" },
  };
}

function normalizeDwsTextResponse({ status = 0, stdout = "", stderr = "" } = {}) {
  const text = String(stdout || "").trim();
  const errorText = String(stderr || "").trim();
  return {
    ok: status === 0,
    text: text || null,
    error: status === 0 ? null : (errorText || text || `DWS exited with status ${status}`),
    meta: { status, format: "text" },
  };
}

function runDwsProcess(args, options = {}) {
  const executable = options.executable || process.env.VISIONOX_DWS_EXECUTABLE || "dws";
  const maximumTimeoutMs = Math.max(1_000, Math.min(300_000, Number(options.maximumTimeoutMs) || 60_000));
  const timeoutMs = Math.max(1_000, Math.min(maximumTimeoutMs, Number(options.timeoutMs) || 30_000));
  // Test runners may discover untracked integration tests. Keep every command
  // that can mutate DWS state local to the test process instead of relying on
  // each test to opt out. Read/help commands remain available for fixtures.
  const sideEffectDisabled = process.env.VISIONOX_TEST_MODE === "1" || process.env.DWS_SKIP_REAL_SEND === "1";
  if (sideEffectDisabled && options.sideEffect === true) {
    return Promise.resolve({
      ok: false,
      data: null,
      error: "DWS side effects are disabled in test mode",
      skipped: true,
      meta: { status: null, testMode: true, skipped: true },
    });
  }
  return new Promise((resolve) => {
    let timer;
    const outputMode = options.outputMode || "json";
    const processArgs = outputMode === "help"
      ? [...args, "--help"]
      : [...args, ...(options.confirmed ? ["--yes"] : []), "--format", "json", "--timeout", String(Math.ceil(timeoutMs / 1000))];
    const child = spawn(executable, processArgs, {
      windowsHide: true,
      shell: false,
      env: options.env || process.env,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const signal = options.signal;
    const onAbort = () => {
      child.kill();
      finish({ ok: false, data: null, error: "DWS request was cancelled", meta: { status: null, cancelled: true } });
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 8 * 1024 * 1024) {
        child.kill();
        finish({ ok: false, data: null, error: "DWS response exceeded 8 MB", meta: { status: null, outputLimit: true } });
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-1024 * 1024);
    });
    child.on("error", (error) => finish({ ok: false, data: null, error: error.message, meta: { status: null } }));
    child.on("close", (status) => {
      if (outputMode === "help") return finish(normalizeDwsTextResponse({ status, stdout, stderr }));
      if (outputMode === "flexible") return finish(normalizeDwsExecResponse({ status, stdout, stderr }));
      return finish(normalizeDwsResponse({ status, stdout, stderr }));
    });
    timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, data: null, error: `DWS request timed out after ${timeoutMs} ms`, meta: { status: null, timeout: true } });
    }, timeoutMs + 250);
  });
}

export function runDwsRead(rawArgs, options = {}) {
  return runDwsProcess(validateDwsReadArgs(rawArgs), options);
}

export function runDwsWrite(rawArgs, options = {}) {
  const args = validateDwsWriteArgs(rawArgs);
  return runDwsProcess(args, { ...options, confirmed: true, sideEffect: true, timeoutMs: options.timeoutMs || 60_000, maximumTimeoutMs: 120_000 });
}

export function runDwsHelp(rawArgs, options = {}) {
  return runDwsProcess(validateDwsHelpArgs(rawArgs), {
    ...options,
    outputMode: "help",
    timeoutMs: options.timeoutMs || 10_000,
    maximumTimeoutMs: 30_000,
  });
}

export function runDwsExec(rawArgs, options = {}) {
  return runDwsProcess(validateDwsExecArgs(rawArgs), {
    ...options,
    outputMode: "flexible",
    confirmed: true,
    sideEffect: true,
    timeoutMs: options.timeoutMs || 60_000,
    maximumTimeoutMs: 300_000,
  });
}

async function main() {
  const separator = process.argv.indexOf("--");
  const args = process.argv.slice(separator >= 0 ? separator + 1 : 2);
  try {
    const result = await runDwsRead(args);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, data: null, error: error.message, meta: { validation: true } })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  await main();
}
