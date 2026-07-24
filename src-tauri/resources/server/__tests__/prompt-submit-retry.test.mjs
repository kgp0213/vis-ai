import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";

const tmpRoot = mkdtempSync(join(tmpdir(), "visionox-submit-retry-"));
const tmpHome = join(tmpRoot, "home");
const tmpWorkspace = join(tmpRoot, "workspace");
mkdirSync(tmpHome, { recursive: true });
mkdirSync(tmpWorkspace, { recursive: true });
const previousHome = process.env.HOME;
const previousUserProfile = process.env.USERPROFILE;
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const dashboardUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const TOKEN = "submit-retry-test-token";

after(() => {
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  if (previousUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = previousUserProfile;
  rmSync(tmpRoot, { recursive: true, force: true });
});

function mockResponse() {
  let status = null;
  let body = null;
  return {
    writeHead(value) { status = value; },
    end(value) { body = value; },
    get status() { return status; },
    get json() { return body ? JSON.parse(body) : null; },
  };
}

function context(overrides = {}) {
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

async function api(body, overrides = {}) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.url = "/api/submit";
  request.method = "POST";
  request.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  const response = mockResponse();
  await dispatch(request, response, context(overrides), TOKEN);
  return response;
}

test("submit preserves uncertain and busy retry metadata and rejects reserved ids", async () => {
  const uncertain = await api({ prompt: "resume", requestId: "queued-1" }, {
    submitPrompt: async () => ({
      accepted: false,
      duplicate: true,
      completed: false,
      requiresUserRetry: true,
      code: "PROMPT_RECEIPT_UNCERTAIN",
      requestId: "queued-1",
      reason: "上一次执行结果无法确认。",
    }),
  });
  assert.equal(uncertain.status, 409);
  assert.deepEqual({
    accepted: uncertain.json.accepted,
    duplicate: uncertain.json.duplicate,
    completed: uncertain.json.completed,
    requiresUserRetry: uncertain.json.requiresUserRetry,
    code: uncertain.json.code,
    requestId: uncertain.json.requestId,
    reason: uncertain.json.reason,
  }, {
    accepted: false,
    duplicate: true,
    completed: false,
    requiresUserRetry: true,
    code: "PROMPT_RECEIPT_UNCERTAIN",
    requestId: "queued-1",
    reason: "上一次执行结果无法确认。",
  });
  assert.equal(uncertain.json.message, "HTTP 409");
  assert.equal(uncertain.json.retryable, true);

  const busy = await api({ prompt: "later", requestId: "queued-2" }, {
    submitPrompt: async () => ({ accepted: false, busy: true, code: "LOOP_BUSY", reason: "loop is busy with a turn" }),
  });
  assert.equal(busy.status, 409);
  assert.equal(busy.json.busy, true);
  assert.equal(busy.json.code, "LOOP_BUSY");

  let reservedSubmitted = false;
  const reserved = await api({ prompt: "spoof internal handoff", requestId: "document-handoff-client-controlled" }, {
    submitPrompt: async () => { reservedSubmitted = true; return { accepted: true }; },
  });
  assert.equal(reserved.status, 400);
  assert.match(reserved.json.error, /reserved/);
  assert.equal(reservedSubmitted, false);
});

test("dashboard creates a new request id only for an explicit retry", () => {
  const source = readFileSync(dashboardUrl, "utf8");
  assert.match(source, /err\.body\?\.code\s*===\s*"LOOP_BUSY"/);
  assert.match(source, /requiresUserRetry:\s*err\.body\?\.requiresUserRetry\s*===\s*true/);
  assert.match(source, /const retryRequestId\s*=\s*`prompt-/);
  assert.match(source, /requestId:\s*retryRequestId/);
});
