import test from "node:test";
import assert from "node:assert/strict";

import {
  createContextSizeCalibration,
  contextRequestShapeFingerprint,
  extractMeasuredPromptTokens,
  historyFingerprint,
} from "./context-size-calibration.mjs";

const scope = { operationId: "op-1", sessionId: "session-1", model: "kimi" };

test("accepts provider prompt usage for the matching request and history", () => {
  const calibration = createContextSizeCalibration({ now: () => "2026-07-26T00:00:00.000Z" });
  const history = [{ role: "user", content: "hello" }];
  const started = calibration.begin({ ...scope, requestId: "req-1", history });
  const result = calibration.record({
    ...scope,
    requestId: started.requestId,
    historyFingerprint: started.historyFingerprint,
    usage: { prompt_tokens: 42, completion_tokens: 3 },
  });
  assert.equal(result.accepted, true);
  assert.equal(result.promptTokens, 42);
  assert.equal(calibration.get({ ...scope, history }).measuredPromptTokens, 42);
});

test("rejects stale request or history measurements", () => {
  const calibration = createContextSizeCalibration();
  const history = [{ role: "user", content: "first" }];
  const started = calibration.begin({ ...scope, requestId: "req-1", history });
  assert.deepEqual(
    calibration.record({ ...scope, requestId: "req-old", historyFingerprint: started.historyFingerprint, usage: { input_tokens: 10 } }),
    { accepted: false, reason: "request_mismatch" },
  );
  assert.deepEqual(
    calibration.record({ ...scope, requestId: "req-1", historyFingerprint: historyFingerprint([{ role: "user", content: "changed" }]), usage: { input_tokens: 10 } }),
    { accepted: false, reason: "history_mismatch" },
  );
  assert.equal(calibration.get({ ...scope, history: [...history, { role: "assistant", content: "reply" }] }), null);
});

test("allows append-only history while rejecting edits to the measured prefix", () => {
  const calibration = createContextSizeCalibration();
  const history = [{ role: "user", content: "first" }, { role: "assistant", content: "reply" }];
  const started = calibration.begin({ ...scope, requestId: "req-1", history });
  calibration.record({ ...scope, requestId: "req-1", historyFingerprint: started.historyFingerprint, usage: { inputTokens: 21 } });
  const appended = calibration.get({ ...scope, history: [...history, { role: "user", content: "next" }] });
  assert.equal(appended.measuredPromptTokens, 21);
  assert.equal(appended.measuredMessageCount, 2);
  assert.equal(calibration.get({ ...scope, history: [{ role: "user", content: "edited" }, ...history.slice(1)] }), null);
});

test("invalidation clears measured state and usage without prompt tokens is ignored", () => {
  const calibration = createContextSizeCalibration();
  const history = [{ role: "user", content: "hello" }];
  const started = calibration.begin({ ...scope, requestId: "req-1", history });
  assert.deepEqual(calibration.record({ ...scope, requestId: "req-1", historyFingerprint: started.historyFingerprint, usage: { completion_tokens: 4 } }), { accepted: false, reason: "usage_missing" });
  calibration.record({ ...scope, requestId: "req-1", historyFingerprint: started.historyFingerprint, usage: { total_tokens: 10, output_tokens: 2 } });
  assert.equal(calibration.invalidate(scope, "compaction"), true);
  assert.equal(calibration.get({ ...scope, history }), null);
});

test("does not accept provider usage when the request identity is missing", () => {
  const calibration = createContextSizeCalibration();
  const history = [{ role: "system", content: "rules" }, { role: "user", content: "pending" }];
  const started = calibration.begin({ ...scope, requestId: "req-identity", history });
  assert.deepEqual(
    calibration.record({ ...scope, historyFingerprint: started.historyFingerprint, usage: { prompt_tokens: 99 } }),
    { accepted: false, reason: "request_mismatch" },
  );
  assert.equal(calibration.get({ ...scope, history }), null);
});

test("invalidates a measured prefix when provider tool schemas change", () => {
  const calibration = createContextSizeCalibration();
  const history = [{ role: "system", content: "rules" }, { role: "user", content: "pending" }];
  const shape = contextRequestShapeFingerprint({ toolSpecs: [{ function: { name: "read_file" } }] });
  const started = calibration.begin({ ...scope, requestId: "req-shape", history, requestShapeFingerprint: shape });
  calibration.record({ ...scope, requestId: "req-shape", historyFingerprint: started.historyFingerprint, requestShapeFingerprint: shape, usage: { prompt_tokens: 42 } });
  const changedShape = contextRequestShapeFingerprint({ toolSpecs: [{ function: { name: "write_file" } }] });
  assert.equal(calibration.get({ ...scope, history, requestShapeFingerprint: changedShape }), null);
});

test("rejects a measurement when tool schemas change before the response", () => {
  const calibration = createContextSizeCalibration();
  const history = [{ role: "system", content: "rules" }, { role: "user", content: "pending" }];
  const original = contextRequestShapeFingerprint({ toolSpecs: [{ function: { name: "read_file" } }] });
  const changed = contextRequestShapeFingerprint({ toolSpecs: [{ function: { name: "read_file" } }, { function: { name: "write_file" } }] });
  const started = calibration.begin({ ...scope, requestId: "req-shape-change", history, requestShapeFingerprint: original });
  assert.deepEqual(
    calibration.record({ ...scope, requestId: "req-shape-change", historyFingerprint: started.historyFingerprint, requestShapeFingerprint: changed, usage: { prompt_tokens: 42 } }),
    { accepted: false, reason: "request_shape_mismatch" },
  );
});

test("extracts common provider usage shapes", () => {
  assert.equal(extractMeasuredPromptTokens({ prompt_tokens: 12 }), 12);
  assert.equal(extractMeasuredPromptTokens({ inputTokens: 13 }), 13);
  assert.equal(extractMeasuredPromptTokens({ total_tokens: 20, completion_tokens: 5 }), 15);
  assert.equal(extractMeasuredPromptTokens({ output_tokens: 5 }), null);
});
