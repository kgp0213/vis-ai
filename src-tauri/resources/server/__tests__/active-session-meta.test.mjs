import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createActiveSessionMetaStore } from "../lib/active-session-meta.mjs";

describe("active session metadata store", () => {
  let root;
  let path;
  let issues;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "visionox-active-meta-"));
    path = join(root, "active-session.meta.json");
    issues = [];
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("creates and updates metadata while preserving existing fields", () => {
    const store = createActiveSessionMetaStore({ path, onIssue: (error) => issues.push(error) });
    store.update(() => ({ workspace: "one", messageCount: 1 }));
    store.update((current) => ({ ...current, messageCount: 2 }));
    assert.deepEqual(store.read().value, { version: 1, workspace: "one", messageCount: 2 });
    assert.equal(issues.at(-1), null);
  });

  test("keeps malformed and newer metadata byte-for-byte unchanged", () => {
    const store = createActiveSessionMetaStore({ path, onIssue: (error) => issues.push(error) });
    for (const body of ["{", '{"version":2,"messageCount":9}']) {
      writeFileSync(path, body);
      assert.throws(() => store.update(() => ({ messageCount: 1 })), /original file was not modified/);
      assert.equal(readFileSync(path, "utf8"), body);
      assert.match(issues.at(-1), /invalid JSON|unsupported schema version/);
    }
  });
});
