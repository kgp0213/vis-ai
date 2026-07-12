import { statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

export const WORKSPACE_HISTORY_LIMIT = 10;

export function normalizeWorkspacePath(value, options = {}) {
  if (typeof value !== "string" || !value.trim()) throw new Error("workspace path must be a non-empty string");
  return resolve(options.homeDir ?? homedir(), value.trim());
}
export function sameWorkspacePath(left, right, platform = process.platform) {
  if (!left || !right) return false;
  const a = resolve(left);
  const b = resolve(right);
  return platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

export function isWorkspaceDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function normalizeWorkspaceHistory(values, options = {}) {
  const source = Array.isArray(values) ? values : [];
  const exists = options.exists ?? isWorkspaceDirectory;
  const limit = options.limit ?? WORKSPACE_HISTORY_LIMIT;
  const platform = options.platform ?? process.platform;
  const paths = [];
  for (const value of source) {
    let path;
    try {
      path = normalizeWorkspacePath(value, options);
    } catch {
      continue;
    }
    if (!exists(path) || paths.some((item) => sameWorkspacePath(item, path, platform))) continue;
    paths.push(path);
    if (paths.length >= limit) break;
  }
  return paths;
}

export function addRecentWorkspace(path, existing, options = {}) {
  return normalizeWorkspaceHistory([path, ...(Array.isArray(existing) ? existing : [])], options);
}

export function removeRecentWorkspace(path, existing, options = {}) {
  const target = normalizeWorkspacePath(path, options);
  const platform = options.platform ?? process.platform;
  return normalizeWorkspaceHistory(existing, options).filter((item) => !sameWorkspacePath(item, target, platform));
}
