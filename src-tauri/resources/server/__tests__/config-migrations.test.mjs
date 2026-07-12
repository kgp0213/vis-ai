import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { CURRENT_CONFIG_SCHEMA_VERSION, migrateConfigFile } from "../lib/config-migrations.mjs";

describe("config schema migrations", () => {
  let tempDir;
  let counter = 0;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), "visionox-config-migration-"));
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function configPath() {
    return join(tempDir, `case-${++counter}`, "config.json");
  }

  test("migrates an unversioned config without dropping unknown fields", () => {
    const path = configPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ custom: { keep: true }, indexRetrievalMode: "tool" }), "utf8");

    const writes = [];
    const result = migrateConfigFile(path, {
      writeConfig: (cfg, target) => {
        writes.push(cfg);
        writeFileSync(target, JSON.stringify(cfg), "utf8");
      },
      now: () => new Date("2026-07-12T01:02:03.000Z"),
    });

    assert.equal(result.status, "migrated");
    assert.equal(result.fromVersion, 0);
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].custom, { keep: true });
    assert.equal(writes[0].configSchemaVersion, CURRENT_CONFIG_SCHEMA_VERSION);
    assert.equal(writes[0].configSchemaMigratedAt, "2026-07-12T01:02:03.000Z");
    assert.equal(JSON.parse(readFileSync(result.backupPath, "utf8")).configSchemaVersion, undefined);
  });

  test("normalizes an invalid persisted index retrieval mode during migration", () => {
    const path = configPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ indexRetrievalMode: "sometimes" }), "utf8");

    let saved;
    migrateConfigFile(path, { writeConfig: (cfg) => { saved = cfg; } });
    assert.equal(saved.indexRetrievalMode, "auto");
  });

  test("initializes a new config without creating a backup", () => {
    const path = configPath();
    let saved;
    const result = migrateConfigFile(path, { writeConfig: (cfg) => { saved = cfg; } });
    assert.equal(result.status, "migrated");
    assert.equal(result.backupPath, null);
    assert.equal(saved.configSchemaVersion, CURRENT_CONFIG_SCHEMA_VERSION);
  });

  test("does not rewrite current or newer configs", () => {
    for (const version of [CURRENT_CONFIG_SCHEMA_VERSION, CURRENT_CONFIG_SCHEMA_VERSION + 1]) {
      const path = configPath();
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify({ configSchemaVersion: version }), "utf8");
      let writes = 0;
      const result = migrateConfigFile(path, { writeConfig: () => { writes += 1; } });
      assert.equal(writes, 0);
      assert.equal(result.status, version === CURRENT_CONFIG_SCHEMA_VERSION ? "current" : "newer-version");
    }
  });

  test("leaves malformed JSON untouched and creates no backup", () => {
    const path = configPath();
    mkdirSync(dirname(path), { recursive: true });
    const malformed = '{"apiKey":"secret"';
    writeFileSync(path, malformed, "utf8");
    let writes = 0;

    const result = migrateConfigFile(path, { writeConfig: () => { writes += 1; } });

    assert.equal(result.status, "invalid-json");
    assert.equal(writes, 0);
    assert.equal(readFileSync(path, "utf8"), malformed);
    assert.equal(existsSync(join(dirname(path), "backups")), false);
  });

  test("creates the pre-migration backup only once", () => {
    const path = configPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ first: true }), "utf8");
    const first = migrateConfigFile(path, { writeConfig: () => {} });
    writeFileSync(path, JSON.stringify({ second: true }), "utf8");
    migrateConfigFile(path, { writeConfig: () => {} });
    assert.deepEqual(JSON.parse(readFileSync(first.backupPath, "utf8")), { first: true });
  });

  test("does not write the migrated config when its recovery backup fails", () => {
    const path = configPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ keep: true }), "utf8");
    writeFileSync(join(dirname(path), "backups"), "blocks backup directory", "utf8");
    let writes = 0;

    const result = migrateConfigFile(path, { writeConfig: () => { writes += 1; } });

    assert.equal(result.status, "backup-error");
    assert.equal(writes, 0);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { keep: true });
  });
});
