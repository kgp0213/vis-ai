import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardAppUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const dashboardCssUrl = new URL("../visionox-pkg/dashboard/app.css", import.meta.url);
const dashboardIndexUrl = new URL("../visionox-pkg/dashboard/index.html", import.meta.url);

describe("Dashboard desktop UX", () => {
  test("groups providers into a cascading model menu with import on the chat surface", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    assert.match(app, /function providerDisplayGroups\(providers\)/);
    assert.match(app, /provider\?\.ui\?\.groupId/);
    assert.doesNotMatch(app, /const \[modelSearch, setModelSearch\]/);
    assert.match(app, /const \[openModelGroupId, setOpenModelGroupId\] = d2\(null\)/);
    assert.match(app, /class=\$\{`model-provider-trigger/);
    assert.match(app, /class="model-cascade-submenu"/);
    assert.match(app, /onMouseEnter=\$\{\(\) => openModelGroup\(group\.id\)\}/);
    assert.match(app, /onMouseLeave=\$\{scheduleModelGroupClose\}/);
    assert.match(app, /setTimeout\(\(\) => setOpenModelGroupId\(null\), 180\)/);
    assert.match(app, /selectProviderModel\(provider\.id, model\.id\)/);
    assert.match(app, /activeModelEfforts/);
    assert.match(app, /reasoningEffortLabel/);
    assert.doesNotMatch(app, /由导入 JSON 固定/);
    assert.match(app, /id="provider-import-file"/);
    assert.doesNotMatch(app, /class="model-search"/);
    assert.match(app, /检测全部模型/);
    assert.match(app, /删除检测失败模型/);
    assert.doesNotMatch(app.slice(app.indexOf("function ChatPanel("), app.indexOf("var ChatFeed =")), /model-manage-link|>模型管理</);
  });

  test("keeps generated Markdown inside the app preview instead of launching a system reader", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    assert.match(app, /Markdown artifacts are preview-only/);
    assert.match(app, /var ARTIFACT_OPEN_EXTS = .*"html"/);
    assert.doesNotMatch(app, /var ARTIFACT_OPEN_EXTS = .*"md"/);
  });

  test("keeps artifact viewing reversible and confirms before leaving the conversation", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const css = readFileSync(dashboardCssUrl, "utf8");
    const artifactActions = app.slice(app.indexOf("function showArtifactPreview("), app.indexOf("document.addEventListener(\"click\", handleArtifactAction)"));
    const fileArtifacts = app.slice(app.indexOf("function FileArtifactsCard("), app.indexOf("function ChatPanel("));

    assert.match(artifactActions, /返回对话/);
    assert.match(app, /document\.addEventListener\("keydown", \(ev\) => \{[\s\S]*?ev\.key === "Escape"[\s\S]*?closeArtifactPreview/);
    assert.match(artifactActions, /ev\.target === backdrop/);
    assert.match(artifactActions, /function confirmExternalArtifactOpen\(artifact\)/);
    assert.match(artifactActions, /await confirmExternalArtifactOpen\(artifact\)/);
    assert.match(fileArtifacts, /await confirmExternalArtifactOpen\(file\)/);
    assert.match(css, /\.artifact-open-confirmation/);
    assert.match(css, /\.artifact-preview-close[\s\S]*?min-width:\s*96px/);
  });

  test("collapses completed reasoning while keeping a compact live tail", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const css = readFileSync(dashboardCssUrl, "utf8");
    const chatMessage = app.slice(app.indexOf("var ChatMessage ="), app.indexOf("function ModalCard("));
    const chatPanel = app.slice(app.indexOf("function ChatPanel("), app.indexOf("var ChatFeed ="));
    const chatFeed = app.slice(app.indexOf("var ChatFeed ="), app.indexOf("var SideRail ="));
    const composerControls = chatPanel.slice(chatPanel.indexOf('<div class="composer-controls">'), chatPanel.indexOf('<div class="chat-input-actions">'));
    const inputActions = chatPanel.slice(chatPanel.indexOf('<div class="chat-input-actions">'), chatPanel.indexOf('<${InFlightRow}'));

    assert.match(chatMessage, /reasoningExpanded = false/);
    assert.match(chatMessage, /reasoning-live-tail/);
    assert.match(chatMessage, /node\.scrollTop = node\.scrollHeight/);
    assert.match(chatMessage, /reasoning-details/);
    assert.match(chatMessage, /reasoning-summary/);
    assert.match(chatMessage, /setReasoningOpen/);
    assert.doesNotMatch(chatMessage, /reasoningHidden/);
    assert.match(chatPanel, /const \[reasoningExpanded\] = d2\(\(\) =>/);
    assert.match(chatPanel, /visionox-reasoning-display/);
    assert.match(chatPanel, /const completedStream = streamBufRef\.current/);
    assert.match(chatPanel, /reasoning: dash\.reasoning \?\? completedStream\?\.reasoning/);
    assert.match(composerControls, /class="image-upload-btn"[\s\S]*?class="composer-chip prompt-optimize-chip"/);
    assert.match(composerControls, /promptOptimizing/);
    assert.match(composerControls, /优化提示词/);
    assert.match(composerControls, /不会自动发送/);
    assert.doesNotMatch(inputActions, /reasoningExpanded|折叠思考|展开思考|reasoning-cleanup-chip|prompt-optimize-chip/);
    assert.doesNotMatch(chatPanel, /toggleReasoningDisplay|setReasoningExpanded/);
    assert.doesNotMatch(chatPanel, /reasoningCleaned|setReasoningCleaned/);
    assert.doesNotMatch(chatPanel, /整理对话[\s\S]{0,300}refetchCanonicalState/);
    assert.match(chatFeed, /reasoningExpanded=\$\{reasoningExpanded\}/);
    assert.match(css, /\.reasoning-live-tail\s*\{[\s\S]*?max-height:/);
    assert.match(css, /\.reasoning-live-tail\s*\{[\s\S]*?overflow-y:\s*auto/);
    assert.match(css, /\.reasoning-details\s*\{/);
    assert.match(css, /\.reasoning-summary\s*\{/);
    assert.match(css, /\.reasoning-summary:focus-visible\s*\{/);
  });

  test("renders context-input intervention cards with an explicit status and recommendation", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const css = readFileSync(dashboardCssUrl, "utf8");
    assert.match(app, /const contextInput = modal\.contextInput/);
    assert.match(app, /当前任务已暂停/);
    assert.match(app, /contextInput\.recommendation/);
    assert.match(app, /modal-context-status/);
    assert.match(css, /\.modal-context-alert/);
    assert.match(css, /\.modal-context-recommendation/);
  });

  test("keeps existing entry points while improving semantics, themes and composer hierarchy", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const css = readFileSync(dashboardCssUrl, "utf8");
    const chatPanel = app.slice(app.indexOf("function ChatPanel("), app.indexOf("var ChatFeed ="));
    const sessionsPanel = app.slice(app.indexOf("function SessionsPanel("), app.indexOf("// dashboard/src/lib/loop-control.ts"));
    const memoryPanel = app.slice(app.indexOf("function MemoryPanel("), app.indexOf("// dashboard/src/lib/budget.ts"));
    const settingsPanel = app.slice(app.indexOf("function SettingsPanel("), app.indexOf("// dashboard/src/panels/skills.ts"));
    const appShell = app.slice(app.indexOf("function App("));

    assert.match(appShell, /localStorage\.getItem\("rx\.openSections"\)/);
    assert.match(appShell, /localStorage\.setItem\("rx\.openSections"/);
    assert.match(appShell, /<button type="button" class="side-section side-section-toggle" aria-expanded=/);
    assert.match(appShell, /aria-current=\$\{tab\.id === active\.id \? "page" : null\}/);
    assert.match(appShell, /aria-label=\$\{sidebarCollapsed/);
    assert.match(appShell, /<span class="session">维信诺协同办公平台<\/span>/);
    assert.doesNotMatch(appShell, /color:#1a3a5c/);

    assert.match(chatPanel, /<div class="composer-controls">/);
    assert.match(chatPanel, /class="composer-chip composer-index"/);
    assert.match(chatPanel, /class=\$\{`model-choice/);
    assert.match(chatPanel, /class="model-cascade-menu"/);
    assert.match(chatPanel, /class="model-test-link"/);
    assert.match(chatPanel, /class="model-cleanup-link"/);
    assert.match(chatPanel, /id="provider-import-file"/);
    assert.doesNotMatch(settingsPanel, /id="settings-provider-import-file"/);
    assert.doesNotMatch(chatPanel, /rgb\(138,170,122\)/);
    assert.match(sessionsPanel, /<input class="session-select-box" type="checkbox"/);
    assert.match(memoryPanel, /const \[createOpen, setCreateOpen\] = d2\(false\)/);
    assert.match(memoryPanel, /createOpen \? html4`<div class="memory-create-panel">/);
    assert.match(memoryPanel, /aria-expanded=\$\{createOpen\}/);

    assert.match(css, /button:where\(:not\(\.primary\)/);
    assert.match(css, /\.chat-input-area textarea\s*\{[\s\S]*?font-family:\s*var\(--font-sans\)/);
    assert.match(css, /\.composer-chip\s*\{[\s\S]*?min-height:\s*30px/);
    assert.match(css, /\.model-choice\.active,[\s\S]*?background:\s*var\(--accent-primary\)/);
    assert.match(css, /scrollbar-gutter:\s*stable/);
    assert.match(css, /\.session-batch-bar\s*\{[\s\S]*?box-shadow:/);
  });

  test("uses light for first run without overriding a stored theme", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const index = readFileSync(dashboardIndexUrl, "utf8");

    assert.match(index, /<html lang="en" data-theme="light">/);
    assert.ok(index.indexOf("window.location.search.match") < index.indexOf("document.cookie.match"));
    assert.ok(index.indexOf("document.cookie.match") < index.indexOf("localStorage.getItem('visionox-theme')"));
    assert.match(index, /test\(t\)\) t = 'light'/);
    assert.doesNotMatch(index, /test\(t\)\) t = 'dark'/);
    assert.match(app, /getAttribute\("data-theme"\)\) \|\| "light"/);
  });
});
