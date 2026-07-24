import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyTaskEvidence,
  publicModelInventory,
} from "../../../../scripts/real-task-acceptance.mjs";

test("real-task inventory never exposes provider credentials or service URLs", () => {
  const inventory = publicModelInventory({
    providers: [{
      id: "provider-1",
      name: "Provider",
      baseUrl: "https://private.example/v1",
      apiKey: "api-secret-value",
      models: [{ id: "model-1", disabled: false }],
    }],
  });

  assert.deepEqual(inventory, [{
    providerId: "provider-1",
    providerName: "Provider",
    configured: true,
    models: [{ id: "model-1", enabled: true }],
  }]);
  assert.doesNotMatch(JSON.stringify(inventory), /private\.example|api-secret-value/);
});

test("real-task evidence rejects a completion claim without the required artifact", () => {
  assert.deepEqual(classifyTaskEvidence({
    assistantText: "任务已经完成。",
    expectedArtifact: "output.md",
    artifact: null,
    receipt: { completion: { ok: true, taskState: "completed" } },
  }), {
    status: "failed",
    reason: "required-artifact-missing",
    modelClaimedComplete: true,
  });
});

test("authorization and fixture blockers remain explicit instead of becoming failures", () => {
  assert.deepEqual(classifyTaskEvidence({ blockedReason: "dws-authorization-required" }), {
    status: "blocked",
    reason: "dws-authorization-required",
    modelClaimedComplete: false,
  });
});
