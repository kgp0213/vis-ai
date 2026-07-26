import assert from "node:assert/strict";
import { test } from "node:test";

import { projectModelContext } from "./model-context-projector.mjs";

test("model projection excludes internal and credential fields while retaining resources", () => {
  const result = projectModelContext({
    history: [
      { role: "system", content: "system" },
      { role: "user", content: [{ type: "text", text: "读取" }, { type: "resource", resourceId: "tool-output-1" }], attachments: [{ id: "att-1" }] },
      { role: "assistant", content: "内部", internal: true, apiKey: "secret" },
      { role: "tool", content: "结果", metadata: { apiKey: "secret" } },
    ],
    operation: { preparedDocuments: [{ readablePath: "C:\\work\\plain.pdf" }] },
    providerCapabilities: { maxContextTokens: 1000 },
  });
  assert.equal(result.messages.some((message) => message.content === "内部"), false);
  assert.equal(result.resources.some((item) => item.resourceId === "tool-output-1"), true);
  assert.equal(result.resources.some((item) => item.resourceId.includes("plain.pdf")), true);
  assert.equal(JSON.stringify(result.messages).includes("secret"), false);
});
test("projection compacts old tool results and reports overflow without claiming success", () => {
  const result = projectModelContext({
    history: [
      { role: "system", content: "rules" },
      { role: "tool", toolCallId: "a", content: "x".repeat(20_000) },
      { role: "user", content: "继续" },
    ],
    providerCapabilities: { maxContextTokens: 100 },
  });
  assert.equal(result.droppedItems.length > 0, true);
  assert.equal(result.error, null);
  assert.equal(result.messages.at(-1).content, "继续");
});

test("uses provider-measured prefix tokens for an append-only context", () => {
  const history = [
    { role: "user", content: "a".repeat(100) },
    { role: "assistant", content: "b".repeat(100) },
    { role: "user", content: "c" },
  ];
  const result = projectModelContext({
    history,
    providerCapabilities: { maxContextTokens: 1000 },
    contextBudget: {
      measuredPromptTokens: 80,
      measuredMessageCount: 2,
      measuredRequestId: "ctx-1",
      measuredAt: "2026-07-26T00:00:00.000Z",
    },
  });
  assert.equal(result.measurement.source, "measured");
  assert.equal(result.measurement.promptTokens, 80);
  assert.equal(result.estimatedTokens, 81);
});

test("does not apply a measured prefix after projection drops messages", () => {
  const result = projectModelContext({
    history: [
      { role: "user", content: "x".repeat(200) },
      { role: "tool", content: "y".repeat(200) },
      { role: "user", content: "latest" },
    ],
    providerCapabilities: { maxContextTokens: 20 },
    contextBudget: { measuredPromptTokens: 500, measuredMessageCount: 2 },
  });
  assert.equal(result.measurement, null);
  assert.equal(result.compaction.applied, true);
});
