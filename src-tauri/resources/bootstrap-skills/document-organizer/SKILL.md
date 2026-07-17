---
name: document-organizer
description: Convert an existing PDF, Word, Excel, PowerPoint, HTML, Markdown, CSV, or text document into a saved Markdown artifact through Visionox's resumable background workflow. Use for complete extraction, organization, conversion, or summarization into a file, especially for large documents or weak local models.
license: MIT
---

# Document Organizer

Use the host-managed `organize_document_to_markdown` tool for the actual work. Do not
manually chain `prepare_local_document`, `extract_pdf_text`, OfficeCLI, `read_file`, or
`write_file` for the same saved-Markdown request.

## Default Contract

- Preserve the complete source body and add a separate summary at the beginning.
- Keep source order, tables, formulas, parameters, commands, links, warnings, code, and
  useful image or chart information.
- Use `summary-only` only when the user explicitly requests a brief, lossy summary and
  set `summaryOnlyConfirmed: true`.
- Keep the source read-only. Generate a non-conflicting Markdown filename by default. If
  an explicit output already exists or would overwrite the source, present the returned
  choices with `ask_choice`.
- Pass any user-specific organization request through `instructions`.

## Invocation

Call one high-level tool with the user's original path or the latest prepared document:

```json
{
  "input": "C:\\path\\source.docx",
  "outputPath": "C:\\path\\source-整理.md",
  "fidelity": "complete-with-summary",
  "instructions": "Optional user requirements"
}
```

If `outputPath` is omitted, the host creates a new Markdown file in the current
workspace. If a PDF above 3000 pages returns `requiresUserChoice`, use `ask_choice` and
process only the selected range or split volume. Ask only the unresolved question; do
not replace the structured choices with a prose menu.

## Runtime Behavior

The host extracts stable source units, processes cross-boundary semantic windows with
read-only adjacent context, checks deterministic coverage and factual retention, performs
a separate model review, retries failed blocks, and may use a healthy configured fallback
model only for failures. Page or element ids remain the traceability units; boundary
context cannot be duplicated into the body. A final source-order audit runs before the
host saves the file outside the model response, so a weak model cannot silently stop halfway.

The task continues in the background and appears under the input box's background-task
panel. The user may pause, resume, cancel, preview, or retry failed blocks. Failed blocks
retain deterministic source text and are marked for review; never report an unqualified
success when `qualityPassed` is false or visual content remains pending.

## Read-Only Requests

When the user only wants to read or discuss a document and does not want a saved Markdown
artifact, do not start this workflow. Use `prepare_local_document` followed by the
format-appropriate reader instead.
