import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { MemoryStore } from "../visionox-pkg/dist/cli/chunk-5JJRUIPA.js";

const launcherUrl = new URL("../launcher.mjs", import.meta.url);

describe("memory correctness", () => {
  let homeDir = null;

  afterEach(() => {
    if (homeDir) rmSync(homeDir, { recursive: true, force: true });
    homeDir = null;
  });

  test("long-term memory creation refuses an implicit overwrite", () => {
    homeDir = mkdtempSync(join(tmpdir(), "memory-store-"));
    const store = new MemoryStore({ homeDir });
    const input = {
      name: "report-style",
      description: "Preferred report style",
      type: "user",
      scope: "global",
      body: "Use short sections.",
    };
    store.write(input);

    assert.throws(
      () => store.write({ ...input, body: "Overwrite silently." }),
      /already exists/i,
    );
    assert.equal(store.read("global", input.name).body, input.body);
    store.write({ ...input, body: "Updated explicitly." }, { overwrite: true });
    assert.match(store.read("global", input.name).updatedAt, /T/);
  });

  test("memory indexes are truncated only between complete entries", () => {
    homeDir = mkdtempSync(join(tmpdir(), "memory-store-"));
    const store = new MemoryStore({ homeDir });
    for (let i = 0; i < 40; i++) {
      const suffix = String(i).padStart(2, "0");
      store.write({
        name: `memory-${suffix}`,
        description: `Description ${suffix} ${"x".repeat(105)}`,
        type: "user",
        scope: "global",
        body: `Body ${suffix}`,
      });
    }

    const index = store.loadIndex("global");
    assert.equal(index.truncated, true);
    assert.match(index.content, /omitted \d+ complete entr(?:y|ies)/);
    for (const line of index.content.split("\n")) {
      if (line.startsWith("- [")) assert.match(line, /\.md\) — /);
    }
  });

  test("session resume clears process-local temporary memories before adoption", () => {
    const launcher = readFileSync(launcherUrl, "utf8");
    const start = launcher.indexOf("// ── Session resume: load historical messages");
    const end = launcher.indexOf("// Handle /learn", start);
    assert.ok(start >= 0 && end > start, "session resume block must exist");
    const block = launcher.slice(start, end);
    assert.match(block, /clearSessionMemories\(\)/);
    assert.match(block, /restoreSessionMemories\(sessionMeta\.sessionMemories\)/);
    assert.ok(
      block.indexOf("clearSessionMemories()") < block.indexOf("adoptHistory"),
      "temporary memory must be cleared before historical messages are adopted",
    );
  });

  test("active-session metadata persists and restores temporary memories", () => {
    const launcher = readFileSync(launcherUrl, "utf8");
    assert.match(launcher, /sessionMemories:\s*sessionMemories\.map/);
    assert.match(launcher, /restoreSessionMemories\(meta\.sessionMemories\)/);
  });

  test("mode memory refuses capacity overflow instead of silently dropping an item", () => {
    const launcher = readFileSync(launcherUrl, "utf8");
    const start = launcher.indexOf("function addModeMemory");
    const end = launcher.indexOf("function updateModeMemory", start);
    assert.ok(start >= 0 && end > start, "addModeMemory must exist");
    assert.match(
      launcher.slice(start, end),
      /MODE_MEMORY_ITEM_LIMIT[\s\S]*throw new Error\([^)]+capacity/i,
    );
  });

  test("persistent prompt uses shared whole-entry budgeting and exposes injection status", () => {
    const launcher = readFileSync(launcherUrl, "utf8");
    assert.match(launcher, /buildBudgetedBlocks\(highEntries/);
    assert.match(launcher, /excludedKeys = new Set\(high\.selectedKeys\)/);
    assert.match(launcher, /getMemoryInjectionStatus/);
    assert.doesNotMatch(launcher, /block\.slice\(0, CONSTANTS\.HIGH_PRIORITY_MEMORY_BLOCK_MAX_CHARS\)/);
  });

  test("remember replace reaches MemoryStore overwrite and session restores rebuild the prefix", () => {
    const launcher = readFileSync(launcherUrl, "utf8");
    const memoryTools = readFileSync(new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url), "utf8");
    assert.match(memoryTools, /store\.write\([\s\S]*?\}, \{ overwrite: args\.replace === true \}\)/);
    assert.match(launcher, /restoreSessionMemories\(sessionMeta\.sessionMemories\)[\s\S]*?rebuildLoopPreservingContext/);
    assert.match(launcher, /getMemoryRuntimeStatus/);
  });
});
