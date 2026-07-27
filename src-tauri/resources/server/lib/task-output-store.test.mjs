import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    assert.equal(recovered.tasks[0].notificationId, "task:bg-2:lost");

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

test("persists and acknowledges terminal notification facts", async () => {
  await withStore(async (store) => {
    await store.save({
      taskId: "bg-notify",
      jobId: 9,
      sessionId: "session-notify",
      workspace: "C:/notify",
      running: false,
      exitCode: 1,
      notificationId: "task:bg-notify:failed",
      output: "failed\n",
    });
    const pending = await store.listPendingNotifications({ sessionId: "session-notify", workspace: "C:/notify" });
    assert.equal(pending.length, 1);
    assert.equal(pending[0].notificationId, "task:bg-notify:failed");
    assert.equal(await store.acknowledgeNotification("bg-notify", "task:bg-notify:failed"), true);
    assert.equal((await store.listPendingNotifications({ sessionId: "session-notify", workspace: "C:/notify" })).length, 0);
  });
});

test("appends overlapping polling snapshots without replacing durable history", async () => {
  await withStore(async (store) => {
    await store.save({ taskId: "bg-append", running: true, output: "one\n", totalBytesWritten: 4 });
    await store.save({ taskId: "bg-append", running: true, output: "one\ntwo\n", totalBytesWritten: 8 });
    await store.save({ taskId: "bg-append", running: true, output: "one\ntwo\nthree\n", totalBytesWritten: 14 });
    // The same snapshot is emitted by both the change listener and the
    // periodic persistence timer. It must not duplicate the final line.
    await store.save({ taskId: "bg-append", running: true, output: "one\ntwo\nthree\n", totalBytesWritten: 14 });

    const detail = await store.get("bg-append");
    assert.equal(detail.outputTail, "one\ntwo\nthree\n");
    assert.equal(detail.outputBytes, Buffer.byteLength("one\ntwo\nthree\n", "utf8"));
    assert.equal(detail.outputTruncated, false);
  });
});

test("keeps durable history when a ring snapshot has dropped older output", async () => {
  await withStore(async (store) => {
    await store.save({ taskId: "bg-ring", running: true, output: "old-1\nold-2\n", totalBytesWritten: 12 });
    await store.save({
      taskId: "bg-ring",
      running: true,
      output: "[… older output dropped …]\nnew-1\nnew-2\n",
      totalBytesWritten: 24,
    });

    const detail = await store.get("bg-ring");
    assert.equal(detail.outputTail, "old-1\nold-2\nnew-1\nnew-2\n");
    assert.equal(detail.outputTruncated, true);
    assert.equal(detail.outputGapDetected, false);
  });
});

test("does not duplicate a repeated trailing line after ring rollover", async () => {
  await withStore(async (store) => {
    await store.save({ taskId: "bg-ring-repeat", running: true, output: "tick\n", totalBytesWritten: 5 });
    await store.save({
      taskId: "bg-ring-repeat",
      running: true,
      output: "[… older output dropped …]\ntick\n",
      totalBytesWritten: 10,
    });

    const detail = await store.get("bg-ring-repeat");
    assert.equal(detail.outputTail, "tick\ntick\n");
    assert.equal(detail.outputGapDetected, false);
  });
});

test("keeps a literal drop-marker line from a child process", async () => {
  await withStore(async (store) => {
    await store.save({
      taskId: "bg-marker-text",
      running: false,
      exitCode: 0,
      output: "[… older output dropped …]\nuser text\n",
      totalBytesWritten: 37,
    });

    const detail = await store.get("bg-marker-text");
    assert.equal(detail.outputTail, "[… older output dropped …]\nuser text\n");
    assert.equal(detail.outputTruncated, true);
  });
});

test("conservatively repairs a pre-reportedUnits non-ASCII record", async () => {
  await withStore(async (store, root) => {
    await store.save({ taskId: "bg-legacy-cjk", running: true, output: "中文旧\n", totalBytesWritten: 4 });
    const recordPath = join(root, "tasks", "bg-legacy-cjk.json");
    const legacy = JSON.parse(await readFile(recordPath, "utf8"));
    delete legacy.reportedUnits;
    await writeFile(recordPath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");

    await store.save({
      taskId: "bg-legacy-cjk",
      running: false,
      exitCode: 0,
      output: "[… older output dropped …]\n新\n",
      totalBytesWritten: 6,
    });

    const detail = await store.get("bg-legacy-cjk");
    assert.equal(detail.outputTail, "中文旧\n新\n");
    assert.equal(detail.outputGapDetected, true);
    assert.equal(detail.outputTruncated, true);
  });
});

test("records an output gap when more data arrived than the ring snapshot contains", async () => {
  await withStore(async (store) => {
    await store.save({ taskId: "bg-gap", running: true, output: "start\n", totalBytesWritten: 6 });
    await store.save({
      taskId: "bg-gap",
      running: true,
      output: "[… older output dropped …]\nlast\n",
      // The ring only exposes four source characters, but twelve arrived.
      totalBytesWritten: 18,
    });

    const detail = await store.get("bg-gap");
    assert.equal(detail.outputTail, "start\nlast\n");
    assert.equal(detail.outputTruncated, true);
    assert.equal(detail.outputGapDetected, true);
  });
});

test("enforces the durable output limit and exposes truncation", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-task-output-limit-"));
  try {
    const store = createTaskOutputStore({ rootDir: root, maxOutputBytes: 12, now: () => "2026-07-27T00:00:00.000Z" });
    await store.save({ taskId: "bg-limit", running: false, output: "1234567890", totalBytesWritten: 10 });
    await store.save({ taskId: "bg-limit", running: false, output: "1234567890abcdefghij", totalBytesWritten: 20, exitCode: 0 });
    const detail = await store.get("bg-limit");
    assert.equal(detail.outputTail, "90abcdefghij");
    assert.equal(detail.outputBytes <= 12, true);
    assert.equal(detail.outputTruncated, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
