#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  addProjectShellAllowed
} from "./chunk-XPDVG52A.js";

// src/core/pause-gate.ts
var PauseGate = class {
  _nextId = 0;
  _pending = /* @__PURE__ */ new Map();
  _listeners = /* @__PURE__ */ new Set();
  _auditListener = null;
  /** Block until the user responds. Takes a named options object so the
   *  kind and payload fields don't get confused at the call site. */
  ask(opts) {
    const { kind, payload } = opts;
    if (this._listeners.size === 0) {
      throw new Error(
        `${kind}: no confirmation listener registered \u2014 cannot prompt the user. This tool can only be used inside an interactive Visionox session.`
      );
    }
    return new Promise((resolve4) => {
      const id = this._nextId++;
      const request = { id, kind, payload };
      this._pending.set(id, { resolve: resolve4, request });
      for (const fn of this._listeners) {
        try {
          fn(request);
        } catch {
        }
      }
    });
  }
  /** Resolve a pending request. Called by the App's modal callback. */
  resolve(id, data) {
    const p = this._pending.get(id);
    if (!p) return;
    this._pending.delete(id);
    this.emitAuditEvent(p.request, data);
    p.resolve(data);
  }
  /** Safe-cancel every outstanding request — frees stranded tool fns on Esc / /new. */
  cancelAll() {
    const ids = [...this._pending.keys()];
    for (const id of ids) {
      const p = this._pending.get(id);
      if (!p) continue;
      this._pending.delete(id);
      p.resolve(safeCancelVerdict(p.request.kind));
    }
  }
  /** Cancel one pending request — used by multi-tab hosts that need per-scope abort. */
  cancel(id) {
    const p = this._pending.get(id);
    if (!p) return false;
    this._pending.delete(id);
    p.resolve(safeCancelVerdict(p.request.kind));
    return true;
  }
  setAuditListener(fn) {
    this._auditListener = fn;
  }
  /** Subscribe to new pause requests. Returns an unsubscribe function. */
  on(fn) {
    this._listeners.add(fn);
    return () => {
      this._listeners.delete(fn);
    };
  }
  /** Current pending request, if any (polling fallback). */
  get current() {
    for (const [, p] of this._pending) return p.request;
    return null;
  }
  emitAuditEvent(request, data) {
    if (!this._auditListener) return;
    if (request.kind !== "run_command" && request.kind !== "run_background") return;
    if (!data || typeof data !== "object") return;
    const choice = data;
    try {
      switch (choice.type) {
        case "run_once":
          this._auditListener({
            type: "tool.confirm.allow",
            kind: request.kind,
            payload: request.payload
          });
          break;
        case "deny":
          this._auditListener({
            type: "tool.confirm.deny",
            kind: request.kind,
            payload: request.payload,
            denyContext: choice.denyContext
          });
          break;
        case "always_allow":
          if (typeof choice.prefix !== "string") return;
          this._auditListener({
            type: "tool.confirm.always_allow",
            kind: request.kind,
            payload: request.payload,
            prefix: choice.prefix
          });
          break;
        default:
          break;
      }
    } catch {
    }
  }
};
function safeCancelVerdict(kind) {
  switch (kind) {
    case "run_command":
    case "run_background":
    case "path_access":
      return { type: "deny" };
    case "plan_proposed":
      return { type: "cancel" };
    case "plan_checkpoint":
      return { type: "stop" };
    case "plan_revision":
      return { type: "cancelled" };
    case "choice":
      return { type: "cancel" };
  }
}
var pauseGate = new PauseGate();

// src/tools/jobs.ts
import { spawn as spawn3 } from "child_process";
import * as pathMod4 from "path";

// src/tools/shell.ts
import * as pathMod3 from "path";

// src/tools/shell/exec.ts
import { spawn as spawn2 } from "child_process";
import { existsSync, statSync } from "fs";
import * as pathMod2 from "path";

// src/tools/shell-chain.ts
import { spawn } from "child_process";
import { appendFileSync, closeSync, constants, lstatSync, mkdirSync, openSync, realpathSync, writeFileSync } from "fs";
import { devNull } from "os";
import * as pathMod from "path";
var UnsupportedSyntaxError = class extends Error {
  constructor(detail) {
    super(`run_command: ${detail}`);
    this.name = "UnsupportedSyntaxError";
  }
};
function splitOnChainOps(cmd) {
  const segs = [];
  const ops = [];
  let segStart = 0;
  let i = 0;
  let quote = null;
  let atTokenStart = true;
  while (i < cmd.length) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (quote === '"' && isDqEscape(ch, cmd[i + 1])) i++;
      i++;
      atTokenStart = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      i++;
      atTokenStart = false;
      continue;
    }
    if (ch === " " || ch === "	") {
      i++;
      atTokenStart = true;
      continue;
    }
    if (atTokenStart) {
      let op = null;
      let opLen = 0;
      const next = cmd[i + 1];
      if (ch === "|" && next === "|") {
        op = "||";
        opLen = 2;
      } else if (ch === "&" && next === "&") {
        op = "&&";
        opLen = 2;
      } else if (ch === "|") {
        op = "|";
        opLen = 1;
      } else if (ch === ";") {
        op = ";";
        opLen = 1;
      }
      if (op !== null) {
        segs.push(cmd.slice(segStart, i));
        ops.push(op);
        i += opLen;
        segStart = i;
        atTokenStart = true;
        continue;
      }
    }
    i++;
    atTokenStart = false;
  }
  segs.push(cmd.slice(segStart));
  return { segs, ops };
}
function parseSegment(segStr) {
  const argv = [];
  const redirects = [];
  let cur = "";
  let curHasContent = false;
  let pending = null;
  let quote = null;
  const flush = () => {
    if (!curHasContent && cur.length === 0) return;
    if (pending) {
      redirects.push({ kind: pending, target: cur });
      pending = null;
    } else {
      argv.push(cur);
    }
    cur = "";
    curHasContent = false;
  };
  let i = 0;
  while (i < segStr.length) {
    const ch = segStr[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (quote === '"' && isDqEscape(ch, segStr[i + 1])) {
        cur += segStr[++i] ?? "";
        curHasContent = true;
      } else {
        cur += ch;
        curHasContent = true;
      }
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      curHasContent = true;
      i++;
      continue;
    }
    if (ch === " " || ch === "	") {
      flush();
      i++;
      continue;
    }
    if (cur.length === 0 && !curHasContent) {
      const remaining = segStr.slice(i);
      let matched = null;
      if (remaining.startsWith("2>&1")) matched = { op: "2>&1", len: 4 };
      else if (remaining.startsWith("&>")) matched = { op: "&>", len: 2 };
      else if (remaining.startsWith("2>>")) matched = { op: "2>>", len: 3 };
      else if (remaining.startsWith("2>")) matched = { op: "2>", len: 2 };
      else if (remaining.startsWith(">>")) matched = { op: ">>", len: 2 };
      else if (remaining.startsWith(">")) matched = { op: ">", len: 1 };
      else if (remaining.startsWith("<<")) {
        throw new UnsupportedSyntaxError(
          `shell operator "<<" is not supported \u2014 heredoc / here-string is not implemented; pass input via a "<" file or the binary's --input flag`
        );
      } else if (remaining.startsWith("<")) matched = { op: "<", len: 1 };
      if (matched) {
        if (pending !== null) {
          throw new UnsupportedSyntaxError(
            `redirect "${pending}" is missing a target file before "${matched.op}"`
          );
        }
        if (matched.op === "2>&1") {
          redirects.push({ kind: "2>&1", target: "" });
        } else {
          pending = matched.op;
        }
        i += matched.len;
        continue;
      }
      if (ch === "&") {
        throw new UnsupportedSyntaxError(
          'shell operator "&" is not supported \u2014 background runs need run_background, not run_command. Wrap a literal `&` arg in quotes.'
        );
      }
    }
    cur += ch;
    curHasContent = true;
    i++;
  }
  if (quote) throw new Error(`unclosed ${quote} in command`);
  flush();
  if (pending) throw new UnsupportedSyntaxError(`redirect "${pending}" is missing a target file`);
  if (argv.length === 0 && redirects.length > 0) {
    throw new UnsupportedSyntaxError(
      "redirect without a command \u2014 segment must have at least one program argument"
    );
  }
  validateRedirectFds(redirects);
  return { argv, redirects };
}
function validateRedirectFds(redirects) {
  let stdin = 0;
  let stdout = 0;
  let stderr = 0;
  for (const r of redirects) {
    if (r.kind === "<") stdin++;
    else if (r.kind === ">" || r.kind === ">>") stdout++;
    else if (r.kind === "2>" || r.kind === "2>>" || r.kind === "2>&1") stderr++;
    else if (r.kind === "&>") {
      stdout++;
      stderr++;
    }
  }
  if (stdin > 1) throw new UnsupportedSyntaxError("multiple `<` stdin redirects in one segment");
  if (stdout > 1)
    throw new UnsupportedSyntaxError(
      "multiple stdout redirects in one segment (`>` / `>>` / `&>` conflict)"
    );
  if (stderr > 1)
    throw new UnsupportedSyntaxError(
      "multiple stderr redirects in one segment (`2>` / `2>>` / `&>` / `2>&1` conflict)"
    );
}
function redirectTargets(cmd) {
  try {
    const chain = parseCommandChain(cmd);
    if (!chain) return [];
    const targets = [];
    for (const seg of chain.segments) {
      for (const r of seg.redirects) {
        if (r.kind !== "2>&1") targets.push(r.target);
      }
    }
    return targets;
  } catch {
    return [];
  }
}
function redirectsEscapeSandbox(cmd, projectRoot) {
  if (!projectRoot) return false;
  const targets = redirectTargets(cmd);
  if (targets.length === 0) return false;
  const absRoot = pathMod.resolve(projectRoot);
  for (const t of targets) {
    if (isNullDeviceAlias(t)) continue;
    const resolved = pathMod.resolve(t);
    if (!pathIsUnder(resolved, absRoot)) return true;
  }
  return false;
}
function parseCommandChain(cmd) {
  const { segs, ops } = splitOnChainOps(cmd);
  const segments = [];
  for (let i = 0; i < segs.length; i++) {
    const trimmed = segs[i].trim();
    if (trimmed.length === 0) {
      const op = i === 0 ? ops[0] : ops[i - 1];
      throw new UnsupportedSyntaxError(
        i === 0 ? `empty segment before "${op}"` : i === segs.length - 1 ? `chain ends with "${op}"` : `empty segment between "${ops[i - 1]}" and "${ops[i]}"`
      );
    }
    segments.push(parseSegment(trimmed));
  }
  for (const seg of segments) {
    const cmdName = seg.argv[0] ?? "";
    if (cmdName.toLowerCase() === "cd") {
      throw new UnsupportedSyntaxError(
        "cd in parsed command chains does not change cwd for later segments. Use a command-native cwd flag instead, such as `npm --prefix <dir> run <script>`, `git -C <dir> ...`, or `cargo -C <dir> ...`."
      );
    }
  }
  if (ops.length === 0 && segments[0].redirects.length === 0) return null;
  return { segments, ops };
}
function chainAllowed(chain, isAllowed2) {
  for (const seg of chain.segments) {
    if (!isAllowed2(seg.argv.join(" "))) return false;
  }
  return true;
}
function groupChain(chain) {
  const groups = [{ segments: [chain.segments[0]], opBefore: null }];
  for (let i = 0; i < chain.ops.length; i++) {
    const op = chain.ops[i];
    const next = chain.segments[i + 1];
    if (op === "|") {
      groups[groups.length - 1].segments.push(next);
    } else {
      groups.push({ segments: [next], opBefore: op });
    }
  }
  return groups;
}
async function runChain(chain, opts) {
  const groups = groupChain(chain);
  const buf = new OutputBuffer(opts.maxOutputChars * 2 * 4, { outputResourceDir: opts.outputResourceDir, spillThresholdBytes: opts.maxOutputChars });
  const deadline = Date.now() + opts.timeoutSec * 1e3;
  let lastExit = 0;
  let timedOut = false;
  for (const group of groups) {
    if (group.opBefore === "&&" && lastExit !== 0) continue;
    if (group.opBefore === "||" && lastExit === 0) continue;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      timedOut = true;
      break;
    }
    const result = await runPipeGroup(group.segments, {
      cwd: opts.cwd,
      timeoutMs: remainingMs,
      buf,
      signal: opts.signal,
      projectRoot: opts.projectRoot,
      env: opts.env
    });
    lastExit = result.exitCode;
    if (result.timedOut) {
      timedOut = true;
      break;
    }
    if (opts.signal?.aborted) break;
  }
  const output = buf.toString();
  const truncated = truncateCommandOutput(output, opts.maxOutputChars);
  return { exitCode: lastExit, output: truncated, timedOut, outputResource: buf.outputResource() };
}
function isNullDeviceAlias(target) {
  const lower = target.toLowerCase();
  if (lower === "/dev/null") return true;
  if (process.platform === "win32" && lower === "nul") return true;
  return false;
}
function pathIsUnder(child, parent) {
  const rel = pathMod.relative(parent, child);
  if (!rel) return true;
  if (rel.startsWith("..")) return false;
  if (pathMod.isAbsolute(rel)) return false;
  return true;
}
function openFlags(target, flags) {
  if (isNullDeviceAlias(target)) return "r" === flags ? constants.O_RDONLY : constants.O_WRONLY | constants.O_CREAT | ("a" === flags ? constants.O_APPEND : constants.O_TRUNC);
  let numeric = "r" === flags ? constants.O_RDONLY : constants.O_WRONLY | constants.O_CREAT | ("a" === flags ? constants.O_APPEND : constants.O_TRUNC);
  numeric |= constants.O_NOFOLLOW;
  return numeric;
}
function ensureUnderSandbox(target, projectRoot) {
  if (!projectRoot) return target;
  const resolved = pathMod.resolve(target);
  if (!pathIsUnder(resolved, pathMod.resolve(projectRoot))) {
    throw new Error(`run_command: redirect target "${target}" escapes the project sandbox (${projectRoot})`);
  }
  return resolved;
}
function resolveRedirectTarget(target, cwd, projectRoot) {
  if (isNullDeviceAlias(target)) return target;
  const candidate = pathMod.resolve(cwd, target);
  let resolved;
  try {
    resolved = realpathSync(candidate);
  } catch {
    resolved = candidate;
  }
  if (projectRoot) {
    const absRoot = pathMod.resolve(projectRoot);
    const absTarget = pathMod.resolve(resolved);
    if (!pathIsUnder(absTarget, absRoot)) {
      throw new Error(`run_command: redirect target "${target}" resolves to "${resolved}" which escapes the project sandbox (${projectRoot})`);
    }
  }
  return resolved;
}
function validateRedirectTargets(redirects, cwd, projectRoot) {
  for (const r of redirects) {
    if (r.kind === "2>&1") continue;
    resolveRedirectTarget(r.target, cwd, projectRoot);
  }
}
function openRedirects(redirects, cwd, projectRoot) {
  let stdinFd = null;
  let stdoutFd = null;
  let stderrFd = null;
  let mergeStderrToStdout = false;
  let bothFd = null;
  const toClose = [];
  validateRedirectTargets(redirects, cwd, projectRoot);
  const open = (target, flags) => {
    const resolved = isNullDeviceAlias(target) ? devNull : resolveRedirectTarget(target, cwd, projectRoot);
    const fd = openSync(resolved, openFlags(target, flags));
    toClose.push(fd);
    return fd;
  };
  for (const r of redirects) {
    if (r.kind === "<") stdinFd = open(r.target, "r");
    else if (r.kind === ">") stdoutFd = open(r.target, "w");
    else if (r.kind === ">>") stdoutFd = open(r.target, "a");
    else if (r.kind === "2>") stderrFd = open(r.target, "w");
    else if (r.kind === "2>>") stderrFd = open(r.target, "a");
    else if (r.kind === "&>") {
      bothFd = open(r.target, "w");
      stdoutFd = bothFd;
      stderrFd = bothFd;
    } else if (r.kind === "2>&1") {
      mergeStderrToStdout = true;
    }
  }
  return { stdinFd, stdoutFd, stderrFd, mergeStderrToStdout, toClose };
}
async function runPipeGroup(segments, opts) {
  if (opts.signal?.aborted) {
    throw new DOMException("command cancelled", "AbortError");
  }
  const env = { ...process.env, ...(opts.env ?? {}), PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" };
  const children = [];
  const allFds = [];
  let timedOut = false;
  const killAll = () => {
    for (const c of children) killProcessTree(c);
  };
  const killTimer = setTimeout(() => {
    timedOut = true;
    killAll();
  }, opts.timeoutMs);
  const onAbort = () => killAll();
  if (opts.signal?.aborted) {
    onAbort();
  } else {
    opts.signal?.addEventListener("abort", onAbort, { once: true });
  }
  try {
    for (let i = 0; i < segments.length; i++) {
      if (opts.signal?.aborted) {
        throw new DOMException("command cancelled", "AbortError");
      }
      const isFirst = i === 0;
      const isLast = i === segments.length - 1;
      const seg = segments[i];
      const io = openRedirects(seg.redirects, opts.cwd, opts.projectRoot);
      allFds.push(...io.toClose);
      const { bin, args, spawnOverrides } = prepareSpawn(seg.argv);
      const stdoutSpec = io.stdoutFd !== null ? io.stdoutFd : "pipe";
      const stderrSpec = io.stderrFd !== null ? io.stderrFd : io.mergeStderrToStdout ? stdoutSpec : "pipe";
      const stdinSpec = io.stdinFd !== null ? io.stdinFd : isFirst ? "ignore" : "pipe";
      const spawnOpts = {
        cwd: opts.cwd,
        shell: false,
        windowsHide: true,
        env,
        stdio: [stdinSpec, stdoutSpec, stderrSpec],
        ...spawnOverrides
      };
      let child;
      try {
        child = spawn(bin, args, spawnOpts);
      } catch (err) {
        for (const fd of allFds) tryClose(fd);
        killAll();
        clearTimeout(killTimer);
        opts.signal?.removeEventListener("abort", onAbort);
        throw err;
      }
      children.push(child);
      if (!isFirst && io.stdinFd === null) {
        const prev = children[i - 1];
        prev.stdout?.on("error", () => {
        });
        child.stdin?.on("error", () => {
        });
        const prevMergesStderr = segments[i - 1].redirects.some((r) => r.kind === "2>&1") && !!prev.stderr;
        if (prevMergesStderr && prev.stderr) {
          prev.stderr.on("error", () => {
          });
          let openSources = 2;
          const closeIfDone = () => {
            if (--openSources === 0) child.stdin?.end();
          };
          prev.stdout?.pipe(child.stdin, { end: false });
          prev.stderr.pipe(child.stdin, { end: false });
          prev.stdout?.once("end", closeIfDone);
          prev.stderr.once("end", closeIfDone);
        } else {
          prev.stdout?.pipe(child.stdin);
        }
      }
      if (child.stderr && io.stderrFd === null && !(io.mergeStderrToStdout && !isLast)) {
        child.stderr.on("data", (chunk) => opts.buf.push(toBuf(chunk)));
      }
      if (isLast && child.stdout && io.stdoutFd === null) {
        child.stdout.on("data", (chunk) => opts.buf.push(toBuf(chunk)));
        if (io.mergeStderrToStdout && child.stderr && io.stderrFd === null) {
          child.stderr.removeAllListeners("data");
          child.stderr.on("data", (chunk) => opts.buf.push(toBuf(chunk)));
        }
      }
    }
    const exits = await Promise.all(
      children.map(
        (c) => new Promise((resolve4) => {
          c.once("error", () => resolve4(null));
          c.once("close", (code) => resolve4(code));
        })
      )
    );
    return { exitCode: exits[exits.length - 1] ?? null, timedOut };
  } finally {
    for (const fd of allFds) tryClose(fd);
    clearTimeout(killTimer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
function tryClose(fd) {
  try {
    closeSync(fd);
  } catch {
  }
}
function toBuf(chunk) {
  return typeof chunk === "string" ? Buffer.from(chunk) : chunk;
}
var outputResourceCounter = 0;
var OutputBuffer = class {
  constructor(cap, options = {}) {
    this.cap = cap;
    this.headCap = Math.ceil(cap * 0.65);
    this.tailCap = Math.max(0, cap - this.headCap);
    this.outputResourceDir = options.outputResourceDir ? pathMod.resolve(options.outputResourceDir) : null;
    this.spillThresholdBytes = Math.max(1, Number(options.spillThresholdBytes) || Math.floor(cap / 8));
    this.resourcePath = null;
    this.resourceId = null;
  }
  cap;
  headCap;
  tailCap;
  headChunks = [];
  headBytes = 0;
  tail = Buffer.alloc(0);
  totalBytes = 0;
  push(b) {
    const previousBytes = this.totalBytes;
    this.totalBytes += b.length;
    if (!this.resourcePath && this.outputResourceDir && this.totalBytes > this.spillThresholdBytes) {
      this.resourceId = `tool-output-${Date.now()}-${process.pid}-${++outputResourceCounter}.txt`;
      this.resourcePath = pathMod.resolve(this.outputResourceDir, this.resourceId);
      mkdirSync(this.outputResourceDir, { recursive: true });
      const prior = previousBytes > 0 ? Buffer.concat([...this.headChunks, this.tail]) : Buffer.alloc(0);
      writeFileSync(this.resourcePath, prior);
    }
    if (this.resourcePath) appendFileSync(this.resourcePath, b);
    let remaining = b;
    if (this.headBytes < this.headCap) {
      const take = Math.min(this.headCap - this.headBytes, remaining.length);
      if (take > 0) {
        this.headChunks.push(remaining.subarray(0, take));
        this.headBytes += take;
        remaining = remaining.subarray(take);
      }
    }
    if (remaining.length === 0 || this.tailCap === 0) return;
    if (remaining.length >= this.tailCap) {
      this.tail = remaining.subarray(remaining.length - this.tailCap);
      return;
    }
    const combined = Buffer.concat([this.tail, remaining]);
    this.tail = combined.length > this.tailCap ? combined.subarray(combined.length - this.tailCap) : combined;
  }
  toString() {
    const head = Buffer.concat(this.headChunks);
    if (this.totalBytes <= head.length + this.tail.length) {
      return smartDecodeOutput(Buffer.concat([head, this.tail]));
    }
    return `${decodeTruncatedOutputPart(head, false)}${decodeTruncatedOutputPart(this.tail, true)}`;
  }
  outputResource() {
    if (!this.resourcePath) return null;
    return { resourceId: this.resourceId, path: this.resourcePath, bytes: this.totalBytes };
  }
};
function decodeTruncatedOutputPart(buffer, trimStart) {
  const maxTrim = Math.min(3, buffer.length);
  for (let trim = 0; trim <= maxTrim; trim++) {
    const candidate = trimStart ? buffer.subarray(trim) : buffer.subarray(0, buffer.length - trim);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(candidate);
    } catch {
    }
  }
  return smartDecodeOutput(buffer);
}

// src/tools/shell/parse.ts
var BUILTIN_ALLOWLIST = [
  // Repo inspection
  "git status",
  "git diff",
  "git log",
  "git show",
  "git blame",
  "git branch",
  "git remote",
  "git rev-parse",
  "git config --get",
  // Filesystem inspection
  "ls",
  "pwd",
  "cat",
  "head",
  "tail",
  "wc",
  "file",
  "tree",
  "find",
  "grep",
  "rg",
  // Language version probes
  "node --version",
  "node -v",
  "npm --version",
  "npx --version",
  "python --version",
  "python3 --version",
  "cargo --version",
  "go version",
  "rustc --version",
  "deno --version",
  "bun --version",
  // Test runners (non-destructive by convention)
  "npm test",
  "npm run test",
  "npx vitest run",
  "npx vitest",
  "npx jest",
  "pytest",
  "python -m pytest",
  "cargo test",
  "cargo check",
  "cargo clippy",
  "go test",
  "go vet",
  "deno test",
  "bun test",
  // Linters / typecheckers (read-only by convention)
  "npm run lint",
  "npm run typecheck",
  "npx tsc --noEmit",
  "npx biome check",
  "npx eslint",
  "npx prettier --check",
  "ruff",
  "mypy"
];
function isDqEscape(prev, next) {
  return prev === "\\" && (next === '"' || next === "\\");
}
function tokenizeCommand(cmd) {
  const out = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (quote === '"' && isDqEscape(ch, cmd[i + 1])) {
        cur += cmd[++i];
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === " " || ch === "	") {
      if (cur.length > 0) {
        out.push(cur);
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (quote) throw new Error(`unclosed ${quote} in command`);
  if (cur.length > 0) out.push(cur);
  return out;
}
function detectShellOperator(cmd) {
  const opPrefix = /^(?:2>&1|&>|\|{1,2}|&{1,2}|2>{1,2}|>{1,2}|<{1,2})/;
  let cur = "";
  let curQuoted = false;
  let quote = null;
  const check = () => {
    if (cur.length === 0 && !curQuoted) return null;
    if (!curQuoted) {
      const m = opPrefix.exec(cur);
      if (m) return m[0] ?? null;
    }
    return null;
  };
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (quote === '"' && isDqEscape(ch, cmd[i + 1])) {
        cur += cmd[++i];
        curQuoted = true;
      } else {
        cur += ch;
        curQuoted = true;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      curQuoted = true;
      continue;
    }
    if (ch === " " || ch === "	") {
      const op = check();
      if (op) return op;
      cur = "";
      curQuoted = false;
      continue;
    }
    cur += ch;
  }
  if (quote) return null;
  return check();
}
var RISKY_ARGS = {
  // Branch / remote mutation
  "git branch": ["-d", "-D", "--delete", "-m", "-M", "--move", "-c", "-C", "--copy", "--force"],
  "git remote": ["add", "remove", "rm", "rename", "set-url", "set-head", "prune"],
  // `--output` writes to an arbitrary path; `--ext-diff` invokes user-config'd external programs.
  "git diff": ["--output", "--ext-diff"],
  "git log": ["--output"],
  "git show": ["--output"],
  // `-exec*` / `-ok*` are RCE; `-delete` and `-fprint*` / `-fls` write to arbitrary paths.
  find: [
    "-delete",
    "-exec",
    "-execdir",
    "-ok",
    "-okdir",
    "-fprint",
    "-fprint0",
    "-fprintf",
    "-fls"
  ],
  // `-o FILE` writes the tree to an arbitrary path.
  tree: ["-o"],
  // Auto-fix mutates source files.
  "npx eslint": ["--fix", "--fix-dry-run"],
  "npx biome check": ["--write", "--apply", "--apply-unsafe"],
  ruff: ["--fix", "--unsafe-fixes", "format"]
};
function tailHasRisky(tail, risky) {
  for (const a of tail) {
    for (const r of risky) {
      if (a === r) return true;
      if (a.startsWith(`${r}=`)) return true;
    }
  }
  return false;
}
function isAllowed(cmd, extra = []) {
  let argv;
  try {
    argv = tokenizeCommand(cmd);
  } catch {
    return false;
  }
  if (argv.length === 0) return false;
  const allowlist = [...BUILTIN_ALLOWLIST, ...extra];
  for (const prefix of allowlist) {
    const prefixTokens = prefix.split(" ");
    if (argv.length < prefixTokens.length) continue;
    let match = true;
    for (let i = 0; i < prefixTokens.length; i++) {
      if (argv[i] !== prefixTokens[i]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    const risky = RISKY_ARGS[prefix];
    if (risky && tailHasRisky(argv.slice(prefixTokens.length), risky)) return false;
    return true;
  }
  return false;
}
function isCommandAllowed(cmd, extra = [], projectRoot) {
  if (projectRoot && redirectsEscapeSandbox(cmd, projectRoot)) return false;
  let chain;
  try {
    chain = parseCommandChain(cmd);
  } catch {
    return false;
  }
  if (chain === null) return isAllowed(cmd, extra);
  return chainAllowed(chain, (seg) => isAllowed(seg, extra));
}

// src/tools/shell/exec.ts
var DEFAULT_TIMEOUT_SEC = 60;
var DEFAULT_MAX_OUTPUT_CHARS = 32e3;
function truncateCommandOutput(value, maxChars) {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  const marker = "\n\n[\u2026 output truncated; showing beginning and end \u2026]\n\n";
  const contentBudget = Math.max(0, maxChars - marker.length);
  const headChars = Math.ceil(contentBudget * 0.65);
  const tailChars = Math.max(0, contentBudget - headChars);
  return `${text.slice(0, headChars)}${marker}${tailChars > 0 ? text.slice(-tailChars) : ""}`;
}
function killProcessTree(child) {
  if (!child.pid || child.killed) return;
  if (process.platform === "win32") {
    try {
      const killer = spawn2("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });
      killer.on("error", () => {
      });
      return;
    } catch {
    }
  }
  try {
    process.kill(-child.pid, "SIGKILL");
    return;
  } catch {
  }
  try {
    child.kill("SIGKILL");
  } catch {
  }
}
async function runCommand(cmd, opts) {
  const timeoutSec = opts.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
  const maxChars = opts.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;
  const argv = tokenizeCommand(cmd);
  if (argv.length === 0) throw new Error("run_command: empty command");
  const chain = parseCommandChain(cmd);
  if (chain !== null) {
    return await runChain(chain, {
      cwd: opts.cwd,
      timeoutSec,
      maxOutputChars: maxChars,
      outputResourceDir: opts.outputResourceDir,
      signal: opts.signal,
      projectRoot: opts.projectRoot,
      env: opts.env
    });
  }
  const timeoutMs = timeoutSec * 1e3;
  const normalizedEnv = normalizeWindowsEnvVars({ ...process.env, ...(opts.env ?? {}) });
  const spawnOpts = {
    cwd: opts.cwd,
    shell: false,
    // no shell-expansion — see header comment
    windowsHide: true,
    // PYTHONIOENCODING + PYTHONUTF8 force any spawned Python child
    // (run_command running `python script.py`, etc.) to emit UTF-8
    // on stdout/stderr. Without this, Chinese-Windows defaults
    // Python's stdout encoder to GBK and `print("…")` raises
    // UnicodeEncodeError on emoji / non-GBK chars — the model then
    // sees a Python traceback instead of the script's real output
    // and goes around in circles trying to fix the wrong problem.
    // Harmless on non-Python processes (env vars they don't read).
    env: { ...normalizedEnv, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }
  };
  const { bin, args, spawnOverrides } = prepareSpawn(argv, { env: normalizedEnv });
  const effectiveSpawnOpts = { ...spawnOpts, ...spawnOverrides };
  return await new Promise((resolve4, reject) => {
    let child;
    try {
      child = spawn2(bin, args, effectiveSpawnOpts);
    } catch (err) {
      reject(err);
      return;
    }
    const byteCap = maxChars * 2 * 4;
    const outputBuffer = new OutputBuffer(byteCap, { outputResourceDir: opts.outputResourceDir, spillThresholdBytes: maxChars });
    let timedOut = false;
    let aborted = false;
    const killChildTree = () => killProcessTree(child);
    const killTimer = setTimeout(() => {
      timedOut = true;
      killChildTree();
    }, timeoutMs);
    const onAbort = () => {
      aborted = true;
      killChildTree();
    };
    if (opts.signal?.aborted) {
      onAbort();
    } else {
      opts.signal?.addEventListener("abort", onAbort, { once: true });
    }
    const onData = (chunk) => {
      const b = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      outputBuffer.push(b);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => {
      clearTimeout(killTimer);
      opts.signal?.removeEventListener("abort", onAbort);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      opts.signal?.removeEventListener("abort", onAbort);
      const buf = outputBuffer.toString();
      const output = truncateCommandOutput(buf, maxChars);
      resolve4({ exitCode: code, output, timedOut, outputResource: outputBuffer.outputResource() });
    });
  });
}
function smartDecodeOutput(buf) {
  if (buf.length === 0) return "";
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
  }
  if (process.platform === "win32") {
    try {
      return new TextDecoder("gb18030").decode(buf);
    } catch {
    }
  }
  return buf.toString("utf8");
}
function resolveExecutable(cmd, opts = {}) {
  const platform = opts.platform ?? process.platform;
  if (platform !== "win32") return cmd;
  if (!cmd) return cmd;
  if (cmd.includes("/") || cmd.includes("\\") || pathMod2.isAbsolute(cmd)) return cmd;
  if (pathMod2.extname(cmd)) return cmd;
  const env = opts.env ?? process.env;
  const pathExt = (getEnvCaseInsensitive(env, "PATHEXT") ?? ".COM;.EXE;.BAT;.CMD").split(";").map((e) => e.trim()).filter(Boolean);
  const delimiter2 = opts.pathDelimiter ?? (platform === "win32" ? ";" : pathMod2.delimiter);
  const pathDirs = (getEnvCaseInsensitive(env, "PATH") ?? "").split(delimiter2).filter(Boolean);
  const isFile = opts.isFile ?? defaultIsFile;
  for (const dir of pathDirs) {
    for (const ext of pathExt) {
      const full = pathMod2.win32.join(dir, cmd + ext);
      if (isFile(full)) return full;
    }
  }
  return cmd;
}
function normalizeWindowsEnvVars(env, opts = {}) {
  const platform = opts.platform ?? process.platform;
  if (platform !== "win32") return { ...env };
  const out = {};
  const pathValues = [];
  const pathExtValues = [];
  for (const [key, value] of Object.entries(env)) {
    const lower = key.toLowerCase();
    if (lower === "path") {
      if (typeof value === "string") pathValues.push(value);
      continue;
    }
    if (lower === "pathext") {
      if (typeof value === "string") pathExtValues.push(value);
      continue;
    }
    out[key] = value;
  }
  if (pathValues.length > 0) out.Path = mergeWindowsPathLike(pathValues, ";");
  if (pathExtValues.length > 0) out.PATHEXT = mergeWindowsPathLike(pathExtValues, ";");
  return out;
}
function getEnvCaseInsensitive(env, key) {
  const exact = env[key];
  if (exact !== void 0) return exact;
  const target = key.toLowerCase();
  for (const [candidate, value] of Object.entries(env)) {
    if (candidate.toLowerCase() === target) return value;
  }
  return void 0;
}
function mergeWindowsPathLike(values, delimiter2) {
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  for (const value of values) {
    for (const part of value.split(delimiter2)) {
      const entry = part.trim();
      if (!entry) continue;
      const normalized = entry.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(entry);
    }
  }
  return merged.join(delimiter2);
}
function defaultIsFile(full) {
  try {
    return existsSync(full) && statSync(full).isFile();
  } catch {
    return false;
  }
}
function prepareSpawn(argv, opts = {}) {
  const head = argv[0] ?? "";
  const tail = argv.slice(1);
  const platform = opts.platform ?? process.platform;
  const resolved = resolveExecutable(head, opts);
  if (platform !== "win32") {
    return { bin: resolved, args: [...tail], spawnOverrides: {} };
  }
  if (/\.(cmd|bat)$/i.test(resolved)) {
    const cmdline = [resolved, ...tail].map(quoteForCmdExe).join(" ");
    return {
      bin: "cmd.exe",
      args: ["/d", "/s", "/c", withUtf8Codepage(cmdline)],
      // windowsVerbatimArguments prevents Node from re-quoting the /c
      // payload — we've already composed an exact cmd.exe command
      // line. Without this Node wraps our already-quoted string in
      // another round of quotes and cmd.exe can't parse it.
      spawnOverrides: { windowsVerbatimArguments: true }
    };
  }
  if (isBareWindowsName(resolved) && resolved === head) {
    const cmdline = [head, ...tail].map(quoteForCmdExe).join(" ");
    return {
      bin: "cmd.exe",
      args: ["/d", "/s", "/c", withUtf8Codepage(cmdline)],
      spawnOverrides: { windowsVerbatimArguments: true }
    };
  }
  if (isPowerShellExe(resolved)) {
    const patched = injectPowerShellUtf8(tail);
    if (patched) {
      return { bin: resolved, args: patched, spawnOverrides: {} };
    }
  }
  return { bin: resolved, args: [...tail], spawnOverrides: {} };
}
function isPowerShellExe(resolved) {
  return /(?:^|[\\/])(?:powershell|pwsh)(?:\.exe)?$/i.test(resolved);
}
function injectPowerShellUtf8(args) {
  const prelude = "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;$OutputEncoding=[System.Text.Encoding]::UTF8;";
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (/^-(?:Command|c)$/i.test(a) && i + 1 < args.length) {
      const out = [...args];
      out[i + 1] = `${prelude}${args[i + 1] ?? ""}`;
      return out;
    }
  }
  return null;
}
function withUtf8Codepage(cmdline) {
  return `chcp 65001 >nul & ${cmdline}`;
}
function isBareWindowsName(s) {
  if (!s) return false;
  if (s.includes("/") || s.includes("\\")) return false;
  if (pathMod2.isAbsolute(s)) return false;
  if (pathMod2.extname(s)) return false;
  return true;
}
function quoteForCmdExe(arg) {
  if (arg === "") return '""';
  if (!/[\s"&|<>^%(),;!]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

// src/tools/shell.ts
function registerShellTools(registry, opts) {
  const rootDir = pathMod3.resolve(opts.rootDir);
  const timeoutSec = opts.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
  const maxOutputChars = opts.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;
  const outputResourceDir = opts.outputResourceDir ? pathMod3.resolve(opts.outputResourceDir) : null;
  const jobs = opts.jobs ?? new JobRegistry();
  const getOperationId = typeof opts.getOperationId === "function" ? opts.getOperationId : () => null;
  const getEnvironment = typeof opts.getEnvironment === "function" ? opts.getEnvironment : () => ({});
  const getExtraAllowed = typeof opts.extraAllowed === "function" ? opts.extraAllowed : (() => {
    const snapshot2 = opts.extraAllowed ?? [];
    return () => snapshot2;
  })();
  const isAllowAll = typeof opts.allowAll === "function" ? opts.allowAll : () => opts.allowAll === true;
  registry.register({
    name: "run_command",
    description: "Run a shell command in the project root; returns combined stdout+stderr. Allowlisted read-only / test / lint / typecheck commands run immediately; anything that could mutate state, install deps, or touch the network is gated by user confirmation. Prefer this over asking the user to run a command manually \u2014 after edits, run the project's tests to verify.\n\nConstraints (no real shell \u2014 argv is parsed natively for cross-platform parity):\n\u2022 Supported: chain ops `|` / `||` / `&&` / `;` (each segment allowlist-checked individually), file redirects `>` / `>>` / `<` / `2>` / `2>>` / `2>&1` / `&>` (target paths resolve relative to project root, max one redirect per fd per segment).\n\u2022 NOT supported: background `&`, heredoc `<<`, command substitution `$(\u2026)`, subshells `(\u2026)`, process substitution `<(\u2026)`, `$VAR` env expansion, glob expansion. To pass an operator char as literal arg, quote it (`grep \"a|b\" file`).\n\u2022 `cd` does NOT persist \u2014 between calls OR within a chain like `cd dir && cmd`. Use the binary's own cwd flag: `npm --prefix <dir>`, `git -C <dir>`, `cargo -C <dir>`, `pytest <dir>/tests`.\n\u2022 Filter at source \u2014 unbounded output (`netstat -ano`, `find /`) wastes tokens. Use `grep -c`, `wc -l`, narrower paths, etc.",
    // Plan-mode gate: allow allowlisted commands through (git status,
    // cargo check, ls, grep …) so the model can actually investigate
    // during planning. Anything that would otherwise trigger a
    // confirmation prompt is treated as "not read-only" and bounced.
    readOnlyCheck: (args) => {
      if (isAllowAll()) return true;
      const cmd = typeof args?.command === "string" ? args.command.trim() : "";
      if (!cmd) return false;
      return isCommandAllowed(cmd, getExtraAllowed(), rootDir);
    },
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: 'Full command line. POSIX-ish quoting. Chain operators `|`, `||`, `&&`, `;` and file redirects `>` / `>>` / `<` / `2>` / `2>>` / `2>&1` / `&>` work natively (no shell). Background `&`, heredoc `<<`, env-var expansion `$VAR`, and command substitution `$(\u2026)` are rejected (or passed through as literal in the case of `$VAR`). To pass an operator character as a literal argument (e.g. a regex), wrap it in quotes: `grep "a|b" file.txt`.'
        },
        documentRef: {
          type: "string",
          description: "Optional stable documentRef from prepare_local_document. Set it when a script reads VISIONOX_DOCUMENT_READABLE_PATH, especially after preparing more than one document."
        },
        timeoutSec: {
          type: "integer",
          description: `Override the default ${timeoutSec}s timeout for a single command.`
        }
      },
      required: ["command"]
    },
    fn: async (args, ctx) => {
      const cmd = args.command.trim();
      if (!cmd) throw new Error("run_command: empty command");
      const effectiveTimeout = Math.max(1, Math.min(600, args.timeoutSec ?? timeoutSec));
      const environment = await getEnvironment({ toolName: "run_command", command: cmd, args, signal: ctx?.signal, operationId: getOperationId(ctx?.signal) });
      if (!isAllowAll() && !isCommandAllowed(cmd, getExtraAllowed(), rootDir)) {
        const gate = ctx?.confirmationGate ?? pauseGate;
        const choice = await gate.ask({
          kind: "run_command",
          payload: { command: cmd, cwd: rootDir, timeoutSec: effectiveTimeout }
        });
        if (choice.type === "deny") {
          throw new Error(
            `user denied: ${cmd}${choice.denyContext ? ` \u2014 ${choice.denyContext}` : ""}`
          );
        }
        if (choice.type === "always_allow") {
          addProjectShellAllowed(rootDir, choice.prefix);
        }
      }
      const result = await runCommand(cmd, {
        cwd: rootDir,
        timeoutSec: effectiveTimeout,
        maxOutputChars,
        outputResourceDir,
        env: environment,
        signal: ctx?.signal
      });
      return formatCommandResult(cmd, result);
    }
  });
  registry.register({
    name: "run_background",
    description: "Spawn a long-running process and detach. Waits up to `waitSec` for startup or a readiness signal ('Local:', 'listening on', 'compiled successfully'), then returns the job id + startup preview. Tail logs with `job_output`, block on completion with `wait_for_job`, kill with `stop_job`, list with `list_jobs`.\n\nSingle process only \u2014 chains / redirects / `cd` work as in run_command, but a typical invocation is one binary. Use the binary's own --cwd / --prefix flag for subdirectories. Vite gotcha: npm's `--prefix` only finds package.json; vite's server root still uses process cwd \u2014 pass `vite <project-dir>` instead.\n\nUSE THIS \u2014 not run_command \u2014 for:\n- Dev servers / watchers: npm/yarn/pnpm dev, uvicorn / flask run, cargo watch, tsc --watch, webpack serve, anything with dev/serve/watch in the name.\n- One-shot long jobs: curl / wget large downloads, `huggingface-cli download`, multi-GB `pip install` / `npm install`, big `cargo build` / `docker build`. Start with `run_background`, then call `wait_for_job` once (default `waitFor: 'exit'`, timeoutMs up to 300_000) \u2014 the harness blocks server-side so a 5-minute download costs ONE tool call, not 30 polls.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Full command line. Same quoting rules as run_command (no pipes / redirects / chaining)."
        },
        documentRef: {
          type: "string",
          description: "Optional stable documentRef from prepare_local_document. Set it when the background process reads VISIONOX_DOCUMENT_READABLE_PATH."
        },
        waitSec: {
          type: "integer",
          description: "Max seconds to wait for startup before returning. 0..30, default 3. A ready-signal match short-circuits this."
        },
        lifecycle: {
          type: "string",
          enum: ["task", "service"],
          description: "Use 'task' (default) for builds/downloads owned by this answer; they stop when the answer is cancelled. Use 'service' only for dev servers/watchers that should keep running until explicitly stopped."
        }
      },
      required: ["command"]
    },
    fn: async (args, ctx) => {
      const cmd = args.command.trim();
      if (!cmd) throw new Error("run_background: empty command");
      if (!isAllowAll() && !isCommandAllowed(cmd, getExtraAllowed(), rootDir)) {
        const gate = ctx?.confirmationGate ?? pauseGate;
        const choice = await gate.ask({
          kind: "run_background",
          payload: { command: cmd, cwd: rootDir, waitSec: args.waitSec }
        });
        if (choice.type === "deny") {
          throw new Error(
            `user denied: ${cmd}${choice.denyContext ? ` \u2014 ${choice.denyContext}` : ""}`
          );
        }
        if (choice.type === "always_allow") {
          addProjectShellAllowed(rootDir, choice.prefix);
        }
      }
      const result = await jobs.start(cmd, {
        cwd: rootDir,
        env: await getEnvironment({ toolName: "run_background", command: cmd, args, signal: ctx?.signal, operationId: getOperationId(ctx?.signal) }),
        waitSec: args.waitSec,
        signal: args.lifecycle === "service" ? void 0 : ctx?.signal,
        ownerId: getOperationId(ctx?.signal),
        lifecycle: args.lifecycle === "service" ? "service" : "task"
      });
      return formatJobStart(result);
    }
  });
  registry.register({
    name: "job_output",
    description: "Read the latest output of a background job started with `run_background`. By default returns the tail of the buffer (last 80 lines). Pass `since` (the `byteLength` from a previous call) to stream only new content incrementally. Tells you whether the job is still running, so you can stop polling when it's done.",
    readOnly: true,
    parallelSafe: true,
    stormExempt: true,
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "integer", description: "Job id returned by run_background." },
        since: {
          type: "integer",
          description: "Return only output written past this byte offset (for incremental polling)."
        },
        tailLines: {
          type: "integer",
          description: "Cap the returned slice to the last N lines. Default 80, 0 = unlimited."
        }
      },
      required: ["jobId"]
    },
    fn: async (args) => {
      const out = jobs.read(args.jobId, {
        since: args.since,
        tailLines: args.tailLines ?? 80
      });
      if (!out) return `job ${args.jobId}: not found (use list_jobs)`;
      return formatJobRead(args.jobId, out);
    }
  });
  registry.register({
    name: "wait_for_job",
    description: "Block server-side until a background job finishes (or, opt-in, until it produces new output), bounded by `timeoutMs`. Costs ONE tool call regardless of how long the wait runs \u2014 use this instead of polling `job_output` in a loop. Returns JSON with `exited`, `exitCode`, and `latestOutput`.\n\n`waitFor` controls the wake condition:\n- `'exit'` (default) \u2014 only wake on the job exiting (or the timeout). Right for downloads, installs, builds, anything one-shot. Chatty progress bars do NOT wake the wait.\n- `'output-or-exit'` \u2014 also wake whenever the job writes a new line. Right for tailing a dev server / watcher and reacting to a specific log line.\n\nFor a download or install, set `timeoutMs` to the slowest reasonable end-to-end (e.g. 300_000 for a 5-min wheel install).",
    readOnly: true,
    parallelSafe: true,
    stormExempt: true,
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "integer", description: "Job id returned by run_background." },
        timeoutMs: {
          type: "integer",
          description: "Max time to block before returning if the wake condition hasn't fired. Clamped to 0..300000. Default 5000."
        },
        waitFor: {
          type: "string",
          enum: ["exit", "output-or-exit"],
          description: "Wake condition. 'exit' = only on job exit (right for downloads / installs / builds). 'output-or-exit' = also on any new output (right for tailing a dev server). Default 'exit'."
        }
      },
      required: ["jobId"]
    },
    fn: async (args, ctx) => {
      const out = await jobs.waitForJob(args.jobId, {
        timeoutMs: args.timeoutMs,
        waitFor: args.waitFor,
        signal: ctx?.signal
      });
      if (!out) return `job ${args.jobId}: not found (use list_jobs)`;
      return {
        jobId: args.jobId,
        exited: out.exited,
        exitCode: out.exitCode,
        latestOutput: out.latestOutput
      };
    }
  });
  registry.register({
    name: "stop_job",
    description: "Stop a background job started with `run_background`. SIGTERM first; SIGKILL after a short grace period if it doesn't exit cleanly. Returns the final output + exit code. Safe to call on an already-exited job.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "integer" }
      },
      required: ["jobId"]
    },
    fn: async (args) => {
      const rec = await jobs.stop(args.jobId);
      if (!rec) return `job ${args.jobId}: not found`;
      return formatJobStop(rec);
    }
  });
  registry.register({
    name: "list_jobs",
    description: "List every background job started this session \u2014 running and exited \u2014 with id, command, pid, status. Use when you've lost track of which job_id corresponds to which process, or to see what's still alive.",
    readOnly: true,
    parallelSafe: true,
    stormExempt: true,
    parameters: { type: "object", properties: {} },
    fn: async () => {
      const all = jobs.list();
      if (all.length === 0) return "(no background jobs started this session)";
      return all.map(formatJobRow).join("\n");
    }
  });
  return registry;
}
function formatJobStart(r) {
  const header = r.stillRunning ? `[job ${r.jobId} started \xB7 pid ${r.pid ?? "?"} \xB7 ${r.readyMatched ? "READY signal matched" : "running (no ready signal yet)"}]` : r.exitCode !== null ? `[job ${r.jobId} exited during startup \xB7 exit ${r.exitCode}]` : `[job ${r.jobId} failed to start]`;
  return r.preview ? `${header}
${r.preview}` : header;
}
function formatJobRead(jobId, r) {
  const status = r.running ? `running \xB7 pid ${r.pid ?? "?"}` : r.exitCode !== null ? `exited ${r.exitCode}` : r.spawnError ? `failed (${r.spawnError})` : "stopped";
  const header = `[job ${jobId} \xB7 ${status} \xB7 byteLength=${r.byteLength}]
$ ${r.command}`;
  return r.output ? `${header}
${r.output}` : header;
}
function formatJobStop(r) {
  const running = r.running ? "still running (SIGKILL may be pending)" : `exit ${r.exitCode ?? "?"}`;
  const tail = tailLines(r.output, 40);
  const header = `[job ${r.id} stopped \xB7 ${running}]
$ ${r.command}`;
  return tail ? `${header}
${tail}` : header;
}
function formatJobRow(r) {
  const age = ((Date.now() - r.startedAt) / 1e3).toFixed(1);
  const state = r.running ? `running   \xB7  pid ${r.pid ?? "?"}` : r.exitCode !== null ? `exit ${r.exitCode}` : r.spawnError ? "failed" : "stopped";
  return `  ${String(r.id).padStart(3)}  ${state.padEnd(24)}  ${age}s ago   $ ${r.command}`;
}
function tailLines(s, n) {
  if (!s) return "";
  const lines = s.split("\n");
  if (lines.length <= n) return s;
  const dropped = lines.length - n;
  return [`[\u2026 ${dropped} earlier lines \u2026]`, ...lines.slice(-n)].join("\n");
}
function formatCommandResult(cmd, r) {
  const header = r.timedOut ? `$ ${cmd}
[killed after timeout]` : `$ ${cmd}
[exit ${r.exitCode ?? "?"}]`;
  const resource = r.outputResource
    ? `[TOOL_OUTPUT_RESOURCE] ${JSON.stringify(r.outputResource)}\n`
    : "";
  return r.output ? `${resource}${header}\n${r.output}` : `${resource}${header}`;
}

// src/tools/jobs.ts
function killProcessTree2(pid, signal) {
  if (process.platform === "win32") {
    const args = ["/pid", String(pid), "/T"];
    if (signal === "SIGKILL") args.push("/F");
    try {
      const killer = spawn3("taskkill", args, {
        stdio: "ignore",
        windowsHide: true
      });
      killer.on("error", () => {
      });
    } catch {
    }
    return;
  }
  try {
    process.kill(-pid, signal);
    return;
  } catch {
  }
  try {
    process.kill(pid, signal);
  } catch {
  }
}
var DEFAULT_OUTPUT_CAP_BYTES = 64 * 1024;
function unrefDelay(ms) {
  return new Promise((resolve4) => {
    const timer = setTimeout(resolve4, ms);
    timer.unref?.();
  });
}
var READY_SIGNALS = [
  // HTTP server banners
  /\blistening on\b/i,
  /\blocal:\s+https?:\/\//i,
  /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?\b/i,
  /\b(?:ready|server started|started server|app listening)\b/i,
  // Bundlers / compilers
  /\bcompiled successfully\b/i,
  /\bbuild complete(?:d)?\b/i,
  /\bwatching for (?:file )?changes\b/i,
  /\bready in \d+/i,
  // Generic
  /\bstartup (?:complete|finished)\b/i
];
var JobRegistry = class {
  jobs = /* @__PURE__ */ new Map();
  nextId = 1;
  changeListener = null;
  completedRetention = 50;
  setChangeListener(listener) {
    this.changeListener = typeof listener === "function" ? listener : null;
  }
  notifyChange(job, action) {
    try {
      this.changeListener?.({ action, job: job ? snapshotMetadata(job) : null });
    } catch {
    }
  }
  pruneCompleted() {
    const completed = [...this.jobs.values()].filter((job) => !job.running).sort((a, b) => a.startedAt - b.startedAt);
    while (completed.length > this.completedRetention) {
      const old = completed.shift();
      if (!old) break;
      old.outputWaiters?.clear?.();
      old.child = null;
      this.jobs.delete(old.id);
    }
  }
  /** Resolves on (a) ready signal, (b) early exit, or (c) waitSec deadline — child keeps running regardless. */
  async start(command, opts) {
    const trimmed = command.trim();
    if (!trimmed) throw new Error("run_background: empty command");
    const op = detectShellOperator(trimmed);
    if (op !== null) {
      throw new Error(
        `run_background: shell operator "${op}" is not supported \u2014 spawn one process per background job. Compose via your orchestration, not the shell.`
      );
    }
    const argv = tokenizeCommand(trimmed);
    if (argv.length === 0) throw new Error("run_background: empty command");
    const waitMs = Math.max(0, Math.min(30, opts.waitSec ?? 3)) * 1e3;
    const maxBytes = opts.maxBufferBytes ?? DEFAULT_OUTPUT_CAP_BYTES;
    const { bin, args, spawnOverrides } = prepareSpawn(argv);
    const spawnOpts = {
      cwd: pathMod4.resolve(opts.cwd),
      shell: false,
      windowsHide: true,
      env: { ...process.env, ...(opts.env ?? {}) },
      // POSIX: detach so the child becomes its own process-group leader.
      // Required for `process.kill(-pid, …)` later — without it a group
      // kill fails and we end up only signaling the wrapper, leaving
      // grandchildren (node → vite → esbuild …) orphaned.
      // Windows: detached would spawn a new console window; leave the
      // default and use taskkill /T for tree termination.
      detached: process.platform !== "win32",
      ...spawnOverrides
    };
    let child;
    try {
      child = spawn3(bin, args, spawnOpts);
    } catch (err) {
      const id2 = this.nextId++;
      const job2 = {
        id: id2,
        command: trimmed,
        pid: null,
        startedAt: Date.now(),
        exitCode: null,
        output: `[spawn failed] ${err.message}`,
        totalBytesWritten: 0,
        running: false,
        spawnError: err.message,
        ownerId: opts.ownerId ?? null,
        lifecycle: opts.lifecycle === "service" ? "service" : "task",
        child: null,
        readyPromise: Promise.resolve(),
        signalReady: () => {
        },
        closedPromise: Promise.resolve(),
        signalClosed: () => {
        },
        outputWaiters: /* @__PURE__ */ new Set()
      };
      this.jobs.set(id2, job2);
      this.pruneCompleted();
      this.notifyChange(job2, "failed");
      return {
        jobId: id2,
        pid: null,
        stillRunning: false,
        readyMatched: false,
        preview: job2.output,
        exitCode: null
      };
    }
    const id = this.nextId++;
    let readyResolve = () => {
    };
    const readyPromise = new Promise((res) => {
      readyResolve = res;
    });
    let closedResolve = () => {
    };
    const closedPromise = new Promise((res) => {
      closedResolve = res;
    });
    const job = {
      id,
      command: trimmed,
      pid: child.pid ?? null,
      startedAt: Date.now(),
      exitCode: null,
      output: "",
      totalBytesWritten: 0,
      running: true,
      ownerId: opts.ownerId ?? null,
      lifecycle: opts.lifecycle === "service" ? "service" : "task",
      child,
      readyPromise,
      signalReady: readyResolve,
      closedPromise,
      signalClosed: closedResolve,
      outputWaiters: /* @__PURE__ */ new Set()
    };
    this.jobs.set(id, job);
    this.notifyChange(job, "started");
    let readyMatched = false;
    let recentForReady = "";
    const READY_WINDOW = 1024;
    const onData = (chunk) => {
      const s = chunk.toString();
      job.totalBytesWritten += s.length;
      job.output += s;
      if (job.output.length > maxBytes) {
        const overflow = job.output.length - maxBytes;
        const cut = job.output.indexOf("\n", overflow);
        const start = cut >= 0 ? cut + 1 : overflow;
        job.output = `[\u2026 older output dropped \u2026]
${job.output.slice(start)}`;
      }
      if (!readyMatched) {
        recentForReady = (recentForReady + s).slice(-READY_WINDOW);
        for (const re of READY_SIGNALS) {
          if (re.test(recentForReady)) {
            readyMatched = true;
            job.signalReady();
            break;
          }
        }
      }
      if (job.outputWaiters.size > 0) {
        const waiters = [...job.outputWaiters];
        job.outputWaiters.clear();
        for (const wake of waiters) wake();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => {
      job.running = false;
      job.spawnError = err.message;
      job.signalReady();
      job.signalClosed();
    });
    let onAbort = null;
    const settleClosed = (code) => {
      if (!job.running && job.exitCode !== null) return;
      job.running = false;
      job.exitCode = code;
      job.signalReady();
      job.signalClosed();
      if (onAbort) opts.signal?.removeEventListener("abort", onAbort);
      job.child = null;
      this.pruneCompleted();
      this.notifyChange(job, "finished");
    };
    child.on("exit", settleClosed);
    child.on("close", settleClosed);
    onAbort = () => void this.stop(id, { graceMs: 100 });
    if (opts.signal?.aborted) {
      onAbort();
    } else {
      opts.signal?.addEventListener("abort", onAbort, { once: true });
    }
    let timer = null;
    await Promise.race([
      readyPromise,
      new Promise((res) => {
        timer = setTimeout(res, waitMs);
      })
    ]);
    if (timer) clearTimeout(timer);
    return {
      jobId: id,
      pid: job.pid,
      stillRunning: job.running,
      readyMatched,
      preview: job.output,
      exitCode: job.exitCode
    };
  }
  read(id, opts = {}) {
    const job = this.jobs.get(id);
    if (!job) return null;
    const full = job.output;
    let slice = full;
    if (typeof opts.since === "number" && opts.since >= 0 && opts.since < full.length) {
      slice = full.slice(opts.since);
    }
    if (typeof opts.tailLines === "number" && opts.tailLines > 0) {
      const lines = slice.split("\n");
      const keep = lines.slice(Math.max(0, lines.length - opts.tailLines));
      slice = keep.join("\n");
    }
    return {
      output: slice,
      byteLength: full.length,
      running: job.running,
      exitCode: job.exitCode,
      command: job.command,
      pid: job.pid,
      spawnError: job.spawnError
    };
  }
  async waitForJob(id, opts = {}) {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (!job.running) {
      return {
        exited: true,
        exitCode: job.exitCode,
        latestOutput: job.output
      };
    }
    if (opts.signal?.aborted) {
      throw new DOMException("background job wait cancelled", "AbortError");
    }
    const timeoutMs = Math.max(0, Math.min(3e5, opts.timeoutMs ?? 5e3));
    const waitFor = opts.waitFor ?? "exit";
    const startOutput = job.output;
    const racers = [job.closedPromise];
    let wakeOutput = null;
    if (waitFor === "output-or-exit") {
      racers.push(
        new Promise((resolve4) => {
          wakeOutput = resolve4;
          job.outputWaiters.add(resolve4);
        })
      );
    }
    let timer = null;
    racers.push(
      new Promise((resolve4) => {
        timer = setTimeout(resolve4, timeoutMs);
      })
    );
    let abortWaiter = null;
    if (opts.signal) {
      racers.push(new Promise((_, reject) => {
        abortWaiter = () => reject(new DOMException("background job wait cancelled", "AbortError"));
        opts.signal.addEventListener("abort", abortWaiter, { once: true });
      }));
    }
    try {
      await Promise.race(racers);
    } finally {
      if (abortWaiter) opts.signal?.removeEventListener("abort", abortWaiter);
      if (timer) clearTimeout(timer);
      if (wakeOutput) job.outputWaiters.delete(wakeOutput);
    }
    return {
      exited: !job.running,
      exitCode: job.exitCode,
      latestOutput: latestOutputSince(startOutput, job.output)
    };
  }
  /** SIGTERM, wait graceMs, then SIGKILL. Idempotent on already-exited jobs. */
  async stop(id, opts = {}) {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (!job.running || !job.child) return snapshot(job);
    const graceMs = Math.max(0, opts.graceMs ?? 2e3);
    if (job.pid !== null) {
      killProcessTree2(job.pid, "SIGTERM");
    } else {
      try {
        job.child.kill("SIGTERM");
      } catch {
      }
    }
    await Promise.race([job.closedPromise, unrefDelay(graceMs)]);
    if (job.running) {
      if (job.pid !== null) {
        killProcessTree2(job.pid, "SIGKILL");
      } else {
        try {
          job.child.kill("SIGKILL");
        } catch {
        }
      }
      await Promise.race([job.closedPromise, unrefDelay(5e3)]);
      if (job.running) {
        job.running = false;
        job.signalClosed();
        job.child = null;
        this.pruneCompleted();
        this.notifyChange(job, "finished");
      }
    }
    return snapshot(job);
  }
  list() {
    return [...this.jobs.values()].map(snapshot);
  }
  listMetadata() {
    return [...this.jobs.values()].map(snapshotMetadata);
  }
  async stopOwned(ownerId, opts = {}) {
    if (!ownerId) return [];
    const includeServices = opts.includeServices === true;
    const owned = [...this.jobs.values()].filter((job) =>
      job.running && job.ownerId === ownerId && (includeServices || job.lifecycle !== "service")
    );
    return await Promise.all(owned.map((job) => this.stop(job.id, { graceMs: opts.graceMs ?? 100 })));
  }
  async shutdown(deadlineMs = 5e3) {
    const start = Date.now();
    const runningJobs = [...this.jobs.values()].filter((j) => j.running && j.child);
    if (runningJobs.length === 0) return;
    for (const job of runningJobs) {
      if (job.pid !== null) killProcessTree2(job.pid, "SIGTERM");
      else
        try {
          job.child?.kill("SIGTERM");
        } catch {
        }
    }
    const allClose = Promise.all(runningJobs.map((j) => j.closedPromise));
    const elapsed = () => Date.now() - start;
    const graceMs = Math.min(1500, Math.max(0, deadlineMs / 2));
    await Promise.race([allClose, unrefDelay(graceMs)]);
    for (const job of runningJobs) {
      if (!job.running) continue;
      if (job.pid !== null) killProcessTree2(job.pid, "SIGKILL");
      else
        try {
          job.child?.kill("SIGKILL");
        } catch {
        }
    }
    const remaining = Math.max(800, deadlineMs - elapsed());
    await Promise.race([allClose, unrefDelay(remaining)]);
    for (const job of runningJobs) {
      if (job.running) {
        job.running = false;
        job.signalClosed();
        job.child = null;
      }
    }
    this.pruneCompleted();
  }
  /** Count of still-running jobs — drives the TUI status-bar indicator. */
  runningCount() {
    let n = 0;
    for (const job of this.jobs.values()) if (job.running) n++;
    return n;
  }
};
function snapshot(job) {
  return {
    id: job.id,
    command: job.command,
    pid: job.pid,
    startedAt: job.startedAt,
    exitCode: job.exitCode,
    output: job.output,
    totalBytesWritten: job.totalBytesWritten,
    running: job.running,
    spawnError: job.spawnError,
    ownerId: job.ownerId ?? null,
    lifecycle: job.lifecycle === "service" ? "service" : "task"
  };
}
function snapshotMetadata(job) {
  const { output, ...metadata } = snapshot(job);
  return metadata;
}
function latestOutputSince(before, after) {
  if (!before) return after;
  if (after.startsWith(before)) return after.slice(before.length);
  return after;
}

// src/tools/fs/edit.ts
import { promises as fs } from "fs";
import * as pathMod5 from "path";
var import_iconv = require("iconv-lite");
function displayRel(rootDir, full) {
  return pathMod5.relative(rootDir, full).replaceAll("\\", "/");
}
function decodeFileBuffer(buf) {
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return { text: buf.slice(3).toString("utf8"), encoding: "utf8bom" };
  }
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    return { text: buf.slice(2).toString("utf16le"), encoding: "utf16le" };
  }
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
    return { text: buf.slice(2).toString("utf16be"), encoding: "utf16be" };
  }
  const utf8Text = buf.toString("utf8");
  if (!utf8Text.includes("\uFFFD")) {
    return { text: utf8Text, encoding: "utf8" };
  }
  try {
    const gbkText = import_iconv.decode(buf, "gb18030");
    return { text: gbkText, encoding: "gb18030" };
  } catch {
    return { text: utf8Text, encoding: "utf8" };
  }
}
function encodeFile(text, encoding) {
  if (encoding === "gb18030" || encoding === "gbk" || encoding === "gb2312") {
    return import_iconv.encode(text, "gb18030");
  }
  if (encoding === "utf16le" || encoding === "utf16be") {
    return Buffer.from(text, encoding);
  }
  if (encoding === "utf8bom") {
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const body = Buffer.from(text, "utf8");
    return Buffer.concat([bom, body]);
  }
  return Buffer.from(text, "utf8");
}
async function applyEdit(rootDir, abs, args) {
  if (args.search.length === 0) {
    throw new Error("edit_file: search cannot be empty");
  }
  const raw = await fs.readFile(abs);
  const { text: before, encoding } = decodeFileBuffer(raw);
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
  await fs.writeFile(abs, encodeFile(after, encoding));
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
      let decoded;
      try {
        const rawBuf = await fs.readFile(e.abs);
        decoded = decodeFileBuffer(rawBuf);
        before = decoded.text;
      } catch (err) {
        throw new Error(
          `multi_edit: edit #${i + 1} cannot read ${rel}: ${err.message} (no edits applied)`
        );
      }
      const le = before.includes("\r\n") ? "\r\n" : "\n";
      state = { before, buf: before, le, hunks: [], deltaChars: 0, touched: 0, encoding: decoded.encoding };
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
  const attempted = [];
  try {
    for (const [abs, state] of filesByPath) {
      attempted.push({ abs, before: state.before, encoding: state.encoding });
      await fs.writeFile(abs, encodeFile(state.buf, state.encoding || "utf8"));
    }
  } catch (writeErr) {
    const rollbackFailures = [];
    for (const item of [...attempted].reverse()) {
      try {
        await fs.writeFile(item.abs, encodeFile(item.before, item.encoding || "utf8"));
      } catch (restoreErr) {
        rollbackFailures.push(`${displayRel(rootDir, item.abs)}: ${restoreErr.message}`);
      }
    }
    if (rollbackFailures.length > 0) {
      throw new Error(`multi_edit: write failed after partial application: ${writeErr.message}; rollback failed for ${rollbackFailures.join("; ")}`);
    }
    throw new Error(`multi_edit: write failed: ${writeErr.message}; rolled back all files that may have been modified`);
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

export {
  pauseGate,
  applyEdit,
  applyMultiEdit,
  lineDiff,
  JobRegistry,
  BUILTIN_ALLOWLIST,
  isNullDeviceAlias,
  runCommand,
  registerShellTools,
  formatCommandResult
};
//# sourceMappingURL=chunk-O52OLQL3.js.map
