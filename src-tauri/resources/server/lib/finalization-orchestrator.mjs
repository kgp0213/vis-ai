import { verifyGoalContract } from "./goal-verification-runtime.mjs";

const TERMINAL_EXECUTION_STATES = new Set(["completed", "completed_with_warnings", "failed", "cancelled", "unknown"]);

function normalizeState(value, fallback = "unknown") {
  const state = String(value ?? "").trim().toLowerCase();
  return TERMINAL_EXECUTION_STATES.has(state) ? state : fallback;
}

export function evaluateTurnFinalization({
  taskContract = null,
  executionFactState = "unknown",
  toolFacts = [],
  receipt = null,
  artifactEvidence = [],
  artifactRequired = false,
  artifactVerified = false,
  executionStarted = false,
  artifactIncomplete = false,
  continuationNeeded = false,
  interventionPaused = false,
  warnings = [],
} = {}) {
  let executionState = normalizeState(executionFactState);
  const verification = verifyGoalContract({
    contract: taskContract,
    executionState,
    toolFacts,
    receipt,
    artifactEvidence,
    confirmations: [],
  });
  let goalState = verification.goalState;
  const mergedWarnings = [...new Set([
    ...(Array.isArray(warnings) ? warnings : []),
    ...(verification.warnings ?? []).map((warning) => warning?.message || String(warning)),
  ])].slice(0, 16);
  if (artifactRequired && (!artifactVerified || artifactIncomplete)) {
    goalState = "incomplete";
  }
  if (continuationNeeded || interventionPaused) goalState = "incomplete";
  if (executionState === "completed" && goalState === "verified" && mergedWarnings.length > 0) executionState = "completed_with_warnings";
  if (executionState === "completed" && goalState !== "verified") executionState = "completed";
  const taskState = executionState === "unknown"
    ? "unknown"
    : executionState === "failed" || executionState === "cancelled"
      ? executionState
      : goalState === "incomplete"
        ? "incomplete"
        : executionState;
  return {
    executionState,
    goalState,
    taskState,
    completionOk: executionStarted !== false && (executionState === "completed" || executionState === "completed_with_warnings") && goalState === "verified",
    evidenceRefs: verification.evidenceRefs,
    warnings: mergedWarnings,
    missingCriteria: verification.missingCriteria,
  };
}

export function createFinalizationOrchestrator({
  persistTurnFinalization,
  publishTurnFinalized = () => {},
  onPersistenceFailure = () => {},
} = {}) {
  if (typeof persistTurnFinalization !== "function") throw new TypeError("persistTurnFinalization is required");

  async function finalize({ evaluation = {}, receipt, persistence = {}, event = {} } = {}) {
    let result = { ...evaluation };
    if (receipt?.recordGoalVerification) receipt.recordGoalVerification(result);
    receipt?.recordAuthorizationFacts?.(persistence.authorizationFacts);
    for (const repeat of persistence.toolRepeats ?? []) receipt?.recordToolRepeat?.(repeat);
    receipt?.complete?.({
      ok: result.completionOk === true,
      taskState: result.taskState,
      executionState: result.executionState,
      goalState: result.goalState,
      artifactIncomplete: result.taskState === "incomplete",
      interventionPaused: persistence.interventionPaused === true,
      continuationNeeded: persistence.continuationNeeded === true,
    });
    let persisted = false;
    try {
      const snapshot = receipt?.snapshot?.() ?? {};
      persisted = await persistTurnFinalization({
        ...persistence,
        receipt: snapshot,
        taskState: result.taskState,
        executionState: result.executionState,
        goalState: result.goalState,
        evidenceRefs: result.evidenceRefs,
        artifactEvidence: snapshot.artifactEvidence ?? persistence.artifactEvidence ?? [],
        warnings: result.warnings,
      });
    } catch (error) {
      onPersistenceFailure(error);
    }
    if (!persisted) {
      const error = "本轮执行事实无法持久化，结果状态未知";
      result = {
        ...result,
        executionState: "unknown",
        goalState: "unknown",
        taskState: "unknown",
        completionOk: false,
        warnings: [...new Set([...(result.warnings ?? []), error])].slice(0, 16),
      };
      receipt?.recordError?.(error, { source: "session-runtime" });
      receipt?.markUnknown?.(error);
      onPersistenceFailure(error);
    }
    const published = {
      ...event,
      taskState: result.taskState,
      executionState: result.executionState,
      goalState: result.goalState,
      evidenceRefs: result.evidenceRefs,
      warnings: result.warnings,
      receipt: receipt?.snapshot?.() ?? null,
      persisted,
    };
    publishTurnFinalized(published);
    return { ...result, persisted };
  }

  return { finalize };
}
