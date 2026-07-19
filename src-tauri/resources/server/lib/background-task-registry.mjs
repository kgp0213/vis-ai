const ACTIVE_LIFECYCLES = new Set(["created", "queued", "leased", "running", "assembling"]);
const ATTENTION_LIFECYCLES = new Set(["waiting_user", "blocked", "paused"]);
const ATTENTION_OUTCOMES = new Set(["delivered_with_warnings", "partial", "failed"]);

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
    if (Array.isArray(entry?.pendingConsumers)) return entry.pendingConsumers.length > 0;
    const consumers = Array.isArray(entry?.consumers) ? entry.consumers : [];
    const acknowledgements = object(entry?.acknowledgements) ?? {};
    return consumers.some((consumer) => acknowledgements[consumer] !== true);
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
  if (lifecycle === "terminal" && pendingOutboxEntries(raw).length > 0) actions.push("ack_outcome");
  if (lifecycle === "terminal" && pendingOutboxEntries(raw).length === 0) actions.push("delete_record");
  return [...new Set(actions)];
}

function taskArtifacts(raw, outputPath) {
  const metadata = object(raw?.metadata);
  const manifests = object(raw?.artifactManifests);
  const candidates = Array.isArray(raw?.artifacts)
    ? raw.artifacts
    : Array.isArray(metadata?.artifacts)
      ? metadata.artifacts
      : manifests
        ? Object.values(manifests)
        : [];
  const artifacts = candidates.filter((item) => object(item)).map((item) => ({ ...item }));
  if (artifacts.length === 0 && outputPath) {
    const artifactId = object(raw?.outcome)?.artifactRefs?.[0] ?? `${raw?.id ?? "task"}:output`;
    artifacts.push({ artifactId, path: outputPath, mediaType: "text/markdown" });
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
    case "cancelled":
    case "abandoned": return "cancelled";
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
  const outcome = String(task?.outcome ?? "").toLowerCase();
  return ATTENTION_LIFECYCLES.has(lifecycle) || ATTENTION_OUTCOMES.has(outcome);
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
  const outcome = legacy ? legacyOutcome(raw.status) : (outcomeEnvelope ? text(outcomeEnvelope.outcome) : (raw.outcome == null ? null : text(raw.outcome)));
  const quality = legacy ? legacyQuality(raw) : text(raw.quality, "unknown");
  const id = raw?.id ?? raw?.taskId ?? null;
  const progress = object(raw?.progress) ? { ...raw.progress } : coverageProgress(raw?.coverageLedger);
  const requestedOutputPath = contract?.output?.requestedPath ?? null;
  const provisionalOutputPath = raw.outputPath ?? metadata?.outputPath ?? requestedOutputPath;
  const artifacts = taskArtifacts(raw, provisionalOutputPath);
  const outputPath = raw.outputPath ?? metadata?.outputPath ?? artifacts[0]?.path ?? requestedOutputPath;
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
    needsAttention: taskNeedsAttention({ lifecycle, outcome, needsAttention: raw.needsAttention }),
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
