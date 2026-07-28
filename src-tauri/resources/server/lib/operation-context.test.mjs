import assert from "node:assert/strict";
import { test } from "node:test";
import { closeOperationContext, createOperationContext, isOperationContextActive, recordOperationAuthorizationFact, recordOperationRecovery, recordOperationToolFailure, recordOperationToolSuccess, recordOperationToolSuccessFact, requestOperationStop, shouldBlockRepeatedToolFailure } from "./operation-context.mjs";

test("operation context carries stable execution identity and starts active", () => {
  const controller = new AbortController();
  const context = createOperationContext({
    operationId: "operation-1",
    kind: "chat",
    conversationId: "conversation-1",
    workspace: "C:/workspace",
    signal: controller.signal,
    startedAt: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(context.version, 1);
  assert.equal(context.source, "chat");
  assert.equal(isOperationContextActive(context, { operationId: "operation-1", conversationId: "conversation-1" }), true);
  assert.equal(isOperationContextActive(context, { operationId: "operation-2" }), false);
});

test("operation context closes and invalidates authorization and signal", () => {
  const controller = new AbortController();
  const context = createOperationContext({ operationId: "operation-2", kind: "chat", signal: controller.signal });
  context.sendAuthorization = { version: 1 };
  closeOperationContext(context, "cancelled", "2026-07-24T00:01:00.000Z");
  assert.equal(context.state, "cancelled");
  assert.equal(context.closedAt, "2026-07-24T00:01:00.000Z");
  assert.equal(context.sendAuthorization, null);
  assert.equal(context.signal, null);
  assert.equal(isOperationContextActive(context, { operationId: "operation-2" }), false);
});

test("requesting stop immediately invalidates send authorization while tools unwind", () => {
  const controller = new AbortController();
  const context = createOperationContext({ operationId: "operation-3", kind: "chat", signal: controller.signal });
  context.sendAuthorization = { operationId: "operation-3" };
  assert.equal(requestOperationStop(context, "session_switched", "2026-07-24T00:02:00.000Z"), true);
  assert.equal(context.state, "stopping");
  assert.equal(context.stopReason, "session_switched");
  assert.equal(context.stopRequestedAt, "2026-07-24T00:02:00.000Z");
  assert.equal(context.sendAuthorization, null);
  assert.equal(isOperationContextActive(context, { operationId: "operation-3" }), false);
  assert.equal(requestOperationStop(context, "duplicate"), false);
});

test("terminal operation state is idempotent and cannot be overwritten by late cleanup", () => {
  const context = createOperationContext({ operationId: "operation-4", kind: "chat" });
  closeOperationContext(context, "unknown", "2026-07-24T00:03:00.000Z");
  closeOperationContext(context, "completed", "2026-07-24T00:04:00.000Z");
  assert.equal(context.state, "unknown");
  assert.equal(context.closedAt, "2026-07-24T00:03:00.000Z");
});

test("operation context records bounded failure fingerprints and recovery facts", () => {
  const context = createOperationContext({ operationId: "operation-5", kind: "chat" });
  const outcome = { category: "environment", code: "runtime_not_found", retryable: true, exitCode: 9009, message: "Python was not found" };
  const first = recordOperationToolFailure(context, { toolCallId: "call-1", toolName: "run_command", args: { command: "python build.py" }, outcome, maxAttempts: 2 });
  const second = recordOperationToolFailure(context, { toolCallId: "call-2", toolName: "run_command", args: { command: "python build.py" }, outcome, maxAttempts: 2 });
  assert.equal(first.repeatFailureBlocked, false);
  assert.equal(second.repeatFailureBlocked, true);
  assert.equal(context.toolFailures.length, 2);
  assert.equal(context.toolFailures[0].argsFingerprint, context.toolFailures[1].argsFingerprint);
  const recovery = recordOperationRecovery(context, { toolCallId: "call-3", toolName: "run_command", recovery: "selected_registered_runtime", fromFingerprint: first.fingerprint });
  assert.equal(recovery.recovery, "selected_registered_runtime");
  assert.equal(context.recoveries.length, 1);
});

test("repeated failure checks are idempotent and block only after the configured limit", () => {
  const context = createOperationContext({ operationId: "operation-6", kind: "chat" });
  const outcome = { category: "environment", code: "runtime_not_found", retryable: true, exitCode: 9009, message: "Python was not found" };
  const first = recordOperationToolFailure(context, { toolCallId: "call-1", toolName: "run_command", args: { command: "python build.py" }, outcome, maxAttempts: 2 });
  assert.equal(shouldBlockRepeatedToolFailure(context, { toolName: "run_command", args: { command: "python build.py" }, maxAttempts: 2 }).blocked, false);
  const duplicate = recordOperationToolFailure(context, { toolCallId: "call-1", toolName: "run_command", args: { command: "python build.py" }, outcome, maxAttempts: 2 });
  assert.equal(duplicate.count, first.count);
  assert.equal(context.toolFailures.length, 1);
  recordOperationToolFailure(context, { toolCallId: "call-2", toolName: "run_command", args: { command: "python build.py" }, outcome, maxAttempts: 2 });
  const blocked = shouldBlockRepeatedToolFailure(context, { toolName: "run_command", args: { command: "python build.py" }, maxAttempts: 2 });
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.failure.fingerprint, first.fingerprint);
  assert.equal(shouldBlockRepeatedToolFailure(context, { toolName: "run_command", args: { command: "python other.py" }, maxAttempts: 2 }).blocked, false);
});

test("successful recovery resets only the active consecutive failure counter", () => {
  const context = createOperationContext({ operationId: "operation-7", kind: "chat" });
  const outcome = { category: "environment", code: "runtime_not_found", retryable: true, exitCode: 9009, message: "Python was not found" };
  const first = recordOperationToolFailure(context, { toolCallId: "call-1", toolName: "run_command", args: { command: "python build.py" }, outcome, maxAttempts: 2 });
  recordOperationToolFailure(context, { toolCallId: "call-2", toolName: "run_command", args: { command: "python build.py" }, outcome, maxAttempts: 2 });
  assert.equal(shouldBlockRepeatedToolFailure(context, { toolName: "run_command", args: { command: "python build.py" }, maxAttempts: 2 }).blocked, true);

  recordOperationRecovery(context, { toolCallId: "call-3", toolName: "run_command", recovery: "selected_registered_runtime", fromFingerprint: first.fingerprint });
  assert.equal(context.failureFingerprints[first.fingerprint], 0);
  assert.equal(shouldBlockRepeatedToolFailure(context, { toolName: "run_command", args: { command: "python build.py" }, maxAttempts: 2 }).blocked, false);

  recordOperationToolFailure(context, { toolCallId: "call-4", toolName: "run_command", args: { command: "python build.py" }, outcome, maxAttempts: 2 });
  assert.equal(shouldBlockRepeatedToolFailure(context, { toolName: "run_command", args: { command: "python build.py" }, maxAttempts: 2 }).blocked, false);
});

test("success for a different tool argument does not reset the failed invocation", () => {
  const context = createOperationContext({ operationId: "operation-8", kind: "chat" });
  const outcome = { category: "environment", code: "runtime_not_found", retryable: true, exitCode: 9009 };
  const first = recordOperationToolFailure(context, { toolCallId: "call-1", toolName: "run_command", args: { command: "python build.py" }, outcome, maxAttempts: 2 });
  recordOperationToolFailure(context, { toolCallId: "call-2", toolName: "run_command", args: { command: "python build.py" }, outcome, maxAttempts: 2 });
  assert.equal(recordOperationToolSuccess(context, { toolName: "run_command", args: { command: "python test.py" } }), null);
  assert.equal(shouldBlockRepeatedToolFailure(context, { toolName: "run_command", args: { command: "python build.py" }, maxAttempts: 2 }).blocked, true);
  assert.equal(recordOperationToolSuccess(context, { toolName: "run_command", args: { command: "python build.py" } }).fingerprint, first.fingerprint);
  assert.equal(shouldBlockRepeatedToolFailure(context, { toolName: "run_command", args: { command: "python build.py" }, maxAttempts: 2 }).blocked, false);
});

test("operation context records deduplicated sanitized authorization facts", () => {
  const context = createOperationContext({ operationId: "operation-auth", kind: "chat" });
  const fact = recordOperationAuthorizationFact(context, {
    factId: "auth:1",
    decision: "allow",
    scope: "project",
    toolName: "run_command",
    rule: { kind: "prefix", value: "npm" },
    argsFingerprint: "sha256:args",
    reusable: true,
  });
  recordOperationAuthorizationFact(context, fact);
  assert.equal(context.authorizationFacts.length, 1);
  assert.equal(context.authorizationFacts[0].rule.value, "npm");
  assert.equal("command" in context.authorizationFacts[0], false);
});

test("operation context records deduplicated tool success facts without raw output", () => {
  const context = createOperationContext({ operationId: "operation-success-fact", kind: "chat" });
  const first = recordOperationToolSuccessFact(context, {
    toolCallId: "call-success-1",
    toolName: "run_command",
    args: { command: "python build.py", env: { SECRET: "hidden" } },
    recordedAt: "2026-07-28T00:00:00.000Z",
  });
  const duplicate = recordOperationToolSuccessFact(context, {
    toolCallId: "call-success-1",
    toolName: "run_command",
    args: { command: "python build.py", env: { SECRET: "changed" } },
    recordedAt: "2026-07-28T00:01:00.000Z",
  });

  assert.equal(first.status, "succeeded");
  assert.equal(first.toolCallId, "call-success-1");
  assert.match(first.argsFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.equal("resultPreview" in first, false);
  assert.equal(duplicate, first);
  assert.equal(context.toolSuccesses.length, 1);
  assert.equal(JSON.stringify(context.toolSuccesses).includes("hidden"), false);
});
