const TERMINAL_ROLES = new Set(["user", "assistant", "tool", "system", "developer"]);
const TOOL_PROTOCOL_ERROR_RE = /(?:tool[_ -]?(?:call|result)|tool_call_id|assistant.{0,80}tool|tool.{0,80}(?:assistant|message|role)|must be followed by.{0,80}tool|corresponding tool)/iu;

function text(value) {
  return String(value ?? "").trim();
}

function clone(value) {
  try { return structuredClone(value); } catch { return value; }
}

function callId(call) {
  return text(call?.id ?? call?.tool_call_id ?? call?.toolCallId) || null;
}

function resultId(message) {
  return text(message?.tool_call_id ?? message?.toolCallId) || null;
}

function anomaly(code, details = {}) {
  return { code, ...details };
}

function contentForSyntheticResult(toolCallId) {
  return `[tool result unavailable: execution state unknown for ${toolCallId}]`;
}

function mergeAssistantMessages(left, right) {
  const content = [left?.content, right?.content]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => typeof value === "string" ? value : clone(value));
  const calls = [
    ...(Array.isArray(left?.tool_calls) ? left.tool_calls : []),
    ...(Array.isArray(right?.tool_calls) ? right.tool_calls : []),
  ];
  return {
    ...left,
    ...(content.length > 0 ? {
      content: content.length === 1
        ? content[0]
        : content.every((value) => typeof value === "string")
          ? content.join("\n")
          : content.flatMap((value) => Array.isArray(value)
            ? value
            : typeof value === "string" ? [{ type: "text", text: value }] : [value]),
    } : {}),
    ...(calls.length > 0 ? { tool_calls: calls } : {}),
  };
}

/**
 * Validate and, in strict mode, repair the model-facing request copy.
 *
 * This module deliberately never mutates durable session history. The current
 * vendored loop already performs a compatible healing pass; this projection
 * provides a project-owned contract and a durable anomaly trail around that
 * behavior.
 */
export function projectProviderRequest({ history = [], providerCapabilities = {}, mode = "observe" } = {}) {
  const source = Array.isArray(history) ? history : [];
  const strict = mode === "strict" || providerCapabilities?.strictToolExchange === true;
  const sourceMessages = source.map((message) => clone(message)).filter((message) => message && typeof message === "object");
  const allCallIds = new Set();
  const duplicateCallIds = new Set();
  const allResultIds = new Set();
  const duplicateResultIds = new Set();
  const anomalies = [];
  let seenConversationRole = false;

  for (const message of sourceMessages) {
    const calls = message.role === "assistant" && Array.isArray(message.tool_calls) ? message.tool_calls : [];
    for (const call of calls) {
      const id = callId(call);
      if (!id) {
        anomalies.push(anomaly("tool_call_id_missing"));
        continue;
      }
      if (allCallIds.has(id)) duplicateCallIds.add(id);
      allCallIds.add(id);
    }
    if (message.role === "tool") {
      const id = resultId(message);
      if (!id) {
        anomalies.push(anomaly("tool_result_id_missing"));
      } else if (allResultIds.has(id)) {
        duplicateResultIds.add(id);
      } else {
        allResultIds.add(id);
      }
    }
    if (message.role && !TERMINAL_ROLES.has(String(message.role))) {
      anomalies.push(anomaly("invalid_role", { role: String(message.role).slice(0, 80) }));
    }
    if ((message.role === "system" || message.role === "developer") && seenConversationRole) {
      anomalies.push(anomaly("system_message_out_of_order", { role: message.role }));
    }
    if (["user", "assistant", "tool"].includes(message.role)) seenConversationRole = true;
  }

  for (const id of duplicateCallIds) anomalies.push(anomaly("duplicate_tool_call", { toolCallId: id }));
  for (const id of duplicateResultIds) anomalies.push(anomaly("duplicate_tool_result", { toolCallId: id }));

  const seenResults = new Set();
  const consumed = new Set();
  const output = [];

  for (let index = 0; index < sourceMessages.length; index += 1) {
    if (consumed.has(index)) continue;
    const message = sourceMessages[index];
    const hasToolCalls = message.role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
    if (message.role === "assistant" && !hasToolCalls) {
      const previous = output.at(-1);
      if (previous?.role === "assistant" && !previous.tool_calls?.length) {
        anomalies.push(anomaly("consecutive_assistant"));
        if (strict) {
          output[output.length - 1] = mergeAssistantMessages(previous, message);
          continue;
        }
      }
    }
    if (!hasToolCalls) {
      if (message.role === "tool") {
        const id = resultId(message);
        if (!id || !allCallIds.has(id)) {
          anomalies.push(anomaly("orphan_tool_result", { toolCallId: id }));
          if (strict) continue;
        } else if (seenResults.has(id)) {
          anomalies.push(anomaly("duplicate_tool_result", { toolCallId: id }));
          if (strict) continue;
        } else {
          seenResults.add(id);
        }
      }
      output.push(message);
      continue;
    }

    const calls = [];
    const pending = new Set();
    for (const call of message.tool_calls) {
      const id = callId(call);
      if (!id || pending.has(id)) {
        if (id) anomalies.push(anomaly("duplicate_tool_call", { toolCallId: id }));
        if (!strict) calls.push(call);
        continue;
      }
      pending.add(id);
      calls.push(call);
    }

    const assistantMessage = strict && calls.length !== message.tool_calls.length
      ? { ...message, tool_calls: calls }
      : message;
    output.push(assistantMessage);
    let foreignBetween = false;
    for (let cursor = index + 1; cursor < sourceMessages.length && pending.size > 0; cursor += 1) {
      if (consumed.has(cursor)) continue;
      const candidate = sourceMessages[cursor];
      const id = resultId(candidate);
      if (candidate.role === "tool" && id && pending.has(id)) {
        output.push(candidate);
        consumed.add(cursor);
        pending.delete(id);
        seenResults.add(id);
        if (foreignBetween) anomalies.push(anomaly("tool_result_reordered", { toolCallId: id }));
      } else {
        foreignBetween = true;
      }
    }
    for (const id of pending) {
      anomalies.push(anomaly("missing_tool_result", { toolCallId: id }));
      if (strict) {
        output.push({ role: "tool", tool_call_id: id, content: contentForSyntheticResult(id), visionoxUnknown: true });
        seenResults.add(id);
      }
    }
  }

  const messages = strict ? output : sourceMessages;
  const changed = strict && JSON.stringify(messages) !== JSON.stringify(sourceMessages);
  return {
    messages,
    changed,
    anomalies: anomalies.map((item) => ({ ...item, changed: changed || item.code === "invalid_role" ? changed : false })),
    warnings: anomalies.length > 0
      ? [{ code: "provider_request_repaired", count: anomalies.length, message: "模型请求历史存在工具交换异常，已记录并按 Provider 能力处理。" }]
      : [],
  };
}

export function providerProjectionAnomalyCode(value) {
  return text(value?.code ?? value) || "provider_request_anomaly";
}

function providerErrorStatus(error) {
  const direct = Number(error?.statusCode ?? error?.status ?? error?.response?.status);
  if (Number.isSafeInteger(direct)) return direct;
  const match = /(?:api|http)\s+(\d{3})/iu.exec(String(error?.message ?? error ?? ""));
  return match ? Number(match[1]) : null;
}

export function isToolProtocolRequestError(error) {
  if (providerErrorStatus(error) !== 400) return false;
  const detail = [
    error?.message,
    error?.body,
    error?.responseBody,
    error?.cause?.message,
  ].filter(Boolean).join("\n");
  return TOOL_PROTOCOL_ERROR_RE.test(detail);
}

function boundedError(error) {
  return String(error?.message ?? error ?? "provider request failed").slice(0, 320);
}

/**
 * Run one ordinary loop step with a model-facing projection boundary.
 *
 * Strict providers receive a repaired buildMessages copy immediately. Other
 * providers retain their normal request and get one strict-copy retry only
 * when a tool-protocol-specific HTTP 400 rejects it. The durable history and
 * shared Provider client are never mutated.
 */
export function invokeLoopStepWithProviderProjection({
  activeLoop,
  input,
  providerCapabilities = {},
  turnReceipt = null,
  requestId = null,
  operationId = null,
} = {}) {
  if (!activeLoop || typeof activeLoop.step !== "function") throw new TypeError("active model loop is required");
  const strict = providerCapabilities?.strictToolExchange === true;
  const originalBuildMessages = typeof activeLoop.buildMessages === "function" ? activeLoop.buildMessages : null;
  const originalClient = activeLoop.client && typeof activeLoop.client === "object" ? activeLoop.client : null;
  let wrappedBuildMessages = null;
  let projectedClient = null;
  let restored = false;

  const recordProjection = (projection, mode, extraAnomalies = []) => {
    const anomalies = [...(projection?.anomalies ?? []), ...extraAnomalies];
    if (!projection?.changed && anomalies.length === 0) return;
    turnReceipt?.recordProviderProjection?.({
      requestId: requestId || operationId,
      operationId,
      mode,
      changed: projection?.changed === true,
      anomalies,
    });
  };

  const restore = () => {
    if (restored) return;
    restored = true;
    if (originalBuildMessages && activeLoop.buildMessages === wrappedBuildMessages) activeLoop.buildMessages = originalBuildMessages;
    if (originalClient && activeLoop.client === projectedClient) activeLoop.client = originalClient;
  };

  if (strict && originalBuildMessages) {
    wrappedBuildMessages = function providerProjectedBuildMessages(...args) {
      const built = originalBuildMessages.apply(this, args);
      if (!Array.isArray(built)) return built;
      const projection = projectProviderRequest({ history: built, providerCapabilities, mode: "strict" });
      recordProjection(projection, "strict-outbound");
      return projection.messages;
    };
    try {
      activeLoop.buildMessages = wrappedBuildMessages;
    } catch {
      wrappedBuildMessages = null;
    }
  }

  const retryArgs = (args, error) => {
    if (!isToolProtocolRequestError(error)) return null;
    const request = args?.[0];
    if (!request || !Array.isArray(request.messages)) return null;
    const projection = projectProviderRequest({ history: request.messages, providerCapabilities, mode: "strict" });
    if (!projection.changed) return null;
    recordProjection(projection, "tool-protocol-400-retry", [{
      code: "provider_tool_protocol_400",
      changed: true,
      detail: { message: boundedError(error) },
    }]);
    return [{ ...request, messages: projection.messages }, ...args.slice(1)];
  };

  if (originalClient && (typeof originalClient.stream === "function" || typeof originalClient.chat === "function")) {
    projectedClient = Object.create(originalClient);
    if (typeof originalClient.stream === "function") {
      projectedClient.stream = function projectedStream(...args) {
        return (async function* retryToolProtocol400() {
          let emitted = false;
          try {
            for await (const chunk of originalClient.stream(...args)) {
              emitted = true;
              yield chunk;
            }
            return;
          } catch (error) {
            const repairedArgs = emitted ? null : retryArgs(args, error);
            if (!repairedArgs) throw error;
            try {
              for await (const chunk of originalClient.stream(...repairedArgs)) yield chunk;
            } catch (retryError) {
              recordProjection(null, "tool-protocol-400-retry-failed", [{
                code: "provider_request_repair_failed",
                changed: false,
                detail: { message: boundedError(retryError) },
              }]);
              throw retryError;
            }
          }
        }());
      };
    }
    if (typeof originalClient.chat === "function") {
      projectedClient.chat = async function projectedChat(...args) {
        try {
          return await originalClient.chat(...args);
        } catch (error) {
          const repairedArgs = retryArgs(args, error);
          if (!repairedArgs) throw error;
          try {
            return await originalClient.chat(...repairedArgs);
          } catch (retryError) {
            recordProjection(null, "tool-protocol-400-retry-failed", [{
              code: "provider_request_repair_failed",
              changed: false,
              detail: { message: boundedError(retryError) },
            }]);
            throw retryError;
          }
        }
      };
    }
    try {
      activeLoop.client = projectedClient;
    } catch {
      projectedClient = null;
    }
  }

  let iterator;
  try {
    iterator = activeLoop.step(input);
  } catch (error) {
    restore();
    throw error;
  }
  if (!iterator || typeof iterator[Symbol.asyncIterator] !== "function") {
    restore();
    return iterator;
  }
  const source = iterator[Symbol.asyncIterator]();
  // Use an explicit async-iterator facade instead of an async-generator
  // wrapper. An async generator's finally block does not run when callers
  // invoke return() before the first next(), which would leave the temporary
  // Provider client/buildMessages projection installed on the shared loop.
  return {
    [Symbol.asyncIterator]() { return this; },
    async next(...args) {
      try {
        const result = await source.next(...args);
        if (result?.done) restore();
        return result;
      } catch (error) {
        restore();
        throw error;
      }
    },
    async return(...args) {
      try {
        return typeof source.return === "function"
          ? await source.return(...args)
          : { done: true, value: undefined };
      } finally {
        restore();
      }
    },
    async throw(...args) {
      try {
        if (typeof source.throw === "function") return await source.throw(...args);
        throw args[0];
      } finally {
        restore();
      }
    },
  };
}
