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

async function waitForBrowserValue(cdp, expression, predicate, timeoutMs = 15_000) {
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

async function removeTempRoot(path) {
  const resolvedTemp = `${resolve(tmpdir())}${sep}`.toLowerCase();
  const resolvedPath = resolve(path).toLowerCase();
  if (!resolvedPath.startsWith(resolvedTemp)) throw new Error(`refusing to remove non-temp path: ${path}`);
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) throw error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 200));
    }
  }
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
writeFileSync(join(visionoxDir, "config.json"), JSON.stringify({
  preset: "flash",
  model: "ark-chat-model",
  activeProviderId: "ark-chat",
  providers: [
    {
      id: "ark-chat",
      name: "Ark Chat",
      baseUrl: "https://ui-smoke.invalid/v1",
      apiKey: "ui-smoke-placeholder-key",
      ui: { groupId: "volcengine-ark", groupName: "火山方舟 Ark", order: 10 },
      models: [{ id: "ark-chat-model", name: "Ark Chat Model", presets: ["flash"], maxContextLength: 32768 }],
    },
    {
      id: "ark-code",
      name: "Ark Code",
      baseUrl: "https://ui-smoke.invalid/v1",
      apiKey: "ui-smoke-placeholder-key",
      ui: { groupId: "volcengine-ark", groupName: "火山方舟 Ark", order: 20 },
      models: [{ id: "ark-code-model", name: "Ark Code Model", presets: ["flash"], maxContextLength: 65536 }],
    },
  ],
}, null, 2), "utf8");
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
  const connectedPopoverLayout = await evaluate(cdp, `(() => {
    const actions = document.querySelector('.vhome-popover-actions-connected');
    const buttons = [...(actions?.querySelectorAll('button') || [])].map((button) => button.getBoundingClientRect());
    const close = document.querySelector('.vhome-popover-close')?.getBoundingClientRect();
    return {
      display: actions ? getComputedStyle(actions).display : '',
      buttons: buttons.map((rect) => ({ width: Math.round(rect.width), height: Math.round(rect.height) })),
      close: close ? { width: Math.round(close.width), height: Math.round(close.height) } : null,
    };
  })()`);
  if (connectedPopoverLayout.display !== 'grid' || connectedPopoverLayout.buttons.length !== 2 || Math.abs(connectedPopoverLayout.buttons[0].width - connectedPopoverLayout.buttons[1].width) > 1 || !connectedPopoverLayout.close || connectedPopoverLayout.close.width < 28 || connectedPopoverLayout.close.height < 28) {
    throw new Error(`V来家 connected popover layout is uneven: ${JSON.stringify(connectedPopoverLayout)}`);
  }
  await new Promise((resolveWait) => setTimeout(resolveWait, 120));
  await evaluate(cdp, `document.querySelector('.app-top').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))`);
  await waitForBrowserValue(cdp, `!document.querySelector('.vhome-popover')`, Boolean);
  await evaluate(cdp, `document.querySelector('.vhome-control-button').click()`);
  await waitForBrowserValue(cdp, `Boolean(document.querySelector('.vhome-popover'))`, Boolean);
  await new Promise((resolveWait) => setTimeout(resolveWait, 120));
  await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`);
  await waitForBrowserValue(cdp, `!document.querySelector('.vhome-popover')`, Boolean);
  await evaluate(cdp, `document.querySelector('.vhome-control-button').click()`);
  await waitForBrowserValue(cdp, `Boolean(document.querySelector('.vhome-popover'))`, Boolean);
  await evaluate(cdp, `document.querySelector('.vhome-popover-close').click()`);
  await waitForBrowserValue(cdp, `!document.querySelector('.vhome-popover')`, Boolean);
  console.log("[ui-smoke] V来家 connected popover aligns actions and dismisses outside, on Escape and from close");
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

  await evaluate(cdp, `(() => {
    const baseJob = {
      id: 'document:ui-scroll-test-00',
      kind: 'document',
      command: '整理大型技术文档并生成完整 Markdown 审核报告',
      status: 'completed_with_warnings',
      running: false,
      qualityPassed: false,
      previewAvailable: true,
      progress: { completed: 55, total: 55, unitLabel: '页', percent: 100, stage: 'completed', taskModelCalls: 24, currentLabel: 'PDF pages 51-55' },
      model: 'deepseek-official/deepseek-v4-flash',
      modelRole: 'fallback',
      outputPath: 'D:/workspace/large-document.md',
      sourcePaths: Array.from({ length: 8 }, (_, index) => 'D:/workspace/source/document-' + (index + 1) + '.pdf'),
      contract: { completionCriteria: Array.from({ length: 12 }, (_, index) => '完成条件 ' + (index + 1) + '：保留原文证据、页码和全部关键数据。') },
      warnings: Array.from({ length: 8 }, (_, index) => ({ type: 'quality-review', message: '第 ' + (index + 1) + ' 个区块需要人工复核。' })),
      modelHistory: Array.from({ length: 24 }, (_, index) => ({ providerId: 'deepseek-official', modelId: 'deepseek-v4-flash', role: index % 3 ? 'primary' : 'fallback', passed: index % 4 !== 0, attempts: index % 3 + 1 })),
      preview: { partial: true, content: Array.from({ length: 80 }, (_, index) => '## 草稿章节 ' + (index + 1) + '\\n用于验证后台任务详情滚动的长内容。').join('\\n\\n') },
      events: Array.from({ length: 30 }, (_, index) => ({ at: new Date(Date.now() - index * 60000).toISOString(), type: 'quality-review', batchId: 'batch-' + (index + 1) })),
    };
    const genericRunning = {
      id: 'task:ui-generic-running',
      taskType: 'report',
      kind: 'task',
      goal: '通用任务：正在生成运行报告',
      lifecycle: 'running',
      outcome: null,
      quality: 'unknown',
      active: true,
      revision: 3,
      progress: { completedUnits: 2, totalUnits: 5, unitLabel: '步骤' },
      allowedActions: ['pause', 'cancel'],
      artifactRefs: [],
    };
    const genericAttention = {
      id: 'task:ui-generic-attention',
      taskType: 'report',
      kind: 'task',
      goal: '通用任务：等待用户处理',
      lifecycle: 'waiting_user',
      outcome: null,
      quality: 'unknown',
      active: false,
      needsAttention: true,
      revision: 7,
      progress: { completedUnits: 4, totalUnits: 4, unitLabel: '步骤', percent: 100 },
      allowedActions: ['retry', 'resolve_user_input', 'cancel'],
      artifactRefs: [{ artifactId: 'draft-1', filename: '待复核报告.md', path: 'D:/workspace/waiting-report.md', mediaType: 'text/markdown' }],
      warnings: [{ message: '等待用户确认输出范围。' }],
      userAction: {
        requestId: 'request-ui-choice',
        question: '请选择是否继续复核。',
        choices: [{ id: 'continue-review', label: '继续复核' }, { id: 'stop-review', label: '停止复核' }]
      },
    };
    const genericDone = {
      id: 'task:ui-generic-done',
      taskType: 'report',
      kind: 'task',
      goal: '通用任务：已交付报告',
      lifecycle: 'terminal',
      outcome: 'delivered',
      quality: 'verified',
      active: false,
      revision: 9,
      progress: { completedUnits: 5, totalUnits: 5, unitLabel: '步骤', percent: 100 },
      allowedActions: ['ack_outcome'],
      artifactRefs: [{ artifactId: 'final-1', filename: '已交付报告.md', path: 'D:/workspace/final-report.md', mediaType: 'text/markdown' }],
    };
    const jobs = [
      ...Array.from({ length: 30 }, (_, index) => ({ ...baseJob, id: 'document:ui-scroll-test-' + String(index).padStart(2, '0'), command: baseJob.command + ' ' + (index + 1) })),
      genericRunning,
      genericAttention,
      genericDone,
    ];
    window.__backgroundJobsListReads = 0;
    window.__backgroundJobActions = [];
    const pendingDeliveries = [{ deliveryId: 'delivery-generic-done', taskId: genericDone.id, revision: genericDone.revision, outcome: 'delivered' }];
    window.__backgroundJobsOriginalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      const method = String(init.method || input?.method || 'GET').toUpperCase();
      if (method === 'GET' && url.pathname.endsWith('/background-jobs')) {
        window.__backgroundJobsListReads += 1;
        return new Response(JSON.stringify({ jobs, pendingDeliveries }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (method === 'GET' && url.pathname.includes('/background-jobs/')) {
        const id = decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf('/') + 1));
        const delayMs = id.endsWith('-00') ? 180 : id.endsWith('-01') ? 10 : 0;
        if (delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
        return new Response(JSON.stringify({ job: jobs.find((item) => item.id === id) || baseJob }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (method === 'POST' && url.pathname.includes('/background-jobs/')) {
        window.__backgroundJobActions.push(JSON.parse(init.body || '{}'));
        const id = decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf('/') + 1));
        return new Response(JSON.stringify({ job: jobs.find((item) => item.id === id) || baseJob }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return window.__backgroundJobsOriginalFetch(input, init);
    };
  })()`);
  await evaluate(cdp, `[...document.querySelectorAll('button.composer-chip-ghost')].find((item) => item.textContent.includes('后台'))?.click()`);
  await waitForBrowserValue(cdp, `(() => ({
    workbench: Boolean(document.querySelector('.background-jobs-workbench .background-jobs-detail')),
    chip: [...document.querySelectorAll('button.composer-chip-ghost')].find((item) => item.textContent.includes('后台'))?.textContent ?? '',
    error: document.querySelector('.notice.err')?.textContent ?? '',
  }))()`, (value) => value.workbench);
  await waitForBrowserValue(cdp, `(() => ({
    count: document.querySelectorAll('.background-job-list-item').length,
    groups: [...document.querySelectorAll('.background-job-group-title')].map((item) => item.textContent.trim()),
    detail: document.querySelector('.background-jobs-detail')?.textContent ?? '',
  }))()`, (value) => value.count >= 2);
  await evaluate(cdp, `[...document.querySelectorAll('.background-job-list-item')].find((item) => item.textContent.includes('审核报告 2'))?.click()`);
  await waitForBrowserValue(cdp, `document.querySelector('.background-jobs-detail h3')?.textContent.trim().endsWith(' 2')`, Boolean);
  await new Promise((resolveWait) => setTimeout(resolveWait, 240));
  const selectedBackgroundDetail = await evaluate(cdp, `document.querySelector('.background-jobs-detail h3')?.textContent.trim() || ''`);
  if (!selectedBackgroundDetail.endsWith(' 2')) throw new Error(`stale background detail replaced the latest selection: ${selectedBackgroundDetail}`);
  console.log("[ui-smoke] delayed background detail responses cannot replace the latest selection");
  await evaluate(cdp, `[...document.querySelectorAll('.background-job-list-item')].find((item) => item.textContent.includes('通用任务：等待用户处理'))?.click()`);
  const genericTaskProjection = await waitForBrowserValue(cdp, `(() => {
    const detail = document.querySelector('.background-jobs-detail');
    if (!detail?.textContent.includes('task:ui-generic-attention')) return null;
    return {
      groups: [...document.querySelectorAll('.background-job-group-title span:first-child')].map((item) => item.textContent.trim()),
      actions: [...document.querySelectorAll('.background-task-actions button')].map((item) => item.textContent.trim()),
      artifact: document.querySelector('.background-task-artifacts')?.textContent ?? '',
      text: detail.textContent,
    };
  })()`, Boolean);
  if (!genericTaskProjection.groups.includes('运行中') || !genericTaskProjection.groups.includes('需要处理') || !genericTaskProjection.actions.includes('重试') || !genericTaskProjection.actions.includes('提交处理结果') || !genericTaskProjection.actions.includes('取消任务') || !genericTaskProjection.artifact.includes('待复核报告.md') || !genericTaskProjection.text.includes('请选择是否继续复核')) {
    throw new Error(`generic background task projection is incomplete: ${JSON.stringify(genericTaskProjection)}`);
  }
  await evaluate(cdp, `(() => {
    window.__backgroundJobsOriginalPrompt = window.prompt;
    window.prompt = () => '1';
    [...document.querySelectorAll('.background-task-actions button')].find((item) => item.textContent.trim() === '提交处理结果')?.click();
  })()`);
  const choiceAction = await waitForBrowserValue(cdp, `window.__backgroundJobActions.find((item) => item.action === 'resolve_user_input') ?? null`, Boolean);
  if (choiceAction?.payload?.requestId !== 'request-ui-choice' || choiceAction?.payload?.choiceId !== 'continue-review' || typeof choiceAction.requestId !== 'string' || !choiceAction.requestId) {
    throw new Error(`generic background choice did not map to the durable choice id: ${JSON.stringify(choiceAction)}`);
  }
  await evaluate(cdp, `(() => { if (window.__backgroundJobsOriginalPrompt) window.prompt = window.__backgroundJobsOriginalPrompt; delete window.__backgroundJobsOriginalPrompt; })()`);
  await evaluate(cdp, `[...document.querySelectorAll('.background-task-actions button')].find((item) => item.textContent.trim() === '重试')?.click()`);
  const genericAction = await waitForBrowserValue(cdp, `window.__backgroundJobActions.at(-1) ?? null`, Boolean);
  if (genericAction.action !== 'retry' || genericAction.expectedRevision !== 7 || typeof genericAction.requestId !== 'string' || !genericAction.requestId) {
    throw new Error(`generic background action lost concurrency metadata: ${JSON.stringify(genericAction)}`);
  }
  const listReadsBeforeFocus = await evaluate(cdp, `window.__backgroundJobsListReads`);
  await evaluate(cdp, `window.dispatchEvent(new Event('focus'))`);
  await waitForBrowserValue(cdp, `window.__backgroundJobsListReads`, (value) => value > listReadsBeforeFocus);
  console.log("[ui-smoke] generic background tasks group, render artifacts, gate actions and refresh on focus");
  await evaluate(cdp, `[...document.querySelectorAll('.background-job-list-item')].find((item) => item.textContent.includes('审核报告 2'))?.click()`);
  await waitForBrowserValue(cdp, `document.querySelector('.background-jobs-detail h3')?.textContent.trim().endsWith(' 2')`, Boolean);
  const measureBackgroundWorkbench = async (width, height) => {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await new Promise((resolveWait) => setTimeout(resolveWait, 120));
    return evaluate(cdp, `(() => {
      const layout = document.querySelector('.background-jobs-layout');
      const list = layout?.querySelector('.background-jobs-list');
      const detail = layout?.querySelector('.background-jobs-detail');
      if (!layout || !list || !detail) return null;
      detail.scrollTop = 0;
      detail.scrollTop = 120;
      list.scrollTop = 0;
      list.scrollTop = 120;
      const layoutRect = layout.getBoundingClientRect();
      const detailRect = detail.getBoundingClientRect();
      const inputArea = document.querySelector('.chat-input-area');
      const modelButton = [...document.querySelectorAll('button.composer-chip-ghost')].find((item) => item.textContent.includes('模型'));
      const closeButton = document.querySelector('.background-jobs-close');
      const rect = (element) => {
        const value = element.getBoundingClientRect();
        return { x: Math.round(value.x), y: Math.round(value.y), width: Math.round(value.width), height: Math.round(value.height), bottom: Math.round(value.bottom) };
      };
      return {
        detailClientHeight: detail.clientHeight,
        detailScrollHeight: detail.scrollHeight,
        detailScrollTop: detail.scrollTop,
        listClientHeight: list.clientHeight,
        listScrollHeight: list.scrollHeight,
        listScrollTop: list.scrollTop,
        detailClipped: detailRect.bottom > layoutRect.bottom + 1,
        inputVisible: Boolean(inputArea && getComputedStyle(inputArea).display !== 'none' && inputArea.getBoundingClientRect().height > 0),
        modelButtonVisible: Boolean(modelButton && getComputedStyle(modelButton).display !== 'none' && modelButton.getBoundingClientRect().height > 0),
        closeButton: closeButton ? { text: closeButton.textContent.trim(), width: Math.round(closeButton.getBoundingClientRect().width), height: Math.round(closeButton.getBoundingClientRect().height) } : null,
        layoutRect: rect(layout),
        detailRect: rect(detail),
        workbenchRect: rect(layout.closest('.background-jobs-workbench')),
        chatMainRect: rect(layout.closest('.chat-main')),
      };
    })()`);
  };
  const lowBackgroundLayout = await measureBackgroundWorkbench(640, 650);
  const stackedBackgroundLayout = await measureBackgroundWorkbench(640, 800);
  const compactBackgroundLayout = await measureBackgroundWorkbench(800, 650);
  const wideBackgroundLayout = await measureBackgroundWorkbench(1280, 800);
  for (const [label, value] of [["low", lowBackgroundLayout], ["stacked", stackedBackgroundLayout], ["compact", compactBackgroundLayout], ["wide", wideBackgroundLayout]]) {
    if (!value || value.detailScrollHeight <= value.detailClientHeight || value.detailScrollTop <= 0 || value.listScrollHeight <= value.listClientHeight || value.listScrollTop <= 0 || value.detailClipped || !value.inputVisible || !value.modelButtonVisible || value.closeButton?.text !== '←返回对话' || value.closeButton.width < 104 || value.closeButton.height < 36) {
      throw new Error(`background workbench ${label} scrolling failed: ${JSON.stringify(value)}`);
    }
  }
  await evaluate(cdp, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`);
  await waitForBrowserValue(cdp, `!document.querySelector('.background-jobs-workbench')`, Boolean);
  await evaluate(cdp, `[...document.querySelectorAll('button.composer-chip-ghost')].find((item) => item.textContent.includes('后台'))?.click()`);
  await waitForBrowserValue(cdp, `Boolean(document.querySelector('.background-jobs-workbench'))`, Boolean);
  await evaluate(cdp, `[...document.querySelectorAll('button.composer-chip-ghost')].find((item) => item.textContent.includes('后台'))?.click()`);
  await waitForBrowserValue(cdp, `!document.querySelector('.background-jobs-workbench')`, Boolean);
  await evaluate(cdp, `[...document.querySelectorAll('button.composer-chip-ghost')].find((item) => item.textContent.includes('后台'))?.click()`);
  await waitForBrowserValue(cdp, `Boolean(document.querySelector('.background-jobs-workbench'))`, Boolean);
  await evaluate(cdp, `document.querySelector('.background-jobs-close')?.click()`);
  await waitForBrowserValue(cdp, `!document.querySelector('.background-jobs-workbench')`, Boolean);
  await evaluate(cdp, `(() => { window.fetch = window.__backgroundJobsOriginalFetch; delete window.__backgroundJobsOriginalFetch; })()`);
  console.log("[ui-smoke] background jobs preserve the composer, scroll across four layouts and close through all entry points");

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
    const chip = [...document.querySelectorAll('.composer-chip-ghost')].find((item) => item.textContent.includes('模型'));
    if (!chip) throw new Error('model picker not found');
    chip.click();
  })()`);
  await waitForBrowserValue(cdp, `(() => {
    const picker = document.querySelector('.model-popover');
    return Boolean(
      picker
      && !picker.querySelector('.model-search')
      && picker.querySelectorAll('.model-provider-trigger').length === 1
      && picker.querySelector('.model-provider-trigger')?.textContent.includes('火山方舟 Ark')
      && picker.querySelector('#provider-import-file')
      && !picker.querySelector('.model-manage-link')
      && [...picker.querySelectorAll('button')].some((item) => item.textContent.includes('检测全部模型'))
    );
  })()`, Boolean);
  const providerTriggerPoint = await evaluate(cdp, `(() => {
    const rect = document.querySelector('.model-provider-trigger')?.getBoundingClientRect();
    return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) } : null;
  })()`);
  if (!providerTriggerPoint) throw new Error('model provider trigger point not found');
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: providerTriggerPoint.x, y: providerTriggerPoint.y });
  const cascadingModels = await waitForBrowserValue(cdp, `(() => ({
    label: document.querySelector('.model-cascade-submenu')?.getAttribute('aria-label') || '',
    models: [...document.querySelectorAll('.model-cascade-submenu .model-cascade-model')].map((item) => item.textContent.trim()),
  }))()`, (value) => value.models.length === 2);
  if (cascadingModels.label !== '火山方舟 Ark 模型' || !cascadingModels.models.some((name) => name.includes('Ark Chat Model')) || !cascadingModels.models.some((name) => name.includes('Ark Code Model'))) {
    throw new Error(`grouped model submenu is incomplete: ${JSON.stringify(cascadingModels)}`);
  }
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1270, y: 20 });
  await waitForBrowserValue(cdp, `!document.querySelector('.model-cascade-submenu') && Boolean(document.querySelector('.model-popover'))`, Boolean);
  await evaluate(cdp, `(() => {
    window.__modelImportOriginalFetch = window.fetch.bind(window);
    window.__modelImportCalls = [];
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.pathname.endsWith('/providers/import/preview')) {
        window.__modelImportCalls.push('preview');
        return new Response(JSON.stringify({ requiresConfirmation: false, actions: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.pathname.endsWith('/providers/import')) {
        window.__modelImportCalls.push('import');
        return new Response(JSON.stringify({ ok: true, count: 2, requiresModelTest: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return window.__modelImportOriginalFetch(input, init);
    };
    const input = document.querySelector('#provider-import-file');
    const file = new File([JSON.stringify({ schemaVersion: 3, operations: [{ op: 'ui-smoke' }] })], 'providers.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitForBrowserValue(cdp, `window.__modelImportCalls?.join(',')`, (value) => value === 'preview,import');
  await waitForBrowserValue(cdp, `document.querySelector('.model-popover [role="status"]')?.textContent.includes('配置导入成功')`, Boolean);
  await evaluate(cdp, `(() => { window.fetch = window.__modelImportOriginalFetch; delete window.__modelImportOriginalFetch; delete window.__modelImportCalls; })()`);
  console.log("[ui-smoke] grouped model submenu hover lifecycle and one-step import passed");

  await evaluate(cdp, `(() => {
    const chip = [...document.querySelectorAll('button.composer-chip-ghost')].find((item) => item.textContent.includes('🔍'));
    if (!chip) throw new Error('index retrieval chip not found');
    chip.click();
  })()`);
  await waitForBrowserValue(cdp, `Boolean([...document.querySelectorAll('.composer-plus-menu .popover-row')].find((item) => item.textContent.includes('不使用')))`, Boolean);
  await evaluate(cdp, `[...document.querySelectorAll('.composer-plus-menu .popover-row')].find((item) => item.textContent.includes('不使用'))?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  console.log("[ui-smoke] index chip popup change dispatched");
  await waitForApiValue(`http://127.0.0.1:${port}/api/index-retrieval-mode?token=${token}`, (value) => value.mode === "off");
  console.log("[ui-smoke] index mode persisted by API");

  await evaluate(cdp, `document.querySelector('.work-mode-picker .mode-btn:not(.active)')?.click()`);
  console.log("[ui-smoke] work-mode switch dispatched");
  await waitForBrowserValue(cdp, `[...document.querySelectorAll('button.composer-chip-ghost')].find((item) => item.textContent.includes('🔍'))?.textContent ?? ''`, (value) => value.includes('索引关'));
  console.log("[ui-smoke] index mode survived work-mode switch");
  await evaluate(cdp, `window.confirm = () => true`);
  await evaluate(cdp, `(() => { const btn = document.querySelector('.status-new-btn'); if (!btn) throw new Error('status new button not found'); btn.click(); })()`);
  console.log("[ui-smoke] new-session action dispatched");
  await waitForApiValue(`http://127.0.0.1:${port}/api/messages?limit=1&token=${token}`, (value) => value.totalMessages === 1);
  await waitForBrowserValue(cdp, `[...document.querySelectorAll('button.composer-chip-ghost')].find((item) => item.textContent.includes('🔍'))?.textContent ?? ''`, (value) => value.includes('索引关'));
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
  await waitForBrowserValue(cdp, `[...document.querySelectorAll('button.composer-chip-ghost')].find((item) => item.textContent.includes('🔍'))?.textContent ?? ''`, (value) => value.includes('索引关'));
  console.log(`[ui-smoke] Dashboard rendered; long-session input p95=${performance.p95Ms.toFixed(2)}ms, max=${performance.maxMs.toFixed(2)}ms, DOM messages=${performance.renderedMessages}`);
} catch (error) {
  console.error(`[ui-smoke] ${error.message}`);
  if (launcherError) console.error(launcherError.slice(-2000));
  process.exitCode = 1;
} finally {
  if (cdp) cdp.socket.close();
  terminateProcessTree(edgeProcess);
  terminateProcessTree(launcher);
  await removeTempRoot(tempRoot);
}
