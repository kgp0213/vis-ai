#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  createParser
} from "./chunk-25T6CVUP.js";

// src/retry.ts
var DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];
async function fetchWithRetry(fetchFn, url, init, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 4;
  const initial = opts.initialBackoffMs ?? 500;
  const cap = opts.maxBackoffMs ?? 1e4;
  const retryable = new Set(opts.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES);
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (opts.signal?.aborted) throw new Error("aborted");
    try {
      const resp = await fetchFn(url, init);
      if (resp.ok || !retryable.has(resp.status)) return resp;
      if (attempt === maxAttempts - 1) return resp;
      await resp.text().catch(() => void 0);
      const waitMs = computeWait(attempt, initial, cap, resp.headers.get("Retry-After"));
      opts.onRetry?.({ attempt: attempt + 1, reason: `http ${resp.status}`, waitMs });
      await sleep(waitMs, opts.signal);
    } catch (err) {
      lastError = err;
      if (isAbortError(err) || opts.signal?.aborted) throw err;
      if (attempt === maxAttempts - 1) throw err;
      const waitMs = computeWait(attempt, initial, cap, null);
      opts.onRetry?.({
        attempt: attempt + 1,
        reason: `network: ${messageOf(err)}`,
        waitMs
      });
      await sleep(waitMs, opts.signal);
    }
  }
  throw lastError ?? new Error("fetchWithRetry: loop exited unexpectedly");
}
function computeWait(attempt, initial, cap, retryAfter) {
  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1e3, cap);
    }
  }
  const exp = initial * 2 ** attempt;
  const jitter = exp * (0.75 + Math.random() * 0.5);
  return Math.min(Math.max(jitter, 0), cap);
}
function sleep(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
function isAbortError(err) {
  if (!err || typeof err !== "object") return false;
  const name = err.name;
  return name === "AbortError";
}
function messageOf(err) {
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return "unknown error";
  }
}

// src/client.ts
var Usage = class _Usage {
  constructor(promptTokens = 0, completionTokens = 0, totalTokens = 0, promptCacheHitTokens = 0, promptCacheMissTokens = 0) {
    this.promptTokens = promptTokens;
    this.completionTokens = completionTokens;
    this.totalTokens = totalTokens;
    this.promptCacheHitTokens = promptCacheHitTokens;
    this.promptCacheMissTokens = promptCacheMissTokens;
  }
  promptTokens;
  completionTokens;
  totalTokens;
  promptCacheHitTokens;
  promptCacheMissTokens;
  get cacheHitRatio() {
    const denom = this.promptCacheHitTokens + this.promptCacheMissTokens;
    return denom > 0 ? this.promptCacheHitTokens / denom : 0;
  }
  static fromApi(raw) {
    const u = raw ?? {};
    return new _Usage(
      u.prompt_tokens ?? 0,
      u.completion_tokens ?? 0,
      u.total_tokens ?? 0,
      u.prompt_cache_hit_tokens ?? 0,
      u.prompt_cache_miss_tokens ?? 0
    );
  }
};
function pickPrimaryBalance(infos) {
  if (infos.length === 0) return null;
  let best = infos[0];
  for (let i = 1; i < infos.length; i++) {
    if (Number(infos[i].total_balance) > Number(best.total_balance)) best = infos[i];
  }
  return best;
}
var DeepSeekClient = class {
  apiKey;
  baseUrl;
  timeoutMs;
  retry;
  _fetch;
  requestConfigForModel;
  constructor(opts = {}) {
    const apiKey = opts.apiKey ?? process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error(
        "DEEPSEEK_API_KEY is not set. Put it in .env or pass apiKey to DeepSeekClient."
      );
    }
    this.apiKey = apiKey;
    let url = opts.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
    while (url.endsWith("/")) url = url.slice(0, -1);
    this.baseUrl = url;
    this.timeoutMs = opts.timeoutMs ?? 66e4;
    this._fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.retry = opts.retry ?? {};
    this.requestConfigForModel = opts.requestConfigForModel ?? (() => ({ policy: "legacy", requestDefaults: {} }));
  }
  buildPayload(opts, stream) {
    const requestConfig = this.requestConfigForModel(opts.model, { purpose: opts.requestPurpose }) ?? {};
    const jsonPolicy = requestConfig.policy === "json";
    const requestDefaults = jsonPolicy && requestConfig.requestDefaults && typeof requestConfig.requestDefaults === "object" && !Array.isArray(requestConfig.requestDefaults)
      ? requestConfig.requestDefaults
      : {};
    const payload = {
      ...requestDefaults,
      model: opts.model,
      messages: opts.messages,
      stream
    };
    if (opts.tools?.length) payload.tools = opts.tools;
    if (opts.temperature !== void 0) payload.temperature = opts.temperature;
    if (opts.maxTokens !== void 0) payload.max_tokens = opts.maxTokens;
    if (opts.responseFormat) payload.response_format = opts.responseFormat;
    if (!jsonPolicy && opts.thinking) {
      payload.extra_body = { thinking: { type: opts.thinking } };
    }
    if (!jsonPolicy && opts.reasoningEffort) {
      payload.reasoning_effort = opts.reasoningEffort;
    }
    return payload;
  }
  /** Returns null on failure so callers can degrade — session must keep working without balance UI. */
  async getBalance(opts = {}) {
    try {
      const resp = await this._fetch(`${this.baseUrl}/user/balance`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: opts.signal
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data || !Array.isArray(data.balance_infos)) return null;
      return data;
    } catch {
      return null;
    }
  }
  /** Returns null on failure — callers fall back to a hardcoded model hint. */
  async listModels(opts = {}) {
    try {
      const resp = await this._fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: opts.signal
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data || !Array.isArray(data.data)) return null;
      return data;
    } catch {
      return null;
    }
  }
  async chat(opts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, ctrl.signal]) : ctrl.signal;
    try {
      const resp = await fetchWithRetry(
        this._fetch,
        `${this.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(this.buildPayload(opts, false)),
          signal
        },
        { ...this.retry, signal }
      );
      if (!resp.ok) {
        throw new Error(`DeepSeek ${resp.status}: ${await resp.text()}`);
      }
      const data = await resp.json();
      const choice = data.choices?.[0]?.message ?? {};
      return {
        content: choice.content ?? "",
        reasoningContent: choice.reasoning_content ?? null,
        toolCalls: choice.tool_calls ?? [],
        usage: Usage.fromApi(data.usage),
        finishReason: data.choices?.[0]?.finish_reason ?? void 0,
        raw: data
      };
    } finally {
      clearTimeout(timer);
    }
  }
  async *stream(opts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, ctrl.signal]) : ctrl.signal;
    let resp;
    try {
      resp = await fetchWithRetry(
        this._fetch,
        `${this.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream"
          },
          body: JSON.stringify(this.buildPayload(opts, true)),
          signal
        },
        { ...this.retry, signal }
      );
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
    if (!resp.ok || !resp.body) {
      clearTimeout(timer);
      throw new Error(`DeepSeek ${resp.status}: ${await resp.text().catch(() => "")}`);
    }
    const queue = [];
    let done = false;
    let receivedDoneMarker = false;
    let lastFinishReason;
    let protocolError = null;
    const parser = createParser({
      onEvent: (ev) => {
        if (!ev.data || !ev.data.trim()) return;
        if (ev.data === "[DONE]") {
          receivedDoneMarker = true;
          done = true;
          return;
        }
        try {
          const json = JSON.parse(ev.data);
          if (json?.error) {
            const providerError = json.error;
            let providerMessage = typeof providerError === "string"
              ? providerError
              : providerError?.message || providerError?.detail || providerError?.error;
            if (!providerMessage) {
              try { providerMessage = JSON.stringify(providerError); } catch { providerMessage = String(providerError); }
            }
            const error = new Error(`model provider stream error: ${providerMessage || "unknown provider error"}`);
            error.name = "ModelProviderStreamError";
            protocolError = error;
            done = true;
            return;
          }
          const delta = json.choices?.[0]?.delta ?? {};
          const finishReason = json.choices?.[0]?.finish_reason ?? void 0;
          if (typeof finishReason === "string" && finishReason) lastFinishReason = finishReason;
          const chunk = { raw: json, finishReason };
          if (typeof delta.content === "string" && delta.content.length > 0) {
            chunk.contentDelta = delta.content;
          }
          if (typeof delta.reasoning_content === "string" && delta.reasoning_content.length > 0) {
            chunk.reasoningDelta = delta.reasoning_content;
          }
          if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
            const tc = delta.tool_calls[0];
            chunk.toolCallDelta = {
              index: tc.index ?? 0,
              id: tc.id,
              name: tc.function?.name,
              argumentsDelta: tc.function?.arguments
            };
          }
          if (json.usage) {
            chunk.usage = Usage.fromApi(json.usage);
          }
          queue.push(chunk);
        } catch (error) {
          protocolError = new Error(`model provider returned malformed SSE JSON (${ev.data.length} chars): ${error.message}`);
          protocolError.name = "ModelStreamProtocolError";
          done = true;
        }
      }
    });
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift();
          continue;
        }
        if (protocolError) throw protocolError;
        if (done) break;
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
      while (queue.length > 0) yield queue.shift();
      if (protocolError) throw protocolError;
      if (!receivedDoneMarker && !lastFinishReason) {
        const error = new Error("model response stream closed without an explicit completion marker or finish reason");
        error.name = "ModelStreamIncompleteError";
        throw error;
      }
      yield {
        streamComplete: true,
        completionSource: receivedDoneMarker ? "done-marker" : "finish-reason",
        finishReason: lastFinishReason
      };
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
    }
  }
};

export {
  Usage,
  pickPrimaryBalance,
  DeepSeekClient
};
//# sourceMappingURL=chunk-2KDUS647.js.map
