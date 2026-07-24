import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const TOKEN = "interaction-api-test-token";

function response() {
  let status = null;
  let body = null;
  return {
    writeHead(value) { status = value; },
    end(value) { body = value; },
    get status() { return status; },
    get json() { return body ? JSON.parse(body) : null; },
  };
}

async function request(method, path, body, ctx) {
  const payload = body === undefined ? null : JSON.stringify(body);
  const req = payload === null ? new Readable({ read() { this.push(null); } }) : Readable.from([Buffer.from(payload)]);
  req.url = path;
  req.method = method;
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  const res = response();
  await dispatch(req, res, ctx, TOKEN);
  return res;
}

test("interaction lifecycle query and close keep the modal API compatible", async () => {
  const interactions = [{ interactionId: "interaction-1", status: "pending", kind: "choice" }];
  const queried = await request("GET", "/api/modal/interactions", undefined, {
    getInteractions: () => interactions,
  });
  assert.equal(queried.status, 200);
  assert.deepEqual(queried.json.interactions, interactions);

  let closedId = null;
  const closed = await request("POST", "/api/modal/interactions/interaction-1/close", {}, {
    closeInteraction: (interactionId) => {
      closedId = interactionId;
      return { ok: true, idempotent: false, interaction: { interactionId, status: "cancelled" } };
    },
  });
  assert.equal(closed.status, 200);
  assert.equal(closedId, "interaction-1");
  assert.equal(closed.json.interaction.status, "cancelled");

  const duplicate = await request("POST", "/api/modal/interactions/interaction-1/close", {}, {
    closeInteraction: (interactionId) => ({
      ok: true,
      idempotent: true,
      interaction: { interactionId, status: "cancelled" },
    }),
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.json.idempotent, true);
});

test("pause gate resolution requires a current non-negative gate id", async () => {
  const missing = await request("POST", "/api/modal/resolve", {
    kind: "shell",
    choice: "run_once",
  }, {
    resolveShellConfirm: () => true,
  });
  assert.equal(missing.status, 400);

  const stale = await request("POST", "/api/modal/resolve", {
    kind: "shell",
    choice: "run_once",
    gateId: 7,
  }, {
    resolveShellConfirm: () => false,
  });
  assert.equal(stale.status, 409);
});

test("modal resolution forwards gate identity while legacy modals remain compatible", async () => {
  let received = null;
  const resolved = await request("POST", "/api/modal/resolve", {
    kind: "choice",
    choice: { kind: "pick", optionId: "A" },
    gateId: 12,
  }, {
    resolveChoiceConfirm: (choice, gateId) => {
      received = { choice, gateId };
      return true;
    },
  });
  assert.equal(resolved.status, 200);
  assert.deepEqual(received, { choice: { kind: "pick", optionId: "A" }, gateId: 12 });

  let editChoice = null;
  const legacy = await request("POST", "/api/modal/resolve", {
    kind: "edit-review",
    choice: "apply",
  }, {
    resolveEditReview: (value) => { editChoice = value; },
  });
  assert.equal(legacy.status, 200);
  assert.equal(editChoice, "apply");
});

test("plan cancellation and checkpoint stop abort only after gate resolution", async () => {
  const events = [];
  const plan = await request("POST", "/api/modal/resolve", {
    kind: "plan",
    choice: "cancel",
    gateId: 20,
  }, {
    resolvePlanConfirm: (_choice, _text, gateId) => {
      events.push(`resolve-plan-${gateId}`);
      return true;
    },
    abortTurn: () => events.push("abort-plan"),
  });
  assert.equal(plan.status, 200);
  assert.deepEqual(events, ["resolve-plan-20", "abort-plan"]);

  events.length = 0;
  const checkpoint = await request("POST", "/api/modal/resolve", {
    kind: "checkpoint",
    choice: "stop",
    gateId: 21,
  }, {
    resolveCheckpointConfirm: (_choice, _text, gateId) => {
      events.push(`resolve-checkpoint-${gateId}`);
      return true;
    },
    abortTurn: () => events.push("abort-checkpoint"),
  });
  assert.equal(checkpoint.status, 200);
  assert.deepEqual(events, ["resolve-checkpoint-21", "abort-checkpoint"]);
});
