import test from "node:test";
import assert from "node:assert/strict";

import { createTurnReceipt } from "./turn-receipt.mjs";

test("turn receipt aggregates bounded execution facts and deduplicates active intervention", () => {
  const receipt = createTurnReceipt({ turnId: "turn-1", requestId: "req-1", startedAt: 0 });
  receipt.observeToolStart("read_file");
  receipt.observeTool({ name: "read_file", succeeded: true, result: "ok" });
  receipt.observeTool({ name: "write_file", succeeded: false, result: "failed" });
  receipt.recordError("embedding provider returned an invalid response", { source: "model-loop" });
  receipt.recordWarning("工具参数被宿主纠正");
  receipt.recordWarning("工具参数被宿主纠正");
  receipt.recordArtifact({
    paths: ["C:\\work\\out.md"],
    files: [{ path: "C:\\work\\out.md", size: 42, mtimeMs: 10, ext: ".md", changedThisTurn: true, verification: "current-turn-write" }],
    producer: "write_file",
    verified: true,
    reason: "non-empty",
  });
  receipt.recordDocumentBinding({ documentRef: "visionox-document:1", readablePath: "C:\\temp\\plain.pdf", verified: true });
  receipt.recordContext({ transactionId: "tx-1", inputChars: 1000, estimatedTokens: 286, toolResultBytes: 128, compressed: true, resourceRefs: ["tool-output-1.txt"], pendingCount: 1, pendingChars: 120, requiresIntervention: true });

  const status = { pendingCount: 1, pendingChars: 120, finalWithPending: true };
  assert.equal(receipt.claimIntervention(status), true);
  assert.equal(receipt.claimIntervention(status), false);
  receipt.resolveIntervention("continue");
  assert.equal(receipt.claimIntervention({ ...status, pendingChars: 60 }), true);

  const snapshot = receipt.snapshot();
  assert.equal(snapshot.turnId, "turn-1");
  assert.equal(snapshot.tools.successes, 1);
  assert.equal(snapshot.tools.failures, 1);
  assert.equal(snapshot.tools.dispatches, 1);
  assert.equal(snapshot.artifactEvidence[0].verified, true);
  assert.equal(snapshot.artifactEvidence[0].files[0].verification, "current-turn-write");
  assert.equal(snapshot.documentBindings[0].documentRef, "visionox-document:1");
  assert.equal(snapshot.context.inputChars, 1000);
  assert.equal(snapshot.context.estimatedTokens, 286);
  assert.equal(snapshot.context.compressed, true);
  assert.deepEqual(snapshot.context.resourceRefs, ["tool-output-1.txt"]);
  assert.equal(snapshot.intervention.shown, 2);
  assert.deepEqual(snapshot.errors[0], {
    source: "model-loop",
    message: "embedding provider returned an invalid response",
    recordedAt: snapshot.errors[0].recordedAt,
  });
  assert.deepEqual(snapshot.warnings, ["工具参数被宿主纠正"]);
});

test("turn receipt distinguishes missing artifacts from present but unverified files", () => {
  const receipt = createTurnReceipt({ turnId: "turn-artifact-status" });
  receipt.recordArtifact({
    paths: ["C:\\work\\missing.md"],
    files: [{ path: "C:\\work\\missing.md", size: 0, mtimeMs: 0, status: "missing", verification: "missing" }],
    producer: "artifact-delivery",
    status: "missing",
    reason: "requested artifact was not found",
  });
  receipt.recordArtifact({
    paths: ["C:\\work\\existing.md"],
    files: [{ path: "C:\\work\\existing.md", size: 12, mtimeMs: 10, status: "present_unverified", verification: "existing-file" }],
    producer: "read_file",
    status: "present_unverified",
  });
  const snapshot = receipt.snapshot();
  assert.equal(snapshot.artifactEvidence[0].status, "missing");
  assert.equal(snapshot.artifactEvidence[0].files[0].status, "missing");
  assert.equal(snapshot.artifactEvidence[1].status, "present_unverified");
  assert.equal(snapshot.artifactEvidence[1].files[0].status, "present_unverified");
});

test("turn receipt keeps media degradation facts without duplicating warnings", () => {
  const receipt = createTurnReceipt({ turnId: "turn-media" });
  receipt.recordMedia({
    mediaReduced: true,
    mediaOmitted: 1,
    mediaRecovery: "media_too_large",
    mediaWarnings: ["API 413", "API 413"],
  });
  const snapshot = receipt.snapshot();
  assert.equal(snapshot.mediaReduced, true);
  assert.equal(snapshot.mediaOmitted, 1);
  assert.equal(snapshot.mediaRecovery, "media_too_large");
  assert.deepEqual(snapshot.mediaWarnings, ["API 413"]);
});

test("turn receipt records bounded model retry facts without duplicate attempts", () => {
  const receipt = createTurnReceipt({ turnId: "turn-retry", requestId: "request-retry" });
  receipt.recordModelRetry({ requestId: "model-request-1", attempt: 1, maxAttempts: 4, delayMs: 500, reason: "http 429", statusCode: 429 });
  receipt.recordModelRetry({ requestId: "model-request-1", attempt: 1, maxAttempts: 4, delayMs: 500, reason: "http 429", statusCode: 429 });
  receipt.recordModelRetry({ requestId: "model-request-1", attempt: 2, maxAttempts: 4, delayMs: 1000, reason: "network: fetch failed" });

  const snapshot = receipt.snapshot();
  assert.equal(snapshot.modelRetries.length, 2);
  assert.deepEqual(snapshot.modelRetries.map(({ requestId, attempt, maxAttempts, delayMs, reason, statusCode }) => ({ requestId, attempt, maxAttempts, delayMs, reason, statusCode })), [
    { requestId: "model-request-1", attempt: 1, maxAttempts: 4, delayMs: 500, reason: "http 429", statusCode: 429 },
    { requestId: "model-request-1", attempt: 2, maxAttempts: 4, delayMs: 1000, reason: "network: fetch failed", statusCode: null },
  ]);
});

test("turn receipt records runtime reuse without persisting local executable paths", () => {
  const receipt = createTurnReceipt({ turnId: "turn-runtime" });
  receipt.recordRuntime({
    environmentId: "pyenv-pdf",
    toolId: "python-3-12",
    status: "healthy",
    reused: true,
    packageSource: "pypi.tuna.tsinghua.edu.cn",
    requirementsHash: "sha256:abc",
    bindings: { VISIONOX_PYTHON: "C:\\private\\python.exe" },
  });
  const snapshot = receipt.snapshot();
  assert.equal(snapshot.runtime[0].environmentId, "pyenv-pdf");
  assert.equal(snapshot.runtime[0].reused, true);
  assert.equal(snapshot.runtime[0].bindings, undefined);
  assert.equal(JSON.stringify(snapshot).includes("C:\\private"), false);
});

test("turn receipt stores structured tool failure and recovery facts", () => {
  const receipt = createTurnReceipt({ turnId: "turn-failure" });
  receipt.recordToolFailure({
    toolCallId: "call-1",
    toolName: "run_command",
    category: "environment",
    code: "runtime_not_found",
    retryable: true,
    argsFingerprint: "sha256:args",
    fingerprint: "sha256:failure",
    message: "Python was not found",
    repeatFailureBlocked: true,
  });
  receipt.recordRecovery({ toolCallId: "call-2", toolName: "run_command", recovery: "selected_registered_runtime", fromFingerprint: "sha256:failure" });
  const snapshot = receipt.snapshot();
  assert.equal(snapshot.toolFailures[0].code, "runtime_not_found");
  assert.equal(snapshot.toolFailures[0].repeatFailureBlocked, true);
  assert.equal(snapshot.recoveries[0].recovery, "selected_registered_runtime");
  assert.doesNotMatch(JSON.stringify(snapshot), /python build\.py/);
});

test("turn receipt stores replayable authorization facts without raw arguments", () => {
  const receipt = createTurnReceipt({ turnId: "turn-auth", requestId: "req-auth" });
  receipt.recordAuthorizationFact({
    factId: "auth:1",
    decision: "allow",
    scope: "project",
    toolName: "run_command",
    rule: { kind: "prefix", value: "npm" },
    argsFingerprint: "sha256:args",
    reusable: true,
  });
  receipt.recordAuthorizationFact({
    factId: "auth:1",
    decision: "allow",
    scope: "project",
    toolName: "run_command",
    rule: { kind: "prefix", value: "npm" },
    reusable: true,
  });
  const snapshot = receipt.snapshot();
  assert.equal(snapshot.authorizationFacts.length, 1);
  assert.equal(snapshot.authorizationFacts[0].reusable, true);
  assert.equal("command" in snapshot.authorizationFacts[0], false);
});

test("turn receipt persists an explicit execution phase without changing model history", () => {
  const receipt = createTurnReceipt({ turnId: "turn-phase", operationId: "op-phase", sessionId: "session-phase" });
  receipt.observePhase({ role: "assistant_final" });
  receipt.observePhase({ role: "tool_start", callId: "call-phase", stepId: "step-phase" });
  receipt.complete({ ok: true, taskState: "completed" });
  const snapshot = receipt.snapshot();
  assert.equal(snapshot.phase.phase, "ended");
  assert.equal(snapshot.phase.terminalState, "completed");
  assert.equal(snapshot.phase.operationId, "op-phase");
  assert.equal(snapshot.phase.toolCallId, "call-phase");
});

test("turn receipt stores task contract and host goal verification facts", () => {
  const receipt = createTurnReceipt({ turnId: "turn-contract", operationId: "op-contract" });
  receipt.recordTaskContract({ contractVersion: 1, intent: "生成文件", expectedOutputs: [{ id: "out" }] });
  receipt.recordGoalVerification({
    executionState: "completed_with_warnings",
    goalState: "verified",
    evidenceRefs: [{ evidenceId: "artifact-1", type: "artifact", verified: true }],
    warnings: [{ code: "tool_recovery", message: "恢复后继续" }],
  });
  const snapshot = receipt.snapshot();
  assert.equal(snapshot.taskContract.intent, "生成文件");
  assert.equal(snapshot.executionState, "completed_with_warnings");
  assert.equal(snapshot.goalState, "verified");
  assert.equal(snapshot.evidenceRefs[0].verified, true);
  assert.equal(snapshot.warnings.length, 1);
});

test("unknown tool results are terminal and reject late success updates", () => {
  const receipt = createTurnReceipt({ turnId: "turn-unknown" });
  receipt.observeToolProgress({ toolCallId: "call-1", name: "run_command", status: "unknown" });
  receipt.observeToolProgress({ toolCallId: "call-1", name: "run_command", status: "succeeded", result: "late" });
  const call = receipt.snapshot().toolCalls.find((item) => item.toolCallId === "call-1");
  assert.equal(call.status, "unknown");
  assert.equal(call.result, null);
  assert.equal(receipt.snapshot().tools.results, 1);
});

test("tool progress persists host evidence type and exit code without raw arguments", () => {
  const receipt = createTurnReceipt({ turnId: "turn-evidence" });
  receipt.observeToolProgress({
    toolCallId: "call-test",
    name: "run_command",
    status: "succeeded",
    result: "[exit 0]",
    evidenceType: "test",
    exitCode: 0,
    args: { command: "npm test -- --token=secret" },
  });
  const call = receipt.snapshot().toolCalls[0];
  assert.equal(call.evidenceType, "test");
  assert.equal(call.exitCode, 0);
  assert.equal("args" in call, false);
  assert.doesNotMatch(JSON.stringify(call), /secret/u);
});

test("completion maps incomplete outcomes to unknown and does not accept late replacement", () => {
  const receipt = createTurnReceipt({ turnId: "turn-incomplete" });
  assert.equal(receipt.complete({ ok: false, taskState: "incomplete" }), true);
  assert.equal(receipt.complete({ ok: true, taskState: "completed" }), false);
  const snapshot = receipt.snapshot();
  assert.equal(snapshot.phase.terminalState, "unknown");
  assert.equal(snapshot.completion.taskState, "incomplete");
});

test("persistence failure downgrades a provisional completion to unknown", () => {
  const receipt = createTurnReceipt({ operationId: "op-persist", turnId: "turn-persist" });
  assert.equal(receipt.complete({ ok: true, taskState: "completed" }), true);
  receipt.markUnknown("final receipt was not persisted");
  const snapshot = receipt.snapshot();
  assert.equal(snapshot.phase.terminalState, "unknown");
  assert.equal(snapshot.completion.ok, false);
  assert.equal(snapshot.completion.taskState, "unknown");
  assert.equal(snapshot.executionState, "unknown");
  assert.equal(snapshot.goalState, "unknown");
  assert.equal(snapshot.completion.executionState, "unknown");
  assert.equal(snapshot.completion.goalState, "unknown");
  assert.match(snapshot.phase.reason, /not persisted/);
});

test("turn receipt records lifecycle hook outcomes without raw tool arguments", () => {
  const receipt = createTurnReceipt({ operationId: "op-hooks", sessionId: "session-hooks", turnId: "turn-hooks" });
  receipt.recordLifecycleHook({
    event: "prepareTool",
    operationId: "op-hooks",
    toolCallId: "call-hooks",
    stepId: "step-hooks",
    attempt: 1,
    payload: { args: { command: "echo secret" } },
    result: { results: [{ status: "timeout" }] },
    ignoredDecision: true,
  });
  receipt.recordLifecycleHook({
    event: "prepareTool",
    operationId: "op-hooks",
    toolCallId: "call-hooks",
    stepId: "step-hooks",
    attempt: 1,
    result: { results: [{ status: "timeout" }] },
    ignoredDecision: true,
  });
  const snapshot = receipt.snapshot();
  assert.equal(snapshot.lifecycleHooks.length, 1);
  assert.equal(snapshot.lifecycleHooks[0].event, "prepareTool");
  assert.deepEqual(snapshot.lifecycleHooks[0].statuses, ["timeout"]);
  assert.doesNotMatch(JSON.stringify(snapshot), /echo secret/);
});
