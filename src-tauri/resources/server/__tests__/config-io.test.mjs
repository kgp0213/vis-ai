import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const chunkUrl = new URL("../visionox-pkg/dist/cli/chunk-XPDVG52A.js", import.meta.url);
const { readConfig, writeConfig, saveEditMode, loadEditMode, editModeHintShown } = await import(chunkUrl.href);

describe("config I/O 往返测试", () => {
  let tmpDir;
  let fileCounter = 0;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "config-io-test-"));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // Each test uses a unique filename to avoid readConfig's mtime cache
  function newPath() {
    return join(tmpDir, `config-${++fileCounter}.json`);
  }

  test("writeConfig + readConfig 往返", () => {
    const path = newPath();
    writeConfig({ editMode: "yolo", preset: "flash" }, path);
    const cfg = readConfig(path);
    assert.equal(cfg.editMode, "yolo");
    assert.equal(cfg.preset, "flash");
  });

  test("saveEditMode + loadEditMode 往返", () => {
    const path = newPath();
    saveEditMode("admin", path);
    assert.equal(loadEditMode(path), "admin");
  });

  test("saveEditMode('review') + loadEditMode → 'auto'（别名映射 gotcha）", () => {
    const path = newPath();
    saveEditMode("review", path);
    // loadEditMode maps review→auto, so what's stored as "review" reads back as "auto"
    assert.equal(loadEditMode(path), "auto");
  });

  test("editModeHintShown 默认 false", () => {
    const path = newPath();
    writeConfig({ editMode: "auto" }, path);
    assert.equal(editModeHintShown(path), false);
  });

  test("readConfig 不存在的文件 → {}", () => {
    const cfg = readConfig(join(tmpDir, "nonexistent.json"));
    assert.deepEqual(cfg, {});
  });
});
