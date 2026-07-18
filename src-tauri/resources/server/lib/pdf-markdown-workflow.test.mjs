import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPdfSectionReviewMessages,
  buildPdfSectionMessages,
  cleanPdfMarkdownSection,
  evaluatePdfPageCoverage,
  evaluateTechnicalRetention,
  generatePdfSectionWithModel,
  parsePdfSectionReview,
  pdfMarkdownStagingPath,
  registerPdfMarkdownWorkflowTool,
} from "./pdf-markdown-workflow.mjs";

function fakeTools() {
  const definitions = new Map();
  const calls = [];
  return {
    definitions,
    calls,
    register(definition) { definitions.set(definition.name, definition); },
    async dispatch(name, args) { calls.push({ name, args }); return `${name} ok`; },
  };
}

test("Markdown helpers keep sections composable and measure technical retention", () => {
  assert.equal(pdfMarkdownStagingPath("reports/manual.md"), "reports/manual.visionox-partial.md");
  assert.equal(cleanPdfMarkdownSection("```markdown\n# Heading\nBody\n```"), "## Heading\nBody");
  const low = evaluateTechnicalRetention(
    "0xAA 0xBB 0xCC 0xDD 0xEE 0xFF 0x11 0x22 0x33 0x44 0x55 0x66 details ".repeat(5),
    "brief overview",
    "technical",
  );
  assert.equal(low.needsRetry, true);
  assert.match(buildPdfSectionMessages({
    batch: { pageRange: "1-20", text: "source" },
    mode: "technical",
    instructions: "keep commands",
  })[1].content, /Source pages: 1-20/);
  assert.match(buildPdfSectionMessages({
    batch: { pageRange: "1-2", text: "source" },
    mode: "technical",
  })[0].content, /source-page: N/);
  const incomplete = evaluatePdfPageCoverage(
    [
      { page: 49, text: "page 49 technical values" },
      { page: 50, text: "page 50 technical values" },
      { page: 55, text: "page 55 technical values" },
    ],
    "<!-- source-page: 55 -->\n## Only the final page\nvalues",
    "technical",
  );
  assert.deepEqual(incomplete.missingPages, [49, 50]);
  assert.equal(incomplete.complete, false);
  const hollow = evaluatePdfPageCoverage(
    [{ page: 49, text: "substantive technical source content for this page" }],
    "<!-- source-page: 49 -->\n## 49",
    "technical",
  );
  assert.deepEqual(hollow.thinPages, [49]);
  assert.equal(hollow.complete, false);
});

test("PDF quality review is structured, page-bound, and tolerant of fenced JSON", () => {
  const messages = buildPdfSectionReviewMessages({
    batch: { pageRange: "7-8", pageNumbers: [7, 8], text: "source" },
    section: "draft",
    mode: "technical",
  });
  assert.match(messages[0].content, /independent quality reviewer/i);
  assert.match(messages[1].content, /Source pages: 7-8/);
  assert.deepEqual(parsePdfSectionReview(
    "```json\n{\"pass\":false,\"issues\":[{\"page\":7,\"type\":\"omission\",\"detail\":\"warning missing\"}]}\n```",
    [7, 8],
  ), {
    pass: false,
    issues: [{ page: 7, type: "omission", detail: "warning missing" }],
  });
  assert.deepEqual(parsePdfSectionReview({ pass: true, issues: [] }, [7, 8]), { pass: true, issues: [] });
  assert.equal(parsePdfSectionReview('{"pass":false,"issues":[{"page":99,"type":"omission","detail":"outside"}]}', [7, 8]), null);
});

test("PDF model section streams content and emits progress while generating", async () => {
  const progress = [];
  let capturedRequest = null;
  const client = {
    async *stream(request) {
      capturedRequest = request;
      yield { reasoningDelta: "thinking" };
      yield { contentDelta: "## Section\n" };
      yield { contentDelta: "content" };
    },
  };
  const result = await generatePdfSectionWithModel({
    client,
    model: "test-model",
    messages: [{ role: "user", content: "source" }],
    pageRange: "1-2",
    idleTimeoutMs: 100,
    progressIntervalMs: 10,
    onProgress: (event) => progress.push(event),
  });
  assert.equal(result, "## Section\ncontent");
  assert.ok(progress.some((event) => event.phase === "model" && event.pageRange === "1-2"));
  assert.ok(progress.every((event) => event.stage === "draft"));
  assert.ok(progress.some((event) => event.generatedChars > 0));
  assert.equal(capturedRequest.requestPurpose, "toolContinuation");
});

test("PDF review requests can select the provider verification profile", async () => {
  let capturedRequest = null;
  const client = {
    async *stream(request) {
      capturedRequest = request;
      yield { contentDelta: '{"pass":true,"issues":[]}' };
    },
  };
  await generatePdfSectionWithModel({
    client,
    model: "test-model",
    messages: [],
    pageRange: "1",
    requestPurpose: "verification",
    idleTimeoutMs: 100,
  });
  assert.equal(capturedRequest.requestPurpose, "verification");
});

test("PDF model section rejects output truncated by the provider token limit", async () => {
  const client = {
    async *stream() {
      yield { contentDelta: "## Incomplete section" };
      yield { finishReason: "length", streamComplete: true };
    },
  };

  await assert.rejects(
    () => generatePdfSectionWithModel({
      client,
      model: "limited-model",
      messages: [],
      pageRange: "21-25",
      idleTimeoutMs: 100,
    }),
    (error) => error?.name === "DocumentModelOutputTruncatedError" && /输出上限/.test(error.message),
  );
});

test("PDF model section rejects non-stream output truncated by the provider token limit", async () => {
  const client = {
    async chat() {
      return { content: "## Incomplete section", finishReason: "length" };
    },
  };

  await assert.rejects(
    () => generatePdfSectionWithModel({
      client,
      model: "limited-model",
      messages: [],
      pageRange: "26-30",
      idleTimeoutMs: 100,
    }),
    (error) => error?.name === "DocumentModelOutputTruncatedError" && /输出上限/.test(error.message),
  );
});

test("PDF model section falls back to chat when a compatible endpoint returns an empty stream", async () => {
  let chatCalls = 0;
  const client = {
    async *stream() {},
    async chat() {
      chatCalls++;
      return { content: "## Fallback\ncontent" };
    },
  };
  const result = await generatePdfSectionWithModel({
    client,
    model: "compatible-model",
    messages: [],
    pageRange: "4",
    idleTimeoutMs: 100,
  });
  assert.equal(result, "## Fallback\ncontent");
  assert.equal(chatCalls, 1);
});

test("PDF model section fails clearly when no data arrives before the idle timeout", async () => {
  const client = {
    async *stream({ signal }) {
      await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
      });
    },
  };
  await assert.rejects(
    () => generatePdfSectionWithModel({
      client,
      model: "test-model",
      messages: [],
      pageRange: "3",
      idleTimeoutMs: 20,
      progressIntervalMs: 5,
    }),
    (error) => error?.name === "PdfModelTimeoutError" && /没有返回数据/.test(error.message),
  );
});

test("PDF model section enforces a wall-clock deadline even when reasoning chunks keep arriving", async () => {
  const client = {
    async *stream({ signal }) {
      while (!signal.aborted) {
        yield { reasoningDelta: "thinking" };
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    },
  };
  await assert.rejects(
    () => generatePdfSectionWithModel({
      client,
      model: "slow-model",
      messages: [],
      pageRange: "1-8",
      idleTimeoutMs: 10,
      hardTimeoutMs: 30,
      progressIntervalMs: 5,
    }),
    (error) => error?.name === "PdfModelDeadlineError" && /总时长上限/.test(error.message),
  );
});

test("host-managed PDF workflow writes batches and finalizes only after full coverage", async () => {
  const tools = fakeTools();
  const generated = [];
  const pageText = (page) => `complete source content retained for page ${page}`;
  registerPdfMarkdownWorkflowTool(tools, {
    preparePdf: async () => ({ ok: true, documentRef: "visionox-document:test", readablePath: "input.pdf", sourcePath: "manual.pdf" }),
    inspectPdf: async () => ({ totalPages: 4, fileBytes: 1000 }),
    countTokens: (text) => text.length,
    processBatches: async (_path, options) => {
      for (const batch of [
        {
          index: 1,
          pageRange: "1-2",
          pageNumbers: [1, 2],
          pageTexts: [1, 2].map((page) => ({ page, chars: pageText(page).length, text: pageText(page) })),
          text: `${pageText(1)}\n${pageText(2)}`,
          totalChars: pageText(1).length + pageText(2).length,
        },
        {
          index: 2,
          pageRange: "3-4",
          pageNumbers: [3, 4],
          pageTexts: [3, 4].map((page) => ({ page, chars: pageText(page).length, text: pageText(page) })),
          text: `${pageText(3)}\n${pageText(4)}`,
          totalChars: pageText(3).length + pageText(4).length,
        },
      ]) await options.onBatch(batch);
      return { totalPages: 4, selectedPages: 4, processedPages: 4, batches: 2, totalChars: 36, likelyScanned: false };
    },
    generateSection: async ({ batch }) => {
      generated.push(batch.pageRange);
      return batch.pageTexts.map((page) => `<!-- source-page: ${page.page} -->\n## Page ${page.page}\n${page.text}`).join("\n\n");
    },
  });

  const result = JSON.parse(await tools.definitions.get("organize_pdf_to_markdown").fn({
    input: "manual.pdf",
    outputPath: "manual.md",
    mode: "technical",
  }, {}));
  assert.equal(result.complete, true);
  assert.deepEqual(generated, ["1-2", "3-4"]);
  assert.deepEqual(tools.calls.map((call) => call.name), ["write_file", "append_file", "append_file", "move_file"]);
  assert.deepEqual(tools.calls.at(-1).args, {
    source: "manual.visionox-partial.md",
    destination: "manual.md",
  });
});

test("PDF workflow rejects a multi-page batch that only contains its final page and subdivides it", async () => {
  const tools = fakeTools();
  const generated = [];
  const progress = [];
  const pageTexts = Array.from({ length: 7 }, (_value, index) => ({
    page: index + 49,
    chars: 120,
    text: `technical content for page ${index + 49} with values 0x${String(index + 49).padStart(2, "0")}`,
  }));
  registerPdfMarkdownWorkflowTool(tools, {
    preparePdf: async () => ({ ok: true, documentRef: "visionox-document:tail", readablePath: "tail.pdf", sourcePath: "tail.pdf" }),
    inspectPdf: async () => ({ totalPages: 55, fileBytes: 1000 }),
    processBatches: async (_path, options) => {
      await options.onBatch({
        index: 1,
        pageRange: "49-55",
        pageNumbers: pageTexts.map((page) => page.page),
        pageTexts,
        text: pageTexts.map((page) => `--- PDF page ${page.page} ---\n${page.text}`).join("\n\n"),
        totalChars: pageTexts.reduce((sum, page) => sum + page.chars, 0),
      });
      return { totalPages: 55, selectedPages: 7, processedPages: 7, batches: 1, totalChars: 840, likelyScanned: false };
    },
    generateSection: async ({ batch }) => {
      generated.push(batch.pageRange);
      if (batch.pageRange === "49-55") return "<!-- source-page: 55 -->\n## Only page 55\nlast page values";
      return batch.pageTexts.map((page) => `<!-- source-page: ${page.page} -->\n## Page ${page.page}\n${page.text}`).join("\n\n");
    },
    onProgress: (event) => progress.push(event),
  });

  const result = JSON.parse(await tools.definitions.get("organize_pdf_to_markdown").fn({
    input: "tail.pdf",
    outputPath: "tail.md",
    mode: "technical",
  }, {}));
  const appended = tools.calls.filter((call) => call.name === "append_file").map((call) => call.args.content).join("\n");
  assert.equal(result.complete, true);
  for (const page of pageTexts) assert.match(appended, new RegExp(`source-page: ${page.page}`));
  assert.deepEqual(generated, ["49-55", "49-52", "53-55"]);
  assert.ok(progress.some((event) => event.phase === "coverage-retry"
    && event.pageRange === "49-55"
    && event.missingPages.includes(49)));
});

test("PDF workflow preserves source text when a single-page model retry remains empty", async () => {
  const tools = fakeTools();
  let generated = 0;
  registerPdfMarkdownWorkflowTool(tools, {
    preparePdf: async () => ({ ok: true, documentRef: "visionox-document:empty", readablePath: "empty.pdf", sourcePath: "empty.pdf" }),
    inspectPdf: async () => ({ totalPages: 1, fileBytes: 1000 }),
    processBatches: async (_path, options) => {
      await options.onBatch({
        index: 1,
        pageRange: "1",
        pageNumbers: [1],
        pageTexts: [{ page: 1, chars: 36, text: "source values must not be discarded" }],
        text: "--- PDF page 1 ---\nsource values must not be discarded",
        totalChars: 36,
      });
      return { totalPages: 1, selectedPages: 1, processedPages: 1, batches: 1, totalChars: 36, likelyScanned: false };
    },
    generateSection: async () => {
      generated++;
      return "";
    },
  });

  const result = JSON.parse(await tools.definitions.get("organize_pdf_to_markdown").fn({
    input: "empty.pdf",
    outputPath: "empty.md",
    mode: "technical",
  }, {}));
  const appended = tools.calls.find((call) => call.name === "append_file")?.args.content ?? "";
  assert.equal(result.complete, true);
  assert.equal(generated, 2);
  assert.match(appended, /source-page: 1/);
  assert.match(appended, /source values must not be discarded/);
  assert.ok(result.warnings.some((warning) => warning.type === "page-coverage-source-fallback"));
});

test("PDF workflow repairs a semantically rejected draft and independently reviews it again", async () => {
  const tools = fakeTools();
  const generatedStages = [];
  let reviewCalls = 0;
  registerPdfMarkdownWorkflowTool(tools, {
    preparePdf: async () => ({ ok: true, documentRef: "visionox-document:review", readablePath: "review.pdf", sourcePath: "review.pdf" }),
    inspectPdf: async () => ({ totalPages: 1, fileBytes: 1000 }),
    processBatches: async (_path, options) => {
      const text = "Critical warning: keep voltage below 3.3V during startup.";
      await options.onBatch({
        index: 1,
        pageRange: "1",
        pageNumbers: [1],
        pageTexts: [{ page: 1, chars: text.length, text }],
        text: `--- PDF page 1 ---\n${text}`,
        totalChars: text.length,
      });
      return { totalPages: 1, selectedPages: 1, processedPages: 1, batches: 1, totalChars: text.length, likelyScanned: false };
    },
    generateSection: async ({ stage }) => {
      generatedStages.push(stage);
      if (stage === "quality-repair") {
        return "<!-- source-page: 1 -->\n## Startup warning\nKeep voltage below 3.3V during startup.";
      }
      return "<!-- source-page: 1 -->\n## Startup\nThe device has a normal startup procedure.";
    },
    reviewSection: async () => {
      reviewCalls++;
      return reviewCalls === 1
        ? '{"pass":false,"issues":[{"page":1,"type":"omission","detail":"The 3.3V startup warning is missing."}]}'
        : '{"pass":true,"issues":[]}';
    },
  });

  const result = JSON.parse(await tools.definitions.get("organize_pdf_to_markdown").fn({
    input: "review.pdf",
    outputPath: "review.md",
    mode: "technical",
  }, {}));
  const appended = tools.calls.find((call) => call.name === "append_file")?.args.content ?? "";
  assert.equal(result.complete, true);
  assert.equal(result.qualityPassed, true);
  assert.deepEqual(result.qualityReview, {
    enabled: true,
    reviewedBatches: 1,
    repairedBatches: 1,
    unresolvedBatches: 0,
    unavailableBatches: 0,
    deterministicFailures: 0,
  });
  assert.deepEqual(generatedStages, ["draft", "quality-repair"]);
  assert.equal(reviewCalls, 2);
  assert.match(appended, /3\.3V/);
});

test("PDF workflow reports degraded quality when model review remains invalid", async () => {
  const tools = fakeTools();
  let reviewCalls = 0;
  registerPdfMarkdownWorkflowTool(tools, {
    preparePdf: async () => ({ ok: true, documentRef: "visionox-document:invalid-review", readablePath: "review.pdf", sourcePath: "review.pdf" }),
    inspectPdf: async () => ({ totalPages: 1, fileBytes: 1000 }),
    processBatches: async (_path, options) => {
      const text = "Complete source material for page one.";
      await options.onBatch({
        index: 1,
        pageRange: "1",
        pageNumbers: [1],
        pageTexts: [{ page: 1, chars: text.length, text }],
        text: `--- PDF page 1 ---\n${text}`,
        totalChars: text.length,
      });
      return { totalPages: 1, selectedPages: 1, processedPages: 1, batches: 1, totalChars: text.length, likelyScanned: false };
    },
    generateSection: async () => "<!-- source-page: 1 -->\n## Page one\nComplete source material for page one.",
    reviewSection: async () => {
      reviewCalls++;
      return "review output was truncated";
    },
  });

  const result = JSON.parse(await tools.definitions.get("organize_pdf_to_markdown").fn({
    input: "review.pdf",
    outputPath: "review.md",
  }, {}));
  assert.equal(result.complete, true);
  assert.equal(result.qualityPassed, false);
  assert.equal(result.qualityReview.unavailableBatches, 1);
  assert.equal(reviewCalls, 2);
  assert.ok(result.warnings.some((warning) => warning.type === "model-quality-review-unavailable"));
});

test("host-managed PDF workflow can resolve input from the latest prepared document", async () => {
  const tools = fakeTools();
  let receivedInput = null;
  registerPdfMarkdownWorkflowTool(tools, {
    resolveInput: () => "visionox-document:prepared",
    preparePdf: async (input) => {
      receivedInput = input;
      return { ok: false, error: "stop after input resolution" };
    },
  });
  const result = JSON.parse(await tools.definitions.get("organize_pdf_to_markdown").fn({
    outputPath: "manual.md",
  }, {}));
  assert.equal(receivedInput, "visionox-document:prepared");
  assert.equal(result.ok, false);
  assert.match(result.error, /stop after input resolution/);
});

test("PDF workflow asks for a user choice before processing more than 3000 pages", async () => {
  const tools = fakeTools();
  let processed = false;
  registerPdfMarkdownWorkflowTool(tools, {
    preparePdf: async () => ({ ok: true, documentRef: "visionox-document:large", readablePath: "large.pdf", sourcePath: "large.pdf" }),
    inspectPdf: async () => ({ totalPages: 3001, fileBytes: 1234 }),
    processBatches: async () => { processed = true; },
  });
  const result = JSON.parse(await tools.definitions.get("organize_pdf_to_markdown").fn({
    input: "large.pdf",
    outputPath: "large.md",
  }, {}));
  assert.equal(result.requiresUserChoice, true);
  assert.equal(result.choices.length, 4);
  assert.equal(processed, false);
  assert.equal(tools.calls.length, 0);
});

test("oversized PDF choice remains available even when page count is unknown", async () => {
  const tools = fakeTools();
  registerPdfMarkdownWorkflowTool(tools, {
    preparePdf: async () => ({ ok: true, documentRef: "visionox-document:oversized", readablePath: "large.pdf", sourcePath: "large.pdf" }),
    inspectPdf: async () => ({ totalPages: null, fileBytes: 300_000_000, requiresPhysicalSplit: true }),
  });
  const result = JSON.parse(await tools.definitions.get("organize_pdf_to_markdown").fn({
    input: "large.pdf",
    outputPath: "large.md",
  }, {}));
  assert.equal(result.requiresUserChoice, true);
  assert.equal(result.reason, "file-size");
  assert.equal(result.totalPages, null);
});
