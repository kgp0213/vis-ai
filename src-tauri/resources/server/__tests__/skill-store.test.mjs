import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Import from the actual bundled chunk — these are exported and stable
const chunkUrl = new URL("../visionox-pkg/dist/cli/chunk-2K65GZBT.js", import.meta.url);
const { parseFrontmatter, SkillStore } = await import(chunkUrl.href);

// ── parseFrontmatter tests (no file I/O needed) ───────────────

describe("parseFrontmatter", () => {
  test("标准 frontmatter + body", () => {
    const raw = "---\nname: my-skill\ndescription: A test skill\n---\n\n# My Skill\n\nBody text.";
    const { data, body } = parseFrontmatter(raw);
    assert.equal(data.name, "my-skill");
    assert.equal(data.description, "A test skill");
    assert.ok(body.includes("# My Skill"));
  });

  test("无 frontmatter → 空 data，原样 body", () => {
    const raw = "# Just a heading\n\nNo frontmatter here.";
    const { data, body } = parseFrontmatter(raw);
    assert.deepEqual(data, {});
    assert.ok(body.includes("Just a heading"));
  });

  test("带 triggers 字段", () => {
    const raw = "---\nname: triggered\ndescription: test\ntriggers: foo, bar\n---\n\nBody";
    const { data } = parseFrontmatter(raw);
    assert.equal(data.triggers, "foo, bar");
  });

  test("多行 description", () => {
    const raw = '---\nname: multi\ndescription: "Line one. Line two."\n---\n\nBody';
    const { data } = parseFrontmatter(raw);
    assert.equal(data.description, "Line one. Line two.");
  });
});

// ── SkillStore.parse tests (with temp fixture dirs) ───────────

describe("SkillStore.parse", () => {
  let tmpDir;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "skill-test-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("标准 SKILL.md → 解析 name/description/body", () => {
    const skillDir = join(tmpDir, "simple");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"),
      "---\nname: simple-skill\ndescription: A simple skill\n---\n\n# Simple\n\nDoes things.");

    const store = new SkillStore({ homeDir: tmpDir, projectRoot: tmpDir });
    const result = store.parse(join(skillDir, "SKILL.md"), "simple", "global");

    assert.equal(result.name, "simple-skill");
    assert.equal(result.description, "A simple skill");
    assert.ok(result.body.includes("# Simple"));
    assert.equal(result.scope, "global");
  });

  test("references/ 目录 → body 附加引用列表", () => {
    const skillDir = join(tmpDir, "with-refs");
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(skillDir, "references"), { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"),
      "---\nname: ref-skill\ndescription: has refs\n---\n\n# Ref Skill");
    writeFileSync(join(skillDir, "references", "guide.md"), "# Guide");
    writeFileSync(join(skillDir, "references", "tips.md"), "# Tips");

    const store = new SkillStore({ homeDir: tmpDir, projectRoot: tmpDir });
    const result = store.parse(join(skillDir, "SKILL.md"), "with-refs", "global");

    assert.ok(result.body.includes("## Available References"));
    assert.ok(result.body.includes("references/guide.md"));
    assert.ok(result.body.includes("references/tips.md"));
  });

  test("scripts/ 目录 → body 附加脚本列表", () => {
    const skillDir = join(tmpDir, "with-scripts");
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(skillDir, "scripts"), { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"),
      "---\nname: script-skill\ndescription: has scripts\n---\n\n# Script Skill");
    writeFileSync(join(skillDir, "scripts", "helper.py"), "print('hi')");

    const store = new SkillStore({ homeDir: tmpDir, projectRoot: tmpDir });
    const result = store.parse(join(skillDir, "SKILL.md"), "with-scripts", "global");

    assert.ok(result.body.includes("## Available Scripts"));
    assert.ok(result.body.includes("scripts/helper.py"));
  });

  test("triggers 字段 → 出现在返回对象中", () => {
    const skillDir = join(tmpDir, "triggered");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"),
      "---\nname: trig-skill\ndescription: triggered\ntriggers: foo, bar\n---\n\nBody");

    const store = new SkillStore({ homeDir: tmpDir, projectRoot: tmpDir });
    const result = store.parse(join(skillDir, "SKILL.md"), "triggered", "global");

    assert.equal(result.triggers, "foo, bar");
  });
});
