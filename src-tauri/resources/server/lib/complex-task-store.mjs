import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { atomicWriteFile } from "./atomic-file.mjs";
import {
  assertOutcomeEnvelope,
  assertTaskContract,
  assertUnitPlanSet,
  assertUnitResult,
  isTerminalLifecycle,
  TASK_LIFECYCLE_STATES,
} from "./complex-task-contracts.mjs";

const DAY_MS = 86_400_000;
const DEFAULT_RETENTION_MS = 30 * DAY_MS;
const DEFAULT_LEASE_MS = 60_000;
const TASK_ID_RE = /^task:[0-9a-f-]{36}$/i;
const GUARDED_LIFECYCLES = new Set(["leased", "running", "assembling"]);
const ACTIVE_LIFECYCLES = new Set(["queued", "leased", "running", "assembling", "waiting_user", "blocked", "paused"]);
const ALLOWED_TRANSITIONS = new Map([
  ["queued", new Set(["leased", "paused", "waiting_user", "blocked"])],
  ["leased", new Set(["running", "queued", "paused", "waiting_user", "blocked"])],
  ["running", new Set(["running", "assembling", "paused", "waiting_user", "blocked"])],
  ["assembling", new Set(["terminal", "paused", "waiting_user", "blocked"])],
  ["waiting_user", new Set(["queued", "paused", "blocked"])],
  ["blocked", new Set(["queued", "paused"])],
  ["paused", new Set(["queued"])],
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function iso(value = Date.now()) {
  return new Date(numberOr(value, Date.now())).toISOString();
}

function taskId(value) {
  const id = String(value ?? "").trim();
  if (!TASK_ID_RE.test(id)) throw new TypeError(`invalid complex task id: ${id}`);
  return id;
}

function storageKey(id) {
  return encodeURIComponent(taskId(id));
}

function checksum(event) {
  const { checksum: _checksum, ...body } = event;
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

function applied(appliedValue, reason, task) {
  return { applied: appliedValue, ...(reason ? { reason } : {}), ...(task ? { task: clone(task) } : {}) };
}

function leaseResult(ok, reason, task) {
  return { ok, ...(reason ? { reason } : {}), ...(task ? { task: clone(task) } : {}) };
}

function leaseMatches(task, guard, now) {
  const lease = task?.lease;
  if (!lease || !guard || lease.leaseId !== guard.leaseId || Number(lease.epoch) !== Number(guard.epoch)) return false;
  if (guard.owner !== undefined && lease.owner !== guard.owner) return false;
  return Number(lease.expiresAt) > Number(now);
}

function consumersFor(task) {
  const channels = task?.contract?.interactionPolicy?.deliveryChannels;
  return Array.isArray(channels) && channels.length ? [...new Set(channels.map((value) => String(value).trim()).filter(Boolean))] : ["task-center"];
}

function pendingConsumers(entry) {
  const consumers = Array.isArray(entry.consumers) && entry.consumers.length ? entry.consumers : ["task-center"];
  const acknowledgements = entry.acknowledgements && typeof entry.acknowledgements === "object" ? entry.acknowledgements : {};
  return consumers.filter((consumer) => acknowledgements[consumer] !== true);
}

function project(task) {
  const copy = clone(task);
  copy.status = copy.lifecycle;
  copy.outbox = (copy.outbox ?? []).map((entry) => ({ ...entry, pendingConsumers: pendingConsumers(entry) }));
  return copy;
}

export function createComplexTaskStore(rootDir, options = {}) {
  const root = resolve(String(rootDir));
  const retentionMs = Math.max(0, numberOr(options.retentionMs, DEFAULT_RETENTION_MS));
  const leaseMs = Math.max(1, numberOr(options.leaseMs, DEFAULT_LEASE_MS));
  const atomicWrite = options.atomicWrite ?? atomicWriteFile;
  const mutationChains = new Map();
  const eventChains = new Map();
  const dirFor = (id) => join(root, storageKey(id));
  const manifestFor = (id) => join(dirFor(id), "manifest.json");
  const eventsFor = (id) => join(dirFor(id), "events.jsonl");

  function serialize(map, id, operation) {
    const key = taskId(id);
    const previous = map.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    map.set(key, next);
    return next.finally(() => { if (map.get(key) === next) map.delete(key); });
  }

  async function readEvents(id, limit = 10_000) {
    const key = taskId(id);
    let source;
    try { source = await readFile(eventsFor(key), "utf8"); } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
    const events = [];
    for (const line of source.split(/\r?\n/).filter(Boolean).slice(-Math.max(1, Math.min(10_000, Number(limit) || 10_000))) ) {
      try {
        const parsed = JSON.parse(line);
        if (parsed && parsed.checksum === checksum(parsed)) events.push(parsed);
      } catch { /* Ignore a truncated tail; preceding events remain authoritative. */ }
    }
    return clone(events);
  }

  async function appendEvent(id, type, fields = {}) {
    const key = taskId(id);
    return serialize(eventChains, key, async () => {
      await mkdir(dirFor(key), { recursive: true });
      const history = await readEvents(key);
      const event = {
        schemaVersion: 1,
        eventId: randomUUID(),
        sequence: (history.at(-1)?.sequence ?? 0) + 1,
        at: new Date().toISOString(),
        type: String(type),
        ...clone(fields),
      };
      event.checksum = checksum(event);
      await appendFile(eventsFor(key), `${JSON.stringify(event)}\n`, "utf8");
      return clone(event);
    });
  }

  async function read(id) {
    const key = taskId(id);
    try {
      const parsed = JSON.parse(await readFile(manifestFor(key), "utf8"));
      if (!parsed || parsed.id !== key || parsed.kind !== "task") throw new Error("manifest identity mismatch");
      return project(parsed);
    } catch (error) {
      if (error?.code === "ENOENT") throw new Error(`complex task not found: ${key}`);
      const wrapped = new Error(`invalid complex task manifest: ${key}`);
      wrapped.code = "COMPLEX_TASK_MANIFEST_CORRUPT";
      wrapped.cause = error;
      throw wrapped;
    }
  }

  async function writeManifest(task) {
    await mkdir(dirFor(task.id), { recursive: true });
    await atomicWrite(manifestFor(task.id), `${JSON.stringify(task, null, 2)}\n`, "utf8");
    return project(task);
  }

  async function create(input = {}) {
    const draft = input.contract ?? input;
    const id = taskId(input.id ?? draft.taskId ?? `task:${randomUUID()}`);
    const contract = assertTaskContract({ ...clone(draft), taskId: id });
    const unitPlans = assertUnitPlanSet(input.unitPlans ?? [], { requiredCoverage: contract.completion.requiredCoverage });
    if (existsSync(manifestFor(id))) throw new Error(`complex task already exists: ${id}`);
    const now = numberOr(input.now, Date.now());
    const coverageLedger = Object.fromEntries(contract.completion.requiredCoverage.map((coverage) => [coverage, {
      state: "pending",
      primaryUnitId: unitPlans.find((plan) => plan.primaryCoverage.includes(coverage))?.unitId ?? null,
      artifactRefs: [],
    }]));
    const task = {
      schemaVersion: 1,
      id,
      kind: "task",
      lifecycle: "queued",
      status: "queued",
      quality: "unknown",
      revision: 0,
      contract,
      unitPlans,
      unitResults: {},
      coverageLedger,
      lease: null,
      epoch: 0,
      outcome: null,
      outbox: [],
      metadata: clone(input.metadata ?? null),
      createdAt: iso(now),
      updatedAt: iso(now),
    };
    await writeManifest(task);
    await appendEvent(id, "created", { lifecycle: task.lifecycle, revision: 0 });
    return project(task);
  }

  async function transition(id, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return applied(false, "revision-mismatch", current);
      const nextLifecycle = String(input.lifecycle ?? "");
      if (nextLifecycle === "terminal") return applied(false, "outcome-required", current);
      if (!TASK_LIFECYCLE_STATES.includes(nextLifecycle) || !ALLOWED_TRANSITIONS.get(current.lifecycle)?.has(nextLifecycle)) return applied(false, "invalid-transition", current);
      const now = numberOr(input.now, Date.now());
      if (GUARDED_LIFECYCLES.has(current.lifecycle) && !input.userControlled && !leaseMatches(current, input, now)) return applied(false, "stale-lease", current);
      const next = {
        ...current,
        lifecycle: nextLifecycle,
        status: nextLifecycle,
        revision: current.revision + 1,
        updatedAt: iso(now),
        ...(input.userControlled ? { lease: null } : {}),
        ...(input.quality ? { quality: String(input.quality) } : {}),
      };
      const saved = await writeManifest(next);
      await appendEvent(key, "lifecycle-changed", { from: current.lifecycle, to: nextLifecycle, revision: saved.revision });
      return applied(true, null, saved);
    });
  }

  async function acquireLease(id, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return leaseResult(false, "revision-mismatch", current);
      const now = numberOr(input.now, Date.now());
      if (current.lease && Number(current.lease.expiresAt) > now) return leaseResult(false, "lease-held", current);
      if (current.lifecycle !== "queued") return leaseResult(false, "not-queued", current);
      const epoch = Number(current.epoch || 0) + 1;
      const lease = { leaseId: randomUUID(), owner: String(input.owner ?? "worker"), epoch, acquiredAt: now, expiresAt: now + Math.max(1, numberOr(input.ttlMs, leaseMs)) };
      const saved = await writeManifest({ ...current, lifecycle: "leased", status: "leased", lease, epoch, revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "lease-acquired", { leaseId: lease.leaseId, epoch, revision: saved.revision });
      return { ok: true, leaseId: lease.leaseId, epoch, lease: clone(lease), task: saved };
    });
  }

  async function heartbeat(id, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      const now = numberOr(input.now, Date.now());
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return leaseResult(false, "revision-mismatch", current);
      if (!leaseMatches(current, input, now)) return leaseResult(false, "stale-lease", current);
      const lease = { ...current.lease, expiresAt: now + Math.max(1, numberOr(input.ttlMs, leaseMs)) };
      const saved = await writeManifest({ ...current, lease, revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "lease-heartbeat", { leaseId: lease.leaseId, epoch: lease.epoch, expiresAt: lease.expiresAt, revision: saved.revision });
      return { ok: true, lease: clone(lease), task: saved };
    });
  }

  async function releaseLease(id, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      const now = numberOr(input.now, Date.now());
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return leaseResult(false, "revision-mismatch", current);
      if (!leaseMatches(current, input, now)) return leaseResult(false, "stale-lease", current);
      const saved = await writeManifest({ ...current, lifecycle: "queued", status: "queued", lease: null, revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "lease-released", { revision: saved.revision });
      return { ok: true, task: saved };
    });
  }

  async function recoverExpiredLease(id, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      const now = numberOr(input.now, Date.now());
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return applied(false, "revision-mismatch", current);
      if (input.expectedEpoch !== undefined && Number(current.epoch) !== Number(input.expectedEpoch)) return applied(false, "epoch-mismatch", current);
      if (!GUARDED_LIFECYCLES.has(current.lifecycle)) return applied(false, "not-running", current);
      if (current.lease && Number(current.lease.expiresAt) > now) return applied(false, "lease-active", current);
      const saved = await writeManifest({ ...current, lifecycle: "queued", status: "queued", lease: null, recovery: { reason: String(input.reason ?? "worker lease expired"), recoveredAt: iso(now), previousEpoch: current.epoch }, revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "lease-recovered", { epoch: current.epoch, revision: saved.revision });
      return applied(true, null, saved);
    });
  }

  async function checkpointUnit(id, inputResult, guard = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      const now = numberOr(guard.now, Date.now());
      if (!Number.isInteger(guard.expectedRevision) || current.revision !== guard.expectedRevision) return applied(false, "revision-mismatch", current);
      if (current.lifecycle !== "running" || !leaseMatches(current, guard, now)) return applied(false, "stale-lease", current);
      const plan = current.unitPlans.find((item) => item.unitId === String(inputResult?.unitId ?? ""));
      let resultValue;
      try { resultValue = assertUnitResult(inputResult, { unitPlan: plan }); } catch { return applied(false, "invalid-unit-result", current); }
      const saved = await writeManifest({ ...current, unitResults: { ...current.unitResults, [resultValue.unitId]: { ...resultValue, checkpointedAt: iso(now), epoch: current.epoch, leaseId: current.lease.leaseId } }, revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "unit-checkpoint", { unitId: resultValue.unitId, revision: saved.revision });
      return applied(true, null, saved);
    });
  }

  async function complete(id, inputOutcome, guard = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      if (isTerminalLifecycle(current.lifecycle)) return applied(false, "already-terminal", current);
      if (!Number.isInteger(guard.expectedRevision) || current.revision !== guard.expectedRevision) return applied(false, "revision-mismatch", current);
      const now = numberOr(guard.now, Date.now());
      if (current.lifecycle !== "assembling" || !leaseMatches(current, guard, now)) return applied(false, "stale-lease", current);
      let outcome;
      try { outcome = assertOutcomeEnvelope(inputOutcome); } catch { return applied(false, "invalid-outcome", current); }
      if (outcome.taskId !== key) return applied(false, "outcome-task-mismatch", current);
      const deliveryId = randomUUID();
      const entry = { deliveryId, taskId: key, payload: outcome, consumers: consumersFor(current), acknowledgements: {}, createdAt: iso(now) };
      const saved = await writeManifest({ ...current, lifecycle: "terminal", status: "terminal", quality: String(guard.quality ?? current.quality ?? "unknown"), outcome, lease: null, outbox: [...(current.outbox ?? []), entry], revision: current.revision + 1, updatedAt: iso(now), completedAt: iso(now) });
      await appendEvent(key, "terminal-outcome", { outcome: outcome.outcome, deliveryId, revision: saved.revision });
      return { applied: true, task: saved, deliveryId };
    });
  }

  async function ackOutbox(id, deliveryId, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return applied(false, "revision-mismatch", current);
      const consumer = String(input.consumer ?? "");
      if (!consumer) return applied(false, "consumer-required", current);
      const index = (current.outbox ?? []).findIndex((entry) => entry.deliveryId === String(deliveryId));
      if (index < 0) return applied(false, "outbox-not-found", current);
      const entry = current.outbox[index];
      if (!entry.consumers.includes(consumer)) return applied(false, "unknown-consumer", current);
      if (entry.acknowledgements?.[consumer] === true) return applied(false, "already-acknowledged", current);
      const outbox = current.outbox.map((item, itemIndex) => itemIndex === index ? { ...item, acknowledgements: { ...(item.acknowledgements ?? {}), [consumer]: true } } : item);
      const now = numberOr(input.now, Date.now());
      const saved = await writeManifest({ ...current, outbox, revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "outbox-acknowledged", { deliveryId: String(deliveryId), consumer, revision: saved.revision });
      return applied(true, null, saved);
    });
  }

  async function list() {
    if (!existsSync(root)) return [];
    const entries = await readdir(root, { withFileTypes: true });
    const tasks = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      let id;
      try { id = decodeURIComponent(entry.name); taskId(id); } catch { continue; }
      try { tasks.push(await read(id)); } catch (error) {
        tasks.push({ schemaVersion: 1, id, kind: "task", lifecycle: "blocked", status: "blocked", quality: "failed", revision: null, corrupt: true, needsAttention: true, error: String(error?.message || error), outbox: [] });
      }
    }
    return tasks.sort((left, right) => Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0));
  }

  async function listPendingOutbox({ consumer } = {}) {
    const pending = [];
    for (const task of await list()) for (const entry of task.outbox ?? []) {
      const waiting = pendingConsumers(entry);
      if (consumer && !waiting.includes(String(consumer))) continue;
      if (!consumer && waiting.length === 0) continue;
      pending.push({ taskId: task.id, deliveryId: entry.deliveryId, payload: clone(entry.payload), pendingConsumers: waiting });
    }
    return pending.sort((left, right) => String(left.deliveryId).localeCompare(String(right.deliveryId)));
  }

  async function readOutbox(id) {
    const task = await read(id);
    return clone(task.outbox ?? []);
  }

  async function remove(id) {
    const key = taskId(id);
    return serialize(mutationChains, key, () => rm(dirFor(key), { recursive: true, force: true }));
  }

  async function pruneExpired(now = Date.now()) {
    const deleted = [];
    let kept = 0;
    for (const task of await list()) {
      const allAcked = (task.outbox ?? []).every((entry) => pendingConsumers(entry).length === 0);
      const updated = Date.parse(task.updatedAt || task.createdAt || 0);
      if (isTerminalLifecycle(task.lifecycle) && allAcked && Number(now) - updated >= retentionMs) { await remove(task.id); deleted.push(task.id); } else kept++;
    }
    return { deleted, kept };
  }

  return { root, retentionMs, acquireLease, ackOutbox, appendEvent, checkpointUnit, complete, create, heartbeat, list, listPendingOutbox, pruneExpired, read, readEvents, readOutbox, recoverExpiredLease, releaseLease, remove, transition };
}
