// pauseGate request → dashboard modal mapping — extracted from launcher.mjs for testability.
// Pure data transform: maps pauseGate request kinds to dashboard modal objects.
// Returns null for unknown kinds (caller handles side effects: warning + cancel).

/**
 * Map a pauseGate confirmation request to a dashboard modal object.
 * @param {{id: string, kind: string, payload: object}} request
 * @returns {object|null} modal object with `_gateId`, or null for unknown kinds
 */
export function requestToModal(request) {
  const { id, kind, payload } = request;

  switch (kind) {
    case "run_command":
    case "run_background":
      return {
        kind: "shell", _gateId: id,
        command: payload.command,
        allowPrefix: payload.command?.split(/\s+/)[0] ?? "",
        shellKind: kind,
      };

    case "choice":
      return {
        kind: "choice", _gateId: id,
        question: payload.question,
        options: payload.options,
        allowCustom: payload.allowCustom,
      };

    case "plan_proposed":
      return {
        kind: "plan", _gateId: id,
        plan: payload.plan,
        steps: payload.steps,
        summary: payload.summary,
      };

    case "plan_checkpoint":
      return {
        kind: "checkpoint", _gateId: id,
        stepId: payload.stepId,
        title: payload.title,
        result: payload.result,
        notes: payload.notes,
        completed: payload.completed,
        total: payload.total,
      };

    case "plan_revision":
      return {
        kind: "revision", _gateId: id,
        reason: payload.reason,
        remainingSteps: payload.remainingSteps,
        summary: payload.summary,
      };

    default:
      return null;
  }
}
