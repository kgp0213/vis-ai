function planStepIds(steps) {
  return new Set((Array.isArray(steps) ? steps : []).map((step) => step?.id).filter(Boolean));
}

export function normalizeCompletedStepIds(steps, completedStepIds) {
  const validIds = planStepIds(steps);
  return [...new Set(Array.isArray(completedStepIds) ? completedStepIds : [])]
    .filter((stepId) => validIds.has(stepId));
}

export function isKnownPlanStep(steps, stepId) {
  return Boolean(stepId) && planStepIds(steps).has(stepId);
}

export function isPlanComplete(steps, completedStepIds) {
  const total = Array.isArray(steps) ? steps.length : 0;
  return total > 0 && normalizeCompletedStepIds(steps, completedStepIds).length === total;
}
