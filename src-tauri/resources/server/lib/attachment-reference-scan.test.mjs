import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { collectAttachmentReferences } from "./attachment-reference-scan.mjs";

test("attachment reference scan covers active, archived and durable prompt queue records", async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), "visionox-attachment-references-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sessionsDir = resolve(root, "sessions");
  await mkdir(sessionsDir, { recursive: true });
  const ids = [
    "att_11111111-1111-4111-8111-111111111111",
    "att_22222222-2222-4222-8222-222222222222",
    "att_33333333-3333-4333-8333-333333333333",
  ];
  await writeFile(resolve(root, "active-session.jsonl"), `${JSON.stringify({ role: "user", attachments: [{ id: ids[0] }] })}\n`, "utf8");
  await writeFile(resolve(sessionsDir, "archived.jsonl"), `${JSON.stringify({ role: "user", attachments: [ids[1]] })}\n`, "utf8");
  await writeFile(resolve(root, "prompt-queue.json"), JSON.stringify({
    version: 1,
    queues: { "session:workspace": [{ id: "queued", attachments: [ids[2]] }] },
    accepted: [],
    unrelated: { id: "att_99999999-9999-4999-8999-999999999999" },
  }), "utf8");

  const result = await collectAttachmentReferences({
    activeSessionFile: resolve(root, "active-session.jsonl"),
    sessionsDir,
    promptQueueFile: resolve(root, "prompt-queue.json"),
  });
  assert.deepEqual(result.ids, ids);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.scannedFiles, 3);
});

test("attachment reference scan reports corrupt sources and preserves valid references", async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), "visionox-attachment-reference-errors-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sessionsDir = resolve(root, "sessions");
  await mkdir(sessionsDir, { recursive: true });
  const id = "att_44444444-4444-4444-8444-444444444444";
  await writeFile(resolve(root, "active-session.jsonl"), `${JSON.stringify({ attachments: [id] })}\n{broken`, "utf8");
  await writeFile(resolve(root, "prompt-queue.json"), "{broken", "utf8");

  const result = await collectAttachmentReferences({
    activeSessionFile: resolve(root, "active-session.jsonl"),
    sessionsDir,
    promptQueueFile: resolve(root, "prompt-queue.json"),
  });
  assert.deepEqual(result.ids, [id]);
  assert.equal(result.warnings.length, 2);
});
