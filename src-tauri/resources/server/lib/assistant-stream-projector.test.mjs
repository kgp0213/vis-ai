import assert from "node:assert/strict";
import { test } from "node:test";

import { createAssistantStreamProjector } from "./assistant-stream-projector.mjs";

test("keeps legacy deltas append-compatible when no stream metadata is present", () => {
  const projector = createAssistantStreamProjector();
  const first = projector.project({ role: "assistant_delta", content: "ab" }, { assistantId: "assistant-1" });
  const second = projector.project({ role: "assistant_delta", content: "cd", offset: 0 }, { assistantId: "assistant-1" });
  assert.equal(first.id, "assistant-1");
  assert.equal(first.offset, 0);
  assert.equal(second.contentDelta, "cd");
  assert.equal(second.offset, 2);
});

test("drops duplicate chunks and requests resync for an explicit gap", () => {
  const projector = createAssistantStreamProjector();
  const first = projector.project({ role: "assistant_delta", attempt: 1, stepId: "step-1", content: "ab", offset: 0 }, { assistantId: "assistant-1" });
  const duplicate = projector.project({ role: "assistant_delta", attempt: 1, stepId: "step-1", content: "ab", offset: 0 }, { assistantId: "assistant-1" });
  const gap = projector.project({ role: "assistant_delta", attempt: 1, stepId: "step-1", content: "z", offset: 4 }, { assistantId: "assistant-1" });
  assert.equal(first.contentDelta, "ab");
  assert.equal(duplicate, null);
  assert.equal(gap.kind, "resync-required");
  assert.equal(gap.expectedOffset, 2);
  assert.equal(gap.receivedOffset, 4);
});

test("retries reuse the assistant id and reset only the current stream attempt", () => {
  const projector = createAssistantStreamProjector();
  const first = projector.project({ role: "assistant_delta", attempt: 1, stepId: "step-1", content: "bad", offset: 0 }, { assistantId: "assistant-1", operationId: "op-1" });
  const retry = projector.project({ role: "assistant_delta", attempt: 2, stepId: "step-2", content: "good", offset: 0, maxAttempts: 3, retryReason: "429" }, { assistantId: "assistant-1", operationId: "op-1" });
  assert.equal(first.id, retry.id);
  assert.equal(retry.streamReset, true);
  assert.equal(retry.retry.attempt, 2);
  assert.equal(retry.offset, 0);
  assert.equal(retry.contentDelta, "good");
  assert.equal(projector.project({ role: "assistant_delta", attempt: 1, stepId: "step-1", content: "stale", offset: 0 }, { assistantId: "assistant-1" }), null);
});

test("same assistant id is isolated across operation scopes", () => {
  const projector = createAssistantStreamProjector();
  const first = projector.project(
    { role: "assistant_delta", attempt: 1, stepId: "step-1", content: "one", offset: 0 },
    { assistantId: "assistant-1", operationId: "op-1", sessionId: "session-1" },
  );
  const second = projector.project(
    { role: "assistant_delta", attempt: 1, stepId: "step-1", content: "two", offset: 0 },
    { assistantId: "assistant-1", operationId: "op-2", sessionId: "session-2" },
  );
  assert.equal(first.contentDelta, "one");
  assert.equal(second.contentDelta, "two");
  assert.equal(projector.size(), 2);
  projector.reset("assistant-1", { operationId: "op-1", sessionId: "session-1" });
  assert.equal(projector.size(), 1);
  assert.equal(projector.project(
    { role: "assistant_delta", attempt: 1, stepId: "step-1", content: "again", offset: 3 },
    { assistantId: "assistant-1", operationId: "op-2", sessionId: "session-2" },
  ).contentDelta, "again");
});

test("a new step can restart its local offset without duplicating the Dashboard bubble", () => {
  const projector = createAssistantStreamProjector();
  projector.project({ role: "assistant_delta", attempt: 1, stepId: "step-1", content: "one", offset: 0 }, { assistantId: "assistant-1" });
  const next = projector.project({ role: "assistant_delta", attempt: 1, stepId: "step-2", content: "two", offset: 0 }, { assistantId: "assistant-1" });
  assert.equal(next.contentDelta, "two");
  assert.equal(next.offset, 3);
});
