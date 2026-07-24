import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { createOperationSteeringRuntime } from "./operation-steering.mjs";

const { dispatch } = await import(new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url));
const TOKEN = "operation-steering-test";

async function steerRequest(path, body, ctx) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST";
  req.url = path;
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  let status = null;
  let raw = "";
  const res = { writeHead(value) { status = value; }, end(value) { raw = value ?? ""; } };
  await dispatch(req, res, ctx, TOKEN);
  return { status, body: raw ? JSON.parse(raw) : null };
}

describe("operation steering", () => {
  test("queues at most eight bounded instructions and consumes them once", () => {
    const runtime = createOperationSteeringRuntime({ idFactory: (() => { let id = 0; return () => `steer-${++id}`; })() });
    for (let index = 0; index < 8; index++) {
      runtime.enqueue({ operationId: "op-1", sessionId: "session-1", workspace: "C:/work", instruction: `instruction ${index}` });
    }
    assert.throws(() => runtime.enqueue({ operationId: "op-1", instruction: "overflow" }), /8/);
    assert.throws(() => runtime.enqueue({ operationId: "op-2", instruction: "x".repeat(4001) }), /4000/);

    const consumed = runtime.consume("op-1");
    assert.equal(consumed.length, 8);
    assert.equal(runtime.consume("op-1").length, 0);
    assert.equal(runtime.list("op-1").every((item) => item.status === "applied"), true);
  });

  test("marks instructions that miss the last request boundary as not_applied", () => {
    const runtime = createOperationSteeringRuntime();
    runtime.enqueue({ operationId: "op-late", sessionId: "session-1", workspace: "C:/work", instruction: "late instruction" });
    const closed = runtime.close("op-late", { reason: "operation_completed" });
    assert.equal(closed[0].status, "not_applied");
    assert.equal(closed[0].resolution.reason, "operation_completed");
  });

  test("exposes the compatible steering endpoint through the existing Dashboard server", async () => {
    const seen = [];
    const response = await steerRequest("/api/operations/op-1/steer", { instruction: "verify output" }, {
      steerOperation: (operationId, input) => { seen.push({ operationId, input }); return { ok: true, queued: { id: "steer-1" } }; },
    });
    assert.equal(response.status, 202);
    assert.equal(seen[0].operationId, "op-1");
    assert.equal(seen[0].input.instruction, "verify output");
  });
});
