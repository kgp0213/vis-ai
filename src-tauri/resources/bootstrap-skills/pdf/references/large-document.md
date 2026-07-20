# Large PDF Processing

Use this workflow for text-based PDFs above 3000 pages, files above 200 MB, or any PDF
that the host reports as requiring segmentation.

## Decision Flow

1. Keep the original file unchanged.
2. Present the host's structured alternatives with `ask_choice`; do not print a prose menu.
3. Prefer a user-selected page range when only one chapter is needed.
4. Prefer host-managed logical page batches when the file remains readable.
5. Use physical chunking only when the file is too large for the host, parsing fails, or
   the user wants reusable volumes.

## Physical Chunking

Resolve `PDF_SKILL_DIR` from the `run_skill` result. Check the environment before invoking
the Python fallback; never install `pikepdf` without explicit approval.

```powershell
python "$env:PDF_SKILL_DIR\scripts\pdf.py" pages.chunk "huge.pdf" -o ".\huge-parts" --pages-per-file 200
```

The command writes contiguous files such as
`huge_part-001_pages-0001-0200.pdf` and a `manifest.json`. Keep the manifest with the
parts. Process parts in manifest order and preserve each original page range in the
Markdown output.

## Task Boundary

Physical chunking is a PDF format operation, not a task lifecycle. Return the generated
paths, original page ranges, and `manifest.json` to the active task. The general task
protocol decides which part runs next, when a checkpoint is valid, whether user input is
required, and when the requested delivery is complete.

## Recovery

Retain successful part outputs and `manifest.json`. Retry only failed page ranges. If at
least half of the selected pages contain almost no text, stop text parsing and explain
that OCR is required.
