import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  assertTaskContract,
  validateOutcomeEnvelope,
  validateTaskContract,
} from "./complex-task-contracts.mjs";
import { createComplexTaskStore } from "./complex-task-store.mjs";

function validContract(overrides = {}) {
  return {
    taskType: "document.markdown",
    goal: "Convert the source into a complete Markdown document",
    units: [
      { id: "unit-1", kind: "source", sourceRefs: ["page:1"] },
      { id: "unit-2", kind: "source", sourceRefs: ["page:2"] },
    ],
    output: { kind: "file", path: "result.md", format: "markdown" },
    ...overrides,
  };
}

function validOutcome(overrides = {}) {
  return {
    status: "completed_with_warnings",
    summary: "The document was produced and needs a small review.",
    artifacts: [{ id: "artifact-1", path: "result.md", sha256: "a".repeat(64) }],
    warnings: [{ code: "QUALITY_REVIEW", message: "Review one table." }],
    errors: [],
    ...overrides,
  };
}

async function withStore(options, fn) {
  const root = await mkdtemp(join(tmpdir(), "visionox-complex-task-"));
  try {
    return await fn(createComplexTaskStore(root, options), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("task contracts validate required goal, units, and output without accepting duplicates", () => {
  const contract = assertTaskContract(validContract());
  assert.equal(contract.version, 1);
  assert.equal(contract.taskType, "document.markdown");
  assert.deepEqual(contract.units.map((unit) => unit.status), ["pending", "pending"]);

  const duplicate = validateTaskContract(validContract({
    units: [{ id: "same", kind: "source" }, { id: "same", kind: "source" }],
  }));
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.some((error) => /unique/i.test(error)));
  assert.throws(() => assertTaskContract({}), (error) => {
    assert.equal(error.code, "INVALID_TASK_CONTRACT");
    return /goal/i.test(error.message);
  });
});

test("outcome envelopes are explicit and reject non-terminal statuses", () => {
  assert.equal(validateOutcomeEnvelope(validOutcome()).ok, true);
  const invalid = validateOutcomeEnvelope(validOutcome({ status: "running" }));
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => /terminal/i.test(error)));
});

test("generic task lifecycle uses revision CAS and persists a task-prefixed id", async () => {
  await withStore({}, async (store) => {
    const task = await store.create({ contract: validContract() });
    assert.match(task.id, /^task:[0-9a-f-]{36}$/i);
    assert.equal(task.status, "queued");
    assert.equal(task.revision, 0);

    const running = await store.transition(task.id, {
      expectedRevision: 0,
      status: "running",
    });
    assert.equal(running.applied, true);
    assert.equal(running.task.status, "running");
    assert.equal(running.task.revision, 1);

    const stale = await store.transition(task.id, {
      expectedRevision: 0,
      status: "paused",
    });
    assert.equal(stale.applied, false);
    assert.equal(stale.reason, "revision-mismatch");
    assert.equal((await store.read(task.id)).status, "running");

    const invalid = await store.transition(task.id, {
      expectedRevision: 1,
      status: "queued",
    });
    assert.equal(invalid.applied, false);
    assert.equal(invalid.reason, "invalid-transition");
  });
});

test("lease epochs fence stale workers and heartbeat extends the active lease", async () => {
  await withStore({}, async (store) => {
    const task = await store.create({ contract: validContract() });
    await store.transition(task.id, { expectedRevision: 0, status: "running" });

    const first = await store.acquireLease(task.id, {
      owner: "worker-a",
      ttlMs: 10,
      now: 1_000,
    });
    assert.equal(first.ok, true);
    assert.equal(first.epoch, 1);
    const heartbeat = await store.heartbeat(task.id, {
      leaseId: first.leaseId,
      epoch: first.epoch,
      owner: "worker-a",
      ttlMs: 500,
      now: 1_005,
    });
    assert.equal(heartbeat.ok, true);
    assert.equal(heartbeat.lease.expiresAt, 1_505);

    const blocked = await store.acquireLease(task.id, {
      owner: "worker-b",
      now: 1_100,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, "lease-held");

    const second = await store.acquireLease(task.id, {
      owner: "worker-b",
      ttlMs: 500,
      now: 1_600,
    });
    assert.equal(second.ok, true);
    assert.equal(second.epoch, 2);
    assert.notEqual(second.leaseId, first.leaseId);

    const staleHeartbeat = await store.heartbeat(task.id, {
      leaseId: first.leaseId,
      epoch: first.epoch,
      owner: "worker-a",
      now: 1_601,
    });
    assert.equal(staleHeartbeat.ok, false);
    assert.equal(staleHeartbeat.reason, "stale-lease");
  });
});

test("unit checkpoints require the current lease and remain readable after a store restart", async () => {
  await withStore({}, async (store, root) => {
    const task = await store.create({ contract: validContract() });
    await store.transition(task.id, { expectedRevision: 0, status: "running" });
    const lease = await store.acquireLease(task.id, { owner: "worker", ttlMs: 10_000, now: 10 });

    const saved = await store.checkpointUnit(task.id, "unit-1", {
      status: "completed",
      content: "first unit",
      sourceRefs: ["page:1"],
    }, { leaseId: lease.leaseId, epoch: lease.epoch, now: 20 });
    assert.equal(saved.applied, true);
    assert.equal(saved.task.unitResults["unit-1"].status, "completed");

    const stale = await store.checkpointUnit(task.id, "unit-2", {
      status: "completed",
      content: "late unit",
    }, { leaseId: "wrong", epoch: lease.epoch, now: 21 });
    assert.equal(stale.applied, false);
    assert.equal(stale.reason, "stale-lease");

    const restarted = createComplexTaskStore(root);
    const restored = await restarted.read(task.id);
    assert.equal(restored.unitResults["unit-1"].content, "first unit");
    assert.equal(restored.unitResults["unit-2"], undefined);
    const events = await restarted.readEvents(task.id);
    assert.ok(events.some((event) => event.type === "unit-checkpoint"));
    assert.ok(events.every((event, index) => event.sequence === index + 1));
  });
});

test("terminal outcome is idempotent and its outbox can be replayed after restart", async () => {
  await withStore({}, async (store, root) => {
    const task = await store.create({ contract: validContract() });
    await store.transition(task.id, { expectedRevision: 0, status: "running" });
    const lease = await store.acquireLease(task.id, { owner: "worker", ttlMs: 10_000, now: 10 });

    const completed = await store.complete(task.id, validOutcome(), {
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      now: 20,
    });
    assert.equal(completed.applied, true);
    assert.equal(completed.task.status, "completed_with_warnings");
    assert.equal(completed.task.outcome.summary, validOutcome().summary);
    assert.equal((await store.listPendingOutbox()).length, 1);

    const duplicate = await store.complete(task.id, validOutcome(), {
      leaseId: lease.leaseId,
      epoch: lease.epoch,
      now: 21,
    });
    assert.equal(duplicate.applied, false);
    assert.equal(duplicate.reason, "already-terminal");
    assert.equal((await store.listPendingOutbox()).length, 1);

    const restarted = createComplexTaskStore(root);
    const pending = await restarted.listPendingOutbox();
    assert.equal(pending[0].taskId, task.id);
    assert.equal(pending[0].payload.summary, validOutcome().summary);
    const acked = await restarted.ackOutbox(task.id, pending[0].deliveryId);
    assert.equal(acked.applied, true);
    assert.equal((await restarted.listPendingOutbox()).length, 0);
    assert.equal((await restarted.read(task.id)).outbox[0].acknowledged, true);
  });
});

test("retention removes only acknowledged terminal tasks and never live or undelivered tasks", async () => {
  await withStore({ retentionMs: 0 }, async (store) => {
    const delivered = await store.create({ contract: validContract() });
    await store.transition(delivered.id, { expectedRevision: 0, status: "running" });
    const lease = await store.acquireLease(delivered.id, { owner: "worker", ttlMs: 10_000, now: 1 });
    await store.complete(delivered.id, validOutcome(), { leaseId: lease.leaseId, epoch: lease.epoch, now: 2 });
    const delivery = (await store.listPendingOutbox())[0];
    await store.ackOutbox(delivered.id, delivery.deliveryId);

    const undelivered = await store.create({ contract: validContract({ goal: "Keep this result" }) });
    await store.transition(undelivered.id, { expectedRevision: 0, status: "running" });
    const lease2 = await store.acquireLease(undelivered.id, { owner: "worker", ttlMs: 10_000, now: 1 });
    await store.complete(undelivered.id, validOutcome({ summary: "Pending delivery" }), { leaseId: lease2.leaseId, epoch: lease2.epoch, now: 2 });

    const live = await store.create({ contract: validContract({ goal: "Keep live task" }) });
    const result = await store.pruneExpired(10_000);
    assert.deepEqual(result.deleted, [delivered.id]);
    assert.ok(result.kept >= 2);
    assert.equal((await store.read(delivered.id).catch(() => null)), null);
    assert.equal((await store.read(undelivered.id)).status, "completed_with_warnings");
    assert.equal((await store.read(live.id)).status, "queued");
  });
});

test("event log survives malformed tail without hiding valid history", async () => {
  await withStore({}, async (store, root) => {
    const task = await store.create({ contract: validContract() });
    const eventsPath = join(root, encodeURIComponent(task.id), "events.jsonl");
    await readFile(eventsPath, "utf8");
    const { appendFile } = await import("node:fs/promises");
    await appendFile(eventsPath, "{broken\n", "utf8");
    const events = await store.readEvents(task.id);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "created");
  });
});
