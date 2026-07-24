import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyTaskEvidence,
  classifyEnvironmentalResult,
  isQwenNetworkUnavailable,
  publicModelInventory,
  sanitizeDiagnostic,
} from "../../../../scripts/real-task-acceptance.mjs";

test("real-task inventory never exposes provider credentials or service URLs", () => {
  const inventory = publicModelInventory({
    providers: [{
      id: "provider-1",
      name: "Provider",
      baseUrl: "https://private.example/v1",
      apiKey: "api-secret-value",
      models: [{ id: "model-1", disabled: false }],
    }],
  });

  assert.deepEqual(inventory, [{
    providerId: "provider-1",
    providerName: "Provider",
    configured: true,
    models: [{ id: "model-1", enabled: true }],
  }]);
  assert.doesNotMatch(JSON.stringify(inventory), /private\.example|api-secret-value/);
});

test("real-task evidence rejects a completion claim without the required artifact", () => {
  assert.deepEqual(classifyTaskEvidence({
    assistantText: "任务已经完成。",
    expectedArtifact: "output.md",
    artifact: null,
    receipt: { completion: { ok: true, taskState: "completed" } },
  }), {
    status: "failed",
    reason: "required-artifact-missing",
    modelClaimedComplete: true,
  });
});

test("real-task evidence rejects a text artifact without host-side coverage evidence", () => {
  assert.deepEqual(classifyTaskEvidence({
    assistantText: "任务已经完成。",
    expectedArtifact: "output.md",
    artifact: { bytes: 1200, coverage: { verified: false } },
    artifactCoverageRequired: true,
    receipt: { completion: { ok: true, taskState: "completed" } },
  }), {
    status: "failed",
    reason: "artifact-coverage-unverified",
    modelClaimedComplete: true,
  });
});

test("text coverage accepts a complete boundary marker without Markdown headings", () => {
  assert.deepEqual(classifyTaskEvidence({
    assistantText: "已生成。",
    expectedArtifact: "output.md",
    artifact: { bytes: 1200, coverage: { verified: true, tailPatternMatched: true } },
    artifactCoverageRequired: true,
  }), {
    status: "passed",
    reason: "artifact-verified",
    modelClaimedComplete: false,
  });
});

test("authorization and fixture blockers remain explicit instead of becoming failures", () => {
  assert.deepEqual(classifyTaskEvidence({ blockedReason: "dws-authorization-required" }), {
    status: "blocked",
    reason: "dws-authorization-required",
    modelClaimedComplete: false,
  });
});

test("Qwen network-only failure remains an explicit environmental block", () => {
  assert.equal(isQwenNetworkUnavailable(
    { group: "qwen" },
    { errors: [{ message: "fetch failed" }] },
  ), true);
  assert.equal(isQwenNetworkUnavailable(
    { group: "qwen" },
    { errors: [{ message: "tool schema is invalid" }] },
  ), false);
  assert.equal(isQwenNetworkUnavailable(
    { group: "kimi" },
    { errors: [{ message: "fetch failed" }] },
  ), false);
  assert.deepEqual(classifyEnvironmentalResult({ group: "qwen" }, { errors: [{ message: "fetch failed" }] }), {
    status: "blocked",
    reason: "environment-network-unavailable",
    environmentalBlock: true,
    verification: "environment-blocked",
  });
});

test("real-task diagnostics redact temporary dashboard access tokens", () => {
  const token = "0123456789abcdef0123456789abcdef0123456789abcdef";
  const sanitized = sanitizeDiagnostic(`ready http://127.0.0.1:1234/?token=${token} --token ${token}`);
  assert.doesNotMatch(sanitized, new RegExp(token));
  assert.match(sanitized, /token=\[redacted\]/);
  assert.match(sanitized, /--token \[redacted\]/);
});
