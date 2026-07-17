import test from "node:test";
import assert from "node:assert/strict";

import { buildPdfDeliveryResult, formatPageRange, parsePageRange } from "./document-delivery.mjs";

function pages(count, chars = 80) {
  return Array.from({ length: count }, (_, index) => ({
    page: index + 1,
    chars,
    text: `page-${index + 1} ${"x".repeat(Math.max(0, chars - 8))}`,
  }));
}

test("page ranges are stable and compact", () => {
  assert.equal(formatPageRange([4, 2, 3, 9, 9, 10]), "2-4,9-10");
  assert.deepEqual(parsePageRange("2-4, 9,10"), [2, 3, 4, 9, 10]);
});

test("PDF delivery keeps complete pages and exposes continuation metadata", () => {
  const sourcePages = pages(6, 1200);
  const result = buildPdfDeliveryResult({
    base: { ok: true, documentRef: "visionox-document:test", totalPages: 6 },
    pages: sourcePages,
    requestedPageNumbers: [1, 2, 3, 4, 5, 6],
    maxTokens: 1500,
    reserveTokens: 0,
    countTokens: (text) => Math.ceil(text.length / 2),
  });
  assert.equal(result.complete, false);
  assert.equal(result.truncated, true);
  assert.equal(result.deliveryTruncated, true);
  assert.ok(result.pages.length > 0 && result.pages.length < sourcePages.length);
  assert.equal(result.remainingPageRange, `${result.pages.length + 1}-6`);
  assert.equal(result.nextPageRange, result.remainingPageRange);
  assert.doesNotThrow(() => JSON.stringify(result));
  assert.deepEqual(result.pages.map((page) => page.page), Array.from({ length: result.pages.length }, (_, index) => index + 1));
});

test("source truncation remains distinguishable from delivery truncation", () => {
  const result = buildPdfDeliveryResult({
    base: { ok: true, documentRef: "visionox-document:test", totalPages: 4 },
    pages: pages(2),
    requestedPageNumbers: [1, 2, 3, 4],
    sourceTruncated: true,
    maxTokens: 2000,
    countTokens: (text) => text.length,
  });
  assert.equal(result.complete, false);
  assert.equal(result.sourceTruncated, true);
  assert.equal(result.deliveryTruncated, false);
  assert.equal(result.remainingPageRange, "3-4");
});
