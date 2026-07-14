import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";

import { buildScheduledKnowledgeReviewPrompt, createScheduledKnowledgeStore, normalizeScheduledKnowledgeReview } from "../lib/scheduled-knowledge-store.mjs";

let root;
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = null; });

describe("scheduled V-home knowledge store", () => {
  test("enforces the AI quality gate thresholds", () => {
    assert.match(buildScheduledKnowledgeReviewPrompt("report", { taskName: "Daily" }), /untrusted-report/);
    assert.equal(normalizeScheduledKnowledgeReview({ action: "accept", qualityScore: 90, confidence: 0.9, groundedness: 95, reusability: 80, evidenceCoverage: 85, topicKey: "Alpha" }).action, "accept");
    assert.equal(normalizeScheduledKnowledgeReview({ action: "accept", qualityScore: 90, confidence: 0.9, groundedness: 60, reusability: 80, evidenceCoverage: 85 }).action, "reject");
  });

  test("deduplicates identical reports and appends related runs to one topic", () => {
    root = mkdtempSync(join(tmpdir(), "vhome-knowledge-"));
    const store = createScheduledKnowledgeStore(root);
    const review = normalizeScheduledKnowledgeReview({ action: "accept", qualityScore: 90, confidence: 0.9, groundedness: 95, reusability: 80, evidenceCoverage: 85, topicTitle: "Alpha project", topicKey: "alpha-project" });
    const first = store.archive({ markdown: "Evidence A at 2026-07-13.", taskId: "task-1", runId: "run-1", skillAction: "topic-investigation", taskName: "Alpha", sourcePath: "a.md", review, category: "investigations" });
    const duplicate = store.archive({ markdown: "Evidence A at 2026-07-13.", taskId: "task-1", runId: "run-2", skillAction: "topic-investigation", taskName: "Alpha", sourcePath: "a.md", review, category: "investigations" });
    const update = store.archive({ markdown: "Evidence B at 2026-07-14.", taskId: "task-1", runId: "run-3", skillAction: "topic-investigation", taskName: "Alpha", sourcePath: "b.md", review, category: "investigations" });
    assert.equal(first.created, true);
    assert.equal(duplicate.duplicate, true);
    assert.equal(update.updated, true);
    assert.equal(update.path, first.path);
    assert.match(readFileSync(first.path, "utf8"), /Evidence A[\s\S]*Evidence B/);
  });

  test("refuses to overwrite a corrupt manifest", () => {
    root = mkdtempSync(join(tmpdir(), "vhome-knowledge-corrupt-"));
    const store = createScheduledKnowledgeStore(root);
    writeFileSync(store.manifestPath, "{", "utf8");
    assert.throws(() => store.readManifest(), /original file was not modified/);
  });
});
