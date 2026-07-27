import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeBackgroundTaskReference,
  projectBackgroundTaskList,
  projectTaskOutput,
} from "./task-output-model.mjs";

test("projects a persisted terminal task as a bounded, recoverable model result", () => {
  const result = projectTaskOutput({
    task: {
      taskId: "bg-boot-1",
      jobId: 7,
      workspace: "C:/private/workspace",
      sessionId: "session-1",
      command: "npm run build",
      status: "failed",
      running: false,
      exitCode: 1,
      stopReason: null,
      outputTruncated: true,
    },
    window: {
      offsetBytes: 90,
      nextOffsetBytes: 108,
      totalBytes: 108,
      content: "line 9\nerror\n",
      complete: true,
    },
    reference: "bg-boot-1",
    tailLines: 80,
  });

  assert.equal(result.ok, true);
  assert.equal(result.taskId, "bg-boot-1");
  assert.equal(result.jobId, 7);
  assert.equal(result.status, "failed");
  assert.equal(result.retrievalStatus, "success");
  assert.equal(result.terminalReason, "failed");
  assert.equal(result.outputSizeBytes, 108);
  assert.equal(result.outputPreviewBytes, Buffer.byteLength("line 9\nerror\n", "utf8"));
  assert.equal(result.outputTruncated, true);
  assert.equal(result.outputGapDetected, false);
  assert.equal(result.fullOutputAvailable, true);
  assert.equal(result.nextOffsetBytes, 108);
  assert.equal(result.complete, true);
  assert.equal(result.output, "line 9\nerror\n");
  assert.equal("workspace" in result, false);
  assert.equal("sessionId" in result, false);
});

test("keeps incremental byte offsets and does not tail-trim a since read", () => {
  const result = projectTaskOutput({
    task: { taskId: "bg-2", status: "running", running: true, outputTruncated: false },
    window: {
      offsetBytes: 12,
      nextOffsetBytes: 18,
      totalBytes: 18,
      content: "新输出\n",
      complete: true,
    },
    reference: "bg-2",
    since: 12,
    tailLines: 1,
  });

  assert.equal(result.retrievalStatus, "not_ready");
  assert.equal(result.output, "新输出\n");
  assert.equal(result.outputTruncated, false);
  assert.equal(result.nextOffsetBytes, 18);
});

test("accepts legacy numeric and durable task references", () => {
  assert.deepEqual(normalizeBackgroundTaskReference(7), { kind: "job", jobId: 7 });
  assert.deepEqual(normalizeBackgroundTaskReference("7"), { kind: "job", jobId: 7 });
  assert.deepEqual(normalizeBackgroundTaskReference("bg-boot-7"), {
    kind: "task",
    taskId: "bg-boot-7",
  });
  assert.equal(normalizeBackgroundTaskReference("../escape"), null);
});

test("projects task listings without workspace paths", () => {
  const rows = projectBackgroundTaskList([
    {
      taskId: "bg-1",
      jobId: 1,
      workspace: "C:/private/workspace",
      command: "npm run build",
      status: "completed",
      running: false,
      outputBytes: 10,
      outputTruncated: false,
    },
  ]);

  assert.deepEqual(rows, [{
    taskId: "bg-1",
    jobId: 1,
    command: "npm run build",
    status: "completed",
    running: false,
    outputSizeBytes: 10,
    outputTruncated: false,
    outputGapDetected: false,
  }]);
  assert.equal(JSON.stringify(rows).includes("private/workspace"), false);
});
