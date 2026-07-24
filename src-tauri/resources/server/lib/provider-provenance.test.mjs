import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  createProviderProvenanceStore,
  normalizeProviderType,
  providerDiagnostics,
} from "./provider-provenance.mjs";

function provider(overrides = {}) {
  return {
    id: "provider-1",
    name: "Provider",
    baseUrl: "https://user:password@example.test/v1?token=secret#private",
    apiKey: "api-key-secret",
    models: [{ id: "model-1", capabilities: { protocol: "openai-chat-completions", inputModalities: ["text", "image"] } }],
    ...overrides,
  };
}

test("provider type remains compatible by default and rejects unknown adapters", () => {
  assert.equal(normalizeProviderType(undefined), "openai-compatible");
  assert.equal(normalizeProviderType("openai-compatible"), "openai-compatible");
  assert.equal(normalizeProviderType("kimi"), "kimi");
  assert.throws(() => normalizeProviderType("guessed-from-name"), /providerType/);
});

test("provider provenance records source without persisting credentials", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-provider-provenance-"));
  const path = join(root, "provider-provenance.json");
  try {
    const config = { providers: [provider()] };
    const store = createProviderProvenanceStore({
      path,
      now: () => "2026-07-25T01:00:00.000Z",
    });
    store.record(config, ["provider-1"], "json-import");

    const persisted = await readFile(path, "utf8");
    assert.doesNotMatch(persisted, /api-key-secret|password|token=secret/);
    assert.equal(store.sourceFor(config.providers[0]).source, "json-import");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("manual provider edits are detected without overwriting the sidecar fact", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-provider-provenance-"));
  const path = join(root, "provider-provenance.json");
  try {
    const config = { providers: [provider({ baseUrl: "https://before.example/v1" })] };
    const store = createProviderProvenanceStore({ path });
    store.record(config, ["provider-1"], "dashboard");
    config.providers[0].baseUrl = "https://after.example/v1";

    assert.equal(store.sourceFor(config.providers[0]).source, "manual-unknown");
    assert.equal(store.sourceFor(config.providers[0]).previousSource, "dashboard");
    assert.equal(store.sourceFor(config.providers[0]).changedOutsideManagedFlow, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("provider diagnostics redact secrets and explain environment overrides", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-provider-provenance-"));
  try {
    const config = { activeProviderId: "provider-1", model: "model-1", providers: [provider()] };
    const store = createProviderProvenanceStore({ path: join(root, "provider-provenance.json") });
    store.record(config, ["provider-1"], "legacy-migration");
    const result = providerDiagnostics(config, {
      provenance: store,
      env: { DEEPSEEK_API_KEY: "environment-secret", DEEPSEEK_BASE_URL: "https://env-user:env-pass@env.example/v1?key=hidden" },
    });

    assert.equal(result.activeProviderId, "provider-1");
    assert.equal(result.providers[0].providerType, "openai-compatible");
    assert.equal(result.providers[0].apiKeyPresent, true);
    assert.equal(result.providers[0].configuredApiKeyPresent, true);
    assert.equal(result.providers[0].effectiveBaseUrl, "https://env.example/v1");
    assert.equal(result.providers[0].source, "legacy-migration");
    assert.deepEqual(result.providers[0].overrides, { apiKey: "environment", baseUrl: "environment" });
    assert.doesNotMatch(JSON.stringify(result), /environment-secret|api-key-secret|env-pass|hidden/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("corrupt provenance sidecars remain untouched", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-provider-provenance-"));
  const path = join(root, "provider-provenance.json");
  try {
    await writeFile(path, "{broken", "utf8");
    const store = createProviderProvenanceStore({ path });
    assert.throws(() => store.record({ providers: [provider()] }, ["provider-1"], "dashboard"), /not valid JSON|protected/i);
    assert.equal(await readFile(path, "utf8"), "{broken");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
