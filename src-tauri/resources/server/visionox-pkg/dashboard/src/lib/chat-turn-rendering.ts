// Pure grouping logic for the chat process view. It deliberately has no UI
// dependencies so legacy messages and replayed events follow the same rules.
export function toolGroupAttention(messages: any[] = []) {
  const statuses = (Array.isArray(messages) ? messages : [])
    .map((message) => String(message?.toolStatus ?? message?.status ?? "").trim().toLowerCase());
  const hasFailure = statuses.some((status) => ["failed", "cancelled", "unknown"].includes(status));
  const hasRecovery = statuses.includes("recovered");
  return { hasFailure, hasRecovery, keepExpanded: hasFailure || hasRecovery };
}

function frameValue(value: any): string {
  return String(value ?? "").trim();
}

function toolCallValue(message: any): string {
  return frameValue(message?.toolCallId ?? message?.tool_call_id ?? message?.id);
}

function stableGroupId(key: string, items: any[]): string {
  if (!key.startsWith("legacy:")) return `tg-${key}`;
  // A paginated legacy group may gain items at its beginning. Anchor it to
  // the tail call, which remains present across that prepend, instead of the
  // first visible item whose identity changes when history is loaded. Current
  // events carry turn/step IDs and use the branch above, so live appends keep
  // their group identity as well.
  const tailCallId = toolCallValue(items.at(-1)?.msg);
  return `tg-${tailCallId || key}`;
}

export function toolFrameMatches(left: any, right: any): boolean {
  const leftId = frameValue(left?.id);
  const rightId = frameValue(right?.id);
  if (leftId && rightId && leftId === rightId) return true;

  const leftCallId = frameValue(left?.toolCallId ?? left?.tool_call_id);
  const rightCallId = frameValue(right?.toolCallId ?? right?.tool_call_id);
  if (!leftCallId || leftCallId !== rightCallId) return false;

  const leftTurn = frameValue(left?.turnId);
  const rightTurn = frameValue(right?.turnId);
  const leftStep = frameValue(left?.stepId);
  const rightStep = frameValue(right?.stepId);
  const leftScoped = Boolean(leftTurn || leftStep);
  const rightScoped = Boolean(rightTurn || rightStep);
  if (!leftScoped && !rightScoped) return true;
  if (!leftScoped || !rightScoped) return false;
  if (leftTurn || rightTurn) {
    if (!leftTurn || !rightTurn || leftTurn !== rightTurn) return false;
    return !(leftStep && rightStep && leftStep !== rightStep);
  }
  return Boolean(leftStep && rightStep && leftStep === rightStep);
}

export function mergeSnapshotToolsIntoMessages(messages: any[] = [], tools: any[] = []) {
  const result = Array.isArray(messages) ? messages.map((message) => ({ ...message })) : [];
  for (const tool of Array.isArray(tools) ? tools : []) {
    if (!tool || typeof tool !== "object") continue;
    const toolCallId = toolCallValue(tool);
    if (!toolCallId) continue;
    const next = {
      ...tool,
      toolCallId,
      role: "tool",
      text: tool.content ?? tool.text ?? "",
      toolArgs: tool.args ?? tool.toolArgs,
      toolStatus: tool.status ?? tool.state ?? "unknown",
    };
    const existingIndex = result.findIndex((message) => toolFrameMatches(message, next));
    if (existingIndex >= 0) {
      result[existingIndex] = { ...result[existingIndex], ...next };
      continue;
    }
    const turnId = frameValue(next.turnId);
    const assistantIndex = turnId
      ? result.findIndex((message) => message?.role === "assistant" && frameValue(message.turnId) === turnId)
      : -1;
    result.splice(assistantIndex >= 0 ? assistantIndex : result.length, 0, next);
  }
  return result;
}

export function groupToolMessages(messages: any[] = []) {
  const units: any[] = [];
  let fallbackSequence = 0;
  let fallbackGroupKey: string | null = null;
  for (const [index, msg] of (Array.isArray(messages) ? messages : []).entries()) {
    if (msg?.role !== "tool") {
      fallbackGroupKey = null;
      units.push({ kind: "msg", msg, index });
      continue;
    }
    const hasTurn = Boolean(String(msg.turnId ?? "").trim());
    const hasStep = Boolean(String(msg.stepId ?? "").trim());
    const toolCallId = toolCallValue(msg);
    const key = hasTurn || hasStep
      ? `identified:${String(msg.turnId ?? "legacy")}::${String(msg.stepId ?? `tool:${toolCallId || index}`)}`
      : (fallbackGroupKey ?? `legacy:${fallbackSequence + 1}`);
    if (!hasTurn && !hasStep && !fallbackGroupKey) {
      fallbackSequence += 1;
      fallbackGroupKey = key;
    } else if (hasTurn || hasStep) {
      fallbackGroupKey = null;
    }
    const previous = units.at(-1);
    if (previous?.kind === "toolGroup" && previous.key === key) {
      const existingIndex = toolCallId
        ? previous.items.findIndex((item: any) => String(item.msg?.toolCallId ?? item.msg?.tool_call_id ?? item.msg?.id ?? "").trim() === toolCallId)
        : -1;
      if (existingIndex >= 0) {
        const existing = previous.items[existingIndex];
        previous.items[existingIndex] = {
          ...existing,
          msg: { ...existing.msg, ...msg },
          index,
        };
      } else {
        previous.items.push({ msg, index });
      }
      previous.id = stableGroupId(previous.key, previous.items);
      continue;
    }
    const group = {
      kind: "toolGroup",
      id: "",
      key,
      items: [{ msg, index }],
    };
    group.id = stableGroupId(group.key, group.items);
    units.push(group);
  }
  return units;
}
