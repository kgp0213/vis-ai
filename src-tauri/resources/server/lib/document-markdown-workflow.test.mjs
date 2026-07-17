import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createDocumentJobStore } from "./document-job-store.mjs";
import { createDocumentMarkdownManager } from "./document-markdown-workflow.mjs";

function faithful(units, model) {
  return units.map((unit) => `<!-- source-unit: ${unit.id} -->\n\n### ${unit.location}\n\n${unit.text}\n\nHandled by ${model}`).join("\n\n");
}

test("document workflow sends only failed batches to a healthy fallback and assembles summary before body", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-manager-"));
  const output = join(root, "result.md");
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const generated = [];
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.docx", readablePath: "manual.docx", documentKind: "word" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "b1", label: "section 1", units: [{ id: "u1", location: "paragraph 1", text: "Normal prose retained in full." }] });
        await onBatch({ id: "b2", label: "section 2", units: [{ id: "u2", location: "paragraph 2", text: "REGW 0xFF 0xAA\nREGW 0x6F 0x01\nVoltage 3.3V" }] });
        return { totalUnits: 2, sourceChars: 80, visualPending: 0 };
      },
      modelCandidates: () => [
        { providerId: "qwen", modelId: "qwen", role: "primary" },
        { providerId: "deepseek", modelId: "deepseek", role: "fallback" },
      ],
      probeModel: async (candidate) => candidate.providerId === "deepseek",
      generate: async ({ candidate, batch, purpose }) => {
        generated.push([candidate.providerId, batch.id, purpose]);
        if (purpose === "verification") return '{"pass":true,"issues":[]}';
        if (candidate.providerId === "qwen" && batch.id === "b2") {
          throw new Error("qwen request timed out");
        }
        return faithful(batch.units, candidate.modelId);
      },
      generateSummary: async () => "## 摘要\n\n完整技术内容已经按来源区块整理。",
      writeOutput: async ({ outputPath, content }) => { await import("node:fs/promises").then(({ writeFile }) => writeFile(outputPath, content, "utf8")); },
    });

    const accepted = await manager.start({ sourcePath: "manual.docx", outputPath: output });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    const markdown = await readFile(output, "utf8");
    assert.equal(job.status, "completed");
    assert.equal(job.qualityPassed, true);
    assert.equal(job.sourceAudit.assembly.passed, true);
    assert.match(job.batches[0].unitManifest[0].id, /^u1$/);
    assert.ok(generated.some(([provider, batch, purpose]) => provider === "deepseek" && batch === "b2" && purpose === "toolContinuation"));
    assert.ok(!generated.some(([provider, batch]) => provider === "deepseek" && batch === "b1"));
    assert.ok(job.modelHistory.some((attempt) => attempt.providerId === "qwen" && attempt.errors?.some((message) => /timed out/.test(message))));
    const metadata = await manager.getMetadata(accepted.id);
    assert.equal(metadata.model, "deepseek/deepseek");
    assert.equal(metadata.modelRole, "fallback");
    assert.ok(markdown.indexOf("## 摘要") < markdown.indexOf("source-unit: u1"));
    assert.match(markdown, /Handled by deepseek/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("context-only pages help generation but are never duplicated into the assembled body", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-context-"));
  const output = join(root, "result.md");
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let sawContext = false;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.pdf", readablePath: "manual.pdf", documentKind: "pdf" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({
          id: "pages-2",
          units: [{ id: "page-2", location: "PDF page 2", text: "Owned conclusion with voltage 3.3V." }],
          contextUnits: [{ id: "page-1", location: "PDF page 1", text: "Read-only setup:", contextRole: "before", contextOnly: true }],
        });
        return { totalUnits: 1, selectedPages: 1, processedPages: 1 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ messages, purpose }) => {
        if (purpose === "verification") return '{"pass":true,"issues":[]}';
        sawContext = messages.some((message) => typeof message.content === "string" && /boundary_context[\s\S]*page-1/.test(message.content));
        return "<!-- source-unit: page-1 -->\nRead-only setup\n\n<!-- source-unit: page-2 -->\nOwned conclusion with voltage 3.3V.";
      },
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async ({ outputPath, content }) => { await import("node:fs/promises").then(({ writeFile }) => writeFile(outputPath, content, "utf8")); },
    });

    const accepted = await manager.start({ sourcePath: "manual.pdf", outputPath: output, policy: { maxRetries: 0 } });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    const markdown = await readFile(output, "utf8");
    assert.equal(sawContext, true);
    assert.equal(job.status, "completed_with_warnings");
    assert.doesNotMatch(markdown, /source-unit: page-1/);
    assert.match(markdown, /source-unit: page-2/);
    assert.equal(job.sourceAudit.assembly.passed, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a compatibility-readable protected document stays on the managed background path", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-protected-"));
  const output = join(root, "protected.md");
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let preparedPath = null;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({
        ok: true,
        sourcePath: "D:\\资料\\受保护手册.pdf",
        readablePath: join(root, "readable-copy.pdf"),
        documentKind: "pdf",
        usedCompatibilityAdapter: true,
      }),
      processSourceBatches: async (prepared, { onBatch }) => {
        preparedPath = prepared.readablePath;
        await onBatch({ id: "pages-1", units: [{ id: "page-1", location: "PDF page 1", text: "Protected source content." }] });
        return { totalUnits: 1, selectedPages: 1, processedPages: 1 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch, purpose }) => purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen"),
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async ({ outputPath, content }) => { await import("node:fs/promises").then(({ writeFile }) => writeFile(outputPath, content, "utf8")); },
    });

    const accepted = await manager.start({ sourcePath: "D:\\资料\\受保护手册.pdf", outputPath: output });
    await manager.wait(accepted.id);
    assert.equal(preparedPath, join(root, "readable-copy.pdf"));
    assert.equal((await store.read(accepted.id)).status, "completed");
    assert.match(await readFile(output, "utf8"), /Protected source content/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unrecoverable model output keeps source text, marks degraded quality, and can pause then resume", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-fallback-"));
  const output = join(root, "result.md");
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let releaseForeground;
    let foregroundBusy = true;
    const manager = createDocumentMarkdownManager({
      store,
      foregroundPollMs: 5,
      isForegroundBusy: () => foregroundBusy,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.html", readablePath: "manual.html", documentKind: "html" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "b1", label: "section", units: [{ id: "html-1", location: "section 1", text: "Critical warning: never exceed 5V. REGW 0xAA 0x01" }] });
        return { totalUnits: 1, sourceChars: 52, visualPending: 0 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      probeModel: async () => false,
      generate: async ({ purpose }) => purpose === "verification" ? '{"pass":true,"issues":[]}' : "generic summary",
      generateSummary: async () => "## 摘要\n\n存在需要复核的区块。",
      writeOutput: async ({ outputPath, content }) => { await import("node:fs/promises").then(({ writeFile }) => writeFile(outputPath, content, "utf8")); },
      onWaitingForForeground: () => { releaseForeground = () => { foregroundBusy = false; }; },
    });

    const accepted = await manager.start({ sourcePath: "manual.html", outputPath: output });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal((await store.read(accepted.id)).status, "waiting_foreground");
    releaseForeground();
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    assert.equal(job.status, "completed_with_warnings", job.error);
    const markdown = await readFile(output, "utf8");
    assert.equal(job.qualityPassed, false);
    assert.match(markdown, /Critical warning: never exceed 5V/);
    assert.match(markdown, /需要复核/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a queued document job can be cancelled without leaking its completion", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-cancel-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let releaseFirst;
    let markFirstStarted;
    const firstStarted = new Promise((resolve) => { markFirstStarted = resolve; });
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    let extractionCalls = 0;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async (sourcePath) => ({ ok: true, sourcePath, readablePath: sourcePath, documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        extractionCalls++;
        if (extractionCalls === 1) {
          markFirstStarted();
          await firstGate;
        }
        await onBatch({ id: "b1", units: [{ id: "u1", location: "section", text: "Complete source text." }] });
        return { totalUnits: 1 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch, purpose }) => purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen"),
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async () => {},
    });

    const first = await manager.start({ sourcePath: "first.md", outputPath: join(root, "first-output.md") });
    await firstStarted;
    const second = await manager.start({ sourcePath: "second.md", outputPath: join(root, "second-output.md") });
    const cancelled = await manager.control(second.id, "cancel");
    assert.equal(cancelled.cancelled, true);
    assert.equal((await manager.wait(second.id)).status, "cancelled");
    assert.equal(extractionCalls, 1);

    releaseFirst();
    await manager.wait(first.id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resuming after restart preserves the original workspace output boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-resume-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const job = await store.create({
      sourcePath: "manual.html",
      outputPath: join(root, "result.md"),
      pages: "2-4",
      workspaceRoot: root,
      allowOutsideWorkspace: false,
      contract: { fidelity: "complete-with-summary", format: "html" },
      policy: { batchInputTokens: 3000 },
    });
    await store.update(job.id, { status: "interrupted", paused: true });
    let written = null;
    let restoredPages = null;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.html", readablePath: "manual.html", documentKind: "html" }),
      processSourceBatches: async (_prepared, { onBatch, pages }) => {
        restoredPages = pages;
        await onBatch({ id: "b1", units: [{ id: "u1", location: "section", text: "Complete source text." }] });
        return { totalUnits: 1 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch, purpose }) => purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen"),
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async (payload) => { written = payload; },
    });

    await manager.resume(job.id);
    await manager.wait(job.id);
    assert.equal(written.workspaceRoot, root);
    assert.equal(written.allowOutsideWorkspace, false);
    assert.equal(restoredPages, "2-4");
    assert.equal((await store.read(job.id)).status, "completed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("visual source units move to a multimodal fallback and stay pending without an image", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-multimodal-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const calls = [];
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "deck.pptx", readablePath: "deck.pptx", documentKind: "presentation" }),
      processSourceBatches: async (_prepared, { onBatch, captureVisuals }) => {
        assert.equal(captureVisuals, true);
        await onBatch({
          id: "b1",
          units: [{ id: "visual-1", location: "slide 1 chart", text: "Yield chart", visualPending: true, visualDataUrl: "data:image/png;base64,iVBORw0KGgo=" }],
        });
        return { totalUnits: 1, visualPending: 1 };
      },
      modelCandidates: () => [
        { providerId: "qwen", modelId: "qwen", role: "primary", multimodal: false },
        { providerId: "vision", modelId: "vision", role: "fallback", multimodal: true },
      ],
      probeModel: async () => true,
      generate: async ({ candidate, batch, messages, purpose }) => {
        calls.push({ provider: candidate.providerId, purpose, hasImage: messages.some((message) => Array.isArray(message.content) && message.content.some((part) => part.type === "image_url")) });
        if (purpose === "verification") return '{"pass":true,"issues":[]}';
        return faithful(batch.units, candidate.modelId);
      },
      generateSummary: async () => "## 摘要\n\nChart reviewed.",
      writeOutput: async () => {},
    });

    const accepted = await manager.start({ sourcePath: "deck.pptx", outputPath: join(root, "deck.md") });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    assert.equal(job.status, "completed");
    assert.ok(calls.some((call) => call.provider === "qwen" && call.hasImage === false));
    assert.ok(calls.some((call) => call.provider === "vision" && call.purpose === "toolContinuation" && call.hasImage === true));
    assert.ok(calls.some((call) => call.provider === "vision" && call.purpose === "verification" && call.hasImage === true));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a text-only model keeps a faithful draft for review when no visual fallback is available", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-text-visual-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.pdf", readablePath: "manual.pdf", documentKind: "pdf" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({
          id: "pages-1",
          units: [{ id: "page-1", location: "PDF page 1", text: "Complete extracted text with voltage 3.3V.", visualPending: true }],
        });
        return { totalUnits: 1, selectedPages: 1, processedPages: 1 };
      },
      modelCandidates: () => [{ providerId: "deepseek", modelId: "deepseek", role: "primary", multimodal: false }],
      generate: async ({ batch }) => faithful(batch.units, "deepseek"),
      generateSummary: async () => "## 摘要\n\nText retained; visual review remains pending.",
      writeOutput: async () => {},
    });

    const accepted = await manager.start({ sourcePath: "manual.pdf", outputPath: join(root, "result.md") });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    const section = await store.readSection(accepted.id, "pages-1");
    assert.equal(job.status, "completed_with_warnings");
    assert.equal(job.batches[0].providerId, "deepseek");
    assert.match(section, /Handled by deepseek/);
    assert.doesNotMatch(section, /模型整理和备用模型修复均未通过质量检查/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("large document summaries are reduced hierarchically instead of one oversized request", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-summary-tree-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const summaryCalls = [];
    const manager = createDocumentMarkdownManager({
      store,
      countTokens: (text) => String(text).length,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        for (let index = 1; index <= 12; index++) {
          await onBatch({ id: `b${index}`, index, units: [{ id: `u${index}`, location: `section ${index}`, text: `Section ${index} ${"detail ".repeat(24)}` }] });
        }
        return { totalUnits: 12 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch, purpose }) => purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen"),
      generateSummary: async ({ sectionSummaries }) => {
        summaryCalls.push(sectionSummaries);
        return `## 摘要\n\n汇总了 ${sectionSummaries.length} 个分段。`;
      },
      writeOutput: async () => {},
    });

    const accepted = await manager.start({
      sourcePath: "manual.md",
      outputPath: join(root, "result.md"),
      policy: { batchInputTokens: 1024, maxUnitsPerBatch: 1 },
    });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    assert.equal(job.status, "completed", job.error);
    assert.ok(summaryCalls.length > 1, `expected hierarchical summary calls, received ${summaryCalls.length}`);
    assert.ok(summaryCalls.every((notes) => notes.reduce((sum, note) => sum + note.length, 0) <= 1300));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fallback weak-model policy constrains extraction even when the primary model has no document policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-policy-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let receivedPolicy = null;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.pdf", readablePath: "manual.pdf", documentKind: "pdf" }),
      processSourceBatches: async (_prepared, { policy, onPlan, onBatch }) => {
        receivedPolicy = policy;
        await onPlan({ totalUnits: 1, totalBatches: 1, unitLabel: "页" });
        await onBatch({ id: "pages-1", units: [{ id: "page-1", location: "PDF page 1", text: "Complete source text." }] });
        return { totalUnits: 1, selectedPages: 1, processedPages: 1 };
      },
      modelCandidates: () => [
        { providerId: "deepseek", modelId: "deepseek", role: "primary" },
        { providerId: "qwen", modelId: "qwen", role: "fallback", documentPolicy: { batchInputTokens: 3000, maxUnitsPerBatch: 8 } },
      ],
      probeModel: async () => true,
      generate: async ({ batch, purpose }) => purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "deepseek"),
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async () => {},
    });

    const accepted = await manager.start({ sourcePath: "manual.pdf", outputPath: join(root, "result.md") });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    assert.equal(receivedPolicy.batchInputTokens, 3000);
    assert.equal(receivedPolicy.maxUnitsPerBatch, 8);
    assert.equal(job.policy.batchInputTokens, 3000);
    assert.equal(job.policyTrace.effective.batchInputTokens, 3000);
    assert.equal(job.policyTrace.candidates.find((candidate) => candidate.providerId === "qwen").hasDocumentPolicy, true);
    assert.ok((await store.readEvents(job.id)).some((event) => event.type === "policy-selected" && event.effective.batchInputTokens === 3000));
    assert.equal(job.progress.totalUnits, 1);
    assert.equal(job.progress.unitLabel, "页");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a non-retryable provider request error disables that model for the rest of the job", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-provider-disable-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const calls = [];
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.pdf", readablePath: "manual.pdf", documentKind: "pdf" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        for (let index = 1; index <= 2; index++) {
          await onBatch({ id: `pages-${index}`, index, units: [{ id: `page-${index}`, location: `PDF page ${index}`, text: `Complete source page ${index}.` }] });
        }
        return { totalUnits: 2, selectedPages: 2, processedPages: 2 };
      },
      modelCandidates: () => [
        { key: "deepseek", providerId: "deepseek", modelId: "deepseek", role: "primary", multimodal: true },
        { key: "qwen", providerId: "qwen", modelId: "qwen", role: "fallback", multimodal: true },
      ],
      probeModel: async () => true,
      generate: async ({ candidate, batch, purpose }) => {
        calls.push([candidate.providerId, batch.id, purpose]);
        if (candidate.providerId === "deepseek") {
          throw new Error('DeepSeek 400: unknown variant "image_url", expected "text"');
        }
        return purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen");
      },
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async () => {},
    });

    const accepted = await manager.start({ sourcePath: "manual.pdf", outputPath: join(root, "result.md") });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    assert.equal(calls.filter(([provider]) => provider === "deepseek").length, 1);
    assert.equal(job.status, "completed");
    assert.equal(job.batches[0].attempts[0].attempts, 1);
    assert.equal(job.batches[0].attempts[0].disabledForJob, true);
    assert.ok(!job.batches[1].attempts.some((attempt) => attempt.providerId === "deepseek"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("command-retention failures do not recursively split a batch into individual units", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-no-command-split-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let generationCalls = 0;
    const units = Array.from({ length: 20 }, (_value, index) => ({
      id: `unit-${index + 1}`,
      location: `section ${index + 1}`,
      text: `${index % 2 ? "GET" : "SET"} setting_${index + 1} value_${index + 1}`,
    }));
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "batch-all", units });
        return { totalUnits: units.length };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch }) => {
        generationCalls++;
        return batch.units.map((unit) => `<!-- source-unit: ${unit.id} -->\n\nThis section preserves a detailed operational description for the configured setting.`).join("\n\n");
      },
      writeOutput: async () => {},
    });

    const accepted = await manager.start({
      sourcePath: "manual.md",
      outputPath: join(root, "result.md"),
      policy: { maxRetries: 0, maxSplitDepth: 6, maxModelCallsPerBatch: 100 },
    });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    assert.equal(generationCalls, 1);
    assert.equal(job.batches[0].attempts.length, 1);
    assert.equal(job.batches[0].status, "needs_review");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("recursive coverage repair obeys the configured split-depth limit", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-split-limit-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let generationCalls = 0;
    const units = Array.from({ length: 4 }, (_value, index) => ({ id: `u${index + 1}`, location: `unit ${index + 1}`, text: `Complete source ${index + 1}.` }));
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => { await onBatch({ id: "b1", units }); return { totalUnits: 4 }; },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async () => { generationCalls++; return "content without source markers but long enough to remain a draft"; },
      writeOutput: async () => {},
    });
    const accepted = await manager.start({
      sourcePath: "manual.md",
      outputPath: join(root, "result.md"),
      policy: { maxRetries: 0, maxSplitDepth: 1, maxModelCallsPerBatch: 24 },
    });
    await manager.wait(accepted.id);
    assert.equal(generationCalls, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unfinished document jobs expose saved sections for preview", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-partial-preview-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const job = await store.create({ sourcePath: "manual.pdf", outputPath: join(root, "manual.md") });
    await store.writeSection(job.id, "pages-1-2", "<!-- source-unit: page-1 -->\nSaved page one");
    await store.update(job.id, {
      status: "running",
      running: true,
      batches: [{ id: "pages-1-2", index: 1, status: "completed", sectionId: "pages-1-2", unitIds: ["page-1"] }],
      progress: { completedUnits: 1, totalUnits: 2 },
    });
    const manager = createDocumentMarkdownManager({
      store,
      prepareDocument: async () => ({ ok: false }),
      processSourceBatches: async () => ({}),
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async () => "",
      writeOutput: async () => {},
    });
    const metadata = await manager.getMetadata(`document:${job.id}`);
    assert.equal(metadata.previewAvailable, true);
    assert.equal(metadata.preview.partial, true);
    assert.match(metadata.preview.content, /Saved page one/);
    assert.match(metadata.preview.content, /中间预览/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resume adopts a durable batch checkpoint instead of calling the model again", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-checkpoint-resume-"));
  const output = join(root, "result.md");
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const job = await store.create({
      sourcePath: "manual.pdf",
      outputPath: output,
      workspaceRoot: root,
      contract: { fidelity: "complete-with-summary", format: "pdf" },
    });
    const content = "<!-- source-unit: page-1 -->\n\nComplete source text.";
    await store.writeBatchCheckpoint(job.id, {
      id: "pages-1",
      index: 1,
      label: "PDF pages 1",
      unitIds: ["page-1"],
      unitManifest: [{ id: "page-1", location: "PDF page 1", chars: 21, sourceHash: "source-hash" }],
      status: "completed",
      sectionId: "pages-1",
      providerId: "qwen",
      modelId: "qwen",
      modelRole: "primary",
      quality: { passed: true, failures: [] },
      review: { pass: true, issues: [] },
      attempts: [],
      modelCalls: 2,
      sectionChars: content.length,
    }, content);
    await store.update(job.id, { status: "interrupted", paused: true });
    let generationCalls = 0;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.pdf", readablePath: "manual.pdf", documentKind: "pdf" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "pages-1", label: "PDF pages 1", units: [{ id: "page-1", location: "PDF page 1", text: "Complete source text.", sourceHash: "source-hash" }] });
        return { totalUnits: 1, selectedPages: 1, processedPages: 1 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async () => { generationCalls++; return "unexpected"; },
      generateSummary: async () => "## 摘要\n\nRecovered.",
      writeOutput: async ({ content: markdown }) => { await import("node:fs/promises").then(({ writeFile }) => writeFile(output, markdown, "utf8")); },
    });

    await manager.resume(job.id);
    await manager.wait(job.id);
    assert.equal(generationCalls, 0);
    assert.equal((await store.read(job.id)).status, "completed");
    assert.match(await readFile(output, "utf8"), /Complete source text/);
    assert.ok((await store.readEvents(job.id)).some((event) => event.type === "batch-recovered" && event.source === "checkpoint"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resume rejects a checkpoint when the source hash changed", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-stale-checkpoint-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const job = await store.create({
      sourcePath: "manual.md",
      outputPath: join(root, "result.md"),
      workspaceRoot: root,
      contract: { fidelity: "complete-with-summary", format: "markdown" },
    });
    await store.writeBatchCheckpoint(job.id, {
      id: "b1",
      index: 1,
      label: "section",
      unitIds: ["u1"],
      unitManifest: [{ id: "u1", location: "section", chars: 16, sourceHash: "old-hash" }],
      status: "completed",
      sectionId: "b1",
      providerId: "qwen",
      modelId: "qwen",
      modelRole: "primary",
      quality: { passed: true, failures: [] },
      attempts: [],
      sectionChars: 40,
    }, "<!-- source-unit: u1 -->\n\nOld source text.");
    await store.update(job.id, { status: "interrupted", paused: true });
    let generationCalls = 0;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "b1", label: "section", units: [{ id: "u1", location: "section", text: "New complete source text.", sourceHash: "new-hash" }] });
        return { totalUnits: 1 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch, purpose }) => {
        generationCalls++;
        return purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen");
      },
      generateSummary: async () => "## 摘要\n\nUpdated.",
      writeOutput: async () => {},
    });

    await manager.resume(job.id);
    await manager.wait(job.id);
    assert.equal(generationCalls, 2);
    assert.match(await store.readSection(job.id, "b1"), /New complete source text/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resume conservatively registers a valid orphan section for review", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-orphan-resume-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const job = await store.create({
      sourcePath: "manual.pdf",
      outputPath: join(root, "result.md"),
      workspaceRoot: root,
      contract: { fidelity: "complete-with-summary", format: "pdf" },
    });
    await store.writeSection(job.id, "pages-1", "<!-- source-unit: page-1 -->\n\nComplete source text retained in full.");
    await store.update(job.id, { status: "interrupted", paused: true });
    let generationCalls = 0;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.pdf", readablePath: "manual.pdf", documentKind: "pdf" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "pages-1", label: "PDF pages 1", units: [{ id: "page-1", location: "PDF page 1", text: "Complete source text retained in full." }] });
        return { totalUnits: 1, selectedPages: 1, processedPages: 1 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async () => { generationCalls++; return "unexpected"; },
      generateSummary: async () => "## 摘要\n\nRecovered with review warning.",
      writeOutput: async () => {},
    });

    await manager.resume(job.id);
    await manager.wait(job.id);
    const restored = await store.read(job.id);
    assert.equal(generationCalls, 0);
    assert.equal(restored.status, "completed_with_warnings");
    assert.equal(restored.batches[0].modelRole, "recovered");
    assert.ok((await store.readEvents(job.id)).some((event) => event.type === "batch-recovered" && event.source === "orphan-section"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a failed best-effort progress heartbeat cannot terminate the document worker", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-progress-failure-"));
  try {
    const baseStore = createDocumentJobStore(join(root, "jobs"));
    let rejectDraftProgress = true;
    const store = {
      ...baseStore,
      update: async (id, changes) => {
        if (rejectDraftProgress && changes?.progress?.stage === "draft") {
          rejectDraftProgress = false;
          throw Object.assign(new Error("temporary manifest lock"), { code: "EPERM" });
        }
        return baseStore.update(id, changes);
      },
    };
    const persistenceErrors = [];
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "b1", units: [{ id: "u1", location: "section", text: "Complete source text." }] });
        return { totalUnits: 1 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch, purpose }) => purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen"),
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async () => {},
      onPersistenceError: (error) => {
        persistenceErrors.push(error.code);
        throw new Error("diagnostic sink failure");
      },
    });

    const accepted = await manager.start({ sourcePath: "manual.md", outputPath: join(root, "result.md") });
    await manager.wait(accepted.id);
    assert.equal((await baseStore.read(accepted.id)).status, "completed");
    assert.deepEqual(persistenceErrors, ["EPERM"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
