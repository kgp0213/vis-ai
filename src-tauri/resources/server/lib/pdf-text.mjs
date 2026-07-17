import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { formatPageRange } from "./document-delivery.mjs";
import { createDocumentContextUnit } from "./document-intelligence.mjs";

const PDFJS_MODULE_URL = new URL("../visionox-pkg/node_modules/pdfjs-dist/legacy/build/pdf.mjs", import.meta.url);
const PDFJS_CMAP_URL = new URL("../visionox-pkg/node_modules/pdfjs-dist/cmaps/", import.meta.url).href;
const PDFJS_STANDARD_FONT_URL = new URL("../visionox-pkg/node_modules/pdfjs-dist/standard_fonts/", import.meta.url).href;
const PDFJS_WASM_URL = new URL("../visionox-pkg/node_modules/pdfjs-dist/wasm/", import.meta.url).href;
export const MAX_PDF_BYTES = 200 * 1024 * 1024;
export const MAX_PDF_PAGES = 10_000;
export const LARGE_PDF_PAGE_THRESHOLD = 3_000;
const DEFAULT_MAX_CHARS = 1_000_000;

let pdfJsPromise = null;
let canvasApi = null;

const requireFromBundle = createRequire(new URL("../visionox-pkg/package.json", import.meta.url));

function abortError() {
  return new DOMException("PDF extraction cancelled", "AbortError");
}

async function loadPdfJs() {
  pdfJsPromise ??= import(PDFJS_MODULE_URL.href);
  return pdfJsPromise;
}

function loadCanvasApi() {
  canvasApi ??= requireFromBundle("@napi-rs/canvas");
  return canvasApi;
}

async function renderPdfPageDataUrl(page, { maxDimension = 1600 } = {}) {
  const { createCanvas } = loadCanvasApi();
  const baseViewport = page.getViewport({ scale: 1 });
  const largest = Math.max(baseViewport.width, baseViewport.height, 1);
  const scale = Math.max(0.25, Math.min(2, Number(maxDimension) / largest));
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;
}

function pageNumbers(range, totalPages) {
  if (!range) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const selected = new Set();
  for (const rawPart of String(range).split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new TypeError(`invalid PDF page range: ${part}`);
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first || last > totalPages) throw new RangeError(`PDF page range is outside 1-${totalPages}: ${part}`);
    for (let page = first; page <= last; page++) selected.add(page);
  }
  if (selected.size === 0) throw new TypeError("PDF page range is empty");
  return [...selected].sort((a, b) => a - b);
}

export function shouldRequirePdfSegmentation(totalPages, pages, threshold = LARGE_PDF_PAGE_THRESHOLD) {
  return !String(pages ?? "").trim() && Number(totalPages) > threshold;
}

const PDF_HEADING_START_RE = /^(?:#{1,6}\s+|(?:chapter|section|appendix)\b|第.{1,24}[章节篇]\b|\d+(?:\.\d+)+\.?\s+\S)/iu;
const PDF_CONTINUATION_START_RE = /^(?:continued\b|continuation\b|接上页|续(?:表|图|页)|[,.;:，；：、)\]}）】]|(?:[-*•▪◦]|[a-z0-9]+[.)])\s+|[a-z][a-z0-9_-]*\b)/iu;
const PDF_CONTINUATION_END_RE = /(?:[:：,，、;；\/(\[{（【-]|\b(?:and|or|with|including|following|below|as follows)|(?:如下|包括|分别为|见下页))\s*$/iu;
const PDF_COMPLETE_END_RE = /[.!?。！？)\]）】]$/u;

function edgeLine(value, side) {
  const lines = String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return side === "first" ? lines[0] || "" : lines.at(-1) || "";
}

function looksTabular(value) {
  const line = String(value ?? "");
  return /\t/.test(line) || /^\|.*\|$/.test(line) || (line.match(/\s{2,}/g)?.length ?? 0) >= 2;
}

export function analyzePdfPageBoundary(leftText, rightText) {
  const left = edgeLine(leftText, "last");
  const right = edgeLine(rightText, "first");
  const reasons = [];
  if (!left || !right) return { safe: true, reasons, leftEnding: left, rightBeginning: right };
  const rightStartsHeading = PDF_HEADING_START_RE.test(right) && right.length <= 160;
  if (PDF_CONTINUATION_END_RE.test(left)) reasons.push("open-ending");
  else if (!PDF_COMPLETE_END_RE.test(left) && left.length >= 24 && !rightStartsHeading) reasons.push("unfinished-sentence");
  if (PDF_CONTINUATION_START_RE.test(right) && !rightStartsHeading) reasons.push("continuation-start");
  if (looksTabular(left) && looksTabular(right)) reasons.push("continued-table");
  return { safe: reasons.length === 0, reasons, leftEnding: left.slice(-160), rightBeginning: right.slice(0, 160) };
}

function contextPage(entry, contextRole, maxTokens, countTokens) {
  if (!entry) return null;
  const context = createDocumentContextUnit({
    id: `page-${entry.page}`,
    location: `PDF page ${entry.page}`,
    text: entry.text,
    sourceType: "page",
  }, contextRole, { maxTokens, countTokens });
  return context ? {
    page: entry.page,
    chars: context.text.length,
    originalChars: entry.chars,
    text: context.text,
    contextRole,
    contextOnly: true,
    contextTruncated: context.contextTruncated,
  } : null;
}

function textFromItems(items) {
  const lines = [];
  let line = "";
  for (const item of items) {
    if (typeof item?.str !== "string") continue;
    const value = item.str.trim();
    if (value) line += `${line ? " " : ""}${value}`;
    if (item.hasEOL) {
      if (line) lines.push(line);
      line = "";
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

async function withPdfDocument(path, signal, callback, options = {}) {
  if (signal?.aborted) throw abortError();
  const fileStat = await stat(path);
  if (!fileStat.isFile()) throw new TypeError("PDF path is not a file");
  if (fileStat.size > MAX_PDF_BYTES) throw new RangeError(`PDF exceeds ${MAX_PDF_BYTES} bytes`);
  const data = new Uint8Array(await readFile(path));
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data,
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
    wasmUrl: PDFJS_WASM_URL,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const onAbort = () => { void loadingTask.destroy(); };
  signal?.addEventListener("abort", onAbort, { once: true });
  let document;
  try {
    document = await loadingTask.promise;
    if (signal?.aborted) throw abortError();
    if (!options.allowPageOverflow && document.numPages > MAX_PDF_PAGES) {
      throw new RangeError(`PDF exceeds ${MAX_PDF_PAGES} pages`);
    }
    return await callback(document, fileStat);
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await document?.destroy?.();
  }
}

async function readPdfPageData(document, pageNumber, signal, { inspectVisuals = false, captureVisuals = false } = {}) {
  if (signal?.aborted) throw abortError();
  const page = await document.getPage(pageNumber);
  const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false });
  const text = textFromItems(content.items);
  let visualCount = 0;
  let vectorCount = 0;
  if (inspectVisuals) {
    const pdfjs = await loadPdfJs();
    const ops = await page.getOperatorList();
    const imageOps = new Set([
      pdfjs.OPS?.paintImageXObject,
      pdfjs.OPS?.paintInlineImageXObject,
      pdfjs.OPS?.paintImageMaskXObject,
      pdfjs.OPS?.paintSolidColorImageMask,
    ].filter(Number.isFinite));
    visualCount = ops.fnArray.reduce((count, operation) => count + (imageOps.has(operation) ? 1 : 0), 0);
    const vectorOps = new Set([
      pdfjs.OPS?.constructPath,
      pdfjs.OPS?.stroke,
      pdfjs.OPS?.fill,
      pdfjs.OPS?.eoFill,
      pdfjs.OPS?.fillStroke,
      pdfjs.OPS?.eoFillStroke,
      pdfjs.OPS?.closeStroke,
      pdfjs.OPS?.closeFillStroke,
      pdfjs.OPS?.closeEOFillStroke,
    ].filter(Number.isFinite));
    vectorCount = ops.fnArray.reduce((count, operation) => count + (vectorOps.has(operation) ? 1 : 0), 0);
  }
  const visualPending = (visualCount > 0 && (visualCount > 1 || text.length < 800)) || vectorCount >= 20;
  return {
    text,
    visualCount,
    vectorCount,
    // One small logo on a text-heavy page is usually decorative. Multiple images,
    // or an image on a text-light page, require explicit visual follow-up.
    visualPending,
    visualDataUrl: visualPending && captureVisuals ? await renderPdfPageDataUrl(page) : null,
  };
}

async function readPdfPage(document, pageNumber, signal) {
  return (await readPdfPageData(document, pageNumber, signal)).text;
}

export async function inspectPdfText(path, { signal } = {}) {
  const fileStat = await stat(path);
  if (!fileStat.isFile()) throw new TypeError("PDF path is not a file");
  if (fileStat.size > MAX_PDF_BYTES) {
    return {
      engine: "pdfjs",
      totalPages: null,
      fileBytes: fileStat.size,
      largeDocument: true,
      requiresPhysicalSplit: true,
    };
  }
  return withPdfDocument(path, signal, async (document, fileStat) => ({
    engine: "pdfjs",
    totalPages: document.numPages,
    fileBytes: fileStat.size,
    largeDocument: document.numPages > LARGE_PDF_PAGE_THRESHOLD,
    requiresPhysicalSplit: document.numPages > MAX_PDF_PAGES,
  }), { allowPageOverflow: true });
}

export async function renderPdfPageAsDataUrl(path, pageNumber, { signal, maxDimension } = {}) {
  return withPdfDocument(path, signal, async (document) => {
    const selected = Number(pageNumber);
    if (!Number.isSafeInteger(selected) || selected < 1 || selected > document.numPages) {
      throw new RangeError(`PDF page is outside 1-${document.numPages}: ${pageNumber}`);
    }
    return renderPdfPageDataUrl(await document.getPage(selected), { maxDimension });
  }, { allowPageOverflow: true });
}

export async function extractPdfText(path, { pages, maxChars = DEFAULT_MAX_CHARS, inspectVisuals = false, captureVisuals = false, signal } = {}) {
  return withPdfDocument(path, signal, async (document, fileStat) => {
    if (shouldRequirePdfSegmentation(document.numPages, pages)) {
      return {
        engine: "pdfjs",
        totalPages: document.numPages,
        fileBytes: fileStat.size,
        extractedPages: 0,
        requestedPages: 0,
        requestedPageNumbers: [],
        totalChars: 0,
        truncated: false,
        likelyScanned: false,
        requiresSegmentation: true,
        pages: [],
      };
    }
    const selectedPages = pageNumbers(pages, document.numPages);
    const charLimit = Math.max(10_000, Math.min(8_000_000, Number(maxChars) || DEFAULT_MAX_CHARS));
    const results = [];
    let totalChars = 0;
    let truncated = false;
    for (const pageNumber of selectedPages) {
      const pageData = await readPdfPageData(document, pageNumber, signal, { inspectVisuals, captureVisuals });
      const fullText = pageData.text;
      const remaining = Math.max(0, charLimit - totalChars);
      const text = fullText.slice(0, remaining);
      results.push({ page: pageNumber, chars: text.length, text, visualCount: pageData.visualCount, vectorCount: pageData.vectorCount, visualPending: pageData.visualPending, visualDataUrl: pageData.visualDataUrl });
      totalChars += text.length;
      if (text.length < fullText.length || totalChars >= charLimit) {
        truncated = true;
        break;
      }
    }
    return {
      engine: "pdfjs",
      totalPages: document.numPages,
      extractedPages: results.length,
      requestedPages: selectedPages.length,
      requestedPageNumbers: selectedPages,
      totalChars,
      truncated,
      likelyScanned: totalChars < Math.max(20, results.length * 10),
      pages: results,
    };
  });
}

export async function processPdfTextBatches(path, {
  pages,
  maxPagesPerBatch = 20,
  maxTokensPerBatch = 8_000,
  contextOverlapTokens,
  semanticBatching = true,
  maxVisualUnitsPerBatch = 5,
  countTokens = (text) => Math.ceil(String(text).length / 2),
  inspectVisuals = false,
  captureVisuals = false,
  onPlan,
  onBatch,
  signal,
} = {}) {
  if (typeof onBatch !== "function") throw new TypeError("onBatch callback is required");
  const pageLimit = Math.max(1, Math.min(200, Number(maxPagesPerBatch) || 20));
  const visualLimit = Math.max(1, Math.min(20, Number(maxVisualUnitsPerBatch) || 5));
  const tokenLimit = Math.max(1_024, Math.min(64_000, Number(maxTokensPerBatch) || 8_000));
  const contextLimit = Math.max(128, Math.min(4_096, Number(contextOverlapTokens) || Math.floor(tokenLimit / 3)));
  const softTokenLimit = Math.max(512, Math.floor(tokenLimit * 0.8));
  const hardTokenLimit = Math.min(64_000, tokenLimit + contextLimit);

  return withPdfDocument(path, signal, async (document) => {
    const selectedPages = pageNumbers(pages, document.numPages);
    await onPlan?.({
      totalUnits: selectedPages.length,
      totalBatches: null,
      totalPages: document.numPages,
      selectedPages: selectedPages.length,
      unitLabel: "页",
    });
    let batch = [];
    let batchTokens = 0;
    let batchVisualUnits = 0;
    let batches = 0;
    let processedPages = 0;
    let totalChars = 0;
    let lowTextPages = 0;
    let semanticJoins = 0;
    let contextWindows = 0;
    let priorOwnedPage = null;

    const flush = async (nextPage = null, knownBoundaryAfter = null) => {
      if (batch.length === 0) return;
      batches++;
      const first = batch[0];
      const last = batch.at(-1);
      const beforeAdjacent = priorOwnedPage && priorOwnedPage.page + 1 === first.page;
      const afterAdjacent = nextPage && last.page + 1 === nextPage.page;
      const contextPageTexts = semanticBatching ? [
        beforeAdjacent ? contextPage(priorOwnedPage, "before", contextLimit, countTokens) : null,
        afterAdjacent ? contextPage(nextPage, "after", contextLimit, countTokens) : null,
      ].filter(Boolean) : [];
      if (contextPageTexts.length > 0) contextWindows++;
      const boundaryBefore = beforeAdjacent ? analyzePdfPageBoundary(priorOwnedPage.text, first.text) : null;
      const boundaryAfter = afterAdjacent ? knownBoundaryAfter ?? analyzePdfPageBoundary(last.text, nextPage.text) : null;
      await onBatch({
        index: batches,
        totalPages: document.numPages,
        pageNumbers: batch.map((entry) => entry.page),
        pageTexts: batch.map((entry) => ({ page: entry.page, chars: entry.chars, text: entry.text, visualCount: entry.visualCount, vectorCount: entry.vectorCount, visualPending: entry.visualPending, visualDataUrl: entry.visualDataUrl })),
        contextPageTexts,
        contextPageNumbers: contextPageTexts.map((entry) => entry.page),
        semanticBoundary: {
          before: boundaryBefore ? { safe: boundaryBefore.safe, reasons: boundaryBefore.reasons } : null,
          after: boundaryAfter ? { safe: boundaryAfter.safe, reasons: boundaryAfter.reasons } : null,
        },
        pageRange: formatPageRange(batch.map((entry) => entry.page)),
        totalChars: batch.reduce((sum, entry) => sum + entry.chars, 0),
        estimatedTokens: batchTokens,
        text: batch.map((entry) => `--- PDF page ${entry.page} ---\n\n${entry.text}`).join("\n\n"),
      });
      priorOwnedPage = { page: last.page, chars: last.chars, text: last.text };
      batch = [];
      batchTokens = 0;
      batchVisualUnits = 0;
    };

    for (const pageNumber of selectedPages) {
      const pageData = await readPdfPageData(document, pageNumber, signal, { inspectVisuals, captureVisuals });
      const text = pageData.text;
      const rendered = `\n\n--- PDF page ${pageNumber} ---\n\n${text}`;
      const renderedTokens = Math.max(1, Number(countTokens(rendered)) || 1);
      const entry = { page: pageNumber, chars: text.length, text, visualCount: pageData.visualCount, vectorCount: pageData.vectorCount, visualPending: pageData.visualPending, visualDataUrl: pageData.visualDataUrl };
      if (batch.length > 0) {
        const boundary = analyzePdfPageBoundary(batch.at(-1).text, text);
        const combinedTokens = batchTokens + renderedTokens;
        const pageLimitReached = batch.length >= pageLimit;
        const visualLimitReached = entry.visualPending === true && batchVisualUnits >= visualLimit;
        const hardLimitReached = combinedTokens > hardTokenLimit;
        const softLimitReached = batchTokens >= softTokenLimit || combinedTokens > tokenLimit;
        const semanticBreak = semanticBatching && softLimitReached && boundary.safe;
        const fixedBreak = !semanticBatching && combinedTokens > tokenLimit;
        if (pageLimitReached || visualLimitReached || hardLimitReached || semanticBreak || fixedBreak) {
          await flush(entry, boundary);
        } else if (semanticBatching && softLimitReached && !boundary.safe) {
          semanticJoins++;
        }
      }
      batch.push(entry);
      batchTokens += renderedTokens;
      if (entry.visualPending === true) batchVisualUnits++;
      processedPages++;
      totalChars += text.length;
      if (text.length < 10) lowTextPages++;
    }
    await flush();

    return {
      engine: "pdfjs",
      totalPages: document.numPages,
      selectedPages: selectedPages.length,
      processedPages,
      batches,
      totalChars,
      semanticBatching: semanticBatching === true,
      semanticJoins,
      contextWindows,
      likelyScanned: processedPages > 0 && lowTextPages / processedPages >= 0.5,
    };
  });
}
