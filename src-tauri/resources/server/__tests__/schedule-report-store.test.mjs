import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createScheduleReportStore } from "../lib/schedule-report-store.mjs";

test("scheduled reports are always managed and optionally exported in the launcher and dashboard", () => {
  const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url), "utf8");
  assert.match(launcher, /writeManagedScheduledReport\(markdown, stats, task, runId\)/);
  assert.match(launcher, /if \(task\.reportExport\)/);
  assert.match(dashboard, /tasks\.reportStored/);
  assert.match(dashboard, /latestRun\.reportExportPath/);
});

let tempRoot = null;

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = null;
});

test("scheduled reports are retained per run and removable only inside the managed root", () => {
  tempRoot = mkdtempSync(join(tmpdir(), "visionox-schedule-reports-"));
  const managedRoot = join(tempRoot, "reports");
  const store = createScheduleReportStore(managedRoot);
  const first = store.write({ taskId: "task:one", runId: "run-1", filename: "日报.md", markdown: "# First\n" });
  const second = store.write({ taskId: "task:one", runId: "run-2", filename: "日报.md", markdown: "# Second\n" });

  assert.notEqual(first, second);
  assert.equal(readFileSync(first, "utf8"), "# First\n");
  assert.equal(readFileSync(second, "utf8"), "# Second\n");
  assert.equal(store.isManagedPath(first), true);

  const outside = join(tempRoot, "outside.md");
  writeFileSync(outside, "keep", "utf8");
  assert.equal(store.removePath(outside), false);
  assert.equal(existsSync(outside), true);
  assert.equal(store.removePath(first), true);
  assert.equal(existsSync(first), false);

  assert.equal(store.removeTask("task:one"), true);
  assert.equal(existsSync(second), false);
});
