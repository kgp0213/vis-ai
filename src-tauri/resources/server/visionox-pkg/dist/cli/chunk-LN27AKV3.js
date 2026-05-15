#!/usr/bin/env node

// src/cli/ui/primitives.tsx
import { Text, useStdout } from "ink";
import React from "react";
function ChromeRule() {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const w = Math.max(20, cols - 2);
  return /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "\u2500".repeat(w));
}
function Bar({
  ratio,
  color,
  cells = 14,
  dim
}) {
  const filled = Math.max(0, Math.min(cells, Math.round(ratio * cells)));
  return /* @__PURE__ */ React.createElement(Text, null, /* @__PURE__ */ React.createElement(Text, { color, dimColor: dim }, "\u25B0".repeat(filled)), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "\u25B1".repeat(cells - filled)));
}

export {
  ChromeRule,
  Bar
};
//# sourceMappingURL=chunk-LN27AKV3.js.map