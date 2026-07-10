export function decidePlanContinuation({
  forcedSummaryReason,
  plan,
  attempts = 0,
  maxAttempts = 2,
  aborted = false,
  incompleteFinal = false,
}) {
  const incomplete = Boolean(
    plan &&
    Number.isFinite(plan.totalSteps) &&
    Number.isFinite(plan.completedSteps) &&
    plan.totalSteps > 0 &&
    plan.completedSteps < plan.totalSteps
  );
  const resumable = forcedSummaryReason === "budget" || incompleteFinal;
  if (!resumable || aborted || !incomplete) {
    return { action: "none", plan: null };
  }
  if (attempts < maxAttempts) return { action: "continue", plan };
  return { action: "pause", plan };
}
