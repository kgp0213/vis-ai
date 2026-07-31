import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { readFileSync } from "node:fs";

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const TOKEN = "prompt-optimization-test-token";
const launcherSource = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");

function mockRes() {
  let status = null;
  let body = null;
  return {
    writeHead(value) { status = value; },
    end(value) { body = value; },
    get status() { return status; },
    get json() { return body ? JSON.parse(body) : null; },
  };
}

async function apiPost(body, overrides = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.url = "/api/optimize-prompt";
  req.method = "POST";
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  const res = mockRes();
  await dispatch(req, res, { ...overrides }, TOKEN);
  return res;
}

async function apiDelete(requestId, overrides = {}) {
  const req = Readable.from([]);
  req.url = `/api/optimize-prompt/${encodeURIComponent(requestId)}`;
  req.method = "DELETE";
  req.headers = { "x-reasonix-token": TOKEN };
  const res = mockRes();
  await dispatch(req, res, { ...overrides }, TOKEN);
  return res;
}

describe("prompt optimization API", () => {
  test("launcher delegates editor requests to the isolated optimization runtime", () => {
    assert.match(launcherSource, /importEarly\("\.\/lib\/prompt-optimization-runtime\.mjs"\)/);
    assert.match(launcherSource, /createPromptOptimizationRuntime\(\{/);
    assert.match(launcherSource, /requestModelText,/);
    assert.match(launcherSource, /requestConfiguration:\s*resolveProviderModelRequest\([\s\S]{0,180}purpose:\s*"promptOptimization"/u);
    assert.match(launcherSource, /isTaskBusy:\s*\(\)\s*=>\s*busy/);
    assert.match(launcherSource, /optimizePrompt:\s*\(input\)\s*=>\s*promptOptimizationRuntime\.optimize\(input\)/);
    assert.match(launcherSource, /cancelPromptOptimization:\s*\(requestId\)\s*=>\s*promptOptimizationRuntime\.cancel\(requestId\)/);
  });

  test("returns a revision-scoped preview without submitting a conversation turn", async () => {
    let received = null;
    let submitted = false;
    const res = await apiPost({ prompt: "  帮我处理这个文件  ", requestId: "request-preview", draftRevision: 7 }, {
      optimizePrompt: async (input) => {
        received = input;
        return {
          requestId: input.requestId,
          draftRevision: input.draftRevision,
          original: input.prompt,
          optimized: "读取指定文件，完整处理其内容，并在交付前验证输出。",
          warnings: [],
          protectedFacts: [],
          unchanged: false,
        };
      },
      submitPrompt: async () => {
        submitted = true;
        return { accepted: true };
      },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(received, { prompt: "  帮我处理这个文件  ", requestId: "request-preview", draftRevision: 7 });
    assert.deepEqual(res.json, {
      requestId: "request-preview",
      draftRevision: 7,
      original: "  帮我处理这个文件  ",
      optimized: "读取指定文件，完整处理其内容，并在交付前验证输出。",
      warnings: [],
      protectedFacts: [],
      unchanged: false,
    });
    assert.equal(submitted, false);
  });

  test("requires prompt, requestId and a non-negative draft revision", async () => {
    let called = false;
    for (const body of [
      { prompt: " ", requestId: "empty", draftRevision: 0 },
      { prompt: "有效", requestId: "", draftRevision: 0 },
      { prompt: "有效", requestId: "valid", draftRevision: -1 },
    ]) {
      const res = await apiPost(body, {
        optimizePrompt: async () => {
          called = true;
          return {};
        },
      });
      assert.equal(res.status, 400);
      assert.equal(typeof res.json.code, "string");
      assert.equal(typeof res.json.message, "string");
      assert.equal(typeof res.json.retryable, "boolean");
    }
    assert.equal(called, false);
  });

  test("preserves structured runtime failures and their HTTP status", async () => {
    const res = await apiPost({ prompt: "帮我优化这段提示词", requestId: "rate-limited", draftRevision: 1 }, {
      optimizePrompt: async () => {
        const error = new Error("模型服务当前请求过多。");
        error.code = "prompt_optimization_rate_limited";
        error.status = 429;
        error.title = "提示词优化失败";
        error.retryable = true;
        error.action = "retry_later";
        error.details = { requestId: "rate-limited" };
        throw error;
      },
    });
    assert.equal(res.status, 429);
    assert.equal(res.json.code, "prompt_optimization_rate_limited");
    assert.equal(res.json.retryable, true);
    assert.equal(res.json.action, "retry_later");
    assert.deepEqual(res.json.details, { requestId: "rate-limited" });
  });

  test("cancels an optimization request through the idempotent DELETE route", async () => {
    const cancelled = [];
    const first = await apiDelete("cancel-me", {
      cancelPromptOptimization: (requestId) => {
        cancelled.push(requestId);
        return { requestId, cancelled: true };
      },
    });
    assert.equal(first.status, 200);
    assert.deepEqual(first.json, { requestId: "cancel-me", cancelled: true });
    assert.deepEqual(cancelled, ["cancel-me"]);
  });

  test("rejects an invalid cancellation request ID before invoking the runtime", async () => {
    let called = false;
    const res = await apiDelete("bad request id", {
      cancelPromptOptimization: () => {
        called = true;
        return { cancelled: true };
      },
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.code, "prompt_optimization_request_id_invalid");
    assert.equal(called, false);
  });

  test("rejects a runtime response whose original prompt does not match the request", async () => {
    const res = await apiPost({ prompt: "当前正文", requestId: "original-mismatch", draftRevision: 2 }, {
      optimizePrompt: async ({ requestId, draftRevision }) => ({
        requestId,
        draftRevision,
        original: "其他正文",
        optimized: "错误结果",
        warnings: [],
        protectedFacts: [],
        unchanged: false,
      }),
    });
    assert.equal(res.status, 502);
    assert.equal(res.json.code, "prompt_optimization_response_invalid");
  });

  test("keeps the vendored route thin and never audits prompt bodies", async () => {
    const auditEntries = [];
    const res = await apiPost({ prompt: "secret prompt body", requestId: "thin-route", draftRevision: 1 }, {
      optimizePrompt: async ({ prompt, requestId, draftRevision }) => ({
        requestId,
        draftRevision,
        original: prompt,
        optimized: prompt,
        warnings: [],
        protectedFacts: [],
        unchanged: true,
      }),
      audit: (entry) => auditEntries.push(entry),
    });
    assert.equal(res.status, 200);
    assert.equal(auditEntries.length, 0);
  });
});
