import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { analyzePdfPageBoundary, extractPdfText, inspectPdfText, MAX_PDF_BYTES, processPdfTextBatches, renderPdfPageAsDataUrl, shouldRequirePdfSegmentation } from "./pdf-text.mjs";

function minimalPdfPages(values, options = {}) {
  const texts = Array.isArray(values) ? values : [values];
  const fontObject = 3 + texts.length * 2;
  const kids = texts.map((_text, index) => `${3 + index * 2} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${texts.length} >>`,
  ];
  texts.forEach((text, index) => {
    const escaped = text.replace(/[\\()]/g, "\\$&");
    const extra = typeof options.extraStream === "function" ? options.extraStream(index) : String(options.extraStream || "");
    const stream = `BT /F1 16 Tf 72 720 Td (${escaped}) Tj ET${extra ? `\n${extra}` : ""}`;
    const contentObject = 4 + index * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "ascii");
}

test("bundled PDF.js extracts text without Python", async () => {
  const dir = await mkdtemp(join(tmpdir(), "visionox-pdf-text-"));
  try {
    const path = join(dir, "manual (1).pdf");
    await writeFile(path, minimalPdfPages("Visionox PDF extraction works"));
    const result = await extractPdfText(path);
    assert.equal(result.engine, "pdfjs");
    assert.equal(result.totalPages, 1);
    assert.equal(result.extractedPages, 1);
    assert.deepEqual(result.requestedPageNumbers, [1]);
    assert.match(result.pages[0].text, /Visionox PDF extraction works/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("bundled PDF.js and Canvas render a page for multimodal review without a temp file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "visionox-pdf-render-"));
  try {
    const path = join(dir, "visual.pdf");
    await writeFile(path, minimalPdfPages("Visual review page"));
    const dataUrl = await renderPdfPageAsDataUrl(path, 1, { maxDimension: 600 });
    assert.match(dataUrl, /^data:image\/png;base64,/);
    assert.equal(Buffer.from(dataUrl.split(",", 2)[1], "base64").subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PDF vector-heavy pages are captured for multimodal chart review", async () => {
  const dir = await mkdtemp(join(tmpdir(), "visionox-pdf-vector-"));
  try {
    const path = join(dir, "chart.pdf");
    const vectorLines = Array.from({ length: 24 }, (_, index) => `${50 + index} 100 m ${100 + index} 200 l S`).join("\n");
    await writeFile(path, minimalPdfPages("Vector chart", { extraStream: vectorLines }));
    const batches = [];
    await processPdfTextBatches(path, {
      inspectVisuals: true,
      captureVisuals: true,
      onBatch: async (batch) => batches.push(batch),
    });
    const page = batches[0].pageTexts[0];
    assert.ok(page.vectorCount >= 20);
    assert.equal(page.visualPending, true);
    assert.match(page.visualDataUrl, /^data:image\/png;base64,/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PDF.js inspection and batch processing preserve complete page boundaries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "visionox-pdf-batches-"));
  try {
    const path = join(dir, "long manual.pdf");
    await writeFile(path, minimalPdfPages(["page one", "page two", "page three"]));
    const inspection = await inspectPdfText(path);
    assert.equal(inspection.totalPages, 3);
    assert.equal(inspection.largeDocument, false);

    const batches = [];
    const summary = await processPdfTextBatches(path, {
      maxPagesPerBatch: 2,
      maxTokensPerBatch: 64000,
      countTokens: (text) => text.length,
      onBatch: async (batch) => batches.push(batch),
    });
    assert.equal(summary.processedPages, 3);
    assert.equal(summary.batches, 2);
    assert.deepEqual(batches.map((batch) => batch.pageRange), ["1-2", "3"]);
    assert.deepEqual(batches.flatMap((batch) => batch.pageNumbers), [1, 2, 3]);
    assert.deepEqual(batches.flatMap((batch) => batch.pageTexts.map((entry) => entry.page)), [1, 2, 3]);
    assert.match(batches[0].pageTexts[0].text, /page one/);
    assert.match(batches[0].text, /PDF page 1[\s\S]*page one[\s\S]*PDF page 2[\s\S]*page two/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("semantic PDF batching keeps a cross-page explanation together and exposes adjacent read-only context", async () => {
  const dir = await mkdtemp(join(tmpdir(), "visionox-pdf-semantic-"));
  try {
    const path = join(dir, "cross-page.pdf");
    const first = `Failure causes are listed below: ${"A".repeat(780)}`;
    const second = `1) voltage sag 2) clock loss ${"B".repeat(210)}.`;
    const third = "Chapter 3 Independent maintenance procedure.";
    await writeFile(path, minimalPdfPages([first, second, third]));
    const batches = [];
    const summary = await processPdfTextBatches(path, {
      maxPagesPerBatch: 3,
      maxTokensPerBatch: 1024,
      contextOverlapTokens: 256,
      countTokens: (text) => /Failure causes/.test(text) ? 850 : /voltage sag/.test(text) ? 300 : 100,
      onBatch: async (batch) => batches.push(batch),
    });
    assert.deepEqual(batches.map((batch) => batch.pageRange), ["1-2", "3"]);
    assert.ok(summary.semanticJoins >= 1);
    assert.deepEqual(batches[0].contextPageTexts.map((entry) => [entry.page, entry.contextRole]), [[3, "after"]]);
    assert.deepEqual(batches[1].contextPageTexts.map((entry) => [entry.page, entry.contextRole]), [[2, "before"]]);
    assert.deepEqual(batches.flatMap((batch) => batch.pageNumbers), [1, 2, 3]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("hard PDF batch limits still provide both sides with trimmed boundary context", async () => {
  const dir = await mkdtemp(join(tmpdir(), "visionox-pdf-context-"));
  try {
    const path = join(dir, "hard-boundary.pdf");
    await writeFile(path, minimalPdfPages([
      `The root cause continues on the next page ${"A".repeat(900)}`,
      `and completes with the verification evidence ${"B".repeat(900)}.`,
    ]));
    const batches = [];
    await processPdfTextBatches(path, {
      maxPagesPerBatch: 2,
      maxTokensPerBatch: 1024,
      contextOverlapTokens: 256,
      countTokens: (text) => String(text).length * 20,
      onBatch: async (batch) => batches.push(batch),
    });
    assert.deepEqual(batches.map((batch) => batch.pageRange), ["1", "2"]);
    assert.equal(batches[0].contextPageTexts[0].contextRole, "after");
    assert.equal(batches[1].contextPageTexts[0].contextRole, "before");
    assert.equal(batches[0].contextPageTexts[0].contextTruncated, true);
    assert.equal(batches[1].contextPageTexts[0].contextTruncated, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PDF boundary analysis distinguishes continuations from completed section breaks", () => {
  assert.equal(analyzePdfPageBoundary("The required checks are:", "1) Voltage\n2) Clock").safe, false);
  assert.equal(analyzePdfPageBoundary("The procedure is complete.", "Chapter 4 Verification").safe, true);
});

test("non-contiguous page selections retain an honest page range", async () => {
  const dir = await mkdtemp(join(tmpdir(), "visionox-pdf-range-"));
  try {
    const path = join(dir, "range.pdf");
    await writeFile(path, minimalPdfPages(["one", "two", "three"]));
    const batches = [];
    await processPdfTextBatches(path, {
      pages: "1,3",
      maxPagesPerBatch: 10,
      onBatch: async (batch) => batches.push(batch),
    });
    assert.equal(batches[0].pageRange, "1,3");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("large PDF segmentation policy only blocks an unbounded read", () => {
  assert.equal(shouldRequirePdfSegmentation(3001, undefined), true);
  assert.equal(shouldRequirePdfSegmentation(3001, "1-200"), false);
  assert.equal(shouldRequirePdfSegmentation(3000, undefined), false);
});

test("inspection returns a physical-split requirement before loading an oversized file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "visionox-pdf-size-"));
  try {
    const path = join(dir, "oversized.pdf");
    const handle = await open(path, "w");
    await handle.truncate(MAX_PDF_BYTES + 1);
    await handle.close();
    const result = await inspectPdfText(path);
    assert.equal(result.requiresPhysicalSplit, true);
    assert.equal(result.fileBytes, MAX_PDF_BYTES + 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
