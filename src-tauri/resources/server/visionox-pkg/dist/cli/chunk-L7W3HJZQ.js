#!/usr/bin/env node
import {
  t
} from "./chunk-MHGPBJ2T.js";

// src/cli/ui/RecordView.tsx
import { Box, Text } from "ink";
import React from "react";
function RecordView({ rec, compact = false }) {
  const toolArgsMax = compact ? 120 : 200;
  const toolContentMax = compact ? 200 : 400;
  if (rec.role === "user") {
    const content = rec.content.includes("\n") ? rec.content.split("\n").join("\n      ") : rec.content;
    return /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: "cyan" }, t("recordView.userPrefix")), /* @__PURE__ */ React.createElement(Text, null, content));
  }
  if (rec.role === "assistant_final") {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Text, { bold: true, color: "green" }, t("recordView.assistant")), rec.cost !== void 0 ? /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "  $", rec.cost.toFixed(6)) : null, rec.usage ? /* @__PURE__ */ React.createElement(CacheBadge, { usage: rec.usage }) : null), rec.content ? /* @__PURE__ */ React.createElement(Text, null, rec.content) : /* @__PURE__ */ React.createElement(Text, { dimColor: true, italic: true }, t("recordView.toolCallOnly")));
  }
  if (rec.role === "tool") {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, t("recordView.toolPrefix"), rec.tool ?? "?", ">"), rec.args ? /* @__PURE__ */ React.createElement(Text, { dimColor: true }, t("recordView.argsLabel"), truncate(rec.args, toolArgsMax)) : null, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, t("recordView.resultArrow"), truncate(rec.content, toolContentMax)));
  }
  if (rec.role === "error") {
    return /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "red", bold: true }, t("recordView.error")), /* @__PURE__ */ React.createElement(Text, { color: "red" }, rec.error ?? rec.content));
  }
  if (rec.role === "done" || rec.role === "assistant_delta") {
    return null;
  }
  return /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "[", rec.role, "] ", rec.content));
}
function CacheBadge({ usage }) {
  const hit = usage.prompt_cache_hit_tokens ?? 0;
  const miss = usage.prompt_cache_miss_tokens ?? 0;
  const total = hit + miss;
  if (total === 0) return null;
  const pct = hit / total * 100;
  const color = pct >= 70 ? "green" : pct >= 40 ? "yellow" : "red";
  return /* @__PURE__ */ React.createElement(Text, null, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, t("recordView.cache")), /* @__PURE__ */ React.createElement(Text, { color }, pct.toFixed(1), "%"));
}
function truncate(s, max) {
  return s.length <= max ? s : `${s.slice(0, max)}${t("recordView.truncateExtra", { extra: s.length - max })}`;
}

export {
  RecordView
};
//# sourceMappingURL=chunk-L7W3HJZQ.js.map