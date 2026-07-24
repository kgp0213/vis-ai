import assert from "node:assert/strict";
import test from "node:test";

import { adaptMcpMediaResult } from "./mcp-media-adapter.mjs";

test("MCP images become attachments and only queue for image-capable models", async () => {
  const stored = { id: "att-image", kind: "image", mimeType: "image/png", size: 12 };
  const mediaRuntime = {
    readImageData: async () => ({ ok: true, attachment: stored, dataUrl: "data:image/png;base64,AAAA" }),
  };
  const attachmentRuntime = { ingestBytes: async () => { throw new Error("unexpected"); } };
  const result = await adaptMcpMediaResult({
    content: [{ type: "text", text: "capture" }, { type: "image", mimeType: "image/png", data: "AAAA" }],
  }, { attachmentRuntime, mediaRuntime, supportsImages: true, toolName: "screenshot", toolCallId: "call-1" });

  assert.equal(result.attachments.length, 1);
  assert.deepEqual(result.modelImages, ["data:image/png;base64,AAAA"]);
  assert.match(result.text, /\[attachment:att-image\]/);

  const textModel = await adaptMcpMediaResult({
    content: [{ type: "image", mimeType: "image/png", data: "AAAA" }],
  }, { attachmentRuntime, mediaRuntime, supportsImages: false });
  assert.equal(textModel.modelImages.length, 0);
  assert.match(textModel.text, /当前模型不支持图片输入/);
});

test("MCP audio and video are stored but never declared as model input", async () => {
  let nextId = 0;
  const attachmentRuntime = {
    ingestBytes: async (bytes, metadata) => ({
      id: `att-${++nextId}`,
      kind: metadata.kind,
      mimeType: metadata.mimeType,
      size: bytes.length,
    }),
  };
  const result = await adaptMcpMediaResult({
    content: [
      { type: "audio", mimeType: "audio/wav", data: Buffer.from("audio").toString("base64") },
      { type: "video", mimeType: "video/mp4", data: Buffer.from("video").toString("base64") },
    ],
  }, { attachmentRuntime, mediaRuntime: {}, supportsImages: true });

  assert.deepEqual(result.attachments.map((attachment) => attachment.kind), ["audio", "video"]);
  assert.equal(result.modelImages.length, 0);
  assert.match(result.text, /当前版本不会把它发送给模型/);
});
