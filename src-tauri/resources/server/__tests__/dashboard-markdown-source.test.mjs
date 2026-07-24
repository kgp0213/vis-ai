import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const dashboardRoot = new URL("../visionox-pkg/dashboard/", import.meta.url);
const sourceRoot = new URL("src/", dashboardRoot);

test("六个 Markdown 入口共享 KaTeX 扩展，文件预览加载同一份样式", () => {
  const markdown = readFileSync(new URL("lib/markdown.ts", sourceRoot), "utf8");
  const chatInternals = readFileSync(new URL("components/chat-internals.ts", sourceRoot), "utf8");
  const plans = readFileSync(new URL("panels/plans.ts", sourceRoot), "utf8");
  const reports = readFileSync(new URL("panels/reports.ts", sourceRoot), "utf8");
  const index = readFileSync(new URL("index.html", dashboardRoot), "utf8");
  const support = readFileSync(new URL("katex-support.js", dashboardRoot), "utf8");

  assert.match(markdown, /VisionoxKatex\.markedExtensions\(\)/);
  assert.match(markdown, /marked\.use\(\{ renderer, extensions: mathExtensions/);
  assert.match(markdown, /function renderMarkdownToString\(text\) \{\s*return marked\.parse\(text\)/);
  assert.match(markdown, /function renderMarkdownPreviewToString[\s\S]*?return marked\.parse\(text\)/);
  assert.match(chatInternals, /marked\.parse\(modal\.plan \|\| ""\)/);
  assert.match(chatInternals, /marked\.parse\(modal\.body\)/);
  assert.match(plans, /marked\.parse\(open\.body\)/);
  assert.match(reports, /marked\(markdown, \{ breaks: true, gfm: true \}\)/);
  assert.match(markdown, /vendor\/katex\/katex\.min\.css\?token=/);
  assert.match(index, /vendor\/katex\/katex\.min\.css\?token=__VISIONOX_TOKEN__/);
  assert.match(index, /vendor\/katex\/katex\.min\.js\?token=__VISIONOX_TOKEN__/);
  assert.match(index, /katex-support\.js\?token=__VISIONOX_TOKEN__/);
  assert.match(support, /name: "visionoxBlockMath"/);
  assert.match(support, /name: "visionoxInlineMath"/);
  assert.doesNotMatch(support, /mermaid/i);
});
