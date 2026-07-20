# PDF to Markdown Contract

This workflow uses the ordinary foreground model and tools. It must remain reliable even
when this Skill is unavailable.

## Before Execution

Inspect the conversation and source metadata first. If one unresolved choice would
materially change page scope, fidelity, overwrite behavior, or output shape, call
`ask_choice` with exactly one question. Put the recommended option first and explain its
reason. Otherwise proceed without asking.

## Incremental Delivery

1. Call `prepare_local_document` once with the original path and retain `documentRef`.
2. Call `extract_pdf_text` for one bounded page range.
3. Convert only the delivered complete pages to Markdown.
4. Before requesting the next range, write the first batch with `write_file` or append
   the later batch with `append_file`. Check the successful tool result.
5. When `complete=false`, continue with the same `documentRef` and `nextPageRange` only
   after the current batch has been persisted.
6. Verify the output file, source order, and requested page coverage before completion.

If the runtime returns a `context:<sha256>` reference, call `read_context_input` with a
bounded `maxChars`. Persist that segment before reading the next offset. The cached text
is authoritative; never substitute a compressed conversation summary for it.

## Fidelity Rules

- Default to complete source body plus a separate concise summary.
- Preserve exact model numbers, values, units, commands, warnings, tables, formulas,
  revision identifiers, code, and source order.
- Use a lossy summary only when the user explicitly requested a brief result.
- Never invent facts or claim full coverage from a partial file.
- If caching, reading, writing, or coverage verification fails repeatedly, present the
  runtime intervention card so the user can continue, revise, accept partial output, or
  stop.

For scanned or image-only pages, stop and request OCR or a vision-capable workflow when
the host reports `likelyScanned`; do not silently treat empty extraction as complete.
