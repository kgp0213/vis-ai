import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPromptQueueStore } from "../lib/prompt-queue-store.mjs";

describe("prompt queue store", () => {
  let root;
  let path;
  const normalizeScope = (value) => String(value || "default");
  const normalizeItem = (value) => value?.id && value?.text ? { id: value.id, text: value.text } : null;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "visionox-prompt-queue-")); path = join(root, "queue.json"); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("persists queue mutations and accepted request ids", () => {
    let now = 100;
    const store = createPromptQueueStore({ path, normalizeScope, normalizeItem, clock: () => now, acceptedTtlMs: 50 });
    assert.equal(store.upsert("one", { id: "a", text: "hello" }).ok, true);
    assert.equal(store.list("one")[0].text, "hello");
    store.rememberAccepted("a", { turnId: "turn-1" });
    assert.equal(store.acceptedRequest("a").turnId, "turn-1");
    now = 151;
    assert.equal(store.acceptedRequest("a"), null);
    assert.deepEqual(store.remove("one", "a").items, []);
    assert.equal(JSON.parse(readFileSync(path, "utf8")).version, 1);
  });

  test("enforces queue limits and rejects invalid items", () => {
    const store = createPromptQueueStore({ path, normalizeScope, normalizeItem, queueLimit: 1 });
    assert.equal(store.upsert("one", {}).ok, false);
    store.upsert("one", { id: "a", text: "one" });
    assert.match(store.upsert("one", { id: "b", text: "two" }).error, /queue limit/);
  });

  test("keeps malformed and newer stores read-only", () => {
    for (const body of ["{", '{"version":2,"queues":{},"accepted":[]}']) {
      writeFileSync(path, body);
      const issues = [];
      const store = createPromptQueueStore({ path, normalizeScope, normalizeItem, onIssue: (error) => issues.push(error) });
      assert.ok(store.status().readOnlyError);
      assert.throws(() => store.upsert("one", { id: "a", text: "one" }), /not modified/);
      assert.equal(readFileSync(path, "utf8"), body);
      assert.ok(issues[0]);
    }
  });
});
