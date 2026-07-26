import assert from "node:assert/strict";
import test from "node:test";

import { createContextEpochRuntime } from "./context-epoch.mjs";

function harness() {
  let id = 0;
  let tick = 0;
  const events = [];
  const runtime = createContextEpochRuntime({
    idFactory: () => `id-${++id}`,
    now: () => `2026-07-26T00:00:0${tick++}.000Z`,
    maxSnapshotBytes: 128,
    onEvent: (event) => events.push(event),
  });
  return { runtime, events };
}

test("initializes and reconciles a stable session context epoch", () => {
  const h = harness();
  const first = h.runtime.prepare({
    sessionId: "session-1",
    workspace: "C:\\work",
    baseline: "system v1",
    snapshot: { skills: ["a"], model: "kimi" },
    baselineSeq: 3,
  });
  assert.equal(first.action, "initialized");
  assert.equal(first.epoch.revision, 1);

  const same = h.runtime.prepare({
    sessionId: "session-1",
    workspace: "C:\\work",
    baseline: "system v1",
    snapshot: { model: "kimi", skills: ["a"] },
  });
  assert.equal(same.action, "unchanged");
  assert.equal(same.epoch.revision, 1);

  const changed = h.runtime.prepare({
    sessionId: "session-1",
    workspace: "C:\\work",
    baseline: "system v1",
    snapshot: { model: "kimi", skills: ["a", "b"] },
  });
  assert.equal(changed.action, "reconciled");
  assert.equal(changed.epoch.revision, 2);
  assert.equal(h.runtime.get("session-1").baselineHash, first.epoch.baselineHash);
});

test("compaction requests replace the baseline only at the next prepare boundary", () => {
  const h = harness();
  h.runtime.prepare({ sessionId: "s", workspace: "w", baseline: "old", snapshot: { n: 1 } });
  const requested = h.runtime.requestReplacement("s", "compaction");
  assert.equal(requested.accepted, true);
  assert.equal(requested.epoch.replacementRequested, true);
  assert.equal(h.runtime.get("s").baselineHash, h.runtime.get("s").baselineHash);

  const replaced = h.runtime.prepare({ sessionId: "s", workspace: "w", baseline: "new", snapshot: { n: 2 } });
  assert.equal(replaced.action, "replaced");
  assert.equal(replaced.epoch.revision, 2);
  assert.equal(replaced.epoch.replacementRequested, false);
  assert.equal(h.runtime.modelBaseline("s").baseline, "new");
});

test("blocks a stale location instead of silently rewriting the epoch", () => {
  const h = harness();
  const first = h.runtime.prepare({ sessionId: "s", workspace: "C:\\old", baseline: "base", snapshot: {} });
  const blocked = h.runtime.prepare({ sessionId: "s", workspace: "C:\\new", baseline: "base", snapshot: {} });
  assert.equal(blocked.action, "blocked");
  assert.equal(blocked.code, "CONTEXT_EPOCH_LOCATION_CHANGED");
  assert.equal(h.runtime.get("s").workspace, "C:\\old");
  assert.equal(first.epoch.revision, 1);
});

test("rejects oversized snapshots without mutating the prior epoch", () => {
  const h = harness();
  h.runtime.prepare({ sessionId: "s", workspace: "w", baseline: "base", snapshot: { n: 1 } });
  assert.throws(
    () => h.runtime.prepare({ sessionId: "s", workspace: "w", baseline: "base", snapshot: { body: "x".repeat(200) } }),
    (error) => error.code === "INVALID_CONTEXT_EPOCH",
  );
  assert.equal(h.runtime.get("s").revision, 1);
});
