import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createPreparedDocumentRegistry } from "./dlp-file.mjs";
import { createPreparedDocumentReader } from "./prepared-document-reader.mjs";

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), "visionox-prepared-reader-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("prepared document reader resolves a stable ref and returns one bounded PDF page window", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "manual.pdf");
    await writeFile(path, "%PDF-placeholder", "utf8");
    const registry = createPreparedDocumentRegistry();
    const prepared = registry.register({ sourcePath: path, readablePath: path, documentKind: "pdf" });
    const calls = [];
    const read = createPreparedDocumentReader({
      registry,
      extractPdfText: async (readablePath, options) => {
        calls.push({ readablePath, options });
        return {
          engine: "pdfjs",
          totalPages: 7,
          extractedPages: 2,
          requestedPageNumbers: [3, 4],
          totalChars: 22,
          truncated: false,
          likelyScanned: false,
          pages: [
            { page: 3, chars: 11, text: "page three", visualPending: false },
            { page: 4, chars: 11, text: "page four", visualPending: true },
          ],
        };
      },
    });

    const result = await read({ documentRef: prepared.documentRef, cursor: { page: 3 }, maxUnits: 2 });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].readablePath, prepared.readablePath);
    assert.equal(calls[0].options.pages, "3-4");
    assert.equal(result.ok, true);
    assert.equal(result.documentKind, "pdf");
    assert.equal(result.coverage.totalUnits, 7);
    assert.deepEqual(result.coverage.deliveredUnits, [3, 4]);
    assert.deepEqual(result.nextCursor, { page: 5 });
    assert.equal(result.complete, false);
    assert.equal(result.visualPending, 1);
    assert.match(result.content, /page three/);
    assert.doesNotMatch(JSON.stringify(result), /lifecycle|auto.?continu/i);
  });
});

test("prepared document reader supports generic text cursors without loading unbounded content", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "notes.txt");
    await writeFile(path, "first line\nsecond line\nthird line\n", "utf8");
    const registry = createPreparedDocumentRegistry();
    const prepared = registry.register({ sourcePath: path, readablePath: path, documentKind: "text" });
    const read = createPreparedDocumentReader({ registry });

    const first = await read({ documentRef: prepared.documentRef, maxChars: 12 });
    assert.equal(first.ok, true);
    assert.equal(first.complete, false);
    assert.match(first.content, /^first line/);
    assert.ok(Number.isInteger(first.nextCursor.byteOffset));

    const second = await read({ documentRef: prepared.documentRef, cursor: first.nextCursor, maxChars: 32 });
    assert.match(second.content, /second line/);
    assert.equal(second.complete, true);
  });
});

test("prepared document reader pages Word content through the same generic cursor contract", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "manual.docx");
    await writeFile(path, "placeholder", "utf8");
    const registry = createPreparedDocumentRegistry();
    const prepared = registry.register({ sourcePath: path, readablePath: path, documentKind: "word" });
    const calls = [];
    const read = createPreparedDocumentReader({
      registry,
      runOfficeCli: async (args) => {
        calls.push(args);
        return {
          success: true,
          data: {
            totalElements: 3,
            elements: [
              { path: "/body/p[1]", type: "paragraph", text: "Introduction" },
              { path: "/body/table[1]", type: "table", text: "Voltage\t3.3V" },
            ],
          },
        };
      },
    });

    const result = await read({ documentRef: prepared.documentRef, cursor: { unit: 1 }, maxUnits: 2 });
    assert.ok(calls[0].includes("--start") && calls[0].includes("1"));
    assert.ok(calls[0].includes("--end") && calls[0].includes("2"));
    assert.equal(result.documentKind, "word");
    assert.deepEqual(result.coverage.deliveredRange, [1, 2]);
    assert.deepEqual(result.nextCursor, { unit: 3 });
    assert.match(result.content, /Introduction/);
    assert.match(result.content, /Voltage/);
  });
});

test("prepared document reader fails clearly for unknown refs and unsupported formats", async () => {
  const registry = createPreparedDocumentRegistry();
  const read = createPreparedDocumentReader({ registry });
  await assert.rejects(() => read({ documentRef: "visionox-document:doc_00000000000000000000" }), /not found/i);
  registry.register({ sourcePath: "C:\\unsupported.bin", readablePath: "C:\\unsupported.bin", documentKind: "binary" });
  await assert.rejects(() => read({ documentRef: "C:\\unsupported.bin" }), /unsupported/i);
});

test("prepared Office reads surface a no-progress intervention instead of claiming completion", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "stalled.docx");
    await writeFile(path, "placeholder", "utf8");
    const registry = createPreparedDocumentRegistry();
    const prepared = registry.register({ sourcePath: path, readablePath: path, documentKind: "word" });
    const read = createPreparedDocumentReader({
      registry,
      runOfficeCli: async () => ({ success: true, data: { totalElements: 10, elements: [] } }),
    });

    const result = await read({ documentRef: prepared.documentRef, cursor: { unit: 5 } });
    assert.equal(result.complete, false);
    assert.equal(result.requiresIntervention, true);
    assert.equal(result.interventionReason, "document-reader-no-progress");
    assert.deepEqual(result.nextCursor, { unit: 5 });
  });
});
