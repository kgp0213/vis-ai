#!/usr/bin/env node

// src/env.ts
import { readFileSync } from "fs";
import { resolve } from "path";
function loadDotenv(path = ".env") {
  let raw;
  try {
    raw = readFileSync(resolve(process.cwd(), path), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === void 0) process.env[key] = value;
  }
}

export {
  loadDotenv
};
//# sourceMappingURL=chunk-3Q3C4W66.js.map