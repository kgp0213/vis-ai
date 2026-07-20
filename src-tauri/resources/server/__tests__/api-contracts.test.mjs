import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { assertApiContract, validateSchema } from "../../../../scripts/check-api-contracts.js";

const contracts = JSON.parse(readFileSync(new URL("../../../../contracts/api-responses.schema.json", import.meta.url), "utf8"));

test("API response contracts are valid and reject missing required fields", () => {
  assert.doesNotThrow(() => assertApiContract(contracts, "backups", { items: [{ id: "one", status: "ok" }] }));
  assert.throws(() => assertApiContract(contracts, "backups", { items: [{ id: "one" }] }), /status is required/);
  assert.throws(() => assertApiContract(contracts, "missing", {}), /unknown API contract/);
});

test("schema validator checks nested types, arrays and enums", () => {
  const schema = { type: "object", required: ["items"], properties: { items: { type: "array", items: { type: "integer", enum: [1, 2] } } } };
  assert.deepEqual(validateSchema({ items: [1, 2] }, schema), []);
  assert.ok(validateSchema({ items: [3, "bad"] }, schema).length >= 2);
});

test("background task and outcome projections have stable public contracts", () => {
  assert.doesNotThrow(() => assertApiContract(contracts, "backgroundJobs", {
    jobs: [{
      id: "task:12345678-abcd-abcd-abcd-123456789012",
      taskType: "document.markdown",
      lifecycle: "terminal",
      outcome: "delivered_with_warnings",
      quality: "needs_review",
      active: false,
      needsAttention: true,
      revision: 4,
      progress: { completedUnits: 2, totalUnits: 2 },
      allowedActions: ["retry", "retry_delivery"],
      artifacts: [{ artifactId: "a1", artifactRef: "a1@r1#" + "a".repeat(64), path: null }],
      updatedAt: "2026-07-19T00:00:00.000Z",
    }],
    pendingDeliveries: [{
      deliveryId: "delivery-1",
      taskId: "task:12345678-abcd-abcd-abcd-123456789012",
        target: "conversation",
        deliveryState: { status: "blocked_user_retry", attempts: 3 },
    }],
  }));
  assert.throws(
    () => assertApiContract(contracts, "backgroundJobs", { jobs: [{ id: "bad" }], pendingDeliveries: [] }),
    /taskType is required/,
  );
  assert.throws(
    () => assertApiContract(contracts, "backgroundJobs", {
      jobs: [{
        id: "task:12345678-abcd-abcd-abcd-123456789012",
        taskType: "document.markdown",
        lifecycle: "waiting_user",
        outcome: null,
        quality: "needs_review",
        active: false,
        needsAttention: true,
        revision: 5,
        progress: {},
        allowedActions: ["resolve_user_input"],
        artifacts: [{ artifactId: "a1", path: 42 }],
        updatedAt: null,
      }],
      pendingDeliveries: [],
    }),
    /path must be string,null/,
  );
});

test("API errors use one stable response shape", () => {
  assert.doesNotThrow(() => assertApiContract(contracts, "errorResponse", {
    error: "任务不存在",
    code: "not-found",
  }));
  assert.throws(
    () => assertApiContract(contracts, "errorResponse", { message: "任务不存在" }),
    /error is required/,
  );
});
