import { createHash } from "node:crypto";

const DEFAULT_REPEAT_REMINDER_START = 3;
const DEFAULT_DECISION_REMINDER_START = 5;
const DEFAULT_HANDOFF_REMINDER_START = 8;
const DEFAULT_STOP_SUGGESTION_START = 12;
const MAX_HISTORY = 32;

function stableJson(value, seen = new Set()) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (seen.has(value)) return '"[circular]"';
  seen.add(value);
  const result = Array.isArray(value)
    ? `[${value.map((item) => stableJson(item, seen)).join(",")}]`
    : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key], seen)}`).join(",")}}`;
  seen.delete(value);
  return result;
}

function argsHash(value) {
  const serialized = stableJson(value);
  return `sha256:${createHash("sha256").update(serialized ?? "undefined").digest("hex")}`;
}

function repeatAction(count, thresholds) {
  if (count >= thresholds.stopSuggestionStart) return "stop_suggested";
  if (count >= thresholds.handoffStart) return "handoff";
  if (count >= thresholds.decisionStart) return "decision";
  if (count >= thresholds.reminderStart) return "reminder";
  return "none";
}

function reminderFor(action, count) {
  if (action === "stop_suggested") {
    return "同一工具调用已连续重复多次。停止继续调用，向用户说明当前阻塞、已经尝试的方法，以及需要用户决定或补充的信息。";
  }
  if (action === "handoff") {
    return "同一工具调用已经连续重复。请基于现有证据给出结果，或明确说明阻塞和需要用户提供的信息，不要继续重复该调用。";
  }
  if (action === "decision") {
    return `同一工具调用已连续重复 ${count} 次。下一步只能选择：做一个最小反证测试、请求缺失输入，或基于现有证据总结结果。`;
  }
  return "同一工具调用已连续重复。下一次调用前先说明预期新增的证据；如果没有新增证据，请改用其他方法或总结当前结果。";
}

function augmentJsonObject(result, event) {
  try {
    const parsed = JSON.parse(result);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { value: result, augmented: false };
    return {
      value: JSON.stringify({
        ...parsed,
        _visionox: {
          ...(parsed._visionox && typeof parsed._visionox === "object" ? parsed._visionox : {}),
          toolRepeat: {
            repeatCount: event.repeatCount,
            action: event.action,
            instruction: event.reminder,
          },
        },
      }),
      augmented: true,
    };
  } catch {
    return { value: `${result}\n\n[Visionox tool reminder]\n${event.reminder}`, augmented: true };
  }
}

/**
 * Adapts Kimi Code's tool-call deduplication boundary to the existing loop.
 * Same-request completed results can be reused; cross-request repeats receive
 * a bounded model-facing reminder and a safe diagnostic fact.
 */
export function createToolRepeatRuntime({
  maxHistory = MAX_HISTORY,
  thresholds = {},
  onRepeat = () => {},
} = {}) {
  const limits = {
    reminderStart: Math.max(2, Number(thresholds.reminderStart) || DEFAULT_REPEAT_REMINDER_START),
    decisionStart: Math.max(3, Number(thresholds.decisionStart) || DEFAULT_DECISION_REMINDER_START),
    handoffStart: Math.max(4, Number(thresholds.handoffStart) || DEFAULT_HANDOFF_REMINDER_START),
    stopSuggestionStart: Math.max(5, Number(thresholds.stopSuggestionStart) || DEFAULT_STOP_SUGGESTION_START),
  };
  const states = new Map();

  function stateFor(operationId) {
    const id = String(operationId ?? "").trim();
    if (!id) return null;
    let state = states.get(id);
    if (!state) {
      state = { requestKeys: new Set(), results: new Map(), lastKey: null, count: 0, emitted: new Set(), history: [] };
      states.set(id, state);
    }
    return state;
  }

  function beginRequest(operationId) {
    const state = stateFor(operationId);
    if (!state) return;
    state.requestKeys.clear();
    state.results.clear();
  }

  function beforeExecute({ operationId, toolName, args, repeatable = true } = {}) {
    const state = stateFor(operationId);
    if (!state || repeatable === false) return null;
    const key = `${String(toolName ?? "tool")}\0${argsHash(args)}`;
    if (!state.requestKeys.has(key)) {
      state.requestKeys.add(key);
      return null;
    }
    const cached = state.results.get(key);
    return cached === undefined ? null : { duplicate: true, result: cached, argsHash: key.slice(key.indexOf("\0") + 1) };
  }

  function augment({ operationId, toolName, args, result, repeatable = true, cacheable = true } = {}) {
    const state = stateFor(operationId);
    if (!state) return result;
    const name = String(toolName ?? "tool").slice(0, 160);
    const hash = argsHash(args);
    const key = `${name}\0${hash}`;
    state.requestKeys.add(key);
    const action = state.lastKey === key ? repeatAction(state.count + 1, limits) : "none";
    state.count = state.lastKey === key ? state.count + 1 : 1;
    state.lastKey = key;
    const output = String(result ?? "");
    if (action === "none") {
      if (repeatable !== false && cacheable !== false) state.results.set(key, output);
      return result;
    }
    const event = {
      operationId: String(operationId),
      toolName: name,
      argsHash: hash,
      repeatCount: state.count,
      action,
      reminder: reminderFor(action, state.count),
      resultAugmented: false,
      recordedAt: new Date().toISOString(),
    };
    const augmented = augmentJsonObject(output, event);
    event.resultAugmented = augmented.augmented;
    if (repeatable !== false && cacheable !== false) state.results.set(key, augmented.value);
    state.history.push({ ...event, reminder: undefined });
    if (state.history.length > Math.max(1, Number(maxHistory) || MAX_HISTORY)) state.history.shift();
    if (!state.emitted.has(action)) {
      state.emitted.add(action);
      try { onRepeat({ ...event }); } catch { /* Diagnostics cannot block tool execution. */ }
    }
    return augmented.value;
  }

  function snapshot(operationId) {
    const state = stateFor(operationId);
    return state ? state.history.map((entry) => ({ ...entry })) : [];
  }

  function close(operationId) {
    states.delete(String(operationId ?? ""));
  }

  return { augment, beforeExecute, beginRequest, close, snapshot };
}

export {
  DEFAULT_DECISION_REMINDER_START,
  DEFAULT_HANDOFF_REMINDER_START,
  DEFAULT_REPEAT_REMINDER_START,
  DEFAULT_STOP_SUGGESTION_START,
};
