import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { pruneLegacyBootstrapSkillBackups } from "../lib/bootstrap-skill-cleanup.mjs";
import {
  formatBrave,
  formatMarkdown,
  loadTavilyApiKey,
  parseArguments,
  searchTavily,
} from "../../bootstrap-skills/tavily-search/scripts/tavily-search.mjs";

const resourcesDir = fileURLToPath(new URL("../../", import.meta.url));
const skillsDir = join(resourcesDir, "bootstrap-skills");

function skillFile(name, relative = "SKILL.md") {
  return join(skillsDir, name, relative);
}

test("all bundled skill directories contain a readable SKILL.md and provenance", () => {
  const skillNames = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.equal(skillNames.length, 45);
  for (const name of skillNames) {
    const path = skillFile(name);
    assert.ok(existsSync(path), `${name} is missing SKILL.md`);
    assert.match(readFileSync(path, "utf8"), /^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  }

  const provenance = JSON.parse(readFileSync(join(resourcesDir, "bootstrap-skills-provenance.json"), "utf8"));
  const covered = new Set(provenance.groups.flatMap((group) => group.skills ?? []));
  assert.deepEqual([...covered].sort(), skillNames);
});

test("PDF skill resolves its deployed path and documents Windows execution", () => {
  const pdf = readFileSync(skillFile("pdf"), "utf8");
  const initialization = pdf.indexOf("$env:PDF_SKILL_DIR");
  const firstWindowsCall = pdf.indexOf('python "$env:PDF_SKILL_DIR');
  assert.ok(initialization >= 0 && firstWindowsCall > initialization);
  assert.match(pdf, /path.*run_skill result header/i);
  assert.match(pdf, /Do not run `setup\.sh` directly on Windows/);
  assert.match(pdf, /Call `extract_pdf_text` with the returned `documentRef`/);
  assert.doesNotMatch(pdf, /organize_document_to_markdown/);
  assert.match(pdf, /write_file|append_file/);
  assert.match(pdf, /context|checkpoint|persist/i);
  assert.match(pdf, /references\/pdf-to-markdown\.md/);
  assert.match(pdf, /references\/large-document\.md/);
  assert.match(pdf, /Do not use OfficeCLI for PDF files/);
  assert.match(pdf, /Never install dependencies automatically/);
  const pdfScript = readFileSync(skillFile("pdf", "scripts/pdf.py"), "utf8");
  assert.match(pdfScript, /PermissionRequired/);
  assert.match(pdfScript, /\["pdfplumber", "pdfium", "pypdf"\]/);
  assert.match(pdfScript, /import pypdfium2 as pdfium/);
  assert.match(pdfScript, /@cmd\("pages\.chunk"\)/);
  assert.match(pdfScript, /manifest\.json/);
  const statsFunction = pdfScript.slice(pdfScript.indexOf("def _pdf_stats"), pdfScript.indexOf("def _classify_lines"));
  assert.doesNotMatch(statsFunction, /pip[\s\S]{0,40}install|subprocess\.run/);
  const markdownWorkflow = readFileSync(skillFile("pdf", "references/pdf-to-markdown.md"), "utf8");
  assert.doesNotMatch(markdownWorkflow, /organize_document_to_markdown/);
  assert.match(markdownWorkflow, /extract_pdf_text/);
  assert.match(markdownWorkflow, /append_file/);
  assert.match(markdownWorkflow, /before.*next|下一.*之前/i);

  const cjk = readFileSync(skillFile("md-to-pdf-cjk"), "utf8");
  assert.match(cjk, /python -m pip install reportlab/);
  assert.match(cjk, /ReportLab is not bundled with Visionox/);
  assert.match(cjk, /md_to_pdf\.py input\.md output\.pdf/);
  assert.match(cjk, /must never be used as a fallback PDF reader/);
  assert.doesNotMatch(cjk, /md_to_pdf\.py input\.md "Document Title"/);
  const converter = readFileSync(skillFile("md-to-pdf-cjk", "scripts/md_to_pdf.py"), "utf8");
  assert.match(converter, /sys\.platform == 'win32'/);
  assert.match(converter, /WINDIR/);
});

test("active bundled playbooks do not instruct unavailable Claude-specific tools", () => {
  const activeFiles = [
    "codebase-onboarding/SKILL.md",
    "context-budget/SKILL.md",
    "dispatching-parallel-agents/SKILL.md",
    "executing-plans/SKILL.md",
    "search-first/SKILL.md",
    "subagent-driven-development/SKILL.md",
    "subagent-driven-development/implementer-prompt.md",
    "subagent-driven-development/spec-reviewer-prompt.md",
    "subagent-driven-development/code-quality-reviewer-prompt.md",
    "using-superpowers/SKILL.md",
    "writing-skills/SKILL.md",
  ];
  for (const relative of activeFiles) {
    const contents = readFileSync(join(skillsDir, relative), "utf8");
    assert.doesNotMatch(contents, /TodoWrite|Task tool|Task\(|~\/\.claude\/skills|Claude Code/, relative);
  }

  const subagentWorkflow = readFileSync(skillFile("subagent-driven-development"), "utf8");
  assert.match(subagentWorkflow, /Availability Preflight/);
  assert.match(subagentWorkflow, /does not guarantee that capability/);
});

test("all Superpowers entry playbooks use Visionox skill names and available mechanisms", () => {
  const names = [
    "brainstorming", "dispatching-parallel-agents", "executing-plans", "finishing-a-development-branch",
    "receiving-code-review", "requesting-code-review", "subagent-driven-development", "systematic-debugging",
    "test-driven-development", "using-git-worktrees", "using-superpowers", "verification-before-completion",
    "writing-plans", "writing-skills",
  ];
  for (const name of names) {
    const contents = readFileSync(skillFile(name), "utf8");
    assert.doesNotMatch(contents, /superpowers:|Claude|TodoWrite|Task tool|~\/\.claude|~\/\.config\/superpowers/, name);
  }
  const entry = readFileSync(skillFile("using-superpowers"), "utf8");
  assert.doesNotMatch(entry, /1% chance|ANY response/i);
  assert.match(entry, /directly matches/i);
});

test("bundled Tavily skill uses the packaged Node runtime and declares its project license", () => {
  const skill = readFileSync(skillFile("tavily-search"), "utf8");
  const script = readFileSync(skillFile("tavily-search", "scripts/tavily-search.mjs"), "utf8");
  assert.match(skill, /license: MIT/);
  assert.match(skill, /node "\{baseDir\}\/scripts\/tavily-search\.mjs"/);
  assert.doesNotMatch(skill, /python\s+\{baseDir\}|\bpy\s+\{baseDir\}|\.py\b/iu);
  assert.match(script, /TAVILY_API_KEY/);
  assert.match(script, /https:\/\/api\.tavily\.com\/search/);
  assert.match(script, /FORMAT_CHOICES = \["json", "brave", "md"\]/);
});

test("bundled Tavily implementation matches the supported local skill behavior", async () => {
  const home = mkdtempSync(join(tmpdir(), "tavily-skill-"));
  try {
    mkdirSync(join(home, ".visionox"), { recursive: true });
    writeFileSync(join(home, ".visionox", ".env"), "# local\nTAVILY_API_KEY='from-file'\n", "utf8");
    assert.equal(loadTavilyApiKey({}, home), "from-file");
    assert.equal(loadTavilyApiKey({ TAVILY_API_KEY: "from-env" }, home), "from-env");

    const options = parseArguments(["--query", "Visionox", "--max-results", "3", "--include-answer", "--format", "brave"]);
    assert.deepEqual(options, { query: "Visionox", maxResults: 3, includeAnswer: true, format: "brave" });
    assert.throws(() => parseArguments(["--query", "x", "--max-results", "11"]), /integer from 1 to 10/);

    let request = null;
    const response = await searchTavily(options, "secret", async (url, init) => {
      request = { url, init };
      return { ok: true, text: async () => JSON.stringify({ query: "Visionox", answer: "A", results: [{ title: "T", url: "https://example.test", content: "S" }] }) };
    });
    assert.equal(request.url, "https://api.tavily.com/search");
    assert.deepEqual(JSON.parse(request.init.body), { api_key: "secret", query: "Visionox", max_results: 3, include_answer: true });
    assert.deepEqual(formatBrave(response), { query: "Visionox", answer: "A", results: [{ title: "T", url: "https://example.test", snippet: "S" }] });
    assert.match(formatMarkdown(response), /### 1\. \[T\]\(https:\/\/example\.test\)/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("bundled DWS skill keeps V来家 operations discoverable and side effects confirmed", () => {
  const skill = readFileSync(skillFile("dws"), "utf8");
  const integration = JSON.parse(readFileSync(skillFile("dws", "integration.json"), "utf8"));
  const templates = JSON.parse(readFileSync(skillFile("dws", "schedule-templates.json"), "utf8"));
  assert.match(skill, /name: dws/);
  assert.equal(integration.version, "1.0.51.10");
  assert.match(skill, /查钉钉消息\/未读\/@我\/群聊/);
  assert.match(skill, /equivalent English requests/);
  assert.equal(integration.license, "Apache-2.0");
  assert.equal(templates.templates.length, 6);
  assert.ok(templates.templates.every((template) => template.risk === "read" && template.scheduleAllowed === true));
  assert.match(skill, /call the `dws_read` tool directly/);
  assert.match(skill, /DWS is not read-only/);
  assert.match(skill, /without a Visionox command allowlist/);
  assert.match(skill, /`dws_help`, `dws_docs_search`, and confirmed `dws_exec`/);
  assert.match(skill, /仍然发送/);
  assert.match(skill, /request ceiling of 200/);
  assert.match(skill, /Individual DWS services can impose a lower page size/);
  assert.match(skill, /Never place a DWS executable path/);
  assert.match(skill, /"auth","status"/);
  assert.match(skill, /"contact","user","get-self"/);
  assert.match(skill, /"list-unread-conversations","--count","20"/);
  assert.match(skill, /"message","list","--group","<openConversationId>","--time"/);
  assert.match(skill, /"list-by-sender","--sender-open-dingtalk-id"/);
  assert.match(skill, /"report","outbox","list","--cursor","0","--size","20"/);
  assert.match(skill, /"minutes","list","all","--start","<ISO-8601>"/);
  assert.match(skill, /"--dimension","jobNumber"/);
  assert.match(skill, /"minutes","get","summary","--id","<taskUuid>"/);
  assert.match(skill, /string `"true"` as success/);
  assert.match(skill, /"todo","task","create"/);
  assert.match(skill, /presents its own confirmation card/);
  assert.match(skill, /Never supply `--yes`/);
  assert.match(skill, /~\/\.dws/);
  assert.match(skill, /never read, copy, print, edit, export, import, or back up those credential files/);
});

test("systematic debugging includes scripts for Windows and POSIX", () => {
  assert.ok(existsSync(skillFile("systematic-debugging", "find-polluter.sh")));
  assert.ok(existsSync(skillFile("systematic-debugging", "find-polluter.ps1")));
  const guide = readFileSync(skillFile("systematic-debugging", "root-cause-tracing.md"), "utf8");
  assert.match(guide, /Windows PowerShell/);
  assert.match(guide, /find-polluter\.ps1/);
});

test("legacy cleanup removes only marked managed backups with an active skill", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-cleanup-"));
  const managed = join(root, "officecli.bak-2026-01-01");
  const userBackup = join(root, "custom.bak-2026-01-01");
  const orphan = join(root, "missing.bak-2026-01-01");
  try {
    mkdirSync(join(root, "officecli"));
    mkdirSync(managed);
    mkdirSync(join(root, "custom"));
    mkdirSync(userBackup);
    mkdirSync(orphan);
    writeFileSync(join(managed, "_visionox_builtin.json"), JSON.stringify({ owner: "visionox-bootstrap", name: "officecli" }));
    writeFileSync(join(userBackup, "_visionox_builtin.json"), JSON.stringify({ owner: "user", name: "custom" }));
    writeFileSync(join(orphan, "_visionox_builtin.json"), JSON.stringify({ owner: "visionox-bootstrap", name: "missing" }));

    assert.deepEqual(pruneLegacyBootstrapSkillBackups(root), [managed]);
    assert.equal(existsSync(managed), false);
    assert.equal(existsSync(userBackup), true);
    assert.equal(existsSync(orphan), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
