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
import {
  assertWorkPlan,
  createWorkPlan,
  replanWorkPlan,
  workPlanUnitPlans,
} from "./complex-task-plan.mjs";
import { parseArtifactReference } from "./complex-task-artifact-reference.mjs";

const DAY_MS = 86_400_000;
const DEFAULT_RETENTION_MS = 30 * DAY_MS;
const DEFAULT_LEASE_MS = 60_000;
const TASK_ID_RE = /^task:[0-9a-f-]{36}$/i;
const GUARDED_LIFECYCLES = new Set(["leased", "running", "assembling"]);
const ACTIVE_LIFECYCLES = new Set(["queued", "leased", "running", "assembling", "waiting_user", "blocked", "paused"]);
const ATTENTION_LIFECYCLES = new Set(["waiting_user", "blocked"]);
const ALLOWED_TRANSITIONS = new Map([
  ["queued", new Set(["leased", "paused", "waiting_user", "blocked"])],
  ["leased", new Set(["running", "assembling", "queued", "paused", "waiting_user", "blocked"])],
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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function payloadHash(payload) {
  return createHash("sha256").update(stableJson(payload ?? null)).digest("hex");
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

function normalizedDeliveryState(raw = {}) {
  const statuses = new Set(["ready", "retrying", "blocked_user_retry", "exhausted", "delivered", "dismissed"]);
  const status = statuses.has(String(raw.status ?? "")) ? String(raw.status) : "ready";
  return {
    status,
    ...(raw.attemptId ? { attemptId: String(raw.attemptId).slice(0, 256) } : { attemptId: null }),
    attempts: Math.max(0, Math.min(100, Number(raw.attempts) || 0)),
    nextAttemptAt: Number.isFinite(Number(raw.nextAttemptAt)) ? Number(raw.nextAttemptAt) : null,
    dispatchCompleted: raw.dispatchCompleted === true,
    lastError: raw.lastError || raw.reason ? String(raw.lastError || raw.reason).slice(0, 2_000) : null,
    ...(raw.code ? { code: String(raw.code).slice(0, 160) } : {}),
    ...(raw.updatedAt ? { updatedAt: String(raw.updatedAt).slice(0, 80) } : {}),
  };
}

function project(task) {
  const copy = clone(task);
  copy.status = copy.lifecycle;
  copy.outbox = (copy.outbox ?? []).map((entry) => ({ ...entry, pendingConsumers: pendingConsumers(entry) }));
  return copy;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value ?? {}, key);
}

function selectedChoice(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  for (const candidate of [value.choiceId, value.choice, value.id, value.value]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function outputConflictRequest(request) {
  if (!request || typeof request !== "object") return false;
  const signal = [request.kind, request.reason, request.type, request.code].filter(Boolean).join(" ");
  return /output[-_ ]?(path[-_ ]?)?conflict|path[-_ ]?occupied|输出.*(冲突|占用)|路径.*(冲突|占用)/i.test(signal);
}

function advertisedChoices(request) {
  return new Set((Array.isArray(request?.choices) ? request.choices : [])
    .map((choice) => typeof choice === "string" ? choice : choice?.id ?? choice?.choiceId ?? choice?.value)
    .map((choice) => String(choice ?? "").trim())
    .filter(Boolean));
}

function normalizedChoice(value, request) {
  const choice = selectedChoice(value);
  if (!/^[1-9]\d*$/.test(choice)) return choice;
  const choices = Array.isArray(request?.choices) ? request.choices : [];
  const selected = choices[Number(choice) - 1];
  return typeof selected === "string"
    ? selected.trim()
    : String(selected?.id ?? selected?.choiceId ?? selected?.value ?? "").trim();
}

function requestedPathFromAnswer(answer) {
  if (typeof answer === "string") return answer.trim();
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return "";
  for (const candidate of [answer.requestedPath, answer.path, answer.value]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function progressEvidence(value, now, sequence) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const kind = String(value.kind ?? "").trim();
  if (!kind) return null;
  const coverage = Array.isArray(value.coverage)
    ? [...new Set(value.coverage.map((item) => String(item).trim()).filter(Boolean))]
    : [];
  return {
    kind: kind.slice(0, 128),
    sequence,
    observedAt: iso(now),
    ...(String(value.unitId ?? "").trim() ? { unitId: String(value.unitId).trim().slice(0, 128) } : {}),
    ...(String(value.attemptId ?? "").trim() ? { attemptId: String(value.attemptId).trim().slice(0, 256) } : {}),
    ...(coverage.length ? { coverage } : {}),
    ...(String(value.message ?? "").trim() ? { message: String(value.message).trim().slice(0, 1_000) } : {}),
  };
}

function nextProgress(current, now, evidence) {
  const sequence = Math.max(0, Number(current?.progress?.sequence) || 0) + 1;
  return {
    sequence,
    lastProgressAt: iso(now),
    evidence: progressEvidence(evidence, now, sequence),
  };
}

function progressTimestamp(task) {
  for (const value of [task?.progress?.lastProgressAt, task?.executionStartedAt, task?.lease?.acquiredAt]) {
    const parsed = typeof value === "number" ? value : Date.parse(String(value ?? ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sameStringSet(left, right) {
  const leftSet = new Set(Array.isArray(left) ? left : []);
  const rightSet = new Set(Array.isArray(right) ? right : []);
  return leftSet.size === rightSet.size && [...leftSet].every((value) => rightSet.has(value));
}

function taskWorkPlan(contract, id, suppliedPlan, legacyUnitPlans = []) {
  const plan = suppliedPlan
    ? assertWorkPlan(suppliedPlan, { permissionBoundary: contract.permissions })
    : createWorkPlan({
      planId: `plan:${id.slice("task:".length)}`,
      goal: contract.goal,
      requiredCoverage: contract.completion.requiredCoverage,
      permissions: contract.permissions,
      unitPlans: legacyUnitPlans,
    }, { permissionBoundary: contract.permissions });
  if (!sameStringSet(plan.requiredCoverage, contract.completion.requiredCoverage)) {
    const error = new TypeError("invalid work plan: required coverage must match the TaskContract");
    error.code = "INVALID_WORK_PLAN";
    error.errors = ["required coverage must match the TaskContract"];
    throw error;
  }
  return plan;
}

function ledgerStateForResult(result) {
  return result?.proposedStatus === "completed" ? "completed"
    : result?.proposedStatus === "skipped" ? "source_fallback"
      : result?.proposedStatus === "needs_review" ? "degraded"
        : result?.proposedStatus === "blocked" ? "blocked"
          : "unresolved";
}

function coverageLedgerFor(contract, unitPlans, unitResults = {}) {
  return Object.fromEntries(contract.completion.requiredCoverage.map((coverage) => {
    const plan = unitPlans.find((candidate) => candidate.primaryCoverage.includes(coverage));
    const result = plan ? unitResults[plan.unitId] : null;
    const covered = Array.isArray(result?.proposedPrimaryCoverage) && result.proposedPrimaryCoverage.includes(coverage);
    return [coverage, {
      state: covered ? ledgerStateForResult(result) : "pending",
      primaryUnitId: plan?.unitId ?? null,
      artifactRefs: covered && Array.isArray(result?.artifactRefs) ? [...result.artifactRefs] : [],
    }];
  }));
}

function checkpointWorkPlan(plan, result, options = {}) {
  if (!plan) return null;
  const status = result.proposedStatus === "needs_review" ? "waiting_user" : result.proposedStatus;
  const completedNodeIds = new Set(Array.isArray(plan.completedNodeIds) ? plan.completedNodeIds : []);
  if (["completed", "skipped"].includes(status)) completedNodeIds.add(result.unitId);
  else completedNodeIds.delete(result.unitId);
  return assertWorkPlan({
    ...clone(plan),
    nodes: plan.nodes.map((node) => node.nodeId === result.unitId ? { ...node, status } : node),
    nodeResults: { ...(plan.nodeResults ?? {}), [result.unitId]: clone(result) },
    completedNodeIds: [...completedNodeIds],
  }, options);
}

function attentionPayload(task, lifecycle, input = {}) {
  const request = hasOwn(input, "userInputRequest") ? clone(input.userInputRequest) : clone(task.userInputRequest ?? null);
  const reason = hasOwn(input, "blockingReason") ? clone(input.blockingReason) : clone(task.blockingReason ?? null);
  const message = typeof reason === "string"
    ? reason
    : reason?.message || (lifecycle === "waiting_user" ? "任务需要用户补充信息后才能继续。" : "任务被外部条件阻塞，需要用户处理。");
  return {
    schemaVersion: 1,
    type: "task-attention",
    taskId: task.id,
    lifecycle,
    quality: String(input.quality ?? task.quality ?? "unknown"),
    summary: message,
    blockingReason: reason,
    userInputRequest: request,
    resumable: true,
  };
}

function outboxEntry(task, payload, kind, now, { logicalRevision = Number(task?.revision || 0) + 1 } = {}) {
  const fingerprint = payloadHash(payload);
  const revision = Number.isFinite(Number(logicalRevision)) ? Number(logicalRevision) : 0;
  return {
    // A deterministic id makes startup repair and repeated recovery idempotent
    // even when the process dies after manifest persistence but before the
    // corresponding event is appended.
    deliveryId: `delivery:${createHash("sha256").update(`${task.id}\0${kind}\0${revision}\0${fingerprint}`).digest("hex").slice(0, 32)}`,
    taskId: task.id,
    kind,
    logicalRevision: revision,
    payload: clone(payload),
    payloadHash: fingerprint,
    consumers: consumersFor(task),
    acknowledgements: {},
    createdAt: iso(now),
  };
}

function supersedeAttentionOutbox(task, reason, now, { keepDeliveryId = null } = {}) {
  const outbox = Array.isArray(task?.outbox) ? task.outbox : [];
  return outbox.map((entry) => {
    if (entry?.kind !== "task-attention" || entry.deliveryId === keepDeliveryId || pendingConsumers(entry).length === 0) return entry;
    const consumers = Array.isArray(entry.consumers) && entry.consumers.length ? entry.consumers : ["task-center"];
    return {
      ...entry,
      acknowledgements: { ...(entry.acknowledgements ?? {}), ...Object.fromEntries(consumers.map((consumer) => [consumer, true])) },
      pendingConsumers: [],
      supersededAt: iso(now),
      supersededReason: String(reason || "task state changed"),
    };
  });
}

function expectedOutboxNotification(task) {
  if (isTerminalLifecycle(task?.lifecycle) && task?.outcome && typeof task.outcome === "object") {
    return { kind: "task-outcome", logicalRevision: Number(task.revision), payload: clone(task.outcome) };
  }
  if (ATTENTION_LIFECYCLES.has(task?.lifecycle)) {
    return { kind: "task-attention", logicalRevision: Number(task.revision), payload: attentionPayload(task, task.lifecycle) };
  }
  return null;
}

function matchingOutboxEntry(task, expected) {
  if (!expected) return null;
  const expectedHash = payloadHash(expected.payload);
  const matches = (task?.outbox ?? []).filter((entry) => {
    const owner = entry?.taskId ?? entry?.payload?.taskId;
    if (entry?.kind !== expected.kind || owner !== task.id) return false;
    return entry.payloadHash === expectedHash || payloadHash(entry.payload) === expectedHash;
  });
  const expectedRevision = Number(expected.logicalRevision);
  const versioned = matches
    .filter((entry) => Number.isInteger(Number(entry.logicalRevision)) && Number(entry.logicalRevision) <= expectedRevision)
    .sort((left, right) => Number(right.logicalRevision) - Number(left.logicalRevision));
  return versioned[0] ?? matches.at(-1) ?? null;
}

function hasOutboxCreationEvent(events, deliveryId) {
  return events.some((event) => event?.deliveryId === deliveryId
    && ["terminal-outcome", "lifecycle-changed", "outbox-recovered"].includes(event.type));
}

export function createComplexTaskStore(rootDir, options = {}) {
  const root = resolve(String(rootDir));
  const retentionMs = Math.max(0, numberOr(options.retentionMs, DEFAULT_RETENTION_MS));
  const leaseMs = Math.max(1, numberOr(options.leaseMs, DEFAULT_LEASE_MS));
  const atomicWrite = options.atomicWrite ?? atomicWriteFile;
  const artifactStore = options.artifactStore && typeof options.artifactStore.read === "function" ? options.artifactStore : null;
  const onManifestFallback = typeof options.onManifestFallback === "function" ? options.onManifestFallback : null;
  const eventAppend = typeof options.eventAppend === "function" ? options.eventAppend : appendFile;
  const mutationChains = new Map();
  const eventChains = new Map();
  const dirFor = (id) => join(root, storageKey(id));
  const manifestFor = (id) => join(dirFor(id), "manifest.json");
  // A recovery record is deliberately separate from manifest.json and its
  // snapshots.  When every normal record is unreadable we must preserve the
  // damaged evidence while still exposing a durable, actionable Outcome.
  const recoveryFor = (id) => join(dirFor(id), "recovery.json");
  const snapshotDirFor = (id) => join(dirFor(id), "manifest-snapshots");
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
      await eventAppend(eventsFor(key), `${JSON.stringify(event)}\n`, "utf8");
      return clone(event);
    });
  }

  async function readManifestCandidate(path, expectedId) {
    try {
      const parsed = JSON.parse(await readFile(path, "utf8"));
      return parsed && parsed.id === expectedId && parsed.kind === "task" ? parsed : null;
    } catch { return null; }
  }

  async function snapshotNames(id) {
    try {
      return (await readdir(snapshotDirFor(id), { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => entry.name)
        .sort()
        .reverse();
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async function pruneSnapshots(id, keep = 8) {
    const names = await snapshotNames(id);
    await Promise.all(names.slice(keep).map((name) => rm(join(snapshotDirFor(id), name), { force: true })));
  }

  async function writeSnapshot(task) {
    await mkdir(snapshotDirFor(task.id), { recursive: true });
    const name = `${String(Number(task.revision) || 0).padStart(12, "0")}-${randomUUID()}.json`;
    const path = join(snapshotDirFor(task.id), name);
    await atomicWriteFileSnapshot(path, `${JSON.stringify(task, null, 2)}\n`);
    await pruneSnapshots(task.id);
    return path;
  }

  async function reportManifestFallback(error, taskIdValue, snapshotPath) {
    if (!onManifestFallback) return;
    try {
      await onManifestFallback(error, taskIdValue, snapshotPath);
    } catch (reportError) {
      console.error(`[complex-task-store] manifest fallback reporting failed for ${taskIdValue}: ${reportError?.message || reportError}`);
    }
  }

  async function atomicWriteFileSnapshot(path, content) {
    await atomicWrite(path, content, "utf8");
  }

  async function read(id) {
    const key = taskId(id);
    const candidates = [];
    const canonical = await readManifestCandidate(manifestFor(key), key);
    if (canonical) candidates.push(canonical);
    const recovery = await readManifestCandidate(recoveryFor(key), key);
    if (recovery) candidates.push(recovery);
    for (const name of await snapshotNames(key)) {
      const snapshot = await readManifestCandidate(join(snapshotDirFor(key), name), key);
      if (snapshot) candidates.push(snapshot);
    }
    const parsed = candidates.sort((left, right) => Number(right.revision || 0) - Number(left.revision || 0))[0];
    if (parsed) return project(parsed);
    if (!existsSync(dirFor(key))) {
      const missing = new Error(`complex task not found: ${key}`);
      missing.code = "ENOENT";
      throw missing;
    }
    const wrapped = new Error(`invalid complex task manifest: ${key}`);
    wrapped.code = existsSync(dirFor(key)) ? "COMPLEX_TASK_MANIFEST_CORRUPT" : "ENOENT";
    throw wrapped;
  }

  async function persistCorruptRecovery(id, originalError) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      // Another concurrent list/read may have repaired the record while this
      // call was waiting for the per-task mutation chain.  Prefer that record.
      const existingRecovery = await readManifestCandidate(recoveryFor(key), key);
      if (existingRecovery) return project(existingRecovery);
      const canonical = await readManifestCandidate(manifestFor(key), key);
      if (canonical) return project(canonical);
      for (const name of await snapshotNames(key)) {
        const snapshot = await readManifestCandidate(join(snapshotDirFor(key), name), key);
        if (snapshot) return project(snapshot);
      }

      const now = Date.now();
      const message = "任务记录的 manifest 与所有快照均已损坏，无法恢复原执行状态。原损坏文件已保留，请重新创建任务。";
      const task = {
        schemaVersion: 1,
        id: key,
        kind: "task",
        lifecycle: "terminal",
        status: "terminal",
        quality: "failed",
        revision: 0,
        // Keep only the fields needed by the public projection and delivery
        // policy.  The original contract is unavailable by definition.
        contract: {
          // The original conversation identity is unavailable once every
          // manifest and snapshot is corrupt.  Do not enqueue a conversation
          // consumer that can never match a real conversation context.
          interactionPolicy: { deliveryChannels: ["task-center"] },
          goal: "恢复损坏的后台任务记录",
        },
        unitPlans: [],
        unitResults: {},
        coverageLedger: {},
        lease: null,
        epoch: 0,
        outcome: {
          schemaVersion: 1,
          taskId: key,
          outcome: "failed",
          summary: message,
          artifactRefs: [],
          coverage: { required: 0, completed: 0, unresolved: [] },
          warnings: [{
            code: "TASK_MANIFEST_CORRUPT",
            message: String(originalError?.message || "complex task manifest is corrupt"),
          }],
          blockingReason: { code: "TASK_MANIFEST_CORRUPT", message },
          userAction: { kind: "recreate-task", label: "重新创建任务" },
          resumable: false,
        },
        outbox: [],
        needsAttention: true,
        metadata: {
          recovery: {
            kind: "manifest-corruption",
            recoveredAt: iso(now),
            originalError: String(originalError?.message || "complex task manifest is corrupt"),
          },
        },
        createdAt: iso(now),
        updatedAt: iso(now),
        completedAt: iso(now),
      };
      task.outbox = [outboxEntry(task, task.outcome, "task-outcome", now, { logicalRevision: task.revision })];
      await mkdir(dirFor(key), { recursive: true });
      await atomicWrite(recoveryFor(key), `${JSON.stringify(task, null, 2)}\n`, "utf8");
      try {
        await appendEvent(key, "manifest-corruption-recovered", {
          revision: task.revision,
          deliveryId: task.outbox[0].deliveryId,
          recoveredAt: iso(now),
          originalError: task.metadata.recovery.originalError,
        });
      } catch (error) {
        // The recovery record is authoritative for user visibility.  Startup
        // outbox reconciliation can add the missing audit event later.
        console.error(`[complex-task-store] corruption recovery audit failed for ${key}: ${error?.message || error}`);
      }
      return project(task);
    });
  }

  async function writeManifest(task) {
    await mkdir(dirFor(task.id), { recursive: true });
    const serialized = `${JSON.stringify(task, null, 2)}\n`;
    try {
      await atomicWrite(manifestFor(task.id), serialized, "utf8");
    } catch (error) {
      try {
        const snapshotPath = await writeSnapshot(task);
        await reportManifestFallback(error, task.id, snapshotPath);
        return project(task);
      } catch (snapshotError) {
        snapshotError.cause = error;
        throw snapshotError;
      }
    }
    try {
      await writeSnapshot(task);
    } catch (snapshotError) {
      await reportManifestFallback(snapshotError, task.id, snapshotDirFor(task.id));
    }
    return project(task);
  }

  async function create(input = {}) {
    const draft = input.contract ?? input;
    const id = taskId(input.id ?? draft.taskId ?? `task:${randomUUID()}`);
    const contract = assertTaskContract({ ...clone(draft), taskId: id });
    const legacyUnitPlans = Array.isArray(input.unitPlans) && input.unitPlans.length > 0
      ? assertUnitPlanSet(input.unitPlans, { requiredCoverage: contract.completion.requiredCoverage })
      : [];
    const workPlan = taskWorkPlan(contract, id, input.workPlan, legacyUnitPlans);
    const unitPlans = assertUnitPlanSet(workPlanUnitPlans(workPlan, { permissionBoundary: contract.permissions }), { requiredCoverage: contract.completion.requiredCoverage });
    if (existsSync(manifestFor(id))) throw new Error(`complex task already exists: ${id}`);
    const now = numberOr(input.now, Date.now());
    const coverageLedger = coverageLedgerFor(contract, unitPlans);
    const task = {
      schemaVersion: 1,
      id,
      kind: "task",
      lifecycle: "queued",
      status: "queued",
      quality: "unknown",
      revision: 0,
      contract,
      contractRevision: 1,
      workPlan,
      unitPlans,
      unitResults: {},
      coverageLedger,
      lease: null,
      epoch: 0,
      outcome: null,
      outbox: [],
      metadata: clone(input.metadata ?? null),
      executionStartedAt: null,
      progress: { sequence: 0, lastProgressAt: null, evidence: null },
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
      const enteringAttention = ATTENTION_LIFECYCLES.has(nextLifecycle);
      const lease = GUARDED_LIFECYCLES.has(nextLifecycle) ? clone(current.lease) : null;
      const blockingReason = hasOwn(input, "blockingReason")
        ? clone(input.blockingReason)
        : enteringAttention ? clone(current.blockingReason ?? null) : null;
      const userInputRequest = hasOwn(input, "userInputRequest")
        ? clone(input.userInputRequest)
        : nextLifecycle === "waiting_user" ? clone(current.userInputRequest ?? null) : null;
      const pendingAssembly = hasOwn(input, "pendingAssembly")
        ? clone(input.pendingAssembly)
        : nextLifecycle === "waiting_user" ? clone(current.pendingAssembly ?? null) : null;
      const attention = enteringAttention && nextLifecycle !== current.lifecycle
        ? outboxEntry(current, attentionPayload(current, nextLifecycle, input), "task-attention", now)
        : null;
      let outbox = current.outbox ?? [];
      if (nextLifecycle !== current.lifecycle && (ATTENTION_LIFECYCLES.has(current.lifecycle) || nextLifecycle === "terminal")) {
        outbox = supersedeAttentionOutbox({ ...current, outbox }, `lifecycle changed to ${nextLifecycle}`, now);
      }
      if (attention) outbox = [...outbox, attention];
      const next = {
        ...current,
        lifecycle: nextLifecycle,
        status: nextLifecycle,
        revision: current.revision + 1,
        updatedAt: iso(now),
        lease,
        ...(input.quality ? { quality: String(input.quality) } : {}),
        userInputRequest,
        blockingReason,
        pendingAssembly,
        needsAttention: enteringAttention,
        outbox,
      };
      const saved = await writeManifest(next);
      await appendEvent(key, "lifecycle-changed", { from: current.lifecycle, to: nextLifecycle, revision: saved.revision, ...(attention ? { deliveryId: attention.deliveryId } : {}) });
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
      const executionStartedAt = current.executionStartedAt
        || (Number(current.epoch || 0) > 0 ? current.createdAt : null)
        || iso(now);
      const progress = nextProgress(current, now, { kind: "lease-acquired", message: `execution epoch ${epoch} started` });
      const saved = await writeManifest({ ...current, lifecycle: "leased", status: "leased", lease, epoch, executionStartedAt, progress, revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "lease-acquired", { leaseId: lease.leaseId, epoch, executionStartedAt, revision: saved.revision });
      return { ok: true, leaseId: lease.leaseId, epoch, lease: clone(lease), task: saved };
    });
  }

  async function recordProgress(id, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      const now = numberOr(input.now, Date.now());
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return leaseResult(false, "revision-mismatch", current);
      if (!GUARDED_LIFECYCLES.has(current.lifecycle) || !leaseMatches(current, input, now)) return leaseResult(false, "stale-lease", current);
      const progress = nextProgress(current, now, input.evidence);
      if (!progress.evidence) return leaseResult(false, "invalid-progress-evidence", current);
      const saved = await writeManifest({ ...current, progress, revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "progress-recorded", {
        kind: progress.evidence.kind,
        sequence: progress.sequence,
        ...(progress.evidence.unitId ? { unitId: progress.evidence.unitId } : {}),
        ...(progress.evidence.attemptId ? { attemptId: progress.evidence.attemptId } : {}),
        revision: saved.revision,
      });
      return { ok: true, progress: clone(progress), task: saved };
    });
  }

  // Attempt reservations are deliberately separate from progress events. A
  // worker may disappear after this write but before the model responds; the
  // reservation must still count so a later execution epoch cannot replay the
  // same bounded attempt indefinitely.
  async function reserveUnitAttempt(id, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      const now = numberOr(input.now, Date.now());
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return { ok: false, reason: "revision-mismatch", task: clone(current) };
      if (!GUARDED_LIFECYCLES.has(current.lifecycle) || !leaseMatches(current, input, now)) return { ok: false, reason: "stale-lease", task: clone(current) };
      const unitId = String(input.unitId ?? "").trim();
      if (!unitId || !(current.unitPlans ?? []).some((plan) => String(plan?.unitId ?? "") === unitId)) return { ok: false, reason: "invalid-unit", task: clone(current) };
      const kind = String(input.kind ?? "").trim();
      const field = kind === "model" ? "modelAttempts" : kind === "recovery" ? "recoveryAttempts" : null;
      if (!field) return { ok: false, reason: "invalid-attempt-kind", task: clone(current) };
      const limit = Number(input.limit);
      if (!Number.isSafeInteger(limit) || limit <= 0) return { ok: false, reason: "invalid-attempt-limit", task: clone(current) };
      const attemptId = String(input.attemptId ?? "").trim();
      if (!attemptId) return { ok: false, reason: "invalid-attempt-id", task: clone(current) };
      const previousBudget = current.attemptBudget && typeof current.attemptBudget === "object" && !Array.isArray(current.attemptBudget)
        ? current.attemptBudget
        : {};
      const previousUnits = previousBudget.units && typeof previousBudget.units === "object" && !Array.isArray(previousBudget.units)
        ? previousBudget.units
        : {};
      const previous = previousUnits[unitId] && typeof previousUnits[unitId] === "object" && !Array.isArray(previousUnits[unitId])
        ? previousUnits[unitId]
        : {};
      const used = Math.max(0, Math.floor(Number(previous[field]) || 0));
      if (used >= limit) return { ok: false, reason: `${kind}-budget-exhausted`, used, limit, task: clone(current) };
      const nextUsed = used + 1;
      const unitBudget = {
        ...clone(previous),
        modelAttempts: Math.max(0, Math.floor(Number(previous.modelAttempts) || 0)),
        recoveryAttempts: Math.max(0, Math.floor(Number(previous.recoveryAttempts) || 0)),
        [field]: nextUsed,
        lastAttemptId: attemptId.slice(0, 256),
        lastAttemptKind: kind,
        lastAttemptEpoch: Number(current.epoch),
        updatedAt: iso(now),
      };
      const attemptBudget = {
        ...clone(previousBudget),
        schemaVersion: 2,
        activeGeneration: String(previousBudget.activeGeneration || current.workPlan?.revisionId || `legacy:${current.id}`),
        planRevision: Number(previousBudget.planRevision || current.workPlan?.planRevision || 1),
        units: { ...clone(previousUnits), [unitId]: unitBudget },
      };
      const progress = nextProgress(current, now, {
        kind: "unit-attempt-reserved",
        unitId,
        attemptId,
        message: `${kind} attempt ${nextUsed}/${limit} reserved`,
      });
      const saved = await writeManifest({
        ...current,
        attemptBudget,
        progress,
        revision: current.revision + 1,
        updatedAt: iso(now),
      });
      await appendEvent(key, "unit-attempt-reserved", {
        unitId,
        attemptKind: kind,
        attemptId: attemptId.slice(0, 256),
        used: nextUsed,
        limit,
        epoch: current.epoch,
        revision: saved.revision,
      });
      return { ok: true, kind, unitId, used: nextUsed, remaining: Math.max(0, limit - nextUsed), limit, task: clone(saved) };
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

  async function validateCheckpointArtifacts(task, unitPlan, result) {
    if (!artifactStore || !Array.isArray(result?.artifactRefs) || result.artifactRefs.length === 0) return null;
    const pinned = task.contract?.pinned;
    for (const ref of result.artifactRefs) {
      const parsed = parseArtifactReference(ref);
      let artifact;
      try {
        artifact = await artifactStore.read(ref);
      } catch (error) {
        return { code: "artifact-pin-mismatch", message: String(error?.message || error), ref };
      }
      const owner = artifact?.manifest?.owner;
      if (!owner || owner.taskId !== task.id || owner.kind !== "unit" || owner.unitId !== unitPlan.unitId) {
        return { code: "artifact-ownership-mismatch", message: `artifact ${parsed.artifactId} does not belong to task ${task.id}/${unitPlan.unitId}`, ref };
      }
      if (pinned && !parsed.exact) return { code: "artifact-pin-mismatch", message: `artifact ${parsed.artifactId} is not revision-pinned`, ref };
      if (pinned) {
        const producer = artifact.manifest.producer ?? {};
        for (const field of ["adapterVersion", "skillHash", "toolSchemaVersion"]) {
          if (String(pinned[field] ?? "") && String(producer[field] ?? "") !== String(pinned[field])) {
            return { code: "artifact-producer-mismatch", message: `artifact ${parsed.artifactId} producer ${field} does not match task pin`, ref };
          }
        }
      }
    }
    return null;
  }

  async function releaseLease(id, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      const now = numberOr(input.now, Date.now());
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return leaseResult(false, "revision-mismatch", current);
      if (!leaseMatches(current, input, now)) return leaseResult(false, "stale-lease", current);
      const saved = await writeManifest({ ...current, lifecycle: "queued", status: "queued", lease: null, needsAttention: false, blockingReason: null, userInputRequest: null, revision: current.revision + 1, updatedAt: iso(now) });
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
      const saved = await writeManifest({ ...current, lifecycle: "queued", status: "queued", lease: null, needsAttention: false, blockingReason: null, userInputRequest: null, recovery: { reason: String(input.reason ?? "worker lease expired"), recoveredAt: iso(now), previousEpoch: current.epoch }, revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "lease-recovered", { epoch: current.epoch, revision: saved.revision });
      return applied(true, null, saved);
    });
  }

  async function recoverStalledLease(id, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      const now = numberOr(input.now, Date.now());
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return applied(false, "revision-mismatch", current);
      if (input.expectedEpoch !== undefined && Number(current.epoch) !== Number(input.expectedEpoch)) return applied(false, "epoch-mismatch", current);
      if (!GUARDED_LIFECYCLES.has(current.lifecycle)) return applied(false, "not-running", current);
      if (!current.lease || Number(current.lease.expiresAt) <= now) return applied(false, "lease-expired", current);
      const stallTimeoutMs = Math.max(0, numberOr(input.stallTimeoutMs, current.contract?.executionLimits?.stallTimeoutMs));
      if (!(stallTimeoutMs > 0)) return applied(false, "stall-timeout-invalid", current);
      const lastProgressAt = progressTimestamp(current);
      if (!Number.isFinite(lastProgressAt) || now - lastProgressAt < stallTimeoutMs) return applied(false, "progress-active", current);
      const recovery = {
        kind: "stalled",
        reason: String(input.reason ?? `worker made no progress for ${stallTimeoutMs}ms`),
        recoveredAt: iso(now),
        previousEpoch: current.epoch,
        lastProgressAt: iso(lastProgressAt),
        stallTimeoutMs,
      };
      const saved = await writeManifest({
        ...current,
        lifecycle: "queued",
        status: "queued",
        lease: null,
        needsAttention: false,
        blockingReason: null,
        userInputRequest: null,
        recovery,
        revision: current.revision + 1,
        updatedAt: iso(now),
      });
      await appendEvent(key, "stalled-lease-recovered", { epoch: current.epoch, lastProgressAt: recovery.lastProgressAt, stallTimeoutMs, revision: saved.revision });
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
      if (!plan) return applied(false, "invalid-unit-result", current);
      let resultValue;
      try { resultValue = assertUnitResult(inputResult, { unitPlan: plan }); } catch { return applied(false, "invalid-unit-result", current); }
      const artifactIssue = await validateCheckpointArtifacts(current, plan, resultValue);
      if (artifactIssue) return applied(false, artifactIssue.code, current);
      const ledgerState = ledgerStateForResult(resultValue);
      const coverageLedger = { ...current.coverageLedger };
      for (const coverage of resultValue.proposedPrimaryCoverage) {
        coverageLedger[coverage] = {
          ...coverageLedger[coverage],
          state: ledgerState,
          primaryUnitId: resultValue.unitId,
          artifactRefs: [...resultValue.artifactRefs],
        };
      }
      const resolutionConsumed = current.userInputResolution?.unitId === resultValue.unitId;
      const checkpointedResult = { ...resultValue, checkpointedAt: iso(now), epoch: current.epoch, leaseId: current.lease.leaseId };
      const progress = nextProgress(current, now, {
        kind: "unit-checkpoint",
        unitId: resultValue.unitId,
        attemptId: resultValue.attemptId,
        coverage: resultValue.proposedPrimaryCoverage,
      });
      const workPlan = current.workPlan
        ? checkpointWorkPlan(current.workPlan, checkpointedResult, { permissionBoundary: current.contract.permissions })
        : null;
      const saved = await writeManifest({ ...current, ...(workPlan ? { workPlan } : {}), unitResults: { ...current.unitResults, [resultValue.unitId]: checkpointedResult }, coverageLedger, progress, ...(resolutionConsumed ? { userInputResolution: null } : {}), revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "unit-checkpoint", { unitId: resultValue.unitId, coverage: resultValue.proposedPrimaryCoverage, revision: saved.revision });
      return applied(true, null, saved);
    });
  }

  async function replan(id, request = {}, guard = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      if (!Number.isInteger(guard.expectedRevision) || current.revision !== guard.expectedRevision) return applied(false, "revision-mismatch", current);
      if (guard.expectedEpoch !== undefined && Number(current.epoch) !== Number(guard.expectedEpoch)) return applied(false, "epoch-mismatch", current);
      if (!["queued", "paused", "waiting_user", "blocked"].includes(current.lifecycle) || current.lease) return applied(false, "replan-requires-idle-task", current);
      const currentPlan = current.workPlan ?? taskWorkPlan(current.contract, current.id, null, current.unitPlans);
      const result = replanWorkPlan(currentPlan, request, { permissionBoundary: current.contract.permissions });
      if (!result.ok) return { ...applied(false, "invalid-replan", current), errors: result.errors };
      const workPlan = result.value;
      const unitPlans = assertUnitPlanSet(workPlanUnitPlans(workPlan, { permissionBoundary: current.contract.permissions }), { requiredCoverage: current.contract.completion.requiredCoverage });
      const unitIds = new Set(unitPlans.map((plan) => plan.unitId));
      const unitResults = Object.fromEntries(Object.entries(current.unitResults ?? {}).filter(([unitId]) => unitIds.has(unitId) && workPlan.nodeResults?.[unitId]));
      const now = numberOr(guard.now, Date.now());
      const previousBudget = current.attemptBudget && typeof current.attemptBudget === "object" && !Array.isArray(current.attemptBudget)
        ? current.attemptBudget
        : {};
      const previousUnits = previousBudget.units && typeof previousBudget.units === "object" && !Array.isArray(previousBudget.units)
        ? previousBudget.units
        : {};
      const archivedGenerations = Array.isArray(previousBudget.archivedGenerations)
        ? clone(previousBudget.archivedGenerations)
        : [];
      if (Object.keys(previousUnits).length > 0 || previousBudget.activeGeneration) {
        archivedGenerations.push({
          generationId: String(previousBudget.activeGeneration || currentPlan.revisionId || `legacy:${current.id}`),
          planRevision: Number(previousBudget.planRevision || currentPlan.planRevision || 1),
          units: clone(previousUnits),
          archivedAt: iso(now),
          replacedBy: workPlan.revisionId,
        });
      }
      const attemptBudget = {
        ...clone(previousBudget),
        schemaVersion: 2,
        activeGeneration: workPlan.revisionId,
        planRevision: workPlan.planRevision,
        units: {},
        archivedGenerations,
      };
      const saved = await writeManifest({
        ...current,
        lifecycle: "queued",
        status: "queued",
        lease: null,
        needsAttention: false,
        blockingReason: null,
        userInputRequest: null,
        workPlan,
        unitPlans,
        unitResults,
        coverageLedger: coverageLedgerFor(current.contract, unitPlans, unitResults),
        attemptBudget,
        outbox: supersedeAttentionOutbox(current, "work plan replanned", now),
        revision: current.revision + 1,
        updatedAt: iso(now),
      });
      await appendEvent(key, "work-plan-replanned", { planRevision: workPlan.planRevision, planRevisionId: workPlan.revisionId, revision: saved.revision });
      return applied(true, null, saved);
    });
  }

  async function commitTerminal(current, outcome, { now = Date.now(), quality = current.quality } = {}) {
    const entry = outboxEntry(current, outcome, "task-outcome", now);
    const deliveryId = entry.deliveryId;
    const outbox = [...supersedeAttentionOutbox(current, "terminal outcome created", now), entry];
    const saved = await writeManifest({
      ...current,
      lifecycle: "terminal",
      status: "terminal",
      quality: String(quality ?? "unknown"),
      outcome,
      lease: null,
      outbox,
      needsAttention: ["partial", "delivered_with_warnings", "failed"].includes(String(outcome.outcome)),
      revision: current.revision + 1,
      updatedAt: iso(now),
      completedAt: iso(now),
    });
    await appendEvent(current.id, "terminal-outcome", { outcome: outcome.outcome, deliveryId, revision: saved.revision });
    return { applied: true, task: saved, deliveryId };
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
      return commitTerminal(current, outcome, { now, quality: guard.quality ?? current.quality });
    });
  }

  function cancellationOutcome(current, kind, payload = {}) {
    const artifactRefs = [...new Set(Object.values(current.unitResults ?? {}).flatMap((result) => Array.isArray(result.artifactRefs) ? result.artifactRefs : []))];
    const required = Object.keys(current.coverageLedger ?? {}).length;
    const completed = Object.values(current.coverageLedger ?? {}).filter((item) => item?.state === "completed").length;
    return {
      schemaVersion: 1,
      taskId: current.id,
      outcome: kind === "abandon" ? "abandoned" : "cancelled",
      summary: String(payload.summary || (kind === "abandon" ? "Task abandoned by the user." : "Task cancelled by the user.")),
      artifactRefs,
      coverage: { required, completed, unresolved: Object.entries(current.coverageLedger ?? {}).filter(([, item]) => item?.state !== "completed").map(([coverage]) => coverage) },
      warnings: [],
      blockingReason: null,
      userAction: null,
      resumable: payload.resumable === true,
    };
  }

  async function applyUserControl(id, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return applied(false, "revision-mismatch", current);
      if (input.expectedEpoch !== undefined && Number(current.epoch) !== Number(input.expectedEpoch)) return applied(false, "epoch-mismatch", current);
      const action = String(input.action ?? "").trim().toLowerCase();
      const payload = input.payload && typeof input.payload === "object" ? clone(input.payload) : {};
      const now = numberOr(input.now, Date.now());

      if (["cancel", "abandon"].includes(action)) {
        if (isTerminalLifecycle(current.lifecycle)) return applied(false, "already-terminal", current);
        return commitTerminal(current, cancellationOutcome(current, action, payload), { now, quality: "degraded" });
      }
      if (action === "retry" && isTerminalLifecycle(current.lifecycle)) {
        if (current.outcome?.resumable !== true) return applied(false, "not-resumable", current);
        const saved = await writeManifest({
          ...current,
          lifecycle: "queued",
          status: "queued",
          quality: "unknown",
          outcome: null,
          lease: null,
          needsAttention: false,
          blockingReason: null,
          userInputRequest: null,
          epoch: Number(current.epoch || 0) + 1,
          outcomeHistory: [...(current.outcomeHistory ?? []), current.outcome],
          outbox: supersedeAttentionOutbox(current, "terminal task retried", now),
          revision: current.revision + 1,
          updatedAt: iso(now),
        });
        await appendEvent(key, "retry-requested", { revision: saved.revision, epoch: saved.epoch });
        return applied(true, null, saved);
      }
      if (action === "retry_delivery") {
        if (!isTerminalLifecycle(current.lifecycle)) return applied(false, "delivery-retry-requires-terminal", current);
        const consumer = String(payload.consumer ?? "").trim();
        if (consumer !== "conversation") return applied(false, "delivery-retry-consumer-required", current);
        const index = (current.outbox ?? []).findIndex((entry) => entry.deliveryId === String(payload.deliveryId ?? ""));
        if (index < 0) return applied(false, "outbox-not-found", current);
        const entry = current.outbox[index];
        if (!entry.consumers?.includes(consumer) || entry.acknowledgements?.[consumer] === true) return applied(false, "delivery-not-pending", current);
        const state = itemStateForConsumer(entry, consumer);
        if (!["blocked_user_retry", "exhausted"].includes(state.status)) return applied(false, "delivery-not-retryable", current);
        const now = numberOr(input.now, Date.now());
        const nextState = normalizedDeliveryState({
          status: "ready",
          attemptId: `attempt:${randomUUID()}`,
          attempts: 0,
          nextAttemptAt: 0,
          lastError: null,
          updatedAt: iso(now),
        });
        const outbox = current.outbox.map((item, itemIndex) => itemIndex === index
          ? { ...item, deliveryStates: { ...(item.deliveryStates ?? {}), [consumer]: nextState } }
          : item);
        const saved = await writeManifest({ ...current, outbox, revision: current.revision + 1, updatedAt: iso(now) });
        await appendEvent(key, "outbox-delivery-retry-requested", {
          deliveryId: String(payload.deliveryId),
          consumer,
          attemptId: nextState.attemptId,
          revision: saved.revision,
        });
        return applied(true, null, saved);
      }
      if (action === "resolve_user_input") {
        if (current.lifecycle !== "waiting_user") return applied(false, "not-waiting-user", current);
        const hasAnswer = Object.prototype.hasOwnProperty.call(payload, "answer")
          || Object.prototype.hasOwnProperty.call(payload, "resolution")
          || Object.prototype.hasOwnProperty.call(payload, "choiceId")
          || Object.prototype.hasOwnProperty.call(payload, "choice")
          || Object.prototype.hasOwnProperty.call(payload, "value");
        if (!String(payload.requestId || "") || !hasAnswer) return applied(false, "invalid-user-input", current);
        if (current.userInputRequest?.requestId && current.userInputRequest.requestId !== payload.requestId) return applied(false, "request-mismatch", current);
        const answer = Object.prototype.hasOwnProperty.call(payload, "answer") ? payload.answer
          : Object.prototype.hasOwnProperty.call(payload, "resolution") ? payload.resolution
            : Object.prototype.hasOwnProperty.call(payload, "choiceId") ? { choiceId: payload.choiceId }
              : Object.prototype.hasOwnProperty.call(payload, "choice") ? { choiceId: payload.choice }
                : payload.value;
        const request = current.userInputRequest && typeof current.userInputRequest === "object" ? current.userInputRequest : {};
        const sourceChanged = request.reason === "source-changed" || current.blockingReason?.code === "SOURCE_CHANGED";
        if (sourceChanged) {
          const choice = selectedChoice(answer);
          if (!["restart-new-task", "cancel"].includes(choice)) return applied(false, "invalid-source-change-resolution", current);
          const summary = choice === "restart-new-task"
            ? "任务来源已变化；当前任务已取消，请按新来源重新创建任务。"
            : "任务来源已变化；当前任务已取消。";
          return commitTerminal(current, cancellationOutcome(current, "cancel", { summary }), { now, quality: "degraded" });
        }
        if (request.reason === "output-conflict-retarget") {
          const requestedPath = requestedPathFromAnswer(answer);
          if (!requestedPath || requestedPath.length > 4_000 || /[\u0000-\u001f]/.test(requestedPath)) {
            return applied(false, "invalid-output-path", current);
          }
          const output = { ...current.contract.output, requestedPath, conflictPolicy: "ask" };
          const saved = await writeManifest({
            ...current,
            contract: { ...current.contract, output },
            contractRevision: Number(current.contractRevision || 1) + 1,
            lifecycle: "queued",
            status: "queued",
            lease: null,
            needsAttention: false,
            blockingReason: null,
            userInputResolution: {
              requestId: String(payload.requestId),
              answer: clone(answer),
              resolvedAt: iso(now),
              reason: request.reason,
            },
            userInputRequest: null,
            outbox: supersedeAttentionOutbox(current, "output path supplied", now),
            revision: current.revision + 1,
            updatedAt: iso(now),
          });
          await appendEvent(key, "output-path-retargeted", { requestedPath, revision: saved.revision });
          return applied(true, null, saved);
        }
        if (outputConflictRequest(request)) {
          const choice = normalizedChoice(answer, request);
          const choices = advertisedChoices(request);
          if (!choices.has(choice)) return applied(false, "invalid-output-conflict-resolution", current);
          if (choice === "overwrite") {
            const output = { ...current.contract.output, conflictPolicy: "replace" };
            const saved = await writeManifest({
              ...current,
              contract: { ...current.contract, output },
              contractRevision: Number(current.contractRevision || 1) + 1,
              lifecycle: "queued",
              status: "queued",
              lease: null,
              needsAttention: false,
              blockingReason: null,
              userInputResolution: {
                requestId: String(payload.requestId),
                answer: clone(answer),
                resolvedAt: iso(now),
                reason: request.reason,
              },
              userInputRequest: null,
              outbox: supersedeAttentionOutbox(current, "output overwrite confirmed", now),
              revision: current.revision + 1,
              updatedAt: iso(now),
            });
            await appendEvent(key, "output-overwrite-confirmed", { revision: saved.revision });
            return applied(true, null, saved);
          }
          if (choice === "new-file") {
            const nextRequest = {
              ...clone(request),
              requestId: `request:${randomUUID()}`,
              kind: "output-retarget",
              reason: "output-conflict-retarget",
              question: "请输入新的输出文件完整路径。",
              choices: [],
              allowRetarget: true,
              previousRequestId: String(payload.requestId),
            };
            const nextTask = {
              ...current,
              lifecycle: "waiting_user",
              status: "waiting_user",
              needsAttention: true,
              blockingReason: { code: "OUTPUT_CONFLICT_RETARGET", message: "需要新的输出文件路径后才能继续。" },
              userInputRequest: nextRequest,
            };
            const attention = attentionPayload(nextTask, "waiting_user", { quality: "needs_review" });
            const saved = await writeManifest({
              ...nextTask,
              userInputResolution: null,
              outbox: [
                ...supersedeAttentionOutbox(current, "new output path requested", now),
                outboxEntry(nextTask, attention, "task-attention", now, { logicalRevision: current.revision + 1 }),
              ],
              revision: current.revision + 1,
              updatedAt: iso(now),
            });
            await appendEvent(key, "output-path-requested", { revision: saved.revision, requestId: nextRequest.requestId });
            return applied(true, null, saved);
          }
        }
        const saved = await writeManifest({
          ...current,
          lifecycle: "queued",
          status: "queued",
          lease: null,
          needsAttention: false,
          blockingReason: null,
          userInputResolution: {
            requestId: String(payload.requestId),
            answer: clone(answer),
            resolvedAt: iso(now),
            ...(request.reason ? { reason: String(request.reason) } : {}),
            ...(request.effectId ? { effectId: String(request.effectId) } : {}),
            ...(request.unitId ? { unitId: String(request.unitId) } : {}),
            ...(request.operation ? { operation: String(request.operation) } : {}),
          },
          userInputRequest: null,
          outbox: supersedeAttentionOutbox(current, "user input resolved", now),
          revision: current.revision + 1,
          updatedAt: iso(now),
        });
        await appendEvent(key, "user-input-resolved", { requestId: String(payload.requestId), revision: saved.revision });
        return applied(true, null, saved);
      }
      if (action === "retarget_output") {
        if (!ACTIVE_LIFECYCLES.has(current.lifecycle) || ["leased", "running", "assembling"].includes(current.lifecycle)) return applied(false, "output-retarget-requires-pause", current);
        const requestedPath = String(payload.requestedPath || "").trim();
        if (!requestedPath) return applied(false, "invalid-output-path", current);
        const output = { ...current.contract.output, requestedPath, ...(payload.conflictPolicy ? { conflictPolicy: String(payload.conflictPolicy) } : {}) };
        const nextLifecycle = current.lifecycle === "paused" || current.lifecycle === "waiting_user" || current.lifecycle === "blocked" ? "queued" : current.lifecycle;
        const outbox = nextLifecycle !== current.lifecycle
          ? supersedeAttentionOutbox(current, "output retargeted", now)
          : current.outbox;
        const saved = await writeManifest({ ...current, contract: { ...current.contract, output }, contractRevision: Number(current.contractRevision || 1) + 1, lifecycle: nextLifecycle, status: nextLifecycle, lease: null, needsAttention: false, blockingReason: nextLifecycle === "queued" ? null : current.blockingReason ?? null, userInputRequest: nextLifecycle === "queued" ? null : current.userInputRequest ?? null, outbox, revision: current.revision + 1, updatedAt: iso(now) });
        await appendEvent(key, "output-retargeted", { requestedPath, revision: saved.revision });
        return applied(true, null, saved);
      }
      if (["pause", "resume", "retry"].includes(action)) {
        if (action === "pause") {
          if (isTerminalLifecycle(current.lifecycle)) return applied(false, "already-terminal", current);
          const saved = await writeManifest({ ...current, lifecycle: "paused", status: "paused", lease: null, needsAttention: false, outbox: supersedeAttentionOutbox(current, "task paused", now), revision: current.revision + 1, updatedAt: iso(now) });
          await appendEvent(key, "user-paused", { revision: saved.revision });
          return applied(true, null, saved);
        }
        if (!["paused", "waiting_user", "blocked"].includes(current.lifecycle)) return applied(false, "not-resumable", current);
        const saved = await writeManifest({ ...current, lifecycle: "queued", status: "queued", lease: null, needsAttention: false, blockingReason: null, userInputRequest: null, outbox: supersedeAttentionOutbox(current, `user ${action} requested`, now), revision: current.revision + 1, updatedAt: iso(now) });
        await appendEvent(key, "user-resumed", { revision: saved.revision });
        return applied(true, null, saved);
      }
      return applied(false, "unknown-user-action", current);
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
      const now = numberOr(input.now, Date.now());
      const entryState = itemStateForConsumer(entry, consumer);
      const outbox = current.outbox.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        acknowledgements: { ...(item.acknowledgements ?? {}), [consumer]: true },
        deliveryStates: {
          ...(item.deliveryStates ?? {}),
          [consumer]: normalizedDeliveryState({
            ...entryState,
            status: "delivered",
            updatedAt: iso(now),
          }),
        },
      } : item);
      const saved = await writeManifest({ ...current, outbox, revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "outbox-acknowledged", { deliveryId: String(deliveryId), consumer, revision: saved.revision });
      return applied(true, null, saved);
    });
  }

  function itemStateForConsumer(entry, consumer) {
    return normalizedDeliveryState(entry?.deliveryStates?.[consumer] ?? {});
  }

  async function updateOutboxDeliveryState(id, deliveryId, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return applied(false, "revision-mismatch", current);
      const consumer = String(input.consumer ?? "").trim();
      if (!consumer) return applied(false, "consumer-required", current);
      const index = (current.outbox ?? []).findIndex((entry) => entry.deliveryId === String(deliveryId));
      if (index < 0) return applied(false, "outbox-not-found", current);
      const entry = current.outbox[index];
      if (!Array.isArray(entry.consumers) || !entry.consumers.includes(consumer)) return applied(false, "unknown-consumer", current);
      if (entry.acknowledgements?.[consumer] === true) return applied(false, "already-acknowledged", current);
      const now = numberOr(input.now, Date.now());
      const state = normalizedDeliveryState({ ...(input.state ?? {}), updatedAt: iso(now) });
      const outbox = current.outbox.map((item, itemIndex) => itemIndex === index
        ? { ...item, deliveryStates: { ...(item.deliveryStates ?? {}), [consumer]: state } }
        : item);
      const saved = await writeManifest({ ...current, outbox, revision: current.revision + 1, updatedAt: iso(now) });
      await appendEvent(key, "outbox-delivery-state", {
        deliveryId: String(deliveryId),
        consumer,
        status: state.status,
        attemptId: state.attemptId,
        attempts: state.attempts,
        revision: saved.revision,
      });
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
        if (error?.code === "COMPLEX_TASK_MANIFEST_CORRUPT") {
          try {
            tasks.push(await persistCorruptRecovery(id, error));
            continue;
          } catch (recoveryError) {
            error.recoveryError = String(recoveryError?.message || recoveryError);
          }
        }
        tasks.push({ schemaVersion: 1, id, kind: "task", lifecycle: "blocked", status: "blocked", quality: "failed", revision: null, corrupt: true, needsAttention: true, error: String(error?.message || error), ...(error?.recoveryError ? { recoveryError: error.recoveryError } : {}), outbox: [] });
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
      pending.push({
        taskId: task.id,
        deliveryId: entry.deliveryId,
        payload: clone(entry.payload),
        pendingConsumers: waiting,
        deliveryStates: clone(entry.deliveryStates ?? {}),
      });
    }
    return pending.sort((left, right) => String(left.deliveryId).localeCompare(String(right.deliveryId)));
  }

  async function readOutbox(id) {
    const task = await read(id);
    return clone(task.outbox ?? []);
  }

  async function reconcileOutbox(input = {}) {
    const now = numberOr(input.now, Date.now());
    const report = { scanned: 0, repaired: [], auditEvents: 0, issues: [] };
    const tasks = await list();
    report.scanned = tasks.length;

    for (const listed of tasks) {
      if (listed.corrupt) {
        report.issues.push({ taskId: listed.id, message: String(listed.error || "task manifest is corrupt") });
        continue;
      }
      try {
        const result = await serialize(mutationChains, listed.id, async () => {
          const current = await read(listed.id);
          const expected = expectedOutboxNotification(current);
          let entry = matchingOutboxEntry(current, expected);
          let outbox = Array.isArray(current.outbox) ? current.outbox : [];
          const keepAttentionId = expected?.kind === "task-attention" ? entry?.deliveryId : null;
          const obsoleteAttention = outbox.filter((candidate) => candidate?.kind === "task-attention"
            && candidate.deliveryId !== keepAttentionId
            && pendingConsumers(candidate).length > 0);
          let changed = false;

          if (obsoleteAttention.length > 0) {
            outbox = supersedeAttentionOutbox(
              { ...current, outbox },
              "outbox reconciliation superseded stale attention",
              now,
              { keepDeliveryId: keepAttentionId },
            );
            changed = true;
          }
          if (expected && !entry) {
            entry = outboxEntry(current, expected.payload, expected.kind, now, { logicalRevision: current.revision });
            outbox = [...outbox, entry];
            changed = true;
          }

          const saved = changed
            ? await writeManifest({ ...current, outbox, revision: current.revision + 1, updatedAt: iso(now) })
            : current;
          const events = entry ? await readEvents(current.id) : [];
          const needsAudit = changed || (entry && !hasOutboxCreationEvent(events, entry.deliveryId));
          if (needsAudit) {
            await appendEvent(current.id, "outbox-recovered", {
              ...(entry ? { deliveryId: entry.deliveryId, kind: entry.kind } : {}),
              lifecycle: current.lifecycle,
              revision: saved.revision,
              recoveredAt: iso(now),
              entryRebuilt: Boolean(expected && !matchingOutboxEntry(current, expected)),
              ...(obsoleteAttention.length ? { supersededDeliveryIds: obsoleteAttention.map((candidate) => candidate.deliveryId) } : {}),
            });
          }
          return { changed, auditEvents: needsAudit ? 1 : 0 };
        });
        if (result.changed) report.repaired.push(listed.id);
        report.auditEvents += result.auditEvents;
      } catch (error) {
        report.issues.push({ taskId: listed.id, message: String(error?.message || error) });
      }
    }
    return report;
  }

  async function remove(id) {
    const key = taskId(id);
    return serialize(mutationChains, key, () => rm(dirFor(key), { recursive: true, force: true }));
  }

  async function removeIfUnreferenced(id, input = {}) {
    const key = taskId(id);
    return serialize(mutationChains, key, async () => {
      const current = await read(key);
      if (!Number.isInteger(input.expectedRevision) || current.revision !== input.expectedRevision) return applied(false, "revision-mismatch", current);
      if (!isTerminalLifecycle(current.lifecycle)) return applied(false, "lifecycle-not-terminal", current);
      if ((current.outbox ?? []).some((entry) => pendingConsumers(entry).length > 0)) return applied(false, "outbox-pending", current);
      await rm(dirFor(key), { recursive: true, force: true });
      return { ...applied(true, null, current), deleted: true };
    });
  }

  async function pruneExpired(now = Date.now()) {
    const deleted = [];
    let kept = 0;
    for (const task of await list()) {
      const allAcked = (task.outbox ?? []).every((entry) => pendingConsumers(entry).length === 0);
      const updated = Date.parse(task.updatedAt || task.createdAt || 0);
      if (isTerminalLifecycle(task.lifecycle) && allAcked && Number(now) - updated >= retentionMs) {
        // Re-read and validate the exact revision inside the mutation chain.
        // A user may resume a terminal task after list() but before cleanup;
        // unconditional rm() would otherwise delete the newly queued work.
        const result = await removeIfUnreferenced(task.id, { expectedRevision: task.revision });
        if (result.applied && result.deleted) deleted.push(task.id);
        else kept++;
      } else kept++;
    }
    return { deleted, kept };
  }

  return { root, retentionMs, acquireLease, ackOutbox, appendEvent, applyUserControl, checkpointUnit, complete, create, heartbeat, list, listPendingOutbox, pruneExpired, read, readEvents, readOutbox, reconcileOutbox, recordProgress, reserveUnitAttempt, recoverExpiredLease, recoverStalledLease, releaseLease, remove, removeIfUnreferenced, replan, transition, updateOutboxDeliveryState };
}
