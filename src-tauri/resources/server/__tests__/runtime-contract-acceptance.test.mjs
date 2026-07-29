import test from "node:test";
import assert from "node:assert/strict";

import { runRuntimeContractAcceptance } from "../../../../scripts/runtime-contract-acceptance.mjs";

test("deterministic runtime acceptance covers provider, operation, session and artifact boundaries without external services", async () => {
  const result = await runRuntimeContractAcceptance();
  assert.equal(result.ok, true);
  assert.deepEqual(result.scenarios.map((scenario) => [scenario.id, scenario.status]), [
    ["retry-then-success", "passed"],
    ["auth-failure", "passed"],
    ["active-operation-cancellation", "passed"],
    ["session-result-isolation", "passed"],
    ["artifact-verification", "passed"],
  ]);
  assert.equal(result.scenarios.find((scenario) => scenario.id === "auth-failure")?.rootCause, "provider");
  assert.equal(result.scenarios.find((scenario) => scenario.id === "active-operation-cancellation")?.operationState, "cancelled");
  assert.equal(result.scenarios.find((scenario) => scenario.id === "session-result-isolation")?.newSessionMessages, 0);
  assert.equal(result.scenarios.find((scenario) => scenario.id === "artifact-verification")?.rootCause, "artifact");
  assert.equal(result.externalNetworkUsed, false);
  assert.equal(result.dwsSendCount, 0);
  assert.equal(result.cleaned, true);
});
