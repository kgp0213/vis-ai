import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  classifyPromptOptimizationDraft,
  createPromptOptimizationScope,
  promptOptimizationButtonDisabled,
  promptOptimizationResponseIsCurrent,
} from "../visionox-pkg/dashboard/src/lib/prompt-optimization.ts";

const dashboardSourceRoot = new URL("../visionox-pkg/dashboard/src/", import.meta.url);
const chatSource = readFileSync(new URL("panels/chat.ts", dashboardSourceRoot), "utf8");
const cssSource = readFileSync(new URL("../visionox-pkg/dashboard/src/app.css", import.meta.url), "utf8");

describe("Dashboard prompt optimization", () => {
  test("classifies registered slash commands and leading Skill prefixes", () => {
    const commands = [{ cmd: "new" }, { cmd: "help", aliases: ["?"] }];
    assert.equal(classifyPromptOptimizationDraft("/new", commands).kind, "command");
    assert.equal(classifyPromptOptimizationDraft("/?", commands).kind, "command");
    assert.equal(classifyPromptOptimizationDraft("/unknown", commands).kind, "prompt");
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
    const response = { requestId: "request-1", draftRevision: 3 };
    const current = {
      draftRevision: 3,
      original: "  optimize me  ",
      sessionId: "session-a",
      workspace: "C:\\work-a",
      mode: "general",
    };
    assert.equal(promptOptimizationResponseIsCurrent(response, scope, current), true);
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

  test("coordinates one request, cancellation and preview without submitting", () => {
    assert.match(chatSource, /const promptOptimizationInFlightRef = A2\(null\)/);
    assert.match(chatSource, /const promptDraftRevisionRef = A2\(0\)/);
    assert.match(chatSource, /promptDraftRevisionRef\.current \+= 1/);
    assert.match(chatSource, /api\(`\/optimize-prompt\/\$\{encodeURIComponent\(flight\.requestId\)\}`,[\s\S]{0,160}method: "DELETE"/u);
    assert.match(chatSource, /flight\.cancelPromise\s*=\s*api\(`\/optimize-prompt/u);
    assert.match(chatSource, /result\?\.cancelled\s*!==\s*true/u);
    assert.match(chatSource, /catch\(\(error\) => \{[\s\S]{0,360}flight\.cancelPromise = null/u);
    assert.match(chatSource, /promptOptimizationResponseIsCurrent\(/);
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
