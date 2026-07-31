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
  test("classifies every leading slash token as a command and preserves a leading Skill invocation", () => {
    assert.deepEqual(classifyPromptOptimizationInput("/new", {
      slashCommands: [{ name: "new", aliases: ["n"] }],
    }).kind, "command");
    assert.equal(classifyPromptOptimizationInput("/?", {
      slashCommands: [{ name: "help", aliases: ["?"] }],
    }).kind, "command");
    assert.equal(classifyPromptOptimizationInput("/unknown", {
      slashCommands: [{ name: "new" }],
    }).kind, "command");

    const skill = classifyPromptOptimizationInput("@pdf  转换 C:\\资料\\输入.pdf", { slashCommands: [] });
    assert.equal(skill.kind, "skill");
    assert.equal(skill.prefix, "@pdf  ");
    assert.equal(skill.body, "转换 C:\\资料\\输入.pdf");
    assert.equal(classifyPromptOptimizationInput("@pdf   ", { slashCommands: [] }).kind, "empty_skill");
  });

  test("extracts paths, URLs, numbers, dates and quoted names as protected facts", () => {
    const values = extractProtectedPromptFacts(
      '在 2026-07-29 前处理 C:\\Data\\report.pdf 和 https://example.com/a?id=7，保留“Visionox Whale”，保留 Microsoft Office 产品名称，输出 12.5%。',
    ).map((fact) => `${fact.kind}:${fact.value}`);
    assert.ok(values.includes("date:2026-07-29"));
    assert.ok(values.includes("path:C:\\Data\\report.pdf"));
    assert.ok(values.includes("url:https://example.com/a?id=7"));
    assert.ok(values.includes("quoted:Visionox Whale"));
    assert.ok(values.includes("proper_name:Microsoft Office"));
    assert.ok(values.includes("number:12.5%"));
  });

  test("does not mistake English instruction words for an unquoted proper name", () => {
    const values = extractProtectedPromptFacts("Please Review this code and list risks. Keep the output concise.");
    assert.equal(values.some((fact) => fact.kind === "proper_name" && fact.value === "Please Review"), false);
    assert.equal(values.some((fact) => fact.kind === "proper_name" && fact.value === "the output concise"), false);
  });

  test("protects Windows paths with spaces plus POSIX and relative file paths", () => {
    const values = extractProtectedPromptFacts([
      "处理 C:\\My Documents\\report.pdf",
      "读取 /home/user/report.pdf",
      "比较 ./docs/current.md 和 ../archive/previous.md",
      "检查 .\\output\\result.json",
    ].join("；")).map((fact) => `${fact.kind}:${fact.value}`);

    assert.ok(values.includes("path:C:\\My Documents\\report.pdf"));
    assert.ok(values.includes("path:/home/user/report.pdf"));
    assert.ok(values.includes("path:./docs/current.md"));
    assert.ok(values.includes("path:../archive/previous.md"));
    assert.ok(values.includes("path:.\\output\\result.json"));
  });

  test("protects bare filenames, provider model identifiers and inline Skill mentions", () => {
    const values = extractProtectedPromptFacts(
      "使用 @pdf 处理 src/app.ts、README.md 和 launcher.mjs，再交给 local-qwen/qwen3.5-397b-a17b 或 deepseek-v4-flash。",
    ).map((fact) => `${fact.kind}:${fact.value}`);

    assert.ok(values.includes("protocol:@pdf"));
    assert.ok(values.includes("path:src/app.ts"));
    assert.ok(values.includes("path:README.md"));
    assert.ok(values.includes("path:launcher.mjs"));
    assert.ok(values.includes("identifier:local-qwen/qwen3.5-397b-a17b"));
    assert.ok(values.includes("identifier:deepseek-v4-flash"));
  });

  test("protects English external-send recipients", async () => {
    const facts = extractProtectedPromptFacts("Send the report to Alice.");
    assert.ok(facts.some((fact) => fact.kind === "recipient" && fact.value === "Alice"));

    const changed = createHarness({ response: "Send the report to Bob." }).runtime;
    await assert.rejects(
      changed.optimize({
        prompt: "Send the report to Alice.",
        requestId: "english-recipient-changed",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_fact_mismatch"
        && error.details?.missingFacts?.some((fact) => fact.value === "Alice")
        && error.details?.addedFacts?.some((fact) => fact.value === "Bob"),
    );
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
    assert.equal(requests[0].requestPurpose, "promptOptimization");
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

  test("allows case-only normalization of a protected proper name", async () => {
    const lowercased = createHarness({ response: "将报告转换为 html。" }).runtime;
    const lowercasedResult = await lowercased.optimize({
      prompt: "将报告转换为 HTML。",
      requestId: "proper-name-case-lower",
      draftRevision: 1,
    });
    assert.equal(lowercasedResult.optimized, "将报告转换为 html。");

    const uppercased = createHarness({ response: "将报告转换为 HTML。" }).runtime;
    const uppercasedResult = await uppercased.optimize({
      prompt: "将报告转换为 html。",
      requestId: "proper-name-case-upper",
      draftRevision: 1,
    });
    assert.equal(uppercasedResult.optimized, "将报告转换为 HTML。");

    const changed = createHarness({ response: "将报告转换为 XML。" }).runtime;
    await assert.rejects(
      changed.optimize({
        prompt: "将报告转换为 HTML。",
        requestId: "proper-name-case-changed",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_fact_mismatch",
    );
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

  test("rejects changed inline Skill mentions and newly invented facts", async () => {
    const changedSkill = createHarness({ response: "请使用 @officecli 转换文件。" }).runtime;
    await assert.rejects(
      changedSkill.optimize({
        prompt: "请使用 @pdf 转换文件。",
        requestId: "inline-skill-mismatch",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_fact_mismatch"
        && error.details?.missingFacts?.some((fact) => fact.value === "@pdf")
        && error.details?.addedFacts?.some((fact) => fact.value === "@officecli"),
    );

    const invented = createHarness({ response: "在 2026-08-01 前完成，并使用 React 19。" }).runtime;
    await assert.rejects(
      invented.optimize({
        prompt: "在 2026-08-01 前完成。",
        requestId: "invented-fact",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_fact_mismatch"
        && error.details?.addedFacts?.some((fact) => fact.value === "19"),
    );
  });

  test("preserves multiple inline Skill mentions in their exact order", async () => {
    const preserved = createHarness({ response: "请先使用 @pdf 提取内容，再使用 @officecli 核对表格。" }).runtime;
    const result = await preserved.optimize({
      prompt: "先用 @pdf 提取内容，再用 @officecli 核对表格。",
      requestId: "multiple-skills-preserved",
      draftRevision: 1,
    });
    assert.deepEqual(
      extractProtectedPromptFacts(result.optimized).filter((fact) => fact.kind === "protocol").map((fact) => fact.value),
      ["@pdf", "@officecli"],
    );

    const reordered = createHarness({ response: "先用 @officecli 核对表格，再用 @pdf 提取内容。" }).runtime;
    await assert.rejects(
      reordered.optimize({
        prompt: "先用 @pdf 提取内容，再用 @officecli 核对表格。",
        requestId: "multiple-skills-reordered",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_fact_mismatch"
        && error.details?.protocolOrderMismatch === true,
    );
  });

  test("rejects language changes and newly introduced side effects", async () => {
    const language = createHarness({ response: "Explain the proposal and list its acceptance criteria." }).runtime;
    await assert.rejects(
      language.optimize({ prompt: "请解释这个方案", requestId: "language-mismatch", draftRevision: 1 }),
      (error) => error.code === "prompt_optimization_language_mismatch"
        && error.status === 422
        && error.action === "keep_original",
    );

    const sideEffect = createHarness({ response: "执行该方案并将结果发送给所有联系人。" }).runtime;
    await assert.rejects(
      sideEffect.optimize({ prompt: "请解释这个方案", requestId: "side-effect-mismatch", draftRevision: 1 }),
      (error) => error.code === "prompt_optimization_side_effect_mismatch"
        && error.status === 422
        && error.action === "keep_original"
        && error.details?.introducedCategories?.includes("execution")
        && error.details?.introducedCategories?.includes("external_send"),
    );

    const allowed = createHarness({ response: "修复该问题并运行相关测试。" }).runtime;
    const result = await allowed.optimize({
      prompt: "修复这个问题并运行测试",
      requestId: "side-effect-preserved",
      draftRevision: 1,
    });
    assert.match(result.optimized, /修复该问题/u);
  });

  test("rejects removal or reversal of explicit side-effect prohibitions", async () => {
    const reversed = createHarness({ response: "分析方案后，执行部署并发送结果。" }).runtime;
    await assert.rejects(
      reversed.optimize({
        prompt: "只分析这个方案，不要执行部署，也不要发送任何结果。",
        requestId: "side-effect-negation-reversed",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_side_effect_mismatch"
        && error.status === 422
        && error.details?.reversedProhibitions?.includes("execution")
        && error.details?.reversedProhibitions?.includes("external_send"),
    );

    const removed = createHarness({ response: "只分析这个方案并列出风险。" }).runtime;
    await assert.rejects(
      removed.optimize({
        prompt: "只分析这个方案，不要部署。",
        requestId: "side-effect-prohibition-removed",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_side_effect_mismatch"
        && error.details?.removedProhibitions?.includes("execution"),
    );

    const preserved = createHarness({ response: "仅分析方案并列出风险，不得部署或发送结果。" }).runtime;
    const result = await preserved.optimize({
      prompt: "只分析这个方案，不要部署或发送结果。",
      requestId: "side-effect-prohibition-preserved",
      draftRevision: 1,
    });
    assert.match(result.optimized, /不得部署或发送/u);

    const mixedPolicy = createHarness({ response: "修改代码并运行测试，但不得部署。" }).runtime;
    const mixedResult = await mixedPolicy.optimize({
      prompt: "修改代码并运行测试，但不要部署。",
      requestId: "side-effect-mixed-policy",
      draftRevision: 1,
    });
    assert.match(mixedResult.optimized, /但不得部署/u);

    const positiveContrast = createHarness({ response: "需要构建并部署。" }).runtime;
    const positiveResult = await positiveContrast.optimize({
      prompt: "不仅要构建，还要部署。",
      requestId: "side-effect-positive-contrast",
      draftRevision: 1,
    });
    assert.match(positiveResult.optimized, /构建并部署/u);

    const swappedActions = createHarness({ response: "不要修改代码，但执行部署。" }).runtime;
    await assert.rejects(
      swappedActions.optimize({
        prompt: "不要部署，但可以修改代码。",
        requestId: "side-effect-action-polarity-swapped",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_side_effect_mismatch"
        && error.details?.introducedActions?.includes("execution:deploy")
        && error.details?.removedProhibitedActions?.includes("execution:deploy"),
    );

    for (const [requestId, prompt, response] of [
      ["side-effect-direct-negation", "仅分析，不执行部署。", "分析后执行部署。"],
      ["side-effect-pending-negation", "仅检查，未发送任何结果。", "检查后发送结果。"],
      ["side-effect-english-negation", "Analyze only; do not deploy or send results.", "Analyze, deploy, and send results."],
    ]) {
      const runtime = createHarness({ response }).runtime;
      await assert.rejects(
        runtime.optimize({ prompt, requestId, draftRevision: 1 }),
        (error) => error.code === "prompt_optimization_side_effect_mismatch",
      );
    }
  });

  test("rejects removal or reversal of explicitly requested actions and scope expansion", async () => {
    const removed = createHarness({ response: "只分析代码并列出风险。" }).runtime;
    await assert.rejects(
      removed.optimize({
        prompt: "修改代码并运行测试。",
        requestId: "requested-actions-removed",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_side_effect_mismatch"
        && error.details?.removedActions?.includes("execution:modify")
        && error.details?.removedActions?.includes("execution:run"),
    );

    const reversed = createHarness({ response: "不要部署这个版本。" }).runtime;
    await assert.rejects(
      reversed.optimize({
        prompt: "请部署这个版本。",
        requestId: "requested-action-reversed",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_side_effect_mismatch"
        && error.details?.reversedActions?.includes("execution:deploy"),
    );

    const expanded = createHarness({ response: "把报告发送给张三和所有联系人。" }).runtime;
    await assert.rejects(
      expanded.optimize({
        prompt: "把报告发送给张三。",
        requestId: "send-scope-expanded",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_side_effect_mismatch"
        && error.details?.introducedScope?.includes("universal"),
    );
  });

  test("rejects contradictory action policies and action-local scope movement", async () => {
    const contradictory = createHarness({ response: "Deploy the release, but do not deploy it." }).runtime;
    await assert.rejects(
      contradictory.optimize({
        prompt: "Deploy the release.",
        requestId: "contradictory-action-policy",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_side_effect_mismatch"
        && error.details?.introducedProhibitedActions?.includes("execution:deploy"),
    );

    const movedScope = createHarness({ response: "修改一个文件并部署到所有环境。" }).runtime;
    await assert.rejects(
      movedScope.optimize({
        prompt: "修改所有文件并部署到测试环境。",
        requestId: "action-scope-moved",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_side_effect_mismatch"
        && error.details?.introducedScopeBindings?.includes("authorized:execution:deploy:universal")
        && error.details?.removedScopeBindings?.includes("authorized:execution:modify:universal"),
    );
  });

  test("allows adjectival running and equivalent universal-scope wording", async () => {
    const running = createHarness({ response: "Review the active process." }).runtime;
    const runningResult = await running.optimize({
      prompt: "Review the running process.",
      requestId: "adjectival-running",
      draftRevision: 1,
    });
    assert.equal(runningResult.optimized, "Review the active process.");

    const scope = createHarness({ response: "Review every error." }).runtime;
    const scopeResult = await scope.optimize({
      prompt: "Review all errors.",
      requestId: "equivalent-universal-scope",
      draftRevision: 1,
    });
    assert.equal(scopeResult.optimized, "Review every error.");
  });

  test("rejects changes to an unquoted multi-word proper name", async () => {
    const { runtime } = createHarness({ response: "保留 Vision Whale 产品名称。" });
    await assert.rejects(
      runtime.optimize({
        prompt: "保留 Visionox Whale 产品名称。",
        requestId: "proper-name-mismatch",
        draftRevision: 1,
      }),
      (error) => error.code === "prompt_optimization_fact_mismatch"
        && error.details?.missingFacts?.some((fact) => fact.kind === "proper_name" && fact.value === "Visionox Whale"),
    );
  });

  test("allows ordinary English instruction wording to be rewritten", async () => {
    const { runtime } = createHarness({ response: "Make the output concise and clear." });
    const result = await runtime.optimize({
      prompt: "Keep the output concise.",
      requestId: "ordinary-english-instruction",
      draftRevision: 1,
    });
    assert.equal(result.optimized, "Make the output concise and clear.");
  });

  test("reuses the same request fingerprint and rejects request ID payload conflicts", async () => {
    let release;
    let calls = 0;
    const { runtime } = createHarness({
      requestModelText: async () => {
        calls += 1;
        return new Promise((resolve) => { release = resolve; });
      },
    });
    const first = runtime.optimize({ prompt: "优化这句话", requestId: "same-id", draftRevision: 1 });
    const duplicate = runtime.optimize({ prompt: "优化这句话", requestId: "same-id", draftRevision: 1 });
    const conflicting = runtime.optimize({ prompt: "不同正文不能复用", requestId: "same-id", draftRevision: 99 });
    await assert.rejects(
      runtime.optimize({ prompt: "另一个请求", requestId: "other-id", draftRevision: 1 }),
      (error) => error.code === "prompt_optimization_request_busy" && error.status === 409,
    );
    release("优化这句话，使目标和验收标准更明确。");
    assert.deepEqual(await duplicate, await first);
    await assert.rejects(
      conflicting,
      (error) => error.code === "prompt_optimization_idempotency_conflict" && error.status === 409,
    );
    await assert.rejects(
      runtime.optimize({ prompt: "再次变化", requestId: "same-id", draftRevision: 3 }),
      (error) => error.code === "prompt_optimization_idempotency_conflict" && error.status === 409,
    );
    assert.equal(calls, 1);
  });

  test("expires completed request results after the configured short-term TTL", async () => {
    let clock = 1_000;
    let calls = 0;
    const { runtime } = createHarness({
      now: () => clock,
      cacheTtlMs: 500,
      requestModelText: async ({ messages }) => {
        calls += 1;
        return messages.at(-1).content;
      },
    });

    const first = await runtime.optimize({ prompt: "优化任务", requestId: "ttl-request", draftRevision: 1 });
    clock += 499;
    const cached = await runtime.optimize({ prompt: "优化任务", requestId: "ttl-request", draftRevision: 1 });
    assert.deepEqual(cached, first);
    clock += 2;
    const refreshed = await runtime.optimize({ prompt: "重新优化任务", requestId: "ttl-request", draftRevision: 3 });
    assert.equal(refreshed.draftRevision, 3);
    assert.equal(calls, 2);
  });

  test("starts the completed-result TTL when a slow request settles", async () => {
    let clock = 1_000;
    let release;
    let calls = 0;
    const { runtime } = createHarness({
      now: () => clock,
      cacheTtlMs: 500,
      requestModelText: async ({ messages }) => {
        calls += 1;
        await new Promise((resolve) => { release = resolve; });
        return messages.at(-1).content;
      },
    });

    const pending = runtime.optimize({ prompt: "慢速优化任务", requestId: "slow-ttl-request", draftRevision: 1 });
    clock += 800;
    release();
    const first = await pending;
    clock += 499;
    assert.deepEqual(
      await runtime.optimize({ prompt: "慢速优化任务", requestId: "slow-ttl-request", draftRevision: 1 }),
      first,
    );
    assert.equal(calls, 1);
  });

  test("keeps at most 64 completed request results and evicts the oldest", async () => {
    let calls = 0;
    const { runtime } = createHarness({
      requestModelText: async ({ messages }) => {
        calls += 1;
        return messages.at(-1).content;
      },
    });

    for (let index = 0; index < 65; index += 1) {
      await runtime.optimize({ prompt: `第 ${index} 条`, requestId: `cache-${index}`, draftRevision: index });
    }
    assert.equal(runtime.snapshot().cached, 64);

    const repeated = await runtime.optimize({ prompt: "第 0 条", requestId: "cache-0", draftRevision: 100 });
    assert.equal(repeated.draftRevision, 100);
    assert.equal(calls, 66);
  });

  test("reports an already clear prompt as unchanged", async () => {
    const { runtime } = createHarness();
    const result = await runtime.optimize({
      prompt: "只分析方案并列出风险，不要执行。",
      requestId: "already-clear",
      draftRevision: 1,
    });
    assert.equal(result.unchanged, true);
    assert.equal(result.original, result.optimized);
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

  test("settles cancellation even when the Provider ignores AbortSignal", async () => {
    let calls = 0;
    const { runtime } = createHarness({
      requestModelText: async ({ messages }) => {
        calls += 1;
        if (calls === 1) return new Promise(() => {});
        return messages.at(-1).content;
      },
    });
    const pending = runtime.optimize({ prompt: "取消无响应模型", requestId: "cancel-ignored", draftRevision: 1 });
    assert.deepEqual(runtime.cancel("cancel-ignored"), { requestId: "cancel-ignored", cancelled: true });
    await assert.rejects(pending, (error) => error.code === "prompt_optimization_cancelled" && error.status === 499);
    assert.equal(runtime.snapshot().activeRequestId, null);

    const next = await runtime.optimize({ prompt: "新的优化任务", requestId: "after-cancel", draftRevision: 2 });
    assert.equal(next.original, "新的优化任务");
    assert.equal(calls, 2);
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
        requestId: "provider-service-failure",
        createError: () => Object.assign(new Error("provider unavailable"), { status: 503 }),
        code: "prompt_optimization_provider_failed",
        status: 503,
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
