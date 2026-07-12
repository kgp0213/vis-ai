import { after, before, test } from "node:test";
import assert from "node:assert/strict";

before(async () => import("../visionox-pkg/dashboard/overview-alerts-support.js"));
after(() => delete globalThis.VisionoxOverviewAlertPolicy);

test("overview alert policy returns no alerts for an empty or invalid state", () => {
  assert.deepEqual(globalThis.VisionoxOverviewAlertPolicy.evaluate(), []);
  assert.deepEqual(globalThis.VisionoxOverviewAlertPolicy.evaluate({
    pendingEdits: "invalid",
    corruptBackups: Number.POSITIVE_INFINITY,
    storageIssues: -1,
    budgetKind: "limited",
    budgetPct: Number.NaN,
  }), []);
});

test("overview alert policy preserves the established alert order and severity", () => {
  assert.deepEqual(globalThis.VisionoxOverviewAlertPolicy.evaluate({
    modelVerificationDirty: true,
    modelDrift: true,
    pendingEdits: "2",
    corruptBackups: 1,
    storageIssues: 3,
    retrievalMode: "auto",
    semanticAvailable: false,
    budgetKind: "limited",
    budgetPct: 100,
  }), [
    { kind: "model_retest", tone: "warn" },
    { kind: "model_drift", tone: "warn" },
    { kind: "pending_edits", tone: "warn", count: 2 },
    { kind: "corrupt_backups", tone: "warn", count: 1 },
    { kind: "storage_issues", tone: "err", count: 3 },
    { kind: "missing_index", tone: "warn" },
    { kind: "budget", tone: "err", pct: 100 },
  ]);
});

test("overview alert policy applies index and budget boundaries exactly", () => {
  const evaluate = globalThis.VisionoxOverviewAlertPolicy.evaluate;
  assert.deepEqual(evaluate({ retrievalMode: "tool", semanticAvailable: false }), []);
  assert.deepEqual(evaluate({ retrievalMode: "auto", semanticAvailable: true }), []);
  assert.deepEqual(evaluate({ retrievalMode: "auto", semanticAvailable: false }), [{ kind: "missing_index", tone: "warn" }]);
  assert.deepEqual(evaluate({ budgetKind: "limited", budgetPct: 79 }), []);
  assert.deepEqual(evaluate({ budgetKind: "off", budgetPct: 100 }), []);
  assert.deepEqual(evaluate({ budgetKind: "limited", budgetPct: 80 }), [{ kind: "budget", tone: "warn", pct: 80 }]);
  assert.deepEqual(evaluate({ budgetKind: "limited", budgetPct: 99 }), [{ kind: "budget", tone: "warn", pct: 99 }]);
  assert.deepEqual(evaluate({ budgetKind: "limited", budgetPct: 100 }), [{ kind: "budget", tone: "err", pct: 100 }]);
});
