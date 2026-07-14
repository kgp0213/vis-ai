import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createVHomeIntegration } from "../lib/vhome-integration.mjs";

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => child.emit("close", null, "SIGTERM");
  return child;
}

function cssThemeVariables(css, theme) {
  const root = css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? "";
  const themed = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`))?.[1] ?? "";
  return Object.fromEntries([...`${root}\n${themed}`.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((match) => [match[1], match[2]]));
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("V来家 integration", () => {
  test("confirms authentication and API access before exposing the display identity", async () => {
    const calls = [];
    const integration = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      now: () => Date.parse("2026-07-13T12:00:00Z"),
      execute: async (_executable, args) => {
        calls.push(args);
        if (args[0] === "auth") return JSON.stringify({ success: true, authenticated: true, token_valid: true, user_name: "fallback" });
        return JSON.stringify({ success: true, result: [{ orgEmployeeModel: { orgUserName: " Test User\n", orgName: " Test Corp " } }] });
      },
    });

    const first = await integration.getStatus();
    const cached = await integration.getStatus();
    assert.deepEqual(first, {
      available: true,
      connected: true,
      authenticated: true,
      userName: "Test User",
      corpName: "Test Corp",
      reason: null,
      checkedAt: "2026-07-13T12:00:00.000Z",
      login: { state: "idle", loginUrl: null, userCode: null, expiresAt: null, reason: null },
    });
    assert.deepEqual(cached, first);
    assert.deepEqual(calls, [
      ["auth", "status", "--format", "json"],
      ["contact", "user", "get-self", "--format", "json"],
    ]);
  });

  test("does not call the identity API when login is unavailable", async () => {
    let calls = 0;
    const integration = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      execute: async () => {
        calls++;
        return JSON.stringify({ success: true, authenticated: false, token_valid: false });
      },
    });
    const status = await integration.getStatus();
    assert.equal(calls, 1);
    assert.equal(status.available, true);
    assert.equal(status.connected, false);
    assert.equal(status.reason, "authentication-required");
    assert.equal(status.userName, null);
  });

  test("uses get-self to refresh a renewable login before declaring it unavailable", async () => {
    let calls = 0;
    const integration = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      execute: async (_executable, args) => {
        calls++;
        if (args[0] === "auth") return JSON.stringify({ success: true, authenticated: true, token_valid: false, refresh_token_valid: true });
        return JSON.stringify({ success: true, result: [{ orgEmployeeModel: { orgUserName: "Renewed User", orgName: "Corp" } }] });
      },
    });
    const status = await integration.getStatus();
    assert.equal(calls, 2);
    assert.equal(status.connected, true);
    assert.equal(status.userName, "Renewed User");
  });

  test("degrades safely for a missing binary or invalid command output", async () => {
    const missing = createVHomeIntegration({ executable: "missing.exe", executableExists: () => false });
    assert.equal((await missing.getStatus()).reason, "dws-not-found");

    const invalid = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      execute: async () => "not-json",
    });
    const status = await invalid.getStatus();
    assert.equal(status.connected, false);
    assert.equal(status.reason, "communication-failed");
    assert.equal(Object.hasOwn(status, "error"), false);
  });

  test("starts Device Flow only on request and exposes sanitized authorization hints", async () => {
    const child = fakeChild();
    const spawned = [];
    let authenticated = false;
    const integration = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      spawnProcess: (_executable, args) => {
        spawned.push(args);
        return child;
      },
      execute: async (_executable, args) => {
        if (args[0] === "contact") {
          return JSON.stringify({ success: true, result: [{ orgEmployeeModel: { orgUserName: "Test User", orgName: "Test Corp" } }] });
        }
        return JSON.stringify({
          success: true,
          authenticated,
          token_valid: authenticated,
          refresh_token_valid: authenticated,
          corp_id: authenticated ? "corp-secret-id" : null,
        });
      },
    });

    const before = await integration.getStatus();
    assert.equal(before.login.state, "idle");
    assert.deepEqual(spawned, []);

    const started = await integration.startLogin();
    assert.equal(started.login.state, "starting");
    assert.deepEqual(spawned, [["auth", "login", "--device", "--recommend"]]);
    child.stdout.write("link: https://login.dingtalk.com/oauth2/device/verify.htm?user_code=ABCD-EFGH\nauthorization code: ABCD-EFGH\n(expires in 900 seconds)\n");
    await new Promise((resolve) => setImmediate(resolve));
    const waiting = await integration.getStatus();
    assert.equal(waiting.login.state, "awaiting-user");
    assert.equal(waiting.login.userCode, "ABCD-EFGH");
    assert.match(waiting.login.loginUrl, /^https:\/\/login\.dingtalk\.com\//);
    assert.equal(Object.hasOwn(waiting, "corpId"), false);
    assert.equal(Object.hasOwn(waiting, "token"), false);

    authenticated = true;
    child.emit("close", 0);
    for (let index = 0; index < 4; index++) await new Promise((resolve) => setImmediate(resolve));
    const connected = await integration.getStatus();
    assert.equal(connected.connected, true);
    assert.equal(connected.login.state, "idle");
  });

  test("parses localized and URL-only Device Flow hints across output chunks", async () => {
    const localizedChild = fakeChild();
    const localized = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      spawnProcess: () => localizedChild,
      execute: async () => JSON.stringify({ success: true, authenticated: false, token_valid: false }),
    });

    await localized.startLogin();
    localizedChild.stdout.write("\u001b[33m授权地址：https://login.dingtalk.com/oauth2/device/verify.htm\u001b[0m\n授");
    localizedChild.stdout.write("权码：ZXCV-1234\n（900 秒后过期）\n");
    await new Promise((resolve) => setImmediate(resolve));
    const localizedStatus = await localized.getStatus();
    assert.equal(localizedStatus.login.state, "awaiting-user");
    assert.equal(localizedStatus.login.userCode, "ZXCV-1234");
    assert.equal(new URL(localizedStatus.login.loginUrl).searchParams.get("user_code"), "ZXCV-1234");
    assert.ok(localizedStatus.login.expiresAt);
    await localized.cancelLogin();

    const urlOnlyChild = fakeChild();
    const urlOnly = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      spawnProcess: () => urlOnlyChild,
      execute: async () => JSON.stringify({ success: true, authenticated: false, token_valid: false }),
    });

    await urlOnly.startLogin();
    urlOnlyChild.stderr.write("Or open: https://login.dingtalk.com/oauth2/device/verify.htm?user_code=URL-5678).\n");
    await new Promise((resolve) => setImmediate(resolve));
    const urlOnlyStatus = await urlOnly.getStatus();
    assert.equal(urlOnlyStatus.login.state, "awaiting-user");
    assert.equal(urlOnlyStatus.login.userCode, "URL-5678");
    assert.equal(new URL(urlOnlyStatus.login.loginUrl).searchParams.get("user_code"), "URL-5678");
    await urlOnly.cancelLogin();
  });

  test("fails with a retryable state when DWS never provides authorization hints", async () => {
    const child = fakeChild();
    const timers = [];
    const integration = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      spawnProcess: () => child,
      execute: async () => JSON.stringify({ success: true, authenticated: false, token_valid: false }),
      loginHintTimeoutMs: 25,
      loginTimeoutMs: 1_000,
      setTimer: (callback, delay) => {
        const timer = { callback, delay, cleared: false, unref() {} };
        timers.push(timer);
        return timer;
      },
      clearTimer: (timer) => { timer.cleared = true; },
    });

    const started = await integration.startLogin();
    assert.equal(started.login.state, "starting");
    assert.equal(started.login.loginUrl, null);
    assert.equal(started.login.userCode, null);
    const hintTimer = timers.find((timer) => timer.delay === 25);
    assert.ok(hintTimer);
    hintTimer.callback();

    const failed = await integration.getStatus();
    assert.equal(failed.login.state, "failed");
    assert.equal(failed.login.reason, "login-link-unavailable");
    assert.match(failed.login.message, /没有返回授权链接/);
  });

  test("logs the DWS process lifecycle and returns an actionable network failure", async () => {
    const child = fakeChild();
    const logs = [];
    const integration = createVHomeIntegration({
      executable: "C:\\Program Files\\Visionox-Whale\\resources\\server\\dws.exe",
      executableExists: () => true,
      logger: { error: (...args) => logs.push(args.join(" ")) },
      spawnProcess: () => child,
      execute: async () => JSON.stringify({ success: true, authenticated: false, token_valid: false }),
    });

    await integration.startLogin();
    child.stderr.write("Error: proxyconnect tcp: dial tcp 10.0.0.1:443: connection refused\n");
    child.emit("close", 1, null);
    await new Promise((resolve) => setImmediate(resolve));

    const failed = await integration.getStatus();
    assert.equal(failed.login.state, "failed");
    assert.equal(failed.login.reason, "login-network-failed");
    assert.match(failed.login.message, /网络、代理或防火墙/);
    assert.match(failed.login.detail, /proxyconnect tcp/);
    assert.equal(Object.hasOwn(failed.login, "stdout"), false);
    assert.equal(Object.hasOwn(failed.login, "stderr"), false);
    const output = logs.join("\n");
    assert.match(output, /login requested: executable=.*dws\.exe/);
    assert.match(output, /login process starting: executable=.*dws\.exe/);
    assert.match(output, /login process closed: exitCode=1, signal=none/);
    assert.match(output, /login process loginOutput \(raw, tail\):[\s\S]*proxyconnect tcp/);
    assert.match(output, /login failure stderr \(raw, tail\):[\s\S]*connection refused/);
    assert.match(output, /login failed: reason=login-network-failed/);
  });

  test("logs startup failures with their stable reason", async () => {
    const logs = [];
    const integration = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      logger: { error: (...args) => logs.push(args.join(" ")) },
      spawnProcess: () => { throw new Error("CreateProcess failed"); },
      execute: async () => JSON.stringify({ success: true, authenticated: false, token_valid: false }),
    });

    const failed = await integration.startLogin();
    assert.equal(failed.login.state, "failed");
    assert.equal(failed.login.reason, "login-start-failed");
    assert.match(failed.login.message, /无法启动/);
    assert.match(logs.join("\n"), /login failed: reason=login-start-failed/);
  });

  test("keeps confirming after Device Flow exits until delayed credentials are available", async () => {
    const child = fakeChild();
    let authenticated = false;
    let confirmationWaits = 0;
    const integration = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      spawnProcess: () => child,
      loginConfirmAttempts: 3,
      loginConfirmIntervalMs: 1,
      sleep: async () => {
        confirmationWaits++;
        authenticated = true;
      },
      execute: async (_executable, args) => {
        if (args[0] === "contact") {
          return JSON.stringify({ success: true, result: [{ orgEmployeeModel: { orgUserName: "Delayed User", orgName: "Test Corp" } }] });
        }
        return JSON.stringify({
          success: true,
          authenticated,
          token_valid: authenticated,
          refresh_token_valid: authenticated,
        });
      },
    });

    await integration.startLogin();
    child.emit("close", 0);
    for (let index = 0; index < 6; index++) await new Promise((resolve) => setImmediate(resolve));

    const connected = await integration.getStatus();
    assert.equal(confirmationWaits, 1);
    assert.equal(connected.connected, true);
    assert.equal(connected.userName, "Delayed User");
    assert.equal(connected.login.state, "idle");
  });

  test("surfaces a DWS network error that occurs while confirming completed authorization", async () => {
    const child = fakeChild();
    let calls = 0;
    const integration = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      spawnProcess: () => child,
      loginConfirmAttempts: 1,
      execute: async () => {
        calls++;
        if (calls === 1) return JSON.stringify({ success: true, authenticated: false, token_valid: false });
        const error = new Error("dws auth status failed");
        error.stderr = "request failed: dial tcp: network is unreachable";
        throw error;
      },
    });

    await integration.startLogin();
    child.emit("close", 0, null);
    for (let index = 0; index < 3; index++) await new Promise((resolve) => setImmediate(resolve));

    const failed = await integration.getStatus();
    assert.equal(failed.login.state, "failed");
    assert.equal(failed.login.reason, "login-network-failed");
    assert.match(failed.login.message, /网络、代理或防火墙/);
    assert.match(failed.login.detail, /network is unreachable/);
  });

  test("stops login confirmation after the user cancels it", async () => {
    const child = fakeChild();
    let releaseWait;
    const waiting = new Promise((resolve) => { releaseWait = resolve; });
    const integration = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      spawnProcess: () => child,
      loginConfirmAttempts: 3,
      sleep: () => waiting,
      execute: async () => JSON.stringify({ success: true, authenticated: false, token_valid: false }),
    });

    await integration.startLogin();
    child.emit("close", 0);
    await new Promise((resolve) => setImmediate(resolve));
    const cancelled = await integration.cancelLogin();
    releaseWait();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(cancelled.login.state, "idle");
    assert.equal((await integration.getStatus()).login.state, "idle");
  });

  test("logs out only the current organization and clears the connected identity", async () => {
    const calls = [];
    let authenticated = true;
    const integration = createVHomeIntegration({
      executable: "dws-test.exe",
      executableExists: () => true,
      execute: async (_executable, args) => {
        calls.push(args);
        if (args[0] === "contact") {
          return JSON.stringify({ success: true, result: [{ orgEmployeeModel: { orgUserName: "Test User", orgName: "Test Corp" } }] });
        }
        if (args[1] === "logout") {
          authenticated = false;
          return JSON.stringify({ success: true });
        }
        return JSON.stringify({
          success: true,
          authenticated,
          token_valid: authenticated,
          refresh_token_valid: authenticated,
          corp_id: authenticated ? "current-corp" : null,
        });
      },
    });

    assert.equal((await integration.getStatus()).connected, true);
    const loggedOut = await integration.logout();
    assert.equal(loggedOut.connected, false);
    assert.equal(loggedOut.reason, "authentication-required");
    assert.ok(calls.some((args) => JSON.stringify(args) === JSON.stringify(["auth", "logout", "--profile", "current-corp", "--yes", "--format", "json"])));
  });

  test("shows the connected user in the sidebar without probing on the startup path", () => {
    const app = readFileSync(new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url), "utf8");
    const css = readFileSync(new URL("../visionox-pkg/dashboard/app.css", import.meta.url), "utf8");
    const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
    const desktop = readFileSync(new URL("../../../src/lib.rs", import.meta.url), "utf8");
    assert.match(app, /usePoll\("\/vhome\/status", 3e5\)/);
    assert.match(app, /vhomeStatus\?\.connected === true/);
    assert.match(app, /sidebarIdentity = vhomeConnected \? vhomeStatus\.userName : "127\.0\.0\.1"/);
    assert.match(app, /api\("\/vhome\/login", \{ method: "POST"/);
    assert.match(app, /api\("\/vhome\/logout", \{ method: "POST"/);
    assert.match(app, /replaceData: replaceVHomeStatus/);
    assert.match(app, /const nextStatus = await api\("\/vhome\/logout"[\s\S]*?replaceVHomeStatus\(nextStatus\)[\s\S]*?setVhomeMenuOpen\(false\)/);
    assert.match(app, /const requestRevision = A2\(0\)/);
    assert.match(app, /const finishVHomeLogin[\s\S]*?nextLoginState === "idle"[\s\S]*?setVhomeMenuOpen\(false\)/);
    assert.match(app, /finishVHomeLogin\(vhomeStatus\)/);
    assert.match(app, /const nextStatus = await api\("\/vhome\/refresh"[\s\S]*?finishVHomeLogin\(replaceVHomeStatus\(nextStatus\)\)/);
    assert.match(app, /refreshVHome\(\)\.then\(finishVHomeLogin\)/);
    assert.match(app, /const startVHomeLogin[\s\S]*?setVhomeMenuOpen\(true\)/);
    assert.match(app, /const nextStatus = await api\("\/vhome\/login"[\s\S]*?replaceVHomeStatus\(nextStatus\)[\s\S]*?setVhomeMenuOpen\(true\)[\s\S]*?finishVHomeLogin\(nextStatus\)/);
    assert.match(app, /class="vhome-control"/);
    assert.match(app, /授权等待期间可以继续使用 AI 和其他本地功能/);
    assert.match(app, /copyVHomeValue\(vhomeLoginUrl, "授权链接"\)/);
    assert.match(app, /openVHomeAuthorization\("edge"\)/);
    assert.match(app, /const vhomeAuthorizationReady = Boolean/);
    assert.match(app, /const vhomeLoginPreparing = vhomeLoginState === "starting" && !vhomeAuthorizationReady/);
    assert.match(app, /正在获取授权链接，请稍候/);
    assert.match(app, /function vhomeLoginFailureMessage/);
    assert.match(app, /无法连接 V来家授权服务，请检查网络、代理或防火墙后重试/);
    assert.match(app, /DWS 诊断：\$\{vhomeLoginDetail\}/);
    assert.doesNotMatch(app, /授权未完成，请重新生成授权链接/);
    assert.match(app, /vhomeAuthorizationReady && vhomeLoginActive && !vhomeLoginExpired/);
    assert.match(app, />我已完成授权</);
    assert.match(app, />重新生成链接</);
    assert.match(app, /title=\$\{sidebarIdentityTitle\}>\$\{sidebarIdentity\}/);
    assert.match(launcher, /createVHomeIntegration\(\{ executable: dwsExecutable, logger: console \}\)/);
    assert.match(launcher, /getSendContext: \(\) => \(\{ \.\.\.activeMessageSendContext \}\)/);
    assert.match(launcher, /buildMessageRiskPrompt\(message\)/);
    assert.match(launcher, /source: operation\.kind/);
    assert.match(launcher, /clearMessageSendContext\(operation\)/);
    assert.match(launcher, /getVHomeStatus: \(\) => getVHomeStatusAndResumeSchedules\(\)/);
    assert.match(launcher, /startVHomeLogin: \(\) => vhomeIntegration\.startLogin\(\)/);
    assert.match(launcher, /marker\.version === sourceVersion/);
    assert.ok(launcher.indexOf("startDashboardServer(ctx") > launcher.indexOf("getVHomeStatus: () => getVHomeStatusAndResumeSchedules()"));
    assert.match(launcher, /if \(skill\.name === "dws"\) \{[\s\S]*?await vhomeIntegration\.getStatus\(\)/);
    assert.match(desktop, /std::iter::once\(server_dir\.clone\(\)\)/);
    assert.match(desktop, /\.env\("PATH", runtime_path\)/);
    assert.match(css, /\.side-foot \.label \{[\s\S]*?text-overflow: ellipsis/);
    assert.match(css, /\.vhome-popover \{[\s\S]*?position: fixed/);
    assert.match(css, /\.vhome-popover-actions button\.primary \{[\s\S]*?background: var\(--accent-primary\);[\s\S]*?color: var\(--accent-contrast\)/);
    assert.match(css, /\.vhome-login-link \{[\s\S]*?background: var\(--surface-input\)/);
  });

  test("keeps primary button text readable in every selectable theme", () => {
    const css = readFileSync(new URL("../visionox-pkg/dashboard/app.css", import.meta.url), "utf8");
    const themes = ["light", "dark", "warm-sand", "cool-ash", "soft-sage", "espresso", "midnight-ink", "deep-charcoal"];
    for (const theme of themes) {
      const variables = cssThemeVariables(css, theme);
      assert.ok(contrastRatio(variables["accent-primary"], variables["accent-contrast"]) >= 4.5, `${theme} primary button contrast`);
      assert.ok(contrastRatio(variables["accent-primary-hover"], variables["accent-hover-contrast"]) >= 4.5, `${theme} primary hover contrast`);
    }
  });
});
