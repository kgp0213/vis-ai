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
  receipt.recordContext({ transactionId: "tx-1", pendingCount: 1, pendingChars: 120, requiresIntervention: true });

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
  assert.equal(snapshot.intervention.shown, 2);
  assert.deepEqual(snapshot.errors[0], {
    source: "model-loop",
    message: "embedding provider returned an invalid response",
    recordedAt: snapshot.errors[0].recordedAt,
  });
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
