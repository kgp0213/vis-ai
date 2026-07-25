import { createHash } from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function text(value) { return String(value ?? "").trim(); }

function digest(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

export function operationAuthorizationKey({ operationId, sessionId, workspace, toolName, args = {}, recipient = null, attachments = [] } = {}) {
  const scope = {
    operationId: text(operationId) || null,
    sessionId: text(sessionId) || null,
    workspace: text(workspace) || null,
    toolName: text(toolName) || null,
    args,
    recipient: text(recipient) || null,
    attachments: (Array.isArray(attachments) ? attachments : []).map((item) => typeof item === "string" ? item : item?.sha256 ?? item?.id ?? item?.name ?? null).filter(Boolean).sort(),
  };
  return `approval:${digest(scope)}`;
}

/** Operation-scoped approval cache. It only remembers decisions; it does not execute tools. */
export function createOperationPolicy({ now = () => new Date().toISOString(), maxEntries = 256 } = {}) {
  const approvals = new Map();

  function trim() {
    while (approvals.size > Math.max(1, maxEntries)) approvals.delete(approvals.keys().next().value);
  }

  function evaluate(request = {}) {
    const key = operationAuthorizationKey(request);
    const current = approvals.get(key);
    if (!request.requiresApproval) return { key, decision: "allow", cached: false, reason: "policy-allows" };
    if (current?.decision === "allow") return { key, decision: "allow", cached: true, approvedAt: current.approvedAt };
    if (current?.decision === "deny") return { key, decision: "deny", cached: true, deniedAt: current.deniedAt };
    return { key, decision: "ask", cached: false, reason: "approval-required" };
  }

  function record(request = {}, decision = "allow", metadata = {}) {
    const normalized = String(decision).toLowerCase();
    if (!["allow", "deny"].includes(normalized)) throw new Error("approval decision must be allow or deny");
    const key = operationAuthorizationKey(request);
    approvals.set(key, {
      key,
      operationId: text(request.operationId) || null,
      sessionId: text(request.sessionId) || null,
      workspace: text(request.workspace) || null,
      toolName: text(request.toolName) || null,
      decision: normalized,
      approvedAt: normalized === "allow" ? now() : null,
      deniedAt: normalized === "deny" ? now() : null,
      metadata: { ...metadata },
    });
    trim();
    return approvals.get(key);
  }

  function revoke({ operationId, sessionId = null, workspace = null } = {}) {
    let count = 0;
    for (const [key, value] of approvals) {
      if (String(value.operationId) !== text(operationId)) continue;
      if (sessionId !== null && String(value.sessionId) !== text(sessionId)) continue;
      if (workspace !== null && String(value.workspace) !== text(workspace)) continue;
      approvals.delete(key);
      count += 1;
    }
    return count;
  }

  return { evaluate, record, revoke, size: () => approvals.size, snapshot: () => [...approvals.values()].map((item) => ({ ...item, metadata: { ...item.metadata } })) };
}
