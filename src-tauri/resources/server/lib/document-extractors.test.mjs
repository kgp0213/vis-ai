import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  htmlDocumentUnits,
  markdownDocumentUnits,
  officeElementsToUnits,
  processDocumentSourceBatches,
} from "./document-extractors.mjs";

test("Markdown extraction keeps heading sections as stable source units", () => {
  const units = markdownDocumentUnits("intro\n\n# Power\nVoltage 3.3V\n\n## Commands\nREGW 0xFF 0xAA");
  assert.deepEqual(units.map((unit) => unit.location), ["Document preface", "Power", "Power > Commands"]);
  assert.match(units[2].text, /REGW 0xFF/);
});

test("HTML extraction uses DOM structure and marks meaningful visual blocks pending", () => {
  const units = htmlDocumentUnits(`<!doctype html><html><body><h1>Report</h1><p>Voltage 3.3V</p><table><tr><th>Command</th><th>Value</th></tr><tr><td>FF</td><td>AA</td></tr></table><img src="chart.png" alt="Yield chart"></body></html>`);
  assert.ok(units.some((unit) => /Voltage 3\.3V/.test(unit.text)));
  assert.ok(units.some((unit) => /Command \| Value/.test(unit.text)));
  assert.ok(units.some((unit) => unit.visualPending === true && /Yield chart/.test(unit.text)));
});

test("HTML extraction preserves text in generic layout containers and flags CSS diagrams", () => {
  const units = htmlDocumentUnits('<html><body>Preface <div><span>Inline metric 42</span></div><section><p>Nested paragraph</p></section><div class="architecture-diagram"><span>API</span><span>Database</span></div></body></html>');
  assert.match(units.map((entry) => entry.text).join("\n"), /Preface/);
  assert.match(units.map((entry) => entry.text).join("\n"), /Inline metric 42/);
  assert.match(units.map((entry) => entry.text).join("\n"), /Nested paragraph/);
  assert.ok(units.some((entry) => entry.visualType === "html-layout" && /Database/.test(entry.text)));
});

test("OfficeCLI structured elements retain paths, tables and visual placeholders", () => {
  const units = officeElementsToUnits([
    { path: "/slide[1]/shape[1]", type: "shape", text: "Overview" },
    { path: "/slide[1]/table[1]", type: "table", text: "Metric\tValue\nYield\t99%" },
    { path: "/slide[2]/picture[1]", type: "picture", text: "", alt: "Failure diagram" },
  ]);
  assert.equal(units.length, 3);
  assert.equal(units[0].location, "/slide[1]/shape[1]");
  assert.match(units[1].text, /Yield/);
  assert.equal(units[2].visualPending, true);
});

test("cross-format batch processor paginates OfficeCLI instead of trusting one truncated response", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-office-source-"));
  try {
    const source = join(root, "manual.docx");
    await writeFile(source, "placeholder");
    const calls = [];
    const seen = [];
    const result = await processDocumentSourceBatches({ sourcePath: source, readablePath: source, documentKind: "word" }, {
      policy: { batchInputTokens: 1024, maxUnitsPerBatch: 2 },
      countTokens: (text) => text.length,
      runOfficeCli: async (args) => {
        calls.push(args);
        const startIndex = args.indexOf("--start");
        const start = startIndex >= 0 ? Number(args[startIndex + 1]) : 1;
        const elements = start === 1
          ? [{ path: "/body/p[1]", type: "paragraph", text: "one" }, { path: "/body/p[2]", type: "paragraph", text: "two" }]
          : start === 3 ? [{ path: "/body/p[3]", type: "paragraph", text: "three" }] : [];
        return { success: true, data: { totalElements: 3, elements } };
      },
      onBatch: async (batch) => seen.push(batch),
    });
    assert.equal(result.totalUnits, 3);
    assert.deepEqual(seen.map((batch) => batch.units.length), [2, 1]);
    assert.deepEqual(seen[0].contextUnits.map((unit) => [unit.location, unit.contextRole]), [["/body/p[3]", "after"]]);
    assert.deepEqual(seen[1].contextUnits.map((unit) => [unit.location, unit.contextRole]), [["/body/p[2]", "before"]]);
    assert.match(seen[0].units[0].sourceHash, /^[a-f0-9]{64}$/);
    assert.ok(calls.some((args) => args.includes("--start") && args.includes("3")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("OfficeCLI pagination continues past a duplicate fallback location and reconciles totalElements", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-office-reconcile-"));
  try {
    const source = join(root, "manual.docx");
    await writeFile(source, "placeholder");
    const starts = [];
    const batches = [];
    const result = await processDocumentSourceBatches({ sourcePath: source, readablePath: source, documentKind: "word" }, {
      policy: { batchInputTokens: 1024, maxUnitsPerBatch: 2 },
      countTokens: (text) => text.length,
      runOfficeCli: async (args) => {
        const start = Number(args[args.indexOf("--start") + 1]);
        starts.push(start);
        const page = (index, text) => ({ type: "paragraph", text });
        const elements = start === 1
          ? [page(1, "one"), page(2, "two")]
          : start === 3
            ? [page(3, "three"), page(4, "four")]
            : start === 5
              ? [page(5, "five")]
              : [];
        return { success: true, data: { totalElements: 5, elements } };
      },
      onBatch: async (batch) => batches.push(batch),
    });

    assert.equal(result.totalUnits, 5);
    assert.deepEqual(starts, [1, 3, 5]);
    assert.deepEqual(batches.flatMap((batch) => batch.units.map((unit) => unit.text)), ["one", "two", "three", "four", "five"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("empty non-visual Office elements remain explicit empty units instead of visual placeholders", () => {
  const units = officeElementsToUnits([
    { path: "/body/table[1]", type: "table", text: "" },
    { path: "/body/p[1]", type: "paragraph", text: "" },
  ]);

  assert.equal(units.length, 2);
  assert.ok(units.every((unit) => unit.empty === true));
  assert.ok(units.every((unit) => unit.text === ""));
  assert.ok(units.every((unit) => unit.visualPending !== true));
  assert.ok(units.every((unit) => !/视觉内容/.test(unit.text)));
});

test("an oversized PDF page is split into stable page-internal source units", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-pdf-page-split-"));
  try {
    const source = join(root, "large.pdf");
    await writeFile(source, "placeholder");
    const pageText = "0123456789".repeat(500);
    const extract = async () => {
      const batches = [];
      const result = await processDocumentSourceBatches({ sourcePath: source, readablePath: source, documentKind: "pdf" }, {
        policy: { batchInputTokens: 1024, maxUnitsPerBatch: 20 },
        countTokens: (text) => String(text).length,
        processPdfBatches: async (_path, options) => {
          await options.onBatch({
            pageRange: "1",
            pageNumbers: [1],
            pageTexts: [{ page: 1, text: pageText, chars: pageText.length }],
            contextPageTexts: [],
            batches: 1,
          });
          return { batches: 1, selectedPages: 1, processedPages: 1, sourceChars: pageText.length };
        },
        onBatch: async (batch) => batches.push(batch),
      });
      return { result, batches };
    };

    const first = await extract();
    const second = await extract();
    const firstUnits = first.batches.flatMap((batch) => batch.units);
    const secondUnits = second.batches.flatMap((batch) => batch.units);

    assert.ok(first.result.totalUnits > 1);
    assert.deepEqual(firstUnits.map((unit) => unit.id), secondUnits.map((unit) => unit.id));
    assert.deepEqual(firstUnits.map((unit) => unit.text).join(""), pageText);
    assert.ok(firstUnits.every((unit) => unit.id.startsWith("page-1-part-")));
    assert.ok(firstUnits.every((unit) => unit.text.length <= 922));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("HTML and Office visual assets are attached only during multimodal extraction", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-visuals-"));
  try {
    const imagePath = join(root, "chart.png");
    const htmlPath = join(root, "report.html");
    await writeFile(imagePath, Buffer.from("89504e470d0a1a0a", "hex"));
    await writeFile(htmlPath, '<html><body><img src="chart.png" alt="Yield"></body></html>');
    const htmlBatches = [];
    await processDocumentSourceBatches({ sourcePath: htmlPath, readablePath: htmlPath, documentKind: "html" }, {
      captureVisuals: true,
      onBatch: async (batch) => htmlBatches.push(batch),
    });
    assert.match(htmlBatches[0].units[0].visualDataUrl, /^data:image\/png;base64,/);

    const officePath = join(root, "deck.pptx");
    await writeFile(officePath, "placeholder");
    const officeBatches = [];
    let screenshotCalls = 0;
    await processDocumentSourceBatches({ sourcePath: officePath, readablePath: officePath, documentKind: "presentation" }, {
      captureVisuals: true,
      runOfficeCli: async (args) => {
        if (args.includes("screenshot")) {
          screenshotCalls++;
          const outputPath = args[args.indexOf("--out") + 1];
          await writeFile(outputPath, Buffer.from("89504e470d0a1a0a", "hex"));
          return { success: true, data: { path: outputPath } };
        }
        return { success: true, data: { totalElements: 1, elements: [{ path: "/slide[1]/picture[1]", type: "picture", alt: "Architecture" }] } };
      },
      onBatch: async (batch) => officeBatches.push(batch),
    });
    assert.equal(screenshotCalls, 1);
    assert.match(officeBatches[0].units[0].visualDataUrl, /^data:image\/png;base64,/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an oversized single text line is split below the configured token target", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-long-line-"));
  try {
    const source = join(root, "long.txt");
    await writeFile(source, "测".repeat(10_000));
    const batches = [];
    const result = await processDocumentSourceBatches({ sourcePath: source, readablePath: source, documentKind: "text" }, {
      policy: { batchInputTokens: 1024, maxUnitsPerBatch: 20 },
      countTokens: (text) => String(text).length,
      onBatch: async (batch) => batches.push(batch),
    });
    assert.ok(result.totalUnits > 1);
    assert.ok(batches.flatMap((batch) => batch.units).every((entry) => entry.text.length <= 922));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("multi-document extraction prefixes every batch and unit with stable source provenance", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-document-collection-"));
  try {
    const first = join(root, "first.md");
    const second = join(root, "second.md");
    await writeFile(first, "# Shared\nFirst value 3.3V", "utf8");
    await writeFile(second, "# Shared\nSecond value 5V", "utf8");
    const batches = [];
    const result = await processDocumentSourceBatches({
      ok: true,
      documentKind: "collection",
      sources: [
        { sourcePath: first, readablePath: first, documentKind: "markdown" },
        { sourcePath: second, readablePath: second, documentKind: "markdown" },
      ],
    }, {
      onBatch: async (batch) => batches.push(batch),
    });

    assert.equal(result.sourceCount, 2);
    assert.equal(result.sourceSummaries.length, 2);
    assert.equal(result.totalUnits, 2);
    assert.deepEqual(batches.map((batch) => batch.index), [1, 2]);
    assert.notEqual(batches[0].units[0].id, batches[1].units[0].id);
    assert.match(batches[0].units[0].id, /^source-001-[a-f0-9]{8}-markdown-/);
    assert.match(batches[1].units[0].id, /^source-002-[a-f0-9]{8}-markdown-/);
    assert.match(batches[0].units[0].location, /^first\.md > Shared/);
    assert.equal(batches[1].units[0].sourceName, "second.md");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
