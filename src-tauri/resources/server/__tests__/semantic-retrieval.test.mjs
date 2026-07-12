import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildRetrievalQuery,
  buildRetrievedModelInput,
  normalizeIndexRetrievalMode,
  rerankRetrievalHits,
  restoreOriginalUserInput,
  selectRetrievalHits,
} from "../lib/semantic-retrieval.mjs";

describe("semantic retrieval", () => {
  test("normalizes modes and expands short follow-up queries", () => {
    assert.equal(normalizeIndexRetrievalMode("auto"), "auto");
    assert.equal(normalizeIndexRetrievalMode("invalid"), "tool");
    assert.match(buildRetrievalQuery("为什么？", [{ role: "user", text: "为什么技能版本不能自动递增" }]), /Previous question:[\s\S]*Current question:/);
  });

  test("keeps separate knowledge and workspace quotas", () => {
    const hit = (path, score = 0.8) => ({ entry: { path, text: path, startLine: 1, endLine: 2 }, score });
    const selected = selectRetrievalHits([
      hit("knowledge/topics/a.md"), hit("knowledge/topics/b.md"), hit("src/a.js"), hit("src/b.js"),
    ], { knowledgeLimit: 1, workspaceLimit: 1 });
    assert.deepEqual(selected.map((item) => item.entry.path), ["knowledge/topics/a.md", "src/a.js"]);
  });

  test("drops a weak source-specific best hit when another source is much more relevant", () => {
    const hit = (path, score) => ({ entry: { path, text: path, startLine: 1, endLine: 2 }, score });
    const selected = selectRetrievalHits([
      hit("src/relevant.js", 0.9),
      hit("knowledge/topics/unrelated.md", 0.31),
    ]);
    assert.deepEqual(selected.map((item) => item.entry.path), ["src/relevant.js"]);
  });

  test("hybrid reranking rewards exact terms and knowledge quality without hiding vector scores", () => {
    const hits = rerankRetrievalHits([
      { entry: { path: "src/generic.js", text: "generic utilities" }, score: 0.7 },
      { entry: { path: "knowledge/topics/build.md", text: "qualityScore: 90\nrelease build failure validation" }, score: 0.68 },
    ], "release build failure");
    assert.equal(hits[0].entry.path, "knowledge/topics/build.md");
    assert.equal(hits[0].score, 0.68);
    assert.ok(hits[0].rankScore > hits[1].rankScore);
  });

  test("builds untrusted cited context and restores the persisted user input", () => {
    const original = "为什么不能自动进版？";
    const result = buildRetrievedModelInput(original, [{
      entry: { path: "knowledge/topics/version.md", startLine: 10, endLine: 20, text: "除非用户明确要求，否则不自动进版。" },
      score: 0.82,
    }]);
    assert.match(result.input, /retrieved-context untrusted="true"/);
    assert.match(result.input, /knowledge\/topics\/version\.md:10-20/);
    const restored = restoreOriginalUserInput([
      { role: "user", content: result.input },
      { role: "assistant", content: "回答" },
    ], result.input, original);
    assert.equal(restored[0].content, original);
    assert.doesNotMatch(restored[0].content, /retrieved-context/);
  });
});
