import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { modelConfigFingerprint } from "../lib/model-config-fingerprint.mjs";

const lib = new URL("../lib/", import.meta.url);
const retired = [
  "document-delivery.mjs",
  "document-extractors.mjs",
  "document-intelligence.mjs",
  "document-job-store.mjs",
  "document-markdown-workflow.mjs",
  "document-model-routing.mjs",
  "document-output-reservation.mjs",
  "long-task-handoff.mjs",
  "pdf-markdown-workflow.mjs",
  "pdf-text.mjs",
];

test("retired document background sources are absent from the maintained tree", () => {
  for (const name of retired) assert.equal(existsSync(new URL(name, lib)), false, name);
});

test("canonical release build prunes every retired document backend residue", () => {
  const buildWrapper = readFileSync(new URL("../../../../scripts/run-tauri-build.js", import.meta.url), "utf8");
  for (const name of retired) assert.match(buildWrapper, new RegExp(name.replaceAll(".", "\\.")), name);
});

test("the retained model fingerprint remains capability-sensitive and credential-safe", () => {
  const provider = { id: "provider", baseUrl: "https://example.invalid/v1/", apiKey: "secret-value" };
  const model = { id: "model", capabilities: { maxOutputTokens: 8192 }, requestDefaults: { stream: true } };
  const first = modelConfigFingerprint(provider, model, { temperature: 0.1 });
  const changed = modelConfigFingerprint(provider, { ...model, capabilities: { maxOutputTokens: 16384 } }, { temperature: 0.1 });
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, changed);
  assert.equal(first.includes(provider.apiKey), false);
});

test("document skills describe foreground guidance without a resumable job capability", () => {
  const integration = readFileSync(new URL("../../bootstrap-skills/document-organizer/integration.json", import.meta.url), "utf8");
  const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(integration, /resumable-jobs/);
  assert.doesNotMatch(launcher, /document-model-routing|organize_document_to_markdown|pdf-markdown-workflow/);
  assert.match(launcher, /model-config-fingerprint/);
});
