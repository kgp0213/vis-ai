import assert from "node:assert/strict";
import { test } from "node:test";
import { Readable } from "node:stream";
import { dispatch } from "../visionox-pkg/dist/cli/server-XGDBRWMB.js";

const TOKEN = "transcript-api-test-token";

function mockRes() {
  let status = null;
  let body = null;
  return {
    writeHead(value) { status = value; },
    end(value) { body = value; },
    get status() { return status; },
    get json() { return body ? JSON.parse(body) : null; },
  };
}

test("GET /api/sessions/:name/transcript returns the read-only execution projection", async () => {
  const req = { url: "/api/sessions/demo/transcript?limit=2", method: "GET", headers: { "x-reasonix-token": TOKEN } };
  const res = mockRes();
  await dispatch(req, res, {
    getSessionTranscript: async (name, options) => ({
      name,
      options,
      schemaVersion: 1,
      items: [{ kind: "turn", turnId: "t1", ordinal: 1, steps: [] }],
      attachments: [],
      interactions: [],
      goals: [],
      todos: [],
      prompts: [],
      hasMoreOlder: false,
    }),
  }, TOKEN);
  assert.equal(res.status, 200);
  assert.equal(res.json.name, "demo");
  assert.equal(res.json.items[0].turnId, "t1");
  assert.equal(res.json.options.limit, "2");
});

test("POST /api/sessions/:name/fork delegates to the safe recovery runtime", async () => {
  const req = Readable.from([Buffer.from(JSON.stringify({ targetName: "demo-copy" }))]);
  req.url = "/api/sessions/demo/fork";
  req.method = "POST";
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  const res = mockRes();
  await dispatch(req, res, {
    forkSession: async (source, target, options) => ({
      ok: true,
      sourceSessionId: source,
      targetSessionId: target,
      conversationId: "conversation-copy",
      warnings: options.allowWorkspaceMismatch ? ["override"] : [],
    }),
    notifySessionsChanged: () => {},
  }, TOKEN);
  assert.equal(res.status, 201);
  assert.deepEqual(res.json, {
    forked: true,
    sourceSessionId: "demo",
    targetSessionId: "demo-copy",
    conversationId: "conversation-copy",
    warnings: [],
  });
});
