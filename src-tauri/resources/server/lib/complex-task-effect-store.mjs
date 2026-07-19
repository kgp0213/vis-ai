import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { atomicWriteFile } from "./atomic-file.mjs";

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function normalizeEffectId(value) {
  const effectId = typeof value === "string" ? value.trim() : "";
  if (!effectId) throw new TypeError("effectId is required");
  return effectId;
}

function effectFileName(effectId) {
  return `${createHash("sha256").update(effectId).digest("hex")}.json`;
}

function corruptEffectError(effectId, cause) {
  const error = new Error(`effect intent is corrupt: ${effectId}`, { cause });
  error.code = "EFFECT_INTENT_CORRUPT";
  return error;
}

export function createFileEffectStore(rootDir, options = {}) {
  const root = resolve(String(rootDir));
  const atomicWrite = options.atomicWrite ?? atomicWriteFile;

  function pathFor(effectId) {
    const id = normalizeEffectId(effectId);
    return join(root, effectFileName(id));
  }

  async function get(effectId) {
    const id = normalizeEffectId(effectId);
    try {
      const stored = JSON.parse(await readFile(pathFor(id), "utf8"));
      if (!stored || typeof stored !== "object" || Array.isArray(stored) || stored.effectId !== id) {
        throw corruptEffectError(id);
      }
      return clone(stored);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      if (error?.code === "EFFECT_INTENT_CORRUPT") throw error;
      if (error instanceof SyntaxError) throw corruptEffectError(id, error);
      throw error;
    }
  }

  async function put(effect) {
    if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
      throw new TypeError("effect intent must be an object with an effectId");
    }
    const value = clone(effect);
    value.effectId = normalizeEffectId(value.effectId);
    await atomicWrite(pathFor(value.effectId), `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return clone(value);
  }

  return { root, get, pathFor, put };
}
