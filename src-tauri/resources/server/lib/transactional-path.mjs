import { existsSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

function historyPath(target) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve(dirname(target), `${basename(target)}.history-${stamp}-${Math.random().toString(36).slice(2, 8)}`);
}

export function prunePathHistory(target, retain = 3) {
  const dir = dirname(target);
  const prefix = `${basename(target)}.history-`;
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir)
    .filter((name) => name.startsWith(prefix))
    .map((name) => ({ path: resolve(dir, name), mtimeMs: statSync(resolve(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const removed = entries.slice(Math.max(0, retain));
  for (const entry of removed) rmSync(entry.path, { recursive: true, force: true });
  return removed.map((entry) => entry.path);
}

export function replacePathTransactional(target, staging, options = {}) {
  const rename = options.rename ?? renameSync;
  const retain = Number.isInteger(options.retain) ? Math.max(0, options.retain) : 3;
  if (!existsSync(staging)) throw new Error(`staging path does not exist: ${staging}`);

  let history = null;
  if (existsSync(target)) {
    history = historyPath(target);
    rename(target, history);
  }
  try {
    rename(staging, target);
  } catch (error) {
    if (history && !existsSync(target)) {
      try {
        rename(history, target);
      } catch (restoreError) {
        throw new AggregateError([error, restoreError], `replacement failed and rollback failed for ${target}`);
      }
    }
    throw error;
  }

  let cleanupError = null;
  try {
    prunePathHistory(target, retain);
  } catch (error) {
    cleanupError = error.message;
  }
  return { path: target, history, cleanupError };
}
