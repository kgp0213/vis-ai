import assert from "node:assert/strict";
import test from "node:test";

import { createMediaProviderAdapter } from "./media-provider-adapter.mjs";

test("OpenAI Chat Completions resolves only verified image attachments", async () => {
  const adapter = createMediaProviderAdapter({
    attachmentRuntime: { readDataUrl: async (id) => id === "att-image" ? "data:image/png;base64,AAAA" : null },
  });
  const result = await adapter.resolveMedia([
    { type: "text", text: "inspect" },
    { attachment: { id: "att-image", kind: "image" } },
  ], { id: "vision", capabilities: { protocol: "openai-chat-completions", inputModalities: ["text", "image"] } });

  assert.equal(result.parts.length, 2);
  assert.equal(result.parts[1].type, "image_url");
  assert.equal(result.warnings.length, 0);
});

test("video upload caches success but not temporary failure", async () => {
  let attempts = 0;
  const adapter = createMediaProviderAdapter({
    attachmentRuntime: { readDataUrl: async () => null },
    videoUploaders: {
      kimi: async () => {
        attempts++;
        if (attempts === 1) throw new Error("HTTP 503 temporary failure");
        return { type: "video_url", video_url: { url: "ms://video-1" } };
      },
    },
  });
  const model = { id: "video-model", capabilities: { inputModalities: ["text", "video"] } };
  const input = { attachment: { id: "att-video", sha256: "a".repeat(64), kind: "video" }, provider: { id: "official", providerType: "kimi" } };

  const failed = await adapter.uploadVideo(input, model, { id: "op-1", provider: input.provider });
  assert.equal(failed.error.code, "media_upload_failed");
  const succeeded = await adapter.uploadVideo(input, model, { id: "op-2", provider: input.provider });
  assert.equal(succeeded.ok, true);
  const cached = await adapter.uploadVideo(input, model, { id: "op-3", provider: input.provider });
  assert.equal(cached.cached, true);
  assert.equal(attempts, 2);
});

test("video authentication errors are exposed and unsupported providers are explicit", async () => {
  const auth = createMediaProviderAdapter({
    attachmentRuntime: { readDataUrl: async () => null },
    videoUploaders: { kimi: async () => { throw new Error("API 401: invalid key"); } },
  });
  const model = { id: "video-model", capabilities: { inputModalities: ["text", "video"] } };
  const input = { attachment: { id: "att-video", kind: "video" }, provider: { id: "official", providerType: "kimi" } };
  assert.equal((await auth.uploadVideo(input, model, { provider: input.provider })).error.code, "media_provider_auth_failed");

  const unsupported = createMediaProviderAdapter({ attachmentRuntime: { readDataUrl: async () => null } });
  assert.equal((await unsupported.uploadVideo(input, model, { provider: input.provider })).error.code, "media_provider_unsupported");
});

test("video upload cancellation stops before provider dispatch and is never cached", async () => {
  let attempts = 0;
  const adapter = createMediaProviderAdapter({
    attachmentRuntime: { readDataUrl: async () => null },
    videoUploaders: { kimi: async () => { attempts++; return { type: "video_url", video_url: { url: "ms://unexpected" } }; } },
  });
  const controller = new AbortController();
  controller.abort();
  const result = await adapter.uploadVideo(
    { attachment: { id: "att-video", sha256: "b".repeat(64), kind: "video" }, provider: { id: "official", providerType: "kimi" } },
    { id: "video-model", capabilities: { inputModalities: ["text", "video"] } },
    { id: "op-cancelled", provider: { id: "provider" } },
    controller.signal,
  );
  assert.equal(result.error.code, "media_upload_failed");
  assert.equal(result.error.affectsCompleteness, false);
  assert.equal(attempts, 0);
});

test("provider type, not a Kimi-looking id or model name, gates official video upload", async () => {
  let attempts = 0;
  const adapter = createMediaProviderAdapter({
    attachmentRuntime: { readDataUrl: async () => null },
    videoUploaders: {
      kimi: async () => {
        attempts++;
        return { type: "video_url", video_url: { url: "ms://file-1" } };
      },
    },
  });
  const model = { id: "kimi-k2-video", capabilities: { inputModalities: ["text", "video"] } };
  const attachment = { id: "att-video", sha256: "c".repeat(64), kind: "video" };

  const volc = await adapter.uploadVideo(
    { attachment, provider: { id: "kimi-volcengine", providerType: "openai-compatible" } },
    model,
  );
  assert.equal(volc.error.code, "media_provider_unsupported");
  assert.equal(attempts, 0);

  const official = await adapter.resolveMedia(
    [{ attachment }],
    model,
    { id: "op-video", provider: { id: "moonshot", providerType: "kimi" } },
  );
  assert.deepEqual(official.parts, [{ type: "video_url", video_url: { url: "ms://file-1" } }]);
  assert.equal(attempts, 1);
});

test("video cache is isolated when an existing provider id changes endpoint or credentials", async () => {
  let attempts = 0;
  const adapter = createMediaProviderAdapter({
    attachmentRuntime: { readDataUrl: async () => null },
    videoUploaders: {
      kimi: async ({ provider }) => ({
        type: "video_url",
        video_url: { url: `ms://upload-${++attempts}-${new URL(provider.baseUrl).host}` },
      }),
    },
  });
  const attachment = { id: "att-video", sha256: "d".repeat(64), kind: "video" };
  const model = { id: "video-model", capabilities: { inputModalities: ["text", "video"] } };
  const firstProvider = { id: "official", providerType: "kimi", baseUrl: "https://one.example/v1", apiKey: "key-one" };
  const secondProvider = { id: "official", providerType: "kimi", baseUrl: "https://two.example/v1", apiKey: "key-two" };

  const first = await adapter.uploadVideo({ attachment, provider: firstProvider }, model, { provider: firstProvider });
  const second = await adapter.uploadVideo({ attachment, provider: secondProvider }, model, { provider: secondProvider });
  assert.equal(first.cached, false);
  assert.equal(second.cached, false);
  assert.equal(attempts, 2);
});
