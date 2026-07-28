import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("../visionox-pkg/node_modules/typescript/lib/typescript.js");

async function loadGrouping() {
  const source = await readFile(new URL("../visionox-pkg/dashboard/src/lib/chat-turn-rendering.ts", import.meta.url), "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
    fileName: "chat-turn-rendering.ts",
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output, "utf8").toString("base64")}`);
}

test("groups tools by turn and step while updating retries in place", async () => {
  const { groupToolMessages } = await loadGrouping();
  const units = groupToolMessages([
    { role: "tool", id: "a1", toolCallId: "a1", turnId: "turn-1", stepId: "step-1", toolStatus: "failed" },
    { role: "tool", id: "a1-retry", toolCallId: "a1", turnId: "turn-1", stepId: "step-1", toolStatus: "recovered" },
    { role: "assistant", id: "answer-1" },
    { role: "tool", id: "b1", toolCallId: "b1", turnId: "turn-2", stepId: "step-1" },
  ]);
  const groups = units.filter((unit) => unit.kind === "toolGroup");
  assert.deepEqual(groups.map((unit) => unit.items.length), [1, 1]);
  assert.equal(groups[0].items[0].msg.toolStatus, "recovered");
});

test("keeps distinct parallel calls in the same step and separates step boundaries", async () => {
  const { groupToolMessages } = await loadGrouping();
  const units = groupToolMessages([
    { role: "tool", toolCallId: "a", turnId: "turn-1", stepId: "step-1" },
    { role: "tool", toolCallId: "b", turnId: "turn-1", stepId: "step-1" },
    { role: "tool", toolCallId: "c", turnId: "turn-1", stepId: "step-2" },
  ]);
  assert.deepEqual(units.filter((unit) => unit.kind === "toolGroup").map((unit) => unit.items.length), [2, 1]);
});

test("keeps failed, recovered and unknown tool groups expanded", async () => {
  const { toolGroupAttention } = await loadGrouping();
  assert.deepEqual(toolGroupAttention([
    { toolStatus: "succeeded" },
    { toolStatus: "recovered" },
  ]), { hasFailure: false, hasRecovery: true, keepExpanded: true });
  assert.deepEqual(toolGroupAttention([{ toolStatus: "unknown" }]), {
    hasFailure: true,
    hasRecovery: false,
    keepExpanded: true,
  });
  assert.deepEqual(toolGroupAttention([{ toolStatus: "succeeded" }]), {
    hasFailure: false,
    hasRecovery: false,
    keepExpanded: false,
  });
});

test("legacy contiguous tools remain compatible without crossing messages", async () => {
  const { groupToolMessages } = await loadGrouping();
  const units = groupToolMessages([{ role: "tool", id: "a" }, { role: "tool", id: "b" }, { role: "user", id: "u" }, { role: "tool", id: "c" }]);
  assert.deepEqual(units.filter((unit) => unit.kind === "toolGroup").map((unit) => unit.items.length), [2, 1]);
});

test("legacy group identity stays stable when history prepends its earlier tools", async () => {
  const { groupToolMessages } = await loadGrouping();
  const partial = groupToolMessages([
    { role: "tool", id: "call-b", toolCallId: "call-b" },
    { role: "tool", id: "call-c", toolCallId: "call-c" },
  ]);
  const complete = groupToolMessages([
    { role: "tool", id: "call-a", toolCallId: "call-a" },
    { role: "tool", id: "call-b", toolCallId: "call-b" },
    { role: "tool", id: "call-c", toolCallId: "call-c" },
  ]);
  assert.equal(partial[0].id, complete[0].id);
});

test("identified group identity stays stable when a live tool is appended", async () => {
  const { groupToolMessages } = await loadGrouping();
  const first = groupToolMessages([
    { role: "tool", toolCallId: "call-a", turnId: "turn-1", stepId: "step-1" },
  ]);
  const appended = groupToolMessages([
    { role: "tool", toolCallId: "call-a", turnId: "turn-1", stepId: "step-1" },
    { role: "tool", toolCallId: "call-b", turnId: "turn-1", stepId: "step-1" },
  ]);
  assert.equal(first[0].id, appended[0].id);
});

test("tool frame identity isolates a reused provider call id across turns", async () => {
  const { toolFrameMatches } = await loadGrouping();
  const first = { id: "assistant-1-tool-call-1", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1" };
  const retry = { id: "assistant-1-tool-call-1", toolCallId: "call-1", turnId: "turn-1", stepId: "step-1" };
  const reused = { id: "assistant-2-tool-call-1", toolCallId: "call-1", turnId: "turn-2", stepId: "step-1" };

  assert.equal(toolFrameMatches(first, retry), true);
  assert.equal(toolFrameMatches(first, reused), false);
  assert.equal(toolFrameMatches({ toolCallId: "legacy" }, { toolCallId: "legacy" }), true);
});

test("chat upserts active and completed tools through scoped frame identity", async () => {
  const chatSource = await readFile(new URL("../visionox-pkg/dashboard/src/panels/chat.ts", import.meta.url), "utf8");
  assert.match(chatSource, /import \{ groupToolMessages, toolFrameMatches \}/u);
  assert.equal((chatSource.match(/findIndex\(\(item\) => toolFrameMatches\(item, next\)\)/gu) ?? []).length, 2);
});
