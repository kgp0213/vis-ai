import { isKnownPlanStep, isPlanComplete, normalizeCompletedStepIds } from "./plan-state-policy.mjs";

function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeSteps(value) {
  return (Array.isArray(value) ? value : [])
    .filter((step) => step && typeof step === "object" && text(step.id))
    .map((step) => ({
      ...clone(step),
      id: text(step.id),
      title: text(step.title, text(step.id)),
      action: text(step.action, text(step.title, text(step.id))),
      status: step.status === "completed" ? "completed" : step.status === "blocked" ? "blocked" : step.status === "in_progress" ? "in_progress" : "pending",
    }));
}

const HOST_EVIDENCE_SOURCES = new Set([
  "host_tool",
  "artifact_scan",
  "test_result",
  "provider_result",
  "user_confirmation",
]);

function isHostIssuedEvidence(entry) {
  if (!entry || typeof entry !== "object" || entry.verified !== true) return false;
  const evidenceId = text(entry.evidenceId ?? entry.id);
  const source = text(entry.source ?? entry.type).toLowerCase();
  // `issuedByHost` is deliberately required. A model can describe a host
  // evidence type, but only the runtime may sign a fact for Plan completion.
  return Boolean(evidenceId && entry.issuedByHost === true && HOST_EVIDENCE_SOURCES.has(source));
}

export function projectPlanStepEvidence({
  facts = [],
  plan = null,
  stepId = null,
  operationId = null,
  requestId = null,
  sessionId = null,
  afterEvidenceSeq = 0,
} = {}) {
  const completedStepIds = new Set(normalizeCompletedStepIds(plan?.steps, plan?.completedStepIds));
  const expectedStep = plan?.steps?.find((step) => !completedStepIds.has(step.id) && step.status !== "completed") ?? null;
  if (!expectedStep || text(stepId) !== expectedStep.id) return [];
  const consumedEvidenceIds = new Set((plan.steps ?? []).flatMap((step) => (
    step.status === "completed" || completedStepIds.has(step.id)
      ? (step.evidenceRefs ?? []).map((ref) => text(ref?.evidenceId)).filter(Boolean)
      : []
  )));
  return (Array.isArray(facts) ? facts : [])
    .filter((fact) => fact?.status === "succeeded")
    .filter((fact) => !["submit_plan", "mark_step_complete"].includes(text(fact.toolName).toLowerCase()))
    .filter((fact) => Number(fact?.evidenceSeq) > Math.max(0, Number(afterEvidenceSeq) || 0))
    .filter((fact) => !consumedEvidenceIds.has(text(fact.toolCallId, `tool-${fact.recordedAt}`)))
    .slice(-32)
    .map((fact) => ({
      evidenceId: text(fact.toolCallId, `tool-${fact.recordedAt}`),
      type: "tool_read",
      source: "host_tool",
      issuedByHost: true,
      verified: true,
      evidenceSeq: Number(fact.evidenceSeq),
      stepId: expectedStep.id,
      operationId: text(operationId) || null,
      requestId: text(requestId) || null,
      sessionId: text(sessionId) || null,
      toolCallId: text(fact.toolCallId) || null,
      toolName: text(fact.toolName) || "tool",
    }));
}

function planGoal({ planId, summary, steps, sessionId, status, updatedAt }) {
  return {
    id: text(planId, `goal:${sessionId}`),
    title: text(summary, steps?.[0]?.title || "当前计划"),
    status,
    sessionId,
    updatedAt,
  };
}

/**
 * Session-scoped Plan state. This module records Plan facts and never calls a
 * model or tool loop; Launcher remains responsible for execution.
 */
export function createPlanRuntime({
  store,
  getSessionName = () => "desktop",
  getConversationId = () => null,
  onEvent = () => {},
  onGoalsChanged = () => {},
  now = () => new Date().toISOString(),
} = {}) {
  if (!store || typeof store.loadPlanState !== "function" || typeof store.savePlanState !== "function") {
    throw new TypeError("plan runtime store is required");
  }

  let boundSession = null;
  let explicitSession = null;
  let pending = null;
  let active = null;
  let revision = null;
  let goals = [];

  function session() {
    return text(explicitSession, text(getSessionName(), "desktop"));
  }

  function emit(event) {
    try { onEvent(event); } catch { /* dashboard observers cannot block Plan state */ }
  }

  function emitPlan(event) {
    emit({ ...event, plan: snapshot() });
  }

  function setGoals(next) {
    goals = Array.isArray(next) ? clone(next) : [];
    try { onGoalsChanged(clone(goals)); } catch { /* persistence is owned by the caller */ }
  }

  function snapshot() {
    ensureSession();
    if (pending && !active) {
      return {
        session: boundSession,
        status: "pending",
        path: null,
        completedAt: null,
        updatedAt: null,
        totalSteps: pending.steps.length,
        completedSteps: 0,
        completionRatio: 0,
        steps: clone(pending.steps),
        completedStepIds: [],
        body: pending.body,
        summary: pending.summary,
        planId: pending.planId,
        requestId: pending.requestId,
      };
    }
    if (!active) return null;
    const completedStepIds = normalizeCompletedStepIds(active.steps, active.completedStepIds);
    return {
      session: boundSession,
      status: "active",
      path: null,
      completedAt: active.updatedAt,
      updatedAt: active.updatedAt,
      totalSteps: active.steps.length,
      completedSteps: completedStepIds.length,
      completionRatio: active.steps.length > 0 ? completedStepIds.length / active.steps.length : 0,
      steps: clone(active.steps),
      completedStepIds,
      body: active.body,
      summary: active.summary,
      planId: active.planId,
      requestId: active.requestId,
    };
  }

  function hydrate() {
    const stored = store.loadPlanState(boundSession);
    if (!stored) return;
    const steps = normalizeSteps(stored.steps);
    if (steps.length === 0) return;
    active = {
      steps,
      completedStepIds: normalizeCompletedStepIds(steps, stored.completedStepIds),
      summary: text(stored.summary),
      body: text(stored.body),
      planId: text(stored.planId) || null,
      requestId: text(stored.requestId) || null,
      updatedAt: stored.updatedAt || now(),
    };
  }

  function ensureSession() {
    const next = session();
    if (boundSession === next) return;
    boundSession = next;
    pending = null;
    active = null;
    revision = null;
    hydrate();
  }

  function setPending({ steps = [], summary = "", body = "", planId = null, requestId = null } = {}) {
    ensureSession();
    pending = {
      steps: normalizeSteps(steps),
      summary: text(summary),
      body: text(body),
      planId: text(planId) || null,
      requestId: text(requestId) || null,
    };
    return snapshot();
  }

  function discardPending(reason = "discarded") {
    ensureSession();
    if (!pending) return false;
    pending = null;
    emitPlan({ kind: "plan-pending-discarded", session: boundSession, reason: text(reason, "discarded") });
    return true;
  }

  function persist() {
    if (!active) return false;
    const completedStepIds = normalizeCompletedStepIds(active.steps, active.completedStepIds);
    const next = {
      ...active,
      completedStepIds,
      updatedAt: now(),
    };
    store.savePlanState(boundSession, next.steps, completedStepIds, {
      body: next.body,
      summary: next.summary,
      planId: next.planId,
      requestId: next.requestId,
    });
    active = next;
    return true;
  }

  function activatePending() {
    ensureSession();
    if (!pending || pending.steps.length === 0) return false;
    const previous = active;
    const next = pending;
    pending = null;
    active = {
      steps: clone(next.steps),
      completedStepIds: [],
      summary: next.summary,
      body: next.body,
      planId: next.planId,
      requestId: next.requestId,
      updatedAt: null,
    };
    try {
      persist();
    } catch {
      active = previous;
      pending = next;
      return false;
    }
    setGoals([planGoal({ planId: active.planId, summary: active.summary, steps: active.steps, sessionId: getConversationId(), status: "active", updatedAt: active.updatedAt })]);
    emitPlan({ kind: "plan-activated", session: boundSession });
    return true;
  }

  function markStepDone(stepId, evidenceRefs = [], { source = "manual" } = {}) {
    ensureSession();
    if (!active || !isKnownPlanStep(active.steps, stepId)) return false;
    const previousActive = clone(active);
    const refs = (Array.isArray(evidenceRefs) ? evidenceRefs : [])
      .filter(isHostIssuedEvidence)
      .slice(-32)
      .map(clone);
    // Every completion path, including the legacy manual path, needs a
    // host-issued fact. Model proposals are recorded by the caller but can
    // never promote a step by supplying arbitrary evidence JSON.
    if (refs.length === 0) return false;
    const step = active.steps.find((entry) => entry.id === stepId);
    if (step) {
      step.status = "completed";
      if (refs.length > 0) step.evidenceRefs = refs;
      delete step.blockedReason;
    }
    active.completedStepIds = [...new Set([...active.completedStepIds, stepId])];
    try {
      persist();
    } catch {
      active = previousActive;
      return false;
    }
    if (isPlanComplete(active.steps, active.completedStepIds)) {
      setGoals(goals.map((goal) => ({ ...goal, status: "completed", updatedAt: now() })));
      try { store.archivePlanState?.(boundSession); } catch { return false; }
      active = null;
      emitPlan({ kind: "plan-archived", session: boundSession });
      return true;
    }
    emitPlan({ kind: "plan-step-complete", session: boundSession, stepId });
    return true;
  }

  function setRevision(value = {}) {
    ensureSession();
    revision = {
      reason: text(value.reason),
      remainingSteps: normalizeSteps(value.remainingSteps),
      summary: text(value.summary),
    };
    return clone(revision);
  }

  function discardRevision(reason = "discarded") {
    ensureSession();
    if (!revision) return false;
    revision = null;
    emitPlan({ kind: "plan-revision-discarded", session: boundSession, reason: text(reason, "discarded") });
    return true;
  }

  function bindSession(sessionName) {
    const next = text(sessionName);
    if (!next) return snapshot();
    explicitSession = next;
    if (boundSession !== next) {
      boundSession = next;
      pending = null;
      active = null;
      revision = null;
      hydrate();
    }
    return snapshot();
  }

  function acceptRevision() {
    ensureSession();
    if (!revision || !active) return false;
    const previousActive = clone(active);
    const previousRevision = clone(revision);
    const completed = new Set(active.completedStepIds);
    active.steps = [
      ...active.steps.filter((step) => completed.has(step.id)),
      ...revision.remainingSteps.filter((step) => !completed.has(step.id)),
    ];
    if (revision.summary) active.summary = revision.summary;
    revision = null;
    try {
      const persisted = persist();
      if (persisted) emitPlan({ kind: "plan-revised", session: boundSession });
      return persisted;
    } catch {
      active = previousActive;
      revision = previousRevision;
      return false;
    }
  }

  function bindActivePlanIdentity({ requestId = null, planId = null } = {}) {
    ensureSession();
    if (!active) return false;
    const previousActive = clone(active);
    const nextRequestId = text(requestId);
    const nextPlanId = text(planId);
    if (nextRequestId) active.requestId = nextRequestId;
    if (nextPlanId) active.planId = nextPlanId;
    try {
      return persist();
    } catch {
      active = previousActive;
      return false;
    }
  }

  function hasActiveStep(stepId) {
    ensureSession();
    const id = text(stepId);
    return Boolean(active?.steps?.some((step) => step.id === id));
  }

  function belongsToRequest(requestId) {
    ensureSession();
    const id = text(requestId);
    return Boolean(id && active?.requestId && active.requestId === id);
  }

  function reset() {
    explicitSession = null;
    boundSession = null;
    pending = null;
    active = null;
    revision = null;
    ensureSession();
    return snapshot();
  }

  function cancel() {
    ensureSession();
    if (!active && !pending) return false;
    store.clearPlanState?.(boundSession);
    setGoals(goals.map((goal) => ({ ...goal, status: "cancelled", updatedAt: now() })));
    pending = null;
    active = null;
    revision = null;
    emitPlan({ kind: "plan-cancelled", session: boundSession });
    return true;
  }

  return {
    bindSession,
    setPending,
    discardPending,
    activatePending,
    markStepDone,
    setRevision,
    discardRevision,
    acceptRevision,
    bindActivePlanIdentity,
    hasActiveStep,
    belongsToRequest,
    reset,
    cancel,
    snapshot,
    persist,
  };
}
