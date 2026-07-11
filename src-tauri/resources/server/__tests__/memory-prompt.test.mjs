import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { analyzeMemoryEntries, buildBudgetedBlocks, buildMemoryIndex, memoryTokenBudgetForCapacity } from "../lib/memory-prompt.mjs";

describe("memory prompt budgeting", () => {
  test("high-priority blocks are kept whole", () => {
    const result = buildBudgetedBlocks([
      { key: "global:a", text: "A".repeat(30) },
      { key: "global:b", text: "B".repeat(30) },
    ], { header: "HEADER", maxChars: 69 });

    assert.deepEqual(result.selectedKeys, ["global:a"]);
    assert.deepEqual(result.omittedKeys, ["global:b"]);
    assert.match(result.text, /A{30}/);
    assert.doesNotMatch(result.text, /B{10}/);
    assert.match(result.text, /omitted 1 complete entry/);
  });

  test("token budget keeps complete blocks even when character count is misleading", () => {
    const tokenCost = (text) => String(text).includes("expensive") ? 20 : 1;
    const result = buildBudgetedBlocks([
      { key: "global:a", text: "cheap" },
      { key: "global:b", text: "expensive" },
    ], { maxChars: 100, maxTokens: 2, countTokens: tokenCost });

    assert.deepEqual(result.selectedKeys, ["global:a"]);
    assert.deepEqual(result.omittedKeys, ["global:b"]);
    assert.doesNotMatch(result.text, /expensive/);
  });

  test("recallable memory budget follows model capacity with an absolute ceiling", () => {
    assert.equal(memoryTokenBudgetForCapacity(81920), 8192);
    assert.equal(memoryTokenBudgetForCapacity(131072), 12000);
    assert.equal(memoryTokenBudgetForCapacity(1048576), 12000);
  });

  test("full-body high-priority entries are excluded from the summary index", () => {
    const result = buildMemoryIndex([
      { key: "global:hard-rule", name: "hard-rule", description: "Hard rule" },
      { key: "global:preference", name: "preference", description: "Normal preference" },
    ], { maxChars: 4000, excludedKeys: new Set(["global:hard-rule"]) });

    assert.deepEqual(result.selectedKeys, ["global:preference"]);
    assert.doesNotMatch(result.text, /hard-rule/);
    assert.match(result.text, /preference/);
  });

  test("indexes report omitted complete entries without cutting a line", () => {
    const entries = Array.from({ length: 8 }, (_, index) => ({
      key: `project:item-${index}`,
      name: `item-${index}`,
      description: `Description ${index} ${"x".repeat(40)}`,
    }));
    const result = buildMemoryIndex(entries, { maxChars: 180 });

    assert.ok(result.omittedKeys.length > 0);
    assert.match(result.text, /omitted \d+ complete entr(?:y|ies)/);
    for (const line of result.text.split("\n")) {
      if (line.startsWith("- [")) assert.match(line, /\.md\) — /);
    }
  });

  test("diagnostics distinguish exact duplicates, possible conflicts, and sensitive content", () => {
    const result = analyzeMemoryEntries([
      { key: "global:a", description: "Report style", body: "Use short sections." },
      { key: "project:b", description: "Report style", body: "Use short sections." },
      { key: "global:c", description: "Report style", body: "Use detailed sections." },
      { key: "global:secret", description: "Credentials", body: "api_key = sk-1234567890abcdef" },
    ]);

    assert.deepEqual(result.duplicates, [["global:a", "project:b"]]);
    assert.deepEqual(result.conflicts, [["global:a", "global:c", "project:b"]]);
    assert.deepEqual(result.sensitiveKeys, ["global:secret"]);
  });
});
