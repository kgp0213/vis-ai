import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardAppUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const dashboardCssUrl = new URL("../visionox-pkg/dashboard/app.css", import.meta.url);
const dashboardIndexUrl = new URL("../visionox-pkg/dashboard/index.html", import.meta.url);

describe("Dashboard desktop UX", () => {
  test("keeps existing entry points while improving semantics, themes and composer hierarchy", () => {
    const app = readFileSync(dashboardAppUrl, "utf8");
    const css = readFileSync(dashboardCssUrl, "utf8");
    const chatPanel = app.slice(app.indexOf("function ChatPanel()"), app.indexOf("var ChatFeed ="));
    const sessionsPanel = app.slice(app.indexOf("function SessionsPanel()"), app.indexOf("// dashboard/src/lib/loop-control.ts"));
    const memoryPanel = app.slice(app.indexOf("function MemoryPanel()"), app.indexOf("// dashboard/src/lib/budget.ts"));
    const appShell = app.slice(app.indexOf("function App()"));

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
    assert.match(chatPanel, /class="model-primary-action"/);
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
