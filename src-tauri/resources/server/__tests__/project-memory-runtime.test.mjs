import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const projectMemoryUrl = new URL("../visionox-pkg/dist/cli/chunk-2K65GZBT.js", import.meta.url);
const packageIndexUrl = new URL("../visionox-pkg/dist/index.js", import.meta.url);
const learnUrl = new URL("../learn.mjs", import.meta.url);
const cliProjectMemory = await import(projectMemoryUrl.href);
const packageIndexMemory = await import(packageIndexUrl.href);
const learn = await import(learnUrl.href);

describe("runtime project memory candidates", () => {
  let tmpRoot = null;

  afterEach(() => {
    if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
    tmpRoot = null;
  });

  for (const [label, memory] of [
    ["cli chunk", cliProjectMemory],
    ["package index", packageIndexMemory],
  ]) {
    test(`${label}: does not read .claude/CLAUDE.md by default`, () => {
      tmpRoot = mkdtempSync(join(tmpdir(), "project-memory-"));
      mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
      writeFileSync(join(tmpRoot, ".claude", "CLAUDE.md"), "foreign config", "utf8");

      assert.equal(memory.findProjectMemoryPath(tmpRoot), null);
      assert.equal(memory.applyProjectMemory("base", tmpRoot), "base");
    });

    test(`${label}: reads root CLAUDE.md as project memory`, () => {
      tmpRoot = mkdtempSync(join(tmpdir(), "project-memory-"));
      writeFileSync(join(tmpRoot, "CLAUDE.md"), "root project note", "utf8");

      assert.equal(memory.findProjectMemoryPath(tmpRoot), join(tmpRoot, "CLAUDE.md"));
      assert.ok(memory.applyProjectMemory("base", tmpRoot).includes("root project note"));
    });
  }

  test("candidate order stays aligned across runtime exports", () => {
    tmpRoot = mkdtempSync(join(tmpdir(), "project-memory-"));
    writeFileSync(join(tmpRoot, "visionox.md"), "visionox note", "utf8");
    writeFileSync(join(tmpRoot, "CLAUDE.md"), "root project note", "utf8");

    assert.equal(cliProjectMemory.findProjectMemoryPath(tmpRoot), join(tmpRoot, "CLAUDE.md"));
    assert.equal(packageIndexMemory.findProjectMemoryPath(tmpRoot), join(tmpRoot, "CLAUDE.md"));
  });

  for (const [label, memory] of [
    ["cli chunk", cliProjectMemory],
    ["package index", packageIndexMemory],
  ]) {
    test(`${label}: injects AGENTS and CLAUDE while ignoring REASONIX`, () => {
      tmpRoot = mkdtempSync(join(tmpdir(), "project-memory-"));
      writeFileSync(join(tmpRoot, "REASONIX.md"), "must be ignored", "utf8");
      writeFileSync(join(tmpRoot, "AGENTS.md"), "agent rules", "utf8");
      writeFileSync(join(tmpRoot, "CLAUDE.md"), "claude context", "utf8");

      const paths = memory.listProjectMemoryPaths(tmpRoot);
      assert.deepEqual(paths, [join(tmpRoot, "AGENTS.md"), join(tmpRoot, "CLAUDE.md")]);
      const prompt = memory.applyProjectMemory("base", tmpRoot);
      assert.match(prompt, /agent rules/);
      assert.match(prompt, /claude context/);
      assert.doesNotMatch(prompt, /must be ignored|REASONIX\.md/);
    });
  }

  test("/learn project writes only the app-owned visionox.md file", () => {
    const source = readFileSync(learnUrl, "utf8");
    assert.match(source, /return join\(rootDir, "visionox\.md"\)/);
    assert.doesNotMatch(source, /join\(rootDir, "REASONIX\.md"\)/);
  });

  test("/learn project rejects a short or structurally incomplete model result", () => {
    assert.equal(learn.validateProjectMemoryMarkdown("## Tech stack\nNode.js").ok, false);
    assert.equal(learn.validateProjectMemoryMarkdown([
      "## Tech stack",
      "Node.js and Tauri are used throughout this project with explicit runtime resource boundaries.",
      "## Project structure",
      "The launcher owns orchestration while focused modules own persistence and workflow policy.",
      "## Build and test commands",
      "Run the documented release wrapper and the complete quality gate before delivery.",
      "## Key conventions",
      "Preserve user data, use atomic writes, and reject incomplete model output before replacement.",
    ].join("\n\n")).ok, true);
  });

  test("/learn skill rejects a frontmatter-only generated skill", () => {
    assert.equal(learn.validateGeneratedSkillMarkdown("---\nname: generated-skill\n---\n").ok, false);
  });
});
