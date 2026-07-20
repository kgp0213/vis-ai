import test from "node:test";
import assert from "node:assert/strict";

import {
  knowledgeEvaluationBackoff,
  prioritizeKnowledgeSessionCandidates,
  selectPendingKnowledgeSessions,
} from "./session-knowledge.mjs";

test("knowledge evaluation backoff increases but remains bounded", () => {
  const now = Date.parse("2026-07-18T12:00:00.000Z");
  const first = knowledgeEvaluationBackoff(1, now);
  const second = knowledgeEvaluationBackoff(2, now);
  assert.ok(Date.parse(first.nextEvaluationAt) > now);
  assert.ok(Date.parse(second.nextEvaluationAt) > Date.parse(first.nextEvaluationAt));
  assert.ok(Date.parse(second.nextEvaluationAt) - now <= 24 * 60 * 60 * 1000);
});

test("new or changed sessions outrank failed sessions and failed sessions wait until due", () => {
  const now = Date.parse("2026-07-18T12:00:00.000Z");
  const sessions = [
    { name: "failed-old", mtime: "2026-07-18T08:00:00.000Z", messageCount: 4 },
    { name: "new-session", mtime: "2026-07-18T09:00:00.000Z", messageCount: 4 },
    { name: "changed-session", mtime: "2026-07-18T10:00:00.000Z", messageCount: 5 },
    { name: "failed-due", mtime: "2026-07-18T11:00:00.000Z", messageCount: 4 },
  ];
  const ledger = [
    { name: "failed-old", mtime: "2026-07-18T08:00:00.000Z", messageCount: 4, status: "evaluation_failed", nextEvaluationAt: "2026-07-18T13:00:00.000Z" },
    { name: "changed-session", mtime: "2026-07-18T07:00:00.000Z", messageCount: 4, status: "evaluation_failed", nextEvaluationAt: "2026-07-18T13:00:00.000Z" },
    { name: "failed-due", mtime: "2026-07-18T11:00:00.000Z", messageCount: 4, status: "evaluation_failed", nextEvaluationAt: "2026-07-18T11:30:00.000Z" },
  ];
  assert.deepEqual(
    prioritizeKnowledgeSessionCandidates(sessions, ledger, now).map((item) => item.name),
    ["new-session", "changed-session", "failed-due"],
  );
});

test("the final 16-item selection keeps fresh sessions ahead of due failed retries", () => {
  const now = Date.parse("2026-07-18T12:00:00.000Z");
  const failed = Array.from({ length: 20 }, (_value, index) => ({
    name: `failed-${index}`,
    mtime: `2026-07-17T${String(index).padStart(2, "0")}:00:00.000Z`,
    messageCount: 4,
    transcript: "failed transcript",
  }));
  const fresh = Array.from({ length: 16 }, (_value, index) => ({
    name: `fresh-${index}`,
    mtime: `2026-07-18T${String(index).padStart(2, "0")}:00:00.000Z`,
    messageCount: 4,
    transcript: "fresh transcript",
  }));
  const ledger = failed.map((session) => ({
    name: session.name,
    mtime: session.mtime,
    messageCount: session.messageCount,
    status: "evaluation_failed",
    nextEvaluationAt: "2026-07-18T11:00:00.000Z",
  }));
  assert.deepEqual(
    selectPendingKnowledgeSessions([...failed, ...fresh], ledger, 16, now).map((item) => item.name),
    fresh.map((item) => item.name),
  );
});
