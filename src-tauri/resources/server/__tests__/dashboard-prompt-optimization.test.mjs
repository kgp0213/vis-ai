import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  classifyPromptOptimizationDraft,
  createPromptOptimizationScope,
  describePromptOptimizationFailure,
  promptOptimizationButtonDisabled,
  promptOptimizationResponseIsCurrent,
} from "../visionox-pkg/dashboard/src/lib/prompt-optimization.ts";
import { en } from "../visionox-pkg/dashboard/src/i18n/en.ts";
import { zhCN } from "../visionox-pkg/dashboard/src/i18n/zh-CN.ts";

const dashboardSourceRoot = new URL("../visionox-pkg/dashboard/src/", import.meta.url);
const chatSource = readFileSync(new URL("panels/chat.ts", dashboardSourceRoot), "utf8");
const cssSource = readFileSync(new URL("../visionox-pkg/dashboard/src/app.css", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("lib/api.ts", dashboardSourceRoot), "utf8");

function translationValue(dictionary, key) {
  return key.split(".").reduce((value, part) => value?.[part], dictionary);
}

describe("Dashboard prompt optimization", () => {
  test("classifies all slash commands and leading Skill prefixes", () => {
    const commands = [{ cmd: "new" }, { cmd: "help", aliases: ["?"] }];
    assert.equal(classifyPromptOptimizationDraft("/new", commands).kind, "command");
    assert.equal(classifyPromptOptimizationDraft("/?", commands).kind, "command");
    assert.equal(classifyPromptOptimizationDraft("/unknown", commands).kind, "command");
    assert.deepEqual(classifyPromptOptimizationDraft("@pdf  转换文件", commands), {
      kind: "skill",
      prefix: "@pdf  ",
      body: "转换文件",
    });
    assert.equal(classifyPromptOptimizationDraft("@pdf   ", commands).kind, "empty_skill");
  });

  test("treats whitespace changes and every scope field as stale", () => {
    const scope = createPromptOptimizationScope({
      requestId: "request-1",
      draftRevision: 3,
      original: "  optimize me  ",
      sessionId: "session-a",
      workspace: "C:\\work-a",
      mode: "general",
    });
    const response = { requestId: "request-1", draftRevision: 3, original: "  optimize me  " };
    const current = {
      draftRevision: 3,
      original: "  optimize me  ",
      sessionId: "session-a",
      workspace: "C:\\work-a",
      mode: "general",
    };
    assert.equal(promptOptimizationResponseIsCurrent(response, scope, current), true);
    assert.equal(promptOptimizationResponseIsCurrent({ ...response, original: "another draft" }, scope, current), false);
    assert.equal(promptOptimizationResponseIsCurrent(response, scope, { ...current, original: "optimize me" }), false);
    assert.equal(promptOptimizationResponseIsCurrent(response, scope, { ...current, draftRevision: 4 }), false);
    assert.equal(promptOptimizationResponseIsCurrent(response, scope, { ...current, sessionId: "session-b" }), false);
    assert.equal(promptOptimizationResponseIsCurrent(response, scope, { ...current, workspace: "C:\\work-b" }), false);
    assert.equal(promptOptimizationResponseIsCurrent(response, scope, { ...current, mode: "coding" }), false);
  });

  test("disables optimization for busy, in-flight, empty, command and empty-Skill drafts", () => {
    const commands = [{ cmd: "new" }];
    const base = { busy: false, inFlight: false, draft: "write a plan", slashCommands: commands };
    assert.equal(promptOptimizationButtonDisabled(base), false);
    assert.equal(promptOptimizationButtonDisabled({ ...base, busy: true }), true);
    assert.equal(promptOptimizationButtonDisabled({ ...base, inFlight: true }), true);
    assert.equal(promptOptimizationButtonDisabled({ ...base, draft: "  " }), true);
    assert.equal(promptOptimizationButtonDisabled({ ...base, draft: "/new" }), true);
    assert.equal(promptOptimizationButtonDisabled({ ...base, draft: "@pdf  " }), true);
  });

  test("maps structured failures to actionable localized messages", () => {
    const cases = [
      [{ code: "prompt_optimization_auth_failed" }, "chat.optimizeAuthFailed", false],
      [{ code: "prompt_optimization_rate_limited" }, "chat.optimizeRateLimited", false],
      [{ code: "prompt_optimization_timeout" }, "chat.optimizeTimedOut", true],
      [{ code: "prompt_optimization_fact_mismatch" }, "chat.optimizeSemanticMismatch", false],
      [{ code: "prompt_optimization_side_effect_mismatch" }, "chat.optimizeSemanticMismatch", false],
      [{ code: "prompt_optimization_language_mismatch" }, "chat.optimizeSemanticMismatch", false],
      [{ code: "prompt_optimization_idempotency_conflict" }, "chat.optimizeConflict", false],
      [{ code: "api_request_timeout", transport: "timeout" }, "chat.optimizeTimedOut", true],
      [{ code: "api_network_error", transport: "network" }, "chat.optimizeNetworkFailed", true],
      [{ code: "prompt_optimization_provider_failed", status: 503 }, "chat.optimizeProviderFailed", false],
    ];
    for (const [error, messageKey, shouldCleanup] of cases) {
      assert.deepEqual(describePromptOptimizationFailure(error), { messageKey, shouldCleanup, cancelled: false });
      assert.equal(typeof translationValue(zhCN, messageKey), "string");
      assert.equal(typeof translationValue(en, messageKey), "string");
    }
    assert.deepEqual(
      describePromptOptimizationFailure({ code: "prompt_optimization_cancelled" }),
      { messageKey: null, shouldCleanup: false, cancelled: true },
    );
    assert.deepEqual(
      describePromptOptimizationFailure({ code: "unrelated" }),
      { messageKey: null, shouldCleanup: false, cancelled: false },
    );
    assert.match(apiSource, /transport\?:\s*"timeout"\s*\|\s*"network"/u);
    assert.match(apiSource, /"api_request_timeout",\s*"timeout"/u);
    assert.match(apiSource, /"api_network_error",\s*"network"/u);
  });

  test("coordinates one request, cancellation and preview without submitting", () => {
    assert.match(chatSource, /const promptOptimizationInFlightRef = A2\(null\)/);
    assert.match(chatSource, /const promptDraftRevisionRef = A2\(0\)/);
    assert.match(chatSource, /promptDraftRevisionRef\.current \+= 1/);
    assert.match(chatSource, /api\(`\/optimize-prompt\/\$\{encodeURIComponent\(requestId\)\}`,[\s\S]{0,160}method: "DELETE"/u);
    assert.match(chatSource, /flight\.cancelPromise\s*=\s*deletePromptOptimizationRequest\(flight\.requestId\)/u);
    assert.match(chatSource, /result\?\.cancelled\s*!==\s*true/u);
    assert.match(chatSource, /catch\(\(error\) => \{[\s\S]{0,360}flight\.cancelPromise = null/u);
    assert.match(chatSource, /promptOptimizationResponseIsCurrent\(/);
    assert.match(chatSource, /api\("\/optimize-prompt",\s*\{[\s\S]{0,220}timeoutMs:\s*135_000/u);
    assert.match(chatSource, /const deletePromptOptimizationRequest[\s\S]{0,320}method: "DELETE"/u);
    assert.match(chatSource, /describePromptOptimizationFailure\(err\)[\s\S]{0,520}failure\.shouldCleanup[\s\S]{0,260}cancelPromptOptimizationRequest\("failed", false\)/u);
    assert.match(chatSource, /const retryPromptOptimizationCleanup[\s\S]{0,420}cancelPromptOptimizationRequest\("failed", false\)/u);
    assert.match(chatSource, /promptOptimization\.status === "cleanup_failed"[\s\S]{0,360}retryPromptOptimizationCleanup/u);
    assert.match(chatSource, /class="prompt-optimization-preview"/);
    assert.match(chatSource, /applyPromptOptimization/);
    assert.match(chatSource, /keepOriginalPrompt/);
    assert.match(chatSource, /restoreOriginalPrompt/);
    const optimizeStart = chatSource.indexOf("const optimizeCurrentPrompt");
    const optimizeEnd = chatSource.indexOf("const refreshBackgroundJobs", optimizeStart);
    assert.ok(optimizeStart >= 0 && optimizeEnd > optimizeStart);
    assert.doesNotMatch(chatSource.slice(optimizeStart, optimizeEnd), /submitPrompt|messages|setMessages/);
    const sendStart = chatSource.indexOf("const send = q2(async () => {");
    const sendEnd = chatSource.indexOf("const saveSkillCredential", sendStart);
    const send = chatSource.slice(sendStart, sendEnd);
    assert.match(send, /await cancelPromptOptimizationRequest\("cancelled"\)/);
    assert.match(send, /setPromptOptimizationRestore\(null\)/);
  });

  test("renders a stable preview surface", () => {
    assert.match(cssSource, /\.prompt-optimization-preview\s*\{/);
    assert.match(cssSource, /\.prompt-optimization-columns\s*\{/);
    assert.match(cssSource, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.prompt-optimization-columns/u);
  });
});
