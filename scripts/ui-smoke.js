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
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const makeState = (overrides = {}) => ({
      available: true,
      connected: false,
      userName: null,
      corpName: null,
      checkedAt: new Date().toISOString(),
      login: { state: 'idle', userCode: null, loginUrl: null },
      ...overrides,
    });
    window.__vhomeMockState = makeState();
    window.__vhomeOpenAttempts = [];
    window.__vhomeRefreshCount = 0;
    window.__vhomeStatusPolls = 0;
    window.__vhomeOriginalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      const method = String(init.method || input?.method || 'GET').toUpperCase();
      const response = () => new Response(JSON.stringify(window.__vhomeMockState), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.pathname.endsWith('/vhome/status')) {
        if (window.__vhomeMockState?.login?.state === 'starting') {
          window.__vhomeStatusPolls += 1;
          if (window.__vhomeStatusPolls >= 2) {
            window.__vhomeMockState = makeState({ login: { state: 'awaiting-user', userCode: 'TEST-CODE', loginUrl: 'https://login.dingtalk.com/device?user_code=TEST-CODE', expiresAt: new Date(Date.now() + 900000).toISOString() } });
          }
        }
        return response();
      }
      if (url.pathname.endsWith('/vhome/login') && method === 'POST') {
        window.__vhomeStatusPolls = 0;
        window.__vhomeMockState = makeState({ login: { state: 'starting', userCode: null, loginUrl: null, expiresAt: null } });
        return response();
      }
      if (url.pathname.endsWith('/vhome/login') && method === 'DELETE') {
        window.__vhomeMockState = makeState();
        return response();
      }
      if (url.pathname.endsWith('/vhome/logout') && method === 'POST') {
        window.__vhomeMockState = makeState();
        return response();
      }
      if (url.pathname.endsWith('/vhome/refresh') && method === 'POST') {
        window.__vhomeRefreshCount += 1;
        return response();
      }
      if (url.pathname.endsWith('/open-url') && method === 'POST') {
        const request = JSON.parse(String(init.body || '{}'));
        window.__vhomeOpenAttempts.push(request.browser || 'default');
        if ((request.browser || 'default') === 'default') {
          return new Response(JSON.stringify({ error: 'default browser unavailable' }), { status: 500, headers: { 'content-type': 'application/json' } });
        }
        return new Response(JSON.stringify({ opened: true, browser: request.browser }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return window.__vhomeOriginalFetch(input, init);
    };
  })();` });
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${port}/?token=${token}` });
  const rendered = await waitForDashboard(cdp, 15_000);
  if (rendered.boot) throw new Error("Dashboard remained on its loading screen");
  if (rendered.title !== "Visionox") throw new Error(`unexpected Dashboard title: ${rendered.title}`);
  const vhomeControl = await evaluate(cdp, `(() => {
    const button = document.querySelector('.vhome-control-button');
    const identity = document.querySelector('.side-foot .label');
    return { button: button?.textContent?.trim() ?? '', identity: identity?.textContent?.trim() ?? '' };
  })()`);
  if (!vhomeControl.button.includes("V来家") || !vhomeControl.identity) throw new Error(`V来家 sidebar control did not render: ${JSON.stringify(vhomeControl)}`);
  console.log("[ui-smoke] V来家 login control rendered without blocking the Dashboard");

  await evaluate(cdp, `document.querySelector('.vhome-control-button').click()`);
  await waitForBrowserValue(cdp, `(() => ({
    popover: Boolean(document.querySelector('.vhome-popover')),
    button: document.querySelector('.vhome-control-button')?.textContent?.trim() ?? '',
    disabled: Boolean(document.querySelector('.vhome-control-button')?.disabled),
    mockInstalled: typeof window.__vhomeOriginalFetch === 'function',
    mockState: window.__vhomeMockState?.login?.state ?? null,
  }))()`, (value) => value.popover && value.button.includes('正在获取') && value.mockState === 'starting');
  const vhomePreparingControls = await evaluate(cdp, `(() => ({
    buttons: [...document.querySelectorAll('.vhome-popover button')].map((button) => button.textContent.trim()),
    message: document.querySelector('.vhome-popover-meta')?.textContent ?? '',
  }))()`);
  if (!vhomePreparingControls.buttons.some((text) => text.includes('取消')) || !vhomePreparingControls.message.includes('正在获取授权链接')) {
    throw new Error(`V来家 preparing state is incomplete: ${JSON.stringify(vhomePreparingControls)}`);
  }
  for (const label of ['打开浏览器', '复制链接', '我已完成授权']) {
    if (vhomePreparingControls.buttons.some((text) => text.includes(label))) throw new Error(`V来家 preparing state exposed ${label} too early`);
  }
  console.log("[ui-smoke] V来家 login popover keeps unavailable authorization actions hidden");
  await waitForBrowserValue(cdp, `document.querySelector('.vhome-control-button')?.textContent?.includes('等待') && window.__vhomeMockState?.login?.state === 'awaiting-user'`, Boolean, 4_000);
  console.log("[ui-smoke] V来家 delayed authorization link appeared without a refresh");
  const vhomeFallbackControls = await evaluate(cdp, `(() => ({
    buttons: [...document.querySelectorAll('.vhome-popover button')].map((button) => button.textContent.trim()),
    countdown: document.querySelector('.vhome-popover-meta')?.parentElement?.textContent?.includes('剩余') ?? false,
  }))()`);
  for (const label of ['打开浏览器', '复制链接', '我已完成授权']) {
    if (!vhomeFallbackControls.buttons.some((text) => text.includes(label))) throw new Error(`missing V来家 fallback control: ${label}`);
  }
  await evaluate(cdp, `[...document.querySelectorAll('.vhome-popover button')].find((button) => button.textContent.includes('打开浏览器'))?.click()`);
  await waitForBrowserValue(cdp, `(() => ({
    edge: [...document.querySelectorAll('.vhome-popover button')].some((button) => button.textContent.includes('Edge')),
    error: document.querySelector('.vhome-popover-error')?.textContent ?? '',
  }))()`, (value) => value.edge && value.error.includes('默认浏览器'));
  await evaluate(cdp, `[...document.querySelectorAll('.vhome-popover button')].find((button) => button.textContent.includes('Edge'))?.click()`);
  await waitForBrowserValue(cdp, `window.__vhomeOpenAttempts.join(',')`, (value) => value === 'default,edge');
  await evaluate(cdp, `[...document.querySelectorAll('.vhome-popover button')].find((button) => button.textContent.includes('我已完成授权'))?.click()`);
  await waitForBrowserValue(cdp, `window.__vhomeRefreshCount`, (value) => value === 1);
  console.log("[ui-smoke] V来家 manual link, Edge fallback and explicit refresh controls passed");
  await evaluate(cdp, `window.__vhomeMockState = { ...window.__vhomeMockState, connected: true, userName: '测试用户', corpName: '测试组织', checkedAt: new Date().toISOString(), login: { state: 'idle', userCode: null, loginUrl: null } }`);
  await waitForBrowserValue(cdp, `document.querySelector('.vhome-control-button').textContent.includes('已连接') && !document.querySelector('.vhome-popover')`, Boolean, 4_000);
  console.log("[ui-smoke] V来家 successful login closed the popover");
  await evaluate(cdp, `document.querySelector('.vhome-control-button').click()`);
  await waitForBrowserValue(cdp, `Boolean(document.querySelector('.vhome-popover'))`, Boolean);
  await evaluate(cdp, `(() => { window.confirm = () => true; [...document.querySelectorAll('.vhome-popover button')].find((button) => button.textContent.includes('退出'))?.click(); })()`);
  await waitForBrowserValue(cdp, `document.querySelector('.vhome-control-button').textContent.includes('登录') && document.querySelector('.side-foot .label')?.textContent.includes('127.0.0.1') && !document.querySelector('.vhome-control-button').disabled && !document.querySelector('.vhome-popover')`, Boolean);
  console.log("[ui-smoke] V来家 logout immediately reset identity and closed the popover");
  await evaluate(cdp, `document.querySelector('.vhome-control-button').click()`);
  await waitForBrowserValue(cdp, `(() => ({
    popover: Boolean(document.querySelector('.vhome-popover')),
    buttons: [...document.querySelectorAll('.vhome-popover button')].map((button) => button.textContent.trim()),
    button: document.querySelector('.vhome-control-button')?.textContent?.trim() ?? '',
    disabled: Boolean(document.querySelector('.vhome-control-button')?.disabled),
    mockState: window.__vhomeMockState?.login?.state ?? null,
  }))()`, (value) => value.buttons.some((text) => text.includes('取消')));
  await evaluate(cdp, `[...document.querySelectorAll('.vhome-popover button')].find((button) => button.textContent.includes('取消'))?.click()`);
  await waitForBrowserValue(cdp, `document.querySelector('.vhome-control-button').textContent.includes('登录') && !document.querySelector('.vhome-control-button').disabled && !document.querySelector('.vhome-popover')`, Boolean);
  console.log("[ui-smoke] V来家 login cancellation closed the popover");
  await evaluate(cdp, `document.querySelector('.vhome-control-button').click()`);
  await waitForBrowserValue(cdp, `Boolean(document.querySelector('.vhome-popover')) && window.__vhomeMockState?.login?.state === 'awaiting-user'`, Boolean);
  await evaluate(cdp, `window.__vhomeMockState = { ...window.__vhomeMockState, connected: false, userName: null, corpName: null, checkedAt: new Date().toISOString(), login: { state: 'failed', userCode: null, loginUrl: null, reason: 'login-network-failed', message: '无法连接 V来家授权服务，请检查网络、代理或防火墙后重试。', detail: 'proxyconnect tcp: connection refused' } }`);
  const vhomeFailure = await waitForBrowserValue(cdp, `(() => ({
    message: document.querySelector('.vhome-popover-meta')?.textContent ?? '',
    detail: document.querySelector('.vhome-popover-error')?.textContent ?? '',
    buttons: [...document.querySelectorAll('.vhome-popover button')].map((button) => button.textContent.trim()),
  }))()`, (value) => value.message.includes('网络、代理或防火墙') && value.detail.includes('connection refused'));
  if (!vhomeFailure.buttons.some((text) => text.includes('重新生成链接'))) throw new Error(`V来家 failed state has no retry action: ${JSON.stringify(vhomeFailure)}`);
  console.log("[ui-smoke] V来家 failure state exposed an actionable reason and safe DWS detail");
  await evaluate(cdp, `[...document.querySelectorAll('.vhome-popover button')].find((button) => button.textContent.includes('重新生成链接'))?.click()`);
  await waitForBrowserValue(cdp, `window.__vhomeMockState?.login?.state === 'awaiting-user' && document.querySelector('.vhome-control-button')?.textContent?.includes('等待')`, Boolean, 4_000);
  await evaluate(cdp, `window.__vhomeMockState = { ...window.__vhomeMockState, connected: false, userName: null, corpName: null, checkedAt: new Date().toISOString(), login: { state: 'idle', userCode: null, loginUrl: null } }`);
  await waitForBrowserValue(cdp, `document.querySelector('.vhome-control-button').textContent.includes('登录') && !document.querySelector('.vhome-popover')`, Boolean, 4_000);
  console.log("[ui-smoke] V来家 background unauthenticated state closed the popover");
  await evaluate(cdp, `(() => { window.fetch = window.__vhomeOriginalFetch; delete window.__vhomeOriginalFetch; delete window.__vhomeMockState; delete window.__vhomeOpenAttempts; delete window.__vhomeRefreshCount; delete window.__vhomeStatusPolls; })()`);
  console.log("[ui-smoke] V来家 login success, cancellation and logout all close the popover");

  const integrationTemplates = await waitForApiValue(`http://127.0.0.1:${port}/api/schedules/templates?token=${token}`, (value) => value.integrations?.some((item) => item.id === "dws" && item.compatible && item.templates?.length === 6));
  const dwsTemplates = integrationTemplates.integrations.find((item) => item.id === "dws");
  if (dwsTemplates.templates.some((template) => template.risk !== "read")) throw new Error("DWS scheduled templates must remain read-only");
  for (const id of ["topic-investigation", "report-consistency-review"]) {
    if (!dwsTemplates.templates.some((template) => template.id === id)) throw new Error(`missing DWS scheduled template: ${id}`);
  }
  await evaluate(cdp, `(() => {
    const taskTab = [...document.querySelectorAll('.side-tab')].find((item) => item.textContent.includes('任务'));
    if (!taskTab) throw new Error('task tab not found');
    taskTab.click();
  })()`);
  await waitForBrowserValue(cdp, `Boolean([...document.querySelectorAll('select option')].find((item) => item.value === 'skill'))`, Boolean);
  await evaluate(cdp, `(() => {
    const source = [...document.querySelectorAll('select')].find((item) => [...item.options].some((option) => option.value === 'skill'));
    source.value = 'skill';
    source.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitForBrowserValue(cdp, `Boolean([...document.querySelectorAll('select option')].find((item) => item.value === 'dws/daily-work-briefing'))`, Boolean);
  await waitForBrowserValue(cdp, `Boolean([...document.querySelectorAll('input')].find((item) => item.placeholder === '未选择归档工作区'))`, Boolean);
  console.log("[ui-smoke] read-only DWS schedule templates rendered from the installed Skill");
  await evaluate(cdp, `[...document.querySelectorAll('.side-tab')].find((item) => item.textContent.includes('对话'))?.click()`);

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

  const clipboardPath = String.raw`C:\Users\TestUser\Documents\Visionox Workspace\release\bundle\nsis`;
  const pastePerformance = await evaluate(cdp, `new Promise((resolve) => {
    const input = document.querySelector('.chat-input-area textarea');
    if (!input) throw new Error('chat input not found');
    const expected = ${JSON.stringify(clipboardPath)};
    input.value = '';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent' }));
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: {
      items: [],
      getData(type) { return type === 'text/plain' ? expected : ''; },
    }});
    const started = performance.now();
    input.dispatchEvent(paste);
    const dispatchMs = performance.now() - started;
    setTimeout(() => resolve({ dispatchMs, value: input.value }), 0);
  })`);
  if (pastePerformance.value !== clipboardPath) throw new Error(`plain path paste mismatch: ${pastePerformance.value}`);
  if (pastePerformance.dispatchMs > 25) throw new Error(`plain path paste exceeded 25ms: ${pastePerformance.dispatchMs.toFixed(2)}ms`);
  console.log(`[ui-smoke] plain Windows path paste stayed local (${pastePerformance.dispatchMs.toFixed(2)}ms)`);

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
