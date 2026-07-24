import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const dashboardAppUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const launcherUrl = new URL("../launcher.mjs", import.meta.url);
const knowledgeRuntimeUrl = new URL("../lib/knowledge-runtime.mjs", import.meta.url);
const serverBundleUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);

test("scheduled Skill reports expose fixed-workspace knowledge promotion without cross-workspace activation", () => {
  const dashboard = readFileSync(dashboardAppUrl, "utf8");
  const launcher = readFileSync(launcherUrl, "utf8");
  const knowledgeRuntime = readFileSync(knowledgeRuntimeUrl, "utf8");
  const server = readFileSync(serverBundleUrl, "utf8");
  assert.match(dashboard, /skillArchiveWorkspaceDir/);
  assert.match(dashboard, /归档到知识库/);
  assert.match(dashboard, /高质量结果自动归档/);
  assert.match(dashboard, /归档后自动更新本地索引/);
  assert.match(server, /scheduled Skill knowledge archive is not wired/);
  assert.match(launcher, /writeManagedScheduledSkillReport/);
  assert.match(launcher, /archiveScheduleSkillRun/);
  assert.match(launcher, /const updateKnowledgeSemanticIndex = knowledgeRuntime\.updateSemanticIndex/);
  assert.match(knowledgeRuntime, /getActiveWorkspace[\s\S]*?onActiveIndexUpdated/);
});
