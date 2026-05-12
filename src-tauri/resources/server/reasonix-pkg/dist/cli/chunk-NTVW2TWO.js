#!/usr/bin/env node
import {
  addProjectShellAllowed
} from "./chunk-SWLIVNTP.js";

// src/tools/jobs.ts
import { spawn as spawn3 } from "child_process";
import * as pathMod4 from "path";

// src/tools/shell.ts
import * as pathMod3 from "path";

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
        `${kind}: no confirmation listener registered \u2014 cannot prompt the user. This tool can only be used inside an interactive Reasonix session.`
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

// src/tools/shell/exec.ts
import { spawn as spawn2, spawnSync } from "child_process";
import { existsSync, statSync } from "fs";
import * as pathMod2 from "path";

// src/tools/shell-chain.ts
import { spawn } from "child_process";
import { closeSync, openSync } from "fs";
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
  const buf = new OutputBuffer(opts.maxOutputChars * 2 * 4);
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
      signal: opts.signal
    });
    lastExit = result.exitCode;
    if (result.timedOut) {
      timedOut = true;
      break;
    }
    if (opts.signal?.aborted) break;
  }
  const output = buf.toString();
  const truncated = output.length > opts.maxOutputChars ? `${output.slice(0, opts.maxOutputChars)}

[\u2026 truncated ${output.length - opts.maxOutputChars} chars \u2026]` : output;
  return { exitCode: lastExit, output: truncated, timedOut };
}
function openRedirects(redirects, cwd) {
  let stdinFd = null;
  let stdoutFd = null;
  let stderrFd = null;
  let mergeStderrToStdout = false;
  let bothFd = null;
  const toClose = [];
  const open = (target, flags) => {
    const resolved = pathMod.resolve(cwd, target);
    const fd = openSync(resolved, flags);
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
  const env = { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" };
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
      const isFirst = i === 0;
      const isLast = i === segments.length - 1;
      const seg = segments[i];
      const io = openRedirects(seg.redirects, opts.cwd);
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
var OutputBuffer = class {
  constructor(cap) {
    this.cap = cap;
  }
  cap;
  chunks = [];
  bytes = 0;
  push(b) {
    if (this.bytes >= this.cap) return;
    const remaining = this.cap - this.bytes;
    if (b.length > remaining) {
      this.chunks.push(b.subarray(0, remaining));
      this.bytes = this.cap;
    } else {
      this.chunks.push(b);
      this.bytes += b.length;
    }
  }
  toString() {
    return smartDecodeOutput(Buffer.concat(this.chunks));
  }
};

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
function isCommandAllowed(cmd, extra = []) {
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
function killProcessTree(child) {
  if (!child.pid || child.killed) return;
  if (process.platform === "win32") {
    try {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
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
      signal: opts.signal
    });
  }
  const timeoutMs = timeoutSec * 1e3;
  const normalizedEnv = normalizeWindowsEnvVars(process.env);
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
    const chunks = [];
    let totalBytes = 0;
    const byteCap = maxChars * 2 * 4;
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
      if (totalBytes >= byteCap) return;
      const remaining = byteCap - totalBytes;
      if (b.length > remaining) {
        chunks.push(b.subarray(0, remaining));
        totalBytes = byteCap;
      } else {
        chunks.push(b);
        totalBytes += b.length;
      }
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
      const merged = Buffer.concat(chunks);
      const buf = smartDecodeOutput(merged);
      const output = buf.length > maxChars ? `${buf.slice(0, maxChars)}

[\u2026 truncated ${buf.length - maxChars} chars \u2026]` : buf;
      resolve4({ exitCode: code, output, timedOut });
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
  const jobs = opts.jobs ?? new JobRegistry();
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
      return isCommandAllowed(cmd, getExtraAllowed());
    },
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: 'Full command line. POSIX-ish quoting. Chain operators `|`, `||`, `&&`, `;` and file redirects `>` / `>>` / `<` / `2>` / `2>>` / `2>&1` / `&>` work natively (no shell). Background `&`, heredoc `<<`, env-var expansion `$VAR`, and command substitution `$(\u2026)` are rejected (or passed through as literal in the case of `$VAR`). To pass an operator character as a literal argument (e.g. a regex), wrap it in quotes: `grep "a|b" file.txt`.'
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
      if (!isAllowAll() && !isCommandAllowed(cmd, getExtraAllowed())) {
        const gate = ctx?.confirmationGate ?? pauseGate;
        const choice = await gate.ask({ kind: "run_command", payload: { command: cmd } });
        if (choice.type === "deny") {
          throw new Error(
            `user denied: ${cmd}${choice.denyContext ? ` \u2014 ${choice.denyContext}` : ""}`
          );
        }
        if (choice.type === "always_allow") {
          addProjectShellAllowed(rootDir, choice.prefix);
        }
      }
      const effectiveTimeout = Math.max(1, Math.min(600, args.timeoutSec ?? timeoutSec));
      const result = await runCommand(cmd, {
        cwd: rootDir,
        timeoutSec: effectiveTimeout,
        maxOutputChars,
        signal: ctx?.signal
      });
      return formatCommandResult(cmd, result);
    }
  });
  registry.register({
    name: "run_background",
    description: "Spawn a long-running process (dev server, watcher) and detach. Waits up to `waitSec` for startup or a readiness signal ('Local:', 'listening on', 'compiled successfully'), then returns the job id + startup preview. Tail logs with `job_output`, kill with `stop_job`, list with `list_jobs`.\n\nSingle process only \u2014 chains / redirects / `cd` work as in run_command, but a typical dev-server invocation is one binary. Use the binary's own --cwd / --prefix flag for subdirectories. Vite gotcha: npm's `--prefix` only finds package.json; vite's server root still uses process cwd \u2014 pass `vite <project-dir>` instead.\n\nUSE THIS \u2014 not run_command \u2014 for: npm/yarn/pnpm dev, uvicorn / flask run, cargo watch, tsc --watch, webpack serve, anything with dev/serve/watch in the name.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Full command line. Same quoting rules as run_command (no pipes / redirects / chaining)."
        },
        waitSec: {
          type: "integer",
          description: "Max seconds to wait for startup before returning. 0..30, default 3. A ready-signal match short-circuits this."
        }
      },
      required: ["command"]
    },
    fn: async (args, ctx) => {
      const cmd = args.command.trim();
      if (!cmd) throw new Error("run_background: empty command");
      if (!isAllowAll() && !isCommandAllowed(cmd, getExtraAllowed())) {
        const gate = ctx?.confirmationGate ?? pauseGate;
        const choice = await gate.ask({ kind: "run_background", payload: { command: cmd } });
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
        waitSec: args.waitSec,
        signal: ctx?.signal
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
    description: "Block until a background job exits or produces new output, bounded by `timeoutMs`. Use this instead of polling `job_output` with identical args when you're intentionally waiting for state to change. Returns JSON with `exited`, `exitCode`, and `latestOutput`.",
    readOnly: true,
    parallelSafe: true,
    stormExempt: true,
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "integer", description: "Job id returned by run_background." },
        timeoutMs: {
          type: "integer",
          description: "Max time to block before returning if nothing changes. Clamped to 0..30000. Default 5000."
        }
      },
      required: ["jobId"]
    },
    fn: async (args) => {
      const out = await jobs.waitForJob(args.jobId, { timeoutMs: args.timeoutMs });
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
  return r.output ? `${header}
${r.output}` : header;
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
      env: process.env,
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
      child,
      readyPromise,
      signalReady: readyResolve,
      closedPromise,
      signalClosed: closedResolve,
      outputWaiters: /* @__PURE__ */ new Set()
    };
    this.jobs.set(id, job);
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
    child.on("close", (code) => {
      job.running = false;
      job.exitCode = code;
      job.signalReady();
      job.signalClosed();
    });
    const onAbort = () => this.stop(id, { graceMs: 100 });
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
    const timeoutMs = Math.max(0, Math.min(3e4, opts.timeoutMs ?? 5e3));
    const startOutput = job.output;
    let wakeOutput = null;
    const outputPromise = new Promise((resolve4) => {
      wakeOutput = resolve4;
      job.outputWaiters.add(resolve4);
    });
    let timer = null;
    await Promise.race([
      job.closedPromise,
      outputPromise,
      new Promise((resolve4) => {
        timer = setTimeout(resolve4, timeoutMs);
      })
    ]);
    if (timer) clearTimeout(timer);
    if (wakeOutput) job.outputWaiters.delete(wakeOutput);
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
    await Promise.race([job.closedPromise, new Promise((res) => setTimeout(res, graceMs))]);
    if (job.running) {
      if (job.pid !== null) {
        killProcessTree2(job.pid, "SIGKILL");
      } else {
        try {
          job.child.kill("SIGKILL");
        } catch {
        }
      }
      await Promise.race([job.closedPromise, new Promise((res) => setTimeout(res, 5e3))]);
    }
    return snapshot(job);
  }
  list() {
    return [...this.jobs.values()].map(snapshot);
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
    const allClose = Promise.all(runningJobs.map((j) => j.readyPromise));
    const elapsed = () => Date.now() - start;
    const graceMs = Math.min(1500, Math.max(0, deadlineMs / 2));
    await Promise.race([allClose, new Promise((res) => setTimeout(res, graceMs))]);
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
    await Promise.race([allClose, new Promise((res) => setTimeout(res, remaining))]);
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
    spawnError: job.spawnError
  };
}
function latestOutputSince(before, after) {
  if (!before) return after;
  if (after.startsWith(before)) return after.slice(before.length);
  return after;
}

export {
  pauseGate,
  JobRegistry,
  BUILTIN_ALLOWLIST,
  runCommand,
  registerShellTools,
  formatCommandResult
};
//# sourceMappingURL=chunk-NTVW2TWO.js.map