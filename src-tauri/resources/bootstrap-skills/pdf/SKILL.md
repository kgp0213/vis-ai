---
name: pdf
metadata:
  author: Z.AI
  version: "1.1"
description: >
  Route PDF reading, creation, conversion, merge, split, forms, repair, and validation.
  Detailed production rules stay in briefs and references and are loaded only when needed.
license: Proprietary. LICENSE.txt has complete terms
---

# PDF Workbench Router

This file is a small router. Load only the brief or reference required by the current
task; do not place the complete PDF production manual into the model context.

## Runtime Path

`run_skill` resolves this Skill's declared Python and Node requirements through the
Visionox runtime registry before returning these instructions. Reuse the injected
`VISIONOX_PYTHON`, `VISIONOX_NODE`, `VIRTUAL_ENV`, and `NODE_PATH` values when they are
present in the runtime capability header; never create
`.venv` or `node_modules` in the task/output directory.

The Python toolkit is optional for this router. If its capability is unavailable, use
the packaged Node/PDF reader for operations it supports and report that Python-only
operations require the user to configure or authorize a Python environment; do not
invent a path or run a package installer in the task directory.

Windows PowerShell:

```powershell
powershell.exe -NoProfile -Command "& $env:VISIONOX_PYTHON '<path from the run_skill result header>\scripts\pdf.py' env.check"
```

macOS/Linux:

```bash
sh -c '"$VISIONOX_PYTHON" "<path from the run_skill result header>/scripts/pdf.py" env.check'
```

`run_command` does not expand environment variables itself. Keep the PowerShell or
`sh -c` wrapper shown above so the child shell resolves the host-provided absolute
interpreter path. Environment assignments from an earlier command do not persist.

Do not run `setup.sh` or `env.fix --allow-install`. Never execute `npm install`,
`pip install`, or `python -m venv` yourself; the host runtime manager owns dependency
reuse, repair, installation approval, mirrors, and cache placement.

## Route Existing PDFs

### Manipulate Or Repair

For merge, split, contiguous chunking, rotation, crop, forms, encryption, image export,
raw text fallback, or format conversion, read `briefs/process.md`. Use
`pages.chunk` rather than one-file-per-page splitting for very large documents so the
generated `manifest.json` preserves page ranges.

For large-file manipulation constraints, read `references/large-document.md`. These
commands are format operations only: return their evidence and artifacts to the active
task. They must not decide task continuation, completion, or user intervention.

### Read, Extract, or Save Existing PDFs

Use the normal foreground model tool loop for PDF content work. This Skill does not
create a worker, queue, resumable conversion job, or PDF-specific continuation path.

1. Call `prepare_local_document` once and keep the returned `documentRef` and readable
   path for the active turn.
2. Probe the actually available reader before processing. Use a bounded range or page
   segment that fits the current model context; the host may provide a context-input
   memo when a segment must be recovered after compaction.
3. Write or append each verified segment immediately with the ordinary file tools before
   reading another segment. Keep source order and record page or section coverage.
   If an available command writes the target file directly, verify that file in place
   instead of reading the long output back into chat and recreating it manually.
4. Continue through the same ordinary tool loop until the requested source range is
   covered. Do not claim completeness from a partial read or from a summary alone.
5. Before reporting success, verify that the output file exists, is non-empty, and that
   its recorded coverage matches the requested source. State OCR, layout, table, image,
   or reader limitations explicitly.

For Word, Excel, PowerPoint, HTML, and text files, use the same generic sequence through
`prepare_local_document` and the available reader. Do not switch to a format-specific
background workflow.

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
powershell.exe -NoProfile -Command "& $env:VISIONOX_PYTHON '<skill path>\scripts\pdf.py' --help"
powershell.exe -NoProfile -Command "& $env:VISIONOX_PYTHON '<skill path>\scripts\pdf.py' env.check"
powershell.exe -NoProfile -Command "& $env:VISIONOX_PYTHON '<skill path>\scripts\pdf.py' qa.check output.pdf"
powershell.exe -NoProfile -Command "& $env:VISIONOX_PYTHON '<skill path>\scripts\pdf.py' pages.chunk huge.pdf -o volumes --pages-per-file 200"
```

Detailed flags and recovery steps live in `briefs/process.md`; layout generation and
quality requirements live in the selected creation brief.
