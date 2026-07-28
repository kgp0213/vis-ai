import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { normalizeToolOutcome, projectToolProgressEvent, redactToolProgressValue } from "./tool-progress.mjs";
import { createTurnReceipt } from "./turn-receipt.mjs";

describe("tool progress projection", () => {
  test("keeps one stable identity across queued, running and terminal facts", () => {
    const base = { toolName: "send", toolArgs: JSON.stringify({ apiKey: "secret", path: "C:/work/a.txt" }), callId: "call-1" };
    const queued = projectToolProgressEvent({ ...base, role: "tool_queued", toolStatus: "queued" }, { assistantId: "assistant-1" });
    const running = projectToolProgressEvent({ ...base, role: "tool_start", toolStatus: "running" }, { assistantId: "assistant-1" });
    const done = projectToolProgressEvent({ ...base, role: "tool", toolStatus: "succeeded", content: "token=private\nok" }, { assistantId: "assistant-1" });

    assert.equal(queued.id, running.id);
    assert.equal(running.id, done.id);
    assert.equal(done.toolCallId, "call-1");
    assert.equal(done.turnId, "assistant-1");
    assert.equal(done.stepId, "call-1");
    assert.equal(done.category, null);
    assert.deepEqual([queued.status, running.status, done.status], ["queued", "running", "succeeded"]);
    assert.doesNotMatch(JSON.stringify([queued, running, done]), /secret|private/);
  });

  test("redacts nested credentials while preserving useful non-secret facts", () => {
    const value = redactToolProgressValue({
      headers: { Authorization: "Bearer hidden", "X-API-Key": "hidden-too" },
      path: "C:/work/a.txt",
      nested: [{ password: "hidden", secret_access_key: "aws-secret", access_key_id: "aws-id", credentials: "credential-bundle" }],
    });
    assert.equal(value.path, "C:/work/a.txt");
    assert.equal(value.headers.Authorization, "[REDACTED]");
    assert.equal(value.headers["X-API-Key"], "[REDACTED]");
    assert.equal(value.nested[0].password, "[REDACTED]");
    assert.equal(value.nested[0].secret_access_key, "[REDACTED]");
    assert.equal(value.nested[0].access_key_id, "[REDACTED]");
    assert.equal(value.nested[0].credentials, "[REDACTED]");
  });

  test("redacts credentials from structured tool results before Dashboard projection", () => {
    const done = projectToolProgressEvent({
      role: "tool",
      toolStatus: "succeeded",
      toolName: "probe",
      callId: "call-json",
      content: JSON.stringify({ ok: true, credentials: { apiKey: "json-secret", clientSecret: "client-secret" } }),
    });

    assert.match(done.content, /\"ok\":true/);
    assert.doesNotMatch(done.content, /json-secret|client-secret/);
    assert.match(done.content, /\[REDACTED\]/);
  });

  test("redacts common credential labels from unstructured tool results", () => {
    const done = projectToolProgressEvent({
      role: "tool",
      toolStatus: "failed",
      toolName: "probe",
      callId: "call-text",
      content: "secret_access_key=aws-secret access_key_id=aws-id credentials=credential-bundle",
    });

    assert.doesNotMatch(done.content, /aws-secret|aws-id|credential-bundle/);
    assert.equal((done.content.match(/\[REDACTED\]/g) ?? []).length, 3);
  });

  test("treats non-zero command exit codes as failed tool outcomes", () => {
    const failed = normalizeToolOutcome("$ command\n[exit 9009]\ncommand failed");
    const succeeded = normalizeToolOutcome("$ command\n[exit 0]\ncompleted");
    assert.equal(failed.ok, false);
    assert.equal(failed.status, "failed");
    assert.equal(failed.exitCode, 9009);
    assert.equal(failed.code, "tool_exit_nonzero");
    assert.equal(succeeded.ok, true);
    assert.equal(succeeded.status, "succeeded");
    assert.equal(succeeded.exitCode, 0);
  });

  test("uses the final exit marker when a tool emits more than one marker", () => {
    const outcome = normalizeToolOutcome("diagnostic mentioned [exit 1]\nrunner completed\n[exit 0]");
    assert.equal(outcome.ok, true);
    assert.equal(outcome.exitCode, 0);
  });

  test("classifies a missing Python runtime separately from its exit code", () => {
    const outcome = normalizeToolOutcome("$ python script.py\n[exit 9009]\nPython was not found");
    assert.equal(outcome.ok, false);
    assert.equal(outcome.code, "runtime_not_found");
    assert.equal(outcome.category, "environment");
    assert.equal(outcome.retryable, true);
    assert.equal(outcome.recommendedAction, "reuse_registered_runtime");
    assert.equal(outcome.exitCode, 9009);
    const projected = projectToolProgressEvent({ role: "tool", toolStatus: "failed", toolName: "run_command", callId: "runtime-1", content: "$ python script.py\n[exit 9009]\nPython was not found" });
    assert.equal(projected.category, "environment");
    assert.equal(projected.recommendedAction, "reuse_registered_runtime");
  });

  test("does not let a shell fallback hide a missing runtime", () => {
    const outcome = normalizeToolOutcome("python: command not found\nfallback executed\n[exit 0]");
    assert.equal(outcome.ok, false);
    assert.equal(outcome.code, "runtime_not_found");
    assert.equal(outcome.exitCode, 0);
    assert.equal(normalizeToolOutcome("'node' is not recognized as an internal or external command\n[exit 0]").code, "runtime_not_found");
  });

  test("treats an explicit zero exit as success unless a structured failure or runtime diagnostic exists", () => {
    const successfulText = normalizeToolOutcome("completed with note: error: value was repaired\n[exit 0]");
    assert.equal(successfulText.status, "succeeded");
    assert.equal(normalizeToolOutcome(JSON.stringify({ ok: false, error: "reported failure", exitCode: 0 })).status, "failed");
    assert.equal(normalizeToolOutcome("Python was not found\n[exit 0]").code, "runtime_not_found");
  });

  test("projects timeout and cancellation facts", () => {
    const timeout = projectToolProgressEvent({
      role: "tool",
      toolName: "run_command",
      callId: "timeout-1",
      content: "$ npm test\n[killed after timeout]",
    });
    const cancelled = normalizeToolOutcome(JSON.stringify({ ok: false, cancelled: true, error: "aborted" }));
    assert.equal(timeout.status, "failed");
    assert.equal(timeout.timedOut, true);
    assert.equal(timeout.retryable, true);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.cancelled, true);
    assert.equal(normalizeToolOutcome("credential validation failed", { status: "failed" }).status, "failed");
  });

  test("honors explicit terminal status and does not infer cancellation from ordinary prose", () => {
    assert.equal(normalizeToolOutcome("", { status: "succeeded" }).status, "succeeded");
    assert.equal(normalizeToolOutcome("the operation was not cancelled; completed", { status: "succeeded" }).status, "succeeded");
    assert.equal(normalizeToolOutcome("", { status: "failed" }).status, "failed");
    assert.equal(normalizeToolOutcome(JSON.stringify({ ok: true, exitCode: null }), { status: "succeeded" }).exitCode, null);
    assert.equal(normalizeToolOutcome(JSON.stringify({ ok: true, exitCode: "" }), { status: "succeeded" }).exitCode, null);
  });

  test("classifies AbortError and structured error fields as failures", () => {
    const aborted = normalizeToolOutcome("AbortError: The request was aborted");
    const structured = normalizeToolOutcome(JSON.stringify({ error: "" }));
    assert.equal(aborted.status, "cancelled");
    assert.equal(aborted.cancelled, true);
    assert.equal(structured.status, "failed");
    assert.equal(structured.code, "tool_failed");
  });

  test("preserves structured diagnostics and warnings without treating ordinary text as an error", () => {
    const structured = normalizeToolOutcome(JSON.stringify({
      ok: false,
      code: "runtime_not_found",
      category: "environment",
      retryable: true,
      recommendedAction: "reuse_registered_runtime",
      warnings: ["using registered interpreter"],
      error: "python unavailable",
    }));
    assert.equal(structured.code, "runtime_not_found");
    assert.equal(structured.category, "environment");
    assert.equal(structured.retryable, true);
    assert.equal(structured.recommendedAction, "reuse_registered_runtime");
    assert.deepEqual(structured.warnings, ["using registered interpreter"]);
    assert.equal(normalizeToolOutcome("the word error appears in a successful report", { status: "succeeded" }).status, "succeeded");
    assert.equal(normalizeToolOutcome("report text includes error: value was repaired").status, "succeeded");
    assert.equal(normalizeToolOutcome("error: command could not be completed").status, "failed");
  });

  test("does not replace a structured runtime code with a conflicting text diagnostic", () => {
    const outcome = normalizeToolOutcome(JSON.stringify({
      ok: false,
      code: "runtime_install_approval_required",
      category: "permission",
      retryable: false,
      recommendedAction: "request_runtime_install_approval",
      error: "Python was not found while preparing the optional package",
    }));
    assert.equal(outcome.code, "runtime_install_approval_required");
    assert.equal(outcome.category, "permission");
    assert.equal(outcome.retryable, false);
    assert.equal(outcome.recommendedAction, "request_runtime_install_approval");
  });

  test("preserves resource failures as structured recoverable tool facts", () => {
    const missing = normalizeToolOutcome(JSON.stringify({
      ok: false,
      code: "resource_missing",
      category: "resource",
      retryable: false,
      error: "tool output resource not found or expired",
    }));
    assert.equal(missing.ok, false);
    assert.equal(missing.code, "resource_missing");
    assert.equal(missing.category, "resource");
    assert.equal(missing.retryable, false);
  });

  test("stores bounded per-call progress in the turn receipt", () => {
    const receipt = createTurnReceipt({ turnId: "turn-1" });
    receipt.observeToolProgress({ toolCallId: "call-1", name: "probe", status: "queued" });
    receipt.observeToolProgress({ toolCallId: "call-1", name: "probe", status: "running" });
    receipt.observeToolProgress({ toolCallId: "call-1", name: "probe", status: "succeeded", result: "ok" });
    const snapshot = receipt.snapshot();
    assert.equal(snapshot.tools.dispatches, 1);
    assert.equal(snapshot.tools.results, 1);
    assert.equal(snapshot.toolCalls.length, 1);
    assert.equal(snapshot.toolCalls[0].status, "succeeded");
  });
});
