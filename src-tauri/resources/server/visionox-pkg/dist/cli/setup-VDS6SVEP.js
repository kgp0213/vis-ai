#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  MultiSelect,
  SingleSelect
} from "./chunk-6PZ3CXBP.js";
import {
  ThemeProvider,
  useTheme
} from "./chunk-TJX6BFZZ.js";
import {
  Box_default,
  Text,
  render_default,
  require_react,
  source_default,
  use_app_default,
  use_input_default
} from "./chunk-6G3CUUFG.js";
import {
  PRESET_DESCRIPTIONS
} from "./chunk-2425HK6U.js";
import {
  loadDotenv
} from "./chunk-2UQP6H6T.js";
import {
  MCP_CATALOG
} from "./chunk-PLHAZOLZ.js";
import {
  detectSystemLanguage,
  getLanguage,
  getSupportedLanguages,
  notifyLanguageChange,
  onLanguageChange,
  setLanguage,
  t
} from "./chunk-RE4RAVFF.js";
import {
  defaultConfigPath,
  isPlausibleKey,
  listThemeNames,
  loadApiKey,
  loadBaseUrl,
  loadTheme,
  readConfig,
  redactKey,
  resolveThemePreference,
  writeConfig
} from "./chunk-XPDVG52A.js";
import {
  __toESM
} from "./chunk-TUK7OWJA.js";

// src/cli/commands/setup.tsx
var import_react3 = __toESM(require_react(), 1);

// src/cli/ui/Wizard.tsx
import { mkdirSync, statSync } from "fs";

// node_modules/ink-text-input/build/index.js
var import_react = __toESM(require_react(), 1);
function TextInput({ value: originalValue, placeholder = "", focus = true, mask, highlightPastedText = false, showCursor = true, onChange, onSubmit }) {
  const [state, setState] = (0, import_react.useState)({
    cursorOffset: (originalValue || "").length,
    cursorWidth: 0
  });
  const { cursorOffset, cursorWidth } = state;
  (0, import_react.useEffect)(() => {
    setState((previousState) => {
      if (!focus || !showCursor) {
        return previousState;
      }
      const newValue = originalValue || "";
      if (previousState.cursorOffset > newValue.length - 1) {
        return {
          cursorOffset: newValue.length,
          cursorWidth: 0
        };
      }
      return previousState;
    });
  }, [originalValue, focus, showCursor]);
  const cursorActualWidth = highlightPastedText ? cursorWidth : 0;
  const value = mask ? mask.repeat(originalValue.length) : originalValue;
  let renderedValue = value;
  let renderedPlaceholder = placeholder ? source_default.grey(placeholder) : void 0;
  if (showCursor && focus) {
    renderedPlaceholder = placeholder.length > 0 ? source_default.inverse(placeholder[0]) + source_default.grey(placeholder.slice(1)) : source_default.inverse(" ");
    renderedValue = value.length > 0 ? "" : source_default.inverse(" ");
    let i = 0;
    for (const char of value) {
      renderedValue += i >= cursorOffset - cursorActualWidth && i <= cursorOffset ? source_default.inverse(char) : char;
      i++;
    }
    if (value.length > 0 && cursorOffset === value.length) {
      renderedValue += source_default.inverse(" ");
    }
  }
  use_input_default((input, key) => {
    if (key.upArrow || key.downArrow || key.ctrl && input === "c" || key.tab || key.shift && key.tab) {
      return;
    }
    if (key.return) {
      if (onSubmit) {
        onSubmit(originalValue);
      }
      return;
    }
    let nextCursorOffset = cursorOffset;
    let nextValue = originalValue;
    let nextCursorWidth = 0;
    if (key.leftArrow) {
      if (showCursor) {
        nextCursorOffset--;
      }
    } else if (key.rightArrow) {
      if (showCursor) {
        nextCursorOffset++;
      }
    } else if (key.backspace || key.delete) {
      if (cursorOffset > 0) {
        nextValue = originalValue.slice(0, cursorOffset - 1) + originalValue.slice(cursorOffset, originalValue.length);
        nextCursorOffset--;
      }
    } else {
      nextValue = originalValue.slice(0, cursorOffset) + input + originalValue.slice(cursorOffset, originalValue.length);
      nextCursorOffset += input.length;
      if (input.length > 1) {
        nextCursorWidth = input.length;
      }
    }
    if (cursorOffset < 0) {
      nextCursorOffset = 0;
    }
    if (cursorOffset > originalValue.length) {
      nextCursorOffset = originalValue.length;
    }
    setState({
      cursorOffset: nextCursorOffset,
      cursorWidth: nextCursorWidth
    });
    if (nextValue !== originalValue) {
      onChange(nextValue);
    }
  }, { isActive: focus });
  return import_react.default.createElement(Text, null, placeholder ? value.length > 0 ? renderedValue : renderedPlaceholder : renderedValue);
}
var build_default = TextInput;

// src/cli/ui/Wizard.tsx
var import_react2 = __toESM(require_react(), 1);
var CATALOG_BY_NAME = new Map(MCP_CATALOG.map((e) => [e.name, e]));
var LANGUAGE_LABELS = {
  EN: "English",
  "zh-CN": "\u7B80\u4F53\u4E2D\u6587"
};
function Wizard({
  onComplete,
  onCancel,
  existingApiKey,
  forceApiKeyStep = false,
  validateApiKey = validateDeepSeekApiKey,
  initial
}) {
  const { exit } = use_app_default();
  const [, setLanguageVersion] = (0, import_react2.useState)(0);
  (0, import_react2.useEffect)(() => onLanguageChange(() => setLanguageVersion((v) => v + 1)), []);
  const [previewTheme, setPreviewTheme] = (0, import_react2.useState)(
    () => resolveThemePreference(initial?.theme ?? loadTheme(), process.env.REASONIX_THEME)
  );
  const [step, setStep] = (0, import_react2.useState)("language");
  const [data, setData] = (0, import_react2.useState)(() => ({
    language: getLanguage(),
    theme: resolveThemePreference(initial?.theme ?? loadTheme(), process.env.REASONIX_THEME),
    apiKey: existingApiKey ?? "",
    preset: initial?.preset ?? "auto",
    selectedCatalog: deriveInitialCatalog(initial?.mcp ?? []),
    catalogArgs: {}
  }));
  const [error, setError] = (0, import_react2.useState)(null);
  use_input_default((_input, key) => {
    if (key.escape && step !== "saved" && onCancel) onCancel();
  });
  const content = (() => {
    if (step === "language") {
      return /* @__PURE__ */ import_react2.default.createElement(
        LanguageStep,
        {
          initialValue: data.language,
          onSubmit: (lang) => {
            setLanguage(lang);
            notifyLanguageChange();
            setData((d) => ({ ...d, language: lang }));
            setStep("theme");
          }
        }
      );
    }
    if (step === "theme") {
      return /* @__PURE__ */ import_react2.default.createElement(
        ThemeStep,
        {
          initialValue: data.theme,
          onPreview: setPreviewTheme,
          onSubmit: (theme) => {
            setData((d) => ({ ...d, theme }));
            setStep(existingApiKey && !forceApiKeyStep ? "preset" : "apiKey");
          }
        }
      );
    }
    if (step === "apiKey") {
      return /* @__PURE__ */ import_react2.default.createElement(
        ApiKeyStep,
        {
          initialValue: data.apiKey,
          validateApiKey,
          onSubmit: (key) => {
            setData((d) => ({ ...d, apiKey: key }));
            setError(null);
            setStep("preset");
          },
          error,
          onError: setError
        }
      );
    }
    if (step === "preset") {
      return /* @__PURE__ */ import_react2.default.createElement(StepFrame, { title: t("wizard.presetTitle"), step: 1, total: 3 }, /* @__PURE__ */ import_react2.default.createElement(
        SingleSelect,
        {
          items: presetItems(),
          initialValue: data.preset,
          onSubmit: (preset) => {
            setData((d) => ({ ...d, preset }));
            setStep("mcp");
          }
        }
      ), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.selectFooter"))));
    }
    if (step === "mcp") {
      return /* @__PURE__ */ import_react2.default.createElement(StepFrame, { title: t("wizard.mcpTitle"), step: 2, total: 3 }, /* @__PURE__ */ import_react2.default.createElement(
        MultiSelect,
        {
          items: mcpItems(),
          initialSelected: data.selectedCatalog,
          onSubmit: (selected) => {
            setData((d) => ({ ...d, selectedCatalog: selected }));
            const needsArgs = selected.some((name) => CATALOG_BY_NAME.get(name)?.userArgs);
            setStep(needsArgs ? "mcpArgs" : "review");
          },
          footer: t("wizard.mcpFooterMulti")
        }
      ));
    }
    if (step === "mcpArgs") {
      const pending = data.selectedCatalog.filter((name) => {
        const entry2 = CATALOG_BY_NAME.get(name);
        return entry2?.userArgs && !data.catalogArgs[name];
      });
      if (pending.length === 0) {
        setStep("review");
        return null;
      }
      const currentName = pending[0];
      const entry = CATALOG_BY_NAME.get(currentName);
      return /* @__PURE__ */ import_react2.default.createElement(
        McpArgsStep,
        {
          entry,
          error,
          onSubmit: (value) => {
            setData((d) => ({
              ...d,
              catalogArgs: { ...d.catalogArgs, [currentName]: value }
            }));
            setError(null);
          },
          onError: setError
        }
      );
    }
    if (step === "review") {
      const specs = data.selectedCatalog.map((name) => buildSpec(name, data.catalogArgs));
      return /* @__PURE__ */ import_react2.default.createElement(StepFrame, { title: t("wizard.reviewTitle"), step: 3, total: 3 }, /* @__PURE__ */ import_react2.default.createElement(Box_default, { flexDirection: "column" }, /* @__PURE__ */ import_react2.default.createElement(
        SummaryLine,
        {
          label: t("wizard.reviewLabelLanguage"),
          value: LANGUAGE_LABELS[data.language]
        }
      ), /* @__PURE__ */ import_react2.default.createElement(SummaryLine, { label: t("wizard.reviewLabelApiKey"), value: redactKey(data.apiKey) }), /* @__PURE__ */ import_react2.default.createElement(SummaryLine, { label: t("wizard.reviewLabelTheme"), value: data.theme }), /* @__PURE__ */ import_react2.default.createElement(SummaryLine, { label: t("wizard.reviewLabelPreset"), value: data.preset }), /* @__PURE__ */ import_react2.default.createElement(
        SummaryLine,
        {
          label: t("wizard.reviewLabelMcp"),
          value: specs.length === 0 ? t("wizard.reviewMcpNone") : t("wizard.reviewMcpServers", { count: specs.length })
        }
      ), specs.map((spec, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: review-only render, order fixed
        /* @__PURE__ */ import_react2.default.createElement(Box_default, { key: i, paddingLeft: 14 }, /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, "\xB7 ", spec))
      )), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, null, t("wizard.reviewSavesTo", { path: defaultConfigPath() }))), error ? /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { color: "red" }, error)) : null, /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.reviewFooter")))), /* @__PURE__ */ import_react2.default.createElement(
        ReviewConfirm,
        {
          onConfirm: () => {
            try {
              const specsNow = data.selectedCatalog.map(
                (name) => buildSpec(name, data.catalogArgs)
              );
              const prev = readConfig();
              const next = {
                ...prev,
                apiKey: data.apiKey,
                preset: data.preset,
                theme: data.theme,
                mcp: specsNow,
                setupCompleted: true
              };
              writeConfig(next);
              setStep("saved");
              onComplete(next);
            } catch (e) {
              setError(t("wizard.reviewSaveError", { message: e.message }));
            }
          }
        }
      ));
    }
    return /* @__PURE__ */ import_react2.default.createElement(Box_default, { flexDirection: "column", borderStyle: "round", borderColor: "green", paddingX: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { bold: true, color: "green" }, t("wizard.savedTitle")), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, null, t("ui.welcome"))), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.savedFooter"))), /* @__PURE__ */ import_react2.default.createElement(ExitOnEnter, { onExit: exit }));
  })();
  return /* @__PURE__ */ import_react2.default.createElement(ThemeProvider, { name: previewTheme }, content);
}
var THEME_NAMES = listThemeNames();
function ThemeStep({
  initialValue,
  onPreview,
  onSubmit
}) {
  const initialIndex = Math.max(0, THEME_NAMES.indexOf(initialValue));
  const [index, setIndex] = (0, import_react2.useState)(initialIndex);
  const theme = useTheme();
  use_input_default((_input, key) => {
    if (key.upArrow) {
      const next = (index - 1 + THEME_NAMES.length) % THEME_NAMES.length;
      setIndex(next);
      onPreview(THEME_NAMES[next]);
    } else if (key.downArrow) {
      const next = (index + 1) % THEME_NAMES.length;
      setIndex(next);
      onPreview(THEME_NAMES[next]);
    } else if (key.return) {
      onSubmit(THEME_NAMES[index]);
    }
  });
  return /* @__PURE__ */ import_react2.default.createElement(Box_default, { flexDirection: "column", borderStyle: "round", borderColor: theme.tone.brand, paddingX: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { bold: true, color: theme.tone.brand }, t("wizard.themeTitle")), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.themeSubtitle"))), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1, flexDirection: "column" }, THEME_NAMES.map((name, i) => /* @__PURE__ */ import_react2.default.createElement(Box_default, { key: name }, /* @__PURE__ */ import_react2.default.createElement(Text, { color: i === index ? theme.tone.brand : void 0 }, i === index ? "\u25B8 " : "  "), /* @__PURE__ */ import_react2.default.createElement(Text, { bold: i === index, color: i === index ? theme.fg.strong : theme.fg.body }, name), /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.fg.meta }, " \u2014 "), /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.fg.meta }, t(`wizard.themeCaption.${name}`))))), /* @__PURE__ */ import_react2.default.createElement(
    Box_default,
    {
      marginTop: 1,
      flexDirection: "column",
      borderStyle: "round",
      borderColor: theme.fg.faint,
      paddingX: 1
    },
    /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.fg.meta }, t("wizard.themeSampleHeading")),
    /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.tone.accent }, "\u25C6 "), /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.tone.accent }, t("wizard.themeSampleReasoning"))),
    /* @__PURE__ */ import_react2.default.createElement(Box_default, null, /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.tone.info }, "\u25A3 "), /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.fg.body }, "fs.readFile("), /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.tone.ok }, '"main.ts"'), /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.fg.body }, ")")),
    /* @__PURE__ */ import_react2.default.createElement(Box_default, null, /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.fg.meta }, "~/project/main.ts:42")),
    /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.tone.ok }, "ok"), /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.fg.faint }, " \xB7 "), /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.tone.warn }, "warn"), /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.fg.faint }, " \xB7 "), /* @__PURE__ */ import_react2.default.createElement(Text, { color: theme.tone.err }, "err"))
  ), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.themeFooter"))));
}
function LanguageStep({
  initialValue,
  onSubmit
}) {
  const items = getSupportedLanguages().map((code) => ({
    value: code,
    label: LANGUAGE_LABELS[code],
    hint: code === detectSystemLanguage() ? "(detected)" : void 0
  }));
  return /* @__PURE__ */ import_react2.default.createElement(Box_default, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { bold: true, color: "cyan" }, t("wizard.languageTitle")), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.languageSubtitle"))), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(
    SingleSelect,
    {
      items,
      initialValue,
      onSubmit,
      footer: t("wizard.selectFooter")
    }
  )));
}
function ApiKeyStep({
  initialValue,
  validateApiKey,
  onSubmit,
  error,
  onError
}) {
  const [value, setValue] = (0, import_react2.useState)("");
  const [checking, setChecking] = (0, import_react2.useState)(false);
  return /* @__PURE__ */ import_react2.default.createElement(Box_default, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { bold: true, color: "cyan" }, t("wizard.welcomeTitle")), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, null, t("wizard.apiKeyPrompt"))), /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.apiKeyGetOne")), /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.apiKeySavedLocally", { path: defaultConfigPath() })), initialValue ? /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.apiKeyPreview", { redacted: redactKey(initialValue) })) : null, /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { bold: true, color: "cyan" }, t("wizard.apiKeyInputLabel")), /* @__PURE__ */ import_react2.default.createElement(
    build_default,
    {
      value,
      onChange: setValue,
      onSubmit: (raw) => {
        const trimmed = raw.trim() || initialValue?.trim() || "";
        if (!isPlausibleKey(trimmed)) {
          onError(t("wizard.apiKeyInvalid"));
          setValue("");
          return;
        }
        setChecking(true);
        onError(null);
        void validateApiKey(trimmed).then((result) => {
          setChecking(false);
          if (!result.ok) {
            onError(
              result.reason === "rejected" ? t("wizard.apiKeyRejected") : t("wizard.apiKeyCheckFailed", { message: result.message ?? "unknown" })
            );
            setValue("");
            return;
          }
          onSubmit(trimmed);
        });
      },
      mask: "\u2022",
      placeholder: "sk-..."
    }
  )), checking ? /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { color: "yellow" }, t("wizard.apiKeyChecking"))) : error ? /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { color: "red" }, error)) : value ? /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.apiKeyPreview", { redacted: redactKey(value) }))) : null);
}
async function validateDeepSeekApiKey(apiKey, opts = {}) {
  const fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  let baseUrl = opts.baseUrl ?? loadBaseUrl() ?? "https://api.deepseek.com";
  while (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 1e4);
  try {
    const resp = await fetchImpl(`${baseUrl}/user/balance`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal
    });
    if (resp.ok) return { ok: true };
    if (resp.status === 401 || resp.status === 403) return { ok: false, reason: "rejected" };
    return { ok: false, reason: "failed", message: `DeepSeek ${resp.status}` };
  } catch (e) {
    return { ok: false, reason: "failed", message: e.message };
  } finally {
    clearTimeout(timer);
  }
}
function McpArgsStep({
  entry,
  error,
  onSubmit,
  onError
}) {
  const [value, setValue] = (0, import_react2.useState)("");
  const [pendingCreate, setPendingCreate] = (0, import_react2.useState)(null);
  use_input_default((input, key) => {
    if (!pendingCreate) return;
    const ch = input.toLowerCase();
    if (ch === "y" || key.return) {
      try {
        mkdirSync(pendingCreate, { recursive: true });
        const created = pendingCreate;
        setPendingCreate(null);
        setValue("");
        onError(null);
        onSubmit(created);
      } catch (e) {
        onError(
          t("wizard.mcpArgsDirCreateFailed", {
            path: pendingCreate,
            message: e.message
          })
        );
        setPendingCreate(null);
      }
    } else if (ch === "n" || key.escape) {
      setPendingCreate(null);
      onError(null);
    }
  });
  if (pendingCreate) {
    return /* @__PURE__ */ import_react2.default.createElement(StepFrame, { title: t("wizard.mcpArgsTitle", { name: entry.name }), step: 2, total: 3 }, /* @__PURE__ */ import_react2.default.createElement(Box_default, { flexDirection: "column" }, /* @__PURE__ */ import_react2.default.createElement(Text, null, t("wizard.mcpArgsDirMissing", { path: pendingCreate })), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.mcpArgsDirCreateHint"))), error ? /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { color: "red" }, error)) : null));
  }
  return /* @__PURE__ */ import_react2.default.createElement(StepFrame, { title: t("wizard.mcpArgsTitle", { name: entry.name }), step: 2, total: 3 }, /* @__PURE__ */ import_react2.default.createElement(Box_default, { flexDirection: "column" }, /* @__PURE__ */ import_react2.default.createElement(Text, null, entry.summary), entry.note ? /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, entry.note)) : null, /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, null, t("wizard.mcpArgsRequiredParam")), /* @__PURE__ */ import_react2.default.createElement(Text, { bold: true }, entry.userArgs)), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { bold: true, color: "cyan" }, entry.userArgs, " \u203A "), /* @__PURE__ */ import_react2.default.createElement(
    build_default,
    {
      value,
      onChange: setValue,
      onSubmit: (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          onError(t("wizard.mcpArgsEmpty", { name: entry.name }));
          return;
        }
        if (entry.name === "filesystem") {
          const check = checkFilesystemPath(trimmed);
          if (check.kind === "missing") {
            setPendingCreate(trimmed);
            return;
          }
          if (check.kind === "not-a-dir") {
            onError(t("wizard.mcpArgsNotADir", { path: trimmed }));
            return;
          }
        }
        onSubmit(trimmed);
        setValue("");
      },
      placeholder: placeholderFor(entry)
    }
  )), error ? /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1 }, /* @__PURE__ */ import_react2.default.createElement(Text, { color: "red" }, error)) : null));
}
function checkFilesystemPath(p) {
  try {
    return { kind: statSync(p).isDirectory() ? "ok" : "not-a-dir" };
  } catch {
    return { kind: "missing" };
  }
}
function ReviewConfirm({ onConfirm }) {
  use_input_default((_i, key) => {
    if (key.return) onConfirm();
  });
  return null;
}
function ExitOnEnter({ onExit }) {
  use_input_default((_i, key) => {
    if (key.return) onExit();
  });
  return null;
}
function StepFrame({
  title,
  step,
  total,
  children
}) {
  return /* @__PURE__ */ import_react2.default.createElement(Box_default, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1 }, /* @__PURE__ */ import_react2.default.createElement(Box_default, null, /* @__PURE__ */ import_react2.default.createElement(Text, { dimColor: true }, t("wizard.stepCounter", { step, total })), /* @__PURE__ */ import_react2.default.createElement(Text, { bold: true, color: "cyan" }, title)), /* @__PURE__ */ import_react2.default.createElement(Box_default, { marginTop: 1, flexDirection: "column" }, children));
}
function SummaryLine({ label, value }) {
  return /* @__PURE__ */ import_react2.default.createElement(Box_default, null, /* @__PURE__ */ import_react2.default.createElement(Text, null, label.padEnd(12)), /* @__PURE__ */ import_react2.default.createElement(Text, { bold: true }, value));
}
function presetItems() {
  return ["auto", "flash", "pro"].map((name) => ({
    value: name,
    label: `${name} \u2014 ${PRESET_DESCRIPTIONS[name].headline}`,
    hint: PRESET_DESCRIPTIONS[name].cost
  }));
}
function mcpItems() {
  return MCP_CATALOG.map((entry) => {
    const hintParts = [entry.summary];
    if (entry.userArgs) hintParts.push(t("wizard.mcpUserArgsHint", { arg: entry.userArgs }));
    if (entry.note) hintParts.push(entry.note);
    return {
      value: entry.name,
      label: entry.name,
      hint: hintParts.join(" \xB7 ")
    };
  });
}
function placeholderFor(entry) {
  if (entry.name === "filesystem") return "e.g. /tmp/reasonix-sandbox";
  if (entry.name === "sqlite") return "e.g. ./notes.sqlite";
  return entry.userArgs ?? "";
}
function deriveInitialCatalog(existingSpecs) {
  const packageToName = new Map(MCP_CATALOG.map((e) => [e.package, e.name]));
  const out = [];
  for (const spec of existingSpecs) {
    for (const [pkg, name] of packageToName) {
      if (spec.includes(pkg)) {
        out.push(name);
        break;
      }
    }
  }
  return out;
}
function buildSpec(name, argsByName) {
  const entry = CATALOG_BY_NAME.get(name);
  if (!entry) return name;
  const userArg = entry.userArgs ? argsByName[name] : void 0;
  const tail = userArg ? ` ${quoteIfNeeded(userArg)}` : "";
  return `${entry.name}=npx -y ${entry.package}${tail}`;
}
function quoteIfNeeded(s) {
  return /\s|"/.test(s) ? `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : s;
}

// src/cli/commands/setup.tsx
async function setupCommand(opts = {}) {
  loadDotenv();
  const existingKey = loadApiKey();
  const existing = readConfig();
  const { waitUntilExit, unmount } = render_default(
    /* @__PURE__ */ import_react3.default.createElement(
      Wizard,
      {
        existingApiKey: existingKey,
        initial: { preset: existing.preset, mcp: existing.mcp, theme: existing.theme },
        forceApiKeyStep: opts.forceKeyStep,
        onComplete: () => {
        },
        onCancel: () => {
          unmount();
        }
      }
    ),
    { exitOnCtrlC: true, patchConsole: false }
  );
  await waitUntilExit();
}
export {
  setupCommand
};
//# sourceMappingURL=setup-VDS6SVEP.js.map