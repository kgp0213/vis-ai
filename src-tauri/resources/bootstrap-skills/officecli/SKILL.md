---
name: officecli
description: "Use OfficeCLI to create, read, edit, and automate Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) files. Single binary, no Office installation required. Trigger when the user wants to create, read, modify, analyze, validate, merge templates, or batch-process Office documents. Prefer MCP tools when available; fall back to shell commands when MCP is not connected."
---

# OfficeCLI — AI-native Office Suite CLI

OfficeCLI is a single binary that gives AI agents full control over Word, Excel, and PowerPoint files.

## Quick Reference

| Task | Command |
|------|---------|
| Create blank file | `officecli create output.pptx` |
| View content | `officecli view report.docx outline` (modes: outline, text, annotated, stats, issues, html, screenshot) |
| Get element as JSON | `officecli get deck.pptx /slide[1] --json` |
| Query elements | `officecli query report.docx "paragraph[style=Heading1]" --json` |
| Modify element | `officecli set deck.pptx /slide[1]/shape[1] --prop text="Hello" --prop size=28` |
| Add element | `officecli add deck.pptx / --type slide --prop title="Q4 Report"` |
| Remove element | `officecli remove report.docx /body/p[5]` |
| Validate document | `officecli validate report.docx` |
| Check issues | `officecli view report.docx issues --json` |
| Template merge | `officecli merge template.docx out.docx '{"key":"value"}'` |
| Batch operations | `officecli batch deck.pptx --commands '[{"command":"add",...}]' --json` |
| Live preview | `officecli watch deck.pptx` |
| Resident mode | `officecli open report.docx` → multiple edits → `officecli close report.docx` |
| View rendered HTML | `officecli view deck.pptx html` |

## When to use OfficeCLI

- Creating presentations, spreadsheets, or Word documents from scratch
- Reading and extracting data from existing Office files
- Editing: changing text, styles, layouts, formulas, charts, images
- Validating document quality before delivery
- Merging templates with JSON data ({{key}} placeholders)
- Batch processing multiple changes in one open/save cycle
- Rendering documents as HTML or PNG screenshots for visual inspection

When the user asks to turn an existing Word, Excel, or PowerPoint file into a saved
Markdown document, call `prepare_local_document` once and retain `documentRef`. Read one
bounded OfficeCLI text section, persist it with `write_file` or `append_file`, and verify
the write before reading the next section. Recover any context-input checkpoint through
`read_context_input` one bounded segment at a time. Use the direct OfficeCLI commands
below for reading, editing, validation, or layout-specific inspection.

## Path Addressing

Every element has a stable path. Agent navigates without understanding XML:
- `/slide[1]/shape[2]` — second shape on first slide
- `/body/p[3]/r[1]` — first run of third paragraph
- `/Sheet1` — sheet by name

## Error Recovery

Every command supports `--json`. Errors return structured objects with `code` and `suggestion`:
```json
{"success": false, "error": {"code": "not_found", "suggestion": "Valid index range: 1-8"}}
```
Always check errors and self-correct based on suggestions.

## Efficient generation

- For repeated deterministic edits, use `batch` rather than one tool call per shape, cell, or paragraph. Keep batches reviewable: normally one slide, sheet section, or document section per batch.
- The generic MCP `officecli` tool accepts exactly one CLI command in its `command` argument. Never concatenate multiple CLI commands with newlines.
- Every `batch` call must provide `--commands` or `--input`; otherwise the process waits for stdin and blocks the MCP request.
- Batch items use the `command` field, for example `{"command":"add","parent":"/slide[1]","type":"shape","props":{"text":"Hello"}}`.
- Check per-item batch results. Before retrying after a timeout, inspect the document because a write may have completed even if its response was lost.

## Built-in Help

When unsure about property names or formats:
```bash
officecli pptx set shape        # All settable properties for shapes
officecli pptx set shape.fill   # Fill property format and examples
officecli docx query            # Selector reference
```

## MCP Mode (Preferred)

When the OfficeCLI MCP server is connected in Visionox, use the generic `officecli` tool and pass one CLI command through its `command` argument. Commands return structured output without shell startup overhead.

## Shell Fallback

When MCP is not available, use shell commands with `--json` flag:
```bash
officecli create report.pptx
officecli add report.pptx / --type slide --prop title="Q4 Results" --json
```
Always append `--json` for parseable output. Use single quotes around paths on all platforms.
