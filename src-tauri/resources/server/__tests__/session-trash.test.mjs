import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSessionTrashStore } from "../lib/session-trash.mjs";

describe("session trash store", () => {
  let root;
  let sessionsDir;
  let trashDir;
  let config;
  let events;
  let store;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "visionox-session-trash-"));
  });

  beforeEach(() => {
    sessionsDir = join(root, `sessions-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    trashDir = join(root, `trash-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(sessionsDir, { recursive: true });
    config = {};
    events = [];
    store = createSessionTrashStore({
      sessionsDir,
      trashDir,
      sessionPath: (name) => join(sessionsDir, `${name}.jsonl`),
      isValidSessionName: (name) => /^[A-Za-z0-9_-]+$/.test(name),
      readConfig: () => config,
      writeConfig: (next) => { config = next; },
      onChanged: (event) => events.push(event),
      now: () => new Date("2026-07-12T10:00:00.000Z"),
      uuid: () => "uuid",
      logger: { error() {} },
    });
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeSession(name) {
    for (const suffix of [".jsonl", ".events.jsonl", ".pending.json", ".meta.json", ".plan.json"]) {
      writeFileSync(join(sessionsDir, `${name}${suffix}`), suffix, "utf8");
    }
  }

  test("moves every session sidecar, lists it and restores under a new name", () => {
    writeSession("original");
    const trashed = store.trash(["original"]);
    assert.equal(trashed.movedCount, 1);
    assert.equal(events[0].action, "trash");
    assert.equal(existsSync(join(sessionsDir, "original.jsonl")), false);

    const items = store.list();
    assert.equal(items.length, 1);
    assert.equal(items[0].name, "original");
    assert.equal(items[0].fileCount, 5);
    assert.equal("dir" in items[0], false);
    assert.equal("path" in items[0], false);

    const restored = store.restore(items[0].id, "renamed");
    assert.deepEqual(restored, { ok: true, restored: true, name: "renamed" });
    for (const suffix of [".jsonl", ".events.jsonl", ".pending.json", ".meta.json", ".plan.json"]) {
      assert.equal(readFileSync(join(sessionsDir, `renamed${suffix}`), "utf8"), suffix);
    }
    assert.equal(store.list().length, 0);
    assert.equal(events.at(-1).action, "restore");
  });

  test("rejects traversal IDs and invalid restored names", () => {
    writeSession("safe");
    store.trash(["safe"]);
    const id = store.list()[0].id;
    assert.equal(store.getEntry("../sessions"), null);
    assert.equal(store.restore(id, "../escape").ok, false);
    assert.equal(store.list().length, 1);
  });

  test("does not overwrite an existing restored session", () => {
    writeSession("source");
    store.trash(["source"]);
    const id = store.list()[0].id;
    writeFileSync(join(sessionsDir, "target.jsonl"), "existing", "utf8");
    const result = store.restore(id, "target");
    assert.equal(result.ok, false);
    assert.match(result.error, /already exists/);
    assert.equal(readFileSync(join(sessionsDir, "target.jsonl"), "utf8"), "existing");
    assert.equal(store.list().length, 1);
  });

  test("prunes expired entries using the configured retention", () => {
    writeSession("old");
    store.trash(["old"]);
    config.sessionTrashRetentionDays = 7;
    const result = store.pruneExpired(Date.parse("2026-07-20T10:00:00.000Z"));
    assert.deepEqual(result, { deleted: 1 });
    assert.equal(store.list({ prune: false }).length, 0);
  });

  test("validates retention and permanently deletes selected entries", () => {
    assert.equal(store.setRetentionDays(0).ok, false);
    assert.equal(store.setRetentionDays(366).ok, false);
    assert.deepEqual(store.setRetentionDays(45), { ok: true, retentionDays: 45, pruned: 0 });
    assert.equal(config.sessionTrashRetentionDays, 45);

    writeSession("delete-me");
    store.trash(["delete-me"]);
    const id = store.list()[0].id;
    const result = store.delete([id, "missing"]);
    assert.equal(result.deletedCount, 1);
    assert.equal(result.failedCount, 1);
    assert.equal(events.at(-1).action, "trash-delete");
  });
});
