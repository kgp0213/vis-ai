import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { commitScheduleMutation, readScheduleStore, writeScheduleStore } from "../lib/schedule-store.mjs";

const normalize = (item) => item?.id ? { ...item, id: String(item.id) } : null;

describe("schedule store", () => {
  it("reads legacy stores and rewrites them with the current schema", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-schedules-"));
    try {
      const path = join(root, "schedules.json");
      writeFileSync(path, JSON.stringify({ schedules: [{ id: "one" }] }), "utf8");
      const loaded = readScheduleStore(path, normalize);
      assert.equal(loaded.ok, true);
      assert.equal(loaded.source, "legacy");
      writeScheduleStore(path, loaded.schedules);
      assert.equal(JSON.parse(readFileSync(path, "utf8")).version, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps malformed and newer stores in an explicit error state", () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-schedules-invalid-"));
    try {
      const path = join(root, "schedules.json");
      writeFileSync(path, "{broken", "utf8");
      assert.equal(readScheduleStore(path, normalize).ok, false);
      writeFileSync(path, JSON.stringify({ version: 99, schedules: [] }), "utf8");
      assert.match(readScheduleStore(path, normalize).error, /unsupported/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not commit an in-memory mutation when persistence fails", () => {
    const current = [{ id: "one", enabled: true }];
    assert.throws(() => commitScheduleMutation(current, (next) => {
      next[0].enabled = false;
      return { ok: true, value: next[0] };
    }, () => {
      throw new Error("disk full");
    }), /disk full/);
    assert.equal(current[0].enabled, true);
  });
});
