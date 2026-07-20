import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const launcherPath = new URL("../launcher.mjs", import.meta.url);
const source = await readFile(launcherPath, "utf8");

test("complex work is supervised around the ordinary CacheFirstLoop", () => {
  assert.match(source, /new CacheFirstLoop\(/);
  assert.match(source, /assessTaskComplexity\(/);
  assert.match(source, /evaluateForegroundTask\([\s\S]*?loop\.step\(loopInput\)/);
  assert.match(source, /recordForegroundToolEvent\(/);
  assert.match(source, /beginForegroundDispatch\(/);
  assert.match(source, /buildForegroundTaskPrompt\(/);
  assert.match(source, /foregroundStepBoundaryMessage\(/);
  assert.doesNotMatch(source, /createDurableAgentWorker\(/);
  assert.doesNotMatch(source, /createComplexTaskOrchestrator\(/);
  assert.doesNotMatch(source, /async function generateComplexDocumentUnit/);
  assert.doesNotMatch(source, /name:\s*"organize_documents_to_report"/);
});

test("foreground supervision persists and restores task, plan, context, and tool evidence", () => {
  assert.match(source, /writeActiveSessionMeta\(\{ foregroundTask: activeForegroundTask \}\)/);
  assert.match(source, /restoreForegroundTaskFromMeta\(meta\)/);
  assert.match(source, /history:\s*loop\?\.log\?\.toMessages/);
  assert.match(source, /contextInputTransactions\.status\(\)/);
  assert.match(source, /incompleteActivePlanSnapshot\(\)/);
  assert.match(source, /recordForegroundArtifacts\(/);
});

test("legacy worker stores remain inspectable but cannot restart a competing model path", () => {
  assert.match(source, /createComplexTaskStore/);
  assert.match(source, /createComplexTaskRuntimeService\(\{[\s\S]{0,400}executionRetired:\s*true/);
  assert.match(source, /name:\s*"get_background_task_status"/);
  assert.match(source, /LEGACY_DOCUMENT_EXECUTION_RETIRED/);
  assert.doesNotMatch(source, /documentMarkdownManager\.resume\(/);
  assert.doesNotMatch(source, /resolveComplexTaskEngineRollout/);
});

test("historical outcomes can still be delivered without re-executing the task", () => {
  assert.match(source, /complexTaskConversationDelivery\?\.rehydrate/);
  assert.match(source, /documentHandoffCoordinator\?\.retryDelivery/);
  assert.match(source, /action\s*===\s*"retry_delivery"/);
  assert.match(source, /releasePromptRequestReceipt\(/);
  assert.doesNotMatch(
    source,
    /action\s*===\s*"retry_delivery"[\s\S]{0,900}documentMarkdownManager\.control\(id,\s*action\)/,
  );
});

test("startup maintenance and historical delivery recovery retain separate failure boundaries", () => {
  assert.match(source, /const startupIssues\s*=\s*Array\.isArray\(report\?\.issues\)/);
  assert.match(source, /try\s*\{\s*await complexTaskConversationDelivery\?\.rehydrate\?\.\(\);[\s\S]{0,700}\}\s*catch\s*\(error\)/);
  assert.doesNotMatch(source, /complexTaskOrchestrator\?\.start/);
});

test("durable delivery receipts are persisted before model dispatch and released after confirmation", () => {
  const anchor = source.indexOf("const retrievalHistory =");
  const accepted = source.indexOf("rememberAcceptedPromptRequest(requestId", anchor);
  const workerMatch = /\(async \(\) => \{\s*const turnStartedAt/.exec(source.slice(anchor));
  const worker = workerMatch ? anchor + workerMatch.index : -1;
  assert.ok(anchor >= 0);
  assert.ok(accepted > anchor);
  assert.ok(worker > accepted);
  assert.match(source, /notice\.kind\s*===\s*["']delivered["'][\s\S]{0,350}releasePromptRequestReceipt/);
  assert.match(source, /notice\.kind\s*===\s*["']handoff-delivered["'][\s\S]{0,350}releasePromptRequestReceipt/);
});
