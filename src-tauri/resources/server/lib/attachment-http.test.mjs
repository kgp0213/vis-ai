import assert from "node:assert/strict";
import test from "node:test";

import { createAttachmentContentResponse, parseSingleByteRange } from "./attachment-http.mjs";

test("single byte ranges support bounded, open-ended and suffix requests", () => {
  assert.deepEqual(parseSingleByteRange(null, 10), { start: 0, end: 9, partial: false });
  assert.deepEqual(parseSingleByteRange("bytes=2-5", 10), { start: 2, end: 5, partial: true });
  assert.deepEqual(parseSingleByteRange("bytes=7-", 10), { start: 7, end: 9, partial: true });
  assert.deepEqual(parseSingleByteRange("bytes=-3", 10), { start: 7, end: 9, partial: true });
  assert.equal(parseSingleByteRange("bytes=0-1,4-5", 10), null);
  assert.equal(parseSingleByteRange("bytes=20-30", 10), null);
});

test("attachment content responses expose ETag, HEAD and deterministic 206/416 semantics", async () => {
  const reads = [];
  const runtime = {
    getContentDescriptor: async () => ({ id: "att_test", size: 10, mimeType: "video/mp4", etag: '"hash"' }),
    readRange: async (_id, start, end, _context, signal) => {
      reads.push({ start, end, signal });
      return Buffer.from("0123456789").subarray(start, end + 1);
    },
  };
  const partial = await createAttachmentContentResponse(runtime, {
    id: "att_test",
    method: "GET",
    range: "bytes=2-5",
    context: { sessionId: "session-1" },
  });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers["content-range"], "bytes 2-5/10");
  assert.equal(partial.headers["content-length"], "4");
  assert.equal(partial.body.toString(), "2345");

  const head = await createAttachmentContentResponse(runtime, { id: "att_test", method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.body, null);
  assert.equal(reads.length, 1);

  const notModified = await createAttachmentContentResponse(runtime, { id: "att_test", method: "GET", ifNoneMatch: '"hash"' });
  assert.equal(notModified.status, 304);
  assert.equal(notModified.body, null);

  const invalid = await createAttachmentContentResponse(runtime, { id: "att_test", method: "GET", range: "bytes=20-30" });
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers["content-range"], "bytes */10");
});

test("missing attachment content returns media_blob_missing without reading bytes", async () => {
  const response = await createAttachmentContentResponse({
    getContentDescriptor: async () => null,
    readRange: async () => assert.fail("missing content must not be read"),
  }, { id: "att_missing", method: "GET" });
  assert.equal(response.status, 404);
  assert.equal(JSON.parse(response.body).code, "media_blob_missing");
});
