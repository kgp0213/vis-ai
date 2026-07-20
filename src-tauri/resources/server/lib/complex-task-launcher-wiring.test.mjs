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
  assert.match(source, /complexTaskConversationDelivery\?\.rehydrate/);
  assert.match(source, /verifyComplexTaskSources\s*\(/);
  assert.match(source, /verifySources:\s*verifyComplexTaskSources/);
  assert.match(source, /complexDocumentAdapter\s*=\s*createComplexDocumentAdapter\s*\(/);
  assert.match(source, /complexTaskWorker\s*=\s*createDurableAgentWorker\s*\(/);
  assert.match(source, /complexTaskOrchestrator\s*=\s*createComplexTaskOrchestrator\s*\(/);
  assert.match(source, /complexTaskArtifactCommitter\s*=\s*createComplexTaskArtifactCommitter\s*\(/);
  assert.match(source, /createComplexTaskHostToolAccess\s*\(/);
  assert.match(source, /operations:\s*complexTaskHostAccess\.operations/);
  assert.match(source, /authorize:\s*complexTaskHostAccess\.authorize/);
  assert.doesNotMatch(source, /complexTaskHostToolBroker\s*=\s*createHostToolBroker\s*\(\{\s*operations:\s*\{\}/s);
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
  assert.match(source, /shouldFallbackToLegacyOnExtractionFailure\s*\(configuredMode\)/);
  assert.match(source, /canary extraction failed; falling back to legacy/);
  assert.match(source, /buildDocumentTaskDraft\s*\(/);
  assert.match(source, /complexTaskStore\.create\s*\(/);
  assert.match(source, /complexTaskOrchestrator\.(?:wake|start|runOnce)\s*\(/);
  assert.match(source, /executionEngine\s*===\s*["']v2["']/);
});

test("launcher resolves the rollout flag through the fail-closed diagnostic helper", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /resolveComplexTaskEngineRollout/);
  assert.match(source, /rolloutResolution\.mode/);
  assert.match(source, /rolloutResolution\.diagnostic/);
});

test("launcher commits generic assembly output before declaring completion", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /complexTaskArtifactCommitter\.commit\s*\(/);
  assert.match(source, /assembleComplexTask\s*\(/);
});

test("launcher probes v2 document candidates and refuses capability downgrades", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /selectUsableDocumentModel\s*\(candidates/);
  assert.match(source, /probe:\s*probeDocumentModel/);
  assert.match(source, /MODEL_CAPABILITY_UNAVAILABLE/);
  assert.doesNotMatch(source, /const pool = \(capable\.length > 0 \? capable : candidates\)/);
});

test("launcher reports only increasing model output as durable v2 progress", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /generateComplexDocumentUnit\s*\(\{[^}]*reportProgress/s);
  assert.match(source, /const onProgress\s*=\s*\(progress/);
  assert.match(source, /generatedChars\s*<=\s*lastReportedChars/);
  assert.match(source, /reportProgress\?\.\(evidence\)/);
  assert.match(source, /kind:\s*["']model-stream["']/);
  assert.match(source, /pinnedSkill/);
});

test("launcher does not coalesce failed or cancelled terminal tasks as completed", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /classifyComplexTaskReuse\s*\(/);
  assert.match(source, /reuseDecision\?\.reusable\s*===\s*true/);
  assert.match(source, /creating a fresh execution/);
});

test("reopening a conversation rehydrates its pending complex-task deliveries", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /session loaded:[\s\S]{0,800}complexTaskConversationDelivery\?\.rehydrate/);
});

test("an empty session-load request drains rehydrated deliveries after foreground busy is released", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /if \(!text \|\| !text\.trim\(\)\)[\s\S]{0,300}return \{ accepted: true, loaded: true/);
  assert.match(
    source,
    /if \(!committed\)\s*\{[\s\S]{0,900}busy = false;[\s\S]{0,900}complexTaskConversationDelivery\.drain\(\)/,
    "the early-return owner must retry queued conversation delivery only after busy becomes false",
  );
});

test("normal foreground completion cleans the active operation before draining deliveries", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(
    source,
    /try \{ finishActiveOperation\(operation\); \} catch \(error\) \{[\s\S]{0,240}\}\s*if \(complexTaskConversationDelivery\) \{\s*void complexTaskConversationDelivery\.drain\(\)/,
    "delivery must start only after the completed foreground operation is detached",
  );
});

test("launcher surfaces isolated startup maintenance issues and still starts the orchestrator", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /const startupIssues\s*=\s*Array\.isArray\(report\?\.issues\)/);
  assert.match(source, /startupIssues[\s\S]{0,900}runtimeIssues\.report\("warning"/);
  assert.match(source, /startupIssues[\s\S]{0,1400}complexTaskOrchestrator\?\.start\?\.\(\)/);
});

test("launcher isolates orchestrator startup failure from conversation delivery rehydration", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(
    source,
    /try\s*\{\s*await complexTaskOrchestrator\?\.start\?\.\(\);[\s\S]{0,700}\}\s*catch\s*\(error\)/,
    "a scheduler startup failure must be recorded without aborting later recovery steps",
  );
  assert.match(
    source,
    /try\s*\{\s*await complexTaskConversationDelivery\?\.rehydrate\?\.\(\);[\s\S]{0,700}\}\s*catch\s*\(error\)/,
    "conversation delivery rehydration must have its own failure boundary",
  );
});

test("generic v2 terminal transitions release their bound output reservation", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /releaseComplexTaskOutputReservation\s*\(task\)/);
  assert.match(source, /lifecycle\s*===\s*["']terminal["']/);
  assert.match(source, /documentOutputReservation\.release\(task\.id,\s*\{\s*force:\s*true\s*\}\)/);
  assert.match(source, /releaseComplexTaskOutputReservation\(task\)[\s\S]{0,500}broadcastDashboardEvent/);
});

test("durable conversation delivery reuses a completed prompt receipt after restart", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /promptRequestReceiptDecision/);
  assert.match(source, /const launcherBootId\s*=\s*randomUUID\(\)/);
  assert.match(source, /promptRequestReceiptDecision\(acceptedPromptRequest\(requestId\),\s*launcherBootId\)/);
  assert.match(source, /receiptDecision\.action\s*===\s*["']reuse-completion["'][\s\S]{0,400}completion:\s*receiptDecision\.completion/);
  assert.match(source, /rememberAcceptedPromptRequest\(requestId,[\s\S]{0,180}ownerBootId:\s*launcherBootId/);
  assert.match(
    source,
    /rememberCompletedPromptRequest\(requestId,\s*completion\)[\s\S]{0,700}completeTurn\(completionReceiptError[\s\S]{0,200}:\s*completion\)/,
    "the completed receipt must be durable before the Outbox delivery callback can acknowledge it",
  );
  assert.match(source, /accepted\?\.duplicate\s*&&\s*accepted\?\.completed[\s\S]{0,300}accepted\.completion/);
});

test("launcher fences uncertain receipts and retains internal delivery receipts durably", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /isDurablePromptReceiptId\s*=\s*\(id\)/);
  assert.match(source, /isDurableReceiptId:\s*isDurablePromptReceiptId/);
  assert.match(
    source,
    /receiptDecision\.action\s*===\s*["']uncertain["'][\s\S]{0,500}requiresUserRetry:\s*true[\s\S]{0,300}receiptDecision\.reason/,
    "an accepted request from an older boot must be visible and must not start another model turn",
  );
});

test("document handoff keeps the initial receipt stable and gives each approved retry a new identity", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /function documentHandoffPromptRequestId\s*\(terminalKey,\s*attemptId\s*=\s*null\)/);
  assert.match(source, /attemptId\s*\?\s*`\$\{terminalKey\}:\$\{attemptId\}`\s*:\s*terminalKey/);
  assert.match(source, /dispatch:\s*\(\{\s*dispatchId,\s*terminalKey,\s*attemptId,\s*prompt,\s*signal\s*\}\)/);
  assert.match(source, /documentHandoffPromptRequestId\(terminalKey,\s*attemptId\)/);
  assert.match(source, /documentHandoffPromptRequestId\(notice\.terminalKey,\s*notice\.attemptId\)/);
  assert.doesNotMatch(
    source,
    /document-handoff-\$\{createHash\("sha256"\)\.update\(dispatchId\)/,
    "a restart must not rotate the receipt id for the same logical handoff",
  );
});

test("document retry_delivery delegates to handoff delivery without invoking document processing", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(
    source,
    /String\(id\)\.startsWith\("document:"\)\s*&&\s*action\s*===\s*"retry_delivery"[\s\S]{0,900}documentHandoffCoordinator\?\.retryDelivery/,
  );
  assert.doesNotMatch(
    source,
    /action\s*===\s*"retry_delivery"[\s\S]{0,900}documentMarkdownManager\.control\(id,\s*action\)/,
    "delivery retry must not re-enter the document business workflow",
  );
});

test("launcher releases durable prompt receipts only after persisted delivery confirmation", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /function releasePromptRequestReceipt\s*\(/);
  assert.match(source, /promptQueueStore\.releaseReceipt\s*\(/);
  assert.match(source, /notice\.kind\s*===\s*["']delivered["'][\s\S]{0,350}releasePromptRequestReceipt/);
  assert.match(source, /notice\.kind\s*===\s*["']handoff-delivered["'][\s\S]{0,350}releasePromptRequestReceipt/);
});

test("conversation delivery prompt receipts are unique per approved attempt while preserving the initial id", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /function complexTaskDeliveryPromptRequestId\s*\(deliveryId,\s*attemptId\s*=\s*null\)/);
  assert.match(source, /attemptId\s*\?\s*`\$\{deliveryId\}:\$\{attemptId\}`\s*:\s*deliveryId/);
  assert.match(source, /complexTaskDeliveryPromptRequestId\(deliveryId,\s*attemptId\)/);
  assert.match(source, /complexTaskDeliveryPromptRequestId\(notice\.deliveryId,\s*notice\.attemptId\)/);
});

test("conversation delivery timeout signal cancels the underlying model turn", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /dispatch:\s*\(\{\s*deliveryId,\s*attemptId,\s*prompt,\s*signal\s*\}\)/);
  assert.match(source, /complexTaskDeliveryPromptRequestId\(deliveryId,\s*attemptId\)[\s\S]{0,500}signal,[\s\S]{0,300}onComplete/);
  assert.match(source, /if \(settled \|\| signal\?\.aborted\) return/);
});

test("launcher persists an accepted prompt before starting its fire-and-forget turn", async () => {
  const source = await readFile(launcherPath, "utf8");
  const anchor = source.indexOf("const retrievalHistory =");
  const accepted = source.indexOf("rememberAcceptedPromptRequest(requestId", anchor);
  const workerMatch = /\(async \(\) => \{\s*const turnStartedAt/.exec(source.slice(anchor));
  const worker = workerMatch ? anchor + workerMatch.index : -1;
  assert.ok(anchor >= 0, "submitPrompt must prepare a retrieval history");
  assert.ok(accepted > anchor, "accepted receipt must be written for the allocated turn");
  assert.ok(worker > accepted, "the model turn must start only after the accepted receipt is durable");
  assert.equal(source.indexOf("rememberAcceptedPromptRequest(requestId", worker), -1, "accepted receipt must not be written after the worker starts");
});

test("runtime controls and supervisor reconciliation schedule their new Outbox entries", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(source, /scheduleComplexTaskConversationDelivery\s*\(task/);
  assert.match(source, /onChange:\s*\(task,\s*detail\)\s*=>\s*\{[\s\S]{0,500}scheduleComplexTaskConversationDelivery\(task/);
  assert.match(source, /onChange:\s*\(task,\s*result\)\s*=>\s*\{[\s\S]{0,500}scheduleComplexTaskConversationDelivery\(task/);
});

test("startup source changes immediately invalidate the background task projection", async () => {
  const source = await readFile(launcherPath, "utf8");
  assert.match(
    source,
    /report\?\.reconcile\?\.sourceChanged\?\.length[\s\S]{0,300}broadcastDashboardEvent\(\{ kind: "background-job-change", reason: "complex-task-startup-reconcile" \}\)/,
  );
});
