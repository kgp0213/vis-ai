import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = new DOMException("source fingerprint cancelled", "AbortError");
    throw error;
  }
}
export async function fingerprintFile(path, { signal } = {}) {
  const sourcePath = String(path ?? "").trim();
  if (!sourcePath) throw new TypeError("source path is required");
  const info = await stat(sourcePath);
  if (!info.isFile()) throw new Error(`source is not a regular file: ${sourcePath}`);
  const hash = createHash("sha256");
  throwIfAborted(signal);
  for await (const chunk of createReadStream(sourcePath)) {
    throwIfAborted(signal);
    hash.update(chunk);
  }
  throwIfAborted(signal);
  return {
    path: sourcePath,
    size: info.size,
    mtimeMs: info.mtimeMs,
    sha256: hash.digest("hex"),
  };
}

export async function fingerprintPaths(paths, options = {}) {
  const values = Array.isArray(paths) ? paths : [paths];
  return Promise.all(values.map((path) => fingerprintFile(path, options)));
}

export function sameSourceFingerprint(left, right) {
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}
