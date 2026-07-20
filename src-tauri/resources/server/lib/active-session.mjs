const MODEL_ROLES = new Set(["system", "user", "assistant", "tool"]);
const DASHBOARD_ROLES = new Set(["user", "assistant", "tool", "warning", "error", "info"]);
const INTERNAL_USER_PROMPT_RE = /^\[(?:系统自动续跑\s+\d+\/\d+|系统后台任务接管\s+document:[^\]]+)\]/;

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
  if (!MODEL_ROLES.has(role) && !DASHBOARD_ROLES.has(role)) return null;
  const content = value.content !== undefined ? value.content : value.text;
  if (typeof content !== "string" && !Array.isArray(content)) return null;
  return { ...value, role, content };
}

function isInternalUserEntry(entry) {
  if (entry?.role !== "user") return false;
  if (entry.internal === true) return true;
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
      if (typeof entry.name === "string") modelEntry.name = entry.name;
      if (typeof entry.tool_call_id === "string") modelEntry.tool_call_id = entry.tool_call_id;
      if (Array.isArray(entry.tool_calls)) modelEntry.tool_calls = entry.tool_calls;
      const reasoning = entry.reasoning_content ?? entry.reasoning;
      if (typeof reasoning === "string" && reasoning) modelEntry.reasoning_content = reasoning;
      return modelEntry;
    });
}

export function activeEntriesForDashboard(entries, now = Date.now()) {
  let sequence = 0;
  const visible = [];
  let pendingAssistant = null;

  const restoredEntry = (entry, text) => {
    sequence += 1;
    return {
      id: entry.id || `restored-${entry.role}-${now}-${sequence}`,
      role: entry.role,
      text,
      toolName: entry.toolName ?? entry.name,
      toolArgs: entry.toolArgs,
      images: Array.isArray(entry.images) ? entry.images : undefined,
    };
  };

  const flushAssistant = () => {
    if (!pendingAssistant) return;
    visible.push(restoredEntry(pendingAssistant.entry, pendingAssistant.text));
    pendingAssistant = null;
  };

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || !DASHBOARD_ROLES.has(entry.role)) continue;
    const text = contentText(entry.content !== undefined ? entry.content : entry.text);

    if (entry.role === "tool") continue;
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
      if (text) visible.push(restoredEntry(entry, text));
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
  if (!text) return next;

  let lastUserIndex = -1;
  for (let index = next.length - 1; index >= 0; index--) {
    if (next[index]?.role === "user") {
      lastUserIndex = index;
      break;
    }
  }
  const images = Array.isArray(pendingUser.images) && pendingUser.images.length > 0 ? [...pendingUser.images] : null;
  const lastUser = lastUserIndex >= 0 ? next[lastUserIndex] : null;
  if (lastUser && contentText(lastUser.content) === text) {
    if (images) next[lastUserIndex] = { ...lastUser, images };
    return next;
  }
  next.push({ role: "user", content: text, ...(images ? { images } : {}) });
  return next;
}

export function serializeActiveSession(entries) {
  const rows = (Array.isArray(entries) ? entries : [])
    .map(normalizeEntry)
    .filter(Boolean)
    .map((entry) => JSON.stringify(entry));
  return rows.length > 0 ? `${rows.join("\n")}\n` : "";
}
