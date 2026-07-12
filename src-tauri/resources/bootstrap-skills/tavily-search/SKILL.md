---
name: tavily-search
description: Use when the user requests current web research through Tavily or wants concise search results with source URLs.
description_zh: 使用 Tavily 搜索实时网页信息并返回带来源链接的结果。
version: 1.0.0
license: MIT
metadata:
  builtin: true
  category: research
---

# Tavily Search

Use the bundled Node script. It uses only the packaged Node runtime and requires no Python installation.

## Credential

The script checks, in order:

1. `TAVILY_API_KEY` in the process environment.
2. `TAVILY_API_KEY=...` in `~/.visionox/.env`.

When the key is missing, ask the user to invoke `@tavily-search` from the chat input. Visionox displays a local password field and saves the key without putting it in the conversation.

## Commands

```bash
node "{baseDir}/scripts/tavily-search.mjs" --query "latest Rust async frameworks" --max-results 5 --format brave
node "{baseDir}/scripts/tavily-search.mjs" --query "Visionox display news" --include-answer --format json
node "{baseDir}/scripts/tavily-search.mjs" --query "Tavily API updates" --format md
```

Formats:

- `json`: Tavily response fields needed for research.
- `brave`: stable `{query, results:[{title,url,snippet}], answer?}` shape.
- `md`: compact Markdown links and snippets.

Keep `--max-results` between 1 and 10. Prefer 3-5 results, cite useful URLs, and do not expose the API key or raw authorization data.
