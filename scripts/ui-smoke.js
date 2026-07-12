#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const launcherPath = join(root, "src-tauri", "resources", "server", "launcher.mjs");

function edgePath() {
  const candidates = [
    process.env.VISIONOX_EDGE_PATH,
    join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`server did not become healthy within ${timeoutMs}ms`);
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`browser debugging endpoint did not start within ${timeoutMs}ms`);
}

function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const browserErrors = [];
  let nextId = 1;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      browserErrors.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text);
    } else if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
      browserErrors.push(message.params.entry.text);
    }
  });
  const ready = new Promise((resolveReady, reject) => {
    socket.addEventListener("open", resolveReady, { once: true });
    socket.addEventListener("error", () => reject(new Error("failed to connect to Edge DevTools")), { once: true });
  });
  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolveResult, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Edge DevTools request timed out: ${method}`));
      }, 10_000);
      pending.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolveResult(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  return { socket, ready, send, browserErrors };
}

async function waitForDashboard(cdp, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const evaluated = await cdp.send("Runtime.evaluate", {
      expression: `({ rendered: Boolean(document.querySelector('.app-side')), boot: Boolean(document.querySelector('.boot')), title: document.title })`,
      returnByValue: true,
    });
    if (evaluated.result?.value?.rendered) return evaluated.result.value;
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`Dashboard did not render within ${timeoutMs}ms${cdp.browserErrors.length ? `: ${cdp.browserErrors.join(" | ")}` : ""}`);
}

async function evaluate(cdp, expression) {
  const evaluated = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (evaluated.exceptionDetails) {
    throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text || "browser evaluation failed");
  }
  return evaluated.result?.value;
}

async function waitForBrowserValue(cdp, expression, predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    const value = await evaluate(cdp, expression);
    lastValue = value;
    if (predicate(value)) return value;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`browser condition did not become true within ${timeoutMs}ms; last=${JSON.stringify(lastValue)}`);
}

async function waitForApiValue(url, predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const value = await response.json();
        if (predicate(value)) return value;
      }
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`API condition did not become true within ${timeoutMs}ms`);
}

function removeTempRoot(path) {
  const resolvedTemp = `${resolve(tmpdir())}${sep}`.toLowerCase();
  const resolvedPath = resolve(path).toLowerCase();
  if (!resolvedPath.startsWith(resolvedTemp)) throw new Error(`refusing to remove non-temp path: ${path}`);
  rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

function terminateProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}

const edge = edgePath();
if (!edge) {
  console.error("[ui-smoke] Microsoft Edge is required; set VISIONOX_EDGE_PATH when installed elsewhere");
  process.exit(1);
}

const tempRoot = mkdtempSync(join(tmpdir(), "visionox-ui-smoke-"));
const port = await freePort();
const debugPort = await freePort();
const token = "uismoketoken123";
const homeDir = join(tempRoot, "home");
const visionoxDir = join(homeDir, ".visionox");
mkdirSync(visionoxDir, { recursive: true });
const seededMessages = Array.from({ length: 1200 }, (_, index) => ({
  id: `seed-${index + 1}`,
  role: index % 2 === 0 ? "user" : "assistant",
  content: `long session message ${index + 1} ${"content ".repeat(8)}`,
}));
writeFileSync(join(visionoxDir, "active-session.jsonl"), `${seededMessages.map((message) => JSON.stringify(message)).join("\n")}\n`, "utf8");
const childEnv = {
  ...process.env,
  HOME: homeDir,
  USERPROFILE: homeDir,
};
const launcher = spawn(process.execPath, [launcherPath, "--port", String(port), "--token", token], {
  cwd: root,
  env: childEnv,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let launcherError = "";
launcher.stderr.on("data", (chunk) => { launcherError += chunk.toString(); });
let edgeProcess;
let cdp;

try {
  await waitForHealth(`http://127.0.0.1:${port}/api/health?token=${token}`, 15_000);
  edgeProcess = spawn(edge, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--no-first-run",
    `--user-data-dir=${join(tempRoot, "edge-profile")}`,
    `--remote-debugging-port=${debugPort}`,
    "about:blank",
  ], {
    stdio: "ignore",
    windowsHide: true,
  });
  const pages = await waitForJson(`http://127.0.0.1:${debugPort}/json`, 10_000);
  const page = pages.find((entry) => entry.type === "page");
  if (!page?.webSocketDebuggerUrl) throw new Error("Edge did not expose a debuggable page");
  cdp = connectCdp(page.webSocketDebuggerUrl);
  await cdp.ready;
  await Promise.all([cdp.send("Runtime.enable"), cdp.send("Page.enable"), cdp.send("Log.enable")]);
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${port}/?token=${token}` });
  const rendered = await waitForDashboard(cdp, 15_000);
  if (rendered.boot) throw new Error("Dashboard remained on its loading screen");
  if (rendered.title !== "Visionox") throw new Error(`unexpected Dashboard title: ${rendered.title}`);

  const messagePage = await waitForApiValue(`http://127.0.0.1:${port}/api/messages?limit=1&token=${token}`, (value) => value.totalMessages === 1200);
  if (messagePage.totalMessages !== 1200) throw new Error(`expected 1200 restored messages, got ${messagePage.totalMessages}`);
  const performance = await evaluate(cdp, `(() => {
    const input = document.querySelector('.chat-input-area textarea');
    if (!input) throw new Error('chat input not found');
    const durations = [];
    for (let index = 0; index < 100; index++) {
      const started = performance.now();
      input.value = 'latency probe ' + index;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: String(index), inputType: 'insertText' }));
      durations.push(performance.now() - started);
    }
    durations.sort((a, b) => a - b);
    return {
      renderedMessages: document.querySelectorAll('.chat-msg').length,
      p95Ms: durations[Math.floor(durations.length * 0.95)],
      maxMs: durations[durations.length - 1],
    };
  })()`);
  if (performance.renderedMessages > 35) throw new Error(`long session rendered too many messages: ${performance.renderedMessages}`);
  if (performance.p95Ms > 25) throw new Error(`chat input p95 exceeded 25ms: ${performance.p95Ms.toFixed(2)}ms`);
  console.log("[ui-smoke] long-session render and input latency passed");

  await evaluate(cdp, `(() => {
    const chip = [...document.querySelectorAll('.composer-chip')].find((item) => item.textContent.includes('模型'));
    if (!chip) throw new Error('model picker not found');
    chip.click();
  })()`);
  await waitForBrowserValue(cdp, `Boolean([...document.querySelectorAll('button')].find((item) => item.textContent.includes('检测全部模型')))`, Boolean);
  console.log("[ui-smoke] model picker interaction passed");
  await evaluate(cdp, `[...document.querySelectorAll('.composer-chip')].find((item) => item.textContent.includes('模型'))?.click()`);

  await evaluate(cdp, `(() => {
    const select = [...document.querySelectorAll('.chat-input-area select')].find((item) => [...item.options].some((option) => option.value === 'off'));
    if (!select) throw new Error('index retrieval selector not found');
    select.value = 'off';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  console.log("[ui-smoke] index selector change dispatched");
  await waitForApiValue(`http://127.0.0.1:${port}/api/index-retrieval-mode?token=${token}`, (value) => value.mode === "off");
  console.log("[ui-smoke] index mode persisted by API");

  await evaluate(cdp, `document.querySelector('.work-mode-picker .mode-btn:not(.active)')?.click()`);
  console.log("[ui-smoke] work-mode switch dispatched");
  await waitForBrowserValue(cdp, `document.querySelector('.chat-input-area select option:checked')?.value`, (value) => value === "off");
  console.log("[ui-smoke] index mode survived work-mode switch");
  await evaluate(cdp, `window.confirm = () => true`);
  await evaluate(cdp, `[...document.querySelectorAll('button')].find((item) => item.title?.startsWith('/new'))?.click()`);
  console.log("[ui-smoke] new-session action dispatched");
  await waitForApiValue(`http://127.0.0.1:${port}/api/messages?limit=1&token=${token}`, (value) => value.totalMessages === 1);
  await waitForBrowserValue(cdp, `document.querySelector('.chat-input-area select option:checked')?.value`, (value) => value === "off");
  console.log("[ui-smoke] index mode persisted across work-mode switch and new session");

  const backupFlow = await evaluate(cdp, `(async () => {
    const headers = { 'x-reasonix-token': '${token}', 'content-type': 'application/json' };
    const createdResponse = await fetch('/api/backups', { method: 'POST', headers, body: '{}' });
    if (!createdResponse.ok) throw new Error('backup creation failed: ' + await createdResponse.text());
    const created = await createdResponse.json();
    const previewResponse = await fetch('/api/backups/' + encodeURIComponent(created.id) + '/preview', { headers });
    if (!previewResponse.ok) throw new Error('backup preview failed: ' + await previewResponse.text());
    const preview = await previewResponse.json();
    const deletedResponse = await fetch('/api/backups/' + encodeURIComponent(created.id), { method: 'DELETE', headers, body: '{}' });
    if (!deletedResponse.ok) throw new Error('backup deletion failed: ' + await deletedResponse.text());
    return { id: created.id, conflicts: preview.counts.conflict, corrupt: preview.counts.corrupt };
  })()`);
  if (!backupFlow.id || backupFlow.conflicts !== 0 || backupFlow.corrupt !== 0) throw new Error(`unexpected backup browser flow: ${JSON.stringify(backupFlow)}`);
  await waitForApiValue(`http://127.0.0.1:${port}/api/backups?token=${token}`, (value) => value.items?.length === 0);
  console.log("[ui-smoke] backup create, preview and delete browser flow passed");

  await cdp.send("Page.reload", { ignoreCache: true });
  await waitForDashboard(cdp, 15_000);
  await waitForBrowserValue(cdp, `document.querySelector('.chat-input-area select option:checked')?.value`, (value) => value === "off");
  console.log(`[ui-smoke] Dashboard rendered; long-session input p95=${performance.p95Ms.toFixed(2)}ms, max=${performance.maxMs.toFixed(2)}ms, DOM messages=${performance.renderedMessages}`);
} catch (error) {
  console.error(`[ui-smoke] ${error.message}`);
  if (launcherError) console.error(launcherError.slice(-2000));
  process.exitCode = 1;
} finally {
  if (cdp) cdp.socket.close();
  terminateProcessTree(edgeProcess);
  terminateProcessTree(launcher);
  removeTempRoot(tempRoot);
}
