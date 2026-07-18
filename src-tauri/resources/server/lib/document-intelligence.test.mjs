import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDocumentContract,
  buildDocumentSectionMessages,
  buildDocumentSummaryMessages,
  chunkDocumentUnits,
  createDocumentContextUnit,
  evaluateDocumentAssembly,
  evaluateDocumentQuality,
  normalizeDocumentPolicy,
  documentTaskFingerprint,
  renderDocumentSourceFallback,
} from "./document-intelligence.mjs";

const technicalUnits = [
  {
    id: "page-1",
    location: "PDF page 1",
    text: "Startup warning: keep AVDD at 3.3V.\nREGW 0xFF 0xAA\nREGW 0x6F 0x01\n| Register | Value |\n| FF | AA |",
  },
  {
    id: "page-2",
    location: "PDF page 2",
    text: "Sleep sequence\nREGW 0x11 0x00\nWait 120ms\nREGW 0x29 0x00\n| Step | Delay |\n| Sleep out | 120ms |",
  },
];

test("summary prompt stays separate from the detailed document body", () => {
  const messages = buildDocumentSummaryMessages({
    title: "量产手册",
    sectionSummaries: ["第 1 节：电压限制和寄存器顺序。"],
    contract: { fidelity: "complete-with-summary", preserveSource: true },
  });
  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /executive summary/);
  assert.equal(messages[1].role, "user");
  assert.match(messages[1].content, /量产手册/);
  assert.match(messages[1].content, /电压限制/);
});

test("default boundary context budgeting and fallback provider normalization remain deterministic", () => {
  const context = createDocumentContextUnit({
    id: "page-2",
    location: "PDF page 2",
    text: "相邻页上下文。".repeat(200),
  }, "before");
  assert.equal(context.contextOnly, true);
  assert.equal(context.contextRole, "before");
  const policy = normalizeDocumentPolicy({ fallbackProviderIds: ["qwen", " qwen ", "deepseek"] });
  assert.deepEqual(policy.fallbackProviderIds, ["qwen", "deepseek"]);
});

test("document contract defaults every supported format to complete content plus a separate summary", () => {
  for (const sourcePath of ["manual.pdf", "manual.docx", "data.xlsx", "deck.pptx", "report.html", "notes.md"]) {
    const contract = buildDocumentContract({ sourcePath, outputPath: "result.md" });
    assert.equal(contract.fidelity, "complete-with-summary");
    assert.equal(contract.summaryPlacement, "before-body");
    assert.equal(contract.preserveSource, true);
    assert.equal(contract.requiresDecision, false);
  }
});

test("collection contracts validate every source and refuse overwriting any member", () => {
  const contract = buildDocumentContract({
    sourcePaths: ["manual.pdf", "data.xlsx", "notes.md"],
    outputPath: "report.md",
    title: "Cross-source review",
  });
  assert.equal(contract.contractKind, "document-collection");
  assert.equal(contract.format, "collection");
  assert.deepEqual(contract.sourceFormats, ["pdf", "spreadsheet", "markdown"]);
  assert.equal(contract.title, "Cross-source review");
  assert.match(contract.completionCriteria[0], /每个来源文件/);

  const overwrite = buildDocumentContract({ sourcePaths: ["one.md", "two.md"], outputPath: "two.md" });
  assert.equal(overwrite.requiresDecision, true);
  assert.equal(overwrite.decision.id, "source-overwrite");
  assert.throws(() => buildDocumentContract({ sourcePaths: ["one.md", "unsupported.bin"], outputPath: "report.md" }), /unsupported document format/);
});

test("legacy binary Office formats are rejected instead of being falsely advertised as OfficeCLI-compatible", () => {
  for (const sourcePath of ["legacy.doc", "legacy.xls", "legacy.ppt", "legacy.rtf"]) {
    assert.throws(() => buildDocumentContract({ sourcePath, outputPath: "result.md" }), /unsupported document format/);
  }
});

test("document task fingerprints are stable and include source version hints", () => {
  const input = {
    sourcePaths: ["C:/docs/manual.pdf"],
    sourceStats: [{ path: "C:/docs/manual.pdf", size: 42, mtimeMs: 100 }],
    outputPath: "C:/workspace/manual.md",
    contract: { fidelity: "complete-with-summary", instructions: "keep tables" },
  };
  const first = documentTaskFingerprint(input);
  assert.equal(first, documentTaskFingerprint(structuredClone(input)));
  assert.notEqual(first, documentTaskFingerprint({
    ...input,
    sourceStats: [{ ...input.sourceStats[0], mtimeMs: 101 }],
  }));
});

test("document contract refuses an implicit source overwrite and asks one decision at a time", () => {
  const contract = buildDocumentContract({ sourcePath: "report.html", outputPath: "report.html" });
  assert.equal(contract.requiresDecision, true);
  assert.equal(contract.decision.id, "source-overwrite");
  assert.equal(contract.decision.choices[0].id, "new-file");
  assert.equal(contract.decision.choices.length, 2);

  const existingOutput = buildDocumentContract({ sourcePath: "source.html", outputPath: "result.md", outputExists: true });
  assert.equal(existingOutput.requiresDecision, true);
  assert.equal(existingOutput.decision.id, "output-overwrite");
  assert.equal(existingOutput.decision.recommendedChoiceId, "new-file");
});

test("weak model padding cannot pass complete-document quality gates", () => {
  const weak = technicalUnits.map((unit) => (
    `<!-- source-unit: ${unit.id} -->\n\n### ${unit.location}\n\n本部分包含技术配置和操作说明，请参考原始文档。`.padEnd(220, "。")
  )).join("\n\n");
  const result = evaluateDocumentQuality({ units: technicalUnits, markdown: weak, fidelity: "complete-with-summary" });
  assert.equal(result.coverage.complete, true);
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((failure) => failure.type === "command-retention"));
});

test("a faithful technical result passes adaptive command, value, table and coverage checks", () => {
  const markdown = technicalUnits.map((unit) => (
    `<!-- source-unit: ${unit.id} -->\n\n### ${unit.location}\n\n${unit.text}`
  )).join("\n\n");
  const result = evaluateDocumentQuality({ units: technicalUnits, markdown, fidelity: "complete-with-summary" });
  assert.equal(result.passed, true);
  assert.equal(result.coverage.complete, true);
  assert.equal(result.metrics.commandRatio, 1);
});

test("Markdown table formatting retains commands and hexadecimal values are not mistaken for formulas", () => {
  const units = [{
    id: "page-1",
    location: "PDF page 1",
    text: "REGW 0xFF 0xAA\n0xF0 W 0x55\nHex values B7 A0 F4 are register data.",
  }];
  const markdown = [
    "<!-- source-unit: page-1 -->",
    "| Command | Operation | Value |",
    "| --- | --- | --- |",
    "| REGW 0xFF 0xAA | write | retained |",
    "| 0xF0 | W | 0x55 |",
    "Hex values B7 A0 F4 are register data.",
  ].join("\n");
  const result = evaluateDocumentQuality({ units, markdown });
  assert.equal(result.metrics.commandRatio, 1);
  assert.equal(result.metrics.sourceFormulas, 0);
  assert.ok(!result.failures.some((failure) => failure.type === "command-retention" || failure.type === "formula-retention"));
});

test("source fallback remains traceable and never drops a failed unit", () => {
  const fallback = renderDocumentSourceFallback(technicalUnits, "模型整理两次未通过");
  for (const unit of technicalUnits) {
    assert.match(fallback, new RegExp(`source-unit: ${unit.id}`));
    assert.match(fallback, new RegExp(unit.text.split("\\n")[0]));
  }
  assert.match(fallback, /需要复核/);
});

test("model document policy is bounded and chunks stay on stable unit boundaries", () => {
  const policy = normalizeDocumentPolicy({ batchInputTokens: 2048, batchOutputTokens: 4096, maxUnitsPerBatch: 2, maxRetries: 2, autoFallback: true });
  assert.equal(policy.batchInputTokens, 2048);
  assert.equal(policy.maxUnitsPerBatch, 2);
  assert.equal(policy.semanticBatching, true);
  assert.equal(policy.contextOverlapTokens, 682);
  assert.equal(policy.maxSplitDepth, 2);
  assert.equal(policy.maxModelCallsPerBatch, 24);
  assert.equal(policy.maxVisualUnitsPerBatch, 5);
  assert.equal(policy.requestTimeoutMs, 300_000);
  const batches = chunkDocumentUnits([
    ...technicalUnits,
    { id: "page-3", location: "PDF page 3", text: "final page" },
  ], { ...policy, countTokens: (text) => text.length });
  assert.deepEqual(batches.map((batch) => batch.units.map((unit) => unit.id)), [["page-1", "page-2"], ["page-3"]]);
  assert.deepEqual(batches[0].contextUnits.map((unit) => [unit.id, unit.contextRole]), [["page-3", "after"]]);
  assert.deepEqual(batches[1].contextUnits.map((unit) => [unit.id, unit.contextRole]), [["page-2", "before"]]);
});

test("visual source units respect the per-request image limit before model generation", () => {
  const units = Array.from({ length: 6 }, (_value, index) => ({
    id: `page-${index + 1}`,
    location: `PDF page ${index + 1}`,
    text: `visual page ${index + 1}`,
    visualPending: true,
  }));
  const batches = chunkDocumentUnits(units, {
    batchInputTokens: 8_000,
    maxUnitsPerBatch: 20,
    maxVisualUnitsPerBatch: 5,
  });
  assert.deepEqual(batches.map((batch) => batch.units.length), [5, 1]);
});

test("boundary context is read-only and cannot satisfy or duplicate owned-unit coverage", () => {
  const batch = {
    units: [technicalUnits[1]],
    contextUnits: [{ ...technicalUnits[0], contextRole: "before", contextOnly: true }],
  };
  const messages = buildDocumentSectionMessages({ batch, contract: { fidelity: "complete-with-summary" } });
  assert.match(messages[0].content, /read-only boundary context/i);
  assert.match(messages[1].content, /<boundary_context read_only="true">[\s\S]*page-1/);
  assert.match(messages[1].content, /<source_units>[\s\S]*page-2/);

  const repeatedContext = [
    `<!-- source-unit: page-1 -->\n\n${technicalUnits[0].text}`,
    `<!-- source-unit: page-2 -->\n\n${technicalUnits[1].text}`,
  ].join("\n\n");
  const quality = evaluateDocumentQuality({ units: batch.units, markdown: repeatedContext, fidelity: "complete-with-summary" });
  assert.equal(quality.passed, false);
  assert.deepEqual(quality.coverage.unexpectedUnitIds, ["page-1"]);
});

test("final assembly audit rejects missing, duplicate, unexpected, or reordered source units", () => {
  const faithful = "<!-- source-unit: page-1 -->\none\n<!-- source-unit: page-2 -->\ntwo";
  assert.equal(evaluateDocumentAssembly({ expectedUnitIds: ["page-1", "page-2"], markdown: faithful }).passed, true);

  const reordered = "<!-- source-unit: page-2 -->\ntwo\n<!-- source-unit: page-1 -->\none";
  const audit = evaluateDocumentAssembly({ expectedUnitIds: ["page-1", "page-2"], markdown: reordered });
  assert.equal(audit.passed, false);
  assert.equal(audit.orderMismatch, true);
});
