---
name: pdf
metadata:
  author: Z.AI
  version: "1.1"
description: >
  Route PDF creation, extraction, conversion, merge, split, forms, and validation.
  Saved Markdown conversion uses Visionox's resumable document organizer; detailed
  production rules stay in briefs and references and are loaded only when needed.
license: Proprietary. LICENSE.txt has complete terms
---

# PDF Workbench Router

This file is a small router. Load only the brief or reference required by the current
task; do not place the complete PDF production manual into the model context.

## Runtime Path

`run_skill` includes this skill's absolute path in its result header. Use that path and
never assume a source checkout or installation directory.

Windows PowerShell:

```powershell
$env:PDF_SKILL_DIR = '<path from the run_skill result header>'
python "$env:PDF_SKILL_DIR\scripts\pdf.py" env.check
```

macOS/Linux:

```bash
export PDF_SKILL_DIR='<path from the run_skill result header>'
python3 "$PDF_SKILL_DIR/scripts/pdf.py" env.check
```

Do not run `setup.sh` directly on Windows. Never install dependencies automatically;
`env.fix --allow-install` requires explicit user approval.

## Route Existing PDFs

### Saved Markdown

For an actual saved Markdown artifact, read `references/pdf-to-markdown.md`. Use the
generic foreground flow: prepare once, retain `documentRef`, read one bounded batch with
`extract_pdf_text`, and persist it with `write_file` or `append_file` before reading the
next batch. A context-input memo is a checkpoint: recover it with `read_context_input`
and materialize one segment at a time.

Use complete body plus a separate summary unless the user explicitly requests a brief,
lossy summary. Verify page coverage and the actual output file before claiming success.
For PDFs above 3000 pages or a host segmentation response, also read
`references/large-document.md`.

### Read Or Discuss

When no saved Markdown file is requested:

1. Call `prepare_local_document` with the original user path or wording.
2. Call `extract_pdf_text` with the returned `documentRef`.
3. If `complete=false`, continue with the same `documentRef` and `nextPageRange` before
   summarizing.
4. If the file is scanned or image-only, use a vision/OCR-capable path or explain the
   limitation. Do not repeatedly run text parsers.

Do not use OfficeCLI for PDF files.

### Manipulate Or Repair

For merge, split, contiguous chunking, rotation, crop, forms, encryption, image export,
raw text fallback, or format conversion, read `briefs/process.md`. Use
`pages.chunk` rather than one-file-per-page splitting for very large documents so the
generated `manifest.json` preserves page ranges.

## Route New PDF Creation

| User intent | Load |
|---|---|
| Business report, proposal, contract, invoice, exam, ATS resume | `briefs/report.md` |
| Poster, flyer, invitation, certificate, visual resume | `briefs/creative.md`; add `briefs/poster.md` for posters |
| Paper, thesis, math-heavy document, Beamer, academic CV | `briefs/academic.md` |
| Existing PDF reformat or template-guided redesign | `briefs/process.md`, then the selected creation brief |

Read shared files only when the chosen brief points to them:

- `configs/`: fonts, reusable components, visual framework.
- `typesetting/`: cover, typography, pagination, overflow, tables, charts, palette,
  geometry, and fill rules.
- `reference.md` and `forms.md`: command and form-specific details.

## Universal Rules

- Preserve the source file unless the user explicitly confirms overwrite.
- CJK output must use fonts with verified glyph coverage.
- Keep figures as block-level content; do not let body text overlap them.
- Do not invent source facts, values, formulas, labels, or page coverage.
- Use system temporary directories for intermediate renders and remove them after the
  command. Deliver only requested outputs and their required manifests.
- Validate the generated PDF with the brief's prescribed checks before reporting
  completion. State the output path, page count, validation result, and any remaining
  warning.

## Tool Entry Points

```powershell
python "$env:PDF_SKILL_DIR\scripts\pdf.py" --help
python "$env:PDF_SKILL_DIR\scripts\pdf.py" env.check
python "$env:PDF_SKILL_DIR\scripts\pdf.py" qa.check output.pdf
python "$env:PDF_SKILL_DIR\scripts\pdf.py" pages.chunk huge.pdf -o volumes --pages-per-file 200
```

Detailed flags and recovery steps live in `briefs/process.md`; layout generation and
quality requirements live in the selected creation brief.
