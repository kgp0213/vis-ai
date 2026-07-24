function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function classify(message, status) {
  const value = message.toLowerCase();
  if (/aborted|cancelled|canceled|已取消/u.test(value)) return { code: "operation_cancelled", title: "操作已取消", retryable: false, action: "重新发起任务" };
  if (/timed?\s*out|timeout|超时/u.test(value)) return { code: "provider_timeout", title: "模型请求超时", retryable: true, action: "稍后重试或检查网络" };
  if (/fetch failed|econn|enetunreach|ehostunreach|network|网络/u.test(value)) return { code: "provider_network_failed", title: "模型网络连接失败", retryable: true, action: "检查网络后稍后重试" };
  if (status === 401 || status === 403 || /api key|unauthori|forbidden|鉴权/u.test(value)) return { code: "provider_auth_failed", title: "模型鉴权失败", retryable: false, action: "检查 Provider URL 和 API Key" };
  if (status === 429 && /quota|billing|余额|配额/u.test(value)) return { code: "provider_quota_exhausted", title: "模型额度不足", retryable: false, action: "检查账户余额或配额" };
  if (status === 429) return { code: "provider_rate_limited", title: "模型请求过于频繁", retryable: true, action: "等待后重试" };
  if (status === 413) return { code: "request_too_large", title: "请求内容过大", retryable: false, action: "减少单次输入或附件大小" };
  if (status === 404) return { code: "not_found", title: "资源不存在", retryable: false, action: "检查目标是否仍然存在" };
  if (status === 409) return { code: "state_conflict", title: "当前状态不允许此操作", retryable: true, action: "刷新当前状态后重试" };
  if (status >= 500) return { code: "internal_error", title: "服务处理失败", retryable: true, action: "查看日志后重试" };
  return { code: "request_failed", title: "请求失败", retryable: false, action: "检查输入后重试" };
}

export function structuredError({ error, code, title, message, retryable, action, details = {}, cause = null } = {}) {
  const normalizedMessage = text(message, text(error, "请求失败"));
  const fallback = classify(normalizedMessage, 500);
  return {
    error: normalizedMessage,
    code: text(code, fallback.code),
    title: text(title, fallback.title),
    message: normalizedMessage,
    retryable: retryable === true,
    action: text(action, fallback.action),
    details: details && typeof details === "object" && !Array.isArray(details) ? details : {},
    cause: cause == null ? null : text(cause).slice(0, 500),
  };
}

export function normalizeApiError(result) {
  if (!result || Number(result.status) < 400) return result;
  const body = result.body && typeof result.body === "object" && !Array.isArray(result.body)
    ? result.body
    : { error: result.body };
  const message = text(body.message, text(body.error, `HTTP ${result.status}`));
  const classified = classify(message, Number(result.status));
  const normalized = structuredError({
    ...classified,
    ...body,
    message,
    retryable: typeof body.retryable === "boolean" ? body.retryable : classified.retryable,
    details: body.details,
    cause: body.cause,
  });
  return {
    ...result,
    body: { ...body, ...normalized },
  };
}
