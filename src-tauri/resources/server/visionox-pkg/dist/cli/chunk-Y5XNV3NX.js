#!/usr/bin/env node

// src/mcp/marketplace-overlay/loader.ts
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
var cache = null;
var cachedLang = null;
function loadOverlay(lang) {
  if (cachedLang === lang && cache) return cache;
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(dir, `${lang}.json`), "utf8");
    cache = JSON.parse(raw);
    cachedLang = lang;
    return cache;
  } catch {
    return null;
  }
}

export {
  loadOverlay
};
//# sourceMappingURL=chunk-Y5XNV3NX.js.map