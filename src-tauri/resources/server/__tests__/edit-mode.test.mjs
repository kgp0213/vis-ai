import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Import loadEditMode from the bundled chunk
const chunkUrl = new URL("../visionox-pkg/dist/cli/chunk-XPDVG52A.js", import.meta.url);
const { loadEditMode } = await import(chunkUrl.href);

describe("loadEditMode — 编辑模式解析", () => {
  let tmpDir;
  let configNum = 0;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "editmode-test-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeConfig(editMode) {
    // Use unique filenames to avoid readConfig's mtime cache
    const path = join(tmpDir, `config-${++configNum}.json`);
    writeFileSync(path, JSON.stringify({ editMode }));
    return path;
  }

  test("auto → auto", () => {
    assert.equal(loadEditMode(makeConfig("auto")), "auto");
  });

  test("yolo → yolo", () => {
    assert.equal(loadEditMode(makeConfig("yolo")), "yolo");
  });

  test("admin → admin", () => {
    assert.equal(loadEditMode(makeConfig("admin")), "admin");
  });

  test("review → auto（别名映射）", () => {
    assert.equal(loadEditMode(makeConfig("review")), "auto");
  });

  test("undefined → admin（默认值）", () => {
    const path = join(tmpDir, `config-${++configNum}.json`);
    writeFileSync(path, JSON.stringify({}));
    assert.equal(loadEditMode(path), "admin");
  });

  test("无效值 → admin（回退）", () => {
    assert.equal(loadEditMode(makeConfig("invalid")), "admin");
  });
});
