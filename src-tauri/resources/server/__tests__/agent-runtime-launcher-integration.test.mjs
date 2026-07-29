import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const launcherUrl = new URL("../launcher.mjs", import.meta.url);
const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);

test("launcher routes prompt sources and background completions through AgentSessionRuntime", async () => {
  const source = await readFile(launcherUrl, "utf8");
  assert.match(source, /createAgentSessionRuntime/u);
  assert.match(source, /agentSessionRuntime\s*=\s*createAgentSessionRuntime/u);
  assert.match(source, /ctx\.submitPrompt\s*=\s*submitAgentInput/u);
  assert.match(source, /wakeAgentForBackgroundNotification\(notification, scope\)/u);
});

test("launcher restores admission only after the owning Session identity is applied", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const construction = source.slice(
    source.indexOf("const sessionInputAdmission = createSessionInputAdmission"),
    source.indexOf("function hasUserMessage()"),
  );
  assert.doesNotMatch(construction, /initialInteractionMetadata\.value\?\.promptInputs/u);
  assert.match(
    source,
    /applyLoadedMetadata:\s*\(meta\) => \{[\s\S]{0,400}activeConversationId\s*=[\s\S]{0,800}sessionInputAdmission\.restore\(meta\.promptInputs\)/u,
  );
});

test("launcher stops the old Operation before replacing the active Session identity", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const resetBlock = source.slice(
    source.indexOf("async function resetActiveConversation"),
    source.indexOf("function isValidSessionName"),
  );
  const stopIndex = resetBlock.indexOf("stopActiveOperationForSessionMutation(");
  const replaceIndex = resetBlock.indexOf("activeConversationId = randomUUID()");
  assert.ok(stopIndex >= 0 && replaceIndex > stopIndex, "old Operation must stop before Session identity changes");
  assert.doesNotMatch(source, /refreshOperationContextScope/u);
});

test("resuming a session wakes its durable background notifications before an empty load returns", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const resumeStart = source.indexOf("// ── Session resume: load historical messages");
  const resumeEnd = source.indexOf("// Handle /learn:", resumeStart);
  assert.ok(resumeStart >= 0 && resumeEnd > resumeStart, "session resume block must remain discoverable");
  const resumeBlock = source.slice(resumeStart, resumeEnd);
  assert.match(
    resumeBlock,
    /await wakePendingBackgroundTaskNotifications\(\{[\s\S]{0,240}sessionId:\s*activeConversationId[\s\S]{0,240}workspace:\s*workspaceDir[\s\S]{0,160}\}\);[\s\S]{0,240}if \(!text \|\| !text\.trim\(\)\)/u,
  );
});

test("launcher discards rejected Plan state through PlanRuntime", async () => {
  const source = await readFile(launcherUrl, "utf8");
  assert.match(source, /planRuntime\?\.discardPending\?\.\("user_rejected"\)/u);
  assert.match(source, /planRuntime\?\.discardRevision\?\.\("user_rejected"\)/u);
  assert.match(source, /planRuntime\?\.discardPending\?\.\("submit_plan_failed"\)/u);
});

test("launcher reads Plan state from PlanRuntime without writable mirrors", async () => {
  const source = await readFile(launcherUrl, "utf8");
  assert.doesNotMatch(source, /let (?:pendingPlan|activePlanSteps|activeCompletedIds|activePlanSummary|activePlanBody|activePlanUpdatedAt|activePlanId|activePlanRequestId|pendingPlanRevision)\s*=/u);
  assert.match(source, /const plan = planRuntime\?\.snapshot\?\.\(\) \?\? null/u);
  assert.match(source, /planRuntime\?\.setRevision\(\{ reason, remainingSteps, summary \}\)/u);
  assert.match(source, /planRuntime\?\.acceptRevision\?\.\(\)/u);
});

test("launcher persists and closes an operation before publishing idle", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const teardown = source.slice(
    source.indexOf("async function finalizeOperationBoundary("),
    source.indexOf("function scheduleQueuedSessionInputDrain("),
  );
  assert.match(teardown, /finishActiveOperation\(operation\);[\s\S]{0,500}await flushRuntimeFacts\(\);[\s\S]{0,500}busy = false;[\s\S]{0,200}busy-change/u);
  assert.match(teardown, /scheduleQueuedSessionInputDrain\(operation\)/u);
  assert.match(teardown, /scheduleQueuedSessionInputDrain\(operation, \{[\s\S]{0,160}sessionId: activeConversationId/u);
  assert.doesNotMatch(source, /busy = false;\s*\n\s*broadcastDashboardEvent\(\{ kind: "busy-change", busy: false \}\);\s*\n\s*finishActiveOperation\(operation\)/u);
});

test("launcher includes strict file facts and guards queue cleanup without an Operation", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const artifactStart = source.indexOf("function generatedArtifactFileInfo(");
  const artifactEnd = source.indexOf("function rescanArtifactEvidence(", artifactStart);
  assert.ok(artifactStart >= 0 && artifactEnd > artifactStart, "artifact metadata helper must remain discoverable");
  const artifactBlock = source.slice(artifactStart, artifactEnd);
  assert.match(artifactBlock, /isFile:\s*true/u);

  const queueStart = source.indexOf("function scheduleQueuedSessionInputDrain(");
  const queueEnd = source.indexOf("//", queueStart + 20);
  const queueBlock = source.slice(queueStart, queueEnd > queueStart ? queueEnd : queueStart + 500);
  assert.match(queueBlock, /if \(!operation\) return;/u);
});

test("normal and local-command exits share teardown and terminal steers become queue inputs", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const submit = source.slice(
    source.indexOf("submitPrompt: async"),
    source.indexOf("abortTurn:", source.indexOf("submitPrompt: async")),
  );
  assert.equal((submit.match(/await finalizeOperationBoundary\(operation,/gu) ?? []).length, 2);
  assert.match(
    submit,
    /const admittedDelivery = activeOperation\?\.id \? requestedDelivery : "queue";[\s\S]{0,1200}delivery: admittedDelivery/u,
  );
});

test("reset and named-session switch block admission for the full mutation window", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const reset = source.slice(
    source.indexOf("async function resetActiveConversation("),
    source.indexOf("function isValidSessionName("),
  );
  assert.match(reset, /beginSessionMutation\("reset"\)/u);
  assert.match(reset, /finally \{[\s\S]{0,120}endSessionMutation\(mutationToken\)/u);

  const submit = source.slice(
    source.indexOf("submitPrompt: async"),
    source.indexOf("abortTurn:", source.indexOf("submitPrompt: async")),
  );
  assert.ok(
    submit.indexOf("if (sessionMutationInFlight)") < submit.indexOf("if (busy)"),
    "session mutation must reject new admission before the busy steering branch",
  );
  assert.match(
    submit,
    /if \(sessionName && loop\) \{[\s\S]{0,160}sessionMutationToken = beginSessionMutation\("session_switch"\);[\s\S]{0,600}await ctx\.syncWorkspace/u,
  );
  assert.match(submit, /endSessionMutation\(sessionMutationToken\);[\s\S]{0,120}sessionMutationToken = null/u);

  const admission = source.slice(
    source.indexOf("async function submitAgentInput("),
    source.indexOf("ctx.submitPrompt = submitAgentInput"),
  );
  assert.match(admission, /if \(sessionMutationInFlight\)[\s\S]{0,200}SESSION_MUTATION_ACTIVE/u);
});

test("named-session loading does not rebind an Operation across session identities", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const resumeStart = source.indexOf("// ── Session resume: load historical messages");
  const resumeEnd = source.indexOf("// Handle /learn:", resumeStart);
  assert.ok(resumeStart >= 0 && resumeEnd > resumeStart, "session resume block must remain discoverable");
  const resumeBlock = source.slice(resumeStart, resumeEnd);
  assert.doesNotMatch(resumeBlock, /refreshOperationContextScope|bindOperationSessionRun\(operation,\s*\{\s*replace:\s*true/u);
  const emptyLoadIndex = resumeBlock.indexOf("if (!text || !text.trim())");
  const initializeIndex = resumeBlock.indexOf("initializeOperation()", emptyLoadIndex);
  assert.ok(emptyLoadIndex >= 0 && initializeIndex > emptyLoadIndex, "target prompt Operation must start after session loading");
  assert.match(source, /if \(!\(sessionName && loop\)\) initializeOperation\(\)/u);
});

test("messages API preserves legacy pagination and adds an atomic session snapshot", async () => {
  const source = await readFile(serverUrl, "utf8");
  assert.match(source, /VISIONOX_PATCH_SESSION_SNAPSHOT_V1/u);
  assert.match(source, /await ctx\.getSessionSnapshot\?\.\(\)/u);
  assert.match(source, /snapshot,/u);
});

test("session snapshots wait for a stable fact tail and retry a concurrent session switch", async () => {
  const source = await readFile(launcherUrl, "utf8");
  assert.match(source, /do \{[\s\S]{0,160}observedTail = runtimeFactWriteTail;[\s\S]{0,160}await observedTail;[\s\S]{0,160}\} while \(observedTail !== runtimeFactWriteTail\)/u);
  assert.match(source, /for \(;;\) \{[\s\S]{0,240}const sessionId = activeConversationId;[\s\S]{0,240}await runtimeFactStoreFor\(sessionId\);[\s\S]{0,240}await flushRuntimeFacts\(\);[\s\S]{0,160}if \(sessionId !== activeConversationId\) continue;/u);
});

test("session snapshot publishes the process cursor only after every event fact is durable", async () => {
  const source = await readFile(launcherUrl, "utf8");
  assert.match(source, /runtimeFactPersistedCursors\s*=\s*new Map/u);
  const factQueue = source.slice(
    source.indexOf("function queueRuntimeFactsFromDashboardEvent(event)"),
    source.indexOf("async function flushRuntimeFacts()"),
  );
  assert.match(factQueue, /const result = await store\.append\(fact\)/u);
  assert.match(factQueue, /if \(!result\?\.accepted && !result\?\.duplicate/u);
  assert.match(factQueue, /result\?\.code !== "TERMINAL_STATE_DOWNGRADE"/u);
  assert.match(factQueue, /runtimeFactPersistedCursors\.set\(sessionId, eventId\)/u);
  assert.ok(
    factQueue.indexOf("runtimeFactPersistedCursors.set(sessionId, eventId)") > factQueue.indexOf("await store.append(fact)"),
    "the cursor watermark must move only after fact persistence",
  );

  const snapshotBuilder = source.slice(
    source.indexOf("async function buildSessionSnapshot()"),
    source.indexOf("// ── Dashboard context"),
  );
  assert.match(snapshotBuilder, /await flushRuntimeFacts\(\);[\s\S]{0,120}await dashboardEventCommitTail;[\s\S]{0,240}const eventCursor = dashboardEventStream\.latestCursor\(\)/u);
  assert.doesNotMatch(snapshotBuilder, /const eventCursor = runtimeFactCursorFor\(sessionId\)/u);
});

test("launcher preserves authoritative terminal fields in runtime facts", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const factAdapter = source.slice(
    source.indexOf("function runtimeFactsForDashboardEvent(event)"),
    source.indexOf("function queueRuntimeFactsFromDashboardEvent(event)"),
  );
  assert.match(factAdapter, /event\.taskContract !== undefined/u);
  assert.match(factAdapter, /taskContract:\s*event\.taskContract/u);
  assert.match(factAdapter, /event\.evidenceRefs !== undefined/u);
  assert.match(factAdapter, /evidenceRefs:\s*event\.evidenceRefs/u);
  assert.match(factAdapter, /event\.interventionChoice !== undefined/u);
  assert.match(factAdapter, /interventionChoice:\s*event\.interventionChoice/u);

  const terminalBroadcaster = source.slice(
    source.indexOf("function broadcastTurnFinalized(payload = {})"),
    source.indexOf("const dashboardAssistantStreams"),
  );
  assert.match(terminalBroadcaster, /interventionChoice:\s*payload\.interventionChoice/u);
});

test("launcher records host-classified tool evidence without persisting raw arguments", async () => {
  const source = await readFile(launcherUrl, "utf8");
  assert.match(source, /const \{ classifyToolEvidence, verifyGoalContract \} = await importEarly\("\.\/lib\/goal-verification-runtime\.mjs"\)/u);
  const observation = source.slice(
    source.indexOf("turnReceipt.observeToolProgress({"),
    source.indexOf("if (ev.role === \"media_recovery\")"),
  );
  assert.match(observation, /evidenceType:\s*classifyToolEvidence\(\{[\s\S]{0,200}name:[\s\S]{0,120}args:\s*ev\.toolArgs/u);
  assert.match(observation, /exitCode:\s*normalizedToolOutcome\?\.exitCode/u);
});

test("session snapshots merge durable message facts over compatibility messages", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const snapshotBuilder = source.slice(
    source.indexOf("async function buildSessionSnapshot()"),
    source.indexOf("// ── Dashboard context"),
  );
  assert.match(snapshotBuilder, /messages:\s*mergeSnapshotMessages\(messageSnapshot, facts\.messages\)/u);
  assert.match(snapshotBuilder, /const facts = store\.snapshot\(\);[\s\S]{0,160}const eventCursor = dashboardEventStream\.latestCursor\(\)/u);
});

test("session snapshots retain durable task notifications when the memory queue is empty", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const snapshotBuilder = source.slice(
    source.indexOf("async function buildSessionSnapshot()"),
    source.indexOf("// ── Dashboard context"),
  );
  assert.match(
    snapshotBuilder,
    /taskNotifications:\s*uniqueSnapshotEntities\(\[[\s\S]{0,160}\.\.\.facts\.taskNotifications,[\s\S]{0,320}\.\.\.notificationSnapshot\.pending/u,
  );
});

test("launcher persists message resets and scopes tool facts by their complete frame identity", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const factAdapter = source.slice(
    source.indexOf("function runtimeFactsForDashboardEvent(event)"),
    source.indexOf("function queueRuntimeFactsFromDashboardEvent(event)"),
  );
  assert.match(factAdapter, /event\.kind === "messages-reset"[\s\S]{0,180}messages\.replace/u);
  assert.match(factAdapter, /\["warning", "error", "info"\]\.includes\(event\.kind\)[\s\S]{0,220}message\.upsert/u);
  assert.match(factAdapter, /toolFrameEntityId\(event\)/u);
});

test("a promoted steer is durably resolved after its model-history record is saved", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const boundaryStart = source.indexOf("beforeModelRequest: async");
  const boundaryEnd = source.indexOf("await runtimeLifecycleHooks", boundaryStart);
  assert.ok(boundaryStart >= 0 && boundaryEnd > boundaryStart, "model boundary block must remain discoverable");
  const boundary = source.slice(boundaryStart, boundaryEnd);
  assert.match(
    boundary,
    /await appendActiveMessage\(historyMessage\)[\s\S]{0,800}sessionInputAdmission\.resolve\([\s\S]{0,120}input\.id,[\s\S]{0,80}"dispatched",[\s\S]{0,80}"model_history_persisted",[\s\S]{0,80}\{ operationId: operation\.id \}/u,
  );
});

test("launcher fallback Plan cancellation publishes an explicit cleared snapshot", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const cancelAdapter = source.slice(
    source.indexOf("function cancelActivePlan()"),
    source.indexOf("// ── Scheduled tasks"),
  );
  assert.match(cancelAdapter, /broadcastDashboardEvent\(\{ kind: "plan-cancelled", session, plan: null \}\)/u);
});

test("manual Plan completion advances the host evidence watermark", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const completion = source.slice(
    source.indexOf("function completeActivePlanStep(stepId)"),
    source.indexOf("function cancelActivePlan()"),
  );
  assert.match(completion, /markStepDone\(stepId, \[userConfirmation\], \{ source: "manual" \}\)/u);
  assert.match(completion, /advancePlanEvidenceCursor\(\);/u);
});

test("manual Plan completion is fenced while an operation is active", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const completion = source.slice(
    source.indexOf("function completeActivePlanStep(stepId)"),
    source.indexOf("function cancelActivePlan()"),
  );
  assert.match(completion, /if \(busy \|\| operationRuntime\?\.getActive\?\.\(\)\)/u);
  assert.match(completion, /工具事实稳定后才能手动完成计划步骤/u);
});

test("side questions use a text-only auxiliary request instead of a tool loop", async () => {
  const source = await readFile(launcherUrl, "utf8");
  const start = source.indexOf('// /btw <question>');
  const end = source.indexOf('// /report daily|weekly', start);
  assert.ok(start >= 0 && end > start, "side-question command block must remain discoverable");
  const block = source.slice(start, end);
  assert.match(block, /await requestModelText\(\{/u);
  assert.match(block, /requestPurpose:\s*"side-question"/u);
  assert.match(block, /Do not call tools|不得调用任何工具/u);
  assert.doesNotMatch(block, /buildLoop\(|tmpLoop|\.step\(/u);
});
