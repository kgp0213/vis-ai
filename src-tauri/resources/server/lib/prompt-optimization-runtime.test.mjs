import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyPromptOptimizationInput,
  createPromptOptimizationRuntime,
  extractProtectedPromptFacts,
} from "./prompt-optimization-runtime.mjs";

function createHarness(overrides = {}) {
  const requests = [];
  const audits = [];
  const runtime = createPromptOptimizationRuntime({
    requestModelText: async (request) => {
      requests.push(request);
      return overrides.response ?? request.messages.at(-1).content;
    },
    getModelContext: () => ({
      mode: "general",
      providerId: "provider-a",
      model: "model-a",
      providerCapabilities: { maxOutputTokens: 4096 },
    }),
    isTaskBusy: () => false,
    slashCommands: [{ name: "new", aliases: ["n"] }, { name: "help", aliases: ["?"] }],
    audit: (entry) => audits.push(entry),
    timeoutMs: 5_000,
    ...overrides,
  });
  return { runtime, requests, audits };
}

describe("prompt optimization runtime", () => {
  test("classifies registered commands and preserves a leading Skill invocation", () => {
    assert.deepEqual(classifyPromptOptimizationInput("/new", {
      slashCommands: [{ name: "new", aliases: ["n"] }],
    }).kind, "command");
    assert.equal(classifyPromptOptimizationInput("/?", {
      slashCommands: [{ name: "help", aliases: ["?"] }],
    }).kind, "command");
    assert.equal(classifyPromptOptimizationInput("/unknown", {
      slashCommands: [{ name: "new" }],
    }).kind, "prompt");

    const skill = classifyPromptOptimizationInput("@pdf  转换 C:\\资料\\输入.pdf", { slashCommands: [] });
    assert.equal(skill.kind, "skill");
    assert.equal(skill.prefix, "@pdf  ");
    assert.equal(skill.body, "转换 C:\\资料\\输入.pdf");
    assert.equal(classifyPromptOptimizationInput("@pdf   ", { slashCommands: [] }).kind, "empty_skill");
  });

  test("extracts paths, URLs, numbers, dates and quoted names as protected facts", () => {
    const values = extractProtectedPromptFacts(
      '在 2026-07-29 前处理 C:\\Data\\report.pdf 和 https://example.com/a?id=7，保留“Visionox Whale”，输出 12.5%。',
    ).map((fact) => `${fact.kind}:${fact.value}`);
    assert.ok(values.includes("date:2026-07-29"));
    assert.ok(values.includes("path:C:\\Data\\report.pdf"));
    assert.ok(values.includes("url:https://example.com/a?id=7"));
    assert.ok(values.includes("quoted:Visionox Whale"));
    assert.ok(values.includes("number:12.5%"));
  });

  test("sends only the current body and mode guidance, then restores the Skill prefix", async () => {
    const { runtime, requests, audits } = createHarness({
      response: "将 C:\\Data\\report.pdf 转换为 HTML，并验证输出。",
    });
    const result = await runtime.optimize({
      prompt: "@pdf 将 C:\\Data\\report.pdf 转换为html",
      requestId: "request-1",
      draftRevision: 4,
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].requestPurpose, "prompt-optimization");
    assert.equal(requests[0].messages.length, 2);
    assert.equal(requests[0].messages[1].content, "将 C:\\Data\\report.pdf 转换为html");
    assert.doesNotMatch(JSON.stringify(requests[0].messages), /session|attachment|workspace|credential/i);
    assert.equal(result.original, "@pdf 将 C:\\Data\\report.pdf 转换为html");
    assert.equal(result.optimized, "@pdf 将 C:\\Data\\report.pdf 转换为 HTML，并验证输出。");
    assert.equal(result.requestId, "request-1");
    assert.equal(result.draftRevision, 4);
    assert.equal(result.unchanged, false);
    assert.equal(audits.length, 1);
    assert.deepEqual(Object.keys(audits[0].payload).sort(), [
      "durationMs", "inputLength", "model", "outputLength", "providerId", "requestId", "status",
    ]);
    assert.doesNotMatch(JSON.stringify(audits), /report\.pdf|转换为html/);
  });

  test("rejects commands, empty Skill bodies, empty input and oversized input before model access", async () => {
    const { runtime, requests } = createHarness();
    const cases = [
      ["/new", "prompt_optimization_command_unsupported"],
      ["@pdf  ", "prompt_optimization_skill_body_required"],
      ["   ", "prompt_optimization_empty"],
      ["x".repeat(20_001), "prompt_optimization_too_long"],
    ];
    for (let index = 0; index < cases.length; index += 1) {
      await assert.rejects(
        runtime.optimize({ prompt: cases[index][0], requestId: `invalid-${index}`, draftRevision: index }),
        (error) => error.code === cases[index][1] && error.status === 400,
      );
    }
    assert.equal(requests.length, 0);
  });

  test("rejects an optimized response that changes a protected fact", async () => {
    const { runtime } = createHarness({
      response: '在 2026-08-01 前处理 C:\\Data\\other.pdf，输出 20%。',
    });
    await assert.rejects(
      runtime.optimize({
        prompt: '在 2026-07-29 前处理 C:\\Data\\report.pdf，输出 12.5%。',
        requestId: "fact-mismatch",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_fact_mismatch"
        && error.status === 422
        && Array.isArray(error.details?.missingFacts)
        && error.details.missingFacts.length >= 3,
    );
  });

  test("reuses the same request ID and rejects a different concurrent request", async () => {
    let release;
    let calls = 0;
    const { runtime } = createHarness({
      requestModelText: async () => {
        calls += 1;
        return new Promise((resolve) => { release = resolve; });
      },
    });
    const first = runtime.optimize({ prompt: "优化这句话", requestId: "same-id", draftRevision: 1 });
    const duplicate = runtime.optimize({ prompt: "不同正文也不能替换", requestId: "same-id", draftRevision: 99 });
    await assert.rejects(
      runtime.optimize({ prompt: "另一个请求", requestId: "other-id", draftRevision: 1 }),
      (error) => error.code === "prompt_optimization_request_busy" && error.status === 409,
    );
    release("优化这句话，使目标和验收标准更明确。");
    assert.deepEqual(await duplicate, await first);
    assert.equal((await runtime.optimize({ prompt: "再次变化", requestId: "same-id", draftRevision: 3 })).draftRevision, 1);
    assert.equal(calls, 1);
  });

  test("rejects optimization while the ordinary task is busy", async () => {
    const { runtime, requests } = createHarness({ isTaskBusy: () => true });
    await assert.rejects(
      runtime.optimize({ prompt: "优化", requestId: "task-busy", draftRevision: 1 }),
      (error) => error.code === "prompt_optimization_busy" && error.status === 409,
    );
    assert.equal(requests.length, 0);
  });

  test("cancels the active Provider request idempotently", async () => {
    const { runtime } = createHarness({
      requestModelText: ({ signal }) => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    });
    const pending = runtime.optimize({ prompt: "需要取消", requestId: "cancel-me", draftRevision: 1 });
    assert.deepEqual(runtime.cancel("cancel-me"), { requestId: "cancel-me", cancelled: true });
    assert.deepEqual(runtime.cancel("cancel-me"), { requestId: "cancel-me", cancelled: true });
    await assert.rejects(pending, (error) => error.code === "prompt_optimization_cancelled" && error.status === 499);
  });

  test("remembers cancellation that arrives before Provider admission", async () => {
    const { runtime, requests } = createHarness();
    assert.deepEqual(runtime.cancel("cancel-before-post"), {
      requestId: "cancel-before-post",
      cancelled: true,
    });
    assert.deepEqual(runtime.cancel("cancel-before-post"), {
      requestId: "cancel-before-post",
      cancelled: true,
    });

    await assert.rejects(
      runtime.optimize({ prompt: "不应进入模型", requestId: "cancel-before-post", draftRevision: 1 }),
      (error) => error.code === "prompt_optimization_cancelled" && error.status === 499,
    );
    assert.equal(requests.length, 0);
  });

  test("normalizes Provider failures without auditing prompt text or credentials", async () => {
    const providerError = new Error("Authorization: Bearer secret-token network failed");
    providerError.status = 429;
    const { runtime, audits } = createHarness({ requestModelText: async () => { throw providerError; } });
    await assert.rejects(
      runtime.optimize({ prompt: "敏感正文 api_key=raw-secret", requestId: "provider-failure", draftRevision: 1 }),
      (error) => error.code === "prompt_optimization_rate_limited"
        && error.status === 429
        && error.retryable === true,
    );
    const serialized = JSON.stringify(audits);
    assert.doesNotMatch(serialized, /敏感正文|raw-secret|secret-token/);
    assert.match(serialized, /prompt_optimization_rate_limited/);
  });

  test("limits requested output tokens to the Provider declared capacity", async () => {
    let request = null;
    const { runtime } = createHarness({
      getModelContext: () => ({
        mode: "general",
        providerId: "provider-small-output",
        model: "model-small-output",
        providerCapabilities: { maxOutputTokens: 640 },
      }),
      requestModelText: async (input) => {
        request = input;
        return "明确目标、限制条件和验收标准。";
      },
    });

    await runtime.optimize({
      prompt: "优化这段任务描述",
      requestId: "provider-output-capacity",
      draftRevision: 1,
    });

    assert.equal(request.maxTokens, 640);
  });

  test("classifies authentication, network, truncation and empty response failures", async () => {
    const cases = [
      {
        requestId: "auth-failure",
        createError: () => Object.assign(new Error("unauthorized"), { status: 401 }),
        code: "prompt_optimization_auth_failed",
        status: 401,
        retryable: false,
      },
      {
        requestId: "network-failure",
        createError: () => new Error("fetch failed: socket closed"),
        code: "prompt_optimization_network_failed",
        status: 502,
        retryable: true,
      },
      {
        requestId: "truncated-response",
        createError: () => new Error("incomplete output: finish reason: length"),
        code: "prompt_optimization_truncated",
        status: 502,
        retryable: true,
      },
    ];

    for (const item of cases) {
      const { runtime } = createHarness({
        requestModelText: async () => { throw item.createError(); },
      });
      await assert.rejects(
        runtime.optimize({ prompt: "优化任务描述", requestId: item.requestId, draftRevision: 1 }),
        (error) => error.code === item.code
          && error.status === item.status
          && error.retryable === item.retryable,
      );
    }

    const { runtime } = createHarness({ requestModelText: async () => "   " });
    await assert.rejects(
      runtime.optimize({ prompt: "优化任务描述", requestId: "empty-response", draftRevision: 1 }),
      (error) => error.code === "prompt_optimization_empty_response"
        && error.status === 502
        && error.retryable === true,
    );
  });

  test("aborts a Provider request when the optimization deadline expires", async () => {
    let observedSignal = null;
    const { runtime } = createHarness({
      timeoutMs: 100,
      requestModelText: ({ signal }) => {
        observedSignal = signal;
        return new Promise(() => {});
      },
    });

    await assert.rejects(
      runtime.optimize({ prompt: "优化任务描述", requestId: "provider-timeout", draftRevision: 1 }),
      (error) => error.code === "prompt_optimization_timeout"
        && error.status === 504
        && error.retryable === true,
    );
    assert.equal(observedSignal.aborted, true);
  });
});
