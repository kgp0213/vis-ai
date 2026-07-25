---
name: md-to-pdf-cjk
description: Use when converting Markdown to PDF with Chinese, Japanese, or Korean text and a compatible local CJK font is available.
author: zacjiang
version: 1.0.0
tags: markdown, pdf, chinese, japanese, korean, CJK, convert, report, document
---

# Markdown to PDF (CJK Support)

Convert Markdown to professional PDFs with full Chinese/Japanese/Korean text support.

This skill only generates a new PDF from Markdown. It does not read, extract, summarize,
repair, or decrypt an existing PDF and must never be used as a fallback PDF reader.

## Why This Exists

Most Markdown-to-PDF tools break on CJK characters, require LaTeX, or need heavy dependencies. This skill uses reportlab for lightweight, reliable PDF generation that works on any server — including 2GB RAM VPS instances.

## Usage

```bash
sh -c '"$VISIONOX_PYTHON" "<skill-path>/scripts/md_to_pdf.py" input.md output.pdf'
```

Use the absolute skill `path` shown in the `run_skill` result header for
`<skill-path>`. On macOS/Linux, `python3` may be the executable name.
The script arguments are `md_to_pdf.py input.md output.pdf`.

## Features

- ✅ Full CJK text rendering (Chinese, Japanese, Korean)
- ✅ Markdown headings, bold, italic, bullet lists, code blocks
- ✅ Tables with proper column alignment
- ✅ Automatic page breaks and numbering
- ✅ Lightweight — runs on minimal servers (2GB RAM)
- ✅ No LaTeX, no wkhtmltopdf, no Chrome/Puppeteer needed

## Supported Markdown Elements

- `# H1` through `#### H4` headings
- `**bold**` and `*italic*`
- `- bullet lists` (nested supported)
- `| table | rows |` (pipe-delimited tables)
- `` `inline code` `` and ``` code blocks ```
- `---` horizontal rules

## Dependencies

`run_skill` prepares the declared ReportLab environment through the host runtime
manager. Do not run `pip install` or create a virtual environment in the task folder.
If the returned runtime header does not contain `VISIONOX_PYTHON`, report the missing
capability and request a host-managed repair instead of installing locally.

## Font Configuration

The script auto-detects CJK fonts in common locations:
- `/usr/share/fonts/` (Linux)
- `/System/Library/Fonts/` (macOS)
- `C:\Windows\Fonts\` (Windows, when supported by the script/font configuration)

If no CJK font is found, it falls back to Helvetica (CJK characters will not render). Install a CJK font:

```bash
# RHEL/CentOS/Alibaba Cloud Linux
sudo yum install -y google-noto-sans-cjk-ttc-fonts

# Ubuntu/Debian
sudo apt install -y fonts-noto-cjk
```

## Use Cases

- Generate PDF reports from AI analysis (audit reports, summaries)
- Convert documentation to distributable format
- Create invoices, proposals, or contracts in CJK languages
- Batch convert multiple Markdown files to PDF
