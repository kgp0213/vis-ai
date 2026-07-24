import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { atomicWriteFile } from "./atomic-file.mjs";
import { createAttachmentRuntime } from "./attachment-runtime.mjs";
import { createMediaRuntime } from "./media-runtime.mjs";

const PNG = Buffer.from("89504e470d0a1a0a0000000d494844520000000200000003", "hex");

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "visionox-media-"));
  const attachments = createAttachmentRuntime({ rootDir: join(root, "attachments"), atomicWriteFile });
  const runtime = createMediaRuntime({ attachmentRuntime: attachments, workspaceRoot: root });
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, attachments, runtime };
}

test("read_media validates actual image bytes and stores an attachment", async (t) => {
  const { root, runtime, attachments } = await fixture(t);
  const imagePath = join(root, "screen.txt");
  await writeFile(imagePath, PNG);
  const result = await runtime.readMedia({ path: imagePath }, { operationId: "op-1", sessionId: "session-1" });

  assert.equal(result.ok, true);
  assert.equal(result.attachment.mimeType, "image/png");
  assert.equal(result.media.width, 2);
  assert.equal(result.media.height, 3);
  assert.match(result.dataUrl, /^data:image\/png;base64,/);
  assert.equal((await attachments.list()).length, 1);
});

test("read_media rejects paths outside the workspace and unsupported bytes", async (t) => {
  const { root, runtime } = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), "visionox-media-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const outsidePath = join(outside, "outside.png");
  await writeFile(outsidePath, PNG);
  const outsideResult = await runtime.readMedia({ path: outsidePath });
  assert.equal(outsideResult.error.code, "media_not_found");

  const textPath = join(root, "not-image.bin");
  await writeFile(textPath, Buffer.from("plain text"));
  const invalidResult = await runtime.readMedia({ path: textPath });
  assert.equal(invalidResult.error.code, "media_format_unsupported");
});

test("read_media reports a region outside image bounds without creating an attachment", async (t) => {
  const { root, runtime, attachments } = await fixture(t);
  const imagePath = join(root, "screen.png");
  await writeFile(imagePath, PNG);
  const result = await runtime.readMedia({ path: imagePath, region: { x: 1, y: 2, width: 2, height: 2 } });
  assert.equal(result.error.code, "media_region_invalid");
  assert.equal((await attachments.list()).length, 0);
});

test("read_media never pretends to crop when an image decoder is unavailable", async (t) => {
  const { root, runtime } = await fixture(t);
  const imagePath = join(root, "screen.png");
  await writeFile(imagePath, PNG);
  const result = await runtime.readMedia({ path: imagePath, region: { x: 0, y: 0, width: 1, height: 1 } });
  assert.equal(result.error.code, "media_decode_failed");
  assert.match(result.error.message, /派生解码器/);
});

test("animated GIF follows the injected static-image derivation path", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "visionox-media-gif-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const attachments = createAttachmentRuntime({ rootDir: join(root, "attachments"), atomicWriteFile });
  const gif = Buffer.from("47494638396102000300", "hex");
  const runtime = createMediaRuntime({
    attachmentRuntime: attachments,
    workspaceRoot: root,
    decodeImage: async () => ({
      width: 2,
      height: 3,
      derive: async () => ({ bytes: PNG, mimeType: "image/png", width: 2, height: 3 }),
    }),
  });
  const imagePath = join(root, "animation.gif");
  await writeFile(imagePath, gif);
  const result = await runtime.readMedia({ path: imagePath, full_resolution: true });
  assert.equal(result.ok, true);
  assert.equal(result.media.originalMimeType, "image/gif");
  assert.equal(result.media.mimeType, "image/png");
  assert.equal(result.media.qualityLoss, true);
});

test("read_media keeps a bounded original when no decoder is available", async (t) => {
  const { root, runtime } = await fixture(t);
  const imagePath = join(root, "screen.png");
  await writeFile(imagePath, PNG);
  const result = await runtime.readMedia({ path: imagePath, full_resolution: true });
  assert.equal(result.ok, true);
  assert.equal(result.media.fullResolution, true);
  assert.equal(result.media.qualityLoss, false);
});

test("MCP image data follows the same byte validation and attachment path", async (t) => {
  const { runtime } = await fixture(t);
  const result = await runtime.readImageData({
    data: PNG.toString("base64"),
    mimeType: "image/jpeg",
    name: "mcp-capture.jpg",
  }, { operationId: "op-mcp", sessionId: "session-mcp" });
  assert.equal(result.ok, true);
  assert.equal(result.attachment.mimeType, "image/png");
  assert.equal(result.media.originalMimeType, "image/png");

  const invalid = await runtime.readImageData({ data: "not base64" });
  assert.equal(invalid.error.code, "media_decode_failed");
});

test("chat image preparation stores the original but sends a bounded derived view", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "visionox-media-input-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const attachments = createAttachmentRuntime({ rootDir: join(root, "attachments"), atomicWriteFile });
  const largeHeader = Buffer.from("89504e470d0a1a0a0000000d4948445200000bb8000007d0", "hex");
  const runtime = createMediaRuntime({
    attachmentRuntime: attachments,
    workspaceRoot: root,
    maxLongEdge: 2000,
    decodeImage: async () => ({
      width: 3000,
      height: 2000,
      derive: async () => ({ bytes: PNG, mimeType: "image/png", width: 2000, height: 1333 }),
    }),
  });
  const prepared = await runtime.prepareInputDataUrls([
    `data:image/jpeg;base64,${largeHeader.toString("base64")}`,
  ], { operationId: "op-input", sessionId: "session-input", workspace: root });

  assert.equal(prepared.errors.length, 0);
  assert.equal(prepared.attachments[0].size, largeHeader.length);
  assert.equal(prepared.attachments[0].mimeType, "image/png");
  assert.match(prepared.modelImages[0], /^data:image\/png;base64,/);
  assert.equal(prepared.media[0].originalWidth, 3000);
  assert.equal(prepared.media[0].sendWidth, 2000);
  assert.equal(prepared.media[0].qualityLoss, true);
});

test("full-resolution media cannot bypass the model send budget", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "visionox-media-budget-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const attachments = createAttachmentRuntime({ rootDir: join(root, "attachments"), atomicWriteFile });
  const runtime = createMediaRuntime({ attachmentRuntime: attachments, workspaceRoot: root, maxSendBytes: 16 });
  const imagePath = join(root, "screen.png");
  await writeFile(imagePath, PNG);
  const result = await runtime.readMedia({ path: imagePath, full_resolution: true }, { operationId: "op-budget", toolCallId: "call-budget" });
  assert.equal(result.error.code, "media_too_large");
  assert.equal(result.error.operationId, "op-budget");
  assert.equal(result.error.toolCallId, "call-budget");
  assert.equal((await attachments.list()).length, 0);
});

test("read_media reopens current-session attachments and rejects cross-session access", async (t) => {
  const { root, runtime } = await fixture(t);
  const prepared = await runtime.prepareInputDataUrls([
    `data:image/png;base64,${PNG.toString("base64")}`,
  ], { operationId: "op-prepare", sessionId: "session-a", workspace: root });
  const attachmentId = prepared.attachments[0].id;
  const restored = await runtime.readAttachment({ attachmentId }, { operationId: "op-read", sessionId: "session-a", workspace: root });
  assert.equal(restored.ok, true);
  assert.equal(restored.attachment.id, attachmentId);

  const rejected = await runtime.readAttachment({ attachmentId }, { operationId: "op-read", sessionId: "session-b", workspace: root });
  assert.equal(rejected.error.code, "media_not_found");
  assert.match(rejected.error.message, /跨会话/);
});

test("decoded image memory is checked independently of encoded file size", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "visionox-media-decoded-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const attachments = createAttachmentRuntime({ rootDir: join(root, "attachments"), atomicWriteFile });
  const fourByFour = Buffer.from("89504e470d0a1a0a0000000d494844520000000400000004", "hex");
  const runtime = createMediaRuntime({ attachmentRuntime: attachments, workspaceRoot: root, maxDecodedBytes: 32 });
  const imagePath = join(root, "decoded.png");
  await writeFile(imagePath, fourByFour);
  const result = await runtime.readMedia({ path: imagePath });
  assert.equal(result.error.code, "media_too_large");
  assert.equal(result.error.decodedBytes, 64);
});
