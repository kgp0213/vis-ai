import assert from "node:assert/strict";
import { test } from "node:test";

import { planToolCallBatches, toolClaimsConflict } from "./parallel-tool-scheduler.mjs";

test("parallel scheduler only groups disjoint declared read-only calls", () => {
  const result = planToolCallBatches([
    { name: "read_file", args: { path: "C:/work/a.txt" } },
    { name: "read_file", args: { path: "C:/work/b.txt" } },
    { name: "write_file", args: { path: "C:/work/c.txt" } },
  ]);
  assert.equal(result.parallelEnabled, true);
  assert.deepEqual(result.batches.map((batch) => batch.length), [2, 1]);
});

test("overlapping and undeclared resources stay serial", () => {
  assert.equal(toolClaimsConflict({ name: "read_file", args: { path: "C:/work" } }, { name: "read_file", args: { path: "C:/work/a" } }), true);
  assert.equal(toolClaimsConflict({ name: "read_file", args: {} }, { name: "read_file", args: { path: "C:/work/a" } }), true);
});

test("understands OpenAI tool-call arguments and caps each batch", () => {
  const result = planToolCallBatches([
    { id: "1", function: { name: "read_file", arguments: JSON.stringify({ path: "C:/one.txt" }) } },
    { id: "2", function: { name: "read_file", arguments: JSON.stringify({ path: "C:/two.txt" }) } },
    { id: "3", function: { name: "read_file", arguments: JSON.stringify({ path: "C:/three.txt" }) } },
    { id: "4", function: { name: "read_file", arguments: JSON.stringify({ path: "C:/four.txt" }) } },
  ], { maxParallel: 3 });
  assert.deepEqual(result.batches.map((batch) => batch.map((call) => call.id)), [["1", "2", "3"], ["4"]]);
  assert.equal(result.parallelEnabled, true);
});

test("keeps conflict boundaries contiguous so the loop cannot skip calls", () => {
  const result = planToolCallBatches([
    { id: "a", name: "read_file", args: { path: "C:/work/a" } },
    { id: "b", name: "read_file", args: { path: "C:/work/a/sub" } },
    { id: "c", name: "read_file", args: { path: "C:/work/c" } },
  ]);
  assert.deepEqual(result.batches.map((batch) => batch.map((call) => call.id)), [["a"], ["b", "c"]]);
});

test("serializes shared DLP, MCP and attachment resources", () => {
  assert.equal(toolClaimsConflict({ name: "read_file", workspace: "C:/work", dlpBindingId: "doc-1", mcpServer: "files" }, { name: "read_file", workspace: "C:/work", dlpBindingId: "doc-1", mcpServer: "other" }), true);
  assert.equal(toolClaimsConflict({ name: "read_media", args: { attachments: ["att-1"] } }, { name: "read_media", args: { attachments: ["att-1"] } }), true);
  assert.equal(toolClaimsConflict({ name: "read_file", workspace: "C:/work", mcpServer: "files", args: { path: "C:/work/a" } }, { name: "read_file", workspace: "C:/work", mcpServer: "other", args: { path: "C:/work/b" } }), false);
});
