const MODEL_ROLES = new Set(["system", "user", "assistant", "tool"]);
const DASHBOARD_ROLES = new Set(["user", "assistant", "tool", "warning", "error", "info"]);
const PERSISTED_FACT_ROLES = new Set(["execution"]);
const INTERNAL_USER_PROMPT_RE = /^\[(?:系统自动续跑\s+\d+\/\d+|系统后台任务接管\s+document:[^\]]+|系统通用复杂任务调度|系统步骤检查点)\]/;

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part && part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

function normalizeEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const role = typeof value.role === "string" ? value.role : "";
  if (!MODEL_ROLES.has(role) && !DASHBOARD_ROLES.has(role) && !PERSISTED_FACT_ROLES.has(role)) return null;
  const content = value.content !== undefined ? value.content : value.text;
  if (typeof content !== "string" && !Array.isArray(content)) return null;
  return { ...value, role, content };
}

function isInternalUserEntry(entry) {
  if (entry?.role !== "user") return false;
  // Background task notifications are model-visible facts. They remain
  // hidden from the user-facing message list without being stripped from
  // recovered model history.
  if (entry.internal === true && entry.modelVisible !== true) return true;
  const content = entry.content !== undefined ? entry.content : entry.text;
  return INTERNAL_USER_PROMPT_RE.test(contentText(content).trim());
}

export function parseActiveSessionJsonl(raw) {
  const entries = [];
  const errors = [];
  const lines = String(raw ?? "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    try {
      const entry = normalizeEntry(JSON.parse(line));
      if (entry) entries.push(entry);
      else errors.push({ line: index + 1, reason: "invalid record" });
    } catch (err) {
      errors.push({ line: index + 1, reason: err?.message || "invalid JSON" });
    }
  }
  return { entries, errors };
}

export function activeEntriesForModel(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && MODEL_ROLES.has(entry.role) && !isInternalUserEntry(entry))
    .map((entry) => {
      const modelEntry = {
        role: entry.role,
        content: entry.content !== undefined ? entry.content : entry.text ?? "",
      };
      for (const key of ["internal", "modelVisible", "dashboardHidden", "source", "notificationId", "backgroundTaskNotification"]) {
        if (entry[key] !== undefined) modelEntry[key] = entry[key];
      }
      if (entry.role === "user" && Array.isArray(entry.attachments) && entry.attachments.length > 0) {
        const refs = entry.attachments
          .map((attachment) => typeof attachment === "string" ? attachment : attachment?.id)
          .filter(Boolean)
          .map((id) => `[attachment:${id}]`)
          .join("\n");
        if (refs) {
          if (typeof modelEntry.content === "string") modelEntry.content = `${modelEntry.content}${modelEntry.content ? "\n" : ""}${refs}`;
          else if (Array.isArray(modelEntry.content)) modelEntry.content = [...modelEntry.content, { type: "text", text: refs }];
        }
      }
      if (typeof entry.name === "string") modelEntry.name = entry.name;
      if (typeof entry.tool_call_id === "string") modelEntry.tool_call_id = entry.tool_call_id;
      if (Array.isArray(entry.tool_calls)) modelEntry.tool_calls = entry.tool_calls;
      const reasoning = entry.reasoning_content ?? entry.reasoning;
      if (typeof reasoning === "string" && reasoning) modelEntry.reasoning_content = reasoning;
      return modelEntry;
    });
}

/**
 * Close tool calls that were left open by a crashed process. This mirrors the
 * recovery boundary used by the reference runtimes: the model receives an
 * explicit unknown tool result instead of silently replaying a side effect.
 * The operation is a pure history projection; it never executes a tool.
 */
export function recoverInterruptedToolCalls(entries, { now = () => new Date().toISOString() } = {}) {
  const source = Array.isArray(entries) ? entries : [];
  const pending = [];

  const scopeMatches = (assistant, tool) => {
    const assistantTurn = String(assistant?.turnId ?? "").trim();
    const toolTurn = String(tool?.turnId ?? "").trim();
    const assistantOperation = String(assistant?.operationId ?? "").trim();
    const toolOperation = String(tool?.operationId ?? "").trim();
    if (assistantTurn && toolTurn && assistantTurn !== toolTurn) return false;
    if (assistantOperation && toolOperation && assistantOperation !== toolOperation) return false;
    return true;
  };

  // Keep completion scoped to the assistant message that declared the call.
  // Providers may reuse a call id in a later Turn; a process-wide Set would
  // incorrectly treat that later call as already completed.
  for (let index = 0; index < source.length; index++) {
    const entry = source[index];
    if (entry?.role === "assistant" && Array.isArray(entry.tool_calls)) {
      const calls = entry.tool_calls
        .map((call) => String(call?.id ?? call?.tool_call_id ?? "").trim())
        .filter(Boolean);
      if (calls.length > 0) pending.push({ entry, index, calls: new Set(calls), completed: new Set() });
      continue;
    }
    if (entry?.role !== "tool") continue;
    const toolCallId = String(entry.tool_call_id ?? entry.toolCallId ?? "").trim();
    if (!toolCallId) continue;
    for (let pendingIndex = pending.length - 1; pendingIndex >= 0; pendingIndex--) {
      const candidate = pending[pendingIndex];
      if (!candidate.calls.has(toolCallId) || !scopeMatches(candidate.entry, entry)) continue;
      candidate.completed.add(toolCallId);
      break;
    }
  }
  const recovered = [];
  const warnings = [];
  let changed = false;

  for (let index = 0; index < source.length; index++) {
    const entry = source[index];
    recovered.push(entry);
    if (entry?.role !== "assistant" || !Array.isArray(entry.tool_calls)) continue;
    const record = pending.find((candidate) => candidate.index === index);
    const completed = record?.completed ?? new Set();
    const covered = new Set(completed);
    for (const call of entry.tool_calls) {
      const toolCallId = String(call?.id ?? call?.tool_call_id ?? "").trim();
      if (!toolCallId || covered.has(toolCallId)) continue;
      covered.add(toolCallId);
      changed = true;
      warnings.push(`tool ${toolCallId} was marked unknown after process recovery`);
      const recoveryScope = `${String(entry.turnId ?? entry.operationId ?? "scope").replace(/[^a-zA-Z0-9._-]+/gu, "_").slice(0, 72) || "scope"}-${index}`;
      recovered.push({
        id: `recovery-tool-${recoveryScope}-${toolCallId}`,
        role: "tool",
        content: JSON.stringify({
          ok: false,
          error: {
            code: "tool_interrupted",
            message: "Tool execution was interrupted before a result was recorded.",
            retryable: false,
          },
        }),
        tool_call_id: toolCallId,
        toolStatus: "unknown",
        isError: true,
        recoveryWarning: "tool execution was interrupted before a result was recorded",
        ...(entry.turnId ? { turnId: String(entry.turnId) } : {}),
        ...(entry.operationId ? { operationId: String(entry.operationId) } : {}),
        recoveredAt: now(),
      });
    }
  }

  return { entries: recovered, changed, warnings: [...new Set(warnings)] };
}

export function activeEntriesForDashboard(entries, now = Date.now()) {
  let sequence = 0;
  const visible = [];
  let pendingAssistant = null;
  const source = Array.isArray(entries) ? entries : [];

  // Index tool call declarations (name + arguments) by call id so restored
  // tool results can show both the invocation and its output. The dashboard
  // renders consecutive tool messages as an auditable process card; dropping
  // them would make historical sessions look like they did no work.
  const toolCallById = new Map();
  for (const entry of source) {
    if (entry?.role !== "assistant" || !Array.isArray(entry.tool_calls)) continue;
    for (const call of entry.tool_calls) {
      const callId = String(call?.id ?? call?.tool_call_id ?? "").trim();
      if (!callId) continue;
      const name = typeof call?.function?.name === "string" ? call.function.name : (typeof call?.name === "string" ? call.name : "");
      const args = typeof call?.function?.arguments === "string"
        ? call.function.arguments
        : (call?.function?.arguments != null ? JSON.stringify(call.function.arguments) : (call?.arguments != null ? (typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments)) : undefined));
      toolCallById.set(callId, { name: name || undefined, args });
    }
  }

  const toolStatusFromResult = (entry, text) => {
    if (entry?.isError === true) return "failed";
    const trimmed = typeof text === "string" ? text.trim() : "";
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.ok === false) return "failed";
      } catch {
        // Non-JSON tool output; fall through to done.
      }
    }
    return "done";
  };

  const restoredEntry = (entry, text) => {
    sequence += 1;
    const toolCallId = String(entry.toolCallId ?? entry.tool_call_id ?? "").trim();
    return {
      id: entry.id || `restored-${entry.role}-${now}-${sequence}`,
      role: entry.role,
      text,
      toolName: entry.toolName ?? entry.name,
      toolArgs: entry.toolArgs,
      ...(typeof entry.toolStatus === "string" ? { toolStatus: entry.toolStatus } : {}),
      images: Array.isArray(entry.images) ? entry.images : undefined,
      attachments: Array.isArray(entry.attachments) ? entry.attachments : undefined,
      ...(entry.turnId ? { turnId: String(entry.turnId) } : {}),
      ...(entry.stepId ? { stepId: String(entry.stepId) } : {}),
      ...(toolCallId ? { toolCallId } : {}),
      ...(entry.operationId ? { operationId: String(entry.operationId) } : {}),
      ...(entry.receipt && typeof entry.receipt === "object" ? { receipt: entry.receipt } : {}),
      ...(typeof entry.taskState === "string" ? { taskState: entry.taskState } : {}),
      ...(typeof entry.executionState === "string" ? { executionState: entry.executionState } : {}),
      ...(typeof entry.goalState === "string" ? { goalState: entry.goalState } : {}),
      ...(entry.taskContract && typeof entry.taskContract === "object" ? { taskContract: entry.taskContract } : {}),
      ...(Array.isArray(entry.evidenceRefs) ? { evidenceRefs: entry.evidenceRefs.slice(-64) } : {}),
      ...(entry.artifactIncomplete === true ? { artifactIncomplete: true } : {}),
      ...(Array.isArray(entry.artifactEvidence) ? { artifactEvidence: entry.artifactEvidence } : {}),
      ...(typeof entry.interventionChoice === "string" ? { interventionChoice: entry.interventionChoice } : {}),
      ...(Array.isArray(entry.warnings) && entry.warnings.length > 0 ? { warnings: entry.warnings } : {}),
    };
  };

  const flushAssistant = () => {
    if (!pendingAssistant) return;
    visible.push(restoredEntry(pendingAssistant.entry, pendingAssistant.text));
    pendingAssistant = null;
  };

  for (const entry of source) {
    if (!entry || !DASHBOARD_ROLES.has(entry.role)) continue;
    if (entry.dashboardHidden === true) continue;
    const text = contentText(entry.content !== undefined ? entry.content : entry.text);

    if (entry.role === "tool") {
      const callId = String(entry.tool_call_id ?? entry.toolCallId ?? "").trim();
      const call = callId ? toolCallById.get(callId) : undefined;
      // A tool result belongs to the assistant declaration immediately before
      // it. Keep an earlier pending summary collapsed when the call is known;
      // orphaned legacy tool rows still flush the summary to preserve order.
      if (!call) flushAssistant();
      visible.push(restoredEntry({
        ...entry,
        toolName: entry.toolName ?? entry.name ?? call?.name,
        toolArgs: entry.toolArgs ?? call?.args,
        toolStatus: entry.toolStatus ?? toolStatusFromResult(entry, text),
      }, text));
      continue;
    }
    if (entry.role === "assistant") {
      if (!text || (Array.isArray(entry.tool_calls) && entry.tool_calls.length > 0)) continue;
      // Keep replacing the candidate until the logical user turn ends. This
      // collapses forced summaries followed by an internal auto-continuation.
      pendingAssistant = { entry, text };
      continue;
    }
    if (entry.role === "user") {
      if (isInternalUserEntry(entry)) continue;
      flushAssistant();
      if (text || entry.attachments?.length || entry.images?.length) visible.push(restoredEntry(entry, text));
      continue;
    }

    flushAssistant();
    if (text) visible.push(restoredEntry(entry, text));
  }

  flushAssistant();
  return visible;
}

export function withPendingUserEntry(entries, pendingUser = null) {
  const next = Array.isArray(entries) ? [...entries] : [];
  const text = typeof pendingUser?.text === "string" ? pendingUser.text : "";
  const attachments = Array.isArray(pendingUser?.attachments) && pendingUser.attachments.length > 0
    ? pendingUser.attachments.map((attachment) => ({ ...attachment }))
    : null;
  const images = Array.isArray(pendingUser?.images) && pendingUser.images.length > 0 ? [...pendingUser.images] : null;
  if (!text && !attachments && !images) return next;

  let lastUserIndex = -1;
  for (let index = next.length - 1; index >= 0; index--) {
    if (next[index]?.role === "user") {
      lastUserIndex = index;
      break;
    }
  }
  const lastUser = lastUserIndex >= 0 ? next[lastUserIndex] : null;
  if (lastUser && contentText(lastUser.content) === text) {
    if (attachments || images) next[lastUserIndex] = {
      ...lastUser,
      ...(attachments ? { attachments } : {}),
      ...(images ? { images } : {}),
    };
    return next;
  }
  next.push({
    role: "user",
    content: text,
    ...(attachments ? { attachments } : {}),
    ...(images ? { images } : {}),
  });
  return next;
}

export function serializeActiveSession(entries) {
  const rows = (Array.isArray(entries) ? entries : [])
    .map(normalizeEntry)
    .filter(Boolean)
    .map((entry) => JSON.stringify(entry));
  return rows.length > 0 ? `${rows.join("\n")}\n` : "";
}
