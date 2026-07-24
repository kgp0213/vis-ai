import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { atomicWriteFile } from "./atomic-file.mjs";
import { createAttachmentRuntime } from "./attachment-runtime.mjs";
import { prepareSubmittedMedia } from "./submitted-media.mjs";

const MP4 = Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex");

test("submitted official Kimi video is rebound to the operation and becomes a provider-ready part", async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), "visionox-submitted-media-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const attachmentRuntime = createAttachmentRuntime({ rootDir: root, atomicWriteFile });
  const uploaded = await attachmentRuntime.ingestBytes(MP4, {
    kind: "video",
    mimeType: "video/mp4",
    name: "clip.mp4",
    sessionId: "session-1",
    operationId: "upload:upload-1",
    workspace: "C:\\workspace",
  });
  let resolvedAttachment = null;
  const result = await prepareSubmittedMedia({
    attachmentRuntime,
    mediaRuntime: {},
    mediaProviderAdapter: {
      resolveMedia: async (parts) => {
        resolvedAttachment = parts[0].attachment;
        return { parts: [{ type: "video_url", video_url: { url: "ms://file-1" } }], warnings: [] };
      },
    },
    attachmentIds: [uploaded.id],
    provider: { id: "moonshot", providerType: "kimi" },
    model: { id: "kimi-video", capabilities: { inputModalities: ["text", "video"] } },
    capabilities: { inputModalities: ["text", "video"], maxMediaBytes: 50 * 1024 * 1024 },
    context: { sessionId: "session-1", operationId: "operation-1", workspace: "C:\\workspace" },
  });

  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.mediaParts, [{ type: "video_url", video_url: { url: "ms://file-1" } }]);
  assert.equal(resolvedAttachment.operationId, "operation-1");
  assert.equal(result.attachments[0].kind, "video");
  assert.deepEqual(result.pendingUploads, [{ id: uploaded.id, sessionId: "session-1", workspace: "C:\\workspace" }]);
  assert.deepEqual(result.rollbackAttachmentIds, [result.attachments[0].id]);
  assert.ok(await attachmentRuntime.get(uploaded.id), "prepare must preserve the retryable upload until the prompt commits");
  await attachmentRuntime.releasePendingUploads(result.pendingUploads);
  assert.equal(await attachmentRuntime.get(uploaded.id), null);
});

test("submitted media rejects a cross-session attachment before reading or uploading it", async () => {
  let reads = 0;
  const result = await prepareSubmittedMedia({
    attachmentRuntime: {
      get: async () => ({ id: "att-other", kind: "video", sessionId: "session-other", workspace: "C:\\workspace" }),
      readBytes: async () => { reads++; return MP4; },
    },
    mediaRuntime: {},
    mediaProviderAdapter: { resolveMedia: async () => { throw new Error("must not upload"); } },
    attachmentIds: ["att-other"],
    provider: { providerType: "kimi" },
    model: { id: "video", capabilities: { inputModalities: ["text", "video"] } },
    capabilities: { inputModalities: ["text", "video"] },
    context: { sessionId: "session-current", operationId: "operation-current", workspace: "C:\\workspace" },
  });

  assert.equal(reads, 0);
  assert.equal(result.errors[0].code, "media_not_found");
});

test("submitted images beyond the model limit are rejected before entering model input", async () => {
  const records = new Map([
    ["att-1", { id: "att-1", kind: "image", sessionId: "session-1", workspace: "C:\\workspace" }],
    ["att-2", { id: "att-2", kind: "image", sessionId: "session-1", workspace: "C:\\workspace" }],
  ]);
  let reads = 0;
  const result = await prepareSubmittedMedia({
    attachmentRuntime: {
      get: async (id) => records.get(id),
      releaseAttachments: async () => 0,
    },
    mediaRuntime: {
      readAttachment: async ({ attachmentId }) => {
        reads++;
        return { ok: true, attachment: records.get(attachmentId), dataUrl: `data:image/png;base64,${attachmentId}` };
      },
    },
    mediaProviderAdapter: {},
    attachmentIds: ["att-1", "att-2"],
    capabilities: { inputModalities: ["text", "image"], maxImagesPerRequest: 1 },
    context: { sessionId: "session-1", operationId: "operation-1", workspace: "C:\\workspace" },
  });

  assert.equal(reads, 1);
  assert.equal(result.modelImages.length, 0);
  assert.equal(result.attachments.length, 0);
  assert.equal(result.errors.at(-1).code, "media_too_large");
});

test("cancelled video preparation preserves the original attachment for an explicit retry", async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), "visionox-submitted-cancel-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const attachmentRuntime = createAttachmentRuntime({ rootDir: root, atomicWriteFile });
  const uploaded = await attachmentRuntime.ingestBytes(MP4, {
    kind: "video",
    mimeType: "video/mp4",
    sessionId: "session-1",
    operationId: "upload-1",
    workspace: "C:\\workspace",
  });
  const result = await prepareSubmittedMedia({
    attachmentRuntime,
    mediaRuntime: {},
    mediaProviderAdapter: {
      resolveMedia: async () => ({
        parts: [],
        warnings: [{ code: "media_read_cancelled", message: "upload cancelled", affectsCompleteness: false }],
      }),
    },
    attachmentIds: [uploaded.id],
    provider: { providerType: "kimi" },
    model: { id: "video", capabilities: { inputModalities: ["text", "video"] } },
    capabilities: { inputModalities: ["text", "video"], maxMediaBytes: 50 * 1024 * 1024 },
    context: { sessionId: "session-1", operationId: "operation-1", workspace: "C:\\workspace" },
  });

  assert.equal(result.errors[0].code, "media_read_cancelled");
  assert.equal(result.mediaParts.length, 0);
  assert.ok(await attachmentRuntime.get(uploaded.id));
});

test("mixed media preparation rolls back image rebinds when video authentication fails", async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), "visionox-submitted-transaction-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const attachmentRuntime = createAttachmentRuntime({ rootDir: root, atomicWriteFile });
  const imageBytes = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  const image = await attachmentRuntime.ingestBytes(imageBytes, {
    kind: "image", mimeType: "image/png", sessionId: "session-1", operationId: "upload-image", workspace: "C:\\workspace",
  });
  const video = await attachmentRuntime.ingestBytes(MP4, {
    kind: "video", mimeType: "video/mp4", sessionId: "session-1", operationId: "upload-video", workspace: "C:\\workspace",
  });
  const result = await prepareSubmittedMedia({
    attachmentRuntime,
    mediaRuntime: {
      readAttachment: async ({ attachmentId }, context) => {
        const stored = await attachmentRuntime.get(attachmentId);
        const rebound = await attachmentRuntime.ingestBytes(await attachmentRuntime.readBytes(attachmentId), {
          ...stored,
          operationId: context.operationId,
          sessionId: context.sessionId,
          workspace: context.workspace,
        });
        return { ok: true, attachment: rebound, dataUrl: "data:image/png;base64,AAAA" };
      },
    },
    mediaProviderAdapter: {
      resolveMedia: async () => ({
        parts: [],
        warnings: [{ code: "media_provider_auth_failed", message: "invalid key", affectsCompleteness: true }],
      }),
    },
    attachmentIds: [image.id, video.id],
    provider: { providerType: "kimi" },
    model: { id: "multimodal", capabilities: { inputModalities: ["text", "image", "video"] } },
    capabilities: { inputModalities: ["text", "image", "video"], maxImagesPerRequest: 1, maxMediaBytes: 50 * 1024 * 1024 },
    context: { sessionId: "session-1", operationId: "operation-1", workspace: "C:\\workspace" },
  });

  assert.equal(result.attachments.length, 0);
  assert.equal(result.modelImages.length, 0);
  assert.ok(await attachmentRuntime.get(image.id));
  assert.ok(await attachmentRuntime.get(video.id));
  assert.equal((await attachmentRuntime.list()).length, 2, "failed transaction must not leave rebound attachments");
});
