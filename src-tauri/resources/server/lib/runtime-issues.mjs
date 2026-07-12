const ACTIONABLE_LEVELS = new Set(["warning", "error"]);
const VALID_LEVELS = new Set(["debug", "warning", "error", "fatal"]);

export function createRuntimeIssueRegistry({ log = () => {}, debug = false } = {}) {
  const issues = new Map();

  function clear(key) {
    if (key) issues.delete(key);
  }

  function report(level, { key = null, path = null, message, error = null } = {}) {
    if (!VALID_LEVELS.has(level)) throw new TypeError(`unknown runtime issue level: ${level}`);
    const detail = String(message || error?.message || error || "runtime operation failed");
    if (level !== "debug" || debug) log({ level, key, path, message: detail });
    if (level === "fatal") throw new Error(detail, error ? { cause: error } : undefined);
    if (!key || !ACTIONABLE_LEVELS.has(level)) return;
    const next = { key, path, level, error: detail };
    const previous = issues.get(key);
    if (!previous || previous.level !== next.level || previous.error !== next.error || previous.path !== next.path) {
      issues.set(key, next);
    }
  }

  function listUserActionable() {
    return [...issues.values()];
  }

  return { clear, report, listUserActionable };
}
