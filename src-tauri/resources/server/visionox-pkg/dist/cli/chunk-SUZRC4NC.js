#!/usr/bin/env node
import {
  CARD,
  DEFAULT_THEME_NAME,
  FG,
  SURFACE,
  THEMES,
  TONE,
  TONE_ACTIVE,
  resolveThemeName,
  setActiveTheme
} from "./chunk-SWLIVNTP.js";

// src/cli/ui/theme/context.tsx
import React from "react";
var ThemeContext = React.createContext(THEMES[DEFAULT_THEME_NAME]);
function ThemeProvider({
  children,
  name
}) {
  const theme = THEMES[resolveThemeName(name)];
  const restoreActiveTheme = setActiveTheme(theme);
  React.useLayoutEffect(() => restoreActiveTheme, [restoreActiveTheme]);
  return /* @__PURE__ */ React.createElement(ThemeContext.Provider, { value: theme }, children);
}
function useThemeTokens() {
  return React.useContext(ThemeContext);
}
function useTheme() {
  return useThemeTokens();
}

// src/cli/ui/theme.ts
import React2 from "react";
function gradientFromTheme(theme) {
  return [
    theme.tone.ok,
    theme.tone.brand,
    theme.tone.info,
    theme.toneActive.brand,
    theme.toneActive.violet,
    theme.tone.accent,
    theme.toneActive.accent,
    theme.tone.err
  ];
}
function colorFromTheme(theme) {
  return {
    primary: theme.tone.brand,
    accent: theme.tone.accent,
    brand: theme.tone.ok,
    user: theme.tone.brand,
    assistant: theme.tone.ok,
    tool: theme.tone.warn,
    toolErr: theme.tone.err,
    info: theme.fg.sub,
    warn: theme.tone.warn,
    err: theme.tone.err,
    ok: theme.tone.ok
  };
}
function surfaceFromTheme(theme) {
  return {
    canvas: theme.surface.bg,
    shell: theme.surface.bgInput,
    card: theme.surface.bgElev,
    elev: theme.surface.bgElev,
    sel: theme.surface.bgInput,
    line: theme.fg.faint,
    lineSoft: theme.fg.meta
  };
}
function fgFromTheme(theme) {
  return {
    strong: theme.fg.strong,
    default: theme.fg.body,
    dim: theme.fg.sub,
    faint: theme.fg.meta,
    ghost: theme.fg.faint
  };
}
function proxyThemeValue(build) {
  const target = build();
  return new Proxy(target, {
    get(_target, prop) {
      return build()[prop];
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(build(), prop);
    },
    has(_target, prop) {
      return prop in build();
    },
    ownKeys() {
      return Reflect.ownKeys(build());
    }
  });
}
function currentTheme() {
  return {
    fg: FG,
    tone: TONE,
    toneActive: TONE_ACTIVE,
    surface: SURFACE,
    card: CARD
  };
}
function useColor() {
  const theme = useThemeTokens();
  return React2.useMemo(() => colorFromTheme(theme), [theme]);
}
var GRADIENT = proxyThemeValue(() => gradientFromTheme(currentTheme()));
var COLOR = proxyThemeValue(() => colorFromTheme(currentTheme()));
var GLYPH = {
  brand: "\u25C8",
  user: "\u25C7",
  assistant: "\u25C6",
  toolOk: "\u25A3",
  toolErr: "\u25A5",
  warn: "\u25B2",
  err: "\u2726",
  arrow: "\u203A",
  bullet: "\xB7",
  bar: "\u258E",
  thinBar: "\u258F",
  block: "\u2588",
  shade1: "\u2591",
  shade2: "\u2592",
  shade3: "\u2593",
  done: "\u2713",
  cur: "\u25B8",
  pending: "\u25CB",
  fail: "\u2717",
  running: "\u25CF",
  branch: "\u2523",
  branchEnd: "\u2517",
  branchStub: "\u2503",
  rule: "\u2500",
  spinFrames: ["\u25D0", "\u25D3", "\u25D1", "\u25D2"]
};
var SURFACE2 = proxyThemeValue(() => surfaceFromTheme(currentTheme()));
var FG2 = proxyThemeValue(() => fgFromTheme(currentTheme()));

export {
  ThemeProvider,
  useThemeTokens,
  useTheme,
  useColor,
  GRADIENT,
  COLOR,
  GLYPH
};
//# sourceMappingURL=chunk-SUZRC4NC.js.map