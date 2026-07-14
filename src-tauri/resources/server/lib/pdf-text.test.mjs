import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { extractPdfText } from "./pdf-text.mjs";

function minimalPdf(text) {
  const escaped = text.replace(/[\\()]/g, "\\$&");
  const stream = `BT /F1 16 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
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
    await writeFile(path, minimalPdf("Visionox PDF extraction works"));
    const result = await extractPdfText(path);
    assert.equal(result.engine, "pdfjs");
    assert.equal(result.totalPages, 1);
    assert.equal(result.extractedPages, 1);
    assert.match(result.pages[0].text, /Visionox PDF extraction works/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
