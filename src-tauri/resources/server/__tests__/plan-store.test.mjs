import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { createPlanStore } from "../lib/plan-store.mjs";

const steps = [{ id: "one", title: "First", action: "Do first", risk: "low" }];

describe("active plan store", () => {
  it("saves, loads and archives a valid plan atomically", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-plan-store-"));
    try {
      const store = createPlanStore(root);
      store.savePlanState("desktop", steps, ["one"], { summary: "summary", planId: "plan-1", requestId: "request-1" });
      const loaded = store.loadPlanState("desktop");
      assert.deepEqual(loaded.completedStepIds, ["one"]);
      assert.equal(loaded.summary, "summary");
      assert.equal(loaded.planId, "plan-1");
      assert.equal(loaded.requestId, "request-1");
      const archive = store.archivePlanState("desktop");
      assert.equal(existsSync(archive), true);
      assert.equal(store.loadPlanState("desktop"), null);
      assert.equal(store.listAllPlanArchives()[0].sessionName, "desktop");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses to treat a corrupt active plan as an empty plan", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-plan-corrupt-"));
    try {
      const path = join(root, "desktop.plan.json");
      writeFileSync(path, "{broken", "utf8");
      const store = createPlanStore(root);
      assert.throws(() => store.loadPlanState("desktop"), /not modified/);
      assert.equal(readFileSync(path, "utf8"), "{broken");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("migrates the legacy desktop plan once without overwriting a target plan", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-plan-migration-"));
    try {
      const store = createPlanStore(root);
      store.savePlanState("desktop", steps, [], { summary: "legacy" });
      const first = store.migrateLegacyPlan("desktop", "session-a");
      assert.equal(first.migrated, true);
      assert.equal(store.loadPlanState("desktop"), null);
      assert.equal(store.loadPlanState("session-a").summary, "legacy");
      assert.equal(store.migrateLegacyPlan("desktop", "session-b").migrated, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves step verification metadata and archives legacy plan when target exists", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-plan-migration-target-"));
    try {
      const store = createPlanStore(root);
      store.savePlanState("desktop", [{ ...steps[0], acceptanceCriteria: ["read file"], evidenceRefs: [{ type: "tool_read", verified: true }] }], [], { summary: "legacy" });
      store.savePlanState("session-a", steps, [], { summary: "current" });
      const result = store.migrateLegacyPlan("desktop", "session-a");
      assert.equal(result.archived, true);
      assert.equal(store.loadPlanState("session-a").summary, "current");
      assert.equal(store.listAllPlanArchives().length, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
