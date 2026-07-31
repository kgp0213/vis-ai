import { createHash } from "node:crypto";

const DEFAULT_REPEAT_REMINDER_START = 3;
const DEFAULT_DECISION_REMINDER_START = 5;
const DEFAULT_HANDOFF_REMINDER_START = 8;
const DEFAULT_STOP_SUGGESTION_START = 12;
const DEFAULT_LOW_INFO_START = 6;
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

function outputHash(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function repeatAction(count, thresholds) {
  if (count >= thresholds.stopSuggestionStart) return "stop_suggested";
  if (count >= thresholds.handoffStart) return "handoff";
  if (count >= thresholds.decisionStart) return "decision";
  if (count >= thresholds.reminderStart) return "reminder";
  return "none";
}

function reminderFor(action, count) {
  if (action === "low_info") {
    return "近期多次工具调用没有产生任何新信息。继续之前先说明下一次调用预期获得什么新证据；如果没有新证据，请更换方法或基于现有结果总结。";
  }
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

// L2 用户确认闸门：达到建议停止阈值后，该调用在执行前被直接拒绝，
// 模型只能总结现状并等待用户确认或指示（用户插话后 resetEscalation 放行）。
function blockedResult(toolName, count) {
  return JSON.stringify({
    ok: false,
    code: "tool_repeat_blocked",
    category: "recovery",
    retryable: false,
    title: "重复调用已暂停",
    message: `该工具以相同参数已连续返回相同结果 ${count} 次，继续重复不会获得新信息，此调用已被暂停执行。`,
    action: "summarize_and_confirm_with_user",
    recommendedAction: "停止重复该调用，基于现有证据总结结果并向用户说明阻塞原因，等待用户确认或指示后再继续。",
    details: { toolName, repeatCount: count },
  });
}

/**
 * Adapts Kimi Code's tool-call deduplication boundary to the existing loop.
 * Same-request completed results can be reused; cross-request repeats receive
 * a bounded model-facing reminder and a safe diagnostic fact.
 *
 * 空转判定看三维证据（工具 + 参数 + 输出）：同一调用只有连续返回完全相同
 * 的结果才算"零新信息"重复并逐级升级提醒；同参数但输出变化（监视/轮询
 * 场景在推进）会立即清零连击。注意输出哈希基于提醒注入前的原始结果，
 * 否则注入本身会打断连击。轮询类工具（pollExempt，如 read_tool_output /
 * wait_for_job）只参与同请求去重，不计入空转判定。相邻调用输出完全相同
 * 形成"低信息窗口"时只触发一次性软提醒，不阻断——不同输入凑巧同输出
 * 属于正常过程。连击达到 stop_suggested 后该调用被暂停执行，等待用户
 * 插话确认后由 resetEscalation 清零放行。
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
    lowInfoStart: Math.max(3, Number(thresholds.lowInfoStart) || DEFAULT_LOW_INFO_START),
  };
  const states = new Map();

  function stateFor(operationId) {
    const id = String(operationId ?? "").trim();
    if (!id) return null;
    let state = states.get(id);
    if (!state) {
      state = {
        requestKeys: new Set(),
        results: new Map(),
        lastKey: null,
        lastOutputHash: null,
        prevOutputHash: null,
        lowInfoStreak: 0,
        count: 0,
        emitted: new Set(),
        history: [],
        blockedKeys: new Set(),
      };
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
    if (!state) return null;
    const key = `${String(toolName ?? "tool")}\0${argsHash(args)}`;
    if (state.blockedKeys.has(key)) {
      return {
        duplicate: false,
        blocked: true,
        argsHash: key.slice(key.indexOf("\0") + 1),
        result: blockedResult(String(toolName ?? "tool").slice(0, 160), Math.max(1, state.count)),
      };
    }
    if (repeatable === false) return null;
    if (!state.requestKeys.has(key)) {
      state.requestKeys.add(key);
      return null;
    }
    const cached = state.results.get(key);
    return cached === undefined ? null : { duplicate: true, result: cached, argsHash: key.slice(key.indexOf("\0") + 1) };
  }

  function pushHistory(state, event) {
    state.history.push({ ...event, reminder: undefined });
    if (state.history.length > Math.max(1, Number(maxHistory) || MAX_HISTORY)) state.history.shift();
  }

  function augment({ operationId, toolName, args, result, repeatable = true, cacheable = true, pollExempt = false } = {}) {
    const state = stateFor(operationId);
    if (!state) return result;
    const name = String(toolName ?? "tool").slice(0, 160);
    const hash = argsHash(args);
    const key = `${name}\0${hash}`;
    state.requestKeys.add(key);
    const output = String(result ?? "");
    const outHash = outputHash(output);

    // 轮询类工具天生靠反复调用推进：只缓存结果供同请求去重，不参与空转/低信息判定。
    if (pollExempt === true) {
      if (repeatable !== false && cacheable !== false) state.results.set(key, output);
      return result;
    }

    const sameCall = state.lastKey === key;
    const zeroInfo = sameCall && state.lastOutputHash === outHash;
    const nextCount = zeroInfo ? state.count + 1 : 1;
    const action = zeroInfo ? repeatAction(nextCount, limits) : "none";
    state.count = nextCount;
    state.lastKey = key;
    state.lastOutputHash = outHash;

    // 低信息窗口：相邻两次调用（不限工具/参数）输出完全相同 → 连击 +1。
    if (state.prevOutputHash === outHash) state.lowInfoStreak += 1;
    else state.lowInfoStreak = 0;
    state.prevOutputHash = outHash;

    if (action === "none") {
      if (repeatable !== false && cacheable !== false) state.results.set(key, output);
      if (state.lowInfoStreak >= limits.lowInfoStart && !state.emitted.has("low_info")) {
        state.emitted.add("low_info");
        const event = {
          operationId: String(operationId),
          toolName: name,
          argsHash: hash,
          repeatCount: state.lowInfoStreak,
          action: "low_info",
          reminder: reminderFor("low_info", state.lowInfoStreak),
          resultAugmented: false,
          recordedAt: new Date().toISOString(),
        };
        const augmented = augmentJsonObject(output, event);
        event.resultAugmented = augmented.augmented;
        if (repeatable !== false && cacheable !== false) state.results.set(key, augmented.value);
        pushHistory(state, event);
        try { onRepeat({ ...event }); } catch { /* Diagnostics cannot block tool execution. */ }
        return augmented.value;
      }
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
    if (action === "stop_suggested") state.blockedKeys.add(key);
    pushHistory(state, event);
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

  // 用户插话确认/纠正后调用：清空升级状态与暂停名单，允许调用重新计数。
  function resetEscalation(operationId) {
    const state = states.get(String(operationId ?? ""));
    if (!state) return;
    state.count = 0;
    state.lastKey = null;
    state.lastOutputHash = null;
    state.prevOutputHash = null;
    state.lowInfoStreak = 0;
    state.blockedKeys.clear();
    state.emitted.clear();
  }

  function close(operationId) {
    states.delete(String(operationId ?? ""));
  }

  return { augment, beforeExecute, beginRequest, close, snapshot, resetEscalation };
}

export {
  DEFAULT_DECISION_REMINDER_START,
  DEFAULT_HANDOFF_REMINDER_START,
  DEFAULT_LOW_INFO_START,
  DEFAULT_REPEAT_REMINDER_START,
  DEFAULT_STOP_SUGGESTION_START,
};
