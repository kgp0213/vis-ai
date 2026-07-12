import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertVersionedJsonWritable, readVersionedJsonFile, writeVersionedJsonFile } from "../lib/versioned-json-file.mjs";

describe("versioned JSON files", () => {
  let root;
  let path;
  const options = { version: 2, validate: (value) => Array.isArray(value.items) || "items must be an array" };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "visionox-versioned-json-"));
    path = join(root, "state.json");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("allows missing files and writes the current schema atomically", () => {
    assert.equal(readVersionedJsonFile(path, options).source, "missing");
    const written = writeVersionedJsonFile(path, { items: ["one"] }, { version: 2 });
    assert.equal(written.version, 2);
    assert.deepEqual(readVersionedJsonFile(path, options).value.items, ["one"]);
  });

  test("accepts valid legacy and explicitly allowed unversioned objects", () => {
    writeFileSync(path, '{"version":1,"items":[]}');
    assert.equal(readVersionedJsonFile(path, options).source, "legacy");
    writeFileSync(path, '{"items":[]}');
    assert.equal(readVersionedJsonFile(path, { ...options, allowUnversioned: true }).source, "legacy");
  });

  test("rejects malformed, structurally invalid and newer data without modifying it", () => {
    for (const body of ["{", "[]", '{"items":[]}', '{"version":"2","items":[]}', '{"version":3,"items":[]}', '{"version":2,"items":{}}']) {
      writeFileSync(path, body);
      const before = readFileSync(path, "utf8");
      const result = readVersionedJsonFile(path, options);
      assert.equal(result.ok, false);
      assert.throws(() => assertVersionedJsonWritable(path, options), /original file was not modified/);
      assert.equal(readFileSync(path, "utf8"), before);
    }
  });

  test("validates API arguments and reports validator exceptions", () => {
    assert.throws(() => readVersionedJsonFile(path), /positive schema version/);
    assert.throws(() => writeVersionedJsonFile(path, [], { version: 1 }), /value must be an object/);
    writeFileSync(path, '{"version":2,"items":[]}');
    const result = readVersionedJsonFile(path, { version: 2, validate: () => { throw new Error("broken validator"); } });
    assert.match(result.error, /broken validator/);
  });
});
