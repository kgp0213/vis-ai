import { mapLegacyTaskState, normalizeTaskContract } from "./task-contract.mjs";
import { resolve as resolvePath, win32 as win32Path } from "node:path";

const VERIFIED_ARTIFACT_STATES = new Set(["verified", "existing-file-verified", "readback-verified", "readback_verified"]);
const EVIDENCE_TYPES = new Set(["tool_read", "mutation", "test", "execution", "external_side_effect"]);
const READ_ONLY_TOOLS = new Set([
  "read_file", "read_media", "list_directory", "list_files", "get_file_info", "search_files",
  "semantic_search", "list_runtime_capabilities", "get_workspace_info", "inspect_file",
]);
const MUTATING_TOOLS = new Set([
  "write_file", "append_file", "edit_file", "multi_edit", "save_file", "save_last_assistant_response",
  "create_directory", "move_file", "copy_file", "delete_file", "rename_file", "apply_patch",
]);

function text(value, max = 600) {
  return String(value ?? "").trim().slice(0, max);
}

function refId(value, fallback) {
  const id = text(value, 240);
  return id || fallback;
}

function normalizedPath(value, baseDir = null) {
  const raw = text(value, 2_000);
  if (!raw) return "";
  const isWindowsAbsolute = /^[A-Za-z]:[\\/]/u.test(raw) || /^\\\\/u.test(raw);
  const isPosixAbsolute = raw.startsWith("/");
  const normalized = isWindowsAbsolute
    ? win32Path.normalize(raw)
    : isPosixAbsolute
      ? resolvePath(raw)
      : baseDir
        ? resolvePath(baseDir, raw)
        : resolvePath(raw);
  return normalized.replaceAll("\\", "/").replace(/\/+$/u, "").toLowerCase();
}

function parsedArgs(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function classifyToolEvidence({ name = null, toolName = null, args = null, toolArgs = null, command = null } = {}) {
  const normalizedName = text(name ?? toolName, 160).toLowerCase();
  if (READ_ONLY_TOOLS.has(normalizedName) || /^(?:read|get|list|search|inspect|query)_/u.test(normalizedName)) return "tool_read";
  if (MUTATING_TOOLS.has(normalizedName) || /^(?:write|edit|append|create|delete|move|copy|rename|save)_/u.test(normalizedName)) return "mutation";
  if (/(?:^|_)(?:send|upload|notify)(?:_|$)/u.test(normalizedName) || /(?:^|_)dws(?:_|$)/u.test(normalizedName)) return "external_side_effect";
  const values = parsedArgs(args ?? toolArgs);
  const commandText = text(command ?? values.command, 4000);
  if (normalizedName === "run_command" || normalizedName === "run_background" || commandText) {
    if (/(?:^|[\s;&|])(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:test|build|check|lint|typecheck)\b|(?:^|[\s;&|])(?:pytest|python(?:\.exe)?\s+-m\s+pytest|cargo\s+(?:test|check|build|clippy)|go\s+test|dotnet\s+test|mvn(?:\.cmd)?\s+test|gradle(?:\.bat)?\s+test)\b/iu.test(commandText)) {
      return "test";
    }
    return "execution";
  }
  return "execution";
}

function artifactEvidenceRefs(entries = []) {
  const refs = [];
  for (const [index, evidence] of (Array.isArray(entries) ? entries : []).entries()) {
    const evidenceId = refId(evidence?.evidenceId ?? evidence?.id, `artifact-evidence-${index + 1}`);
    const verified = evidence?.verified === true || VERIFIED_ARTIFACT_STATES.has(text(evidence?.status ?? evidence?.verification, 80).toLowerCase());
    for (const [fileIndex, file] of (Array.isArray(evidence?.files) ? evidence.files : []).entries()) {
      const status = text(file?.status ?? file?.verification, 80).toLowerCase();
      const size = Number(file?.size);
      const mtimeMs = Number(file?.mtimeMs);
      const readable = file?.readable === true
        && file?.isFile === true
        && Number.isFinite(size)
        && size > 0
        && Number.isFinite(mtimeMs)
        && mtimeMs > 0
        && text(file?.path, 2000).length > 0;
      refs.push({
        evidenceId: `${evidenceId}:${fileIndex + 1}`,
        type: "artifact",
        outputId: text(file?.outputId ?? evidence?.outputId, 160) || null,
        artifactId: text(file?.artifactId ?? evidence?.artifactId, 240) || null,
        resourceId: text(file?.resourceId ?? evidence?.resourceId, 240) || null,
        path: text(file?.path, 2000) || null,
        // current-turn-write only proves that a write was observed. A later
        // readback or explicit host verification is required to prove the
        // requested artifact, even when it is non-empty.
        verified: verified && readable && (!status || VERIFIED_ARTIFACT_STATES.has(status)),
        status: verified && !readable ? "invalid" : status || (verified ? "verified" : "present_unverified"),
        ...(Number.isFinite(size) ? { size } : {}),
        ...(Number.isFinite(mtimeMs) ? { mtimeMs } : {}),
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
    const explicitType = text(fact?.evidenceType, 80).toLowerCase();
    const evidenceType = EVIDENCE_TYPES.has(explicitType) ? explicitType : classifyToolEvidence(fact);
    refs.push({
      evidenceId: refId(fact?.toolCallId, `tool-evidence-${index + 1}`),
      type: evidenceType,
      toolCallId: text(fact?.toolCallId, 240) || null,
      command: text(fact?.command, 1200) || null,
      verified: ok && (exitCode === null || exitCode === 0),
      exitCode,
    });
  }
  return refs;
}

function matchesOutput(output, ref, workspaceDir = null) {
  if (!output || !ref) return false;
  if (ref.outputId && (ref.outputId === output.id || ref.outputId === output.outputId)) return true;
  if (ref.artifactId && output.artifactId && ref.artifactId === output.artifactId) return true;
  if (ref.resourceId && output.resourceId && ref.resourceId === output.resourceId) return true;
  if (output.path && ref.path) {
    const left = normalizedPath(output.path, workspaceDir);
    const right = normalizedPath(ref.path, workspaceDir);
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
  workspaceDir = null,
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
  const requiredEvidence = Array.isArray(contract.requiredEvidence) ? contract.requiredEvidence : [];
  const missingCriteria = [];
  const evidenceRefs = refs.filter((ref) => ref.verified);
  const completionEvidenceRefs = evidenceRefs.filter((ref) => ref.type !== "tool_read");
  for (const output of requiredOutputs) {
    if (!refs.some((ref) => ref.verified && matchesOutput(output, ref, workspaceDir))) missingCriteria.push(output.id);
  }
  for (const evidenceType of requiredEvidence) {
    if (!evidenceRefs.some((ref) => ref.type === evidenceType)) missingCriteria.push(`evidence:${evidenceType}`);
  }
  if (requiredOutputs.length === 0 && requiredEvidence.length === 0 && contract.acceptanceCriteria.some((criterion) => criterion.required !== false) && completionEvidenceRefs.length === 0) {
    missingCriteria.push(...contract.acceptanceCriteria.filter((criterion) => criterion.required !== false).map((criterion) => criterion.id));
  }
  if (requiredOutputs.length === 0
    && requiredEvidence.length === 0
    && contract.acceptanceCriteria.every((criterion) => criterion.required === false)
    && completionEvidenceRefs.length === 0) {
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
