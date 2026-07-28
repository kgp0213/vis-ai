import assert from "node:assert/strict";
import { test } from "node:test";

import { paginateExecutionTranscript, projectExecutionTranscript } from "./execution-transcript.mjs";

test("projects a legacy JSONL conversation into turn, step and tool frames", () => {
  const transcript = projectExecutionTranscript([
    { role: "user", content: "读取文件并总结", attachments: [{ id: "att-1", kind: "file", name: "a.txt", size: 120 }] },
    { role: "assistant", content: "我先读取文件", tool_calls: [{ id: "call-1", function: { name: "read_file" } }] },
    { role: "tool", toolCallId: "call-1", toolName: "read_file", content: "文件内容", toolStatus: "succeeded" },
    { role: "assistant", content: "已完成总结" },
    { role: "user", content: "再检查一次" },
    { role: "assistant", content: "检查完成" },
    { role: "user", content: "[系统自动续跑 1/2] 不应显示" },
  ], { sessionId: "session-1" });

  assert.equal(transcript.items.length, 2);
  assert.equal(transcript.items[0].turnId, "t1");
  assert.equal(transcript.items[0].attachmentIds[0], "att-1");
  const toolFrames = transcript.items[0].steps.flatMap((step) => step.frames).filter((frame) => frame.toolCallId === "call-1");
  assert.equal(toolFrames.length, 1);
  assert.equal(toolFrames[0].state, "succeeded");
  assert.equal(transcript.attachments[0].sessionId, "session-1");
  assert.equal(transcript.attachments[0].resource.resourceId, "att-1");
  assert.equal(transcript.attachments[0].resource.totalBytes, 120);
  assert.equal(transcript.attachments[0].resource.readAction, "attachment_content");
});

test("scopes reused provider tool call ids to their turn", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "first" },
    { role: "assistant", content: "read", tool_calls: [{ id: "call_0", function: { name: "read_file" } }] },
    { role: "tool", toolCallId: "call_0", toolName: "read_file", content: "first result", toolStatus: "succeeded" },
    { role: "user", content: "second" },
    { role: "assistant", content: "read again", tool_calls: [{ id: "call_0", function: { name: "read_file" } }] },
    { role: "tool", toolCallId: "call_0", toolName: "read_file", content: "second result", toolStatus: "succeeded" },
  ]);
  const frames = snapshot.items.flatMap((turn) => turn.steps.flatMap((step) => step.frames))
    .filter((frame) => frame.kind === "tool");
  assert.equal(frames.length, 2);
  assert.deepEqual(frames.map((frame) => frame.outputPreview), ["first result", "second result"]);
  assert.notEqual(frames[0].frameId, frames[1].frameId);
});

test("pagination never splits a turn and converges on repeated reads", () => {
  const snapshot = projectExecutionTranscript([
    ...Array.from({ length: 5 }, (_, index) => ({ role: "user", content: `prompt-${index}` })),
  ]);
  const tail = paginateExecutionTranscript(snapshot, { limit: 2 });
  assert.deepEqual(tail.items.map((item) => item.turnId), ["t4", "t5"]);
  assert.equal(tail.hasMoreOlder, true);
  const older = paginateExecutionTranscript(snapshot, { beforeTurn: "t4", limit: 2 });
  assert.deepEqual(older.items.map((item) => item.turnId), ["t2", "t3"]);
  const repeat = paginateExecutionTranscript(snapshot, { beforeTurn: "t4", limit: 2 });
  assert.deepEqual(repeat, older);
});

test("invalid transcript cursors request resynchronization instead of jumping to the tail", () => {
  const snapshot = projectExecutionTranscript([{ role: "user", content: "hello" }]);
  const page = paginateExecutionTranscript(snapshot, { beforeTurn: "missing-turn", limit: 2 });
  assert.equal(page.resyncRequired, true);
  assert.deepEqual(page.items, []);
});

test("projection is display-safe and excludes internal prompts", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "[系统通用复杂任务调度] hidden" },
    { role: "assistant", content: "visible" },
    { role: "tool", toolName: "run_command", content: "apiKey=secret-value", isError: true },
  ]);
  assert.equal(snapshot.items[0].prompt, null);
  const frame = snapshot.items[0].steps.flatMap((step) => step.frames).find((item) => item.kind === "tool");
  assert.equal(frame.error, "apiKey=[REDACTED]");
  assert.equal(frame.input, undefined);
});

test("does not infer completion for an unfinished turn and marks display truncation", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "仍在处理中" },
    { role: "assistant", content: "x".repeat(12_100), tool_calls: [{ id: "call-live", function: { name: "read_file" } }] },
  ]);
  assert.equal(snapshot.items[0].state, "unknown");
  const frame = snapshot.items[0].steps[0].frames.find((item) => item.kind === "text");
  assert.equal(frame.truncated, true);
  assert.equal(frame.textLength, 12_100);
});

test("does not infer task completion from assistant text when execution facts lack a terminal receipt", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "生成文件", operationId: "op-no-receipt" },
    { role: "assistant", operationId: "op-no-receipt", content: "已经生成" },
  ]);
  assert.equal(snapshot.items[0].state, "unknown");
});

test("accepts an explicit successful receipt as the execution terminal fact", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "执行检查", operationId: "op-receipt" },
    { role: "assistant", operationId: "op-receipt", content: "已完成", receipt: { completion: { ok: true } } },
  ]);
  assert.equal(snapshot.items[0].state, "completed");
});

test("projects artifact and receipt facts separately from display text", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "生成文件" },
    { role: "assistant", content: "已生成", artifactFiles: [{ path: "C:\\work\\out.md", verified: true }], receipt: { requestId: "req-1", completion: { ok: true } } },
  ], { sessionId: "s-1" });
  assert.equal(snapshot.artifacts[0].path, "C:\\work\\out.md");
  assert.equal(snapshot.receipts[0].requestId, "req-1");
});

test("projects goal, todo and prompt steering metadata without exposing instructions", () => {
  const snapshot = projectExecutionTranscript([], {
    sessionId: "session-entities",
    goals: [{ id: "goal-1", title: "交付结果", status: "active" }],
    todos: [{ id: "todo-1", content: "验证文件", status: "in_progress" }],
    prompts: [{ id: "prompt-1", operationId: "op-1", sessionId: "session-entities", instruction: "token=secret", status: "applied" }],
  });
  assert.equal(snapshot.goals[0].title, "交付结果");
  assert.equal(snapshot.todos[0].title, "验证文件");
  assert.equal(snapshot.prompts[0].instructionLength, 12);
  assert.equal("instruction" in snapshot.prompts[0], false);
  assert.equal(snapshot.prompts[0].sessionId, "session-entities");
});

test("legacy transcript projection remains compatible when entity metadata is absent", () => {
  const snapshot = projectExecutionTranscript([{ role: "user", content: "hello" }]);
  assert.deepEqual(snapshot.goals, []);
  assert.deepEqual(snapshot.todos, []);
  assert.deepEqual(snapshot.prompts, []);
});

test("uses persisted turn and message identities when projecting a transcript", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "stable request" },
    { role: "assistant", id: "assistant-stable", messageId: "assistant-stable", turnId: "turn-stable", content: "done" },
  ]);
  assert.equal(snapshot.items[0].turnId, "turn-stable");
  assert.equal(snapshot.items[0].messageId, "assistant-stable");
  assert.equal(snapshot.items[0].steps[0].stepId, "turn-stable.s1");
  assert.equal(snapshot.items[0].steps[0].frames[0].frameId, "turn-stable.s1.text");
});

test("projects the persisted execution phase as a turn fact", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "run" },
    {
      role: "assistant",
      content: "done",
      receipt: {
        phase: { phase: "ended", terminalState: "completed", operationId: "op-1" },
      },
    },
  ]);
  assert.equal(snapshot.items[0].phase.phase, "ended");
  assert.equal(snapshot.items[0].phase.terminalState, "completed");
});

test("keeps retry and request facts on the Step projection without exposing extra model prompts", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "retry this" },
    {
      role: "assistant",
      turnId: "turn-retry",
      stepId: "turn-retry.s1",
      attempt: 2,
      content: "done",
      usage: { inputTokens: 10, outputTokens: 4 },
      receipt: { modelRetries: [{ attempt: 2, maxAttempts: 4, reason: "429", statusCode: 429 }] },
    },
  ]);
  const step = snapshot.items[0].steps[0];
  assert.equal(step.attempt, 2);
  assert.deepEqual(step.retry, { attempt: 2, maxAttempts: 4, reason: "429", statusCode: 429 });
  assert.deepEqual(step.usage, { inputTokens: 10, outputTokens: 4 });
});

test("projects no-text execution facts and completion state from the receipt", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "run" },
    {
      role: "execution",
      operationId: "op-empty",
      turnId: "turn-empty",
      taskState: "unknown",
      receipt: { requestId: "req-empty", completion: { ok: false, taskState: "unknown" } },
    },
  ]);
  assert.equal(snapshot.items[0].turnId, "turn-empty");
  assert.equal(snapshot.items[0].state, "unknown");
  assert.equal(snapshot.items[0].explicitState, "unknown");
  assert.equal(snapshot.receipts[0].requestId, "req-empty");
});

test("uses persisted turn ids as pagination cursors", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "run" },
    { role: "assistant", turnId: "turn-stable", content: "done" },
  ]);
  const tail = paginateExecutionTranscript(snapshot, { limit: 1 });
  assert.equal(tail.cursor, "turn-stable");
  assert.notEqual(paginateExecutionTranscript(snapshot, { beforeTurn: tail.cursor, limit: 1 }).resyncRequired, true);
});

test("keeps background task terminal facts separate from visible user messages", () => {
  const snapshot = projectExecutionTranscript([
    { role: "user", content: "启动构建" },
    {
      role: "user",
      content: "[VISIONOX_BACKGROUND_TASK_NOTIFICATION] status: failed",
      internal: true,
      modelVisible: true,
      dashboardHidden: true,
      notificationId: "task:bg-1:failed",
      backgroundTaskNotification: {
        notificationId: "task:bg-1:failed",
        taskId: "bg-1",
        status: "failed",
        jobId: 3,
        sourceOperationId: "op-1",
      },
    },
  ], { sessionId: "s-1" });
  assert.equal(snapshot.taskNotifications.length, 1);
  assert.equal(snapshot.taskNotifications[0].taskId, "bg-1");
  assert.equal(snapshot.items.length, 1);
});
