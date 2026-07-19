import test from "node:test";
import assert from "node:assert/strict";

import { createComplexTaskOrchestrator } from "./complex-task-orchestrator.mjs";

function emptyStore() {
  return {
    async list() { return []; },
    async read() { throw Object.assign(new Error("task missing"), { code: "ENOENT" }); },
    async acquireLease() { return { ok: false, reason: "not-queued" }; },
    async transition() { return { applied: false, reason: "not-running" }; },
    async complete() { return { applied: false, reason: "not-running" }; },
  };
}

test("every orchestrator poll reconciles leases instead of supervising only at startup", async () => {
  const reconciliations = [];
  const orchestrator = createComplexTaskOrchestrator({
    store: emptyStore(),
    worker: { async runOne() { throw new Error("no task should be claimed"); } },
    supervisor: {
      async reconcile(input) {
        reconciliations.push(input.now);
        return { scanned: 0, requeued: [], issues: [] };
      },
    },
    assembler: async () => { throw new Error("no task should be assembled"); },
  });

  await orchestrator.runOnce({ now: 100 });
  const second = await orchestrator.runOnce({ now: 200 });

  assert.deepEqual(reconciliations, [100, 200]);
  assert.deepEqual(second.reconcile, { scanned: 0, requeued: [], issues: [] });
});
