import assert from "node:assert/strict";
import test from "node:test";

import { createOfficialKimiVideoUploader } from "./kimi-video-uploader.mjs";

const VIDEO = Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex");

test("official Kimi uploader posts a video file with purpose=video and returns an ms reference", async () => {
  let request = null;
  const upload = createOfficialKimiVideoUploader({
    attachmentRuntime: {
      readBytes: async (id) => id === "att-video" ? VIDEO : null,
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ id: "file-123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await upload({
    attachment: { id: "att-video", name: "sample.mp4", mimeType: "video/mp4", size: VIDEO.length },
    provider: { baseUrl: "https://api.moonshot.cn/v1/chat/completions", apiKey: "secret-key" },
  });

  assert.equal(request.url, "https://api.moonshot.cn/v1/files");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer secret-key");
  assert.equal(request.options.body.get("purpose"), "video");
  assert.equal(request.options.body.get("file").name, "sample.mp4");
  assert.deepEqual(result, { type: "video_url", video_url: { url: "ms://file-123" } });
});

test("official Kimi uploader exposes authentication failures without leaking credentials", async () => {
  const upload = createOfficialKimiVideoUploader({
    attachmentRuntime: { readBytes: async () => VIDEO },
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "invalid token" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  });

  await assert.rejects(
    upload({
      attachment: { id: "att-video", name: "sample.mp4", mimeType: "video/mp4" },
      provider: { baseUrl: "https://api.moonshot.cn/v1", apiKey: "never-print-this" },
    }),
    (error) => error.statusCode === 401 && /invalid token/.test(error.message) && !/never-print-this/.test(error.message),
  );
});

test("official Kimi uploader forwards AbortSignal to fetch", async () => {
  const controller = new AbortController();
  let observedSignal = null;
  const upload = createOfficialKimiVideoUploader({
    attachmentRuntime: { readBytes: async () => VIDEO },
    fetchImpl: async (_url, options) => {
      observedSignal = options.signal;
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    },
  });

  await assert.rejects(upload({
    attachment: { id: "att-video", name: "sample.mp4", mimeType: "video/mp4" },
    provider: { baseUrl: "https://api.moonshot.cn/v1", apiKey: "key" },
    signal: controller.signal,
  }), /aborted/i);
  assert.equal(observedSignal, controller.signal);
});
