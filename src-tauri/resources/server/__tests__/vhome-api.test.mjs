import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

const { dispatch } = await import(new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url).href);
const TOKEN = "vhome-api-test-token";

function mockResponse() {
  let status = null;
  let headers = null;
  let body = null;
  return {
    writeHead(value, valueHeaders = {}) { status = value; headers = valueHeaders; },
    end(value) { body = value; },
    get status() { return status; },
    get headers() { return headers; },
    get body() { return body; },
    get json() { return body ? JSON.parse(body) : null; },
  };
}

async function request(method, path, ctx, body = {}) {
  const req = method === "GET" ? {} : Readable.from([Buffer.from(JSON.stringify(body))]);
  req.url = path;
  req.method = method;
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  const res = mockResponse();
  await dispatch(req, res, ctx, TOKEN);
  return res;
}

test("V来家 status API exposes only the sanitized identity", async () => {
  const status = {
    available: true,
    connected: true,
    authenticated: true,
    userName: "测试用户",
    corpName: "测试组织",
    reason: null,
    checkedAt: "2026-07-13T12:00:00.000Z",
    login: { state: "idle", loginUrl: null, userCode: null, expiresAt: null, reason: null },
  };
  const res = await request("GET", "/api/vhome/status", { getVHomeStatus: async () => status });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, status);
  assert.equal(Object.hasOwn(res.json, "token"), false);
  assert.equal(Object.hasOwn(res.json, "userId"), false);
  assert.equal(Object.hasOwn(res.json, "corpId"), false);
});

test("V来家 avatar API returns only authenticated image bytes", async () => {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const ctx = {
    getVHomeAvatar: async () => ({ body: bytes, contentType: "image/png", etag: '"avatar-etag"' }),
  };
  const res = await request("GET", "/api/vhome/avatar", ctx);
  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"], "image/png");
  assert.equal(res.headers.etag, '"avatar-etag"');
  assert.deepEqual(res.body, bytes);

  const unavailable = await request("GET", "/api/vhome/avatar", { getVHomeAvatar: async () => null });
  assert.equal(unavailable.status, 404);
  assert.equal(unavailable.headers["cache-control"], "private, max-age=60");

  const invalid = await request("GET", "/api/vhome/avatar", {
    getVHomeAvatar: async () => ({ body: Buffer.from("not-an-image"), contentType: "text/plain" }),
  });
  assert.equal(invalid.status, 404);
});

test("V来家 lifecycle API starts, cancels, refreshes, and logs out", async () => {
  const status = {
    available: true,
    connected: false,
    authenticated: false,
    userName: null,
    corpName: null,
    reason: "authentication-required",
    checkedAt: "2026-07-13T12:00:00.000Z",
    login: { state: "starting", loginUrl: null, userCode: null, expiresAt: null, reason: null },
  };
  const calls = [];
  const ctx = {
    startVHomeLogin: async () => { calls.push("start"); return status; },
    cancelVHomeLogin: async () => { calls.push("cancel"); return { ...status, login: { ...status.login, state: "cancelled" } }; },
    refreshVHomeStatus: async () => { calls.push("refresh"); return status; },
    logoutVHome: async () => { calls.push("logout"); return { ...status, login: { ...status.login, state: "idle" } }; },
  };

  assert.equal((await request("POST", "/api/vhome/login", ctx)).status, 202);
  assert.equal((await request("DELETE", "/api/vhome/login", ctx)).json.login.state, "cancelled");
  assert.equal((await request("POST", "/api/vhome/refresh", ctx)).status, 200);
  const loggedOut = await request("POST", "/api/vhome/logout", ctx);
  assert.equal(loggedOut.status, 200);
  assert.deepEqual(calls, ["start", "cancel", "refresh", "logout"]);
  assert.equal(Object.hasOwn(loggedOut.json, "token"), false);
  assert.equal(Object.hasOwn(loggedOut.json, "corpId"), false);
});

test("external URL API forwards a structured browser choice", async () => {
  const calls = [];
  const ctx = {
    openExternalUrl: async (url, options) => {
      calls.push({ url, options });
      return { opened: true, browser: options.browser };
    },
  };
  const result = await request("POST", "/api/open-url", ctx, {
    url: "https://login.dingtalk.com/device?user_code=TEST-CODE",
    browser: "edge",
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { opened: true, browser: "edge" });
  assert.deepEqual(calls, [{
    url: "https://login.dingtalk.com/device?user_code=TEST-CODE",
    options: { browser: "edge" },
  }]);
});
