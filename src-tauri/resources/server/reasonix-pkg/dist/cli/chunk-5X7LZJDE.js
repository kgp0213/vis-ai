#!/usr/bin/env node

// src/gitignore.ts
import { readFileSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import ignore from "ignore";
async function loadGitignoreAt(dirAbs) {
  try {
    return ignore().add(await readFile(path.join(dirAbs, ".gitignore"), "utf8"));
  } catch {
    return null;
  }
}
function loadGitignoreAtSync(dirAbs) {
  try {
    return ignore().add(readFileSync(path.join(dirAbs, ".gitignore"), "utf8"));
  } catch {
    return null;
  }
}
function ignoredByLayers(layers, abs, isDir) {
  for (const layer of layers) {
    const rel = path.relative(layer.dirAbs, abs).split(path.sep).join("/");
    if (!rel || rel.startsWith("..")) continue;
    if (layer.ig.ignores(isDir ? `${rel}/` : rel)) return true;
  }
  return false;
}

export {
  loadGitignoreAt,
  loadGitignoreAtSync,
  ignoredByLayers
};
//# sourceMappingURL=chunk-5X7LZJDE.js.map