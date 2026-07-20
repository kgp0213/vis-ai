import { parseArtifactReference } from "./complex-task-artifact-reference.mjs";

const ACTIVE_LIFECYCLES = new Set(["created", "queued", "leased", "running", "assembling"]);
const ATTENTION_LIFECYCLES = new Set(["waiting_user", "blocked", "paused"]);
const ATTENTION_OUTCOMES = new Set(["delivered_with_warnings", "partial", "failed", "abandoned"]);
const PUBLIC_QUALITY_STATES = new Set(["verified", "needs_review", "unknown"]);
const PUBLIC_OUTCOMES = new Set(["delivered", "delivered_with_warnings", "partial", "failed", "cancelled", "abandoned"]);

function text(value, fallback = "") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/**
 * The durable task kernel has historically used passed/degraded/failed while
 * the HTTP contract used verified/needs_review/unknown. Keep that translation
 * at the projection boundary so stored manifests and old clients remain
 * compatible without exposing two competing public vocabularies.
 */
export function normalizePublicQuality(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "passed" || normalized === "verified") return "verified";
  if (normalized === "degraded" || normalized === "needs_review") return "needs_review";
  return PUBLIC_QUALITY_STATES.has(normalized) ? normalized : "unknown";
}

export function normalizePublicOutcome(value) {
  const source = object(value)?.outcome ?? value;
  const normalized = String(source ?? "").trim().toLowerCase();
  if (normalized === "completed") return "delivered";
  if (normalized === "completed_with_warnings") return "delivered_with_warnings";
  return PUBLIC_OUTCOMES.has(normalized) ? normalized : null;
}

function coverageProgress(ledger) {
  const entries = Object.values(object(ledger) ?? {});
  if (entries.length === 0) return {};
  const completedStates = new Set(["completed", "degraded", "source_fallback", "cancelled"]);
  const degradedStates = new Set(["degraded", "source_fallback", "unresolved", "host_integrity_failed"]);
  return {
    completedUnits: entries.filter((entry) => completedStates.has(String(entry?.state ?? ""))).length,
    totalUnits: entries.length,
    degradedUnits: entries.filter((entry) => degradedStates.has(String(entry?.state ?? ""))).length,
  };
}

function pendingOutboxEntries(raw) {
  return (Array.isArray(raw?.outbox) ? raw.outbox : []).filter((entry) => {
    // Derive pending consumers from the authoritative acknowledgement map when
    // available. A stale persisted pendingConsumers cache must not make one
    // consumer's acknowledgement hide (or resurrect) the other consumer.
    const consumers = Array.isArray(entry?.consumers) && entry.consumers.length
      ? [...new Set(entry.consumers.map((consumer) => text(consumer)).filter(Boolean))]
      : (Array.isArray(entry?.pendingConsumers) ? [...new Set(entry.pendingConsumers.map((consumer) => text(consumer)).filter(Boolean))] : []);
    const acknowledgements = object(entry?.acknowledgements) ?? {};
    return consumers.some((consumer) => acknowledgements[consumer] !== true);
  });
}

function retryableConversationDelivery(raw) {
  return pendingOutboxEntries(raw).some((entry) => {
    const consumers = Array.isArray(entry?.consumers) ? entry.consumers : [];
    if (!consumers.includes("conversation") || entry?.acknowledgements?.conversation === true) return false;
    return ["blocked_user_retry", "exhausted"].includes(String(entry?.deliveryStates?.conversation?.status ?? "ready"));
  });
}

function defaultAllowedActions(raw, lifecycle, outcome) {
  const actions = [];
  if (["created", "queued", "leased", "running", "assembling"].includes(lifecycle)) actions.push("pause", "cancel");
  if (lifecycle === "paused") actions.push("resume", "retarget_output", "cancel");
  if (lifecycle === "blocked") actions.push("retry", "retarget_output", "cancel");
  if (lifecycle === "waiting_user") {
    if (raw?.userInputRequest) actions.push("resolve_user_input");
    actions.push("retarget_output", "cancel");
  }
  const envelope = object(raw?.outcome);
  if (lifecycle === "terminal" && envelope?.resumable === true) actions.push("retry");
  if (lifecycle === "terminal" && retryableConversationDelivery(raw)) actions.push("retry_delivery");
  if (lifecycle === "terminal" && pendingOutboxEntries(raw).length > 0) actions.push("ack_outcome");
  if (lifecycle === "terminal" && pendingOutboxEntries(raw).length === 0) actions.push("delete_record");
  return [...new Set(actions)];
}

function artifactDescriptor(value, fallbackRole = "artifact", unitId = null) {
  if (typeof value === "string") {
    const artifactRef = text(value);
    if (!artifactRef) return null;
    const parsed = parseArtifactReference(artifactRef);
    return {
      artifactId: parsed.artifactId,
      artifactRef,
      revision: parsed.revision,
      sha256: parsed.sha256,
      path: null,
      role: fallbackRole,
      unitId: text(unitId) || null,
      previewAvailable: parsed.exact,
    };
  }
  const item = object(value);
  if (!item) return null;
  const manifest = object(item.manifest);
  const artifactRef = text(item.artifactRef, text(item.ref, text(manifest?.artifactRef)));
  const parsed = artifactRef ? parseArtifactReference(artifactRef) : null;
  const artifactId = text(item.artifactId, text(manifest?.artifactId, parsed?.artifactId ?? ""));
  if (!artifactId && !artifactRef) return null;
  const rawRevision = item.revision ?? manifest?.revision ?? parsed?.revision;
  const revisionNumber = Number(rawRevision);
  const revision = Number.isSafeInteger(revisionNumber) && revisionNumber > 0 ? revisionNumber : null;
  const sha256 = text(item.sha256, text(manifest?.sha256, text(parsed?.sha256))).toLowerCase() || null;
  const rawPath = item.path ?? manifest?.path ?? null;
  const path = rawPath == null ? null : String(rawPath);
  const resolvedUnitId = text(item.unitId, text(manifest?.owner?.unitId, text(unitId))) || null;
  return {
    ...item,
    ...(artifactId ? { artifactId } : {}),
    ...(artifactRef ? { artifactRef } : {}),
    revision,
    sha256,
    path,
    unitId: resolvedUnitId,
    previewAvailable: Boolean(path || parsed?.exact),
    ...(item.role ? {} : { role: fallbackRole }),
  };
}

function taskArtifacts(raw, outputPath) {
  const metadata = object(raw?.metadata);
  const manifests = object(raw?.artifactManifests);
  const outcome = object(raw?.outcome);
  const pendingAssembly = object(raw?.pendingAssembly);
  const unitResults = Array.isArray(raw?.unitResults) ? raw.unitResults : Object.values(object(raw?.unitResults) ?? {});
  const ledgerEntries = Object.values(object(raw?.coverageLedger) ?? {});
  const candidates = Array.isArray(raw?.artifacts)
    ? raw.artifacts
    : Array.isArray(metadata?.artifacts)
      ? metadata.artifacts
      : manifests
        ? Object.values(manifests)
        : [];
  const artifacts = [];
  const byReference = new Map();
  const roleRank = { artifact: 0, pending_assembly: 1, unit: 2, outcome: 3, final: 4 };
  const add = (value, role = "artifact", unitId = null) => {
    const descriptor = artifactDescriptor(value, role, unitId);
    if (!descriptor) return null;
    const reference = text(descriptor.artifactRef);
    const artifactId = text(descriptor.artifactId);
    const existing = (reference ? byReference.get(`ref:${reference}`) : null)
      || artifacts.find((item) => !item.artifactRef && artifactId && item.artifactId === artifactId);
    if (existing) {
      const previousRole = existing.role;
      Object.assign(existing, Object.fromEntries(Object.entries(descriptor).filter(([, item]) => item !== null && item !== undefined)));
      existing.role = (roleRank[role] ?? 0) > (roleRank[previousRole] ?? 0) ? role : previousRole;
      return existing;
    }
    artifacts.push(descriptor);
    if (reference) byReference.set(`ref:${reference}`, descriptor);
    return descriptor;
  };

  candidates.forEach((item) => add(item, item?.role || "artifact"));
  (Array.isArray(raw?.artifactRefs) ? raw.artifactRefs : []).forEach((item) => add(item, item?.role || "artifact"));
  for (const result of unitResults) {
    for (const reference of Array.isArray(result?.artifactRefs) ? result.artifactRefs : []) add(reference, "unit", result?.unitId);
  }
  for (const entry of ledgerEntries) {
    for (const reference of Array.isArray(entry?.artifactRefs) ? entry.artifactRefs : []) add(reference, "unit", entry?.primaryUnitId ?? entry?.unitId);
  }
  for (const reference of Array.isArray(pendingAssembly?.artifactRefs) ? pendingAssembly.artifactRefs : []) add(reference, "pending_assembly");
  const outcomeRefs = Array.isArray(outcome?.artifactRefs) ? outcome.artifactRefs : [];
  outcomeRefs.forEach((reference, index) => add(reference, index === outcomeRefs.length - 1 ? "final" : "outcome"));

  if (outputPath) {
    const targetReference = text(outcomeRefs.at(-1), text(pendingAssembly?.artifactRefs?.at(-1)));
    const target = targetReference
      ? artifacts.find((item) => item.artifactRef === targetReference)
      : artifacts.at(-1);
    if (target) target.path = target.path || outputPath;
    else {
      const artifactRef = targetReference || text(raw?.id, "task") + ":output";
      add({ artifactId: parseArtifactReference(artifactRef).artifactId, artifactRef: targetReference || null, path: outputPath, mediaType: "text/markdown" }, "final");
    }
  }
  for (const artifact of artifacts) {
    artifact.previewAvailable = Boolean(artifact.path || parseArtifactReference(artifact.artifactRef).exact);
  }
  return artifacts;
}

function legacyLifecycle(status) {
  switch (String(status ?? "").toLowerCase()) {
    case "queued": return "queued";
    case "running": return "running";
    case "paused": return "paused";
    case "awaiting_output":
    case "source_changed": return "waiting_user";
    case "blocked": return "blocked";
    case "completed":
    case "completed_with_warnings":
    case "failed":
    case "cancelled":
    case "abandoned":
    case "corrupt":
    case "interrupted":
      return "terminal";
    default: return status ? "terminal" : "queued";
  }
}

function legacyOutcome(status) {
  switch (String(status ?? "").toLowerCase()) {
    case "completed": return "delivered";
    case "completed_with_warnings": return "delivered_with_warnings";
    case "failed":
    case "corrupt": return "failed";
    case "cancelled": return "cancelled";
    case "abandoned": return "abandoned";
    default: return null;
  }
}

function legacyQuality(job) {
  const status = String(job?.status ?? "").toLowerCase();
  if (status === "completed" && job?.qualityPassed !== false) return "verified";
  if (status === "completed_with_warnings" || job?.qualityPassed === false) return "needs_review";
  return "unknown";
}

function genericStatus(lifecycle, outcome) {
  if (lifecycle === "waiting_user") return "waiting_user";
  if (lifecycle === "blocked") return "blocked";
  if (lifecycle === "paused") return "paused";
  if (lifecycle === "terminal") {
    if (outcome === "delivered") return "completed";
    if (outcome === "delivered_with_warnings") return "completed_with_warnings";
    if (outcome === "partial") return "partial";
    if (outcome === "cancelled") return "cancelled";
    if (outcome === "abandoned") return "abandoned";
    if (outcome === "failed") return "failed";
  }
  return lifecycle;
}

export function taskIsActive(task) {
  return ACTIVE_LIFECYCLES.has(String(task?.lifecycle ?? "").toLowerCase());
}

export function taskNeedsAttention(task) {
  if (task?.needsAttention === true) return true;
  const lifecycle = String(task?.lifecycle ?? "").toLowerCase();
  const outcome = normalizePublicOutcome(task?.outcome);
  return ATTENTION_LIFECYCLES.has(lifecycle)
    || ATTENTION_OUTCOMES.has(outcome)
    || pendingOutboxEntries(task).length > 0;
}

export function projectBackgroundTask(raw = {}, options = {}) {
  const legacy = options.legacy === true
    || raw?.legacy === true
    || String(raw?.id ?? "").startsWith("document:")
    || (raw?.kind === "document" && !raw?.lifecycle);
  const lifecycle = legacy
    ? legacyLifecycle(raw.status)
    : text(raw.lifecycle, raw.running ? "running" : "queued");
  const contract = object(raw.contract);
  const metadata = object(raw.metadata);
  const outcomeEnvelope = object(raw.outcome);
  const outcome = legacy ? legacyOutcome(raw.status) : normalizePublicOutcome(outcomeEnvelope ?? raw.outcome);
  const quality = normalizePublicQuality(legacy ? legacyQuality(raw) : raw.quality);
  const id = raw?.id ?? raw?.taskId ?? null;
  // Coverage Ledger is authoritative for completion counts; raw progress adds
  // timestamps, sequence and worker evidence without replacing those counts.
  const progress = {
    ...(object(raw?.progress) ? { ...raw.progress } : {}),
    ...coverageProgress(raw?.coverageLedger),
  };
  const requestedOutputPath = contract?.output?.requestedPath ?? null;
  const explicitOutputPath = raw.outputPath ?? metadata?.outputPath ?? null;
  const terminalOutput = lifecycle === "terminal" && ["delivered", "delivered_with_warnings"].includes(outcome);
  const provisionalOutputPath = explicitOutputPath ?? (terminalOutput ? requestedOutputPath : null);
  const artifacts = taskArtifacts(raw, provisionalOutputPath);
  const outputPath = explicitOutputPath
    ?? (terminalOutput ? artifacts.find((item) => item.path)?.path ?? requestedOutputPath : null);
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map((item) => ({ ...item }))
    : Array.isArray(outcomeEnvelope?.warnings)
      ? outcomeEnvelope.warnings.map((item) => ({ ...item }))
      : [];
  const allowedActions = Array.isArray(raw.allowedActions)
    ? [...raw.allowedActions]
    : defaultAllowedActions(raw, lifecycle, outcome);
  const projected = {
    schemaVersion: 1,
    id,
    taskId: id,
    taskType: text(raw.taskType, text(contract?.taskType, raw.kind === "document" ? "document" : "process")),
    kind: raw.kind ?? (legacy ? "document" : "task"),
    goal: text(raw.goal, text(contract?.goal, text(raw.command, text(raw.sourceName, "后台任务")))),
    workspace: raw.workspace ?? raw.workspaceRoot ?? contract?.workspace ?? null,
    lifecycle,
    outcome,
    outcomeSummary: outcomeEnvelope?.summary ?? null,
    quality,
    status: genericStatus(lifecycle, outcome),
    active: taskIsActive({ lifecycle }),
    // Evaluate attention against the raw task so pending Outbox consumers are
    // included before the projection drops internal delivery fields.
    needsAttention: taskNeedsAttention({ ...raw, lifecycle, outcome }),
    running: taskIsActive({ lifecycle }),
    revision: numberOrNull(raw.revision) ?? 0,
    epoch: numberOrNull(raw.epoch) ?? 0,
    lease: raw.lease && typeof raw.lease === "object" ? { ...raw.lease } : null,
    progress,
    warnings,
    issues: Array.isArray(raw.issues) ? raw.issues.map((item) => ({ ...item })) : [],
    model: raw.model ?? raw.currentModel ?? metadata?.currentModel ?? null,
    modelRole: raw.modelRole ?? raw.currentModelRole ?? null,
    artifacts,
    artifactRefs: artifacts,
    outputPath: outputPath ?? null,
    artifactStatus: raw.artifactStatus ?? (outcome === "delivered" || outcome === "delivered_with_warnings" ? "verified" : "pending"),
    userAction: raw.userAction ?? raw.userInput ?? raw.userInputRequest ?? raw.pendingUserInput ?? outcomeEnvelope?.userAction ?? null,
    blockingReason: raw.blockingReason ?? outcomeEnvelope?.blockingReason ?? null,
    allowedActions,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? null,
    createdAt: raw.createdAt ?? null,
    command: raw.command ?? null,
    exitCode: raw.exitCode ?? null,
    legacy,
  };
  if (raw.handoff !== undefined) projected.handoff = raw.handoff;
  if (raw.executionEpoch !== undefined) projected.executionEpoch = raw.executionEpoch;
  if (raw.coverage !== undefined) projected.coverage = raw.coverage;
  if (raw.contract !== undefined) projected.contract = raw.contract;
  if (raw.pendingDeliveries !== undefined) projected.pendingDeliveries = raw.pendingDeliveries;
  return projected;
}

function compareFreshness(left, right) {
  const leftRevision = numberOrNull(left?.revision) ?? -1;
  const rightRevision = numberOrNull(right?.revision) ?? -1;
  if (leftRevision !== rightRevision) return leftRevision - rightRevision;
  return Date.parse(left?.updatedAt ?? left?.createdAt ?? 0) - Date.parse(right?.updatedAt ?? right?.createdAt ?? 0);
}

async function listValue(value) {
  const result = typeof value === "function" ? await value() : value;
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.jobs)) return result.jobs;
  return [];
}

export function createBackgroundTaskRegistry(options = {}) {
  const list = async () => {
    const [processJobs, legacyJobs, taskJobs, deliveries] = await Promise.all([
      listValue(options.listProcessJobs),
      listValue(options.listLegacyDocumentJobs),
      listValue(options.listTaskJobs),
      typeof options.listPendingDeliveries === "function" ? options.listPendingDeliveries() : [],
    ]);
    const byId = new Map();
    const add = (raw, legacy = false) => {
      const projected = projectBackgroundTask(raw, { legacy });
      if (projected.id == null) return;
      const previous = byId.get(String(projected.id));
      if (!previous || compareFreshness(previous, projected) <= 0) byId.set(String(projected.id), projected);
    };
    processJobs.forEach((job) => add(job, false));
    legacyJobs.forEach((job) => add(job, true));
    taskJobs.forEach((job) => add(job, false));
    const jobs = [...byId.values()].sort((left, right) => Date.parse(right.updatedAt ?? right.createdAt ?? 0) - Date.parse(left.updatedAt ?? left.createdAt ?? 0));
    return { jobs, pendingDeliveries: Array.isArray(deliveries) ? deliveries : [] };
  };
  return { list };
}
