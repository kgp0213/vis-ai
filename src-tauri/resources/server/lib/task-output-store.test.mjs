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

    const first = await store.read("bg-1", { offsetBytes: 0, maxBytes: 8 });
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
    await assert.rejects(() => store.save({ taskId: "../escape", output: "bad" }), /invalid task id/u);
    await assert.rejects(() => store.read("../escape"), /invalid task id/u);
    const files = await readFile(join(root, "tasks", "bg-3.json"), "utf8");
    assert.match(files, /"schemaVersion":\s*1/u);
  });
});
