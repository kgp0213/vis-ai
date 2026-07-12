import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { pruneLegacyBootstrapSkillBackups } from "../lib/bootstrap-skill-cleanup.mjs";

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
  assert.equal(skillNames.length, 41);
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

  const cjk = readFileSync(skillFile("md-to-pdf-cjk"), "utf8");
  assert.match(cjk, /python -m pip install reportlab/);
  assert.match(cjk, /ReportLab is not bundled with Visionox/);
  assert.match(cjk, /md_to_pdf\.py input\.md output\.pdf/);
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
