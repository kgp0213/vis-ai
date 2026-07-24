import test from "node:test";
import assert from "node:assert/strict";

import { runRuntimeContractAcceptance } from "../../../../scripts/runtime-contract-acceptance.mjs";

test("deterministic runtime acceptance covers retry, auth and cancellation without external services", async () => {
  const result = await runRuntimeContractAcceptance();
  assert.equal(result.ok, true);
  assert.deepEqual(result.scenarios.map((scenario) => [scenario.id, scenario.status]), [
    ["retry-then-success", "passed"],
    ["auth-failure", "passed"],
    ["cancellation", "passed"],
  ]);
  assert.equal(result.externalNetworkUsed, false);
  assert.equal(result.dwsSendCount, 0);
  assert.equal(result.cleaned, true);
});
