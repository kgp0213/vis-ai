import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { getSkillCredentialStatus, saveSkillCredential } from "../lib/skill-credentials.mjs";
import { routeAutomaticSkill } from "../lib/skill-routing.mjs";

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const dashboardUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const launcherUrl = new URL("../launcher.mjs", import.meta.url);
const skillsUrl = new URL("../visionox-pkg/dist/cli/chunk-2K65GZBT.js", import.meta.url);
const skillToolsUrl = new URL("../visionox-pkg/dist/cli/chunk-45U62RI3.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const { applySkillsIndex } = await import(skillsUrl.href);
const { registerSkillTools } = await import(skillToolsUrl.href);
const TOKEN = "skill-invocation-test";

async function submit(body, ctx) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST";
  req.url = "/api/submit";
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  let status = null;
  let raw = "";
  const res = { writeHead(value) { status = value; }, end(value) { raw = value ?? ""; } };
  await dispatch(req, res, ctx, TOKEN);
  return { status, body: raw ? JSON.parse(raw) : null };
}

async function request(method, path, body, ctx) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  req.method = method;
  req.url = path;
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  let status = null;
  let raw = "";
  const res = { writeHead(value) { status = value; }, end(value) { raw = value ?? ""; } };
  await dispatch(req, res, ctx, TOKEN);
  return { status, body: raw ? JSON.parse(raw) : null };
}

test("submit forwards an explicit skill invocation without replacing the displayed prompt", async () => {
  let received = null;
  const prompt = "@weather 查询明天北京天气";
  const result = await submit({
    prompt,
    skillInvocation: { name: "weather", task: "查询明天北京天气" },
    requestId: "skill-1",
  }, {
    async submitPrompt(text, session, images, opts) {
      received = { text, session, images, opts };
      return { accepted: true };
    },
  });
  assert.equal(result.status, 202);
  assert.equal(received.text, prompt);
  assert.deepEqual(received.opts.skillInvocation, { name: "weather", task: "查询明天北京天气" });

  const invalid = await submit({ prompt, skillInvocation: { name: "../weather", task: "x" } }, { submitPrompt: async () => ({ accepted: true }) });
  assert.equal(invalid.status, 400);
});

test("skills index keeps a complete name directory and prioritizes current-mode details", () => {
  const home = mkdtempSync(join(tmpdir(), "skill-index-"));
  const dir = join(home, ".visionox", "skills");
  mkdirSync(dir, { recursive: true });
  try {
    const names = Array.from({ length: 70 }, (_, index) => `skill-${String(index).padStart(2, "0")}`);
    names.push("tavily-search", "weather");
    for (const name of names) {
      writeFileSync(join(dir, `${name}.md`), `---\nname: ${name}\ndescription: ${"Detailed capability ".repeat(8)}${name}\n---\n\n# ${name}\n`);
    }
    const prompt = applySkillsIndex("base", { homeDir: home, disableBuiltins: true, modeSkills: ["weather"] });
    assert.match(prompt, /Complete skill names/);
    assert.match(prompt, /tavily-search/);
    assert.match(prompt, /weather/);
    const details = prompt.slice(prompt.indexOf("## Detailed catalog"));
    assert.ok(details.indexOf("⭐ weather") < details.indexOf("skill-00"));
    assert.match(prompt, /details omitted for \d+ skill/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("dashboard sends selected mentions structurally and run_skill accepts named skills outside details", () => {
  const dashboard = readFileSync(dashboardUrl, "utf8");
  const launcher = readFileSync(launcherUrl, "utf8");
  const tools = readFileSync(skillToolsUrl, "utf8");
  assert.match(dashboard, /const skillInvocation = \{ name: selected\.skill\.name, task \}/);
  assert.match(dashboard, /body\.skillInvocation = resolved\.skillInvocation/);
  assert.match(dashboard, /skills\/credentials\/\$\{encodeURIComponent\(selected\.skill\.name\)\}/);
  assert.match(dashboard, /skillCredentialTitle/);
  assert.match(dashboard, /skillCredentialHint/);
  assert.match(dashboard, /saveSkillCredential/);
  assert.doesNotMatch(dashboard, /return t4\("chat\.skillInvokePrompt"/);
  assert.match(launcher, /const explicitSkillInvocation = opts\.skillInvocation/);
  assert.match(launcher, /name = selectedSkillInvocation\?\.name/);
  assert.match(tools, /explicitly names a skill/);
  assert.match(tools, /not listed in the detailed catalog/);
});

test("scheduled Skill templates stay structured, read-only and dynamically resolved", () => {
  const dashboard = readFileSync(dashboardUrl, "utf8");
  const launcher = readFileSync(launcherUrl, "utf8");
  assert.match(dashboard, /usePoll\("\/schedules\/templates", 6e4\)/);
  assert.match(dashboard, /executionSource === "skill"/);
  assert.match(dashboard, /skillPromptAddendum/);
  assert.match(launcher, /resolveScheduledSkillInvocation/);
  assert.match(launcher, /previousSuccessfulRunAt = task\.skillName/);
  assert.match(launcher, /entry\?\.skillName === task\.skillName/);
  assert.match(launcher, /24 \* 60 \* 60 \* 1000/);
  assert.match(launcher, /skillInvocation: scheduledSkill\?\.skillInvocation/);
  assert.match(launcher, /disableSemanticRetrieval: Boolean\(scheduledSkill\)/);
  assert.match(launcher, /status: "disabled-for-skill-schedule"/);
  assert.match(launcher, /status: "waiting_auth"/);
  assert.match(launcher, /listSkillScheduleTemplates/);
  assert.match(launcher, /name: "rollback_skill"/);
});

test("tavily credentials are stored locally without exposing their value", () => {
  const home = mkdtempSync(join(tmpdir(), "skill-credentials-"));
  const environment = {};
  try {
    assert.deepEqual(getSkillCredentialStatus("tavily-search", { homeDir: home, environment }), {
      skill: "tavily-search",
      required: true,
      configured: false,
      label: "Tavily API Key",
      helpUrl: "https://app.tavily.com/home",
    });
    assert.throws(() => saveSkillCredential("tavily-search", "bad\nvalue", { homeDir: home, environment }), /one line/);
    mkdirSync(join(home, ".visionox"), { recursive: true });
    writeFileSync(join(home, ".visionox", ".env"), "OTHER_SETTING=keep\nTAVILY_API_KEY=old-secret\n", "utf8");

    const status = saveSkillCredential("tavily-search", "tvly-new-secret", { homeDir: home, environment });
    assert.equal(status.configured, true);
    assert.equal("value" in status, false);
    assert.equal(environment.TAVILY_API_KEY, "tvly-new-secret");
    assert.equal(readFileSync(join(home, ".visionox", ".env"), "utf8"), "OTHER_SETTING=keep\nTAVILY_API_KEY=tvly-new-secret\n");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("tavily credential API reports setup state and rejects unsupported skills", async () => {
  const home = mkdtempSync(join(tmpdir(), "skill-credential-api-"));
  const ctx = { skillCredentialHomeDir: home, skillCredentialEnvironment: {} };
  try {
    const initial = await request("GET", "/api/skills/credentials/tavily-search", null, ctx);
    assert.equal(initial.status, 200);
    assert.equal(initial.body.configured, false);
    assert.equal(initial.body.apiKey, undefined);

    const saved = await request("POST", "/api/skills/credentials/tavily-search", { apiKey: "tvly-api-test-key" }, ctx);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.configured, true);
    assert.equal(saved.body.apiKey, undefined);

    const unsupported = await request("GET", "/api/skills/credentials/weather", null, ctx);
    assert.equal(unsupported.status, 404);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("unambiguous weather questions route to the installed skill without hijacking technical discussions", () => {
  assert.deepEqual(routeAutomaticSkill("查询成都天气"), { name: "weather", task: "查询成都天气", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("成都明天会下雨吗"), { name: "weather", task: "成都明天会下雨吗", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("what is the weather in Chengdu tomorrow?"), { name: "weather", task: "what is the weather in Chengdu tomorrow?", source: "automatic" });
  assert.equal(routeAutomaticSkill("修改天气组件的 API 调用"), null);
  assert.equal(routeAutomaticSkill("阅读 weather skill 文档"), null);
  assert.equal(routeAutomaticSkill("@weather 成都"), null);
  assert.equal(routeAutomaticSkill("/skill weather 成都"), null);

  const launcher = readFileSync(launcherUrl, "utf8");
  assert.match(launcher, /const automaticSkillInvocation = explicitSkillInvocation \? null : routeAutomaticSkill\(text\)/);
  assert.match(launcher, /\.read\(automaticSkillInvocation\.name\) \? automaticSkillInvocation : null/);
});

test("document intent routes existing PDFs and Markdown conversion to distinct skills", () => {
  const pdfTask = "读取 D:\\_归档\\（20260703）OP Manual规范模板.pdf 并整理成 Markdown";
  assert.deepEqual(routeAutomaticSkill(pdfTask), { name: "pdf", task: pdfTask, source: "automatic" });
  const markdownTask = "把 D:\\sample-workspace\\分析报告.md 转成 PDF";
  assert.deepEqual(routeAutomaticSkill(markdownTask), { name: "md-to-pdf-cjk", task: markdownTask, source: "automatic" });
  assert.equal(routeAutomaticSkill("修改 pdf 技能的解析代码"), null);
  assert.equal(routeAutomaticSkill("用 OfficeCLI 查看 D:\\sample-workspace\\汇报材料.pptx"), null);
});

test("unambiguous V来家 actions route to DWS without hijacking integration discussions", () => {
  assert.deepEqual(routeAutomaticSkill("帮我查一下今天的钉钉日程"), { name: "dws", task: "帮我查一下今天的钉钉日程", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("通过V来家给张三发送消息"), { name: "dws", task: "通过V来家给张三发送消息", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("查询企业钉钉待办"), { name: "dws", task: "查询企业钉钉待办", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("帮我按工号查一下这个同事"), { name: "dws", task: "帮我按工号查一下这个同事", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("看看待我审批的事项"), { name: "dws", task: "看看待我审批的事项", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("整理一下AI听记"), { name: "dws", task: "整理一下AI听记", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("列出公司通讯录里的产品经理"), { name: "dws", task: "列出公司通讯录里的产品经理", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("汇总V来家里@我的消息"), { name: "dws", task: "汇总V来家里@我的消息", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("search DingTalk messages"), { name: "dws", task: "search DingTalk messages", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("show my DingTalk calendar"), { name: "dws", task: "show my DingTalk calendar", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("list pending DingTalk approvals"), { name: "dws", task: "list pending DingTalk approvals", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("find a person in the company directory"), { name: "dws", task: "find a person in the company directory", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("通过DWS创建一条公告"), { name: "dws", task: "通过DWS创建一条公告", source: "automatic" });
  assert.deepEqual(routeAutomaticSkill("DWS技能暂时没有这个功能，请帮我新增一条日程"), { name: "dws", task: "DWS技能暂时没有这个功能，请帮我新增一条日程", source: "automatic" });
  assert.equal(routeAutomaticSkill("帮我看看未读消息"), null);
  assert.equal(routeAutomaticSkill("同事刚才提到一个问题"), null);
  assert.equal(routeAutomaticSkill("如何把钉钉 API 集成到项目"), null);
  assert.deepEqual(routeAutomaticSkill("阅读 DWS 手册文档内容"), { name: "dws", task: "阅读 DWS 手册文档内容", source: "automatic" });
  assert.equal(routeAutomaticSkill("search the DingTalk API documentation"), null);
  assert.equal(routeAutomaticSkill("test the DWS integration"), null);
  assert.equal(routeAutomaticSkill("修改钉钉技能创建逻辑"), null);
  assert.equal(routeAutomaticSkill("@dws 查询今日日程"), null);
  const launcher = readFileSync(launcherUrl, "utf8");
  assert.match(launcher, /if \(skill\.name === "dws"\) \{[\s\S]*?if \(!status\.connected\)/);
  assert.match(launcher, /点击左侧导航栏底部的“登录 V来家”/);
});

test("run_skill resolves the standard baseDir placeholder to the selected skill directory", async () => {
  const home = mkdtempSync(join(tmpdir(), "skill-base-dir-"));
  const skillDir = join(home, ".visionox", "skills", "path-aware");
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), "---\nname: path-aware\ndescription: test\n---\n\nRun node {baseDir}/scripts/tool.mjs\n", "utf8");
  let spec = null;
  try {
    registerSkillTools({ register(value) { spec = value; } }, { homeDir: home });
    const result = await spec.fn({ name: "path-aware", arguments: "go" }, {});
    assert.doesNotMatch(result, /\{baseDir\}/);
    assert.ok(result.includes(skillDir));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
