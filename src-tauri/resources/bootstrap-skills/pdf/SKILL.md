---
name: pdf
metadata:
  author: Z.AI
  version: "1.1"
description: >
  Route PDF creation, conversion, merge, split, forms, repair, and validation.
  Detailed production rules stay in briefs and references and are loaded only when needed.
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

### Manipulate Or Repair

For merge, split, contiguous chunking, rotation, crop, forms, encryption, image export,
raw text fallback, or format conversion, read `briefs/process.md`. Use
`pages.chunk` rather than one-file-per-page splitting for very large documents so the
generated `manifest.json` preserves page ranges.

For large-file manipulation constraints, read `references/large-document.md`. These
commands are format operations only: return their evidence and artifacts to the active
task. They must not decide task continuation, completion, or user intervention.

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
