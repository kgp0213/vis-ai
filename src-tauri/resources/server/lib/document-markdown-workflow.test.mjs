import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createDocumentJobStore } from "./document-job-store.mjs";
import { buildDocumentContract } from "./document-intelligence.mjs";
import {
  buildDocumentQualityWarnings,
  classifyDocumentModelError,
  createDocumentMarkdownManager,
  summarizeDocumentModelDiagnostics,
} from "./document-markdown-workflow.mjs";

function faithful(units, model) {
  return units.map((unit) => `<!-- source-unit: ${unit.id} -->\n\n### ${unit.location}\n\n${unit.text}\n\nHandled by ${model}`).join("\n\n");
}

test("model service errors expose stable user-facing categories", () => {
  const balance = classifyDocumentModelError("DeepSeek 403: {\"message\":\"Sorry, your account balance is insufficient\"}");
  assert.equal(balance.category, "insufficient_balance");
  assert.match(balance.message, /余额不足/);
  assert.equal(balance.requiresUserAction, true);

  const timeout = classifyDocumentModelError(new Error("The operation was aborted due to timeout"));
  assert.equal(timeout.category, "timeout");
  assert.equal(timeout.retryable, true);
});

test("model probe failures are persisted and surfaced in completed-with-warning metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-model-diagnostics-"));
  const output = join(root, "result.md");
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.pdf", readablePath: "manual.pdf", documentKind: "pdf" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "pages-1", label: "PDF pages 1", units: [{ id: "page-1", location: "PDF page 1", text: "Source content." }] });
        return { totalUnits: 1, selectedPages: 1, processedPages: 1 };
      },
      modelCandidates: () => [
        { providerId: "primary", modelId: "primary", role: "primary" },
        { providerId: "siliconflow-kimi", modelId: "kimi", role: "fallback" },
      ],
      probeModel: async (candidate) => candidate.role === "fallback"
        ? { ok: false, error: "DeepSeek 403: account balance is insufficient" }
        : { ok: true },
      generate: async () => { throw new Error("primary request timed out"); },
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async ({ outputPath, content }) => { await import("node:fs/promises").then(({ writeFile }) => writeFile(outputPath, content, "utf8")); },
    });

    const accepted = await manager.start({ sourcePath: "manual.pdf", outputPath: output, policy: { maxRetries: 0 } });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    assert.equal(job.status, "completed_with_warnings");
    assert.ok(job.modelDiagnostics.some((diagnostic) => diagnostic.category === "insufficient_balance"));
    assert.match(job.warnings.find((warning) => warning.type === "model-service-issue" && warning.category === "insufficient_balance")?.message || "", /余额不足/);
    const metadata = await manager.getMetadata(accepted.id);
    const balanceIssue = metadata.modelIssues.find((issue) => issue.category === "insufficient_balance");
    assert.ok(balanceIssue);
    assert.deepEqual(balanceIssue.affectedBatches.map((batch) => batch.id), ["pages-1"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fresh failed verification is skipped while a passed fallback avoids probing", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-persisted-verification-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const generatedBy = [];
    let probeCalls = 0;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "section-1", units: [{ id: "u1", location: "section 1", text: "Complete source content." }] });
        return { totalUnits: 1 };
      },
      modelCandidates: () => [
        {
          providerId: "unavailable-primary",
          modelId: "unavailable-primary",
          role: "primary",
          verificationStatus: "failed",
          verificationError: "401 Unauthorized",
          requiresProbe: false,
        },
        {
          providerId: "verified-fallback",
          modelId: "verified-fallback",
          role: "fallback",
          verificationStatus: "passed",
          requiresProbe: false,
        },
      ],
      probeModel: async () => { probeCalls++; return { ok: true }; },
      generate: async ({ candidate, batch, purpose }) => {
        if (purpose === "verification") return '{"pass":true,"issues":[]}';
        generatedBy.push(candidate.providerId);
        return faithful(batch.units, candidate.modelId);
      },
      writeOutput: async () => {},
    });

    const accepted = await manager.start({ sourcePath: "manual.md", outputPath: join(root, "result.md") });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    assert.equal(job.status, "completed", job.error);
    assert.deepEqual(generatedBy, ["verified-fallback"]);
    assert.equal(probeCalls, 0, "persisted verification results must not trigger a redundant network probe");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an untested primary model is probed only once for the whole execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-probe-once-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let probeCalls = 0;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "section-1", units: [{ id: "u1", location: "section 1", text: "First complete source section." }] });
        await onBatch({ id: "section-2", units: [{ id: "u2", location: "section 2", text: "Second complete source section." }] });
        return { totalUnits: 2 };
      },
      modelCandidates: () => [{
        providerId: "untested-primary",
        modelId: "untested-primary",
        role: "primary",
        verificationStatus: "untested",
        requiresProbe: true,
      }],
      probeModel: async () => { probeCalls++; return { ok: true }; },
      generate: async ({ batch, purpose }) => purpose === "verification"
        ? '{"pass":true,"issues":[]}'
        : faithful(batch.units, "untested-primary"),
      writeOutput: async () => {},
    });

    const accepted = await manager.start({ sourcePath: "manual.md", outputPath: join(root, "result.md") });
    await manager.wait(accepted.id);
    assert.equal((await store.read(accepted.id)).status, "completed");
    assert.equal(probeCalls, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("quality warning summaries keep visual review and model service causes distinct", () => {
  const warnings = buildDocumentQualityWarnings({
    batches: [{ id: "pages-1", label: "PDF pages 1", status: "needs_review", quality: { failures: [{ type: "visual-pending" }] } }],
    diagnostics: [{ providerId: "kimi", modelId: "k2", category: "insufficient_balance", message: "模型账户余额不足", action: "充值后重试", requiresUserAction: true, retryable: false, batchId: "pages-1", batchLabel: "PDF pages 1", occurrences: 1, technicalMessage: "balance is insufficient" }],
  });
  assert.ok(warnings.some((warning) => warning.type === "document-visual-review-pending"));
  assert.ok(warnings.some((warning) => warning.type === "model-service-issue" && /余额不足/.test(warning.message)));
  const grouped = summarizeDocumentModelDiagnostics([{ providerId: "kimi", modelId: "k2", category: "insufficient_balance", message: "余额不足", batchId: "pages-1", batchLabel: "PDF pages 1", occurrences: 1 }]);
  assert.equal(grouped[0].affectedBatches[0].label, "PDF pages 1");
});

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

test("document work yields the provider lane to scheduled tasks and resumes automatically", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-provider-lane-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let providerBusy = true;
    let waitingNotified = false;
    const manager = createDocumentMarkdownManager({
      store,
      foregroundPollMs: 5,
      isForegroundBusy: () => false,
      isProviderBusy: () => providerBusy,
      onWaitingForProvider: () => { waitingNotified = true; },
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "b1", units: [{ id: "u1", location: "section", text: "Complete source text." }] });
        return { totalUnits: 1 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch, purpose }) => purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen"),
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async () => {},
    });

    const accepted = await manager.start({ sourcePath: "manual.md", outputPath: join(root, "result.md") });
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal((await store.read(accepted.id)).status, "waiting_provider");
    assert.equal(waitingNotified, true);
    assert.equal(manager.activeCount(), 1);
    assert.equal(manager.isProviderBusy(), true);
    const listed = await manager.listMetadata();
    assert.equal(listed[0]?.documentJobId, accepted.id);
    providerBusy = false;
    await manager.wait(accepted.id);
    assert.equal((await store.read(accepted.id)).status, "completed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a queued document job can be stopped without losing its resumable record", async () => {
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
    const stopped = await manager.control(second.id, "stop");
    assert.equal(stopped.stopped, true);
    assert.equal((await manager.wait(second.id)).status, "stopped");
    assert.equal((await store.read(second.id)).paused, true);
    assert.equal(extractionCalls, 1);

    releaseFirst();
    await manager.wait(first.id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("abandon and delete-record are distinct and never remove source or final output files", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-lifecycle-"));
  const source = join(root, "source.md");
  const output = join(root, "output.md");
  try {
    await import("node:fs/promises").then(({ writeFile }) => Promise.all([
      writeFile(source, "source", "utf8"),
      writeFile(output, "output", "utf8"),
    ]));
    const store = createDocumentJobStore(join(root, "jobs"));
    const job = await store.create({ sourcePath: source, outputPath: output });
    await store.update(job.id, { status: "stopped", running: false, paused: true });
    const manager = createDocumentMarkdownManager({
      store,
      prepareDocument: async () => ({ ok: false }),
      processSourceBatches: async () => ({}),
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async () => "",
      writeOutput: async () => {},
    });

    const abandoned = await manager.control(job.id, "abandon");
    assert.equal(abandoned.abandoned, true);
    assert.equal((await store.read(job.id)).status, "abandoned");
    const deleted = await manager.control(job.id, "delete");
    assert.equal(deleted.deleted, true);
    await assert.rejects(() => store.read(job.id), /invalid document job manifest/);
    assert.equal(await readFile(source, "utf8"), "source");
    assert.equal(await readFile(output, "utf8"), "output");
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

test("fallback weak-model policy does not constrain primary extraction", async () => {
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
    assert.equal(receivedPolicy.batchInputTokens, 8000);
    assert.equal(receivedPolicy.maxUnitsPerBatch, 20);
    assert.equal(job.policy.batchInputTokens, 8000);
    assert.equal(job.policyTrace.effective.batchInputTokens, 8000);
    assert.equal(job.policyTrace.candidates.find((candidate) => candidate.providerId === "qwen").hasDocumentPolicy, true);
    assert.ok((await store.readEvents(job.id)).some((event) => event.type === "policy-selected" && event.effective.batchInputTokens === 8000));
    assert.equal(job.progress.totalUnits, 1);
    assert.equal(job.progress.unitLabel, "页");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an oversized failed primary batch is split only when handed to a weaker fallback", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-fallback-split-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const calls = [];
    const units = Array.from({ length: 12 }, (_value, index) => ({
      id: `u${index + 1}`,
      location: `section ${index + 1}`,
      text: `Complete source section ${index + 1}.`,
    }));
    const manager = createDocumentMarkdownManager({
      store,
      countTokens: (text) => Math.ceil(String(text).length / 4),
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { policy, onBatch }) => {
        assert.equal(policy.maxUnitsPerBatch, 20);
        await onBatch({ id: "batch-all", units });
        return { totalUnits: units.length };
      },
      modelCandidates: () => [
        { key: "strong", providerId: "strong", modelId: "strong", role: "primary" },
        { key: "weak", providerId: "weak", modelId: "weak", role: "fallback", documentPolicy: { batchInputTokens: 3000, maxUnitsPerBatch: 8 } },
      ],
      probeModel: async () => true,
      generate: async ({ candidate, batch, purpose }) => {
        calls.push({ provider: candidate.providerId, units: batch.units.length, purpose });
        if (candidate.providerId === "strong") throw new Error("temporary upstream failure");
        return purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "weak");
      },
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async () => {},
    });

    const accepted = await manager.start({
      sourcePath: "manual.md",
      outputPath: join(root, "result.md"),
      policy: { maxRetries: 0, maxSplitDepth: 3, maxModelCallsPerBatch: 24 },
    });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    assert.equal(job.status, "completed", job.error);
    assert.deepEqual(calls.filter((call) => call.provider === "strong").map((call) => call.units), [12]);
    assert.ok(calls.filter((call) => call.provider === "weak" && call.purpose !== "verification").every((call) => call.units <= 8));
    const events = await store.readEvents(job.id, 1000);
    assert.ok(events.some((event) => event.type === "fallback-batch-split" && event.providerId === "weak"));
    assert.equal(job.modelCallCount, calls.length + 1, "summary generation is included in the task-wide model call count");
    assert.equal(events.filter((event) => event.type === "model-call-started").length, job.modelCallCount);
    assert.equal(events.filter((event) => ["model-call-completed", "model-call-failed"].includes(event.type)).length, job.modelCallCount);
    assert.equal((await manager.getMetadata(job.id)).progress.taskModelCalls, job.modelCallCount);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("truncated model output splits immediately instead of retrying the same batch", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-truncated-split-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const draftCalls = [];
    const units = Array.from({ length: 4 }, (_value, index) => ({
      id: `u${index + 1}`,
      location: `section ${index + 1}`,
      text: `Complete source section ${index + 1} with value ${index + 1}.`,
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
      generate: async ({ batch, purpose, maxTokens }) => {
        if (purpose === "verification") return '{"pass":true,"issues":[]}';
        draftCalls.push({ batchId: batch.id, units: batch.units.length, maxTokens });
        if (batch.units.length > 1) {
          throw Object.assign(new Error("model output reached the configured limit and was truncated"), {
            name: "DocumentModelOutputTruncatedError",
            code: "output_truncated",
          });
        }
        return faithful(batch.units, "qwen");
      },
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async () => {},
    });

    const accepted = await manager.start({
      sourcePath: "manual.md",
      outputPath: join(root, "result.md"),
      policy: { maxRetries: 4, maxSplitDepth: 4, maxModelCallsPerBatch: 100 },
    });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    assert.equal(job.status, "completed", job.error);
    assert.equal(draftCalls.filter((call) => call.units === 4).length, 1, "the same truncated parent request must not be retried");
    assert.equal(draftCalls.filter((call) => call.units === 2).length, 2, "each truncated child is split once");
    assert.equal(draftCalls.filter((call) => call.units === 1).length, 4);
    assert.equal(job.batches[0].quality.split, true);
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

test("resume preserves model diagnostics and does not retry a model disabled by an earlier execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-disabled-resume-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let sourceRound = 1;
    let primaryDraftCalls = 0;
    let probeCalls = 0;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({
          id: `section-${sourceRound}`,
          units: [{ id: `u${sourceRound}`, location: `section ${sourceRound}`, text: `Complete source section ${sourceRound}.` }],
        });
        return { totalUnits: 1 };
      },
      modelCandidates: () => [
        {
          key: "primary-model",
          providerId: "primary",
          modelId: "primary",
          role: "primary",
          verificationStatus: "passed",
          requiresProbe: false,
        },
        {
          key: "fallback-model",
          providerId: "fallback",
          modelId: "fallback",
          role: "fallback",
          verificationStatus: "passed",
          requiresProbe: false,
        },
      ],
      probeModel: async () => { probeCalls++; return { ok: true }; },
      generate: async ({ candidate, batch, purpose }) => {
        if (candidate.providerId === "primary" && purpose !== "verification") {
          primaryDraftCalls++;
          throw new Error("401 Unauthorized: invalid API key");
        }
        return purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "fallback");
      },
      writeOutput: async () => {},
    });

    const accepted = await manager.start({ sourcePath: "manual.md", outputPath: join(root, "result.md") });
    await manager.wait(accepted.id);
    sourceRound = 2;
    await store.update(accepted.id, { status: "interrupted", running: false, paused: true });
    await manager.resume(accepted.id);
    await manager.wait(accepted.id);

    const resumed = await store.read(accepted.id);
    assert.equal(resumed.status, "completed", resumed.error);
    assert.equal(primaryDraftCalls, 1, "the disabled primary must not be retried after resume");
    assert.equal(probeCalls, 0, "persisted passed verification must remain sufficient after resume");
    assert.deepEqual(resumed.disabledCandidates, ["primary-model"]);
    assert.ok(resumed.modelDiagnostics.some((entry) => entry.providerId === "primary" && entry.category === "authentication"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a fresh passed verification clears an older verification circuit on resume", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-reverified-resume-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let sourceRound = 1;
    let verificationStatus = "failed";
    let primaryDraftCalls = 0;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({
          id: `section-${sourceRound}`,
          units: [{ id: `u${sourceRound}`, location: `section ${sourceRound}`, text: `Complete source section ${sourceRound}.` }],
        });
        return { totalUnits: 1 };
      },
      modelCandidates: () => [
        {
          key: "reverified-primary",
          configFingerprint: "stable-config",
          providerId: "primary",
          modelId: "primary",
          role: "primary",
          verificationStatus,
          verificationError: verificationStatus === "failed" ? "verification timed out" : null,
          verificationCheckedAt: verificationStatus === "failed" ? "2026-07-18T09:00:00.000Z" : "2026-07-18T10:00:00.000Z",
          requiresProbe: false,
        },
        {
          key: "verified-fallback",
          configFingerprint: "fallback-config",
          providerId: "fallback",
          modelId: "fallback",
          role: "fallback",
          verificationStatus: "passed",
          requiresProbe: false,
        },
      ],
      generate: async ({ candidate, batch, purpose }) => {
        if (purpose === "verification") return '{"pass":true,"issues":[]}';
        if (candidate.providerId === "primary") primaryDraftCalls++;
        return faithful(batch.units, candidate.modelId);
      },
      writeOutput: async () => {},
    });

    const accepted = await manager.start({ sourcePath: "manual.md", outputPath: join(root, "result.md") });
    await manager.wait(accepted.id);
    sourceRound = 2;
    verificationStatus = "passed";
    await store.update(accepted.id, { status: "interrupted", running: false, paused: true });
    await manager.resume(accepted.id);
    await manager.wait(accepted.id);

    const resumed = await store.read(accepted.id);
    assert.equal(resumed.status, "completed", resumed.error);
    assert.equal(primaryDraftCalls, 1, "a newly verified primary should be eligible after resume");
    assert.deepEqual(resumed.disabledCandidates, []);
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

test("resume keeps the stored source plan while a smaller current model splits only its execution window", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-resume-plan-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const storedPolicy = {
      batchInputTokens: 12_000,
      batchOutputTokens: 8_192,
      maxUnitsPerBatch: 10,
      maxRetries: 0,
      maxSplitDepth: 4,
      maxModelCallsPerBatch: 100,
    };
    const job = await store.create({
      sourcePath: "manual.md",
      outputPath: join(root, "result.md"),
      workspaceRoot: root,
      contract: { fidelity: "complete-with-summary", format: "markdown" },
      policy: storedPolicy,
    });
    await store.update(job.id, { status: "interrupted", paused: true });
    let sourcePlanningPolicy = null;
    const draftSizes = [];
    const units = Array.from({ length: 4 }, (_value, index) => ({
      id: `u${index + 1}`,
      location: `section ${index + 1}`,
      text: `Complete source section ${index + 1}.`,
    }));
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { policy, onBatch }) => {
        sourcePlanningPolicy = policy;
        await onBatch({ id: "source-parent", units });
        return { totalUnits: units.length };
      },
      modelCandidates: () => [{
        providerId: "new-small-model",
        modelId: "new-small-model",
        role: "primary",
        documentPolicy: { batchInputTokens: 3_000, maxUnitsPerBatch: 2 },
      }],
      generate: async ({ batch, purpose }) => {
        if (purpose === "verification") return '{"pass":true,"issues":[]}';
        draftSizes.push(batch.units.length);
        return faithful(batch.units, "new-small-model");
      },
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async () => {},
    });

    await manager.resume(job.id);
    await manager.wait(job.id);
    const resumed = await store.read(job.id);
    assert.equal(resumed.status, "completed", resumed.error);
    assert.equal(sourcePlanningPolicy.maxUnitsPerBatch, 10, "resume must preserve the stored source batch plan");
    assert.equal(resumed.policy.maxUnitsPerBatch, 10);
    assert.deepEqual(draftSizes, [2, 2], "the current model policy applies only inside the parent execution window");
    assert.deepEqual(resumed.batches.map((batch) => batch.id), ["source-parent"]);
    assert.deepEqual(resumed.batches[0].unitIds, units.map((unit) => unit.id));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resume removes stale manifest batches that are absent from the current source plan", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-stale-plan-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const job = await store.create({
      sourcePath: "manual.md",
      outputPath: join(root, "result.md"),
      workspaceRoot: root,
      contract: { fidelity: "complete-with-summary", format: "markdown" },
      policy: { maxRetries: 0 },
    });
    await store.update(job.id, {
      status: "interrupted",
      paused: true,
      batches: [
        { id: "old-plan-a", index: 1, status: "completed", sectionId: "old-plan-a", unitIds: ["old-1", "old-2"] },
        { id: "old-plan-b", index: 2, status: "completed", sectionId: "old-plan-b", unitIds: ["old-3", "old-4"] },
      ],
    });
    const currentUnits = [
      { id: "u1", location: "section 1", text: "Current source section one." },
      { id: "u2", location: "section 2", text: "Current source section two." },
    ];
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "current-plan", units: currentUnits });
        return { totalUnits: currentUnits.length };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch, purpose }) => purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen"),
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async () => {},
    });

    await manager.resume(job.id);
    await manager.wait(job.id);
    const resumed = await store.read(job.id);
    assert.equal(resumed.status, "completed", resumed.error);
    assert.deepEqual(resumed.batches.map((batch) => batch.id), ["current-plan"]);
    assert.equal(resumed.progress.totalUnits, currentUnits.length);
    assert.ok((await store.readEvents(job.id)).some((event) => event.type === "stale-batches-pruned" && event.count === 2));
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

test("a source change before final commit preserves the draft and pauses the task", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-source-change-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let fingerprintCalls = 0;
    let outputWrites = 0;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      fingerprintSource: async () => fingerprintCalls++ === 0
        ? [{ path: "manual.md", size: 10, mtimeMs: 1, sha256: "a".repeat(64) }]
        : [{ path: "manual.md", size: 11, mtimeMs: 2, sha256: "b".repeat(64) }],
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "b1", units: [{ id: "u1", location: "section", text: "Complete source text." }] });
        return { totalUnits: 1 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch, purpose }) => purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen"),
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async () => { outputWrites++; },
    });

    const accepted = await manager.start({ sourcePath: "manual.md", outputPath: join(root, "result.md") });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    assert.equal(job.status, "source_changed");
    assert.equal(job.paused, true);
    assert.equal(outputWrites, 0);
    assert.equal(job.batches.length, 1, "completed draft checkpoints remain available");
    assert.ok((await store.readEvents(job.id)).some((event) => event.type === "source-changed" && event.stage === "before-output"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a duplicate completed task is reused without another model call", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-idempotent-"));
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    let generationCalls = 0;
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => ({ ok: true, sourcePath: "manual.md", readablePath: "manual.md", documentKind: "markdown" }),
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "b1", units: [{ id: "u1", location: "section", text: "Complete source text." }] });
        return { totalUnits: 1 };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch, purpose }) => {
        generationCalls++;
        return purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen");
      },
      generateSummary: async () => "## 摘要\n\nDone.",
      writeOutput: async () => {},
    });
    const input = {
      sourcePath: "manual.md",
      outputPath: join(root, "result.md"),
      taskFingerprint: "same-task",
    };
    const first = await manager.start(input);
    await manager.wait(first.id);
    const callsAfterFirstRun = generationCalls;
    const duplicate = await manager.start(input);

    assert.equal(duplicate.accepted, false);
    assert.equal(duplicate.reused, true);
    assert.equal(duplicate.completed, true);
    assert.equal(duplicate.id, first.id);
    assert.equal(generationCalls, callsAfterFirstRun);
    assert.equal((await store.list()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("collection workflow preserves source list and audits the complete collection before commit", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-collection-workflow-"));
  const first = join(root, "first.md");
  const second = join(root, "second.md");
  const output = join(root, "report.md");
  try {
    const store = createDocumentJobStore(join(root, "jobs"));
    const prepared = {
      ok: true,
      documentKind: "collection",
      sourcePath: first,
      readablePath: first,
      sources: [
        { sourcePath: first, readablePath: first, documentKind: "markdown" },
        { sourcePath: second, readablePath: second, documentKind: "markdown" },
      ],
    };
    const manager = createDocumentMarkdownManager({
      store,
      isForegroundBusy: () => false,
      prepareDocument: async () => prepared,
      fingerprintSource: async () => [
        { path: first, size: 10, mtimeMs: 1, sha256: "a".repeat(64) },
        { path: second, size: 11, mtimeMs: 1, sha256: "b".repeat(64) },
      ],
      processSourceBatches: async (_prepared, { onBatch }) => {
        await onBatch({ id: "source-001-b1", label: "first.md · section", units: [{ id: "source-001-u1", location: "first.md > section", text: "First source complete." }] });
        await onBatch({ id: "source-002-b1", label: "second.md · section", units: [{ id: "source-002-u1", location: "second.md > section", text: "Second source complete." }] });
        return {
          totalUnits: 2,
          batches: 2,
          sourceSummaries: [
            { sourceId: "source-001", sourcePath: first, sourceName: "first.md", documentKind: "markdown", totalUnits: 1 },
            { sourceId: "source-002", sourcePath: second, sourceName: "second.md", documentKind: "markdown", totalUnits: 1 },
          ],
        };
      },
      modelCandidates: () => [{ providerId: "qwen", modelId: "qwen", role: "primary" }],
      generate: async ({ batch, purpose }) => purpose === "verification" ? '{"pass":true,"issues":[]}' : faithful(batch.units, "qwen"),
      generateSummary: async () => "## 摘要\n\n两个来源均已核对。",
      writeOutput: async ({ outputPath, content }) => { await import("node:fs/promises").then(({ writeFile }) => writeFile(outputPath, content, "utf8")); },
    });

    const accepted = await manager.start({
      sourcePath: first,
      sourcePaths: [first, second],
      outputPath: output,
      title: "跨文档报告",
      contract: buildDocumentContract({ sourcePaths: [first, second], outputPath: output, title: "跨文档报告" }),
      taskFingerprint: "collection-task",
    });
    await manager.wait(accepted.id);
    const job = await store.read(accepted.id);
    const content = await readFile(output, "utf8");
    assert.equal(job.status, "completed");
    assert.equal(job.sourceAudit.sourceCount, 2);
    assert.match(content, /# 跨文档报告/);
    assert.match(content, /## 来源清单/);
    assert.match(content, /first\.md/);
    assert.match(content, /second\.md/);
    assert.match(content, /source-unit: source-001-u1/);
    assert.match(content, /source-unit: source-002-u1/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
