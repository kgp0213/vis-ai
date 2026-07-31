import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardAppUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const dashboardCssUrl = new URL("../visionox-pkg/dashboard/app.css", import.meta.url);
const dashboardIndexUrl = new URL("../visionox-pkg/dashboard/index.html", import.meta.url);
const dashboardSourceRootUrl = new URL("../visionox-pkg/dashboard/src/", import.meta.url);

describe("Dashboard desktop UX", () => {
  test("keeps memoized chat/session projections wired to useMemo, not portals", () => {
    const chat = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");
    const sessions = readFileSync(new URL("panels/sessions.ts", dashboardSourceRootUrl), "utf8");
    for (const source of [chat, sessions]) {
      assert.match(source, /useMemo as T2/);
      assert.doesNotMatch(source, /createPortal as T2/);
    }
    assert.match(sessions, /const detailChatMessages = T2\(\(\) =>/);
    assert.match(sessions, /const transcriptMatches = T2\(\(\) =>/);
  });

  test("shows redacted provider diagnostics in the existing settings surface", () => {
    const settings = readFileSync(new URL("panels/settings.ts", dashboardSourceRootUrl), "utf8");
    assert.match(settings, /api\("\/providers\/diagnostics"\)/);
    assert.match(settings, /providerDiagnostics/);
    assert.match(settings, /effectiveBaseUrl/);
    assert.match(settings, /configuredApiKeyPresent/);
    assert.match(settings, /changedOutsideManagedFlow/);
    assert.doesNotMatch(settings, /diagnostic\.apiKey\b/);
  });

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
    const markdown = readFileSync(new URL("lib/markdown.ts", dashboardSourceRootUrl), "utf8");
    assert.match(markdown, /Markdown artifacts are preview-only/);
    assert.match(markdown, /var ARTIFACT_OPEN_EXTS = .*"html"/);
    assert.doesNotMatch(markdown, /var ARTIFACT_OPEN_EXTS = .*"md"/);
    assert.match(markdown, /function knownHighlightLanguage\(raw\)/);
    assert.doesNotMatch(markdown, /const safeLang = lang && hljs\?\.getLanguage/);
  });

  test("keeps artifact viewing reversible and confirms before leaving the conversation", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const css = readFileSync(dashboardCssUrl, "utf8");
    const artifactActions = app.slice(app.indexOf("function showArtifactPreview("), app.indexOf("document.addEventListener(\"click\", handleArtifactAction)"));
    const fileArtifacts = app.slice(app.indexOf("function FileArtifactsCard("), app.indexOf("function ChatPanel("));

    assert.match(artifactActions, /t4\("mdArt\.backToChat"\)/);
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
    const composerBar = chatPanel.slice(chatPanel.indexOf('<div class="composer-bar">'), chatPanel.indexOf('<${InFlightRow}'));

    assert.match(chatMessage, /reasoningExpanded = false/);
    assert.match(chatMessage, /reasoningDisplay = "live"/);
    assert.match(chatMessage, /reasoning-live-tail/);
    assert.match(chatMessage, /reasoning-live-header/);
    assert.match(chatMessage, /node\.scrollTop = node\.scrollHeight/);
    assert.match(chatMessage, /reasoning-details/);
    assert.match(chatMessage, /reasoning-summary/);
    assert.match(chatMessage, /setReasoningOpen/);
    assert.match(chatMessage, /liveReasoningText/);
    assert.match(chatMessage, /t4\("chat\.reasoningTurnsPrefix", \{ n: msg\.reasoningTurns \}\)/);
    assert.match(chatMessage, /t4\("chat\.reasoningTurnLive", \{ n: msg\.reasoningTurns \}\)/);
    assert.doesNotMatch(chatMessage, /reasoningHidden/);
    assert.match(chatPanel, /const \[reasoningDisplay, setReasoningDisplay\] = d2\(\(\) =>/);
    assert.match(chatPanel, /const reasoningExpanded = reasoningDisplay === "expanded"/);
    assert.match(chatPanel, /visionox-reasoning-display/);
    assert.match(chatPanel, /t4\("chat\.reasoningDisplayLabel"\)/);
    assert.match(chatPanel, /turnReasoning/);
    assert.match(chatPanel, /reasoningStale/);
    assert.match(chatPanel, /reasoningTurns: completedStream\?\.reasoningTurns > 1/);
    assert.match(chatPanel, /const completedStream = streamBufRef\.current/);
    assert.match(chatPanel, /reasoning: projectedMessage\.reasoning \?\? completedStream\?\.reasoning/);
    assert.match(composerBar, /class="composer-plus"/);
    assert.match(composerBar, /composer-plus-menu/);
    assert.match(composerBar, /promptOptimizing/);
    assert.match(composerBar, /t4\("chat\.optimizeInputTitle"\)/);
    assert.doesNotMatch(composerBar, /reasoningExpanded|折叠思考|展开思考|reasoning-cleanup-chip|prompt-optimize-chip/);
    assert.doesNotMatch(chatPanel, /toggleReasoningDisplay|setReasoningExpanded/);
    assert.doesNotMatch(chatPanel, /reasoningCleaned|setReasoningCleaned/);
    assert.doesNotMatch(chatPanel, /整理对话[\s\S]{0,300}refetchCanonicalState/);
    assert.match(chatFeed, /reasoningExpanded=\$\{reasoningExpanded\}/);
    assert.match(chatFeed, /reasoningDisplay=\$\{reasoningDisplay\}/);
    assert.match(css, /\.reasoning-live-header\s*\{/);
    assert.match(css, /\.reasoning-live-tail\s*\{[\s\S]*?max-height:/);
    assert.match(css, /\.reasoning-live-tail\s*\{[\s\S]*?overflow-y:\s*auto/);
    assert.match(css, /\.reasoning-details\s*\{/);
    assert.match(css, /\.reasoning-summary\s*\{/);
    assert.match(css, /\.reasoning-summary:focus-visible\s*\{/);
  });

  test("routes the active event before advancing its reducer cursor and fences foreign sessions", () => {
    const chat = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");
    const start = chat.indexOf("const routeDashboardEvent = (dash) => {");
    const end = chat.indexOf("const replayBufferedDashboardEvents", start);
    assert.ok(start >= 0 && end > start, "Dashboard event route must remain discoverable");
    const route = chat.slice(start, end);
    const scopeCheck = route.indexOf("eventSessionId && activeSessionId && eventSessionId !== activeSessionId");
    const enqueue = route.indexOf("eventBatcher.enqueue(dash)");
    assert.ok(scopeCheck >= 0 && enqueue > scopeCheck, "foreign-session routing must precede active projection");
    assert.match(route, /if \(eventSessionId && activeSessionId && eventSessionId !== activeSessionId\) \{[\s\S]{0,240}eventBatcher\.flush\(\);[\s\S]{0,320}lastSeq:\s*observed\.cursor\.lastSeq[\s\S]{0,160}return;/u);
    assert.doesNotMatch(route.slice(0, scopeCheck), /executionStateRef\.current\s*=\s*createDashboardReducerState/u);
  });

  test("collapses long tool outputs while keeping live progress visible", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const css = readFileSync(dashboardCssUrl, "utf8");
    const chatPanel = app.slice(app.indexOf("function ChatPanel("), app.indexOf("var ChatFeed ="));

    // 长输出默认折叠为摘要行，短输出仍直接展示
    assert.match(app, /TOOL_OUTPUT_COLLAPSE_CHARS = 200/);
    assert.match(app, /TOOL_OUTPUT_COLLAPSE_LINES = 4/);
    assert.match(app, /function shouldCollapseToolOutput\(text\)/);
    assert.match(app, /function renderCollapsibleToolOutput\(text, kind = "pre", lang = ""\)/);
    assert.match(app, /details class="tool-card-collapse"/);
    assert.match(app, /t4\("chat\.toolOutputCollapsed", \{ lines: stats\.lines\.toLocaleString\(\), chars: stats\.chars\.toLocaleString\(\) \}\)/);
    assert.match(app, /\$\{renderCollapsibleToolOutput\(msg\.text\)\}/);
    assert.match(css, /\.tool-card-collapse\s*\{/);
    assert.match(css, /\.tool-card-collapse summary\s*\{/);

    // 任务进行中保留进度感：已完成步数随工具完成递增，新任务清零
    assert.match(chatPanel, /const \[completedSteps, setCompletedSteps\] = d2\(0\)/);
    assert.match(chatPanel, /setCompletedSteps\(\(count\) => count \+ 1\)/);
    assert.match(chatPanel, /setCompletedSteps\(0\)/);
    assert.match(app, /completedSteps=\$\{completedSteps\}/);
    assert.match(app, /t4\("chat\.inflightSteps", \{ count: completedSteps\.toLocaleString\(\) \}\)/);

    // 连续工具调用降级为一行淡灰日志（无卡片边框）：任务中原地更新进度，结束后落地为摘要
    assert.match(app, /function ToolGroup\(/);
    assert.match(app, /tool-log-running/);
    assert.match(app, /tool-log-row/);
    assert.match(app, /tool-log-name/);
    assert.match(app, /tool-log-icon-failed/);
    assert.match(app, /tool-log-detail/);
    assert.match(app, /t4\("chat\.toolUsingLiveStep", \{ n: doneItems\.length \+ \(currentTool \? 1 : 0\) \}\)/);
    assert.match(app, /t4\("chat\.toolUsedCount", \{ count: items\.length \}\)/);
    assert.match(app, /t4\("chat\.toolFailedCountSuffix", \{ count: failedItems\.length \}\)/);
    assert.match(app, /kind: "toolGroup"/);
    assert.match(app, /taskActive = false/);
    assert.match(chatPanel, /taskActive=\$\{busy\}/);
    assert.match(css, /\.tool-log\s*\{/);
    assert.match(css, /\.tool-log-row\s*\{/);
    assert.match(css, /\.tool-log-spinner\s*\{/);
    assert.match(css, /@keyframes toolLogSpin/);
    assert.doesNotMatch(css, /\.tool-group\s*\{|@keyframes toolCardIn/);

    // 对话框右键菜单：局部刷新对话（不重载整页）+ 工作步骤折叠控制
    assert.match(chatPanel, /addEventListener\("contextmenu", onContextMenu\)/);
    assert.match(chatPanel, /class="chat-feed-menu"/);
    assert.match(chatPanel, /t4\("chat\.feedRefresh"\)/);
    assert.match(chatPanel, /t4\("chat\.feedExpandAll"\)/);
    assert.match(chatPanel, /t4\("chat\.feedCollapseAll"\)/);
    assert.match(chatPanel, /feedMenuAction\(\(\) => \{\s*followBottom\(\);?\s*void resyncRunnerRef\.current\?\.\(\);?\s*\}\)/);
    assert.match(chatPanel, /details\.tool-log/);

    // Switching to the background workbench must remove the chat-only context menu.
    assert.match(chatPanel, /setShowBackgroundJobs\(true\);\s*setFeedMenu\(null\);/);
    assert.match(chatPanel, /\$\{!showBackgroundJobs && feedMenu \?/);

    // 跟随加固与新消息提示：内容增长即钉底，脱钩时给出回底入口
    assert.match(chatPanel, /const \[hasNewBelow, setHasNewBelow\] = d2\(false\)/);
    assert.match(chatPanel, /class="chat-new-messages-pill"/);
    assert.match(chatPanel, /t4\("chat\.newMessagesBelowCount"/);
    assert.doesNotMatch(chatPanel, /new MutationObserver/);
    assert.match(chatPanel, /requestAnimationFrame/);
    assert.match(css, /\.chat-new-messages-pill\s*\{/);
    assert.match(css, /\.chat-feed-menu\s*\{/);
  });

  test("guards Dashboard events with stable ids and terminal tool state", () => {
    const source = readFileSync(new URL("lib/event-reducer.ts", dashboardSourceRootUrl), "utf8");
    const app = readFileSync(dashboardAppUrl, "utf8");
    assert.match(source, /createDashboardEventGuard/);
    assert.match(source, /event\.eventId/);
    assert.match(source, /terminalTools/);
    assert.match(source, /terminalMessages = new Map/);
    assert.match(source, /event\.correction/);
    assert.match(source, /messages-reset/);
    assert.match(app, /createDashboardEventGuard\(\)/);
    assert.match(app, /eventGuardRef\.current\?\.accept\(dash\)/);
  });

  test("renders durable Dashboard entities from the shared reducer projection", () => {
    const chatSource = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");
    const changesSource = readFileSync(new URL("panels/changes.ts", dashboardSourceRootUrl), "utf8");
    assert.match(chatSource, /setBusy\(reduced\.state\.busy\)/);
    assert.match(chatSource, /setOperation\(reduced\.state\.operation\)/);
    assert.match(chatSource, /const projectedMessage = reduced\.state\.messages/);
    assert.match(chatSource, /const projectedTool = Object\.values\(reduced\.state\.tools\)/);
    assert.match(chatSource, /setActivePlan\(reduced\.state\.plan\)/);
    assert.doesNotMatch(chatSource, /setBusy\(dash\.busy\)/);
    assert.doesNotMatch(chatSource, /setOperation\(dash\.operation/);
    assert.match(changesSource, /createDashboardReducerStateFromSnapshot/);
    assert.match(changesSource, /setBusy\(reduced\.state\.busy\)/);
    assert.match(changesSource, /const projectedMessage = reduced\.state\.messages/);
    assert.doesNotMatch(changesSource, /setBusy\(dash\.busy\)/);
  });

  test("hydrates terminal tools, preserves canonical pagination, and isolates Changes events by session", () => {
    const chatSource = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");
    const changesSource = readFileSync(new URL("panels/changes.ts", dashboardSourceRootUrl), "utf8");
    assert.match(chatSource, /projectChatTimeline/);
    assert.match(chatSource, /canonicalMessageCountRef\.current = page\.loadedCount/);
    assert.match(chatSource, /canonicalMessageCount=\$\{canonicalMessageCountRef\.current\}/);
    assert.match(chatSource, /totalMessages - canonicalMessageCount/);
    assert.match(changesSource, /const activeSessionIdRef = A2\(null\)/);
    assert.match(changesSource, /dashSessionId && activeSessionId && dashSessionId !== activeSessionId/);
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

  test("replays sequenced Dashboard events and buffers updates during canonical resync", () => {
    const pollSource = readFileSync(new URL("lib/use-poll.ts", dashboardSourceRootUrl), "utf8");
    const chatSource = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");

    assert.match(pollSource, /sseLastCursor/);
    assert.match(pollSource, /url\.searchParams\.set\("cursor", sseLastCursor\)/);
    assert.match(pollSource, /event\.lastEventId/);
    assert.match(chatSource, /resyncingEventsRef/);
    assert.match(chatSource, /bufferedDashboardEventsRef/);
    assert.match(chatSource, /dash\.kind === "resync-required"/);
    assert.match(chatSource, /eventBatcherRef\.current\?\.discard\(\)/);
    assert.match(chatSource, /executionStateRef\.current = createDashboardReducerState\(\)/);
    assert.match(chatSource, /eventSessionId/);
    assert.match(chatSource, /const activeSessionId = String\(activeConversationIdRef\.current \|\| snapshotSessionIdRef\.current \|\| ""\)/);
    assert.match(chatSource, /eventSessionId && activeSessionId/);
  });

  test("tracks the global event cursor before session filtering and buffers initial hydration", () => {
    const chatSource = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");
    const routing = chatSource.slice(chatSource.indexOf("const routeDashboardEvent = (dash) =>"), chatSource.indexOf("const unsubscribe = subscribeSse", chatSource.indexOf("const routeDashboardEvent = (dash) =>")));

    assert.match(chatSource, /const globalEventCursorRef = A2/);
    assert.match(chatSource, /const snapshotSessionIdRef = A2\(null\)/);
    assert.match(chatSource, /const snapshotHydratingRef = A2\(true\)/);
    assert.match(chatSource, /dashboardEventsAfterCursor/);
    assert.match(routing, /observeDashboardEventCursor/);
    assert.match(routing, /snapshotHydratingRef\.current/);
    assert.ok(routing.indexOf("observeDashboardEventCursor") < routing.indexOf("eventSessionId && activeSessionId"));
    assert.match(chatSource, /const canonicalProjectionGenerationRef = A2\(0\)/);
    assert.match(chatSource, /dashboardSnapshotResponseIsCurrent/);
    assert.match(chatSource, /const requestGeneration = canonicalProjectionGenerationRef\.current/);
  });

  test("renders streaming text from the offset-aware reducer projection", () => {
    const chatSource = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");
    const deltaHandler = chatSource.slice(
      chatSource.indexOf('if (dash.kind === "assistant_delta")'),
      chatSource.indexOf('if (dash.kind === "assistant_content_final"'),
    );
    assert.match(deltaHandler, /const reducedStream = reduced\.state\.streamOffsets/);
    assert.match(deltaHandler, /reducedStream\?\.contentText/);
    assert.match(deltaHandler, /reducedStream\?\.reasoningText/);
  });

  test("uses SessionSnapshot messagePage for both initial hydration and older history", () => {
    const chatSource = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");
    assert.match(chatSource, /projectDashboardMessagePage/);
    assert.match(chatSource, /canonicalMessageCountRef\.current = page\.loadedCount/);
    assert.match(chatSource, /mergeDashboardMessagePages\(earlier, current\)/);
    assert.doesNotMatch(chatSource, /canonicalMessageCountRef\.current \+= earlier\.length/);
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
    assert.match(appShell, /<span class="session">\$\{t4\("appPanel\.oaPlatform"\)\}<\/span>/);
    assert.doesNotMatch(appShell, /color:#1a3a5c/);

    assert.match(chatPanel, /<div class="composer-box">/);
    assert.match(chatPanel, /<div class="composer-bar">/);
    assert.match(chatPanel, /class="composer-plus"/);
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
    assert.match(css, /\.composer-box\s*\{/);
    assert.match(css, /\.composer-bar\s*\{/);
    assert.match(css, /\.composer-plus\s*\{/);
    assert.match(css, /\.composer-send\s*\{[\s\S]*?border-radius:\s*999px/);
    assert.match(css, /\.composer-send-square\s*\{/);

    // 多主题可见性：发送钮悬停切换到 accent-hover 实底（深色下不再只剩亮度滤镜），
    // 幽灵 chip / 优化按钮悬停使用 surface-overlay token，随主题自动适配
    assert.match(css, /\.composer-send:hover:not\(:disabled\)\s*\{[\s\S]*?background:\s*var\(--accent-primary-hover\)/);
    assert.match(css, /\.composer-send:hover:not\(:disabled\)\s*\{[\s\S]*?color:\s*var\(--accent-hover-contrast/);
    assert.match(css, /\.composer-chip-ghost:hover\s*\{[\s\S]*?var\(--surface-overlay\)/);
    assert.match(css, /\.composer-optimize:hover:not\(:disabled\)\s*\{[\s\S]*?var\(--surface-overlay\)/);

    // 状态行右端「新建」按钮：右对齐落在发送钮正下方，悬停走 token 底色
    assert.match(css, /\.status-new-btn\s*\{[\s\S]*?margin-left:\s*auto/);
    assert.match(css, /\.status-new-btn:hover\s*\{[\s\S]*?var\(--surface-overlay\)/);

    // 输入框融入胶囊容器：textarea 自身无边框无底色，聚焦也不描边（去"框中框"）
    assert.match(css, /\.chat-input-area \.composer-box textarea\s*\{[\s\S]*?border:\s*(?:0|none)/);
    assert.match(css, /\.chat-input-area \.composer-box textarea:focus\s*\{[\s\S]*?outline:\s*none/);
    assert.match(css, /\.model-choice\.active,[\s\S]*?background:\s*var\(--accent-primary\)/);
    assert.match(css, /scrollbar-gutter:\s*stable/);
    assert.match(css, /\.session-batch-bar\s*\{[\s\S]*?box-shadow:/);
  });

  test("morphs the circular send button across idle, stop and queue modes with steering on queued cards", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const chatPanel = app.slice(app.indexOf("function ChatPanel("), app.indexOf("var ChatFeed ="));

    // 圆形发送钮状态机：空闲发送 / 忙碌空输入停止 / 忙碌有输入排队，均有悬停提示
    assert.match(chatPanel, /composer-send composer-send-\$\{sendMode\}/);
    assert.match(chatPanel, /t4\("chat\.sendSend"\)/);
    assert.match(chatPanel, /t4\("chat\.sendStop"\)/);
    assert.match(chatPanel, /t4\("chat\.sendQueue"\)/);
    assert.match(chatPanel, /t4\("chat\.sendIdle"\)/);
    assert.match(chatPanel, /composer-send-square/);
    assert.match(chatPanel, /if \(sendMode === "stop"\) void abort\(\);\s*else void send\(\);/);

    // 底栏幽灵 chip：模型 / 工作空间 / 后台 / 索引（索引 chip 直接显示当前模式，弹出模式弹层）
    assert.match(chatPanel, /composer-chip-ghost/);
    assert.match(chatPanel, /t4\("chat\.modelAndEffortTitle"\)/);
    assert.match(chatPanel, /showIndexPicker/);
    assert.match(chatPanel, /changeIndexRetrievalMode\(\{ target: \{ value: mode2? \} \}\)/);

    // 「+」菜单只保留上传入口；优化提示词独立为发送钮左侧按钮
    assert.match(chatPanel, /composer-plus-menu/);
    assert.match(chatPanel, /t4\("chat\.addImageOrVideo"\)/);
    assert.match(chatPanel, /Ctrl\+U/);
    assert.match(chatPanel, /composer-optimize/);

    // 状态行右端「新建对话」按钮：发送钮正下方的常显入口，沿用 newConversation 的忙碌确认防护；
    // 任务忙碌时隐藏，右端只留 InFlightRow 的停止按钮
    assert.match(chatPanel, /onNew=\$\{newConversation\} busy=\$\{busy\}/);
    assert.match(app, /class="status-new-btn"/);
    assert.match(app, /onNew && !busy \? html4`<button type="button" class="status-new-btn"/);

    // 排队卡片：引导（steering 注入当前任务）、编辑取回、删除
    assert.match(chatPanel, /steerQueuedPrompt/);
    assert.match(chatPanel, /\/steer`, \{ method: "POST"/);
    assert.match(chatPanel, /chat-queue-guide/);
    assert.match(chatPanel, /editQueuedPrompt/);
    assert.match(chatPanel, /queueGuideFailed/);
    assert.match(chatPanel, /queueGuided/);

    // 新对话与清空移入对话右键菜单，输入区不再保留旧按钮排
    assert.match(chatPanel, /feedMenuAction\(\(\) => \{\s*void newConversation\(\);?\s*\}\)/);
    assert.match(chatPanel, /feedMenuAction\(\(\) => \{\s*void clearScrollback\(\);?\s*\}\)/);
    assert.doesNotMatch(chatPanel, /chat-input-actions|image-upload-btn|prompt-optimize-chip|composer-controls/);
  });

  test("uses light for first run without overriding a stored theme", () => {
    const app = readFileSync(new URL("app.ts", dashboardSourceRootUrl), "utf8");
    const index = readFileSync(dashboardIndexUrl, "utf8");

    assert.match(index, /<html lang="en" data-theme="light">/);
    assert.ok(index.indexOf("window.location.search.match") < index.indexOf("document.cookie.match"));
    assert.ok(index.indexOf("document.cookie.match") < index.indexOf("localStorage.getItem('visionox-theme')"));
    assert.match(index, /test\(t\)\) t = 'light'/);
    assert.doesNotMatch(index, /test\(t\)\) t = 'dark'/);
    assert.match(app, /getAttribute\("data-theme"\)\) \|\| "light"/);
  });

  test("updates parallel tool progress in place by stable toolCallId", () => {
    const chat = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");
    const internals = readFileSync(new URL("components/chat-internals.ts", dashboardSourceRootUrl), "utf8");
    assert.match(chat, /upsertToolProgress/);
    assert.match(chat, /toolCallId/);
    assert.match(chat, /findIndex\(\(item\) => String\(item\.id/);
    assert.match(chat, /const \[activeTools, setActiveTools\]/);
    assert.doesNotMatch(chat, /const \[activeTool, setActiveTool\]/);
    assert.doesNotMatch(chat, /\bsetActiveTool\s*\(/);
    assert.match(internals, /tool-progress-status/);
  });

  test("deduplicates replayed message events by id and guards send re-entry", () => {
    const chat = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");
    // user 事件：重同步(canonical)与事件流重放可能携带同一条消息，必须按 id
    // 幂等追加（regression：busy-change 先于 user 广播时同一消息渲染两条气泡）。
    const userHandler = chat.slice(chat.indexOf('if (dash.kind === "user")'), chat.indexOf('if (dash.kind === "assistant_delta")'));
    assert.match(userHandler, /prev\.some\(\(item\) => String\(item\.id \|\| ""\) === String\(dash\.id \|\| ""\)\)/);
    assert.match(userHandler, /inserted = true/);
    assert.match(userHandler, /if \(inserted\) \{/);
    assert.doesNotMatch(userHandler, /setMessages\(\(prev\) => \[\.\.\.prev, \{ id: dash\.id, role: "user"/);
    const assistantHandler = chat.slice(chat.indexOf('if (dash.kind === "assistant_content_final"'), chat.indexOf('if (dash.kind === "tool_start")'));
    assert.match(assistantHandler, /if \(!isFinalized\) canonicalMessageCountRef\.current \+= 1/);
    assert.match(assistantHandler, /if \(inserted && !isFinalized\) setTotalMessages/);
    // warning/error/info 事件：同样的幂等守卫。
    const noticeHandler = chat.slice(
      chat.indexOf('if (dash.kind === "warning" || dash.kind === "error" || dash.kind === "info")'),
      chat.indexOf('if (dash.kind === "status")')
    );
    assert.match(noticeHandler, /const projectedMessage = reduced\.state\.messages\[messageId\]/);
    assert.match(noticeHandler, /prev\.some\(\(item\) => String\(item\.id \|\| ""\) === messageId\)/);
    // send()：提交 await 期间的重入守卫（双击/连按回车不得二次提交同一内容）。
    assert.match(chat, /const sendInFlightRef = A2\(false\)/);
    const sendFn = chat.slice(chat.indexOf("const send = q2(async () => {"), chat.indexOf("const saveSkillCredential = q2"));
    assert.match(sendFn, /if \(sendInFlightRef\.current\) return;/);
    assert.match(sendFn, /finally \{\s*sendInFlightRef\.current = false;/);
  });

  test("keeps process cards full height in the flex feed; scroll ownership follows explicit user input only", () => {
    const cssSrc = readFileSync(new URL("app.css", dashboardSourceRootUrl), "utf8");
    const chat = readFileSync(new URL("panels/chat.ts", dashboardSourceRootUrl), "utf8");
    // .chat-feed 是定高纵向 flex 容器；overflow:hidden 的 flex 子项自动最小高度
    // 按 0 计算，缺 flex-shrink:0 时卡片会被收缩成细条（regression：工具卡片
    // 塌缩为 2px，输出内容看似被遮蔽）。
    const processCard = cssSrc.slice(cssSrc.indexOf(".process-card {"), cssSrc.indexOf(".process-card-details"));
    assert.match(processCard, /flex-shrink:\s*0;/);
    assert.match(chat, /const feedMountFrameRef = A2\(null\)/);
    assert.match(chat, /Defer the generation bump until the next paint/);
    assert.match(chat, /requestAnimationFrame\(\(\) => bumpWhenConnected\(2\)\)/);
    // 精简后的滚动模型：onScroll 只做位置记录与顶部加载调度，永不改变跟随状态——
    // 内容高度变化（流式收敛、卡片折叠）产生不了输入事件，因此不可能误判并劫持视口。
    const onScroll = chat.slice(chat.indexOf("const onScroll = () => {"), chat.indexOf("const onWheel = (event) => {"));
    assert.match(onScroll, /lastScrollTopRef\.current = el\.scrollTop;/);
    assert.match(onScroll, /if \(el\.scrollTop <= CHAT_TOP_LOAD_THRESHOLD\) scheduleTopLoadCheck\(\);/);
    assert.doesNotMatch(onScroll, /followingBottomRef\.current =/);
    assert.doesNotMatch(onScroll, /distFromBottom/);
    // 只有用户的原始输入事件能脱离跟随：上滚滚轮、抓滚动条、上翻按键、触摸滑动。
    const onWheel = chat.slice(chat.indexOf("const onWheel = (event) => {"), chat.indexOf("const onPointerDown = (event) => {"));
    assert.match(onWheel, /if \(Number\(event\.deltaY\) < 0\) \{/);
    assert.match(onWheel, /stopFollowing\(\)/);
    const onPointerDown = chat.slice(chat.indexOf("const onPointerDown = (event) => {"), chat.indexOf("const onPointerUp = () => {"));
    assert.match(onPointerDown, /scrollbarDraggingRef\.current = true/);
    assert.match(onPointerDown, /stopFollowing\(\)/);
    assert.match(chat, /const onKeyDown = \(event\) => \{/);
    assert.match(chat, /event\.key === "PageUp"/);
    assert.match(chat, /const onTouchMove = \(\) => stopFollowing\(\)/);
    // 恢复跟随只有显式动作：发送消息、点"回到底部"pill、打开会话。
    assert.match(chat, /const followBottom = q2\(\(\) => \{/);
    assert.match(chat, /followingBottomRef\.current = true/);
    assert.match(chat, /class="chat-new-messages-pill" onClick=\$\{followBottom\}/);
    // 内容增长不再经过多 owner 状态机，收敛为一个纯决策函数。
    assert.match(chat, /computeGrowthEffect\(followingBottomRef\.current, added\)/);
    // 旧的时间窗口猜测逻辑必须彻底删除：钳位免疫、意图宽限期、平滑动画死锁
    // 补丁都不复存在（这些补丁本身就是跳段 bug 的来源）。
    assert.doesNotMatch(chat, /USER_SCROLL_INTENT_GRACE_MS/);
    assert.doesNotMatch(chat, /lastUserScrollIntentAtRef/);
    assert.doesNotMatch(chat, /lastScrollUpIntentAtRef/);
    assert.doesNotMatch(chat, /autoScrollInFlight/);
    assert.doesNotMatch(chat, /topLoadArmedRef/);
    assert.doesNotMatch(chat, /topLoadIntentRef/);
    assert.doesNotMatch(chat, /applyScrollPolicyEvent/);
  });
});
