import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";

const tmpRoot = mkdtempSync(join(tmpdir(), "visionox-session-integrity-"));
const tmpHome = join(tmpRoot, "home");
const tmpWorkspace = join(tmpRoot, "workspace");
mkdirSync(tmpHome, { recursive: true });
mkdirSync(tmpWorkspace, { recursive: true });
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const sessionUrl = new URL("../visionox-pkg/dist/cli/chunk-6PBZN4VI.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const { renameSession, sessionPath } = await import(sessionUrl.href);
const TOKEN = "session-integrity-test-token";

after(() => rmSync(tmpRoot, { recursive: true, force: true }));

function mockRes() {
  let status = null;
  let body = null;
  return {
    writeHead(value) { status = value; },
    end(value) { body = value; },
    get status() { return status; },
    get json() { try { return body ? JSON.parse(body) : null; } catch { return null; } },
  };
}

function mockCtx(overrides = {}) {
  return {
    configPath: join(tmpRoot, "config.json"),
    mode: "desktop",
    getModes: () => ({ current: "general", list: [], active: null }),
    getEccRules: () => null,
    getSessionName: () => null,
    getCurrentCwd: () => tmpWorkspace,
    loop: { model: "test-model" },
    syncProvider: async () => {},
    refreshContextCap: () => {},
    usageLogPath: join(tmpRoot, "usage.log"),
    getGeneratedArtifactPaths: () => [],
    ...overrides,
  };
}

async function api(method, path, body = null, ctxOverrides = {}) {
  const req = body === null || body === undefined
    ? { url: path, method, headers: { "x-reasonix-token": TOKEN } }
    : Readable.from([Buffer.from(JSON.stringify(body))]);
  req.url = path;
  req.method = method;
  req.headers = {
    "x-reasonix-token": TOKEN,
    ...(body === null || body === undefined ? {} : { "content-type": "application/json" }),
  };
  const res = mockRes();
  await dispatch(req, res, mockCtx(ctxOverrides), TOKEN);
  return res;
}

describe("session page integrity", () => {
  before(() => mkdirSync(dirname(sessionPath("session-test")), { recursive: true }));

  test("renaming a session moves every sidecar and rejects target conflicts before mutation", () => {
    const oldName = "rename-sidecars-source";
    const newName = "rename-sidecars-target";
    const oldPath = sessionPath(oldName);
    writeFileSync(oldPath, `${JSON.stringify({ role: "user", content: "keep" })}\n`, "utf8");
    for (const suffix of [".events.jsonl", ".meta.json", ".pending.json", ".plan.json"]) {
      writeFileSync(oldPath.replace(/\.jsonl$/, suffix), `sidecar:${suffix}`, "utf8");
    }
    assert.equal(renameSession(oldName, newName), true);
    assert.equal(existsSync(sessionPath(oldName)), false);
    assert.equal(existsSync(sessionPath(newName)), true);
    for (const suffix of [".events.jsonl", ".meta.json", ".pending.json", ".plan.json"]) {
      assert.equal(existsSync(sessionPath(newName).replace(/\.jsonl$/, suffix)), true);
      assert.equal(existsSync(sessionPath(oldName).replace(/\.jsonl$/, suffix)), false);
    }

    const conflictSource = "rename-conflict-source";
    const conflictTarget = "rename-conflict-target";
    const conflictPath = sessionPath(conflictSource);
    writeFileSync(conflictPath, `${JSON.stringify({ role: "user", content: "keep" })}\n`, "utf8");
    writeFileSync(conflictPath.replace(/\.jsonl$/, ".meta.json"), "source-meta", "utf8");
    writeFileSync(sessionPath(conflictTarget).replace(/\.jsonl$/, ".meta.json"), "target-meta", "utf8");
    assert.equal(renameSession(conflictSource, conflictTarget), false);
    assert.equal(existsSync(conflictPath), true);
    assert.equal(existsSync(sessionPath(conflictTarget)), false);
    assert.equal(readFileSync(conflictPath.replace(/\.jsonl$/, ".meta.json"), "utf8"), "source-meta");
  });

  test("list, detail and export report malformed JSONL records", async () => {
    const name = "damaged-session";
    const path = sessionPath(name);
    writeFileSync(path, [
      JSON.stringify({ role: "user", content: "first" }),
      "{broken-json",
      JSON.stringify({ role: "assistant", content: "last" }),
      "",
    ].join("\n"), "utf8");

    const listed = await api("GET", "/api/sessions");
    const listEntry = listed.json.sessions.find((session) => session.name === name);
    assert.equal(listEntry.invalidRecords, 1);
    assert.match(listEntry.integrityWarning, /无法解析/);

    const detail = await api("GET", `/api/sessions/${encodeURIComponent(name)}?limit=200`);
    assert.equal(detail.json.messages.length, 2);
    assert.equal(detail.json.invalidRecords, 1);
    assert.match(detail.json.integrityWarning, /可能不完整/);

    const exported = await api("POST", `/api/sessions/${encodeURIComponent(name)}/export`, {});
    assert.equal(exported.status, 200);
    assert.equal(exported.json.invalidRecords, 1);
    assert.match(exported.json.integrityWarning, /跳过/);
    assert.equal(existsSync(exported.json.path), true);
  });
});
