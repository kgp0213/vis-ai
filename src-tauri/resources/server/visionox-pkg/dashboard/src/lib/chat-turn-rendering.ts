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
  return leftScoped && rightScoped && leftTurn === rightTurn && leftStep === rightStep;
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
    const toolCallId = String(msg.toolCallId ?? msg.tool_call_id ?? msg.id ?? "").trim();
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
      continue;
    }
    units.push({
      kind: "toolGroup",
      id: `tg-${String(msg.turnId ?? "legacy")}-${String(msg.stepId ?? fallbackSequence)}-${toolCallId || index}`,
      key,
      items: [{ msg, index }],
    });
  }
  return units;
}
