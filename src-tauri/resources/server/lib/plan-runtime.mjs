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
  let pending = null;
  let active = null;
  let revision = null;
  let goals = [];

  function session() {
    return text(getSessionName(), "desktop");
  }

  function emit(event) {
    try { onEvent(event); } catch { /* dashboard observers cannot block Plan state */ }
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

  function persist() {
    if (!active) return false;
    const completedStepIds = normalizeCompletedStepIds(active.steps, active.completedStepIds);
    active.completedStepIds = completedStepIds;
    active.updatedAt = now();
    store.savePlanState(boundSession, active.steps, completedStepIds, {
      body: active.body,
      summary: active.summary,
      planId: active.planId,
      requestId: active.requestId,
    });
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
    emit({ kind: "plan-activated", session: boundSession });
    return true;
  }

  function markStepDone(stepId, evidenceRefs = [], { source = "manual" } = {}) {
    ensureSession();
    if (!active || !isKnownPlanStep(active.steps, stepId)) return false;
    const refs = (Array.isArray(evidenceRefs) ? evidenceRefs : [])
      .filter((entry) => entry && typeof entry === "object" && entry.verified !== false)
      .slice(-32)
      .map(clone);
    if (source === "model" && refs.length === 0) return false;
    const step = active.steps.find((entry) => entry.id === stepId);
    if (step) {
      step.status = "completed";
      if (refs.length > 0) step.evidenceRefs = refs;
      delete step.blockedReason;
    }
    const previous = [...active.completedStepIds];
    active.completedStepIds = [...new Set([...previous, stepId])];
    try {
      persist();
    } catch {
      active.completedStepIds = previous;
      return false;
    }
    if (isPlanComplete(active.steps, active.completedStepIds)) {
      setGoals(goals.map((goal) => ({ ...goal, status: "completed", updatedAt: now() })));
      try { store.archivePlanState?.(boundSession); } catch { return false; }
      emit({ kind: "plan-archived", session: boundSession });
      active = null;
      return true;
    }
    emit({ kind: "plan-step-complete", session: boundSession, stepId });
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

  function acceptRevision() {
    ensureSession();
    if (!revision || !active) return false;
    const completed = new Set(active.completedStepIds);
    active.steps = [
      ...active.steps.filter((step) => completed.has(step.id)),
      ...revision.remainingSteps.filter((step) => !completed.has(step.id)),
    ];
    if (revision.summary) active.summary = revision.summary;
    revision = null;
    try { return persist(); } catch { return false; }
  }

  function reset() {
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
    emit({ kind: "plan-cancelled", session: boundSession });
    return true;
  }

  return {
    setPending,
    activatePending,
    markStepDone,
    setRevision,
    acceptRevision,
    reset,
    cancel,
    snapshot,
    persist,
  };
}
