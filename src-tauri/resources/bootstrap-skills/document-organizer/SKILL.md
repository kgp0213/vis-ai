---
name: document-organizer
description: Convert an existing PDF, Word, Excel, PowerPoint, HTML, Markdown, CSV, or text document into a saved Markdown artifact with a generic foreground, incremental workflow. Use for complete extraction, organization, conversion, or summarization into a file, especially for large documents or weak local models.
license: MIT
---

# Document Organizer

Use the ordinary foreground tool loop. This Skill supplies strategy only; task reliability
must not depend on the Skill being loaded.

## Clarify Only High-Impact Ambiguity

First inspect the available conversation and source metadata. If one unresolved decision
would materially change scope, fidelity, overwrite behavior, or output structure, call
`ask_choice` with exactly one question. Put the recommended option first and state its
reason. Do not ask a list of questions or repeat facts already present in context.

## Single-Document Flow

1. Call `prepare_local_document` once with the original path and keep its `documentRef`.
2. Read one bounded batch with the format-appropriate reader:
   - PDF: `extract_pdf_text`.
   - Word/Excel/PowerPoint: an OfficeCLI text view.
   - HTML/Markdown/CSV/text: `read_file` with a bounded range when needed.
3. Immediately write the first processed batch with `write_file`; use `append_file` for
   every later batch.
4. Verify a successful write before reading more source content.
5. Continue with the next source range. For PDF, reuse `documentRef` and
   `nextPageRange` until `complete=true`.
6. Verify the actual file and requested source coverage before reporting completion.

When the runtime reports a cached context input, use `read_context_input` in bounded
segments. Materialize one segment before requesting the next. Never replace missing
source content with a context summary.

## Fidelity

- By default preserve the complete source body and add a separate concise summary.
- Keep source order, tables, formulas, parameters, commands, links, warnings, code, and
  useful image or chart information.
- A brief summary is intentionally lossy only when the user explicitly requested it.
- Keep the source read-only and use a non-conflicting output path unless overwrite was
  explicitly confirmed.
- Do not claim complete coverage from a partial output. If the runtime cannot cache or
  recover input, use the intervention card and let the user continue, revise, accept a
  partial result, or stop.

## Multiple Sources

When one result depends on relationships between multiple source documents, call
`organize_documents_to_report` once with all source paths. Keep that specialized
collection workflow; do not start unrelated single-file chains.
