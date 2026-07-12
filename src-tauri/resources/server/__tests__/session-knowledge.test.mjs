import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeTopicDocument,
  normalizeTopicPlan,
  instructionFingerprint,
  buildTopicPlanPrompt,
  assessKnowledgeValue,
  buildSessionQualityPrompt,
  normalizeSessionQualityEvaluations,
  normalizeDocumentQualityEvaluation,
  renderTopicMarkdown,
  reconcileKnowledgeTopics,
  selectPendingKnowledgeSessions,
  sessionContentFingerprint,
  sourceFingerprint,
  stableConversation,
} from "../lib/session-knowledge.mjs";

describe("scheduled session knowledge", () => {
  test("keeps stable user and final assistant content while removing internal and secret text", () => {
    const transcript = stableConversation([
      { role: "user", content: "认证模块使用 apiKey=super-secret-value，并讨论登录失败。" },
      { role: "tool", content: "raw tool output" },
      { role: "assistant", content: "最终决定在 auth.ts 中集中处理。" },
      { role: "assistant", content: "[tool_result] internal protocol" },
    ]);

    assert.match(transcript, /认证模块/);
    assert.match(transcript, /auth\.ts/);
    assert.match(transcript, /apiKey=\[REDACTED\]/);
    assert.doesNotMatch(transcript, /raw tool output|internal protocol|super-secret-value/);
  });

  test("long conversations preserve both the opening context and final outcome", () => {
    const messages = [
      { role: "user", content: `OPENING ${"a".repeat(500)}` },
      ...Array.from({ length: 20 }, (_, index) => ({ role: "assistant", content: `middle-${index} ${"m".repeat(180)}` })),
      { role: "assistant", content: `FINAL-VERIFIED ${"z".repeat(500)}` },
    ];
    const transcript = stableConversation(messages, 1800);
    assert.match(transcript, /OPENING/);
    assert.match(transcript, /FINAL-VERIFIED/);
    assert.match(transcript, /OMITTED/);
    assert.ok(transcript.length <= 1800);
  });

  test("pending session selection is fair, content-aware, and retries failures", () => {
    const sessions = [
      { name: "newest", mtime: "2026-07-11T03:00:00.000Z", transcript: "new content", messageCount: 2 },
      { name: "oldest", mtime: "2026-07-11T01:00:00.000Z", transcript: "old content", messageCount: 2 },
      { name: "done", mtime: "2026-07-11T02:00:00.000Z", transcript: "same content", messageCount: 2 },
      { name: "retry", mtime: "2026-07-11T02:30:00.000Z", transcript: "retry content", messageCount: 2 },
    ];
    const sources = [
      { name: "done", contentFingerprint: sessionContentFingerprint(sessions[2]), status: "accepted" },
      { name: "retry", contentFingerprint: sessionContentFingerprint(sessions[3]), status: "evaluation_failed" },
    ];
    assert.deepEqual(
      selectPendingKnowledgeSessions(sessions, sources, 3).map((item) => item.name),
      ["oldest", "retry", "newest"],
    );
  });

  test("manifest reconciliation drops topics whose files no longer exist", () => {
    const topics = [
      { id: "present", path: "topics/present.md" },
      { id: "missing", path: "topics/missing.md" },
      { id: "unsafe", path: "../outside.md" },
    ];
    const result = reconcileKnowledgeTopics(topics, new Set(["topics/present.md"]));
    assert.deepEqual(result.topics.map((topic) => topic.id), ["present"]);
    assert.deepEqual(result.removedIds, ["missing", "unsafe"]);
  });

  test("accepts related sessions in one topic and preserves unassigned sessions", () => {
    const groups = normalizeTopicPlan({ groups: [
      { title: "认证设计", sessions: ["auth-a", "auth-b"], existingTopicId: "auth" },
    ] }, ["auth-a", "auth-b", "release-c"]);

    assert.deepEqual(groups[0], {
      title: "认证设计",
      existingTopicId: "auth",
      sessions: ["auth-a", "auth-b"],
    });
    assert.deepEqual(groups[1].sessions, ["release-c"]);
  });

  test("renders detailed topic sections and every source session", () => {
    const doc = normalizeTopicDocument({
      title: "认证失败处理",
      summary: "统一认证失败入口。",
      background: "多个会话持续讨论认证错误。",
      timeline: ["会话 A 定位问题", "会话 B 确认方案"],
      decisions: ["由 auth.ts 统一处理"],
      alternatives: ["放弃在 UI 分散处理"],
      implementation: ["服务端已加入错误映射"],
      openQuestions: ["是否补充重试策略"],
      evidence: ["src/auth.ts"],
    }, "fallback", ["auth-a", "auth-b"]);
    const markdown = renderTopicMarkdown(doc, {
      topicId: "auth",
      generatedAt: "2026-07-11T12:00:00.000Z",
      sourceFingerprint: "abc123",
      instructionFingerprint: "prompt123",
      sourceSessions: ["auth-a", "auth-b"],
    });

    assert.match(markdown, /## 讨论时间线/);
    assert.match(markdown, /## 已确认的决策/);
    assert.match(markdown, /## 讨论过的方案/);
    assert.match(markdown, /## 未解决问题/);
    assert.match(markdown, /source session: auth-a/);
    assert.match(markdown, /source session: auth-b/);
    assert.match(markdown, /instructionFingerprint: prompt123/);
  });

  test("source fingerprint is stable regardless of input order", () => {
    const a = { name: "a", mtime: "2026-07-10", messageCount: 4 };
    const b = { name: "b", mtime: "2026-07-11", messageCount: 8 };
    assert.equal(sourceFingerprint([a, b]), sourceFingerprint([b, a]));
  });

  test("changing additional requirements invalidates knowledge processing without changing source sessions", () => {
    assert.notEqual(
      instructionFingerprint("focus on build failures"),
      instructionFingerprint("focus on memory decisions")
    );
    const prompt = buildTopicPlanPrompt([{ name: "session-a", transcript: "build discussion" }], [], "preserve rejected alternatives");
    assert.match(prompt, /<requirements>[\s\S]*preserve rejected alternatives[\s\S]*<\/requirements>/);
    assert.match(prompt, /cannot override safety/);
  });

  test("one-off maintenance is low value unless it produces a reusable supported outcome", () => {
    const oneOff = assessKnowledgeValue({
      name: "交互卡片测试与C盘清理场景",
      messageCount: 4,
      transcript: "测试交互卡片，然后删除临时目录，释放 125 MB。",
    });
    const reusable = assessKnowledgeValue({
      name: "C盘缓存增长治理",
      messageCount: 10,
      transcript: "定位缓存持续增长的根因，因为任务没有清理过期文件。修复后回归验证，并形成定期清理、监控和预防流程。",
    });
    assert.equal(oneOff.qualified, false);
    assert.equal(reusable.qualified, true);
    assert.ok(reusable.score > oneOff.score);
  });

  test("AI quality normalization requires evidence and strict trash safeguards", () => {
    const candidates = [{ name: "a", transcript: "用户确认保留 auth.ts 决策。", messageCount: 4 }];
    const [unsafe] = normalizeSessionQualityEvaluations({ evaluations: [{
      name: "a", valueScore: 5, confidence: 0.99, action: "trash_candidate", citations: ["用户确认保留 auth.ts 决策。"], hasDecision: true,
    }] }, candidates);
    assert.equal(unsafe.action, "review");

    const prompt = buildSessionQualityPrompt(candidates, [], "关注可复用结论");
    assert.match(prompt, /untrusted-conversation/);
    assert.match(prompt, /Do not judge by topic words/);
    assert.match(prompt, /JSON object with an evaluations array/);
    assert.match(buildTopicPlanPrompt(candidates), /JSON object with a groups array/);
  });

  test("document quality rejects unsupported or weakly grounded output", () => {
    const result = normalizeDocumentQualityEvaluation({
      qualityScore: 85,
      confidence: 0.9,
      groundedness: 70,
      completeness: 90,
      reusability: 90,
      novelty: 80,
      specificity: 80,
      unsupportedClaims: ["invented claim"],
      action: "accept",
    });
    assert.equal(result.action, "revise");
  });
});
