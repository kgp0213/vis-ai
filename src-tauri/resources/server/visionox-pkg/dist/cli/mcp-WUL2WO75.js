#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  fetchSmitheryDetail,
  handleToFetchResult,
  loadMorePages,
  openRegistry,
  specStringFor
} from "./chunk-XJXDHAES.js";
import {
  MCP_CATALOG,
  mcpCommandFor
} from "./chunk-PLHAZOLZ.js";
import {
  defaultConfigPath,
  readConfig,
  writeConfig
} from "./chunk-XPDVG52A.js";
import "./chunk-TUK7OWJA.js";

// src/cli/commands/mcp.ts
var DEFAULT_LIST_LIMIT = 30;
var SEARCH_PAGE_CAP = 20;
var INSTALL_PAGE_CAP = 30;
var progressToStderr = ({ source, page, entries }) => {
  if (page === 1 || page % 5 === 0) {
    process.stderr.write(`\r\u25B8 fetching ${source} registry \xB7 page ${page} \xB7 ${entries} entries`);
  }
};
function finishProgressLine() {
  if (process.stderr.isTTY) process.stderr.write("\r\x1B[K");
  else process.stderr.write("\n");
}
function rankEntries(entries) {
  return [...entries].sort((a, b) => {
    const ap = a.popularity ?? -1;
    const bp = b.popularity ?? -1;
    if (ap !== bp) return bp - ap;
    return a.name.localeCompare(b.name);
  });
}
function pad(s, width) {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}
function fmtAge(ms) {
  const sec = Math.floor(ms / 1e3);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
function printEntry(e, indent = "  ") {
  const tag = e.source === "official" ? "[official]" : e.source === "smithery" ? "[smithery]" : "[local]";
  const pop = e.popularity !== void 0 ? ` \xB7 ${e.popularity.toLocaleString()} uses` : "";
  console.log(`${indent}${pad(e.name, 36)} ${tag}${pop}`);
  if (e.description) console.log(`${indent}    ${e.description}`);
  if (e.install?.requiredEnv?.length) {
    console.log(`${indent}    needs: ${e.install.requiredEnv.join(", ")}`);
  } else if (!e.install) {
    console.log(`${indent}    (smithery listing \u2014 install detail fetched lazily on install)`);
  }
}
async function mcpListCommand(opts = {}) {
  if (opts.local) {
    if (opts.json) {
      console.log(JSON.stringify(MCP_CATALOG, null, 2));
      return;
    }
    console.log("Bundled MCP servers (offline catalog):");
    console.log("");
    for (const entry of MCP_CATALOG) {
      console.log(`  ${pad(entry.name, 12)} ${entry.summary}`);
      console.log(`               ${mcpCommandFor(entry)}`);
      if (entry.note) console.log(`               \xB7 ${entry.note}`);
      console.log("");
    }
    return;
  }
  const handle = await openRegistry({ noCache: opts.refresh, onProgress: progressToStderr });
  const wantedPages = opts.all ? Number.POSITIVE_INFINITY : opts.pages ?? 1;
  const additional = Math.max(0, wantedPages - handle.cache.pagination.pagesLoaded);
  if (additional > 0) {
    await loadMorePages(handle, {
      pages: additional,
      onProgress: progressToStderr
    });
  }
  finishProgressLine();
  const result = handleToFetchResult(handle);
  const ranked = rankEntries(result.entries);
  const limit = opts.limit ?? DEFAULT_LIST_LIMIT;
  const shown = ranked.slice(0, limit);
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          source: result.source,
          fromCache: result.fromCache,
          fetchedAt: result.fetchedAt,
          loaded: result.entries.length,
          hasMore: result.hasMore,
          entries: shown
        },
        null,
        2
      )
    );
    return;
  }
  const ageStr = result.fromCache ? `cached, ${fmtAge(Date.now() - result.fetchedAt)}` : "just fetched";
  const moreStr = result.hasMore ? "more available" : "all loaded";
  console.log(
    `MCP servers from ${result.source} registry (${result.entries.length} loaded, ${moreStr}, ${ageStr}):`
  );
  if (result.errors.length > 0) {
    for (const e of result.errors) console.error(`  warn: ${e}`);
  }
  console.log("");
  for (const e of shown) printEntry(e);
  if (ranked.length > limit) {
    console.log(
      `  \u2026 ${ranked.length - limit} more loaded \u2014 use \`reasonix mcp search <query>\` to filter`
    );
  }
  if (result.hasMore) {
    console.log("  \u25B8 more pages available \u2014 `reasonix mcp list --pages <n>` or --all");
  }
  console.log("");
  console.log("Install:  reasonix mcp install <name>");
}
function matchFilter(query) {
  const q = query.toLowerCase();
  return (e) => `${e.name} ${e.title} ${e.description}`.toLowerCase().includes(q);
}
async function mcpSearchCommand(query, opts = {}) {
  const q = query.trim();
  if (!q) {
    console.error("usage: reasonix mcp search <query>");
    process.exit(1);
  }
  const handle = await openRegistry({ noCache: opts.refresh, onProgress: progressToStderr });
  const filter = matchFilter(q);
  const limit = opts.limit ?? DEFAULT_LIST_LIMIT;
  const cap = opts.maxPages ?? SEARCH_PAGE_CAP;
  await loadMorePages(handle, {
    pages: Math.max(0, cap - handle.cache.pagination.pagesLoaded),
    matchTarget: limit,
    filter,
    onProgress: progressToStderr
  });
  finishProgressLine();
  const result = handleToFetchResult(handle);
  const matches = rankEntries(result.entries.filter(filter));
  const shown = matches.slice(0, limit);
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          query: q,
          source: result.source,
          loaded: result.entries.length,
          hasMore: result.hasMore,
          matches: matches.length,
          entries: shown
        },
        null,
        2
      )
    );
    return;
  }
  if (shown.length === 0) {
    console.log(
      `No matches for "${q}" across ${result.entries.length} loaded entries (${result.source}${result.hasMore ? ", more pages exist \u2014 try --refresh or `mcp list --all`" : ""}).`
    );
    return;
  }
  console.log(
    `${matches.length} match(es) for "${q}" in ${result.source} registry (${result.entries.length} entries scanned):`
  );
  console.log("");
  for (const e of shown) printEntry(e);
  if (matches.length > limit) console.log(`  \u2026 ${matches.length - limit} more matches`);
}
function findEntry(entries, name) {
  const exact = entries.find((e) => e.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  const ci = entries.find((e) => e.name.toLowerCase() === lower);
  if (ci) return ci;
  const tail = entries.find((e) => e.name.toLowerCase().endsWith(`/${lower}`));
  if (tail) return tail;
  return null;
}
async function mcpInstallCommand(name, opts = {}) {
  const target = name.trim();
  if (!target) {
    console.error("usage: reasonix mcp install <name>");
    process.exit(1);
  }
  const handle = await openRegistry({ noCache: opts.refresh, onProgress: progressToStderr });
  const lower = target.toLowerCase();
  const filter = (e) => {
    const n = e.name.toLowerCase();
    return n === lower || n.endsWith(`/${lower}`) || n.includes(lower);
  };
  const cap = opts.maxPages ?? INSTALL_PAGE_CAP;
  await loadMorePages(handle, {
    pages: Math.max(0, cap - handle.cache.pagination.pagesLoaded),
    matchTarget: 1,
    filter,
    onProgress: progressToStderr
  });
  finishProgressLine();
  const entry = findEntry(handle.cache.entries, target);
  if (!entry) {
    console.error(
      `No MCP server named "${target}" found after walking ${handle.cache.pagination.pagesLoaded} page(s) of the ${handle.source} registry.`
    );
    if (handle.cache.pagination.nextCursor !== null) {
      console.error(`Try: reasonix mcp install ${target} --max-pages 100`);
    }
    process.exit(1);
  }
  if (!entry.install && entry.source === "smithery") {
    process.stderr.write(`\u25B8 fetching smithery install detail for ${entry.name}\u2026
`);
    const fetched = await fetchSmitheryDetail(entry.name);
    if (fetched) entry.install = fetched;
  }
  if (!entry.install) {
    console.error(
      `Could not derive install metadata for "${entry.name}" \u2014 try \`npx -y @smithery/cli install ${entry.name}\` directly.`
    );
    process.exit(1);
  }
  let spec;
  try {
    spec = specStringFor(entry.name, entry.install);
  } catch (err) {
    console.error(`Cannot build install spec for ${entry.name}: ${err.message}`);
    process.exit(1);
  }
  const cfg = readConfig();
  const existing = cfg.mcp ?? [];
  if (existing.includes(spec)) {
    console.log(`Already installed: ${spec}`);
    return;
  }
  const next = { ...cfg, mcp: [...existing, spec] };
  writeConfig(next);
  console.log(`Installed: ${entry.name}`);
  console.log(`  spec:    ${spec}`);
  const installedName = parseInstalledName(spec);
  if (entry.install.requiredEnv?.length) {
    console.log(`  needs:   ${entry.install.requiredEnv.join(", ")}`);
    console.log("           Either export these before launching, or add them to config:");
    console.log(`             mcpEnv.${installedName ?? entry.name} = { ... }`);
    console.log(
      `           (edit ${defaultConfigPath()} \u2014 values merge over process.env at spawn)`
    );
  }
  console.log("");
  console.log(
    "Use it:  reasonix chat   (or `reasonix code`) \u2014 the server will be bridged automatically."
  );
}
function parseInstalledName(spec) {
  const match = /^([a-zA-Z_][a-zA-Z0-9_-]*)=/.exec(spec);
  return match ? match[1] : null;
}
export {
  mcpInstallCommand,
  mcpListCommand,
  mcpSearchCommand
};
//# sourceMappingURL=mcp-WUL2WO75.js.map