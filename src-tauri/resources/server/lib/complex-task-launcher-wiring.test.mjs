import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const launcherPath = new URL("../launcher.mjs", import.meta.url);

test("launcher owns a separate durable task store and unified background projection", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /createComplexTaskStore/);
  assert.match(source, /resolve\(visionoxDataDir, "tasks"\)/);
  assert.match(source, /createComplexTaskSupervisor/);
  assert.match(source, /createComplexTaskController/);
  assert.match(source, /createComplexTaskRuntimeService/);
  assert.match(source, /complexTaskRuntimeService\.listBackgroundJobs/);
  assert.match(source, /String\(id\)\.startsWith\("task:"\)/);
  assert.match(source, /complexTaskRuntimeService\?\.initialize/);
  assert.match(source, /complexDocumentAdapter\s*=\s*createComplexDocumentAdapter\s*\(/);
  assert.match(source, /complexTaskWorker\s*=\s*createDurableAgentWorker\s*\(/);
  assert.match(source, /complexTaskOrchestrator\s*=\s*createComplexTaskOrchestrator\s*\(/);
  assert.match(source, /complexTaskArtifactCommitter\s*=\s*createComplexTaskArtifactCommitter\s*\(/);
});

test("launcher exposes a canonical model-readable background status tool", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /name: "get_background_task_status"/);
  assert.match(source, /background task not found/);
  assert.match(source, /complexTaskRuntimeService\?\.getBackgroundJob/);
});

test("launcher pins and submits eligible v2 tasks without dual legacy handoff", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /pinComplexTaskEngine\s*\(/);
  assert.match(source, /buildDocumentTaskDraft\s*\(/);
  assert.match(source, /complexTaskStore\.create\s*\(/);
  assert.match(source, /complexTaskOrchestrator\.(?:wake|start|runOnce)\s*\(/);
  assert.match(source, /executionEngine\s*===\s*["']v2["']/);
});

test("launcher commits generic assembly output before declaring completion", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /complexTaskArtifactCommitter\.commit\s*\(/);
  assert.match(source, /assembleComplexTask\s*\(/);
});
