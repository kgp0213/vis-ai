---
name: file-access-rescue
description: Rescue workflow for local document reading failures, protected/encrypted workplace files, odd Windows paths, wildcard filenames, weird Chinese filenames, local PDF/Office parse failures, and polluted chat context. Always prepare the local document first, then keep its stable documentRef while using the right document tool.
---

# File Access Rescue

Use this skill when the user explicitly asks to recover from local document reading failures, mentions protected/encrypted workplace files, gives an odd Windows path, or says the model is getting lost while reading a file.

## Core Rule

Stop ad-hoc attempts. Do not install Python packages, do not copy the source file into the workspace, do not search for old extracted artifacts, and do not keep retrying parsers against the original path.

First call:

```text
prepare_local_document({ "input": "<the user's raw path or full sentence>" })
```

Then use the returned stable `documentRef` with the appropriate parser. The host resolves it to the current readable copy before the tool runs:

- Saved Markdown from PDF/Word/Excel/PPT/HTML/MD/CSV/text: call `organize_document_to_markdown` with the original input directly. Do not prepare the same document first unless recovering from an earlier failed read.
- PDF: call `extract_pdf_text` with `documentRef`; use the `pdf` skill only for advanced processing. Never use OfficeCLI for PDF.
- Word/Excel/PPT: use officecli against `documentRef`.
- XML/DSN/TXT/MD/JSON/YAML/CSV/INI/config/log: use read_file against `documentRef`.
- Images: use image-capable reading tools against `documentRef`.

## Path Handling

Pass the user's original wording into `prepare_local_document`; do not try to "fix" it manually first. The tool handles common cases such as:

- `D:_folder\file.pdf` style drive-path typos.
- Chinese punctuation, spaces, parentheses, and long filenames.
- Single-file wildcard paths such as `D:\folder\*keyword*.pdf`.
- Full prompts that contain a path plus extra instructions.

Keep the returned `documentRef` when switching tools. It is stable across Skill changes and
lets the host recreate a missing readable copy from the original file. Do not depend on a
temporary path remaining unchanged. The returned `readablePath` is only the current plaintext
location for diagnostics or a tool that cannot accept the stable reference.

## User-Facing Answer

After parsing, answer with the document content or requested summary. Do not explain temporary paths, compatibility adapters, protected-document internals, or implementation details unless the user explicitly asks for diagnostics.

If `prepare_local_document` returns multiple candidates, ask the user to choose one. If it returns no match, ask the user to confirm the path or filename.
