import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const CURRENT_CONFIG_SCHEMA_VERSION = 1;

const INDEX_RETRIEVAL_MODES = new Set(["auto", "tool", "off"]);
const REDACTED_VALUE = "[REDACTED]";

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

function replaceAtomic(path, body) {
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, body, { encoding: "utf8", mode: 0o600 });
    try {
      chmodSync(tmp, 0o600);
    } catch {}
    renameSync(tmp, path);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {}
  }
}

function isSensitiveKey(key) {
  const normalized = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
  return normalized === "authorization"
    || normalized === "cookie"
    || normalized.endsWith("apikey")
    || normalized.endsWith("password")
    || normalized.endsWith("secret")
    || normalized.endsWith("token");
}

export function redactSensitiveConfig(value) {
  if (Array.isArray(value)) return value.map((item) => redactSensitiveConfig(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    isSensitiveKey(key) ? REDACTED_VALUE : redactSensitiveConfig(item),
  ]));
}

export function sanitizeConfigBackups(configPath) {
  const backupDir = join(dirname(configPath), "backups");
  if (!existsSync(backupDir)) return { sanitized: 0, skipped: 0 };
  let sanitized = 0;
  let skipped = 0;
  let names;
  try {
    names = readdirSync(backupDir);
  } catch {
    return { sanitized: 0, skipped: 1 };
  }
  for (const name of names) {
    if (!/^config-v\d+-before-v\d+\.json$/.test(name)) continue;
    const path = join(backupDir, name);
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      const redacted = redactSensitiveConfig(parsed);
      const body = `${JSON.stringify(redacted, null, 2)}\n`;
      if (body !== readFileSync(path, "utf8")) {
        replaceAtomic(path, body);
        sanitized++;
      }
    } catch {
      skipped++;
    }
  }
  return { sanitized, skipped };
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
  const backupSanitization = sanitizeConfigBackups(configPath);
  if (fromVersion === CURRENT_CONFIG_SCHEMA_VERSION) {
    return { status: "current", version: fromVersion, backupSanitization };
  }

  let next = config;
  const migratedAt = now().toISOString();
  if (fromVersion < 1) next = migrateV0ToV1(next, migratedAt);

  let backupPath = null;
  if (raw !== null) {
    backupPath = migrationBackupPath(configPath, fromVersion, CURRENT_CONFIG_SCHEMA_VERSION);
    try {
      writeOnceAtomic(backupPath, `${JSON.stringify(redactSensitiveConfig(config), null, 2)}\n`);
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
    backupSanitization,
    config: next,
  };
}
