#!/usr/bin/env node
import {
  RecordView
} from "./chunk-L7W3HJZQ.js";
import {
  diffTranscripts,
  findNextDivergence,
  findPrevDivergence,
  renderMarkdown,
  renderSummaryTable
} from "./chunk-VFG4GIT3.js";
import {
  readTranscript
} from "./chunk-7SPOFTMT.js";
import "./chunk-H4OLWRSX.js";
import {
  t
} from "./chunk-MHGPBJ2T.js";
import "./chunk-65Q5HQ26.js";
import "./chunk-ORM6PK57.js";

// src/cli/commands/diff.ts
import { writeFileSync } from "fs";
import { basename } from "path";
import { render } from "ink";
import React2 from "react";

// src/cli/ui/DiffApp.tsx
import { Box, Static, Text, useApp, useInput } from "ink";
import React, { useState } from "react";
function DiffApp({ report }) {
  const { exit } = useApp();
  const maxIdx = Math.max(0, report.pairs.length - 1);
  const initialIdx = report.firstDivergenceTurn ? report.pairs.findIndex((p) => p.turn === report.firstDivergenceTurn) : 0;
  const [idx, setIdx] = useState(Math.max(0, initialIdx));
  useInput((input, key) => {
    if (input === "q" || key.ctrl && input === "c") {
      exit();
      return;
    }
    if (input === "j" || key.downArrow || input === " " || key.return) {
      setIdx((i) => Math.min(maxIdx, i + 1));
    } else if (input === "k" || key.upArrow) {
      setIdx((i) => Math.max(0, i - 1));
    } else if (input === "g") {
      setIdx(0);
    } else if (input === "G") {
      setIdx(maxIdx);
    } else if (input === "n") {
      const next = findNextDivergence(report.pairs, idx);
      if (next !== -1) setIdx(next);
    } else if (input === "N" || input === "p") {
      const prev = findPrevDivergence(report.pairs, idx);
      if (prev !== -1) setIdx(prev);
    }
  });
  const pair = report.pairs[idx];
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(DiffHeader, { report }), /* @__PURE__ */ React.createElement(Box, { marginTop: 1, paddingX: 1, justifyContent: "space-between" }, /* @__PURE__ */ React.createElement(Text, { color: "cyan", bold: true }, t("diffApp.turnLabel", {
    turn: pair?.turn ?? "?",
    current: idx + 1,
    total: report.pairs.length
  })), /* @__PURE__ */ React.createElement(Text, null, pair ? /* @__PURE__ */ React.createElement(KindBadge, { kind: pair.kind }) : null)), /* @__PURE__ */ React.createElement(Box, { flexDirection: "row", marginTop: 1 }, /* @__PURE__ */ React.createElement(Pane, { label: report.a.label, headerColor: "blue", records: paneRecords(pair, "a") }), /* @__PURE__ */ React.createElement(Pane, { label: report.b.label, headerColor: "magenta", records: paneRecords(pair, "b") })), pair?.divergenceNote ? /* @__PURE__ */ React.createElement(Box, { marginTop: 1, paddingX: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, "\u2605 "), /* @__PURE__ */ React.createElement(Text, null, pair.divergenceNote)) : null, /* @__PURE__ */ React.createElement(Box, { marginTop: 1, paddingX: 1, borderStyle: "single", borderColor: "gray" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "j"), "/", /* @__PURE__ */ React.createElement(Text, { bold: true }, "\\u2193"), " next \\u00b7 ", /* @__PURE__ */ React.createElement(Text, { bold: true }, "k"), "/", /* @__PURE__ */ React.createElement(Text, { bold: true }, "\\u2191"), " prev \\u00b7 ", /* @__PURE__ */ React.createElement(Text, { bold: true }, "n"), " next-diverge \\u00b7", " ", /* @__PURE__ */ React.createElement(Text, { bold: true }, "N"), "/", /* @__PURE__ */ React.createElement(Text, { bold: true }, "p"), " prev-diverge \\u00b7 ", /* @__PURE__ */ React.createElement(Text, { bold: true }, "g"), "/", /* @__PURE__ */ React.createElement(Text, { bold: true }, "G"), " first/last \\u00b7 ", /* @__PURE__ */ React.createElement(Text, { bold: true }, "q"), " quit")));
}
function DiffHeader({ report }) {
  const a = report.a;
  const b = report.b;
  const cacheDelta = b.stats.cacheHitRatio - a.stats.cacheHitRatio;
  const costDelta = a.stats.totalCostUsd > 0 ? (b.stats.totalCostUsd - a.stats.totalCostUsd) / a.stats.totalCostUsd * 100 : 0;
  const aStable = a.stats.prefixHashes.length <= 1;
  const bStable = b.stats.prefixHashes.length <= 1;
  let prefixLine = null;
  if (aStable !== bStable) {
    const stableLabel = aStable ? report.a.label : report.b.label;
    const churnLabel = aStable ? report.b.label : report.a.label;
    const churnCount = aStable ? b.stats.prefixHashes.length : a.stats.prefixHashes.length;
    prefixLine = `${stableLabel} stayed byte-stable; ${churnLabel} churned ${churnCount} distinct prefixes.`;
  } else if (a.stats.prefixHashes[0] && a.stats.prefixHashes[0] === b.stats.prefixHashes[0]) {
    prefixLine = `shared prefix hash ${a.stats.prefixHashes[0].slice(0, 12)}\u2026 \u2014 cache delta attributable to log stability, not prompt change.`;
  }
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1 }, /* @__PURE__ */ React.createElement(Box, { justifyContent: "space-between" }, /* @__PURE__ */ React.createElement(Text, null, /* @__PURE__ */ React.createElement(Text, { color: "cyan", bold: true }, t("diffApp.title")), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, " \\u00b7 A="), /* @__PURE__ */ React.createElement(Text, { color: "blue" }, a.label), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, " vs B="), /* @__PURE__ */ React.createElement(Text, { color: "magenta" }, b.label)), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, t("diffApp.turnsAligned", { count: report.pairs.length }))), /* @__PURE__ */ React.createElement(Box, { marginTop: 1, gap: 3 }, /* @__PURE__ */ React.createElement(Text, null, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "cache "), /* @__PURE__ */ React.createElement(Text, null, (a.stats.cacheHitRatio * 100).toFixed(1), "%"), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, " \u2192 "), /* @__PURE__ */ React.createElement(Text, null, (b.stats.cacheHitRatio * 100).toFixed(1), "%"), /* @__PURE__ */ React.createElement(Text, { color: cacheDelta >= 0 ? "green" : "red", bold: true }, "  ", cacheDelta >= 0 ? "+" : "", (cacheDelta * 100).toFixed(1), "pp")), /* @__PURE__ */ React.createElement(Text, null, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "cost "), /* @__PURE__ */ React.createElement(Text, null, "$", a.stats.totalCostUsd.toFixed(6)), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, " \u2192 "), /* @__PURE__ */ React.createElement(Text, null, "$", b.stats.totalCostUsd.toFixed(6)), /* @__PURE__ */ React.createElement(Text, { color: costDelta <= 0 ? "green" : "red", bold: true }, "  ", costDelta >= 0 ? "+" : "", costDelta.toFixed(1), "%")), /* @__PURE__ */ React.createElement(Text, null, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "model calls "), /* @__PURE__ */ React.createElement(Text, null, a.stats.turns, " \u2192 ", b.stats.turns))), prefixLine ? /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { dimColor: true, italic: true }, prefixLine)) : null);
}
function Pane({
  label,
  headerColor,
  records
}) {
  return /* @__PURE__ */ React.createElement(
    Box,
    {
      flexDirection: "column",
      flexGrow: 1,
      paddingX: 1,
      borderStyle: "single",
      borderColor: headerColor
    },
    /* @__PURE__ */ React.createElement(Text, { color: headerColor, bold: true }, label),
    records.length === 0 ? /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { dimColor: true, italic: true }, t("diffApp.paneEmpty"))) : /* @__PURE__ */ React.createElement(Static, { items: records.map((rec, i) => ({ key: `${label}-${i}`, rec })) }, ({ key, rec }) => /* @__PURE__ */ React.createElement(RecordView, { key, rec, compact: true }))
  );
}
function KindBadge({ kind }) {
  if (kind === "match") {
    return /* @__PURE__ */ React.createElement(Text, { color: "green" }, t("diffApp.kindMatch"));
  }
  if (kind === "diverge") {
    return /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, t("diffApp.kindDiverge"));
  }
  if (kind === "only_in_a") {
    return /* @__PURE__ */ React.createElement(Text, { color: "blue" }, t("diffApp.kindOnlyInA"));
  }
  return /* @__PURE__ */ React.createElement(Text, { color: "magenta" }, t("diffApp.kindOnlyInB"));
}
function paneRecords(pair, side) {
  if (!pair) return [];
  const tools = side === "a" ? pair.aTools : pair.bTools;
  const assistant = side === "a" ? pair.aAssistant : pair.bAssistant;
  const out = [...tools];
  if (assistant) out.push(assistant);
  return out;
}

// src/cli/commands/diff.ts
async function diffCommand(opts) {
  const aParsed = readTranscript(opts.a);
  const bParsed = readTranscript(opts.b);
  const report = diffTranscripts(
    { label: opts.labelA ?? basename(opts.a), parsed: aParsed },
    { label: opts.labelB ?? basename(opts.b), parsed: bParsed }
  );
  const wantMarkdown = !!opts.mdPath;
  const wantPrint = opts.print || !process.stdout.isTTY;
  const wantTui = opts.tui || !wantPrint && !wantMarkdown;
  if (wantMarkdown) {
    console.log(renderSummaryTable(report));
    const md = renderMarkdown(report);
    writeFileSync(opts.mdPath, md, "utf8");
    console.log(`
markdown report written to ${opts.mdPath}`);
    return;
  }
  if (wantTui) {
    const { waitUntilExit } = render(React2.createElement(DiffApp, { report }), {
      exitOnCtrlC: true,
      patchConsole: false
    });
    await waitUntilExit();
    return;
  }
  console.log(renderSummaryTable(report));
}
export {
  diffCommand
};
//# sourceMappingURL=diff-YASCB7PU.js.map