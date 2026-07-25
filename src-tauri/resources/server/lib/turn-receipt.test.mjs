import test from "node:test";
import assert from "node:assert/strict";

import { createTurnReceipt } from "./turn-receipt.mjs";

test("turn receipt aggregates bounded execution facts and deduplicates active intervention", () => {
  const receipt = createTurnReceipt({ turnId: "turn-1", requestId: "req-1", startedAt: 0 });
  receipt.observeToolStart("read_file");
  receipt.observeTool({ name: "read_file", succeeded: true, result: "ok" });
  receipt.observeTool({ name: "write_file", succeeded: false, result: "failed" });
  receipt.recordError("embedding provider returned an invalid response", { source: "model-loop" });
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
