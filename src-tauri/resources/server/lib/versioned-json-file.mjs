import { existsSync, readFileSync } from "node:fs";
import { atomicWriteFileSync } from "./atomic-file.mjs";

function errorResult(path, message, version = null) {
  return { ok: false, path, version, value: null, source: "invalid", error: message };
}

export function readVersionedJsonFile(path, {
  version,
  validate = () => true,
  allowUnversioned = false,
} = {}) {
  if (!Number.isInteger(version) || version < 1) throw new TypeError("a positive schema version is required");
  if (!existsSync(path)) return { ok: true, path, version, value: null, source: "missing", error: null };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return errorResult(path, `invalid JSON: ${error.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return errorResult(path, "root must be an object");
  const declared = parsed.version;
  if (declared === undefined && !allowUnversioned) return errorResult(path, "schema version is missing");
  if (declared !== undefined && (!Number.isInteger(declared) || declared < 0)) return errorResult(path, "schema version must be a non-negative integer");
  if (declared > version) return errorResult(path, `unsupported schema version: ${declared}`, declared);
  let validation;
  try {
    validation = validate(parsed);
  } catch (error) {
    validation = error.message;
  }
  if (validation !== true) return errorResult(path, typeof validation === "string" ? validation : "schema validation failed", declared ?? 0);
  return {
    ok: true,
    path,
    version: declared ?? 0,
    value: parsed,
    source: declared === version ? "current" : "legacy",
    error: null,
  };
}

export function assertVersionedJsonWritable(path, options) {
  const result = readVersionedJsonFile(path, options);
  if (!result.ok) throw new Error(`${result.error}; original file was not modified`);
  return result;
}

export function writeVersionedJsonFile(path, value, { version } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("value must be an object");
  if (!Number.isInteger(version) || version < 1) throw new TypeError("a positive schema version is required");
  const body = { ...value, version };
  atomicWriteFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
  return body;
}
