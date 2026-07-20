import test from "node:test";
import assert from "node:assert/strict";

import {
  getModelVerificationState,
  modelConfigFingerprint,
  modelSupportsRole,
  selectUsableDocumentModel,
} from "./document-model-routing.mjs";

const provider = {
  id: "local-qwen",
  apiKey: "secret-value",
  baseUrl: "http://127.0.0.1:8000/v1",
  requestPolicy: "json",
};

const model = {
  id: "qwen3.5-397b-a17b",
  name: "Qwen3.5",
  multimodal: true,
  capabilities: {
    protocol: "openai-chat-completions",
    inputModalities: ["text", "image"],
    roles: ["document-draft", "vision-review"],
  },
};

test("model configuration fingerprint changes when request or capability inputs change and never exposes the key", () => {
  const first = modelConfigFingerprint(provider, model, { temperature: 0.1 });
  const changedRequest = modelConfigFingerprint(provider, model, { temperature: 0.2 });
  const changedCapability = modelConfigFingerprint(provider, { ...model, capabilities: { ...model.capabilities, maxOutputTokens: 16_384 } }, { temperature: 0.1 });

  assert.notEqual(first, changedRequest);
  assert.notEqual(first, changedCapability);
  assert.equal(first.includes(provider.apiKey), false);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("fresh failed verification blocks automatic routing until the configuration is rechecked", () => {
  const now = Date.parse("2026-07-18T10:00:00.000Z");
  const fingerprint = modelConfigFingerprint(provider, model, {});
  const state = getModelVerificationState(provider, {
    ...model,
    verification: { ok: false, checkedAt: "2026-07-18T09:55:00.000Z", fingerprint, error: "timeout" },
  }, { now, ttlMs: 15 * 60_000 });

  assert.equal(state.status, "failed");
  assert.equal(state.automaticEligible, false);
  assert.equal(state.reason, "recent-verification-failure");
});

test("stale or mismatched verification becomes probe-required instead of blocking a recovered model", () => {
  const now = Date.parse("2026-07-18T10:00:00.000Z");
  const stale = getModelVerificationState(provider, {
    ...model,
    verification: {
      ok: false,
      checkedAt: "2026-07-18T09:00:00.000Z",
      fingerprint: modelConfigFingerprint(provider, model, {}),
    },
  }, { now, ttlMs: 15 * 60_000 });
  const changed = getModelVerificationState(provider, {
    ...model,
    verification: {
      ok: true,
      checkedAt: "2026-07-18T09:59:00.000Z",
      fingerprint: "0".repeat(64),
    },
  }, { now, ttlMs: 15 * 60_000 });

  assert.equal(stale.status, "stale");
  assert.equal(stale.automaticEligible, true);
  assert.equal(changed.status, "untested");
  assert.equal(changed.requiresProbe, true);
});

test("document roles come from explicit capabilities, not model names", () => {
  assert.equal(modelSupportsRole(model, "document-draft"), true);
  assert.equal(modelSupportsRole(model, "vision-review"), true);
  assert.equal(modelSupportsRole({ ...model, name: "Vision Pro", capabilities: undefined, multimodal: false }, "vision-review"), false);
});

test("vision work never falls back to a text-only model", async () => {
  let probes = 0;
  const result = await selectUsableDocumentModel([
    { providerId: "text-provider", modelId: "text-model", multimodal: false, verificationStatus: "passed" },
  ], {
    requiredCapabilities: ["vision"],
    probe: async () => { probes += 1; return { ok: true }; },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "capability-unavailable");
  assert.equal(probes, 0);
});

test("untested document candidates are probed and a healthy fallback is selected", async () => {
  const probed = [];
  const candidates = [
    { providerId: "first", modelId: "untested", multimodal: true, verificationStatus: "untested", requiresProbe: true },
    { providerId: "blocked", modelId: "failed", multimodal: true, verificationStatus: "failed" },
    { providerId: "fallback", modelId: "healthy", multimodal: true, verificationStatus: "stale", requiresProbe: true },
  ];
  const result = await selectUsableDocumentModel(candidates, {
    requiredCapabilities: ["vision"],
    probe: async (candidate) => {
      probed.push(candidate.modelId);
      return candidate.modelId === "healthy" ? { ok: true, source: "live-probe" } : { ok: false, error: "offline" };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.candidate.modelId, "healthy");
  assert.deepEqual(probed, ["untested", "healthy"]);
  assert.equal(result.verification.source, "live-probe");
});

test("a recent successful verification does not add another startup probe", async () => {
  let probes = 0;
  const candidate = { providerId: "provider", modelId: "verified", multimodal: false, verificationStatus: "passed", requiresProbe: false };
  const result = await selectUsableDocumentModel([candidate], {
    requiredCapabilities: ["text"],
    probe: async () => { probes += 1; return { ok: false }; },
  });

  assert.equal(result.ok, true);
  assert.equal(result.candidate, candidate);
  assert.equal(result.verification.source, "persisted-verification");
  assert.equal(probes, 0);
});
