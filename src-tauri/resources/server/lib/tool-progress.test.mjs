import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { projectToolProgressEvent, redactToolProgressValue } from "./tool-progress.mjs";
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
