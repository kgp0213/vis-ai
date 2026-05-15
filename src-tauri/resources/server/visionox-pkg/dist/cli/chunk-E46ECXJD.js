#!/usr/bin/env node

// src/cli/ui/presets.ts
var PRESETS = {
  auto: {
    model: "deepseek-v4-flash",
    reasoningEffort: "max",
    autoEscalate: true
  },
  flash: {
    model: "deepseek-v4-flash",
    reasoningEffort: "max",
    autoEscalate: false
  },
  pro: {
    model: "deepseek-v4-pro",
    reasoningEffort: "max",
    autoEscalate: false
  }
};
var PRESET_DESCRIPTIONS = {
  auto: {
    headline: "flash \u2192 pro on hard turns",
    cost: "default \xB7 ~96% turns stay on flash \xB7 pro kicks in only when needed"
  },
  flash: {
    headline: "v4-flash always",
    cost: "cheapest \xB7 predictable \xB7 /pro still works for a one-turn bump"
  },
  pro: {
    headline: "v4-pro always",
    cost: "~3\xD7 flash (5/31 discount) / ~12\xD7 full price \xB7 for hard multi-turn work"
  }
};
function resolvePreset(name) {
  if (name === "auto" || name === "flash" || name === "pro") return PRESETS[name];
  if (name === "fast") return { ...PRESETS.flash, reasoningEffort: "high" };
  if (name === "smart") return PRESETS.auto;
  if (name === "max") return PRESETS.pro;
  return PRESETS.auto;
}
function canonicalPresetName(name) {
  if (name === "auto" || name === "flash" || name === "pro") return name;
  return "auto";
}

export {
  PRESETS,
  PRESET_DESCRIPTIONS,
  resolvePreset,
  canonicalPresetName
};
//# sourceMappingURL=chunk-E46ECXJD.js.map