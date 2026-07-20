import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";

import { chunkDocumentUnits, classifyDocumentPath, createDocumentContextUnit, normalizeDocumentPolicy } from "./document-intelligence.mjs";

const requireFromBundle = createRequire(new URL("../visionox-pkg/package.json", import.meta.url));
const { parse: parseHtml } = requireFromBundle("node-html-parser");
const MAX_VISUAL_BYTES = 8 * 1024 * 1024;
const IMAGE_MIME_BY_EXTENSION = new Map([
  [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"],
  [".webp", "image/webp"], [".gif", "image/gif"], [".bmp", "image/bmp"],
  [".svg", "image/svg+xml"],
]);

function stableId(prefix, value, index) {
  const hash = createHash("sha1").update(`${value}\0${index}`).digest("hex").slice(0, 12);
  return `${prefix}-${hash}`;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

function unit(prefix, index, location, text, extra = {}) {
  const normalized = normalizeText(text);
  return {
    id: stableId(prefix, location || normalized.slice(0, 80), index),
    location: String(location || `${prefix} ${index + 1}`),
    text: normalized,
    sourceHash: createHash("sha256").update(normalized).digest("hex"),
    ...extra,
  };
}

export function markdownDocumentUnits(source) {
  const lines = String(source ?? "").replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  const headings = [];
  let current = [];
  let location = "Document preface";
  const flush = () => {
    const text = normalizeText(current.join("\n"));
    if (text) sections.push(unit("markdown", sections.length, location, text));
    current = [];
  };
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      headings.length = level - 1;
      headings[level - 1] = heading[2].trim();
      location = headings.filter(Boolean).join(" > ");
    }
    current.push(line);
  }
  flush();
  return sections;
}

function renderHtmlTable(table) {
  const rows = table.querySelectorAll("tr").map((row) => row.querySelectorAll("th,td").map((cell) => normalizeText(cell.text)));
  if (rows.length === 0) return normalizeText(table.text);
  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
  const header = normalized[0];
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...normalized.slice(1).map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function hasSelectedAncestor(element) {
  let parent = element.parentNode;
  while (parent) {
    const tag = String(parent.tagName ?? "").toLowerCase();
    if (["table", "pre", "li", "blockquote"].includes(tag)) return true;
    parent = parent.parentNode;
  }
  return false;
}

const HTML_CONTAINER_TAGS = new Set(["div", "section", "article", "main", "aside", "header", "footer", "figure", "figcaption", "dl", "dt", "dd"]);
const HTML_BLOCK_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "table", "pre", "blockquote", "img", "svg", "canvas", ...HTML_CONTAINER_TAGS]);

function directInlineText(element) {
  const parts = [];
  for (const child of element?.childNodes ?? []) {
    const tag = String(child?.tagName ?? "").toLowerCase();
    if (tag && HTML_BLOCK_TAGS.has(tag)) continue;
    const text = typeof child?.rawText === "string" ? child.rawText : child?.text;
    if (text) parts.push(text);
  }
  return normalizeText(parts.join(" "));
}

export function htmlDocumentUnits(source) {
  const root = parseHtml(String(source ?? ""), { lowerCaseTagName: true, comment: false });
  for (const element of root.querySelectorAll("script,style,noscript,template")) element.remove();
  const body = root.querySelector("body") ?? root;
  const selected = body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,table,pre,blockquote,img,svg,canvas,div,section,article,main,aside,header,footer,figure,figcaption,dl,dt,dd");
  const sections = [];
  const headings = [];
  let ordinal = 0;
  const preface = directInlineText(body);
  if (preface) sections.push(unit("html", ordinal++, "HTML document > text", preface));
  for (const element of selected) {
    const tag = String(element.tagName ?? "").toLowerCase();
    if (!["table", "pre", "li", "blockquote"].includes(tag) && hasSelectedAncestor(element)) continue;
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      headings.length = level - 1;
      headings[level - 1] = normalizeText(element.text);
      continue;
    }
    const path = headings.filter(Boolean).join(" > ") || "HTML document";
    if (tag === "img") {
      const alt = normalizeText(element.getAttribute("alt") || element.getAttribute("title") || "未提供图片说明");
      const src = normalizeText(element.getAttribute("src"));
      sections.push(unit("html", ordinal++, `${path} > image`, `图片：${alt}${src ? `\n来源：${src}` : ""}`, {
        visualPending: true,
        visualType: "image",
        sourceRef: src || null,
        visualDataUrl: /^data:image\//i.test(src) ? src : null,
      }));
      continue;
    }
    if (tag === "svg" || tag === "canvas") {
      const markup = tag === "svg" ? element.toString() : "";
      sections.push(unit("html", ordinal++, `${path} > ${tag}`, `${tag.toUpperCase()} 视觉内容`, {
        visualPending: true,
        visualType: tag,
        visualDataUrl: markup ? `data:image/svg+xml;base64,${Buffer.from(markup).toString("base64")}` : null,
      }));
      continue;
    }
    const text = tag === "table" ? renderHtmlTable(element) : HTML_CONTAINER_TAGS.has(tag) ? directInlineText(element) : normalizeText(element.text);
    if (!text) continue;
    const visualContainer = HTML_CONTAINER_TAGS.has(tag) && /(?:chart|diagram|graph|flow|architecture|mermaid)/i.test(`${element.getAttribute?.("class") || ""} ${element.getAttribute?.("id") || ""}`);
    sections.push(unit("html", ordinal++, `${path} > ${tag}`, text, {
      sourceType: tag,
      visualPending: visualContainer,
      visualType: visualContainer ? "html-layout" : null,
    }));
  }
  if (sections.length === 0) {
    const text = normalizeText(body.text);
    if (text) sections.push(unit("html", 0, "HTML document", text));
  }
  return sections;
}

async function hydrateHtmlVisuals(units, sourcePath) {
  for (const entry of units) {
    if (!entry.visualPending || entry.visualDataUrl || !entry.sourceRef) continue;
    const sourceRef = String(entry.sourceRef).trim().split(/[?#]/, 1)[0];
    if (!sourceRef || /^https?:/i.test(sourceRef)) continue;
    let imagePath;
    try {
      if (/^file:/i.test(sourceRef)) imagePath = fileURLToPath(sourceRef);
      else if (isAbsolute(sourceRef)) imagePath = sourceRef;
      else if (/^[a-z][a-z0-9+.-]*:/i.test(sourceRef)) continue;
      else imagePath = resolve(dirname(sourcePath), sourceRef);
      const content = await readFile(imagePath);
      if (content.length > MAX_VISUAL_BYTES) continue;
      const mime = IMAGE_MIME_BY_EXTENSION.get(extname(imagePath).toLowerCase());
      if (mime) entry.visualDataUrl = `data:${mime};base64,${content.toString("base64")}`;
    } catch { /* Missing or remote HTML assets remain explicitly pending. */ }
  }
  return units;
}

function delimitedDocumentUnits(source, delimiter) {
  return String(source ?? "").replace(/\r\n/g, "\n").split("\n").map((line, index) => {
    const cells = line.split(delimiter);
    return unit("row", index, `row ${index + 1}`, cells.join("\t"), { sourceType: "table-row" });
  }).filter((entry) => entry.text);
}

function plainTextDocumentUnits(source) {
  const paragraphs = String(source ?? "").replace(/\r\n/g, "\n").split(/\n{2,}/);
  return paragraphs.map((text, index) => unit("text", index, `text block ${index + 1}`, text)).filter((entry) => entry.text);
}

function officeElementText(element) {
  if (typeof element?.text === "string" && element.text.trim()) return element.text;
  if (typeof element?.preview === "string" && element.preview.trim()) return element.preview;
  if (typeof element?.value === "string" && element.value.trim()) return element.value;
  if (element?.formula) return `${element.path || "cell"}: ${element.formula}${element.value !== undefined ? ` = ${element.value}` : ""}`;
  const alt = element?.alt || element?.title || element?.name;
  return alt ? String(alt) : "";
}

export function officeElementsToUnits(elements, indexOffset = 0) {
  return (Array.isArray(elements) ? elements : []).map((element, index) => {
    const absoluteIndex = Math.max(0, Number(indexOffset) || 0) + index;
    const location = String(element?.path || element?.location || `office element ${absoluteIndex + 1}`);
    const type = String(element?.type || "element").toLowerCase();
    const text = normalizeText(officeElementText(element));
    const visual = ["picture", "image", "chart", "diagram", "shape-image"].includes(type);
    return unit("office", absoluteIndex, location, text || (visual ? `${type} 视觉内容` : ""), {
      sourceType: type,
      empty: !text,
      visualPending: visual,
      visualType: visual ? type : null,
    });
  });
}

function parseOfficePayload(value) {
  if (value && typeof value === "object") return value;
  const text = String(value ?? "").trim();
  try { return JSON.parse(text); } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("OfficeCLI returned non-JSON output");
  }
}

export function buildOfficeExtractionWarnings(units, total = null) {
  const nonVisualUnits = (Array.isArray(units) ? units : []).filter((unit) => unit?.visualPending !== true);
  const emptyUnits = nonVisualUnits.filter((unit) => unit?.empty === true || !String(unit?.text ?? "").trim());
  if (emptyUnits.length === 0) return [];
  const ratio = emptyUnits.length / Math.max(1, nonVisualUnits.length);
  const structurallyImportant = emptyUnits.some((unit) => ["table", "text", "textbox", "text-box"].includes(String(unit?.sourceType ?? "").toLowerCase()));
  const significant = structurallyImportant
    || emptyUnits.length === nonVisualUnits.length
    || (emptyUnits.length >= 3 && ratio >= 0.25);
  if (!significant) return [];
  const locations = emptyUnits.map((unit) => String(unit?.location || unit?.id || "office element")).slice(0, 20);
  const expected = Number.isFinite(Number(total)) ? Number(total) : null;
  return [{
    type: "office-empty-elements",
    count: emptyUnits.length,
    expected,
    actual: Array.isArray(units) ? units.length : 0,
    locations,
    message: `OfficeCLI returned ${emptyUnits.length} non-visual element(s) without readable text; the document may contain unsupported or hidden content and needs review.`,
  }];
}

export function runOfficeCliJson(executable, args, { signal, timeoutMs = 180_000, maxOutputBytes = 64 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Office document extraction cancelled", "AbortError"));
    const child = spawn(executable, args, {
      cwd: dirname(executable),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    const stdoutDecoder = new StringDecoder("utf8");
    const stderrDecoder = new StringDecoder("utf8");
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve(value);
    };
    const onAbort = () => {
      child.kill();
      finish(new DOMException("Office document extraction cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error(`OfficeCLI extraction timed out after ${timeoutMs}ms`));
    }, Math.max(1_000, Number(timeoutMs) || 180_000));
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      stdout += stdoutDecoder.write(chunk);
      if (stdoutBytes > maxOutputBytes) {
        child.kill();
        finish(new Error(`OfficeCLI output exceeded ${maxOutputBytes} bytes`));
      }
    });
    child.stderr.on("data", (chunk) => { stderr += stderrDecoder.write(chunk); });
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      stdout += stdoutDecoder.end();
      stderr += stderrDecoder.end();
      if (code !== 0) return finish(new Error(`OfficeCLI exited with code ${code}: ${stderr.trim().slice(0, 2_000)}`));
      try { finish(null, parseOfficePayload(stdout)); } catch (error) { finish(error); }
    });
  });
}

async function readOfficeUnits(path, options) {
  if (typeof options.runOfficeCli !== "function") throw new Error("OfficeCLI runtime is unavailable");
  const pageSize = Math.max(1, Math.min(500, options.policy.maxUnitsPerBatch || 20));
  const units = [];
  const seenPaths = new Set();
  const warnings = [];
  let start = 1;
  let total = null;
  let consecutiveNoProgress = 0;
  const captureRoot = options.captureVisuals ? await mkdtemp(join(tmpdir(), "visionox-office-visual-")) : null;
  try {
    for (let request = 0; request < 100_000; request++) {
      if (options.signal?.aborted) throw new DOMException("document extraction cancelled", "AbortError");
      const payload = parseOfficePayload(await options.runOfficeCli([
        "view", path, "text",
        "--start", String(start),
        "--end", String(start + pageSize - 1),
        "--max-lines", String(pageSize),
        "--json",
      ], { signal: options.signal }));
      if (payload?.success === false) throw new Error(payload?.error?.error || payload?.error || "OfficeCLI text extraction failed");
      const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
      const elements = Array.isArray(data?.elements) ? data.elements : [];
      if (Number.isFinite(Number(data?.totalElements))) total = Number(data.totalElements);
      let added = 0;
      for (const entry of officeElementsToUnits(elements, start - 1)) {
        const key = entry.location.toLowerCase();
        if (seenPaths.has(key)) continue;
        seenPaths.add(key);
        if (captureRoot && entry.visualPending) {
          const outputPath = join(captureRoot, `${entry.id}.png`);
          try {
            const screenshot = parseOfficePayload(await options.runOfficeCli([
              "view", path, "screenshot", "--range", entry.location,
              "--out", outputPath, "--render", "html", "--json",
            ], { signal: options.signal }));
            if (screenshot?.success !== false) {
              const image = await readFile(outputPath);
              if (image.length <= MAX_VISUAL_BYTES) entry.visualDataUrl = `data:image/png;base64,${image.toString("base64")}`;
            }
          } catch { /* The text and visual placeholder remain available for review. */ }
        }
        units.push(entry);
        added++;
      }
      consecutiveNoProgress = added === 0 ? consecutiveNoProgress + 1 : 0;
      const reachedTotal = total !== null && units.length >= total;
      if (reachedTotal) break;
      if (elements.length === 0 || added === 0) {
        const canProbeNextPage = total !== null && units.length < total && consecutiveNoProgress < 3;
        if (!canProbeNextPage) {
          if (total !== null && units.length !== total) {
            warnings.push({
              type: "office-element-count-mismatch",
              expected: total,
              actual: units.length,
              message: `OfficeCLI reported ${total} elements but ${units.length} unique elements were extracted.`,
            });
          }
          break;
        }
      }
      start += pageSize;
    }
  } finally {
    if (captureRoot) await rm(captureRoot, { recursive: true, force: true });
  }
  if (total !== null && units.length !== total && !warnings.some((warning) => warning.type === "office-element-count-mismatch")) {
    warnings.push({
      type: "office-element-count-mismatch",
      expected: total,
      actual: units.length,
      message: `OfficeCLI reported ${total} elements but ${units.length} unique elements were extracted.`,
    });
  }
  warnings.push(...buildOfficeExtractionWarnings(units, total));
  return { units, warnings };
}

function splitOversizedUnits(units, policy, countTokens) {
  const out = [];
  const tokenLimit = Math.max(1_024, Number(policy.batchInputTokens) || 8_000);
  const rendered = (id, location, text) => `--- Source unit ${id} (${location}) ---\n\n${text}`;
  for (const original of units) {
    const originalId = String(original?.id || "unit");
    const originalLocation = String(original?.location || originalId);
    const sourceText = String(original?.text ?? "");
    if (countTokens(rendered(originalId, originalLocation, sourceText)) <= tokenLimit) {
      out.push(original);
      continue;
    }
    let part = 0;
    const preview = (text, partNumber = part + 1) => ({
      ...original,
      id: `${originalId}-part-${String(partNumber).padStart(3, "0")}`,
      location: `${originalLocation} (part ${partNumber})`,
      text,
    });
    let offset = 0;
    while (offset < sourceText.length) {
      const partNumber = part + 1;
      const remaining = sourceText.length - offset;
      let low = 1;
      let high = remaining;
      let accepted = 0;
      while (low <= high) {
        const size = Math.floor((low + high) / 2);
        const candidate = sourceText.slice(offset, offset + size);
        const prepared = preview(candidate, partNumber);
        const fits = countTokens(rendered(prepared.id, prepared.location, candidate)) <= tokenLimit;
        if (fits) {
          accepted = size;
          low = size + 1;
        } else {
          high = size - 1;
        }
      }
      // The token limit includes a source-unit marker, but the normalized
      // minimum keeps enough room for at least one source character.
      const maxSize = Math.max(1, accepted);
      let end = offset + maxSize;
      const newline = sourceText.lastIndexOf("\n", end - 1);
      const minimumNewlineChunk = Math.max(1, Math.floor(maxSize / 2));
      if (newline >= offset + minimumNewlineChunk) end = newline + 1;
      if (end <= offset) end = Math.min(sourceText.length, offset + 1);
      const text = sourceText.slice(offset, end);
      part++;
      out.push({
        ...preview(text, part),
        text,
        sourceHash: createHash("sha256").update(text).digest("hex"),
        // A page image is shared context. Attach it to the first text part
        // only, otherwise a single large page multiplies the request body for
        // every part and can exhaust a multimodal model's image budget.
        visualDataUrl: part === 1 ? original.visualDataUrl || null : null,
        visualPending: original.visualPending === true && part === 1,
      });
      offset = end;
    }
  }
  return out;
}

function splitPdfBatchIntoPolicyBatches(batch, units, policy, countTokens) {
  const source = Array.isArray(units) ? units.filter(Boolean) : [];
  const groups = [];
  let current = [];
  let currentTokens = 0;
  let currentVisualUnits = 0;
  const tokenLimit = Math.max(1_024, Number(policy.batchInputTokens) || 8_000);
  const maxUnits = Math.max(1, Number(policy.maxUnitsPerBatch) || 20);
  const maxVisualUnits = Math.max(1, Number(policy.maxVisualUnitsPerBatch) || 5);
  const render = (unit) => `--- Source unit ${unit.id} (${unit.location}) ---\n\n${unit.text}`;
  const renderGroup = (group) => group.map(render).join("\n\n");
  const flush = () => {
    if (current.length === 0) return;
    groups.push({ units: current, estimatedTokens: currentTokens });
    current = [];
    currentTokens = 0;
    currentVisualUnits = 0;
  };
  for (const unit of source) {
    const candidate = [...current, unit];
    const candidateTokens = Math.max(1, Number(countTokens(renderGroup(candidate))) || 1);
    const isVisual = unit.visualPending === true;
    if (current.length > 0 && (
      current.length >= maxUnits ||
      candidateTokens > tokenLimit ||
      (isVisual && currentVisualUnits >= maxVisualUnits)
    )) flush();
    current.push(unit);
    currentTokens = Math.max(1, Number(countTokens(renderGroup(current))) || 1);
    if (isVisual) currentVisualUnits++;
  }
  flush();
  const parentId = String(batch?.id || `pages-${batch?.pageRange || "document"}`);
  const parentLabel = String(batch?.label || `PDF pages ${batch?.pageRange || ""}`).trim();
  const contextLimit = Math.max(128, Number(policy.contextOverlapTokens) || Math.floor(tokenLimit / 3));
  return groups.map((group, index) => {
    const multiple = groups.length > 1;
    const id = multiple ? `${parentId}-part-${String(index + 1).padStart(3, "0")}` : parentId;
    const adjacent = [];
    if (index > 0 && policy.semanticBatching !== false) {
      adjacent.push(createDocumentContextUnit(groups[index - 1].units.at(-1), "before", { maxTokens: contextLimit, countTokens }));
    }
    if (index + 1 < groups.length && policy.semanticBatching !== false) {
      adjacent.push(createDocumentContextUnit(groups[index + 1].units[0], "after", { maxTokens: contextLimit, countTokens }));
    }
    const contextUnits = [...(Array.isArray(batch?.contextUnits) ? batch.contextUnits : []), ...adjacent].filter(Boolean);
    const text = group.units.map(render).join("\n\n");
    return {
      ...batch,
      id,
      index: multiple ? (Number(batch?.index) || index + 1) * 1_000 + index + 1 : batch?.index,
      label: multiple ? `${parentLabel}（子区块 ${index + 1}/${groups.length}）` : parentLabel,
      units: group.units,
      contextUnits,
      unitIds: group.units.map((unit) => unit.id),
      estimatedTokens: group.estimatedTokens,
      totalChars: group.units.reduce((sum, unit) => sum + String(unit.text || "").length, 0),
      text,
    };
  });
}

async function processUnits(units, options) {
  const countTokens = typeof options.countTokens === "function" ? options.countTokens : (text) => Math.ceil(String(text).length / 2);
  const expanded = splitOversizedUnits(units, options.policy, countTokens);
  const batches = chunkDocumentUnits(expanded, { ...options.policy, countTokens });
  await options.onPlan?.({ totalUnits: expanded.length, totalBatches: batches.length, unitLabel: "区块" });
  for (const batch of batches) await options.onBatch(batch);
  return {
    totalUnits: expanded.length,
    batches: batches.length,
    sourceChars: expanded.reduce((sum, entry) => sum + entry.text.length, 0),
    visualPending: expanded.filter((entry) => entry.visualPending).length,
    warnings: Array.isArray(options.warnings) ? options.warnings : [],
    largeDocument: batches.length > 1,
  };
}

async function processSingleDocumentSourceBatches(prepared, options = {}) {
  if (typeof options.onBatch !== "function") throw new TypeError("onBatch callback is required");
  const policy = normalizeDocumentPolicy(options.policy);
  const path = String(prepared?.readablePath || prepared?.sourcePath || "");
  const extension = extname(path).toLowerCase();
  const classified = classifyDocumentPath(path);
  const kind = ["pdf", "word", "spreadsheet", "presentation"].includes(prepared?.documentKind)
    ? prepared.documentKind
    : classified;
  if (kind === "pdf") {
    if (typeof options.processPdfBatches !== "function") throw new Error("PDF extraction runtime is unavailable");
    let totalUnits = 0;
    let visualPending = 0;
    let emittedBatches = 0;
    const result = await options.processPdfBatches(path, {
      maxPagesPerBatch: policy.maxUnitsPerBatch,
      maxTokensPerBatch: policy.batchInputTokens,
      contextOverlapTokens: policy.contextOverlapTokens,
      semanticBatching: policy.semanticBatching,
      maxVisualUnitsPerBatch: policy.maxVisualUnitsPerBatch,
      countTokens: options.countTokens,
      inspectVisuals: true,
      captureVisuals: options.captureVisuals === true,
      pages: options.pages,
      signal: options.signal,
      onPlan: options.onPlan,
      onBatch: async (batch) => {
        const pageUnits = (batch.pageTexts ?? []).map((entry) => ({
          id: `page-${entry.page}`,
          location: `PDF page ${entry.page}`,
          text: String(entry.text ?? ""),
          sourceHash: createHash("sha256").update(String(entry.text ?? "")).digest("hex"),
          sourceType: "page",
          visualPending: entry.visualPending === true,
          visualDataUrl: entry.visualDataUrl || null,
        }));
        const countTokens = typeof options.countTokens === "function" ? options.countTokens : (text) => Math.ceil(String(text).length / 2);
        const units = splitOversizedUnits(pageUnits, policy, countTokens);
        const contextUnits = (batch.contextPageTexts ?? []).map((entry) => ({
          id: `page-${entry.page}`,
          location: `PDF page ${entry.page}`,
          text: String(entry.text ?? ""),
          sourceType: "page-context",
          contextRole: entry.contextRole,
          contextOnly: true,
          contextTruncated: entry.contextTruncated === true,
        }));
        totalUnits += units.length;
        visualPending += units.filter((entry) => entry.visualPending).length;
        const parent = { ...batch, id: `pages-${batch.pageRange}`, label: `PDF pages ${batch.pageRange}`, units, contextUnits };
        const policyBatches = splitPdfBatchIntoPolicyBatches(parent, units, policy, countTokens);
        for (const policyBatch of policyBatches) {
          // The parent extractor index is not sufficient after a parent batch
          // is split: an unsplit later parent must still sort after every
          // child emitted here. Use one deterministic sequence for the actual
          // batches sent to the workflow.
          emittedBatches += 1;
          await options.onBatch({ ...policyBatch, index: emittedBatches });
        }
      },
    });
    return { ...result, totalUnits, batches: emittedBatches, visualPending, largeDocument: emittedBatches > 1 };
  }
  if (["word", "presentation"].includes(kind) || (kind === "spreadsheet" && ![".csv", ".tsv"].includes(extension))) {
    const extracted = await readOfficeUnits(path, { ...options, policy });
    return processUnits(extracted.units, { ...options, policy, warnings: extracted.warnings });
  }
  const text = await (options.readText ? options.readText(path, options.signal) : readFile(path, "utf8"));
  let units;
  if (classified === "html") {
    units = htmlDocumentUnits(text);
    if (options.captureVisuals) await hydrateHtmlVisuals(units, path);
  }
  else if (classified === "markdown") units = markdownDocumentUnits(text);
  else if (extension === ".csv") units = delimitedDocumentUnits(text, ",");
  else if (extension === ".tsv") units = delimitedDocumentUnits(text, "\t");
  else units = plainTextDocumentUnits(text);
  return processUnits(units, { ...options, policy });
}

function collectionSourceIdentity(source, index) {
  const sourcePath = String(source?.sourcePath || source?.readablePath || "document");
  const sourceName = basename(sourcePath) || `document-${index + 1}`;
  const hash = createHash("sha1").update(resolve(sourcePath)).digest("hex").slice(0, 8);
  return {
    sourceId: `source-${String(index + 1).padStart(3, "0")}-${hash}`,
    sourcePath,
    sourceName,
  };
}

function prefixCollectionUnit(value, identity) {
  const unitValue = value && typeof value === "object" ? value : {};
  return {
    ...unitValue,
    id: `${identity.sourceId}-${String(unitValue.id || "unit")}`,
    location: `${identity.sourceName} > ${String(unitValue.location || unitValue.id || "区块")}`,
    sourceId: identity.sourceId,
    sourcePath: identity.sourcePath,
    sourceName: identity.sourceName,
    sourceUnitId: String(unitValue.id || "unit"),
  };
}

function prefixCollectionBatch(batch, identity, index) {
  return {
    ...batch,
    id: `${identity.sourceId}-${String(batch?.id || `batch-${index}`)}`,
    index,
    label: `${identity.sourceName} · ${String(batch?.label || `区块 ${index}`)}`,
    units: (Array.isArray(batch?.units) ? batch.units : []).map((entry) => prefixCollectionUnit(entry, identity)),
    contextUnits: (Array.isArray(batch?.contextUnits) ? batch.contextUnits : []).map((entry) => prefixCollectionUnit(entry, identity)),
    sourceId: identity.sourceId,
    sourcePath: identity.sourcePath,
    sourceName: identity.sourceName,
  };
}

export async function processDocumentSourceBatches(prepared, options = {}) {
  const sources = Array.isArray(prepared?.sources) && prepared.sources.length > 0
    ? prepared.sources
    : [prepared];
  if (sources.length === 1) return processSingleDocumentSourceBatches(sources[0], options);
  if (typeof options.onBatch !== "function") throw new TypeError("onBatch callback is required");

  const totals = {
    totalUnits: 0,
    batches: 0,
    sourceChars: 0,
    visualPending: 0,
    selectedPages: 0,
    processedPages: 0,
  };
  const sourceSummaries = [];
  const warnings = [];
  let globalBatchIndex = 0;
  let allSourcesHavePageCounts = true;
  await options.onPlan?.({
    totalSources: sources.length,
    completedSources: 0,
    totalUnits: null,
    totalBatches: null,
    unitLabel: "区块",
  });

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    const source = sources[sourceIndex];
    const identity = collectionSourceIdentity(source, sourceIndex);
    let sourcePlan = null;
    const result = await processSingleDocumentSourceBatches(source, {
      ...options,
      pages: undefined,
      onPlan: async (plan = {}) => {
        sourcePlan = plan;
        await options.onPlan?.({
          totalSources: sources.length,
          completedSources: sourceIndex,
          currentSource: identity.sourceName,
          currentSourceIndex: sourceIndex + 1,
          totalUnits: totals.totalUnits + (Number(plan.totalUnits) || 0) || null,
          totalBatches: totals.batches + (Number(plan.totalBatches) || 0) || null,
          unitLabel: "区块",
          estimating: sourceIndex + 1 < sources.length,
        });
      },
      onBatch: async (batch) => {
        globalBatchIndex++;
        await options.onBatch(prefixCollectionBatch(batch, identity, globalBatchIndex));
      },
    });
    const totalUnits = Number(result?.totalUnits) || 0;
    const batchCount = Number(result?.batches) || Number(sourcePlan?.totalBatches) || 0;
    totals.totalUnits += totalUnits;
    totals.batches += batchCount;
    totals.sourceChars += Number(result?.sourceChars) || 0;
    totals.visualPending += Number(result?.visualPending) || 0;
    if (Array.isArray(result?.warnings)) warnings.push(...result.warnings.map((warning) => ({ ...warning, sourceId: identity.sourceId, sourceName: identity.sourceName })));
    if (Number.isFinite(Number(result?.selectedPages)) && Number.isFinite(Number(result?.processedPages))) {
      totals.selectedPages += Number(result.selectedPages);
      totals.processedPages += Number(result.processedPages);
    } else {
      allSourcesHavePageCounts = false;
    }
    sourceSummaries.push({
      ...identity,
      documentKind: source?.documentKind || classifyDocumentPath(identity.sourcePath),
      totalUnits,
      batches: batchCount,
      sourceChars: Number(result?.sourceChars) || 0,
      visualPending: Number(result?.visualPending) || 0,
      warnings: Array.isArray(result?.warnings) ? result.warnings : [],
      selectedPages: Number.isFinite(Number(result?.selectedPages)) ? Number(result.selectedPages) : null,
      processedPages: Number.isFinite(Number(result?.processedPages)) ? Number(result.processedPages) : null,
    });
  }

  await options.onPlan?.({
    totalSources: sources.length,
    completedSources: sources.length,
    totalUnits: totals.totalUnits,
    totalBatches: totals.batches,
    unitLabel: "区块",
    estimating: false,
  });
  return {
    ...totals,
    selectedPages: allSourcesHavePageCounts ? totals.selectedPages : null,
    processedPages: allSourcesHavePageCounts ? totals.processedPages : null,
    sourceCount: sources.length,
    sourceSummaries,
    warnings,
    largeDocument: totals.batches > 1,
  };
}
