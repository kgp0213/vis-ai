import { readFile, stat } from "node:fs/promises";

const PDFJS_MODULE_URL = new URL("../visionox-pkg/node_modules/pdfjs-dist/legacy/build/pdf.mjs", import.meta.url);
const PDFJS_CMAP_URL = new URL("../visionox-pkg/node_modules/pdfjs-dist/cmaps/", import.meta.url).href;
const PDFJS_STANDARD_FONT_URL = new URL("../visionox-pkg/node_modules/pdfjs-dist/standard_fonts/", import.meta.url).href;
const PDFJS_WASM_URL = new URL("../visionox-pkg/node_modules/pdfjs-dist/wasm/", import.meta.url).href;
const MAX_PDF_BYTES = 200 * 1024 * 1024;
const MAX_PDF_PAGES = 1_000;
const DEFAULT_MAX_CHARS = 1_000_000;

let pdfJsPromise = null;

function abortError() {
  return new DOMException("PDF extraction cancelled", "AbortError");
}

async function loadPdfJs() {
  pdfJsPromise ??= import(PDFJS_MODULE_URL.href);
  return pdfJsPromise;
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

export async function extractPdfText(path, { pages, maxChars = DEFAULT_MAX_CHARS, signal } = {}) {
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
    if (document.numPages > MAX_PDF_PAGES) throw new RangeError(`PDF exceeds ${MAX_PDF_PAGES} pages`);
    const selectedPages = pageNumbers(pages, document.numPages);
    const charLimit = Math.max(10_000, Math.min(8_000_000, Number(maxChars) || DEFAULT_MAX_CHARS));
    const results = [];
    let totalChars = 0;
    let truncated = false;
    for (const pageNumber of selectedPages) {
      if (signal?.aborted) throw abortError();
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false });
      const fullText = textFromItems(content.items);
      const remaining = Math.max(0, charLimit - totalChars);
      const text = fullText.slice(0, remaining);
      results.push({ page: pageNumber, chars: text.length, text });
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
      totalChars,
      truncated,
      likelyScanned: totalChars < Math.max(20, results.length * 10),
      pages: results,
    };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await document?.destroy?.();
  }
}
