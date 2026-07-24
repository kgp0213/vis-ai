import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { atomicWriteFile } from "./atomic-file.mjs";
import { createAttachmentRuntime } from "./attachment-runtime.mjs";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const DATA_URL = `data:image/png;base64,${PNG.toString("base64")}`;
const MP4 = Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex");
const MOV = Buffer.from("0000001466747970717420200000000071742020", "hex");
const WEBM = Buffer.concat([Buffer.from("1a45dfa3", "hex"), Buffer.from("webm", "ascii")]);

async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), "visionox-attachments-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, runtime: createAttachmentRuntime({ rootDir: root, atomicWriteFile }) };
}

test("attachment runtime stores media outside the index and restores it", async (t) => {
  const { root, runtime } = await fixture(t);
  const first = await runtime.ingestDataUrls([DATA_URL], {
    sessionId: "session-1",
    operationId: "operation-1",
    workspace: "C:\\workspace",
    names: ["screen.png"],
  });

  assert.equal(first.errors.length, 0);
  assert.equal(first.attachments.length, 1);
  assert.equal(first.attachments[0].mimeType, "image/png");
  assert.equal(await runtime.readDataUrl(first.attachments[0].id), DATA_URL);

  const index = await readFile(resolve(root, "index.json"), "utf8");
  assert.doesNotMatch(index, /base64/i);
  assert.doesNotMatch(index, new RegExp(PNG.toString("base64")));

  const restored = createAttachmentRuntime({ rootDir: root, atomicWriteFile });
  assert.equal(await restored.readDataUrl(first.attachments[0].id), DATA_URL);
});

test("attachment runtime deduplicates bytes while retaining session references", async (t) => {
  const { root, runtime } = await fixture(t);
  const first = await runtime.ingestDataUrls([DATA_URL], { sessionId: "session-1", operationId: "op-1" });
  const second = await runtime.ingestDataUrls([DATA_URL], { sessionId: "session-2", operationId: "op-2" });
  assert.notEqual(second.attachments[0].id, first.attachments[0].id);
  assert.equal(second.attachments[0].sha256, first.attachments[0].sha256);

  assert.equal(await runtime.releaseSession("session-1"), 1);
  assert.equal(await runtime.get(first.attachments[0].id), null);
  assert.equal(await runtime.readDataUrl(second.attachments[0].id), DATA_URL);
  assert.equal(await runtime.releaseSession("session-2"), 1);
  assert.equal(await runtime.get(second.attachments[0].id), null);

  const blobPath = resolve(root, "blobs", first.attachments[0].sha256);
  await assert.rejects(readFile(blobPath));
});

test("attachment runtime reports a missing blob without crashing", async (t) => {
  const { root, runtime } = await fixture(t);
  const stored = await runtime.ingestDataUrls([DATA_URL], { sessionId: "session-1" });
  const attachment = stored.attachments[0];
  await unlink(resolve(root, "blobs", attachment.sha256));

  assert.equal((await runtime.get(attachment.id)).missing, true);
  assert.equal(await runtime.readDataUrl(attachment.id), null);
});

test("attachment runtime accepts validated bytes and reuses the content-addressed blob", async (t) => {
  const { runtime } = await fixture(t);
  const first = await runtime.ingestBytes(PNG, {
    kind: "image",
    mimeType: "image/png",
    name: "first.png",
    sessionId: "session-1",
    operationId: "op-1",
  });
  const second = await runtime.ingestBytes(PNG, {
    kind: "image",
    mimeType: "image/png",
    name: "second.png",
    sessionId: "session-2",
    operationId: "op-2",
  });
  assert.notEqual(first.id, second.id);
  assert.equal(first.sha256, second.sha256);
  assert.deepEqual(await runtime.readBytes(first.id), PNG);

  const repeated = await runtime.ingestBytes(PNG, {
    kind: "image",
    mimeType: "image/png",
    name: "first-again.png",
    sessionId: "session-1",
    operationId: "op-1",
  });
  assert.equal(repeated.id, first.id);
});

test("attachment runtime rejects non-image and oversized data URLs", async (t) => {
  const { root } = await fixture(t);
  const runtime = createAttachmentRuntime({ rootDir: root, atomicWriteFile, maxBytes: 8 });
  const result = await runtime.ingestDataUrls([
    "data:text/plain;base64,SGVsbG8=",
    DATA_URL,
  ]);

  assert.equal(result.attachments.length, 0);
  assert.equal(result.errors.length, 2);
});

test("legacy inline session images migrate to attachment references", async (t) => {
  const { runtime } = await fixture(t);
  const migration = await runtime.migrateLegacySessionEntries([{
    role: "user",
    content: [
      { type: "text", text: "inspect" },
      { type: "image_url", image_url: { url: DATA_URL } },
    ],
    images: [{ name: "screen.png", dataUrl: DATA_URL }],
  }], { sessionId: "legacy-session", operationId: "legacy-operation" });

  assert.equal(migration.migrated, 1);
  assert.equal(migration.entries[0].content, "inspect");
  assert.equal(migration.entries[0].images, undefined);
  assert.equal(migration.entries[0].attachments.length, 1);
  assert.doesNotMatch(JSON.stringify(migration.entries), /base64/);
});

test("chunked image upload preserves original bytes and cleans its staging file", async (t) => {
  const { root, runtime } = await fixture(t);
  const upload = await runtime.beginUpload({
    name: "original.png",
    size: PNG.length,
    mimeType: "image/jpeg",
    sessionId: "session-upload",
    operationId: "upload-request",
    workspace: "C:\\workspace",
  });
  await runtime.appendUpload(upload.uploadId, PNG.subarray(0, 7), 0);
  const progress = await runtime.appendUpload(upload.uploadId, PNG.subarray(7), 7);
  assert.equal(progress.complete, true);

  const attachment = await runtime.finishUpload(upload.uploadId);
  assert.equal(attachment.mimeType, "image/png");
  assert.deepEqual(await runtime.readBytes(attachment.id), PNG);
  await assert.rejects(readFile(resolve(root, "uploads", upload.uploadId)));

  assert.equal(await runtime.releaseAttachments([attachment.id]), 1);
  assert.equal(await runtime.get(attachment.id), null);
});

test("chunked uploads detect supported video formats from bytes instead of names or declared MIME", async (t) => {
  const { runtime } = await fixture(t);
  for (const [name, bytes, mimeType] of [
    ["renamed.bin", MP4, "video/mp4"],
    ["clip.mp4", MOV, "video/quicktime"],
    ["capture.mov", WEBM, "video/webm"],
  ]) {
    const upload = await runtime.beginUpload({
      name,
      size: bytes.length,
      mimeType: "image/png",
      sessionId: "session-video",
      operationId: "operation-video",
    });
    await runtime.appendUpload(upload.uploadId, bytes, 0);
    const attachment = await runtime.finishUpload(upload.uploadId);
    assert.equal(attachment.kind, "video");
    assert.equal(attachment.mimeType, mimeType);
    assert.deepEqual(await runtime.readBytes(attachment.id), bytes);
  }
});

test("chunked uploads reject unsupported bytes even when the extension claims video", async (t) => {
  const { runtime } = await fixture(t);
  const bytes = Buffer.from("not a real video", "utf8");
  const upload = await runtime.beginUpload({ name: "fake.mp4", size: bytes.length, mimeType: "video/mp4" });
  await runtime.appendUpload(upload.uploadId, bytes, 0);
  await assert.rejects(runtime.finishUpload(upload.uploadId), /受支持的图片或视频格式/);
});

test("parallel attachment writes restore every committed index record", async (t) => {
  const { root, runtime } = await fixture(t);
  const stored = await Promise.all(Array.from({ length: 12 }, (_, index) => runtime.ingestBytes(
    Buffer.concat([PNG, Buffer.from([index])]),
    { kind: "image", mimeType: "image/png", sessionId: `session-${index}`, operationId: `op-${index}` },
  )));
  assert.equal(new Set(stored.map((attachment) => attachment.id)).size, 12);

  const restored = createAttachmentRuntime({ rootDir: root, atomicWriteFile });
  assert.equal((await restored.list()).length, 12);
});

test("stale-scope cleanup removes only pending upload attachments", async (t) => {
  const { runtime } = await fixture(t);
  const upload = await runtime.beginUpload({
    name: "pending.png",
    size: PNG.length,
    mimeType: "image/png",
    sessionId: "old-session",
    workspace: "C:\\old-workspace",
  });
  await runtime.appendUpload(upload.uploadId, PNG, 0);
  const pending = await runtime.finishUpload(upload.uploadId);
  const committed = await runtime.ingestBytes(Buffer.concat([PNG, Buffer.from([1])]), {
    kind: "image",
    mimeType: "image/png",
    sessionId: "old-session",
    operationId: "operation-committed",
    workspace: "C:\\old-workspace",
  });

  const released = await runtime.releasePendingUploads([
    { id: pending.id, sessionId: "old-session", workspace: "C:\\old-workspace" },
    { id: committed.id, sessionId: "old-session", workspace: "C:\\old-workspace" },
  ]);
  assert.equal(released, 1);
  assert.equal(await runtime.get(pending.id), null);
  assert.ok(await runtime.get(committed.id));
});

test("cancelling by upload id cleans a finished attachment whose response was lost", async (t) => {
  const { runtime } = await fixture(t);
  const context = { sessionId: "session-lost-response", workspace: "C:\lost-response" };
  const upload = await runtime.beginUpload({
    name: "lost.png",
    size: PNG.length,
    mimeType: "image/png",
    ...context,
  });
  await runtime.appendUpload(upload.uploadId, PNG, 0);
  const finished = await runtime.finishUpload(upload.uploadId);
  assert.ok(await runtime.get(finished.id));

  assert.equal(await runtime.cancelUpload(upload.uploadId, context), true);
  assert.equal(await runtime.get(finished.id), null);
});
