import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const projectMemoryUrl = new URL("../visionox-pkg/dist/cli/chunk-2K65GZBT.js", import.meta.url);
const packageIndexUrl = new URL("../visionox-pkg/dist/index.js", import.meta.url);
const cliProjectMemory = await import(projectMemoryUrl.href);
const packageIndexMemory = await import(packageIndexUrl.href);

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

    test(`${label}: keeps root CLAUDE.md compatibility`, () => {
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

    assert.equal(cliProjectMemory.findProjectMemoryPath(tmpRoot), join(tmpRoot, "visionox.md"));
    assert.equal(packageIndexMemory.findProjectMemoryPath(tmpRoot), join(tmpRoot, "visionox.md"));
  });
});
