import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLongTaskHandoffPrompt,
  createLongTaskHandoffCoordinator,
  longTaskNeedsAttention,
} from "./long-task-handoff.mjs";

function makeJob(overrides = {}) {
  return {
    id: "job-1",
    kind: "document",
    status: "completed",
    revision: 7,
    executionEpoch: { id: "epoch-1" },
    outputPath: "D:/workspace/result.md",
    error: null,
    warnings: [],
    progress: { completedUnits: 10, totalUnits: 10 },
    origin: {
      conversationId: "conversation-a",
      userPrompt: "把这份文档完整整理成 Markdown",
      mode: "general",
      workspace: "D:/workspace",
    },
    handoff: { state: "waiting_worker", attempts: 0 },
    ...overrides,
  };
}

function createHarness({
  busy = false,
  conversationId = "conversation-a",
  dispatchResult,
  dispatch,
  dispatchTimeoutMs,
  instanceId = "test-instance",
  loadJob,
  verifyDelivery,
  beforeGuardedPersist,
  jobStore,
} = {}) {
  const jobs = jobStore ?? new Map();
  const dispatched = [];
  const notifications = [];
  let foregroundBusy = busy;
  let activeConversationId = conversationId;
  let activeWorkspace = "D:/workspace";
  const coordinator = createLongTaskHandoffCoordinator({
    instanceId,
    dispatchTimeoutMs,
    isBusy: () => foregroundBusy,
    getConversationId: () => activeConversationId,
    getWorkspace: () => activeWorkspace,
    loadJob: async (id) => loadJob ? loadJob(id, jobs) : jobs.get(id) ?? null,
    persist: async (id, handoff, guard = {}) => {
      if (guard.expected) beforeGuardedPersist?.({ id, handoff, expected: guard.expected, jobs });
      const job = jobs.get(id);
      if (guard.expected) {
        const current = job?.handoff ?? {};
        const mismatch = Object.entries(guard.expected).some(([key, expected]) => {
          if (key === "userControlled") return (current.userControlled === true) !== (expected === true);
          return current[key] !== expected;
        });
        if (mismatch) return { applied: false, reason: "handoff-compare-failed", job };
      }
      jobs.set(id, { ...job, handoff: { ...(job?.handoff ?? {}), ...handoff } });
      return { applied: true, job: jobs.get(id) };
    },
    dispatch: async (request) => {
      dispatched.push({
        id: request.job.id,
        prompt: request.prompt,
        dispatchId: request.dispatchId,
        attemptId: request.attemptId ?? null,
        terminalKey: request.terminalKey,
      });
      if (typeof dispatch === "function") return dispatch(request);
      return dispatchResult ?? { accepted: true, completed: true, ok: true, assistantText: "已交付" };
    },
    verifyDelivery,
    notify: (notice) => notifications.push(notice),
  });
  return {
    coordinator,
    dispatched,
    jobs,
    notifications,
    setBusy(value) { foregroundBusy = value; },
    setConversationId(value) { activeConversationId = value; },
    setWorkspace(value) { activeWorkspace = value; },
    add(job) { jobs.set(job.id, job); return job; },
  };
}

test("completed, warning, failed, and system-paused tasks hand back to the agent once", async () => {
  for (const status of ["completed", "completed_with_warnings", "failed", "paused", "interrupted", "source_changed"]) {
    const harness = createHarness();
    const job = harness.add(makeJob({ id: `job-${status}`, status }));
    await harness.coordinator.observe(job, { deferDrain: true });
    await harness.coordinator.drain();
    assert.deepEqual(harness.dispatched.map((item) => item.id), [job.id], status);
    assert.equal(harness.jobs.get(job.id).handoff.state, "delivered", status);
    await harness.coordinator.observe(harness.jobs.get(job.id), { deferDrain: true });
    await harness.coordinator.drain();
    assert.equal(harness.dispatched.length, 1, `${status} must not dispatch twice`);
  }
});

test("a delivered handoff notice carries the stable terminal identity", async () => {
  const harness = createHarness();
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();
  const notice = harness.notifications.find((item) => item.kind === "handoff-delivered");
  assert.equal(notice?.terminalKey, "job-1:epoch-1:completed");
  assert.match(notice?.dispatchId ?? "", /^job-1:epoch-1:completed:/);
});

test("a completed artifact cannot be marked delivered when the host integrity proof fails", async () => {
  const verified = [];
  const harness = createHarness({
    verifyDelivery: async ({ job }) => {
      verified.push(job.id);
      return { ok: false, artifactStatus: "modified", error: "输出文件与后台最终草稿不一致" };
    },
  });
  const job = harness.add(makeJob());

  await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();

  assert.deepEqual(verified, [job.id]);
  assert.equal(harness.jobs.get(job.id).handoff.state, "needs_user");
  assert.match(harness.jobs.get(job.id).handoff.lastError, /最终草稿不一致/);
  assert.equal(harness.notifications.at(-1).kind, "handoff-failed");
});

test("foreground work defers handoff and drains tasks in FIFO order when idle", async () => {
  const harness = createHarness({ busy: true });
  const first = harness.add(makeJob({ id: "job-first", executionEpoch: { id: "epoch-first" } }));
  const second = harness.add(makeJob({ id: "job-second", executionEpoch: { id: "epoch-second" } }));
  await harness.coordinator.observe(first, { deferDrain: true });
  await harness.coordinator.observe(second, { deferDrain: true });
  await harness.coordinator.drain();
  assert.equal(harness.dispatched.length, 0);
  assert.equal(harness.jobs.get(first.id).handoff.state, "queued");

  harness.setBusy(false);
  await harness.coordinator.drain();
  assert.deepEqual(harness.dispatched.map((item) => item.id), ["job-first", "job-second"]);
});

test("a task never injects its handoff into a different active conversation", async () => {
  const harness = createHarness({ conversationId: "conversation-b" });
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();
  assert.equal(harness.dispatched.length, 0);
  assert.equal(harness.jobs.get(job.id).handoff.state, "waiting_conversation");
  assert.equal(harness.notifications.at(-1).kind, "waiting-conversation");

  harness.setConversationId("conversation-a");
  await harness.coordinator.observe(harness.jobs.get(job.id), { deferDrain: true });
  await harness.coordinator.drain();
  assert.equal(harness.dispatched.length, 1);
  assert.equal(harness.jobs.get(job.id).handoff.state, "delivered");
});

test("a task waits when the same conversation has switched to another workspace", async () => {
  const harness = createHarness();
  harness.setWorkspace("D:/another-workspace");
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });
  assert.equal(harness.jobs.get(job.id).handoff.state, "waiting_conversation");
  assert.equal(harness.dispatched.length, 0);

  harness.setWorkspace("D:/workspace");
  await harness.coordinator.observe(harness.jobs.get(job.id), { deferDrain: true });
  await harness.coordinator.drain();
  assert.equal(harness.dispatched.length, 1);
});

test("user-stopped and abandoned tasks do not auto-resume or summon the model", async () => {
  const harness = createHarness();
  for (const status of ["stopped", "abandoned", "cancelled"]) {
    const job = harness.add(makeJob({ id: `job-${status}`, status }));
    const result = await harness.coordinator.observe(job, { deferDrain: true });
    assert.equal(result.accepted, false);
  }
  await harness.coordinator.drain();
  assert.equal(harness.dispatched.length, 0);
});

test("an isolated or scheduled task never injects its result into the active chat", async () => {
  const harness = createHarness();
  const job = harness.add(makeJob({
    origin: {
      conversationId: "conversation-a",
      userPrompt: "定时整理文档",
      mode: "general",
      workspace: "D:/workspace",
      autoHandoff: false,
      conversationScope: "isolated",
    },
  }));
  const result = await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "external-delivery-channel");
  assert.equal(harness.dispatched.length, 0);
});

test("a user-paused task remains visible but never auto-summons the model", async () => {
  const harness = createHarness();
  const job = harness.add(makeJob({
    status: "paused",
    handoff: { state: "user_paused", userControlled: true },
  }));
  const result = await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();
  assert.equal(result.reason, "user-controlled");
  assert.equal(harness.dispatched.length, 0);
  assert.equal(longTaskNeedsAttention(job), true);
});

test("a failed automatic handoff remains visible as needing user attention", async () => {
  const harness = createHarness({ dispatchResult: { accepted: true, completed: true, ok: false, error: "model unavailable" } });
  const job = harness.add(makeJob({ status: "failed", error: "provider quota exhausted" }));
  await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();
  const persisted = harness.jobs.get(job.id);
  assert.equal(persisted.handoff.state, "needs_user");
  assert.equal(longTaskNeedsAttention(persisted), true);
  assert.equal(harness.notifications.at(-1).kind, "handoff-failed");
});

test("a user-approved retry creates a new delivery attempt without rerunning the document task", async () => {
  const harness = createHarness();
  const terminalKey = "job-1:epoch-1:completed";
  const executionEpoch = { id: "epoch-1", startedAt: "2026-07-19T09:00:00.000Z" };
  const batches = [{ id: "batch-1", status: "completed", unitCount: 10 }];
  const artifact = { path: "D:/workspace/result.md", sha256: "artifact-proof" };
  const job = harness.add(makeJob({
    status: "completed",
    executionEpoch,
    batches,
    modelCallCount: 17,
    artifact,
    handoff: {
      state: "needs_user",
      terminalKey,
      terminalStatus: "completed",
      attempts: 1,
      dispatchId: `${terminalKey}:old-instance:1`,
      failedAt: "2026-07-19T10:00:00.000Z",
      lastError: "model service was unavailable",
    },
  }));

  const approved = await harness.coordinator.retryDelivery(job, { deferDrain: true });
  const queued = harness.jobs.get(job.id);

  assert.equal(approved.accepted, true);
  assert.match(approved.attemptId, /^attempt:/);
  assert.equal(queued.status, "completed", "delivery retry must not change the business-task status");
  assert.deepEqual(queued.executionEpoch, executionEpoch, "delivery retry must preserve the execution epoch");
  assert.deepEqual(queued.batches, batches, "delivery retry must preserve completed batch evidence");
  assert.equal(queued.modelCallCount, 17, "delivery retry must not change model work evidence");
  assert.equal(queued.outputPath, "D:/workspace/result.md", "delivery retry must preserve the output path");
  assert.deepEqual(queued.artifact, artifact, "delivery retry must preserve the artifact proof");
  assert.equal(queued.handoff.state, "queued");
  assert.equal(queued.handoff.attemptId, approved.attemptId);
  assert.equal(queued.handoff.deliveryHistory.at(-1).lastError, "model service was unavailable");

  await harness.coordinator.drain();

  assert.equal(harness.dispatched.length, 1);
  assert.equal(harness.dispatched[0].attemptId, approved.attemptId);
  assert.equal(harness.dispatched[0].terminalKey, terminalKey);
  assert.equal(harness.jobs.get(job.id).handoff.state, "delivered");
  assert.equal(harness.jobs.get(job.id).handoff.attemptId, approved.attemptId);
});

test("a restarted coordinator resumes the same approved delivery attempt", async () => {
  const terminalKey = "job-1:epoch-1:completed";
  const attemptId = "attempt:user-approved";
  const persisted = makeJob({
    status: "completed",
    handoff: {
      state: "queued",
      terminalKey,
      terminalStatus: "completed",
      attemptId,
      attempts: 1,
      leaseId: "instance-before-restart",
      queuedAt: "2026-07-19T10:00:00.000Z",
    },
  });
  const harness = createHarness({ instanceId: "instance-after-restart" });
  harness.add(persisted);

  await harness.coordinator.rehydrate([persisted]);

  assert.equal(harness.dispatched.length, 1);
  assert.equal(harness.dispatched[0].attemptId, attemptId);
  assert.equal(harness.jobs.get(persisted.id).handoff.attemptId, attemptId);
  assert.equal(harness.jobs.get(persisted.id).status, "completed");
});

test("a legacy terminal job keeps its first handoff key after persistence changes the manifest revision", async () => {
  const harness = createHarness();
  const legacy = harness.add(makeJob({
    executionEpoch: null,
    completedAt: null,
    stoppedAt: null,
    handoff: { state: "waiting_worker", attempts: 0 },
  }));

  await harness.coordinator.observe(legacy, { deferDrain: true });
  await harness.coordinator.drain();

  assert.equal(harness.dispatched.length, 1);
  assert.equal(harness.jobs.get(legacy.id).handoff.state, "delivered");
});

test("delivery retry is terminal-only and one user approval creates at most one attempt", async () => {
  const harness = createHarness();
  const running = harness.add(makeJob({ id: "job-running", status: "running", handoff: { state: "running" } }));
  assert.equal((await harness.coordinator.retryDelivery(running, { deferDrain: true })).reason, "not-auto-handoff-terminal");

  const blocked = harness.add(makeJob({
    id: "job-blocked-delivery",
    handoff: {
      state: "needs_user",
      terminalKey: "job-blocked-delivery:epoch-1:completed",
      terminalStatus: "completed",
      attempts: 1,
      lastError: "delivery failed",
    },
  }));
  const first = await harness.coordinator.retryDelivery(blocked, { deferDrain: true });
  const second = await harness.coordinator.retryDelivery(blocked, { deferDrain: true });

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(second.reason, "delivery-not-retryable");
  assert.equal(harness.coordinator.pendingCount(), 1);
});

test("two coordinator instances cannot approve the same delivery retry twice", async () => {
  const jobs = new Map();
  const first = createHarness({ instanceId: "instance-first", jobStore: jobs });
  const second = createHarness({ instanceId: "instance-second", jobStore: jobs });
  const job = first.add(makeJob({
    handoff: {
      state: "needs_user",
      terminalKey: "job-1:epoch-1:completed",
      terminalStatus: "completed",
      attempts: 1,
      lastError: "delivery failed",
    },
  }));

  const results = await Promise.all([
    first.coordinator.retryDelivery(job, { deferDrain: true }),
    second.coordinator.retryDelivery(job, { deferDrain: true }),
  ]);

  assert.equal(results.filter((result) => result.accepted).length, 1);
  assert.equal(results.filter((result) => result.reason === "delivery-retry-race").length, 1);
  assert.equal(first.coordinator.pendingCount() + second.coordinator.pendingCount(), 1);
});

test("delivery retry refuses a persisted job that was already deleted", async () => {
  const harness = createHarness({ loadJob: async () => null });
  const job = harness.add(makeJob({
    handoff: {
      state: "needs_user",
      terminalKey: "job-1:epoch-1:completed",
      terminalStatus: "completed",
      attempts: 1,
      lastError: "delivery failed",
    },
  }));

  const result = await harness.coordinator.retryDelivery(job, { deferDrain: true });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "delivery-job-missing");
  assert.equal(harness.coordinator.pendingCount(), 0);
});

test("delivery retry never injects into the wrong conversation and resumes after context returns", async () => {
  const harness = createHarness({ conversationId: "conversation-other" });
  const job = harness.add(makeJob({
    handoff: {
      state: "needs_user",
      terminalKey: "job-1:epoch-1:completed",
      terminalStatus: "completed",
      attempts: 1,
      lastError: "delivery failed",
    },
  }));

  const approved = await harness.coordinator.retryDelivery(job, { deferDrain: true });
  assert.equal(approved.accepted, true);
  assert.equal(approved.waitingConversation, true);
  assert.equal(harness.jobs.get(job.id).handoff.state, "waiting_conversation");
  assert.equal(harness.dispatched.length, 0);

  harness.setConversationId("conversation-a");
  await harness.coordinator.rehydrate([harness.jobs.get(job.id)]);

  assert.equal(harness.dispatched.length, 1);
  assert.equal(harness.dispatched[0].attemptId, approved.attemptId);
  assert.equal(harness.jobs.get(job.id).handoff.state, "delivered");
});

test("a stalled handoff times out and does not block later FIFO items", async () => {
  let stalledSignal = null;
  const harness = createHarness({
    dispatchTimeoutMs: 10,
    dispatch: ({ job, signal }) => {
      if (job.id !== "job-stalled") return Promise.resolve({ accepted: true, completed: true, ok: true, assistantText: "已交付" });
      stalledSignal = signal;
      return new Promise((resolve) => setTimeout(() => resolve({ accepted: true, completed: true, ok: true }), 80));
    },
  });
  const stalled = harness.add(makeJob({ id: "job-stalled", executionEpoch: { id: "epoch-stalled" } }));
  const later = harness.add(makeJob({ id: "job-later", executionEpoch: { id: "epoch-later" } }));
  await harness.coordinator.observe(stalled, { deferDrain: true });
  await harness.coordinator.observe(later, { deferDrain: true });

  const startedAt = Date.now();
  await harness.coordinator.drain();

  assert.ok(Date.now() - startedAt < 70, "the queue must not wait for the stalled model turn");
  assert.equal(stalledSignal?.aborted, true, "the timed-out model turn must receive an abort signal");
  assert.equal(harness.jobs.get(stalled.id).handoff.state, "needs_user");
  assert.match(harness.jobs.get(stalled.id).handoff.lastError, /timed out/i);
  assert.equal(harness.jobs.get(later.id).handoff.state, "delivered");
});

test("a single persisted-job read failure does not discard later FIFO handoffs", async () => {
  const harness = createHarness({
    loadJob: async (id, jobs) => {
      if (id === "job-corrupt") throw new Error("manifest read failed");
      return jobs.get(id) ?? null;
    },
  });
  const corrupt = harness.add(makeJob({ id: "job-corrupt", executionEpoch: { id: "epoch-corrupt" } }));
  const later = harness.add(makeJob({ id: "job-after-corrupt", executionEpoch: { id: "epoch-after-corrupt" } }));
  await harness.coordinator.observe(corrupt, { deferDrain: true });
  await harness.coordinator.observe(later, { deferDrain: true });

  const result = await harness.coordinator.drain();

  assert.equal(result.processed, 1);
  assert.deepEqual(harness.dispatched.map((item) => item.id), [later.id]);
  assert.ok(harness.notifications.some((notice) => notice.kind === "coordinator-error" && /manifest read failed/.test(notice.error)));
});

test("rehydration isolates one broken job and still restores later handoffs", async () => {
  const harness = createHarness({
    loadJob: async (id, jobs) => {
      if (id === "job-corrupt") throw new Error("manifest read failed during recovery");
      return jobs.get(id) ?? null;
    },
  });
  const corrupt = harness.add(makeJob({ id: "job-corrupt", executionEpoch: { id: "epoch-corrupt" } }));
  const later = harness.add(makeJob({ id: "job-after-corrupt", executionEpoch: { id: "epoch-after-corrupt" } }));

  await harness.coordinator.rehydrate([corrupt, later]);

  assert.deepEqual(harness.dispatched.map((item) => item.id), [later.id]);
  assert.ok(harness.notifications.some((notice) => notice.kind === "coordinator-error" && notice.jobId === corrupt.id));
});

test("a user lifecycle action wins over a stale handoff completion", async () => {
  let harness;
  harness = createHarness({
    dispatch: async ({ job }) => {
      const current = harness.jobs.get(job.id);
      harness.jobs.set(job.id, {
        ...current,
        status: "stopped",
        handoff: {
          ...current.handoff,
          state: "user_paused",
          userControlled: true,
          terminalKey: null,
          leaseId: null,
        },
      });
      return { accepted: true, completed: true, ok: true, assistantText: "旧轮次声称已交付" };
    },
  });
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();

  assert.equal(harness.jobs.get(job.id).status, "stopped");
  assert.equal(harness.jobs.get(job.id).handoff.state, "user_paused");
  assert.equal(harness.jobs.get(job.id).handoff.userControlled, true);
});

test("a user lifecycle action immediately before the running claim prevents dispatch", async () => {
  let claimInterrupted = false;
  const harness = createHarness({
    beforeGuardedPersist: ({ id, handoff, jobs }) => {
      if (handoff.state !== "running" || claimInterrupted) return;
      claimInterrupted = true;
      const current = jobs.get(id);
      jobs.set(id, {
        ...current,
        status: "stopped",
        handoff: {
          ...current.handoff,
          state: "user_paused",
          userControlled: true,
          terminalKey: null,
          leaseId: null,
          dispatchId: null,
        },
      });
    },
  });
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();

  const persisted = harness.jobs.get(job.id);
  assert.equal(claimInterrupted, true);
  assert.equal(harness.dispatched.length, 0);
  assert.equal(persisted.status, "stopped");
  assert.equal(persisted.handoff.state, "user_paused");
  assert.equal(persisted.handoff.userControlled, true);
});

test("a queued handoff is discarded when its persisted job disappears", async () => {
  const harness = createHarness();
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });
  assert.equal(harness.coordinator.pendingCount(), 1);
  harness.jobs.delete(job.id);

  const result = await harness.coordinator.drain();

  assert.equal(result.pending, 0);
  assert.equal(harness.dispatched.length, 0);
  assert.equal(harness.jobs.has(job.id), false);
});

test("a failed queued-state commit never leaves an in-memory handoff to dispatch", async () => {
  const harness = createHarness({
    beforeGuardedPersist: ({ handoff }) => {
      if (handoff.state === "queued") throw new Error("manifest queue commit failed");
    },
  });
  const job = harness.add(makeJob());

  await assert.rejects(
    harness.coordinator.observe(job, { deferDrain: true }),
    /manifest queue commit failed/,
  );
  assert.equal(harness.coordinator.pendingCount(), 0);

  await harness.coordinator.drain();
  assert.equal(harness.dispatched.length, 0);
});

test("a failed busy requeue commit removes the stale in-memory retry", async () => {
  let queuedWrites = 0;
  let harness;
  harness = createHarness({
    beforeGuardedPersist: ({ handoff }) => {
      if (handoff.state !== "queued") return;
      queuedWrites++;
      if (queuedWrites > 1) throw new Error("manifest requeue commit failed");
    },
    dispatch: async () => {
      harness.setBusy(true);
      return { accepted: false, completed: false, reason: "foreground busy" };
    },
  });
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });

  const result = await harness.coordinator.drain();

  assert.equal(result.pending, 0);
  assert.equal(harness.coordinator.pendingCount(), 0);
  assert.equal(harness.dispatched.length, 1);
  assert.ok(harness.notifications.some((notice) => notice.kind === "coordinator-error" && /requeue commit failed/.test(notice.error)));
});

test("a busy requeue cannot overwrite a newer delivery attempt identity", async () => {
  let queuedWrites = 0;
  let harness;
  harness = createHarness({
    beforeGuardedPersist: ({ id, handoff, jobs }) => {
      if (handoff.state !== "queued") return;
      queuedWrites++;
      if (queuedWrites !== 2) return;
      const current = jobs.get(id);
      jobs.set(id, {
        ...current,
        handoff: { ...current.handoff, attemptId: "attempt:newer-owner" },
      });
    },
    dispatch: async () => {
      harness.setBusy(true);
      return { accepted: false, completed: false, reason: "foreground busy" };
    },
  });
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });

  const result = await harness.coordinator.drain();

  assert.equal(result.pending, 0);
  assert.equal(harness.jobs.get(job.id).handoff.state, "running");
  assert.equal(harness.jobs.get(job.id).handoff.attemptId, "attempt:newer-owner");
});

test("delivery verification cannot complete a stale execution epoch", async () => {
  let harness;
  harness = createHarness({
    verifyDelivery: async ({ job }) => {
      const current = harness.jobs.get(job.id);
      harness.jobs.set(job.id, {
        ...current,
        status: "completed_with_warnings",
        executionEpoch: { id: "epoch-2" },
        handoff: { ...current.handoff },
      });
      return { ok: true, artifactStatus: "verified" };
    },
  });
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();

  const persisted = harness.jobs.get(job.id);
  assert.equal(harness.dispatched.length, 1);
  assert.equal(persisted.status, "completed_with_warnings");
  assert.equal(persisted.executionEpoch.id, "epoch-2");
  assert.equal(persisted.handoff.state, "running", "the stale lease must not be finalized");
  assert.equal(harness.notifications.some((notice) => notice.kind === "handoff-delivered"), false);
});

test("final handoff persistence cannot overwrite a user action after the last lease read", async () => {
  let mutated = false;
  const harness = createHarness({
    beforeGuardedPersist: ({ id, handoff, jobs }) => {
      if (handoff.state !== "delivered") return;
      if (mutated) return;
      mutated = true;
      const current = jobs.get(id);
      jobs.set(id, {
        ...current,
        handoff: {
          ...current.handoff,
          state: "user_paused",
          terminalKey: null,
          leaseId: null,
          userControlled: true,
        },
      });
    },
  });
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();

  const persisted = harness.jobs.get(job.id);
  assert.equal(mutated, true);
  assert.equal(persisted.handoff.state, "user_paused");
  assert.equal(persisted.handoff.userControlled, true);
  assert.equal(persisted.handoff.terminalKey, null);
});

test("final handoff persistence cannot overwrite a newer delivery attempt identity", async () => {
  let mutated = false;
  const harness = createHarness({
    beforeGuardedPersist: ({ id, handoff, jobs }) => {
      if (handoff.state !== "delivered" || mutated) return;
      mutated = true;
      const current = jobs.get(id);
      jobs.set(id, {
        ...current,
        handoff: {
          ...current.handoff,
          attemptId: "attempt:newer-owner",
        },
      });
    },
  });
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();

  const persisted = harness.jobs.get(job.id);
  assert.equal(mutated, true);
  assert.equal(persisted.handoff.state, "running");
  assert.equal(persisted.handoff.attemptId, "attempt:newer-owner");
  assert.equal(harness.notifications.some((notice) => notice.kind === "handoff-delivered"), false);
});

test("failed handoff persistence cannot overwrite a newer delivery attempt identity", async () => {
  let mutated = false;
  const harness = createHarness({
    dispatchResult: { accepted: true, completed: true, ok: false, error: "model unavailable" },
    beforeGuardedPersist: ({ id, handoff, jobs }) => {
      if (handoff.state !== "needs_user" || mutated) return;
      mutated = true;
      const current = jobs.get(id);
      jobs.set(id, {
        ...current,
        handoff: {
          ...current.handoff,
          attemptId: "attempt:newer-owner",
        },
      });
    },
  });
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();

  const persisted = harness.jobs.get(job.id);
  assert.equal(mutated, true);
  assert.equal(persisted.handoff.state, "running");
  assert.equal(persisted.handoff.attemptId, "attempt:newer-owner");
  assert.equal(harness.notifications.some((notice) => notice.kind === "handoff-failed"), false);
});

test("an accepted handoff with no delivery conclusion remains visible for the user", async () => {
  const harness = createHarness({ dispatchResult: { accepted: true, completed: true, ok: true, assistantText: "" } });
  const job = harness.add(makeJob());
  await harness.coordinator.observe(job, { deferDrain: true });
  await harness.coordinator.drain();

  assert.equal(harness.jobs.get(job.id).handoff.state, "needs_user");
  assert.match(harness.jobs.get(job.id).handoff.lastError, /no delivery conclusion/i);
});

test("a restarted coordinator uses a fresh dispatch identity for an unfinished lease", async () => {
  const beforeRestart = createHarness({ instanceId: "instance-before-restart" });
  const job = beforeRestart.add(makeJob());
  await beforeRestart.coordinator.observe(job, { deferDrain: true });
  await beforeRestart.coordinator.drain();
  const firstDispatchId = beforeRestart.dispatched[0].dispatchId;
  const unfinished = {
    ...beforeRestart.jobs.get(job.id),
    handoff: {
      ...beforeRestart.jobs.get(job.id).handoff,
      state: "running",
      leaseId: "instance-before-restart",
    },
  };

  const afterRestart = createHarness({ instanceId: "instance-after-restart" });
  afterRestart.add(unfinished);
  await afterRestart.coordinator.rehydrate([unfinished]);

  assert.equal(afterRestart.dispatched.length, 1);
  assert.ok(firstDispatchId);
  assert.ok(afterRestart.dispatched[0].dispatchId);
  assert.notEqual(afterRestart.dispatched[0].dispatchId, firstDispatchId);
});

test("the same recoverable failure is handed to the model only once across execution epochs", async () => {
  const harness = createHarness();
  const first = harness.add(makeJob({
    status: "failed",
    error: "provider quota exhausted",
    executionEpoch: { id: "epoch-1" },
  }));
  await harness.coordinator.observe(first, { deferDrain: true });
  await harness.coordinator.drain();
  assert.equal(harness.dispatched.length, 1);

  const repeated = {
    ...harness.jobs.get(first.id),
    status: "failed",
    error: "provider quota exhausted",
    executionEpoch: { id: "epoch-2" },
  };
  harness.jobs.set(first.id, repeated);
  const result = await harness.coordinator.observe(repeated, { deferDrain: true });
  await harness.coordinator.drain();

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "repeated-failure");
  assert.equal(harness.dispatched.length, 1);
  assert.equal(harness.jobs.get(first.id).handoff.state, "needs_user");
});

test("handoff prompt preserves the goal and gives status-specific guardrails", () => {
  const warningPrompt = buildLongTaskHandoffPrompt(makeJob({
    status: "completed_with_warnings",
    warnings: [{ type: "document-quality-degraded", message: "3 个区块需要复核" }],
  }));
  assert.match(warningPrompt, /把这份文档完整整理成 Markdown/);
  assert.match(warningPrompt, /completed_with_warnings/);
  assert.match(warningPrompt, /3 个区块需要复核/);
  assert.match(warningPrompt, /不要重新启动相同任务/);
  assert.match(warningPrompt, /明确交付/);
});

test("attention state is separate from worker running state", () => {
  assert.equal(longTaskNeedsAttention(makeJob({ handoff: { state: "queued" } })), true);
  assert.equal(longTaskNeedsAttention(makeJob({ handoff: { state: "running" } })), true);
  assert.equal(longTaskNeedsAttention(makeJob({ handoff: { state: "waiting_conversation" } })), true);
  assert.equal(longTaskNeedsAttention(makeJob({ handoff: { state: "delivered" } })), false);
  assert.equal(longTaskNeedsAttention(makeJob({ status: "running", handoff: { state: "waiting_worker" } })), false);
  assert.equal(longTaskNeedsAttention(makeJob({
    status: "failed",
    origin: null,
    handoff: null,
  })), true, "legacy terminal jobs without a conversation owner still need manual attention");
});
