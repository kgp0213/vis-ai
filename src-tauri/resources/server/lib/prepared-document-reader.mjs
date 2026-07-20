import { open, stat } from "node:fs/promises";
import { extname } from "node:path";

const DEFAULT_MAX_UNITS = 8;
const MAX_UNITS = 50;
const DEFAULT_MAX_CHARS = 24_000;
const MAX_CHARS = 100_000;
const TEXT_EXTENSIONS = new Set([".csv", ".tsv", ".json", ".jsonl", ".xml", ".yaml", ".yml", ".txt", ".md", ".markdown", ".log", ".ini", ".cfg", ".conf", ".dsn"]);

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function parseOfficePayload(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("prepared document Office reader returned invalid JSON");
  }
}

function officeContent(elements, start) {
  return elements.map((entry, index) => {
    const location = String(entry?.path || entry?.location || `unit-${start + index}`);
    const text = String(entry?.text ?? entry?.value ?? "");
    return `--- Source unit ${start + index} (${location}) ---\n\n${text}`;
  }).join("\n\n");
}

async function readTextWindow(path, cursor, maxChars, signal) {
  if (signal?.aborted) throw new DOMException("prepared document read cancelled", "AbortError");
  const file = await stat(path);
  if (!file.isFile()) throw new TypeError("prepared document path is not a file");
  const byteOffset = Math.max(0, Number(cursor?.byteOffset) || 0);
  if (byteOffset > file.size) throw new RangeError(`prepared document cursor is outside 0-${file.size}`);
  const readBytes = Math.min(file.size - byteOffset, maxChars * 4 + 4);
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(Math.max(0, readBytes));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, byteOffset);
    const decoded = buffer.subarray(0, bytesRead).toString("utf8");
    let content = decoded.slice(0, maxChars);
    const reachedEnd = byteOffset + bytesRead >= file.size && content.length === decoded.length;
    if (!reachedEnd && content.length > 0) {
      const newline = content.lastIndexOf("\n");
      if (newline >= Math.floor(content.length / 2)) content = content.slice(0, newline + 1);
      const lastCodeUnit = content.charCodeAt(content.length - 1);
      if (lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF) content = content.slice(0, -1);
    }
    if (!content && byteOffset < file.size) throw new Error("prepared document reader could not advance the text cursor");
    const nextOffset = byteOffset + Buffer.byteLength(content, "utf8");
    const complete = nextOffset >= file.size;
    return {
      ok: true,
      documentKind: "text",
      content,
      coverage: { totalBytes: file.size, deliveredByteRange: [byteOffset, nextOffset] },
      nextCursor: complete ? null : { byteOffset: nextOffset },
      complete,
      truncated: !complete,
      visualPending: 0,
    };
  } finally {
    await handle.close();
  }
}

export function createPreparedDocumentReader({ registry, inspectPdfText, extractPdfText, runOfficeCli } = {}) {
  if (typeof registry?.find !== "function") throw new TypeError("prepared document registry is required");
  return async function readPreparedDocument(args = {}, context = {}) {
    const documentRef = String(args?.documentRef ?? "").trim();
    const prepared = registry.find(documentRef);
    if (!prepared) throw new Error(`prepared document not found: ${documentRef || "(empty ref)"}`);
    const path = String(prepared.readablePath || prepared.sourcePath || "");
    const extension = extname(path).toLowerCase();
    const maxUnits = positiveInteger(args?.maxUnits, DEFAULT_MAX_UNITS, MAX_UNITS);
    const maxChars = positiveInteger(args?.maxChars, DEFAULT_MAX_CHARS, MAX_CHARS);
    const signal = context?.signal;

    if (prepared.documentKind === "pdf") {
      if (typeof extractPdfText !== "function") throw new Error("prepared document PDF reader is unavailable");
      const firstPage = positiveInteger(args?.cursor?.page, 1, Number.MAX_SAFE_INTEGER);
      const inspected = typeof inspectPdfText === "function" ? await inspectPdfText(path, { signal }) : null;
      const totalPages = Number(inspected?.totalPages) || null;
      if (totalPages !== null && firstPage > totalPages) throw new RangeError(`prepared document cursor is outside PDF pages 1-${totalPages}`);
      const lastPage = totalPages === null
        ? firstPage + maxUnits - 1
        : Math.min(totalPages, firstPage + maxUnits - 1);
      const extracted = await extractPdfText(path, {
        pages: firstPage === lastPage ? String(firstPage) : `${firstPage}-${lastPage}`,
        maxChars,
        inspectVisuals: true,
        signal,
      });
      const deliveredPages = (extracted.pages ?? []).map((entry) => Number(entry.page)).filter(Number.isSafeInteger);
      const actualLastPage = deliveredPages.at(-1) ?? firstPage - 1;
      const complete = extracted.truncated !== true && actualLastPage >= Number(extracted.totalPages || totalPages || 0);
      return {
        ok: true,
        documentRef: prepared.documentRef,
        documentKind: "pdf",
        content: (extracted.pages ?? []).map((entry) => `--- PDF page ${entry.page} ---\n\n${String(entry.text ?? "")}`).join("\n\n"),
        coverage: {
          totalUnits: Number(extracted.totalPages) || null,
          deliveredUnits: deliveredPages,
          deliveredRange: deliveredPages.length ? [deliveredPages[0], actualLastPage] : null,
        },
        nextCursor: complete || extracted.truncated === true ? null : { page: actualLastPage + 1 },
        complete,
        truncated: extracted.truncated === true,
        requiresIntervention: extracted.truncated === true,
        interventionReason: extracted.truncated === true ? "document-window-truncated" : null,
        likelyScanned: extracted.likelyScanned === true,
        visualPending: (extracted.pages ?? []).filter((entry) => entry.visualPending === true).length,
      };
    }

    if (["word", "presentation", "spreadsheet"].includes(prepared.documentKind) && !TEXT_EXTENSIONS.has(extension)) {
      if (typeof runOfficeCli !== "function") throw new Error("prepared document Office reader is unavailable");
      const firstUnit = positiveInteger(args?.cursor?.unit, 1, Number.MAX_SAFE_INTEGER);
      const payload = parseOfficePayload(await runOfficeCli([
        "view", path, "text",
        "--start", String(firstUnit),
        "--end", String(firstUnit + maxUnits - 1),
        "--max-lines", String(maxUnits),
        "--json",
      ], { signal }));
      if (payload?.success === false) throw new Error(String(payload?.error?.error || payload?.error || "prepared document Office read failed"));
      const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
      const elements = Array.isArray(data?.elements) ? data.elements.slice(0, maxUnits) : [];
      const totalUnits = Number.isFinite(Number(data?.totalElements)) ? Number(data.totalElements) : null;
      const lastUnit = firstUnit + elements.length - 1;
      const noProgress = elements.length === 0 && totalUnits !== null && firstUnit <= totalUnits;
      const complete = noProgress ? false : (totalUnits !== null ? lastUnit >= totalUnits : elements.length < maxUnits);
      return {
        ok: true,
        documentRef: prepared.documentRef,
        documentKind: prepared.documentKind,
        content: officeContent(elements, firstUnit),
        coverage: { totalUnits, deliveredRange: elements.length ? [firstUnit, lastUnit] : null },
        nextCursor: complete ? null : { unit: noProgress ? firstUnit : lastUnit + 1 },
        complete,
        truncated: !complete,
        requiresIntervention: noProgress,
        interventionReason: noProgress ? "document-reader-no-progress" : null,
        visualPending: elements.filter((entry) => /^(?:picture|image|chart|diagram)$/i.test(String(entry?.type || ""))).length,
      };
    }

    if (prepared.documentKind === "text" || TEXT_EXTENSIONS.has(extension)) {
      return { documentRef: prepared.documentRef, ...(await readTextWindow(path, args?.cursor, maxChars, signal)) };
    }
    throw new Error(`unsupported prepared document format: ${prepared.documentKind || extension || "unknown"}`);
  };
}
