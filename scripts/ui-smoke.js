#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
      pending.set(id, { resolve: resolveResult, reject });
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
const childEnv = {
  ...process.env,
  HOME: join(tempRoot, "home"),
  USERPROFILE: join(tempRoot, "home"),
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
  console.log("[ui-smoke] Edge rendered the Dashboard successfully");
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
