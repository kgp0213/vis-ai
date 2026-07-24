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
        return { fileId: "video-1" };
      },
    },
  });
  const model = { id: "video-model", capabilities: { inputModalities: ["text", "video"] } };
  const input = { attachment: { id: "att-video", sha256: "a".repeat(64), kind: "video" }, provider: { id: "kimi" } };

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
    videoUploaders: { provider: async () => { throw new Error("API 401: invalid key"); } },
  });
  const model = { id: "video-model", capabilities: { inputModalities: ["text", "video"] } };
  const input = { attachment: { id: "att-video", kind: "video" }, provider: { id: "provider" } };
  assert.equal((await auth.uploadVideo(input, model, { provider: input.provider })).error.code, "media_provider_auth_failed");

  const unsupported = createMediaProviderAdapter({ attachmentRuntime: { readDataUrl: async () => null } });
  assert.equal((await unsupported.uploadVideo(input, model, { provider: input.provider })).error.code, "media_provider_unsupported");
});

test("video upload cancellation stops before provider dispatch and is never cached", async () => {
  let attempts = 0;
  const adapter = createMediaProviderAdapter({
    attachmentRuntime: { readDataUrl: async () => null },
    videoUploaders: { provider: async () => { attempts++; return { fileId: "unexpected" }; } },
  });
  const controller = new AbortController();
  controller.abort();
  const result = await adapter.uploadVideo(
    { attachment: { id: "att-video", sha256: "b".repeat(64), kind: "video" }, provider: { id: "provider" } },
    { id: "video-model", capabilities: { inputModalities: ["text", "video"] } },
    { id: "op-cancelled", provider: { id: "provider" } },
    controller.signal,
  );
  assert.equal(result.error.code, "media_upload_failed");
  assert.equal(result.error.affectsCompleteness, false);
  assert.equal(attempts, 0);
});
