import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const CURRENT_CONFIG_SCHEMA_VERSION = 1;

const INDEX_RETRIEVAL_MODES = new Set(["auto", "tool", "off"]);

function migrationBackupPath(configPath, fromVersion, toVersion) {
  return join(dirname(configPath), "backups", `config-v${fromVersion}-before-v${toVersion}.json`);
}

function writeOnceAtomic(path, body) {
  if (existsSync(path)) return false;
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, body, { encoding: "utf8", mode: 0o600, flag: "wx" });
    try {
      chmodSync(tmp, 0o600);
    } catch {}
    if (existsSync(path)) return false;
    renameSync(tmp, path);
    return true;
  } finally {
    try {
      unlinkSync(tmp);
    } catch {}
  }
}

function migrateV0ToV1(config, migratedAt) {
  const next = { ...config };
  if (next.indexRetrievalMode !== undefined && !INDEX_RETRIEVAL_MODES.has(next.indexRetrievalMode)) {
    next.indexRetrievalMode = "auto";
  }
  next.configSchemaVersion = 1;
  next.configSchemaMigratedAt = migratedAt;
  return next;
}

export function migrateConfigFile(configPath, { writeConfig, now = () => new Date() } = {}) {
  if (typeof writeConfig !== "function") throw new TypeError("writeConfig is required");

  let raw = null;
  let config = {};
  if (existsSync(configPath)) {
    try {
      raw = readFileSync(configPath, "utf8");
    } catch (error) {
      return { status: "read-error", error: error.message };
    }
    try {
      config = JSON.parse(raw);
    } catch (error) {
      return { status: "invalid-json", error: error.message };
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return { status: "invalid-root" };
    }
  }

  const declaredVersion = config.configSchemaVersion;
  if (declaredVersion !== undefined && (!Number.isInteger(declaredVersion) || declaredVersion < 0)) {
    return { status: "invalid-version", version: declaredVersion };
  }
  const fromVersion = declaredVersion ?? 0;
  if (fromVersion > CURRENT_CONFIG_SCHEMA_VERSION) {
    return { status: "newer-version", version: fromVersion };
  }
  if (fromVersion === CURRENT_CONFIG_SCHEMA_VERSION) {
    return { status: "current", version: fromVersion };
  }

  let next = config;
  const migratedAt = now().toISOString();
  if (fromVersion < 1) next = migrateV0ToV1(next, migratedAt);

  let backupPath = null;
  if (raw !== null) {
    backupPath = migrationBackupPath(configPath, fromVersion, CURRENT_CONFIG_SCHEMA_VERSION);
    try {
      writeOnceAtomic(backupPath, raw);
    } catch (error) {
      return { status: "backup-error", error: error.message };
    }
  }
  try {
    writeConfig(next, configPath);
  } catch (error) {
    return { status: "write-error", error: error.message, backupPath };
  }
  return {
    status: "migrated",
    fromVersion,
    toVersion: CURRENT_CONFIG_SCHEMA_VERSION,
    backupPath,
    config: next,
  };
}
