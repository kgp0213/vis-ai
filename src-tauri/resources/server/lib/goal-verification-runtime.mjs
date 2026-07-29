import { mapLegacyTaskState, normalizeTaskContract } from "./task-contract.mjs";

const VERIFIED_ARTIFACT_STATES = new Set(["verified", "current-turn-write", "current_turn_write"]);

function text(value, max = 600) {
  return String(value ?? "").trim().slice(0, max);
}

function refId(value, fallback) {
  const id = text(value, 240);
  return id || fallback;
}

function artifactEvidenceRefs(entries = []) {
  const refs = [];
  for (const [index, evidence] of (Array.isArray(entries) ? entries : []).entries()) {
    const evidenceId = refId(evidence?.evidenceId ?? evidence?.id, `artifact-evidence-${index + 1}`);
    const verified = evidence?.verified === true || VERIFIED_ARTIFACT_STATES.has(text(evidence?.status ?? evidence?.verification, 80).toLowerCase());
    for (const [fileIndex, file] of (Array.isArray(evidence?.files) ? evidence.files : []).entries()) {
      const status = text(file?.status ?? file?.verification, 80).toLowerCase();
      const readable = file?.readable !== false && file?.isFile !== false && Number(file?.size ?? 1) > 0;
      refs.push({
        evidenceId: `${evidenceId}:${fileIndex + 1}`,
        type: "artifact",
        outputId: text(file?.outputId ?? evidence?.outputId, 160) || null,
        artifactId: text(file?.artifactId ?? evidence?.artifactId, 240) || null,
        resourceId: text(file?.resourceId ?? evidence?.resourceId, 240) || null,
        path: text(file?.path, 2000) || null,
        verified: verified && readable && (!status || VERIFIED_ARTIFACT_STATES.has(status) || status === "verified"),
        status: status || (verified ? "verified" : "present_unverified"),
      });
    }
  }
  return refs;
}

function toolEvidenceRefs(toolFacts = []) {
  const refs = [];
  for (const [index, fact] of (Array.isArray(toolFacts) ? toolFacts : []).entries()) {
    const status = text(fact?.status ?? fact?.state, 80).toLowerCase();
    const exitCode = Number.isInteger(Number(fact?.exitCode)) ? Number(fact.exitCode) : null;
    const ok = fact?.ok === true || status === "succeeded" || status === "completed" || exitCode === 0;
    refs.push({
      evidenceId: refId(fact?.toolCallId, `tool-evidence-${index + 1}`),
      type: "test",
      toolCallId: text(fact?.toolCallId, 240) || null,
      command: text(fact?.command, 1200) || null,
      verified: ok && (exitCode === null || exitCode === 0),
      exitCode,
    });
  }
  return refs;
}

function matchesOutput(output, ref) {
  if (!output || !ref) return false;
  if (ref.outputId && (ref.outputId === output.id || ref.outputId === output.outputId)) return true;
  if (ref.artifactId && output.artifactId && ref.artifactId === output.artifactId) return true;
  if (ref.resourceId && output.resourceId && ref.resourceId === output.resourceId) return true;
  if (output.path && ref.path) {
    const left = String(output.path).replaceAll("\\", "/").toLowerCase();
    const right = String(ref.path).replaceAll("\\", "/").toLowerCase();
    return left === right;
  }
  // A kind (for example, `artifact`) describes a category, not the user's
  // requested output. It must never be sufficient to prove completion.
  return false;
}

/**
 * Verifies user-facing goal completion from host facts. Assistant prose is
 * intentionally absent from this input and therefore cannot prove success.
 */
export function verifyGoalContract({
  contract: rawContract = null,
  executionState: rawExecutionState = "completed",
  toolFacts = [],
  receipt = null,
  artifactEvidence = [],
  confirmations = [],
} = {}) {
  const contract = normalizeTaskContract(rawContract ?? {});
  const receiptState = mapLegacyTaskState(receipt?.executionState ?? receipt?.taskState ?? receipt?.completion?.taskState);
  let executionState = mapLegacyTaskState(rawExecutionState) || receiptState || "unknown";
  const refs = [...artifactEvidenceRefs(artifactEvidence), ...toolEvidenceRefs(toolFacts)];
  for (const confirmation of Array.isArray(confirmations) ? confirmations : []) {
    refs.push({ evidenceId: refId(confirmation?.id, `confirmation-${refs.length + 1}`), type: "user_confirmation", outputId: text(confirmation?.outputId, 160) || null, verified: confirmation?.confirmed === true });
  }
  if (executionState === "completed" && receipt?.cancelled === true) executionState = "cancelled";

  if (!contract.executionRequired) {
    return { executionState, goalState: executionState === "completed" ? "verified" : "unknown", evidenceRefs: refs, warnings: [], missingCriteria: [] };
  }

  const requiredOutputs = contract.expectedOutputs.filter((output) => output.required !== false);
  const missingCriteria = [];
  const evidenceRefs = refs.filter((ref) => ref.verified);
  for (const output of requiredOutputs) {
    if (!refs.some((ref) => ref.verified && matchesOutput(output, ref))) missingCriteria.push(output.id);
  }
  if (requiredOutputs.length === 0 && contract.acceptanceCriteria.some((criterion) => criterion.required !== false) && evidenceRefs.length === 0) {
    missingCriteria.push(...contract.acceptanceCriteria.filter((criterion) => criterion.required !== false).map((criterion) => criterion.id));
  }
  if (requiredOutputs.length === 0
    && contract.acceptanceCriteria.every((criterion) => criterion.required === false)
    && evidenceRefs.length === 0) {
    missingCriteria.push("execution-evidence");
  }

  const warnings = [];
  if (toolFacts.some((fact) => ["failed", "cancelled", "unknown"].includes(text(fact?.status ?? fact?.state, 80).toLowerCase()))) {
    warnings.push({ code: "tool_recovery", message: "执行过程中存在工具失败、取消或未知结果。" });
  }
  if (executionState === "unknown") return { executionState, goalState: "unknown", evidenceRefs, warnings, missingCriteria };
  if (executionState === "failed" || executionState === "cancelled") return { executionState, goalState: "incomplete", evidenceRefs, warnings, missingCriteria };
  if (missingCriteria.length > 0) return { executionState, goalState: "incomplete", evidenceRefs, warnings, missingCriteria };
  if (warnings.length > 0) executionState = "completed_with_warnings";
  return { executionState, goalState: "verified", evidenceRefs, warnings, missingCriteria: [] };
}

export { artifactEvidenceRefs, toolEvidenceRefs };
