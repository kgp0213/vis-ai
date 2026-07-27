import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createTaskOutputStore } from "./task-output-store.mjs";

async function withStore(run) {
  const root = await mkdtemp(join(tmpdir(), "visionox-task-output-"));
  try {
    return await run(createTaskOutputStore({ rootDir: root, now: () => "2026-07-27T00:00:00.000Z" }), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("persists task metadata and reads bounded UTF-8 output ranges", async () => {
  await withStore(async (store) => {
    await store.save({
      taskId: "bg-1",
      jobId: 1,
      command: "python build.py",
      operationId: "op-1",
      sessionId: "session-1",
      workspace: "C:/workspace",
      lifecycle: "task",
      running: true,
      startedAt: "2026-07-27T00:00:00.000Z",
      output: "开始\n你好，世界\n完成\n",
      totalBytesWritten: 27,
    });

    const listed = await store.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].taskId, "bg-1");
    assert.equal(listed[0].status, "running");
    assert.equal(listed[0].workspace, undefined);
    assert.equal(listed[0].outputTail, undefined);

    const first = await store.read("bg-1", { offsetBytes: 0, maxBytes: 7 });
    assert.equal(first.ok, true);
    assert.equal(first.content, "开始\n");
    assert.equal(first.nextOffsetBytes, Buffer.byteLength("开始\n"));
    assert.equal(first.complete, false);

    const next = await store.read("bg-1", { offsetBytes: first.nextOffsetBytes, maxBytes: 64 });
    assert.equal(next.content, "你好，世界\n完成\n");
    assert.equal(next.complete, true);
  });
});

test("marks running tasks lost after restart and preserves the diagnostic tail", async () => {
  await withStore(async (store) => {
    await store.save({ taskId: "bg-2", jobId: 2, lifecycle: "task", running: true, output: "worker output\n" });
    const recovered = await store.recoverRunning("process_restarted");
    assert.equal(recovered.updated, 1);
    assert.equal(recovered.tasks[0].status, "lost");
    assert.equal(recovered.tasks[0].running, false);
    assert.equal(recovered.tasks[0].stopReason, "process_restarted");

    const detail = await store.get("bg-2");
    assert.equal(detail.status, "lost");
    assert.equal(detail.outputTail, "worker output\n");
  });
});

test("updates a task atomically without duplicate records and rejects unsafe ids", async () => {
  await withStore(async (store, root) => {
    await store.save({ taskId: "bg-3", jobId: 3, running: true, output: "one\n" });
    await store.save({ taskId: "bg-3", jobId: 3, running: false, exitCode: 0, output: "one\ntwo\n" });
    const listed = await store.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].status, "completed");
    assert.equal((await store.get("bg-3")).outputTail, "one\ntwo\n");
    assert.equal((await store.get("bg-3")).id, "bg-3");
    await assert.rejects(() => store.save({ taskId: "../escape", output: "bad" }), /invalid task id/u);
    await assert.rejects(() => store.read("../escape"), /invalid task id/u);
    const files = await readFile(join(root, "tasks", "bg-3.json"), "utf8");
    assert.match(files, /"schemaVersion":\s*1/u);
  });
});

test("finds the latest persisted record by legacy numeric job id", async () => {
  await withStore(async (store) => {
    await store.save({ taskId: "bg-old", jobId: 7, running: false, exitCode: 1, output: "old\n", updatedAt: "2026-07-26T00:00:00.000Z" });
    await store.save({ taskId: "bg-new", jobId: 7, running: false, exitCode: 0, output: "new\n", updatedAt: "2026-07-27T00:00:00.000Z" });
    const latest = await store.getByJobId(7);
    assert.equal(latest.taskId, "bg-new");
    assert.equal(latest.status, "completed");
    assert.equal(latest.outputTail, "new\n");
  });
});

test("aligns arbitrary tail offsets to UTF-8 code-point boundaries", async () => {
  await withStore(async (store) => {
    const output = `中${"a".repeat(32_765)}\n`;
    await store.save({ taskId: "bg-utf8-tail", running: false, exitCode: 0, output });

    const totalBytes = Buffer.byteLength(output, "utf8");
    const tailStart = totalBytes - 32 * 1024;
    const window = await store.read("bg-utf8-tail", { offsetBytes: tailStart, maxBytes: 32 * 1024 });
    assert.doesNotMatch(window.content, /^�/u);
    assert.ok(window.offsetBytes >= tailStart);
    assert.equal(window.nextOffsetBytes, totalBytes);
    assert.equal(window.complete, true);
  });
});

test("keeps the first workspace snapshot and isolates lookup and deletion", async () => {
  await withStore(async (store) => {
    await store.save({
      taskId: "bg-workspace",
      jobId: 9,
      workspace: "C:/workspace-a",
      sessionId: "session-a",
      running: true,
      output: "你好\n",
      totalBytesWritten: 3,
    });
    await store.save({
      taskId: "bg-workspace",
      jobId: 9,
      workspace: "C:/workspace-b",
      sessionId: "session-b",
      running: false,
      exitCode: 0,
      output: "你好\n完成\n",
      totalBytesWritten: 6,
    });

    assert.equal((await store.list({ workspace: "C:/workspace-a" })).length, 1);
    assert.equal((await store.list({ workspace: "C:/workspace-b" })).length, 0);
    assert.equal((await store.list({ sessionId: "session-a" })).length, 1);
    assert.equal((await store.list({ sessionId: "session-b" })).length, 0);
    assert.equal(await store.get("bg-workspace", { workspace: "C:/workspace-b" }), null);
    assert.equal(await store.getByJobId(9, { workspace: "C:/workspace-b" }), null);
    assert.equal((await store.get("bg-workspace", { workspace: "C:/workspace-a" })).outputTruncated, false);
    assert.equal((await store.remove("bg-workspace", { workspace: "C:/workspace-b" })).ok, false);
    assert.equal((await store.remove("bg-workspace", { workspace: "C:/workspace-a" })).ok, true);
    assert.equal(await store.get("bg-workspace"), null);
  });
});
