const REUSABLE_OUTCOMES = new Set(["delivered", "delivered_with_warnings"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Decide whether a semantic task record can answer a new identical request.
 * A failed/partial/cancelled terminal record must never masquerade as a
 * successful result; an active record is safe to coalesce into its durable
 * execution instead of starting a duplicate worker.
 */
export function classifyComplexTaskReuse(task, { outputPath = "", pathExists } = {}) {
  if (!task || task.lifecycle !== "terminal") return { reusable: true, reason: "active" };
  const outcome = text(task.outcome?.outcome).toLowerCase();
  if (!REUSABLE_OUTCOMES.has(outcome)) return { reusable: false, reason: "terminal-not-success" };
  const artifactRefs = task.outcome?.artifactRefs ?? task.artifactRefs;
  if (Array.isArray(artifactRefs) && artifactRefs.length > 0) return { reusable: true, reason: "verified-artifact" };
  if (text(outputPath) && typeof pathExists === "function" && pathExists(outputPath) === true) {
    return { reusable: true, reason: "existing-output" };
  }
  return { reusable: false, reason: "missing-artifact" };
}
