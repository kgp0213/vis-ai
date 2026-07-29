const DEFAULT_MAX_INPUT_CHARS = 20_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_CACHE_SIZE = 64;
const DEFAULT_CANCELLED_CACHE_SIZE = 256;
const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,160}$/u;
const SKILL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function promptOptimizationError(code, message, options = {}) {
  const error = new Error(message, options.cause ? { cause: options.cause } : undefined);
  error.name = "PromptOptimizationError";
  error.code = code;
  error.status = Number(options.status) || 500;
  error.title = options.title ?? "提示词优化失败";
  error.retryable = options.retryable === true;
  error.action = options.action ?? null;
  error.details = options.details && typeof options.details === "object" ? options.details : {};
  return error;
}

function normalizeSlashCommands(commands) {
  const names = new Set();
  for (const command of Array.isArray(commands) ? commands : []) {
    const name = String(command?.name ?? command?.cmd ?? "").trim().replace(/^\//u, "").toLowerCase();
    if (name) names.add(name);
    for (const alias of Array.isArray(command?.aliases) ? command.aliases : []) {
      const normalized = String(alias ?? "").trim().replace(/^\//u, "").toLowerCase();
      if (normalized) names.add(normalized);
    }
  }
  return names;
}

export function classifyPromptOptimizationInput(prompt, options = {}) {
  const original = String(prompt ?? "");
  const trimmed = original.trim();
  if (!trimmed) return { kind: "empty", original, body: "", prefix: "" };

  const slash = /^\/(\S+)(?=\s|$)/u.exec(trimmed);
  if (slash && normalizeSlashCommands(options.slashCommands).has(slash[1].toLowerCase())) {
    return { kind: "command", original, body: trimmed, prefix: "", command: slash[1].toLowerCase() };
  }

  const skill = /^(\s*@([A-Za-z0-9][A-Za-z0-9._-]{0,63})[ \t]+)([\s\S]*)$/u.exec(original);
  if (skill && SKILL_NAME_RE.test(skill[2])) {
    const body = skill[3].trim();
    return {
      kind: body ? "skill" : "empty_skill",
      original,
      prefix: skill[1],
      skillName: skill[2],
      body,
    };
  }

  const emptySkill = /^\s*@([A-Za-z0-9][A-Za-z0-9._-]{0,63})\s*$/u.exec(original);
  if (emptySkill) {
    return { kind: "empty_skill", original, prefix: original, skillName: emptySkill[1], body: "" };
  }
  return { kind: "prompt", original, prefix: "", body: trimmed };
}

function trimFactPunctuation(value) {
  return String(value).replace(/[),.;:!?，。；：！？）】》]+$/u, "");
}

function collectMatches(text, kind, expression, valueAt = 0) {
  const matches = [];
  for (const match of text.matchAll(expression)) {
    const value = trimFactPunctuation(match[valueAt]);
    if (value) matches.push({ kind, value });
  }
  return matches;
}

export function extractProtectedPromptFacts(prompt) {
  const source = String(prompt ?? "");
  const found = [
    ...collectMatches(source, "url", /https?:\/\/[^\s<>"'，。；：！？）】》“”‘’]+/giu),
    ...collectMatches(source, "path", /(?:[A-Za-z]:\\|\\\\)[^\s<>"'|?*]+/gu),
    ...collectMatches(source, "date", /(?<!\d)\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?(?!\d)/gu),
    ...collectMatches(source, "quoted", /[“"]([^”"\r\n]+)[”"]/gu, 1),
    ...collectMatches(source, "quoted", /[‘']([^’'\r\n]+)[’']/gu, 1),
    ...collectMatches(source, "quoted", /「([^」\r\n]+)」/gu, 1),
    ...collectMatches(source, "number", /(?<![\p{L}\p{N}_])[-+]?\d+(?:[.,]\d+)*(?:%|[A-Za-z]{1,8})?(?![\p{L}\p{N}_])/gu),
  ];
  const facts = new Map();
  for (const fact of found) {
    const key = `${fact.kind}\0${fact.value}`;
    const current = facts.get(key);
    facts.set(key, current ? { ...current, count: current.count + 1 } : { ...fact, count: 1 });
  }
  return [...facts.values()];
}

function missingProtectedFacts(required, candidate) {
  const available = new Map(candidate.map((fact) => [`${fact.kind}\0${fact.value}`, fact.count]));
  return required.filter((fact) => (available.get(`${fact.kind}\0${fact.value}`) ?? 0) < fact.count);
}

function stripResponseFence(value) {
  return String(value ?? "").trim()
    .replace(/^```(?:text|txt|markdown)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
}

function modeGuidance(mode) {
  if (mode === "coding") {
    return [
      "当前为编程模式。判断用户是在咨询、排查、修改、构建还是审查代码。",
      "在不改变原意的前提下，明确技术目标、影响范围、兼容性约束、验证方式和交付结果。",
      "不要把讨论或诊断请求擅自改成实施请求，也不要虚构技术栈、文件名或测试命令。",
    ].join("\n");
  }
  return [
    "当前为通用模式。仅根据本次提供的文字判断问答、办公、数据整理、研究或设计等场景。",
    "在原文已有事实范围内明确目标、对象、范围、期望交付物和成功标准。",
    "高影响条件无法确定时保留为待确认项，不要替用户编造答案。",
  ].join("\n");
}

function systemPrompt(mode) {
  return [
    "你是提示词编辑器，只改写用户的任务描述，不回答问题，也不执行任务。",
    "保持原文语言，保留原始意图、事实、文件路径、URL、数字、日期、专有名称、范围、限制条件和交付要求。",
    "可以补足有助于执行的目标边界和验收表述，但不得增加执行、发送、安装或其他用户未提出的副作用。",
    "原文已经清晰时只做最小修改。",
    modeGuidance(mode),
    "只输出优化后的提示词正文，不要解释，不要加引号、标题或代码围栏。",
  ].join("\n");
}

function normalizeProviderFailure(error, signal) {
  if (error?.name === "PromptOptimizationError") return error;
  if (signal?.aborted || error?.name === "AbortError") {
    const timeout = error?.code === "prompt_optimization_timeout" || signal?.reason?.code === "prompt_optimization_timeout";
    return timeout
      ? promptOptimizationError("prompt_optimization_timeout", "提示词优化请求超时。", {
          status: 504, retryable: true, action: "retry",
        })
      : promptOptimizationError("prompt_optimization_cancelled", "提示词优化已取消。", {
          status: 499, action: "keep_original",
        });
  }
  const rawStatus = Number(error?.statusCode ?? error?.status ?? error?.response?.status);
  const message = String(error?.message ?? error ?? "");
  if (rawStatus === 401 || rawStatus === 403) {
    return promptOptimizationError("prompt_optimization_auth_failed", "模型服务鉴权失败。", {
      status: rawStatus, action: "check_provider_credentials", cause: error,
    });
  }
  if (rawStatus === 429) {
    return promptOptimizationError("prompt_optimization_rate_limited", "模型服务当前请求过多。", {
      status: 429, retryable: true, action: "retry_later", cause: error,
    });
  }
  if (rawStatus === 408 || /timed?\s*out|timeout/iu.test(message)) {
    return promptOptimizationError("prompt_optimization_timeout", "提示词优化请求超时。", {
      status: 504, retryable: true, action: "retry", cause: error,
    });
  }
  if (/incomplete output|finish reason:\s*(?:length|max_tokens)|truncat/iu.test(message)) {
    return promptOptimizationError("prompt_optimization_truncated", "模型返回的优化结果不完整。", {
      status: 502, retryable: true, action: "retry", cause: error,
    });
  }
  if (rawStatus >= 500 || /network|fetch failed|econn|socket|dns/iu.test(message)) {
    return promptOptimizationError("prompt_optimization_network_failed", "模型服务网络请求失败。", {
      status: Number.isFinite(rawStatus) ? rawStatus : 502,
      retryable: true,
      action: "retry",
      cause: error,
    });
  }
  return promptOptimizationError("prompt_optimization_provider_failed", "模型服务未能完成提示词优化。", {
    status: Number.isFinite(rawStatus) ? rawStatus : 502,
    retryable: false,
    action: "keep_original",
    cause: error,
  });
}

export function createPromptOptimizationRuntime(options = {}) {
  if (typeof options.requestModelText !== "function") throw new TypeError("requestModelText is required");
  const getModelContext = typeof options.getModelContext === "function" ? options.getModelContext : () => ({});
  const isTaskBusy = typeof options.isTaskBusy === "function" ? options.isTaskBusy : () => false;
  const audit = typeof options.audit === "function" ? options.audit : () => {};
  const maxInputChars = boundedInteger(options.maxInputChars, DEFAULT_MAX_INPUT_CHARS, 1, 100_000);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 100, 600_000);
  const cacheSize = boundedInteger(options.cacheSize, DEFAULT_CACHE_SIZE, 1, 256);
  const cache = new Map();
  const cancelled = new Set();
  let active = null;

  function rememberCancellation(requestId) {
    cancelled.delete(requestId);
    cancelled.add(requestId);
    while (cancelled.size > DEFAULT_CANCELLED_CACHE_SIZE) {
      cancelled.delete(cancelled.values().next().value);
    }
  }

  function emitAudit(action, payload) {
    try { audit({ ts: Date.now(), action, payload }); } catch { /* Auditing cannot block the editor. */ }
  }

  function remember(requestId, promise) {
    cache.set(requestId, { promise });
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value);
  }

  async function optimize(input = {}) {
    const requestId = String(input.requestId ?? "").trim();
    if (!REQUEST_ID_RE.test(requestId)) {
      throw promptOptimizationError("prompt_optimization_request_id_invalid", "requestId 无效。", { status: 400 });
    }
    if (cache.has(requestId)) return cache.get(requestId).promise;
    if (cancelled.has(requestId)) {
      throw promptOptimizationError("prompt_optimization_cancelled", "提示词优化已取消。", {
        status: 499, action: "keep_original",
      });
    }
    if (isTaskBusy()) {
      throw promptOptimizationError("prompt_optimization_busy", "主任务运行期间不能优化提示词。", {
        status: 409, retryable: true, action: "wait_for_task",
      });
    }
    if (active) {
      throw promptOptimizationError("prompt_optimization_request_busy", "已有提示词优化请求正在运行。", {
        status: 409, retryable: true, action: "wait_or_cancel",
      });
    }

    const classified = classifyPromptOptimizationInput(input.prompt, { slashCommands: options.slashCommands });
    const validationError = classified.kind === "empty"
      ? promptOptimizationError("prompt_optimization_empty", "prompt 不能为空。", { status: 400 })
      : classified.kind === "command"
        ? promptOptimizationError("prompt_optimization_command_unsupported", "斜杠命令不能进行提示词优化。", { status: 400 })
        : classified.kind === "empty_skill"
          ? promptOptimizationError("prompt_optimization_skill_body_required", "Skill 前缀后缺少任务正文。", { status: 400 })
          : classified.original.length > maxInputChars
            ? promptOptimizationError("prompt_optimization_too_long", `prompt 最多允许 ${maxInputChars} 个字符。`, {
                status: 400, details: { maxInputChars },
              })
            : null;
    if (validationError) {
      emitAudit("prompt-optimization-failed", {
        requestId,
        status: validationError.code,
        inputLength: classified.original.length,
        durationMs: 0,
        providerId: null,
        model: null,
      });
      throw validationError;
    }

    const context = getModelContext() ?? {};
    const mode = String(context.mode ?? "general");
    const providerId = typeof context.providerId === "string" ? context.providerId : null;
    const model = typeof context.model === "string" ? context.model : null;
    const draftRevision = Number.isSafeInteger(input.draftRevision) && input.draftRevision >= 0 ? input.draftRevision : 0;
    const protectedFacts = extractProtectedPromptFacts(classified.body);
    const controller = new AbortController();
    const startedAt = Date.now();
    const timeoutError = promptOptimizationError("prompt_optimization_timeout", "提示词优化请求超时。", {
      status: 504, retryable: true, action: "retry",
    });
    let timeoutHandle;
    const timeoutPromise = new Promise((resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort(timeoutError);
        reject(timeoutError);
      }, timeoutMs);
    });
    const task = (async () => {
      try {
        const desiredTokens = Math.min(4096, Math.max(1024, Math.ceil(classified.body.length * 1.5)));
        const declaredOutputCapacity = Number(
          context.providerCapabilities?.maxOutputTokens
          ?? context.providerCapabilities?.maxCompletionTokens,
        );
        const requestedTokens = Number.isSafeInteger(declaredOutputCapacity) && declaredOutputCapacity > 0
          ? Math.min(desiredTokens, declaredOutputCapacity)
          : desiredTokens;
        const text = await Promise.race([
          options.requestModelText({
            label: "prompt optimization",
            model,
            messages: [
              { role: "system", content: systemPrompt(mode) },
              { role: "user", content: classified.body },
            ],
            temperature: 0.2,
            maxTokens: requestedTokens,
            signal: controller.signal,
            requestPurpose: "prompt-optimization",
          }),
          timeoutPromise,
        ]);
        const optimizedBody = stripResponseFence(text);
        if (!optimizedBody) {
          throw promptOptimizationError("prompt_optimization_empty_response", "模型没有返回可用的优化结果。", {
            status: 502, retryable: true, action: "retry",
          });
        }
        const missingFacts = missingProtectedFacts(protectedFacts, extractProtectedPromptFacts(optimizedBody));
        if (missingFacts.length > 0) {
          throw promptOptimizationError("prompt_optimization_fact_mismatch", "优化结果改变或删除了受保护事实。", {
            status: 422,
            action: "keep_original",
            details: { missingFacts },
          });
        }
        const optimized = `${classified.prefix}${optimizedBody}`;
        const result = {
          requestId,
          draftRevision,
          original: classified.original,
          optimized,
          warnings: [],
          protectedFacts,
          unchanged: optimized === classified.original,
        };
        emitAudit("prompt-optimization", {
          requestId,
          status: "succeeded",
          durationMs: Date.now() - startedAt,
          providerId,
          model,
          inputLength: classified.original.length,
          outputLength: optimized.length,
        });
        return result;
      } catch (error) {
        const normalized = normalizeProviderFailure(error, controller.signal);
        emitAudit("prompt-optimization-failed", {
          requestId,
          status: normalized.code,
          durationMs: Date.now() - startedAt,
          providerId,
          model,
          inputLength: classified.original.length,
          outputLength: 0,
        });
        throw normalized;
      } finally {
        clearTimeout(timeoutHandle);
        if (active?.requestId === requestId) active = null;
      }
    })();
    active = { requestId, controller, promise: task };
    remember(requestId, task);
    return task;
  }

  function cancel(requestId) {
    const id = String(requestId ?? "").trim();
    if (!REQUEST_ID_RE.test(id)) {
      return { requestId: id, cancelled: false };
    }
    rememberCancellation(id);
    if (active?.requestId === id) {
      active.controller.abort(promptOptimizationError("prompt_optimization_cancelled", "提示词优化已取消。", {
        status: 499, action: "keep_original",
      }));
    }
    return { requestId: id, cancelled: true };
  }

  return {
    optimize,
    cancel,
    snapshot: () => ({ activeRequestId: active?.requestId ?? null, cached: cache.size }),
  };
}
