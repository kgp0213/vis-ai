const DEFAULT_RESERVE_TOKENS = 256;

function uniqueSortedPages(values) {
  return [...new Set((values ?? []).map((value) => Number(value)).filter((value) => Number.isSafeInteger(value) && value > 0))]
    .sort((a, b) => a - b);
}

export function formatPageRange(values) {
  const pages = uniqueSortedPages(values);
  const parts = [];
  let start = null;
  let previous = null;
  for (const page of pages) {
    if (start === null) {
      start = page;
      previous = page;
      continue;
    }
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    parts.push(start === previous ? String(start) : `${start}-${previous}`);
    start = page;
    previous = page;
  }
  if (start !== null) parts.push(start === previous ? String(start) : `${start}-${previous}`);
  return parts.join(",");
}

function pageNumbersForEntry(pages) {
  return uniqueSortedPages((pages ?? []).map((page) => page?.page));
}

function buildCandidate(base, requestedPages, selectedPages, allPages, sourceTruncated) {
  const selectedNumbers = new Set(pageNumbersForEntry(selectedPages));
  const deliveredNumbers = requestedPages.filter((page) => selectedNumbers.has(page));
  const remainingNumbers = requestedPages.filter((page) => !selectedNumbers.has(page));
  const complete = !sourceTruncated && remainingNumbers.length === 0;
  const deliveredChars = selectedPages.reduce((total, page) => total + Number(page?.chars ?? page?.text?.length ?? 0), 0);
  const sourceChars = allPages.reduce((total, page) => total + Number(page?.chars ?? page?.text?.length ?? 0), 0);
  return {
    ...base,
    extractedPages: selectedPages.length,
    requestedPages: requestedPages.length,
    totalChars: deliveredChars,
    sourceTotalChars: sourceChars,
    sourceTruncated: Boolean(sourceTruncated),
    truncated: !complete,
    deliveryTruncated: allPages.some((page) => !selectedNumbers.has(page?.page)),
    complete,
    deliveredPageRange: formatPageRange(deliveredNumbers),
    remainingPageRange: formatPageRange(remainingNumbers),
    nextPageRange: formatPageRange(remainingNumbers),
    pages: selectedPages,
  };
}

function fits(candidate, maxTokens, countTokens) {
  if (!Number.isSafeInteger(maxTokens) || maxTokens <= 0) return true;
  return countTokens(JSON.stringify(candidate)) <= maxTokens;
}

/**
 * Keep PDF tool results valid JSON and only split at complete page boundaries.
 * The generic tool registry can still protect non-document tools, but document
 * callers receive an explicit continuation range instead of a head/tail slice.
 */
export function buildPdfDeliveryResult({
  base,
  pages,
  requestedPageNumbers,
  sourceTruncated = false,
  maxTokens,
  countTokens,
  reserveTokens = DEFAULT_RESERVE_TOKENS,
}) {
  const allPages = Array.isArray(pages) ? pages : [];
  const requestedPages = uniqueSortedPages(requestedPageNumbers?.length ? requestedPageNumbers : pageNumbersForEntry(allPages));
  const tokenBudget = Number.isSafeInteger(maxTokens) && maxTokens > 0
    ? Math.max(1024, maxTokens - Math.max(0, reserveTokens))
    : null;
  const counter = typeof countTokens === "function" ? countTokens : (text) => text.length;

  if (!tokenBudget) {
    return buildCandidate(base, requestedPages, allPages, allPages, sourceTruncated);
  }

  const completeCandidate = buildCandidate(base, requestedPages, allPages, allPages, sourceTruncated);
  if (fits(completeCandidate, tokenBudget, counter)) return completeCandidate;

  let low = 0;
  let high = allPages.length;
  let best = buildCandidate(base, requestedPages, [], allPages, sourceTruncated);
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = buildCandidate(base, requestedPages, allPages.slice(0, middle), allPages, sourceTruncated);
    if (fits(candidate, tokenBudget, counter)) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

export function parsePageRange(range) {
  if (!range) return [];
  const pages = [];
  for (const rawPart of String(range).split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) continue;
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    for (let page = first; page <= last; page++) pages.push(page);
  }
  return uniqueSortedPages(pages);
}
