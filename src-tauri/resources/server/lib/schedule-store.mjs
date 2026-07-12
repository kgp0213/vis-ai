import { existsSync, readFileSync } from "node:fs";

import { atomicWriteFileSync } from "./atomic-file.mjs";

export const SCHEDULE_STORE_VERSION = 1;

export function readScheduleStore(path, normalize) {
  if (!existsSync(path)) {
    return { ok: true, version: SCHEDULE_STORE_VERSION, schedules: [], source: "missing" };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const version = parsed?.version ?? 0;
    if (version !== 0 && version !== SCHEDULE_STORE_VERSION) {
      return { ok: false, version, schedules: [], error: `unsupported schedule schema version: ${version}` };
    }
    if (!Array.isArray(parsed?.schedules)) {
      return { ok: false, version, schedules: [], error: "schedule store is missing the schedules array" };
    }
    return {
      ok: true,
      version: SCHEDULE_STORE_VERSION,
      schedules: parsed.schedules.map(normalize).filter(Boolean),
      source: version === 0 ? "legacy" : "current",
    };
  } catch (error) {
    return { ok: false, version: null, schedules: [], error: `schedule store is invalid: ${error.message}` };
  }
}

export function writeScheduleStore(path, schedules, write = atomicWriteFileSync) {
  const body = `${JSON.stringify({ version: SCHEDULE_STORE_VERSION, schedules }, null, 2)}\n`;
  write(path, body);
}

export function commitScheduleMutation(current, mutate, persist) {
  const next = structuredClone(current);
  const result = mutate(next);
  if (result?.ok === false) return { ...result, schedules: current };
  persist(next);
  return { ...(result ?? { ok: true }), ok: true, schedules: next };
}
