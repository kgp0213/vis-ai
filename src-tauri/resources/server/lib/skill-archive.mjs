import { spawnSync as defaultSpawnSync } from "node:child_process";

const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;

export const SKILL_ARCHIVE_SOURCE_ENV = "VISIONOX_SKILL_ARCHIVE_SOURCE";
export const SKILL_ARCHIVE_DESTINATION_ENV = "VISIONOX_SKILL_ARCHIVE_DESTINATION";

const POWERSHELL_EXPAND_ARCHIVE = [
  "$ErrorActionPreference = 'Stop'",
  `Expand-Archive -LiteralPath $env:${SKILL_ARCHIVE_SOURCE_ENV} -DestinationPath $env:${SKILL_ARCHIVE_DESTINATION_ENV} -Force`,
].join("; ");

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function extractSkillArchive(sourcePath, destinationPath, options = {}) {
  const source = String(sourcePath ?? "").trim();
  const destination = String(destinationPath ?? "").trim();
  if (!source || !destination) {
    return { error: "archive source and destination paths are required" };
  }

  const spawnSync = options.spawnSync ?? defaultSpawnSync;
  const platform = options.platform ?? process.platform;
  const spawnOptions = {
    encoding: "utf8",
    maxBuffer: positiveInteger(options.maxBuffer, DEFAULT_MAX_BUFFER),
    timeout: positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS),
    windowsHide: true,
  };

  const result = platform === "win32"
    ? spawnSync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", POWERSHELL_EXPAND_ARCHIVE],
      {
        ...spawnOptions,
        env: {
          ...(options.env ?? process.env),
          [SKILL_ARCHIVE_SOURCE_ENV]: source,
          [SKILL_ARCHIVE_DESTINATION_ENV]: destination,
        },
      },
    )
    : spawnSync("unzip", ["-o", source, "-d", destination], spawnOptions);

  if (result.error) return { error: result.error.message };
  if (result.status !== 0) {
    const fallback = `archive extraction exited with ${result.status ?? "no exit code"}${result.signal ? ` (${result.signal})` : ""}`;
    return { error: String(result.stderr || result.stdout || fallback).trim() };
  }
  return { ok: true, exitCode: result.status, signal: result.signal ?? null };
}
