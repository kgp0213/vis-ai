import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const chunkUrl = new URL("../visionox-pkg/dist/cli/chunk-2K65GZBT.js", import.meta.url);
const { applySkillsIndex } = await import(chunkUrl.href);

describe("applySkillsIndex", () => {
  let tmpDir;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "skills-index-test-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("无 skills 目录 → basePrompt 原样返回", () => {
    const result = applySkillsIndex("my prompt", { homeDir: tmpDir, disableBuiltins: true });
    assert.equal(result, "my prompt");
  });

  test("1 个 skill → basePrompt + 技能索引段落", () => {
    const skillsDir = join(tmpDir, ".visionox", "skills", "single");
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, "SKILL.md"),
      "---\nname: single-skill\ndescription: Does one thing well\n---\n\n# Single");

    const result = applySkillsIndex("base", { homeDir: tmpDir, disableBuiltins: true });
    assert.ok(result.includes("base"));
    assert.ok(result.includes("single-skill"));
    assert.ok(result.includes("Does one thing well"));
    assert.ok(result.includes("# Skills"));
  });

  test("2 个 skill → 包含两行索引", () => {
    const baseDir = join(tmpDir, ".visionox", "skills");
    for (const name of ["alpha", "beta"]) {
      const dir = join(baseDir, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "SKILL.md"),
        `---\nname: ${name}\ndescription: ${name} skill\n---\n\n# ${name}`);
    }

    const result = applySkillsIndex("base", { homeDir: tmpDir, disableBuiltins: true });
    assert.ok(result.includes("alpha"));
    assert.ok(result.includes("beta"));
    // Each skill should be on its own line
    const lines = result.split("\n").filter(l => l.startsWith("- alpha") || l.startsWith("- beta"));
    assert.equal(lines.length, 2);
  });

  test("subagent 类型 → 包含 [🧬 subagent] 标签", () => {
    const dir = join(tmpDir, ".visionox", "skills", "subagent-test");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"),
      "---\nname: sub-agent\ndescription: runs in subagent\nrunAs: subagent\n---\n\n# Sub");

    const result = applySkillsIndex("base", { homeDir: tmpDir, disableBuiltins: true });
    assert.ok(result.includes("[🧬 subagent]") || result.includes("subagent]"));
  });

  test("triggers 字段 → 包含 [triggers: ...] 标签", () => {
    const dir = join(tmpDir, ".visionox", "skills", "triggered-skill");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"),
      "---\nname: trig\ndescription: has triggers\ntriggers: foo, bar\n---\n\n# Trig");

    const result = applySkillsIndex("base", { homeDir: tmpDir, disableBuiltins: true });
    assert.ok(result.includes("[triggers: foo, bar]"));
  });
});
