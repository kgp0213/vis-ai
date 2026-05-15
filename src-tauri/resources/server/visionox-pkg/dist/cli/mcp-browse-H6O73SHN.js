#!/usr/bin/env node
import {
  loadDotenv
} from "./chunk-3Q3C4W66.js";
import {
  loadMorePages,
  openRegistry,
  specStringFor
} from "./chunk-SOZE7V7V.js";
import "./chunk-FM57FNPJ.js";
import {
  readConfig,
  writeConfig
} from "./chunk-SWLIVNTP.js";

// src/cli/commands/mcp-browse.tsx
import { Box, Text, render, useApp, useInput } from "ink";
import React, { useCallback, useEffect, useMemo, useState } from "react";
var VISIBLE_ROWS = 12;
function rankAndFilter(entries, query) {
  const q = query.trim().toLowerCase();
  const list = q ? entries.filter((e) => `${e.name} ${e.title} ${e.description}`.toLowerCase().includes(q)) : entries;
  return [...list].sort((a, b) => {
    const ap = a.popularity ?? -1;
    const bp = b.popularity ?? -1;
    if (ap !== bp) return bp - ap;
    return a.name.localeCompare(b.name);
  });
}
function McpBrowseApp() {
  const app = useApp();
  const [state, setState] = useState({
    handle: null,
    loading: true,
    query: "",
    selected: 0,
    status: "opening registry\u2026"
  });
  const setStatus = useCallback((status) => {
    setState((s) => ({ ...s, status }));
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const handle = await openRegistry({});
        if (cancelled) return;
        const ageMs = Date.now() - handle.fetchedAt;
        const ageStr = ageMs < 6e4 ? `${Math.floor(ageMs / 1e3)}s` : `${Math.floor(ageMs / 6e4)}m`;
        setState((s) => ({
          ...s,
          handle,
          loading: false,
          status: `${handle.source} \xB7 ${handle.cache.entries.length} entries${handle.fromCache ? ` \xB7 cached ${ageStr} ago` : ""}`
        }));
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, status: `error: ${err.message}` }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const filtered = useMemo(() => {
    if (!state.handle) return [];
    return rankAndFilter(state.handle.cache.entries, state.query);
  }, [state.handle, state.query]);
  const selected = filtered[state.selected];
  const fetchMore = useCallback(async () => {
    if (!state.handle || state.loading) return;
    if (state.handle.cache.pagination.nextCursor === null) {
      setStatus("no more pages \u2014 registry exhausted");
      return;
    }
    setState((s) => ({ ...s, loading: true, status: "loading more\u2026" }));
    try {
      const r = await loadMorePages(state.handle, { pages: 5 });
      setState((s) => ({
        ...s,
        loading: false,
        status: `+${r.newEntries} entries (${state.handle?.cache.entries.length ?? 0} total)${r.exhausted ? " \xB7 exhausted" : ""}`
      }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, status: `error: ${err.message}` }));
    }
  }, [state.handle, state.loading, setStatus]);
  const install = useCallback(
    (entry) => {
      if (!entry.install) {
        setStatus(`${entry.name} has no install info (smithery listing)`);
        return;
      }
      try {
        const spec = specStringFor(entry.name, entry.install);
        const cfg = readConfig();
        const existing = cfg.mcp ?? [];
        if (existing.includes(spec)) {
          setStatus(`already installed: ${spec}`);
          return;
        }
        writeConfig({ ...cfg, mcp: [...existing, spec] });
        setStatus(`installed \u2192 ${spec}`);
      } catch (err) {
        setStatus(`install failed: ${err.message}`);
      }
    },
    [setStatus]
  );
  useInput((input, key) => {
    if (key.escape || key.ctrl && input === "c") {
      app.exit();
      return;
    }
    if (key.upArrow) {
      setState((s) => ({ ...s, selected: Math.max(0, s.selected - 1) }));
      return;
    }
    if (key.downArrow) {
      setState((s) => ({ ...s, selected: Math.min(filtered.length - 1, s.selected + 1) }));
      return;
    }
    if (key.return) {
      if (selected) install(selected);
      return;
    }
    if (key.tab || key.ctrl && input === "n") {
      void fetchMore();
      return;
    }
    if (key.backspace || key.delete) {
      setState((s) => ({ ...s, query: s.query.slice(0, -1), selected: 0 }));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setState((s) => ({ ...s, query: s.query + input, selected: 0 }));
    }
  });
  const start = Math.max(
    0,
    Math.min(state.selected - Math.floor(VISIBLE_ROWS / 2), filtered.length - VISIBLE_ROWS)
  );
  const window = filtered.slice(Math.max(0, start), Math.max(0, start) + VISIBLE_ROWS);
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", paddingX: 1 }, /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Text, { bold: true, color: "cyan" }, "\u25C8 MCP marketplace"), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, `  \xB7  ${state.status}`)), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, null, "search: "), /* @__PURE__ */ React.createElement(Text, { color: "white" }, state.query || "(type to filter)"), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, `  ${filtered.length} match${filtered.length === 1 ? "" : "es"}`)), /* @__PURE__ */ React.createElement(Box, { marginTop: 1, flexDirection: "column" }, window.length === 0 ? /* @__PURE__ */ React.createElement(Text, { dimColor: true }, state.loading ? "loading\u2026" : "no entries") : window.map((e, i) => {
    const idx = (start || 0) + i;
    const active = idx === state.selected;
    const tag = e.source === "official" ? "[off]" : e.source === "smithery" ? "[smt]" : "[loc]";
    const pop = e.popularity !== void 0 ? ` \xB7 ${e.popularity.toLocaleString()}` : "";
    return /* @__PURE__ */ React.createElement(Box, { key: e.name }, /* @__PURE__ */ React.createElement(Text, { color: active ? "cyan" : void 0 }, active ? "\u25B8 " : "  "), /* @__PURE__ */ React.createElement(Text, { bold: active }, e.name.padEnd(40).slice(0, 40)), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, ` ${tag}${pop}`));
  })), selected ? /* @__PURE__ */ React.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: "white" }, selected.title), selected.description ? /* @__PURE__ */ React.createElement(Text, { dimColor: true }, selected.description.slice(0, 160)) : null, selected.install ? /* @__PURE__ */ React.createElement(Text, { dimColor: true }, `spec: ${selected.install.runtime} ${selected.install.packageId ?? selected.install.url ?? "\u2014"} \xB7 ${selected.install.transport}`) : /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "(smithery listing \u2014 install info not exposed)"), selected.install?.requiredEnv?.length ? /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, `needs: ${selected.install.requiredEnv.join(", ")}`) : null) : null, /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "type to filter \xB7 \u2191\u2193 pick \xB7 enter install \xB7 tab load more \xB7 esc quit")));
}
async function mcpBrowseCommand(_opts = {}) {
  loadDotenv();
  const { waitUntilExit } = render(/* @__PURE__ */ React.createElement(McpBrowseApp, null), {
    exitOnCtrlC: true,
    patchConsole: false
  });
  await waitUntilExit();
}
export {
  mcpBrowseCommand
};
//# sourceMappingURL=mcp-browse-H6O73SHN.js.map