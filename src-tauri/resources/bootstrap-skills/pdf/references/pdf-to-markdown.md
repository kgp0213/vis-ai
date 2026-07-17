# PDF to Markdown Contract

This reference defines the boundary between the PDF Skill and the host-managed
`organize_document_to_markdown` workflow.

## Responsibilities

The Skill owns strategy; the host owns execution.

The Skill selects the user's intent and editorial policy. The host owns deterministic
execution: document preparation, page boundaries, model calls, progress, retries, page
coverage, staging, and atomic save. Do not replace the host workflow with a shell loop,
`pdf.py extract.text`, or a manually assembled `write_file` call.

## Invocation

For a saved Markdown result, call exactly one high-level tool:

```json
{
  "input": "C:\\path\\source.pdf",
  "outputPath": "C:\\path\\result.md",
  "fidelity": "complete-with-summary",
  "instructions": "Optional user requirements"
}
```

Keep the original input path. The host creates and reuses the protected document reference.
Do not prepare or extract the PDF first for the same request. If the tool returns
`requiresUserChoice`, present its structured choices with `ask_choice`.

## Fidelity Selection

- `complete-with-summary` (default): preserve the complete source body, parameters,
  numbers, units, commands, code, tables, warnings, revisions, visuals, and source order;
  place a separate concise summary before the body.
- `summary-only`: intentionally compress content. Use it only when the user explicitly
  requests a brief, lossy result and set `summaryOnlyConfirmed: true`.

## Quality Pipeline

The host preserves pages as traceability units but processes semantic windows that may
span pages. Adjacent units are supplied as read-only boundary context so a sentence,
continued table, figure, or numbered procedure is not interpreted in isolation. Context
must not be emitted as owned body content. For each window the host:

1. Gives the model page-labelled source text and asks for Markdown only.
2. Verifies that every supplied page has a non-empty `source-page` section.
3. Runs deterministic retention checks for technical facts and page content.
4. Runs an independent model review against the original source and the draft, including
   captured page visuals when a configured multimodal model is available.
5. Requests a targeted repair when the review finds omissions, distortions, or unsupported
   claims, then reviews the repaired section again.
6. Splits a failed batch into smaller ranges and falls back to source text for an
   irrecoverable single page instead of silently dropping it.
7. Audits the final marker count, order, duplicates, unexpected context markers, and the
   persisted source manifest before committing the output.

The hidden source-unit markers are traceability metadata. Keep them in the Markdown
output; they allow later audits and targeted retries to map sections back to source pages.

## Fidelity Rules

Never invent facts to make a section smoother. Preserve exact model numbers, values,
units, commands, warnings, table rows, formulas, and revision identifiers. If the source
layout is ambiguous, state the uncertainty or retain the source text instead of guessing.
For scanned or image-only pages, stop and request OCR or a vision-capable workflow when
the host reports `likelyScanned`; do not silently treat an empty text extraction as a
complete document.

The tool result reports whether quality review passed and lists any degraded or repaired
pages. Surface those warnings to the user instead of claiming an unqualified success.
