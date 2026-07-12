import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUserDataBackupStore } from "../lib/user-data-backup.mjs";

describe("user data backups", () => {
  let root;
  let dataDir;
  let workspaceDir;
  let store;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "visionox-backup-test-"));
    dataDir = join(root, "home");
    workspaceDir = join(root, "workspace");
    mkdirSync(join(dataDir, "sessions"), { recursive: true });
    mkdirSync(join(dataDir, "memory"), { recursive: true });
    mkdirSync(join(workspaceDir, "knowledge"), { recursive: true });
    writeFileSync(join(dataDir, "config.json"), '{"mode":"general"}\n');
    writeFileSync(join(dataDir, "soul.md"), "Be precise.\n");
    writeFileSync(join(dataDir, "sessions", "one.jsonl"), '{"role":"user"}\n');
    writeFileSync(join(dataDir, "memory", "preference.md"), "Use tables.\n");
    writeFileSync(join(workspaceDir, "knowledge", "topic.md"), "Reusable result.\n");
    store = createUserDataBackupStore({
      dataDir,
      getWorkspaceDir: () => workspaceDir,
      appVersion: "1.28.0",
      now: () => new Date("2026-07-12T08:00:00.000Z"),
      uuid: () => "fixed-id",
    });
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("creates a checksummed allowlist backup and reports health", () => {
    const manifest = store.create();
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.appVersion, "1.28.0");
    assert.equal(manifest.fileCount, 5);
    assert.ok(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
    assert.deepEqual(new Set(manifest.files.map((file) => file.source)), new Set(["config", "soul", "sessions", "memory", "knowledge"]));
    assert.equal(store.list()[0].status, "ok");
    const health = store.health();
    assert.equal(health.backups.count, 1);
    assert.equal(health.backups.corrupt, 0);
    assert.equal(health.backups.latestAt, "2026-07-12T08:00:00.000Z");
    assert.ok(health.totalBytes > 0);
    assert.equal(health.sources["session-trash"].exists, false);
  });

  test("preview distinguishes same, missing and conflicts; restore is conflict-safe", () => {
    const backup = store.create();
    rmSync(join(dataDir, "sessions", "one.jsonl"));
    writeFileSync(join(dataDir, "soul.md"), "Changed.\n");
    let preview = store.inspect(backup.id);
    assert.equal(preview.counts.missing, 1);
    assert.equal(preview.counts.conflict, 1);
    assert.equal(preview.counts.same, 3);

    const safe = store.restore(backup.id);
    assert.equal(safe.restored, 1);
    assert.equal(safe.skipped, 4);
    assert.match(readFileSync(join(dataDir, "soul.md"), "utf8"), /Changed/);
    assert.ok(existsSync(join(dataDir, "sessions", "one.jsonl")));

    const forced = store.restore(backup.id, { overwrite: true });
    assert.equal(forced.restored, 1);
    assert.match(readFileSync(join(dataDir, "soul.md"), "utf8"), /Be precise/);
    preview = store.inspect(backup.id);
    assert.equal(preview.counts.same, 5);
  });

  test("rejects traversal ids and refuses corrupt backups", () => {
    assert.throws(() => store.inspect("../outside"), /invalid backup id/);
    const backup = store.create();
    const archivedSoul = join(dataDir, "backups", "snapshots", backup.id, "data", "home", "soul.md");
    writeFileSync(archivedSoul, "tampered\n");
    const preview = store.inspect(backup.id);
    assert.equal(preview.counts.corrupt, 1);
    assert.throws(() => store.restore(backup.id), /integrity check failed/);
  });

  test("marks invalid manifests corrupt and ignores symbolic links", () => {
    mkdirSync(join(dataDir, "backups", "snapshots", "bad"), { recursive: true });
    writeFileSync(join(dataDir, "backups", "snapshots", "bad", "manifest.json"), '{"schemaVersion":99}\n');
    try { symlinkSync(join(dataDir, "soul.md"), join(dataDir, "memory", "linked.md")); } catch {}
    const backup = store.create();
    assert.equal(backup.files.some((file) => file.path === "linked.md"), false);
    assert.equal(store.list().some((item) => item.id === "bad" && item.status === "corrupt"), true);
    assert.equal(store.health().backups.corrupt, 1);
  });

  test("validates construction and supports an empty source set", () => {
    assert.throws(() => createUserDataBackupStore(), /dataDir and backupDir/);
    assert.throws(() => createUserDataBackupStore({ dataDir, backupDir: dataDir }), /must be the backups\/snapshots directory/);
    assert.throws(() => createUserDataBackupStore({ dataDir, backupDir: join(dataDir, "backups") }), /must be the backups\/snapshots directory/);
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(workspaceDir, { recursive: true, force: true });
    const empty = createUserDataBackupStore({ dataDir, getWorkspaceDir: () => null, now: () => new Date("2026-01-01T00:00:00Z"), uuid: () => "empty" });
    assert.equal(empty.create().fileCount, 0);
    assert.equal(empty.health().totalBytes, 0);
  });

  test("caches health scans briefly and refreshes after the TTL", () => {
    let timestamp = 1_000;
    const cached = createUserDataBackupStore({ dataDir, getWorkspaceDir: () => workspaceDir, clock: () => timestamp });
    const before = cached.health();
    writeFileSync(join(dataDir, "sessions", "two.jsonl"), "more data\n");
    assert.equal(cached.health(), before);
    timestamp += 15_000;
    const refreshed = cached.health();
    assert.notEqual(refreshed, before);
    assert.ok(refreshed.totalBytes > before.totalBytes);
  });

  test("estimates size, prunes oldest snapshots and supports explicit deletion", () => {
    const first = store.create();
    store = createUserDataBackupStore({ dataDir, getWorkspaceDir: () => workspaceDir, appVersion: "1.28.0", now: () => new Date("2026-07-12T09:00:00Z"), uuid: () => "second" });
    const second = store.create();
    const estimate = store.estimate();
    assert.equal(estimate.fileCount, 5);
    assert.ok(estimate.estimatedBytes > 0);
    assert.ok(estimate.freeBytes === null || estimate.freeBytes > 0);
    assert.deepEqual(store.prune(1).deletedIds, [first.id]);
    assert.equal(store.remove(second.id).deleted, true);
    assert.equal(store.remove(second.id).deleted, false);
  });
});
