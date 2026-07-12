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
      store.savePlanState("desktop", steps, ["one"], { summary: "summary" });
      const loaded = store.loadPlanState("desktop");
      assert.deepEqual(loaded.completedStepIds, ["one"]);
      assert.equal(loaded.summary, "summary");
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
});
